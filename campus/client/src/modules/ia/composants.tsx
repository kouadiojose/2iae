// Briques de l'assistant, partagées par la page /assistant, la conversation
// et la feuille du BoutonAssistant : bandeaux d'état, champ de question avec
// dictée, bulles (réponse en flux, sources mises en valeur, écouter, copier),
// quiz d'entraînement.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Sparkles,
  Mic,
  MicOff,
  ArrowUp,
  Volume2,
  Square,
  Copy,
  Check,
  PauseCircle,
  MoonStar,
  Hourglass,
  MessageCircle,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { markdownVersHtml } from "@/components/ui/markdown";
import { Badge, BarreProgression } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { toast } from "@/components/ui/toast";
import type { EtatIa, MessageIaDto, QuestionRevision } from "@shared/schema/ext-ia";
import { blocageDe } from "./api-ia";
import { useDictee, useLecture, copier } from "./voix";
import type { EchangeEnCours } from "./useConversationIa";

// ═══ Étiquettes et bandeaux ════════════════════════════════════════════════

/** Tout contenu produit par l'IA et destiné à être publié porte cette étiquette tant qu'un humain ne l'a pas validé. */
export function EtiquetteIa({ texte = "Proposé par l'IA", className }: { texte?: string; className?: string }) {
  return (
    <Badge ton="orange" className={className}>
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {texte}
    </Badge>
  );
}

/** « Interrogation en cours : l'assistant… » → « L'assistant… » (le titre du bandeau le dit déjà). */
function sansPrefixe(raison: string) {
  const t = raison.replace(/^interrogation en cours\s*:\s*/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Pourquoi l'assistant ne répond pas (interrogation, IA en pause, quota) et quoi faire à la place. */
export function BandeauBlocage({ etat, enseignant, coursId, className }: { etat: EtatIa | undefined; enseignant: boolean; coursId?: number | null; className?: string }) {
  const blocage = blocageDe(etat);
  if (!blocage || !etat) return null;
  if (blocage.type === "pause") {
    return (
      <div className={cn("flex items-start gap-3 rounded-2xl bg-encre p-4 text-white", className)} role="status">
        <PauseCircle className="mt-0.5 h-6 w-6 shrink-0 text-orange" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-base font-extrabold">Interrogation en cours</p>
          <p className="text-[15px] leading-relaxed text-nuit-doux">{sansPrefixe(etat.pause?.raison ?? "")}</p>
        </div>
      </div>
    );
  }
  const contenu =
    blocage.type === "indisponible"
      ? {
          icone: <MoonStar className="mt-0.5 h-6 w-6 shrink-0 text-orange-fonce" aria-hidden />,
          titre: "L'assistant est en pause pour le moment",
          texte: enseignant
            ? "Le service d'IA n'est pas encore branché sur ce campus. Vos cours, vos lives et vos corrections fonctionnent normalement."
            : "Tu peux poser ta question à ton formateur dans la messagerie du cours : il te répondra.",
          action: enseignant ? null : (
            <Link href={coursId ? `/messages/cours/${coursId}` : "/messages"} className="inline-flex min-h-11 items-center text-[15px] font-bold">
              {coursId ? "Écrire dans le salon du cours" : "Ouvrir mes messages"}
            </Link>
          ),
        }
      : {
          icone: <Hourglass className="mt-0.5 h-6 w-6 shrink-0 text-orange-fonce" aria-hidden />,
          titre: enseignant ? "Limite du jour atteinte" : "Tu as posé toutes tes questions du jour",
          texte: enseignant
            ? `Vous avez utilisé vos ${etat.quotaJour} demandes d'aujourd'hui. L'assistant revient demain matin.`
            : `Tu as utilisé tes ${etat.quotaJour} questions d'aujourd'hui. L'assistant revient demain matin ; d'ici là, relis tes leçons ou écris à ton formateur.`,
          action: null,
        };
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border border-ligne bg-creme p-4", className)} role="status">
      {contenu.icone}
      <div className="flex flex-col gap-1">
        <p className="text-base font-extrabold">{contenu.titre}</p>
        <p className="text-[15px] leading-relaxed text-texte-pale">{contenu.texte}</p>
        {contenu.action}
      </div>
    </div>
  );
}

/** « Il te reste 32 questions aujourd'hui », discret. */
export function LigneQuota({ etat, enseignant, className }: { etat: EtatIa | undefined; enseignant: boolean; className?: string }) {
  if (!etat || blocageDe(etat)) return null;
  const n = etat.restantes;
  const texte = enseignant
    ? `Il vous reste ${n} demande${n > 1 ? "s" : ""} aujourd'hui`
    : `Il te reste ${n} question${n > 1 ? "s" : ""} aujourd'hui`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="font-mono text-xs text-texte-gris">{texte}</span>
      <BarreProgression valeur={(n / Math.max(1, etat.quotaJour)) * 100} />
    </div>
  );
}

// ═══ Champ de question (avec dictée) ═══════════════════════════════════════

const ecranTactile = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export function ZoneQuestion({
  valeur,
  onChange,
  onEnvoyer,
  desactive,
  occupe,
  enseignant,
  placeholder,
  autoFocus,
  className,
}: {
  valeur: string;
  onChange: (v: string) => void;
  onEnvoyer: () => void;
  desactive?: boolean;
  occupe?: boolean;
  enseignant: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const zone = useRef<HTMLTextAreaElement>(null);
  const base = useRef("");
  const dictee = useDictee((texte, definitif) => {
    const debut = base.current ? `${base.current} ` : "";
    onChange(`${debut}${texte}`);
    if (definitif) base.current = `${debut}${texte}`;
  });

  // Le champ grandit avec le texte (jusqu'à 6 lignes environ).
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [valeur]);

  useEffect(() => {
    if (dictee.erreur) toast(dictee.erreur, "erreur");
  }, [dictee.erreur]);

  const peutEnvoyer = !desactive && !occupe && valeur.trim().length > 0;
  const surTouche = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Sur ordinateur, Entrée envoie (Maj+Entrée = nouvelle ligne) ; sur téléphone, Entrée va à la ligne.
    if (e.key === "Enter" && !e.shiftKey && !ecranTactile()) {
      e.preventDefault();
      if (peutEnvoyer) onEnvoyer();
    }
  };

  return (
    <div
      className={cn(
        "flex items-end gap-2 rounded-[20px] border border-ligne bg-white p-2 shadow-carte transition-colors focus-within:border-orange",
        desactive && "bg-creme",
        className,
      )}
    >
      <label className="sr-only" htmlFor="question-assistant">
        {enseignant ? "Votre question à l'assistant" : "Ta question à l'assistant"}
      </label>
      <textarea
        id="question-assistant"
        ref={zone}
        rows={1}
        value={valeur}
        autoFocus={autoFocus}
        disabled={desactive}
        onChange={(e) => {
          onChange(e.target.value);
          base.current = e.target.value;
        }}
        onKeyDown={surTouche}
        placeholder={placeholder ?? (enseignant ? "Posez votre question…" : "Écris ta question…")}
        className="max-h-[168px] min-h-[48px] flex-1 resize-none bg-transparent px-3 py-3 text-base leading-snug text-encre outline-none placeholder:text-texte-gris disabled:cursor-not-allowed"
      />
      {dictee.disponible && !desactive && (
        <button
          type="button"
          onClick={() => {
            if (dictee.ecoute) dictee.arreter();
            else {
              base.current = valeur.trim();
              dictee.demarrer();
            }
          }}
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-full transition-colors",
            dictee.ecoute ? "animate-direct bg-orange text-encre" : "bg-creme text-texte-doux hover:bg-orange-clair hover:text-encre",
          )}
          aria-label={dictee.ecoute ? "Arrêter la dictée" : enseignant ? "Dicter votre question" : "Dicter ta question"}
          aria-pressed={dictee.ecoute}
        >
          {dictee.ecoute ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
      )}
      <button
        type="button"
        onClick={onEnvoyer}
        disabled={!peutEnvoyer}
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-orange text-encre transition-colors hover:bg-encre hover:text-white disabled:bg-ligne disabled:text-texte-gris"
        aria-label="Envoyer la question"
      >
        {occupe ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-encre border-t-transparent" /> : <ArrowUp className="h-5 w-5" strokeWidth={2.6} />}
      </button>
    </div>
  );
}

/** Questions de départ, en puces qui défilent au pouce. */
export function PucesSuggestions({ suggestions, onChoisir, desactive, className }: { suggestions: string[]; onChoisir: (s: string) => void; desactive?: boolean; className?: string }) {
  if (!suggestions.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          disabled={desactive}
          onClick={() => onChoisir(s)}
          className="min-h-12 rounded-2xl border border-ligne bg-white px-4 py-2.5 text-left text-[15px] font-semibold leading-snug text-texte-doux transition-colors hover:border-orange hover:bg-orange-pale hover:text-encre disabled:opacity-50"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ═══ Bulles ════════════════════════════════════════════════════════════════

type LeconSource = { id: number; numero: string; titre: string };

const CLASSE_SOURCE =
  "inline-flex items-center gap-1 rounded-full bg-orange-clair px-2 py-0.5 align-baseline font-mono text-[12px] font-normal not-italic leading-5 text-orange-profond !no-underline hover:bg-orange-peche hover:text-encre";

const CLASSE_CURSEUR = "ml-0.5 inline-block h-4 w-2 animate-direct rounded-sm bg-orange align-middle";

/** Markdown de la réponse, avec les sources « (Leçon 2.3 · Titre) » et « (Séance du 12 oct.) » en pastilles (liens vers la leçon). */
function htmlReponse(markdown: string, lecons: LeconSource[], coursId: number | null): string {
  return markdownVersHtml(markdown).replace(/\((Leçon (\d+\.\d+)(?:\s·\s[^()<]*)?|Séance du [^()<]{3,24})\)/g, (_m, ref: string, numero?: string) => {
    const lecon = numero ? lecons.find((l) => l.numero === numero) : undefined;
    if (lecon && coursId) return `<a href="/cours/${coursId}/lecons/${lecon.id}" class="${CLASSE_SOURCE}">${ref}</a>`;
    return `<span class="${CLASSE_SOURCE}">${ref}</span>`;
  });
}

export function BulleQuestion({ texte }: { texte: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-md bg-orange px-4 py-3 text-base leading-relaxed text-encre">{texte}</div>
    </div>
  );
}

function BoutonAction({ onClick, icone, children, actif, href }: { onClick?: () => void; icone: ReactNode; children: ReactNode; actif?: boolean; href?: string }) {
  const classes = cn(
    "inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-bold no-underline transition-colors",
    actif ? "bg-encre text-white hover:text-white" : "text-texte-doux hover:bg-creme hover:text-encre",
  );
  if (href) {
    return (
      <Link href={href} className={classes}>
        {icone}
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {icone}
      {children}
    </button>
  );
}

/** Réponse de l'assistant : Markdown, sources, « Écouter », « Copier », « Demander à mon formateur ». */
export function ReponseAssistant({
  cle,
  contenu,
  lecons = [],
  coursId = null,
  enFlux,
  enseignant,
  actions = true,
}: {
  cle: string;
  contenu: string;
  lecons?: LeconSource[];
  coursId?: number | null;
  enFlux?: boolean;
  enseignant: boolean;
  actions?: boolean;
}) {
  const [, naviguer] = useLocation();
  const lecture = useLecture();
  const [copie, setCopie] = useState(false);
  const html = useMemo(() => {
    const base = htmlReponse(contenu, lecons, coursId);
    if (!enFlux) return base;
    // Curseur clignotant au bout du texte qui s'écrit, dans le dernier paragraphe.
    const curseur = `<span class="${CLASSE_CURSEUR}" aria-hidden="true"></span>`;
    const fin = /<\/(p|li|h1|h2|h3|blockquote)>\s*(<\/(ul|ol)>)?\s*$/.exec(base);
    return fin ? `${base.slice(0, fin.index)}${curseur}${base.slice(fin.index)}` : `${base}${curseur}`;
  }, [contenu, lecons, coursId, enFlux]);
  const horsCours = /^\s*ce point n'est pas dans (ton|votre) cours/i.test(contenu);

  // Les liens internes (sources) restent dans l'application, sans recharger la page.
  const surClic = (e: MouseEvent<HTMLDivElement>) => {
    const lien = (e.target as HTMLElement).closest("a");
    const href = lien?.getAttribute("href");
    if (lien && href?.startsWith("/") && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      naviguer(href);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-encre text-orange" aria-hidden>
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="font-mono text-xs uppercase tracking-wider text-texte-gris">Assistant</span>
        {horsCours && <Badge ton="gris">Hors du cours</Badge>}
      </div>
      <div className="rounded-[20px] rounded-tl-md border border-ligne bg-white px-4 py-3" aria-live={enFlux ? "polite" : undefined} aria-busy={enFlux}>
        <div
          className="prose-campus break-words text-base [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          onClick={surClic}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
      {actions && !enFlux && (
        <div className="-ml-1 flex flex-wrap items-center gap-1">
          {lecture.disponible && (
            <BoutonAction
              onClick={() => (lecture.enLecture === cle ? lecture.arreter() : lecture.lire(cle, contenu))}
              icone={lecture.enLecture === cle ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              actif={lecture.enLecture === cle}
            >
              {lecture.enLecture === cle ? "Arrêter" : "Écouter"}
            </BoutonAction>
          )}
          <BoutonAction
            onClick={async () => {
              if (await copier(contenu)) {
                setCopie(true);
                setTimeout(() => setCopie(false), 2000);
              }
            }}
            icone={copie ? <Check className="h-4 w-4 text-succes" /> : <Copy className="h-4 w-4" />}
          >
            {copie ? "Copié" : "Copier"}
          </BoutonAction>
          {!enseignant && coursId && (
            <BoutonAction href={`/messages/cours/${coursId}`} icone={<MessageCircle className="h-4 w-4" />}>
              Demander à mon formateur
            </BoutonAction>
          )}
        </div>
      )}
    </div>
  );
}

function BulleAttente({ enseignant }: { enseignant: boolean }) {
  return (
    <div className="flex items-center gap-3" role="status">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-encre text-orange" aria-hidden>
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <span className="flex items-center gap-1.5 rounded-[20px] rounded-tl-md border border-ligne bg-white px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 animate-direct rounded-full bg-orange" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
        <span className="ml-2 text-[15px] text-texte-pale">{enseignant ? "L'assistant rédige sa réponse…" : "L'assistant réfléchit…"}</span>
      </span>
    </div>
  );
}

/** Tous les messages d'une conversation + l'échange en cours (en flux, ou en erreur avec quoi faire). */
export function FilConversation({
  messages,
  echange,
  lecons,
  coursId,
  enseignant,
  onReessayer,
  onRecharger,
  onOublier,
}: {
  messages: MessageIaDto[];
  echange: EchangeEnCours | null;
  lecons?: LeconSource[];
  coursId?: number | null;
  enseignant: boolean;
  onReessayer: (question: string) => void;
  onRecharger: () => void;
  onOublier: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {messages.map((m) =>
        m.role === "user" ? (
          <BulleQuestion key={m.id} texte={m.contenu} />
        ) : (
          <ReponseAssistant key={m.id} cle={`m${m.id}`} contenu={m.contenu} lecons={lecons} coursId={coursId} enseignant={enseignant} />
        ),
      )}
      {echange && (
        <>
          <BulleQuestion texte={echange.question} />
          {echange.statut === "attente" && <BulleAttente enseignant={enseignant} />}
          {(echange.statut === "flux" || (echange.statut === "fini" && echange.reponse)) && (
            <ReponseAssistant cle="en-cours" contenu={echange.reponse} lecons={lecons} coursId={coursId} enFlux={echange.statut === "flux"} enseignant={enseignant} actions={false} />
          )}
          {echange.statut === "erreur" && (
            <>
              {echange.reponse && <ReponseAssistant cle="partiel" contenu={echange.reponse} lecons={lecons} coursId={coursId} enseignant={enseignant} actions={false} />}
              <div className="flex flex-col gap-3 rounded-2xl bg-danger-clair p-4 text-danger" role="alert">
                <p className="text-[15px] font-semibold leading-relaxed">{echange.erreur}</p>
                <div className="flex flex-wrap gap-2">
                  {echange.coupure ? (
                    <Bouton taille="sm" variante="contour" icone={<RefreshCw className="h-4 w-4" />} onClick={onRecharger} className="min-h-12">
                      Recharger la conversation
                    </Bouton>
                  ) : (
                    <Bouton taille="sm" variante="contour" icone={<RotateCcw className="h-4 w-4" />} onClick={() => onReessayer(echange.question)} className="min-h-12">
                      Reposer la question
                    </Bouton>
                  )}
                  <Bouton taille="sm" variante="fantome" icone={<X className="h-4 w-4" />} onClick={onOublier} className="min-h-12">
                    Fermer
                  </Bouton>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ═══ « Me faire réviser » : 5 questions interactives ═══════════════════════

export function QuizRevision({
  questions,
  onRecommencer,
  recommencerEnCours,
  desactiverRecommencer,
}: {
  questions: QuestionRevision[];
  onRecommencer: () => void;
  recommencerEnCours?: boolean;
  desactiverRecommencer?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [choix, setChoix] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [fini, setFini] = useState(false);

  // Nouvelle série : on repart de zéro.
  useEffect(() => {
    setIndex(0);
    setChoix(null);
    setScore(0);
    setFini(false);
  }, [questions]);

  if (fini) {
    const bravo = score >= questions.length - 1;
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-creme px-5 py-7 text-center" role="status">
        <span className="font-mono text-xs uppercase tracking-wider text-texte-gris">Ton résultat</span>
        <p className="text-5xl font-black tabular-nums tracking-serre">
          {score}
          <span className="text-2xl text-texte-gris">/{questions.length}</span>
        </p>
        <p className="max-w-sm text-[15px] leading-relaxed text-texte-doux">
          {bravo ? "Bravo, tu maîtrises cette leçon !" : score >= questions.length / 2 ? "Pas mal ! Relis les points où tu as hésité." : "Relis la leçon tranquillement, puis réessaie : c'est comme ça qu'on apprend."}
        </p>
        <p className="font-mono text-xs text-texte-gris">Entraînement : pas de note, rien n'est enregistré.</p>
        <Bouton onClick={onRecommencer} chargement={recommencerEnCours} disabled={desactiverRecommencer} icone={<RotateCcw className="h-4 w-4" />} className="mt-2 min-h-12">
          5 nouvelles questions
        </Bouton>
      </div>
    );
  }

  const q = questions[index];
  const repondu = choix !== null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between font-mono text-xs text-texte-gris">
          <span>
            Question {index + 1} sur {questions.length}
          </span>
          <span>Non noté</span>
        </div>
        <BarreProgression valeur={((index + (repondu ? 1 : 0)) / questions.length) * 100} />
      </div>
      <p className="text-lg font-extrabold leading-snug tracking-[-0.01em]">{q.question}</p>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Réponses possibles">
        {q.options.map((o, i) => {
          const bonne = i === q.bonneReponse;
          const choisie = i === choix;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={choisie}
              disabled={repondu}
              onClick={() => {
                setChoix(i);
                if (bonne) setScore((s) => s + 1);
              }}
              className={cn(
                "flex min-h-[52px] items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 text-left text-base font-semibold leading-snug transition-colors",
                !repondu && "border-ligne bg-white hover:border-orange hover:bg-orange-pale",
                repondu && bonne && "border-succes bg-succes-clair text-encre",
                repondu && choisie && !bonne && "border-danger bg-danger-clair text-encre",
                repondu && !bonne && !choisie && "border-ligne bg-white text-texte-gris",
              )}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-creme font-mono text-xs text-texte-doux">{String.fromCharCode(65 + i)}</span>
              <span className="flex-1">{o}</span>
              {repondu && bonne && <CheckCircle2 className="h-5 w-5 shrink-0 text-succes" aria-label="Bonne réponse" />}
              {repondu && choisie && !bonne && <XCircle className="h-5 w-5 shrink-0 text-danger" aria-label="Mauvaise réponse" />}
            </button>
          );
        })}
      </div>
      {repondu && (
        <div className="flex flex-col gap-3 animate-monte">
          <div className={cn("rounded-2xl p-4 text-[15px] leading-relaxed", choix === q.bonneReponse ? "bg-succes-clair text-encre" : "bg-creme text-texte-doux")}>
            <p className="mb-1 font-extrabold text-encre">{choix === q.bonneReponse ? "Bonne réponse !" : `La bonne réponse était ${String.fromCharCode(65 + q.bonneReponse)}.`}</p>
            {q.explication}
          </div>
          <Bouton
            pleineLargeur
            taille="lg"
            onClick={() => {
              if (index + 1 >= questions.length) setFini(true);
              else {
                setIndex(index + 1);
                setChoix(null);
              }
            }}
          >
            {index + 1 >= questions.length ? "Voir mon résultat" : "Question suivante"}
          </Bouton>
        </div>
      )}
    </div>
  );
}
