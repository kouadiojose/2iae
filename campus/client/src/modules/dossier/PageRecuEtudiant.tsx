// /mon-dossier/recus/:id : l'étudiant voit, imprime ou garde en PDF un de ses
// reçus (page nue, sans la coquille).
import { EcranRecu } from "@/modules/pilotage/composants/Recu";

export default function PageRecuEtudiant({ id }: { id: string }) {
  return <EcranRecu url={`/api/mon-dossier/versements/${encodeURIComponent(id)}/recu`} retour="/mon-dossier" />;
}
