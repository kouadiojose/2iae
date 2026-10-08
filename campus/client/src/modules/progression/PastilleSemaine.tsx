// Pastille « ma semaine » à côté du titre de l'accueil étudiant (chantier C5) :
// « 2/3 j » (jours actifs sur l'objectif) dans un petit anneau ; elle ouvre
// « Ma progression ». Emplacement posé par le socle (C0), sous une limite
// d'erreur : rien ne s'affiche tant que la réponse n'est pas là.
import { Link } from "wouter";
import { useTextes } from "@/lib/textes";
import { t } from "@shared/textes/progression";
import { useProgression } from "./donnees";
import { Anneau } from "./Pastilles";

export function PastilleSemaine() {
  const tx = useTextes(t);
  const { data } = useProgression();
  if (!data) return null;
  const n = data.semaine.joursActifs.length;
  const objectif = data.semaine.objectif;
  return (
    <Link
      href="/progression"
      className="flex min-h-11 items-center gap-2 rounded-full bg-creme py-1.5 pl-1.5 pr-3.5 text-encre no-underline hover:bg-orange-clair hover:text-encre"
      aria-label={tx("pastille.aria", { v: { n, objectif } })}
    >
      <span className="relative grid place-items-center">
        <Anneau valeur={n} total={objectif} taille={32} epaisseur={4} />
      </span>
      <span className="font-mono text-sm font-bold tabular-nums">{tx("pastille.libelle", { v: { n, objectif } })}</span>
    </Link>
  );
}
