// /reunion/:jeton — le lien de la réunion de l'administration (server/routes/reunions.ts), sans compte : la personne
// tape son nom et entre, à tout moment (un membre du personnel connecté entre sous son nom, sans le taper). Micro,
// caméra et partage d'écran pour tous ; micro coupé en entrant. Réunion fermée : « La réunion est fermée. » et rien
// d'autre ; la page relit l'état et se rouvre d'elle-même. Dans la réunion, l'état est relu toutes les 10 s : fermée,
// ou lien changé, la page quitte la visio aussitôt (le serveur sort aussi les présents de la salle Daily). Une coupure
// du campus (mise en ligne, réseau) ne coupe pas la réunion : seule une réponse claire (fermée, lien mort) la quitte.
// Sortie par la salle (fermeture, nouveau lien, la direction qui sort quelqu'un, 5 h écoulées) : l'état est relu tout
// de suite ; tant qu'il n'est pas relu, un texte neutre (« Vous n'êtes plus dans la réunion. »), et « Le lien marche
// toujours » seulement si la relecture répond « ouverte ».
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DoorOpen, Link2Off, LogOut, Lock, ChevronLeft } from "lucide-react";
import { post, ErreurApi } from "@/lib/api";
import { useMoi, profilPermet } from "@/lib/auth";
import { useTextes } from "@/lib/textes";
import { Bouton } from "@/components/ui/bouton";
import { CadreDaily, type EtatVisio, type ProblemeVisio, type TextesCadre } from "@/modules/visio";
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

/** accueil : avant d'entrer ; dedans : dans la réunion ; quitte : « Quitter » touché ; sorti : sorti par la salle. */
type Phase = "accueil" | "dedans" | "quitte" | "sorti";

/** « visio » est le mot des cours : dans la réunion, on dit « vidéo » (textes du navigateur, réponses du campus). */
const sansVisio = (s: string) => s.replace(/\bvisio\b/gi, "vidéo");

export default function PageReunion({ jeton }: { jeton: string }) {
  const tx = useTextes(textes);
  const { moi } = useMoi();
  const racine = `/api/reunion/${encodeURIComponent(jeton)}`;
  const [phase, setPhase] = useState<Phase>("accueil");
  // Heure de la sortie (par la salle, ou « Quitter ») : seule une lecture réussie APRÈS elle confirme que la réunion
  // est encore ouverte (une fermeture a pu arriver juste avant).
  const [sortieA, setSortieA] = useState(0);
  // Le nom que les autres voient (« Awa Koné · invité »), rendu par le campus à l'entrée.
  const [nomAffiche, setNomAffiche] = useState("");
  const { data, error, isLoading, dataUpdatedAt, errorUpdatedAt, refetch } = useQuery<ReunionPubliqueDto>({
    queryKey: [racine],
    // Dans la réunion, et juste après en être sorti : 10 s (une fermeture se voit vite) ; fermée : 15 s (la page se
    // rouvre d'elle-même) ; sinon 30 s. Lien mort (ancien lien, lien faux) : on ne relit plus.
    refetchInterval: (q) =>
      q.state.error instanceof ErreurApi && q.state.error.statut === 404
        ? false
        : phase !== "accueil"
          ? 10_000
          : q.state.data?.etat === "fermee"
            ? 15_000
            : 30_000,
    refetchIntervalInBackground: true,
  });
  const statut = error instanceof ErreurApi ? error.statut : null;
  const lienMort = statut === 404;
  const fermee = !lienMort && data?.etat === "fermee";
  const ouverte = !lienMort && data?.etat === "ouverte" ? data : null;
  // Sortie confirmée « ouverte » par une lecture faite après la sortie (sinon : pas de « Le lien marche toujours »).
  const sortieConfirmee = dataUpdatedAt > sortieA && Boolean(ouverte);
  // Juste après la sortie, tant que la relecture n'a pas répondu : ni « Le lien marche toujours », ni « Revenir »
  // (la réunion vient peut-être d'être fermée). Relecture en échec (réseau, trop de demandes) : « Revenir » s'affiche,
  // sans promettre que le lien marche.
  const enAttente = (phase === "quitte" || phase === "sorti") && !sortieConfirmee && !(errorUpdatedAt > sortieA);

  // Hors de la réunion (« Quitter », ou la salle qui nous a sortis : fermeture, nouveau lien, la direction, 5 h) : on
  // relit l'état tout de suite.
  const sortir = (comment: "quitte" | "sorti") => {
    setSortieA(Date.now());
    setPhase(comment);
    void refetch();
  };
  // Problème dans le cadre (salle finie, accès refusé à la nouvelle demande) : l'état est relu tout de suite, une
  // fermeture ou un lien mort se voient sans attendre la relecture suivante.
  const relire = () => void refetch();

  // Les problèmes du cadre, avec les mots de la réunion (ni radio, ni cours, ni formateur).
  const textesCadre = useMemo<TextesCadre>(
    () => ({
      connexion: tx("cadre.connexion"),
      lent: tx("cadre.lent"),
      sansReponse: tx("cadre.sansReponse"),
      probleme: (pb: ProblemeVisio): ProblemeVisio => {
        switch (pb.genre) {
          case "reseau":
            return { ...pb, texte: tx("cadre.reseau"), conseil: tx("cadre.reseau.conseil") };
          case "pleine":
            return { ...pb, texte: tx("cadre.pleine"), conseil: tx("cadre.pleine.conseil") };
          case "sortie":
            return { ...pb, texte: tx("cadre.sortie"), conseil: null };
          case "compte":
            return { ...pb, texte: tx("cadre.compte"), conseil: tx("cadre.compte.conseil") };
          case "acces":
            return { ...pb, texte: tx("cadre.acces"), conseil: tx("cadre.acces.conseil") };
          default:
            // Navigateur (« Ouvrez dans Chrome »), réunion fermée, lien mort, vidéo pas réglée : textes déjà justes.
            return { ...pb, texte: sansVisio(pb.texte), conseil: pb.conseil ? sansVisio(pb.conseil) : null };
        }
      },
    }),
    [tx],
  );

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
          <Dedans
            racine={racine}
            reunion={ouverte}
            nomAffiche={nomAffiche}
            textesCadre={textesCadre}
            onQuitter={() => sortir("quitte")}
            onSortie={() => sortir("sorti")}
            onProbleme={relire}
          />
        ) : (
          <Accueil
            reunion={ouverte}
            enAttente={enAttente}
            avis={
              phase === "quitte" || phase === "sorti"
                ? { titre: tx(phase === "quitte" ? "lien.quitte.titre" : "lien.sorti.titre"), texte: sortieConfirmee ? tx("lien.quitte.texte") : null }
                : null
            }
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

function Accueil({
  reunion,
  enAttente,
  avis,
  onEntrer,
  racine,
}: {
  reunion: Ouverte;
  /** Juste après la sortie, l'état est relu : le formulaire attend la réponse. */
  enAttente: boolean;
  /** Après la réunion : « Vous avez quitté la réunion. », ou « Vous n'êtes plus dans la réunion. » (texte : le lien marche encore). */
  avis: { titre: string; texte: string | null } | null;
  onEntrer: (nomAffiche: string) => void;
  racine: string;
}) {
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
        {avis && (
          <p className="text-[16px] text-nuit-doux" data-avis-sortie>
            <strong className="text-white">{avis.titre}</strong>
            {avis.texte && ` ${avis.texte}`}
          </p>
        )}
      </div>
      {enAttente ? (
        <p className="text-[15px] text-nuit-doux" role="status">
          {tx("lien.chargement")}
        </p>
      ) : (
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
            {avis ? tx("lien.revenir") : tx("lien.entrer")}
          </Bouton>
        </form>
      )}
    </div>
  );
}

function Dedans({
  racine,
  reunion,
  nomAffiche,
  textesCadre,
  onQuitter,
  onSortie,
  onProbleme,
}: {
  racine: string;
  reunion: Ouverte;
  nomAffiche: string;
  textesCadre: TextesCadre;
  /** « Quitter la réunion » touché. */
  onQuitter: () => void;
  /** Sortie par la salle (fermeture, nouveau lien, la direction, 5 h écoulées). */
  onSortie: () => void;
  /** Tout autre problème du cadre : le parent relit l'état. */
  onProbleme: () => void;
}) {
  const tx = useTextes(textes);
  const nom = useRef(reunion.personnel ? reunion.personnel.nom : lireNom());
  // « Vous êtes dans la réunion » seulement une fois la vidéo connectée (aussi pendant une reconnexion) ; pendant la
  // connexion, « Vous entrez sous le nom … » ; rien quand la connexion a échoué (le cadre dit le problème).
  const [etatCadre, setEtatCadre] = useState<EtatVisio>("connexion");
  const nomVu = nomAffiche || nom.current;
  const ligneNom =
    etatCadre === "connecte" || etatCadre === "reconnexion"
      ? tx("lien.dedans", { v: { nom: nomVu } })
      : etatCadre === "connexion"
        ? tx("lien.entree", { v: { nom: nomVu } })
        : "";
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
          textes={textesCadre}
          onEtat={setEtatCadre}
          // Sortie de la salle : l'état est relu avant de dire quoi que ce soit (fermée ? lien changé ? encore ouverte ?).
          onEchecs={(_n, pb) => {
            if (!pb) return;
            if (pb.genre === "sortie") onSortie();
            else onProbleme();
          }}
          className="h-full w-full"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[14px] text-nuit-doux">
        <span data-ligne-nom={etatCadre}>{ligneNom}</span>
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
