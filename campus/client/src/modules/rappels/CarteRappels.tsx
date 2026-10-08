// Carte des rappels sur l'accueil étudiant, juste avant l'invitation à
// installer le campus (chantier C3 ; emplacement posé par le socle C0).
//
// Elle ne se montre que tant que les rappels ne marchent pas sur CE téléphone :
//   - pas encore activés : « Ne rate plus ton cours : active les rappels » ;
//   - activés puis perdus (abonnement oublié) : « Tes rappels ne marchent plus » ;
//   - bloqués dans le navigateur : le pas à pas pour les débloquer ;
//   - activés mais jamais vérifiés : un essai, puis « L'as-tu reçu ? » ;
//   - « Non » : le guide selon la marque, puis un nouvel essai.
// Une fois l'essai reçu, elle disparaît. « Plus tard » la masque 7 jours.
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellOff, BellRing, ShieldCheck, Smartphone } from "lucide-react";
import { useMoi } from "@/lib/auth";
import { useTextes } from "@/lib/textes";
import { Bouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { toast, toastErreur } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { EVENEMENT_MAJ, FenetreDeblocage, activerRappels, lireEtatTelephone, type EtatTelephone } from "@/modules/pwa/ActiverNotifications";
import { VerificationRappel } from "./VerificationRappel";
import { masqueePlusTard, plusTard } from "./memoire";
import { t } from "@shared/textes/rappels";
import type { ClePush } from "@shared/schema";

type Vue = "activer" | "perdu" | "bloque" | "verifier" | "pasRecu";

export function CarteRappels() {
  const tx = useTextes(t);
  const { moi } = useMoi();
  const { data, isLoading, isError } = useQuery<ClePush>({ queryKey: ["/api/push/cle"], staleTime: 10 * 60_000 });
  const cle = data?.cle ?? null;
  const [masquee, setMasquee] = useState(() => masqueePlusTard("carte"));
  const [etat, setEtat] = useState<EtatTelephone | null>(null);
  /** Vérification en cours dans cette visite : la carte reste jusqu'au bout, même après « Oui ». */
  const [verification, setVerification] = useState<{ auto: boolean } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [aide, setAide] = useState(false);
  /** « Oui, je l'ai reçu » : il ne reste que le message de réussite. */
  const [fini, setFini] = useState(false);

  const lire = useCallback(async () => {
    setEtat(await lireEtatTelephone(cle, Boolean(moi)).catch((): EtatTelephone => ({ etat: "masque" })));
  }, [cle, moi?.id]);

  useEffect(() => {
    if (isLoading || masquee) return;
    if (isError) return setEtat({ etat: "masque" });
    void lire();
    const maj = () => void lire();
    window.addEventListener(EVENEMENT_MAJ, maj);
    return () => window.removeEventListener(EVENEMENT_MAJ, maj);
  }, [isLoading, isError, masquee, lire]);

  async function activer() {
    if (!cle) return;
    setOccupe(true);
    try {
      const r = await activerRappels(cle);
      if (r.resultat === "refuse") return setEtat({ etat: "refuse" });
      if (r.resultat === "plus_tard") return toast(tx("carte.refusTemporaire"), "info");
      setEtat({ etat: "actif", endpoint: r.endpoint, serveur: null });
      setVerification({ auto: true });
      toast(tx("carte.active"));
    } catch (e) {
      toastErreur(e instanceof Error && e.name !== "Error" ? new Error(tx("carte.erreur")) : e);
    } finally {
      setOccupe(false);
    }
  }

  if (masquee || !etat) return null;
  let vue: Vue | null = null;
  if (etat.etat === "refuse") vue = "bloque";
  else if (etat.etat === "inactif") vue = etat.perdu ? "perdu" : "activer";
  else if (etat.etat === "actif") {
    const recu = etat.serveur?.cetAppareil?.recu ?? null;
    if (verification) vue = "verifier";
    else if (recu === false) vue = "pasRecu";
    else if (recu === null && etat.serveur) vue = "verifier";
  }
  // Masquée, non prise en charge (iPhone non installé : l'invitation à installer juste en dessous s'en charge) ou vérifiée.
  if (!vue) return null;

  const Icone = vue === "bloque" || vue === "perdu" ? BellOff : vue === "activer" ? BellRing : vue === "pasRecu" ? Smartphone : ShieldCheck;
  const titre = {
    activer: tx("carte.activer.titre"),
    perdu: tx("carte.perdu.titre"),
    bloque: tx("carte.bloque.titre"),
    verifier: tx("carte.verifier.titre"),
    pasRecu: tx("carte.pasRecu.titre"),
  }[vue];
  const texte = {
    activer: tx("carte.activer.texte"),
    perdu: tx("carte.perdu.texte"),
    bloque: tx("carte.bloque.texte"),
    verifier: tx("carte.verifier.texte"),
    pasRecu: tx("carte.pasRecu.texte"),
  }[vue];
  const plusTardBouton = (
    <Bouton
      variante="fantome"
      className="min-h-[48px]"
      onClick={() => {
        plusTard("carte");
        setMasquee(true);
      }}
    >
      {tx("carte.plusTard")}
    </Bouton>
  );

  return (
    <Carte className="flex flex-col gap-4" aria-labelledby="titre-carte-rappels" data-carte-rappels={vue}>
      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full",
            vue === "bloque" || vue === "perdu" ? "bg-danger-clair text-danger" : "bg-orange-clair text-orange-fonce",
          )}
        >
          <Icone className="h-5 w-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id="titre-carte-rappels" className="text-lg font-extrabold leading-tight">
            {titre}
          </h3>
          <p className="text-[15px] leading-relaxed text-texte-pale">{texte}</p>
        </div>
      </div>

      {(vue === "activer" || vue === "perdu") && (
        <div className="flex flex-col gap-2">
          <Bouton taille="lg" pleineLargeur className="sm:w-auto sm:self-start" icone={<BellRing className="h-5 w-5" />} chargement={occupe} onClick={() => void activer()}>
            {tx(vue === "perdu" ? "carte.perdu.bouton" : "carte.activer.bouton")}
          </Bouton>
          <p className="text-sm text-texte-gris">{tx("carte.activer.aide")}</p>
          <div className="-mt-1">{plusTardBouton}</div>
        </div>
      )}

      {vue === "bloque" && (
        <div className="flex flex-wrap gap-2">
          <Bouton variante="doux" className="min-h-[48px]" onClick={() => setAide(true)}>
            {tx("carte.bloque.bouton")}
          </Bouton>
          {plusTardBouton}
          <FenetreDeblocage
            ouverte={aide}
            onFermer={() => setAide(false)}
            onVerifier={() => {
              setAide(false);
              void lire();
            }}
          />
        </div>
      )}

      {(vue === "verifier" || vue === "pasRecu") && etat.etat === "actif" && (
        <>
          <VerificationRappel
            endpoint={etat.endpoint}
            autoEssai={verification?.auto ?? false}
            recuInitial={verification ? null : (etat.serveur?.cetAppareil?.recu ?? null)}
            onFini={(recu) => {
              setVerification((v) => v ?? { auto: false });
              setFini(recu);
            }}
            onPerdu={() => {
              setVerification(null);
              void lire();
            }}
          />
          {!fini && <div className="-mt-1">{plusTardBouton}</div>}
        </>
      )}
    </Carte>
  );
}
