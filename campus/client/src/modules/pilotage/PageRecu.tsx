// /pilotage/recus/:id : le reçu d'un versement, à imprimer ou à partager sur
// WhatsApp (page nue, sans la coquille).
import { EcranRecu } from "./composants/Recu";

export default function PageRecu({ id }: { id: string }) {
  return <EcranRecu url={`/api/pilotage/versements/${encodeURIComponent(id)}/recu`} retour="/pilotage/scolarite?onglet=caisse" equipe />;
}
