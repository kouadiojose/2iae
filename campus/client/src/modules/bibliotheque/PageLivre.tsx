// /bibliotheque/livres/:id — un livre : sa notice vérifiée, puis cinq façons
// de l'explorer sans forcément tout lire : la fiche de lecture (rédigée une
// fois, partagée par tous), « Interroger le livre » (questions en flux),
// « Me tester » (quiz), « Mes notes » et « Préparer mon exposé ».
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpenText, MessageSquareText, ListChecks, NotebookPen, Presentation, Sparkles, Trash2, BookmarkPlus, Check, TriangleAlert, ExternalLink, ChevronLeft, ChevronRight, Library, Search, Type, BookOpen } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { post, suppr } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { dateCourte } from "@/lib/dates";
import { Page } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte, CarteLien } from "@/components/ui/carte";
import { Chargement, Erreur, Badge } from "@/components/ui/divers";
import { ZoneTexte, Champ, Selection } from "@/components/ui/champs";
import { Onglets } from "@/components/ui/onglets";
import { toast, toastErreur } from "@/components/ui/toast";
import { useEtatIa, blocageDe, mettreEnAttente, prendreEnAttente } from "@/modules/ia/api-ia";
import { useConversationIa } from "@/modules/ia/useConversationIa";
import { BandeauBlocage, LigneQuota, ZoneQuestion, PucesSuggestions, FilConversation, BulleQuestion, ReponseAssistant, QuizRevision, EtiquetteIa } from "@/modules/ia/composants";
import { Couverture, BadgeVerification, LigneCatalogue, ligneAuteurs } from "./composants";
import { LecteurDepuisIndex } from "./libres";
import type { LivreDetailDto, QuizLivreDto, ExposeDto, NoteBiblioDto, PageTexteDto } from "@shared/schema/ext-bibliotheque";
import type { FicheLivre } from "@shared/schema/ia";

type Onglet = "fiche" | "lire" | "questions" | "test" | "notes" | "expose";
const ONGLETS: Onglet[] = ["fiche", "lire", "questions", "test", "notes", "expose"];

export default function PageLivre({ id }: { id: string }) {
  const moi = useMoiConnecte();
  const etudiant = moi.role === "etudiant";
  const cle = `/api/bibliotheque/livres/${id}`;
  const { data, error, isLoading, refetch } = useQuery<LivreDetailDto>({ queryKey: [cle] });
  const { data: etat } = useEtatIa();
  const recherche = useSearch();
  const [chemin, naviguer] = useLocation();
  const demande = new URLSearchParams(recherche).get("onglet") as Onglet | null;
  const onglet: Onglet = demande && ONGLETS.includes(demande) ? demande : "fiche";
  const changer = (o: Onglet) => naviguer(o === "fiche" ? chemin : `${chemin}?onglet=${o}`, { replace: true });

  if (isLoading) return <Page><Chargement lignes={4} /></Page>;
  if (error || !data) return <Page><Erreur message={(error as Error)?.message ?? "Livre introuvable."} reessayer={() => void refetch()} /></Page>;
  const l = data.livre;

  return (
    <Page className="max-w-3xl gap-6">
      <LienBouton href="/bibliotheque" variante="fantome" taille="sm" icone={<ArrowLeft className="h-4 w-4" />} className="-mb-3 -ml-2 self-start">
        Bibliothèque
      </LienBouton>

      <header className="flex gap-4 sm:gap-6">
        <Couverture livre={l} className="w-24 sm:w-32" />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <BadgeVerification livre={l} />
            {l.langue && !/^fr/i.test(l.langue) && <Badge ton="gris">En {l.langue === "en" || l.langue === "eng" ? "anglais" : l.langue}</Badge>}
          </div>
          <h1 className="text-2xl font-black leading-tight sm:text-3xl">{l.titre}</h1>
          <p className="text-[15px] text-texte-pale">{ligneAuteurs(l)}</p>
          <LigneCatalogue livre={l} />
        </div>
      </header>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Onglets<Onglet>
          valeur={onglet}
          onChange={changer}
          options={[
            { valeur: "fiche", libelle: "Fiche" },
            { valeur: "lire", libelle: "Lire" },
            { valeur: "questions", libelle: "Questions" },
            { valeur: "test", libelle: "Quiz" },
            { valeur: "notes", libelle: "Notes", compteur: data.notes.length || undefined },
            { valeur: "expose", libelle: "Exposé", compteur: data.exposes.length || undefined },
          ]}
        />
      </div>

      {onglet !== "notes" && onglet !== "lire" && <BandeauBlocage etat={etat} enseignant={!etudiant} />}

      {onglet === "lire" && <OngletLire detail={data} etudiant={etudiant} />}

      {onglet === "fiche" && <OngletFiche detail={data} cle={cle} etudiant={etudiant} bloque={Boolean(blocageDe(etat))} onQuestions={() => changer("questions")} />}
      {onglet === "questions" && <OngletQuestions detail={data} cle={cle} etudiant={etudiant} />}
      {onglet === "test" && <OngletTest livreId={l.id} etudiant={etudiant} bloque={Boolean(blocageDe(etat))} />}
      {onglet === "notes" && <OngletNotes detail={data} cle={cle} etudiant={etudiant} />}
      {onglet === "expose" && <OngletExpose detail={data} etudiant={etudiant} bloque={Boolean(blocageDe(etat))} />}
    </Page>
  );
}

// ── Lire le livre ───────────────────────────────────────────────────────────

function OngletLire({ detail, etudiant }: { detail: LivreDetailDto; etudiant: boolean }) {
  const l = detail.livre;
  const [mode, setMode] = useState<"liseuse" | "texte">("liseuse");
  const [apercu, setApercu] = useState(false);
  const lien = (href: string, texte: string, icone = <ExternalLink className="h-4 w-4" aria-hidden />) => (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ligne bg-white px-4 text-[15px] font-bold text-encre no-underline hover:border-orange">
      {icone}
      {texte}
    </a>
  );
  const recherche = encodeURIComponent(l.isbn ?? `${l.titre} ${l.auteurs.split(",")[0] ?? ""}`);

  return (
    <div className="flex flex-col gap-4">
      {l.lecture?.libreId ? <LecteurDepuisIndex libreId={l.lecture.libreId} etudiant={etudiant} /> : null}

      {l.lecture?.mode === "libre" && !l.lecture.libreId && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] text-texte-pale">
              {etudiant ? "Ce livre est libre : lis-le ici, gratuitement." : "Ce livre est libre : lecture gratuite ici."} Exemplaire numérisé d'Internet Archive, la bibliothèque d'Open Library.
            </p>
            <Onglets<"liseuse" | "texte">
              valeur={mode}
              onChange={setMode}
              options={[
                { valeur: "liseuse", libelle: "Liseuse" },
                { valeur: "texte", libelle: "Version texte" },
              ]}
            />
          </div>
          {mode === "liseuse" ? (
            <div className="overflow-hidden rounded-2xl border border-ligne bg-encre">
              <iframe
                src={`https://archive.org/embed/${encodeURIComponent(l.lecture.archiveId)}`}
                title={`Lire « ${l.titre} »`}
                className="block h-[72vh] min-h-[420px] w-full"
                allowFullScreen
                loading="lazy"
              />
            </div>
          ) : (
            <LectureTexte livreId={l.id} />
          )}
          <p className="text-sm text-texte-gris">
            La liseuse montre les pages scannées ; la version texte est plus légère sur un petit forfait (texte reconnu automatiquement, quelques erreurs possibles).{" "}
            <a href={`https://archive.org/details/${encodeURIComponent(l.lecture.archiveId)}`} target="_blank" rel="noreferrer">
              Ouvrir sur Internet Archive
            </a>
          </p>
        </section>
      )}

      {l.lecture?.mode === "emprunt" && (
        <Carte className="flex flex-col items-start gap-3">
          <Library className="h-7 w-7 text-orange-fonce" aria-hidden />
          <p className="text-[17px] font-extrabold">{etudiant ? "Emprunte-le gratuitement en ligne" : "Empruntable gratuitement en ligne"}</p>
          <p className="text-[15px] text-texte-pale">
            Internet Archive (la bibliothèque d'Open Library) prête ce livre numérique gratuitement, comme une bibliothèque : il faut un compte gratuit, puis on l'emprunte pour une heure ou deux semaines.
          </p>
          {lien(`https://archive.org/details/${encodeURIComponent(l.lecture.archiveId)}`, "Emprunter sur Internet Archive", <BookOpen className="h-4 w-4" aria-hidden />)}
        </Carte>
      )}

      {l.isbn && (
        <Carte className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-extrabold">Aperçu Google Livres</p>
              <p className="text-sm text-texte-pale">Quelques pages, quand l'éditeur l'autorise.</p>
            </div>
            {!apercu && (
              <Bouton variante="contour" icone={<BookOpenText className="h-4 w-4" />} onClick={() => setApercu(true)}>
                Feuilleter l'aperçu
              </Bouton>
            )}
          </div>
          {apercu && (
            <iframe
              src={`https://books.google.com/books?vid=ISBN${encodeURIComponent(l.isbn)}&printsec=frontcover&output=embed`}
              title={`Aperçu de « ${l.titre} »`}
              className="block h-[70vh] min-h-[420px] w-full rounded-xl border border-ligne"
              loading="lazy"
            />
          )}
        </Carte>
      )}

      {!l.lecture && (
        <Carte className="flex flex-col items-start gap-3">
          <Search className="h-7 w-7 text-orange-fonce" aria-hidden />
          <p className="text-[17px] font-extrabold">{l.isbn ? "Pas de version gratuite complète en ligne" : "Pas de version gratuite en ligne"}</p>
          <p className="text-[15px] text-texte-pale">
            {etudiant
              ? "Ce livre est protégé par le droit d'auteur. Tu peux lire sa fiche, interroger l'IA à son sujet, et le trouver dans une bibliothèque ou chez un libraire."
              : "Ce livre est protégé par le droit d'auteur : fiche, questions à l'IA, et bibliothèques ou libraires pour le lire en entier."}
          </p>
          <div className="flex flex-wrap gap-2">
            {lien(`https://search.worldcat.org/search?q=${recherche}`, "Bibliothèques qui l'ont (WorldCat)")}
            {lien(`https://www.google.com/search?tbm=bks&q=${recherche}`, "Google Livres")}
          </div>
        </Carte>
      )}
    </div>
  );
}

/** Version texte paginée (3 500 caractères par page) d'un livre libre. */
function LectureTexte({ livreId }: { livreId: number }) {
  const [page, setPage] = useState(1);
  const { data, error, isLoading, refetch } = useQuery<PageTexteDto>({ queryKey: [`/api/bibliotheque/livres/${livreId}/texte?page=${page}`], staleTime: Infinity });
  const haut = useRef<HTMLDivElement>(null);
  const aller = (p: number) => {
    setPage(p);
    haut.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  if (isLoading) return <Chargement lignes={6} />;
  if (error || !data) return <Erreur message={(error as Error)?.message ?? "Texte indisponible."} reessayer={() => void refetch()} />;
  const navigation = (
    <div className="flex items-center justify-between gap-2">
      <Bouton variante="contour" taille="sm" icone={<ChevronLeft className="h-4 w-4" />} disabled={data.page <= 1} onClick={() => aller(data.page - 1)}>
        Précédente
      </Bouton>
      <span className="font-mono text-sm text-texte-gris">
        Page {data.page} / {data.total}
      </span>
      <Bouton variante="contour" taille="sm" icone={<ChevronRight className="h-4 w-4" />} disabled={data.page >= data.total} onClick={() => aller(data.page + 1)}>
        Suivante
      </Bouton>
    </div>
  );
  return (
    <div ref={haut} className="flex scroll-mt-24 flex-col gap-3">
      {navigation}
      <Carte className="px-5 py-5">
        <div className="mb-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">
          <Type className="h-3.5 w-3.5" aria-hidden /> Vers {Math.round(((data.page - 1) / Math.max(1, data.total)) * 100)} % du livre
        </div>
        <div className="whitespace-pre-wrap break-words font-serif text-[17px] leading-relaxed text-encre">{data.contenu}</div>
      </Carte>
      {navigation}
    </div>
  );
}

// ── Fiche de lecture ─────────────────────────────────────────────────────────

function OngletFiche({ detail, cle, etudiant, bloque, onQuestions }: { detail: LivreDetailDto; cle: string; etudiant: boolean; bloque: boolean; onQuestions: () => void }) {
  const [enCours, setEnCours] = useState(false);
  const rediger = async () => {
    setEnCours(true);
    try {
      const r = await post<{ fiche: FicheLivre }>(`${cle}/fiche`);
      queryClient.setQueryData<LivreDetailDto>([cle], (d) => (d ? { ...d, fiche: r.fiche, livre: { ...d.livre, ficheDisponible: true } } : d));
      void rafraichir("/api/ia/etat");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnCours(false);
    }
  };
  const f = detail.fiche;
  if (!f) {
    return (
      <Carte className="flex flex-col items-start gap-3">
        <BookOpenText className="h-7 w-7 text-orange-fonce" aria-hidden />
        <p className="text-[17px] font-extrabold">{etudiant ? "Découvre ce livre en cinq minutes" : "Découvrir ce livre en cinq minutes"}</p>
        <p className="text-[15px] text-texte-pale">
          Résumé, idées clés, grandes parties et à qui il s'adresse. La fiche est rédigée une seule fois par l'IA, puis partagée avec tout le campus.
        </p>
        <Bouton onClick={() => void rediger()} chargement={enCours} disabled={bloque} icone={<Sparkles className="h-4 w-4" />}>
          {enCours ? "Rédaction de la fiche…" : "Lire la fiche"}
        </Bouton>
        {enCours && <p className="text-sm text-texte-gris" role="status">Compte une trentaine de secondes.</p>}
      </Carte>
    );
  }
  return (
    <article className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <EtiquetteIa texte={f.depuisTexte ? "Fiche rédigée par l'IA d'après le texte du livre" : "Fiche rédigée par l'IA"} />
        <span className="text-sm text-texte-gris">
          {f.depuisTexte ? "à partir d'extraits du vrai texte : ouvre l'onglet Lire pour vérifier." : "d'après ce qu'elle sait du livre : à vérifier dans le livre avant de citer."}
        </span>
      </div>
      {f.connaissance !== "bonne" && !f.depuisTexte && (
        <div className="flex items-start gap-3 rounded-2xl bg-alerte-clair p-4 text-[15px] text-alerte">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            {f.connaissance === "faible"
              ? "L'IA connaît mal ce livre : la fiche reste générale et peut se tromper. Appuie-toi sur la table des matières et l'introduction du vrai livre."
              : "L'IA connaît ce livre en partie : certains détails peuvent être imprécis. Vérifie les points importants dans le livre."}
          </p>
        </div>
      )}
      <Carte className="flex flex-col gap-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">Résumé</h2>
        <p className="text-base leading-relaxed">{f.resume}</p>
      </Carte>
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">Idées clés</h2>
        <ol className="flex flex-col gap-2.5">
          {f.ideesCles.map((i, n) => (
            <li key={n} className="flex gap-3 rounded-2xl border border-ligne bg-white p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange font-black text-encre">{n + 1}</span>
              <div>
                <p className="font-extrabold">{i.titre}</p>
                <p className="text-[15px] leading-relaxed text-texte-doux">{i.texte}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      {f.plan.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">Grandes parties</h2>
          <ul className="flex flex-col divide-y divide-ligne-douce rounded-2xl border border-ligne bg-white">
            {f.plan.map((p, n) => (
              <li key={n} className="px-4 py-3">
                <p className="font-bold">{p.partie}</p>
                <p className="text-[15px] text-texte-pale">{p.contenu}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Carte className="flex flex-col gap-1.5">
          <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">Pour qui</h2>
          <p className="text-[15px] leading-relaxed">{f.pourQui}</p>
        </Carte>
        <Carte className="flex flex-col gap-1.5 bg-encre text-white">
          <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-orange">À retenir</h2>
          <p className="text-[17px] font-bold leading-snug">{f.aRetenir}</p>
        </Carte>
      </div>
      <Bouton variante="contour" icone={<MessageSquareText className="h-4 w-4" />} onClick={onQuestions} className="self-start">
        {etudiant ? "Poser mes questions sur ce livre" : "Poser vos questions sur ce livre"}
      </Bouton>
    </article>
  );
}

// ── Interroger le livre ──────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Quelles sont les idées principales de ce livre ?",
  "Explique-moi la partie la plus importante avec un exemple ivoirien",
  "Quelles critiques peut-on faire à ce livre ?",
  "Challenge-moi : pose-moi une question difficile sur ce livre",
  "Quels autres livres lire pour compléter celui-ci ?",
];

function OngletQuestions({ detail, cle, etudiant }: { detail: LivreDetailDto; cle: string; etudiant: boolean }) {
  const [id, setId] = useState<number | null>(detail.conversationId);
  const [question, setQuestion] = useState("");
  const [creation, setCreation] = useState(false);
  const { data: etat } = useEtatIa();
  const blocage = blocageDe(etat);

  const commencer = async (texte: string) => {
    if (!texte.trim() || blocage || creation) return;
    setCreation(true);
    try {
      const c = await post<{ id: number }>(`${cle}/conversation`);
      mettreEnAttente(c.id, texte.trim());
      setQuestion("");
      setId(c.id);
      void rafraichir(cle);
    } catch (e) {
      toastErreur(e);
    } finally {
      setCreation(false);
    }
  };

  if (id !== null) return <ConversationLivre key={id} id={id} cle={cle} livreTitre={detail.livre.titre} etudiant={etudiant} />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-texte-pale">
        {etudiant
          ? detail.livre.lecture?.mode === "libre"
            ? "Pose tes questions sur le livre : l'IA lit les passages du vrai texte pour te répondre et te dit où les retrouver. Garde les meilleures réponses dans tes notes pour ton exposé."
            : "Pose tes questions sur le livre : ses idées, ses exemples, ses limites. L'IA te dit quand elle n'est pas sûre de ce que contient le livre. Garde les meilleures réponses dans tes notes pour ton exposé."
          : "Posez vos questions sur le livre : idées, exemples, limites. L'IA signale quand elle n'est pas sûre du contenu."}
      </p>
      <PucesSuggestions suggestions={SUGGESTIONS} onChoisir={(s) => void commencer(s)} desactive={Boolean(blocage) || creation} />
      <ZoneQuestion
        valeur={question}
        onChange={setQuestion}
        onEnvoyer={() => void commencer(question)}
        desactive={Boolean(blocage)}
        occupe={creation}
        enseignant={!etudiant}
        placeholder={etudiant ? "Ta question sur ce livre…" : "Votre question sur ce livre…"}
      />
      <LigneQuota etat={etat} enseignant={!etudiant} />
    </div>
  );
}

function ConversationLivre({ id, cle, livreTitre, etudiant }: { id: number; cle: string; livreTitre: string; etudiant: boolean }) {
  const conv = useConversationIa({ id });
  const { data: etat } = useEtatIa();
  const blocage = blocageDe(etat);
  const [question, setQuestion] = useState("");
  const [gardees, setGardees] = useState<Set<number>>(new Set());
  const bas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const enAttente = prendreEnAttente(id);
    if (enAttente) void conv.envoyer(enAttente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useLayoutEffect(() => {
    if (conv.echange) bas.current?.scrollIntoView({ block: "end" });
  }, [conv.echange?.reponse, conv.echange?.statut, conv.messages.length]);

  const envoyer = (texte: string) => {
    if (!texte.trim() || blocage || conv.occupe) return;
    setQuestion("");
    void conv.envoyer(texte);
  };

  const garder = async (messageId: number, contenu: string, questionPosee: string | undefined) => {
    try {
      await post(`${cle}/notes`, { contenu: questionPosee ? `Q : ${questionPosee}\n\n${contenu}` : contenu });
      setGardees((g) => new Set(g).add(messageId));
      toast("Gardé dans tes notes.");
      void rafraichir(cle);
    } catch (e) {
      toastErreur(e);
    }
  };

  const messages = conv.messages;
  return (
    <div className="flex flex-col gap-5">
      {conv.detail.isLoading && <Chargement lignes={2} />}
      {messages.map((m, i) =>
        m.role === "user" ? (
          <BulleQuestion key={m.id} texte={m.contenu} />
        ) : (
          <div key={m.id} className="flex flex-col gap-1">
            <ReponseAssistant cle={`l${m.id}`} contenu={m.contenu} enseignant={!etudiant} />
            <button
              type="button"
              disabled={gardees.has(m.id)}
              onClick={() => void garder(m.id, m.contenu, messages[i - 1]?.role === "user" ? messages[i - 1].contenu : undefined)}
              className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl px-3 text-sm font-bold text-orange-fonce hover:bg-creme disabled:text-succes"
            >
              {gardees.has(m.id) ? <Check className="h-4 w-4" aria-hidden /> : <BookmarkPlus className="h-4 w-4" aria-hidden />}
              {gardees.has(m.id) ? "Gardé dans mes notes" : "Garder dans mes notes"}
            </button>
          </div>
        ),
      )}
      <FilConversation messages={[]} echange={conv.echange} enseignant={!etudiant} onReessayer={envoyer} onRecharger={() => void conv.recharger()} onOublier={conv.oublierErreur} />
      {!messages.length && !conv.echange && !conv.detail.isLoading && (
        <PucesSuggestions suggestions={SUGGESTIONS} onChoisir={envoyer} desactive={Boolean(blocage) || conv.occupe} />
      )}
      <div ref={bas} className="flex flex-col gap-2">
        <ZoneQuestion
          valeur={question}
          onChange={setQuestion}
          onEnvoyer={() => envoyer(question)}
          desactive={Boolean(blocage)}
          occupe={conv.occupe}
          enseignant={!etudiant}
          placeholder={etudiant ? `Ta question sur « ${livreTitre.slice(0, 40)} »…` : "Votre question sur ce livre…"}
        />
        <LigneQuota etat={etat} enseignant={!etudiant} />
      </div>
    </div>
  );
}

// ── Me tester ────────────────────────────────────────────────────────────────

function OngletTest({ livreId, etudiant, bloque }: { livreId: number; etudiant: boolean; bloque: boolean }) {
  const [quiz, setQuiz] = useState<QuizLivreDto | null>(null);
  const [enCours, setEnCours] = useState(false);
  const lancer = async () => {
    setEnCours(true);
    try {
      setQuiz(await post<QuizLivreDto>(`/api/bibliotheque/livres/${livreId}/quiz`));
      void rafraichir("/api/ia/etat");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnCours(false);
    }
  };
  if (quiz) return <QuizRevision questions={quiz.questions} onRecommencer={() => void lancer()} recommencerEnCours={enCours} desactiverRecommencer={bloque} />;
  return (
    <Carte className="flex flex-col items-start gap-3">
      <ListChecks className="h-7 w-7 text-orange-fonce" aria-hidden />
      <p className="text-[17px] font-extrabold">{etudiant ? "As-tu compris les idées du livre ?" : "Quiz sur les idées du livre"}</p>
      <p className="text-[15px] text-texte-pale">5 questions à choix multiple, avec l'explication de chaque réponse. Une nouvelle série à chaque fois.</p>
      <Bouton onClick={() => void lancer()} chargement={enCours} disabled={bloque} icone={<Sparkles className="h-4 w-4" />}>
        {etudiant ? "Me tester" : "Lancer le quiz"}
      </Bouton>
    </Carte>
  );
}

// ── Mes notes ────────────────────────────────────────────────────────────────

function OngletNotes({ detail, cle, etudiant }: { detail: LivreDetailDto; cle: string; etudiant: boolean }) {
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const ajouter = async () => {
    if (!texte.trim()) return;
    setEnvoi(true);
    try {
      const n = await post<NoteBiblioDto>(`${cle}/notes`, { contenu: texte.trim() });
      queryClient.setQueryData<LivreDetailDto>([cle], (d) => (d ? { ...d, notes: [n, ...d.notes] } : d));
      setTexte("");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const retirer = async (id: number) => {
    try {
      await suppr(`/api/bibliotheque/notes/${id}`);
      queryClient.setQueryData<LivreDetailDto>([cle], (d) => (d ? { ...d, notes: d.notes.filter((n) => n.id !== id) } : d));
    } catch (e) {
      toastErreur(e);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-texte-pale">
        {etudiant
          ? "Note ici ce que tu retiens : idées, exemples, citations relevées dans le vrai livre, questions à poser. Tes notes servent à préparer ton exposé."
          : "Vos notes de lecture, reprises dans la préparation de l'exposé."}
      </p>
      <ZoneTexte value={texte} onChange={(e) => setTexte(e.target.value)} rows={4} maxLength={6000} placeholder={etudiant ? "Ce que je retiens…" : "Ce que je retiens…"} />
      <Bouton onClick={() => void ajouter()} chargement={envoi} disabled={!texte.trim()} icone={<NotebookPen className="h-4 w-4" />} className="self-start">
        Ajouter la note
      </Bouton>
      {detail.notes.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {detail.notes.map((n) => (
            <li key={n.id} className="flex gap-3 rounded-2xl border border-ligne bg-white p-4">
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{n.contenu}</p>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-mono text-xs text-texte-gris">{dateCourte(n.creeLe)}</span>
                <button type="button" onClick={() => void retirer(n.id)} className="grid h-10 w-10 place-items-center rounded-xl text-texte-gris hover:bg-creme hover:text-danger" aria-label="Supprimer la note">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Préparer mon exposé ──────────────────────────────────────────────────────

function OngletExpose({ detail, etudiant, bloque }: { detail: LivreDetailDto; etudiant: boolean; bloque: boolean }) {
  const [, naviguer] = useLocation();
  const [sujet, setSujet] = useState(detail.livre.titre);
  const [minutes, setMinutes] = useState("10");
  const [enCours, setEnCours] = useState(false);
  const preparer = async () => {
    setEnCours(true);
    try {
      const e = await post<ExposeDto>(`/api/bibliotheque/livres/${detail.livre.id}/expose`, { sujet: sujet.trim(), minutes: Number(minutes) });
      queryClient.setQueryData([`/api/bibliotheque/exposes/${e.id}`], e);
      void rafraichir("/api/bibliotheque", "/api/ia/etat");
      naviguer(`/bibliotheque/exposes/${e.id}`);
    } catch (err) {
      toastErreur(err);
    } finally {
      setEnCours(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <Carte className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Presentation className="h-6 w-6 text-orange-fonce" aria-hidden />
          <p className="text-[17px] font-extrabold">{etudiant ? "Préparer mon exposé" : "Préparer un exposé"}</p>
        </div>
        <p className="text-[15px] text-texte-pale">
          Problématique, plan minuté, diapositives avec ce qu'il faut dire, questions probables du public, esprit critique et bibliographie.
          {detail.notes.length > 1
            ? ` Tes ${detail.notes.length} notes de lecture seront reprises.`
            : detail.notes.length === 1
              ? " Ta note de lecture sera reprise."
              : " Ajoute d'abord quelques notes : l'exposé sera plus personnel."}
        </p>
        <Champ libelle="Sujet de l'exposé" value={sujet} onChange={(e) => setSujet(e.target.value)} maxLength={300} />
        <Selection libelle="Durée" value={minutes} onChange={(e) => setMinutes(e.target.value)}>
          {["5", "10", "15", "20", "30"].map((m) => (
            <option key={m} value={m}>
              {m} minutes
            </option>
          ))}
        </Selection>
        <Bouton onClick={() => void preparer()} chargement={enCours} disabled={bloque || sujet.trim().length < 3} icone={<Sparkles className="h-4 w-4" />} className="self-start">
          {enCours ? "Préparation en cours…" : "Préparer l'exposé"}
        </Bouton>
        {enCours && <p className="text-sm text-texte-gris" role="status">Compte environ une minute.</p>}
      </Carte>
      {detail.exposes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">{etudiant ? "Mes exposés sur ce livre" : "Exposés sur ce livre"}</h2>
          {detail.exposes.map((e) => (
            <CarteLien key={e.id} href={`/bibliotheque/exposes/${e.id}`} className="flex flex-col px-4 py-3">
              <span className="font-bold">{e.sujet}</span>
              <span className="text-sm text-texte-pale">{dateCourte(e.creeLe)}</span>
            </CarteLien>
          ))}
        </section>
      )}
    </div>
  );
}
