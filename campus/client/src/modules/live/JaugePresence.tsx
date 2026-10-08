// Jauge discrète de la présence en ligne (chantier C6) : ce que le serveur
// renvoie déjà à chaque battement (minutes distinctes, seuil, statut), enfin
// montré à l'étudiant. « Ta présence : 23 / 84 min · encore 61 min pour être
// compté présent », puis « Présent ✓ » au seuil ; « en pause » quand le flux
// temps réel est coupé (le battement n'est alors pas compté). L'étudiant qui
// est en fait dans la salle est invité à émarger avec le code de l'écran.
import { Link } from "wouter";
import { CheckCircle2, PauseCircle, QrCode } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { t } from "@shared/textes/direct";
import type { BattementPresenceDto } from "@shared/schema";

export function JaugePresence({ seanceId, battement, peutEmarger }: { seanceId: number; battement: BattementPresenceDto | null; peutEmarger: boolean }) {
  const tx = useTextes(t);
  if (!battement) return null;
  const enSalle = battement.compte && battement.mode === "salle";
  const invitation = peutEmarger && !enSalle && (
    <Link href={`/emargement?seance=${seanceId}`} className="flex min-h-11 items-center justify-between gap-3 rounded-[14px] px-1 text-[13px] text-nuit-doux hover:text-white">
      <span className="flex items-center gap-2">
        <QrCode className="h-4 w-4 shrink-0 text-orange" /> {tx("jauge.salle")}
      </span>
      <span className="shrink-0 rounded-full bg-nuit-carte px-3 py-1.5 font-bold text-orange-peche">{tx("jauge.salle.bouton")}</span>
    </Link>
  );
  if (!battement.compte) {
    if (battement.raison !== "flux_ferme") return null;
    return (
      <div className="flex flex-col gap-1 rounded-[16px] bg-nuit-panneau px-4 py-2.5" role="status">
        <p className="flex items-center gap-2 text-[14px] font-bold text-orange-peche">
          <PauseCircle className="h-4 w-4 shrink-0" /> {tx("jauge.pause")}
        </p>
        {invitation}
      </div>
    );
  }
  const present = enSalle || battement.minutes >= battement.seuil;
  const reste = Math.max(0, battement.seuil - battement.minutes);
  return (
    <div className="flex flex-col gap-1.5 rounded-[16px] bg-nuit-panneau px-4 py-2.5" role="status" aria-live="polite">
      {present ? (
        <p className="flex items-center gap-2 text-[14px] font-bold text-[#6FCF97]">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {enSalle ? tx("jauge.salle.present") : tx("jauge.present", { v: { minutes: battement.minutes } })}
        </p>
      ) : (
        <>
          <p className="text-[13.5px] font-semibold text-nuit-texte">{tx("jauge.compte", { v: { minutes: battement.minutes, seuil: battement.seuil, reste } })}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-nuit-ligne" aria-hidden>
            <div className="h-full rounded-full bg-orange transition-[width] duration-700" style={{ width: `${Math.min(100, (battement.minutes / Math.max(1, battement.seuil)) * 100)}%` }} />
          </div>
        </>
      )}
      {invitation}
    </div>
  );
}
