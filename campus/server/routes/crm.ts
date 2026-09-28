// CRM des étudiants (vie scolaire et direction) : la liste de travail avec
// ses indicateurs, l'inscription complète en une fois, le dossier
// administratif (état civil, famille, statut), les pièces du dossier, les
// relances à échéance et les préinscrits du site 2iae.com.
//
//   GET    /api/pilotage/etudiants                   liste + indicateurs (filtres, tri, pages)
//   GET    /api/pilotage/etudiants/export            la même liste en CSV (Excel)
//   GET    /api/pilotage/etudiants/matricule         matricule proposé pour une classe
//   POST   /api/pilotage/etudiants                   inscription complète (compte + dossier + pièces + frais + 1er versement)
//   GET    /api/pilotage/etudiants/:id/crm           dossier CRM (identité, pièces, suivi, relances, scolarité)
//   PATCH  /api/pilotage/etudiants/:id/crm           modifier l'identité, la famille, le statut
//   POST   /api/pilotage/etudiants/:id/pieces        pièce reçue (au guichet ou scannée)
//   PATCH  /api/pilotage/pieces/:id                  valider ou refuser une pièce
//   DELETE /api/pilotage/pieces/:id
//   POST   /api/pilotage/etudiants/:id/taches        relance à faire
//   PATCH  /api/pilotage/taches/:id                  faite, reportée, confiée à quelqu'un d'autre
//   DELETE /api/pilotage/taches/:id
//   GET    /api/pilotage/relances                    relances du périmètre (en retard, aujourd'hui, à venir)
//   GET    /api/pilotage/preinscrits                 préinscrits du site 2iae.com
//
// Mêmes règles que le pilotage : périmètre de la vie scolaire partout, 404
// hors périmètre, actions sensibles au journal.
import type { Express } from "express";
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { moi, perimetreSites, hacher, codeProvisoire, DUREE_CODE_PROVISOIRE_MS } from "../auth";
import { creerJeton, lienActivation } from "../activation";
import { route, valider, idParam, ErreurHttp, introuvable, invalide } from "../http";
import { lirePreinscritsSite, signalerInscritSite } from "../passerelle-site";
import {
  EQUIPE,
  journaliser,
  lienWhatsApp,
  numeroWhatsApp,
  sansAccents,
  sqlSansAccents,
  etudiantGere,
  classeGeree,
  compteParId,
  messageCode,
  optionnel,
  texteCourt,
  schemaMatricule,
  schemaEmailCompte,
  telephoneSaisi,
  verifierUnicite,
  espaces,
} from "./admin";
import { aujourdhui, situationsDe, scolariteDe, copierEcheancier, prochainNumeroRecu } from "../scolarite-outils";
import {
  utilisateurs,
  classes,
  sites,
  suivis,
  fichiers,
  dossiersEtudiants,
  piecesDossier,
  tachesSuivi,
  fraisClasses,
  versements,
  STATUTS_SCOLARITE,
  LIBELLES_STATUTS_SCOLARITE,
  LIENS_RESPONSABLE,
  TYPES_PIECES,
  LIBELLES_PIECES,
  PIECES_REQUISES,
  MOYENS_PAIEMENT,
  FILTRES_CRM,
  TYPES_SUIVI,
  LIBELLES_LIENS_RESPONSABLE,
  type Utilisateur,
  type StatutScolarite,
  type Responsable,
  type EtudiantCrmLigne,
  type PageEtudiantsCrm,
  type EtudiantCree,
  type DossierCrm,
  type IdentiteCrm,
  type PieceDossier,
  type TacheSuivi,
  type ListeRelances,
  type ListePreinscrits,
  type TypePiece,
  type TypeSuivi,
  type MatriculePropose,
  type SituationFinanciere,
} from "@shared/schema";

const P = "/api/pilotage";
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const schemaJour = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date au format AAAA-MM-JJ").refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "date invalide");

// ── Outils ─────────────────────────────────────────────────────────────────

/** Condition « étudiant du périmètre » sur utilisateurs. */
function etudiantsDuPerimetre(u: Utilisateur): SQL {
  const p = perimetreSites(u);
  return and(eq(utilisateurs.role, "etudiant"), p ? inArray(utilisateurs.siteId, p) : undefined)!;
}

const schemaResponsable = z.object({
  nom: texteCourt(120),
  lien: z.enum(LIENS_RESPONSABLE),
  telephone: optionnel(z.string().trim().max(30)),
  email: optionnel(z.string().trim().toLowerCase().email("adresse e-mail invalide").max(160)),
  profession: optionnel(z.string().trim().max(120)),
  principal: z.boolean().default(false),
});

/** Responsables saisis : téléphones normalisés, un seul contact principal (le premier coché, sinon le premier). */
function responsablesSaisis(liste: z.infer<typeof schemaResponsable>[]): Responsable[] {
  const r: Responsable[] = liste.map((x) => ({
    nom: espaces(x.nom),
    lien: x.lien,
    telephone: telephoneSaisi(x.telephone ?? null),
    email: x.email ?? null,
    profession: x.profession ?? null,
    principal: x.principal,
  }));
  const principal = Math.max(0, r.findIndex((x) => x.principal));
  return r.map((x, i) => ({ ...x, principal: i === principal }));
}

const champsIdentite = {
  sexe: z.enum(["F", "M"]).nullable().optional(),
  dateNaissance: optionnel(schemaJour),
  lieuNaissance: optionnel(z.string().trim().max(120)),
  nationalite: optionnel(z.string().trim().max(80)),
  adresse: optionnel(z.string().trim().max(200)),
  whatsapp: optionnel(z.string().trim().max(30)),
  dateInscription: optionnel(schemaJour),
  remarques: optionnel(z.string().trim().max(3000)),
  responsables: z.array(schemaResponsable).max(4).optional(),
};

/** Code filière d'un matricule : « Techniques commerciales » → TC, « Informatique » → IN. */
function codeFiliere(filiere: string): string {
  const mots = sansAccents(filiere)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((m) => m && !["DE", "DU", "DES", "ET", "EN", "LA", "LE", "LES", "D", "L", "BTS", "OPTION"].includes(m));
  if (!mots.length) return "ET";
  if (mots.length === 1) return mots[0].slice(0, 2).padEnd(2, "X");
  return (mots[0][0] + mots[1][0]).toUpperCase();
}

/** Matricule proposé : 2 chiffres de l'année de rentrée + code filière + numéro à 4 chiffres (26TC0042). */
async function matriculePropose(classe: { filiere: string; anneeScolaire: string }): Promise<string> {
  const annee = /^(\d{4})/.exec(classe.anneeScolaire)?.[1] ?? String(new Date().getUTCFullYear());
  const prefixe = `${annee.slice(2)}${codeFiliere(classe.filiere)}`;
  const r = await db.execute<{ max: number | null }>(
    sql`SELECT max(substring(matricule FROM ${`^${prefixe}(\\d{4,6})$`})::int) AS max FROM campus.utilisateurs WHERE matricule ~ ${`^${prefixe}\\d{4,6}$`}`,
  );
  const n = (r.rows[0]?.max ?? 0) + 1;
  return `${prefixe}${String(n).padStart(4, "0")}`;
}

/** Identité CRM par défaut (étudiant sans dossier saisi : importé, ou créé depuis « Comptes »). */
const IDENTITE_VIDE: IdentiteCrm = {
  sexe: null,
  dateNaissance: null,
  lieuNaissance: null,
  nationalite: null,
  adresse: null,
  whatsapp: null,
  statut: "inscrit",
  statutLe: null,
  dateInscription: null,
  origine: "saisie",
  leadId: null,
  remarques: null,
  responsables: [],
};

/** Liste des étudiants (avec tout ce qui sert au tri et aux filtres) du périmètre. */
async function lignesEtudiants(u: Utilisateur, f: { site?: number; classe?: number }): Promise<EtudiantCrmLigne[]> {
  const conds: (SQL | undefined)[] = [etudiantsDuPerimetre(u)];
  if (f.site) conds.push(eq(utilisateurs.siteId, f.site));
  if (f.classe) conds.push(eq(utilisateurs.classeId, f.classe));
  const base = await db
    .select({
      id: utilisateurs.id,
      prenom: utilisateurs.prenom,
      nom: utilisateurs.nom,
      matricule: utilisateurs.matricule,
      telephone: utilisateurs.telephone,
      photoUrl: utilisateurs.photoUrl,
      classeId: utilisateurs.classeId,
      classe: classes.nom,
      annee: classes.anneeScolaire,
      siteId: utilisateurs.siteId,
      site: sites.nomCourt,
      actif: utilisateurs.actif,
      doitChanger: utilisateurs.doitChangerMotDePasse,
      derniereConnexion: utilisateurs.derniereConnexion,
      creeLe: utilisateurs.creeLe,
      statut: dossiersEtudiants.statut,
      origine: dossiersEtudiants.origine,
    })
    .from(utilisateurs)
    .leftJoin(classes, eq(classes.id, utilisateurs.classeId))
    .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
    .leftJoin(dossiersEtudiants, eq(dossiersEtudiants.etudiantId, utilisateurs.id))
    .where(and(...conds));
  if (!base.length) return [];
  const ids = base.map((b) => b.id);

  const pieces = new Map<number, { recues: Set<string>; aVerifier: number }>();
  const taches = new Map<number, { ouvertes: number; enRetard: boolean }>();
  const jour = aujourdhui();
  for (let i = 0; i < ids.length; i += 2000) {
    const paquet = ids.slice(i, i + 2000);
    const lp = await db
      .select({ etudiantId: piecesDossier.etudiantId, type: piecesDossier.type, statut: piecesDossier.statut })
      .from(piecesDossier)
      .where(inArray(piecesDossier.etudiantId, paquet));
    for (const p of lp) {
      const e = pieces.get(p.etudiantId) ?? { recues: new Set<string>(), aVerifier: 0 };
      if (p.statut === "recue") e.recues.add(p.type);
      if (p.statut === "a_verifier") e.aVerifier++;
      pieces.set(p.etudiantId, e);
    }
    const lt = await db
      .select({ etudiantId: tachesSuivi.etudiantId, n: sql<number>`count(*)::int`, premiere: sql<string>`min(${tachesSuivi.echeance})::text` })
      .from(tachesSuivi)
      .where(and(inArray(tachesSuivi.etudiantId, paquet), isNull(tachesSuivi.faiteLe)))
      .groupBy(tachesSuivi.etudiantId);
    for (const t of lt) taches.set(t.etudiantId, { ouvertes: t.n, enRetard: t.premiere < jour });
  }
  const finances = await situationsDe(base.map((b) => ({ id: b.id, anneeClasse: b.annee })));

  return base.map((b): EtudiantCrmLigne => {
    const p = pieces.get(b.id);
    const t = taches.get(b.id);
    return {
      id: b.id,
      prenom: b.prenom,
      nom: b.nom,
      matricule: b.matricule,
      telephone: b.telephone,
      photoUrl: b.photoUrl,
      classeId: b.classeId,
      classe: b.classe,
      siteId: b.siteId,
      site: b.site,
      statut: b.statut ?? "inscrit",
      origine: b.origine ?? "saisie",
      actif: b.actif,
      compteActive: !b.doitChanger,
      derniereConnexion: iso(b.derniereConnexion),
      pieces: { recues: PIECES_REQUISES.filter((x) => p?.recues.has(x)).length, requises: PIECES_REQUISES.length, aVerifier: p?.aVerifier ?? 0 },
      finances: finances.get(b.id) ?? null,
      tachesOuvertes: t?.ouvertes ?? 0,
      tacheEnRetard: t?.enRetard ?? false,
      creeLe: b.creeLe.toISOString(),
    };
  });
}

/** L'étudiant « compte » dans le suivi courant (pas parti, pas diplômé). */
const enCours = (l: Pick<EtudiantCrmLigne, "statut" | "actif">) => l.actif && (l.statut === "inscrit" || l.statut === "suspendu");

function filtrer(lignes: EtudiantCrmLigne[], f: { q?: string; statut?: StatutScolarite; filtre?: (typeof FILTRES_CRM)[number] }): EtudiantCrmLigne[] {
  let r = lignes;
  if (f.statut) r = r.filter((l) => l.statut === f.statut);
  if (f.q) {
    const q = sansAccents(f.q);
    const chiffres = f.q.replace(/\D/g, "");
    r = r.filter(
      (l) =>
        sansAccents(`${l.prenom} ${l.nom}`).includes(q) ||
        sansAccents(`${l.nom} ${l.prenom}`).includes(q) ||
        (l.matricule ?? "").toLowerCase().includes(q) ||
        (chiffres.length >= 4 && (l.telephone ?? "").includes(chiffres)),
    );
  }
  switch (f.filtre) {
    case "incomplets":
      return r.filter((l) => enCours(l) && l.pieces.recues < l.pieces.requises);
    case "a_verifier":
      return r.filter((l) => l.pieces.aVerifier > 0);
    case "retard":
      return r.filter((l) => (l.finances?.retard ?? 0) > 0);
    case "non_actives":
      return r.filter((l) => l.actif && !l.compteActive);
    case "relances":
      return r.filter((l) => l.tachesOuvertes > 0);
    case "sans_frais":
      return r.filter((l) => enCours(l) && !l.finances);
    default:
      return r;
  }
}

function indicateursDe(lignes: EtudiantCrmLigne[], relancesDuJour: number): PageEtudiantsCrm["indicateurs"] {
  const suivis = lignes.filter(enCours);
  return {
    etudiants: suivis.length,
    comptesActives: suivis.filter((l) => l.compteActive).length,
    dossiersIncomplets: suivis.filter((l) => l.pieces.recues < l.pieces.requises).length,
    piecesAVerifier: lignes.reduce((t, l) => t + l.pieces.aVerifier, 0),
    enRetard: lignes.filter((l) => (l.finances?.retard ?? 0) > 0).length,
    montantRetard: lignes.reduce((t, l) => t + (l.finances?.retard ?? 0), 0),
    relancesDuJour,
    sansFrais: suivis.filter((l) => !l.finances).length,
  };
}

const schemaListe = z.object({
  q: z.string().trim().max(80).optional(),
  site: z.coerce.number().int().positive().optional(),
  classe: z.coerce.number().int().positive().optional(),
  statut: z.enum(STATUTS_SCOLARITE).optional(),
  filtre: z.enum(FILTRES_CRM).optional(),
  tri: z.enum(["nom", "recent", "retard", "connexion"]).default("nom"),
  page: z.coerce.number().int().min(1).default(1),
  parPage: z.coerce.number().int().min(1).max(500).default(25),
});

function trier(lignes: EtudiantCrmLigne[], tri: z.infer<typeof schemaListe>["tri"]) {
  const parNom = (a: EtudiantCrmLigne, b: EtudiantCrmLigne) => a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr");
  const copie = [...lignes];
  if (tri === "recent") return copie.sort((a, b) => b.creeLe.localeCompare(a.creeLe) || parNom(a, b));
  if (tri === "retard") return copie.sort((a, b) => (b.finances?.retard ?? 0) - (a.finances?.retard ?? 0) || parNom(a, b));
  if (tri === "connexion") return copie.sort((a, b) => (a.derniereConnexion ?? "").localeCompare(b.derniereConnexion ?? "") || parNom(a, b));
  return copie.sort(parNom);
}

/** Relances ouvertes à échéance aujourd'hui ou dépassée, dans le périmètre. */
async function relancesDuJour(u: Utilisateur, f: { site?: number; classe?: number }): Promise<number> {
  const conds: (SQL | undefined)[] = [etudiantsDuPerimetre(u), isNull(tachesSuivi.faiteLe), sql`${tachesSuivi.echeance} <= ${aujourdhui()}`];
  if (f.site) conds.push(eq(utilisateurs.siteId, f.site));
  if (f.classe) conds.push(eq(utilisateurs.classeId, f.classe));
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tachesSuivi)
    .innerJoin(utilisateurs, eq(utilisateurs.id, tachesSuivi.etudiantId))
    .where(and(...conds));
  return r?.n ?? 0;
}

/** Cellule CSV (séparateur « ; » pour Excel en français). */
const cellule = (v: unknown) => {
  const t = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** Pièces d'un étudiant, avec les pièces requises manquantes. */
async function piecesDe(etudiantId: number, pourEtudiant = false): Promise<PieceDossier[]> {
  const lignes = await db
    .select({
      id: piecesDossier.id,
      type: piecesDossier.type,
      libelle: piecesDossier.libelle,
      statut: piecesDossier.statut,
      note: piecesDossier.note,
      creeLe: piecesDossier.creeLe,
      fichierId: fichiers.id,
      fichierNom: fichiers.nomOriginal,
      prenom: utilisateurs.prenom,
      nom: utilisateurs.nom,
      role: utilisateurs.role,
    })
    .from(piecesDossier)
    .leftJoin(fichiers, eq(fichiers.id, piecesDossier.fichierId))
    .leftJoin(utilisateurs, eq(utilisateurs.id, piecesDossier.ajouteeParId))
    .where(eq(piecesDossier.etudiantId, etudiantId))
    .orderBy(asc(piecesDossier.id));
  const vers = (l: (typeof lignes)[number]): PieceDossier => ({
    id: l.id,
    type: l.type,
    libelle: l.type === "autre" && l.libelle ? l.libelle : LIBELLES_PIECES[l.type],
    requise: PIECES_REQUISES.includes(l.type),
    statut: l.statut,
    note: l.note,
    fichier: l.fichierId ? { id: l.fichierId, nom: l.fichierNom ?? "fichier", url: `/api/fichiers/${l.fichierId}` } : null,
    ajouteePar: l.prenom ? (pourEtudiant && l.role !== "etudiant" ? "La vie scolaire" : `${l.prenom} ${l.nom}`) : null,
    creeLe: l.creeLe.toISOString(),
  });
  // Une ligne par type requis (la plus récente), puis les autres pièces.
  const resultat: PieceDossier[] = [];
  for (const type of PIECES_REQUISES) {
    const siennes = lignes.filter((l) => l.type === type);
    const retenue = siennes.find((l) => l.statut === "recue") ?? siennes.at(-1);
    resultat.push(
      retenue
        ? vers(retenue)
        : { id: null, type, libelle: LIBELLES_PIECES[type], requise: true, statut: "manquante", note: null, fichier: null, ajouteePar: null, creeLe: null },
    );
  }
  for (const l of lignes.filter((x) => !PIECES_REQUISES.includes(x.type))) resultat.push(vers(l));
  return resultat;
}
export { piecesDe };

async function tachesDe(conds: SQL): Promise<(TacheSuivi & { etudiant: { id: number; prenom: string; nom: string; classe: string | null } })[]> {
  const r = await db.execute<Record<string, unknown>>(sql`
    SELECT t.*, e.prenom AS e_prenom, e.nom AS e_nom, c.nom AS e_classe,
      r.prenom AS r_prenom, r.nom AS r_nom, a.prenom AS a_prenom, a.nom AS a_nom, f.prenom AS f_prenom, f.nom AS f_nom
    FROM campus.taches_suivi t
    JOIN campus.utilisateurs e ON e.id = t.etudiant_id
    LEFT JOIN campus.classes c ON c.id = e.classe_id
    LEFT JOIN campus.utilisateurs r ON r.id = t.responsable_id
    LEFT JOIN campus.utilisateurs a ON a.id = t.cree_par_id
    LEFT JOIN campus.utilisateurs f ON f.id = t.faite_par_id
    WHERE ${conds}
    ORDER BY t.faite_le IS NOT NULL, t.echeance ASC, t.id ASC
    LIMIT 500`);
  const jour = aujourdhui();
  const nom = (p: unknown, n: unknown) => (p ? `${p} ${n}` : null);
  return r.rows.map((l) => {
    const echeance = String(l.echeance instanceof Date ? l.echeance.toISOString() : l.echeance).slice(0, 10);
    const faiteLe = l.faite_le ? new Date(l.faite_le as string).toISOString() : null;
    return {
      id: Number(l.id),
      etudiantId: Number(l.etudiant_id),
      titre: String(l.titre),
      echeance,
      responsable: l.responsable_id ? { id: Number(l.responsable_id), nom: nom(l.r_prenom, l.r_nom) ?? "" } : null,
      creePar: nom(l.a_prenom, l.a_nom),
      faiteLe,
      faitePar: nom(l.f_prenom, l.f_nom),
      enRetard: !faiteLe && echeance < jour,
      creeLe: new Date(l.cree_le as string).toISOString(),
      etudiant: { id: Number(l.etudiant_id), prenom: String(l.e_prenom), nom: String(l.e_nom), classe: (l.e_classe as string | null) ?? null },
    };
  });
}

/** Condition SQL brute « étudiant e du périmètre » (requêtes en SQL). */
function perimetreSql(u: Utilisateur): SQL {
  const p = perimetreSites(u);
  return p ? sql`e.role = 'etudiant' AND e.site_id = ANY(${`{${p.join(",")}}`}::int[])` : sql`e.role = 'etudiant'`;
}

/** Tâche du périmètre, sinon 404. */
async function tacheGeree(u: Utilisateur, id: number) {
  const [t] = await db.select().from(tachesSuivi).where(eq(tachesSuivi.id, id));
  if (!t) throw introuvable("Relance");
  await etudiantGere(u, t.etudiantId).catch(() => {
    throw introuvable("Relance");
  });
  return t;
}

/** Pièce du périmètre, sinon 404. */
async function pieceGeree(u: Utilisateur, id: number) {
  const [p] = await db.select().from(piecesDossier).where(eq(piecesDossier.id, id));
  if (!p) throw introuvable("Pièce");
  await etudiantGere(u, p.etudiantId).catch(() => {
    throw introuvable("Pièce");
  });
  return p;
}

/** Membre de l'équipe (actif) à qui confier une relance sur cet étudiant. */
async function responsableValide(u: Utilisateur, id: number, etudiant: Utilisateur) {
  const [r] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, id));
  const ok = r && r.actif && (r.role === "admin" || (r.role === "vie_scolaire" && (!r.siteId || r.siteId === etudiant.siteId)));
  if (!ok) throw invalide("Cette personne ne peut pas recevoir cette relance (direction, ou vie scolaire du campus de l'étudiant).");
  return r;
}

/** Fichier téléversé pour une pièce : par la personne elle-même, en usage « piece ». */
async function fichierDePiece(fichierId: number, auteurs: number[]) {
  const [f] = await db.select().from(fichiers).where(eq(fichiers.id, fichierId));
  if (!f || f.usage !== "piece" || !auteurs.includes(f.proprietaireId)) throw invalide("Fichier de la pièce introuvable : envoyez-le à nouveau.");
  return f;
}
export { fichierDePiece };

// ═══════════════════════════════════════════════════════════════════════════

const schemaNouvelEtudiant = z.object({
  prenom: texteCourt(80),
  nom: texteCourt(80),
  matricule: optionnel(schemaMatricule),
  classeId: z.number().int().positive(),
  telephone: optionnel(z.string().trim().max(30)),
  email: optionnel(schemaEmailCompte),
  ...champsIdentite,
  piecesRecues: z.array(z.enum(TYPES_PIECES)).max(10).optional(),
  appliquerFrais: z.boolean().optional(),
  premierVersement: z
    .object({
      montant: z.number().int().positive("montant du versement invalide").max(50_000_000),
      moyen: z.enum(MOYENS_PAIEMENT),
      reference: optionnel(z.string().trim().max(80)),
      dateVersement: optionnel(schemaJour),
    })
    .nullable()
    .optional(),
  leadId: optionnel(z.string().trim().max(64)),
});

const schemaIdentite = z.object({ ...champsIdentite, statut: z.enum(STATUTS_SCOLARITE).optional() });

export function enregistrerCrm(app: Express) {
  // ── Liste ────────────────────────────────────────────────────────────────

  app.get(
    `${P}/etudiants`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const f = valider(schemaListe, req.query);
      const tous = await lignesEtudiants(u, f);
      const retenus = trier(filtrer(tous, f), f.tri);
      const page: PageEtudiantsCrm = {
        lignes: retenus.slice((f.page - 1) * f.parPage, f.page * f.parPage),
        total: retenus.length,
        page: f.page,
        parPage: f.parPage,
        indicateurs: indicateursDe(tous, await relancesDuJour(u, f)),
      };
      res.json(page);
    }),
  );

  app.get(
    `${P}/etudiants/export`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const f = valider(schemaListe, req.query);
      const lignes = trier(filtrer(await lignesEtudiants(u, f), f), f.tri);
      const ids = lignes.map((l) => l.id);
      const dossiers = ids.length ? await db.select().from(dossiersEtudiants).where(inArray(dossiersEtudiants.etudiantId, ids)) : [];
      const parId = new Map(dossiers.map((d) => [d.etudiantId, d]));
      const entetes = [
        "Matricule",
        "Nom",
        "Prénoms",
        "Classe",
        "Campus",
        "Statut",
        "Téléphone",
        "Sexe",
        "Date de naissance",
        "Lieu de naissance",
        "Responsable principal",
        "Téléphone du responsable",
        "Pièces reçues",
        "Dû (F CFA)",
        "Payé (F CFA)",
        "Reste (F CFA)",
        "En retard (F CFA)",
        "Compte activé",
        "Dernière connexion",
      ];
      const corps = lignes.map((l) => {
        const d = parId.get(l.id);
        const resp = d?.responsables.find((r) => r.principal) ?? d?.responsables[0];
        return [
          l.matricule,
          l.nom,
          l.prenom,
          l.classe,
          l.site,
          LIBELLES_STATUTS_SCOLARITE[l.statut],
          l.telephone,
          d?.sexe ?? "",
          d?.dateNaissance ?? "",
          d?.lieuNaissance ?? "",
          resp ? `${resp.nom} (${LIBELLES_LIENS_RESPONSABLE[resp.lien]})` : "",
          resp?.telephone ?? "",
          `${l.pieces.recues}/${l.pieces.requises}`,
          l.finances?.du ?? "",
          l.finances?.paye ?? "",
          l.finances?.reste ?? "",
          l.finances?.retard ?? "",
          l.compteActive ? "oui" : "non",
          l.derniereConnexion ? l.derniereConnexion.slice(0, 10) : "",
        ]
          .map(cellule)
          .join(";");
      });
      await journaliser(u, "export_etudiants", { nombre: lignes.length, filtres: f });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="etudiants-2iae-${aujourdhui()}.csv"`);
      res.setHeader("Cache-Control", "no-store");
      // BOM : Excel lit alors les accents correctement.
      res.send(`﻿${[entetes.join(";"), ...corps].join("\r\n")}`);
    }),
  );

  app.get(
    `${P}/etudiants/matricule`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const { classe } = valider(z.object({ classe: z.coerce.number().int().positive() }), req.query);
      const c = await classeGeree(u, classe);
      const r: MatriculePropose = { matricule: await matriculePropose(c) };
      res.json(r);
    }),
  );

  // ── Inscription complète ─────────────────────────────────────────────────

  app.post(
    `${P}/etudiants`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(schemaNouvelEtudiant, req.body);
      const classe = await classeGeree(u, d.classeId);
      const telephone = telephoneSaisi(d.telephone ?? null);
      const whatsapp = telephoneSaisi(d.whatsapp ?? null);
      const responsables = responsablesSaisis(d.responsables ?? []);
      if (d.leadId) {
        const [deja] = await db.select({ id: dossiersEtudiants.etudiantId }).from(dossiersEtudiants).where(eq(dossiersEtudiants.leadId, d.leadId));
        if (deja) throw new ErreurHttp(409, "Ce préinscrit du site a déjà été inscrit au campus.");
      }
      const matriculeSaisi = d.matricule ?? null;
      await verifierUnicite({ matricule: matriculeSaisi, email: d.email ?? null });
      const [modele] = await db.select().from(fraisClasses).where(eq(fraisClasses.classeId, classe.id));
      const appliquer = d.appliquerFrais ?? true;
      const code = codeProvisoire();
      const hash = await hacher(code);
      const expireLe = new Date(Date.now() + DUREE_CODE_PROVISOIRE_MS);

      // Matricule proposé : deux inscriptions à la même seconde peuvent viser le même numéro, on réessaie.
      let cree: Utilisateur | null = null;
      let versementId: number | null = null;
      for (let essai = 0; essai < 3 && !cree; essai++) {
        const matricule = matriculeSaisi ?? (await matriculePropose(classe));
        try {
          const r = await db.transaction(async (tx) => {
            const [c] = await tx
              .insert(utilisateurs)
              .values({
                role: "etudiant",
                prenom: espaces(d.prenom),
                nom: espaces(d.nom),
                matricule,
                email: d.email ?? null,
                telephone,
                motDePasseHash: hash,
                doitChangerMotDePasse: true,
                motDePasseExpireLe: expireLe,
                siteId: classe.siteId,
                classeId: classe.id,
              })
              .returning();
            await tx.insert(dossiersEtudiants).values({
              etudiantId: c.id,
              sexe: d.sexe ?? null,
              dateNaissance: d.dateNaissance ?? null,
              lieuNaissance: d.lieuNaissance ?? null,
              nationalite: d.nationalite ?? null,
              adresse: d.adresse ?? null,
              whatsapp,
              statut: "inscrit",
              statutLe: new Date(),
              dateInscription: d.dateInscription ?? aujourdhui(),
              responsables,
              origine: d.leadId ? "site" : "saisie",
              leadId: d.leadId ?? null,
              remarques: d.remarques ?? null,
            });
            const recues = [...new Set(d.piecesRecues ?? [])].filter((t) => t !== "autre");
            if (recues.length) {
              await tx
                .insert(piecesDossier)
                .values(recues.map((type) => ({ etudiantId: c.id, type, statut: "recue" as const, ajouteeParId: u.id, verifieeParId: u.id, verifieeLe: new Date() })));
            }
            if (appliquer && modele?.echeancier.length) await copierEcheancier(tx, c.id, classe.anneeScolaire, modele.echeancier, u.id);
            let vId: number | null = null;
            if (d.premierVersement) {
              const numero = await prochainNumeroRecu(tx);
              const [v] = await tx
                .insert(versements)
                .values({
                  numero,
                  etudiantId: c.id,
                  anneeScolaire: classe.anneeScolaire,
                  montant: d.premierVersement.montant,
                  moyen: d.premierVersement.moyen,
                  reference: d.premierVersement.reference ?? null,
                  dateVersement: d.premierVersement.dateVersement ?? aujourdhui(),
                  encaisseParId: u.id,
                })
                .returning({ id: versements.id });
              vId = v.id;
            }
            return { c, vId };
          });
          cree = r.c;
          versementId = r.vId;
        } catch (e) {
          const code23505 = (e as { code?: string }).code === "23505";
          if (!code23505 || matriculeSaisi) throw e;
        }
      }
      if (!cree) throw new ErreurHttp(409, "Le matricule proposé vient d'être pris : réessayez.");

      const jeton = await creerJeton(cree.id, "activation");
      const lien = lienActivation(jeton);
      await journaliser(u, "etudiant_inscrit", { compteId: cree.id, classeId: classe.id, leadId: d.leadId ?? null, versementId });
      if (versementId) await journaliser(u, "versement_encaisse", { versementId, etudiantId: cree.id, montant: d.premierVersement?.montant });
      if (d.leadId) {
        // Le pipeline du site passe le préinscrit à « inscrit » (sans bloquer l'inscription si le site ne répond pas).
        void signalerInscritSite(d.leadId, { matricule: cree.matricule ?? "", nom: `${cree.prenom} ${cree.nom}`, classe: classe.nom, par: `${u.prenom} ${u.nom}` });
      }
      const reponse: EtudiantCree = {
        compte: await compteParId(cree.id),
        code,
        lien,
        whatsapp: lienWhatsApp(telephone ?? whatsapp, messageCode(cree, code, lien, expireLe)),
        expireLe: expireLe.toISOString(),
        etudiantId: cree.id,
        matricule: cree.matricule ?? "",
        versementId,
      };
      res.status(201).json(reponse);
    }),
  );

  // ── Dossier CRM ──────────────────────────────────────────────────────────

  app.get(
    `${P}/etudiants/:id(\\d+)/crm`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const e = await etudiantGere(u, idParam(req));
      const [d] = await db.select().from(dossiersEtudiants).where(eq(dossiersEtudiants.etudiantId, e.id));
      const [classe] = e.classeId ? await db.select().from(classes).where(eq(classes.id, e.classeId)) : [];
      const identite: IdentiteCrm = d
        ? {
            sexe: d.sexe,
            dateNaissance: d.dateNaissance,
            lieuNaissance: d.lieuNaissance,
            nationalite: d.nationalite,
            adresse: d.adresse,
            whatsapp: d.whatsapp,
            statut: d.statut,
            statutLe: iso(d.statutLe),
            dateInscription: d.dateInscription,
            origine: d.origine,
            leadId: d.leadId,
            remarques: d.remarques,
            responsables: d.responsables,
          }
        : IDENTITE_VIDE;
      const listeSuivis = await db
        .select({ id: suivis.id, type: suivis.type, texte: suivis.texte, creeLe: suivis.creeLe, prenom: utilisateurs.prenom, nom: utilisateurs.nom })
        .from(suivis)
        .innerJoin(utilisateurs, eq(utilisateurs.id, suivis.auteurId))
        .where(eq(suivis.etudiantId, e.id))
        .orderBy(desc(suivis.creeLe));
      const equipe = await db
        .select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, role: utilisateurs.role })
        .from(utilisateurs)
        .where(
          and(
            eq(utilisateurs.actif, true),
            or(eq(utilisateurs.role, "admin"), and(eq(utilisateurs.role, "vie_scolaire"), or(isNull(utilisateurs.siteId), e.siteId ? eq(utilisateurs.siteId, e.siteId) : undefined))),
          ),
        )
        .orderBy(asc(utilisateurs.prenom));
      const [site] = e.siteId ? await db.select({ nom: sites.nomCourt }).from(sites).where(eq(sites.id, e.siteId)) : [];
      const bonjour = (prenom: string) => `Bonjour ${prenom}, c'est la vie scolaire ${site ? `du campus ${site.nom} ` : ""}(2IAE).`;
      const contacts: DossierCrm["contacts"] = [];
      if (e.telephone) contacts.push({ libelle: `${e.prenom} (étudiant)`, telephone: e.telephone, whatsapp: numeroWhatsApp(e.telephone) ? lienWhatsApp(e.telephone, bonjour(e.prenom)) : null });
      if (identite.whatsapp && identite.whatsapp !== e.telephone) {
        contacts.push({ libelle: `${e.prenom} (WhatsApp)`, telephone: identite.whatsapp, whatsapp: numeroWhatsApp(identite.whatsapp) ? lienWhatsApp(identite.whatsapp, bonjour(e.prenom)) : null });
      }
      for (const r of identite.responsables) {
        if (!r.telephone) continue;
        const texte = `Bonjour, c'est la vie scolaire ${site ? `du campus ${site.nom} ` : ""}(2IAE), au sujet de ${e.prenom} ${e.nom}.`;
        contacts.push({ libelle: `${r.nom} (${LIBELLES_LIENS_RESPONSABLE[r.lien].toLowerCase()})`, telephone: r.telephone, whatsapp: numeroWhatsApp(r.telephone) ? lienWhatsApp(r.telephone, texte) : null });
      }
      const dossier: DossierCrm = {
        identite,
        pieces: await piecesDe(e.id),
        suivis: listeSuivis.map((s) => ({ id: s.id, type: (TYPES_SUIVI as readonly string[]).includes(s.type) ? (s.type as TypeSuivi) : "note", texte: s.texte, auteur: `${s.prenom} ${s.nom}`, creeLe: s.creeLe.toISOString() })),
        taches: await tachesDe(sql`t.etudiant_id = ${e.id}`),
        scolarite: await scolariteDe(e, classe?.anneeScolaire ?? null),
        equipe: equipe.map((x) => ({ id: x.id, nom: `${x.prenom} ${x.nom}${x.role === "admin" ? " (direction)" : ""}` })),
        contacts,
      };
      res.json(dossier);
    }),
  );

  app.patch(
    `${P}/etudiants/:id(\\d+)/crm`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const e = await etudiantGere(u, idParam(req));
      const d = valider(schemaIdentite, req.body);
      const [avant] = await db.select().from(dossiersEtudiants).where(eq(dossiersEtudiants.etudiantId, e.id));
      const maj: Partial<typeof dossiersEtudiants.$inferInsert> = { modifieLe: new Date() };
      if (d.sexe !== undefined) maj.sexe = d.sexe;
      if (d.dateNaissance !== undefined) maj.dateNaissance = d.dateNaissance;
      if (d.lieuNaissance !== undefined) maj.lieuNaissance = d.lieuNaissance;
      if (d.nationalite !== undefined) maj.nationalite = d.nationalite;
      if (d.adresse !== undefined) maj.adresse = d.adresse;
      if (d.whatsapp !== undefined) maj.whatsapp = telephoneSaisi(d.whatsapp);
      if (d.dateInscription !== undefined) maj.dateInscription = d.dateInscription;
      if (d.remarques !== undefined) maj.remarques = d.remarques;
      if (d.responsables !== undefined) maj.responsables = responsablesSaisis(d.responsables);
      if (d.statut !== undefined && d.statut !== (avant?.statut ?? "inscrit")) {
        maj.statut = d.statut;
        maj.statutLe = new Date();
      }
      await db
        .insert(dossiersEtudiants)
        .values({ etudiantId: e.id, ...maj })
        .onConflictDoUpdate({ target: dossiersEtudiants.etudiantId, set: maj });
      await journaliser(u, maj.statut ? "statut_scolarite_change" : "dossier_modifie", {
        etudiantId: e.id,
        champs: Object.keys(maj).filter((k) => k !== "modifieLe"),
        ...(maj.statut ? { de: avant?.statut ?? "inscrit", vers: maj.statut } : {}),
      });
      res.json({ ok: true });
    }),
  );

  // ── Pièces ───────────────────────────────────────────────────────────────

  app.post(
    `${P}/etudiants/:id(\\d+)/pieces`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const e = await etudiantGere(u, idParam(req));
      const d = valider(
        z.object({
          type: z.enum(TYPES_PIECES),
          libelle: optionnel(z.string().trim().max(120)),
          fichierId: z.number().int().positive().nullable().optional(),
          note: optionnel(z.string().trim().max(500)),
        }),
        req.body,
      );
      if (d.type === "autre" && !d.libelle) throw invalide("Donnez un nom à cette pièce.");
      if (d.fichierId) await fichierDePiece(d.fichierId, [u.id, e.id]);
      const valeurs = {
        statut: "recue" as const,
        note: d.note ?? null,
        verifieeParId: u.id,
        verifieeLe: new Date(),
        ...(d.fichierId ? { fichierId: d.fichierId } : {}),
      };
      // Une pièce requise déjà présente (déposée, refusée…) est mise à jour plutôt que doublée.
      const [existante] =
        d.type !== "autre"
          ? await db
              .select()
              .from(piecesDossier)
              .where(and(eq(piecesDossier.etudiantId, e.id), eq(piecesDossier.type, d.type)))
              .orderBy(desc(piecesDossier.id))
              .limit(1)
          : [];
      if (existante) await db.update(piecesDossier).set(valeurs).where(eq(piecesDossier.id, existante.id));
      else await db.insert(piecesDossier).values({ etudiantId: e.id, type: d.type, libelle: d.type === "autre" ? d.libelle : null, ajouteeParId: u.id, ...valeurs });
      await journaliser(u, "piece_recue", { etudiantId: e.id, type: d.type });
      res.status(201).json(await piecesDe(e.id));
    }),
  );

  app.patch(
    `${P}/pieces/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const p = await pieceGeree(u, idParam(req));
      const d = valider(z.object({ statut: z.enum(["recue", "refusee"]), note: optionnel(z.string().trim().max(500)) }), req.body);
      if (d.statut === "refusee" && !d.note) throw invalide("Dites à l'étudiant ce qui ne va pas (photo floue, pièce expirée…).");
      await db
        .update(piecesDossier)
        .set({ statut: d.statut, note: d.note ?? null, verifieeParId: u.id, verifieeLe: new Date() })
        .where(eq(piecesDossier.id, p.id));
      await journaliser(u, d.statut === "recue" ? "piece_validee" : "piece_refusee", { etudiantId: p.etudiantId, pieceId: p.id, type: p.type });
      res.json(await piecesDe(p.etudiantId));
    }),
  );

  app.delete(
    `${P}/pieces/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const p = await pieceGeree(u, idParam(req));
      await db.delete(piecesDossier).where(eq(piecesDossier.id, p.id));
      await journaliser(u, "piece_retiree", { etudiantId: p.etudiantId, pieceId: p.id, type: p.type });
      res.json(await piecesDe(p.etudiantId));
    }),
  );

  // ── Relances ─────────────────────────────────────────────────────────────

  app.post(
    `${P}/etudiants/:id(\\d+)/taches`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const e = await etudiantGere(u, idParam(req));
      const d = valider(
        z.object({ titre: texteCourt(200), echeance: schemaJour, responsableId: z.number().int().positive().nullable().optional() }),
        req.body,
      );
      const responsable = d.responsableId ? await responsableValide(u, d.responsableId, e) : u;
      const [t] = await db
        .insert(tachesSuivi)
        .values({ etudiantId: e.id, titre: espaces(d.titre), echeance: d.echeance, responsableId: responsable.id, creeParId: u.id })
        .returning({ id: tachesSuivi.id });
      res.status(201).json((await tachesDe(sql`t.id = ${t.id}`))[0]);
    }),
  );

  app.patch(
    `${P}/taches/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const t = await tacheGeree(u, idParam(req));
      const d = valider(
        z.object({
          faite: z.boolean().optional(),
          titre: texteCourt(200).optional(),
          echeance: schemaJour.optional(),
          responsableId: z.number().int().positive().optional(),
        }),
        req.body,
      );
      const maj: Partial<typeof tachesSuivi.$inferInsert> = {};
      if (d.faite === true && !t.faiteLe) Object.assign(maj, { faiteLe: new Date(), faiteParId: u.id });
      if (d.faite === false) Object.assign(maj, { faiteLe: null, faiteParId: null });
      if (d.titre !== undefined) maj.titre = espaces(d.titre);
      if (d.echeance !== undefined) maj.echeance = d.echeance;
      if (d.responsableId !== undefined) {
        const [e] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, t.etudiantId));
        maj.responsableId = (await responsableValide(u, d.responsableId, e)).id;
      }
      if (Object.keys(maj).length) await db.update(tachesSuivi).set(maj).where(eq(tachesSuivi.id, t.id));
      res.json((await tachesDe(sql`t.id = ${t.id}`))[0]);
    }),
  );

  app.delete(
    `${P}/taches/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const t = await tacheGeree(u, idParam(req));
      await db.delete(tachesSuivi).where(eq(tachesSuivi.id, t.id));
      res.json({ ok: true });
    }),
  );

  app.get(
    `${P}/relances`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const { qui } = valider(z.object({ qui: z.enum(["moi", "tous"]).default("tous") }), req.query);
      const conds = [perimetreSql(u)];
      if (qui === "moi") conds.push(sql`(t.responsable_id = ${u.id} OR (t.responsable_id IS NULL AND t.cree_par_id = ${u.id}))`);
      const jour = aujourdhui();
      const ouvertes = await tachesDe(sql.join([...conds, sql`t.faite_le IS NULL`], sql` AND `));
      const faites = await tachesDe(sql.join([...conds, sql`t.faite_le > now() - interval '7 days'`], sql` AND `));
      const liste: ListeRelances = {
        enRetard: ouvertes.filter((t) => t.echeance < jour),
        aujourdhui: ouvertes.filter((t) => t.echeance === jour),
        aVenir: ouvertes.filter((t) => t.echeance > jour),
        faitesRecemment: faites.sort((a, b) => (b.faiteLe ?? "").localeCompare(a.faiteLe ?? "")).slice(0, 30),
      };
      res.json(liste);
    }),
  );

  // ── Préinscrits du site 2iae.com ─────────────────────────────────────────

  app.get(
    `${P}/preinscrits`,
    EQUIPE,
    route(async (_req, res) => {
      const lecture = await lirePreinscritsSite();
      const ids = lecture.preinscrits.map((l) => l.id);
      const deja = ids.length
        ? await db
            .select({ leadId: dossiersEtudiants.leadId, id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, matricule: utilisateurs.matricule })
            .from(dossiersEtudiants)
            .innerJoin(utilisateurs, eq(utilisateurs.id, dossiersEtudiants.etudiantId))
            .where(and(isNotNull(dossiersEtudiants.leadId), inArray(dossiersEtudiants.leadId, ids)))
        : [];
      const parLead = new Map(deja.map((x) => [x.leadId!, { id: x.id, prenom: x.prenom, nom: x.nom, matricule: x.matricule }]));
      const liste: ListePreinscrits = {
        branche: lecture.branche,
        message: lecture.message,
        preinscrits: lecture.preinscrits.map((l) => ({ ...l, etudiant: parLead.get(l.id) ?? null })),
      };
      res.json(liste);
    }),
  );
}

/** Pour d'autres modules : situation financière d'un étudiant (null sans échéancier). */
export async function situationEtudiant(e: { id: number }, anneeClasse: string | null): Promise<SituationFinanciere | null> {
  return (await situationsDe([{ id: e.id, anneeClasse }])).get(e.id) ?? null;
}

export type { TypePiece };
