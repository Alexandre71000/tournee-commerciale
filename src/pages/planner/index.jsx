import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Wand2, Route as RouteIcon } from 'lucide-react';
import Map3D from '../../components/map/Map3D';
import FloatingWindow from '../../components/ui/FloatingWindow';
import ConfigPanel from './ConfigPanel';
import ResultsPanel from './ResultsPanel';
import { useAppData } from '../../context/AppDataContext';
import { useToast } from '../../hooks/useToast';
import { buildTourPlan } from '../../lib/planner';
import { buildSchedule } from '../../lib/geo';

export default function PlannerPage() {
  const { clients, settings, saveTour } = useAppData();
  const toast = useToast();
  const location = useLocation();

  const [sector, setSector] = useState('');
  const [dates, setDates] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [overnightHotels, setOvernightHotels] = useState({}); // { [dayIndex]: {lat,lng,address} }
  const [dayEndOverrides, setDayEndOverrides] = useState({}); // { [dayIndex]: 'HH:MM' }
  const [durationOverrides, setDurationOverrides] = useState({}); // { [clientId]: minutes }
  const [plan, setPlan] = useState(null);
  const [activeDayFilter, setActiveDayFilter] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const tour = location.state?.tour;
    if (!tour) return;
    setSector(tour.sector || '');
    setActiveDayFilter('all');
    const home = { lat: tour.home_lat, lng: tour.home_lng };
    setPlan({
      home,
      dates: (tour.days || []).map((d) => d.date),
      days: (tour.days || []).map((d) => ({
        date: d.date,
        origin: d.origin || home,
        destination: d.destination || home,
        stops: d.stops || [],
        legs: d.legs || [],
        totalDistanceM: d.totalDistanceM || 0,
        totalDurationS: d.totalDurationS || 0,
        schedule: buildSchedule(d.stops || [], d.legs || [], settings.day_start, settings.default_visit_duration_min, settings.lunch_break_min),
        suggestions: { onRoute: [], nearby: [] },
        dayEnd: d.dayEnd || settings.day_end,
        status: 'ok',
        overloadMin: 0,
        overloaded: false,
      })),
    });
    toast(`Tournée « ${tour.name} » chargée`, 'success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const toggleClient = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const addDate = useCallback((d) => {
    setDates((prev) => (prev.includes(d) ? prev : [...prev, d].sort()));
  }, []);
  const removeDate = useCallback((d) => setDates((prev) => prev.filter((x) => x !== d)), []);

  const generate = useCallback(
    async (extraSelectedIds, hotelsOverride, dayEndOverride, durationOverride) => {
      if (!settings.home_lat) return toast('Configure ton adresse de départ dans Réglages', 'error');
      if (!dates.length) return toast('Ajoute au moins un jour de déplacement', 'error');
      const ids = extraSelectedIds || selectedIds;
      if (!ids.size) return toast('Sélectionne au moins un client à visiter', 'error');

      setGenerating(true);
      try {
        const mustVisit = clients.filter((c) => ids.has(c.id) && c.lat != null);
        const candidatePool = clients.filter((c) => c.lat != null && !ids.has(c.id) && (!sector || c.sector === sector));
        const hotelsMap = hotelsOverride || overnightHotels;
        const hotelsArray = dates.slice(0, -1).map((_, i) => hotelsMap[i] || null);
        const dayEndMap = dayEndOverride || dayEndOverrides;
        const dayEndArray = dates.map((_, i) => dayEndMap[i] || settings.day_end);
        const durationMap = durationOverride || durationOverrides;

        const result = await buildTourPlan({
          home: { lat: settings.home_lat, lng: settings.home_lng },
          dates,
          mustVisitClients: mustVisit,
          candidateClients: candidatePool,
          dayStart: settings.day_start,
          visitDurationMin: settings.default_visit_duration_min,
          lunchBreakMin: settings.lunch_break_min,
          suggestionRadiusKm: settings.suggestion_radius_km,
          dayEndTimes: dayEndArray,
          overnightHotels: hotelsArray,
          durationOverrides: durationMap,
        });
        setPlan(result);
        setActiveDayFilter('all');
        toast('Tournée générée', 'success');
      } catch (e) {
        toast(e.message || 'Erreur de génération', 'error');
      } finally {
        setGenerating(false);
      }
    },
    [clients, dates, sector, selectedIds, overnightHotels, dayEndOverrides, durationOverrides, settings, toast]
  );

  const addSuggestion = useCallback(
    (clientId) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(clientId);
        generate(next);
        return next;
      });
    },
    [generate]
  );

  const setHotelForDay = useCallback(
    (dayIndex, hotel) => {
      setOvernightHotels((prev) => {
        const next = { ...prev, [dayIndex]: hotel };
        generate(null, next);
        return next;
      });
    },
    [generate]
  );

  const setDayEndForDay = useCallback(
    (dayIndex, hhmm) => {
      setDayEndOverrides((prev) => {
        const next = { ...prev, [dayIndex]: hhmm };
        generate(null, null, next);
        return next;
      });
    },
    [generate]
  );

  const setDurationForStop = useCallback(
    (clientId, minutes) => {
      setDurationOverrides((prev) => {
        const next = { ...prev, [clientId]: minutes };
        generate(null, null, null, next);
        return next;
      });
    },
    [generate]
  );

  const handleSaveTour = useCallback(
    async (name) => {
      if (!plan) return;
      setSaving(true);
      try {
        const tour = {
          name,
          sector: sector || null,
          start_date: plan.dates[0],
          end_date: plan.dates[plan.dates.length - 1],
          home_address: settings.home_address,
          home_lat: plan.home.lat,
          home_lng: plan.home.lng,
          days: plan.days.map((d) => ({
            date: d.date,
            origin: d.origin,
            destination: d.destination,
            stops: d.stops.map((s) => ({ id: s.id, name: s.name, address: s.address, city: s.city, lat: s.lat, lng: s.lng })),
            legs: d.legs,
            totalDistanceM: d.totalDistanceM,
            totalDurationS: d.totalDurationS,
            dayEnd: d.dayEnd,
          })),
        };
        await saveTour(tour);
        toast('Tournée enregistrée', 'success');
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setSaving(false);
      }
    },
    [plan, sector, settings, saveTour, toast]
  );

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0">
        <Map3D home={plan?.home || (settings.home_lat ? { lat: settings.home_lat, lng: settings.home_lng } : null)} days={plan?.days || []} activeDayFilter={activeDayFilter} />
      </div>

      <div className="absolute inset-0 pointer-events-none">
        <FloatingWindow
          id="planner-config"
          title="Planifier une tournée"
          icon={Wand2}
          defaultPosition={{ x: 20, y: 20 }}
          defaultSize={{ width: 380, height: 640 }}
          minWidth={320}
          minHeight={320}
        >
          <ConfigPanel
            clients={clients}
            sector={sector}
            onSectorChange={setSector}
            dates={dates}
            onAddDate={addDate}
            onRemoveDate={removeDate}
            selectedIds={selectedIds}
            onToggleClient={toggleClient}
            onGenerate={() => generate()}
            generating={generating}
          />
        </FloatingWindow>
        {plan && (
          <FloatingWindow
            id="planner-results"
            title="Itinéraire"
            icon={RouteIcon}
            defaultPosition={{ x: 416, y: 20 }}
            defaultSize={{ width: 400, height: 640 }}
            minWidth={340}
            minHeight={320}
          >
            <ResultsPanel
              plan={plan}
              activeDayFilter={activeDayFilter}
              onFilterChange={setActiveDayFilter}
              onAddSuggestion={addSuggestion}
              onSaveTour={handleSaveTour}
              saving={saving}
              defaultDayEnd={settings.day_end}
              overnightHotels={overnightHotels}
              onSetHotel={setHotelForDay}
              onSetDayEnd={setDayEndForDay}
              onSetDuration={setDurationForStop}
            />
          </FloatingWindow>
        )}
      </div>
    </div>
  );
}
