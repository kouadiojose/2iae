// Pièces du portail des bibliothèques libres : carte d'un livre de l'index et
// lecteur (texte en pages, pages scannées, PDF, version web), partagé par la
// page du livre libre et l'onglet « Lire » de la bibliothèque.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText, ChevronLeft, ChevronRight, ChevronRight as Fleche, Download, ExternalLink, FileText, Globe, Minus, Plus, ScanLine } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { Carte, CarteLien } from "@/components/ui/carte";
import { Badge, Chargement, Erreur } from "@/components/ui/divers";
import { Onglets } from "@/components/ui/onglets";
import { cn } from "@/lib/utils";
import { Couverture } from "./composants";
import { LANGUES_LIBRES, LIBELLES_SOURCES_LIBRES, type DetailLibreDto, type LivreLibreDto, type PageTexteLibreDto } from "@shared/schema/ext-libres";

const memoire = {
  lire(cle: string): string | null {
    try {
      return localStorage.getItem(cle);
    } catch {
      return null;
    }
  },
  ecrire(cle: string, valeur: string) {
    try {
      localStorage.setItem(cle, valeur);
    } catch {
      /* navigation privée : rien n'est retenu */
    }
  },
};

export const nomLangue = (code: string | null) => (code ? (LANGUES_LIBRES[code] ?? code.toUpperCase()) : null);

export function ligneLibre(l: Pick<LivreLibreDto, "auteurs" | "annee">) {
  return [l.auteurs || "Auteur inconnu", l.annee ? String(l.annee) : null].filter(Boolean).join(" · ");
}

/** Livre de l'index dans une liste de résultats. */
export function CarteLivreLibre({ livre, compacte }: { livre: LivreLibreDto; compacte?: boolean }) {
  const couverture = { titre: livre.titre, auteurs: livre.auteurs, couvertureUrl: livre.couverture };
  if (compacte) {
    return (
      <CarteLien href={`/bibliotheque/libres/${livre.id}`} className="flex items-center gap-3 px-3 py-3">
        <Couverture livre={couverture} className="w-11" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 font-bold leading-snug">{livre.titre}</span>
          <span className="truncate text-sm text-texte-pale">{ligneLibre(livre)}</span>
        </span>
        <Fleche className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
      </CarteLien>
    );
  }
  return (
    <CarteLien href={`/bibliotheque/libres/${livre.id}`} className="flex gap-4 p-4">
      <Couverture livre={couverture} className="w-16 sm:w-20" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-1.5">
          {livre.lectureIci ? (
            <Badge ton="orange">
              <BookOpenText className="mr-1 inline h-3.5 w-3.5" aria-hidden />À lire ici
            </Badge>
          ) : (
            <Badge ton="gris">Sur le site de la bibliothèque</Badge>
          )}
          {livre.langue && <Badge ton="gris">{nomLangue(livre.langue)}</Badge>}
        </span>
        <span className="line-clamp-3 text-[17px] font-extrabold leading-snug">{livre.titre}</span>
        <span className="text-sm text-texte-pale">
          {ligneLibre(livre)} · {LIBELLES_SOURCES_LIBRES[livre.source].nom}
        </span>
        {livre.apercu && <span className="line-clamp-2 text-[15px] leading-relaxed text-texte-doux">{livre.apercu}</span>}
      </span>
      <Fleche className="h-5 w-5 shrink-0 self-center text-texte-gris" aria-hidden />
    </CarteLien>
  );
}

// ── Lecteur ──────────────────────────────────────────────────────────────────

type ModeLecture = "texte" | "pages" | "pdf" | "web";
type LivreLecteur = DetailLibreDto["livre"];

function modesDe(l: LivreLecteur): { valeur: ModeLecture; libelle: string }[] {
  const modes: { valeur: ModeLecture; libelle: string }[] = [];
  if (l.source === "openstax" && l.web) modes.push({ valeur: "web", libelle: "Lire en ligne" });
  if (l.source === "archive") modes.push({ valeur: "pages", libelle: "Pages scannées" });
  if (l.texte) modes.push({ valeur: "texte", libelle: l.source === "archive" ? "Version texte" : "Texte intégral" });
  if (l.pdf) modes.push({ valeur: "pdf", libelle: "PDF" });
  if (l.source === "gutenberg" && l.web) modes.push({ valeur: "web", libelle: "Édition illustrée" });
  return modes;
}

/** Le lecteur d'un livre libre : le mode le plus léger d'abord (un petit forfait suffit). */
export function LecteurLibre({ livre, etudiant }: { livre: LivreLecteur; etudiant: boolean }) {
  const modes = modesDe(livre);
  const [mode, setMode] = useState<ModeLecture | null>(modes[0]?.valeur ?? null);
  const source = LIBELLES_SOURCES_LIBRES[livre.source].nom;

  if (!mode) {
    return (
      <Carte className="flex flex-col items-start gap-3">
        <FileText className="h-7 w-7 text-orange-fonce" aria-hidden />
        <p className="text-[17px] font-extrabold">{etudiant ? "Lis-le gratuitement sur le site de la bibliothèque" : "À lire gratuitement sur le site de la bibliothèque"}</p>
        <p className="text-[15px] text-texte-pale">
          {source} ne laisse pas le campus afficher ses livres : ils s'ouvrent dans un nouvel onglet, gratuitement et sans compte.
        </p>
        <div className="flex flex-wrap gap-2">
          {livre.pdfExterne && <LienExterne href={livre.pdfExterne} icone={<Download className="h-4 w-4" aria-hidden />} texte="Ouvrir le PDF" />}
          <LienExterne href={livre.lien} icone={<ExternalLink className="h-4 w-4" aria-hidden />} texte={`Lire sur ${source}`} />
        </div>
      </Carte>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      {modes.length > 1 && <Onglets<ModeLecture> valeur={mode} onChange={setMode} options={modes} className="self-start" />}
      {mode === "texte" && <LectureTexteLibre id={livre.id} />}
      {mode === "pages" && (
        <Cadre src={`https://archive.org/embed/${encodeURIComponent(decodeURIComponent(livre.lien.split("/details/")[1] ?? ""))}`} titre={`Lire « ${livre.titre} »`} sombre />
      )}
      {mode === "pdf" && (
        <>
          <Cadre src={`/api/libres/${livre.id}/pdf`} titre={`PDF de « ${livre.titre} »`} />
          <p className="text-sm text-texte-gris">
            Sur certains téléphones, le PDF ne s'affiche pas dans la page :{" "}
            <a href={`/api/libres/${livre.id}/pdf`} target="_blank" rel="noreferrer">
              {etudiant ? "ouvre-le en plein écran" : "l'ouvrir en plein écran"}
            </a>
            {livre.texte ? (etudiant ? ", ou choisis « Texte intégral », plus léger." : ", ou choisir « Texte intégral », plus léger.") : "."}
          </p>
        </>
      )}
      {mode === "web" && livre.web && <Cadre src={livre.web} titre={`Lire « ${livre.titre} »`} />}
      <p className="text-sm text-texte-gris">
        {mode === "pages" && "Les pages scannées gardent la mise en page d'origine ; la version texte est plus légère (texte reconnu automatiquement, quelques erreurs possibles). "}
        {mode === "texte" && livre.source === "gutenberg" && "Texte intégral du Project Gutenberg, relu par des bénévoles. "}
        Source : {source}
        {livre.licence ? ` · ${livre.licence}` : ""} ·{" "}
        <a href={livre.lien} target="_blank" rel="noreferrer">
          voir la notice
        </a>
      </p>
    </section>
  );
}

function LienExterne({ href, icone, texte }: { href: string; icone: ReactNode; texte: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ligne bg-white px-4 text-[15px] font-bold text-encre no-underline hover:border-orange">
      {icone}
      {texte}
    </a>
  );
}

function Cadre({ src, titre, sombre }: { src: string; titre: string; sombre?: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-ligne", sombre ? "bg-encre" : "bg-white")}>
      <iframe src={src} title={titre} className="block h-[75vh] min-h-[440px] w-full" allowFullScreen loading="lazy" />
    </div>
  );
}

const TAILLES_TEXTE = ["text-[15px]", "text-[17px]", "text-[19px]", "text-[22px]"];

/** Texte intégral en pages, avec la page et la taille du texte retenues sur l'appareil. */
function LectureTexteLibre({ id }: { id: number }) {
  const clePage = `libre-page-${id}`;
  const [page, setPage] = useState(() => Math.max(1, Number(memoire.lire(clePage)) || 1));
  const [taille, setTaille] = useState(() => Math.min(3, Math.max(0, Number(memoire.lire("libre-taille") ?? 1))));
  const { data, error, isLoading, refetch } = useQuery<PageTexteLibreDto>({ queryKey: [`/api/libres/${id}/texte?page=${page}`], staleTime: Infinity, retry: 1 });
  const haut = useRef<HTMLDivElement>(null);

  useEffect(() => memoire.ecrire(clePage, String(page)), [clePage, page]);
  useEffect(() => memoire.ecrire("libre-taille", String(taille)), [taille]);

  const aller = (p: number) => {
    setPage(p);
    haut.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  if (isLoading) return <Chargement lignes={6} />;
  if (error || !data) return <Erreur message={(error as Error)?.message ?? "Texte indisponible."} reessayer={() => void refetch()} />;
  const navigation = (
    <div className="flex items-center justify-between gap-2">
      <Bouton variante="contour" taille="sm" icone={<ChevronLeft className="h-4 w-4" />} disabled={data.page <= 1} onClick={() => aller(data.page - 1)}>
        Précédente
      </Bouton>
      <label className="flex items-center gap-1.5 font-mono text-sm text-texte-gris">
        Page
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={data.total}
          defaultValue={data.page}
          key={data.page}
          onKeyDown={(e) => {
            if (e.key === "Enter") aller(Math.min(data.total, Math.max(1, Number((e.target as HTMLInputElement).value) || 1)));
          }}
          onBlur={(e) => {
            const v = Math.min(data.total, Math.max(1, Number(e.target.value) || 1));
            if (v !== data.page) aller(v);
          }}
          className="w-16 rounded-lg border border-ligne bg-white px-2 py-1 text-center text-encre"
          aria-label="Aller à la page"
        />
        / {data.total}
      </label>
      <Bouton variante="contour" taille="sm" icone={<ChevronRight className="h-4 w-4" />} disabled={data.page >= data.total} onClick={() => aller(data.page + 1)}>
        Suivante
      </Bouton>
    </div>
  );
  return (
    <div ref={haut} className="flex scroll-mt-24 flex-col gap-3">
      {navigation}
      <Carte className="px-5 py-5 sm:px-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">
            <ScanLine className="h-3.5 w-3.5" aria-hidden /> Vers {Math.round(((data.page - 1) / Math.max(1, data.total)) * 100)} % du livre
          </span>
          <span className="flex items-center gap-1">
            <button type="button" onClick={() => setTaille((t) => Math.max(0, t - 1))} disabled={taille === 0} className="flex h-9 w-9 items-center justify-center rounded-lg border border-ligne disabled:opacity-40" aria-label="Texte plus petit">
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" onClick={() => setTaille((t) => Math.min(3, t + 1))} disabled={taille === 3} className="flex h-9 w-9 items-center justify-center rounded-lg border border-ligne disabled:opacity-40" aria-label="Texte plus grand">
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </span>
        </div>
        <div className={cn("whitespace-pre-wrap break-words font-serif leading-relaxed text-encre", TAILLES_TEXTE[taille])}>{data.contenu}</div>
      </Carte>
      {navigation}
    </div>
  );
}

/** Lecteur intégré à la page d'un livre de la bibliothèque (copie trouvée dans l'index). */
export function LecteurDepuisIndex({ libreId, etudiant }: { libreId: number; etudiant: boolean }) {
  const { data, error, isLoading, refetch } = useQuery<DetailLibreDto>({ queryKey: [`/api/libres/${libreId}`], staleTime: 10 * 60_000 });
  if (isLoading) return <Chargement lignes={4} />;
  if (error || !data) return <Erreur message={(error as Error)?.message ?? "Lecteur indisponible."} reessayer={() => void refetch()} />;
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-2 text-[15px] text-texte-pale">
        <Globe className="h-4 w-4 text-orange-fonce" aria-hidden />
        {etudiant ? "Ce livre est libre : lis-le ici, en entier et gratuitement." : "Ce livre est libre : lecture intégrale et gratuite ici."}{" "}
        <Link href={`/bibliotheque/libres/${libreId}`}>{etudiant ? "Ouvrir dans les bibliothèques libres" : "Ouvrir dans les bibliothèques libres"}</Link>
      </p>
      <LecteurLibre livre={data.livre} etudiant={etudiant} />
    </div>
  );
}
