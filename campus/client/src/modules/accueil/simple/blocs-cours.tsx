// Les gros blocs d'un cours pour le professeur (José, 15 octobre 2026 : « ils se connectent, ils voient : commencer le
// live, rajouter mes documents, un blog pour poster mes liens, mes fichiers. Très simple » ; « un bloc où ils voient les
// vidéos des cours, les résumés de session, les examens… »). De haut en bas : « Commencer le live » (pleine largeur),
// puis « Mes documents », « Le mur du cours », « Vidéos et examens », et une ligne « Leçons, devoirs et notes ».
// Le live garde la règle de l'accueil du 14 octobre : en direct → Studio ; dès 1 h avant → la classe s'ouvre puis le
// Studio ; plus tôt → « Revenez à 9h00. » ; sans séance → bloc grisé. Cours d'un autre professeur (plusieurs
// professeurs) : confirmation avant d'entrer. Compteurs : GET /api/enseigner/mon-cours/:id/resume (en attendant : les
// diapos et vidéos de l'accueil, « 24 diapos · 2 vidéos »).
// Esthétique de « Campus simple, suite » (components/ui/gros-blocs) : bande en dégradé de la couleur du cours, icônes
// dans un cercle, blocs dans la teinte douce du cours, point « En direct » pulsé seulement en direct (classe ouverte en
// avance : « Salle ouverte · début à 16h00 », point fixe), écran bas (1366×768, 1024×600) : les quatre blocs entiers
// (le live garde 160 px jusqu'à 701 px de haut).
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clapperboard, FolderOpen, MonitorPlay, Newspaper } from "lucide-react";
import { post } from "@/lib/api";
import { relatif } from "@/lib/dates";
import { useCanal } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { BandeauCours, GrosBloc, GrosBouton, LigneBloc } from "@/components/ui/gros-blocs";
import { teinteDouce } from "@/modules/cours/outils";
import { t as tEnseigner } from "@shared/textes/enseigner";
import { t as tProf } from "@shared/textes/espace-prof";
import type { CarreFormateurDto } from "@shared/accueil-simple";
import type { ResumeCoursProfDto } from "@shared/espace-prof";
import { CLE_ACCUEIL_SIMPLE, useRepere } from "./blocs";

export const cleResumeCours = (coursId: number) => `/api/enseigner/mon-cours/${coursId}/resume`;

/** Les compteurs des blocs d'un cours, relus quand le mur change. */
export function useResumeCours(coursId: number) {
  useCanal(`mur:${coursId}`, () => void rafraichir(cleResumeCours(coursId)));
  return useQuery<ResumeCoursProfDto>({ queryKey: [cleResumeCours(coursId)], staleTime: 15_000, refetchInterval: 60_000 });
}

export function BlocsDuCours({ c }: { c: CarreFormateurDto }) {
  const tx = useTextes(tProf);
  const te = useTextes(tEnseigner);
  const repere = useRepere()(c);
  const [, naviguer] = useLocation();
  const { data: r } = useResumeCours(c.coursId);
  const [envoi, setEnvoi] = useState(false);
  const [revenir, setRevenir] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const s = c.seance;
  const live = c.live;
  const intervenant = r?.intervenant ?? null;

  const texteLive0 =
    live.etat === "attendre" && live.ouvreHeure
      ? c.repere === "aujourdhui" && !live.ouvreJour
        ? `${repere ?? ""} · ${te("blocs.live.ouvre", { v: { heure: live.ouvreHeure } })}`
        : (repere ?? te("blocs.live.attendre", { v: { heure: live.ouvreHeure } }))
      : live.etat === "aucun"
        ? te("blocs.live.aucun")
        : (repere ?? te("blocs.live.aucun"));
  const texteLive = intervenant && live.etat !== "aucun" ? `${texteLive0} · ${tx("blocs.live.coursDe", { v: { nom: intervenant } })}` : texteLive0;
  const texteRevenir = live.ouvreHeure
    ? `${live.ouvreJour ? te("blocs.live.revenir.jour", { v: { jour: live.ouvreJour, heure: live.ouvreHeure } }) : te("blocs.live.revenir", { v: { heure: live.ouvreHeure } })}${
        live.ouvreChezVous ? ` (${te("blocs.live.chezVous", { v: { heure: live.ouvreChezVous } })})` : ""
      }.`
    : null;

  const entrerVraiment = async () => {
    if (!s) return;
    setConfirmer(false);
    if (live.etat === "direct") return naviguer(`/live/${s.id}`);
    if (live.etat !== "ouvrir") return;
    setEnvoi(true);
    // La classe s'ouvre (le cours commence à son heure) ; puis le Studio, même si un autre l'a ouverte (409).
    await post(`/api/seances/${s.id}/demarrer`, { avantLHeure: true }).catch(() => undefined);
    await rafraichir(CLE_ACCUEIL_SIMPLE, `/api/seances/${s.id}`);
    naviguer(`/live/${s.id}`);
  };
  const entrer = () => {
    if (!s) return;
    if (live.etat === "attendre") return setRevenir(true);
    if (intervenant && (live.etat === "ouvrir" || live.etat === "direct")) return setConfirmer(true);
    void entrerVraiment();
  };

  // « 24 diapos · 2 vidéos · 1 document », « Pas encore de document », « Pas de cours prévu ».
  // Rien pour le prochain cours mais des documents des cours passés : on les compte (ils sont dans « Mes documents »).
  // Avant la réponse du résumé : les diapos et vidéos que l'accueil connaît déjà (c.preparation).
  const d = r ? r.documents : c.preparation ? { ...c.preparation, documents: 0 } : null;
  const passes = r?.documentsPasses ?? 0;
  const texteDocuments =
    !r && !d
      ? tx("blocs.documents.texte")
      : (!d || d.diapos + d.videos + d.documents === 0) && passes > 0
        ? tx(passes === 1 ? "blocs.documents.passes.un" : "blocs.documents.passes.n", { v: { n: passes } })
        : !d
          ? tx("blocs.documents.aucun")
          : d.diapos + d.videos + d.documents === 0
            ? tx("blocs.documents.vide")
            : [
                d.diapos ? tx(d.diapos === 1 ? "blocs.documents.diapos.un" : "blocs.documents.diapos.n", { v: { n: d.diapos } }) : null,
                d.videos ? tx(d.videos === 1 ? "blocs.documents.videos.un" : "blocs.documents.videos.n", { v: { n: d.videos } }) : null,
                d.documents ? tx(d.documents === 1 ? "blocs.documents.documents.un" : "blocs.documents.documents.n", { v: { n: d.documents } }) : null,
              ]
                .filter(Boolean)
                .join(" · ");
  const texteMur =
    r && r.mur.total > 0 && r.mur.dernierLe
      ? tx(r.mur.total === 1 ? "blocs.mur.compte.un" : "blocs.mur.compte.n", { v: { n: r.mur.total, quand: relatif(r.mur.dernierLe) } })
      : tx("blocs.mur.texte");
  const morceauxVideos = r
    ? [
        r.videos.replays ? tx(r.videos.replays === 1 ? "blocs.videos.replays.un" : "blocs.videos.replays.n", { v: { n: r.videos.replays } }) : null,
        r.examens.total ? tx(r.examens.total === 1 ? "blocs.videos.examens.un" : "blocs.videos.examens.n", { v: { n: r.examens.total } }) : null,
        r.examens.aRelire ? tx("blocs.videos.aRelire", { v: { n: r.examens.aRelire } }) : null,
      ].filter(Boolean)
    : [];
  const texteVideos = morceauxVideos.length ? morceauxVideos.join(" · ") : tx("blocs.videos.texte");

  const ouverteEnAvance = c.repere === "ouvert";
  const tonLive = live.etat === "direct" ? "vert" : live.etat === "ouvrir" ? "orange" : "gris";
  const fond = teinteDouce(c.couleur);
  const doux = (x: string) => <span className="text-texte-doux">{x}</span>;
  return (
    <div className="flex flex-col gap-4 sm:gap-5 [@media(max-height:800px)]:!gap-3" data-blocs-cours={c.code}>
      <GrosBloc
        grand
        testId="live"
        ton={tonLive}
        cercle={tonLive === "gris" ? { fond: "#E2DDD8", couleur: "#5E554F" } : tonLive === "vert" ? { fond: "rgba(255,255,255,.2)", couleur: "#FFFFFF" } : { fond: "rgba(255,255,255,.3)", couleur: "#141414" }}
        icone={<MonitorPlay className="h-9 w-9 sm:h-10 sm:w-10" strokeWidth={2.25} />}
        titre={live.etat === "direct" ? tx("blocs.live.entrer") : tx("blocs.live.commencer")}
        sousTitre={envoi ? te("blocs.live.ouverture") : texteLive}
        vivant={live.etat === "direct"}
        pointFixe={ouverteEnAvance}
        attente={envoi}
        onClick={live.etat === "aucun" ? undefined : entrer}
        className="[@media(max-height:800px)]:!py-4 [@media(max-height:700px)]:!min-h-[104px]"
      />
      {revenir && texteRevenir && (
        <p className="rounded-[20px] border-2 border-ligne bg-creme px-5 py-4 text-[22px] font-bold" role="status" data-revenir>
          {texteRevenir}
        </p>
      )}
      {confirmer && intervenant && (
        <div className="flex flex-col gap-3 rounded-[22px] border-2 border-orange bg-orange-clair p-5" role="alertdialog" aria-label={tx("blocs.live.autre.titre", { v: { nom: intervenant } })}>
          <p className="text-[22px] font-black">{tx("blocs.live.autre.titre", { v: { nom: intervenant } })}</p>
          <p className="text-[20px]">{tx("blocs.live.autre.texte")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <GrosBouton onClick={() => void entrerVraiment()}>{tx("blocs.live.autre.oui")}</GrosBouton>
            <GrosBouton ton="contour" onClick={() => setConfirmer(false)}>
              {tx("blocs.live.autre.non")}
            </GrosBouton>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 [@media(max-height:800px)]:!gap-3">
        <GrosBloc
          testId="documents"
          carre
          ton="teinte"
          fond={fond}
          icone={<FolderOpen className="h-8 w-8" strokeWidth={2.25} />}
          cercle={{ fond: "#141414", couleur: "#FFFFFF" }}
          titre={tx("blocs.documents")}
          sousTitre={doux(texteDocuments)}
          href={`/enseigner/mon-cours/${c.coursId}/documents`}
        />
        <GrosBloc
          testId="mur"
          carre
          ton="teinte"
          fond={fond}
          icone={<Newspaper className="h-8 w-8" strokeWidth={2.25} />}
          cercle={{ fond: "#FFF1E6", couleur: "#A34C17" }}
          titre={tx("blocs.mur")}
          sousTitre={doux(texteMur)}
          href={`/enseigner/mon-cours/${c.coursId}/mur`}
        />
        <GrosBloc
          testId="videos"
          carre
          ton="teinte"
          fond={fond}
          className="sm:col-span-2 lg:col-span-1"
          icone={<Clapperboard className="h-8 w-8" strokeWidth={2.25} />}
          cercle={{ fond: "#EAF1FE", couleur: "#1D4ED8" }}
          titre={tx("blocs.videos")}
          sousTitre={doux(texteVideos)}
          href={`/enseigner/mon-cours/${c.coursId}/videos-examens`}
        />
      </div>
      <LigneBloc testId="lecons" icone={<BookOpen className="h-6 w-6" strokeWidth={2.25} />} titre={tx("blocs.lecons")} href={c.liens.cours} />
    </div>
  );
}

/** La bande du cours : sa couleur en dégradé, son nom en grand, ses classes dessous. */
export function BandeDuCours({ c }: { c: CarreFormateurDto }) {
  const tx = useTextes(tProf);
  const { data: r } = useResumeCours(c.coursId);
  return <BandeauCours couleur={c.couleur} etiquette={c.code} titre={c.titre} sousTitre={r ? r.classes || tx("blocs.classes.aucune") : null} />;
}
