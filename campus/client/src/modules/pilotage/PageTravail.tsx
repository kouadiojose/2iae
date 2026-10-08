// /pilotage/travail — « Le travail du campus » (demande de José du 8 octobre 2026 au soir : « Un bouton, un
// menu qui dit clairement ce que je vais trouver, et là je vois tout le travail fait. Vraiment un visuel. »)
//
// En haut, cinq très grands chiffres de la période (7 ou 30 jours, GET /api/fil/resume) : séances données,
// cours résumés, QCM et exercices envoyés, copies notées (dont par le campus), moyenne. Puis trois listes
// déroulantes (campus, cours, formateur), que suivent les grands chiffres comme le fil des séances en cartes
// (CarteSeance), avec le nom du formateur. Direction, et équipe avec le droit « notes » ou « présences » (le
// serveur limite au périmètre).
import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, CalendarCheck, ClipboardCheck, GraduationCap, ListChecks, type LucideIcon } from "lucide-react";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Selection } from "@/components/ui/champs";
import { Erreur, Squelette } from "@/components/ui/divers";
import { TitreSection } from "@/components/ui/carte";
import { FilDesSeances } from "@/components/seances/FilDesSeances";
import { useResumeTravail } from "@/components/seances/fil";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { selonNombre, t } from "@shared/textes/travail";
import type { CoursResume } from "@shared/schema";
import { pourcent, useReferences } from "./outils";

const PERIODES = [7, 30] as const;

/** « 13,2 » : une décimale au plus, à la française. */
const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export default function PageTravail() {
  const tx = useTextes(t);
  const recherche = new URLSearchParams(useSearch());
  const [, naviguer] = useLocation();
  const jours = Number(recherche.get("jours")) === 30 ? 30 : 7;
  const site = recherche.get("site") ?? "";
  const coursChoisi = recherche.get("cours") ?? "";
  const formateur = recherche.get("formateur") ?? "";

  const refs = useReferences();
  // Les grands chiffres suivent les trois filtres, comme le fil.
  const resume = useResumeTravail(jours, { site, cours: coursChoisi, formateur });
  const { data: listeCours } = useQuery<CoursResume[]>({ queryKey: ["/api/cours"], staleTime: 5 * 60_000 });

  // Les formateurs qui ont un cours (pas les comptes d'essai sans cours), dans l'ordre alphabétique.
  const formateurs = [...new Map((listeCours ?? []).flatMap((c) => (c.formateur ? [[c.formateur.id, c.formateur] as const] : []))).values()].sort(
    (a, b) => a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr"),
  );
  const cours = (listeCours ?? []).filter((c) => !formateur || String(c.formateur?.id) === formateur).sort((a, b) => a.code.localeCompare(b.code, "fr"));

  const changer = (cle: "jours" | "site" | "cours" | "formateur", valeur: string) => {
    const p = new URLSearchParams(recherche);
    if (valeur) p.set(cle, valeur);
    else p.delete(cle);
    // Un autre formateur : le cours choisi n'est peut-être plus le sien.
    if (cle === "formateur" && valeur && coursChoisi && !(listeCours ?? []).some((c) => String(c.id) === coursChoisi && String(c.formateur?.id) === valeur)) p.delete("cours");
    const q = p.toString();
    naviguer(`/pilotage/travail${q ? `?${q}` : ""}`, { replace: true });
  };

  const r = resume.data;
  const campusChoisi = refs.data?.sites.find((s) => String(s.id) === site);
  const coursFiltre = (listeCours ?? []).find((c) => String(c.id) === coursChoisi);
  const formateurFiltre = formateurs.find((f) => String(f.id) === formateur);
  // Sous « Les 7 derniers jours » : « Yamoussoukro · IA-101 », ce que comptent les grands chiffres.
  const precision = [campusChoisi?.nomCourt, coursFiltre?.code, !coursFiltre && formateurFiltre ? `${formateurFiltre.prenom} ${formateurFiltre.nom}` : null].filter(Boolean);
  return (
    <Page>
      <EnTetePage etiquette={tx("travail.etiquette")} titre={tx("travail.titre")} sousTitre={tx("travail.sousTitre")} />

      {/* Les grands chiffres de la période, pour tout le groupe ou les filtres choisis (campus, cours, formateur). */}
      <section aria-labelledby="titre-chiffres" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titre-chiffres" className="text-[22px] font-extrabold leading-tight">
            {jours === 7 ? tx("travail.semaine") : tx("travail.mois")}
            {precision.length > 0 && <span className="block text-[16px] font-bold text-texte-pale">{precision.join(" · ")}</span>}
          </h2>
          <div role="radiogroup" aria-label={tx("travail.periode")} className="flex w-full gap-1 rounded-2xl bg-creme p-1 sm:w-auto">
            {PERIODES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={jours === p}
                onClick={() => changer("jours", p === 7 ? "" : String(p))}
                className={cn("min-h-[48px] flex-1 whitespace-nowrap rounded-xl px-3 text-[16px] font-bold sm:flex-none sm:px-5", jours === p ? "bg-encre text-white" : "text-texte-pale hover:text-encre")}
              >
                {tx("travail.jours", { v: { n: p } })}
              </button>
            ))}
          </div>
        </div>
        {resume.isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-busy="true" aria-label="Chargement">
            {Array.from({ length: 5 }, (_, i) => (
              <Squelette key={i} className={cn("h-[176px] rounded-[22px]", i === 4 && "col-span-2 lg:col-span-1")} />
            ))}
          </div>
        ) : resume.error && !r ? (
          <Erreur message={tx("travail.erreur")} reessayer={() => void resume.refetch()} />
        ) : r ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <GrandChiffre icone={CalendarCheck} valeur={String(r.seancesTenues)} libelle={tx("travail.seances")} detail={r.presence.taux !== null ? tx("travail.seances.detail", { v: { taux: pourcent(r.presence.taux) } }) : null} />
            <GrandChiffre icone={BookOpenCheck} valeur={String(r.coursResumes)} libelle={tx("travail.resumes")} detail={tx("travail.resumes.detail")} />
            <GrandChiffre
              icone={ListChecks}
              valeur={String(r.qcmEnvoyes + r.exercicesEnvoyes)}
              libelle={tx("travail.envoyes")}
              detail={tx("travail.envoyes.detail", { v: { qcm: selonNombre(tx, "travail.envoyes.qcm", r.qcmEnvoyes), exercices: selonNombre(tx, "travail.envoyes.exercices", r.exercicesEnvoyes) } })}
            />
            <GrandChiffre
              icone={ClipboardCheck}
              valeur={String(r.copiesNotees)}
              libelle={tx("travail.notees")}
              detail={tx("travail.notees.detail", { v: { campus: r.noteesParLeCampus, rendues: r.copiesRendues } })}
            />
            <GrandChiffre
              className="col-span-2 lg:col-span-1"
              icone={GraduationCap}
              valeur={r.moyenneSur20 !== null ? nombre(r.moyenneSur20) : "–"}
              suffixe={r.moyenneSur20 !== null ? "/20" : undefined}
              libelle={tx("travail.moyenne")}
              detail={r.moyenneSur20 !== null ? tx("travail.moyenne.detail") : tx("travail.moyenne.aucune")}
              ton={r.moyenneSur20 === null ? "gris" : r.moyenneSur20 >= 10 ? "succes" : "orange"}
            />
          </div>
        ) : null}
      </section>

      {/* Trois listes déroulantes, la plus simple des commandes sur téléphone. */}
      <section aria-label={tx("travail.filtres")} className="grid grid-cols-1 gap-3 rounded-2xl bg-creme p-3 sm:grid-cols-3 sm:p-4">
        {refs.data?.toutLeGroupe && (
          <Selection libelle={tx("travail.campus")} value={site} onChange={(e) => changer("site", e.target.value)} className="min-w-0 [&_select]:min-h-[52px] [&_select]:text-[16px]">
            <option value="">{tx("travail.tousCampus")}</option>
            {refs.data.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nomCourt}
              </option>
            ))}
          </Selection>
        )}
        <Selection libelle={tx("travail.formateur")} value={formateur} onChange={(e) => changer("formateur", e.target.value)} className="min-w-0 [&_select]:min-h-[52px] [&_select]:text-[16px]">
          <option value="">{tx("travail.tousFormateurs")}</option>
          {formateurs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.prenom} {f.nom}
            </option>
          ))}
        </Selection>
        <Selection libelle={tx("travail.cours")} value={coursChoisi} onChange={(e) => changer("cours", e.target.value)} className="min-w-0 [&_select]:min-h-[52px] [&_select]:text-[16px]">
          <option value="">{tx("travail.tousCours")}</option>
          {cours.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.titre}
            </option>
          ))}
        </Selection>
      </section>

      <section aria-labelledby="titre-fil">
        <TitreSection titre={<span id="titre-fil">{tx("travail.fil")}</span>} />
        <FilDesSeances
          filtres={{ site, cours: coursChoisi, formateur }}
          avecFormateur
          vide={
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ligne px-6 py-10 text-center">
              <p className="text-lg font-extrabold">{tx("travail.vide.titre")}</p>
              <p className="max-w-md text-[15px] text-texte-pale">{tx("travail.vide.texte")}</p>
            </div>
          }
        />
      </section>
    </Page>
  );
}

function GrandChiffre({
  icone: Icone,
  valeur,
  suffixe,
  libelle,
  detail,
  ton = "encre",
  className,
}: {
  icone: LucideIcon;
  valeur: string;
  /** Petit texte après le chiffre (« /20 »). */
  suffixe?: string;
  libelle: string;
  detail?: string | null;
  ton?: "encre" | "succes" | "orange" | "gris";
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 rounded-[22px] border border-ligne bg-white p-4 sm:p-5", className)}>
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-clair text-orange-fonce" aria-hidden>
        <Icone className="h-[22px] w-[22px]" />
      </span>
      <span
        className={cn(
          "mt-1 text-[44px] font-black leading-none tabular-nums tracking-serre sm:text-[52px]",
          ton === "succes" && "text-succes",
          ton === "orange" && "text-orange-fonce",
          ton === "gris" && "text-texte-pale",
        )}
      >
        {valeur}
        {suffixe && <span className="text-[22px] font-extrabold text-texte-gris sm:text-[24px]">{suffixe}</span>}
      </span>
      <span className="text-[17px] font-extrabold leading-tight">{libelle}</span>
      {detail && <span className="text-[14px] leading-snug text-texte-pale">{detail}</span>}
    </div>
  );
}
