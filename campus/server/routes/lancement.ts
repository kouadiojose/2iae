// Module « lancement » : prêts pour la rentrée.
//
//   GET  /api/pilotage/rentree                    liste de contrôle calculée en direct (direction, vie scolaire)
//   GET  /api/pilotage/rentree/demo               ce que la purge de la démonstration supprimerait (direction)
//   POST /api/pilotage/rentree/demo/purger        supprime la démonstration, et seulement elle (direction)
//   POST /api/pilotage/comptes/:id/invitation     lien d'activation d'un formateur (ou de l'équipe) à envoyer
//   POST /api/pilotage/comptes/:id/invitation/email  envoie ce même lien par e-mail
//   POST /api/pilotage/sites/:id/ecran            installer l'écran de la salle d'un campus (lien + code)
//   POST /api/ecran/installer                     public : l'ordinateur de la salle s'installe (session longue)
//   POST /api/compte/premiere-connexion           le formateur vérifie son nom, choisit son identifiant et son mot de passe
//
// Règles : périmètre de la vie scolaire respecté partout (perimetreSites) ;
// un formateur n'est géré que par la direction ou la vie scolaire du groupe ;
// chaque lien ne sert qu'une fois ; les actions vont au journal.
import type { Express, Request } from "express";
import crypto from "crypto";
import { z } from "zod";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { db, pool } from "../db";
import { config, estProduction } from "../config";
import { bucketFichiersDisponible } from "../fichiers";
import {
  exigerRole,
  exigerConnexion,
  exigerDroit,
  moi,
  perimetreSites,
  hacher,
  verifier,
  versMoi,
  oublierUtilisateur,
  dureeSession,
  longueurMinimale,
  codeSecretAcceptable,
  fermerAutresSessions,
  normaliserTelephone,
  verifierTentatives,
  noterEchec,
  effacerTentatives,
  jetonAleatoire,
  motDePasseProvisoire,
  DUREE_CODE_PROVISOIRE_MS,
} from "../auth";
import { creerJeton, hacherJeton, lienInvitation } from "../activation";
import { route, valider, idParam, ErreurHttp, introuvable, interdit, invalide } from "../http";
import { iaDisponible, raisonIndisponible } from "../ia";
import { emailDisponible, envoyerEmail, emailInvitation, nomAffiche } from "../mail";
import { envoyerGuideBienvenue } from "../guide-bienvenue";
import { notifier } from "../notifications";
import { prevenirSite } from "../site";
import { invaliderJetons } from "./compte";
import { sallePasEncoreNommee, SALLES_INVENTEES } from "../amorcage";
import { ACTION_JOURNAL_DEMO, adresseDeDemonstration } from "../demo-constantes";
import { utilisateurs, sites, journal, reinitialisations, type Utilisateur, type Role } from "@shared/schema";
import type {
  EtatRentree,
  LigneRentree,
  SousLigneRentree,
  EtatControle,
  ActionRentree,
  ApercuPurge,
  ResultatPurge,
  InvitationRemise,
  EnvoiInvitation,
  InstallationEcran,
  EtatEcranSalle,
  InfoInvitation,
  InvitationAcceptee,
} from "@shared/lancement";

const P = "/api/pilotage";
const JOUR_MS = 86_400_000;

/** Première session réelle : lundi 28 septembre 2026 à 08:30, heure d'Abidjan (GMT). */
const RENTREE_PAR_DEFAUT = new Date("2026-09-28T08:30:00Z");
/** Un écran de salle « vu récemment » : connecté dans les 7 derniers jours. */
const RECENT_MS = 7 * JOUR_MS;
/** Un essai visio compte s'il a réussi dans les 14 derniers jours. */
const ESSAI_RECENT_MS = 14 * JOUR_MS;
/**
 * Lien et code d'installation d'un écran : permanents et réutilisables. Les
 * ordinateurs des salles changent (panne, prêt, nouvel ordinateur) : le même
 * lien réinstalle l'écran sans rien demander à personne. Ils ne cessent de
 * marcher que si la direction ou la vie scolaire en prépare de nouveaux
 * (lien qui circule trop). La base exige une date : 30 ans.
 */
const DUREE_INSTALLATION_MS = 30 * 365 * JOUR_MS;

const fmtJour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const fmtJourCourt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
const JOURS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const jourLong = (d: Date) => fmtJour.format(d);
/** « 08h30 », comme partout sur le campus. */
const heure = (d: Date) => fmtHeure.format(d).replace(/\s?h\s?|:/, "h");
const hm = (s: string) => s.replace(":", "h");
const pluriel = (n: number, s: string, p = `${s}s`) => `${n} ${n > 1 ? p : s}`;
const pourcent = (n: number, sur: number) => (sur > 0 ? Math.round((n / sur) * 100) : 0);

/** Il y a combien de temps, en mots simples : « il y a 3 h », « il y a 2 jours ». */
function ilYA(d: Date | string | null): string {
  if (!d) return "jamais";
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 90_000) return "à l'instant";
  if (ms < 3_600_000) return `il y a ${Math.round(ms / 60_000)} min`;
  if (ms < JOUR_MS) return `il y a ${Math.round(ms / 3_600_000)} h`;
  const j = Math.round(ms / JOUR_MS);
  return j === 1 ? "hier" : `il y a ${j} jours`;
}

/** Numéro pour wa.me : un numéro ivoirien (10 chiffres) reçoit l'indicatif 225. */
function numeroWhatsApp(tel: string | null | undefined): string {
  if (!tel) return "";
  const n = normaliserTelephone(tel);
  if (n.length === 10) return `225${n}`;
  if (n.length >= 11 && n.length <= 15) return n;
  return "";
}
const lienWhatsApp = (tel: string | null | undefined, texte: string) => `https://wa.me/${numeroWhatsApp(tel)}?text=${encodeURIComponent(texte)}`;

/** La personne peut-elle gérer ce compte ? (mêmes règles que le pilotage) */
function peutGerer(u: Utilisateur, cible: Pick<Utilisateur, "role" | "siteId">): boolean {
  if (u.role === "admin") return true;
  if (cible.role === "admin") return false;
  const p = perimetreSites(u);
  if (!p) return true;
  if (cible.role === "formateur") return false;
  return cible.siteId !== null && p.includes(cible.siteId);
}

async function journaliser(u: Pick<Utilisateur, "id"> | null, action: string, details: Record<string, unknown> = {}) {
  await db.insert(journal).values({ utilisateurId: u?.id ?? null, action, details });
}

/** Une colonne ou une table d'un autre module existe-t-elle déjà dans cette base ? (mis en cache une minute) */
const cacheSchema = new Map<string, { oui: boolean; exp: number }>();
async function existe(table: string, colonne?: string): Promise<boolean> {
  const cle = `${table}.${colonne ?? ""}`;
  const c = cacheSchema.get(cle);
  if (c && c.exp > Date.now()) return c.oui;
  const r = colonne
    ? await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_schema = 'campus' AND table_name = $1 AND column_name = $2`, [table, colonne])
    : await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'campus' AND table_name = $1`, [table]);
  const oui = (r.rowCount ?? 0) > 0;
  cacheSchema.set(cle, { oui, exp: Date.now() + 60_000 });
  return oui;
}

/**
 * Un compte « salle » qui compte comme l'écran réel d'une salle : jamais un compte de la démonstration (ses
 * cinq écrans fictifs sont semés « installés » et « vus » récemment, et la purge les supprime), sauf si un
 * vrai écran y a été installé avant que l'installation ne crée toujours un compte réel (la purge le garde alors).
 */
const ECRAN_REEL = (e: string) =>
  `(coalesce(${e}.preferences->>'demo', 'false') <> 'true' OR EXISTS (SELECT 1 FROM campus.journal j WHERE j.action = 'ecran_installe' AND j.utilisateur_id = ${e}.id))`;

/** Date du dernier essai visio réussi, lue dans les préférences (écrites par le module visio). */
function essaiReussiLe(preferences: unknown): Date | null {
  const e = (preferences as { essaiVisio?: { dernierSucces?: string | null; reussi?: boolean; le?: string } } | null)?.essaiVisio;
  const brut = e?.dernierSucces ?? (e?.reussi ? e.le : null);
  const d = brut ? new Date(brut) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

/** Année scolaire de septembre à août : « 2026-2027 » à partir du 1er août 2026. */
function anneeScolaire(d = new Date()): string {
  const a = d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${a}-${a + 1}`;
}

/** Pire état d'une liste : à faire > attention > fait. */
function pire(etats: EtatControle[], vide: EtatControle = "a_faire"): EtatControle {
  if (!etats.length) return vide;
  if (etats.includes("a_faire")) return "a_faire";
  if (etats.includes("attention")) return "attention";
  return "fait";
}

const lien = (libelle: string, href: string): ActionRentree => ({ type: "lien", libelle, href });

// ── Emploi du temps : la session de la rentrée ─────────────────────────────

type SessionBrute = {
  id: number;
  titre: string;
  annee_academique: string;
  debut: string;
  fin: string;
  statut: string;
  maj_le: Date;
  synchronisee_le?: Date | null;
};
type CreneauBrut = {
  id: number;
  jour: number;
  heure_debut: string;
  heure_fin: string;
  type: string;
  cours_id: number | null;
  titre: string;
  intervenant_id: number | null;
  intervenant_nom?: string;
  cours_titre: string | null;
  cours_code: string | null;
};

const dateJour = (d: string | Date) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/** Première date (AAAA-MM-JJ) ≥ début qui tombe ce jour de la semaine (1 = lundi … 7 = dimanche), dans la période. */
function premiereDate(debut: string, fin: string, jour: number): Date | null {
  const d = new Date(`${debut}T00:00:00Z`);
  for (let i = 0; i < 7; i++) {
    const x = new Date(d.getTime() + i * JOUR_MS);
    const iso = ((x.getUTCDay() + 6) % 7) + 1;
    if (iso === jour) return x.toISOString().slice(0, 10) <= fin ? x : null;
  }
  return null;
}

async function sessionDeRentree(): Promise<{ session: SessionBrute; creneaux: CreneauBrut[] } | null> {
  if (!(await existe("sessions_programme"))) return null;
  const { rows } = await pool.query<SessionBrute>(
    `SELECT * FROM campus.sessions_programme
      WHERE statut <> 'archivee' AND fin >= (now() AT TIME ZONE 'UTC')::date
      ORDER BY (statut = 'publiee') DESC, debut ASC, id ASC LIMIT 1`,
  );
  const session = rows[0];
  if (!session) return null;
  session.debut = dateJour(session.debut);
  session.fin = dateJour(session.fin);
  const creneaux = (
    await pool.query<CreneauBrut>(
      `SELECT c.*, co.titre AS cours_titre, co.code AS cours_code
         FROM campus.creneaux_programme c LEFT JOIN campus.cours co ON co.id = c.cours_id
        WHERE c.session_id = $1 ORDER BY c.jour, c.heure_debut, c.ordre, c.id`,
      [session.id],
    )
  ).rows;
  return { session, creneaux };
}

/** Moment du premier créneau de la session (heure d'Abidjan = UTC). */
function premierCreneau(session: SessionBrute, creneaux: CreneauBrut[]): Date | null {
  let min: Date | null = null;
  for (const c of creneaux) {
    const d = premiereDate(session.debut, session.fin, c.jour);
    if (!d) continue;
    const [h, m] = c.heure_debut.split(":").map(Number);
    const t = new Date(d.getTime() + (h * 60 + (m || 0)) * 60_000);
    if (!min || t < min) min = t;
  }
  return min;
}

const libelleCreneau = (c: CreneauBrut) => {
  const quoi = c.cours_titre || c.titre || (c.type === "seminaire" ? "Séminaire" : "Créneau");
  const jour = JOURS[c.jour] ?? "";
  return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} ${hm(c.heure_debut)}–${hm(c.heure_fin)} · ${quoi}`.trim();
};

// ── Calcul de la liste de contrôle ─────────────────────────────────────────

type EcranBrut = { id: number; installe: boolean; vu: string | null; prefs: unknown };
type SiteBrut = { id: number; nom: string; nom_court: string; salle_conference: string; ecrans: EcranBrut[] | null };
type ClasseBrute = { id: number; nom: string; site_id: number; site: string; etudiants: number; actives: number; expires: number; en_attente: number };
type FormateurBrut = {
  id: number;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  actif: boolean;
  doit_changer_mot_de_passe: boolean;
  preferences: unknown;
  derniere_connexion: Date | null;
  fuseau?: string | null;
};

async function calculerRentree(u: Utilisateur): Promise<EtatRentree> {
  const p = perimetreSites(u);
  const direction = u.role === "admin";
  const tousLesSites = !p;
  const programme = await sessionDeRentree();
  const lignes: LigneRentree[] = [];

  // Cible : premier cours de la session, sinon le 28 septembre 2026.
  const premier = programme ? premierCreneau(programme.session, programme.creneaux) : null;
  const cibleDate = premier ?? RENTREE_PAR_DEFAUT;
  const annee = programme?.session.annee_academique || anneeScolaire(cibleDate);

  // ── 1. Les campus : salle nommée, écran installé et vu récemment ────────
  const sitesBruts = (
    await pool.query<SiteBrut>(
      `SELECT s.id, s.nom, s.nom_court, s.salle_conference,
              (SELECT json_agg(json_build_object('id', e.id, 'installe', NOT e.doit_changer_mot_de_passe, 'vu', e.derniere_connexion, 'prefs', e.preferences)
                               ORDER BY e.derniere_connexion DESC NULLS LAST, e.id)
                 FROM campus.utilisateurs e WHERE e.role = 'salle' AND e.site_id = s.id AND e.actif AND ${ECRAN_REEL("e")}) AS ecrans
         FROM campus.sites s
        WHERE ($1::int[] IS NULL OR s.id = ANY($1::int[]))
        ORDER BY s.ordre, s.id`,
      [p],
    )
  ).rows;
  const ecranDe = (s: SiteBrut): EcranBrut | null => (s.ecrans ?? []).find((e) => e.installe) ?? s.ecrans?.[0] ?? null;
  {
    const sous: SousLigneRentree[] = sitesBruts.map((s) => {
      const e = ecranDe(s);
      const nommee = !sallePasEncoreNommee(s.salle_conference);
      const recent = Boolean(e?.installe && e.vu && Date.now() - new Date(e.vu).getTime() < RECENT_MS);
      const morceaux = [
        nommee ? s.salle_conference : "Salle à nommer",
        !e ? "aucun écran installé" : !e.installe ? "écran créé, pas encore installé" : recent ? `écran vu ${ilYA(e.vu)}` : `écran installé, pas vu depuis ${e.vu ? ilYA(e.vu).replace("il y a ", "") : "l'installation"}`,
      ];
      const etat: EtatControle = !e || !e.installe ? "a_faire" : !recent || !nommee ? "attention" : "fait";
      const action: ActionRentree | null =
        !e || !e.installe
          ? { type: "ecran", libelle: "Installer l'écran", siteId: s.id }
          : !recent
            ? { type: "ecran", libelle: "Réinstaller l'écran", siteId: s.id }
            : !nommee && direction
              ? lien("Nommer la salle", "/pilotage/classes")
              : null;
      return { libelle: s.nom_court, detail: morceaux.join(" · "), etat, action };
    });
    const prets = sous.filter((x) => x.etat === "fait").length;
    const sansEcran = sous.filter((x) => x.etat === "a_faire").length;
    lignes.push({
      cle: "campus",
      titre: tousLesSites ? "Les cinq salles de conférence" : "La salle de conférence",
      etat: pire(sous.map((x) => x.etat)),
      chiffre: tousLesSites ? `${prets} sur ${sous.length}` : prets ? "Prête" : "À préparer",
      resume: !tousLesSites
        ? sansEcran
          ? "L'écran de la salle n'est pas encore installé : son ordinateur s'installe avec un lien ou un code, et reste connecté."
          : prets
            ? "L'écran de la salle est installé et connecté cette semaine."
            : "L'écran est installé. Reste à le rallumer, ou à faire nommer la salle par la direction."
        : sansEcran
          ? `${pluriel(sansEcran, "salle")} sans écran installé. L'ordinateur de la salle s'installe avec un lien ou un code, et reste connecté.`
          : prets === sous.length
            ? "Chaque salle a son écran installé et connecté cette semaine."
            : "Les écrans sont installés. Reste à nommer les salles ou à rallumer un écran.",
      action: null,
      sousLignes: sous,
    });
  }

  // ── 2. Les classes de l'année ────────────────────────────────────────────
  const classesBrutes = (
    await pool.query<ClasseBrute>(
      `SELECT c.id, c.nom, c.site_id, s.nom_court AS site,
              count(e.id) FILTER (WHERE e.actif)::int AS etudiants,
              count(e.id) FILTER (WHERE e.actif AND NOT e.doit_changer_mot_de_passe)::int AS actives,
              count(e.id) FILTER (WHERE e.actif AND e.doit_changer_mot_de_passe AND e.mot_de_passe_expire_le < now())::int AS expires,
              count(e.id) FILTER (WHERE e.actif AND e.doit_changer_mot_de_passe AND (e.mot_de_passe_expire_le IS NULL OR e.mot_de_passe_expire_le >= now()))::int AS en_attente
         FROM campus.classes c
         JOIN campus.sites s ON s.id = c.site_id
         LEFT JOIN campus.utilisateurs e ON e.classe_id = c.id AND e.role = 'etudiant'
        WHERE c.annee_scolaire = $1 AND ($2::int[] IS NULL OR c.site_id = ANY($2::int[]))
        GROUP BY c.id, s.nom_court, s.ordre
        ORDER BY s.ordre, c.nom`,
      [annee, p],
    )
  ).rows;
  {
    const sous: SousLigneRentree[] = sitesBruts.map((s) => {
      const cl = classesBrutes.filter((c) => c.site_id === s.id);
      return {
        libelle: s.nom_court,
        detail: cl.length ? cl.map((c) => c.nom).join(" · ") : `Aucune classe ${annee} pour l'instant`,
        etat: cl.length ? "fait" : "a_faire",
        action: cl.length ? null : lien("Créer une classe", "/pilotage/classes"),
      };
    });
    const avec = sous.filter((x) => x.etat === "fait").length;
    lignes.push({
      cle: "classes",
      titre: `Les classes ${annee}`,
      etat: pire(sous.map((x) => x.etat)),
      chiffre: classesBrutes.length ? pluriel(classesBrutes.length, "classe") : "Aucune",
      resume: !classesBrutes.length
        ? `Aucune classe ${annee}. Créez le tronc commun 1BTS / 2BTS de chaque campus.`
        : tousLesSites
          ? `${avec} campus sur ${sous.length} ont leurs classes ${annee}.`
          : `Votre campus a ${pluriel(classesBrutes.length, "classe")} ${annee}.`,
      action: lien("Classes et campus", "/pilotage/classes"),
      sousLignes: sous,
    });
  }

  // ── 3. Les formateurs de l'emploi du temps ───────────────────────────────
  const avecFuseau = await existe("utilisateurs", "fuseau");
  const intervenantsIds = [...new Set((programme?.creneaux ?? []).map((c) => c.intervenant_id).filter((x): x is number => x !== null))];
  const formateurs = (
    await pool.query<FormateurBrut>(
      `SELECT id, prenom, nom, email, telephone, actif, doit_changer_mot_de_passe, preferences, derniere_connexion${avecFuseau ? ", fuseau" : ""}
         FROM campus.utilisateurs
        WHERE ${programme ? "id = ANY($1::int[])" : "role = 'formateur' AND actif AND coalesce(preferences->>'demo', 'false') <> 'true' AND $1::int[] IS NOT NULL"}
        ORDER BY nom, prenom`,
      [intervenantsIds],
    )
  ).rows;
  const invitations = new Map<number, Date>(
    (
      // Invité : lien d'invitation (fenêtre « Inviter »), ou fiche de connexion / nouveau code remis.
      await pool.query<{ id: string; le: Date }>(
        `SELECT coalesce(details->>'compteId', details->>'pour') AS id, max(cree_le) AS le FROM campus.journal
          WHERE (action IN ('invitation', 'invitation_email') AND details->>'compteId' = ANY($1::text[]))
             OR (action = 'nouveau_code' AND details->>'pour' = ANY($1::text[]))
          GROUP BY 1`,
        [formateurs.map((f) => String(f.id))],
      )
    ).rows.map((r) => [Number(r.id), new Date(r.le)]),
  );
  {
    const sous: SousLigneRentree[] = [];
    const peutInviter = u.role === "admin" || !p;
    for (const f of formateurs) {
      const quand = (programme?.creneaux ?? []).filter((c) => c.intervenant_id === f.id).map(libelleCreneau);
      const active = !f.doit_changer_mot_de_passe;
      const invite = invitations.get(f.id);
      const fuseauConnu = !avecFuseau || Boolean(f.fuseau);
      let etat: EtatControle;
      let detail: string;
      let action: ActionRentree | null = null;
      if (!f.actif) {
        etat = "a_faire";
        detail = "Compte désactivé";
        action = peutInviter ? lien("Voir le compte", `/pilotage/comptes?q=${encodeURIComponent(f.nom)}`) : null;
      } else if (active) {
        etat = fuseauConnu ? "fait" : "attention";
        detail = fuseauConnu ? `Activé · vu ${ilYA(f.derniere_connexion)}` : "Activé · fuseau horaire à confirmer dans son profil";
      } else if (invite) {
        etat = "attention";
        detail = `Invité ${fmtJourCourt.format(invite)}, pas encore activé`;
        action = peutInviter ? { type: "inviter", libelle: "Renvoyer l'invitation", compteId: f.id } : null;
      } else {
        etat = "a_faire";
        detail = "Pas encore invité";
        action = peutInviter ? { type: "inviter", libelle: "Inviter", compteId: f.id } : null;
      }
      sous.push({ libelle: nomAffiche(f), detail: [detail, ...quand].join(" · "), etat, action });
    }
    // Créneaux sans compte formateur (un nom imprimé seulement, ou personne).
    for (const c of (programme?.creneaux ?? []).filter((x) => x.type === "cours" && !x.intervenant_id)) {
      const nom = c.intervenant_nom?.trim();
      sous.push({
        libelle: nom || "Intervenant à choisir",
        detail: `${nom ? "Pas de compte sur le campus : il ne pourra pas ouvrir sa classe en direct" : "Aucun intervenant pour ce cours"} · ${libelleCreneau(c)}`,
        etat: "a_faire",
        action: peutInviter ? (nom ? lien("Créer son compte", `/pilotage/comptes?nouveau=formateur&nom=${encodeURIComponent(nom)}`) : lien("Choisir l'intervenant", `/pilotage/programme/${programme!.session.id}`)) : null,
      });
    }
    const activesN = formateurs.filter((f) => f.actif && !f.doit_changer_mot_de_passe).length;
    const total = sous.length;
    lignes.push({
      cle: "formateurs",
      titre: "Les formateurs de l'emploi du temps",
      etat: pire(sous.map((x) => x.etat)),
      chiffre: total ? `${activesN} sur ${total} activés` : "Aucun",
      resume: !programme
        ? "Saisissez d'abord l'emploi du temps : chaque créneau désigne son formateur."
        : !total
          ? "Aucun formateur n'est désigné dans l'emploi du temps."
          : activesN === total
            ? "Tous les formateurs ont activé leur compte."
            : "Invitez chaque formateur : il reçoit un lien, vérifie son nom, choisit son identifiant et son mot de passe.",
      action: !programme ? lien("Saisir l'emploi du temps", "/pilotage/programme") : null,
      sousLignes: sous,
    });
  }

  // ── 4. L'emploi du temps publié et ses séances ───────────────────────────
  {
    const sous: SousLigneRentree[] = [];
    let etat: EtatControle = "a_faire";
    let chiffre = "Non saisi";
    let resume = "Aucun emploi du temps pour la rentrée. Saisissez la première session : ses séances en direct seront créées à la publication.";
    let action: ActionRentree | null = lien("Saisir l'emploi du temps", "/pilotage/programme");
    if (programme) {
      const s = programme.session;
      const href = `/pilotage/programme/${s.id}`;
      const [compte] = (
        await pool.query<{ actives: number; annulees: number; premiere: Date | null; derniere: Date | null }>(
          `SELECT count(*) FILTER (WHERE se.statut <> 'annulee')::int AS actives,
                  count(*) FILTER (WHERE se.statut = 'annulee')::int AS annulees,
                  min(se.debut) FILTER (WHERE se.statut <> 'annulee') AS premiere,
                  max(se.debut) FILTER (WHERE se.statut <> 'annulee') AS derniere
             FROM campus.seances_creneaux sc
             JOIN campus.creneaux_programme c ON c.id = sc.creneau_id
             JOIN campus.seances se ON se.id = sc.seance_id
            WHERE c.session_id = $1`,
          [s.id],
        )
      ).rows;
      const parCreneau = new Map<number, number>(
        (
          await pool.query<{ id: number; n: number }>(
            `SELECT sc.creneau_id AS id, count(*)::int AS n FROM campus.seances_creneaux sc
               JOIN campus.seances se ON se.id = sc.seance_id AND se.statut <> 'annulee'
               JOIN campus.creneaux_programme c ON c.id = sc.creneau_id
              WHERE c.session_id = $1 GROUP BY 1`,
            [s.id],
          )
        ).rows.map((r) => [Number(r.id), Number(r.n)]),
      );
      const [{ n: nbClasses }] = (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM campus.sessions_classes WHERE session_id = $1`, [s.id])).rows;
      const sansCours = programme.creneaux.filter((c) => c.type === "cours" && !c.cours_id);
      const aSynchroniser = Boolean(s.synchronisee_le && new Date(s.maj_le).getTime() - new Date(s.synchronisee_le).getTime() > 2000);
      const publiee = s.statut === "publiee";

      for (const c of programme.creneaux) {
        const n = parCreneau.get(c.id) ?? 0;
        if (c.type !== "cours") {
          sous.push({ libelle: libelleCreneau(c), detail: "Affiché dans la grille, sans classe en direct", etat: "fait", action: null });
        } else if (!c.cours_id) {
          sous.push({ libelle: libelleCreneau(c), detail: "Aucun cours choisi : pas de séance en direct", etat: "a_faire", action: direction ? lien("Choisir le cours", href) : null });
        } else {
          sous.push({ libelle: libelleCreneau(c), detail: publiee ? pluriel(n, "séance créée", "séances créées") : "Séances créées à la publication", etat: publiee && n > 0 ? "fait" : "a_faire", action: null });
        }
      }
      if (!nbClasses) sous.push({ libelle: "Classes destinataires", detail: "Aucune classe choisie : personne ne verra ces cours", etat: "a_faire", action: direction ? lien("Choisir les classes", href) : null });

      const periode = `du ${jourLong(new Date(`${s.debut}T00:00:00Z`))} au ${jourLong(new Date(`${s.fin}T00:00:00Z`))}`;
      if (!publiee) {
        etat = "a_faire";
        chiffre = "Brouillon";
        resume = `« ${s.titre} » (${periode}) est encore en brouillon : ni les étudiants ni les formateurs ne la voient.`;
        action = direction ? lien("Relire et publier", href) : null;
      } else {
        const problemes = sansCours.length > 0 || !nbClasses || compte.actives === 0;
        etat = problemes ? "a_faire" : aSynchroniser ? "attention" : "fait";
        chiffre = pluriel(compte.actives, "séance");
        resume = aSynchroniser
          ? `« ${s.titre} » a été modifiée depuis la dernière publication : mettez à jour les séances.`
          : `« ${s.titre} » est publiée, ${periode}${compte.premiere ? ` : première séance ${jourLong(compte.premiere)} à ${heure(compte.premiere)}` : ""}.`;
        action = aSynchroniser && direction ? lien("Mettre à jour les séances", href) : lien("Voir l'emploi du temps", href);
        if (compte.annulees) sous.push({ libelle: "Séances annulées", detail: `${compte.annulees} (jour sans cours ou créneau retiré)`, etat: "fait", action: null });
      }
    }
    lignes.push({ cle: "programme", titre: "L'emploi du temps et ses séances", etat, chiffre, resume, action, sousLignes: sous });
  }

  // ── 5. Les étudiants importés, classe par classe ─────────────────────────
  const totalEtudiants = classesBrutes.reduce((a, c) => a + c.etudiants, 0);
  {
    const sous: SousLigneRentree[] = classesBrutes.map((c) => ({
      libelle: c.nom,
      detail: c.etudiants ? `${pluriel(c.etudiants, "étudiant")} · campus ${c.site}` : `Aucun étudiant · campus ${c.site}`,
      etat: c.etudiants ? "fait" : "a_faire",
      action: c.etudiants ? null : lien("Importer la liste", "/pilotage/comptes/import"),
    }));
    const vides = sous.filter((x) => x.etat === "a_faire").length;
    lignes.push({
      cle: "etudiants",
      titre: "Les étudiants importés",
      etat: classesBrutes.length ? pire(sous.map((x) => x.etat)) : "a_faire",
      chiffre: totalEtudiants ? pluriel(totalEtudiants, "étudiant") : "Aucun",
      resume: !classesBrutes.length
        ? "Créez d'abord les classes, puis collez la liste de la scolarité depuis Excel."
        : vides
          ? `${pluriel(vides, "classe")} sans étudiant. Collez la liste depuis Excel : comptes et fiches de connexion sont créés d'un coup.`
          : `Chaque classe ${annee} a ses étudiants.`,
      action: lien("Importer depuis Excel", "/pilotage/comptes/import"),
      sousLignes: sous,
    });
  }

  // ── 6. Fiches de connexion et premières connexions ───────────────────────
  {
    const actives = classesBrutes.reduce((a, c) => a + c.actives, 0);
    const expires = classesBrutes.reduce((a, c) => a + c.expires, 0);
    const taux = pourcent(actives, totalEtudiants);
    const sous: SousLigneRentree[] = sitesBruts
      .map((s) => {
        const cl = classesBrutes.filter((c) => c.site_id === s.id);
        const n = cl.reduce((a, c) => a + c.etudiants, 0);
        const a = cl.reduce((x, c) => x + c.actives, 0);
        const ex = cl.reduce((x, c) => x + c.expires, 0);
        if (!n) return null;
        const t = pourcent(a, n);
        const sl: SousLigneRentree = {
          libelle: s.nom_court,
          detail: `${a} sur ${n} ${a > 1 ? "ont" : "a"} choisi son code secret (${t} %)${ex ? ` · ${ex} code${ex > 1 ? "s" : ""} expiré${ex > 1 ? "s" : ""}` : ""}`,
          etat: t >= 90 && !ex ? "fait" : "attention",
          action: a < n ? lien("Fiches des non-activés", `/pilotage/comptes?etat=non_actives&role=etudiant&site=${s.id}`) : null,
        };
        return sl;
      })
      .filter((x): x is SousLigneRentree => x !== null);
    lignes.push({
      cle: "connexions",
      titre: "Fiches de connexion et premières connexions",
      etat: !totalEtudiants ? "a_faire" : taux >= 90 && !expires ? "fait" : "attention",
      chiffre: totalEtudiants ? `${taux} %` : "–",
      resume: !totalEtudiants
        ? "Les fiches de connexion s'impriment dès que les étudiants sont importés."
        : `${
            actives === 0
              ? totalEtudiants === 1
                ? "L'étudiant importé n'a pas encore choisi son code secret."
                : `Aucun des ${totalEtudiants} étudiants n'a encore choisi son code secret.`
              : actives === totalEtudiants
                ? "Tous les étudiants ont choisi leur code secret."
                : `${actives} étudiant${actives > 1 ? "s" : ""} sur ${totalEtudiants} ${actives > 1 ? "ont" : "a"} déjà choisi ${actives > 1 ? "leur" : "son"} code secret.`
          }${expires ? ` ${pluriel(expires, "code provisoire a expiré", "codes provisoires ont expiré")} : refaites leurs fiches.` : actives < totalEtudiants ? " Remettez les fiches aux autres : le QR les connecte sans rien taper." : ""}`,
      action: totalEtudiants && actives < totalEtudiants ? lien("Imprimer les fiches", "/pilotage/comptes?etat=non_actives&role=etudiant") : null,
      sousLignes: sous,
    });
  }

  // ── 7. Essais de la visio : formateurs et écrans de salle ────────────────
  {
    const sous: SousLigneRentree[] = [];
    const etatEssai = (d: Date | null): EtatControle => (!d ? "a_faire" : Date.now() - d.getTime() < ESSAI_RECENT_MS ? "fait" : "attention");
    for (const f of formateurs.filter((x) => x.actif)) {
      const d = essaiReussiLe(f.preferences);
      sous.push({
        libelle: nomAffiche(f),
        detail: d ? `Essai réussi ${ilYA(d)}` : f.doit_changer_mot_de_passe ? "Pas encore activé : l'essai viendra après" : "Pas encore d'essai : « Tester ma visio » depuis son accueil",
        etat: etatEssai(d),
        action: null,
      });
    }
    for (const s of sitesBruts) {
      const e = ecranDe(s);
      if (!e?.installe) continue;
      const d = essaiReussiLe(e.prefs);
      sous.push({ libelle: `Écran de ${s.nom_court}`, detail: d ? `Essai réussi ${ilYA(d)}` : "Pas encore d'essai depuis l'ordinateur de la salle", etat: etatEssai(d), action: null });
    }
    const reussis = sous.filter((x) => x.etat === "fait").length;
    lignes.push({
      cle: "visio",
      titre: "Les essais de la visio",
      etat: pire(sous.map((x) => x.etat)),
      chiffre: sous.length ? `${reussis} sur ${sous.length}` : "–",
      resume: !sous.length
        ? "Les essais apparaîtront dès que les formateurs seront activés et les écrans installés."
        : reussis === sous.length
          ? "Chaque formateur et chaque écran a réussi un essai ces deux dernières semaines."
          : "Chacun fait l'essai une fois depuis son ordinateur : caméra, micro, réseau, puis la salle d'essai à plusieurs.",
      action: lien("Ouvrir la salle d'essai", "/visio/essai"),
      sousLignes: sous,
    });
  }

  // ── 8. Les services (direction) ──────────────────────────────────────────
  if (direction) {
    const ia = raisonIndisponible();
    const sous: SousLigneRentree[] = [
      {
        libelle: "Assistant IA",
        detail: iaDisponible()
          ? "Disponible pour les étudiants et les formateurs"
          : ia === "panne"
            ? "En pause : le compte d'IA refuse les appels (crédit ou clé à vérifier)"
            : "Pas branché : la clé du compte d'IA manque (réglage ANTHROPIC_API_KEY)",
        etat: iaDisponible() ? "fait" : "a_faire",
        action: lien("Budget IA", "/pilotage/ia"),
      },
      {
        libelle: "Visio Daily",
        detail: config.visio.dailyCle ? "Configurée : les classes en direct passent par Daily" : "Pas configurée : la visio intégrée du campus prend le relais (réglage DAILY_API_KEY)",
        etat: config.visio.dailyCle ? "fait" : "a_faire",
        action: null,
      },
      {
        libelle: "E-mails",
        detail: emailDisponible() ? "Les invitations et les codes oubliés partent par e-mail" : "Pas d'e-mail : invitations par WhatsApp ou lien à copier (réglage RESEND_API_KEY)",
        etat: emailDisponible() ? "fait" : "attention",
        action: null,
      },
      {
        libelle: "Rappels sur le téléphone",
        detail: config.push.publique && config.push.privee ? "Rappels 24 h et 15 min avant chaque cours" : "Désactivés : pas de rappel sur le téléphone (réglages VAPID)",
        etat: config.push.publique && config.push.privee ? "fait" : "attention",
        action: null,
      },
    ];
    if (bucketFichiersDisponible()) {
      sous.push({ libelle: "Stockage des fichiers", detail: "Cours, devoirs, copies et examens rangés dans le bucket Railway des fichiers", etat: "fait", action: null });
    } else if (estProduction && !process.env.UPLOADS_DIR) {
      sous.push({ libelle: "Stockage des fichiers", detail: "Les devoirs rendus seraient perdus à chaque mise à jour (réglages FICHIERS_BUCKET ou UPLOADS_DIR)", etat: "a_faire", action: null });
    } else {
      sous.push({ libelle: "Stockage des fichiers", detail: "Fichiers sur le volume du serveur : reliez le bucket des fichiers (réglage FICHIERS_BUCKET)", etat: "attention", action: null });
    }
    const ok = sous.filter((x) => x.etat === "fait").length;
    lignes.push({
      cle: "services",
      titre: "Les services du campus",
      etat: pire(sous.map((x) => x.etat)),
      chiffre: `${ok} sur ${sous.length}`,
      resume: ok === sous.length ? "Assistant IA, visio, e-mails et rappels fonctionnent." : "Un service n'est pas branché : transmettez le réglage indiqué à votre prestataire technique.",
      action: null,
      sousLignes: sous,
    });
  }

  // ── 9. Plus aucune donnée de démonstration (direction) ───────────────────
  if (direction) {
    const [d] = (
      await pool.query<{ comptes: number; cours: number; registre: number }>(
        // Démonstration = marqueur du semis (preferences.demo), comme pour la purge : une adresse @demo.2iae.com ne suffit pas.
        `SELECT (SELECT count(*) FROM campus.utilisateurs WHERE role <> 'admin' AND preferences->>'demo' = 'true')::int AS comptes,
                (SELECT count(*) FROM campus.cours c JOIN campus.utilisateurs f ON f.id = c.formateur_id
                  WHERE f.preferences->>'demo' = 'true')::int AS cours,
                (SELECT count(*) FROM campus.journal WHERE action = $1)::int AS registre`,
        [ACTION_JOURNAL_DEMO],
      )
    ).rows;
    const [{ n: sallesInventees }] = (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM campus.sites WHERE salle_conference = ANY($1::text[])`, [[...SALLES_INVENTEES]])).rows;
    const sous: SousLigneRentree[] = [];
    if (d.comptes) sous.push({ libelle: "Comptes fictifs", detail: `${pluriel(d.comptes, "compte")} de démonstration (étudiants, formateurs, écrans)`, etat: "a_faire", action: null });
    if (d.cours) sous.push({ libelle: "Cours fictifs", detail: pluriel(d.cours, "cours de démonstration", "cours de démonstration"), etat: "a_faire", action: null });
    if (sallesInventees) sous.push({ libelle: "Noms de salles inventés", detail: `${sallesInventees} salle(s) : corrigés au prochain démarrage`, etat: "attention", action: null });
    if (config.demo) sous.push({ libelle: "Semis de démonstration", detail: "Encore demandé au démarrage (réglage CAMPUS_DEMO) : à retirer", etat: "attention", action: null });
    const reste = d.comptes > 0 || d.cours > 0 || d.registre > 0;
    lignes.push({
      cle: "demo",
      titre: "Plus aucune donnée de démonstration",
      etat: reste ? "a_faire" : pire(sous.map((x) => x.etat), "fait"),
      chiffre: reste ? pluriel(d.comptes, "compte fictif", "comptes fictifs") : "Aucune",
      resume: reste
        ? "Des personnes et des cours inventés sont encore sur le campus. La suppression ne touche à rien de réel."
        : "Le campus ne contient que des données réelles.",
      action: reste ? { type: "purger", libelle: "Supprimer la démonstration" } : null,
      sousLignes: sous,
    });
  }

  const prets = lignes.filter((l) => l.etat === "fait").length;
  const [siteNom] = p ? sitesBruts.map((s) => s.nom_court) : [];
  return {
    cible: {
      le: cibleDate.toISOString(),
      libelle: jourLong(cibleDate),
      session: programme ? `${programme.session.titre} · ${programme.session.annee_academique}` : null,
      passee: cibleDate.getTime() < Date.now(),
    },
    perimetre: { tout: tousLesSites, site: siteNom ?? null },
    lignes,
    prets,
    total: lignes.length,
    genereLe: new Date().toISOString(),
  };
}

// ── Invitations ────────────────────────────────────────────────────────────

/** Prochain cours d'un formateur : « Initiation à l'IA, lundi 28 septembre à 08:30 (heure d'Abidjan) ». */
export async function prochainCours(id: number): Promise<string | null> {
  const format = (titre: string, debut: Date) => `${titre}, ${jourLong(debut)} à ${heure(debut)} (heure d'Abidjan)`;
  if (await existe("seances_creneaux")) {
    const { rows } = await pool.query<{ titre: string; debut: Date }>(
      `SELECT co.titre, se.debut FROM campus.seances se
         JOIN campus.seances_creneaux sc ON sc.seance_id = se.id
         JOIN campus.creneaux_programme c ON c.id = sc.creneau_id
         JOIN campus.cours co ON co.id = se.cours_id
        WHERE c.intervenant_id = $1 AND se.statut = 'planifiee' AND se.debut > now()
        ORDER BY se.debut LIMIT 1`,
      [id],
    );
    if (rows[0]) return format(rows[0].titre, new Date(rows[0].debut));
    const creneau = (
      await pool.query<{ titre: string | null; libre: string; jour: number; heure_debut: string }>(
        `SELECT co.titre, c.titre AS libre, c.jour, c.heure_debut FROM campus.creneaux_programme c
           JOIN campus.sessions_programme s ON s.id = c.session_id AND s.statut <> 'archivee' AND s.fin >= (now() AT TIME ZONE 'UTC')::date
           LEFT JOIN campus.cours co ON co.id = c.cours_id
          WHERE c.intervenant_id = $1 ORDER BY s.debut, c.jour, c.heure_debut LIMIT 1`,
        [id],
      )
    ).rows[0];
    if (creneau) return `${creneau.titre || creneau.libre || "Votre cours"}, le ${JOURS[creneau.jour]} à ${hm(creneau.heure_debut)} (heure d'Abidjan)`;
  }
  const { rows } = await pool.query<{ titre: string; debut: Date }>(
    `SELECT co.titre, se.debut FROM campus.seances se JOIN campus.cours co ON co.id = se.cours_id
      WHERE se.statut = 'planifiee' AND se.debut > now()
        AND (co.formateur_id = $1 OR EXISTS (SELECT 1 FROM campus.cours_formateurs cf WHERE cf.cours_id = co.id AND cf.formateur_id = $1))
      ORDER BY se.debut LIMIT 1`,
    [id],
  );
  return rows[0] ? format(rows[0].titre, new Date(rows[0].debut)) : null;
}

function messageInvitation(c: Pick<Utilisateur, "prenom" | "nom" | "role">, lienTexte: string, expireLe: Date, premier: string | null): string {
  return [
    `Bonjour ${nomAffiche(c)},`,
    c.role === "formateur"
      ? "Le Groupe Écoles 2IAE International vous ouvre son campus numérique : c'est de là que vous donnerez vos cours en direct aux cinq campus."
      : "Le Groupe Écoles 2IAE International vous ouvre son campus numérique.",
    ...(premier ? [`Votre prochain cours : ${premier}.`] : []),
    "",
    `Pour créer votre compte, ouvrez ce lien (il est personnel et ne sert qu'une fois, jusqu'au ${fmtDate.format(expireLe)}) :`,
    lienTexte,
    "",
    "Vous y indiquerez votre nom, votre adresse e-mail (votre identifiant), votre téléphone et votre mot de passe.",
    "Dès que votre compte est créé, vous recevez par e-mail le guide pas à pas du campus : connexion, préparation des cours, cours en direct, documents et devoirs.",
  ].join("\n");
}

/** Jeton d'activation encore valable de ce compte (sans le consommer). */
async function jetonValable(compteId: number, jeton: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(jeton)) return false;
  const [l] = await db
    .select({ id: reinitialisations.id })
    .from(reinitialisations)
    .where(
      and(
        eq(reinitialisations.jetonHash, hacherJeton(jeton)),
        eq(reinitialisations.utilisateurId, compteId),
        eq(reinitialisations.type, "activation"),
        isNull(reinitialisations.utiliseLe),
        gt(reinitialisations.expireLe, new Date()),
      ),
    );
  return Boolean(l);
}

async function envoyerInvitationEmail(c: Utilisateur, adresse: string, lienTexte: string, expireLe: Date, premier: string | null): Promise<boolean> {
  const e = emailInvitation({ personne: c, lien: lienTexte, expireLe, premierCours: premier });
  const envoye = await envoyerEmail({ a: adresse, sujet: e.sujet, texte: e.texte, html: e.html });
  if (!envoye && !estProduction) console.log(`[lancement] (dev) e-mail d'invitation non envoyé à ${adresse} : ${lienTexte}`);
  return envoye;
}

// ── Écrans de salle ────────────────────────────────────────────────────────

const hacherCodeEcran = (code: string) => hacherJeton(`ecran:${code}`);

/**
 * Code d'installation d'un écran : 8 caractères pris parmi 31 lettres et chiffres sans ambiguïté (ni 0/O,
 * ni 1/I/L), soit 31^8, environ 850 milliards de codes. Deviner l'un des cinq codes en circulation reste hors
 * de portée (10 000 adresses au rythme permis, 10 essais par quart d'heure : environ une chance sur 20 000
 * par jour, alors que la direction peut changer le code à tout moment ; le lien, lui, porte 24 octets
 * aléatoires) : il n'y a donc plus de plafond
 * d'échecs commun à tout le campus, que quelques adresses suffisaient à remplir pour bloquer l'installation
 * des vraies salles. Restent les essais limités par adresse (ou par réseau IPv6).
 */
const ALPHABET_CODE_ECRAN = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LONGUEUR_CODE_ECRAN = 8;
const codeEcran = () => Array.from({ length: LONGUEUR_CODE_ECRAN }, () => ALPHABET_CODE_ECRAN[crypto.randomInt(ALPHABET_CODE_ECRAN.length)]).join("");
/** Ce qui a été tapé, en majuscules, sans espaces ni tirets. */
const lireCodeEcran = (brut: string) => brut.toUpperCase().replace(/[^A-Z0-9]/g, "");
/** « K7MQ 4XP9 » : lisible de loin, facile à recopier. */
const codeEcranLisible = (code: string) => `${code.slice(0, 4)} ${code.slice(4)}`;

/** Le lien et le code d'installation, chiffrés (AES-256-GCM) avec une clé tirée du secret du serveur. */
const CLE_ECRANS = crypto.createHash("sha256").update(`ecrans-salle:${config.sessionSecret}`).digest();
function chiffrer(texte: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", CLE_ECRANS, iv);
  const corps = Buffer.concat([c.update(texte, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), corps]).toString("base64url");
}
function dechiffrer(chiffre: string): string | null {
  try {
    const b = Buffer.from(chiffre, "base64url");
    const d = crypto.createDecipheriv("aes-256-gcm", CLE_ECRANS, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

async function siteDuPerimetre(req: Request) {
  const [s] = await db.select().from(sites).where(eq(sites.id, idParam(req)));
  const p = perimetreSites(moi(req));
  if (!s || (p && !p.includes(s.id))) throw introuvable("Campus");
  return s;
}

/** Le compte de l'écran d'un campus : le plus récemment vu. Jamais un compte « salle » de la démonstration. */
async function compteEcran(siteId: number): Promise<Utilisateur | null> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT e.id FROM campus.utilisateurs e WHERE e.role = 'salle' AND e.site_id = $1 AND e.actif AND ${ECRAN_REEL("e")}
      ORDER BY (NOT e.doit_changer_mot_de_passe) DESC, e.derniere_connexion DESC NULLS LAST, e.id LIMIT 1`,
    [siteId],
  );
  if (!rows[0]) return null;
  const [u] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, rows[0].id));
  return u ?? null;
}

/** Le lien et le code en place, s'ils marchent encore (pas remplacés entre-temps). */
async function installationEnPlace(s: typeof sites.$inferSelect, compte: Utilisateur): Promise<InstallationEcran | null> {
  const garde = compte.preferences?.installationEcran;
  const clair = garde ? dechiffrer(garde.chiffre) : null;
  if (!garde || !clair) return null;
  const { jeton, code } = JSON.parse(clair) as { jeton: string; code: string };
  const [actif] = await db
    .select({ id: reinitialisations.id })
    .from(reinitialisations)
    .where(and(eq(reinitialisations.jetonHash, hacherJeton(jeton)), eq(reinitialisations.type, "activation"), isNull(reinitialisations.utiliseLe), gt(reinitialisations.expireLe, new Date())));
  return actif ? decrireInstallation(s, compte.id, jeton, code, new Date(garde.le), false) : null;
}

function decrireInstallation(s: typeof sites.$inferSelect, compteId: number, jeton: string, code: string, le: Date, nouveau: boolean): InstallationEcran {
  const hote = config.urlCampus.replace(/^https?:\/\//, "");
  const lienTexte = `${config.urlCampus}/ecran/${jeton}`;
  const salle = sallePasEncoreNommee(s.salleConference) ? "la salle de conférence" : s.salleConference;
  const message = [
    `Installation de l'écran de ${salle} · campus ${s.nomCourt}`,
    "",
    "Sur l'ordinateur branché à l'écran de la salle, ouvrez ce lien :",
    lienTexte,
    "",
    `Ou allez sur ${hote}/ecran et tapez le code ${codeEcranLisible(code)}.`,
    "Ce lien et ce code restent valables : ils réinstallent l'écran sur un autre ordinateur si besoin. Gardez-les pour les responsables de la salle.",
    "Ensuite, l'écran reste connecté : laissez simplement la page ouverte.",
  ].join("\n");
  return {
    siteId: s.id,
    compteId,
    site: s.nomCourt,
    salle,
    lien: lienTexte,
    code,
    adresseCourte: `${hote}/ecran`,
    depuis: le.toISOString(),
    message,
    whatsapp: lienWhatsApp(null, message),
    nouveau,
  };
}

/**
 * Qui essaie, pour la limite d'essais : l'adresse IPv4, ou le réseau /64 d'une adresse IPv6 (un abonné en
 * dispose en entier : compter adresse par adresse lui donnerait des essais sans limite).
 */
function reseauClient(ip: string | undefined): string {
  const a = (ip ?? "").replace(/^::ffff:(?=\d+\.)/i, "").split("%")[0];
  if (!a.includes(":")) return a;
  const [tete, queue] = a.split("::");
  const t = tete ? tete.split(":") : [];
  const q = queue ? queue.split(":") : [];
  const groupes = queue === undefined ? t : [...t, ...Array<string>(Math.max(0, 8 - t.length - q.length)).fill("0"), ...q];
  return `${groupes
    .slice(0, 4)
    .map((g) => g.toLowerCase().replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

const ROLES_INVITABLES: Role[] = ["formateur", "vie_scolaire", "admin"];

/**
 * Guide pas à pas d'un compte qui vient d'être prêt (formateur ou équipe) : un seul modèle d'e-mail,
 * celui de guide-bienvenue.ts, quel que soit le lien qui a servi. Ne lève jamais d'erreur.
 */
export async function envoyerGuideFormateur(c: Pick<Utilisateur, "id" | "prenom" | "nom" | "email" | "role">): Promise<boolean> {
  const envoye = await envoyerGuideBienvenue(c, await prochainCours(c.id).catch(() => null));
  await journaliser(c, "guide_bienvenue", { envoye }).catch(() => undefined);
  return envoye;
}

// ── Identifiant choisi à la première connexion ─────────────────────────────

type Identifiant = { type: "email"; valeur: string } | { type: "telephone"; valeur: string };

/** E-mail, ou téléphone : international (+1 514 555 0123) ou ivoirien à 10 chiffres. */
function lireIdentifiant(brut: string): Identifiant {
  const t = brut.trim();
  if (t.includes("@")) {
    const r = z.string().email().max(160).safeParse(t.toLowerCase());
    if (!r.success) throw invalide("Cette adresse e-mail n'est pas valide. Vérifiez-la (exemple : prenom.nom@gmail.com).");
    if (adresseDeDemonstration(r.data)) throw invalide("Cette adresse est réservée à la démonstration du campus. Tapez votre vraie adresse e-mail, ou votre numéro de téléphone.");
    return { type: "email", valeur: r.data };
  }
  const chiffres = t.replace(/\D/g, "");
  if (/^\s*(\+|00)/.test(t)) {
    const n = normaliserTelephone(t);
    if (n.length < 8 || n.length > 15) throw invalide("Numéro incomplet : tapez l'indicatif du pays puis le numéro, par exemple +1 514 555 0123.");
    return { type: "telephone", valeur: n };
  }
  if (/^0\d{9}$/.test(chiffres)) return { type: "telephone", valeur: chiffres };
  throw invalide("Tapez votre adresse e-mail, ou votre numéro de téléphone avec l'indicatif du pays (par exemple +1 514 555 0123 ou +49 151 2345 6789).");
}

const nomPropre = (s: string) => s.replace(/\s+/g, " ").trim();

// ── Invitation : la personne crée son compte depuis son lien personnel ─────

const lienPerimeInvitation = () =>
  new ErreurHttp(
    410,
    "Ce lien d'invitation ne marche plus : il a déjà servi, il a expiré, ou un lien plus récent l'a remplacé. Votre compte est déjà créé ? Connectez-vous avec votre adresse e-mail. Sinon, demandez un nouveau lien à la direction.",
  );

/** Le compte que ce lien d'invitation permet de créer, sans consommer le lien. */
/** Nom d'un compte de formateur préparé sans le connaître : la personne le saisit en ouvrant son invitation. */
const NOM_A_FOURNIR = "À compléter";

/** Cours dont la personne est le formateur principal, et sa salle : la prochaine séance, sinon le cours s'il est seul. */
async function coursEtSalle(id: number): Promise<{ cours: string[]; destination: string | null }> {
  const liste = (
    await pool.query<{ id: number; titre: string }>(`SELECT id, titre FROM campus.cours WHERE formateur_id = $1 AND statut <> 'archive' ORDER BY id`, [id])
  ).rows;
  if (!liste.length) return { cours: [], destination: null };
  const seance = (
    await pool.query<{ id: number }>(
      `SELECT id FROM campus.seances WHERE cours_id = ANY($1::int[]) AND statut IN ('planifiee', 'en_direct') AND debut + (duree_minutes || ' minutes')::interval > now() ORDER BY debut LIMIT 1`,
      [liste.map((c) => c.id)],
    )
  ).rows[0];
  return { cours: liste.map((c) => c.titre), destination: seance ? `/enseigner/seances/${seance.id}` : liste.length === 1 ? `/cours/${liste[0].id}` : null };
}

async function lireInvitation(jeton: string): Promise<{ ligneId: number; expireLe: Date; compte: Utilisateur } | null> {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(jeton)) return null;
  const [ligne] = await db
    .select({ id: reinitialisations.id, utilisateurId: reinitialisations.utilisateurId, expireLe: reinitialisations.expireLe })
    .from(reinitialisations)
    .where(
      and(
        eq(reinitialisations.jetonHash, hacherJeton(jeton)),
        eq(reinitialisations.type, "activation"),
        isNull(reinitialisations.utiliseLe),
        gt(reinitialisations.expireLe, new Date()),
      ),
    );
  if (!ligne) return null;
  const [c] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, ligne.utilisateurId));
  // Un compte déjà créé ne se recrée pas : on se connecte avec lui.
  if (!c || !c.actif || !ROLES_INVITABLES.includes(c.role) || !c.doitChangerMotDePasse) return null;
  return { ligneId: ligne.id, expireLe: ligne.expireLe, compte: c };
}

/** Téléphone de contact : international (+1 514 555 0123) ou ivoirien à 10 chiffres. */
function lireTelephone(brut: string): string {
  const t = brut.trim();
  if (/^\s*(\+|00)/.test(t)) {
    const n = normaliserTelephone(t);
    if (n.length >= 8 && n.length <= 15) return n;
  } else {
    const chiffres = t.replace(/\D/g, "");
    if (/^0\d{9}$/.test(chiffres)) return chiffres;
  }
  throw invalide("Numéro de téléphone illisible : tapez l'indicatif du pays puis le numéro, par exemple +1 514 555 0123 ou +225 07 07 12 34 56.");
}

/** La direction, et la personne qui a envoyé l'invitation, apprennent que le compte est créé. */
async function prevenirCompteCree(c: Utilisateur, guideEnvoye: boolean) {
  const { rows } = await pool.query<{ utilisateur_id: number | null }>(
    `SELECT utilisateur_id FROM campus.journal WHERE action IN ('invitation', 'invitation_email') AND details->>'compteId' = $1 ORDER BY cree_le DESC LIMIT 1`,
    [String(c.id)],
  );
  const direction = await db
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .where(and(eq(utilisateurs.role, "admin"), eq(utilisateurs.actif, true)));
  const ids = new Set(direction.map((x) => x.id));
  if (rows[0]?.utilisateur_id) ids.add(rows[0].utilisateur_id);
  ids.delete(c.id);
  await notifier([...ids], {
    type: "systeme",
    titre: `${nomAffiche(c)} a créé son compte`,
    corps: `${c.role === "formateur" ? "Formateur" : "Équipe"} · ${guideEnvoye ? `guide du campus envoyé à ${c.email}` : "le guide n'a pas pu partir par e-mail"}.`,
    lien: `/pilotage/comptes?q=${encodeURIComponent(c.nom)}`,
    push: true,
  });
}

// ── Routes ─────────────────────────────────────────────────────────────────

export function enregistrerLancement(app: Express) {
  // La liste de contrôle de la rentrée, recalculée à chaque visite.
  app.get(
    `${P}/rentree`,
    exigerDroit("outils_campus"),
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await calculerRentree(moi(req)));
    }),
  );

  // Ce que la purge supprimerait (simulation : rien n'est touché).
  app.get(
    `${P}/rentree/demo`,
    exigerRole("admin"),
    route(async (_req, res) => {
      const { purgerDemonstration } = await import("../scripts/purge");
      const b = await purgerDemonstration({ simulation: true, sortie: () => undefined });
      const apercu: ApercuPurge = { inventaire: b.inventaire.filter(([, n]) => n > 0), comptes: b.comptes, personnes: b.personnes, avertissements: b.avertissements };
      res.json(apercu);
    }),
  );

  // Supprime la démonstration, et seulement elle (même code que CAMPUS_PURGER_DEMO au démarrage).
  app.post(
    `${P}/rentree/demo/purger`,
    exigerRole("admin"),
    route(async (req, res) => {
      const u = moi(req);
      valider(z.object({ confirmation: z.literal("SUPPRIMER", { errorMap: () => ({ message: "tapez SUPPRIMER pour confirmer" }) }) }), req.body);
      const { purgerDemonstration } = await import("../scripts/purge");
      const b = await purgerDemonstration({ sortie: (l) => console.log(`[purge] ${l}`) });
      const { fermerFluxUtilisateur } = await import("../temps-reel");
      for (const id of b.idsComptes) {
        oublierUtilisateur(id);
        fermerFluxUtilisateur(id);
      }
      if (Object.keys(b.tables).length) {
        prevenirSite("données de démonstration supprimées");
        await journaliser(u, "purge_demo_lancee", { comptes: b.comptes, fichiers: b.fichiersDisque });
      }
      const r: ResultatPurge = { comptes: b.comptes, tables: b.tables, fichiersDisque: b.fichiersDisque, avertissements: b.avertissements };
      res.json(r);
    }),
  );

  // Inviter un formateur (ou un membre de l'équipe) : lien d'activation à envoyer.
  app.post(
    `${P}/comptes/:id(\\d+)/invitation`,
    exigerDroit("comptes_personnel"),
    route(async (req, res) => {
      const u = moi(req);
      const { envoyerEmail: parEmail } = valider(z.object({ envoyerEmail: z.boolean().optional() }), req.body ?? {});
      const [c] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, idParam(req)));
      if (!c || !peutGerer(u, c)) throw introuvable("Compte");
      if (!ROLES_INVITABLES.includes(c.role)) {
        throw invalide(c.role === "salle" ? "Un écran de salle s'installe avec « Installer l'écran de la salle »." : "Les étudiants reçoivent leur fiche de connexion.");
      }
      if (c.id === u.id) throw invalide("Vous êtes déjà connecté avec ce compte.");
      if (!c.actif) throw invalide("Ce compte est désactivé : réactivez-le d'abord.");
      if (!c.doitChangerMotDePasse) throw new ErreurHttp(409, `${nomAffiche(c)} a déjà activé son compte. Mot de passe oublié : « Nouveau code » sur sa fiche.`);

      // Un seul lien d'invitation valable à la fois : les précédents ne marchent plus. On ne le signale
      // que si une invitation avait vraiment été envoyée (le jeton créé avec le compte n'a été remis à personne).
      const dejaInvite = (
        await pool.query(`SELECT 1 FROM campus.journal WHERE action IN ('invitation', 'invitation_email') AND details->>'compteId' = $1 LIMIT 1`, [String(c.id)])
      ).rowCount;
      await db
        .update(reinitialisations)
        .set({ utiliseLe: new Date() })
        .where(and(eq(reinitialisations.utilisateurId, c.id), eq(reinitialisations.type, "activation"), isNull(reinitialisations.utiliseLe)));
      // Le lien précédent a pu être ouvert par quelqu'un d'autre (invitation partie au mauvais numéro) : il avait
      // alors une session sur ce compte, qui n'est pas encore activé. Elle tombe avec le lien : seul le nouveau
      // lien ouvre le compte.
      const appareilsDeconnectes = Number(
        (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM campus.session WHERE (sess->>'utilisateurId')::int = $1 AND expire > now()`, [c.id])).rows[0]?.n ?? 0,
      );
      await fermerAutresSessions(c.id);
      oublierUtilisateur(c.id);
      const expireLe = new Date(Date.now() + DUREE_CODE_PROVISOIRE_MS);
      const jeton = await creerJeton(c.id, "activation", DUREE_CODE_PROVISOIRE_MS);
      const lienTexte = lienInvitation(jeton);
      const premier = await prochainCours(c.id);
      const message = messageInvitation(c, lienTexte, expireLe, premier);
      let envoye = false;
      if (parEmail && c.email) envoye = await envoyerInvitationEmail(c, c.email, lienTexte, expireLe, premier);
      await journaliser(u, "invitation", { compteId: c.id, canal: envoye ? "email" : "lien", ...(appareilsDeconnectes ? { appareilsDeconnectes } : {}) });
      const r: InvitationRemise = {
        compteId: c.id,
        lien: lienTexte,
        jeton,
        expireLe: expireLe.toISOString(),
        message,
        whatsapp: lienWhatsApp(c.telephone, message),
        premierCours: premier,
        email: { adresse: c.email, disponible: emailDisponible(), envoye },
        // Tout lien d'une invitation précédente, qu'il ait servi ou non, ne marche plus.
        remplaceUnLien: Boolean(dejaInvite),
        appareilsDeconnectes,
      };
      res.json(r);
    }),
  );

  // Envoyer par e-mail le MÊME lien (celui que la fenêtre affiche), à l'adresse du compte ou à une autre.
  app.post(
    `${P}/comptes/:id(\\d+)/invitation/email`,
    exigerDroit("comptes_personnel"),
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(
        z.object({
          jeton: z.string().min(1).max(100),
          adresse: z.preprocess((v) => (typeof v === "string" && !v.trim() ? undefined : v), z.string().trim().toLowerCase().email("adresse e-mail invalide").max(160).optional()),
        }),
        req.body,
      );
      const [c] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, idParam(req)));
      if (!c || !peutGerer(u, c) || !ROLES_INVITABLES.includes(c.role)) throw introuvable("Compte");
      if (!(await jetonValable(c.id, d.jeton))) throw new ErreurHttp(410, "Ce lien d'invitation ne marche plus (il a servi ou a été remplacé). Créez une nouvelle invitation.");
      const adresse = d.adresse ?? c.email;
      if (!adresse) throw invalide("Indiquez l'adresse e-mail à laquelle envoyer l'invitation.");
      if (!emailDisponible()) throw new ErreurHttp(503, "Le campus n'envoie pas encore d'e-mails. Envoyez le lien par WhatsApp ou copiez-le.");
      const [ligne] = await db.select({ expireLe: reinitialisations.expireLe }).from(reinitialisations).where(eq(reinitialisations.jetonHash, hacherJeton(d.jeton)));
      const envoye = await envoyerInvitationEmail(c, adresse, lienInvitation(d.jeton), ligne.expireLe, await prochainCours(c.id));
      if (envoye) await journaliser(u, "invitation_email", { compteId: c.id, autreAdresse: Boolean(d.adresse && d.adresse !== c.email) });
      const r: EnvoiInvitation = {
        envoye,
        adresse,
        message: envoye ? `Invitation envoyée à ${adresse}.` : "L'e-mail n'a pas pu partir. Réessayez, ou envoyez le lien par WhatsApp.",
      };
      res.status(envoye ? 200 : 502).json(r);
    }),
  );

  // L'écran de la salle d'un campus : le lien et le code permanents en place (GET), ou de nouveaux (POST).
  app.get(
    `${P}/sites/:id(\\d+)/ecran`,
    exigerDroit("outils_campus"),
    route(async (req, res) => {
      const s = await siteDuPerimetre(req);
      const compte = await compteEcran(s.id);
      const etat: EtatEcranSalle = {
        installation: compte ? await installationEnPlace(s, compte) : null,
        derniereConnexion: compte?.derniereConnexion?.toISOString() ?? null,
      };
      res.setHeader("Cache-Control", "no-store");
      res.json(etat);
    }),
  );

  app.post(
    `${P}/sites/:id(\\d+)/ecran`,
    exigerDroit("outils_campus"),
    route(async (req, res) => {
      const u = moi(req);
      const s = await siteDuPerimetre(req);

      // Le compte de l'écran : celui qui existe déjà (le plus récemment vu), sinon un nouveau, sans identifiant.
      let compte = await compteEcran(s.id);
      const nouveau = !compte;
      if (!compte) {
        [compte] = await db
          .insert(utilisateurs)
          .values({
            role: "salle",
            prenom: "Salle",
            nom: s.nomCourt,
            siteId: s.id,
            // Mot de passe tiré au sort et jamais montré : l'écran s'installe par le lien ou le code.
            motDePasseHash: await hacher(`${motDePasseProvisoire()}-${jetonAleatoire(12)}`),
            doitChangerMotDePasse: true,
          })
          .returning();
        await journaliser(u, "compte_cree", { compteId: compte.id, role: "salle", siteId: s.id });
      }

      // Anciens liens et codes d'installation : plus valables. Les ordinateurs déjà installés restent connectés.
      await db
        .update(reinitialisations)
        .set({ utiliseLe: new Date() })
        .where(and(eq(reinitialisations.utilisateurId, compte.id), eq(reinitialisations.type, "activation"), isNull(reinitialisations.utiliseLe)));
      const expireLe = new Date(Date.now() + DUREE_INSTALLATION_MS);
      const jeton = await creerJeton(compte.id, "activation", DUREE_INSTALLATION_MS);
      let code = "";
      for (let essai = 0; essai < 8 && !code; essai++) {
        const candidat = codeEcran();
        try {
          await db.insert(reinitialisations).values({ utilisateurId: compte.id, type: "activation", jetonHash: hacherCodeEcran(candidat), expireLe });
          code = candidat;
        } catch {
          /* même code déjà en circulation pour un autre écran : on en tire un autre */
        }
      }
      if (!code) throw new ErreurHttp(503, "Impossible de préparer un code pour l'instant. Réessayez.");
      const le = new Date();
      // Gardés chiffrés dans le compte de l'écran : le pilotage les réaffiche sans en refaire.
      await db
        .update(utilisateurs)
        .set({ preferences: { ...compte.preferences, installationEcran: { chiffre: chiffrer(JSON.stringify({ jeton, code })), le: le.toISOString() } } })
        .where(eq(utilisateurs.id, compte.id));
      await journaliser(u, "ecran_installation", { compteId: compte.id, siteId: s.id });
      res.json(decrireInstallation(s, compte.id, jeton, code, le, nouveau));
    }),
  );

  // L'ordinateur de la salle s'installe : lien ou code, puis session longue (l'écran reste connecté).
  app.post(
    "/api/ecran/installer",
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const d = valider(z.object({ jeton: z.string().max(100).optional(), code: z.string().max(40).optional() }), req.body);
      const cleIp = `ecran|${reseauClient(req.ip)}`;
      const parLien = Boolean(d.jeton);
      const code = d.code ? lireCodeEcran(d.code) : "";
      // Le code se limite avant même d'être lu (10 essais faux par quart d'heure et par adresse). Le lien (24 octets
      // tirés au sort) ne se devine pas : un lien valable passe toujours, seuls ses échecs sont comptés.
      if (!parLien) verifierTentatives(cleIp, 10);
      const hash = parLien
        ? /^[A-Za-z0-9_-]{20,80}$/.test(d.jeton!)
          ? hacherJeton(d.jeton!)
          : null
        : code.length === LONGUEUR_CODE_ECRAN
          ? hacherCodeEcran(code)
          : null;
      const echec = () => {
        noterEchec(cleIp);
        if (parLien) verifierTentatives(cleIp, 10);
        return new ErreurHttp(
          410,
          parLien
            ? "Ce lien d'installation ne marche plus : un nouveau lien l'a remplacé. Demandez le lien actuel à la vie scolaire ou à la direction (Pilotage, « Installer l'écran »)."
            : code.length === LONGUEUR_CODE_ECRAN
              ? "Ce code ne marche pas. Vérifiez les 8 caractères, ou demandez le code actuel à la vie scolaire ou à la direction."
              : "Le code d'installation fait 8 caractères, lettres et chiffres. Vérifiez-le, ou demandez un nouveau code à la vie scolaire ou à la direction.",
        );
      };
      if (!hash) throw echec();
      const [ligne] = await db
        .select({ id: reinitialisations.id, utilisateurId: reinitialisations.utilisateurId })
        .from(reinitialisations)
        .where(and(eq(reinitialisations.jetonHash, hash), eq(reinitialisations.type, "activation"), isNull(reinitialisations.utiliseLe), gt(reinitialisations.expireLe, new Date())));
      if (!ligne) throw echec();
      const [ecran] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, ligne.utilisateurId));
      if (!ecran || !ecran.actif || ecran.role !== "salle") throw echec();

      // Le lien et le code restent valables : ils réinstalleront l'écran sur un autre ordinateur si besoin.
      const [installe] = await db
        .update(utilisateurs)
        .set({ doitChangerMotDePasse: false, motDePasseExpireLe: null, derniereConnexion: new Date() })
        .where(eq(utilisateurs.id, ecran.id))
        .returning();
      await new Promise<void>((ok, ko) => req.session.regenerate((e) => (e ? ko(e) : ok())));
      req.session.utilisateurId = installe.id;
      req.session.cookie.maxAge = dureeSession("salle");
      oublierUtilisateur(installe.id);
      effacerTentatives(cleIp);
      await journaliser(installe, "ecran_installe", { siteId: installe.siteId, par: parLien ? "lien" : "code" });
      res.json(await versMoi(installe));
    }),
  );

  // Page « Créer mon compte » (/invitation/:jeton) : ce qu'elle pré-remplit.
  app.get(
    "/api/invitation/:jeton",
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const cleIp = `invitation|${reseauClient(req.ip)}`;
      verifierTentatives(cleIp, 20);
      const inv = await lireInvitation(String(req.params.jeton ?? ""));
      if (!inv) {
        noterEchec(cleIp);
        throw lienPerimeInvitation();
      }
      const c = inv.compte;
      const r: InfoInvitation = {
        role: c.role as InfoInvitation["role"],
        prenom: c.prenom,
        nom: c.nom,
        email: c.email && !adresseDeDemonstration(c.email) ? c.email : null,
        telephone: c.telephone,
        titre: c.titre,
        premierCours: await prochainCours(c.id),
        expireLe: inv.expireLe.toISOString(),
        longueurMinimale: longueurMinimale(c.role),
        emailDisponible: emailDisponible(),
        nomAFournir: c.nom === NOM_A_FOURNIR,
        cours: (await coursEtSalle(c.id)).cours,
      };
      res.json(r);
    }),
  );

  // La personne crée son compte : nom, e-mail (son identifiant), téléphone, mot de passe. Le lien est
  // consommé, sa session s'ouvre, et le guide pas à pas part aussitôt à son adresse e-mail.
  app.post(
    "/api/invitation/:jeton",
    route(async (req: Request, res) => {
      res.setHeader("Cache-Control", "no-store");
      const cleIp = `invitation|${reseauClient(req.ip)}`;
      verifierTentatives(cleIp, 20);
      const inv = await lireInvitation(String(req.params.jeton ?? ""));
      if (!inv) {
        noterEchec(cleIp);
        throw lienPerimeInvitation();
      }
      const c = inv.compte;
      const d = valider(
        z.object({
          prenom: z.string().trim().min(1, "indiquez votre prénom").max(80, "trop long"),
          nom: z.string().trim().min(1, "indiquez votre nom").max(80, "trop long"),
          email: z.string().trim().toLowerCase().min(1, "indiquez votre adresse e-mail").email("adresse e-mail non valide (exemple : prenom.nom@gmail.com)").max(160, "trop long"),
          telephone: z.string().trim().max(30, "trop long").optional(),
          titre: z.string().trim().max(120, "120 caractères au maximum").optional(),
          motDePasse: z.string().min(1, "choisissez votre mot de passe").max(200),
        }),
        req.body,
      );
      if (adresseDeDemonstration(d.email)) throw invalide("Cette adresse est réservée à la démonstration du campus : tapez votre vraie adresse e-mail.");
      const telephone = d.telephone ? lireTelephone(d.telephone) : c.telephone;
      const minimum = longueurMinimale(c.role);
      if (d.motDePasse.length < minimum) throw invalide(`Votre mot de passe doit faire au moins ${minimum} caractères.`);
      if (!codeSecretAcceptable(d.motDePasse)) throw invalide("Ce mot de passe est trop facile à deviner. Mélangez des mots, des chiffres ou des signes.");
      const [pris] = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(and(eq(utilisateurs.email, d.email), ne(utilisateurs.id, c.id)));
      if (pris) throw new ErreurHttp(409, "Cette adresse e-mail est déjà utilisée par un autre compte du campus. Tapez une autre adresse, ou écrivez à la direction.");

      const prenom = nomPropre(d.prenom);
      const nom = nomPropre(d.nom);
      const titre = c.role === "formateur" && d.titre ? nomPropre(d.titre) : c.titre;
      const motDePasseHash = await hacher(d.motDePasse);
      let apres: Utilisateur;
      try {
        apres = await db.transaction(async (tx) => {
          // Le lien ne sert qu'une fois, même si la page est envoyée deux fois de suite.
          const [consomme] = await tx
            .update(reinitialisations)
            .set({ utiliseLe: new Date() })
            .where(and(eq(reinitialisations.id, inv.ligneId), isNull(reinitialisations.utiliseLe)))
            .returning({ id: reinitialisations.id });
          if (!consomme) throw lienPerimeInvitation();
          const [a] = await tx
            .update(utilisateurs)
            .set({ prenom, nom, email: d.email, telephone, titre, motDePasseHash, doitChangerMotDePasse: false, motDePasseExpireLe: null, derniereConnexion: new Date() })
            .where(and(eq(utilisateurs.id, c.id), eq(utilisateurs.doitChangerMotDePasse, true)))
            .returning();
          if (!a) throw lienPerimeInvitation();
          return a;
        });
      } catch (e) {
        if ((e as { code?: string }).code === "23505") throw new ErreurHttp(409, "Cette adresse e-mail vient d'être prise par un autre compte. Tapez-en une autre.");
        throw e;
      }
      // Plus aucun autre lien (fiche, ancienne invitation) n'ouvre ce compte ; seule cette session reste.
      await invaliderJetons(c.id);
      await fermerAutresSessions(c.id);
      await new Promise<void>((ok, ko) => req.session.regenerate((e) => (e ? ko(e) : ok())));
      req.session.utilisateurId = apres.id;
      req.session.cookie.maxAge = dureeSession(apres.role);
      oublierUtilisateur(apres.id);
      effacerTentatives(cleIp);
      for (const x of [c.email, c.telephone, apres.email, apres.telephone]) if (x) effacerTentatives(`compte|${x.toLowerCase()}`);
      const nomModifie = prenom !== c.prenom || nom !== c.nom;
      await journaliser(apres, "premiere_connexion", { identifiant: "email", par: "invitation", nomModifie });
      if ((nomModifie || titre !== c.titre) && apres.publierSurSite) prevenirSite("fiche d'un formateur");

      const envoye = await envoyerGuideFormateur(apres);
      void prevenirCompteCree(apres, envoye).catch((e) => console.error("[invitation] notification :", (e as Error).message));
      const r: InvitationAcceptee = { moi: await versMoi(apres), guide: { adresse: d.email, envoye }, destination: (await coursEtSalle(apres.id)).destination };
      res.status(201).json(r);
    }),
  );

  // Première connexion d'un formateur (ou d'un membre de l'équipe sans identifiant) :
  // nom vérifié, identifiant de connexion choisi (e-mail ou téléphone), mot de passe.
  app.post(
    "/api/compte/premiere-connexion",
    exigerConnexion,
    route(async (req: Request, res) => {
      const u = moi(req);
      if (!ROLES_INVITABLES.includes(u.role)) throw interdit("Cette étape est réservée aux formateurs et à l'équipe.");
      if (!u.doitChangerMotDePasse) throw new ErreurHttp(409, "Votre compte est déjà activé. Pour changer de mot de passe, passez par votre profil.");
      // Session ouverte par un lien d'invitation qu'une invitation plus récente a remplacé (le renvoi ferme déjà
      // ces sessions ; défense de plus) : seul le dernier lien peut activer le compte.
      if (req.session.jetonActivationId) {
        const [plusRecent] = await db
          .select({ id: reinitialisations.id })
          .from(reinitialisations)
          .where(and(eq(reinitialisations.utilisateurId, u.id), eq(reinitialisations.type, "activation"), gt(reinitialisations.id, req.session.jetonActivationId)))
          .limit(1);
        if (plusRecent) {
          await new Promise<void>((ok) => req.session.destroy(() => ok()));
          throw new ErreurHttp(410, "Ce lien d'activation a été remplacé par une invitation plus récente. Ouvrez le dernier lien reçu.");
        }
      }
      const d = valider(
        z.object({
          prenom: z.string().trim().min(1, "indiquez votre prénom (ou « M. », « Mme »)").max(80, "trop long"),
          nom: z.string().trim().min(1, "indiquez votre nom").max(80, "trop long"),
          identifiant: z.string().trim().min(1, "indiquez votre e-mail ou votre numéro de téléphone").max(160),
          nouveau: z.string().min(1, "choisissez votre mot de passe").max(200),
        }),
        req.body,
      );
      const id = lireIdentifiant(d.identifiant);
      const minimum = longueurMinimale(u.role);
      if (d.nouveau.length < minimum) throw invalide(`Votre mot de passe doit faire au moins ${minimum} caractères.`);
      if (!codeSecretAcceptable(d.nouveau)) throw invalide("Ce mot de passe est trop facile à deviner.");
      if (await verifier(d.nouveau, u.motDePasseHash)) throw invalide("Choisissez un mot de passe différent du mot de passe provisoire.");

      // L'identifiant doit mener à ce seul compte, sinon la connexion suivante échouerait.
      if (id.type === "email") {
        const [pris] = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(and(eq(utilisateurs.email, id.valeur), ne(utilisateurs.id, u.id)));
        if (pris) throw new ErreurHttp(409, "Cette adresse e-mail est déjà utilisée par un autre compte du campus. Choisissez-en une autre, ou votre numéro de téléphone.");
      } else {
        const [pris] = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(and(eq(utilisateurs.telephone, id.valeur), ne(utilisateurs.id, u.id)));
        if (pris) throw new ErreurHttp(409, "Ce numéro est déjà utilisé par un autre compte du campus. Choisissez plutôt votre adresse e-mail.");
      }
      const prenom = nomPropre(d.prenom);
      const nom = nomPropre(d.nom);
      const nomModifie = prenom !== u.prenom || nom !== u.nom;
      const maj: Partial<typeof utilisateurs.$inferInsert> = {
        prenom,
        nom,
        motDePasseHash: await hacher(d.nouveau),
        doitChangerMotDePasse: false,
        motDePasseExpireLe: null,
        ...(id.type === "email" ? { email: id.valeur } : { telephone: id.valeur }),
      };
      let apres: Utilisateur;
      try {
        [apres] = await db.update(utilisateurs).set(maj).where(eq(utilisateurs.id, u.id)).returning();
      } catch (e) {
        if ((e as { code?: string }).code === "23505") throw new ErreurHttp(409, "Cet identifiant vient d'être pris par un autre compte. Choisissez-en un autre.");
        throw e;
      }
      await invaliderJetons(u.id);
      await fermerAutresSessions(u.id, req.sessionID);
      oublierUtilisateur(u.id);
      for (const x of [u.email, u.telephone, apres.email, apres.telephone]) if (x) effacerTentatives(`compte|${x.toLowerCase()}`);
      await journaliser(u, "premiere_connexion", { identifiant: id.type, nomModifie });
      if (nomModifie && apres.publierSurSite) prevenirSite("fiche d'un formateur");
      // Le guide pas à pas part à son adresse e-mail, une seule fois, sans faire attendre la personne.
      if (apres.email) void envoyerGuideFormateur(apres);
      res.json(await versMoi(apres));
    }),
  );
}
