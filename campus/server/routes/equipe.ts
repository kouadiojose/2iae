// Inscription de l'équipe administrative par un lien partagé :
//  - la direction crée un lien (/rejoindre/<jeton>), valable 30 jours par défaut ;
//  - la personne remplit sa demande (nom, e-mail professionnel ou personnel,
//    fonction, campus, mot de passe) ; rien n'est ouvert à ce stade ;
//  - la direction est prévenue et valide la demande en choisissant l'accès :
//    vie scolaire d'un campus, vie scolaire de tous les campus, ou direction ;
//  - la personne reçoit un e-mail et se connecte avec son e-mail et le mot de
//    passe qu'elle a choisi.
// Un lien qui circule trop loin ne donne donc accès à rien sans la direction.
import type { Express, Request } from "express";
import { z } from "zod";
import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { config } from "../config";
import { exigerRole, moi, hacher, jetonAleatoire, codeSecretAcceptable, longueurMinimale, normaliserTelephone, verifierTentatives, noterEchec } from "../auth";
import { route, valider, idParam, ErreurHttp, introuvable, invalide } from "../http";
import { notifier } from "../notifications";
import { emailDisponible, envoyerEmail, gabaritEmail, nomAffiche } from "../mail";
import { adresseDeDemonstration } from "../demo-constantes";
import {
  utilisateurs,
  sites,
  journal,
  liensInscription,
  demandesAcces,
  type Utilisateur,
  type DemandeAccesDto,
  type EquipeInscriptionDto,
  type InfoLienInscriptionDto,
  type LienInscriptionDto,
} from "@shared/schema";

const DIRECTION = exigerRole("admin");
const P = "/api/pilotage/equipe";
const JOUR_MS = 24 * 60 * 60 * 1000;

const urlLien = (jeton: string) => `${config.urlCampus}/rejoindre/${jeton}`;
const espaces = (s: string) => s.replace(/\s+/g, " ").trim();

async function journaliser(u: Pick<Utilisateur, "id"> | null, action: string, details: Record<string, unknown> = {}) {
  await db.insert(journal).values({ utilisateurId: u?.id ?? null, action, details });
}

/** Adresse de la personne pour la limite d'essais (IPv4, ou réseau /64 en IPv6). */
function reseau(req: Request): string {
  const a = (req.ip ?? "").replace(/^::ffff:(?=\d+\.)/i, "").split("%")[0];
  return a.includes(":") ? a.split(":").slice(0, 4).join(":") : a;
}

/** Lien encore utilisable (ni révoqué, ni expiré). */
async function lienValable(jeton: string) {
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(jeton)) return null;
  const [l] = await db
    .select()
    .from(liensInscription)
    .where(and(eq(liensInscription.jeton, jeton), isNull(liensInscription.revoqueLe), gt(liensInscription.expireLe, new Date())));
  return l ?? null;
}

async function etat(): Promise<EquipeInscriptionDto> {
  const [liens, demandes, listeSites] = await Promise.all([
    db
      .select()
      .from(liensInscription)
      .where(and(isNull(liensInscription.revoqueLe), gt(liensInscription.expireLe, new Date())))
      .orderBy(desc(liensInscription.creeLe)),
    db
      .select()
      .from(demandesAcces)
      .orderBy(sql`case ${demandesAcces.statut} when 'en_attente' then 0 else 1 end`, desc(demandesAcces.creeLe))
      .limit(60),
    db.select({ id: sites.id, nomCourt: sites.nomCourt }).from(sites),
  ]);
  const nomsSites = new Map(listeSites.map((s) => [s.id, s.nomCourt]));
  const idsPersonnes = [...new Set(demandes.flatMap((d) => [d.traiteParId, d.compteId]).filter((x): x is number => x !== null))];
  const personnes = idsPersonnes.length
    ? await db.select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, role: utilisateurs.role }).from(utilisateurs).where(inArray(utilisateurs.id, idsPersonnes))
    : [];
  const parId = new Map(personnes.map((p) => [p.id, p]));
  const parLien = new Map<number, number>();
  for (const d of demandes) if (d.lienId) parLien.set(d.lienId, (parLien.get(d.lienId) ?? 0) + 1);
  return {
    liens: liens.map(
      (l): LienInscriptionDto => ({ id: l.id, url: urlLien(l.jeton), libelle: l.libelle, creeLe: l.creeLe.toISOString(), expireLe: l.expireLe.toISOString(), demandes: parLien.get(l.id) ?? 0 }),
    ),
    demandes: demandes.map((d): DemandeAccesDto => {
      const par = d.traiteParId ? parId.get(d.traiteParId) : undefined;
      return {
        id: d.id,
        prenom: d.prenom,
        nom: d.nom,
        email: d.email,
        telephone: d.telephone,
        fonction: d.fonction,
        siteId: d.siteId,
        site: d.siteId ? (nomsSites.get(d.siteId) ?? null) : null,
        statut: d.statut,
        creeLe: d.creeLe.toISOString(),
        traiteLe: d.traiteLe?.toISOString() ?? null,
        traitePar: par ? nomAffiche(par) : null,
        role: d.compteId ? (parId.get(d.compteId)?.role ?? null) : null,
        motif: d.motif,
      };
    }),
  };
}

function emailAccesValide(o: { prenom: string; nom: string; email: string; acces: string }) {
  const lien = `${config.urlCampus}/connexion`;
  const { html, texte } = gabaritEmail({
    etiquette: "Accès validé · Campus numérique",
    titre: `Bonjour ${nomAffiche(o)},`,
    paragraphes: [
      `La direction du Groupe Écoles 2IAE International a validé votre accès au campus numérique : **${o.acces}**.`,
      "Connectez-vous avec votre adresse e-mail et le mot de passe que vous avez choisi en faisant votre demande. Vous y suivrez les cours en direct, les présences et les statistiques des campus.",
    ],
    bouton: { libelle: "Me connecter", lien },
    encadre: [{ libelle: "Identifiant", valeur: o.email, mono: true }],
    apresBouton: ["Mot de passe oublié ? Sur la page de connexion, touchez « Code ou mot de passe oublié »."],
  });
  return { sujet: "Votre accès au campus numérique 2IAE est prêt", html, texte };
}

export function enregistrerEquipe(app: Express) {
  // ── Direction : liens et demandes ─────────────────────────────────────────
  app.get(
    P,
    DIRECTION,
    route(async (_req, res) => {
      res.json(await etat());
    }),
  );

  app.post(
    `${P}/liens`,
    DIRECTION,
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(
        z.object({ joursValidite: z.number().int().min(1).max(180).default(30), libelle: z.string().trim().max(80).optional() }),
        req.body,
      );
      const [l] = await db
        .insert(liensInscription)
        .values({ jeton: jetonAleatoire(18), libelle: d.libelle || "Équipe administrative", creeParId: u.id, expireLe: new Date(Date.now() + d.joursValidite * JOUR_MS) })
        .returning();
      await journaliser(u, "lien_equipe_cree", { lienId: l.id, jours: d.joursValidite });
      res.status(201).json(await etat());
    }),
  );

  app.delete(
    `${P}/liens/:id(\\d+)`,
    DIRECTION,
    route(async (req, res) => {
      const u = moi(req);
      const [l] = await db.update(liensInscription).set({ revoqueLe: new Date() }).where(eq(liensInscription.id, idParam(req))).returning();
      if (!l) throw introuvable("Lien");
      await journaliser(u, "lien_equipe_revoque", { lienId: l.id });
      res.json(await etat());
    }),
  );

  app.post(
    `${P}/demandes/:id(\\d+)/accepter`,
    DIRECTION,
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(
        z.object({ role: z.enum(["vie_scolaire", "admin"]), siteId: z.number().int().positive().nullable().default(null) }),
        req.body,
      );
      const [demande] = await db.select().from(demandesAcces).where(eq(demandesAcces.id, idParam(req)));
      if (!demande) throw introuvable("Demande");
      if (demande.statut !== "en_attente") throw new ErreurHttp(409, "Cette demande est déjà traitée.");
      let siteNom: string | null = null;
      if (d.role === "vie_scolaire" && d.siteId) {
        const [s] = await db.select().from(sites).where(eq(sites.id, d.siteId));
        if (!s) throw introuvable("Campus");
        siteNom = s.nomCourt;
      }
      const [pris] = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(eq(utilisateurs.email, demande.email));
      if (pris) throw new ErreurHttp(409, "Un compte utilise déjà cette adresse e-mail : cette personne peut se connecter avec lui (ou demander un nouveau code).");
      const compte = await db.transaction(async (tx) => {
        const [c] = await tx
          .insert(utilisateurs)
          .values({
            role: d.role,
            prenom: demande.prenom,
            nom: demande.nom,
            email: demande.email,
            telephone: demande.telephone,
            motDePasseHash: demande.motDePasseHash,
            doitChangerMotDePasse: false,
            siteId: d.role === "vie_scolaire" ? d.siteId : null,
          })
          .returning();
        const [maj] = await tx
          .update(demandesAcces)
          .set({ statut: "acceptee", traiteLe: new Date(), traiteParId: u.id, compteId: c.id })
          .where(and(eq(demandesAcces.id, demande.id), eq(demandesAcces.statut, "en_attente")))
          .returning();
        if (!maj) throw new ErreurHttp(409, "Cette demande vient d'être traitée.");
        return c;
      });
      const acces = d.role === "admin" ? "direction (tous les campus)" : siteNom ? `vie scolaire du campus ${siteNom}` : "vie scolaire de tous les campus";
      await journaliser(u, "demande_acces_acceptee", { demandeId: demande.id, compteId: compte.id, role: d.role, siteId: compte.siteId });
      let emailEnvoye = false;
      if (emailDisponible()) {
        const e = emailAccesValide({ prenom: demande.prenom, nom: demande.nom, email: demande.email, acces });
        emailEnvoye = await envoyerEmail({ a: demande.email, sujet: e.sujet, texte: e.texte, html: e.html }).catch(() => false);
      }
      res.json({ ...(await etat()), emailEnvoye, acces });
    }),
  );

  app.post(
    `${P}/demandes/:id(\\d+)/refuser`,
    DIRECTION,
    route(async (req, res) => {
      const u = moi(req);
      const { motif } = valider(z.object({ motif: z.string().trim().max(300).optional() }), req.body);
      const [maj] = await db
        .update(demandesAcces)
        .set({ statut: "refusee", traiteLe: new Date(), traiteParId: u.id, motif: motif || null })
        .where(and(eq(demandesAcces.id, idParam(req)), eq(demandesAcces.statut, "en_attente")))
        .returning();
      if (!maj) throw new ErreurHttp(409, "Cette demande est déjà traitée.");
      await journaliser(u, "demande_acces_refusee", { demandeId: maj.id });
      res.json(await etat());
    }),
  );

  // ── Public : la personne ouvre le lien et fait sa demande ─────────────────
  app.get(
    "/api/rejoindre/:jeton",
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const l = await lienValable(req.params.jeton);
      if (!l) throw new ErreurHttp(410, "Ce lien d'inscription ne marche plus : il a expiré ou la direction l'a remplacé. Demandez le nouveau lien à la direction.");
      const liste = await db.select({ id: sites.id, nomCourt: sites.nomCourt }).from(sites).orderBy(asc(sites.ordre));
      res.json({ expireLe: l.expireLe.toISOString(), sites: liste } satisfies InfoLienInscriptionDto);
    }),
  );

  app.post(
    "/api/rejoindre/:jeton",
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const cle = `rejoindre|${reseau(req)}`;
      verifierTentatives(cle, 8);
      const l = await lienValable(req.params.jeton);
      if (!l) {
        noterEchec(cle);
        throw new ErreurHttp(410, "Ce lien d'inscription ne marche plus : il a expiré ou la direction l'a remplacé. Demandez le nouveau lien à la direction.");
      }
      const d = valider(
        z.object({
          prenom: z.string().trim().min(1, "indiquez votre prénom").max(80, "trop long"),
          nom: z.string().trim().min(1, "indiquez votre nom").max(80, "trop long"),
          email: z.string().trim().toLowerCase().email("adresse e-mail non valide").max(160),
          telephone: z.string().trim().max(30).optional(),
          fonction: z.string().trim().min(2, "indiquez votre fonction").max(120, "trop long"),
          siteId: z.number().int().positive().nullable().default(null),
          motDePasse: z.string().min(1, "choisissez votre mot de passe").max(200),
        }),
        req.body,
      );
      // Chaque demande compte : un même réseau ne dépose pas plus de 8 demandes par quart d'heure.
      noterEchec(cle);
      if (adresseDeDemonstration(d.email)) throw invalide("Cette adresse est réservée à la démonstration du campus : tapez votre vraie adresse e-mail.");
      const minimum = longueurMinimale("vie_scolaire");
      if (d.motDePasse.length < minimum) throw invalide(`Votre mot de passe doit faire au moins ${minimum} caractères.`);
      if (!codeSecretAcceptable(d.motDePasse)) throw invalide("Ce mot de passe est trop facile à deviner. Mélangez des mots, des chiffres ou des signes.");
      let telephone: string | null = null;
      if (d.telephone) {
        telephone = normaliserTelephone(d.telephone);
        if (telephone.length < 8 || telephone.length > 15) throw invalide("Numéro de téléphone illisible (exemple : 07 07 12 34 56).");
      }
      if (d.siteId) {
        const [s] = await db.select({ id: sites.id }).from(sites).where(eq(sites.id, d.siteId));
        if (!s) throw invalide("Choisissez votre campus dans la liste.");
      }
      const [compte] = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(eq(utilisateurs.email, d.email));
      if (compte) throw new ErreurHttp(409, "Un compte du campus utilise déjà cette adresse : connectez-vous avec elle (ou touchez « mot de passe oublié » sur la page de connexion).");
      const [enAttente] = await db
        .select({ id: demandesAcces.id })
        .from(demandesAcces)
        .where(and(eq(demandesAcces.email, d.email), eq(demandesAcces.statut, "en_attente")));
      if (enAttente) throw new ErreurHttp(409, "Une demande est déjà en attente pour cette adresse : la direction va la traiter. Vous recevrez un e-mail.");
      const [demande] = await db
        .insert(demandesAcces)
        .values({
          lienId: l.id,
          prenom: espaces(d.prenom),
          nom: espaces(d.nom),
          email: d.email,
          telephone,
          fonction: espaces(d.fonction),
          siteId: d.siteId,
          motDePasseHash: await hacher(d.motDePasse),
        })
        .returning();
      await journaliser(null, "demande_acces", { demandeId: demande.id, lienId: l.id });
      // La direction est prévenue (cloche du campus, et téléphone si les notifications sont activées).
      const direction = await db
        .select({ id: utilisateurs.id })
        .from(utilisateurs)
        .where(and(eq(utilisateurs.role, "admin"), eq(utilisateurs.actif, true)));
      await notifier(
        direction.map((x) => x.id),
        {
          type: "systeme",
          titre: `Demande d'accès : ${nomAffiche(demande)}`,
          corps: `${demande.fonction} · à valider dans Pilotage, Comptes.`,
          lien: "/pilotage/comptes#equipe",
          push: true,
        },
      ).catch(() => undefined);
      res.status(201).json({ ok: true });
    }),
  );
}
