// Connexion, déconnexion, profil courant et changement de mot de passe.
import type { Express } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  trouverParIdentifiant,
  verifier,
  hacher,
  versMoi,
  exigerConnexion,
  moi,
  oublierUtilisateur,
  verifierTentatives,
  noterEchec,
  effacerTentatives,
  dureeSession,
  longueurMinimale,
  codeSecretAcceptable,
  fermerAutresSessions,
} from "../auth";
import { route, valider, ErreurHttp } from "../http";
import { utilisateurs, journal } from "@shared/schema";

const schemaConnexion = z.object({
  identifiant: z.string().trim().min(1, "indique ton matricule, ton téléphone ou ton e-mail").max(120),
  motDePasse: z.string().min(1, "indique ton code secret").max(200),
  /** Téléphone partagé : la session s'arrête à la fermeture du navigateur. */
  appareilPartage: z.boolean().optional(),
});

const schemaMotDePasse = z.object({
  actuel: z.string().max(200).optional(),
  nouveau: z.string().min(6, "6 caractères minimum").max(200),
});

// Limite globale : protège contre l'essai d'un même code sur des milliers de matricules.
let echecsGlobaux: number[] = [];

export function enregistrerAuth(app: Express) {
  app.post(
    "/api/auth/connexion",
    route(async (req, res) => {
      const { identifiant, motDePasse, appareilPartage } = valider(schemaConnexion, req.body);
      const maintenant = Date.now();
      echecsGlobaux = echecsGlobaux.filter((t) => t > maintenant - 60_000);
      if (echecsGlobaux.length > 300) throw new ErreurHttp(429, "Le campus reçoit trop de tentatives de connexion. Réessaie dans une minute.");
      const cleCompte = `compte|${identifiant.toLowerCase()}`;
      const cleIp = `ip|${req.ip}`;
      verifierTentatives(cleCompte);
      verifierTentatives(cleIp, 30);
      const u = await trouverParIdentifiant(identifiant);
      if (!u || !u.actif || !(await verifier(motDePasse, u.motDePasseHash))) {
        noterEchec(cleCompte);
        noterEchec(cleIp);
        echecsGlobaux.push(maintenant);
        if (u) await db.insert(journal).values({ utilisateurId: u.id, action: "connexion_echouee", details: { ip: req.ip } });
        throw new ErreurHttp(401, "Identifiant ou code secret incorrect. Vérifie les informations de ta fiche de connexion.");
      }
      if (u.doitChangerMotDePasse && u.motDePasseExpireLe && u.motDePasseExpireLe.getTime() < maintenant) {
        throw new ErreurHttp(401, "Ton code provisoire a expiré. Demande un nouveau code à la vie scolaire de ton campus.");
      }
      effacerTentatives(cleCompte);
      await new Promise<void>((ok, ko) => req.session.regenerate((e) => (e ? ko(e) : ok())));
      req.session.utilisateurId = u.id;
      // Téléphone partagé : cookie de session (effacé à la fermeture du navigateur).
      if (appareilPartage) req.session.cookie.expires = undefined;
      else req.session.cookie.maxAge = dureeSession(u.role);
      await db.update(utilisateurs).set({ derniereConnexion: new Date() }).where(eq(utilisateurs.id, u.id));
      await db.insert(journal).values({ utilisateurId: u.id, action: "connexion", details: { ip: req.ip } });
      oublierUtilisateur(u.id);
      res.json(await versMoi({ ...u, derniereConnexion: new Date() }));
    }),
  );

  app.post("/api/auth/deconnexion", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("campus_2iae");
      res.json({ ok: true });
    });
  });

  app.get(
    "/api/auth/moi",
    route(async (req, res) => {
      if (!req.utilisateur) return res.status(401).json({ message: "Non connecté." });
      res.json(await versMoi(req.utilisateur));
    }),
  );

  app.post(
    "/api/auth/mot-de-passe",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const { actuel, nouveau } = valider(schemaMotDePasse, req.body);
      const minimum = longueurMinimale(u.role);
      if (nouveau.length < minimum) throw new ErreurHttp(400, `Ton code secret doit faire au moins ${minimum} caractères.`);
      if (!codeSecretAcceptable(nouveau)) throw new ErreurHttp(400, "Ce code est trop facile à deviner. Évite les suites comme 123456 ou 111111.");
      // Première connexion : le mot de passe provisoire vient d'être saisi, pas besoin de le redemander.
      if (!u.doitChangerMotDePasse) {
        if (!actuel || !(await verifier(actuel, u.motDePasseHash))) {
          throw new ErreurHttp(400, "Ton mot de passe actuel n'est pas le bon.");
        }
      }
      if (actuel && actuel === nouveau) throw new ErreurHttp(400, "Choisis un mot de passe différent de l'actuel.");
      await db
        .update(utilisateurs)
        .set({ motDePasseHash: await hacher(nouveau), doitChangerMotDePasse: false, motDePasseExpireLe: null })
        .where(eq(utilisateurs.id, u.id));
      await db.insert(journal).values({ utilisateurId: u.id, action: "mot_de_passe_change" });
      await fermerAutresSessions(u.id, req.sessionID);
      oublierUtilisateur(u.id);
      res.json({ ok: true });
    }),
  );
}
