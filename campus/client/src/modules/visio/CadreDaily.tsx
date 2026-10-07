// Cadre Daily commun à la classe en direct, à la salle d'essai et à la
// répétition : même iframe, même thème de nuit, mêmes messages.
//
// Fiabilité :
//  - l'accès (jeton) est redemandé tout seul quand il a expiré ou que la
//    salle a été recréée, deux fois au plus ;
//  - chaque erreur est dite en français avec une issue (radio, visio du
//    campus, partage de connexion, Chrome…) ;
//  - une connexion qui traîne est signalée à 15 s et comptée comme un échec
//    à 40 s (réseau d'école filtré) ;
//  - au deuxième échec, le parent propose sa bascule (visio du campus,
//    radio) sans quitter la page ;
//  - dans la classe (relanceAuto), le formateur et l'écran de salle (aucun
//    clic sur l'écran d'une salle) réessaient tout seuls, de plus en plus
//    espacé, tant que le problème peut passer : salle pleine, réseau, service
//    occupé ou compte à régler.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, WifiOff, RotateCcw, AlertTriangle } from "lucide-react";
import type { DailyCall, DailyParticipant } from "@daily-co/daily-js";
import { cn } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import type { AccesDaily, RejoindreVisioDto } from "@shared/schema";
import type { EtatVisio } from "./SceneVisioCampus";
import {
  chargerDaily,
  attendreDestruction,
  detruireAppel,
  THEME_DAILY,
  STYLE_IFRAME,
  compatibiliteDaily,
  traduireErreurDaily,
  problemeDepuisApi,
  messageCameraDaily,
  relanceAutomatique,
  type ProblemeVisio,
} from "./daily";

export type RoleCadre = "formateur" | "salle" | "etudiant" | "observateur";

/** Personne vue dans la salle Daily (pour « qui est présent »). */
export type ParticipantCadre = { id: string; nom: string; local: boolean; micro: boolean; camera: boolean; proprietaire: boolean; userId: string };

const DELAI_LENT_MS = 15_000;
const DELAI_ECHEC_MS = 40_000;
const RELANCES_AUTO = 2;
/** Nouvel essai automatique (formateur, écran de salle) : au bout de 20 s, puis 30, 45, et chaque minute. */
const DELAIS_RELANCE_S = [20, 30, 45, 60];

type Acces = Pick<AccesDaily, "url" | "jeton"> & { message?: string };

export type PropsCadreDaily = {
  /** Demande un accès au campus (jeton signé par le serveur). */
  obtenirAcces: () => Promise<AccesDaily | RejoindreVisioDto>;
  role: RoleCadre;
  tu: boolean;
  /** Micro et caméra pilotés par le parent (classe en direct). Non fournis : les boutons de Daily suffisent. */
  micro?: boolean;
  camera?: boolean;
  /** Démarrage : caméra et micro ouverts ou non (sinon selon le rôle). */
  cameraAuDepart?: boolean;
  microAuDepart?: boolean;
  onEtat?: (etat: EtatVisio) => void;
  onRejoint?: () => void;
  onParticipants?: (liste: ParticipantCadre[]) => void;
  /** Octets reçus (total cumulé), mesurés par Daily. */
  onConsommation?: (octets: number) => void;
  /** L'appel en cours (null à la fermeture), pour les actions du formateur. */
  onAppel?: (call: DailyCall | null) => void;
  /** Nombre d'échecs consécutifs (le parent propose sa bascule à partir de 2). */
  onEchecs?: (n: number, probleme: ProblemeVisio | null) => void;
  /** Actions de secours montrées sous le message d'erreur dès le 2e échec. */
  secours?: ReactNode;
  /** Classe en direct : le formateur et l'écran de salle réessaient tout seuls (la salle d'essai, elle, montre l'échec tel quel). */
  relanceAuto?: boolean;
  className?: string;
};

function versParticipants(call: DailyCall): ParticipantCadre[] {
  const tous = Object.values(call.participants()) as DailyParticipant[];
  return tous.map((p) => ({
    id: p.session_id,
    userId: p.user_id,
    nom: p.user_name || "Invité",
    local: p.local,
    micro: p.tracks?.audio?.state === "playable" || p.tracks?.audio?.state === "sendable" || p.tracks?.audio?.state === "loading",
    camera: p.tracks?.video?.state === "playable" || p.tracks?.video?.state === "sendable" || p.tracks?.video?.state === "loading",
    proprietaire: p.owner,
  }));
}

export function CadreDaily(p: PropsCadreDaily) {
  const { role, tu } = p;
  const t = (a: string, b: string) => (tu ? a : b);
  const conteneur = useRef<HTMLDivElement>(null);
  const appel = useRef<DailyCall | null>(null);
  const [etat, setEtat] = useState<"connexion" | "connecte" | "erreur">("connexion");
  const [probleme, setProbleme] = useState<ProblemeVisio | null>(null);
  const [avisMedia, setAvisMedia] = useState<string | null>(null);
  const [essai, setEssai] = useState(0);
  const [lent, setLent] = useState(false);
  const echecs = useRef(0);
  const relances = useRef(0);
  const relancesLongues = useRef(0);
  const [prochainEssai, setProchainEssai] = useState<number | null>(null);
  const recu = useRef(0);
  // Les rappels du parent changent à chaque rendu : on garde la dernière version.
  const rappels = useRef(p);
  rappels.current = p;

  const noterEchec = (pb: ProblemeVisio) => {
    echecs.current += 1;
    setProbleme(pb);
    setEtat("erreur");
    rappels.current.onEtat?.("echec");
    rappels.current.onEchecs?.(echecs.current, pb);
  };

  useEffect(() => {
    // Une tentative de connexion : « connexion » → « connecte », ou « fini » (échec, abandon).
    let phase: "connexion" | "connecte" | "fini" = "connexion";
    let annule = false;
    setEtat("connexion");
    setProbleme(null);
    setLent(false);
    rappels.current.onEtat?.("connexion");

    const fermer = (c: DailyCall | null) => {
      if (appel.current === c) appel.current = null;
      detruireAppel(c);
      rappels.current.onAppel?.(null);
      rappels.current.onParticipants?.([]);
    };
    const echouer = (pb: ProblemeVisio) => {
      if (annule || phase === "fini") return;
      phase = "fini";
      clearTimeout(lentId);
      clearTimeout(echecId);
      setLent(false);
      fermer(appel.current);
      if (pb.relancer && relances.current < RELANCES_AUTO) {
        relances.current += 1;
        setEssai((n) => n + 1);
        return;
      }
      noterEchec(pb);
    };

    // Connexion anormalement longue (réseau d'école filtré, 3G faible) : on le dit à 15 s, on abandonne à 40 s.
    const lentId = setTimeout(() => phase === "connexion" && setLent(true), DELAI_LENT_MS);
    const echecId = setTimeout(() => {
      if (phase !== "connexion") return;
      echouer({
        genre: "reseau",
        texte: t("La visio ne répond pas depuis ce réseau.", "La visio ne répond pas depuis ce réseau."),
        conseil:
          role === "formateur"
            ? "Le réseau bloque sans doute la visio. Essayez un partage de connexion depuis votre téléphone, ou passez à la visio du campus."
            : role === "salle"
              ? "Le réseau du campus bloque sans doute la visio. Essayez un partage de connexion 4G. Le son du cours reste disponible à la radio."
              : t("Ton réseau bloque sans doute la visio. Passe en « son + diapos » (radio) ou essaie en 4G.", "Le réseau bloque sans doute la visio. Passez à la radio ou essayez en 4G."),
        relancer: false,
      });
    }, DELAI_ECHEC_MS);

    (async () => {
      const compat = await compatibiliteDaily(tu);
      if (annule) return;
      if (!compat.ok) return echouer({ genre: "navigateur", texte: compat.raison ?? "", conseil: compat.conseil, relancer: false });
      let acces: Acces;
      try {
        const r = await rappels.current.obtenirAcces();
        const jeton = "jeton" in r ? r.jeton : undefined;
        if (!r.url || !jeton) throw new Error(("message" in r && r.message) || t("La visio n'est pas disponible pour le moment.", "La visio n'est pas disponible pour le moment."));
        acces = { url: r.url, jeton };
      } catch (e) {
        return echouer(problemeDepuisApi(e, role, tu));
      }
      try {
        const Daily = await chargerDaily();
        await attendreDestruction();
        if (annule || phase !== "connexion" || !conteneur.current) return;
        const call = Daily.createFrame(conteneur.current, {
          iframeStyle: STYLE_IFRAME,
          showLeaveButton: false,
          showFullscreenButton: true,
          lang: "fr",
          theme: THEME_DAILY,
          allowMultipleCallInstances: true,
        });
        appel.current = call;
        rappels.current.onAppel?.(call);
        const signalerParticipants = () => {
          if (appel.current === call) rappels.current.onParticipants?.(versParticipants(call));
        };
        call.on("joined-meeting", () => {
          if (annule || phase !== "connexion") return;
          phase = "connecte";
          clearTimeout(lentId);
          clearTimeout(echecId);
          setLent(false);
          echecs.current = 0;
          relances.current = 0;
          relancesLongues.current = 0;
          setEtat("connecte");
          rappels.current.onEtat?.("connecte");
          rappels.current.onEchecs?.(0, null);
          rappels.current.onRejoint?.();
          signalerParticipants();
        });
        call.on("participant-joined", signalerParticipants);
        call.on("participant-updated", signalerParticipants);
        call.on("participant-left", signalerParticipants);
        call.on("network-connection", (ev) => {
          if (ev?.event === "interrupted") rappels.current.onEtat?.("reconnexion");
          if (ev?.event === "connected") rappels.current.onEtat?.("connecte");
        });
        call.on("camera-error", (ev) => setAvisMedia(messageCameraDaily(ev?.error?.type, tu)));
        call.on("error", (ev) => {
          if (appel.current !== call) return;
          // Une erreur fatale en plein appel compte aussi : on repart de « fini ».
          if (phase === "connecte") phase = "connexion";
          echouer(traduireErreurDaily(ev, role, tu));
        });
        const emetteur = role === "formateur" || role === "salle";
        await call.join({
          url: acces.url,
          token: acces.jeton,
          startVideoOff: !(p.cameraAuDepart ?? emetteur),
          startAudioOff: !(p.microAuDepart ?? role === "formateur"),
        });
      } catch (e) {
        echouer(traduireErreurDaily(e as Error, role, tu));
      }
    })();
    return () => {
      annule = true;
      clearTimeout(lentId);
      clearTimeout(echecId);
      fermer(appel.current);
      rappels.current.onEtat?.("ferme");
    };
  }, [role, essai]);

  // Formateur et écran de salle : nouvel essai tout seul, de plus en plus espacé (une place qui se libère, le réseau qui revient).
  useEffect(() => {
    if (etat !== "erreur" || !rappels.current.relanceAuto || !relanceAutomatique(role, probleme)) {
      setProchainEssai(null);
      return;
    }
    const delai = DELAIS_RELANCE_S[Math.min(relancesLongues.current, DELAIS_RELANCE_S.length - 1)] * 1000;
    setProchainEssai(Date.now() + delai);
    const id = setTimeout(() => {
      relancesLongues.current += 1;
      relances.current = 0;
      setEssai((n) => n + 1);
    }, delai);
    return () => clearTimeout(id);
  }, [etat, probleme, role]);

  // Micro et caméra pilotés par le parent (le formateur garde son micro ; la salle et l'étudiant ne l'ouvrent qu'avec la parole).
  useEffect(() => {
    if (etat === "connecte" && p.micro !== undefined) appel.current?.setLocalAudio(p.micro);
  }, [p.micro, etat]);
  useEffect(() => {
    // L'observateur aussi : un formateur invité ouvre sa caméra (son jeton le lui permet ; l'équipe qui observe, non).
    if (etat === "connecte" && p.camera !== undefined && (role === "formateur" || role === "salle" || role === "observateur")) appel.current?.setLocalVideo(p.camera);
  }, [p.camera, etat, role]);

  // Consommation mesurée par Daily (débit reçu), cumulée toutes les 5 s.
  useEffect(() => {
    if (etat !== "connecte" || !p.onConsommation) return;
    const id = setInterval(async () => {
      try {
        const stats = await appel.current?.getNetworkStats();
        const latest = stats && "latest" in stats.stats ? stats.stats.latest : null;
        if (latest?.recvBitsPerSecond) {
          recu.current += (latest.recvBitsPerSecond / 8) * 5;
          rappels.current.onConsommation?.(recu.current);
        }
      } catch {
        /* statistiques indisponibles */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [etat, Boolean(p.onConsommation)]);

  const reessayer = () => {
    relances.current = 0;
    setEssai((n) => n + 1);
  };

  return (
    <div className={cn("relative h-full w-full", p.className)}>
      <div ref={conteneur} className="h-full w-full" />
      {etat === "connecte" && avisMedia && (
        <div className="absolute inset-x-3 bottom-3 flex items-start gap-2 rounded-xl bg-black/80 px-3 py-2 text-[13px] font-semibold text-white" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
          <span className="flex-1">{avisMedia}</span>
          <button type="button" className="font-bold text-orange-peche" onClick={() => setAvisMedia(null)}>
            OK
          </button>
        </div>
      )}
      {etat !== "connecte" && (
        <div className="absolute inset-0 overflow-y-auto">
          <div className="flex min-h-full flex-col items-center justify-center gap-3 p-5 text-center sm:p-6">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-nuit-ligne text-orange">
              {etat === "connexion" ? <Loader2 className="h-6 w-6 animate-spin" /> : <WifiOff className="h-6 w-6" />}
            </div>
            <p className="max-w-md text-[15px] font-semibold text-nuit-texte" role="status" aria-live="polite">
              {etat === "connexion"
                ? lent
                  ? t("La visio met du temps à répondre…", "La visio met du temps à répondre…")
                  : t("Connexion à la visio…", "Connexion à la visio…")
                : (probleme?.texte ?? t("La visio ne répond pas.", "La visio ne répond pas."))}
            </p>
            {etat === "erreur" && probleme?.conseil && <p className="max-w-md text-[14px] leading-snug text-nuit-doux">{probleme.conseil}</p>}
            {etat === "erreur" && prochainEssai && <CompteRelance cible={prochainEssai} />}
            {(etat === "erreur" || lent) && probleme?.genre !== "absente" && (
              <Bouton variante="nuit-actif" icone={<RotateCcw className="h-4 w-4" />} onClick={reessayer}>
                Réessayer
              </Bouton>
            )}
            {etat === "erreur" && echecs.current >= 2 && p.secours && <div className="flex w-full max-w-md flex-col gap-2 pt-1">{p.secours}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/** « Nouvel essai automatique dans 18 s » : rien à toucher sur l'écran d'une salle. */
function CompteRelance({ cible }: { cible: number }) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.ceil((cible - maintenant) / 1000));
  return (
    <p className="font-mono text-[13px] text-orange-peche" aria-live="off">
      {s > 0 ? `Nouvel essai automatique dans ${s} s` : "Nouvel essai…"}
    </p>
  );
}
