// Lieu d'enseignement du formateur : tantôt Nice, tantôt Toronto. Un geste
// règle ensemble la ville que voient les salles (« José Kouadio · depuis
// Nice ») et l'heure « chez vous » des horaires et des rappels. Les lieux
// déjà utilisés restent à portée de clic ; quand l'ordinateur change de
// fuseau (arrivée à Toronto), le campus propose le bon lieu.
import { useMemo, useState } from "react";
import { MapPin, Check, Plus, X } from "lucide-react";
import { put, api, ErreurApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useMoiConnecte } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { heure, fuseauNavigateur, villeFuseau } from "@/lib/dates";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { Bouton } from "@/components/ui/bouton";
import { toast } from "@/components/ui/toast";
import { FUSEAUX_UTILES, type LieuEnseignement, type Moi } from "@shared/schema";

const villeCourte = (ville: string) => ville.split(",")[0].trim();

/** « Toronto, Canada » à partir d'un fuseau connu ; la ville du fuseau sinon. */
function villeProposee(fuseau: string): string {
  const connu = FUSEAUX_UTILES.find((f) => f.fuseau === fuseau);
  return connu ? `${connu.ville}, ${connu.pays.split(",")[0].trim()}` : villeFuseau(fuseau);
}

const cleIgnore = (fuseau: string) => `campus:lieu-ignore:${fuseau}:${new Date().toISOString().slice(0, 10)}`;
function ignoreAujourdhui(fuseau: string): boolean {
  try {
    return window.localStorage.getItem(cleIgnore(fuseau)) === "1";
  } catch {
    return false;
  }
}

async function appliquer(m: Moi, message?: string) {
  queryClient.setQueryData(["/api/auth/moi"], m);
  // Séances, accueil, fiches : la ville et les heures affichées changent partout.
  await queryClient.invalidateQueries();
  if (message) toast(message);
}

export function LieuDuCours({ nuit = false, compact = false, className }: { nuit?: boolean; compact?: boolean; className?: string }) {
  const moi = useMoiConnecte();
  const maintenant = useMaintenant(30_000);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [formulaire, setFormulaire] = useState<LieuEnseignement | null>(null);
  const [ignore, setIgnore] = useState(false);
  const navigateur = fuseauNavigateur();

  const lieux = useMemo<LieuEnseignement[]>(() => {
    const liste = [...(moi.lieux ?? [])];
    if (moi.localisation && moi.fuseau && !liste.some((l) => l.ville === moi.localisation)) liste.unshift({ ville: moi.localisation, fuseau: moi.fuseau });
    return liste;
  }, [moi.lieux, moi.localisation, moi.fuseau]);

  if (moi.role !== "formateur" || (!moi.fuseau && !moi.localisation)) return null;

  const actif = lieux.find((l) => l.ville === moi.localisation) ?? null;
  const memeHeure = (a: string, b: string) => heure(maintenant, a) === heure(maintenant, b);
  // L'ordinateur n'est plus à l'heure du lieu choisi : on propose le lieu qui correspond.
  const decale = Boolean(navigateur && moi.fuseau && !memeHeure(navigateur, moi.fuseau) && !ignore && !ignoreAujourdhui(navigateur));
  const candidat = decale ? lieux.find((l) => memeHeure(l.fuseau, navigateur!)) : undefined;

  const choisir = async (l: LieuEnseignement) => {
    setEnvoi(l.ville);
    try {
      const m = await put<Moi>("/api/compte/lieu", l);
      setFormulaire(null);
      await appliquer(m, `Vous enseignez depuis ${villeCourte(l.ville)} : les salles le voient, vos horaires sont à l'heure de ${villeCourte(l.ville)}.`);
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : "Le lieu n'a pas pu être enregistré.", "erreur");
    } finally {
      setEnvoi(null);
    }
  };
  const oublier = async (l: LieuEnseignement) => {
    try {
      await appliquer(await api<Moi>("/api/compte/lieu", { methode: "DELETE", corps: { ville: l.ville } }));
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : "Ce lieu n'a pas pu être retiré.", "erreur");
    }
  };
  const ignorer = () => {
    setIgnore(true);
    try {
      if (navigateur) window.localStorage.setItem(cleIgnore(navigateur), "1");
    } catch {
      /* stockage indisponible : la suggestion revient au prochain chargement */
    }
  };

  const puce = (actifPuce: boolean) =>
    cn(
      "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold transition-colors",
      nuit
        ? actifPuce
          ? "border-orange bg-orange text-encre"
          : "border-nuit-ligne bg-nuit-carte text-white hover:border-orange-peche"
        : actifPuce
          ? "border-orange bg-orange-pale text-encre"
          : "border-ligne bg-white text-encre hover:border-orange",
    );

  const fuseauxProposes = [...new Set([formulaire?.fuseau, navigateur, moi.fuseau, ...FUSEAUX_UTILES.map((f) => f.fuseau)].filter(Boolean) as string[])];

  return (
    <section
      aria-label="Lieu d'où vous enseignez"
      className={cn(
        "flex flex-col gap-3",
        !compact && (nuit ? "rounded-[18px] bg-nuit-panneau p-4" : "rounded-2xl border border-ligne bg-white p-4 sm:p-5"),
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={cn("inline-flex items-center gap-2 text-[15px]", nuit ? "text-nuit-texte" : "text-texte-doux")}>
          <MapPin className={cn("h-4 w-4 shrink-0", nuit ? "text-orange-peche" : "text-orange-fonce")} aria-hidden />
          {compact ? "Vous enseignez depuis" : (
            <span>
              Vous enseignez depuis <strong className={nuit ? "text-white" : "text-encre"}>{actif ? actif.ville : moi.localisation ?? villeFuseau(moi.fuseau!)}</strong>
              {moi.fuseau && <span className={nuit ? "text-nuit-gris" : "text-texte-gris"}> · {heure(maintenant, moi.fuseau)} chez vous</span>}
            </span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {lieux.map((l) => {
            const choisi = l.ville === moi.localisation;
            return (
              <span key={l.ville} className="group relative inline-flex">
                <button type="button" onClick={() => !choisi && void choisir(l)} disabled={envoi !== null} aria-pressed={choisi} className={puce(choisi)} title={`${l.ville} · ${heure(maintenant, l.fuseau)} là-bas`}>
                  {choisi && <Check className="h-4 w-4" aria-hidden />}
                  {villeCourte(l.ville)}
                </button>
                {!choisi && !compact && (
                  <button
                    type="button"
                    onClick={() => void oublier(l)}
                    className={cn("absolute -right-1.5 -top-1.5 hidden h-5 w-5 place-items-center rounded-full group-hover:grid", nuit ? "bg-nuit-ligne text-white" : "bg-encre text-white")}
                    aria-label={`Retirer ${l.ville} de mes lieux`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })}
          <button type="button" onClick={() => setFormulaire(formulaire ? null : { ville: "", fuseau: navigateur ?? moi.fuseau ?? "Africa/Abidjan" })} className={puce(false)}>
            <Plus className="h-4 w-4" aria-hidden /> Autre lieu
          </button>
        </div>
      </div>

      {decale && !formulaire && (
        <div className={cn("flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between", nuit ? "bg-orange/15" : "bg-orange-pale")}>
          <p className={cn("text-[14px] leading-snug", nuit ? "text-white" : "text-encre")}>
            Votre ordinateur est à l'heure de {candidat ? villeCourte(candidat.ville) : villeFuseau(navigateur!)} ({heure(maintenant, navigateur!)}).{" "}
            {candidat ? `Vous enseignez depuis ${villeCourte(candidat.ville)} aujourd'hui ?` : "Vous enseignez d'un autre lieu aujourd'hui ?"}
          </p>
          <div className="flex shrink-0 gap-2">
            <Bouton taille="sm" chargement={envoi !== null} onClick={() => (candidat ? void choisir(candidat) : setFormulaire({ ville: villeProposee(navigateur!), fuseau: navigateur! }))}>
              {candidat ? `Oui, depuis ${villeCourte(candidat.ville)}` : "Choisir ce lieu"}
            </Bouton>
            <Bouton taille="sm" variante={nuit ? "nuit" : "contour"} onClick={ignorer}>
              Non
            </Bouton>
          </div>
        </div>
      )}

      {formulaire && (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (formulaire.ville.trim().length >= 2) void choisir({ ville: formulaire.ville.trim(), fuseau: formulaire.fuseau });
          }}
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={cn("text-[13px] font-semibold", nuit ? "text-nuit-texte" : "text-texte-doux")}>Ville (telle que les salles la verront)</span>
            <input
              autoFocus
              value={formulaire.ville}
              onChange={(e) => setFormulaire({ ...formulaire, ville: e.target.value })}
              placeholder="Nice, France"
              maxLength={80}
              className={cn("min-h-11 rounded-xl border px-3 text-[15px]", nuit ? "border-nuit-ligne bg-nuit-carte text-white" : "border-ligne bg-white")}
            />
          </label>
          <label className="flex flex-col gap-1 sm:w-64">
            <span className={cn("text-[13px] font-semibold", nuit ? "text-nuit-texte" : "text-texte-doux")}>Heure locale</span>
            <select
              value={formulaire.fuseau}
              onChange={(e) => setFormulaire({ ...formulaire, fuseau: e.target.value })}
              className={cn("min-h-11 rounded-xl border px-3 text-[15px]", nuit ? "border-nuit-ligne bg-nuit-carte text-white" : "border-ligne bg-white")}
            >
              {fuseauxProposes.map((f) => (
                <option key={f} value={f}>
                  {villeFuseau(f)} · {heure(maintenant, f)}
                </option>
              ))}
            </select>
          </label>
          <Bouton type="submit" chargement={envoi !== null} disabled={formulaire.ville.trim().length < 2} className="min-h-11">
            Enseigner depuis ce lieu
          </Bouton>
        </form>
      )}
    </section>
  );
}
