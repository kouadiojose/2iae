// Devoir en groupe (groupes formés par les étudiants, novembre 2026), sur /devoirs/:id : les groupes du devoir
// (membres et campus), « Créer un groupe », « Rejoindre », « Quitter » avant que le groupe ait rendu, et le lien
// « Discussion du groupe » vers sa conversation (/messages/:id). Le serveur tranche tout (taille, date limite,
// groupe déjà rendu) ; l'écran se remet à jour au moindre changement (événement « devoir-groupe »).
import { useState } from "react";
import { MessageCircle, Plus, Users, LogOut, CheckCircle2 } from "lucide-react";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Champ } from "@/components/ui/champs";
import { Badge } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { toast, toastErreur } from "@/components/ui/toast";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import type { GroupesDuDevoirEtudiant } from "@shared/schema";
import { t as textesGroupe } from "@shared/textes/devoirs-groupe";

export function GroupesDevoir({ devoirId, groupes, prenom }: { devoirId: number; groupes: GroupesDuDevoirEtudiant; prenom: string }) {
  const tg = useTextes(textesGroupe);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState("");
  const [confirmerDepart, setConfirmerDepart] = useState(false);
  const monGroupe = groupes.groupes.find((g) => g.monGroupe) ?? null;
  const autres = groupes.groupes.filter((g) => !g.monGroupe);

  async function agir(cle: string, url: string, corps: unknown, message: string) {
    setOccupe(cle);
    try {
      await post(url, corps);
      toast(message);
      await rafraichir("/api/devoirs", "/api/conversations");
      return true;
    } catch (e) {
      toastErreur(e);
      return false;
    } finally {
      setOccupe(null);
    }
  }

  return (
    <Carte className="flex flex-col gap-4 p-5 sm:p-6" aria-label={tg("titre")}>
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Users className="h-5 w-5 text-orange-fonce" /> {tg("titre")}
        </h2>
        <p className="text-[15px] text-texte-doux">{tg("intro", { v: { max: groupes.tailleMax } })}</p>
      </div>

      {monGroupe && (
        <section className="flex flex-col gap-3 rounded-2xl border border-orange/40 bg-orange-pale p-4" aria-label={tg("monGroupe")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <span className="font-mono text-xs uppercase tracking-wider text-orange-fonce">{tg("monGroupe")}</span>
              <span className="text-[17px] font-extrabold">{monGroupe.nom}</span>
            </div>
            <Badge ton={monGroupe.rendu ? "succes" : "orange"}>
              {monGroupe.rendu ? tg("rendu") : tg("membres", { v: { n: monGroupe.membres.length, max: groupes.tailleMax } })}
            </Badge>
          </div>
          <ListeMembres membres={monGroupe.membres} />
          {monGroupe.rendu && <p className="flex items-center gap-2 text-sm text-texte-doux"><CheckCircle2 className="h-4 w-4 text-succes" /> {tg("fige")}</p>}
          <div className="flex flex-wrap gap-2">
            {monGroupe.conversationId && (
              <LienBouton href={`/messages/${monGroupe.conversationId}`} variante="encre" icone={<MessageCircle className="h-4 w-4" />} className="min-h-[48px] flex-1">
                {tg("discussion")}
              </LienBouton>
            )}
            {groupes.modifiable && !monGroupe.rendu && (
              <Bouton variante="contour" icone={<LogOut className="h-4 w-4" />} onClick={() => setConfirmerDepart(true)} chargement={occupe === "quitter"} className="min-h-[48px] flex-1">
                {tg("quitter")}
              </Bouton>
            )}
          </div>
        </section>
      )}

      {!monGroupe && <p className="rounded-xl bg-creme px-4 py-3 text-[15px] text-texte-doux">{groupes.modifiable ? tg("seul") : tg("seul.limite")}</p>}
      {!groupes.modifiable && <p className="text-sm text-texte-pale">{tg("ferme")}</p>}

      {autres.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {autres.map((g) => {
            const peutRejoindre = groupes.modifiable && !monGroupe && !g.complet && !g.rendu;
            return (
              <li key={g.id} className="flex flex-col gap-2 rounded-2xl border border-ligne-douce bg-white p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[15.5px] font-bold">{g.nom}</span>
                  <Badge ton={g.rendu ? "succes" : g.complet ? "gris" : "orange"}>
                    {g.rendu ? tg("rendu") : g.complet ? tg("complet") : tg("membres", { v: { n: g.membres.length, max: groupes.tailleMax } })}
                  </Badge>
                </div>
                <ListeMembres membres={g.membres} />
                {peutRejoindre && (
                  <Bouton
                    variante="doux"
                    onClick={() => void agir(`rejoindre-${g.id}`, `/api/devoirs/${devoirId}/groupes/${g.id}/rejoindre`, {}, tg("toast.rejoint"))}
                    chargement={occupe === `rejoindre-${g.id}`}
                    disabled={occupe !== null}
                    className="min-h-[48px]"
                  >
                    {tg("rejoindre")}
                  </Bouton>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        !monGroupe && groupes.modifiable && <p className="text-sm text-texte-pale">{tg("aucun")}</p>
      )}

      {!monGroupe && groupes.modifiable && (
        <Bouton variante="principal" icone={<Plus className="h-4 w-4" />} onClick={() => setCreation(true)} disabled={occupe !== null} className="min-h-[52px]">
          {tg("creer")}
        </Bouton>
      )}

      <Fenetre
        ouverte={creation}
        onFermer={() => setCreation(false)}
        titre={tg("creer")}
        pied={
          <Bouton
            pleineLargeur
            chargement={occupe === "creer"}
            onClick={async () => {
              if (await agir("creer", `/api/devoirs/${devoirId}/groupes`, { nom: nom.trim() || null }, tg("toast.cree"))) {
                setCreation(false);
                setNom("");
              }
            }}
            className="min-h-[52px]"
          >
            {tg("creer.valider")}
          </Bouton>
        }
      >
        <Champ libelle={tg("creer.nom")} value={nom} maxLength={60} placeholder={tg("creer.nom.defaut", { v: { prenom } })} onChange={(e) => setNom(e.target.value)} />
      </Fenetre>

      <Fenetre
        ouverte={confirmerDepart}
        onFermer={() => setConfirmerDepart(false)}
        titre={tg("quitter")}
        description={tg("quitter.confirmer")}
        pied={
          <Bouton
            variante="encre"
            pleineLargeur
            chargement={occupe === "quitter"}
            onClick={async () => {
              if (await agir("quitter", `/api/devoirs/${devoirId}/groupes/quitter`, {}, tg("toast.quitte"))) setConfirmerDepart(false);
            }}
            className="min-h-[52px]"
          >
            {tg("quitter")}
          </Bouton>
        }
      />
    </Carte>
  );
}

function ListeMembres({ membres }: { membres: GroupesDuDevoirEtudiant["groupes"][number]["membres"] }) {
  return (
    <ul className="flex flex-col gap-1">
      {membres.map((m) => (
        <li key={m.id} className={cn("flex items-baseline justify-between gap-3 text-[15px]", m.moi && "font-semibold")}>
          <span className="truncate">
            {m.prenom} {m.nom}
            {m.moi ? " (toi)" : ""}
          </span>
          {m.site && <span className="shrink-0 font-mono text-xs text-texte-gris">{m.site}</span>}
        </li>
      ))}
    </ul>
  );
}
