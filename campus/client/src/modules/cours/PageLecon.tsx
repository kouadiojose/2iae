// Lecture d'une leçon, confortable sur téléphone : texte en 17 px, vidéo au
// toucher, fichiers avec leur poids, gros bouton « J'ai terminé », leçon
// suivante et assistant IA à portée de pouce.
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, PenLine, Undo2, BookOpen } from "lucide-react";
import { Page } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { EtatVide, Erreur, Squelette, BarreProgression } from "@/components/ui/divers";
import { Markdown } from "@/components/ui/markdown";
import { toast, toastErreur } from "@/components/ui/toast";
import { useMoiConnecte } from "@/lib/auth";
import { ErreurApi, post, suppr } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { BoutonAssistant } from "@/modules/ia/BoutonAssistant";
import { MediaLecon } from "./composants/MediasLecon";
import { TYPES_LECON_INFOS, dureeLecon, typographie } from "./outils";
import type { LeconDetail, ReponseTerminee } from "@shared/schema";

export default function PageLecon({ id, leconId }: { id: string; leconId: string }) {
  const moi = useMoiConnecte();
  const etudiant = moi.role === "etudiant";
  const coursId = Number(id);
  const lId = Number(leconId);
  const cle = ["/api/cours", coursId, "lecons", lId];
  const { data: lecon, isLoading, error, refetch } = useQuery<LeconDetail>({ queryKey: cle });
  const [envoi, setEnvoi] = useState(false);
  const [progression, setProgression] = useState<ReponseTerminee["progression"] | null>(null);

  async function basculer(terminee: boolean) {
    if (!lecon) return;
    setEnvoi(true);
    try {
      const r = terminee ? await post<ReponseTerminee>(`/api/lecons/${lecon.id}/terminee`) : await suppr<ReponseTerminee>(`/api/lecons/${lecon.id}/terminee`);
      queryClient.setQueryData<LeconDetail>(cle, (l) => (l ? { ...l, terminee: r.terminee } : l));
      setProgression(r.progression);
      if (terminee) toast(r.progression.pourcentage === 100 ? "Bravo, tu as terminé tout le cours !" : `Leçon terminée · ${r.progression.pourcentage} % du cours`);
      // La liste des cours, la page du cours et l'accueil affichent la progression.
      void rafraichir("/api/cours", "/api/accueil");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  if (isLoading) {
    return (
      <Page className="max-w-[760px]">
        <Squelette className="h-6 w-40" />
        <Squelette className="h-12 w-full" />
        <Squelette className="h-64 w-full" />
      </Page>
    );
  }
  if (error || !lecon) {
    const statut = error instanceof ErreurApi ? error.statut : 0;
    return (
      <Page className="max-w-[760px]">
        {statut === 403 || statut === 404 ? (
          <EtatVide
            icone={<BookOpen className="h-6 w-6" />}
            titre={statut === 404 ? "Cette leçon n'est pas (ou plus) disponible." : etudiant ? "Tu n'es pas inscrit à ce cours." : "Cette leçon ne vous est pas accessible."}
            texte="Le formateur l'a peut-être retirée ou pas encore publiée. Retourne au cours pour voir les leçons disponibles."
            action={
              <LienBouton href={statut === 404 ? `/cours/${coursId}` : "/cours"} variante="contour" icone={<ArrowLeft className="h-4 w-4" />} className="min-h-[48px]">
                Retour au cours
              </LienBouton>
            }
          />
        ) : (
          <Erreur message={(error as Error)?.message ?? "Leçon introuvable."} reessayer={() => void refetch()} />
        )}
      </Page>
    );
  }

  const Icone = TYPES_LECON_INFOS[lecon.type].icone;
  const duree = dureeLecon(lecon.dureeMinutes);
  const suivante = lecon.suivante;

  return (
    <Page className="max-w-[760px] gap-5">
      <Link href={`/cours/${lecon.coursId}`} className="-mb-1 inline-flex min-h-[44px] items-center gap-2 self-start text-[15px] font-semibold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" />
        <span className="font-mono text-[13px] text-orange-fonce">{lecon.coursCode}</span>
        <span className="line-clamp-1">{lecon.coursTitre}</span>
      </Link>

      {!lecon.publiee && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-alerte-clair px-5 py-3.5 text-[15px] text-alerte">
          <span className="font-semibold">Brouillon : les étudiants ne voient pas encore cette leçon.</span>
          {lecon.enseignant && (
            <LienBouton href={`/enseigner/cours/${lecon.coursId}?lecon=${lecon.id}#programme`} variante="contour" taille="sm" icone={<PenLine className="h-4 w-4" />}>
              Modifier
            </LienBouton>
          )}
        </div>
      )}

      <header className="flex flex-col gap-2.5">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-fonce">
          {lecon.numero ? `Leçon ${lecon.numero}` : "Leçon"} · {lecon.chapitre.titre}
        </span>
        <h1 className="text-[28px] font-black leading-[1.08] tracking-serre sm:text-[38px]">{lecon.titre}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-texte-pale">
          <span className="inline-flex items-center gap-1.5">
            <Icone className="h-4 w-4" /> {TYPES_LECON_INFOS[lecon.type].libelle}
          </span>
          {duree && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> {duree}
            </span>
          )}
          {lecon.total > 0 && lecon.rang > 0 && (
            <span className="font-mono text-[13px]">
              {lecon.rang} sur {lecon.total}
            </span>
          )}
          {etudiant && lecon.terminee && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-succes">
              <CheckCircle2 className="h-4 w-4" /> Terminée
            </span>
          )}
        </div>
      </header>

      <MediaLecon type={lecon.type} url={lecon.url} fichier={lecon.fichier} titre={lecon.titre} minutes={lecon.dureeMinutes} />

      {lecon.contenu.trim() ? (
        <article>
          <Markdown source={typographie(lecon.contenu)} className="text-[17px] leading-[1.7] [&_h2]:text-[22px] [&_h3]:text-[19px] [&_li]:my-1.5" />
        </article>
      ) : null}

      {/* Action principale */}
      <div className="mt-2 flex flex-col gap-3 border-t border-ligne pt-6">
        {etudiant && !lecon.terminee && (
          <>
            <Bouton taille="lg" pleineLargeur chargement={envoi} icone={<Check className="h-5 w-5" strokeWidth={3} />} onClick={() => void basculer(true)} className="min-h-[56px] text-[17px]">
              J'ai terminé
            </Bouton>
            {suivante && (
              <LienBouton href={`/cours/${lecon.coursId}/lecons/${suivante.id}`} variante="fantome" className="min-h-[48px]">
                Passer à la leçon suivante sans cocher
              </LienBouton>
            )}
          </>
        )}

        {etudiant && lecon.terminee && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-succes-clair px-5 py-4">
              <span className="inline-flex items-center gap-2 text-base font-bold text-succes">
                <CheckCircle2 className="h-5 w-5" /> Leçon terminée
              </span>
              <button
                type="button"
                onClick={() => void basculer(false)}
                disabled={envoi}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-texte-pale hover:bg-white hover:text-encre"
              >
                <Undo2 className="h-4 w-4" /> Annuler
              </button>
            </div>
            {progression && (
              <div className="flex items-center gap-3">
                <BarreProgression valeur={progression.pourcentage} className="flex-1" ton={progression.pourcentage === 100 ? "succes" : "orange"} />
                <span className="font-mono text-[13px] text-texte-pale">{progression.pourcentage} % du cours</span>
              </div>
            )}
            {suivante ? (
              <LienBouton href={`/cours/${lecon.coursId}/lecons/${suivante.id}`} taille="lg" icone={<ArrowRight className="h-5 w-5" />} className="min-h-[56px] text-[17px]">
                <span className="truncate">Leçon suivante : {suivante.titre}</span>
              </LienBouton>
            ) : (
              <LienBouton href={`/cours/${lecon.coursId}`} taille="lg" icone={<ArrowLeft className="h-5 w-5" />} className="min-h-[56px] text-[17px]">
                Retour au cours
              </LienBouton>
            )}
          </>
        )}

        {!etudiant && lecon.enseignant && (
          <LienBouton href={`/enseigner/cours/${lecon.coursId}?lecon=${lecon.id}#programme`} variante="contour" icone={<PenLine className="h-4 w-4" />} className="min-h-[48px]">
            Modifier cette leçon
          </LienBouton>
        )}
      </div>

      {/* Précédente · suivante */}
      {(lecon.precedente || suivante) && (
        <nav className="grid grid-cols-2 gap-3" aria-label="Autres leçons">
          {lecon.precedente ? (
            <VoisineLien coursId={lecon.coursId} lecon={lecon.precedente} sens="precedente" />
          ) : (
            <span />
          )}
          {suivante ? <VoisineLien coursId={lecon.coursId} lecon={suivante} sens="suivante" /> : <span />}
        </nav>
      )}

      <BoutonAssistant coursId={lecon.coursId} leconId={lecon.id} variante="flottant" />
    </Page>
  );
}

function VoisineLien({ coursId, lecon, sens }: { coursId: number; lecon: { id: number; titre: string; numero: string }; sens: "precedente" | "suivante" }) {
  const suivante = sens === "suivante";
  return (
    <Link
      href={`/cours/${coursId}/lecons/${lecon.id}`}
      className={cn(
        "flex min-h-[64px] flex-col justify-center gap-0.5 rounded-2xl border border-ligne px-4 py-3 text-encre no-underline transition-colors hover:border-orange hover:text-encre",
        suivante && "items-end text-right",
      )}
    >
      <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-texte-gris">
        {!suivante && <ChevronLeft className="h-3.5 w-3.5" />}
        {suivante ? "Suivante" : "Précédente"}
        {suivante && <ChevronRight className="h-3.5 w-3.5" />}
      </span>
      <span className="line-clamp-2 text-[15px] font-semibold leading-snug">
        {lecon.numero && <span className="font-mono text-[13px] text-orange-fonce">{lecon.numero} </span>}
        {lecon.titre}
      </span>
    </Link>
  );
}
