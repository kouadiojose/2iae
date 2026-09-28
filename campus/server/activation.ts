// Activation des comptes et nouveaux codes : partagé par le module compte
// (page /activer/:jeton) et le pilotage (fiches de connexion, « Nouveau code »).
import crypto from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { hacher, codeProvisoire, DUREE_CODE_PROVISOIRE_MS, oublierUtilisateur, jetonAleatoire, fermerAutresSessions } from "./auth";
import { reinitialisations, utilisateurs, journal, type Utilisateur } from "@shared/schema";

export const hacherJeton = (jeton: string) => crypto.createHash("sha256").update(jeton).digest("hex");

/** Crée un jeton à usage unique (QR de la fiche de connexion ou lien « code oublié »). */
export async function creerJeton(
  utilisateurId: number,
  type: "activation" | "reinitialisation",
  dureeMs = type === "activation" ? DUREE_CODE_PROVISOIRE_MS : 60 * 60 * 1000,
): Promise<string> {
  const jeton = jetonAleatoire(24);
  await db.insert(reinitialisations).values({
    utilisateurId,
    type,
    jetonHash: hacherJeton(jeton),
    expireLe: new Date(Date.now() + dureeMs),
  });
  return jeton;
}

/** Consomme un jeton valide et renvoie le compte associé (ou null). */
export async function consommerJeton(jeton: string, type: "activation" | "reinitialisation"): Promise<Utilisateur | null> {
  const [ligne] = await db
    .select()
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
  await db.update(reinitialisations).set({ utiliseLe: new Date() }).where(eq(reinitialisations.id, ligne.id));
  const [u] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, ligne.utilisateurId));
  return u?.actif ? u : null;
}

export const lienActivation = (jeton: string) => `${config.urlCampus}/activer/${jeton}`;

/**
 * Nouveau code provisoire à 6 chiffres (valable 30 jours) + jeton QR
 * d'activation. Ferme les sessions en cours. Le code n'est montré qu'une
 * fois : il n'est stocké que haché.
 */
export async function reinitialiserCode(utilisateurId: number, auteurId: number): Promise<{ code: string; jeton: string; lien: string }> {
  const code = codeProvisoire();
  await db
    .update(utilisateurs)
    .set({
      motDePasseHash: await hacher(code),
      doitChangerMotDePasse: true,
      motDePasseExpireLe: new Date(Date.now() + DUREE_CODE_PROVISOIRE_MS),
    })
    .where(eq(utilisateurs.id, utilisateurId));
  // Les anciens jetons d'activation de ce compte deviennent inutilisables.
  await db
    .update(reinitialisations)
    .set({ utiliseLe: new Date() })
    .where(and(eq(reinitialisations.utilisateurId, utilisateurId), isNull(reinitialisations.utiliseLe)));
  const jeton = await creerJeton(utilisateurId, "activation");
  await fermerAutresSessions(utilisateurId);
  await db.insert(journal).values({ utilisateurId: auteurId, action: "nouveau_code", details: { pour: utilisateurId } });
  oublierUtilisateur(utilisateurId);
  return { code, jeton, lien: lienActivation(jeton) };
}
