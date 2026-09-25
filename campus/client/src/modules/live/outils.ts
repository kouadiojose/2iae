// Outils du module live : consommation affichée honnêtement, libellés,
// état du direct tenu à jour par le temps réel (canal « seance:<id> »).
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { useCanal, useFluxConnecte, type EvenementFlux } from "@/lib/flux";
import { get } from "@/lib/api";
import type {
  EtatDirectDto,
  QuestionDirectDto,
  SeanceDetailDto,
  ModeSuivi,
  MainDirectDto,
  StatutPresence,
  FournisseurVisio,
  StatutSeance,
} from "@shared/schema";

// ── Consommation de données (CONCEPTION §9.14, mise à jour « radio ») ──────

export const CONSOMMATION: Record<ModeSuivi, { titre: string; resume: string; moParHeure: [number, number]; detail: string }> = {
  radio: {
    titre: "Son + diapos",
    resume: "≈ 12 à 15 Mo par heure",
    moParHeure: [12, 15],
    detail: "Tu entends le formateur et tu vois ses diapos. Recommandé en 3G/4G.",
  },
  video: {
    titre: "Vidéo",
    resume: "150 à 250 Mo par heure",
    moParHeure: [150, 250],
    detail: "Tu vois le formateur et les salles. À réserver au Wi-Fi ou à un gros forfait.",
  },
  compagnon: {
    titre: "Je suis dans la salle de conférence",
    resume: "moins de 5 Mo par heure",
    moParHeure: [2, 5],
    detail: "Le son et l'image passent par l'écran de la salle. Ton téléphone sert à voter, poser tes questions et répondre aux sondages.",
  },
};

/** Estimation en Mo d'après le mode et la durée (quand rien n'a pu être mesuré). */
export function estimationMo(mode: ModeSuivi, secondes: number): number {
  const [bas, haut] = CONSOMMATION[mode].moParHeure;
  return ((bas + haut) / 2) * (secondes / 3600);
}

/** Octets réellement téléchargés par la page depuis un instant (API, diapos, images). */
export function octetsMesuresDepuis(depuisMs: number): number {
  if (typeof performance === "undefined" || !performance.getEntriesByType) return 0;
  const origine = performance.timeOrigin;
  let total = 0;
  for (const e of performance.getEntriesByType("resource") as PerformanceResourceTiming[]) {
    if (origine + e.startTime >= depuisMs) total += e.transferSize || 0;
  }
  return total;
}

export function formatMo(mo: number): string {
  if (mo < 1) return "moins de 1 Mo";
  if (mo < 10) return `${mo.toFixed(1).replace(".", ",")} Mo`;
  return `${Math.round(mo)} Mo`;
}

// ── Libellés ───────────────────────────────────────────────────────────────

export const LIBELLES_FOURNISSEUR: Record<FournisseurVisio, string> = {
  campus: "Visio du campus",
  daily: "Daily",
  jitsi: "Jitsi",
  externe: "Lien externe",
  demo: "Démonstration",
};

export const DESCRIPTION_FOURNISSEUR: Record<FournisseurVisio, string> = {
  campus: "Intégrée au campus, sans compte externe. Recommandée.",
  daily: "Visio Daily.co intégrée, avec enregistrement du replay.",
  jitsi: "Salle sur le serveur Jitsi de l'école.",
  externe: "Zoom, Meet ou Teams : les étudiants ouvrent votre lien.",
  demo: "Sans visio : scène simulée pour essayer le studio.",
};

export const LIBELLES_STATUT_SEANCE: Record<StatutSeance, string> = {
  planifiee: "À venir",
  en_direct: "En direct",
  terminee: "Terminée",
  annulee: "Annulée",
};

export const LIBELLES_PRESENCE: Record<StatutPresence, string> = {
  salle: "Présent en salle",
  en_ligne: "Présent en ligne",
  retard: "En retard",
  partiel: "Partiel",
  absent: "Absent",
  justifie: "Absent justifié",
  incident: "Incident de salle",
};

export const RESSENTIS_UI = [
  { valeur: "compris", libelle: "Compris", emoji: "👍" },
  { valeur: "perdu", libelle: "Perdu", emoji: "😕" },
  { valeur: "lent", libelle: "Plus lentement", emoji: "🐢" },
  { valeur: "bravo", libelle: "Bravo", emoji: "👏" },
] as const;

/** « 00:42:17 » */
export function chrono(secondes: number): string {
  const s = Math.max(0, Math.floor(secondes));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}

/** « 12:05 » (minutes:secondes depuis le début), pour les sous-titres et la transcription. */
export function minutage(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor(t / 60) % 60;
  const s = t % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** Retire accents et majuscules (recherche dans la transcription). */
export const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ── Données de la séance ───────────────────────────────────────────────────

export const cleSeance = (id: number) => [`/api/seances/${id}`];
export const cleDirect = (id: number) => [`/api/seances/${id}/direct`];

export function useSeance(id: number) {
  return useQuery<SeanceDetailDto>({ queryKey: cleSeance(id), staleTime: 15_000 });
}

const trierQuestions = (a: QuestionDirectDto, b: QuestionDirectDto) =>
  Number(b.epinglee) - Number(a.epinglee) || Number(a.repondue) - Number(b.repondue) || b.votes - a.votes || a.id - b.id;

/** Ajoute ou remplace une question en gardant les informations personnelles (mon vote, la mienne). */
export function fusionnerQuestion(etat: EtatDirectDto, q: QuestionDirectDto, local?: Partial<QuestionDirectDto>): EtatDirectDto {
  const existante = etat.questions.find((x) => x.id === q.id);
  const fusion: QuestionDirectDto = existante
    ? { ...existante, ...q, jaiVote: local?.jaiVote ?? existante.jaiVote, mienne: local?.mienne ?? existante.mienne, auteurReel: existante.auteurReel ?? q.auteurReel }
    : { ...q, ...local };
  const questions = existante ? etat.questions.map((x) => (x.id === q.id ? fusion : x)) : [...etat.questions, fusion];
  return { ...etat, questions: questions.sort(trierQuestions) };
}

/** Applique un événement temps réel à l'état du direct. */
function appliquer(etat: EtatDirectDto, e: EvenementFlux, privilegie: boolean): EtatDirectDto {
  const d = e.data;
  switch (e.type) {
    case "statut":
      return { ...etat, statut: d.statut, demarreeLe: d.demarreeLe ?? etat.demarreeLe, motifAnnulation: d.motif ?? etat.motifAnnulation };
    case "question":
      return fusionnerQuestion(etat, d as QuestionDirectDto);
    case "question:votes":
      return { ...etat, questions: etat.questions.map((q) => (q.id === d.id ? { ...q, votes: d.votes } : q)).sort(trierQuestions) };
    case "question:maj": {
      if (d.masquee && !privilegie) return { ...etat, questions: etat.questions.filter((q) => q.id !== d.id) };
      return { ...etat, questions: etat.questions.map((q) => (q.id === d.id ? { ...q, ...d } : q)).sort(trierQuestions) };
    }
    case "parole":
      return { ...etat, parole: d };
    case "sondage": {
      if (etat.sondage && etat.sondage.id === d.id) return { ...etat, sondage: { ...d, monChoix: etat.sondage.monChoix } };
      return { ...etat, sondage: { ...d, monChoix: null }, resultats: null };
    }
    case "resultats":
      return etat.sondage?.id === d.sondageId ? { ...etat, resultats: d } : etat;
    case "barometre":
      return { ...etat, barometre: d };
    case "campus":
      return { ...etat, campus: d.campus, enLigne: d.enLigne };
    case "effectifs":
      return { ...etat, campus: etat.campus.map((c) => (c.siteId === d.siteId ? { ...c, effectif: d.nombre, prete: d.prete, incident: d.incident } : c)) };
    case "sous-titre":
      return etat.sousTitres.some((s) => s.id === d.id) ? etat : { ...etat, sousTitres: [...etat.sousTitres, d].slice(-60) };
    case "diapo":
      return { ...etat, diapo: d };
    case "planb":
      return { ...etat, planB: d.lien };
    default:
      return etat;
  }
}

/**
 * État du direct : un appel au départ, puis chaque événement du canal
 * « seance:<id> » le met à jour sans rien recharger. Au retour du réseau,
 * l'état complet est relu (rien n'est perdu pendant une coupure).
 */
export function useEtatDirect(seanceId: number, privilegie: boolean, surEvenement?: (e: EvenementFlux) => void) {
  const cle = cleDirect(seanceId);
  const requete = useQuery<EtatDirectDto>({ queryKey: cle, refetchInterval: 60_000, staleTime: 5_000 });
  const relire = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relireBientot = () => {
    if (relire.current) return;
    relire.current = setTimeout(() => {
      relire.current = null;
      void queryClient.invalidateQueries({ queryKey: cle });
    }, 400);
  };

  useCanal(`seance:${seanceId}`, (e) => {
    queryClient.setQueryData<EtatDirectDto>(cle, (etat) => (etat ? appliquer(etat, e, privilegie) : etat));
    // Le formateur reçoit la file nominative et les auteurs réels par un appel dédié.
    if (privilegie && (e.type === "mains" || e.type === "question" || e.type === "question:signalee")) relireBientot();
    if (e.type === "mains" && !privilegie) {
      void get<MainDirectDto[]>(`/api/seances/${seanceId}/mains`).then((mains) =>
        queryClient.setQueryData<EtatDirectDto>(cle, (etat) => (etat ? { ...etat, mains } : etat)),
      );
    }
    if (e.type === "statut" || e.type === "seance" || e.type === "planb" || e.type === "fiche") void rafraichir(`/api/seances/${seanceId}`);
    surEvenement?.(e);
  });

  // Reconnexion du temps réel : on relit tout.
  const connecte = useFluxConnecte();
  const etaitConnecte = useRef(connecte);
  useEffect(() => {
    if (connecte && !etaitConnecte.current) void queryClient.invalidateQueries({ queryKey: cle });
    etaitConnecte.current = connecte;
  }, [connecte]);

  useEffect(() => () => {
    if (relire.current) clearTimeout(relire.current);
  }, []);

  return requete;
}

/** Garde l'écran allumé (écran de salle, formateur) quand le navigateur le permet. */
export function useEcranAllume(actif = true) {
  useEffect(() => {
    if (!actif || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let verrou: { release: () => Promise<void> } | null = null;
    let fini = false;
    const demander = async () => {
      try {
        verrou = await (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
      } catch {
        /* refusé (économie d'énergie) : sans conséquence */
      }
    };
    void demander();
    const surVisibilite = () => {
      if (document.visibilityState === "visible" && !fini) void demander();
    };
    document.addEventListener("visibilitychange", surVisibilite);
    return () => {
      fini = true;
      document.removeEventListener("visibilitychange", surVisibilite);
      void verrou?.release().catch(() => undefined);
    };
  }, [actif]);
}
