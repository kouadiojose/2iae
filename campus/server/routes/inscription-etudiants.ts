// Inscription des étudiants par un lien partagé (/inscription/<jeton>) :
//  - la direction ou la vie scolaire crée le lien (pour tous les campus, ou
//    réservé à un campus), valable 60 jours par défaut, et le partage dans les
//    groupes WhatsApp des classes ;
//  - l'étudiant y crée son compte lui-même : nom, campus, classe, téléphone,
//    e-mail (tous deux obligatoires) et code secret. Son matricule est tiré tout seul, son
//    dossier CRM est ouvert (origine « lien »), sa session s'ouvre et il suit
//    le parcours de bienvenue (charte, notifications des cours en direct) ;
//  - le guide de l'étudiant part à son adresse e-mail, et la vie scolaire de
//    son campus est prévenue : elle vérifie le dossier et désactive un compte
//    qui ne serait pas celui d'un étudiant.
// Un lien qui circule trop loin se remplace d'un clic (l'ancien ne marche plus).
import { randomBytes } from "crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { and, asc, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db, pool } from "../db";
import { config } from "../config";
import { exigerRole, exigerDroit, equipeAvecDroit, moi, hacher, codeSecretAcceptable, longueurMinimale, perimetreSites, verifierTentatives, noterEchec, versMoi, oublierUtilisateur, dureeSession } from "../auth";
import { route, valider, idParam, ErreurHttp, introuvable, interdit, invalide } from "../http";
import { notifier } from "../notifications";
import { emailDisponible, nomAffiche } from "../mail";
import { envoyerGuideBienvenue } from "../guide-bienvenue";
import { adresseDeDemonstration } from "../demo-constantes";
import { sansAccents, telephoneSaisi, verifierUnicite, espaces } from "./admin";
import { matriculePropose } from "./crm";
import { estTroncCommun } from "../classes-filieres";
import {
  utilisateurs,
  sites,
  classes,
  journal,
  liensInscription,
  dossiersEtudiants,
  coursClasses,
  seances,
  cours,
  type Utilisateur,
  type InfoInscriptionEtudiantDto,
  type InscriptionEtudiantFaite,
  type InscriptionEtudiantsDto,
  type LienEtudiantsDto,
} from "@shared/schema";

// Liens d'inscription des étudiants : profils qui créent les comptes des étudiants (ext-profils.ts).
const EQUIPE = exigerDroit("comptes_gerer");
const P = "/api/pilotage/inscription-etudiants";
const JOUR_MS = 24 * 60 * 60 * 1000;

const urlLien = (jeton: string) => `${config.urlCampus}/inscription/${jeton}`;
const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" });

async function journaliser(u: Pick<Utilisateur, "id"> | null, action: string, details: Record<string, unknown> = {}) {
  await db.insert(journal).values({ utilisateurId: u?.id ?? null, action, details });
}

/** Adresse de la personne pour la limite d'essais (IPv4, ou réseau /64 en IPv6). */
function reseau(req: Request): string {
  const a = (req.ip ?? "").replace(/^::ffff:(?=\d+\.)/i, "").split("%")[0];
  return a.includes(":") ? a.split(":").slice(0, 4).join(":") : a;
}

/** Lien des étudiants encore utilisable (ni révoqué, ni expiré). */
async function lienValable(jeton: string) {
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(jeton)) return null;
  const [l] = await db
    .select()
    .from(liensInscription)
    .where(and(eq(liensInscription.jeton, jeton), eq(liensInscription.type, "etudiants"), isNull(liensInscription.revoqueLe), gt(liensInscription.expireLe, new Date())));
  return l ?? null;
}

const lienMort = () =>
  new ErreurHttp(410, "Ce lien d'inscription ne marche plus : il a expiré ou il a été remplacé. Demande le nouveau lien à la vie scolaire de ton campus.");

/** Classes de l'année scolaire en cours (la plus récente), éventuellement d'un seul campus. */
async function classesOuvertes(siteId: number | null) {
  const [derniere] = await db.select({ annee: sql<string>`max(${classes.anneeScolaire})` }).from(classes);
  if (!derniere?.annee) return [];
  return db
    .select({ id: classes.id, nom: classes.nom, siteId: classes.siteId, filiere: classes.filiere, niveau: classes.niveau, anneeScolaire: classes.anneeScolaire })
    .from(classes)
    .where(and(eq(classes.anneeScolaire, derniere.annee), siteId ? eq(classes.siteId, siteId) : undefined))
    .orderBy(asc(classes.nom));
}

function messageLien(url: string, expireLe: Date, site: string | null): string {
  return [
    `Étudiants du Groupe Écoles 2IAE International${site ? `, campus ${site}` : ""} :`,
    "",
    "Crée ton compte sur le campus numérique, en 2 minutes, avec ce lien :",
    url,
    "",
    "Prépare ton numéro de téléphone et ton adresse e-mail. Tu choisis ton campus et ta classe, puis ton code secret. Ton compte est prêt tout de suite : tu suis les cours en direct sur ton téléphone, tu reçois une alerte quand un cours commence, tu rends tes devoirs en photo et tu revois les replays.",
    `Lien valable jusqu'au ${fmtDate.format(expireLe)}.`,
  ].join("\n");
}

async function etat(u: Utilisateur): Promise<InscriptionEtudiantsDto> {
  const perimetre = perimetreSites(u);
  const [liens, listeSites] = await Promise.all([
    db
      .select()
      .from(liensInscription)
      .where(and(eq(liensInscription.type, "etudiants"), isNull(liensInscription.revoqueLe), gt(liensInscription.expireLe, new Date())))
      .orderBy(desc(liensInscription.creeLe)),
    db.select({ id: sites.id, nomCourt: sites.nomCourt }).from(sites).orderBy(asc(sites.ordre)),
  ]);
  const visibles = liens.filter((l) => !perimetre || (l.siteId !== null && perimetre.includes(l.siteId)));
  const nomsSites = new Map(listeSites.map((s) => [s.id, s.nomCourt]));
  const comptes = visibles.length
    ? await pool.query<{ lien: string; n: number }>(
        `SELECT details->>'lienId' AS lien, count(*)::int AS n FROM campus.journal WHERE action = 'etudiant_inscrit_lien' AND details->>'lienId' = ANY($1::text[]) GROUP BY 1`,
        [visibles.map((l) => String(l.id))],
      )
    : { rows: [] };
  const parLien = new Map(comptes.rows.map((r) => [Number(r.lien), r.n]));
  return {
    liens: visibles.map((l): LienEtudiantsDto => {
      const site = l.siteId ? (nomsSites.get(l.siteId) ?? null) : null;
      return {
        id: l.id,
        url: urlLien(l.jeton),
        libelle: l.libelle,
        siteId: l.siteId,
        site,
        creeLe: l.creeLe.toISOString(),
        expireLe: l.expireLe.toISOString(),
        inscrits: parLien.get(l.id) ?? 0,
        message: messageLien(urlLien(l.jeton), l.expireLe, site),
      };
    }),
    sites: listeSites.filter((s) => !perimetre || perimetre.includes(s.id)),
  };
}

/** Prochain cours de la classe, pour l'e-mail de bienvenue. */
async function prochainCoursClasse(classeId: number): Promise<string | null> {
  const [s] = await db
    .select({ titre: cours.titre, debut: seances.debut })
    .from(seances)
    .innerJoin(cours, eq(cours.id, seances.coursId))
    .innerJoin(coursClasses, and(eq(coursClasses.coursId, seances.coursId), eq(coursClasses.classeId, classeId)))
    .where(and(eq(seances.statut, "planifiee"), gt(seances.debut, new Date())))
    .orderBy(asc(seances.debut))
    .limit(1);
  if (!s) return null;
  const quand = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })
    .format(s.debut)
    .replace(":", "h");
  return `${s.titre}, ${quand} (heure d'Abidjan)`;
}

/**
 * Classes proposées à l'inscription : celles de l'année, sauf le « Tronc commun » d'un campus qui a ses classes
 * de filières BTS (l'étudiant choisit alors sa vraie filière ; les cours du tronc commun y sont rattachés).
 */
async function classesInscription(siteId: number | null) {
  const liste = await classesOuvertes(siteId);
  const avecFilieresBts = new Set(liste.filter((c) => !estTroncCommun(c) && /BTS/i.test(c.niveau)).map((c) => c.siteId));
  return liste.filter((c) => !(estTroncCommun(c) && avecFilieresBts.has(c.siteId)));
}

/** Nom comparé sans accents, casse ni espaces en trop (« Kouassi  Aya » = « KOUASSI Aya »). */
const nomCompare = (s: string) => sansAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();


/** Plafond global des inscriptions libres (toutes adresses confondues), par fenêtre de 15 minutes. */
const CLE_INSCRIPTIONS_LIBRES = "inscription-libre|tout";

/** Ce que le formulaire d'inscription doit proposer : campus et classes ouvertes (d'un campus, avec un lien réservé). */
async function infoInscription(l: { siteId: number | null; expireLe: Date } | null): Promise<InfoInscriptionEtudiantDto> {
  const siteId = l?.siteId ?? null;
  const [listeSites, liste] = await Promise.all([
    db.select({ id: sites.id, nomCourt: sites.nomCourt }).from(sites).orderBy(asc(sites.ordre)),
    classesInscription(siteId),
  ]);
  return {
    expireLe: l?.expireLe.toISOString() ?? null,
    sites: listeSites.filter((s) => (siteId ? s.id === siteId : liste.some((c) => c.siteId === s.id))),
    classes: liste.map((c) => ({ id: c.id, nom: c.nom, siteId: c.siteId, filiere: c.filiere, niveau: c.niveau })),
    siteId,
    longueurMinimale: longueurMinimale("etudiant"),
    emailDisponible: emailDisponible(),
  };
}

/**
 * Crée le compte de l'étudiant (par un lien, ou librement depuis « Créer mon
 * compte »), ouvre sa session tout de suite, envoie le guide et prévient la
 * scolarité de son campus.
 */
async function creerCompte(req: Request, res: Response, l: { id: number; siteId: number | null } | null, cle: string) {
      const d = valider(
        z.object({
          prenom: z.string({ required_error: "indique ton prénom" }).trim().min(1, "indique ton prénom").max(80, "trop long"),
          nom: z.string({ required_error: "indique ton nom" }).trim().min(1, "indique ton nom").max(80, "trop long"),
          classeId: z.number({ required_error: "choisis ta classe", invalid_type_error: "choisis ta classe" }).int().positive("choisis ta classe"),
          telephone: z.string({ required_error: "indique ton numéro de téléphone" }).trim().min(1, "indique ton numéro de téléphone").max(30, "trop long"),
          email: z.string({ required_error: "indique ton adresse e-mail" }).trim().toLowerCase().min(1, "indique ton adresse e-mail").email("adresse e-mail non valide (exemple : prenom.nom@gmail.com)").max(160, "trop long"),
          motDePasse: z.string({ required_error: "choisis ton code secret" }).min(1, "choisis ton code secret").max(200),
        }),
        req.body,
      );
      noterEchec(cle); // chaque inscription compte dans la limite du réseau
      const [classe] = await db.select().from(classes).where(eq(classes.id, d.classeId));
      const ouvertes = await classesInscription(l?.siteId ?? null);
      if (!classe || !ouvertes.some((c) => c.id === classe.id)) throw invalide("Choisis ta classe dans la liste.");
      if (adresseDeDemonstration(d.email)) throw invalide("Cette adresse est réservée à la démonstration du campus : tape ta vraie adresse e-mail.");
      const telephone = telephoneSaisi(d.telephone);
      const minimum = longueurMinimale("etudiant");
      if (d.motDePasse.length < minimum) throw invalide(`Ton code secret doit faire au moins ${minimum} caractères.`);
      if (!codeSecretAcceptable(d.motDePasse)) throw invalide("Ce code est trop facile à deviner (123456, 000000…). Choisis-en un autre.");
      await verifierUnicite({ email: d.email });

      // Déjà un compte à ce nom dans cette classe (créé par la vie scolaire, ou inscrit deux fois) : pas de doublon.
      const prenom = espaces(d.prenom);
      const nom = espaces(d.nom);
      const memesClasse = await db
        .select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom })
        .from(utilisateurs)
        .where(and(eq(utilisateurs.role, "etudiant"), eq(utilisateurs.classeId, classe.id)));
      const cible = nomCompare(`${prenom} ${nom}`);
      const cibleInverse = nomCompare(`${nom} ${prenom}`);
      if (memesClasse.some((x) => [cible, cibleInverse].includes(nomCompare(`${x.prenom} ${x.nom}`)))) {
        throw new ErreurHttp(
          409,
          "Un compte existe déjà à ton nom dans cette classe. Connecte-toi avec ton matricule (ou ton téléphone) et ton code secret, ou demande ta fiche de connexion à la vie scolaire de ton campus.",
        );
      }

      const hash = await hacher(d.motDePasse);
      let cree: Utilisateur | null = null;
      // Matricule tiré tout seul : deux inscriptions à la même seconde peuvent viser le même numéro, on réessaie.
      for (let essai = 0; essai < 4 && !cree; essai++) {
        const matricule = await matriculePropose(classe);
        try {
          cree = await db.transaction(async (tx) => {
            const [c] = await tx
              .insert(utilisateurs)
              .values({
                role: "etudiant",
                prenom,
                nom,
                matricule,
                email: d.email,
                telephone,
                motDePasseHash: hash,
                doitChangerMotDePasse: false,
                siteId: classe.siteId,
                classeId: classe.id,
              })
              .returning();
            await tx.insert(dossiersEtudiants).values({
              etudiantId: c.id,
              statut: "inscrit",
              statutLe: new Date(),
              dateInscription: new Date().toISOString().slice(0, 10),
              origine: "lien",
              whatsapp: telephone,
            });
            return c;
          });
        } catch (e) {
          const code = (e as { code?: string; constraint?: string }).code;
          if (code !== "23505") throw e;
          if (d.email && (e as { constraint?: string }).constraint?.includes("email")) throw new ErreurHttp(409, "Cette adresse e-mail est déjà utilisée par un autre compte.");
        }
      }
      if (!cree) throw new ErreurHttp(409, "Le campus est très sollicité : réessaie dans un instant.");

      await new Promise<void>((ok, ko) => req.session.regenerate((e) => (e ? ko(e) : ok())));
      req.session.utilisateurId = cree.id;
      req.session.cookie.maxAge = dureeSession("etudiant");
      await db.update(utilisateurs).set({ derniereConnexion: new Date() }).where(eq(utilisateurs.id, cree.id));
      oublierUtilisateur(cree.id);
      await journaliser(cree, l ? "etudiant_inscrit_lien" : "etudiant_inscrit_libre", { lienId: l ? String(l.id) : null, classeId: classe.id, siteId: classe.siteId });

      const envoye = cree.email ? await envoyerGuideBienvenue({ ...cree, classeNom: classe.nom }, await prochainCoursClasse(classe.id).catch(() => null)) : false;
      if (cree.email) await journaliser(cree, "guide_bienvenue", { envoye });

      // La scolarité du campus (profils qui gèrent les comptes) et la direction voient arriver l'inscription :
      // elles vérifient le dossier (paiement…) et mettent en pause ou retirent de la classe si besoin.
      void (async () => {
        const equipe = await db
          .select({ id: utilisateurs.id })
          .from(utilisateurs)
          .where(
            and(
              eq(utilisateurs.actif, true),
              or(eq(utilisateurs.role, "admin"), and(equipeAvecDroit("comptes_gerer"), or(isNull(utilisateurs.siteId), eq(utilisateurs.siteId, classe.siteId)))),
            ),
          );
        await notifier(
          equipe.map((x) => x.id),
          {
            type: "systeme",
            titre: `Nouvel étudiant inscrit : ${nomAffiche(cree!)}`,
            corps: `${classe.nom} · matricule ${cree!.matricule} · ${cree!.telephone ?? "sans téléphone"} · inscrit lui-même${l ? " par le lien" : " (Créer mon compte)"}, accès immédiat. Vérifiez son dossier.`,
            lien: `/pilotage/etudiants/${cree!.id}`,
            push: false,
          },
        );
      })().catch((e) => console.error("[inscription] notification :", (e as Error).message));

      const r: InscriptionEtudiantFaite = {
        moi: await versMoi({ ...cree, derniereConnexion: new Date() }),
        matricule: cree.matricule ?? "",
        classe: classe.nom,
        guide: { adresse: cree.email, envoye },
      };
      res.status(201).json(r);
}

export function enregistrerInscriptionEtudiants(app: Express) {
  // ── Direction et vie scolaire : les liens ─────────────────────────────────
  app.get(
    P,
    EQUIPE,
    route(async (req, res) => {
      res.json(await etat(moi(req)));
    }),
  );

  app.post(
    `${P}/liens`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(
        z.object({ joursValidite: z.number().int().min(1).max(180).default(60), siteId: z.number().int().positive().nullable().default(null) }),
        req.body ?? {},
      );
      const perimetre = perimetreSites(u);
      // La vie scolaire d'un campus ne crée que le lien de son campus.
      const siteId = perimetre ? (d.siteId && perimetre.includes(d.siteId) ? d.siteId : perimetre.length === 1 ? perimetre[0] : null) : d.siteId;
      if (perimetre && !siteId) throw interdit("Choisissez le campus du lien.");
      let libelle = "Étudiants · tous les campus";
      if (siteId) {
        const [s] = await db.select({ nomCourt: sites.nomCourt }).from(sites).where(eq(sites.id, siteId));
        if (!s) throw introuvable("Campus");
        libelle = `Étudiants · ${s.nomCourt}`;
      }
      // Un seul lien valable par campus (ou pour tous) : le précédent ne marche plus.
      await db
        .update(liensInscription)
        .set({ revoqueLe: new Date() })
        .where(
          and(
            eq(liensInscription.type, "etudiants"),
            isNull(liensInscription.revoqueLe),
            siteId ? eq(liensInscription.siteId, siteId) : isNull(liensInscription.siteId),
          ),
        );
      const [l] = await db
        .insert(liensInscription)
        // En hexadécimal : ni « _ » ni « - », que WhatsApp mettrait en forme ou couperait dans les groupes de classe.
        .values({ jeton: randomBytes(18).toString("hex"), type: "etudiants", siteId, libelle, creeParId: u.id, expireLe: new Date(Date.now() + d.joursValidite * JOUR_MS) })
        .returning();
      await journaliser(u, "lien_etudiants_cree", { lienId: l.id, siteId, jours: d.joursValidite });
      res.status(201).json(await etat(u));
    }),
  );

  app.delete(
    `${P}/liens/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const perimetre = perimetreSites(u);
      const [l] = await db
        .select()
        .from(liensInscription)
        .where(and(eq(liensInscription.id, idParam(req)), eq(liensInscription.type, "etudiants")));
      if (!l || (perimetre && (l.siteId === null || !perimetre.includes(l.siteId)))) throw introuvable("Lien");
      await db.update(liensInscription).set({ revoqueLe: new Date() }).where(eq(liensInscription.id, l.id));
      await journaliser(u, "lien_etudiants_revoque", { lienId: l.id });
      res.json(await etat(u));
    }),
  );

  // ── Public : l'étudiant ouvre le lien et crée son compte ──────────────────
  app.get(
    "/api/inscription/:jeton",
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const cle = `inscription-lien|${reseau(req)}`;
      verifierTentatives(cle, 30);
      const l = await lienValable(String(req.params.jeton ?? ""));
      if (!l) {
        noterEchec(cle);
        throw lienMort();
      }
      res.json(await infoInscription(l));
    }),
  );

  // ── Public, sans lien : « Créer mon compte » depuis la page de connexion ──
  // Décision de la direction (octobre 2026) : tout étudiant crée son compte et
  // entre aussitôt sur le campus ; la scolarité reçoit une alerte, vérifie le
  // dossier, et met en pause ou retire de la classe un compte qui ne va pas.
  app.get(
    "/api/inscription",
    route(async (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await infoInscription(null));
    }),
  );

  app.post(
    "/api/inscription",
    route(async (req: Request, res) => {
      res.setHeader("Cache-Control", "no-store");
      // Toute une classe peut s'inscrire depuis le Wi-Fi du campus : limite large par réseau, et plafond global.
      const cle = `inscription-libre|${reseau(req)}`;
      verifierTentatives(cle, 150);
      verifierTentatives(CLE_INSCRIPTIONS_LIBRES, 600);
      await creerCompte(req, res, null, cle);
      noterEchec(CLE_INSCRIPTIONS_LIBRES);
    }),
  );

  app.post(
    "/api/inscription/:jeton",
    route(async (req: Request, res) => {
      res.setHeader("Cache-Control", "no-store");
      // Toute une classe peut s'inscrire depuis le Wi-Fi du campus (même adresse) : limite large, mais limite.
      const cle = `inscription-etudiant|${reseau(req)}`;
      verifierTentatives(cle, 60);
      const l = await lienValable(String(req.params.jeton ?? ""));
      if (!l) {
        noterEchec(cle);
        throw lienMort();
      }
      await creerCompte(req, res, l, cle);
    }),
  );
}

