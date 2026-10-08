// Emplacement « Après la séance » sur l'accueil du formateur (/enseigner),
// sous la carte de la prochaine séance (chantier C7, placé par le socle C0).
//
// Amendement de José : on MONTRE au formateur ce que le campus a fait pour
// lui après sa dernière séance (cours complet, QCM et exercice envoyés,
// combien les ont faits, replay), on ne lui demande rien. Une seule action
// principale : corriger les copies de SES devoirs qui attendent, parce qu'un
// travail noté vite donne envie de rendre le suivant. Les copies des exercices
// du campus (routine du soir) et la relecture des devoirs de l'IA restent des
// liens discrets, facultatifs (décision D2).
//
// Correction automatique (8 octobre 2026) : le campus note les copies avec le
// corrigé que le formateur valide. L'exercice corrigé par le campus dit où en
// sont ses copies (notées, en attente, à revoir par vous), avec un lien vers
// elles, et les corrigés à valider ont leurs propres cartes (CartesCorrections),
// qui remplacent le lien « Relire les devoirs de l'IA ».
//
// C'est le seul bloc « copies » de /enseigner : l'ancienne section « Copies à
// corriger » de la page faisait doublon (et comptait les exercices du campus).
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, BookOpenCheck, CheckCircle2, ChevronRight, ClipboardList, Clock3, Lightbulb, ListChecks, PlayCircle, Sparkles, type LucideIcon } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { formaterDate, type Traducteur } from "@shared/textes";
import { selonNombre, t, type CleEnseigner } from "@shared/textes/enseigner";
import type { ApresSeanceDto, DevoirAutoApres, ResumeEnseigner } from "@shared/engagement/enseigner";
import { depuis, nombreFr } from "./outils";

type Tx = Traducteur<CleEnseigner>;


export function ApresSeance() {
  const tx = useTextes(t);
  const { data } = useQuery<ResumeEnseigner>({ queryKey: ["/api/enseigner/apres-seance"], staleTime: 60_000 });
  if (!data) return null;
  const { apres, copies, aRelire } = data;
  // Serveur de la correction automatique : les corrigés passent par leurs cartes, plus par la relecture.
  const circuitCampus = data.corriges !== undefined;
  if (!apres && !copies.aCorriger && !copies.aPublier && !copies.facultatives) return null;

  return (
    <section aria-labelledby={apres || copies.aCorriger || copies.aPublier ? "titre-apres-seance" : undefined} className="flex flex-col gap-5 rounded-[24px] border border-ligne bg-white p-5 sm:p-6">
      {apres ? (
        <Suite apres={apres} tx={tx} />
      ) : copies.aCorriger || copies.aPublier ? (
        <h2 id="titre-apres-seance" className="text-xl font-extrabold">
          {tx("apres.sansSeance.titre")}
        </h2>
      ) : null}

      {copies.aCorriger > 0 ? (
        <div className="flex flex-col gap-1.5">
          <LienBouton href="/corriger" taille="lg" className="min-h-[56px] w-full">
            {selonNombre(tx, "apres.corriger", copies.aCorriger)} <ArrowRight className="h-5 w-5" aria-hidden />
          </LienBouton>
          <p className="text-center text-sm text-texte-pale">
            {copies.plusAncienne ? tx("apres.corriger.ancienne", { v: { duree: depuis(tx, copies.plusAncienne) } }) : tx("apres.corriger.pourquoi")}
          </p>
        </div>
      ) : copies.aPublier > 0 ? (
        <Link href="/corriger" className="flex min-h-[48px] items-center gap-2 rounded-xl bg-orange-pale px-4 py-3 text-[15px] font-bold text-encre no-underline hover:text-orange-fonce">
          <ClipboardList className="h-4 w-4 shrink-0 text-orange-fonce" aria-hidden />
          <span className="flex-1">{selonNombre(tx, "apres.aPublier", copies.aPublier)}</span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      ) : null}

      {copies.facultatives > 0 && (
        <Link href="/corriger#facultatives" className="-my-1 flex min-h-[44px] items-center gap-2 text-sm font-semibold text-texte-pale no-underline hover:text-encre">
          <ClipboardList className="h-4 w-4 shrink-0 text-texte-gris" aria-hidden />
          <span className="flex-1">{selonNombre(tx, "apres.facultatives", copies.facultatives)}</span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      )}

      {aRelire > 0 && !circuitCampus && (
        <Link href="/enseigner/relire" className="-my-1 flex min-h-[44px] items-center gap-2 text-sm font-semibold text-texte-pale no-underline hover:text-encre">
          <Sparkles className="h-4 w-4 shrink-0 text-orange-fonce" aria-hidden />
          <span className="flex-1">{selonNombre(tx, "apres.relire", aRelire)}</span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      )}
    </section>
  );
}

function Suite({ apres, tx }: { apres: ApresSeanceDto; tx: Tx }) {
  const { seance, presence, participation, replay, coursComplet } = apres;
  const pret = coursComplet.etat === "prete";
  // Les séances s'appellent souvent « Initiation à l'IA · lundi 28 septembre » : la date ne se répète pas.
  const jour = formaterDate(seance.debut, { style: "jour" });
  const dateDansTitre = seance.titre.toLowerCase().includes(formaterDate(seance.debut, { style: "date" }).replace(/ \d{4}$/, "").toLowerCase());
  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-fonce">{tx("apres.etiquette", { v: { code: seance.coursCode } })}</span>
        <h2 id="titre-apres-seance" className="text-[20px] font-black leading-tight">
          {seance.titre}
        </h2>
        <p className="text-sm text-texte-pale">
          {dateDansTitre ? "" : `${jour} · `}
          {tx("apres.sousTitre")}
        </p>
      </header>

      <ul className="flex flex-col divide-y divide-ligne-douce" aria-label={tx("apres.sousTitre")}>
        <Ligne
          fait={pret}
          icone={BookOpenCheck}
          titre={tx(`apres.coursComplet.${coursComplet.etat}`)}
          detail={pret ? (coursComplet.ouvertures !== null ? selonNombre(tx, "apres.coursComplet.ouvert", coursComplet.ouvertures) : tx("apres.coursComplet.attente")) : null}
          lien={pret ? { href: `/mediatheque/cours/${seance.id}`, libelle: tx("apres.ouvrir") } : undefined}
        />
        {apres.devoirs.map((d) => (
          <LigneDevoir key={d.id} d={d} tx={tx} />
        ))}
        {replay.pret && (
          <Ligne fait icone={PlayCircle} titre={tx("apres.replay.pret")} detail={selonNombre(tx, "apres.replay.ouvert", replay.ouvertures)} lien={{ href: `/replays/${seance.id}`, libelle: tx("apres.ouvrir") }} />
        )}
        {coursComplet.revision && coursComplet.revision.reponses > 0 && (
          <Ligne
            fait
            icone={ListChecks}
            titre={tx("apres.revision", { v: { reponses: coursComplet.revision.reponses, etudiants: coursComplet.revision.etudiants } })}
            detail={[
              coursComplet.revision.plusRatee
                ? tx("apres.plusRatee", { v: { texte: coursComplet.revision.plusRatee.texte, taux: coursComplet.revision.plusRatee.tauxErreur } })
                : null,
              coursComplet.revision.signalees > 0 ? selonNombre(tx, "apres.signalees", coursComplet.revision.signalees) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            lien={coursComplet.revision.signalees > 0 ? { href: `/mediatheque/cours/${seance.id}`, libelle: tx("apres.ouvrir") } : undefined}
          />
        )}
      </ul>

      <div className="grid grid-cols-2 gap-2.5">
        <Chiffre valeur={presence.presents} sur={presence.attendus} libelle={tx("apres.presents")} note={presence.inconnus > 0 ? selonNombre(tx, "apres.inconnus", presence.inconnus) : null} />
        <Chiffre
          valeur={participation.questions}
          libelle={tx(participation.questions === 1 ? "apres.questions.un" : "apres.questions.n")}
          note={`${participation.sondages} ${tx(participation.sondages === 1 ? "apres.sondages.un" : "apres.sondages.n")}`}
        />
      </div>
      {participation.sondages === 0 && (
        <p className="-mt-2 flex items-start gap-2 text-[13px] leading-snug text-texte-pale">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-orange-fonce" aria-hidden />
          {tx("apres.astuceSondage")}
        </p>
      )}
      <Link href={`/enseigner/seances/${seance.id}`} className="-my-2 inline-flex min-h-[44px] items-center gap-1 self-start text-sm font-bold">
        {tx("apres.bilan")} <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </>
  );
}

function LigneDevoir({ d, tx }: { d: DevoirAutoApres; tx: Tx }) {
  const quiz = d.type === "quiz";
  // Correction automatique : les copies de l'exercice sont notées par le campus, plus « facultatives ».
  const campus = quiz ? null : (d.correction ?? null);
  const morceaux = quiz
    ? [selonNombre(tx, "apres.quiz.faits", d.faits), d.moyenne !== null ? tx("apres.quiz.moyenne", { v: { note: nombreFr(d.moyenne), bareme: nombreFr(d.bareme) } }) : null]
    : campus
      ? [
          selonNombre(tx, "apres.depot.rendus", d.faits),
          d.faits > 0 ? selonNombre(tx, "apres.depot.campus.notees", campus.notees) : null,
          campus.enAttente > 0 ? selonNombre(tx, "apres.depot.campus.attente", campus.enAttente) : null,
          campus.aRevoir > 0 ? selonNombre(tx, "apres.depot.campus.revoir", campus.aRevoir) : null,
        ]
      : [selonNombre(tx, "apres.depot.rendus", d.faits), d.aCorriger > 0 ? tx("apres.depot.facultatif") : null];
  // Seuls les choix du formateur se signalent : l'envoi lui-même s'est fait sans lui.
  if (!d.publie) morceaux.push(tx("apres.devoir.masque"));
  else if (d.validation === "a_revoir") morceaux.push(tx("apres.devoir.aRevoir"));
  return (
    <Ligne
      fait={d.publie}
      icone={quiz ? ListChecks : ClipboardList}
      titre={selonNombre(tx, quiz ? "apres.quiz.titre" : "apres.depot.titre", d.destinataires)}
      detail={morceaux.filter(Boolean).join(" · ")}
      lien={
        campus
          ? campus.aRevoir > 0
            ? { href: "/enseigner/a-revoir#copies", libelle: tx("apres.ouvrir") }
            : d.faits > 0
              ? { href: `/enseigner/devoirs/${d.id}/copies`, libelle: tx("apres.ouvrir") }
              : undefined
          : !quiz && d.aCorriger > 0
            ? { href: `/corriger?devoir=${d.id}`, libelle: tx("apres.ouvrir") }
            : undefined
      }
    />
  );
}

function Ligne({
  fait,
  icone: Icone,
  titre,
  detail,
  lien,
}: {
  fait: boolean;
  icone: LucideIcon;
  titre: string;
  detail?: string | null;
  lien?: { href: string; libelle: string };
}) {
  const contenu = (
    <>
      {/* Le rond porte l'icône du sujet, avec une coche quand le campus l'a fait. */}
      <span className={cn("relative grid h-10 w-10 shrink-0 place-items-center rounded-full", fait ? "bg-succes-clair text-succes" : "bg-creme text-texte-pale")}>
        <Icone className="h-[18px] w-[18px]" aria-hidden />
        <span className="absolute -bottom-0.5 -right-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-white">
          {fait ? <CheckCircle2 className="h-4 w-4 text-succes" aria-label="Fait" /> : <Clock3 className="h-4 w-4 text-texte-gris" aria-label="En cours" />}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-bold leading-snug">{titre}</span>
        {detail && <span className="text-[13px] leading-snug text-texte-pale">{detail}</span>}
      </span>
      {lien && (
        <span className="flex shrink-0 items-center text-sm font-bold text-orange-fonce">
          <span className="hidden min-[400px]:inline">{lien.libelle}</span>
          <ChevronRight className="h-5 w-5" aria-label={lien.libelle} />
        </span>
      )}
    </>
  );
  return (
    <li>
      {lien ? (
        <Link href={lien.href} className="flex min-h-[56px] items-center gap-3 py-2.5 text-encre no-underline hover:text-encre">
          {contenu}
        </Link>
      ) : (
        <div className="flex min-h-[56px] items-center gap-3 py-2.5">{contenu}</div>
      )}
    </li>
  );
}

function Chiffre({ valeur, sur, libelle, note }: { valeur: number; sur?: number; libelle: string; note?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-creme px-3.5 py-3">
      <span className="text-[26px] font-black leading-none tabular-nums">
        {valeur}
        {sur !== undefined && <span className="text-base font-bold text-texte-gris">/{sur}</span>}
      </span>
      <span className="text-[13px] font-semibold leading-snug text-texte-doux">{libelle}</span>
      {note && <span className="text-xs leading-snug text-texte-gris">{note}</span>}
    </div>
  );
}
