// Vérification du micro, du haut-parleur et de la caméra avant d'entrer dans la classe.
//
// Rien ne s'ouvre sans un geste : on explique d'abord à quoi sert la
// permission (la fenêtre du navigateur est sèche et fait refuser), puis on
// montre l'image, un vu-mètre qui bouge quand on parle, et un bip pour
// vérifier le haut-parleur. Micro et caméra sont rendus en quittant.
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Mic, Volume2, AlertTriangle } from "lucide-react";
import { useMoi } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import { CONTRAINTES_MICRO, VIDEO_SALLE, arreter, mediasDisponibles, messageErreurMedia } from "./moteur/medias";
import { Video } from "./composants";

type Phase = "attente" | "demande" | "pret" | "erreur";

/** Niveau au-delà duquel on considère qu'on a entendu une voix (0 à 1). */
const SEUIL_VOIX = 0.06;

export function TestMicroCamera({ camera = true, onPret, nuit }: { camera?: boolean; onPret?: (ok: boolean) => void; nuit?: boolean }) {
  const { moi } = useMoi();
  const tu = !moi || moi.role === "etudiant";
  const t = (vTu: string, vVous: string) => (tu ? vTu : vVous);

  const [phase, setPhase] = useState<Phase>("attente");
  const [erreur, setErreur] = useState<string | null>(null);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [video, setVideo] = useState<MediaStreamTrack | null>(null);
  const [niveau, setNiveau] = useState(0);
  const [voixEntendue, setVoixEntendue] = useState(false);
  const [bip, setBip] = useState<"jamais" | "joue" | "entendu" | "pas-entendu">("jamais");
  const pistes = useRef<MediaStreamTrack[]>([]);
  const contexte = useRef<AudioContext | null>(null);
  const rappel = useRef(onPret);
  rappel.current = onPret;

  const liberer = () => {
    for (const p of pistes.current) arreter(p);
    pistes.current = [];
    void contexte.current?.close().catch(() => undefined);
    contexte.current = null;
  };
  useEffect(() => liberer, []);

  const demarrer = async () => {
    liberer();
    setErreur(null);
    setAvertissement(null);
    setVoixEntendue(false);
    setPhase("demande");
    if (!mediasDisponibles()) {
      setErreur(messageErreurMedia(null, tu));
      setPhase("erreur");
      rappel.current?.(false);
      return;
    }
    let flux: MediaStream;
    try {
      flux = await navigator.mediaDevices.getUserMedia({ audio: CONTRAINTES_MICRO, video: camera ? VIDEO_SALLE : false });
    } catch (e) {
      // La caméra manque ou est prise, mais le micro marche peut-être : on réessaie sans elle.
      const nom = (e as { name?: string }).name;
      if (camera && (nom === "NotFoundError" || nom === "NotReadableError" || nom === "OverconstrainedError")) {
        try {
          flux = await navigator.mediaDevices.getUserMedia({ audio: CONTRAINTES_MICRO });
          setAvertissement(messageErreurMedia(e, tu, "caméra"));
        } catch (e2) {
          setErreur(messageErreurMedia(e2, tu, "micro"));
          setPhase("erreur");
          rappel.current?.(false);
          return;
        }
      } else {
        setErreur(messageErreurMedia(e, tu, camera ? "micro et caméra" : "micro"));
        setPhase("erreur");
        rappel.current?.(false);
        return;
      }
    }
    pistes.current = flux.getTracks();
    setVideo(flux.getVideoTracks()[0] ?? null);
    brancherVuMetre(flux);
    setPhase("pret");
    rappel.current?.(!camera || flux.getVideoTracks().length > 0);
  };

  const brancherVuMetre = (flux: MediaStream) => {
    const Contexte = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexte || !flux.getAudioTracks().length) return;
    const ctx = new Contexte();
    contexte.current = ctx;
    const analyseur = ctx.createAnalyser();
    analyseur.fftSize = 512;
    ctx.createMediaStreamSource(flux).connect(analyseur);
    const donnees = new Uint8Array(analyseur.fftSize);
    let dernier = 0;
    const boucle = (instant: number) => {
      if (contexte.current !== ctx) return;
      // 15 mesures par seconde suffisent (téléphones modestes).
      if (instant - dernier > 66) {
        dernier = instant;
        analyseur.getByteTimeDomainData(donnees);
        let somme = 0;
        for (const v of donnees) somme += ((v - 128) / 128) ** 2;
        const rms = Math.sqrt(somme / donnees.length);
        const n = Math.min(1, rms * 4);
        setNiveau(n);
        if (n > SEUIL_VOIX) setVoixEntendue(true);
      }
      requestAnimationFrame(boucle);
    };
    requestAnimationFrame(boucle);
  };

  /** Petit bip de 0,6 s : le haut-parleur (ou les écouteurs) marche-t-il ? */
  const jouerBip = () => {
    const Contexte = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexte) return;
    const ctx = new Contexte();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.62);
    osc.onended = () => void ctx.close().catch(() => undefined);
    setBip("joue");
  };

  const texte = nuit ? "text-nuit-doux" : "text-texte-pale";
  const carte = nuit ? "bg-nuit-carte text-white" : "border border-ligne bg-white text-encre";

  return (
    <div className={cn("flex w-full flex-col gap-4 rounded-2xl p-4 sm:p-5", carte)}>
      {phase === "attente" || phase === "demande" ? (
        <>
          <p className={cn("text-base leading-relaxed", texte)}>
            {camera
              ? t(
                  "On vérifie ton micro, ta caméra et ton haut-parleur. Le navigateur va te demander l'autorisation : touche « Autoriser ».",
                  "Vérifions votre micro, votre caméra et votre haut-parleur. Le navigateur va vous demander l'autorisation : choisissez « Autoriser ».",
                )
              : t(
                  "On vérifie ton micro et ton haut-parleur. Le navigateur va te demander l'autorisation : touche « Autoriser ».",
                  "Vérifions votre micro et votre haut-parleur. Le navigateur va vous demander l'autorisation : choisissez « Autoriser ».",
                )}
          </p>
          <Bouton taille="lg" pleineLargeur chargement={phase === "demande"} icone={camera ? <Camera className="h-5 w-5" /> : <Mic className="h-5 w-5" />} onClick={demarrer} className="min-h-[56px]">
            {camera ? t("Tester mon micro et ma caméra", "Tester le micro et la caméra") : t("Tester mon micro", "Tester le micro")}
          </Bouton>
        </>
      ) : phase === "erreur" ? (
        <>
          <div className="flex items-start gap-3 rounded-xl bg-danger-clair p-4 text-[15px] text-danger" role="alert">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{erreur}</span>
          </div>
          <Bouton taille="lg" pleineLargeur onClick={demarrer} className="min-h-[56px]">
            Réessayer
          </Bouton>
        </>
      ) : (
        <>
          {camera && (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
              {video ? (
                <Video piste={video} miroir libelle={t("Ton image", "Votre image")} />
              ) : (
                <div className="grid h-full place-items-center px-4 text-center text-sm text-nuit-gris">Pas d'image</div>
              )}
            </div>
          )}
          {avertissement && (
            <p className="rounded-xl bg-alerte-clair px-4 py-3 text-[15px] text-alerte" role="alert">
              {avertissement}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-base font-bold">
                <Mic className="h-5 w-5 text-orange" /> Micro
              </span>
              {voixEntendue ? (
                <span className="flex items-center gap-1.5 text-sm font-bold text-succes">
                  <CheckCircle2 className="h-4 w-4" /> {t("Ton micro fonctionne", "Le micro fonctionne")}
                </span>
              ) : (
                <span className={cn("text-sm", texte)}>{t("Parle : la barre doit bouger.", "Parlez : la barre doit bouger.")}</span>
              )}
            </div>
            <div className={cn("h-3 overflow-hidden rounded-full", nuit ? "bg-nuit-ligne" : "bg-creme")} role="meter" aria-label="Niveau du micro" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(niveau * 100)}>
              <div className={cn("h-full rounded-full transition-[width] duration-75", voixEntendue ? "bg-succes" : "bg-orange")} style={{ width: `${Math.round(niveau * 100)}%` }} />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Bouton variante={nuit ? "nuit" : "doux"} taille="lg" pleineLargeur icone={<Volume2 className="h-5 w-5" />} onClick={jouerBip} className="min-h-[56px]">
              Tester le son
            </Bouton>
            {bip === "joue" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold">{t("Tu as entendu le bip ?", "Avez-vous entendu le bip ?")}</span>
                <Bouton taille="sm" variante={nuit ? "nuit" : "contour"} onClick={() => setBip("entendu")} className="min-h-[48px] px-5">
                  Oui
                </Bouton>
                <Bouton taille="sm" variante={nuit ? "nuit" : "contour"} onClick={() => setBip("pas-entendu")} className="min-h-[48px] px-5">
                  Non
                </Bouton>
              </div>
            )}
            {bip === "entendu" && (
              <p className="flex items-center gap-1.5 text-[15px] font-bold text-succes">
                <CheckCircle2 className="h-4 w-4" /> {t("Ton haut-parleur fonctionne.", "Le haut-parleur fonctionne.")}
              </p>
            )}
            {bip === "pas-entendu" && (
              <p className={cn("text-[15px] leading-relaxed", texte)}>
                {t(
                  "Monte le volume avec les boutons du téléphone, vérifie que le mode silencieux est coupé, ou branche tes écouteurs. Puis touche encore « Tester le son ».",
                  "Montez le volume de l'ordinateur ou des enceintes, vérifiez la sortie son choisie, puis cliquez encore sur « Tester le son ».",
                )}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
