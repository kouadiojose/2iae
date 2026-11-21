// /ecran et /ecran/:jeton : l'ordinateur branché à l'écran d'une salle de
// conférence devient l'écran de la salle. Avec le lien, rien à taper ; sans
// lien, on tape le code de 8 caractères (lettres et chiffres) préparé depuis
// le pilotage (« Installer l'écran »). L'écran reste ensuite connecté (session
// longue) et s'ouvre sur /salle. Page nue, en mode nuit, lisible de loin.
//
// Le lien de la salle (/ecran/:jeton) est aussi celui que la vie scolaire partage dans les groupes : un étudiant
// qui l'ouvre ne doit pas devenir l'écran. Un appareil n'est un écran que s'il porte le repère « ecran » (posé après
// la saisie du code de 8 caractères, lib/appareil.ts). Sinon on demande qui est là : l'étudiant se connecte avec son
// matricule et son code secret, puis entre dans le cours qui se tient dans la salle (POST /api/ecran/entrer).
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { MonitorCheck, MonitorSmartphone, TriangleAlert, GraduationCap } from "lucide-react";
import { estProfilCampus, type Moi } from "@shared/schema";
import { get, post, ErreurApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { accueilDe, seDeconnecter, useMoi } from "@/lib/auth";
import { lireAppareil, noterAppareil } from "@/lib/appareil";
import { dateEtHeure } from "@/lib/dates";
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

const CLE_TICKET = "campus:ticket-salle";
const lireTicketSalle = (): string | null => {
  try {
    return sessionStorage.getItem(CLE_TICKET);
  } catch {
    return null;
  }
};
const oublierTicketSalle = () => {
  try {
    sessionStorage.removeItem(CLE_TICKET);
  } catch {
    /* sans stockage : rien à effacer */
  }
};

type Prochaine = { titre: string; debut: string } | null;
type Etape = "choix" | "etudiant" | "equipe" | "code";

const CHAMP_NUIT =
  "w-full rounded-2xl border-2 border-nuit-bord bg-nuit-carte px-4 py-3.5 text-left text-[18px] text-white outline-none placeholder:text-nuit-bord focus:border-orange";

export default function PageInstallerEcran({ jeton }: { jeton?: string }) {
  const { moi } = useMoi();
  const [, naviguer] = useLocation();
  // Ce qui désigne la salle : le lien, ou le billet d'un téléphone qui était connecté comme écran (PageSalle).
  const [ticket] = useState(() => (!jeton && new URLSearchParams(window.location.search).get("ticket") ? lireTicketSalle() : null));
  const source = jeton ? { jeton } : ticket ? { ticket } : null;
  // Un appareil déjà repéré comme écran s'installe comme avant ; tous les autres passent par la question.
  const [modeQuestion] = useState(() => Boolean(source) && !(jeton && lireAppareil() === "ecran"));
  const [etat, setEtat] = useState<"saisie" | "envoi" | "installe">(jeton && !modeQuestion ? "envoi" : "saisie");
  const [etape, setEtape] = useState<Etape>("choix");
  const [apercu, setApercu] = useState<{ campus: string; salle: string } | null>(null);
  const [lienPerdu, setLienPerdu] = useState<string | null>(null);
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [partage, setPartage] = useState(false);
  const [connexionEnCours, setConnexionEnCours] = useState(false);
  const [erreurConnexion, setErreurConnexion] = useState<string | null>(null);
  const [vientDeSeConnecter, setVientDeSeConnecter] = useState(false);
  const [sansCours, setSansCours] = useState<{ prochaine: Prochaine } | null>(null);
  const [erreurEntree, setErreurEntree] = useState<string | null>(null);
  const entreeLancee = useRef(false);
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
      // Le code de 8 caractères fait de cet appareil un écran de salle (seul le personnel l'a).
      if ("code" in corps) noterAppareil("ecran");
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

  // Appareil déjà repéré comme écran : installation directe avec le lien, comme avant (une seule fois).
  useEffect(() => {
    if (!jeton || modeQuestion || lance.current) return;
    lance.current = true;
    void envoyer({ jeton });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jeton, modeQuestion]);

  // Une personne (étudiant, formateur, équipe) est déjà connectée sur cet appareil.
  const personne = Boolean(moi) && (moi!.role === "etudiant" || moi!.role === "formateur" || moi!.role === "admin" || (moi!.role === "vie_scolaire" && !estProfilCampus(moi)));
  const tutoie = !moi || moi.role === "etudiant";
  const accueilPersonne = modeQuestion && personne && etat === "saisie";

  // L'aperçu du lien (campus et salle, rien d'autre) pour le titre de la question.
  const aApercu = modeQuestion && Boolean(jeton) && !personne;
  useEffect(() => {
    if (!aApercu || !jeton) return;
    let annule = false;
    get<{ campus: string; salle: string }>(`/api/ecran/${encodeURIComponent(jeton)}/apercu`)
      .then((r) => !annule && setApercu(r))
      .catch((e) => !annule && setLienPerdu(e instanceof ErreurApi && e.statut === 410 ? e.message : "Le campus ne répond pas. Vérifie ta connexion internet, puis rouvre le lien."));
    return () => {
      annule = true;
    };
  }, [aApercu, jeton]);

  // Entrer dans le cours de la salle : un court instant pour lire « Bonjour », sauf juste après la connexion.
  useEffect(() => {
    if (!accueilPersonne || !source || entreeLancee.current || sansCours || erreurEntree) return;
    const t = setTimeout(
      () => {
        entreeLancee.current = true;
        post<{ seanceId: number | null; prochaine?: Prochaine }>("/api/ecran/entrer", source)
          .then((r) => {
            noterAppareil("personnel");
            if (r.seanceId) {
              oublierTicketSalle();
              naviguer(`/live/${r.seanceId}`, { replace: true });
            } else setSansCours({ prochaine: r.prochaine ?? null });
          })
          .catch((e) => setErreurEntree(e instanceof ErreurApi ? e.message : "Le campus ne répond pas. Vérifie ta connexion internet, puis rouvre le lien."));
      },
      vientDeSeConnecter ? 0 : 1500,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accueilPersonne, sansCours, erreurEntree]);

  // « Ce n'est pas moi » : on ferme la session de cet appareil et on rouvre la même page, sur la question.
  const pasMoi = () => void seDeconnecter(window.location.pathname + window.location.search);

  const seConnecter = async (e: FormEvent) => {
    e.preventDefault();
    if (connexionEnCours || !identifiant.trim() || !motDePasse) return;
    setConnexionEnCours(true);
    setErreurConnexion(null);
    try {
      const m = await post<Moi>("/api/auth/connexion", { identifiant: identifiant.trim(), motDePasse, appareilPartage: partage });
      setMotDePasse("");
      setVientDeSeConnecter(true);
      installer(m);
    } catch (err) {
      setErreurConnexion(err instanceof ErreurApi ? err.message : "Le campus ne répond pas. Vérifie ta connexion internet, puis réessaie.");
    } finally {
      setConnexionEnCours(false);
    }
  };

  const soumettre = (e?: FormEvent) => {
    e?.preventDefault();
    if (code.length === LONGUEUR_CODE) void envoyer({ code });
  };

  const dejaEcran = moi?.role === "salle" && !jeton && !ticket && !continuer && etat === "saisie";
  const autreCompte = moi && moi.role !== "salle" && etat === "saisie";
  // La question (étudiant, écran ou équipe) : avec le lien ou le billet, pour qui n'est pas déjà reconnu.
  const question = modeQuestion && !personne && etat === "saisie" && etape !== "code";
  const titreCampus = apercu ? ` · ${apercu.campus}` : "";

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
        ) : accueilPersonne ? (
          <>
            <span className="grid h-20 w-20 place-items-center rounded-full bg-nuit-carte text-orange">
              <GraduationCap className="h-10 w-10" />
            </span>
            {sansCours ? (
              <>
                <h1 className="text-[30px] font-black leading-tight tracking-tres-serre sm:text-[38px]">Pas de cours en direct dans cette salle pour le moment.</h1>
                {sansCours.prochaine && (
                  <p className="text-lg text-nuit-doux">
                    Prochain cours : <strong className="text-white">{sansCours.prochaine.titre}</strong>, {dateEtHeure(sansCours.prochaine.debut)}.
                  </p>
                )}
                <Bouton taille="lg" onClick={() => naviguer(accueilDe(moi!), { replace: true })} className="min-h-[56px] w-full max-w-[380px]">
                  Aller à mon accueil
                </Bouton>
              </>
            ) : erreurEntree ? (
              <>
                <h1 className="text-[28px] font-black leading-tight tracking-tres-serre">Impossible d'entrer dans le cours</h1>
                <p role="alert" className="max-w-[440px] text-[16px] font-semibold text-[#FF8A6B]">
                  {erreurEntree}
                </p>
                <Bouton taille="lg" onClick={() => naviguer(accueilDe(moi!), { replace: true })} className="min-h-[56px] w-full max-w-[380px]">
                  Aller à mon accueil
                </Bouton>
              </>
            ) : (
              <h1 className="text-[32px] font-black leading-tight tracking-tres-serre sm:text-[40px]">
                Bonjour {moi!.prenom}. {tutoie ? "On t'emmène dans le cours…" : "On vous emmène dans le cours…"}
              </h1>
            )}
            <button type="button" onClick={pasMoi} className="text-[15px] font-semibold text-nuit-doux underline underline-offset-4 hover:text-white">
              Ce n'est pas moi
            </button>
          </>
        ) : question && lienPerdu ? (
          <>
            <h1 className="text-[28px] font-black leading-tight tracking-tres-serre">Ce lien ne marche plus</h1>
            <p role="alert" className="max-w-[440px] text-[16px] font-semibold text-[#FF8A6B]">
              {lienPerdu}
            </p>
          </>
        ) : question && etape === "choix" ? (
          <>
            <h1 className="text-[32px] font-black leading-[1.05] tracking-tres-serre sm:text-[42px]">
              Salle de conférence<span className="text-orange">{titreCampus}</span>
            </h1>
            <div className="flex w-full max-w-[380px] flex-col gap-3">
              <Bouton taille="lg" onClick={() => setEtape("etudiant")} className="min-h-[56px] w-full text-[17px]">
                Je suis étudiant
              </Bouton>
              <Bouton taille="lg" variante="nuit" onClick={() => setEtape("code")} className="min-h-[56px] w-full text-[17px]">
                C'est l'écran de la salle
              </Bouton>
            </div>
            <button type="button" onClick={() => setEtape("equipe")} className="text-[15px] font-semibold text-nuit-doux underline underline-offset-4 hover:text-white">
              Je suis formateur ou de l'équipe
            </button>
          </>
        ) : question && (etape === "etudiant" || etape === "equipe") ? (
          <>
            <h1 className="text-[30px] font-black leading-tight tracking-tres-serre sm:text-[38px]">
              {etape === "etudiant" ? "Connecte-toi pour entrer en classe" : "Connectez-vous pour entrer en classe"}
            </h1>
            <form onSubmit={seConnecter} className="flex w-full max-w-[380px] flex-col gap-4 text-left">
              <label className="flex flex-col gap-1.5 text-[15px] font-semibold text-nuit-doux">
                {etape === "etudiant" ? "Ton matricule (ou ton téléphone)" : "Votre e-mail"}
                <input
                  value={identifiant}
                  onChange={(e) => setIdentifiant(e.target.value)}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="username"
                  inputMode={etape === "etudiant" ? "text" : "email"}
                  className={CHAMP_NUIT}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[15px] font-semibold text-nuit-doux">
                {etape === "etudiant" ? "Ton code secret" : "Votre code secret"}
                <input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoComplete="current-password" className={CHAMP_NUIT} />
              </label>
              {etape === "etudiant" && (
                <label className="flex items-start gap-3 text-[15px] text-nuit-doux">
                  <input type="checkbox" checked={partage} onChange={(e) => setPartage(e.target.checked)} className="mt-1 h-5 w-5 accent-orange" />
                  <span>
                    <strong className="text-white">Téléphone partagé</strong>
                    <br />
                    Me déconnecter en quittant le campus.
                  </span>
                </label>
              )}
              {erreurConnexion && (
                <p role="alert" className="text-[15px] font-semibold text-[#FF8A6B]">
                  {erreurConnexion}
                </p>
              )}
              <Bouton type="submit" taille="lg" chargement={connexionEnCours} disabled={!identifiant.trim() || !motDePasse} className="min-h-[56px] w-full text-[17px]">
                Entrer
              </Bouton>
              <div className="flex flex-col gap-1.5 text-center text-[14px] text-nuit-doux">
                <a href="/mot-de-passe-oublie" className="underline underline-offset-4 hover:text-white">
                  Code oublié ?
                </a>
                {etape === "etudiant" && (
                  <>
                    <a href="/inscription" className="underline underline-offset-4 hover:text-white">
                      Pas encore de compte ? Crée ton compte
                    </a>
                    <span>Ensuite, rouvre le lien de la salle.</span>
                  </>
                )}
              </div>
            </form>
            <button type="button" onClick={() => setEtape("choix")} className="text-[15px] font-semibold text-nuit-doux underline underline-offset-4 hover:text-white">
              Retour
            </button>
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
              {modeQuestion
                ? "Tapez le code d'installation de 8 caractères (Pilotage, « Installer l'écran »). Cet appareil deviendra l'écran de la salle de conférence et restera connecté."
                : "Tapez le code de 8 caractères (lettres et chiffres) préparé par la vie scolaire ou la direction (Pilotage, « Installer l'écran »). Cet ordinateur deviendra l'écran de la salle de conférence et restera connecté."}
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
            {modeQuestion && (
              <button type="button" onClick={() => setEtape("choix")} className="text-[15px] font-semibold text-nuit-doux underline underline-offset-4 hover:text-white">
                Retour
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
