// /visio/essai-livekit — la salle d'essai de la nouvelle visio (LiveKit, serveur du campus), pour le personnel :
// tester l'image, le son et le très faible débit avant que les cours y passent. Rien n'est enregistré.
import { useMoiConnecte } from "@/lib/auth";
import { post } from "@/lib/api";
import { Page, EnTetePage } from "@/components/layout/coquille";
import type { AccesDaily } from "@shared/schema";
import { SalleVisio } from "./SalleVisio";
import { roleCadreDuCompte } from "./SectionVisioClasse";

export default function PageEssaiLivekit() {
  const moi = useMoiConnecte();
  const lien = `${window.location.origin}/visio/essai-livekit`;
  return (
    <Page className="max-w-5xl">
      <EnTetePage
        etiquette="Nouvelle visio · essai"
        titre="Salle d'essai de la nouvelle visio"
        sousTitre="La visio du campus sur son propre serveur. Entrez à deux ou trois (un collègue, l'écran d'une salle) pour juger l'image et le son, y compris en 4G faible."
      />
      <SalleVisio
        nomSalle="Salle d'essai (nouvelle visio)"
        titreBouton="Entrer dans la salle d'essai"
        tu={false}
        role={roleCadreDuCompte(moi.role)}
        obtenirAcces={() => post<AccesDaily>("/api/visio/livekit/essai/rejoindre")}
        urlPresence={null}
        lienPartage={lien}
        messagePartage="Rejoignez-moi dans la salle d'essai de la nouvelle visio du campus 2IAE (connectez-vous avec votre compte du campus) :"
        bandeau="Salle d'essai de la nouvelle visio : rien n'est enregistré, et la visite s'arrête seule au bout d'une heure."
        invitation
      />
    </Page>
  );
}
