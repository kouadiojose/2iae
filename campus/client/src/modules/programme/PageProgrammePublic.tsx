// /programme et /programme/:id : l'emploi du temps officiel, public.
// La session en cours (ou la prochaine) : « Cette semaine », la grille du
// service des études, les prochaines séances, « Imprimer » ; puis les autres
// sessions publiées. Consultable connecté ou non.
import { useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, ChevronRight, Printer, Radio, SearchX } from "lucide-react";
import type { ProgrammePublicDto, SessionDetailDto, SessionDto, OccurrenceDto } from "@shared/schema";
import { LienBouton } from "@/components/ui/bouton";
import { Badge, BadgeDirect, EtatVide, Squelette } from "@/components/ui/divers";
import { useMoi, accueilDuRole } from "@/lib/auth";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MiseEnPagePublique } from "@/modules/vitrine/MiseEnPagePublique";
import { GrilleProgramme } from "./GrilleProgramme";
import { SemaineProgramme } from "./SemaineProgramme";
import { hh, heureAbidjan, libelleJour, periode, semaineDepuis, sessionParDefaut } from "./outils";

export default function PageProgrammePublic({ id }: { id?: string }) {
  const { moi } = useMoi();
  const programmeQ = useQuery<ProgrammePublicDto>({ queryKey: ["/api/public/programme"], staleTime: 60_000 });
  const detailQ = useQuery<SessionDetailDto>({ queryKey: [`/api/public/programme/${id}`], enabled: Boolean(id), staleTime: 60_000 });
  const programme = programmeQ.data;
  const aujourdhui = detailQ.data?.aujourdhui ?? programme?.aujourdhui ?? new Date().toISOString().slice(0, 10);
  const session: SessionDto | undefined = id ? detailQ.data?.session : programme ? sessionParDefaut(programme.sessions, programme.aujourdhui) : undefined;
  const chargement = id ? detailQ.isLoading : programmeQ.isLoading;
  const introuvable = id && detailQ.error instanceof ErreurApi && detailQ.error.statut === 404;

  const semaine = useMemo(() => {
    if (!session) return null;
    if (detailQ.data) return semaineDepuis(detailQ.data.occurrences, aujourdhui);
    if (programme?.semaine && programme.semaine.occurrences.some((o) => o.sessionId === session.id)) {
      return { ...programme.semaine, occurrences: programme.semaine.occurrences.filter((o) => o.sessionId === session.id) };
    }
    return null;
  }, [session, detailQ.data, programme, aujourdhui]);

  const prochaines: OccurrenceDto[] = useMemo(() => {
    if (!session) return [];
    const source = detailQ.data?.occurrences ?? programme?.prochaines ?? [];
    return source.filter((o) => o.sessionId === session.id && o.date >= aujourdhui && o.statut !== "terminee").slice(0, 8);
  }, [session, detailQ.data, programme, aujourdhui]);

  const autres = (programme?.sessions ?? []).filter((s) => s.id !== session?.id);

  useEffect(() => {
    document.title = session ? `Emploi du temps · ${session.titre} ${session.anneeAcademique} · Campus numérique 2IAE` : "Emploi du temps · Campus numérique 2IAE";
  }, [session]);

  return (
    <MiseEnPagePublique>
      <div className="conteneur flex flex-col gap-10 pb-16 pt-6 sm:pt-8">
        <nav aria-label="Fil d'Ariane">
          <ol className="flex flex-wrap items-center gap-1 font-mono text-xs text-texte-gris">
            <li className="flex items-center gap-1">
              <Link href="/" className="inline-flex min-h-[32px] items-center text-texte-gris no-underline hover:text-encre">
                Accueil
              </Link>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </li>
            <li className="flex items-center gap-1">
              <Link href="/programme" className="inline-flex min-h-[32px] items-center text-texte-gris no-underline hover:text-encre">
                Programme
              </Link>
              {id && session && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            </li>
            {id && session && (
              <li aria-current="page" className="text-texte-doux">
                {session.titre}
              </li>
            )}
          </ol>
        </nav>

        {chargement ? (
          <div className="flex flex-col gap-4">
            <Squelette className="h-4 w-48" />
            <Squelette className="h-14 w-2/3" />
            <Squelette className="h-6 w-1/2" />
            <Squelette className="mt-6 h-[360px] w-full" />
          </div>
        ) : !session ? (
          <EtatVide
            icone={id ? <SearchX className="h-6 w-6" /> : <CalendarRange className="h-6 w-6" />}
            titre={introuvable ? "Cet emploi du temps n'est pas (ou plus) publié." : "L'emploi du temps de la prochaine session sera publié ici."}
            texte={
              introuvable
                ? "Il a peut-être été remplacé par une nouvelle session. L'emploi du temps en vigueur est sur la page Programme."
                : "Le service des études le publie avant chaque session. Les cours ont lieu en direct dans les salles de conférence des cinq campus et sur téléphone."
            }
            action={introuvable ? <LienBouton href="/programme">Voir le programme en vigueur</LienBouton> : undefined}
            className="my-10"
          />
        ) : (
          <>
            <header className="flex flex-col gap-5">
              <span className="etiquette">Emploi du temps officiel · Année académique {session.anneeAcademique}</span>
              <h1 className="text-[40px] font-black leading-[1.02] tracking-tres-serre sm:text-[56px]">{session.titre}</h1>
              <p className="max-w-2xl text-lg text-texte-doux">
                {session.public ? `${session.public}. ` : ""}
                {periode(session.debut, session.fin)}. Les cours ont lieu en direct : dans la salle de conférence de chaque campus, et sur téléphone ou ordinateur.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <LienBouton href={`/programme/${session.id}/imprimer`} taille="lg" icone={<Printer className="h-5 w-5" />}>
                  Imprimer l'emploi du temps
                </LienBouton>
                {moi ? (
                  <LienBouton href={moi.role === "etudiant" || moi.role === "formateur" ? "/emploi-du-temps" : accueilDuRole(moi.role)} taille="lg" variante="contour">
                    {moi.role === "etudiant" ? "Mon emploi du temps" : moi.role === "formateur" ? "Mon emploi du temps" : "Mon campus"}
                  </LienBouton>
                ) : (
                  <LienBouton href="/connexion?retour=%2Femploi-du-temps" taille="lg" variante="contour">
                    Se connecter pour suivre les cours
                  </LienBouton>
                )}
                {session.pause && (
                  <Badge ton="gris">
                    Pause {hh(session.pause.debut)}–{hh(session.pause.fin)}
                  </Badge>
                )}
                {session.debut <= aujourdhui && session.fin >= aujourdhui && <Badge ton="succes">Session en cours</Badge>}
              </div>
            </header>

            {semaine && <SemaineProgramme semaine={semaine} aujourdhui={aujourdhui} liens={moi ? "live" : "connexion"} vous={Boolean(moi && moi.role !== "etudiant")} />}

            <section aria-label="Grille de la semaine type" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-xl font-extrabold">Chaque semaine</h2>
                <p className="font-mono text-xs text-texte-gris">Heures d'Abidjan (GMT)</p>
              </div>
              <GrilleProgramme session={session} />
              {session.note && <p className="rounded-2xl bg-creme px-4 py-3 text-[15px] text-texte-doux">{session.note}</p>}
            </section>

            {prochaines.length > 0 && (
              <section aria-label="Les prochaines séances" className="flex flex-col gap-3">
                <h2 className="text-xl font-extrabold">Les prochaines séances</h2>
                <ul className="divide-y divide-ligne-douce overflow-hidden rounded-2xl border border-ligne bg-white">
                  {prochaines.map((o) => (
                    <li key={`${o.creneauId}-${o.date}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                      <span className="w-full font-mono text-[13px] text-texte-pale sm:w-64">
                        {libelleJour(o.date, { majuscule: true })} · {heureAbidjan(o.debut)}
                      </span>
                      <span className={cn("flex-1 font-bold", o.statut === "annulee" && "text-texte-pale line-through")}>
                        {o.libelle}
                        {o.intervenant && <span className="font-normal text-texte-pale"> · {o.intervenant}</span>}
                      </span>
                      {o.statut === "en_direct" ? (
                        <BadgeDirect />
                      ) : o.statut === "annulee" ? (
                        <Badge ton="danger">Annulé{o.motif ? ` · ${o.motif}` : ""}</Badge>
                      ) : o.seanceId ? (
                        <span className="flex items-center gap-1.5 font-mono text-xs text-texte-gris">
                          <Radio className="h-3.5 w-3.5" aria-hidden /> À suivre en direct
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {autres.length > 0 && (
              <section aria-label="Autres sessions" className="flex flex-col gap-3">
                <h2 className="text-xl font-extrabold">Autres sessions</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {autres.map((s) => (
                    <Link key={s.id} href={`/programme/${s.id}`} className="flex flex-col gap-1 rounded-2xl border border-ligne bg-white p-5 text-encre no-underline transition-colors hover:border-orange hover:text-encre">
                      <span className="font-mono text-xs text-texte-gris">
                        {s.fin < aujourdhui ? "Terminée" : s.debut > aujourdhui ? "À venir" : "En cours"} · {s.anneeAcademique}
                      </span>
                      <span className="text-lg font-extrabold">{s.titre}</span>
                      <span className="text-[15px] text-texte-pale">{periode(s.debut, s.fin)}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </MiseEnPagePublique>
  );
}
