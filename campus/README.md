# Campus numérique 2IAE

La plateforme où se passe la vie scolaire du Groupe Écoles 2IAE International :
cours en direct dans les cinq salles de conférence (Riviera, Yopougon,
Yamoussoukro, Azaguié, M'Batto) et en ligne, devoirs et interrogations,
notes, replays, messagerie avec les formateurs, pilotage de la vie scolaire,
assistant pédagogique IA. Conçue d'abord pour le téléphone.

- Conception, principes et décisions : [CONCEPTION.md](./CONCEPTION.md)
- Déploiement sur Railway (même projet que le site) : [RAILWAY.md](./RAILWAY.md)

C'est une application **indépendante** du site vitrine (racine du dépôt) :
son propre `package.json`, sa propre base, son propre service Railway. Le
site lit la vitrine publique du campus (`/api/public/vitrine`) pour annoncer
les cours, les formateurs et les lives.

## Développement

```bash
cd campus
npm install
cp .env.example .env            # puis renseigner DATABASE_URL
npm run db:push:dev             # applique le schéma à la base locale
npx tsx server/scripts/comptes-test.ts   # comptes de test (voir l'en-tête du fichier)
npm run dev                     # http://localhost:5100
```

Vérifications : `npm run check` (TypeScript), `npm run build`.

## Base de données

Toutes les tables vivent dans le schéma PostgreSQL `campus`. Après une
modification de `shared/schema/*.ts` : `npm run db:generate` (crée la
migration SQL dans `migrations/`), puis `npm run db:migrate:dev`. En
production, Railway applique les migrations avant chaque déploiement
(`preDeployCommand`).
