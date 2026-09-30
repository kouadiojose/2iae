// Guide de bienvenue : dès qu'un formateur (ou un membre de l'équipe) a créé
// son compte, il reçoit par e-mail ses identifiants et le campus pas à pas,
// avec le guide complet en PDF joint (celui de client/public/guides).
import fs from "fs/promises";
import path from "path";
import { config, estProduction } from "./config";
import { emailDisponible, envoyerEmail, emailGuideBienvenue, emailGuideEtudiant, type PieceJointe } from "./mail";
import type { Utilisateur } from "@shared/schema";

/** Au-delà, le PDF n'est pas joint (le lien suffit) : certaines messageries refusent les gros e-mails. */
const TAILLE_MAX_PDF = 8 * 1024 * 1024;

const guideDuRole = (role: Utilisateur["role"]) =>
  role === "formateur"
    ? { fichier: "guide-formateurs.pdf", nom: "Guide du formateur · Campus 2IAE.pdf" }
    : role === "etudiant"
      ? { fichier: "guide-etudiants.pdf", nom: "Guide de l'étudiant · Campus 2IAE.pdf" }
      : { fichier: "guide-administration.pdf", nom: "Guide de l'administration · Campus 2IAE.pdf" };

const enMemoire = new Map<string, Buffer | null>();

/** Le PDF du guide, lu une fois : dist/public en production, client/public en développement. */
async function lirePdf(fichier: string): Promise<Buffer | null> {
  if (enMemoire.has(fichier)) return enMemoire.get(fichier) ?? null;
  const candidats = [
    path.resolve(import.meta.dirname, "public", "guides", fichier),
    path.resolve(process.cwd(), "dist", "public", "guides", fichier),
    path.resolve(process.cwd(), "client", "public", "guides", fichier),
  ];
  let contenu: Buffer | null = null;
  for (const c of candidats) {
    const b = await fs.readFile(c).catch(() => null);
    if (b && b.length <= TAILLE_MAX_PDF) {
      contenu = b;
      break;
    }
  }
  enMemoire.set(fichier, contenu);
  return contenu;
}

/** Envoie le guide de bienvenue à l'adresse du compte. Ne lève jamais : renvoie vrai si l'e-mail est parti. */
export async function envoyerGuideBienvenue(
  u: Pick<Utilisateur, "prenom" | "nom" | "role" | "email"> & { matricule?: string | null; classeNom?: string | null },
  premierCours: string | null,
): Promise<boolean> {
  if (!u.email) return false;
  try {
    const guide = guideDuRole(u.role);
    const pdf = await lirePdf(guide.fichier);
    const pieces: PieceJointe[] = pdf ? [{ nom: guide.nom, contenu: pdf }] : [];
    const lienPdf = `${config.urlCampus}/guides/${guide.fichier}`;
    const e =
      u.role === "etudiant"
        ? emailGuideEtudiant({ prenom: u.prenom, matricule: u.matricule ?? "", classe: u.classeNom ?? null, premierCours, pdfJoint: pieces.length > 0, lienPdf })
        : emailGuideBienvenue({ personne: u, email: u.email, premierCours, pdfJoint: pieces.length > 0, lienPdf });
    if (!emailDisponible()) {
      if (!estProduction) console.log(`[bienvenue] (dev) e-mail non envoyé à ${u.email} : « ${e.sujet} »${pieces.length ? " avec le PDF" : ""}`);
      return false;
    }
    return await envoyerEmail({ a: u.email, sujet: e.sujet, texte: e.texte, html: e.html, pieces });
  } catch (x) {
    console.error("[bienvenue] guide non envoyé :", (x as Error).message);
    return false;
  }
}
