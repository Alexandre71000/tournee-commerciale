import { useEffect, useState } from 'react';
import { Home, Clock, Check } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import GlassPanel, { PanelLabel } from '../../components/ui/GlassPanel';
import Field, { Input } from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import { useAppData } from '../../context/AppDataContext';
import { useToast } from '../../hooks/useToast';
import { geocodeAddress } from '../../lib/geo';

export default function SettingsPage() {
  const { settings, saveSettings } = useAppData();
  const toast = useToast();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(settings), [settings]);

  function set(field, transform = (v) => v) {
    return (e) => setForm((f) => ({ ...f, [field]: transform(e.target.value) }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      let lat = settings.home_lat;
      let lng = settings.home_lng;
      const address = (form.home_address || '').trim();
      if (address && address !== settings.home_address) {
        const geo = await geocodeAddress(address);
        if (!geo) {
          toast("Adresse de départ introuvable — vérifie l'orthographe", 'error');
          setSaving(false);
          return;
        }
        lat = geo.lat;
        lng = geo.lng;
      }
      await saveSettings({ ...form, home_address: address, home_lat: lat, home_lng: lng });
      toast('Réglages enregistrés', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-7 max-w-2xl mx-auto">
      <PageHeader title="Réglages" subtitle="Point de départ des tournées et paramètres de planification." />

      <GlassPanel className="p-5 mb-4">
        <PanelLabel icon={Home}>Adresse de départ (domicile / bureau)</PanelLabel>
        <Input placeholder="12 rue Exemple, 69000 Lyon" value={form.home_address || ''} onChange={set('home_address')} />
      </GlassPanel>

      <GlassPanel className="p-5 mb-4">
        <PanelLabel icon={Clock}>Paramètres de journée</PanelLabel>
        <div className="grid grid-cols-3 gap-3.5 mb-3.5">
          <Field label="Heure de départ">
            <Input type="time" value={form.day_start || ''} onChange={set('day_start')} />
          </Field>
          <Field label="Durée moyenne d'une visite (min)">
            <Input type="number" min={5} step={5} value={form.default_visit_duration_min || ''} onChange={set('default_visit_duration_min', Number)} />
          </Field>
          <Field label="Durée max. d'une journée (h)">
            <Input type="number" min={1} step={0.5} value={form.max_day_hours || ''} onChange={set('max_day_hours', Number)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Pause déjeuner (min)" hint="Placée automatiquement entre 12h et 13h">
            <Input type="number" min={0} step={5} value={form.lunch_break_min ?? ''} onChange={set('lunch_break_min', Number)} />
          </Field>
          <Field label="Rayon de suggestion de visites annexes (km)">
            <Input type="number" min={1} step={1} value={form.suggestion_radius_km || ''} onChange={set('suggestion_radius_km', Number)} />
          </Field>
        </div>
      </GlassPanel>

      <Button variant="primary" onClick={handleSave} disabled={saving}>
        <Check size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </div>
  );
}
