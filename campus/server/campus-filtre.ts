// Le compte de campus (profil « Chargé du campus », rôle vie scolaire : ext-profils.ts) est l'écran des salles d'un
// campus, partagé par tous ses ordinateurs : il ne doit rien ouvrir d'autre que son espace (/api/mon-campus), la classe
// qu'il montre (comme l'écran d'une salle : chaque route de séance garde ses propres contrôles, roleDans le traite en
// salle), les leçons et résumés des cours de son campus, et ce dont toute page a besoin (connexion, temps réel,
// fichiers protégés par leur gardien). REFUS PAR DÉFAUT : une route oubliée ici répond 403 au lieu d'ouvrir le
// pilotage, l'emploi du temps, l'assistant IA ou la bibliothèque à tous les ordinateurs des salles (relecture du
// 15 octobre 2026 : plusieurs routes de pilotage ne contrôlaient que le rôle vie scolaire).
//
// Ses gestes de chargé du campus (15 octobre 2026 à 5 h) passent TOUS par /api/mon-campus (routes/espace-campus.ts) :
// ouvrir la salle, ajouter un PowerPoint (…/seances/:id/diapos), une vidéo (…/videos, …/videos/fichiers), retirer ses
// propres vidéos (…/ressources/:rid), montrer une vidéo quand son campus est le seul du cours (…/projection), fermer sa
// salle (…/fermer-salle), terminer le cours quand c'est sans danger (…/terminer). Chacune vérifie le cours, le campus et
// la séance, et journalise : aucune ligne n'est ajoutée ici. Les routes du formateur (/api/seances/:id/diapos,
// /ressources, /projection, /terminer, /demarrer, /diapo, /lien-intervenant) gardent leur refus (seanceAnimee : 403),
// comme POST /api/fichiers (refusé ici).
//
// Le code secret du campus est donné par la direction (« Nouveau code », routes/admin.ts) : le compte ne le change pas
// lui-même (sauf le premier choix d'un compte créé par lien d'invitation), ne ferme pas les sessions des autres
// ordinateurs et ne change pas son e-mail.
import type { NextFunction, Request, Response } from "express";
import { estProfilCampus } from "@shared/schema";

type Ouverte = { motif: RegExp; lecture?: boolean };

/** Routes de l'API ouvertes au compte de campus (lecture : GET et HEAD seulement). */
const OUVERTES: Ouverte[] = [
  { motif: /^\/api\/auth\// }, // connexion, moi, déconnexion (le changement de code est filtré ci-dessous)
  { motif: /^\/api\/mon-campus(\/|$)/ },
  { motif: /^\/api\/flux(\/|$)/ },
  { motif: /^\/api\/fichiers\/\d+/, lecture: true },
  { motif: /^\/api\/health$/, lecture: true },
  { motif: /^\/api\/public\//, lecture: true },
  { motif: /^\/api\/push\/(cle|etat|abonnement)$/ },
  { motif: /^\/api\/compte\/parcours$/, lecture: true }, // premier choix du code (compte créé par lien d'invitation)
  // Les leçons et les résumés des cours de son campus (périmètre : acces.ts, coursDuCampus).
  { motif: /^\/api\/cours\/\d+(\/lecons\/\d+)?$/, lecture: true },
  { motif: /^\/api\/revision\/cours\/\d+$/, lecture: true },
  // La classe qu'il montre, comme l'écran d'une salle (direct, diapo, code, mains, groupes, rejoindre…).
  { motif: /^\/api\/seances\/\d+(\/|$)/ },
  { motif: /^\/api\/radio\/\d+(\/|$)/ },
  { motif: /^\/api\/coupe\/salle$/, lecture: true },
  { motif: /^\/api\/visio\/(options|ice)$/, lecture: true },
  { motif: /^\/api\/visio\/\d+\/(rejoindre|battement|quitter|signal)$/ },
  { motif: /^\/api\/visio\/essai\// },
  // Le lien de la réunion de l'administration reste public : le compte de campus y entre comme tout invité (il tape un
  // nom). Les routes qui la règlent (/api/pilotage/reunions) restent refusées.
  { motif: /^\/api\/reunion\/[^/]+(\/entrer)?$/ },
];

const CODE_DE_LA_DIRECTION = "Le code du campus est donné par la direction. Demandez-lui un nouveau code.";
const refusVus = new Set<string>();

/** Intergiciel posé avant toutes les routes de l'API (routes/index.ts). Sans effet pour les autres comptes. */
export function filtreCompteCampus(req: Request, res: Response, next: NextFunction) {
  const u = req.utilisateur;
  if (!u || !estProfilCampus(u)) return next();
  const chemin = req.path.startsWith("/api") ? req.path : `/api${req.path}`;
  // Le code est permanent : seul le premier choix (compte créé par lien d'invitation) passe.
  if (chemin === "/api/auth/mot-de-passe" && !u.doitChangerMotDePasse) return res.status(403).json({ message: CODE_DE_LA_DIRECTION });
  const lecture = req.method === "GET" || req.method === "HEAD";
  if (OUVERTES.some((o) => o.motif.test(chemin) && (!o.lecture || lecture))) return next();
  const cle = `${req.method} ${chemin.replace(/\d+/g, ":n")}`;
  if (!refusVus.has(cle) && refusVus.size < 500) {
    refusVus.add(cle);
    console.warn(`[campus] route refusée au compte de campus : ${cle}`);
  }
  const code = chemin === "/api/compte/deconnecter-partout" || chemin === "/api/compte/profil";
  return res.status(403).json({ message: code ? CODE_DE_LA_DIRECTION : "Cette page n'est pas pour le compte du campus." });
}
