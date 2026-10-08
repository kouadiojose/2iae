// Carte d'une séance tenue (« Le travail du campus ») : le jour, le cours, le titre, puis cinq grosses
// pastilles qui disent d'un coup d'œil ce que le campus en a fait : Vidéo · Cours résumé · QCM · Exercice ·
// Présents. Chaque pastille a un état clair (vert : prêt ou fait ; orange : en cours ; gris : pas encore ou
// sans objet), un petit chiffre, et ouvre la page existante quand il y en a une. Partagée par l'accueil du
// formateur (/enseigner), « Mes séances » (/mes-seances) et la direction (/pilotage/travail).
//
// Sur téléphone (360 px) : deux rangées, les trois pastilles courtes (vidéo, cours résumé, présents) puis les
// deux plus bavardes (QCM, exercice) en plus large ; sur ordinateur, les cinq dans l'ordre, sur une ligne.
import { Link } from "wouter";
import { BookOpenCheck, CheckCircle2, Clock3, ClipboardList, ListChecks, PlayCircle, Users, type LucideIcon } from "lucide-react";
import { Avatar, BadgeDirect } from "@/components/ui/divers";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { formaterDate, type Traducteur } from "@shared/textes";
import { selonNombre, t, type CleTravail } from "@shared/textes/travail";
import type { FilSeance } from "@shared/engagement/fil";

type Tx = Traducteur<CleTravail>;
export type EtatPastille = "fait" | "enCours" | "pasEncore";

const JOUR = 86_400_000;

/** « 13,5 » : nombre à la française, une décimale au plus. */
const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** « 13,5/20 » ; la note du barème telle quelle (un QCM sur 10 reste sur 10). */
const surBareme = (moyenne: number, bareme: number) => `${nombre(moyenne)}/${nombre(bareme)}`;

export function CarteSeance({ seance, avecFormateur = false, className }: { seance: FilSeance; avecFormateur?: boolean; className?: string }) {
  const tx = useTextes(t);
  const quand = seance.demarreeLe ?? seance.debut;
  const jour = formaterDate(quand, { style: "jour" });
  const heure = formaterDate(quand, { style: "heure" });
  // Les séances s'appellent souvent « Initiation à l'IA · lundi 5 octobre » : le nom du cours ne se répète pas.
  const coursDansTitre = seance.titre.toLowerCase().startsWith(seance.cours.titre.toLowerCase());
  const idTitre = `seance-${seance.id}-titre`;
  const titre = (
    <h3 id={idTitre} className="text-[19px] font-extrabold leading-snug">
      {seance.titre}
    </h3>
  );
  return (
    <article aria-labelledby={idTitre} className={cn("overflow-hidden rounded-[22px] border border-ligne bg-white", className)}>
      <div className="h-1.5" style={{ backgroundColor: seance.cours.couleur }} aria-hidden />
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <header className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-creme px-2 py-1 font-mono text-[13px] font-bold text-encre">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seance.cours.couleur }} aria-hidden />
              {seance.cours.code}
            </span>
            <span className="text-[15px] font-bold text-texte-doux">
              {jour.charAt(0).toUpperCase() + jour.slice(1)} · {heure}
            </span>
            {seance.statut === "en_direct" && <BadgeDirect libelle={tx("carte.direct")} />}
          </div>
          {seance.lienSeance ? (
            <Link href={seance.lienSeance} className="text-encre no-underline hover:text-orange-fonce" aria-label={`${tx("carte.voir")} : ${seance.titre}`}>
              {titre}
            </Link>
          ) : (
            titre
          )}
          {(!coursDansTitre || (avecFormateur && seance.formateur)) && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] leading-snug text-texte-pale">
              {!coursDansTitre && <span>{seance.cours.titre}</span>}
              {avecFormateur && seance.formateur && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-texte-doux">
                  <Avatar prenom={seance.formateur.prenom} nom={seance.formateur.nom} taille={22} />
                  {seance.formateur.prenom} {seance.formateur.nom}
                </span>
              )}
            </p>
          )}
        </header>
        <Pastilles seance={seance} tx={tx} />
      </div>
    </article>
  );
}

/** Les cinq pastilles d'une séance (aussi utilisables seules). */
export function Pastilles({ seance, tx }: { seance: FilSeance; tx: Tx }) {
  const { video, resume, qcm, exercice, presence } = seance;
  const finie = new Date(seance.termineeLe ?? seance.demarreeLe ?? seance.debut).getTime();
  // Une vidéo qui n'est pas prête le lendemain ne viendra sans doute plus (séance sans enregistrement).
  const videoAttendue = seance.statut === "en_direct" || Date.now() - finie < JOUR;

  const etatResume: EtatPastille = resume.etat === "prete" ? "fait" : resume.etat === "a_venir" ? "pasEncore" : "enCours";
  const notees = exercice ? exercice.notees : 0;
  const etatExercice: EtatPastille = !exercice ? "pasEncore" : exercice.rendues > 0 && notees >= exercice.rendues && !exercice.aRevoir ? "fait" : "enCours";
  // Présence en trois états : sans aucune présence connue (salles pas émargées), rien n'est compté absent.
  const presenceConnue = presence.attendus > 0 && presence.taux !== null;
  const etatPresence: EtatPastille = !presenceConnue ? "pasEncore" : presence.taux! >= 70 ? "fait" : "enCours";

  return (
    <ul className="grid grid-cols-6 gap-2 sm:grid-cols-5" aria-label={tx("carte.voir")}>
      <Pastille
        className="order-1 col-span-2 sm:order-none sm:col-span-1"
        icone={PlayCircle}
        titre={tx("video.titre")}
        etat={video.pret ? "fait" : videoAttendue ? "enCours" : "pasEncore"}
        valeur={video.pret ? tx("video.prete") : videoAttendue ? tx("video.preparation") : tx("video.aucune")}
        detail={video.pret ? selonNombre(tx, "video.vues", video.vues) : null}
        lien={video.pret ? video.lien : null}
      />
      <Pastille
        className="order-2 col-span-2 sm:order-none sm:col-span-1"
        icone={BookOpenCheck}
        titre={tx("resume.titre")}
        etat={etatResume}
        valeur={tx(`resume.${resume.etat}`)}
        detail={resume.etat === "prete" ? selonNombre(tx, "resume.ouvert", resume.ouvertures) : null}
        lien={resume.etat === "prete" ? resume.lien : null}
      />
      <Pastille
        className="order-4 col-span-3 sm:order-none sm:col-span-1"
        icone={ListChecks}
        titre={tx("qcm.titre")}
        etat={!qcm ? "pasEncore" : qcm.faits > 0 ? "fait" : "enCours"}
        valeur={qcm ? tx("qcm.faits", { v: { faits: qcm.faits, sur: qcm.envoyeA } }) : tx("qcm.aucun")}
        detail={qcm ? (qcm.moyenne !== null ? tx("qcm.moyenne", { v: { note: surBareme(qcm.moyenne, qcm.bareme) } }) : tx("qcm.faits.detail")) : null}
        lien={qcm?.lien ?? null}
      />
      <Pastille
        className="order-5 col-span-3 sm:order-none sm:col-span-1"
        icone={ClipboardList}
        titre={tx("exercice.titre")}
        etat={etatExercice}
        valeur={exercice ? selonNombre(tx, "exercice.copies", exercice.rendues) : tx("exercice.aucun")}
        detail={
          exercice
            ? exercice.aRevoir > 0
              ? `${selonNombre(tx, "exercice.notees", exercice.notees)} · ${selonNombre(tx, "exercice.aRevoir", exercice.aRevoir)}`
              : exercice.corrige === "propose"
                ? exercice.rendues > 0
                  ? `${selonNombre(tx, "exercice.notees", exercice.notees)} · ${tx("exercice.corrige")}`
                  : tx("exercice.corrige")
                : selonNombre(tx, "exercice.notees", exercice.notees)
            : null
        }
        lien={exercice?.lien ?? null}
      />
      <Pastille
        // Téléphone : en fin de première rangée, avec les pastilles courtes ; ordinateur : à sa place, la dernière.
        className="order-3 col-span-2 sm:order-none sm:col-span-1"
        icone={Users}
        titre={tx("presents.titre")}
        etat={etatPresence}
        valeur={presenceConnue ? tx("presents.valeur", { v: { presents: presence.presents, attendus: presence.attendus } }) : tx("presents.aucun")}
        detail={presence.inconnus > 0 ? selonNombre(tx, "presents.inconnus", presence.inconnus) : null}
        lien={seance.lienSeance}
      />
    </ul>
  );
}

const STYLES: Record<EtatPastille, { fond: string; rond: string; marque: string }> = {
  fait: { fond: "border-succes/25 bg-succes-clair", rond: "bg-succes text-white", marque: "text-succes" },
  enCours: { fond: "border-orange/35 bg-orange-pale", rond: "bg-orange text-encre", marque: "text-orange-fonce" },
  pasEncore: { fond: "border-ligne bg-creme", rond: "bg-white text-texte-gris", marque: "text-texte-gris" },
};

function Pastille({
  icone: Icone,
  titre,
  etat,
  valeur,
  detail,
  lien,
  className,
}: {
  icone: LucideIcon;
  titre: string;
  etat: EtatPastille;
  valeur: string;
  detail?: string | null;
  lien?: string | null;
  className?: string;
}) {
  const s = STYLES[etat];
  const contenu = (
    <>
      <span className={cn("relative grid h-11 w-11 shrink-0 place-items-center rounded-full", s.rond)} aria-hidden>
        <Icone className="h-[22px] w-[22px]" />
        {etat !== "pasEncore" && (
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-white">
            {etat === "fait" ? <CheckCircle2 className={cn("h-[18px] w-[18px]", s.marque)} /> : <Clock3 className={cn("h-[18px] w-[18px]", s.marque)} />}
          </span>
        )}
      </span>
      <span className="text-[14px] font-extrabold leading-tight text-encre">{titre}</span>
      <span className={cn("text-[16px] font-black leading-tight tabular-nums", etat === "pasEncore" ? "text-texte-pale" : "text-encre")}>{valeur}</span>
      {detail && <span className="text-[13px] leading-snug text-texte-pale">{detail}</span>}
    </>
  );
  const classes = cn("flex h-full min-h-[128px] flex-col items-center gap-1 rounded-2xl border px-1.5 py-3 text-center", s.fond);
  const libelle = `${titre} : ${valeur}${detail ? `, ${detail}` : ""}`;
  return (
    <li className={cn("min-w-0", className)}>
      {lien ? (
        <Link href={lien} aria-label={libelle} className={cn(classes, "text-encre no-underline transition-colors hover:border-orange hover:text-encre focus-visible:border-orange")}>
          {contenu}
        </Link>
      ) : (
        <div aria-label={libelle} role="group" className={classes}>
          {contenu}
        </div>
      )}
    </li>
  );
}
