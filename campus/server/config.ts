// Lecture centralisée de la configuration. Aucune variable n'est obligatoire
// en développement ; en production seules DATABASE_URL et SESSION_SECRET le
// sont. Chaque intégration (visio, IA, e-mail, push, site) se met en veille
// proprement quand sa clé manque.
import path from "path";

function env(nom: string, ...alias: string[]): string | undefined {
  for (const n of [nom, ...alias]) {
    const v = process.env[n]?.trim();
    if (v) return v;
  }
  return undefined;
}

function sansSlashFinal(url: string | undefined): string | undefined {
  return url?.replace(/\/+$/, "");
}

export const estProduction = process.env.NODE_ENV === "production";

export const config = {
  port: Number(process.env.PORT) || 5100,
  sessionSecret: env("SESSION_SECRET") || "dev-campus-2iae-ne-pas-utiliser-en-production",

  /** Adresse publique du campus (liens dans les e-mails, QR codes, vitrine). */
  urlCampus:
    sansSlashFinal(env("CAMPUS_PUBLIC_URL", "APP_URL")) ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:5100"),

  /** Site vitrine du groupe : origines autorisées (CORS) et webhook de rafraîchissement. */
  urlSite: sansSlashFinal(env("SITE_URL")) || "https://www.2iae.com",
  originesSite: (env("SITE_ORIGINS") || "https://www.2iae.com,https://2iae.com")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  /** Adresse (souvent interne Railway) où prévenir le site qu'une publication a changé. */
  webhookSite: sansSlashFinal(env("SITE_WEBHOOK_URL")),
  /** Secret partagé avec le site (signature HMAC du webhook). */
  secretSite: env("CAMPUS_WEBHOOK_SECRET", "SITE_WEBHOOK_SECRET"),

  /** Stockage des fichiers déposés : monter un volume Railway ici. */
  dossierFichiers: path.resolve(env("UPLOADS_DIR") || path.join(process.cwd(), "uploads")),
  tailleMaxFichierMo: Number(env("UPLOAD_MAX_MB")) || 25,

  visio: {
    dailyCle: env("DAILY_API_KEY"),
    /** Sous-domaine Daily (ex. « groupe2iae » pour groupe2iae.daily.co) — facultatif, déduit de l'API sinon. */
    dailyDomaine: env("DAILY_DOMAIN"),
    jitsiDomaine: env("JITSI_DOMAIN"),
    /** Serveurs TURN pour la visio intégrée (réseaux mobiles derrière CGNAT), ex. turns:turn.example.com:443?transport=tcp */
    turnUrls: (env("TURN_URLS") || "").split(",").map((u) => u.trim()).filter(Boolean),
    turnUtilisateur: env("TURN_USERNAME"),
    turnSecret: env("TURN_CREDENTIAL"),
    /** Visio du campus : étudiants en ligne qui reçoivent la vidéo du formateur (chaque place coûte un encodage à son ordinateur). */
    placesVideo: Math.max(1, Number(env("VISIO_PLACES_VIDEO")) || 8),
    /** Visio du campus : étudiants en ligne en visio (vidéo + son seul) ; au-delà, ils écoutent la radio. */
    placesTotal: Number(env("VISIO_PLACES_TOTAL")) || 40,
  },

  ia: {
    cle: env("ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "ANTHROPIC_KEY", "CLAUDE_KEY"),
    /** Modèle de l'assistant ; l'effort (low → high) règle la dépense selon la tâche. */
    modele: env("CAMPUS_IA_MODELE") || "claude-opus-5",
    /** Requêtes d'assistant par étudiant et par jour. */
    quotaJour: Number(env("CAMPUS_IA_QUOTA_JOUR")) || 40,
  },

  mail: {
    resendCle: env("RESEND_API_KEY"),
    expediteur: env("CAMPUS_MAIL_FROM", "RESEND_FROM") || "Campus numérique 2IAE <campus@2iae.com>",
  },

  push: {
    publique: env("VAPID_PUBLIC_KEY"),
    privee: env("VAPID_PRIVATE_KEY"),
    contact: env("VAPID_CONTACT") || "mailto:campus@2iae.com",
  },

  admin: {
    identifiant: env("CAMPUS_ADMIN_EMAIL", "ADMIN_EMAIL") || "direction@2iae.com",
    motDePasse: env("CAMPUS_ADMIN_PASSWORD"),
    prenom: env("CAMPUS_ADMIN_PRENOM") || "Direction",
    nom: env("CAMPUS_ADMIN_NOM") || "2IAE",
  },

  /** Données de démonstration (cours IA-101, étudiants fictifs…) au démarrage. */
  demo: env("CAMPUS_DEMO") === "true",
} as const;

export type Config = typeof config;
