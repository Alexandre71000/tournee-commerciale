import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TriangleAlert, OctagonAlert, Plus, Save, UtensilsCrossed, BedDouble, Check, Pin, Briefcase, X } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { dayColor } from '../../lib/dayColors';
import { minutesToHHMM, geocodeAddress, formatDuration } from '../../lib/geo';

export default function ResultsPanel({
  plan,
  activeDayFilter,
  onFilterChange,
  onAddSuggestion,
  onSaveTour,
  saving,
  defaultDayEnd,
  overnightHotels,
  onSetHotel,
  onSetDayEnd,
  onSetDuration,
  fixedTimesByDay,
  onSetFixedTime,
  onAddMission,
  onRemoveMission,
}) {
  const [name, setName] = useState('');

  if (!plan) return null;
  const multiDay = plan.days.length > 1;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-5 pt-4 flex gap-1.5 flex-wrap pb-3">
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
            <DayCard
              day={day}
              dayIdx={i}
              onAddSuggestion={onAddSuggestion}
              defaultDayEnd={defaultDayEnd}
              onSetDayEnd={onSetDayEnd}
              onSetDuration={onSetDuration}
              fixedTimesForDay={fixedTimesByDay?.[i] || {}}
              onSetFixedTime={onSetFixedTime}
              onAddMission={onAddMission}
              onRemoveMission={onRemoveMission}
            />
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
    </div>
  );
}

function DayCard({ day, dayIdx, onAddSuggestion, defaultDayEnd, onSetDayEnd, onSetDuration, fixedTimesForDay, onSetFixedTime, onAddMission, onRemoveMission }) {
  const color = dayColor(dayIdx);
  const distKm = (day.totalDistanceM / 1000).toFixed(0);
  const durH = (day.totalDurationS / 3600).toFixed(1);
  const sched = day.schedule;
  const dayEndValue = day.dayEnd || defaultDayEnd;
  const isCustomDayEnd = day.dayEnd && day.dayEnd !== defaultDayEnd;
  let stopNumber = 0;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border/10 bg-surface-3/40 p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="font-medium text-sm">{formatDateFR(day.date)}</span>
        </div>
        {onSetDayEnd && (
          <label className={`flex items-center gap-1.5 text-[10.5px] ${isCustomDayEnd ? 'text-accent' : 'text-ink-faint'}`}>
            Fin à
            <input
              type="time"
              value={dayEndValue || ''}
              onChange={(e) => e.target.value && onSetDayEnd(dayIdx, e.target.value)}
              className="bg-transparent border-none outline-none font-medium w-[62px] cursor-pointer"
            />
          </label>
        )}
      </div>
      <div className="flex gap-3 text-[11px] text-ink-faint mb-3">
        <span>{sched ? sched.stops.length : 0} visite(s)</span>
        <span>{distKm} km</span>
        <span>{durH} h de route</span>
        {sched && <span>retour ~{minutesToHHMM(sched.endOfDayMin)}</span>}
      </div>

      {day.fixedConflict && (
        <div className="flex items-start gap-2 rounded-lg bg-danger/15 text-danger text-[11.5px] font-semibold px-3 py-2.5 mb-3">
          <OctagonAlert size={15} className="shrink-0 mt-0.5" />
          <span>
            RDV fixé « {day.fixedConflict.label} » à {minutesToHHMM(day.fixedConflict.timeMin)} intenable — tu arriverais à{' '}
            {minutesToHHMM(day.fixedConflict.arrivalMin)} ({formatDuration(day.fixedConflict.lateByMin)} de retard). Retire un arrêt avant ou décale l'horaire fixé.
          </span>
        </div>
      )}
      {day.status === 'infeasible' && !day.fixedConflict && (
        <div className="flex items-start gap-2 rounded-lg bg-danger/15 text-danger text-[11.5px] font-semibold px-3 py-2.5 mb-3">
          <OctagonAlert size={15} className="shrink-0 mt-0.5" />
          <span>
            Non réalisable dans le temps imparti — dépasse de {formatDuration(day.overloadMin)}. Retire un client, ajoute un jour ou recule l'heure de fin ci-dessus.
          </span>
        </div>
      )}
      {day.status === 'tight' && (
        <div className="flex items-center gap-2 rounded-lg bg-warning/12 text-warning text-[11px] font-medium px-3 py-2 mb-3">
          <TriangleAlert size={13} className="shrink-0" /> Journée serrée — tu termines proche de ta limite ({dayEndValue}).
        </div>
      )}
      {sched?.firstDepartureEarlierMin > 0 && (
        <div className="text-[11px] text-ink-faint mb-3">
          ⏱ Départ conseillé {formatDuration(sched.firstDepartureEarlierMin)} plus tôt que ton heure de départ habituelle pour être à l'heure au premier rdv.
        </div>
      )}

      <DayTimeline sched={sched} color={color} />

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
          if (ev.type === 'mission') {
            return (
              <div key={ev.mission.id} className="flex items-center gap-2.5 rounded-lg bg-surface-3/70 px-2.5 py-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-warning bg-warning/15 shrink-0">
                  <Briefcase size={11} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{ev.mission.label}</div>
                  {ev.mission.address && <div className="text-[10.5px] text-ink-faint truncate">{ev.mission.address}</div>}
                </div>
                <div className="text-[11px] text-ink-muted text-right shrink-0 flex items-center gap-1.5">
                  <span>
                    {minutesToHHMM(ev.arrivalMin)}–{minutesToHHMM(ev.departureMin)}
                  </span>
                  {onRemoveMission && (
                    <button onClick={() => onRemoveMission(dayIdx, ev.mission.id)} className="text-ink-faint hover:text-danger">
                      <X size={12} />
                    </button>
                  )}
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
                {ev.fixed ? <Pin size={10} /> : stopNumber}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{ev.client.name}</div>
                <div className="text-[10.5px] text-ink-faint truncate">{[ev.client.address, ev.client.city].filter(Boolean).join(', ')}</div>
                {ev.lateByMin > 0 && <div className="text-[10px] text-danger font-medium">en retard de {formatDuration(ev.lateByMin)}</div>}
              </div>
              <div className="text-[11px] text-ink-muted text-right shrink-0">
                {minutesToHHMM(ev.arrivalMin)}
                {!ev.fixed && <div className="text-[10px] text-ink-faint">part {minutesToHHMM(ev.recommendedDepartureMin)}</div>}
                {onSetDuration && <DurationEditor clientId={ev.client.id} value={ev.durationMin} onSetDuration={onSetDuration} />}
                {onSetFixedTime && (
                  <FixedTimeToggle
                    dayIdx={dayIdx}
                    clientId={ev.client.id}
                    arrivalMin={ev.arrivalMin}
                    fixedTime={fixedTimesForDay?.[ev.client.id]}
                    onSetFixedTime={onSetFixedTime}
                  />
                )}
              </div>
            </div>
          );
        })}
        {!sched && <div className="text-[11px] text-ink-faint">Aucun client ce jour-là.</div>}
      </div>

      {onAddMission && (
        <div className="mt-3">
          <MissionAdder dayIdx={dayIdx} onAddMission={onAddMission} />
        </div>
      )}

      {(day.suggestions?.onRoute?.length > 0 || day.suggestions?.nearby?.length > 0) && (
        <div className="mt-3.5 pt-3.5 border-t border-border/10 flex flex-col gap-3">
          <SuggestionList title="Sur ta route" items={day.suggestions.onRoute} onAdd={onAddSuggestion} />
          <SuggestionList title="À proximité" items={day.suggestions.nearby} onAdd={onAddSuggestion} showDetour />
        </div>
      )}
    </motion.div>
  );
}

// Barre proportionnelle du déroulé de la journée (trajets / visites / pause), pour visualiser
// d'un coup d'œil les horaires entre chaque rendez-vous.
function DayTimeline({ sched, color }) {
  if (!sched || !sched.stops.length) return null;
  const start = sched.stops[0].recommendedDepartureMin;
  const end = sched.endOfDayMin;
  if (end <= start) return null;

  const segments = [];
  let prevEnd = start;
  for (const ev of sched.events) {
    if (ev.type === 'lunch') {
      if (ev.startMin > prevEnd) segments.push({ type: 'travel', min: ev.startMin - prevEnd });
      segments.push({ type: 'lunch', min: ev.endMin - ev.startMin, label: 'Pause déjeuner' });
      prevEnd = ev.endMin;
    } else if (ev.type === 'mission') {
      if (ev.arrivalMin > prevEnd) segments.push({ type: 'travel', min: ev.arrivalMin - prevEnd });
      segments.push({ type: 'lunch', min: ev.departureMin - ev.arrivalMin, label: ev.mission.label });
      prevEnd = ev.departureMin;
    } else {
      if (ev.arrivalMin > prevEnd) segments.push({ type: 'travel', min: ev.arrivalMin - prevEnd });
      segments.push({ type: 'visit', min: ev.departureMin - ev.arrivalMin, label: ev.client.name });
      prevEnd = ev.departureMin;
    }
  }
  if (end > prevEnd) segments.push({ type: 'travel', min: end - prevEnd, label: 'Retour' });

  return (
    <div className="mb-3.5">
      <div className="flex h-2 rounded-full overflow-hidden gap-[2px]">
        {segments.map((seg, i) => (
          <div
            key={i}
            title={`${seg.label ? seg.label + ' — ' : 'Trajet — '}${formatDuration(seg.min)}`}
            className={`rounded-full ${seg.type === 'travel' ? 'bg-ink-faint/25' : seg.type === 'lunch' ? 'bg-warning/70' : ''}`}
            style={{ flex: `${Math.max(seg.min, 3)} 0 0%`, background: seg.type === 'visit' ? color : undefined }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-ink-faint mt-1">
        <span>{minutesToHHMM(start)}</span>
        <span>{minutesToHHMM(end)}</span>
      </div>
    </div>
  );
}

function DurationEditor({ clientId, value, onSetDuration }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  function commit() {
    const n = Number(draft);
    if (n > 0 && n !== value) onSetDuration(clientId, n);
    else setDraft(value);
  }

  return (
    <div className="flex items-center gap-0.5 justify-end text-[10px] text-ink-faint mt-0.5">
      <input
        type="number"
        min={5}
        step={5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="w-8 bg-transparent border-none outline-none text-right"
      />
      min
    </div>
  );
}

// Permet de figer l'heure d'un arrêt à une valeur précise (ex. le client n'était dispo qu'à ce
// créneau) : les autres visites de la journée se réorganisent alors autour de ce point fixe.
function FixedTimeToggle({ dayIdx, clientId, arrivalMin, fixedTime, onSetFixedTime }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fixedTime || minutesToHHMM(arrivalMin));

  if (fixedTime) {
    return (
      <button
        onClick={() => onSetFixedTime(dayIdx, clientId, null)}
        className="flex items-center gap-1 text-[10px] text-accent font-medium mt-0.5 ml-auto"
        title="Heure fixée — cliquer pour libérer"
      >
        <Pin size={9} /> fixé
      </button>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 mt-0.5 justify-end">
        <input
          type="time"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="bg-transparent border-none outline-none text-[10px] text-ink-faint w-[52px]"
        />
        <button
          onClick={() => {
            onSetFixedTime(dayIdx, clientId, draft);
            setEditing(false);
          }}
          className="text-accent"
        >
          <Check size={11} />
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-[10px] text-ink-faint hover:text-accent mt-0.5 ml-auto">
      <Pin size={9} /> fixer
    </button>
  );
}

// Formulaire compact pour insérer une mission bloquante dans la journée (ex. aller chercher
// quelqu'un à l'aéroport) — adresse optionnelle : sans adresse, le créneau est juste réservé.
function MissionAdder({ dayIdx, onAddMission }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!label.trim() || !time) return;
    setLoading(true);
    let lat = null;
    let lng = null;
    let resolvedAddress = address.trim() || null;
    if (address.trim()) {
      const geo = await geocodeAddress(address);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        resolvedAddress = geo.formattedAddress || address.trim();
      }
    }
    setLoading(false);
    onAddMission(dayIdx, { id: crypto.randomUUID(), label: label.trim(), address: resolvedAddress, lat, lng, time, durationMin: Number(duration) || 30 });
    setLabel('');
    setAddress('');
    setTime('');
    setDuration(30);
    setOpen(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-[11px] text-ink-faint hover:text-accent font-medium">
        <Plus size={12} /> Ajouter une mission
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border/20 px-3 py-2.5 flex flex-col gap-1.5">
      <Input placeholder="Intitulé (ex. Aéroport — récupérer un colis)" value={label} onChange={(e) => setLabel(e.target.value)} className="text-xs" />
      <Input placeholder="Adresse (optionnel)" value={address} onChange={(e) => setAddress(e.target.value)} className="text-xs" />
      <div className="flex gap-1.5">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input-field text-xs flex-1" />
        <input
          type="number"
          min={5}
          step={5}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          title="Durée (min)"
          className="input-field text-xs w-16"
        />
      </div>
      <div className="flex gap-1.5 justify-end">
        <button onClick={() => setOpen(false)} className="text-[11px] text-ink-faint px-2 py-1">
          Annuler
        </button>
        <Button size="sm" variant="secondary" disabled={!label.trim() || !time || loading} onClick={handleAdd}>
          <Check size={13} />
        </Button>
      </div>
    </div>
  );
}

function SuggestionList({ title, items, onAdd, showDetour }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint mb-2">
        <Sparkles size={11} /> {title}
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((s) => (
          <div key={s.client.id} className="flex items-center gap-2 rounded-lg border border-dashed border-border/20 px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">{s.client.name}</div>
              <div className="text-[10.5px] text-ink-faint">
                {s.client.city || ''} — {s.distanceKm.toFixed(1)} km
                {showDetour && s.detourMin > 0.5 && <span> · +{formatDuration(s.detourMin)}</span>}
              </div>
            </div>
            <button
              onClick={() => onAdd(s.client.id)}
              className="shrink-0 w-6 h-6 rounded-md bg-accent/15 text-accent flex items-center justify-center hover:bg-accent/25 transition-colors"
            >
              <Plus size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
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
