// Dossier d'étude d'un livre lu en entier par le campus : on le lance une fois
// (1 à 3 minutes), il est gardé pour tout le campus. Résumé détaillé, plan,
// idées clés, notions, citations vérifiées, exposé, travail de groupe,
// questions de révision.
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, ChevronDown, Lightbulb, MessageSquareText, Presentation, Quote, RotateCcw, Sparkles, Users } from "lucide-react";
import { post } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { Bouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { BarreProgression } from "@/components/ui/divers";
import { Markdown } from "@/components/ui/markdown";
import { toastErreur } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { DossierLivre, EtudeLivreDto } from "@shared/schema/ext-etudes";

type EtatEtude = { etude: EtudeLivreDto | null; etudiable: boolean };

/** Suit (et lance) l'étude d'un livre ; interroge le serveur toutes les 3 s pendant la lecture. */
export function useEtudeLivre(livreId: number, initiale: EtudeLivreDto | null, etudiable: boolean) {
  const cle = `/api/bibliotheque/livres/${livreId}/etude`;
  const { data } = useQuery<EtatEtude>({
    queryKey: [cle],
    initialData: { etude: initiale, etudiable },
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.etude?.statut === "en_cours" ? 3000 : false),
  });
  const etude = data?.etude ?? null;
  const [lancement, setLancement] = useState(false);
  /** Renvoie faux si la lecture n'a pas pu être lancée (le message est déjà affiché). */
  const lancer = async (): Promise<boolean> => {
    setLancement(true);
    try {
      const r = await post<EtatEtude>(cle);
      queryClient.setQueryData<EtatEtude>([cle], r);
      return true;
    } catch (e) {
      toastErreur(e);
      return false;
    } finally {
      setLancement(false);
    }
  };
  // Dossier prêt : la page du livre est rechargée (fiche rédigée d'après le texte entier).
  useEffect(() => {
    if (etude?.statut === "prete") void rafraichir(`/api/bibliotheque/livres/${livreId}`);
  }, [etude?.statut, livreId]);
  return { etude, lancer, lancement, pret: etude?.statut === "prete", enCours: etude?.statut === "en_cours" };
}

/** Lecture en cours : étape et progression. */
export function AvancementEtude({ etude, etudiant, pourQuestion }: { etude: EtudeLivreDto; etudiant: boolean; pourQuestion?: boolean }) {
  return (
    <Carte className="flex flex-col gap-3" role="status">
      <div className="flex items-center gap-2 font-extrabold">
        <BookOpenCheck className="h-5 w-5 text-orange-fonce" aria-hidden />
        {pourQuestion ? (etudiant ? "Je lis le livre pour te répondre…" : "Le campus lit le livre pour vous répondre…") : etudiant ? "Le campus lit le livre en entier…" : "Le campus lit le livre en entier…"}
      </div>
      <BarreProgression valeur={etude.progression} />
      <p className="text-sm text-texte-pale">
        {etude.etape ?? "Lecture"} · {etude.progression} %. Compte une à trois minutes ; le dossier est ensuite gardé pour tout le campus.
        {pourQuestion ? (etudiant ? " Ta question partira toute seule dès que la lecture sera finie." : " Votre question partira toute seule dès que la lecture sera finie.") : ""}
      </p>
    </Carte>
  );
}

/** Proposition de lancer la lecture (pas encore de dossier), ou relance après un échec. */
export function LancerEtude({ etude, etudiant, onLancer, lancement, desactive }: { etude: EtudeLivreDto | null; etudiant: boolean; onLancer: () => void; lancement: boolean; desactive?: boolean }) {
  return (
    <Carte className="flex flex-col items-start gap-3">
      <Sparkles className="h-7 w-7 text-orange-fonce" aria-hidden />
      <p className="text-[17px] font-extrabold">{etudiant ? "Le dossier d'étude complet de ce livre" : "Le dossier d'étude complet de ce livre"}</p>
      <p className="text-[15px] text-texte-pale">
        Le campus lit le livre en entier, puis prépare son dossier : résumé détaillé, plan, idées clés, notions, citations, plan d'exposé, travail de groupe et questions de
        révision. Une seule lecture pour tout le campus : les étudiants suivants l'ont tout de suite.
      </p>
      {etude?.statut === "erreur" && etude.message && <p className="text-sm text-alerte">{etude.message}</p>}
      <Bouton onClick={onLancer} chargement={lancement} disabled={desactive} icone={etude?.statut === "erreur" ? <RotateCcw className="h-4 w-4" /> : <BookOpenCheck className="h-4 w-4" />}>
        {etude?.statut === "erreur" ? "Relancer la lecture" : etudiant ? "Lire le livre et préparer le dossier" : "Lire le livre et préparer le dossier"}
      </Bouton>
    </Carte>
  );
}

function Section({ titre, icone, children, ouverte = true }: { titre: string; icone?: ReactNode; children: ReactNode; ouverte?: boolean }) {
  const [ouvert, setOuvert] = useState(ouverte);
  return (
    <section className="flex flex-col gap-3">
      <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center justify-between gap-2 text-left" aria-expanded={ouvert}>
        <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">
          {icone}
          {titre}
        </h2>
        <ChevronDown className={cn("h-4 w-4 text-texte-gris transition-transform", ouvert && "rotate-180")} aria-hidden />
      </button>
      {ouvert && children}
    </section>
  );
}

/** Le dossier d'étude, lisible sur un téléphone, sections repliables. */
export function VueDossier({ dossier: d, etudiant, onQuestions, onExpose }: { dossier: DossierLivre; etudiant: boolean; onQuestions: () => void; onExpose: () => void }) {
  return (
    <article className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-succes-clair px-4 py-3 text-[15px] text-succes">
        <BookOpenCheck className="h-5 w-5 shrink-0" aria-hidden />
        {etudiant ? "Dossier préparé après lecture du livre entier par le campus." : "Dossier préparé après lecture du livre entier par le campus."}
      </div>

      <Carte className="flex flex-col gap-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">Présentation</h2>
        <Markdown source={d.presentation} />
      </Carte>

      <Section titre="Résumé détaillé">
        <Carte>
          <Markdown source={d.resume} />
        </Carte>
      </Section>

      {d.plan.length > 0 && (
        <Section titre="Plan du livre">
          <ol className="flex flex-col divide-y divide-ligne-douce rounded-2xl border border-ligne bg-white">
            {d.plan.map((p, n) => (
              <li key={n} className="px-4 py-3">
                <p className="font-bold">
                  {p.partie} <span className="font-mono text-xs font-normal text-texte-gris">{p.position}</span>
                </p>
                <p className="text-[15px] text-texte-pale">{p.resume}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section titre="Idées clés" icone={<Lightbulb className="h-3.5 w-3.5" aria-hidden />}>
        <ol className="flex flex-col gap-2.5">
          {d.ideesCles.map((i, n) => (
            <li key={n} className="flex gap-3 rounded-2xl border border-ligne bg-white p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange font-black text-encre">{n + 1}</span>
              <div>
                <p className="font-extrabold">{i.titre}</p>
                <p className="text-[15px] leading-relaxed text-texte-doux">{i.explication}</p>
                {i.position && <p className="mt-1 font-mono text-xs text-texte-gris">{i.position}</p>}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {d.concepts.length > 0 && (
        <Section titre="Notions à connaître">
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {d.concepts.map((c, n) => (
              <div key={n} className="rounded-2xl border border-ligne bg-white p-3.5">
                <dt className="font-extrabold">{c.terme}</dt>
                <dd className="text-[15px] text-texte-pale">{c.definition}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {d.citations.length > 0 && (
        <Section titre="Citations" icone={<Quote className="h-3.5 w-3.5" aria-hidden />}>
          <ul className="flex flex-col gap-2.5">
            {d.citations.map((c, n) => (
              <li key={n} className="rounded-2xl border-l-4 border-orange bg-white p-4">
                <p className="font-serif text-[17px] italic leading-relaxed">« {c.texte} »</p>
                <p className="mt-1.5 text-sm text-texte-pale">
                  {c.commentaire} <span className="font-mono text-xs text-texte-gris">({c.position})</span>
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {d.faits.length > 0 && (
        <Section titre="Faits et exemples" ouverte={false}>
          <ul className="list-disc space-y-1.5 rounded-2xl border border-ligne bg-white py-3 pl-8 pr-4 text-[15px]">
            {d.faits.map((f, n) => (
              <li key={n}>{f}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section titre="Et chez nous ?">
        <Carte className="text-[15px] leading-relaxed">{d.afrique}</Carte>
      </Section>

      {d.critique.length > 0 && (
        <Section titre="Limites et débats" ouverte={false}>
          <ul className="list-disc space-y-1.5 rounded-2xl border border-ligne bg-white py-3 pl-8 pr-4 text-[15px]">
            {d.critique.map((c, n) => (
              <li key={n}>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section titre="Préparer un exposé" icone={<Presentation className="h-3.5 w-3.5" aria-hidden />}>
        <Carte className="flex flex-col gap-3">
          <p className="font-extrabold">Problématique : {d.expose.problematique}</p>
          <ol className="flex flex-col gap-2">
            {d.expose.plan.map((p, n) => (
              <li key={n} className="text-[15px]">
                <span className="font-bold">{p.partie}</span> : {p.contenu}
              </li>
            ))}
          </ol>
          {d.expose.conseils.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-texte-pale">
              {d.expose.conseils.map((c, n) => (
                <li key={n}>{c}</li>
              ))}
            </ul>
          )}
          <Bouton variante="contour" taille="sm" icone={<Presentation className="h-4 w-4" />} onClick={onExpose} className="self-start">
            {etudiant ? "Préparer mon exposé avec diapositives" : "Préparer un exposé avec diapositives"}
          </Bouton>
        </Carte>
      </Section>

      <Section titre="Travail de groupe" icone={<Users className="h-3.5 w-3.5" aria-hidden />}>
        <Carte className="flex flex-col gap-3">
          <p className="font-extrabold">{d.groupe.sujet}</p>
          <ul className="flex flex-col gap-1.5 text-[15px]">
            {d.groupe.roles.map((r, n) => (
              <li key={n}>
                <span className="font-bold">{r.role}</span> : {r.mission}
              </li>
            ))}
          </ul>
          {d.groupe.debat.length > 0 && (
            <div>
              <p className="text-sm font-bold">Questions pour le débat</p>
              <ul className="list-disc space-y-1 pl-5 text-[15px]">
                {d.groupe.debat.map((q, n) => (
                  <li key={n}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-texte-pale">À rendre : {d.groupe.livrable}</p>
        </Carte>
      </Section>

      {d.revision.length > 0 && (
        <Section titre="Questions de révision" ouverte={false}>
          <ul className="flex flex-col gap-2">
            {d.revision.map((q, n) => (
              <li key={n}>
                <details className="rounded-2xl border border-ligne bg-white px-4 py-3">
                  <summary className="cursor-pointer font-bold">{q.question}</summary>
                  <p className="mt-2 text-[15px] text-texte-doux">{q.reponse}</p>
                </details>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Carte className="flex flex-col gap-1.5">
          <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">Pour qui</h2>
          <p className="text-[15px] leading-relaxed">{d.pourQui}</p>
        </Carte>
        <Carte className="flex flex-col gap-1.5 bg-encre text-white">
          <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-orange">À retenir</h2>
          <p className="text-[17px] font-bold leading-snug">{d.aRetenir}</p>
        </Carte>
      </div>
      <Bouton variante="contour" icone={<MessageSquareText className="h-4 w-4" />} onClick={onQuestions} className="self-start">
        {etudiant ? "Poser mes questions sur ce livre" : "Poser vos questions sur ce livre"}
      </Bouton>
    </article>
  );
}
