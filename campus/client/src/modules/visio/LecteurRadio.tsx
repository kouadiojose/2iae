// Côté étudiant : écoute la radio du cours (≈ 12 à 15 Mo/h), reprise automatique après coupure.
//
// Un simple <audio> sur l'adresse d'écoute (WebM/Opus en flux continu). Les
// navigateurs n'autorisent le son qu'après un geste : d'où le gros bouton
// « Écouter le cours ». Ensuite tout est automatique : reprise après une
// coupure (essais de plus en plus espacés), relance quand le formateur
// redémarre son émission, rattrapage du retard accumulé.
//
// iPhone et iPad ne lisent pas ce flux sans fin dans un <audio> : la radio y est décodée dans la page
// (moteur/radio-decodee.ts, WebCodecs + Web Audio). Ailleurs, après trois échecs sans le moindre son, même bascule.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, Square } from "lucide-react";
import { useMoi } from "@/lib/auth";
import { useCanal } from "@/lib/flux";
import { cn, taille } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import type { EtatRadio, EvenementRadio } from "@shared/schema";
import { lectureRadioPossible } from "./moteur/radio";
import { appareilApple, decodageRadioPossible, EcouteDecodee, preparerAudio } from "./moteur/radio-decodee";
import { Pastille } from "./composants";

type Phase = "arret" | "attente" | "connexion" | "direct" | "reconnexion";

/** Débit par défaut (24 kbit/s + enveloppe WebM) tant que le serveur n'a pas mesuré le flux. */
const DEBIT_DEFAUT = 3100;
const PAUSES_REPRISE = [1000, 2000, 4000, 8000, 15000];
/** Retard maximal toléré avant de sauter à la fin de ce qui est déjà reçu. */
const RETARD_MAX_S = 3.5;
/** Échecs de suite du lecteur <audio> sans aucun son avant de passer au décodage dans la page. */
const ECHECS_AVANT_DECODAGE = 3;

export function LecteurRadio({
  seanceId,
  nuit,
  onConsommation,
  base,
  demarrerSeul,
}: {
  seanceId: number;
  nuit?: boolean;
  onConsommation?: (octets: number) => void;
  /** Adresse de la radio pour un invité sans compte (« /api/invite/<jeton>/radio ») ; sinon celle de la séance. */
  base?: string;
  /**
   * Lecture lancée d'elle-même à l'affichage : le geste est déjà fait (l'étudiant revient de la parole, vidéo des
   * étudiants coupée). Si le navigateur refuse quand même, le bouton « Écouter le cours » revient.
   */
  demarrerSeul?: boolean;
}) {
  const racine = base ?? `/api/radio/${seanceId}`;
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
  // null : vérification en cours (asynchrone). Sur iPhone et iPad, seul le décodage dans la page fonctionne.
  const [decodage, setDecodage] = useState<boolean | null>(null);
  const apple = appareilApple();
  const possible = apple ? decodage !== false : lectureRadioPossible() || decodage !== false;
  const mode = useRef<"audio" | "decodage">(apple ? "decodage" : "audio");
  const ecoute = useRef<EcouteDecodee | null>(null);
  const echecsSansSon = useRef(0);
  const aJoue = useRef(false);
  useEffect(() => {
    let vivant = true;
    void decodageRadioPossible().then((ok) => {
      if (!vivant) return;
      setDecodage(ok);
      if (!ok) mode.current = "audio";
    });
    return () => {
      vivant = false;
    };
  }, []);

  const { data: etat, refetch } = useQuery<EtatRadio>({
    queryKey: [racine, "etat"],
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

  const surSon = () => {
    if (bloque.current) clearTimeout(bloque.current);
    bloque.current = null;
    essais.current = 0;
    echecsSansSon.current = 0;
    aJoue.current = true;
    if (phaseRef.current !== "arret") setPhase("direct");
  };

  const brancher = () => {
    const a = audio.current;
    if (!a) return;
    annulerMinuteurs();
    if (mode.current === "decodage") {
      const ctx = preparerAudio();
      let e: EcouteDecodee | null = null;
      try {
        e = ctx && new EcouteDecodee(`${racine}/ecoute?t=${Date.now()}`, ctx, {
          enDirect: () => {
            if (ecoute.current === e) surSon();
          },
          fin: () => {
            if (ecoute.current === e) relancer();
          },
          octets: (n) => {
            octets.current += n;
          },
        });
      } catch {
        e = null; // WebCodecs absent : lecteur <audio>
      }
      if (e) {
        ecoute.current?.arreter();
        ecoute.current = e;
        e.demarrer();
        return;
      }
      mode.current = "audio";
    }
    // Paramètre unique : le navigateur ne doit jamais resservir une ancienne écoute.
    a.src = `${racine}/ecoute?t=${Date.now()}`;
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
    // Le lecteur <audio> échoue sans jamais rien jouer (navigateur qui ne lit pas ce flux) : décodage dans la page.
    if (mode.current === "audio" && !aJoue.current && ++echecsSansSon.current >= ECHECS_AVANT_DECODAGE && decodage) {
      mode.current = "decodage";
      couperLecture();
    }
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
    ecoute.current?.arreter();
    ecoute.current = null;
    const a = audio.current;
    if (!a) return;
    a.pause();
    a.removeAttribute("src");
    a.load();
  };

  const ecouter = () => {
    essais.current = 0;
    // Le geste est là : Web Audio (iPhone) ne peut démarrer que maintenant.
    if (decodage || mode.current === "decodage") preparerAudio();
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

  // Retour de la parole : la radio reprend sans nouveau geste (à l'affichage, ou dès que la consigne arrive juste après).
  useEffect(() => {
    if (demarrerSeul && possible && phaseRef.current === "arret") ecouter();
  }, [demarrerSeul]);

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
      const decode = mode.current === "decodage";
      if (!a || (!decode && a.paused)) return;
      // Décodage dans la page : les octets reçus sont comptés au fil de l'eau (rappel « octets »).
      if (!decode) octets.current += debit.current;
      if (++tics % 5 === 0) {
        setConsomme(octets.current);
        rappel.current?.(octets.current);
      }
      if (!decode && tics % 2 === 0 && a.buffered.length) {
        const fin = a.buffered.end(a.buffered.length - 1);
        if (fin - a.currentTime > RETARD_MAX_S) a.currentTime = fin - 0.5;
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => () => {
    annulerMinuteurs();
    ecoute.current?.arreter();
    const a = audio.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
    }
    if (octets.current) rappel.current?.(octets.current);
  }, []);

  const evenements = {
    onPlaying: () => {
      if (mode.current === "audio") surSon();
    },
    onError: () => {
      if (mode.current === "audio") relancer();
    },
    onEnded: () => {
      if (mode.current === "audio") relancer();
    },
    // Lecture bloquée plus de 8 s (réseau à l'arrêt) : on rouvre l'écoute, au plus près du direct.
    onWaiting: () => {
      if (mode.current !== "audio" || bloque.current || phaseRef.current !== "direct") return;
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
          {apple
            ? vous("Ton iPhone ne lit pas la radio du cours : mets-le à jour (Réglages › Général › Mise à jour logicielle), ou suis le cours depuis un téléphone Android ou un ordinateur.", "Votre iPhone ne lit pas la radio du cours : mettez-le à jour (Réglages › Général › Mise à jour logicielle), ou suivez le cours depuis un téléphone Android ou un ordinateur.")
            : vous("Ton navigateur ne lit pas la radio du cours. Ouvre le campus avec Chrome.", "Votre navigateur ne lit pas la radio du cours. Ouvrez le campus avec Chrome.")}
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
