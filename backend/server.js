import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5174);
const placesPath = path.join(__dirname, "data", "places.json");
const savedPlansPath = path.join(__dirname, "data", "saved-plans.json");

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "OPTIONS") {
      sendCors(response, 204);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { status: "ok", app: "GoldenHours", timestamp: new Date().toISOString() });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/places") {
      sendJson(response, 200, await loadJson(placesPath));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/geocode") {
      sendJson(response, 200, await searchLocations(url.searchParams.get("q")));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/itinerary") {
      const body = await readJsonBody(request);
      const places = await loadJson(placesPath);
      sendJson(response, 200, await generateItinerary(places, body));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/route") {
      const body = await readJsonBody(request);
      sendJson(response, 200, await buildRouteDetails(body.stops || [], body.routeMode, body.position));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/plans") {
      sendJson(response, 200, await loadJson(savedPlansPath));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/plans") {
      const body = await readJsonBody(request);
      const plans = await loadJson(savedPlansPath);
      const nextPlan = {
        id: `plan-${Date.now()}`,
        createdAt: new Date().toISOString(),
        location: body.location || "Sophia Antipolis",
        stops: Array.isArray(body.stops) ? body.stops : []
      };
      await writeFile(savedPlansPath, JSON.stringify([nextPlan, ...plans].slice(0, 20), null, 2));
      sendJson(response, 201, nextPlan);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/carbon") {
      const places = await loadJson(placesPath);
      sendJson(response, 200, estimateCarbon(places.slice(0, 4), "Walk"));
      return;
    }

    sendJson(response, 404, { error: "Route not found" });
  } catch (error) {
    sendJson(response, 500, { error: "Internal server error", details: error.message });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`GoldenHours backend running at http://127.0.0.1:${port}`);
});

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function searchLocations(query) {
  const cleanQuery = String(query || "").trim();
  if (cleanQuery.length < 2) return [];

  const params = new URLSearchParams({
    q: cleanQuery,
    format: "jsonv2",
    addressdetails: "1",
    limit: "6"
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "GoldenHours student project"
    }
  });

  if (!response.ok) return [];

  const results = await response.json();
  return results
    .map((item) => ({
      id: `osm-${item.place_id}`,
      name: item.name || item.display_name?.split(",")[0] || "Selected location",
      label: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
      source: "OpenStreetMap"
    }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

async function generateItinerary(places, body) {
  const hours = clamp(Number(body.hours || 2), 1, 4);
  const pace = body.pace || "Moderate";
  const location = body.location || "Sophia Antipolis";
  const routeMode = body.routeMode || "Walk";
  const interests = Array.isArray(body.interests) ? body.interests : [];
  const position = normalizePoint(body.position);
  const maxStops = Math.min(places.length, hours + (pace === "Fast" ? 2 : 1));

  const preferred = places
    .filter((place) => interests.includes(place.category))
    .sort((a, b) => b.rating - a.rating);
  const remaining = places
    .filter((place) => !interests.includes(place.category))
    .sort((a, b) => b.rating - a.rating);
  const stops = [...preferred, ...remaining].slice(0, maxStops);
  const route = await buildRouteDetails(stops, routeMode, position);

  return {
    location,
    hours,
    pace,
    stops: attachRouteLegs(stops, route.legs, routeMode),
    route,
    carbon: estimateCarbon(stops, routeMode)
  };
}

async function buildRouteDetails(stops, routeMode, position) {
  const routePoints = [
    normalizePoint(position),
    ...stops.map(normalizePoint)
  ].filter(Boolean);
  const walkMinutes = stops.reduce((sum, stop) => sum + (Number(stop.walk) || 0), 0);
  const visitMinutes = stops.reduce((sum, stop) => sum + (Number(stop.duration) || 0), 0);
  const route = routePoints.length > 1
    ? await getRouteMetrics(routePoints, routeMode)
    : { distanceKm: 0, travelMinutes: 0, source: "No route" };

  return {
    mode: routeMode,
    distanceKm: route.distanceKm,
    travelMinutes: route.travelMinutes || (routeMode === "Transit" ? Math.max(8, Math.round(walkMinutes * 0.58)) : walkMinutes),
    visitMinutes,
    source: route.source,
    legs: route.legs || [],
    geometry: route.geometry || pointsToGeometry(routePoints)
  };
}

function attachRouteLegs(stops, legs, routeMode) {
  return stops.map((stop, index) => {
    const leg = legs?.[index];
    const travelMinutes = leg?.travelMinutes || (routeMode === "Transit" ? Math.max(3, Math.round((Number(stop.walk) || 0) * 0.58)) : Number(stop.walk) || 0);
    const distanceKm = Number.isFinite(leg?.distanceKm) ? leg.distanceKm : parseDistanceKm(stop.distance);

    return {
      ...stop,
      distance: formatDistance(distanceKm),
      walk: travelMinutes,
      travelMinutes,
      legDistanceKm: distanceKm,
      routeMode
    };
  });
}

async function getRouteMetrics(points, routeMode) {
  const googleRoute = await getGoogleDistance(points, routeMode);
  if (googleRoute) return googleRoute;

  const osrmRoute = await getOsrmDistance(points, routeMode);
  if (osrmRoute) return osrmRoute;

  return getStraightLineDistance(points, routeMode);
}

async function getGoogleDistance(points, routeMode) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const origins = points.slice(0, -1).map(formatPoint).join("|");
    const destinations = points.slice(1).map(formatPoint).join("|");
    const mode = routeMode === "Transit" ? "transit" : "walking";
    const params = new URLSearchParams({ origins, destinations, mode, key: apiKey });
    const response = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`);
    if (!response.ok) return null;

    const payload = await response.json();
    if (payload.status !== "OK") return null;

    const legs = payload.rows
      .map((row, index) => row.elements[index])
      .filter((element) => element?.status === "OK")
      .map((leg) => ({
        distanceKm: Number((leg.distance.value / 1000).toFixed(2)),
        travelMinutes: Math.max(1, Math.round(leg.duration.value / 60))
      }));
    if (legs.length !== points.length - 1) return null;

    return {
      distanceKm: Number(legs.reduce((sum, leg) => sum + leg.distanceKm, 0).toFixed(2)),
      travelMinutes: legs.reduce((sum, leg) => sum + leg.travelMinutes, 0),
      source: "Google Maps Distance Matrix",
      legs,
      geometry: pointsToGeometry(points)
    };
  } catch {
    return null;
  }
}

async function getOsrmDistance(points, routeMode) {
  if (routeMode === "Transit") return null;
  if (getStraightLineDistance(points, routeMode).distanceKm > 300) return null;

  try {
    const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(";");
    const response = await fetch(`https://router.project-osrm.org/route/v1/foot/${coordinates}?overview=full&geometries=geojson`);
    if (!response.ok) return null;

    const payload = await response.json();
    const route = payload.routes?.[0];
    if (!route) return null;
    const legs = Array.isArray(route.legs)
      ? route.legs.map((leg) => ({
          distanceKm: Number((leg.distance / 1000).toFixed(2)),
          travelMinutes: Math.max(1, Math.round(leg.duration / 60))
        }))
      : [];

    return {
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      travelMinutes: Math.max(1, Math.round(route.duration / 60)),
      source: "OSRM route API",
      legs,
      geometry: route.geometry
    };
  } catch {
    return null;
  }
}

function getStraightLineDistance(points, routeMode) {
  const speedKmh = routeMode === "Transit" ? 18 : 4.8;
  const legs = points.slice(1).map((point, index) => {
    const distanceKm = haversineKm(points[index], point);
    return {
      distanceKm: Number(distanceKm.toFixed(2)),
      travelMinutes: Math.max(1, Math.round((distanceKm / speedKmh) * 60))
    };
  });

  return {
    distanceKm: Number(legs.reduce((sum, leg) => sum + leg.distanceKm, 0).toFixed(2)),
    travelMinutes: legs.reduce((sum, leg) => sum + leg.travelMinutes, 0),
    source: "Straight-line fallback",
    legs,
    geometry: pointsToGeometry(points)
  };
}

function pointsToGeometry(points) {
  return {
    type: "LineString",
    coordinates: points.map((point) => [point.lng, point.lat])
  };
}

function normalizePoint(point) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function formatPoint(point) {
  return `${point.lat},${point.lng}`;
}

function haversineKm(a, b) {
  const earthKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.sqrt(h));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function parseDistanceKm(distance) {
  if (typeof distance !== "string") return 0;
  const value = Number.parseFloat(distance);
  if (!Number.isFinite(value)) return 0;
  return distance.toLowerCase().includes("km") ? value : value / 1000;
}

function formatDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) return "0 m";
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
}

function estimateCarbon(stops, routeMode) {
  const estimatedTransferKb = 245 + stops.length * 6;
  const pageLoadGrams = (estimatedTransferKb / 1024 / 1024) * 0.81 * 442;
  const routeGrams = routeMode === "Transit" ? stops.length * 12 : 0;
  return {
    method: "Static estimate; replace with CodeCarbon measurement in final report.",
    estimatedTransferKb,
    pageLoadGramsCo2e: Number(pageLoadGrams.toFixed(3)),
    routeGramsCo2e: routeGrams,
    totalGramsCo2e: Number((pageLoadGrams + routeGrams).toFixed(3))
  };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function sendJson(response, statusCode, payload) {
  sendCors(response, statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function sendCors(response, statusCode, headers = {}) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...headers
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
