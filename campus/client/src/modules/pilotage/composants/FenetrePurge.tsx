// Suppression de la démonstration depuis la page Rentrée (direction) : on
// montre d'abord ce qui partira (simulation, rien n'est touché), puis on
// demande de taper SUPPRIMER. Même code que la purge du démarrage
// (CAMPUS_PURGER_DEMO) : rien de réel n'est touché. La liste des comptes qui
// partent est dépliable : seuls ceux que le semis a marqués y figurent.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2, TriangleAlert, ShieldCheck } from "lucide-react";
import type { ApercuPurge, ResultatPurge } from "@shared/lancement";
import { LIBELLES_ROLES, type Role } from "@shared/schema";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champs";
import { Chargement, Erreur } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import { post, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";

export function FenetrePurge({ ouverte, onFermer }: { ouverte: boolean; onFermer: () => void }) {
  const apercu = useQuery<ApercuPurge>({ queryKey: ["/api/pilotage/rentree/demo"], enabled: ouverte, staleTime: 0, gcTime: 0 });
  const [saisie, setSaisie] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const supprimer = async () => {
    setEnvoi(true);
    try {
      const r = await post<ResultatPurge>("/api/pilotage/rentree/demo/purger", { confirmation: saisie.trim() });
      toast(r.comptes ? `Démonstration supprimée : ${r.comptes} comptes fictifs et tout ce qui s'y rattachait.` : "Il n'y avait plus rien à supprimer.");
      await rafraichir("/api/pilotage");
      setSaisie("");
      onFermer();
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : "La suppression a échoué : rien n'a été touché.", "erreur");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Supprimer la démonstration"
      description="Les personnes, cours et échanges inventés pour la démonstration partent. Les campus, la direction et tout ce qui est réel restent."
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton variante="danger" icone={<Trash2 className="h-4 w-4" />} onClick={supprimer} chargement={envoi} disabled={saisie.trim() !== "SUPPRIMER" || !apercu.data}>
            Supprimer
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {apercu.isLoading ? (
          <Chargement lignes={2} />
        ) : apercu.error ? (
          <Erreur message={(apercu.error as Error).message} reessayer={() => apercu.refetch()} />
        ) : apercu.data && !apercu.data.inventaire.length ? (
          <p className="flex items-center gap-2 rounded-xl bg-succes-clair px-4 py-3 text-[15px] font-semibold text-succes">
            <ShieldCheck className="h-5 w-5" /> Il n'y a plus aucune donnée de démonstration.
          </p>
        ) : (
          apercu.data && (
            <>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 rounded-2xl bg-creme p-4 text-[15px] sm:grid-cols-2">
                {apercu.data.inventaire.map(([libelle, n]) => (
                  <li key={libelle} className="flex items-baseline justify-between gap-3">
                    <span className="text-texte-doux">{libelle.charAt(0).toUpperCase() + libelle.slice(1)}</span>
                    <strong className="font-mono tabular-nums">{n}</strong>
                  </li>
                ))}
              </ul>
              {apercu.data.personnes.length > 0 && (
                <details className="rounded-2xl border border-ligne px-4 py-3 text-[15px]">
                  <summary className="min-h-[28px] cursor-pointer font-semibold text-encre">
                    Voir les {apercu.data.personnes.length} comptes de démonstration qui partent
                  </summary>
                  <ul className="mt-2 max-h-64 overflow-y-auto">
                    {apercu.data.personnes.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-ligne-douce py-1.5 first:border-t-0">
                        <span className="min-w-0 break-words">
                          {p.nom}
                          {p.identifiant && <span className="ml-2 break-all font-mono text-[13px] text-texte-pale">{p.identifiant}</span>}
                        </span>
                        <span className="text-sm text-texte-doux">{LIBELLES_ROLES[p.role as Role] ?? p.role}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {apercu.data.avertissements.map((a) => (
                <p key={a} className="flex items-start gap-2 rounded-xl bg-alerte-clair px-4 py-3 text-sm text-alerte">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {a}
                </p>
              ))}
              <Champ
                libelle="Pour confirmer, tapez SUPPRIMER"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value.toUpperCase())}
                autoComplete="off"
                autoCapitalize="characters"
                aide="Cette suppression est définitive. Elle se fait d'un bloc : en cas de problème, rien n'est supprimé."
              />
            </>
          )
        )}
      </div>
    </Fenetre>
  );
}
