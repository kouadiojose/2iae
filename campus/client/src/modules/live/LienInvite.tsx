// « Lien invité » d'une séance : à partager aux étudiants qui n'arrivent pas à
// se connecter (ou à un invité). Sans compte ni identifiant, il ne vaut que
// pour cette séance, jusqu'à 30 minutes après la fin prévue (routes/live-invite.ts).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Link2, MessageCircle } from "lucide-react";
import type { LienInviteDto } from "@shared/schema";
import { Bouton, type VarianteBouton } from "@/components/ui/bouton";
import { Fenetre } from "@/components/ui/fenetre";
import { Erreur, Squelette } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import { heure, jourLong } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Qr } from "@/modules/pilotage/composants/Qr";
import { copier } from "@/modules/pilotage/outils";

type SeanceLien = { id: number; titre: string; debut: string };

export function BoutonLienInvite({
  seance,
  variante = "doux",
  taille = "md",
  className,
  qrGrand,
}: {
  seance: SeanceLien;
  variante?: VarianteBouton;
  taille?: "sm" | "md" | "lg";
  className?: string;
  /** Écran de salle : un grand QR code, à scanner depuis la salle. */
  qrGrand?: boolean;
}) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <Bouton variante={variante} taille={taille} icone={<Link2 className="h-4 w-4" />} onClick={() => setOuverte(true)} className={className}>
        Lien invité
      </Bouton>
      {ouverte && <FenetreLienInvite seance={seance} qrGrand={qrGrand} onFermer={() => setOuverte(false)} />}
    </>
  );
}

function FenetreLienInvite({ seance, onFermer, qrGrand }: { seance: SeanceLien; onFermer: () => void; qrGrand?: boolean }) {
  const { data, error, isLoading } = useQuery<LienInviteDto>({ queryKey: [`/api/seances/${seance.id}/lien-invite`] });
  const message = data
    ? `Cours « ${seance.titre} » (${jourLong(seance.debut)} à ${heure(seance.debut)}, heure d'Abidjan) : suivez-le sans compte ni mot de passe avec ce lien :\n${data.url}\nIl ne vaut que pour ce cours.`
    : "";
  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      large={qrGrand}
      titre="Lien invité de la séance"
      description="Sans compte ni mot de passe : pour les étudiants qui n'arrivent pas à se connecter. Ils donnent leur nom, puis suivent en son + diapos ou en vidéo."
      pied={
        data ? (
          <>
            <Bouton variante="contour" icone={<Copy className="h-4 w-4" />} onClick={async () => toast((await copier(data.url)) ? "Lien copié" : "Copie impossible : sélectionnez le lien à la main.", "info")}>
              Copier le lien
            </Bouton>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange px-5 py-3 text-[15px] font-bold text-encre no-underline hover:bg-encre hover:text-white"
            >
              <MessageCircle className="h-4 w-4" /> Envoyer sur WhatsApp
            </a>
          </>
        ) : undefined
      }
    >
      {error ? (
        <Erreur message={(error as Error).message} />
      ) : isLoading || !data ? (
        <Squelette className="h-28" />
      ) : (
        <div className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="break-all rounded-xl bg-creme px-4 py-3 font-mono text-[13px] leading-snug text-encre">{data.url}</p>
            <p className="mt-2 text-sm text-texte-pale">
              Valable pour cette séance seulement, jusqu'au {jourLong(data.valableJusquau)} à {heure(data.valableJusquau)} (heure d'Abidjan). Les invités ne posent pas de
              question et ne sont pas comptés présents : leur nom apparaît au bilan de la séance.
            </p>
          </div>
          <Qr texte={data.url} titre="QR code du lien invité" className={cn("shrink-0 self-center rounded-xl bg-white p-2", qrGrand ? "w-56 sm:w-72" : "w-32")} />
        </div>
      )}
    </Fenetre>
  );
}
