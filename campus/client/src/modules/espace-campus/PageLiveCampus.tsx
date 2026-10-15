// /mon-campus/cours/:coursId/live : « Entrer dans le live ». Cet ordinateur devient l'écran de la salle pour CE cours,
// celui que la personne a touché (le cours est dans l'adresse : il reste le même au rechargement ; plus aucune
// attribution automatique). Même affichage que l'écran d'une salle (EcranSeance, live/PageSalle.tsx : grande vidéo du
// formateur, diapos, QR et code du campus, son), en plein écran, avec son bandeau : le campus et le cours, l'heure, et
// deux boutons, « Ajouter » (PowerPoint, vidéo) et « Fermer » (fermer la salle, terminer le cours).
//   - Pas encore ouverte : « Ouvrir la salle », à toute heure du jour du cours (José, 15 octobre 2026 à 5 h : « les
//     salles n'ont pas besoin d'attendre que le professeur arrive pour ouvrir ; elles doivent tester le son »). Le cours
//     commence quand même à son heure. Arrivée par « Entrer dans le live » (?ouvrir=1) : la salle s'ouvre toute seule,
//     une seule fois (l'adresse perd « ouvrir » : un rechargement ne rouvre rien).
//   - Pas de cours aujourd'hui (ou fini, annulé, pas eu lieu) : « Vous pouvez tester le son et l'image. » et la salle
//     d'essai, en un toucher (rien n'est enregistré ; elle se ferme seule après une heure).
//   - « Fermer la salle » : cet ordinateur quitte le cours, la classe continue pour le formateur et les autres salles.
//     « Terminer le cours » : seulement quand c'est sans danger (serveur : terminaisonCampus).
//   - Rechargement, ou ordinateur rallumé : un bandeau jaune « Touchez l'écran pour reprendre le cours. » en haut, qui
//     ne cache rien (la vidéo, le QR et le code restent visibles) ; le premier toucher, n'importe où, remet le plein
//     écran et le son.
//   - Deux ordinateurs du campus sur le même cours : « Un autre ordinateur de … montre ce cours. Même salle ? Fermez-en un. »
// L'ordinateur entre dans la classe comme une salle (serveur : estEcran), caméra et micro de la salle.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleStop, DoorClosed, Play, Plus, Volume2 } from "lucide-react";
import { post, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { heure as heureLocale } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { BadgeDirect } from "@/components/ui/divers";
import { PointVivant } from "@/components/ui/gros-blocs";
import { relancerSons } from "@/modules/visio/composants";
import { CadreDaily } from "@/modules/visio";
import { EcranSeance } from "@/modules/live/PageSalle";
import { useEcranAllume } from "@/modules/live/outils";
import { t as textesCampus } from "@shared/textes/campus";
import { classeOuverteEnAvance } from "@shared/ouverture";
import { deCampus, type FermetureCampusDto, type LiveCampusDto } from "@shared/espace-campus";
import type { AccesDaily, EtatDirectDto, SeanceDetailDto } from "@shared/schema";
import { BlocNuit, Confirmation, FeuilleCampus, lienCampus, useApiCampus } from "./composants";
import { FeuilleAjouterCampus } from "./ajouts-campus";
import { CLE_GESTE_LIVE, CLE_SALLE_FERMEE, demanderPleinEcran } from "./PageCoursCampus";

/**
 * Bandeau « Touchez l'écran pour reprendre le cours. » à l'arrivée sur la page ? Non quand on vient de toucher « Entrer
 * dans le live » (repère laissé par la page du cours, consommé ici) ; oui après un rechargement ou un ordinateur
 * rallumé : le navigateur n'a reçu aucun geste, ni le plein écran ni le son ne peuvent repartir sans un toucher.
 */
function voileAuChargement(): boolean {
  let geste = 0;
  try {
    geste = Number(sessionStorage.getItem(CLE_GESTE_LIVE) ?? 0);
    sessionStorage.removeItem(CLE_GESTE_LIVE);
  } catch {
    /* navigateur sans stockage */
  }
  return !(geste && Date.now() - geste < 15_000);
}

function sortirDuPleinEcran() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
  } catch {
    /* rien à faire */
  }
}

type Tx = typeof textesCampus;

/** La raison de « Terminer le cours » (ou pourquoi il n'est pas proposé), en mots. */
function raisonTerminer(tx: Tx, f: FermetureCampusDto): string {
  if (f.terminer === "seul_campus") return tx("terminer.raison.seul");
  if (f.terminer === "fin_passee") return tx("terminer.raison.fin");
  if (f.terminer === "personne") return tx("terminer.raison.personne");
  if (f.terminer === "non_tenu") return tx("terminer.raison.nonTenu");
  if (f.sinon === "pas_commence") return tx("terminer.sinon.pasCommence");
  if (f.sinon === "attente_formateur") return tx("terminer.sinon.attente");
  return tx("terminer.sinon.autres");
}

export default function PageLiveCampus({ coursId }: { coursId: string }) {
  const tx = useTextes(textesCampus);
  const id = Number(coursId);
  useEcranAllume(true);
  const [, naviguer] = useLocation();
  const recherche = useSearch();
  const params = new URLSearchParams(recherche);
  const seanceChoisie = Number(params.get("seance")) || null;
  const ouvrirDemande = params.get("ouvrir") === "1";
  const chemin = `/api/mon-campus/cours/${id}/live${seanceChoisie ? `?seance=${seanceChoisie}` : ""}`;
  const { data, error, refetch } = useApiCampus<LiveCampusDto>(chemin, 30_000);
  const queryClient = useQueryClient();
  const [voile, setVoile] = useState(voileAuChargement);
  const [feuille, setFeuille] = useState<null | "ajouter" | "fermer">(null);
  const [ouverture, setOuverture] = useState(false);
  const [erreurOuverture, setErreurOuverture] = useState<string | null>(null);
  const ouvertureLancee = useRef(false);
  const retourCours = lienCampus(`/mon-campus/cours/${id}`);

  const reprendre = () => {
    demanderPleinEcran();
    relancerSons(document.body);
    setVoile(false);
  };
  // Le bandeau n'a de sens que sur l'écran d'un cours (à venir ou en direct), pas sur « Le cours est fini ».
  const ecranDuCours = Boolean(data?.seanceId && !data.choix && (data.etat === "a_venir" || data.etat === "ouverte"));
  // Le premier toucher (ou touche du clavier), n'importe où sur l'écran, remet le plein écran et le son : le bandeau ne
  // bloque rien, personne n'a besoin de viser.
  useEffect(() => {
    if (!voile || !ecranDuCours) return;
    const geste = () => {
      demanderPleinEcran();
      relancerSons(document.body);
      setVoile(false);
    };
    document.addEventListener("click", geste, { capture: true, once: true });
    document.addEventListener("keydown", geste, { capture: true, once: true });
    return () => {
      document.removeEventListener("click", geste, { capture: true });
      document.removeEventListener("keydown", geste, { capture: true });
    };
  }, [voile, ecranDuCours]);

  const ouvrir = async (seanceId: number) => {
    setOuverture(true);
    setErreurOuverture(null);
    try {
      const dto = await post<LiveCampusDto>(lienCampus(`/api/mon-campus/seances/${seanceId}/ouvrir`));
      queryClient.setQueryData([lienCampus(chemin)], dto);
      await rafraichir(`/api/seances/${seanceId}`);
    } catch (e) {
      setErreurOuverture(e instanceof ErreurApi ? e.message : tx("accueil.erreur"));
      void refetch();
    } finally {
      setOuverture(false);
    }
  };

  // Arrivée par « Entrer dans le live » (?ouvrir=1) : la salle s'ouvre une seule fois, puis l'adresse perd « ouvrir »
  // (un rechargement ne rouvre rien).
  useEffect(() => {
    if (!ouvrirDemande || !data || ouvertureLancee.current) return;
    ouvertureLancee.current = true;
    naviguer(lienCampus(`/mon-campus/cours/${id}/live`, { seance: seanceChoisie }), { replace: true });
    if (data.etat === "a_venir" && data.peutOuvrir && data.seanceId && !data.choix) void ouvrir(data.seanceId);
  }, [ouvrirDemande, data]);

  const sortir = (salleFermee: boolean) => {
    setFeuille(null);
    sortirDuPleinEcran();
    if (salleFermee) {
      try {
        sessionStorage.setItem(CLE_SALLE_FERMEE, "1");
      } catch {
        /* sans stockage : pas de ligne au retour */
      }
    }
    naviguer(retourCours);
  };

  const bandeau = (d: LiveCampusDto) => (seance: SeanceDetailDto | null, etat: EtatDirectDto | null) => (
    <BandeauCampus
      d={d}
      etat={etat}
      seance={seance}
      titre={seance?.coursTitre || d.cours.titre}
      onAjouter={() => setFeuille("ajouter")}
      onFermer={() => {
        if (d.etat === "ouverte" || d.etat === "a_venir") {
          void refetch();
          setFeuille("fermer");
        } else sortir(false);
      }}
      reprendre={voile && ecranDuCours ? reprendre : undefined}
    />
  );

  let contenu;
  if (!data) {
    contenu = error ? (
      <div className="flex flex-col items-center gap-6 px-6 py-24 text-center">
        <p className="text-[32px] font-black">{error instanceof Error ? error.message : tx("accueil.erreur")}</p>
        <button type="button" onClick={() => void refetch()} className="min-h-[72px] rounded-[20px] bg-orange px-8 text-[24px] font-black text-encre">
          {tx("accueil.reessayer")}
        </button>
        <Link href={retourCours} className="text-[22px] font-bold text-white underline underline-offset-4">
          {tx("live.revenir")}
        </Link>
      </div>
    ) : (
      <p className="px-6 py-24 text-center text-[32px] font-black text-nuit-doux">{tx("live.chargement")}</p>
    );
  } else if (data.choix) {
    // Deux séances du même cours à la même heure (deux sessions) : la personne choisit ; la séance choisie s'ouvre.
    contenu = (
      <>
        {bandeau(data)(null, null)}
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10">
          <p className="text-[40px] font-black leading-tight">{tx("live.choix")}</p>
          {data.choix.map((x) => (
            <button
              key={x.seanceId}
              type="button"
              onClick={() => {
                ouvertureLancee.current = false;
                naviguer(lienCampus(`/mon-campus/cours/${id}/live`, { seance: x.seanceId, ouvrir: 1 }), { replace: true });
              }}
              className="flex min-h-[120px] w-full flex-col justify-center rounded-[26px] px-6 py-4 text-left text-encre shadow-carte transition-transform duration-150 hover:-translate-y-0.5 active:scale-[.985]"
              style={{ background: "linear-gradient(135deg, #E4793A 0%, #F0A066 100%)" }}
              data-degrade="#E4793A,#F0A066"
              data-choix
            >
              <span className="text-[36px] font-black leading-tight">
                {x.heure}
                {x.classes ? ` · ${x.classes}` : ""}
              </span>
              {x.detail && <span className="text-[26px] font-bold leading-tight">{x.detail}</span>}
            </button>
          ))}
        </main>
      </>
    );
  } else if (data.seanceId && (data.etat === "a_venir" || data.etat === "ouverte")) {
    const avant =
      data.etat === "a_venir" ? (
        <div className="flex flex-col gap-3" data-avant-campus>
          {data.peutOuvrir ? (
            <>
              <button
                type="button"
                disabled={ouverture}
                onClick={() => void ouvrir(data.seanceId!)}
                className="flex min-h-[120px] w-full items-center justify-center gap-4 rounded-[26px] px-6 text-[30px] font-black text-encre shadow-carte transition-transform duration-150 hover:-translate-y-0.5 active:scale-[.985] disabled:opacity-80 sm:text-[40px]"
                style={{ background: "linear-gradient(135deg, #E4793A 0%, #F0A066 100%)" }}
              data-degrade="#E4793A,#F0A066"
                data-ouvrir-salle
              >
                <Play className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" aria-hidden />
                <span className="whitespace-nowrap">{ouverture ? tx("live.ouverture") : tx("live.ouvrir")}</span>
              </button>
              <p className="text-[24px] font-bold">{tx("live.ouvrir.texte", { v: { heure: data.heure ?? "" } })}</p>
              {data.ouvertureAutoA && <p className="text-[20px] text-nuit-doux">{tx("live.attendre.auto", { v: { heure: data.heure ?? "", ouverture: data.ouvertureAutoA } })}</p>}
            </>
          ) : (
            <p className="rounded-[24px] bg-nuit-carte px-6 py-5 text-[26px] font-black leading-snug sm:text-[32px]" role="status">
              {data.apresPrecedente && !data.ouvertureAutoA
                ? tx("live.apresPrecedente", { v: { heure: data.heure ?? "" } })
                : data.ouvertureAutoA
                  ? tx("live.attendre.auto", { v: { heure: data.heure ?? "", ouverture: data.ouvertureAutoA } })
                  : tx("live.commence", { v: { heure: data.heure ?? "" } })}
            </p>
          )}
          {erreurOuverture && (
            <p className="rounded-[20px] bg-[#2A1510] px-5 py-4 text-[24px] font-bold text-[#FFD2B3]" role="alert">
              {erreurOuverture}
            </p>
          )}
        </div>
      ) : undefined;
    contenu = (
      <EcranSeance
        key={data.seanceId}
        seanceId={data.seanceId}
        siteId={data.campus.id}
        campus={{ bandeau: (s, e) => bandeau(data)(s, e), avant, guide: tx("live.guide") }}
      />
    );
  } else {
    // Fini, annulé, pas eu lieu, ou pas de cours aujourd'hui : tester le son et l'image (salle d'essai).
    const titre =
      data.etat === "terminee" ? tx("live.fini") : data.etat === "annulee" ? tx("live.annule") : data.etat === "non_tenue" ? tx("live.nonTenu") : tx("live.aucun");
    contenu = (
      <>
        {bandeau(data)(null, null)}
        <SalleEssai titre={titre} motif={data.etat === "annulee" ? data.motif : null} prochaine={data.prochaine} retour={retourCours} onRetour={() => sortirDuPleinEcran()} />
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-nuit text-white">
      {contenu}
      {data && (
        <FeuilleAjouterCampus
          ouverte={feuille === "ajouter"}
          onFermer={() => setFeuille(null)}
          ajouts={data.ajouts}
          projectionPermise={data.projectionPermise}
          mesAjouts={data.mesAjouts}
          onFait={() => void refetch()}
        />
      )}
      {data && data.seanceId && (
        <FeuilleFermer
          ouverte={feuille === "fermer"}
          seanceId={data.seanceId}
          fermeture={data.fermeture}
          onRester={() => setFeuille(null)}
          onSalleFermee={() => sortir(true)}
          onTermine={(dto) => {
            setFeuille(null);
            queryClient.setQueryData([lienCampus(chemin)], dto);
            void rafraichir(`/api/seances/${data.seanceId}`);
          }}
          onRefus={() => void refetch()}
        />
      )}
    </div>
  );
}

/**
 * La feuille « Fermer » : « Fermer la salle » (cet ordinateur quitte le cours ; la classe continue pour le formateur et
 * les autres salles), puis « Terminer le cours » seulement quand c'est sans danger (sinon une ligne qui dit pourquoi),
 * et « Rester dans le live ». Chaque action passe par une confirmation.
 */
function FeuilleFermer({
  ouverte,
  seanceId,
  fermeture,
  onRester,
  onSalleFermee,
  onTermine,
  onRefus,
}: {
  ouverte: boolean;
  seanceId: number;
  fermeture: FermetureCampusDto | null;
  onRester: () => void;
  onSalleFermee: () => void;
  onTermine: (dto: LiveCampusDto) => void;
  onRefus: () => void;
}) {
  const tx = useTextes(textesCampus);
  const [confirmer, setConfirmer] = useState<null | "salle" | "terminer">(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (!ouverte) {
      setConfirmer(null);
      setErreur(null);
    }
  }, [ouverte]);
  const fermerSalle = async () => {
    setEnvoi(true);
    // Sans attendre la réponse au-delà d'une seconde : la salle se ferme même si le réseau traîne.
    await Promise.race([post(lienCampus(`/api/mon-campus/seances/${seanceId}/fermer-salle`)).catch(() => undefined), new Promise((ok) => setTimeout(ok, 1000))]);
    setEnvoi(false);
    setConfirmer(null);
    onSalleFermee();
  };
  const terminer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const dto = await post<LiveCampusDto>(lienCampus(`/api/mon-campus/seances/${seanceId}/terminer`));
      setConfirmer(null);
      onTermine(dto);
    } catch (e) {
      setConfirmer(null);
      setErreur(e instanceof Error ? e.message : tx("accueil.erreur"));
      onRefus();
    } finally {
      setEnvoi(false);
    }
  };
  const details: ReactNode[] = [];
  if (fermeture?.terminer) details.push(raisonTerminer(tx, fermeture));
  if (fermeture?.formateurPresent) details.push(tx("terminer.formateurLa"));
  if (fermeture?.terminer === "fin_passee" && fermeture.autresSalles > 0) details.push(tx("terminer.autresSalles"));
  return (
    <FeuilleCampus ouverte={ouverte} titre={tx("fermer.titre")} onFermer={onRester}>
      <BlocNuit testId="fermer-salle" icone={<DoorClosed className="h-8 w-8" strokeWidth={2.25} />} titre={tx("fermer.salle")} sousTitre={tx("fermer.salle.texte")} onClick={() => setConfirmer("salle")} />
      {fermeture?.terminer ? (
        <BlocNuit
          testId="terminer"
          danger
          icone={<CircleStop className="h-8 w-8" strokeWidth={2.25} />}
          titre={tx("terminer")}
          sousTitre={`${tx("terminer.texte")} ${raisonTerminer(tx, fermeture)}`}
          onClick={() => setConfirmer("terminer")}
        />
      ) : (
        fermeture && (
          <p className="rounded-[22px] border-2 border-nuit-ligne px-5 py-4 text-[20px] font-semibold text-nuit-doux" data-terminer-sinon>
            {raisonTerminer(tx, fermeture)}
          </p>
        )
      )}
      {erreur && (
        <p className="rounded-[20px] bg-[#2A1510] px-5 py-4 text-[22px] font-bold text-[#FFD2B3]" role="alert">
          {erreur}
        </p>
      )}
      <button type="button" onClick={onRester} className="min-h-[72px] rounded-[22px] border-[3px] border-white px-6 text-[24px] font-black text-white hover:bg-white hover:text-encre" data-rester>
        {tx("fermer.rester")}
      </button>
      <Confirmation
        nuit
        ouverte={confirmer === "salle"}
        titre={tx("fermer.salle.confirm.titre")}
        texte={tx("fermer.salle.confirm.texte")}
        oui={tx("fermer.salle.oui")}
        non={tx("fermer.salle.non")}
        attente={envoi}
        onOui={() => void fermerSalle()}
        onNon={() => setConfirmer(null)}
      />
      <Confirmation
        nuit
        danger
        ouverte={confirmer === "terminer"}
        titre={tx("terminer.confirm.titre")}
        texte={tx("terminer.texte")}
        details={
          details.length ? (
            <ul className="flex flex-col gap-2 text-[20px] font-semibold text-[#FFD2B3]">
              {details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          ) : undefined
        }
        oui={tx("terminer.oui")}
        non={tx("terminer.non")}
        attente={envoi}
        onOui={() => void terminer()}
        onNon={() => setConfirmer(null)}
      />
    </FeuilleCampus>
  );
}

/**
 * Pas de cours aujourd'hui (ou fini, annulé, pas eu lieu) : le grand titre, « Vous pouvez tester le son et l'image. »,
 * le gros bouton orange, le prochain cours, « Revenir aux cours ». Le toucher monte la salle d'essai (un seul toucher :
 * caméra et micro de la salle ouverts) ; « Fermer la salle d'essai » la démonte.
 */
function SalleEssai({ titre, motif, prochaine, retour, onRetour }: { titre: string; motif: string | null; prochaine: LiveCampusDto["prochaine"]; retour: string; onRetour: () => void }) {
  const tx = useTextes(textesCampus);
  const [essai, setEssai] = useState(false);
  const [indisponible, setIndisponible] = useState(false);
  const obtenirAcces = async () => {
    try {
      return await post<AccesDaily>("/api/visio/essai/rejoindre");
    } catch (e) {
      if (e instanceof ErreurApi && e.statut === 503) setIndisponible(true);
      throw e;
    }
  };
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col items-center gap-7 px-4 py-12 text-center sm:py-16" data-salle-essai>
      <p className="text-[44px] font-black leading-[1.02] sm:text-[72px]">{titre}</p>
      {motif && <p className="rounded-[24px] bg-nuit-carte px-6 py-4 text-[26px] font-semibold">{motif}</p>}
      <p className="text-[26px] font-bold text-nuit-doux">{tx("live.essai.texte")}</p>
      {indisponible ? (
        <p className="rounded-[22px] bg-nuit-carte px-6 py-5 text-[24px] font-bold" role="status" data-essai-indisponible>
          {tx("live.essai.indisponible")}
        </p>
      ) : essai ? (
        <div className="flex w-full flex-col gap-4">
          <p className="rounded-[20px] bg-nuit-carte px-5 py-3 text-[20px] font-bold text-orange-peche" data-essai-bandeau>
            {tx("live.essai.bandeau")}
          </p>
          <div className="w-full overflow-hidden rounded-[28px] border-2 border-nuit-bord bg-black" style={{ height: "min(62dvh, 640px)" }} data-cadre-essai>
            <CadreDaily obtenirAcces={obtenirAcces} role="salle" tu={false} cameraAuDepart microAuDepart />
          </div>
          <button type="button" onClick={() => setEssai(false)} className="min-h-[72px] rounded-[22px] border-[3px] border-white px-6 text-[24px] font-black text-white hover:bg-white hover:text-encre" data-quitter-essai>
            {tx("live.essai.quitter")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEssai(true)}
          className="flex min-h-[120px] w-full max-w-2xl items-center justify-center gap-4 rounded-[26px] px-6 text-[30px] font-black text-encre shadow-carte transition-transform duration-150 hover:-translate-y-0.5 active:scale-[.985] sm:text-[36px]"
          style={{ background: "linear-gradient(135deg, #E4793A 0%, #F0A066 100%)" }}
              data-degrade="#E4793A,#F0A066"
          data-tester-son
        >
          <Volume2 className="h-12 w-12 shrink-0" aria-hidden />
          {tx("live.essai.bouton")}
        </button>
      )}
      {prochaine && <p className="text-[26px] font-bold text-nuit-doux">{tx("live.prochain", { v: { jour: prochaine.jour, heure: prochaine.heure } })}</p>}
      <Link
        href={retour}
        onClick={onRetour}
        className="flex min-h-[80px] w-full max-w-xl items-center justify-center gap-3 rounded-[24px] border-2 border-nuit-bord bg-nuit-carte px-6 text-[26px] font-black text-white no-underline hover:border-orange/60 hover:text-white"
      >
        <ArrowLeft className="h-8 w-8" aria-hidden />
        {tx("live.revenir")}
      </Link>
    </main>
  );
}

/**
 * Bandeau de l'écran du campus (72 px au moins) : logo détouré | « YAMOUSSOUKRO » et le titre du cours ; au centre
 * « En direct » ou « Salle ouverte · début à 8h30 » ; à droite l'heure, puis « Ajouter » et « Fermer » (pilules de
 * 56 px). Sur un écran bas (1024×600), il passe sur deux lignes sans rien couper.
 */
function BandeauCampus({
  d,
  etat,
  seance,
  titre,
  onAjouter,
  onFermer,
  reprendre,
}: {
  d: LiveCampusDto;
  etat: EtatDirectDto | null;
  seance: SeanceDetailDto | null;
  titre: string;
  onAjouter: () => void;
  onFermer: () => void;
  reprendre?: () => void;
}) {
  const tx = useTextes(textesCampus);
  const maintenant = useMaintenant(1000);
  const ecrans = etat?.campus.find((c) => c.siteId === d.campus.id)?.ecrans ?? d.ecransDuCampus;
  const enDirect = etat?.statut === "en_direct";
  const enAttente =
    enDirect && seance && (etat.attenteAnimateur || classeOuverteEnAvance({ statut: etat.statut, debut: seance.debut, demarreeLe: etat.demarreeLe, debutCours: etat.debutCours }, maintenant));
  const pilule = "flex min-h-[56px] shrink-0 items-center gap-2 rounded-full px-5 text-[18px] font-bold transition-colors duration-150";
  // Le QR de présence (une minute au début, à +15 et à +45 min) commence sous le bandeau : « Ajouter » et « Fermer »
  // restent à portée, sans rien recouvrir d'autre. Le bandeau publie son bord bas visible (0 une fois défilé).
  const refBandeau = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = refBandeau.current;
    if (!el) return;
    const racine = document.documentElement;
    const publier = () => racine.style.setProperty("--bandeau-campus", `${Math.max(0, Math.round(el.getBoundingClientRect().bottom))}px`);
    publier();
    const obs = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publier);
    obs?.observe(el);
    window.addEventListener("scroll", publier, { passive: true });
    window.addEventListener("resize", publier);
    return () => {
      obs?.disconnect();
      window.removeEventListener("scroll", publier);
      window.removeEventListener("resize", publier);
      racine.style.removeProperty("--bandeau-campus");
    };
  }, []);
  return (
    <header ref={refBandeau} className="flex flex-col gap-3 border-b border-nuit-ligne bg-nuit-panneau px-4 py-3 sm:px-6 lg:px-8" data-bandeau-campus>
      {/* Après un rechargement : un bandeau qui ne cache rien ; le premier toucher, n'importe où, suffit. */}
      {reprendre && (
        <button type="button" onClick={reprendre} className="w-full rounded-[18px] bg-[#F5C542] px-5 py-3 text-center text-[24px] font-black leading-tight text-encre sm:text-[28px]" data-voile>
          {tx("live.reprendre")}
        </button>
      )}
      <div className="flex min-h-[56px] flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex min-w-0 items-center gap-4">
          <img src="/marque-2iae-detouree.png" alt="Groupe Écoles 2IAE" className="h-10 w-auto shrink-0" />
          <span className="h-10 w-px shrink-0 bg-nuit-ligne" aria-hidden />
          <span className="flex min-w-0 flex-col">
            <span className="font-mono text-[14px] font-semibold uppercase tracking-[0.14em] text-orange-peche">{d.campus.nomCourt}</span>
            <span className="min-w-0 break-words text-[22px] font-bold leading-tight text-white">{titre}</span>
          </span>
        </div>
        {(enDirect || d.etat === "ouverte") && (
          <span className="flex shrink-0 items-center" data-etat-bandeau>
            {enAttente ? (
              <span className="inline-flex items-center gap-2.5 rounded-full bg-nuit-carte px-4 py-2 text-[18px] font-bold text-[#7BD3A6]">
                <PointVivant fixe />
                {tx("live.ouvert", { v: { heure: d.heure ?? "" } })}
              </span>
            ) : (
              <BadgeDirect className="px-4 py-2 text-sm" />
            )}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <span className="hidden font-mono text-[28px] tabular-nums text-white sm:inline">{heureLocale(maintenant)}</span>
          <button type="button" onClick={onAjouter} className={cn(pilule, "border border-nuit-bord bg-nuit-carte text-white hover:bg-[#24211F]")} data-ajouter>
            <Plus className="h-6 w-6" aria-hidden />
            {tx("live.ajouter")}
          </button>
          <button type="button" onClick={onFermer} className={cn(pilule, "border border-[#5A2A1A] text-[#FFB59E] hover:bg-[#2A1510]")} data-fermer>
            <DoorClosed className="h-6 w-6" aria-hidden />
            {tx("live.fermer")}
          </button>
        </div>
      </div>
      {ecrans >= 2 && (
        <span className="w-full rounded-[18px] bg-[#F5C542] px-4 py-2 text-[18px] font-bold text-encre" role="status" data-deux-ecrans>
          {tx("live.deuxEcrans", { v: { deCampus: deCampus(d.campus.nomCourt) } })} {tx("live.deuxEcrans.conseil")}
        </span>
      )}
    </header>
  );
}
