// Chefs d'orchestre de la visio en étoile.
//
//  - CentreVisio (formateur) : appelle chaque salle et chaque étudiant, leur
//    envoie son image et son son, relaie la parole (salle ou étudiant) vers
//    les autres, et écoute les salles.
//  - PeripherieVisio (salle, étudiant) : attend l'appel du formateur, lui
//    répond, reçoit son image, son son et les relais.
//
// Les deux se présentent au serveur (rejoindre), battent toutes les 10 s pour
// signaler qu'ils sont là, et rejoignent de nouveau après une coupure du temps
// réel ou un redémarrage du serveur. Tout ce qui est affiché passe par vue().
import { ErreurApi, post } from "@/lib/api";
import type { EtatVisio } from "../SceneVisioCampus";
import type { EvenementVisio, ParticipantVisio, ReponseRejoindreVisio, TypeSignalVisio } from "@shared/schema";
import { PairWebRTC, type EtatPair, type Etiquette, type MessageCanal } from "./pair";
import { Signalisation, type DonneesSignal } from "./signalisation";
import { arreter, idAleatoire, messageErreurMedia, obtenirCamera, obtenirMicro, VIDEO_FORMATEUR, VIDEO_SALLE } from "./medias";

type Rappels = {
  /** Quelque chose a changé à l'écran. */
  maj: () => void;
  surEtat: (etat: EtatVisio) => void;
};

const BATTEMENT_MS = 10_000;

abstract class BaseVisio {
  readonly pairId = idAleatoire(20);
  etat: EtatVisio = "connexion";
  message: string | null = null;
  protected signal: Signalisation;
  protected iceServers: RTCIceServer[] = [];
  protected rejoint = false;
  protected arrete = false;
  /** Formateur : la classe a été reprise dans un autre onglet ; on ne se réannonce plus tout seul. */
  protected suspendu = false;
  private minuteurBattement: ReturnType<typeof setInterval> | null = null;
  private minuteurRejoindre: ReturnType<typeof setTimeout> | null = null;
  private tentatives = 0;
  private rejoindreEnCours = false;
  /** Chaîne des changements de micro/caméra (un getUserMedia à la fois). */
  protected fileMedias: Promise<void> = Promise.resolve();

  constructor(
    protected seanceId: number,
    protected rappels: Rappels,
  ) {
    this.signal = new Signalisation({
      seanceId,
      pairId: this.pairId,
      surOublie: () => this.planifierRejoindre(0),
      surParti: (vers) => this.surParti(vers),
    });
    window.addEventListener("pagehide", this.surPagehide);
    window.addEventListener("online", this.surEnLigne);
  }

  /** État du temps réel du campus : chaque reconnexion déclenche une nouvelle présentation au serveur. */
  fluxConnecte(ok: boolean) {
    if (this.arrete || this.suspendu) return;
    if (ok) this.planifierRejoindre(0);
    // Les médias passent en direct entre navigateurs : tant qu'ils circulent, la classe continue.
    else if (this.rejoint && !this.mediasActifs()) this.definirEtat("reconnexion", "Connexion au campus perdue. On se reconnecte…");
  }

  arreter() {
    if (this.arrete) return;
    this.arrete = true;
    if (this.minuteurBattement) clearInterval(this.minuteurBattement);
    if (this.minuteurRejoindre) clearTimeout(this.minuteurRejoindre);
    window.removeEventListener("pagehide", this.surPagehide);
    window.removeEventListener("online", this.surEnLigne);
    if (this.rejoint) void post(`/api/visio/${this.seanceId}/quitter`, { pairId: this.pairId }).catch(() => undefined);
    this.signal.fermer();
    this.definirEtat("ferme", null);
  }

  protected abstract corpsRejoindre(): Record<string, unknown>;
  protected abstract apresRejoindre(r: ReponseRejoindreVisio): void;
  protected abstract surParti(vers: string): void;
  protected abstract surBattement(formateur: { pairId: string } | null): void;
  protected abstract surReseauRevenu(): void;
  /** Au moins une connexion directe fonctionne. */
  protected abstract mediasActifs(): boolean;

  protected definirEtat(etat: EtatVisio, message: string | null) {
    const change = etat !== this.etat;
    this.etat = etat;
    this.message = message;
    if (change) this.rappels.surEtat(etat);
    this.rappels.maj();
  }

  protected planifierRejoindre(ms: number) {
    if (this.arrete) return;
    if (this.minuteurRejoindre) clearTimeout(this.minuteurRejoindre);
    this.minuteurRejoindre = setTimeout(() => {
      this.minuteurRejoindre = null;
      void this.rejoindre();
    }, ms);
  }

  private async rejoindre() {
    if (this.arrete || this.suspendu || this.rejoindreEnCours) return;
    this.rejoindreEnCours = true;
    try {
      const r = await post<ReponseRejoindreVisio>(`/api/visio/${this.seanceId}/rejoindre`, { pairId: this.pairId, ...this.corpsRejoindre() });
      if (this.arrete) return;
      this.iceServers = r.iceServers;
      this.rejoint = true;
      this.tentatives = 0;
      this.demarrerBattement();
      this.apresRejoindre(r);
    } catch (e) {
      if (this.arrete) return;
      // Refus définitif (séance terminée, accès refusé) : on le dit simplement.
      if (e instanceof ErreurApi && [400, 401, 403, 404, 409].includes(e.statut)) {
        this.definirEtat("echec", e.message);
        return;
      }
      // Réseau ou serveur indisponible : nouvel essai, de plus en plus espacé.
      this.tentatives++;
      this.definirEtat(this.rejoint ? "reconnexion" : "connexion", "Le réseau est lent. Nouvel essai dans un instant…");
      this.planifierRejoindre(Math.min(20_000, 1000 * 2 ** Math.min(this.tentatives, 5)));
    } finally {
      this.rejoindreEnCours = false;
    }
  }

  private demarrerBattement() {
    if (this.minuteurBattement) return;
    this.minuteurBattement = setInterval(() => void this.battre(), BATTEMENT_MS);
  }

  private async battre() {
    if (this.arrete || this.suspendu) return;
    try {
      const r = await post<{ formateur: { pairId: string } | null }>(`/api/visio/${this.seanceId}/battement`, { pairId: this.pairId });
      this.surBattement(r.formateur);
    } catch (e) {
      // Le serveur ne nous connaît plus (redémarrage, longue coupure) : on se présente de nouveau.
      if (e instanceof ErreurApi && e.statut === 404) this.planifierRejoindre(0);
    }
  }

  private surPagehide = () => {
    // Fermeture de l'onglet : on prévient tout de suite (sinon le ménage du serveur s'en charge en 35 s).
    if (!this.rejoint || this.arrete) return;
    const corps = new Blob([JSON.stringify({ pairId: this.pairId })], { type: "application/json" });
    navigator.sendBeacon?.(`/api/visio/${this.seanceId}/quitter`, corps);
  };

  private surEnLigne = () => {
    if (!this.arrete) this.surReseauRevenu();
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Formateur
// ════════════════════════════════════════════════════════════════════════════

export type EntreeCentre = {
  info: ParticipantVisio;
  pair: PairWebRTC | null;
  etat: EtatPair;
  audio: MediaStreamTrack | null;
  video: MediaStreamTrack | null;
  medias: { micro: boolean; camera: boolean };
  reseauFaible: boolean;
  echecs: number;
  minuteurRecreation: ReturnType<typeof setTimeout> | null;
  /** Absent de la liste du serveur (redémarré ?) mais encore connecté : on attend qu'il se réannonce. */
  aConfirmerDepuis: number | null;
};

/** Délai de grâce après un redémarrage du serveur : chacun a le temps de se réannoncer sans couper les médias. */
const GRACE_MS = 25_000;

export type VueCentre = {
  etat: EtatVisio;
  message: string | null;
  erreurMedia: string | null;
  local: { micro: boolean; video: MediaStreamTrack | null };
  salles: EntreeCentre[];
  etudiants: EntreeCentre[];
  /** Pistes audio à jouer chez le formateur : les salles et l'étudiant qui a la parole. */
  sons: { id: string; piste: MediaStreamTrack }[];
  paroleSalle: EntreeCentre | null;
  paroleEtudiant: EntreeCentre | null;
};

export class CentreVisio extends BaseVisio {
  private entrees = new Map<string, EntreeCentre>();
  private local: { audio: MediaStreamTrack | null; video: MediaStreamTrack | null } = { audio: null, video: null };
  private micro = false;
  private parole: { siteId: number | null; utilisateurId: number | null } = { siteId: null, utilisateurId: null };
  private erreurMedia: string | null = null;
  private minuteurStats: ReturnType<typeof setInterval>;

  constructor(
    seanceId: number,
    rappels: Rappels & { surFluxLocal: (flux: MediaStream | null) => void },
  ) {
    super(seanceId, rappels);
    this.surFluxLocal = rappels.surFluxLocal;
    this.minuteurStats = setInterval(() => void this.mesurer(), 4000);
  }

  private surFluxLocal: (flux: MediaStream | null) => void;

  vue(): VueCentre {
    const toutes = [...this.entrees.values()];
    const { salle, etudiant } = this.orateurs();
    const sons: VueCentre["sons"] = [];
    for (const e of toutes) {
      if (!e.audio || e.etat === "ferme") continue;
      if (e.info.role === "salle" || e === etudiant) sons.push({ id: `${e.info.pairId}-${e.audio.id}`, piste: e.audio });
    }
    return {
      etat: this.etat,
      message: this.message,
      erreurMedia: this.erreurMedia,
      local: { micro: this.micro && Boolean(this.local.audio), video: this.local.video },
      salles: toutes.filter((e) => e.info.role === "salle"),
      etudiants: toutes.filter((e) => e.info.role === "etudiant"),
      sons,
      paroleSalle: salle,
      paroleEtudiant: etudiant,
    };
  }

  /** Allume ou coupe micro et caméra (un changement à la fois). */
  definirMedias(micro: boolean, camera: boolean) {
    this.fileMedias = this.fileMedias.then(() => this.appliquerMedias(micro, camera)).catch(() => undefined);
  }

  definirParole(siteId: number | null, utilisateurId: number | null) {
    if (this.parole.siteId === siteId && this.parole.utilisateurId === utilisateurId) return;
    this.parole = { siteId, utilisateurId };
    this.appliquerPistes();
    this.rappels.maj();
  }

  recevoir(ev: EvenementVisio) {
    if (this.arrete || ev.vers !== this.pairId) return;
    switch (ev.genre) {
      case "signal":
        this.recevoirSignal(ev.de, ev.type, ev.donnees as DonneesSignal);
        break;
      case "pair-arrive":
        this.ajouter(ev.participant);
        break;
      case "pair-part":
        this.retirer(ev.pairId);
        break;
      case "remplace":
        // La classe a été ouverte dans un autre onglet ou sur un autre appareil.
        this.suspendu = true;
        for (const id of [...this.entrees.keys()]) this.retirer(id, false);
        this.rejoint = false;
        this.definirEtat("echec", "La classe est ouverte dans un autre onglet ou sur un autre appareil.");
        break;
      default:
        break;
    }
  }

  /** Reprendre la main après « remplace ». */
  reprendre() {
    this.suspendu = false;
    this.definirEtat("connexion", "Reprise de la classe…");
    this.planifierRejoindre(0);
  }

  override arreter() {
    clearInterval(this.minuteurStats);
    for (const id of [...this.entrees.keys()]) this.retirer(id);
    arreter(this.local.audio);
    arreter(this.local.video);
    this.local = { audio: null, video: null };
    this.surFluxLocal(null);
    super.arreter();
  }

  protected corpsRejoindre() {
    return { role: "formateur" };
  }

  protected apresRejoindre(r: ReponseRejoindreVisio) {
    // Ceux que le serveur ne connaît plus sont partis… sauf s'ils sont encore
    // connectés en direct : le serveur a peut-être redémarré, ils vont se
    // réannoncer (les médias ne passent pas par lui, inutile de couper).
    const presents = new Set(r.participants.map((p) => p.pairId));
    for (const [id, e] of [...this.entrees]) {
      if (presents.has(id)) continue;
      if (e.pair && e.etat === "connecte") e.aConfirmerDepuis ??= Date.now();
      else this.retirer(id, false);
    }
    for (const p of r.participants) this.ajouter(p);
    this.definirEtat("connecte", null);
  }

  protected surParti(vers: string) {
    this.retirer(vers, false);
  }

  protected mediasActifs() {
    return [...this.entrees.values()].some((e) => e.etat === "connecte");
  }

  protected surBattement() {
    if (this.etat === "reconnexion") this.definirEtat("connecte", null);
  }

  protected surReseauRevenu() {
    // Changement de réseau : on relance ICE sur les connexions qui en ont besoin.
    for (const e of this.entrees.values()) if (e.pair && e.etat !== "connecte") e.pair.pc.restartIce();
  }

  private ajouter(info: ParticipantVisio) {
    const existante = this.entrees.get(info.pairId);
    if (existante) {
      existante.info = info;
      existante.aConfirmerDepuis = null;
      // Déjà connectée : rien à refaire (simple nouvelle présentation après une coupure du temps réel).
      if (existante.pair && existante.etat === "connecte") {
        this.appliquerPistes();
        this.rappels.maj();
        return;
      }
      this.creerPair(existante);
      return;
    }
    const e: EntreeCentre = {
      info,
      pair: null,
      etat: "connexion",
      audio: null,
      video: null,
      medias: { micro: true, camera: info.role === "salle" },
      reseauFaible: false,
      echecs: 0,
      minuteurRecreation: null,
      aConfirmerDepuis: null,
    };
    this.entrees.set(info.pairId, e);
    this.creerPair(e);
  }

  private retirer(pairId: string, prevenir = true) {
    const e = this.entrees.get(pairId);
    if (!e) return;
    if (e.minuteurRecreation) clearTimeout(e.minuteurRecreation);
    this.entrees.delete(pairId);
    const pair = e.pair;
    e.pair = null;
    pair?.fermer(prevenir);
    this.appliquerPistes();
    this.rappels.maj();
  }

  private creerPair(e: EntreeCentre) {
    if (e.minuteurRecreation) clearTimeout(e.minuteurRecreation);
    e.minuteurRecreation = null;
    const ancienne = e.pair;
    e.pair = null;
    ancienne?.fermer(true);
    e.audio = null;
    e.video = null;
    e.etat = "connexion";
    const vers = e.info.pairId;
    const pair = new PairWebRTC({
      moi: "formateur",
      distant: { pairId: vers, role: e.info.role },
      iceServers: this.iceServers,
      envoyer: (type, donnees) => this.signal.envoyer(vers, type, donnees),
      candidat: (connexion, c) => this.signal.candidat(vers, connexion, c),
      surPiste: (etiquette, piste) => {
        if (e.pair !== pair) return;
        if (etiquette === "audio") e.audio = piste;
        if (etiquette === "video") e.video = piste;
        this.appliquerPistes();
        this.rappels.maj();
      },
      surEtat: (etat) => {
        if (e.pair !== pair) return;
        e.etat = etat;
        if (etat === "connecte") {
          e.echecs = 0;
          this.appliquerPistes();
        }
        // L'autre côté a raccroché sans quitter la visio : il attend une connexion neuve.
        if (etat === "ferme") this.planifierRecreation(e);
        this.rappels.maj();
      },
      surMessage: (m) => {
        if (m.t === "medias") e.medias = { micro: m.micro, camera: m.camera };
        this.rappels.maj();
      },
      surEchec: () => {
        if (e.pair === pair) this.planifierRecreation(e);
      },
    });
    e.pair = pair;
    this.pistesPour(e, this.orateurs());
    pair.envoyerMessage({ t: "medias", micro: this.micro, camera: Boolean(this.local.video) });
    this.rappels.maj();
  }

  /** Recrée une connexion qui n'aboutit pas, en espaçant les essais (2, 4, 8… 30 s). */
  private planifierRecreation(e: EntreeCentre) {
    if (e.minuteurRecreation || this.arrete) return;
    e.echecs++;
    e.etat = "reconnexion";
    this.rappels.maj();
    e.minuteurRecreation = setTimeout(
      () => {
        e.minuteurRecreation = null;
        if (this.entrees.get(e.info.pairId) === e && !this.arrete) this.creerPair(e);
      },
      Math.min(30_000, 1000 * 2 ** e.echecs),
    );
  }

  private recevoirSignal(de: string, type: TypeSignalVisio, d: DonneesSignal) {
    const e = this.entrees.get(de);
    if (!e?.pair || !d?.connexion) return;
    if (e.pair.connexionId === d.connexion) {
      e.pair.recevoir(type, d);
    } else if (type === "offre") {
      // Offre d'une ancienne connexion (l'autre côté ne sait pas encore qu'on l'a recréée) : on la clôt.
      this.signal.envoyer(de, "raccrocher", { connexion: d.connexion });
    }
  }

  /** La salle et l'étudiant qui ont la parole (connectés). */
  private orateurs(): { salle: EntreeCentre | null; etudiant: EntreeCentre | null } {
    const toutes = [...this.entrees.values()];
    const salle =
      this.parole.siteId == null
        ? null
        : toutes
            .filter((e) => e.info.role === "salle" && e.info.siteId === this.parole.siteId && e.pair)
            // Deux ordinateurs dans la même salle : le plus récent.
            .sort((a, b) => b.info.rejointLe.localeCompare(a.info.rejointLe))[0] ?? null;
    const etudiant =
      this.parole.utilisateurId == null
        ? null
        : toutes.find((e) => e.info.role === "etudiant" && e.info.utilisateurId === this.parole.utilisateurId && e.pair) ?? null;
    return { salle, etudiant };
  }

  /** Pistes envoyées à chacun : image et son du formateur, et relais de la parole vers tous les autres. */
  private appliquerPistes() {
    const orateurs = this.orateurs();
    for (const e of this.entrees.values()) this.pistesPour(e, orateurs);
  }

  private pistesPour(e: EntreeCentre, { salle, etudiant }: { salle: EntreeCentre | null; etudiant: EntreeCentre | null }) {
    const p = e.pair;
    if (!p) return;
    p.definirPiste("audio", this.local.audio);
    p.definirPiste("video", e.info.role === "etudiant" && !e.info.video ? null : this.local.video);
    p.definirPiste("relaisAudioSalle", salle && salle !== e ? salle.audio : null);
    if (e.info.role === "salle") p.definirPiste("relaisVideoSalle", salle && salle !== e ? salle.video : null);
    p.definirPiste("relaisAudioEtudiant", etudiant && etudiant !== e ? etudiant.audio : null);
    // Pas de nom d'étudiant vers les salles ni vers les autres étudiants.
    p.envoyerMessage({ t: "parole", salle: salle && salle !== e ? salle.info.nom : null, etudiant: Boolean(etudiant && etudiant !== e), vous: e === salle || e === etudiant });
  }

  private async appliquerMedias(micro: boolean, camera: boolean) {
    if (this.arrete) return;
    this.micro = micro;
    this.erreurMedia = null;
    // Micro : on garde la piste quand il est coupé (reprise immédiate, la radio continue en silence).
    if (micro && !this.local.audio) {
      try {
        this.local.audio = await obtenirMicro();
      } catch (e) {
        this.erreurMedia = messageErreurMedia(e, false, "micro");
      }
    }
    if (this.local.audio) this.local.audio.enabled = micro;
    // Caméra : vraiment éteinte quand elle est coupée (voyant éteint, processeur soulagé).
    if (camera && !this.local.video) {
      try {
        this.local.video = await obtenirCamera(VIDEO_FORMATEUR);
      } catch (e) {
        this.erreurMedia = messageErreurMedia(e, false, "caméra");
      }
    } else if (!camera && this.local.video) {
      arreter(this.local.video);
      this.local.video = null;
    }
    if (this.arrete) {
      arreter(this.local.audio);
      arreter(this.local.video);
      return;
    }
    this.appliquerPistes();
    for (const e of this.entrees.values()) e.pair?.envoyerMessage({ t: "medias", micro, camera: Boolean(this.local.video) });
    const pistes = [this.local.audio, this.local.video].filter((p): p is MediaStreamTrack => Boolean(p));
    this.surFluxLocal(pistes.length ? new MediaStream(pistes) : null);
    this.rappels.maj();
  }

  /** Indicateur « réseau faible » par salle (pertes > 5 % ou aller-retour > 700 ms). */
  private async mesurer() {
    let change = false;
    // Délai de grâce écoulé sans nouvelle du participant : il est vraiment parti.
    for (const [id, e] of [...this.entrees]) if (e.aConfirmerDepuis && Date.now() - e.aConfirmerDepuis > GRACE_MS) this.retirer(id, false);
    for (const e of this.entrees.values()) {
      if (!e.pair || e.etat !== "connecte") continue;
      const m = await e.pair.mesurer().catch(() => null);
      if (!m) continue;
      const faible = m.pertes > 0.05 || (m.rtt ?? 0) > 0.7;
      if (faible !== e.reseauFaible) {
        e.reseauFaible = faible;
        change = true;
      }
    }
    if (change) this.rappels.maj();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Salle de conférence et étudiant en ligne
// ════════════════════════════════════════════════════════════════════════════

export type VuePeripherie = {
  etat: EtatVisio;
  message: string | null;
  erreurMedia: string | null;
  attenteFormateur: boolean;
  /** Étudiant : plus de place en visio, il écoute la radio. */
  complet: boolean;
  videoAccordee: boolean;
  formateur: { video: MediaStreamTrack | null; camera: boolean; micro: boolean };
  relaisVideoSalle: MediaStreamTrack | null;
  sons: { id: string; piste: MediaStreamTrack }[];
  parole: { salle: string | null; etudiant: boolean; vous: boolean };
  local: { video: MediaStreamTrack | null; micro: boolean };
};

export class PeripherieVisio extends BaseVisio {
  private pair: PairWebRTC | null = null;
  private formateurPairId: string | null = null;
  private recues: Partial<Record<Etiquette, MediaStreamTrack>> = {};
  private local: { audio: MediaStreamTrack | null; video: MediaStreamTrack | null } = { audio: null, video: null };
  private audioSeul = false;
  private cache = typeof document !== "undefined" && document.hidden;
  private videoAccordee = true;
  private complet = false;
  private erreurMedia: string | null = null;
  private mediasFormateur = { micro: true, camera: true };
  private parole: VuePeripherie["parole"] = { salle: null, etudiant: false, vous: false };
  private minuteurOffre: ReturnType<typeof setTimeout> | null = null;
  private minuteurEchec: ReturnType<typeof setTimeout> | null = null;
  private minuteurCache: ReturnType<typeof setTimeout> | null = null;
  /** Le serveur ne connaît plus le formateur alors qu'on lui est connecté en direct (serveur redémarré ?). */
  private formateurAbsentDepuis: number | null = null;

  constructor(
    seanceId: number,
    private role: "salle" | "etudiant",
    rappels: Rappels,
  ) {
    super(seanceId, rappels);
    document.addEventListener("visibilitychange", this.surVisibilite);
  }

  vue(): VuePeripherie {
    const sons: VuePeripherie["sons"] = [];
    for (const etiquette of ["audio", "relaisAudioSalle", "relaisAudioEtudiant"] as const) {
      const piste = this.recues[etiquette];
      if (piste && this.pair && !this.pair.estFerme) sons.push({ id: `${etiquette}-${piste.id}`, piste });
    }
    // Pendant une reconnexion, on garde la dernière image plutôt qu'un écran noir.
    const connecte = Boolean(this.pair && !this.pair.estFerme);
    return {
      etat: this.etat,
      message: this.message,
      erreurMedia: this.erreurMedia,
      attenteFormateur: this.rejoint && !this.formateurPairId,
      complet: this.complet,
      videoAccordee: this.videoAccordee,
      formateur: {
        video: connecte && this.recevoirVideo() ? this.recues.video ?? null : null,
        camera: this.mediasFormateur.camera,
        micro: this.mediasFormateur.micro,
      },
      relaisVideoSalle: connecte && this.parole.salle ? this.recues.relaisVideoSalle ?? null : null,
      sons,
      parole: this.parole,
      local: { video: this.local.video, micro: Boolean(this.local.audio?.enabled) },
    };
  }

  /**
   * Micro et caméra. Étudiant : le micro ne s'ouvre que s'il a la parole
   * (`parole`) ; il est vraiment libéré ensuite (voyant éteint).
   */
  definirMedias(micro: boolean, camera: boolean, parole: boolean) {
    this.fileMedias = this.fileMedias.then(() => this.appliquerMedias(micro, camera, parole)).catch(() => undefined);
  }

  definirAudioSeul(audioSeul: boolean) {
    if (this.audioSeul === audioSeul) return;
    this.audioSeul = audioSeul;
    // On le dit au serveur : le son seul libère une place vidéo (et un encodage chez le
    // formateur) ; repasser en vidéo en redemande une. La connexion en cours est gardée.
    if (this.rejoint && this.role === "etudiant") this.planifierRejoindre(0);
    this.pair?.definirReceptionVideo(this.recevoirVideo());
    this.rappels.maj();
  }

  recevoir(ev: EvenementVisio) {
    if (this.arrete || ev.vers !== this.pairId) return;
    switch (ev.genre) {
      case "signal":
        this.recevoirSignal(ev.de, ev.type, ev.donnees as DonneesSignal);
        break;
      case "formateur-arrive":
        if (ev.pairId !== this.formateurPairId || !this.pair || this.pair.etat !== "connecte") {
          if (ev.pairId !== this.formateurPairId) this.fermerPair();
          this.formateurPairId = ev.pairId;
          this.attendreOffre();
        }
        break;
      case "formateur-part":
        if (ev.pairId === this.formateurPairId) {
          this.fermerPair();
          this.formateurPairId = null;
          this.definirEtat("reconnexion", "Le formateur s'est déconnecté. Il revient dans un instant…");
        }
        break;
      default:
        break;
    }
  }

  override arreter() {
    document.removeEventListener("visibilitychange", this.surVisibilite);
    for (const m of [this.minuteurOffre, this.minuteurEchec, this.minuteurCache]) if (m) clearTimeout(m);
    this.fermerPair(true);
    arreter(this.local.audio);
    arreter(this.local.video);
    this.local = { audio: null, video: null };
    super.arreter();
  }

  protected corpsRejoindre() {
    return { role: this.role, video: this.role === "etudiant" ? !this.audioSeul : undefined };
  }

  protected apresRejoindre(r: ReponseRejoindreVisio) {
    this.complet = r.complet;
    this.videoAccordee = this.role === "salle" || r.video;
    this.pair?.definirReceptionVideo(this.recevoirVideo());
    if (r.complet) {
      this.definirEtat("echec", "La classe en visio est complète : écoute le cours à la radio.");
      return;
    }
    const f = r.formateur?.pairId ?? null;
    if (this.formateurManquant(f)) return;
    if (f !== this.formateurPairId) this.fermerPair();
    this.formateurPairId = f;
    if (!f) {
      this.definirEtat("connexion", "En attente du formateur…");
      return;
    }
    if (this.pair && this.pair.etat === "connecte") {
      this.definirEtat("connecte", null);
      return;
    }
    this.attendreOffre();
  }

  protected surParti() {
    // Le formateur est parti entre-temps : le serveur nous le dira au prochain battement.
  }

  protected mediasActifs() {
    return this.pair?.etat === "connecte";
  }

  protected surBattement(formateur: { pairId: string } | null) {
    const f = formateur?.pairId ?? null;
    if (this.formateurManquant(f)) return;
    if (f === this.formateurPairId) return;
    // Un événement s'est perdu : on se remet d'aplomb.
    this.fermerPair();
    this.formateurPairId = f;
    if (f) this.attendreOffre();
    else this.definirEtat("connexion", "En attente du formateur…");
  }

  protected surReseauRevenu() {
    if (this.pair && this.pair.etat !== "connecte") this.pair.pc.restartIce();
  }

  /**
   * Le serveur dit « pas de formateur » alors que la connexion directe avec
   * lui fonctionne : on la garde le temps qu'il se réannonce (délai de grâce).
   * Renvoie vrai tant qu'on patiente.
   */
  private formateurManquant(f: string | null): boolean {
    if (f !== null || !this.pair || this.pair.etat !== "connecte") {
      this.formateurAbsentDepuis = null;
      return false;
    }
    this.formateurAbsentDepuis ??= Date.now();
    return Date.now() - this.formateurAbsentDepuis < GRACE_MS;
  }

  private recevoirVideo() {
    return this.role === "salle" || (this.videoAccordee && !this.audioSeul && !this.cache);
  }

  private recevoirSignal(de: string, type: TypeSignalVisio, d: DonneesSignal) {
    if (!d?.connexion) return;
    if (type === "offre") {
      // Nouvelle connexion du formateur (première, ou recréée de zéro) : on repart proprement.
      if (!this.pair || this.pair.estFerme || this.pair.connexionId !== d.connexion) this.creerPair(de, d.connexion);
      this.formateurPairId = de;
    }
    if (this.pair && this.pair.connexionId === d.connexion) this.pair.recevoir(type, d);
  }

  private creerPair(de: string, connexion: string) {
    this.fermerPair();
    if (this.minuteurOffre) clearTimeout(this.minuteurOffre);
    this.minuteurOffre = null;
    const pair = new PairWebRTC({
      moi: this.role,
      distant: { pairId: de, role: "formateur" },
      connexion,
      iceServers: this.iceServers,
      envoyer: (type, donnees) => this.signal.envoyer(de, type, donnees),
      candidat: (cx, c) => this.signal.candidat(de, cx, c),
      surPiste: (etiquette, piste) => {
        if (this.pair !== pair) return;
        this.recues[etiquette] = piste;
        this.rappels.maj();
      },
      surEtat: (etat) => {
        if (this.pair === pair) this.surEtatPair(etat);
      },
      surMessage: (m: MessageCanal) => {
        if (this.pair !== pair) return;
        if (m.t === "medias") this.mediasFormateur = { micro: m.micro, camera: m.camera };
        else this.parole = { salle: m.salle, etudiant: m.etudiant, vous: m.vous };
        this.rappels.maj();
      },
      surEchec: () => {
        // Rien ne passe : on se présente de nouveau, le formateur recréera la connexion.
        if (this.pair === pair) this.planifierRejoindre(0);
      },
    });
    this.pair = pair;
    pair.definirReceptionVideo(this.recevoirVideo());
    pair.definirPiste("audio", this.local.audio);
    if (this.role === "salle") pair.definirPiste("video", this.local.video);
    pair.envoyerMessage({ t: "medias", micro: Boolean(this.local.audio?.enabled), camera: Boolean(this.local.video) });
    if (this.etat === "connecte") this.definirEtat("reconnexion", "Reconnexion au formateur…");
  }

  private surEtatPair(etat: EtatPair) {
    if (etat === "connecte") {
      if (this.minuteurEchec) clearTimeout(this.minuteurEchec);
      this.minuteurEchec = null;
      this.definirEtat("connecte", null);
      return;
    }
    if (etat === "reconnexion") {
      this.definirEtat("reconnexion", "Le réseau a coupé. On reprend…");
      this.armerEchec();
      return;
    }
    if (etat === "ferme" && !this.arrete) {
      // Le formateur a raccroché (il recrée la connexion) : on attend sa nouvelle offre.
      this.recues = {};
      this.definirEtat("reconnexion", "Reconnexion au formateur…");
      this.attendreOffre();
      this.armerEchec();
    }
    this.rappels.maj();
  }

  /** Après 40 s sans image ni son malgré les essais : on le dit (et on propose la radio), sans cesser d'essayer. */
  private armerEchec() {
    if (this.minuteurEchec) return;
    this.minuteurEchec = setTimeout(() => {
      this.minuteurEchec = null;
      if (this.arrete || this.pair?.etat === "connecte") return;
      this.definirEtat(
        "echec",
        this.role === "etudiant"
          ? "La connexion n'aboutit pas sur ce réseau. Écoute le cours à la radio, ça consomme beaucoup moins."
          : "La connexion au formateur n'aboutit pas. Vérifiez le réseau de la salle ; on continue d'essayer.",
      );
    }, 40_000);
  }

  /** Le formateur doit nous appeler ; sans offre sous 12 s, on se présente de nouveau (il nous a peut-être manqués). */
  private attendreOffre() {
    if (this.minuteurOffre) clearTimeout(this.minuteurOffre);
    if (this.etat !== "echec") this.definirEtat(this.etat === "connecte" ? "reconnexion" : this.etat, "Connexion au formateur…");
    this.armerEchec();
    this.minuteurOffre = setTimeout(() => {
      this.minuteurOffre = null;
      if (this.arrete || (this.pair && !this.pair.estFerme && this.pair.etat !== "ferme")) return;
      this.planifierRejoindre(0);
    }, 12_000);
  }

  private fermerPair(prevenir = false) {
    const pair = this.pair;
    if (!pair) return;
    // On oublie la connexion AVANT de la fermer : sa fermeture volontaire ne doit pas lancer de reconnexion.
    this.pair = null;
    pair.fermer(prevenir);
    this.recues = {};
    this.parole = { salle: null, etudiant: false, vous: false };
  }

  private surVisibilite = () => {
    if (this.role !== "etudiant") return;
    if (this.minuteurCache) clearTimeout(this.minuteurCache);
    // Écran éteint ou autre application : plus d'image au bout de 10 s (le son continue).
    const appliquer = (cache: boolean) => {
      this.cache = cache;
      this.pair?.definirReceptionVideo(this.recevoirVideo());
      this.rappels.maj();
    };
    if (document.hidden) this.minuteurCache = setTimeout(() => appliquer(true), 10_000);
    else appliquer(false);
  };

  private async appliquerMedias(micro: boolean, camera: boolean, parole: boolean) {
    if (this.arrete) return;
    this.erreurMedia = null;
    const tu = this.role === "etudiant";
    const veutMicro = this.role === "salle" ? micro : micro && parole;
    if (veutMicro && !this.local.audio) {
      try {
        this.local.audio = await obtenirMicro();
      } catch (e) {
        this.erreurMedia = messageErreurMedia(e, tu, "micro");
      }
    }
    if (this.local.audio) {
      if (this.role === "etudiant" && !veutMicro) {
        // Étudiant : le micro est rendu dès que la parole lui est reprise.
        arreter(this.local.audio);
        this.local.audio = null;
      } else {
        this.local.audio.enabled = veutMicro;
      }
    }
    if (this.role === "salle") {
      if (camera && !this.local.video) {
        try {
          this.local.video = await obtenirCamera(VIDEO_SALLE);
        } catch (e) {
          this.erreurMedia = messageErreurMedia(e, false, "caméra");
        }
      } else if (!camera && this.local.video) {
        arreter(this.local.video);
        this.local.video = null;
      }
    }
    if (this.arrete) {
      arreter(this.local.audio);
      arreter(this.local.video);
      return;
    }
    this.pair?.definirPiste("audio", this.local.audio);
    if (this.role === "salle") this.pair?.definirPiste("video", this.local.video);
    this.pair?.envoyerMessage({ t: "medias", micro: Boolean(this.local.audio?.enabled), camera: Boolean(this.local.video) });
    this.rappels.maj();
  }
}
