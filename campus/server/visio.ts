// Fournisseurs de visio de la classe en direct.
//
//   daily   : Daily.co (DAILY_API_KEY), fournisseur par défaut : une salle
//             privée par séance, jetons de réunion signés par le serveur,
//             enregistrement cloud, et une salle d'essai permanente.
//   campus  : visio intégrée (WebRTC pair-à-pair en étoile autour du
//             formateur), sans compte externe ; la signalisation est gérée par
//             le module visio (server/visio-campus.ts). Secours quand Daily
//             n'est pas configuré ou ne passe pas.
//   jitsi   : serveur Jitsi (JITSI_DOMAIN), simple adresse de salle.
//   externe : lien Zoom / Meet / Teams saisi par le formateur.
//   demo    : aucune visio, scène simulée. Jamais proposée quand une vraie
//             visio (Daily, Jitsi) est configurée.
//
// La « radio » (son du formateur en flux HTTP + diapos) fonctionne avec
// tous les fournisseurs : elle ne dépend pas de ce fichier.
//
// Coût : Daily facture à la minute-participant. L'usage est pensé pour le
// formateur et les cinq écrans de salle ; l'étudiant au téléphone arrive en
// « son + diapos » (radio) et ne rejoint Daily que s'il choisit la vidéo.
// Le nombre d'étudiants en vidéo est plafonné par salle (réglage).
import { and, eq, inArray, sql } from "drizzle-orm";
import { config } from "./config";
import { db } from "./db";
import { ErreurHttp } from "./http";
import {
  reglagesVisio,
  directsImmediats,
  utilisateurs,
  seances,
  journal,
  type FournisseurVisio,
  type Seance,
  type ReglagesVisio,
  type ProfilDaily,
  type PresenceSalleVisio,
  type UsageVisioDto,
} from "@shared/schema";

const API_DAILY = "https://api.daily.co/v1";

/** Préfixe des salles Daily (« campus-2iae-12 ») ; réglable pour isoler les tests. */
const PREFIXE_SALLE = process.env.DAILY_ROOM_PREFIX?.trim() || "campus-2iae-";

/** Salle d'essai permanente du campus, ouverte à tout compte connecté. */
export const NOM_SALLE_ESSAI = `${PREFIXE_SALLE}essai`;

/** Enregistrement cloud lancé automatiquement quand le formateur est en direct (désactivable). */
const ENREGISTREMENT_AUTO = process.env.DAILY_ENREGISTREMENT_AUTO?.trim() !== "non";

/**
 * Places réservées dans une salle de séance, en plus des étudiants en vidéo :
 * le formateur et ses co-formateurs, les cinq écrans de salle, l'équipe qui
 * observe. Daily compte TOUTE personne présente (propriétaire compris) dans
 * max_participants : les étudiants et l'équipe sont donc comptés à l'entrée
 * (reserverPlaceDaily) pour que le formateur et les salles trouvent toujours
 * leur place, même s'ils arrivent en dernier.
 */
const PLACES_FORMATEURS = 3;
const PLACES_SALLES = 5;
const PLACES_OBSERVATEURS = 7;
export const PLACES_HORS_ETUDIANTS = PLACES_FORMATEURS + PLACES_SALLES + PLACES_OBSERVATEURS;

/**
 * Plafond de max_participants accepté par le forfait Daily : 200 par défaut
 * (« Contact us if you need to set the limit above 200 »). Un compte que
 * Daily a relevé le déclare par DAILY_MAX_PARTICIPANTS.
 */
const PLAFOND_DAILY = (() => {
  const n = Number(process.env.DAILY_MAX_PARTICIPANTS);
  return Number.isInteger(n) && n >= 20 ? n : 200;
})();
/** Valeur par défaut de Daily : l'API ne renvoie pas max_participants quand il vaut 200. */
const MAX_PARTICIPANTS_DEFAUT_DAILY = 200;

/** Étudiants en vidéo par séance, au plus, que le réglage peut demander (185 avec le forfait standard). */
export const placesDailyEtudiantsMax = () => PLAFOND_DAILY - PLACES_HORS_ETUDIANTS;

/** Salle d'essai : trente personnes au plus, dont quinze étudiants (ils ne prennent jamais toute la salle). */
const TAILLE_SALLE_ESSAI = 30;
const PLACES_ESSAI_ETUDIANTS = 15;

/** Une visite dans la salle d'essai (ou une répétition) s'arrête seule au bout d'une heure : un onglet oublié ne coûte pas une nuit. */
export const DUREE_MAX_ESSAI_S = 60 * 60;
/** Un étudiant teste son micro en quelques minutes : sa visite s'arrête au bout d'un quart d'heure et libère sa place. */
export const DUREE_MAX_ESSAI_ETUDIANT_S = 15 * 60;
export const DUREE_MAX_REPETITION_S = 90 * 60;
/** Enregistrement du replay : la durée du cours plus 2 h de débordement (Daily coupe à 3 h sans consigne). */
export const dureeMaxEnregistrement = (s: Pick<Seance, "dureeMinutes">) => s.dureeMinutes * 60 + 2 * 3600;

export const dailyDisponible = () => Boolean(config.visio.dailyCle);
export const jitsiDisponible = () => Boolean(config.visio.jitsiDomaine);

// ── Réglages (ligne unique en base, gardée en mémoire) ─────────────────────

type Reglages = Omit<ReglagesVisio, "id" | "majParId" | "majLe"> & { majLe: Date | null };

const REGLAGES_DEFAUT: Reglages = {
  fournisseurParDefaut: null,
  videoEtudiantParDefaut: false,
  placesDailyEtudiants: 30,
  prixMinuteUsd: 0.004,
  minutesOffertes: 10_000,
  tauxFcfa: 600,
  majLe: null,
};

let reglages: Reglages = { ...REGLAGES_DEFAUT };

/** Charge les réglages de la visio (au démarrage ; sans base, les valeurs par défaut restent). */
export async function chargerReglagesVisio(): Promise<void> {
  try {
    const [r] = await db.select().from(reglagesVisio).where(eq(reglagesVisio.id, 1));
    if (r) reglages = { ...REGLAGES_DEFAUT, ...r };
  } catch (e) {
    console.warn("[visio] réglages illisibles, valeurs par défaut :", (e as Error).message);
  }
}

export const reglagesCourants = (): Reglages => reglages;

export async function enregistrerReglagesVisio(maj: Partial<Omit<Reglages, "majLe">>, parId: number): Promise<Reglages> {
  const valeurs = { ...maj, majLe: new Date(), majParId: parId };
  const [r] = await db
    .insert(reglagesVisio)
    .values({ id: 1, ...valeurs })
    .onConflictDoUpdate({ target: reglagesVisio.id, set: valeurs })
    .returning();
  reglages = { ...REGLAGES_DEFAUT, ...r };
  return reglages;
}

/** Fournisseurs proposés dans les formulaires : Daily d'abord ; la démonstration seulement sans aucune vraie visio. */
export function fournisseursDisponibles(): FournisseurVisio[] {
  const liste: FournisseurVisio[] = [];
  if (dailyDisponible()) liste.push("daily");
  liste.push("campus");
  if (jitsiDisponible()) liste.push("jitsi");
  liste.push("externe");
  if (!dailyDisponible() && !jitsiDisponible()) liste.push("demo");
  return liste;
}

/** Fournisseur des nouvelles séances : le réglage de la direction, sinon Daily si configuré, sinon la visio du campus. */
export function fournisseurParDefaut(): FournisseurVisio {
  const choisi = reglages.fournisseurParDefaut;
  if (choisi && choisi !== "externe" && fournisseursDisponibles().includes(choisi)) return choisi;
  return dailyDisponible() ? "daily" : "campus";
}

/**
 * Visio de toutes les séances : Daily, avec l'enregistrement du replay, pour que les contenus soient partagés
 * (décision de la direction, octobre 2026). Le formateur ne choisit plus (ni lien externe, ni autre visio).
 * Sans Daily configuré (campus d'essai) : la visio par défaut. Seul changement permis ensuite : la visio du
 * campus, en secours, quand Daily ne passe pas.
 */
export function fournisseurImpose(): FournisseurVisio {
  return dailyDisponible() ? "daily" : fournisseurParDefaut();
}

export const nomSalleVisio = (seanceId: number) => `${PREFIXE_SALLE}${seanceId}`;
/** Salle d'un groupe de travail : « campus-2iae-17-g42 » (rattachée à la séance 17 dans le suivi de consommation). */
export const nomSalleGroupe = (seanceId: number, groupeId: number) => `${PREFIXE_SALLE}${seanceId}-g${groupeId}`;

/** Fin de validité de la salle : fin prévue + 2 h (en secondes Unix). */
function expirationSalle(s: Pick<Seance, "debut" | "dureeMinutes">): number {
  const fin = new Date(s.debut).getTime() + s.dureeMinutes * 60_000;
  // Une séance rejointe en retard (ou qui déborde) garde au moins 2 h devant elle.
  return Math.floor(Math.max(fin, Date.now()) / 1000) + 2 * 3600;
}

// ── Domaine Daily et Permissions-Policy ────────────────────────────────────

const nettoyerDomaine = (v: string | undefined | null) => {
  const d = (v ?? "").trim().replace(/^https?:\/\//, "").replace(/\.daily\.co.*$/i, "").replace(/\/.*$/, "");
  return /^[a-z0-9-]{1,63}$/i.test(d) ? d.toLowerCase() : null;
};

let domaineDaily: string | null = nettoyerDomaine(config.visio.dailyDomaine);

export const domaineDailyConnu = () => domaineDaily;

/** Retrouve le sous-domaine Daily du compte (« schoolofservant ») quand DAILY_DOMAIN n'est pas fourni. */
export async function decouvrirDomaineDaily(): Promise<void> {
  if (domaineDaily || !dailyDisponible()) return;
  try {
    const r = await appelDaily<{ domain_name?: string }>("/");
    const d = nettoyerDomaine(r.donnees?.domain_name);
    if (r.statut === 200 && d) {
      domaineDaily = d;
      console.log(`[visio] domaine Daily : ${d}.daily.co`);
    }
  } catch {
    /* Daily injoignable au démarrage : le joker *.daily.co reste en place */
  }
}

const FONCTIONS_MEDIAS = ["camera", "microphone", "display-capture", "fullscreen", "autoplay"] as const;

/**
 * En-tête Permissions-Policy : caméra, micro, partage d'écran, plein écran et
 * lecture automatique pour le campus et pour l'iframe Daily, nommée
 * explicitement (https://<domaine>.daily.co) en plus du joker, que les
 * navigateurs anciens ne comprennent pas ; plein écran et lecture automatique
 * aussi pour le lecteur YouTube (vidéos projetées).
 */
export function politiquePermissions(): string {
  const origines = ['"https://*.daily.co"'];
  if (domaineDaily) origines.unshift(`"https://${domaineDaily}.daily.co"`);
  const liste = `self ${origines.join(" ")}`;
  // Vidéos YouTube projetées dans les salles : lecture automatique et plein écran, rien d'autre.
  const youtube = '"https://www.youtube-nocookie.com" "https://www.youtube.com"';
  return FONCTIONS_MEDIAS.map((f) => `${f}=(${f === "autoplay" || f === "fullscreen" ? `${liste} ${youtube}` : liste})`).join(", ");
}

// ── Daily.co : appels à l'API ──────────────────────────────────────────────

type SalleDaily = { id: string; name: string; url: string; config?: { exp?: number; max_participants?: number } };

async function appelDaily<T>(chemin: string, options: { methode?: "GET" | "POST" | "DELETE"; corps?: unknown } = {}): Promise<{ statut: number; donnees: T | null }> {
  const cle = config.visio.dailyCle;
  if (!cle) throw new ErreurHttp(503, "La visio Daily n'est pas configurée sur ce campus.");
  let r: Response;
  try {
    r = await fetch(`${API_DAILY}${chemin}`, {
      method: options.methode ?? "GET",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.warn("[visio] Daily injoignable :", (e as Error).message);
    throw new ErreurHttp(502, "Le service de visio ne répond pas. Réessayez dans un instant, ou passez à la visio du campus ou à la radio.", { code: "daily_injoignable" });
  }
  const texte = await r.text();
  let donnees: T | null = null;
  try {
    donnees = texte ? (JSON.parse(texte) as T) : null;
  } catch {
    donnees = null;
  }
  return { statut: r.status, donnees };
}

/** Le compte Daily refuse pour une raison d'abonnement (paiement, quota, limite du forfait). */
function problemeDeCompte(statut: number, texte: string): boolean {
  return statut === 402 || /payment|billing|credit card|subscription|quota|exceeded|plan[- ]limit|limit[- ]reached|account[- ](suspended|disabled|missing)/i.test(texte);
}

let derniereAlerteCompte = 0;

/** Prévient la direction (au plus une fois toutes les 6 h) que le compte Daily refuse les salles. */
async function alerterDirection(info: string): Promise<void> {
  if (Date.now() - derniereAlerteCompte < 6 * 3600_000) return;
  derniereAlerteCompte = Date.now();
  try {
    const { notifier } = await import("./notifications");
    const admins = await db
      .select({ id: utilisateurs.id })
      .from(utilisateurs)
      .where(and(eq(utilisateurs.role, "admin"), eq(utilisateurs.actif, true)));
    await db.insert(journal).values({ action: "daily_compte_refuse", details: { info: info.slice(0, 300) } });
    await notifier(
      admins.map((a) => a.id),
      {
        type: "systeme",
        titre: "Visio Daily : le compte refuse les salles",
        corps: "Paiement ou quota à vérifier sur dashboard.daily.co. En attendant, les cours passent par la visio du campus ou la radio.",
        lien: "/pilotage/visio",
        urgent: true,
      },
    );
  } catch (e) {
    console.warn("[visio] alerte direction impossible :", (e as Error).message);
  }
}

function erreurDaily(statut: number, donnees: unknown): ErreurHttp {
  const d = donnees as { info?: string; error?: string } | null;
  const texte = `${d?.error ?? ""} ${d?.info ?? ""}`.trim();
  console.warn(`[visio] Daily a répondu ${statut} : ${texte}`);
  if (problemeDeCompte(statut, texte)) {
    void alerterDirection(texte);
    return new ErreurHttp(
      503,
      "La visio Daily est indisponible : le compte de l'école refuse les salles (paiement ou quota). La direction est prévenue. Passez à la visio du campus ou à la radio.",
      { code: "daily_compte" },
    );
  }
  if (statut === 429) return new ErreurHttp(503, "Le service de visio est très sollicité. Réessayez dans quelques secondes.", { code: "daily_occupe" });
  return new ErreurHttp(502, "Le service de visio a refusé la demande. Réessayez, ou passez à la visio du campus ou à la radio.", { code: "daily_refus" });
}

/** Places vidéo étudiantes d'une séance : le réglage, dans la limite du forfait Daily (un ancien réglage trop haut ne prend pas les places réservées). */
const placesEtudiants = () => Math.max(0, Math.min(reglages.placesDailyEtudiants, placesDailyEtudiantsMax()));

/** Taille maximale d'une salle de séance : les places vidéo étudiantes + formateur, salles et équipe, dans la limite du forfait Daily. */
const tailleSalleSeance = () => Math.min(PLAFOND_DAILY, Math.max(10, placesEtudiants() + PLACES_HORS_ETUDIANTS));

/** Propriétés communes : pas d'écran d'attente Daily (nos pré-tests le remplacent), pas de discussion Daily (les questions du campus la remplacent). */
const PROPRIETES_COMMUNES = {
  enable_prejoin_ui: false,
  enable_chat: false,
  enable_knocking: false,
  enable_hand_raising: false,
  enable_emoji_reactions: false,
  enable_screenshare: true,
  enable_network_ui: true,
  enable_noise_cancellation_ui: true,
  lang: "fr",
};

/**
 * Met à jour une salle existante et vérifie la réponse. Si Daily refuse (taille
 * hors forfait, par exemple), on le journalise et, quand la salle devait être
 * prolongée, on retente la seule prolongation : sinon tout le monde serait
 * éjecté à l'ancienne heure de fin (eject_at_room_exp).
 */
async function mettreAJourSalle(nom: string, proprietes: { exp: number; max_participants?: number }, prolonger: boolean): Promise<boolean> {
  const chemin = `/rooms/${encodeURIComponent(nom)}`;
  const r = await appelDaily<{ info?: string; error?: string }>(chemin, { methode: "POST", corps: { properties: proprietes } });
  if (r.statut === 200) return true;
  console.warn(`[visio] mise à jour de la salle ${nom} refusée (${r.statut}) : ${r.donnees?.error ?? ""} ${r.donnees?.info ?? ""}`.trim());
  if (!prolonger || proprietes.max_participants === undefined) return false;
  const seule = await appelDaily<{ info?: string; error?: string }>(chemin, { methode: "POST", corps: { properties: { exp: proprietes.exp } } });
  if (seule.statut !== 200) console.warn(`[visio] prolongation de la salle ${nom} refusée (${seule.statut}) : ${seule.donnees?.error ?? ""} ${seule.donnees?.info ?? ""}`.trim());
  return false;
}

/**
 * Salles de séance vérifiées il y a moins d'une minute (taille et fin à jour) :
 * quand quarante étudiants et cinq salles entrent au « Démarrer », on ne relit
 * pas la salle chez Daily à chaque entrée (Daily limite le nombre d'appels).
 */
const sallesVerifiees = new Map<string, { url: string; exp: number; taille: number; jusqua: number }>();
const retenirSalle = (nom: string, url: string, exp: number, taille: number) => sallesVerifiees.set(nom, { url, exp, taille, jusqua: Date.now() + 60_000 });

/**
 * Crée (ou retrouve) la salle Daily de la séance : privée, caméra et micro
 * coupés à l'entrée, sans écran d'attente ni discussion Daily, interface en
 * français, enregistrement cloud, taille plafonnée.
 */
export async function obtenirSalleDaily(s: Pick<Seance, "id" | "debut" | "dureeMinutes">): Promise<{ nom: string; url: string }> {
  const nom = nomSalleVisio(s.id);
  const exp = expirationSalle(s);
  const taille = tailleSalleSeance();
  // Vérifiée il y a moins d'une minute, et sa fin couvre encore largement la séance : rien à redemander.
  const connue = sallesVerifiees.get(nom);
  if (connue && connue.jusqua > Date.now() && connue.taille === taille && connue.exp >= exp - 30 * 60) return { nom, url: connue.url };
  const existante = await appelDaily<SalleDaily>(`/rooms/${encodeURIComponent(nom)}`);
  if (existante.statut === 200 && existante.donnees) {
    // Prolonge la salle si la séance a été déplacée ou déborde ; suit le réglage des places.
    const cfg = existante.donnees.config ?? {};
    const tailleActuelle = cfg.max_participants ?? MAX_PARTICIPANTS_DEFAUT_DAILY;
    const prolonger = (cfg.exp ?? 0) < exp;
    const aJour = prolonger || tailleActuelle !== taille ? await mettreAJourSalle(nom, { exp: Math.max(exp, cfg.exp ?? 0), max_participants: taille }, prolonger) : true;
    if (aJour) retenirSalle(nom, existante.donnees.url, Math.max(exp, cfg.exp ?? 0), taille);
    return { nom, url: existante.donnees.url };
  }
  const creer = (max_participants?: number) =>
    appelDaily<SalleDaily & { info?: string }>("/rooms", {
      methode: "POST",
      corps: {
        name: nom,
        privacy: "private",
        properties: {
          ...PROPRIETES_COMMUNES,
          exp,
          eject_at_room_exp: true,
          start_video_off: true,
          start_audio_off: true,
          ...(max_participants !== undefined && { max_participants }),
          enable_recording: "cloud",
        },
      },
    });
  let creee = await creer(taille);
  // Taille refusée par le forfait (DAILY_MAX_PARTICIPANTS trop haut) : la classe s'ouvre quand même, à la taille par défaut de Daily.
  if (creee.statut === 400 && /max_participants/i.test(creee.donnees?.info ?? "")) {
    console.warn(`[visio] taille ${taille} refusée par Daily pour ${nom} : salle créée à sa taille par défaut (${MAX_PARTICIPANTS_DEFAUT_DAILY}). Vérifiez DAILY_MAX_PARTICIPANTS.`);
    creee = await creer();
  }
  if (creee.statut === 200 && creee.donnees) {
    retenirSalle(nom, creee.donnees.url, exp, taille);
    return { nom, url: creee.donnees.url };
  }
  // Deux personnes entrées au même instant : la salle vient d'être créée par l'autre.
  const rattrapage = await appelDaily<SalleDaily>(`/rooms/${encodeURIComponent(nom)}`);
  if (rattrapage.statut === 200 && rattrapage.donnees) return { nom, url: rattrapage.donnees.url };
  throw erreurDaily(creee.statut, creee.donnees);
}

/**
 * Salle d'essai permanente (« campus-2iae-essai ») : privée, sans date de fin,
 * trente personnes au plus (formateur, cinq salles, direction, collègues, et
 * quinze étudiants au plus : reserverPlaceDaily), jamais enregistrée. Créée à
 * la première demande ; une salle créée plus petite est agrandie.
 */
export async function obtenirSalleEssai(): Promise<{ nom: string; url: string }> {
  const nom = NOM_SALLE_ESSAI;
  const existante = await appelDaily<SalleDaily>(`/rooms/${encodeURIComponent(nom)}`);
  if (existante.statut === 200 && existante.donnees) {
    if ((existante.donnees.config?.max_participants ?? MAX_PARTICIPANTS_DEFAUT_DAILY) !== TAILLE_SALLE_ESSAI) {
      const r = await appelDaily<{ info?: string }>(`/rooms/${encodeURIComponent(nom)}`, { methode: "POST", corps: { properties: { max_participants: TAILLE_SALLE_ESSAI } } });
      if (r.statut !== 200) console.warn(`[visio] agrandissement de la salle d'essai refusé (${r.statut}) : ${r.donnees?.info ?? ""}`);
    }
    return { nom, url: existante.donnees.url };
  }
  const creee = await appelDaily<SalleDaily>("/rooms", {
    methode: "POST",
    corps: {
      name: nom,
      privacy: "private",
      properties: { ...PROPRIETES_COMMUNES, start_video_off: false, start_audio_off: true, max_participants: TAILLE_SALLE_ESSAI },
    },
  });
  if (creee.statut === 200 && creee.donnees) return { nom, url: creee.donnees.url };
  const rattrapage = await appelDaily<SalleDaily>(`/rooms/${encodeURIComponent(nom)}`);
  if (rattrapage.statut === 200 && rattrapage.donnees) return { nom, url: rattrapage.donnees.url };
  throw erreurDaily(creee.statut, creee.donnees);
}

/** Un groupe de travail tient dans une petite salle (quelques étudiants, une salle de campus, le formateur en visite). */
const TAILLE_SALLE_GROUPE = 25;

/**
 * Crée (ou retrouve) la salle Daily d'un groupe de travail : privée, jamais
 * enregistrée, caméras et micros coupés à l'entrée, fermée au plus tard à `exp`.
 * Elle est effacée à la fermeture des groupes.
 */
export async function obtenirSalleGroupeDaily(nom: string, exp: number): Promise<{ nom: string; url: string }> {
  const existante = await appelDaily<SalleDaily>(`/rooms/${encodeURIComponent(nom)}`);
  if (existante.statut === 200 && existante.donnees) {
    if ((existante.donnees.config?.exp ?? 0) < exp) await mettreAJourSalle(nom, { exp }, false);
    return { nom, url: existante.donnees.url };
  }
  const creee = await appelDaily<SalleDaily>("/rooms", {
    methode: "POST",
    corps: {
      name: nom,
      privacy: "private",
      properties: { ...PROPRIETES_COMMUNES, start_video_off: true, start_audio_off: true, max_participants: TAILLE_SALLE_GROUPE, exp, eject_at_room_exp: true },
    },
  });
  if (creee.statut === 200 && creee.donnees) return { nom, url: creee.donnees.url };
  const rattrapage = await appelDaily<SalleDaily>(`/rooms/${encodeURIComponent(nom)}`);
  if (rattrapage.statut === 200 && rattrapage.donnees) return { nom, url: rattrapage.donnees.url };
  throw erreurDaily(creee.statut, creee.donnees);
}

export type ProfilJeton = ProfilDaily;

/**
 * Jeton de réunion Daily signé côté serveur, selon le profil :
 *  - formateur : propriétaire (caméra, micro, partage d'écran, gestion des participants) ;
 *  - salle : caméra et micro de la salle, pas propriétaire, pas de partage d'écran ;
 *  - étudiant : rien à l'entrée (micro et caméra coupés) ; le formateur lui
 *    ouvre le micro quand il lui donne la parole (pas de caméra étudiante, §9.8) ;
 *  - observateur (équipe) : regarde et écoute seulement.
 * `envoi` remplace les droits d'envoi (salle d'essai : l'étudiant y teste son micro).
 */
export async function jetonDaily(o: {
  salle: string;
  nomAffiche: string;
  utilisateurId: number;
  profil: ProfilJeton;
  /** Fin de validité (secondes Unix) : au-delà, on ne peut plus entrer avec ce jeton. */
  exp: number;
  /** Enregistrement cloud dès l'entrée du formateur (séance en direct seulement). */
  enregistrer?: boolean;
  /** Durée maximale de cet enregistrement, en secondes (sans elle, Daily l'arrête au bout de 3 h). */
  enregistrementMaxS?: number;
  /** Le propriétaire peut-il enregistrer ? Non dans la salle d'essai ni en répétition (un essai ne doit jamais devenir le replay). */
  enregistrementPermis?: boolean;
  /** Sortie automatique au bout de N secondes (salle d'essai, répétition). */
  ejecterApres?: number;
  envoi?: ("audio" | "video")[] | false;
  /** Caméra ouverte dès l'entrée (un intervenant invité), quel que soit le profil. */
  cameraAuDepart?: boolean;
  /** Micro et caméra coupés à l'entrée, même propriétaire (la direction qui reprend un cours, un formateur invité). */
  silencieux?: boolean;
  /** Participant invisible (ni vu ni compté par les autres) : l'écoute de la classe pour la radio. */
  invisible?: boolean;
}): Promise<string> {
  const proprietaire = o.profil === "formateur";
  const proprietes: Record<string, unknown> = {
    room_name: o.salle,
    user_name: o.nomAffiche.slice(0, 60),
    user_id: String(o.utilisateurId),
    is_owner: proprietaire,
    exp: o.exp,
    lang: "fr",
    start_audio_off: !proprietaire || Boolean(o.silencieux),
    start_video_off: o.cameraAuDepart ? false : o.profil === "etudiant" || o.profil === "observateur" || Boolean(o.silencieux),
    enable_screenshare: proprietaire,
    enable_prejoin_ui: false,
  };
  if (proprietaire) {
    if (o.enregistrementPermis !== false) {
      proprietes.enable_recording = "cloud";
      if (o.enregistrer && ENREGISTREMENT_AUTO) {
        proprietes.start_cloud_recording = true;
        if (o.enregistrementMaxS) proprietes.start_cloud_recording_opts = { maxDuration: Math.round(o.enregistrementMaxS) };
      }
    }
  } else {
    const envoi = o.envoi !== undefined ? o.envoi : o.profil === "salle" ? (["video", "audio"] as const) : false;
    proprietes.permissions = { canSend: envoi === false ? false : [...envoi], ...(o.invisible ? { hasPresence: false } : {}) };
  }
  if (o.ejecterApres) proprietes.eject_after_elapsed = o.ejecterApres;
  const r = await appelDaily<{ token: string }>("/meeting-tokens", { methode: "POST", corps: { properties: proprietes } });
  if (r.statut !== 200 || !r.donnees?.token) throw erreurDaily(r.statut, r.donnees);
  return r.donnees.token;
}

/** Expiration d'un jeton de séance (jusqu'à la fin de la salle). */
export const expirationJetonSeance = (s: Pick<Seance, "debut" | "dureeMinutes">) => expirationSalle(s);

/** Le formateur doit-il déclencher l'enregistrement ? Seulement une vraie séance (pas une répétition, pas un essai). */
export const enregistrementAutomatique = () => ENREGISTREMENT_AUTO;

/** Personnes présentes dans une salle Daily en ce moment (lu par l'API, sans rejoindre la salle). */
export async function presenceSalle(nom: string): Promise<PresenceSalleVisio> {
  const lu = new Date().toISOString();
  if (!dailyDisponible()) return { salle: nom, presents: [], lu, disponible: false };
  const r = await appelDaily<{ data?: { userName?: string | null; user_name?: string | null; joinTime?: string; join_time?: number }[] }>(
    `/rooms/${encodeURIComponent(nom)}/presence`,
  );
  if (r.statut === 404) return { salle: nom, presents: [], lu, disponible: true };
  if (r.statut !== 200) return { salle: nom, presents: [], lu, disponible: false };
  const presents = (r.donnees?.data ?? []).map((p) => ({
    nom: (p.userName ?? p.user_name ?? "Invité").slice(0, 60),
    depuis: p.joinTime ? new Date(p.joinTime).toISOString() : p.join_time ? new Date(p.join_time * 1000).toISOString() : lu,
  }));
  return { salle: nom, presents, lu, disponible: true };
}

// ── Places comptées : étudiants et équipe qui observe ──────────────────────

/** Jetons remis par salle (profil, heure) : ceux qui ne sont pas encore entrés comptent aussi. */
const jetonsRemis = new Map<string, Map<number, { profil: ProfilJeton; t: number }>>();
/** Un jeton remis compte 2 min, le temps d'entrer ; ensuite seule la présence lue chez Daily compte. */
const ATTENTE_ENTREE_MS = 2 * 60_000;
/** Mémoire du profil des personnes entrées (redémarrage du serveur : on retombe sur leur rôle). */
const MEMOIRE_PROFILS_MS = 12 * 3600_000;
const cachePresents = new Map<string, { exp: number; ids: number[] }>();

/** Comptes présents dans une salle Daily (user_id des jetons), 3 s de cache ; null si Daily ne répond pas. */
async function comptesPresents(nom: string): Promise<number[] | null> {
  const c = cachePresents.get(nom);
  if (c && c.exp > Date.now()) return c.ids;
  try {
    const r = await appelDaily<{ data?: { userId?: string | null; user_id?: string | null }[] }>(`/rooms/${encodeURIComponent(nom)}/presence`);
    if (r.statut !== 200) return null;
    const ids = (r.donnees?.data ?? []).map((p) => Number(p.userId ?? p.user_id)).filter((n) => Number.isInteger(n) && n > 0);
    cachePresents.set(nom, { exp: Date.now() + 3000, ids });
    return ids;
  } catch {
    return null;
  }
}

/**
 * Réserve la place d'un étudiant, ou d'une personne de l'équipe qui observe,
 * avant de lui remettre un jeton. Au-delà des places prévues : 409
 * « daily_plein » (l'étudiant suit alors en son + diapos). Le formateur et les
 * écrans de salle ne sont jamais comptés : leurs places restent libres même
 * s'ils entrent en dernier, au « Démarrer ».
 * Occupé = présents lus chez Daily (API presence) + jetons remis depuis moins
 * de 2 min (arrivées au même instant). Une personne déjà comptée (page
 * rechargée, second onglet) garde sa place ; une personne « prioritaire »
 * (l'étudiant qui a la parole) est comptée sans jamais être refusée.
 */
export async function reserverPlaceDaily(o: { salle: string; profil: ProfilJeton; utilisateurId: number; essai?: boolean; prioritaire?: boolean }): Promise<void> {
  const limite =
    o.profil === "etudiant" ? (o.essai ? PLACES_ESSAI_ETUDIANTS : placesEtudiants()) : o.profil === "observateur" && !o.essai ? PLACES_OBSERVATEURS : null;
  const remis = jetonsRemis.get(o.salle) ?? new Map<number, { profil: ProfilJeton; t: number }>();
  jetonsRemis.set(o.salle, remis);
  if (limite !== null) {
    const presents = limite > 0 ? ((await comptesPresents(o.salle)) ?? []) : [];
    const inconnus = presents.filter((id) => !remis.has(id));
    const roles = new Map(
      inconnus.length ? (await db.select({ id: utilisateurs.id, role: utilisateurs.role }).from(utilisateurs).where(inArray(utilisateurs.id, inconnus))).map((l) => [l.id, l.role]) : [],
    );
    const profilDe = (id: number): ProfilJeton | null => {
      const connu = remis.get(id)?.profil;
      if (connu) return connu;
      const role = roles.get(id);
      return role === "etudiant" ? "etudiant" : role === "admin" || role === "vie_scolaire" ? "observateur" : null;
    };
    // Plus aucune attente d'ici la décision : deux demandes simultanées ne peuvent pas prendre la même place.
    const maintenant = Date.now();
    const occupes = new Set(presents.filter((id) => profilDe(id) === o.profil));
    for (const [id, j] of remis) if (j.profil === o.profil && maintenant - j.t < ATTENTE_ENTREE_MS) occupes.add(id);
    if (!o.prioritaire && !occupes.has(o.utilisateurId) && occupes.size >= limite) {
      let message = "Les places d'observation de la visio sont prises. Le formateur et les salles gardent les leurs. Réessayez dans un moment.";
      if (o.profil === "etudiant" && o.essai) {
        message = `La salle d'essai est complète pour le moment (${limite} étudiants à la fois). Réessaie dans quelques minutes : chaque visite d'étudiant dure un quart d'heure.`;
      } else if (o.profil === "etudiant") {
        message =
          limite === 0
            ? "La vidéo n'est pas ouverte aux étudiants pour cette classe. Suis le cours en « son + diapos » : tu entends tout, avec les diapos."
            : `La visio est complète (${limite} étudiants en vidéo au plus). Suis le cours en « son + diapos » : tu entends tout, avec les diapos.`;
      }
      throw new ErreurHttp(409, message, { code: "daily_plein" });
    }
  }
  const maintenant = Date.now();
  for (const [id, j] of remis) if (maintenant - j.t > MEMOIRE_PROFILS_MS) remis.delete(id);
  remis.set(o.utilisateurId, { profil: o.profil, t: maintenant });
  if (jetonsRemis.size > 500) {
    for (const [salle, liste] of jetonsRemis) if (![...liste.values()].some((j) => maintenant - j.t < MEMOIRE_PROFILS_MS)) jetonsRemis.delete(salle);
  }
}

export type EnregistrementDaily = { id: string; statut: string; debut: number; dureeSecondes: number | null };

/** Enregistrements d'une salle, du plus récent au plus ancien. */
export async function enregistrementsDaily(salle: string): Promise<EnregistrementDaily[]> {
  const r = await appelDaily<{ data?: { id: string; status: string; start_ts: number; duration?: number }[] }>(
    `/recordings?room_name=${encodeURIComponent(salle)}&limit=20`,
  );
  if (r.statut !== 200) throw erreurDaily(r.statut, r.donnees);
  return (r.donnees?.data ?? []).map((e) => ({ id: e.id, statut: e.status, debut: e.start_ts, dureeSecondes: e.duration ?? null }));
}

/** Lien de lecture temporaire d'un enregistrement (renouvelé à chaque demande). */
export async function lienEnregistrementDaily(id: string, validiteSecondes = 3 * 3600): Promise<{ url: string; expire: string }> {
  const r = await appelDaily<{ download_link: string; expires: number }>(
    `/recordings/${encodeURIComponent(id)}/access-link?valid_for_secs=${validiteSecondes}`,
  );
  if (r.statut !== 200 || !r.donnees?.download_link) throw erreurDaily(r.statut, r.donnees);
  return { url: r.donnees.download_link, expire: new Date(r.donnees.expires * 1000).toISOString() };
}

/** Efface un enregistrement chez Daily (il est gardé dans le bucket des replays). Déjà effacé : rien à faire. */
export async function supprimerEnregistrementDaily(id: string): Promise<void> {
  const r = await appelDaily(`/recordings/${encodeURIComponent(id)}`, { methode: "DELETE" });
  if (r.statut !== 200 && r.statut !== 404) throw erreurDaily(r.statut, r.donnees);
}

// ── Transcription des enregistrements (Batch Processor de Daily) ──────────

/** Erreur du service de transcription (sans alerte « compte » : la visio, elle, peut très bien marcher). */
function erreurTranscription(statut: number, donnees: unknown): Error {
  const d = donnees as { info?: string; error?: string } | null;
  return new Error(`Daily ${statut} : ${`${d?.error ?? ""} ${d?.info ?? ""}`.trim() || "réponse inattendue"}`.slice(0, 300));
}

/** Demande la transcription d'un enregistrement (par son identifiant Daily, ou un lien direct vers la vidéo). */
export async function soumettreTranscriptionDaily(source: { recordingId: string } | { uri: string }, langue = "fr"): Promise<string> {
  const entree = "recordingId" in source ? { sourceType: "recordingId", recordingId: source.recordingId, language: langue } : { sourceType: "uri", uri: source.uri, language: langue };
  const r = await appelDaily<{ id?: string }>("/batch-processor", {
    methode: "POST",
    corps: { preset: "transcript", inParams: entree, transformParams: { transcript: { language: langue, punctuate: true } }, outParams: { s3Config: { s3KeyTemplate: "transcription" } } },
  });
  if (r.statut !== 200 || !r.donnees?.id) throw erreurTranscription(r.statut, r.donnees);
  return r.donnees.id;
}

/** État d'une transcription demandée : « submitted », « processing », « finished » ou « error ». */
export async function etatTranscriptionDaily(id: string): Promise<{ statut: string; erreur: string | null }> {
  const r = await appelDaily<{ status?: string; error?: string }>(`/batch-processor/${encodeURIComponent(id)}`);
  if (r.statut !== 200 || !r.donnees?.status) throw erreurTranscription(r.statut, r.donnees);
  return { statut: r.donnees.status, erreur: r.donnees.error ?? null };
}

/** Liens de téléchargement de la transcription terminée (formats txt, vtt, srt, json). */
export async function liensTranscriptionDaily(id: string): Promise<{ format: string; link: string }[]> {
  const r = await appelDaily<{ transcription?: { format: string; link: string }[] }>(`/batch-processor/${encodeURIComponent(id)}/access-link`);
  if (r.statut !== 200) throw erreurTranscription(r.statut, r.donnees);
  return r.donnees?.transcription ?? [];
}

/** Supprime une salle Daily (nettoyage ; une séance supprimée n'a plus besoin de sa salle). */
export async function supprimerSalleDaily(salle: string): Promise<void> {
  sallesVerifiees.delete(salle);
  if (!dailyDisponible()) return;
  await appelDaily(`/rooms/${encodeURIComponent(salle)}`, { methode: "DELETE" }).catch(() => undefined);
}

// ── Direct immédiat ────────────────────────────────────────────────────────

/** La personne a lancé ce direct depuis le Studio (la direction l'anime alors comme un formateur). */
export async function aLanceDirect(utilisateurId: number, seanceId: number): Promise<boolean> {
  const [d] = await db
    .select({ id: directsImmediats.seanceId })
    .from(directsImmediats)
    .where(and(eq(directsImmediats.seanceId, seanceId), eq(directsImmediats.creeParId, utilisateurId)));
  return Boolean(d);
}

/** Direct immédiat lancé sans prévenir les étudiants : un essai (pas d'enregistrement du replay). */
export async function estEssaiDirect(seanceId: number): Promise<boolean> {
  const [d] = await db.select({ prevenir: directsImmediats.prevenir }).from(directsImmediats).where(eq(directsImmediats.seanceId, seanceId));
  return Boolean(d && !d.prevenir);
}

// ── Minutes-participant du mois (coût) ─────────────────────────────────────

type ReunionDaily = {
  id: string;
  room: string;
  start_time: number;
  duration: number;
  participants?: { user_id: string | null; user_name: string | null; duration: number }[];
};

const cacheUsage = new Map<string, { exp: number; valeur: UsageVisioDto }>();

/** Bornes d'un mois « AAAA-MM » en secondes Unix (UTC = heure d'Abidjan). */
function bornesMois(mois: string): { debut: number; fin: number } {
  const [a, m] = mois.split("-").map(Number);
  const debut = Date.UTC(a, m - 1, 1) / 1000;
  const fin = Date.UTC(a, m, 1) / 1000;
  return { debut, fin };
}

/**
 * Minutes-participant Daily du mois, pour les seules salles du campus (le
 * compte Daily peut servir à d'autres plateformes : leurs salles sont comptées
 * à part). Lu dans l'API REST /meetings, gardé 5 minutes en mémoire.
 */
export async function usageDaily(mois: string): Promise<UsageVisioDto> {
  const cache = cacheUsage.get(mois);
  if (cache && cache.exp > Date.now()) return cache.valeur;
  const r = reglages;
  const vide = (raison: string): UsageVisioDto => ({
    mois,
    disponible: false,
    raison,
    minutes: 0,
    reunions: 0,
    parProfil: [],
    parSalle: [],
    cout: { usd: 0, fcfa: 0, minutesFacturables: 0, prixMinuteUsd: r.prixMinuteUsd, minutesOffertes: r.minutesOffertes, tauxFcfa: r.tauxFcfa },
    minutesAutresSalles: 0,
    lu: new Date().toISOString(),
  });
  if (!dailyDisponible()) return vide("La visio Daily n'est pas configurée sur ce campus (clé DAILY_API_KEY absente).");

  const { debut, fin } = bornesMois(mois);
  const reunions: ReunionDaily[] = [];
  let apres: string | null = null;
  try {
    for (let page = 0; page < 30; page++) {
      const q = new URLSearchParams({ timeframe_start: String(debut), timeframe_end: String(fin), limit: "100" });
      if (apres) q.set("starting_after", apres);
      const rep: { statut: number; donnees: { data?: ReunionDaily[] } | null } = await appelDaily<{ data?: ReunionDaily[] }>(`/meetings?${q}`);
      if (rep.statut !== 200) {
        const e = erreurDaily(rep.statut, rep.donnees);
        return vide(e.message);
      }
      const lot = rep.donnees?.data ?? [];
      reunions.push(...lot);
      if (lot.length < 100) break;
      apres = lot[lot.length - 1].id;
    }
  } catch (e) {
    return vide(e instanceof ErreurHttp ? e.message : "Le service Daily ne répond pas.");
  }

  const duCampus = reunions.filter((m) => m.room.startsWith(PREFIXE_SALLE));
  const autres = reunions.filter((m) => !m.room.startsWith(PREFIXE_SALLE));
  const minutesDe = (m: ReunionDaily) => (m.participants ?? []).reduce((t, p) => t + (p.duration || 0), 0) / 60;

  // Profil des participants : par leur compte du campus (user_id du jeton).
  const ids = new Set<number>();
  for (const m of duCampus) for (const p of m.participants ?? []) if (p.user_id && /^\d+$/.test(p.user_id)) ids.add(Number(p.user_id));
  const roles = new Map<number, string>();
  if (ids.size) {
    const lignes = await db.select({ id: utilisateurs.id, role: utilisateurs.role }).from(utilisateurs).where(inArray(utilisateurs.id, [...ids]));
    for (const l of lignes) roles.set(l.id, l.role);
  }
  const profilDe = (userId: string | null): UsageVisioDto["parProfil"][number]["profil"] => {
    const role = userId && /^\d+$/.test(userId) ? roles.get(Number(userId)) : undefined;
    if (role === "formateur") return "formateur";
    if (role === "salle") return "salle";
    if (role === "etudiant") return "etudiant";
    if (role === "admin" || role === "vie_scolaire") return "equipe";
    return "inconnu";
  };
  const parProfil = new Map<string, { minutes: number; personnes: Set<string> }>();
  for (const m of duCampus) {
    for (const p of m.participants ?? []) {
      const cle = profilDe(p.user_id);
      const e = parProfil.get(cle) ?? { minutes: 0, personnes: new Set<string>() };
      e.minutes += (p.duration || 0) / 60;
      e.personnes.add(p.user_id ?? p.user_name ?? "?");
      parProfil.set(cle, e);
    }
  }

  // Libellé lisible de chaque salle : « Salle d'essai », ou le titre de la séance.
  // « campus-2iae-17 » : la séance 17 ; « campus-2iae-17-g42 » : un de ses groupes de travail.
  const idsSeances = [...new Set(duCampus.map((m) => parseInt(m.room.slice(PREFIXE_SALLE.length), 10)).filter((n) => Number.isInteger(n) && n > 0))];
  const titres = new Map<number, string>();
  if (idsSeances.length) {
    const lignes = await db.select({ id: seances.id, titre: seances.titre, debut: seances.debut }).from(seances).where(inArray(seances.id, idsSeances));
    for (const l of lignes) titres.set(l.id, `${l.titre} · ${l.debut.toISOString().slice(8, 10)}/${l.debut.toISOString().slice(5, 7)}`);
  }
  const parSalle = new Map<string, { minutes: number; reunions: number }>();
  for (const m of duCampus) {
    const e = parSalle.get(m.room) ?? { minutes: 0, reunions: 0 };
    e.minutes += minutesDe(m);
    e.reunions++;
    parSalle.set(m.room, e);
  }
  const libelleSalle = (nom: string) => {
    if (nom === NOM_SALLE_ESSAI) return "Salle d'essai";
    const suite = nom.slice(PREFIXE_SALLE.length);
    const id = parseInt(suite, 10);
    const titre = titres.get(id);
    if (titre && /^\d+-g\d+$/.test(suite)) return `${titre} · groupe de travail`;
    return titre ?? `Séance supprimée (${nom})`;
  };

  const minutes = duCampus.reduce((t, m) => t + minutesDe(m), 0);
  const minutesAutres = autres.reduce((t, m) => t + minutesDe(m), 0);
  // Les minutes offertes valent pour tout le compte Daily : on les déduit du total du compte, au prorata du campus.
  const total = minutes + minutesAutres;
  const facturablesCompte = Math.max(0, total - r.minutesOffertes);
  const minutesFacturables = total > 0 ? facturablesCompte * (minutes / total) : 0;
  const usd = minutesFacturables * r.prixMinuteUsd;
  const valeur: UsageVisioDto = {
    mois,
    disponible: true,
    raison: null,
    minutes: Math.round(minutes),
    reunions: duCampus.length,
    parProfil: (["formateur", "salle", "etudiant", "equipe", "inconnu"] as const)
      .map((profil) => ({ profil, minutes: Math.round(parProfil.get(profil)?.minutes ?? 0), personnes: parProfil.get(profil)?.personnes.size ?? 0 }))
      .filter((p) => p.minutes > 0 || p.personnes > 0),
    parSalle: [...parSalle.entries()]
      .map(([salle, e]) => ({ salle, libelle: libelleSalle(salle), minutes: Math.round(e.minutes), reunions: e.reunions }))
      .sort((a, b) => b.minutes - a.minutes),
    cout: {
      usd: Math.round(usd * 100) / 100,
      fcfa: Math.round(usd * r.tauxFcfa),
      minutesFacturables: Math.round(minutesFacturables),
      prixMinuteUsd: r.prixMinuteUsd,
      minutesOffertes: r.minutesOffertes,
      tauxFcfa: r.tauxFcfa,
    },
    minutesAutresSalles: Math.round(minutesAutres),
    lu: new Date().toISOString(),
  };
  cacheUsage.set(mois, { exp: Date.now() + 5 * 60_000, valeur });
  return valeur;
}

/** Oublie l'usage en cache (après un changement de réglage de prix). */
export const oublierUsage = () => cacheUsage.clear();

/** Séances « essai » (direct immédiat sans prévenir) closes depuis plus de 10 min et sans aucun étudiant : à effacer. */
export async function essaisAEffacer(): Promise<{ id: number; salleVisio: string | null }[]> {
  const r = await db.execute<{ id: number; salle_visio: string | null }>(sql`
    select s.id, s.salle_visio
    from campus.seances s
    join campus.directs_immediats d on d.seance_id = s.id
    where d.prevenir = false
      and s.statut in ('terminee', 'annulee')
      and coalesce(s.terminee_le, s.debut + (s.duree_minutes * interval '1 minute')) < now() - interval '10 minutes'
      and not exists (select 1 from campus.presences p where p.seance_id = s.id)`);
  return r.rows.map((l) => ({ id: l.id, salleVisio: l.salle_visio }));
}

// ── Jitsi ──────────────────────────────────────────────────────────────────

/** Adresse de la salle Jitsi : micro et caméra coupés, nom affiché prérempli. */
export function urlJitsi(seanceId: number, nomAffiche: string): string | null {
  const domaine = config.visio.jitsiDomaine?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!domaine) return null;
  const salle = `Campus2IAE-${seanceId}-${Buffer.from(config.sessionSecret).toString("hex").slice(0, 8)}`;
  const options = [
    "config.startWithAudioMuted=true",
    "config.startWithVideoMuted=true",
    "config.prejoinPageEnabled=false",
    "config.defaultLanguage=%22fr%22",
    `userInfo.displayName=%22${encodeURIComponent(nomAffiche)}%22`,
  ];
  return `https://${domaine}/${salle}#${options.join("&")}`;
}
