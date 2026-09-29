# Dépôt 2IAE : le site www.2iae.com et le campus numérique

Deux applications dans ce dépôt, deux services Railway dans le même projet
(« Groupe 2iae », environnement `production`) :

| Dossier | Application | Service Railway | Mise en ligne |
|---|---|---|---|
| racine du dépôt | site vitrine www.2iae.com | `2iae` | **automatique** à chaque push sur `main` (GitHub) |
| `campus/` | campus numérique campus.2iae.com | `campus` | **uniquement** `bash campus/scripts/deployer.sh` |

## Règles de mise en ligne (toutes les sessions, sans exception)

1. **Ne jamais lancer `railway up` depuis la racine du dépôt**, vers aucun
   service. Le site se met en ligne tout seul quand `main` change.
2. **Le campus se déploie seulement avec `bash campus/scripts/deployer.sh`.**
   Jamais `railway up` à la main, jamais `railway redeploy` ni un changement de
   source du service. Le 29 septembre 2026, la racine (le site) a été envoyée
   dans le service `campus` : le campus est resté hors ligne vingt minutes.
   Le service a un volume : Railway arrête l'ancien campus avant de démarrer le
   nouveau, donc une version qui ne démarre pas coupe le campus.
3. **Jamais pendant un cours en direct** (le script le vérifie) : un
   redéploiement coupe la visio des cinq salles et l'enregistrement du replay.
   Les cours ont lieu en journée, heure d'Abidjan (GMT).
4. **Partir de `main` à jour** : `git fetch origin main && git merge origin/main`
   avant de déployer. Le script refuse une version qui ne contient pas tout
   `origin/main` : sinon on effacerait en ligne le travail d'une autre session.
5. **Fusionner dans `main` ce qui est mis en ligne**, pour le site comme pour le
   campus : `main` est la référence commune de toutes les sessions.
6. Ne pas modifier les variables Railway de production sans nécessité : chaque
   changement redéploie le service (et coupe le campus quelques instants).

Garde-fous automatiques : la construction s'arrête avant tout déploiement si le
site est construit pour le service `campus` (`scripts/garde-service.mjs`) ou le
campus pour un autre service (`campus/scripts/garde-service.mjs`). La version
en ligne reste alors en place.

Détails du campus sur Railway (variables, buckets, domaine) : `campus/RAILWAY.md`.

## Vérifier avant de pousser

- Site (racine) : `npx tsc --noEmit -p .` puis `npm run build`.
- Campus : `cd campus && npx tsc --noEmit -p . && npm run build`.

## Secrets

Jamais dans le dépôt ni dans un message : clés (Daily, Resend, Anthropic,
buckets), mots de passe, liens et codes d'installation des écrans de salle,
clé de signature de l'application Android. Les variables vivent sur Railway.
