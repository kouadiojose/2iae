// « Ma classe » : pendant son premier mois, l'étudiant corrige lui-même sa classe (sa filière n'était pas encore
// proposée quand il s'est inscrit, ou il s'est trompé). Au-delà, la vie scolaire s'en charge.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { post } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Selection } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import type { InfoInscriptionEtudiantDto, Moi } from "@shared/schema";
import { installerMoi } from "../../outils";
import { Section } from "./Section";

export const peutCorrigerClasse = (moi: Moi) => moi.role === "etudiant" && Date.now() - new Date(moi.creeLe).getTime() < 30 * 24 * 3600_000;

export function MaClasse({ moi }: { moi: Moi }) {
  const { data } = useQuery<InfoInscriptionEtudiantDto>({ queryKey: ["/api/inscription"] });
  const actuelle = data?.classes.find((c) => c.id === moi.classeId);
  const [siteId, setSiteId] = useState<number | null>(null);
  const [classeId, setClasseId] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const site = siteId ?? actuelle?.siteId ?? moi.siteId ?? null;
  const classes = (data?.classes ?? []).filter((c) => c.siteId === site);
  const choisie = classeId ?? moi.classeId ?? null;
  const changer = async () => {
    if (!choisie || choisie === moi.classeId) return;
    setEnvoi(true);
    try {
      installerMoi(await post<Moi>("/api/compte/classe", { classeId: choisie }));
      toast("Ta classe est changée : tu vois maintenant ses cours.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Section id="classe" titre="Ma classe" icone={<GraduationCap className="h-5 w-5" />} description="Tu t'es inscrit dans une classe qui n'est pas la tienne ? Choisis ta vraie filière et ton année : tu le peux pendant ton premier mois.">
      <div className="flex flex-col gap-3">
        <p className="text-[15px] text-texte-doux">
          Aujourd'hui : <strong className="text-encre">{actuelle?.nom ?? moi.classe?.nom ?? "aucune classe"}</strong>
        </p>
        <Selection libelle="Ton campus" value={site ?? ""} onChange={(e) => { setSiteId(Number(e.target.value)); setClasseId(null); }}>
          <option value="" disabled>
            Choisis ton campus
          </option>
          {(data?.sites ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.nomCourt}
            </option>
          ))}
        </Selection>
        <Selection libelle="Ta classe (filière, option et année)" value={choisie ?? ""} onChange={(e) => setClasseId(Number(e.target.value))}>
          <option value="" disabled>
            Choisis ta classe
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </Selection>
        <Bouton className="self-start" chargement={envoi} disabled={!choisie || choisie === moi.classeId} onClick={() => void changer()}>
          Changer de classe
        </Bouton>
      </div>
    </Section>
  );
}
