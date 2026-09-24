// Composants communs des pages d'annonces : carte de la liste, accusés de
// lecture par campus avec la liste des personnes qui n'ont pas lu, relance.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BellRing, CheckCircle2, Pin } from "lucide-react";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { relatif } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import { Badge, BarreProgression, Erreur, Squelette } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import type { AnnonceDto, LecturesAnnonce } from "@shared/schema";
import { extrait } from "../accueil/outils";

/** Pastilles d'état d'une annonce (importante, épinglée, nouvelle, 2iae.com). */
export function BadgesAnnonce({ annonce, gestion }: { annonce: AnnonceDto; gestion?: boolean }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {annonce.importante && <Badge ton="danger">Important</Badge>}
      {annonce.epinglee && (
        <Badge ton="gris">
          <Pin className="h-3 w-3" aria-hidden /> Épinglée
        </Badge>
      )}
      {!annonce.lue && !gestion && <Badge ton="orange">Nouveau</Badge>}
      {gestion && annonce.publierSurSite && <Badge ton="succes">En ligne sur 2iae.com</Badge>}
      {gestion && annonce.proposeSurSite && <Badge ton="alerte">Proposée pour 2iae.com</Badge>}
    </span>
  );
}

/** Carte d'une annonce dans la liste : non lue = fond orange pâle et point orange. */
export function CarteAnnonce({ annonce }: { annonce: AnnonceDto }) {
  const maintenant = useMaintenant(60_000);
  return (
    <Link
      href={`/annonces/${annonce.id}`}
      className={cn(
        "group flex gap-3 rounded-2xl border p-4 text-encre no-underline transition-colors hover:border-orange hover:text-encre sm:p-5",
        annonce.lue ? "border-ligne bg-white" : "border-orange bg-orange-pale",
      )}
    >
      <span className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", annonce.lue ? "bg-transparent" : "bg-orange")} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        {(annonce.importante || annonce.epinglee || !annonce.lue) && <BadgesAnnonce annonce={annonce} />}
        <span className={cn("text-[17px] leading-snug", annonce.lue ? "font-bold" : "font-extrabold")}>
          {!annonce.lue && <span className="sr-only">Non lue : </span>}
          {annonce.titre}
        </span>
        <span className="line-clamp-2 text-[15px] leading-relaxed text-texte-pale">{extrait(annonce.corps, 180)}</span>
        <span className="font-mono text-xs text-texte-gris">
          {annonce.cibleLibelle} · {annonce.auteur.prenom} {annonce.auteur.nom} · {relatif(annonce.publieeLe, maintenant)}
        </span>
      </span>
    </Link>
  );
}

/** Accusés de lecture : total, barres par campus, noms de ceux qui n'ont pas lu, relance. */
export function PanneauLectures({ annonceId, expiree }: { annonceId: number; expiree?: boolean }) {
  const { data, isLoading, error, refetch } = useQuery<LecturesAnnonce>({ queryKey: [`/api/annonces/${annonceId}/lectures`], refetchInterval: 60_000 });
  const [relance, setRelance] = useState(false);
  const [tousLesNoms, setTousLesNoms] = useState(false);

  if (isLoading) return <Squelette className="h-40" />;
  if (error || !data) return <Erreur message={(error as Error | null)?.message ?? "Lectures indisponibles."} reessayer={() => void refetch()} />;

  const pct = data.total ? Math.round((data.lus / data.total) * 100) : 0;
  const nonLus = data.total - data.lus;
  const noms = tousLesNoms ? data.nonLus : data.nonLus.slice(0, 12);

  async function relancer() {
    setRelance(true);
    try {
      const r = await post<{ relances: number }>(`/api/annonces/${annonceId}/relancer`);
      toast(r.relances ? `Rappel envoyé à ${r.relances} personne${r.relances > 1 ? "s" : ""}.` : "Tout le monde a déjà lu.");
      await rafraichir(`/api/annonces/${annonceId}/lectures`, "/api/annonces/gestion");
    } catch (e) {
      toastErreur(e);
    } finally {
      setRelance(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3">
          <span className="text-[28px] font-black tabular-nums leading-none tracking-serre">
            {data.lus} <span className="text-lg font-bold text-texte-gris">/ {data.total}</span>
          </span>
          <span className="font-mono text-sm text-texte-pale">{pct} % ont lu</span>
        </div>
        <BarreProgression valeur={pct} ton={pct === 100 ? "succes" : "orange"} className="h-2" />
      </div>

      {data.parSite.length > 1 && (
        <ul className="flex flex-col gap-2.5" aria-label="Lectures par campus">
          {data.parSite.map((s) => {
            const p = s.total ? Math.round((s.lus / s.total) * 100) : 0;
            return (
              <li key={s.site} className="grid grid-cols-[96px_minmax(0,1fr)_56px] items-center gap-3 text-sm">
                <span className="truncate font-semibold">{s.site}</span>
                <BarreProgression valeur={p} ton={p === 100 ? "succes" : "orange"} />
                <span className="text-right font-mono text-xs tabular-nums text-texte-pale">
                  {s.lus}/{s.total}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {nonLus > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-bold">Pas encore lue par :</p>
          <ul className="flex flex-wrap gap-1.5">
            {noms.map((n) => (
              <li key={n} className="rounded-full bg-creme px-3 py-1.5 text-[13px] text-texte-doux">
                {n}
              </li>
            ))}
          </ul>
          {data.nonLus.length > noms.length && (
            <button type="button" onClick={() => setTousLesNoms(true)} className="self-start text-sm font-bold text-orange-fonce hover:text-encre">
              Voir les {data.nonLus.length - noms.length} autres
            </button>
          )}
          <Bouton
            variante="contour"
            onClick={() => void relancer()}
            chargement={relance}
            disabled={expiree}
            className="min-h-[48px] self-start"
            icone={<BellRing className="h-4 w-4" />}
          >
            Relancer les {nonLus} qui n'ont pas lu
          </Bouton>
          <p className="text-[13px] text-texte-gris">
            {expiree
              ? "L'annonce a expiré : elle n'est plus visible, la relance est fermée."
              : data.derniereRelance
                ? `Dernière relance ${relatif(data.derniereRelance)}. Une relance par heure au plus.`
                : "La relance renvoie la notification et un rappel sur le téléphone. Une relance par heure au plus."}
          </p>
        </div>
      ) : data.total ? (
        <p className="flex items-center gap-2 text-[15px] font-semibold text-succes">
          <CheckCircle2 className="h-5 w-5" aria-hidden /> Tout le monde a lu cette annonce.
        </p>
      ) : (
        <p className="text-[15px] text-texte-pale">Personne n'est concerné pour l'instant par ce public.</p>
      )}
    </div>
  );
}
