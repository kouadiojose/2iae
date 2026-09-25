// Carte « Recevoir les rappels sur ce téléphone » (Web Push, par appareil).
//
// L'explication vient TOUJOURS avant la fenêtre système de Chrome, qui est
// sèche et fait refuser. États : non supporté (conseil : Chrome, ou installer
// sur iPhone), bloqué (aide pas à pas pour débloquer), actif (essai,
// désactivation), et masqué quand le campus n'a pas de clé d'envoi.
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, BellOff, Check, Smartphone } from "lucide-react";
import { useMoi, rechargerMoi } from "@/lib/auth";
import { api, post } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Badge } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { toast, toastErreur } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { obtenirEnregistrement } from "./service-worker";
import { formuler, plateforme, estInstallee } from "./outils";
import type { ClePush, ResultatEssaiPush } from "@shared/schema";

type Etat = "chargement" | "masque" | "non_supporte" | "refuse" | "inactif" | "actif";

/** Prévient les autres cartes de la page (compacte et complète) qu'il faut relire l'état. */
const EVENEMENT_MAJ = "campus:rappels-maj";
const prevenirAutresCartes = () => window.dispatchEvent(new Event(EVENEMENT_MAJ));

const pushSupporte = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

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

async function abonnementActuel(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export function ActiverNotifications({ compact = false }: { compact?: boolean }) {
  const { moi } = useMoi();
  const role = moi?.role;
  const f = (tu: string, vous: string) => formuler(role, tu, vous);
  const { data, isLoading, isError } = useQuery<ClePush>({ queryKey: ["/api/push/cle"], staleTime: 10 * 60_000 });
  const cle = data?.cle ?? null;
  const [etat, setEtat] = useState<Etat>("chargement");
  const [occupe, setOccupe] = useState<"activer" | "essai" | "desactiver" | null>(null);
  const [aide, setAide] = useState(false);
  // « ce téléphone » ou « cet ordinateur » : les rappels sont liés à l'appareil, pas au compte.
  const appareil = plateforme() === "ordinateur" ? "ordinateur" : "téléphone";
  const ici = appareil === "ordinateur" ? "cet ordinateur" : "ce téléphone";
  const Ici = ici.charAt(0).toUpperCase() + ici.slice(1);

  const verifier = useCallback(async () => {
    if (!cle) return setEtat("masque");
    if (!pushSupporte()) return setEtat("non_supporte");
    if (Notification.permission === "denied") return setEtat("refuse");
    const abo = await abonnementActuel().catch(() => null);
    if (abo && Notification.permission === "granted") {
      setEtat("actif");
      // Resynchronise ce téléphone avec le compte connecté (téléphone partagé, base remise à zéro…).
      if (moi) void post("/api/push/abonnement", abo.toJSON()).catch(() => undefined);
    } else setEtat("inactif");
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
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setEtat("refuse");
        return;
      }
      if (permission !== "granted") {
        toast(f("Pas de souci : tu pourras activer les rappels plus tard.", "Pas de souci : vous pourrez activer les rappels plus tard."), "info");
        return;
      }
      const reg = await travailleurPret();
      const abo =
        (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleEnOctets(cle) }));
      await post("/api/push/abonnement", abo.toJSON());
      setEtat("actif");
      prevenirAutresCartes();
      toast(`Rappels activés sur ${ici}.`);
      void rechargerMoi();
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
      setEtat("inactif");
      prevenirAutresCartes();
      toast(f(`Tu ne recevras plus de rappels sur ${ici}.`, `Vous ne recevrez plus de rappels sur ${ici}.`), "info");
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
      toastErreur(e);
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
    <Fenetre
      ouverte={aide}
      onFermer={() => setAide(false)}
      titre="Débloquer les rappels"
      description={f(
        `Ton ${appareil} a bloqué les rappels du campus. Voici comment les autoriser.`,
        `Votre ${appareil} a bloqué les rappels du campus. Voici comment les autoriser.`,
      )}
      pied={
        <Bouton
          onClick={() => {
            setAide(false);
            void verifier();
          }}
        >
          J'ai autorisé, vérifier
        </Bouton>
      }
    >
      <AideDeblocage installee={estInstallee()} f={f} />
    </Fenetre>
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
          <p className="text-base font-bold">Rappels sur {ici}</p>
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
              <h3 className="text-lg font-extrabold leading-tight">Recevoir les rappels sur {ici}</h3>
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
              <h3 className="text-lg font-extrabold leading-tight">Les rappels sont bloqués sur {ici}</h3>
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
      {etat === "actif" && (
        <div className="flex flex-wrap gap-2">
          <Bouton variante="doux" className="min-h-[48px]" chargement={occupe === "essai"} onClick={() => void essayer()}>
            M'envoyer un essai
          </Bouton>
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
