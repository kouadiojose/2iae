// /ecran et /ecran/:jeton : l'ordinateur branché à l'écran d'une salle de
// conférence devient l'écran de la salle. Avec le lien, rien à taper ; sans
// lien, on tape le code de 8 caractères (lettres et chiffres) préparé depuis
// le pilotage (« Installer l'écran »). L'écran reste ensuite connecté (session
// longue) et s'ouvre sur /salle. Page nue, en mode nuit, lisible de loin.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { MonitorCheck, MonitorSmartphone, TriangleAlert } from "lucide-react";
import type { Moi } from "@shared/schema";
import { post, ErreurApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useMoi } from "@/lib/auth";
import { Bouton } from "@/components/ui/bouton";
import { cn } from "@/lib/utils";

/** Longueur du code d'installation (serveur : routes/lancement.ts). */
const LONGUEUR_CODE = 8;
/** Ce qui est tapé : majuscules, sans espaces ni tirets (« k7mq-4xp9 » → « K7MQ4XP9 »). */
const nettoyer = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, LONGUEUR_CODE);
/** Affiché en deux groupes de 4, comme dans la fenêtre du pilotage. */
const groupes = (v: string) => (v.length > 4 ? `${v.slice(0, 4)} ${v.slice(4)}` : v);

/** Installe la personne connectée (l'écran) sans rien garder du compte qui était ouvert avant. */
function installer(m: Moi) {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "/api/auth/moi" });
  queryClient.setQueryData(["/api/auth/moi"], m);
}

export default function PageInstallerEcran({ jeton }: { jeton?: string }) {
  const { moi } = useMoi();
  const [, naviguer] = useLocation();
  const [etat, setEtat] = useState<"saisie" | "envoi" | "installe">(jeton ? "envoi" : "saisie");
  const [erreur, setErreur] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [installe, setInstalle] = useState<Moi | null>(null);
  const [continuer, setContinuer] = useState(false);
  const lance = useRef(false);
  const champ = useRef<HTMLInputElement>(null);

  const envoyer = async (corps: { jeton: string } | { code: string }) => {
    setEtat("envoi");
    setErreur(null);
    try {
      const m = await post<Moi>("/api/ecran/installer", corps);
      setInstalle(m);
      setEtat("installe");
      installer(m);
      setTimeout(() => naviguer("/salle", { replace: true }), 2600);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Le campus ne répond pas. Vérifiez la connexion internet de cet ordinateur, puis réessayez.");
      setEtat("saisie");
      setCode("");
      setTimeout(() => champ.current?.focus(), 50);
    }
  };

  // Avec le lien : installation directe, une seule fois (le lien ne sert qu'une fois).
  useEffect(() => {
    if (!jeton || lance.current) return;
    lance.current = true;
    void envoyer({ jeton });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jeton]);

  const soumettre = (e?: FormEvent) => {
    e?.preventDefault();
    if (code.length === LONGUEUR_CODE) void envoyer({ code });
  };

  const dejaEcran = moi?.role === "salle" && !jeton && !continuer && etat === "saisie";
  const autreCompte = moi && moi.role !== "salle" && etat === "saisie";

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-nuit px-5 py-10 text-center text-white">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-orange/20 blur-3xl" />
      <img src="/marque-2iae-detouree.png" alt="Groupe Écoles 2IAE International" className="relative h-20 w-auto sm:h-24" />
      <p className="relative mt-4 font-mono text-xs uppercase tracking-[0.16em] text-orange-peche">Campus numérique · Écran de la salle</p>

      <main className="relative mt-8 flex w-full max-w-[560px] flex-col items-center gap-6" aria-live="polite">
        {etat === "installe" && installe ? (
          <>
            <span className="grid h-20 w-20 place-items-center rounded-full bg-succes text-white">
              <MonitorCheck className="h-10 w-10" />
            </span>
            <h1 className="text-[40px] font-black leading-[1.05] tracking-tres-serre sm:text-[52px]">
              Écran installé{installe.site ? <span className="text-orange"> · {installe.site.nomCourt}</span> : null}
            </h1>
            <p className="text-lg text-nuit-doux">Cet ordinateur reste connecté. Laissez la page ouverte : le prochain cours s'affiche tout seul.</p>
          </>
        ) : etat === "envoi" ? (
          <>
            <span className="grid h-20 w-20 animate-pulse place-items-center rounded-full bg-nuit-carte text-orange">
              <MonitorSmartphone className="h-10 w-10" />
            </span>
            <h1 className="text-[36px] font-black leading-tight tracking-tres-serre">Installation de l'écran…</h1>
          </>
        ) : dejaEcran ? (
          <>
            <h1 className="text-[36px] font-black leading-tight tracking-tres-serre">
              Cet ordinateur est déjà l'écran de {moi?.site ? <span className="text-orange">{moi.site.nomCourt}</span> : "la salle"}.
            </h1>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              <Bouton taille="lg" onClick={() => naviguer("/salle", { replace: true })} className="min-h-[56px]">
                Ouvrir l'écran de la salle
              </Bouton>
              <Bouton taille="lg" variante="nuit" onClick={() => setContinuer(true)} className="min-h-[56px]">
                Installer un autre écran
              </Bouton>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-[34px] font-black leading-[1.05] tracking-tres-serre sm:text-[44px]">Installer l'écran de la salle</h1>
            <p className="text-lg leading-relaxed text-nuit-doux">
              Tapez le code de 8 caractères (lettres et chiffres) préparé par la vie scolaire ou la direction (Pilotage, « Installer l'écran »). Cet ordinateur deviendra l'écran de la salle de conférence et restera connecté.
            </p>
            {autreCompte && (
              <p className="flex w-full items-start gap-2 rounded-2xl bg-nuit-carte px-4 py-3 text-left text-[15px] text-nuit-doux">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-orange" />
                <span>
                  Vous êtes connecté en tant que <strong className="text-white">{moi!.prenom} {moi!.nom}</strong>. Installer l'écran remplacera ce compte sur cet ordinateur.
                </span>
              </p>
            )}
            <form onSubmit={soumettre} className="flex w-full flex-col items-center gap-4">
              <label htmlFor="code-ecran" className="sr-only">
                Code d'installation de 8 caractères
              </label>
              <input
                ref={champ}
                id="code-ecran"
                value={groupes(code)}
                onChange={(e) => {
                  const v = nettoyer(e.target.value);
                  setCode(v);
                  if (v.length === LONGUEUR_CODE) void envoyer({ code: v });
                }}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="one-time-code"
                autoFocus
                placeholder="•••• ••••"
                className={cn(
                  "w-full max-w-[380px] rounded-2xl border-2 bg-nuit-carte px-4 py-4 text-center font-mono text-[34px] font-bold tracking-[0.16em] text-white outline-none placeholder:text-nuit-bord focus:border-orange sm:text-[44px] sm:tracking-[0.2em]",
                  erreur ? "border-direct" : "border-nuit-bord",
                )}
              />
              {erreur && (
                <p role="alert" className="max-w-[440px] text-[15px] font-semibold text-[#FF8A6B]">
                  {erreur}
                </p>
              )}
              <Bouton type="submit" taille="lg" disabled={code.length !== LONGUEUR_CODE} className="min-h-[56px] w-full max-w-[380px] text-[17px]">
                Installer cet écran
              </Bouton>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
