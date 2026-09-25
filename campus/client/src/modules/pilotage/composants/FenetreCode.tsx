// Le code provisoire, montré UNE seule fois : en grand, avec le QR du lien
// d'activation (l'étudiant peut le scanner sur l'écran), le message WhatsApp
// prêt et l'impression de la fiche.
import { useLocation } from "wouter";
import { MessageCircle, Copy, Printer, TriangleAlert } from "lucide-react";
import type { CodeRemis, FicheConnexion } from "@shared/schema";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { toast } from "@/components/ui/toast";
import { dateCourte } from "@/lib/dates";
import { Qr } from "./Qr";
import { copier, memoriserFiches, lienFiches } from "../outils";
import { cn } from "@/lib/utils";

export function FenetreCode({
  remis,
  personne,
  onFermer,
  nouveauCompte,
}: {
  remis: CodeRemis | null;
  personne: Omit<FicheConnexion, "code" | "lien" | "expireLe"> | null;
  onFermer: () => void;
  /** Compte tout juste créé : pas d'ancien code à invalider. */
  nouveauCompte?: boolean;
}) {
  const [, naviguer] = useLocation();
  if (!remis || !personne) return null;
  const message = decodeURIComponent(remis.whatsapp.split("?text=")[1] ?? "");
  const imprimer = () => {
    memoriserFiches([{ ...personne, code: remis.code, lien: remis.lien, expireLe: remis.expireLe }]);
    naviguer(lienFiches([personne.id]));
  };
  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      titre={`Code de ${personne.prenom}`}
      description="Ce code ne sera plus affiché : envoyez-le, imprimez la fiche ou faites scanner le QR maintenant."
      pied={
        <>
          <Bouton variante="contour" icone={<Printer className="h-4 w-4" />} onClick={imprimer}>
            Imprimer la fiche
          </Bouton>
          <a
            href={remis.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange px-5 py-3 text-[15px] font-bold text-encre no-underline hover:bg-encre hover:text-white"
          >
            <MessageCircle className="h-4 w-4" />
            Envoyer sur WhatsApp
          </a>
        </>
      }
    >
      <div className="flex flex-col items-center gap-5 pb-2 sm:flex-row sm:items-start">
        <div className="w-full rounded-2xl bg-creme p-5 text-center sm:flex-1">
          <div className="etiquette">Identifiant</div>
          <div className="mt-1 break-words font-mono text-lg font-semibold">{personne.identifiant}</div>
          <div className="etiquette mt-4">Code provisoire</div>
          <div
            className={cn("mt-1 font-mono font-bold leading-none tabular-nums", remis.code.length > 8 ? "whitespace-nowrap text-[26px] tracking-normal" : "text-[44px] tracking-[0.12em]")}
            aria-live="polite"
          >
            {remis.code}
          </div>
          <div className="mt-3 text-sm text-texte-pale">Valable jusqu'au {dateCourte(remis.expireLe)} · à usage unique</div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Qr texte={remis.lien} className="w-40 rounded-xl border border-ligne bg-white p-3" titre="QR du lien d'activation" />
          <span className="text-center text-[13px] text-texte-gris">À scanner avec l'appareil photo</span>
        </div>
      </div>
      {!nouveauCompte && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-alerte-clair px-4 py-3 text-sm text-alerte">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Les anciens codes et fiches de ce compte ne marchent plus. Les appareils déjà connectés devront se reconnecter.</span>
        </div>
      )}
      <button
        type="button"
        onClick={async () => toast((await copier(message)) ? "Message copié" : "Copie impossible : sélectionnez le texte à la main.", "info")}
        className="mt-3 flex min-h-[48px] items-center gap-2 text-[15px] font-bold text-orange-fonce hover:text-encre"
      >
        <Copy className="h-4 w-4" />
        Copier le message (SMS, e-mail…)
      </button>
    </Fenetre>
  );
}
