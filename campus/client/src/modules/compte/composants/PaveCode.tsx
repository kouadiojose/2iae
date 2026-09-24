// Pavé numérique géant dessiné par l'application, comme Orange Money ou Wave :
// on ne dépend pas du clavier du téléphone (qui cache la moitié de l'écran),
// 12 touches de 64 px au moins, 6 ronds qui se remplissent.
//
// mode « choix »  : saisie + confirmation, codes trop simples refusés ;
// mode « saisie » : une seule saisie (code actuel avant un changement).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Delete, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { codeAcceptable } from "../outils";

type Props = {
  mode: "choix" | "saisie";
  titre: ReactNode;
  titreConfirmation?: ReactNode;
  aide?: ReactNode;
  longueur?: number;
  /** Appelé quand le code est complet (et confirmé en mode « choix »). */
  onTermine: (code: string) => void | Promise<void>;
  /** Envoi en cours : le pavé est gelé. */
  occupe?: boolean;
  /** Message du serveur (code refusé…) : le pavé repart de zéro et l'affiche. */
  erreur?: string | null;
  /** Incrémenter pour remettre le pavé à zéro (après une erreur du serveur). */
  remise?: number;
  className?: string;
};

const TOUCHES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export function PaveCode({ mode, titre, titreConfirmation, aide, longueur = 6, onTermine, occupe, erreur, remise = 0, className }: Props) {
  const [valeur, setValeur] = useState("");
  const [premier, setPremier] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const ronds = useRef<HTMLDivElement>(null);
  const confirmation = premier !== null;

  const secouer = useCallback(() => {
    ronds.current?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-10px)" }, { transform: "translateX(10px)" }, { transform: "translateX(-6px)" }, { transform: "translateX(0)" }],
      { duration: 320, easing: "ease-out" },
    );
    navigator.vibrate?.([60, 40, 60]);
  }, []);

  // Remise à zéro demandée par la page (le serveur a refusé le code).
  useEffect(() => {
    if (!remise) return;
    setValeur("");
    setPremier(null);
    secouer();
  }, [remise, secouer]);

  useEffect(() => {
    if (erreur) setMessage(null);
  }, [erreur]);

  const valider = useCallback(
    (code: string) => {
      if (mode === "saisie") return void onTermine(code);
      if (!confirmation) {
        if (!codeAcceptable(code)) {
          setMessage("Trop facile à deviner. Évite les suites (123456) et les chiffres répétés (111111).");
          setValeur("");
          secouer();
          return;
        }
        setPremier(code);
        setValeur("");
        setMessage(null);
        return;
      }
      if (code !== premier) {
        setMessage("Les deux codes ne sont pas pareils. Recommence depuis le début.");
        setPremier(null);
        setValeur("");
        secouer();
        return;
      }
      void onTermine(code);
    },
    [mode, confirmation, premier, onTermine, secouer],
  );

  // Code complet : petit délai pour voir le dernier rond se remplir, puis on valide.
  // (valider passe par une référence : un nouveau rendu de la page ne relance pas l'envoi.)
  const validerRef = useRef(valider);
  validerRef.current = valider;
  useEffect(() => {
    if (valeur.length !== longueur) return;
    const t = setTimeout(() => validerRef.current(valeur), 160);
    return () => clearTimeout(t);
  }, [valeur, longueur]);

  const taper = useCallback(
    (chiffre: string) => {
      if (occupe) return;
      setMessage(null);
      setValeur((v) => (v.length >= longueur ? v : v + chiffre));
    },
    [occupe, longueur],
  );

  const effacer = useCallback(() => {
    if (occupe) return;
    setValeur((v) => v.slice(0, -1));
  }, [occupe]);

  // Clavier physique (ordinateur) : chiffres et retour arrière.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      if (cible && ["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName)) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        taper(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        effacer();
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [taper, effacer]);

  const texteErreur = message ?? erreur ?? null;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <h2 className="text-center text-[26px] font-black leading-tight tracking-serre sm:text-[30px]">{confirmation ? titreConfirmation ?? "Tape-le une deuxième fois" : titre}</h2>
      {aide && !confirmation && <p className="mt-2 max-w-sm text-center text-base leading-relaxed text-texte-pale">{aide}</p>}
      {confirmation && <p className="mt-2 max-w-sm text-center text-base text-texte-pale">Pour être sûr que tu t'en souviens.</p>}

      <div
        ref={ronds}
        className="mt-6 flex items-center gap-3.5"
        role="status"
        aria-live="polite"
        aria-label={`${valeur.length} chiffre${valeur.length > 1 ? "s" : ""} sur ${longueur}`}
      >
        {Array.from({ length: longueur }, (_, i) => {
          const rempli = i < valeur.length;
          return visible && rempli ? (
            <span key={i} className="grid h-6 w-6 place-items-center text-2xl font-black tabular-nums">
              {valeur[i]}
            </span>
          ) : (
            <span
              key={i}
              className={cn(
                "h-[18px] w-[18px] rounded-full border-2 transition-colors",
                texteErreur && !valeur ? "border-danger" : "border-encre",
                rempli && "border-encre bg-encre",
                rempli && i === valeur.length - 1 && "bg-orange border-orange",
              )}
            />
          );
        })}
      </div>

      <p className={cn("mt-3 min-h-[44px] max-w-sm text-center text-[15px] font-semibold", texteErreur ? "text-danger" : "text-transparent")} role="alert">
        {texteErreur ?? "·"}
      </p>

      <div className="grid w-full max-w-[340px] grid-cols-3 gap-3" aria-label="Pavé numérique">
        {TOUCHES.map((t) => (
          <Touche key={t} onClick={() => taper(t)} disabled={occupe} libelle={t}>
            {t}
          </Touche>
        ))}
        <Touche onClick={() => setVisible((v) => !v)} libelle={visible ? "Cacher le code" : "Voir le code"} discrete>
          {visible ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
        </Touche>
        <Touche onClick={() => taper("0")} disabled={occupe} libelle="0">
          0
        </Touche>
        <Touche onClick={effacer} disabled={occupe || !valeur} libelle="Effacer le dernier chiffre" discrete>
          {occupe ? <Loader2 className="h-6 w-6 animate-spin" /> : <Delete className="h-7 w-7" />}
        </Touche>
      </div>
    </div>
  );
}

function Touche({ children, onClick, disabled, libelle, discrete }: { children: ReactNode; onClick: () => void; disabled?: boolean; libelle: string; discrete?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={libelle}
      className={cn(
        "grid h-16 select-none place-items-center rounded-2xl text-[28px] font-extrabold tabular-nums transition-colors sm:h-[68px]",
        "touch-manipulation active:scale-[0.97] disabled:opacity-40",
        discrete ? "bg-transparent text-texte-doux hover:bg-creme active:bg-creme" : "bg-creme text-encre hover:bg-orange-clair active:bg-orange-peche",
      )}
    >
      {children}
    </button>
  );
}
