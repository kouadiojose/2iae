#!/usr/bin/env bash
# Mise en ligne du CAMPUS NUMÉRIQUE (service Railway « campus », campus.2iae.com).
# C'est la seule façon de déployer le campus : jamais « railway up » à la main.
#
#   bash campus/scripts/deployer.sh              depuis n'importe quel dossier du dépôt
#   FORCER=1 bash campus/scripts/deployer.sh     même pendant un cours en direct (coupe la visio et l'enregistrement)
#   SIMULATION=1 bash campus/scripts/deployer.sh toutes les vérifications et la construction, sans rien envoyer
#
# Ce que le script garantit, dans l'ordre :
#   1. on envoie le dossier campus/ d'un commit (jamais la racine : c'est le site www.2iae.com) ;
#   2. ce commit contient tout origin/main (pas de retour en arrière sur le travail d'une autre session) ;
#   3. aucun cours n'est en direct (le service a un volume : Railway coupe l'ancien campus avant de
#      démarrer le nouveau, la visio et l'enregistrement du replay s'interrompent) ;
#   4. le campus se construit en local, avec son script de migration, avant d'être envoyé ;
#   5. le déploiement est suivi jusqu'au bout : /api/health doit répondre 200.
set -euo pipefail

PROJET="a33efe7b-a99d-4c0f-b0d0-2968b51496e9"
ENVIRONNEMENT="production"
SERVICE="campus"
URL="https://campus.2iae.com"

echec() { printf '\n✖ %s\n\n' "$1" >&2; exit 1; }
etape() { printf '\n· %s\n' "$1"; }

RACINE="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$RACINE"
[ -f campus/railway.json ] && [ -f campus/server/scripts/migrate.ts ] || echec "Dossier campus/ introuvable dans $RACINE."
command -v railway >/dev/null || echec "Le CLI Railway n'est pas installé (npm i -g @railway/cli)."

etape "1/5 Commit à envoyer"
if [ -n "$(git status --porcelain -- campus)" ]; then
  git status --short -- campus | head -20
  echec "campus/ a des modifications non commitées. Commitez-les (ou mettez-les de côté) : on ne déploie qu'un commit."
fi
COMMIT="$(git rev-parse --short HEAD)"
echo "  $COMMIT $(git log -1 --format=%s)"

etape "2/5 origin/main est bien inclus"
git fetch -q origin main || echec "Impossible de lire origin/main (réseau ?)."
if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "  Commits de main absents de votre version :"
  git log --oneline HEAD..origin/main | head -10 | sed 's/^/    /'
  echec "Votre version ne contient pas tout origin/main. Faites d'abord : git merge origin/main (puis testez et commitez)."
fi
echo "  OK"

etape "3/5 Aucun cours en direct"
if curl -fsS -m 15 -o /dev/null "$URL/api/health"; then
  EN_DIRECT="$(curl -fsS -m 15 "$URL/api/public/en-direct" || echo '{"live":"inconnu"}')"
  if ! printf '%s' "$EN_DIRECT" | grep -q '"live":null'; then
    if [ "${FORCER:-}" = "1" ]; then
      echo "  ATTENTION : cours en direct ($EN_DIRECT), déploiement forcé (FORCER=1)."
    else
      echec "Un cours est en direct (ou l'état est illisible) : $EN_DIRECT
  Attendez la fin du cours. En cas d'urgence seulement : FORCER=1 bash campus/scripts/deployer.sh"
    fi
  else
    echo "  OK, aucun cours en direct"
  fi
else
  echo "  Le campus ne répond pas : déploiement de secours (aucun cours ne peut être en direct)."
fi

etape "4/5 Construction locale"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git archive HEAD campus | tar -x -C "$TMP"
[ -d campus/node_modules ] || (cd campus && npm ci --no-audit --no-fund)
ln -s "$RACINE/campus/node_modules" "$TMP/campus/node_modules"
(cd "$TMP/campus" && npm run build > "$TMP/construction.log" 2>&1) || { tail -30 "$TMP/construction.log"; echec "La construction locale a échoué : rien n'a été envoyé."; }
[ -f "$TMP/campus/dist/index.js" ] && [ -f "$TMP/campus/dist/scripts/migrate.js" ] || echec "Construction incomplète (dist/index.js ou dist/scripts/migrate.js manquant) : rien n'a été envoyé."
# Railway reconstruit lui-même : on n'envoie ni le résultat local ni le lien vers node_modules.
rm -rf "$TMP/campus/dist" "$TMP/campus/node_modules"
echo "  OK"

if [ "${SIMULATION:-}" = "1" ]; then
  printf '\n✔ Simulation réussie (SIMULATION=1) : tout est prêt, rien n'"'"'a été envoyé.\n\n'
  exit 0
fi

etape "5/5 Envoi sur Railway (service $SERVICE) et suivi"
(cd "$TMP/campus" && railway up --service "$SERVICE" --environment "$ENVIRONNEMENT" --project "$PROJET" --ci) > "$TMP/envoi.log" 2>&1 || {
  tail -30 "$TMP/envoi.log"
  echec "Le déploiement a échoué sur Railway. Voir : railway logs --service $SERVICE --environment $ENVIRONNEMENT --project $PROJET"
}
for _ in $(seq 1 30); do
  CODE="$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$URL/api/health" || true)"
  [ "$CODE" = "200" ] && break
  sleep 10
done
[ "${CODE:-}" = "200" ] || echec "Le campus ne répond pas après le déploiement (santé : ${CODE:-aucune réponse}). Voir les journaux Railway."
printf '\n✔ Campus en ligne : commit %s, %s/api/health = 200.\n\n' "$COMMIT" "$URL"
