# Campus numérique sur Railway

Le campus vit dans le **même projet Railway que le site** (« Groupe 2iae »),
comme un service à part : le site et le campus se déploient, redémarrent et
grandissent indépendamment, mais partagent le réseau privé du projet.

```
Projet « Groupe 2iae » (production)
├─ 2iae              site vitrine www.2iae.com        (racine du dépôt)
├─ Postgres          base du site
├─ campus            campus numérique                 (dossier campus/)
├─ Postgres-Campus   base du campus (données scolaires isolées)
└─ volume /data      fichiers du campus (devoirs, ressources)
```

## 1. Créer les services (déjà fait une fois avec le CLI)

```bash
railway link --project <id du projet Groupe 2iae> --environment production
railway add --database postgres                # renommer ensuite en « Postgres-Campus »
railway add --service campus
railway volume add --service campus --mount-path /data
railway domain --service campus                # domaine *.up.railway.app
```

## 2. Variables du service `campus`

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | `${{Postgres-Campus.DATABASE_URL}}` |
| `SESSION_SECRET` | valeur aléatoire (`openssl rand -hex 32`) |
| `CAMPUS_ADMIN_EMAIL` / `CAMPUS_ADMIN_PASSWORD` | compte de la direction créé au premier démarrage |
| `CAMPUS_PUBLIC_URL` | `https://campus.2iae.com` (ou le domaine Railway) |
| `UPLOADS_DIR` | `/data/uploads` |
| `SITE_URL` | `https://www.2iae.com` |
| `SITE_WEBHOOK_URL` | `http://${{2iae.RAILWAY_PRIVATE_DOMAIN}}:${{2iae.PORT}}` |
| `CAMPUS_WEBHOOK_SECRET` | même valeur que sur le service `2iae` |
| `ANTHROPIC_API_KEY` | `${{2iae.ANTHROPIC_API_KEY}}` (clé partagée avec le site) |
| `RESEND_API_KEY` | `${{2iae.RESEND_API_KEY}}` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` |
| `DAILY_API_KEY` | clé Daily.co (visio intégrée) — sans elle : scène de démonstration ou lien externe |
| `CAMPUS_DEMO` | `true` pour charger les données de démonstration |

## 3. Variables du service `2iae` (site)

| Variable | Valeur |
|---|---|
| `CAMPUS_URL` | adresse publique du campus |
| `CAMPUS_INTERNAL_URL` | `http://${{campus.RAILWAY_PRIVATE_DOMAIN}}:${{campus.PORT}}` |
| `CAMPUS_WEBHOOK_SECRET` | même valeur que sur le campus |

## 4. Déployer

- **Depuis le poste (immédiat)** : `cd campus && railway up --service campus`.
  Railway lit `campus/railway.json` : build `npm run build`, migrations
  `npm run db:migrate` avant le démarrage, santé `/api/health`.
- **Depuis GitHub (automatique, une fois le code sur `main`)** : réglages du
  service `campus` → Source → dépôt `kouadiojose/2iae`, branche `main`,
  **Root Directory `/campus`**. Les chemins surveillés (`/campus/**`) évitent
  de redéployer le campus quand seul le site change.

## 5. Domaine personnalisé

`railway domain campus.2iae.com --service campus` renvoie l'enregistrement
DNS (CNAME) à créer chez le registrar du domaine 2iae.com. Ensuite, mettre
`CAMPUS_PUBLIC_URL` et, sur le site, `CAMPUS_URL` à `https://campus.2iae.com`.

## 6. Vérifier

1. `https://<campus>/api/health` → `{"status":"ok"}`
2. Connexion avec le compte de la direction, puis import des étudiants et
   impression des fiches de connexion (Pilotage → Comptes).
3. `https://<campus>/api/public/vitrine` → la vitrine lue par le site.
4. Sur le site, `/campus-numerique` affiche les cours annoncés.

## Exploitation

- Une seule réplique : le temps réel (SSE) est en mémoire.
- Sauvegardes : activer les sauvegardes du service Postgres-Campus.
- Journaux : `railway logs --service campus`.
