// Guide « Tes rappels n'arrivent pas » (chantier C3) : TECNO, Infinix et itel
// (environ un téléphone sur quatre en Côte d'Ivoire) ferment Chrome en
// arrière-plan pour économiser la batterie, et les rappels n'arrivent plus.
// La marque se choisit d'un toucher (on ne lit jamais le modèle du téléphone),
// puis trois étapes courtes, en texte et en icônes. Les menus changent d'une
// version du système à l'autre : textes courts, et la vie scolaire au bout.
import { useState, type ComponentType } from "react";
import { BatteryCharging, Bell, ChevronLeft, ListPlus, MessageCircleQuestion, Rocket, Settings, Smartphone, ToggleRight } from "lucide-react";
import { useMoi } from "@/lib/auth";
import { useTextes } from "@/lib/textes";
import { lienAide } from "@/components/layout/coquille";
import { cn } from "@/lib/utils";
import { estInstallee, plateforme } from "@/modules/pwa/outils";
import { t } from "@shared/textes/rappels";
import { MARQUES, type Marque } from "@shared/engagement/envois";

type Icone = ComponentType<{ className?: string }>;

/** Icône de chaque étape, par marque (les textes sont dans shared/textes/rappels.ts). */
const ICONES: Record<Marque, [Icone, Icone, Icone]> = {
  tecno: [Smartphone, Rocket, ToggleRight],
  infinix: [Smartphone, Rocket, ToggleRight],
  itel: [Smartphone, Rocket, ToggleRight],
  samsung: [Settings, BatteryCharging, ListPlus],
  autre: [Settings, BatteryCharging, Bell],
};

export function GuideRappelsAndroid({ marqueInitiale, onMarque }: { marqueInitiale?: Marque | null; onMarque?: (m: Marque) => void }) {
  const tx = useTextes(t);
  const { moi } = useMoi();
  const [marque, setMarque] = useState<Marque | null>(marqueInitiale ?? null);
  const aide = moi ? lienAide(moi) : null;
  const systeme = plateforme();

  const lienAideWhatsApp = aide ? (
    <a
      href={aide}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-ligne px-4 py-2.5 text-encre no-underline hover:border-orange hover:text-encre"
    >
      <MessageCircleQuestion className="h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
      <span className="flex flex-col">
        <span className="font-bold">{tx("guide.aide")}</span>
        <span className="text-sm text-texte-pale">{tx("guide.aideTexte")}</span>
      </span>
    </a>
  ) : null;

  // iPhone ou ordinateur : pas de gestion de batterie à régler, seulement l'autorisation.
  if (systeme !== "android") {
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-start gap-3 rounded-2xl bg-creme px-4 py-3 text-[15px] leading-relaxed">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
          <span>{tx(systeme === "ios" ? "guide.iphone" : "guide.ordinateur")}</span>
        </p>
        <p className="text-sm text-texte-pale">{tx("guide.ensuite")}</p>
        {lienAideWhatsApp}
      </div>
    );
  }

  if (!marque) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-base font-bold">{tx("guide.titre")}</p>
          <p className="text-sm text-texte-pale">{tx("guide.sousTitre")}</p>
        </div>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={tx("guide.titre")}>
          {MARQUES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMarque(m);
                onMarque?.(m);
              }}
              className={cn(
                "min-h-[48px] rounded-xl border-[1.5px] border-ligne bg-white px-3 py-2.5 text-[15px] font-bold text-encre hover:border-orange hover:bg-orange-pale",
                m === "autre" && "col-span-2",
              )}
            >
              {tx(`guide.marque.${m}`)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const app = "Chrome";
  const icones = ICONES[marque];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base font-bold">{tx("guide.etapesTitre", { v: { marque: tx(`guide.marque.${marque}`) } })}</p>
      <ol className="flex flex-col gap-2.5">
        {([1, 2, 3] as const).map((n, i) => {
          const IconeEtape = icones[i];
          return (
            <li key={n} className="flex items-start gap-3 text-[15px] leading-snug">
              <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-clair text-orange-fonce">
                <IconeEtape className="h-5 w-5" aria-hidden />
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-orange text-[11px] font-extrabold text-encre">{n}</span>
              </span>
              <span className="pt-2">{tx(`guide.${marque}.${n}`, { v: { app } })}</span>
            </li>
          );
        })}
      </ol>
      {marque !== "autre" && <p className="text-sm leading-relaxed text-texte-pale">{tx("guide.notifications", { v: { app } })}</p>}
      {estInstallee() && <p className="text-sm leading-relaxed text-texte-pale">{tx("guide.aussiApp")}</p>}
      <p className="text-sm font-semibold">{tx("guide.ensuite")}</p>
      <button
        type="button"
        onClick={() => setMarque(null)}
        className="inline-flex min-h-[44px] items-center gap-1 self-start text-[15px] font-semibold text-texte-pale hover:text-encre"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden /> {tx("guide.changer")}
      </button>
      {lienAideWhatsApp}
    </div>
  );
}
