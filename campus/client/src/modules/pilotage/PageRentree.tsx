// /pilotage/rentree : « Prêts pour lundi 28 septembre ? » La liste de
// contrôle de la rentrée, calculée en direct à chaque visite : les salles et
// leurs écrans, les classes, les formateurs (invités, activés), l'emploi du
// temps et ses séances, les étudiants et leurs premières connexions, les
// essais de la visio, les services et la fin de la démonstration. Chaque
// ligne dit son état, un chiffre, et mène à l'action qui la fait passer au vert.
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  TriangleAlert,
  CircleDashed,
  ChevronDown,
  RefreshCw,
  MonitorSmartphone,
  School,
  UserCheck,
  CalendarRange,
  Users,
  KeyRound,
  Video,
  Settings2,
  Eraser,
  ArrowRight,
} from "lucide-react";
import type { EtatRentree, LigneRentree, SousLigneRentree, EtatControle, ActionRentree, CleRentree } from "@shared/lancement";
import type { CompteLigne } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Chargement, Erreur, BarreProgression } from "@/components/ui/divers";
import { toastErreur } from "@/components/ui/toast";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { get } from "@/lib/api";
import { jourLong } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { FenetreEcran } from "./composants/FenetreEcran";
import { FenetreInvitation, type PersonneAInviter } from "./composants/FenetreInvitation";
import { FenetrePurge } from "./composants/FenetrePurge";
import { dans } from "./outils";

export const LIBELLES_ETAT: Record<EtatControle, string> = { fait: "Fait", attention: "Attention", a_faire: "À faire" };

const STYLE_ETAT: Record<EtatControle, { pastille: string; texte: string; icone: typeof CheckCircle2 }> = {
  fait: { pastille: "bg-succes-clair text-succes", texte: "text-succes", icone: CheckCircle2 },
  attention: { pastille: "bg-alerte-clair text-alerte", texte: "text-alerte", icone: TriangleAlert },
  a_faire: { pastille: "bg-danger-clair text-danger", texte: "text-danger", icone: CircleDashed },
};

const ICONES: Record<CleRentree, typeof School> = {
  campus: MonitorSmartphone,
  classes: School,
  formateurs: UserCheck,
  programme: CalendarRange,
  etudiants: Users,
  connexions: KeyRound,
  visio: Video,
  services: Settings2,
  demo: Eraser,
};

export function titreRentree(e: EtatRentree): string {
  return e.cible.passee ? "La session est lancée." : `Prêts pour ${e.cible.libelle} ?`;
}

export default function PageRentree() {
  const rentree = useQuery<EtatRentree>({ queryKey: ["/api/pilotage/rentree"], refetchInterval: 60_000 });
  const maintenant = useMaintenant(30_000);
  const [ecran, setEcran] = useState<{ id: number; nom: string } | null>(null);
  const [invite, setInvite] = useState<PersonneAInviter | null>(null);
  const [purge, setPurge] = useState(false);
  const e = rentree.data;

  const agir = async (a: ActionRentree, contexte?: string) => {
    if (a.type === "ecran") setEcran({ id: a.siteId, nom: contexte ?? "Campus" });
    else if (a.type === "purger") setPurge(true);
    else if (a.type === "inviter") {
      try {
        const c = await get<CompteLigne>(`/api/pilotage/comptes/${a.compteId}`);
        setInvite({ id: c.id, prenom: c.prenom, nom: c.nom, email: c.email, telephone: c.telephone });
      } catch (err) {
        toastErreur(err);
      }
    }
  };

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette={e ? `Pilotage · Rentrée${e.perimetre.tout ? "" : ` · Campus ${e.perimetre.site ?? ""}`}` : "Pilotage · Rentrée"}
        titre={e ? titreRentree(e) : "La rentrée"}
        sousTitre="Chaque ligne se recalcule à chaque visite. Suivez les boutons : quand tout est vert, le campus est prêt."
        actions={
          <Bouton variante="contour" icone={<RefreshCw className={cn("h-4 w-4", rentree.isFetching && "animate-spin")} />} onClick={() => rentree.refetch()}>
            Actualiser
          </Bouton>
        }
      />

      {rentree.isLoading && <Chargement lignes={4} />}
      {rentree.error && <Erreur message={(rentree.error as Error).message} reessayer={() => rentree.refetch()} />}

      {e && (
        <>
          <Score e={e} maintenant={maintenant} />
          <ol className="flex flex-col gap-3" aria-label="Liste de contrôle de la rentrée">
            {e.lignes.map((l) => (
              <Ligne key={l.cle} l={l} agir={agir} />
            ))}
          </ol>
          <p className="text-center font-mono text-xs text-texte-gris">Calculé à {new Date(e.genereLe).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}, heure d'Abidjan</p>
        </>
      )}

      <FenetreEcran site={ecran} onFermer={() => setEcran(null)} />
      <FenetreInvitation personne={invite} onFermer={() => setInvite(null)} />
      <FenetrePurge ouverte={purge} onFermer={() => setPurge(false)} />
    </Page>
  );
}

function Score({ e, maintenant }: { e: EtatRentree; maintenant: number }) {
  const nb = (x: EtatControle) => e.lignes.filter((l) => l.etat === x).length;
  const tout = e.prets === e.total;
  return (
    <section
      aria-label="Où en est la rentrée"
      className={cn("grid gap-5 rounded-[24px] p-5 sm:p-7 md:grid-cols-[auto_1fr] md:items-center", tout ? "bg-succes-clair" : "bg-creme")}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[64px] font-black leading-none tracking-tres-serre tabular-nums">{e.prets}</span>
        <span className="text-2xl font-extrabold text-texte-pale">sur {e.total}</span>
        <span className="ml-1 text-lg font-bold">{e.prets > 1 ? "prêts" : "prêt"}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <BarreProgression valeur={(e.prets / Math.max(1, e.total)) * 100} ton={tout ? "succes" : "orange"} className="h-2.5" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px]">
          {(["fait", "attention", "a_faire"] as EtatControle[]).map((x) => {
            const I = STYLE_ETAT[x].icone;
            return (
              <span key={x} className={cn("flex items-center gap-1.5 font-semibold", STYLE_ETAT[x].texte)}>
                <I className="h-4 w-4" /> {nb(x)} {LIBELLES_ETAT[x].toLowerCase()}
              </span>
            );
          })}
          <span className="font-mono text-sm text-texte-pale sm:ml-auto">
            {e.cible.session ?? "Emploi du temps à saisir"} · {e.cible.passee ? `commencée ${jourLong(e.cible.le)}` : `premier cours ${dans(e.cible.le, maintenant)}`}
          </span>
        </div>
      </div>
    </section>
  );
}

function PastilleEtat({ etat, petite }: { etat: EtatControle; petite?: boolean }) {
  const s = STYLE_ETAT[etat];
  const I = s.icone;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-mono", s.pastille, petite ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs")}>
      <I className={petite ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {LIBELLES_ETAT[etat]}
    </span>
  );
}

function BoutonAction({ action, agir, contexte, petit }: { action: ActionRentree; agir: (a: ActionRentree, contexte?: string) => void; contexte?: string; petit?: boolean }) {
  const taille = petit ? "sm" : "md";
  const classe = petit ? "min-h-[44px]" : "min-h-[48px]";
  if (action.type === "lien") {
    return (
      <LienBouton href={action.href} variante={petit ? "contour" : "principal"} taille={taille} className={classe} icone={petit ? undefined : <ArrowRight className="h-4 w-4" />}>
        {action.libelle}
      </LienBouton>
    );
  }
  return (
    <Bouton variante={action.type === "purger" ? "danger" : petit ? "encre" : "principal"} taille={taille} className={classe} onClick={() => agir(action, contexte)}>
      {action.libelle}
    </Bouton>
  );
}

function Ligne({ l, agir }: { l: LigneRentree; agir: (a: ActionRentree, contexte?: string) => void }) {
  const [ouvert, setOuvert] = useState(l.etat !== "fait");
  const I = ICONES[l.cle];
  const idDetail = `rentree-${l.cle}`;
  return (
    <li className={cn("overflow-hidden rounded-2xl border bg-white", l.etat === "a_faire" ? "border-danger/30" : l.etat === "attention" ? "border-alerte/30" : "border-ligne")}>
      <div className="flex gap-3 p-4 sm:gap-4 sm:p-5">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", STYLE_ETAT[l.etat].pastille)}>
          <I className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-lg font-extrabold leading-tight">{l.titre}</h2>
            <PastilleEtat etat={l.etat} />
            <span className="ml-auto whitespace-nowrap font-mono text-sm font-semibold text-encre">{l.chiffre}</span>
          </div>
          <p className="mt-1 text-[15px] leading-relaxed text-texte-pale">{l.resume}</p>
          {(l.action || l.sousLignes.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {l.action && <BoutonAction action={l.action} agir={agir} />}
              {l.sousLignes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOuvert((o) => !o)}
                  aria-expanded={ouvert}
                  aria-controls={idDetail}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-texte-doux hover:bg-creme hover:text-encre"
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", ouvert && "rotate-180")} />
                  {ouvert ? "Masquer le détail" : `Voir le détail (${l.sousLignes.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {ouvert && l.sousLignes.length > 0 && (
        <ul id={idDetail} className="divide-y divide-ligne-douce border-t border-ligne-douce bg-creme/40">
          {l.sousLignes.map((s, i) => (
            <SousLigne key={`${s.libelle}-${i}`} s={s} agir={agir} />
          ))}
        </ul>
      )}
    </li>
  );
}

function SousLigne({ s, agir }: { s: SousLigneRentree; agir: (a: ActionRentree, contexte?: string) => void }): ReactNode {
  const I = STYLE_ETAT[s.etat].icone;
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:pl-[76px]">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <I className={cn("mt-0.5 h-4 w-4 shrink-0", STYLE_ETAT[s.etat].texte)} aria-label={LIBELLES_ETAT[s.etat]} />
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-snug text-encre">{s.libelle}</p>
          <p className="text-sm leading-snug text-texte-pale">{s.detail}</p>
        </div>
      </div>
      {s.action && (
        <div className="pl-[26px] sm:pl-0">
          <BoutonAction action={s.action} agir={agir} contexte={s.libelle} petit />
        </div>
      )}
    </li>
  );
}
