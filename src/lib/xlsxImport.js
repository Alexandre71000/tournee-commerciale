import * as XLSX from 'xlsx';

const FIELD_GUESSES = {
  name: ['nom', 'name', 'client', 'société', 'societe', 'raison sociale', 'entreprise'],
  address: ['adresse', 'address', 'adresse postale', 'rue'],
  city: ['ville', 'city', 'commune'],
  postal_code: ['cp', 'code postal', 'postal', 'zip'],
  sector: ['secteur', 'zone', 'région', 'region', 'territoire'],
  contact: ['contact', 'interlocuteur', 'responsable'],
  phone: ['téléphone', 'telephone', 'tel', 'phone', 'mobile'],
  email: ['email', 'e-mail', 'mail'],
  notes: ['notes', 'commentaire', 'remarque'],
};

export function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

// Devine automatiquement la correspondance colonne Excel -> champ client.
export function guessFieldMapping(headers) {
  const mapping = {};
  const normalized = headers.map((h) => ({ raw: h, norm: h.toLowerCase().trim() }));
  for (const [field, candidates] of Object.entries(FIELD_GUESSES)) {
    const match = normalized.find((h) => candidates.some((c) => h.norm === c || h.norm.includes(c)));
    if (match) mapping[field] = match.raw;
  }
  return mapping;
}

// Transforme les lignes brutes en objets client, selon le mapping colonne -> champ choisi par l'utilisateur.
export function mapRowsToClients(rows, mapping) {
  return rows
    .map((row) => {
      const c = {};
      for (const [field, header] of Object.entries(mapping)) {
        if (!header) continue;
        const v = row[header];
        c[field] = v === undefined || v === null ? '' : String(v).trim();
      }
      return c;
    })
    .filter((c) => c.name || c.address);
}

export function buildFullAddress(client) {
  return [client.address, client.postal_code, client.city].filter(Boolean).join(', ');
}
