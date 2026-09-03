import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, MapPinCheck, MapPinX, RefreshCw, Users } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import GlassPanel from '../../components/ui/GlassPanel';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Field';
import ClientModal from './ClientModal';
import { useAppData } from '../../context/AppDataContext';
import { useToast } from '../../hooks/useToast';
import { geocodeAddress } from '../../lib/geo';
import { buildFullAddress } from '../../lib/xlsxImport';

export default function ClientsPage() {
  const { clients, deleteClient, upsertClient } = useAppData();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [geocodingId, setGeocodingId] = useState(null);

  const rows = useMemo(
    () => clients.filter((c) => !search || `${c.name} ${c.city || ''} ${c.sector || ''} ${c.address || ''}`.toLowerCase().includes(search.toLowerCase())),
    [clients, search]
  );

  async function handleDelete(id) {
    if (!confirm('Supprimer ce client ?')) return;
    try {
      await deleteClient(id);
      toast('Client supprimé', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleGeocode(client) {
    setGeocodingId(client.id);
    try {
      const geo = await geocodeAddress(buildFullAddress(client));
      if (!geo) return toast('Adresse introuvable', 'error');
      await upsertClient({ id: client.id, lat: geo.lat, lng: geo.lng });
      toast('Client géocodé', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setGeocodingId(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-7 max-w-5xl mx-auto">
      <PageHeader
        title="Clients"
        subtitle="Base de données clients issue de l'import."
        action={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus size={16} /> Ajouter un client
          </Button>
        }
      />

      <GlassPanel className="p-4 mb-4">
        <Input placeholder="Rechercher par nom, ville, secteur…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </GlassPanel>

      <GlassPanel className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="Aucun client" hint="Importe un fichier Excel ou ajoute un client manuellement." />
        ) : (
          <div className="divide-y divide-border/8">
            {rows.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-3/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-ink-faint truncate">{[c.address, c.postal_code, c.city].filter(Boolean).join(', ')}</div>
                </div>
                {c.sector && (
                  <Badge tone="accent" className="hidden sm:inline-flex">
                    {c.sector}
                  </Badge>
                )}
                <div className="hidden md:block text-xs text-ink-muted w-36 truncate">{c.contact || ''}</div>
                {c.lat != null ? (
                  <Badge tone="success" icon={MapPinCheck}>
                    OK
                  </Badge>
                ) : (
                  <button onClick={() => handleGeocode(c)} disabled={geocodingId === c.id}>
                    <Badge tone="warning" icon={geocodingId === c.id ? RefreshCw : MapPinX} className={geocodingId === c.id ? 'animate-pulse' : 'cursor-pointer'}>
                      Géocoder
                    </Badge>
                  </button>
                )}
                <div className="flex gap-1 shrink-0">
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-faint hover:text-ink hover:bg-surface-3 transition-colors"
                    onClick={() => {
                      setEditing(c);
                      setModalOpen(true);
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-faint hover:text-danger hover:bg-danger/10 transition-colors"
                    onClick={() => handleDelete(c.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      <ClientModal open={modalOpen} onClose={() => setModalOpen(false)} client={editing} />
    </div>
  );
}
