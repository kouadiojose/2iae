// /pilotage/engagement : le tableau « Engagement et participation » de la
// direction et de la vie scolaire (chantier C8). Ce que font vraiment les
// étudiants, jour par jour : apprendre sur leur téléphone, suivre les directs,
// travailler entre les cours, recevoir les rappels. Une phrase de lecture sous
// chaque chiffre ; présence aux directs en trois états (« inconnu » n'est pas
// une absence) ; aucun taux sous 5 étudiants, aucun nom d'étudiant.
import { useState, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw, Users, TriangleAlert, Smartphone, Info } from "lucide-react";
import type { EngagementPilotage, Part, LigneTravail, LigneEnvois } from "@shared/engagement/indicateurs";
import { PERIODES, PERIODE_PAR_DEFAUT } from "@shared/engagement/indicateurs";
import { t, selonNombre, type CleEngagement } from "@shared/textes/engagement";
import type { Traducteur } from "@shared/textes";
import { useTextes } from "@/lib/textes";
import { api } from "@/lib/api";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { BarreProgression, Chargement, Erreur, EtatVide, Badge } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { Carte, TitreSection } from "@/components/ui/carte";
import { Selection } from "@/components/ui/champs";
import { toastErreur } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { SousNav } from "@/modules/pilotage/composants/SousNav";
import { useReferences } from "@/modules/pilotage/outils";
import { CourbeJours, ColonnesSemaines, BarreTroisEtats, BarrePlateformes, PasEncoreMesure, jourCourt } from "./Courbe";
import { EntonnoirDirect } from "./EntonnoirDirect";
import { BlocCorrections } from "./BlocCorrections";

type Tx = Traducteur<CleEngagement>;

const heureAbidjan = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const dateAbidjan = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" });
const virgule = (n: number) => String(n).replace(".", ",");
const pc = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${n} %`);

export default function PageEngagement() {
  const tx = useTextes(t);
  const recherche = new URLSearchParams(useSearch());
  const [, naviguer] = useLocation();
  const refs = useReferences();
  const client = useQueryClient();
  const jours = Number(recherche.get("jours")) || PERIODE_PAR_DEFAUT;
  const site = recherche.get("site") ?? "";
  const classe = recherche.get("classe") ?? "";
  const params = new URLSearchParams({ jours: String(jours), ...(site ? { site } : {}), ...(classe ? { classe } : {}) }).toString();
  const url = `/api/pilotage/engagement?${params}`;
  // L'écran garde le calcul précédent pendant le suivant (pas de saut de mise en page).
  const q = useQuery<EngagementPilotage>({ queryKey: [url], staleTime: 5 * 60_000, placeholderData: (avant) => avant });
  const [recalcul, setRecalcul] = useState(false);
  const d = q.data;

  const changer = (cle: "jours" | "site" | "classe", valeur: string) => {
    const p = new URLSearchParams(recherche);
    if (valeur) p.set(cle, valeur);
    else p.delete(cle);
    if (cle === "site") p.delete("classe");
    naviguer(`/pilotage/engagement?${p.toString()}`, { replace: true });
  };
  const recalculer = async () => {
    setRecalcul(true);
    try {
      client.setQueryData([url], await api<EngagementPilotage>(`${url}&frais=1`));
    } catch (e) {
      toastErreur(e);
    } finally {
      setRecalcul(false);
    }
  };

  const classes = (refs.data?.classes ?? []).filter((c) => !site || String(c.siteId) === site);
  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette={tx("page.etiquette")}
        titre={tx("page.titre")}
        sousTitre={tx("page.sousTitre")}
        actions={
          <a
            href={`/api/pilotage/engagement/export?${params}`}
            download
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border-[1.5px] border-encre bg-white px-4 text-[15px] font-bold text-encre no-underline hover:bg-orange-pale hover:text-encre"
          >
            <Download className="h-4 w-4" />
            {tx("page.export")}
          </a>
        }
      />

      {/* Filtres : une ligne au-dessus de tout ce qu'ils règlent. */}
      <section className="grid grid-cols-2 gap-x-2 gap-y-3 rounded-2xl bg-creme p-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="col-span-2 flex flex-col gap-1.5">
          <span className="text-sm font-bold">{tx("filtre.periode")}</span>
          <div role="radiogroup" aria-label={tx("filtre.periode")} className="flex gap-1 rounded-xl bg-white p-1">
            {PERIODES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={jours === p}
                onClick={() => changer("jours", String(p))}
                className={cn("min-h-[40px] flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-bold", jours === p ? "bg-encre text-white" : "text-texte-pale hover:text-encre")}
              >
                {tx("filtre.jours", { v: { n: p } })}
              </button>
            ))}
          </div>
        </div>
        {refs.data?.toutLeGroupe && (
          <Selection libelle={tx("filtre.campus")} value={site} onChange={(e) => changer("site", e.target.value)} className="min-w-0 sm:w-48">
            <option value="">{tx("filtre.tousCampus")}</option>
            {refs.data.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nomCourt}
              </option>
            ))}
          </Selection>
        )}
        <Selection
          libelle={tx("filtre.classe")}
          value={classe}
          onChange={(e) => changer("classe", e.target.value)}
          className={cn("min-w-0 sm:w-72", !refs.data?.toutLeGroupe && "col-span-2")}
        >
          <option value="">{tx("filtre.toutesClasses")}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </Selection>
        <div className="col-span-2 flex items-center justify-between gap-3 sm:ml-auto sm:justify-end">
          {d && <span className="text-[13px] text-texte-gris">{tx("page.calculeLe", { v: { heure: heureAbidjan.format(new Date(d.genereLe)) } })}</span>}
          <Bouton variante="contour" taille="sm" onClick={recalculer} chargement={recalcul} icone={<RefreshCw className="h-4 w-4" />} className="min-h-[44px]">
            {tx("page.recalculer")}
          </Bouton>
        </div>
      </section>

      {q.isLoading && <Chargement lignes={4} />}
      {q.error && !d && <Erreur message={(q.error as Error).message} reessayer={() => q.refetch()} />}
      {d && (
        <div className={cn("flex flex-col gap-8 transition-opacity", q.isFetching && "opacity-60")}>
          <p className="flex items-center gap-2 text-sm text-texte-pale">
            <Users className="h-4 w-4 shrink-0" />
            {tx("page.effectif", { v: { n: d.effectif } })}
          </p>
          {d.effectifTropPetit ? (
            <EtatVide icone={<Users className="h-6 w-6" />} titre={tx("page.tropPetit.titre")} texte={tx("page.tropPetit.texte")} />
          ) : (
            <Contenu d={d} tx={tx} />
          )}
        </div>
      )}
    </Page>
  );
}

// ── Petites briques ────────────────────────────────────────────────────────

/** Phrase de lecture : ce que le chiffre compte, exactement. */
function Lecture({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-texte-pale">{children}</p>;
}

/** « 43 % » + « 129 sur 300 », ou l'effectif seul sous 5. */
function ValeurPart({ p, tx, grand }: { p: Part; tx: Tx; grand?: boolean }) {
  return (
    <span className="flex flex-col">
      <span className={cn("font-black tracking-serre text-encre", grand ? "text-4xl" : "text-2xl")}>{pc(p.taux)}</span>
      <span className="text-[13px] text-texte-gris">
        {p.taux === null ? (p.sur ? tx("commun.effectifPetit") : tx("commun.aucun")) : tx("commun.surN", { v: { n: p.n ?? 0, sur: p.sur } })}
      </span>
    </span>
  );
}

function TuilePart({ titre, p, lecture, tx, alerte }: { titre: string; p: Part; lecture: string; tx: Tx; alerte?: string | null }) {
  return (
    <Carte className="flex flex-col gap-2 p-4">
      <div className="font-mono text-xs uppercase tracking-wider text-texte-gris">{titre}</div>
      <ValeurPart p={p} tx={tx} grand />
      {p.taux !== null && <BarreProgression valeur={p.taux} />}
      {alerte && (
        <span className="flex items-center gap-1.5 text-sm text-alerte">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {alerte}
        </span>
      )}
      <Lecture>{lecture}</Lecture>
    </Carte>
  );
}

function LignePart({ libelle, p, detail, tx }: { libelle: string; p: Part; detail?: ReactNode; tx: Tx }) {
  return (
    <li className="flex flex-col gap-1.5 border-t border-ligne-douce py-3 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-bold text-encre">{libelle}</span>
        <span className="shrink-0 text-lg font-black tabular-nums">{pc(p.taux)}</span>
      </div>
      {p.taux !== null && <BarreProgression valeur={p.taux} />}
      <div className="text-[13px] text-texte-gris">
        {p.taux === null ? (p.sur ? tx("commun.effectifPetit") : tx("commun.aucun")) : tx("commun.surN", { v: { n: p.n ?? 0, sur: p.sur } })}
        {detail && <> · {detail}</>}
      </div>
    </li>
  );
}

function Section({ titre, id, children }: { titre: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-2xl font-extrabold">
        {titre}
      </h2>
      {children}
    </section>
  );
}

// ── Contenu ────────────────────────────────────────────────────────────────

function Contenu({ d, tx }: { d: EngagementPilotage; tx: Tx }) {
  const r = d.regularite;
  const derniereComplete = r?.semaines.filter((s) => !s.enCours).at(-1);
  return (
    <>
      <p className="flex items-start gap-2 rounded-xl bg-orange-pale px-3 py-2.5 text-[13px] text-texte-doux">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-orange-fonce" />
        {d.mesureDepuis ? tx("page.mesureDepuis", { v: { date: dateAbidjan.format(new Date(`${d.mesureDepuis}T12:00:00Z`)) } }) : tx("page.mesureAucune")}
      </p>

      {r && (
        <section aria-labelledby="principal" className="grid gap-4 rounded-3xl border border-ligne bg-white p-4 sm:p-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <div className="flex flex-col gap-2">
            <h2 id="principal" className="text-xl font-extrabold leading-tight">
              {tx("principal.titre")}
            </h2>
            <div className="text-6xl font-black tracking-tres-serre text-encre">
              {derniereComplete?.mediane === null || derniereComplete?.mediane === undefined ? "–" : virgule(derniereComplete.mediane)}
            </div>
            {derniereComplete && <div className="text-sm text-texte-pale">{tx("principal.detail", { v: { date: jourCourt(derniereComplete.lundi) } })}</div>}
            {derniereComplete && (
              <div className="flex flex-wrap gap-2">
                <Badge ton="gris">
                  {tx("principal.auMoins3")} : {pc(derniereComplete.auMoins3.taux)}
                </Badge>
                <Badge ton="gris">
                  {tx("principal.auMoins1")} : {pc(derniereComplete.auMoins1.taux)}
                </Badge>
              </div>
            )}
            <Lecture>{tx("principal.lecture")}</Lecture>
          </div>
          <ColonnesSemaines semaines={r.semaines} />
        </section>
      )}

      {r && (
        <Section titre={tx("regularite.titre")} id="regularite">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {(
              [
                ["actifs.aujourdhui", r.aujourdhui],
                ["actifs.j7", r.j7],
                ["actifs.j30", r.j30],
              ] as const
            ).map(([cle, a]) => (
              <Carte key={cle} className="p-3 sm:p-4">
                <div className="font-mono text-[11px] uppercase leading-tight tracking-wider text-texte-gris sm:text-xs">{tx(cle)}</div>
                <div className="mt-1 text-3xl font-black tracking-serre sm:text-4xl">{a.apprentissage}</div>
                <div className="text-[13px] leading-snug text-texte-pale">{tx("actifs.appris")}</div>
                <div className="mt-1 text-[13px] leading-snug text-texte-gris">{tx("actifs.venus", { v: { n: a.ouverture } })}</div>
              </Carte>
            ))}
          </div>
          <Lecture>{tx("actifs.lecture")}</Lecture>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TuilePart titre={tx("sansCours.titre")} p={r.joursSansCours} lecture={tx("sansCours.lecture")} tx={tx} />
            <TuilePart titre={tx("avecCours.titre")} p={r.joursCours} lecture={tx("avecCours.lecture")} tx={tx} />
          </div>

          <Carte className="flex flex-col gap-3 p-4 sm:p-5">
            <TitreSection titre={tx("courbe.titre")} className="mb-0" />
            <CourbeJours jours={r.courbe} />
            <Lecture>{tx("courbe.lecture")}</Lecture>
          </Carte>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Carte className="flex flex-col gap-3 p-4 sm:p-5">
              <TitreSection titre={tx("plateformes.titre")} className="mb-0" />
              {r.plateformes.total ? (
                <>
                  <p className="flex items-center gap-2 text-lg font-extrabold">
                    <Smartphone className="h-5 w-5 text-orange-fonce" />
                    {tx("plateformes.telephone", {
                      v: { n: Math.round(((r.plateformes.android_app + r.plateformes.installee + r.plateformes.mobile) / r.plateformes.total) * 100) },
                    })}
                  </p>
                  <BarrePlateformes p={r.plateformes} />
                </>
              ) : (
                <p className="text-sm text-texte-pale">{tx("plateformes.vide")}</p>
              )}
              <Lecture>{tx("plateformes.lecture")}</Lecture>
            </Carte>
            <TuilePart titre={tx("revenus.titre")} p={r.revenus} lecture={tx("revenus.lecture")} tx={tx} />
          </div>

          <Carte className="flex flex-col gap-3 p-4 sm:p-5">
            <TitreSection titre={tx("retour.titre")} className="mb-0" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[20rem] text-left text-sm tabular-nums">
                <thead className="font-mono text-[11px] uppercase text-texte-gris">
                  <tr>
                    <th className="py-1.5 pr-2 font-normal">{tx("retour.semaine")}</th>
                    <th className="px-2 py-1.5 font-normal">{tx("retour.inscrits")}</th>
                    <th className="px-2 py-1.5 font-normal">{tx("retour.venus")}</th>
                    <th className="px-2 py-1.5 font-normal">{tx("retour.j1")}</th>
                    <th className="px-2 py-1.5 font-normal">{tx("retour.j7")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.cohortes.map((c) => (
                    <tr key={c.lundi} className="border-t border-ligne-douce">
                      <td className="py-2 pr-2 font-bold">{jourCourt(c.lundi)}</td>
                      <td className="px-2 py-2">{c.inscrits}</td>
                      <td className="px-2 py-2">{c.venus}</td>
                      <td className="whitespace-nowrap px-2 py-2">{c.j1.taux === null ? "–" : `${c.partielle ? "≈ " : ""}${c.j1.taux} %`}</td>
                      <td className="whitespace-nowrap px-2 py-2">{c.j7.taux === null ? "–" : `${c.partielle ? "≈ " : ""}${c.j7.taux} %`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Lecture>{tx("retour.lecture")}</Lecture>
          </Carte>
        </Section>
      )}

      {d.directs && (
        <Section titre={tx("directs.titre")} id="directs">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Carte className="flex flex-col gap-3 p-4 sm:p-5">
              <TitreSection titre={tx("presence.titre")} className="mb-0" />
              <BarreTroisEtats e={d.directs.presence} />
              <div className="flex flex-col gap-1 text-sm">
                {d.directs.presence.tauxConnu !== null && <strong>{tx("presence.tauxConnu", { v: { n: d.directs.presence.tauxConnu } })}</strong>}
                {d.directs.presence.partInconnue !== null && d.directs.presence.partInconnue > 0 && (
                  <span className="flex items-center gap-1.5 text-alerte">
                    <TriangleAlert className="h-4 w-4" />
                    {tx("presence.partInconnue", { v: { n: d.directs.presence.partInconnue } })}
                  </span>
                )}
              </div>
              <Lecture>{tx("presence.lecture")}</Lecture>
            </Carte>
            <TuilePart
              titre={tx("suivi.titre")}
              p={d.directs.ontSuivi}
              lecture={tx("suivi.lecture")}
              tx={tx}
              alerte={d.directs.ontSuiviInconnue ? tx("suivi.inconnue", { v: { n: d.directs.ontSuiviInconnue } }) : null}
            />
          </div>

          <Carte className="flex flex-col gap-3 p-4 sm:p-5">
            <TitreSection titre={tx("emargement.titre")} className="mb-0" />
            {d.directs.emargement.length ? (
              <ul className="grid gap-x-8 lg:grid-cols-2">
                {d.directs.emargement.map((e) => (
                  <li key={e.siteId} className="flex flex-col gap-1.5 border-t border-ligne-douce py-3 first:border-t-0 lg:[&:nth-child(2)]:border-t-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-bold">{e.site}</span>
                      <span className={cn("shrink-0 text-lg font-black tabular-nums", e.emargees === 0 && "text-danger")}>{pc(e.taux)}</span>
                    </div>
                    <BarreProgression valeur={e.taux ?? 0} ton={e.taux !== null && e.taux >= 80 ? "succes" : "orange"} />
                    <div className="text-[13px] text-texte-gris">
                      {tx("emargement.seances", { v: { e: e.emargees, n: e.seances } })}
                      {e.incidents > 0 && ` · ${tx("emargement.incidents", { v: { n: e.incidents } })}`}
                      {e.emarges.taux !== null && ` · ${tx("emargement.emarges", { v: { n: e.emarges.taux } })}`}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-texte-pale">{tx("entonnoir.aucune")}</p>
            )}
            <Lecture>{tx("emargement.lecture")}</Lecture>
          </Carte>

          <div className="flex flex-col gap-3">
            <TitreSection titre={tx("entonnoir.titre")} className="mb-0" />
            <Lecture>{tx("entonnoir.lecture")}</Lecture>
            {d.directs.seances.length ? <ListeSeances d={d} /> : <p className="text-sm text-texte-pale">{tx("entonnoir.aucune")}</p>}
          </div>
        </Section>
      )}

      {d.travail && <BlocTravail d={d} tx={tx} />}
      {d.rappels && <BlocRappels d={d} tx={tx} />}
      <BlocCopies d={d} tx={tx} />
      {/* Correction automatique (8 octobre 2026) : son propre périmètre, hors filtres de la page. */}
      <BlocCorrections />
      <BlocAnomalies d={d} tx={tx} />
    </>
  );
}

function ListeSeances({ d }: { d: EngagementPilotage }) {
  const tx = useTextes(t);
  const [toutes, setToutes] = useState(false);
  const seances = d.directs?.seances ?? [];
  const visibles = toutes ? seances : seances.slice(0, 4);
  return (
    <>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {visibles.map((s) => (
          <EntonnoirDirect key={s.id} s={s} />
        ))}
      </div>
      {seances.length > 4 && !toutes && (
        <Bouton variante="doux" onClick={() => setToutes(true)} className="self-start">
          {tx("entonnoir.toutes", { v: { n: seances.length } })}
        </Bouton>
      )}
    </>
  );
}

function BlocTravail({ d, tx }: { d: EngagementPilotage; tx: Tx }) {
  const w = d.travail!;
  const ligne = (l: LigneTravail) => (
    <LignePart
      key={l.cle}
      libelle={tx(`travail.${l.cle}`)}
      p={l.rendus}
      tx={tx}
      detail={
        !l.devoirs
          ? tx("travail.aucunDevoir")
          : [l.commences !== null ? tx("travail.commences", { v: { n: l.commences } }) : null, l.ouverts ? tx("travail.ouverts", { v: { n: l.ouverts } }) : null]
              .filter(Boolean)
              .join(" · ") || undefined
      }
    />
  );
  // Les blocs des autres chantiers : une tuile s'ils sont mesurés, sinon leur nom dans « pas encore mesuré ».
  const tuiles: ReactNode[] = [];
  const absents: string[] = [];
  if (w.revision)
    tuiles.push(
      <Carte key="revision" className="flex flex-col gap-2 p-4">
        <div className="font-mono text-xs uppercase tracking-wider text-texte-gris">{tx("revision.titre")}</div>
        <ValeurPart p={w.revision.reviseurs7j} tx={tx} grand />
        <Lecture>
          {tx("revision.reviseurs")}
          {w.revision.reponsesParReviseur !== null && ` · ${tx("revision.reponses", { v: { n: virgule(w.revision.reponsesParReviseur) } })}`}
          {w.revision.boite3 && w.revision.boite3.taux !== null && ` · ${tx("revision.boite3", { v: { n: w.revision.boite3.taux } })}`}
        </Lecture>
      </Carte>,
    );
  else absents.push(tx("revision.titre"));
  for (const [cle, p] of [
    ["coursComplets", w.coursComplets],
    ["objectifs", w.objectifs?.valides ?? null],
    ["semainesActives", w.semainesActives],
  ] as const) {
    if (p) tuiles.push(<TuilePart key={cle} titre={tx(`${cle}.titre`)} p={p} lecture={tx(`${cle}.lecture`)} tx={tx} />);
    else absents.push(tx(`${cle}.titre`));
  }
  if (!w.coupe) absents.push(tx("coupe.titre"));
  return (
    <Section titre={tx("travail.titre")} id="travail">
      <Carte className="flex flex-col gap-1 p-4 sm:p-5">
        <ul>{w.lignes.map(ligne)}</ul>
        <Lecture>{tx("travail.lecture")}</Lecture>
      </Carte>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TuilePart titre={tx("replays.absents")} p={w.replaysAbsents} lecture={tx("replays.absents.lecture")} tx={tx} />
        <TuilePart titre={tx("replays.inconnus")} p={w.replaysInconnus} lecture={tx("replays.inconnus.lecture")} tx={tx} />
      </div>
      {tuiles.length > 0 && <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">{tuiles}</div>}
      {w.coupe && (
        <Carte className="flex flex-col gap-2 p-4 sm:p-5">
          <TitreSection titre={tx("coupe.titre")} className="mb-0" />
          <TableCoupe coupe={w.coupe} />
          <Lecture>{tx("coupe.lecture")}</Lecture>
        </Carte>
      )}
      <PasEncoreMesure titres={absents} />
    </Section>
  );
}

function TableCoupe({ coupe }: { coupe: NonNullable<NonNullable<EngagementPilotage["travail"]>["coupe"]> }) {
  const tx = useTextes(t);
  const semaines = [...new Set(coupe.map((c) => c.semaine))].sort();
  const campus = [...new Map(coupe.map((c) => [c.cibleId, c.nom])).entries()];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm tabular-nums">
        <thead className="font-mono text-[11px] uppercase text-texte-gris">
          <tr>
            <th className="py-1.5 pr-2 font-normal">{tx("csv.campus")}</th>
            {semaines.map((s) => (
              <th key={s} className="px-2 py-1.5 font-normal">
                {s.slice(5)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campus.map(([id, nom]) => (
            <tr key={id} className="border-t border-ligne-douce">
              <td className="py-1.5 pr-2 font-bold">{nom}</td>
              {semaines.map((s) => (
                <td key={s} className="px-2 py-1.5">
                  {pc(coupe.find((c) => c.cibleId === id && c.semaine === s)?.tauxParticipation)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableEnvois({ lignes, tx }: { lignes: LigneEnvois[]; tx: Tx }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-left text-sm tabular-nums">
        <thead className="font-mono text-[11px] uppercase text-texte-gris">
          <tr>
            {(["envois.cle", "envois.total", "envois.envoyes", "envois.differes", "envois.bloques", "envois.echecs", "envois.ouverts"] as const).map((c) => (
              <th key={c} className="px-2 py-1.5 font-normal first:pl-0">
                {tx(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.cle} className="border-t border-ligne-douce">
              <td className="py-1.5 pr-2 font-bold">{l.cle}</td>
              <td className="px-2 py-1.5">{l.total}</td>
              <td className="px-2 py-1.5">{l.envoyes}</td>
              <td className="px-2 py-1.5">{l.differes}</td>
              <td className="px-2 py-1.5">{l.bloques}</td>
              <td className="px-2 py-1.5">{l.echecs}</td>
              <td className="px-2 py-1.5">{pc(l.ouverts.taux)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlocRappels({ d, tx }: { d: EngagementPilotage; tx: Tx }) {
  const r = d.rappels!;
  // Ce qui dépend des rappels vérifiés (C3) et des relances (C4) : « pas encore mesuré » tant qu'ils ne sont pas en ligne.
  const absents = [
    !r.essaiRecu && tx("joignables.essai"),
    !r.parMarque && tx("joignables.parMarque"),
    !r.envois && tx("envois.titre"),
    !r.effetRappel && tx("effet.titre"),
    !r.relances && tx("relances.titre"),
  ].filter((x): x is string => Boolean(x));
  return (
    <Section titre={tx("rappels.titre")} id="rappels">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <TuilePart titre={tx("joignables.abonnes")} p={r.abonnes} lecture={tx("joignables.abonnes.lecture")} tx={tx} />
        {r.essaiRecu && <TuilePart titre={tx("joignables.essai")} p={r.essaiRecu} lecture={tx("joignables.essai.lecture")} tx={tx} />}
        <TuilePart titre={tx("joignables.email")} p={r.email} lecture={tx("joignables.email.lecture")} tx={tx} />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Carte className="flex flex-col gap-1 p-4 sm:p-5">
          <TitreSection titre={tx("joignables.parCampus")} className="mb-0" />
          <ul>
            {r.parCampus.map((c) => (
              <LignePart key={c.site} libelle={`${c.site} · ${c.inscrits}`} p={c.abonnes} tx={tx} detail={`${tx("joignables.email")} ${pc(c.email.taux)}`} />
            ))}
          </ul>
        </Carte>
        {r.parMarque && (
          <Carte className="flex flex-col gap-2 p-4 sm:p-5">
            <TitreSection titre={tx("joignables.parMarque")} className="mb-0" />
            <ul className="flex flex-wrap gap-2">
              {r.parMarque.map((m) => (
                <li key={m.marque}>
                  <Badge ton="gris">
                    {m.marque} · {m.n}
                  </Badge>
                </li>
              ))}
            </ul>
          </Carte>
        )}
      </div>
      {r.envois && (
        <Carte className="flex flex-col gap-3 p-4 sm:p-5">
          <TitreSection titre={tx("envois.titre")} className="mb-0" />
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-texte-gris">{tx("envois.parPriorite")}</h3>
          <TableEnvois lignes={r.envois.parPriorite} tx={tx} />
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-texte-gris">{tx("envois.parType")}</h3>
          <TableEnvois lignes={r.envois.parType} tx={tx} />
          <Lecture>{tx("envois.lecture")}</Lecture>
        </Carte>
      )}
      {(r.effetRappel || r.relances) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {r.effetRappel && (
            <Carte className="flex flex-col gap-2 p-4 sm:p-5">
              <TitreSection titre={tx("effet.titre")} className="mb-0" />
              <ul>
                <LignePart libelle={tx("effet.avec")} p={r.effetRappel.avecRappel} tx={tx} />
                <LignePart libelle={tx("effet.sans")} p={r.effetRappel.sansRappel} tx={tx} />
              </ul>
              {r.effetRappel.ecartPoints !== null && <strong>{tx("effet.ecart", { v: { n: r.effetRappel.ecartPoints } })}</strong>}
              <Lecture>{tx("effet.lecture")}</Lecture>
            </Carte>
          )}
          {r.relances && (
            <Carte className="flex flex-col gap-2 p-4 sm:p-5">
              <TitreSection titre={tx("relances.titre")} className="mb-0" />
              <p className="font-bold">{tx("relances.envoyees", { v: { n: r.relances.envoyees } })}</p>
              <ul>
                <LignePart libelle={tx("relances.revenus")} p={r.relances.revenus48h} tx={tx} />
              </ul>
              <p className="text-sm">
                {tx("relances.aAppeler", { v: { n: r.relances.aAppeler } })} ·{" "}
                <Link href="/pilotage/suivi" className="font-bold">
                  {tx("relances.lien")}
                </Link>
              </p>
              <Lecture>{tx("relances.lecture")}</Lecture>
            </Carte>
          )}
        </div>
      )}
      <PasEncoreMesure titres={absents} />
    </Section>
  );
}

function BlocCopies({ d, tx }: { d: EngagementPilotage; tx: Tx }) {
  return (
    <Section titre={tx("copies.titre")} id="copies">
      <Carte className="flex flex-col gap-3 p-4 sm:p-5">
        {d.copies.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] tabular-nums sm:text-sm">
              <thead className="font-mono text-[11px] uppercase text-texte-gris">
                <tr>
                  <th className="py-1.5 pr-2 font-normal">{tx("copies.formateur")}</th>
                  <th className="px-2 py-1.5 font-normal">{tx("copies.enAttente")}</th>
                  <th className="px-2 py-1.5 font-normal">{tx("copies.plusAncienne")}</th>
                  <th className="px-2 py-1.5 font-normal">{tx("copies.auDela72h")}</th>
                  <th className="px-2 py-1.5 font-normal">{tx("copies.delai")}</th>
                </tr>
              </thead>
              <tbody>
                {d.copies.map((c) => (
                  <tr key={c.formateurId ?? 0} className="border-t border-ligne-douce">
                    <td className="py-2 pr-2 font-bold">{c.nom}</td>
                    <td className="px-2 py-2">{c.enAttente}</td>
                    <td className="px-2 py-2">{c.plusAncienneJours === null ? "–" : tx("copies.joursAge", { v: { n: c.plusAncienneJours } })}</td>
                    <td className={cn("px-2 py-2", c.auDela72h > 0 && "font-bold text-danger")}>{c.auDela72h}</td>
                    <td className="px-2 py-2">{c.delaiMedianHeures === null ? "–" : tx("copies.heures", { v: { n: c.delaiMedianHeures } })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-texte-pale">{tx("copies.aucune")}</p>
        )}
        <Lecture>{tx("copies.lecture")}</Lecture>
      </Carte>
      {/* Exercices automatiques (D2) : comptés à part, sans retard ni délai cible, jamais reprochés au formateur. */}
      {d.copiesAutomatiques && (d.copiesAutomatiques.enAttente > 0 || d.copiesAutomatiques.corrigees > 0) && (
        <Carte className="flex flex-col gap-1.5 p-4 sm:p-5">
          <h3 className="font-bold text-encre">{tx("copies.auto.titre")}</h3>
          <p className="text-sm text-texte-doux">
            {selonNombre(tx, "copies.auto.attente", d.copiesAutomatiques.enAttente)} · {selonNombre(tx, "copies.auto.corrigees", d.copiesAutomatiques.corrigees)}
          </p>
          <Lecture>{tx("copies.auto.lecture")}</Lecture>
        </Carte>
      )}
    </Section>
  );
}

function BlocAnomalies({ d, tx }: { d: EngagementPilotage; tx: Tx }) {
  const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Abidjan" });
  return (
    <Section titre={tx("anomalies.titre")} id="anomalies">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Carte className="flex flex-col gap-2 p-4 sm:p-5">
          <TitreSection titre={tx("malDatees.titre")} className="mb-0" />
          {d.seancesMalDatees.length ? (
            <ul>
              {d.seancesMalDatees.map((s) => (
                <li key={s.id} className="border-t border-ligne-douce py-2 first:border-t-0">
                  <Link href={`/pilotage/presences?seance=${s.id}`} className="font-bold text-encre">
                    #{s.id} · {s.coursCode} · {s.titre}
                  </Link>
                  <div className="text-[13px] text-texte-pale">
                    {tx("malDatees.ligne", { v: { prevue: fmt.format(new Date(s.prevueLe)), tenue: fmt.format(new Date(s.tenueLe)) } })}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-texte-pale">{tx("malDatees.aucune")}</p>
          )}
          <Lecture>{tx("malDatees.lecture")}</Lecture>
        </Carte>
        <Carte className="flex flex-col gap-2 p-4 sm:p-5">
          <TitreSection titre={tx("ratees.titre")} className="mb-0" />
          {d.questionsRatees.length ? (
            <ul>
              {d.questionsRatees.map((q, i) => (
                <li key={`${q.seanceId}-${i}`} className="border-t border-ligne-douce py-2 first:border-t-0">
                  <div className="font-mono text-[11px] text-texte-gris">
                    {q.coursCode} · {q.seanceTitre}
                    {q.origine === "revision" && ` · ${tx("ratees.revision")}`}
                  </div>
                  <div className="text-sm font-bold text-encre">{q.enonce}</div>
                  <div className={cn("text-[13px]", q.tauxErreur > 70 ? "font-bold text-danger" : "text-texte-pale")}>
                    {tx("ratees.erreurs", { v: { n: q.tauxErreur, sur: q.reponses } })}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-texte-pale">{tx("ratees.aucune")}</p>
          )}
          <Lecture>{tx("ratees.lecture")}</Lecture>
        </Carte>
      </div>
    </Section>
  );
}
