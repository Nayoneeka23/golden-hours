const PACE_BUDGET_FACTOR = { Relaxed: 0.88, Moderate: 1, Fast: 1.02 };
const PACE_VISIT_FACTOR = { Relaxed: 1.12, Moderate: 1, Fast: 0.88 };
const PACE_LEG_BUFFER = { Relaxed: 3, Moderate: 1, Fast: 0 };

export function getTimeBudgetMinutes(hours, pace = "Moderate") {
  const clampedHours = Math.min(4, Math.max(1, Number(hours) || 2));
  const factor = PACE_BUDGET_FACTOR[pace] ?? 1;
  return Math.floor(clampedHours * 60 * factor);
}

export function getVisitMinutes(stop, pace = "Moderate") {
  const base = Number(stop?.duration) || 30;
  const factor = PACE_VISIT_FACTOR[pace] ?? 1;
  return Math.max(10, Math.round(base * factor));
}

export function getTravelMinutes(stop, routeMode = "Walk") {
  const walk = Number(stop?.walk) || 0;
  if (routeMode === "Transit") {
    return Math.max(3, Math.round(walk * 0.58));
  }
  return Math.max(0, walk);
}

export function calculateItineraryMinutes(stops, routeMode = "Walk", pace = "Moderate") {
  if (!Array.isArray(stops) || stops.length === 0) return 0;

  let total = 0;
  stops.forEach((stop, index) => {
    if (index > 0) {
      total += PACE_LEG_BUFFER[pace] ?? 1;
    }
    total += index === 0 ? getTravelMinutes(stop, routeMode) : getTravelMinutes(stop, routeMode);
    total += getVisitMinutes(stop, pace);
  });

  return total;
}

export function selectStopsWithinBudget(places, { hours = 2, interests = [], pace = "Moderate", routeMode = "Walk" } = {}) {
  const budget = getTimeBudgetMinutes(hours, pace);
  const interestSet = new Set(interests);

  const preferred = places
    .filter((place) => interestSet.has(place.category))
    .sort((a, b) => b.rating - a.rating);
  const remaining = places
    .filter((place) => !interestSet.has(place.category))
    .sort((a, b) => b.rating - a.rating);

  const ordered = [...preferred, ...remaining];
  const selected = [];
  let used = 0;

  for (const place of ordered) {
    const legBuffer = selected.length > 0 ? (PACE_LEG_BUFFER[pace] ?? 1) : 0;
    const travel = getTravelMinutes(place, routeMode);
    const visit = getVisitMinutes(place, pace);
    const needed = travel + visit + legBuffer;

    if (used + needed <= budget) {
      selected.push(place);
      used += needed;
    }
  }

  return selected;
}

export function trimStopsToBudget(stops, hours, pace = "Moderate", routeMode = "Walk") {
  const budget = getTimeBudgetMinutes(hours, pace);
  const trimmed = [];

  for (const stop of stops) {
    const candidate = [...trimmed, stop];
    if (calculateItineraryMinutes(candidate, routeMode, pace) <= budget) {
      trimmed.push(stop);
    }
  }

  return trimmed;
}

export function itineraryFitsBudget(stops, hours, pace = "Moderate", routeMode = "Walk") {
  return calculateItineraryMinutes(stops, routeMode, pace) <= getTimeBudgetMinutes(hours, pace);
}

export function formatMinutesLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
