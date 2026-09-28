// File d'envoi hors ligne : « Le réseau coupe, le campus continue ».
//
// Un devoir rendu ou un message écrit pendant une coupure est rangé dans le
// téléphone (IndexedDB, photos comprises) puis envoyé tout seul au retour du
// réseau. L'étudiant voit « En attente de réseau », puis reçoit son reçu.
import { useEffect, useState } from "react";
import { api, televerser, ErreurApi } from "./api";
import { queryClient } from "./queryClient";

export type ElementFile = {
  cle: string;
  /** Texte affiché à l'étudiant : « Devoir · Business plan ». */
  description: string;
  url: string;
  methode: "POST" | "PUT" | "PATCH";
  corps: Record<string, unknown>;
  /** Fichiers à téléverser d'abord ; leurs identifiants sont ajoutés à corps[champFichiers]. */
  fichiers?: { nom: string; type: string; blob: Blob }[];
  usageFichiers?: "rendu" | "message";
  /** « fichierIds » (tableau) ou « fichierId » (un seul). */
  champFichiers?: string;
  /** Compte qui a préparé l'envoi : sur un téléphone partagé, il ne part jamais au nom d'un autre. */
  utilisateurId?: number;
  creeLe: number;
  tentatives: number;
  derniereErreur?: string;
  /** Trop d'échecs du serveur : on attend une relance manuelle (« Réessayer »). */
  echec?: boolean;
};

/** Au-delà, l'élément passe en « à relancer » au lieu d'être réessayé toutes les minutes (forfaits prépayés). */
const MAX_TENTATIVES = 5;

const BASE = "campus-2iae";
const MAGASIN = "file-envoi";

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(MAGASIN, { keyPath: "cle" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

async function transaction<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await ouvrir();
  return new Promise((ok, ko) => {
    const tx = db.transaction(MAGASIN, mode);
    const r = fn(tx.objectStore(MAGASIN));
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

const moiId = () => queryClient.getQueryData<{ id: number } | null>(["/api/auth/moi"])?.id;

const listerTout = () => transaction<ElementFile[]>("readonly", (s) => s.getAll() as IDBRequest<ElementFile[]>);
/** Éléments de la personne connectée (ceux d'un autre compte attendent son retour). */
export const listerFile = async () => {
  const id = moiId();
  return (await listerTout()).filter((e) => e.utilisateurId === undefined || e.utilisateurId === id);
};
const ecrire = (e: ElementFile) => transaction("readwrite", (s) => s.put(e));
const retirer = (cle: string) => transaction("readwrite", (s) => s.delete(cle));

const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

type Resultat<T> = { statut: "envoye"; reponse: T } | { statut: "en_file" };

/** Téléverse les fichiers de l'élément et renvoie l'élément à jour (identifiants dans le corps, plus de fichiers à renvoyer). */
async function televerserFichiers(e: ElementFile): Promise<ElementFile> {
  if (!e.fichiers?.length) return e;
  const recus = await televerser(
    e.fichiers.map((f) => new File([f.blob], f.nom, { type: f.type })),
    e.usageFichiers ?? "rendu",
  );
  const corps = { ...e.corps };
  const champ = e.champFichiers ?? "fichierIds";
  const existants = Array.isArray(corps[champ]) ? (corps[champ] as number[]) : [];
  corps[champ] = champ === "fichierId" ? recus[0]?.id : [...existants, ...recus.map((r) => r.id)];
  return { ...e, corps, fichiers: undefined };
}

type NatureErreur = "reseau" | "serveur" | "connexion" | "refus";
function natureErreur(e: unknown): NatureErreur {
  if (!(e instanceof ErreurApi)) return "reseau";
  if (e.statut === 0) return "reseau";
  if (e.statut === 401) return "connexion"; // session fermée : on attend la reconnexion, rien n'est perdu
  if (e.statut >= 500 || e.statut === 408 || e.statut === 429) return "serveur";
  return "refus";
}

/**
 * Envoie tout de suite si possible ; sinon range dans la file et renvoie
 * { statut: "en_file" }. Les refus du serveur (400, 403, 409…) sont levés.
 */
export async function envoyerOuMettreEnFile<T = unknown>(
  e: Omit<ElementFile, "creeLe" | "tentatives" | "fichiers" | "utilisateurId"> & { fichiers?: File[] },
): Promise<Resultat<T>> {
  let element: ElementFile = {
    ...e,
    fichiers: e.fichiers?.map((f) => ({ nom: f.name, type: f.type, blob: f })),
    utilisateurId: moiId(),
    creeLe: Date.now(),
    tentatives: 0,
  };
  if (navigator.onLine) {
    try {
      element = await televerserFichiers(element);
      return { statut: "envoye", reponse: await api<T>(element.url, { methode: element.methode, corps: element.corps }) };
    } catch (err) {
      if (natureErreur(err) === "refus") throw err;
    }
  }
  await ecrire(element);
  prevenir();
  demanderSynchronisation();
  return { statut: "en_file" };
}

let enCours = false;

/** Vide la file (appelé au retour du réseau, au démarrage et régulièrement). */
export async function viderFile(surEnvoi?: (e: ElementFile, reponse: unknown) => void) {
  if (enCours || !navigator.onLine || !moiId()) return;
  enCours = true;
  try {
    for (const initial of await listerFile()) {
      if (initial.echec) continue;
      let e = initial;
      try {
        if (e.fichiers?.length) {
          e = await televerserFichiers(e);
          await ecrire(e); // les photos ne seront plus renvoyées si la suite échoue
        }
        const reponse = await api(e.url, { methode: e.methode, corps: e.corps });
        await retirer(e.cle);
        surEnvoi?.(e, reponse);
        window.dispatchEvent(new CustomEvent("campus:envoi-reussi", { detail: { cle: e.cle, description: e.description, reponse } }));
      } catch (err) {
        const nature = natureErreur(err);
        if (nature === "refus") {
          // Refus définitif (délai dépassé, droits…) : on retire et on prévient.
          await retirer(e.cle);
          window.dispatchEvent(new CustomEvent("campus:envoi-refuse", { detail: { cle: e.cle, description: e.description, message: (err as Error).message } }));
        } else if (nature === "serveur") {
          const tentatives = e.tentatives + 1;
          await ecrire({ ...e, tentatives, derniereErreur: (err as Error).message, echec: tentatives >= MAX_TENTATIVES });
          // Un élément en difficulté ne bloque pas les suivants.
        } else {
          // Plus de réseau, ou session fermée : on s'arrête là et on reprendra plus tard.
          await ecrire({ ...e, derniereErreur: (err as Error).message });
          break;
        }
      }
    }
  } finally {
    enCours = false;
    prevenir();
  }
}

/** Relance manuelle d'un élément en échec. */
export async function relancerEnvoi(cle: string) {
  const e = (await listerFile()).find((x) => x.cle === cle);
  if (!e) return;
  await ecrire({ ...e, echec: false, tentatives: 0 });
  prevenir();
  await viderFile();
}

/** Abandon d'un élément (après confirmation de l'étudiant). */
export async function abandonnerEnvoi(cle: string) {
  await retirer(cle);
  prevenir();
}

function demanderSynchronisation() {
  // Background Sync quand le navigateur le permet (Chrome Android), sinon au retour du réseau.
  navigator.serviceWorker?.ready
    .then((reg) => (reg as ServiceWorkerRegistration & { sync?: { register: (t: string) => Promise<void> } }).sync?.register("file-envoi"))
    .catch(() => undefined);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void viderFile());
  setInterval(() => void viderFile(), 60_000);
  setTimeout(() => void viderFile(), 3_000);
  navigator.serviceWorker?.addEventListener?.("message", (m) => {
    if (m.data === "file-envoi") void viderFile();
  });
}

/** Éléments en attente d'envoi (pour le bandeau « 2 envois en attente de réseau »). */
export function useFileEnvoi() {
  const [elements, setElements] = useState<ElementFile[]>([]);
  useEffect(() => {
    const maj = () => void listerFile().then(setElements).catch(() => setElements([]));
    maj();
    abonnes.add(maj);
    return () => void abonnes.delete(maj);
  }, []);
  return elements;
}
