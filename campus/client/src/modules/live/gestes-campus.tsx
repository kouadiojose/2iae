// Gestes du chargé d'un campus, annoncés au Studio du formateur (José, 15 octobre 2026 à 5 h) : « Yamoussoukro a ajouté
// un PowerPoint (3 diapos). », « Yamoussoukro a ajouté une vidéo : « … ». », « Yamoussoukro a fermé sa salle. »,
// « Yamoussoukro a terminé le cours. ». Événement « campus:geste » du canal de la séance (routes/espace-campus.ts).
import { useCanal } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { toast } from "@/components/ui/toast";
import { t as tEnseigner } from "@shared/textes/enseigner";
import { EVENEMENT_GESTE_CAMPUS, type GesteCampusDto } from "@shared/espace-campus";

export function useGestesCampus(seanceId: number, actif: boolean) {
  const tx = useTextes(tEnseigner);
  useCanal(actif ? `seance:${seanceId}` : null, (e) => {
    if (e.type !== EVENEMENT_GESTE_CAMPUS || !e.data) return;
    const g = e.data as GesteCampusDto;
    if (g.type === "ajout_ppt") {
      toast(g.diapos === 1 ? tx("campus.ajoutPpt.un", { v: { site: g.site } }) : tx("campus.ajoutPpt", { v: { site: g.site, n: g.diapos } }), "info");
      void rafraichir(`/api/seances/${seanceId}`);
    } else if (g.type === "ajout_video") {
      toast(tx("campus.ajoutVideo", { v: { site: g.site, titre: g.titre } }), "info");
      void rafraichir(`/api/seances/${seanceId}`);
    } else if (g.type === "salle_fermee") toast(tx("campus.salleFermee", { v: { site: g.site } }), "info");
    else if (g.type === "termine") toast(tx("campus.termine", { v: { site: g.site } }), "info");
  });
}
