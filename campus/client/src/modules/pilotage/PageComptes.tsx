// /pilotage/comptes : tous les comptes du périmètre. Recherche, filtres,
// fiche de chaque compte (modifier, nouveau code, désactiver), création,
// et sélection pour imprimer les fiches de connexion.
import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, UserPlus, FileSpreadsheet, Printer, Users, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { PageComptes as DonneesComptes, CompteLigne, CodeRemis, Role } from "@shared/schema";
import { LIBELLES_ROLES, ROLES } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Avatar, Badge, Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Champ, Selection } from "@/components/ui/champs";
import { cn, pluriel } from "@/lib/utils";
import { useMoiConnecte } from "@/lib/auth";
import { SousNav } from "./composants/SousNav";
import { FenetreCompte } from "./composants/FenetreCompte";
import { FenetreCode } from "./composants/FenetreCode";
import { useReferences, etatCompte, vuLe, telephoneLisible, lienFiches } from "./outils";

const PAR_PAGE = 25;
type Etat = "" | "non_actives" | "actives" | "desactives";

export default function PageComptes() {
  const depart = new URLSearchParams(useSearch());
  const [, naviguer] = useLocation();
  const moi = useMoiConnecte();
  const refs = useReferences();
  const [q, setQ] = useState(depart.get("q") ?? "");
  const [qDiffere, setQDiffere] = useState(q);
  const [role, setRole] = useState<"" | Role>((depart.get("role") as Role) ?? "");
  const [site, setSite] = useState(depart.get("site") ?? "");
  const [classe, setClasse] = useState(depart.get("classe") ?? "");
  const [etat, setEtat] = useState<Etat>((depart.get("etat") as Etat) ?? "");
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [ouvert, setOuvert] = useState<CompteLigne | "nouveau" | null>(null);
  const [code, setCode] = useState<{ remis: CodeRemis; compte: CompteLigne } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDiffere(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [qDiffere, role, site, classe, etat]);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (qDiffere) p.set("q", qDiffere);
    if (role) p.set("role", role);
    if (site) p.set("site", site);
    if (classe) p.set("classe", classe);
    if (etat) p.set("etat", etat);
    p.set("page", String(page));
    p.set("parPage", String(PAR_PAGE));
    return `/api/pilotage/comptes?${p}`;
  }, [qDiffere, role, site, classe, etat, page]);
  const { data, isLoading, error, refetch, isFetching } = useQuery<DonneesComptes>({ queryKey: [url], placeholderData: keepPreviousData });

  const classesVisibles = (refs.data?.classes ?? []).filter((c) => !site || String(c.siteId) === site);
  const filtresActifs = Boolean(qDiffere || role || site || classe || etat);
  const basculer = (id: number) =>
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const pageSelectionnable = (data?.lignes ?? []).filter((c) => c.actif && c.id !== moi.id);
  const toutePage = pageSelectionnable.length > 0 && pageSelectionnable.every((c) => selection.has(c.id));

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette="Pilotage · Comptes"
        titre="Comptes"
        sousTitre="Étudiants, formateurs, vie scolaire et salles de conférence. Touchez un compte pour le modifier ou lui donner un nouveau code."
        actions={
          <>
            <Bouton variante="contour" icone={<UserPlus className="h-4 w-4" />} onClick={() => setOuvert("nouveau")}>
              Nouveau compte
            </Bouton>
            <LienBouton href="/pilotage/comptes/import" icone={<FileSpreadsheet className="h-4 w-4" />}>
              Importer depuis Excel
            </LienBouton>
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, matricule, téléphone ou e-mail"
            aria-label="Rechercher un compte"
            className="min-h-[52px] w-full rounded-xl border border-ligne bg-white pl-12 pr-4 text-base outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Selection aria-label="Rôle" value={role} onChange={(e) => setRole(e.target.value as Role | "")}>
            <option value="">Tous les rôles</option>
            {ROLES.filter((r) => r !== "admin" || refs.data?.estDirection).map((r) => (
              <option key={r} value={r}>
                {LIBELLES_ROLES[r]}
              </option>
            ))}
          </Selection>
          <Selection aria-label="État" value={etat} onChange={(e) => setEtat(e.target.value as Etat)}>
            <option value="">Tous les états</option>
            <option value="non_actives">Pas encore activés</option>
            <option value="actives">Activés</option>
            <option value="desactives">Désactivés</option>
          </Selection>
          {refs.data?.toutLeGroupe && (
            <Selection aria-label="Campus" value={site} onChange={(e) => (setSite(e.target.value), setClasse(""))}>
              <option value="">Tous les campus</option>
              {refs.data.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nomCourt}
                </option>
              ))}
            </Selection>
          )}
          <Selection aria-label="Classe" value={classe} onChange={(e) => setClasse(e.target.value)}>
            <option value="">Toutes les classes</option>
            {classesVisibles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
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
        <EtatVide
          icone={<Users className="h-6 w-6" />}
          titre={filtresActifs ? "Aucun compte ne correspond." : "Aucun compte pour l'instant."}
          texte={filtresActifs ? "Essayez une autre orthographe, ou retirez un filtre." : "Importez la liste de la scolarité depuis Excel : les comptes et leurs fiches de connexion sont créés d'un coup."}
          action={
            filtresActifs ? (
              <Bouton variante="contour" icone={<X className="h-4 w-4" />} onClick={() => (setQ(""), setRole(""), setSite(""), setClasse(""), setEtat(""))}>
                Retirer les filtres
              </Bouton>
            ) : (
              <LienBouton href="/pilotage/comptes/import">Importer des étudiants</LienBouton>
            )
          }
        />
      ) : (
        <section className={cn("flex flex-col gap-3 transition-opacity", isFetching && "opacity-70")}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-texte-pale">
            <span aria-live="polite">
              {data.total > PAR_PAGE
                ? `${(data.page - 1) * PAR_PAGE + 1}–${Math.min(data.page * PAR_PAGE, data.total)} sur ${data.total} comptes`
                : pluriel(data.total, "compte")}
            </span>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 font-semibold text-encre">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#E4793A]"
                checked={toutePage}
                onChange={() =>
                  setSelection((s) => {
                    const n = new Set(s);
                    for (const c of pageSelectionnable) toutePage ? n.delete(c.id) : n.add(c.id);
                    return n;
                  })
                }
              />
              Tout cocher sur cette page
            </label>
          </div>
          <ul className="flex flex-col divide-y divide-ligne-douce overflow-hidden rounded-2xl border border-ligne bg-white">
            {data.lignes.map((c) => (
              <LigneCompte key={c.id} c={c} coche={selection.has(c.id)} onCocher={() => basculer(c.id)} onOuvrir={() => setOuvert(c)} />
            ))}
          </ul>
          {data.total > PAR_PAGE && (
            <div className="flex items-center justify-between gap-2">
              <Bouton variante="contour" icone={<ChevronLeft className="h-4 w-4" />} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Précédents
              </Bouton>
              <span className="font-mono text-sm text-texte-gris">
                page {data.page} / {Math.ceil(data.total / PAR_PAGE)}
              </span>
              <Bouton variante="contour" disabled={page * PAR_PAGE >= data.total} onClick={() => setPage((p) => p + 1)}>
                Suivants <ChevronRight className="h-4 w-4" />
              </Bouton>
            </div>
          )}
        </section>
      )}

      {selection.size > 0 && (
        <div className="bas-sur fixed inset-x-0 bottom-[72px] z-20 px-4 lg:bottom-6">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-encre p-3 pl-5 text-white shadow-carte">
            <span className="flex-1 text-[15px] font-semibold">{pluriel(selection.size, "compte coché", "comptes cochés")}</span>
            <button type="button" onClick={() => setSelection(new Set())} className="min-h-[44px] px-2 text-sm font-semibold text-nuit-doux hover:text-white">
              Décocher
            </button>
            <Bouton icone={<Printer className="h-4 w-4" />} onClick={() => naviguer(lienFiches([...selection]))}>
              Imprimer les fiches
            </Bouton>
          </div>
        </div>
      )}

      <FenetreCompte
        ouverte={ouvert !== null}
        compte={ouvert === "nouveau" ? null : ouvert}
        roleParDefaut={role || "etudiant"}
        onFermer={() => setOuvert(null)}
        onCode={(remis, compte) => setCode({ remis, compte })}
      />
      <FenetreCode
        remis={code?.remis ?? null}
        personne={
          code
            ? {
                id: code.compte.id,
                prenom: code.compte.prenom,
                nom: code.compte.nom,
                role: code.compte.role,
                identifiant: code.compte.matricule ?? code.compte.email ?? "",
                classe: code.compte.classe,
                site: code.compte.site,
              }
            : null
        }
        onFermer={() => setCode(null)}
      />
    </Page>
  );
}

function LigneCompte({ c, coche, onCocher, onOuvrir }: { c: CompteLigne; coche: boolean; onCocher: () => void; onOuvrir: () => void }) {
  const etat = etatCompte(c);
  const moi = useMoiConnecte();
  // Son propre code se change dans son profil, jamais par une fiche.
  const cochable = c.actif && c.id !== moi.id;
  return (
    <li className={cn("flex items-center gap-3 px-3 py-3 sm:px-4", coche && "bg-orange-pale", !c.actif && "opacity-70")}>
      <label className="grid h-12 w-10 shrink-0 cursor-pointer place-items-center" aria-label={`Cocher ${c.prenom} ${c.nom} pour imprimer sa fiche`}>
        <input type="checkbox" className="h-5 w-5 accent-[#E4793A]" checked={coche} onChange={onCocher} disabled={!cochable} />
      </label>
      <button type="button" onClick={onOuvrir} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar prenom={c.prenom} nom={c.nom} taille={40} className="hidden sm:grid" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-bold text-encre">
              {c.prenom} {c.nom}
            </span>
            {c.role !== "etudiant" && <Badge ton="encre">{LIBELLES_ROLES[c.role]}</Badge>}
          </span>
          <span className="mt-0.5 block truncate text-sm text-texte-pale">
            {[c.matricule ?? c.email, c.role === "etudiant" ? c.classe : c.site ? `Campus ${c.site}` : c.localisation, telephoneLisible(c.telephone)]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="mt-1.5 block sm:hidden">
            <Badge ton={etat.ton}>{etat.texte}</Badge>
          </span>
        </span>
        <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          <Badge ton={etat.ton}>{etat.texte}</Badge>
          <span className="text-xs text-texte-gris">Connexion : {vuLe(c.derniereConnexion)}</span>
        </span>
      </button>
    </li>
  );
}
