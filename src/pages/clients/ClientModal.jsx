import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Field, { Input, Textarea } from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import { geocodeAddress } from '../../lib/geo';
import { buildFullAddress } from '../../lib/xlsxImport';
import { useAppData } from '../../context/AppDataContext';
import { useToast } from '../../hooks/useToast';

const EMPTY = { name: '', sector: '', address: '', postal_code: '', city: '', contact: '', phone: '', email: '', notes: '' };

export default function ClientModal({ open, onClose, client }) {
  const { upsertClient } = useAppData();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(client ? { ...EMPTY, ...client } : EMPTY);
  }, [client, open]);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.address.trim()) return toast('Nom et adresse sont requis', 'error');
    setSaving(true);
    try {
      const payload = { ...form };
      if (!client) delete payload.id;
      const geo = await geocodeAddress(buildFullAddress(payload));
      if (geo) {
        payload.lat = geo.lat;
        payload.lng = geo.lng;
      }
      await upsertClient(payload);
      toast('Client enregistré', 'success');
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? 'Modifier le client' : 'Ajouter un client'}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Nom">
          <Input value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Secteur">
          <Input value={form.sector} onChange={set('sector')} />
        </Field>
        <Field label="Adresse" className="col-span-2">
          <Input value={form.address} onChange={set('address')} placeholder="Numéro et rue" />
        </Field>
        <Field label="Code postal">
          <Input value={form.postal_code} onChange={set('postal_code')} />
        </Field>
        <Field label="Ville">
          <Input value={form.city} onChange={set('city')} />
        </Field>
        <Field label="Contact">
          <Input value={form.contact} onChange={set('contact')} />
        </Field>
        <Field label="Téléphone">
          <Input value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="E-mail" className="col-span-2">
          <Input type="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <Textarea rows={2} value={form.notes} onChange={set('notes')} />
        </Field>
      </div>
    </Modal>
  );
}
