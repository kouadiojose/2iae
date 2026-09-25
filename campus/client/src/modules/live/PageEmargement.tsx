// /emargement/:code — ouverte en scannant le QR de l'écran de la salle :
// émarge aussitôt et affiche « ✓ Présent · Yopougon » en très grand, ou une
// erreur claire avec la possibilité de taper le nouveau code.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, CircleAlert, WifiOff } from "lucide-react";
import { post, ErreurApi } from "@/lib/api";
import { heure } from "@/lib/dates";
import { useMoiConnecte } from "@/lib/auth";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { ChampCode } from "./ui";
import type { EmargementDto } from "@shared/schema";

type Etat = { type: "envoi" } | { type: "ok"; r: EmargementDto } | { type: "erreur"; message: string; horsLigne?: boolean };

export default function PageEmargement({ code: codeUrl }: { code: string }) {
  const moi = useMoiConnecte();
  const [, naviguer] = useLocation();
  const [etat, setEtat] = useState<Etat>({ type: "envoi" });
  const [code, setCode] = useState("");
  const deja = useRef(false);

  const emarger = async (c: string) => {
    setEtat({ type: "envoi" });
    try {
      const r = await post<EmargementDto>("/api/emargement", { code: c });
      setEtat({ type: "ok", r });
      // Arrivé par le QR, sans avoir touché l'écran : le navigateur refuse la vibration (et le signale en console).
      const active = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
      if (navigator.vibrate && active) navigator.vibrate(120);
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
    if (deja.current) return;
    deja.current = true;
    if (/^\d{4}$/.test(codeUrl)) void emarger(codeUrl);
    else setEtat({ type: "erreur", message: "Ce lien ne contient pas de code valide. Tape les 4 chiffres affichés sur l'écran de la salle." });
  }, [codeUrl]);

  const suivre = (r: EmargementDto) => {
    localStorage.setItem(`campus:live:mode:${r.seanceId}`, "compagnon");
    naviguer(`/live/${r.seanceId}`);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-white px-5 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 text-center">
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
              <p className="text-[44px] font-black leading-none tracking-serre">✓ Présent</p>
              <p className="text-[32px] font-black leading-none tracking-serre text-orange-fonce">{etat.r.site}</p>
            </div>
            <p className="text-[17px] text-texte-pale">
              {etat.r.dejaEmarge ? "Tu étais déjà émargé" : "Présence enregistrée"} à {heure(etat.r.heure)} · {etat.r.salle}
              <br />
              <span className="font-semibold text-encre">{etat.r.titre}</span>
            </p>
            <p className="rounded-2xl bg-creme px-4 py-3 text-[15px] text-texte-doux">
              {moi.prenom}, garde le son coupé sur ton téléphone : le cours passe par l'écran de la salle.
            </p>
            <div className="flex w-full flex-col gap-2.5">
              <Bouton taille="lg" pleineLargeur onClick={() => suivre(etat.r)}>
                Voter et poser mes questions
              </Bouton>
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
            <div className="flex w-full flex-col gap-3">
              <label className="text-left text-sm font-bold">Le code affiché sur l'écran de la salle</label>
              <ChampCode valeur={code} onChange={setCode} autoFocus />
              <Bouton taille="lg" pleineLargeur disabled={code.length !== 4} onClick={() => emarger(code)}>
                Valider ma présence
              </Bouton>
              <LienBouton href="/accueil" variante="fantome">
                Revenir à l'accueil
              </LienBouton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
