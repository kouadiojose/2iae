// Briques des pages publiques : en-tête, pied de page, carte noire du
// prochain live, cartes de cours et de formateurs, boutons d'accès.
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, CalendarDays, MapPin, Radio, Share2 } from "lucide-react";
import { Marque } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { Avatar, Squelette } from "@/components/ui/divers";
import { CompteARebours, useMaintenant } from "@/components/ui/compte-a-rebours";
import { dateComplete, heure, heureDouble, dateCourte, relatif } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { VitrineCours, VitrineFormateur, VitrineLive } from "@shared/api";
import type { CampusCours, SitePublic } from "@shared/schema";
import { allerA, lienPreinscription, lienWhatsapp, nomCampus, URL_SITE, ville } from "./outils";

// ── En-tête et pied de page ────────────────────────────────────────────────

export type AncreNav = { id: string; libelle: string };

/** En-tête public de la maquette : la marque, quelques ancres, « Se connecter ». */
export function EnTetePublic({ ancres = [], liveEnDirect }: { ancres?: AncreNav[]; liveEnDirect?: VitrineLive | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-ligne-douce bg-white/95 backdrop-blur-md">
      <div className="conteneur flex items-center gap-4 py-2.5 sm:py-3">
        {/* Sur téléphone, la marque sans sous-titre laisse la place au bouton. */}
        <span className="sm:hidden">
          <Marque sousTitre={false} />
        </span>
        <span className="hidden sm:block">
          <Marque />
        </span>
        {ancres.length > 0 && (
          <nav className="hidden flex-1 justify-center gap-1 lg:flex" aria-label="Sections de la page">
            {ancres.map((a) => (
              <a
                key={a.id}
                href={`#${a.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  allerA(a.id);
                }}
                className="rounded-full px-4 py-2 text-sm font-semibold text-texte-doux no-underline transition-colors hover:bg-creme hover:text-encre"
              >
                {a.libelle}
              </a>
            ))}
          </nav>
        )}
        <div className={cn("ml-auto flex items-center gap-2", ancres.length > 0 && "lg:ml-0")}>
          {liveEnDirect && (
            <Link
              href={`/live/${liveEnDirect.id}`}
              className="hidden items-center gap-2 rounded-full bg-encre px-[18px] py-2.5 text-sm font-bold text-white no-underline transition-colors hover:bg-orange hover:text-encre sm:flex"
            >
              <span className="point-direct" />
              Rejoindre le live
            </Link>
          )}
          <LienBouton href="/connexion" variante="contour" taille="sm" className="min-h-[44px] whitespace-nowrap px-4 text-sm">
            Se connecter
          </LienBouton>
        </div>
      </div>
    </header>
  );
}

/** Pied de page : préinscription, site du groupe, les cinq campus. */
export function PiedPublic({ sites, sansAppel = false }: { sites: SitePublic[]; /** La page porte déjà son appel à la préinscription. */ sansAppel?: boolean }) {
  const annee = new Date(useMaintenant(3_600_000)).getUTCFullYear();
  return (
    <footer className="bg-encre text-white">
      <div className="conteneur flex flex-col gap-10 py-14 sm:py-16">
        {!sansAppel && (
        <div className="relative flex flex-col gap-6 overflow-hidden rounded-[28px] bg-orange p-7 text-encre sm:flex-row sm:items-end sm:justify-between sm:p-10">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border-[36px] border-encre/10" />
          <div className="relative flex max-w-xl flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.12em]">Préinscription en ligne</span>
            <h2 className="text-[30px] font-black leading-[1.02] tracking-serre sm:text-[40px]">Pas encore étudiant à 2IAE ?</h2>
            <p className="text-base leading-relaxed text-[#2B211B] sm:text-[17px]">
              La préinscription se fait en quelques minutes sur le site du groupe. Vous suivrez ensuite vos cours ici, dans votre campus ou sur votre téléphone.
            </p>
          </div>
          <div className="relative flex flex-col gap-2 sm:items-end">
            <a
              href={lienPreinscription()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-encre px-6 text-base font-bold text-white no-underline hover:bg-white hover:text-encre"
            >
              Faire ma préinscription <ArrowUpRight className="h-5 w-5" />
            </a>
            <a href={URL_SITE} target="_blank" rel="noopener noreferrer" className="px-2 py-2 text-[15px] font-semibold text-encre underline-offset-4 hover:text-encre hover:underline">
              Découvrir le Groupe 2IAE
            </a>
          </div>
        </div>
        )}

        <div className="grid gap-8 sm:grid-cols-[1.2fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <Marque sombre />
            <p className="max-w-sm text-[15px] leading-relaxed text-nuit-doux">
              Le campus numérique du Groupe Écoles 2IAE International : un cours, cinq campus, en direct.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-peche">Les campus</span>
            <ul className="flex flex-col gap-1.5 text-[15px] text-nuit-doux">
              {sites.map((s) => (
                <li key={s.slug}>{nomCampus(s)}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-peche">Accès</span>
            <ul className="flex flex-col text-[15px]">
              <li>
                <Link href="/connexion" className="inline-block py-1.5 text-white no-underline hover:text-orange">
                  Se connecter au campus
                </Link>
              </li>
              <li>
                <a href={lienPreinscription()} target="_blank" rel="noopener noreferrer" className="inline-block py-1.5 text-white no-underline hover:text-orange">
                  Préinscription
                </a>
              </li>
              <li>
                <a href={URL_SITE} target="_blank" rel="noopener noreferrer" className="inline-block py-1.5 text-white no-underline hover:text-orange">
                  Site du Groupe 2IAE · www.2iae.com
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-1 border-t border-nuit-ligne pt-6 font-mono text-xs text-nuit-gris sm:flex-row sm:justify-between">
          <span>© {annee} Groupe Écoles 2IAE International</span>
          <span>Heure d'Abidjan · Côte d'Ivoire</span>
        </div>
      </div>
    </footer>
  );
}

// ── Carte noire du prochain live (maquette « Prochain cours en direct ») ───

type SallesCarte = { cle: string; nom: string; salle: string }[];

export const sallesDepuisSites = (sites: SitePublic[]): SallesCarte => sites.map((s) => ({ cle: s.slug, nom: nomCampus(s), salle: s.salle }));
export const sallesDepuisCampus = (campus: CampusCours[]): SallesCarte => campus.map((c) => ({ cle: c.slug, nom: c.nomCourt, salle: c.salle }));

/**
 * Carte « Prochain cours en direct » : compte à rebours à l'heure du serveur,
 * formateur « depuis Lyon », salles connectées. Trois états : en direct, bientôt,
 * ou rien d'annoncé (la carte reste belle et explique ce qui viendra).
 */
export function CarteProchainLive({
  live,
  coursRepli,
  salles,
  chargement,
  titreSeance = false,
  className,
}: {
  live: VitrineLive | null;
  /** Sans live annoncé : le prochain cours qui commence (compte à rebours jusqu'à son début). */
  coursRepli?: VitrineCours | null;
  salles: SallesCarte;
  chargement?: boolean;
  /** Sur la fiche d'un cours : le titre de la séance plutôt que celui du cours (déjà affiché). */
  titreSeance?: boolean;
  className?: string;
}) {
  const maintenant = useMaintenant(1000);
  const cible = live?.debut ?? (coursRepli?.dateDebut && new Date(coursRepli.dateDebut).getTime() > maintenant ? coursRepli.dateDebut : null);
  const titre = (live && titreSeance ? live.titre : live?.coursTitre) ?? coursRepli?.titre ?? null;
  // Le live ne porte que le nom et la ville ; la carte d'un cours porte la fiche complète (avec photo).
  const formateur: { prenom: string; nom: string; localisation: string | null; photoUrl?: string | null } | null = live
    ? live.formateur
    : (coursRepli?.formateur ?? null);
  const ecart = cible ? new Date(cible).getTime() - maintenant : null;
  const enDirect = Boolean(live?.enDirect);
  const imminent = !enDirect && ecart !== null && ecart <= 10 * 60_000;

  return (
    <div className={cn("relative flex flex-col gap-5 overflow-hidden rounded-[28px] bg-encre p-5 text-white sm:gap-[22px] sm:p-7", className)} aria-live="polite">
      <div aria-hidden className="pointer-events-none absolute -right-[90px] -top-[90px] h-[260px] w-[260px] rounded-full border-[40px] border-orange opacity-90" />
      <span className="relative flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-orange-peche">
        <span className={cn("point-direct", !enDirect && !cible && "animate-none bg-orange")} />
        {enDirect ? "En direct maintenant" : imminent ? "La salle ouvre" : titre && live ? "Prochain cours en direct" : titre ? "Prochain cours" : "Bientôt au campus numérique"}
      </span>

      {chargement ? (
        <div className="relative flex flex-col gap-3">
          <Squelette className="h-9 w-3/4 bg-nuit-carte" />
          <Squelette className="h-5 w-1/2 bg-nuit-carte" />
          <Squelette className="mt-2 h-[84px] bg-nuit-carte" />
        </div>
      ) : titre ? (
        <>
          <div className="relative flex flex-col gap-2 pr-16 sm:pr-24">
            <h2 className="text-[28px] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[34px]">{titre}</h2>
            {live && !enDirect ? (
              <p className="text-[15px] text-nuit-doux">
                <span className="block">{dateComplete(live.debut)}</span>
                <span className="block">{heureDouble(live.debut)}</span>
              </p>
            ) : !live && coursRepli?.dateDebut ? (
              <p className="text-[15px] text-nuit-doux">Commence le {dateComplete(coursRepli.dateDebut).replace(/^./, (c) => c.toLowerCase())}</p>
            ) : null}
            {live && !titreSeance && live.titre !== live.coursTitre && (
              <p className="font-mono text-xs text-nuit-gris">
                {live.coursCode} · {live.titre}
              </p>
            )}
          </div>
          {enDirect ? (
            <div className="relative flex flex-col gap-3 rounded-[16px] bg-[#2A1510] p-4">
              <span className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider text-[#FF8A6B]">
                <span className="point-direct" /> En direct depuis {heure(live!.debut)}
              </span>
              <p className="text-[15px] text-nuit-doux">Les cinq salles et les étudiants connectés suivent le cours en ce moment.</p>
              <LienBouton href={`/live/${live!.id}`} taille="lg" className="w-full sm:w-auto">
                Je suis étudiant : rejoindre le live
              </LienBouton>
            </div>
          ) : cible && ecart !== null && ecart > 0 ? (
            <CompteARebours cible={cible} className="relative" />
          ) : live ? (
            <p className="relative rounded-[14px] bg-[#242120] px-4 py-5 text-center text-lg font-bold">Ça commence dans un instant.</p>
          ) : null}
          <div className="relative flex items-center gap-3 rounded-2xl bg-[#242120] p-3.5">
            {formateur ? (
              <Avatar prenom={formateur.prenom} nom={formateur.nom} photo={formateur.photoUrl ?? null} taille={44} />
            ) : (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange text-encre">
                <Radio className="h-5 w-5" />
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] font-bold">
                {formateur ? `${formateur.prenom} ${formateur.nom}` : "Formateur du réseau 2IAE"}
                {formateur && ville(formateur.localisation) ? <span className="font-normal text-nuit-doux"> · depuis {ville(formateur.localisation)}</span> : null}
              </span>
              <span className="text-[13px] text-nuit-gris">Diffusé en direct dans les salles de conférence</span>
            </div>
          </div>
        </>
      ) : (
        <div className="relative flex flex-col gap-2 pr-16 sm:pr-24">
          <h2 className="text-[28px] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[34px]">Les prochains cours en direct arrivent.</h2>
          <p className="text-[15px] leading-relaxed text-nuit-doux">Dès qu'un formateur annonce une séance, son compte à rebours démarre ici.</p>
        </div>
      )}

      {salles.length > 0 && (
        <ul className="relative flex flex-col">
          {salles.map((s) => (
            <li key={s.cle} className="flex items-center justify-between gap-3 border-t border-[#2E2A28] py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
                <span className="truncate">{s.nom}</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-nuit-gris">{s.salle}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Cartes de cours et de formateurs ───────────────────────────────────────

/** « Dès le 29 sept. », « Commencé le 12 sept. », « Date bientôt annoncée ». */
export function quandCours(c: Pick<VitrineCours, "dateDebut" | "dateFin">, maintenant: number): string {
  if (!c.dateDebut) return "Date bientôt annoncée";
  const debut = new Date(c.dateDebut).getTime();
  if (c.dateFin && new Date(c.dateFin).getTime() < maintenant) return "Cours terminé";
  return debut > maintenant ? `Dès le ${dateCourte(c.dateDebut)}` : `Commencé le ${dateCourte(c.dateDebut)}`;
}

export function CarteCoursPublic({ cours: c }: { cours: VitrineCours }) {
  const maintenant = useMaintenant(60_000);
  return (
    <Link
      href={`/cours-ouverts/${c.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-ligne bg-white text-encre no-underline transition-colors hover:border-orange hover:text-encre focus-visible:border-orange"
    >
      <div className="h-2" style={{ backgroundColor: c.couleur }} aria-hidden />
      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs font-semibold text-orange-fonce">{c.code}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-creme px-2.5 py-1 font-mono text-xs text-texte-pale">
            <CalendarDays className="h-3.5 w-3.5" />
            {quandCours(c, maintenant)}
          </span>
        </div>
        <h3 className="text-[22px] font-extrabold leading-tight tracking-[-0.01em]">{c.titre}</h3>
        <p className="line-clamp-3 text-[15px] leading-relaxed text-texte-moyen">{c.accroche}</p>
        {c.nbCampus > 0 && (
          <span className="inline-flex items-center gap-2 self-start font-mono text-xs text-texte-gris">
            <span className="h-1.5 w-1.5 rounded-full bg-orange" />
            {c.nbCampus > 1 ? `En direct dans ${c.nbCampus} campus` : "En direct au campus numérique"}
          </span>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-ligne-douce pt-4">
          {c.formateur ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar prenom={c.formateur.prenom} nom={c.formateur.nom} photo={c.formateur.photoUrl} taille={32} />
              <span className="min-w-0 text-sm">
                <span className="font-bold">
                  {c.formateur.prenom} {c.formateur.nom}
                </span>
                {ville(c.formateur.localisation) && <span className="text-texte-gris"> · {ville(c.formateur.localisation)}</span>}
              </span>
            </span>
          ) : (
            <span className="text-sm text-texte-gris">Formateur du réseau 2IAE</span>
          )}
          <span className="inline-flex items-center gap-1 text-sm font-bold text-orange-fonce group-hover:text-encre">
            Découvrir <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CarteFormateurPublic({ formateur: f }: { formateur: VitrineFormateur }) {
  return (
    <Link
      href={`/formateurs/${f.slug}`}
      className="group flex h-full flex-col gap-4 rounded-3xl border border-ligne bg-white p-5 text-encre no-underline transition-colors hover:border-orange hover:text-encre sm:p-6"
    >
      <div className="flex items-center gap-4">
        <Avatar prenom={f.prenom} nom={f.nom} photo={f.photoUrl} taille={64} className="text-xl" />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-xl font-extrabold leading-tight">
            {f.prenom} {f.nom}
          </h3>
          {f.localisation && (
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-texte-gris">
              <MapPin className="h-3.5 w-3.5" /> depuis {f.localisation}
            </span>
          )}
        </div>
      </div>
      {f.titre && <p className="text-[15px] font-semibold leading-snug text-texte-doux">{f.titre}</p>}
      {f.bio && <p className="line-clamp-3 text-[15px] leading-relaxed text-texte-pale">{f.bio}</p>}
      {f.cours.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {f.cours.map((c) => (
            <span key={c.slug} className="rounded-full bg-orange-clair px-2.5 py-1 font-mono text-xs text-orange-profond">
              {c.code}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

// ── Lives à venir (fiches cours et formateur) ──────────────────────────────

export function ListeLives({ lives, avecCours = false }: { lives: VitrineLive[]; avecCours?: boolean }) {
  const maintenant = useMaintenant(60_000);
  return (
    <ul className="flex flex-col">
      {lives.map((l) => {
        const d = new Date(l.debut);
        const jour = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", timeZone: "Africa/Abidjan" }).format(d);
        const mois = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "Africa/Abidjan" }).format(d).replace(".", "").toUpperCase();
        return (
          <li key={l.id} className="grid grid-cols-[56px_1fr] items-center gap-4 border-b border-ligne py-3.5 last:border-b-0">
            <div className={cn("rounded-xl py-2 text-center", l.enDirect ? "bg-encre text-white" : "bg-creme")}>
              <div className="text-xl font-extrabold leading-none">{jour}</div>
              <div className={cn("mt-1 font-mono text-[10px]", l.enDirect ? "text-orange-peche" : "text-texte-gris")}>{mois}</div>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-base font-bold leading-snug">{avecCours ? l.coursTitre : l.titre}</span>
              <span className="text-sm text-texte-pale">
                {l.enDirect ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-direct">
                    <span className="point-direct" /> En direct maintenant
                  </span>
                ) : (
                  <>
                    {heureDouble(l.debut)} · {relatif(l.debut, maintenant)}
                  </>
                )}
              </span>
              {avecCours && <span className="font-mono text-xs text-texte-gris">{l.coursCode} · {l.titre}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── Accès et partage ───────────────────────────────────────────────────────

/** Les deux portes d'entrée : l'étudiant se connecte, le futur étudiant se préinscrit. */
export function BoutonsAcces({
  hrefEtudiant,
  libelleEtudiant,
  libellePreinscription = "Pas encore étudiant ? Préinscription",
  codeCours,
  className,
}: {
  hrefEtudiant: string;
  libelleEtudiant: string;
  libellePreinscription?: string;
  codeCours?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap", className)}>
      <LienBouton href={hrefEtudiant} taille="lg" className="min-h-[56px] w-full text-[16px] sm:w-auto">
        {libelleEtudiant}
      </LienBouton>
      <a
        href={lienPreinscription(codeCours)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-encre bg-white px-6 text-base font-bold text-encre no-underline transition-colors hover:bg-orange-pale hover:text-encre sm:w-auto"
      >
        {libellePreinscription} <ArrowUpRight className="h-5 w-5" />
      </a>
    </div>
  );
}

export function BoutonPartager({ texte, className }: { texte: string; className?: string }) {
  return (
    <a
      href={lienWhatsapp(texte)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex min-h-[48px] items-center gap-2 rounded-xl px-3 text-[15px] font-semibold text-texte-doux no-underline hover:bg-creme hover:text-encre", className)}
    >
      <Share2 className="h-4 w-4 text-succes" /> Partager sur WhatsApp
    </a>
  );
}

/** Titre de section de la maquette : très gras, serré, avec un texte d'accompagnement à droite. */
export function TitreSectionPublic({ etiquette, titre, texte, id, className }: { etiquette?: string; titre: ReactNode; texte?: ReactNode; id?: string; className?: string }) {
  return (
    <div id={id} className={cn("mb-7 flex scroll-mt-24 flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="flex max-w-3xl flex-col gap-2.5">
        {etiquette && <span className="etiquette">{etiquette}</span>}
        <h2 className="text-[30px] font-black leading-none tracking-serre sm:text-[clamp(30px,3.6vw,48px)]">{titre}</h2>
      </div>
      {texte && <p className="max-w-[420px] text-base leading-normal text-texte-pale">{texte}</p>}
    </div>
  );
}
