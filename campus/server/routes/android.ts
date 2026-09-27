// L'application Android du campus (Trusted Web Activity, projet dans android/).
//
//   GET /.well-known/assetlinks.json → le lien de confiance entre l'application
//       et campus.2iae.com : sans lui, Chrome affiche une barre d'adresse en
//       haut de l'application.
//   GET /android/campus-2iae.apk     → l'APK à installer, téléchargé depuis la
//       page /android (client/public/android/, mis à jour par android/LISEZMOI.md).
//
// Empreintes : celle de la clé 2IAE (APK direct) est ici. Si l'application
// passe par le Play Store, Google la signe avec sa propre clé : ajouter son
// empreinte SHA-256 (Play Console → Intégrité de l'application) dans la
// variable ANDROID_EMPREINTES, séparées par des virgules, sans redéployer le code.
import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";

export const PAQUET_ANDROID = "com.groupe2iae.campus";
const EMPREINTE_CLE_2IAE = "19:D5:19:3E:08:3C:64:57:83:21:B7:B2:46:79:98:CE:36:74:19:C7:F6:D3:4F:64:4C:08:D7:CA:D2:84:B2:E4";
const FORMAT_EMPREINTE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function empreintes(): string[] {
  const env = (process.env.ANDROID_EMPREINTES ?? "")
    .split(",")
    .map((e) => e.trim().toUpperCase())
    .filter((e) => FORMAT_EMPREINTE.test(e));
  return [...new Set([EMPREINTE_CLE_2IAE, ...env])];
}

/** L'APK : dans dist/public en production, dans client/public en développement. */
function cheminApk(): string | null {
  const candidats = [path.resolve(import.meta.dirname, "public", "android", "campus-2iae.apk"), path.resolve(process.cwd(), "client", "public", "android", "campus-2iae.apk")];
  return candidats.find((c) => fs.existsSync(c)) ?? null;
}

export function enregistrerAndroid(app: Express) {
  app.get("/.well-known/assetlinks.json", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: PAQUET_ANDROID, sha256_cert_fingerprints: empreintes() },
      },
    ]);
  });

  app.get("/android/campus-2iae.apk", (_req, res) => {
    const fichier = cheminApk();
    if (!fichier) return res.status(404).type("text/plain").send("Application Android indisponible pour le moment.");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", 'attachment; filename="Campus-2IAE.apk"');
    res.sendFile(fichier);
  });
}
