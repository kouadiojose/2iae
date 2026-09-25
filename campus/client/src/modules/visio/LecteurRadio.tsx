// Côté étudiant : écoute la radio du cours (≈ 12 à 15 Mo/h), reprise automatique après coupure.
//
// Un simple <audio> sur l'adresse d'écoute (WebM/Opus en flux continu). Les
// navigateurs n'autorisent le son qu'après un geste : d'où le gros bouton
// « Écouter le cours ». Ensuite tout est automatique : reprise après une
// coupure (essais de plus en plus espacés), relance quand le formateur
// redémarre son émission, rattrapage du retard accumulé.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, Square } from "lucide-react";
import { useMoi } from "@/lib/auth";
import { useCanal } from "@/lib/flux";
import { cn, taille } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import type { EtatRadio, EvenementRadio } from "@shared/schema";
import { lectureRadioPossible } from "./moteur/radio";
import { Pastille } from "./composants";

type Phase = "arret" | "attente" | "connexion" | "direct" | "reconnexion";

/** Débit par défaut (24 kbit/s + enveloppe WebM) tant que le serveur n'a pas mesuré le flux. */
const DEBIT_DEFAUT = 3100;
const PAUSES_REPRISE = [1000, 2000, 4000, 8000, 15000];
/** Retard maximal toléré avant de sauter à la fin de ce qui est déjà reçu. */
const RETARD_MAX_S = 3.5;

export function LecteurRadio({ seanceId, nuit, onConsommation }: { seanceId: number; nuit?: boolean; onConsommation?: (octets: number) => void }) {
  const { moi } = useMoi();
  const tu = !moi || moi.role === "etudiant";
  const audio = useRef<HTMLAudioElement>(null);
  const [phase, setPhaseEtat] = useState<Phase>("arret");
  const phaseRef = useRef<Phase>("arret");
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseEtat(p);
  };
  const essais = useRef(0);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bloque = useRef<ReturnType<typeof setTimeout> | null>(null);
  const octets = useRef(0);
  const [consomme, setConsomme] = useState(0);
  const rappel = useRef(onConsommation);
  rappel.current = onConsommation;
  const possible = lectureRadioPossible();

  const { data: etat, refetch } = useQuery<EtatRadio>({
    queryKey: ["/api/radio", seanceId, "etat"],
    refetchInterval: phase === "attente" ? 6000 : 20_000,
  });
  const debit = useRef(DEBIT_DEFAUT);
  if (etat?.debit) debit.current = etat.debit;

  const annulerMinuteurs = () => {
    if (minuteur.current) clearTimeout(minuteur.current);
    if (bloque.current) clearTimeout(bloque.current);
    minuteur.current = null;
    bloque.current = null;
  };

  const brancher = () => {
    const a = audio.current;
    if (!a) return;
    annulerMinuteurs();
    // Paramètre unique : le navigateur ne doit jamais resservir une ancienne écoute.
    a.src = `/api/radio/${seanceId}/ecoute?t=${Date.now()}`;
    a.play().catch((e: Error) => {
      // Lecture refusée faute de geste (onglet rechargé) : on revient au bouton.
      if (e.name === "NotAllowedError") {
        annulerMinuteurs();
        setPhase("arret");
      }
    });
  };

  const relancer = () => {
    if (phaseRef.current === "arret" || phaseRef.current === "attente") return;
    annulerMinuteurs();
    setPhase("reconnexion");
    const pause = PAUSES_REPRISE[Math.min(essais.current, PAUSES_REPRISE.length - 1)];
    essais.current++;
    minuteur.current = setTimeout(async () => {
      minuteur.current = null;
      if (phaseRef.current !== "reconnexion") return;
      const r = await refetch().catch(() => null);
      if (phaseRef.current !== "reconnexion") return;
      // Émission arrêtée : on attend qu'elle reprenne (événement temps réel ou interrogation).
      if (r?.data && !r.data.enDirect) {
        couperLecture();
        setPhase("attente");
        return;
      }
      brancher();
    }, pause);
  };

  const couperLecture = () => {
    const a = audio.current;
    if (!a) return;
    a.pause();
    a.removeAttribute("src");
    a.load();
  };

  const ecouter = () => {
    essais.current = 0;
    setPhase(etat && !etat.enDirect ? "attente" : "connexion");
    // Le geste est fait : la lecture pourra démarrer seule quand la radio commencera.
    if (etat && !etat.enDirect) return;
    brancher();
    if ("mediaSession" in navigator && typeof MediaMetadata !== "undefined") {
      navigator.mediaSession.metadata = new MediaMetadata({ title: "Radio du cours", artist: "Campus numérique 2IAE" });
    }
  };

  const arreter = () => {
    annulerMinuteurs();
    couperLecture();
    setPhase("arret");
  };

  // Le formateur démarre, redémarre ou arrête son émission.
  useCanal(`visio:${seanceId}`, (e) => {
    if (e.type !== "radio") return;
    const d = e.data as EvenementRadio;
    if (phaseRef.current === "arret") {
      void refetch();
      return;
    }
    if (d.genre === "fin") {
      annulerMinuteurs();
      couperLecture();
      setPhase("attente");
    } else {
      // « redemarrage » puis « debut » arrivent souvent ensemble : une seule relance.
      annulerMinuteurs();
      essais.current = 0;
      if (phaseRef.current !== "connexion") setPhase("reconnexion");
      minuteur.current = setTimeout(brancher, 400);
    }
  });

  // En attente : dès que l'interrogation voit la radio en direct, on branche.
  useEffect(() => {
    if (phase === "attente" && etat?.enDirect) {
      setPhase("connexion");
      brancher();
    }
  }, [phase, etat?.enDirect]);

  // Consommation estimée (durée d'écoute × débit mesuré) et rattrapage du retard.
  useEffect(() => {
    if (phase !== "direct") return;
    let tics = 0;
    const id = setInterval(() => {
      const a = audio.current;
      if (!a || a.paused) return;
      octets.current += debit.current;
      if (++tics % 5 === 0) {
        setConsomme(octets.current);
        rappel.current?.(octets.current);
      }
      if (tics % 2 === 0 && a.buffered.length) {
        const fin = a.buffered.end(a.buffered.length - 1);
        if (fin - a.currentTime > RETARD_MAX_S) a.currentTime = fin - 0.5;
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => () => {
    annulerMinuteurs();
    const a = audio.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
    }
    if (octets.current) rappel.current?.(octets.current);
  }, []);

  const evenements = {
    onPlaying: () => {
      if (bloque.current) clearTimeout(bloque.current);
      bloque.current = null;
      essais.current = 0;
      if (phaseRef.current !== "arret") setPhase("direct");
    },
    onError: () => relancer(),
    onEnded: () => relancer(),
    // Lecture bloquée plus de 8 s (réseau à l'arrêt) : on rouvre l'écoute, au plus près du direct.
    onWaiting: () => {
      if (bloque.current || phaseRef.current !== "direct") return;
      bloque.current = setTimeout(() => {
        bloque.current = null;
        relancer();
      }, 8000);
    },
  };

  const enEcoute = phase !== "arret";
  const vous = (t: string, v: string) => (tu ? t : v);

  return (
    <div className={cn("flex w-full max-w-md flex-col gap-3 rounded-2xl p-4 text-left sm:p-5", nuit ? "bg-nuit-carte text-white" : "border border-ligne bg-white text-encre")}>
      <audio ref={audio} preload="none" {...evenements} />
      {!possible ? (
        <p className={cn("text-[15px]", nuit ? "text-nuit-doux" : "text-texte-pale")}>
          {vous("Ton navigateur ne lit pas la radio du cours. Ouvre le campus avec Chrome.", "Votre navigateur ne lit pas la radio du cours. Ouvrez le campus avec Chrome.")}
        </p>
      ) : !enEcoute ? (
        <>
          <Bouton taille="lg" pleineLargeur icone={<Radio className="h-5 w-5" />} onClick={ecouter} className="min-h-[56px]">
            Écouter le cours
          </Bouton>
          <p className={cn("text-sm", nuit ? "text-nuit-doux" : "text-texte-pale")}>
            Le son du formateur seulement · environ 12 à 15 Mo par heure.{" "}
            {etat?.enDirect ? "La radio est en direct." : "Elle commence avec le cours."}
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {phase === "direct" ? (
              <Pastille ton="direct">En direct</Pastille>
            ) : phase === "reconnexion" ? (
              <Pastille ton="alerte">Reconnexion…</Pastille>
            ) : (
              <Pastille ton={nuit ? "attente" : "neutre"}>{phase === "attente" ? "En attente" : "Connexion…"}</Pastille>
            )}
            {consomme > 0 && <span className={cn("font-mono text-xs", nuit ? "text-nuit-gris" : "text-texte-gris")}>≈ {taille(consomme)} depuis le début</span>}
          </div>
          <p className="text-base font-semibold" aria-live="polite">
            {phase === "direct"
              ? vous("Tu écoutes la radio du cours.", "Vous écoutez la radio du cours.")
              : phase === "attente"
                ? "La radio n'a pas encore commencé. Elle démarre toute seule dès que le formateur parle."
                : phase === "reconnexion"
                  ? "Le réseau a coupé, on reprend…"
                  : "Connexion à la radio…"}
          </p>
          <Bouton variante={nuit ? "nuit" : "contour"} icone={<Square className="h-4 w-4" />} onClick={arreter} className={cn("min-h-[48px] self-start", nuit && "border border-nuit-bord")}>
            Arrêter
          </Bouton>
        </>
      )}
    </div>
  );
}
