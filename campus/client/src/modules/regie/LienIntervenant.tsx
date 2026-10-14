// « Lien intervenant » d'une séance : le lien qui fait entrer une personne dans la classe avec son micro et sa
// caméra (et le partage d'écran), sans compte : le formateur qui n'arrive pas à se connecter, un invité. Pour qui
// fait la régie du cours (formateur, direction, Chargé de cours) : GET /api/seances/:id/lien-intervenant
// (routes/regie.ts), journalisé à chaque remise. Copier, ou envoyer sur WhatsApp (au formateur directement quand
// son compte a un téléphone : le numéro ne s'affiche jamais).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Mic, MessageCircle } from "lucide-react";
import type { LienIntervenantDto } from "@shared/regie";
import { t as textesRegie } from "@shared/textes/regie";
import { Bouton, type VarianteBouton } from "@/components/ui/bouton";
import { Fenetre } from "@/components/ui/fenetre";
import { Erreur, Squelette } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import { heure, jourLong } from "@/lib/dates";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { copier } from "@/modules/pilotage/outils";

export function BoutonLienIntervenant({
  seanceId,
  variante = "doux",
  taille = "md",
  className,
}: {
  seanceId: number;
  variante?: VarianteBouton;
  taille?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tx = useTextes(textesRegie);
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <Bouton variante={variante} taille={taille} icone={<Mic className="h-4 w-4" />} onClick={() => setOuverte(true)} className={className}>
        {tx("bouton.lienIntervenant")}
      </Bouton>
      {ouverte && <FenetreLienIntervenant seanceId={seanceId} onFermer={() => setOuverte(false)} />}
    </>
  );
}

const classeWhatsapp =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-bold no-underline transition-colors";

function FenetreLienIntervenant({ seanceId, onFermer }: { seanceId: number; onFermer: () => void }) {
  const tx = useTextes(textesRegie);
  // Jamais gardé en cache : chaque ouverture redemande le lien (et la remise est notée au journal).
  const { data, error, isLoading } = useQuery<LienIntervenantDto>({ queryKey: [`/api/seances/${seanceId}/lien-intervenant`], staleTime: 0, gcTime: 0 });
  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      titre={tx("intervenant.titre")}
      description={tx("intervenant.description")}
      pied={
        data ? (
          // Le geste principal en premier, sur toute la largeur : envoyer au formateur (son numéro), sinon WhatsApp au choix.
          <div className="flex w-full flex-col gap-2">
            {data.whatsappFormateur && data.formateur && (
              <a href={data.whatsappFormateur} target="_blank" rel="noopener noreferrer" className={cn(classeWhatsapp, "w-full bg-orange text-encre hover:bg-encre hover:text-white")}>
                <MessageCircle className="h-4 w-4" /> {tx("intervenant.whatsappA", { v: { nom: data.formateur } })}
              </a>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Bouton
                variante="contour"
                className="min-h-[48px]"
                icone={<Copy className="h-4 w-4" />}
                onClick={async () => toast((await copier(data.url)) ? tx("intervenant.copie") : tx("intervenant.copieImpossible"), "info")}
              >
                {tx("intervenant.copier")}
              </Bouton>
              <a
                href={data.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(classeWhatsapp, data.whatsappFormateur ? "bg-creme text-encre hover:bg-orange-clair" : "bg-orange text-encre hover:bg-encre hover:text-white")}
              >
                <MessageCircle className="h-4 w-4" /> {tx("intervenant.whatsapp")}
              </a>
            </div>
          </div>
        ) : undefined
      }
    >
      {error ? (
        <Erreur message={(error as Error).message} />
      ) : isLoading || !data ? (
        <Squelette className="h-28" />
      ) : (
        <div className="flex flex-col gap-3 pb-2">
          <p className="rounded-xl border border-alerte/40 bg-alerte-clair px-4 py-3 text-[15px] font-semibold text-encre">{tx("intervenant.prudence")}</p>
          <p className="break-all rounded-xl bg-creme px-4 py-3 font-mono text-[13px] leading-snug text-encre" data-lien-intervenant>
            {data.url}
          </p>
          <p className="text-sm text-texte-pale">{tx("intervenant.valable", { v: { jour: jourLong(data.valableJusquau), heure: heure(data.valableJusquau) } })}</p>
        </div>
      )}
    </Fenetre>
  );
}
