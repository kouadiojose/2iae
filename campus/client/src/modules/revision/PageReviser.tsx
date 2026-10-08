// /reviser — la révision du jour, sur un écran nu (on se concentre) : d'abord
// le défi de la classe (3 questions du dernier cours, les mêmes pour toute la
// classe), puis les cartes du jour, revues après 1, 2, 4, 8 puis 16 jours.
// Correction et explication tout de suite ; aucune note.
//
// Sans réseau, le paquet gardé sur le téléphone suffit : les réponses partent
// au retour du réseau et comptent pour le jour où elles ont été faites.
// ?seance=12 : « Réviser ce cours en 5 min » (cartes d'une seule séance) ;
// ?depuis=/chemin : la croix ramène à la page d'origine.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { CloudOff, Layers, Target, Users, X } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { BarreProgression, Chargement, EtatVide } from "@/components/ui/divers";
import { useMoiConnecte } from "@/lib/auth";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { listerFile } from "@/lib/file-envoi";
import { ecrireLocal } from "@/modules/pwa/outils";
import { ajouterJours, type Jour } from "@shared/engagement/calendrier";
import { boiteApres, CARTES_PAR_JOUR, type CarteDto, type OrigineReponse } from "@shared/engagement/revision";
import { formaterDate } from "@shared/textes";
import { t } from "@shared/textes/revision";
import { QuestionQcm } from "./QuestionQcm";
import { CarteMemo } from "./CarteMemo";
import { FinDeRevision } from "./FinDeRevision";
import { BoutonSignaler } from "./Signaler";
import {
  CLE_UTILISEE,
  envoyerReponses,
  jourDuTelephone,
  lirePaquet,
  noterReponse,
  poidsKo,
  reponsesEnAttente,
  telechargerPaquet,
  type PaquetLocal,
} from "./paquet";

type Etape = { carte: CarteDto; origine: OrigineReponse };
type Phase = "chargement" | "accueil" | "session" | "fin" | "sansPaquet";

/** Un paquet du jour plus vieux que cela est rafraîchi s'il n'a pas encore servi (cartes nouvelles ; le défi, lui, est figé pour la journée). */
const FRAICHEUR_MS = 30 * 60_000;
const minutes = (n: number) => Math.max(1, Math.round(n * 0.6));
const faite = (p: PaquetLocal, c: CarteDto) => Object.prototype.hasOwnProperty.call(p.repondues, c.id);

/** Le défi est-il relevé (par le campus, ou sur ce téléphone en attendant l'envoi) ? */
const defiFait = (p: PaquetLocal) => Boolean(p.defi && (p.defi.fait || p.defi.cartes.every((c) => faite(p, c))));

/** Les cartes d'une séance de révision : le défi (s'il reste à faire), puis les cartes du jour pas encore faites, ou 5 d'avance. */
function etapesDe(p: PaquetLocal, avance: boolean): Etape[] {
  const origine: OrigineReponse = p.seanceId ? "cours_complet" : "du_jour";
  if (avance) return cartesDAvance(p).slice(0, CARTES_PAR_JOUR).map((carte) => ({ carte, origine }));
  const defi = p.defi && !defiFait(p) ? p.defi.cartes.filter((c) => !faite(p, c)).map((carte) => ({ carte, origine: "defi" as const })) : [];
  return [...defi, ...cartesDuJour(p).map((carte) => ({ carte, origine }))];
}
const cartesDuJour = (p: PaquetLocal) => p.cartes.slice(0, p.parJour).filter((c) => !faite(p, c));
const cartesDAvance = (p: PaquetLocal) => p.cartes.slice(p.parJour).filter((c) => !faite(p, c));
/** « Prochaine révision demain » ou « le jeudi 15 octobre ». */
const texteProchaine = (tx: typeof t, jour: Jour, prochaine: Jour) =>
  prochaine === ajouterJours(jour, 1) ? tx("fini.demain") : tx("fini.prochaine", { v: { jour: formaterDate(`${prochaine}T12:00:00Z`, { style: "jour" }) } });

export default function PageReviser() {
  const moi = useMoiConnecte();
  const tx = useTextes(t);
  const [, naviguer] = useLocation();
  const params = new URLSearchParams(useSearch());
  const seanceId = Number(params.get("seance")) || null;
  const depuisDemande = params.get("depuis");
  const depuis = depuisDemande?.startsWith("/") && !depuisDemande.startsWith("//") ? depuisDemande : "/accueil";

  const [phase, setPhase] = useState<Phase>("chargement");
  const [paquet, setPaquet] = useState<PaquetLocal | null>(null);
  const [horsLigne, setHorsLigne] = useState(!navigator.onLine);
  const [etapes, setEtapes] = useState<Etape[]>([]);
  const [index, setIndex] = useState(0);
  const [choix, setChoix] = useState<number | null>(null);
  const [retournee, setRetournee] = useState(false);
  const [resultats, setResultats] = useState<{ carte: CarteDto; juste: boolean; origine: OrigineReponse }[]>([]);
  const [envoi, setEnvoi] = useState<"envoi" | "envoye" | "en_file" | "rien">("rien");

  // Ouverture : le paquet gardé s'il est du jour (aucune requête), sinon celui du campus, sinon l'ancien.
  useEffect(() => {
    let vivant = true;
    ecrireLocal(CLE_UTILISEE, "1");
    void envoyerReponses();
    const local = lirePaquet(moi.id, seanceId);
    const duJour = local && local.jour === jourDuTelephone(moi.fuseau);
    const servi = local && Object.keys(local.repondues).length > 0;
    const frais = local && Date.now() - new Date(local.genereLe).getTime() < FRAICHEUR_MS;
    if (local && duJour && (servi || frais || !navigator.onLine)) {
      setPaquet(local);
      setPhase("accueil");
      return;
    }
    if (local) setPaquet(local);
    telechargerPaquet(moi.id, seanceId)
      .then((p) => {
        if (!vivant) return;
        setPaquet(p);
        setHorsLigne(!navigator.onLine);
        setPhase("accueil");
      })
      .catch(() => {
        if (!vivant) return;
        setHorsLigne(true);
        setPhase(local ? "accueil" : "sansPaquet");
      });
    return () => {
      vivant = false;
    };
  }, [moi.id, moi.fuseau, seanceId]);

  useEffect(() => {
    const maj = () => setHorsLigne(!navigator.onLine);
    window.addEventListener("online", maj);
    window.addEventListener("offline", maj);
    return () => {
      window.removeEventListener("online", maj);
      window.removeEventListener("offline", maj);
      // On quitte l'écran : ce qui a été répondu part (ou attend le réseau dans la file).
      void envoyerReponses();
    };
  }, []);

  // Fin de révision en attente de réseau : au retour du réseau, les réponses partent (ou la file hors
  // ligne les envoie) et l'écran passe à « Tes réponses sont enregistrées ».
  useEffect(() => {
    if (phase !== "fin" || envoi === "envoye" || envoi === "envoi") return;
    const verifierFile = () =>
      void listerFile()
        .then((l) => {
          if (!l.some((e) => e.cle.startsWith("revision:")) && !reponsesEnAttente(moi.id)) setEnvoi("envoye");
        })
        .catch(() => undefined);
    const reussi = (ev: Event) => {
      if ((ev as CustomEvent<{ cle?: string }>).detail?.cle?.startsWith("revision:")) verifierFile();
    };
    const enLigne = () =>
      void envoyerReponses().then((s) => {
        if (s !== "rien") setEnvoi(s);
      });
    window.addEventListener("campus:envoi-reussi", reussi);
    window.addEventListener("online", enLigne);
    return () => {
      window.removeEventListener("campus:envoi-reussi", reussi);
      window.removeEventListener("online", enLigne);
    };
  }, [phase, envoi, moi.id]);

  const fermer = useCallback(() => naviguer(depuis), [naviguer, depuis]);

  const commencer = (avance = false) => {
    if (!paquet) return;
    const suite = etapesDe(paquet, avance);
    if (!suite.length) return;
    setEtapes(suite);
    setIndex(0);
    setChoix(null);
    setRetournee(false);
    setResultats([]);
    setEnvoi("rien");
    setPhase("session");
    window.scrollTo(0, 0);
  };

  const repondre = (reponse: { choixAffiche: number } | { savait: boolean }) => {
    if (!paquet) return;
    const etape = etapes[index];
    const r = noterReponse(paquet, etape.carte, etape.origine, reponse);
    setPaquet(r.paquet);
    setResultats((l) => [...l, { carte: etape.carte, juste: r.juste, origine: etape.origine }]);
    if ("choixAffiche" in reponse) setChoix(reponse.choixAffiche);
    else suivante();
  };

  const suivante = () => {
    if (index + 1 < etapes.length) {
      setIndex((i) => i + 1);
      setChoix(null);
      setRetournee(false);
      window.scrollTo(0, 0);
      return;
    }
    setPhase("fin");
    setEnvoi("envoi");
    void envoyerReponses().then(setEnvoi);
  };

  const bilan = useMemo(() => {
    if (!paquet) return null;
    const jour = paquet.jour;
    const restantes = paquet.cartes.filter((c) => !faite(paquet, c)).length;
    const demain = ajouterJours(jour, 1);
    let prochaine: Jour = demain;
    if (!restantes && !resultats.some((r) => !r.juste) && resultats.length) {
      prochaine = resultats
        .map((r) => boiteApres(r.carte.boite ? { boite: r.carte.boite, prochaine: jour } : null, r.juste, jour, ajouterJours).prochaine)
        .sort()[0];
    }
    return { restantes, prochaine, demain: prochaine === demain };
  }, [paquet, resultats]);

  const cadre = (contenu: React.ReactNode, entete?: React.ReactNode) => (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-20 border-b border-ligne-douce bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-2">
          <button type="button" onClick={fermer} className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-texte-doux hover:bg-creme" aria-label={tx("page.fermer")}>
            <X className="h-6 w-6" />
          </button>
          {entete ?? <span className="text-lg font-extrabold">{tx("page.titre")}</span>}
        </div>
      </header>
      <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 pb-12 pt-5">
        {horsLigne && phase !== "sansPaquet" && (
          <p className="flex items-start gap-2 rounded-2xl bg-creme px-4 py-3 text-sm text-texte-doux" role="status">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {tx("page.horsLigne")}
          </p>
        )}
        {contenu}
      </main>
    </div>
  );

  if (phase === "chargement") return cadre(<Chargement lignes={4} />);
  if (phase === "sansPaquet" || !paquet) {
    return cadre(
      <EtatVide
        icone={<CloudOff className="h-6 w-6" />}
        titre={tx("page.titre")}
        texte={tx("page.sansPaquet")}
        action={
          <Bouton taille="lg" onClick={() => window.location.reload()}>
            {tx("page.reessayer")}
          </Bouton>
        }
      />,
    );
  }

  const pied = (
    <footer className="flex flex-col gap-1 border-t border-ligne-douce pt-4 text-[13px] leading-relaxed text-texte-gris">
      <p>{tx("page.honnete")}</p>
      {paquet.cartes.length + (paquet.defi?.cartes.length ?? 0) > 0 && <p className="font-mono text-[11px]">{tx("page.poids", { v: { ko: poidsKo(paquet) } })}</p>}
    </footer>
  );

  // ── Fin ──
  if (phase === "fin" && bilan) {
    const bonnes = resultats.filter((r) => r.juste).length;
    return cadre(
      <>
        <FinDeRevision
          bonnes={bonnes}
          total={resultats.length}
          prochaine={bilan.prochaine}
          demain={bilan.demain}
          encore={cartesDAvance(paquet).length}
          onEncore={() => commencer(true)}
          defiReleve={resultats.some((r) => r.origine === "defi") && defiFait(paquet)}
          envoi={envoi}
          enAttente={reponsesEnAttente(moi.id)}
          onFermer={fermer}
          libelleFermer={depuis === "/accueil" ? tx("fin.accueil") : tx("page.fermer")}
        />
        {pied}
      </>,
    );
  }

  // ── Une carte ──
  if (phase === "session") {
    const etape = etapes[index];
    const c = etape.carte;
    const lienSignaler = <BoutonSignaler carteId={c.id} />;
    const repondue = c.genre === "qcm" ? choix !== null : false;
    return cadre(
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-texte-gris">
          {etape.origine === "defi" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-clair px-2.5 py-1 text-orange-profond">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {tx("defi.titre")}
            </span>
          ) : (
            <span className="rounded-full bg-creme px-2.5 py-1">{c.boite ? tx("carte.boite", { v: { n: c.boite } }) : tx("carte.nouvelle")}</span>
          )}
          <span>{c.cours}</span>
        </div>
        {c.genre === "qcm" && c.options && c.bonne !== undefined ? (
          <QuestionQcm
            question={c.question}
            options={c.options}
            bonne={c.bonne}
            explication={c.explication}
            choix={choix}
            onChoisir={(i) => repondre({ choixAffiche: i })}
            suite={{ libelle: index + 1 < etapes.length ? tx("suivante") : tx("resultat"), onClick: suivante }}
            sousCorrection={lienSignaler}
            defiler
          />
        ) : (
          <CarteMemo
            recto={c.question}
            verso={c.verso ?? ""}
            etiquette={c.cours}
            retournee={retournee}
            onRetourner={() => setRetournee((r) => !r)}
            onRepondre={(savait) => repondre({ savait })}
            pied={retournee ? lienSignaler : null}
          />
        )}
        {!repondue && c.genre === "qcm" && <p className="text-center text-xs text-texte-gris">{tx("page.honnete")}</p>}
      </div>,
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="font-mono text-xs text-texte-gris">{tx("carte.rang", { v: { i: index + 1, n: etapes.length } })}</span>
        <BarreProgression valeur={((index + (repondue ? 1 : 0)) / etapes.length) * 100} />
      </div>,
    );
  }

  // ── Accueil de la révision ──
  const defi = paquet.defi;
  const releve = defiFait(paquet);
  const duJour = cartesDuJour(paquet).length;
  const defiRestant = defi && !releve ? defi.cartes.filter((c) => !faite(paquet, c)).length : 0;
  const total = duJour + defiRestant;
  const avance = cartesDAvance(paquet).length;
  const ancien = paquet.jour !== jourDuTelephone(moi.fuseau);
  // Aucune carte dans ses cours (pas encore de cours complet), plutôt que « tout est révisé » :
  // une carte déjà vue a toujours un prochain retour.
  const vide = !paquet.cartes.length && !defi && !paquet.prochaine && !Object.keys(paquet.repondues).length;
  const prochaine = Object.keys(paquet.repondues).length ? ajouterJours(paquet.jour, 1) : paquet.prochaine;

  return cadre(
    <>
      <h1 className="text-[28px] font-black leading-tight tracking-serre">{tx("page.h1")}</h1>
      {ancien && <p className="text-sm text-texte-pale">{tx("page.ancien")}</p>}

      {vide ? (
        <EtatVide icone={<Layers className="h-6 w-6" />} titre={tx("vide.titre")} texte={tx("vide.texte")} />
      ) : (
        <>
          {defi && (
            <section className={cn("flex flex-col gap-2 rounded-3xl p-5", releve ? "bg-succes-clair" : "bg-orange-pale")}>
              <p className="flex items-center gap-2 text-[17px] font-extrabold">
                <Target className={cn("h-5 w-5", releve ? "text-succes" : "text-orange-fonce")} aria-hidden />
                {releve ? tx("defi.fait") : tx("defi.titre")}
              </p>
              <p className="text-[15px] text-texte-doux">
                <span className="font-bold">{defi.cours}</span> · {tx("defi.sousTitre", { v: { n: defi.cartes.length } })}
              </p>
              {defi.releve && (
                <p className="flex items-center gap-1.5 font-mono text-[13px] text-texte-doux">
                  <Users className="h-4 w-4" aria-hidden />
                  {tx("defi.releve", { v: { n: defi.releve.n + (releve && !defi.fait ? 1 : 0), sur: defi.releve.sur } })}
                </p>
              )}
            </section>
          )}

          <section className="flex flex-col gap-1 rounded-3xl border border-ligne p-5">
            <p className="flex items-center gap-2 text-[17px] font-extrabold">
              <Layers className="h-5 w-5 text-orange-fonce" aria-hidden />
              {tx("cartes.titre")}
            </p>
            {duJour > 0 ? (
              <p className="text-[15px] text-texte-doux">{tx("cartes.resume", { v: { n: duJour, min: minutes(duJour) } })}</p>
            ) : (
              <p className="text-[15px] text-texte-doux">
                {tx("fini.titre")} {prochaine && texteProchaine(tx, paquet.jour, prochaine)}
              </p>
            )}
          </section>

          {total > 0 ? (
            <Bouton taille="lg" pleineLargeur className="min-h-[56px] text-[17px]" onClick={() => commencer(false)}>
              {defiRestant && !resultats.length ? tx("defi.relever") : tx("cartes.commencer")} · {minutes(total)} min
            </Bouton>
          ) : avance > 0 ? (
            <Bouton taille="lg" variante="contour" pleineLargeur onClick={() => commencer(true)}>
              {tx("fini.plus")}
            </Bouton>
          ) : null}
        </>
      )}
      {pied}
    </>,
  );
}
