// Côté formateur : diffuse le son du micro en « radio » (flux HTTP très léger) aux étudiants en ligne.
//
// Témoin discret « Radio : 23 auditeurs ». L'envoi reprend tout seul après
// une coupure (voir moteur/radio.ts). Aucun bouton : c'est le studio (module
// live) qui décide quand la radio est active.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { cn, pluriel } from "@/lib/utils";
import type { EtatRadio } from "@shared/schema";
import { EmetteurRadioMoteur, type EtatEmission } from "./moteur/radio";

export function EmetteurRadio({ seanceId, flux, actif }: { seanceId: number; flux: MediaStream | null; actif: boolean }) {
  const piste = flux?.getAudioTracks()[0] ?? null;
  const [etat, setEtat] = useState<EtatEmission>("arret");
  const moteur = useRef<EmetteurRadioMoteur | null>(null);

  useEffect(() => {
    if (!actif || !piste || piste.readyState === "ended") {
      setEtat("arret");
      return;
    }
    const m = new EmetteurRadioMoteur(`/api/radio/${seanceId}`, piste, setEtat);
    moteur.current = m;
    m.demarrer();
    // Micro débranché : l'émission s'arrête proprement (le studio fournira une nouvelle piste).
    const surFin = () => m.arreter();
    piste.addEventListener("ended", surFin);
    return () => {
      piste.removeEventListener("ended", surFin);
      m.arreter();
      if (moteur.current === m) moteur.current = null;
    };
  }, [actif, piste, seanceId]);

  const enCours = actif && etat !== "arret" && etat !== "indisponible";
  const { data } = useQuery<EtatRadio>({
    queryKey: ["/api/radio", seanceId, "etat"],
    enabled: enCours,
    refetchInterval: 10_000,
  });

  if (!actif) return null;
  const auditeurs = data?.auditeurs ?? moteur.current?.auditeurs ?? 0;
  const texte =
    etat === "indisponible"
      ? "Radio indisponible sur ce navigateur"
      : etat === "reprise"
        ? "Radio : reprise…"
        : etat === "connexion" || etat === "arret"
          ? piste
            ? "Radio : démarrage…"
            : "Radio : micro coupé"
          : `Radio : ${pluriel(auditeurs, "auditeur")}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-xs",
        etat === "direct" ? "bg-nuit-carte text-nuit-doux" : etat === "indisponible" ? "bg-danger-clair text-danger" : "bg-nuit-carte text-orange-peche",
      )}
      role="status"
      aria-live="polite"
      title="Son du formateur diffusé aux étudiants qui suivent en audio (environ 12 à 15 Mo par heure)"
    >
      <Radio className={cn("h-3.5 w-3.5", etat === "direct" && "text-direct")} />
      {texte}
    </span>
  );
}
