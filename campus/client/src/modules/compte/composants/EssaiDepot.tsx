// « Ton premier devoir en 2 minutes » : l'étudiant photographie n'importe
// quelle feuille, la rend et reçoit le même reçu vert qu'un vrai devoir.
// Il fait une fois, sans enjeu, le geste le plus stressant de l'année.
// Ce n'est ni un devoir réel ni une note (POST /api/compte/essai-depot).
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCheck, Gauge, RotateCcw } from "lucide-react";
import { post, televerser, ErreurApi } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Erreur } from "@/components/ui/divers";
import { heure } from "@/lib/dates";
import type { RecuEssai } from "@shared/schema";
import { PiedAction, LienDiscret } from "./PiedAction";

type Etat = { etape: "intro" } | { etape: "apercu"; fichier: File; url: string } | { etape: "envoi"; fichier: File; url: string } | { etape: "recu"; recu: RecuEssai };

export function EssaiDepot({ onFini, onPlusTard }: { onFini: () => void; onPlusTard: () => void }) {
  const [etat, setEtat] = useState<Etat>({ etape: "intro" });
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  // Libère l'aperçu de la photo quand on en change.
  const urlApercu = etat.etape === "apercu" || etat.etape === "envoi" ? etat.url : null;
  useEffect(() => () => void (urlApercu && URL.revokeObjectURL(urlApercu)), [urlApercu]);

  function photoChoisie(liste: FileList | null) {
    const f = liste?.[0];
    if (champ.current) champ.current.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErreur("Choisis une photo (pas un autre fichier).");
    setErreur(null);
    setEtat({ etape: "apercu", fichier: f, url: URL.createObjectURL(f) });
  }

  async function rendre() {
    if (etat.etape !== "apercu") return;
    setErreur(null);
    setEtat({ ...etat, etape: "envoi" });
    try {
      const [f] = await televerser([etat.fichier], "rendu");
      const recu = await post<RecuEssai>("/api/compte/essai-depot", { fichierIds: [f.id] });
      navigator.vibrate?.(80);
      setEtat({ etape: "recu", recu });
    } catch (e) {
      setEtat({ ...etat, etape: "apercu" });
      setErreur(e instanceof ErreurApi ? e.message : "L'envoi n'a pas marché. Vérifie ton réseau et réessaie.");
    }
  }

  const entree = (
    <input ref={champ} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => photoChoisie(e.target.files)} />
  );

  if (etat.etape === "recu") {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-full animate-monte rounded-[28px] bg-succes px-6 pb-7 pt-8 text-white shadow-carte">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white text-succes">
            <CheckCheck className="h-11 w-11" strokeWidth={2.6} />
          </span>
          <h2 className="mt-5 text-[30px] font-black leading-[1.05] tracking-serre">Bravo, tu sais rendre un devoir !</h2>
          <div className="mx-auto mt-5 inline-flex flex-col items-center gap-1 rounded-2xl bg-white/15 px-5 py-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/80">Reçu de dépôt</span>
            <span className="font-mono text-[26px] font-bold tracking-wider">{etat.recu.recu}</span>
            <span className="font-mono text-sm text-white/90">✓ Rendu · {heure(etat.recu.heure)}</span>
          </div>
        </div>
        <p className="mt-5 max-w-sm text-base leading-relaxed text-texte-doux">
          Le jour d'un vrai devoir, ce sera exactement pareil. Garde ton numéro de reçu : il prouve que tu as rendu ton travail à l'heure.
        </p>
        <PiedAction>
          <Bouton taille="lg" pleineLargeur className="min-h-[56px] text-[17px]" onClick={onFini}>
            Continuer
          </Bouton>
        </PiedAction>
      </div>
    );
  }

  if (etat.etape === "apercu" || etat.etape === "envoi") {
    const envoi = etat.etape === "envoi";
    return (
      <div className="flex flex-col gap-4">
        <div>
          <span className="etiquette">Devoir d'essai · non noté</span>
          <h1 className="mt-2 text-[30px] font-black leading-[1.05] tracking-serre">Ta photo est prête.</h1>
          <p className="mt-2 text-base text-texte-pale">On voit bien la feuille ? Alors rends ton devoir.</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-ligne bg-creme">
          <img src={etat.url} alt="Aperçu de ta photo" className="mx-auto max-h-[42dvh] w-auto object-contain" />
        </div>
        {erreur && <Erreur message={erreur} />}
        {entree}
        <PiedAction>
          <Bouton taille="lg" pleineLargeur chargement={envoi} className="min-h-[56px] text-[17px]" onClick={rendre}>
            {envoi ? "Envoi en cours…" : "Rendre mon devoir"}
          </Bouton>
          <LienDiscret onClick={() => champ.current?.click()}>
            <span className="inline-flex items-center gap-1.5">
              <RotateCcw className="h-4 w-4" /> Reprendre la photo
            </span>
          </LienDiscret>
        </PiedAction>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="etiquette">Devoir d'essai · non noté</span>
        <h1 className="mt-2 text-[32px] font-black leading-[1.02] tracking-serre">Ton premier devoir en 2 minutes</h1>
        <p className="mt-3 text-base leading-relaxed text-texte-doux">
          Prends en photo <strong className="text-encre">n'importe quelle feuille</strong> : une page de cahier, un ticket, un prospectus. Personne ne la notera. C'est juste pour t'entraîner.
        </p>
      </div>
      <ol className="flex flex-col gap-2.5">
        {["Touche « Prendre la photo »", "Vérifie que la feuille est lisible", "Rends ton devoir et reçois ton reçu"].map((t, i) => (
          <li key={t} className="flex items-center gap-3 rounded-2xl bg-creme px-4 py-3 text-base font-semibold">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange font-mono text-sm font-bold text-encre">{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>
      <p className="flex items-start gap-2 text-[14px] leading-snug text-texte-gris">
        <Gauge className="mt-0.5 h-4 w-4 shrink-0" />
        La photo est allégée avant l'envoi pour économiser tes mégas.
      </p>
      {erreur && <Erreur message={erreur} />}
      {entree}
      <PiedAction>
        <Bouton taille="lg" pleineLargeur icone={<Camera className="h-5 w-5" />} className="min-h-[56px] text-[17px]" onClick={() => champ.current?.click()}>
          Prendre la photo
        </Bouton>
        <LienDiscret onClick={onPlusTard}>Plus tard</LienDiscret>
      </PiedAction>
    </div>
  );
}
