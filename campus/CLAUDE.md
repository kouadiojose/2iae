# Campus numérique (campus.2iae.com)

Lire d'abord `../CLAUDE.md` : règles de mise en ligne communes au site et au campus.

- Mettre en ligne : `bash campus/scripts/deployer.sh` (seule méthode ; refuse pendant un cours en direct).
- Vérifier : `npx tsc --noEmit -p .` puis `npm run build` (le build commence par `scripts/garde-service.mjs`).
- Base : PostgreSQL, schéma `campus` (Drizzle). Les migrations SQL de `migrations/` passent au démarrage
  (`node dist/scripts/migrate.js`), avant le serveur : une migration doit rester idempotente.
- Conception et vocabulaire : `CONCEPTION.md`. Réglages Railway : `RAILWAY.md`.
- Personnel vouvoyé, étudiants tutoyés, dans toute l'interface et les e-mails.
