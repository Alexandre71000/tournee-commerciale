import { useEffect, useRef, useState } from 'react';
import { importLibrary } from '../../lib/googleMapsLoader';
import { haversineKm, centroid } from '../../lib/geo';
import { dayColor } from '../../lib/dayColors';
import { Loader2, TriangleAlert } from 'lucide-react';

const FRANCE_CENTER = { lat: 46.7, lng: 2.4, altitude: 0 };

// Carte 3D photoréaliste (Google Maps Photorealistic 3D Tiles — Map3DElement).
// API récente ("Preview") de Google : https://developers.google.com/maps/documentation/javascript/3d-maps-overview
export default function Map3D({ home, days = [], activeDayFilter = 'all' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const classesRef = useRef({});
  const overlaysRef = useRef([]);
  const idleAnimRef = useRef(false);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setErrorMsg('La carte 3D met trop de temps à répondre — la clé Google Maps est probablement invalide ou mal configurée.');
      setStatus('error');
    }, 9000);
    (async () => {
      try {
        const [maps3d, marker] = await Promise.all([importLibrary('maps3d'), importLibrary('marker')]);
        if (cancelled) return;
        clearTimeout(timeout);
        classesRef.current = { ...maps3d, ...marker };
        const map = new maps3d.Map3DElement({
          center: FRANCE_CENTER,
          range: 1200000,
          tilt: 55,
          mode: 'HYBRID',
        });
        map.defaultUIHidden = true;
        mapRef.current = map;
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(map);
        }
        setStatus('ready');
      } catch (e) {
        clearTimeout(timeout);
        if (!cancelled) {
          setErrorMsg(e.message || 'La carte 3D est indisponible.');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      overlaysRef.current.forEach((el) => el.remove?.());
      overlaysRef.current = [];
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return;
    const { Marker3DElement, Polyline3DElement, PinElement } = classesRef.current;
    const map = mapRef.current;

    overlaysRef.current.forEach((el) => el.remove?.());
    overlaysRef.current = [];

    const focusPoints = [];
    const hotelKey = (p) => (p ? `${p.lat.toFixed(4)},${p.lng.toFixed(4)}` : null);
    const homeKey = home ? hotelKey(home) : null;
    const renderedHotels = new Set();

    if (home && home.lat != null) {
      try {
        const homeMarker = new Marker3DElement({
          position: { lat: home.lat, lng: home.lng, altitude: 40 },
          altitudeMode: 'RELATIVE_TO_GROUND',
          extruded: true,
        });
        const homePin = new PinElement({ background: '#0B1220', borderColor: '#38BDF8', glyphColor: '#38BDF8', scale: 1.05 });
        homeMarker.append(homePin);
        map.append(homeMarker);
        overlaysRef.current.push(homeMarker);
        focusPoints.push(home);
      } catch {
        /* API preview — on ignore si une propriété n'est pas supportée */
      }
    }

    days.forEach((day, i) => {
      const visible = activeDayFilter === 'all' || activeDayFilter === String(i);
      if (!visible || !day.stops?.length) return;
      const color = dayColor(i);
      const origin = day.origin || home;
      const destination = day.destination || home;

      try {
        const path = buildDayPath(day, origin, destination);
        if (path.length >= 2) {
          const polyline = new Polyline3DElement({
            path,
            strokeColor: color,
            strokeWidth: 7,
            altitudeMode: 'RELATIVE_TO_GROUND',
            geodesic: true,
          });
          map.append(polyline);
          overlaysRef.current.push(polyline);
        }
      } catch {
        /* ignore si non supporté */
      }

      // Étiquettes de durée à mi-chemin de chaque trajet.
      try {
        legMidpoints(day).forEach(({ position, minutes }) => {
          const labelMarker = new Marker3DElement({
            position: { lat: position.lat, lng: position.lng, altitude: 12 },
            altitudeMode: 'RELATIVE_TO_GROUND',
          });
          labelMarker.label = `${minutes} min`;
          const smallPin = new PinElement({ background: color, scale: 0.45, glyphColor: color, borderColor: '#ffffff' });
          labelMarker.append(smallPin);
          map.append(labelMarker);
          overlaysRef.current.push(labelMarker);
        });
      } catch {
        /* étiquette non supportée par cette version de l'API — les durées restent visibles dans le panneau latéral */
      }

      // Marqueur hôtel si la journée se termine ailleurs qu'au domicile.
      if (destination && hotelKey(destination) !== homeKey && !renderedHotels.has(hotelKey(destination))) {
        renderedHotels.add(hotelKey(destination));
        try {
          const hotelMarker = new Marker3DElement({
            position: { lat: destination.lat, lng: destination.lng, altitude: 35 },
            altitudeMode: 'RELATIVE_TO_GROUND',
            extruded: true,
          });
          const hotelPin = new PinElement({ background: '#1F2937', borderColor: '#FBBF24', glyphColor: '#FBBF24', glyphText: 'H' });
          hotelMarker.append(hotelPin);
          map.append(hotelMarker);
          overlaysRef.current.push(hotelMarker);
          focusPoints.push(destination);
        } catch {
          /* ignore */
        }
      }

      day.stops.forEach((stop, idx) => {
        try {
          const m = new Marker3DElement({
            position: { lat: stop.lat, lng: stop.lng, altitude: 30 },
            altitudeMode: 'RELATIVE_TO_GROUND',
            extruded: true,
          });
          const pin = new PinElement({ background: color, glyphText: String(idx + 1), glyphColor: '#0B0D10', borderColor: '#0B0D10' });
          m.append(pin);
          map.append(m);
          overlaysRef.current.push(m);
        } catch {
          /* ignore si non supporté */
        }
        focusPoints.push(stop);
      });
    });

    if (focusPoints.length) {
      idleAnimRef.current = false;
      const center = centroid(focusPoints);
      const range = Math.max(3500, spreadRangeMeters(focusPoints, center));
      try {
        map.flyCameraTo({
          endCamera: { center: { lat: center.lat, lng: center.lng, altitude: 0 }, tilt: 55, heading: 0, range },
          durationMillis: 1500,
        });
      } catch {
        map.center = { lat: center.lat, lng: center.lng, altitude: 0 };
        map.range = range;
      }
    } else if (!idleAnimRef.current) {
      // Aucune tournée générée : légère rotation d'ambiance au-dessus de la France.
      idleAnimRef.current = true;
      try {
        map.flyCameraAround({
          camera: { center: FRANCE_CENTER, tilt: 55, range: 1200000 },
          durationMillis: 90000,
          repeatCount: 999,
        });
      } catch {
        /* ignore */
      }
    }
  }, [status, home, days, activeDayFilter]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-3xl bg-surface-2">
      <div ref={containerRef} className="absolute inset-0 [&_gmp-map-3d]:block [&_gmp-map-3d]:w-full [&_gmp-map-3d]:h-full" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-faint bg-surface-2">
          <Loader2 size={22} className="animate-spin text-accent" />
          <span className="text-xs font-medium">Chargement de la carte 3D…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-8 bg-surface-2">
          <TriangleAlert size={22} className="text-warning" />
          <span className="text-sm font-medium text-ink-muted max-w-sm">{errorMsg}</span>
          <span className="text-xs text-ink-faint max-w-sm">
            Vérifie que la clé Google Maps est configurée dans src/lib/config.js et que « Map Tiles API » et « Maps JavaScript API » sont activées.
          </span>
        </div>
      )}
    </div>
  );
}

// Construit le tracé complet d'une journée à partir des tracés routiers détaillés de chaque trajet
// (origine → arrêt 1 → ... → destination). Repli sur une ligne directe si le détail est indisponible
// (ex: tournée relue depuis l'historique sans tracé sauvegardé).
function buildDayPath(day, origin, destination) {
  const legs = day.legs || [];
  const hasDetailedPaths = legs.length > 0 && legs.every((l) => l.path && l.path.length > 1);
  if (hasDetailedPaths) {
    const pts = [];
    legs.forEach((leg) => leg.path.forEach((p) => pts.push({ lat: p.lat, lng: p.lng, altitude: 20 })));
    return pts;
  }
  return [origin, ...day.stops, destination].filter(Boolean).map((p) => ({ lat: p.lat, lng: p.lng, altitude: 20 }));
}

// Point médian de chaque trajet (pour y accrocher une étiquette de durée) avec la durée en minutes.
function legMidpoints(day) {
  const legs = day.legs || [];
  return legs
    .map((leg) => {
      const minutes = Math.round((leg.durationS || 0) / 60);
      if (!minutes || !leg.path || !leg.path.length) return null;
      const position = leg.path[Math.floor(leg.path.length / 2)];
      return { position, minutes };
    })
    .filter(Boolean);
}

function spreadRangeMeters(points, center) {
  const maxKm = Math.max(...points.map((p) => haversineKm(p, center)), 1);
  return maxKm * 1000 * 3.2;
}
