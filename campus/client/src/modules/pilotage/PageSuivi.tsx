// /pilotage/suivi : « Qui décroche ? » en détail. Chaque étudiant avec ses
// raisons, ce qu'il faut faire, l'état de ses relances automatiques, et les
// gestes : WhatsApp, dossier, suivi. Filtres et pagination côté serveur
// (1 000 étudiants = près d'1 Mo en une fois). En tête, le bandeau des
// relances automatiques (réglé par la direction) ; l'onglet « À appeler »
// liste ceux que deux relances n'ont pas fait revenir (chantier C4).
import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { PartyPopper, Search, ChevronLeft, ChevronRight, PhoneCall } from "lucide-react";
import type { AContacter, ListeAContacter, TypeRaisonContact } from "@shared/schema";
import type { EtatsRelances, EtudiantAAppeler, ListeAAppeler } from "@shared/engagement/relances";
import { LIBELLES_RAISONS } from "@shared/schema";
import { t } from "@shared/textes/relances";
import { formaterDate } from "@shared/textes";
import { useMoiConnecte } from "@/lib/auth";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { Onglets } from "@/components/ui/onglets";
import { Selection } from "@/components/ui/champs";
import { cn } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { LigneAContacter } from "./composants/LigneAContacter";
import { FenetreSuivi } from "./composants/FenetreSuivi";
import { ReglagesRelances } from "./composants/ReglagesRelances";
import { useReferences } from "./outils";

type Filtre = "tous" | TypeRaisonContact | "a_appeler";
const PAR_PAGE = 20;
const vous = { registre: "vous" as const };
const A_APPELER = "/api/pilotage/relances-auto/a-appeler";

const sansAccents = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Un étudiant « à appeler », présenté comme une ligne de « Qui décroche ? ». */
function versAContacter(l: EtudiantAAppeler): AContacter {
  const relances = l.etat.historique
    .filter((h) => h.palier < 3 && h.motif !== "semaine")
    .reverse()
    .map((h) => t("pilotage.a_appeler.relance", { ...vous, v: { canal: t(`canal.${h.canal}`, vous), jour: formaterDate(`${h.jour}T12:00:00Z`, { style: "court" }) } }));
  const motif = l.etat.derniere?.motif;
  return {
    etudiant: l.etudiant,
    raisons: [
      {
        type: motif === "devoir_non_rendu" || motif === "lives_manques" ? motif : "inactif",
        texte: t("pilotage.a_appeler.texte", { ...vous, v: { liste: relances.join(", ") || "—" } }),
        action: t("pilotage.a_appeler.action", vous),
      },
    ],
    derniereActivite: l.dernierActe,
    dernierSuivi: null,
    whatsapp: l.whatsapp,
  };
}

export default function PageSuivi() {
  const recherche = new URLSearchParams(useSearch());
  const moi = useMoiConnecte();
  const refs = useReferences();
  const [filtre, setFiltre] = useState<Filtre>(recherche.get("filtre") === "a_appeler" ? "a_appeler" : "tous");
  const [site, setSite] = useState(recherche.get("site") ?? "");
  const [q, setQ] = useState("");
  const [qDiffere, setQDiffere] = useState("");
  const [page, setPage] = useState(1);
  const [suivi, setSuivi] = useState<{ id: number; prenom: string; nom: string } | null>(null);

  // Changer un filtre ramène à la première page (dans le même rendu : pas de requête pour une page vide).
  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim() === qDiffere) return;
      setQDiffere(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q, qDiffere]);
  const choisirFiltre = (f: Filtre) => (setFiltre(f), setPage(1));
  const choisirSite = (x: string) => (setSite(x), setPage(1));

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (filtre !== "tous" && filtre !== "a_appeler") p.set("raison", filtre);
    if (site) p.set("site", site);
    if (qDiffere) p.set("q", qDiffere);
    p.set("page", String(page));
    p.set("parPage", String(PAR_PAGE));
    return `/api/pilotage/a-contacter?${p}`;
  }, [filtre, site, qDiffere, page]);
  const { data, isLoading, error, refetch, isFetching } = useQuery<ListeAContacter>({ queryKey: [url], placeholderData: keepPreviousData });
  const pages = data ? Math.max(1, Math.ceil(data.total / PAR_PAGE)) : 1;
  // Un étudiant sorti de la liste peut vider la dernière page : on revient à la précédente.
  useEffect(() => {
    if (data && !isFetching && page > pages) setPage(pages);
  }, [data, isFetching, page, pages]);

  // Relances automatiques : l'état des étudiants de la page, et la liste « À appeler ».
  const ids = (data?.lignes ?? []).map((l) => l.etudiant.id);
  const urlEtats = `/api/pilotage/relances-auto?etudiants=${ids.join(",")}`;
  const etats = useQuery<EtatsRelances>({ queryKey: [urlEtats], enabled: ids.length > 0, placeholderData: keepPreviousData });
  const aAppeler = useQuery<ListeAAppeler>({ queryKey: [A_APPELER] });
  const lignesAAppeler = useMemo(() => {
    const qn = sansAccents(qDiffere);
    return (aAppeler.data?.lignes ?? []).filter(
      (l) =>
        (!site || String(l.etudiant.siteId) === site) &&
        (!qn || [`${l.etudiant.prenom} ${l.etudiant.nom}`, `${l.etudiant.nom} ${l.etudiant.prenom}`, l.etudiant.matricule ?? ""].some((x) => sansAccents(x).includes(qn))),
    );
  }, [aAppeler.data, site, qDiffere]);
  const modeLecture = etats.data ?? aAppeler.data ?? null;

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette="Pilotage · Suivi des étudiants"
        titre="À contacter"
        sousTitre="Jamais activé après 7 jours, plus vu depuis 7 jours, deux lives manqués d'affilée, devoir échu non rendu. Un message ou un appel suffit souvent."
      />

      <ReglagesRelances estDirection={moi.role === "admin"} etat={modeLecture} />

      {data && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Onglets<Filtre>
              valeur={filtre}
              onChange={choisirFiltre}
              options={[
                { valeur: "tous", libelle: "Tous", compteur: data.tous },
                ...(Object.keys(LIBELLES_RAISONS) as TypeRaisonContact[]).map((t) => ({ valeur: t, libelle: LIBELLES_RAISONS[t], compteur: data.parRaison[t] })),
                { valeur: "a_appeler" as const, libelle: t("pilotage.filtre", vous), compteur: aAppeler.data?.lignes.length },
              ]}
            />
            {refs.data?.toutLeGroupe && (
              <Selection aria-label="Campus" value={site} onChange={(e) => choisirSite(e.target.value)} className="sm:w-56">
                <option value="">Tous les campus</option>
                {refs.data.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nomCourt}
                  </option>
                ))}
              </Selection>
            )}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom ou matricule"
              aria-label="Chercher un étudiant à contacter"
              className="min-h-[52px] w-full rounded-xl border border-ligne bg-white pl-12 pr-4 text-base outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
            />
          </div>
        </div>
      )}

      {filtre === "a_appeler" ? (
        aAppeler.isLoading ? (
          <Chargement lignes={3} />
        ) : aAppeler.error ? (
          <Erreur message={(aAppeler.error as Error).message} reessayer={() => aAppeler.refetch()} />
        ) : !lignesAAppeler.length ? (
          <EtatVide icone={<PhoneCall className="h-6 w-6" />} titre={t("pilotage.a_appeler.vide.titre", vous)} texte={t("pilotage.a_appeler.vide.texte", vous)} />
        ) : (
          <section className="flex flex-col gap-3">
            {aAppeler.data?.mode === "essai" && <p className="rounded-xl bg-alerte-clair px-4 py-3 text-[14px] leading-snug text-alerte">{t("pilotage.a_appeler.essai", vous)}</p>}
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-live="polite">
              {lignesAAppeler.map((l) => (
                <LigneAContacter key={l.etudiant.id} ligne={versAContacter(l)} relance={l.etat} onSuivi={setSuivi} />
              ))}
            </ul>
          </section>
        )
      ) : isLoading ? (
        <Chargement lignes={4} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => refetch()} />
      ) : !data?.lignes.length ? (
        <EtatVide
          icone={<PartyPopper className="h-6 w-6" />}
          titre={filtre !== "tous" || site || qDiffere ? "Personne dans ce filtre." : "Personne à relancer pour l'instant."}
          texte="La liste se met à jour toute seule : un étudiant y apparaît dès qu'une des quatre règles le concerne, et en sort dès qu'il revient."
        />
      ) : (
        <section className={cn("flex flex-col gap-3 transition-opacity", isFetching && "opacity-70")}>
          {data.total > PAR_PAGE && (
            <p className="text-sm text-texte-pale" aria-live="polite">
              {(data.page - 1) * PAR_PAGE + 1}–{Math.min(data.page * PAR_PAGE, data.total)} sur {data.total} étudiants
            </p>
          )}
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-live="polite">
            {data.lignes.map((l) => (
              <LigneAContacter key={l.etudiant.id} ligne={l} relance={etats.data?.etudiants[l.etudiant.id]} onSuivi={setSuivi} />
            ))}
          </ul>
          {data.total > PAR_PAGE && (
            <div className="flex items-center justify-between gap-2">
              <Bouton variante="contour" icone={<ChevronLeft className="h-4 w-4" />} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Précédents
              </Bouton>
              <span className="whitespace-nowrap font-mono text-sm text-texte-gris">
                page {data.page} / {pages}
              </span>
              <Bouton variante="contour" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Suivants <ChevronRight className="h-4 w-4" />
              </Bouton>
            </div>
          )}
        </section>
      )}

      <FenetreSuivi etudiant={suivi} onFermer={() => setSuivi(null)} />
    </Page>
  );
}
