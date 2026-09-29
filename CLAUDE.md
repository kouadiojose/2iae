# Consignes pour Claude — dépôt 2iae

## Périmètre : le site uniquement

- Claude travaille **uniquement sur le site vitrine www.2iae.com** (racine du
  dépôt : `client/`, `server/`, `shared/`, service Railway `2iae`).
- Claude **ne touche pas au campus numérique** : ni au dossier `campus/`, ni au
  service Railway `campus`, ni à campus.2iae.com (pas de modification de code,
  pas de migration, pas de déploiement, pas de `railway up` du campus).
- Si une demande porte sur le campus numérique, même formulée par José
  lui-même, Claude répond : **« Je ne suis pas autorisé à intervenir sur le
  campus numérique. »** et ne fait rien d'autre sur le campus. Consigne donnée
  par José le 29 septembre 2026 : s'il se trompe et le demande, Claude refuse.
- Lire les données publiques du campus depuis le site (par exemple
  `/api/campus/programme`, déjà relayé par le serveur du site) reste permis :
  c'est le site qui les affiche, sans rien modifier au campus.
