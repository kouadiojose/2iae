// /mediatheque : la médiathèque des cours. Pour chaque cours que la personne
// peut consulter, les enregistrements des lives terminés et les documents
// (PDF) des leçons publiées. Un étudiant y trouve ses cours et ceux que
// l'école ouvre à tous. Pensé pour la 4G : la vidéo ne se charge que sur la
// page du replay, un PDF seulement quand on l'ouvre ou qu'on demande l'aperçu.
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { MonitorPlay, PlayCircle, FileText, Paperclip, Search, ExternalLink, Eye, EyeOff, Lock, Users, ArrowRight } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { cn, pluriel, taille } from "@/lib/utils";
import { dateCourte } from "@/lib/dates";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Badge, Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { Onglets } from "@/components/ui/onglets";
import { texteSur } from "@/modules/cours/outils";
import type { CoursMediathequeDto, DocumentMediathequeDto, EnregistrementMediathequeDto, MediathequeDto } from "@shared/schema";

type Filtre = "tous" | "mes";

/** Lignes montrées avant « Voir les autres ». */
const APERCU_LIGNES = 5;

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** « 1 h 45 », « 52 min ». */
function dureeLisible(secondes: number | null): string | null {
  if (!secondes) return null;
  const minutes = Math.max(1, Math.round(secondes / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

const estPdf = (d: DocumentMediathequeDto) => d.mime === "application/pdf" || (d.type === "pdf" && !d.mime);

/** Filtre un cours selon les mots cherchés : le cours entier s'il correspond, sinon ses seuls éléments qui correspondent. */
function filtrerCours(c: CoursMediathequeDto, mots: string[]): CoursMediathequeDto | null {
  if (!mots.length) return c;
  const correspond = (texte: string) => {
    const t = sansAccents(texte);
    return mots.every((m) => t.includes(m));
  };
  if (correspond(`${c.code} ${c.titre} ${c.formateur ?? ""}`)) return c;
  const enregistrements = c.enregistrements.filter((e) => correspond(`${e.titre} ${e.formateur ?? ""} ${c.code} ${c.titre}`));
  const documents = c.documents.filter((d) => correspond(`${d.numero} ${d.titre} ${d.chapitre} ${d.nom ?? ""} ${c.code} ${c.titre}`));
  return enregistrements.length || documents.length ? { ...c, enregistrements, documents } : null;
}

export default function PageMediatheque() {
  const moi = useMoiConnecte();
  const etudiant = moi.role === "etudiant";
  const { data, error, isLoading, refetch } = useQuery<MediathequeDto>({ queryKey: ["/api/mediatheque"] });
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");

  const tous = data?.cours ?? [];
  const nbMiens = tous.filter((c) => c.deMaClasse).length;
  // Le filtre n'a de sens que si la liste mêle mes cours et d'autres cours.
  const avecFiltre = nbMiens > 0 && nbMiens < tous.length;

  const liste = useMemo(() => {
    const mots = sansAccents(recherche.trim()).split(/\s+/).filter(Boolean);
    return tous
      .filter((c) => !avecFiltre || filtre === "tous" || c.deMaClasse)
      .map((c) => filtrerCours(c, mots))
      .filter((c): c is CoursMediathequeDto => c !== null);
  }, [tous, recherche, filtre, avecFiltre]);

  if (isLoading) return <Page className="max-w-5xl"><Chargement lignes={4} /></Page>;
  if (error || !data) return <Page className="max-w-5xl"><Erreur message={(error as Error)?.message ?? "Médiathèque indisponible."} reessayer={() => void refetch()} /></Page>;

  const nbEnregistrements = tous.reduce((n, c) => n + c.enregistrements.length, 0);
  const nbDocuments = tous.reduce((n, c) => n + c.documents.length, 0);

  return (
    <Page className="max-w-5xl gap-6">
      <EnTetePage
        etiquette="Enregistrements et documents"
        titre="Médiathèque des cours"
        sousTitre={
          etudiant
            ? "Revois les cours en vidéo et ouvre les supports PDF de tous les cours auxquels tu as accès, quand tu veux."
            : "Les enregistrements des lives et les documents PDF des cours. Chaque cours est ouvert à tous les étudiants ou réservé à ses classes : le réglage se fait sur la page du cours."
        }
      />

      {tous.length > 0 && (
        <div className="flex flex-col gap-3">
          <label className="relative">
            <span className="sr-only">Rechercher dans la médiathèque</span>
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" aria-hidden />
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Cours, séance, document ou formateur"
              className="min-h-12 w-full rounded-2xl border border-ligne bg-white pl-12 pr-4 text-base outline-none focus:border-orange"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {avecFiltre ? (
              <Onglets<Filtre>
                valeur={filtre}
                onChange={setFiltre}
                options={[
                  { valeur: "tous", libelle: "Tous les cours", compteur: tous.length },
                  { valeur: "mes", libelle: "Mes cours", compteur: nbMiens },
                ]}
                className="self-start"
              />
            ) : (
              <span />
            )}
            <span className="font-mono text-xs text-texte-gris">
              {pluriel(nbEnregistrements, "enregistrement")} · {pluriel(nbDocuments, "document")}
            </span>
          </div>
        </div>
      )}

      {!tous.length ? (
        <EtatVide
          icone={<MonitorPlay className="h-6 w-6" />}
          titre="La médiathèque est vide pour l'instant"
          texte={
            etudiant
              ? "Les enregistrements des lives et les supports PDF des cours arrivent ici dès qu'ils sont prêts. Tu recevras une notification pour chaque nouveau replay de tes cours."
              : "Les enregistrements des lives et les supports PDF des leçons publiées arrivent ici dès qu'ils sont prêts."
          }
        />
      ) : !liste.length ? (
        <p className="rounded-2xl bg-creme p-4 text-[15px] text-texte-pale">
          {etudiant ? "Rien ne correspond. Essaie un autre mot ou un autre filtre." : "Rien ne correspond. Essayez un autre mot ou un autre filtre."}
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {liste.map((c) => (
            <li key={c.id}>
              <CarteCours cours={c} etudiant={etudiant} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

function CarteCours({ cours: c, etudiant }: { cours: CoursMediathequeDto; etudiant: boolean }) {
  const clair = texteSur(c.couleur) === "encre";
  const pastille = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1 font-mono text-xs text-encre";
  return (
    <article className="overflow-hidden rounded-[24px] border border-ligne bg-white" aria-label={`${c.code} · ${c.titre}`}>
      <header className={cn("flex flex-wrap items-end justify-between gap-3 px-5 py-4 sm:px-6", clair ? "text-encre" : "text-white")} style={{ backgroundColor: c.couleur }}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-mono text-xs opacity-80">{c.code}</span>
          <h2 className="text-xl font-extrabold leading-tight sm:text-2xl">{c.titre}</h2>
          {c.formateur && <span className="text-sm opacity-85">{c.formateur}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {etudiant ? (
            c.deMaClasse ? (
              <span className={pastille}>Mon cours</span>
            ) : (
              <span className={pastille}>
                <Users className="h-3.5 w-3.5" aria-hidden /> Ouvert à tous les étudiants
              </span>
            )
          ) : (
            c.acces && (
              <span className={pastille}>
                {c.acces === "tous" ? <Users className="h-3.5 w-3.5" aria-hidden /> : <Lock className="h-3.5 w-3.5" aria-hidden />}
                {c.acces === "tous" ? "Ouverte à tous" : "Réservée aux classes"}
              </span>
            )
          )}
          {(c.deMaClasse || !etudiant) && (
            <LienBouton href={`/cours/${c.id}`} taille="sm" variante={clair ? "encre" : "contour"} icone={<ArrowRight className="h-4 w-4" />}>
              Voir le cours
            </LienBouton>
          )}
        </div>
      </header>
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
        <ListeEnregistrements elements={c.enregistrements} etudiant={etudiant} />
        <ListeDocuments elements={c.documents} etudiant={etudiant} />
      </div>
    </article>
  );
}

function TitreListe({ icone, titre, nombre }: { icone: ReactNode; titre: string; nombre: number }) {
  return (
    <h3 className="flex items-center gap-2 text-base font-extrabold">
      <span className="text-orange-fonce">{icone}</span>
      {titre}
      {nombre > 0 && <span className="rounded-full bg-creme px-2 font-mono text-xs text-texte-doux">{nombre}</span>}
    </h3>
  );
}

function VoirPlus({ reste, ouvert, onClick }: { reste: number; ouvert: boolean; onClick: () => void }) {
  if (reste <= 0) return null;
  return (
    <button type="button" onClick={onClick} className="self-start text-sm font-bold text-orange-fonce underline underline-offset-2 hover:text-encre">
      {ouvert ? "Voir moins" : `Voir ${reste > 1 ? `les ${reste} autres` : "l'autre"}`}
    </button>
  );
}

function ListeEnregistrements({ elements, etudiant }: { elements: EnregistrementMediathequeDto[]; etudiant: boolean }) {
  const [tout, setTout] = useState(false);
  const visibles = tout ? elements : elements.slice(0, APERCU_LIGNES);
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <TitreListe icone={<PlayCircle className="h-5 w-5" aria-hidden />} titre="Enregistrements" nombre={elements.length} />
      {!elements.length ? (
        <p className="rounded-2xl bg-creme px-4 py-3 text-sm text-texte-pale">Pas encore d'enregistrement pour ce cours.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((e) => {
            const duree = dureeLisible(e.dureeSecondes);
            return (
              <li key={e.seanceId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-ligne-douce px-3.5 py-3">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", e.nouveau ? "bg-orange text-encre" : "bg-creme text-orange-fonce")}>
                  <PlayCircle className="h-5 w-5" aria-hidden />
                </span>
                <span className="flex min-w-[11rem] flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 font-bold leading-snug">{e.titre}</span>
                    {e.nouveau && <Badge ton="orange">Nouveau</Badge>}
                    {e.vu && <Badge ton="gris">Vu</Badge>}
                  </span>
                  <span className="font-mono text-xs text-texte-gris">
                    {dateCourte(e.debut)}
                    {duree ? ` · ${duree}` : ""}
                    {e.formateur ? ` · ${e.formateur}` : ""}
                  </span>
                </span>
                <LienBouton href={e.lien} taille="sm" variante="encre" icone={<PlayCircle className="h-4 w-4" />} className="min-h-10 shrink-0 max-sm:ml-[52px]">
                  Regarder
                </LienBouton>
              </li>
            );
          })}
        </ul>
      )}
      <VoirPlus reste={elements.length - APERCU_LIGNES} ouvert={tout} onClick={() => setTout((v) => !v)} />
      {elements.length > 0 && (
        <p className="text-[13px] text-texte-gris">
          {etudiant
            ? "La vidéo ne se charge que si tu la demandes : la fiche de révision et la transcription coûtent presque rien en données."
            : "La vidéo ne se charge qu'à la demande : fiche de révision et transcription d'abord."}
        </p>
      )}
    </section>
  );
}

function ListeDocuments({ elements, etudiant }: { elements: DocumentMediathequeDto[]; etudiant: boolean }) {
  const [tout, setTout] = useState(false);
  const [apercu, setApercu] = useState<number | null>(null);
  const visibles = tout ? elements : elements.slice(0, APERCU_LIGNES);
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <TitreListe icone={<FileText className="h-5 w-5" aria-hidden />} titre="Documents (PDF)" nombre={elements.length} />
      {!elements.length ? (
        <p className="rounded-2xl bg-creme px-4 py-3 text-sm text-texte-pale">Pas encore de document pour ce cours.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((d) => {
            const pdf = estPdf(d);
            const Icone = pdf ? FileText : Paperclip;
            const ouvert = apercu === d.leconId;
            const extension = d.nom?.includes(".") ? d.nom.split(".").pop()!.toUpperCase() : "Fichier";
            return (
              <li key={d.leconId} className="overflow-hidden rounded-2xl border border-ligne-douce">
                <div className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-clair text-orange-fonce">
                    <Icone className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="flex min-w-[11rem] flex-1 flex-col gap-0.5">
                    <span className="font-bold leading-snug">
                      {d.numero && <span className="mr-1.5 font-mono text-sm font-normal text-texte-gris">{d.numero}</span>}
                      {d.titre}
                    </span>
                    <span className="truncate font-mono text-xs text-texte-gris">
                      {d.chapitre ? `${d.chapitre} · ` : ""}
                      {pdf ? "PDF" : extension}
                      {d.taille ? ` · ${taille(d.taille)}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap gap-2 max-sm:w-full max-sm:pl-[52px]">
                    {pdf && (
                      <Bouton
                        taille="sm"
                        variante="doux"
                        icone={ouvert ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        onClick={() => setApercu(ouvert ? null : d.leconId)}
                        aria-expanded={ouvert}
                        className="min-h-10"
                      >
                        {ouvert ? "Fermer" : "Aperçu"}
                      </Bouton>
                    )}
                    <LienBouton href={d.url} externe taille="sm" variante="contour" icone={<ExternalLink className="h-4 w-4" />} className="min-h-10">
                      Ouvrir
                    </LienBouton>
                  </span>
                </div>
                {ouvert && (
                  <iframe src={d.url} title={`Aperçu : ${d.titre}`} className="block h-[70vh] min-h-[420px] w-full border-t border-ligne-douce bg-creme" />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <VoirPlus reste={elements.length - APERCU_LIGNES} ouvert={tout} onClick={() => setTout((v) => !v)} />
      {elements.length > 0 && (
        <p className="text-[13px] text-texte-gris">
          {etudiant ? "« Ouvrir » affiche le document dans un nouvel onglet, d'où tu peux aussi le télécharger." : "« Ouvrir » affiche le document dans un nouvel onglet."}
        </p>
      )}
    </section>
  );
}
