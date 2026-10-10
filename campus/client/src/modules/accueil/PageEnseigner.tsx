// /enseigner — « Aujourd'hui » du formateur, refait pour qui sait seulement se connecter (demande de José du
// 8 octobre 2026 au soir : « Il arrive : qu'est-ce qu'il voit ? Ses séances. ») Trois blocs, dans cet ordre :
//
// 1. « Ma prochaine classe » : le cours, le jour et l'heure en gros, et UN seul gros bouton qui change seul :
//    « Préparer mon cours » longtemps avant (la préparation existante), puis « Entrer dans ma classe » à partir de
//    45 minutes avant et pendant le direct (le Studio existant, /live/:id, comme l'ancien « Ouvrir le studio »).
//    Visible sans défiler sur téléphone : le fuseau, le lieu et la préparation détaillée passent dessous, repliés.
// 2. « À faire », seulement s'il y a quelque chose : corrigés à vérifier, copies à revoir ou à corriger,
//    relectures, notes à envoyer, messages non lus. Une ligne et un gros bouton par chose.
// 3. « Mes séances » : les 5 dernières séances tenues en cartes (CarteSeance : vidéo, cours résumé, QCM,
//    exercice, présents), puis « Voir toutes mes séances » (/mes-seances).
//
// Le reste (écrire aux étudiants, mes cours, vidéos des cours, emploi du temps, annonces, questions en
// suspens) n'est plus qu'une rangée de liens simples en bas : rien ne disparaît du campus, seulement de l'accueil.
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Megaphone,
  MessageCircle,
  MessageSquareQuote,
  MessagesSquare,
  PenLine,
  PlayCircle,
  Radio,
  Send,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTousEvenements } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { heure, heureDouble, jourLong } from "@/lib/dates";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { Page } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { CarteLien } from "@/components/ui/carte";
import { BadgeDirect, Erreur, Squelette } from "@/components/ui/divers";
import { DecompteCourt, useMaintenant } from "@/components/ui/compte-a-rebours";
import { LimiteSilencieuse } from "@/components/ui/limite-silencieuse";
import { CarteSeance } from "@/components/seances/CarteSeance";
import { SquelettesSeances } from "@/components/seances/FilDesSeances";
import { useDernieresSeances } from "@/components/seances/fil";
import type { AccueilFormateur, SeanceFormateur } from "@shared/schema";
import type { ResumeEnseigner } from "@shared/engagement/enseigner";
import { selonNombre, t, type CleTravail } from "@shared/textes/travail";
import type { Traducteur } from "@shared/textes";
import { EVENEMENTS_ACCUEIL, jourRelatif, majuscule } from "./outils";
import { CartePretClasse, ConfirmationFuseau, LieuDuCours } from "@/modules/visio";
import { MANUELS } from "@/modules/manuels/manuels";

type Tx = Traducteur<CleTravail>;

const MINUTE = 60_000;
/** À 45 minutes du début, le geste utile devient « entrer dans ma classe » (la fenêtre de démarrage du Studio s'ouvre aussi à 45 minutes). */
const AVANT_CLASSE = 45 * MINUTE;

export default function PageEnseigner() {
  const tx = useTextes(t);
  const { data, isLoading, error, refetch } = useQuery<AccueilFormateur>({ queryKey: ["/api/accueil/formateur"], refetchInterval: 60_000 });
  const maintenant = useMaintenant(30_000);

  useTousEvenements((e) => {
    if (EVENEMENTS_ACCUEIL.has(e.type)) void rafraichir("/api/accueil/formateur", "/api/enseigner/apres-seance", "/api/fil");
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
      <Page className="gap-6">
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Chargement">
          <Squelette className="h-4 w-40" />
          <Squelette className="h-9 w-52" />
        </div>
        <Squelette className="h-80 rounded-[24px]" />
      </Page>
    );
  }

  return <ContenuAccueil data={data} seance={data.enDirect ?? data.prochaineSeance} maintenant={maintenant} tx={tx} />;
}

function ContenuAccueil({ data, seance, maintenant, tx }: { data: AccueilFormateur; seance: SeanceFormateur | null; maintenant: number; tx: Tx }) {
  const choses = useChosesAFaire(data.messagesNonLus, tx);
  return (
    <Page className="gap-6 sm:gap-8">
      <header className="flex flex-col gap-1">
        <span className="text-[15px] font-semibold text-texte-pale">{majuscule(jourLong(maintenant))}</span>
        <h1 className="text-[30px] font-black leading-[1.05] tracking-serre sm:text-[40px]">
          {data.salutation} {data.prenom}.
        </h1>
      </header>

      {/* Sur ordinateur, « À faire » se range à droite de la classe ; rien à faire : la classe seule. */}
      <div className={cn("grid gap-6 lg:items-start lg:gap-8", choses.length ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" : "lg:max-w-[760px]")}>
        <div className="flex min-w-0 flex-col gap-4">
          <CarteMaClasse data={data} maintenant={maintenant} tx={tx} />
          {/* Module visio : fuseau deviné par le navigateur, à confirmer une fois (sous le bouton, jamais au-dessus). */}
          <ConfirmationFuseau className="lg:flex-col lg:items-stretch" />
          {seance && (
            <details className="group rounded-2xl border border-ligne bg-white">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-4 py-3 text-[16px] font-bold text-encre [&::-webkit-details-marker]:hidden">
                <Radio className="h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
                <span className="flex-1">{tx("classe.reglages")}</span>
                <ChevronDown className="h-5 w-5 shrink-0 text-texte-gris transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="flex flex-col gap-4 border-t border-ligne-douce p-4">
                {/* Module visio : le lieu d'où il enseigne, puis l'essai de la visio, le fuseau, les diapos, le plan. */}
                <LieuDuCours />
                {!data.enDirect && <CartePretClasse />}
              </div>
            </details>
          )}
        </div>

        {choses.length > 0 && (
          <LimiteSilencieuse nom="AFaire">
            <AFaire choses={choses} tx={tx} />
          </LimiteSilencieuse>
        )}
      </div>

      <LimiteSilencieuse nom="MesSeances">
        <MesSeances tx={tx} />
      </LimiteSilencieuse>

      <LiensSimples data={data} tx={tx} />
    </Page>
  );
}

// ── Ma prochaine classe ────────────────────────────────────────────────────

function CarteMaClasse({ data, maintenant, tx }: { data: AccueilFormateur; maintenant: number; tx: Tx }) {
  if (data.enDirect) return <CarteClasse seance={data.enDirect} enDirect maintenant={maintenant} ensuite={data.prochaineSeance} tx={tx} />;
  if (data.prochaineSeance) return <CarteClasse seance={data.prochaineSeance} maintenant={maintenant} tx={tx} />;
  return (
    <section aria-labelledby="titre-classe" className="flex flex-col gap-4 rounded-[24px] bg-encre p-5 text-white sm:p-7">
      <span className="font-mono text-[13px] uppercase tracking-[0.12em] text-orange-peche">{tx("classe.etiquette")}</span>
      <h2 id="titre-classe" className="text-[28px] font-black leading-tight sm:text-[34px]">
        {tx("classe.aucune.titre")}
      </h2>
      <p className="text-[16px] leading-relaxed text-nuit-doux">{tx("classe.aucune.texte")}</p>
      <LienBouton href="/emploi-du-temps" variante="nuit" taille="lg" icone={<CalendarRange className="h-5 w-5" />} className="min-h-[56px] text-[17px] sm:self-start">
        {tx("classe.aucune.emploi")}
      </LienBouton>
    </section>
  );
}

function CarteClasse({ seance, enDirect = false, maintenant, ensuite, tx }: { seance: SeanceFormateur; enDirect?: boolean; maintenant: number; ensuite?: SeanceFormateur | null; tx: Tx }) {
  const debut = new Date(seance.debut).getTime();
  const dans = debut - maintenant;
  // UN bouton qui change seul : préparer longtemps avant, entrer dans la classe à 45 minutes et pendant le direct.
  const entrer = enDirect || dans <= AVANT_CLASSE;
  const attendent = !enDirect && dans <= 0;
  // « 08h30 » en gros ; dessous « heure d'Abidjan · 04h30 chez vous (Toronto) » pour un formateur à l'étranger.
  const sousHeure = heureDouble(seance.debut).replace(/^\d{2}h\d{2} Abidjan/, tx("classe.abidjan"));
  return (
    <section aria-labelledby="titre-classe" className={cn("flex flex-col gap-4 rounded-[24px] p-5 text-white sm:p-7", enDirect ? "bg-nuit" : "bg-encre")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[13px] uppercase tracking-[0.12em] text-orange-peche">
          {enDirect ? tx("classe.etiquette.direct") : attendent ? tx("classe.etiquette.attente") : tx("classe.etiquette")} · {seance.coursCode}
        </span>
        {enDirect && <BadgeDirect />}
      </div>
      <h2 id="titre-classe" className="text-[26px] font-black leading-[1.08] sm:text-[32px]">
        {seance.coursTitre}
      </h2>
      {!enDirect && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[28px] font-black leading-tight tabular-nums sm:text-[34px]">
            {majuscule(jourRelatif(seance.debut, maintenant))} · {heure(seance.debut)}
          </span>
          <span className="text-[15px] text-nuit-doux">
            {sousHeure}
            {dans > 0 && dans < 24 * 60 * MINUTE && (
              <>
                {" · "}
                <span className="font-bold text-orange-peche">
                  {tx("classe.dans")} <DecompteCourt cible={seance.debut} />
                </span>
              </>
            )}
          </span>
        </div>
      )}
      <p className="text-[16px] leading-snug text-nuit-texte">{seance.titre}</p>
      {attendent && <p className="text-[16px] font-bold text-[#FF8A6B]">{tx("classe.attendent")}</p>}
      <LienBouton
        href={entrer ? seance.lienStudio : seance.lienPreparation}
        taille="lg"
        className="min-h-[64px] w-full px-5 text-[18px] sm:w-auto sm:self-start sm:px-8 sm:text-[19px]"
      >
        {entrer ? tx("classe.entrer") : tx("classe.preparer")} <ArrowRight className="h-6 w-6" aria-hidden />
      </LienBouton>
      {/* Un seul gros bouton ; l'autre geste reste à portée, en lien discret. */}
      <Link href={entrer ? seance.lienPreparation : seance.lienStudio} className="-mt-1 inline-flex min-h-[44px] items-center gap-1 self-start text-[15px] font-semibold text-nuit-doux no-underline hover:text-white">
        {entrer ? tx("classe.lien.preparer") : tx("classe.lien.entrer")} <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
      {enDirect && ensuite && (
        <p className="border-t border-nuit-ligne pt-3 text-[15px] text-nuit-doux">
          {tx("classe.ensuite", { v: { titre: ensuite.titre, quand: `${jourRelatif(ensuite.debut, maintenant)} à ${heure(ensuite.debut)}` } })}
        </p>
      )}
    </section>
  );
}

// ── À faire ────────────────────────────────────────────────────────────────

type Chose = { cle: string; href: string; n: number; icone: LucideIcon; titre: string; texte: string; principale?: boolean };

/** Ce qui attend le formateur, dans l'ordre d'importance ; vide quand il n'y a rien (le bloc ne s'affiche pas). */
function useChosesAFaire(messagesNonLus: number, tx: Tx): Chose[] {
  // Même requête que l'ancienne carte « Correction des copies » : un seul appel au serveur.
  const { data } = useQuery<ResumeEnseigner>({ queryKey: ["/api/enseigner/apres-seance"], staleTime: 60_000 });
  const c = data?.corriges;
  return [
    c?.aValider ? { cle: "corriges", href: "/enseigner/corriges", n: c.aValider, icone: ClipboardCheck, titre: selonNombre(tx, "afaire.corriges", c.aValider), texte: tx("afaire.corriges.texte"), principale: true } : null,
    c?.relectures ? { cle: "relectures", href: "/enseigner/a-revoir#relectures", n: c.relectures, icone: MessageSquareQuote, titre: selonNombre(tx, "afaire.relectures", c.relectures), texte: tx("afaire.relectures.texte") } : null,
    c?.aRevoir ? { cle: "a-revoir", href: "/enseigner/a-revoir#copies", n: c.aRevoir, icone: TriangleAlert, titre: selonNombre(tx, "afaire.aRevoir", c.aRevoir), texte: tx("afaire.aRevoir.texte") } : null,
    data?.copies.aCorriger ? { cle: "copies", href: "/corriger", n: data.copies.aCorriger, icone: PenLine, titre: selonNombre(tx, "afaire.copies", data.copies.aCorriger), texte: tx("afaire.copies.texte") } : null,
    data?.copies.aPublier ? { cle: "a-publier", href: "/corriger", n: data.copies.aPublier, icone: Send, titre: selonNombre(tx, "afaire.aPublier", data.copies.aPublier), texte: tx("afaire.aPublier.texte") } : null,
    messagesNonLus ? { cle: "messages", href: "/messages", n: messagesNonLus, icone: MessageCircle, titre: selonNombre(tx, "afaire.messages", messagesNonLus), texte: tx("afaire.messages.texte") } : null,
  ].filter((x): x is Chose => x !== null);
}

function AFaire({ choses, tx }: { choses: Chose[]; tx: Tx }) {
  return (
    <section aria-labelledby="titre-a-faire" className="flex flex-col gap-3">
      <h2 id="titre-a-faire" className="text-[24px] font-extrabold leading-tight">
        {tx("afaire.titre")}
      </h2>
      <ul className="flex flex-col gap-2.5">
        {choses.map((x) => (
          <li key={x.cle}>
            <LigneAFaire chose={x} ouvrir={tx("afaire.ouvrir")} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LigneAFaire({ chose: { href, n, icone: Icone, titre, texte, principale }, ouvrir }: { chose: Chose; ouvrir: string }) {
  return (
    <CarteLien href={href} className={cn("flex min-h-[76px] items-center gap-3.5 px-4 py-3.5", principale && "border-orange bg-orange-pale")}>
      <span
        className={cn("relative grid h-12 w-12 shrink-0 place-items-center rounded-xl text-[19px] font-black tabular-nums", principale ? "bg-orange text-encre" : "bg-creme text-encre")}
        aria-hidden
      >
        {n}
        <Icone className={cn("absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white p-0.5", principale ? "text-orange-fonce" : "text-texte-pale")} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[17px] font-extrabold leading-snug">{titre}</span>
        <span className="text-[14px] leading-snug text-texte-pale">{texte}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-xl bg-encre px-3 py-2.5 text-[15px] font-bold text-white">
        <span className="hidden min-[420px]:inline">{ouvrir}</span>
        <ChevronRight className="h-5 w-5" aria-hidden />
      </span>
    </CarteLien>
  );
}

// ── Mes séances ────────────────────────────────────────────────────────────

function MesSeances({ tx }: { tx: Tx }) {
  const { data, isLoading, error } = useDernieresSeances(5);
  const seances = data?.seances ?? [];
  return (
    <section aria-labelledby="titre-mes-seances" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="titre-mes-seances" className="text-[28px] font-extrabold leading-tight">
            {tx("seances.titre")}
          </h2>
          <p className="text-[16px] text-texte-pale">{tx("seances.sousTitre")}</p>
        </div>
      </div>
      {isLoading ? (
        <SquelettesSeances />
      ) : error && !data ? (
        <p className="rounded-2xl bg-creme px-4 py-4 text-[16px] text-texte-pale">{tx("seances.erreur")}</p>
      ) : !seances.length ? (
        <p className="rounded-2xl bg-creme px-4 py-4 text-[16px] leading-relaxed text-texte-pale">{tx("seances.vide.texte")}</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {seances.map((s) => (
            <li key={s.id} className="min-w-0">
              <CarteSeance seance={s} className="h-full" />
            </li>
          ))}
        </ul>
      )}
      <LienBouton href="/mes-seances" variante="encre" taille="lg" className="min-h-[60px] w-full text-[18px] sm:w-auto sm:self-start sm:px-8">
        {tx("seances.toutes")} <ArrowRight className="h-5 w-5" aria-hidden />
      </LienBouton>
    </section>
  );
}

// ── Liens simples ──────────────────────────────────────────────────────────

function LiensSimples({ data, tx }: { data: AccueilFormateur; tx: Tx }) {
  const enSuspens = data.questions?.total ?? 0;
  const liens: { href: string; icone: LucideIcon; libelle: string; compteur?: number }[] = [
    { href: "/annonces?nouvelle=1", icone: Megaphone, libelle: tx("liens.ecrire") },
    // La page de lecture du cours (comme l'onglet « Mes cours »), pas l'éditeur.
    { href: "/cours", icone: BookOpen, libelle: tx("liens.cours") },
    { href: "/replays", icone: PlayCircle, libelle: tx("liens.videos") },
    { href: "/emploi-du-temps", icone: CalendarRange, libelle: tx("liens.emploi") },
    { href: "/annonces", icone: ClipboardList, libelle: tx("liens.annonces"), compteur: data.annoncesNonLues || undefined },
    ...(data.questions && enSuspens > 0 ? [{ href: data.questions.lien, icone: MessagesSquare, libelle: tx("liens.questions"), compteur: enSuspens }] : []),
  ];
  return (
    <nav aria-labelledby="titre-liens" className="flex flex-col gap-3 border-t border-ligne-douce pt-6">
      <h2 id="titre-liens" className="text-xl font-extrabold">
        {tx("liens.titre")}
      </h2>
      <ul className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 lg:grid-cols-3">
        <li className="col-span-full">
          <LienManuel tx={tx} />
        </li>
        {liens.map((l) => (
          <li key={l.href}>
            <CarteLien href={l.href} className="flex min-h-[60px] items-center gap-3 px-4 py-3">
              <l.icone className="h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
              <span className="flex-1 text-[16px] font-bold leading-snug">{l.libelle}</span>
              {l.compteur ? <span className="rounded-full bg-orange px-2 py-0.5 font-mono text-[13px] font-bold text-encre">{l.compteur}</span> : null}
              <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
            </CarteLien>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Le manuel illustré du formateur, en tête des liens : la couverture et le PDF, ouvert dans un nouvel onglet
 * (un vrai lien, hors du routeur du campus ; le service worker ne le garde pas).
 */
function LienManuel({ tx }: { tx: Tx }) {
  const m = MANUELS.formateurs;
  return (
    <a
      href={m.pdf}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-[76px] items-center gap-3.5 rounded-2xl border border-orange bg-orange-pale px-4 py-3 text-encre no-underline transition-colors hover:border-orange-fonce hover:text-encre"
    >
      <img src={m.couverture} alt="" width={300} height={425} loading="lazy" className="h-[60px] w-[42px] shrink-0 rounded-md border border-ligne object-cover" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[17px] font-extrabold leading-snug">{tx("liens.manuel")}</span>
        <span className="text-[14px] leading-snug text-texte-pale">{tx("liens.manuel.detail")}</span>
        <span className="font-mono text-[12px] font-semibold text-orange-fonce">{tx("liens.manuel.infos", { v: { pages: m.pages, poids: m.poids } })}</span>
      </span>
      <ArrowUpRight className="h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
    </a>
  );
}
