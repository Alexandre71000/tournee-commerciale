import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config';

export const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

export async function sendMagicLink(email) {
  return sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
}

export async function signOut() {
  return sb.auth.signOut();
}
