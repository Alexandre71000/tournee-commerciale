import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TriangleAlert, Plus, Save, Route as RouteIcon } from 'lucide-react';
import GlassPanel from '../../components/ui/GlassPanel';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { dayColor } from '../../lib/dayColors';
import { minutesToHHMM } from '../../lib/geo';

export default function ResultsPanel({ plan, activeDayFilter, onFilterChange, onAddSuggestion, onSaveTour, saving, maxDayHours }) {
  const [name, setName] = useState('');

  if (!plan) return null;

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

      <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-4">
        {plan.days.map((day, i) => (
          <DayCard key={day.date} day={day} dayIdx={i} onAddSuggestion={onAddSuggestion} maxDayHours={maxDayHours} />
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

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border/10 bg-surface-3/40 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="font-medium text-sm">{formatDateFR(day.date)}</span>
      </div>
      <div className="flex gap-3 text-[11px] text-ink-faint mb-3">
        <span>{day.schedule ? day.schedule.stops.length : 0} visite(s)</span>
        <span>{distKm} km</span>
        <span>{durH} h de route</span>
        {day.schedule && <span>retour ~{minutesToHHMM(day.schedule.endOfDayMin)}</span>}
      </div>

      {day.overloaded && (
        <div className="flex items-center gap-2 rounded-lg bg-warning/12 text-warning text-[11px] font-medium px-3 py-2 mb-3">
          <TriangleAlert size={13} /> Journée chargée (dépasse {maxDayHours} h avec trajets + visites)
        </div>
      )}

      <div className="flex flex-col gap-2">
        {day.schedule?.stops.map((s, idx) => (
          <div key={s.client.id || idx} className="flex items-center gap-2.5">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-surface shrink-0"
              style={{ background: color }}
            >
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">{s.client.name}</div>
              <div className="text-[10.5px] text-ink-faint truncate">{[s.client.address, s.client.city].filter(Boolean).join(', ')}</div>
            </div>
            <div className="text-[11px] text-ink-muted text-right shrink-0">{minutesToHHMM(s.arrivalMin)}</div>
          </div>
        ))}
        {!day.schedule && <div className="text-[11px] text-ink-faint">Aucun client ce jour-là.</div>}
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
