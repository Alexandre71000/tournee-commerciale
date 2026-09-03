import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TriangleAlert, OctagonAlert, Plus, Save, Route as RouteIcon, UtensilsCrossed, BedDouble, Check } from 'lucide-react';
import GlassPanel from '../../components/ui/GlassPanel';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { dayColor } from '../../lib/dayColors';
import { minutesToHHMM, geocodeAddress } from '../../lib/geo';

export default function ResultsPanel({ plan, activeDayFilter, onFilterChange, onAddSuggestion, onSaveTour, saving, maxDayHours, overnightHotels, onSetHotel }) {
  const [name, setName] = useState('');

  if (!plan) return null;
  const multiDay = plan.days.length > 1;

  return (
    <GlassPanel strong className="pointer-events-auto w-[400px] max-h-full flex flex-col overflow-hidden">
      <div className="p-5 pb-3 flex items-center gap-2">
        <RouteIcon size={16} className="text-accent" />
        <h2 className="font-display font-semibold text-sm">Itinéraire</h2>
      </div>

      <div className="px-5 flex gap-1.5 flex-wrap pb-3">
        <TabPill active={activeDayFilter === 'all'} onClick={() => onFilterChange('all')}>
          Tous les jours
        </TabPill>
        {plan.days.map((d, i) => (
          <TabPill key={d.date} active={activeDayFilter === String(i)} onClick={() => onFilterChange(String(i))} dot={dayColor(i)}>
            {formatDateFR(d.date)}
          </TabPill>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-3">
        {plan.days.map((day, i) => (
          <div key={day.date} className="flex flex-col gap-3">
            <DayCard day={day} dayIdx={i} onAddSuggestion={onAddSuggestion} maxDayHours={maxDayHours} />
            {multiDay && i < plan.days.length - 1 && (
              <HotelPicker dayIdx={i} date={day.date} hotel={overnightHotels?.[i]} onSetHotel={onSetHotel} />
            )}
          </div>
        ))}
      </div>

      <div className="p-5 border-t border-border/10 flex gap-2">
        <Input placeholder="Nom de la tournée…" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
        <Button variant="primary" disabled={!name.trim() || saving} onClick={() => onSaveTour(name.trim())}>
          <Save size={15} /> {saving ? '…' : 'Enregistrer'}
        </Button>
      </div>
    </GlassPanel>
  );
}

function DayCard({ day, dayIdx, onAddSuggestion, maxDayHours }) {
  const color = dayColor(dayIdx);
  const distKm = (day.totalDistanceM / 1000).toFixed(0);
  const durH = (day.totalDurationS / 3600).toFixed(1);
  const sched = day.schedule;
  let stopNumber = 0;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border/10 bg-surface-3/40 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="font-medium text-sm">{formatDateFR(day.date)}</span>
      </div>
      <div className="flex gap-3 text-[11px] text-ink-faint mb-3">
        <span>{sched ? sched.stops.length : 0} visite(s)</span>
        <span>{distKm} km</span>
        <span>{durH} h de route</span>
        {sched && <span>retour ~{minutesToHHMM(sched.endOfDayMin)}</span>}
      </div>

      {day.status === 'infeasible' && (
        <div className="flex items-start gap-2 rounded-lg bg-danger/15 text-danger text-[11.5px] font-semibold px-3 py-2.5 mb-3">
          <OctagonAlert size={15} className="shrink-0 mt-0.5" />
          <span>
            Non réalisable dans le temps imparti — dépasse de {formatDuration(day.overloadMin)}. Retire un client ou ajoute un jour.
          </span>
        </div>
      )}
      {day.status === 'tight' && (
        <div className="flex items-center gap-2 rounded-lg bg-warning/12 text-warning text-[11px] font-medium px-3 py-2 mb-3">
          <TriangleAlert size={13} className="shrink-0" /> Journée serrée — tu termines proche de ta limite ({maxDayHours} h).
        </div>
      )}
      {sched?.firstDepartureEarlierMin > 0 && (
        <div className="text-[11px] text-ink-faint mb-3">
          ⏱ Départ conseillé {formatDuration(sched.firstDepartureEarlierMin)} plus tôt que ton heure de départ habituelle pour être à l'heure au premier rdv.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {sched?.events.map((ev, idx) => {
          if (ev.type === 'lunch') {
            return (
              <div key={`lunch-${idx}`} className="flex items-center gap-2.5 rounded-lg bg-surface-3/70 px-2.5 py-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-ink-faint shrink-0">
                  <UtensilsCrossed size={12} />
                </span>
                <div className="flex-1 text-xs font-medium text-ink-muted">Pause déjeuner</div>
                <div className="text-[11px] text-ink-faint">
                  {minutesToHHMM(ev.startMin)}–{minutesToHHMM(ev.endMin)}
                </div>
              </div>
            );
          }
          stopNumber += 1;
          return (
            <div key={ev.client.id || idx} className="flex items-center gap-2.5">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-surface shrink-0"
                style={{ background: color }}
              >
                {stopNumber}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{ev.client.name}</div>
                <div className="text-[10.5px] text-ink-faint truncate">{[ev.client.address, ev.client.city].filter(Boolean).join(', ')}</div>
              </div>
              <div className="text-[11px] text-ink-muted text-right shrink-0">
                {minutesToHHMM(ev.arrivalMin)}
                <div className="text-[10px] text-ink-faint">part {minutesToHHMM(ev.recommendedDepartureMin)}</div>
              </div>
            </div>
          );
        })}
        {!sched && <div className="text-[11px] text-ink-faint">Aucun client ce jour-là.</div>}
      </div>

      {day.suggestions?.length > 0 && (
        <div className="mt-3.5 pt-3.5 border-t border-border/10">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint mb-2">
            <Sparkles size={11} /> Suggestions à proximité
          </div>
          <div className="flex flex-col gap-1.5">
            {day.suggestions.map((s) => (
              <div key={s.client.id} className="flex items-center gap-2 rounded-lg border border-dashed border-border/20 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{s.client.name}</div>
                  <div className="text-[10.5px] text-ink-faint">{s.client.city || ''} — {s.distanceKm.toFixed(1)} km</div>
                </div>
                <button
                  onClick={() => onAddSuggestion(s.client.id)}
                  className="shrink-0 w-6 h-6 rounded-md bg-accent/15 text-accent flex items-center justify-center hover:bg-accent/25 transition-colors"
                >
                  <Plus size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function HotelPicker({ dayIdx, date, hotel, onSetHotel }) {
  const [address, setAddress] = useState(hotel?.address || '');
  const [editing, setEditing] = useState(!hotel);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!address.trim()) return;
    setLoading(true);
    const geo = await geocodeAddress(address);
    setLoading(false);
    if (!geo) return;
    onSetHotel(dayIdx, { lat: geo.lat, lng: geo.lng, address: geo.formattedAddress || address });
    setEditing(false);
  }

  if (!editing && hotel) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border/20 px-3 py-2.5">
        <BedDouble size={14} className="text-ink-faint shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] text-ink-faint">Nuit du {formatDateFR(date)}</div>
          <div className="text-xs font-medium truncate">{hotel.address}</div>
        </div>
        <button onClick={() => setEditing(true)} className="text-[11px] text-accent font-medium shrink-0">
          Modifier
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border/20 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10.5px] text-ink-faint mb-2">
        <BedDouble size={13} /> Où dors-tu la nuit du {formatDateFR(date)} ?
      </div>
      <div className="flex gap-1.5">
        <Input
          placeholder="Adresse de l'hôtel…"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="flex-1 text-xs"
        />
        <Button size="sm" variant="secondary" disabled={!address.trim() || loading} onClick={handleConfirm}>
          <Check size={13} />
        </Button>
      </div>
    </div>
  );
}

function TabPill({ active, onClick, children, dot }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
        active ? 'bg-accent/15 text-accent' : 'text-ink-faint hover:text-ink hover:bg-surface-3/60'
      }`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />}
      {children}
    </button>
  );
}

function formatDateFR(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function formatDuration(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}`;
}
