# Base de données 2IAE

## Rapatriement DigitalOcean → Railway (2026-08-29)

Le seed du dépôt avait été construit à partir de vieux exports SQL partiels,
pas de la base DigitalOcean en production : **382 lignes** manquaient sur
Railway (63 contacts, 299 messages de chat, 8 actualités, 8 bannières,
2 projets, 5 tarifs, 1 filière). La vraie base vivait dans **`groupe2iae-db`**
sur le cluster DO — pas dans `defaultdb`, la base de l'URL de connexion
par défaut.

Le tout a été rapatrié le 2026-08-29 avec `scripts/copy-legacy-db.js`
(insertion seule, `ON CONFLICT (id) DO NOTHING` — le contenu ajouté depuis
la migration n'a pas été touché). Audit final : 0 ligne manquante sur
toutes les tables. Les visuels encore hébergés sur DigitalOcean Spaces sont
recopiés sur le volume par le rapatriement automatique
(`server/medias/rapatriement.ts`, toutes les 30 minutes).

## Fichiers

| Fichier | Rôle |
|---|---|
| `schema.sql` | Schéma complet des 16 tables, idempotent (`CREATE TABLE IF NOT EXISTS`). Reflet de `shared/schema.ts`, qui reste la source de vérité. |
| `seed.sql` | Contenu de référence (38 lignes), idempotent (`ON CONFLICT DO NOTHING`). Généré par `scripts/build-seed.py`. |
| `legacy-exports/` | Anciens exports du site, conservés pour référence. **Ne plus les exécuter** (voir ci-dessous). |

## Utilisation

```bash
npm run db:migrate    # schéma + seed (le seed ne s'applique qu'une fois)
npm run db:seed       # force le rejeu du seed
```

`npm run db:migrate` tourne automatiquement avant chaque déploiement Railway
(`preDeployCommand` dans `railway.json`). Le schéma est rejoué à chaque fois —
il est sans effet de bord. Le seed est enregistré dans la table `_migrations`
et n'est plus rejoué ensuite : sans cela, un contenu supprimé volontairement
depuis l'admin réapparaîtrait au déploiement suivant.

## Pourquoi ne pas rejouer `legacy-exports/`

Ces fichiers étaient inutilisables tels quels :

1. **INSERT positionnels.** L'ordre des colonnes de `news` diffère entre les
   exports (`slug` en dernier) et `shared/schema.ts` (`slug` en 3e position).
   Un INSERT positionnel écrivait donc le slug dans `summary`.
2. **Clés étrangères violées.** `created_by` / `updated_by` valaient `''` au
   lieu de `NULL` ; la chaîne vide ne correspond à aucun `admin_users.id` et
   faisait échouer l'import entier.
3. **Types incohérents.** `"order"` était exporté en entier alors que la
   colonne est `TEXT` dans le schéma.
4. **Sources contradictoires.** `database-export-complete.sql` et
   `database_export_complete.sql` (tiret contre souligné) avaient des contenus
   différents, et aucun ne couvrait toutes les tables.
5. **Découpage sur `;`.** L'ancien `migrate-production.js` séparait les requêtes
   sur les points-virgules, ce qui coupait au milieu des textes en contenant —
   par exemple le résumé d'actualité « Les votes se poursuivent ; N'oubliez pas ! ».

`schema.sql` et `seed.sql` corrigent ces cinq points.

## Régénérer le seed

```bash
python3 scripts/build-seed.py   # relit legacy-exports/ et réécrit db/seed.sql
```
