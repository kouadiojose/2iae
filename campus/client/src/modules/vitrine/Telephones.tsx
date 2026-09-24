// « Le campus dans la poche » : les deux téléphones de la maquette (le live en
// mode nuit et l'accueil « Aujourd'hui »). Illustration statique et légère (pas
// d'image), au contenu fictif de la maquette.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Un téléphone dessiné à 300 × 620, réduit à 72 % sur les petits écrans. */
function Telephone({ children, sombre, className }: { children: ReactNode; sombre?: boolean; className?: string }) {
  return (
    <div className={cn("h-[446px] w-[216px] shrink-0 md:h-[620px] md:w-[300px]", className)}>
      <div className="h-[620px] w-[300px] origin-top-left scale-[.72] rounded-[44px] bg-encre p-2.5 shadow-telephone md:scale-100">
        <div className={cn("flex h-full w-full flex-col overflow-hidden rounded-[36px]", sombre ? "bg-nuit text-white" : "bg-white text-encre")}>{children}</div>
      </div>
    </div>
  );
}

function BarreEtat({ h }: { h: string }) {
  return (
    <div className="flex justify-between px-5 pb-2 pt-3.5 text-xs font-bold">
      <span>{h}</span>
      <span>4G</span>
    </div>
  );
}

function TelephoneLive() {
  const code = "IA-101";
  const ini = "FR";
  return (
    <Telephone sombre>
      <BarreEtat h="10:14" />
      <div className="flex items-center justify-between px-4 py-1.5">
        <span className="text-[13px] font-extrabold">{code} · Live</span>
        <span className="font-mono text-[10px] text-[#FF8A6B]">● EN DIRECT</span>
      </div>
      <div className="mx-3 my-2 grid aspect-[16/10] place-items-center rounded-2xl border-2 border-orange bg-nuit-carte">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-orange font-black text-encre">{ini}</span>
      </div>
      <div className="mx-3 grid grid-cols-3 gap-1.5">
        {["Yopougon", "Yamoussoukro", "Azaguié"].map((n) => (
          <div key={n} className="grid aspect-square place-items-end justify-start rounded-[10px] bg-nuit-carte p-1.5 text-[9px] font-bold">
            {n}
          </div>
        ))}
      </div>
      <div className="m-3 flex flex-1 flex-col gap-2">
        <div className="rounded-xl bg-nuit-bulle p-2.5 text-xs leading-snug">
          <span className="block font-mono text-[10px] text-orange">M'Batto · 12 votes</span>
          L'IA peut-elle aider un agriculteur à prévoir sa récolte ?
        </div>
      </div>
      <div className="flex justify-around px-2.5 pb-5 pt-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-nuit-ligne text-[11px] font-bold">Micro</span>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-orange text-[11px] font-extrabold text-encre">Main</span>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-nuit-ligne text-[11px] font-bold">Q&amp;R</span>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-direct text-[11px] font-bold">Quitter</span>
      </div>
    </Telephone>
  );
}

function TelephoneAccueil() {
  const jour = "mardi 29 septembre";
  const titre = "Initiation à l'intelligence artificielle";
  const quand = "10H00";
  const cours = [
    { t: "Création d'entreprise", p: 62 },
    { t: "Réseaux et télécoms", p: 45 },
    { t: "Comptabilité générale", p: 78 },
  ];
  return (
    <Telephone>
      <BarreEtat h="09:02" />
      <div className="flex flex-col gap-0.5 px-[18px] py-2">
        <span className="text-[11px] text-texte-gris">{jour.charAt(0).toUpperCase() + jour.slice(1)}</span>
        <span className="text-2xl font-black tracking-[-0.02em]">Bonjour Aya</span>
      </div>
      <div className="mx-3.5 my-2.5 flex flex-col gap-1.5 rounded-[18px] bg-orange p-3.5 text-encre">
        <span className="font-mono text-[10px]">EN DIRECT À {quand}</span>
        <span className="line-clamp-2 text-base font-extrabold leading-[1.15]">{titre}</span>
        <span className="mt-1.5 rounded-[10px] bg-encre p-2.5 text-center text-[13px] font-bold text-white">Rejoindre</span>
      </div>
      <div className="px-[18px] py-1.5 text-[13px] font-extrabold">Mes cours</div>
      <div className="flex flex-col gap-2 px-3.5">
        {cours.map((c) => (
          <div key={c.t} className="flex flex-col gap-[7px] rounded-[14px] border border-ligne px-3 py-2.5">
            <div className="flex justify-between text-[12.5px] font-bold">
              <span>{c.t}</span>
              <span>{c.p}%</span>
            </div>
            <div className="h-1 rounded-full bg-[#F3EAE2]">
              <div className="h-full rounded-full bg-orange" style={{ width: `${c.p}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto flex justify-around border-t border-[#F0E8E1] px-2 pb-[22px] pt-3 text-[10.5px] font-bold text-texte-gris">
        <span className="text-orange-fonce">Aujourd'hui</span>
        <span>Cours</span>
        <span>Live</span>
        <span>Devoirs</span>
        <span>Messages</span>
      </div>
    </Telephone>
  );
}

/** Les deux téléphones : côte à côte sur ordinateur, superposés sur téléphone. */
export function Telephones() {
  return (
    <div className="relative mx-auto h-[492px] w-full max-w-[358px] md:flex md:h-auto md:max-w-none md:justify-center md:gap-6" aria-hidden>
      <div className="absolute left-0 top-0 -rotate-3 md:static md:rotate-0">
        <TelephoneLive />
      </div>
      <div className="absolute right-0 top-11 rotate-2 md:static md:rotate-0">
        <TelephoneAccueil />
      </div>
    </div>
  );
}
