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

// @@SUITE_COURS@@
