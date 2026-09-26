// /emploi-du-temps : l'emploi du temps de l'étudiant ou du formateur.
// En haut « Cette semaine » (les séances datées, aujourd'hui mis en avant,
// lien vers la classe en direct), puis la grille de la session, un sélecteur
// quand il y en a plusieurs, et « Imprimer ». Le formateur voit ses créneaux
// en orange et, si son fuseau est connu, l'heure chez lui.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Printer, Globe } from "lucide-react";
import type { MonProgrammeDto, SessionDetailDto } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Chargement, Erreur, EtatVide, Badge } from "@/components/ui/divers";
import { LienBouton } from "@/components/ui/bouton";
import { Onglets } from "@/components/ui/onglets";
import { useMoiConnecte } from "@/lib/auth";
import { GrilleProgramme } from "./GrilleProgramme";
import { SemaineProgramme } from "./SemaineProgramme";
import { fuseauDe, periode, sessionParDefaut, villeDuFuseau, hh, semaineDepuis, libelleJour } from "./outils";

export default function PageEmploiDuTemps() {
  const moi = useMoiConnecte();
  const tu = moi.role === "etudiant";
  const formateur = moi.role === "formateur";
  const fuseau = formateur ? fuseauDe(moi) : null;
  const { data, isLoading, error, refetch } = useQuery<MonProgrammeDto>({ queryKey: ["/api/programme"], refetchInterval: 5 * 60_000 });
  const [choix, setChoix] = useState<number | null>(null);
  const sessions = data?.sessions ?? [];
  const parDefaut = data ? sessionParDefaut(sessions, data.aujourdhui) : undefined;
  const session = sessions.find((s) => s.id === choix) ?? parDefaut;
  useEffect(() => {
    if (choix && !sessions.some((s) => s.id === choix)) setChoix(null);
  }, [choix, sessions]);

  // Une autre session que celle par défaut : ses propres occurrences (sa première semaine, ou celle d'aujourd'hui).
  const autre = Boolean(session && parDefaut && session.id !== parDefaut.id);
  const { data: detail } = useQuery<SessionDetailDto>({ queryKey: ["/api/programme", session?.id ?? 0], enabled: autre });
  const semaine = useMemo(() => {
    if (!data) return null;
    if (autre && detail) return semaineDepuis(detail.occurrences, data.aujourdhui);
    return data.semaine;
  }, [data, autre, detail]);

  const sousTitre = formateur
    ? `Vos créneaux sont en orange. Heures d'Abidjan${fuseau ? `, et chez vous (${villeDuFuseau(fuseau)})` : ""}.`
    : tu
      ? "Tes cours en direct, heure d'Abidjan. Ils se suivent dans la salle de conférence de ton campus ou sur ton téléphone."
      : "Ce que voient les étudiants et les formateurs. Heures d'Abidjan.";

  return (
    <Page>
      <EnTetePage
        etiquette={session ? `Emploi du temps · ${session.anneeAcademique}` : "Emploi du temps"}
        titre={tu ? "Ton emploi du temps" : formateur ? "Votre emploi du temps" : "Emploi du temps"}
        sousTitre={sousTitre}
        actions={
          session ? (
            <LienBouton href={`/programme/${session.id}/imprimer?retour=/emploi-du-temps`} variante="contour" icone={<Printer className="h-4 w-4" />} className="min-h-[48px]">
              Imprimer
            </LienBouton>
          ) : undefined
        }
      />

      {isLoading ? (
        <Chargement lignes={4} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => refetch()} />
      ) : !session ? (
        <EtatVide
          icone={<CalendarRange className="h-6 w-6" />}
          titre={tu ? "Ton emploi du temps n'est pas encore publié." : formateur ? "Votre emploi du temps n'est pas encore publié." : "Aucun emploi du temps publié."}
          texte={
            tu
              ? "Dès que la direction des études le publie, il apparaît ici et tu reçois une notification. Tes cours en direct seront aussi dans l'onglet Live."
              : formateur
                ? "Dès que la direction des études publie la session où vous intervenez, vos créneaux apparaissent ici et vous recevez une notification."
                : "Saisissez et publiez la session depuis le pilotage : elle apparaîtra ici, sur le site public et dans l'espace de chacun."
          }
          action={
            estEquipe(moi.role) ? (
              <LienBouton href="/pilotage/programme">Ouvrir l'emploi du temps</LienBouton>
            ) : (
              <LienBouton href="/programme" variante="contour" icone={<Globe className="h-4 w-4" />}>
                Voir le programme public
              </LienBouton>
            )
          }
        />
      ) : (
        <>
          {semaine && <SemaineProgramme semaine={semaine} aujourdhui={data!.aujourdhui} surligner={formateur ? moi.id : null} fuseau={fuseau} vous={!tu} />}

          <section className="flex flex-col gap-4" aria-label="Grille de la session">
            {sessions.length > 1 && (
              <Onglets
                valeur={String(session.id)}
                onChange={(v) => setChoix(Number(v))}
                options={sessions.map((s) => ({ valeur: String(s.id), libelle: `${s.titre}${s.fin < data!.aujourdhui ? " (terminée)" : ""}` }))}
              />
            )}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-black tracking-serre">{session.titre}</h2>
                <p className="text-[15px] text-texte-pale">
                  {session.public ? `${session.public} · ` : ""}
                  {periode(session.debut, session.fin)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {session.pause && (
                  <Badge ton="gris">
                    Pause {hh(session.pause.debut)}–{hh(session.pause.fin)}
                  </Badge>
                )}
                {session.debut <= data!.aujourdhui && session.fin >= data!.aujourdhui && <Badge ton="succes">En cours</Badge>}
              </div>
            </div>
            <GrilleProgramme session={session} surligner={formateur ? moi.id : null} />
            {session.note && <p className="rounded-2xl bg-creme px-4 py-3 text-[15px] text-texte-doux">{session.note}</p>}
            {session.exceptions.length > 0 && (
              <div className="rounded-2xl border border-ligne bg-white p-4">
                <h3 className="mb-2 text-base font-extrabold">Jours sans cours</h3>
                <ul className="flex flex-col gap-1 text-[15px] text-texte-doux">
                  {session.exceptions.map((e) => {
                    const c = session.creneaux.find((x) => x.id === e.creneauId);
                    return (
                      <li key={e.id}>
                        <strong className="text-encre">{libelleJour(e.date, { majuscule: true })}</strong>
                        {c ? ` · ${c.libelle}` : " · toute la journée"}
                        {e.motif ? ` : ${e.motif}` : ""}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </Page>
  );
}

const estEquipe = (r: string) => r === "admin" || r === "vie_scolaire";
