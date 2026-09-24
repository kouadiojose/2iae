// Charte, code secret et appareils connectés.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileCheck2, KeyRound, MonitorSmartphone } from "lucide-react";
import { post, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { Bouton } from "@/components/ui/bouton";
import { Fenetre } from "@/components/ui/fenetre";
import { toast } from "@/components/ui/toast";
import { dateComplete } from "@/lib/dates";
import { pluriel } from "@/lib/utils";
import type { Moi } from "@shared/schema";
import { majMoi, tuOuVous } from "../../outils";
import { ContenuCharte } from "../Charte";
import { PaveCode } from "../PaveCode";
import { FormulaireMotDePasse } from "../FormulaireMotDePasse";
import { Section } from "./Section";

export function Charte({ moi }: { moi: Moi }) {
  const t = tuOuVous(moi);
  const [ouverte, setOuverte] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const acceptee = Boolean(moi.charteAccepteeLe);

  async function accepter() {
    setEnvoi(true);
    try {
      majMoi(await post<Moi>("/api/compte/charte"));
      setOuverte(false);
      toast(t("Merci ! Charte acceptée.", "Charte acceptée."));
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : "Une erreur est survenue.", "erreur");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <Section
        id="charte"
        titre="Charte du campus"
        icone={<FileCheck2 className="h-5 w-5" />}
        description={
          acceptee
            ? t(`Tu l'as acceptée le ${dateComplete(moi.charteAccepteeLe!).toLowerCase()}.`, `Acceptée le ${dateComplete(moi.charteAccepteeLe!).toLowerCase()}.`)
            : t("IA, enregistrement des lives et données personnelles : trois règles courtes.", "IA, enregistrement des séances et données : trois engagements courts.")
        }
        action={
          <Bouton variante={acceptee ? "contour" : "principal"} onClick={() => setOuverte(true)} className="min-h-[48px] shrink-0">
            {acceptee ? "Relire" : "Lire et accepter"}
          </Bouton>
        }
      />
      <Fenetre
        ouverte={ouverte}
        onFermer={() => setOuverte(false)}
        titre="Charte du campus"
        large
        pied={
          acceptee ? (
            <Bouton variante="contour" onClick={() => setOuverte(false)} className="min-h-[48px]">
              Fermer
            </Bouton>
          ) : (
            <Bouton taille="lg" chargement={envoi} onClick={() => void accepter()} className="min-h-[52px] w-full sm:w-auto">
              J'accepte
            </Bouton>
          )
        }
      >
        <div className="pb-2">
          <ContenuCharte role={moi.role} />
        </div>
      </Fenetre>
    </>
  );
}

export function Securite({ moi }: { moi: Moi }) {
  const t = tuOuVous(moi);
  const etudiant = moi.role === "etudiant";
  const [changer, setChanger] = useState(false);
  const { data: appareils } = useQuery<{ autres: number }>({ queryKey: ["/api/compte/appareils"] });
  const [envoi, setEnvoi] = useState(false);
  const autres = appareils?.autres ?? 0;

  async function deconnecterAutres() {
    setEnvoi(true);
    try {
      const r = await post<{ ok: true; fermees: number }>("/api/compte/deconnecter-partout");
      toast(r.fermees ? `${pluriel(r.fermees, "appareil déconnecté", "appareils déconnectés")}.` : t("Aucun autre appareil n'était connecté.", "Aucun autre appareil n'était connecté."));
      void rafraichir("/api/compte/appareils");
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : "Une erreur est survenue.", "erreur");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <Section
        id="code"
        titre={etudiant ? "Mon code secret" : "Mon mot de passe"}
        icone={<KeyRound className="h-5 w-5" />}
        description={t("Ne le donne à personne, même pas à un ami. Tes autres appareils seront déconnectés.", "Vos autres appareils seront déconnectés après le changement.")}
        action={
          <Bouton variante="contour" onClick={() => setChanger(true)} className="min-h-[48px] shrink-0">
            Changer
          </Bouton>
        }
      />
      <Section
        id="appareils"
        titre={t("Mes appareils", "Mes appareils")}
        icone={<MonitorSmartphone className="h-5 w-5" />}
        description={
          autres
            ? t(`Ton compte est aussi ouvert sur ${pluriel(autres, "autre appareil", "autres appareils")}. Tu ne les reconnais pas ? Déconnecte-les.`, `Votre compte est aussi ouvert sur ${pluriel(autres, "autre appareil", "autres appareils")}.`)
            : t("Ton compte n'est ouvert que sur cet appareil.", "Votre compte n'est ouvert que sur cet appareil.")
        }
      >
        <Bouton variante="contour" taille="lg" chargement={envoi} disabled={!autres} onClick={() => void deconnecterAutres()} className="min-h-[52px] w-full sm:w-auto">
          Déconnecter mes autres appareils
        </Bouton>
      </Section>
      <FenetreChangerCode moi={moi} ouverte={changer} onFermer={() => setChanger(false)} />
    </>
  );
}

/** Étudiant : le pavé (code actuel, puis nouveau code confirmé). Personnel : formulaire. */
function FenetreChangerCode({ moi, ouverte, onFermer }: { moi: Moi; ouverte: boolean; onFermer: () => void }) {
  const etudiant = moi.role === "etudiant";
  const [actuel, setActuel] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [remise, setRemise] = useState(0);

  function fermer() {
    setActuel(null);
    setErreur(null);
    setOccupe(false);
    onFermer();
  }

  async function enregistrer(nouveau: string, ancien: string) {
    await post("/api/auth/mot-de-passe", { actuel: ancien, nouveau });
    majMoi({ ...moi, doitChangerMotDePasse: false });
    void rafraichir("/api/compte/appareils");
    toast(etudiant ? "Ton nouveau code est enregistré." : "Votre nouveau mot de passe est enregistré.");
    fermer();
  }

  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={fermer}
      titre={etudiant ? "Changer mon code secret" : "Changer mon mot de passe"}
      description={etudiant ? undefined : "10 caractères au moins. Vos autres appareils seront déconnectés."}
    >
      <div className="pb-4 pt-2">
        {etudiant ? (
          actuel === null ? (
            <PaveCode
              key="actuel"
              mode="saisie"
              titre="Tape ton code actuel"
              longueur={6}
              erreur={erreur}
              remise={remise}
              onTermine={(code) => {
                setErreur(null);
                setActuel(code);
              }}
            />
          ) : (
            <PaveCode
              key="nouveau"
              mode="choix"
              titre="Choisis ton nouveau code"
              aide="6 chiffres. Évite ta date de naissance."
              longueur={6}
              occupe={occupe}
              erreur={erreur}
              remise={remise}
              onTermine={async (code) => {
                setOccupe(true);
                setErreur(null);
                try {
                  await enregistrer(code, actuel);
                } catch (e) {
                  const message = e instanceof ErreurApi ? e.message : "Une erreur est survenue. Réessaie dans un instant.";
                  setErreur(message);
                  setOccupe(false);
                  setRemise((n) => n + 1);
                  // Code actuel faux : on le redemande.
                  if (/actuel/i.test(message)) setActuel(null);
                }
              }}
            />
          )
        ) : (
          <FormulaireMotDePasse minimum={10} actuelRequis libelleBouton="Enregistrer mon mot de passe" onValider={(n, a) => enregistrer(n, a ?? "")} />
        )}
      </div>
    </Fenetre>
  );
}
