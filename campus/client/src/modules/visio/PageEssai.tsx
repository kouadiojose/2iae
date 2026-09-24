// Page /visio/essai : vérifier micro, caméra, haut-parleur et radio avant le cours.
//
// L'essai de radio fait le vrai trajet : le micro est enregistré comme chez
// le formateur, envoyé au serveur, et réécouté par le même chemin que les
// étudiants (avec ~2 s de retard). Il révèle donc aussi un réseau ou un
// proxy qui bloquerait le flux.
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Radio, Square } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton } from "@/components/ui/bouton";
import { TestMicroCamera } from "./TestMicroCamera";
import { Pastille } from "./composants";
import { EmetteurRadioMoteur, formatRadio, lectureRadioPossible, type EtatEmission } from "./moteur/radio";
import { arreter, mediasDisponibles, messageErreurMedia, obtenirMicro, webrtcDisponible } from "./moteur/medias";

const DUREE_ESSAI_S = 30;

export default function PageEssai() {
  const moi = useMoiConnecte();
  const tu = moi.role === "etudiant";
  // Pas de caméra étudiante en v1 : on ne demande que ce qui servira.
  const camera = !tu;
  const t = (vTu: string, vVous: string) => (tu ? vTu : vVous);

  const verifications = [
    { ok: webrtcDisponible(), libelle: "Classe en visio", aide: t("Ouvre le campus avec Chrome à jour.", "Ouvrez le campus avec Chrome ou Edge à jour.") },
    { ok: lectureRadioPossible(), libelle: "Écoute de la radio du cours", aide: t("Ouvre le campus avec Chrome.", "Ouvrez le campus avec Chrome ou Edge.") },
    { ok: mediasDisponibles(), libelle: "Accès au micro", aide: t("Ouvre le campus à une adresse en https.", "Ouvrez le campus à une adresse en https.") },
    ...(tu ? [] : [{ ok: formatRadio() !== null, libelle: "Émission de la radio", aide: "Ouvrez le campus avec Chrome, Edge ou Firefox." }]),
  ];

  return (
    <Page className="max-w-3xl">
      <EnTetePage
        etiquette="Avant le cours"
        titre={camera ? "Tester mon micro et ma caméra" : "Tester mon micro et le son"}
        sousTitre={t(
          "Deux minutes pour vérifier que tout marche avant d'entrer dans la classe.",
          "Deux minutes pour vérifier votre installation avant la classe.",
        )}
      />

      <section className="flex flex-col gap-3" aria-labelledby="essai-micro">
        <h2 id="essai-micro" className="text-xl font-extrabold">
          1. {camera ? "Micro, caméra et son" : "Micro et son"}
        </h2>
        <TestMicroCamera camera={camera} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="essai-radio">
        <h2 id="essai-radio" className="text-xl font-extrabold">
          2. La radio du cours
        </h2>
        <p className="text-base text-texte-pale">
          {t(
            "Quand ton forfait est petit, tu peux suivre le cours « à la radio » : le son du formateur seulement, environ 11 Mo par heure. Fais l'essai : parle, et tu t'entendras comme à la radio.",
            "Les étudiants au petit forfait suivent le cours « à la radio » : votre son seulement, environ 11 Mo par heure. Faites l'essai : parlez, vous vous entendrez comme eux vous entendront.",
          )}
        </p>
        <EssaiRadio tu={tu} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="essai-compat">
        <h2 id="essai-compat" className="text-xl font-extrabold">
          3. {t("Ton navigateur", "Votre navigateur")}
        </h2>
        <ul className="flex flex-col divide-y divide-ligne-douce rounded-2xl border border-ligne bg-white">
          {verifications.map((v) => (
            <li key={v.libelle} className="flex items-start gap-3 px-4 py-3.5">
              {v.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-succes" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />}
              <span className="flex flex-col">
                <span className="text-base font-semibold">{v.libelle}</span>
                <span className={cn("text-sm", v.ok ? "text-texte-gris" : "text-danger")}>{v.ok ? "Compatible" : v.aide}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </Page>
  );
}

type PhaseEssai = "attente" | "demande" | "enregistre" | "ecoute" | "fini" | "erreur";

/** Boucle complète : micro → serveur → écoute, pendant 30 s au plus. */
function EssaiRadio({ tu }: { tu: boolean }) {
  const t = (vTu: string, vVous: string) => (tu ? vTu : vVous);
  const [phase, setPhaseEtat] = useState<PhaseEssai>("attente");
  const phaseRef = useRef<PhaseEssai>("attente");
  const setPhase = (p: PhaseEssai) => {
    phaseRef.current = p;
    setPhaseEtat(p);
  };
  const [erreur, setErreur] = useState<string | null>(null);
  const [entendu, setEntendu] = useState(false);
  const [restant, setRestant] = useState(DUREE_ESSAI_S);
  const audio = useRef<HTMLAudioElement>(null);
  const piste = useRef<MediaStreamTrack | null>(null);
  const moteur = useRef<EmetteurRadioMoteur | null>(null);
  const ecouteLancee = useRef(false);
  const essaisEcoute = useRef(0);

  const brancherEcoute = () => {
    const a = audio.current;
    if (!a) return;
    a.src = `/api/radio/essai/ecoute?t=${Date.now()}`;
    void a.play().catch(() => undefined);
  };

  const terminer = (phaseFinale: PhaseEssai = "fini") => {
    moteur.current?.arreter(true);
    moteur.current = null;
    arreter(piste.current);
    piste.current = null;
    const a = audio.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    if (phaseRef.current !== "attente") setPhase(phaseFinale);
  };
  useEffect(() => () => terminer(), []);

  // Compte à rebours de l'essai.
  useEffect(() => {
    if (phase !== "enregistre" && phase !== "ecoute") return;
    const id = setInterval(() => setRestant((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);
  useEffect(() => {
    if (restant === 0 && (phase === "enregistre" || phase === "ecoute")) terminer();
  }, [restant, phase]);

  const lancer = async () => {
    setErreur(null);
    setEntendu(false);
    setRestant(DUREE_ESSAI_S);
    ecouteLancee.current = false;
    essaisEcoute.current = 0;
    if (!formatRadio() || !lectureRadioPossible()) {
      setErreur(t("Ton navigateur ne gère pas la radio du cours. Ouvre le campus avec Chrome.", "Votre navigateur ne gère pas la radio du cours. Ouvrez le campus avec Chrome."));
      setPhase("erreur");
      return;
    }
    setPhase("demande");
    try {
      piste.current = await obtenirMicro();
    } catch (e) {
      setErreur(messageErreurMedia(e, tu, "micro"));
      setPhase("erreur");
      return;
    }
    const surEtat = (etat: EtatEmission) => {
      // Dès que le serveur accepte les premiers morceaux, on écoute.
      if (etat === "direct" && !ecouteLancee.current) {
        ecouteLancee.current = true;
        brancherEcoute();
      }
      if (etat === "indisponible") {
        setErreur(t("La radio n'a pas pu démarrer. Réessaie dans un instant.", "La radio n'a pas pu démarrer. Réessayez dans un instant."));
        terminer("erreur");
      }
    };
    const m = new EmetteurRadioMoteur("/api/radio/essai", piste.current, surEtat);
    moteur.current = m;
    setPhase("enregistre");
    m.demarrer();
  };

  const surErreurAudio = () => {
    // L'écoute peut partir un poil trop tôt : quelques nouveaux essais.
    if (!moteur.current || essaisEcoute.current >= 6) return;
    essaisEcoute.current++;
    setTimeout(brancherEcoute, 1000);
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-ligne bg-white p-4 sm:p-5">
      <audio
        ref={audio}
        preload="none"
        onPlaying={() => {
          setEntendu(true);
          if (phaseRef.current === "enregistre") setPhase("ecoute");
        }}
        onError={surErreurAudio}
      />
      {phase === "attente" || phase === "demande" || phase === "erreur" ? (
        <>
          {erreur && (
            <p className="rounded-xl bg-danger-clair px-4 py-3 text-[15px] text-danger" role="alert">
              {erreur}
            </p>
          )}
          <p className="text-[15px] text-texte-pale">{t("Mets tes écouteurs pour éviter l'écho.", "Utilisez un casque ou des écouteurs pour éviter l'écho.")}</p>
          <Bouton taille="lg" pleineLargeur chargement={phase === "demande"} icone={<Radio className="h-5 w-5" />} onClick={lancer} className="min-h-[56px]">
            {phase === "erreur" ? "Réessayer" : "Lancer l'essai de radio"}
          </Bouton>
        </>
      ) : phase === "fini" ? (
        <>
          {entendu ? (
            <p className="flex items-start gap-2 text-base font-bold text-succes">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              {t("La radio fonctionne sur ton appareil.", "La radio fonctionne sur votre appareil.")}
            </p>
          ) : (
            <p className="text-[15px] leading-relaxed text-texte-pale">
              {t(
                "Tu ne t'es pas entendu ? Vérifie le volume, puis réessaie. Si ça ne marche toujours pas, le réseau bloque peut-être la radio : essaie en 4G ou sur un autre Wi-Fi.",
                "Vous ne vous êtes pas entendu ? Vérifiez le volume, puis réessayez. Sinon, le réseau bloque peut-être la radio : essayez un autre réseau.",
              )}
            </p>
          )}
          <Bouton variante="contour" onClick={() => setPhase("attente")} className="min-h-[48px] self-start">
            Refaire l'essai
          </Bouton>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {phase === "ecoute" ? <Pastille ton="direct">{t("Tu t'entends", "Vous vous entendez")}</Pastille> : <Pastille ton="neutre">Connexion…</Pastille>}
            <span className="font-mono text-sm text-texte-gris">{restant} s</span>
          </div>
          <p className="text-base font-semibold">
            {phase === "ecoute"
              ? t("Parle : tu t'entends avec environ 2 secondes de retard, comme à la radio.", "Parlez : vous vous entendez avec environ 2 secondes de retard, comme à la radio.")
              : t("Parle normalement, la radio se met en route…", "Parlez normalement, la radio se met en route…")}
          </p>
          <Bouton variante="contour" icone={<Square className="h-4 w-4" />} onClick={() => terminer()} className="min-h-[48px] self-start">
            Arrêter l'essai
          </Bouton>
        </>
      )}
    </div>
  );
}
