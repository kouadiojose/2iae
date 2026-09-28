// Campus numérique 2IAE sur le site vitrine.
//
// Tout vient de GET /api/campus/vitrine : le serveur du site lit la vitrine
// publique du campus, la garde en cache (5 min) et conserve la dernière
// version connue si le campus ne répond plus. Le navigateur n'appelle donc
// jamais le campus directement.
//
// Contenu du fichier :
//   useVitrineCampus()      données + adresse du campus (repli : l'actuelle)
//   useMaintenant()         horloge calée sur le serveur (téléphones pas à l'heure)
//   BandeauCampus           bandeau site entier « ● EN DIRECT » / « Dans 6 jours »
//   SectionCampusAccueil    section « Au campus numérique » de l'accueil
//   CarteProchainLive       grande carte sombre : prochain live ou direct
//   CarteCoursCampus, CarteFormateurCampus, LigneLive, AvatarFormateur

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, MapPin, X } from "lucide-react";
import {
  CAMPUS_URL_REPLI,
  SITES_CAMPUS_REPLI,
  type ReponseVitrineCampus,
  type VitrineCampusDisponible,
  type VitrineCours,
  type VitrineFormateur,
  type VitrineLive,
} from "@shared/campus";

// ── Styles communs ─────────────────────────────────────────────────────────

/** Étiquette en IBM Plex Mono, comme sur le campus. */
export const ETIQUETTE = "font-['IBM_Plex_Mono',ui-monospace,monospace] text-xs uppercase tracking-[0.14em]";
/** Orange lisible sur fond clair (contraste AA pour les petits textes). */
export const ORANGE_TEXTE = "text-[#A34C17]";

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

// ── Données ────────────────────────────────────────────────────────────────

/** Décalage entre l'horloge du serveur et celle de l'appareil (ms). */
let decalageHorloge = 0;

export function useVitrineCampus() {
  const q = useQuery<ReponseVitrineCampus>({
    queryKey: ["/api/campus/vitrine"],
    refetchInterval: 5 * MINUTE,
    staleTime: MINUTE,
    retry: 1,
  });
  const donnees = q.data;

  // Beaucoup de téléphones ne sont pas à l'heure : on cale les comptes à
  // rebours sur l'heure du serveur transmise avec la vitrine.
  useEffect(() => {
    if (donnees?.maintenant && q.dataUpdatedAt) {
      const serveur = Date.parse(donnees.maintenant);
      if (Number.isFinite(serveur)) decalageHorloge = serveur - q.dataUpdatedAt;
    }
  }, [donnees?.maintenant, q.dataUpdatedAt]);

  const vitrine: VitrineCampusDisponible | null = donnees && !donnees.indisponible ? donnees : null;
  return {
    vitrine,
    /**
     * Adresse du bouton « Campus numérique ». Tant que le nouveau campus n'a
     * jamais répondu, on garde l'adresse actuelle, qui fonctionne.
     */
    campusUrl: vitrine?.campusUrl ?? CAMPUS_URL_REPLI,
    chargement: q.isLoading,
  };
}

/** Heure courante calée sur le serveur, rafraîchie à l'intervalle donné. */
export function useMaintenant(intervalle = 1000): number {
  const [maintenant, setMaintenant] = useState(() => Date.now() + decalageHorloge);
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now() + decalageHorloge), intervalle);
    return () => clearInterval(t);
  }, [intervalle]);
  return maintenant;
}

// ── Dates (heure d'Abidjan) ────────────────────────────────────────────────

const FUSEAU = "Africa/Abidjan";

function formatAbidjan(options: Intl.DateTimeFormatOptions, fuseau = FUSEAU) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: fuseau, ...options });
}

/** « 10 h » ou « 10 h 30 ». */
export function heure(iso: string | number, fuseau = FUSEAU): string {
  const parties = formatAbidjan({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, fuseau).formatToParts(new Date(iso));
  const h = Number(parties.find((p) => p.type === "hour")?.value ?? 0);
  const m = parties.find((p) => p.type === "minute")?.value ?? "00";
  return m === "00" ? `${h} h` : `${h} h ${m}`;
}

/** « mardi 29 septembre ». */
export function jourLong(iso: string | number): string {
  return formatAbidjan({ weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}

/** « Mardi 29 septembre » : majuscule au premier mot seulement. */
export function jourLongMaj(iso: string | number): string {
  const d = jourLong(iso);
  return d.charAt(0).toUpperCase() + d.slice(1);
}

/** « 29 sept. ». */
export function dateCourte(iso: string | number): string {
  return formatAbidjan({ day: "numeric", month: "short" }).format(new Date(iso));
}

/** « 29 septembre 2026 ». */
export function dateComplete(iso: string | number): string {
  return formatAbidjan({ day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/**
 * Nombre de jours calendaires entre deux instants, à Abidjan. Abidjan vit à
 * l'heure GMT toute l'année (pas d'heure d'été) : le jour d'Abidjan est donc
 * le jour UTC.
 */
function joursEntre(de: number, a: number): number {
  return Math.floor(a / JOUR) - Math.floor(de / JOUR);
}

/** « Aujourd'hui à 10 h », « Demain à 10 h », « Dans 6 jours », « Mardi 13 octobre ». */
export function quand(debut: number, maintenant: number): string {
  const j = joursEntre(maintenant, debut);
  if (j <= 0) return `Aujourd'hui à ${heure(debut)}`;
  if (j === 1) return `Demain à ${heure(debut)}`;
  if (j <= 7) return `Dans ${j} jours`;
  return jourLongMaj(debut);
}

/** « dans 3 jours », « dans 5 h », « dans 12 min ». */
export function dansCourt(debut: number, maintenant: number): string {
  const reste = debut - maintenant;
  if (reste <= 0) return "maintenant";
  if (reste < HEURE) return `dans ${Math.max(1, Math.round(reste / MINUTE))} min`;
  if (reste < JOUR) return `dans ${Math.round(reste / HEURE)} h`;
  const j = Math.round(reste / JOUR);
  return j <= 1 ? "demain" : `dans ${j} jours`;
}

// ── Logique de la vitrine ──────────────────────────────────────────────────

/** Un live est « en direct » si le campus l'a dit, et pas au-delà d'une heure après sa fin prévue. */
export function liveEnDirect(l: VitrineLive, maintenant: number): boolean {
  return l.enDirect && maintenant < Date.parse(l.debut) + l.dureeMinutes * MINUTE + HEURE;
}

export function nomFormateur(f: { prenom: string; nom: string } | null | undefined): string {
  return f ? `${f.prenom} ${f.nom}` : "";
}

/** « dans nos 5 campus » / « au campus numérique ». */
export function dansNosCampus(n: number): string {
  return n >= 2 ? `dans nos ${n} campus` : "au campus numérique";
}

export function nombreDeSites(v: VitrineCampusDisponible | null): number {
  return v?.campus.sites.length || SITES_CAMPUS_REPLI.length;
}

export function coursDuLive(v: VitrineCampusDisponible, l: VitrineLive): VitrineCours | undefined {
  return v.cours.find((c) => c.code === l.coursCode);
}

export type ProchainRendezVous = {
  cle: string;
  debut: number;
  titre: string;
  seance: string | null;
  formateur: { prenom: string; nom: string; localisation: string | null } | null;
  nbCampus: number;
  lien: string;
  live: VitrineLive | null;
};

/** Le live en direct maintenant, s'il y en a un. */
export function liveEnCours(v: VitrineCampusDisponible | null, maintenant: number): VitrineLive | null {
  return v?.lives.find((l) => liveEnDirect(l, maintenant)) ?? null;
}

/** Le prochain rendez-vous public : live programmé ou début d'un cours annoncé. */
export function prochainRendezVous(v: VitrineCampusDisponible | null, maintenant: number): ProchainRendezVous | null {
  if (!v) return null;
  const sites = nombreDeSites(v);
  const candidats: ProchainRendezVous[] = [];
  for (const l of v.lives) {
    const debut = Date.parse(l.debut);
    if (debut <= maintenant || l.enDirect) continue;
    const c = coursDuLive(v, l);
    candidats.push({
      cle: `live-${l.id}`,
      debut,
      titre: l.coursTitre,
      seance: l.titre,
      formateur: l.formateur,
      nbCampus: c?.nbCampus || sites,
      lien: c ? `/campus-numerique/cours/${c.slug}` : "/campus-numerique",
      live: l,
    });
  }
  for (const c of v.cours) {
    const debut = c.dateDebut ? Date.parse(c.dateDebut) : NaN;
    if (!(debut > maintenant)) continue;
    // Le premier live du cours décrit déjà ce rendez-vous.
    if (candidats.some((x) => x.live?.coursCode === c.code && Math.abs(x.debut - debut) < JOUR)) continue;
    candidats.push({
      cle: `cours-${c.slug}`,
      debut,
      titre: c.titre,
      seance: null,
      formateur: c.formateur,
      nbCampus: c.nbCampus || sites,
      lien: `/campus-numerique/cours/${c.slug}`,
      live: null,
    });
  }
  candidats.sort((a, b) => a.debut - b.debut);
  return candidats[0] ?? null;
}

/** Prochain live d'un cours (ou le direct), pour les fiches. */
export function prochainLiveDuCours(v: VitrineCampusDisponible, code: string, maintenant: number): VitrineLive | null {
  return (
    v.lives.find((l) => l.coursCode === code && liveEnDirect(l, maintenant)) ??
    v.lives.find((l) => l.coursCode === code && Date.parse(l.debut) > maintenant) ??
    null
  );
}

// ── Petits composants ──────────────────────────────────────────────────────

/** Point rouge pulsant du direct. */
export function PointDirect({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex h-2.5 w-2.5 shrink-0 ${className}`} aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF5A36] opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FF5A36]" />
    </span>
  );
}

/** Valeur CSS « url(...) » sûre (adresse déjà vérifiée http(s) par le serveur). */
function imageDeFond(url: string): string {
  return `url(${JSON.stringify(url)})`;
}

function initiales(prenom: string, nom: string): string {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

/** Photo du formateur, ou ses initiales sur fond orange. */
export function AvatarFormateur({
  formateur: f,
  taille = "h-12 w-12 text-base",
  carre = false,
}: {
  formateur: { prenom: string; nom: string; photoUrl?: string | null };
  taille?: string;
  carre?: boolean;
}) {
  const forme = carre ? "rounded-2xl" : "rounded-full";
  if (f.photoUrl) {
    // Image de fond plutôt que <img> : la feuille de style du site impose
    // « img { height: auto !important } » sur téléphone, ce qui déformerait
    // le cadrage carré ou rond.
    return (
      <span
        role="img"
        aria-label={`${f.prenom} ${f.nom}`}
        className={`${taille} ${forme} block shrink-0 bg-[#f0ede8] bg-cover bg-center`}
        style={{ backgroundImage: imageDeFond(f.photoUrl) }}
      />
    );
  }
  return (
    <span
      className={`${taille} ${forme} shrink-0 grid place-items-center bg-[#E8720C] font-extrabold text-[#1a1815]`}
      aria-hidden="true"
    >
      {initiales(f.prenom, f.nom)}
    </span>
  );
}

/** Lien externe vers le campus (nouvel onglet). */
export function LienCampus({
  href,
  children,
  className,
  testId,
}: {
  href: string;
  children: React.ReactNode;
  className: string;
  testId?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} data-testid={testId}>
      {children}
    </a>
  );
}

export const BOUTON_PRINCIPAL =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#E8720C] px-7 py-3 text-lg font-bold text-white shadow-lg transition-colors hover:bg-[#c96208] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1815] focus-visible:ring-offset-2";
export const BOUTON_SECONDAIRE =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-[#1a1815] bg-white px-7 py-3 text-lg font-semibold text-[#1a1815] transition-colors hover:bg-[#fff3ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8720C] focus-visible:ring-offset-2";

// ── Compte à rebours ───────────────────────────────────────────────────────

/** Quatre tuiles jours · heures · min · s, calées sur l'heure du serveur. */
export function CompteARebours({ cible, sombre = true }: { cible: number; sombre?: boolean }) {
  const maintenant = useMaintenant(1000);
  const reste = Math.max(0, cible - maintenant);
  const j = Math.floor(reste / JOUR);
  const h = Math.floor((reste % JOUR) / HEURE);
  const m = Math.floor((reste % HEURE) / MINUTE);
  const s = Math.floor((reste % MINUTE) / 1000);
  const tuiles: [number, string][] = [
    [j, j > 1 ? "jours" : "jour"],
    [h, "heures"],
    [m, "min"],
    [s, "s"],
  ];
  const resume = `Commence dans ${j} jour${j > 1 ? "s" : ""}, ${h} heure${h > 1 ? "s" : ""} et ${m} minute${m > 1 ? "s" : ""}`;
  return (
    <div className="grid grid-cols-4 gap-2" role="timer" aria-label={resume} data-testid="compte-a-rebours">
      {tuiles.map(([valeur, libelle]) => (
        <div
          key={libelle}
          className={`rounded-2xl px-1 py-3 text-center ${sombre ? "bg-[#2a2522]" : "bg-white border border-[#EADFD5]"}`}
          aria-hidden="true"
        >
          <div
            className={`text-3xl sm:text-4xl font-extrabold tabular-nums leading-none ${
              sombre ? "text-white" : "text-[#E8720C]"
            }`}
          >
            {String(valeur).padStart(2, "0")}
          </div>
          <div className={`${ETIQUETTE} mt-2 text-[10px] ${sombre ? "text-[#b9aea5]" : "text-[#6b625b]"}`}>{libelle}</div>
        </div>
      ))}
    </div>
  );
}

// ── Bandeau site entier ────────────────────────────────────────────────────

const CLE_BANDEAU = "campus-bandeau-ferme";

function lireFermeture(): string | null {
  try {
    return window.localStorage.getItem(CLE_BANDEAU);
  } catch {
    return null;
  }
}

/**
 * Bandeau au-dessus de l'en-tête, dans l'esprit de BandeauRTI :
 *   « ● EN DIRECT sur le campus numérique · <cours> depuis <ville> · 5 campus connectés »
 *   « Dans 6 jours : <cours> par <formateur>, en direct dans nos 5 campus »
 * Rien s'il n'y a ni direct ni rendez-vous dans les 7 jours. Le visiteur peut
 * le fermer : on s'en souvient pour ce rendez-vous-là seulement.
 */
export function BandeauCampus() {
  const { vitrine } = useVitrineCampus();
  const maintenant = useMaintenant(30_000);
  const [ferme, setFerme] = useState<string | null>(() => lireFermeture());
  if (!vitrine) return null;

  const direct = liveEnCours(vitrine, maintenant);
  const prochain = direct ? null : prochainRendezVous(vitrine, maintenant);
  if (!direct && (!prochain || prochain.debut - maintenant > 7 * JOUR)) return null;

  const cle = direct ? `live-${direct.id}` : prochain!.cle;
  if (ferme === cle) return null;

  const fermer = () => {
    setFerme(cle);
    try {
      window.localStorage.setItem(CLE_BANDEAU, cle);
    } catch {
      /* navigation privée : le bandeau reviendra à la prochaine page */
    }
  };

  const sites = nombreDeSites(vitrine);
  let lien: string;
  let contenu: React.ReactNode;
  if (direct) {
    const c = coursDuLive(vitrine, direct);
    lien = c ? `/campus-numerique/cours/${c.slug}` : "/campus-numerique";
    const ville = direct.formateur?.localisation;
    contenu = (
      <>
        <span className={`${ETIQUETTE} inline-flex items-center gap-2 text-[#FFD2B3]`}>
          <PointDirect />
          En direct
        </span>{" "}
        <span className="hidden sm:inline text-white/70">sur le campus numérique · </span>
        <span className="font-semibold">{direct.coursTitre}</span>
        {ville ? <span className="hidden sm:inline text-white/80"> depuis {ville}</span> : null}
        <span className="hidden md:inline text-white/70"> · {sites} campus connectés</span>
      </>
    );
  } else {
    const p = prochain!;
    lien = p.lien;
    contenu = (
      <>
        <span className={`${ETIQUETTE} rounded-full bg-[#E8720C] px-2 py-0.5 text-[10px] font-semibold text-[#1a1815]`}>
          Bientôt
        </span>{" "}
        <span className="font-semibold">{quand(p.debut, maintenant)} :</span> {p.titre}
        {p.formateur ? <span className="hidden sm:inline text-white/80"> par {nomFormateur(p.formateur)}</span> : null}
        <span className="hidden md:inline text-white/80">, en direct {dansNosCampus(p.nbCampus)}</span>
      </>
    );
  }

  return (
    <div className="bg-[#1a1815] text-white" data-testid="bandeau-campus" aria-live="polite">
      <div className="container mx-auto flex items-stretch px-2 sm:px-4">
        <Link
          href={lien}
          className="flex min-h-[44px] flex-1 items-center justify-center py-2 pl-11 text-center text-sm sm:text-[15px] leading-snug hover:text-[#FFD2B3]"
          data-testid="link-bandeau-campus"
        >
          {/* Un seul bloc de texte : la flèche reste collée au dernier mot. */}
          <span className="line-clamp-3 sm:line-clamp-2">
            {contenu}
            <ArrowRight className="ml-1.5 inline h-4 w-4 align-[-3px]" aria-hidden="true" />
          </span>
        </Link>
        <button
          type="button"
          onClick={fermer}
          className="grid h-11 w-11 shrink-0 place-items-center self-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Masquer ce bandeau"
          data-testid="button-fermer-bandeau-campus"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Grande carte : prochain live ou direct ─────────────────────────────────

/**
 * La carte sombre de la maquette : « Prochain cours en direct », compte à
 * rebours, formateur et les salles des cinq campus. En direct, elle passe
 * en « ● EN DIRECT ». Sans rendez-vous, elle présente simplement le réseau.
 */
export function CarteProchainLive({
  vitrine,
  campusUrl,
  coursCode,
}: {
  vitrine: VitrineCampusDisponible | null;
  campusUrl: string;
  /** Restreint la carte à un cours (fiche cours). */
  coursCode?: string;
}) {
  const maintenant = useMaintenant(30_000);
  const sites = vitrine?.campus.sites.length ? vitrine.campus.sites : SITES_CAMPUS_REPLI;

  let direct: VitrineLive | null = null;
  let prochain: ProchainRendezVous | null = null;
  if (vitrine) {
    if (coursCode) {
      const l = prochainLiveDuCours(vitrine, coursCode, maintenant);
      if (l && liveEnDirect(l, maintenant)) direct = l;
      else if (l) {
        prochain = {
          cle: `live-${l.id}`,
          debut: Date.parse(l.debut),
          titre: l.coursTitre,
          seance: l.titre,
          formateur: l.formateur,
          nbCampus: coursDuLive(vitrine, l)?.nbCampus || sites.length,
          lien: "",
          live: l,
        };
      } else {
        const c = vitrine.cours.find((x) => x.code === coursCode);
        const debut = c?.dateDebut ? Date.parse(c.dateDebut) : NaN;
        if (c && debut > maintenant) {
          prochain = { cle: c.slug, debut, titre: c.titre, seance: null, formateur: c.formateur, nbCampus: c.nbCampus, lien: "", live: null };
        }
      }
    } else {
      direct = liveEnCours(vitrine, maintenant);
      prochain = direct ? null : prochainRendezVous(vitrine, maintenant);
    }
  }

  return (
    <div
      className="relative overflow-hidden rounded-[28px] bg-[#1a1815] p-6 sm:p-7 text-white sm:shadow-2xl"
      data-testid="carte-prochain-live"
    >
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full border-[28px] border-[#E8720C] opacity-90 sm:-right-24 sm:-top-24 sm:h-64 sm:w-64 sm:border-[40px]"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-5">
        {direct ? (
          <>
            <span className={`${ETIQUETTE} inline-flex items-center gap-2 text-[#FFD2B3]`}>
              <PointDirect /> En direct maintenant
            </span>
            <div className="max-w-[22rem]">
              <h3 className="text-3xl font-extrabold leading-tight tracking-tight">{coursCode ? direct.titre : direct.coursTitre}</h3>
              {!coursCode && <p className="mt-2 text-[#d8cfc7]">{direct.titre}</p>}
            </div>
            {direct.formateur && <LigneFormateurSombre formateur={direct.formateur} />}
            <p className="text-[15px] text-[#d8cfc7]">
              Diffusé en ce moment dans les salles de conférence de nos {sites.length} campus et sur le téléphone des étudiants.
            </p>
            <LienCampus href={direct.url} className={`${BOUTON_PRINCIPAL} w-full`} testId="link-rejoindre-live">
              Rejoindre le live
            </LienCampus>
            <p className="-mt-2 text-center text-sm text-[#b9aea5]">Réservé aux étudiants 2IAE, avec leur code secret.</p>
          </>
        ) : prochain ? (
          <>
            <span className={`${ETIQUETTE} inline-flex items-center gap-2 text-[#FFD2B3]`}>
              <span className="h-2 w-2 rounded-full bg-[#E8720C]" aria-hidden="true" />
              {coursCode ? "Prochaine séance en direct" : "Prochain cours en direct"}
            </span>
            <div className="max-w-[22rem]">
              {/* Sur la fiche d'un cours, le titre du cours est déjà en tête de page : on montre la séance. */}
              <h3 className="text-3xl font-extrabold leading-tight tracking-tight">
                {coursCode ? prochain.seance ?? "Première séance" : prochain.titre}
              </h3>
              {prochain.seance && !coursCode && <p className="mt-1 text-[#d8cfc7]">{prochain.seance}</p>}
              <p className="mt-2 text-[15px] text-[#d8cfc7]">
                {jourLongMaj(prochain.debut)} · {heure(prochain.debut)} à Abidjan ·{" "}
                {heure(prochain.debut, "Europe/Paris")} à Paris
              </p>
            </div>
            <CompteARebours cible={prochain.debut} />
            {prochain.formateur && <LigneFormateurSombre formateur={prochain.formateur} />}
          </>
        ) : (
          <>
            <span className={`${ETIQUETTE} text-[#FFD2B3]`}>Le campus numérique</span>
            <div className="max-w-[22rem]">
              <h3 className="text-3xl font-extrabold leading-tight tracking-tight">
                Le même cours, au même moment, dans nos {sites.length} campus.
              </h3>
              <p className="mt-2 text-[15px] text-[#d8cfc7]">
                Les prochains cours en direct s'afficheront ici dès leur annonce.
              </p>
            </div>
            <LienCampus href={campusUrl} className={`${BOUTON_PRINCIPAL} w-full`} testId="link-carte-acceder-campus">
              Accéder au campus
            </LienCampus>
          </>
        )}

        <ul className="flex flex-col" aria-label="Salles de conférence connectées">
          {sites.map((s) => (
            <li key={s.nom} className="flex items-center justify-between gap-3 border-t border-[#34302d] py-2.5 text-[15px]">
              <span className="flex items-center gap-2.5">
                <span className={`h-1.5 w-1.5 rounded-full ${direct ? "bg-[#FF5A36]" : "bg-[#E8720C]"}`} aria-hidden="true" />
                {s.nom}
              </span>
              <span className="font-['IBM_Plex_Mono',ui-monospace,monospace] text-xs text-[#a89e95] text-right">{s.salle}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LigneFormateurSombre({ formateur: f }: { formateur: { prenom: string; nom: string; localisation: string | null } }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#2a2522] p-3.5">
      <AvatarFormateur formateur={f} taille="h-11 w-11 text-sm" />
      <div className="min-w-0">
        <p className="font-bold">{nomFormateur(f)}</p>
        <p className="text-sm text-[#b9aea5]">{f.localisation ? `Formateur, depuis ${f.localisation}` : "Formateur du campus numérique"}</p>
      </div>
    </div>
  );
}

// ── Cartes réutilisables ───────────────────────────────────────────────────

/** Carte d'un cours annoncé → fiche du cours sur le site. */
export function CarteCoursCampus({ cours: c, vitrine }: { cours: VitrineCours; vitrine: VitrineCampusDisponible }) {
  const maintenant = useMaintenant(60_000);
  const live = prochainLiveDuCours(vitrine, c.code, maintenant);
  const enDirect = live ? liveEnDirect(live, maintenant) : false;
  const debutCours = c.dateDebut ? Date.parse(c.dateDebut) : NaN;
  const prochain = live ? Date.parse(live.debut) : debutCours > maintenant ? debutCours : NaN;

  let pastille: string;
  if (enDirect) pastille = "En direct";
  else if (debutCours > maintenant) pastille = `Dès le ${dateCourte(debutCours)}`;
  else if (c.dateDebut) pastille = "Cours commencé";
  else pastille = "Bientôt";

  return (
    <Link
      href={`/campus-numerique/cours/${c.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[#EADFD5] bg-white transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8720C]"
      data-testid={`carte-cours-${c.slug}`}
    >
      <div
        className="relative h-28 shrink-0 bg-cover bg-center"
        style={{ backgroundColor: c.couleur, backgroundImage: c.imageUrl ? imageDeFond(c.imageUrl) : undefined }}
      >
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
          <span className={`${ETIQUETTE} rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#1a1815]`}>{c.code}</span>
          <span
            className={`${ETIQUETTE} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              enDirect ? "bg-[#1a1815] text-white" : "bg-white/95 text-[#1a1815]"
            }`}
          >
            {enDirect && <PointDirect className="!h-2 !w-2" />}
            {pastille}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h3 className="font-serif text-2xl font-semibold leading-tight text-[#1a1815] group-hover:text-[#A34C17]">{c.titre}</h3>
          {c.accroche && <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-[#5e554f]">{c.accroche}</p>}
        </div>
        {c.formateur && (
          <div className="flex items-center gap-3">
            <AvatarFormateur formateur={c.formateur} taille="h-10 w-10 text-sm" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#1a1815]">{nomFormateur(c.formateur)}</p>
              {c.formateur.localisation && (
                <p className="truncate text-sm text-[#6b625b]">depuis {c.formateur.localisation}</p>
              )}
            </div>
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#EADFD5] pt-4 text-sm">
          <span className="text-[#5e554f]">En direct {dansNosCampus(c.nbCampus)}</span>
          {Number.isFinite(prochain) && !enDirect && (
            <span className={`${ETIQUETTE} text-[11px] font-semibold ${ORANGE_TEXTE}`}>{dansCourt(prochain, maintenant)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Le formateur est-il annoncé depuis moins de 15 jours ? */
export function estNouveau(f: VitrineFormateur, maintenant: number): boolean {
  return !!f.annonceLe && maintenant - Date.parse(f.annonceLe) < 15 * JOUR;
}

/** Carte d'un formateur annoncé → sa fiche sur le site. */
export function CarteFormateurCampus({ formateur: f }: { formateur: VitrineFormateur }) {
  const maintenant = useMaintenant(60_000);
  return (
    <Link
      href={`/campus-numerique/formateurs/${f.slug}`}
      className="group flex h-full items-start gap-4 rounded-3xl border border-[#EADFD5] bg-white p-5 transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8720C]"
      data-testid={`carte-formateur-${f.slug}`}
    >
      <AvatarFormateur formateur={f} taille="h-20 w-20 text-2xl" carre />
      <div className="min-w-0 flex-1">
        {estNouveau(f, maintenant) && (
          <span className={`${ETIQUETTE} mb-1 inline-block rounded-full bg-[#fff1e6] px-2 py-0.5 text-[10px] font-semibold ${ORANGE_TEXTE}`}>
            Nouveau
          </span>
        )}
        <h3 className="text-lg font-bold leading-snug text-[#1a1815] group-hover:text-[#A34C17]">{nomFormateur(f)}</h3>
        {f.titre && <p className="mt-0.5 line-clamp-2 text-[15px] text-[#5e554f]">{f.titre}</p>}
        {f.localisation && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-[#6b625b]">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            depuis {f.localisation}
          </p>
        )}
      </div>
    </Link>
  );
}

/** Une ligne de la liste des lives : date, cours, séance, heure, formateur. */
export function LigneLive({ live: l, vitrine }: { live: VitrineLive; vitrine: VitrineCampusDisponible }) {
  const maintenant = useMaintenant(30_000);
  const direct = liveEnDirect(l, maintenant);
  const c = coursDuLive(vitrine, l);
  const debut = Date.parse(l.debut);
  const contenu = (
    <>
      <div
        className={`flex w-16 shrink-0 flex-col items-center justify-center rounded-2xl py-2 ${
          direct ? "bg-[#1a1815] text-white" : "bg-[#fff1e6] text-[#1a1815]"
        }`}
      >
        {direct ? (
          <>
            <PointDirect />
            <span className={`${ETIQUETTE} mt-1.5 text-[10px]`}>Direct</span>
          </>
        ) : (
          <>
            <span className="text-2xl font-extrabold leading-none">{formatAbidjan({ day: "numeric" }).format(debut)}</span>
            <span className={`${ETIQUETTE} mt-1 text-[10px]`}>{formatAbidjan({ month: "short" }).format(debut).replace(".", "")}</span>
          </>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-snug text-[#1a1815]">{l.coursTitre}</p>
        <p className="text-[15px] text-[#5e554f]">{l.titre}</p>
        <p className="mt-1 text-sm text-[#6b625b]">
          {direct ? (
            <span className="font-semibold text-[#c2410c]">En direct maintenant</span>
          ) : (
            <>
              {jourLongMaj(debut)} · {heure(debut)} à Abidjan
            </>
          )}
          {l.formateur && (
            <>
              {" "}
              · {nomFormateur(l.formateur)}
              {l.formateur.localisation ? `, depuis ${l.formateur.localisation}` : ""}
            </>
          )}
        </p>
      </div>
    </>
  );
  const classes = "flex items-center gap-4 rounded-2xl border border-[#EADFD5] bg-white p-3 pr-4";
  return c ? (
    <Link href={`/campus-numerique/cours/${c.slug}`} className={`${classes} hover:shadow-lg transition-shadow`} data-testid={`ligne-live-${l.id}`}>
      {contenu}
    </Link>
  ) : (
    <div className={classes} data-testid={`ligne-live-${l.id}`}>
      {contenu}
    </div>
  );
}

// ── Section de la page d'accueil ───────────────────────────────────────────

/**
 * « Au campus numérique » sur l'accueil : prochain cours avec compte à
 * rebours, cours annoncés, nouveaux formateurs, lien vers la page. Sans
 * vitrine (campus pas encore en service), la section présente le campus au
 * lieu de disparaître : jamais de section vide.
 */
export function SectionCampusAccueil() {
  const { vitrine, campusUrl } = useVitrineCampus();
  const sites = nombreDeSites(vitrine);
  const cours = vitrine?.cours.slice(0, 3) ?? [];
  const formateurs = vitrine?.formateurs.slice(0, 4) ?? [];
  const chiffres = vitrine?.chiffres;
  const tuilesChiffres: [number, string][] = chiffres
    ? ([
        [chiffres.heuresDeDirect, "heures de cours en direct"],
        [sites, "campus connectés"],
        [chiffres.cours, "cours ouverts"],
      ] as [number, string][]).filter(([n]) => n > 0)
    : [];

  return (
    <section className="bg-background mobile-no-overflow" data-testid="section-campus-accueil">
      <div className="container mx-auto mobile-padding py-16 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className={`${ETIQUETTE} ${ORANGE_TEXTE} mb-4`}>Au campus numérique</p>
            <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.02] text-[#1a1815]">
              Un cours. {sites >= 2 ? `${sites === 5 ? "Cinq" : sites} campus.` : "Tous nos campus."}
              <br />
              <span className="text-[#E8720C]">En direct.</span>
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#3d382f]">
              Un formateur, à Abidjan, à Paris ou à Montréal, enseigne en même temps aux salles de conférence de nos
              campus et aux étudiants connectés depuis leur téléphone. Les mêmes cours, les mêmes échanges, où que l'on
              soit.
            </p>
            {tuilesChiffres.length > 0 && (
              <dl className="mt-7 grid max-w-lg grid-cols-3 gap-4">
                {tuilesChiffres.map(([n, libelle]) => (
                  <div key={libelle}>
                    <dt className="sr-only">{libelle}</dt>
                    <dd className="font-['IBM_Plex_Mono',ui-monospace,monospace] text-3xl font-semibold text-[#1a1815]">
                      {n.toLocaleString("fr-FR")}
                    </dd>
                    <dd className="text-sm leading-snug text-[#6b625b]" aria-hidden="true">
                      {libelle}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/campus-numerique" className={BOUTON_PRINCIPAL} data-testid="link-decouvrir-campus">
                Découvrir le campus numérique
              </Link>
            </div>
          </div>
          <CarteProchainLive vitrine={vitrine} campusUrl={campusUrl} />
        </div>

        {vitrine && cours.length > 0 && (
          <div className="mt-14">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h3 className="font-serif text-3xl text-[#1a1815]">Les cours annoncés</h3>
              <Link href="/campus-numerique" className={`hidden sm:inline-flex items-center gap-1 font-semibold ${ORANGE_TEXTE} hover:underline`}>
                Tous les cours <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {cours.map((c) => (
                <CarteCoursCampus key={c.slug} cours={c} vitrine={vitrine} />
              ))}
            </div>
          </div>
        )}

        {vitrine && formateurs.length > 0 && (
          <div className="mt-14">
            <h3 className="mb-6 font-serif text-3xl text-[#1a1815]">Nos formateurs, ici et à l'international</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {formateurs.map((f) => (
                <CarteFormateurCampus key={f.slug} formateur={f} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
