// /bibliotheque/exposes/:id — l'exposé préparé avec l'IA : problématique,
// plan minuté, diapositives, questions du public, esprit critique,
// bibliographie. À copier, imprimer, puis à retravailler avec ses mots.
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Check, Printer, Trash2, BookOpen } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { suppr } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { dateCourte } from "@/lib/dates";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Chargement, Erreur } from "@/components/ui/divers";
import { Markdown } from "@/components/ui/markdown";
import { toastErreur } from "@/components/ui/toast";
import { copier } from "@/modules/ia/voix";
import { EtiquetteIa } from "@/modules/ia/composants";
import type { ExposeDto } from "@shared/schema/ext-bibliotheque";

export default function PageExpose({ id }: { id: string }) {
  const moi = useMoiConnecte();
  const etudiant = moi.role === "etudiant";
  const [, naviguer] = useLocation();
  const { data, error, isLoading, refetch } = useQuery<ExposeDto>({ queryKey: [`/api/bibliotheque/exposes/${id}`] });
  const [copie, setCopie] = useState(false);

  if (isLoading) return <Page><Chargement lignes={5} /></Page>;
  if (error || !data) return <Page><Erreur message={(error as Error)?.message ?? "Exposé introuvable."} reessayer={() => void refetch()} /></Page>;

  const supprimer = async () => {
    if (!window.confirm(etudiant ? "Supprimer cet exposé ?" : "Supprimer cet exposé ?")) return;
    try {
      await suppr(`/api/bibliotheque/exposes/${data.id}`);
      void rafraichir("/api/bibliotheque");
      naviguer(`/bibliotheque/livres/${data.livreId}?onglet=expose`);
    } catch (e) {
      toastErreur(e);
    }
  };

  return (
    <Page className="max-w-3xl gap-6">
      <LienBouton href={`/bibliotheque/livres/${data.livreId}?onglet=expose`} variante="fantome" taille="sm" icone={<ArrowLeft className="h-4 w-4" />} className="-mb-3 -ml-2 self-start print:hidden">
        {data.livreTitre.length > 40 ? `${data.livreTitre.slice(0, 40)}…` : data.livreTitre}
      </LienBouton>
      <EnTetePage
        etiquette={`Exposé · ${dateCourte(data.creeLe)}`}
        titre={data.sujet}
        sousTitre={
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" aria-hidden /> D'après « {data.livreTitre} »
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Bouton
              variante="contour"
              icone={copie ? <Check className="h-4 w-4 text-succes" /> : <Copy className="h-4 w-4" />}
              onClick={async () => {
                if (await copier(data.contenu)) {
                  setCopie(true);
                  setTimeout(() => setCopie(false), 2000);
                }
              }}
            >
              {copie ? "Copié" : "Copier"}
            </Bouton>
            <Bouton variante="contour" icone={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Imprimer
            </Bouton>
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <EtiquetteIa texte="Préparé avec l'IA" />
        <span className="text-sm text-texte-gris">
          {etudiant ? "Un point de départ : vérifie dans le livre, reformule avec tes mots, ajoute tes propres exemples." : "Un point de départ, à vérifier et à reformuler."}
        </span>
      </div>
      <Carte>
        <Markdown source={data.contenu} className="text-base" />
      </Carte>
      {data.id && (
        <Bouton variante="fantome" icone={<Trash2 className="h-4 w-4" />} onClick={() => void supprimer()} className="self-start text-danger print:hidden">
          Supprimer cet exposé
        </Bouton>
      )}
    </Page>
  );
}
