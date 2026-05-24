import React, { useEffect, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles.css";

const timeOptions = [1, 2, 3, 4];
const interestOptions = ["Culture", "Food", "Nature", "Shopping", "Art", "History"];
const paceOptions = ["Relaxed", "Moderate", "Fast"];
const navItems = ["Home", "Plan", "Itinerary", "Map", "Saved"];

function App() {
  const [screen, setScreen] = useState("Home");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [places, setPlaces] = useState([]);
  const [selectedHours, setSelectedHours] = useLocalStorage("goldenhours-hours", 2);
  const [interests, setInterests] = useLocalStorage("goldenhours-interests", ["Culture", "Food"]);
  const [pace, setPace] = useLocalStorage("goldenhours-pace", "Moderate");
  const [location, setLocation] = useLocalStorage("goldenhours-location", "Sophia Antipolis");
  const [routeMode, setRouteMode] = useLocalStorage("goldenhours-route-mode", "Walk");
  const [savedPlans, setSavedPlans] = useLocalStorage("goldenhours-saved-plans", []);
  const [position, setPosition] = useLocalStorage("goldenhours-position", null);
  const [serverPlan, setServerPlan] = useState([]);
  const [routeSummary, setRouteSummary] = useState(null);
  const [savedTrips, setSavedTrips] = useState([]);
  const [history, setHistory] = useState([]);
  const [draggedId, setDraggedId] = useState(null);

  useEffect(() => {
    fetchJson("/api/places")
      .then((response) => response.json())
      .then((items) => {
        // This safety check ensures React won't crash if the backend sends weird data
        setPlaces(Array.isArray(items) ? items : items.places || []);
      })
      .catch(() =>
        fetchJson("/data/places.json")
          .then((response) => response.json())
          .then((items) => {
            setPlaces(Array.isArray(items) ? items : items.places || []);
          })
          .catch(() => toast.error("Recommendations are unavailable.")),
      );
  }, []);
  const plannedStops = useMemo(() => {
    const preferred = places.filter((place) => interests.includes(place.category));
    const rest = places.filter((place) => !interests.includes(place.category));
    const ordered = [...preferred, ...rest].slice(0, Math.min(places.length, selectedHours + 1));
    return savedPlans.length ? savedPlans : serverPlan.length ? serverPlan : ordered;
  }, [interests, places, savedPlans, selectedHours, serverPlan]);

  function toggleInterest(interest) {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    );
  }

  function detectLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation is unavailable in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (current) => {
        const coords = current.coords;
        setPosition({ lat: coords.latitude, lng: coords.longitude });
        setLocation(`My location (${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)})`);
        toast.success("Current location added.");
      },
      () => toast.error("Could not read your current location."),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  }

  function handleLocationChange(value) {
    setLocation(value);
    const match = places.find((place) => place.name.toLowerCase() === value.trim().toLowerCase());
    if (match) {
      setPosition({ lat: match.lat, lng: match.lng });
    } else if (!value.startsWith("My location")) {
      setPosition(null);
    }
  }

  function selectLocation(place) {
    setLocation(place.label || place.name);
    setPosition({ lat: place.lat, lng: place.lng });
    toast.success(`${place.name} selected as your start point.`);
  }

  async function generatePlan(event) {
    event.preventDefault();
    setSavedPlans([]);

    if (!position) {
      toast.error("Choose a location from search results or press My Location.");
      return;
    }

    try {
      const response = await fetchJson("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hours: selectedHours,
          interests,
          pace,
          location,
          routeMode,
          position,
        }),
      });
      const plan = await response.json();
      setServerPlan(plan.stops || []);
      setRouteSummary(plan.route || null);
      toast.success("Trip plan created.");

      await fetchJson("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, stops: plan.stops || [] }),
      });
      refreshSavedTrips();
    } catch {
      setServerPlan([]);
      setRouteSummary(null);
      toast.info("Using the local trip planner.");
    }

    navigate("Itinerary");
  }

  function handleDrop(targetId) {
    if (!draggedId || draggedId === targetId) return;
    const current = [...plannedStops];
    const fromIndex = current.findIndex((place) => place.id === draggedId);
    const toIndex = current.findIndex((place) => place.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    setSavedPlans(current);
    setDraggedId(null);
    toast.success("Stop order updated.");
  }
  function moveStop(stopId, direction) {
    const current = [...plannedStops];
    const fromIndex = current.findIndex((place) => place.id === stopId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= current.length) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    setSavedPlans(current);
    toast.success("Stop order updated.");
  }

  function navigate(nextScreen) {
    if (nextScreen === screen) return;
    setHistory((current) => [...current, screen]);
    setScreen(nextScreen);
  }

  function goBack() {
    setHistory((current) => {
      const next = [...current];
      setScreen(next.pop() || "Home");
      return next;
    });
  }

  async function refreshSavedTrips() {
    try {
      const response = await fetchJson("/api/plans");
      setSavedTrips(await response.json());
    } catch {
      setSavedTrips([]);
    }
  }

  function loadSavedTrip(trip) {
    setSavedPlans(trip.stops || []);
    setRouteSummary(null);
    navigate("Itinerary");
    toast.success("Saved trip loaded.");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" onClick={() => navigate("Home")} aria-label="GoldenHours home">
          <span className="brand-mark">GH</span>
          <span>
            <strong>GoldenHours</strong>
            <small>Make every hour count</small>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              key={item}
              className={screen === item ? "active" : ""}
              type="button"
              onClick={() => {
                if (!isLoggedIn && item !== "Home") {
                  toast.info("Please log in first.");
                  navigate("Login");
                  return;
                }

                navigate(item);
              }}
            >
              {item}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {screen === "Home" && (
          <HomeScreen
            onStart={() => navigate("Signup")}
            onLogin={() => navigate("Login")}
          />
        )}
        {screen === "Plan" && (
          <PlanScreen
            detectLocation={detectLocation}
            generatePlan={generatePlan}
            interests={interests}
            location={location}
            pace={pace}
            places={places}
            routeMode={routeMode}
            selectedHours={selectedHours}
            selectLocation={selectLocation}
            setLocation={handleLocationChange}
            setPace={setPace}
            setRouteMode={setRouteMode}
            setSelectedHours={setSelectedHours}
            toggleInterest={toggleInterest}
          />
        )}
        {screen === "Itinerary" && (
          <ItineraryScreen
            plannedStops={plannedStops}
            selectedHours={selectedHours}
            setDraggedId={setDraggedId}
            handleDrop={handleDrop}
            moveStop={moveStop}
            onMap={() => navigate("Map")}
            onSaved={() => navigate("Saved")}
            onBack={goBack}
          />
        )}
        {screen === "Map" && (
          <MapScreen
            plannedStops={plannedStops}
            position={position}
            routeSummary={routeSummary}
            routeMode={routeMode}
            setRouteSummary={setRouteSummary}
            setRouteMode={setRouteMode}
            onBack={goBack}
          />
        )}
        {screen === "Saved" && (
          <SavedTripsScreen trips={savedTrips} onLoad={loadSavedTrip} onBack={goBack} />
        )}
        {screen === "Login" && (
          <LoginScreen
            onSuccess={() => {
              setIsLoggedIn(true);
              navigate("Plan");
            }}
            onBack={goBack}
          />
        )}

        {screen === "Signup" && (
          <SignupScreen
            onSuccess={() => navigate("Login")}
            onBack={goBack}
          />
        )}
      </main>

      <footer className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <button
            key={item}
            className={screen === item ? "active" : ""}
            type="button"
            onClick={() => {
              if (!isLoggedIn && item !== "Home") {
                toast.info("Please log in first.");
                navigate("Login");
                return;
              }

              navigate(item);
            }}
            aria-label={`Open ${item}`}
          >
            <span aria-hidden="true">{iconFor(item)}</span>
            {item}
          </button>
        ))}
      </footer>
      <ToastContainer position="top-right" autoClose={2200} />
    </div>
  );
}

function HomeScreen({ onStart, onLogin }) {
  return (
    <section className="hero" id="home" aria-labelledby="hero-title">
      <article className="hero-copy" itemScope itemType="https://schema.org/SoftwareApplication">
        <h1 id="hero-title" itemProp="name">
          Golden<span>Hours</span>
        </h1>
        <p itemProp="description">
          A mobile travel planner that turns 1 to 4 spare hours into a rated city itinerary with nearby
          stops and clear route choices.
        </p>
        <div className="hero-actions">
          <button className="primary-action" type="button" onClick={onStart}>
            Get started
          </button>
          <button className="secondary-action" type="button" onClick={onLogin}>
            Log in
          </button>
        </div>
      </article>
      <section className="phone-preview" aria-label="Application preview">
        <div className="phone-notch" />
        <div className="hourglass" aria-hidden="true">GH</div>
        <h2>GoldenHours</h2>
        <p>Make every hour count</p>
        <div className="preview-tabs" aria-hidden="true">
          <span className="active" />
          <span />
          <span />
        </div>
      </section>
    </section>
  );
}

function PlanScreen(props) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [locationMatches, setLocationMatches] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTerm = props.location.trim().toLowerCase();

  useEffect(() => {
    if (searchTerm.length < 2 || searchTerm.startsWith("my location")) {
      setLocationMatches([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);
      fetchJson(`/api/geocode?q=${encodeURIComponent(props.location)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((results) => setLocationMatches(Array.isArray(results) ? results : []))
        .catch((error) => {
          if (error.name !== "AbortError") setLocationMatches([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [props.location, searchTerm]);

  return (
    <section className="planner-view" aria-labelledby="plan-title">
      <div className="section-heading">
        <h1 id="plan-title">Plan Your Trip</h1>
      </div>
      <form className="planner-form" onSubmit={props.generatePlan}>
        <label className="field-label" htmlFor="location">
          Location
        </label>
        <div className="location-row">
          <div className="location-search">
            <input
              id="location"
              name="location"
              value={props.location}
              onChange={(event) => {
                props.setLocation(event.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Search any location"
              autoComplete="off"
            />
            {isSearchOpen && (
              <div className="location-results" role="listbox" aria-label="Location suggestions">
                {isSearching ? (
                  <p>Searching locations...</p>
                ) : locationMatches.length > 0 ? (
                  locationMatches.map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        props.selectLocation(place);
                        setIsSearchOpen(false);
                      }}
                      role="option"
                    >
                      <strong>{place.name}</strong>
                      <span>{place.label || place.source}</span>
                    </button>
                  ))
                ) : (
                  <p>Type a place name to search OpenStreetMap.</p>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={props.detectLocation} aria-label="Use current location">
            My Location
          </button>
        </div>

        <fieldset>
          <legend>Available Time</legend>
          <div className="segmented-control">
            {timeOptions.map((hour) => (
              <button
                key={hour}
                className={props.selectedHours === hour ? "selected" : ""}
                type="button"
                onClick={() => props.setSelectedHours(hour)}
              >
                {hour === 4 ? "4h+" : `${hour}h`}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Interests</legend>
          <div className="chip-grid">
            {interestOptions.map((interest) => (
              <button
                key={interest}
                className={props.interests.includes(interest) ? "selected" : ""}
                type="button"
                onClick={() => props.toggleInterest(interest)}
              >
                {interest}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Pace Preference</legend>
          <div className="segmented-control">
            {paceOptions.map((option) => (
              <button
                key={option}
                className={props.pace === option ? "selected muted" : ""}
                type="button"
                onClick={() => props.setPace(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Route Mode</legend>
          <div className="segmented-control">
            {["Walk", "Transit"].map((mode) => (
              <button
                key={mode}
                className={props.routeMode === mode ? "selected" : ""}
                type="button"
                onClick={() => props.setRouteMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </fieldset>

        <button className="primary-action wide" type="submit">
          Generate My Plan
        </button>
      </form>
    </section>
  );
}

function ItineraryScreen({ plannedStops, selectedHours, setDraggedId, handleDrop, moveStop, onMap, onSaved, onBack }) {
  return (
    <section className="itinerary-view" aria-labelledby="itinerary-title">
      <div className="section-heading inline">
        <div>
          <BackButton onClick={onBack} />
          <h1 id="itinerary-title">Your {selectedHours}h Plan</h1>
        </div>
        <span className="pill">{plannedStops.length} stops</span>
      </div>
      <ol className="timeline" aria-label="Itinerary stops, reorderable">
        {plannedStops.map((place, index) => (
          <li
            key={place.id}
            draggable
            onDragStart={() => setDraggedId(place.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDrop(place.id)}
          >
            <span className="step-number">{index + 1}</span>
            <article className="stop-card">
              <header>
                <h2>{place.name}</h2>
                <span>{place.category}</span>
              </header>
              <p className="rating">Rating {place.rating} from {place.reviews} reviews</p>
              <p>{place.duration} min visit - {place.travelMinutes ?? place.walk} min {place.routeMode?.toLowerCase() || "walk"} - {place.distance}</p>
              <small>{place.description}</small>
              <div className="reorder-controls">
                <button
                  type="button"
                  onClick={() => moveStop(place.id, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${place.name} up`}
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => moveStop(place.id, 1)}
                  disabled={index === plannedStops.length - 1}
                  aria-label={`Move ${place.name} down`}
                >
                  Down
                </button>
              </div>
            </article>
          </li>
        ))}
      </ol>
      <div className="stacked-actions">
        <button className="primary-action wide" type="button" onClick={onMap}>
          Start Route
        </button>
        <button className="secondary-action wide" type="button">
          Regenerate
        </button>
        <button className="secondary-action wide" type="button" onClick={onSaved}>
          Saved Trips
        </button>
      </div>
    </section>
  );
}

function MapScreen({ plannedStops, position, routeSummary, routeMode, setRouteMode, setRouteSummary, onBack }) {
  const [showEmbeddedMap, setShowEmbeddedMap] = useState(false);
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  useEffect(() => {
    if (!plannedStops.length) return;

    const controller = new AbortController();
    setIsRouteLoading(true);

    fetchJson("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stops: plannedStops, routeMode, position }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((summary) => setRouteSummary(summary))
      .catch((error) => {
        if (error.name !== "AbortError") {
          toast.info("Route distance could not be refreshed.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsRouteLoading(false);
      });

    return () => controller.abort();
  }, [plannedStops, position, routeMode, setRouteSummary]);

  function showNavigation() {
    if (!plannedStops.length) {
      toast.error("Create a trip plan first.");
      return;
    }

    setShowEmbeddedMap(true);
  }

  const routeText = routeSummary
    ? `${routeSummary.distanceKm} km total - ${routeSummary.travelMinutes} min ${routeMode === "Walk" ? "walk" : "transit"}`
    : "Route distance will appear after generating a plan.";

  return (
    <section className="map-view" aria-labelledby="map-title">
      <div className="section-heading inline">
        <div>
          <BackButton onClick={onBack} />
          <h1 id="map-title">Route Map</h1>
        </div>

      </div>
      <div className="segmented-control compact" role="group" aria-label="Route mode">
        {["Walk", "Transit"].map((mode) => (
          <button
            key={mode}
            className={routeMode === mode ? "selected" : ""}
            type="button"
            onClick={() => {
              setRouteMode(mode);
              setShowEmbeddedMap(false);
            }}
          >
            {mode}
          </button>
        ))}
      </div>
      <p className="route-summary">
        {isRouteLoading ? "Checking live route distance..." : routeText}
        {routeSummary?.source && <small>{routeSummary.source}</small>}
      </p>
      <article className="transit-card">
        <h2>Transit Options Nearby</h2>
        <p><strong>T2</strong> Tram - Museum Stop</p>
        <p><strong>M4</strong> Metro - Park Station</p>
        {position && <small>Current position saved for this session.</small>}
      </article>
      <button className="primary-action wide" type="button" onClick={showNavigation}>
        Navigate
      </button>
      {showEmbeddedMap && (
        <div className="embedded-map-box">
          <RouteMap
            plannedStops={plannedStops}
            position={position}
            routeSummary={routeSummary}
          />
        </div>
      )}
    </section>
  );
}

function RouteMap({ plannedStops, position, routeSummary }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerGroup = useRef(null);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    if (!mapInstance.current) {
      mapInstance.current = window.L.map(mapRef.current, { scrollWheelZoom: false }).setView([43.7, 7.26], 13);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(mapInstance.current);
      layerGroup.current = window.L.layerGroup().addTo(mapInstance.current);
    }

    layerGroup.current.clearLayers();
    const points = [
      position ? { ...position, name: "Start" } : null,
      ...plannedStops.map((stop, index) => ({ ...stop, name: `${index + 1}. ${stop.name}` }))
    ].filter(Boolean);

    points.forEach((point) => {
      window.L.marker([point.lat, point.lng]).addTo(layerGroup.current).bindPopup(point.name);
    });

    const geometryPoints = routeSummary?.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]);
    const linePoints = geometryPoints?.length ? geometryPoints : points.map((point) => [point.lat, point.lng]);
    if (linePoints.length > 1) {
      const routeLine = window.L.polyline(linePoints, { color: "#c9582d", weight: 5, opacity: 0.9 }).addTo(layerGroup.current);
      mapInstance.current.fitBounds(routeLine.getBounds(), { padding: [28, 28] });
    } else if (points.length === 1) {
      mapInstance.current.setView([points[0].lat, points[0].lng], 14);
    }

    window.setTimeout(() => mapInstance.current?.invalidateSize(), 80);
  }, [plannedStops, position, routeSummary]);

  return <div className="live-route-map" ref={mapRef} aria-label="Route map" />;
}
function SavedTripsScreen({ trips, onLoad, onBack }) {
  return (
    <section className="saved-view" aria-labelledby="saved-title">
      <div className="section-heading">
        <BackButton onClick={onBack} />
        <h1 id="saved-title">Saved Trips</h1>
      </div>
      <div className="saved-list">
        {trips.length === 0 && <p>No saved trips yet.</p>}
        {trips.map((trip) => (
          <article className="saved-card" key={trip.id}>
            <header>
              <h2>{trip.location}</h2>
              <span>{trip.stops.length} stops</span>
            </header>
            <p>{new Date(trip.createdAt).toLocaleDateString()}</p>
            <button className="secondary-action" type="button" onClick={() => onLoad(trip)}>
              Load trip
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function LoginScreen({ onSuccess, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  function handleLogin(event) {
    event.preventDefault();
    setStatus("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      toast.error("Please enter both your email and password.");
      return;
    }

    const savedUser = JSON.parse(localStorage.getItem("goldenhours-user"));

    if (
      savedUser &&
      savedUser.email === cleanEmail &&
      savedUser.password === cleanPassword
    ) {
      onSuccess();
    } else {
      toast.error("Invalid credentials.");
    }
  }

  return (
    <section className="planner-view" aria-labelledby="login-title">
      <div className="section-heading">
        <BackButton onClick={onBack} />
        <h1 id="login-title">Welcome Back</h1>
      </div>

      <form className="planner-form" onSubmit={handleLogin}>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email"
        />

        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
        />


        <button className="primary-action wide" type="submit">
          Login
        </button>
      </form>
    </section>
  );
}

function SignupScreen({ onSuccess, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  function handleSignup(event) {
    event.preventDefault();
    setStatus("");
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    if (!cleanEmail || !cleanPassword) {
      toast.error("Please enter both an email and a password.");
      return;
    }
    localStorage.setItem(
      "goldenhours-user",
      JSON.stringify({ email: cleanEmail, password: cleanPassword })
    );
    toast.success("Account created.");
    onSuccess();
  }

  return (
    <section className="planner-view" aria-labelledby="signup-title">
      <div className="section-heading">
        <BackButton onClick={onBack} />
        <h1 id="signup-title">Create Account</h1>
      </div>
      <form className="planner-form" onSubmit={handleSignup}>
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email"
        />
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
        />
        <button className="primary-action wide" type="submit">
          Sign Up
        </button>
      </form>
    </section>
  );
}

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function iconFor(item) {
  return {
    Home: "H",
    Plan: "P",
    Itinerary: "I",
    Map: "M",
    Saved: "S",
  }[item];
}

function fetchJson(url, options) {
  return fetch(url, options).then((response) => {
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }
    return response;
  });
}
function BackButton({ onClick }) {
  return (
    <button className="back-button" type="button" onClick={onClick}>
      Back
    </button>
  );
}

createRoot(document.getElementById("root")).render(<App />);
