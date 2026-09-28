// Tables et types propres au module « messages ».
//
// Les conversations, participants et messages vivent dans ./echanges ; ici :
// les signalements (bouton « Signaler ») et les contrats d'API échangés entre
// le serveur (server/routes/messages.ts) et le client (modules/messages).
import { serial, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, type Role } from "./base";
import { messages } from "./echanges";

/**
 * « Signaler » un message : prévient le formateur du cours et la vie scolaire.
 * Une seule ligne par personne et par message (signaler deux fois ne change rien).
 */
export const signalementsMessages = campusSchema.table(
  "signalements_messages",
  {
    id: serial("id").primaryKey(),
    messageId: integer("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    auteurId: integer("auteur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    motif: text("motif"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("signalements_message_auteur_idx").on(t.messageId, t.auteurId), index("signalements_message_idx").on(t.messageId)],
);

export type SignalementMessage = typeof signalementsMessages.$inferSelect;

// ── Contrats d'API (dates en chaînes ISO) ──────────────────────────────────

/** Ce que contient un message, pour les aperçus (« 📷 Photo », « 🎤 Note vocale »). */
export type TypeContenuMessage = "texte" | "photo" | "audio" | "fichier";

/** Conversation directe ou salon « Questions du cours ». */
export type TypeConversationMessages = "direct" | "cours";

/** Personne à qui l'on peut écrire, ou interlocuteur d'une conversation directe. */
export type ContactMessages = {
  id: number;
  prenom: string;
  nom: string;
  role: Role;
  photoUrl: string | null;
  /** « Formateur · Lyon, France », « Vie scolaire · Yopougon », « Yopougon · 24GC0001 ». */
  detail: string;
};

/** Cours d'un salon « Questions du cours ». */
export type CoursSalon = { id: number; code: string; titre: string; couleur: string };

export type DernierMessage = {
  id: number;
  auteurId: number;
  auteurPrenom: string;
  /** Écrit par la personne connectée. */
  deMoi: boolean;
  type: TypeContenuMessage;
  /** Texte court déjà prêt (« Photo », « Note vocale · 0:42 », début du texte). */
  extrait: string;
  supprime: boolean;
  creeLe: string;
  /** Conversation directe, message à moi : l'autre l'a-t-il lu (✓✓) ? null ailleurs. */
  lu: boolean | null;
};

/** GET /api/conversations — une ligne de la liste façon WhatsApp. */
export type ConversationResume = {
  id: number;
  type: TypeConversationMessages;
  /** Nom de l'interlocuteur, ou titre du cours pour un salon. */
  titre: string;
  sousTitre: string;
  interlocuteur: ContactMessages | null;
  cours: CoursSalon | null;
  dernierMessage: DernierMessage | null;
  nonLus: number;
  sourdine: boolean;
  /** Dernière activité (dernier message, ou création). */
  activiteLe: string;
};

/** GET /api/conversations/:id — en-tête du fil et droits de la personne connectée. */
export type ConversationDetail = ConversationResume & {
  /** Formateur du cours ou équipe : peut retirer n'importe quel message du salon. */
  peutModerer: boolean;
  peutEcrire: boolean;
  /** Conversation directe : curseur de lecture de l'autre personne (pour les ✓✓). */
  luJusquAAutre: string | null;
  /** Salon : nombre de campus qui suivent le cours. */
  nbCampus: number | null;
};

export type AuteurMessage = {
  id: number;
  prenom: string;
  nom: string;
  role: Role;
  photoUrl: string | null;
  /** Campus de l'auteur (« Yopougon ») : utile dans un salon qui réunit cinq campus. */
  site: string | null;
};

export type FichierMessage = { id: number; nom: string; mime: string; taille: number; url: string };

export type CitationMessage = {
  id: number;
  auteurId: number;
  auteur: string;
  type: TypeContenuMessage;
  extrait: string;
  supprime: boolean;
};

export type MessageDto = {
  id: number;
  conversationId: number;
  /** Identifiant d'envoi du téléphone (réconcilie la bulle « en attente »). */
  cle: string | null;
  auteur: AuteurMessage;
  texte: string;
  contexte: string | null;
  type: TypeContenuMessage;
  fichier: FichierMessage | null;
  dureeSecondes: number | null;
  reponseA: CitationMessage | null;
  supprime: boolean;
  /** Retiré par le formateur ou l'équipe (et non par son auteur). */
  retireParModeration: boolean;
  creeLe: string;
  /** La personne connectée a signalé ce message. */
  signaleParMoi: boolean;
  /** Nombre de signalements, pour les seuls modérateurs du salon (0 sinon). */
  signalements: number;
};

/** GET /api/conversations/:id/messages?avant=<id> — 30 messages, du plus ancien au plus récent. */
export type PageMessages = {
  messages: MessageDto[];
  plusAnciens: boolean;
  luJusquAAutre: string | null;
};

export type GroupeContacts = {
  cle: string;
  titre: string;
  personnes: ContactMessages[];
  /** La liste a été coupée : taper un nom pour affiner. */
  tronque: boolean;
};

/** GET /api/conversations/contacts?q= — à qui la personne peut écrire. */
export type ContactsMessages = {
  groupes: GroupeContacts[];
  /** Salons « Questions du cours » ouverts à la personne. */
  salons: CoursSalon[];
};

/** POST /api/conversations/directe et GET /api/conversations/cours/:coursId */
export type ConversationOuverte = { id: number; lien: string };

/** Événements du canal temps réel conv:<id>. */
export type EvenementConversation =
  | { type: "message"; data: MessageDto }
  | { type: "supprime"; data: { id: number; parModeration: boolean } }
  | { type: "lu"; data: { utilisateurId: number; luJusquA: string } }
  | { type: "saisie"; data: { utilisateurId: number; prenom: string } };
