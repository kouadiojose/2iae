// /pilotage/etudiants : le CRM des étudiants. Les indicateurs du périmètre
// (dossiers, paiements, relances) servent aussi de filtres ; recherche et
// filtres restent dans l'adresse (retour arrière, lien partagé) ; chaque ligne
// ouvre le dossier de l'étudiant.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, UserPlus, FileSpreadsheet, Globe, Download, Users, ChevronLeft, ChevronRight, X, Link2, type LucideIcon } from "lucide-react";
import type { PageEtudiantsCrm, FiltreCrm, StatutScolarite } from "@shared/schema";
import { FILTRES_CRM, STATUTS_SCOLARITE, LIBELLES_STATUTS_SCOLARITE } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Selection } from "@/components/ui/champs";
import { cn, pluriel } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { CrmLigneEtudiant, CrmEnTeteListe } from "./composants/CrmLigneEtudiant";
import { FenetreLienEtudiants } from "./composants/FenetreLienEtudiants";
import { useReferences } from "./outils";
import { fcfa } from "./outils-crm";

const PAR_PAGE = 25;
const TRIS = ["nom", "recent", "retard", "connexion"] as const;
type Tri = (typeof TRIS)[number];
const LIBELLES_TRIS: Record<Tri, string> = {
  nom: "Tri\u00a0: nom (A à Z)",
  recent: "Tri\u00a0: inscrits récemment",
  retard: "Tri\u00a0: plus gros retard",
  connexion: "Tri\u00a0: moins connectés",
};

/** Libellé du filtre actif (pastille au-dessus de la liste). */
const LIBELLES_FILTRES: Record<FiltreCrm, string> = {
  incomplets: "Dossiers incomplets",
  a_verifier: "Pièces à vérifier",
  retard: "En retard de paiement",
  non_actives: "Comptes pas encore activés",
  relances: "Avec une relance ouverte",
  sans_frais: "Sans échéancier",
};

type Filtres = { q: string; site: string; classe: string; statut: "" | StatutScolarite; filtre: "" | FiltreCrm; tri: Tri; page: number };

/** Filtres lus dans l'adresse (?q=&site=&classe=&statut=&filtre=&tri=&page=). */
function lireFiltres(search: string): Filtres {
  const p = new URLSearchParams(search);
  const statut = p.get("statut") as StatutScolarite | null;
  const filtre = p.get("filtre") as FiltreCrm | null;
  const tri = p.get("tri") as Tri | null;
  return {
    q: p.get("q") ?? "",
    site: p.get("site") ?? "",
    classe: p.get("classe") ?? "",
    statut: statut && STATUTS_SCOLARITE.includes(statut) ? statut : "",
    filtre: filtre && FILTRES_CRM.includes(filtre) ? filtre : "",
    tri: tri && TRIS.includes(tri) ? tri : "nom",
    page: Math.max(1, Math.floor(Number(p.get("page"))) || 1),
  };
}

/** Filtres → paramètres d'adresse (sans les valeurs par défaut). */
function parametres(f: Filtres, avecPage: boolean): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.site) p.set("site", f.site);
  if (f.classe) p.set("classe", f.classe);
  if (f.statut) p.set("statut", f.statut);
  if (f.filtre) p.set("filtre", f.filtre);
  if (f.tri !== "nom") p.set("tri", f.tri);
  if (avecPage && f.page > 1) p.set("page", String(f.page));
  return p;
}

export default function PageEtudiants() {
  const search = useSearch();
  const [, naviguer] = useLocation();
  const refs = useReferences();
  const [f, setF] = useState<Filtres>(() => lireFiltres(search));
  const [saisie, setSaisie] = useState(f.q);
  const [lienOuvert, setLienOuvert] = useState(false);
  const ecrit = useRef(search);

  // Recherche différée (300 ms) : pas une requête par lettre tapée.
  useEffect(() => {
    const t = setTimeout(() => setF((x) => (x.q === saisie.trim() ? x : { ...x, q: saisie.trim(), page: 1 })), 300);
    return () => clearTimeout(t);
  }, [saisie]);

  // Filtres → adresse (remplacée, pour ne pas empiler une page d'historique par filtre).
  const qs = parametres(f, true).toString();
  useEffect(() => {
    if (qs === ecrit.current) return;
    ecrit.current = qs;
    naviguer(qs ? `/pilotage/etudiants?${qs}` : "/pilotage/etudiants", { replace: true });
  }, [qs, naviguer]);

  // Adresse changée de l'extérieur (lien « Étudiants » de la sous-navigation) : on la suit.
  useEffect(() => {
    if (search === ecrit.current) return;
    ecrit.current = search;
    const n = lireFiltres(search);
    setF(n);
    setSaisie(n.q);
  }, [search]);

  const changer = (x: Partial<Filtres>) => setF((y) => ({ ...y, ...x, page: x.page ?? 1 }));
  const filtresSansPage = parametres(f, false).toString();
  const api = new URLSearchParams(filtresSansPage);
  api.set("page", String(f.page));
  api.set("parPage", String(PAR_PAGE));
  const url = `/api/pilotage/etudiants?${api}`;
  const urlExport = `/api/pilotage/etudiants/export${filtresSansPage ? `?${filtresSansPage}` : ""}`;
  const { data, isLoading, error, refetch, isFetching } = useQuery<PageEtudiantsCrm>({ queryKey: [url], placeholderData: keepPreviousData });

  const classesVisibles = (refs.data?.classes ?? []).filter((c) => !f.site || String(c.siteId) === f.site);
  const filtresActifs = Boolean(f.q || f.site || f.classe || f.statut || f.filtre);
  const toutRetirer = () => (setSaisie(""), setF((y) => ({ ...y, q: "", site: "", classe: "", statut: "", filtre: "", page: 1 })));
  const basculerFiltre = (filtre: FiltreCrm) => changer({ filtre: f.filtre === filtre ? "" : filtre });
  const i = data?.indicateurs;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAR_PAGE)) : 1;

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette="Pilotage · Étudiants"
        titre="Étudiants"
        sousTitre="Dossiers, pièces, paiements et relances de chaque étudiant. Touchez une ligne pour ouvrir son dossier."
        actions={
          <>
            <LienBouton href="/pilotage/etudiants/nouveau" icone={<UserPlus className="h-4 w-4" />} className="min-h-[48px] w-full sm:w-auto">
              Inscrire un étudiant
            </LienBouton>
            <Bouton variante="contour" icone={<Link2 className="h-4 w-4" />} onClick={() => setLienOuvert(true)} className="min-h-[48px] w-full sm:w-auto">
              Lien d'inscription
            </Bouton>
            <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <ActionSecondaire href="/pilotage/comptes/import" Icone={FileSpreadsheet} court="Importer" long="Importer depuis Excel" />
              <ActionSecondaire href="/pilotage/preinscrits" Icone={Globe} court="Préinscrits" long="Préinscrits du site" />
              <ActionSecondaire href={urlExport} telecharger Icone={Download} court="Exporter" long="Exporter (Excel)" />
            </div>
          </>
        }
      />

      {i && (
        // Sur téléphone, une bande qui défile : la recherche reste visible sans descendre.
        <section
          aria-label="Indicateurs du périmètre"
          className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-7"
        >
          <Tuile
            libelle="Étudiants suivis"
            valeur={i.etudiants}
            detail="inscrits ou suspendus"
            actif={!f.filtre}
            onClick={() => changer({ filtre: "" })}
          />
          <Tuile
            libelle="Comptes activés"
            valeur={`${i.comptesActives}/${i.etudiants}`}
            detail={i.etudiants - i.comptesActives > 0 ? `${i.etudiants - i.comptesActives} pas encore activés` : "tous activés"}
            ton={i.etudiants - i.comptesActives > 0 ? "alerte" : "succes"}
            actif={f.filtre === "non_actives"}
            onClick={() => basculerFiltre("non_actives")}
          />
          <Tuile
            libelle="Dossiers incomplets"
            valeur={i.dossiersIncomplets}
            detail="pièces manquantes"
            ton={i.dossiersIncomplets ? "alerte" : "succes"}
            actif={f.filtre === "incomplets"}
            onClick={() => basculerFiltre("incomplets")}
          />
          <Tuile
            libelle="Pièces à vérifier"
            valeur={i.piecesAVerifier}
            detail="déposées en ligne"
            ton={i.piecesAVerifier ? "alerte" : "encre"}
            actif={f.filtre === "a_verifier"}
            onClick={() => basculerFiltre("a_verifier")}
          />
          <Tuile
            libelle="En retard de paiement"
            valeur={i.enRetard}
            detail={i.enRetard ? fcfa(i.montantRetard) : "aucun retard"}
            ton={i.enRetard ? "danger" : "succes"}
            actif={f.filtre === "retard"}
            onClick={() => basculerFiltre("retard")}
          />
          <Tuile libelle="Relances du jour" valeur={i.relancesDuJour} detail="voir les relances" ton={i.relancesDuJour ? "danger" : "encre"} href="/pilotage/relances" />
          <Tuile
            libelle="Sans échéancier"
            valeur={i.sansFrais}
            detail="frais pas appliqués"
            ton={i.sansFrais ? "alerte" : "encre"}
            actif={f.filtre === "sans_frais"}
            onClick={() => basculerFiltre("sans_frais")}
          />
        </section>
      )}

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" />
          <input
            type="search"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Nom, matricule ou téléphone"
            aria-label="Rechercher un étudiant"
            className="min-h-[52px] w-full rounded-xl border border-ligne bg-white pl-12 pr-4 text-base outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
          />
        </div>
        <div className={cn("grid grid-cols-2 gap-2", refs.data?.toutLeGroupe ? "md:grid-cols-4" : "md:grid-cols-3")}>
          {refs.data?.toutLeGroupe && (
            <Selection aria-label="Campus" value={f.site} onChange={(e) => changer({ site: e.target.value, classe: "" })}>
              <option value="">Tous les campus</option>
              {refs.data.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nomCourt}
                </option>
              ))}
            </Selection>
          )}
          <Selection aria-label="Classe" value={f.classe} onChange={(e) => changer({ classe: e.target.value })}>
            <option value="">Toutes les classes</option>
            {classesVisibles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </Selection>
          <Selection aria-label="Statut" value={f.statut} onChange={(e) => changer({ statut: e.target.value as Filtres["statut"] })}>
            <option value="">Tous les statuts</option>
            {STATUTS_SCOLARITE.map((s) => (
              <option key={s} value={s}>
                {LIBELLES_STATUTS_SCOLARITE[s]}
              </option>
            ))}
          </Selection>
          <Selection aria-label="Trier la liste" value={f.tri} onChange={(e) => changer({ tri: e.target.value as Tri })}>
            {TRIS.map((t) => (
              <option key={t} value={t}>
                {LIBELLES_TRIS[t]}
              </option>
            ))}
          </Selection>
        </div>
      </div>

      {isLoading ? (
        <Chargement lignes={5} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => refetch()} />
      ) : !data?.lignes.length ? (
        filtresActifs ? (
          <EtatVide
            icone={<Users className="h-6 w-6" />}
            titre="Aucun étudiant ne correspond."
            texte={f.filtre ? `Personne dans «\u00a0${LIBELLES_FILTRES[f.filtre]}\u00a0» avec ces critères. Retirez un filtre pour élargir.` : "Essayez une autre orthographe, ou retirez un filtre."}
            action={
              <Bouton variante="contour" icone={<X className="h-4 w-4" />} onClick={toutRetirer} className="min-h-[48px]">
                Retirer les filtres
              </Bouton>
            }
          />
        ) : (
          <EtatVide
            icone={<Users className="h-6 w-6" />}
            titre="Aucun étudiant pour l'instant."
            texte="Inscrivez un étudiant avec son dossier complet, ou importez la liste de la scolarité depuis Excel&nbsp;: les comptes et leurs fiches de connexion sont créés d'un coup."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LienBouton href="/pilotage/etudiants/nouveau" icone={<UserPlus className="h-4 w-4" />} className="min-h-[48px]">
                  Inscrire un étudiant
                </LienBouton>
                <LienBouton href="/pilotage/comptes/import" variante="contour" icone={<FileSpreadsheet className="h-4 w-4" />} className="min-h-[48px]">
                  Importer depuis Excel
                </LienBouton>
              </div>
            }
          />
        )
      ) : (
        <section aria-label="Liste des étudiants" className={cn("flex flex-col gap-3 transition-opacity", isFetching && "opacity-70")}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-texte-pale">
            <span aria-live="polite">
              {data.total > PAR_PAGE
                ? `${(data.page - 1) * PAR_PAGE + 1}–${Math.min(data.page * PAR_PAGE, data.total)} sur ${data.total} étudiants`
                : pluriel(data.total, "étudiant")}
            </span>
            {f.filtre && (
              <button
                type="button"
                onClick={() => changer({ filtre: "" })}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-encre bg-white px-4 text-sm font-bold text-encre hover:bg-orange-pale"
                aria-label={`Retirer le filtre «\u00a0${LIBELLES_FILTRES[f.filtre]}\u00a0»`}
              >
                {LIBELLES_FILTRES[f.filtre]}
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="overflow-hidden rounded-2xl border border-ligne bg-white">
            <CrmEnTeteListe />
            <ul className="flex flex-col divide-y divide-ligne-douce">
              {data.lignes.map((e) => (
                <CrmLigneEtudiant key={e.id} e={e} />
              ))}
            </ul>
          </div>
          {data.total > PAR_PAGE && (
            <div className="flex items-center justify-between gap-2">
              <Bouton variante="contour" icone={<ChevronLeft className="h-4 w-4" />} disabled={f.page <= 1} onClick={() => changer({ page: f.page - 1 })} className="min-h-[48px]">
                Précédents
              </Bouton>
              <span className="font-mono text-sm text-texte-gris">
                page {data.page} / {pages}
              </span>
              <Bouton variante="contour" disabled={f.page >= pages} onClick={() => changer({ page: f.page + 1 })} className="min-h-[48px]">
                Suivants <ChevronRight className="h-4 w-4" />
              </Bouton>
            </div>
          )}
        </section>
      )}
      <FenetreLienEtudiants ouverte={lienOuvert} onFermer={() => setLienOuvert(false)} />
    </Page>
  );
}

const TONS_TUILE = {
  encre: "text-encre",
  succes: "text-succes",
  alerte: "text-alerte",
  danger: "text-danger",
} as const;

/** Indicateur cliquable : filtre la liste (ou mène à une autre page). */
function Tuile({
  libelle,
  valeur,
  detail,
  ton = "encre",
  actif,
  onClick,
  href,
  className,
}: {
  libelle: string;
  valeur: ReactNode;
  detail: string;
  ton?: keyof typeof TONS_TUILE;
  actif?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const classes = cn(
    "flex min-h-[96px] w-[150px] shrink-0 snap-start flex-col justify-between gap-1 rounded-2xl border p-3 text-left no-underline transition-colors sm:w-auto sm:p-4",
    actif ? "border-encre bg-encre text-white hover:text-white" : "border-ligne bg-white text-encre hover:border-orange hover:text-encre",
    className,
  );
  const contenu = (
    <>
      <span className={cn("min-h-[2.5em] font-mono text-[11px] uppercase leading-tight tracking-wider", actif ? "text-white/75" : "text-texte-gris")}>{libelle}</span>
      <span className={cn("text-2xl font-black tabular-nums tracking-serre sm:text-3xl", actif ? "text-white" : TONS_TUILE[ton])}>{valeur}</span>
      <span className={cn("line-clamp-2 text-[13px] leading-snug", actif ? "text-white/80" : "text-texte-pale")}>{detail}</span>
    </>
  );
  if (href)
    return (
      <Link href={href} className={classes}>
        {contenu}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} aria-current={actif ? "true" : undefined} className={classes}>
      {contenu}
    </button>
  );
}

/** Action secondaire de l'en-tête : icône et mot court sur téléphone, bouton complet sur ordinateur. */
function ActionSecondaire({ href, Icone, court, long, telecharger }: { href: string; Icone: LucideIcon; court: string; long: string; telecharger?: boolean }) {
  const classes =
    "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-encre bg-white px-2 text-[13px] font-bold text-encre no-underline transition-colors hover:bg-orange-pale hover:text-encre sm:min-h-[48px] sm:flex-row sm:gap-2 sm:px-5 sm:text-[15px]";
  const contenu = (
    <>
      <Icone className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sm:hidden">{court}</span>
      <span className="hidden sm:inline">{long}</span>
    </>
  );
  if (telecharger)
    return (
      <a href={href} download className={classes} aria-label={long}>
        {contenu}
      </a>
    );
  return (
    <Link href={href} className={classes} aria-label={long}>
      {contenu}
    </Link>
  );
}
