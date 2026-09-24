// La voix, sans consommer de données : dictée par la reconnaissance vocale du
// navigateur (Chrome sur Android), lecture à voix haute par la synthèse du
// téléphone. Chaque fonction se cache quand le téléphone ne sait pas le faire.
import { useCallback, useEffect, useRef, useState } from "react";

// La reconnaissance vocale n'est pas (encore) dans les types DOM de TypeScript.
type ResultatReconnaissance = { isFinal: boolean; 0: { transcript: string } };
type EvenementReconnaissance = { resultIndex: number; results: ArrayLike<ResultatReconnaissance> };
type Reconnaissance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: EvenementReconnaissance) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type ConstructeurReconnaissance = new () => Reconnaissance;

function constructeurReconnaissance(): ConstructeurReconnaissance | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstructeurReconnaissance; webkitSpeechRecognition?: ConstructeurReconnaissance };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Dictée en français. `surTexte(texte, definitif)` reçoit la phrase reconnue
 * au fil de la parole ; elle reste modifiable dans le champ avant l'envoi.
 */
export function useDictee(surTexte: (texte: string, definitif: boolean) => void) {
  const disponible = constructeurReconnaissance() !== null;
  const [ecoute, setEcoute] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const reconnaissance = useRef<Reconnaissance | null>(null);
  const rappel = useRef(surTexte);
  rappel.current = surTexte;

  const arreter = useCallback(() => {
    reconnaissance.current?.stop();
  }, []);

  const demarrer = useCallback(() => {
    const Ctor = constructeurReconnaissance();
    if (!Ctor) return;
    setErreur(null);
    const r = new Ctor();
    r.lang = "fr-FR";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let texte = "";
      let definitif = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        texte += e.results[i][0].transcript;
        definitif = e.results[i].isFinal;
      }
      rappel.current(texte.trim(), definitif);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setErreur("Autorise le micro pour dicter ta question.");
      else if (e.error === "no-speech") setErreur("Je n'ai rien entendu. Réessaie en parlant près du téléphone.");
      else if (e.error === "network") setErreur("La dictée a besoin d'internet. Tape ta question à la place.");
    };
    r.onend = () => setEcoute(false);
    reconnaissance.current = r;
    try {
      r.start();
      setEcoute(true);
    } catch {
      setEcoute(false);
    }
  }, []);

  useEffect(() => () => reconnaissance.current?.abort(), []);

  return { disponible, ecoute, erreur, demarrer, arreter };
}

/** Voix française du téléphone (les voix se chargent parfois après coup). null s'il n'y en a pas. */
export function useVoixFrancaise(): SpeechSynthesisVoice | null {
  const [voix, setVoix] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const choisir = () => {
      const liste = window.speechSynthesis.getVoices();
      const fr = liste.filter((v) => v.lang.toLowerCase().startsWith("fr"));
      setVoix(fr.find((v) => v.lang === "fr-FR" && v.localService) ?? fr.find((v) => v.lang === "fr-FR") ?? fr[0] ?? null);
    };
    choisir();
    window.speechSynthesis.addEventListener("voiceschanged", choisir);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", choisir);
  }, []);
  return voix;
}

/** Texte lisible à voix haute : sans Markdown, sources abrégées. */
export function texteParle(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lecture à voix haute d'un texte ; un seul texte lu à la fois dans tout le campus. */
export function useLecture() {
  const voix = useVoixFrancaise();
  const [enLecture, setEnLecture] = useState<string | null>(null);

  const arreter = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setEnLecture(null);
  }, []);

  const lire = useCallback(
    (cle: string, markdown: string) => {
      if (!voix) return;
      window.speechSynthesis.cancel();
      const enonce = new SpeechSynthesisUtterance(texteParle(markdown));
      enonce.voice = voix;
      enonce.lang = voix.lang;
      enonce.rate = 1;
      enonce.onend = () => setEnLecture((c) => (c === cle ? null : c));
      enonce.onerror = () => setEnLecture((c) => (c === cle ? null : c));
      setEnLecture(cle);
      window.speechSynthesis.speak(enonce);
    },
    [voix],
  );

  useEffect(() => () => void ("speechSynthesis" in window && window.speechSynthesis.cancel()), []);

  return { disponible: voix !== null, enLecture, lire, arreter };
}

/** Copie dans le presse-papiers, avec un repli pour les navigateurs sans l'API moderne. */
export async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    const zone = document.createElement("textarea");
    zone.value = texte;
    zone.setAttribute("readonly", "");
    zone.style.position = "fixed";
    zone.style.opacity = "0";
    document.body.appendChild(zone);
    zone.select();
    const ok = document.execCommand("copy");
    zone.remove();
    return ok;
  }
}
