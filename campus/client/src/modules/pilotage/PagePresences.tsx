// /pilotage/presences : les présences par séance (campus par campus, avec
// l'effectif déclaré par la salle) et par étudiant ; justifier une absence ;
// exporter pour Excel. Règle unique : présent en ligne à partir de 70 % de
// la durée ; absences justifiées et incidents de salle ne comptent pas.
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, ArrowLeft, Search, TriangleAlert, BarChart3, Zap } from "lucide-react";
import type { ListePresences, PresencesSeance, PresencesDEtudiant, PageComptes, StatutPresencePilotage, PresencesCampus, ResumePresences } from "@shared/schema";
import { LIBELLES_PRESENCE_PILOTAGE, comptePresent } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Badge, Chargement, Erreur, EtatVide, BarreProgression } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Onglets } from "@/components/ui/onglets";
import { dateEtHeure, jourLong, heure } from "@/lib/dates";
import { cn, pluriel } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { FenetreJustifier, type CibleJustification } from "./composants/FenetreJustifier";
import { TON_PRESENCE, pourcent, lundiIso, decalerSemaine, libelleSemaine } from "./outils";

type Vue = "seances" | "etudiants";

export default function PagePresences() {
  const recherche = new URLSearchParams(useSearch());
  const [, naviguer] = useLocation();
  const seanceId = recherche.get("seance");
  const etudiantId = recherche.get("etudiant");
  const [vue, setVue] = useState<Vue>(etudiantId ? "etudiants" : "seances");
  const [justifier, setJustifier] = useState<CibleJustification | null>(null);

  if (seanceId)
    return (
      <Page>
        <SousNav />
        <DetailSeance id={seanceId} onRetour={() => naviguer("/pilotage/presences")} onJustifier={setJustifier} />
        <FenetreJustifier cible={justifier} onFermer={() => setJustifier(null)} />
      </Page>
    );

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette="Pilotage · Présences"
        titre="Présences"
        sousTitre="Émargement en salle, pointage du responsable et présence en ligne (70 % de la durée au moins), réunis sur une seule feuille par séance."
      />
      <Onglets<Vue>
        valeur={vue}
        onChange={(v) => {
          setVue(v);
          naviguer("/pilotage/presences", { replace: true });
        }}
        options={[
          { valeur: "seances", libelle: "Par séance" },
          { valeur: "etudiants", libelle: "Par étudiant" },
        ]}
        className="self-start"
      />
      {vue === "seances" ? <ListeSeances /> : <ParEtudiant etudiantId={etudiantId} onJustifier={setJustifier} />}
      <FenetreJustifier cible={justifier} onFermer={() => setJustifier(null)} />
    </Page>
  );
}

// ── Par séance ─────────────────────────────────────────────────────────────

function ListeSeances() {
  const [semaine, setSemaine] = useState(lundiIso());
  const { data, isLoading, error, refetch } = useQuery<ListePresences>({ queryKey: [`/api/pilotage/presences?semaine=${semaine}`] });
  return (
    <section className="flex flex-col gap-4">
      <NavSemaine semaine={semaine} onChange={setSemaine} />
      {isLoading ? (
        <Chargement lignes={3} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => refetch()} />
      ) : !data?.seances.length ? (
        <EtatVide
          icone={<BarChart3 className="h-6 w-6" />}
          titre="Aucun live passé cette semaine."
          texte="Les feuilles de présence apparaissent ici dès qu'une séance commence. Changez de semaine avec les flèches."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.seances.map((s) => (
            <li key={s.id}>
              <Link href={`/pilotage/presences?seance=${s.id}`} className="block rounded-2xl border border-ligne bg-white p-5 text-encre no-underline transition-colors hover:border-orange hover:text-encre">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-texte-gris">
                      {s.coursCode} · {jourLong(s.debut)} · {heure(s.debut)}
                    </div>
                    <div className="mt-1 text-lg font-extrabold leading-snug">{s.titre}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black">{pourcent(s.resume.taux)}</div>
                    <div className="text-xs text-texte-gris">présents</div>
                  </div>
                </div>
                {s.statut === "en_direct" && (
                  <Badge ton="direct" className="mt-2">
                    En direct : chiffres provisoires
                  </Badge>
                )}
                <Decompte r={s.resume} className="mt-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Decompte({ r, className }: { r: ResumePresences; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      <Badge ton="succes">{pluriel(r.presents, "présent")}</Badge>
      {r.partiel > 0 && <Badge ton="alerte">{pluriel(r.partiel, "partiel")}</Badge>}
      <Badge ton={r.absent ? "danger" : "gris"}>{pluriel(r.absent, "absent")}</Badge>
      {r.justifie > 0 && <Badge ton="gris">{pluriel(r.justifie, "justifié")}</Badge>}
      {r.incident > 0 && <Badge ton="encre">{pluriel(r.incident, "incident")}</Badge>}
      <Badge ton="gris">{pluriel(r.attendus, "attendu")}</Badge>
    </div>
  );
}

function NavSemaine({ semaine, onChange }: { semaine: string; onChange: (s: string) => void }) {
  const courante = lundiIso();
  return (
    <div className="flex items-center gap-2">
      <Bouton variante="contour" taille="icone" aria-label="Semaine précédente" onClick={() => onChange(decalerSemaine(semaine, -1))} className="h-12 w-12">
        <ChevronLeft className="h-5 w-5" />
      </Bouton>
      <div className="min-w-0 flex-1 text-center font-extrabold sm:flex-none sm:px-3">{libelleSemaine(semaine)}</div>
      <Bouton variante="contour" taille="icone" aria-label="Semaine suivante" onClick={() => onChange(decalerSemaine(semaine, 1))} className="h-12 w-12">
        <ChevronRight className="h-5 w-5" />
      </Bouton>
      {semaine !== courante && (
        <Bouton variante="doux" taille="sm" onClick={() => onChange(courante)} className="min-h-[48px]">
          Cette semaine
        </Bouton>
      )}
    </div>
  );
}

type FiltreStatut = "tous" | "absents" | "partiels" | "presents" | "justifies";

function DetailSeance({ id, onRetour, onJustifier }: { id: string; onRetour: () => void; onJustifier: (c: CibleJustification) => void }) {
  const { data: d, isLoading, error, refetch } = useQuery<PresencesSeance>({ queryKey: [`/api/pilotage/presences/seance/${id}`] });
  const [filtre, setFiltre] = useState<FiltreStatut>("tous");
  if (isLoading) return <Chargement lignes={4} />;
  if (error || !d) return <Erreur message={(error as Error)?.message ?? "Séance introuvable."} reessayer={() => refetch()} />;

  const garde = (s: StatutPresencePilotage) =>
    filtre === "tous" ||
    (filtre === "absents" && s === "absent") ||
    (filtre === "partiels" && s === "partiel") ||
    (filtre === "presents" && comptePresent(s)) ||
    (filtre === "justifies" && (s === "justifie" || s === "incident"));

  return (
    <>
      <button type="button" onClick={onRetour} className="-mb-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-sm font-bold text-texte-pale hover:text-encre">
        <ArrowLeft className="h-4 w-4" /> Toutes les séances
      </button>
      <EnTetePage
        etiquette={`${d.seance.coursCode} · ${d.seance.formateur ?? "formateur à confirmer"}`}
        titre={d.seance.titre}
        sousTitre={dateEtHeure(d.seance.debut)}
        actions={
          !d.aVenir && !d.nonTenue && d.total.attendus > 0 ? (
            <a
              href={`/api/pilotage/presences/seance/${d.seance.id}/export`}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-orange px-5 font-bold text-encre no-underline hover:bg-encre hover:text-white"
              download
            >
              <Download className="h-4 w-4" /> Exporter pour Excel
            </a>
          ) : undefined
        }
      />
      {d.aVenir ? (
        <EtatVide titre="Cette séance n'a pas encore eu lieu." texte={`${pluriel(d.total.attendus, "étudiant attendu", "étudiants attendus")}. La feuille se remplira pendant le live : émargement en salle et présence en ligne.`} />
      ) : d.nonTenue ? (
        <EtatVide
          titre="Cette séance n'a jamais démarré."
          texte="Personne n'y est compté absent : elle n'entre ni dans les taux de présence, ni dans « À contacter », ni dans les dossiers et relevés des étudiants."
        />
      ) : (
        <>
          <Carte className="flex flex-col gap-3 bg-creme">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <div className="text-5xl font-black tracking-serre">{pourcent(d.total.taux)}</div>
                <div className="text-sm text-texte-pale">de présence, tous campus de votre périmètre</div>
              </div>
              <Decompte r={d.total} />
            </div>
            <p className="text-sm text-texte-pale">
              Présent en ligne à partir de {Math.round(d.seuil * 100)} % de {d.dureeReference} min, soit {d.seuilMinutes} min. Les absences justifiées et les incidents de salle ne comptent pas dans le taux.
            </p>
          </Carte>
          <Onglets<FiltreStatut>
            valeur={filtre}
            onChange={setFiltre}
            options={[
              { valeur: "tous", libelle: "Tous", compteur: d.total.attendus },
              { valeur: "absents", libelle: "Absents", compteur: d.total.absent },
              { valeur: "partiels", libelle: "Partiels", compteur: d.total.partiel },
              { valeur: "presents", libelle: "Présents", compteur: d.total.presents },
              { valeur: "justifies", libelle: "Justifiés", compteur: d.total.justifie + d.total.incident },
            ]}
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {d.campus.map((c) => (
              <BlocCampus key={c.siteId ?? "aucun"} c={c} garde={garde} onJustifier={(e) => onJustifier({ seanceId: d.seance.id, seanceTitre: d.seance.titre, etudiantId: e.id, nom: `${e.prenom} ${e.nom}`, justification: e.justification })} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function BlocCampus({ c, garde, onJustifier }: { c: PresencesCampus; garde: (s: StatutPresencePilotage) => boolean; onJustifier: (e: PresencesCampus["etudiants"][number]) => void }) {
  const visibles = c.etudiants.filter((e) => garde(e.statut));
  return (
    <section className="rounded-2xl border border-ligne bg-white">
      <header className="flex flex-col gap-2 border-b border-ligne-douce p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-extrabold">{c.site}</h2>
          <span className="text-2xl font-black">{pourcent(c.taux)}</span>
        </div>
        <BarreProgression valeur={c.taux ?? 0} ton={c.taux !== null && c.taux >= 80 ? "succes" : "orange"} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-texte-pale">
          <span>Émargés : <strong className="text-encre">{c.emarge}</strong></span>
          <span>Pointés : <strong className="text-encre">{c.pointe}</strong></span>
          <span>En ligne : <strong className="text-encre">{c.en_ligne}</strong></span>
          {c.effectifDeclare !== null && <span>Effectif déclaré en salle : <strong className="text-encre">{c.effectifDeclare}</strong></span>}
        </div>
        {c.salle?.incident && (
          <p className="flex items-start gap-2 rounded-xl bg-encre px-3 py-2 text-sm text-white">
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-orange" /> Incident signalé par la salle : {c.salle.incident}. Personne n'y est compté absent.
          </p>
        )}
        {c.ecart !== null && c.ecart !== 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-alerte-clair px-3 py-2 text-sm text-alerte">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {c.ecart > 0
              ? `${c.emarge + c.pointe} présents validés en salle pour ${c.effectifDeclare} comptés par le responsable : vérifiez qu'aucun code n'a circulé.`
              : `${c.effectifDeclare} comptés en salle mais ${c.emarge + c.pointe} validés : ${Math.abs(c.ecart)} à pointer à la main.`}
          </p>
        )}
      </header>
      {!visibles.length ? (
        <p className="p-5 text-[15px] text-texte-pale">Personne dans ce filtre pour {c.site}.</p>
      ) : (
        <ul className="divide-y divide-ligne-douce">
          {visibles.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
              <div className="min-w-[10rem] flex-1">
                <Link href={`/pilotage/etudiants/${e.id}`} className="font-bold text-encre no-underline hover:text-orange-fonce">
                  {e.prenom} {e.nom}
                </Link>
                <div className="text-[13px] text-texte-gris">
                  {[
                    e.matricule,
                    e.arriveeLe ? `arrivée${e.retard ? " en retard" : ""} : ${heure(e.arriveeLe)}` : null,
                    e.minutes ? `${e.minutes} min en ligne` : null,
                    e.justification ? `« ${e.justification} »` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <Badge ton={TON_PRESENCE[e.statut]}>{LIBELLES_PRESENCE_PILOTAGE[e.statut]}</Badge>
              {(e.statut === "absent" || e.statut === "partiel" || e.statut === "justifie") && (
                <button type="button" onClick={() => onJustifier(e)} className="min-h-[48px] px-1 text-sm font-bold text-orange-fonce hover:text-encre">
                  {e.justification ? "Modifier" : "Justifier"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Par étudiant ───────────────────────────────────────────────────────────

function ParEtudiant({ etudiantId, onJustifier }: { etudiantId: string | null; onJustifier: (c: CibleJustification) => void }) {
  const [, naviguer] = useLocation();
  const [q, setQ] = useState("");
  const [qDiffere, setQDiffere] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQDiffere(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const recherche = useQuery<PageComptes>({
    queryKey: [`/api/pilotage/comptes?role=etudiant&parPage=8&q=${encodeURIComponent(qDiffere)}`],
    enabled: qDiffere.length >= 2,
  });
  const detail = useQuery<PresencesDEtudiant>({ queryKey: [`/api/pilotage/presences/etudiant/${etudiantId}`], enabled: Boolean(etudiantId) });
  const d = detail.data;
  const lignes = useMemo(() => d?.seances ?? [], [d]);

  return (
    <section className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom ou matricule de l'étudiant"
          aria-label="Chercher un étudiant"
          className="min-h-[52px] w-full rounded-xl border border-ligne bg-white pl-12 pr-4 text-base outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
        />
      </div>
      {qDiffere.length >= 2 && recherche.data && (
        <ul className="flex flex-wrap gap-2">
          {recherche.data.lignes.length ? (
            recherche.data.lignes.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    naviguer(`/pilotage/presences?etudiant=${c.id}`, { replace: true });
                  }}
                  className={cn("min-h-[48px] rounded-full border px-4 text-sm font-bold", String(c.id) === etudiantId ? "border-encre bg-encre text-white" : "border-ligne bg-white hover:border-orange")}
                >
                  {c.prenom} {c.nom} <span className="font-mono font-normal text-texte-gris">{c.matricule}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="text-sm text-texte-pale">Aucun étudiant ne correspond.</li>
          )}
        </ul>
      )}
      {!etudiantId ? (
        <EtatVide icone={<Search className="h-6 w-6" />} titre="Cherchez un étudiant." texte="Vous verrez toutes ses séances de l'année, avec le statut de chacune, et pourrez justifier une absence." />
      ) : detail.isLoading ? (
        <Chargement lignes={3} />
      ) : detail.error || !d ? (
        <Erreur message={(detail.error as Error)?.message ?? "Étudiant introuvable."} />
      ) : (
        <Carte className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Link href={`/pilotage/etudiants/${d.etudiant.id}`} className="text-2xl font-black text-encre no-underline hover:text-orange-fonce">
                {d.etudiant.prenom} {d.etudiant.nom}
              </Link>
              <div className="text-sm text-texte-pale">{[d.etudiant.matricule, d.etudiant.classe].filter(Boolean).join(" · ")}</div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black">{pourcent(d.resume.taux)}</div>
              <div className="text-xs text-texte-gris">de présence sur l'année</div>
            </div>
          </div>
          <Decompte r={d.resume} />
          {!lignes.length ? (
            <p className="text-[15px] text-texte-pale">Aucune séance passée pour ses cours.</p>
          ) : (
            <ul className="divide-y divide-ligne-douce">
              {lignes.map((s) => (
                <li key={s.seanceId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                  <div className="min-w-[10rem] flex-1">
                    <Link href={`/pilotage/presences?seance=${s.seanceId}`} className="font-semibold text-encre no-underline hover:text-orange-fonce">
                      {s.titre}
                    </Link>
                    <div className="text-[13px] text-texte-gris">
                      {s.coursCode} · {jourLong(s.debut)} · {heure(s.debut)}
                      {s.minutes ? ` · ${s.minutes} min en ligne` : ""}
                      {s.justification ? ` · « ${s.justification} »` : ""}
                    </div>
                  </div>
                  <Badge ton={TON_PRESENCE[s.statut]}>{LIBELLES_PRESENCE_PILOTAGE[s.statut]}</Badge>
                  {(s.statut === "absent" || s.statut === "partiel" || s.statut === "justifie") && (
                    <button
                      type="button"
                      onClick={() => onJustifier({ seanceId: s.seanceId, seanceTitre: s.titre, etudiantId: d.etudiant.id, nom: `${d.etudiant.prenom} ${d.etudiant.nom}`, justification: s.justification })}
                      className="min-h-[48px] px-1 text-sm font-bold text-orange-fonce hover:text-encre"
                    >
                      {s.justification ? "Modifier" : "Justifier"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Carte>
      )}
    </section>
  );
}
