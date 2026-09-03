import { sb } from './supabaseClient';

export async function fetchClients() {
  const { data, error } = await sb.from('clients').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertClient(client) {
  const { data, error } = await sb.from('clients').upsert(client).select().single();
  if (error) throw error;
  return data;
}

export async function upsertClientsBatch(clientsArr) {
  if (!clientsArr.length) return [];
  const { data, error } = await sb.from('clients').upsert(clientsArr).select();
  if (error) throw error;
  return data || [];
}

export async function deleteClient(id) {
  const { error } = await sb.from('clients').delete().eq('id', id);
  if (error) throw error;
}

export function distinctSectors(clientsArr) {
  const set = new Set();
  clientsArr.forEach((c) => {
    if (c.sector && c.sector.trim()) set.add(c.sector.trim());
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
}
