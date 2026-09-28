// L'éditeur de la présentation de 30 secondes, commun à « Ma présentation »
// (le formateur) et à la direction : sources, photo, composition, plans,
// aperçu en direct du lecteur, validation et publication.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb, Save, Undo2 } from "lucide-react";
import { patch, ErreurApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Bouton } from "@/components/ui/bouton";
import { Chargement, Erreur } from "@/components/ui/divers";
import { Onglets } from "@/components/ui/onglets";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { rythmer, type PlanShowreel, type RapportComposition, type ReponseComposition, type ShowreelEditionDto } from "@shared/schema";
import { Showreel } from "./Showreel";
import { Bloc, textes } from "./editeur/communs";
import { Sources } from "./editeur/Sources";
import { Photo } from "./editeur/Photo";
import { Composer } from "./editeur/Composer";
import { EditeurPlans } from "./editeur/Plans";
import { Statut } from "./editeur/Statut";

const signature = (plans: PlanShowreel[]) => JSON.stringify(plans.map(({ duree: _d, ...p }) => p));

function useEcranEtroit() {
  const [etroit, setEtroit] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 1023px)");
    const ecouter = () => setEtroit(m.matches);
    m.addEventListener("change", ecouter);
    return () => m.removeEventListener("change", ecouter);
  }, []);
  return etroit;
}

export function EditeurPresentation({ cible }: { cible: "moi" | number }) {
  const cle = ["/api/showreels", String(cible)];
  const q = useQuery<ShowreelEditionDto>({ queryKey: cle });
  const [brouillon, setBrouillon] = useState<PlanShowreel[] | null>(null);
  const [rapport, setRapport] = useState<RapportComposition | null>(null);
  const etroit = useEcranEtroit();
  const [format, setFormat] = useState<"paysage" | "portrait">(etroit ? "portrait" : "paysage");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const d = q.data;

  const plans = useMemo(() => rythmer(brouillon ?? d?.plans ?? []), [brouillon, d?.plans]);
  const modifie = Boolean(d && brouillon && signature(brouillon) !== signature(d.plans));

  // Quitter la page avec des modifications non enregistrées : le navigateur prévient.
  useEffect(() => {
    if (!modifie) return;
    const avant = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avant);
    return () => window.removeEventListener("beforeunload", avant);
  }, [modifie]);

  if (q.isLoading) return <Chargement lignes={4} />;
  if (q.error || !d) return <Erreur message={q.error instanceof ErreurApi ? q.error.message : "La présentation n'a pas pu être chargée."} reessayer={() => void q.refetch()} />;

  const { t } = textes(d);
  const surMaj = (x: ShowreelEditionDto) => queryClient.setQueryData(cle, x);
  const surComposition = (r: ReponseComposition) => {
    surMaj(r.showreel);
    setBrouillon(null);
    setRapport(r.rapport);
    window.setTimeout(() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };

  async function enregistrer() {
    if (!brouillon) return;
    setErreur(null);
    setEnvoi(true);
    try {
      surMaj(await patch<ShowreelEditionDto>(`/api/showreels/${cible}`, { plans: brouillon.map(({ duree: _d, ...p }) => p) }));
      setBrouillon(null);
      toast("Plans enregistrés.");
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Les plans n'ont pas pu être enregistrés. Réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  // Faits sûrs seulement (brouillon de départ, composition de secours ou quatre plans au plus) et aucune source à lire : on invite à en donner.
  const departSeulement = (d.composition === "depart" || d.composition === "secours" || d.plans.length <= 4) && d.composition !== "ia" && !d.sources.some((s) => s.type === "site" || s.type === "pdf");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(400px,540px)] lg:items-start">
      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:order-2">
        <div className="flex flex-col gap-3 rounded-[22px] border border-ligne bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">Aperçu en direct</p>
            <Onglets
              valeur={format}
              onChange={setFormat}
              options={[
                { valeur: "paysage", libelle: "16:9 · page" },
                { valeur: "portrait", libelle: "9:16 · téléphone" },
              ]}
            />
          </div>
          <div className={cn("mx-auto w-full overflow-hidden rounded-2xl bg-encre", format === "portrait" && "aspect-[9/16] h-[min(68dvh,640px)] w-auto")}>
            <Showreel key={format} scenes={plans} formateur={d.formateur} format={format} plein={format === "portrait"} />
          </div>
          <p className="text-[13px] text-texte-gris">{modifie ? "L'aperçu montre vos modifications, pas encore enregistrées." : "Touchez l'aperçu pour le lire ou le mettre en pause."}</p>
        </div>
        <Statut d={d} modifie={modifie} surMaj={surMaj} />
      </aside>

      <div className="flex min-w-0 flex-col gap-5 lg:order-1">
        {departSeulement && (
          <div className="flex items-start gap-3 rounded-[22px] border-2 border-orange bg-orange-pale p-5">
            <Lightbulb className="mt-0.5 h-6 w-6 shrink-0 text-orange-fonce" aria-hidden />
            <div>
              <p className="text-[17px] font-extrabold">{t("Votre présentation ne contient encore que des faits sûrs", "Sa présentation ne contient encore que des faits sûrs")}</p>
              <p className="mt-1 text-[15px] leading-snug text-texte-doux">
                {t(
                  "Votre nom, votre cours et votre jour au campus. Collez votre lien (site personnel, LinkedIn) ou déposez le PDF de votre profil LinkedIn, puis « Composer ma présentation » : l'assistant compose le reste à partir de vos sources, et de rien d'autre.",
                  `Son nom, son cours et son jour au campus. Collez son lien (site personnel, LinkedIn) ou déposez le PDF de son profil LinkedIn, puis « Composer sa présentation » : l'assistant compose le reste à partir de ses sources, et de rien d'autre.`,
                )}
              </p>
            </div>
          </div>
        )}
        <Sources d={d} surMaj={surMaj} />
        <Photo d={d} surMaj={surMaj} />
        <Composer d={d} rapport={rapport} modifie={modifie} surComposition={surComposition} />
        <Bloc id="plans" numero={4} titre="Les plans" description="Chaque plan en clair : corrigez un mot, changez l'ordre, retirez ou ajoutez un plan. L'aperçu suit en direct.">
          <EditeurPlans plans={plans} sources={d.sources} campus={d.formateur.campus} onChange={setBrouillon} />
          {(modifie || erreur) && (
            <div className="sticky bottom-24 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-encre px-4 py-3 text-white shadow-carte lg:bottom-4">
              <span className="text-[15px] font-semibold">{erreur ?? "Modifications non enregistrées."}</span>
              <div className="flex gap-2">
                <Bouton variante="nuit" icone={<Undo2 className="h-4 w-4" />} onClick={() => (setBrouillon(null), setErreur(null))}>
                  Annuler
                </Bouton>
                <Bouton icone={<Save className="h-4 w-4" />} chargement={envoi} onClick={() => void enregistrer()}>
                  Enregistrer
                </Bouton>
              </div>
            </div>
          )}
        </Bloc>
      </div>
    </div>
  );
}
