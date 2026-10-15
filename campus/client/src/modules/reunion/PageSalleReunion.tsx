// /pilotage/reunion — la salle de réunion de l'administration (demande de José du 13 octobre 2026) : UN lien qui ne
// change pas, à envoyer aux participants (copier, WhatsApp) ; l'interrupteur « Réunion ouverte » ferme la réunion
// quand il le faut (personne n'entre plus, les présents sortent) et la rouvre (le même lien remarche) ; « Changer le
// lien » donne un nouveau lien si l'ancien a trop circulé. La direction ajoute d'autres salles (« Conseil
// pédagogique »). « Entrer dans la réunion » ouvre la page du lien : on y entre sous son nom. Serveur :
// server/routes/reunions.ts ; droits : la page se voit avec le droit des écrans et de la visio (outils_campus :
// direction, vie scolaire) ; l'interrupteur, « Changer le lien », l'ajout et le retrait sont à la direction seule.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, DoorOpen, Handshake, MessageCircle, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { post, suppr } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { relatif } from "@/lib/dates";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Champ, Interrupteur } from "@/components/ui/champs";
import { Badge, Chargement, Erreur } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { SousNav } from "@/modules/pilotage/composants/SousNav";
import { copier } from "@/modules/pilotage/outils";
import { t as textes } from "@shared/textes/reunion";
import type { ReunionDto, ReunionsDto } from "@shared/reunion";

const CLE = "/api/pilotage/reunions";
/** Le chemin du lien sur le campus ouvert (le lien porte l'adresse définitive du campus). */
const cheminDe = (lien: string) => {
  try {
    return new URL(lien).pathname;
  } catch {
    return lien;
  }
};

export default function PageSalleReunion() {
  const tx = useTextes(textes);
  // Qui est dans la réunion : relu toutes les 10 s.
  const { data, error, refetch } = useQuery<ReunionsDto>({ queryKey: [CLE], refetchInterval: 10_000 });
  return (
    <Page className="max-w-4xl">
      <SousNav />
      <EnTetePage etiquette={tx("page.etiquette")} titre={tx("page.titre")} sousTitre={tx("page.sousTitre")} />
      {error && !data ? (
        <Erreur message={(error as Error).message} reessayer={() => void refetch()} />
      ) : !data ? (
        <Chargement lignes={3} />
      ) : (
        <>
          {!data.daily && <p className="rounded-2xl bg-alerte-clair px-4 py-3 text-[15px] font-semibold text-alerte">{tx("page.sansDaily")}</p>}
          {data.reunions.map((r) => (
            <CarteReunion key={r.id} r={r} peutGerer={data.peutGerer} />
          ))}
          {data.peutGerer ? <AjouterSalle plein={data.reunions.length >= data.max} max={data.max} /> : <p className="text-[13px] text-texte-gris">{tx("gerer.direction")}</p>}
        </>
      )}
    </Page>
  );
}

/** Appelle une route qui renvoie toutes les salles, et met la page à jour. */
async function agir(promesse: Promise<ReunionsDto>, message?: string): Promise<boolean> {
  try {
    queryClient.setQueryData<ReunionsDto>([CLE], await promesse);
    if (message) toast(message);
    return true;
  } catch (e) {
    toastErreur(e);
    void queryClient.invalidateQueries({ queryKey: [CLE] });
    return false;
  }
}

type Confirmation = "fermer" | "changer" | "supprimer" | null;

function CarteReunion({ r, peutGerer }: { r: ReunionDto; peutGerer: boolean }) {
  const tx = useTextes(textes);
  const [confirmer, setConfirmer] = useState<Confirmation>(null);
  const [envoi, setEnvoi] = useState(false);
  const base = `${CLE}/${encodeURIComponent(r.id)}`;
  const n = r.presents.length;
  const presentsTexte = n === 1 ? tx("presents.un") : tx("presents.n", { v: { n } });

  const lancer = async (promesse: () => Promise<ReunionsDto>, message: string) => {
    setEnvoi(true);
    const ok = await agir(promesse(), message);
    setEnvoi(false);
    if (ok) setConfirmer(null);
  };
  const ouvrir = () => void lancer(() => post<ReunionsDto>(`${base}/etat`, { ouverte: true }), tx("ouvrir.fait"));
  const fermer = () => void lancer(() => post<ReunionsDto>(`${base}/etat`, { ouverte: false }), tx("fermer.fait"));
  const basculer = (v: boolean) => {
    if (v) return ouvrir();
    // Quelqu'un est dedans : on confirme (il va sortir). Personne : on ferme tout de suite.
    if (n > 0) setConfirmer("fermer");
    else fermer();
  };

  // Le dernier geste tel qu'il a eu lieu : « Lien changé par … », « Fermée par … », « Ajoutée par … ».
  const action = r.majAction ?? (r.ouverte ? "ouverte" : "fermee");
  const maj = r.majLe ? tx(r.majPar ? "maj" : "maj.sansNom", { v: { action: tx(`maj.${action}`), nom: r.majPar ?? "", quand: relatif(r.majLe) } }) : null;

  return (
    <Carte className={cn("flex flex-col gap-5", !r.ouverte && "bg-creme")} data-reunion={r.id}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", r.ouverte ? "bg-orange text-encre" : "bg-ligne text-texte-doux")}>
            <Handshake className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-[20px] font-black leading-tight">{r.nom}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge ton={r.ouverte ? "succes" : "gris"}>{tx(r.ouverte ? "etat.ouverte" : "etat.fermee")}</Badge>
              {maj && <span className="text-[13px] text-texte-gris">{maj}</span>}
            </div>
          </div>
        </div>
        {/* Toute l'étiquette (48 px de haut au moins) actionne l'interrupteur : une zone facile à toucher. Son texte se
            lit à toutes les largeurs : sur téléphone, sous le titre, sur toute la largeur. La direction seule. */}
        {peutGerer && (
          <label
            className={cn(
              "flex min-h-[48px] shrink-0 cursor-pointer items-center justify-between gap-3 rounded-xl border border-ligne px-3 sm:-my-2 sm:justify-start sm:border-0 sm:px-0 sm:pl-2",
              envoi && "pointer-events-none opacity-60",
            )}
            data-zone-interrupteur
          >
            <span className="text-[15px] font-bold sm:text-[14px]">{tx("interrupteur")}</span>
            <Interrupteur actif={r.ouverte} onChange={basculer} libelle={tx("interrupteur")} />
          </label>
        )}
      </div>

      <p className="text-[15px] leading-snug text-texte-doux">{tx(r.ouverte ? "etat.ouverte.texte" : peutGerer ? "etat.fermee.texte" : "etat.fermee.texte.equipe")}</p>

      {confirmer === "fermer" && (
        <Confirmer
          titre={tx("fermer.titre")}
          texte={tx("fermer.texte", { v: { presents: presentsTexte } })}
          oui={tx("fermer.oui")}
          envoi={envoi}
          onOui={fermer}
          onNon={() => setConfirmer(null)}
        />
      )}

      <div className="flex flex-col gap-3">
        <p className="break-all rounded-xl border border-ligne bg-white px-4 py-3 font-mono text-[14px] leading-snug text-encre" data-lien>
          {r.lien}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Bouton
            variante="contour"
            className="min-h-[48px]"
            icone={<Copy className="h-4 w-4" />}
            onClick={async () => toast((await copier(r.lien)) ? tx("copie") : tx("copie.impossible"), "info")}
          >
            {tx("copier")}
          </Bouton>
          <a
            href={r.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-orange px-5 py-3 text-[15px] font-bold text-encre no-underline hover:bg-encre hover:text-white"
          >
            <MessageCircle className="h-4 w-4" /> {tx("whatsapp")}
          </a>
          {r.ouverte ? (
            <a
              href={cheminDe(r.lien)}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-encre px-5 py-3 text-[15px] font-bold text-white no-underline hover:bg-orange hover:text-encre"
              data-entrer
            >
              <DoorOpen className="h-4 w-4" /> {tx("entrer")}
            </a>
          ) : (
            <span className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-ligne px-5 py-3 text-[15px] font-bold text-texte-doux" aria-disabled="true">
              <DoorOpen className="h-4 w-4" /> {tx(peutGerer ? "entrer.ferme" : "entrer.ferme.equipe")}
            </span>
          )}
        </div>
      </div>

      {r.ouverte && (
        <div className="flex items-start gap-3 rounded-xl bg-creme px-4 py-3" aria-live="polite">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
          <div className="min-w-0 text-[15px]">
            <p className="font-bold">
              {tx("presents.titre")} {n > 0 && <span className="font-mono text-[13px] font-semibold text-texte-doux">· {presentsTexte}</span>}
            </p>
            {!r.presenceLue ? (
              <p className="text-texte-doux">{tx("presents.illisible")}</p>
            ) : n === 0 ? (
              <p className="text-texte-doux">{tx("presents.personne")}</p>
            ) : (
              <p className="break-words text-texte-doux" data-presents>
                {r.presents.map((p) => p.nom).join(" · ")}
              </p>
            )}
          </div>
        </div>
      )}

      {peutGerer && (
        <div className="flex flex-wrap gap-2 border-t border-ligne-douce pt-4">
          <Bouton variante="fantome" taille="sm" className="min-h-[44px]" icone={<RefreshCw className="h-4 w-4" />} onClick={() => setConfirmer("changer")} disabled={envoi}>
            {tx("changer")}
          </Bouton>
          {!r.principale && (
            <Bouton variante="fantome" taille="sm" className="min-h-[44px]" icone={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmer("supprimer")} disabled={envoi}>
              {tx("supprimer")}
            </Bouton>
          )}
        </div>
      )}

      {confirmer === "changer" && (
        <Confirmer
          titre={tx("changer.titre")}
          texte={tx("changer.texte")}
          oui={tx("changer.oui")}
          envoi={envoi}
          onOui={() => void lancer(() => post<ReunionsDto>(`${base}/nouveau-lien`), tx("changer.fait"))}
          onNon={() => setConfirmer(null)}
        />
      )}
      {confirmer === "supprimer" && (
        <Confirmer
          titre={tx("supprimer.titre", { v: { nom: r.nom } })}
          texte={tx("supprimer.texte")}
          oui={tx("supprimer.oui")}
          envoi={envoi}
          onOui={() => void lancer(() => suppr<ReunionsDto>(base), tx("supprimer.fait"))}
          onNon={() => setConfirmer(null)}
        />
      )}
    </Carte>
  );
}

function Confirmer({ titre, texte, oui, envoi, onOui, onNon }: { titre: string; texte: string; oui: string; envoi: boolean; onOui: () => void; onNon: () => void }) {
  const tx = useTextes(textes);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-danger bg-danger-clair p-4" role="alertdialog" aria-label={titre}>
      <p className="text-[16px] font-extrabold">{titre}</p>
      <p className="text-[15px] leading-snug text-texte-doux">{texte}</p>
      <div className="flex flex-wrap gap-2">
        <Bouton variante="danger" chargement={envoi} onClick={onOui}>
          {oui}
        </Bouton>
        <Bouton variante="contour" onClick={onNon} disabled={envoi}>
          {tx("annuler")}
        </Bouton>
      </div>
    </div>
  );
}

function AjouterSalle({ plein, max }: { plein: boolean; max: number }) {
  const tx = useTextes(textes);
  const [nom, setNom] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const ajouter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nom.trim().length < 2) return;
    setEnvoi(true);
    if (await agir(post<ReunionsDto>(CLE, { nom: nom.trim() }), tx("ajouter.fait"))) setNom("");
    setEnvoi(false);
  };
  return (
    <Carte className="flex flex-col gap-3 border-dashed">
      <div>
        <p className="text-[16px] font-extrabold">{tx("ajouter.titre")}</p>
        <p className="text-[14px] text-texte-pale">{plein ? tx("ajouter.max", { v: { max } }) : tx("ajouter.texte")}</p>
      </div>
      {!plein && (
        <form onSubmit={ajouter} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Champ
            libelle={tx("ajouter.nom")}
            placeholder={tx("ajouter.exemple")}
            value={nom}
            maxLength={60}
            onChange={(e) => setNom(e.target.value)}
            className="sm:flex-1"
          />
          <Bouton type="submit" variante="encre" className="min-h-[48px]" icone={<Plus className="h-4 w-4" />} chargement={envoi} disabled={nom.trim().length < 2}>
            {tx("ajouter.bouton")}
          </Bouton>
        </form>
      )}
    </Carte>
  );
}
