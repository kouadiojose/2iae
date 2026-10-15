// /enseigner/mon-cours/:coursId/documents — « Mes documents » (José, 15 octobre 2026 : « rajouter mes documents »).
// Trois gros blocs : « Ajouter un PowerPoint » et « Ajouter une vidéo » (les mêmes que « Préparer le cours » et le
// Studio : BlocsAjouts de modules/live/ajouts.tsx, glisser-déposer, progression, fichier ou YouTube, « La projeter
// maintenant » en direct), et « Ajouter un document » (fichier ou lien) ; ils se rangent dans la séance du moment
// (celle de l'accueil : en direct, sinon la prochaine), puis « Déjà prêt pour ce cours ». Aucune route nouvelle :
// POST /api/seances/:id/diapos, …/ressources (lien), …/ressources/fichiers, DELETE …/ressources/:rid.
// Sans séance : on renvoie au mur du cours (ses fichiers ne dépendent pas de l'emploi du temps). En bas, « Mes documents
// des cours passés » (GET /api/enseigner/mon-cours/:id/documents-passes) : rien ne disparaît après le cours, et un
// document se remet dans le prochain cours d'un toucher (« Réutiliser »).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, FileText, Film, Link2, Loader2, PlayCircle, Presentation, RotateCcw, Upload, X } from "lucide-react";
import { Page } from "@/components/layout/coquille";
import { BandeauCours, GrosBloc, GrosBouton, RetourGros } from "@/components/ui/gros-blocs";
import { toast } from "@/components/ui/toast";
import { post, suppr } from "@/lib/api";
import { heure, jourLong } from "@/lib/dates";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { t as tProf } from "@shared/textes/espace-prof";
import type { RessourceSeanceDto, SeanceDetailDto } from "@shared/schema";
import type { DocumentsPassesDto } from "@shared/espace-prof";
import { poids } from "@shared/mur";
import { BlocsAjouts } from "@/modules/live/ajouts";
import { useAccueilSimple } from "./simple/blocs";
import { cleResumeCours, useResumeCours } from "./simple/blocs-cours";

/** Envoi avec barre de progression (les vidéos pèsent lourd en 4G). */
function envoyerAvecProgression(url: string, donnees: FormData, surProgression: (part: number) => void): Promise<void> {
  return new Promise((ok, ko) => {
    const x = new XMLHttpRequest();
    x.open("POST", url);
    x.withCredentials = true;
    x.upload.onprogress = (e) => e.lengthComputable && surProgression(e.loaded / e.total);
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) return ok();
      let message = "L'envoi n'a pas abouti. Réessayez.";
      try {
        message = (JSON.parse(x.responseText) as { message?: string }).message ?? message;
      } catch {
        /* réponse non JSON */
      }
      ko(new Error(message));
    };
    x.onerror = () => ko(new Error("Pas de connexion internet pour le moment. Réessayez."));
    x.send(donnees);
  });
}

/** « 8h30 » comme les blocs (et pas « 08h30 »). */
const heureSimple = (x: string) => heure(x).replace(/^0(\d)/, "$1");

/** Sous-titre d'une ressource : son poids (fichier), sinon son adresse lisible (« fr.wikipedia.org/wiki/Comptabilité »). */
function sousTitre(r: RessourceSeanceDto): string {
  if (r.taille) return poids(r.taille);
  let adresse = r.url;
  try {
    adresse = decodeURI(r.url);
  } catch {
    /* adresse mal encodée : telle quelle */
  }
  return adresse.replace(/^https?:\/\/(www\.)?/, "").slice(0, 80);
}

export const cleDocumentsPasses = (coursId: number) => `/api/enseigner/mon-cours/${coursId}/documents-passes`;

const ACCEPT_DOC = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.zip,image/*";


export default function PageDocuments({ coursId }: { coursId: string }) {
  const tx = useTextes(tProf);
  const id = Number(coursId);
  const accueil = useAccueilSimple();
  const c = accueil.data?.cours.find((x) => x.coursId === id);
  const { data: resume } = useResumeCours(id);
  const seanceId = c?.seance?.id ?? null;
  const seance = useQuery<SeanceDetailDto>({ queryKey: [`/api/seances/${seanceId}`], enabled: Boolean(seanceId), staleTime: 5_000 });
  const [feuille, setFeuille] = useState(false);
  const [envoi, setEnvoi] = useState<null | { part: number }>(null);
  const [aRetirer, setARetirer] = useState<RessourceSeanceDto | null>(null);

  const apres = async () => {
    await rafraichir(`/api/seances/${seanceId}`, cleResumeCours(id), "/api/enseigner/accueil-simple", cleDocumentsPasses(id));
  };
  const deposerFichiers = async (liste: FileList | null) => {
    if (!liste?.length || !seanceId) return;
    setEnvoi({ part: 0 });
    try {
      const donnees = new FormData();
      for (const f of Array.from(liste).slice(0, 10)) donnees.append("fichiers", f, f.name);
      await envoyerAvecProgression(`/api/seances/${seanceId}/ressources/fichiers`, donnees, (part) => setEnvoi({ part }));
      toast(tx("documents.ok"));
      setFeuille(false);
      await apres();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "erreur");
    } finally {
      setEnvoi(null);
    }
  };
  const ajouterLien = async (url: string) => {
    if (!seanceId) return;
    await post(`/api/seances/${seanceId}/ressources`, { url });
    toast(tx("documents.ok"));
    setFeuille(false);
    await apres();
  };
  // Un PowerPoint ou une vidéo ajoutés par les gros boutons (BlocsAjouts relit la séance) : le compte du bloc « Mes
  // documents » et l'accueil suivent.
  const nbPrets = seance.data ? seance.data.diapos.length + seance.data.ressources.length : null;
  const nbAvant = useRef<number | null>(null);
  useEffect(() => {
    if (nbPrets === null) return;
    if (nbAvant.current !== null && nbAvant.current !== nbPrets) void rafraichir(cleResumeCours(id), "/api/enseigner/accueil-simple");
    nbAvant.current = nbPrets;
  }, [nbPrets, id]);
  const retirer = async (r: RessourceSeanceDto) => {
    try {
      await suppr(`/api/seances/${seanceId}/ressources/${r.id}`);
      await apres();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "erreur");
    } finally {
      setARetirer(null);
    }
  };

  const titreCours = c?.titre ?? "";
  const s = seance.data;
  const pour = c?.seance
    ? c.repere === "direct" || c.repere === "ouvert" || c.repere === "aujourdhui"
      ? tx("documents.pour.aujourdhui", { v: { heure: heureSimple(c.seance.debut) } })
      : tx("documents.pour.jour", { v: { jour: jourLong(c.seance.debut), heure: heureSimple(c.seance.debut) } })
    : null;

  return (
    <Page className="gap-6 sm:gap-8">
      <RetourGros href={`/enseigner/mon-cours/${id}`}>{tx("documents.retour")}</RetourGros>
      <BandeauCours couleur={c?.couleur ?? "#E4793A"} etiquette={titreCours} titre={tx("documents.titre")} />
      {accueil.isLoading ? (
        <p className="text-[22px] font-bold text-texte-doux" aria-busy="true">
          …
        </p>
      ) : !c?.seance ? (
        <section className="flex flex-col items-start gap-4 rounded-[26px] border-2 border-ligne bg-white p-6 shadow-carte sm:p-8" data-sans-seance>
          <p className="text-[28px] font-black">{tx("documents.aucun.titre")}</p>
          <p className="max-w-2xl text-[20px] text-texte-doux">{tx("documents.aucun.texte")}</p>
          <GrosBouton href={`/enseigner/mon-cours/${id}/mur`}>{tx("documents.aucun.bouton")}</GrosBouton>
        </section>
      ) : (
        <>
          <p className="text-[22px] font-bold">
            {pour}
            {resume?.intervenant ? ` · ${tx("blocs.live.coursDe", { v: { nom: resume.intervenant } })}` : ""}
          </p>
          {c.seance.statut === "en_direct" && (
            // Classe ouverte en avance (« Salle ouverte · début à 16h00 ») : pas « en direct » avant l'heure du cours.
            <p className="rounded-[18px] bg-[#E7F5EE] px-5 py-3 text-[19px] font-bold text-[#145F3F]">{tx(c.repere === "ouvert" ? "documents.ouvert" : "documents.direct")}</p>
          )}
          {s ? <BlocsAjouts seance={s} variante="preparation" /> : <p className="text-[20px] font-bold text-texte-doux" aria-busy="true">…</p>}
          <GrosBloc
            testId="document"
            icone={<FileText className="h-8 w-8" strokeWidth={2.25} />}
            cercle={{ fond: "#EAF1FE", couleur: "#1D4ED8" }}
            titre={tx("documents.doc")}
            sousTitre={tx("documents.doc.texte")}
            onClick={envoi ? undefined : () => setFeuille(true)}
          />
          {feuille && <FeuilleAjout envoi={envoi ? envoi.part : null} onFermer={() => setFeuille(false)} onFichiers={(l) => void deposerFichiers(l)} onLien={ajouterLien} />}

          <section className="flex flex-col gap-3" data-deja-pret>
            <h2 className="font-sans text-[26px] font-black">{tx("documents.deja")}</h2>
            {s && (
              <div className="flex min-h-[88px] items-center gap-4 rounded-[22px] border-2 border-ligne bg-white p-4 shadow-carte">
                {s.diapos[0] ? (
                  <img src={s.diapos[0].url} alt="" className="h-16 w-24 shrink-0 rounded-[10px] border border-ligne object-cover" loading="lazy" />
                ) : (
                  <span className="grid h-16 w-24 shrink-0 place-items-center rounded-[10px] bg-orange-clair text-orange-profond" aria-hidden>
                    <Presentation className="h-7 w-7" />
                  </span>
                )}
                <span className="flex-1 text-[19px] font-bold" data-nb-diapos={s.diapos.length}>
                  {s.diapos.length === 0 ? tx("documents.diapos.aucune") : s.diapos.length === 1 ? tx("documents.diapos.un") : tx("documents.diapos", { v: { n: s.diapos.length } })}
                </span>
                {s.diapos.length > 0 && (
                  <a href={`/enseigner/seances/${s.id}`} className="inline-flex min-h-[48px] items-center rounded-[14px] border-2 border-encre px-4 text-[17px] font-bold text-encre no-underline">
                    {tx("documents.voirDiapos")}
                  </a>
                )}
              </div>
            )}
            {s?.ressources.map((r) => (
              <div key={r.id} className="flex min-h-[72px] flex-col gap-3 rounded-[22px] border-2 border-ligne bg-white p-4 shadow-carte sm:flex-row sm:items-center" data-ressource={r.id}>
                <LigneRessource r={r} />
                {aRetirer?.id === r.id ? (
                  <span className="flex w-full flex-col gap-2 rounded-[16px] bg-danger-clair p-3 sm:w-auto sm:flex-row sm:items-center">
                    <span className="text-[16px] font-bold text-[#7A2E0E]">{tx("documents.retirer.titre", { v: { titre: r.titre || r.nom || "" } })}</span>
                    <button type="button" onClick={() => void retirer(r)} className="min-h-[44px] rounded-[12px] bg-[#B42318] px-4 text-[16px] font-black text-white">
                      {tx("documents.retirer.oui")}
                    </button>
                    <button type="button" onClick={() => setARetirer(null)} className="min-h-[44px] rounded-[12px] border-2 border-encre bg-white px-4 text-[16px] font-bold">
                      {tx("documents.retirer.non")}
                    </button>
                  </span>
                ) : (
                  <span className="flex w-full gap-2 sm:w-auto">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[14px] bg-encre px-4 text-[16px] font-bold text-white no-underline hover:bg-orange hover:text-encre sm:flex-none">
                      {tx("documents.ouvrir")}
                    </a>
                    <button type="button" onClick={() => setARetirer(r)} className="min-h-[48px] rounded-[14px] px-3 text-[16px] font-bold text-[#B42318]">
                      {tx("documents.retirer")}
                    </button>
                  </span>
                )}
              </div>
            ))}
            {s && !s.diapos.length && !s.ressources.length && <p className="text-[19px] text-texte-doux">{tx("documents.vide")}</p>}
            <a href={`/enseigner/seances/${c.seance.id}`} className="inline-flex min-h-[48px] items-center self-start text-[18px] font-bold text-orange-profond underline underline-offset-4">
              {tx("documents.detail")}
            </a>
          </section>
        </>
      )}
      {!accueil.isLoading && <DocumentsPasses coursId={id} />}
    </Page>
  );
}

/** Icône, nom (trois lignes au plus, coupé entre les lettres s'il le faut : jamais « C… » sur téléphone) et poids ou adresse. */
function LigneRessource({ r }: { r: RessourceSeanceDto }) {
  const nom = r.titre || r.nom || r.url;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <IconeRessource type={r.type} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-3 break-words text-[18px] font-bold leading-snug [overflow-wrap:anywhere]" title={nom} data-nom>
          {nom}
        </span>
        {sousTitre(r) !== nom && <span className="block break-words text-[15px] text-texte-doux [overflow-wrap:anywhere]">{sousTitre(r)}</span>}
      </span>
    </span>
  );
}

/** « Mes documents des cours passés » : par séance, les plus récentes d'abord ; « Ouvrir », « Réutiliser » (prochain cours). */
function DocumentsPasses({ coursId }: { coursId: number }) {
  const tx = useTextes(tProf);
  const { data } = useQuery<DocumentsPassesDto>({ queryKey: [cleDocumentsPasses(coursId)], staleTime: 10_000 });
  const [enCours, setEnCours] = useState<number | null>(null);
  const [faits, setFaits] = useState<Set<number>>(new Set());
  if (!data?.seances.length) return null;
  const reutiliser = async (r: RessourceSeanceDto) => {
    setEnCours(r.id);
    try {
      await post(`/api/enseigner/mon-cours/${coursId}/documents-passes/${r.id}/reutiliser`, {});
      setFaits(new Set([...faits, r.id]));
      toast(tx("documents.passes.reutilise"));
      await rafraichir(cleResumeCours(coursId), "/api/enseigner/accueil-simple", ...(data.prochaine ? [`/api/seances/${data.prochaine.id}`] : []));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "erreur");
    } finally {
      setEnCours(null);
    }
  };
  return (
    <section className="flex flex-col gap-4" data-documents-passes>
      <h2 className="font-sans text-[26px] font-black">{tx("documents.passes.titre")}</h2>
      {data.seances.map((s) => (
        <div key={s.id} className="flex flex-col gap-2" data-seance-passee={s.id}>
          <p className="text-[15px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
            {jourLong(s.debut)} · {heureSimple(s.debut)}
          </p>
          {s.diapos > 0 && (
            <div className="flex min-h-[72px] flex-col gap-3 rounded-[22px] border-2 border-ligne bg-white p-4 shadow-carte sm:flex-row sm:items-center">
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-orange-clair text-orange-profond" aria-hidden>
                  <Presentation className="h-6 w-6" />
                </span>
                <span className="text-[18px] font-bold">{tx(s.diapos === 1 ? "documents.passes.diapos.un" : "documents.passes.diapos.n", { v: { n: s.diapos } })}</span>
              </span>
              <a href={`/enseigner/seances/${s.id}`} className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] border-2 border-encre px-4 text-[16px] font-bold text-encre no-underline hover:bg-orange-pale">
                {tx("documents.voirDiapos")}
              </a>
            </div>
          )}
          {s.ressources.map((r) => (
            <div key={r.id} className="flex min-h-[72px] flex-col gap-3 rounded-[22px] border-2 border-ligne bg-white p-4 shadow-carte sm:flex-row sm:items-center" data-ressource-passee={r.id}>
              <LigneRessource r={r} />
              <span className="flex w-full gap-2 sm:w-auto">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[14px] bg-encre px-4 text-[16px] font-bold text-white no-underline hover:bg-orange hover:text-encre sm:flex-none">
                  {tx("documents.ouvrir")}
                </a>
                {data.prochaine &&
                  (faits.has(r.id) ? (
                    <span className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-1 px-3 text-[16px] font-bold text-[#145F3F] sm:flex-none">
                      <Check className="h-5 w-5" aria-hidden /> {tx("documents.passes.reutiliseOk")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void reutiliser(r)}
                      disabled={enCours === r.id}
                      title={tx("documents.passes.reutiliser.aide")}
                      aria-label={`${tx("documents.passes.reutiliser.aide")} : ${r.titre || r.nom || ""}`}
                      className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[14px] border-2 border-encre bg-white px-4 text-[16px] font-bold text-encre hover:bg-orange-pale disabled:opacity-60 sm:flex-none"
                      data-reutiliser={r.id}
                    >
                      {enCours === r.id ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <RotateCcw className="h-5 w-5" aria-hidden />}
                      {tx("documents.passes.reutiliser")}
                    </button>
                  ))}
              </span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function IconeRessource({ type }: { type: RessourceSeanceDto["type"] }) {
  const Icone = type === "youtube" ? PlayCircle : type === "video" ? Film : type === "lien" ? Link2 : FileText;
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-creme text-orange-profond" aria-hidden>
      <Icone className="h-6 w-6" />
    </span>
  );
}

/** Feuille « Ajouter un document » : un fichier de l'ordinateur, ou un lien collé. */
function FeuilleAjout({
  envoi,
  onFermer,
  onFichiers,
  onLien,
}: {
  envoi: number | null;
  onFermer: () => void;
  onFichiers: (l: FileList | null) => void;
  onLien: (url: string) => Promise<void>;
}) {
  const tx = useTextes(tProf);
  const [mode, setMode] = useState<null | "fichier" | "lien">(null);
  const [url, setUrl] = useState("");
  const [ajout, setAjout] = useState(false);
  const entree = useRef<HTMLInputElement>(null);
  const valider = async () => {
    if (!url.trim()) return;
    setAjout(true);
    try {
      await onLien(url.trim());
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "erreur");
    } finally {
      setAjout(false);
    }
  };
  const Choix = ({ icone, titre, texte, onClick }: { icone: ReactNode; titre: string; texte: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="flex min-h-[96px] w-full items-center gap-4 rounded-[22px] border-2 border-ligne bg-white p-5 text-left hover:border-orange">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-orange-clair text-orange-profond" aria-hidden>
        {icone}
      </span>
      <span>
        <span className="block text-[22px] font-black">{titre}</span>
        <span className="text-[18px] text-texte-doux">{texte}</span>
      </span>
    </button>
  );
  return (
    <section className="relative flex flex-col gap-4 rounded-[26px] border-2 border-orange bg-creme p-5 sm:p-7" data-feuille="document">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-sans text-[26px] font-black">{tx("documents.doc")}</h2>
        <button type="button" onClick={onFermer} className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-4 text-[17px] font-bold" aria-label={tx("documents.annuler")}>
          <X className="h-5 w-5" aria-hidden /> {tx("documents.annuler")}
        </button>
      </div>
      <input
        ref={entree}
        type="file"
        multiple
        accept={ACCEPT_DOC}
        className="sr-only"
        onChange={(e) => onFichiers(e.target.files)}
        data-entree-fichier
        aria-label={tx("documents.doc.fichier")}
      />
      {envoi !== null ? (
        <div className="flex flex-col gap-2" role="status">
          <p className="text-[19px] font-bold">{tx("documents.ppt.envoi", { v: { p: Math.round(envoi * 100) } })}</p>
          <div className="h-3 w-full overflow-hidden rounded-full bg-ligne">
            <div className="h-full bg-orange" style={{ width: `${Math.round(envoi * 100)}%` }} />
          </div>
        </div>
      ) : mode === "lien" ? (
        <div className="flex flex-col gap-3">
          <label className="text-[18px] font-bold" htmlFor="lien-document">
            {tx("documents.doc.lien.texte")}
          </label>
          <input
            id="lien-document"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={tx("documents.lien.champ")}
            className="min-h-[60px] w-full rounded-[16px] border-2 border-ligne bg-white px-4 text-[19px] outline-none focus:border-orange"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <GrosBouton onClick={() => void valider()} chargement={ajout} disabled={!url.trim()} icone={<Link2 className="h-6 w-6" aria-hidden />}>
              {tx("documents.lien.ajouter")}
            </GrosBouton>
            <GrosBouton ton="contour" onClick={() => setMode(null)}>
              {tx("examen.retour")}
            </GrosBouton>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Choix
            icone={<Upload className="h-7 w-7" />}
            titre={tx("documents.doc.fichier")}
            texte={tx("documents.doc.fichier.texte")}
            onClick={() => entree.current?.click()}
          />
          <Choix
            icone={<Link2 className="h-7 w-7" />}
            titre={tx("documents.doc.lien")}
            texte={tx("documents.doc.lien.texte")}
            onClick={() => setMode("lien")}
          />
        </div>
      )}
    </section>
  );
}
