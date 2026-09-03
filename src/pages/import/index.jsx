import { useState } from 'react';
import { Upload, SlidersHorizontal, MapPinCheck, Check } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import GlassPanel, { PanelLabel } from '../../components/ui/GlassPanel';
import Button from '../../components/ui/Button';
import ProgressBar from '../../components/ui/ProgressBar';
import { Select } from '../../components/ui/Field';
import { useAppData } from '../../context/AppDataContext';
import { useToast } from '../../hooks/useToast';
import { parseWorkbook, guessFieldMapping, mapRowsToClients, buildFullAddress } from '../../lib/xlsxImport';
import { geocodeBatch } from '../../lib/geo';

const IMPORT_FIELDS = [
  { key: 'name', label: 'Nom du client', required: true },
  { key: 'address', label: 'Adresse', required: true },
  { key: 'postal_code', label: 'Code postal' },
  { key: 'city', label: 'Ville' },
  { key: 'sector', label: 'Secteur' },
  { key: 'contact', label: 'Contact' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'email', label: 'E-mail' },
  { key: 'notes', label: 'Notes' },
];

export default function ImportPage() {
  const { upsertClientsBatch } = useAppData();
  const toast = useToast();
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const parsed = parseWorkbook(buffer);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(guessFieldMapping(parsed.headers));
  }

  async function runImport() {
    if (!mapping.name || !mapping.address) return toast('Fais correspondre au minimum "Nom" et "Adresse"', 'error');
    setImporting(true);
    setProgress({ done: 0, total: rows.length });
    try {
      const mapped = mapRowsToClients(rows, mapping);
      const geocoded = await geocodeBatch(mapped, buildFullAddress, (done, total) => setProgress({ done, total }));
      const toInsert = mapped.map((c, i) => ({ ...c, lat: geocoded[i]?.lat ?? null, lng: geocoded[i]?.lng ?? null }));
      const inserted = await upsertClientsBatch(toInsert);
      const failed = geocoded.filter((g) => !g).length;
      toast(`${inserted.length} client(s) importé(s)${failed ? `, ${failed} adresse(s) non géolocalisée(s)` : ''}`, 'success');
      setHeaders([]);
      setRows([]);
      setMapping({});
    } catch (e) {
      toast(e.message || "Erreur d'import", 'error');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-7 max-w-3xl mx-auto">
      <PageHeader title="Importer des clients" subtitle="Fichier Excel (.xlsx) contenant ta base clients." />

      <GlassPanel className="p-5 mb-4">
        <PanelLabel icon={Upload}>1. Choisir le fichier</PanelLabel>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          className="text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3.5 file:py-2 file:text-xs file:font-medium file:text-ink hover:file:bg-surface-3/70 file:cursor-pointer"
        />
      </GlassPanel>

      {headers.length > 0 && (
        <GlassPanel className="p-5 mb-4">
          <PanelLabel icon={SlidersHorizontal}>2. Faire correspondre les colonnes</PanelLabel>
          <div className="grid grid-cols-2 gap-3">
            {IMPORT_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-3">
                <span className="text-xs text-ink-muted">
                  {f.label}
                  {f.required ? ' *' : ''}
                </span>
                <Select
                  value={mapping[f.key] || ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
                  className="max-w-[180px]"
                >
                  <option value="">— ignorer —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-ink-faint mt-3">{rows.length} ligne(s) détectée(s).</div>
        </GlassPanel>
      )}

      {headers.length > 0 && (
        <GlassPanel className="p-5">
          <PanelLabel icon={MapPinCheck}>3. Importer et géocoder</PanelLabel>
          <p className="text-xs text-ink-muted mb-4">
            Chaque adresse est géolocalisée automatiquement (nécessaire pour planifier les tournées). Cela peut prendre quelques minutes pour un gros fichier.
          </p>
          <Button variant="primary" onClick={runImport} disabled={importing}>
            <Check size={15} /> {importing ? 'Import en cours…' : `Importer ${rows.length ? `(${rows.length} lignes)` : ''}`}
          </Button>
          {importing && (
            <div className="mt-4">
              <ProgressBar percent={(progress.done / Math.max(1, progress.total)) * 100} />
              <div className="text-[11px] text-ink-faint mt-1.5">
                Géocodage : {progress.done} / {progress.total}
              </div>
            </div>
          )}
        </GlassPanel>
      )}
    </div>
  );
}
