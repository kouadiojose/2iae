// Fuseau horaire des formateurs (et de l'équipe) : deviné par le navigateur,
// confirmé en un geste, modifiable dans le profil. Il sert à afficher
// « 08h30 Abidjan · 04h30 chez vous (Toronto) » partout où un formateur voit
// l'heure d'une séance, et à lui écrire ses rappels à son heure.
import { useMemo, useState } from "react";
import { Globe, Check, Search } from "lucide-react";
import { put, ErreurApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useMoiConnecte } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { heure, fuseauNavigateur, villeFuseau, FUSEAU_ABIDJAN } from "@/lib/dates";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { toast } from "@/components/ui/toast";
import { FUSEAUX_UTILES, type Moi } from "@shared/schema";

/** Lundi 28 septembre 2026, 08h30 à Abidjan : l'exemple parlant pour chacun. */
const EXEMPLE = "2026-09-28T08:30:00Z";

export async function enregistrerFuseau(fuseau: string): Promise<boolean> {
  try {
    const m = await put<Moi>("/api/compte/fuseau", { fuseau });
    queryClient.setQueryData(["/api/auth/moi"], m);
    toast(`Fuseau enregistré : ${villeFuseau(fuseau)}.`);
    return true;
  } catch (e) {
    toast(e instanceof ErreurApi ? e.message : "Le fuseau n'a pas pu être enregistré.", "erreur");
    return false;
  }
}

const personnel = (m: Moi) => m.role === "formateur" || m.role === "admin" || m.role === "vie_scolaire";

/** « Vous êtes à Toronto ? » : confirmation du fuseau deviné, tant qu'il n'est pas enregistré. */
export function ConfirmationFuseau({ className }: { className?: string }) {
  const moi = useMoiConnecte();
  const [envoi, setEnvoi] = useState(false);
  if (!personnel(moi) || moi.fuseau) return null;
  const devine = fuseauNavigateur() ?? FUSEAU_ABIDJAN;
  const ville = villeFuseau(devine);
  const abidjan = devine === FUSEAU_ABIDJAN || heure(EXEMPLE, devine) === heure(EXEMPLE);
  const confirmer = async () => {
    setEnvoi(true);
    await enregistrerFuseau(devine);
    setEnvoi(false);
  };
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border border-orange/40 bg-orange-pale p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5", className)} role="region" aria-label="Votre fuseau horaire">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-orange-fonce">
        <Globe className="h-5 w-5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[17px] font-extrabold">{devine === FUSEAU_ABIDJAN ? "Vous enseignez depuis Abidjan ?" : `Vous êtes à ${ville} ?`}</span>
        <span className="text-[15px] leading-snug text-texte-doux">
          {abidjan
            ? "Les horaires des cours vous seront donnés à l'heure d'Abidjan."
            : `Les horaires vous seront donnés à l'heure d'Abidjan et à la vôtre : lundi 08h30 à Abidjan, c'est ${heure(EXEMPLE, devine)} chez vous.`}
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
        <Bouton onClick={() => void confirmer()} chargement={envoi} icone={<Check className="h-4 w-4" />} className="min-h-[48px]">
          Oui, c'est bien ça
        </Bouton>
        <LienBouton href="/profil#fuseau" variante="contour" className="min-h-[48px]">
          Choisir ma ville
        </LienBouton>
      </div>
    </div>
  );
}

function tousLesFuseaux(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const REGIONS: Record<string, string> = {
  Africa: "Afrique",
  America: "Amériques",
  Antarctica: "Antarctique",
  Asia: "Asie",
  Atlantic: "Atlantique",
  Australia: "Australie",
  Europe: "Europe",
  Indian: "Océan Indien",
  Pacific: "Pacifique",
};
/** Pays (fuseaux utiles) ou grande région, jamais le code technique. */
const detailFuseau = (f: string) => FUSEAUX_UTILES.find((x) => x.fuseau === f)?.pays ?? REGIONS[f.split("/")[0]] ?? "";

/** Choix du fuseau dans le profil : liste courte des fuseaux utiles, et recherche. */
export function ChoixFuseau() {
  const moi = useMoiConnecte();
  const maintenant = useMaintenant(30_000);
  const [recherche, setRecherche] = useState("");
  const [envoi, setEnvoi] = useState<string | null>(null);
  const devine = fuseauNavigateur();
  const actuel = moi.fuseau;
  const tous = useMemo(tousLesFuseaux, []);

  const resultats = useMemo(() => {
    const q = sansAccents(recherche.trim());
    if (q.length < 2) return [];
    const utiles = FUSEAUX_UTILES.filter((f) => sansAccents(`${f.ville} ${f.pays} ${f.fuseau}`).includes(q)).map((f) => f.fuseau);
    const autres = tous.filter((f) => !utiles.includes(f) && sansAccents(`${f} ${villeFuseau(f)}`).includes(q));
    return [...utiles, ...autres].slice(0, 8);
  }, [recherche, tous]);

  const choisir = async (f: string) => {
    setEnvoi(f);
    if (await enregistrerFuseau(f)) setRecherche("");
    setEnvoi(null);
  };

  const Option = ({ f, detail }: { f: string; detail?: string }) => {
    const choisi = actuel === f;
    return (
      <button
        type="button"
        onClick={() => !choisi && void choisir(f)}
        disabled={envoi !== null}
        aria-pressed={choisi}
        className={cn(
          "flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors",
          choisi ? "border-orange bg-orange-pale" : "border-ligne bg-white hover:border-orange",
        )}
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-bold">{villeFuseau(f)}</span>
          <span className="truncate text-[13px] text-texte-gris">{detail ?? detailFuseau(f)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 font-mono text-[13px] text-texte-doux">
          {heure(maintenant, f)}
          {choisi && <Check className="h-4 w-4 text-orange-fonce" aria-label="Choisi" />}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-creme p-4 text-[15px] leading-snug text-texte-doux">
        {actuel ? (
          <>
            Votre fuseau : <strong className="text-encre">{villeFuseau(actuel)}</strong>. Il est {heure(maintenant, actuel)} chez vous et {heure(maintenant)} à Abidjan.
            {actuel !== FUSEAU_ABIDJAN && <> Lundi 08h30 à Abidjan, c'est {heure(EXEMPLE, actuel)} chez vous.</>}
          </>
        ) : (
          <>
            Fuseau pas encore confirmé.{" "}
            {devine ? (
              <>
                Votre navigateur indique <strong className="text-encre">{villeFuseau(devine)}</strong> ({heure(maintenant, devine)} en ce moment).
              </>
            ) : (
              "Choisissez votre ville ci-dessous."
            )}
          </>
        )}
      </div>
      {!actuel && devine && (
        <Bouton onClick={() => void choisir(devine)} chargement={envoi === devine} icone={<Check className="h-4 w-4" />} className="min-h-[48px] self-start">
          Confirmer {villeFuseau(devine)}
        </Bouton>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {FUSEAUX_UTILES.map((f) => (
          <Option key={f.fuseau} f={f.fuseau} detail={f.pays} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="recherche-fuseau" className="text-sm font-bold">
          Une autre ville ?
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-texte-gris" aria-hidden />
          <input
            id="recherche-fuseau"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Tapez une ville, en français ou en anglais (Québec, Madrid, Tokyo…)"
            className="w-full rounded-xl border border-ligne bg-white py-3 pl-10 pr-4 text-[15px] outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
          />
        </div>
        {recherche.trim().length >= 2 &&
          (resultats.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {resultats.map((f) => (
                <Option key={f} f={f} />
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-texte-gris">Aucune ville trouvée. Essayez le nom en anglais, ou la grande ville la plus proche.</p>
          ))}
      </div>
    </div>
  );
}
