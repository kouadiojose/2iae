// /reunion/:jeton — le lien de la réunion de l'administration (server/routes/reunions.ts), sans compte : la personne
// tape son nom et entre, à tout moment (un membre du personnel connecté entre sous son nom, sans le taper). Micro,
// caméra et partage d'écran pour tous ; micro coupé en entrant. Réunion fermée : « La réunion est fermée. » et rien
// d'autre ; la page relit l'état et se rouvre d'elle-même. Dans la réunion, l'état est relu toutes les 10 s : fermée,
// ou lien changé, la page quitte la visio aussitôt (le serveur sort aussi les présents de la salle Daily). Une coupure
// du campus (mise en ligne, réseau) ne coupe pas la réunion : seule une réponse claire (fermée, lien mort) la quitte.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DoorOpen, Link2Off, LogOut, Lock, ChevronLeft } from "lucide-react";
import { post, ErreurApi } from "@/lib/api";
import { useMoi, profilPermet } from "@/lib/auth";
import { useTextes } from "@/lib/textes";
import { Bouton } from "@/components/ui/bouton";
import { CadreDaily } from "@/modules/visio";
import { t as textes } from "@shared/textes/reunion";
import type { ReunionPubliqueDto } from "@shared/reunion";
import type { AccesDaily } from "@shared/schema";

const CLE_NOM = "campus:reunion-nom";
const lireNom = () => {
  try {
    return window.localStorage.getItem(CLE_NOM) ?? "";
  } catch {
    return "";
  }
};
const garderNom = (nom: string) => {
  try {
    window.localStorage.setItem(CLE_NOM, nom);
  } catch {
    /* stockage indisponible */
  }
};

type Phase = "accueil" | "dedans" | "quitte";

export default function PageReunion({ jeton }: { jeton: string }) {
  const tx = useTextes(textes);
  const { moi } = useMoi();
  const racine = `/api/reunion/${encodeURIComponent(jeton)}`;
  const [phase, setPhase] = useState<Phase>("accueil");
  // Le nom que les autres voient (« Awa Koné · invité »), rendu par le campus à l'entrée.
  const [nomAffiche, setNomAffiche] = useState("");
  const { data, error, isLoading } = useQuery<ReunionPubliqueDto>({
    queryKey: [racine],
    // Dans la réunion : 10 s (une fermeture se voit vite) ; fermée : 15 s (la page se rouvre d'elle-même).
    // Lien mort (ancien lien, lien faux) : on ne relit plus.
    refetchInterval: (q) =>
      q.state.error instanceof ErreurApi && q.state.error.statut === 404 ? false : phase === "dedans" ? 10_000 : q.state.data?.etat === "fermee" ? 15_000 : 30_000,
    refetchIntervalInBackground: true,
  });
  const statut = error instanceof ErreurApi ? error.statut : null;
  const lienMort = statut === 404;
  const fermee = !lienMort && data?.etat === "fermee";
  const ouverte = !lienMort && data?.etat === "ouverte" ? data : null;

  // Fermée ou lien changé : on sort de la réunion (la visio se ferme en quittant la page de la réunion).
  useEffect(() => {
    if (fermee || lienMort) setPhase("accueil");
  }, [fermee, lienMort]);

  const pilote = Boolean(moi && (moi.role === "admin" || moi.role === "vie_scolaire") && profilPermet(moi, "outils_campus"));

  return (
    <div className="flex min-h-dvh flex-col bg-nuit text-white">
      <header className="flex items-center justify-between gap-3 border-b border-nuit-ligne px-4 py-3 sm:px-6">
        <img src="/marque-2iae-detouree.png" alt="Groupe Écoles 2IAE International" className="h-10 w-auto" />
        {pilote ? (
          <a href="/pilotage/reunion" className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-bold text-orange-peche no-underline hover:text-white">
            <ChevronLeft className="h-4 w-4" aria-hidden /> {tx("lien.retourPilotage")}
          </a>
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orange-peche">{tx("lien.etiquette")}</span>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        {isLoading ? (
          <p className="text-nuit-doux">{tx("lien.chargement")}</p>
        ) : lienMort ? (
          <Message icone={<Link2Off className="h-6 w-6" />} titre={tx("lien.mort.titre")} texte={tx("lien.mort.texte")} />
        ) : statut === 429 && !data ? (
          <Message icone={<Lock className="h-6 w-6" />} titre={tx("lien.trop.titre")} texte={tx("lien.trop.texte")} />
        ) : fermee ? (
          <Message icone={<Lock className="h-6 w-6" />} titre={tx("lien.fermee.titre")} texte={tx("lien.fermee.texte")} />
        ) : !ouverte ? (
          <Message icone={<Link2Off className="h-6 w-6" />} titre={tx("lien.reseau.titre")} texte={tx("lien.reseau.texte")} />
        ) : phase === "dedans" ? (
          <Dedans racine={racine} reunion={ouverte} nomAffiche={nomAffiche} onQuitter={() => setPhase("quitte")} />
        ) : (
          <Accueil
            reunion={ouverte}
            quitte={phase === "quitte"}
            onEntrer={(n) => {
              setNomAffiche(n);
              setPhase("dedans");
            }}
            racine={racine}
          />
        )}
      </main>
    </div>
  );
}

type Ouverte = Extract<ReunionPubliqueDto, { etat: "ouverte" }>;

/** Accès obtenu au moment du clic (les erreurs s'affichent dans le formulaire), remis au cadre de la visio. */
const premierAcces: { courant: AccesDaily | null } = { courant: null };

function Accueil({ reunion, quitte, onEntrer, racine }: { reunion: Ouverte; quitte: boolean; onEntrer: (nomAffiche: string) => void; racine: string }) {
  const tx = useTextes(textes);
  const [nom, setNom] = useState(lireNom);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const entrer = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const n = nom.trim();
    if (!reunion.personnel && n.length < 2) return setErreur(tx("lien.nom.court"));
    setEnvoi(true);
    setErreur(null);
    try {
      const acces = await post<AccesDaily>(`${racine}/entrer`, reunion.personnel ? {} : { nom: n });
      premierAcces.courant = acces;
      if (!reunion.personnel) garderNom(n);
      onEntrer(acces.nomAffiche);
    } catch (x) {
      setErreur(x instanceof ErreurApi ? x.message : tx("lien.erreur"));
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-titre text-[32px] font-semibold leading-tight sm:text-[40px]">{reunion.nom}</h1>
        {quitte && (
          <p className="text-[16px] text-nuit-doux">
            <strong className="text-white">{tx("lien.quitte.titre")}</strong> {tx("lien.quitte.texte")}
          </p>
        )}
      </div>
      <form onSubmit={entrer} className="flex flex-col gap-4 rounded-3xl bg-nuit-carte p-5 sm:p-6">
        {reunion.personnel ? (
          <p className="text-[17px]">{tx("lien.personnel", { v: { nom: reunion.personnel.nom } })}</p>
        ) : (
          <label className="flex flex-col gap-2">
            <span className="text-[15px] font-bold">{tx("lien.nom")}</span>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              autoComplete="name"
              maxLength={60}
              placeholder={tx("lien.nom.exemple")}
              className="min-h-[52px] rounded-xl border border-nuit-ligne bg-nuit px-4 text-lg text-white placeholder:text-nuit-gris focus:border-orange focus:outline-none"
              data-nom
            />
            <span className="text-[13px] text-nuit-doux">{tx("lien.nom.aide")}</span>
          </label>
        )}
        <p className="text-[14px] leading-relaxed text-nuit-doux">{tx("lien.conseil")}</p>
        {erreur && (
          <p className="rounded-xl bg-danger/20 px-4 py-3 text-[15px] font-semibold text-white" role="alert">
            {erreur}
          </p>
        )}
        <Bouton type="submit" taille="lg" pleineLargeur chargement={envoi} className="min-h-[56px] text-[17px]" icone={<DoorOpen className="h-5 w-5" />}>
          {quitte ? tx("lien.revenir") : tx("lien.entrer")}
        </Bouton>
      </form>
    </div>
  );
}

function Dedans({ racine, reunion, nomAffiche, onQuitter }: { racine: string; reunion: Ouverte; nomAffiche: string; onQuitter: () => void }) {
  const tx = useTextes(textes);
  const nom = useRef(reunion.personnel ? reunion.personnel.nom : lireNom());
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="h-[calc(100dvh-190px)] min-h-[360px] overflow-hidden rounded-[22px] border-2 border-nuit-ligne bg-nuit-carte sm:h-[calc(100dvh-200px)]" data-cadre-reunion>
        <CadreDaily
          obtenirAcces={() => {
            const a = premierAcces.courant;
            premierAcces.courant = null;
            // Jeton expiré, salle refaite : on en redemande un, sous le même nom.
            return a ? Promise.resolve(a) : post<AccesDaily>(`${racine}/entrer`, reunion.personnel ? {} : { nom: nom.current });
          }}
          role="observateur"
          tu={false}
          cameraAuDepart
          microAuDepart={false}
          // Sortie de la salle (par la personne qui gère la réunion, ou au bout de 5 h) : l'écran « Vous avez quitté ».
          onEchecs={(_n, pb) => pb?.genre === "sortie" && onQuitter()}
          className="h-full w-full"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[14px] text-nuit-doux">
        <span>{tx("lien.dedans", { v: { nom: nomAffiche || nom.current } })}</span>
        <Bouton variante="nuit" taille="sm" className="min-h-[44px]" icone={<LogOut className="h-4 w-4" />} onClick={onQuitter}>
          {tx("lien.quitter")}
        </Bouton>
      </div>
    </div>
  );
}

function Message({ icone, titre, texte }: { icone: React.ReactNode; titre: string; texte: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-start gap-3 rounded-3xl bg-nuit-carte p-6" role="status">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-nuit-ligne text-orange-peche">{icone}</span>
      <h1 className="text-[28px] font-black leading-tight">{titre}</h1>
      <p className="text-[16px] leading-relaxed text-nuit-doux">{texte}</p>
    </div>
  );
}
