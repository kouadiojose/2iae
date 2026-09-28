// Scolarité : frais par classe, échéancier de chaque étudiant, versements
// avec reçu numéroté, tableau des encaissements et des retards, et l'espace
// « Mon dossier » de l'étudiant (ses pièces, ses paiements, ses reçus).
//
//   GET    /api/pilotage/frais-classes                         frais de chaque classe du périmètre
//   PUT    /api/pilotage/frais-classes/:classeId               échéancier modèle d'une classe
//   POST   /api/pilotage/frais-classes/:classeId/appliquer     le copier aux étudiants de la classe qui n'en ont pas
//   POST   /api/pilotage/etudiants/:id/echeances/classe        appliquer les frais de sa classe à un étudiant
//   POST   /api/pilotage/etudiants/:id/echeances               ajouter une échéance ou une remise
//   PATCH  /api/pilotage/echeances/:id
//   DELETE /api/pilotage/echeances/:id
//   POST   /api/pilotage/etudiants/:id/versements              encaisser (reçu numéroté)
//   POST   /api/pilotage/versements/:id/annuler                annuler un versement (motif obligatoire)
//   GET    /api/pilotage/versements/:id/recu                   reçu imprimable
//   GET    /api/pilotage/scolarite                             encaissements, retards, derniers versements
//   GET    /api/pilotage/versements/export                     journal de caisse (CSV)
//   GET    /api/mon-dossier                                    l'étudiant : pièces et scolarité
//   POST   /api/mon-dossier/pieces                             l'étudiant dépose une pièce (à vérifier)
//   GET    /api/mon-dossier/versements/:id/recu                l'étudiant : un de ses reçus
//
// Un versement ne se supprime jamais : il s'annule (motif, auteur, date).
// Seules la direction et la vie scolaire du campus voient l'argent.
import type { Express } from "express";
import { z } from "zod";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { moi, perimetreSites, exigerRole } from "../auth";
import { enregistrerGardienFichier } from "../fichiers";
import { route, valider, idParam, ErreurHttp, introuvable, interdit, invalide } from "../http";
import { EQUIPE, journaliser, lienWhatsApp, numeroWhatsApp, etudiantGere, classeGeree, optionnel, texteCourt, espaces } from "./admin";
import { piecesDe, fichierDePiece } from "./crm";
import {
  aujourdhui,
  calculerScolarite,
  copierEcheancier,
  derniersVersements,
  enLettres,
  fcfa,
  prochainNumeroRecu,
  scolariteDe,
  situationsDe,
  versVersementCrm,
  jourDe,
} from "../scolarite-outils";
import {
  utilisateurs,
  classes,
  sites,
  fraisClasses,
  echeancesEtudiants,
  versements,
  dossiersEtudiants,
  piecesDossier,
  MOYENS_PAIEMENT,
  LIBELLES_MOYENS_PAIEMENT,
  TYPES_PIECES,
  type Utilisateur,
  type LigneEcheancier,
  type ListeFraisClasses,
  type FraisClasseLigne,
  type TableauScolarite,
  type LigneRetard,
  type RecuPaiement,
  type MonDossier,
  type MoyenPaiement,
} from "@shared/schema";

const P = "/api/pilotage";
const schemaJour = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date au format AAAA-MM-JJ").refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "date invalide");
const schemaMontant = z.number().int("montant en francs CFA entiers").min(0).max(50_000_000, "montant trop élevé");
const schemaAnnee = z.string().regex(/^\d{4}-\d{4}$/, "année scolaire au format 2026-2027");

const schemaLigneEcheancier = z.object({
  libelle: texteCourt(80),
  date: schemaJour.nullable(),
  montant: schemaMontant,
});

/** Année scolaire de la classe actuelle d'un étudiant. */
async function anneeDe(e: Pick<Utilisateur, "classeId">): Promise<string | null> {
  if (!e.classeId) return null;
  const [c] = await db.select({ annee: classes.anneeScolaire }).from(classes).where(eq(classes.id, e.classeId));
  return c?.annee ?? null;
}

/** Échéance du périmètre, sinon 404. */
async function echeanceGeree(u: Utilisateur, id: number) {
  const [x] = await db.select().from(echeancesEtudiants).where(eq(echeancesEtudiants.id, id));
  if (!x) throw introuvable("Échéance");
  const e = await etudiantGere(u, x.etudiantId).catch(() => {
    throw introuvable("Échéance");
  });
  return { x, e };
}

/** Versement du périmètre, sinon 404. */
async function versementGere(u: Utilisateur, id: number) {
  const [v] = await db.select().from(versements).where(eq(versements.id, id));
  if (!v) throw introuvable("Versement");
  const e = await etudiantGere(u, v.etudiantId).catch(() => {
    throw introuvable("Versement");
  });
  return { v, e };
}

/** Le reçu d'un versement, tel qu'il s'imprime. */
async function recuDe(versementId: number): Promise<RecuPaiement> {
  const [v] = await db.select().from(versements).where(eq(versements.id, versementId));
  if (!v) throw introuvable("Reçu");
  const [e] = await db
    .select({ prenom: utilisateurs.prenom, nom: utilisateurs.nom, matricule: utilisateurs.matricule, classe: classes.nom, site: sites.nom })
    .from(utilisateurs)
    .leftJoin(classes, eq(classes.id, utilisateurs.classeId))
    .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
    .where(eq(utilisateurs.id, v.etudiantId));
  const [auteur] = v.encaisseParId ? await db.select({ prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(eq(utilisateurs.id, v.encaisseParId)) : [];
  // Situation juste après ce versement : versements valides de l'année, jusqu'à celui-ci inclus.
  const lignes = await db
    .select()
    .from(echeancesEtudiants)
    .where(and(eq(echeancesEtudiants.etudiantId, v.etudiantId), eq(echeancesEtudiants.anneeScolaire, v.anneeScolaire)));
  const avant = await db
    .select({ id: versements.id, montant: versements.montant, date: versements.dateVersement })
    .from(versements)
    .where(and(eq(versements.etudiantId, v.etudiantId), eq(versements.anneeScolaire, v.anneeScolaire), isNull(versements.annuleLe)));
  const paye = avant.filter((x) => x.date < v.dateVersement || (x.date === v.dateVersement && x.id <= v.id)).reduce((t, x) => t + x.montant, 0);
  const { situation } = calculerScolarite(v.anneeScolaire, lignes, paye);
  return {
    numero: v.numero,
    dateVersement: v.dateVersement,
    montant: v.montant,
    montantEnLettres: enLettres(v.montant),
    moyen: v.moyen,
    reference: v.reference,
    etudiant: { prenom: e?.prenom ?? "", nom: e?.nom ?? "", matricule: e?.matricule ?? null },
    classe: e?.classe ?? null,
    site: e?.site ?? null,
    anneeScolaire: v.anneeScolaire,
    encaissePar: auteur ? `${auteur.prenom} ${auteur.nom}` : null,
    apres: situation ? { du: situation.du, paye: situation.paye, reste: situation.reste } : null,
    annule: v.annuleLe ? { le: v.annuleLe.toISOString(), motif: v.motifAnnulation } : null,
    emisLe: v.creeLe.toISOString(),
  };
}

/** Condition « étudiant du périmètre » (et filtres campus/classe) pour les tableaux. */
function conditionsEtudiants(u: Utilisateur, f: { site?: number; classe?: number }): SQL {
  const p = perimetreSites(u);
  return and(
    eq(utilisateurs.role, "etudiant"),
    p ? inArray(utilisateurs.siteId, p) : undefined,
    f.site ? eq(utilisateurs.siteId, f.site) : undefined,
    f.classe ? eq(utilisateurs.classeId, f.classe) : undefined,
  )!;
}

const cellule = (v: unknown) => {
  const t = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

const ETUDIANT = exigerRole("etudiant");

export function enregistrerScolarite(app: Express) {
  // Pièces du dossier : l'étudiant lit les siennes (déposées par lui ou par la vie scolaire).
  enregistrerGardienFichier("piece", async (u, f) => {
    if (u.role !== "etudiant") return false;
    const [p] = await db
      .select({ id: piecesDossier.id })
      .from(piecesDossier)
      .where(and(eq(piecesDossier.fichierId, f.id), eq(piecesDossier.etudiantId, u.id)))
      .limit(1);
    return Boolean(p);
  });

  // ── Frais par classe ─────────────────────────────────────────────────────

  app.get(
    `${P}/frais-classes`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const p = perimetreSites(u);
      const lignes = await db
        .select({
          classeId: classes.id,
          classe: classes.nom,
          siteId: classes.siteId,
          site: sites.nomCourt,
          anneeScolaire: classes.anneeScolaire,
          echeancier: fraisClasses.echeancier,
          modifieLe: fraisClasses.modifieLe,
        })
        .from(classes)
        .innerJoin(sites, eq(sites.id, classes.siteId))
        .leftJoin(fraisClasses, eq(fraisClasses.classeId, classes.id))
        .where(p ? inArray(classes.siteId, p) : undefined)
        .orderBy(asc(sites.ordre), asc(classes.nom));
      const effectifs = await db.execute<{ classe_id: number; effectif: number; sans: number }>(sql`
        SELECT u.classe_id, count(*)::int AS effectif,
          count(*) FILTER (WHERE NOT EXISTS (
            SELECT 1 FROM campus.echeances_etudiants x WHERE x.etudiant_id = u.id AND x.annee_scolaire = c.annee_scolaire
          ))::int AS sans
        FROM campus.utilisateurs u JOIN campus.classes c ON c.id = u.classe_id
        WHERE u.role = 'etudiant' AND u.actif
        GROUP BY u.classe_id`);
      const parClasse = new Map(effectifs.rows.map((r) => [Number(r.classe_id), r]));
      const liste: ListeFraisClasses = {
        classes: lignes.map((l): FraisClasseLigne => {
          const ech = l.echeancier ?? [];
          return {
            classeId: l.classeId,
            classe: l.classe,
            siteId: l.siteId,
            site: l.site,
            anneeScolaire: l.anneeScolaire,
            effectif: parClasse.get(l.classeId)?.effectif ?? 0,
            echeancier: ech,
            total: ech.reduce((t, x) => t + x.montant, 0),
            sansEcheancier: parClasse.get(l.classeId)?.sans ?? 0,
            modifieLe: l.modifieLe ? l.modifieLe.toISOString() : null,
          };
        }),
      };
      res.json(liste);
    }),
  );

  app.put(
    `${P}/frais-classes/:classeId(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const c = await classeGeree(u, idParam(req, "classeId"));
      const { echeancier } = valider(z.object({ echeancier: z.array(schemaLigneEcheancier).max(24) }), req.body);
      const propre: LigneEcheancier[] = echeancier.map((l) => ({ libelle: espaces(l.libelle), date: l.date, montant: l.montant }));
      await db
        .insert(fraisClasses)
        .values({ classeId: c.id, echeancier: propre, modifieLe: new Date(), modifieParId: u.id })
        .onConflictDoUpdate({ target: fraisClasses.classeId, set: { echeancier: propre, modifieLe: new Date(), modifieParId: u.id } });
      await journaliser(u, "frais_classe_modifies", { classeId: c.id, total: propre.reduce((t, l) => t + l.montant, 0), lignes: propre.length });
      res.json({ ok: true });
    }),
  );

  app.post(
    `${P}/frais-classes/:classeId(\\d+)/appliquer`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const c = await classeGeree(u, idParam(req, "classeId"));
      const [modele] = await db.select().from(fraisClasses).where(eq(fraisClasses.classeId, c.id));
      if (!modele?.echeancier.some((l) => l.montant > 0)) throw invalide("Saisissez d'abord les frais de cette classe.");
      const cibles = await db.execute<{ id: number }>(sql`
        SELECT u.id FROM campus.utilisateurs u
        WHERE u.role = 'etudiant' AND u.actif AND u.classe_id = ${c.id}
          AND NOT EXISTS (SELECT 1 FROM campus.echeances_etudiants x WHERE x.etudiant_id = u.id AND x.annee_scolaire = ${c.anneeScolaire})`);
      await db.transaction(async (tx) => {
        for (const r of cibles.rows) await copierEcheancier(tx, Number(r.id), c.anneeScolaire, modele.echeancier, u.id);
      });
      await journaliser(u, "frais_classe_appliques", { classeId: c.id, etudiants: cibles.rows.length });
      res.json({ appliques: cibles.rows.length });
    }),
  );

  // ── Échéancier d'un étudiant ─────────────────────────────────────────────

  app.post(
    `${P}/etudiants/:id(\\d+)/echeances/classe`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const e = await etudiantGere(u, idParam(req));
      const { remplacer } = valider(z.object({ remplacer: z.boolean().default(false) }), req.body ?? {});
      if (!e.classeId) throw invalide("Cet étudiant n'a pas de classe.");
      const c = await classeGeree(u, e.classeId);
      const [modele] = await db.select().from(fraisClasses).where(eq(fraisClasses.classeId, c.id));
      if (!modele?.echeancier.some((l) => l.montant > 0)) throw invalide("Les frais de sa classe ne sont pas encore saisis (page Scolarité, « Frais par classe »).");
      const existantes = await db
        .select({ id: echeancesEtudiants.id })
        .from(echeancesEtudiants)
        .where(and(eq(echeancesEtudiants.etudiantId, e.id), eq(echeancesEtudiants.anneeScolaire, c.anneeScolaire), eq(echeancesEtudiants.type, "frais")));
      if (existantes.length && !remplacer) throw new ErreurHttp(409, "Cet étudiant a déjà un échéancier pour cette année : confirmez pour le remplacer.");
      await db.transaction(async (tx) => {
        if (existantes.length) await tx.delete(echeancesEtudiants).where(inArray(echeancesEtudiants.id, existantes.map((x) => x.id)));
        await copierEcheancier(tx, e.id, c.anneeScolaire, modele.echeancier, u.id);
      });
      await journaliser(u, "echeancier_applique", { etudiantId: e.id, classeId: c.id, remplace: existantes.length > 0 });
      res.json(await scolariteDe(e, c.anneeScolaire));
    }),
  );

  app.post(
    `${P}/etudiants/:id(\\d+)/echeances`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const e = await etudiantGere(u, idParam(req));
      const d = valider(
        z.object({
          type: z.enum(["frais", "remise"]),
          libelle: texteCourt(80),
          montant: schemaMontant.refine((n) => n > 0, "le montant doit être positif"),
          dateLimite: schemaJour.nullable().optional(),
          anneeScolaire: schemaAnnee.optional(),
        }),
        req.body,
      );
      const annee = d.anneeScolaire ?? (await anneeDe(e));
      if (!annee) throw invalide("Précisez l'année scolaire (l'étudiant n'a pas de classe).");
      await db.insert(echeancesEtudiants).values({
        etudiantId: e.id,
        anneeScolaire: annee,
        type: d.type,
        libelle: espaces(d.libelle),
        montant: d.montant,
        dateLimite: d.type === "remise" ? null : (d.dateLimite ?? null),
        creeParId: u.id,
      });
      await journaliser(u, d.type === "remise" ? "remise_ajoutee" : "echeance_ajoutee", { etudiantId: e.id, montant: d.montant, libelle: d.libelle });
      res.status(201).json(await scolariteDe(e, await anneeDe(e)));
    }),
  );

  app.patch(
    `${P}/echeances/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const { x, e } = await echeanceGeree(u, idParam(req));
      const d = valider(
        z.object({
          libelle: texteCourt(80).optional(),
          montant: schemaMontant.refine((n) => n > 0, "le montant doit être positif").optional(),
          dateLimite: schemaJour.nullable().optional(),
        }),
        req.body,
      );
      const maj: Partial<typeof echeancesEtudiants.$inferInsert> = {};
      if (d.libelle !== undefined) maj.libelle = espaces(d.libelle);
      if (d.montant !== undefined) maj.montant = d.montant;
      if (d.dateLimite !== undefined && x.type === "frais") maj.dateLimite = d.dateLimite;
      if (Object.keys(maj).length) {
        await db.update(echeancesEtudiants).set(maj).where(eq(echeancesEtudiants.id, x.id));
        await journaliser(u, "echeance_modifiee", { etudiantId: e.id, echeanceId: x.id, avant: { montant: x.montant, date: x.dateLimite }, apres: maj });
      }
      res.json(await scolariteDe(e, await anneeDe(e)));
    }),
  );

  app.delete(
    `${P}/echeances/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const { x, e } = await echeanceGeree(u, idParam(req));
      await db.delete(echeancesEtudiants).where(eq(echeancesEtudiants.id, x.id));
      await journaliser(u, "echeance_retiree", { etudiantId: e.id, echeanceId: x.id, libelle: x.libelle, montant: x.montant, type: x.type });
      res.json(await scolariteDe(e, await anneeDe(e)));
    }),
  );

  // ── Versements ───────────────────────────────────────────────────────────

  app.post(
    `${P}/etudiants/:id(\\d+)/versements`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const e = await etudiantGere(u, idParam(req));
      const d = valider(
        z.object({
          montant: schemaMontant.refine((n) => n > 0, "le montant doit être positif"),
          moyen: z.enum(MOYENS_PAIEMENT),
          reference: optionnel(z.string().trim().max(80)),
          dateVersement: schemaJour.optional(),
          note: optionnel(z.string().trim().max(500)),
          anneeScolaire: schemaAnnee.optional(),
        }),
        req.body,
      );
      const jour = d.dateVersement ?? aujourdhui();
      if (jour > aujourdhui()) throw invalide("La date du versement ne peut pas être dans le futur.");
      const annee = d.anneeScolaire ?? (await scolariteDe(e, await anneeDe(e))).anneeScolaire ?? (await anneeDe(e));
      if (!annee) throw invalide("Précisez l'année scolaire (l'étudiant n'a pas de classe).");
      // Mobile Money : une même référence ne s'encaisse pas deux fois.
      if (d.reference) {
        const [doublon] = await db
          .select({ numero: versements.numero })
          .from(versements)
          .where(and(eq(versements.reference, d.reference), eq(versements.moyen, d.moyen), isNull(versements.annuleLe)))
          .limit(1);
        if (doublon) throw new ErreurHttp(409, `Cette référence ${LIBELLES_MOYENS_PAIEMENT[d.moyen]} est déjà enregistrée (reçu ${doublon.numero}).`);
      }
      const v = await db.transaction(async (tx) => {
        const numero = await prochainNumeroRecu(tx);
        const [cree] = await tx
          .insert(versements)
          .values({ numero, etudiantId: e.id, anneeScolaire: annee, montant: d.montant, moyen: d.moyen, reference: d.reference ?? null, dateVersement: jour, note: d.note ?? null, encaisseParId: u.id })
          .returning();
        return cree;
      });
      await journaliser(u, "versement_encaisse", { versementId: v.id, numero: v.numero, etudiantId: e.id, montant: v.montant, moyen: v.moyen });
      res.status(201).json({ versementId: v.id, numero: v.numero, scolarite: await scolariteDe(e, await anneeDe(e)) });
    }),
  );

  app.post(
    `${P}/versements/:id(\\d+)/annuler`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const { v, e } = await versementGere(u, idParam(req));
      const { motif } = valider(z.object({ motif: texteCourt(300) }), req.body);
      if (v.annuleLe) throw invalide("Ce versement est déjà annulé.");
      // La vie scolaire annule ses propres encaissements du jour ; au-delà, c'est la direction.
      if (u.role !== "admin" && (v.encaisseParId !== u.id || v.creeLe.toISOString().slice(0, 10) !== aujourdhui())) {
        throw interdit("Seule la direction peut annuler ce versement (encaissé par quelqu'un d'autre ou un autre jour).");
      }
      await db.update(versements).set({ annuleLe: new Date(), annuleParId: u.id, motifAnnulation: espaces(motif) }).where(eq(versements.id, v.id));
      await journaliser(u, "versement_annule", { versementId: v.id, numero: v.numero, etudiantId: e.id, montant: v.montant, motif });
      res.json(await scolariteDe(e, await anneeDe(e)));
    }),
  );

  app.get(
    `${P}/versements/:id(\\d+)/recu`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const { v } = await versementGere(u, idParam(req));
      res.setHeader("Cache-Control", "no-store");
      res.json(await recuDe(v.id));
    }),
  );

  // ── Tableau de la scolarité ──────────────────────────────────────────────

  app.get(
    `${P}/scolarite`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const f = valider(z.object({ site: z.coerce.number().int().positive().optional(), classe: z.coerce.number().int().positive().optional() }), req.query);
      const etudiants = await db
        .select({
          id: utilisateurs.id,
          prenom: utilisateurs.prenom,
          nom: utilisateurs.nom,
          matricule: utilisateurs.matricule,
          telephone: utilisateurs.telephone,
          actif: utilisateurs.actif,
          classe: classes.nom,
          annee: classes.anneeScolaire,
          site: sites.nomCourt,
          responsables: dossiersEtudiants.responsables,
          statut: dossiersEtudiants.statut,
        })
        .from(utilisateurs)
        .leftJoin(classes, eq(classes.id, utilisateurs.classeId))
        .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
        .leftJoin(dossiersEtudiants, eq(dossiersEtudiants.etudiantId, utilisateurs.id))
        .where(conditionsEtudiants(u, f));
      const situations = await situationsDe(etudiants.map((e) => ({ id: e.id, anneeClasse: e.annee })));
      const ids = etudiants.map((e) => e.id);
      const derniers = await derniersVersements(ids);

      let attendu = 0;
      let encaisse = 0;
      let reste = 0;
      let retard = 0;
      let sansEcheancier = 0;
      const retards: LigneRetard[] = [];
      for (const e of etudiants) {
        const s = situations.get(e.id);
        const suivi = e.actif && (!e.statut || e.statut === "inscrit" || e.statut === "suspendu");
        if (!s) {
          if (suivi) sansEcheancier++;
          continue;
        }
        attendu += s.du;
        encaisse += s.paye;
        reste += s.reste;
        retard += s.retard;
        if (s.retard > 0) {
          const resp = (e.responsables ?? []).find((r) => r.principal && r.telephone) ?? (e.responsables ?? []).find((r) => r.telephone);
          const numero = resp?.telephone ?? e.telephone;
          const texte = [
            `Bonjour, c'est la vie scolaire ${e.site ? `du campus ${e.site} ` : ""}(2IAE).`,
            `Sauf erreur de notre part, il reste ${fcfa(s.retard)} à régler pour la scolarité de ${e.prenom} ${e.nom}${e.classe ? ` (${e.classe})` : ""}, échéance dépassée.`,
            "Vous pouvez régler au guichet du campus ou par Mobile Money. Si c'est déjà fait, merci de nous envoyer le reçu ou la référence de la transaction.",
            "Bonne journée.",
          ].join("\n");
          retards.push({
            etudiant: { id: e.id, prenom: e.prenom, nom: e.nom, matricule: e.matricule },
            classe: e.classe,
            site: e.site,
            retard: s.retard,
            reste: s.reste,
            dernierVersement: derniers.get(e.id) ?? null,
            whatsapp: numeroWhatsApp(numero) ? lienWhatsApp(numero, texte) : null,
            contact: resp ? `${resp.nom}` : numero ? `${e.prenom} (étudiant)` : null,
          });
        }
      }
      retards.sort((a, b) => b.retard - a.retard);

      // Encaissements du jour et du mois, par moyen (versements non annulés des étudiants du tableau).
      const jour = aujourdhui();
      const mois = `${jour.slice(0, 7)}-01`;
      const du = ids.length
        ? await db
            .select({ moyen: versements.moyen, montant: sql<number>`sum(${versements.montant})::int`, nombre: sql<number>`count(*)::int`, jour: versements.dateVersement })
            .from(versements)
            .where(and(inArray(versements.etudiantId, ids), isNull(versements.annuleLe), gte(versements.dateVersement, mois), lte(versements.dateVersement, jour)))
            .groupBy(versements.moyen, versements.dateVersement)
        : [];
      const parMoyen = new Map<MoyenPaiement, { montant: number; nombre: number }>();
      let encaisseJour = 0;
      let encaisseMois = 0;
      for (const l of du) {
        encaisseMois += l.montant;
        if (l.jour === jour) encaisseJour += l.montant;
        const m = parMoyen.get(l.moyen) ?? { montant: 0, nombre: 0 };
        parMoyen.set(l.moyen, { montant: m.montant + l.montant, nombre: m.nombre + l.nombre });
      }

      const recents = ids.length
        ? await db.execute<Record<string, unknown>>(sql`
            SELECT v.*, e.prenom AS e_prenom, e.nom AS e_nom, e.matricule AS e_matricule, c.nom AS e_classe,
              NULLIF(trim(coalesce(x.prenom, '') || ' ' || coalesce(x.nom, '')), '') AS encaisse_par_nom,
              NULLIF(trim(coalesce(a.prenom, '') || ' ' || coalesce(a.nom, '')), '') AS annule_par_nom
            FROM campus.versements v
            JOIN campus.utilisateurs e ON e.id = v.etudiant_id
            LEFT JOIN campus.classes c ON c.id = e.classe_id
            LEFT JOIN campus.utilisateurs x ON x.id = v.encaisse_par_id
            LEFT JOIN campus.utilisateurs a ON a.id = v.annule_par_id
            WHERE v.etudiant_id = ANY(${`{${ids.join(",")}}`}::int[])
            ORDER BY v.cree_le DESC
            LIMIT 50`)
        : { rows: [] };

      const tableau: TableauScolarite = {
        indicateurs: {
          attendu,
          encaisse,
          reste,
          retard,
          etudiantsEnRetard: retards.length,
          encaisseJour,
          encaisseMois,
          etudiantsSansEcheancier: sansEcheancier,
        },
        parMoyen: [...parMoyen.entries()].map(([moyen, m]) => ({ moyen, ...m })).sort((a, b) => b.montant - a.montant),
        retards: retards.slice(0, 300),
        derniersVersements: recents.rows.map((l) => ({
          ...versVersementCrm({
            id: Number(l.id),
            numero: String(l.numero),
            etudiantId: Number(l.etudiant_id),
            anneeScolaire: String(l.annee_scolaire),
            montant: Number(l.montant),
            moyen: l.moyen as MoyenPaiement,
            reference: (l.reference as string | null) ?? null,
            dateVersement: jourDe(l.date_versement),
            note: (l.note as string | null) ?? null,
            encaisseParId: (l.encaisse_par_id as number | null) ?? null,
            creeLe: new Date(l.cree_le as string),
            annuleLe: l.annule_le ? new Date(l.annule_le as string) : null,
            annuleParId: (l.annule_par_id as number | null) ?? null,
            motifAnnulation: (l.motif_annulation as string | null) ?? null,
            encaissePar: (l.encaisse_par_nom as string | null) ?? null,
            annulePar: (l.annule_par_nom as string | null) ?? null,
          }),
          etudiant: { id: Number(l.etudiant_id), prenom: String(l.e_prenom), nom: String(l.e_nom), matricule: (l.e_matricule as string | null) ?? null },
          classe: (l.e_classe as string | null) ?? null,
        })),
      };
      res.json(tableau);
    }),
  );

  app.get(
    `${P}/versements/export`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const f = valider(
        z.object({
          du: schemaJour.optional(),
          au: schemaJour.optional(),
          site: z.coerce.number().int().positive().optional(),
          classe: z.coerce.number().int().positive().optional(),
        }),
        req.query,
      );
      const jour = aujourdhui();
      const du = f.du ?? `${jour.slice(0, 7)}-01`;
      const au = f.au ?? jour;
      const lignes = await db
        .select({
          numero: versements.numero,
          date: versements.dateVersement,
          montant: versements.montant,
          moyen: versements.moyen,
          reference: versements.reference,
          annee: versements.anneeScolaire,
          annuleLe: versements.annuleLe,
          motif: versements.motifAnnulation,
          matricule: utilisateurs.matricule,
          prenom: utilisateurs.prenom,
          nom: utilisateurs.nom,
          classe: classes.nom,
          site: sites.nomCourt,
          encaisseParId: versements.encaisseParId,
        })
        .from(versements)
        .innerJoin(utilisateurs, eq(utilisateurs.id, versements.etudiantId))
        .leftJoin(classes, eq(classes.id, utilisateurs.classeId))
        .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
        .where(and(conditionsEtudiants(u, f), gte(versements.dateVersement, du), lte(versements.dateVersement, au)))
        .orderBy(asc(versements.dateVersement), asc(versements.numero));
      const auteurs = new Map<number, string>();
      const idsAuteurs = [...new Set(lignes.map((l) => l.encaisseParId).filter((x): x is number => x !== null))];
      if (idsAuteurs.length) {
        for (const a of await db.select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(inArray(utilisateurs.id, idsAuteurs))) {
          auteurs.set(a.id, `${a.prenom} ${a.nom}`);
        }
      }
      const entetes = ["Reçu", "Date", "Matricule", "Nom", "Prénoms", "Classe", "Campus", "Année scolaire", "Montant (F CFA)", "Moyen", "Référence", "Encaissé par", "Annulé", "Motif d'annulation"];
      const corps = lignes.map((l) =>
        [
          l.numero,
          l.date,
          l.matricule,
          l.nom,
          l.prenom,
          l.classe,
          l.site,
          l.annee,
          l.montant,
          LIBELLES_MOYENS_PAIEMENT[l.moyen],
          l.reference,
          l.encaisseParId ? auteurs.get(l.encaisseParId) : "",
          l.annuleLe ? l.annuleLe.toISOString().slice(0, 10) : "",
          l.motif,
        ]
          .map(cellule)
          .join(";"),
      );
      await journaliser(u, "export_versements", { du, au, nombre: lignes.length });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="versements-2iae-${du}-au-${au}.csv"`);
      res.setHeader("Cache-Control", "no-store");
      res.send(`﻿${[entetes.join(";"), ...corps].join("\r\n")}`);
    }),
  );

  // ── Mon dossier (l'étudiant) ─────────────────────────────────────────────

  app.get(
    "/api/mon-dossier",
    ETUDIANT,
    route(async (req, res) => {
      const u = moi(req);
      const [info] = await db
        .select({ classe: classes.nom, annee: classes.anneeScolaire, site: sites.nomCourt, whatsapp: sites.whatsappVieScolaire })
        .from(utilisateurs)
        .leftJoin(classes, eq(classes.id, utilisateurs.classeId))
        .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
        .where(eq(utilisateurs.id, u.id));
      const [d] = await db.select().from(dossiersEtudiants).where(eq(dossiersEtudiants.etudiantId, u.id));
      const numero = info?.whatsapp?.replace(/\D/g, "") || null;
      const dossier: MonDossier = {
        identite: {
          prenom: u.prenom,
          nom: u.nom,
          matricule: u.matricule,
          classe: info?.classe ?? null,
          site: info?.site ?? null,
          statut: d?.statut ?? "inscrit",
          dateInscription: d?.dateInscription ?? null,
        },
        pieces: await piecesDe(u.id, true),
        scolarite: await scolariteDe(u, info?.annee ?? null, false),
        whatsappVieScolaire: numero
          ? `https://wa.me/${numero}?text=${encodeURIComponent(`Bonjour, je suis ${u.prenom} ${u.nom}${u.matricule ? ` (matricule ${u.matricule})` : ""}. J'ai une question sur mon dossier ou ma scolarité.`)}`
          : null,
      };
      res.setHeader("Cache-Control", "no-store");
      res.json(dossier);
    }),
  );

  app.post(
    "/api/mon-dossier/pieces",
    ETUDIANT,
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(
        z.object({ type: z.enum(TYPES_PIECES), libelle: optionnel(z.string().trim().max(120)), fichierId: z.number().int().positive() }),
        req.body,
      );
      if (d.type === "autre" && !d.libelle) throw invalide("Donne un nom à cette pièce.");
      await fichierDePiece(d.fichierId, [u.id]);
      const [existante] =
        d.type !== "autre"
          ? await db
              .select()
              .from(piecesDossier)
              .where(and(eq(piecesDossier.etudiantId, u.id), eq(piecesDossier.type, d.type)))
              .orderBy(desc(piecesDossier.id))
              .limit(1)
          : [];
      if (existante?.statut === "recue") throw invalide("Cette pièce est déjà validée par la vie scolaire.");
      const valeurs = { fichierId: d.fichierId, statut: "a_verifier" as const, note: null, verifieeParId: null, verifieeLe: null };
      if (existante) await db.update(piecesDossier).set({ ...valeurs, ajouteeParId: u.id }).where(eq(piecesDossier.id, existante.id));
      else await db.insert(piecesDossier).values({ etudiantId: u.id, type: d.type, libelle: d.type === "autre" ? d.libelle : null, ajouteeParId: u.id, ...valeurs });
      res.status(201).json(await piecesDe(u.id, true));
    }),
  );

  app.get(
    "/api/mon-dossier/versements/:id(\\d+)/recu",
    ETUDIANT,
    route(async (req, res) => {
      const u = moi(req);
      const [v] = await db.select({ id: versements.id, etudiantId: versements.etudiantId }).from(versements).where(eq(versements.id, idParam(req)));
      if (!v || v.etudiantId !== u.id) throw introuvable("Reçu");
      const recu = await recuDe(v.id);
      res.setHeader("Cache-Control", "no-store");
      res.json({ ...recu, encaissePar: null });
    }),
  );
}

