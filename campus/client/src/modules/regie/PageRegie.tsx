// /regie : « Mon espace » du chargé de cours (José, 14 octobre 2026), et la « Régie des cours » de la direction.
// Les cours du jour de tous les campus de son périmètre, une carte par cours : l'heure, le cours, le formateur
// (connecté ou non), les campus et leurs salles (connectées ou non), ce qui est prêt (PowerPoint, vidéos). Un seul
// gros bouton orange par carte : « Ouvrir la classe » (démarrer, puis le Studio) ou « Entrer dans le Studio » ;
// puis « Préparer » et « Lien intervenant ». Les jours suivants de la semaine dessous, pour préparer à l'avance.
// Téléphone d'abord (360 px) ; se met à jour toute seule (30 s, et à chaque ouverture ou fin d'un direct).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CalendarDays, Check, CircleSlash, MonitorPlay, Play, Presentation, Wrench } from "lucide-react";
import type { CoursRegieDto, EspaceRegieDto, EtatRegie } from "@shared/regie";
import { t as textesRegie } from "@shared/textes/regie";
import type { Traducteur } from "@shared/textes";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Badge, BadgeDirect, Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { post } from "@/lib/api";
import { useTousEvenements } from "@/lib/flux";
import { heure, jourLong } from "@/lib/dates";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { BoutonLienIntervenant } from "./LienIntervenant";

const CLE = "/api/regie";

export default function PageRegie() {
  const tx = useTextes(textesRegie);
  const { data, isLoading, error, refetch } = useQuery<EspaceRegieDto>({ queryKey: [CLE], refetchInterval: 30_000, staleTime: 0 });
  // Un direct qui s'ouvre ou se termine (ici ou ailleurs) : la page se relit aussitôt.
  useTousEvenements((e) => {
    if (e.type === "live") void rafraichir(CLE);
  });

  const sousTitre = data?.perimetre.campus ? tx("espace.sousTitre.campus", { v: { campus: data.perimetre.campus } }) : tx("espace.sousTitre");
  const derniere = data?.suivants.at(-1)?.libelle;

  return (
    <Page className="max-w-[960px]">
      <EnTetePage etiquette={tx("espace.etiquette")} titre={tx("espace.titre")} sousTitre={sousTitre} />
      {isLoading ? (
        <Chargement lignes={3} />
      ) : error || !data ? (
        <Erreur message={(error as Error | null)?.message ?? "Impossible de lire vos cours."} reessayer={() => refetch()} />
      ) : (
        <>
          <section className="flex flex-col gap-3" aria-labelledby="regie-aujourdhui">
            <h2 id="regie-aujourdhui" className="text-xl font-extrabold first-letter:uppercase">
              {tx("espace.aujourdhui", { v: { date: data.libelle } })}
            </h2>
            {data.aujourdhui.length === 0 ? (
              <EtatVide icone={<CalendarDays className="h-6 w-6" />} titre={tx("espace.aujourdhui.videTitre")} texte={tx("espace.aujourdhui.vide")} />
            ) : (
              <ul className="flex flex-col gap-4">
                {data.aujourdhui.map((c) => (
                  <li key={c.seanceId}>
                    <CarteCours c={c} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="regie-semaine">
            <h2 id="regie-semaine" className="text-xl font-extrabold">
              {tx("espace.semaine")}
            </h2>
            {data.suivants.length === 0 ? (
              <p className="text-[15px] text-texte-pale">{tx("espace.semaine.vide", { v: { date: derniere ?? jourDans(6) } })}</p>
            ) : (
              data.suivants.map((j) => (
                <div key={j.date} className="flex flex-col gap-2">
                  <h3 className="text-base font-extrabold first-letter:uppercase">{j.libelle}</h3>
                  <ul className="flex flex-col divide-y divide-ligne-douce overflow-hidden rounded-2xl border border-ligne bg-white">
                    {j.cours.map((c) => (
                      <li key={c.seanceId}>
                        <LigneCours c={c} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
          <p className="text-sm text-texte-gris">{tx("espace.actualise")}</p>
        </>
      )}
    </Page>
  );
}

/** « mercredi 21 octobre » dans n jours (texte de l'état vide de la semaine). */
function jourDans(n: number): string {
  return jourLong(new Date(Date.now() + n * 86_400_000));
}

function PastilleEtat({ etat, debut }: { etat: EtatRegie; debut: string }) {
  const tx = useTextes(textesRegie);
  switch (etat) {
    case "en_direct":
      return <BadgeDirect libelle={tx("etat.enDirect")} />;
    case "ouverte_avance":
      return <Badge ton="direct">{tx("etat.ouverteAvance", { v: { heure: heure(debut) } })}</Badge>;
    case "terminee":
      return <Badge ton="succes">{tx("etat.terminee")}</Badge>;
    case "annulee":
      return <Badge ton="danger">{tx("etat.annulee")}</Badge>;
    case "non_ouverte":
      return <Badge ton="alerte">{tx("etat.nonOuverte")}</Badge>;
    default:
      return <Badge ton="gris">{tx("etat.aVenir")}</Badge>;
  }
}

/** « 24 diapos · 1 vidéo ou document » (sans la partie vide). */
function preparation(tx: Traducteur<Parameters<typeof textesRegie>[0]>, c: Pick<CoursRegieDto, "diapos" | "ressources">): string {
  const parties: string[] = [];
  if (c.diapos) parties.push(c.diapos === 1 ? tx("carte.diapos.un") : tx("carte.diapos", { v: { n: c.diapos } }));
  if (c.ressources) parties.push(c.ressources === 1 ? tx("carte.ressources.un") : tx("carte.ressources", { v: { n: c.ressources } }));
  return parties.join(" · ");
}

const classeOuverte = (e: EtatRegie) => e === "en_direct" || e === "ouverte_avance";
const finie = (e: EtatRegie) => e === "terminee" || e === "annulee";

/** Le gros bouton de la carte : entrer dans la classe ouverte, l'ouvrir, ou dire à quelle heure elle s'ouvrira. */
function BoutonPrincipal({ c }: { c: CoursRegieDto }) {
  const tx = useTextes(textesRegie);
  const [, naviguer] = useLocation();
  const [envoi, setEnvoi] = useState(false);
  const classe = "min-h-[56px] w-full text-[17px] sm:w-auto sm:min-w-[260px]";
  if (classeOuverte(c.etat)) {
    return (
      <LienBouton href={`/live/${c.seanceId}`} taille="lg" icone={<MonitorPlay className="h-5 w-5" />} className={classe}>
        {tx("bouton.entrer")}
      </LienBouton>
    );
  }
  if (c.peutOuvrir) {
    return (
      <Bouton
        taille="lg"
        className={classe}
        chargement={envoi}
        icone={<Play className="h-5 w-5" />}
        onClick={async () => {
          setEnvoi(true);
          try {
            await post(`/api/seances/${c.seanceId}/demarrer`, {});
            toast(tx("toast.ouverte"));
            void rafraichir(CLE);
            naviguer(`/live/${c.seanceId}`);
          } catch (e) {
            toastErreur(e);
            setEnvoi(false);
          }
        }}
      >
        {envoi ? tx("bouton.ouverture") : tx("bouton.ouvrir")}
      </Bouton>
    );
  }
  if (c.ouvreA) {
    return (
      <Bouton taille="lg" variante="doux" disabled className={cn(classe, "disabled:opacity-100 text-texte-pale")}>
        {tx("bouton.ouvreA", { v: { heure: heure(c.ouvreA) } })}
      </Bouton>
    );
  }
  return null;
}

/** Une carte du jour. */
function CarteCours({ c }: { c: CoursRegieDto }) {
  const tx = useTextes(textesRegie);
  const ouverte = classeOuverte(c.etat);
  const prepare = c.diapos > 0 || c.ressources > 0;
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:p-5",
        ouverte ? "border-orange shadow-[0_0_0_2px_rgba(228,121,58,0.25)]" : "border-ligne",
        finie(c.etat) && "opacity-80",
      )}
      data-seance={c.seanceId}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[26px] font-black leading-none tracking-serre">{c.heures}</span>
        <PastilleEtat etat={c.etat} debut={c.debut} />
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex min-w-0 items-center gap-2 text-[17px] font-extrabold leading-snug">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.cours.couleur }} aria-hidden />
          <span className="min-w-0 break-words">
            <span className="font-mono text-[13px] font-semibold text-texte-pale">{c.cours.code}</span> · {c.cours.titre || c.titre}
          </span>
        </p>
        {c.titre && c.titre !== c.cours.titre && <p className="text-[15px] text-texte-doux">{c.titre}</p>}
        <p className="text-[15px]">
          {c.formateur ? (
            <>
              <span className="font-semibold">{c.formateur.nom}</span>
              {ouverte && (
                <span className={cn("ml-2 text-sm font-semibold", c.formateurConnecte ? "text-succes" : "text-alerte")}>
                  · {c.formateurConnecte ? tx("carte.formateurConnecte") : tx("carte.formateurAbsent")}
                </span>
              )}
            </>
          ) : (
            <span className="text-texte-pale">{tx("carte.sansFormateur")}</span>
          )}
        </p>
      </div>

      {c.campus.length > 0 ? <CampusEtSalles c={c} ouverte={ouverte} /> : <p className="text-sm text-texte-pale">{tx("carte.sansSalle")}</p>}

      {c.etat === "annulee" ? (
        c.motifAnnulation && <p className="text-sm text-texte-pale">{tx("carte.motif", { v: { motif: c.motifAnnulation } })}</p>
      ) : (
        <p className={cn("flex items-center gap-2 text-[15px]", prepare ? "text-texte-doux" : "font-semibold text-alerte")}>
          <Presentation className="h-4 w-4 shrink-0" />
          {prepare ? preparation(tx, c) : tx("carte.rienPrepare")}
        </p>
      )}

      {!finie(c.etat) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <BoutonPrincipal c={c} />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <LienBouton href={`/enseigner/seances/${c.seanceId}`} variante="doux" icone={<Wrench className="h-4 w-4" />} className="min-h-[48px]">
              {tx("bouton.preparer")}
            </LienBouton>
            <BoutonLienIntervenant seanceId={c.seanceId} className="min-h-[48px]" />
          </div>
        </div>
      )}
    </article>
  );
}

/**
 * Les campus du cours et leurs salles. Une même salle partout (« Salle de conférence ») : les campus en une ligne,
 * la salle une seule fois. Classe ouverte : chaque campus dit si l'écran de sa salle est là (✓) ou pas encore.
 */
function CampusEtSalles({ c, ouverte }: { c: CoursRegieDto; ouverte: boolean }) {
  const tx = useTextes(textesRegie);
  const memeSalle = c.campus.every((x) => x.salle === c.campus[0].salle);
  return (
    <div className="flex flex-col gap-1.5">
      <ul className="flex flex-wrap gap-1.5" aria-label="Campus et salles">
        {c.campus.map((x) => (
          <li
            key={x.siteId}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[13px]",
              ouverte ? (x.connectee ? "bg-succes-clair text-succes" : "bg-creme text-texte-pale") : "bg-creme text-texte-doux",
            )}
          >
            <span className="font-semibold">{x.nomCourt}</span>
            {!memeSalle && <span className="truncate">· {x.salle}</span>}
            {ouverte && (x.connectee ? <Check className="h-3.5 w-3.5 shrink-0" aria-label="écran connecté" /> : <CircleSlash className="h-3.5 w-3.5 shrink-0" aria-label="écran pas encore connecté" />)}
          </li>
        ))}
      </ul>
      {(memeSalle || ouverte) && (
        <p className="text-sm text-texte-doux">
          {memeSalle && c.campus[0].salle}
          {memeSalle && ouverte && " · "}
          {ouverte && <span className="font-semibold">{tx(c.sallesConnectees <= 1 ? "carte.salles.un" : "carte.salles", { v: { n: c.sallesConnectees, total: c.sallesAttendues } })}</span>}
        </p>
      )}
    </div>
  );
}

/** Une ligne des jours suivants : heure, cours, formateur, ce qui est prêt ; « Préparer » et « Lien intervenant ». */
function LigneCours({ c }: { c: CoursRegieDto }) {
  const tx = useTextes(textesRegie);
  const prepare = c.diapos > 0 || c.ressources > 0;
  return (
    <div className={cn("flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between", finie(c.etat) && "opacity-70")}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[16px]">
          <span className="font-black">{c.heures}</span>
          <span className="min-w-0 break-words font-semibold">{c.cours.titre || c.titre}</span>
          {c.etat === "annulee" && <Badge ton="danger">{tx("etat.annulee")}</Badge>}
        </p>
        <p className="text-sm text-texte-pale">
          {c.formateur?.nom ?? tx("carte.sansFormateur")}
          {c.campus.length > 0 && ` · ${c.campus.map((x) => x.nomCourt).join(", ")}`}
        </p>
        {c.etat !== "annulee" && (
          <p className={cn("text-sm", prepare ? "text-texte-doux" : "font-semibold text-alerte")}>
            {prepare ? preparation(tx, c) : tx("carte.rienPrepare")}
          </p>
        )}
      </div>
      {!finie(c.etat) && (
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
          <LienBouton href={`/enseigner/seances/${c.seanceId}`} variante="doux" taille="sm" icone={<Wrench className="h-4 w-4" />} className="min-h-[48px]">
            {tx("bouton.preparer")}
          </LienBouton>
          <BoutonLienIntervenant seanceId={c.seanceId} taille="sm" className="min-h-[48px]" />
        </div>
      )}
    </div>
  );
}
