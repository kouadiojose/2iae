// Le mur du cours (José, 15 octobre 2026 : « un blog pour poster mes liens, mes fichiers ») : composant partagé par le
// professeur (écrire + fil), l'étudiant (fil, tutoiement), l'équipe (fil) et l'espace du campus (fil en grand, lecture
// seule). Texte brut : les liens collés deviennent cliquables (decouperTexte, comme au serveur), rien n'est intégré
// (aucune vidéo ni vignette chargée d'un autre site). Temps réel : canal mur:<coursId>.
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Film, Image as IconeImage, Link2, Loader2, Paperclip, PlayCircle, Send, Trash2, Users, X } from "lucide-react";
import { useMoi } from "@/lib/auth";
import { api, alleger, ErreurApi, suppr } from "@/lib/api";
import { envoyerOuMettreEnFile } from "@/lib/file-envoi";
import { useCanal } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { relatif, dateEtHeure } from "@/lib/dates";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/divers";
import { decouperTexte, poids, MUR_FICHIERS_MAX, MUR_FICHIER_MO, MUR_TEXTE_MAX, type MurDto, type PublicationDto } from "@shared/mur";
import { t as tMur } from "@shared/textes/mur";

export type VarianteMur = "professeur" | "etudiant" | "equipe" | "campus";

/** Adresse de l'API du mur selon la variante (l'espace du campus lit par /api/mon-campus, avec ?site= en aperçu). */
export function urlMur(coursId: number, variante: VarianteMur): string {
  if (variante !== "campus") return `/api/cours/${coursId}/mur`;
  const site = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("site");
  return `/api/mon-campus/cours/${coursId}/mur${site && /^\d+$/.test(site) ? `?site=${site}` : ""}`;
}

const cleBrouillon = (coursId: number) => `campus:mur:brouillon:${coursId}`;
const lireLocal = (cle: string) => {
  try {
    return window.localStorage.getItem(cle) ?? "";
  } catch {
    return "";
  }
};
const ecrireLocal = (cle: string, v: string) => {
  try {
    if (v) window.localStorage.setItem(cle, v);
    else window.localStorage.removeItem(cle);
  } catch {
    /* navigation privée : pas de brouillon */
  }
};

export function MurDuCours({ coursId, variante }: { coursId: number; variante: VarianteMur }) {
  const tx = useTextes(tMur);
  const url = urlMur(coursId, variante);
  const { data, error, isLoading, refetch } = useQuery<MurDto>({ queryKey: [url], staleTime: 10_000 });
  const [anciennes, setAnciennes] = useState<PublicationDto[]>([]);
  const [suite, setSuite] = useState<number | null | undefined>(undefined);
  const [chargePlus, setChargePlus] = useState(false);
  useCanal(`mur:${coursId}`, () => {
    void rafraichir(url.split("?")[0], `/api/cours/${coursId}`);
  });
  const grand = variante === "campus";
  if (isLoading)
    return (
      <p className="text-[20px] font-bold text-texte-doux" aria-busy="true">
        {tx("chargement")}
      </p>
    );
  if (error || !data)
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[20px] font-bold">{error instanceof ErreurApi ? error.message : tx("erreur.chargement")}</p>
        <button type="button" onClick={() => void refetch()} className="min-h-[56px] rounded-[18px] bg-orange px-6 text-[18px] font-black text-encre">
          Réessayer
        </button>
      </div>
    );
  const suivante = suite === undefined ? data.suite : suite;
  const vues = new Set(data.publications.map((p) => p.id));
  const liste = [...data.publications, ...anciennes.filter((p) => !vues.has(p.id))];
  const plus = async () => {
    if (!suivante) return;
    setChargePlus(true);
    try {
      const page = await api<MurDto>(`${url}${url.includes("?") ? "&" : "?"}avant=${suivante}`);
      setAnciennes((a) => [...a, ...page.publications]);
      setSuite(page.suite);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "erreur");
    } finally {
      setChargePlus(false);
    }
  };
  return (
    <div className="flex flex-col gap-5" data-mur={coursId}>
      {data.peutPublier && variante !== "campus" && <EcrireSurLeMur coursId={coursId} mur={data} />}
      {variante === "etudiant" && <p className="text-[17px] text-texte-doux">{tx("question")}</p>}
      <div aria-live="polite" className="flex flex-col gap-4">
        {!liste.length ? (
          <p className={cn("rounded-[24px] border-2 border-dashed border-ligne bg-white px-6 py-8 font-bold text-texte-doux", grand ? "text-[22px]" : "text-[19px]")} data-mur-vide>
            {variante === "professeur" ? tx("vide.professeur") : tx("vide.lecteur")}
          </p>
        ) : (
          liste.map((p) => <CartePublication key={p.id} p={p} coursId={coursId} grand={grand} url={url} />)
        )}
      </div>
      {suivante ? (
        <button type="button" onClick={() => void plus()} disabled={chargePlus} className="min-h-[56px] self-center rounded-full border-2 border-ligne bg-white px-6 text-[18px] font-bold hover:border-orange">
          {chargePlus ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : tx("plus")}
        </button>
      ) : null}
    </div>
  );
}

/** Écrire un message : texte (liens collés), jusqu'à 5 fichiers, envoi par la file hors ligne (jamais deux fois). */
function EcrireSurLeMur({ coursId, mur }: { coursId: number; mur: MurDto }) {
  const tx = useTextes(tMur);
  const [texte, setTexte] = useState(() => lireLocal(cleBrouillon(coursId)));
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const entree = useRef<HTMLInputElement>(null);
  const changer = (v: string) => {
    setTexte(v);
    ecrireLocal(cleBrouillon(coursId), v);
  };
  const ajouter = async (liste: FileList | null) => {
    if (!liste?.length) return;
    setErreur(null);
    const nouveaux: File[] = [];
    for (const f of Array.from(liste)) {
      if (f.size > MUR_FICHIER_MO * 1024 * 1024) {
        setErreur(tx("fichier.lourd", { v: { nom: f.name, taille: poids(f.size) } }));
        continue;
      }
      nouveaux.push(await alleger(f));
    }
    const tous = [...fichiers, ...nouveaux];
    if (tous.length > MUR_FICHIERS_MAX) setErreur(tx("fichier.max"));
    setFichiers(tous.slice(0, MUR_FICHIERS_MAX));
    if (entree.current) entree.current.value = "";
  };
  const vide = !texte.trim() && !fichiers.length;
  const trop = texte.length > MUR_TEXTE_MAX;
  const publier = async () => {
    if (vide || trop || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const cle = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const r = await envoyerOuMettreEnFile({
        cle: `mur-${cle}`,
        description: `Le mur du cours · ${mur.cours.titre}`,
        url: `/api/cours/${coursId}/mur`,
        methode: "POST",
        corps: { texte, cle: cle.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) },
        fichiers,
        usageFichiers: "mur",
        champFichiers: "fichierIds",
      });
      setTexte("");
      setFichiers([]);
      ecrireLocal(cleBrouillon(coursId), "");
      if (r.statut === "en_file") toast(tx("enFile"), "info");
      else toast(tx("publie"));
      await rafraichir(`/api/cours/${coursId}`, "/api/enseigner/mon-cours");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnvoi(false);
    }
  };
  const lecteurs = mur.cours.statut === "brouillon" ? tx("brouillon") : mur.lecteurs ? tx("lecteurs", { v: { classes: mur.lecteurs } }) : tx("lecteurs.aucun");
  return (
    <section className="rounded-[26px] border-2 border-ligne bg-creme p-5 shadow-carte sm:p-6" data-ecrire-mur>
      <h2 className="font-mono text-[14px] font-semibold uppercase tracking-[0.14em] text-orange-profond">{tx("ecrire.titre")}</h2>
      <label className="sr-only" htmlFor={`mur-texte-${coursId}`}>
        {tx("ecrire.champ")}
      </label>
      <textarea
        id={`mur-texte-${coursId}`}
        value={texte}
        onChange={(e) => changer(e.target.value)}
        rows={4}
        placeholder={tx("ecrire.champ")}
        className="mt-3 min-h-[140px] w-full resize-y rounded-[18px] border-2 border-ligne bg-white px-4 py-3 text-[20px] leading-relaxed text-encre outline-none placeholder:text-texte-gris focus:border-orange focus:ring-4 focus:ring-orange/20"
      />
      {fichiers.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {fichiers.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex min-h-[56px] flex-wrap items-center gap-x-3 gap-y-1 rounded-[16px] border border-ligne bg-white px-4 py-2">
              <IconeFichier mime={f.type} />
              <span className="line-clamp-3 min-w-0 flex-1 basis-[160px] break-words text-[17px] font-bold leading-snug [overflow-wrap:anywhere]" title={f.name}>
                {f.name}
              </span>
              <span className="text-[15px] text-texte-doux">{poids(f.size)}</span>
              <button type="button" onClick={() => setFichiers(fichiers.filter((_, j) => j !== i))} className="flex min-h-[44px] items-center gap-1 px-2 text-[16px] font-bold text-[#B42318]">
                <X className="h-4 w-4" aria-hidden /> {tx("fichier.retirer")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {erreur && (
        <p role="alert" className="mt-3 rounded-[14px] bg-danger-clair px-4 py-3 text-[17px] font-semibold text-[#9A3412]">
          {erreur}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input ref={entree} type="file" multiple className="sr-only" onChange={(e) => void ajouter(e.target.files)} data-mur-fichier aria-label={tx("fichier")} />
        <button
          type="button"
          onClick={() => entree.current?.click()}
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] border-2 border-encre bg-white px-5 text-[18px] font-bold text-encre hover:bg-orange-pale"
        >
          <Paperclip className="h-5 w-5" aria-hidden /> {tx("fichier")}
        </button>
        <span className={cn("text-[15px] sm:ml-auto", trop ? "font-bold text-[#B42318]" : "text-texte-doux")}>{tx("compteur", { v: { n: texte.length } })}</span>
        <button
          type="button"
          onClick={() => void publier()}
          disabled={vide || trop || envoi}
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] bg-orange px-7 text-[19px] font-black text-encre hover:bg-encre hover:text-white disabled:opacity-50"
          data-publier
        >
          {envoi ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
          {envoi ? tx("envoi") : tx("publier")}
        </button>
      </div>
      <p className="mt-3 flex items-start gap-2 text-[16px] text-texte-doux">
        <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {lecteurs}
      </p>
    </section>
  );
}

function IconeFichier({ mime }: { mime: string }) {
  const Icone = /^image\//.test(mime) ? IconeImage : /^video\//.test(mime) ? Film : FileText;
  return <Icone className="h-6 w-6 shrink-0 text-orange-profond" aria-hidden />;
}

/** Un message du mur : auteur, texte (liens cliquables), cartes des liens, fichiers, « Supprimer » (confirmé). */
function CartePublication({ p, coursId, grand, url }: { p: PublicationDto; coursId: number; grand: boolean; url: string }) {
  const tx = useTextes(tMur);
  const { moi } = useMoi();
  const reduites = Boolean(moi?.preferences?.donneesReduites);
  const [confirmer, setConfirmer] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [imagesVues, setImagesVues] = useState<Set<number>>(new Set());
  const supprimer = async () => {
    setSuppression(true);
    try {
      await suppr(`/api/cours/${coursId}/mur/${p.id}`);
      toast(tx("supprimer.fait"));
      await rafraichir(url.split("?")[0], `/api/cours/${coursId}`, "/api/enseigner/mon-cours");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "erreur");
    } finally {
      setSuppression(false);
      setConfirmer(false);
    }
  };
  return (
    <article className="rounded-[24px] border-2 border-ligne bg-white p-5 shadow-carte sm:p-6" data-publication={p.id}>
      <header className="flex items-center gap-3">
        <Avatar prenom={p.auteur.nom.split(" ")[0]} nom={p.auteur.nom.split(" ").slice(1).join(" ")} photo={p.auteur.photoUrl} taille={48} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-[18px] font-extrabold leading-tight [overflow-wrap:anywhere]" data-auteur>
            {p.auteur.nom}
          </p>
          <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-orange-profond">{tx(p.auteur.etiquette === "direction" ? "etiquette.direction" : "etiquette.professeur")}</p>
        </div>
        <time className="shrink-0 text-[15px] text-texte-doux" dateTime={p.creeLe} title={dateEtHeure(p.creeLe)}>
          {relatif(p.creeLe)}
        </time>
      </header>
      {p.texte && (
        <p className={cn("mt-4 whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]", grand ? "text-[20px]" : "text-[18px]")}>
          {decouperTexte(p.texte).map((m, i) =>
            m.type === "texte" ? (
              <span key={i}>{m.valeur}</span>
            ) : (
              <a key={i} href={m.url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-orange-profond underline underline-offset-2">
                {m.affiche}
              </a>
            ),
          )}
        </p>
      )}
      {p.liens.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {p.liens.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="flex min-h-[64px] items-center gap-3 rounded-[18px] border border-ligne bg-creme p-3 text-encre no-underline hover:border-orange" data-lien-mur>
                <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", l.youtubeId ? "bg-encre text-white" : "bg-orange-clair text-orange-profond")} aria-hidden>
                  {l.youtubeId ? <PlayCircle className="h-6 w-6" /> : <Link2 className="h-5 w-5" />}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-[17px] font-bold leading-snug">{l.titre}</span>
                  <span className="text-[14px] text-texte-doux">{l.site}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {p.fichiers.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {p.fichiers.map((f) =>
            f.image && (!reduites || imagesVues.has(f.id)) ? (
              <li key={f.id}>
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  <img src={f.url} alt={f.nom} loading="lazy" className="max-h-[320px] w-auto max-w-full rounded-[16px] border border-ligne object-contain" />
                </a>
              </li>
            ) : (
              <li key={f.id} className="flex min-h-[64px] flex-col gap-2 rounded-[16px] border border-ligne px-4 py-3 sm:flex-row sm:items-center sm:gap-3" data-fichier-mur>
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <IconeFichier mime={f.mime} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-3 break-words text-[17px] font-bold leading-snug [overflow-wrap:anywhere]" title={f.nom} data-nom>
                      {f.nom}
                    </span>
                    <span className="text-[14px] text-texte-doux">{poids(f.taille)}</span>
                  </span>
                </span>
                {f.image ? (
                  <button type="button" onClick={() => setImagesVues(new Set([...imagesVues, f.id]))} className="min-h-[48px] rounded-[14px] border-2 border-encre px-4 text-[16px] font-bold">
                    {tx("image.voir", { v: { taille: poids(f.taille) } })}
                  </button>
                ) : (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-encre px-4 text-[16px] font-bold text-white no-underline hover:bg-orange hover:text-encre">
                    {tx("fichier.ouvrir")}
                  </a>
                )}
              </li>
            ),
          )}
        </ul>
      )}
      {p.peutSupprimer &&
        (confirmer ? (
          <div className="mt-4 flex flex-col gap-3 rounded-[18px] bg-danger-clair p-4 sm:flex-row sm:items-center" role="alertdialog" aria-label={tx("supprimer.titre")}>
            <p className="flex-1 text-[17px] font-bold text-[#7A2E0E]">
              {tx("supprimer.titre")} <span className="font-semibold">{tx("supprimer.texte")}</span>
            </p>
            <button type="button" onClick={() => void supprimer()} disabled={suppression} className="min-h-[48px] rounded-[14px] bg-[#B42318] px-5 text-[17px] font-black text-white">
              {suppression ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : tx("supprimer.oui")}
            </button>
            <button type="button" onClick={() => setConfirmer(false)} className="min-h-[48px] rounded-[14px] border-2 border-encre bg-white px-5 text-[17px] font-bold">
              {tx("supprimer.non")}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmer(true)} className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-bold text-[#B42318]">
            <Trash2 className="h-4 w-4" aria-hidden /> {tx("supprimer")}
          </button>
        ))}
    </article>
  );
}
