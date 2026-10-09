// /replays/:id — revoir un live sans exploser son forfait : la fiche de
// révision d'abord (quelques Ko), la transcription horodatée avec
// recherche (« Où a-t-il parlé de la TVA ? » → saut au passage), les
// questions posées, et la vidéo seulement si on la demande (poids affiché).
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlayCircle, Search, FileText, MessageSquare, Presentation, ExternalLink, GraduationCap, ClipboardList } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { t as textesCopies } from "@shared/textes/copies-direct";
import { Link } from "wouter";
import { get, post } from "@/lib/api";
import { useMoiConnecte } from "@/lib/auth";
import { rafraichir } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { dateComplete, dateEtHeure, heure } from "@/lib/dates";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Chargement, EtatVide, Erreur, Badge } from "@/components/ui/divers";
import { Markdown } from "@/components/ui/markdown";
import { Onglets } from "@/components/ui/onglets";
import { TitreSection } from "@/components/ui/carte";
import { toastErreur } from "@/components/ui/toast";
import { minutage, sansAccents } from "./outils";
import { ListeRessources } from "./ressources";
import type { ReplayDto, CoursCompletDto } from "@shared/schema";

type Onglet = "fiche" | "transcription" | "questions" | "diapos" | "documents";

export default function PageReplay({ id }: { id: string }) {
  const moi = useMoiConnecte();
  const seanceId = Number(id);
  const { data: r, error, isLoading, refetch } = useQuery<ReplayDto>({ queryKey: [`/api/seances/${seanceId}/replay`] });
  const [onglet, setOnglet] = useState<Onglet>("fiche");
  const [video, setVideo] = useState<string | null>(null);
  /** Morceau chargé quand l'enregistrement en compte plusieurs (1 sinon). */
  const [numeroVideo, setNumeroVideo] = useState(1);
  const [chargementVideo, setChargementVideo] = useState(false);
  const [recherche, setRecherche] = useState("");
  const txCopies = useTextes(textesCopies);
  const lecteur = useRef<HTMLVideoElement>(null);
  const enseignant = moi.role === "formateur" || moi.role === "admin" || moi.role === "vie_scolaire";

  useEffect(() => {
    // « Revu en replay » : suivi à part, ne compte jamais comme une présence. Formateur : le « Nouveau » de ses Enregistrements s'efface.
    if (!r) return;
    if (moi.role === "etudiant") void post(`/api/seances/${seanceId}/replay/vu`).catch(() => undefined);
    if (moi.role === "formateur") void post(`/api/seances/${seanceId}/replay/vu`).then(() => rafraichir("/api/replays"), () => undefined);
  }, [r?.seance.id]);

  const resultats = useMemo(() => {
    if (!r) return [];
    const mots = sansAccents(recherche.trim())
      .replace(/^(ou|quand)\s+(a-t-il|a-t-elle|il a|elle a|on a)\s+(parle|explique|dit)\s+(de|du|des|d'|la|le|les)?\s*/i, "")
      .split(/\s+/)
      .filter((m) => m.length > 2);
    if (!mots.length) return r.transcription;
    return r.transcription.filter((l) => {
      const t = sansAccents(l.texte);
      return mots.every((m) => t.includes(m));
    });
  }, [r, recherche]);

  if (isLoading) return <Page><Chargement lignes={3} /></Page>;
  if (error || !r) return <Page><Erreur message={(error as Error)?.message ?? "Replay introuvable."} reessayer={() => void refetch()} /></Page>;

  const morceaux = r.video.morceaux;
  const chargerVideo = async (t?: number, numeroDemande?: number) => {
    // Enregistrement en plusieurs morceaux : le passage t (secondes depuis le début du cours) est dans le dernier morceau commencé avant lui.
    let numero = numeroDemande ?? 1;
    let position = t;
    if (morceaux?.length && t !== undefined && numeroDemande === undefined) {
      const m = [...morceaux].reverse().find((x) => x.decalageSecondes <= t) ?? morceaux[0];
      numero = m.numero;
      position = Math.max(0, t - m.decalageSecondes);
    }
    if (video && numero === numeroVideo) {
      if (position !== undefined && lecteur.current) {
        lecteur.current.currentTime = position;
        void lecteur.current.play().catch(() => undefined);
      }
      return;
    }
    setChargementVideo(true);
    try {
      const lien = await get<{ url: string }>(`/api/seances/${seanceId}/replay/video${numero > 1 ? `?morceau=${numero}` : ""}`);
      setVideo(lien.url);
      setNumeroVideo(numero);
      if (position !== undefined) setTimeout(() => lecteur.current && (lecteur.current.currentTime = position), 800);
    } catch (e) {
      toastErreur(e);
    } finally {
      setChargementVideo(false);
    }
  };
  const lienDirect = video && !/\.(mp4|webm)(\?|$)/i.test(video) && r.video.source === "lien";

  return (
    <Page className="max-w-5xl">
      <EnTetePage
        etiquette={`${r.seance.coursCode} · Replay`}
        titre={r.seance.titre}
        sousTitre={`${enseignant ? dateEtHeure(r.seance.debut) : `${dateComplete(r.seance.debut)} · ${heure(r.seance.debut)}`}${r.seance.formateur ? ` · ${r.seance.formateur}` : ""}`}
        actions={
          r.anime ? (
            <LienBouton href={`/enseigner/seances/${r.seance.id}`} variante="contour">
              Bilan et fiche
            </LienBouton>
          ) : moi.role === "formateur" ? (
            <LienBouton href="/replays" variante="contour">
              Tous les enregistrements
            </LienBouton>
          ) : undefined
        }
      />

      {/* Lecteur : rien ne se charge sans l'accord de l'étudiant */}
      <div className="overflow-hidden rounded-[24px] bg-encre text-white">
        {video && !lienDirect ? (
          <>
            <video ref={lecteur} src={video} controls autoPlay playsInline preload="metadata" className="aspect-video w-full bg-black" />
            {morceaux && morceaux.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="text-[13px] text-nuit-doux">L'enregistrement est en {morceaux.length} parties :</span>
                {morceaux.map((m) => (
                  <button
                    key={m.numero}
                    type="button"
                    onClick={() => void chargerVideo(undefined, m.numero)}
                    aria-pressed={m.numero === numeroVideo}
                    className={cn("rounded-full px-3 py-1.5 text-[13px] font-bold", m.numero === numeroVideo ? "bg-orange text-encre" : "bg-nuit-carte text-white hover:bg-nuit-ligne")}
                  >
                    Partie {m.numero} · {Math.max(1, Math.round(m.dureeSecondes / 60))} min
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <PlayCircle className="h-12 w-12 text-orange" />
            {r.video.disponible ? (
              <>
                <p className="text-xl font-extrabold">Regarder la vidéo du cours</p>
                <p className="max-w-md text-[15px] text-nuit-doux">
                  {r.video.poidsEstimeMo ? `Environ ${r.video.poidsEstimeMo} Mo` : "Poids selon la plateforme vidéo"}
                  {r.video.dureeSecondes ? ` · ${Math.round(r.video.dureeSecondes / 60)} min` : ""}
                  {morceaux && morceaux.length > 1 ? ` en ${morceaux.length} parties` : ""}. En 4G, {enseignant ? "commencez" : "commence"} plutôt par la fiche et la transcription (quelques Ko).
                </p>
                {lienDirect ? (
                  <LienBouton href={video!} externe icone={<ExternalLink className="h-4 w-4" />}>
                    Ouvrir la vidéo
                  </LienBouton>
                ) : (
                  <Bouton chargement={chargementVideo} onClick={() => chargerVideo()}>
                    Charger la vidéo{r.video.poidsEstimeMo ? ` (≈ ${r.video.poidsEstimeMo} Mo)` : ""}
                  </Bouton>
                )}
              </>
            ) : (
              <>
                <p className="text-xl font-extrabold">Pas de vidéo pour ce live</p>
                <p className="max-w-md text-[15px] text-nuit-doux">La fiche de révision, la transcription et les questions posées sont là, pour presque rien en données.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Copies montrées pendant le cours : le moment seulement (la copie n'est pas dans la vidéo). */}
      {r.moments?.length ? (
        <section className="flex flex-col gap-2 rounded-[20px] border border-ligne p-4 sm:p-5" aria-label={txCopies("replay.titre")}>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-encre">
            <ClipboardList className="h-5 w-5 text-orange" /> {txCopies("replay.titre")}
          </h2>
          <ol className="flex flex-col divide-y divide-ligne-douce">
            {r.moments.map((m, i) => (
              <li key={`${m.t}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="font-mono text-[13px] text-orange-fonce">{minutage(m.t)}</span>
                <span className="min-w-0 flex-1 text-[15px]">{m.libelle}</span>
                {m.dureeSecondes !== null && (
                  <span className="text-[13px] text-texte-gris">
                    {m.dureeSecondes < 60 ? txCopies("duree.secondes", { v: { n: m.dureeSecondes } }) : txCopies("duree.minutes", { v: { n: Math.round(m.dureeSecondes / 60) } })}
                  </span>
                )}
                {r.video.disponible && (
                  <Bouton variante="contour" taille="sm" onClick={() => void chargerVideo(m.t)}>
                    {txCopies("replay.revoir")}
                  </Bouton>
                )}
              </li>
            ))}
          </ol>
          <p className="text-[13px] text-texte-gris">{txCopies("replay.note")}</p>
        </section>
      ) : null}

      <BandeauCoursComplet seanceId={seanceId} />

      <Onglets
        valeur={onglet}
        onChange={setOnglet}
        options={[
          { valeur: "fiche", libelle: "Fiche de révision" },
          { valeur: "transcription", libelle: "Transcription", compteur: r.transcription.length || undefined },
          { valeur: "questions", libelle: "Questions", compteur: r.questions.length || undefined },
          ...(r.diapos.length ? [{ valeur: "diapos" as const, libelle: "Diapos", compteur: r.diapos.length }] : []),
          ...(r.ressources.length ? [{ valeur: "documents" as const, libelle: "Vidéos et documents", compteur: r.ressources.length }] : []),
        ]}
      />

      {onglet === "fiche" &&
        (r.fiche ? (
          <article className="rounded-[24px] border border-ligne p-5 sm:p-8">
            <Markdown source={r.fiche.contenu} />
          </article>
        ) : r.brouillon ? (
          <div className="flex flex-col gap-3 rounded-[24px] border border-dashed border-orange p-5">
            <div className="flex flex-wrap gap-2">
              <Badge ton="alerte">Brouillon non publié</Badge>
              {r.brouillon.parIa && <Badge ton="orange">Proposé par l'IA</Badge>}
            </div>
            <Markdown source={r.brouillon.contenu} />
          </div>
        ) : (
          <EtatVide
            icone={<FileText className="h-6 w-6" />}
            titre="La fiche de révision arrive bientôt"
            texte={
              r.anime
                ? "Générez-la depuis le bilan de la séance, relisez-la puis publiez-la."
                : enseignant
                  ? "Le formateur du cours la relit avant de la publier. En attendant, la vidéo, la transcription et les questions sont là."
                  : "Ton formateur relit la fiche avant de la publier. Tu recevras une notification dès qu'elle est prête."
            }
            action={r.anime ? <LienBouton href={`/enseigner/seances/${r.seance.id}`}>Préparer la fiche</LienBouton> : undefined}
          />
        ))}

      {onglet === "transcription" && (
        <section className="flex flex-col gap-3">
          <label className="relative">
            <span className="sr-only">Rechercher dans la transcription</span>
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Où a-t-il parlé de… ? (ex. : TVA, modèle de langage)"
              className="min-h-12 w-full rounded-2xl border border-ligne bg-white pl-12 pr-4 text-base outline-none focus:border-orange"
            />
          </label>
          {!r.transcription.length ? (
            <EtatVide icone={<MessageSquare className="h-6 w-6" />} titre="Pas de transcription pour ce live" texte="Elle est écrite pendant le cours quand le formateur active les sous-titres." />
          ) : !resultats.length ? (
            <p className="rounded-2xl bg-creme p-4 text-[15px] text-texte-pale">Aucun passage ne parle de « {recherche} ». {enseignant ? "Essayez" : "Essaie"} un autre mot.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-ligne-douce rounded-2xl border border-ligne">
              {resultats.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => (r.video.disponible ? chargerVideo(l.t) : undefined)}
                    className={cn("grid w-full grid-cols-[64px_1fr] gap-3 px-4 py-3 text-left", r.video.disponible && "hover:bg-creme")}
                    aria-label={r.video.disponible ? `Aller à ${minutage(l.t)} dans la vidéo` : undefined}
                  >
                    <span className="font-mono text-[13px] text-orange-fonce">{minutage(l.t)}</span>
                    <span className="text-[15px] leading-relaxed">{surligner(l.texte, recherche)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {onglet === "questions" && (
        <section className="flex flex-col gap-2">
          {!r.questions.length ? (
            <EtatVide icone={<MessageSquare className="h-6 w-6" />} titre="Aucune question posée pendant ce live" />
          ) : (
            r.questions.map((q) => (
              <div key={q.id} className="flex items-start justify-between gap-3 rounded-2xl border border-ligne p-4">
                <div>
                  <span className="font-mono text-[11px] text-orange-fonce">
                    {q.site ?? "En ligne"}
                    {q.auteur ? ` · ${q.auteur}` : ""}
                    {q.repondue && q.reponduLe ? " · répondue en direct" : ""}
                  </span>
                  <p className="text-[15px]">{q.texte}</p>
                </div>
                <Badge ton="gris">▲ {q.votes}</Badge>
              </div>
            ))
          )}
        </section>
      )}

      {onglet === "diapos" && (
        <section>
          <TitreSection titre="Les diapos du cours" action={<Presentation className="h-5 w-5 text-texte-gris" />} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {r.diapos.map((d) => (
              <a key={d.fichierId} href={d.url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border border-ligne">
                <img src={d.url} alt={`Diapo ${d.index + 1}`} loading="lazy" className="aspect-video w-full object-cover" />
              </a>
            ))}
          </div>
        </section>
      )}

      {onglet === "documents" && (
        <section className="flex flex-col gap-3">
          <TitreSection titre="Vidéos et documents de la séance" />
          <ListeRessources ressources={r.ressources} />
        </section>
      )}
    </Page>
  );
}

/** Met en évidence les mots recherchés dans une ligne de transcription. */
function surligner(texte: string, recherche: string) {
  const mots = sansAccents(recherche).split(/\s+/).filter((m) => m.length > 2 && !["parle", "parler", "a-t-il", "ou"].includes(m));
  if (!mots.length) return texte;
  const normal = sansAccents(texte);
  const morceaux: { t: string; fort: boolean }[] = [];
  let i = 0;
  while (i < texte.length) {
    const trouve = mots.map((m) => ({ m, pos: normal.indexOf(m, i) })).filter((x) => x.pos >= 0).sort((a, b) => a.pos - b.pos)[0];
    if (!trouve) {
      morceaux.push({ t: texte.slice(i), fort: false });
      break;
    }
    if (trouve.pos > i) morceaux.push({ t: texte.slice(i, trouve.pos), fort: false });
    morceaux.push({ t: texte.slice(trouve.pos, trouve.pos + trouve.m.length), fort: true });
    i = trouve.pos + trouve.m.length;
  }
  return morceaux.map((m, k) => (m.fort ? <mark key={k} className="rounded bg-orange-peche px-0.5 text-encre">{m.t}</mark> : <span key={k}>{m.t}</span>));
}

/** Le cours complet tiré de cet enregistrement (notions, quiz, exercices) : lien quand il est prêt. */
function BandeauCoursComplet({ seanceId }: { seanceId: number }) {
  const { data } = useQuery<CoursCompletDto>({ queryKey: [`/api/seances/${seanceId}/cours-complet`], staleTime: 60_000 });
  if (!data || (data.statut !== "prete" && data.statut !== "en_cours")) return null;
  return (
    <Link
      href={`/mediatheque/cours/${seanceId}`}
      className="flex items-center gap-3 rounded-2xl border-2 border-orange bg-orange-pale px-4 py-3.5 text-encre no-underline hover:bg-orange-clair"
    >
      <GraduationCap className="h-6 w-6 shrink-0 text-orange-fonce" aria-hidden />
      <span className="flex-1">
        <span className="block font-extrabold">{data.statut === "prete" ? "Le cours résumé est prêt" : "Le cours résumé se prépare"}</span>
        <span className="text-sm text-texte-pale">Notions expliquées, quiz corrigé, exercices pratiques avec corrigés, étude de cas et fiches mémo.</span>
      </span>
    </Link>
  );
}
