import { sb } from './supabaseClient';

export async function fetchTours() {
  const { data, error } = await sb.from('tours').select('*').order('start_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveTour(tour) {
  const { data, error } = await sb.from('tours').upsert(tour).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTour(id) {
  const { error } = await sb.from('tours').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchSettings() {
  const { data, error } = await sb.from('user_settings').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveSettings(settings) {
  const { data, error } = await sb.from('user_settings').upsert(settings).select().single();
  if (error) throw error;
  return data;
}
