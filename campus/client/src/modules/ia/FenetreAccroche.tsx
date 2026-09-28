// « Accroche pour 2iae.com » : deux phrases proposées par l'IA pour la carte
// du cours sur le site. Un brouillon : le formateur la copie dans « Annoncer
// sur 2iae.com » de son cours, et la direction valide la publication.
import { useEffect, useState } from "react";
import { Globe, Copy, Check, RotateCcw } from "lucide-react";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Selection } from "@/components/ui/champs";
import { Erreur, EtatVide } from "@/components/ui/divers";
import type { AccrocheSite, CoursAssistant } from "@shared/schema/ext-ia";
import { useEtatIa, blocageDe } from "./api-ia";
import { BandeauBlocage, EtiquetteIa } from "./composants";
import { copier } from "./voix";

export function FenetreAccroche({ ouverte, onFermer, cours }: { ouverte: boolean; onFermer: () => void; cours: CoursAssistant[] }) {
  const { data: etat } = useEtatIa(ouverte);
  const [coursId, setCoursId] = useState<number | null>(null);
  const [resultat, setResultat] = useState<AccrocheSite | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    if (ouverte && coursId === null && cours.length) setCoursId(cours[0].id);
  }, [ouverte, cours, coursId]);

  const blocage = blocageDe(etat);
  const proposer = async () => {
    if (!coursId) return;
    setChargement(true);
    setErreur(null);
    try {
      setResultat(await post<AccrocheSite>("/api/ia/accroche-site", { coursId }));
      void rafraichir("/api/ia/etat");
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setChargement(false);
    }
  };

  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Accroche pour 2iae.com"
      description="Deux phrases pour présenter votre cours sur la carte du site. À relire et ajuster avant de la proposer."
      pied={
        resultat ? (
          <>
            <Bouton variante="contour" icone={<RotateCcw className="h-4 w-4" />} onClick={() => void proposer()} chargement={chargement} disabled={Boolean(blocage)}>
              Une autre proposition
            </Bouton>
            <Bouton
              icone={copie ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              onClick={async () => {
                if (await copier(resultat.accroche)) {
                  setCopie(true);
                  setTimeout(() => setCopie(false), 2000);
                }
              }}
            >
              {copie ? "Copiée" : "Copier l'accroche"}
            </Bouton>
          </>
        ) : (
          <Bouton icone={<Globe className="h-4 w-4" />} onClick={() => void proposer()} chargement={chargement} disabled={!coursId || Boolean(blocage)} pleineLargeur>
            Proposer une accroche
          </Bouton>
        )
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <BandeauBlocage etat={etat} enseignant />
        {!cours.length ? (
          <EtatVide titre="Aucun cours à présenter" texte="Les cours que vous enseignez apparaîtront ici." />
        ) : (
          <Selection
            libelle="Cours"
            value={coursId ?? ""}
            onChange={(e) => {
              setCoursId(Number(e.target.value));
              setResultat(null);
            }}
          >
            {cours.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.titre}
              </option>
            ))}
          </Selection>
        )}
        {erreur && <Erreur message={erreur} />}
        {chargement && !resultat && <p className="animate-pulse text-[15px] text-texte-pale">L'assistant rédige une proposition…</p>}
        {resultat && (
          <div className="flex flex-col gap-3 rounded-2xl bg-creme p-4">
            <EtiquetteIa className="self-start" />
            <p className="text-lg font-bold leading-snug text-encre">{resultat.accroche}</p>
            <p className="font-mono text-xs text-texte-gris">{resultat.accroche.length} caractères</p>
          </div>
        )}
        {resultat && (
          <p className="text-[14px] leading-relaxed text-texte-pale">
            Collez-la dans « Annoncer sur 2iae.com » de l'éditeur du cours. Rien n'est publié automatiquement : la direction valide la carte avant sa mise en ligne.
          </p>
        )}
      </div>
    </Fenetre>
  );
}
