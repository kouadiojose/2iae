// Cadre des pages « avant connexion » (connexion, code oublié, nouveau code,
// lien d'activation périmé) : épuré sur téléphone ; sur ordinateur, un grand
// panneau encre reprend l'accroche de la maquette.
import { useState, type ReactNode } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { Marque } from "@/components/layout/coquille";
import { AideWhatsApp, useContactsSites } from "./AideWhatsApp";

export function CadrePublic({ children, identifiant }: { children: ReactNode; identifiant?: string }) {
  const [aide, setAide] = useState(false);
  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <PanneauMarque />
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-7 sm:py-4">
          <div className="lg:invisible">
            <Marque />
          </div>
          <button
            type="button"
            onClick={() => setAide(true)}
            className="flex min-h-[48px] items-center gap-2 rounded-full px-3 text-[15px] font-bold text-texte-doux hover:bg-creme hover:text-encre"
          >
            <MessageCircleQuestion className="h-5 w-5 text-orange-fonce" />
            <span>Besoin d'aide ?</span>
          </button>
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-4 sm:items-center sm:px-7 sm:pt-0">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
        <footer className="px-4 pb-6 text-center font-mono text-[11px] text-texte-gris">Groupe Écoles 2IAE International · Campus numérique</footer>
      </div>
      <AideWhatsApp ouverte={aide} onFermer={() => setAide(false)} identifiant={identifiant} />
    </div>
  );
}

const CAMPUS_PAR_DEFAUT = ["Riviera", "Yopougon", "Yamoussoukro", "Azaguié", "M'Batto"];

/** Panneau de gauche (ordinateur) : l'accroche de la maquette et les cinq campus. */
function PanneauMarque() {
  const { data } = useContactsSites();
  const campus = data?.length ? data.map((s) => s.nomCourt) : CAMPUS_PAR_DEFAUT;
  return (
    <aside className="relative hidden min-h-dvh flex-col justify-between overflow-hidden bg-encre p-12 text-white lg:flex xl:p-16">
      <Marque sombre />
      <div className="flex flex-col gap-6">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-peche">L'École des Entrepreneurs · Rentrée 2026</span>
        <h2 className="text-[clamp(48px,5vw,76px)] font-black leading-[0.95] tracking-tres-serre">
          Un cours.
          <br />
          Cinq campus.
          <br />
          <span className="text-orange">En direct.</span>
        </h2>
        <p className="max-w-md text-lg leading-relaxed text-nuit-doux">
          Tes cours, tes devoirs, tes replays et tes formateurs, depuis ton téléphone, ton ordinateur ou la salle de conférence de ton campus.
        </p>
      </div>
      <ul className="grid grid-cols-5 gap-2" aria-label="Les cinq campus">
        {campus.map((nom, i) => (
          <li key={nom} className="flex flex-col gap-2 rounded-2xl bg-nuit-carte p-3">
            <span className="point-direct bg-orange" style={{ animationDelay: `${i * 0.28}s` }} />
            <span className="truncate text-[13px] font-bold">{nom}</span>
          </li>
        ))}
      </ul>
      <div aria-hidden className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-orange/20 blur-3xl" />
    </aside>
  );
}
