// Révision sans réseau : le paquet de cartes est gardé sur le téléphone
// (stockage local, propre à chaque compte), les réponses s'y accumulent puis
// partent en un seul lot par la file d'envoi hors ligne (lib/file-envoi.ts).
// Chaque réponse porte une clé unique : un lot renvoyé n'est jamais compté
// deux fois, et l'heure du serveur (lib/horloge.ts) fait compter une réponse
// faite sans réseau pour le jour où elle a été faite.
import { get } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { envoyerOuMettreEnFile } from "@/lib/file-envoi";
import { maintenantServeur } from "@/lib/horloge";
import { lireLocal, ecrireLocal } from "@/modules/pwa/outils";
import { jourLocal, type Jour } from "@shared/engagement/calendrier";
import { REPONSES_PAR_LOT, type CarteDto, type OrigineReponse, type PaquetRevision, type ReponseRevisionEnvoi } from "@shared/engagement/revision";
import { registreDe } from "@shared/textes";
import { t } from "@shared/textes/revision";

/** Le paquet tel qu'il est gardé : avec les cartes déjà répondues sur ce téléphone (carte → juste). */
export type PaquetLocal = PaquetRevision & { repondues: Record<string, boolean> };
type EnAttente = ReponseRevisionEnvoi & { juste: boolean };
type MoiMin = { id: number; role: string; fuseau: string | null };

/** Utilisé depuis l'écran /reviser : le campus prépare le paquet du jour au démarrage (une fois par jour). */
export const CLE_UTILISEE = "campus:revision:utilisee";
const clePaquet = (uid: number, seanceId?: number | null) => `campus:revision:paquet:${uid}${seanceId ? `:s${seanceId}` : ""}`;
const cleAttente = (uid: number) => `campus:revision:attente:${uid}`;

export const moiCourant = () => queryClient.getQueryData<MoiMin | null>(["/api/auth/moi"]) ?? null;
export const jourDuTelephone = (fuseau: string | null | undefined): Jour => jourLocal(maintenantServeur(), fuseau ?? null);

function lireJson<T>(cle: string): T | null {
  try {
    const brut = lireLocal(cle);
    return brut ? (JSON.parse(brut) as T) : null;
  } catch {
    return null;
  }
}

export const lirePaquet = (uid: number, seanceId?: number | null) => lireJson<PaquetLocal>(clePaquet(uid, seanceId));
const ecrirePaquet = (p: PaquetLocal) => ecrireLocal(clePaquet(p.utilisateurId, p.seanceId), JSON.stringify(p));
const lireAttente = (uid: number) => lireJson<EnAttente[]>(cleAttente(uid)) ?? [];
const ecrireAttente = (uid: number, liste: EnAttente[]) => ecrireLocal(cleAttente(uid), liste.length ? JSON.stringify(liste) : null);

/** Poids du paquet gardé (Ko), affiché sur l'écran. */
export const poidsKo = (p: PaquetRevision) => Math.max(1, Math.round(new Blob([JSON.stringify(p)]).size / 1024));

/** Réponses du téléphone pas encore enregistrées par le campus. */
export const reponsesEnAttente = (uid: number) => lireAttente(uid).length;

/**
 * Télécharge le paquet (ou le reprend s'il est déjà là, inchangé). Les réponses
 * encore en attente d'envoi restent marquées : la carte n'est pas reposée.
 */
export async function telechargerPaquet(uid: number, seanceId?: number | null): Promise<PaquetLocal> {
  const recu = await get<PaquetRevision>(`/api/revision/paquet${seanceId ? `?seance=${seanceId}` : ""}`);
  const local = lirePaquet(uid, seanceId);
  // Réponse servie par le cache du service worker (pas de réseau) : c'est le paquet déjà gardé.
  if (local && local.genereLe === recu.genereLe) return local;
  const repondues: Record<string, boolean> = {};
  for (const r of lireAttente(uid)) repondues[r.carteId] = r.juste;
  const paquet: PaquetLocal = { ...recu, repondues };
  ecrirePaquet(paquet);
  return paquet;
}

/** Note une réponse sur le téléphone (elle partira avec les autres). QCM : position affichée choisie ; fiche : « Je savais ». */
export function noterReponse(paquet: PaquetLocal, carte: CarteDto, origine: OrigineReponse, reponse: { choixAffiche: number } | { savait: boolean }): { paquet: PaquetLocal; juste: boolean } {
  const reponduLe = maintenantServeur();
  let juste: boolean;
  let envoi: ReponseRevisionEnvoi;
  const cle = `${paquet.utilisateurId}-${carte.id}-${reponduLe}-${Math.random().toString(36).slice(2, 8)}`;
  if ("choixAffiche" in reponse) {
    juste = reponse.choixAffiche === carte.bonne;
    envoi = { carteId: carte.id, origine, choix: carte.ordre?.[reponse.choixAffiche] ?? reponse.choixAffiche, reponduLe, cle };
  } else {
    juste = reponse.savait;
    envoi = { carteId: carte.id, origine, savait: reponse.savait, reponduLe, cle };
  }
  ecrireAttente(paquet.utilisateurId, [...lireAttente(paquet.utilisateurId), { ...envoi, juste }]);
  const suivant: PaquetLocal = { ...paquet, repondues: { ...paquet.repondues, [carte.id]: juste } };
  ecrirePaquet(suivant);
  return { paquet: suivant, juste };
}

/**
 * Réponse donnée dans le cours complet (quiz, fiches) : elle compte dans la
 * révision comme les autres. choix : index d'origine de l'option choisie.
 */
export function noterReponseCoursComplet(carteId: number, reponse: { choix: number } | { savait: boolean }, juste: boolean) {
  const moi = moiCourant();
  if (!moi || moi.role !== "etudiant") return;
  const reponduLe = maintenantServeur();
  const cle = `${moi.id}-${carteId}-${reponduLe}-${Math.random().toString(36).slice(2, 8)}`;
  ecrireAttente(moi.id, [...lireAttente(moi.id), { carteId, origine: "cours_complet", ...reponse, reponduLe, cle, juste }]);
}

let envoiEnCours: Promise<"rien" | "envoye" | "en_file"> | null = null;

/**
 * Envoie les réponses en attente, par lots de 40, en passant par la file hors
 * ligne : sans réseau, elles partent toutes seules à son retour.
 */
export function envoyerReponses(): Promise<"rien" | "envoye" | "en_file"> {
  const moi = moiCourant();
  if (!moi || moi.role !== "etudiant") return Promise.resolve("rien");
  envoiEnCours ??= (async () => {
    const attente = lireAttente(moi.id);
    if (!attente.length) return "rien" as const;
    let statut: "envoye" | "en_file" = "envoye";
    const traitees = new Set<string>();
    for (let i = 0; i < attente.length; i += REPONSES_PAR_LOT) {
      const lot = attente.slice(i, i + REPONSES_PAR_LOT).map(({ juste: _j, ...r }) => r);
      try {
        const r = await envoyerOuMettreEnFile({
          cle: `revision:${lot[0].cle}`,
          description: t("file.description", { registre: registreDe(moi.role), v: { n: lot.length } }),
          url: "/api/revision/reponses",
          methode: "POST",
          corps: { reponses: lot },
        });
        if (r.statut === "en_file") statut = "en_file";
      } catch {
        // Refus définitif du campus (carte supprimée, compte changé) : ces réponses ne passeront jamais.
      }
      lot.forEach((r) => traitees.add(r.cle));
    }
    // Les réponses données pendant l'envoi restent en attente pour le prochain lot.
    ecrireAttente(
      moi.id,
      lireAttente(moi.id).filter((r) => !traitees.has(r.cle)),
    );
    if (statut === "envoye") void actualiserApresEnvoi();
    return statut;
  })().finally(() => (envoiEnCours = null));
  return envoiEnCours;
}

/** Après un envoi : le résumé de la révision et l'objectif du jour de l'accueil se remettent à jour. */
export const actualiserApresEnvoi = () => rafraichir("/api/revision/du-jour", "/api/objectif-du-jour");
