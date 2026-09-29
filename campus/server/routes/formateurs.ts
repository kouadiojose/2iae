// Inscription des formateurs par un lien personnel : PREMIÈRE VERSION (/inscription-formateur/<jeton>).
//
// Les invitations se font désormais par la fenêtre « Inviter » du pilotage (lien /invitation/<jeton>,
// module lancement). Ces routes restent pour que les liens déjà envoyés marchent jusqu'à leur
// expiration (30 jours) ; le guide envoyé est le même (guide-bienvenue.ts). Plus rien ne crée de
// nouveau lien de ce type depuis l'interface.
//
//
//   GET    /api/pilotage/formateurs/liens              les liens et les fiches à activer (direction)
//   POST   /api/pilotage/formateurs/liens              crée le lien d'un formateur (nom prévu, ou fiche existante)
//   DELETE /api/pilotage/formateurs/liens/:id          désactive un lien qui n'a pas servi
//   POST   /api/pilotage/formateurs/liens/:id/email    envoie le lien par e-mail
//   GET    /api/inscription-formateur/:jeton           public : ce que le formateur voit en ouvrant son lien
//   POST   /api/inscription-formateur/:jeton           public : il crée son compte, il est connecté, il reçoit son guide
//
// Le lien est nominatif et ne sert qu'une fois (30 jours par défaut) : il vaut
// l'invitation, c'est pourquoi le compte est ouvert sans validation. Si la
// direction avait déjà créé la fiche du formateur (il figure dans l'emploi du
// temps), le lien la complète : ses cours et ses séances restent les siens.
// Les formateurs enseignent à tous les campus : seule la direction (ou la vie
// scolaire de tout le groupe) crée ces liens, comme elle crée leurs comptes.
import type { Express, Request } from "express";
import { z } from "zod";
import { and, asc, desc, eq, gt, inArray, isNull, ne, or } from "drizzle-orm";
import { db } from "../db";
import { config } from "../config";
import {
  exigerRole,
  moi,
  perimetreSites,
  hacher,
  jetonAleatoire,
  codeSecretAcceptable,
  longueurMinimale,
  normaliserTelephone,
  verifierTentatives,
  noterEchec,
  fermerAutresSessions,
  oublierUtilisateur,
  versMoi,
} from "../auth";
import { route, valider, idParam, ErreurHttp, introuvable, interdit, invalide } from "../http";
import { notifier } from "../notifications";
import { emailDisponible, envoyerEmail, emailLienFormateur, guideFormateurUrl, nomAffiche } from "../mail";
import { adresseDeDemonstration } from "../demo-constantes";
import { prevenirSite } from "../site";
import { ouvrirSession, invaliderJetons } from "./compte";
import { envoyerGuideFormateur } from "./lancement";
import {
  utilisateurs,
  journal,
  liensFormateurs,
  type Utilisateur,
  type LienFormateurDto,
  type LiensFormateursDto,
  type InfoLienFormateurDto,
  type InscriptionFormateurFaite,
  type StatutLienFormateur,
} from "@shared/schema";

const P = "/api/pilotage/formateurs/liens";
const EQUIPE = exigerRole("admin", "vie_scolaire");
const JOUR_MS = 24 * 60 * 60 * 1000;
/** Liens déjà servis, expirés ou désactivés : gardés en vue trois mois. */
const HISTORIQUE_MS = 90 * JOUR_MS;

const urlLien = (jeton: string) => `${config.urlCampus}/inscription-formateur/${jeton}`;
const espaces = (s: string) => s.replace(/\s+/g, " ").trim();
const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" });

async function journaliser(u: Pick<Utilisateur, "id"> | null, action: string, details: Record<string, unknown> = {}) {
  await db.insert(journal).values({ utilisateurId: u?.id ?? null, action, details });
}

/** Les formateurs enseignent à tous les campus : leurs liens sont l'affaire de la direction (ou de la vie scolaire du groupe). */
function exigerGroupe(u: Utilisateur) {
  if (u.role !== "admin" && perimetreSites(u)) throw interdit("Les formateurs sont invités par la direction : ils enseignent à tous les campus.");
}

/** Adresse de la personne pour la limite d'essais (IPv4, ou réseau /64 en IPv6). */
function reseau(req: Request): string {
  const a = (req.ip ?? "").replace(/^::ffff:(?=\d+\.)/i, "").split("%")[0];
  return a.includes(":") ? a.split(":").slice(0, 4).join(":") : a;
}

type LigneLien = typeof liensFormateurs.$inferSelect;

function statutDe(l: LigneLien, maintenant = Date.now()): StatutLienFormateur {
  if (l.utiliseLe) return "utilise";
  if (l.revoqueLe) return "desactive";
  if (l.expireLe.getTime() <= maintenant) return "expire";
  return "actif";
}

const pourQui = (l: Pick<LigneLien, "prenom" | "nom">) => espaces(`${l.prenom} ${l.nom}`);

function messageLien(pour: string, url: string, expireLe: Date): string {
  return [
    `Bonjour${pour ? ` ${pour}` : ""},`,
    "Voici votre lien personnel pour créer votre compte formateur sur le campus numérique du Groupe Écoles 2IAE International :",
    url,
    "",
    "Vous y entrerez votre nom, votre adresse e-mail et le mot de passe de votre choix. Dès que c'est fait, vous êtes connecté et vous recevez par e-mail votre guide pas à pas (se connecter, préparer vos séances, déposer vos documents, faire cours en direct, donner et corriger les devoirs).",
    "",
    `Ce lien ne sert qu'une fois ; il reste valable jusqu'au ${fmtDate.format(expireLe)}.`,
  ].join("\n");
}

async function etat(): Promise<LiensFormateursDto> {
  const depuis = new Date(Date.now() - HISTORIQUE_MS);
  const [liens, fiches] = await Promise.all([
    db
      .select()
      .from(liensFormateurs)
      .where(or(and(isNull(liensFormateurs.utiliseLe), isNull(liensFormateurs.revoqueLe), gt(liensFormateurs.expireLe, new Date())), gt(liensFormateurs.creeLe, depuis)))
      .orderBy(desc(liensFormateurs.creeLe))
      .limit(60),
    db
      .select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, titre: utilisateurs.titre })
      .from(utilisateurs)
      .where(and(eq(utilisateurs.role, "formateur"), eq(utilisateurs.actif, true), eq(utilisateurs.doitChangerMotDePasse, true)))
      .orderBy(asc(utilisateurs.nom), asc(utilisateurs.prenom)),
  ]);
  const idsComptes = [...new Set(liens.map((l) => l.compteCreeId).filter((x): x is number => x !== null))];
  const comptes = idsComptes.length
    ? await db.select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, email: utilisateurs.email }).from(utilisateurs).where(inArray(utilisateurs.id, idsComptes))
    : [];
  const parId = new Map(comptes.map((c) => [c.id, c]));
  return {
    liens: liens.map((l): LienFormateurDto => {
      const url = urlLien(l.jeton);
      const c = l.compteCreeId ? parId.get(l.compteCreeId) : undefined;
      const pour = pourQui(l);
      return {
        id: l.id,
        url,
        pour,
        compteId: l.compteId,
        statut: statutDe(l),
        creeLe: l.creeLe.toISOString(),
        expireLe: l.expireLe.toISOString(),
        utiliseLe: l.utiliseLe?.toISOString() ?? null,
        compteCree: c ? { id: c.id, nom: nomAffiche(c), email: c.email } : null,
        message: messageLien(pour, url, l.expireLe),
      };
    }),
    fichesAActiver: fiches.map((f) => ({ id: f.id, nom: nomAffiche(f), titre: f.titre })),
    emailDisponible: emailDisponible(),
  };
}

/** Lien encore utilisable, ou l'erreur exacte à montrer au formateur. */
async function lienUtilisable(jeton: string): Promise<LigneLien> {
  const perime = new ErreurHttp(410, "Ce lien d'inscription n'existe pas. Vérifiez qu'il est complet, ou demandez-en un nouveau à la direction.");
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(jeton)) throw perime;
  const [l] = await db.select().from(liensFormateurs).where(eq(liensFormateurs.jeton, jeton));
  if (!l) throw perime;
  switch (statutDe(l)) {
    case "utilise":
      throw new ErreurHttp(410, "Ce lien a déjà servi : votre compte formateur existe. Connectez-vous avec votre adresse e-mail et votre mot de passe.");
    case "desactive":
      throw new ErreurHttp(410, "Ce lien a été désactivé par la direction. Demandez-lui votre nouveau lien.");
    case "expire":
      throw new ErreurHttp(410, "Ce lien a expiré. Demandez à la direction de vous en envoyer un nouveau.");
    default:
      return l;
  }
}

const schemaCreation = z.object({
  prenom: z.string().trim().max(80).optional(),
  nom: z.string().trim().max(80).optional(),
  compteId: z.number().int().positive().nullable().optional(),
  joursValidite: z.number().int().min(1).max(90).default(30),
});

const schemaInscription = z.object({
  prenom: z.string().trim().min(1, "indiquez votre prénom").max(80, "trop long"),
  nom: z.string().trim().min(1, "indiquez votre nom").max(80, "trop long"),
  email: z.string().trim().toLowerCase().email("adresse e-mail non valide").max(160),
  telephone: z.string().trim().max(30).optional(),
  titre: z.string().trim().max(120, "trop long").optional(),
  localisation: z.string().trim().max(120, "trop long").optional(),
  motDePasse: z.string().min(1, "choisissez votre mot de passe").max(200),
});

export function enregistrerFormateurs(app: Express) {
  // ── Direction : créer, suivre, désactiver les liens ───────────────────────
  app.get(
    P,
    EQUIPE,
    route(async (req, res) => {
      exigerGroupe(moi(req));
      res.setHeader("Cache-Control", "no-store");
      res.json(await etat());
    }),
  );

  app.post(
    P,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      exigerGroupe(u);
      const d = valider(schemaCreation, req.body ?? {});
      let prenom = espaces(d.prenom ?? "");
      let nom = espaces(d.nom ?? "");
      let compteId: number | null = null;
      if (d.compteId) {
        const [c] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, d.compteId));
        if (!c || c.role !== "formateur") throw introuvable("Fiche formateur");
        if (!c.actif) throw invalide(`La fiche de ${nomAffiche(c)} est désactivée : réactivez-la d'abord.`);
        if (!c.doitChangerMotDePasse) {
          throw new ErreurHttp(409, `${nomAffiche(c)} a déjà activé son compte : il se connecte avec son identifiant. Mot de passe oublié : « Nouveau code » sur sa fiche.`);
        }
        compteId = c.id;
        prenom ||= c.prenom;
        nom ||= c.nom;
        // Un seul lien valable par fiche : les précédents ne marchent plus.
        await db
          .update(liensFormateurs)
          .set({ revoqueLe: new Date() })
          .where(and(eq(liensFormateurs.compteId, c.id), isNull(liensFormateurs.utiliseLe), isNull(liensFormateurs.revoqueLe)));
      }
      const [l] = await db
        .insert(liensFormateurs)
        .values({ jeton: jetonAleatoire(18), prenom, nom, compteId, creeParId: u.id, expireLe: new Date(Date.now() + d.joursValidite * JOUR_MS) })
        .returning();
      await journaliser(u, "lien_formateur_cree", { lienId: l.id, compteId, jours: d.joursValidite });
      const e = await etat();
      res.status(201).json({ ...e, cree: e.liens.find((x) => x.id === l.id) ?? null });
    }),
  );

  app.delete(
    `${P}/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      exigerGroupe(u);
      const [l] = await db
        .update(liensFormateurs)
        .set({ revoqueLe: new Date() })
        .where(and(eq(liensFormateurs.id, idParam(req)), isNull(liensFormateurs.utiliseLe), isNull(liensFormateurs.revoqueLe)))
        .returning();
      if (!l) throw introuvable("Lien encore actif");
      await journaliser(u, "lien_formateur_desactive", { lienId: l.id });
      res.json(await etat());
    }),
  );

  app.post(
    `${P}/:id(\\d+)/email`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      exigerGroupe(u);
      const { adresse } = valider(z.object({ adresse: z.string().trim().toLowerCase().email("adresse e-mail non valide").max(160) }), req.body);
      if (!emailDisponible()) throw new ErreurHttp(503, "Le campus n'envoie pas encore d'e-mails. Envoyez le lien par WhatsApp ou copiez-le.");
      const [l] = await db.select().from(liensFormateurs).where(eq(liensFormateurs.id, idParam(req)));
      if (!l) throw introuvable("Lien");
      if (statutDe(l) !== "actif") throw new ErreurHttp(410, "Ce lien ne marche plus (il a servi, expiré ou été désactivé). Créez-en un nouveau.");
      const e = emailLienFormateur({ pour: pourQui(l), lien: urlLien(l.jeton), expireLe: l.expireLe });
      const envoye = await envoyerEmail({ a: adresse, sujet: e.sujet, texte: e.texte, html: e.html });
      if (envoye) await journaliser(u, "lien_formateur_email", { lienId: l.id });
      res.status(envoye ? 200 : 502).json({ envoye, message: envoye ? `Lien envoyé à ${adresse}.` : "L'e-mail n'a pas pu partir. Réessayez, ou envoyez le lien par WhatsApp." });
    }),
  );

  // ── Public : le formateur ouvre son lien ──────────────────────────────────
  app.get(
    "/api/inscription-formateur/:jeton",
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const cle = `inscription-formateur-lecture|${reseau(req)}`;
      verifierTentatives(cle, 30);
      let l: LigneLien;
      try {
        l = await lienUtilisable(String(req.params.jeton ?? ""));
      } catch (e) {
        noterEchec(cle);
        throw e;
      }
      let fiche: Utilisateur | undefined;
      if (l.compteId) [fiche] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, l.compteId));
      const r: InfoLienFormateurDto = {
        prenom: l.prenom || fiche?.prenom || "",
        nom: l.nom || fiche?.nom || "",
        email: fiche?.email ?? null,
        telephone: fiche?.telephone ?? null,
        titre: fiche?.titre ?? null,
        localisation: fiche?.localisation ?? null,
        expireLe: l.expireLe.toISOString(),
        ficheExistante: Boolean(fiche),
        minimumMotDePasse: longueurMinimale("formateur"),
      };
      res.json(r);
    }),
  );

  app.post(
    "/api/inscription-formateur/:jeton",
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const cle = `inscription-formateur|${reseau(req)}`;
      verifierTentatives(cle, 8);
      // Chaque envoi compte : un même réseau ne fait pas plus de 8 essais par quart d'heure.
      noterEchec(cle);
      const l = await lienUtilisable(String(req.params.jeton ?? ""));
      const d = valider(schemaInscription, req.body);

      if (adresseDeDemonstration(d.email)) throw invalide("Cette adresse est réservée à la démonstration du campus : tapez votre vraie adresse e-mail.");
      const minimum = longueurMinimale("formateur");
      if (d.motDePasse.length < minimum) throw invalide(`Votre mot de passe doit faire au moins ${minimum} caractères.`);
      if (!codeSecretAcceptable(d.motDePasse)) throw invalide("Ce mot de passe est trop facile à deviner. Mélangez des mots, des chiffres ou des signes.");
      let telephone: string | null = null;
      if (d.telephone) {
        telephone = normaliserTelephone(d.telephone);
        if (telephone.length < 8 || telephone.length > 15) throw invalide("Numéro de téléphone illisible : tapez l'indicatif du pays puis le numéro (exemple : +1 514 555 0123).");
      }
      const [pris] = await db
        .select({ id: utilisateurs.id })
        .from(utilisateurs)
        .where(l.compteId ? and(eq(utilisateurs.email, d.email), ne(utilisateurs.id, l.compteId)) : eq(utilisateurs.email, d.email));
      if (pris) {
        throw new ErreurHttp(409, "Un compte du campus utilise déjà cette adresse e-mail. Si c'est le vôtre, connectez-vous avec elle (mot de passe oublié : « Code ou mot de passe oublié »). Sinon, tapez une autre adresse.");
      }

      const valeurs = {
        prenom: espaces(d.prenom),
        nom: espaces(d.nom),
        email: d.email,
        telephone,
        titre: d.titre ? espaces(d.titre) : null,
        localisation: d.localisation ? espaces(d.localisation) : null,
        motDePasseHash: await hacher(d.motDePasse),
        doitChangerMotDePasse: false,
        motDePasseExpireLe: null,
      };

      let compte: Utilisateur;
      try {
        compte = await db.transaction(async (tx) => {
          // Le lien ne sert qu'une fois, même si deux envois partent en même temps.
          const [pris] = await tx
            .update(liensFormateurs)
            .set({ utiliseLe: new Date() })
            .where(and(eq(liensFormateurs.id, l.id), isNull(liensFormateurs.utiliseLe), isNull(liensFormateurs.revoqueLe), gt(liensFormateurs.expireLe, new Date())))
            .returning();
          if (!pris) throw new ErreurHttp(410, "Ce lien vient de servir : votre compte existe. Connectez-vous avec votre adresse e-mail et votre mot de passe.");
          let c: Utilisateur | undefined;
          if (l.compteId) {
            [c] = await tx
              .update(utilisateurs)
              .set(valeurs)
              .where(and(eq(utilisateurs.id, l.compteId), eq(utilisateurs.role, "formateur"), eq(utilisateurs.actif, true), eq(utilisateurs.doitChangerMotDePasse, true)))
              .returning();
            if (!c) throw new ErreurHttp(409, "Votre compte formateur est déjà activé. Connectez-vous avec votre identifiant et votre mot de passe.");
          } else {
            [c] = await tx
              .insert(utilisateurs)
              .values({ role: "formateur", ...valeurs, siteId: null })
              .returning();
          }
          await tx.update(liensFormateurs).set({ compteCreeId: c.id }).where(eq(liensFormateurs.id, l.id));
          return c;
        });
      } catch (e) {
        if ((e as { code?: string }).code === "23505") throw new ErreurHttp(409, "Cette adresse e-mail vient d'être prise par un autre compte. Tapez-en une autre.");
        throw e;
      }

      if (l.compteId) {
        // La fiche existait : ses anciens liens d'activation et sessions ne doivent plus rien ouvrir.
        await invaliderJetons(compte.id);
        await fermerAutresSessions(compte.id);
        oublierUtilisateur(compte.id);
        if (compte.publierSurSite) prevenirSite("fiche d'un formateur");
      }
      await ouvrirSession(req, compte);
      await journaliser(compte, "inscription_formateur", { lienId: l.id, ficheExistante: Boolean(l.compteId) });

      const direction = await db
        .select({ id: utilisateurs.id })
        .from(utilisateurs)
        .where(and(eq(utilisateurs.role, "admin"), eq(utilisateurs.actif, true)));
      await notifier(
        direction.map((x) => x.id),
        {
          type: "systeme",
          titre: `Nouveau formateur : ${nomAffiche(compte)}`,
          corps: `${compte.titre ? `${compte.titre} · ` : ""}compte créé avec son lien d'inscription.`,
          lien: "/pilotage/comptes#formateurs",
          push: true,
        },
      ).catch(() => undefined);

      const guideEnvoye = await envoyerGuideFormateur(compte);
      const r: InscriptionFormateurFaite = { prenom: compte.prenom, email: d.email, guideEnvoye, guideUrl: guideFormateurUrl(), moi: await versMoi({ ...compte, derniereConnexion: new Date() }) };
      res.status(201).json(r);
    }),
  );
}
