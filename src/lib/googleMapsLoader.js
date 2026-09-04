import { CONFIG } from './config';

// Chargement du script Google Maps (une seule fois), puis import des "libraries" modulaires
// via google.maps.importLibrary — voir https://developers.google.com/maps/documentation/javascript/3d/get-started
let scriptLoadPromise;

function ensureScriptLoaded() {
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }
    window.__tourneeGmapsReady = () => resolve();
    const script = document.createElement('script');
    // "maps3d" (tuiles 3D photoréalistes, lourdes) n'est volontairement pas chargée ici : elle n'est
    // importée à la demande (voir importLibrary) que si l'utilisateur bascule sur la vue 3D.
    script.src = `https://maps.googleapis.com/maps/api/js?loading=async&key=${CONFIG.GOOGLE_MAPS_API_KEY}&libraries=maps,marker,geocoding,routes&callback=__tourneeGmapsReady`;
    script.async = true;
    script.onerror = () => reject(new Error('Impossible de charger Google Maps — vérifie la clé API dans src/lib/config.js'));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

const libraryCache = new Map();

// Charge une "library" Google Maps (ex: 'maps3d', 'marker', 'geocoding', 'routes') et met en cache le résultat.
export async function importLibrary(name) {
  await ensureScriptLoaded();
  if (!libraryCache.has(name)) {
    libraryCache.set(name, google.maps.importLibrary(name));
  }
  return libraryCache.get(name);
}
