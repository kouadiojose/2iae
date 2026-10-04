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

/** « true », « oui », « 1 » (sans tenir compte de la casse) : l'option est activée. */
function active(v: string | undefined): boolean {
  return ["true", "oui", "1", "yes", "vrai"].includes((v ?? "").toLowerCase());
}

function sansSlashFinal(url: string | undefined): string | undefined {
  return url?.replace(/\/+$/, "");
}

export const estProduction = process.env.NODE_ENV === "production";

const port = Number(process.env.PORT) || 5100;

export const config = {
  port,
  sessionSecret: env("SESSION_SECRET") || "dev-campus-2iae-ne-pas-utiliser-en-production",

  /** Adresse publique du campus (liens dans les e-mails, QR codes, vitrine). */
  urlCampus:
    sansSlashFinal(env("CAMPUS_PUBLIC_URL", "APP_URL")) ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${port}`),

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

  /**
   * Bucket Railway (compatible S3) des fichiers déposés : cours, devoirs, copies, examens,
   * diapos, photos. Sans lui, les fichiers restent sur le volume (UPLOADS_DIR).
   */
  fichiersBucket: {
    bucket: env("FICHIERS_BUCKET"),
    endpoint: env("FICHIERS_ENDPOINT"),
    region: env("FICHIERS_REGION") || "auto",
    cleId: env("FICHIERS_ACCESS_KEY_ID"),
    cleSecrete: env("FICHIERS_SECRET_ACCESS_KEY"),
  },

  /**
   * Bucket Railway (compatible S3) où chaque replay est copié après le cours : les étudiants
   * lisent la vidéo directement dans le bucket (lien signé), jamais à travers l'application.
   */
  replays: {
    bucket: env("REPLAYS_BUCKET"),
    endpoint: env("REPLAYS_ENDPOINT"),
    region: env("REPLAYS_REGION") || "auto",
    cleId: env("REPLAYS_ACCESS_KEY_ID"),
    cleSecrete: env("REPLAYS_SECRET_ACCESS_KEY"),
    /** Jours pendant lesquels la copie Daily reste en filet de sécurité après l'archivage (0 : effacée aussitôt vérifiée). */
    garderDailyJours: Math.max(0, Number(env("REPLAYS_GARDER_DAILY_JOURS") ?? 7) || 0),
  },

  ia: {
    cle: env("ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "ANTHROPIC_KEY", "CLAUDE_KEY"),
    /** Modèle des outils du personnel ; l'effort (low → high) règle la dépense selon la tâche. */
    modele: env("CAMPUS_IA_MODELE") || "claude-opus-5",
    /** Modèle des questions des étudiants sur leurs cours : rapide et économique. */
    modeleEtudiant: env("CAMPUS_IA_MODELE_ETUDIANT") || "claude-haiku-4-5",
    /** Modèle de la bibliothèque (livres, fiches, exposés) : plus de culture générale. */
    modeleBibliotheque: env("CAMPUS_IA_MODELE_BIBLIOTHEQUE") || "claude-sonnet-5-5",
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

  /**
   * Données de démonstration au démarrage : DÉSACTIVÉ par défaut. Même
   * activé, le semis refuse en production dès que des comptes réels existent
   * (voir semerDemo dans server/demo.ts).
   */
  demo: active(env("CAMPUS_DEMO")),
  /**
   * CAMPUS_PURGER_DEMO=oui : au démarrage (server/scripts/migrate.ts), la
   * démonstration est supprimée, et seulement elle, avec un bilan chiffré
   * dans les journaux. Sans accès au serveur : il suffit de poser la variable
   * sur Railway et de redéployer. Idempotent : sans démonstration, rien ne se passe.
   */
  purgerDemo: active(env("CAMPUS_PURGER_DEMO")),
} as const;

export type Config = typeof config;
