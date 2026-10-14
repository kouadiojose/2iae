// Accueil du formateur à trois gros blocs (José, 14 octobre 2026 au soir : « le professeur se connecte et il veut voir
// de gros blocs : Le cours, Entrer dans le live, Préparer le cours. Il clique, 1, 2, il lit, c'est clair »).
// Briques communes à /enseigner (PageEnseigner) et /enseigner/mon-cours/:id (PageMonCours) : le carré d'un cours et
// les trois blocs. Gros, sans animation, sans survol nécessaire ; phrases courtes (shared/textes/enseigner.ts, blocs.*).
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, MonitorPlay, PenLine } from "lucide-react";
import { post } from "@/lib/api";
import { useTousEvenements } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { couleurLisible } from "@/modules/cours/outils";
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

/** Fond et texte d'un carré de la couleur d'un cours (contraste de 4,5 au moins). */
const styleCouleur = (couleur: string) => {
  const c = couleurLisible(couleur);
  return { background: c.fond, color: c.texte };
};

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

/** Un gros carré de cours (plusieurs cours : on choisit d'abord le cours). */
export function CarreCours({ c }: { c: CarreFormateurDto }) {
  const repere = useRepere()(c);
  return (
    <Link
      href={`/enseigner/mon-cours/${c.coursId}`}
      className="flex min-h-[160px] flex-col justify-between gap-4 rounded-[24px] p-5 no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-encre/40 sm:min-h-[200px] sm:p-6"
      style={styleCouleur(c.couleur)}
      data-carre={c.code}
    >
      <span className="min-h-[38px]">
        {repere && (
          <span className={cn("inline-flex rounded-full px-3.5 py-1.5 text-[18px] font-extrabold", c.repere === "direct" ? "bg-succes text-white" : "bg-white text-encre")}>{repere}</span>
        )}
      </span>
      {/* Interligne et marge basse : les jambages (g, p, y) de la dernière ligne ne sont pas coupés. */}
      <span className="line-clamp-3 break-words pb-[0.12em] text-[30px] font-black leading-[1.12] sm:text-[36px]">{c.titre}</span>
    </Link>
  );
}

type TonBloc = "blanc" | "orange" | "vert" | "gris";
const tons: Record<TonBloc, string> = {
  blanc: "border-encre bg-white text-encre hover:bg-creme",
  orange: "border-orange bg-orange text-encre",
  vert: "border-succes bg-succes text-white",
  gris: "border-[#D9D2CB] bg-[#EEEAE6] text-[#5E554F]",
};

/** Un gros bloc : icône de 56 px, titre en 32 px, une ligne dessous (20 px). 160 px au moins sur ordinateur. */
function Bloc({ icone, titre, texte, ton, href, onClick, testId }: { icone: ReactNode; titre: string; texte: string; ton: TonBloc; href?: string; onClick?: () => void; testId: string }) {
  const classe = cn(
    "flex min-h-[112px] w-full items-center gap-4 rounded-[24px] border-[3px] px-5 py-5 text-left no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-encre/40 sm:min-h-[136px] lg:min-h-[180px] lg:flex-col lg:items-start lg:justify-between lg:gap-3 lg:p-6",
    tons[ton],
  );
  const contenu = (
    <>
      <span className="shrink-0" aria-hidden>
        {icone}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[28px] font-black leading-tight sm:text-[32px]">{titre}</span>
        <span className="text-[20px] font-semibold leading-snug">{texte}</span>
      </span>
    </>
  );
  if (href)
    return (
      <Link href={href} className={classe} data-bloc={testId}>
        {contenu}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={classe} data-bloc={testId} aria-disabled={!onClick}>
      {contenu}
    </button>
  );
}

/**
 * Les trois blocs d'un cours, dans l'ordre de José : « Le cours », « Entrer dans le live », « Préparer le cours ».
 * « Entrer dans le live » : en direct → le Studio ; dès 1 h avant → la classe s'ouvre (le cours commence à son heure)
 * puis le Studio ; plus tôt → « Revenez à 7h30. » sous le bloc ; sans séance → bloc grisé.
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
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        <Bloc testId="cours" ton="blanc" icone={<BookOpen className="h-14 w-14" />} titre={tx("blocs.cours")} texte={tx("blocs.cours.texte")} href={c.liens.cours} />
        <Bloc
          testId="live"
          ton={live.etat === "direct" ? "vert" : live.etat === "ouvrir" ? "orange" : "gris"}
          icone={<MonitorPlay className="h-14 w-14" />}
          titre={tx("blocs.live")}
          texte={envoi ? tx("blocs.live.ouverture") : texteLive}
          onClick={live.etat === "aucun" ? undefined : () => void entrer()}
        />
        <Bloc
          testId="preparer"
          ton={s ? "blanc" : "gris"}
          icone={<PenLine className="h-14 w-14" />}
          titre={tx("blocs.preparer")}
          texte={s ? tx("blocs.preparer.texte") : tx("blocs.preparer.aucun")}
          href={c.liens.preparer ?? undefined}
        />
      </div>
      {revenir && texteRevenir && (
        <p className="rounded-[20px] bg-creme px-5 py-4 text-[22px] font-bold" role="status" data-revenir>
          {texteRevenir}
        </p>
      )}
    </div>
  );
}

/** Le lien « Plus » (l'accueil détaillé d'avant), avec le nombre de choses à faire. */
export function LienPlus({ aFaire }: { aFaire: number }) {
  const tx = useTextes(tEnseigner);
  return (
    <Link href="/enseigner/plus" className="inline-flex min-h-[56px] items-center self-end rounded-full px-4 text-[20px] font-bold text-orange-fonce underline underline-offset-4" data-lien-plus>
      {aFaire === 0 ? tx("blocs.plus") : aFaire === 1 ? tx("blocs.plus.un") : tx("blocs.plus.n", { v: { n: aFaire } })}
    </Link>
  );
}

/** La bande du cours choisi : sa couleur, son nom en grand. */
export function BandeCours({ c }: { c: CarreFormateurDto }) {
  return (
    <div className="rounded-[24px] px-6 py-5 sm:px-8" style={styleCouleur(c.couleur)}>
      <h2 className="break-words text-[34px] font-black leading-[1.05] sm:text-[44px]">{c.titre}</h2>
    </div>
  );
}
