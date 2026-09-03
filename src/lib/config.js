// Configuration — à remplir après création de tes projets Supabase / Google Cloud.
// Ces valeurs sont exposées côté navigateur (normal et sans risque) :
// - la clé Supabase "anon" est protégée par les policies Row Level Security (voir supabase-schema.sql)
// - la clé Google Maps doit être restreinte par "référent HTTP" (domaine du site) dans Google Cloud Console
export const CONFIG = {
  SUPABASE_URL: 'https://tkblfsenqqzxckgaiwsf.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_E9Mf7S30wu7SPPVHlMsA4w_-xitf0vB',
  GOOGLE_MAPS_API_KEY: 'AIzaSyD5CnCoGqcTgf2f7qOPINtRzi8D4WA3Ses',

  // Réglages métier par défaut (modifiables ensuite dans l'app > Réglages)
  DEFAULT_VISIT_DURATION_MIN: 45,
  DEFAULT_DAY_START: '08:30',
  DEFAULT_MAX_DAY_HOURS: 9,
  SUGGESTION_RADIUS_KM: 5,
};
