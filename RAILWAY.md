# Déploiement sur Railway

Guide de déploiement de l'application 2IAE International sur [Railway](https://railway.com).

## 1. Créer le projet

1. Connectez-vous à Railway et cliquez sur **New Project** → **Deploy from GitHub repo**.
2. Sélectionnez ce repository. Railway détecte automatiquement le projet Node.js
   et utilise `railway.json` (build : `npm run build`, démarrage : `npm run start`,
   healthcheck : `/api/health`).

## 2. Ajouter PostgreSQL

1. Dans le projet Railway : **Create** → **Database** → **PostgreSQL**.
2. Sur le service de l'application, onglet **Variables**, ajoutez :

   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ```

   > L'application détecte automatiquement le réseau interne Railway
   > (`*.railway.internal`) et désactive le SSL, qui n'y est pas supporté.
   > Pour forcer un comportement : `DATABASE_SSL=true` ou `DATABASE_SSL=false`.

## 3. Variables d'environnement

Sur le service de l'application, ajoutez :

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | `${{Postgres.DATABASE_URL}}` |
| `SESSION_SECRET` | ✅ | Valeur aléatoire (`openssl rand -hex 32`) |
| `ADMIN_USERNAME` | Recommandé | Nom du compte admin créé au 1er démarrage |
| `ADMIN_PASSWORD` | Recommandé | Mot de passe fort pour le compte admin |
| `ADMIN_EMAIL` | Non | Email du compte admin |
| `OPENAI_API_KEY` | Non | Clé API OpenAI (sans elle, le chatbot renvoie une erreur mais le site fonctionne) |
| `UPLOADS_DIR` | Recommandé | Chemin du volume pour les uploads (voir §5) |
| `APP_URL` | Non | Domaine(s) personnalisé(s) autorisés pour le CORS, séparés par des virgules |

`NODE_ENV=production` est déjà appliqué par le script `npm run start` et `PORT`
est injecté automatiquement par Railway.

## 4. Initialiser le schéma de la base

Après le premier déploiement, appliquez le schéma Drizzle. En local :

```bash
# Utilisez l'URL PUBLIQUE de la base (onglet "Connect" du service Postgres)
DATABASE_URL="postgresql://..." npm run db:push
```

ou via le CLI Railway : `railway run npm run db:push`.

Les tables de session sont créées automatiquement au démarrage.
Pour importer les données existantes, utilisez les fichiers SQL d'export du
repo avec `psql "$DATABASE_URL" -f export_database_2iae_updated.sql`.

## 5. Persistance des uploads (important)

Le système de fichiers de Railway est **éphémère** : tout fichier uploadé
(images de sliders, galerie…) disparaît à chaque redéploiement. Deux options :

**Option A — Volume Railway (simple) :**
1. Sur le service de l'app : **Settings** → **Volumes** → **Add Volume**,
   monté par exemple sur `/data/uploads`.
2. Ajoutez la variable `UPLOADS_DIR=/data/uploads`.

**Option B — Stockage objet S3-compatible (recommandé à terme) :**
Configurez `DO_SPACES_ENDPOINT`, `DO_SPACES_KEY`, `DO_SPACES_SECRET` et
`DO_SPACES_BUCKET` (DigitalOcean Spaces, Cloudflare R2 ou AWS S3). Les
uploads y sont alors envoyés directement, avec repli sur le disque local
en cas d'échec.

## 6. Domaine personnalisé (optionnel)

1. **Settings** → **Networking** → **Custom Domain** sur le service de l'app.
2. Configurez le CNAME chez votre registrar selon les instructions Railway.
3. Ajoutez le domaine dans `APP_URL` (ex. `https://www.2iae.com`).

## 7. Campus numérique

Le campus numérique (dossier `campus/`) est un **service Railway à part**,
dans le même projet. Le site n'en dépend pas pour fonctionner : il lit la
vitrine publique du campus (`GET <campus>/api/public/vitrine`), la garde en
cache 5 minutes et conserve la **dernière version connue** si le campus ne
répond plus. Sans aucune version connue (campus pas encore déployé), les
pages du campus affichent une présentation fixe et le bouton « Campus
Numérique » de l'en-tête garde l'adresse actuelle, `https://campus.groupe2iae.com`.

Ce que le site affiche : le bandeau « ● EN DIRECT » ou « Dans 6 jours… »
au-dessus de l'en-tête, la section « Au campus numérique » de l'accueil, les pages
`/campus-numerique`, `/campus-numerique/cours/:slug` et
`/campus-numerique/formateurs/:slug` (titre, description et vignette de
partage servis par le serveur, entrées au sitemap et au `llms.txt`).

Variables du **service du site** :

| Variable | Obligatoire | Description |
|---|---|---|
| `CAMPUS_URL` | Recommandé | Adresse publique du campus, sans `/` final (défaut : `https://campus.2iae.com`). Sert aux liens, aux photos et au bouton « Accéder au campus ». |
| `CAMPUS_INTERNAL_URL` | Non | Adresse du campus sur le réseau privé Railway, pour la lecture de la vitrine (ex. `http://campus.railway.internal:8080`, le port étant celui du service campus). Plus rapide, sans passer par Internet. |
| `CAMPUS_WEBHOOK_SECRET` | Recommandé | Secret partagé avec le campus (`openssl rand -hex 32`). Sans lui, `POST /api/campus/rafraichir` répond 503 et le site ne se met à jour qu'à l'expiration du cache (5 min). |

Variables du **service campus**, à accorder :

```
SITE_WEBHOOK_URL=https://www.2iae.com          # ou l'adresse privée du site
CAMPUS_WEBHOOK_SECRET=<la même valeur que sur le site>
```

Le campus prévient le site à chaque publication (`POST /api/campus/rafraichir`,
en-tête `X-Campus-Signature: sha256=<HMAC-SHA256 du corps>`). Le site vérifie
la signature sur le corps brut, refuse un message de plus de 5 minutes ou déjà
reçu, puis relit la vitrine aussitôt.

Vérification : `https://www.2iae.com/api/campus/vitrine` renvoie la vitrine
(`"aJour": true`), ou `{"indisponible": true, …}` tant que le campus n'a jamais
répondu. Les journaux du site signalent « Campus numérique injoignable » une
seule fois par panne.

## 8. Vérification post-déploiement

1. `https://votre-app.up.railway.app/api/health` → `{"status":"ok"}`
2. Page d'accueil et images des sliders
3. Connexion admin (`/admin`) — changez le mot de passe par défaut si
   `ADMIN_PASSWORD` n'a pas été défini
4. Chatbot (si `OPENAI_API_KEY` configurée)
5. Upload d'une image puis redéploiement → l'image doit survivre (volume OK)

## Dépannage

- **Crash au démarrage, erreur SSL Postgres** : vérifiez `DATABASE_SSL`
  (mettre `false` si vous utilisez l'URL interne Railway, `true` pour une
  base managée externe).
- **Session perdue après login** : `SESSION_SECRET` doit être défini et
  stable entre les déploiements.
- **Images disparues après redéploiement** : le volume n'est pas monté ou
  `UPLOADS_DIR` ne pointe pas dessus (voir §5).
- Consultez les logs : onglet **Deployments** → **View Logs**.
