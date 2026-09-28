// Vérifications automatiques avant la visio Daily (page /visio/essai) :
// navigateur, connexion au service vidéo, qualité du réseau, caméra, micro.
//
// Les tests réseau passent par daily-js (testWebsocketConnectivity,
// testCallQuality) : ils disent si le réseau laisse passer la visio, ce que
// ne voit pas un simple essai de micro. Rien ne s'ouvre sans nécessité :
// caméra et micro ne sont testés d'office que si le navigateur les a déjà
// autorisés, sinon un bouton le demande.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, MinusCircle, RotateCcw, Camera, Mic } from "lucide-react";
import type { DailyCall } from "@daily-co/daily-js";
import { post } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import type { AccesDaily, ResultatEssaiVisio } from "@shared/schema";
import { chargerDaily, compatibiliteDaily, problemeDepuisApi } from "./daily";
import { arreter, messageErreurMedia, mediasDisponibles, CONTRAINTES_MICRO, VIDEO_SALLE } from "./moteur/medias";

type Statut = "attente" | "encours" | "ok" | "avertissement" | "echec" | "non_teste";
type Ligne = { statut: Statut; detail: string; solution?: string | null };
type Cle = "navigateur" | "connexion" | "qualite" | "camera" | "micro";

const LIBELLES: Record<Cle, string> = {
  navigateur: "Navigateur",
  connexion: "Connexion au service vidéo",
  qualite: "Qualité du réseau",
  camera: "Caméra",
  micro: "Micro",
};

/** Attend une promesse au plus `ms` millisecondes ; au-delà, arrête le test et répond « delai ». */
function avecDelai<T>(promesse: Promise<T>, ms: number, surDelai: () => void): Promise<T | "delai"> {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<"delai">((ok) => {
    minuteur = setTimeout(() => {
      try {
        surDelai();
      } catch {
        /* appel déjà fermé */
      }
      ok("delai");
    }, ms);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur));
}

async function permissionAccordee(nom: "camera" | "microphone"): Promise<boolean> {
  try {
    const r = await navigator.permissions?.query({ name: nom as PermissionName });
    return r?.state === "granted";
  } catch {
    return false;
  }
}

export type PropsPreTests = {
  tu: boolean;
  /** Tester la caméra (pas de caméra étudiante). */
  camera: boolean;
  /** Daily est configuré sur ce campus (sinon la qualité n'est pas testée). */
  daily: boolean;
  /** Résultats de la dernière série, pour la suite de la page et la mémoire du compte. */
  onResultat?: (r: ResultatEssaiVisio) => void;
};

export function PreTestsDaily({ tu, camera, daily, onResultat }: PropsPreTests) {
  const t = (a: string, b: string) => (tu ? a : b);
  const cles: Cle[] = camera ? ["navigateur", "connexion", "qualite", "camera", "micro"] : ["navigateur", "connexion", "qualite", "micro"];
  const vide = (): Record<Cle, Ligne> => ({
    navigateur: { statut: "attente", detail: "" },
    connexion: { statut: "attente", detail: "" },
    qualite: { statut: "attente", detail: "" },
    camera: { statut: "attente", detail: "" },
    micro: { statut: "attente", detail: "" },
  });
  const [lignes, setLignes] = useState<Record<Cle, Ligne>>(vide);
  const [enCours, setEnCours] = useState(false);
  const [mediasAFaire, setMediasAFaire] = useState(false);
  const serie = useRef(0);
  const appelTest = useRef<DailyCall | null>(null);
  const resultats = useRef<Record<Cle, Ligne>>(vide());
  const qualiteMesuree = useRef<ResultatEssaiVisio["qualite"]>(null);
  const rappel = useRef(onResultat);
  rappel.current = onResultat;

  const poser = (n: number, cle: Cle, l: Ligne) => {
    if (n !== serie.current) return;
    resultats.current = { ...resultats.current, [cle]: l };
    setLignes((x) => ({ ...x, [cle]: l }));
  };

  const fermerAppel = () => {
    const c = appelTest.current;
    appelTest.current = null;
    if (c) void c.destroy().catch(() => undefined);
  };
  // En quittant la page : la série en cours s'arrête et l'appel de test est fermé.
  useEffect(
    () => () => {
      serie.current++;
      fermerAppel();
    },
    [],
  );

  /** Caméra et micro : une vraie ouverture, aussitôt refermée. */
  const testerMedias = async (n: number) => {
    setMediasAFaire(false);
    if (!mediasDisponibles()) {
      const m = messageErreurMedia(null, tu);
      if (camera) poser(n, "camera", { statut: "echec", detail: m });
      poser(n, "micro", { statut: "echec", detail: m });
      return;
    }
    if (camera) {
      poser(n, "camera", { statut: "encours", detail: "Ouverture de la caméra…" });
      try {
        const flux = await navigator.mediaDevices.getUserMedia({ video: VIDEO_SALLE, audio: false });
        const piste = flux.getVideoTracks()[0];
        const nom = piste?.label?.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, "") || "Caméra";
        const reglages = piste?.getSettings();
        poser(n, "camera", { statut: "ok", detail: `${nom}${reglages?.width ? ` · ${reglages.width}×${reglages.height}` : ""}` });
        flux.getTracks().forEach((p) => arreter(p));
      } catch (e) {
        poser(n, "camera", { statut: "echec", detail: messageErreurMedia(e, tu, "caméra") });
      }
    }
    poser(n, "micro", { statut: "encours", detail: "Ouverture du micro…" });
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: CONTRAINTES_MICRO, video: false });
      const piste = flux.getAudioTracks()[0];
      const nom = piste?.label || "Micro";
      poser(n, "micro", { statut: piste?.readyState === "live" ? "ok" : "avertissement", detail: nom, solution: piste?.readyState === "live" ? null : t("Le micro ne transmet rien : vérifie qu'il n'est pas coupé.", "Le micro ne transmet rien : vérifiez qu'il n'est pas coupé.") });
      flux.getTracks().forEach((p) => arreter(p));
    } catch (e) {
      poser(n, "micro", { statut: "echec", detail: messageErreurMedia(e, tu, "micro") });
    }
  };

  const resumer = (n: number) => {
    if (n !== serie.current) return;
    const r = resultats.current;
    const conv = (s: Statut): ResultatEssaiVisio["connexion"] => (s === "ok" ? "ok" : s === "avertissement" ? "avertissement" : s === "echec" ? "echec" : "non_teste");
    const qualite = qualiteMesuree.current;
    const statutMedia = (s: Statut) => (s === "ok" || s === "avertissement" ? true : s === "echec" ? false : null);
    const resultat: ResultatEssaiVisio = {
      connexion: conv(r.connexion.statut),
      qualite,
      camera: camera ? statutMedia(r.camera.statut) : null,
      micro: statutMedia(r.micro.statut),
      salle: false,
    };
    rappel.current?.(resultat);
    // Mémorisé sur le compte : alimente « Prêt pour votre prochaine classe ».
    void post("/api/visio/essai/resultat", resultat).catch(() => undefined);
  };

  const lancer = async () => {
    const n = ++serie.current;
    fermerAppel();
    resultats.current = vide();
    qualiteMesuree.current = null;
    setLignes(vide());
    setEnCours(true);

    // 1. Navigateur
    poser(n, "navigateur", { statut: "encours", detail: "Vérification…" });
    const compat = await compatibiliteDaily(tu);
    if (n !== serie.current) return;
    poser(n, "navigateur", compat.ok ? { statut: "ok", detail: t("Ton navigateur sait faire la visio.", "Votre navigateur sait faire la visio.") } : { statut: "echec", detail: compat.raison ?? "", solution: compat.conseil });

    // 2. Connexion au service vidéo (WebSocket vers les serveurs Daily)
    let connexionOk = false;
    if (!compat.ok) {
      poser(n, "connexion", { statut: "non_teste", detail: "Non testée : le navigateur n'est pas compatible." });
    } else {
      poser(n, "connexion", { statut: "encours", detail: "Connexion aux serveurs de visio…" });
      try {
        const Daily = await chargerDaily();
        const call = Daily.createCallObject({ allowMultipleCallInstances: true, audioSource: false, videoSource: false });
        appelTest.current = call;
        const r = await avecDelai(call.testWebsocketConnectivity(), 20_000, () => call.abortTestWebsocketConnectivity());
        if (n !== serie.current) return;
        if (r === "delai" || r.result === "aborted" || r.result === "failed") {
          poser(n, "connexion", {
            statut: "echec",
            detail: t("Ton réseau bloque la visio.", "Votre réseau bloque la visio."),
            solution: t(
              "Suis le cours à la radio (son + diapos), ou active un partage de connexion 4G depuis un téléphone, puis relance la vérification.",
              "Utilisez la radio du cours ou un partage de connexion 4G depuis votre téléphone, puis relancez la vérification. Au campus, prévenez la vie scolaire : le réseau doit laisser passer la visio Daily.",
            ),
          });
        } else if (r.result === "warning") {
          connexionOk = true;
          poser(n, "connexion", {
            statut: "avertissement",
            detail: `Le service vidéo répond, mais pas partout (${r.passedRegions.length} région${r.passedRegions.length > 1 ? "s" : ""} sur ${r.passedRegions.length + r.failedRegions.length}).`,
            solution: t("La visio devrait passer. Si elle coupe, passe en son + diapos.", "La visio devrait passer. Si elle coupe, un partage de connexion 4G aide souvent."),
          });
        } else {
          connexionOk = true;
          poser(n, "connexion", { statut: "ok", detail: "Le service vidéo répond depuis ce réseau." });
        }
      } catch {
        if (n !== serie.current) return;
        poser(n, "connexion", {
          statut: "echec",
          detail: t("Le service vidéo ne répond pas.", "Le service vidéo ne répond pas."),
          solution: t("Vérifie ta connexion internet, puis relance. Sinon, suis le cours à la radio.", "Vérifiez la connexion internet, puis relancez. Sinon, utilisez la radio ou un partage de connexion."),
        });
      }
    }

    // 3. Qualité du réseau (appel de test Daily d'une quinzaine de secondes)
    if (!daily) {
      poser(n, "qualite", { statut: "non_teste", detail: "Non testée : la visio Daily n'est pas configurée sur ce campus." });
    } else if (!connexionOk) {
      poser(n, "qualite", { statut: "non_teste", detail: "Non testée : le service vidéo ne répond pas." });
    } else {
      poser(n, "qualite", { statut: "encours", detail: "Mesure du débit et des coupures (15 secondes environ)…" });
      try {
        const acces = await post<AccesDaily>("/api/visio/essai/rejoindre");
        const call = appelTest.current;
        if (!call) throw new Error("appel fermé");
        await call.preAuth({ url: acces.url, token: acces.jeton });
        const r = await avecDelai(call.testCallQuality(), 30_000, () => call.stopTestCallQuality());
        if (n !== serie.current) return;
        if (r === "delai" || r.result === "aborted") {
          poser(n, "qualite", { statut: "echec", detail: "La mesure n'a pas abouti.", solution: t("Relance la vérification. Si ça recommence, le réseau est trop faible pour la vidéo : choisis son + diapos.", "Relancez la vérification. Si ça recommence, le réseau est trop faible pour la vidéo.") });
        } else if (r.result === "failed") {
          poser(n, "qualite", {
            statut: "echec",
            detail: t("L'appel de test n'a pas pu passer.", "L'appel de test n'a pas pu passer."),
            solution: t("Le réseau laisse passer la connexion mais pas la vidéo. Suis le cours à la radio, ou essaie un partage de connexion 4G.", "Le réseau laisse passer la connexion mais pas la vidéo. Essayez un partage de connexion 4G, ou passez à la radio."),
          });
        } else {
          const d = r.data;
          const mesures = [d.avgRoundTripTime != null ? `délai ${Math.round(d.avgRoundTripTime * 1000)} ms` : null, d.avgSendPacketLoss != null ? `pertes ${Math.round(d.avgSendPacketLoss * 100)} %` : null]
            .filter(Boolean)
            .join(" · ");
          qualiteMesuree.current = r.result === "good" ? "bonne" : r.result === "warning" ? "moyenne" : "faible";
          if (r.result === "good") poser(n, "qualite", { statut: "ok", detail: `Bonne${mesures ? ` (${mesures})` : ""}. La vidéo passera bien.` });
          else if (r.result === "warning")
            poser(n, "qualite", {
              statut: "avertissement",
              detail: `Moyenne${mesures ? ` (${mesures})` : ""}.`,
              solution: t("Rapproche-toi du routeur Wi-Fi et ferme les autres applications. En cas de coupures, passe en son + diapos.", "Rapprochez-vous du routeur Wi-Fi, fermez les autres applications, et coupez votre caméra si l'image se fige."),
            });
          else
            poser(n, "qualite", {
              statut: "avertissement",
              detail: `Faible${mesures ? ` (${mesures})` : ""}.`,
              solution: t("La vidéo risque de couper : choisis « son + diapos » (radio). Ou rapproche-toi du routeur, ou passe en 4G.", "La vidéo risque de couper. Branchez-vous en filaire ou rapprochez-vous du routeur ; sinon, coupez votre caméra et gardez le son."),
            });
        }
      } catch (e) {
        if (n !== serie.current) return;
        const pb = problemeDepuisApi(e, "formateur", tu);
        poser(n, "qualite", { statut: "echec", detail: pb.texte || "La mesure n'a pas pu démarrer.", solution: pb.conseil });
      }
    }
    fermerAppel();

    // 4-5. Caméra et micro : d'office si déjà autorisés, sinon sur un geste.
    const dejaAutorise = (await permissionAccordee("microphone")) && (!camera || (await permissionAccordee("camera")));
    if (n !== serie.current) return;
    if (dejaAutorise) await testerMedias(n);
    else {
      if (camera) poser(n, "camera", { statut: "attente", detail: t("Touche le bouton ci-dessous pour autoriser la caméra.", "Cliquez sur le bouton ci-dessous pour autoriser la caméra.") });
      poser(n, "micro", { statut: "attente", detail: t("Touche le bouton ci-dessous pour autoriser le micro.", "Cliquez sur le bouton ci-dessous pour autoriser le micro.") });
      setMediasAFaire(true);
    }
    setEnCours(false);
    resumer(n);
  };

  // Les vérifications réseau partent d'elles-mêmes à l'arrivée.
  useEffect(() => {
    void lancer();
  }, []);

  const verifierMedias = async () => {
    const n = serie.current;
    await testerMedias(n);
    resumer(n);
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-ligne-douce rounded-2xl border border-ligne bg-white" aria-live="polite">
        {cles.map((cle) => (
          <LigneTest key={cle} libelle={LIBELLES[cle]} ligne={lignes[cle]} />
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {mediasAFaire && (
          <Bouton icone={camera ? <Camera className="h-4 w-4" /> : <Mic className="h-4 w-4" />} onClick={() => void verifierMedias()} className="min-h-[48px]">
            {camera ? "Vérifier la caméra et le micro" : "Vérifier le micro"}
          </Bouton>
        )}
        <Bouton variante="contour" icone={<RotateCcw className="h-4 w-4" />} onClick={() => void lancer()} disabled={enCours} className="min-h-[48px]">
          {enCours ? "Vérifications en cours…" : "Relancer les vérifications"}
        </Bouton>
      </div>
    </div>
  );
}

function LigneTest({ libelle, ligne }: { libelle: string; ligne: Ligne }) {
  const icones: Record<Statut, ReactNode> = {
    attente: <MinusCircle className="mt-0.5 h-5 w-5 shrink-0 text-texte-gris" aria-label="En attente" />,
    encours: <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-orange-fonce" aria-label="En cours" />,
    ok: <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-succes" aria-label="Réussi" />,
    avertissement: <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-alerte" aria-label="À surveiller" />,
    echec: <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-label="Échec" />,
    non_teste: <MinusCircle className="mt-0.5 h-5 w-5 shrink-0 text-texte-gris" aria-label="Non testé" />,
  };
  return (
    <li className="flex items-start gap-3 px-4 py-3.5" data-test-statut={ligne.statut}>
      {icones[ligne.statut]}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-semibold">{libelle}</span>
        {ligne.detail && <span className={cn("text-sm", ligne.statut === "echec" ? "font-semibold text-danger" : ligne.statut === "avertissement" ? "text-alerte" : "text-texte-gris")}>{ligne.detail}</span>}
        {ligne.solution && <span className="text-sm leading-snug text-texte-doux">{ligne.solution}</span>}
      </span>
    </li>
  );
}
