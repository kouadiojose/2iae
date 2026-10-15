// /pilotage/professeurs — les professeurs du groupe (José, 15 octobre 2026 : « depuis la direction, créer des
// professeurs et les attacher à une classe ; un cours peut avoir plusieurs professeurs »). Un gros carré par
// professeur avec ses cours ; « Nouveau professeur » (qui, ses cours, son lien d'invitation) ; « Attacher à un cours »
// en deux touchers ; la fiche pour mettre en principal, retirer ou changer les classes d'un cours.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus, Users } from "lucide-react";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { GrosBouton } from "@/components/ui/gros-blocs";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { t as tProfs } from "@shared/textes/professeurs";
import type { ProfesseurDto, ProfesseursDto } from "@shared/professeurs";
import { SousNav } from "./composants/SousNav";
import { FenetreInvitation, type PersonneAInviter } from "./composants/FenetreInvitation";
import { CLE_PROFESSEURS, CarteProfesseur, FenetreNouveauProfesseur, FenetreProfesseur, FeuilleAttacher } from "./composants/professeurs";
import { FenetreCours } from "./PageCours";

type Filtre = "tous" | "inviter" | "sansCours";
const sansAccents = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export default function PageProfesseurs() {
  const tx = useTextes(tProfs);
  const { data, isLoading, error, refetch } = useQuery<ProfesseursDto>({ queryKey: [CLE_PROFESSEURS] });
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [q, setQ] = useState("");
  const [nouveau, setNouveau] = useState(false);
  const [attacher, setAttacher] = useState<number | null>(null);
  const [fiche, setFiche] = useState<number | null>(null);
  const [invite, setInvite] = useState<PersonneAInviter | null>(null);
  const [coursOuvert, setCoursOuvert] = useState<number | null>(null);
  const [voirDesactives, setVoirDesactives] = useState(false);
  const tous = data?.professeurs ?? [];
  const actifs = tous.filter((p) => p.etat !== "desactive");
  const desactives = tous.filter((p) => p.etat === "desactive");
  const aInviter = actifs.filter((p) => p.etat === "a_inviter" || p.etat === "invite");
  const sansCours = actifs.filter((p) => !p.cours.length);
  const visibles = useMemo(() => {
    const n = sansAccents(q.trim());
    const base = filtre === "inviter" ? aInviter : filtre === "sansCours" ? sansCours : actifs;
    return base.filter((p) => !n || sansAccents(`${p.prenom} ${p.nom} ${p.cours.map((c) => `${c.code} ${c.titre}`).join(" ")}`).includes(n));
  }, [q, filtre, aInviter, sansCours, actifs]);
  const parId = (id: number | null): ProfesseurDto | null => (id === null ? null : (tous.find((p) => p.id === id) ?? null));
  const inviter = (p: ProfesseurDto) => setInvite({ id: p.id, prenom: p.prenom, nom: p.nom, email: p.email, telephone: p.telephone });
  const carte = (p: ProfesseurDto) => (
    <CarteProfesseur
      key={p.id}
      p={p}
      peutAttacher={Boolean(data?.peutAttacher)}
      peutInviter={Boolean(data?.peutInviter)}
      onAttacher={() => setAttacher(p.id)}
      onInviter={() => inviter(p)}
      onOuvrir={() => setFiche(p.id)}
    />
  );
  const pastille = (valeur: Filtre, libelle: string) => (
    <button
      type="button"
      onClick={() => setFiltre(valeur)}
      aria-pressed={filtre === valeur}
      className={cn("min-h-[48px] rounded-full border-2 px-5 text-[17px] font-bold", filtre === valeur ? "border-encre bg-encre text-white" : "border-ligne bg-white text-encre hover:border-orange")}
    >
      {libelle}
    </button>
  );
  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette={tx("pilotage.etiquette")}
        titre={tx("pilotage.titre")}
        sousTitre={tx("pilotage.sousTitre")}
        actions={
          data?.peutCreer ? (
            <GrosBouton onClick={() => setNouveau(true)} icone={<UserPlus className="h-6 w-6" aria-hidden />}>
              {tx("pilotage.nouveau")}
            </GrosBouton>
          ) : undefined
        }
      />
      {isLoading ? (
        <p className="text-[20px] font-bold text-texte-doux" aria-busy="true">
          {tx("pilotage.chargement")}
        </p>
      ) : error || !data ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-[20px] font-bold">{error instanceof Error ? error.message : tx("pilotage.erreur")}</p>
          <GrosBouton onClick={() => void refetch()}>Réessayer</GrosBouton>
        </div>
      ) : !tous.length ? (
        <div className="flex flex-col items-start gap-4 rounded-[28px] border-2 border-dashed border-ligne bg-white p-8">
          <Users className="h-10 w-10 text-orange-profond" aria-hidden />
          <p className="text-[26px] font-black">{tx("pilotage.vide.titre")}</p>
          <p className="text-[19px] text-texte-doux">{tx("pilotage.vide.texte")}</p>
          {data.peutCreer && <GrosBouton onClick={() => setNouveau(true)}>{tx("pilotage.nouveau")}</GrosBouton>}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {pastille("tous", tx("pilotage.filtre.tous", { v: { n: actifs.length } }))}
            {pastille("inviter", tx("pilotage.filtre.inviter", { v: { n: aInviter.length } }))}
            {pastille("sansCours", tx("pilotage.filtre.sansCours", { v: { n: sansCours.length } }))}
          </div>
          {actifs.length > 8 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tx("pilotage.chercher")}
                aria-label={tx("pilotage.chercher")}
                className="min-h-[56px] w-full rounded-[16px] border-2 border-ligne bg-white pl-12 pr-4 text-[18px] outline-none focus:border-orange"
              />
            </div>
          )}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2" data-liste-professeurs>
            {visibles.map(carte)}
          </div>
          {desactives.length > 0 && filtre === "tous" && (
            <section className="flex flex-col gap-3">
              <button type="button" onClick={() => setVoirDesactives(!voirDesactives)} className="min-h-[48px] self-start text-[18px] font-bold underline underline-offset-4">
                {tx("pilotage.section.desactives", { v: { n: desactives.length } })} · {voirDesactives ? tx("pilotage.cacher") : tx("pilotage.voir")}
              </button>
              {voirDesactives && <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">{desactives.map(carte)}</div>}
            </section>
          )}
        </>
      )}
      <FenetreNouveauProfesseur
        ouverte={nouveau}
        onFermer={() => setNouveau(false)}
        existants={tous}
        peutAttacher={Boolean(data?.peutAttacher)}
        onOuvrirFiche={(id) => {
          setNouveau(false);
          setFiche(id);
        }}
      />
      <FeuilleAttacher key={attacher ?? 0} p={parId(attacher)} onFermer={() => setAttacher(null)} />
      <FenetreProfesseur
        p={parId(fiche)}
        peutAttacher={Boolean(data?.peutAttacher)}
        peutInviter={Boolean(data?.peutInviter)}
        onFermer={() => setFiche(null)}
        onAttacher={() => {
          setAttacher(fiche);
          setFiche(null);
        }}
        onInviter={() => {
          const p = parId(fiche);
          setFiche(null);
          if (p) inviter(p);
        }}
        onClasses={(coursId) => {
          setFiche(null);
          setCoursOuvert(coursId);
        }}
      />
      <FenetreInvitation personne={invite} onFermer={() => setInvite(null)} />
      {coursOuvert !== null && <FenetreCours key={coursOuvert} id={coursOuvert} onFermer={() => setCoursOuvert(null)} />}
    </Page>
  );
}
