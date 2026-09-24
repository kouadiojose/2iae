// Compte : première connexion par le QR de la fiche, code oublié, profil,
// préférences, charte, appareils connectés et « devoir d'essai » du premier jour.
//
// Principes :
// - rien ne révèle si un compte existe (code oublié : réponse toujours identique) ;
// - le QR de la fiche ne sert qu'une fois, et plus du tout dès que l'étudiant a
//   choisi son propre code (voir aussi routes/auth.ts) ;
// - l'e-mail sert à recevoir un nouveau code : le changer demande le code actuel.
import type { Express, Request } from "express";
import crypto from "crypto";
import { z } from "zod";
import { and, eq, gt, inArray, isNull, ne, sql, desc } from "drizzle-orm";
import { db, pool } from "../db";
import { config, estProduction } from "../config";
import {
  exigerConnexion,
  exigerRole,
  moi,
  versMoi,
  hacher,
  verifier,
  oublierUtilisateur,
  dureeSession,
  longueurMinimale,
  codeSecretAcceptable,
  fermerAutresSessions,
  normaliserTelephone,
  trouverParIdentifiant,
  verifierTentatives,
  noterEchec,
  effacerTentatives,
} from "../auth";
import { consommerJeton, creerJeton, hacherJeton } from "../activation";
import { route, valider, ErreurHttp, interdit, invalide } from "../http";
import { notifier } from "../notifications";
import { envoyerEmail } from "../mail";
import { prevenirSite } from "../site";
import { urlFichier } from "../fichiers";
import {
  utilisateurs,
  sites,
  journal,
  reinitialisations,
  fichiers,
  essaisDepot,
  type Utilisateur,
  type ParcoursBienvenue,
  type ContactSite,
  type EtatLienReinitialisation,
  type RecuEssai,
} from "@shared/schema";

// ── Outils ─────────────────────────────────────────────────────────────────

/** Étudiants tutoyés, personnel vouvoyé (CONCEPTION.md §1.6). */
const selonRole = (u: Pick<Utilisateur, "role">, tu: string, vous: string) => (u.role === "etudiant" ? tu : vous);

const lienPerimeActivation = () =>
  new ErreurHttp(410, "Ce lien a déjà servi ou a expiré. Connecte-toi avec ton matricule et le code de ta fiche.");
const lienPerimeReinitialisation = () =>
  new ErreurHttp(410, "Ce lien a déjà servi ou a expiré : un lien « code oublié » ne sert qu'une fois, pendant 1 heure.");

/** Un jeton bien formé (base64url, 24 octets → 32 caractères). Évite une requête pour du bruit. */
const jetonBienForme = (j: string) => /^[A-Za-z0-9_-]{20,80}$/.test(j);

/**
 * Ouvre une session neuve pour cette personne (identifiant de session
 * renouvelé : protège contre la fixation de session), avec la durée de son
 * rôle : 90 jours pour les étudiants, 30 jours pour le personnel.
 */
async function ouvrirSession(req: Request, u: Utilisateur) {
  await new Promise<void>((ok, ko) => req.session.regenerate((e) => (e ? ko(e) : ok())));
  req.session.utilisateurId = u.id;
  req.session.cookie.maxAge = dureeSession(u.role);
  await db.update(utilisateurs).set({ derniereConnexion: new Date() }).where(eq(utilisateurs.id, u.id));
  oublierUtilisateur(u.id);
}

/** Lit un jeton encore valable SANS le consommer (pour vérifier avant d'agir). */
async function lireJeton(jeton: string, type: "activation" | "reinitialisation"): Promise<Utilisateur | null> {
  if (!jetonBienForme(jeton)) return null;
  const [ligne] = await db
    .select({ utilisateurId: reinitialisations.utilisateurId })
    .from(reinitialisations)
    .where(
      and(
        eq(reinitialisations.jetonHash, hacherJeton(jeton)),
        eq(reinitialisations.type, type),
        isNull(reinitialisations.utiliseLe),
        gt(reinitialisations.expireLe, new Date()),
      ),
    );
  if (!ligne) return null;
  const [u] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, ligne.utilisateurId));
  return u?.actif ? u : null;
}

/** Rend inutilisables tous les liens encore ouverts d'un compte (QR de fiche, liens « code oublié »). */
export async function invaliderJetons(utilisateurId: number) {
  await db
    .update(reinitialisations)
    .set({ utiliseLe: new Date() })
    .where(and(eq(reinitialisations.utilisateurId, utilisateurId), isNull(reinitialisations.utiliseLe)));
}

/** Oublie les essais de connexion ratés du compte (après un nouveau code). */
function effacerVerrous(u: Utilisateur) {
  for (const id of [u.matricule, u.email, u.telephone]) if (id) effacerTentatives(`compte|${id.toLowerCase()}`);
}

/** Numéro de reçu lisible au téléphone : « 2IAE-4F7K » (sans 0/O ni 1/I). */
function numeroRecu(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return `2IAE-${s}`;
}

/** Adresse « prenom-nom » pour la fiche publique d'un formateur (unique). */
async function slugDisponible(u: Utilisateur): Promise<string> {
  const base =
    `${u.prenom}-${u.nom}`
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || `formateur-${u.id}`;
  for (let i = 0; i < 20; i++) {
    const candidat = i === 0 ? base : `${base}-${i + 1}`;
    const [pris] = await db
      .select({ id: utilisateurs.id })
      .from(utilisateurs)
      .where(and(eq(utilisateurs.slug, candidat), ne(utilisateurs.id, u.id)));
    if (!pris) return candidat;
  }
  return `${base}-${u.id}`;
}

async function compterAutresSessions(utilisateurId: number, sessionCourante: string): Promise<number> {
  const r = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM campus.session WHERE (sess->>'utilisateurId')::int = $1 AND sid <> $2 AND expire > now()`,
    [utilisateurId, sessionCourante],
  );
  return r.rows[0]?.n ?? 0;
}

// ── Code oublié ────────────────────────────────────────────────────────────

/** Demandes récentes par compte : on ne prévient pas la vie scolaire dix fois pour un même oubli. */
const demandesRecentes = new Map<number, number>();
const DELAI_ENTRE_DEMANDES = 10 * 60 * 1000;
setInterval(() => {
  const limite = Date.now() - DELAI_ENTRE_DEMANDES;
  for (const [id, t] of demandesRecentes) if (t < limite) demandesRecentes.delete(id);
}, DELAI_ENTRE_DEMANDES).unref();

/** Prévient la vie scolaire du site de la personne (à défaut, la direction). */
async function prevenirVieScolaire(u: Utilisateur) {
  let ids: number[] = [];
  if (u.siteId) {
    const vs = await db
      .select({ id: utilisateurs.id })
      .from(utilisateurs)
      .where(and(eq(utilisateurs.role, "vie_scolaire"), eq(utilisateurs.siteId, u.siteId), eq(utilisateurs.actif, true)));
    ids = vs.map((l) => l.id);
  }
  if (!ids.length) {
    const admins = await db
      .select({ id: utilisateurs.id })
      .from(utilisateurs)
      .where(and(eq(utilisateurs.role, "admin"), eq(utilisateurs.actif, true)));
    ids = admins.map((l) => l.id);
  }
  ids = ids.filter((id) => id !== u.id);
  await notifier(ids, {
    type: "systeme",
    titre: `${u.prenom} ${u.nom}${u.matricule ? ` (${u.matricule})` : ""} demande un nouveau code`,
    corps: "Code secret oublié. Remettez-lui un nouveau code depuis son dossier (fiche imprimée ou WhatsApp).",
    lien: u.role === "etudiant" ? `/pilotage/etudiants/${u.id}` : "/pilotage/comptes",
  });
}

async function traiterOubli(u: Utilisateur) {
  if (u.email) {
    const jeton = await creerJeton(u.id, "reinitialisation");
    const lien = `${config.urlCampus}/reinitialiser/${jeton}`;
    const salut = `Bonjour ${u.prenom},`;
    const texte = [
      salut,
      "",
      selonRole(
        u,
        "Tu as demandé un nouveau code secret pour le campus numérique 2IAE. Touche ce lien pour le choisir (il marche une seule fois, pendant 1 heure) :",
        "Vous avez demandé un nouveau mot de passe pour le campus numérique 2IAE. Ouvrez ce lien pour le choisir (valable une seule fois, pendant 1 heure) :",
      ),
      lien,
      "",
      selonRole(
        u,
        "Si ce n'est pas toi, ne fais rien : ton code actuel reste valable.",
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.",
      ),
      "",
      "Campus numérique · Groupe 2IAE International",
    ].join("\n");
    const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#141414">
  <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#C85F22;font-family:monospace">Campus numérique 2IAE</p>
  <p style="font-size:16px">${salut}</p>
  <p style="font-size:16px;line-height:1.5">${selonRole(
    u,
    "Tu as demandé un nouveau code secret. Touche le bouton pour le choisir : le lien marche une seule fois, pendant 1 heure.",
    "Vous avez demandé un nouveau mot de passe. Le lien ci-dessous est valable une seule fois, pendant 1 heure.",
  )}</p>
  <p><a href="${lien}" style="display:inline-block;background:#E4793A;color:#141414;font-weight:bold;text-decoration:none;padding:14px 22px;border-radius:12px">${selonRole(u, "Choisir mon nouveau code", "Choisir mon nouveau mot de passe")}</a></p>
  <p style="font-size:14px;color:#6B625B">${selonRole(u, "Si ce n'est pas toi, ne fais rien : ton code actuel reste valable.", "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.")}</p>
</div>`;
    const envoye = await envoyerEmail({ a: u.email, sujet: selonRole(u, "Ton nouveau code secret · Campus 2IAE", "Votre nouveau mot de passe · Campus 2IAE"), texte, html });
    await db.insert(journal).values({ utilisateurId: u.id, action: "code_oublie", details: { canal: envoye ? "email" : "vie_scolaire" } });
    if (envoye) return;
    // E-mail indisponible (pas de clé Resend, panne) : on ne laisse pas la personne sans réponse.
    if (!estProduction) console.log(`[compte] (dev) e-mail non envoyé, lien de réinitialisation pour ${u.email} : ${lien}`);
  } else {
    await db.insert(journal).values({ utilisateurId: u.id, action: "code_oublie", details: { canal: "vie_scolaire" } });
  }
  await prevenirVieScolaire(u);
}

// ── Schémas ────────────────────────────────────────────────────────────────

const schemaOubli = z.object({
  identifiant: z.string().trim().min(1, "indique ton matricule, ton téléphone ou ton e-mail").max(120),
});

const schemaReinitialiser = z.object({
  jeton: z.string().min(1).max(100),
  nouveau: z.string().min(1, "choisis ton nouveau code").max(200),
});

const texteFacultatif = (max: number) => z.string().trim().max(max, `${max} caractères au maximum`).nullable().optional();

const schemaProfil = z
  .object({
    telephone: texteFacultatif(30),
    email: texteFacultatif(160),
    /** Obligatoire pour changer d'e-mail (l'e-mail reçoit les liens « code oublié »). */
    codeActuel: z.string().max(200).optional(),
    photoFichierId: z.number().int().positive().nullable().optional(),
    titre: texteFacultatif(120),
    /** Trois ou quatre lignes sur la carte du site : 600 caractères suffisent. */
    bio: texteFacultatif(600),
    localisation: texteFacultatif(80),
    consentementSite: z.boolean().optional(),
  })
  .strict("champ non modifiable ici");

const schemaPreferences = z
  .object({
    donneesReduites: z.boolean().optional(),
    modeSuivi: z.enum(["salle", "telephone", "ordinateur"], { errorMap: () => ({ message: "choix inconnu" }) }).optional(),
    visiteFaite: z.boolean().optional(),
    push: z.boolean().optional(),
  })
  .strict("champ non modifiable ici");

const schemaEssai = z.object({
  fichierIds: z.array(z.number().int().positive()).min(1, "ajoute au moins une photo").max(5, "5 photos au maximum"),
});

const EMAIL = z.string().email();

// ── Routes ─────────────────────────────────────────────────────────────────

export function enregistrerCompte(app: Express) {
  // QR de la fiche de connexion : connecte sans rien taper, puis /bienvenue.
  app.get(
    "/api/activer/:jeton",
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const cleIp = `activation|${req.ip}`;
      verifierTentatives(cleIp, 20);
      const jeton = String(req.params.jeton ?? "");
      const u = jetonBienForme(jeton) ? await consommerJeton(jeton, "activation") : null;
      if (!u) {
        noterEchec(cleIp);
        throw lienPerimeActivation();
      }
      // Le code personnel est déjà choisi : le papier de la fiche ne doit plus ouvrir le compte.
      if (!u.doitChangerMotDePasse) throw lienPerimeActivation();
      await ouvrirSession(req, u);
      await db.insert(journal).values({ utilisateurId: u.id, action: "activation_qr", details: { ip: req.ip } });
      res.json(await versMoi({ ...u, derniereConnexion: new Date() }));
    }),
  );

  // Code oublié : réponse identique que le compte existe ou non.
  app.post(
    "/api/compte/oubli",
    route(async (req, res) => {
      const { identifiant } = valider(schemaOubli, req.body);
      const cleIp = `oubli|${req.ip}`;
      verifierTentatives(cleIp, 10);
      noterEchec(cleIp); // chaque demande compte : 10 par quart d'heure et par adresse
      // Téléphone partagé par plusieurs comptes : on demande le matricule, comme à la connexion.
      const u = await trouverParIdentifiant(identifiant).catch((e: unknown) => {
        if (e instanceof ErreurHttp && e.statut === 409) {
          throw new ErreurHttp(409, "Plusieurs comptes utilisent ce numéro. Tape plutôt ton matricule : il est sur ta fiche de connexion.");
        }
        throw e;
      });
      if (u && u.actif && u.role !== "salle") {
        const derniere = demandesRecentes.get(u.id);
        if (!derniere || derniere < Date.now() - DELAI_ENTRE_DEMANDES) {
          demandesRecentes.set(u.id, Date.now());
          // Sans attendre : le temps de réponse ne doit pas trahir l'existence du compte.
          void traiterOubli(u).catch((e) => console.error("[compte] code oublié :", (e as Error).message));
        }
      }
      res.json({ ok: true });
    }),
  );

  // Numéros WhatsApp de la vie scolaire des cinq campus (bouton « Besoin d'aide ? » de la connexion).
  app.get(
    "/api/compte/contacts-sites",
    route(async (_req, res) => {
      const lignes = await db
        .select({ id: sites.id, nom: sites.nom, nomCourt: sites.nomCourt, whatsapp: sites.whatsappVieScolaire })
        .from(sites)
        .orderBy(sites.ordre, sites.id);
      const contacts: ContactSite[] = lignes.map((l) => ({ ...l, whatsapp: l.whatsapp?.replace(/\D/g, "") || null }));
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(contacts);
    }),
  );

  // Le lien « code oublié » est-il encore valable ? (sans le consommer)
  app.get(
    "/api/compte/reinitialiser/:jeton",
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const cleIp = `reinit|${req.ip}`;
      verifierTentatives(cleIp, 20);
      const u = await lireJeton(String(req.params.jeton ?? ""), "reinitialisation");
      if (!u) {
        noterEchec(cleIp);
        throw lienPerimeReinitialisation();
      }
      const etat: EtatLienReinitialisation = { prenom: u.prenom, longueurMinimale: longueurMinimale(u.role), codeChiffres: u.role === "etudiant" };
      res.json(etat);
    }),
  );

  // Nouveau code choisi depuis le lien reçu par e-mail : la personne est connectée, ses autres appareils déconnectés.
  app.post(
    "/api/compte/reinitialiser",
    route(async (req, res) => {
      const { jeton, nouveau } = valider(schemaReinitialiser, req.body);
      const cleIp = `reinit|${req.ip}`;
      verifierTentatives(cleIp, 20);
      const u = await lireJeton(jeton, "reinitialisation");
      if (!u) {
        noterEchec(cleIp);
        throw lienPerimeReinitialisation();
      }
      // Règles vérifiées AVANT de consommer le lien : un code refusé ne le gâche pas.
      const minimum = longueurMinimale(u.role);
      if (nouveau.length < minimum) {
        throw invalide(selonRole(u, `Ton code secret doit faire au moins ${minimum} caractères.`, `Votre mot de passe doit faire au moins ${minimum} caractères.`));
      }
      if (!codeSecretAcceptable(nouveau)) {
        throw invalide(selonRole(u, "Ce code est trop facile à deviner. Évite les suites comme 123456 ou 111111.", "Ce mot de passe est trop facile à deviner."));
      }
      const consomme = await consommerJeton(jeton, "reinitialisation");
      if (!consomme || consomme.id !== u.id) throw lienPerimeReinitialisation();
      const [maj] = await db
        .update(utilisateurs)
        .set({ motDePasseHash: await hacher(nouveau), doitChangerMotDePasse: false, motDePasseExpireLe: null })
        .where(eq(utilisateurs.id, u.id))
        .returning();
      await invaliderJetons(u.id);
      await ouvrirSession(req, maj);
      await fermerAutresSessions(u.id, req.sessionID);
      effacerVerrous(maj);
      await db.insert(journal).values({ utilisateurId: u.id, action: "code_reinitialise", details: { ip: req.ip } });
      res.json(await versMoi(maj));
    }),
  );

  // Où en est le parcours de bienvenue ?
  app.get(
    "/api/compte/parcours",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const [essai] =
        u.role === "etudiant"
          ? await db
              .select({ recu: essaisDepot.recu, creeLe: essaisDepot.creeLe })
              .from(essaisDepot)
              .where(eq(essaisDepot.utilisateurId, u.id))
              .orderBy(desc(essaisDepot.creeLe))
              .limit(1)
          : [];
      const parcours: ParcoursBienvenue = {
        codeChoisi: !u.doitChangerMotDePasse,
        charteAcceptee: Boolean(u.charteAccepteeLe),
        modeSuiviChoisi: Boolean(u.preferences?.modeSuivi),
        visiteFaite: Boolean(u.preferences?.visiteFaite),
        essai: essai ? { recu: essai.recu, heure: essai.creeLe.toISOString() } : null,
        longueurMinimale: longueurMinimale(u.role),
      };
      res.json(parcours);
    }),
  );

  // Profil : contacts, photo et, pour les formateurs, la fiche publique.
  app.patch(
    "/api/compte/profil",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const corps = valider(schemaProfil, req.body);
      const maj: Partial<typeof utilisateurs.$inferInsert> = {};
      const champs: string[] = [];

      if (corps.telephone !== undefined) {
        if (!corps.telephone) maj.telephone = null;
        else {
          const tel = normaliserTelephone(corps.telephone);
          if (tel.length < 8 || tel.length > 15) {
            throw invalide(selonRole(u, "Numéro invalide : tape tes 10 chiffres, par exemple 07 07 12 34 56.", "Numéro invalide : 10 chiffres, par exemple 07 07 12 34 56."));
          }
          maj.telephone = tel;
        }
        if (maj.telephone !== u.telephone) champs.push("telephone");
      }

      if (corps.email !== undefined) {
        const email = corps.email ? corps.email.toLowerCase() : null;
        if (email !== u.email) {
          if (email && !EMAIL.safeParse(email).success) throw invalide(selonRole(u, "Cette adresse e-mail n'est pas valide.", "Cette adresse e-mail n'est pas valide."));
          // Le personnel et les salles se connectent avec leur e-mail : il ne peut pas disparaître.
          if (!email && u.role !== "etudiant") throw invalide("Votre e-mail sert à vous connecter : il ne peut pas être retiré.");
          // L'e-mail reçoit les liens « code oublié » : le changer demande le code actuel.
          if (!corps.codeActuel) {
            throw invalide(selonRole(u, "Pour changer ton e-mail, confirme avec ton code secret.", "Pour changer votre e-mail, confirmez avec votre mot de passe."));
          }
          if (!(await verifier(corps.codeActuel, u.motDePasseHash))) {
            throw invalide(selonRole(u, "Ton code secret n'est pas le bon.", "Votre mot de passe actuel n'est pas le bon."));
          }
          if (email) {
            const [pris] = await db
              .select({ id: utilisateurs.id })
              .from(utilisateurs)
              .where(and(eq(utilisateurs.email, email), ne(utilisateurs.id, u.id)));
            if (pris) throw new ErreurHttp(409, "Cette adresse e-mail est déjà utilisée par un autre compte.");
          }
          maj.email = email;
          champs.push("email");
        }
      }

      if (corps.photoFichierId !== undefined) {
        if (corps.photoFichierId === null) maj.photoUrl = null;
        else {
          const [f] = await db.select().from(fichiers).where(eq(fichiers.id, corps.photoFichierId));
          if (!f || f.proprietaireId !== u.id || f.usage !== "avatar" || !f.mime.startsWith("image/")) {
            throw invalide(selonRole(u, "Cette photo n'a pas été reçue. Réessaie.", "Cette photo n'a pas été reçue. Réessayez."));
          }
          maj.photoUrl = urlFichier(f.id);
        }
        champs.push("photo");
      }

      const champsFormateur = [corps.titre, corps.bio, corps.localisation, corps.consentementSite].some((v) => v !== undefined);
      if (champsFormateur && u.role !== "formateur") throw interdit("Ces informations sont réservées aux formateurs.");
      for (const champ of ["titre", "bio", "localisation"] as const) {
        if (corps[champ] === undefined) continue;
        maj[champ] = corps[champ] || null;
        champs.push(champ);
      }

      let ficheProposee = false;
      let ficheRetiree = false;
      if (corps.consentementSite !== undefined && corps.consentementSite !== u.consentementSite) {
        champs.push("consentementSite");
        if (corps.consentementSite) {
          // Le formateur accepte : sa fiche est proposée, la direction valide la publication (§9.10).
          maj.consentementSite = true;
          maj.proposeSurSite = true;
          if (!u.slug) maj.slug = await slugDisponible(u);
          ficheProposee = true;
        } else {
          // Consentement retiré : la fiche quitte le site tout de suite.
          maj.consentementSite = false;
          maj.proposeSurSite = false;
          maj.publierSurSite = false;
          ficheRetiree = true;
        }
      }

      if (!Object.keys(maj).length) return res.json(await versMoi(u));
      const [apres] = await db.update(utilisateurs).set(maj).where(eq(utilisateurs.id, u.id)).returning();
      oublierUtilisateur(u.id);
      await db.insert(journal).values({ utilisateurId: u.id, action: "profil_modifie", details: { champs } });

      if (ficheRetiree) prevenirSite("formateur retiré");
      else if (apres.publierSurSite && champs.some((c) => ["titre", "bio", "localisation", "photo"].includes(c))) prevenirSite("formateur modifié");
      if (ficheProposee) {
        const admins = await db
          .select({ id: utilisateurs.id })
          .from(utilisateurs)
          .where(and(eq(utilisateurs.role, "admin"), eq(utilisateurs.actif, true)));
        await notifier(
          admins.map((a) => a.id),
          { type: "systeme", titre: `${u.prenom} ${u.nom} accepte que sa fiche soit publiée sur 2iae.com`, corps: "Relisez-la et validez la publication.", lien: "/pilotage/site", push: false },
        );
      }
      res.json(await versMoi(apres));
    }),
  );

  // Préférences (fusion atomique dans le JSON : deux onglets ne s'écrasent pas).
  app.patch(
    "/api/compte/preferences",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const corps = valider(schemaPreferences, req.body);
      const [apres] = await db
        .update(utilisateurs)
        .set({ preferences: sql`coalesce(${utilisateurs.preferences}, '{}'::jsonb) || ${JSON.stringify(corps)}::jsonb` })
        .where(eq(utilisateurs.id, u.id))
        .returning();
      oublierUtilisateur(u.id);
      res.json(await versMoi(apres));
    }),
  );

  // Charte d'utilisation (IA, enregistrement des lives, données) : on garde la date de la première acceptation.
  app.post(
    "/api/compte/charte",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      if (u.charteAccepteeLe) return res.json(await versMoi(u));
      const [apres] = await db.update(utilisateurs).set({ charteAccepteeLe: new Date() }).where(eq(utilisateurs.id, u.id)).returning();
      oublierUtilisateur(u.id);
      await db.insert(journal).values({ utilisateurId: u.id, action: "charte_acceptee" });
      res.json(await versMoi(apres));
    }),
  );

  // Nombre d'autres appareils connectés à ce compte.
  app.get(
    "/api/compte/appareils",
    exigerConnexion,
    route(async (req, res) => {
      res.json({ autres: await compterAutresSessions(moi(req).id, req.sessionID) });
    }),
  );

  app.post(
    "/api/compte/deconnecter-partout",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const fermees = await compterAutresSessions(u.id, req.sessionID);
      await fermerAutresSessions(u.id, req.sessionID);
      await db.insert(journal).values({ utilisateurId: u.id, action: "deconnexion_autres_appareils", details: { fermees } });
      res.json({ ok: true, fermees });
    }),
  );

  // « Ton premier devoir en 2 minutes » : une photo, un reçu. Ni devoir réel, ni note.
  app.post(
    "/api/compte/essai-depot",
    exigerRole("etudiant"),
    route(async (req, res) => {
      const u = moi(req);
      const { fichierIds } = valider(schemaEssai, req.body);
      const ids = [...new Set(fichierIds)];
      const trouves = await db
        .select({ id: fichiers.id, proprietaireId: fichiers.proprietaireId, usage: fichiers.usage })
        .from(fichiers)
        .where(inArray(fichiers.id, ids));
      if (trouves.length !== ids.length || trouves.some((f) => f.proprietaireId !== u.id || f.usage !== "rendu")) {
        throw interdit("Ces photos ne sont pas les tiennes. Reprends la photo et réessaie.");
      }
      for (let essai = 0; essai < 5; essai++) {
        try {
          const [ligne] = await db.insert(essaisDepot).values({ utilisateurId: u.id, recu: numeroRecu(), fichierIds: ids }).returning();
          await db.insert(journal).values({ utilisateurId: u.id, action: "essai_depot", details: { recu: ligne.recu, fichierIds: ids } });
          const recu: RecuEssai = { recu: ligne.recu, heure: ligne.creeLe.toISOString() };
          return res.status(201).json(recu);
        } catch (e) {
          // Numéro de reçu déjà pris (rarissime) : on en tire un autre.
          if ((e as { code?: string }).code !== "23505") throw e;
        }
      }
      throw new ErreurHttp(500, "Le reçu n'a pas pu être créé. Réessaie dans un instant.");
    }),
  );
}
