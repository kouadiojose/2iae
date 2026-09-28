// Bouton « Demander à l'assistant » (contrat partagé : utilisé par les
// modules cours et évaluations). Il ouvre une feuille de mini-conversation
// dans le contexte du cours, de la leçon (« L'essentiel en 5 points »,
// « Explique autrement », « Me faire réviser ») ou du devoir (mode tuteur).
//
//   <BoutonAssistant coursId={1} leconId={12} />            bouton flottant
//   <BoutonAssistant devoirId={3} variante="bouton" />      bouton dans la page
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Sparkles, ListOrdered, Shuffle, Brain, ArrowLeft, Maximize2, GraduationCap, Volume2, Square, Lightbulb, Workflow, MapPin } from "lucide-react";
import { useMoi } from "@/lib/auth";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Badge, Erreur, Squelette } from "@/components/ui/divers";
import { Markdown } from "@/components/ui/markdown";
import { ANGLES_EXPLICATION, type AngleExplication, type ExplicationAutrement, type FicheRevisionDto, type RevisionLecon } from "@shared/schema/ext-ia";
import { useEtatIa, blocageDe } from "./api-ia";
import { useConversationIa } from "./useConversationIa";
import { BandeauBlocage, EtiquetteIa, FilConversation, LigneQuota, PucesSuggestions, QuizRevision, ZoneQuestion } from "./composants";
import { useLecture } from "./voix";

type Props = { coursId?: number; leconId?: number; devoirId?: number; variante?: "flottant" | "bouton" };
type Vue = "accueil" | "essentiel" | "autrement" | "reviser";

export function BoutonAssistant({ coursId, leconId, devoirId, variante = "flottant" }: Props) {
  const { moi } = useMoi();
  const [ouverte, setOuverte] = useState(false);
  const compact = usePastilleCompacte(variante === "flottant");
  if (!moi || moi.role === "salle") return null;
  const enseignant = moi.role !== "etudiant";
  const libelle = devoirId && !enseignant ? "Bloqué ? Demande au tuteur" : "Demander à l'assistant";

  return (
    <>
      {variante === "flottant" ? (
        <button
          type="button"
          onClick={() => setOuverte(true)}
          className={cn(
            // Au-dessus de la barre d'onglets du téléphone (zone sûre comprise) ; libellé complet sur ordinateur.
            "fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-4 z-40 flex min-h-14 items-center gap-2.5 rounded-full bg-encre py-3 pl-4 pr-5 text-[15px] font-bold text-white shadow-telephone transition-all hover:bg-orange hover:text-encre lg:bottom-8 lg:right-8",
            // Pastille (icône seule) : sur téléphone uniquement.
            compact && "max-sm:w-14 max-sm:justify-center max-sm:p-0",
          )}
          aria-label={libelle}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange text-encre" aria-hidden>
            <Sparkles className="h-4 w-4" />
          </span>
          {!compact && <span className="sm:hidden">{devoirId && !enseignant ? "Tuteur" : "Assistant"}</span>}
          <span className="hidden sm:inline">{libelle}</span>
        </button>
      ) : (
        <Bouton variante="doux" taille="lg" icone={<Sparkles className="h-5 w-5 text-orange-fonce" />} onClick={() => setOuverte(true)} className="min-h-12">
          {libelle}
        </Bouton>
      )}
      {/* Clé = contexte : passer à la leçon suivante repart d'une conversation neuve. */}
      <FeuilleAssistant
        key={`${coursId ?? ""}-${leconId ?? ""}-${devoirId ?? ""}`}
        ouverte={ouverte}
        onFermer={() => setOuverte(false)}
        coursId={coursId}
        leconId={leconId}
        devoirId={devoirId}
        enseignant={enseignant}
      />
    </>
  );
}

/**
 * Sur téléphone, le bouton flottant se réduit à une pastille (icône seule)
 * quand on descend dans la page, près du bas, ou si la page est courte :
 * il ne cache pas l'action principale (« J'ai terminé », « Rendre »…).
 * Il reprend son libellé quand on remonte.
 */
function usePastilleCompacte(actif: boolean) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (!actif) return;
    let dernierY = window.scrollY;
    const calculer = () => {
      const y = window.scrollY;
      const hauteur = document.documentElement.scrollHeight;
      const courte = hauteur <= window.innerHeight + 160;
      const presDuBas = window.innerHeight + y >= hauteur - 220;
      const ecart = y - dernierY;
      dernierY = y;
      setCompact((c) => (courte || presDuBas ? true : ecart > 4 ? true : ecart < -4 ? false : c));
    };
    calculer();
    const observateur = typeof ResizeObserver !== "undefined" ? new ResizeObserver(calculer) : null;
    observateur?.observe(document.body);
    window.addEventListener("scroll", calculer, { passive: true });
    window.addEventListener("resize", calculer);
    return () => {
      observateur?.disconnect();
      window.removeEventListener("scroll", calculer);
      window.removeEventListener("resize", calculer);
    };
  }, [actif]);
  return compact;
}

function FeuilleAssistant({
  ouverte,
  onFermer,
  coursId,
  leconId,
  devoirId,
  enseignant,
}: {
  ouverte: boolean;
  onFermer: () => void;
  coursId?: number;
  leconId?: number;
  devoirId?: number;
  enseignant: boolean;
}) {
  const { data: etat } = useEtatIa(ouverte);
  const [contexte] = useState(() => ({ coursId, leconId, devoirId }));
  const conv = useConversationIa({ id: null, contexte });
  const [vue, setVue] = useState<Vue>("accueil");
  const [question, setQuestion] = useState("");
  const bas = useRef<HTMLDivElement>(null);
  const blocage = blocageDe(etat);
  const tuteur = Boolean(devoirId) && !enseignant;

  useLayoutEffect(() => {
    if (vue === "accueil") bas.current?.scrollIntoView({ block: "end" });
  }, [conv.messages.length, conv.echange?.reponse, conv.echange?.statut, vue]);

  const envoyer = (texte: string) => {
    if (!texte.trim() || blocage || conv.occupe) return;
    setQuestion("");
    setVue("accueil");
    void conv.envoyer(texte);
  };

  const suggestions = tuteur
    ? ["Je ne sais pas par où commencer", "Explique-moi la consigne avec d'autres mots", "Vérifie mon raisonnement étape par étape"]
    : leconId
      ? enseignant
        ? ["Quelles questions les étudiants risquent-ils de poser sur cette leçon ?", "Proposez un exercice court sur cette leçon"]
        : ["Je n'ai pas compris cette leçon", "Donne-moi un exemple en Côte d'Ivoire"]
      : enseignant
        ? ["Proposez 3 questions pour lancer la discussion"]
        : ["Explique-moi le dernier point du cours", "Fais-moi réviser : 5 questions"];

  const titre =
    vue === "essentiel" ? "L'essentiel en 5 points" : vue === "autrement" ? "Explique autrement" : vue === "reviser" ? "Me faire réviser" : tuteur ? "Ton tuteur" : "Assistant IA";
  const description =
    vue !== "accueil"
      ? undefined
      : tuteur
        ? "Il t'aide à trouver par toi-même, sans te donner la réponse du devoir."
        : leconId
          ? enseignant
            ? "Il s'appuie sur cette leçon et sur tout le cours."
            : "Il répond avec cette leçon et ton cours, et cite ses sources."
          : enseignant
            ? "Il s'appuie sur le contenu de votre cours."
            : "Il répond avec ton cours et cite ses sources.";

  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      large
      titre={
        <span className="flex items-center gap-2">
          {vue !== "accueil" && (
            <button type="button" onClick={() => setVue("accueil")} className="-ml-2 grid h-11 w-11 place-items-center rounded-full hover:bg-creme" aria-label="Retour">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          {titre}
        </span>
      }
      description={description}
      pied={
        vue === "accueil" ? (
          <div className="flex w-full flex-col gap-2">
            <ZoneQuestion
              valeur={question}
              onChange={setQuestion}
              onEnvoyer={() => envoyer(question)}
              desactive={Boolean(blocage)}
              occupe={conv.occupe}
              enseignant={enseignant}
              placeholder={tuteur ? "Explique où tu bloques…" : undefined}
              className="shadow-none"
            />
            <div className="flex items-center justify-between gap-3">
              <LigneQuota etat={etat} enseignant={enseignant} className="flex-1" />
              {conv.id && (
                <Link href={`/assistant/${conv.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold" onClick={onFermer}>
                  <Maximize2 className="h-4 w-4" /> Ouvrir en grand
                </Link>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 pb-3">
        <BandeauBlocage etat={etat} enseignant={enseignant} coursId={coursId ?? conv.detail.data?.conversation.coursId} />

        {vue === "accueil" && (
          <>
            {tuteur && (
              <div className="flex items-start gap-3 rounded-2xl bg-creme p-4">
                <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
                <p className="text-[15px] leading-relaxed text-texte-doux">
                  <strong className="text-encre">Mode tuteur.</strong> Dis-moi ce que tu as déjà essayé : je te pose des questions et je te donne des indices, étape par étape.
                </p>
              </div>
            )}
            {leconId && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Action icone={<ListOrdered className="h-5 w-5" />} titre="L'essentiel en 5 points" texte="Réviser en deux minutes" onClick={() => setVue("essentiel")} desactive={blocage?.type === "pause"} />
                <Action icone={<Shuffle className="h-5 w-5" />} titre="Explique autrement" texte="Plus simple, un exemple, un schéma" onClick={() => setVue("autrement")} desactive={Boolean(blocage)} />
                <Action icone={<Brain className="h-5 w-5" />} titre="Me faire réviser" texte="5 questions, sans note" onClick={() => setVue("reviser")} desactive={Boolean(blocage)} />
              </div>
            )}
            {!conv.messages.length && !conv.echange ? (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-xs text-texte-gris">{enseignant ? "Pour démarrer" : "Tu peux commencer par"}</span>
                <PucesSuggestions suggestions={suggestions} onChoisir={envoyer} desactive={Boolean(blocage)} />
              </div>
            ) : (
              <FilConversation
                messages={conv.messages}
                echange={conv.echange}
                lecons={conv.detail.data?.lecons}
                coursId={conv.detail.data?.conversation.coursId ?? coursId ?? null}
                enseignant={enseignant}
                onReessayer={(q) => {
                  conv.oublierErreur();
                  envoyer(q);
                }}
                onRecharger={() => void conv.recharger()}
                onOublier={conv.oublierErreur}
              />
            )}
            <div ref={bas} className="h-px" aria-hidden />
          </>
        )}

        {vue === "essentiel" && leconId && <VueEssentiel leconId={leconId} enseignant={enseignant} />}
        {vue === "autrement" && leconId && <VueAutrement leconId={leconId} desactive={Boolean(blocage)} />}
        {vue === "reviser" && leconId && <VueReviser leconId={leconId} desactive={Boolean(blocage)} />}
      </div>
    </Fenetre>
  );
}

function Action({ icone, titre, texte, onClick, desactive }: { icone: ReactNode; titre: string; texte: string; onClick: () => void; desactive?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-ligne bg-white p-3 text-left transition-colors hover:border-orange hover:bg-orange-pale disabled:opacity-50 sm:flex-col sm:items-start"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-clair text-orange-fonce">{icone}</span>
      <span className="flex flex-col">
        <span className="text-[15px] font-extrabold leading-tight">{titre}</span>
        <span className="text-[13px] text-texte-pale">{texte}</span>
      </span>
    </button>
  );
}

/** Petit hook : une requête POST lancée à l'ouverture de la vue, relançable. */
function useDemande<T>(url: string, corps: unknown, auto: boolean) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const lancer = async (c: unknown = corps) => {
    setChargement(true);
    setErreur(null);
    try {
      setDonnees(await post<T>(url, c));
      void rafraichir("/api/ia/etat");
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setChargement(false);
    }
  };
  useEffect(() => {
    if (auto) void lancer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, auto]);
  return { donnees, erreur, chargement, lancer };
}

function VueEssentiel({ leconId, enseignant }: { leconId: number; enseignant: boolean }) {
  const d = useDemande<{ fiche: FicheRevisionDto; depuisCache: boolean }>(`/api/ia/lecons/${leconId}/essentiel`, {}, true);
  const lecture = useLecture();
  if (d.chargement && !d.donnees) return <Attente texte="L'assistant résume la leçon…" />;
  if (d.erreur) return <Erreur message={d.erreur} reessayer={() => void d.lancer()} />;
  if (!d.donnees) return null;
  const f = d.donnees.fiche;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {f.validee ? <Badge ton="succes">{enseignant ? "Validée" : "Validée par ton formateur"}</Badge> : <EtiquetteIa />}
        {f.lecon?.numero && <Badge ton="gris">Leçon {f.lecon.numero}</Badge>}
      </div>
      <div className="rounded-2xl bg-creme px-4 py-3">
        <Markdown source={f.contenu} className="text-base [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" />
      </div>
      <div className="flex flex-wrap gap-2">
        {lecture.disponible && (
          <Bouton
            variante="contour"
            icone={lecture.enLecture === "essentiel" ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            onClick={() => (lecture.enLecture === "essentiel" ? lecture.arreter() : lecture.lire("essentiel", f.contenu))}
            className="min-h-12"
          >
            {lecture.enLecture === "essentiel" ? "Arrêter" : "Écouter"}
          </Bouton>
        )}
        {enseignant && (
          <Link href="/assistant/fiches" className="inline-flex min-h-12 items-center text-[15px] font-bold">
            {f.validee ? "Gérer les fiches" : "Relire et valider cette fiche"}
          </Link>
        )}
      </div>
      {!f.validee && !enseignant && (
        <p className="text-[13px] leading-relaxed text-texte-gris">Cette fiche a été proposée par l'IA et n'a pas encore été relue par ton formateur : vérifie avec ta leçon.</p>
      )}
    </div>
  );
}

const ICONES_ANGLE: Record<AngleExplication, ReactNode> = {
  "plus simple": <Lightbulb className="h-4 w-4" />,
  "avec un exemple": <MapPin className="h-4 w-4" />,
  "en schéma": <Workflow className="h-4 w-4" />,
};
const LIBELLES_ANGLE: Record<AngleExplication, string> = {
  "plus simple": "Plus simple",
  "avec un exemple": "Avec un exemple d'ici",
  "en schéma": "En schéma",
};

function VueAutrement({ leconId, desactive }: { leconId: number; desactive: boolean }) {
  const [angle, setAngle] = useState<AngleExplication | null>(null);
  const d = useDemande<ExplicationAutrement>(`/api/ia/lecons/${leconId}/autrement`, {}, false);
  const choisir = (a: AngleExplication) => {
    setAngle(a);
    void d.lancer({ angle: a });
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Façon d'expliquer">
        {ANGLES_EXPLICATION.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={angle === a}
            disabled={desactive || d.chargement}
            onClick={() => choisir(a)}
            className={cn(
              "inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-[15px] font-bold transition-colors disabled:opacity-50",
              angle === a ? "border-encre bg-encre text-white" : "border-ligne bg-white text-encre hover:border-orange",
            )}
          >
            {ICONES_ANGLE[a]}
            {LIBELLES_ANGLE[a]}
          </button>
        ))}
      </div>
      {!angle && <p className="text-[15px] text-texte-pale">Choisis comment tu veux que l'assistant réexplique la leçon.</p>}
      {d.chargement && <Attente texte="L'assistant réexplique…" />}
      {d.erreur && <Erreur message={d.erreur} reessayer={angle ? () => choisir(angle) : undefined} />}
      {d.donnees && !d.chargement && (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-texte-gris">Réponse de l'assistant · {LIBELLES_ANGLE[d.donnees.angle]}</span>
          <div className="rounded-2xl border border-ligne bg-white px-4 py-3">
            <Markdown source={d.donnees.texte} className="text-base [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" />
          </div>
        </div>
      )}
    </div>
  );
}

function VueReviser({ leconId, desactive }: { leconId: number; desactive: boolean }) {
  const d = useDemande<RevisionLecon>(`/api/ia/lecons/${leconId}/reviser`, {}, !desactive);
  if (desactive && !d.donnees) return null;
  if (d.chargement && !d.donnees) return <Attente texte="L'assistant prépare 5 questions…" />;
  if (d.erreur && !d.donnees) return <Erreur message={d.erreur} reessayer={() => void d.lancer()} />;
  if (!d.donnees) return null;
  return <QuizRevision questions={d.donnees.questions} onRecommencer={() => void d.lancer()} recommencerEnCours={d.chargement} desactiverRecommencer={desactive} />;
}

function Attente({ texte }: { texte: string }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-[15px] text-texte-pale">
        <Sparkles className="h-4 w-4 animate-direct text-orange" aria-hidden /> {texte}
      </p>
      <Squelette className="h-5 w-4/5" />
      <Squelette className="h-5 w-3/5" />
      <Squelette className="h-5 w-2/3" />
    </div>
  );
}
