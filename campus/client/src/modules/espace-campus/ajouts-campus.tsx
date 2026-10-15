// Le chargé du campus ajoute un PowerPoint ou une vidéo au cours (José, 15 octobre 2026 à 5 h : « le chargé du campus
// aussi doit pouvoir rajouter les vidéos, les trucs »), pour la séance du jour de ce cours (ou la prochaine) :
//   - sur la page du cours : deux cartes blanches, « Ajouter un PowerPoint » et « Ajouter une vidéo » ;
//   - sur l'écran du live : la feuille « Ajouter » (plein écran, nuit), avec « Les vidéos du cours » : « Montrer dans la
//     salle » seulement quand son campus est le seul à suivre le cours (une projection se voit dans toutes les salles) ;
//     « Retirer » pour les vidéos que CE compte a ajoutées.
// Ses ajouts ne changent jamais ce que voit la classe (un premier PowerPoint reste caché jusqu'au geste du formateur).
// Routes : /api/mon-campus/seances/:id/… (server/routes/espace-campus.ts), avec ?site= en aperçu de la direction.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clapperboard, Pause, Play, Presentation, Square, Trash2, Video, Youtube } from "lucide-react";
import { post, suppr } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { BarreProgression, CercleIcone, CLASSES_VIVANTES } from "@/components/ui/gros-blocs";
import { ChoixVideo, FeuilleAjout, useAjoutPowerPoint, useAjoutVideo, type EtatAjout, type TextesVideo } from "@/modules/live/ajouts";
import { positionCourante, projetable } from "@/modules/live/ressources";
import { cleDirect, useSeance } from "@/modules/live/outils";
import { t as textesCampus } from "@shared/textes/campus";
import type { AjoutsCampusDto } from "@shared/espace-campus";
import type { EtatDirectDto, RessourceSeanceDto } from "@shared/schema";
import { BlocNuit, Confirmation, FeuilleCampus, lienCampus } from "./composants";

type Tx = typeof textesCampus;

/** Les textes de ChoixVideo pour le campus (phrases courtes, vouvoiement). */
function textesVideoCampus(tx: Tx): TextesVideo {
  return {
    fichier: tx("video.fichier"),
    fichierTexte: tx("video.fichier.texte"),
    lien: tx("video.youtube"),
    lienTexte: tx("video.youtube.texte"),
    champ: tx("video.youtube.champ"),
    coller: tx("video.coller"),
    ajouter: tx("video.ajouter"),
    ok: tx("video.ok"),
    envoi: (n) => tx("video.envoi", { v: { n } }),
    retour: tx("feuille.retour"),
  };
}

/** « Pour le cours de 8h30 » ou « Pour le cours du samedi 17 octobre à 10h00 ». */
function pour(tx: Tx, a: NonNullable<AjoutsCampusDto>) {
  return a.pour.jour ? tx("ajout.pour.jour", { v: { jour: a.pour.jour, heure: a.pour.heure } }) : tx("ajout.pour", { v: { heure: a.pour.heure } });
}
const compteDiapos = (tx: Tx, n: number) => (n === 0 ? tx("ajout.diapos.zero") : n === 1 ? tx("ajout.diapos.un") : tx("ajout.diapos", { v: { n } }));
const compteVideos = (tx: Tx, n: number) => (n === 0 ? tx("ajout.videos.zero") : n === 1 ? tx("ajout.videos.un") : tx("ajout.videos", { v: { n } }));

/** Ce que dit un envoi de PowerPoint en cours ou fini (null au repos). */
function etatPpt(tx: Tx, e: EtatAjout): string | null {
  if (e.phase === "envoi") return tx("ppt.envoi", { v: { n: Math.round((e.part ?? 0) * 100) } });
  if (e.phase === "conversion") return `${tx("ppt.conversion")} ${tx("ppt.garder")}`;
  if (e.phase === "fait") return e.diapos === 1 ? tx("ppt.ok.un") : tx("ppt.ok", { v: { n: e.diapos ?? 0 } });
  if (e.phase === "erreur") return e.message;
  return null;
}

/** Deux séances du même cours à la même heure : « Pour quel groupe ? » (la séance choisie reçoit les ajouts). */
function ChoixGroupe({ ajouts, choisie, onChoisir, nuit = false }: { ajouts: NonNullable<AjoutsCampusDto>; choisie: number; onChoisir: (id: number) => void; nuit?: boolean }) {
  const tx = useTextes(textesCampus);
  if (!ajouts.choix) return null;
  return (
    <div className="flex flex-col gap-3" data-choix-groupe>
      <p className="text-[22px] font-black">{tx("ajout.groupe")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {ajouts.choix.map((c) => (
          <button
            key={c.seanceId}
            type="button"
            onClick={() => onChoisir(c.seanceId)}
            aria-pressed={choisie === c.seanceId}
            className={cn(
              "min-h-[64px] flex-1 rounded-[18px] border-2 px-4 text-[20px] font-bold",
              choisie === c.seanceId ? "border-orange bg-orange text-encre" : nuit ? "border-nuit-bord bg-nuit-carte text-white" : "border-ligne bg-white text-encre",
            )}
          >
            {c.libelle}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Page du cours : « Ajouter un PowerPoint » et « Ajouter une vidéo », deux cartes blanches (120 px au moins). Sans séance
 * à compléter : grisées, « Pas de cours prévu ». Pendant l'envoi : la barre orange et l'état dans la carte.
 */
export function CartesAjoutsCampus({ ajouts, onFait }: { ajouts: AjoutsCampusDto; onFait: () => void }) {
  const tx = useTextes(textesCampus);
  const [choisie, setChoisie] = useState<number | null>(null);
  const [feuille, setFeuille] = useState(false);
  const seanceId = choisie ?? ajouts?.seanceId ?? null;
  const ppt = useAjoutPowerPoint({ url: seanceId ? lienCampus(`/api/mon-campus/seances/${seanceId}/diapos`) : null, onFait });
  const video = useAjoutVideo({
    urlLien: seanceId ? lienCampus(`/api/mon-campus/seances/${seanceId}/videos`) : null,
    urlFichiers: seanceId ? lienCampus(`/api/mon-campus/seances/${seanceId}/videos/fichiers`) : null,
    onFait,
  });
  if (!ajouts) {
    const gris = "flex min-h-[120px] w-full items-center gap-5 rounded-[26px] border-2 border-[#D9D2CB] bg-[#EEEAE6] px-5 py-5 text-[#5E554F] sm:px-6";
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5" data-ajouts-campus="aucun">
        {[
          { icone: <Presentation className="h-8 w-8" strokeWidth={2.25} />, titre: tx("ajout.ppt") },
          { icone: <Clapperboard className="h-8 w-8" strokeWidth={2.25} />, titre: tx("ajout.video") },
        ].map((b) => (
          <div key={b.titre} className={gris} aria-disabled>
            <CercleIcone taille={64} fond="#E2DDD8" couleur="#5E554F">
              {b.icone}
            </CercleIcone>
            <span className="flex flex-col gap-1">
              <span className="text-[24px] font-black leading-tight sm:text-[26px]">{b.titre}</span>
              <span className="text-[20px] font-semibold">{tx("ajout.aucun")}</span>
            </span>
          </div>
        ))}
      </div>
    );
  }
  const carte = cn("flex min-h-[120px] w-full items-center gap-5 rounded-[26px] border-2 border-ligne bg-white px-5 py-5 text-left text-encre hover:border-orange/60 sm:px-6", CLASSES_VIVANTES, "hover:-translate-y-0.5");
  const ligne = pour(tx, ajouts);
  const etat = etatPpt(tx, ppt.etat);
  return (
    <div className="flex flex-col gap-4">
      <ChoixGroupe ajouts={ajouts} choisie={seanceId ?? ajouts.seanceId} onChoisir={setChoisie} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5" data-ajouts-campus>
        {ppt.champ}
        <button type="button" className={carte} onClick={() => ppt.choisir()} disabled={ppt.occupe} data-ajout="ppt">
          <CercleIcone taille={64} fond="#E4793A" couleur="#141414">
            <Presentation className="h-8 w-8" strokeWidth={2.25} />
          </CercleIcone>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[24px] font-black leading-tight sm:text-[26px]">{tx("ajout.ppt")}</span>
            <span className={cn("text-[20px] font-semibold leading-snug", ppt.etat.phase === "erreur" ? "text-danger" : "text-texte-doux")} role={etat ? "status" : undefined} data-etat-ppt>
              {etat ?? `${ligne} · ${compteDiapos(tx, ajouts.diapos)}`}
            </span>
            {ppt.etat.phase === "envoi" && <BarreProgression part={ppt.etat.part ?? 0} />}
          </span>
        </button>
        <button
          type="button"
          className={carte}
          onClick={() => {
            video.reinitialiser();
            setFeuille(true);
          }}
          data-ajout="video"
        >
          <CercleIcone taille={64} fond="#141414" couleur="#FFFFFF">
            <Clapperboard className="h-8 w-8" strokeWidth={2.25} />
          </CercleIcone>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[24px] font-black leading-tight sm:text-[26px]">{tx("ajout.video")}</span>
            {/* Le lien YouTube se dit d'emblée (José : « fichier ou lien YouTube ») ; le compte, seulement s'il y en a. */}
            <span className="text-[20px] font-semibold leading-snug text-texte-doux">
              {[tx("ajout.video.court"), ligne, ajouts.videos > 0 ? compteVideos(tx, ajouts.videos) : null].filter(Boolean).join(" · ")}
            </span>
          </span>
        </button>
      </div>
      <FeuilleAjout ouverte={feuille} onFermer={() => setFeuille(false)} titre={tx("video.titre")} fermer={tx("feuille.fermer")}>
        <ChoixVideo
          video={video}
          textes={textesVideoCampus(tx)}
          apres={() => (
            <button type="button" onClick={() => setFeuille(false)} className="min-h-[64px] rounded-[18px] bg-orange px-6 text-[22px] font-black text-encre">
              {tx("feuille.fermer")}
            </button>
          )}
        />
      </FeuilleAjout>
    </div>
  );
}

/**
 * Écran du live : la feuille « Ajouter » (plein écran, nuit). « Ajouter un PowerPoint » ouvre le sélecteur aussitôt ;
 * « Ajouter une vidéo » mène aux deux choix (fichier, YouTube). Puis « Les vidéos du cours ».
 */
export function FeuilleAjouterCampus({
  ouverte,
  onFermer,
  ajouts,
  projectionPermise,
  mesAjouts,
  onFait,
}: {
  ouverte: boolean;
  onFermer: () => void;
  ajouts: AjoutsCampusDto;
  projectionPermise: boolean;
  mesAjouts: number[];
  onFait: () => void;
}) {
  const tx = useTextes(textesCampus);
  const [vue, setVue] = useState<"menu" | "video">("menu");
  const [choisie, setChoisie] = useState<number | null>(null);
  const seanceId = choisie ?? ajouts?.seanceId ?? null;
  useEffect(() => {
    if (!ouverte) setVue("menu");
  }, [ouverte]);
  const fait = () => {
    onFait();
    if (seanceId) void rafraichir(`/api/seances/${seanceId}`);
  };
  const ppt = useAjoutPowerPoint({ url: seanceId ? lienCampus(`/api/mon-campus/seances/${seanceId}/diapos`) : null, onFait: fait });
  const video = useAjoutVideo({
    urlLien: seanceId ? lienCampus(`/api/mon-campus/seances/${seanceId}/videos`) : null,
    urlFichiers: seanceId ? lienCampus(`/api/mon-campus/seances/${seanceId}/videos/fichiers`) : null,
    onFait: fait,
  });
  const etat = etatPpt(tx, ppt.etat);
  return (
    <FeuilleCampus ouverte={ouverte} titre={vue === "video" ? tx("video.titre") : tx("live.ajouter")} onFermer={onFermer} retour={vue === "video" ? () => setVue("menu") : undefined}>
      {!ajouts || !seanceId ? (
        <p className="rounded-[24px] bg-nuit-carte px-6 py-5 text-[24px] font-bold">{tx("ajout.aucun")}</p>
      ) : vue === "video" ? (
        <ChoixVideo
          video={video}
          textes={textesVideoCampus(tx)}
          nuit
          apres={() => (
            <button type="button" onClick={() => setVue("menu")} className="min-h-[64px] rounded-[18px] bg-orange px-6 text-[22px] font-black text-encre">
              {tx("videos.liste")}
            </button>
          )}
        />
      ) : (
        <>
          <p className="text-[22px] font-semibold text-nuit-doux">{pour(tx, ajouts)}</p>
          <ChoixGroupe ajouts={ajouts} choisie={seanceId} onChoisir={setChoisie} nuit />
          {ppt.champ}
          <BlocNuit
            testId="ppt"
            icone={ppt.etat.phase === "fait" ? <CheckCircle2 className="h-8 w-8" strokeWidth={2.25} /> : <Presentation className="h-8 w-8" strokeWidth={2.25} />}
            titre={tx("ajout.ppt")}
            sousTitre={<span data-etat-ppt>{etat ?? `${tx("ppt.formats")} ${compteDiapos(tx, ajouts.diapos)}.`}</span>}
            onClick={() => ppt.choisir()}
            attente={ppt.occupe}
            enfants={
              <>
                {ppt.etat.phase === "envoi" && <BarreProgression part={ppt.etat.part ?? 0} nuit />}
                {ppt.etat.phase === "fait" && <span className="text-[18px] font-semibold text-nuit-doux">{tx("ppt.ok.suite")}</span>}
              </>
            }
          />
          <BlocNuit
            testId="video"
            icone={<Clapperboard className="h-8 w-8" strokeWidth={2.25} />}
            titre={tx("ajout.video")}
            sousTitre={ajouts.videos > 0 ? `${tx("ajout.video.texte")} ${compteVideos(tx, ajouts.videos)}.` : tx("ajout.video.texte")}
            onClick={() => {
              video.reinitialiser();
              setVue("video");
            }}
          />
          <VideosDuCours seanceId={seanceId} projectionPermise={projectionPermise} mesAjouts={mesAjouts} onFait={fait} />
        </>
      )}
    </FeuilleCampus>
  );
}

/**
 * « Les vidéos du cours » : une ligne de 88 px par vidéo (YouTube ou fichier), « Ajoutée par le campus de … » le cas
 * échéant ; « Montrer dans la salle » (ou, pour la vidéo montrée, « Pause » / « Reprendre » et « Arrêter la vidéo ») si
 * son campus est le seul du cours ; « Retirer » pour les vidéos de CE compte (confirmé).
 */
function VideosDuCours({ seanceId, projectionPermise, mesAjouts, onFait }: { seanceId: number; projectionPermise: boolean; mesAjouts: number[]; onFait: () => void }) {
  const tx = useTextes(textesCampus);
  const { data: seance } = useSeance(seanceId);
  // L'état du direct (projection en cours) : lu dans le cache de l'écran de la salle, sans nouvelle requête.
  const { data: etat } = useQuery<EtatDirectDto>({ queryKey: cleDirect(seanceId), enabled: false });
  const [retirer, setRetirer] = useState<RessourceSeanceDto | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const videos = (seance?.ressources ?? []).filter(projetable);
  const projection = etat?.projection ?? null;
  const projeter = async (corps: { ressourceId: number | null; lecture?: boolean; position?: number }) => {
    setEnvoi(true);
    setErreur(null);
    try {
      await post(lienCampus(`/api/mon-campus/seances/${seanceId}/projection`), corps);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : tx("ajout.erreur"));
    } finally {
      setEnvoi(false);
    }
  };
  const confirmerRetrait = async () => {
    if (!retirer) return;
    setEnvoi(true);
    try {
      await suppr(lienCampus(`/api/mon-campus/seances/${seanceId}/ressources/${retirer.id}`));
      setRetirer(null);
      onFait();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : tx("ajout.erreur"));
      setRetirer(null);
    } finally {
      setEnvoi(false);
    }
  };
  const bouton = "flex min-h-[56px] items-center justify-center gap-2 rounded-full px-5 text-[18px] font-bold";
  return (
    <section className="flex flex-col gap-3" data-videos-cours>
      <h2 className="pt-2 font-sans text-[28px] font-black text-white">{tx("videos.liste")}</h2>
      {erreur && (
        <p className="rounded-[18px] bg-[#2A1510] px-5 py-4 text-[20px] font-bold text-[#FFD2B3]" role="alert">
          {erreur}
        </p>
      )}
      {videos.length === 0 ? (
        <p className="text-[20px] text-nuit-doux">{tx("videos.vide")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {videos.map((r) => {
            const montree = projection?.ressourceId === r.id;
            // Un seul bouton : sur la ligne du titre ; deux ou trois (vidéo montrée : « Pause », « Arrêter », « Retirer ») :
            // sur leur propre rangée, pour garder au titre toute la largeur (relecture du 15 octobre 2026).
            const nbBoutons = (projectionPermise ? (montree && projection ? 2 : 1) : 0) + (mesAjouts.includes(r.id) ? 1 : 0);
            return (
              <li
                key={r.id}
                className={cn(
                  "flex min-h-[88px] flex-col gap-3 rounded-[22px] border-2 px-4 py-3",
                  nbBoutons <= 1 && "sm:flex-row sm:items-center",
                  montree ? "border-orange bg-[#24211F]" : "border-nuit-bord bg-nuit-carte",
                )}
                data-video={r.id}
              >
                <span className="flex min-w-0 flex-1 items-center gap-4 sm:min-w-[14rem]">
                  <CercleIcone taille={48} fond="rgba(228,121,58,.15)" couleur="#E4793A">
                    {r.type === "youtube" ? <Youtube className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                  </CercleIcone>
                  <span className="flex min-w-0 flex-col">
                    <span className="break-words text-[22px] font-bold leading-tight">{r.titre}</span>
                    {montree && <span className="text-[16px] font-bold text-orange-peche">{tx("video.enCours")}</span>}
                    {r.ajoutePar && <span className="text-[16px] font-semibold text-nuit-doux">{tx("video.ajouteePar", { v: { deCampus: r.ajoutePar.replace(/^Campus /, "") } })}</span>}
                  </span>
                </span>
                <span className={cn("flex flex-wrap gap-2", nbBoutons > 1 && "sm:justify-end")}>
                  {projectionPermise &&
                    (montree && projection ? (
                      <>
                        <button
                          type="button"
                          disabled={envoi}
                          onClick={() => void projeter({ ressourceId: r.id, lecture: !projection.lecture, position: positionCourante(projection) })}
                          className={cn(bouton, "bg-white text-encre")}
                        >
                          {projection.lecture ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
                          {projection.lecture ? tx("video.pause") : tx("video.reprendre")}
                        </button>
                        <button type="button" disabled={envoi} onClick={() => void projeter({ ressourceId: null })} className={cn(bouton, "border-2 border-white text-white")} data-arreter-video>
                          <Square className="h-5 w-5" aria-hidden />
                          {tx("video.arreter")}
                        </button>
                      </>
                    ) : (
                      <button type="button" disabled={envoi} onClick={() => void projeter({ ressourceId: r.id, lecture: true, position: 0 })} className={cn(bouton, "bg-orange text-encre")} data-montrer>
                        <Play className="h-5 w-5" aria-hidden />
                        {tx("video.montrer")}
                      </button>
                    ))}
                  {mesAjouts.includes(r.id) && (
                    <button type="button" disabled={envoi} onClick={() => setRetirer(r)} className={cn(bouton, "border-2 border-[#5A2A1A] text-[#FFB59E]")} data-retirer>
                      <Trash2 className="h-5 w-5" aria-hidden />
                      {tx("video.retirer")}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {!projectionPermise && videos.length > 0 && <p className="text-[20px] font-semibold text-nuit-doux" data-formateur-montre>{tx("video.formateurMontre")}</p>}
      <Confirmation
        nuit
        ouverte={retirer !== null}
        titre={tx("video.retirer.titre")}
        texte={retirer?.titre}
        oui={tx("video.retirer.oui")}
        non={tx("video.retirer.non")}
        attente={envoi}
        onOui={() => void confirmerRetrait()}
        onNon={() => setRetirer(null)}
      />
    </section>
  );
}
