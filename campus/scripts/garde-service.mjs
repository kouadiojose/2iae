#!/usr/bin/env node
// Garde-fou de construction du CAMPUS NUMÉRIQUE (dossier campus/).
//
// Tourne au tout début de « npm run build ». Sur Railway, le campus ne se
// construit que pour le service « campus » : envoyé dans un autre service
// (le site « 2iae », par exemple), la construction s'arrête avant le
// déploiement et la version en ligne reste en place. Voir ../CLAUDE.md.
const service = process.env.RAILWAY_SERVICE_NAME;
if (service && service !== "campus") {
  console.error(
    [
      "",
      `✖ CONSTRUCTION ARRÊTÉE : ce dossier est le CAMPUS NUMÉRIQUE (campus/), mais Railway le construit pour le service « ${service} ».`,
      "",
      "  · Le site www.2iae.com se met en ligne tout seul depuis GitHub (push sur main), service « 2iae ».",
      "  · Le campus se met en ligne UNIQUEMENT avec : bash campus/scripts/deployer.sh (service « campus »).",
      "",
      "  La version en ligne n'a pas été touchée. Voir CLAUDE.md à la racine du dépôt.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
