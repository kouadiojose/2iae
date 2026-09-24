// /accueil — « Aujourd'hui » de l'étudiant.
//
// Le serveur choisit LA chose à faire maintenant (live en cours → devoir dû
// sous 24 h → live dans moins de 2 h → message d'un formateur → devoir) ;
// l'écran la montre en grand avec un seul bouton, puis trois lignes au plus,
// les cours avec leur progression et l'annonce importante. Tout doit tenir
// et respirer sur un téléphone de 390 px.
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Megaphone, MessageCircle, Radio, BookOpen } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { useTousEvenements } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { jourLong, heure, pastilleDate, relatif } from "@/lib/dates";
import { cn, pluriel } from "@/lib/utils";
import { Page, lienAide } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { CarteLien, TitreSection } from "@/components/ui/carte";
import { Badge, BadgeDirect, BarreProgression, EtatVide, Erreur, PastilleDate, Squelette } from "@/components/ui/divers";
import { DecompteCourt, useMaintenant } from "@/components/ui/compte-a-rebours";
import { BandeauProchainLive } from "@/modules/live/BandeauProchainLive";
import { InviteInstallation } from "@/modules/pwa/InviteInstallation";
import type { AccueilEtudiant, AnnonceResume, CoursAccueil, ElementAFaire } from "@shared/schema";
import { EVENEMENTS_ACCUEIL, jourRelatif, majuscule } from "./outils";

export default function PageAccueil() {
  const { data, isLoading, error, refetch } = useQuery<AccueilEtudiant>({
    queryKey: ["/api/accueil"],
    // Les priorités changent avec l'heure (un live qui commence, une échéance qui approche).
    refetchInterval: 60_000,
  });
  const maintenant = useMaintenant(60_000);

  useTousEvenements((e) => {
    if (EVENEMENTS_ACCUEIL.has(e.type)) void rafraichir("/api/accueil");
  });

  if (error && !data) {
    return (
      <Page>
        <Erreur message={(error as Error).message} reessayer={() => void refetch()} />
      </Page>
    );
  }
  if (isLoading || !data) return <SqueletteAccueil />;

  return (
    <Page className="gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          {data.contexte && <span className="font-mono text-xs text-texte-gris">{data.contexte}</span>}
          <h1 className="titre-page">
            {data.salutation} {data.prenom}.
          </h1>
          <p className="text-[15px] text-texte-pale">{majuscule(jourLong(maintenant))}</p>
        </div>
        <div className="hidden gap-2 rounded-[14px] bg-creme p-1.5 sm:flex" aria-label="Ma semaine">
          <span className="rounded-[10px] bg-white px-3.5 py-2 text-sm font-bold">Semaine {data.semaine.numero}</span>
          <span className="px-3.5 py-2 text-sm text-texte-pale">
            {pluriel(data.semaine.lives, "live")} · {pluriel(data.semaine.devoirs, "devoir")} à rendre
          </span>
        </div>
      </header>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-7">
          <CarteAFaire element={data.aFaire} />
          <BandeauProchainLive />
          <Ensuite elements={data.prochains} />
        </div>
        <div className="flex min-w-0 flex-col gap-7">
          {data.annonceImportante && <AnnonceImportante annonce={data.annonceImportante} />}
          <LienAnnonces nonLues={data.annoncesNonLues} />
          <MesCours cours={data.cours} />
        </div>
      </div>

      <InviteInstallation />
    </Page>
  );
}

// ── La grande carte « À faire maintenant » ─────────────────────────────────

/** Couleur de la carte selon la nature de l'action : le direct en nuit, le bientôt en orange, le reste en crème. */
function styleCarte(type: ElementAFaire["type"]) {
  if (type === "live") return { fond: "bg-encre text-white", bouton: "principal" as const, doux: "text-nuit-doux", code: "text-orange-peche" };
  if (type === "live_bientot") return { fond: "bg-orange text-encre", bouton: "encre" as const, doux: "text-[#2B211B]", code: "text-encre" };
  if (type === "a_jour") return { fond: "border border-ligne bg-white text-encre", bouton: "principal" as const, doux: "text-texte-pale", code: "text-orange-fonce" };
  return { fond: "bg-creme text-encre", bouton: "principal" as const, doux: "text-texte-doux", code: "text-orange-fonce" };
}

function EtiquetteAFaire({ element }: { element: ElementAFaire }) {
  const maintenant = useMaintenant(30_000);
  const passe = element.quand ? new Date(element.quand).getTime() <= maintenant : false;
  switch (element.type) {
    case "live":
      return <BadgeDirect />;
    case "live_bientot":
      return (
        <span className="rounded-full bg-encre px-3 py-1.5 font-mono text-xs text-white">
          {passe || !element.quand ? "Ça commence" : <>Dans <DecompteCourt cible={element.quand} /></>}
        </span>
      );
    case "devoir_urgent":
      return (
        <Badge ton="danger" className="text-[13px]">
          {element.quand && !passe ? (
            <>
              Reste <DecompteCourt cible={element.quand} />
            </>
          ) : (
            "Dernier moment"
          )}
        </Badge>
      );
    case "devoir_retard":
      return <Badge ton="danger">En retard</Badge>;
    case "message":
      return <Badge ton="orange">Non lu</Badge>;
    case "a_jour":
      return <Badge ton="succes">À jour</Badge>;
    default:
      return element.quand ? <Badge ton="gris">{majuscule(relatif(element.quand, maintenant))}</Badge> : null;
  }
}

function IconeAFaire({ type, className }: { type: ElementAFaire["type"]; className?: string }) {
  const Icone =
    type === "live" || type === "live_bientot" || type === "live_prevu"
      ? Radio
      : type === "message"
        ? MessageCircle
        : type === "a_jour"
          ? CheckCircle2
          : ClipboardList;
  return <Icone className={className} aria-hidden />;
}

function CarteAFaire({ element }: { element: ElementAFaire }) {
  const style = styleCarte(element.type);
  return (
    <section aria-labelledby="titre-a-faire" className={cn("flex flex-col gap-5 rounded-[24px] p-5 sm:p-7", style.fond)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={cn("flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]", style.doux)}>
          <IconeAFaire type={element.type} className="h-4 w-4" />
          À faire maintenant
        </span>
        <EtiquetteAFaire element={element} />
      </div>
      <div className="flex flex-col gap-2" aria-live="polite">
        {element.coursCode && <span className={cn("font-mono text-xs font-semibold", style.code)}>{element.coursCode}</span>}
        <h2 id="titre-a-faire" className="text-[26px] font-black leading-[1.06] tracking-serre sm:text-[32px]">
          {element.titre}
        </h2>
        <p className={cn("text-base leading-relaxed", style.doux)}>{element.detail}</p>
      </div>
      <LienBouton href={element.lien} variante={style.bouton} taille="lg" className="min-h-[56px] w-full sm:w-auto sm:self-start">
        {element.bouton}
        <ArrowRight className="h-5 w-5" aria-hidden />
      </LienBouton>
    </section>
  );
}

// ── « Ensuite » : trois lignes au plus ─────────────────────────────────────

function Ensuite({ elements }: { elements: ElementAFaire[] }) {
  if (!elements.length) return null;
  return (
    <section aria-labelledby="titre-ensuite">
      <TitreSection
        titre={<span id="titre-ensuite">Ensuite</span>}
        action={
          <Link href="/agenda" className="-my-2.5 inline-flex items-center gap-1 py-2.5 text-[15px] font-bold">
            Voir ma semaine <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />
      <ul className="flex flex-col divide-y divide-ligne border-y border-ligne">
        {elements.map((e) => (
          <li key={`${e.type}-${e.lien}`}>
            <Link href={e.lien} className="group flex min-h-[72px] items-center gap-4 py-3 text-encre no-underline hover:text-encre">
              {e.quand && e.type !== "message" ? (
                <PastilleDate {...pastilleDate(e.quand)} ton={e.type === "devoir_retard" ? "encre" : "creme"} />
              ) : (
                <span className="grid h-[52px] w-14 shrink-0 place-items-center rounded-xl bg-orange-clair text-orange-fonce">
                  <IconeAFaire type={e.type} className="h-5 w-5" />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-bold leading-snug group-hover:text-orange-fonce">{e.titre}</span>
                <span className="text-sm leading-snug text-texte-pale">
                  {e.coursCode && <span className="font-mono text-[12px] font-semibold text-orange-fonce">{e.coursCode} · </span>}
                  {e.detail}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Annonce importante ou épinglée ─────────────────────────────────────────

function AnnonceImportante({ annonce }: { annonce: AnnonceResume }) {
  const maintenant = useMaintenant(60_000);
  return (
    <Link
      href={`/annonces/${annonce.id}`}
      className={cn(
        "group flex flex-col gap-2 rounded-2xl p-5 text-encre no-underline hover:text-encre",
        annonce.importante && !annonce.lue ? "border-[1.5px] border-orange bg-orange-pale" : "border border-ligne bg-creme",
      )}
    >
      <span className="flex flex-wrap items-center gap-2">
        <Megaphone className="h-4 w-4 text-orange-fonce" aria-hidden />
        <span className="etiquette">{annonce.importante ? "Annonce importante" : "Annonce épinglée"}</span>
        {!annonce.lue && <Badge ton="orange">Nouveau</Badge>}
      </span>
      <span className="text-lg font-extrabold leading-snug">{annonce.titre}</span>
      <span className="line-clamp-3 text-[15px] leading-relaxed text-texte-doux">{annonce.extrait}</span>
      <span className="font-mono text-xs text-texte-gris">
        {annonce.auteur} · {relatif(annonce.publieeLe, maintenant)}
      </span>
      <span className="mt-1 flex items-center gap-1 text-[15px] font-bold text-orange-fonce group-hover:text-encre">
        Lire l'annonce <ArrowRight className="h-4 w-4" aria-hidden />
      </span>
    </Link>
  );
}

/** Accès à toutes les annonces (elles n'ont pas d'onglet : on y arrive d'ici ou par la cloche). */
function LienAnnonces({ nonLues }: { nonLues: number }) {
  return (
    <Link href="/annonces" className="-mt-3 flex min-h-[56px] items-center gap-3 rounded-2xl border border-ligne px-4 py-3 text-encre no-underline hover:border-orange hover:text-encre">
      <Megaphone className="h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold">Toutes les annonces</span>
        <span className="text-sm text-texte-pale">{nonLues ? `${nonLues} que tu n'as pas encore lue${nonLues > 1 ? "s" : ""}` : "Tu as tout lu."}</span>
      </span>
      {nonLues > 0 && <Badge ton="orange">{nonLues}</Badge>}
      <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
    </Link>
  );
}

// ── Mes cours ──────────────────────────────────────────────────────────────

function metaCours(c: CoursAccueil) {
  const lecons = c.leconsTotal ? `${c.leconsTerminees} leçon${c.leconsTerminees > 1 ? "s" : ""} sur ${c.leconsTotal}` : "Leçons bientôt en ligne";
  if (!c.prochaineSeance) return c.formateur ? `${lecons} · ${c.formateur}` : lecons;
  if (c.prochaineSeance.statut === "en_direct") return `${lecons} · En direct maintenant`;
  return `${lecons} · Live ${jourRelatif(c.prochaineSeance.debut)} à ${heure(c.prochaineSeance.debut)}`;
}

function MesCours({ cours }: { cours: CoursAccueil[] }) {
  const moi = useMoiConnecte();
  const aide = lienAide(moi);
  return (
    <section aria-labelledby="titre-mes-cours">
      <TitreSection
        titre={<span id="titre-mes-cours">Mes cours</span>}
        action={
          cours.length ? (
            <Link href="/cours" className="-my-2.5 inline-flex items-center gap-1 py-2.5 text-[15px] font-bold">
              Tous <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : undefined
        }
      />
      {cours.length ? (
        <div className="flex flex-col gap-3">
          {cours.map((c) => (
            <CarteLien key={c.id} href={`/cours/${c.id}`} className="flex flex-col gap-3 px-5 py-[18px]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-2 font-mono text-[11px] font-semibold text-orange-fonce">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.couleur }} aria-hidden />
                    {c.code}
                    {c.prochaineSeance?.statut === "en_direct" && <BadgeDirect className="ml-1 px-2 py-0.5 text-[10px]" />}
                  </span>
                  <span className="text-[17px] font-bold leading-snug">{c.titre}</span>
                  <span className="text-[13px] text-texte-gris">{metaCours(c)}</span>
                </div>
                <span className="text-[22px] font-extrabold tabular-nums" aria-label={`Progression : ${c.progression} %`}>
                  {c.progression}%
                </span>
              </div>
              <BarreProgression valeur={c.progression} ton={c.progression === 100 ? "succes" : "orange"} />
            </CarteLien>
          ))}
        </div>
      ) : (
        <EtatVide
          icone={<BookOpen className="h-5 w-5" />}
          titre="Tes cours arrivent bientôt"
          texte="Dès que la vie scolaire t'inscrit à un cours, il apparaît ici avec ta progression. Si rien n'apparaît d'ici la rentrée, écris-lui."
          action={
            aide ? (
              <LienBouton href={aide} externe variante="contour" icone={<MessageCircle className="h-4 w-4" />}>
                Écrire à la vie scolaire
              </LienBouton>
            ) : undefined
          }
        />
      )}
      <Link href="/agenda" className="mt-4 flex min-h-[48px] items-center gap-2 text-[15px] font-bold lg:hidden">
        <CalendarDays className="h-4 w-4" aria-hidden /> Ouvrir mon agenda de la semaine
      </Link>
    </section>
  );
}

function SqueletteAccueil() {
  return (
    <Page className="gap-7">
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Chargement de ton accueil">
        <Squelette className="h-4 w-56" />
        <Squelette className="h-10 w-48" />
      </div>
      <Squelette className="h-64 rounded-[24px]" />
      <div className="flex flex-col gap-3">
        <Squelette className="h-16" />
        <Squelette className="h-16" />
      </div>
    </Page>
  );
}
