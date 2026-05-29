import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateItineraryMinutes,
  getTimeBudgetMinutes,
  selectStopsWithinBudget,
} from "../src/itinerary.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5174);
const placesPath = path.join(__dirname, "data", "places.json");
const savedPlansPath = path.join(__dirname, "data", "saved-plans.json");
const GEOAPIFY_API_KEY = "170e5df1a4b648c19721b88d7326ed06";

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

    if (request.method === "GET" && url.pathname.startsWith("/api/map-tile/")) {
      await sendMapTile(response, url.pathname);
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
    text: cleanQuery,
    limit: "6",
    apiKey: GEOAPIFY_API_KEY
  });
  const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`);

  if (!response.ok) return [];

  const payload = await response.json();
  return (payload.features || [])
    .map((feature) => ({
      id: `geoapify-${feature.properties?.place_id}`,
      name: feature.properties?.name || feature.properties?.address_line1 || "Selected location",
      label: feature.properties?.formatted || feature.properties?.address_line2 || "Geoapify result",
      lat: Number(feature.properties?.lat),
      lng: Number(feature.properties?.lon),
      source: "Geoapify"
    }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

async function sendMapTile(response, pathname) {
  const match = pathname.match(/^\/api\/map-tile\/(\d+)\/(\d+)\/(\d+)\.png$/);
  if (!match) {
    sendJson(response, 404, { error: "Tile not found" });
    return;
  }

  const [, z, x, y] = match;
  const tileUrl = `https://maps.geoapify.com/v1/tile/osm-bright/${z}/${x}/${y}.png?apiKey=${GEOAPIFY_API_KEY}`;
  const tileResponse = await fetch(tileUrl);

  if (!tileResponse.ok) {
    sendJson(response, 502, { error: "Map tile unavailable" });
    return;
  }

  const tileBuffer = Buffer.from(await tileResponse.arrayBuffer());
  sendCors(response, 200, {
    "Cache-Control": "public, max-age=86400",
    "Content-Type": tileResponse.headers.get("content-type") || "image/png"
  });
  response.end(tileBuffer);
}

async function generateItinerary(places, body) {
  const hours = clamp(Number(body.hours || 2), 1, 4);
  const pace = body.pace || "Moderate";
  const location = body.location || "Sophia Antipolis";
  const routeMode = body.routeMode || "Walk";
  const interests = Array.isArray(body.interests) ? body.interests : [];
  const position = normalizePoint(body.position);
  const budgetMinutes = getTimeBudgetMinutes(hours, pace);

  const stops = selectStopsWithinBudget(places, { hours, interests, pace, routeMode });
  const route = await buildRouteDetails(stops, routeMode, position);
  const plannedMinutes = calculateItineraryMinutes(stops, routeMode, pace);

  return {
    location,
    hours,
    pace,
    budgetMinutes,
    plannedMinutes,
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
  const geoapifyRoute = await getGeoapifyDistance(points, routeMode);
  if (geoapifyRoute) return geoapifyRoute;

  const googleRoute = await getGoogleDistance(points, routeMode);
  if (googleRoute) return googleRoute;

  const osrmRoute = await getOsrmDistance(points, routeMode);
  if (osrmRoute) return osrmRoute;

  return getStraightLineDistance(points, routeMode);
}

async function getGeoapifyDistance(points, routeMode) {
  try {
    const waypoints = points.map(formatPoint).join("|");
    const mode = routeMode === "Transit" ? "transit" : "walk";
    const params = new URLSearchParams({ waypoints, mode, apiKey: GEOAPIFY_API_KEY });
    const response = await fetch(`https://api.geoapify.com/v1/routing?${params.toString()}`);
    if (!response.ok) return null;

    const payload = await response.json();
    const route = payload.features?.[0];
    const properties = route?.properties;
    if (!properties) return null;

    const legs = Array.isArray(properties.legs)
      ? properties.legs.map((leg) => ({
          distanceKm: Number((leg.distance / 1000).toFixed(2)),
          travelMinutes: Math.max(1, Math.round(leg.time / 60))
        }))
      : [];

    return {
      distanceKm: Number((properties.distance / 1000).toFixed(2)),
      travelMinutes: Math.max(1, Math.round(properties.time / 60)),
      source: "Geoapify Routing API",
      legs,
      geometry: route.geometry
    };
  } catch {
    return null;
  }
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
