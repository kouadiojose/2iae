// /enseigner — « Aujourd'hui » du formateur (souvent à distance, en France).
//
// En haut, la prochaine séance : double horloge Abidjan / Paris, compte à
// rebours, préparation, et UN bouton principal qui change avec l'heure
// (« Préparer la séance » longtemps avant, « Ouvrir le studio » à 30 min).
// Puis ce qui attend : copies à corriger, questions restées sans réponse au
// dernier live, messages ; enfin ses cours et sa semaine.
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowRight,
  BookOpen,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Radio,
  ThumbsUp,
  CalendarDays,
  ClipboardList,
} from "lucide-react";
import { useTousEvenements } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { heure, heureDouble, jourLong, relatif } from "@/lib/dates";
import { cn, pluriel } from "@/lib/utils";
import { Page } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { Carte, CarteLien, TitreSection } from "@/components/ui/carte";
import { Badge, BadgeDirect, EtatVide, Erreur, Squelette } from "@/components/ui/divers";
import { CompteARebours, useMaintenant } from "@/components/ui/compte-a-rebours";
import type { AccueilFormateur, CoursFormateur, ElementAgenda, SeanceFormateur } from "@shared/schema";
import { EVENEMENTS_ACCUEIL, jourRelatif, majuscule } from "./outils";

const MINUTE = 60_000;

export default function PageEnseigner() {
  const { data, isLoading, error, refetch } = useQuery<AccueilFormateur>({ queryKey: ["/api/accueil/formateur"], refetchInterval: 60_000 });
  const maintenant = useMaintenant(30_000);

  useTousEvenements((e) => {
    if (EVENEMENTS_ACCUEIL.has(e.type)) void rafraichir("/api/accueil/formateur");
  });

  if (error && !data) {
    return (
      <Page>
        <Erreur message={(error as Error).message} reessayer={() => void refetch()} />
      </Page>
    );
  }
  if (isLoading || !data) {
    return (
      <Page className="gap-7">
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Chargement">
          <Squelette className="h-4 w-64" />
          <Squelette className="h-10 w-52" />
        </div>
        <Squelette className="h-80 rounded-[24px]" />
      </Page>
    );
  }

  const ville = data.localisation?.split(",")[0]?.trim();

  return (
    <Page className="gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="font-mono text-xs text-texte-gris">
            {majuscule(jourLong(maintenant))} · {heureDouble(maintenant)}
          </span>
          <h1 className="titre-page">
            {data.salutation} {data.prenom}.
          </h1>
          {ville && <p className="text-[15px] text-texte-pale">Vous enseignez depuis {ville}. Les horaires sont donnés à l'heure d'Abidjan et de Paris.</p>}
        </div>
        <LienBouton href="/annonces?nouvelle=1" variante="contour" icone={<Megaphone className="h-4 w-4" />}>
          Écrire à mes étudiants
        </LienBouton>
      </header>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-7">
          {data.enDirect ? (
            <CarteEnDirect seance={data.enDirect} />
          ) : data.prochaineSeance ? (
            <CarteProchaineSeance seance={data.prochaineSeance} maintenant={maintenant} />
          ) : (
            <EtatVide
              icone={<Radio className="h-5 w-5" />}
              titre="Aucune séance planifiée"
              texte="Planifiez votre prochain live depuis la page de votre cours : les cinq salles de conférence et les étudiants connectés seront prévenus."
              action={
                <LienBouton href="/cours" variante="principal">
                  Ouvrir mes cours
                </LienBouton>
              }
            />
          )}
          {data.enDirect && data.prochaineSeance && <LigneSeanceSuivante seance={data.prochaineSeance} />}
          <CopiesACorriger data={data} />
          <QuestionsEnSuspens questions={data.questions} maintenant={maintenant} />
        </div>
        <div className="flex min-w-0 flex-col gap-7">
          <Messages nombre={data.messagesNonLus} />
          <CarteLien href="/annonces" className="-mt-4 flex items-center gap-4 px-5 py-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-creme text-orange-fonce">
              <Megaphone className="h-5 w-5" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[17px] font-extrabold">Annonces</span>
              <span className="text-sm text-texte-pale">
                {data.annoncesNonLues
                  ? `${pluriel(data.annoncesNonLues, "annonce")} du campus à lire · vos annonces et leurs lectures`
                  : "Celles du campus, et les vôtres avec leurs lectures."}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
          </CarteLien>
          <MesCours cours={data.cours} />
          <MaSemaine elements={data.semaine} />
        </div>
      </div>
    </Page>
  );
}

// ── Séance en direct / prochaine séance ────────────────────────────────────

function CarteEnDirect({ seance }: { seance: SeanceFormateur }) {
  return (
    <section aria-labelledby="titre-seance" className="flex flex-col gap-5 rounded-[24px] bg-nuit p-5 text-white sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-peche">{seance.coursCode} · Vous êtes en direct</span>
        <BadgeDirect />
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 id="titre-seance" className="text-[26px] font-black leading-[1.06] tracking-serre sm:text-[32px]">
          {seance.titre}
        </h2>
        <p className="text-nuit-doux">Séance prévue à {heureDouble(seance.debut)}. Les campus et les étudiants vous suivent depuis le studio.</p>
      </div>
      <LienBouton href={seance.lienStudio} taille="lg" className="min-h-[56px] w-full sm:w-auto sm:self-start">
        Retourner au studio <ArrowRight className="h-5 w-5" aria-hidden />
      </LienBouton>
    </section>
  );
}

function CarteProchaineSeance({ seance, maintenant }: { seance: SeanceFormateur; maintenant: number }) {
  const debut = new Date(seance.debut).getTime();
  const dans = debut - maintenant;
  // À 30 minutes du début, le geste utile devient « ouvrir le studio » (tests son et image, accueil des salles).
  const studioDabord = dans <= 30 * MINUTE;
  const etapes = [
    { ok: seance.preparation.plan > 0, texte: seance.preparation.plan ? `Plan : ${pluriel(seance.preparation.plan, "étape")}` : "Plan à écrire" },
    { ok: seance.preparation.diapos > 0, texte: seance.preparation.diapos ? pluriel(seance.preparation.diapos, "diapo") : "Aucune diapo" },
    { ok: seance.preparation.description, texte: seance.preparation.description ? "Description prête" : "Description à écrire" },
  ];
  return (
    <section aria-labelledby="titre-seance" className="flex flex-col gap-5 rounded-[24px] bg-encre p-5 text-white sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-peche">Prochaine séance · {seance.coursCode}</span>
        {dans <= 0 && <Badge ton="direct">Vos étudiants attendent</Badge>}
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 id="titre-seance" className="text-[26px] font-black leading-[1.06] tracking-serre sm:text-[32px]">
          {seance.titre}
        </h2>
        <p className="text-nuit-doux">{seance.coursTitre}</p>
      </div>
      <div className="flex flex-col gap-1 rounded-2xl bg-nuit-carte px-4 py-3">
        <span className="text-[15px] font-bold">
          {majuscule(jourRelatif(seance.debut, maintenant))} · {seance.dureeMinutes} min
        </span>
        <span className="font-mono text-sm text-orange-peche">{heureDouble(seance.debut)}</span>
      </div>
      {dans > 0 && dans < 8 * 24 * 60 * MINUTE && <CompteARebours cible={seance.debut} />}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Préparation de la séance">
        {etapes.map((e) => (
          <li key={e.texte} className="flex items-center gap-2 rounded-xl bg-nuit-carte px-3 py-2.5 text-sm">
            {e.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#6FD3A0]" aria-label="Prêt" /> : <CircleAlert className="h-4 w-4 shrink-0 text-orange" aria-label="À faire" />}
            <span className={e.ok ? "text-nuit-texte" : "text-white"}>{e.texte}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {studioDabord ? (
          <>
            <LienBouton href={seance.lienStudio} taille="lg" className="min-h-[56px]">
              Ouvrir le studio <ArrowRight className="h-5 w-5" aria-hidden />
            </LienBouton>
            <LienBouton href={seance.lienPreparation} variante="nuit" taille="lg" className="min-h-[56px]">
              Préparer
            </LienBouton>
          </>
        ) : (
          <>
            <LienBouton href={seance.lienPreparation} taille="lg" className="min-h-[56px]">
              Préparer la séance <ArrowRight className="h-5 w-5" aria-hidden />
            </LienBouton>
            <LienBouton href={seance.lienStudio} variante="nuit" taille="lg" className="min-h-[56px]">
              Ouvrir le studio
            </LienBouton>
          </>
        )}
      </div>
      <a href={seance.lienAgenda} className="flex min-h-[44px] items-center gap-2 self-start text-sm font-semibold text-nuit-doux hover:text-white" download>
        <CalendarPlus className="h-4 w-4" aria-hidden /> Ajouter à mon agenda
      </a>
    </section>
  );
}

function LigneSeanceSuivante({ seance }: { seance: SeanceFormateur }) {
  return (
    <Link href={seance.lienPreparation} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-ligne px-4 py-3 text-encre no-underline hover:border-orange hover:text-encre">
      <Radio className="h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold">Ensuite : {seance.titre}</span>
        <span className="font-mono text-xs text-texte-gris">
          {seance.coursCode} · {majuscule(jourRelatif(seance.debut))} · {heureDouble(seance.debut)}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 text-texte-gris" aria-hidden />
    </Link>
  );
}

// ── Copies à corriger ──────────────────────────────────────────────────────

function CopiesACorriger({ data }: { data: AccueilFormateur }) {
  return (
    <section aria-labelledby="titre-copies">
      <TitreSection
        titre={
          <span id="titre-copies" className="flex items-center gap-2">
            Copies à corriger {data.totalCopies > 0 && <Badge ton="orange">{data.totalCopies}</Badge>}
          </span>
        }
        action={
          <Link href="/corrections" className="-my-2.5 inline-flex items-center gap-1 py-2.5 text-[15px] font-bold">
            Tout voir <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />
      {data.copies.length ? (
        <ul className="flex flex-col gap-2.5">
          {data.copies.map((c) => (
            <li key={c.devoirId}>
              <CarteLien href={c.lien} className="flex items-center gap-4 px-4 py-3.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-orange text-lg font-black tabular-nums text-encre" aria-label={pluriel(c.nombre, "copie")}>
                  {c.nombre}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-bold leading-snug">{c.titre}</span>
                  <span className="text-sm text-texte-pale">
                    <span className="font-mono text-xs font-semibold text-orange-fonce">{c.coursCode}</span>
                    {c.enRetard > 0 && ` · dont ${c.enRetard} en retard`}
                    {c.plusAncienne && ` · la plus ancienne ${relatif(c.plusAncienne)}`}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
              </CarteLien>
            </li>
          ))}
        </ul>
      ) : (
        <EtatVide
          icone={<ClipboardCheck className="h-5 w-5" />}
          titre="Aucune copie en attente"
          texte="Les devoirs rendus par vos étudiants apparaissent ici, les plus anciens d'abord, dès qu'ils arrivent."
        />
      )}
    </section>
  );
}

// ── Questions du dernier live restées sans réponse ─────────────────────────

function QuestionsEnSuspens({ questions, maintenant }: { questions: AccueilFormateur["questions"]; maintenant: number }) {
  return (
    <section aria-labelledby="titre-questions">
      <TitreSection titre={<span id="titre-questions">Questions en suspens</span>} />
      {!questions ? (
        <EtatVide
          icone={<MessagesSquare className="h-5 w-5" />}
          titre="Pas encore de live terminé"
          texte="Après chaque live, les questions votées par les campus et restées sans réponse s'affichent ici pour que vous puissiez y revenir."
        />
      ) : (
        <Carte className="flex flex-col gap-4">
          <p className="font-mono text-xs text-texte-gris">
            Dernier live : {questions.coursCode} · {questions.seanceTitre}
            {questions.termineeLe && ` · ${relatif(questions.termineeLe, maintenant)}`}
          </p>
          {questions.liste.length ? (
            <ul className="flex flex-col divide-y divide-ligne">
              {questions.liste.map((q) => (
                <li key={q.id} className="flex items-start gap-3 py-3 first:pt-0">
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-creme py-1.5" aria-label={pluriel(q.votes, "vote")}>
                    <ThumbsUp className="h-3.5 w-3.5 text-orange-fonce" aria-hidden />
                    <span className="font-mono text-sm font-bold tabular-nums">{q.votes}</span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold leading-snug">{q.texte}</span>
                    {q.site && <span className="font-mono text-xs text-texte-gris">{q.site}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-[15px] text-succes">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Toutes les questions ont reçu une réponse.
            </p>
          )}
          {questions.total > questions.liste.length && <p className="text-sm text-texte-pale">Et {questions.total - questions.liste.length} autre(s) dans le bilan.</p>}
          <LienBouton href={questions.lien} variante="contour" className="min-h-[48px] self-start">
            Voir le bilan de la séance
          </LienBouton>
        </Carte>
      )}
    </section>
  );
}

// ── Messages, cours, semaine ───────────────────────────────────────────────

function Messages({ nombre }: { nombre: number }) {
  return (
    <CarteLien href="/messages" className={cn("flex items-center gap-4 px-5 py-4", nombre > 0 && "border-orange bg-orange-pale")}>
      <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-full", nombre > 0 ? "bg-orange text-encre" : "bg-creme text-texte-pale")}>
        <MessageCircle className="h-5 w-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[17px] font-extrabold">{nombre > 0 ? `${pluriel(nombre, "message")} non lu${nombre > 1 ? "s" : ""}` : "Aucun message en attente"}</span>
        <span className="text-sm text-texte-pale">{nombre > 0 ? "Vos étudiants et la vie scolaire vous ont écrit." : "Vos étudiants vous écrivent ici, comme sur WhatsApp."}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
    </CarteLien>
  );
}

function MesCours({ cours }: { cours: CoursFormateur[] }) {
  return (
    <section aria-labelledby="titre-cours">
      <TitreSection titre={<span id="titre-cours">Mes cours</span>} />
      {cours.length ? (
        <div className="flex flex-col gap-3">
          {cours.map((c) => (
            <CarteLien key={c.id} href={`/enseigner/cours/${c.id}`} className="flex flex-col gap-1.5 px-5 py-4">
              <span className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-semibold text-orange-fonce">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.couleur }} aria-hidden />
                {c.code}
                {c.statut === "brouillon" && <Badge ton="gris">Brouillon</Badge>}
                {c.statut === "archive" && <Badge ton="gris">Archivé</Badge>}
              </span>
              <span className="text-[17px] font-bold leading-snug">{c.titre}</span>
              <span className="text-[13px] text-texte-gris">
                {pluriel(c.etudiants, "étudiant")} · {pluriel(c.campus, "campus", "campus")}
                {c.prochaineSeance &&
                  (c.prochaineSeance.statut === "en_direct"
                    ? " · En direct maintenant"
                    : ` · Live ${jourRelatif(c.prochaineSeance.debut)} à ${heure(c.prochaineSeance.debut)} (Abidjan)`)}
              </span>
            </CarteLien>
          ))}
        </div>
      ) : (
        <EtatVide
          icone={<BookOpen className="h-5 w-5" />}
          titre="Aucun cours pour l'instant"
          texte="La direction des études vous attribue vos cours. Ils apparaîtront ici avec leurs classes et leurs campus."
        />
      )}
    </section>
  );
}

function MaSemaine({ elements }: { elements: ElementAgenda[] }) {
  return (
    <section aria-labelledby="titre-semaine">
      <TitreSection
        titre={<span id="titre-semaine">Mes 7 prochains jours</span>}
        action={
          <Link href="/agenda" className="-my-2.5 inline-flex items-center gap-1 py-2.5 text-[15px] font-bold">
            Agenda <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />
      {elements.length ? (
        <ul className="flex flex-col divide-y divide-ligne border-y border-ligne">
          {elements.map((e) => {
            const Icone = e.type === "live" ? Radio : e.type === "devoir" ? ClipboardList : CalendarDays;
            const contenu = (
              <>
                <Icone className="mt-0.5 h-4 w-4 shrink-0 text-orange-fonce" aria-hidden />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] font-bold leading-snug">
                    {e.type === "devoir" ? "Échéance : " : ""}
                    {e.titre}
                  </span>
                  <span className="font-mono text-xs text-texte-gris">
                    {e.coursCode ? `${e.coursCode} · ` : ""}
                    {majuscule(jourRelatif(e.debut))} · {heureDouble(e.debut)}
                  </span>
                </span>
              </>
            );
            return (
              <li key={e.cle}>
                {e.lien ? (
                  <Link href={e.lien} className="flex min-h-[56px] items-start gap-3 py-3 text-encre no-underline hover:text-orange-fonce">
                    {contenu}
                  </Link>
                ) : (
                  <div className="flex min-h-[56px] items-start gap-3 py-3">{contenu}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl bg-creme px-4 py-4 text-[15px] text-texte-pale">Rien de prévu ces sept prochains jours.</p>
      )}
    </section>
  );
}
