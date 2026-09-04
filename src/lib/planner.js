import { haversineKm, splitIntoDayGroups, computeOptimizedRoute, buildSchedule } from './geo';

const TIGHT_MARGIN_MIN = 30; // journée jugée "serrée" si elle se termine dans cette marge avant la limite
const ON_ROUTE_DETOUR_MAX_MIN = 8; // détour estimé en dessous duquel un client est jugé "sur la route"
const FALLBACK_KM_PER_MIN = 0.75; // ~45 km/h, utilisé si la journée n'a pas encore de trajet calculé
const MAX_SUGGESTIONS_PER_LIST = 5;

// Construit un plan de tournée complet.
// params: {
//   home: {lat,lng},
//   dates: ['2026-09-08', ...],
//   mustVisitClients: [client...] (avec lat/lng déjà géocodés),
//   candidateClients: [client...] (pool du secteur pour les suggestions, hors mustVisit),
//   dayStart: 'HH:MM', visitDurationMin, lunchBreakMin, suggestionRadiusKm,
//   dayEndTimes: ['HH:MM', ...] — heure de fin souhaitée pour le jour i (défaut si absent : '18:00'),
//     modifiable jour par jour pour un impératif ponctuel.
//   overnightHotels: [{lat,lng,address} | null, ...] — hôtel utilisé pour la nuit après le jour i
//     (donc point de départ du jour i+1). Optionnel, absent = on repart toujours de `home`.
//   durationOverrides: { [clientId]: minutes } — durée de visite spécifique pour certains clients,
//     remplace `visitDurationMin` pour ceux-là uniquement.
// }
export async function buildTourPlan(params) {
  const {
    home,
    dates,
    mustVisitClients,
    candidateClients,
    dayStart,
    visitDurationMin,
    lunchBreakMin,
    suggestionRadiusKm,
    dayEndTimes = [],
    overnightHotels = [],
    durationOverrides = null,
  } = params;

  const numDays = dates.length;
  const groups = splitIntoDayGroups(mustVisitClients, numDays);

  const days = [];
  for (let i = 0; i < numDays; i++) {
    const dayClients = groups[i] || [];
    const origin = i === 0 ? home : overnightHotels[i - 1] || home;
    const destination = i === numDays - 1 ? home : overnightHotels[i] || home;

    let route = null;
    let schedule = null;
    if (dayClients.length) {
      const departureDate = new Date(`${dates[i]}T${dayStart}:00`);
      route = await computeOptimizedRoute(origin, destination, dayClients, departureDate);
      if (route) {
        schedule = buildSchedule(route.orderedStops, route.legs, dayStart, visitDurationMin, lunchBreakMin, durationOverrides);
      }
    }

    const suggestions = dayClients.length
      ? estimateSuggestions(candidateClients, origin, route ? route.orderedStops : dayClients, destination, route, suggestionRadiusKm)
      : { onRoute: [], nearby: [] };

    const dayEnd = dayEndTimes[i] || '18:00';
    const dayEndMin = toMinutes(dayEnd);

    let status = 'ok';
    let overloadMin = 0;
    if (schedule) {
      overloadMin = schedule.endOfDayMin - dayEndMin;
      if (overloadMin > 0) status = 'infeasible';
      else if (overloadMin > -TIGHT_MARGIN_MIN) status = 'tight';
    }

    days.push({
      date: dates[i],
      origin,
      destination,
      stops: route ? route.orderedStops : dayClients,
      legs: route ? route.legs : [],
      totalDistanceM: route ? route.totalDistanceM : 0,
      totalDurationS: route ? route.totalDurationS : 0,
      schedule,
      suggestions,
      dayEnd,
      status,
      overloadMin,
      // rétro-compatibilité : anciens consommateurs qui lisent `overloaded`
      overloaded: status === 'infeasible',
    });
  }

  dedupeSuggestionsAcrossDays(days);

  return { home, dates, days };
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Estime, pour chaque client candidat à proximité, le détour (en minutes) que représenterait son
// insertion dans la tournée du jour à l'endroit le plus avantageux (entre deux arrêts consécutifs,
// avant le premier ou après le dernier). Le détour est calibré sur la vitesse moyenne réelle de la
// journée (distance/durée du trajet calculé), avec un repli si le trajet n'a pas encore été calculé.
// Résultat : deux listes triées par détour croissant — "sur la route" (détour quasi nul) et
// "à proximité" (détour non négligeable, affiché pour que le choix soit éclairé).
function estimateSuggestions(candidateClients, origin, dayStops, destination, route, radiusKm) {
  const sequence = [origin, ...dayStops, destination].filter(Boolean);
  const kmPerMin =
    route && route.totalDurationS > 0 ? route.totalDistanceM / 1000 / (route.totalDurationS / 60) : FALLBACK_KM_PER_MIN;

  const scored = [];
  for (const c of candidateClients) {
    let bestExtraKm = Infinity;
    let nearestKm = Infinity;
    for (let i = 0; i < sequence.length - 1; i++) {
      const a = sequence[i];
      const b = sequence[i + 1];
      const extra = haversineKm(a, c) + haversineKm(c, b) - haversineKm(a, b);
      if (extra < bestExtraKm) bestExtraKm = extra;
      nearestKm = Math.min(nearestKm, haversineKm(c, a), haversineKm(c, b));
    }
    if (nearestKm > radiusKm) continue;
    scored.push({ client: c, distanceKm: nearestKm, detourMin: Math.max(0, bestExtraKm) / kmPerMin });
  }
  scored.sort((a, b) => a.detourMin - b.detourMin);

  return {
    onRoute: scored.filter((s) => s.detourMin <= ON_ROUTE_DETOUR_MAX_MIN),
    nearby: scored.filter((s) => s.detourMin > ON_ROUTE_DETOUR_MAX_MIN),
  };
}

function dedupeSuggestionsAcrossDays(days) {
  const bestDayForClient = new Map();
  days.forEach((day, dayIdx) => {
    [...day.suggestions.onRoute, ...day.suggestions.nearby].forEach((s) => {
      const id = s.client.id;
      const current = bestDayForClient.get(id);
      if (!current || s.detourMin < current.detourMin) {
        bestDayForClient.set(id, { dayIdx, detourMin: s.detourMin });
      }
    });
  });
  days.forEach((day, dayIdx) => {
    const keep = (s) => bestDayForClient.get(s.client.id).dayIdx === dayIdx;
    day.suggestions = {
      onRoute: day.suggestions.onRoute.filter(keep).slice(0, MAX_SUGGESTIONS_PER_LIST),
      nearby: day.suggestions.nearby.filter(keep).slice(0, MAX_SUGGESTIONS_PER_LIST),
    };
  });
}
