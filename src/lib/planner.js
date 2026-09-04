import { haversineKm, splitIntoDayGroups, computeOptimizedRoute, buildSchedule } from './geo';

const TIGHT_MARGIN_MIN = 30; // journée jugée "serrée" si elle se termine dans cette marge avant la limite

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
        schedule = buildSchedule(route.orderedStops, route.legs, dayStart, visitDurationMin, lunchBreakMin);
      }
    }

    const suggestions = dayClients.length
      ? rankSuggestions(candidateClients, route ? route.orderedStops : dayClients, suggestionRadiusKm)
      : [];

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

function rankSuggestions(candidateClients, dayStops, radiusKm) {
  const ranked = [];
  for (const c of candidateClients) {
    let minDist = Infinity;
    for (const stop of dayStops) {
      const d = haversineKm(c, stop);
      if (d < minDist) minDist = d;
    }
    if (minDist <= radiusKm) ranked.push({ client: c, distanceKm: minDist });
  }
  ranked.sort((a, b) => a.distanceKm - b.distanceKm);
  return ranked.slice(0, 8);
}

function dedupeSuggestionsAcrossDays(days) {
  const bestDayForClient = new Map();
  days.forEach((day, dayIdx) => {
    day.suggestions.forEach((s) => {
      const id = s.client.id;
      const current = bestDayForClient.get(id);
      if (!current || s.distanceKm < current.distanceKm) {
        bestDayForClient.set(id, { dayIdx, distanceKm: s.distanceKm });
      }
    });
  });
  days.forEach((day, dayIdx) => {
    day.suggestions = day.suggestions.filter((s) => bestDayForClient.get(s.client.id).dayIdx === dayIdx).slice(0, 5);
  });
}
