// Étape 3 de l'éditeur : « Composer ma présentation » (l'IA lit les sources ;
// sans IA, le compositeur de secours part du profil et de l'emploi du temps)
// et le compte rendu honnête de ce qui s'est passé.
import { useState } from "react";
import { AlertTriangle, Sparkles, Wand2 } from "lucide-react";
import { post, ErreurApi } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Erreur } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { cn } from "@/lib/utils";
import type { RapportComposition, ReponseComposition, ShowreelEditionDto } from "@shared/schema";
import { Bloc, dateHeure, textes } from "./communs";

const LIBELLES_COMPOSITION = {
  ia: "Composée par l'assistant IA",
  secours: "Composée sans IA, à partir du profil et de l'emploi du temps",
  depart: "Brouillon de départ : faits sûrs seulement",
  import: "Composée par la direction à partir de faits vérifiés",
} as const;

export function Composer({
  d,
  rapport,
  modifie,
  surComposition,
}: {
  d: ShowreelEditionDto;
  rapport: RapportComposition | null;
  modifie: boolean;
  surComposition: (r: ReponseComposition) => void;
}) {
  const { t, ma } = textes(d);
  const cible = d.estMoi ? "moi" : String(d.formateur.id);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const lisibles = d.sources.filter((s) => (s.type === "site" && s.etat !== "echec") || s.type === "pdf").length;
  // Des plans riches (composés par l'IA, préparés par la direction ou retouchés) ne sont jamais remplacés sans confirmation.
  const precieux = d.retouche || modifie || d.composition === "ia" || d.composition === "import";
  const appauvrit = precieux && (!d.ia.disponible || !lisibles);

  async function composer() {
    setConfirmer(false);
    setErreur(null);
    setEnvoi(true);
    try {
      surComposition(await post<ReponseComposition>(`/api/showreels/${cible}/composer`));
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "La composition n'a pas abouti. Réessayez dans un instant.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Bloc
      id="composer"
      numero={3}
      titre={`Composer ${ma} présentation`}
      description={
        d.ia.disponible
          ? t("L'assistant IA lit vos sources et compose six à huit plans. Il n'invente rien, et rien n'est publié sans votre accord.", "L'assistant IA lit ses sources et compose six à huit plans. Il n'invente rien, et rien n'est publié sans l'accord du formateur.")
          : "L'assistant IA est indisponible en ce moment : la présentation sera composée à partir du profil et de l'emploi du temps. Les liens et le PDF sont gardés pour plus tard."
      }
    >
      <div className="flex flex-col gap-4">
        <div className={cn("flex items-start gap-3 rounded-2xl p-4", d.ia.disponible ? "bg-orange-pale" : "bg-alerte-clair")}>
          {d.ia.disponible ? <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-alerte" aria-hidden />}
          <div className="text-[14px] leading-snug text-texte-doux">
            {d.ia.disponible ? (
              lisibles ? (
                <p>
                  {lisibles > 1 ? `${lisibles} sources lisibles` : "Une source lisible"} : {d.sources.filter((s) => (s.type === "site" && s.etat !== "echec") || s.type === "pdf").map((s) => s.nom).join(", ")}. Le cours, le jour et les campus viennent de l'emploi du temps, jamais de l'IA.
                </p>
              ) : (
                <p>{t("Ajoutez d'abord votre site ou le PDF de votre profil LinkedIn : sans source, la présentation reprend seulement votre profil et l'emploi du temps.", "Ajoutez d'abord son site ou le PDF de son profil LinkedIn : sans source, la présentation reprend seulement son profil et l'emploi du temps.")}</p>
              )
            ) : (
              <p>
                {d.ia.raison === "panne" ? "Le compte de l'assistant est en pause (crédit épuisé ou clé à vérifier)." : "L'assistant n'est pas activé sur ce campus."} La composition de secours donne une présentation correcte avec des faits sûrs ; relancez-la quand l'assistant sera de retour pour qu'il lise les sources.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Bouton taille="lg" icone={<Wand2 className="h-5 w-5" />} chargement={envoi} onClick={() => (precieux ? setConfirmer(true) : void composer())} className="min-h-[52px]">
            {envoi ? (d.ia.disponible && lisibles ? "L'assistant lit les sources…" : "Composition…") : d.composition === "ia" || d.composition === "import" ? `Recomposer ${ma} présentation` : `Composer ${ma} présentation`}
          </Bouton>
          {d.composition && d.composeLe && (
            <p className="text-[14px] text-texte-pale">
              {LIBELLES_COMPOSITION[d.composition]} le {dateHeure(d.composeLe)}
              {d.composePar && !d.estMoi ? ` par ${d.composePar}` : ""}
              {d.retouche ? ", puis retouchée à la main" : ""}.
            </p>
          )}
        </div>
        {envoi && d.ia.disponible && lisibles > 0 && <p className="font-mono text-xs text-texte-gris">Lecture des pages et composition : 20 à 60 secondes.</p>}
        {erreur && <Erreur message={erreur} reessayer={() => void composer()} />}

        {rapport && (
          <div role="status" className={cn("rounded-2xl border p-4", rapport.mode === "ia" ? "border-succes/30 bg-succes-clair" : "border-alerte/30 bg-alerte-clair")}>
            <p className={cn("font-mono text-xs uppercase tracking-[0.12em]", rapport.mode === "ia" ? "text-succes" : "text-alerte")}>{rapport.mode === "ia" ? "Proposé par l'IA" : "Composé sans IA"}</p>
            <p className="mt-1 text-[15px] leading-snug text-encre">{rapport.message}</p>
            {rapport.aVerifier > 0 && (
              <p className="mt-2 text-[14px] font-semibold text-alerte">
                {rapport.aVerifier > 1 ? `${rapport.aVerifier} plans sont marqués « à relire »` : "Un plan est marqué « à relire »"} : son extrait n'a pas été retrouvé mot pour mot dans la source.
              </p>
            )}
            {rapport.manques.length > 0 && (
              <div className="mt-2">
                <p className="text-[14px] font-semibold">Ce que les sources ne disent pas :</p>
                <ul className="mt-1 list-disc pl-5 text-[14px] text-texte-doux">
                  {rapport.manques.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <Fenetre
        ouverte={confirmer}
        onFermer={() => setConfirmer(false)}
        titre="Recomposer la présentation ?"
        description={
          appauvrit
            ? `${d.ia.disponible ? "Sans source lisible" : "Sans l'assistant IA"}, la nouvelle composition ne reprendra que le profil et l'emploi du temps : elle remplacera les plans actuels, plus complets.`
            : "Les plans actuels, et les retouches faites à la main, seront remplacés par une nouvelle composition."
        }
        pied={
          <>
            <Bouton variante="fantome" onClick={() => setConfirmer(false)}>
              Garder mes plans
            </Bouton>
            <Bouton onClick={() => void composer()}>Recomposer</Bouton>
          </>
        }
      />
    </Bloc>
  );
}
