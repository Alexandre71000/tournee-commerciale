import { useNavigate } from 'react-router-dom';
import { Trash2, ListChecks, MapPin, Calendar } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import GlassPanel from '../../components/ui/GlassPanel';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { useAppData } from '../../context/AppDataContext';
import { useToast } from '../../hooks/useToast';

export default function ToursPage() {
  const { tours, deleteTour } = useAppData();
  const navigate = useNavigate();
  const toast = useToast();

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm('Supprimer cette tournée ?')) return;
    try {
      await deleteTour(id);
      toast('Tournée supprimée', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-7 max-w-3xl mx-auto">
      <PageHeader title="Mes tournées" subtitle="Tournées enregistrées précédemment." />

      <GlassPanel className="overflow-hidden">
        {tours.length === 0 ? (
          <EmptyState icon={ListChecks} title="Aucune tournée enregistrée" hint="Génère et enregistre une tournée depuis la page Planifier." />
        ) : (
          <div className="divide-y divide-border/8">
            {tours.map((t) => {
              const totalKm = (t.days || []).reduce((s, d) => s + (d.totalDistanceM || 0), 0) / 1000;
              const totalStops = (t.days || []).reduce((s, d) => s + (d.stops || []).length, 0);
              return (
                <div
                  key={t.id}
                  onClick={() => navigate('/planifier', { state: { tour: t } })}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-surface-3/40 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="flex items-center gap-3 text-[11px] text-ink-faint mt-1">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={11} /> {formatDateFR(t.start_date)} → {formatDateFR(t.end_date)}
                      </span>
                      <span>{totalStops} visite(s)</span>
                      <span>{totalKm.toFixed(0)} km</span>
                    </div>
                  </div>
                  {t.sector && (
                    <Badge tone="accent" icon={MapPin}>
                      {t.sector}
                    </Badge>
                  )}
                  <button
                    onClick={(e) => handleDelete(e, t.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-faint hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}

function formatDateFR(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
