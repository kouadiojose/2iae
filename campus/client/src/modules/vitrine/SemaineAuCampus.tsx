// « Cette semaine au campus » (accueil, page d'un campus) : la semaine de
// l'emploi du temps publié, affichée par le composant du module « programme »
// (SemaineProgramme). Sans emploi du temps publié : les lives annoncés des
// sept prochains jours. Sans rien : un état vide qui dit ce qui viendra et
// mène à /programme.
import { Link } from "wouter";
import { CalendarRange } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { Squelette } from "@/components/ui/divers";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { heure } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { SemaineProgramme } from "@/modules/programme/SemaineProgramme";
import type { VitrineLive } from "@shared/api";
import type { ProgrammePublicDto, SemaineProgrammeDto } from "@shared/schema";
import { EtatVidePublic } from "./composants";

const JOUR_MS = 86_400_000;
const fmtJourMois = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
const fmtJourLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const jourMois = (iso: string) => fmtJourMois.format(new Date(`${iso}T12:00:00Z`));

/** La semaine publiée, réduite aux sessions des classes d'un campus si besoin. */
function semaineDuSite(prog: ProgrammePublicDto | undefined, siteId?: number): SemaineProgrammeDto | null {
  const s = prog?.semaine;
  if (!s) return null;
  if (siteId === undefined) return s.occurrences.length ? s : null;
  const sessions = new Set(prog.sessions.filter((x) => x.classes.some((c) => c.siteId === siteId)).map((x) => x.id));
  const occurrences = s.occurrences.filter((o) => sessions.has(o.sessionId));
  return occurrences.length ? { ...s, occurrences } : null;
}

type LigneLive = { cle: string; date: string; debut: string; fin: string; libelle: string; detail: string; enDirect: boolean; seanceId: number };

/** Lives annoncés des sept prochains jours (quand aucun emploi du temps n'est publié). */
function livesDeLaSemaine(lives: VitrineLive[], maintenant: number): LigneLive[] {
  return lives
    .filter((l) => {
      const t = new Date(l.debut).getTime();
      return l.enDirect || (t + l.dureeMinutes * 60_000 > maintenant && t < maintenant + 7 * JOUR_MS);
    })
    .map((l) => ({
      cle: `live-${l.id}`,
      date: l.debut.slice(0, 10),
      debut: l.debut,
      fin: new Date(new Date(l.debut).getTime() + l.dureeMinutes * 60_000).toISOString(),
      libelle: l.coursTitre,
      detail: [l.formateur ? `${l.formateur.prenom} ${l.formateur.nom}` : null, l.titre !== l.coursTitre ? l.titre : null].filter(Boolean).join(" · "),
      enDirect: l.enDirect,
      seanceId: l.id,
    }));
}

function ListeLivesSemaine({ lignes, maintenant }: { lignes: LigneLive[]; maintenant: number }) {
  const aujourdHui = new Date(maintenant).toISOString().slice(0, 10);
  const jours = [...new Set(lignes.map((l) => l.date))];
  return (
    <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {jours.map((date) => (
        <li key={date} className={cn("flex flex-col overflow-hidden rounded-3xl border", date === aujourdHui ? "border-orange" : "border-ligne")}>
          <div className={cn("flex items-center justify-between gap-3 px-5 py-3", date === aujourdHui ? "bg-orange text-encre" : "bg-creme")}>
            <h3 className="text-base font-extrabold capitalize">{fmtJourLong.format(new Date(`${date}T12:00:00Z`))}</h3>
            {date === aujourdHui && <span className="font-mono text-xs uppercase tracking-wider">Aujourd'hui</span>}
          </div>
          <ul>
            {lignes
              .filter((l) => l.date === date)
              .map((l) => (
                <li key={l.cle} className="flex flex-col gap-1 border-t border-ligne-douce px-5 py-4 first:border-t-0">
                  <span className="font-mono text-sm text-texte-doux">
                    {heure(l.debut)} à {heure(l.fin)}
                  </span>
                  <span className="text-lg font-extrabold leading-snug">{l.libelle}</span>
                  {l.detail && <span className="text-[15px] text-texte-pale">{l.detail}</span>}
                  {l.enDirect && (
                    <Link
                      href={`/live/${l.seanceId}`}
                      className="mt-1 inline-flex min-h-[40px] items-center gap-2 self-start rounded-full bg-[#2A1510] px-3 font-mono text-xs font-semibold uppercase tracking-wider text-[#FF8A6B] no-underline hover:bg-encre hover:text-white"
                    >
                      <span className="point-direct" /> En direct · rejoindre
                    </Link>
                  )}
                </li>
              ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/** Bloc complet : titre, semaine, lien vers l'emploi du temps. */
export function SemaineAuCampus({
  programme,
  lives,
  chargement,
  siteId,
  videTexte,
}: {
  programme: ProgrammePublicDto | undefined;
  lives: VitrineLive[];
  chargement?: boolean;
  /** Page d'un campus : seulement les sessions de ses classes. */
  siteId?: number;
  videTexte?: string;
}) {
  const maintenant = useMaintenant(60_000);
  const semaine = semaineDuSite(programme, siteId);
  const livesSemaine = semaine ? [] : livesDeLaSemaine(lives, maintenant);
  const titre = semaine?.nature === "a-venir" ? `La semaine du ${jourMois(semaine.debut)}` : siteId !== undefined ? "Cette semaine dans sa salle" : "Cette semaine au campus";
  const sousTitre = semaine
    ? `Du lundi ${jourMois(semaine.debut)} au dimanche ${jourMois(semaine.fin)} · heure d'Abidjan`
    : livesSemaine.length
      ? "Les cours en direct des sept prochains jours · heure d'Abidjan"
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-2">
          <span className="etiquette">Emploi du temps</span>
          <h2 className="text-[30px] font-black leading-none tracking-serre sm:text-[clamp(30px,3.6vw,48px)]">{titre}</h2>
          {sousTitre && <p className="text-base text-texte-pale">{sousTitre}</p>}
        </div>
        <LienBouton href="/programme" variante="contour" className="min-h-[48px]">
          Tout l'emploi du temps
        </LienBouton>
      </div>
      {chargement ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Squelette className="h-44 rounded-3xl" />
          <Squelette className="hidden h-44 rounded-3xl md:block" />
          <Squelette className="hidden h-44 rounded-3xl md:block" />
        </div>
      ) : semaine && programme ? (
        <SemaineProgramme semaine={semaine} aujourdhui={programme.aujourdhui} liens="connexion" titre={false} vous />
      ) : livesSemaine.length ? (
        <ListeLivesSemaine lignes={livesSemaine} maintenant={maintenant} />
      ) : (
        <EtatVidePublic
          icone={<CalendarRange className="h-6 w-6" />}
          titre="L'emploi du temps de la semaine s'affiche ici dès sa publication."
          texte={
            videTexte ??
            "Le service des études publie chaque session depuis le campus : les jours, les heures, les cours et les intervenants apparaissent aussitôt, pour les cinq campus."
          }
          action={<LienBouton href="/programme">Voir l'emploi du temps</LienBouton>}
        />
      )}
    </div>
  );
}
