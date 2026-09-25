// Données de démonstration (CAMPUS_DEMO=true, ou « npm run db:seed ») : un
// campus vivant dès la première ouverture. Cinq sites et leurs classes, la
// vie scolaire et l'écran de salle de chaque campus, cinq formateurs, une
// quarantaine d'étudiants, cinq cours complets (IA-101 suivi par les cinq
// campus), des lives passés avec transcription, questions votées, sondages et
// présences, la grande séance de mardi prochain annoncée sur 2iae.com, des
// devoirs et interrogations avec des copies corrigées, des messages, des
// annonces, des événements, des notifications et un historique d'usage de
// l'assistant IA.
//
// Règles :
//   - Idempotent : le compte témoin (formateur IA-101) est cherché d'abord ;
//     s'il existe, rien n'est recréé. Tout le semis tient dans UNE transaction
//     (verrou consultatif : deux démarrages simultanés ne sèment qu'une fois).
//   - Chaque compte porte preferences.demo = true ; tout le reste se rattache
//     à ces comptes ou aux cours de démonstration : « npm run db:purge-demo »
//     supprime le tout sans toucher aux sites, à la direction ni aux données
//     réelles. Les identifiants des classes créées sont notés au journal
//     (action « demo_semee ») pour que la purge sache lesquelles retirer.
//   - Dates RELATIVES au moment du semis (heure d'Abidjan = UTC) : le campus
//     paraît vivant quel que soit le jour du déploiement. Pour « rajeunir » la
//     démonstration : npm run db:purge-demo puis npm run db:seed.
//   - Mot de passe commun : CAMPUS_DEMO_MOT_DE_PASSE, sinon un mot de passe
//     fort est tiré au sort et affiché dans les journaux avec les comptes.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { hacher, verifier, motDePasseProvisoire, codeProvisoire, DUREE_CODE_PROVISOIRE_MS } from "./auth";
import { recuPour, corrigerTentative } from "./evaluations-outils";
import { prevenirSite } from "./site";
import {
  sites,
  classes,
  utilisateurs,
  fichiers,
  suivis,
  journal,
  cours,
  coursClasses,
  modules,
  lecons,
  progressions,
  lecturesCours,
  seances,
  questionsLive,
  votesQuestions,
  mainsLevees,
  presences,
  effectifsSalles,
  sondages,
  reponsesSondages,
  sousTitres,
  ressentis,
  evenementsSeances,
  vuesReplay,
  devoirs,
  rendus,
  questionsQuiz,
  tentativesQuiz,
  rappelsDevoirs,
  conversations,
  participants,
  messages,
  annonces,
  lecturesAnnonces,
  notifications,
  evenements,
  conversationsIa,
  messagesIa,
  usageIa,
  fichesRevision,
  essaisDepot,
  type Role,
  type Site,
  type QuestionQuiz,
  type CritereGrille,
  type EtapePlan,
  type TypeLecon,
  type TypeQuestion,
  type Ressenti,
  type PreferencesUtilisateur,
} from "@shared/schema";

// ═══════════════════════════════════════════════════════════════════════════
// Constantes et petits outils
// ═══════════════════════════════════════════════════════════════════════════

/** Domaine des adresses de démonstration (jamais une vraie boîte). */
export const DOMAINE_DEMO = "demo.2iae.com";
/** Compte témoin : sa présence signifie « démonstration déjà semée ». */
export const EMAIL_TEMOIN = `karim.diallo@${DOMAINE_DEMO}`;
/** Action du journal qui garde la trace du semis (classes créées, date). */
export const ACTION_JOURNAL_DEMO = "demo_semee";
/** Codes des cours de démonstration (la purge ne supprime que ceux-là, et seulement s'ils sont tenus par un formateur de démonstration). */
export const CODES_COURS_DEMO = ["IA-101", "ENT-210", "INF-230", "GES-120", "AGR-110"] as const;
/** Numéro WhatsApp du groupe de la vie scolaire (bouton « Besoin d'aide ? »). */
const WHATSAPP_VIE_SCOLAIRE = "2250747726729";
const ANNEE_SCOLAIRE = "2026-2027";
/** Clé du verrou consultatif PostgreSQL du semis. */
const VERROU_SEMIS = 2_026_101;

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

/** Générateur pseudo-aléatoire déterministe : la démonstration est la même à chaque semis. */
function generateur(graine: number) {
  let a = graine >>> 0;
  const suivant = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    reel: suivant,
    entre: (min: number, max: number) => min + Math.floor(suivant() * (max - min + 1)),
    chance: (p: number) => suivant() < p,
    choix: <T>(liste: readonly T[]): T => liste[Math.floor(suivant() * liste.length)],
    melanger: <T>(liste: readonly T[]): T[] => {
      const copie = [...liste];
      for (let i = copie.length - 1; i > 0; i--) {
        const j = Math.floor(suivant() * (i + 1));
        [copie[i], copie[j]] = [copie[j], copie[i]];
      }
      return copie;
    },
  };
}
type Hasard = ReturnType<typeof generateur>;

/** Jour d'Abidjan (UTC) décalé de n jours, à h:m. */
function jourA(t0: Date, n: number, h: number, m = 0): Date {
  return new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth(), t0.getUTCDate() + n, h, m));
}

/** Pas de cours le dimanche : on recule (passé) ou on avance (futur) d'un jour. */
function horsDimanche(d: Date, sens: -1 | 1): Date {
  return d.getUTCDay() === 0 ? new Date(d.getTime() + sens * JOUR) : d;
}

const plus = (d: Date, ms: number) => new Date(d.getTime() + ms);
const arrondi = (n: number, dec = 2) => Math.round(n * 10 ** dec) / 10 ** dec;
const auQuart = (n: number) => Math.round(n * 4) / 4;
/** « [12:05] texte » : même format que la transcription assemblée par le module live. */
const minutage = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

/** Numéro de reçu d'essai (devoir d'essai du parcours de bienvenue), même alphabet que le module compte. */
function recuEssai(h: Hasard): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(h.reel() * alphabet.length)];
  return `2IAE-${s}`;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ═══════════════════════════════════════════════════════════════════════════
// Les personnes
// ═══════════════════════════════════════════════════════════════════════════

type SlugSite = "riviera" | "yopougon" | "yamoussoukro" | "azaguie" | "mbatto";

type CleClasse = "riv-gc2" | "riv-le3" | "yop-in2" | "yop-gc1" | "yam-co1" | "yam-co2" | "aza-ab1" | "aza-ab2" | "mba-gc1" | "mba-gc2";

type DefClasse = { cle: CleClasse; site: SlugSite; filiere: string; niveau: string; libelle: string };

const CLASSES: DefClasse[] = [
  { cle: "riv-gc2", site: "riviera", filiere: "Gestion commerciale", niveau: "BTS 2", libelle: "BTS Gestion commerciale · 2e année" },
  { cle: "riv-le3", site: "riviera", filiere: "Entrepreneuriat", niveau: "Licence 3", libelle: "Licence Entrepreneuriat · 3e année" },
  { cle: "yop-in2", site: "yopougon", filiere: "Informatique", niveau: "BTS 2", libelle: "BTS Informatique · 2e année" },
  { cle: "yop-gc1", site: "yopougon", filiere: "Gestion commerciale", niveau: "BTS 1", libelle: "BTS Gestion commerciale · 1re année" },
  { cle: "yam-co1", site: "yamoussoukro", filiere: "Comptabilité", niveau: "BTS 1", libelle: "BTS Comptabilité · 1re année" },
  { cle: "yam-co2", site: "yamoussoukro", filiere: "Comptabilité", niveau: "BTS 2", libelle: "BTS Comptabilité · 2e année" },
  { cle: "aza-ab1", site: "azaguie", filiere: "Agro-business", niveau: "BTS 1", libelle: "BTS Agro-business · 1re année" },
  { cle: "aza-ab2", site: "azaguie", filiere: "Agro-business", niveau: "BTS 2", libelle: "BTS Agro-business · 2e année" },
  { cle: "mba-gc1", site: "mbatto", filiere: "Gestion commerciale", niveau: "BTS 1", libelle: "BTS Gestion commerciale · 1re année" },
  { cle: "mba-gc2", site: "mbatto", filiere: "Gestion commerciale", niveau: "BTS 2", libelle: "BTS Gestion commerciale · 2e année" },
];

/** Vie scolaire de chaque campus (prenom.nom@demo.2iae.com). */
const VIE_SCOLAIRE: { site: SlugSite; prenom: string; nom: string; email: string; telephone: string }[] = [
  { site: "riviera", prenom: "Christelle", nom: "Aka", email: "christelle.aka", telephone: "0708451236" },
  { site: "yopougon", prenom: "Mariam", nom: "Konaté", email: "mariam.konate", telephone: "0546781203" },
  { site: "yamoussoukro", prenom: "Kouadio", nom: "N'Guessan", email: "kouadio.nguessan", telephone: "0102334578" },
  { site: "azaguie", prenom: "Paul", nom: "Assi", email: "paul.assi", telephone: "0757120984" },
  { site: "mbatto", prenom: "Brigitte", nom: "Kouamé", email: "brigitte.kouame", telephone: "0505896612" },
];

type CleFormateur = "diallo" | "bamba" | "kouassi" | "coulibaly" | "yao";

type DefFormateur = {
  cle: CleFormateur;
  prenom: string;
  nom: string;
  email: string;
  slug: string;
  titre: string;
  localisation: string;
  site: SlugSite | null;
  bio: string;
  publierSurSite: boolean;
  annonceIlYaJours: number | null;
};

const FORMATEURS: DefFormateur[] = [
  {
    cle: "diallo",
    prenom: "Karim",
    nom: "Diallo",
    email: "karim.diallo",
    slug: "karim-diallo",
    titre: "Docteur en informatique, consultant en intelligence artificielle",
    localisation: "Lyon, France",
    site: null,
    bio: "Docteur en informatique de l'Université Lyon 1, Karim Diallo accompagne depuis dix ans des PME d'Afrique de l'Ouest dans l'usage concret de l'intelligence artificielle. Il a notamment conçu des outils de prévision des récoltes pour des coopératives de cacao. À 2IAE, il enseigne l'IA simplement, avec des exemples tirés du quotidien ivoirien.",
    publierSurSite: true,
    annonceIlYaJours: 9,
  },
  {
    cle: "bamba",
    prenom: "Aïcha",
    nom: "Bamba",
    email: "aicha.bamba",
    slug: "aicha-bamba",
    titre: "Entrepreneure, experte en création d'entreprise",
    localisation: "Abidjan, Côte d'Ivoire",
    site: "riviera",
    bio: "Fondatrice d'une entreprise de transformation de manioc à Abidjan, Aïcha Bamba a accompagné plus de 200 porteurs de projets dans des incubateurs ivoiriens. Elle aide les étudiants à passer de l'idée au premier client, business plan chiffré en FCFA à l'appui.",
    publierSurSite: true,
    annonceIlYaJours: 16,
  },
  {
    cle: "kouassi",
    prenom: "Jean-Marc",
    nom: "Kouassi",
    email: "jean-marc.kouassi",
    slug: "jean-marc-kouassi",
    titre: "Ingénieur réseaux et télécommunications",
    localisation: "Paris, France",
    site: null,
    bio: "Ingénieur réseaux chez un opérateur européen après des débuts à Abidjan, Jean-Marc Kouassi a déployé des réseaux mobiles en Côte d'Ivoire et au Sénégal. Il enseigne les réseaux par la pratique : câbles, adresses IP et vraies pannes.",
    publierSurSite: false,
    annonceIlYaJours: null,
  },
  {
    cle: "coulibaly",
    prenom: "Fatou",
    nom: "Coulibaly",
    email: "fatou.coulibaly",
    slug: "fatou-coulibaly",
    titre: "Expert-comptable",
    localisation: "Yamoussoukro, Côte d'Ivoire",
    site: "yamoussoukro",
    bio: "Expert-comptable inscrite à l'Ordre (OECCA-CI), Fatou Coulibaly tient la comptabilité de commerçants et de PME de la région des Lacs. Elle enseigne le SYSCOHADA avec des cas tirés de la boutique du quartier.",
    publierSurSite: false,
    annonceIlYaJours: null,
  },
  {
    cle: "yao",
    prenom: "Serge",
    nom: "Yao",
    email: "serge.yao",
    slug: "serge-yao",
    titre: "Ingénieur agronome, spécialiste de la filière cacao",
    localisation: "Azaguié, Côte d'Ivoire",
    site: "azaguie",
    bio: "Ingénieur agronome formé à l'INP-HB de Yamoussoukro, Serge Yao conseille des coopératives de cacao et d'hévéa de la région d'Azaguié. Il fait découvrir aux étudiants toute la chaîne de valeur, de la pépinière à la tablette de chocolat.",
    publierSurSite: false,
    annonceIlYaJours: null,
  },
];

/**
 * Engagement d'un étudiant : il décide de ses présences, de ses copies, de sa
 * progression et de sa dernière connexion (pour que « Qui décroche ? » ait du
 * sens).
 */
type Profil = "assidu" | "regulier" | "fragile" | "decroche";

type DefEtudiant = {
  prenom: string;
  nom: string;
  classe: CleClasse;
  matricule: string;
  telephone: string;
  profil: Profil;
  suivi: "salle" | "telephone" | "ordinateur";
  /** Étudiant qui n'a encore jamais utilisé sa fiche de connexion (parcours de première connexion). */
  jamaisConnecte?: boolean;
};

const ETUDIANTS: DefEtudiant[] = [
  // Riviera · BTS Gestion commerciale 2e année
  { prenom: "Adjoua", nom: "Kouassi", classe: "riv-gc2", matricule: "25GC0311", telephone: "0707215843", profil: "assidu", suivi: "salle" },
  { prenom: "Serge", nom: "Ahoussou", classe: "riv-gc2", matricule: "25GC0312", telephone: "0545127790", profil: "regulier", suivi: "telephone" },
  { prenom: "Grâce", nom: "N'Dri", classe: "riv-gc2", matricule: "25GC0315", telephone: "0101568824", profil: "assidu", suivi: "ordinateur" },
  { prenom: "Moussa", nom: "Koné", classe: "riv-gc2", matricule: "25GC0318", telephone: "0759843021", profil: "regulier", suivi: "salle" },
  { prenom: "Estelle", nom: "Lath", classe: "riv-gc2", matricule: "25GC0321", telephone: "0768220417", profil: "assidu", suivi: "telephone" },
  // Riviera · Licence Entrepreneuriat 3e année
  { prenom: "Emmanuel", nom: "Aké", classe: "riv-le3", matricule: "24LE0104", telephone: "0707654390", profil: "assidu", suivi: "ordinateur" },
  { prenom: "Nadège", nom: "Yapo", classe: "riv-le3", matricule: "24LE0107", telephone: "0555301248", profil: "regulier", suivi: "salle" },
  { prenom: "Cheick", nom: "Diomandé", classe: "riv-le3", matricule: "24LE0111", telephone: "0140987655", profil: "regulier", suivi: "telephone" },
  { prenom: "Prisca", nom: "Gnagne", classe: "riv-le3", matricule: "24LE0113", telephone: "0788462139", profil: "assidu", suivi: "salle" },
  // Yopougon · BTS Informatique 2e année
  { prenom: "Aya", nom: "Koné", classe: "yop-in2", matricule: "25IN0117", telephone: "0707482915", profil: "assidu", suivi: "telephone" },
  { prenom: "Koffi", nom: "Brou", classe: "yop-in2", matricule: "25IN0118", telephone: "0504763321", profil: "assidu", suivi: "ordinateur" },
  { prenom: "Salimata", nom: "Traoré", classe: "yop-in2", matricule: "25IN0121", telephone: "0798104536", profil: "regulier", suivi: "salle" },
  { prenom: "Hervé", nom: "Zadi", classe: "yop-in2", matricule: "25IN0124", telephone: "0153872240", profil: "fragile", suivi: "telephone" },
  { prenom: "Fatou", nom: "Cissé", classe: "yop-in2", matricule: "25IN0126", telephone: "0747395518", profil: "regulier", suivi: "telephone" },
  { prenom: "Jean-Philippe", nom: "Dago", classe: "yop-in2", matricule: "25IN0129", telephone: "0565019873", profil: "assidu", suivi: "salle" },
  // Yopougon · BTS Gestion commerciale 1re année
  { prenom: "Mariam", nom: "Bamba", classe: "yop-gc1", matricule: "26GC0142", telephone: "0709871264", profil: "assidu", suivi: "salle" },
  { prenom: "Ibrahim", nom: "Sanogo", classe: "yop-gc1", matricule: "26GC0144", telephone: "0576248803", profil: "decroche", suivi: "telephone" },
  { prenom: "Christelle", nom: "Koua", classe: "yop-gc1", matricule: "26GC0146", telephone: "0103659927", profil: "fragile", suivi: "telephone" },
  { prenom: "Didier", nom: "Gnahoré", classe: "yop-gc1", matricule: "26GC0147", telephone: "0779540318", profil: "regulier", suivi: "salle" },
  { prenom: "Awa", nom: "Doumbia", classe: "yop-gc1", matricule: "26GC0149", telephone: "0748126650", profil: "regulier", suivi: "telephone", jamaisConnecte: true },
  // Yamoussoukro · BTS Comptabilité 1re année
  { prenom: "Kouamé", nom: "N'Guessan", classe: "yam-co1", matricule: "26CO0203", telephone: "0707339184", profil: "assidu", suivi: "salle" },
  { prenom: "Rachelle", nom: "Konan", classe: "yam-co1", matricule: "26CO0205", telephone: "0556712049", profil: "regulier", suivi: "salle" },
  { prenom: "Arouna", nom: "Fofana", classe: "yam-co1", matricule: "26CO0208", telephone: "0102847753", profil: "regulier", suivi: "telephone" },
  { prenom: "Bénédicte", nom: "Kra", classe: "yam-co1", matricule: "26CO0210", telephone: "0789025416", profil: "assidu", suivi: "salle" },
  // Yamoussoukro · BTS Comptabilité 2e année
  { prenom: "Yao", nom: "Kouadio", classe: "yam-co2", matricule: "25CO0214", telephone: "0758463190", profil: "assidu", suivi: "ordinateur" },
  { prenom: "Aminata", nom: "Diabaté", classe: "yam-co2", matricule: "25CO0217", telephone: "0544098127", profil: "assidu", suivi: "salle" },
  { prenom: "Florent", nom: "Assié", classe: "yam-co2", matricule: "25CO0219", telephone: "0151763392", profil: "fragile", suivi: "telephone" },
  // Azaguié · BTS Agro-business 1re année (internat : la salle d'abord)
  { prenom: "Paul-Henri", nom: "Yobouet", classe: "aza-ab1", matricule: "26AB0302", telephone: "0707580246", profil: "assidu", suivi: "salle" },
  { prenom: "Awa", nom: "Soro", classe: "aza-ab1", matricule: "26AB0304", telephone: "0565431987", profil: "assidu", suivi: "salle" },
  { prenom: "Kouassi", nom: "Ehui", classe: "aza-ab1", matricule: "26AB0305", telephone: "0103926674", profil: "regulier", suivi: "salle" },
  { prenom: "Esther", nom: "Djédjé", classe: "aza-ab1", matricule: "26AB0307", telephone: "0748219035", profil: "regulier", suivi: "salle" },
  { prenom: "Blaise", nom: "Tanoh", classe: "aza-ab1", matricule: "26AB0309", telephone: "0796652810", profil: "regulier", suivi: "telephone" },
  // Azaguié · BTS Agro-business 2e année
  { prenom: "Adama", nom: "Touré", classe: "aza-ab2", matricule: "25AB0311", telephone: "0574306691", profil: "assidu", suivi: "salle" },
  { prenom: "Juliette", nom: "Ahou", classe: "aza-ab2", matricule: "25AB0313", telephone: "0142578806", profil: "regulier", suivi: "salle" },
  { prenom: "Stéphane", nom: "Mel", classe: "aza-ab2", matricule: "25AB0316", telephone: "0709134472", profil: "assidu", suivi: "salle" },
  // M'Batto · BTS Gestion commerciale 1re année
  { prenom: "Affoué", nom: "Kouakou", classe: "mba-gc1", matricule: "26GC0401", telephone: "0707963352", profil: "assidu", suivi: "salle" },
  { prenom: "Jean-Baptiste", nom: "Koffi", classe: "mba-gc1", matricule: "26GC0403", telephone: "0554827719", profil: "decroche", suivi: "telephone" },
  { prenom: "Mariame", nom: "Sylla", classe: "mba-gc1", matricule: "26GC0406", telephone: "0103481265", profil: "regulier", suivi: "salle" },
  { prenom: "Olivier", nom: "Amani", classe: "mba-gc1", matricule: "26GC0408", telephone: "0787310594", profil: "fragile", suivi: "salle" },
  // M'Batto · BTS Gestion commerciale 2e année
  { prenom: "Ange", nom: "N'Goran", classe: "mba-gc2", matricule: "25GC0412", telephone: "0747690231", profil: "assidu", suivi: "salle" },
  { prenom: "Sandrine", nom: "Akissi", classe: "mba-gc2", matricule: "25GC0415", telephone: "0566203478", profil: "regulier", suivi: "telephone" },
  { prenom: "Ismaël", nom: "Kamagaté", classe: "mba-gc2", matricule: "25GC0417", telephone: "0105587943", profil: "assidu", suivi: "salle" },
];

/** L'étudiante mise en avant : Aya Koné, Yopougon, BTS Informatique 2e année. */
const MATRICULE_AYA = "25IN0117";

// ═══════════════════════════════════════════════════════════════════════════
// Les cours et leurs leçons
// ═══════════════════════════════════════════════════════════════════════════

type DefLecon = { titre: string; type?: TypeLecon; url?: string; duree: number; publiee?: boolean; contenu: string };
type DefChapitre = { titre: string; lecons: DefLecon[] };
type CodeCours = (typeof CODES_COURS_DEMO)[number];

type DefCours = {
  code: CodeCours;
  slug: string;
  titre: string;
  formateur: CleFormateur;
  couleur: string;
  classes: CleClasse[];
  description: string;
  objectifs: string;
  accroche: string | null;
  publierSurSite: boolean;
  /** Début du cours (jours avant le semis) et durée en semaines. */
  debutIlYaJours: number;
  semaines: number;
  chapitres: DefChapitre[];
};

const TOUTES_LES_CLASSES = CLASSES.map((c) => c.cle);

const COURS: DefCours[] = [
  // ── IA-101 ───────────────────────────────────────────────────────────────
  {
    code: "IA-101",
    slug: "initiation-intelligence-artificielle",
    titre: "Initiation à l'intelligence artificielle",
    formateur: "diallo",
    couleur: "#E4793A",
    classes: TOUTES_LES_CLASSES,
    description:
      "Comprendre ce qu'est l'intelligence artificielle, ce qu'elle sait faire et ce qu'elle ne sait pas faire, puis l'utiliser dès demain dans une entreprise ivoirienne : rédiger une bonne consigne, vérifier une réponse, protéger ses données. Un cours commun aux cinq campus, en direct depuis Lyon avec Dr Karim Diallo.",
    objectifs: [
      "Expliquer simplement ce qu'est l'intelligence artificielle et ce qu'est un modèle de langage",
      "Rédiger une consigne efficace (rôle, contexte, tâche, format)",
      "Vérifier une réponse de l'IA et repérer une hallucination",
      "Imaginer un usage utile de l'IA pour une PME ou une coopérative ivoirienne",
      "Utiliser l'IA de façon responsable, sans mettre en danger ses données",
    ].join("\n"),
    accroche:
      "Un cours, cinq campus, en direct depuis Lyon : apprenez à utiliser l'intelligence artificielle dans une entreprise ivoirienne, du maquis à la coopérative de cacao.",
    publierSurSite: true,
    debutIlYaJours: 15,
    semaines: 10,
    chapitres: [
      {
        titre: "Découvrir l'intelligence artificielle",
        lecons: [
          {
            titre: "Qu'est-ce que l'intelligence artificielle ?",
            duree: 12,
            contenu: `## Une définition simple

L'**intelligence artificielle** (IA) désigne des programmes capables d'accomplir des tâches qui demandent d'habitude une intelligence humaine : reconnaître une image, comprendre une phrase, prévoir un chiffre, rédiger un texte.

Leur particularité : ils **apprennent à partir d'exemples** au lieu de suivre des règles écrites une à une par un informaticien.

## Programme classique ou IA ?

- **Un programme classique** applique une recette. Le tableur calcule la TVA à 18 % parce qu'on lui a donné la formule. Il ne se trompe jamais… mais il ne sait rien faire d'autre.
- **Un modèle d'IA** a vu des milliers d'exemples. On lui a montré des photos de feuilles de cacaoyer saines et malades ; il a fini par reconnaître seul une feuille malade qu'il n'avait jamais vue.

> **À retenir :** sans données, pas d'IA. La qualité d'une IA dépend d'abord de la qualité des exemples qu'on lui a donnés.

## Un exemple ivoirien

Mme Touré tient un maquis à Adjamé. Chaque samedi, elle se demande combien de poulets acheter. Trop peu : des clients repartent. Trop : de la perte.

Avec deux ans de cahiers de ventes (jour, météo, match à la télé, fin du mois ou non), un petit modèle peut apprendre à **prévoir** : « samedi prochain, entre 38 et 45 poulets ». Mme Touré garde le dernier mot : elle sait qu'il y a un mariage dans le quartier.

## Ce que l'IA ne fait pas

- Elle ne **comprend** pas le monde comme nous : elle repère des régularités.
- Elle n'a pas de **bon sens** : si les exemples sont faux, ses réponses le seront aussi.
- Elle ne **décide** pas à ta place : l'IA propose, l'humain décide.

## Pour vérifier que tu as compris

1. Cite une différence entre un tableur et un modèle d'IA.
2. Pourquoi dit-on « sans données, pas d'IA » ?
3. Donne un exemple de ton quartier où une prévision serait utile.`,
          },
          {
            titre: "L'IA dans la vie quotidienne en Côte d'Ivoire",
            duree: 10,
            contenu: `## Tu utilises déjà l'IA sans le savoir

- **Ton clavier** propose le mot suivant quand tu écris sur WhatsApp : c'est un petit modèle de langage.
- **Ton service de Mobile Money** repère les opérations inhabituelles (un retrait de 300 000 FCFA à 3 h du matin depuis un autre pays) : un modèle détecte la fraude.
- **YouTube ou TikTok** choisissent les vidéos suivantes selon ce que tu as regardé : c'est un modèle de recommandation.
- **La traduction automatique** transforme un message anglais en français en une seconde.

## Dans les entreprises ivoiriennes

- **Commerce** : une boutique en ligne d'Abidjan répond aux questions des clients la nuit grâce à un assistant conversationnel.
- **Agriculture** : des coopératives photographient les feuilles de cacaoyer pour repérer tôt le swollen shoot, la maladie qui fait gonfler les rameaux.
- **Microfinance** : des modèles aident à évaluer le risque d'un petit crédit à partir de l'historique Mobile Money.
- **Santé** : des applications aident à lire des radiographies quand le radiologue est loin.

## Les trois grandes familles

- **Classer** : « est-ce ceci ou cela ? » (spam ou non, feuille saine ou malade).
- **Prévoir un nombre** : ventes du mois, rendement d'une parcelle, prix d'un produit.
- **Générer** : écrire un texte, créer une image, produire une voix. C'est l'**IA générative** (ChatGPT, Claude, Gemini).

> **Le réflexe 2IAE :** devant chaque outil, demande-toi à quelle famille il appartient et quelles données il a reçues.

## Activité

Observe ton téléphone pendant une journée et note trois moments où une IA t'a proposé quelque chose. Partage-les dans le salon du cours.`,
          },
          {
            titre: "Vidéo : c'est quoi l'intelligence artificielle ?",
            type: "video",
            url: "https://www.youtube.com/watch?v=yQLmgw3rClM",
            duree: 9,
            contenu: `Une vidéo de 8 minutes de l'Inria, l'institut français de recherche en sciences du numérique, pour revoir les bases en images.

## En regardant, repère

- la différence entre **programmer** une machine et la faire **apprendre** ;
- pourquoi on parle d'**apprentissage automatique** (machine learning) ;
- un exemple que tu pourrais transposer en Côte d'Ivoire.

> **Données mobiles :** le poids de la vidéo est affiché avant le chargement. En 4G, regarde-la plutôt en wifi ou dans la salle de conférence de ton campus.`,
          },
        ],
      },
      {
        titre: "Les modèles de langage",
        lecons: [
          {
            titre: "Comment fonctionne un modèle de langage",
            duree: 15,
            contenu: `## Prédire le mot suivant

Un **modèle de langage** (ChatGPT, Claude, Gemini…) fait une chose très simple, des milliards de fois : il **prédit la suite la plus probable d'un texte**.

Si l'on écrit « Le garba se mange avec de l'attiéké et du… », tout le monde complète par « thon ». Le modèle fait pareil, après avoir lu une quantité immense de textes : livres, sites web, articles, forums.

## Les jetons (tokens)

Le modèle ne lit pas des mots mais des **jetons** : des morceaux de mots.

- « maquis » peut tenir en un seul jeton ;
- « anticonstitutionnellement » en demande plusieurs ;
- une phrase de 20 mots représente environ 25 à 30 jetons en français.

Les jetons comptent : c'est avec eux qu'on mesure la longueur d'un texte… et le prix d'utilisation d'un modèle.

## Trois étapes pour fabriquer un modèle

1. **Le pré-entraînement** : pendant des semaines, sur des milliers d'ordinateurs, le modèle apprend à prédire le mot suivant sur des milliards de phrases.
2. **L'ajustement** : des humains lui montrent de bonnes réponses pour qu'il devienne un assistant utile et poli.
3. **Les garde-fous** : on lui apprend à refuser les demandes dangereuses et à dire quand il ne sait pas.

## Ce que cela implique

- Le modèle **ne cherche pas la vérité**, il cherche la suite probable : il peut se tromper avec beaucoup d'assurance.
- Il **ne connaît pas l'actualité** postérieure à son entraînement, sauf si on lui donne l'information ou s'il peut consulter Internet.
- Il **n'a pas de mémoire** d'une conversation à l'autre, sauf si l'application la lui rappelle.

> **Exemple :** demande à un modèle le prix du kilo de cacao bord champ cette saison. S'il ne le connaît pas, il peut inventer un chiffre plausible. Le prix officiel est fixé par le Conseil du Café-Cacao : c'est là qu'il faut vérifier.

## Pour vérifier que tu as compris

1. Qu'est-ce qu'un jeton ?
2. Pourquoi un modèle peut-il inventer un chiffre ?
3. Cite les trois étapes de fabrication d'un modèle.`,
          },
          {
            titre: "Rédiger une bonne consigne",
            duree: 15,
            contenu: `## Une consigne, c'est une commande de travail

Parler à un modèle de langage, c'est comme confier un travail à un stagiaire très rapide… qui ne connaît rien de ton entreprise. Plus la consigne est précise, meilleur est le résultat.

## Les quatre ingrédients

- **Le rôle** : qui doit parler ? « Tu es le gérant d'un maquis à Adjamé. »
- **Le contexte** : que doit-il savoir ? « Nous vendons du poulet braisé ; nos clients travaillent dans le quartier. »
- **La tâche** : que doit-il faire ? « Rédige un message pour annoncer notre promotion du week-end. »
- **Le format** : sous quelle forme ? « Trois lignes au plus, ton chaleureux, pour WhatsApp. »

## Avant, après

Consigne trop vague :

\`\`\`
Écris une publicité.
\`\`\`

Consigne efficace :

\`\`\`
Tu es le gérant d'un maquis à Adjamé. Rédige un message WhatsApp
de trois lignes pour annoncer notre poulet braisé à 2 500 FCFA
ce week-end. Ton chaleureux, avec un appel à réserver par message.
\`\`\`

## Trois astuces de pro

- **Donne un exemple** du résultat attendu : le modèle imite très bien.
- **Demande-lui de te poser des questions** s'il lui manque des informations : il inventera moins.
- **Travaille en plusieurs tours** : « Plus court », « Plus formel », « Ajoute le numéro de téléphone ».

> **Attention :** ne mets jamais d'informations confidentielles dans une consigne (mot de passe, numéro de compte, liste complète des clients).

## Exercice

Réécris cette consigne avec les quatre ingrédients : « Fais-moi un message pour vendre des pagnes. »`,
          },
          {
            titre: "Vérifier une réponse de l'IA : hallucinations et biais",
            duree: 12,
            contenu: `## Pourquoi vérifier ?

Un modèle de langage peut produire une réponse **fausse mais très bien écrite**. On appelle cela une **hallucination**. Ce n'est pas un mensonge : le modèle a simplement produit la suite de mots la plus probable.

## La méthode des trois questions

1. **Y a-t-il des chiffres, des dates ou des noms ?** Vérifie-les dans une source fiable : site officiel, document de l'entreprise, texte de loi.
2. **La réponse vaut-elle pour la Côte d'Ivoire ?** Beaucoup de modèles ont surtout lu des textes européens ou américains : taux, lois, prix ou démarches peuvent être ceux d'un autre pays.
3. **Est-ce que je comprends ce que j'utilise ?** Si tu ne sais pas l'expliquer, ne le recopie pas.

## Exemple

Question : « Quel est le taux de TVA en Côte d'Ivoire ? »

Réponse d'un modèle : « Le taux normal est de 20 %. »

C'est **faux** : 20 % est le taux français. En Côte d'Ivoire, le taux normal est de **18 %** (Direction générale des impôts). Une facture calculée à 20 % serait fausse.

## Les biais

Un **biais** apparaît quand les données d'entraînement ne représentent pas tout le monde. Un modèle qui a surtout vu des photos prises en Europe reconnaîtra mal un plat d'attiéké ou un marché de Treichville. Un outil de recrutement entraîné sur d'anciens dossiers peut reproduire leurs injustices.

> **Règle 2IAE :** l'IA propose, l'humain vérifie et décide. Toujours.

## Pour t'entraîner

Pose à un assistant une question sur ta commune (population, date de création, spécialités), puis vérifie chaque information. Combien étaient justes ?`,
          },
          {
            titre: "Vidéo : comment fonctionne ChatGPT ?",
            type: "video",
            url: "https://www.youtube.com/watch?v=K8gOvC8gvB4",
            duree: 5,
            contenu: `Cinq minutes pour revoir le fonctionnement d'un modèle comme ChatGPT, par l'équipe Flowers de l'Inria.

## En regardant, repère

- le rôle de la **prédiction du mot suivant** ;
- ce que change l'**ajustement par des humains** ;
- les **limites** citées à la fin.

> **Pour aller plus loin :** la vidéo de ScienceÉtonnante « Ce qui se cache derrière le fonctionnement de ChatGPT » (27 min) détaille les réseaux de neurones. À regarder en wifi.`,
          },
        ],
      },
      {
        titre: "L'IA au service des PME ivoiriennes",
        lecons: [
          {
            titre: "Cas pratique : un assistant WhatsApp pour un maquis",
            duree: 15,
            contenu: `## Le problème

Le maquis « Chez Tantie Rose », à Yopougon, reçoit chaque soir une cinquantaine de messages WhatsApp : « Vous êtes ouverts ? », « C'est combien le poisson braisé ? », « Vous livrez à Niangon ? ». Tantie Rose n'a pas le temps de répondre à tout : des commandes sont perdues.

## La solution envisagée

Un assistant qui répond aux questions simples à partir d'une fiche préparée par Tantie Rose :

- horaires : tous les jours de 11 h à 23 h ;
- menu et prix : poisson braisé 3 000 FCFA, poulet braisé 2 500 FCFA, attiéké 500 FCFA ;
- livraison : Niangon, Selmer et Maroc, 500 FCFA ;
- paiement : espèces ou Mobile Money.

## Les étapes

1. **Rassembler les informations** fiables : menu, prix, zones de livraison.
2. **Écrire la consigne** de l'assistant : rôle, ton, ce qu'il doit faire et ne pas faire (« Si tu ne sais pas, dis que Tantie Rose rappellera. »).
3. **Tester** avec vingt vraies questions de clients.
4. **Surveiller** : chaque soir, Tantie Rose relit les conversations pendant cinq minutes.

## Ce qu'il faut calculer

- **Le coût** : quelques milliers de FCFA par mois pour un usage modeste.
- **Le gain** : si l'assistant sauve seulement trois commandes de 3 000 FCFA par soir, cela fait environ 270 000 FCFA par mois.

> **La limite :** l'assistant ne gère ni les réclamations ni les commandes spéciales. Pour cela, un humain reprend la main.

## À toi

Choisis une petite entreprise de ton quartier. Quelles sont les cinq questions que ses clients posent le plus souvent ?`,
          },
          {
            titre: "IA, agriculture et cacao",
            duree: 12,
            contenu: `## Pourquoi l'agriculture ?

La Côte d'Ivoire produit près de 40 % du cacao mondial. Des centaines de milliers de familles vivent de parcelles de quelques hectares : chaque kilo gagné ou perdu compte.

## Trois usages concrets

- **Détecter les maladies** : l'agriculteur photographie une feuille ou une cabosse ; un modèle signale un risque de swollen shoot ou de pourriture brune. Plus la maladie est repérée tôt, plus on sauve d'arbres.
- **Prévoir la récolte** : en combinant la pluie, l'âge des arbres et les récoltes passées, un modèle estime la production de la saison. La coopérative prévoit mieux ses camions et sa trésorerie.
- **Conseiller en langue locale** : des services vocaux répondent aux questions des producteurs par téléphone, parfois en baoulé ou en dioula.

## Les conditions du succès

- des **données locales** : un modèle entraîné au Brésil connaît mal les parcelles d'Azaguié ;
- des **conseillers agricoles** qui vérifient et expliquent ;
- un **coût** adapté : un téléphone simple et peu de données mobiles.

> **L'IA propose, l'agriculteur décide :** une prévision est une estimation, jamais une certitude.

## Réflexion

« L'IA peut-elle aider un agriculteur à prévoir sa récolte ? » Réponds en trois phrases à cette question posée par M'Batto pendant la séance 1.`,
          },
          {
            titre: "Utiliser l'IA de façon responsable",
            duree: 10,
            publiee: false,
            contenu: `## Brouillon en préparation

- Confidentialité des données des clients et des salariés
- Citer ses sources et dire quand on a utilisé l'IA
- IA et devoirs : apprendre, pas recopier
- La charte IA du campus 2IAE`,
          },
        ],
      },
    ],
  },

  // ── ENT-210 ──────────────────────────────────────────────────────────────
  {
    code: "ENT-210",
    slug: "creation-entreprise-business-plan",
    titre: "Création d'entreprise et business plan",
    formateur: "bamba",
    couleur: "#2F7D5B",
    classes: ["riv-gc2", "riv-le3", "yop-in2", "yop-gc1"],
    description:
      "De l'idée au premier client : trouver un besoin réel, étudier son marché sans gros budget, construire un business plan chiffré en FCFA, calculer son seuil de rentabilité, choisir sa forme juridique et financer son projet en Côte d'Ivoire. Avec Aïcha Bamba, entrepreneure à Abidjan.",
    objectifs: [
      "Transformer une observation du quotidien en idée d'entreprise",
      "Mener une étude de marché simple et chiffrée",
      "Rédiger les rubriques d'un business plan",
      "Calculer un seuil de rentabilité",
      "Choisir une forme juridique et une solution de financement adaptées",
    ].join("\n"),
    accroche: "De l'idée au premier client : construisez un business plan solide, chiffré en FCFA, avec une entrepreneure d'Abidjan.",
    publierSurSite: true,
    debutIlYaJours: 12,
    semaines: 12,
    chapitres: [
      {
        titre: "De l'idée au projet",
        lecons: [
          {
            titre: "Trouver une idée qui répond à un vrai besoin",
            duree: 12,
            contenu: `## Partir d'un problème, pas d'un produit

Les entreprises qui durent résolvent un **problème réel** pour des clients prêts à payer. Avant de dire « je veux ouvrir une boutique », demande-toi : **quel problème je résous, et pour qui ?**

## Trois sources d'idées autour de toi

- **Ce qui t'agace** : les longues files pour recharger du crédit, les livraisons qui n'arrivent jamais à l'heure.
- **Ce que les gens font encore à la main** : les commandes notées sur un cahier, les tontines suivies sur papier.
- **Ce qui manque dans ton quartier** : pas de pressing à Yopougon Sideci ? pas de jus naturels près de l'université ?

## Le test de la bonne idée

- **Le besoin existe-t-il ?** Au moins dix personnes te disent qu'elles ont ce problème.
- **Sont-elles prêtes à payer ?** Combien, et à quelle fréquence ?
- **Peux-tu le faire ?** Avec tes compétences, ton temps et un petit budget de départ.

> **Exemple :** Awa, étudiante à Yopougon, remarque que ses camarades n'ont pas le temps de déjeuner entre deux cours. Elle propose de l'attiéké-poisson livré à midi, commandé la veille sur WhatsApp. Après une semaine de test, elle a déjà vingt clients réguliers.

## À faire

Note trois problèmes que tu observes cette semaine dans ton quartier ou sur ton campus. Pour chacun : qui a ce problème, et combien serait-il prêt à payer pour le résoudre ?`,
          },
          {
            titre: "Étudier son marché sans gros budget",
            duree: 14,
            contenu: `## Pourquoi une étude de marché ?

Elle répond à trois questions : **qui** sont mes clients, **combien** sont-ils, et **qui** leur vend déjà quelque chose ?

## La méthode en quatre étapes

1. **Observer** : passe deux heures devant le lieu où tu veux t'installer. Compte les passants, note les heures de pointe.
2. **Interroger** : pose cinq questions simples à au moins vingt clients possibles (habitudes, prix payé aujourd'hui, ce qui manque).
3. **Visiter les concurrents** : leurs prix, leur accueil, leurs horaires, ce que les clients leur reprochent.
4. **Chiffrer** : combien de clients par jour, quel panier moyen, quel chiffre d'affaires possible.

## Les outils gratuits

- un **questionnaire en ligne** partagé sur les groupes WhatsApp du quartier ;
- les **statistiques de l'INS** (Institut national de la statistique) pour la population d'une commune ;
- les **pages Facebook** des concurrents : commentaires et avis des clients.

> **Piège classique :** n'interroger que sa famille et ses amis. Ils te diront que ton idée est géniale. Va vers de vrais inconnus.

## Exemple chiffré

Un kiosque de jus de bissap près d'une gare routière : 800 passants par heure aux heures de pointe, 2 % achètent une bouteille à 300 FCFA, soit 16 bouteilles et environ 4 800 FCFA de recettes par heure de pointe.`,
          },
          {
            titre: "Vidéo : comment faire un business plan ?",
            type: "video",
            url: "https://www.youtube.com/watch?v=LqGKHqT2sro",
            duree: 4,
            contenu: `Une vidéo courte de « La finance pour tous » pour avoir la vue d'ensemble avant le chapitre 2.

## En regardant, note

- les **grandes parties** d'un business plan ;
- à **qui** il sert : toi, ton banquier, tes associés ;
- ce qui rend un business plan **crédible**.

> Les montants de la vidéo sont en euros : dans tes exercices, raisonne toujours en FCFA et avec des prix ivoiriens.`,
          },
        ],
      },
      {
        titre: "Le business plan",
        lecons: [
          {
            titre: "Les rubriques d'un business plan",
            duree: 12,
            contenu: `## À quoi sert un business plan ?

C'est le **mode d'emploi** de ton projet. Il sert d'abord à te convaincre toi-même, puis à convaincre ceux qui peuvent t'aider : banque, microfinance, associés, famille.

## Les sept rubriques

- **Le résumé** : ton projet en une page (à écrire en dernier).
- **Le porteur de projet** : ton parcours, tes compétences, ta motivation.
- **Le produit ou le service** : ce que tu vends, à quel besoin tu réponds.
- **Le marché** : clients, concurrents, résultats de ton étude de marché.
- **La stratégie commerciale** : prix, lieu de vente, communication (WhatsApp, bouche-à-oreille, affiches).
- **L'organisation** : qui fait quoi, forme juridique, fournisseurs.
- **Le plan financier** : investissements, charges, chiffre d'affaires prévu, seuil de rentabilité, financement.

> **Le conseil d'Aïcha :** un banquier lit d'abord le résumé et le plan financier. S'ils ne sont pas clairs, il ne lira pas le reste.

## La bonne longueur

Pour un petit projet : 10 à 15 pages, des phrases courtes, des chiffres expliqués. Mieux vaut un plan simple et juste qu'un document épais et flou.`,
          },
          {
            titre: "Prévoir son chiffre d'affaires et ses charges",
            duree: 15,
            contenu: `## Le chiffre d'affaires prévisionnel

Chiffre d'affaires = **quantité vendue × prix de vente**.

Pars de ton étude de marché, pas de tes rêves. Prévois mois par mois : les débuts sont lents et certains mois sont meilleurs (fêtes de fin d'année, rentrée, Tabaski).

## Les deux familles de charges

- **Les charges fixes** ne dépendent pas des ventes : loyer, salaire d'un employé, abonnement internet, forfait téléphonique.
- **Les charges variables** augmentent avec chaque vente : matières premières, emballages, frais de livraison, frais Mobile Money.

## Les investissements

Ce que tu achètes une fois pour plusieurs années : congélateur, moto de livraison, ordinateur. On ne les compte pas en entier dans les charges du premier mois : on les répartit sur leur durée d'utilisation. C'est l'**amortissement**.

> **Exemple :** un congélateur de 360 000 FCFA utilisé pendant 3 ans représente une charge d'amortissement de 120 000 FCFA par an, soit 10 000 FCFA par mois.

## Exemple : jus de bissap en bouteille

- prix de vente : 500 FCFA la bouteille ;
- charges variables : fleurs, sucre, arômes et bouteille, soit 200 FCFA par bouteille ;
- charges fixes par mois : loyer du kiosque 25 000 FCFA, électricité 10 000 FCFA, amortissement du congélateur 10 000 FCFA, soit 45 000 FCFA.`,
          },
          {
            titre: "Calculer son seuil de rentabilité",
            duree: 15,
            contenu: `## La question qui compte

« Combien dois-je vendre pour ne plus perdre d'argent ? » La réponse s'appelle le **seuil de rentabilité**.

## La marge sur coût variable

Sur chaque vente, une partie paie les charges variables ; ce qui reste sert à payer les charges fixes. C'est la **marge sur coût variable**.

Pour le jus de bissap : 500 − 200 = **300 FCFA de marge par bouteille**.

## Le calcul

Seuil de rentabilité (en quantité) = **charges fixes ÷ marge unitaire**.

45 000 ÷ 300 = **150 bouteilles par mois**, soit 5 à 6 bouteilles par jour.

En dessous de 150 bouteilles, le kiosque perd de l'argent ; au-dessus, chaque bouteille vendue rapporte 300 FCFA de bénéfice.

## Et en chiffre d'affaires ?

150 bouteilles × 500 FCFA = **75 000 FCFA de chiffre d'affaires mensuel** à atteindre.

> **À retenir :** un projet est viable si ton étude de marché montre que tu peux dépasser le seuil de rentabilité, avec une marge de sécurité.

## À toi

Reprends ton projet : prix de vente, coût variable par unité, charges fixes mensuelles. Calcule ton seuil : c'est le devoir de la semaine.`,
          },
        ],
      },
      {
        titre: "Lancer son activité en Côte d'Ivoire",
        lecons: [
          {
            titre: "Choisir sa forme juridique",
            duree: 12,
            contenu: `## Plusieurs statuts possibles

- **L'entreprenant** : statut simplifié de l'OHADA pour démarrer seul une petite activité, avec des formalités et une comptabilité allégées.
- **L'entreprise individuelle** : tu exerces en ton nom ; c'est simple, mais tes biens personnels répondent des dettes.
- **La SARL unipersonnelle (SARLU)** : une société avec un seul associé ; ton patrimoine personnel est protégé.
- **La SARL** : deux associés ou plus, adaptée à un projet porté à plusieurs.

## Où faire les démarches ?

Au **guichet unique du CEPICI**, à Abidjan, ou dans ses antennes : immatriculation au registre du commerce, déclarations fiscale et sociale au même endroit. Beaucoup de formalités peuvent être préparées en ligne.

## Comment choisir ?

- Tu testes une petite activité seul : **entreprenant**.
- Tu veux protéger tes biens et grandir : **SARLU**.
- Vous êtes plusieurs : **SARL**, avec des statuts clairs sur qui apporte quoi.

> **Vérifie toujours** les montants et les formalités à jour auprès du CEPICI : ils évoluent. Ce cours te donne les repères, pas les tarifs du jour.`,
          },
          {
            titre: "Financer son projet : tontine, microfinance, banque",
            duree: 12,
            contenu: `## Commencer petit

La plupart des entreprises ivoiriennes démarrent avec l'**épargne personnelle** et l'aide de la famille. Commencer petit permet de tester le marché sans s'endetter.

## Les solutions de financement

- **La tontine** : chaque membre cotise régulièrement et reçoit la cagnotte à tour de rôle. Pratique pour un premier achat de matériel.
- **La microfinance** : de petits montants, souvent avec un groupe de caution solidaire.
- **La banque** : pour des montants plus importants, avec un business plan solide et souvent une garantie.
- **Les programmes publics et les concours** : fonds d'appui à l'entrepreneuriat des jeunes, concours de plans d'affaires, incubateurs.
- **Le financement participatif** : des proches ou des inconnus soutiennent le projet en ligne.

## Mobile Money, un allié

Encaisser par Mobile Money sécurise les recettes et garde une trace des ventes… et cet historique peut aider à obtenir un microcrédit.

> **Règle de prudence :** ne jamais emprunter plus que ce que ton activité peut rembourser. Calcule tes mensualités avant de signer.`,
          },
        ],
      },
    ],
  },

  // ── INF-230 ──────────────────────────────────────────────────────────────
  {
    code: "INF-230",
    slug: "reseaux-telecommunications",
    titre: "Réseaux et télécommunications",
    formateur: "kouassi",
    couleur: "#2B5DA8",
    classes: ["yop-in2"],
    description:
      "Comprendre comment les données voyagent, du câble RJ45 à la 4G : modèles OSI et TCP/IP, adressage IP, sous-réseaux, réseaux mobiles, et l'installation complète du réseau d'une PME. Avec Jean-Marc Kouassi, ingénieur réseaux à Paris.",
    objectifs: [
      "Décrire les éléments d'un réseau local et leur rôle",
      "Situer un protocole dans les modèles OSI et TCP/IP",
      "Calculer un plan d'adressage IP avec des sous-réseaux",
      "Expliquer le fonctionnement d'un réseau mobile",
      "Installer et dépanner le réseau d'une petite entreprise",
    ].join("\n"),
    accroche: null,
    publierSurSite: false,
    debutIlYaJours: 11,
    semaines: 12,
    chapitres: [
      {
        titre: "Les bases des réseaux",
        lecons: [
          {
            titre: "Qu'est-ce qu'un réseau informatique ?",
            duree: 10,
            contenu: `## Définition

Un **réseau informatique** relie des appareils (ordinateurs, téléphones, imprimantes, serveurs) pour qu'ils échangent des données et partagent des ressources : une connexion internet, une imprimante, des fichiers.

## Les tailles de réseau

- **LAN** (réseau local) : le cybercafé, la salle informatique du campus, les bureaux d'une PME.
- **MAN** (réseau métropolitain) : les agences d'une banque reliées dans Abidjan.
- **WAN** (réseau étendu) : Internet, ou le réseau national d'un opérateur mobile.

## Le matériel de base

- **La carte réseau** (filaire ou wifi) de chaque appareil.
- **Le switch** (commutateur) : relie les appareils d'un même réseau local.
- **Le routeur** : relie le réseau local à Internet. La « box » d'un fournisseur d'accès est un routeur.
- **Le point d'accès wifi** : permet aux téléphones et aux portables de se connecter sans câble.
- **Les câbles** : paire torsadée (RJ45) pour le réseau local, fibre optique pour les longues distances.

> **Exemple :** au cybercafé « Net Plus » de Yopougon, 12 ordinateurs sont reliés à un switch, lui-même relié à la box fibre. Les clients sur téléphone passent par le point d'accès wifi.

## Pour vérifier que tu as compris

1. Quelle est la différence entre un switch et un routeur ?
2. Le réseau d'un cybercafé est-il un LAN ou un WAN ?`,
          },
          {
            titre: "Vidéo : les modèles OSI et TCP/IP",
            type: "video",
            url: "https://www.youtube.com/watch?v=26jazyc7VNk",
            duree: 11,
            contenu: `Une vidéo de la chaîne Cookie connecté pour comprendre comment un message voyage d'un ordinateur à l'autre.

## Les sept couches du modèle OSI

- **7 · Application** : ce que voit l'utilisateur (navigateur, WhatsApp).
- **6 · Présentation** : format et chiffrement des données.
- **5 · Session** : ouverture et fermeture du dialogue.
- **4 · Transport** : découpage en segments, fiabilité (TCP, UDP).
- **3 · Réseau** : adresses IP et routage.
- **2 · Liaison** : adresses MAC, trames, switch.
- **1 · Physique** : câbles, ondes wifi, signaux.

> **Moyen mnémotechnique :** « Pour Le Réseau, Tout Se Passe Automatiquement », de la couche 1 à la couche 7.

Le modèle **TCP/IP**, celui d'Internet, regroupe ces couches en quatre : accès réseau, Internet, transport, application.`,
          },
          {
            titre: "Adressage IP et masques de sous-réseau",
            duree: 20,
            contenu: `## L'adresse IP

Chaque appareil d'un réseau reçoit une **adresse IP**, comme une adresse postale. En IPv4, elle s'écrit en quatre nombres de 0 à 255 : \`192.168.1.25\`.

## Partie réseau et partie hôte

Le **masque de sous-réseau** indique quelle partie de l'adresse désigne le réseau et quelle partie désigne l'appareil.

\`\`\`
Adresse   : 192.168.10.37
Masque    : 255.255.255.0   (noté /24)
Réseau    : 192.168.10.0
Hôtes     : de 192.168.10.1 à 192.168.10.254
Diffusion : 192.168.10.255
\`\`\`

Avec un /24, on dispose de **254 adresses** utilisables : largement assez pour un cybercafé.

## Les adresses privées

Dans un réseau local, on utilise des adresses **privées**, qui ne circulent pas sur Internet :

- 10.0.0.0/8
- 172.16.0.0/12
- 192.168.0.0/16

La box traduit ces adresses privées en une adresse publique : c'est le **NAT**.

## Découper en sous-réseaux

Une PME d'Adjamé veut séparer le wifi des clients du réseau de la caisse. Elle découpe 192.168.10.0/24 en deux /25 :

- caisse et bureaux : 192.168.10.0/25 (hôtes .1 à .126) ;
- wifi des clients : 192.168.10.128/25 (hôtes .129 à .254).

> **Astuce :** chaque bit ajouté au masque divise le réseau en deux. Un /26 donne quatre sous-réseaux de 62 hôtes.`,
          },
        ],
      },
      {
        titre: "Réseaux mobiles et réseau d'entreprise",
        lecons: [
          {
            titre: "De la 2G à la 5G : les réseaux mobiles",
            duree: 12,
            contenu: `## Une révolution en vingt ans

- **2G** : appels et SMS ; c'est aussi le réseau du Mobile Money par codes USSD, qui fonctionne sans internet.
- **3G** : premiers usages d'internet mobile, WhatsApp, e-mails.
- **4G** : vidéo, visioconférence, cours en direct depuis un téléphone.
- **5G** : très haut débit et faible latence ; déploiement en cours dans les grandes villes.

## Comment ça marche ?

Le territoire est découpé en **cellules**, chacune couverte par une **antenne relais**. Quand tu te déplaces, ton téléphone passe d'une antenne à l'autre sans couper l'appel : c'est le **handover**.

Les antennes sont reliées au cœur de réseau de l'opérateur par **fibre optique** ou par **faisceau hertzien**.

## Pourquoi le débit varie ?

- **La distance** à l'antenne et les obstacles (murs, collines).
- **Le nombre d'utilisateurs** dans la même cellule au même moment.
- **La technologie** disponible sur place : 4G en ville, parfois seulement 3G ou 2G en zone rurale.

> **Au campus :** c'est pour cela que le live propose le mode audio et diapos. En 3G ou en fin de forfait, on garde le son et les diapos pour quelques mégas.`,
          },
          {
            titre: "Installer le réseau d'une PME",
            duree: 18,
            contenu: `## Le cahier des charges

Une agence de voyages de Cocody : 6 postes de travail, 1 imprimante, 1 caméra de surveillance, et le wifi pour les clients qui patientent.

## Le matériel

- **1 box fibre** de l'opérateur (routeur et NAT) ;
- **1 switch 16 ports** pour les postes, l'imprimante et la caméra ;
- **1 point d'accès wifi** séparé pour les clients ;
- **des câbles RJ45** de catégorie 6, posés dans des goulottes ;
- **un onduleur** : indispensable en cas de coupure de courant.

## Le plan d'adressage

- box : 192.168.1.1 (passerelle) ;
- postes : adresses distribuées automatiquement par **DHCP**, de .100 à .150 ;
- imprimante et caméra : adresses **fixes** (192.168.1.10 et .11) pour les retrouver facilement ;
- wifi des clients : réseau séparé (192.168.50.0/24), sans accès aux postes.

## La sécurité minimale

- changer le mot de passe d'administration de la box ;
- wifi en **WPA2 ou WPA3**, avec un mot de passe long ;
- mises à jour régulières ;
- sauvegarde des fichiers importants hors du bureau.

> **Dépannage :** quand « internet ne marche pas », vérifie dans l'ordre le câble, l'adresse IP du poste (ipconfig), la passerelle (ping 192.168.1.1), puis un site extérieur (ping 8.8.8.8). Tu remontes les couches du modèle OSI.`,
          },
        ],
      },
    ],
  },

  // ── GES-120 ──────────────────────────────────────────────────────────────
  {
    code: "GES-120",
    slug: "comptabilite-generale",
    titre: "Comptabilité générale",
    formateur: "coulibaly",
    couleur: "#7A4FA0",
    classes: ["yam-co1", "yam-co2", "mba-gc1", "mba-gc2"],
    description:
      "Les fondamentaux de la comptabilité selon le SYSCOHADA révisé : bilan, compte de résultat, plan de comptes, partie double, journal et TVA ivoirienne. Des cas tirés de la boutique du quartier et du grand marché, avec Fatou Coulibaly, expert-comptable à Yamoussoukro.",
    objectifs: [
      "Expliquer à quoi servent le bilan et le compte de résultat",
      "Classer un élément à l'actif ou au passif",
      "Retrouver un compte dans le plan SYSCOHADA",
      "Passer une écriture au journal en partie double",
      "Calculer la TVA à payer",
    ].join("\n"),
    accroche: null,
    publierSurSite: false,
    debutIlYaJours: 13,
    semaines: 14,
    chapitres: [
      {
        titre: "Les fondamentaux",
        lecons: [
          {
            titre: "À quoi sert la comptabilité ?",
            duree: 10,
            contenu: `## Une photographie et un film

La comptabilité enregistre toutes les opérations d'une entreprise pour répondre à deux questions :

- **Que possède l'entreprise et que doit-elle ?** C'est la photographie : le **bilan**.
- **A-t-elle gagné ou perdu de l'argent sur l'année ?** C'est le film : le **compte de résultat**.

## À qui sert-elle ?

- **Au commerçant** : savoir s'il gagne vraiment de l'argent, fixer ses prix, prévoir sa trésorerie.
- **À l'administration fiscale** : calculer les impôts (TVA, impôt sur les bénéfices).
- **À la banque** : accorder ou non un crédit.
- **Aux associés** : connaître la santé de leur entreprise.

## Le cadre en Côte d'Ivoire : le SYSCOHADA

La Côte d'Ivoire applique le **SYSCOHADA révisé**, le système comptable commun aux 17 pays de l'OHADA : même plan de comptes et mêmes règles, de Dakar à Libreville.

> **Exemple :** Mme Yao vend des pagnes au grand marché de Yamoussoukro. Sans comptabilité, elle croit gagner 150 000 FCFA par mois. En notant tout, elle découvre que le transport et les crédits non remboursés lui coûtent 60 000 FCFA : son vrai bénéfice est de 90 000 FCFA.`,
          },
          {
            titre: "Le bilan : actif et passif",
            duree: 15,
            contenu: `## L'actif : ce que l'entreprise possède

- **Actif immobilisé** : ce qui reste longtemps (local, véhicule, machines, ordinateurs).
- **Actif circulant** : ce qui tourne vite (stocks de marchandises, créances sur les clients).
- **Trésorerie-actif** : l'argent disponible (caisse, banque, compte Mobile Money).

## Le passif : d'où vient l'argent

- **Capitaux propres** : l'apport du propriétaire et les bénéfices laissés dans l'entreprise.
- **Dettes financières** : emprunts auprès d'une banque ou d'une microfinance.
- **Passif circulant** : dettes envers les fournisseurs, l'État, les salariés.

## L'équilibre

**Total actif = total passif.** Tout ce que possède l'entreprise a été financé par quelqu'un : le propriétaire ou des prêteurs.

## Exemple : la boutique de M. Konan (en FCFA)

À l'actif :

- matériel et étagères : 800 000
- stock de marchandises : 1 200 000
- banque et caisse : 500 000
- total de l'actif : **2 500 000**

Au passif :

- capital apporté : 1 500 000
- emprunt auprès d'une microfinance : 600 000
- dettes fournisseurs : 400 000
- total du passif : **2 500 000**`,
          },
          {
            titre: "Vidéo : le bilan expliqué en trois minutes",
            type: "video",
            url: "https://www.youtube.com/watch?v=P-qVuULBcs0",
            duree: 4,
            contenu: `Une vidéo de la Banque de France (programme EDUCFI) pour revoir le bilan en trois minutes.

## Après la vidéo, réponds

- Le stock de marchandises est-il à l'actif ou au passif ?
- Un emprunt bancaire augmente-t-il l'actif, le passif, ou les deux ?

> Le vocabulaire de la vidéo suit le plan comptable français : en SYSCOHADA, les idées sont les mêmes mais les numéros de comptes diffèrent (leçon 2.1).`,
          },
        ],
      },
      {
        titre: "Enregistrer les opérations (SYSCOHADA)",
        lecons: [
          {
            titre: "Le plan comptable SYSCOHADA",
            duree: 12,
            contenu: `## Neuf classes de comptes

- **Classe 1** : ressources durables (capital, emprunts).
- **Classe 2** : actif immobilisé (terrains, matériel, véhicules).
- **Classe 3** : stocks.
- **Classe 4** : tiers (fournisseurs 401, clients 411, État 44…).
- **Classe 5** : trésorerie (banques 521, caisse 571).
- **Classe 6** : charges des activités ordinaires (achats de marchandises 601, transports 61…).
- **Classe 7** : produits des activités ordinaires (ventes de marchandises 701…).
- **Classe 8** : autres charges et autres produits (hors activités ordinaires).
- **Classe 9** : engagements hors bilan et comptabilité analytique.

## Lire un numéro de compte

Le premier chiffre donne la classe, les suivants précisent. Exemple : **571 Caisse** appartient à la classe 5, la trésorerie.

> **Astuce :** les classes 1 à 5 alimentent le bilan ; les classes 6 à 8 alimentent le compte de résultat.`,
          },
          {
            titre: "La partie double et le journal",
            duree: 18,
            contenu: `## Le principe de la partie double

Chaque opération touche **au moins deux comptes** : l'un est **débité**, l'autre **crédité**, pour le même montant.

## Débit ou crédit ?

- un compte d'**actif** augmente au débit ;
- un compte de **passif** augmente au crédit ;
- une **charge** s'enregistre au débit ;
- un **produit** s'enregistre au crédit.

## Exemples au journal

Le 3 octobre, la boutique de M. Konan vend des marchandises pour 150 000 FCFA, payées en espèces :

\`\`\`
03/10  571 Caisse                    150 000
           701 Ventes de marchandises          150 000
       Vente au comptant, facture n° 112
\`\`\`

Le 5 octobre, elle achète des marchandises à crédit pour 90 000 FCFA :

\`\`\`
05/10  601 Achats de marchandises     90 000
           401 Fournisseurs                     90 000
       Facture Ets Kouadio n° 45
\`\`\`

> **Vérification :** pour chaque écriture, le total des débits est égal au total des crédits.`,
          },
          {
            titre: "La TVA en Côte d'Ivoire",
            duree: 15,
            contenu: `## Le principe

La **taxe sur la valeur ajoutée** est payée par le consommateur final et collectée par l'entreprise pour le compte de l'État. Le **taux normal est de 18 %** en Côte d'Ivoire ; certains produits bénéficient d'un taux réduit ou sont exonérés.

## HT, TVA, TTC

- **Prix hors taxes (HT)** : 100 000 FCFA
- **TVA à 18 %** : 18 000 FCFA
- **Prix toutes taxes comprises (TTC)** : 118 000 FCFA

Pour retrouver le HT à partir du TTC : **TTC ÷ 1,18**.

## TVA collectée, TVA déductible

- La **TVA collectée** est facturée aux clients sur les ventes (compte 443).
- La **TVA déductible** est payée aux fournisseurs sur les achats (compte 445).
- Chaque mois, l'entreprise reverse à la Direction générale des impôts la différence : **TVA collectée − TVA déductible**.

> **Exemple :** en octobre, TVA collectée 540 000 FCFA, TVA déductible 310 000 FCFA : la TVA à payer est de 230 000 FCFA.`,
          },
        ],
      },
    ],
  },

  // ── AGR-110 ──────────────────────────────────────────────────────────────
  {
    code: "AGR-110",
    slug: "agro-business-chaine-valeur-cacao",
    titre: "Agro-business et chaîne de valeur du cacao",
    formateur: "yao",
    couleur: "#8A5A2B",
    classes: ["aza-ab1", "aza-ab2"],
    description:
      "La filière cacao de la parcelle à la tablette : production, fermentation et séchage, acteurs de la chaîne de valeur, coopératives, certification, et les opportunités d'entreprise de la transformation locale. Un cours ancré dans les plantations d'Azaguié, avec Serge Yao, ingénieur agronome.",
    objectifs: [
      "Situer la place de la Côte d'Ivoire dans la filière cacao mondiale",
      "Décrire les étapes post-récolte qui font la qualité d'une fève",
      "Identifier les acteurs de la chaîne de valeur et leur rôle",
      "Expliquer l'intérêt d'une coopérative et de la certification",
      "Imaginer une activité de transformation locale",
    ].join("\n"),
    accroche: null,
    publierSurSite: false,
    debutIlYaJours: 10,
    semaines: 12,
    chapitres: [
      {
        titre: "La filière cacao",
        lecons: [
          {
            titre: "La Côte d'Ivoire, premier producteur mondial",
            duree: 12,
            contenu: `## Quelques repères

- La Côte d'Ivoire produit environ **2 millions de tonnes** de cacao par an, soit **près de 40 %** de la production mondiale.
- Le cacao représente une part majeure des exportations du pays.
- Entre **600 000 et un million de producteurs** selon les estimations, souvent sur des parcelles de 2 à 5 hectares.

## Les grandes zones de production

Historiquement l'Est, puis le Centre-Ouest et l'Ouest (Soubré, Daloa, Duékoué) ; aujourd'hui aussi le Sud et le Sud-Est, dont la région d'Azaguié.

## Qui fixe le prix ?

Le **Conseil du Café-Cacao** fixe à chaque campagne un **prix minimum garanti bord champ**, payé au producteur. La campagne principale s'ouvre en octobre, la campagne intermédiaire en avril.

## Les défis de la filière

- **Le vieillissement des vergers** et le swollen shoot, qui oblige à arracher des arbres ;
- **La déforestation**, désormais surveillée par les pays importateurs ;
- **Le revenu des producteurs**, encore trop faible ;
- **La transformation locale**, encore minoritaire : l'essentiel des fèves part brut à l'étranger.

> **Question pour la séance :** pourquoi la Côte d'Ivoire gagnerait-elle à transformer davantage son cacao sur place ?`,
          },
          {
            titre: "De la cabosse à la fève : fermentation et séchage",
            duree: 15,
            contenu: `## La récolte

Les cabosses mûres sont cueillies à la machette ou au sécateur, sans blesser le coussinet floral qui donnera les prochaines fleurs. On les écabosse dans les jours qui suivent pour extraire les fèves entourées de leur pulpe blanche.

## La fermentation : l'étape décisive

- Les fèves fraîches sont mises en tas sous des **feuilles de bananier** ou dans des caisses en bois.
- Pendant **5 à 7 jours**, la pulpe fermente et la température monte jusqu'à 45 °C environ.
- On **brasse** le tas tous les deux jours pour l'aérer.
- C'est la fermentation qui développe les **précurseurs de l'arôme** du chocolat.

## Le séchage

- Les fèves sèchent au soleil sur des **claies** surélevées ou sur des bâches, pendant 7 à 15 jours.
- On les remue souvent et on les protège de la pluie.
- Objectif : descendre à **7 à 8 % d'humidité** environ pour éviter les moisissures.

> **Qualité :** une fève bien fermentée et bien séchée se vend mieux. Le test à la coupe montre une couleur brune et une texture bien striée.`,
          },
          {
            titre: "Vidéo : la fermentation des fèves",
            type: "video",
            url: "https://www.youtube.com/watch?v=mbJDfmdAb2A",
            duree: 3,
            contenu: `Trois minutes pour voir la fermentation en vrai, chez un producteur.

## En regardant, observe

- le contenant utilisé pour la fermentation ;
- le moment où l'on brasse les fèves ;
- la couleur des fèves avant et après.

> Compare avec les pratiques que tu connais autour d'Azaguié : feuilles de bananier ou caisses en bois ?`,
          },
        ],
      },
      {
        titre: "Créer de la valeur",
        lecons: [
          {
            titre: "Les acteurs de la chaîne de valeur",
            duree: 12,
            contenu: `## Du champ à la tablette

- **Le producteur** cultive, récolte, fait fermenter et sécher les fèves.
- **La coopérative** regroupe les producteurs, collecte, pèse, paie et organise le transport.
- **Le pisteur ou l'acheteur** achète aux producteurs isolés, avec moins de contrôle sur la pesée et le prix.
- **L'exportateur** conditionne en sacs et expédie depuis les ports d'Abidjan ou de San-Pédro.
- **Le broyeur** transforme les fèves en masse, beurre et poudre de cacao.
- **Le chocolatier** fabrique les tablettes et les confiseries.
- **Le distributeur** vend au consommateur.

## Où va la valeur ?

L'essentiel de la valeur d'une tablette de chocolat se crée **après** la fève : transformation, marque, distribution. Le producteur ne perçoit qu'une petite part du prix final.

> **Enjeu pour le pays :** transformer davantage sur place crée des emplois et garde plus de valeur en Côte d'Ivoire.`,
          },
          {
            titre: "Coopératives, prix bord champ et certification",
            duree: 14,
            contenu: `## Pourquoi une coopérative ?

- **Négocier** de meilleurs prix et de meilleures conditions de transport ;
- **Accéder** aux intrants (engrais, plants améliorés) et au crédit ;
- **Former** les membres aux bonnes pratiques ;
- **Obtenir des primes** grâce à la certification.

## La certification

Des labels comme **Rainforest Alliance** ou **Fairtrade** garantissent des pratiques responsables : pas de travail des enfants, pas de déforestation, meilleure gestion des produits chimiques. En échange, la coopérative reçoit une **prime** par kilo vendu, qu'elle partage entre ses membres ou investit (école, forage, pépinière).

## La traçabilité

Les acheteurs veulent de plus en plus savoir **d'où vient chaque sac** : localisation des parcelles, carte du producteur, pesée enregistrée. Le téléphone et les applications de collecte y jouent un rôle clé.

> **Exemple :** une coopérative de 400 membres près d'Azaguié a investi sa prime dans une pépinière de 50 000 plants pour renouveler les vergers vieillissants.`,
          },
          {
            titre: "Transformer localement : beurre, poudre, chocolat",
            duree: 12,
            contenu: `## Les produits de la transformation

- **La masse (ou pâte) de cacao** : fèves torréfiées et broyées.
- **Le beurre de cacao** : la matière grasse, recherchée par les chocolatiers et les cosmétiques.
- **La poudre de cacao** : pour les boissons et la pâtisserie.
- **Le chocolat** : masse, beurre et sucre, conchés puis tempérés.

## Des idées d'entreprises

- une **chocolaterie artisanale** qui vend des tablettes aux hôtels et aux supermarchés d'Abidjan ;
- une **unité de beurre de cacao** pour les cosmétiques locaux ;
- la **valorisation des cabosses** : la coque sert à faire du compost, de l'aliment pour le bétail ou du savon ;
- un **service de séchage amélioré** (séchoirs solaires) loué aux producteurs.

## Ce qu'il faut maîtriser

- la **qualité** et l'hygiène ;
- l'**énergie** : coût de l'électricité, groupe électrogène ;
- l'**emballage** et la conservation dans un climat chaud et humide ;
- la **commercialisation** : se faire connaître face aux grandes marques importées.

> **Exercice :** choisis une des idées ci-dessus et liste ses trois premiers clients possibles.`,
          },
        ],
      },
    ],
  },
];

/** « L'essentiel en 5 points » validé par le formateur, pour deux leçons d'IA-101 (numéros « 1.1 » et « 2.1 »). */
const FICHES_LECONS: { cours: CodeCours; chapitre: number; lecon: number; contenu: string }[] = [
  {
    cours: "IA-101",
    chapitre: 0,
    lecon: 0,
    contenu: `1. **Une IA apprend à partir d'exemples** : au lieu de suivre des règles écrites à la main, elle repère des régularités dans des milliers de données.
2. **Programme classique ou IA** : le tableur applique une formule (la TVA à 18 %) ; le modèle d'IA a appris seul à reconnaître une feuille de cacaoyer malade.
3. **Sans données, pas d'IA** : la qualité d'une IA dépend d'abord de la qualité des exemples reçus.
4. **Prévoir pour mieux décider** : avec ses cahiers de ventes, un maquis d'Adjamé peut estimer le nombre de poulets à acheter le samedi.
5. **L'IA propose, l'humain décide** : elle n'a ni bon sens ni compréhension du monde ; c'est toi qui gardes le dernier mot.

**À retenir :** une IA est un outil qui apprend à partir de données ; elle aide à décider, elle ne décide pas.`,
  },
  {
    cours: "IA-101",
    chapitre: 1,
    lecon: 0,
    contenu: `1. **Prédire le mot suivant** : un modèle de langage calcule la suite la plus probable d'un texte, mot après mot.
2. **Les jetons** : le modèle lit des morceaux de mots ; ils mesurent la longueur d'un texte et le prix d'utilisation.
3. **Trois étapes de fabrication** : pré-entraînement sur des milliards de phrases, ajustement par des humains, garde-fous.
4. **Probable n'est pas vrai** : le modèle peut inventer un chiffre plausible, comme un faux prix du cacao bord champ.
5. **Pas d'actualité, pas de mémoire** : il ignore ce qui s'est passé après son entraînement, sauf si on le lui donne.

**À retenir :** un modèle de langage écrit très bien, mais chaque chiffre, date ou nom qu'il donne se vérifie.`,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Devoirs et interrogations
// ═══════════════════════════════════════════════════════════════════════════

/** Ce que l'on sait d'un étudiant une fois semé (pour écrire ses copies). */
type EtudiantSeme = DefEtudiant & { id: number; siteId: number; classeId: number; site: SlugSite; rang: number };

type DefQuestion = {
  type: TypeQuestion;
  enonce: string;
  options?: string[];
  bonnes: (number | string)[];
  explication: string;
  points?: number;
  /** Réponse courte : erreurs fréquentes des étudiants (pour les tentatives semées). */
  faux?: string[];
};

/**
 * Scénario d'un devoir au moment du semis :
 *   corrige     : échéance passée, copies corrigées, notes publiées ;
 *   a_venir     : échéance à venir, quelques copies déjà rendues ;
 *   retard      : échéance dépassée depuis peu, retard accepté, pas encore corrigé ;
 *   quiz_ferme  : interrogation terminée, tentatives notées ;
 *   quiz_ouvert : interrogation en cours, quelques tentatives.
 */
type Scenario = "corrige" | "a_venir" | "retard" | "quiz_ferme" | "quiz_ouvert";

type DefDevoir = {
  cle: string;
  cours: CodeCours;
  type: "depot" | "quiz";
  titre: string;
  consigne: string;
  ouvertureJours: number | null;
  limite: { jours: number; h: number; m: number };
  bareme: number;
  coefficient: number;
  accepteRetard: boolean;
  dureeMinutes?: number;
  tentativesMax?: number;
  grille?: CritereGrille[];
  questions?: DefQuestion[];
  scenario: Scenario;
  copie?: (e: EtudiantSeme, h: Hasard) => string;
  commentaire?: (e: EtudiantSeme, niveau: "haut" | "moyen" | "bas") => string;
  /** Note critère par critère tirée du contenu de la copie (sinon : selon le profil). */
  notation?: (e: EtudiantSeme, h: Hasard) => { obtenus: number[]; niveau: "haut" | "moyen" | "bas" };
};

/** Idées de projets des étudiants d'ENT-210 (étude de marché, puis seuil de rentabilité). */
const PROJETS = [
  {
    idee: "livraison d'attiéké-poisson à midi pour les étudiants",
    lieu: "autour du campus de Yopougon",
    besoin: "beaucoup d'étudiants n'ont que 45 minutes de pause et ne peuvent pas aller jusqu'aux maquis.",
    clients: "les étudiants et les employés des bureaux voisins",
    enquete: 32,
    pct: 60,
    concurrents: "deux restaurants de la rue et les vendeuses ambulantes",
    faiblesse: "Les restaurants sont pleins à midi et les vendeuses passent à des heures irrégulières.",
    prix: "1 000 FCFA le plat livré",
    justification: "C'est 200 FCFA de plus qu'au restaurant, mais sans attente et livré en classe.",
    verif: "le temps de livraison réel entre la cuisine et les salles de cours.",
    pv: 1000,
    cv: 600,
    unite: "plats",
    cf: 60000,
    detailCf: "location de la cuisine 30 000, forfait téléphone 5 000, amortissement de la glacière et des sacs 10 000, transport 15 000",
  },
  {
    idee: "jus naturels de bissap, gingembre et passion en bouteille",
    lieu: "près de la gare routière d'Adjamé",
    besoin: "les voyageurs cherchent une boisson fraîche et saine avant de longs trajets.",
    clients: "les voyageurs, les chauffeurs et les commerçants de la gare",
    enquete: 40,
    pct: 55,
    concurrents: "les vendeurs de sodas et d'eau en sachet",
    faiblesse: "Personne ne vend de jus naturel bien frais et bien présenté.",
    prix: "500 FCFA la bouteille de 50 cl",
    justification: "C'est le prix d'un soda : le client choisit le jus pour le goût et la santé.",
    verif: "combien de bouteilles je peux garder au frais sans électricité toute la journée.",
    pv: 500,
    cv: 200,
    unite: "bouteilles",
    cf: 45000,
    detailCf: "loyer du kiosque 25 000, électricité 10 000, amortissement du congélateur 10 000",
  },
  {
    idee: "pressing de quartier avec ramassage à domicile",
    lieu: "à Cocody Riviera",
    besoin: "les familles qui travaillent n'ont pas le temps d'amener leur linge au pressing.",
    clients: "les couples actifs et les cadres célibataires du quartier",
    enquete: 25,
    pct: 48,
    concurrents: "trois pressings classiques à plus d'un kilomètre",
    faiblesse: "Aucun ne propose le ramassage et la livraison.",
    prix: "1 500 FCFA la chemise, 3 000 FCFA le complet",
    justification: "Le prix est proche des concurrents ; le service à domicile fait la différence.",
    verif: "le coût réel de l'essence pour les tournées de ramassage.",
    pv: 1500,
    cv: 700,
    unite: "pièces",
    cf: 160000,
    detailCf: "loyer 60 000, salaire d'un repasseur 60 000, électricité 25 000, carburant de la moto 15 000",
  },
  {
    idee: "atelier de couture de tenues en pagne pour les cérémonies",
    lieu: "à Yopougon Sideci",
    besoin: "les clientes veulent des tenues originales prêtes à temps pour les mariages et les baptêmes.",
    clients: "les femmes de 20 à 45 ans qui vont souvent à des cérémonies",
    enquete: 28,
    pct: 64,
    concurrents: "les couturiers du marché, souvent en retard",
    faiblesse: "Les clientes se plaignent surtout des délais non tenus.",
    prix: "12 000 FCFA la façon d'un ensemble",
    justification: "Un peu plus cher que le marché, mais avec une date de livraison garantie.",
    verif: "combien d'ensembles je peux coudre par semaine avec une seule machine.",
    pv: 12000,
    cv: 4000,
    unite: "ensembles",
    cf: 120000,
    detailCf: "loyer de l'atelier 50 000, salaire d'une apprentie 40 000, électricité 20 000, amortissement de la machine 10 000",
  },
  {
    idee: "réparation de téléphones et vente d'accessoires",
    lieu: "à côté du marché de Yopougon",
    besoin: "les écrans cassés et les batteries usées sont fréquents, et les clients veulent être dépannés vite.",
    clients: "les jeunes et les commerçants du marché",
    enquete: 30,
    pct: 70,
    concurrents: "une dizaine de réparateurs sur le trottoir",
    faiblesse: "Peu donnent une garantie ou un reçu.",
    prix: "5 000 FCFA la main-d'œuvre d'un changement d'écran, pièce en plus",
    justification: "Je donne un reçu et une garantie d'un mois : c'est rassurant pour le client.",
    verif: "la fiabilité de mon fournisseur de pièces à Adjamé.",
    pv: 5000,
    cv: 1500,
    unite: "réparations",
    cf: 105000,
    detailCf: "loyer de la boutique 45 000, électricité 15 000, internet 10 000, amortissement des outils 35 000",
  },
  {
    idee: "salon de coiffure mixte avec rendez-vous sur WhatsApp",
    lieu: "à Riviera Palmeraie",
    besoin: "les clients perdent du temps à attendre leur tour le samedi.",
    clients: "les étudiants et les jeunes actifs du quartier",
    enquete: 35,
    pct: 58,
    concurrents: "quatre salons dans un rayon de 500 mètres",
    faiblesse: "Aucun ne prend de rendez-vous : l'attente dépasse souvent une heure.",
    prix: "2 000 FCFA la coupe homme, à partir de 5 000 FCFA la coiffure femme",
    justification: "Des prix alignés sur le quartier, avec la ponctualité en plus.",
    verif: "si les clients respectent vraiment leurs rendez-vous.",
    pv: 3000,
    cv: 800,
    unite: "prestations",
    cf: 176000,
    detailCf: "loyer 70 000, salaire d'un coiffeur 60 000, électricité et eau 30 000, produits de base 16 000",
  },
  {
    idee: "impression et saisie de documents pour les étudiants",
    lieu: "à l'entrée du campus",
    besoin: "avant les examens, les étudiants font la queue pour imprimer leurs mémoires et leurs cours.",
    clients: "les étudiants et les enseignants",
    enquete: 45,
    pct: 75,
    concurrents: "un cybercafé souvent en panne d'encre",
    faiblesse: "Les pannes et les coupures de courant font fuir les clients.",
    prix: "50 FCFA la page noir et blanc, 1 000 FCFA la reliure",
    justification: "Même prix que le cybercafé, avec un onduleur pour ne jamais s'arrêter.",
    verif: "le coût réel d'une page (encre, papier, électricité).",
    pv: 50,
    cv: 20,
    unite: "pages",
    cf: 90000,
    detailCf: "loyer 40 000, électricité 25 000, amortissement de l'imprimante et de l'onduleur 25 000",
  },
  {
    idee: "savons artisanaux au beurre de karité",
    lieu: "vendus en ligne et dans les boutiques de Cocody",
    besoin: "de plus en plus de clientes cherchent des produits naturels fabriqués en Côte d'Ivoire.",
    clients: "les femmes de 25 à 50 ans soucieuses de leur peau",
    enquete: 30,
    pct: 50,
    concurrents: "les savons importés et quelques marques locales",
    faiblesse: "Les produits importés sont chers et les marques locales peu visibles en ligne.",
    prix: "1 500 FCFA le savon de 100 g",
    justification: "Moins cher qu'un savon importé, avec un emballage soigné.",
    verif: "les règles d'étiquetage des produits cosmétiques.",
    pv: 1500,
    cv: 600,
    unite: "savons",
    cf: 72000,
    detailCf: "location d'un petit local 30 000, publicité en ligne 20 000, emballages de base 12 000, transport 10 000",
  },
];

/** PME choisies par les étudiants pour le devoir « Trois consignes » d'IA-101. */
const ENTREPRISES = [
  {
    nom: "la boutique de cosmétiques de ma cousine à Adjamé",
    role: "la gérante d'une boutique de cosmétiques à Adjamé",
    promo: "notre arrivage de crèmes au karité à 3 500 FCFA",
    infos: "ouvert de 8 h à 20 h sauf dimanche, livraison à Adjamé et au Plateau pour 1 000 FCFA",
    produits: "les crèmes, les savons et les mèches",
    erreur: "des horaires d'ouverture le dimanche",
  },
  {
    nom: "le maquis de mon oncle à Yopougon Niangon",
    role: "le gérant d'un maquis à Yopougon Niangon",
    promo: "le poisson braisé à 3 000 FCFA ce vendredi soir",
    infos: "ouvert tous les soirs de 17 h à minuit, poisson braisé 3 000 FCFA, poulet 2 500 FCFA",
    produits: "le poisson, le poulet, les boissons et le charbon",
    erreur: "un prix du poulet à 4 000 FCFA",
  },
  {
    nom: "le salon de coiffure de ma tante à Koumassi",
    role: "la patronne d'un salon de coiffure à Koumassi",
    promo: "les tresses à 5 000 FCFA toute la semaine de la rentrée",
    infos: "ouvert du mardi au dimanche, rendez-vous par WhatsApp, tresses à partir de 5 000 FCFA",
    produits: "les mèches, les produits capillaires et les serviettes",
    erreur: "une promotion qui n'existait pas",
  },
  {
    nom: "la quincaillerie d'un voisin à Yamoussoukro",
    role: "le gérant d'une quincaillerie à Yamoussoukro",
    promo: "le ciment à 5 200 FCFA le sac livré sur les chantiers de la ville",
    infos: "ouvert de 7 h à 18 h, livraison en ville à partir de 10 sacs",
    produits: "le ciment, le fer à béton, la peinture et les outils",
    erreur: "un prix du sac de ciment trouvé sur un site étranger",
  },
  {
    nom: "la coopérative de cacao de mon village près d'Azaguié",
    role: "le secrétaire d'une coopérative de cacao près d'Azaguié",
    promo: "la journée de formation sur la fermentation de samedi",
    infos: "pesée les mardis et vendredis, paiement par Mobile Money sous 48 h",
    produits: "les sacs de jute, les bâches de séchage et les engrais",
    erreur: "un prix bord champ qui n'était pas celui de la campagne",
  },
  {
    nom: "la boutique de vêtements de ma mère à M'Batto",
    role: "la gérante d'une boutique de vêtements à M'Batto",
    promo: "les tenues de fête à partir de 7 500 FCFA pour Noël",
    infos: "ouvert tous les jours de 8 h à 19 h, paiement en espèces ou par Mobile Money",
    produits: "les pagnes, les chemises et les chaussures",
    erreur: "une adresse de boutique inventée",
  },
];

const prenomDe = (e: EtudiantSeme) => e.prenom.split("-")[0];

const DEVOIRS: DefDevoir[] = [
  // ── IA-101 ───────────────────────────────────────────────────────────────
  {
    cle: "ia-q1",
    cours: "IA-101",
    type: "quiz",
    titre: "Interrogation 1 · Les bases de l'IA",
    consigne:
      "Six questions sur les leçons 1.1 à 1.3. Tu as **20 minutes** et **deux tentatives** : la meilleure note compte.\n\nL'assistant IA se met en pause pendant l'interrogation. La correction détaillée sera visible après l'échéance.",
    ouvertureJours: -12,
    limite: { jours: -5, h: 23, m: 59 },
    bareme: 20,
    coefficient: 1,
    accepteRetard: false,
    dureeMinutes: 20,
    tentativesMax: 2,
    scenario: "quiz_ferme",
    questions: [
      {
        type: "qcm",
        enonce: "Qu'est-ce qui distingue un modèle d'IA d'un programme classique ?",
        options: ["Il est toujours plus rapide", "Il apprend à partir d'exemples", "Il fonctionne sans électricité", "Il ne fait jamais d'erreur"],
        bonnes: [1],
        explication: "Un programme classique applique des règles écrites à la main ; un modèle d'IA construit ses propres règles à partir des données (leçon 1.1).",
      },
      {
        type: "vrai_faux",
        enonce: "Une IA bien programmée donne toujours une réponse juste.",
        bonnes: [1],
        explication: "Faux : une IA peut se tromper, surtout si ses données sont incomplètes ou biaisées. L'humain vérifie et décide.",
      },
      {
        type: "choix_multiple",
        enonce: "Parmi ces outils, lesquels utilisent de l'intelligence artificielle ?",
        options: [
          "La suggestion du mot suivant sur le clavier du téléphone",
          "La détection de fraude sur un compte Mobile Money",
          "Une calculatrice de poche",
          "Les recommandations de vidéos sur YouTube",
        ],
        bonnes: [0, 1, 3],
        explication: "La calculatrice applique des formules fixes ; les trois autres outils reposent sur des modèles qui ont appris à partir de données (leçon 1.2).",
      },
      {
        type: "qcm",
        enonce: "Un modèle qui estime les ventes de pain de la semaine prochaine appartient à quelle famille ?",
        options: ["Les modèles qui classent", "Les modèles qui prévoient un nombre", "Les modèles qui génèrent du texte"],
        bonnes: [1],
        explication: "Il produit un nombre (des ventes) à partir de l'historique : c'est une prévision.",
      },
      {
        type: "reponse_courte",
        enonce: "Sans quoi une IA ne peut-elle pas apprendre ? (un mot)",
        bonnes: ["données", "des données", "les données", "data"],
        faux: ["informations", "internet", "programmes"],
        explication: "Sans données, pas d'IA : la qualité d'un modèle dépend d'abord des exemples qu'il a reçus.",
      },
      {
        type: "qcm",
        enonce: "Que signifie la règle « l'IA propose, l'humain décide » ?",
        options: ["L'IA prend les décisions importantes", "L'humain garde le dernier mot après avoir vérifié", "Il ne faut jamais utiliser l'IA", "L'IA doit être validée par l'État"],
        bonnes: [1],
        explication: "L'IA aide à préparer une décision ; la personne vérifie et reste responsable du choix.",
      },
    ],
  },
  {
    cle: "ia-d2",
    cours: "IA-101",
    type: "depot",
    titre: "Trois consignes pour une PME de ton quartier",
    consigne: `Choisis une **vraie petite entreprise** que tu connais : la boutique d'un parent, un maquis, un salon de coiffure, la coopérative de ton village.

1. Rédige **trois consignes** pour un assistant IA qui l'aiderait : répondre aux clients, préparer une annonce, organiser le stock… Chaque consigne contient un rôle, un contexte, une tâche et un format (leçon 2.2).
2. Sous chaque consigne, colle la **réponse obtenue** (ou résume-la).
3. Ajoute une ligne : **ce que tu as vérifié ou corrigé** (leçon 2.3).

Rends ton travail en texte ou en photo de ton cahier.`,
    ouvertureJours: -6,
    limite: { jours: 3, h: 23, m: 59 },
    bareme: 20,
    coefficient: 2,
    accepteRetard: true,
    grille: [
      { critere: "Qualité des consignes (rôle, contexte, tâche, format)", points: 9 },
      { critere: "Vérification des réponses obtenues", points: 7 },
      { critere: "Présentation et clarté", points: 4 },
    ],
    scenario: "a_venir",
    copie: (e, h) => {
      const b = ENTREPRISES[e.rang % ENTREPRISES.length];
      return [
        `J'ai choisi ${b.nom}.`,
        "",
        "Consigne 1 · Annoncer une promotion",
        `« Tu es ${b.role}. Rédige un message WhatsApp de trois lignes pour annoncer ${b.promo}. Ton chaleureux, avec un appel à commander par message. »`,
        "Réponse : un message court et joyeux, avec le prix et un appel à écrire en privé. Je l'ai raccourci d'une ligne.",
        "",
        "Consigne 2 · Répondre aux clients",
        `« Tu es l'assistant de ${b.role}. Voici nos informations : ${b.infos}. Réponds poliment aux questions des clients. Si tu ne sais pas, dis que nous rappellerons. »`,
        "Réponse : l'assistant a bien répondu à mes cinq questions d'essai.",
        "",
        "Consigne 3 · Organiser le stock",
        `« Aide-moi à préparer une fiche de stock simple pour ${b.produits} : colonnes, quantité minimale, jour de commande. Pose-moi d'abord trois questions. »`,
        "Réponse : il m'a demandé le nombre de produits, la fréquence des livraisons et le budget, puis il a proposé un tableau à cinq colonnes.",
        "",
        `Vérification : dans la première réponse, le modèle avait inventé ${b.erreur}. J'ai vérifié ${h.chance(0.5) ? "sur place" : "par téléphone"} et j'ai corrigé.`,
      ].join("\n");
    },
  },
  // ── ENT-210 ──────────────────────────────────────────────────────────────
  {
    cle: "ent-d1",
    cours: "ENT-210",
    type: "depot",
    titre: "Étude de marché de ton projet",
    consigne: `Présente l'étude de marché de ton idée d'entreprise (leçons 1.1 et 1.2) :

- le **besoin** auquel tu réponds ;
- ta **clientèle** et les résultats de ton enquête (au moins vingt personnes) ;
- la **concurrence** et ses faiblesses ;
- ton **prix** et pourquoi il est juste.

Une à deux pages, en texte ou en photos de ton cahier.`,
    ouvertureJours: -12,
    limite: { jours: -6, h: 23, m: 59 },
    bareme: 20,
    coefficient: 2,
    accepteRetard: true,
    grille: [
      { critere: "Besoin identifié", points: 5 },
      { critere: "Clientèle et enquête", points: 5 },
      { critere: "Concurrence", points: 5 },
      { critere: "Prix et positionnement", points: 5 },
    ],
    scenario: "corrige",
    copie: (e) => {
      const p = PROJETS[e.rang % PROJETS.length];
      return [
        `Mon projet : ${p.idee}, ${p.lieu}.`,
        "",
        `Le besoin : ${p.besoin}`,
        "",
        `Ma clientèle : ${p.clients}. J'ai interrogé ${p.enquete} personnes : ${p.pct} % disent qu'elles achèteraient au moins une fois par semaine.`,
        "",
        `La concurrence : ${p.concurrents}. ${p.faiblesse}`,
        "",
        `Mon prix : ${p.prix}. ${p.justification}`,
        "",
        `Ce que je dois encore vérifier : ${p.verif}`,
      ].join("\n");
    },
    commentaire: (e, niveau) =>
      niveau === "haut"
        ? `Très beau travail, ${prenomDe(e)} ! Ton enquête est sérieuse et ton prix bien justifié. Pour aller plus loin, chiffre le nombre de clients par jour que tu peux servir : ce sera la base de ton seuil de rentabilité.`
        : niveau === "moyen"
          ? `Bon travail, ${prenomDe(e)}. Le besoin est clair. Ton étude gagnerait à interroger des inconnus (pas seulement ton entourage) et à comparer précisément les prix de deux concurrents. Tu es sur la bonne voie.`
          : `Merci d'avoir rendu ton travail, ${prenomDe(e)} : l'idée est intéressante. Il manque surtout les chiffres de ton enquête et l'analyse des concurrents. Relis la leçon 1.2 et viens me voir pendant le prochain live, on regardera ensemble.`,
  },
  {
    cle: "ent-d2",
    cours: "ENT-210",
    type: "depot",
    titre: "Calcul du seuil de rentabilité",
    consigne: `Pour ton projet (celui de ton étude de marché) :

1. liste tes **charges fixes** mensuelles et ton **coût variable** par unité vendue ;
2. calcule ta **marge unitaire** puis ton **seuil de rentabilité** en quantité et en chiffre d'affaires ;
3. conclus : ton étude de marché montre-t-elle que tu peux dépasser ce seuil ?

Aide-toi de la leçon 2.3 (exemple du jus de bissap).`,
    ouvertureJours: -5,
    limite: { jours: 1, h: 23, m: 59 },
    bareme: 20,
    coefficient: 2,
    accepteRetard: true,
    grille: [
      { critere: "Charges fixes et variables bien identifiées", points: 8 },
      { critere: "Calcul du seuil juste", points: 8 },
      { critere: "Conclusion argumentée", points: 4 },
    ],
    scenario: "a_venir",
    copie: (e) => {
      const p = PROJETS[e.rang % PROJETS.length];
      const marge = p.pv - p.cv;
      const seuil = Math.ceil(p.cf / marge);
      const fmt = (n: number) => n.toLocaleString("fr-FR").replace(/ | /g, " ");
      return [
        `Projet : ${p.idee}.`,
        "",
        `Prix de vente : ${fmt(p.pv)} FCFA`,
        `Coût variable par unité : ${fmt(p.cv)} FCFA`,
        `Marge unitaire : ${fmt(p.pv)} − ${fmt(p.cv)} = ${fmt(marge)} FCFA`,
        `Charges fixes mensuelles : ${fmt(p.cf)} FCFA (${p.detailCf})`,
        "",
        `Seuil de rentabilité : ${fmt(p.cf)} ÷ ${fmt(marge)} = ${fmt(seuil)} ${p.unite} par mois, soit environ ${Math.ceil(seuil / 26)} par jour d'ouverture.`,
        `En chiffre d'affaires : ${fmt(seuil)} × ${fmt(p.pv)} = ${fmt(seuil * p.pv)} FCFA par mois.`,
        "",
        `Conclusion : d'après mon enquête (${p.pct} % d'acheteurs réguliers), je pense pouvoir dépasser ce seuil dès le troisième mois, si je tiens mes coûts.`,
      ].join("\n");
    },
  },
  // ── INF-230 ──────────────────────────────────────────────────────────────
  {
    cle: "inf-d1",
    cours: "INF-230",
    type: "depot",
    titre: "Plan d'adressage IP d'un cybercafé",
    consigne: `Le cybercafé « Net Plus » de Yopougon compte **12 postes clients**, **3 postes pour le personnel et la caisse**, une imprimante et un wifi pour les téléphones des clients.

1. Choisis un réseau privé et justifie ton masque.
2. Découpe-le en sous-réseaux : clients, personnel, wifi.
3. Donne pour chaque sous-réseau l'adresse réseau, la plage d'hôtes, la diffusion et la passerelle.

Le retard est accepté, mais il sera signalé.`,
    ouvertureJours: -8,
    limite: { jours: -1, h: 23, m: 59 },
    bareme: 20,
    coefficient: 2,
    accepteRetard: true,
    grille: [
      { critere: "Choix du réseau et du masque", points: 6 },
      { critere: "Découpage en sous-réseaux", points: 8 },
      { critere: "Présentation du plan", points: 6 },
    ],
    scenario: "retard",
    copie: (e) => {
      const base = 10 + e.rang * 10;
      return [
        `Réseau choisi : 192.168.${base}.0/24 (adresses privées, 254 hôtes : largement assez).`,
        "Je le découpe en quatre /26 de 62 hôtes chacun :",
        "",
        `Postes clients : 192.168.${base}.0/26 · hôtes .1 à .62 · diffusion .63 · passerelle .1`,
        `Personnel et caisse : 192.168.${base}.64/26 · hôtes .65 à .126 · diffusion .127 · passerelle .65`,
        `Wifi des clients : 192.168.${base}.128/26 · hôtes .129 à .190 · diffusion .191 · passerelle .129`,
        `Réserve (caméras, extension) : 192.168.${base}.192/26`,
        "",
        "L'imprimante a une adresse fixe dans le réseau du personnel (.70). Le wifi des clients n'a pas accès au réseau de la caisse.",
      ].join("\n");
    },
  },
  {
    cle: "inf-q2",
    cours: "INF-230",
    type: "quiz",
    titre: "Interrogation · Modèle OSI et adressage IP",
    consigne: "Sept questions sur le chapitre 1. Tu as **25 minutes** et **une seule tentative**. Prépare-toi avec les leçons 1.2 et 1.3.",
    ouvertureJours: -2,
    limite: { jours: 4, h: 23, m: 59 },
    bareme: 20,
    coefficient: 1,
    accepteRetard: false,
    dureeMinutes: 25,
    tentativesMax: 1,
    scenario: "quiz_ouvert",
    questions: [
      {
        type: "qcm",
        enonce: "À quelle couche du modèle OSI se trouvent les adresses IP ?",
        options: ["Couche 1 · Physique", "Couche 2 · Liaison", "Couche 3 · Réseau", "Couche 7 · Application"],
        bonnes: [2],
        explication: "L'adressage IP et le routage appartiennent à la couche 3, Réseau.",
      },
      {
        type: "qcm",
        enonce: "Quel appareil relie le réseau local d'une PME à Internet ?",
        options: ["Le switch", "Le routeur", "La carte réseau", "Le câble RJ45"],
        bonnes: [1],
        explication: "Le routeur (souvent la box de l'opérateur) relie le réseau local à Internet.",
      },
      { type: "vrai_faux", enonce: "L'adresse 192.168.1.25 est une adresse privée.", bonnes: [0], explication: "Vrai : 192.168.0.0/16 fait partie des plages privées." },
      { type: "reponse_courte", enonce: "Combien d'adresses d'hôtes utilisables offre un réseau en /24 ?", bonnes: ["254"], faux: ["256", "255"], explication: "256 adresses moins l'adresse du réseau et celle de diffusion : 254." },
      {
        type: "choix_multiple",
        enonce: "Parmi ces protocoles, lesquels appartiennent à la couche transport ?",
        options: ["TCP", "UDP", "IP", "HTTP"],
        bonnes: [0, 1],
        explication: "TCP et UDP sont des protocoles de transport ; IP est à la couche réseau, HTTP à la couche application.",
      },
      {
        type: "qcm",
        enonce: "Quel masque correspond à la notation /24 ?",
        options: ["255.0.0.0", "255.255.0.0", "255.255.255.0", "255.255.255.128"],
        bonnes: [2],
        explication: "/24 signifie 24 bits à 1 : 255.255.255.0.",
      },
      {
        type: "vrai_faux",
        enonce: "Le NAT permet à plusieurs appareils d'un réseau local de partager une même adresse IP publique.",
        bonnes: [0],
        explication: "Vrai : la box traduit les adresses privées en une adresse publique.",
      },
    ],
  },
  // ── GES-120 ──────────────────────────────────────────────────────────────
  {
    cle: "ges-d1",
    cours: "GES-120",
    type: "depot",
    titre: "Journal : enregistrer cinq opérations",
    consigne: `Passe au journal les opérations de la boutique « Chez Konan » (plan SYSCOHADA) :

1. M. Konan apporte 2 000 000 FCFA, déposés en banque.
2. Achat de marchandises à crédit chez Ets Kouadio : 450 000 FCFA.
3. Vente de marchandises au comptant, en espèces : 300 000 FCFA.
4. Paiement du loyer par chèque : 75 000 FCFA.
5. Règlement d'Ets Kouadio par virement : 450 000 FCFA.

Rends une photo nette de ton cahier ou tape tes écritures.`,
    ouvertureJours: -14,
    limite: { jours: -8, h: 23, m: 59 },
    bareme: 20,
    coefficient: 1,
    accepteRetard: true,
    grille: [
      { critere: "Opération 1 · Apport en capital", points: 4 },
      { critere: "Opération 2 · Achat à crédit", points: 4 },
      { critere: "Opération 3 · Vente au comptant", points: 4 },
      { critere: "Opération 4 · Loyer", points: 4 },
      { critere: "Opération 5 · Règlement fournisseur", points: 4 },
    ],
    scenario: "corrige",
    copie: (e) => {
      const lignes = [
        "1) 521 Banque D 2 000 000 / 101 Capital social C 2 000 000",
        "2) 601 Achats de marchandises D 450 000 / 401 Fournisseurs C 450 000",
        "3) 571 Caisse D 300 000 / 701 Ventes de marchandises C 300 000",
        e.profil === "assidu" ? "4) 622 Locations D 75 000 / 521 Banque C 75 000" : "4) 521 Banque D 75 000 / 622 Locations C 75 000",
        e.profil === "fragile" ? "5) 401 Fournisseurs D 450 000 / 571 Caisse C 450 000" : "5) 401 Fournisseurs D 450 000 / 521 Banque C 450 000",
      ];
      return ["Journal de la boutique « Chez Konan »", "", ...lignes, "", "Total des débits = total des crédits = 3 275 000 FCFA."].join("\n");
    },
    // La copie d'un étudiant assidu est juste ; les autres inversent le loyer (et paient le fournisseur en caisse).
    notation: (e, h) =>
      e.profil === "assidu"
        ? { obtenus: [4, 4, 4, 4, h.chance(0.3) ? 3.5 : 4], niveau: "haut" }
        : e.profil === "regulier"
          ? { obtenus: [4, 4, h.chance(0.3) ? 3.5 : 4, 1, 4], niveau: "moyen" }
          : { obtenus: [4, 3.5, 4, 1, 1.5], niveau: "bas" },
    commentaire: (e, niveau) =>
      niveau === "haut"
        ? `Excellent, ${prenomDe(e)} : toutes les écritures sont justes et bien présentées. Tu maîtrises la partie double.`
        : niveau === "moyen"
          ? `Bien, ${prenomDe(e)}. Attention à l'opération 4 : le loyer est une charge, il se débite (622) et la banque se crédite. Le reste est juste, continue ainsi.`
          : `Merci pour ton travail, ${prenomDe(e)}. Revois le sens débit/crédit (leçon 2.2) : une charge se débite, et un paiement par virement passe par la banque (521), pas par la caisse. Refais les opérations 4 et 5, je les regarderai volontiers.`,
  },
  {
    cle: "ges-q2",
    cours: "GES-120",
    type: "quiz",
    titre: "Interrogation · Bilan et compte de résultat",
    consigne: "Six questions sur le chapitre 1 et la leçon 2.1. Tu as **20 minutes** et **deux tentatives**. Garde une calculatrice sous la main pour la dernière question.",
    ouvertureJours: -3,
    limite: { jours: 2, h: 23, m: 59 },
    bareme: 20,
    coefficient: 1,
    accepteRetard: false,
    dureeMinutes: 20,
    tentativesMax: 2,
    scenario: "quiz_ouvert",
    questions: [
      {
        type: "qcm",
        enonce: "Le stock de marchandises se trouve…",
        options: ["à l'actif du bilan", "au passif du bilan", "dans les produits du compte de résultat"],
        bonnes: [0],
        explication: "Le stock est un bien que possède l'entreprise : actif circulant.",
      },
      {
        type: "qcm",
        enonce: "Un emprunt auprès d'une microfinance est…",
        options: ["un actif immobilisé", "une dette financière, au passif", "un produit"],
        bonnes: [1],
        explication: "L'emprunt finance l'entreprise : c'est une ressource, au passif.",
      },
      { type: "vrai_faux", enonce: "Le total de l'actif est toujours égal au total du passif.", bonnes: [0], explication: "Vrai : c'est l'équilibre du bilan." },
      { type: "reponse_courte", enonce: "Quel est le numéro du compte « Caisse » dans le plan SYSCOHADA ?", bonnes: ["571"], faux: ["521", "57"], explication: "571 Caisse, classe 5 (trésorerie)." },
      {
        type: "choix_multiple",
        enonce: "Quels comptes appartiennent à la classe 6 ?",
        options: ["601 Achats de marchandises", "622 Locations", "701 Ventes de marchandises", "411 Clients"],
        bonnes: [0, 1],
        explication: "La classe 6 regroupe les charges ; 701 est un produit (classe 7) et 411 un compte de tiers (classe 4).",
      },
      {
        type: "reponse_courte",
        enonce: "Un article coûte 50 000 FCFA hors taxes. Quel est son prix TTC avec la TVA à 18 % ? (en FCFA)",
        bonnes: ["59000"],
        faux: ["68000", "59900", "41000"],
        explication: "50 000 × 1,18 = 59 000 FCFA.",
      },
    ],
  },
  // ── AGR-110 ──────────────────────────────────────────────────────────────
  {
    cle: "agr-q1",
    cours: "AGR-110",
    type: "quiz",
    titre: "Interrogation · La filière cacao",
    consigne: "Six questions sur le chapitre 1. Tu as **15 minutes** et **une tentative**.",
    ouvertureJours: -9,
    limite: { jours: -3, h: 23, m: 59 },
    bareme: 20,
    coefficient: 1,
    accepteRetard: false,
    dureeMinutes: 15,
    tentativesMax: 1,
    scenario: "quiz_ferme",
    questions: [
      {
        type: "qcm",
        enonce: "Quelle part de la production mondiale de cacao la Côte d'Ivoire représente-t-elle environ ?",
        options: ["10 %", "25 %", "40 %", "70 %"],
        bonnes: [2],
        explication: "Environ 2 millions de tonnes par an, près de 40 % de la production mondiale.",
      },
      {
        type: "qcm",
        enonce: "Combien de temps dure en général la fermentation des fèves ?",
        options: ["Une journée", "5 à 7 jours", "Un mois"],
        bonnes: [1],
        explication: "La fermentation dure 5 à 7 jours, avec un brassage tous les deux jours.",
      },
      {
        type: "vrai_faux",
        enonce: "Le prix minimum garanti bord champ est fixé par le Conseil du Café-Cacao.",
        bonnes: [0],
        explication: "Vrai : il est fixé à chaque campagne et payé au producteur.",
      },
      {
        type: "choix_multiple",
        enonce: "Quels acteurs interviennent après l'exportateur ?",
        options: ["Le broyeur", "Le chocolatier", "La coopérative", "Le producteur"],
        bonnes: [0, 1],
        explication: "Le broyeur puis le chocolatier transforment les fèves exportées ; la coopérative et le producteur interviennent avant.",
      },
      {
        type: "reponse_courte",
        enonce: "Comment s'appelle la maladie virale qui fait gonfler les rameaux du cacaoyer ? (deux mots)",
        bonnes: ["swollen shoot", "swollen-shoot"],
        faux: ["pourriture brune", "mildiou"],
        explication: "Le swollen shoot oblige souvent à arracher les arbres malades.",
      },
      {
        type: "qcm",
        enonce: "Jusqu'à quel taux d'humidité environ faut-il sécher les fèves ?",
        options: ["20 %", "15 %", "7 à 8 %", "1 %"],
        bonnes: [2],
        explication: "Autour de 7 à 8 % d'humidité, les fèves se conservent sans moisir.",
      },
    ],
  },
  {
    cle: "agr-d2",
    cours: "AGR-110",
    type: "depot",
    titre: "La chaîne de valeur du cacao dans ta région",
    consigne: `Décris la chaîne de valeur du cacao **telle que tu l'observes autour de chez toi** (leçon 2.1) :

- les acteurs, du producteur à l'exportateur ;
- le trajet des fèves et les prix pratiqués à chaque étape, si tu les connais ;
- **deux propositions** pour que les producteurs gagnent davantage.

Tu peux rendre un schéma dessiné et photographié.`,
    ouvertureJours: -4,
    limite: { jours: 6, h: 23, m: 59 },
    bareme: 20,
    coefficient: 2,
    accepteRetard: true,
    grille: [
      { critere: "Acteurs identifiés", points: 8 },
      { critere: "Flux et prix", points: 6 },
      { critere: "Propositions d'amélioration", points: 6 },
    ],
    scenario: "a_venir",
    copie: (e) =>
      [
        `Dans le village de ma famille, près d'Azaguié, la chaîne de valeur commence chez les producteurs, sur des parcelles de 2 à 4 hectares.`,
        "",
        "Les acteurs : les producteurs, la coopérative du village, un pisteur qui passe acheter chez ceux qui ne sont pas membres, le camion de l'exportateur qui part vers le port d'Abidjan.",
        "",
        "Le trajet des fèves : fermentation sous feuilles de bananier, séchage sur des claies, pesée à la coopérative le mardi, stockage dans le magasin, puis départ en camion.",
        "",
        "Les prix : la coopérative paie le prix bord champ officiel ; le pisteur paie parfois moins et sa balance n'est pas toujours juste.",
        "",
        `Mes propositions : ${e.rang % 2 ? "installer des séchoirs solaires communs pour améliorer la qualité, et payer par Mobile Money pour éviter de garder de l'argent liquide" : "une balance contrôlée pour tous, et une petite unité de transformation en beurre de cacao gérée par la coopérative"}.`,
      ].join("\n"),
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Classes en direct
// ═══════════════════════════════════════════════════════════════════════════

type DefQuestionLive = { texte: string; site: SlugSite; par: "salle" | "etudiant"; votes: number; t: number; repondueT?: number; anonyme?: boolean };
type DefSondage = {
  question: string;
  options: string[];
  bonne: number | null;
  explication?: string;
  /** Lancé à t secondes, fermé à t + duree ; absent : préparé mais pas encore lancé. */
  t?: number;
  duree?: number;
  parIa?: boolean;
  /** Réponse la plus fréquente par campus (sinon : la bonne réponse, ou au hasard). */
  penchant?: Partial<Record<SlugSite, number>>;
  /** Part des présents qui répondent la réponse attendue (0 à 1). */
  reussite?: number;
};
type DefMain = { site: SlugSite; par: "salle" | "etudiant"; t: number; paroleT?: number; finT?: number };

type DefSeance = {
  cle: string;
  cours: CodeCours;
  titre: string;
  description: string;
  debut: (t0: Date) => Date;
  duree: number;
  plan: EtapePlan[];
  /** Séance déjà tenue : terminée, avec présences, effectifs et fil des événements. */
  passee: boolean;
  transcription?: [number, string][];
  fiche?: string;
  ficheValidee?: boolean;
  questions?: DefQuestionLive[];
  sondages?: DefSondage[];
  mains?: DefMain[];
  incident?: { site: SlugSite; texte: string; t: number };
  publierSurSite?: boolean;
  lienSecours?: string;
  /** Ressentis par campus : proportions compris / perdu / lent / bravo. */
  climat?: Partial<Record<SlugSite, [number, number, number, number]>>;
};

/** Mardi prochain (toujours dans 1 à 7 jours), à h heures d'Abidjan. */
function mardiProchain(t0: Date, h: number): Date {
  const n = (9 - t0.getUTCDay()) % 7 || 7;
  return jourA(t0, n, h);
}

/**
 * La séance « d'aujourd'hui, dans quelques heures » : trois heures après le
 * semis, arrondie à la demi-heure. Semé la nuit, elle a lieu à 9 h ; semé trop
 * tard dans la journée, elle passe au lendemain après-midi (jamais un cours à
 * minuit ni à l'aube).
 */
function seanceDuJour(t0: Date): Date {
  const cible = plus(t0, 3 * HEURE);
  const d = new Date(Math.ceil(cible.getTime() / (30 * MINUTE)) * 30 * MINUTE);
  if (d.getUTCDate() !== t0.getUTCDate() || d.getUTCHours() > 20 || (d.getUTCHours() === 20 && d.getUTCMinutes() > 30)) return jourA(t0, 1, 15);
  // Semé en pleine nuit : la séance a lieu ce matin à 9 h, pas à l'aube.
  if (d.getUTCHours() < 8) return jourA(t0, 0, 9);
  return d;
}

const SEANCES: DefSeance[] = [
  // ── IA-101 · séance 1 (J-14) ─────────────────────────────────────────────
  {
    cle: "ia-s1",
    cours: "IA-101",
    titre: "Séance 1 · Qu'est-ce que l'intelligence artificielle ?",
    description: "Première séance commune aux cinq campus : définition de l'IA, les trois grandes familles de modèles, des exemples ivoiriens et les limites à connaître.",
    debut: (t0) => horsDimanche(jourA(t0, -14, 10), -1),
    duree: 90,
    passee: true,
    plan: [
      { titre: "Accueil des cinq campus et émargement", minutes: 5 },
      { titre: "Sondage d'ouverture : pour vous, l'IA c'est quoi ?", minutes: 5 },
      { titre: "Apprendre à partir de données : définition et exemples", minutes: 20 },
      { titre: "Les trois familles de modèles", minutes: 20 },
      { titre: "Les limites : erreurs et biais", minutes: 15 },
      { titre: "Questions votées", minutes: 20 },
      { titre: "Synthèse et travail de la semaine", minutes: 5 },
    ],
    transcription: [
      [20, "Bonjour à toutes et à tous ! Bonjour Riviera, bonjour Yopougon, Yamoussoukro, Azaguié et M'Batto. Vous m'entendez bien ?"],
      [45, "Je vois les cinq salles à l'écran, c'est magnifique. Et bonjour aussi à ceux qui nous suivent depuis leur téléphone."],
      [90, "Je me présente : Karim Diallo, je vous parle depuis Lyon. Depuis dix ans, j'aide des entreprises d'Afrique de l'Ouest à utiliser l'intelligence artificielle."],
      [150, "Aujourd'hui, une seule question : qu'est-ce que l'intelligence artificielle, et qu'est-ce qu'elle n'est pas ?"],
      [240, "Commençons par un petit sondage. Répondez depuis votre téléphone : pour vous, l'IA, c'est plutôt un robot, un programme, ou de la magie ?"],
      [420, "Les résultats sont intéressants : à M'Batto, beaucoup ont répondu « un robot ». C'est normal, c'est ce que montrent les films."],
      [520, "En réalité, l'intelligence artificielle, ce sont des programmes qui apprennent à partir d'exemples, au lieu de suivre des règles écrites une par une par un informaticien."],
      [640, "Prenons un exemple simple. Un tableur calcule la TVA à 18 % parce qu'on lui a donné la formule. Il ne se trompe jamais, mais il ne sait faire que ça."],
      [760, "Un modèle d'IA, lui, a vu des milliers d'exemples. Par exemple des photos de feuilles de cacaoyer malades et saines. À force, il reconnaît une feuille malade qu'il n'a jamais vue."],
      [900, "C'est ça, apprendre à partir de données. Retenez ce mot : les données. Sans données, pas d'IA."],
      [1010, "Deuxième exemple, plus proche de vous : quand votre téléphone vous propose le mot suivant dans WhatsApp, c'est déjà une petite IA."],
      [1130, "Et quand votre service de Mobile Money bloque une opération suspecte, ce sont aussi des modèles qui repèrent les opérations inhabituelles."],
      [1260, "Je vois une main levée à M'Batto. Je vous donne la parole, M'Batto, on vous écoute."],
      [1300, "Ah, très bonne question : l'IA peut-elle aider un agriculteur à prévoir sa récolte ? Oui, et c'est même un des domaines où elle est la plus utile."],
      [1420, "On combine la météo, l'état du sol, les photos prises au téléphone et l'historique des récoltes. Le modèle donne une estimation : par exemple entre 600 et 700 kilos par hectare cette saison."],
      [1540, "Mais attention : c'est une estimation, pas une certitude. L'agriculteur garde toujours le dernier mot. Une règle que nous verrons souvent : l'IA propose, l'humain décide."],
      [1700, "Passons à la deuxième partie : les trois grandes familles d'IA que vous rencontrerez."],
      [1790, "La première : les modèles qui classent. Ils répondent à « est-ce ceci ou cela ? » : spam ou pas spam, feuille saine ou malade, client fidèle ou pas."],
      [1930, "La deuxième : les modèles qui prévoient un nombre. Les ventes du mois prochain, le rendement d'une parcelle, la quantité de poisson à commander pour le maquis du week-end."],
      [2080, "La troisième, celle dont tout le monde parle : les modèles qui génèrent du texte, des images ou du son. On les appelle IA génératives. ChatGPT, Claude ou Gemini en font partie."],
      [2230, "Azaguié, je vois que votre salle revient. Vous avez eu une coupure de courant, c'est bien ça ? Pas de souci, la fiche de révision reprendra tout."],
      [2350, "Une question très votée venant de Yopougon : quelle différence entre l'IA et un simple programme informatique ?"],
      [2440, "Le programme classique applique des règles que quelqu'un a écrites. L'IA a construit ses propres règles à partir des exemples. C'est pour ça qu'elle peut aussi se tromper de façon surprenante."],
      [2600, "Question de Yamoussoukro : faut-il savoir coder pour utiliser un modèle de langage ? Non ! Il faut savoir bien expliquer ce qu'on veut. Nous y consacrerons une séance."],
      [2760, "Petit sondage de vérification : un modèle qui prévoit les ventes de pain de la semaine prochaine, c'est quelle famille ?"],
      [2900, "Bravo, la majorité a trouvé : c'est un modèle qui prévoit un nombre. Riviera a fait un sans-faute !"],
      [3050, "Maintenant, les limites. Une IA ne comprend pas le monde comme nous. Elle repère des régularités dans les données."],
      [3180, "Si les données sont mauvaises ou incomplètes, les réponses le seront aussi. Un modèle entraîné seulement sur des photos prises en Europe reconnaîtra mal un plat d'attiéké."],
      [3320, "C'est ce qu'on appelle un biais. Voilà pourquoi nous avons besoin de données africaines, et de spécialistes africains de l'IA. Pourquoi pas vous ?"],
      [3480, "Question d'Azaguié : comment vérifier si une réponse de l'IA est juste ? On vérifie toujours les chiffres, les noms et les dates avec une source fiable. Je vous montrerai une méthode la semaine prochaine."],
      [3640, "Question de Riviera : est-ce que l'IA va remplacer les comptables ? Elle va surtout remplacer les tâches répétitives. Le comptable qui sait utiliser l'IA prendra l'avantage sur celui qui ne sait pas."],
      [3820, "Yamoussoukro me demande si l'IA comprend le baoulé ou le dioula. Un peu, mais beaucoup moins bien que le français : les langues africaines manquent encore de textes écrits en ligne."],
      [4000, "Pour résumer : l'IA apprend à partir de données, elle classe, prévoit ou génère, et elle peut se tromper. Donc on vérifie toujours."],
      [4150, "Pour la suite : l'interrogation 1 ouvre dans deux jours sur le campus, et relisez les leçons 1.1 et 1.2."],
      [4300, "Vous pouvez aussi poser vos questions dans le salon du cours : je réponds tous les soirs."],
      [4460, "Merci à toutes et à tous, merci aux responsables de salle. À la semaine prochaine, même heure !"],
    ],
    fiche: `# Séance 1 · Qu'est-ce que l'intelligence artificielle ?

*IA-101 · fiche de révision*

## L'essentiel en 5 points

1. **L'IA apprend à partir de données** : au lieu de suivre des règles écrites à la main, elle repère des régularités dans des exemples.
2. **Trois familles** : les modèles qui classent, ceux qui prévoient un nombre, ceux qui génèrent du texte, des images ou du son.
3. **Tu l'utilises déjà** : clavier du téléphone, détection de fraude Mobile Money, recommandations de vidéos.
4. **Elle peut se tromper** : si les données sont incomplètes ou biaisées, les réponses le seront aussi.
5. **L'IA propose, l'humain décide** : on vérifie toujours avant d'agir.

## Les notions clés

- **Données** : les exemples à partir desquels l'IA apprend.
- **Biais** : une erreur qui vient de données qui ne représentent pas tout le monde.
- **IA générative** : une IA qui produit du texte, des images ou du son (ChatGPT, Claude, Gemini).

## Un exemple ivoirien

Une coopérative combine la météo, les photos des parcelles et l'historique des récoltes : le modèle estime « entre 600 et 700 kg par hectare ». C'est une estimation : l'agriculteur garde le dernier mot.

## Les réponses aux questions les plus votées

- **L'IA peut-elle aider un agriculteur à prévoir sa récolte ?** (M'Batto) Oui, en combinant météo, sol, photos et historique ; c'est une estimation, pas une certitude.
- **Quelle différence entre l'IA et un programme informatique ?** (Yopougon) Le programme applique des règles écrites ; l'IA construit ses règles à partir d'exemples.
- **Faut-il savoir coder pour utiliser un modèle de langage ?** (Yamoussoukro) Non : il faut savoir expliquer clairement ce qu'on veut.
- **L'IA va-t-elle remplacer les comptables ?** (Riviera) Elle remplace surtout des tâches répétitives ; le comptable qui sait l'utiliser prend l'avantage.

## Pour vérifier que tu as compris

1. Donne un exemple de chacune des trois familles d'IA.
2. Pourquoi un modèle entraîné en Europe peut-il mal reconnaître un plat d'attiéké ?
3. Que veut dire « l'IA propose, l'humain décide » ?`,
    ficheValidee: true,
    questions: [
      { texte: "L'IA peut-elle aider un agriculteur à prévoir sa récolte ?", site: "mbatto", par: "salle", votes: 12, t: 1180, repondueT: 1300 },
      { texte: "Quelle différence entre l'IA et un simple programme informatique ?", site: "yopougon", par: "etudiant", votes: 9, t: 1650, repondueT: 2350 },
      { texte: "L'IA comprend-elle le baoulé ou le dioula ?", site: "yamoussoukro", par: "etudiant", votes: 8, t: 2150, repondueT: 3820 },
      { texte: "Est-ce que l'IA va remplacer les comptables ?", site: "riviera", par: "etudiant", votes: 7, t: 2520, repondueT: 3640 },
      { texte: "Faut-il savoir coder pour utiliser un modèle de langage ?", site: "yamoussoukro", par: "salle", votes: 6, t: 2380, repondueT: 2600 },
      { texte: "Comment vérifier si une réponse de l'IA est juste ?", site: "azaguie", par: "etudiant", votes: 4, t: 3100, repondueT: 3480 },
      { texte: "Peut-on utiliser l'IA sans connexion internet, au village ?", site: "azaguie", par: "salle", votes: 3, t: 3900 },
    ],
    sondages: [
      {
        question: "Pour vous, l'intelligence artificielle, c'est d'abord…",
        options: ["Un robot", "Un programme qui apprend à partir d'exemples", "De la magie", "Je ne sais pas encore"],
        bonne: null,
        t: 240,
        duree: 150,
        penchant: { mbatto: 0, azaguie: 3, riviera: 1, yopougon: 1, yamoussoukro: 0 },
        reussite: 0.45,
      },
      {
        question: "Un modèle qui prévoit les ventes de pain de la semaine prochaine appartient à quelle famille ?",
        options: ["Les modèles qui classent", "Les modèles qui prévoient un nombre", "Les modèles qui génèrent du texte"],
        bonne: 1,
        explication: "Il produit un nombre (des ventes) à partir de l'historique : c'est une prévision.",
        t: 2760,
        duree: 120,
        reussite: 0.78,
        penchant: { riviera: 1 },
      },
    ],
    mains: [
      { site: "mbatto", par: "salle", t: 1210, paroleT: 1260, finT: 1300 },
      { site: "yopougon", par: "etudiant", t: 2280, paroleT: 2350, finT: 2420 },
      { site: "riviera", par: "etudiant", t: 3950 },
    ],
    incident: { site: "azaguie", texte: "Coupure de courant pendant 25 minutes ; groupe électrogène relancé.", t: 1680 },
    climat: {
      riviera: [8, 1, 1, 3],
      yopougon: [7, 2, 1, 2],
      yamoussoukro: [6, 2, 3, 1],
      azaguie: [5, 3, 2, 1],
      mbatto: [7, 1, 1, 3],
    },
  },
  // ── IA-101 · séance 2 (J-7) ──────────────────────────────────────────────
  {
    cle: "ia-s2",
    cours: "IA-101",
    titre: "Séance 2 · Les modèles de langage, comment ça marche ?",
    description: "Comment un modèle comme ChatGPT ou Claude écrit : la prédiction du mot suivant, les jetons, l'entraînement, les hallucinations, et comment rédiger une bonne consigne.",
    debut: (t0) => horsDimanche(jourA(t0, -7, 10), -1),
    duree: 90,
    passee: true,
    plan: [
      { titre: "Rappel de la séance 1 (sondage)", minutes: 5 },
      { titre: "Prédire le mot suivant : jetons et probabilités", minutes: 20 },
      { titre: "L'entraînement et ses conséquences", minutes: 10 },
      { titre: "Hallucinations : pourquoi vérifier", minutes: 15 },
      { titre: "Rédiger une bonne consigne", minutes: 20 },
      { titre: "Questions votées", minutes: 15 },
      { titre: "Présentation du devoir", minutes: 5 },
    ],
    transcription: [
      [15, "Bonjour à tous ! Riviera, Yopougon, Yamoussoukro, Azaguié, M'Batto : je vous vois tous. Et bonjour à ceux qui sont en ligne."],
      [60, "Aujourd'hui, nous entrons dans le moteur : les modèles de langage, comme ChatGPT, Claude ou Gemini."],
      [130, "D'abord un rappel de la semaine dernière. Qui se souvient des trois familles d'IA ? Répondez au sondage."],
      [300, "Très bien : classer, prévoir, générer. Les modèles de langage appartiennent à la troisième famille : ils génèrent du texte."],
      [420, "Alors comment ça marche ? Le principe est étonnamment simple : un modèle de langage prédit le mot suivant."],
      [530, "Si je vous dis « Le garba se mange avec de l'attiéké et du… », vous répondez tous « thon » ! Vous venez de prédire le mot suivant."],
      [660, "Le modèle fait exactement cela, mais après avoir lu des milliards de phrases : des livres, des sites web, des articles de journaux."],
      [790, "Techniquement, il découpe le texte en petits morceaux qu'on appelle des jetons, ou tokens. Un mot courant fait un jeton, un mot rare peut en faire trois ou quatre."],
      [930, "Pour chaque jeton possible, il calcule une probabilité. Puis il choisit, ajoute ce jeton à la phrase, et recommence. Mot après mot."],
      [1080, "C'est pour cela que les réponses s'affichent petit à petit à l'écran : le modèle écrit vraiment au fur et à mesure."],
      [1200, "Deuxième idée importante : l'entraînement. Le modèle a appris une fois pour toutes, pendant des semaines, sur d'énormes ordinateurs."],
      [1330, "Ensuite, des humains l'ont corrigé pour qu'il réponde poliment, suive les consignes et refuse les demandes dangereuses."],
      [1460, "Conséquence : le modèle ne connaît pas l'actualité d'hier, sauf si on lui donne l'information, ou s'il peut chercher sur Internet."],
      [1600, "Question très votée de Riviera : pourquoi l'IA invente-t-elle parfois des chiffres ?"],
      [1690, "Parce qu'elle cherche la suite la plus probable, pas la vérité. Si elle ne connaît pas le chiffre, elle peut produire un chiffre qui a l'air juste."],
      [1820, "On appelle cela une hallucination. Exemple réel : j'ai demandé la population d'une petite ville à un modèle ; il m'a donné un chiffre très précis… et faux."],
      [1960, "Règle d'or : tout chiffre, toute date, tout nom propre donné par une IA doit être vérifié. Dans un document officiel, sur un site sérieux, ou auprès d'une personne compétente."],
      [2120, "Sondage éclair : un modèle de langage vous répond que la TVA en Côte d'Ivoire est de 20 %. Que faites-vous ?"],
      [2280, "Excellent : presque tout le monde a choisi « je vérifie dans une source officielle ». Et c'est bien 18 %, pas 20 %."],
      [2400, "Yopougon demande combien coûte l'utilisation d'un modèle comme Claude pour une PME. Pour un usage simple, quelques milliers de francs CFA par mois suffisent."],
      [2540, "On paie en général au nombre de jetons. Une question et sa réponse, c'est souvent quelques francs CFA. Mais attention aux gros volumes."],
      [2680, "M'Batto, je vous donne la parole. Allez-y."],
      [2710, "Merci pour la question : est-ce que nos données sont en sécurité quand on parle à l'IA ? C'est une vraie question de professionnel."],
      [2830, "Règle simple : ne donnez jamais à une IA publique des informations confidentielles. Pas de mot de passe, pas de numéro de compte, pas le fichier clients complet."],
      [2980, "En entreprise, on choisit des offres professionnelles où les données ne servent pas à entraîner le modèle, et on lit les conditions."],
      [3120, "Passons à la pratique. Comment bien parler à un modèle de langage ? On appelle cela rédiger une consigne, ou un prompt."],
      [3240, "Une bonne consigne contient quatre choses : le rôle, le contexte, la tâche et le format de réponse attendu."],
      [3380, "Mauvaise consigne : « Écris une publicité. » Bonne consigne : « Tu es le gérant d'un maquis à Adjamé. Rédige un message WhatsApp de trois lignes pour annoncer notre poulet braisé à 2 500 FCFA ce week-end, sur un ton chaleureux. »"],
      [3540, "Vous voyez la différence ? Le modèle sait qui il est, pour qui il écrit, ce qu'il doit produire et sous quelle forme."],
      [3680, "Yopougon demande s'il faut écrire en français parfait pour que l'IA comprenne. Non, elle comprend très bien le français de tous les jours, même avec quelques fautes."],
      [3800, "Mais plus votre consigne est claire, meilleure sera la réponse. Ce n'est pas une question de grammaire, c'est une question de précision."],
      [3950, "Deuxième astuce : donnez un exemple de ce que vous voulez. Les modèles imitent très bien un exemple."],
      [4080, "Troisième astuce : demandez au modèle de vous poser des questions s'il lui manque des informations. Ça évite qu'il invente."],
      [4220, "Je vois beaucoup de « plus lentement » à Yamoussoukro sur le baromètre. Je reprends : rôle, contexte, tâche, format. Quatre mots à retenir."],
      [4380, "Pour le devoir : vous rédigerez trois consignes pour une vraie PME de votre quartier, et vous vérifierez les réponses obtenues."],
      [4520, "Choisissez une entreprise que vous connaissez : la boutique de votre oncle, le salon de coiffure, la coopérative de votre village."],
      [4650, "Il reste des questions sur l'entraînement sur nos propres documents et sur le prix du cacao. Je n'ai pas le temps aujourd'hui : j'y reviens au début de la prochaine séance."],
      [4780, "La fiche de révision sera disponible sur le campus dès ce soir, avec les réponses aux questions."],
      [4900, "Merci à tous, merci à Azaguié pour la connexion parfaite aujourd'hui. À bientôt pour la grande séance sur l'IA dans les PME !"],
    ],
    fiche: `# Séance 2 · Les modèles de langage, comment ça marche ?

*IA-101 · fiche de révision*

## L'essentiel en 5 points

1. **Un modèle de langage prédit le mot suivant**, jeton après jeton, à partir des milliards de phrases lues pendant son entraînement.
2. **Il cherche le probable, pas le vrai** : il peut inventer un chiffre plausible. C'est une hallucination.
3. **Tout chiffre, date ou nom se vérifie** dans une source fiable (exemple : la TVA ivoirienne est de 18 %, pas de 20 %).
4. **Une bonne consigne a quatre ingrédients** : rôle, contexte, tâche, format.
5. **Rien de confidentiel dans une IA publique** : ni mot de passe, ni numéro de compte, ni fichier clients.

## Les notions clés

- **Jeton (token)** : un morceau de mot ; il mesure la longueur d'un texte et le prix d'utilisation.
- **Entraînement** : la phase où le modèle apprend, une fois pour toutes, avant d'être utilisé.
- **Consigne (prompt)** : la demande que l'on écrit au modèle.

## Un exemple ivoirien

Consigne efficace : « Tu es le gérant d'un maquis à Adjamé. Rédige un message WhatsApp de trois lignes pour annoncer notre poulet braisé à 2 500 FCFA ce week-end, sur un ton chaleureux. »

## Les réponses aux questions les plus votées

- **Pourquoi l'IA invente-t-elle parfois des chiffres ?** (Riviera) Parce qu'elle produit la suite la plus probable, même quand elle ne sait pas.
- **Combien coûte un modèle pour une PME ?** (Yopougon) Pour un usage simple, quelques milliers de FCFA par mois ; on paie au nombre de jetons.
- **Nos données sont-elles en sécurité ?** (M'Batto) Pas dans une IA publique : on n'y met rien de confidentiel et on choisit des offres professionnelles.
- **Faut-il écrire un français parfait ?** (Yopougon) Non, mais une consigne précise donne une meilleure réponse.

## Pour vérifier que tu as compris

1. Qu'est-ce qu'une hallucination ?
2. Réécris « Écris une publicité » avec les quatre ingrédients.
3. Pourquoi ne faut-il pas coller un fichier clients dans une IA publique ?`,
    ficheValidee: true,
    questions: [
      { texte: "Pourquoi l'IA invente parfois des chiffres ?", site: "riviera", par: "etudiant", votes: 10, t: 1500, repondueT: 1600 },
      { texte: "Combien coûte l'utilisation d'un modèle comme Claude pour une PME ?", site: "yopougon", par: "etudiant", votes: 7, t: 1900, repondueT: 2400 },
      { texte: "Est-ce que nos données sont en sécurité quand on parle à l'IA ?", site: "mbatto", par: "salle", votes: 6, t: 2500, repondueT: 2710 },
      { texte: "Comment l'IA peut-elle aider à fixer le prix du cacao bord champ ?", site: "azaguie", par: "etudiant", votes: 5, t: 3300 },
      { texte: "Peut-on entraîner un modèle sur les documents de notre propre entreprise ?", site: "yamoussoukro", par: "etudiant", votes: 4, t: 3600 },
      { texte: "Faut-il écrire en français parfait pour que l'IA comprenne ?", site: "yopougon", par: "etudiant", votes: 3, t: 3500, repondueT: 3680 },
    ],
    sondages: [
      {
        question: "Quelles sont les trois familles d'IA vues la semaine dernière ?",
        options: ["Classer, prévoir, générer", "Lire, écrire, compter", "Robots, drones, voitures"],
        bonne: 0,
        explication: "Les modèles classent, prévoient un nombre ou génèrent du contenu.",
        t: 130,
        duree: 150,
        reussite: 0.82,
      },
      {
        question: "Un modèle vous répond que la TVA en Côte d'Ivoire est de 20 %. Que faites-vous ?",
        options: ["Je recopie sans vérifier", "Je vérifie dans une source officielle", "Je demande à un autre modèle d'IA"],
        bonne: 1,
        explication: "Le taux normal de la TVA en Côte d'Ivoire est de 18 % : un chiffre donné par une IA se vérifie toujours dans une source officielle (Direction générale des impôts).",
        t: 2120,
        duree: 140,
        parIa: true,
        reussite: 0.88,
      },
    ],
    mains: [
      { site: "mbatto", par: "salle", t: 2620, paroleT: 2680, finT: 2800 },
      { site: "yamoussoukro", par: "etudiant", t: 4300 },
    ],
    climat: {
      riviera: [8, 1, 1, 2],
      yopougon: [7, 1, 2, 2],
      yamoussoukro: [4, 2, 5, 1],
      azaguie: [7, 1, 1, 2],
      mbatto: [6, 2, 1, 2],
    },
  },
  // ── IA-101 · la grande séance de mardi prochain (annoncée sur 2iae.com) ──
  {
    cle: "ia-s3",
    cours: "IA-101",
    titre: "Séance 3 · L'IA au service des PME ivoiriennes",
    description:
      "La grande séance commune aux cinq campus : comment une boutique d'Adjamé, un maquis de Yopougon et une coopérative de cacao d'Azaguié utilisent déjà l'intelligence artificielle. Démonstration en direct, sondages par campus et questions votées.",
    debut: (t0) => mardiProchain(t0, 10),
    duree: 90,
    passee: false,
    publierSurSite: true,
    lienSecours: "https://meet.jit.si/campus-2iae-ia101-secours",
    plan: [
      { titre: "Accueil des cinq campus et émargement", minutes: 5 },
      { titre: "Réponses aux questions restées en suspens (séance 2)", minutes: 10 },
      { titre: "Trois PME ivoiriennes qui utilisent déjà l'IA", minutes: 20 },
      { titre: "Démonstration : un assistant WhatsApp pour un maquis", minutes: 20 },
      { titre: "Sondages et questions votées", minutes: 15 },
      { titre: "Atelier par campus : une idée d'IA pour votre ville", minutes: 15 },
      { titre: "Synthèse et suite du cours", minutes: 5 },
    ],
    sondages: [
      {
        question: "Dans votre futur métier, quelle tâche confieriez-vous en premier à une IA ?",
        options: ["Répondre aux clients sur WhatsApp", "Tenir les comptes et les stocks", "Prévoir les ventes ou les récoltes", "Rédiger des documents"],
        bonne: null,
      },
      {
        question: "Une IA propose de baisser vos prix de 30 % pour gagner des clients. Que faites-vous ?",
        options: ["J'applique tout de suite", "Je vérifie l'effet sur ma marge avant de décider", "J'ignore complètement la proposition"],
        bonne: 1,
        explication: "L'IA propose, l'humain décide : on vérifie d'abord l'effet sur la marge et la trésorerie.",
      },
    ],
  },
  {
    cle: "ia-s4",
    cours: "IA-101",
    titre: "Séance 4 · Atelier : l'IA dans mon futur métier",
    description: "Atelier pratique par filière : chaque campus présente une idée d'usage de l'IA et la teste en direct avec le formateur.",
    debut: (t0) => plus(mardiProchain(t0, 10), 7 * JOUR),
    duree: 90,
    passee: false,
    plan: [
      { titre: "Accueil et émargement", minutes: 5 },
      { titre: "Présentations des campus (5 × 10 min)", minutes: 50 },
      { titre: "Tests en direct et discussion", minutes: 30 },
      { titre: "Synthèse", minutes: 5 },
    ],
  },
  // ── ENT-210 ──────────────────────────────────────────────────────────────
  {
    cle: "ent-s1",
    cours: "ENT-210",
    titre: "Séance 1 · De l'idée au projet",
    description: "Partir d'un problème réel, tester son idée, préparer son étude de marché.",
    debut: (t0) => horsDimanche(jourA(t0, -9, 14), -1),
    duree: 90,
    passee: true,
    plan: [
      { titre: "Présentations", minutes: 10 },
      { titre: "Partir d'un problème, pas d'un produit", minutes: 30 },
      { titre: "Préparer son étude de marché", minutes: 40 },
      { titre: "Devoir de la semaine", minutes: 10 },
    ],
    transcription: [
      [20, "Bonjour Riviera, bonjour Yopougon ! Bienvenue dans le cours de création d'entreprise."],
      [120, "Je suis Aïcha Bamba. Il y a huit ans, j'ai lancé mon entreprise de transformation de manioc avec 300 000 francs d'économies et beaucoup d'erreurs."],
      [300, "Première règle : on ne part pas d'un produit, on part d'un problème. Qui a un problème qui l'agace tous les jours ?"],
      [520, "Yopougon propose les files d'attente pour imprimer avant les examens. Excellent : voilà un vrai besoin."],
      [760, "Deuxième règle : un besoin n'est une opportunité que si des gens sont prêts à payer pour le résoudre."],
      [1000, "Riviera me parle des jus naturels près des gares. Combien un voyageur est-il prêt à payer ? C'est ce que dira votre enquête."],
      [1350, "Pour l'étude de marché, sortez de la famille. Vos tantes vous diront toujours que votre idée est magnifique."],
      [1800, "Vingt personnes interrogées au minimum, cinq questions simples. Vous trouverez la méthode dans la leçon 1.2."],
      [2400, "Votre premier devoir : l'étude de marché de votre projet. Vous avez environ une semaine."],
      [3200, "Merci à tous, et n'ayez pas peur de vous tromper : c'est comme ça qu'on apprend à entreprendre."],
    ],
    fiche: `# Séance 1 · De l'idée au projet

*ENT-210 · fiche de révision*

## L'essentiel

- **On part d'un problème, pas d'un produit** : quel problème je résous, et pour qui ?
- **Un besoin devient une opportunité** si des clients sont prêts à payer.
- **L'étude de marché se fait avec des inconnus** : au moins vingt personnes, cinq questions simples.

## Pour la semaine

Rends l'étude de marché de ton projet : besoin, clientèle, concurrence, prix.`,
    ficheValidee: true,
    questions: [
      { texte: "Peut-on lancer un projet avec moins de 100 000 FCFA ?", site: "yopougon", par: "etudiant", votes: 6, t: 900, repondueT: 1100 },
      { texte: "Comment savoir si mon idée existe déjà ailleurs ?", site: "riviera", par: "etudiant", votes: 4, t: 1500, repondueT: 1700 },
    ],
    climat: { riviera: [7, 1, 1, 2], yopougon: [6, 1, 1, 3] },
  },
  {
    cle: "ent-s2",
    cours: "ENT-210",
    titre: "Séance 2 · Chiffrer son projet : charges et seuil de rentabilité",
    description: "Charges fixes et variables, amortissement, marge sur coût variable et seuil de rentabilité, avec l'exemple du jus de bissap.",
    debut: (t0) => horsDimanche(jourA(t0, -2, 14), -1),
    duree: 90,
    passee: true,
    plan: [
      { titre: "Retour sur les études de marché", minutes: 10 },
      { titre: "Charges fixes, charges variables, amortissement", minutes: 30 },
      { titre: "Le seuil de rentabilité pas à pas", minutes: 35 },
      { titre: "Questions et devoir", minutes: 15 },
    ],
    transcription: [
      [15, "Bonjour à tous ! Aujourd'hui on sort la calculatrice : on va chiffrer vos projets."],
      [140, "J'ai lu vos études de marché : vous avez de très bonnes idées. Les notes sont publiées, avec un commentaire pour chacun."],
      [380, "Commençons par les charges fixes : ce que vous payez même si vous ne vendez rien. Le loyer, le forfait téléphone, un salaire."],
      [640, "Les charges variables, elles, augmentent avec chaque vente : les fleurs de bissap, le sucre, la bouteille."],
      [900, "Attention au congélateur ou à la moto : ce sont des investissements. On les répartit sur plusieurs années, c'est l'amortissement."],
      [1250, "Exemple du jus de bissap : je vends à 500 francs, la bouteille me coûte 200 francs. Il me reste 300 francs de marge par bouteille."],
      [1600, "Avec 45 000 francs de charges fixes par mois, combien de bouteilles pour ne pas perdre d'argent ? 45 000 divisé par 300 : 150 bouteilles."],
      [1900, "C'est le seuil de rentabilité. En dessous, on perd de l'argent ; au-dessus, chaque bouteille rapporte 300 francs."],
      [2300, "Question de Yopougon : faut-il compter son propre salaire dans les charges fixes ? Oui, dès que possible, sinon vous travaillez gratuitement."],
      [2800, "Pour le devoir, calculez le seuil de votre propre projet. N'inventez pas les prix : allez les demander au marché."],
      [3300, "Il reste deux questions, sur la TVA et sur la tontine : je les note, on y revient la prochaine fois."],
      [3500, "Merci à tous, bon courage pour vos calculs !"],
    ],
    fiche: `# Séance 2 · Chiffrer son projet

*ENT-210 · fiche de révision (brouillon)*

## L'essentiel en 5 points

1. **Charges fixes** : payées même sans vente (loyer, forfait, salaire).
2. **Charges variables** : augmentent avec chaque vente (matières premières, emballages).
3. **Amortissement** : un investissement se répartit sur sa durée d'utilisation.
4. **Marge unitaire** = prix de vente − coût variable (500 − 200 = 300 FCFA pour le jus de bissap).
5. **Seuil de rentabilité** = charges fixes ÷ marge unitaire (45 000 ÷ 300 = 150 bouteilles par mois).

## Les questions posées pendant le live

- Faut-il compter son propre salaire dans les charges fixes ? *(répondue en direct)* Oui, dès que possible.
- La TVA entre-t-elle dans le calcul du seuil ? Réponse : …
- Peut-on financer son stock avec une tontine ? Réponse : …

## Pour vérifier que tu as compris

1. Le loyer est-il une charge fixe ou variable ?
2. Calcule le seuil d'un produit vendu 1 000 FCFA, coût variable 600 FCFA, charges fixes 60 000 FCFA.`,
    ficheValidee: false,
    questions: [
      { texte: "Faut-il compter son propre salaire dans les charges fixes ?", site: "yopougon", par: "etudiant", votes: 8, t: 2100, repondueT: 2300 },
      { texte: "La TVA entre-t-elle dans le calcul du seuil de rentabilité ?", site: "riviera", par: "etudiant", votes: 6, t: 2600 },
      { texte: "Peut-on financer son premier stock avec une tontine ?", site: "yopougon", par: "etudiant", votes: 5, t: 3000 },
    ],
    sondages: [
      {
        question: "Le loyer du kiosque est une charge…",
        options: ["Fixe", "Variable", "Ce n'est pas une charge"],
        bonne: 0,
        explication: "Il est dû chaque mois, qu'on vende ou non : c'est une charge fixe.",
        t: 700,
        duree: 120,
        reussite: 0.85,
      },
    ],
    climat: { riviera: [6, 2, 2, 1], yopougon: [7, 2, 1, 2] },
  },
  {
    cle: "ent-s3",
    cours: "ENT-210",
    titre: "Séance 3 · Financer son projet : tontine, microfinance, banque",
    description: "Les solutions de financement d'un jeune entrepreneur en Côte d'Ivoire, avec le témoignage d'une responsable de microfinance.",
    debut: (t0) => horsDimanche(jourA(t0, 2, 14), 1),
    duree: 90,
    passee: false,
    plan: [
      { titre: "Réponses aux questions de la séance 2 (TVA, tontine)", minutes: 10 },
      { titre: "Tontine, microfinance, banque : avantages et pièges", minutes: 35 },
      { titre: "Témoignage d'une responsable de microfinance", minutes: 30 },
      { titre: "Questions", minutes: 15 },
    ],
  },
  // ── INF-230 ──────────────────────────────────────────────────────────────
  {
    cle: "inf-s1",
    cours: "INF-230",
    titre: "TP guidé · Adressage IP et sous-réseaux",
    description: "Découper un réseau en sous-réseaux, pas à pas, pour préparer le devoir du cybercafé.",
    debut: (t0) => horsDimanche(jourA(t0, -5, 15), -1),
    duree: 90,
    passee: true,
    plan: [
      { titre: "Rappels : adresse IP et masque", minutes: 15 },
      { titre: "Découpage en /25 et /26", minutes: 40 },
      { titre: "Exercice guidé : le cybercafé", minutes: 30 },
      { titre: "Conclusion", minutes: 5 },
    ],
    transcription: [
      [30, "Bonjour Yopougon ! Aujourd'hui, TP : on découpe un réseau en sous-réseaux, ensemble, pas à pas."],
      [300, "Rappel : une adresse IPv4, c'est quatre octets. Le masque dit où s'arrête la partie réseau."],
      [700, "On part de 192.168.10.0/24 : 256 adresses, dont 254 utilisables. Pourquoi 254 ? Il y a l'adresse du réseau et celle de diffusion."],
      [1200, "Si j'emprunte un bit, je passe en /25 : deux sous-réseaux de 126 hôtes. Deux bits, /26 : quatre sous-réseaux de 62 hôtes."],
      [1800, "Pour le cybercafé du devoir, quatre /26 suffisent : clients, personnel, wifi, et une réserve."],
      [2500, "Calculez la passerelle et la diffusion de chaque sous-réseau ; je regarde vos réponses dans le salon du cours."],
      [3400, "Très bien, c'est juste : 192.168.10.63 est l'adresse de diffusion du premier /26."],
      [4200, "La prochaine fois, on installe le réseau d'une PME, du câble au wifi. Bonne soirée !"],
    ],
    questions: [{ texte: "Pourquoi retire-t-on toujours deux adresses par sous-réseau ?", site: "yopougon", par: "etudiant", votes: 4, t: 800, repondueT: 900 }],
    climat: { yopougon: [6, 2, 2, 1] },
  },
  {
    cle: "inf-s2",
    cours: "INF-230",
    titre: "Séance 2 · Installer le réseau d'une PME",
    description: "Du câble au wifi : le matériel, le plan d'adressage, la sécurité minimale et la méthode de dépannage.",
    debut: (t0) => seanceDuJour(t0),
    duree: 90,
    passee: false,
    plan: [
      { titre: "Correction express du devoir du cybercafé", minutes: 15 },
      { titre: "Le matériel d'une petite entreprise", minutes: 20 },
      { titre: "Plan d'adressage : DHCP et adresses fixes", minutes: 25 },
      { titre: "Sécurité et dépannage", minutes: 25 },
      { titre: "Questions", minutes: 5 },
    ],
  },
  // ── GES-120 ──────────────────────────────────────────────────────────────
  {
    cle: "ges-s1",
    cours: "GES-120",
    titre: "Séance 1 · Le bilan en pratique",
    description: "Construire ensemble le bilan d'une vraie boutique : actif, passif, équilibre.",
    debut: (t0) => horsDimanche(jourA(t0, -8, 14, 30), -1),
    duree: 90,
    passee: true,
    plan: [
      { titre: "Le bilan, photographie de l'entreprise", minutes: 20 },
      { titre: "Cas de la boutique de M. Konan", minutes: 45 },
      { titre: "Questions et devoir", minutes: 25 },
    ],
    transcription: [
      [25, "Bonjour Yamoussoukro, bonjour M'Batto ! Aujourd'hui, nous construisons ensemble le bilan d'une vraie boutique."],
      [260, "Le bilan, c'est la photographie de l'entreprise à une date donnée : ce qu'elle possède, et d'où vient l'argent."],
      [640, "À gauche l'actif : le matériel, le stock, la caisse. À droite le passif : le capital, les emprunts, les dettes fournisseurs."],
      [1100, "Prenons la boutique de M. Konan : 800 000 francs de matériel, 1 200 000 de stock, 500 000 en banque et en caisse."],
      [1600, "Total de l'actif : 2 500 000 francs. Et le passif doit donner exactement le même total. Toujours."],
      [2200, "M'Batto demande si le compte Mobile Money de la boutique va dans la trésorerie. Oui : c'est de l'argent disponible, comme la caisse."],
      [3000, "Pour la semaine prochaine : le devoir sur le journal. Cinq opérations, en partie double."],
      [3900, "Merci à tous, et merci à la salle Akwaba pour le son impeccable aujourd'hui."],
    ],
    questions: [
      { texte: "Le compte Mobile Money de la boutique va-t-il dans la trésorerie ?", site: "mbatto", par: "salle", votes: 5, t: 2000, repondueT: 2200 },
      { texte: "Où met-on l'argent prêté par la famille ?", site: "yamoussoukro", par: "etudiant", votes: 3, t: 2600 },
    ],
    climat: { yamoussoukro: [7, 1, 2, 2], mbatto: [6, 2, 1, 2] },
  },
  {
    cle: "ges-s1b",
    cours: "GES-120",
    titre: "Atelier · Exercices corrigés sur le journal",
    description: "Correction en direct du devoir sur le journal, puis cinq nouvelles opérations à passer ensemble, campus par campus.",
    debut: (t0) => horsDimanche(jourA(t0, 1, 14), 1),
    duree: 60,
    passee: false,
    plan: [
      { titre: "Les erreurs fréquentes du devoir", minutes: 15 },
      { titre: "Cinq opérations à passer ensemble", minutes: 35 },
      { titre: "Questions", minutes: 10 },
    ],
  },
  {
    cle: "ges-s2",
    cours: "GES-120",
    titre: "Séance 2 · La TVA sans stress",
    description: "HT, TVA, TTC, TVA collectée et déductible : les calculs du quotidien d'un commerçant ivoirien.",
    debut: (t0) => horsDimanche(jourA(t0, 4, 15), 1),
    duree: 90,
    passee: false,
    plan: [
      { titre: "Correction du devoir sur le journal", minutes: 20 },
      { titre: "HT, TVA, TTC", minutes: 25 },
      { titre: "TVA collectée et déductible", minutes: 35 },
      { titre: "Questions", minutes: 10 },
    ],
  },
  // ── AGR-110 ──────────────────────────────────────────────────────────────
  {
    cle: "agr-s1",
    cours: "AGR-110",
    titre: "Séance 1 · De la cabosse à la fève",
    description: "Récolte, fermentation et séchage : ce qui fait la qualité d'une fève de cacao.",
    debut: (t0) => horsDimanche(jourA(t0, -6, 14), -1),
    duree: 90,
    passee: true,
    plan: [
      { titre: "Tour de salle : qui a déjà écabossé ?", minutes: 10 },
      { titre: "La fermentation", minutes: 35 },
      { titre: "Le séchage et la qualité", minutes: 35 },
      { titre: "Interrogation et suite", minutes: 10 },
    ],
    transcription: [
      [20, "Bonjour Azaguié ! Aujourd'hui, nous parlons de ce qui fait la qualité d'une fève : la fermentation et le séchage."],
      [300, "Combien d'entre vous ont déjà écabossé avec leurs parents ? Presque toute la salle, je m'en doutais."],
      [700, "La fermentation dure cinq à sept jours. C'est elle qui prépare l'arôme du chocolat. Une fève mal fermentée restera amère."],
      [1200, "On brasse le tas tous les deux jours pour l'aérer. Sous les feuilles de bananier, la température monte jusqu'à 45 degrés."],
      [1800, "Ensuite le séchage, au soleil, sur des claies. Jamais directement sur le goudron : les fèves prennent le goût et la poussière."],
      [2500, "Objectif : 7 à 8 % d'humidité. Au-dessus, les fèves moisissent dans les sacs et l'acheteur les refuse."],
      [3300, "L'interrogation sur la filière est ouverte : vous avez encore trois jours."],
      [4000, "La prochaine fois, nous visiterons virtuellement une chocolaterie d'Abidjan. Merci et bonne soirée !"],
    ],
    questions: [{ texte: "Peut-on sécher les fèves avec un séchoir solaire quand il pleut beaucoup ?", site: "azaguie", par: "etudiant", votes: 6, t: 2000, repondueT: 2300 }],
    climat: { azaguie: [8, 1, 1, 3] },
  },
  {
    cle: "agr-s1b",
    cours: "AGR-110",
    titre: "En direct de la coopérative · La pesée et le paiement",
    description: "Séance filmée dans une coopérative près d'Azaguié : pesée, contrôle qualité des fèves, paiement des producteurs par Mobile Money.",
    debut: (t0) => horsDimanche(jourA(t0, -1, 15), -1),
    duree: 60,
    passee: true,
    plan: [
      { titre: "Arrivée des producteurs et pesée", minutes: 20 },
      { titre: "Le test à la coupe", minutes: 20 },
      { titre: "Paiement et questions", minutes: 20 },
    ],
    transcription: [
      [30, "Bonjour Azaguié ! Aujourd'hui, pas de salle de cours : je vous parle depuis le magasin de la coopérative, à quelques kilomètres du campus."],
      [400, "Voici la balance de la coopérative. Elle est contrôlée chaque année : c'est la première garantie pour le producteur."],
      [900, "Le magasinier fait le test à la coupe : on coupe cinquante fèves en deux et on regarde leur couleur. Bien brunes et striées, elles sont bien fermentées."],
      [1500, "Ce lot est refusé : trop d'humidité. Le producteur va le faire sécher deux jours de plus sur les claies."],
      [2200, "Le paiement se fait par Mobile Money sous 48 heures : plus besoin de rentrer au village avec de l'argent liquide."],
      [3100, "Pour le devoir sur la chaîne de valeur, notez bien les étapes que vous venez de voir. Merci à la coopérative de nous avoir accueillis !"],
    ],
    questions: [
      { texte: "Que fait la coopérative des fèves refusées ?", site: "azaguie", par: "etudiant", votes: 5, t: 1600, repondueT: 1700 },
      { texte: "Combien coûte une balance contrôlée pour une petite coopérative ?", site: "azaguie", par: "salle", votes: 3, t: 2500 },
    ],
    climat: { azaguie: [8, 1, 1, 4] },
  },
  {
    cle: "agr-s2",
    cours: "AGR-110",
    titre: "Séance 2 · Transformer le cacao sur place",
    description: "Visite virtuelle d'une chocolaterie d'Abidjan et idées d'entreprises de transformation locale.",
    debut: (t0) => horsDimanche(jourA(t0, 8, 14), 1),
    duree: 90,
    passee: false,
    plan: [
      { titre: "Visite virtuelle d'une chocolaterie", minutes: 40 },
      { titre: "Idées d'entreprises de transformation", minutes: 35 },
      { titre: "Questions", minutes: 15 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Messages, annonces, événements, notifications
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Désignation d'une personne dans les données : « e:25IN0117 » (étudiant par
 * matricule), « f:diallo » (formateur), « v:yopougon » (vie scolaire),
 * « s:mbatto » (écran de salle).
 */
type Qui = string;
const AYA: Qui = `e:${MATRICULE_AYA}`;

type DefMessage = { qui: Qui; quand: (t0: Date) => Date; texte: string; contexte?: string };
type DefConversation =
  | { type: "direct"; entre: [Qui, Qui]; messages: DefMessage[]; /** Dernier message lu par chacun (index, -1 : rien). */ lu: Record<Qui, number> }
  | { type: "cours"; cours: CodeCours; messages: DefMessage[]; lu: Record<Qui, number> };

/** Il y a n jours, à h:m (heure d'Abidjan). */
const ilYa = (n: number, h: number, m = 0) => (t0: Date) => jourA(t0, -n, h, m);
/**
 * Le plus récent des horaires donnés (aujourd'hui, sinon hier) qui précède le
 * semis d'au moins 20 minutes : un message « de ce matin » reste à une heure
 * crédible quelle que soit l'heure du déploiement.
 */
const recent =
  (...horaires: [number, number][]) =>
  (t0: Date) => {
    const candidats = [0, -1]
      .flatMap((n) => horaires.map(([hh, mm]) => jourA(t0, n, hh, mm)))
      .filter((d) => d.getTime() <= t0.getTime() - 20 * MINUTE)
      .sort((a, b) => b.getTime() - a.getTime());
    return candidats[0] ?? jourA(t0, -1, horaires[horaires.length - 1][0], horaires[horaires.length - 1][1]);
  };

const CONTEXTE_DEVOIR_IA = "À propos du devoir : Trois consignes pour une PME de ton quartier";

const CONVERSATIONS: DefConversation[] = [
  {
    type: "direct",
    entre: [AYA, "f:diallo"],
    messages: [
      {
        qui: AYA,
        quand: ilYa(1, 18, 14),
        contexte: CONTEXTE_DEVOIR_IA,
        texte:
          "Bonsoir Monsieur Diallo. Pour le devoir des trois consignes, est-ce que je peux prendre le maquis de ma tante à Yopougon ? Elle vend de l'attiéké poisson et n'arrive pas à répondre à toutes les commandes WhatsApp le soir.",
      },
      { qui: AYA, quand: ilYa(1, 18, 16), texte: "Et est-ce qu'il faut rendre aussi les réponses de l'IA, ou seulement les consignes ?" },
      {
        qui: "f:diallo",
        quand: ilYa(1, 19, 40),
        texte: "Bonsoir Aya ! Excellente idée : un vrai cas vaut mieux que tous les exemples du cours. Le maquis de ta tante est parfait pour la consigne « répondre aux clients ».",
      },
      {
        qui: "f:diallo",
        quand: ilYa(1, 19, 41),
        texte: "Oui, colle la réponse obtenue sous chaque consigne, puis ajoute une ligne : ce que tu as vérifié ou corrigé. C'est cette vérification qui fera la différence. J'ai hâte de lire ta copie !",
      },
    ],
    // Karim a lu les deux messages d'Aya (✓✓) ; Aya n'a pas encore ouvert sa réponse.
    lu: { [AYA]: 1, "f:diallo": 1 },
  },
  {
    type: "direct",
    entre: [AYA, "v:yopougon"],
    messages: [
      {
        qui: AYA,
        quand: ilYa(3, 9, 12),
        texte: "Bonjour Madame Konaté. L'écran de mon téléphone est cassé, je voudrais suivre le prochain live d'IA depuis la salle Kédjénou. Il faut réserver une place ?",
      },
      {
        qui: "v:yopougon",
        quand: ilYa(3, 9, 40),
        texte: "Bonjour Aya. Pas besoin de réserver : viens dix minutes avant, la salle ouvre à 9 h 30. Tu émargeras avec le code à 4 chiffres affiché à l'écran.",
      },
      { qui: "v:yopougon", quand: ilYa(3, 9, 41), texte: "Pour ton écran, le réparateur à côté du marché fait un prix aux étudiants de 2IAE. Passe à la vie scolaire, je te donnerai son numéro." },
      { qui: AYA, quand: ilYa(3, 10, 2), texte: "Merci beaucoup Madame, je passe demain matin 🙏" },
    ],
    lu: { [AYA]: 3, "v:yopougon": 3 },
  },
  {
    type: "direct",
    entre: ["e:25IN0118", "f:diallo"],
    messages: [
      {
        qui: "e:25IN0118",
        quand: recent([8, 40], [13, 10], [18, 25], [21, 15]),
        contexte: CONTEXTE_DEVOIR_IA,
        texte: "Bonjour Monsieur, j'ai rendu mon devoir mais j'ai oublié la vérification de la consigne 3. Est-ce que je peux remplacer ma copie avant la date limite ?",
      },
    ],
    lu: { "e:25IN0118": 0, "f:diallo": -1 },
  },
  {
    type: "cours",
    cours: "IA-101",
    messages: [
      { qui: "e:25AB0311", quand: ilYa(5, 19, 20), texte: "Bonsoir à tous. Pour l'interrogation 1 de ce soir, est-ce que la vidéo de l'Inria compte aussi ?" },
      {
        qui: "f:diallo",
        quand: ilYa(5, 19, 48),
        texte: "Bonsoir Adama. La vidéo reprend les notions des leçons 1.1 et 1.2 : si tu as lu les leçons, tu es prêt. Bon courage à tous pour ce soir !",
      },
      { qui: "e:25GC0315", quand: ilYa(4, 12, 5), texte: "Merci pour la fiche de révision de la séance 1, elle est très claire. Est-ce qu'il y en aura une après chaque live ?" },
      { qui: "f:diallo", quand: ilYa(4, 18, 30), texte: "Oui Grâce, après chaque live. Celle de la séance 2 est déjà en ligne, avec les réponses aux questions votées." },
      { qui: "e:26CO0203", quand: ilYa(3, 21, 10), texte: "Est-ce qu'on a le droit d'utiliser l'IA pour faire le devoir des trois consignes ? 😅" },
      {
        qui: "f:diallo",
        quand: ilYa(2, 8, 15),
        texte: "Bonne question Kouamé ! Oui, c'est même le principe : tu testes tes consignes avec un assistant. Mais ce qui est noté, c'est la qualité de TES consignes et TA vérification des réponses.",
      },
      {
        qui: "e:26GC0401",
        quand: ilYa(1, 13, 5),
        texte: "À M'Batto, on a essayé la consigne du maquis avec toute la salle Akwaba : l'IA a proposé un poulet braisé à 4 000 F. On a vérifié au maquis d'à côté et corrigé 😄",
      },
      { qui: AYA, quand: recent([7, 52], [12, 35], [17, 20], [20, 48]), texte: "Pour la grande séance de mardi, est-ce qu'on doit préparer quelque chose ?" },
    ],
    lu: { [AYA]: 7, "f:diallo": 6, "e:25AB0311": 5, "e:25GC0315": 6, "e:26CO0203": 7, "e:26GC0401": 7 },
  },
  {
    type: "cours",
    cours: "ENT-210",
    messages: [
      { qui: "e:24LE0111", quand: ilYa(2, 18, 2), texte: "Madame, pour le seuil de rentabilité, on compte les frais de transport au marché dans les charges variables ou fixes ?" },
      {
        qui: "f:bamba",
        quand: ilYa(2, 19, 30),
        texte: "Bonsoir Cheick. S'ils augmentent avec chaque vente (un voyage par commande), ce sont des charges variables. Si tu fais un seul voyage par semaine quoi qu'il arrive, c'est une charge fixe.",
      },
      { qui: "e:26GC0142", quand: ilYa(1, 7, 55), texte: "Merci Madame, c'est plus clair pour moi aussi !" },
    ],
    lu: { "f:bamba": 2, "e:24LE0111": 2, "e:26GC0142": 2 },
  },
];

type DefAnnonce = {
  cle: string;
  auteur: Qui;
  titre: string;
  corps: string;
  cible: "tous" | "site" | "cours";
  site?: SlugSite;
  cours?: CodeCours;
  importante?: boolean;
  epinglee?: boolean;
  publierSurSite?: boolean;
  publieeLe: (t0: Date) => Date;
  /** Expire à la fin de la grande séance IA-101 (sinon : jamais). */
  expireApresSeance3?: boolean;
  /** Part des personnes concernées qui l'ont lue. */
  lecture: number;
};

const ANNONCES: DefAnnonce[] = [
  {
    cle: "bienvenue",
    auteur: "v:riviera",
    titre: "Bienvenue sur le campus numérique",
    corps: `Bienvenue sur le campus numérique du Groupe 2IAE !

Ici, tu retrouves tes cours, les lives en direct avec les cinq campus, tes devoirs, tes notes et tes messages avec tes formateurs.

- **Aujourd'hui** : ce que tu as à faire maintenant.
- **Cours** : les leçons, les séances et les replays.
- **Live** : rejoindre la classe en direct, en vidéo ou en audio seulement pour économiser tes données.
- **Devoirs** : rendre un devoir en photo, même quand le réseau coupe.
- **Messages** : écrire à tes formateurs et à la vie scolaire.

Un souci ? Le bouton « Besoin d'aide ? » ouvre WhatsApp vers la vie scolaire de ton campus.

Bonne année scolaire à toutes et à tous !`,
    cible: "tous",
    epinglee: true,
    publieeLe: ilYa(21, 8, 0),
    lecture: 0.75,
  },
  {
    cle: "ia-mardi",
    auteur: "v:riviera",
    titre: "Le cours d'intelligence artificielle commence mardi",
    corps: `Mardi à 10 h (heure d'Abidjan), Dr Karim Diallo retrouve les cinq campus en direct depuis Lyon pour la grande séance du cours « Initiation à l'intelligence artificielle » : **l'IA au service des PME ivoiriennes**.

Suis-le dans la salle de conférence de ton campus, sur ton téléphone ou sur un ordinateur. En salle, l'émargement se fait avec le code affiché à l'écran.

Relis la fiche de révision de la séance 2 et prépare tes questions : les plus votées seront traitées en direct.`,
    cible: "tous",
    importante: true,
    publierSurSite: true,
    publieeLe: recent([9, 0]),
    expireApresSeance3: true,
    lecture: 0.35,
  },
  {
    cle: "yopougon-salle",
    auteur: "v:yopougon",
    titre: "Salle Kédjénou : nouveaux horaires d'ouverture",
    corps:
      "À partir de cette semaine, la salle de conférence Kédjénou ouvre de 7 h 30 à 19 h, du lundi au samedi. Les étudiants qui suivent les lives en salle peuvent aussi y réviser en dehors des cours.\n\nMerci de laisser la salle propre et de signaler toute panne à la vie scolaire.",
    cible: "site",
    site: "yopougon",
    publieeLe: ilYa(3, 8, 30),
    lecture: 0.6,
  },
  {
    cle: "ent-concours",
    auteur: "f:bamba",
    titre: "Concours de plans d'affaires : inscriptions ouvertes",
    corps:
      "Le concours interne de plans d'affaires 2IAE est ouvert aux étudiants d'ENT-210. Les trois meilleurs projets seront présentés à un jury d'entrepreneurs à Abidjan.\n\nInscris-toi dans le salon du cours avant la fin du mois. Ton étude de marché et ton seuil de rentabilité sont la base de ton dossier.",
    cible: "cours",
    cours: "ENT-210",
    publieeLe: ilYa(4, 17, 0),
    lecture: 0.5,
  },
  {
    cle: "azaguie-internat",
    auteur: "v:azaguie",
    titre: "Internat : retour des étudiants dimanche avant 18 h",
    corps:
      "Les internes doivent être de retour dimanche avant 18 h. Le dîner sera servi à 19 h 30. Pensez à rapporter votre carte d'étudiant et vos draps propres.\n\nEn cas de retard, prévenez la vie scolaire sur WhatsApp.",
    cible: "site",
    site: "azaguie",
    publieeLe: ilYa(2, 11, 0),
    lecture: 0.7,
  },
];

type DefEvenement = { titre: string; description: string; debut: (t0: Date) => Date; heures: number; lieu: string };

/** Les trois rendez-vous de chaque campus (BTS blanc, portes ouvertes, réunion parents-professeurs). */
function evenementsDuSite(s: Site, cle: SlugSite): DefEvenement[] {
  const decalage = { riviera: 0, yopougon: 1, yamoussoukro: 2, azaguie: 1, mbatto: 3 }[cle];
  const amphi = cle === "azaguie" ? "Salle Agro-pastorale" : s.salleConference;
  return [
    {
      titre: "Réunion parents-professeurs",
      description: `Rencontre avec les parents des étudiants du campus ${s.nomCourt} : présentation du campus numérique, résultats des premières évaluations, questions. Les formateurs à distance interviennent en visio.`,
      debut: (t0) => horsDimanche(jourA(t0, { riviera: 3, yopougon: 1, yamoussoukro: 2, azaguie: 1, mbatto: 4 }[cle], cle === "azaguie" ? 10 : 16), 1),
      heures: 2,
      lieu: `${amphi} · campus ${s.nomCourt}`,
    },
    {
      titre: "Journée portes ouvertes",
      description: `Le campus ${s.nomCourt} ouvre ses portes aux futurs étudiants et à leurs familles : visite des salles, démonstration d'un cours en direct multi-campus, rencontre avec les étudiants.`,
      debut: (t0) => horsDimanche(jourA(t0, 11, 9), 1),
      heures: 6,
      lieu: `Campus ${s.nomCourt}`,
    },
    {
      titre: "BTS blanc",
      description: "Épreuves écrites du BTS blanc pour toutes les classes de BTS : culture générale, matières professionnelles et épreuve d'expression. Convocations remises par la vie scolaire.",
      debut: (t0) => horsDimanche(jourA(t0, 18 + (decalage % 2), 8), 1),
      heures: 9,
      lieu: `${amphi} · campus ${s.nomCourt}`,
    },
  ];
}

/** Conversations d'Aya avec l'assistant IA (le tuteur ne donne jamais la réponse d'un devoir). */
const CONVERSATIONS_IA: { cours: CodeCours; lecon?: [number, number]; devoir?: string; titre: string; quand: (t0: Date) => Date; messages: ["user" | "assistant", string][] }[] = [
  {
    cours: "ENT-210",
    devoir: "ent-d2",
    titre: "Seuil de rentabilité : par où commencer ?",
    quand: ilYa(2, 21, 3),
    messages: [
      ["user", "Je dois calculer le seuil de rentabilité de mon projet de jus de bissap. Tu peux me donner la formule et faire le calcul ?"],
      [
        "assistant",
        "Bonne idée de t'y prendre à l'avance ! Je ne vais pas faire le calcul à ta place, mais je t'accompagne pas à pas (leçon 2.3).\n\nPour commencer : parmi tes dépenses, lesquelles restent les mêmes chaque mois, que tu vendes 10 ou 500 bouteilles ? Et lesquelles augmentent avec chaque bouteille vendue ? Cite-m'en deux de chaque sorte.",
      ],
      ["user", "Fixes : le loyer du kiosque à 25 000 F et le congélateur. Variables : les fleurs de bissap, le sucre et les bouteilles."],
      [
        "assistant",
        "Très bien, tu viens de séparer charges fixes et charges variables. Une précision sur le congélateur : ce n'est pas une dépense mensuelle mais un investissement ; on le compte par son amortissement (leçon 2.2).\n\nQuestion suivante : si une bouteille te coûte 200 F en ingrédients et que tu la vends 500 F, combien te reste-t-il par bouteille pour payer tes charges fixes ? Ce montant a un nom dans la leçon 2.3 : tu t'en souviens ?",
      ],
      ["user", "Il reste 300 F. C'est la marge sur coût variable !"],
      [
        "assistant",
        "Exactement. Tu as maintenant les deux ingrédients du seuil : tes charges fixes mensuelles et ta marge par bouteille. Relis l'encadré « Le calcul » de la leçon 2.3 et essaie de trouver combien de bouteilles il te faut vendre par mois. Envoie-moi ton résultat, je te dirai si ton raisonnement tient.",
      ],
    ],
  },
  {
    cours: "IA-101",
    lecon: [1, 1],
    titre: "Améliorer ma consigne",
    quand: ilYa(1, 18, 20),
    messages: [
      ["user", "Est-ce que cette consigne est bonne : « Écris un message pour vendre du poulet braisé » ?"],
      [
        "assistant",
        "C'est un bon début, mais le modèle devra deviner beaucoup de choses. Reprenons les quatre ingrédients de la leçon 2.2 :\n\n- **Rôle** : qui parle ? (le gérant du maquis ?)\n- **Contexte** : où, pour quels clients, à quel prix ?\n- **Tâche** : un message d'annonce ? une réponse à un client ?\n- **Format** : combien de lignes, pour WhatsApp ou pour une affiche, sur quel ton ?\n\nEssaie de réécrire ta consigne en ajoutant ces quatre éléments, puis montre-la-moi.",
      ],
      [
        "user",
        "Tu es le gérant d'un maquis à Yopougon. Rédige un message WhatsApp de trois lignes pour annoncer le poulet braisé à 2 500 FCFA ce samedi soir, ton joyeux, avec un appel à réserver.",
      ],
      [
        "assistant",
        "Bravo, les quatre ingrédients y sont : rôle, contexte, tâche et format. Tu peux encore l'améliorer en ajoutant un exemple du ton que tu veux, ou en demandant au modèle de te poser une question s'il lui manque une information (l'heure d'ouverture, par exemple). Pense aussi à vérifier le prix avant d'envoyer le message !",
      ],
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Le semis
// ═══════════════════════════════════════════════════════════════════════════

type Personne = { id: number; role: Role; prenom: string; nom: string; siteId: number | null; email: string | null; matricule: string | null };
type LeconSemee = { id: number; titre: string; publiee: boolean; chapitre: number; rang: number; numero: string };
type CoursSeme = { id: number; code: string; def: DefCours; debut: Date; lecons: LeconSemee[]; inscrits: EtudiantSeme[] };
type SeanceSemee = { id: number; def: DefSeance; debut: Date; demarreeLe: Date | null; termineeLe: Date | null; presents: Set<number> };
type DevoirSeme = { id: number; def: DefDevoir; limite: Date; ouverture: Date | null; questions: QuestionQuiz[] };

type Contexte = {
  tx: Tx;
  t0: Date;
  h: Hasard;
  sites: Map<SlugSite, Site>;
  classes: Map<CleClasse, { id: number; siteId: number; nom: string }>;
  classesCreees: number[];
  personnes: Map<Qui, Personne>;
  etudiants: EtudiantSeme[];
  formateurs: Map<CleFormateur, Personne>;
  vieScolaire: Map<SlugSite, Personne>;
  salles: Map<SlugSite, Personne>;
  cours: Map<CodeCours, CoursSeme>;
  seances: Map<string, SeanceSemee>;
  devoirs: Map<string, DevoirSeme>;
  annonces: Map<string, number>;
  conversations: Map<string, number>;
  fichiersEcrits: string[];
  compte: Record<string, number>;
  avertissements: string[];
};

type Bilan = {
  compte: Record<string, number>;
  formateurs: { email: string; nom: string; cours: string[] }[];
  vieScolaire: { email: string; nom: string; site: string }[];
  salles: { email: string; site: string }[];
  etudiants: { matricule: string; nom: string; site: string; classe: string }[];
  jamaisConnecte: { matricule: string; nom: string };
  aya: { matricule: string };
  avertissements: string[];
};

const compter = (c: Contexte, cle: string, n = 1) => {
  c.compte[cle] = (c.compte[cle] ?? 0) + n;
};

/** Insère par paquets (limite de paramètres de PostgreSQL). */
async function insererParPaquets<T>(liste: T[], taille: number, inserer: (paquet: T[]) => Promise<unknown>) {
  for (let i = 0; i < liste.length; i += taille) await inserer(liste.slice(i, i + taille));
}

const personne = (c: Contexte, qui: Qui): Personne => {
  const p = c.personnes.get(qui);
  if (!p) throw new Error(`Démonstration : personne inconnue « ${qui} »`);
  return p;
};

/** Personne n'étudie à 3 h du matin : une heure entre minuit et 6 h glisse en journée (ou la veille au soir). */
function diurne(d: Date, a?: Date, b?: Date): Date {
  if (d.getUTCHours() >= 6) return d;
  const apres = plus(d, 7 * HEURE);
  if (!b || apres.getTime() <= b.getTime()) return apres;
  const veille = plus(d, -7 * HEURE);
  if (!a || veille.getTime() >= a.getTime()) return veille;
  return d;
}
/** Date au hasard entre a et b (en journée autant que possible). */
const entreDates = (h: Hasard, a: Date, b: Date) => diurne(new Date(a.getTime() + h.reel() * Math.max(0, b.getTime() - a.getTime())), a, b);
/** Jamais dans le futur (les horodatages de démonstration restent crédibles). */
const auPlusTard = (d: Date, t0: Date, marge = MINUTE) => (d.getTime() > t0.getTime() - marge ? new Date(t0.getTime() - marge) : d);

// ── Sites et classes ───────────────────────────────────────────────────────

async function semerSites(c: Contexte) {
  const { SITES_2IAE } = await import("./amorcage");
  const existants = await c.tx.select().from(sites);
  const manquants = SITES_2IAE.filter((s) => !existants.some((e) => e.slug === s.slug));
  if (manquants.length) await c.tx.insert(sites).values(manquants);
  // Le numéro WhatsApp du groupe, sans écraser un numéro déjà réglé par l'école.
  await c.tx
    .update(sites)
    .set({ whatsappVieScolaire: WHATSAPP_VIE_SCOLAIRE })
    .where(sql`coalesce(${sites.whatsappVieScolaire}, '') = ''`);
  for (const s of await c.tx.select().from(sites)) c.sites.set(s.slug as SlugSite, s);

  for (const def of CLASSES) {
    const site = c.sites.get(def.site)!;
    const nom = `${def.libelle} · ${site.nomCourt}`;
    const [existante] = await c.tx
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.nom, nom), eq(classes.siteId, site.id), eq(classes.anneeScolaire, ANNEE_SCOLAIRE)));
    if (existante) {
      // Classe déjà créée par l'école : on la réutilise (la purge ne la supprimera pas).
      const [{ n }] = await c.tx
        .select({ n: sql<number>`count(*)::int` })
        .from(utilisateurs)
        .where(and(eq(utilisateurs.classeId, existante.id), sql`coalesce(${utilisateurs.preferences}->>'demo', 'false') <> 'true'`));
      if (n > 0) c.avertissements.push(`La classe « ${nom} » existe déjà avec ${n} étudiant(s) réel(s) : ils verront les cours de démonstration jusqu'à la purge.`);
      c.classes.set(def.cle, { id: existante.id, siteId: site.id, nom });
      continue;
    }
    const [cree] = await c.tx
      .insert(classes)
      .values({ nom, siteId: site.id, filiere: def.filiere, niveau: def.niveau, anneeScolaire: ANNEE_SCOLAIRE, creeLe: plus(c.t0, -40 * JOUR) })
      .returning({ id: classes.id });
    c.classes.set(def.cle, { id: cree.id, siteId: site.id, nom });
    c.classesCreees.push(cree.id);
    compter(c, "classes");
  }
}

// ── Comptes ────────────────────────────────────────────────────────────────

async function semerComptes(c: Contexte, hash: string, hashCode: string) {
  const { t0, h } = c;
  const creeEtudiants = plus(t0, -30 * JOUR);
  const creePersonnel = plus(t0, -38 * JOUR);
  const prefs = (extra: PreferencesUtilisateur = {}): PreferencesUtilisateur => ({ demo: true, visiteFaite: true, ...extra });
  type Ligne = typeof utilisateurs.$inferInsert & { qui: Qui };
  const lignes: Ligne[] = [];

  for (const v of VIE_SCOLAIRE) {
    lignes.push({
      qui: `v:${v.site}`,
      role: "vie_scolaire",
      prenom: v.prenom,
      nom: v.nom,
      email: `${v.email}@${DOMAINE_DEMO}`,
      telephone: v.telephone,
      motDePasseHash: hash,
      doitChangerMotDePasse: false,
      siteId: c.sites.get(v.site)!.id,
      charteAccepteeLe: plus(creePersonnel, 2 * HEURE),
      preferences: prefs(),
      derniereConnexion: plus(t0, -h.entre(20, 600) * MINUTE),
      creeLe: creePersonnel,
    });
  }
  for (const [slug, s] of c.sites) {
    lignes.push({
      qui: `s:${slug}`,
      role: "salle",
      prenom: "Salle",
      nom: s.salleConference.replace(/^Salle\s+/i, ""),
      email: `salle.${slug}@${DOMAINE_DEMO}`,
      motDePasseHash: hash,
      doitChangerMotDePasse: false,
      siteId: s.id,
      charteAccepteeLe: plus(creePersonnel, 3 * HEURE),
      preferences: prefs(),
      derniereConnexion: plus(t0, -h.entre(3, 30) * HEURE),
      creeLe: creePersonnel,
    });
  }

  // Slugs publics des formateurs : sans collision avec une fiche réelle.
  const pris = new Set(
    (await c.tx.select({ slug: utilisateurs.slug }).from(utilisateurs).where(inArray(utilisateurs.slug, FORMATEURS.map((f) => f.slug)))).map((l) => l.slug),
  );
  for (const f of FORMATEURS) {
    const slug = pris.has(f.slug) ? `${f.slug}-2iae` : f.slug;
    if (slug !== f.slug) c.avertissements.push(`Le slug « ${f.slug} » est déjà pris : la fiche de démonstration utilise « ${slug} ».`);
    lignes.push({
      qui: `f:${f.cle}`,
      role: "formateur",
      prenom: f.prenom,
      nom: f.nom,
      email: `${f.email}@${DOMAINE_DEMO}`,
      motDePasseHash: hash,
      doitChangerMotDePasse: false,
      siteId: f.site ? c.sites.get(f.site)!.id : null,
      slug,
      titre: f.titre,
      bio: f.bio,
      localisation: f.localisation,
      consentementSite: true,
      proposeSurSite: f.publierSurSite,
      publierSurSite: f.publierSurSite,
      annonceLe: f.annonceIlYaJours ? plus(t0, -f.annonceIlYaJours * JOUR) : null,
      charteAccepteeLe: plus(creePersonnel, 5 * HEURE),
      preferences: prefs(),
      derniereConnexion: f.cle === "diallo" ? plus(t0, -95 * MINUTE) : plus(t0, -h.entre(2, 40) * HEURE),
      creeLe: creePersonnel,
    });
  }

  const vus: Record<Profil, [number, number]> = { assidu: [0.2, 20], regulier: [20, 70], fragile: [75, 140], decroche: [215, 310] };
  for (const e of ETUDIANTS) {
    const classe = c.classes.get(e.classe)!;
    const def = CLASSES.find((x) => x.cle === e.classe)!;
    const [a, b] = vus[e.profil];
    const base = {
      qui: `e:${e.matricule}`,
      role: "etudiant" as const,
      prenom: e.prenom,
      nom: e.nom,
      matricule: e.matricule,
      telephone: e.telephone,
      siteId: c.sites.get(def.site)!.id,
      classeId: classe.id,
    };
    if (e.jamaisConnecte) {
      const creeLe = plus(t0, -10 * JOUR);
      lignes.push({
        ...base,
        motDePasseHash: hashCode,
        doitChangerMotDePasse: true,
        motDePasseExpireLe: plus(creeLe, DUREE_CODE_PROVISOIRE_MS),
        preferences: { demo: true },
        creeLe,
      });
      continue;
    }
    lignes.push({
      ...base,
      motDePasseHash: hash,
      doitChangerMotDePasse: false,
      charteAccepteeLe: plus(creeEtudiants, h.entre(1, 72) * HEURE),
      preferences: prefs({ modeSuivi: e.suivi, donneesReduites: e.suivi === "telephone" && h.chance(0.4) }),
      derniereConnexion: e.matricule === MATRICULE_AYA ? plus(t0, -25 * MINUTE) : plus(t0, -(a + h.reel() * (b - a)) * HEURE),
      creeLe: creeEtudiants,
    });
  }

  const inseres = await c.tx
    .insert(utilisateurs)
    .values(lignes.map(({ qui: _q, ...l }) => l))
    .returning({ id: utilisateurs.id, role: utilisateurs.role, prenom: utilisateurs.prenom, nom: utilisateurs.nom, siteId: utilisateurs.siteId, email: utilisateurs.email, matricule: utilisateurs.matricule });
  for (const u of inseres) {
    const qui = u.matricule ? `e:${u.matricule}` : lignes.find((l) => l.email === u.email)!.qui;
    c.personnes.set(qui, u);
  }
  compter(c, "comptes", inseres.length);

  for (const f of FORMATEURS) c.formateurs.set(f.cle, personne(c, `f:${f.cle}`));
  for (const v of VIE_SCOLAIRE) c.vieScolaire.set(v.site, personne(c, `v:${v.site}`));
  for (const slug of c.sites.keys()) c.salles.set(slug, personne(c, `s:${slug}`));
  ETUDIANTS.forEach((e, rang) => {
    const p = personne(c, `e:${e.matricule}`);
    const def = CLASSES.find((x) => x.cle === e.classe)!;
    c.etudiants.push({ ...e, id: p.id, siteId: p.siteId!, classeId: c.classes.get(e.classe)!.id, site: def.site, rang });
  });
}

// ── Cours, chapitres, leçons ───────────────────────────────────────────────

async function semerCours(c: Contexte) {
  const { t0 } = c;
  const existants = await c.tx
    .select({ code: cours.code, slug: cours.slug })
    .from(cours)
    .where(or(inArray(cours.code, [...CODES_COURS_DEMO]), inArray(cours.slug, COURS.map((x) => x.slug)))!);
  for (const def of COURS) {
    const codePris = existants.some((e) => e.code === def.code);
    const slugPris = existants.some((e) => e.slug === def.slug);
    const code = codePris ? `${def.code}-D` : def.code;
    const slug = slugPris ? `${def.slug}-demo` : def.slug;
    if (codePris) c.avertissements.push(`Un cours ${def.code} existe déjà : le cours de démonstration s'appelle ${code}.`);
    const debut = jourA(t0, -def.debutIlYaJours, 8);
    const [cr] = await c.tx
      .insert(cours)
      .values({
        code,
        slug,
        titre: def.titre,
        description: def.description,
        objectifs: def.objectifs,
        couleur: def.couleur,
        formateurId: c.formateurs.get(def.formateur)!.id,
        statut: "publie",
        dateDebut: debut,
        dateFin: plus(debut, def.semaines * 7 * JOUR),
        proposeSurSite: def.publierSurSite,
        publierSurSite: def.publierSurSite,
        accrocheSite: def.accroche,
        creeLe: plus(t0, -35 * JOUR),
        majLe: plus(t0, -2 * JOUR),
      })
      .returning({ id: cours.id });
    await c.tx.insert(coursClasses).values(def.classes.map((cle) => ({ coursId: cr.id, classeId: c.classes.get(cle)!.id })));
    const inscrits = c.etudiants.filter((e) => def.classes.includes(e.classe));
    const semes: LeconSemee[] = [];
    for (const [i, ch] of def.chapitres.entries()) {
      const [m] = await c.tx.insert(modules).values({ coursId: cr.id, titre: ch.titre, ordre: i + 1 }).returning({ id: modules.id });
      const lignes = await c.tx
        .insert(lecons)
        .values(
          ch.lecons.map((l, j) => ({
            moduleId: m.id,
            coursId: cr.id,
            titre: l.titre,
            type: l.type ?? ("texte" as const),
            contenu: l.contenu,
            url: l.url ?? null,
            dureeMinutes: l.duree,
            ordre: j + 1,
            publiee: l.publiee ?? true,
            creeLe: plus(t0, -(33 - i * 7) * JOUR),
          })),
        )
        .returning({ id: lecons.id, ordre: lecons.ordre });
      let rang = 0;
      for (const [j, l] of ch.lecons.entries()) {
        const publiee = l.publiee ?? true;
        semes.push({ id: lignes.find((x) => x.ordre === j + 1)!.id, titre: l.titre, publiee, chapitre: i, rang: j, numero: publiee ? `${i + 1}.${++rang}` : "" });
      }
      compter(c, "lecons", ch.lecons.length);
    }
    c.cours.set(def.code, { id: cr.id, code, def, debut, lecons: semes, inscrits });
    compter(c, "cours");
  }

  for (const f of FICHES_LECONS) {
    const co = c.cours.get(f.cours)!;
    const l = co.lecons.find((x) => x.chapitre === f.chapitre && x.rang === f.lecon)!;
    await c.tx.insert(fichesRevision).values({
      coursId: co.id,
      leconId: l.id,
      titre: `L'essentiel en 5 points · ${l.titre}`,
      contenu: f.contenu,
      validee: true,
      creeLe: plus(t0, -(f.chapitre === 0 ? 12 : 6) * JOUR),
    });
    compter(c, "fiches");
  }
}

// ── Progression dans les leçons ────────────────────────────────────────────

async function semerProgressions(c: Contexte) {
  const { t0, h } = c;
  const parts: Record<Profil, [number, number]> = { assidu: [0.6, 1], regulier: [0.35, 0.7], fragile: [0.1, 0.35], decroche: [0, 0.2] };
  const ayaParCours: Partial<Record<CodeCours, number>> = { "IA-101": 6, "ENT-210": 5, "INF-230": 3 };
  const lignesProgression: (typeof progressions.$inferInsert)[] = [];
  const lignesLecture: (typeof lecturesCours.$inferInsert)[] = [];
  for (const co of c.cours.values()) {
    const publiees = co.lecons.filter((l) => l.publiee);
    for (const e of co.inscrits) {
      if (e.jamaisConnecte) continue;
      const [a, b] = parts[e.profil];
      let n = Math.round(publiees.length * (a + h.reel() * (b - a)));
      if (e.matricule === MATRICULE_AYA) n = ayaParCours[co.def.code] ?? n;
      n = Math.min(publiees.length, n);
      const fin = e.profil === "decroche" ? plus(t0, -9 * JOUR) : plus(t0, -2 * HEURE);
      const debut = plus(co.debut, JOUR);
      let derniere = debut;
      for (let k = 0; k < n; k++) {
        const t = diurne(new Date(debut.getTime() + ((k + 1) / (n + 1)) * (fin.getTime() - debut.getTime()) + (h.reel() - 0.5) * 6 * HEURE), undefined, fin);
        derniere = auPlusTard(t < derniere ? plus(derniere, 20 * MINUTE) : t, t0);
        lignesProgression.push({ utilisateurId: e.id, leconId: publiees[k].id, termineeLe: derniere });
      }
      if (n > 0 || e.profil !== "decroche") {
        const suivante = publiees[Math.min(n, publiees.length - 1)];
        lignesLecture.push({ utilisateurId: e.id, coursId: co.id, leconId: suivante.id, lueLe: auPlusTard(plus(derniere, h.entre(5, 90) * MINUTE), t0) });
      }
    }
  }
  await insererParPaquets(lignesProgression, 500, (p) => c.tx.insert(progressions).values(p));
  await insererParPaquets(lignesLecture, 500, (p) => c.tx.insert(lecturesCours).values(p));
  compter(c, "progressions", lignesProgression.length);
}

// ── Séances en direct ──────────────────────────────────────────────────────

const PRESENCE: Record<Profil, number> = { assidu: 0.95, regulier: 0.8, fragile: 0.5, decroche: 0 };

function choisirPondere(h: Hasard, poids: number[]): number {
  const total = poids.reduce((s, x) => s + x, 0);
  let r = h.reel() * total;
  for (let i = 0; i < poids.length; i++) {
    r -= poids[i];
    if (r < 0) return i;
  }
  return poids.length - 1;
}

async function semerSeances(c: Contexte) {
  const { t0, h, tx } = c;
  for (const def of SEANCES) {
    const co = c.cours.get(def.cours)!;
    const formateur = c.formateurs.get(co.def.formateur)!;
    const debut = def.debut(t0);
    const sitesDuCours = [...new Set(co.def.classes.map((cle) => CLASSES.find((x) => x.cle === cle)!.site))];
    const dernierT = def.transcription?.at(-1)?.[0] ?? (def.duree - 5) * 60;
    const demarreeLe = def.passee ? plus(debut, 2 * MINUTE) : null;
    const termineeLe = def.passee ? plus(demarreeLe!, (dernierT + 150) * 1000) : null;
    const transcription = (def.transcription ?? []).map(([t, texte]) => `[${minutage(t)}] ${texte}`).join("\n");
    const [s] = await tx
      .insert(seances)
      .values({
        coursId: co.id,
        titre: def.titre,
        description: def.description,
        debut,
        dureeMinutes: def.duree,
        statut: def.passee ? "terminee" : "planifiee",
        fournisseur: "daily",
        plan: def.plan,
        demarreeLe,
        termineeLe,
        transcription,
        resumeIa: def.fiche ?? null,
        resumeIaLe: def.fiche && termineeLe ? plus(termineeLe, 5 * HEURE) : null,
        resumeValide: Boolean(def.fiche && def.ficheValidee),
        resumeParIa: Boolean(def.fiche),
        proposeSurSite: Boolean(def.publierSurSite),
        publierSurSite: Boolean(def.publierSurSite),
        lienSecours: def.lienSecours ?? null,
        creeLe: new Date(Math.min(plus(debut, -10 * JOUR).getTime(), plus(t0, -HEURE).getTime())),
      })
      .returning({ id: seances.id });
    const semee: SeanceSemee = { id: s.id, def, debut, demarreeLe, termineeLe, presents: new Set() };
    c.seances.set(def.cle, semee);
    compter(c, "seances");

    if (!def.passee) {
      if (def.sondages?.length) {
        await tx.insert(sondages).values(
          def.sondages.map((so) => ({ seanceId: s.id, question: so.question, options: so.options, bonneReponse: so.bonne, explication: so.explication ?? null, parIa: Boolean(so.parIa), ouvert: false })),
        );
        compter(c, "sondages", def.sondages.length);
      }
      continue;
    }

    await semerDirectPasse(c, semee, co, formateur, sitesDuCours);
  }
}

async function semerDirectPasse(c: Contexte, se: SeanceSemee, co: CoursSeme, formateur: Personne, sitesDuCours: SlugSite[]) {
  const { t0, h, tx } = c;
  const def = se.def;
  const demarree = se.demarreeLe!;
  const terminee = se.termineeLe!;
  const a = (t: number) => plus(demarree, t * 1000);
  const dureeReelle = Math.round((terminee.getTime() - demarree.getTime()) / MINUTE);

  // Sous-titres horodatés (la transcription de la séance en est l'assemblage).
  if (def.transcription?.length) {
    await tx.insert(sousTitres).values(def.transcription.map(([t, texte]) => ({ seanceId: se.id, t, texte, creeLe: a(t) })));
    compter(c, "sousTitres", def.transcription.length);
  }

  // Présences : émargées en salle, en ligne, partielles, justifiées, absents.
  const incidentSite = def.incident ? c.sites.get(def.incident.site)!.id : null;
  const attendus = co.inscrits.filter((e) => !e.jamaisConnecte);
  const lignesPresence: (typeof presences.$inferInsert)[] = [];
  const enSalleParSite = new Map<number, number>();
  const enLigne: EtudiantSeme[] = [];
  const tous: EtudiantSeme[] = [];
  for (const e of attendus) {
    let p = PRESENCE[e.profil];
    if (e.siteId === incidentSite) p -= 0.25;
    const present = e.matricule === MATRICULE_AYA || h.chance(p);
    if (!present) {
      if (e.profil !== "decroche" && h.chance(0.3)) {
        lignesPresence.push({
          seanceId: se.id,
          utilisateurId: e.id,
          siteId: e.siteId,
          mode: "en_ligne",
          minutes: 0,
          justification: h.choix(["Rendez-vous médical (certificat remis)", "Décès dans la famille", "Convocation administrative", "Malade, certificat remis à la vie scolaire"]),
          arriveeLe: demarree,
          derniereActivite: demarree,
        });
      }
      continue;
    }
    se.presents.add(e.id);
    tous.push(e);
    if (e.suivi === "salle") {
      const retard = h.chance(0.1);
      const arrivee = plus(se.debut, (retard ? h.entre(16, 26) : h.entre(-12, 10)) * MINUTE);
      const pointe = !retard && h.chance(0.15);
      lignesPresence.push({
        seanceId: se.id,
        utilisateurId: e.id,
        siteId: e.siteId,
        mode: "salle",
        emargeQr: !pointe,
        pointeParId: pointe ? c.vieScolaire.get(e.site)!.id : null,
        arriveeLe: arrivee,
        derniereActivite: terminee,
        minutes: 0,
      });
      enSalleParSite.set(e.siteId, (enSalleParSite.get(e.siteId) ?? 0) + 1);
    } else {
      const partiel = e.matricule !== MATRICULE_AYA && h.chance(e.profil === "fragile" ? 0.4 : 0.12);
      const minutes = partiel ? h.entre(18, 45) : Math.min(dureeReelle, h.entre(Math.ceil(dureeReelle * 0.78), dureeReelle));
      const arrivee = plus(demarree, h.entre(0, partiel ? 30 : 6) * MINUTE);
      lignesPresence.push({
        seanceId: se.id,
        utilisateurId: e.id,
        siteId: e.siteId,
        mode: "en_ligne",
        arriveeLe: arrivee,
        derniereActivite: plus(arrivee, minutes * MINUTE),
        minutes,
      });
      enLigne.push(e);
    }
  }
  await tx.insert(presences).values(lignesPresence);
  compter(c, "presences", lignesPresence.length);

  // Effectifs déclarés par les responsables de salle (un petit écart à Yamoussoukro en séance 2).
  await tx.insert(effectifsSalles).values(
    sitesDuCours.map((slug) => {
      const site = c.sites.get(slug)!;
      const emarges = enSalleParSite.get(site.id) ?? 0;
      return {
        seanceId: se.id,
        siteId: site.id,
        nombre: emarges + (def.cle === "ia-s2" && slug === "yamoussoukro" ? 1 : 0),
        prete: true,
        incident: def.incident && def.incident.site === slug ? def.incident.texte : null,
        majLe: plus(se.debut, -8 * MINUTE),
      };
    }),
  );

  // Questions votées, signées par campus.
  const votants = [...tous.map((e) => e.id), ...sitesDuCours.map((slug) => c.salles.get(slug)!.id)];
  for (const [i, q] of (def.questions ?? []).entries()) {
    const site = c.sites.get(q.site)!;
    let auteurId: number;
    if (q.par === "salle") auteurId = c.salles.get(q.site)!.id;
    else {
      const candidats = tous.filter((e) => e.site === q.site);
      const aya = def.cle === "ia-s1" && q.site === "yopougon" && i < 3 ? candidats.find((e) => e.matricule === MATRICULE_AYA) : undefined;
      auteurId = (aya ?? (candidats.length ? h.choix(candidats) : c.etudiants.find((e) => e.site === q.site)!)).id;
    }
    const votes = Math.min(q.votes, votants.length);
    const [ql] = await tx
      .insert(questionsLive)
      .values({
        seanceId: se.id,
        auteurId,
        siteId: site.id,
        texte: q.texte,
        votes,
        anonyme: q.par === "salle" || Boolean(q.anonyme),
        repondue: q.repondueT !== undefined,
        reponduLe: q.repondueT !== undefined ? a(q.repondueT) : null,
        creeLe: a(q.t),
      })
      .returning({ id: questionsLive.id });
    const autres = h.melanger(votants.filter((id) => id !== auteurId)).slice(0, votes - 1);
    await tx.insert(votesQuestions).values([auteurId, ...autres].map((utilisateurId) => ({ questionId: ql.id, utilisateurId })));
    compter(c, "questions");
  }

  // Événements du fil : démarrage, paroles, incident, fin.
  const evts: (typeof evenementsSeances.$inferInsert)[] = [{ seanceId: se.id, type: "demarrage", donnees: { par: formateur.id }, creeLe: demarree }];
  for (const m of def.mains ?? []) {
    const site = c.sites.get(m.site)!;
    const qui =
      m.par === "salle" ? c.salles.get(m.site)!.id : (enLigne.find((e) => e.site === m.site) ?? tous.find((e) => e.site === m.site) ?? c.etudiants.find((e) => e.site === m.site)!).id;
    const [main] = await tx
      .insert(mainsLevees)
      .values({
        seanceId: se.id,
        utilisateurId: qui,
        siteId: site.id,
        leveeLe: a(m.t),
        paroleDonneeLe: m.paroleT !== undefined ? a(m.paroleT) : null,
        baisseeLe: m.finT !== undefined ? a(m.finT) : terminee,
      })
      .returning({ id: mainsLevees.id });
    if (m.paroleT !== undefined) {
      evts.push({
        seanceId: se.id,
        type: "parole",
        donnees: {
          type: m.par === "salle" ? "salle" : "etudiant",
          siteId: site.id,
          site: site.nomCourt,
          utilisateurId: m.par === "salle" ? null : qui,
          libelle: m.par === "salle" ? site.nomCourt : `Un étudiant en ligne · ${site.nomCourt}`,
          depuis: a(m.paroleT).toISOString(),
          mainId: main.id,
        },
        creeLe: a(m.paroleT),
      });
      const fin = m.finT ?? m.paroleT + 60;
      evts.push({
        seanceId: se.id,
        type: "parole_fin",
        donnees: { siteId: site.id, utilisateurId: m.par === "salle" ? null : qui, secondes: fin - m.paroleT },
        creeLe: a(fin),
      });
    }
  }
  if (def.incident) {
    const site = c.sites.get(def.incident.site)!;
    evts.push({ seanceId: se.id, type: "incident", donnees: { siteId: site.id, incident: def.incident.texte }, creeLe: a(def.incident.t) });
  }
  evts.push({ seanceId: se.id, type: "fin", donnees: { par: formateur.id, automatique: false }, creeLe: terminee });
  await tx.insert(evenementsSeances).values(evts);

  // Sondages éclair et réponses par campus.
  for (const so of def.sondages ?? []) {
    const ouvertLe = a(so.t ?? 0);
    const [ligne] = await tx
      .insert(sondages)
      .values({
        seanceId: se.id,
        question: so.question,
        options: so.options,
        bonneReponse: so.bonne,
        explication: so.explication ?? null,
        ouvert: false,
        ouvertLe,
        fermeLe: plus(ouvertLe, (so.duree ?? 120) * 1000),
        parIa: Boolean(so.parIa),
        creeLe: plus(ouvertLe, -30 * MINUTE),
      })
      .returning({ id: sondages.id });
    const attendue = so.bonne ?? 1;
    const reponses = tous
      .filter(() => h.chance(0.88))
      .map((e) => {
        const penchant = so.penchant?.[e.site];
        let choix: number;
        if (penchant !== undefined && penchant === so.bonne) choix = penchant;
        else if (penchant !== undefined && h.chance(0.55)) choix = penchant;
        else if (h.chance(so.reussite ?? 0.7)) choix = attendue;
        else choix = h.choix(so.options.map((_o, i) => i).filter((i) => i !== attendue));
        return { sondageId: ligne.id, utilisateurId: e.id, choix, siteId: e.siteId };
      });
    if (reponses.length) await tx.insert(reponsesSondages).values(reponses);
    compter(c, "sondages");
  }

  // Baromètre de compréhension (ressentis horodatés, par campus).
  const lignesRessentis: (typeof ressentis.$inferInsert)[] = [];
  const noms: Ressenti[] = ["compris", "perdu", "lent", "bravo"];
  for (const e of tous) {
    const poids = def.climat?.[e.site] ?? [7, 1, 1, 2];
    for (let k = h.entre(1, 3); k > 0; k--) {
      lignesRessentis.push({ seanceId: se.id, utilisateurId: e.id, siteId: e.siteId, ressenti: noms[choisirPondere(h, poids)], creeLe: a(h.entre(300, Math.max(400, dureeReelle * 60 - 300))) });
    }
    if (def.cle === "ia-s2" && e.site === "yamoussoukro" && h.chance(0.7)) {
      lignesRessentis.push({ seanceId: se.id, utilisateurId: e.id, siteId: e.siteId, ressenti: "lent", creeLe: a(h.entre(4080, 4230)) });
    }
    // Le dernier clic de la séance (celui que retient le bilan) : surtout « compris » et « bravo ».
    if (h.chance(0.85)) {
      const fin = dureeReelle * 60;
      const poidsFin = [5, 0.3, def.cle === "ia-s2" && e.site === "yamoussoukro" ? 1.5 : 0.5, 4];
      lignesRessentis.push({ seanceId: se.id, utilisateurId: e.id, siteId: e.siteId, ressenti: noms[choisirPondere(h, poidsFin)], creeLe: a(h.entre(fin - 280, fin - 20)) });
    }
  }
  if (lignesRessentis.length) await tx.insert(ressentis).values(lignesRessentis);

  // Replays revus (suivis à part, jamais comptés comme présence).
  if (def.transcription?.length) {
    const vues = co.inscrits
      .filter((e) => !e.jamaisConnecte && e.profil !== "decroche" && h.chance(se.presents.has(e.id) ? 0.3 : 0.6))
      .map((e) => {
        const premiere = auPlusTard(diurne(plus(terminee, h.entre(3, 60) * HEURE)), t0);
        return { seanceId: se.id, utilisateurId: e.id, premiereVue: premiere, derniereVue: auPlusTard(plus(premiere, h.entre(0, 30) * HEURE), t0) };
      });
    if (vues.length) await tx.insert(vuesReplay).values(vues);
  }
}

// ── Devoirs, interrogations, copies ────────────────────────────────────────

/** Répartit une note sur les critères de la grille (au quart de point). */
function repartir(note: number, grille: CritereGrille[], h: Hasard): { critere: string; points: number; obtenu: number }[] {
  const total = grille.reduce((s, g) => s + g.points, 0);
  let reste = note;
  const lignes = grille.map((g, i) => {
    if (i === grille.length - 1) return { critere: g.critere, points: g.points, obtenu: 0 };
    const o = Math.min(g.points, Math.max(0, auQuart(g.points * (note / total) * (0.88 + h.reel() * 0.24))));
    reste -= o;
    return { critere: g.critere, points: g.points, obtenu: o };
  });
  const derniere = lignes[lignes.length - 1];
  derniere.obtenu = Math.min(derniere.points, Math.max(0, auQuart(reste)));
  return lignes;
}

const NOTE_PAR_PROFIL: Record<Profil, [number, number]> = { assidu: [14.5, 18.5], regulier: [11, 15], fragile: [7.5, 11.5], decroche: [5, 9] };
const REUSSITE_QUIZ: Record<Profil, number> = { assidu: 0.88, regulier: 0.72, fragile: 0.52, decroche: 0.4 };

/** Réponse donnée à une question : juste ou fausse (erreur plausible). */
function reponseA(q: QuestionQuiz, juste: boolean, h: Hasard, faux: string[] | undefined): (number | string)[] {
  if (juste) return q.type === "reponse_courte" ? [String(q.bonnesReponses[0])] : [...q.bonnesReponses];
  if (q.type === "reponse_courte") return [h.choix(faux?.length ? faux : ["je ne sais pas"])];
  const bonnes = q.bonnesReponses.map(Number);
  const autres = q.options.map((_o, i) => i).filter((i) => !bonnes.includes(i));
  if (q.type === "choix_multiple") {
    // Une bonne réponse oubliée, ou une mauvaise ajoutée.
    return bonnes.length > 1 && h.chance(0.6) ? bonnes.slice(0, -1) : [...bonnes, h.choix(autres)].sort((x, y) => x - y);
  }
  return [h.choix(autres)];
}

async function semerDevoirs(c: Contexte) {
  const { t0, h, tx } = c;
  for (const def of DEVOIRS) {
    const co = c.cours.get(def.cours)!;
    const formateur = c.formateurs.get(co.def.formateur)!;
    const limite = jourA(t0, def.limite.jours, def.limite.h, def.limite.m);
    const ouverture = def.ouvertureJours === null ? null : jourA(t0, def.ouvertureJours, 8);
    const [d] = await tx
      .insert(devoirs)
      .values({
        coursId: co.id,
        auteurId: formateur.id,
        type: def.type,
        titre: def.titre,
        consigne: def.consigne,
        ouvertureLe: ouverture,
        dateLimite: limite,
        bareme: def.bareme,
        coefficient: def.coefficient,
        accepteRetard: def.accepteRetard,
        dureeMinutes: def.dureeMinutes ?? null,
        tentativesMax: def.tentativesMax ?? 1,
        correctionVisible: true,
        grille: def.grille ?? [],
        publie: true,
        creeLe: plus(ouverture ?? limite, -2 * JOUR),
      })
      .returning({ id: devoirs.id });
    let questions: QuestionQuiz[] = [];
    if (def.questions?.length) {
      questions = await tx
        .insert(questionsQuiz)
        .values(
          def.questions.map((q, i) => ({
            devoirId: d.id,
            type: q.type,
            enonce: q.enonce,
            options: q.type === "vrai_faux" ? ["Vrai", "Faux"] : q.type === "reponse_courte" ? [] : (q.options ?? []),
            bonnesReponses: q.bonnes,
            explication: q.explication,
            points: q.points ?? 1,
            ordre: i + 1,
          })),
        )
        .returning();
    }
    const semeDevoir: DevoirSeme = { id: d.id, def, limite, ouverture, questions };
    c.devoirs.set(def.cle, semeDevoir);
    compter(c, def.type === "quiz" ? "interrogations" : "depots");

    // Rappels déjà envoyés (la tâche des rappels ne les renverra pas).
    const inscrits = co.inscrits.filter((e) => !e.jamaisConnecte);
    const rappels: (typeof rappelsDevoirs.$inferInsert)[] = [];
    if (ouverture && ouverture <= t0) rappels.push({ devoirId: d.id, type: "ouverture", echeance: limite, destinataires: co.inscrits.length, envoyeLe: ouverture });
    if (limite <= t0) rappels.push({ devoirId: d.id, type: "veille", echeance: limite, destinataires: Math.ceil(co.inscrits.length / 3), envoyeLe: plus(limite, -20 * HEURE) });
    if (rappels.length) await tx.insert(rappelsDevoirs).values(rappels);

    if (def.type === "quiz") await semerTentatives(c, semeDevoir, inscrits);
    else await semerCopies(c, semeDevoir, inscrits, formateur);
  }
}

async function semerTentatives(c: Contexte, d: DevoirSeme, inscrits: EtudiantSeme[]) {
  const { t0, h, tx } = c;
  const def = d.def;
  const ferme = def.scenario === "quiz_ferme";
  const participation: Record<Profil, number> = ferme ? { assidu: 0.97, regulier: 0.85, fragile: 0.55, decroche: 0 } : { assidu: 0.45, regulier: 0.2, fragile: 0.05, decroche: 0 };
  const duree = def.dureeMinutes ?? 20;
  const debutFenetre = plus(d.ouverture ?? plus(d.limite, -7 * JOUR), HEURE);
  const finFenetre = ferme ? plus(d.limite, -(duree + 5) * MINUTE) : plus(t0, -(duree + 10) * MINUTE);
  const fauxParQuestion = new Map(d.questions.map((q, i) => [q.id, def.questions?.[i]?.faux]));
  for (const e of inscrits) {
    const aya = e.matricule === MATRICULE_AYA;
    if (!aya && !h.chance(participation[e.profil])) continue;
    if (aya && !ferme) continue;
    const nbTentatives = aya ? 2 : (def.tentativesMax ?? 1) > 1 && h.chance(0.35) ? 2 : 1;
    const notes: { note: number; fin: Date }[] = [];
    let debut = entreDates(h, debutFenetre, finFenetre);
    for (let k = 0; k < nbTentatives; k++) {
      // Aya : 4/6 puis 5/6 (elle a retravaillé la question à choix multiple… pas encore la réponse courte).
      const fautesAya = k === 0 ? [2, 4] : [2];
      const reponses: Record<string, (number | string)[]> = {};
      d.questions.forEach((q, i) => {
        const juste = aya ? !fautesAya.includes(i) : h.chance(Math.min(0.97, REUSSITE_QUIZ[e.profil] + k * 0.1));
        reponses[String(q.id)] = reponseA(q, juste, h, fauxParQuestion.get(q.id));
      });
      const resultat = corrigerTentative(d.questions, reponses, def.bareme);
      const finPrevue = new Date(Math.min(plus(debut, duree * MINUTE).getTime(), d.limite.getTime()));
      const fin = auPlusTard(new Date(Math.min(plus(debut, h.entre(Math.min(6, duree - 1), duree - 1) * MINUTE).getTime(), finPrevue.getTime())), t0);
      await tx.insert(tentativesQuiz).values({ devoirId: d.id, etudiantId: e.id, debutLe: debut, finPrevueLe: finPrevue, finLe: fin, reponses, score: resultat.score, note: resultat.note });
      notes.push({ note: resultat.note, fin });
      compter(c, "tentatives");
      const prochain = plus(fin, h.entre(2, 30) * HEURE);
      if (prochain.getTime() > finFenetre.getTime()) break;
      debut = prochain;
    }
    const meilleure = Math.max(...notes.map((n) => n.note));
    const [r] = await tx
      .insert(rendus)
      .values({ devoirId: d.id, etudiantId: e.id, statut: "corrige", renduLe: notes[0].fin, enRetard: false, note: meilleure, corrigeLe: notes.at(-1)!.fin, majLe: notes.at(-1)!.fin })
      .returning({ id: rendus.id });
    await tx.update(rendus).set({ recu: recuPour(r.id) }).where(eq(rendus.id, r.id));
    compter(c, "copies");
  }
}

async function semerCopies(c: Contexte, d: DevoirSeme, inscrits: EtudiantSeme[], formateur: Personne) {
  const { t0, h, tx } = c;
  const def = d.def;
  const chances: Record<Scenario, Record<Profil, number>> = {
    corrige: { assidu: 1, regulier: 0.92, fragile: 0.6, decroche: 0 },
    a_venir: { assidu: 0.55, regulier: 0.25, fragile: 0.08, decroche: 0 },
    retard: { assidu: 0.95, regulier: 0.85, fragile: 0.2, decroche: 0 },
    quiz_ferme: { assidu: 0, regulier: 0, fragile: 0, decroche: 0 },
    quiz_ouvert: { assidu: 0, regulier: 0, fragile: 0, decroche: 0 },
  };
  const retardProba: Record<Profil, number> = def.scenario === "retard" ? { assidu: 0.05, regulier: 0.5, fragile: 1, decroche: 1 } : { assidu: 0.05, regulier: 0.12, fragile: 0.5, decroche: 1 };
  const debutFenetre = plus(d.ouverture ?? plus(d.limite, -7 * JOUR), 2 * HEURE);
  const ayaRend = def.cle === "ent-d1" || def.cle === "ent-d2";
  let brouillonNote = def.cle === "ia-d2";
  let propositionIa = def.cle === "ia-d2";
  const photos = def.cle === "ges-d1" ? await ecrireImagesCopies(c) : new Map<string, number[]>();

  for (const e of inscrits) {
    const aya = e.matricule === MATRICULE_AYA;
    const rend = aya ? ayaRend : h.chance(chances[def.scenario][e.profil]);
    if (!rend) continue;
    const enRetard = !aya && def.scenario !== "a_venir" && h.chance(retardProba[e.profil]);
    let renduLe: Date;
    if (aya && def.cle === "ent-d2") renduLe = auPlusTard(jourA(t0, -1, 22, 41), t0);
    else if (enRetard) renduLe = auPlusTard(diurne(plus(d.limite, h.entre(2, 30) * HEURE)), t0);
    else renduLe = auPlusTard(entreDates(h, debutFenetre, new Date(Math.min(plus(d.limite, -2 * HEURE).getTime(), t0.getTime()))), t0);
    const prepareLe = h.chance(0.15) ? plus(renduLe, -h.entre(10, 90) * MINUTE) : null;
    const fichierIds = photos.get(e.matricule) ?? [];
    const texte = fichierIds.length ? "Photo de mon cahier : les cinq écritures au journal." : (def.copie?.(e, h) ?? "");

    type Ligne = typeof rendus.$inferInsert;
    const ligne: Ligne = { devoirId: d.id, etudiantId: e.id, texte, fichierIds, statut: "rendu", renduLe, prepareLe, enRetard, majLe: renduLe };
    const vu = auPlusTard(diurne(plus(renduLe, h.entre(2, 20) * HEURE)), t0);

    if (def.scenario === "corrige") {
      const [a, b] = NOTE_PAR_PROFIL[e.profil];
      const grille = def.grille ?? [{ critere: "Note globale", points: def.bareme }];
      const notation = def.notation?.(e, h);
      const detail =
        aya && def.cle === "ent-d1"
          ? grille.map((g, i) => ({ critere: g.critere, points: g.points, obtenu: [4.5, 4, 3, 4][i] }))
          : notation
            ? grille.map((g, i) => ({ critere: g.critere, points: g.points, obtenu: notation.obtenus[i] ?? 0 }))
            : repartir(auQuart(a + h.reel() * (b - a)), grille, h);
      const note = arrondi(detail.reduce((s, l) => s + l.obtenu, 0));
      const niveau = notation?.niveau ?? (note >= 14.5 ? "haut" : note >= 10.5 ? "moyen" : "bas");
      const corrigeLe = auPlusTard(plus(d.limite, (48 + h.entre(0, 20)) * HEURE), t0);
      Object.assign(ligne, {
        statut: "corrige",
        note,
        noteDetail: detail,
        commentaire:
          aya && def.cle === "ent-d1"
            ? "Très bon travail, Aya ! Ton projet de jus de bissap répond à un vrai besoin et ton enquête auprès de 40 voyageurs est sérieuse. Point à renforcer : les concurrents (les vendeurs de sodas ont aussi des atouts : le prix, l'habitude). Ton prix de 500 FCFA est bien justifié."
            : (def.commentaire?.(e, niveau) ?? null),
        vuLe: new Date(Math.min(vu.getTime(), corrigeLe.getTime() - HEURE)),
        correcteurId: formateur.id,
        corrigeLe,
        majLe: corrigeLe,
      } satisfies Partial<Ligne>);
    } else if (def.scenario === "retard") {
      if (!enRetard && h.chance(0.5)) ligne.vuLe = vu;
    } else if (!aya && h.chance(0.45)) {
      ligne.vuLe = vu;
    }

    // IA-101 : une copie déjà corrigée mais pas encore publiée, une autre avec la correction proposée par l'IA.
    if (!aya && def.cle === "ia-d2" && e.profil === "assidu") {
      if (brouillonNote) {
        brouillonNote = false;
        const grille = def.grille!;
        Object.assign(ligne, {
          note: 16.5,
          noteDetail: grille.map((g, i) => ({ critere: g.critere, points: g.points, obtenu: [8, 5.5, 3][i] })),
          commentaire: "Des consignes précises et bien construites. Ta vérification du prix est exactement ce qu'on attend : bravo.",
          vuLe: ligne.vuLe ?? vu,
          correcteurId: formateur.id,
          corrigeLe: auPlusTard(plus(t0, -5 * HEURE), t0),
        } satisfies Partial<Ligne>);
      } else if (propositionIa) {
        propositionIa = false;
        const grille = def.grille!;
        const justifications = [
          "Les trois consignes contiennent un rôle et une tâche ; le format manque dans la consigne 3.",
          "Une vérification est décrite pour la première réponse seulement.",
          "Présentation claire, quelques fautes de frappe.",
        ];
        const obtenus = [7.5, 4.75, 2];
        ligne.vuLe = ligne.vuLe ?? vu;
        ligne.propositionIa = {
          note: 14.25,
          detail: grille.map((g, i) => ({ critere: g.critere, points: g.points, obtenu: obtenus[i], justification: justifications[i] })),
          commentaire: "Bon travail : tes consignes sont concrètes et adaptées à l'entreprise. Pense à préciser le format attendu dans chaque consigne et à vérifier toutes les réponses, pas seulement la première.",
          alerte: null,
          creeLe: auPlusTard(plus(t0, -3 * HEURE), t0).toISOString(),
        };
      }
    }

    const [r] = await tx.insert(rendus).values(ligne).returning({ id: rendus.id });
    await tx.update(rendus).set({ recu: recuPour(r.id) }).where(eq(rendus.id, r.id));
    compter(c, "copies");
  }
}

// ── Photos de copies manuscrites ───────────────────────────────────────────

/**
 * Photos de cahier (journal comptable écrit à la main), rendues par deux
 * étudiants de GES-120. Écrites dans UPLOADS_DIR/demo/ ; la purge les efface.
 */
async function ecrireImagesCopies(c: Contexte): Promise<Map<string, number[]>> {
  const resultat = new Map<string, number[]>();
  const images = IMAGES_COPIES.filter((i) => i.base64);
  if (!images.length) return resultat;
  const dossier = path.join(config.dossierFichiers, "demo");
  fs.mkdirSync(dossier, { recursive: true });
  const auteurs = ["26CO0203", "25CO0217"];
  for (const [i, matricule] of auteurs.entries()) {
    const e = c.etudiants.find((x) => x.matricule === matricule);
    const image = images[i % images.length];
    if (!e) continue;
    const contenu = Buffer.from(image.base64, "base64");
    const cle = `demo/${crypto.randomBytes(12).toString("hex")}.jpg`;
    const chemin = path.join(config.dossierFichiers, cle);
    fs.writeFileSync(chemin, contenu);
    c.fichiersEcrits.push(chemin);
    const [f] = await c.tx
      .insert(fichiers)
      .values({ proprietaireId: e.id, nomOriginal: image.nom, mime: "image/jpeg", taille: contenu.length, cle, usage: "rendu", creeLe: plus(c.t0, -9 * JOUR) })
      .returning({ id: fichiers.id });
    resultat.set(matricule, [f.id]);
    compter(c, "fichiers");
  }
  return resultat;
}

// ── Messages ───────────────────────────────────────────────────────────────

async function semerMessages(c: Contexte) {
  const { t0, tx } = c;
  for (const [n, conv] of CONVERSATIONS.entries()) {
    const horodates = conv.messages.map((m) => ({ ...m, le: auPlusTard(m.quand(t0), t0) }));
    let cleUnique: string;
    let coursId: number | null = null;
    if (conv.type === "direct") {
      const [a, b] = conv.entre.map((q) => personne(c, q).id);
      cleUnique = `direct:${Math.min(a, b)}-${Math.max(a, b)}`;
    } else {
      coursId = c.cours.get(conv.cours)!.id;
      cleUnique = `cours:${coursId}`;
    }
    const [cv] = await tx
      .insert(conversations)
      .values({ type: conv.type, coursId, cleUnique, dernierMessageLe: horodates.at(-1)!.le, creeLe: plus(horodates[0].le, -MINUTE) })
      .returning({ id: conversations.id });
    c.conversations.set(conv.type === "direct" ? `direct-${n}` : `cours-${conv.cours}`, cv.id);
    await tx.insert(messages).values(horodates.map((m) => ({ conversationId: cv.id, auteurId: personne(c, m.qui).id, texte: m.texte, contexte: m.contexte ?? null, creeLe: m.le })));
    compter(c, "messages", horodates.length);
    const lecteurs = conv.type === "direct" ? conv.entre : (Object.keys(conv.lu) as Qui[]);
    await tx.insert(participants).values(
      lecteurs.map((q) => {
        const i = conv.lu[q] ?? -1;
        return { conversationId: cv.id, utilisateurId: personne(c, q).id, luJusquA: i >= 0 ? horodates[i].le : conv.type === "cours" ? plus(t0, -7 * JOUR) : null };
      }),
    );
  }
}

// ── Annonces, événements ───────────────────────────────────────────────────

async function semerAnnonces(c: Contexte) {
  const { t0, h, tx } = c;
  const seance3 = c.seances.get("ia-s3")!;
  const actifs = c.etudiants.filter((e) => !e.jamaisConnecte);
  const personnel = [...c.vieScolaire.values(), ...c.formateurs.values()];
  for (const def of ANNONCES) {
    const auteur = personne(c, def.auteur);
    const publieeLe = def.publieeLe(t0);
    const siteId = def.site ? c.sites.get(def.site)!.id : null;
    const co = def.cours ? c.cours.get(def.cours)! : null;
    const [a] = await tx
      .insert(annonces)
      .values({
        auteurId: auteur.id,
        titre: def.titre,
        corps: def.corps,
        cible: def.cible,
        siteId,
        coursId: co?.id ?? null,
        importante: Boolean(def.importante),
        epinglee: Boolean(def.epinglee),
        proposeSurSite: Boolean(def.publierSurSite),
        publierSurSite: Boolean(def.publierSurSite),
        publieeLe,
        expireLe: def.expireApresSeance3 ? plus(seance3.debut, (seance3.def.duree + 30) * MINUTE) : null,
      })
      .returning({ id: annonces.id });
    c.annonces.set(def.cle, a.id);
    compter(c, "annonces");

    // Qui l'a lue (Aya a lu l'accueil et l'annonce de son campus, pas encore les deux plus récentes).
    const concernes: { id: number; etudiant?: EtudiantSeme }[] =
      def.cible === "tous"
        ? [...actifs.map((e) => ({ id: e.id, etudiant: e })), ...personnel.map((p) => ({ id: p.id }))]
        : def.cible === "site"
          ? [...actifs.filter((e) => e.siteId === siteId).map((e) => ({ id: e.id, etudiant: e })), ...personnel.filter((p) => p.siteId === siteId).map((p) => ({ id: p.id }))]
          : [...co!.inscrits.filter((e) => !e.jamaisConnecte).map((e) => ({ id: e.id, etudiant: e }))];
    const lectures = concernes
      .filter((p) => p.id !== auteur.id)
      .filter((p) => {
        if (p.etudiant?.matricule === MATRICULE_AYA) return def.cle === "bienvenue" || def.cle === "yopougon-salle";
        if (p.id === c.formateurs.get("diallo")!.id) return def.cle === "bienvenue";
        if (p.etudiant?.profil === "decroche") return def.cle === "bienvenue" && h.chance(0.5);
        return h.chance(def.lecture);
      })
      .map((p) => ({
        annonceId: a.id,
        utilisateurId: p.id,
        luLe: auPlusTard(diurne(plus(publieeLe, h.entre(1, def.cle === "bienvenue" ? 72 : 20) * HEURE)), p.etudiant?.profil === "decroche" ? plus(t0, -12 * JOUR) : t0),
      }));
    if (lectures.length) await tx.insert(lecturesAnnonces).values(lectures);
  }
}

async function semerEvenements(c: Contexte) {
  const { t0, tx } = c;
  const lignes: (typeof evenements.$inferInsert)[] = [];
  for (const [slug, site] of c.sites) {
    const vs = c.vieScolaire.get(slug);
    for (const ev of evenementsDuSite(site, slug)) {
      const debut = ev.debut(t0);
      lignes.push({
        titre: ev.titre,
        description: ev.description,
        debut,
        fin: plus(debut, ev.heures * HEURE),
        lieu: ev.lieu,
        cible: "site",
        siteId: site.id,
        auteurId: vs?.id ?? null,
        creeLe: plus(t0, -h2j(slug) * JOUR),
      });
    }
  }
  await tx.insert(evenements).values(lignes);
  compter(c, "evenements", lignes.length);
}
const h2j = (slug: SlugSite) => ({ riviera: 6, yopougon: 5, yamoussoukro: 7, azaguie: 4, mbatto: 8 })[slug];

// ── Notifications ──────────────────────────────────────────────────────────

const formatDateFr = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
/** « jeudi 1 octobre à 23h59 » (même format que les rappels du module évaluations). */
const dateFr = (d: Date) => formatDateFr.format(d).replace(/(\d{2}):(\d{2})/, "$1h$2");

async function semerNotifications(c: Contexte) {
  const { t0, tx } = c;
  const aya = personne(c, AYA);
  const karim = c.formateurs.get("diallo")!;
  const s2 = c.seances.get("ia-s2")!;
  const iaD2 = c.devoirs.get("ia-d2")!;
  const entD1 = c.devoirs.get("ent-d1")!;
  const infD1 = c.devoirs.get("inf-d1")!;
  const infQ2 = c.devoirs.get("inf-q2")!;
  const annonceMardi = c.annonces.get("ia-mardi")!;
  const publicationMardi = ANNONCES.find((a) => a.cle === "ia-mardi")!.publieeLe(t0);
  const heure = (d: Date) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).format(d).replace(":", "h");
  type N = typeof notifications.$inferInsert;
  const lu = (d: Date, apres: number) => auPlusTard(plus(d, apres), t0);
  const liste: N[] = [
    // Aya
    { utilisateurId: aya.id, type: "live", titre: `Demain à ${heure(s2.debut)} : ${s2.def.titre}`, corps: "IA-101 · live multi-campus. Ajoute-le à ton agenda.", lien: `/live/${s2.id}`, creeLe: plus(s2.debut, -23 * HEURE), luLe: plus(s2.debut, -20 * HEURE) },
    { utilisateurId: aya.id, type: "cours", titre: `Fiche de révision : ${s2.def.titre}`, corps: "IA-101 · la fiche du live est prête. Relis-la en 5 minutes.", lien: `/replays/${s2.id}`, creeLe: plus(s2.termineeLe!, 5 * HEURE), luLe: plus(s2.termineeLe!, 7 * HEURE) },
    { utilisateurId: aya.id, type: "devoir", titre: `Nouveau devoir : ${iaD2.def.titre}`, corps: `IA-101 · à rendre avant le ${dateFr(iaD2.limite)} (heure d'Abidjan).`, lien: `/devoirs/${iaD2.id}`, creeLe: iaD2.ouverture!, luLe: lu(iaD2.ouverture!, 3 * HEURE) },
    { utilisateurId: aya.id, type: "note", titre: "Nouvelle note disponible", corps: `ENT-210 · « ${entD1.def.titre} »`, lien: `/devoirs/${entD1.id}`, creeLe: auPlusTard(plus(entD1.limite, 50 * HEURE), t0), luLe: auPlusTard(plus(entD1.limite, 53 * HEURE), t0) },
    { utilisateurId: aya.id, type: "devoir", titre: `Nouvelle interrogation : ${infQ2.def.titre}`, corps: `INF-230 · à faire avant le ${dateFr(infQ2.limite)} (heure d'Abidjan).`, lien: `/quiz/${infQ2.id}`, creeLe: infQ2.ouverture!, luLe: null },
    { utilisateurId: aya.id, type: "devoir", titre: `Rappel : « ${infD1.def.titre} » à rendre`, corps: `INF-230 · il te reste jusqu'au ${dateFr(infD1.limite)} (heure d'Abidjan).`, lien: `/devoirs/${infD1.id}`, creeLe: plus(infD1.limite, -20 * HEURE), luLe: null },
    { utilisateurId: aya.id, type: "annonce", titre: "Le cours d'intelligence artificielle commence mardi", corps: "Mardi à 10 h (heure d'Abidjan), Dr Karim Diallo retrouve les cinq campus en direct depuis Lyon…", lien: `/annonces/${annonceMardi}`, creeLe: plus(publicationMardi, MINUTE), luLe: null },
    // Karim Diallo
    { utilisateurId: karim.id, type: "cours", titre: `Un cours vous est confié : ${c.cours.get("IA-101")!.code}`, corps: "Initiation à l'intelligence artificielle", lien: `/enseigner/cours/${c.cours.get("IA-101")!.id}`, creeLe: plus(t0, -35 * JOUR), luLe: plus(t0, -34 * JOUR) },
    { utilisateurId: karim.id, type: "live", titre: `Demain à ${heure(s2.debut)} : ${s2.def.titre}`, corps: "IA-101 · live multi-campus. Ajoute-le à ton agenda.", lien: `/live/${s2.id}`, creeLe: plus(s2.debut, -23 * HEURE), luLe: plus(s2.debut, -22 * HEURE) },
    { utilisateurId: karim.id, type: "annonce", titre: "Le cours d'intelligence artificielle commence mardi", corps: "Mardi à 10 h (heure d'Abidjan), la grande séance commune aux cinq campus.", lien: `/annonces/${annonceMardi}`, creeLe: plus(publicationMardi, MINUTE), luLe: null },
  ];
  await tx.insert(notifications).values(liste);
  compter(c, "notifications", liste.length);
}

// ── Vie scolaire : suivis, relevé partagé, devoirs d'essai ─────────────────

async function semerVieScolaire(c: Contexte) {
  const { t0, h, tx } = c;
  const suivisDefs: { matricule: string; site: SlugSite; notes: [number, string][] }[] = [
    {
      matricule: "26GC0144",
      site: "yopougon",
      notes: [
        [4, "Appel à sa mère : Ibrahim a perdu son téléphone il y a deux semaines. En attendant, il peut suivre les lives depuis la salle Kédjénou. Je lui ai proposé de passer récupérer une nouvelle fiche de connexion."],
        [1, "Ibrahim est passé à la vie scolaire, nouvelle fiche remise. Il reprend les cours en salle dès mardi. À surveiller pour le devoir de création d'entreprise."],
      ],
    },
    {
      matricule: "26GC0403",
      site: "mbatto",
      notes: [
        [3, "Absent aux deux derniers lives et aux interrogations. Son père indique qu'il aide aux champs pendant la récolte. Rendez-vous fixé vendredi pour organiser le rattrapage (replays et fiches de révision)."],
      ],
    },
  ];
  for (const s of suivisDefs) {
    const e = personne(c, `e:${s.matricule}`);
    await tx.insert(suivis).values(s.notes.map(([jours, texte]) => ({ etudiantId: e.id, auteurId: c.vieScolaire.get(s.site)!.id, texte, creeLe: jourA(t0, -jours, 10, h.entre(0, 50)) })));
    compter(c, "suivis", s.notes.length);
  }

  // Relevé d'Aya partagé à ses parents (consulté deux fois).
  const aya = personne(c, AYA);
  await tx.update(utilisateurs).set({ jetonReleve: crypto.randomBytes(24).toString("base64url") }).where(eq(utilisateurs.id, aya.id));
  await tx.insert(journal).values([
    { utilisateurId: c.vieScolaire.get("yopougon")!.id, action: "releve_partage", details: { etudiantId: aya.id }, creeLe: jourA(t0, -5, 11, 20) },
    { utilisateurId: null, action: "releve_consulte", details: { etudiantId: aya.id }, creeLe: jourA(t0, -5, 19, 4) },
    { utilisateurId: null, action: "releve_consulte", details: { etudiantId: aya.id }, creeLe: jourA(t0, -2, 20, 31) },
  ]);

  // Devoir d'essai du parcours de bienvenue (reçu vert du premier jour).
  const recus = new Set<string>();
  const essais = c.etudiants
    .filter((e) => !e.jamaisConnecte && e.profil !== "decroche" && (e.matricule === MATRICULE_AYA || h.chance(0.85)))
    .map((e) => {
      let recu = recuEssai(h);
      while (recus.has(recu)) recu = recuEssai(h);
      recus.add(recu);
      return { utilisateurId: e.id, recu, fichierIds: [] as number[], creeLe: plus(t0, -(28 - h.entre(0, 3)) * JOUR) };
    });
  await tx.insert(essaisDepot).values(essais).onConflictDoNothing();
}

// ── Assistant IA : conversations et consommation ───────────────────────────

async function semerIa(c: Contexte) {
  const { t0, h, tx } = c;
  const aya = personne(c, AYA);
  for (const conv of CONVERSATIONS_IA) {
    const co = c.cours.get(conv.cours)!;
    const debut = auPlusTard(conv.quand(t0), t0, 3 * HEURE);
    const lecon = conv.lecon ? co.lecons.find((l) => l.chapitre === conv.lecon![0] && l.rang === conv.lecon![1]) : undefined;
    const fin = plus(debut, conv.messages.length * 2 * MINUTE);
    const [cv] = await tx
      .insert(conversationsIa)
      .values({ utilisateurId: aya.id, coursId: co.id, leconId: lecon?.id ?? null, devoirId: conv.devoir ? c.devoirs.get(conv.devoir)!.id : null, titre: conv.titre, creeLe: debut, majLe: fin })
      .returning({ id: conversationsIa.id });
    await tx.insert(messagesIa).values(conv.messages.map(([role, contenu], i) => ({ conversationId: cv.id, role, contenu, creeLe: plus(debut, i * 2 * MINUTE) })));
    compter(c, "conversationsIa");
  }

  // Quatre semaines de consommation (plus calmes avant le début des cours) : de quoi remplir la page « Budget IA ».
  const lignes: (typeof usageIa.$inferInsert)[] = [];
  const jour = (n: number) => jourA(t0, -n, 0).toISOString().slice(0, 10);
  const ajouter = (utilisateurId: number, n: number, requetes: number, entree: [number, number], sortie: [number, number]) => {
    if (requetes <= 0) return;
    let je = 0;
    let js = 0;
    for (let k = 0; k < requetes; k++) {
      je += h.entre(entree[0], entree[1]);
      js += h.entre(sortie[0], sortie[1]);
    }
    lignes.push({ utilisateurId, jour: jour(n), requetes, jetonsEntree: je, jetonsSortie: js });
  };
  const personnel: [CleFormateur, number, number][] = [
    ["diallo", 0.5, 6],
    ["bamba", 0.35, 3],
    ["kouassi", 0.2, 2],
    ["coulibaly", 0.2, 2],
    ["yao", 0.15, 2],
  ];
  const frequence: Record<Profil, [number, number]> = { assidu: [0.35, 5], regulier: [0.2, 3], fragile: [0.08, 2], decroche: [0, 0] };
  for (let n = 27; n >= 0; n--) {
    const calme = n > 15 ? 0.35 : 1;
    for (const [cle, p, max] of personnel) if (h.chance(p * (n > 15 ? 0.6 : 1))) ajouter(c.formateurs.get(cle)!.id, n, h.entre(1, max), [3000, 7000], [800, 1800]);
    for (const e of c.etudiants) {
      if (e.jamaisConnecte) continue;
      if (e.matricule === MATRICULE_AYA) {
        const requetes = n === 0 ? 3 : n === 1 ? 4 : n === 2 ? 6 : h.chance(0.45 * calme) ? h.entre(1, 4) : 0;
        ajouter(e.id, n, requetes, [1800, 4200], [300, 800]);
        continue;
      }
      const [p, max] = frequence[e.profil];
      if (h.chance((n === 0 ? p / 2 : p) * calme)) ajouter(e.id, n, h.entre(1, max), [1500, 3800], [250, 750]);
    }
  }
  await insererParPaquets(lignes, 400, (p) => tx.insert(usageIa).values(p));
  compter(c, "joursIa", lignes.length);
}

// ── Orchestration ──────────────────────────────────────────────────────────

async function semer(tx: Tx, t0: Date, hash: string, hashCode: string, fichiersEcrits: string[]): Promise<Bilan> {
  const c: Contexte = {
    tx,
    t0,
    h: generateur(20_262_027),
    sites: new Map(),
    classes: new Map(),
    classesCreees: [],
    personnes: new Map(),
    etudiants: [],
    formateurs: new Map(),
    vieScolaire: new Map(),
    salles: new Map(),
    cours: new Map(),
    seances: new Map(),
    devoirs: new Map(),
    annonces: new Map(),
    conversations: new Map(),
    fichiersEcrits,
    compte: {},
    avertissements: [],
  };
  await semerSites(c);
  await semerComptes(c, hash, hashCode);
  await semerCours(c);
  await semerProgressions(c);
  await semerSeances(c);
  await semerDevoirs(c);
  await semerMessages(c);
  await semerAnnonces(c);
  await semerEvenements(c);
  await semerNotifications(c);
  await semerVieScolaire(c);
  await semerIa(c);

  // Trace du semis : la purge sait quelles classes elle a créées.
  await tx.insert(journal).values({
    utilisateurId: null,
    action: ACTION_JOURNAL_DEMO,
    details: {
      le: t0.toISOString(),
      classes: c.classesCreees,
      cours: [...c.cours.values()].map((x) => x.id),
      comptes: c.personnes.size,
    },
  });

  const aya = c.etudiants.find((e) => e.matricule === MATRICULE_AYA)!;
  const nouveau = c.etudiants.find((e) => e.jamaisConnecte)!;
  return {
    compte: c.compte,
    formateurs: FORMATEURS.map((f) => ({
      email: `${f.email}@${DOMAINE_DEMO}`,
      nom: `${f.prenom} ${f.nom}`,
      cours: COURS.filter((x) => x.formateur === f.cle).map((x) => c.cours.get(x.code)!.code),
    })),
    vieScolaire: VIE_SCOLAIRE.map((v) => ({ email: `${v.email}@${DOMAINE_DEMO}`, nom: `${v.prenom} ${v.nom}`, site: c.sites.get(v.site)!.nomCourt })),
    salles: [...c.sites.entries()].map(([slug, s]) => ({ email: `salle.${slug}@${DOMAINE_DEMO}`, site: `${s.nomCourt} · ${s.salleConference}` })),
    etudiants: c.etudiants
      .filter((e) => !e.jamaisConnecte)
      .map((e) => ({ matricule: e.matricule, nom: `${e.prenom} ${e.nom}`, site: c.sites.get(e.site)!.nomCourt, classe: CLASSES.find((x) => x.cle === e.classe)!.libelle })),
    jamaisConnecte: { matricule: nouveau.matricule, nom: `${nouveau.prenom} ${nouveau.nom}` },
    aya: { matricule: aya.matricule },
    avertissements: c.avertissements,
  };
}

function afficherBilan(b: Bilan, o: { motDePasse: string; genere: boolean; code: string; ms: number }) {
  const n = b.compte;
  const lignes = [
    `✓ Données de démonstration semées en ${(o.ms / 1000).toFixed(1).replace(".", ",")} s :`,
    `  ${n.comptes ?? 0} comptes, ${n.classes ?? 0} classes créées, ${n.cours ?? 0} cours, ${n.lecons ?? 0} leçons, ${n.seances ?? 0} séances, ${(n.depots ?? 0) + (n.interrogations ?? 0)} devoirs et interrogations,`,
    `  ${n.copies ?? 0} copies, ${n.tentatives ?? 0} tentatives, ${n.presences ?? 0} présences, ${n.questions ?? 0} questions votées, ${n.messages ?? 0} messages, ${n.annonces ?? 0} annonces, ${n.evenements ?? 0} événements.`,
    "",
    o.genere
      ? `  Mot de passe commun des comptes de démonstration : ${o.motDePasse}`
      : "  Mot de passe commun des comptes de démonstration : celui de CAMPUS_DEMO_MOT_DE_PASSE.",
    o.genere ? "  (tiré au sort : définissez CAMPUS_DEMO_MOT_DE_PASSE pour le choisir)" : "",
    "",
    "  Formateurs :",
    ...b.formateurs.map((f) => `    ${f.email.padEnd(38)} ${f.nom} (${f.cours.join(", ")})`),
    "  Vie scolaire :",
    ...b.vieScolaire.map((v) => `    ${v.email.padEnd(38)} ${v.nom} (${v.site})`),
    "  Écrans de salle :",
    ...b.salles.map((s) => `    ${s.email.padEnd(38)} ${s.site}`),
    `  Étudiants (identifiant : matricule) — ${b.etudiants.length} comptes, dont :`,
    ...b.etudiants
      .filter((e, i) => e.matricule === b.aya.matricule || i % 6 === 0)
      .map((e) => `    ${e.matricule.padEnd(10)} ${e.nom.padEnd(24)} ${e.site} · ${e.classe}${e.matricule === b.aya.matricule ? "   ← étudiante mise en avant" : ""}`),
    `  Première connexion : ${b.jamaisConnecte.matricule} (${b.jamaisConnecte.nom}) · code provisoire ${o.code} (valable 30 jours)`,
    ...b.avertissements.map((a) => `  ⚠️  ${a}`),
    "  Pour tout effacer : npm run db:purge-demo (production : npm run db:purge-demo:prod).",
  ].filter((l, i, t) => !(l === "" && t[i - 1] === ""));
  console.log(lignes.join("\n"));
}

/** Démonstration déjà présente : rien n'est recréé ; le mot de passe commun suit CAMPUS_DEMO_MOT_DE_PASSE s'il a changé. */
async function dejaSemee(temoin: typeof utilisateurs.$inferSelect, motDePasseEnv: string | null) {
  if (temoin.preferences?.demo !== true) {
    console.warn(`⚠️  ${EMAIL_TEMOIN} existe mais n'est pas un compte de démonstration : semis de démonstration annulé.`);
    return;
  }
  if (motDePasseEnv && !(await verifier(motDePasseEnv, temoin.motDePasseHash))) {
    const hash = await hacher(motDePasseEnv);
    const maj = await db
      .update(utilisateurs)
      .set({ motDePasseHash: hash })
      .where(and(sql`${utilisateurs.preferences}->>'demo' = 'true'`, eq(utilisateurs.doitChangerMotDePasse, false)))
      .returning({ id: utilisateurs.id });
    console.log(`✓ Données de démonstration déjà présentes : mot de passe commun remplacé par CAMPUS_DEMO_MOT_DE_PASSE (${maj.length} comptes).`);
    return;
  }
  console.log("✓ Données de démonstration déjà présentes : rien à faire (pour les rajeunir : npm run db:purge-demo puis npm run db:seed).");
}

export async function semerDemo(): Promise<void> {
  const debut = Date.now();
  const motDePasseEnv = process.env.CAMPUS_DEMO_MOT_DE_PASSE?.trim() || null;

  const [temoin] = await db.select().from(utilisateurs).where(eq(utilisateurs.email, EMAIL_TEMOIN));
  if (temoin) return dejaSemee(temoin, motDePasseEnv);

  if (motDePasseEnv && motDePasseEnv.length < 10) {
    console.warn("⚠️  CAMPUS_DEMO_MOT_DE_PASSE fait moins de 10 caractères : accepté pour la démonstration, mais trop court pour un compte du personnel.");
  }
  const motDePasse = motDePasseEnv ?? motDePasseProvisoire();
  const code = codeProvisoire();
  // Hachés une seule fois, hors transaction (bcrypt est lent) : un même hash pour tous les comptes.
  const [hash, hashCode] = await Promise.all([hacher(motDePasse), hacher(code)]);

  const fichiersEcrits: string[] = [];
  let bilan: Bilan | null;
  try {
    bilan = await db.transaction(async (tx) => {
      // Deux démarrages simultanés (plusieurs répliques) : un seul sème.
      await tx.execute(sql`select pg_advisory_xact_lock(${VERROU_SEMIS})`);
      const [deja] = await tx.select({ id: utilisateurs.id }).from(utilisateurs).where(eq(utilisateurs.email, EMAIL_TEMOIN));
      if (deja) return null;
      return semer(tx, new Date(), hash, hashCode, fichiersEcrits);
    });
  } catch (e) {
    // La transaction est annulée : on retire aussi les photos déjà écrites sur le disque.
    for (const f of fichiersEcrits) fs.rmSync(f, { force: true });
    throw e;
  }
  if (!bilan) {
    console.log("✓ Données de démonstration semées entre-temps par un autre processus : rien à faire.");
    return;
  }
  afficherBilan(bilan, { motDePasse, genere: !motDePasseEnv, code, ms: Date.now() - debut });
  prevenirSite("données de démonstration");
}

// ═══════════════════════════════════════════════════════════════════════════
// Photos de cahier (JPEG 600 × 800, ≈ 45 Ko chacune) : journal comptable écrit à
// la main, « photographié » par deux étudiants de GES-120 pour leur copie.
// ═══════════════════════════════════════════════════════════════════════════
const IMAGES_COPIES: { nom: string; base64: string }[] = [
  {
    nom: "IMG-journal-chez-konan.jpg",
    base64: [
      "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",
    ].join(""),
  },
  {
    nom: "photo-cahier-comptabilite.jpg",
    base64: [
      "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",
      "0TJWaXb0yQEIQglZpfv+iZKzS7emSAhCEErNL9/0TJWaXb0yZAQhCCRml+/6JkrNLt6ZICEIQSM0v3/RMlZpdvTJAQhCCRml+/6JkrNLt6ZICEIQSM0v3/RM",
      "lZpdvTJAQhCCRul+/wCiZKzS7emTICEIQSM0v3/RMlZpdvTJAQhCCRul+/6JkrNLt6ZIeftF3/Xyj4jwCFVaLv8A1KbePBCw07SEIQkFVP0K0qp+hKb6R4bT",
      "tGFx3BXZUdF/CUlH92ZuVy2yTKt2P4D5Iyrdj+A+SdCsSpsrc+tp6JTZZm08JUs595TKxEyzNvyKMtH0k6FYmKmkZ61UvxDCSADuGdastH0296oof9R/ectS",
      "sa6+SZaLrGcSMtF1jOILnV3pFZNnyGOprYxIMxY295G8C+5b6aeOqpo54TijkaHNJF14O9TIZLH7Xtt07U+UZ0296GAZ8w0lThbsHcnEjKM6be9Tjb0h3owN",
      "6I7lGTZ0G9yMSGOHtZxp2prxtCRkbDf7DdJ5lOSj6tnCE4joWJtTRvtOSgDG5dkYkILBcWk3LTkYurZwqxGZ+LemVTIY8/sN07FORj6AViWIVeRj6PzVUElJ",
      "Ul4p5o5cBudk5MWE7DccyMS9n4t6ZZKSSmq2yOgkxhkjo3XOOZw0hX5Fn6uIpxLEKvIt2v4z5oyLek/jPmjEZn4t6ZUsiGf2n6ekU2SHTfxFWJYhV5L9b+JG",
      "S/3H96kZn4t6ZUsjOf3j9PwTZN3Wv+XkpLEKvJu65/cPJGTf1z+4eSqRmfi3plSxj8/vXaTzDyTYH9aeEKpLEKvBJ1v+IRgk60cKqRmfi3plSxsnte8Gk/h/",
      "dNhl6xvB+6qSxCrul6xnAfNRdN02cB81UjM/FvTKlglz+0zT0T5pvfbWdxVSWIVfvv8Ab+aPfbGd5VSSz8W9MqWGXPmZp2lNfN0WcR8lUliFXfN0GcZ8kYpe",
      "rZx/sqkln4t6ZUsdLn923T0v2TYpOrHEqksQq8cnVf5IxydUeIKpJZ+LemVLHv8Aa90dO0Jso/qnd481UliFXlHdS/vb5oyjuqf8vNVJLPxb0ypZIc/u36fh",
      "5psqerf3KpLEKvK/7b+5GV/Q/hVUpLPxb0ypZKM/sv09Epss3ov4CqYlLFCTLN2P4D5KMsz9fAfJVSjM/FvTKlkzPa1tPRKbLM2nhKalPNWif/U5/wCr6IS1",
      "xvtKcjQXIXNp6BCEISCqnq0qp6U6VJ92ZuVyqpPu0e5WrQCEIUis0HeUyVmg7z4pkgIQhCZaH/Uf3nLUstD/AKj+85FomsbS4qARuma4HBJmDxzi/mPxU31e",
      "5xvSqJnqkFn0sbI5bQnDHFjQCW6XEqyotCrdXGzLFih/6WMZaWa8sZmzNAHOkoWVdqekba6ropaSCkiLImS3Xl7tJzfBZGwWtRz2pSUlE50tZOZGVbnAMYwj",
      "See8bE9q887sr3ekkp9H6WqggYa2qlyLIjeW4r7j2LoVdrPht6hs2JjHvma5836GgZiO1ceosuosqex30tJJWw0bXtLGEA5Q/iN/N4K+wLLro7ctC0rSaDO9",
      "rWsu0ZxeQPgMw71rLB4bdr621KqzqOniMsExDppL8DI+a8DOXHPmUn0inE1ZAyBk07an1elY03YzdeSfgOcq/wBGaGejs6onqYsNZVSvme06dOYf/dq5/o3Z",
      "NVQ0lXadZC59oS43Rxc7b8928n6LP+H+Pl0rGtkz2VU1NoNjp30sr45i0+zeOcKqz/SR9XXU7JLPlgpavEKaZ7gTJcL87ebMuPW0EtF6PWbDWRyPp3VGVr8m",
      "3Ebyb7jdzX5uxaaWSstH0ppKx9JLTUMMDzAx4uJ0C8jmvvzDYFrv58Ds22V/1HphbFRpbCyOAH43XlehXC9EYJGWZLUzsLJqud8zg4XEXnN8gu6j4hd5U0tR",
      "DUMe6CVkga8tcWm+4jSFcstFQ09GZ3U8QjM0he8A5i7bdzLUhPLWtLUW/bD7GpJXQ0cABrJWaXX6GBdihsqz7Ghe+kp2QgM9pw0uAz5zzrgUVY/0arLRjraC",
      "smNTUGWOanjxh4OgX36RsWi2rVrh6L19TU0fqjZGCOFjnXye1mvcObToV+nD31isK3KKxbAFTXPdla2eSYRsGJxBN192zMvSV9tUVDZ0dbI8vjluyTYxe6Qn",
      "QGjavK/Z77N9E5JZY77QrmtpomdW05gwdl5PxVldTtpbfo4ai0G2fFR0bRTSyNaWudodrZr/AJrUxF0I+XoaG3oa2lqZGU1UyemF8lK+O6XaLm3571mpvSmG",
      "Wthpqmz7QonTOwRvqIMLSdl96wsraOx7Oq7cbVy2tUSERGW4NaSNAFwuA+KSxp6CstaKstK1IKu0nZoYI3ExwX8zdp+KIjVPD1zNB3lcP02qfV/RmoaCA+ct",
      "ibnu0nyvXcZoO8+K8t6X0UltWlZ1ktc5jHB88jwNFwuHzPzWZ5MfKuGKq9KHRNMj4rFp7hiBudVubz/03/8A3Z37StigsgRtq58Dn5mMa0ucbvgLzd8VyvRu",
      "2oYo4rGrwKS0KdojybswkA0Fp571hpa+mpq23rXtBzcvFKaaJjtOEDM1o+JWuoRD0v2rRR0DK11Q31aVwDJACQSTcFMlr0EVpR0ElVG2rkF7Yr858l4auy1n",
      "ejFh2e6Evqp6jK5Hcbw3vI+a6U9liG07GoXES10lQa2qnuznCPC/MNya37XZ6e1LWobIhbLXVDYmuNzRcSXH4AZyh1r0LLPirjUN9WlLQyQAkEk3BeRhtOmE",
      "tf6QV0jZKkPfBQ0197mgZszdp51iqp3weidg0rIcpUVVRlxGPxe0SO8kLMR/Rn/XuTa9BFaLaCSqjbVyElsXOfJb14mSzBFaVjULrpa6SpdWVU92c4fpfmG5",
      "e2VMAIQhBKzQd5TJY9B3nxTJkBQpUIJWaDvKZKzQd58UyZAUKVCCVmg7ymSs0HefFMmQFClQglZoO8pkrNB3nxTJAUIQglZoO8pkrNB3nxTJkBQuFV11TXWh",
      "LTUdW2ipaZwbNUkNLnPOfA3Fm3lHpFaDqFtn0/rxpjPJdJOGNJwhpvNxBGc3cyi7bNB3lMuFUz1VJYElTQ1M1Y4kESSsDixt+dwa0NvuGe5brKuZQNmdaD61",
      "kntiZ+EC47LgLgqQ3qFybdr5IqCE0MzTLLUxxNc252lwv+V6qt+rtOhjkqqeSlZTQtBwSNLnyuJuw6RdzXaVF2WaDvKZcC1bUq43Sw0GSY+CF1RO+VuINGe5",
      "t14zm49i7NJMaijhmLcJkY192y8XqoLUIQglZz7ymSs0HeUyZDyld/Mqj+soUVn8xqP7h8ULDT0KEIQkFVPVpVUiU6FLIBTMGF2jmarcqOi/hKWl+7R7lat4",
      "yTKt2P4D5Iyrdj+A+SdCsSpkrQPxaT+E7U2WZtPCVLNXtPimViJlmbfkUZaPpJ0KxMdFKwZe9wF8ziEtpU0Fo04hfVSwgODsUEmB2g5r9mdWUP8AqP7zlqU1",
      "1+553+Habmtq1G7qz9lP8Px81v2uP/3g8l6FCbZedbYBuzekFqDOdNSD9FP2DL+H0htHtlB+i77AMOgaT4qcLdg7lWnn/sOq/D6RV3a5pU/YlfzekVX2taV3",
      "sDeiO5GTZ0G9yrTgNsa07vZ9IpxnOmFh51P2PbP4fSSTtpWFdxkbC3UbpPN8VOSj6tnCFJw/sm3vw+kh7aKM/VH2X6QjR6QsO+iZ5ruZGLq2cIUZCLq2cKk4",
      "TbP9Irs1uQnOdNI3bvTeo+kg0WxSnfTLtMhjw6jdJ5vipyMfQCk4fqnpMNFp0J3wFQ+k9Jntwvq7Me3Y6F1y7uRj6KMjHsPeVYnA9X9J3AEzWS/C4kYo35jt",
      "UTU/pPMzBMLDmZpwyMkIXeZCzDoOk/iO1NkWfq4z5qxOCWelWTyZisJ0d12ECW67Zckhh9JKcXQUVhxc17MbR8l6HIt2v4z5oyLek/jPmq4Tgsd6WAH3djHO",
      "dDpNqnKelQN5pbJJGa8Peu2yIYdZ+k/iO1Nkh038RViefkd6SSOa6SzLKkcw3tJkN4PwvWV9Ha7rQ9ef6P2W+q6zK59+/wCK9Vkv1v4kZL/cf3qTzTnW7JUx",
      "VMlg0Uk0OIRv9ZF7b9NycVFvNqzU/wAO05nLMGUFY2/DffcvQMjOHlH6Ts2psm7rX/LyUnk2R2jHWyVjfQ+m9YkvxSCsjvN+nmVrZrUZJTSfwg0Ppm4IXCtj",
      "JYNFwzL0+Td1z+4eSMm/rn9w8lJ5plo2q2qNV/Cz8uW4DIKphOG++7vXqVSxj8PKu0nmG1Ngk608IVKWIVeCTrf8QjBJ1o4UUjR6p3nxTKljZMOaQaT+H470",
      "2GXrG8H7qpHQq7pusZwHzRdN02cJ81UjR6p3nxTKlglw5nM0n8J2703vtrO4qpHQq/ffo+aPfbGd5VSMzVO8+KZUsMuHMGaTznamvm6LOI+SphHQq75ugzjP",
      "kjFL1bOP9lUjR6p3nxTKljpMPJt0n8Xx3JsUnVjiVMI6FXjk6r/JGOTqjxBVI0eqd58UypY9+HkjpPONqbKP6p3ePNUwnlrT9H7QkoqukhlgdSzTGVoyd8pL",
      "jnvJzAC85xnuXTqLNrY7Sp6qhfTuEVPkAyfF7OcZxdp0BdXKO6l/e3zRlHdU/wCXmnUwvjtUNY6Cele64h7JI3NbffpBBJG43pKCxYYrOFNWshq75XTODoxg",
      "Dib/AGWm+4Z1vZIcPJv0nZt3psqerf3KpMVRZjZKugdGI4qele6TJtbde664d15XLkprXqbZdLVUcM0EL76ZrqjDG39RABLnb8wXoMr/ALb+5GV/Q/hVqeeq",
      "rJrqitromBgpa97DLNj9pjG5iwDnv2/Er0bWhjQ1ouAFwCrZKMOq/Sfwnamyzei/gKqlHQq8s3Y/gPkjLM2P4D5IqUZmqd58UypZMwN/FpP4TtTZZm09xVUp",
      "5eqz19R/cd4oUTm+unO2R3ihYaeiQhCEgqqRWlUyKTq033dm5WJIOQZuTrbIQhCiVmr2nxTJWaiZICEIQmWg0VH9530WpZaDRP8A3nfRalN9fuCEISwVmr2n",
      "xTJY9RMpBCEKJWavafFMlj1O9MoBCEKJY9XtPimSx6nemUAhCFEser2nxTJY9TvTKkBCEIJY9XtPimSx6nemTICEIQSx6vafFMlj1O9MmQEIQglj1O0+KZLH",
      "qdpTJkBCEIJI9XtPimSx6naUyZAQhCCWPU7T4qUsep2nxTJkBCEIJI9XtPimSx6naUyZAQhCCSPV7T4pksep2lMmQEIQglj1e0+KlLHqdp8UyZAQhCCSPV7T",
      "4pksep2lMkBCEIJI9XtPimSx6naUyZAQhCCSPV7T4pksep2nxTJkPJz56yb+47xQok+9S/1nxQsNPRoQhCQVTIriqZFJ04pAImjC/R0U+VHRfwlTFyTdyZdM",
      "ZJlW7H8B8kZVux/AfJOhWJUyVuEa3CU2WZtPCVMeoEysRMszb8ijLR9JOhWJioJGCOVxcAHyOcPiFqy0fWN71RZv3CPt8StSsa6/dJMtF1jOIIy0XWM4gnQr",
      "GXFta0JA6ns+hkayqqr/AHpziJg0u37E8EFB6P0M9RlpXi7FK+SUvc87ibrz8FktYZK0YaulqBFVxxmMtlp3yRuaTfpaNKz1bm1dlSwz2jlKlz2vaTSuZG0t",
      "IIF11928lPZNp9IXRRVJqaTIyRU/rDWZUOxN0XHNmN/NnSP9KoGVAa6mlyDgQyUEHHILr2AaTpuv2rm1FPBWUlV6zaUbauqcwSPZE4NZG034W3j5rVgsgWjR",
      "zetQCno4S2GIg65/Ec2xWJph9J6eOijlrYJKd7p3QGMEPIcM/Np7OdRUek8IsirqWU1VHNASwxvi9priLwSBoGjSuM9jqSqojHFT1Xq8TqmWWSQMja+V1zXE",
      "kZxsCtrBRMswtjr6Gqqpals1TimbGJADqtv0DMAqold3cjtowWVTzV1NUMqZLmNhDQXyvuz4QCc2nTcrTbtG2g9akyrCJMlkSy+TKdHCNJXnbUnoquqpKqWS",
      "z58DHNdBBaLYywki5wdeL8wuKsqZLOZZ0dNBBZz2OveclaLQ+OTmdjdnO/xVKh6iz6n1ukbLkZobyQWTMwuHYtK5lh4ZrLhy01PU1DW3SvhcHC/sW/Ix9AKm",
      "rUcLEKvIx9H5oyMew95RiNHqBMqWQswDMeIpsiz9XGfNU0liFXkW7X8Z80ZFvSfxnzViNHqBMqWRDAPafxFNkh038RVNJYhV5L9b+JGS/wBx/epGj1AmVMcZ",
      "wD3j/kmybutf8vJUpYhV5N3XP7m+SMm/rn9w8lUjR6gTKmNj8A967uCbBJ1p4QqYSxCrwSdb/iEYZOtHCqkmPUCZUxtkwC6QcP7psMvWN4P3VMJYhV4Zumzg",
      "Pmi6bps4T5qpJj1AmVLBLgFzmcJ803vtsfcVUliFX779HzR77YzvKqSY9QJlSwy4BcGd5UvfIxjnubGGtF5OI+SpTmU/pJZ8tpyWfI6SnqWPwBkzbg8/A5xs",
      "+K60kjYo3SSODWNBLieYBeKbLBJ6OzCogbU1dqSPmigY6+Qkn2SBdmAAGdWVMlsVM8NmmOplbSU7DUmlqGxukkIzXucQbsx0JrF3dmG3WvZQkUszG1c5iZlB",
      "hN1xOO7ZmXSraqOipX1EoeWM1sDcR07F4+Rtp1dqWVQSTNjqaWnfLNMHAlod7IN+jFdz/G9NQVVY6WmpKeqqJIJa1z4pZJcT3RMHtZ+cFyaVvXx1MMs8kMcj",
      "XSxAF7RpbfoVy8r6L0RdNU2m+apnfNM4Rl892JjfZBIFwPPzL02OTqjxBFJMeoEypY9+Ae6PeE2Uf1Lu8eaJhLEKvKO6l/e3zRlHdU/5eaqSY9QJlSyQ4B7t",
      "/wAvNNlT1b+5UwkzSxwQulme2ONgvc5xuACooLQpLSgM1FOyaMOwlzeYrjVn/rHpEaKdjjRUTGyyRXcq86t45wAL7lrtu1fsmzRNTwYyJGRiPDpvIFw+NyqT",
      "qx6gSQVMNS1zoJWSta4scWG+4jSF5W0PSKogaygqJKKmqZGF8rpC4MjYdDRcb3O+IuV1Has3qNFR2RQwwTuhysgka4RxNvuvuGc3kZvmmk9E2sp3STRiZuKE",
      "gSAm7CSLwr14qhqzUUOUqKVkslr1tzo3BxbgaLrwRswrb6PzWhUWnXVc8kLacy5LJsY9+oLvZJuuz6bxzK9Mq3pY9QJlSyZgYNbhKbLM2nuKJiU8s/PUSf1n",
      "xQg8s/8AqPihYaejQhCEgqmRXFUyaFJ14+TbuTJY+TbuTLoyEIQhFj1BuTJY+TbuTJQQhCEy2b9wj7fErUstm/cI+3xK1Kb6/dIQhCWSx8m3cmSx8m3cmUAh",
      "CFFnp6aKOWSoY26WYND3X6btC0JY+TbuTKAIv0pTGw6WNPYmQokhY1kYwtDb9guTpY+TbuTKkBCEIJY+TbuTJY+TbuTJkBCEIJY+TbuTJY+TbuTJkBCEIJY+",
      "TbuTJY+TbuTJkBCEIJY+TbuTJY+TbuTJkBQpUIJY+TbuTJY+TbuTJkBQpUIJY+TbuTJY+TbuTJkBCFCCWPk27ktQySSneyJ0bXuFwMjC9vaARf3po+TbuTJk",
      "ODZ9iVNmBwonWZCXaxbRvvPblL0tbYdRXTtmqvs6WVow4shILxsN0mcfArvoVaecnsCSsDX1EFlyODQAcg8G4aBmdo+C2Moq+OSN7G2cHRsybLo3jC3YM/wC",
      "6sfJt3JlTKcWzLJks+qMkdNZ8QefbdE1wddsF+jPzLsqVCiWPk2pksfJt3JlSAoUqEEsfJtTJY+TbuTJkPP2rZz6yuMwoKhsgGDLU9WIjI3Yfgq3ULxHRxRW",
      "RLHDTTZYMbNGcbrjcSSbznN69GhVp5mWG0zXPq6Onq6Z0zGtlAyD8V2gi92Y51XW0FXVVMsoprVibPE2OZsb6e99192fHeNOcC69eoj5Nu5MqS83S0zqV9CR",
      "ZdoYaOExRtvh0m692aTTm+aewYKigeIHMtAwEuwCVkQay83kktJJPxXoEKsFj5MJksfJt3JlJ5Ecq7eUIZrnehYaekQhCEgqmRXFUv0qTqMkAY32X6OiU2VH",
      "RfwlMzk27gpXTGSZVux/AfJGVbsfwHyToViVMlaI262jolNlmbTwlSzk27gmViJlmbfkUZaPpJ0KxMdnSsbQxhzgDn8SsXpRWRwejdc4PF5iLBcec5vqt9m/",
      "cI+3xKyekNmS2tRw00b2sjy7Xy4vxMGkD4qycb6s65k1g4aawqKKSVuNsLb73c9y6GWi6xnEE4FwAGgIKZmJm3OIqKcP0ifK+yGNge4x42+sCF3vMn+LD8Vd",
      "Z1HZYs9xs1+TjqGXZWOQl+fYTeQU1ZT2o5wdZ9TTsY9gaWzxl2A9JpB+RWWew6mGwGUFnVYjlx4pJZBcZLyS7ONF9/MrNPwyWLT0tL6SVDLMc/1WKHDUPdIX",
      "CSW/NnJ0gX33bVt9F5DLTVtQ597Z6uRzATobfcLu5W2fZdTR0ToMrSNbky1kcMBa1rtpJcSVqsugZQWZT0tzXGJgBddpPOe9OJk9I6k03o3USxzuhkawYXsd",
      "cQbxcuf6P1r57Rw0dfUVtnsiOWkqSDc/mwm4E89/Mtdu0lXO2j9Vo46mKORsj2ZQMLiNAzi66+49ixTWDX1raqqljo6SofCYoYYNFxuvxuuznNdozI+V8Q6l",
      "L6Q0dXV5GJs+EhxjmdHdHLh04Tz3JGek1A99I1om/wCpDbiGXiPFqhx5r+Zcx1j2nPI6b1empwyjfDT07X3hjjcASbs509y0Uvo56tDZtOAx7IX5apkOl7wL",
      "mgfC/wAFVC10JLZghqhSMiqKiVjQZchHiEQOjF5C8rQ606dtdLSkuxww5aR13ssHNedq8lLR10c1NZcsUMMdVUummqWy3vlaDi0XeyNAWu0LCtKc2lBC2Fkd",
      "XKH5fH7RZcBguuzXZ86qTsSekFMKakkhhqKiSqbjihiZe8t5yRfcB2roUdVFW0kdRASY3i8Xi4j4EbV5ytsFzLUykdAauAwMijwVboDFdfeDcc4Obau/SUUF",
      "LSRwxwtiaxt2BjiQO3nVi1oj5Nu4JlUyFmTbmOgfiKnIs/VxnzRiWIVeRbtfxnzRkW9J/GfNWI0fJt3BMqWRDJt9p+gfiKbJDpv4irEsQq8l+t/EjJf7j+9S",
      "NHyTdwTKmOM5NvvHjMNnkmybutf8vJUpYhV5N3XP7m+SMm/rn9w8lUjR8k3cEypYx+Tb712gcwTYJOtPCFUjoVeCTrf8QjDJ1g4VUjR8m3cEypjbJk23SDQP",
      "w/umwy9Y3g/dVI6FXdL02cB80XTdNnCfNVI0fJN3Bcu17Wq6GTDS2XNWBrMpJIHiNjW/AnSfgugwS5NtzmaBzHzXlrZt2OvnmsqKtpqWFpwVNRI8NN3OxgJv",
      "J5r7rgqY3DD1FFVR1tFDVRX5OZge2/TcQs9q2rBZcTHStllkkOGOGFuJ7zz3D4KyjZk6OFlNk8g1gEd1+rdmXnaysMNt2tXT4XGhp2RQs+L8+b4k3BUxuCOH",
      "ZNtUcViw2gXOdDI0ZNrW3veToaBtU09t0c1kvtBznwwxlwkErbnMINxBG1ecoonUVXZcFaWNjs+gdVODjmxk3E9mdV00U0jbJiqWNjZXVcta9jjdmHtNB+RW",
      "pjfPPlXnnnw9TZNrQWrHKYo5oXxODXxzswubeLxm+IWmsqoaKlkqKh4ZFGL3OK43o4Zama0bSbG3J1c/u73EXsaMIOjnzpbfL57UsijlawQvldM8YszsDbwD",
      "m25+xEwm6yrZpq+klkDZaf1fNK2duBzc195+F2dRZVu0tqzSxQMmY5jQ8ZVmHGw5g5u0Zl5eV0tXRVE2HBBatfHA033Yo25r+24q60qmUm2q+mYGRQwMoY3t",
      "Oa+/2iN19yqT0FH6QUdbaJo4RLfc7BK5l0cuHWwnnuXVXmKOEH0hpKemiGQsqmLHEHNieBcN9wv7V6PHJ1R4gqYVmj5Nu4JlSx78m33R0DnCbKP6p3ePNEwj",
      "oVeUd1L+9vmjKO6p/wAvNVI0fJt3BMqWSERt92/QNnmmyp6t/cqkdCryv+2/uRlR0H8KqRo+TbuTKlkoEbfZfoH4Smyzei/gKqlHQq8s3Y/gPkjLM/XwHyVU",
      "o0fJt3KVUyZgjbraB+Eqcszae4pmJTyselCIkLm09KhCEJBVLtI3q4qk6w3qTsM1G7lKhuoNyldGQg6ChQdBUgzUbuUqG6g3KVIIOgoUHQVJms37hH2+JWpZ",
      "bN+4R9viVqU31+6Qg6ChQdBUyGajdylQzUbuUqAQdCFB0FRQzUbuTKGajdylQCDoQoOgqLDNZNFV1dPWVEDZZoW3Rl2cN577tF63qGajdylQCDoKFB0FBQzk",
      "27gmUM1G7lKQEHQUKDqlBQzk27gmUM1G7lKQEHQUKDqlBRHybdwTKGajdylICDoKFDtUoKGcm3cFKhmo3cpSAg6ChQdBQUR8m3cFKhmo3cpSAg6EKDoKChnJ",
      "t3BVtpoGTOmZDG2V2s8MAcd5VjNRu5SkBY5rMop61lZLSxPqYxc2QjOFsUHQUJjqbMoq/ISVdNHM+LOwvF9yeus6ktGJsVZTsmY04gHDQVoZqN3KUpDGNjY1",
      "jGhrGi4NAuACzV9n0lowiOsgZOxpxAOGgrUoOgqTNLQ0tVQNpZ4GPp8IGTIzC7RdsUtoaVtD6m2njFNhw5LD7N2y5Xs1G7lKpTPRUVNQU4gpIWQxA34Wjn2/",
      "FaDoQoOgqSGcm3cFKhmo3cpUgg6EKDoKChnJt3BSoZqN3KUgKDoUqDoKCiPk27gpUM1G7lKQEHQhQdBQUM5Nu4Idqnchmo3cok5N24pDycSFMSFhp6RCEISC",
      "qjrt3qwqv8xu8JTqNlGEey/R0Spyo6L+AphoClbxkmVbsfwHyUOlbhOZ+joHyVih2qdysRGyswjW0dEqcszaeEpm6oUqxEyzNvyKV88YY4l2YBWqqq+6Tf0H",
      "wVhiLlRQPbHRRtc4A3E6fitGWi6xveopfukP9DfBWqw9WzKvLRdYziCDNFhPvGaOkFYofqHcnGSNljwj3jdG1NlGdNvepAGEZhoRhb0R3KxIyjOm3vXJ9KKu",
      "SnsSU00pZO97I2Oac4JcAutgb0R3LmWtQPrKmgwsZkIZjLKc3MDh+astMlpTzVtc2zIKqSnihhy1TNE7C79LQea+4krJHaNZNYtgXTuFRUzsD3A53MF5N+8B",
      "XVtj10lfWtp2winr2sa+cuudCALnANuzkjQtv2QBa9C5kTBR0cDmsGa8uNwGbcFRXnn0pdhefnmq7crZ6eiqX0lDTOLJZ47scr+drSdAHOV3DBF1bOELztHQ",
      "WrZsL6KnpaKSLG57auR50E352AXk9tyoq12dSrtKGyaenilM9VO8YWRxsxyyXDObhcN5zBZ5fSehjbSkNnkdVRl8TGR3udcbsN23yKx1ll2l9ozS00dO8zQN",
      "iZUOddkLr8Vzeck59K51nUNcy0slS0sUj6SmZTGolk9mJ5GJxu0uOcKyU7c1swVtkRSRyVFI+omyDThGON4Oe8dmf4Is30ip7RtKqpYSZI47hHNGxxa43Xuv",
      "N1wu3pILA9Xq7Pa05SCmEkr3uPtSSu5yO0lYKWKvFh2jGygqIq6R0kjpHkAFxOhufP7Og6MysTvUts2dU1bqOCqY+ojBxNF/NpuOg3fBU+jM8tVZGXme5+Um",
      "kcwuN9zcZuHcuCyirnOY+ks6WmpaaikZTxvID3SG4XkX5r/Nensyz2UVm01MMXuo2tNziM92dVQBaFq0NmYPXKhsRfqtuJcewZ0tba9DRNYKioa0yNxNDQXH",
      "D0swNw+JzLjWm2dtssnoaGtFaxwiLjnhlivvN7r/AGdu34FZ6+krjaNqwRUc75K0NjjqSfdxxYfavN+kG/MiIL0Vba9BZsML6upZGJdTMXF24DOolrMVo00c",
      "FVCGZMyyscDe5mgOB0DOuHTQS2dbc5loK2qcWMjpZYri1kYbnBcSMOe+9Ja1m1k81o1OQnfG98UBYw+26AZ34c+e8m5OJ2Rb1n1VJWvo6psrqaNznYbxdcDn",
      "F+kZtIVlhOmd6P0Tqh7nzOga5znG8kkc683NZ1pVvrx9TfTRTRRU0EV4vZEXe1fdm0cw+C9cIBHCGNe8Na24C/mVUJc3UG5SqmxHCPev0fDyU5N3Wv8Al5IS",
      "xQ7VO5Jk3dc/ub5KHRvwn3z9GweSqR26g3KVW1j8I967RsCMD+tPCFUlih2qdyTBJ1v+IUObJhPvBo6KqR26g3KVW1suEe8Gjo/ujDL1jeD91Ulih2qdyS6X",
      "ps4D5qHCXCfbZo6J81Ujt1BuUqtolwj2maOifNHvtrO4qpLFDtU7knvv0fNQ7K4TmZo2lVI7dQblKraZcI9lmjafJF8vRZxHyVSWKHap3JL5egzjPkoc6XCf",
      "YZo6f7KpHbqDcpVYdLhHu26Ol+yMUnVjiVSWKHap3JMcnVf5KHPfhPujo6QVSO3UG5Sqw9+Ee6do2hGUf1Tu8eaqTDWW9ZlDWspKmsjjndcAw3m6/ReRmHau",
      "i7VO5eZtuVlpSTWRZ9OHVE5b63K0NujaOkRpdmuAXoMRbFhEUlwF2e7zTEYpZ6+1qGy44jXVDYcpmbeCSewc3xVldaVJZ9KKirnbHESAHZzffsAzleTrZxNT",
      "25Wysc+R59Qpm5jdmuuG8m/sWjLMhtComqw4xWRRsY1p5nubnO+4AIrL88/093pJLRpI7P8AXnzsFLhDxJzEHQpo62nr6MVFJKJInX3OAI0fA5wvKWdGQ+x6",
      "Gra5sNHSmrlYRmxX+zfuvK6vou4/ZMs5je1tVPJMwYfwuOb5LXp1m8dt0jIoccj2sY1t7nONwA+JURTRTQiWGVkkTheHscC0jeuFaz22hbFHZsgd6qxhqahp",
      "afbANzQfhfn7Fx6WQz2ZBZ8GOOntGulcMLSLoAbyBvu+aKsvaU9TBVR5SnmjmZfdijcHC/eEsdVBUZRsE8UrozheGPDi07DdoXj/AFgUsdrssxuRZU1cdLBg",
      "YQGnCA4j46e5b7JgpaT0jq4qKMsggpI4n3NOd95N5+N3iqI8+rUy9M3UG5LLyL/6SobMzCNbR0SkmmYYZACb8J5jsRUp5mJCmJCw09GhCEIpVf5jd4VhVf5j",
      "d4TCdgaAhHMhbZCh+o7cpSv5N25SMNAQgaEKQVVV90m/od4K1VVX3Sb+h3gprp5FL90h/ob4K1VUv3SH+hvgrVKeQofqO3IBBF4IO5Q/k3bipkw0BCBoQohQ",
      "/UduUpZOTduKgYaAhA0IUQofqO3KUsnJu3FQSNAVVPSxUxlMTMJleZH5773Hn+SuGhCEFD9R25Slk5N24pSRoClA0IQQofqO3KUsnJu3FISNAUoGhCCFD9R2",
      "5Slk5N24pCRoClA0IQQlfqO3JksnJu3FISNAQgaEIISv1HbkyWTk3bikJGgIQNCEEJX6jtyZLJybtxSEjQEIGhCCEr9R25Mlk5N24pCRqhCBoCEEJX6jtyZL",
      "JybtxSEjQEIGgIQQlfqO3JksnJu3FIA0BSReCCgaEILi0noxQUgc1j6t0Zdiybql4aDuBAPbeuw7NGdylQ/k3bikObHYdEy0DWhry8uygYXnJh91xcG6L/ip",
      "qbDoqqv9bla8vOHGwPIZIW6pc3Qbl0hoCFJzrRsWktKdks4kDmtwOychbjbpwuu0hbsLWQ4WANa1twA0AJ0j+TduKoTl2lYgr6ptQyqlpnGIwy5MD3kZN92f",
      "RvCmtsWOZlJ6pM+ikpAWxPjaDc0i4i4/BdUaAhRcmawYDZcFHTyPgNO8SxSi5zg8Z8Rv033m9aKCz47OpZGNc6SSRxfLK/WkcdJK2qJOTduVYA0BJU/dpf6D",
      "4KwaFVVfdJv6HeCC8xEhESFkvRoQhCK5VfmN3hWuVY5Vu9MJ1cqOi/hKMqOi/gKdC3jJMq3Y/gPklfK3A7M7R0D5K1LJybtycSMsz9XCVGWZtPCVYhGImWZ0",
      "vkVVUysNLKA7OWHwWhVVX3Sb+g+CsPTySmljFLEC8Ahg8Fntenp7Rs+Smlq3QRuuLnxvDTcNIv2LXS/dIf6G+C4fpZY9pWxFDFQ1UUcAvMsUhc0P2ZwDfuUZ",
      "5lg9D2U8NqWm+geWWXe1kQe+8OcNJF69W+aMxuukZoP4gudYFnV1nU+Sq6qGRgFzIoYQxrO3Se1dSTk3blqaYed9IrTL6iOzYJZY43DHVTwNLnRs2C7QTt5g",
      "rLSqoxZ1BQWVO1raxwjZKx1+CMC9xB23eKsnsu0WWlVz0FTTRx1eHG6WMufHcLvZz3HtSy+j76eGz/syWNktHiAM7cQfiGcm7n50ZR7uXC6KzLN9I46VxFLD",
      "7EQLibnFgBu7SF6SzmZCxqeJ78T2QNa4k3m+5Yn+j7RZMNDHICMu2WeR4zy+1id3ldeSNmTd7DdGxKcr0jq5GU8VHSz5GoqnYRIDcY2gXudfuzdqLItiB/o1",
      "DXVVSz3cQyz8V5DhmN/xVQ9HoKm3quur6eKWMtayBj/bAF2c3HMM/gsrrDqYLGoIoqeGaSlqDK+DEGiQXm4X/C8HPsWYqkute1RW+i9a+OnqYHPAiYJ48Bdi",
      "IAI71poLao6iWSgidIXwRX5RzbmPAzEtPPcVltSzK62KSkikghohlw+YMfic1gG24Z7/AKJa6wZXttA0zYoh6s2npW7G6XX7L9HYnE2weklHUTmOKOqc3C4x",
      "yiEls2HSGc57lTYVuSV0FXUVMEsNKyR7o55GhrQwcxz336eZZYLItGSsFS+GnpWRUj4qenY/EI3G64k3Z+7mV1BR11NYTKZ9l07zG0MMJqLzIPxG+64X7FYn",
      "Ts21Y7SLzDT1UcYF7JJYixsg2t/e5aaueKmpJZp5GxxsaS5zjcAuX6P0NTTxTtqoslBj/wCnhdLlHRtu0Fw5r9GxVektM9zKMspZamnZNjmjizuNwOHMToxX",
      "Ky8UFhtuC0LdpzRVl9HDTyST6WjSALwdHOV07OtehtMvFHOJCzOQWlpu5iLxnHxC8vUWVX1dJalVU0kkUtRNG10MLg55hbdeAdBOf5LsWHZ8WVfVOFpF4YI2",
      "OrC1pDdNzWtuuG8KqKUuxVVUNHDlah4YzEG3kc5Nw+ZWOW3LMArGmsixUrb5s+r57MyxelFBV1tPSUtC13t1DTJIXm6Noz33X7Vz5bCyVpzTtp5DSWfShsEe",
      "c5aTO6/45z3oii78tt2bDZ0VdJVsFNLyb7iS/cLrz3IltyzYoYpX1bBHLHlI3XE4m3gZvjeRm0rzEFnWjZ8kbW0MtRUMpQymkDhk4nuvMhcb7wbzzDPctVkW",
      "FMa+zn1kTwyioxhLutcbzdu+qajz7Fu7U23Z1JLBFUVIjknALGOacVx5yLvZ7bllNpubbdoxTTMjo6anjvLyGhr3X8+65YrIbPS2nVsqKCtfVzzkuqQBkzHf",
      "7PtE6AOZceSgmrae2bQrIJHRmVzaeBwzyP1GuI2Dm3lUfK/Z7qapgp4MtPNHFEPxvcA3vKBUQksAmjJkbiYMQ9obRtGdeMrIhTVcVJVwVFWaOlY2jp8mXMlk",
      "u9pxN12a4DPoVNDZlXWVNmUbmyRU8NCHTyXXAB5vLG77rt16qjz7VvcxVME0GWimjkiz+21wLc2nOuTNawmtenho6iGWlNPLLM9rg4ZrgM40Z715407YLIhE",
      "rJYLNra50krI4iboxqtwtF/tYR3pGU0jqW26umo5KR1U5lHDFkw03G4EkAZtPyVEb55zKewp68Ms+Oe0ZKemLzdflRgOfMQTtFxV9RW0tKYxUVMMJkNzMo8N",
      "xH4X6V5G0xR09qUoYDVT07W0vqU1OTe2/WZeLr7ufnCprKfLW5XR1VYyCRwEEMTqEzHJXZiy7ML7zzcyq+F/L2tRUwUrA+omjhYTcHSPDQT2p5DfE4joleMt",
      "P1WC06UAuraina2lNJUQFxc2/XYSLr/joI2L1zo3shLWvAaG3ABt1wVUcq16FXhl6xvD+6MMvWN4P3RSWJJOTduKi6Xps4D5pJBLk3XuZo6J81RCXIVd03SZ",
      "wnzR77azuKqR1hZadPUV1TRQ4nyQMvlcB7LSfw37VolFQYXiMxh5acJN+Y8y8WwWnR0lBZnqD6V81QHTVOXaXSuBxPNwN5BA50xGqeHqrStens6SKJ7J5p5b",
      "yyGCMveQNJuHMie14aazvXKmKeEEhrYnM945x0ANB0lcm25vUpG2/TTQPdE3IvjLrxK3FqjY6/8AdFfUY/SWmfVBjIaOkdVYXOuGIm6/RpAv70Unasy0YbTp",
      "BUQNkYMRY5kjbnMcDcQRtRalfBZ1E+eoLrtVrWi9z3HQAOcrn+i8dQyyTPJE1rqqV9Rhc4ggON4GjZcstqzYvSWH1rA2GipH1NxdmxE4b9HML+9NanUp7ao5",
      "rJfaDnPhhjJEglbc5hBuII2os22aa0IJ5Q2WnyBulZUNwOYLr7z8Ll5imjlkbZMVTGGMrauWtexxuvA9poPyKWofJWUtTPhwQWtXxwtN92KNub53FVefhX5+",
      "XprKtyltWaSKBkzHMaHjKsw5RhzBzdozLoycm7cVwbLLqr0irquKIerwRtpGEHMSDe67deAu1I9+Td7s6NoVXCXIVeN/VO7wjKP6p3ePNFI6WTk3bilyjupf",
      "3t80skjsm73Txm+HmqIS5Cryh6p/y80ZU9W/uVSOlk5N24pcr+h/clkl9272H6OimkuQq8qOi/hKMs3ov4CipR0snJu3FLlm7H8B8kskzTG7W0dApiJS5U1n",
      "3Of+27wTZZn6uEqmslYaOcAm8xu5jsRUp52LmQpiQsNPRIQhCK5Vt5Zm9WOSR8uzemOU66EIWmQlk5N25Mlk1CmEZCEKIVVX90m/oPgrVTV/dJv6D4KMcppf",
      "ukP9DfBWqql+6Q/0N8FapTyEsnJu3JksmoVMmQhCiEsnJu3JksnJlQMhCEEJZOTduTJZOTKYBkIQghLJybtyZLJyZTAMhCEEJZOTduTJZOTcmAZCEIISycm7",
      "cmSycm5MAyEKEEJZOTduTJZOTduTAMhChBCWTk3bkyWTk3JgGQhCChLJybtyZLJybtyYBlClQghZ6imiklZUPZfLE1wY6/Rfdf4LQlk5N25MBhNiWYbQ9dNF",
      "D6zffjw8+27Rf8VbW2ZRV8kUlXTRzPiN7C8X3LWoUQsVoWZRV2CSrpo5nxZ2F4vuW1LJybtyo5DPXWfSWjE2Ksp2TMacQDhoKmooaWqo/VZ4GPp7gMmRmF2i",
      "7YtKhBV09PDSwMhp42xRMFzWNFwCaTk3bkyWTk3bk9wZQhCCEsnJu3JksnJu3JgGUKVCCEsnJu3JksnJu3JgGUIQghLJybtyZLJybtyQZZ677jP/AEHwV6z2",
      "h9wn/oKC87EhESFkvRIQhCK5JHmnZvTuSw/eWb0xypdPKjov4SjKjov4CnQt4yTKt2P4D5JXytwHM7gPkrUsmoUxSLlmfq4SjLM2nhKsQjEry0fS+RVNbPGK",
      "OXPeS267etSy2n9wl7PEKa6Ivqg8MjI4I2F7b2tAOf4J8tF1je9WIVg1Xl4usZxBQ+aMsN0jOIK1LIPYKcCMrH1jO8KcpH0296m4bAjC3ojuRiRlGdNveuNb",
      "9ZUPkgs2z5Aypqb3Ol6qMaTvz3BdnAzot7lgtSx6K0A19RCS9guaWPLDcdIvBGZWJjqbcjpbNqxTh8s9LI2mZlDflJCBdn59OdZ7KdU0Fs1VNU10tU0UjZ5D",
      "I68Mfeb8OwXcypi9HpqewqZtPTxipiqhVOgc64Ozn2MWfmu7loNjVX2VaUhZEbSrhoB9mMXXBoPwHPtT8+dv9X7ectvovLPUej9LNVSOklkBfe43m4k3fK5Z",
      "/Smt9Xjoqf1v1MVM+F8oeGlrACTnOjmXWpqKCnpYoWxMwxsDR7I5hcufU2UJ7ciqpIojTwwFrAQNcuF5u3BU16lF0rgqaKzKVs8do1Notmdk4wJRMXu2NuzX",
      "rQy3aV7KchsoknnMAiLRia8ab8+gbVltmgqhaVFWUFJFUZFj2GNzwwNLgLndlywssCvo6illhEFRLk5MpI92EMleby8C7OAM1ysTsVFv0NPHVSSOdk6WZsMr",
      "rswcbvkL86mO2aWaFpkylPlGuewTtwlzG3Xu+Az89xXHp/RmVtkUNFNheTVZercXawvJu+PMFZadjzWh6SxukiLbOggF5v5Vxdfh3ZhfuVER5/CdU2xRVNjz",
      "VtLWMELQW5YtJDHaBeNOkhD7XpaF1PTWhVxCskaL2sBN52/AX7VxWWRUT0MEckDmGsrjUVDSeTjBvDTwtCeNs49IWy0dBWwmd2GsEwujLQMz2vB0/Dn2KiIT",
      "t1dsWfRVUdNUVTGTyXYWZyc/ObtA+JVdZbVn01WKOWpa2c3ezcSG36LyBcL/AIrkRtnHpC2WjoK6Ezvw1gm5MtAzPa8HT8OfYFipLJe+eop61lrY5qgvmDMA",
      "gkGLMS7SRddmvvVERil6t9p0bDVh07R6oA6c3G5gIv8ABVz2zZ9PKI5agCRwaWsDSS7FfdcAM+g6F5M2XaVVTeomlnibPWl9bM52aRuK8BufOMIGfcF26Wy3",
      "/wAQWhaUkL742NhpRiuJAF5u3k3KqFLpOtiz22i2gNUw1RzZMXm47CdAPwK2ScmV5mx21DLakFLSVtPRT4pahtS0NwSfpPPfszr0UkXsH3j+9VcJcoVeSPWv",
      "+XkjJu61/wAvJCWJZNQpcm7rn9zfJLJG/AfevPYPJUQlyhV4H9a7uCMEnWnhCqSxLJqFLgk63/EJZGyYD7wcKqS5Qkwy9Y3h/dRhl6xvB+6qSxLJqFLdL02c",
      "B80sglwG9zOE+aohLUKu6bpM4T5o99tZ3FVJYlk1Cl99+j5pZMrgOZneVUlyhV3y9FnefJF83RZxHyVSWJZNQpb5egzjPkle6XAb2N4v2VEJcoSYperbxfso",
      "xSdWOJVJYlk1ClxydV/klke/AfdnvCohLUKvG/qnd4RlH9U7vHmqksSyahS5R3Uv7x5rFbM1UyyKp1HDIagRnJjMc/erhctMFbT1M80MEokfAQ2QN/CTzX6L",
      "1RX2xQWdIyOsqWRSPF7WXEuPYF52y60U1VZlm2fS1kDL3SVEk8OHLXNznPnJvIzrbUyOsi3nWhJGZKeuMcJJ14naBdtaU1qt1qq1aKjom1dTOI4HXBpc03nc",
      "Lr/kr4546mkbNA8PikaHNcNBBXnayrjdbtfV1TXZCzKcBjSND3C8nfdcFv8AR+N9L6O0cMrHh4jBIw6Lzfd81RCl1J54aaIy1ErIoxpfI4NA7SpdNE2HLOkY",
      "IgMWMuGG7bfsXm7RlhrraqPXGl1DZsGUcxzbwZHAm8j4AfNYaBpqqWxbKqA71dkBqZ2Fp9poPsNPwz/JER5+f8T2MU0U0IlilZJE4Xh7HAtI3pI6mCqgMlPN",
      "HMy+7FG4OF+8LxtLJl7NgoIMUdPaFdK72WkXQA3kDfd811fR8QR1lrmlZk6XLtZG1jCG3taA67tTEefhTL0azWj/AC+f+lW5Zn6uErPaMrHUEwBN5bsKKlOD",
      "EhESFhp6JCEIJXJYfvMe9M5LB96j3pjkS6yEIW2Qlfq9oTJX6vaPFUIyEIUQstp/cJezxC1LLaf3CXs8Qpro90NSEIUyEsmr2jxTAgi8G8fBLJq9o8VAyEIU",
      "Qlk1e0eKZLJq9o8VQDIQhBCWTU7R4pksmr2jxTAMhCEEJZNTtHimSyavaPFMAyEIQQlk1O0eKZLJq9o8UwDIQhBCSTU7R4p0kmr2jxTAMhCEEJZNTtHimSSa",
      "vaPFMAyEIQQkk1O0eKdJJq9o8UwDIQhBCSTU7QnSSavaPFMAyEIQQkk1O0J0kmr2jxTAMhCEEJJNTtCdJJq9o8UwDIQhBCSTU7k6STV7R4pgGQhCCEkmp3J0",
      "kmr2jxTAUGhidXuq33ukMWSuOgNvvPf9Fig9HaGCrjnvnlyRvhjlmc9kX9IOhdZCi5tTYdFVV/rcrXl5w42B5DJC3VLm6Dct8mp3Jksmr2jxVAcmssCKrr5Z",
      "nVErIKjD6xTtAwy4dF50gbQNKa0rEbW1TZ46mWmJiMEgjA9uO+/Dn0bwushRcqtsWOZlIKSZ9FJSAtifG0G5pFxFx+C1UlFDZ9CympwQxnOTeSb85PxK1JZN",
      "XtHiqwZZLU/l0276rWslq/y6bcPEILgxIREhZL0KEIQSuSQm6pjOc5+ZM5RT/emb0xyJdPKjov4SjKjov4CnQt4yTKt2P4D5JXytw6HaR+A7dytSv0DePFOI",
      "uWZ+rhKMszaeEqxCMSvLR9L5FZrRlY6hkAdec3iFtWW0/uEnZ4hWN9Huhdlo+mFxPS19nPscmvlqMgx4JbTOzvOw/Deu+uVarbbklDLMfQxQke1JNic/sAFy",
      "mYcT0CETYKypiljhpZnjJ0uVxGO7nN/OV6t80RbmkZpH4htXNsCw2WOyd5ndUVNQ7HLIWhoJ+AGgZ11ZBmG8eK1MxbLzdvZGa2KUWk932VgIvY8huVJzYyDe",
      "Bdo5lrtOhsWGyr6qJvq1MC9rWyOGfsOclJXWTade19HNXQfZ73XucIrpi2+/Dffd8L7lsrrKFZPRBzgKWndjdFdruGrf8BpWcqj3edip5aaiselL3RyVNdlz",
      "EHk5JgBOG8m/MLl7F72lusNI5/isUtnZW24K1xZkoYnMay7PicRn7gtkkbMI9hukc3xTcJwpZ6q3K+anoqt1HQ0zsEs8d2OV/O1pOgDnK31tpwWTBBFK6eqn",
      "eMLGRtD5ZLtJuFw3nMFzKGhtezY3UNNS0UsWUc9tVK86Cb87ALye1FbZdp/ac8tNHTPM8DYmVDzdkLr8VzLs5Jz6UZR7tslpwV32aKeomhNS4yMuaM7W6zXA",
      "6Bzb1ZS21T18xjp4ql0QOapMRETrjnud/wDQubQWJVUZilMMMr6aibFEx7rg95N77zcbtAF6LPoa+mfVvjoIqencGmKkkmDhjvz3EA4WnZtWssbTp0dt01bO",
      "9sEVQYGgn1oxEROu03O/+hLQW/TV1SyKOKojbLeYJZGYWTAacJ87lyI7GrpqW0oGUzaGnniuigdKH4XnSQRqtOxbLEseOGYSzWT6q6NmFhfVumI24QbwB/8A",
      "bkVCl6BLJqjePFLkI+j80r4WADMdI5ztRFJchV5Fmx3EUZFn6uM+asSxLJq9o8UuRbtfxu80r4W3D2n6R+M7VRSXIVeRHSfxlGSHTfxKxLEkmr2jxS5L/cfx",
      "JXxXAe8fpHP8VQlyFXkj1r/l5Iybutf8vJSWJJNXtHilybuuf3N8kr2PuHvXaRzDbuVSXIVeB/Wu7gjBJ1p4QqksSSavaPFRgk63/EJHtkuHvBpH4fiqkuQq",
      "8MvWN4f3Rhl6xvB+6qR0smr2jxUXS9NnAfNI8S3C9zNI/Cdu9UQlyFXdL0mdx80e+2s7iqksXFrPSKip6h8L2VOGOQMkmEDsnGbxpdcur739HzXlvSWSqitG",
      "l9dkgqaJ8zAyijcWvc6/WIuOIDZeAmI2F2l2rWt2ksksbM2aV7ml5ZCzEWsGlx2BPaFsU1BTQyuEkxn5KKFuJ8ma/MNy8xUzvfT25Nha+rrKj1GFl+cAC4Af",
      "DOSrjP6jaNoTzBrjZtJHTwtxHOXDmzaSbgis88+D388+XqaGrir6OKqgJMUrcTbxcVnte1ILMhjMrZJJJHARxRNxPfdnNwVdg0tRQWJSU0jGY2RjF7RzE5zz",
      "fFcWurMlbVq1s7Wk0MEcUTMXO7PmzaSbgmYqcEbDuSW1RssiO0cT3QygZNrW3veToaBtRT21STWU+0HOfDDGSJBK25zCDcQRtXnKON1DWWZT1oa1lnULqlwL",
      "s2Mm4nszqumjlkbZMVTHgZW1cta9jjdeB7TQfkU1vnnyr88+nqLKtaG1Y5TFHNE+J2F8czMLm3i8ZviFtk1e0eK4Xo66SomtG0hEcnVze6z6WNGEHtzrsve+",
      "4e6Okc42opLkKvG/qnd4RlH9U7vHmikdLJq9o8VGUd1L+8eaR8jrh7p+kbNu9NJchV5Q9U/5eaMqerf3IpHSyavaPFRlf0P7kj5RcPYfpH4fiqIS5Cryo6L+",
      "Eoyzei/gKqlHSyavaPFLlm7H8B8lD5m3DW0j8J2pqUtWO1v5bL2eIWjLM/VwlY7Vla6zpQCbzdzHaETEpxouZCIkLDT0KEIQSO0IpvvTEO0IpfvTUxyJdVCE",
      "LYCV+gbwmSv5t4UDIQhRCyWp9wk7PELWslqfcJOzxU10e6GtCEKZCV+gbwmSv0DeFAyEIUQlfoG8Jkr9A3hUAyEIQQlfoG8Jkr9A3hMAyEIQQlk0DeEyV+gb",
      "wmAZCEIISyaBvCZK/QN4TAMhCEFCWTQN48UyV+gbwmAZCFCCEsmgbx4pkr9A3hMAyEIQUJZNA3jxTJX6BvCYBkIUIISyaBvHimSv0DeEwDIQoQSyMEjHMdfh",
      "cLjcSD3hYqayaChkytNSxslcRfJde85+kc63pX6BvCYDM2zKJloOrm00YqnC4y3Z0TWZRT10dZLTRvqYxc2QjOFrUIQWKpsyimrYqyWmjfUxkBshGcZ1tSv0",
      "DeEwmassyir5IpKumjmfEb2F4vuU11n0loxNirKdkzGnEA4aCtShBQxjY2NYxoaxouDQLgAofoG8eKZK/QN4SDIQoQQlk0DePFMlfoG8JBlClQghK/QN48Uy",
      "V+gbwkGUKVCCEr9A3jxTJX6BvCYBlhtj+XSbx4rcsFs/y9+8eKC4sSERIWS9ApUIQSuRSm6pBuJ3Icpo/vQ3JjkS6GVHRfwlTlR0X8BToXTGVeVbsfwHyUPl",
      "bmzO09A+StSv/DvViLlmfq4SjLM2nhKsQjEry0fS+RWW0ZGSU2Ta4XvcGj4Z1uWWv/0399v1VjfR7oXZaPphGXi6xverEKxhXl4utZxBQ6aI4bpGaekFaleN",
      "XenEjKx9YziCnKR9NvepwjYEYW9EdyMSMozpt71xfSNkLaU1klfWQNiFwjppQ3GeYXXab8y7WBnRb3LlVtnSVds0kkrYxRU4xhg0vk5r/gB4qxOTG+0KqOns",
      "qetlikhp8vWVEbrni+/CwO27T8FMdo1k1iej907hUVNQwPeDnewXk37wFfX2NXSWjXtpmwintBrGvnLrnQgC5wDbs5I0LZ9jgWxQOZEwUdHA5rBmvLzcBm3A",
      "rVx559J2V5eG2J6Wwat0rjPVw1b6eJrtL3YvYHzC9JkIuqZwhefjsCRvpPLVSCM0OPKxMGnKFoBJ3XfNZirXZcy1vsmCGjqzU19YyLKVD4WB2THOTozbBpzL",
      "TUekFDA57SZH4YmStwNxZQOJDQ0c5N2hciawHutasdLZoq46iQObL646JrW3AYXNGm648x0q+OwJY7Wr7QMcZwsDKKBpuAubcCdmzvTnKNa3pKGWHDVWfDO+",
      "apcGRAwk4XYriHcwOkXLoVNsU1JSQTV4kpXSuubE9uJ57G3rlS2JV0tLY8dNBHVequL5mOlwYnka19xzAklZ7Uoan7ebUTstBt8DWROs8NeGnPjBLhmz3Z8y",
      "sT0VRa9n01DHWTVUbaeS7A++/HfsAzlaqaoiqqdk8Dw+J4va4c4XlLSohRw00dDZ9oCrpW4qaVoEjXF2s15vzZ9OjaCvUQxF0EZla5khaC5okJAPONKqhKLQ",
      "tiz7MfGytqmQuk1WkEm7bm0D4nMuTZttwwWQyrtGqN1TUyOgFxe4sxG4AC8kXLBaVPaTai2RT2bNPU1AEcU5f7DYsIFwN95N5Oa5JUWRLQ2nALrTycVMyGB9",
      "CGuuP4gcQOEk3Z8yopS9lBPFUwMmge2SJ4xNc05iFmqbUoqR8zaiobGYYxI/FfmaTcD3hRZ1nxUVBFBFlmNaND5L3XnOb7s1964LrKqp/SC0LRqYXmCnaPVo",
      "77zM5rcx7CTd8T8ETVqHbFuWY6WkjbWRl9WL4Wi+94+natElVTipZTGeITuziIvGIjbdpXkaSwamho7PGSklqcTqqocOYtacLAd58VloWMnq7MfHBNJOZjPW",
      "1kkRaQ8NJwAkX5tGzMtVFrs9y2spnyMjbUQl778LQ8Xuu03D4KuW0KYQVToqiJ7qdpMjWvBLLhzjmXkqehnofRWotGMSsrat+OR4be+KJz89wuvzAk5lZWCg",
      "b6MVLLBgkkLw2nDmQFpfiNx9otBPxKzMYYnXoLDrjUWZRetzxmtlgEjmXgOIPPhWuSqpxUspzPEJ3ZxEXjERtu0rysVjyUlrUsjWOlrKenfPNI0DO4jCyNpu",
      "0ac3wWGiaJqqzZIoJpZzMZ6yrkhLSJA0nACRfm0XDMtZds7T3Lqyla0OdUwhpfkwS8XF3R3/AAUz1VPTYPWJ4osZwtyjw3Edgv0rwcNkVFXYjJquJ3rFZPhp",
      "4nN5IOfic87DcNOwBXWy8GptY1FJNWVjW5GnjMBc1keEe3fdcLyToz5kUXfs206upo45RkZHTVb2sa5wYTEHEXjaQBfuXaf+HeF5WlpPUa6jZNKIaay6MXyv",
      "FzQ9+b6HvWCCVtALSmEgqrUgiMoq2Sl7ZGnRfnuF3Ru5syqhcvdXoXirFpTR1TauS0bOjwRF1RLFUOlfNi/E++4AArV6ORRNtepZJMyotBjcZq2yOkbKxxzX",
      "57hd0e5XpVvVpX/h3hLdL02cB80rxL7PtM09E+aKS5Qkum6TO4+aj3u1ncVUliV/4d4S+9/R80r8r7OZmnaUxCXKEl83RZ3nyUXy9FnEfJFJYlf+HeEt8vQZ",
      "xnySvdL7PsN09L9lRCWoSYperbxfsoxSdWOJVJYlf+HeEuOTq/8AJK97/Z92dO0JpLlCTG/qnd4UZR/VP7x5opLEr/w7wlyjupf3jzSvkd7Pun6fh5piEz2h",
      "a9BZpaK2qihc7OGuOc9mlWSWjSR2f686ojFLhxZUG8ELmekM1dFBlqGkZe1pys7sJfGznwgkA9/YuVRvo6iosmnpxJ9nUtMasiTS433Au3G8oiE9PT2jSVVD",
      "65DO11NcSZDmAu0336ElDaVJakGVophKxr8JIBFx3FeUpsVXTUNK5j2wWjWy1L23a0YOIDtzLr2FI2autSsjY4Qy1AZHc3MQxuEnv8FqIUvQEgC8m4BVU9TB",
      "VR5SnmjmZfdijcHC/eFx/SKZ1Q6js1mUYKyW6UgEHJtF7gN+jtXGy/qsdrMsxuRZU1cdLBgbcGnCA4j46e5ZiJlPYw1MFQ57YJ45XRnC8MeCWnYbtCT1mB85",
      "gZPG6ZhBdGHgubvGkLybpYLFrrTks+LCylomREBp9qUk3X/HPzq2ipIaO37MijBdUMp3yVUmE4nl12c7c96YhTL1ywWz/Lz/AFBbMsz9XCVgtiRrqEgE34hz",
      "IqU5MSERIWGnoEIQhFcpovvY3FK5PRfexuKY5UumhCFsBK/S3emSu0s3/RQMhCFELLX/AOm/vt+q1LLX/wCm/vt+qGuj3NSEIJu0pZCV+lu9MlfpZv8AooGQ",
      "hCCEr9Ld6ZK/Szf9EgyEIQQlfpbvTJX6Wb/okGQhCCEr9Ld6ZK/Szf8ARIMhCEEJH6W706R+lm/6JBkIQghK/S3emSP0s3/RIMhCEEJH6W706R+lm/6JBkIQ",
      "goc0OaWuALSLiDzrPHSU9M3BBTxRNc72gxgaDm57lpSP0s3/AETAVw0lNAxzIaeKNj9ZrGAA77lNPS09K0tp4IoQTeRGwNv7lahCCV+lu9MkfpZv+iYRkIQg",
      "hI/S3enSP0s3/RIMhCEEJH6W706R+lm/6JgGQhCCEr9Ld6ZI/S3f9EwDIQhBCR+lu9Okfpbv+iQ59TYlPWTF9ZLU1DCb8i+UiPhFwPbeitsOhrXxOkY9mTZk",
      "8MTywOZ0SBpb8F0kKLBX2TS18cLZBJEYeTdC8sc0XXEAjmIzLRDTxUsEMEDBHFHcGtHMFekfpbv+ioDDall+vyU80VTJS1EBOCVgBzEXEXFVTWFAbLgo6eR8",
      "Bp3iWKUXOcHg34jfpvvN66qFFyfsGnNkz0T5JHuqDjlnN2Nz778WzmGZWWfZooXPlkmfU1UzhlJngAkAZgAMwAXSSP0t3qiQZc+2/uI/rC6C51ufcm/1jwKJ",
      "LkxIREhZLvoQhCI5TRuw1QNxOY6AocnofvXYUxypb8qOi/hKMq3ov4CrELpjKvLN2P4D5KHStxNzO09A7D8FaldrM3/RWIuWZ+rhKMszaeEqxCMSvLR9L5FZ",
      "q2VjvV7naJmkraslfppv77VY30e5fl4+mF5G36qG1PSBtm1VZHTWbSsEs+J4blnHQ3cvZLk27Y1PaNJPI2jp5a3JFsT5GjMebOr92Y+C+jtsttSzPWHtjhAk",
      "cxoDsxaDmK6bpoi5nvGaekNhWaxaAWXZFNRi4mJgDiOc6Se9a5GhxaNpPgUzV4zDy0lpQWnbwNVPJDZtPJgizERzyg6XO0XA6AdK6fpBTWZU0mWtSd3qsALn",
      "RNlLWvPNeBnJ2LHB6PVpo47NqqqnNmxuvujjIklGLFc4k3DPsVloWJX1dtNqBUUjqWMDIxTROcIztwggE/ElWVR72mxqR1R6KRUtbPNDjBOaS57WYrw0ndcF",
      "n9F44Iq6vNn4m2XlGtiBeXBzwDjc286L7lqtmyLRr6SngirICAT6wHRlglHMPZN93wvz7Vts+ilpY2Rzvp3tGZjIYMm1guOYZym4uZHallr1raGyaqpxC+OM",
      "kZ+e7N80WUZY7IpfW5MUwhaZHuOe+7PesnpJQTVdnMjpII5XNmY98RcGY2g3kXquantC0rLrIZaGnonSQuZGBKHuxEc9wAA71ntLXeGiit2lrapkMbJmtlDn",
      "QyvZcyUN04c9/eAopbbp66sMVPFUOiY4j1nJ+6JAN4Dv/oXJZYdfXU73VEMNE+KkNPTRMcHXOIuLyRuuCsNFaNRYb6EWdT0BEOTYcsHFxu+AzC6/PpzpqA3Q",
      "ektFUVDo4o6pzcLnRyiElk2HSGc7u5Z7Gt+WspK2rqaaeOljdI+OVzWtGBvNpvvzHmWeCyLSkrBUvhp6VkVI+Knp2PxCNxuuLjdn7s1ymKyK6X0abZr6WGnN",
      "zI3ETYyW3+245gM+fNn0qqE1RW3BQUUTJH1dbJkfWHuEYxRxnOC/OBmGbabtC3T2xQQ3ukqWMEcYmcTfmYb7j27Fw6qxLQdXWhT08MTaWtLAaoyZ44w0AtDe",
      "c6bubOk+xpvtysrJaZxpaZjW0sIzmUtYbj2Em747lZytei+1qD7NFoGqjFIReJSbgf3+Ctoa2ntCmFRSyZSIki+4jPuOcLzE9neq2FRUk9JWvnYMu2elaH5O",
      "a8nO2/47Ll6Cy2zy2bTvrozFVOYDIxrzmPeqo1fDekfrM3/QqMi3a/jd5pHRNxM9p+npnYjEuQq8iOk/jKMkOm/iViWJH6zN/wBCoyX+4/vSOjOJnvH6dvwU",
      "lyFXkj1r/l5Iybutf8vJSWJH6zN/0KjJu65/c3ySOY7Ez3rtOwbNyqS5CrwP613cEYJOtPCFUliR+szf9CowSdb/AIpXNkxM94NPR+CqS1Crwy9Y3h/dGGXr",
      "GcH7qpLEj9Zm/wChUXS9NnAfNI4S4me0zT0Ts3qpLkKu6bpM7j5o97tZ3FVJYkfrM3/QqPe/o+aR2VxNzM07TsVSc2s9IYaKaRtRRV7Yo3Brp8gcnvvv0K2t",
      "tunpKsUrYampqC0PMdPEXloOgnYsFS99sWyac4DQ2e4STZ/ZfJpDdzdJ7FVWTGy7VitKmkhmjtF8cT4Q68v5g5h+HONCYjhS9HDIZYmvLHxlwvwvFxG9c62L",
      "bpbKfG2ZssryC8shZiLWDS47AujfL0GcZ8l4uqmfJDbU2APq6upNDC2/OABcAPhnJRWp6e0LYpqCmhlcJJjNyUcLcT5M1+YblEltUbLJjtHE90MoGTa1t73k",
      "6GgbVwDOKG0bQnmaHfZ1JHTwtxc7hzfEm4JKOM0NZZlPWgNZZ9C6pcC7NjJuJ7M6ajz7T1FmWhDadIKiFr2DEWOZI25zHA3EEbVofrM3/QrjejDJ2WUZpYS1",
      "9VK+owk3EBxvHyuXVc9+Jvuzp2jYqla5Crxv6p3eEZR/VP7x5opHSv1mb/oVGUd1L+8eaV0jsTfdP0/DZvVSWoVeUPVv+XmjK/7b+5VI6V2szf8AQqMr+h/c",
      "ldKMTfYfp6PwTSWoVeVHRfwlGWb0X8BRUpYkfrM3/QqMs3Y/gPkldK3E3W09E7ExEpaubbv3Nn9weBW7LM/Vwlc625GvpGBp/MHN8CiYTmxIREhYad9CEIRH",
      "Kyg+8ncq3Kyz/vB3JjlS6SEIWwErtZu/6JkrtdqgZCEKIWSv00395q1rJX61N/eapro9zWhCFMhK7WZv+iZK7XaoGQhCCErtdm/6JkrtdnakGQhCCErtdm/6",
      "JkrtdnakGQhCCErtdm/6JkrtdnakGQhCChK7XZv+iZK7XZ2pBkIQgoSu12b/AKJkrtdiQZCEIISO12b/AKJkrtdiQZCFCCErtZm/6Jkrtdu9MAyEIQUJXa7N",
      "/wBEyV2uxIMhCEFCV2szf9EyV2uxIJBTw07XthjawPcXuAGknSSslNYtm0lY6qp6KGOd342t0btnYugoUQsX2bRMtL11tNGKp2Yy3Z9C2pXa7d6oDNNZlFPX",
      "R1ktNG+pjFzZCM4RWWZRV0kUlXTRzPiN7C8X3LWoUQldrM3/AETJXa7FAyhSoQQldrM3/RMldrtSDKFKhBCV2szf9EyV2u3emAZCFCCErtZm/wCiZK7XZvSD",
      "Ll2792j/AK/oV01zLd+7xf1/RElzIkIiQsl30IQhEcnoXYZnG4nNzC9I7QrbO5Z+5PTypbcqOi/hKMq3ov4CrELeMq8s3Y/gPkoMrcbczuf8B8lalOu3tTiL",
      "lmfq4SjLM2nhKsQjEry0fS+RWWrkZJPTMDrhjxk7LluWWo/mFJ/z8FY30crsvF0wjLxdY3vViFYwry8XWs4goM0Re33jOf8AEFalcBjb2qxIysfWM4gpysfT",
      "b3qcI2BGBvRHcrEjKM6be9eetqaWe3qOhfWy0NJJGXCWFwaZJL9TEQbs3evQ4GdFvcvN2tRWtaTHWc+lo2QyOz1gfobffmZdeHdtyoq06dTZ0j7PZSwWnUwN",
      "Dr5JseKRzecBx0b1x7PtCaH0Xtaf1qWeGB0jaWolde97QMxv589+dX2/QWlVTQUtLTxyWfg99dMInvOwuuJu3DOra2yqmqsaKiNNSQgysD2wOva2IEE3EgXn",
      "NsTk/auqdSyst9lUnrDy+bItxuOkm7OuH6X1kdLV2a2a0aihhe55ldC+44QNxvz3L0eQhu5JnCF5uvo7SFvuqIbLpqiPI5KIvmDWNz3lzhdffozDZpVNTKjI",
      "X2Naj4LJqq20KiR1C2T/AKeWcDKOZ8QBnJOjNetMfpHSvpZZnw1UJikZG+KWPC8F5GE3X6DeuR/DtbSsgnbDS1U3rJnmpmHJRX4bm4c2gafikk9GbSqYnsqJ",
      "og6orWzTSMN2GMNzBo35uy9WefSd+htyjrrRlo4MrjjaXB7mXMkANxwnnuOZPFbFBU2h6pDUtfM0kEAG68DOL7rr/heuTV2PURC0JqKINLKVtPRsY7Pdpcd+",
      "zcsNlmontIUlDSTUNLQ0puilIDpZHDMXAHNov/8A+qxPT/atFkZJfWG5OOXIudcbg+8C7vKSotuz6aubRzVLWzm72biQ2/Rebrhf8V5iz7Kral1j00tHNT0d",
      "M4y1GUOeSUZ78x0Yjm2qaKyHSVU9PXMtbHNUOfMGYBBIL8xxaSLrs196qi09qldrt7UuRYNBfxu80pibjb7T+f8AGUYlyhJkR0n8ZUZIdN/ErEsSu129qXJf",
      "7j+9KYzjb7x/PzqS5CryR61/y8lGTd1r/l5KpLErtdvalybuuf3N8kpY/G33rufmHkqkuUJMD+td3BRgk608IVSWJXa7e1Lgk63/ABSlsmNvvBz/AIVUlyhJ",
      "hl6xvD+6jDL1jeD91UliV2u3tS3S9NnAfNKRLjb7TOf8J81UlyhJdN0mdx81HvdrO4qpLErtdval97+j5pXZXG3Mzn5yqkuUJL5eiziPkovl6LOI+SqSxK7X",
      "b2pb5egzjPklLpcbfYbz/i/ZVJcoSYperbxfsoxSdWOJVJYldrt7UuOTqv8AJKXvxt92efnCYhLUJMb+qd3hRlH9U/vHmiksSu129qXKO6l/ePNKZHY2+6fz",
      "7PNVJauXD6RWVNVNp46xplc7AGlrhe7ZeRcujlD1b/l5rhGX7YtsOLXGhs9/HN5N8UxGrs6FVbdnUlWKWeqa2c/lgFzu4BbcQcWOGg5wuBSPdY9tyQTRmSO0",
      "pnSRyge2HXZ2uGy7QQu46UYmktfmv/CqsXcS1MEMsccs8cckhuY1zwC7cOdFRUwUzWuqJo4Q44QZHht52Z14qrwV9A+0ZWF1XWVjI6Ult5jY1+YN2aCSrrWk",
      "hr47aratpfHTtNLSsc0kNfdnO8kgdiKzzzue72E88NPEZZ5WRRjS97g0DtKA5rzG5jg5pzgg3gheWkdHVVmTtAF1JZdI1z2PaSHSlukj4AfNdP0aJh9H7PZI",
      "HhwivuLTmBzj5LXpZt2Vy7e5GH+r6Lo5Zm08JXLtt7XxxYT+I8yzMS0wRIURIWC9AhCEFW5XWdyz9ypcrrN5WTcmORLooQhbASnlG7imSnlG7j9FAyEIUQst",
      "R/MKT/n4LUstR/MKT/n4Ia6Ofz/xqQhCmQlPKN3FMlPKN3H6JBkIQghKeUbuKZKeUbuP0SDIQhBCU8o3cUyU8o3cfokGQhCCFy6SxoaS16iuEs8k1Q4uIe/2",
      "W5gMw0dpXUSHlG7j9EwDIQhBCU8o3cUyQ8o3cfokGQhCCEp5Ru4pkh5Ru4/RIOoQhBCU8o3cUyQ8o3cfokGQhCCEp5Ru4pkh5Ru4/RIMhCEEJDyjdxTpDyjd",
      "x+iQZCEIISHlG7inSHlG7j9EwDIQhBCU8o3cUyQ8o3cfokGQhCCEh5Ru4p0h5Ru4pBkIQghIeUb2p0h5Ru4/RMAxF4IWOGzKSCzTQtivpyCHNJvLr9JJ2rYh",
      "BcyisOko6v1nFPPOBhY+olMhjGxt+hdB2d7R8CnSHlG7ikOTZ/o/FRVMcjqiSaOAu9WieBdDiOfRpPxKhvo/EK90zp5HUxm9YFMQMOU6V+k7bl2UKtOPWWBF",
      "V10szqiVkFRh9YgaBhlw6LzpA2gaV1bgHMAFwANwTpDyjdxUjLk29qwbz9F1lyLe0Qb3fRBc+JCIkLJegUKVBQSPVtnuwyvzE5uYXqp+hX2bykm5a6eRLZlR",
      "0X8JRlW9F/AVYhaxlXlm7H8B8lBlblBmdoP4D8PgrUp5Qbj9E4i5Zn6uEoyzNp4SrEIxK8tH0vks08rDX0pxZhjv7ltWSo/mNJ/z8FY30c/n/i/LxdNvevHe",
      "lJhl9IaX7XdIbFydwMbjhEn67s//AN3r2q8rXWFblex1BUWnC+zXPxOfgOWLb78OztVFWz2dyzqez7OpRDQ5KKHWAD77/jeSrpqmGIGQyNLWMcTcVbDE2GFk",
      "TBcxjQ1o+AQQDILwNB+iZEPI0NqMgDLWqZ4p660JGRxUwlHuYi7MAPmUlvPjtVtrzzykUtnMLKdrX3Yprry7NpIJAC7cvo/SfalJUU9LSwxwudI/BGGue665",
      "ugaM5Kzfw5I+sljlnjdZ0lT60Ygw43O6JOjDeL1Z55/K488/YjpZJrdsKJ0pxxUz5prjpOENz9pXoS9uUb7Q0Hn3LFDZuC26mukLHCSJkUbQNUC8nvJV9ZE5",
      "1PK2nYzLGJwZeLhi5lTKiOzzdmVEFrVU0s9uzRTOqHthpYqprPYBuHs6ea9diK3qQ1bKZonewyZAVBaMmZANW++8nNpuuVll2VFQ2RDStjjEjYg1zw0Xl12c",
      "371wrPsK0ZKelpqqGCmiomuLHNcHmeUggOOwC+/berIxc67Yt6jNI6p95khUertOHXdfd7O0X+BSG3qY2rJRRxzyTwkiQMaLmC4HETfmGff8Fx7P9Hq189ki",
      "shghpaAG+Nj8WUeBrk3c55ubtWuKxaiGhtVzY4fX610jmZ8zRoYL92ftVkJpj9KLPkfRtaJz60G3ER3iPFqh55r+ZPNadPBaVZNLVyRw0cbWzRlt7C52cEXZ",
      "7+a74hYaT0aNLFZdMA18cMmXqZSc73gXNA+F/wAgj7JqIqKpytnxVrqyoe+aLLYC1uhlx0ZgBsVNKHTjtunNnzVlRDU0cMWn1mItJ2EDnv70Q2xBJTSVdRFU",
      "UUMQOI1UeDNmzj/7euZHQ2g2w209bQx12N7g6F1Rc9rL/Z9rQ4jbmWCtsy0XWZQMrm1MjI6hz5G0zhJK1n4L7xc4g3X5lYno47ds6WhfWNqQIYyGvLmuDmk6",
      "AWkX57xzK6e0qSndM2WYNdBGJZBcSWtPP8l5iezHt9Uq20lpVTXVIknbOW5V2FpweyCABefgUv2PaMtlWtJURO9er5hEAHEhkd4HcASqoT0n21Z2Qnn9aYIY",
      "DhfIbw0HYDoJ3Xq2irae0I2T0smUiIIvuIz3jmOdcW2KCCmoKajio64sgAfBLSjHk3t0Xtv+i6lmColoaZ9cx0VS6O+Rgecx71VA10EKvIjpP4yjJDpv4kYV",
      "iQ8q3cfooyX+4/vSmM5Qe8foPPuUlqFXkz1r/l5Iybutf8vJVJYkPKN3H6KMm7rn9zfJKWPyg967QeYfD4KpLUKvA/rXdwRgk608IVSWJDyrdx+ijBJ1v+KQ",
      "tkyg94NB/DuVSXIVeGXrG8P7owy9Yzg/dVJYkPKN3H6KLpemzgPmlIlyg9pmg/hPw+KqS1Crul6TO4+aPe7WdxVSVWjXQWbRS1VS7DFGLzdpJ5gPiloah9VT",
      "wzSwmnkewuMTnXloOi9YbboK2sNHJTineaabK5KUkNfmIGcA6NK59jSVTrWtGstGSla4ubSgxuIYSOYE6Te65MQpdOK3oKirdBS01XUBrywzRxe7BGn2jcEV",
      "9v0dBWtpZBK917RI6Nl7YsRubiPNesFkPksq1H2JG6OeFsbp4yD7UQv1XbdOYrkw46yx4IWhr6q1qwyyG/OGtfeSdgAaAqI4U93ulyK+3qOhtFlNIJXuzCR0",
      "bL2xYiA3Eea9dIulAvwMzfrPkvERY6yyqeJrQ+qtWrMshvzhrX3m/YAGgKiNU8PUWtblLZLmtmbNK9zS8shZiLWDS47AntC2KagpopXCSYzclHC3E+TNfmG5",
      "eZqZ3vp7blwB9XV1HqMLb84AFwA7yVcZxQ2jaE8zcRs6kjp4W387hzfEm4IrPPPg9/PPl6miq4q6jiqoCTFK3E28XFWHlG7j9FzrBppqCxKSmkj9tkYxe1zn",
      "OfFbi9+UHuzoPOPgmY1mJxahV439U7vCMo/qn9480UViQ8o3cfooyjuqf3jzSmR2UHun6Ds+HxTSWoVeUPVv+XmjK/7b+5FJYkPKN3H6KMr+h/clMoyg9h+g",
      "/h3JiEtQq8qOi/hKMs3ov4CipR0p5Ru4/RRlm7H8B8kplblBraD+E/BNSlq49vaaf/l9F1MszaeErk248PdBhOjFzbkTBhiiQiJCwXoFBQgoJHq+zdaRZ3rT",
      "Zml6enkS3oQhbAS/mDcmS/mdigZCEKIWSo/mNJ/z8FrWSo/mVJ/z8ENdHP5/41oQhTIS/mjcmS/m9iQZCEIIS/mjcUyX83sSDIQhBCX80bimS/m9iQZCEIKE",
      "p5UbimS/mjckGQhCChKeVG4pkv5o3JBkIQghIeVG4pkv5o3JBkIQgoSnlRuKZL+aNyQZCEIKEp5UbimS/mjckGQhCChKeVG4pkv5g3JBkIUIIWaWjppY3U8k",
      "EboZAS5haLiSbzm3rSl/NG5IZrPsyis2NzKKmZCHG92EZzvOkopbMoqOolnpqaOKWU3ve0ZytaFJCxU1m0VHWST01NHFLKCXuaM5zral/MG5SZm2ZRMr3Vza",
      "aMVThcZbs6JbMopq6Oslpo31MYubIRnC1qFIJTyg3FMl/MG5SMhChBCU8oNxTJfzBuSDIQoQQlPKDcUyX8wbkgyhSoUQlPKDcUyX8wblQDLi29ykG530XaXE",
      "t7loNxRJY40IjQsl30FCCgq3rRZ7sIfmcc/ML1nfoWqzNV+9a6eRLVlR0X8JRlW9F/AVYhaxlXlm7H8B8lGVblPxaOgfJWpfzOxOIuWZ+rhKMszae4qxCMSv",
      "LR9L5LLJIx9pRe0AI2F1+2/Nctyyf93/APY/+Ssb6e6/LxdNvejLxdY3vViFYwry8XWs4goy0WU5RmjpBWpLhldHMrEMrH1jOIKcpH0296nCNgRgb0R3KxIy",
      "jOm3vXm6l8lf6US0c9oVFDDHE0wMgeGGfpG+7PdouC9G+MFpDWtDrsxIvzrzlRQWpalXSw1lLS00VNI2V88b8RkuP4Rde2/nvTFWp4b7VoTLSRg2tU0dLA0u",
      "ldG+57/iXnOLlx3WjXD0EjmM8gq5XtjhlOZ7gX3NJ+JCvtizrTr7XEZo4JrMZc5jDPk2vd+u5pJAPMMy21dmVFZJZYmhp2shmys4i1cwOEC8Z86opS7Tbw0A",
      "m83ZyvI+ktoQU3pFDHU2rV0cIpi8tp3Z3OxXNAFxvvz9y9XkIuqZwheVdQ2uLUrnssqikdUYQyWaYGNjQLtW68857Ud12dCgtaWisCKptdz3SyPLYmhoMsgJ",
      "9kYW5i67Yr4/SGjfBBK5s0WVmdCWyNwujcAScWfNdcuQz0frrOlo3UsdPVmNjx7x2TbFI83l4bdoAzABVw+itXL9nw1sjHQRSSy1Lgc8jnHMLthH1Tkp6Cy7",
      "bpbUM4gErMjcTlWYMTTocPgblNFa9BX1D20tQ2UsaSSAQCL85BIuI3LiWjZNS2itGXIve6pqGB0cBvf6u24XN+JF+b4rHF6/acFsGkp5KWGGD1anpcQBv0k6",
      "bgbjdd2KxPVxWpRTQ08rJ2llS8shNxGM59HcVW22rPfaJoW1LTUA4cNxuxdHFddf8L71wKSzKuptSCX1WSko6SkLaWOQ3EPIuvNxzH4JLAsgH1aGpjtcOhdl",
      "ZGTYGwiTpAi4uz6M5VUWrx7FL+b2Jci3a/jd5pck3Kaz9HTKMS5CryQ6T+IqMkOm/iViWJfzexLkv9x/elyZynKP0bVJcoSZM9a/5eSjJu61/wAvJSWJfzOx",
      "Lk3dc/ub5JcD8pyrtGweSqS5QkwP613cFGB/WnhCqSxL+b2JcEnW/wCKXDJlOUGjoqpLkKvDL1jeH91GGXrGcH7qpLEv5vYlul6bOA+aW6XKazNHRPmqkuUJ",
      "LpekzuPmo97tZ3FVJYl/M7Evvf0fNL73KaGaNpVSXKEl8vRZxHyUXy9FnEfJVJYl/N7Et8vQZxnyS4pcpqN0dL9lUlyhJil6tvF+yjFJ1Y4lUliX8zsS45Or",
      "/wAkuN+U5M6NoTSXKEmN/VO7woyj+qf3jzRSWKipqIaRj56iRscTG3uc45gnyjuqf3jzXnvSJxktOiFVSVU1AwGR0cMZfjkGqCBzaSqk9FFIyWFkrDex7Q4E",
      "i7Md6w09uWdVVRp6eqbLKDcQxpI77rlz7Lq57YobSygnhilkfFCC0B8bQ0A/O9JZlomz7OqaCaANns2G8mPVe24kH4E3Zwqu6dZ1rULbSbZ5qWetu0R5991+",
      "i/4LX+Z2Lx1LEMNhQYXPq5pjXTvuznMST8wF6mpq208Ms7mPwxxlx9nZnTMVGrmcWGpgFSKczRicjEIi8YiNt2lEtTBDLHHLNHHJIbmNc8Au3DnXjoIgZLGq",
      "JGl1o1dT6zJJhzhmEm4fAAgKurwV9BJaErS6rrKxkdKS0kxsa/MG9xJV6dpW9rUVMFM1rqiaOEOOEGR4bedmdP8Amdi8ba0kNdHbNbVtL2U7TS0rHNNwddnO",
      "8kgdi9RROydLAyTEXtia117TpuzqiMUta4tu/eIf6SuvlmbTwlcW23h9RFd0dnxWZgwyxoRGhZL0CChBQVT9C12ZqP3rI/Qtdmakm9a6RLchCFoBL+YdyZKO",
      "UO4fVQMhCEELJ/3f/wBj/wCS1rJ/3f8A9j/5Ka6e7WhCFMhL+adyZKOVO4fVIMhCEEJfzTuTJRyp3D6pBkIQghL+adyZIOVO4fVIOoQhBC5dkWNDZUk5jlml",
      "fKS9zpX36STmGgLqJRyp3D6pgGUIQghL+adyZIOVO4fVIOoQhBCX807kyT807h9UgyEIQQl/NO5Ml/NO4fVIShCEEJfzDuTJByp3D6pB1CEIIS/mncmSfmHc",
      "EgyEIQQl/NO5Mk/MO4fVIMhCEEJfzDuTJByh3BIMhCEEJfzDuTJPzDuCQZCEIISaZCP0p0n5h3BIYDYtKbPhpAZWiElzJWPLZGuOk3jnN5TUVkUdFTzQxsc/",
      "L8s+Vxe6T+onSt6FFgs2yKWzC4wCRz3ANxyvLyGjQ0E6ANi0VELKmOWCUXxyRlrh8DmV6QcodwVzyOHNsuxWUMmVlqJKqVsYhjdIAMEY/CAPmedV2fYEVFUR",
      "yOqJJo4C71aJ4F0OI59Gk/ErsIVacZvo/EK90zp5HU5m9YFMQMOU6V+k7bl1/wAw7kyT8w7gpGXDt373F/R9V3Fwrd++x/0fUokssaERoWS9AoKlQUFW9abO",
      "fhY/M43nmF6zPWyzOSfvWukS05UdF/CUZVvRfwFWIWsZV5Zux/AfJKJm5Q62gfgPx+CuSjlHbh9U4i5Zn6uEoyzNp7irEIxK8tH0vkVmyrPtXFiF2Ruv/wCS",
      "2rJ/3f8A9j/5Kxvp7nqKuOGmllAMpYwuDGazrhoHxK4f8Wka1iWr2Qg/VekQrGHmv4wjGmxrY7KYH6qB6YQYyTZVri8AZ6X916ZIAMo7NzD6pxPPfxlSc9nW",
      "oN9N+6n+MqHnpLRG+mK9FhGwdyMDeiO5WJ57+M7N54a4b6ZyUemdlB5JFWBcNNO74/BeiybOg3uSiNmUd7DdA5t6sTg/xrYvPLON9O/yR/G9g89XIN8Enku/",
      "ko+rZwhGRi6tnCFYnA/jj0e//ULt8Mn/APqpb6aej5kJ+0W3XD8t/wAfgu4YITpij4Qk9VpzI6+GPQPwj4qxOSPTGwD/ANyj4HeSYel1gn/uUPcfJdQ0NKdN",
      "PFwBIbOojppYeAKxMA9KrDP/AHOn70D0msQyE/adNdcPx71tNlUB00cHAFX9j2cZHA0NOcw/LCsSoekdin/ulJ//AChMPSCxzotWi7Z2+aY2FZR02fTH/wBs",
      "JD6PWOdNmUp/9oKxHFu2SdFqUJ//AHDPNDbYswyG60aM5h+e34/FUn0asU/9rpf/AOMJP4YsUvcPs2muuH4ArE2i1KA6K6mP/vN80wtCjOirpz/7jfNc8+it",
      "iH/t0HClPolYZ/7fF3KxOoKymOiphP8AzCG1EBkN00ZzD8Q+K5J9D7DP+gZ3lV/wbYReR6i3QNDirE7wljOh7T2qQQdBvXnz6E2Cf9H/AP2O80h9BrBP+kf2",
      "Su81VCekSDlXbh9V53+BrDGiGYbpneagehVkYyA2oFwGid3mqo+U9Khec/guzBofVDdO7zUfwbQjRU1o3VDlVHynpEg5V24fVee/g+l5q60BuqHKP4ShxkC0",
      "7SFwGioKqhPSIXm/4SHNbNqjdUlH8KSc1v2wN1SVVHynpEg5R24fVee/haoGj0htbtnvUD0aqw8gekFp6BnMiqj5T0iF5z+HK8aPSG0O1wR/D9pjR6Q1naAV",
      "Uno0g5R24fVef+wrXGj0hqe1jSlFi20HnD6Qy33DTC0qpPSIXnPse3xo9IndtMwqPsr0kGj0ib20bFUnpEg5R24fVee+zPSYf9/iO+kaoFB6TB5utqnJuGml",
      "aqk9Ihec9S9KB/3WlO+nCPVfSkf9xojvgVSejSDlDuH1Xn8h6VD/AFlAd8R80oj9Kg83T2aTcNLHeaqT0iF5z/8AFo57KO9r/NGP0uH5dkHflPNVJ6NIOUO4",
      "fVefy3paNNNZJ3Of5pRUelQeb6OzSbhoe5VJ6RC87636UDTZ9Ad0rkeu+kw02ZRHdMVUnoUo5Q7h9V5/7Q9JRpsmlO6YqPtL0iDyfsaAm4aJ/wBlVKejQvO/",
      "avpCNNhxndUfso+17fH/AOXwd1SPJVSrejSDlDuH1Xn/ALat4afRwndVt8l2aeoL42PmjdFI5jS6O4uwnnF92e7aqpVtK4Nuffmf2x4ldrLM2nhK4VtODq9h",
      "GjJjxKzMGFEaERoWS9CoKlQUJW9bbM5F29YXrdZvIHetdKlsQhC0AlHKO3BMlGu7sUDIQhBCyD+bn+x/8lrWMfzg/wBn6qa6e7YhCFMhUzwR1UcsEzcUb2gO",
      "beReOxXJRrvu2BSeVsOwrPltK052RSMhinEUOCZ7cOEDEbwdp+S6EfpDlJ4jHSOdRSzmnjqMYve/PnDejeCL71tsqzvULLFK+TG9xc57wLsTnEkn5rmWTYFX",
      "TvpG11TC+CgBFPHE0i8nNjdfz3HQEgWHaNpV1rWhLLTCKiZIIrpJgTGWjPcACDeTtWmk9I6GqrnRRiYMLXFk747o5MOthPPcscdi2rDYdZQtqqZxkD8BaxzX",
      "PLnXkudfm5xmCxVFiWtXGRxZBSMZRuggp2SXhl92l13OAebMo93fhtylmgoZAJR684thaW5zcCbyL9Fw+YVcPpDSTCmaxkxnnkdGIA0F7C03OLs+YDasFJZd",
      "ofazLRqYI2impTHTUrJLwx2i6+7SQNPx+Caw7IraC15a6qEMslczFOWADIuBzAbRdm3i9OWOz0iQco7cEyUco7sQjIQhBCQco7cEyUco7sSDIQhBCQco7cE6",
      "Qco7sSDIQhBQlHKO3BMlHKO7EgyEIQQkHKO3BMlHKO7EgyEIQQkHKO3BMlHKO7EgyEIQUJRyjtwTJRyjuxIUWhVPpKfKRUs1U8uDRHFdfn5zecwWaybVNoSV",
      "MMtM+mqKZwEkbnh4F4vGcZk1syxMoJGSWiLPLhmmxNBG69c/0PL/AFGdpiGRbKclUYHMNQOmQ4k3/FUd1PZ2K+pdSUj5mQS1Dm6Iohe5xXPsy15aqariq6GS",
      "lqqdrXOhDxJe03kXEaT8E9uW3BY8LMpc6eUkRRlwaCdpccwHxWT0cMAbWVklbDVVUpD6iSJ17GAA3NB2AKjiTLTSW/DUVsVK+kraaSYHJ+sQlgdcLypit6Co",
      "q3QUtNV1Aa8sM0cXuwRp9okBZLKeytqZLarHBkcvuaRrzdhZfp3uP0UWO77LtZ1iMe2aARmaNw1ogXartunMU0HoFyTb1GLY9RAlc4uEeVDPdh9xODFtW60Z",
      "zTWdUztzujic4bwF5Whha42HRRe25gFdUP057ibz8SXfJEKeHdr7fo6GtbTSCV7r25R0bL2xYjcMR5r01rW5S2U5rZmzSvLS8shZiLWDS47AvNw/9ZY0ELfb",
      "q7WrTLIedrGvvJ3ANAVlTNjprcmAx1dXUeows57gLgPmSqvPx/Z7vYRvbJG17De1wBB2goHKO3BJSw+r0sMIN4jYG9wuTjlHdip/YRwZUVdXT0UBmqpmQxjN",
      "ie64K9ZLTbM6if6tTw1E4zsZMbm37dCCKC0aO0onSUVQyZjTcS3mPxCeoqIaWOWeokbFExoLnuNwC4/os9srq+SXKfaJlDarEAAHAZg24kXAfG9dO0Z6Onpp",
      "ZLQMeQbcSJACCebNzlM4ILQ2xQWhTyz0lS2WOLXIBBb2EXqqit6zK+obBS1bXyuBLW4SL7tl4zqiw4ZpaqstWpiMHrWERxOzFrG6C74m9JZ3/q1pvtN5/wCm",
      "hxQ0g28zn9ugfAK7psdblmitNJ6011QDcWMaXEHsC3DlHbguHYeKyqs2LMGucQ6eKZv5jS7PiHM7P2rr1EzaaCed2rGwuPYCVcRZ70Y1MAqRTmaMTkYhEXjE",
      "Rtu0olqYIZY45Zo45JDcxrngF24c68hBTAyWLUSAOtGsqPWZJOcMwk3bgCAq6tja+z32jKA6rraxkVLfpjY1+YDZoJKa2hb2U9TBTNa6omjhDjhBkeG3nZnT",
      "jlHbgvIWtkq6K2q2raJI6ZppaZjs9z7s5HxJIHYvUULHx0sLJDe9sTA6/bciOFPLSvP23/MB/QPEr0C89bX8x/4BEmFEaERoWS9AgoQUJU/Qtlnvwwarjn5h",
      "esb9C32b927VrpUr8qOi/hKMs3ov4CrELWMq8s3Y/gPklEzcbtbm/AfJXJW67lYi5Zn6uEoyzNp7irEKxK8vH0vksscjHWnLIXABjAwfG/OtyyU/8wrP+Hgr",
      "G+niV+Xi6be9GXi6xnerEKxhXl4utZxBQ2aLG73jOb8QVqRoGN+bYrEMrH1jOIKcrH0296nCNg7kYG9EdysSMozpt70rXtxu9oc3OmybOg3uSNjZjd7De5WJ",
      "ZiG0d6LxtS5KPq2cIUZGLq2cIViOlbru7EuQh6pnCErYYsbvdt7lYlyFXkIug3uUZCPoBWJYlbru7EuQj6PzSiFmN2Y95ViXIVeRZ+riKMiz9fGfNWI6Vuu7",
      "sS5Fu1/G7zStibjd7T+MqxLlCTJDpP4ioyQ6b+JWJYlGu7sS5L/cf3pWxnG73j+9SXIVeTPWv+Xkoybutf8ALyUliVuu7sS5N3XP7m+SUMdjd713cPJVJchV",
      "4H9a7uCMEnWnhCqR0rdd3YlwSdb/AIpWtkxu94OFVJcoSYZesbw/uowy9Yzg/dVJYlGu7sS3S9NnAfNK0S43e0zhPmqkJKWnllEskET5G5g9zASO1WpLpdrO",
      "4+aj3u1ncVUhNTw1GHLQxy4Te3G0G4/C9LJDHNHLDIwOie3C5p0EXaE3vf0fNKMrjdmZ3lVIS0sE1KaaWFj4C3Dky32btlyps+zKKzWOZRU7IQ43uwjOd50r",
      "RfL0WcR8kXy9BnEfJSM4BwIcAQcxBWSgs6js8yto6eOEPILsA0rRfL0GcZ8kodLjd7DeL9k0lVNZlFR1Es9NTRxSym972jOUNsyiZXurW00YqnC4y3Z1fik6",
      "scX7IxSdWOJFI6Ua7uxLjk6v/IJQ9+J3uz3hNJcsVdZ7a5wylTVRx3XGOGTAHbyM/wA1pxv6p3eFGUd1T+8eaKVkoqKmoIBDSQtijGe5o0naTzn4rHadj01q",
      "zRPnfMx8BxMdFIWkXrflHdU/vHmlEhxu90/5eadTPHZdNHTTQNM107S17nzOe45tpJTSWbSyWe2iMeGBgAYGEtLbtBBGcELRlD1b/l5oyv8Atv7kVKYrOsim",
      "s+WSZhlmqJBc6aeQveRsvPMtU8LKmKeCUXskbgcPgQmyv6H9yUSjG72X8KatWwWZYrKGQSy1ElVK2MQxukAGCMfhAHzPOq7PsCKjqI5HTyTRwF3q8TwLocWn",
      "RpPxK6uVHRfwlRlW9F/AVasctvo/EK90zp5HU5m9YFMQMOU6V+k7bl1hru7EuWbsfwHySiVuN2twlVSly87bP8yP9IXeyzNp4SvP2u4OtFxGjCFmYMKo0IjQ",
      "sl6FBQoKErfoXQs37qN5XOfoXRs37qN5WoUtSEISAlbrv3/RMlbrP3/RIMhCEELJT/zCs/4eC1rJT/zCs/4eCmunifO7WhCFMhK3Xfv+iZK3Wfv+iQZCEIIS",
      "t137/omSt1n7/okGUIQghK3Xfv8AomSt1n7/AKJBlCEIISt137/omSt1n7/okGUKVCCErdd+/wCiZK3Wfv8AokJQhCCErdd+/wCiZK3Wfv8AokGUIQghK3Xf",
      "v+iZI3Wfv+iQdQhCCErdd+/6JkrdZ+/6JCUIQghK3Xfv+iZK3Wfv+iQlCEIISt1370yRus/f9EgyEIQQlbrv3pkjdZ+/6JBkIQghK3XdvTJW6z9/0SEoQhBC",
      "Ruu7enSN1n7/AKJBkIQghK3XdvTJG6z9/wBEgyEIQQlbru3pkjdZ+/6JBl5u1/5m/cPBekXmrX/mkm4eARJgkaFEaFkvRKCpUFBVP0LdZ78NMBhcc50C9YX6",
      "F0bO+6jeVrpZldlR0X8JRlm9F/AVYhawK8s3Y/gd5JWzNxO1tPQOwfBXJWaX7/orEXLM/VwlGWZtPcVYhWJXl4+l8llp5WCvqyXC44Lu5blkpv5hWf8ADwVj",
      "fTxPneF+Xi6be9GXi6xnerEKxhXl4utZxBQ2aLE/3jNPSGwK1IwC9+bn+gViGVj6xnEFOVj6be9ThGwdyMDeiO5WJGUZ0296Vj24n+0NO34BNk2dBvckbGwl",
      "/sN07PgrEfENo71N42pMlH1bOEKMjF1bOEKxLErdZ+/6BLkIuqZwhK2GK93u26dnwViWoVeQi6De5GQj6AViWJG6z9/0CjIx9H5lK2Fl7sx07TsViWoVeRZ+",
      "riKMiz9fGfNWJYkbrP3/AECjIt2v43eaVsTb3e0/T0zsViWoVeSHSfxFGS/W/iViWJG6z9/0CjJf7j+9K2M3u94/Tt+CktQq8metf8vJGTd1r/l5KpLEjdZ+",
      "/wCgUZN3XP7m+SVrH3u967TsGzcpLUKvA/rXdwRgk608IVSWJG6z9/0CjBJ1v+KVrZL3e8Gno/BVJahV4Zesbw/ujDL1jOD91UliRus/f9Aoul6bOA+aVolv",
      "d7TNPROzeqktQq7pdrO4+aPe7WdxVSWJG6z9/wBAo97+j5pW5W92ZmnadiqS1Crvl6LOI+SL5egziPkqksSN1n7/AKBRfL0GcZ8krXSXu9hunpfDcqktQq8U",
      "nVji/ZGKTqxxKpLEjdZ+/wCgUY5Or/yCVr33u92dO0bFUlqFXjf1Tu8eaMo7qn9481UliRus/f8AQKMo7qn9480rZDe73b9Pw2b00lqFXlD1b/l5oyv+2/uR",
      "SWJG6z9/0CjK/of3JWyi93sv09H4JpLUKvKjov4SjKt2P4CipSxI3Wfv+gUZZux/AfJK2Vt7tbT0TsTUpavM2t/NZv8Aj4BeiyzNp4SvN2m4OtSYjRm8AsyY",
      "RGhRGhZL0agoQUFU9dKz/urVzH6F1KD7q1a6RLQhCEgJWaXb0yVn4t6QZCEIIWSm/mFZ/wAPBa1jpf5hWb2eCmunifO8NiEssrIYnSSvaxjRe5zjcAF4eyLY",
      "hqPSuKs9ayhrRJHkWEuybQRgvA0X3E9qYi5pici3ukrNLt64NZ6TCnmq4YqN881O8gMa8DE0NDnOJOgC+5TQ+ksVXaMUMVNJ6tO1zm1JIALmgEi74bdqo4Tv",
      "oXl6O36akiilyE4ZXCSpDTJjIOINAaP1E5h8Vsh9I2fZc9VVUssE0M2QNOCHuc/Nc1pGkm8KpO4kZpdvXnqj0mkgsuulqaCanqqb2cDPegEtvaSRmHxvWmnt",
      "r1axo6q04JoZ3lrMlgBfK8gZmtBPzuVSdpCyWbaEVpUpmiZLHhcWPjlbhcxw0ghc30rM5p6KGkqJqepmqmMY6J5Gb8V45xcDpUndSM0u3rj2ZXVkFovsu1Hs",
      "lmbHlYqhjcIlZfcbxzEFU01uU9PRioMlVVmsme6ngbGHSXDSABzC7Sdqk9AheVti2aaWosKoY94hfI+a7CcZuaRhu5zebrl0WeklGaKSeWKoheyXI+rvj96X",
      "3XgBo0kgqpOykZpdvXAr/Sykp7INUwObUF5jZTTNLX4gQCCBfovWupt2jpaAVD5CwykiJj43hzjd0bsV3xuV2TrIWCxsq6zo5Z6xtY6X3gkY3C0A8wGwfHOt",
      "6pikEjNLt6qr5HQ0FRIyQRuZG5weReG3DTcvMWLbFfJU0Mbq2GvdUjFPEyENdTi6+8kG7YLiFRqnHrkLzVX9sx27TUcNrgtna+Qg0rfdtF12/OblotSutCj9",
      "Ro45af1ipcWmqkjLY2kc2G8+0ebPzKLupGaXb1XRxzxUzWVNQKiUaZAwMv7As9o2jDZlI+eUOcS/DHGwXukcdDQNqg3IWCypbSmY99pU0FPfcWMjkLnAbHZr",
      "r9yvZXUkjJXx1UD2xco5sgIZv2KTQkZpdvSiohMuSE0Zkw48GIX4dt2xVRVtK5ge2phcx7yGuDwQ4gZwO4qTShYZbWomWdNWx1MMsMQN7mSAgkDRftU0NqUt",
      "dZ7ayOaIR4Q5/vAcmbr7nHmIUWxKzS7eohmiqImywSMljdqvY4OB7QsloVktHBip6OWslfJhbHHcM+0k5gPioNyFz7HtM2lBKZKd1NUQSGOWIuDsLhnzEadK",
      "6CkEjNLt6ZKzS7epGQhCChK3S7emSs0u3pBkIQgoSs0u3pkrNLt6QZCEIKErNLt6ZKzS7ekGQhQghK3S7emSs0u3pBkIUIISs0u3pkrNLt6QZCEKKErdLt6Z",
      "KzS7eoGXl7T/AJpPvHgF6heWtL+aT/1fREmERoURoWS9GoKlQUFVJoXSo5MNMwYXHNzBc2RdWi+6s3LXSzJ8qOi/hKMs3ov4CrELWBXlm7H8DvJKyZnta2no",
      "HyVyVmg7yrEXLM/VwlGWj2nuKsQrEry8fS+Sy0crMtUyOcA50mHsGhblks//AFP9930VjccSz25TMtSypaNs0bMrcHOcL7heL7vjdoSPoKZtXZ0kEkUUVFiA",
      "YM14Lbl1kKuGHl2WCGUFptFdE6stB7scx0NYTqgbr+1WS2K0gspaiGGKKkdT04v1S7WcewD5r0iRgFzs3OU5S1w4bCp2WzT1jp2PipadsNPDzNI/EVSbFqI6",
      "akfT1lMayGd87zK0uY9777zcCDmvzL0mEbB3KMDeiO5Vp5Sew6qCzZ2RzMrpp6xk82N4YZGi69uwZx3LRVwWrLaFLWx09I+Rkb2CN05wwvcR7d93tZs3MvRZ",
      "NnQb3JGRsN/sN0nmVcefhOf6PUU1nWWIaqUSVDpHve8HWJcTeqLZp7QktigqaGCGdkLJBdLLgDHuuAccxJzX6F2clH1bOEKMjF1bOEIy7TjGyKmOlrKkzCpt",
      "aeExiQ+y1g5mtHMB81z22NaVHUPZZ7IHNNM2njqHvuMAA9r2bs5Jz6V6jIRdUzhCVkMWf3bdJ5k4nlYLGtOgraGpZSQ1gpaRsMbXTYS15zudo7FY2xbTpK6G",
      "sjZT1dS8PdIXvLGxSuu9oC7OA0XXae9eoyEXQb3IyEfQCrTyhs+uoKSzIqiCatDauSoqDCAS515LcxIzXkH4XIrqapdb76yWO048cLWQmjax2DpNcSCAb7s/",
      "zXqsjH0fmUrIWG/MdJ5yrESzaSOhoIaeFr2sY3Q917rznN523lTHRxRVs1UzEJJmtD/aNxu0ZlZkWfq4ijIs2v4z5qTlelJqHWNJBT0802WuY8wtDi1t4vzX",
      "3nNfoXLsqz5JLWhqKGzH2TRxEl7nOwvnzXYTGDcBz3leoyLdr+N3mlZE3P7T9J/GVRUKdYaalmd6R1lZMwtjbEyGEnnGs4993csts1Ms0FTQVFjVNUJLxE6L",
      "CWO2EuJGEgrtZIdJ/EUZL9b+JGG+7PZMNTBZVLFWPylQyMCR199538641sSNpPSKira1kpoYWPDXsYXhkhuzkC86NC9Bkv8Acf3pWRnP7x+k86e9iOKcK2rR",
      "lrPRyqlp6eqgiLmsL3swucwkBzg3TddtC5FaDNQ2hU2bRyCkkgjoqdrGFpl9rO67ZnuvK9tkz1r/AJeSMm7rX/LyVieNksJ77Uoad14kMTpa6do0tNwEYOzN",
      "ddsXPw0IkoIKqN0dLJNNVinjjJLgThY0NG1fQcm7rn9zfJYqez3MtOprTO5zpWtjAwj2QL/qUp5m0LObBYk8lVRsgZW1bHZJseL1ZmYX3AG43DPdtWy16iml",
      "qKCKWmn+zAwyNhbTu9/IDc1hbd257l6fA/rXdwRgk608IQnI9E4pI7Ic+aAU75Z5HmIC4M9oi75JLbt+KzXilidF67LeWZZ4ZGwaMTnHm+AzldnBJ1v+KodS",
      "MlkEkjYnvaThc6MEjcVcpk9G4aaKzT6vVNq3veXzTjQ950ncusq8MvWN4f3Rhl6bOD91SjpWfi3pbpemzgPmlYJc/tM09E+aKS5Qkul2s7j5o97tZ3FVI6Vn",
      "4t6X3v6PmlZlc+ZmnaU0lyhJfL0WcR8kXy9BnEfJFI6Vn4t6W+XoM4z5JWOlz+w3T0v2VSXKEmKTqxxfsjFJ1Y4lUjpWfi3pccnV/wCQSse/P7s6doTSXKEm",
      "N/VO7x5oyjuqf3jzRSOlZ+Lelyjuqf3jzSskOf3b9Pw800lyhJlD1b+4Iyv+2/uRSOlZ+Lelyv6H9yVsoz+y/T0U0lyhJlR0X8JRlW7H8BRUo6Vn4t6XLN2P",
      "4D5JWytz62nolNSly8raH8zn/qXpsszaeEry9cb7RnP6lmYMJjQojQsl6RQVKgoKmRdai+6R7lyZF1qL7pHuWoEr0IQkBKzQd5TJY9B3nxSDIQhBCyWf/qf7",
      "7votayWf/qf77vopqPbLWhCFMhKzQd5TJWap3nxSDKFKhBCVmg7ymSx6DvPikGUKVCCErNB3lMlZoO8+KQZQpUIISs0HeUyVmg7z4pBlCEIISs0HeUyWPQd5",
      "8UgyhCEEJWaDvKZKzQd58UgyhSoQQlZoO8pkrNB3nxSEoQhBCVmg7ymSs0HefFIMoQhBCVmg7ymSM0HefFIMhCEEJWaDvKZKzQd58UhKEIQQlZoO8pkrNB3n",
      "xSDKEIQQlZoO8pkjNB3nxSDIQhBCVmg7ymSM0HefFIMhCFEJWaDvKZKzQd58VBKEIUQlZoO8pkjNB3nxUDLydb/Maj+sr1i8lWfzGo/uO8USYMxCGIWS9IoK",
      "lKUFVIupSSBtLGMLzcOZq5Ui7FJ91j3LXSzJsqOi/hKMs3ov4CrELWBXlm7H8DvJKyZgb+LSfwHbuVyWPV7T4qxFyzP1cJRl49p7irEKxK8vH0vkstDKxvrF",
      "7gL53EfJblks/RU/33fRWNx7ZX5eLrG96MvF1jO9WIVjCvLw9aziCVk0WHlGaT+IbVckjAw6Oc+KsSMrH1jOIKcqzpt71OFuwdyMDeiO5WJGUZ0296WN7cJ9",
      "oaTz/FNk2dBvckZGwt1G6TzfFWI+IbR3qbxtSZKPq2cIRkYurZwhWI6SPVO8+KjIRdUzhCVkMRbybdJ5virEuUKvIRdBvcjIR9AKxLEjNU7z4qMhH0fmUrIW",
      "Fug6TznarEtQq8iz9XEUZFm1/GfNWJYlj1TvPilyLdr+N3mlZE3DrP0n8Z2qxLUKvJDpP4ijJfrfxKxLEkeqd58VGS/3H96VkZw8o/Sef4pS1CryZ61/y8kZ",
      "N3Wv+XkhLEjNU7z4qMm7rn9zfJKxj8PKu0nmG3cqktQq8D+tPcEYH9aeEKpLErNU7z4pcEnWf4pWNkw5pBpP4fiqktQq8MvWN4f3Rhl6xnB+6qSxIzVO8+Ki",
      "6Xps4D5pWCXDmczSfwnbvTSWoVfvdrO4+aPe7WdxRSWJGap3nxUe9/R80rMrhzBmk852qpLUKu+Xos4j5Ivl6DOI+SqSxIzVO8+Ki+XoM4z5JWOkw6jdJ/F8",
      "dyqS1CrxSdWOL9kYpOrHEqksSM1TvPioxydX/kErHvw8mdJ5xtTSWoVeN/VO7x5oyjuqf3jzRSWJGap3nxUZR3VP7x5pWSHDyb9J2bd6aS1Cryh6t/cEZX/b",
      "f3IpLEjNU7z4qMr+h/clZKMOq/Sfw/FNJahV5UdF/CUZVux/AUVKWJGap3nxUZZux/AfJKyVuH8Wk/hO1NSlq8hVH/1Co/uu8V6vLM2nhK8nUG+unO2R3isz",
      "BhYxCGIWS9KlKlQUFTJoXZpvu7Ny40i7VPyDNy1AlYhCEgJY9TtPimSx6gSDIQhBCx2doqf77votix2dq1H9930U1HtlsQhCmQkj1O0+KdJHqBIMhCEEJI9T",
      "tPinSR6gSDIQhBCSPU7T4p0keoEgyEIQQkj1O0+KZLHqBIMhCEEJI9XtPinSR6g7UgyEIQQkj1O0+KdJHqBIMhCEEJI9XtPimSx6gSDIQhBCSPV7T4pkseok",
      "GQhCChLHqdp8UyWPUCQZCEIKEser2nxTJY9TvSDIQhBCSPV7T4pkseokGQhCChKzV7T4pkseokGQhCChKzV7T4pksep3pBkIQooSs1e0+KZLHqd6gZCFCiEr",
      "NXtPimSs1O9QMvHTn/rJ/wC47xXsV4yU/wDVzf1nxRJhcxChiFkvTKCpUFBUyLrwyARNGF+jmauPIu5DyTdy10syjLDov4CjLN6L+AqxC1gV5Zux/A7ySxzM",
      "DBrcB8lclj5MKxFyzP1cJRl49p7irEKxK8vH0vkstmyxilxucA6Rxe4bDf8AstyyWV/Lou3xKsbj2z58r8vF1je9GXi6xnerEKxhXl4etZxBLHNFgHvGcQVq",
      "SMDJjMrEMrH1jOIIyjOm3vTYRsHcowN6I7lYhlGdJveljc3APaHepybOg3uSxxsLBexvcrEfENoReNqXJR9WzhCjIxdWzhCsSxJHqBLkIuqZwhKyGIsHu29y",
      "sS5CryEXQajIR9AKxHSx6gS5GPo/MpWQsLBmPeVYlyFXkWfq4ijIs2v4z5qxHSx6gS5Fu1/GfNKyIYB7T+MqxLkKvJDpP4ijJfrfxKxHSx6gS5L/AHH96VkZ",
      "wD3j+9SXIVeTPWv+XkjJu61/y8lI6WPUCXJu65/c3ySsY/APeu7h5KpLkKvA/rT3BGCTrTwhVI6WPUCXDJ1n+KVjZMAukHCpLlCTDL1jeH90YZemzg/dVI6W",
      "PUCW6Xps4D5pWCXALnM4T5ppLkKv3u1ncUe92s+aKR0seoEvvf0fNKzK4BcGd5VSXIVd8vRZxHyRfL0GcR8lUjpY9QJcUvQZxnySsdJgHsN4v2TSXKEmKTqx",
      "xfsjFJ1Y4kUjpY9QJccnV/5BKx78A92e8JpLlCTG/qnd480ZR3VP7x5opHSx6gS5R3VP+XmlZIcA92/5eaaS5Qkyh6t/cEZX/bf3IpHSx6gS5X9D+5KyUBg9",
      "l/CU0lyhJlR0X8JRlW7H8BRUo6WPUCXLN2P4D5JWStDBrcJTUpcvFyfeZP6z4r2GWZtPCV453Lv/AKj4rMmF7EKGIWS9OlKZKUJTIu7FyTdy4Umhd2Pk27lq",
      "BJkIQlBLHybdyZLHybdyQZCEIIWSyv5dF2+JWtZLL/l0Xb4lTUe2fr+2tQpUKZCWPk27kyWPk27kgyhSoQQlj5Nu5Mlj5Nu5IMhChBCWPk27kyWPk27kgyhS",
      "oQQlj5Nu5Mlj5Nu5IMoUqEEJY+TbuTJY+TbuSDKFKhBCWPk27kyWPk27kgyhCEEJY+TbuTJY+TbuSDKFKhBCWPk27kyWPk27kgyhCEEJY+TbuTJY+TbuSDKE",
      "IQQlj5Nu5Mlj5Nu5IMoQhBCWPk27kyWPk27khKEIQQlj5Nu5Mlj5Nu5IShCFEJY+TbuTJY+TbuUDKEIUQlj1G7kySPk27lAyEIUQlj1BuTJY+TbuUErxN/vX",
      "byvbLxDT7Z3okw0s0IUMQsl6hKVKUoKmRdqOUCNvsP0D8K4z9IXdj5Nu4LfSzJcsOi/gKMs3ov4CrEJwK8s3Y/gd5JY5mCNo9rQPwHyVx0JY+TbuCsRcsz9X",
      "CUZePae4qxCsSvLx9L5LLZsrG0EQc4A5/ErcdCyWX/Lou3xKsbj2z9f2uy8XWN70ZeLrGd6sQrGFeXi61nEFEc0WTaMozQPxBWHQlYBk25uYKxDKx9Y3vRlG",
      "dNvepwt2DuRgb0R3KxIyjOk3vSxubk2+0NA50xYy7Ub3JGRsybb2N0DmViWYhtCLxtSZKPq2cIRkYurZwhWI6WPk2bglMEV3JM4QlZDFgb7tujYrEtQq8hF0",
      "AjIR9AKxLEsfJt3BKYY7tX5lKyFmBuY6NpViWoVeRZ+riKMiza/jPmrEsSx8m3cEphbtfxnzSsiGBvtP0dMqxLlCryQ6T+IoyX638SsSxLHybdwSmLNyj+9K",
      "yM4G+8fo2qS1CryZ61/y8kZN3Wv+XkqksSx8m3cEpjd1z+4eSVjH5NvvXaBzDyVSWoVeB/WnuCMEnWnhCksSR8m3cFGGTrP8UrGyYG3SDR0VUlqFXhl6xvD+",
      "6MMvTZwfuqksSR8m3cFF0vTZwHzSsEuBtzmaOifNNJahV3S7WdxR73az5opLEsfJt3BL739HzSsyuBuZmgc5TSWoVd8vRZxHyRfL0GcR8kUliSPk27goxS9B",
      "nGfJKx0mBvsN0dL9k0lqFXik6scX7IxSdX/kiksSR8m3cFGOTq/8glY9+Bvuzo2hNJahV439U7vHmjKO6p/ePNFJYlj5Nu4Jco7qn/LzSskIY33b9A2eaaS1",
      "Cryh6t/cEZX/AG39yKSxJHybdwUZX9D+5KyUBjfZfo6JTSWoVeVHRfwlGVbsfwFFSliSPk27goyzdj+A+SVkrQxuto6JTUpavDRnOvamZlxznhK8VGsyYaWI",
      "QxCyXp1BQoKCrdrDeu6zUbuXCOu3eF3majdy1DMpQhCUg6CoZqN3KXap3IZqN3JCUIQgoOgrJZf8ui7fErW7VO5ZLL/l0Xb4lTUe2fr+2tCEKZQdBUM1G7lL",
      "tU7lDNRu5IShCEFB0FQzk27lLtU7lDNRu5IShCEFB0FQzUbuUu1TuUM1G7khKEIQUHQVDNRu5S7VO5QzUbuSEoQhBQdBUM1G7lLtU7lDdRu5IShCEFB0FQzU",
      "buUu1SoZqN3JCUIQgoOgqGajdyl2qVDNRu5IShCEFB0FQzUbuUu1TuUN1G7khKEIQUHQVDNRu5S7VKhmo3ckJQhCCg6CoZqN3KXapUM1G7khKEIQUHQVDNRu",
      "5SdBUM1G7khKEIQUHQVDNRu5S7QVDNRu5IShCFFB0FQzUbuUu0FQzUbuUEoQhRQdChmo3cpOgqGajdyglCEKKDoKhmo3cpOgqGajdygh+aN25eHjXt5uRf8A",
      "0leIjRJhpYhDELJemUFCgoJPzG7wu22UYR7D9HRXEHLM/qC77dUbluGZJlh0X8BRlm9F/AVYhOBU6ZuE5n6Og7yQ2ZmEa2joHyVj9R25DdUblYiZZn6uEoy8",
      "e09xViFYmeeoY2CRzSC4NJAIOxV0L4oqKJuP8N5v2nOrqv7nP/bd4IpPucH9tvgrG/0py8XWN70ZeLrGd6sQrGFTp4sJulZo6QQ2aLCPeM0dIJ36jtyABhGb",
      "mViLlY+sZ3oyjOm3vTYW7B3KMDeiO5WJDnswn2m6NqGubhHtDRtUPYzA72G6NiBFHhHsN7lYjYhtCLxtS5KPq2cIUZGLq2cIViM7VO5DdUblW+CIMPumaOiF",
      "IgiuHu29ysSxCryEXQajIR9EKxGdqnchuqNyrdDGGH2ebaVIhZcMx4irEsQq8iz9XEUZFm1/GfNWIztU7kN1RuVb4mhhzv0dM+akRC4e0/jKsSxCryQ6T+Io",
      "yX638SsRnap3Ibqjcq3Reyfbfo2oEZuHvH94UlqFXkz1r/l5Iybutf8ALyUjO1TuQ3VG5VuY7Cfev0bB5KQx+Ee9d3DyVSWIVeB/WnuCMEnWnhCqRnap3Ibq",
      "jcq3Nkwn3nN0UBslw94OFKWoVeGXrG8P7oul6bOD90UjO1TuQ3VG5VuEuE+2zR0D5oAlwj2mcJ800lqFXdLtZ3FHvdrPmikZ2qdyG6o3Kt2VwnU0fFSMrcMz",
      "O8ppLFCS+Xos4j5Ivl6DOI+SKRnap3Ibqjcq3Olwn2GaOmfJAdLcPYbxfsmktQq8UnVjiRik6v8AyRSM7VO5DdUblW578J93zdIID33D3R7wmktQq8b+qd3j",
      "zRlHdU/vHmikZ2qdyG6o3Kt0jsJ90/R8PNSJDhHun/LzTSWKEmUPVv7gjKf7b+5FIztU7kN1RuVbpfZPsP0bECUXD2X8JTSWqEmVHRfwlGVbsfwHyRUoztU7",
      "kN1RuVbpW4Tmfo6B8kCVmEa3CU1KTPmp5P6T4LxEa9nUysNNKATfgPMdi8ZGsyYaWIUMQsl6ZQUKCglbyzP6gvQjQF51vLR/1DxXolqGZCEISiv5N24phoCW",
      "Tk3bim5kgIQoQVVX9zn/ALbvBFJ9zh/tt8EVf3Ob+27wUUn3OD+23wU1+lchChTKH8m7cVI0BLJybtxTJAQhCCV+o7cUDQFEnJu3FNzJAUKVCCh/Ju3IGgKJ",
      "OTduKbmSAhChBQ/UduUjQEsnJu3FMkBCFCCh+o7cgaAok5N24phoSAoUqEFD9R25A0BRJybtxTcyQFClQgofqO3IGgKJOTduKnmSEqEIQUP1HbkDQFEnJu3F",
      "MNCQFCEIKH6jtyBoCiTk3bip5khKhSoQUP1HbkDQFEnJu3FTzJAQhCCV+o7cpGgKJOTduKkaEhKhCFFD9R25A0BRJybtxUjQoJUIQgofqO3IGgKH8m7cVI0J",
      "AQhCiV+o7cpGgKH8m7cpGhQCEIUUP1HbkDQFEmo7cpGhQVVmain/ALbvBeJjXtK7NQVH9t3gvFRokw0t0IQ1CC9KoKhQVkobyzP6gu/lR0H8K4EWeoj/AKgv",
      "RrccMyryw6L+Aoyzei/gKsQnApkmaY3Zn6D+A+SbLM/VwHyTScm7cmViV5dm13CVGXj2nuKsQrEzVUzDSTAOzlh5vgilmjFJCC8AhjfBPWfc5v6D4IpPucP9",
      "tvgrG/0my8XWN71GXi6xnerEKxhTJPEY3ASsvuP4gmy0XWM4gml5N25TcNgViLlY+sb3oyjOm3vU4W7B3IwN6I7lYiSPbk3e03QedNjb0h3pZGMybvZbo2Kc",
      "lH0G9ysRsQ2hF4SZKPq2cIRkYurZwhWJMnJu3FMqZIYhG66NmjohNkIurb3KxLFCryEXQCMhH0QrEaTk3bimVMkMYjdc3m2psizYeIqxLFCTIs/VxFRkWbX8",
      "Z81YjScm7cUypkiaI3Z36OmfNNkm9J/GVYjoVeSHSfxFGS/W/iViNJybtxTKmSO6N3tv0bU2SPWP7wpHQq8metf8vJGTd1r/AJeSkaTk3bimVMjHZN3vX6Ng",
      "8k2B/Wu7h5KR0JMD+tPcFGCTrTwhVI0nJu3FMqZGyZN3vObopsMnWDhVSOhJhl6xvD+6i6Xps4P3UjScm7cUypkEuTde9mjonzTXS9JnCfNNI6FX73azuKPe",
      "/o+aKRpOTduKlVSZXJuvwaPim97sZ3lNI6El8vRZxHyUXy9BnEfJFI0nJu3FMqZDLk3XsZo6f7JsUvVt4v2TSOhV4pOrHEjFJ1f+SKRpOTduKZUyPfk3e75t",
      "qbG/qj3hNI6FXjf1Tu8eaMo7qn9480UjScm7cVKqkkdgd7p4zfDzTZQ9U/5eaaR0JMoerf3BRlf9t/cikaTk3bipVT5Pdu9h+jYmyo6L+EppHQkyo6L+AqMq",
      "3Y/gKKlGk5N24qVU+Vpjdmfo6B8k2WZ+rhKalKrQ/l1T/ad4FeLjXsLRlabOqQL7zE7mOxeOjWZMNLUKGoQXpFBQoKyRBnqo/wCpekXm6b73FvXpFuOGZCEI",
      "Uiycm7cmSycmVKQEIQgqaz7nN/QfBFJ9zg/tt8FFb9ym/oPgppPucP8Abb4Ka/StQhCmSycm7cmSScmU6QhCEIJZOTduUqJNQqUgIQhBLJybtyZLJyZUpAQh",
      "CCWTk3bkySTkymSAhCEEsnJu3KUsmoUyQEIQglk5N25Slk5MpkgIQhBLJybtylLJqFMkBCEIJZOTduUpZNQpkgIQhBLJybtylLJyZTJAQhCCWTk3blKWTUKZ",
      "ICEIUSycm7cpSyahTKAQhCiSTk3bkyWTUKZQCEIQSScm7cmSyahTJAQhCiWTk3blKWTUKZQCEIUSScm7cmSyahTKDLamazKn+2fBeMjXsbW/ldT/AEFeNjRJ",
      "hoahDUIL0agoUFZJqU/9ZFvXoMqOhJwrz9F9/i3/AEXpFuOGZV5YdGTgKMs3ov4D5KxCcCmSZpYcz+A+SnLM/VwHyTSancmViV5dm13CUZePae4qxCsTFaM7",
      "fUZcDs5AGj4q9ksLGNa1wDWi4BU2r/L5ezxC1qxufbHnwry8XWN70ZeLrGd6sQrGFL5oiw3Ss4gmy0XWM4gpk1O5NcNgViJlY+sb3qcozpt71OFuwdyjA3oj",
      "uViLI9pYfaHemxt6Q70kjGYNVvcmyUfQb3KxJxDaEXjalyUfVs4QoyMXVs4QrEmTUKZVSQxBuaNg/wCIU5CLq29ysSxCryEXQCMhH0QrEmTUKZVPhjDMzfmV",
      "ORZsPEVYliFXkWfq4ijIs2v4z5qxJk1CmVT4mhml/GfNTkm9J/GVYliFXkh038RRkv1v4lYkyahTKp8fs67+9Tkj1j+8KSxCryZ61/y8kZN3Wv8Al5KSZNQp",
      "lU9jsHKv7h5KcD+td3DyTSWIVeB/WnuCMEnWnhCKSZNQplU9smE+8/xU4ZOsHCmksQq8MvWN4f3Rhl6bOD90JMmoUyqeJcJvezhPmpul6TOE+aaSxCr97tZ3",
      "FHvf0fNFJMmoUyqflcJvwfNTfLsZ3lNJYhV3y9FnEfJF8vQZxHyRSTJqFMqnmXCb2M4/2U4perbxfsmksQq8UnVjiRik6v8AyRSTJqFMqnufhPu/mFON/VHv",
      "CaSxQkxv6p3ePNGUd1T+8eaKSZNQplU+R2E+6eO7zU5Q9U/5eaaSxCryh6t/cEZX9D+5FJMmoUyqfJ7J9h/cpyo6L+EppLFCTKjov4CjKt2P4D5IqUmTUKZV",
      "PlbhOZ/AfJTlmfq4SmpTNbGayqn+heOjXrrYla6yqgC+/DsK8hGsyYaG6EKG6EIL0aUqUpWSsof5hDv+i9KvMUsjYauOR+q0511jbVGNLn8JWo4Zl0ULm/bt",
      "DzyO4Cj7ds/rjwO8kpvk1O0eKZc11t2eW3Co5x+B23cmFtWef9QOB3kpOghYPtigP+obwnyU/a9Cf9S3uKka1P5dL2eIWtcuvtCkmopGRzsc43XC/wCIWn7T",
      "ov8AyY+9TU+2PPhrQsv2jRn/AFMXEFP2hR/+VDxhTK6TV7R4plmfW0pbmqYTnH5g2pvXKY/6iHjCQvQqfWqc6J4uMKfWID+dHxBBNJqdo8UyqfNEW5pGHOPx",
      "DamysZ/G3vSDoS429Id6m8HnCCWTU7R4pksmr2jxTJAQhCCSTV7R4pksmr2jxTJAUKVCCWTU7R4pksmr2jxTJAQhQglk1O0eKZLJq9o8UyQFClQglk1e0eKZ",
      "LJq9o8UyQFClQglk1O0eKZLJq9o8UyQFClQglk1e0Jksmr2jxTJAUIQglk1e0eKZLJq9o8UyQFCEKJZNTtHimSyavaPFMoBQpUIJZNXtCZLJq9o8UyQhCEKJ",
      "ZNXtCZLJq9o8UygFCEKJZNXtCZLJq9o8UyghCEKJZNXtCZK/V7R4plBgtw3WPUbh4heOjXr7e/k1RuH/APkF5CNEtQ0NQoahCeiUFQpQVbgqXsWkhIWqTG6N",
      "LklsLFGTUGPJKcktmTRk1JjySMktuTRk1JjySMktmTU5NSYskjJLbk0ZNSYskpyS2ZNTk1JiySMktuTRk1JiySMl8FtySMkpMOSRkluySMkpMOS2KcDtp71t",
      "ySjJKTJc/pO70e9H438RWvJIySky4putfxFGUn66TiK1ZJGSUmbLVPXy8ZU5eqH+om4yr8kjJKSj1mr/APJm4yp9bq//ACZeIq3JfBGSVaV+uVn/AJEnEj16",
      "t/8AIk70+SRklWiev1vXv+Sn7Rrv/Id3BTkkZJVofaVd154R5I+1K/r/APBvkoySMl8FWkm1K46Zr/8AgPJT9rV3WjgCTJKMkm0s+167pt4Qp+2K3pM4VTkk",
      "ZJVpabZrCM+T4VP23WbI+H91RklGSVaaftys6MXCfNH27V9XDwnzWXJKMkq01G3aoi4xQ9x8032/U9VF8/NYskoySrTd/EFR1MfzR/EE/UR95WDJIySrTefS",
      "CUjPTs4ip/iKT/xm8f7LnZJRklWqdL+In/8Aijj/AGU/xGf/ABP/AOz9ly8klyarTqu9IrxcaUjP1n7Kf4jb/wCKeP8AZcjJKDGq1Ts/xIz/AMZ3Ej+JIuen",
      "fxBcXJqMmq1Ttu9I4SLshJpHOFP8SU/PBL8lwjGoyarFO/8AxJTdTN3DzR/ElJ1U/CPNefyaUxqtU9C70io3C7BOM4/CPNN/EdF0ZuEea83k1BjTap6b+IqH",
      "/d4UfxDQ7ZOBeYyajJqs09O70goCLsb9I/AU38QWf1j+ArymTUZNVinrf4gs7rncBR9v2d154HeS8iY1GTVap651u2aRcKjnH4HbdyYW5Zx/1I4HeS8dgUYF",
      "Wqente1KOpsuaKGcPe664XHaF51gStarGhBO1CkIUn//2Q==",
    ].join(""),
  },
];
