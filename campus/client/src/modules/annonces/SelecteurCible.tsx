// « Qui doit la recevoir ? » : tous les campus, un campus, une classe ou un
// cours, parmi ce que la personne a le droit de viser (GET /api/annonces/cibles).
// Sert aux annonces et aux événements de l'agenda.
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Selection } from "@/components/ui/champs";
import { Squelette } from "@/components/ui/divers";
import type { Cible, CiblesAnnonce, DestinatairesAnnonce } from "@shared/schema";

export type CibleSaisie = { cible: Cible; siteId: number | null; classeId: number | null; coursId: number | null };

const LIBELLES: Record<Cible, string> = {
  tous: "Tous les campus",
  site: "Un campus",
  classe: "Une classe",
  cours: "Les inscrits d'un cours",
};

/** Première cible possible pour un formulaire vierge. */
export function cibleParDefaut(c: CiblesAnnonce, coursId?: number | null): CibleSaisie {
  if (coursId && c.cours.some((x) => x.id === coursId)) return { cible: "cours", siteId: null, classeId: null, coursId };
  if (c.tous) return { cible: "tous", siteId: null, classeId: null, coursId: null };
  if (c.sites.length) return { cible: "site", siteId: c.sites[0].id, classeId: null, coursId: null };
  if (c.cours.length) return { cible: "cours", siteId: null, classeId: null, coursId: c.cours[0].id };
  return { cible: "cours", siteId: null, classeId: null, coursId: null };
}

/** La cible est-elle complète (campus, classe ou cours choisi) ? */
export function cibleComplete(v: CibleSaisie) {
  return v.cible === "tous" || (v.cible === "site" && !!v.siteId) || (v.cible === "classe" && !!v.classeId) || (v.cible === "cours" && !!v.coursId);
}

export function SelecteurCible({
  cibles,
  valeur,
  onChange,
  libelle = "Qui doit la recevoir ?",
  verbe = "Sera reçue par",
}: {
  cibles: CiblesAnnonce;
  valeur: CibleSaisie;
  onChange: (v: CibleSaisie) => void;
  libelle?: string;
  /** Début de la phrase du compteur : « Sera reçue par », « Concerne »… */
  verbe?: string;
}) {
  const possibles: Cible[] = [
    ...(cibles.tous ? (["tous"] as const) : []),
    ...(cibles.sites.length ? (["site"] as const) : []),
    ...(cibles.classes.length ? (["classe"] as const) : []),
    ...(cibles.cours.length ? (["cours"] as const) : []),
  ];

  const choisirType = (cible: Cible) => {
    onChange({
      cible,
      siteId: cible === "site" ? (cibles.sites[0]?.id ?? null) : null,
      classeId: cible === "classe" ? (cibles.classes[0]?.id ?? null) : null,
      coursId: cible === "cours" ? (cibles.cours[0]?.id ?? null) : null,
    });
  };

  const nomSite = new Map(cibles.sites.map((s) => [s.id, s.nom]));
  const classesParSite = new Map<number, CiblesAnnonce["classes"]>();
  for (const c of cibles.classes) classesParSite.set(c.siteId, [...(classesParSite.get(c.siteId) ?? []), c]);

  return (
    <div className="flex flex-col gap-3">
      {possibles.length > 1 ? (
        <Selection libelle={libelle} value={valeur.cible} onChange={(e) => choisirType(e.target.value as Cible)}>
          {possibles.map((p) => (
            <option key={p} value={p}>
              {LIBELLES[p]}
            </option>
          ))}
        </Selection>
      ) : null}
      {valeur.cible === "site" && (
        <Selection libelle="Campus" value={valeur.siteId ?? ""} onChange={(e) => onChange({ ...valeur, siteId: Number(e.target.value) || null })}>
          {cibles.sites.map((s) => (
            <option key={s.id} value={s.id}>
              Campus {s.nom}
            </option>
          ))}
        </Selection>
      )}
      {valeur.cible === "classe" && (
        <Selection libelle="Classe" value={valeur.classeId ?? ""} onChange={(e) => onChange({ ...valeur, classeId: Number(e.target.value) || null })}>
          {[...classesParSite.entries()].map(([siteId, liste]) => (
            <optgroup key={siteId} label={nomSite.get(siteId) ? `Campus ${nomSite.get(siteId)}` : "Autre campus"}>
              {liste.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </optgroup>
          ))}
        </Selection>
      )}
      {valeur.cible === "cours" && (
        <Selection
          libelle={possibles.length > 1 ? "Cours" : "Pour les inscrits du cours"}
          value={valeur.coursId ?? ""}
          onChange={(e) => onChange({ ...valeur, coursId: Number(e.target.value) || null })}
        >
          {cibles.cours.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.titre}
            </option>
          ))}
        </Selection>
      )}
      <Destinataires valeur={valeur} verbe={verbe} />
    </div>
  );
}

/** « Sera reçue par 342 étudiants et 12 membres du personnel. » */
function Destinataires({ valeur, verbe }: { valeur: CibleSaisie; verbe: string }) {
  const params = new URLSearchParams({ cible: valeur.cible });
  if (valeur.siteId) params.set("siteId", String(valeur.siteId));
  if (valeur.classeId) params.set("classeId", String(valeur.classeId));
  if (valeur.coursId) params.set("coursId", String(valeur.coursId));
  const { data, isLoading, error } = useQuery<DestinatairesAnnonce>({
    queryKey: [`/api/annonces/destinataires?${params.toString()}`],
    enabled: cibleComplete(valeur),
    staleTime: 60_000,
  });
  if (!cibleComplete(valeur)) return null;
  if (isLoading) return <Squelette className="h-6 w-64" />;
  if (error) return <p className="text-[13px] font-semibold text-danger">{(error as Error).message}</p>;
  if (!data) return null;
  const morceaux = [
    data.etudiants ? `${data.etudiants} étudiant${data.etudiants > 1 ? "s" : ""}` : null,
    data.personnel ? `${data.personnel} membre${data.personnel > 1 ? "s" : ""} du personnel` : null,
  ].filter(Boolean);
  return (
    <p className="flex items-center gap-2 rounded-xl bg-creme px-3 py-2.5 text-sm text-texte-doux" aria-live="polite">
      <Users className="h-4 w-4 shrink-0 text-orange-fonce" aria-hidden />
      {data.total ? (
        <>
          {verbe} {morceaux.join(" et ")}.
        </>
      ) : (
        "Personne ne correspond à ce public pour l'instant."
      )}
    </p>
  );
}
