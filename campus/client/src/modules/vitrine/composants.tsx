// Briques des pages publiques : en-tête de page avec fil d'Ariane, carte
// noire du prochain cours, cartes de cours, de formateurs et de campus,
// liste des lives, boutons d'accès, états vides.
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, MapPin, MessageCircle, Radio, Share2 } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { Avatar, Squelette } from "@/components/ui/divers";
import { CompteARebours, useMaintenant } from "@/components/ui/compte-a-rebours";
import { dateComplete, heure, heureDouble, dateCourte, relatif } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { VitrineCours, VitrineFormateur, VitrineLive } from "@shared/api";
import type { CampusCours, CampusPublic, OccurrenceDto } from "@shared/schema";
import { formatTaux, lienPreinscription, lienWhatsapp, lienWhatsappVers, paragraphes, typo, ville } from "./outils";

export { EnTetePublic, PiedPublic, MarquePublique } from "./navigation-publique";

// ── En-tête d'une page ─────────────────────────────────────────────────────

export type Miette = { href?: string; libelle: string };

/** Titre de page du site public : fil d'Ariane, étiquette, grand titre, texte d'accompagnement. */
export function EnTetePagePublique({
  fil = [],
  etiquette,
  titre,
  texte,
  actions,
  className,
  titreClasse,
  children,
}: {
  fil?: Miette[];
  etiquette?: string;
  titre: ReactNode;
  /** Taille du titre (les noms longs, comme celui d'Azaguié, dans une demi-colonne). */
  titreClasse?: string;
  texte?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cn("conteneur flex flex-col gap-5 pb-8 pt-6 sm:pb-12 sm:pt-10", className)}>
      {fil.length > 0 && (
        <nav aria-label="Fil d'Ariane">
          <ol className="flex flex-wrap items-center gap-1 font-mono text-xs text-texte-gris">
            {[{ href: "/", libelle: "Accueil" }, ...fil].map((m, i, liste) => {
              const dernier = i === liste.length - 1;
              return (
                <li key={`${m.libelle}-${i}`} className="flex items-center gap-1">
                  {m.href && !dernier ? (
                    <Link href={m.href} className="inline-flex min-h-[32px] items-center text-texte-gris no-underline hover:text-encre">
                      {m.libelle}
                    </Link>
                  ) : (
                    <span aria-current={dernier ? "page" : undefined} className={cn(dernier && "text-texte-doux")}>
                      {m.libelle}
                    </span>
                  )}
                  {!dernier && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-4">
        {etiquette && <span className="etiquette">{etiquette}</span>}
        <h1 className={cn("max-w-4xl break-words text-[38px] font-black leading-[.98] tracking-tres-serre", titreClasse ?? "sm:text-[clamp(44px,5.4vw,72px)]")}>{typeof titre === "string" ? typo(titre) : titre}</h1>
        {texte && <div className="max-w-[680px] text-[17px] leading-[1.55] text-texte-doux sm:text-[19px]">{typeof texte === "string" ? typo(texte) : texte}</div>}
      </div>
      {actions && <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div>}
      {children}
    </section>
  );
}

/** Titre de section de la maquette : très gras, serré, avec un texte et un lien à droite. */
export function TitreSectionPublic({
  etiquette,
  titre,
  texte,
  lien,
  id,
  className,
}: {
  etiquette?: string;
  titre: ReactNode;
  texte?: ReactNode;
  lien?: { href: string; libelle: string };
  id?: string;
  className?: string;
}) {
  return (
    <div id={id} className={cn("mb-7 flex scroll-mt-24 flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="flex max-w-3xl flex-col gap-2.5">
        {etiquette && <span className="etiquette">{etiquette}</span>}
        <h2 className="text-[30px] font-black leading-none tracking-serre sm:text-[clamp(30px,3.6vw,48px)]">{typeof titre === "string" ? typo(titre) : titre}</h2>
        {texte && <p className="max-w-[560px] text-base leading-normal text-texte-pale">{typeof texte === "string" ? typo(texte) : texte}</p>}
      </div>
      {lien && <LienFleche href={lien.href}>{lien.libelle}</LienFleche>}
    </div>
  );
}

/** « Tout l'emploi du temps → » */
export function LienFleche({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-bold text-orange-fonce no-underline hover:text-encre", className)}
    >
      {children} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** Paragraphes d'un texte saisi dans le back-office (séparés par une ligne vide). */
export function Paragraphes({ texte, className }: { texte: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 text-[17px] leading-[1.65] text-texte-doux", className)}>
      {paragraphes(texte).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

/** État vide du site public : dit ce qui apparaîtra ici, et propose où aller. */
export function EtatVidePublic({ icone, titre, texte, action, className }: { icone?: ReactNode; titre: ReactNode; texte?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-4 rounded-[28px] border border-dashed border-ligne bg-white p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8", className)}>
      {icone && <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-orange-clair text-orange-fonce">{icone}</div>}
      <div className="flex flex-1 flex-col gap-1.5">
        <p className="text-xl font-extrabold leading-snug tracking-[-0.01em]">{typeof titre === "string" ? typo(titre) : titre}</p>
        {texte && <p className="max-w-2xl text-[15px] leading-relaxed text-texte-pale">{typeof texte === "string" ? typo(texte) : texte}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Carte noire du prochain cours ──────────────────────────────────────────

/** Ce que la carte sait afficher, quelle que soit la source (live annoncé, emploi du temps, cours). */
export type ProchainCours = {
  titre: string;
  /** Titre de la séance, ou précision (« Séance du lundi »). */
  detail?: string | null;
  debut: string | null;
  enDirect: boolean;
  /** Séance live existante : lien /live/:id pour les étudiants. */
  seanceId: number | null;
  intervenant: { nom: string; localisation?: string | null; photoUrl?: string | null; prenom?: string; nomFamille?: string } | null;
};

/** Live annoncé → carte. */
export function depuisLive(l: VitrineLive, titreSeance = false): ProchainCours {
  return {
    titre: titreSeance ? l.titre : l.coursTitre,
    detail: !titreSeance && l.titre !== l.coursTitre ? `${l.coursCode} · ${l.titre}` : null,
    debut: l.debut,
    enDirect: l.enDirect,
    seanceId: l.id,
    intervenant: l.formateur ? { nom: `${l.formateur.prenom} ${l.formateur.nom}`, prenom: l.formateur.prenom, nomFamille: l.formateur.nom, localisation: l.formateur.localisation } : null,
  };
}

/** Créneau de l'emploi du temps → carte. */
export function depuisOccurrence(o: OccurrenceDto): ProchainCours {
  return {
    titre: o.libelle,
    detail: `${heure(o.debut)} à ${heure(o.fin)}, heure d'Abidjan`,
    debut: o.debut,
    enDirect: o.statut === "en_direct",
    seanceId: o.seanceId,
    intervenant: o.intervenant ? { nom: o.intervenant } : null,
  };
}

/** Cours annoncé qui n'a pas encore commencé → carte (compte à rebours jusqu'à son début). */
export function depuisCours(c: VitrineCours): ProchainCours {
  return {
    titre: c.titre,
    detail: null,
    debut: c.dateDebut,
    enDirect: false,
    seanceId: null,
    intervenant: c.formateur
      ? { nom: `${c.formateur.prenom} ${c.formateur.nom}`, prenom: c.formateur.prenom, nomFamille: c.formateur.nom, localisation: c.formateur.localisation, photoUrl: c.formateur.photoUrl }
      : null,
  };
}

export type SalleCarte = { cle: string; nom: string; salle: string | null };
export const sallesDepuisCampus = (campus: CampusPublic[]): SalleCarte[] => campus.map((c) => ({ cle: c.slug, nom: c.nom, salle: c.salleNommee ? c.salle : null }));
export const sallesDepuisCampusCours = (campus: CampusCours[]): SalleCarte[] =>
  campus.map((c) => ({ cle: c.slug, nom: c.nomCourt, salle: c.salle && c.salle !== "Salle de conférence" ? c.salle : null }));

/**
 * Carte « Prochain cours en direct » : compte à rebours à l'heure du serveur,
 * intervenant, salles des campus. Trois états : en direct, bientôt, ou rien
 * d'annoncé (la carte reste belle et dit ce qui viendra).
 */
export function CarteProchainCours({
  prochain,
  salles,
  chargement,
  etiquetteLibre,
  className,
}: {
  prochain: ProchainCours | null;
  salles: SalleCarte[];
  chargement?: boolean;
  /** Remplace « Prochain cours en direct ». */
  etiquetteLibre?: string;
  className?: string;
}) {
  const maintenant = useMaintenant(1000);
  const cible = prochain?.debut && new Date(prochain.debut).getTime() > maintenant ? prochain.debut : null;
  const ecart = cible ? new Date(cible).getTime() - maintenant : null;
  const enDirect = Boolean(prochain?.enDirect);
  const imminent = !enDirect && ecart !== null && ecart <= 10 * 60_000;
  const p = prochain;

  return (
    <div className={cn("relative flex flex-col gap-5 overflow-hidden rounded-[28px] bg-encre p-5 text-white sm:gap-[22px] sm:p-7", className)} aria-live="polite">
      <div aria-hidden className="pointer-events-none absolute -right-[90px] -top-[90px] h-[260px] w-[260px] rounded-full border-[40px] border-orange opacity-90" />
      <span className="relative flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-orange-peche">
        <span className={cn("point-direct", !enDirect && "animate-none bg-orange")} />
        {enDirect ? "En direct maintenant" : imminent ? "La salle ouvre" : p ? (etiquetteLibre ?? "Prochain cours en direct") : "Bientôt au campus numérique"}
      </span>

      {chargement ? (
        <div className="relative flex flex-col gap-3">
          <Squelette className="h-9 w-3/4 bg-nuit-carte" />
          <Squelette className="h-5 w-1/2 bg-nuit-carte" />
          <Squelette className="mt-2 h-[84px] bg-nuit-carte" />
        </div>
      ) : p ? (
        <>
          <div className="relative flex flex-col gap-2 pr-16 sm:pr-36 lg:pr-24">
            <h2 className="text-[28px] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[34px]">{p.titre}</h2>
            {!enDirect && p.debut && (
              <p className="text-[15px] text-nuit-doux">
                <span className="block">{dateComplete(p.debut)}</span>
                <span className="block">{heureDouble(p.debut)}</span>
              </p>
            )}
            {p.detail && <p className="font-mono text-xs text-nuit-gris">{p.detail}</p>}
          </div>
          {enDirect ? (
            <div className="relative flex flex-col gap-3 rounded-[16px] bg-[#2A1510] p-4">
              <span className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider text-[#FF8A6B]">
                <span className="point-direct" /> En direct{p.debut ? ` depuis ${heure(p.debut)}` : ""}
              </span>
              <p className="text-[15px] text-nuit-doux">Les salles de conférence et les étudiants connectés suivent le cours en ce moment.</p>
              {p.seanceId && (
                <LienBouton href={`/live/${p.seanceId}`} taille="lg" className="w-full sm:w-auto">
                  Je suis étudiant : rejoindre le cours
                </LienBouton>
              )}
            </div>
          ) : cible ? (
            <CompteARebours cible={cible} className="relative" />
          ) : (
            <p className="relative rounded-[14px] bg-[#242120] px-4 py-5 text-center text-lg font-bold">Ça commence dans un instant.</p>
          )}
          <div className="relative flex items-center gap-3 rounded-2xl bg-[#242120] p-3.5">
            {p.intervenant ? (
              <Avatar prenom={p.intervenant.prenom ?? p.intervenant.nom.replace(/^M(me)?\.\s*/, "")} nom={p.intervenant.nomFamille ?? ""} photo={p.intervenant.photoUrl ?? null} taille={44} />
            ) : (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange text-encre">
                <Radio className="h-5 w-5" />
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] font-bold">
                {p.intervenant ? p.intervenant.nom : "Un formateur du réseau 2IAE"}
                {p.intervenant && ville(p.intervenant.localisation) ? <span className="font-normal text-nuit-doux"> · depuis {ville(p.intervenant.localisation)}</span> : null}
              </span>
              <span className="text-[13px] text-nuit-gris">Diffusé en direct dans les salles de conférence</span>
            </div>
          </div>
        </>
      ) : (
        <div className="relative flex flex-col gap-3 pr-16 sm:pr-36 lg:pr-24">
          <h2 className="text-[28px] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[34px]">Les prochains cours en direct arrivent.</h2>
          <p className="text-[15px] leading-relaxed text-nuit-doux">Dès que l'emploi du temps est publié, le compte à rebours du prochain cours démarre ici.</p>
          <Link href="/programme" className="inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-bold text-orange-peche no-underline hover:text-white">
            Voir l'emploi du temps <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {salles.length > 0 && (
        <ul className="relative flex flex-col" aria-label="Salles de conférence connectées">
          {salles.map((s) => (
            <li key={s.cle} className="flex items-center justify-between gap-3 border-t border-[#2E2A28] py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
                <span className="truncate">{s.nom}</span>
              </span>
              {s.salle && <span className="shrink-0 font-mono text-xs text-nuit-gris">{s.salle}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Compatibilité des fiches cours et formateur : un live annoncé, sinon le cours qui va commencer. */
export function CarteProchainLive({
  live,
  coursRepli,
  salles,
  chargement,
  titreSeance = false,
  className,
}: {
  live: VitrineLive | null;
  coursRepli?: VitrineCours | null;
  salles: SalleCarte[];
  chargement?: boolean;
  titreSeance?: boolean;
  className?: string;
}) {
  const maintenant = useMaintenant(60_000);
  const repli = coursRepli?.dateDebut && new Date(coursRepli.dateDebut).getTime() > maintenant ? depuisCours(coursRepli) : null;
  const prochain = live ? depuisLive(live, titreSeance) : repli;
  return (
    <CarteProchainCours
      prochain={prochain}
      salles={salles}
      chargement={chargement}
      etiquetteLibre={live ? undefined : "Le cours commence bientôt"}
      className={className}
    />
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
      {c.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" decoding="async" className="aspect-[16/9] w-full object-cover" />}
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

// ── Campus ─────────────────────────────────────────────────────────────────

/** Photo d'un campus, ou un aplat soigné avec son nom quand il n'y en a pas encore. */
export function PhotoCampus({ campus: c, className, eager = false }: { campus: CampusPublic; className?: string; eager?: boolean }) {
  if (c.photoUrl) {
    return <img src={c.photoUrl} alt={`Façade du campus 2IAE ${c.nomCourt}`} loading={eager ? "eager" : "lazy"} decoding="async" className={cn("bg-creme object-cover", className)} />;
  }
  return (
    <div className={cn("relative grid place-items-center overflow-hidden bg-orange-clair", className)} aria-hidden>
      <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full border-[28px] border-orange/25" />
      <span className="relative px-4 text-center text-2xl font-black tracking-serre text-orange-profond">{c.nomCourt}</span>
    </div>
  );
}

/** Carte d'un campus (accueil, page des campus) : photo, nom, résultat au BTS, lien vers sa page. */
export function CarteCampus({ campus: c, className }: { campus: CampusPublic; className?: string }) {
  return (
    <Link
      href={`/campus/${c.slug}`}
      className={cn("group flex h-full flex-col overflow-hidden rounded-3xl border border-ligne bg-white text-encre no-underline transition-colors hover:border-orange hover:text-encre", className)}
    >
      <PhotoCampus campus={c} className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <h3 className="text-lg font-extrabold leading-tight tracking-[-0.01em] sm:text-xl">{c.nom}</h3>
        <p className="line-clamp-2 text-sm leading-snug text-texte-pale">{c.localite && c.localite !== c.nom && c.localite !== c.nomCourt ? c.localite : c.adresse || c.ville}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          {c.resultat ? (
            <span className="rounded-full bg-orange-clair px-2.5 py-1 font-mono text-xs text-orange-profond">
              {typo(`${formatTaux(c.resultat.taux)} au ${c.resultat.libelle}`)}
            </span>
          ) : (
            <span className="font-mono text-xs text-texte-gris">Salle de conférence connectée</span>
          )}
          <ArrowRight className="h-4 w-4 shrink-0 text-orange-fonce transition-transform group-hover:translate-x-0.5" aria-hidden />
        </div>
      </div>
    </Link>
  );
}

/** Bouton WhatsApp vers la vie scolaire d'un campus (ou le numéro du groupe). */
export function BoutonWhatsappCampus({ campus: c, texte, className }: { campus: CampusPublic; texte?: string; className?: string }) {
  if (!c.whatsapp) return null;
  const message = texte ?? `Bonjour, je vous écris depuis le site du campus numérique 2IAE, au sujet du campus ${c.nomCourt}.`;
  return (
    <a
      href={lienWhatsappVers(c.whatsapp, message)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 text-[15px] font-bold text-encre no-underline transition-colors hover:bg-encre hover:text-white",
        className,
      )}
    >
      <MessageCircle className="h-5 w-5" /> {c.whatsappCampus ? "Vie scolaire sur WhatsApp" : "Écrire sur WhatsApp"}
    </a>
  );
}

// ── Lives à venir (fiches cours et formateur, pages campus) ────────────────

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
              {avecCours && (
                <span className="font-mono text-xs text-texte-gris">
                  {l.coursCode} · {l.titre}
                </span>
              )}
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
      className={cn(
        "inline-flex min-h-[48px] items-center gap-2 rounded-xl px-3 text-[15px] font-semibold text-texte-doux no-underline hover:bg-creme hover:text-encre",
        className,
      )}
    >
      <Share2 className="h-4 w-4 text-succes" /> Partager sur WhatsApp
    </a>
  );
}
