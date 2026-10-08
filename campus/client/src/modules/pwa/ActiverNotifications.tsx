// Carte « Recevoir les rappels sur ce téléphone » (Web Push, par appareil).
//
// L'explication vient TOUJOURS avant la fenêtre système de Chrome, qui est
// sèche et fait refuser. États : non supporté (conseil : Chrome, ou installer
// sur iPhone), bloqué (aide pas à pas pour débloquer), actif (essai,
// désactivation), et masqué quand le campus n'a pas de clé d'envoi.
//
// Chantier C3 : les outils d'abonnement servent aussi à la carte de l'accueil
// et à la proposition au bon moment (module rappels) ; l'abonnement envoie la
// plateforme et la marque, et un téléphone actif passe par la vérification
// « L'as-tu reçu ? » tant qu'il n'a pas confirmé qu'un essai est arrivé.
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, BellOff, Check, Smartphone } from "lucide-react";
import { useMoi, rechargerMoi } from "@/lib/auth";
import { api, get, post, ErreurApi } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Badge } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { toast, toastErreur } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { obtenirEnregistrement } from "./service-worker";
import { formuler, plateforme, estInstallee } from "./outils";
import { VerificationRappel } from "@/modules/rappels/VerificationRappel";
import { marqueRetenue, noterRappelsActives, rappelsDejaActives } from "@/modules/rappels/memoire";
import type { ClePush, ResultatEssaiPush } from "@shared/schema";
import type { EtatRappels } from "@shared/engagement/envois";

type Etat = "chargement" | "masque" | "non_supporte" | "refuse" | "inactif" | "actif";

/** Prévient les autres cartes de la page (compacte, complète, accueil) qu'il faut relire l'état. */
export const EVENEMENT_MAJ = "campus:rappels-maj";
export const prevenirAutresCartes = () => window.dispatchEvent(new Event(EVENEMENT_MAJ));

export const pushSupporte = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Clé VAPID (base64url) → octets attendus par pushManager.subscribe. */
function cleEnOctets(cle: string): Uint8Array {
  const b64 = (cle + "=".repeat((4 - (cle.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const brut = window.atob(b64);
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

/** Attend que le service worker soit actif (10 s au plus). */
async function travailleurPret(): Promise<ServiceWorkerRegistration> {
  const reg = await obtenirEnregistrement();
  if (!reg) throw new Error("Ce navigateur ne peut pas recevoir les rappels.");
  const delai = new Promise<never>((_, ko) => setTimeout(() => ko(new Error("Les rappels n'ont pas pu être préparés. Réessaie dans un instant.")), 10_000));
  return Promise.race([navigator.serviceWorker.ready, delai]);
}

export async function abonnementActuel(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Enregistre ce téléphone sur le compte connecté, avec sa plateforme et la marque si elle a été choisie. */
async function envoyerAbonnement(abo: PushSubscription) {
  await post("/api/push/abonnement", { ...abo.toJSON(), plateforme: plateforme(), marque: marqueRetenue() });
  noterRappelsActives(true);
}

async function nouvelAbonnement(cle: string): Promise<PushSubscription> {
  const reg = await travailleurPret();
  return (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleEnOctets(cle) }));
}

/** Demande l'autorisation (après l'explication), abonne ce téléphone et l'enregistre sur le campus. */
export async function activerRappels(cle: string): Promise<{ resultat: "actif"; endpoint: string } | { resultat: "refuse" } | { resultat: "plus_tard" }> {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return { resultat: "refuse" };
  if (permission !== "granted") return { resultat: "plus_tard" };
  const abo = await nouvelAbonnement(cle);
  await envoyerAbonnement(abo);
  prevenirAutresCartes();
  void rechargerMoi();
  return { resultat: "actif", endpoint: abo.endpoint };
}

/** État des rappels de ce téléphone, vu du navigateur puis du campus. */
export type EtatTelephone =
  | { etat: "masque" | "non_supporte" | "refuse" }
  /** perdu : ce téléphone avait des rappels, il ne les a plus. */
  | { etat: "inactif"; perdu: boolean }
  /** serveur : null hors connexion. */
  | { etat: "actif"; endpoint: string; serveur: EtatRappels | null };

const lireEtatServeur = (endpoint: string) => get<EtatRappels>(`/api/push/etat?endpoint=${encodeURIComponent(endpoint)}`);

/**
 * Lit l'état des rappels de ce téléphone et le répare au passage : un
 * abonnement que le campus ne connaît plus (oublié après un refus du service
 * d'envoi, base remise à zéro…) est refait, sans redemander l'autorisation.
 */
export async function lireEtatTelephone(cle: string | null, connecte: boolean): Promise<EtatTelephone> {
  if (!cle) return { etat: "masque" };
  if (!pushSupporte()) return { etat: "non_supporte" };
  if (Notification.permission === "denied") return { etat: "refuse" };
  const abo = await abonnementActuel().catch(() => null);
  const dejaActives = rappelsDejaActives();
  if (!abo || Notification.permission !== "granted") return { etat: "inactif", perdu: dejaActives };
  if (!connecte) return { etat: "actif", endpoint: abo.endpoint, serveur: null };
  let serveur = await lireEtatServeur(abo.endpoint);
  if (serveur.cetAppareil) {
    noterRappelsActives(true);
    return { etat: "actif", endpoint: abo.endpoint, serveur };
  }
  // Inconnu du campus : on repart d'un abonnement neuf (l'ancien a pu être refusé par le service d'envoi).
  try {
    await abo.unsubscribe().catch(() => false);
    const neuf = await nouvelAbonnement(cle);
    await envoyerAbonnement(neuf);
    serveur = await lireEtatServeur(neuf.endpoint);
    if (serveur.cetAppareil) return { etat: "actif", endpoint: neuf.endpoint, serveur };
  } catch {
    /* le téléphone refuse un nouvel abonnement : on le dit à la personne */
  }
  return { etat: "inactif", perdu: true };
}

export function ActiverNotifications({ compact = false }: { compact?: boolean }) {
  const { moi } = useMoi();
  const role = moi?.role;
  const f = (tu: string, vous: string) => formuler(role, tu, vous);
  const { data, isLoading, isError } = useQuery<ClePush>({ queryKey: ["/api/push/cle"], staleTime: 10 * 60_000 });
  const cle = data?.cle ?? null;
  const [etat, setEtat] = useState<Etat>("chargement");
  const [ici, setIci] = useState<{ endpoint: string; recu: boolean | null } | null>(null);
  const [verification, setVerification] = useState<"auto" | "manuelle" | null>(null);
  const [occupe, setOccupe] = useState<"activer" | "essai" | "desactiver" | null>(null);
  const [aide, setAide] = useState(false);
  // « ce téléphone » ou « cet ordinateur » : les rappels sont liés à l'appareil, pas au compte.
  const appareil = plateforme() === "ordinateur" ? "ordinateur" : "téléphone";
  const iciTexte = appareil === "ordinateur" ? "cet ordinateur" : "ce téléphone";
  const Ici = iciTexte.charAt(0).toUpperCase() + iciTexte.slice(1);

  const verifier = useCallback(async () => {
    const e = await lireEtatTelephone(cle, Boolean(moi)).catch((): EtatTelephone => ({ etat: "inactif", perdu: false }));
    if (e.etat === "actif") setIci({ endpoint: e.endpoint, recu: e.serveur?.cetAppareil?.recu ?? null });
    setEtat(e.etat);
  }, [cle, moi?.id]);

  useEffect(() => {
    if (isLoading) return;
    if (isError) return setEtat("masque");
    void verifier();
    const maj = () => void verifier();
    window.addEventListener(EVENEMENT_MAJ, maj);
    return () => window.removeEventListener(EVENEMENT_MAJ, maj);
  }, [isLoading, isError, verifier]);

  async function activer() {
    if (!cle) return;
    setOccupe("activer");
    try {
      const r = await activerRappels(cle);
      if (r.resultat === "refuse") return setEtat("refuse");
      if (r.resultat === "plus_tard") {
        toast(f("Pas de souci : tu pourras activer les rappels plus tard.", "Pas de souci : vous pourrez activer les rappels plus tard."), "info");
        return;
      }
      setIci({ endpoint: r.endpoint, recu: null });
      setEtat("actif");
      // Carte complète : l'essai part tout de suite, puis « L'as-tu reçu ? ».
      if (!compact) setVerification("auto");
      toast(`Rappels activés sur ${iciTexte}.`);
    } catch (e) {
      toastErreur(e instanceof Error && e.name !== "Error" ? new Error("L'inscription aux rappels a échoué. Réessaie dans un instant.") : e);
    } finally {
      setOccupe(null);
    }
  }

  async function desactiver() {
    setOccupe("desactiver");
    try {
      const abo = await abonnementActuel();
      if (abo) {
        await api("/api/push/abonnement", { methode: "DELETE", corps: { endpoint: abo.endpoint } });
        await abo.unsubscribe().catch(() => false);
      }
      // Désactivés exprès : ce n'est pas une perte à signaler sur l'accueil.
      noterRappelsActives(false);
      setEtat("inactif");
      setIci(null);
      setVerification(null);
      prevenirAutresCartes();
      toast(f(`Tu ne recevras plus de rappels sur ${iciTexte}.`, `Vous ne recevrez plus de rappels sur ${iciTexte}.`), "info");
      void rechargerMoi();
    } catch (e) {
      toastErreur(e);
    } finally {
      setOccupe(null);
    }
  }

  async function essayer() {
    setOccupe("essai");
    try {
      const r = await post<ResultatEssaiPush>("/api/push/test");
      if (r.envoye) toast(f(`Essai envoyé : regarde ton ${appareil}.`, `Essai envoyé : regardez votre ${appareil}.`));
      else if (r.raison === "heures_calmes") toast("Il est tard : rien ne sonne entre 21 h et 6 h. L'essai est dans la cloche et arrivera le matin.", "info");
      else if (r.raison === "plafond")
        toast(
          f("Tu as déjà reçu 3 rappels aujourd'hui : l'essai est dans la cloche.", "Vous avez déjà reçu 3 rappels aujourd'hui : l'essai est dans la cloche."),
          "info",
        );
      else if (r.raison === "aucun_appareil") {
        setEtat("inactif");
        toast(f(`${Ici} n'est plus inscrit. Réactive les rappels.`, `${Ici} n'est plus inscrit. Réactivez les rappels.`), "erreur");
      } else toast("Les rappels ne sont pas disponibles pour le moment.", "erreur");
    } catch (e) {
      toastErreur(e instanceof ErreurApi && e.statut === 429 ? new Error(e.message) : e);
    } finally {
      setOccupe(null);
    }
  }

  if (etat === "chargement" || etat === "masque") return null;

  const ios = plateforme() === "ios";
  const texteNonSupporte =
    ios && !estInstallee()
      ? f(
          "Sur iPhone, installe d'abord le campus sur l'écran d'accueil (Partager, puis « Sur l'écran d'accueil »), puis active les rappels depuis l'icône.",
          "Sur iPhone, installez d'abord le campus sur l'écran d'accueil (Partager, puis « Sur l'écran d'accueil »), puis activez les rappels depuis l'icône.",
        )
      : f(
          "Ce navigateur ne reçoit pas les rappels. Ouvre le campus dans Chrome pour les activer.",
          "Ce navigateur ne reçoit pas les rappels. Ouvrez le campus dans Chrome pour les activer.",
        );

  const aideDeblocage = (
    <FenetreDeblocage
      ouverte={aide}
      onFermer={() => setAide(false)}
      onVerifier={() => {
        setAide(false);
        void verifier();
      }}
    />
  );

  if (compact) {
    const libelles: Record<Exclude<Etat, "chargement" | "masque">, string> = {
      inactif: "Désactivés",
      actif: "Activés",
      refuse: "Bloqués",
      non_supporte: "Indisponibles ici",
    };
    return (
      <div className="flex min-h-[56px] flex-wrap items-center gap-3 py-2">
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full",
            etat === "actif" ? "bg-succes-clair text-succes" : "bg-orange-clair text-orange-fonce",
          )}
        >
          {etat === "actif" ? <BellRing className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold">Rappels sur {iciTexte}</p>
          <p className="text-sm text-texte-pale">{etat === "non_supporte" ? texteNonSupporte : libelles[etat]}</p>
        </div>
        {etat === "inactif" && (
          <Bouton taille="sm" className="min-h-[44px]" chargement={occupe === "activer"} onClick={() => void activer()}>
            Activer
          </Bouton>
        )}
        {etat === "actif" && (
          <Bouton taille="sm" variante="fantome" className="min-h-[44px]" chargement={occupe === "desactiver"} onClick={() => void desactiver()}>
            Désactiver
          </Bouton>
        )}
        {etat === "refuse" && (
          <Bouton taille="sm" variante="doux" className="min-h-[44px]" onClick={() => setAide(true)}>
            Débloquer
          </Bouton>
        )}
        {aideDeblocage}
      </div>
    );
  }

  // Téléphone actif mais pas encore confirmé : la vérification remplace le simple bouton d'essai.
  const aVerifier = etat === "actif" && ici && (verification !== null || ici.recu !== true);

  return (
    <Carte className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-full",
            etat === "actif"
              ? "bg-succes-clair text-succes"
              : etat === "refuse" || etat === "non_supporte"
                ? "bg-creme text-texte-pale"
                : "bg-orange-clair text-orange-fonce",
          )}
        >
          {etat === "actif" ? (
            <Check className="h-6 w-6" />
          ) : etat === "non_supporte" ? (
            <Smartphone className="h-6 w-6" />
          ) : etat === "refuse" ? (
            <BellOff className="h-6 w-6" />
          ) : (
            <BellRing className="h-6 w-6" />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          {etat === "inactif" && (
            <>
              <h3 className="text-lg font-extrabold leading-tight">Recevoir les rappels sur {iciTexte}</h3>
              <p className="text-base leading-relaxed text-texte-pale">
                {f(
                  "On te prévient 15 minutes avant chaque cours en direct, la veille d'un devoir et quand un formateur te répond. Jamais la nuit, et 3 rappels par jour au plus.",
                  "Le campus vous prévient 15 minutes avant chaque cours en direct et quand un message vous attend. Jamais la nuit, et 3 rappels par jour au plus.",
                )}
              </p>
            </>
          )}
          {etat === "actif" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-extrabold leading-tight">Rappels activés</h3>
                <Badge ton="succes">{Ici}</Badge>
              </div>
              <p className="text-base leading-relaxed text-texte-pale">
                {f(
                  "Tu seras prévenu avant chaque cours en direct, même quand le campus est fermé.",
                  "Vous serez prévenu avant chaque cours en direct, même quand le campus est fermé.",
                )}
              </p>
            </>
          )}
          {etat === "refuse" && (
            <>
              <h3 className="text-lg font-extrabold leading-tight">Les rappels sont bloqués sur {iciTexte}</h3>
              <p className="text-base leading-relaxed text-texte-pale">
                {f(
                  "Sans rappel, tu risques de rater le début d'un cours en direct. Tu peux les débloquer en trois gestes.",
                  "Sans rappel, vous risquez de manquer le début d'un cours en direct. Vous pouvez les débloquer en trois gestes.",
                )}
              </p>
            </>
          )}
          {etat === "non_supporte" && (
            <>
              <h3 className="text-lg font-extrabold leading-tight">Rappels indisponibles dans ce navigateur</h3>
              <p className="text-base leading-relaxed text-texte-pale">{texteNonSupporte}</p>
            </>
          )}
        </div>
      </div>

      {etat === "inactif" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Bouton
            taille="lg"
            className="sm:w-auto"
            pleineLargeur
            icone={<BellRing className="h-5 w-5" />}
            chargement={occupe === "activer"}
            onClick={() => void activer()}
          >
            Oui, me prévenir
          </Bouton>
          <p className="text-sm text-texte-gris">
            {f(`Ton ${appareil} va demander l'autorisation : touche « Autoriser ».`, `Votre ${appareil} va demander l'autorisation : touchez « Autoriser ».`)}
          </p>
        </div>
      )}
      {aVerifier && (
        <VerificationRappel
          endpoint={ici.endpoint}
          autoEssai={verification === "auto"}
          recuInitial={verification === "auto" ? null : ici.recu}
          onFini={(recu) => setIci({ ...ici, recu })}
          onPerdu={() => void verifier()}
        />
      )}
      {etat === "actif" && (
        <div className="flex flex-wrap gap-2">
          {!aVerifier && (
            <Bouton variante="doux" className="min-h-[48px]" chargement={occupe === "essai"} onClick={() => void essayer()}>
              M'envoyer un essai
            </Bouton>
          )}
          <Bouton variante="fantome" className="min-h-[48px]" chargement={occupe === "desactiver"} onClick={() => void desactiver()}>
            Ne plus recevoir
          </Bouton>
        </div>
      )}
      {etat === "refuse" && (
        <div className="flex flex-wrap gap-2">
          <Bouton variante="doux" className="min-h-[48px]" onClick={() => setAide(true)}>
            Voir comment débloquer
          </Bouton>
        </div>
      )}
      {aideDeblocage}
    </Carte>
  );
}

/** Fenêtre « Débloquer les rappels » : le pas à pas, puis « J'ai autorisé, vérifier ». */
export function FenetreDeblocage({ ouverte, onFermer, onVerifier }: { ouverte: boolean; onFermer: () => void; onVerifier: () => void }) {
  const { moi } = useMoi();
  const f = (tu: string, vous: string) => formuler(moi?.role, tu, vous);
  const appareil = plateforme() === "ordinateur" ? "ordinateur" : "téléphone";
  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Débloquer les rappels"
      description={f(
        `Ton ${appareil} a bloqué les rappels du campus. Voici comment les autoriser.`,
        `Votre ${appareil} a bloqué les rappels du campus. Voici comment les autoriser.`,
      )}
      pied={<Bouton onClick={onVerifier}>J'ai autorisé, vérifier</Bouton>}
    >
      <AideDeblocage installee={estInstallee()} f={f} />
    </Fenetre>
  );
}

/** Pas à pas pour autoriser les rappels, selon que le campus est installé ou ouvert dans Chrome. */
function AideDeblocage({ installee, f }: { installee: boolean; f: (tu: string, vous: string) => string }) {
  const etapes = installee
    ? [
        f("Ouvre les Paramètres de ton téléphone.", "Ouvrez les Paramètres de votre téléphone."),
        f("Touche Applications, puis « Campus 2IAE ».", "Touchez Applications, puis « Campus 2IAE »."),
        f("Touche Notifications et active-les.", "Touchez Notifications et activez-les."),
      ]
    : [
        f(
          "Touche le cadenas (ou ⓘ) à gauche de l'adresse du campus, en haut de Chrome.",
          "Touchez le cadenas (ou ⓘ) à gauche de l'adresse du campus, en haut de Chrome.",
        ),
        f("Touche Autorisations, puis Notifications.", "Touchez Autorisations, puis Notifications."),
        f("Choisis « Autoriser », puis reviens ici.", "Choisissez « Autoriser », puis revenez ici."),
      ];
  return (
    <ol className="flex flex-col gap-3 pb-2">
      {etapes.map((e, i) => (
        <li key={i} className="flex items-start gap-3 text-base">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange font-extrabold text-encre">{i + 1}</span>
          <span className="pt-1">{e}</span>
        </li>
      ))}
    </ol>
  );
}
