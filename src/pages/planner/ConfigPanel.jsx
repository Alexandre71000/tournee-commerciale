import { useMemo, useState } from 'react';
import { MapPin, CalendarPlus, Search, Wand2, X } from 'lucide-react';
import { PanelLabel } from '../../components/ui/GlassPanel';
import { Select, Input } from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import ProgressBar from '../../components/ui/ProgressBar';
import { distinctSectors } from '../../lib/clients';

export default function ConfigPanel({
  clients,
  sector,
  onSectorChange,
  dates,
  onAddDate,
  onRemoveDate,
  selectedIds,
  onToggleClient,
  onGenerate,
  generating,
}) {
  const [dateDraft, setDateDraft] = useState('');
  const [search, setSearch] = useState('');
  const sectors = useMemo(() => distinctSectors(clients), [clients]);

  const filtered = useMemo(
    () =>
      clients.filter((c) => {
        if (sector && c.sector !== sector) return false;
        if (search && !`${c.name} ${c.city || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [clients, sector, search]
  );

  return (
    <div className="h-full flex flex-col p-5 gap-4 overflow-hidden">
      <p className="text-xs text-ink-muted -mt-1">Secteur, jours de déplacement, clients à voir.</p>

      <div className="flex-1 overflow-y-auto -mr-2 pr-2 flex flex-col gap-5">
        <div>
          <PanelLabel icon={MapPin}>Secteur</PanelLabel>
          <Select value={sector} onChange={(e) => onSectorChange(e.target.value)}>
            <option value="">Tous les secteurs</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <PanelLabel icon={CalendarPlus}>Jours de déplacement</PanelLabel>
          <div className="flex gap-2">
            <Input type="date" value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} className="flex-1" />
            <Button
              variant="secondary"
              onClick={() => {
                if (!dateDraft) return;
                onAddDate(dateDraft);
                setDateDraft('');
              }}
            >
              Ajouter
            </Button>
          </div>
          {dates.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {dates.map((d) => (
                <span key={d} className="inline-flex items-center gap-1.5 rounded-full bg-accent/12 text-accent text-xs font-medium px-2.5 py-1">
                  {formatDateFR(d)}
                  <X size={12} className="cursor-pointer opacity-70 hover:opacity-100" onClick={() => onRemoveDate(d)} />
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <PanelLabel icon={Search}>Clients à visiter</PanelLabel>
          <Input placeholder="Rechercher un client…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2.5" />
          <div className="flex-1 overflow-y-auto rounded-xl border border-border/10 divide-y divide-border/10 min-h-[140px]">
            {filtered.length === 0 && <div className="text-xs text-ink-faint text-center py-8 px-4">Aucun client{sector ? ' dans ce secteur' : ''}.</div>}
            {filtered.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5 px-3 py-2.5 text-sm cursor-pointer hover:bg-surface-3/50 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.id)}
                  disabled={c.lat == null}
                  onChange={() => onToggleClient(c.id)}
                  className="accent-accent"
                />
                <span className="flex-1 min-w-0">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="text-[11px] text-ink-faint truncate">
                    {c.city || ''}
                    {c.lat == null ? ' — non géocodé' : ''}
                  </div>
                </span>
              </label>
            ))}
          </div>
          <div className="text-[11px] text-ink-faint mt-2">{selectedIds.size} client(s) sélectionné(s)</div>
        </div>
      </div>

      <div>
        <Button variant="primary" size="lg" className="w-full" onClick={onGenerate} disabled={generating}>
          <Wand2 size={16} /> {generating ? 'Génération…' : 'Générer la tournée'}
        </Button>
        {generating && (
          <div className="mt-3">
            <ProgressBar percent={65} />
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateFR(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
}
