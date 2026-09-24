// /assistant/:id — une conversation avec l'assistant. La réponse s'affiche
// pendant que Claude l'écrit ; les sources citées deviennent des liens vers
// les leçons ; dictée, « Écouter », « Copier » ; pause pendant une
// interrogation, repli clair si l'IA est absente ou le quota atteint.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Trash2, GraduationCap, BookOpen, Sparkles } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { suppr, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { dateCourte } from "@/lib/dates";
import { Page } from "@/components/layout/coquille";
import { Badge, EtatVide, Squelette, Erreur } from "@/components/ui/divers";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Fenetre } from "@/components/ui/fenetre";
import { toast, toastErreur } from "@/components/ui/toast";
import { useEtatIa, useCoursAssistant, blocageDe, prendreEnAttente } from "./api-ia";
import { useConversationIa } from "./useConversationIa";
import { BandeauBlocage, LigneQuota, ZoneQuestion, PucesSuggestions, FilConversation } from "./composants";

export default function PageConversation({ id }: { id: string }) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) {
    return (
      <Page>
        <EtatVide titre="Conversation introuvable" texte="Le lien est incomplet." action={<LienBouton href="/assistant">Revenir à l'assistant</LienBouton>} />
      </Page>
    );
  }
  return <Conversation key={n} id={n} />;
}

/** Vrai si la personne lit le bas de la page (on suit alors le texte qui s'écrit). */
const presDuBas = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 220;

function Conversation({ id }: { id: number }) {
  const moi = useMoiConnecte();
  const enseignant = moi.role !== "etudiant";
  const [, naviguer] = useLocation();
  const conv = useConversationIa({ id });
  const { data: etat } = useEtatIa();
  const { data: coursListe } = useCoursAssistant();
  const [question, setQuestion] = useState("");
  const [confirmer, setConfirmer] = useState(false);
  const suivre = useRef(true);

  const detail = conv.detail.data;
  const c = detail?.conversation;
  const blocage = blocageDe(etat);

  // Question tapée sur l'accueil de l'assistant : envoyée dès l'ouverture.
  useEffect(() => {
    const enAttente = prendreEnAttente(id);
    if (enAttente) void conv.envoyer(enAttente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Suit le texte qui s'écrit, sauf si la personne est remontée lire plus haut.
  useEffect(() => {
    const surDefilement = () => {
      suivre.current = presDuBas();
    };
    window.addEventListener("scroll", surDefilement, { passive: true });
    return () => window.removeEventListener("scroll", surDefilement);
  }, []);
  useLayoutEffect(() => {
    // Tout en bas : le champ de question est le dernier élément de la page, le texte s'arrête juste au-dessus.
    if (suivre.current) window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [conv.messages.length, conv.echange?.reponse, conv.echange?.statut]);

  const envoyer = (texte: string) => {
    if (!texte.trim() || blocage || conv.occupe) return;
    suivre.current = true;
    setQuestion("");
    void conv.envoyer(texte);
  };

  const supprimer = async () => {
    try {
      await suppr(`/api/ia/conversations/${id}`);
      toast("Conversation supprimée");
      void rafraichir("/api/ia/conversations");
      naviguer("/assistant");
    } catch (e) {
      toastErreur(e);
    }
  };

  if (conv.detail.error) {
    const e = conv.detail.error;
    return (
      <Page className="max-w-3xl">
        {e instanceof ErreurApi && e.statut === 404 ? (
          <EtatVide
            titre="Conversation introuvable"
            texte="Elle a peut-être été supprimée. Tes autres conversations sont sur l'accueil de l'assistant."
            action={<LienBouton href="/assistant">Revenir à l'assistant</LienBouton>}
          />
        ) : (
          <Erreur message={(e as Error).message} reessayer={() => void conv.detail.refetch()} />
        )}
      </Page>
    );
  }

  const suggestions = coursListe?.find((x) => x.id === c?.coursId)?.suggestions ?? [];
  const vide = !conv.messages.length && !conv.echange;

  return (
    <Page className="max-w-3xl gap-5 pb-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/assistant" className="-ml-2 inline-flex min-h-12 items-center gap-2 rounded-xl px-2 text-[15px] font-bold text-texte-doux no-underline hover:bg-creme hover:text-encre">
            <ArrowLeft className="h-5 w-5" /> L'assistant
          </Link>
          {c && c.nbMessages > 0 && (
            <button
              type="button"
              onClick={() => setConfirmer(true)}
              className="grid h-12 w-12 place-items-center rounded-xl text-texte-gris hover:bg-danger-clair hover:text-danger"
              aria-label="Supprimer la conversation"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
        {!c ? (
          <Squelette className="h-10 w-3/4" />
        ) : (
          <>
            <h1 className="text-[26px] font-black leading-tight tracking-serre sm:text-[32px]">
              {c.titre === "Nouvelle conversation" && conv.echange ? conv.echange.question.slice(0, 60) : c.titre}
            </h1>
            <div className="flex flex-wrap gap-2">
              {c.cours ? (
                <Badge ton="gris" className="max-w-full">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.cours.couleur }} aria-hidden />
                  <span className="truncate">
                    {c.cours.code} · {c.cours.titre}
                  </span>
                </Badge>
              ) : (
                <Badge ton="gris">Sans cours précis</Badge>
              )}
              {c.lecon && (
                <Badge ton="orange" className="max-w-full">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{c.lecon.titre}</span>
                </Badge>
              )}
              {c.devoir && (
                <Badge ton="encre" className="max-w-full">
                  <GraduationCap className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">Mode tuteur · {c.devoir.titre}</span>
                </Badge>
              )}
            </div>
          </>
        )}
        {c?.devoir && !enseignant && (
          <p className="rounded-2xl bg-creme px-4 py-3 text-[15px] leading-relaxed text-texte-doux">
            <strong className="text-encre">Mode tuteur :</strong> l'assistant t'aide à trouver par toi-même, avec des questions et des indices. Il ne donne pas la réponse du
            devoir (à rendre avant le {dateCourte(c.devoir.dateLimite)}).
          </p>
        )}
      </div>

      {conv.detail.isLoading ? (
        <div className="flex flex-col gap-4">
          <Squelette className="ml-auto h-14 w-2/3" />
          <Squelette className="h-32 w-full" />
        </div>
      ) : vide ? (
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-encre text-orange" aria-hidden>
              <Sparkles className="h-5 w-5" />
            </span>
            <p className="text-lg font-extrabold">{enseignant ? "Que souhaitez-vous préparer ou éclaircir ?" : "Que veux-tu comprendre ?"}</p>
          </div>
          <PucesSuggestions suggestions={suggestions} onChoisir={envoyer} desactive={Boolean(blocage)} />
        </div>
      ) : (
        <FilConversation
          messages={conv.messages}
          echange={conv.echange}
          lecons={detail?.lecons}
          coursId={c?.coursId ?? null}
          enseignant={enseignant}
          onReessayer={(q) => {
            conv.oublierErreur();
            envoyer(q);
          }}
          onRecharger={() => void conv.recharger()}
          onOublier={conv.oublierErreur}
        />
      )}

      {/* Champ collé en bas de l'écran, au-dessus de la barre d'onglets du téléphone. */}
      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 -mx-4 flex flex-col gap-2 bg-gradient-to-t from-white via-white to-white/0 px-4 pb-2 pt-6 sm:-mx-7 sm:px-7 lg:bottom-4">
        <BandeauBlocage etat={etat} enseignant={enseignant} coursId={c?.coursId} />
        <ZoneQuestion
          valeur={question}
          onChange={setQuestion}
          onEnvoyer={() => envoyer(question)}
          desactive={Boolean(blocage)}
          occupe={conv.occupe}
          enseignant={enseignant}
          placeholder={c?.devoir && !enseignant ? "Explique où tu bloques…" : undefined}
        />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
          <LigneQuota etat={etat} enseignant={enseignant} className="min-w-[180px] flex-1" />
          <span className="text-[13px] text-texte-gris">{enseignant ? "L'assistant peut se tromper : relisez toujours." : "L'assistant peut se tromper : ton formateur a le dernier mot."}</span>
        </div>
      </div>

      <Fenetre
        ouverte={confirmer}
        onFermer={() => setConfirmer(false)}
        titre="Supprimer cette conversation ?"
        description="Les questions et les réponses seront effacées."
        pied={
          <>
            <Bouton variante="fantome" onClick={() => setConfirmer(false)}>
              Garder
            </Bouton>
            <Bouton variante="danger" onClick={() => void supprimer()}>
              Supprimer
            </Bouton>
          </>
        }
      />
    </Page>
  );
}
