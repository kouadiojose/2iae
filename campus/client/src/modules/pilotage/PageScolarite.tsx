// /pilotage/scolarite : l'argent de la scolarité, en trois onglets.
// - Suivi des paiements : chiffres clés et retards à relancer (WhatsApp prêt).
// - Caisse : encaissements du mois par moyen, derniers versements (reçus) et
//   journal de caisse à télécharger pour Excel.
// - Frais par classe : l'échéancier modèle copié à chaque nouvel étudiant.
// Filtres campus et classe communs ; tout l'état est dans l'adresse
// (?onglet=suivi|caisse|frais&site=&classe=).
import { useState, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Download, FolderOpen, Info, ReceiptText, TriangleAlert, Wallet } from "lucide-react";
import type { FraisClasseLigne, ListeFraisClasses, LigneRetard, TableauScolarite } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Badge, BarreProgression, Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { Carte, TitreSection } from "@/components/ui/carte";
import { Champ, Selection } from "@/components/ui/champs";
import { Onglets } from "@/components/ui/onglets";
import { toastErreur } from "@/components/ui/toast";
import { cn, pluriel } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { FenetreFraisClasse, appliquerFraisClasse } from "./composants/ScolariteFraisClasse";
import { LienWhatsApp, classeEtCampus, classeSansCampus, moisDe } from "./composants/ScolariteElements";
import { useReferences, pourcent } from "./outils";
import { fcfa, montant, aujourdhui, jourCourt, libelleMoyen } from "./outils-crm";

type Onglet = "suivi" | "caisse" | "frais";
const ONGLETS: Onglet[] = ["suivi", "caisse", "frais"];

export default function PageScolarite() {
  const recherche = new URLSearchParams(useSearch());
  const [, naviguer] = useLocation();
  const refs = useReferences();
  const brut = recherche.get("onglet") as Onglet | null;
  const onglet: Onglet = brut && ONGLETS.includes(brut) ? brut : "suivi";
  const site = recherche.get("site") ?? "";
  const classe = recherche.get("classe") ?? "";

  const aller = (maj: { onglet?: Onglet; site?: string; classe?: string }) => {
    const p = new URLSearchParams();
    p.set("onglet", maj.onglet ?? onglet);
    const s = maj.site ?? site;
    const c = maj.classe ?? classe;
    if (s) p.set("site", s);
    if (c) p.set("classe", c);
    naviguer(`/pilotage/scolarite?${p}`, { replace: true });
  };

  const filtres = new URLSearchParams();
  if (site) filtres.set("site", site);
  if (classe) filtres.set("classe", classe);
  const qs = filtres.toString();
  const { data, isLoading, error, refetch, isFetching } = useQuery<TableauScolarite>({ queryKey: [`/api/pilotage/scolarite${qs ? `?${qs}` : ""}`] });

  const classesVisibles = (refs.data?.classes ?? []).filter((c) => !site || String(c.siteId) === site);

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette="Pilotage · Scolarité"
        titre="Scolarité"
        sousTitre="Les frais de chaque classe, les versements encaissés avec leur reçu, et les retards de paiement à relancer."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Onglets<Onglet>
          valeur={onglet}
          onChange={(o) => aller({ onglet: o })}
          options={[
            { valeur: "suivi", libelle: "Suivi des paiements", compteur: data?.indicateurs.etudiantsEnRetard },
            { valeur: "caisse", libelle: "Caisse" },
            { valeur: "frais", libelle: "Frais par classe" },
          ]}
          className="self-start"
        />
        <div className={cn("grid grid-cols-1 gap-2", refs.data?.toutLeGroupe ? "sm:grid-cols-2 lg:w-[32rem]" : "sm:w-72")}>
          {refs.data?.toutLeGroupe && (
            <Selection aria-label="Campus" value={site} onChange={(e) => aller({ site: e.target.value, classe: "" })}>
              <option value="">Tous les campus</option>
              {refs.data.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nomCourt}
                </option>
              ))}
            </Selection>
          )}
          <Selection aria-label="Classe" value={classe} onChange={(e) => aller({ classe: e.target.value })}>
            <option value="">Toutes les classes</option>
            {classesVisibles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </Selection>
        </div>
      </div>

      {onglet === "frais" ? (
        <OngletFrais site={site} classe={classe} />
      ) : isLoading ? (
        <Chargement lignes={4} />
      ) : error || !data ? (
        <Erreur message={(error as Error | null)?.message ?? "Tableau indisponible."} reessayer={() => void refetch()} />
      ) : (
        <div className={cn("flex flex-col gap-8 transition-opacity", isFetching && "opacity-70")}>
          {onglet === "suivi" ? <OngletSuivi data={data} onFrais={() => aller({ onglet: "frais" })} /> : <OngletCaisse data={data} site={site} classe={classe} />}
        </div>
      )}
    </Page>
  );
}

// ── Suivi des paiements ────────────────────────────────────────────────────

function Tuile({
  libelle,
  valeur,
  detail,
  ton = "encre",
  children,
}: {
  libelle: string;
  valeur: number;
  detail?: ReactNode;
  ton?: "encre" | "orange" | "danger" | "succes";
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-ligne bg-white p-4 sm:p-5">
      <div className="font-mono text-[11px] uppercase tracking-wider text-texte-gris">{libelle}</div>
      <div
        className={cn(
          "mt-2 break-words text-[22px] font-black leading-tight tabular-nums tracking-serre sm:text-[28px] xl:text-[32px]",
          ton === "orange" && "text-orange-fonce",
          ton === "danger" && "text-danger",
          ton === "succes" && "text-succes",
        )}
      >
        {montant(valeur)} <span className="whitespace-nowrap text-sm font-extrabold tracking-normal text-texte-gris">F CFA</span>
      </div>
      {detail && <div className="mt-1 text-sm text-texte-pale">{detail}</div>}
      {children}
    </div>
  );
}

function OngletSuivi({ data, onFrais }: { data: TableauScolarite; onFrais: () => void }) {
  const i = data.indicateurs;
  const taux = i.attendu > 0 ? Math.round((i.encaisse / i.attendu) * 100) : null;
  return (
    <>
      <section aria-label="Chiffres clés" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tuile libelle="Attendu" valeur={i.attendu} detail="Frais moins remises, pour l'année" />
        <Tuile libelle="Encaissé" valeur={i.encaisse} ton="succes" detail={taux === null ? "Rien d'attendu pour l'instant" : `${pourcent(taux)} de l'attendu`}>
          {taux !== null && <BarreProgression valeur={taux} ton="succes" className="mt-3" />}
        </Tuile>
        <Tuile libelle="Reste à encaisser" valeur={i.reste} ton="orange" detail="Échéances à venir et en retard" />
        <Tuile libelle="En retard" valeur={i.retard} ton={i.retard > 0 ? "danger" : "encre"} detail={i.etudiantsEnRetard ? `${pluriel(i.etudiantsEnRetard, "étudiant")} en retard` : "Aucun étudiant en retard"} />
        <Tuile libelle="Encaissé aujourd'hui" valeur={i.encaisseJour} />
        <Tuile libelle="Encaissé ce mois" valeur={i.encaisseMois} detail={moisDe(aujourdhui())} />
      </section>

      {i.etudiantsSansEcheancier > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl bg-alerte-clair p-4 text-alerte sm:flex-row sm:items-center sm:p-5">
          <TriangleAlert className="hidden h-6 w-6 shrink-0 sm:block" aria-hidden />
          <p className="flex-1 text-[15px] leading-relaxed">
            <strong>
              {i.etudiantsSansEcheancier > 1 ? `${i.etudiantsSansEcheancier} étudiants n'ont pas encore d'échéancier` : "1 étudiant n'a pas encore d'échéancier"}
            </strong>
            . Leurs frais ne comptent pas dans ces chiffres : saisissez les frais de leur classe, puis appliquez-les.
          </p>
          <Bouton variante="encre" onClick={onFrais} className="min-h-[48px] shrink-0">
            Voir les frais par classe
          </Bouton>
        </div>
      )}

      <section aria-labelledby="titre-retards" className="flex flex-col gap-3">
        <TitreSection
          titre={<span id="titre-retards">Retards de paiement</span>}
          action={data.retards.length ? <Badge ton="danger">{pluriel(data.retards.length, "étudiant")}</Badge> : undefined}
        />
        {!data.retards.length ? (
          <EtatVide
            icone={<CircleCheck className="h-6 w-6" />}
            titre="Aucun retard de paiement."
            texte="Les étudiants dont une échéance est dépassée et pas encore payée apparaîtront ici, du plus gros retard au plus petit."
          />
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
              {data.retards.map((r) => (
                <CarteRetard key={r.etudiant.id} r={r} />
              ))}
            </ul>
            <div className="hidden overflow-hidden rounded-2xl border border-ligne bg-white lg:block">
              <table className="w-full text-left text-[15px]">
                <thead className="border-b border-ligne bg-creme font-mono text-[11px] uppercase tracking-wider text-texte-gris">
                  <tr>
                    <th className="px-4 py-3 font-normal">Étudiant</th>
                    <th className="px-4 py-3 font-normal">Classe</th>
                    <th className="px-4 py-3 text-right font-normal">En retard</th>
                    <th className="px-4 py-3 text-right font-normal">Reste</th>
                    <th className="px-4 py-3 font-normal">Dernier versement</th>
                    <th className="px-4 py-3 font-normal">Contact</th>
                    <th className="px-4 py-3 font-normal">
                      <span className="sr-only">Relancer</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ligne-douce">
                  {data.retards.map((r) => (
                    <tr key={r.etudiant.id} className="align-middle">
                      <td className="px-4 py-3">
                        <Link href={`/pilotage/etudiants/${r.etudiant.id}?onglet=scolarite`} className="font-bold text-encre no-underline hover:text-orange-fonce">
                          {r.etudiant.prenom} {r.etudiant.nom}
                        </Link>
                        {r.etudiant.matricule && <div className="font-mono text-xs text-texte-gris">{r.etudiant.matricule}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-texte-doux">{classeEtCampus(r.classe, r.site) || "–"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-lg font-black tabular-nums text-danger">{montant(r.retard)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-texte-doux">{montant(r.reste)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-texte-doux">{r.dernierVersement ? jourCourt(r.dernierVersement) : "Aucun"}</td>
                      <td className="px-4 py-3 text-sm text-texte-doux">{r.contact ?? "–"}</td>
                      <td className="px-4 py-3 text-right">
                        {r.whatsapp ? (
                          <LienWhatsApp href={r.whatsapp} className="whitespace-nowrap">
                            Relancer sur WhatsApp
                          </LienWhatsApp>
                        ) : (
                          <span className="text-[13px] text-texte-gris">Pas de numéro</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-ligne-douce px-4 py-2.5 text-[13px] text-texte-gris">Montants en F CFA.</p>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function CarteRetard({ r }: { r: LigneRetard }) {
  const dossier = `/pilotage/etudiants/${r.etudiant.id}?onglet=scolarite`;
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={dossier} className="text-base font-bold leading-snug text-encre no-underline hover:text-orange-fonce">
            {r.etudiant.prenom} {r.etudiant.nom}
          </Link>
          <div className="mt-0.5 text-[13px] leading-snug text-texte-gris">{[r.etudiant.matricule, classeEtCampus(r.classe, r.site)].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[22px] font-black leading-none tabular-nums text-danger">{montant(r.retard)}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-texte-gris">F CFA en retard</div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 rounded-xl bg-creme px-3 py-2.5 text-sm">
        <div>
          <dt className="text-[12px] text-texte-gris">Reste à payer</dt>
          <dd className="font-bold tabular-nums">{fcfa(r.reste)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-texte-gris">Dernier versement</dt>
          <dd className="font-bold">{r.dernierVersement ? jourCourt(r.dernierVersement) : "Aucun"}</dd>
        </div>
      </dl>
      {r.contact && <p className="text-sm text-texte-pale">Contact : {r.contact}</p>}
      <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        {r.whatsapp ? (
          <LienWhatsApp href={r.whatsapp} className="min-h-[48px]">
            Relancer sur WhatsApp
          </LienWhatsApp>
        ) : (
          <span className="flex min-h-[48px] items-center justify-center rounded-xl bg-creme px-3 text-center text-[13px] font-semibold text-texte-gris">Pas de numéro WhatsApp</span>
        )}
        <Link
          href={dossier}
          className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-encre px-3 text-sm font-bold text-encre no-underline hover:bg-orange-pale hover:text-encre"
        >
          <FolderOpen className="h-4 w-4 shrink-0" aria-hidden /> Dossier
        </Link>
      </div>
    </li>
  );
}

// ── Caisse ─────────────────────────────────────────────────────────────────

function OngletCaisse({ data, site, classe }: { data: TableauScolarite; site: string; classe: string }) {
  const jour = aujourdhui();
  const max = Math.max(1, ...data.parMoyen.map((m) => m.montant));
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Carte className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold">Encaissements de {moisDe(jour)}</h3>
              <p className="text-sm text-texte-pale">Versements non annulés, par moyen de paiement.</p>
            </div>
            <div className="text-right">
              <div className="text-[28px] font-black leading-none tabular-nums tracking-serre">{montant(data.indicateurs.encaisseMois)}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-texte-gris">F CFA ce mois</div>
            </div>
          </div>
          {!data.parMoyen.length ? (
            <p className="rounded-xl bg-creme px-4 py-3 text-[15px] text-texte-pale">Aucun encaissement ce mois-ci pour l'instant.</p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {data.parMoyen.map((m) => (
                <li key={m.moyen}>
                  <div className="flex items-baseline justify-between gap-3 text-[15px]">
                    <span className="font-bold">{libelleMoyen(m.moyen)}</span>
                    <span className="whitespace-nowrap font-extrabold tabular-nums">{fcfa(m.montant)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-creme">
                      <div className="h-full rounded-full bg-orange" style={{ width: `${Math.max(2, (m.montant / max) * 100)}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-texte-gris">{pluriel(m.nombre, "versement")}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Carte>
        <ExportCaisse site={site} classe={classe} />
      </div>

      <section aria-labelledby="titre-versements" className="flex flex-col gap-3">
        <TitreSection titre={<span id="titre-versements">Derniers versements</span>} action={<span className="hidden text-sm text-texte-gris sm:inline">Les 50 plus récents</span>} />
        {!data.derniersVersements.length ? (
          <EtatVide
            icone={<Wallet className="h-6 w-6" />}
            titre="Aucun versement pour l'instant."
            texte="Les versements s'encaissent depuis le dossier de chaque étudiant (onglet Scolarité) : un reçu numéroté est créé à chaque fois."
          />
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
              {data.derniersVersements.map((v) => (
                <li key={v.id} className={cn("flex flex-col gap-2 rounded-2xl border border-ligne bg-white p-4", v.annule && "bg-creme")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/pilotage/etudiants/${v.etudiant.id}?onglet=scolarite`} className="font-bold leading-snug text-encre no-underline hover:text-orange-fonce">
                        {v.etudiant.prenom} {v.etudiant.nom}
                      </Link>
                      <div className="text-[13px] leading-snug text-texte-gris">{[v.etudiant.matricule, v.classe].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={cn("text-xl font-black leading-none tabular-nums", v.annule && "text-texte-gris line-through")}>{montant(v.montant)}</div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-texte-gris">F CFA</div>
                    </div>
                  </div>
                  <div className="text-sm text-texte-doux">
                    {jourCourt(v.dateVersement)} · {libelleMoyen(v.moyen)}
                    {v.reference && <span className="font-mono text-[13px]"> · {v.reference}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-texte-gris">
                    <span className={cn("font-mono", v.annule && "line-through")}>{v.numero}</span>
                    {v.encaissePar && <span>· encaissé par {v.encaissePar}</span>}
                  </div>
                  {v.annule && (
                    <p className="text-[13px] text-danger">
                      <Badge ton="danger" className="mr-1.5">
                        Annulé
                      </Badge>
                      {v.annule.motif ? `« ${v.annule.motif} »` : null}
                    </p>
                  )}
                  <BoutonRecu id={v.id} className="mt-1 w-full" />
                </li>
              ))}
            </ul>
            <div className="hidden overflow-hidden rounded-2xl border border-ligne bg-white lg:block">
              <table className="w-full text-left text-[15px]">
                <thead className="border-b border-ligne bg-creme font-mono text-[11px] uppercase tracking-wider text-texte-gris">
                  <tr>
                    <th className="px-4 py-3 font-normal">Reçu</th>
                    <th className="px-4 py-3 font-normal">Étudiant</th>
                    <th className="px-4 py-3 text-right font-normal">Montant</th>
                    <th className="px-4 py-3 font-normal">Moyen</th>
                    <th className="px-4 py-3 font-normal">Encaissé par</th>
                    <th className="px-4 py-3 font-normal">
                      <span className="sr-only">Reçu à imprimer</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ligne-douce">
                  {data.derniersVersements.map((v) => (
                    <tr key={v.id} className={cn("align-middle", v.annule && "bg-creme/60")}>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className={cn("font-mono text-[13px] font-semibold", v.annule && "text-texte-gris line-through")}>{v.numero}</div>
                        <div className="text-xs text-texte-gris">{jourCourt(v.dateVersement)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/pilotage/etudiants/${v.etudiant.id}?onglet=scolarite`} className="font-bold text-encre no-underline hover:text-orange-fonce">
                          {v.etudiant.prenom} {v.etudiant.nom}
                        </Link>
                        <div className="text-xs text-texte-gris">{[v.etudiant.matricule, v.classe].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className={cn("text-lg font-black tabular-nums", v.annule && "text-texte-gris line-through")}>{montant(v.montant)}</div>
                        {v.annule && (
                          <Badge ton="danger" className="mt-0.5">
                            Annulé
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-semibold">{libelleMoyen(v.moyen)}</div>
                        {v.reference && <div className="font-mono text-xs text-texte-gris">{v.reference}</div>}
                        {v.annule?.motif && <div className="text-xs text-danger">Annulé : « {v.annule.motif} »</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-texte-doux">{v.encaissePar ?? "–"}</td>
                      <td className="px-4 py-3 text-right">
                        <BoutonRecu id={v.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-ligne-douce px-4 py-2.5 text-[13px] text-texte-gris">Montants en F CFA. Un versement annulé garde son numéro de reçu.</p>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function BoutonRecu({ id, className }: { id: number; className?: string }) {
  return (
    <a
      href={`/pilotage/recus/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-encre bg-white px-4 text-sm font-bold text-encre no-underline hover:bg-orange-pale hover:text-encre",
        className,
      )}
    >
      <ReceiptText className="h-4 w-4 shrink-0" aria-hidden /> Reçu
    </a>
  );
}

function ExportCaisse({ site, classe }: { site: string; classe: string }) {
  const jour = aujourdhui();
  const [du, setDu] = useState(`${jour.slice(0, 7)}-01`);
  const [au, setAu] = useState(jour);
  const valide = Boolean(du && au && du <= au);
  const p = new URLSearchParams({ du, au });
  if (site) p.set("site", site);
  if (classe) p.set("classe", classe);
  return (
    <Carte className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-extrabold">Journal de caisse</h3>
        <p className="text-sm text-texte-pale">
          Tous les versements de la période, annulés compris (marqués){site || classe ? ", pour le campus et la classe choisis" : ""}.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Champ libelle="Du" type="date" value={du} max={au || jour} onChange={(e) => setDu(e.target.value)} />
        <Champ libelle="Au" type="date" value={au} min={du} max={jour} onChange={(e) => setAu(e.target.value)} />
      </div>
      {valide ? (
        <a
          href={`/api/pilotage/versements/export?${p}`}
          download
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-orange px-5 text-center text-[15px] font-bold text-encre no-underline hover:bg-encre hover:text-white"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden /> Télécharger le journal de caisse (Excel)
        </a>
      ) : (
        <p className="rounded-xl bg-danger-clair px-4 py-3 text-sm font-semibold text-danger">Choisissez une période valide : la date de début doit précéder la date de fin.</p>
      )}
      <p className="text-[13px] text-texte-gris">Fichier CSV : il s'ouvre directement dans Excel.</p>
    </Carte>
  );
}

// ── Frais par classe ───────────────────────────────────────────────────────

function OngletFrais({ site, classe }: { site: string; classe: string }) {
  const { data, isLoading, error, refetch } = useQuery<ListeFraisClasses>({ queryKey: ["/api/pilotage/frais-classes"] });
  const [edition, setEdition] = useState<FraisClasseLigne | null>(null);
  const [application, setApplication] = useState<number | null>(null);

  if (isLoading) return <Chargement lignes={4} />;
  if (error || !data) return <Erreur message={(error as Error | null)?.message ?? "Liste indisponible."} reessayer={() => void refetch()} />;

  const visibles = data.classes.filter((c) => (!site || String(c.siteId) === site) && (!classe || String(c.classeId) === classe));
  const groupes: { siteId: number; site: string; classes: FraisClasseLigne[] }[] = [];
  for (const c of visibles) {
    const g = groupes.find((x) => x.siteId === c.siteId);
    if (g) g.classes.push(c);
    else groupes.push({ siteId: c.siteId, site: c.site, classes: [c] });
  }

  const appliquer = async (c: FraisClasseLigne) => {
    setApplication(c.classeId);
    try {
      await appliquerFraisClasse(c.classeId);
    } catch (e) {
      toastErreur(e);
    } finally {
      setApplication(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-start gap-3 rounded-2xl bg-creme p-4 text-[15px] leading-relaxed text-texte-doux">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
        <span>
          Les frais d'une classe servent de modèle : ils sont copiés à chaque étudiant inscrit dans la classe. Les modifier ne change pas l'échéancier des étudiants qui en ont déjà un.
        </span>
      </p>

      {!groupes.length ? (
        <EtatVide titre="Aucune classe dans ce filtre." texte="Changez de campus ou de classe, ou créez les classes dans « Classes et campus »." />
      ) : (
        groupes.map((g) => (
          <section key={g.siteId} aria-labelledby={`campus-${g.siteId}`} className="flex flex-col gap-3">
            <TitreSection titre={<span id={`campus-${g.siteId}`}>{g.site}</span>} action={<span className="text-sm text-texte-gris">{pluriel(g.classes.length, "classe")}</span>} />
            <ul className="flex flex-col gap-2">
              {g.classes.map((c) => {
                const saisis = c.echeancier.length > 0;
                const applicable = c.sansEcheancier > 0 && c.echeancier.some((l) => l.montant > 0);
                return (
                  <li key={c.classeId} className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-4 md:flex-row md:items-center md:gap-5">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-bold leading-snug">{classeSansCampus(c.classe, c.site)}</div>
                      <div className="mt-0.5 text-[13px] text-texte-gris">
                        {[`Année ${c.anneeScolaire}`, pluriel(c.effectif, "étudiant"), saisis ? pluriel(c.echeancier.length, "ligne") : null].filter(Boolean).join(" · ")}
                      </div>
                      {c.sansEcheancier > 0 && (
                        <Badge ton="alerte" className="mt-2">
                          {c.sansEcheancier > 1 ? `${c.sansEcheancier} étudiants sans échéancier` : "1 étudiant sans échéancier"}
                        </Badge>
                      )}
                    </div>
                    <div className="md:w-44 md:text-right">
                      {saisis ? (
                        <>
                          <div className="text-xl font-black tabular-nums tracking-serre">{fcfa(c.total)}</div>
                          <div className="text-xs text-texte-gris">pour l'année</div>
                        </>
                      ) : (
                        <Badge ton="gris">Pas encore saisis</Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row md:shrink-0">
                      {applicable && (
                        <Bouton variante="doux" chargement={application === c.classeId} onClick={() => void appliquer(c)} className="min-h-[48px]">
                          {c.sansEcheancier > 1 ? `Appliquer aux ${c.sansEcheancier} étudiants sans échéancier` : "Appliquer à l'étudiant sans échéancier"}
                        </Bouton>
                      )}
                      <Bouton variante={saisis ? "contour" : "principal"} onClick={() => setEdition(c)} className="min-h-[48px]">
                        {saisis ? "Modifier les frais" : "Saisir les frais"}
                      </Bouton>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <FenetreFraisClasse classe={edition} classes={data.classes} onFermer={() => setEdition(null)} />
    </div>
  );
}
