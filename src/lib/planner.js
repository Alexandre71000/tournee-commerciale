import { haversineKm, splitIntoDayGroups, computeOptimizedRoute, buildSchedule, maybeInsertTrailingLunch } from './geo';

const TIGHT_MARGIN_MIN = 30; // journée jugée "serrée" si elle se termine dans cette marge avant la limite
const ON_ROUTE_DETOUR_MAX_MIN = 8; // détour estimé en dessous duquel un client est jugé "sur la route"
const FALLBACK_KM_PER_MIN = 0.75; // ~45 km/h, utilisé si la journée n'a pas encore de trajet calculé
const MAX_SUGGESTIONS_PER_LIST = 5;
const DEFAULT_MISSION_DURATION_MIN = 30;

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
//   fixedTimesByDay: { [dayIndex]: { [clientId]: 'HH:MM' } } — heure imposée pour un client donné ce
//     jour-là (ex. le client n'était dispo qu'à cette heure). Le client est retiré du pool libre et
//     réparti automatiquement par jour, et fixé à cette heure exacte : les autres visites de la
//     journée se réorganisent autour.
//   missionsByDay: { [dayIndex]: [{id, label, address, lat, lng, time: 'HH:MM', durationMin}] } —
//     blocs bloquants sans client associé (ex. aller chercher quelqu'un à l'aéroport). `lat`/`lng`
//     optionnels : sans adresse, le bloc réserve juste le créneau sans impacter le trajet.
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
    fixedTimesByDay = {},
    missionsByDay = {},
  } = params;

  const numDays = dates.length;

  // Les clients à horaire fixé sur un jour donné sont retirés du pool distribué par k-means (sinon
  // une régénération ultérieure pourrait les faire dériver sur un autre jour) et assignés directement
  // à leur journée ; seuls les clients restants sont répartis géographiquement comme avant.
  const pinnedIds = new Set();
  for (let i = 0; i < numDays; i++) Object.keys(fixedTimesByDay[i] || {}).forEach((id) => pinnedIds.add(id));
  const freeClients = mustVisitClients.filter((c) => !pinnedIds.has(c.id));
  const freeGroups = splitIntoDayGroups(freeClients, numDays);

  const days = [];
  for (let i = 0; i < numDays; i++) {
    const pinnedForDay = mustVisitClients.filter((c) => fixedTimesByDay[i]?.[c.id]);
    const dayClients = [...pinnedForDay, ...(freeGroups[i] || [])];
    const origin = i === 0 ? home : overnightHotels[i - 1] || home;
    const destination = i === numDays - 1 ? home : overnightHotels[i] || home;

    let daySchedule = null;
    if (dayClients.length || missionsByDay[i]?.length) {
      const departureDate = new Date(`${dates[i]}T${dayStart}:00`);
      daySchedule = await buildDaySchedule({
        origin,
        destination,
        dayClients,
        fixedTimesForDay: fixedTimesByDay[i] || {},
        missions: missionsByDay[i] || [],
        dayStart,
        visitDurationMin,
        lunchBreakMin,
        durationOverrides,
        departureDate,
      });
    }

    const suggestions = daySchedule
      ? estimateSuggestions(candidateClients, origin, daySchedule.stops.map((s) => s.client), destination, daySchedule, suggestionRadiusKm)
      : { onRoute: [], nearby: [] };

    const dayEnd = dayEndTimes[i] || '18:00';
    const dayEndMin = toMinutes(dayEnd);

    let status = 'ok';
    let overloadMin = 0;
    let fixedConflict = null;
    if (daySchedule) {
      if (daySchedule.fixedConflict) {
        status = 'infeasible';
        fixedConflict = daySchedule.fixedConflict;
        overloadMin = fixedConflict.lateByMin;
      } else {
        overloadMin = daySchedule.endOfDayMin - dayEndMin;
        if (overloadMin > 0) status = 'infeasible';
        else if (overloadMin > -TIGHT_MARGIN_MIN) status = 'tight';
      }
    }

    days.push({
      date: dates[i],
      origin,
      destination,
      // `stops` (contrairement à `schedule.stops`, qui garde les événements complets avec horaires)
      // reste une liste de fiches client brutes : c'est ce que consomment la carte et l'enregistrement.
      stops: daySchedule ? daySchedule.stops.map((s) => s.client) : dayClients,
      legs: daySchedule ? daySchedule.legs : [],
      totalDistanceM: daySchedule ? daySchedule.totalDistanceM : 0,
      totalDurationS: daySchedule ? daySchedule.totalDurationS : 0,
      schedule: daySchedule,
      suggestions,
      dayEnd,
      status,
      overloadMin,
      fixedConflict,
      // rétro-compatibilité : anciens consommateurs qui lisent `overloaded`
      overloaded: status === 'infeasible',
    });
  }

  dedupeSuggestionsAcrossDays(days);

  return { home, dates, days };
}

// Répartit les clients libres (sans horaire imposé) entre les tronçons (« gaps ») délimités par les
// points fixes de la journée, selon le détour minimal que représenterait leur insertion à chaque
// endroit — même logique que les suggestions "sur la route".
function assignClientsToGaps(clients, boundaryPoints) {
  const gapCount = boundaryPoints.length - 1;
  const buckets = Array.from({ length: gapCount }, () => []);
  for (const c of clients) {
    let bestGap = 0;
    let bestExtra = Infinity;
    for (let g = 0; g < gapCount; g++) {
      const extra = haversineKm(boundaryPoints[g], c) + haversineKm(c, boundaryPoints[g + 1]) - haversineKm(boundaryPoints[g], boundaryPoints[g + 1]);
      if (extra < bestExtra) {
        bestExtra = extra;
        bestGap = g;
      }
    }
    buckets[bestGap].push(c);
  }
  return buckets;
}

// Insère une mission sans adresse (ne pouvant pas découper le trajet géographiquement) dans une
// chronologie déjà construite, à son heure : si un événement est déjà en cours à ce moment-là, la
// mission démarre juste après, et tout ce qui suit est repoussé d'autant. Mute `events` en place et
// renvoie la nouvelle heure de fin de journée.
function insertTimeOnlyMission(events, dayStartMin, mission, endOfDayMin) {
  const startOf = (ev) => (ev.type === 'lunch' ? ev.startMin : ev.arrivalMin);
  const endOf = (ev) => (ev.type === 'lunch' ? ev.endMin : ev.departureMin);
  const missionTimeMin = toMinutes(mission.time);
  const duration = mission.durationMin || DEFAULT_MISSION_DURATION_MIN;

  let insertIdx = events.length;
  for (let i = 0; i < events.length; i++) {
    if (startOf(events[i]) >= missionTimeMin) {
      insertIdx = i;
      break;
    }
  }
  const prevEnd = insertIdx > 0 ? endOf(events[insertIdx - 1]) : dayStartMin;
  const missionStart = Math.max(missionTimeMin, prevEnd);
  const missionEnd = missionStart + duration;
  const nextStart = insertIdx < events.length ? startOf(events[insertIdx]) : missionEnd;
  const shift = Math.max(0, missionEnd - nextStart);

  for (let i = insertIdx; i < events.length; i++) {
    const ev = events[i];
    if (ev.type === 'lunch') {
      ev.startMin += shift;
      ev.endMin += shift;
    } else {
      ev.arrivalMin += shift;
      ev.departureMin += shift;
      if (ev.recommendedDepartureMin != null) ev.recommendedDepartureMin += shift;
    }
  }
  events.splice(insertIdx, 0, { type: 'mission', mission, lateByMin: 0, arrivalMin: missionStart, departureMin: missionEnd });

  return endOfDayMin + shift;
}

// Construit le planning d'une journée qui peut contenir des points fixes (RDV client à une heure
// imposée, ou mission bloquante). Les points fixes, triés par heure, découpent la journée en
// tronçons ; les clients libres sont répartis dans le tronçon le plus avantageux géographiquement,
// chaque tronçon est routé et planifié indépendamment, puis tout est mis bout à bout en une seule
// chronologie. Sans point fixe, un seul tronçon couvre toute la journée (comportement identique à
// avant l'ajout des RDV fixes/missions).
async function buildDaySchedule({ origin, destination, dayClients, fixedTimesForDay, missions, dayStart, visitDurationMin, lunchBreakMin, durationOverrides, departureDate }) {
  const fixedClients = dayClients.filter((c) => fixedTimesForDay[c.id]);
  const flexibleClients = dayClients.filter((c) => !fixedTimesForDay[c.id]);
  // Une mission sans adresse ne géolocalise rien : elle ne peut pas découper géographiquement la
  // journée en tronçons (contrairement à un RDV client, toujours localisé, ou une mission avec
  // adresse). Elle est traitée à part, insérée après coup dans la chronologie par heure (cf. plus bas).
  const locatedMissions = missions.filter((m) => m.lat != null);
  const timeOnlyMissions = missions.filter((m) => m.lat == null);

  const anchors = [
    ...fixedClients.map((c) => ({ kind: 'client', client: c, timeMin: toMinutes(fixedTimesForDay[c.id]), lat: c.lat, lng: c.lng })),
    ...locatedMissions.map((m) => ({ kind: 'mission', mission: m, timeMin: toMinutes(m.time), lat: m.lat, lng: m.lng })),
  ].sort((a, b) => a.timeMin - b.timeMin);

  const points = [origin, ...anchors, destination];
  const boundaryPoints = points.map((p) => ({ lat: p.lat, lng: p.lng }));
  const buckets = assignClientsToGaps(flexibleClients, boundaryPoints);

  const stops = [];
  const events = [];
  const legs = [];
  let totalDistanceM = 0;
  let totalDurationS = 0;
  let clock = toMinutes(dayStart);
  const dayStartMin = clock;
  const lunchState = {};
  let firstDepartureEarlierMin = 0;
  let fixedConflict = null;

  for (let i = 0; i < points.length - 1; i++) {
    const gapClients = buckets[i] || [];
    const route = await computeOptimizedRoute(boundaryPoints[i], boundaryPoints[i + 1], gapClients, departureDate);
    if (!route) return null;

    const sched = buildSchedule(route.orderedStops, route.legs, clock, visitDurationMin, lunchBreakMin, durationOverrides, lunchState, i === 0);

    stops.push(...sched.stops);
    events.push(...sched.events);
    legs.push(...route.legs);
    totalDistanceM += route.totalDistanceM;
    totalDurationS += route.totalDurationS;
    if (i === 0) firstDepartureEarlierMin = sched.firstDepartureEarlierMin;

    clock = sched.endOfDayMin;

    // Filet de sécurité : si ce tronçon n'avait plus d'arrêt libre pour déclencher la pause déjeuner
    // avant le dernier trajet (vers un point fixe ou vers le domicile), on la case ici après coup.
    const preTravelClock = sched.stops.length ? sched.stops[sched.stops.length - 1].departureMin : sched.dayStartMin;
    const trailingLunch = maybeInsertTrailingLunch(preTravelClock, clock, lunchState, lunchBreakMin);
    if (trailingLunch.event) {
      events.push(trailingLunch.event);
      clock = trailingLunch.clock;
    }

    const anchor = points[i + 1];
    if (anchor.kind) {
      const lateByMin = clock > anchor.timeMin ? clock - anchor.timeMin : 0;
      if (lateByMin > 0 && !fixedConflict) {
        fixedConflict = {
          label: anchor.kind === 'client' ? anchor.client.name : anchor.mission.label,
          timeMin: anchor.timeMin,
          arrivalMin: clock,
          lateByMin,
        };
      }
      const anchorStart = Math.max(clock, anchor.timeMin);
      const anchorDuration = anchor.kind === 'client' ? durationOverrides?.[anchor.client.id] ?? visitDurationMin : anchor.mission.durationMin || DEFAULT_MISSION_DURATION_MIN;
      const anchorEnd = anchorStart + anchorDuration;
      const anchorEvent =
        anchor.kind === 'client'
          ? {
              type: 'stop',
              client: anchor.client,
              fixed: true,
              lateByMin,
              travelMinFromPrevious: null,
              recommendedDepartureMin: null,
              arrivalMin: anchorStart,
              departureMin: anchorEnd,
              durationMin: anchorDuration,
              path: null,
            }
          : { type: 'mission', mission: anchor.mission, lateByMin, arrivalMin: anchorStart, departureMin: anchorEnd };
      events.push(anchorEvent);
      if (anchor.kind === 'client') stops.push(anchorEvent);
      clock = anchorEnd;
    }
  }

  // Les missions sans adresse ne découpent pas le trajet (aucun impact géographique) : elles sont
  // insérées après coup dans la chronologie déjà construite, à leur heure — en repoussant tout ce qui
  // suit si besoin, exactement comme une pause déjeuner imprévue s'invite dans le planning.
  for (const mission of timeOnlyMissions.sort((a, b) => toMinutes(a.time) - toMinutes(b.time))) {
    clock = insertTimeOnlyMission(events, dayStartMin, mission, clock);
  }

  return {
    stops,
    events,
    legs,
    totalDistanceM,
    totalDurationS,
    endOfDayMin: clock,
    dayStartMin,
    firstDepartureEarlierMin,
    fixedConflict,
  };
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
