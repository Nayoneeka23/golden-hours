import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const timeOptions = [1, 2, 3, 4];
const interestOptions = ["Culture", "Food", "Nature", "Shopping", "Art", "History"];
const paceOptions = ["Relaxed", "Moderate", "Fast"];
const navItems = ["Home", "Plan", "Itinerary", "Map"];

function App() {
  const [screen, setScreen] = useState("Home");
  const [places, setPlaces] = useState([]);
  const [selectedHours, setSelectedHours] = useLocalStorage("goldenhours-hours", 2);
  const [interests, setInterests] = useLocalStorage("goldenhours-interests", ["Culture", "Food"]);
  const [pace, setPace] = useLocalStorage("goldenhours-pace", "Moderate");
  const [location, setLocation] = useLocalStorage("goldenhours-location", "Sophia Antipolis");
  const [routeMode, setRouteMode] = useLocalStorage("goldenhours-route-mode", "Walk");
  const [savedPlans, setSavedPlans] = useLocalStorage("goldenhours-saved-plans", []);
  const [position, setPosition] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [loadState, setLoadState] = useState("Loading local recommendations");

  useEffect(() => {
    fetch("/data/places.json")
      .then((response) => response.json())
      .then((items) => {
        setPlaces(items);
        setLoadState("Recommendations loaded");
      })
      .catch(() => setLoadState("Using fallback recommendations"));
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const plannedStops = useMemo(() => {
    const preferred = places.filter((place) => interests.includes(place.category));
    const rest = places.filter((place) => !interests.includes(place.category));
    const ordered = [...preferred, ...rest].slice(0, Math.min(places.length, selectedHours + 1));
    return savedPlans.length ? savedPlans : ordered;
  }, [interests, places, savedPlans, selectedHours]);

  function toggleInterest(interest) {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    );
  }

  function detectLocation() {
    if (!navigator.geolocation) {
      setLocation("Geolocation unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (current) => {
        const coords = current.coords;
        setPosition({ lat: coords.latitude, lng: coords.longitude });
        setLocation(`Near ${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`);
      },
      () => setLocation("Sophia Antipolis"),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  }

  function generatePlan(event) {
    event.preventDefault();
    setSavedPlans([]);
    setScreen("Itinerary");
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
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" onClick={() => setScreen("Home")} aria-label="GoldenHours home">
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
              onClick={() => setScreen(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {screen === "Home" && (
  <HomeScreen
    onStart={() => setScreen("Signup")}
    onLogin={() => setScreen("Login")}
  />
)}
        {screen === "Plan" && (
          <PlanScreen
            detectLocation={detectLocation}
            generatePlan={generatePlan}
            interests={interests}
            loadState={loadState}
            location={location}
            pace={pace}
            selectedHours={selectedHours}
            setLocation={setLocation}
            setPace={setPace}
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
            onMap={() => setScreen("Map")}
          />
        )}
        {screen === "Map" && (
          <MapScreen
            plannedStops={plannedStops}
            position={position}
            routeMode={routeMode}
            setRouteMode={setRouteMode}
          />
        )}
        {screen === "Login" && (
  <LoginScreen
    onSuccess={() => setScreen("Plan")}
  />
)}

{screen === "Signup" && (
  <SignupScreen
    onSuccess={() => setScreen("Login")}
  />
)}
      </main>

      <aside className="status-panel" aria-label="Project requirement status">
        <strong>Prototype status</strong>
        <span>React frontend</span>
        <span>Local Storage active</span>
        <span>HTML5 sections</span>
        <span>PWA ready</span>
      </aside>

      <footer className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <button
            key={item}
            className={screen === item ? "active" : ""}
            type="button"
            onClick={() => setScreen(item)}
            aria-label={`Open ${item}`}
          >
            <span aria-hidden="true">{iconFor(item)}</span>
            {item}
          </button>
        ))}
      </footer>
    </div>
  );
}

function HomeScreen({ onStart }) {
  return (
    <section className="hero" id="home" aria-labelledby="hero-title">
      <article className="hero-copy" itemScope itemType="https://schema.org/SoftwareApplication">
        <p className="eyebrow">EURECOM WebInt 2026</p>
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
          <button className="secondary-action" type="button" onClick={onStart}>
            Log in
          </button>
        </div>
      </article>
      <section className="phone-preview" aria-label="Application preview">
        <div className="phone-notch" />
        <div className="hourglass" aria-hidden="true">⌛</div>
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
  return (
    <section className="planner-view" aria-labelledby="plan-title">
      <div className="section-heading">
        <p className="eyebrow">Screen 2</p>
        <h1 id="plan-title">Plan Your Trip</h1>
      </div>
      <form className="planner-form" onSubmit={props.generatePlan}>
        <label className="field-label" htmlFor="location">
          Location
        </label>
        <div className="location-row">
          <input
            id="location"
            name="location"
            value={props.location}
            onChange={(event) => props.setLocation(event.target.value)}
            placeholder="Where are you?"
          />
          <button type="button" onClick={props.detectLocation} aria-label="Use current location">
            Locate
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

        <p className="load-state" role="status">{props.loadState}</p>
        <button className="primary-action wide" type="submit">
          Generate My Plan
        </button>
      </form>
    </section>
  );
}

function ItineraryScreen({ plannedStops, selectedHours, setDraggedId, handleDrop, onMap }) {
  return (
    <section className="itinerary-view" aria-labelledby="itinerary-title">
      <div className="section-heading inline">
        <div>
          <p className="eyebrow">Screen 3</p>
          <h1 id="itinerary-title">Your {selectedHours}h Plan</h1>
        </div>
        <span className="pill">{plannedStops.length} stops</span>
      </div>
      <ol className="timeline" aria-label="Draggable itinerary stops">
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
              <p>{place.duration} min - {place.walk} min walk - {place.distance}</p>
              <small>{place.description}</small>
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
      </div>
    </section>
  );
}

function MapScreen({ plannedStops, position, routeMode, setRouteMode }) {
  return (
    <section className="map-view" aria-labelledby="map-title">
      <div className="section-heading inline">
        <div>
          <p className="eyebrow">Screen 4</p>
          <h1 id="map-title">Route Map</h1>
        </div>
        <span className="pill live">Live</span>
      </div>
      <div className="segmented-control compact" role="group" aria-label="Route mode">
        {["Walk", "Transit"].map((mode) => (
          <button
            key={mode}
            className={routeMode === mode ? "selected" : ""}
            type="button"
            onClick={() => setRouteMode(mode)}
          >
            {mode}
          </button>
        ))}
      </div>
      <article className="map-card" aria-label="Simplified route visualization">
        <svg viewBox="0 0 520 240" role="img" aria-label="Route connecting the selected stops">
          <path d="M70 70 C150 80 185 130 245 126 S340 190 440 180" fill="none" stroke="#c9582d" strokeWidth="6" />
          {plannedStops.slice(0, 4).map((place, index) => {
            const points = [
              [70, 70],
              [245, 126],
              [440, 180],
              [350, 70],
            ];
            const [x, y] = points[index];
            return (
              <g key={place.id}>
                <circle cx={x} cy={y} r="16" fill="#173626" />
                <text x={x} y={y + 5} textAnchor="middle" fill="#fff" fontSize="15" fontWeight="700">
                  {index + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </article>
      <p className="route-summary">1.8 km total - {routeMode === "Walk" ? "22 min walk" : "14 min transit"}</p>
      <article className="transit-card">
        <h2>Transit Options Nearby</h2>
        <p><strong>T2</strong> Tram - Museum Stop</p>
        <p><strong>M4</strong> Metro - Park Station</p>
        {position && <small>Current position saved for this session.</small>}
      </article>
      <button className="primary-action wide" type="button">
        Navigate
      </button>
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
    Home: "⌂",
    Plan: "☼",
    Itinerary: "▣",
    Map: "◇",
  }[item];
}

createRoot(document.getElementById("root")).render(<App />);
