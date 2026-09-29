#!/usr/bin/env node
// Garde-fou de construction du SITE www.2iae.com (racine du dépôt).
//
// Le 29 septembre 2026, la racine du dépôt a été envoyée par erreur dans le
// service Railway « campus » : Railway a construit le site à la place du
// campus, arrêté l'ancien campus (le service a un volume) et le nouveau n'a
// jamais démarré. Le campus est resté hors ligne vingt minutes.
//
// Ce contrôle tourne au tout début de « npm run build » : s'il reconnaît le
// service du campus, la construction s'arrête AVANT le déploiement, et la
// version en ligne reste en place. Voir CLAUDE.md (règles de mise en ligne).
const service = process.env.RAILWAY_SERVICE_NAME ?? "";
const idCampus = "e4db43d5-0ce9-4a9e-8d42-2edc05cdf227";
const signes = [
  service === "campus" && "RAILWAY_SERVICE_NAME=campus",
  process.env.RAILWAY_SERVICE_ID === idCampus && "identifiant du service campus",
  /libreoffice/i.test(process.env.RAILPACK_DEPLOY_APT_PACKAGES ?? "") && "paquets LibreOffice du campus",
].filter(Boolean);

if (signes.length) {
  console.error(
    [
      "",
      "✖ CONSTRUCTION ARRÊTÉE : ce dossier est le SITE www.2iae.com (racine du dépôt),",
      `  mais Railway le construit pour le service du CAMPUS (${signes.join(", ")}).`,
      "",
      "  · Le site se met en ligne tout seul depuis GitHub (push sur main), service « 2iae ».",
      "  · Le campus se met en ligne UNIQUEMENT avec : bash campus/scripts/deployer.sh",
      "",
      "  La version en ligne du campus n'a pas été touchée. Voir CLAUDE.md.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
