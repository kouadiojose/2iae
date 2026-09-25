// Visio intégrée (signalisation WebRTC par le temps réel du campus) et radio du cours.
//
// ── Visio « campus » ────────────────────────────────────────────────────────
// Aucune dépendance à un fournisseur : les navigateurs se parlent en direct
// (WebRTC), en ÉTOILE autour du formateur. Chaque salle de conférence ouvre
// une connexion avec le formateur (vidéo et son dans les deux sens) ; chaque
// étudiant en ligne ouvre une connexion de réception (vidéo basse définition
// ou son seul). Quand le formateur donne la parole, son navigateur relaie le
// son (et l'image d'une salle) vers les autres.
//
// Le serveur ne voit passer AUCUN média : il présente les participants au
// formateur et relaie leurs messages de négociation (offres, réponses,
// candidats ICE) — uniquement entre le formateur et un participant autorisé
// de la même séance, jamais d'un étudiant à un autre.
//
// ── Radio du cours ─────────────────────────────────────────────────────────
// Le navigateur du formateur enregistre son micro (MediaRecorder, WebM/Opus
// ≈ 24 kbit/s) et envoie une tranche par seconde. Le serveur découpe le flux
// WebM (analyse EBML minimale) et le rediffuse en HTTP à chaque auditeur :
// ≈ 11 Mo par heure pour le son seul (affiché « ≈ 12 à 15 Mo/h » avec les
// diapos et les sous-titres), lisible par un simple <audio>, avec tous les
// fournisseurs de visio (Daily, Jitsi, lien externe, campus).
//
// État en mémoire : prévu pour une seule instance, comme le temps réel.
import express, { type Express, type Request, type RequestHandler, type Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { asc } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { exigerConnexion, moi, estEquipe } from "./auth";
import { route, valider, idParam, interdit, invalide, ErreurHttp } from "./http";
import { seanceVisible, enseigneCours } from "./acces";
import { enregistrerGardien, publier, publierUtilisateur } from "./temps-reel";
import { planifier } from "./taches";
import {
  sites,
  TYPES_SIGNAL_VISIO,
  type Utilisateur,
  type Seance,
  type RoleVisio,
  type ParticipantVisio,
  type ReponseRejoindreVisio,
  type ReponseIceVisio,
  type PairsVisio,
  type EvenementVisio,
  type EtatRadio,
  type EvenementRadio,
  type RTCIceServerJson,
} from "@shared/schema";

// ════════════════════════════════════════════════════════════════════════════
// Réglages
// ════════════════════════════════════════════════════════════════════════════

/** Étudiants en ligne qui reçoivent la vidéo du formateur (VISIO_PLACES_VIDEO, 8 par défaut). */
const PLACES_VIDEO = config.visio.placesVideo;
/** Étudiants en ligne en visio (VISIO_PLACES_TOTAL, 40 par défaut) ; au-delà, ils écoutent la radio. */
const PLACES_TOTAL = Math.max(PLACES_VIDEO, config.visio.placesTotal);
/** Un onglet silencieux depuis ce délai est considéré comme parti (battement toutes les 10 s). */
const DELAI_DISPARITION_MS = 35_000;
/** Taille maximale d'un message de négociation (une offre SDP pèse 3 à 10 Ko). */
const TAILLE_MAX_SIGNAL = 100_000;
/** Garde-fou contre un onglet qui s'emballe : signaux par tranche de 10 s. */
const SIGNAUX_MAX_10S = 200;

const MOTIF_PAIR = /^[A-Za-z0-9_-]{8,64}$/;

// ════════════════════════════════════════════════════════════════════════════
// Serveurs ICE (STUN / TURN)
// ════════════════════════════════════════════════════════════════════════════

/**
 * STUN publics (suffisants sur la fibre ou le Wi-Fi d'un campus) + TURN
 * facultatif. Derrière le CGNAT des opérateurs mobiles, seul un relais TURN
 * garantit la connexion :
 *  - TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL : identifiants fixes (Metered, Twilio, coturn « lt-cred-mech ») ;
 *  - TURN_URLS + TURN_CREDENTIAL seul : secret partagé coturn (« use-auth-secret ») →
 *    identifiants éphémères valables 24 h, calculés ici pour chaque personne.
 */
function serveursIce(u: Utilisateur): RTCIceServerJson[] {
  const liste: RTCIceServerJson[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
  const { turnUrls, turnUtilisateur, turnSecret } = config.visio;
  if (!turnUrls.length) return liste;
  if (turnUtilisateur && turnSecret) {
    liste.push({ urls: turnUrls, username: turnUtilisateur, credential: turnSecret });
  } else if (turnSecret) {
    const username = `${Math.floor(Date.now() / 1000) + 24 * 3600}:campus-${u.id}`;
    const credential = crypto.createHmac("sha1", turnSecret).update(username).digest("base64");
    liste.push({ urls: turnUrls, username, credential });
  } else {
    liste.push({ urls: turnUrls });
  }
  return liste;
}

// ════════════════════════════════════════════════════════════════════════════
// Visio : état en mémoire
// ════════════════════════════════════════════════════════════════════════════

type Pair = ParticipantVisio & {
  vuLe: number;
  signaux: { n: number; depuis: number };
};

type ClasseVisio = {
  seanceId: number;
  coursId: number;
  formateurPairId: string | null;
  pairs: Map<string, Pair>;
};

const classes = new Map<number, ClasseVisio>();

function classeDe(seance: Seance): ClasseVisio {
  let c = classes.get(seance.id);
  if (!c) classes.set(seance.id, (c = { seanceId: seance.id, coursId: seance.coursId, formateurPairId: null, pairs: new Map() }));
  return c;
}

/** Ce que l'on montre d'un onglet (jamais les compteurs internes). */
function publicPair(p: Pair): ParticipantVisio {
  return { pairId: p.pairId, role: p.role, utilisateurId: p.utilisateurId, siteId: p.siteId, nom: p.nom, video: p.video, rejointLe: p.rejointLe };
}

/** Événement visio sans son destinataire (Omit distribué sur chaque variante). */
type SansCible<T> = T extends unknown ? Omit<T, "vers" | "seanceId"> : never;

function envoyer(p: Pair, evenement: SansCible<EvenementVisio>, seanceId: number) {
  publierUtilisateur(p.utilisateurId, "visio", { ...evenement, seanceId, vers: p.pairId });
}

function formateurDe(c: ClasseVisio): Pair | null {
  return c.formateurPairId ? c.pairs.get(c.formateurPairId) ?? null : null;
}

/** Retire un onglet et prévient qui doit l'être. */
function retirer(c: ClasseVisio, pairId: string) {
  const p = c.pairs.get(pairId);
  if (!p) return;
  c.pairs.delete(pairId);
  if (c.formateurPairId === pairId) {
    c.formateurPairId = null;
    for (const autre of c.pairs.values()) envoyer(autre, { genre: "formateur-part", pairId }, c.seanceId);
  } else {
    const f = formateurDe(c);
    if (f) envoyer(f, { genre: "pair-part", pairId }, c.seanceId);
  }
  if (!c.pairs.size) classes.delete(c.seanceId);
}

// Petit cache des noms courts des sites (ils ne changent pas pendant un cours).
let cacheSites: { liste: PairsVisio["sites"]; exp: number } | null = null;
async function listeSites(): Promise<PairsVisio["sites"]> {
  if (cacheSites && cacheSites.exp > Date.now()) return cacheSites.liste;
  const liste = await db
    .select({ id: sites.id, nomCourt: sites.nomCourt, salleConference: sites.salleConference })
    .from(sites)
    .orderBy(asc(sites.ordre), asc(sites.id));
  cacheSites = { liste, exp: Date.now() + 5 * 60_000 };
  return liste;
}

/** Nom montré au formateur (jamais aux salles ni aux autres étudiants). */
async function nomAffiche(u: Utilisateur, role: RoleVisio): Promise<string> {
  if (role === "salle") {
    const site = (await listeSites()).find((s) => s.id === u.siteId);
    return site?.nomCourt ?? "Salle";
  }
  if (role === "etudiant") return `${u.prenom} ${u.nom.charAt(0)}.`.trim();
  return `${u.prenom} ${u.nom}`.trim();
}

/** Charge la séance, vérifie l'accès et qu'elle n'est ni terminée ni annulée. */
async function seanceOuverte(u: Utilisateur, seanceId: number): Promise<Seance> {
  const s = await seanceVisible(u, seanceId);
  if (s.statut === "annulee") throw new ErreurHttp(409, "Cette séance a été annulée.");
  if (s.statut === "terminee") throw new ErreurHttp(409, "Cette séance est terminée.");
  return s;
}

/** Peut tenir le centre de l'étoile (et émettre la radio) : formateur du cours, ou direction. */
async function peutAnimer(u: Utilisateur, s: Seance): Promise<boolean> {
  if (u.role === "admin") return true;
  return u.role === "formateur" && (await enseigneCours(u, s.coursId));
}

// ════════════════════════════════════════════════════════════════════════════
// Radio : découpage du flux WebM (EBML)
// ════════════════════════════════════════════════════════════════════════════
//
// Un fichier WebM est une suite d'éléments EBML (identifiant, taille, contenu).
// MediaRecorder produit : en-tête EBML · Segment (taille inconnue) · Info ·
// Tracks · puis des Clusters (horodatage + blocs audio de 20 à 60 ms).
// Pour qu'un auditeur puisse arriver en cours de route, il faut lui donner
// l'en-tête d'initialisation (tout ce qui précède le premier Cluster) puis
// repartir d'un début de Cluster. On descend jusqu'aux blocs : un nouvel
// auditeur reçoit un Cluster reconstitué (horodatage du Cluster courant + la
// dernière seconde de blocs), ce qui garde le retard sous les 2 secondes
// même quand le navigateur écrit de longs Clusters. Chaque bloc Opus se
// décode seul : on peut en sauter pour un auditeur trop lent sans casser le
// flux (les tailles de Cluster sont réécrites en « inconnue »).

const ID_EBML = 0x1a45dfa3;
const ID_SEGMENT = 0x18538067;
const ID_CLUSTER = 0x1f43b675;
const ID_TIMECODE = 0xe7;
const ID_SIMPLEBLOCK = 0xa3;
const ID_BLOCKGROUP = 0xa0;
const ID_BLOCK = 0xa1;
const ID_TRACKS = 0x1654ae6b;
/** Éléments de premier niveau du Segment : leur apparition clôt un Cluster de taille inconnue. */
const IDS_NIVEAU_1 = new Set([0x114d9b74, 0x1549a966, ID_TRACKS, ID_CLUSTER, 0x1c53bb6b, 0x1941a469, 0x1043a770, 0x1254c367]);
/** Éléments inutiles (voire trompeurs) dans un flux sans fin : SeekHead, Cues, Void. */
const IDS_IGNORES_INIT = new Set([0x114d9b74, 0x1c53bb6b, 0xec]);

/** Segment et Cluster de taille « inconnue » (flux en direct). */
const ENTETE_SEGMENT_DIRECT = Buffer.from([0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
const ENTETE_CLUSTER_DIRECT = Buffer.from([0x1f, 0x43, 0xb6, 0x75, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

/** Retard visé pour un auditeur qui arrive : la dernière seconde de son. */
const ARRIERE_NOUVEL_AUDITEUR_MS = 1000;

class ErreurWebm extends Error {}

function lireId(b: Buffer, p: number): { id: number; n: number } | null {
  if (p >= b.length) return null;
  const premier = b[p];
  let n = 1;
  let masque = 0x80;
  while (n <= 4 && !(premier & masque)) {
    n++;
    masque >>= 1;
  }
  if (n > 4) throw new ErreurWebm("Identifiant EBML invalide.");
  if (p + n > b.length) return null;
  let id = 0;
  for (let i = 0; i < n; i++) id = id * 256 + b[p + i];
  return { id, n };
}

/** Entier EBML de longueur variable (taille d'élément, numéro de piste). */
function lireVint(b: Buffer, p: number): { valeur: number; n: number; inconnue: boolean } | null {
  if (p >= b.length) return null;
  const premier = b[p];
  let n = 1;
  let masque = 0x80;
  while (n <= 8 && !(premier & masque)) {
    n++;
    masque >>= 1;
  }
  if (n > 8) throw new ErreurWebm("Taille EBML invalide.");
  if (p + n > b.length) return null;
  let valeur = premier & (masque - 1);
  let tousUns = valeur === masque - 1;
  for (let i = 1; i < n; i++) {
    valeur = valeur * 256 + b[p + i];
    if (b[p + i] !== 0xff) tousUns = false;
  }
  return { valeur, n, inconnue: tousUns };
}

function lireEntier(b: Buffer, debut: number, fin: number): number {
  let v = 0;
  for (let i = debut; i < fin; i++) v = v * 256 + b[i];
  return v;
}

/** Horodatage relatif (ms) d'un SimpleBlock ou d'un BlockGroup, ou null s'il est illisible. */
function tempsRelatifBloc(el: Buffer, id: number, entete: number): number | null {
  let p = entete;
  if (id === ID_BLOCKGROUP) {
    // Cherche l'élément Block à l'intérieur du groupe.
    while (p < el.length) {
      const sousId = lireId(el, p);
      if (!sousId) return null;
      const t = lireVint(el, p + sousId.n);
      if (!t) return null;
      if (sousId.id === ID_BLOCK) {
        p += sousId.n + t.n;
        break;
      }
      p += sousId.n + t.n + t.valeur;
    }
    if (p >= el.length) return null;
  }
  const piste = lireVint(el, p);
  if (!piste || p + piste.n + 2 > el.length) return null;
  return el.readInt16BE(p + piste.n);
}

type Unite = { genre: "cluster" | "timecode" | "bloc"; octets: Buffer };

class AnalyseurWebm {
  /** En-tête d'initialisation (EBML + Segment + Info + Tracks), connu dès le premier Cluster. */
  init: Buffer | null = null;
  private tampon: Buffer = Buffer.alloc(0);
  private phase: "ebml" | "segment" | "niveau1" | "cluster" = "ebml";
  private morceauxInit: Buffer[] = [];
  private avecPistes = false;
  private resteCluster = 0;
  // Cluster en cours, pour les auditeurs qui arrivent.
  private timecodeCluster: Buffer | null = null;
  private tempsCluster = 0;
  private blocs: { t: number; octets: Buffer }[] = [];

  /** Ajoute des octets reçus et renvoie les unités complètes à diffuser. */
  pousser(octets: Buffer): Unite[] {
    this.tampon = this.tampon.length ? Buffer.concat([this.tampon, octets]) : octets;
    const b = this.tampon;
    const unites: Unite[] = [];
    let p = 0;
    for (;;) {
      if (this.phase === "cluster" && this.resteCluster <= 0) {
        this.phase = "niveau1";
        continue;
      }
      const id = lireId(b, p);
      if (!id) break;
      // Un Cluster de taille inconnue se termine au prochain élément de premier niveau.
      if (this.phase === "cluster" && this.resteCluster === Infinity && IDS_NIVEAU_1.has(id.id)) {
        this.phase = "niveau1";
        continue;
      }
      const t = lireVint(b, p + id.n);
      if (!t) break;
      const entete = id.n + t.n;

      if (this.phase === "ebml") {
        if (id.id !== ID_EBML || t.inconnue) throw new ErreurWebm("En-tête WebM attendu au début de l'émission.");
        const fin = p + entete + t.valeur;
        if (fin > b.length) break;
        this.morceauxInit.push(Buffer.from(b.subarray(p, fin)));
        p = fin;
        this.phase = "segment";
        continue;
      }
      if (this.phase === "segment") {
        if (id.id !== ID_SEGMENT) throw new ErreurWebm("Segment WebM attendu.");
        this.morceauxInit.push(ENTETE_SEGMENT_DIRECT);
        p += entete;
        this.phase = "niveau1";
        continue;
      }
      if (this.phase === "niveau1") {
        if (id.id === ID_CLUSTER) {
          if (!this.init) {
            if (!this.avecPistes) throw new ErreurWebm("Pistes WebM absentes avant le premier Cluster.");
            this.init = Buffer.concat(this.morceauxInit);
            this.morceauxInit = [];
          }
          this.resteCluster = t.inconnue ? Infinity : t.valeur;
          this.timecodeCluster = null;
          this.blocs = [];
          unites.push({ genre: "cluster", octets: ENTETE_CLUSTER_DIRECT });
          p += entete;
          this.phase = "cluster";
          continue;
        }
        if (t.inconnue) throw new ErreurWebm("Élément WebM de taille inconnue.");
        const fin = p + entete + t.valeur;
        if (fin > b.length) break;
        if (!this.init && !IDS_IGNORES_INIT.has(id.id)) {
          this.morceauxInit.push(Buffer.from(b.subarray(p, fin)));
          if (id.id === ID_TRACKS) this.avecPistes = true;
        }
        p = fin;
        continue;
      }
      // Phase « cluster » : horodatage, blocs, et petits éléments ignorés.
      if (t.inconnue) throw new ErreurWebm("Bloc WebM de taille inconnue.");
      const fin = p + entete + t.valeur;
      if (fin > b.length) break;
      if (this.resteCluster !== Infinity) this.resteCluster -= fin - p;
      if (id.id === ID_TIMECODE) {
        const el = Buffer.from(b.subarray(p, fin));
        this.timecodeCluster = el;
        this.tempsCluster = lireEntier(el, entete, el.length);
        unites.push({ genre: "timecode", octets: el });
      } else if (id.id === ID_SIMPLEBLOCK || id.id === ID_BLOCKGROUP) {
        const el = Buffer.from(b.subarray(p, fin));
        const rel = tempsRelatifBloc(el, id.id, entete);
        const tAbsolu = this.tempsCluster + (rel ?? 0);
        this.blocs.push({ t: tAbsolu, octets: el });
        // Un Cluster ne dépasse pas 32 s (horodatage relatif sur 16 bits) : borne de sécurité.
        if (this.blocs.length > 2000) this.blocs.shift();
        unites.push({ genre: "bloc", octets: el });
      }
      // Position, PrevSize, Void… : faux après réécriture des tailles, on ne les transmet pas.
      p = fin;
    }
    this.tampon = p >= b.length ? Buffer.alloc(0) : Buffer.from(b.subarray(p));
    if (this.tampon.length > 2_000_000) throw new ErreurWebm("Flux WebM illisible.");
    return unites;
  }

  /** Ce qu'un auditeur qui arrive reçoit après l'en-tête : un Cluster reconstitué avec la dernière seconde. */
  reprisePourNouvelAuditeur(): Buffer | null {
    if (!this.timecodeCluster) return null;
    const dernier = this.blocs.length ? this.blocs[this.blocs.length - 1].t : 0;
    const recents = this.blocs.filter((x) => x.t >= dernier - ARRIERE_NOUVEL_AUDITEUR_MS).map((x) => x.octets);
    return Buffer.concat([ENTETE_CLUSTER_DIRECT, this.timecodeCluster, ...recents]);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Radio : émissions et auditeurs
// ════════════════════════════════════════════════════════════════════════════

type Auditeur = { res: Response; utilisateurId: number };

type Emission = {
  cle: string;
  seanceId: number | null;
  /** Identifiant de l'enregistrement en cours (change à chaque redémarrage de MediaRecorder). */
  flux: string | null;
  seqAttendue: number;
  analyseur: AnalyseurWebm;
  auditeurs: Set<Auditeur>;
  enDirect: boolean;
  depuis: number | null;
  dernierMorceau: number;
  octetsRecus: number;
};

const emissions = new Map<string, Emission>();

/** Au-delà, un auditeur trop lent (3G saturée) saute des blocs plutôt que d'accumuler du retard. */
const TAMPON_MAX_AUDITEUR = 48 * 1024;
/** Sans morceau depuis ce délai, l'émission est considérée comme coupée. */
const SILENCE_MAX_MS = 20_000;
/** Radio d'essai (page /visio/essai) : durée maximale. */
const DUREE_MAX_ESSAI_MS = 90_000;

function emissionDe(cle: string, seanceId: number | null): Emission {
  let e = emissions.get(cle);
  if (!e) {
    e = {
      cle,
      seanceId,
      flux: null,
      seqAttendue: 0,
      analyseur: new AnalyseurWebm(),
      auditeurs: new Set(),
      enDirect: false,
      depuis: null,
      dernierMorceau: 0,
      octetsRecus: 0,
    };
    emissions.set(cle, e);
  }
  return e;
}

function signalerRadio(e: Emission, genre: EvenementRadio["genre"]) {
  if (e.seanceId) publier(`visio:${e.seanceId}`, "radio", { genre, seanceId: e.seanceId } satisfies EvenementRadio);
}

/** Ferme les écoutes en cours : les lecteurs se reconnectent (nouvel en-tête) ou attendent. */
function libererAuditeurs(e: Emission) {
  for (const a of e.auditeurs) {
    try {
      a.res.end();
    } catch {
      /* déjà fermée */
    }
  }
  e.auditeurs.clear();
}

function couper(e: Emission, genre: "fin" | "redemarrage") {
  const etaitEnDirect = e.enDirect;
  libererAuditeurs(e);
  e.enDirect = false;
  e.flux = null;
  e.seqAttendue = 0;
  e.analyseur = new AnalyseurWebm();
  if (etaitEnDirect || genre === "redemarrage") signalerRadio(e, genre);
}

function diffuser(e: Emission, unites: Unite[]) {
  if (!unites.length || !e.auditeurs.size) return;
  const tout = Buffer.concat(unites.map((u) => u.octets));
  let sansBlocs: Buffer | null = null;
  for (const a of e.auditeurs) {
    if (a.res.writableLength <= TAMPON_MAX_AUDITEUR) {
      a.res.write(tout);
    } else {
      sansBlocs ??= Buffer.concat(unites.filter((u) => u.genre !== "bloc").map((u) => u.octets));
      if (sansBlocs.length) a.res.write(sansBlocs);
    }
  }
}

function etatRadio(e: Emission | undefined): EtatRadio {
  if (!e) return { enDirect: false, auditeurs: 0, depuis: null, debit: 0 };
  const secondes = e.depuis ? (Date.now() - e.depuis) / 1000 : 0;
  return {
    enDirect: e.enDirect,
    auditeurs: new Set([...e.auditeurs].map((a) => a.utilisateurId)).size,
    depuis: e.enDirect && e.depuis ? new Date(e.depuis).toISOString() : null,
    debit: secondes > 3 ? Math.round(e.octetsRecus / secondes) : 0,
  };
}

const schemaMorceau = z.object({
  debut: z.enum(["0", "1"]).optional(),
  flux: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/, "identifiant d'enregistrement invalide"),
  seq: z.coerce.number().int().min(0),
});

/** Reçoit une tranche d'enregistrement ; 409 = « recommence l'enregistrement » (en-tête perdu, trou). */
function recevoirMorceau(e: Emission, req: Request, res: Response) {
  const { debut, flux, seq } = valider(schemaMorceau, req.query);
  const octets = req.body;
  if (!Buffer.isBuffer(octets) || !octets.length) throw invalide("Morceau audio vide.");

  if (debut === "1") {
    // Même début renvoyé (réponse perdue en route) : déjà pris en compte.
    if (e.flux === flux && seq === 0 && e.seqAttendue > 0) return res.json({ ok: true, doublon: true });
    if (seq !== 0) throw invalide("Le premier morceau doit porter le numéro 0.");
    const redemarrage = e.enDirect;
    if (redemarrage) couper(e, "redemarrage");
    e.analyseur = new AnalyseurWebm();
    e.flux = flux;
    e.seqAttendue = 0;
    e.depuis = Date.now();
    e.octetsRecus = 0;
  } else {
    if (e.flux !== flux || !e.depuis) {
      return res.status(409).json({ message: "Émission inconnue : recommence l'enregistrement.", redemarrer: true });
    }
    if (seq < e.seqAttendue) return res.json({ ok: true, doublon: true });
    if (seq > e.seqAttendue) {
      couper(e, "redemarrage");
      return res.status(409).json({ message: "Des morceaux manquent : recommence l'enregistrement.", redemarrer: true });
    }
  }

  let unites: Unite[];
  try {
    unites = e.analyseur.pousser(octets);
  } catch (err) {
    if (!(err instanceof ErreurWebm)) throw err;
    couper(e, "redemarrage");
    return res.status(409).json({ message: `${err.message} Recommence l'enregistrement.`, redemarrer: true });
  }
  e.seqAttendue = seq + 1;
  e.dernierMorceau = Date.now();
  e.octetsRecus += octets.length;
  if (!e.enDirect && e.analyseur.init) {
    e.enDirect = true;
    signalerRadio(e, "debut");
  }
  diffuser(e, unites);
  res.json({ ok: true, auditeurs: etatRadio(e).auditeurs });
}

/** Ouvre une écoute : en-tête, dernière seconde, puis le son au fil de l'eau. */
function ouvrirEcoute(e: Emission | undefined, u: Utilisateur, req: Request, res: Response) {
  if (!e || !e.enDirect || !e.analyseur.init) {
    res.setHeader("Retry-After", "5");
    return res.status(503).json({ message: "La radio du cours n'a pas encore commencé." });
  }
  res.status(200);
  res.setHeader("Content-Type", "audio/webm");
  // no-transform : ni compression ni réécriture par un proxy ; X-Accel-Buffering : pas de mise en tampon.
  res.setHeader("Cache-Control", "no-cache, no-store, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Accept-Ranges", "none");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  req.socket.setNoDelay(true);
  req.socket.setTimeout(0);

  const reprise = e.analyseur.reprisePourNouvelAuditeur();
  res.write(reprise ? Buffer.concat([e.analyseur.init, reprise]) : e.analyseur.init);
  const a: Auditeur = { res, utilisateurId: u.id };
  e.auditeurs.add(a);
  req.on("close", () => e.auditeurs.delete(a));
}

// ════════════════════════════════════════════════════════════════════════════
// Routes
// ════════════════════════════════════════════════════════════════════════════

const schemaRejoindre = z.object({
  pairId: z.string().regex(MOTIF_PAIR, "identifiant d'onglet invalide"),
  role: z.enum(["formateur", "salle", "etudiant"]),
  siteId: z.number().int().positive().nullish(),
  /** Étudiant : souhaite recevoir la vidéo (sinon son seul). */
  video: z.boolean().optional(),
});

const schemaPair = z.object({ pairId: z.string().regex(MOTIF_PAIR, "identifiant d'onglet invalide") });

const schemaSignal = z.object({
  de: z.string().regex(MOTIF_PAIR),
  vers: z.string().regex(MOTIF_PAIR),
  type: z.enum(TYPES_SIGNAL_VISIO),
  donnees: z.unknown().optional(),
});

export function enregistrerVisioCampus(app: Express) {
  // Canal « visio:<seanceId> » : événements de la radio pour les inscrits de la séance.
  enregistrerGardien("visio", async (u, cle) => {
    const id = Number(cle);
    if (!Number.isInteger(id) || id <= 0) return false;
    try {
      await seanceVisible(u, id);
      return true;
    } catch {
      return false;
    }
  });

  // ── Visio ────────────────────────────────────────────────────────────────

  app.get(
    "/api/visio/ice",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      res.setHeader("Cache-Control", "no-store");
      res.json({ iceServers: serveursIce(u), turn: config.visio.turnUrls.length > 0 } satisfies ReponseIceVisio);
    }),
  );

  app.post(
    "/api/visio/:seanceId/rejoindre",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const seance = await seanceOuverte(u, idParam(req, "seanceId"));
      const corps = valider(schemaRejoindre, req.body);
      const role = corps.role;

      if (role === "formateur" && !(await peutAnimer(u, seance))) throw interdit("Seul le formateur du cours anime la visio.");
      if (role === "salle" && u.role !== "salle") throw interdit("Ce rôle est réservé à l'écran d'une salle de conférence.");
      if (role !== "salle" && u.role === "salle") throw interdit("L'écran de salle rejoint la visio en tant que salle.");

      const c = classeDe(seance);
      const deja = c.pairs.get(corps.pairId);
      if (deja && (deja.utilisateurId !== u.id || deja.role !== role)) throw new ErreurHttp(409, "Cet onglet est déjà utilisé.");

      // Places des étudiants en ligne : vidéo d'abord, puis son seul, puis la radio.
      let video = false;
      if (role === "etudiant") {
        const etudiants = [...c.pairs.values()].filter((p) => p.role === "etudiant" && p.pairId !== corps.pairId);
        if (etudiants.length >= PLACES_TOTAL) {
          return res.json({
            pairId: corps.pairId,
            role,
            formateur: null,
            participants: [],
            video: false,
            complet: true,
            iceServers: [],
          } satisfies ReponseRejoindreVisio);
        }
        const videoPrises = etudiants.filter((p) => p.video).length;
        video = Boolean(corps.video) && (deja?.video || videoPrises < PLACES_VIDEO);
      }

      const pair: Pair = deja ?? {
        pairId: corps.pairId,
        role,
        utilisateurId: u.id,
        // Le site vient du compte, jamais de la requête.
        siteId: role === "formateur" ? null : u.siteId ?? null,
        nom: await nomAffiche(u, role),
        video,
        rejointLe: new Date().toISOString(),
        vuLe: Date.now(),
        signaux: { n: 0, depuis: Date.now() },
      };
      pair.video = video;
      pair.vuLe = Date.now();
      c.pairs.set(pair.pairId, pair);

      if (role === "formateur") {
        const ancien = formateurDe(c);
        if (ancien && ancien.pairId !== pair.pairId) {
          // La classe s'ouvre dans un autre onglet : l'ancien s'efface.
          c.pairs.delete(ancien.pairId);
          envoyer(ancien, { genre: "remplace" }, c.seanceId);
        }
        c.formateurPairId = pair.pairId;
        const participants = [...c.pairs.values()].filter((p) => p.pairId !== pair.pairId);
        for (const p of participants) envoyer(p, { genre: "formateur-arrive", pairId: pair.pairId }, c.seanceId);
        return res.json({
          pairId: pair.pairId,
          role,
          formateur: { pairId: pair.pairId },
          participants: participants.map(publicPair),
          video: true,
          complet: false,
          iceServers: serveursIce(u),
        } satisfies ReponseRejoindreVisio);
      }

      const f = formateurDe(c);
      if (f) envoyer(f, { genre: "pair-arrive", participant: publicPair(pair) }, c.seanceId);
      res.json({
        pairId: pair.pairId,
        role,
        formateur: f ? { pairId: f.pairId } : null,
        participants: [],
        video,
        complet: false,
        iceServers: serveursIce(u),
      } satisfies ReponseRejoindreVisio);
    }),
  );

  app.post(
    "/api/visio/:seanceId/signal",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const seanceId = idParam(req, "seanceId");
      const { de, vers, type, donnees } = valider(schemaSignal, req.body);
      const c = classes.get(seanceId);
      const emetteur = c?.pairs.get(de);
      if (!c || !emetteur || emetteur.utilisateurId !== u.id) {
        return res.status(404).json({ message: "Tu n'es plus connecté à la visio : reconnexion…", rejoindre: true });
      }
      const destinataire = c.pairs.get(vers);
      if (!destinataire) return res.status(410).json({ message: "Ce participant a quitté la visio." });
      // Étoile : on ne parle qu'avec le formateur (jamais d'un étudiant à un autre).
      if (c.formateurPairId !== de && c.formateurPairId !== vers) throw interdit("La visio passe toujours par le formateur.");
      if (JSON.stringify(donnees ?? null).length > TAILLE_MAX_SIGNAL) throw new ErreurHttp(413, "Message de visio trop lourd.");

      const maintenant = Date.now();
      if (maintenant - emetteur.signaux.depuis > 10_000) emetteur.signaux = { n: 0, depuis: maintenant };
      if (++emetteur.signaux.n > SIGNAUX_MAX_10S) throw new ErreurHttp(429, "Trop de messages de visio : patiente un instant.");
      emetteur.vuLe = maintenant;

      envoyer(destinataire, { genre: "signal", de, type, donnees: donnees ?? null }, seanceId);
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/visio/:seanceId/battement",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const { pairId } = valider(schemaPair, req.body);
      const c = classes.get(idParam(req, "seanceId"));
      const p = c?.pairs.get(pairId);
      if (!c || !p || p.utilisateurId !== u.id) {
        return res.status(404).json({ message: "Tu n'es plus connecté à la visio : reconnexion…", rejoindre: true });
      }
      p.vuLe = Date.now();
      res.json({ formateur: c.formateurPairId ? { pairId: c.formateurPairId } : null });
    }),
  );

  app.post(
    "/api/visio/:seanceId/quitter",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const { pairId } = valider(schemaPair, req.body);
      const c = classes.get(idParam(req, "seanceId"));
      const p = c?.pairs.get(pairId);
      if (c && p && p.utilisateurId === u.id) retirer(c, pairId);
      res.json({ ok: true });
    }),
  );

  app.get(
    "/api/visio/:seanceId/pairs",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const seance = await seanceVisible(u, idParam(req, "seanceId"));
      if (!(await peutAnimer(u, seance)) && !estEquipe(u)) throw interdit("Seul le formateur du cours voit les participants de la visio.");
      const c = classes.get(seance.id);
      res.setHeader("Cache-Control", "no-store");
      const participants = c ? [...c.pairs.values()].filter((p) => p.pairId !== c.formateurPairId) : [];
      const etudiants = participants.filter((p) => p.role === "etudiant");
      res.json({
        formateur: c?.formateurPairId ? { pairId: c.formateurPairId } : null,
        participants: participants.map(publicPair),
        sites: await listeSites(),
        places: { video: PLACES_VIDEO, videoPrises: etudiants.filter((p) => p.video).length, total: PLACES_TOTAL, prises: etudiants.length },
      } satisfies PairsVisio);
    }),
  );

  // ── Radio d'essai (page /visio/essai) : on s'écoute soi-même ─────────────
  // Déclarée avant les routes /api/radio/:seanceId pour ne pas s'y confondre.

  // Corps binaire sur ces seules routes (1 Mo au plus : un morceau d'une seconde pèse 3 à 4 Ko).
  const lireBrut = express.raw({ type: ["application/octet-stream", "audio/webm"], limit: "1mb" });
  const brut: RequestHandler = (req, res, next) =>
    lireBrut(req, res, (err?: unknown) => {
      if ((err as { type?: string } | undefined)?.type === "entity.too.large") return next(new ErreurHttp(413, "Morceau audio trop lourd (1 Mo au plus)."));
      next(err);
    });

  app.post(
    "/api/radio/essai/morceau",
    exigerConnexion,
    brut,
    route(async (req, res) => {
      const u = moi(req);
      const e = emissionDe(`essai-${u.id}`, null);
      if (req.query.debut !== "1" && e.depuis && Date.now() - e.depuis > DUREE_MAX_ESSAI_MS) {
        couper(e, "fin");
        return res.status(409).json({ message: "Essai terminé.", fin: true });
      }
      recevoirMorceau(e, req, res);
    }),
  );

  app.get(
    "/api/radio/essai/ecoute",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      ouvrirEcoute(emissions.get(`essai-${u.id}`), u, req, res);
    }),
  );

  app.post(
    "/api/radio/essai/fin",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const e = emissions.get(`essai-${u.id}`);
      if (e) {
        couper(e, "fin");
        emissions.delete(e.cle);
      }
      res.json({ ok: true });
    }),
  );

  // ── Radio du cours ───────────────────────────────────────────────────────

  app.post(
    "/api/radio/:seanceId/morceau",
    exigerConnexion,
    brut,
    route(async (req, res) => {
      const u = moi(req);
      const seance = await seanceOuverte(u, idParam(req, "seanceId"));
      if (!(await peutAnimer(u, seance))) throw interdit("Seul le formateur du cours émet la radio.");
      recevoirMorceau(emissionDe(String(seance.id), seance.id), req, res);
    }),
  );

  app.post(
    "/api/radio/:seanceId/fin",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const seance = await seanceVisible(u, idParam(req, "seanceId"));
      if (!(await peutAnimer(u, seance))) throw interdit("Seul le formateur du cours arrête la radio.");
      const e = emissions.get(String(seance.id));
      if (e) couper(e, "fin");
      res.json({ ok: true });
    }),
  );

  app.get(
    "/api/radio/:seanceId/ecoute",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const seance = await seanceVisible(u, idParam(req, "seanceId"));
      ouvrirEcoute(emissions.get(String(seance.id)), u, req, res);
    }),
  );

  app.get(
    "/api/radio/:seanceId/etat",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const seance = await seanceVisible(u, idParam(req, "seanceId"));
      res.setHeader("Cache-Control", "no-store");
      res.json(etatRadio(emissions.get(String(seance.id))));
    }),
  );

  // ── Ménage ───────────────────────────────────────────────────────────────

  planifier("visio-menage", 10_000, async () => {
    const limite = Date.now() - DELAI_DISPARITION_MS;
    for (const c of [...classes.values()]) {
      for (const p of [...c.pairs.values()]) if (p.vuLe < limite) retirer(c, p.pairId);
    }
    for (const e of [...emissions.values()]) {
      const silence = Date.now() - e.dernierMorceau;
      if (e.enDirect && silence > SILENCE_MAX_MS) couper(e, "fin");
      // Les radios d'essai et les émissions éteintes sans auditeur ne gardent rien en mémoire.
      if (!e.enDirect && !e.auditeurs.size && silence > 60_000) emissions.delete(e.cle);
    }
  });
}
