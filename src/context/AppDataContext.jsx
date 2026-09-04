import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchClients, upsertClient as upsertClientApi, upsertClientsBatch as upsertClientsBatchApi, deleteClient as deleteClientApi } from '../lib/clients';
import { fetchTours, saveTour as saveTourApi, deleteTour as deleteTourApi, fetchSettings, saveSettings as saveSettingsApi } from '../lib/tours';
import { CONFIG } from '../lib/config';

const AppDataContext = createContext(null);

function defaultSettings() {
  return {
    home_address: '',
    home_lat: null,
    home_lng: null,
    default_visit_duration_min: CONFIG.DEFAULT_VISIT_DURATION_MIN,
    day_start: CONFIG.DEFAULT_DAY_START,
    day_end: CONFIG.DEFAULT_DAY_END,
    lunch_break_min: CONFIG.DEFAULT_LUNCH_BREAK_MIN,
    suggestion_radius_km: CONFIG.SUGGESTION_RADIUS_KM,
  };
}

export function AppDataProvider({ children }) {
  const [clients, setClients] = useState([]);
  const [tours, setTours] = useState([]);
  const [settings, setSettings] = useState(defaultSettings());
  const [loading, setLoading] = useState(true);

  const reloadClients = useCallback(async () => {
    const data = await fetchClients();
    setClients(data);
    return data;
  }, []);

  const reloadTours = useCallback(async () => {
    const data = await fetchTours();
    setTours(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [clientsData, settingsData] = await Promise.all([fetchClients(), fetchSettings()]);
      if (cancelled) return;
      setClients(clientsData);
      setSettings(settingsData || defaultSettings());
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const upsertClient = useCallback(async (client) => {
    const saved = await upsertClientApi(client);
    setClients((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      const next = idx >= 0 ? prev.map((c, i) => (i === idx ? saved : c)) : [...prev, saved];
      return next.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
    });
    return saved;
  }, []);

  const upsertClientsBatch = useCallback(async (arr) => {
    const saved = await upsertClientsBatchApi(arr);
    setClients((prev) => [...prev, ...saved].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr')));
    return saved;
  }, []);

  const deleteClient = useCallback(async (id) => {
    await deleteClientApi(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const saveSettings = useCallback(async (payload) => {
    const saved = await saveSettingsApi(payload);
    setSettings(saved);
    return saved;
  }, []);

  const saveTour = useCallback(async (tour) => {
    const saved = await saveTourApi(tour);
    setTours((prev) => [saved, ...prev]);
    return saved;
  }, []);

  const deleteTour = useCallback(async (id) => {
    await deleteTourApi(id);
    setTours((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <AppDataContext.Provider
      value={{
        loading,
        clients,
        tours,
        settings,
        reloadClients,
        reloadTours,
        upsertClient,
        upsertClientsBatch,
        deleteClient,
        saveSettings,
        saveTour,
        deleteTour,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  return useContext(AppDataContext);
}
