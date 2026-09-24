// /activer/:jeton : le QR de la fiche de connexion. L'étudiant n'a rien à
// taper : on l'accueille (« On prépare ton campus… ») puis on l'emmène
// choisir son code secret.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Link2Off } from "lucide-react";
import { get, ErreurApi } from "@/lib/api";
import { LienBouton } from "@/components/ui/bouton";
import { cn } from "@/lib/utils";
import type { Moi } from "@shared/schema";
import { CadrePublic } from "./composants/CadrePublic";
import { ListeContactsSites, useContactsSites } from "./composants/AideWhatsApp";
import { attendre, installerMoi } from "./outils";

const CAMPUS_PAR_DEFAUT = ["Riviera", "Yopougon", "Yamoussoukro", "Azaguié", "M'Batto"];
/** Durée minimale de l'écran d'accueil : le premier contact doit rassurer, pas clignoter. */
const DUREE_ACCUEIL_MS = 3200;

export default function PageActiver({ jeton }: { jeton: string }) {
  const [, naviguer] = useLocation();
  const [moi, setMoi] = useState<Moi | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const lance = useRef(false);

  useEffect(() => {
    if (lance.current) return; // le jeton ne sert qu'une fois : jamais deux appels
    lance.current = true;
    const debut = Date.now();
    get<Moi>(`/api/activer/${encodeURIComponent(jeton)}`)
      .then(async (m) => {
        setMoi(m);
        await attendre(Math.max(0, DUREE_ACCUEIL_MS - (Date.now() - debut)));
        installerMoi(m, true);
        naviguer("/bienvenue", { replace: true });
      })
      .catch((e) => {
        setErreur(e instanceof ErreurApi ? e.message : "Une erreur est survenue. Réessaie dans un instant.");
      });
  }, [jeton, naviguer]);

  if (erreur) return <LienPerime message={erreur} />;
  return <EcranPreparation moi={moi} />;
}

function EcranPreparation({ moi }: { moi: Moi | null }) {
  const { data } = useContactsSites();
  const campus = data?.length ? data.map((s) => s.nomCourt) : CAMPUS_PAR_DEFAUT;
  const monCampus = moi?.site?.nomCourt;
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-encre px-6 text-center text-white" aria-live="polite">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-orange/25 blur-3xl" />
      <img src="/marque-2iae.svg" alt="Groupe 2IAE" className="relative h-14 w-auto animate-monte brightness-0 invert" />

      <div className="relative mt-10 flex min-h-[132px] flex-col items-center gap-3">
        {moi ? (
          <>
            <span className="animate-monte font-mono text-xs uppercase tracking-[0.14em] text-orange-peche">Ton campus est prêt</span>
            <h1 className="animate-monte text-[44px] font-black leading-none tracking-tres-serre sm:text-[56px]">
              Akwaba, <span className="text-orange">{moi.prenom}</span> !
            </h1>
            {(moi.classe || moi.site) && (
              <p className="animate-monte text-base text-nuit-doux" style={{ animationDelay: "0.15s" }}>
                {[moi.classe?.nom, moi.site ? `campus ${moi.site.nomCourt}` : null].filter(Boolean).join(" · ")}
              </p>
            )}
          </>
        ) : (
          <>
            <span className="animate-monte font-mono text-xs uppercase tracking-[0.14em] text-orange-peche">Campus numérique</span>
            <h1 className="animate-monte text-[36px] font-black leading-tight tracking-tres-serre sm:text-[48px]">On prépare ton campus…</h1>
          </>
        )}
      </div>

      {/* Les cinq campus s'allument l'un après l'autre, comme sur l'écran des salles. */}
      <ul className="relative mt-10 grid w-full max-w-[520px] grid-cols-5 gap-2" aria-label="Les cinq campus">
        {campus.map((nom, i) => {
          const le = monCampus === nom;
          return (
            <li
              key={nom}
              className={cn("flex animate-monte flex-col items-center gap-2 rounded-2xl px-1 py-3 transition-colors duration-500", le ? "bg-orange text-encre" : "bg-nuit-carte")}
              style={{ animationDelay: `${0.35 + i * 0.3}s` }}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", le ? "bg-encre" : "bg-orange")} />
              <span className="w-full truncate text-[11px] font-bold sm:text-[13px]">{nom}</span>
            </li>
          );
        })}
      </ul>

      <div className="relative mt-10 h-1 w-48 overflow-hidden rounded-full bg-nuit-ligne" role="progressbar" aria-label="Préparation du campus">
        <div className="h-full rounded-full bg-orange" style={{ animation: `barre-activation ${DUREE_ACCUEIL_MS}ms ease-out forwards` }} />
      </div>
      <style>{"@keyframes barre-activation{from{width:4%}to{width:100%}}"}</style>
    </div>
  );
}

function LienPerime({ message }: { message: string }) {
  return (
    <CadrePublic>
      <div className="flex flex-col gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-clair text-orange-fonce">
          <Link2Off className="h-7 w-7" />
        </span>
        <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">Ce lien ne marche plus.</h1>
        <p className="text-base leading-relaxed text-texte-pale">{message}</p>
        <LienBouton href="/connexion" taille="lg" className="mt-2 min-h-[56px] w-full text-[17px]">
          Me connecter avec ma fiche
        </LienBouton>
        <div className="mt-4">
          <p className="mb-3 text-sm font-bold">Tu n'as plus ta fiche ? Écris à la vie scolaire de ton campus :</p>
          <ListeContactsSites />
        </div>
      </div>
    </CadrePublic>
  );
}
