// /pilotage/relances : les suivis à faire, programmés depuis le dossier des
// étudiants (onglet Suivi) : appeler un parent, rappeler une tranche, passer
// voir quelqu'un. Les miennes ou toute l'équipe ; en retard, aujourd'hui, à
// venir, et ce qui a été fait ces 7 derniers jours. Cocher, c'est fini.
import { useId, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BellRing, ChevronDown, ListTodo, PhoneCall, PartyPopper } from "lucide-react";
import type { ListeRelances } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { LienBouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Onglets } from "@/components/ui/onglets";
import { toast, toastErreur } from "@/components/ui/toast";
import { patch } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { useMoiConnecte } from "@/lib/auth";
import { dateCourte } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { dansJours, jourRelatif } from "./composants/DossierOutils";
import { jourCourt, aujourdhui } from "./outils-crm";

type Qui = "moi" | "tous";
type Relance = ListeRelances["enRetard"][number];
type Section = keyof ListeRelances;

export default function PageRelances() {
  const moi = useMoiConnecte();
  const [, naviguer] = useLocation();
  const qui: Qui = new URLSearchParams(useSearch()).get("qui") === "tous" ? "tous" : "moi";
  const url = `/api/pilotage/relances?qui=${qui}`;
  const { data, isLoading, error, refetch } = useQuery<ListeRelances>({ queryKey: [url] });
  const [faitesOuvertes, setFaitesOuvertes] = useState(false);
  const [envoi, setEnvoi] = useState<number | null>(null);

  const choisir = (q: Qui) => naviguer(q === "moi" ? "/pilotage/relances" : "/pilotage/relances?qui=tous", { replace: true });

  /** Applique une modification tout de suite à l'écran, puis l'envoie ; relit la liste si le serveur refuse. */
  const modifier = async (r: Relance, corps: { faite?: boolean; echeance?: string }, message: string) => {
    const avant = queryClient.getQueryData<ListeRelances>([url]);
    if (avant) queryClient.setQueryData<ListeRelances>([url], deplacer(avant, r, corps, `${moi.prenom} ${moi.nom}`));
    setEnvoi(r.id);
    try {
      await patch(`/api/pilotage/taches/${r.id}`, corps);
      toast(message);
      // Le dossier de l'étudiant, la liste des étudiants et le tableau comptent les relances.
      void rafraichir("/api/pilotage/relances", "/api/pilotage/etudiants", "/api/pilotage/tableau");
    } catch (e) {
      if (avant) queryClient.setQueryData([url], avant);
      toastErreur(e);
      void rafraichir("/api/pilotage/relances");
    } finally {
      setEnvoi(null);
    }
  };

  const ouvertes = data ? data.enRetard.length + data.aujourdhui.length + data.aVenir.length : 0;
  const rien = data && !ouvertes && !data.faitesRecemment.length;

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette="Pilotage · Relances"
        titre="Relances"
        sousTitre="Les suivis à faire, programmés depuis le dossier des étudiants : appeler un parent, rappeler une tranche en retard, passer voir quelqu'un. Cochez une relance dès qu'elle est faite."
        actions={
          <LienBouton href="/pilotage/suivi" variante="contour" icone={<PhoneCall className="h-4 w-4" />} className="min-h-[48px]">
            À contacter
          </LienBouton>
        }
      />

      <Onglets<Qui>
        valeur={qui}
        onChange={choisir}
        className="self-start [&>button]:min-h-[44px]"
        options={[
          { valeur: "moi", libelle: "Les miennes", compteur: qui === "moi" ? ouvertes : undefined },
          { valeur: "tous", libelle: "Toute l'équipe", compteur: qui === "tous" ? ouvertes : undefined },
        ]}
      />

      {isLoading ? (
        <Chargement lignes={4} />
      ) : error || !data ? (
        <Erreur message={(error as Error)?.message ?? "Relances indisponibles."} reessayer={() => refetch()} />
      ) : rien ? (
        <EtatVide
          icone={<ListTodo className="h-6 w-6" />}
          titre={qui === "moi" ? "Aucune relance pour vous." : "Aucune relance dans l'équipe."}
          texte="Ajoutez-en depuis le dossier d'un étudiant, onglet Suivi : « rappeler le père pour la 2e tranche », avant telle date. Elles apparaîtront ici le jour venu."
          action={
            <LienBouton href="/pilotage/etudiants" className="min-h-[48px]">
              Voir les étudiants
            </LienBouton>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {!ouvertes && (
            <div className="flex items-center gap-3 rounded-2xl bg-succes-clair px-5 py-4 text-[15px] font-semibold text-succes">
              <PartyPopper className="h-5 w-5 shrink-0" /> Rien à faire pour l'instant : toutes les relances sont faites.
            </div>
          )}
          <Groupe titre="En retard" danger relances={data.enRetard} section="enRetard" envoi={envoi} tous={qui === "tous"} onModifier={modifier} />
          <Groupe titre="Aujourd'hui" relances={data.aujourdhui} section="aujourdhui" envoi={envoi} tous={qui === "tous"} onModifier={modifier} />
          <Groupe titre="À venir" relances={data.aVenir} section="aVenir" envoi={envoi} tous={qui === "tous"} onModifier={modifier} />

          {data.faitesRecemment.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setFaitesOuvertes((x) => !x)}
                aria-expanded={faitesOuvertes}
                className="mb-3 flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
              >
                <h2 className="text-xl font-extrabold">
                  Faites ces 7 derniers jours <span className="font-mono text-sm font-normal text-texte-gris">({data.faitesRecemment.length})</span>
                </h2>
                <ChevronDown className={cn("h-5 w-5 shrink-0 text-texte-gris transition-transform", faitesOuvertes && "rotate-180")} />
              </button>
              {faitesOuvertes && <Liste relances={data.faitesRecemment} section="faitesRecemment" envoi={envoi} tous={qui === "tous"} onModifier={modifier} />}
            </section>
          )}
        </div>
      )}

      <Carte className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-3 text-[15px] text-texte-pale">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden="true" />
          <span>
            La liste automatique <span className="font-bold text-encre">« À contacter »</span> repère toute seule les étudiants à appeler : absences aux lives, compte pas activé, devoirs non rendus.
          </span>
        </p>
        <Link href="/pilotage/suivi" className="inline-flex min-h-[44px] shrink-0 items-center font-bold text-orange-fonce no-underline hover:text-encre">
          Ouvrir « À contacter »
        </Link>
      </Carte>
    </Page>
  );
}

/** Nouvelle liste après une modification (optimiste) : la relance change de section. */
function deplacer(l: ListeRelances, r: Relance, corps: { faite?: boolean; echeance?: string }, moi: string): ListeRelances {
  const sans = (x: Relance[]) => x.filter((y) => y.id !== r.id);
  const base: ListeRelances = { enRetard: sans(l.enRetard), aujourdhui: sans(l.aujourdhui), aVenir: sans(l.aVenir), faitesRecemment: sans(l.faitesRecemment) };
  const faite = corps.faite ?? Boolean(r.faiteLe);
  const echeance = corps.echeance ?? r.echeance;
  const maj: Relance = { ...r, echeance, faiteLe: faite ? (r.faiteLe ?? new Date().toISOString()) : null, faitePar: faite ? (r.faitePar ?? moi) : null, enRetard: !faite && echeance < aujourdhui() };
  const parEcheance = (x: Relance[]) => [...x, maj].sort((a, b) => a.echeance.localeCompare(b.echeance) || a.id - b.id);
  if (faite) return { ...base, faitesRecemment: [maj, ...base.faitesRecemment] };
  const jour = aujourdhui();
  if (echeance < jour) return { ...base, enRetard: parEcheance(base.enRetard) };
  if (echeance === jour) return { ...base, aujourdhui: parEcheance(base.aujourdhui) };
  return { ...base, aVenir: parEcheance(base.aVenir) };
}

type PropsListe = {
  relances: Relance[];
  section: Section;
  envoi: number | null;
  tous: boolean;
  onModifier: (r: Relance, corps: { faite?: boolean; echeance?: string }, message: string) => void;
};

function Groupe({ titre, danger, ...props }: PropsListe & { titre: string; danger?: boolean }) {
  if (!props.relances.length) return null;
  return (
    <section>
      <h2 className={cn("mb-3 text-xl font-extrabold", danger && "text-danger")}>
        {titre} <span className={cn("font-mono text-sm font-normal", danger ? "text-danger" : "text-texte-gris")}>({props.relances.length})</span>
      </h2>
      <Liste {...props} />
    </section>
  );
}

function Liste({ relances, section, envoi, tous, onModifier }: PropsListe) {
  return (
    <Carte className="overflow-hidden p-0">
      <ul className="flex flex-col divide-y divide-ligne-douce">
        {relances.map((r) => (
          <LigneRelance key={r.id} r={r} section={section} occupe={envoi === r.id} tous={tous} onModifier={onModifier} />
        ))}
      </ul>
    </Carte>
  );
}

function LigneRelance({ r, section, occupe, tous, onModifier }: { r: Relance; section: Section; occupe: boolean; tous: boolean; onModifier: PropsListe["onModifier"] }) {
  const id = useId();
  const faite = Boolean(r.faiteLe);
  const retard = section === "enRetard";
  const demain = dansJours(1);
  return (
    <li className={cn("flex flex-col gap-2 py-2 pl-2 pr-4 sm:flex-row sm:items-center", retard && "bg-danger-clair/40", occupe && "opacity-70")}>
      <div className="flex min-w-0 flex-1 items-start gap-1">
        <label htmlFor={id} className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center">
          <input
            id={id}
            type="checkbox"
            className="h-5 w-5 accent-[#E4793A]"
            checked={faite}
            disabled={occupe}
            onChange={(e) => onModifier(r, { faite: e.target.checked }, e.target.checked ? "Relance faite" : "Relance rouverte")}
            aria-label={faite ? `Rouvrir : ${r.titre}` : `Marquer comme faite : ${r.titre}`}
          />
        </label>
        <div className="min-w-0 flex-1 py-2">
          <div className={cn("break-words font-semibold", faite && "text-texte-gris line-through")}>{r.titre}</div>
          <Link
            href={`/pilotage/etudiants/${r.etudiantId}?onglet=suivi`}
            className="inline-flex min-h-[32px] max-w-full items-center text-sm font-bold text-orange-fonce no-underline hover:text-encre"
          >
            <span className="truncate">
              {r.etudiant.prenom} {r.etudiant.nom}
              {r.etudiant.classe ? <span className="font-normal text-texte-gris"> · {r.etudiant.classe}</span> : null}
            </span>
          </Link>
          <div className="text-[13px] text-texte-gris">
            {faite ? (
              <>
                Faite le {dateCourte(r.faiteLe!)}
                {r.faitePar ? ` par ${r.faitePar}` : ""}
              </>
            ) : (
              <>
                <span className={cn(retard && "font-bold text-danger")}>
                  {jourCourt(r.echeance)} ({jourRelatif(r.echeance)})
                </span>
                {tous && r.responsable ? ` · ${r.responsable.nom}` : ""}
              </>
            )}
          </div>
        </div>
      </div>
      {!faite && (
        <div className="flex gap-2 pl-12 sm:pl-0">
          {r.echeance !== demain && (
            <button
              type="button"
              disabled={occupe}
              onClick={() => onModifier(r, { echeance: demain }, "Reportée à demain")}
              className="min-h-[44px] rounded-full border border-ligne bg-white px-4 text-sm font-bold text-texte-doux hover:border-orange hover:text-encre disabled:opacity-50"
            >
              Demain
            </button>
          )}
          <button
            type="button"
            disabled={occupe}
            onClick={() => onModifier(r, { echeance: dansJours(7) }, "Reportée dans 7 jours")}
            aria-label={`Reporter dans 7 jours : ${r.titre}`}
            className="min-h-[44px] rounded-full border border-ligne bg-white px-4 text-sm font-bold text-texte-doux hover:border-orange hover:text-encre disabled:opacity-50"
          >
            +7 jours
          </button>
        </div>
      )}
    </li>
  );
}
