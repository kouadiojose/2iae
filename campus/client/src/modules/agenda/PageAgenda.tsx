// /agenda — « Ma semaine en liste ». Une grille de calendrier est illisible
// sur un écran de 360 px : on lit la semaine de haut en bas, jour par jour,
// aujourd'hui en évidence. Abonnement .ics (les alarmes de l'agenda du
// téléphone sonnent même sans réseau) et partage de la semaine sur WhatsApp.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  MapPin,
  Plus,
  Radio,
  RefreshCw,
  Share2,
  Smartphone,
} from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { useTousEvenements } from "@/lib/flux";
import { get, post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { maintenantServeur } from "@/lib/horloge";
import { dateCourte, heure, heureDouble, jourLong } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Badge, BadgeDirect, Erreur, Squelette } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { toast, toastErreur } from "@/components/ui/toast";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import type { Agenda, ElementAgenda, TypeElementAgenda } from "@shared/schema";
import { FenetreEvenement } from "./FenetreEvenement";
import { adresseCampus, lienWhatsApp, majuscule, tutoie } from "../accueil/outils";

const JOUR_MS = 86_400_000;
type Filtre = "tout" | TypeElementAgenda;

/** Lundi 00 h (heure d'Abidjan = UTC) de la semaine qui contient cet instant. */
function lundiDe(t: number): Date {
  const d = new Date(t);
  const jour = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return new Date(jour - ((d.getUTCDay() + 6) % 7) * JOUR_MS);
}

/** Numéro de semaine ISO 8601 (« Semaine 40 »). */
function numeroSemaine(lundi: Date): number {
  const jeudi = new Date(lundi.getTime() + 3 * JOUR_MS);
  const premierJanvier = Date.UTC(jeudi.getUTCFullYear(), 0, 1);
  return Math.floor((jeudi.getTime() - premierJanvier) / JOUR_MS / 7) + 1;
}

const isoJour = (d: Date) => d.toISOString().slice(0, 10);

/** Heure affichée d'un élément : l'heure limite d'un devoir, le créneau d'un live. */
function horaire(e: ElementAgenda, formateur: boolean) {
  if (formateur) return heureDouble(e.debut);
  if (e.type === "devoir") return `avant ${heure(e.debut)}`;
  return e.fin && e.type === "evenement" ? `${heure(e.debut)} – ${heure(e.fin)}` : heure(e.debut);
}

export default function PageAgenda() {
  const moi = useMoiConnecte();
  const tu = tutoie(moi);
  const formateur = moi.role === "formateur";
  const [, naviguer] = useLocation();
  const recherche = new URLSearchParams(useSearch());
  const maintenant = useMaintenant(60_000);

  const semaineUrl = recherche.get("semaine");
  const lundi = useMemo(() => {
    const t = semaineUrl && /^\d{4}-\d{2}-\d{2}$/.test(semaineUrl) ? new Date(`${semaineUrl}T12:00:00Z`).getTime() : maintenantServeur();
    return lundiDe(Number.isNaN(t) ? maintenantServeur() : t);
  }, [semaineUrl]);
  const dimanche = new Date(lundi.getTime() + 6 * JOUR_MS);
  const cetteSemaine = isoJour(lundiDe(maintenant)) === isoJour(lundi);
  const aujourdhui = isoJour(new Date(maintenant));

  const [filtre, setFiltre] = useState<Filtre>("tout");
  const [evenement, setEvenement] = useState<{ ouvert: boolean; element: ElementAgenda | null }>({ ouvert: false, element: null });

  const url = `/api/agenda?debut=${lundi.toISOString()}&fin=${new Date(lundi.getTime() + 7 * JOUR_MS).toISOString()}`;
  const { data, isLoading, error, refetch } = useQuery<Agenda>({ queryKey: [url] });
  useTousEvenements((e) => {
    if (["agenda", "live", "seance", "devoir"].includes(e.type)) void rafraichir("/api/agenda");
  });

  const allerA = (d: Date | null) => naviguer(d ? `/agenda?semaine=${isoJour(d)}` : "/agenda", { replace: true });

  const elements = data?.elements ?? [];
  const compte = (t: TypeElementAgenda) => elements.filter((e) => e.type === t).length;
  const visibles = filtre === "tout" ? elements : elements.filter((e) => e.type === filtre);

  // Lundi → samedi toujours ; le dimanche seulement s'il s'y passe quelque chose.
  const jours = Array.from({ length: 7 }, (_, i) => new Date(lundi.getTime() + i * JOUR_MS))
    .map((d) => ({ date: d, iso: isoJour(d), elements: visibles.filter((e) => isoJour(new Date(e.debut)) === isoJour(d)) }))
    .filter((j, i) => i < 6 || j.elements.length > 0);

  const texteWhatsApp = texteSemaine(elements, lundi, numeroSemaine(lundi));

  return (
    <Page>
      <EnTetePage
        etiquette={`Semaine ${numeroSemaine(lundi)} · du ${dateCourte(lundi)} au ${dateCourte(dimanche)}`}
        titre={moi.role === "etudiant" ? "Ma semaine" : "Mon agenda"}
        sousTitre={
          tu
            ? "Tes lives, tes devoirs à rendre et les événements de ton campus, jour par jour."
            : formateur
              ? "Vos séances et vos échéances, à l'heure d'Abidjan et de Paris."
              : "Les séances, échéances et événements de votre périmètre."
        }
        actions={
          data?.peutAjouter ? (
            <Bouton onClick={() => setEvenement({ ouvert: true, element: null })} className="min-h-[48px]" icone={<Plus className="h-4 w-4" />}>
              Ajouter un événement
            </Bouton>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2" role="group" aria-label="Changer de semaine">
          <Bouton variante="doux" taille="icone" className="h-12 w-12" aria-label="Semaine précédente" onClick={() => allerA(new Date(lundi.getTime() - 7 * JOUR_MS))}>
            <ChevronLeft className="h-5 w-5" />
          </Bouton>
          <Bouton variante={cetteSemaine ? "encre" : "doux"} className="min-h-[48px] flex-1 sm:flex-none" onClick={() => allerA(null)} aria-pressed={cetteSemaine}>
            Cette semaine
          </Bouton>
          <Bouton variante="doux" taille="icone" className="h-12 w-12" aria-label="Semaine suivante" onClick={() => allerA(new Date(lundi.getTime() + 7 * JOUR_MS))}>
            <ChevronRight className="h-5 w-5" />
          </Bouton>
        </div>
        <Filtres
          valeur={filtre}
          onChange={setFiltre}
          options={[
            { valeur: "tout", libelle: "Tout", nombre: elements.length },
            { valeur: "live", libelle: "Lives", nombre: compte("live") },
            { valeur: "devoir", libelle: "Devoirs", nombre: compte("devoir") },
            { valeur: "evenement", libelle: "Événements", nombre: compte("evenement") },
          ]}
        />
      </div>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          {error && !data ? (
            <Erreur message={(error as Error).message} reessayer={() => void refetch()} />
          ) : isLoading ? (
            Array.from({ length: 4 }, (_, i) => <Squelette key={i} className="h-28" />)
          ) : (
            jours.map((j) => (
              <Jour
                key={j.iso}
                date={j.date}
                aujourdhui={j.iso === aujourdhui}
                passe={j.iso < aujourdhui}
                elements={j.elements}
                formateur={formateur}
                onEvenement={(e) => setEvenement({ ouvert: true, element: e })}
              />
            ))
          )}
          {!isLoading && !error && elements.length === 0 && (
            <p className="rounded-2xl bg-creme px-4 py-3 text-[15px] text-texte-pale">
              {tu
                ? "Rien de prévu cette semaine. Les lives et les devoirs de tes cours s'ajoutent ici tout seuls."
                : "Rien de prévu cette semaine. Les séances et les échéances de vos cours s'ajoutent ici toutes seules."}
            </p>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Abonnement tu={tu} />
          <Carte className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">{tu ? "Partager ma semaine" : "Partager la semaine"}</h2>
            <p className="text-[15px] leading-relaxed text-texte-pale">
              {tu
                ? "Un texte prêt à envoyer dans le groupe WhatsApp de ta classe, avec les heures et les dates limites."
                : "Un texte prêt à envoyer sur WhatsApp, avec les heures et les dates limites."}
            </p>
            <LienBouton href={lienWhatsApp(texteWhatsApp)} externe variante="contour" className="min-h-[48px] w-full px-3" icone={<Share2 className="h-4 w-4" />}>
              Partager ma semaine sur WhatsApp
            </LienBouton>
          </Carte>
        </aside>
      </div>

      {data?.peutAjouter && (
        <FenetreEvenement
          ouverte={evenement.ouvert}
          evenement={evenement.element}
          jour={cetteSemaine ? null : isoJour(lundi)}
          onFermer={() => setEvenement({ ouvert: false, element: null })}
        />
      )}
    </Page>
  );
}

/**
 * Filtres légers : quatre boutons de même largeur, qui tiennent sur une ligne
 * même à 360 px (les onglets du design system défileraient à cette largeur).
 */
function Filtres({ valeur, onChange, options }: { valeur: Filtre; onChange: (f: Filtre) => void; options: { valeur: Filtre; libelle: string; nombre: number }[] }) {
  return (
    <div role="group" aria-label="Afficher" className="grid grid-cols-4 gap-1 rounded-2xl bg-creme p-1.5 sm:w-auto sm:min-w-[440px]">
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <button
            key={o.valeur}
            type="button"
            aria-pressed={actif}
            onClick={() => onChange(o.valeur)}
            className={cn(
              "flex min-h-[44px] flex-col items-center justify-center rounded-xl px-1 text-[13px] font-bold leading-tight transition-colors sm:flex-row sm:gap-1.5 sm:text-sm",
              actif ? "bg-white text-encre shadow-sm" : "text-texte-pale hover:text-encre",
            )}
          >
            {o.libelle}
            <span className={cn("font-mono text-[11px] font-normal", actif ? "text-orange-fonce" : "text-texte-gris")}>{o.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Un jour de la semaine ──────────────────────────────────────────────────

function Jour({
  date,
  aujourdhui,
  passe,
  elements,
  formateur,
  onEvenement,
}: {
  date: Date;
  aujourdhui: boolean;
  passe: boolean;
  elements: ElementAgenda[];
  formateur: boolean;
  onEvenement: (e: ElementAgenda) => void;
}) {
  return (
    <section
      aria-label={majuscule(jourLong(date))}
      aria-current={aujourdhui ? "date" : undefined}
      className={cn("rounded-2xl px-4 py-3.5 sm:px-5", aujourdhui ? "border-[1.5px] border-orange bg-orange-pale" : "border border-ligne bg-white", passe && !aujourdhui && "opacity-75")}
    >
      <h2 className="flex flex-wrap items-center gap-2 text-[17px] font-extrabold">
        {majuscule(jourLong(date))}
        {aujourdhui && <Badge ton="encre">Aujourd'hui</Badge>}
      </h2>
      {elements.length ? (
        <ul className="mt-1 flex flex-col divide-y divide-ligne">
          {elements.map((e) => (
            <LigneElement key={e.cle} element={e} formateur={formateur} onEvenement={onEvenement} />
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[15px] text-texte-gris">Rien de prévu.</p>
      )}
    </section>
  );
}

function StatutElement({ e }: { e: ElementAgenda }) {
  if (e.type === "live") {
    if (e.statut === "en_direct") return <BadgeDirect className="px-2 py-0.5 text-[11px]" />;
    if (e.statut === "annulee") return <Badge ton="danger">Annulé</Badge>;
    if (e.statut === "terminee") return <Badge ton="gris">{e.lien?.startsWith("/replays") ? "Replay" : "Terminé"}</Badge>;
    return null;
  }
  if (e.type === "devoir") {
    switch (e.statut) {
      case "rendu":
        return <Badge ton="succes">Rendu ✓</Badge>;
      case "corrige":
        return <Badge ton="succes">Corrigé</Badge>;
      case "en_retard":
        return <Badge ton="danger">Non rendu</Badge>;
      case "a_rendre":
        return <Badge ton="orange">À rendre</Badge>;
      case "brouillon":
        return <Badge ton="gris">Non publié</Badge>;
      default:
        return null;
    }
  }
  return null;
}

function LigneElement({ element: e, formateur, onEvenement }: { element: ElementAgenda; formateur: boolean; onEvenement: (e: ElementAgenda) => void }) {
  const Icone = e.type === "live" ? Radio : e.type === "devoir" ? ClipboardList : CalendarDays;
  const annule = e.statut === "annulee";
  const titre = (
    <span className={cn("text-base font-bold leading-snug", annule && "text-texte-gris line-through")}>
      {e.type === "devoir" ? "À rendre : " : e.type === "live" ? (e.statut === "terminee" ? "Replay : " : "En direct : ") : ""}
      {e.titre}
    </span>
  );
  const contenu = (
    <>
      <span className={cn("shrink-0 pt-0.5 font-mono text-[13px] font-semibold tabular-nums", formateur ? "w-full sm:w-44" : "w-[76px]")}>{horaire(e, formateur)}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <Icone className="h-4 w-4 shrink-0 text-orange-fonce" aria-hidden />
          {e.coursCode && (
            <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-orange-fonce">
              {e.couleur && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.couleur }} aria-hidden />}
              {e.coursCode}
            </span>
          )}
          <StatutElement e={e} />
        </span>
        {titre}
        {annule && e.motifAnnulation && <span className="text-sm text-danger">{e.motifAnnulation}</span>}
        {e.lieu && (
          <span className="flex items-center gap-1 text-sm text-texte-pale">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> {e.lieu}
          </span>
        )}
        {e.type === "evenement" && e.description && <span className="line-clamp-2 text-sm text-texte-pale">{e.description}</span>}
      </span>
    </>
  );
  const classes = cn("flex items-start gap-3 py-3 text-encre no-underline", formateur && "flex-wrap sm:flex-nowrap");
  return (
    <li className="flex flex-col">
      {e.type === "evenement" && e.modifiable ? (
        <button type="button" onClick={() => onEvenement(e)} className={cn(classes, "min-h-[56px] w-full text-left hover:text-orange-fonce")} aria-label={`Modifier l'événement ${e.titre}`}>
          {contenu}
        </button>
      ) : e.lien && !annule ? (
        <Link href={e.lien} className={cn(classes, "min-h-[56px] hover:text-orange-fonce")}>
          {contenu}
        </Link>
      ) : (
        <div className={classes}>{contenu}</div>
      )}
      {e.type === "live" && (e.statut === "planifiee" || e.statut === "en_direct") && (
        <a
          href={`/api/agenda/seances/${e.id}.ics`}
          download
          className={cn("-mt-1 mb-2 flex min-h-[40px] items-center gap-1.5 self-start text-sm font-semibold", formateur ? "sm:ml-[188px]" : "ml-[88px]")}
        >
          <CalendarPlus className="h-4 w-4" aria-hidden /> Ajouter à mon agenda
        </a>
      )}
    </li>
  );
}

// ── Abonnement .ics ────────────────────────────────────────────────────────

type LienAbonnement = { url: string; webcal: string; google: string };

function Abonnement({ tu }: { tu: boolean }) {
  const [lien, setLien] = useState<LienAbonnement | null>(null);
  const [chargement, setChargement] = useState(false);
  const [renouveler, setRenouveler] = useState(false);

  async function obtenir() {
    setChargement(true);
    try {
      setLien(await get<LienAbonnement>("/api/agenda/abonnement"));
    } catch (e) {
      toastErreur(e);
    } finally {
      setChargement(false);
    }
  }

  async function copier() {
    if (!lien) return;
    try {
      await navigator.clipboard.writeText(lien.url);
      toast("Lien copié.");
    } catch {
      toast("Copie impossible : sélectionnez le lien et copiez-le à la main.", "info");
    }
  }

  async function nouveauLien() {
    setChargement(true);
    try {
      setLien(await post<LienAbonnement>("/api/agenda/abonnement/renouveler"));
      toast("Nouveau lien créé. L'ancien ne fonctionne plus.");
      setRenouveler(false);
    } catch (e) {
      toastErreur(e);
    } finally {
      setChargement(false);
    }
  }

  return (
    <Carte className="flex flex-col gap-3 border-0 bg-creme">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-orange text-encre">
        <Smartphone className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="text-lg font-extrabold">{tu ? "Ton agenda dans ton téléphone" : "Votre agenda dans votre téléphone"}</h2>
      <p className="text-[15px] leading-relaxed text-texte-doux">
        {tu
          ? "Abonne-toi une fois : tes lives et tes devoirs arrivent dans Google Agenda ou le calendrier de ton téléphone, avec un rappel 15 minutes avant chaque live, même sans réseau."
          : "Abonnez-vous une fois : vos séances et échéances arrivent dans Google Agenda, Outlook ou Apple Calendrier, avec un rappel 15 minutes avant chaque live."}
      </p>
      {!lien ? (
        <Bouton onClick={() => void obtenir()} chargement={chargement} className="min-h-[48px]" icone={<CalendarPlus className="h-4 w-4" />}>
          M'abonner à mon agenda
        </Bouton>
      ) : (
        <div className="flex flex-col gap-3">
          <LienBouton href={lien.google} externe className="min-h-[48px]" icone={<CalendarPlus className="h-4 w-4" />}>
            Ajouter à Google Agenda
          </LienBouton>
          <a href={lien.webcal} className="flex min-h-[44px] items-center justify-center rounded-xl border-[1.5px] border-encre bg-white px-4 text-[15px] font-bold text-encre no-underline hover:bg-orange-pale hover:text-encre">
            Calendrier de l'iPhone ou Outlook
          </a>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={lien.url}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Lien d'abonnement"
              className="min-w-0 flex-1 rounded-xl border border-ligne bg-white px-3 py-3 font-mono text-xs text-texte-doux"
            />
            <Bouton variante="encre" taille="icone" className="h-12 w-12 shrink-0" onClick={() => void copier()} aria-label="Copier le lien">
              <Copy className="h-5 w-5" />
            </Bouton>
          </div>
          <p className="text-[13px] leading-relaxed text-texte-gris">
            {tu ? "Ce lien est personnel : ne le partage pas." : "Ce lien est personnel : ne le partagez pas."}{" "}
            <button type="button" className="font-bold text-orange-fonce underline-offset-2 hover:underline" onClick={() => setRenouveler(true)}>
              Lien partagé par erreur ?
            </button>
          </p>
        </div>
      )}
      <Fenetre
        ouverte={renouveler}
        onFermer={() => setRenouveler(false)}
        titre="Créer un nouveau lien ?"
        description={
          tu
            ? "L'ancien lien cessera de fonctionner : tu devras te réabonner avec le nouveau sur ton téléphone."
            : "L'ancien lien cessera de fonctionner : vous devrez vous réabonner avec le nouveau."
        }
        pied={
          <>
            <Bouton variante="fantome" onClick={() => setRenouveler(false)} className="min-h-[48px]">
              Annuler
            </Bouton>
            <Bouton onClick={() => void nouveauLien()} chargement={chargement} className="min-h-[48px]" icone={<RefreshCw className="h-4 w-4" />}>
              Créer un nouveau lien
            </Bouton>
          </>
        }
      />
    </Carte>
  );
}

// ── Texte WhatsApp de la semaine ───────────────────────────────────────────

function texteSemaine(elements: ElementAgenda[], lundi: Date, numero: number): string {
  const lignes = [`Ma semaine au campus numérique 2IAE (semaine ${numero})`, ""];
  let vide = true;
  for (let i = 0; i < 7; i++) {
    const jour = new Date(lundi.getTime() + i * JOUR_MS);
    const duJour = elements.filter((e) => isoJour(new Date(e.debut)) === isoJour(jour));
    if (!duJour.length) continue;
    vide = false;
    lignes.push(`*${majuscule(jourLong(jour))}*`);
    for (const e of duJour) {
      const code = e.coursCode ? `${e.coursCode} · ` : "";
      if (e.type === "live") lignes.push(`- ${heure(e.debut)} · ${code}${e.statut === "annulee" ? "ANNULÉ : " : e.statut === "terminee" ? "Replay : " : "En direct : "}${e.titre}`);
      else if (e.type === "devoir") lignes.push(`- Avant ${heure(e.debut)} · ${code}À rendre : ${e.titre}`);
      else lignes.push(`- ${heure(e.debut)} · ${e.titre}${e.lieu ? ` (${e.lieu})` : ""}`);
    }
    lignes.push("");
  }
  if (vide) lignes.push("Rien de prévu cette semaine.", "");
  lignes.push("Heures d'Abidjan. Tout est sur le campus :", adresseCampus(`/agenda?semaine=${isoJour(lundi)}`));
  return lignes.join("\n");
}
