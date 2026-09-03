import { haversineKm, splitIntoDayGroups, computeOptimizedRoute, buildSchedule } from './geo';

// Construit un plan de tournée complet.
// params: {
//   home: {lat,lng},
//   dates: ['2026-09-08', ...],
//   mustVisitClients: [client...] (avec lat/lng déjà géocodés),
//   candidateClients: [client...] (pool du secteur pour les suggestions, hors mustVisit),
//   dayStart: 'HH:MM', visitDurationMin: number, suggestionRadiusKm: number, maxDayHours: number,
// }
export async function buildTourPlan(params) {
  const { home, dates, mustVisitClients, candidateClients, dayStart, visitDurationMin, suggestionRadiusKm, maxDayHours } = params;

  const numDays = dates.length;
  const groups = splitIntoDayGroups(mustVisitClients, numDays);

  const days = [];
  for (let i = 0; i < numDays; i++) {
    const dayClients = groups[i] || [];
    let route = null;
    let schedule = null;
    if (dayClients.length) {
      route = await computeOptimizedRoute(home, dayClients);
      if (route) {
        schedule = buildSchedule(route.orderedStops, route.legs, dayStart, visitDurationMin);
      }
    }

    const suggestions = dayClients.length
      ? rankSuggestions(candidateClients, route ? route.orderedStops : dayClients, suggestionRadiusKm)
      : [];

    const overloaded = schedule ? schedule.endOfDayMin - toMinutes(dayStart) > maxDayHours * 60 : false;

    days.push({
      date: dates[i],
      stops: route ? route.orderedStops : dayClients,
      legs: route ? route.legs : [],
      totalDistanceM: route ? route.totalDistanceM : 0,
      totalDurationS: route ? route.totalDurationS : 0,
      schedule,
      suggestions,
      overloaded,
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
