import { useEffect, useRef, useState } from 'react';
import { importLibrary } from '../../lib/googleMapsLoader';
import { haversineKm, centroid, formatDuration } from '../../lib/geo';
import { dayColor } from '../../lib/dayColors';
import { LIGHT_MAP_STYLE, DARK_MAP_STYLE } from '../../lib/mapStyles';
import { Loader2, TriangleAlert, Box, Map as MapIcon } from 'lucide-react';

const FRANCE_CENTER = { lat: 46.7, lng: 2.4 };

function useIsDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

// Carte de la tournée — vue 2D vectorielle légère par défaut (rapide, peu gourmande), avec une
// vue 3D photoréaliste optionnelle (Google Maps Photorealistic 3D Tiles) pour l'effet visuel.
export default function Map3D({ home, days = [], activeDayFilter = 'all' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const mapNodeRef = useRef(null);
  const classesRef = useRef({});
  const overlaysRef = useRef([]);
  const idleAnimRef = useRef(false);
  const [mode, setMode] = useState('2d'); // '2d' (par défaut, léger) | '3d' (photoréaliste, optionnel)
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const isDark = useIsDarkMode();

  // (Re)crée l'instance de carte quand on change de mode.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    const timeout = setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setErrorMsg('La carte met trop de temps à répondre — la clé Google Maps est probablement invalide ou mal configurée.');
      setStatus('error');
    }, 9000);
    (async () => {
      try {
        if (mode === '3d') {
          const [maps3d, marker] = await Promise.all([importLibrary('maps3d'), importLibrary('marker')]);
          if (cancelled) return;
          clearTimeout(timeout);
          classesRef.current = { ...maps3d, ...marker };
          const map = new maps3d.Map3DElement({ center: { ...FRANCE_CENTER, altitude: 0 }, range: 1200000, tilt: 55, mode: 'HYBRID' });
          map.defaultUIHidden = true;
          mapRef.current = map;
          mapNodeRef.current = map;
        } else {
          // Vue 2D : uniquement la librairie "maps" de base (Marker/Polyline classiques) — pas besoin
          // de "marker" (AdvancedMarkerElement exige un Map ID incompatible avec le style JSON inline).
          const { Map } = await importLibrary('maps');
          if (cancelled) return;
          clearTimeout(timeout);
          classesRef.current = {};
          const node = document.createElement('div');
          node.style.width = '100%';
          node.style.height = '100%';
          const map = new Map(node, {
            center: FRANCE_CENTER,
            zoom: 6,
            disableDefaultUI: true,
            clickableIcons: false,
            styles: isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE,
          });
          mapRef.current = map;
          mapNodeRef.current = node;
        }
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(mapNodeRef.current);
        }
        setStatus('ready');
      } catch (e) {
        clearTimeout(timeout);
        if (!cancelled) {
          setErrorMsg(e.message || 'La carte est indisponible.');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      overlaysRef.current.forEach((el) => (el.setMap ? el.setMap(null) : el.remove?.()));
      overlaysRef.current = [];
      if (mode === '3d') mapRef.current?.remove?.();
      mapRef.current = null;
      mapNodeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Thème clair/sombre : on ré-applique juste les styles en 2D, sans recréer la carte.
  useEffect(() => {
    if (mode === '2d' && status === 'ready' && mapRef.current) {
      mapRef.current.setOptions({ styles: isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE });
    }
  }, [isDark, mode, status]);

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return;
    const map = mapRef.current;

    overlaysRef.current.forEach((el) => (el.setMap ? el.setMap(null) : el.remove?.()));
    overlaysRef.current = [];

    const focusPoints = [];
    const posKey = (p) => (p ? `${p.lat.toFixed(4)},${p.lng.toFixed(4)}` : null);
    const homeKey = home ? posKey(home) : null;
    const renderedHotels = new Set();

    if (home && home.lat != null) {
      addPin(mode, map, classesRef.current, overlaysRef.current, home, {
        background: '#0B1220',
        borderColor: '#38BDF8',
        glyphColor: '#38BDF8',
        extruded: true,
        altitude: 40,
      });
      focusPoints.push(home);
    }

    days.forEach((day, i) => {
      const visible = activeDayFilter === 'all' || activeDayFilter === String(i);
      if (!visible || !day.stops?.length) return;
      const color = dayColor(i);
      const origin = day.origin || home;
      const destination = day.destination || home;

      const path = buildDayPath(day, origin, destination);
      if (path.length >= 2) {
        addPolyline(mode, map, classesRef.current, overlaysRef.current, path, color);
      }

      // Étiquettes de durée à mi-chemin de chaque trajet.
      legMidpoints(day).forEach(({ position, minutes }) => {
        addDurationBadge(mode, map, classesRef.current, overlaysRef.current, position, formatDuration(minutes), color);
      });

      // Marqueur hôtel si la journée se termine ailleurs qu'au domicile.
      if (destination && posKey(destination) !== homeKey && !renderedHotels.has(posKey(destination))) {
        renderedHotels.add(posKey(destination));
        addPin(mode, map, classesRef.current, overlaysRef.current, destination, {
          background: '#1F2937',
          borderColor: '#FBBF24',
          glyphColor: '#FBBF24',
          glyphText: 'H',
          extruded: true,
          altitude: 35,
        });
        focusPoints.push(destination);
      }

      day.stops.forEach((stop, idx) => {
        addPin(mode, map, classesRef.current, overlaysRef.current, stop, {
          background: color,
          glyphText: String(idx + 1),
          glyphColor: '#0B0D10',
          borderColor: '#0B0D10',
          extruded: true,
          altitude: 30,
        });
        focusPoints.push(stop);
      });
    });

    if (focusPoints.length) {
      idleAnimRef.current = false;
      focusCamera(mode, map, focusPoints);
    } else if (mode === '3d' && !idleAnimRef.current) {
      // Aucune tournée générée : légère rotation d'ambiance au-dessus de la France (3D uniquement).
      idleAnimRef.current = true;
      try {
        map.flyCameraAround({ camera: { center: { ...FRANCE_CENTER, altitude: 0 }, tilt: 55, range: 1200000 }, durationMillis: 90000, repeatCount: 999 });
      } catch {
        /* ignore */
      }
    } else if (mode === '2d') {
      map.setCenter(FRANCE_CENTER);
      map.setZoom(6);
    }
  }, [status, mode, home, days, activeDayFilter]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-3xl bg-surface-2">
      <div ref={containerRef} className="absolute inset-0 [&_gmp-map-3d]:block [&_gmp-map-3d]:w-full [&_gmp-map-3d]:h-full" />

      <button
        onClick={() => setMode((m) => (m === '2d' ? '3d' : '2d'))}
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-full bg-surface-2/85 backdrop-blur-md border border-border/10 px-3 py-1.5 text-[11.5px] font-medium text-ink-muted hover:text-ink shadow-glass transition-colors"
      >
        {mode === '2d' ? <Box size={13} /> : <MapIcon size={13} />}
        {mode === '2d' ? 'Vue 3D' : 'Vue 2D'}
      </button>

      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-faint bg-surface-2">
          <Loader2 size={22} className="animate-spin text-accent" />
          <span className="text-xs font-medium">Chargement de la carte…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-8 bg-surface-2">
          <TriangleAlert size={22} className="text-warning" />
          <span className="text-sm font-medium text-ink-muted max-w-sm">{errorMsg}</span>
          <span className="text-xs text-ink-faint max-w-sm">
            Vérifie que la clé Google Maps est configurée dans src/lib/config.js et que les API nécessaires sont activées.
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rendu des overlays (pins, tracés, étiquettes) — une implémentation par mode ('2d' | '3d'),
// derrière une interface commune pour que le reste du composant n'ait pas à distinguer les deux.
// ---------------------------------------------------------------------------

function addPin(mode, map, classes, overlays, point, { background, borderColor, glyphColor, glyphText, extruded, altitude }) {
  try {
    if (mode === '3d') {
      const { PinElement, Marker3DElement } = classes;
      const pin = new PinElement({ background, borderColor, glyphColor, glyphText, scale: glyphText ? 1 : 1.05 });
      const marker = new Marker3DElement({ position: { lat: point.lat, lng: point.lng, altitude }, altitudeMode: 'RELATIVE_TO_GROUND', extruded });
      marker.append(pin);
      map.append(marker);
      overlays.push(marker);
    } else {
      const marker = new google.maps.Marker({
        position: { lat: point.lat, lng: point.lng },
        map,
        icon: {
          url: circlePinDataUri(background, glyphText, glyphColor, borderColor),
          scaledSize: new google.maps.Size(28, 28),
          anchor: new google.maps.Point(14, 14),
        },
      });
      overlays.push(marker);
    }
  } catch {
    /* propriété non supportée par cette version de l'API — on ignore silencieusement */
  }
}

// Icône circulaire encodée en SVG inline (marqueur classique 2D, sans dépendance à un Map ID).
function circlePinDataUri(background, text, textColor = '#0B0D10', border = '#0B0D10') {
  const label = text
    ? `<text x="14" y="18.5" font-family="system-ui,-apple-system,sans-serif" font-size="12" font-weight="700" fill="${textColor}" text-anchor="middle">${text}</text>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="11" fill="${background}" stroke="${border}" stroke-width="2"/>${label}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function addPolyline(mode, map, classes, overlays, path, color) {
  try {
    if (mode === '3d') {
      const { Polyline3DElement } = classes;
      const polyline = new Polyline3DElement({ path, strokeColor: color, strokeWidth: 3.5, altitudeMode: 'RELATIVE_TO_GROUND', geodesic: true });
      map.append(polyline);
      overlays.push(polyline);
    } else {
      const polyline = new google.maps.Polyline({
        path,
        map,
        strokeColor: color,
        strokeWeight: 3,
        strokeOpacity: 0.9,
        geodesic: true,
      });
      overlays.push(polyline);
    }
  } catch {
    /* ignore si non supporté */
  }
}

function addDurationBadge(mode, map, classes, overlays, position, text, color) {
  try {
    if (mode === '3d') {
      const { Marker3DElement, PinElement } = classes;
      const marker = new Marker3DElement({ position: { lat: position.lat, lng: position.lng, altitude: 12 }, altitudeMode: 'RELATIVE_TO_GROUND' });
      marker.label = text;
      const pin = new PinElement({ background: color, scale: 0.45, glyphColor: color, borderColor: '#ffffff' });
      marker.append(pin);
      map.append(marker);
      overlays.push(marker);
    } else {
      overlays.push(createHtmlOverlay(map, position, text, color));
    }
  } catch {
    /* étiquette non supportée — les durées restent visibles dans le panneau latéral */
  }
}

// Overlay HTML libre positionné à un lat/lng — utilisé pour les étiquettes de durée en 2D, qui ont
// besoin d'un texte à largeur variable (une simple icône ne suffit pas comme pour les pins numérotés).
function createHtmlOverlay(map, position, text, color) {
  const overlay = new google.maps.OverlayView();
  overlay.onAdd = function () {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.cssText = `position:absolute;transform:translate(-50%,-50%);background:#101319e6;color:#fff;font:600 10.5px/1 -apple-system,Inter,sans-serif;padding:3px 7px;border-radius:999px;border:1.5px solid ${color};white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25);`;
    this.div = div;
    this.getPanes().overlayMouseTarget.appendChild(div);
  };
  overlay.draw = function () {
    if (!this.div) return;
    const proj = this.getProjection();
    if (!proj) return;
    const point = proj.fromLatLngToDivPixel(new google.maps.LatLng(position.lat, position.lng));
    this.div.style.left = `${point.x}px`;
    this.div.style.top = `${point.y}px`;
  };
  overlay.onRemove = function () {
    this.div?.remove();
    this.div = null;
  };
  overlay.setMap(map);
  return overlay;
}

function focusCamera(mode, map, focusPoints) {
  const center = centroid(focusPoints);
  if (mode === '3d') {
    const range = Math.max(3500, spreadRangeMeters(focusPoints, center));
    try {
      map.flyCameraTo({ endCamera: { center: { lat: center.lat, lng: center.lng, altitude: 0 }, tilt: 55, heading: 0, range }, durationMillis: 1500 });
    } catch {
      map.center = { lat: center.lat, lng: center.lng, altitude: 0 };
      map.range = range;
    }
  } else {
    const bounds = new google.maps.LatLngBounds();
    focusPoints.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 64);
  }
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
