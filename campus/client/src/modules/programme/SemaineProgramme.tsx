// « Cette semaine » : les occurrences datées d'une semaine, jour par jour,
// aujourd'hui mis en avant, avec l'état de chaque séance (prévue, en direct,
// terminée, annulée) et le lien vers la classe en direct quand elle existe.
// Réutilisable : espace étudiant et formateur, site public, accueil.
import type { ReactNode } from "react";
import { Link } from "wouter";
import { CalendarX2, UserRound } from "lucide-react";
import type { OccurrenceDto, SemaineProgrammeDto } from "@shared/schema";
import { Badge, BadgeDirect, EtatVide } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import { chezVous, heureAbidjan, jourMois, libelleJour, parJour } from "./outils";

type Props = {
  semaine: Pick<SemaineProgrammeDto, "debut" | "fin" | "occurrences"> & { nature?: SemaineProgrammeDto["nature"] };
  /** Jour d'Abidjan (« 2026-09-28 »), donné par le serveur. */
  aujourdhui: string;
  /** Met en valeur les occurrences de cet intervenant (le formateur connecté). */
  surligner?: number | null;
  /** live : lien vers /live/:id (connecté) · connexion : page publique (se connecter pour suivre) · aucun. */
  liens?: "live" | "connexion" | "aucun";
  /** Fuseau du formateur : ajoute « 04h30 chez vous (Toronto) ». */
  fuseau?: string | null;
  /** Titre de la section (false : aucun). */
  titre?: ReactNode | false;
  /** Tutoiement (étudiant, public) ou vouvoiement (formateur, équipe). */
  vous?: boolean;
  className?: string;
};

export function SemaineProgramme({ semaine, aujourdhui, surligner, liens = "live", fuseau, titre, vous, className }: Props) {
  const jours = parJour(semaine.occurrences);
  const enTete =
    titre === false ? null : (
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-xl font-extrabold">
          {titre ?? (semaine.nature === "a-venir" ? `La semaine du ${jourMois(semaine.debut)}` : "Cette semaine")}
        </h2>
        <p className="font-mono text-xs text-texte-gris">
          Du {jourMois(semaine.debut)} au {jourMois(semaine.fin)} · heures d'Abidjan
        </p>
        {semaine.nature === "a-venir" && semaine.occurrences[0] && (
          <p className="w-full text-[15px] text-texte-doux">
            {"Les cours commencent le "}
            <strong className="text-encre">
              {libelleJour(semaine.occurrences[0].date)} à {heureAbidjan(semaine.occurrences[0].debut)}
            </strong>
            .
          </p>
        )}
      </div>
    );
  return (
    <section className={className} aria-label={typeof titre === "string" ? titre : "Cette semaine"}>
      {enTete}
      {!jours.length ? (
        <EtatVide icone={<CalendarX2 className="h-6 w-6" />} titre="Pas de cours cette semaine." texte={vous ? "Les prochains créneaux apparaîtront ici dès leur publication." : "Les prochains cours apparaîtront ici dès leur publication."} />
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
          {jours.map((j) => {
            const estAujourdhui = j.date === aujourdhui;
            const passe = j.date < aujourdhui;
            return (
              <article
                key={j.date}
                aria-current={estAujourdhui ? "date" : undefined}
                className={cn("flex flex-col gap-2 rounded-2xl border bg-white p-3.5", estAujourdhui ? "border-2 border-orange shadow-carte" : "border-ligne", passe && "opacity-75")}
              >
                <h3 className="flex items-center justify-between gap-2 text-[15px] font-extrabold">
                  <span>{libelleJour(j.date, { majuscule: true })}</span>
                  {estAujourdhui && <span className="rounded-full bg-orange px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-encre">Aujourd'hui</span>}
                </h3>
                {j.occurrences.map((o) => (
                  <LigneOccurrence
                    key={`${o.creneauId}-${o.date}`}
                    o={o}
                    surligne={Boolean(surligner && o.intervenantId === surligner)}
                    // Un formateur n'ouvre que ses propres séances : pas de lien vers celles des autres intervenants.
                    liens={surligner && o.intervenantId !== surligner ? "aucun" : liens}
                    fuseau={fuseau}
                    vous={vous}
                  />
                ))}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default SemaineProgramme;

function LigneOccurrence({ o, surligne, liens, fuseau, vous }: { o: OccurrenceDto; surligne: boolean; liens: Props["liens"]; fuseau?: string | null; vous?: boolean }) {
  const annulee = o.statut === "annulee";
  const direct = o.statut === "en_direct";
  return (
    <div
      className={cn("flex flex-col gap-1 rounded-xl border-l-4 px-3 py-2.5", surligne ? "bg-orange-clair" : annulee ? "bg-danger-clair/50" : "bg-creme/70")}
      style={{ borderLeftColor: annulee ? "#C2410C" : (o.couleur ?? (o.type === "seminaire" ? "#141414" : "#8A7F76")) }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[13px] font-semibold text-texte-doux">
          {heureAbidjan(o.debut)}–{heureAbidjan(o.fin)}
        </span>
        <Statut o={o} />
      </div>
      {fuseau && !annulee && <span className="-mt-0.5 font-mono text-[11.5px] text-orange-profond">{chezVous(o.debut, fuseau)}</span>}
      <span className={cn("font-extrabold leading-snug", annulee && "text-texte-pale line-through decoration-danger/60")}>
        {o.libelle}
        {surligne && <span className="ml-2 rounded-full bg-orange px-2 py-0.5 align-middle font-mono text-[10px] font-semibold uppercase text-encre no-underline">Vous</span>}
      </span>
      {o.intervenant && (
        <span className="flex items-center gap-1.5 text-[13px] text-texte-pale">
          <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {o.intervenant}
            {o.mention ? ` · ${o.mention}` : ""}
          </span>
        </span>
      )}
      {annulee && o.motif && <span className="text-[13px] font-semibold text-danger">{o.motif}</span>}
      {o.seanceId && liens === "live" && !annulee && (
        <Link
          href={vous && o.statut === "prevue" ? `/enseigner/seances/${o.seanceId}` : `/live/${o.seanceId}`}
          className={cn(
            "mt-1 inline-flex min-h-[40px] items-center justify-center self-start rounded-[10px] px-3 text-[13px] font-bold no-underline",
            direct ? "bg-orange text-encre hover:bg-encre hover:text-white" : "bg-white text-encre ring-1 ring-ligne hover:ring-orange",
          )}
        >
          {direct ? (vous ? "Ouvrir la classe" : "Rejoindre le live") : o.statut === "terminee" ? "Voir la séance" : vous ? "Préparer la séance" : "Voir la séance"}
        </Link>
      )}
      {o.seanceId && liens === "connexion" && direct && (
        <Link href={`/connexion?retour=${encodeURIComponent(`/live/${o.seanceId}`)}`} className="mt-1 inline-flex min-h-[40px] items-center self-start rounded-[10px] bg-orange px-3 text-[13px] font-bold text-encre no-underline hover:bg-encre hover:text-white">
          Se connecter pour suivre
        </Link>
      )}
    </div>
  );
}

function Statut({ o }: { o: OccurrenceDto }) {
  if (o.statut === "en_direct") return <BadgeDirect className="px-2 py-1 text-[10px]" />;
  if (o.statut === "annulee") return <Badge ton="danger">Annulé</Badge>;
  if (o.statut === "terminee") return <Badge ton="gris">Terminé</Badge>;
  return <Badge ton="gris">Prévu</Badge>;
}
