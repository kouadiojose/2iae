// Accueil du formateur à trois gros blocs (José, 14 octobre 2026 au soir : « le professeur se connecte et il veut voir
// de gros blocs : Le cours, Entrer dans le live, Préparer le cours. Il clique, 1, 2, il lit, c'est clair »).
// Briques communes à /enseigner (PageEnseigner) et /enseigner/mon-cours/:id (PageMonCours) : le carré d'un cours et
// les trois blocs. Gros, sans survol nécessaire ; phrases courtes (shared/textes/enseigner.ts, blocs.*).
// « Des gros blocs, mais un peu de beauté » (15 octobre, 5 h) : le même carré en dégradé que l'espace du campus, les
// blocs avec leur icône dans un cercle et leur ombre légère, le point « En direct » vivant (components/ui/gros-blocs).
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, ChevronRight, MonitorPlay, PenLine } from "lucide-react";
import { post } from "@/lib/api";
import { useTousEvenements } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { degradeCours } from "@/modules/cours/outils";
import { Bulles, CarteCours, CercleIcone, CLASSES_VIVANTES, Pastille, PointVivant } from "@/components/ui/gros-blocs";
import { t as tEnseigner } from "@shared/textes/enseigner";
import type { AccueilSimpleDto, CarreFormateurDto } from "@shared/accueil-simple";

export const CLE_ACCUEIL_SIMPLE = "/api/enseigner/accueil-simple";

/** L'accueil simple, relu toutes les 60 s et aussitôt quand un live démarre ou finit. */
export function useAccueilSimple() {
  useTousEvenements((e) => {
    if (e.type === "live") void rafraichir(CLE_ACCUEIL_SIMPLE);
  });
  return useQuery<AccueilSimpleDto>({ queryKey: [CLE_ACCUEIL_SIMPLE], refetchInterval: 60_000, staleTime: 5_000 });
}

/** Le repère d'un cours, en mots : « En direct maintenant », « Aujourd'hui à 8h30 · 4h30 chez vous », « Jeudi à 8h30 ». */
export function useRepere() {
  const tx = useTextes(tEnseigner);
  return (c: CarreFormateurDto): string | null => {
    const chez = c.heureChezVous ? ` · ${tx("blocs.live.chezVous", { v: { heure: c.heureChezVous } })}` : "";
    switch (c.repere) {
      case "direct":
        return tx("blocs.live.direct");
      case "ouvert":
        return tx("blocs.live.ouvert", { v: { heure: c.heure ?? "" } });
      case "aujourdhui":
        return `${tx("blocs.live.aujourdhui", { v: { heure: c.heure ?? "" } })}${chez}`;
      case "jour":
        return `${tx("blocs.live.jour", { v: { jour: c.jour ?? "", heure: c.heure ?? "" } })}${chez}`;
      default:
        return null;
    }
  };
}

/** La pastille du repère d'un carré (en direct : point vivant ; ouvert : vert pâle ; sinon blanche avec l'heure). */
function PastilleCours({ c, texte }: { c: CarreFormateurDto; texte: string | null }) {
  if (!texte) return null;
  if (c.repere === "direct") return <Pastille ton="direct">{texte}</Pastille>;
  if (c.repere === "ouvert") return <Pastille ton="ouvert">{texte}</Pastille>;
  return (
    <Pastille ton="blanc" sansIcone>
      {texte}
    </Pastille>
  );
}

/** Un gros carré de cours (plusieurs cours : on choisit d'abord le cours). Le même que l'espace du campus. */
export function CarreCours({ c }: { c: CarreFormateurDto }) {
  const repere = useRepere()(c);
  const Icone = c.repere === "direct" || c.repere === "ouvert" ? MonitorPlay : c.repere === "aujourdhui" || c.repere === "jour" ? CalendarDays : BookOpen;
  return (
    <CarteCours
      href={`/enseigner/mon-cours/${c.coursId}`}
      couleur={c.couleur}
      code={c.code}
      titre={c.titre}
      repere={<PastilleCours c={c} texte={repere} />}
      icone={<Icone className="h-7 w-7" strokeWidth={2.25} />}
    />
  );
}

type TonBloc = "blanc" | "orange" | "vert" | "gris";
const TONS: Record<TonBloc, { classe: string; fond?: string; degrade?: string }> = {
  blanc: { classe: "border-ligne bg-white text-encre hover:border-orange/60" },
  orange: { classe: "border-transparent text-encre", fond: "linear-gradient(135deg, #E4793A 0%, #F0A066 100%)", degrade: "#E4793A,#F0A066" },
  vert: { classe: "border-transparent text-white", fond: "linear-gradient(135deg, #16774C 0%, #0F5F3C 100%)", degrade: "#16774C,#0F5F3C" },
  gris: { classe: "border-[#D9D2CB] bg-[#EEEAE6] text-[#5E554F]" },
};

/**
 * Un gros bloc : icône dans un cercle (64 px), titre en 28 à 32 px, une ligne dessous (20 px). Pleine largeur et
 * 120 px au moins sur téléphone ; trois colonnes de 208 px sur ordinateur, la flèche en bas à droite.
 */
function Bloc({
  icone,
  cercle,
  titre,
  texte,
  ton,
  href,
  onClick,
  testId,
  vivant = false,
}: {
  icone: ReactNode;
  cercle: { fond: string; couleur: string };
  titre: string;
  texte: string;
  ton: TonBloc;
  href?: string;
  onClick?: () => void;
  testId: string;
  vivant?: boolean;
}) {
  const actif = ton !== "gris" && Boolean(href || onClick);
  const t = TONS[ton];
  const classe = cn(
    "relative isolate flex min-h-[120px] w-full items-center gap-5 overflow-hidden rounded-[26px] border-2 px-5 py-5 text-left no-underline sm:min-h-[136px] lg:min-h-[208px] lg:flex-col lg:items-start lg:justify-between lg:gap-4 lg:p-7",
    // Écran bas (1024×600) : les trois blocs entiers à l'écran, sous la bande du cours.
    "[@media(max-height:700px)]:lg:!min-h-[176px] [@media(max-height:700px)]:lg:!gap-3 [@media(max-height:700px)]:lg:!p-5",
    t.classe,
    actif ? cn(CLASSES_VIVANTES, "hover:-translate-y-0.5 active:translate-y-0") : "",
  );
  const contenu = (
    <>
      <CercleIcone taille={64} fond={cercle.fond} couleur={cercle.couleur}>
        {icone}
      </CercleIcone>
      <span className="flex min-w-0 flex-col gap-1.5 lg:pr-12">
        <span className="text-[28px] font-black leading-tight sm:text-[32px]">{titre}</span>
        <span className="flex items-center gap-2.5 text-[20px] font-semibold leading-snug">
          {vivant && <PointVivant />}
          <span>{texte}</span>
        </span>
      </span>
      {actif && (
        <span className="absolute bottom-6 right-6 hidden lg:grid" aria-hidden>
          <CercleIcone taille={44} fond={ton === "blanc" ? "#FBF6F2" : "rgba(255,255,255,.2)"}>
            <ChevronRight className="h-6 w-6" strokeWidth={2.25} />
          </CercleIcone>
        </span>
      )}
    </>
  );
  const style = t.fond ? { background: t.fond } : undefined;
  if (href)
    return (
      <Link href={href} className={classe} style={style} data-bloc={testId} data-degrade={t.degrade}>
        {contenu}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={classe} style={style} data-bloc={testId} data-degrade={t.degrade} aria-disabled={!onClick}>
      {contenu}
    </button>
  );
}

/**
 * Les trois blocs d'un cours, dans l'ordre de José : « Le cours », « Entrer dans le live », « Préparer le cours ».
 * « Entrer dans le live » : en direct → le Studio ; dès 1 h avant → la classe s'ouvre (le cours commence à son heure)
 * puis le Studio ; plus tôt → « Revenez à 7h30. » sous le bloc ; sans séance → bloc grisé. « Préparer le cours » dit ce
 * qui est déjà prêt (« 24 diapos · 2 vidéos »).
 */
export function TroisBlocs({ c }: { c: CarreFormateurDto }) {
  const tx = useTextes(tEnseigner);
  const repere = useRepere()(c);
  const [, naviguer] = useLocation();
  const [envoi, setEnvoi] = useState(false);
  const [revenir, setRevenir] = useState(false);
  const s = c.seance;
  const live = c.live;
  // Plus d'une heure avant : le jour et l'heure du cours (« Samedi à 10h00 »), ou, aujourd'hui, l'heure du cours et
  // celle où le live s'ouvre (« Aujourd'hui à 11h00 · le live ouvre à 10h00 »). Toujours l'heure d'Abidjan d'abord.
  const texteLive =
    live.etat === "attendre" && live.ouvreHeure
      ? c.repere === "aujourdhui" && !live.ouvreJour
        ? `${repere ?? ""} · ${tx("blocs.live.ouvre", { v: { heure: live.ouvreHeure } })}`
        : (repere ?? tx("blocs.live.attendre", { v: { heure: live.ouvreHeure } }))
      : live.etat === "aucun"
        ? tx("blocs.live.aucun")
        : (repere ?? tx("blocs.live.aucun"));
  const texteRevenir = live.ouvreHeure
    ? `${live.ouvreJour ? tx("blocs.live.revenir.jour", { v: { jour: live.ouvreJour, heure: live.ouvreHeure } }) : tx("blocs.live.revenir", { v: { heure: live.ouvreHeure } })}${
        live.ouvreChezVous ? ` (${tx("blocs.live.chezVous", { v: { heure: live.ouvreChezVous } })})` : ""
      }.`
    : null;
  const p = c.preparation;
  const textePreparer = !s
    ? tx("blocs.preparer.aucun")
    : !p
      ? tx("blocs.preparer.texte")
      : p.diapos === 0 && p.videos === 0
        ? tx("blocs.preparer.diapos.zero")
        : `${p.diapos === 0 ? tx("blocs.preparer.diapos.zero") : p.diapos === 1 ? tx("blocs.preparer.diapos.un") : tx("blocs.preparer.diapos", { v: { n: p.diapos } })} · ${
            p.videos === 0 ? tx("blocs.preparer.videos.zero") : p.videos === 1 ? tx("blocs.preparer.videos.un") : tx("blocs.preparer.videos", { v: { n: p.videos } })
          }`;
  const entrer = async () => {
    if (!s) return;
    if (live.etat === "direct") return naviguer(`/live/${s.id}`);
    if (live.etat === "attendre") return setRevenir(true);
    if (live.etat !== "ouvrir") return;
    setEnvoi(true);
    // La classe s'ouvre (le cours commence à son heure) ; puis le Studio, même si un autre l'a ouverte (409).
    await post(`/api/seances/${s.id}/demarrer`, { avantLHeure: true }).catch(() => undefined);
    await rafraichir(CLE_ACCUEIL_SIMPLE, `/api/seances/${s.id}`);
    naviguer(`/live/${s.id}`);
  };
  const tonLive: TonBloc = live.etat === "direct" ? "vert" : live.etat === "ouvrir" ? "orange" : "gris";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        <Bloc
          testId="cours"
          ton="blanc"
          cercle={{ fond: "#FFF1E6", couleur: "#A34C17" }}
          icone={<BookOpen className="h-8 w-8" strokeWidth={2.25} />}
          titre={tx("blocs.cours")}
          texte={tx("blocs.cours.texte")}
          href={c.liens.cours}
        />
        <Bloc
          testId="live"
          ton={tonLive}
          vivant={live.etat === "direct"}
          cercle={tonLive === "gris" ? { fond: "#E2DDD8", couleur: "#5E554F" } : tonLive === "vert" ? { fond: "rgba(255,255,255,.2)", couleur: "#FFFFFF" } : { fond: "rgba(255,255,255,.3)", couleur: "#141414" }}
          icone={<MonitorPlay className="h-8 w-8" strokeWidth={2.25} />}
          titre={tx("blocs.live")}
          texte={envoi ? tx("blocs.live.ouverture") : texteLive}
          onClick={live.etat === "aucun" ? undefined : () => void entrer()}
        />
        <Bloc
          testId="preparer"
          ton={s ? "blanc" : "gris"}
          cercle={s ? { fond: "#141414", couleur: "#FFFFFF" } : { fond: "#E2DDD8", couleur: "#5E554F" }}
          icone={<PenLine className="h-8 w-8" strokeWidth={2.25} />}
          titre={tx("blocs.preparer")}
          texte={textePreparer}
          href={c.liens.preparer ?? undefined}
        />
      </div>
      {revenir && texteRevenir && (
        <p className="rounded-[20px] border-2 border-ligne bg-creme px-5 py-4 text-[22px] font-bold" role="status" data-revenir>
          {texteRevenir}
        </p>
      )}
    </div>
  );
}

/** Le lien « Plus » (l'accueil détaillé d'avant), avec le nombre de choses à faire : une pilule crème de 56 px. */
export function LienPlus({ aFaire }: { aFaire: number }) {
  const tx = useTextes(tEnseigner);
  return (
    <Link
      href="/enseigner/plus"
      className="inline-flex min-h-[56px] items-center self-end rounded-full border-2 border-ligne bg-creme px-6 text-[20px] font-bold text-orange-profond no-underline shadow-carte transition-[border-color,box-shadow] duration-150 hover:border-orange/60 hover:text-orange-profond hover:shadow-survol"
      data-lien-plus
    >
      {aFaire === 0 ? tx("blocs.plus") : aFaire === 1 ? tx("blocs.plus.un") : tx("blocs.plus.n", { v: { n: aFaire } })}
    </Link>
  );
}

/** La bande du cours choisi : un héros en dégradé de sa couleur, avec ses bulles, son code et son nom en grand. */
export function BandeCours({ c }: { c: CarreFormateurDto }) {
  const d = degradeCours(c.couleur);
  return (
    <div
      className="relative isolate flex flex-col gap-2 overflow-hidden rounded-[32px] px-7 py-7 shadow-carte sm:px-10 sm:py-9 [@media(max-height:700px)]:!gap-1 [@media(max-height:700px)]:!px-6 [@media(max-height:700px)]:!py-4"
      style={{ background: d.css, color: d.texte }}
      data-degrade={`${d.fond},${d.a}`}
      data-heros
    >
      <Bulles voile={d.voile} grandes />
      <span className="font-mono text-[15px] font-semibold uppercase tracking-[0.14em]">{c.code}</span>
      <h2 className="break-words text-[38px] leading-[1.02] sm:text-[52px] [@media(max-height:700px)]:!text-[34px]" style={{ color: d.texte }}>
        {c.titre}
      </h2>
    </div>
  );
}
