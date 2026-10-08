// /mediatheque/cours/:id — le cours complet tiré de l'enregistrement d'une
// séance : le cours rédigé (objectifs, résumé, plan minuté, notions, glossaire),
// un quiz corrigé, des exercices pratiques avec corrigés, une étude de cas, un
// travail de groupe et des fiches mémo. Préparé tout seul par le campus.
//
// Révision du jour (chantier C1) : le cours complet devient un entraînement
// suivi. « Réviser ce cours en 5 min » ouvre ses cartes ; le quiz (vraiment
// mélangé) et les fiches (« Je savais » / « À revoir ») comptent dans la
// révision de l'étudiant ; les exercices se cochent ; chaque question peut être
// signalée. Le formateur du cours et la direction voient la révision de la
// classe en tête. Déjà ouvert, il reste lisible sans réseau.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpenCheck, Briefcase, Dumbbell, Layers, ListChecks, PlayCircle, Printer, RotateCcw, Users } from "lucide-react";
import { useMoiConnecte, accueilDuRole } from "@/lib/auth";
import { post } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { dateCourte } from "@/lib/dates";
import { useTextes } from "@/lib/textes";
import { Page } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Badge, BarreProgression, Chargement, Erreur } from "@/components/ui/divers";
import { Markdown } from "@/components/ui/markdown";
import { Onglets } from "@/components/ui/onglets";
import { toast, toastErreur } from "@/components/ui/toast";
import { QuizRevision } from "@/modules/ia/composants";
import { CarteRetournable } from "@/modules/revision/CarteMemo";
import { BoutonSignaler } from "@/modules/revision/Signaler";
import { envoyerReponses, noterReponseCoursComplet } from "@/modules/revision/paquet";
import { ecrireLocal } from "@/modules/pwa/outils";
import { cn } from "@/lib/utils";
import { LimiteSilencieuse } from "@/components/ui/limite-silencieuse";
// Emplacement du plan d'engagement (campus/ENGAGEMENT.md), vide tant que C7 n'est pas là.
import { TravailDeGroupeDevoir } from "@/modules/enseigner-suivi/TravailDeGroupeDevoir";
import { RevisionClasse } from "./RevisionClasse";
import { serieMelangee, type QuestionMelangee } from "./quiz-outils";
import { t } from "@shared/textes/revision";
import type { DossierCours } from "@shared/schema/ext-etudes";
import type { CartesCoursComplet, CoursCompletRevision, EvenementSuivi } from "@shared/engagement/revision";

type Onglet = "cours" | "quiz" | "exercices" | "cas" | "fiches" | "groupe";

/** Un cours complet ouvert sur ce téléphone : au démarrage, son écran est remis en cache après une nouvelle version (revision/routes.tsx). */
const CLE_COURS_COMPLET = "campus:cours-complet:vu";

/** Suivi du cours complet (étudiant) : sans réseau, il est simplement perdu, rien de grave. */
const suivre = (seanceId: number, e: EvenementSuivi) => void post(`/api/seances/${seanceId}/cours-complet/suivi`, e).catch(() => undefined);

const minutage = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
};

export default function PageCoursComplet({ id }: { id: string }) {
  const moi = useMoiConnecte();
  const tx = useTextes(t);
  const etudiant = moi.role === "etudiant";
  const cle = `/api/seances/${id}/cours-complet`;
  const { data, error, isLoading, refetch } = useQuery<CoursCompletRevision>({
    queryKey: [cle],
    refetchInterval: (q) => (q.state.data && q.state.data.statut !== "prete" && q.state.data.statut !== "erreur" ? 20_000 : false),
  });
  const [onglet, setOnglet] = useState<Onglet>("cours");
  const [refaire, setRefaire] = useState(false);
  const depuis = new URLSearchParams(useSearch()).get("depuis");
  const pret = data?.statut === "prete";

  // Ouverture suivie (étudiant), et l'écran du cours complet restera disponible sans réseau.
  useEffect(() => {
    if (!etudiant || !pret) return;
    ecrireLocal(CLE_COURS_COMPLET, "1");
    suivre(Number(id), { evenement: "ouverture" });
  }, [etudiant, pret, id]);
  // On quitte le cours complet : les réponses au quiz et aux fiches partent (ou attendent le réseau).
  useEffect(() => () => void envoyerReponses(), []);

  if (isLoading) {
    return (
      <Page className="max-w-4xl">
        <Chargement lignes={6} />
      </Page>
    );
  }
  if (error || !data) {
    return (
      <Page className="max-w-4xl">
        <Erreur message={(error as Error)?.message ?? "Cours introuvable."} reessayer={() => void refetch()} />
      </Page>
    );
  }
  const s = data.seance;
  const d = data.dossier;
  const cartes = data.cartes ?? null;
  // Le lien retour ramène à la page d'origine (?depuis=accueil, cours, reviser, replay).
  const retour =
    depuis === "accueil"
      ? { href: accueilDuRole(moi.role), libelle: tx("cc.retour.accueil") }
      : depuis === "cours"
        ? { href: `/cours/${s.coursId}?onglet=reviser`, libelle: tx("cc.retour.cours") }
        : depuis === "reviser" && etudiant
          ? { href: "/reviser", libelle: tx("cc.retour.reviser") }
          : depuis === "replay"
            ? { href: `/replays/${s.id}`, libelle: tx("cc.retour.replay") }
            : { href: "/mediatheque", libelle: tx("cc.retour.mediatheque") };
  const peutReviser = etudiant && Boolean(d) && Boolean(cartes && [...cartes.quiz, ...cartes.fiches].some(Boolean));
  const ici = `/mediatheque/cours/${s.id}${depuis ? `?depuis=${encodeURIComponent(depuis)}` : ""}`;

  const relancer = async () => {
    setRefaire(true);
    try {
      queryClient.setQueryData([cle], await post<CoursCompletRevision>(`${cle}/refaire`));
      toast("Le cours complet sera refait dans les prochaines minutes.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setRefaire(false);
    }
  };

  return (
    <Page className="max-w-4xl gap-6">
      <style>{`@media print { .sans-impression { display: none !important; } }`}</style>
      <Link href={retour.href} className="sans-impression inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-bold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {retour.libelle}
      </Link>

      <header className="-mt-3 flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-fonce">
          {s.coursCode} · {s.coursTitre}
        </span>
        <h1 className="text-[26px] font-black leading-tight sm:text-3xl">{d?.titre || s.titre}</h1>
        <p className="text-[15px] text-texte-pale">
          Séance du {dateCourte(s.debut)}
          {s.formateur ? ` · ${s.formateur}` : ""}
        </p>
        {peutReviser && (
          <LienBouton
            href={`/reviser?seance=${s.id}&depuis=${encodeURIComponent(ici)}`}
            taille="lg"
            icone={<Layers className="h-5 w-5" />}
            className="sans-impression mt-1 min-h-[56px] w-full text-[17px] sm:w-auto sm:self-start"
          >
            {tx("cc.reviser")}
          </LienBouton>
        )}
        <div className="sans-impression mt-1 flex flex-wrap gap-2">
          <LienBouton href={`/replays/${s.id}`} variante="contour" taille="sm" icone={<PlayCircle className="h-4 w-4" />}>
            {etudiant ? "Revoir l'enregistrement" : "Revoir l'enregistrement"}
          </LienBouton>
          {d && (
            <Bouton variante="contour" taille="sm" icone={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Imprimer ou enregistrer en PDF
            </Bouton>
          )}
          {data.relancable && (data.statut === "prete" || data.statut === "erreur") && (
            <Bouton variante="fantome" taille="sm" icone={<RotateCcw className="h-4 w-4" />} chargement={refaire} onClick={() => void relancer()}>
              Refaire le cours complet
            </Bouton>
          )}
        </div>
      </header>

      {d && data.relancable && (moi.role === "admin" || moi.role === "formateur") && (
        <LimiteSilencieuse nom="RevisionClasse">
          <RevisionClasse seanceId={s.id} />
        </LimiteSilencieuse>
      )}

      {!d ? (
        <Carte className="flex flex-col gap-3" role="status">
          <p className="flex items-center gap-2 text-[17px] font-extrabold">
            <BookOpenCheck className="h-5 w-5 text-orange-fonce" aria-hidden />
            {data.statut === "erreur" ? "La préparation du cours complet n'a pas abouti" : "Le cours complet se prépare"}
          </p>
          {data.statut === "en_cours" && <BarreProgression valeur={data.progression} />}
          <p className="text-[15px] text-texte-pale">
            {data.statut === "erreur"
              ? (data.message ?? "Elle sera retentée automatiquement.")
              : `${data.etape ?? "En attente"}. Le campus transcrit l'enregistrement, lit tout le cours et ses diapositives, puis rédige le cours complet avec quiz et exercices. ${etudiant ? "Tu recevras une notification dès qu'il sera prêt." : "Une notification part dès qu'il est prêt."}`}
          </p>
        </Carte>
      ) : (
        <>
          <div className="sans-impression -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Onglets<Onglet>
              valeur={onglet}
              onChange={setOnglet}
              options={[
                { valeur: "cours", libelle: "Le cours" },
                { valeur: "quiz", libelle: "Quiz", compteur: d.quiz.length || undefined },
                { valeur: "exercices", libelle: "Exercices", compteur: d.exercices.length || undefined },
                { valeur: "cas", libelle: "Étude de cas" },
                { valeur: "fiches", libelle: "Fiches mémo", compteur: d.fiches.length || undefined },
                { valeur: "groupe", libelle: "Travail de groupe" },
              ]}
            />
          </div>
          {data.devoirs.length > 0 && (
            <Carte className="sans-impression flex flex-col gap-2 border-2 border-orange bg-orange-pale">
              <p className="font-extrabold">{etudiant ? "Tes devoirs sur ce cours" : "Devoirs créés à partir de ce cours"}</p>
              <ul className="flex flex-col gap-2">
                {data.devoirs.map((dv) => (
                  <li key={dv.id}>
                    <Link href={dv.type === "quiz" ? `/quiz/${dv.id}` : `/devoirs/${dv.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 font-bold text-encre no-underline hover:text-orange-fonce">
                      <span>
                        {dv.type === "quiz" ? "QCM noté automatiquement" : "Exercice à rendre (photo, fichier ou vidéo)"}
                        <span className="block text-sm font-normal text-texte-pale">
                          {dv.titre} · avant le {dateCourte(dv.dateLimite)}
                        </span>
                      </span>
                      <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Carte>
          )}
          {onglet === "cours" && <LeCours d={d} />}
          {onglet === "quiz" && <LeQuiz d={d} etudiant={etudiant} seanceId={s.id} cartes={cartes} />}
          {onglet === "exercices" && <LesExercices d={d} etudiant={etudiant} seanceId={s.id} />}
          {onglet === "cas" && <EtudeDeCas d={d} />}
          {onglet === "fiches" && <Fiches d={d} etudiant={etudiant} seanceId={s.id} cartes={cartes} />}
          {onglet === "groupe" && <TravailDeGroupe d={d} seanceId={s.id} etudiant={etudiant} />}
          <p className="text-sm text-texte-gris">Cours préparé par le campus d'après l'enregistrement de la séance et ses diapositives. En cas de doute, la parole du formateur fait foi.</p>
        </>
      )}
    </Page>
  );
}

function Titre({ children, icone }: { children: ReactNode; icone?: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">
      {icone}
      {children}
    </h2>
  );
}

function LeCours({ d }: { d: DossierCours }) {
  return (
    <article className="flex flex-col gap-6">
      <Carte className="flex flex-col gap-2">
        <Titre>Objectifs</Titre>
        <Markdown source={d.introduction} />
      </Carte>
      <section className="flex flex-col gap-3">
        <Titre>Le cours en résumé</Titre>
        <Carte>
          <Markdown source={d.resume} />
        </Carte>
      </section>
      {d.plan.length > 0 && (
        <section className="flex flex-col gap-3">
          <Titre>Plan de la séance</Titre>
          <ol className="flex flex-col divide-y divide-ligne-douce rounded-2xl border border-ligne bg-white">
            {d.plan.map((p, n) => (
              <li key={n} className="flex gap-3 px-4 py-3">
                <span className="w-16 shrink-0 font-mono text-xs text-texte-gris">{minutage(p.debutSecondes)}</span>
                <div>
                  <p className="font-bold">{p.partie}</p>
                  <p className="text-[15px] text-texte-pale">{p.resume}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="flex flex-col gap-3">
        <Titre icone={<Layers className="h-3.5 w-3.5" aria-hidden />}>Les notions du cours</Titre>
        <ol className="flex flex-col gap-3">
          {d.notions.map((n, i) => (
            <li key={i} className="flex flex-col gap-2 rounded-2xl border border-ligne bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-2 text-[17px] font-extrabold">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange text-sm font-black text-encre">{i + 1}</span>
                  {n.titre}
                </p>
                <span className="shrink-0 font-mono text-xs text-texte-gris">à {minutage(n.debutSecondes)}</span>
              </div>
              <Markdown source={n.explication} />
              {n.exemple && (
                <p className="rounded-xl bg-orange-pale px-3 py-2 text-[15px]">
                  <span className="font-bold">Exemple : </span>
                  {n.exemple}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
      {d.glossaire.length > 0 && (
        <section className="flex flex-col gap-3">
          <Titre>Glossaire</Titre>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {d.glossaire.map((g, n) => (
              <div key={n} className="rounded-2xl border border-ligne bg-white p-3.5">
                <dt className="font-extrabold">{g.terme}</dt>
                <dd className="text-[15px] text-texte-pale">{g.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {d.exemples.length > 0 && (
        <section className="flex flex-col gap-3">
          <Titre>Exemples vus en cours</Titre>
          <ul className="flex flex-col gap-2">
            {d.exemples.map((e, n) => (
              <li key={n} className="rounded-2xl border border-ligne bg-white p-3.5">
                <p className="font-bold">{e.titre}</p>
                <p className="text-[15px] text-texte-pale">{e.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Carte className="flex flex-col gap-2 bg-encre text-white">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-orange">À retenir</h2>
        <ul className="flex flex-col gap-1.5">
          {d.aRetenir.map((a, n) => (
            <li key={n} className="flex gap-2 text-[16px] font-semibold leading-snug">
              <span className="text-orange">•</span>
              {a}
            </li>
          ))}
        </ul>
      </Carte>
      {d.pourAllerPlusLoin.length > 0 && (
        <section className="flex flex-col gap-2">
          <Titre>Pour aller plus loin</Titre>
          <ul className="list-disc space-y-1 pl-5 text-[15px]">
            {d.pourAllerPlusLoin.map((p, n) => (
              <li key={n}>{p}</li>
            ))}
          </ul>
          <Link href="/bibliotheque/libres" className="text-sm font-bold">
            Chercher des livres sur ce sujet dans les bibliothèques libres
          </Link>
        </section>
      )}
    </article>
  );
}

function LeQuiz({ d, etudiant, seanceId, cartes }: { d: DossierCours; etudiant: boolean; seanceId: number; cartes: CartesCoursComplet | null }) {
  const tx = useTextes(t);
  const [serie, setSerie] = useState(0);
  // Vrai mélange (Fisher-Yates) des options dès la première série ; « Recommencer le quiz » mélange aussi les questions.
  const questions = useMemo(() => serieMelangee(d.quiz, `${seanceId}`, serie), [d.quiz, seanceId, serie]);
  const bilan = useRef({ n: 0, bonnes: 0 });
  useEffect(() => {
    bilan.current = { n: 0, bonnes: 0 };
  }, [questions]);
  if (!questions.length) return <p className="text-[15px] text-texte-pale">Pas de quiz pour ce cours.</p>;
  const carteDe = (q: QuestionMelangee) => cartes?.quiz[q.position] ?? null;
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-[15px] text-texte-pale">
        <ListChecks className="h-4 w-4 shrink-0 text-orange-fonce" aria-hidden />
        {tx("cc.quizCompte")}
      </p>
      <QuizRevision
        questions={questions}
        onRecommencer={() => setSerie((n) => n + 1)}
        libelleRecommencer={tx("cc.recommencer")}
        mention={tx("page.honnete")}
        onReponse={(q, juste, choix) => {
          if (!etudiant) return;
          const qm = q as QuestionMelangee;
          const carteId = carteDe(qm);
          if (carteId) noterReponseCoursComplet(carteId, { choix: qm.ordre[choix] }, juste);
          bilan.current = { n: bilan.current.n + 1, bonnes: bilan.current.bonnes + (juste ? 1 : 0) };
          if (bilan.current.n === questions.length) {
            suivre(seanceId, { evenement: "quiz", score: bilan.current.bonnes, total: questions.length });
            void envoyerReponses();
          }
        }}
        sousCorrection={etudiant ? (q) => <BoutonSignaler carteId={carteDe(q as QuestionMelangee)} /> : undefined}
      />
    </div>
  );
}

const NIVEAUX = { facile: "Facile", moyen: "Moyen", difficile: "Difficile" } as const;

function LesExercices({ d, etudiant, seanceId }: { d: DossierCours; etudiant: boolean; seanceId: number }) {
  const tx = useTextes(t);
  const [ouverts, setOuverts] = useState<Set<number>>(new Set());
  const [faits, setFaits] = useState<Record<number, "fait" | "difficile">>({});
  const corrigesVus = useRef(new Set<number>());
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-[15px] text-texte-pale">
        <Dumbbell className="h-4 w-4 text-orange-fonce" aria-hidden />
        {etudiant ? "Fais l'exercice sur ton cahier, puis compare avec le corrigé." : "Exercices progressifs avec corrigés détaillés."}
      </p>
      {d.exercices.map((e, n) => {
        const ouvert = ouverts.has(n);
        return (
          <Carte key={n} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge ton={e.niveau === "facile" ? "succes" : e.niveau === "moyen" ? "orange" : "danger"}>{NIVEAUX[e.niveau] ?? e.niveau}</Badge>
              <p className="text-[17px] font-extrabold">
                Exercice {n + 1} : {e.titre}
              </p>
            </div>
            <Markdown source={e.enonce} />
            {e.consignes.length > 0 && (
              <ol className="list-decimal space-y-1 pl-5 text-[15px]">
                {e.consignes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ol>
            )}
            <Bouton
              variante={ouvert ? "fantome" : "contour"}
              taille="sm"
              className="sans-impression self-start"
              onClick={() => {
                if (!ouvert && etudiant && !corrigesVus.current.has(n)) {
                  corrigesVus.current.add(n);
                  suivre(seanceId, { evenement: "corrige", index: n });
                }
                setOuverts((s) => {
                  const c = new Set(s);
                  if (c.has(n)) c.delete(n);
                  else c.add(n);
                  return c;
                });
              }}
            >
              {ouvert ? "Cacher le corrigé" : "Voir le corrigé"}
            </Bouton>
            {ouvert && (
              <div className="rounded-xl bg-succes-clair p-4">
                <Markdown source={e.corrige} />
              </div>
            )}
            {etudiant &&
              (faits[n] ? (
                <p className="sans-impression text-sm font-semibold text-succes">
                  {faits[n] === "fait" ? tx("cc.exoFait") : tx("cc.exoDur")} · {tx("cc.exoNote")}
                </p>
              ) : (
                <div className="sans-impression grid grid-cols-2 gap-2">
                  {(["fait", "difficile"] as const).map((etat) => (
                    <button
                      key={etat}
                      type="button"
                      onClick={() => {
                        setFaits((f) => ({ ...f, [n]: etat }));
                        suivre(seanceId, { evenement: "exercice", index: n, etat });
                      }}
                      className={cn(
                        "min-h-12 rounded-xl px-3 text-[15px] font-bold",
                        etat === "fait" ? "bg-succes text-white hover:bg-encre" : "border-[1.5px] border-ligne bg-white text-encre hover:border-orange",
                      )}
                    >
                      {etat === "fait" ? tx("cc.exoFait") : tx("cc.exoDur")}
                    </button>
                  ))}
                </div>
              ))}
          </Carte>
        );
      })}
    </div>
  );
}

function EtudeDeCas({ d }: { d: DossierCours }) {
  const [ouvert, setOuvert] = useState(false);
  const c = d.etudeDeCas;
  return (
    <Carte className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-[17px] font-extrabold">
        <Briefcase className="h-5 w-5 text-orange-fonce" aria-hidden />
        {c.titre}
      </p>
      <Markdown source={c.contexte} />
      <ol className="list-decimal space-y-1.5 pl-5 text-[15px]">
        {c.questions.map((q, n) => (
          <li key={n}>{q}</li>
        ))}
      </ol>
      <Bouton variante={ouvert ? "fantome" : "contour"} taille="sm" className="sans-impression self-start" onClick={() => setOuvert((v) => !v)}>
        {ouvert ? "Cacher les éléments de réponse" : "Voir les éléments de réponse"}
      </Bouton>
      {ouvert && (
        <div className="rounded-xl bg-succes-clair p-4">
          <Markdown source={c.elementsDeReponse} />
        </div>
      )}
    </Carte>
  );
}

function Fiches({ d, etudiant, seanceId, cartes }: { d: DossierCours; etudiant: boolean; seanceId: number; cartes: CartesCoursComplet | null }) {
  const tx = useTextes(t);
  const [retournees, setRetournees] = useState<Set<number>>(new Set());
  const [reponses, setReponses] = useState<Record<number, boolean>>({});
  const vues = useRef(new Set<number>());
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] text-texte-pale">{etudiant ? tx("cc.fichesAide") : "Touche une fiche pour voir la réponse. Idéal pour réviser dans le transport."}</p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {d.fiches.map((f, n) => {
          const verso = retournees.has(n);
          const carteId = cartes?.fiches[n] ?? null;
          const reponse = reponses[n];
          return (
            <li key={n} className="flex flex-col gap-2">
              <CarteRetournable
                recto={f.recto}
                verso={f.verso}
                etiquette={`Fiche ${n + 1}`}
                retournee={verso}
                onRetourner={() => {
                  if (etudiant && !vues.current.has(n)) {
                    vues.current.add(n);
                    suivre(seanceId, { evenement: "fiche", index: n });
                  }
                  setRetournees((s) => {
                    const c = new Set(s);
                    if (c.has(n)) c.delete(n);
                    else c.add(n);
                    return c;
                  });
                }}
              />
              {/* « Je savais » / « À revoir » : la fiche entre dans la révision de l'étudiant. */}
              {etudiant && carteId && verso && reponse === undefined && (
                <div className="sans-impression grid animate-monte grid-cols-2 gap-2">
                  {[false, true].map((savait) => (
                    <button
                      key={String(savait)}
                      type="button"
                      onClick={() => {
                        noterReponseCoursComplet(carteId, { savait }, savait);
                        setReponses((r) => ({ ...r, [n]: savait }));
                      }}
                      className={cn(
                        "min-h-12 rounded-xl px-3 text-[15px] font-bold",
                        savait ? "bg-succes text-white hover:bg-encre" : "border-[1.5px] border-ligne bg-white text-encre hover:border-orange",
                      )}
                    >
                      {savait ? tx("fiche.savais") : tx("fiche.arevoir")}
                    </button>
                  ))}
                </div>
              )}
              {reponse !== undefined && <p className="sans-impression text-sm font-semibold text-texte-pale">{reponse ? `${tx("fiche.savais")} ✓` : tx("fiche.arevoir")}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TravailDeGroupe({ d, seanceId, etudiant }: { d: DossierCours; seanceId: number; etudiant: boolean }) {
  const g = d.travailDeGroupe;
  return (
    <Carte className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-[17px] font-extrabold">
        <Users className="h-5 w-5 text-orange-fonce" aria-hidden />
        {g.sujet}
      </p>
      <ul className="flex flex-col gap-2 text-[15px]">
        {g.roles.map((r, n) => (
          <li key={n} className="rounded-xl bg-creme px-3 py-2">
            <span className="font-bold">{r.role}</span> : {r.mission}
          </li>
        ))}
      </ul>
      <p className="text-[15px]">
        <span className="font-bold">À rendre : </span>
        {g.livrable}
      </p>
      <LimiteSilencieuse nom="TravailDeGroupeDevoir">
        <TravailDeGroupeDevoir seanceId={seanceId} etudiant={etudiant} />
      </LimiteSilencieuse>
    </Carte>
  );
}
