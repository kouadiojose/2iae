// /pilotage/cours : les cours du groupe, leur formateur et les classes qui les
// suivent. Tout passe par l'API du module cours ; le pilotage n'ajoute que la
// liste des formateurs.
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Plus, BookOpen, ExternalLink, Search } from "lucide-react";
import type { CoursResume, CoursDetail, OptionsEditionCours, FormateurOption, StatutCours } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Badge, Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { Fenetre } from "@/components/ui/fenetre";
import { Champ, Selection } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { post, patch, put, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { dateCourte, heure } from "@/lib/dates";
import { cn, pluriel } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";

const STATUTS: Record<StatutCours, { texte: string; ton: "gris" | "succes" | "encre" }> = {
  brouillon: { texte: "Brouillon", ton: "gris" },
  publie: { texte: "Ouvert aux étudiants", ton: "succes" },
  archive: { texte: "Archivé", ton: "encre" },
};

export default function PageCours() {
  const { data, isLoading, error, refetch } = useQuery<CoursResume[]>({ queryKey: ["/api/cours"] });
  const [q, setQ] = useState("");
  const [creation, setCreation] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const liste = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (data ?? []).filter((c) => !n || `${c.code} ${c.titre} ${c.formateur?.prenom ?? ""} ${c.formateur?.nom ?? ""}`.toLowerCase().includes(n));
  }, [data, q]);

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette="Pilotage · Cours"
        titre="Cours"
        sousTitre="Qui enseigne quoi, à quelles classes. Le formateur prépare ensuite le contenu (leçons, lives, devoirs) de son côté."
        actions={
          <Bouton taille="lg" icone={<Plus className="h-5 w-5" />} onClick={() => setCreation(true)} className="min-h-[52px]">
            Nouveau cours
          </Bouton>
        }
      />
      {(data?.length ?? 0) > 6 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Code, titre ou formateur"
            aria-label="Chercher un cours"
            className="min-h-[52px] w-full rounded-xl border border-ligne bg-white pl-12 pr-4 text-base outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
          />
        </div>
      )}
      {isLoading ? (
        <Chargement lignes={3} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => refetch()} />
      ) : !liste.length ? (
        <EtatVide
          icone={<BookOpen className="h-6 w-6" />}
          titre={data?.length ? "Aucun cours ne correspond." : "Aucun cours pour l'instant."}
          texte="Créez un cours avec son code (ex. IA-101), confiez-le à un formateur et cochez les classes qui le suivent."
          action={!data?.length ? <Bouton onClick={() => setCreation(true)}>Créer un cours</Bouton> : undefined}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {liste.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setOuvert(c.id)} className="relative flex h-full w-full flex-col gap-2 overflow-hidden rounded-2xl border border-ligne bg-white p-5 pl-6 text-left transition-colors hover:border-orange">
                <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: c.couleur }} aria-hidden />
                <span className="font-mono text-xs text-texte-gris">{c.code}</span>
                <span className="text-lg font-extrabold leading-snug">{c.titre}</span>
                <span className="text-[15px] text-texte-pale">{c.formateur ? `${c.formateur.prenom} ${c.formateur.nom}${c.formateur.ville ? ` · depuis ${c.formateur.ville}` : ""}` : "Formateur à choisir"}</span>
                <span className="flex flex-wrap gap-1.5">
                  <Badge ton={STATUTS[c.statut].ton}>{STATUTS[c.statut].texte}</Badge>
                  <Badge ton={c.nbClasses ? "gris" : "alerte"}>{c.nbClasses ? pluriel(c.nbClasses, "classe") : "Aucune classe"}</Badge>
                  {c.nbEtudiants !== null && <Badge ton="gris">{pluriel(c.nbEtudiants, "étudiant")}</Badge>}
                  {c.publierSurSite ? <Badge ton="orange">Sur 2iae.com</Badge> : c.proposeSurSite ? <Badge ton="alerte">Proposé pour 2iae.com</Badge> : null}
                </span>
                {c.prochaineSeance && (
                  <span className="text-[13px] text-texte-gris">
                    Prochain live : {dateCourte(c.prochaineSeance.debut)} à {heure(c.prochaineSeance.debut)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <FenetreCreationCours ouverte={creation} onFermer={() => setCreation(false)} onCree={(id) => setOuvert(id)} />
      {ouvert !== null && <FenetreCours key={ouvert} id={ouvert} onFermer={() => setOuvert(null)} />}
    </Page>
  );
}

function useFormateurs(actif: boolean) {
  return useQuery<FormateurOption[]>({ queryKey: ["/api/pilotage/cours-formateurs"], enabled: actif, staleTime: 60_000 });
}

function FenetreCreationCours({ ouverte, onFermer, onCree }: { ouverte: boolean; onFermer: () => void; onCree: (id: number) => void }) {
  const formateurs = useFormateurs(ouverte);
  const [code, setCode] = useState("");
  const [titre, setTitre] = useState("");
  const [formateurId, setFormateurId] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const creer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const c = await post<CoursDetail>("/api/cours", { code, titre, formateurId: formateurId ? Number(formateurId) : null });
      toast(`Cours ${c.code} créé : cochez maintenant les classes qui le suivent.`);
      await rafraichir("/api/cours");
      setCode("");
      setTitre("");
      setFormateurId("");
      onFermer();
      onCree(c.id);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Une erreur est survenue.");
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Nouveau cours"
      description="Il reste en brouillon, invisible des étudiants, jusqu'à son ouverture."
      pied={
        <Bouton onClick={creer} chargement={envoi} disabled={code.trim().length < 2 || titre.trim().length < 3}>
          Créer le cours
        </Bouton>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
          <Champ libelle="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="IA-101" className="font-mono" maxLength={20} />
          <Champ libelle="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Initiation à l'intelligence artificielle" maxLength={140} />
        </div>
        <Selection libelle="Formateur" value={formateurId} onChange={(e) => setFormateurId(e.target.value)} aide="Il sera prévenu qu'un cours lui est confié.">
          <option value="">À choisir plus tard</option>
          {(formateurs.data ?? [])
            .filter((f) => f.actif)
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.prenom} {f.nom}
                {f.localisation ? ` · ${f.localisation}` : ""}
              </option>
            ))}
        </Selection>
        {erreur && (
          <p role="alert" className="rounded-xl bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger">
            {erreur}
          </p>
        )}
      </div>
    </Fenetre>
  );
}

function FenetreCours({ id, onFermer }: { id: number; onFermer: () => void }) {
  const detail = useQuery<CoursDetail>({ queryKey: [`/api/cours/${id}`] });
  const options = useQuery<OptionsEditionCours>({ queryKey: ["/api/cours/options"] });
  const formateurs = useFormateurs(true);
  const [coches, setCoches] = useState<Set<number> | null>(null);
  const [envoi, setEnvoi] = useState<null | "formateur" | "statut" | "classes">(null);
  const c = detail.data;
  const actuelles = useMemo(() => new Set((c?.classes ?? []).map((x) => x.id)), [c]);
  const selection = coches ?? actuelles;
  const modifie = coches !== null && (coches.size !== actuelles.size || [...coches].some((x) => !actuelles.has(x)));

  const maj = async (quoi: "formateur" | "statut", corps: Record<string, unknown>, message: string) => {
    setEnvoi(quoi);
    try {
      await patch(`/api/cours/${id}`, corps);
      toast(message);
      await rafraichir(`/api/cours`);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  };
  const enregistrerClasses = async () => {
    if (!coches) return;
    setEnvoi("classes");
    try {
      // La vie scolaire d'un campus n'envoie que ses classes : le serveur garde celles des autres campus.
      const modifiables = new Set((options.data?.sites ?? []).filter((s) => s.modifiable).flatMap((s) => s.classes.map((x) => x.id)));
      await put(`/api/cours/${id}/classes`, { classeIds: [...coches].filter((x) => modifiables.has(x)) });
      toast("Classes enregistrées : les nouveaux étudiants sont prévenus si le cours est ouvert.");
      setCoches(null);
      await rafraichir("/api/cours", "/api/pilotage/classes", "/api/pilotage/planning");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  };

  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      large
      titre={c ? `${c.code} · ${c.titre}` : "Cours"}
      description={c ? `${pluriel(c.nbEtudiants ?? 0, "étudiant")} · ${pluriel(c.classes.length, "classe")}` : undefined}
      pied={
        <>
          <Link href={`/enseigner/cours/${id}`} className="inline-flex min-h-[48px] items-center gap-2 px-2 font-bold">
            <ExternalLink className="h-4 w-4" /> Ouvrir l'éditeur du cours
          </Link>
          <Bouton onClick={enregistrerClasses} chargement={envoi === "classes"} disabled={!modifie}>
            Enregistrer les classes
          </Bouton>
        </>
      }
    >
      {detail.isLoading || options.isLoading ? (
        <Chargement lignes={2} />
      ) : detail.error || !c ? (
        <Erreur message={(detail.error as Error)?.message ?? "Cours introuvable."} />
      ) : (
        <div className="flex flex-col gap-5 pb-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Selection
              libelle="Formateur principal"
              value={c.formateur ? String(c.formateur.id) : ""}
              disabled={envoi === "formateur" || !options.data?.peutChangerFormateur}
              onChange={(e) => maj("formateur", { formateurId: e.target.value ? Number(e.target.value) : null }, "Formateur mis à jour : il est prévenu.")}
            >
              <option value="">Aucun pour l'instant</option>
              {(formateurs.data ?? [])
                .filter((f) => f.actif || f.id === c.formateur?.id)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.prenom} {f.nom}
                  </option>
                ))}
            </Selection>
            <Selection libelle="État du cours" value={c.statut} disabled={envoi === "statut"} onChange={(e) => maj("statut", { statut: e.target.value }, "État du cours mis à jour")}>
              <option value="brouillon">Brouillon (invisible des étudiants)</option>
              <option value="publie">Ouvert aux étudiants</option>
              <option value="archive">Archivé</option>
            </Selection>
          </div>
          <div>
            <h3 className="mb-2 text-base font-extrabold">Classes qui suivent ce cours</h3>
            <div className="flex flex-col gap-3">
              {(options.data?.sites ?? []).map((s) =>
                s.classes.length ? (
                  <fieldset key={s.id} className={cn("rounded-2xl border border-ligne p-4", !s.modifiable && "bg-creme")}>
                    <legend className="px-1 text-sm font-bold">
                      {s.nomCourt}
                      {!s.modifiable && <span className="ml-2 font-normal text-texte-gris">(géré par ce campus)</span>}
                    </legend>
                    <div className="flex flex-col gap-1">
                      {s.classes.map((cl) => (
                        <label key={cl.id} className={cn("flex min-h-[44px] items-center gap-3", s.modifiable ? "cursor-pointer" : "cursor-not-allowed opacity-70")}>
                          <input
                            type="checkbox"
                            className="h-5 w-5 accent-[#E4793A]"
                            checked={selection.has(cl.id)}
                            disabled={!s.modifiable}
                            onChange={() =>
                              setCoches(() => {
                                const n = new Set(selection);
                                if (n.has(cl.id)) n.delete(cl.id);
                                else n.add(cl.id);
                                return n;
                              })
                            }
                          />
                          <span className="flex-1 text-[15px]">{cl.nom}</span>
                          <span className="font-mono text-xs text-texte-gris">{pluriel(cl.effectif, "étudiant")}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null,
              )}
            </div>
          </div>
        </div>
      )}
    </Fenetre>
  );
}
