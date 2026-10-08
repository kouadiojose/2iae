// /emargement/:code — ouverte en scannant le QR de l'écran de la salle :
// émarge aussitôt et affiche « Tu es compté présent ✓ · Yopougon » en très
// grand, puis ouvre le mode salle (compagnon léger, sans vidéo) ; ou une
// erreur claire avec la possibilité de taper le nouveau code.
// /emargement?seance=12 — ouverte par le rappel unique du démarrage du direct
// (« Le cours commence : en salle, scanne le QR de l'écran ; sinon, rejoins le
// cours en ligne ») : invite à scanner le QR ou à taper le code, et laisse
// suivre en ligne celui qui n'est pas dans la salle (« Son + diapos » proposé).
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, CircleAlert, QrCode, WifiOff } from "lucide-react";
import { post, ErreurApi } from "@/lib/api";
import { heure } from "@/lib/dates";
import { useMoiConnecte } from "@/lib/auth";
import { useTextes } from "@/lib/textes";
import { queryClient } from "@/lib/queryClient";
import { ecrireLocal } from "@/modules/pwa/outils";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { ChampCode } from "./ui";
import { cleSeance } from "./outils";
import { t } from "@shared/textes/direct";
import type { EmargementDto } from "@shared/schema";

type Etat = { type: "saisie" } | { type: "envoi" } | { type: "ok"; r: EmargementDto } | { type: "erreur"; message: string; horsLigne?: boolean };

/** Après l'émargement, le mode salle s'ouvre tout seul au bout de ces quelques secondes. */
const DELAI_SUITE_S = 4;

export default function PageEmargement({ code: codeUrl }: { code?: string }) {
  const moi = useMoiConnecte();
  const tx = useTextes(t);
  const [, naviguer] = useLocation();
  const [etat, setEtat] = useState<Etat>(() => (codeUrl ? { type: "envoi" } : { type: "saisie" }));
  const [code, setCode] = useState("");
  const [suite, setSuite] = useState<number | null>(null);
  const deja = useRef(false);
  const seanceRappel = Number(new URLSearchParams(window.location.search).get("seance")) || null;

  const emarger = async (c: string) => {
    setEtat({ type: "envoi" });
    try {
      const r = await post<EmargementDto>("/api/emargement", { code: c });
      setEtat({ type: "ok", r });
      // Arrivé par le QR, sans avoir touché l'écran : le navigateur refuse la vibration (et le signale en console).
      const active = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
      if (navigator.vibrate && active) navigator.vibrate(120);
      // Hors de son campus, l'avertissement se lit d'abord : pas d'ouverture automatique.
      if (!r.horsCampus) setSuite(DELAI_SUITE_S);
    } catch (e) {
      const horsLigne = e instanceof ErreurApi && e.statut === 0;
      setEtat({
        type: "erreur",
        horsLigne,
        message: horsLigne ? "Pas de réseau : l'émargement doit se faire connecté, dans la salle. Réessaie dès que le réseau revient, ou signale-toi au responsable de salle." : (e as Error).message,
      });
    }
  };

  useEffect(() => {
    if (deja.current || !codeUrl) return;
    deja.current = true;
    if (/^\d{4}$/.test(codeUrl)) void emarger(codeUrl);
    else setEtat({ type: "erreur", message: "Ce lien ne contient pas de code valide. Tape les 4 chiffres affichés sur l'écran de la salle." });
  }, [codeUrl]);

  // Le mode salle (questions, sondages, réactions) : sans vidéo ni son, quelques Ko par minute.
  const suivre = (r: EmargementDto) => {
    ecrireLocal(`campus:live:mode:${r.seanceId}`, "compagnon");
    // La séance relue après l'émargement : la salle sait que l'étudiant est émargé.
    queryClient.removeQueries({ queryKey: cleSeance(r.seanceId) });
    naviguer(`/live/${r.seanceId}`);
  };

  useEffect(() => {
    if (suite === null || etat.type !== "ok") return;
    if (suite <= 0) return suivre(etat.r);
    const id = setTimeout(() => setSuite((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(id);
  }, [suite, etat]);

  const formulaire = (
    <div className="flex w-full flex-col gap-3">
      <label className="text-left text-sm font-bold">{tx("emargement.saisie.code")}</label>
      <ChampCode valeur={code} onChange={setCode} autoFocus={etat.type === "erreur"} />
      <Bouton taille="lg" pleineLargeur disabled={code.length !== 4} onClick={() => emarger(code)}>
        {tx("emargement.saisie.valider")}
      </Bouton>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-white px-5 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 text-center">
        {etat.type === "saisie" && (
          <>
            <QrCode className="h-20 w-20 text-orange" strokeWidth={2} />
            <div className="flex flex-col gap-3">
              <p className="text-[34px] font-black leading-tight tracking-serre">{tx("emargement.saisie.titre")}</p>
              <p className="text-[16px] leading-relaxed text-texte-pale">{tx("emargement.saisie.texte")}</p>
            </div>
            {formulaire}
            <LienBouton href={seanceRappel ? `/live/${seanceRappel}?enLigne=1` : "/direct"} variante="fantome">
              {tx("emargement.saisie.enLigne")}
            </LienBouton>
          </>
        )}
        {etat.type === "envoi" && (
          <div className="flex flex-col items-center gap-4" aria-busy="true">
            <span className="point-direct h-4 w-4 bg-orange" />
            <p className="text-xl font-bold">Émargement en cours…</p>
          </div>
        )}
        {etat.type === "ok" && (
          <>
            <CheckCircle2 className="h-24 w-24 text-succes" strokeWidth={2.2} />
            <div className="flex flex-col gap-2">
              <p className="text-[38px] font-black leading-[1.05] tracking-serre" role="status">
                {tx("emargement.ok.titre")}
              </p>
              <p className="text-[30px] font-black leading-none tracking-serre text-orange-fonce">{etat.r.site}</p>
            </div>
            <p className="text-[17px] text-texte-pale">
              {etat.r.dejaEmarge ? "Tu étais déjà émargé" : "Présence enregistrée"} à {heure(etat.r.heure)} · {etat.r.salle}
              <br />
              <span className="font-semibold text-encre">{etat.r.titre}</span>
            </p>
            {etat.r.horsCampus && (
              <p className="rounded-2xl bg-alerte-clair px-4 py-3 text-[15px] font-semibold text-encre" role="status">
                Ce n'est pas la salle de ton campus{etat.r.monSite ? ` (${etat.r.monSite})` : ""} : ta présence est enregistrée à {etat.r.site}, et la vie scolaire en est informée.
              </p>
            )}
            <p className="rounded-2xl bg-creme px-4 py-3 text-[15px] text-texte-doux">{tx("emargement.ok.son", { v: { prenom: moi.prenom } })}</p>
            <div className="flex w-full flex-col gap-2.5">
              <Bouton taille="lg" pleineLargeur onClick={() => suivre(etat.r)}>
                {tx("emargement.ok.participer")}
              </Bouton>
              {suite !== null && suite > 0 && (
                <p className="text-[14px] text-texte-pale" aria-live="polite">
                  {tx("emargement.ok.suite", { v: { n: suite } })}
                </p>
              )}
              <LienBouton href="/accueil" variante="fantome" taille="lg">
                Revenir à l'accueil
              </LienBouton>
            </div>
          </>
        )}
        {etat.type === "erreur" && (
          <>
            {etat.horsLigne ? <WifiOff className="h-20 w-20 text-danger" /> : <CircleAlert className="h-20 w-20 text-danger" />}
            <p className="text-[30px] font-black leading-tight tracking-serre">Émargement refusé</p>
            <p className="text-[16px] leading-relaxed text-texte-pale" role="alert">
              {etat.message}
            </p>
            {formulaire}
            <LienBouton href="/accueil" variante="fantome">
              Revenir à l'accueil
            </LienBouton>
          </>
        )}
      </div>
    </div>
  );
}
