// /assistant — accueil de l'assistant : choisir son cours, poser sa question
// (ou partir d'une suggestion), retrouver ses conversations, lire la charte.
// Le formateur y trouve aussi ses outils (préparer une séance, accroche pour
// 2iae.com, fiches de révision à relire).
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, MessageSquareText, Trash2, ShieldCheck, CalendarClock, Globe, FileCheck2, ChevronRight, GraduationCap, Lightbulb } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { post, suppr } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { relatif } from "@/lib/dates";
import { maintenantServeur } from "@/lib/horloge";
import { cn } from "@/lib/utils";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Carte, TitreSection } from "@/components/ui/carte";
import { Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { Fenetre } from "@/components/ui/fenetre";
import { toastErreur, toast } from "@/components/ui/toast";
import type { ConversationIaResume, FicheRevisionDto } from "@shared/schema/ext-ia";
import { useEtatIa, useCoursAssistant, blocageDe, mettreEnAttente } from "./api-ia";
import { BandeauBlocage, LigneQuota, ZoneQuestion, PucesSuggestions } from "./composants";
import { FenetreAccroche } from "./FenetreAccroche";

const SANS_COURS = 0;

export default function PageAssistant() {
  const moi = useMoiConnecte();
  const enseignant = moi.role !== "etudiant";
  const [, naviguer] = useLocation();
  const { data: etat } = useEtatIa();
  const coursQ = useCoursAssistant();
  const conversationsQ = useQuery<ConversationIaResume[]>({ queryKey: ["/api/ia/conversations"] });
  const [coursId, setCoursId] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [aSupprimer, setASupprimer] = useState<ConversationIaResume | null>(null);
  const [accroche, setAccroche] = useState(false);

  // Premier cours choisi d'office : la plupart des étudiants n'en suivent que quelques-uns.
  useEffect(() => {
    if (coursId === null && coursQ.data) setCoursId(coursQ.data[0]?.id ?? SANS_COURS);
  }, [coursQ.data, coursId]);

  const blocage = blocageDe(etat);
  const coursChoisi = coursQ.data?.find((c) => c.id === coursId) ?? null;
  const suggestions = coursChoisi
    ? coursChoisi.suggestions
    : enseignant
      ? ["Comment rendre un cours en ligne plus vivant ?", "Proposez un exemple ivoirien pour expliquer la marge"]
      : ["Comment bien organiser mes révisions ?", "Explique-moi la différence entre chiffre d'affaires et bénéfice"];

  const demander = async (texte: string) => {
    const t = texte.trim();
    if (!t || blocage || envoi) return;
    setEnvoi(true);
    try {
      const conv = await post<ConversationIaResume>("/api/ia/conversations", coursId ? { coursId } : {});
      mettreEnAttente(conv.id, t);
      naviguer(`/assistant/${conv.id}`);
    } catch (e) {
      toastErreur(e);
      setEnvoi(false);
      void rafraichir("/api/ia/etat");
    }
  };

  const supprimer = async () => {
    if (!aSupprimer) return;
    try {
      await suppr(`/api/ia/conversations/${aSupprimer.id}`);
      toast("Conversation supprimée");
      setASupprimer(null);
      void rafraichir("/api/ia/conversations");
    } catch (e) {
      toastErreur(e);
    }
  };

  return (
    <Page>
      <EnTetePage
        etiquette={enseignant ? "Assistant IA · pour l'équipe pédagogique" : "Assistant IA · réponses tirées de tes cours"}
        titre={enseignant ? "Posez une question sur vos cours" : "Pose ta question sur tes cours"}
        sousTitre={
          enseignant
            ? "L'assistant s'appuie sur vos leçons publiées, les fiches validées et les résumés de séance, et cite ses sources."
            : "L'assistant répond avec tes leçons et te dit d'où vient chaque réponse. Il t'aide à comprendre ; il ne fait pas tes devoirs."
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-5">
          <BandeauBlocage etat={etat} enseignant={enseignant} />

          <section className="flex flex-col gap-4 rounded-[28px] bg-creme p-4 sm:p-6" aria-label="Nouvelle question">
            <div className="flex flex-col gap-2">
              <span className="etiquette">{enseignant ? "Le cours concerné" : "Ton cours"}</span>
              {coursQ.isLoading ? (
                <div className="h-12 animate-pulse rounded-full bg-white" />
              ) : (
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="radiogroup" aria-label="Choix du cours">
                  {(coursQ.data ?? []).map((c) => (
                    <PuceCours key={c.id} actif={coursId === c.id} onClick={() => setCoursId(c.id)} code={c.code} titre={c.titre} couleur={c.couleur} />
                  ))}
                  <PuceCours actif={coursId === SANS_COURS} onClick={() => setCoursId(SANS_COURS)} code="Autre" titre="Sans cours précis" couleur="#8A7F76" />
                </div>
              )}
            </div>

            <ZoneQuestion
              valeur={question}
              onChange={setQuestion}
              onEnvoyer={() => void demander(question)}
              desactive={Boolean(blocage)}
              occupe={envoi}
              enseignant={enseignant}
              placeholder={
                enseignant
                  ? "Ex. : quelles notions de la leçon 2 posent souvent problème ?"
                  : coursChoisi
                    ? `Ex. : c'est quoi un modèle de langage ?`
                    : "Ex. : comment bien réviser avant un examen ?"
              }
            />
            <LigneQuota etat={etat} enseignant={enseignant} />

            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs text-texte-gris">{enseignant ? "Pour démarrer" : "Idées de questions"}</span>
              <PucesSuggestions suggestions={suggestions} onChoisir={(s) => void demander(s)} desactive={Boolean(blocage) || envoi} />
            </div>
          </section>

          {enseignant ? (
            <OutilsEnseignant onAccroche={() => setAccroche(true)} desactive={!etat?.disponible} />
          ) : (
            <ConseilsQuestion />
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="titre-conversations">
            <TitreSection titre={<span id="titre-conversations">{enseignant ? "Vos conversations" : "Tes conversations"}</span>} />
            {conversationsQ.isLoading ? (
              <Chargement lignes={3} />
            ) : conversationsQ.error ? (
              <Erreur message={(conversationsQ.error as Error).message} reessayer={() => void conversationsQ.refetch()} />
            ) : !conversationsQ.data?.length ? (
              <EtatVide
                icone={<MessageSquareText className="h-6 w-6" />}
                titre="Aucune conversation pour l'instant"
                texte={
                  enseignant
                    ? "Vos échanges avec l'assistant apparaîtront ici. Ils restent privés."
                    : "Tes questions et les réponses apparaîtront ici, pour les relire avant un devoir ou un examen. Elles restent privées."
                }
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {conversationsQ.data.map((c) => (
                  <li key={c.id} className="flex items-stretch gap-1 rounded-2xl border border-ligne bg-white transition-colors hover:border-orange">
                    <Link href={`/assistant/${c.id}`} className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 px-4 py-3 text-encre no-underline hover:text-encre">
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-mono text-[10px] font-semibold text-encre"
                        style={{ background: c.cours ? `${c.cours.couleur}33` : "#FBF6F2" }}
                        aria-hidden
                      >
                        {c.cours ? c.cours.code.split("-")[0] : <Sparkles className="h-4 w-4 text-orange-fonce" />}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[15px] font-bold">{c.titre}</span>
                        <span className="truncate font-mono text-xs text-texte-gris">
                          {c.cours?.code ?? "Sans cours"}
                          {c.tuteur && <span className="text-orange-fonce"> · mode tuteur</span>} · {relatif(c.majLe, maintenantServeur())}
                        </span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setASupprimer(c)}
                      className="grid w-12 shrink-0 place-items-center rounded-r-2xl text-texte-gris hover:bg-danger-clair hover:text-danger"
                      aria-label={`Supprimer la conversation « ${c.titre} »`}
                    >
                      <Trash2 className="h-[18px] w-[18px]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Carte className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-orange-fonce" aria-hidden />
              <h2 className="text-lg font-extrabold">{enseignant ? "Ce que l'assistant fait pour vos étudiants" : "Ce que fait l'assistant"}</h2>
            </div>
            <ul className="flex flex-col gap-2 text-[15px] leading-relaxed text-texte-doux">
              <li>• Il explique le cours et cite la leçon utilisée.</li>
              <li>• Sur un devoir, il guide par des questions sans donner la réponse.</li>
              <li>• Il se met en pause pendant les interrogations.</li>
              <li>• Les questions restent privées ; aucun nom n'est envoyé.</li>
            </ul>
            <Link href="/assistant/charte" className="inline-flex min-h-12 items-center gap-1 text-[15px] font-bold">
              Lire la charte de l'assistant <ChevronRight className="h-4 w-4" />
            </Link>
          </Carte>
        </aside>
      </div>

      <Fenetre
        ouverte={aSupprimer !== null}
        onFermer={() => setASupprimer(null)}
        titre="Supprimer cette conversation ?"
        description={aSupprimer ? `« ${aSupprimer.titre} » et toutes ses réponses seront effacées.` : undefined}
        pied={
          <>
            <Bouton variante="fantome" onClick={() => setASupprimer(null)}>
              Garder
            </Bouton>
            <Bouton variante="danger" onClick={() => void supprimer()}>
              Supprimer
            </Bouton>
          </>
        }
      />
      {enseignant && <FenetreAccroche ouverte={accroche} onFermer={() => setAccroche(false)} cours={(coursQ.data ?? []).filter((c) => c.enseignant)} />}
    </Page>
  );
}

function PuceCours({ actif, onClick, code, titre, couleur }: { actif: boolean; onClick: () => void; code: string; titre: string; couleur: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={actif}
      onClick={onClick}
      className={cn(
        "flex min-h-12 shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-left transition-colors",
        actif ? "border-encre bg-encre text-white" : "border-ligne bg-white text-encre hover:border-orange",
      )}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: couleur }} aria-hidden />
      <span className="font-mono text-xs">{code}</span>
      <span className="max-w-[200px] truncate text-[14px] font-bold sm:max-w-[340px]">{titre}</span>
    </button>
  );
}

function OutilsEnseignant({ onAccroche, desactive }: { onAccroche: () => void; desactive: boolean }) {
  const { data: aRelire } = useQuery<FicheRevisionDto[]>({ queryKey: ["/api/ia/fiches?aRelire=1"] });
  const n = aRelire?.length ?? 0;
  const outils = [
    {
      icone: <CalendarClock className="h-5 w-5" />,
      titre: "Préparer une séance",
      texte: "Plan minuté, 3 sondages éclair et QCM de sortie, à relire.",
      href: "/assistant/preparer-seance",
    },
    {
      icone: <Globe className="h-5 w-5" />,
      titre: "Accroche pour 2iae.com",
      texte: "Deux phrases pour présenter votre cours sur le site.",
      onClick: onAccroche,
    },
    {
      icone: <FileCheck2 className="h-5 w-5" />,
      titre: n ? `Fiches à relire (${n})` : "Fiches de révision",
      texte: n ? "« L'essentiel en 5 points » proposé par l'IA, en attente de votre validation." : "Relisez et validez les fiches avant qu'elles servent aux étudiants.",
      href: "/assistant/fiches",
    },
  ];
  return (
    <section aria-labelledby="titre-outils">
      <TitreSection
        titre={
          <span id="titre-outils" className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-orange-fonce" /> Vos outils
          </span>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {outils.map((o) => {
          const contenu = (
            <>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-clair text-orange-fonce">{o.icone}</span>
              <span className="flex flex-col gap-1">
                <span className="text-[17px] font-extrabold leading-tight">{o.titre}</span>
                <span className="text-[14px] leading-relaxed text-texte-pale">{o.texte}</span>
              </span>
            </>
          );
          const classes =
            "flex h-full items-start gap-3 rounded-2xl border border-ligne bg-white p-4 text-left text-encre no-underline transition-colors hover:border-orange hover:text-encre sm:flex-col";
          return o.href ? (
            <Link key={o.titre} href={o.href} className={classes}>
              {contenu}
            </Link>
          ) : (
            <button key={o.titre} type="button" onClick={o.onClick} disabled={desactive} className={cn(classes, "disabled:opacity-60")}>
              {contenu}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Trois conseils pour obtenir une réponse utile (l'étudiant apprend aussi à interroger une IA). */
function ConseilsQuestion() {
  const conseils = [
    { titre: "Précise l'endroit", texte: "« Dans la leçon 1.2, je ne comprends pas… » donne une réponse plus juste." },
    { titre: "Dis ce que tu sais déjà", texte: "L'assistant part de là et t'explique la suite, pas tout depuis le début." },
    { titre: "Vérifie avec ton cours", texte: "Clique sur la leçon citée pour relire le passage d'origine." },
  ];
  return (
    <section aria-labelledby="titre-conseils" className="flex flex-col gap-3">
      <h2 id="titre-conseils" className="flex items-center gap-2 text-xl font-extrabold">
        <Lightbulb className="h-5 w-5 text-orange-fonce" aria-hidden /> Bien poser ta question
      </h2>
      <ol className="grid gap-3 sm:grid-cols-3">
        {conseils.map((c, i) => (
          <li key={c.titre} className="flex flex-col gap-1.5 rounded-2xl border border-ligne bg-white p-4">
            <span className="font-mono text-xs text-orange-fonce">0{i + 1}</span>
            <span className="text-base font-extrabold leading-tight">{c.titre}</span>
            <span className="text-[14px] leading-relaxed text-texte-pale">{c.texte}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
