// Préférences (données réduites, façon de suivre les cours) et rappels sur
// ce téléphone. Chaque choix est enregistré aussitôt.
import { useState } from "react";
import { BellRing, SlidersHorizontal } from "lucide-react";
import { patch, ErreurApi } from "@/lib/api";
import { Interrupteur } from "@/components/ui/champs";
import { toast } from "@/components/ui/toast";
import { ActiverNotifications } from "@/modules/pwa/ActiverNotifications";
import type { Moi, PreferencesUtilisateur } from "@shared/schema";
import { majMoi, tuOuVous } from "../../outils";
import { CarteChoix, GroupeChoix, OPTIONS_SUIVI } from "../Choix";
import { Section } from "./Section";

export function Preferences({ moi }: { moi: Moi }) {
  const t = tuOuVous(moi);
  const prefs = moi.preferences ?? {};
  const [envoi, setEnvoi] = useState(false);

  async function changer(p: PreferencesUtilisateur) {
    setEnvoi(true);
    try {
      majMoi(await patch<Moi>("/api/compte/preferences", p));
      toast("Préférence enregistrée.");
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : "Une erreur est survenue.", "erreur");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Section
      id="preferences"
      titre="Préférences et données"
      icone={<SlidersHorizontal className="h-5 w-5" />}
      description={t("Pour que le campus s'adapte à ton forfait internet.", "Pour adapter le campus à votre connexion.")}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4 rounded-2xl bg-creme p-4">
          <div>
            <p className="text-[16px] font-extrabold">Données réduites</p>
            <p className="mt-0.5 text-[14px] leading-snug text-texte-pale">
              {t(
                "Lives en audio et diapos, images allégées, pas d'animations. Idéal avec un petit forfait.",
                "Lives en audio et diapos, images allégées, pas d'animations. Utile en déplacement.",
              )}
            </p>
          </div>
          <div className="pt-1">
            <Interrupteur actif={Boolean(prefs.donneesReduites)} onChange={(v) => !envoi && void changer({ donneesReduites: v })} libelle="Données réduites" />
          </div>
        </div>

        {moi.role === "etudiant" && (
          <div className="flex flex-col gap-3">
            <p className="text-[16px] font-extrabold">Comment suis-tu les cours le plus souvent ?</p>
            <GroupeChoix libelle="Comment suis-tu les cours ?">
              {OPTIONS_SUIVI.map((o) => (
                <CarteChoix
                  key={o.valeur}
                  compacte
                  choisie={prefs.modeSuivi === o.valeur}
                  onChoisir={() => prefs.modeSuivi !== o.valeur && !envoi && void changer({ modeSuivi: o.valeur })}
                  titre={o.titre}
                  icone={o.icone}
                />
              ))}
            </GroupeChoix>
          </div>
        )}
      </div>
    </Section>
  );
}

export function Rappels({ moi }: { moi: Moi }) {
  const t = tuOuVous(moi);
  return (
    <Section
      id="rappels"
      titre="Rappels sur ce téléphone"
      icone={<BellRing className="h-5 w-5" />}
      description={t(
        "Un rappel 15 minutes avant chaque cours en direct et la veille d'un devoir. Jamais entre 21 h et 6 h.",
        "Un rappel avant chaque séance et quand un étudiant vous écrit. Jamais entre 21 h et 6 h.",
      )}
    >
      <ActiverNotifications />
    </Section>
  );
}
