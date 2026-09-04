import { importLibrary } from './googleMapsLoader';

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function centroid(points) {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

let geocoderPromise;
function getGeocoder() {
  if (!geocoderPromise) {
    geocoderPromise = importLibrary('geocoding').then(({ Geocoder }) => new Geocoder());
  }
  return geocoderPromise;
}

// Géocode une adresse texte -> {lat, lng, formattedAddress} ou null si introuvable.
export async function geocodeAddress(addressText) {
  if (!addressText || !addressText.trim()) return null;
  const geocoder = await getGeocoder();
  try {
    const res = await geocoder.geocode({ address: addressText, region: 'fr' });
    const first = res.results && res.results[0];
    if (!first) return null;
    const loc = first.geometry.location;
    return {
      lat: loc.lat(),
      lng: loc.lng(),
      formattedAddress: first.formatted_address,
    };
  } catch (e) {
    console.warn('Géocodage échoué pour', addressText, e);
    return null;
  }
}

// Géocode une liste d'adresses avec un léger espacement pour éviter le rate-limiting,
// en remontant la progression via onProgress(done, total).
export async function geocodeBatch(items, getAddress, onProgress) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    const addr = getAddress(items[i]);
    const geo = await geocodeAddress(addr);
    results.push(geo);
    if (onProgress) onProgress(i + 1, items.length);
    await new Promise((r) => setTimeout(r, 120));
  }
  return results;
}

// Répartit des points en `numDays` groupes géographiquement cohérents (k-means équilibré,
// implémentation légère, sans dépendance externe).
export function splitIntoDayGroups(points, numDays) {
  if (numDays <= 1 || points.length <= 1) return [points.slice()];
  const k = Math.min(numDays, points.length);

  const centers = [{ lat: points[0].lat, lng: points[0].lng }];
  while (centers.length < k) {
    let best = null;
    let bestDist = -1;
    for (const p of points) {
      const d = Math.min(...centers.map((c) => haversineKm(p, c)));
      if (d > bestDist) {
        bestDist = d;
        best = p;
      }
    }
    centers.push({ lat: best.lat, lng: best.lng });
  }

  let assignment = new Array(points.length).fill(0);
  for (let iter = 0; iter < 15; iter++) {
    for (let i = 0; i < points.length; i++) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = haversineKm(points[i], centers[c]);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      assignment[i] = best;
    }
    const sums = Array.from({ length: k }, () => ({ lat: 0, lng: 0, n: 0 }));
    for (let i = 0; i < points.length; i++) {
      const a = assignment[i];
      sums[a].lat += points[i].lat;
      sums[a].lng += points[i].lng;
      sums[a].n++;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c].n > 0) centers[c] = { lat: sums[c].lat / sums[c].n, lng: sums[c].lng / sums[c].n };
    }
  }

  const groups = Array.from({ length: k }, () => []);
  for (let i = 0; i < points.length; i++) groups[assignment[i]].push(points[i]);

  const target = Math.ceil(points.length / k);
  for (let c = 0; c < k; c++) {
    while (groups[c].length > target) {
      let moveIdx = -1;
      let moveTo = -1;
      let bestDist = Infinity;
      for (let i = 0; i < groups[c].length; i++) {
        for (let c2 = 0; c2 < k; c2++) {
          if (c2 === c || groups[c2].length >= target) continue;
          const d = haversineKm(groups[c][i], centers[c2]);
          if (d < bestDist) {
            bestDist = d;
            moveIdx = i;
            moveTo = c2;
          }
        }
      }
      if (moveIdx === -1) break;
      const [pt] = groups[c].splice(moveIdx, 1);
      groups[moveTo].push(pt);
    }
  }

  while (groups.length < numDays) groups.push([]);
  return groups;
}

let directionsServicePromise;
function getDirectionsService() {
  if (!directionsServicePromise) {
    directionsServicePromise = importLibrary('routes').then(({ DirectionsService }) => new DirectionsService());
  }
  return directionsServicePromise;
}

let geometryLibraryPromise;
function getGeometryLibrary() {
  if (!geometryLibraryPromise) geometryLibraryPromise = importLibrary('geometry');
  return geometryLibraryPromise;
}

function decodeLegPath(leg, encoding) {
  const points = [];
  for (const step of leg.steps || []) {
    if (!step.polyline || !step.polyline.points) continue;
    const decoded = encoding.decodePath(step.polyline.points);
    for (const p of decoded) points.push({ lat: p.lat(), lng: p.lng() });
  }
  return points;
}

// Calcule l'itinéraire optimisé d'une journée entre `origin` et `destination` (peuvent différer
// si la tournée part/arrive d'un hôtel), en tenant compte du trafic prévisionnel à `departureDate`.
export async function computeOptimizedRoute(origin, destination, dayClients, departureDate) {
  if (!dayClients.length) return null;
  const service = await getDirectionsService();
  const { TravelMode } = await importLibrary('routes');
  const { encoding } = await getGeometryLibrary();

  const request = {
    origin: { lat: origin.lat, lng: origin.lng },
    destination: { lat: destination.lat, lng: destination.lng },
    waypoints: dayClients.map((c) => ({ location: { lat: c.lat, lng: c.lng }, stopover: true })),
    optimizeWaypoints: true,
    travelMode: TravelMode.DRIVING,
    drivingOptions: {
      departureTime: departureDate instanceof Date ? departureDate : new Date(),
      trafficModel: 'bestguess',
    },
  };

  return new Promise((resolve) => {
    service.route(request, (result, status) => {
      if (status !== 'OK' || !result.routes[0]) {
        console.warn('Directions API a échoué:', status);
        resolve(null);
        return;
      }
      const route = result.routes[0];
      const order = route.waypoint_order;
      const orderedStops = order.map((idx) => dayClients[idx]);
      const legs = route.legs.map((l) => ({
        distanceM: l.distance ? l.distance.value : 0,
        durationS: (l.duration_in_traffic || l.duration)?.value || 0,
        path: decodeLegPath(l, encoding),
      }));
      const totalDistanceM = legs.reduce((s, l) => s + l.distanceM, 0);
      const totalDurationS = legs.reduce((s, l) => s + l.durationS, 0);
      resolve({ orderedStops, legs, totalDistanceM, totalDurationS });
    });
  });
}

// ---------------------------------------------------------------------------
// Planning horaire : créneaux ronds (heure pile / demie), marge de sécurité au
// départ, pause déjeuner glissée automatiquement entre midi et 13h.
// ---------------------------------------------------------------------------
export const SLOT_MINUTES = 30;
const LUNCH_WINDOW_START_MIN = 12 * 60;
const LUNCH_WINDOW_END_MIN = 13 * 60;

function roundUpToSlot(min, slot) {
  return Math.ceil(min / slot) * slot;
}
function roundDownToSlot(min, slot) {
  return Math.floor(min / slot) * slot;
}
function roundNearestSlot(min, slot) {
  return Math.round(min / slot) * slot;
}

// Construit le planning horaire d'une journée à partir de l'itinéraire optimisé :
// chaque visite démarre sur un créneau rond (30 min), le départ recommandé (créneau
// précédent) laisse une marge de sécurité, et une pause déjeuner de `lunchBreakMin`
// est insérée à un horaire aléatoire entre 12h et 13h si la journée s'étend jusque-là.
// Retourne une liste d'événements chronologiques (visites + pause déjeuner éventuelle).
export function buildSchedule(orderedStops, legs, dayStartHHMM, visitDurationMin, lunchBreakMin = 60) {
  const [h, m] = dayStartHHMM.split(':').map(Number);
  const dayStartMin = h * 60 + m;
  let clock = dayStartMin;

  const lunchTarget = LUNCH_WINDOW_START_MIN + Math.random() * (LUNCH_WINDOW_END_MIN - LUNCH_WINDOW_START_MIN);
  let lunchTaken = !(lunchBreakMin > 0);

  const events = [];
  const stops = [];
  for (let i = 0; i < orderedStops.length; i++) {
    const travelMin = Math.round((legs[i]?.durationS || 0) / 60);
    let rawArrival = clock + travelMin;

    if (!lunchTaken && rawArrival >= lunchTarget) {
      const lunchStart = roundUpToSlot(Math.max(clock, lunchTarget), 15);
      const lunchEnd = lunchStart + lunchBreakMin;
      events.push({ type: 'lunch', startMin: lunchStart, endMin: lunchEnd });
      clock = lunchEnd;
      lunchTaken = true;
      rawArrival = clock + travelMin;
    }

    // Le tout premier arrêt du jour (départ du domicile ou de l'hôtel) n'est pas contraint par une
    // visite précédente : on peut viser le créneau le plus proche (avant ou après) en recommandant
    // de partir un peu plus tôt, plutôt que d'attendre systématiquement le créneau suivant.
    // Les arrêts suivants sont contraints par l'heure réelle de fin de la visite précédente : on ne
    // peut qu'arrondir au créneau suivant (impossible d'arriver avant d'être physiquement parti).
    const visitStart = i === 0 ? roundNearestSlot(rawArrival, SLOT_MINUTES) : roundUpToSlot(rawArrival, SLOT_MINUTES);
    const recommendedDepartureMin = roundDownToSlot(visitStart - travelMin, SLOT_MINUTES);
    const visitEnd = visitStart + visitDurationMin;

    const stopEvent = {
      type: 'stop',
      client: orderedStops[i],
      travelMinFromPrevious: travelMin,
      recommendedDepartureMin,
      arrivalMin: visitStart,
      departureMin: visitEnd,
      path: legs[i]?.path || null,
    };
    events.push(stopEvent);
    stops.push(stopEvent);

    clock = visitEnd;
  }

  const returnTravelMin = Math.round((legs[orderedStops.length]?.durationS || 0) / 60);
  const returnPath = legs[orderedStops.length]?.path || null;
  const endOfDayMin = clock + returnTravelMin;

  const firstDepartureEarlierMin = stops.length ? Math.max(0, dayStartMin - stops[0].recommendedDepartureMin) : 0;

  return { events, stops, returnTravelMin, returnPath, endOfDayMin, dayStartMin, firstDepartureEarlierMin };
}

export function minutesToHHMM(totalMin) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = Math.round(totalMin % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
