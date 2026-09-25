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
import { and, eq, inArray, sql } from "drizzle-orm";
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
    annonceIlYaJours: 20,
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
    annonceIlYaJours: 18,
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
 * semis, arrondie à la demi-heure. Semé trop tard dans la journée, elle passe
 * au lendemain après-midi (jamais un cours à minuit).
 */
function seanceDuJour(t0: Date): Date {
  const cible = plus(t0, 3 * HEURE);
  const d = new Date(Math.ceil(cible.getTime() / (30 * MINUTE)) * 30 * MINUTE);
  if (d.getUTCDate() !== t0.getUTCDate() || d.getUTCHours() > 20 || (d.getUTCHours() === 20 && d.getUTCMinutes() > 30)) return jourA(t0, 1, 15);
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
/** Il y a x millisecondes. */
const avant = (ms: number) => (t0: Date) => plus(t0, -ms);

const CONTEXTE_DEVOIR_IA = "À propos du devoir : Trois consignes pour une PME de ton quartier";

const CONVERSATIONS: DefConversation[] = [
  {
    type: "direct",
    entre: [AYA, "f:diallo"],
    messages: [
      {
        qui: AYA,
        quand: ilYa(1, 20, 14),
        contexte: CONTEXTE_DEVOIR_IA,
        texte:
          "Bonsoir Monsieur Diallo. Pour le devoir des trois consignes, est-ce que je peux prendre le maquis de ma tante à Yopougon ? Elle vend de l'attiéké poisson et n'arrive pas à répondre à toutes les commandes WhatsApp le soir.",
      },
      { qui: AYA, quand: ilYa(1, 20, 16), texte: "Et est-ce qu'il faut rendre aussi les réponses de l'IA, ou seulement les consignes ?" },
      {
        qui: "f:diallo",
        quand: (t0) => new Date(Math.max(jourA(t0, -1, 21, 5).getTime(), t0.getTime() - 2 * HEURE)),
        texte: "Bonsoir Aya ! Excellente idée : un vrai cas vaut mieux que tous les exemples du cours. Le maquis de ta tante est parfait pour la consigne « répondre aux clients ».",
      },
      {
        qui: "f:diallo",
        quand: (t0) => new Date(Math.max(jourA(t0, -1, 21, 6).getTime(), t0.getTime() - 2 * HEURE + MINUTE)),
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
        quand: avant(50 * MINUTE),
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
        quand: ilYa(1, 19, 40),
        texte: "À M'Batto, on a essayé la consigne du maquis avec toute la salle Akwaba : l'IA a proposé un poulet braisé à 4 000 F. On a vérifié au maquis d'à côté et corrigé 😄",
      },
      { qui: AYA, quand: avant(4 * HEURE), texte: "Pour la grande séance de mardi, est-ce qu'on doit préparer quelque chose ?" },
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
    publieeLe: (t0) => plus(t0, -26 * HEURE),
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
      debut: (t0) => horsDimanche(jourA(t0, 5 + decalage, cle === "azaguie" ? 10 : 16), 1),
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

// @@SUITE_SEMIS@@
