# Tournée.ai — Guide de déploiement

Application web premium de planification de tournées commerciales, avec carte 3D photoréaliste : importe ta base clients, choisis un secteur et des jours de déplacement, l'app te génère un itinéraire optimisé par jour avec suggestions de visites annexes à proximité.

**Stack** : React + Vite, Tailwind CSS, Framer Motion, Supabase (base de données + authentification), Google Maps Photorealistic 3D Maps.

---

## Déploiement en 5 étapes (25 minutes)

### Étape 1 — Créer le dépôt GitHub

1. Sur [github.com](https://github.com), **New repository**
2. Nommez-le `tournee-commerciale` (ou autre nom), **Public** (requis pour Vercel gratuit)
3. Pousse tous les fichiers de ce dossier (avec `git` en ligne de commande — l'upload web GitHub ne gère pas bien les dossiers comme `src/`)

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TON-COMPTE/tournee-commerciale.git
git push -u origin main
```

### Étape 2 — Créer le projet Supabase

1. Sur [supabase.com](https://supabase.com), créez un projet (gratuit)
2. Dans **SQL Editor**, collez le contenu de [`supabase-schema.sql`](supabase-schema.sql) et exécutez-le — cela crée les tables `clients`, `tours`, `user_settings` avec sécurité par ligne (chaque utilisateur ne voit que ses propres données)
3. Dans **Authentication > Providers**, laissez **Email** activé. Dans **Authentication > URL Configuration**, ajoutez l'URL de ton site Vercel (étape 5) dans *Redirect URLs* une fois déployé
4. Dans **Project Settings > API**, notez :
   - **Project URL**
   - **anon public key**

### Étape 3 — Créer la clé Google Maps

1. Sur [console.cloud.google.com](https://console.cloud.google.com), créez un projet
2. Activez ces 4 API (menu **API et services > Bibliothèque**) :
   - **Maps JavaScript API**
   - **Map Tiles API** (nécessaire pour la carte 3D photoréaliste)
   - **Geocoding API**
   - **Directions API**
3. Un compte de facturation est requis (carte bancaire), même pour rester dans le quota gratuit mensuel généreux (10 000 appels gratuits/mois et par API avec le tarif Google actuel)
4. Créez une clé API (**Identifiants > Créer des identifiants > Clé API**)
5. **Restreignez-la** (important) : *Restrictions relatives aux applications* → *Sites Web* → ajoutez `https://ton-projet.vercel.app/*` (et `http://localhost:*` pour tester en local). *Restrictions de l'API* → limitez aux 4 API activées ci-dessus

> ⚠️ **La carte 3D photoréaliste (Photorealistic 3D Maps) est une API Google encore récente.** Elle fonctionne dans les navigateurs à jour avec WebGL2 (Chrome, Edge récents). Si Google fait évoluer l'interface de cette API, le composant `src/components/map/Map3D.jsx` pourrait nécessiter un ajustement — les erreurs de rendu sont interceptées et affichent un message clair plutôt que de casser le reste de l'application.

### Étape 4 — Configurer `src/lib/config.js`

Ouvrez [`src/lib/config.js`](src/lib/config.js) et remplacez les 3 valeurs par celles obtenues aux étapes 2 et 3 :

```js
SUPABASE_URL: 'https://xxxxx.supabase.co',
SUPABASE_ANON_KEY: 'sb_publishable_xxxxx',
GOOGLE_MAPS_API_KEY: 'AIzaSyXXXXXXXXXXXXXXXXXXXX',
```

Commite et pousse ce changement sur GitHub.

### Étape 5 — Déployer sur Vercel

1. Sur [vercel.com](https://vercel.com), connectez-vous avec GitHub
2. **Add New Project** → sélectionnez `tournee-commerciale`
3. Vercel détecte automatiquement le framework **Vite** (build `npm run build`, dossier `dist`) → **Deploy**
4. Une fois en ligne, ajoutez l'URL `https://ton-projet.vercel.app` dans les *Redirect URLs* Supabase (étape 2.3) et dans les restrictions de la clé Google Maps (étape 3.5) si ce n'est pas déjà fait

✅ Ton app est en ligne. Connecte-toi avec un lien magique envoyé par e-mail (pas de mot de passe).

### Tester en local avant de déployer

```bash
npm install
npm run dev
```

---

## Utilisation

1. **Réglages** — renseigne ton adresse de départ (domicile/bureau) et tes préférences (heure de départ, durée de visite moyenne, rayon de suggestion)
2. **Importer** — dépose ton fichier Excel (.xlsx) de clients, fais correspondre les colonnes (nom, adresse, secteur...), lance l'import : chaque adresse est géolocalisée automatiquement
3. **Planifier** — choisis un secteur, ajoute les jours de déplacement, coche les clients à voir, clique **Générer la tournée** : l'app répartit les clients par jour, optimise l'ordre de visite (itinéraire routier réel via Google Directions) et te propose des clients proches à ajouter — le tout visualisé sur une carte 3D avec survol cinématique
4. **Mes tournées** — retrouve les tournées enregistrées, clique dessus pour les recharger sur la carte

### Format du fichier Excel attendu

Une ligne par client, avec au minimum une colonne **nom** et une colonne **adresse**. Colonnes reconnues automatiquement si présentes : Nom, Adresse, Code postal, Ville, Secteur, Contact, Téléphone, E-mail, Notes. L'étape d'import permet de corriger la correspondance si la détection automatique se trompe.

---

## Fonctionnalités

- 🌍 Carte 3D photoréaliste (Google Photorealistic 3D Maps) avec survol cinématique de la tournée
- 📥 Import Excel (.xlsx) de la base clients avec géocodage automatique des adresses
- 🗺️ Génération de tournées par secteur et par jour, avec répartition géographique équilibrée
- 🧭 Optimisation de l'ordre de visite (Google Directions API) et planning horaire estimé
- 💡 Suggestions de visites annexes à proximité de l'itinéraire du jour
- 🖊️ Ajustement manuel des clients à visiter, ajout de suggestions en un clic
- 💾 Sauvegarde des tournées, historique consultable et rechargeable
- 👥 Gestion manuelle des clients (ajout, édition, suppression)
- 🌗 Thème clair / sombre, interface "verre dépoli" avec micro-animations

## Limites du MVP (pistes d'évolution)

- L'ordre de visite est optimisé automatiquement mais n'est pas réordonnable manuellement (glisser-déposer) pour l'instant
- Sur la carte, le tracé entre les étapes suit les points de passage (ligne géodésique) plutôt que le tracé routier détaillé — les distances/durées affichées, elles, viennent bien de l'itinéraire routier réel (Google Directions)
- Pas d'import CSV pour l'instant (Excel .xlsx uniquement)
- Le géocodage est mono-pays (France) — adapter la région dans `src/lib/geo.js` si besoin

---

## Coûts

| Service | Coût |
|---|---|
| GitHub | Gratuit |
| Vercel | Gratuit |
| Supabase | Gratuit jusqu'à 500 Mo / 50 000 utilisateurs actifs |
| Google Maps (3D Maps + Geocoding + Directions + Maps JS) | Gratuit jusqu'à 10 000 appels/mois et par API, puis payant |

Pour un usage individuel (quelques tournées par semaine), rester dans les quotas gratuits est très probable.

---

## Support

En cas de problème, vérifiez :
1. Que `src/lib/config.js` contient bien tes vraies clés (pas les valeurs par défaut)
2. Que les 4 API Google (Maps JavaScript, Map Tiles, Geocoding, Directions) sont activées et que la clé n'est pas restreinte à un domaine différent de celui déployé
3. Que le schéma SQL a bien été exécuté dans Supabase (onglet **Table Editor** doit montrer `clients`, `tours`, `user_settings`)
4. Que ton navigateur supporte WebGL2 (nécessaire pour la carte 3D)
5. La console du navigateur (F12) pour le détail des erreurs
