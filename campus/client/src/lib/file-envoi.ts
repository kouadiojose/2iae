// File d'envoi hors ligne : « Le réseau coupe, le campus continue ».
//
// Un devoir rendu ou un message écrit pendant une coupure est rangé dans le
// téléphone (IndexedDB, photos comprises) puis envoyé tout seul au retour du
// réseau. L'étudiant voit « En attente de réseau », puis reçoit son reçu.
import { useEffect, useState } from "react";
import { api, televerser, ErreurApi } from "./api";

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
  creeLe: number;
  tentatives: number;
  derniereErreur?: string;
};

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

export const listerFile = () => transaction<ElementFile[]>("readonly", (s) => s.getAll() as IDBRequest<ElementFile[]>);
const ecrire = (e: ElementFile) => transaction("readwrite", (s) => s.put(e));
const retirer = (cle: string) => transaction("readwrite", (s) => s.delete(cle));

const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

type Resultat<T> = { statut: "envoye"; reponse: T } | { statut: "en_file" };

async function executer<T>(e: ElementFile): Promise<T> {
  const corps = { ...e.corps };
  if (e.fichiers?.length) {
    const recus = await televerser(
      e.fichiers.map((f) => new File([f.blob], f.nom, { type: f.type })),
      e.usageFichiers ?? "rendu",
    );
    const champ = e.champFichiers ?? "fichierIds";
    const existants = Array.isArray(corps[champ]) ? (corps[champ] as number[]) : [];
    corps[champ] = champ === "fichierId" ? recus[0]?.id : [...existants, ...recus.map((r) => r.id)];
  }
  return api<T>(e.url, { methode: e.methode, corps });
}

/** Une erreur « réseau » (on réessaiera) plutôt qu'un refus du serveur (inutile de réessayer). */
const estErreurReseau = (e: unknown) => e instanceof ErreurApi ? e.statut === 0 || e.statut >= 500 : true;

/**
 * Envoie tout de suite si possible ; sinon range dans la file et renvoie
 * { statut: "en_file" }. Les erreurs du serveur (400, 403…) sont levées.
 */
export async function envoyerOuMettreEnFile<T = unknown>(
  e: Omit<ElementFile, "creeLe" | "tentatives" | "fichiers"> & { fichiers?: File[] },
): Promise<Resultat<T>> {
  const element: ElementFile = {
    ...e,
    fichiers: e.fichiers?.map((f) => ({ nom: f.name, type: f.type, blob: f })),
    creeLe: Date.now(),
    tentatives: 0,
  };
  if (navigator.onLine) {
    try {
      return { statut: "envoye", reponse: await executer<T>(element) };
    } catch (err) {
      if (!estErreurReseau(err)) throw err;
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
  if (enCours || !navigator.onLine) return;
  enCours = true;
  try {
    for (const e of await listerFile()) {
      try {
        const reponse = await executer(e);
        await retirer(e.cle);
        surEnvoi?.(e, reponse);
        window.dispatchEvent(new CustomEvent("campus:envoi-reussi", { detail: { cle: e.cle, description: e.description, reponse } }));
      } catch (err) {
        if (!estErreurReseau(err)) {
          // Refus définitif (délai dépassé, droits…) : on retire et on prévient.
          await retirer(e.cle);
          window.dispatchEvent(new CustomEvent("campus:envoi-refuse", { detail: { cle: e.cle, description: e.description, message: (err as Error).message } }));
        } else {
          await ecrire({ ...e, tentatives: e.tentatives + 1, derniereErreur: (err as Error).message });
          break;
        }
      }
    }
  } finally {
    enCours = false;
    prevenir();
  }
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
