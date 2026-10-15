// /enseigner/mon-cours/:coursId/examen/nouveau[?devoir=ID] — « Créer un examen » en étapes simples (José, 15 octobre
// 2026 : « maintenant il peut lui aussi créer des examens et donner les critères à l'IA pour la correction »).
//   1. Quel examen ? « Questions à écrire » (l'IA corrige avec vos critères) ou « QCM » (corrigé tout seul).
//   2. Titre et date limite : l'examen est enregistré en brouillon (POST /api/devoirs, publie: false) ; l'adresse prend
//      ?devoir=ID (un retour du navigateur ou un rechargement reprend ce brouillon, jamais un deuxième).
//   3. Les questions : écrites, ou proposées par l'IA à partir du cours (POST …/examen/proposer), modifiables une à une
//      (QCM) ; enregistrées au « Suivant » (consigne).
//   4. (Questions à écrire) Les critères pour l'IA : enregistrés au « Suivant » comme corrigé validé par le professeur
//      (critères proposés par le campus laissés tels quels : validés) ; après la date limite, la correction automatique
//      existante note chaque copie avec eux.
//   5. Publier (PATCH /api/devoirs/:id { publie: true }), ou garder en brouillon.
// ?devoir=ID : un brouillon (le sien, ou préparé par l'IA) est rouvert ici, prérempli, avec son gros bouton « Publier ».
// Changer de type en revenant à l'étape 1 change le type du brouillon (et retire les questions de QCM devenues inutiles).
// « Retour à Vidéos et examens » enregistre ce qui est tapé avant de partir.
import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, ListChecks, PenLine, Sparkles, Trash2 } from "lucide-react";
import { Page } from "@/components/layout/coquille";
import { BandeauCours, GrosBloc, GrosBouton, RetourGros } from "@/components/ui/gros-blocs";
import { toast } from "@/components/ui/toast";
import { patch, post, suppr } from "@/lib/api";
import { dateCourte } from "@/lib/dates";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { t as tProf } from "@shared/textes/espace-prof";
import type { DevoirDetailEnseignant } from "@shared/schema";
import type { PropositionExamenDto } from "@shared/espace-prof";
import { useAccueilSimple } from "./simple/blocs";
import { cleResumeCours } from "./simple/blocs-cours";
import { cleVideosExamens } from "./PageVideosExamens";

type Type = "depot" | "quiz";
type QuestionQcm = DevoirDetailEnseignant["questions"][number];
const CHAMP = "min-h-[60px] w-full rounded-[16px] border-2 border-ligne bg-white px-4 text-[19px] text-encre outline-none focus:border-orange focus:ring-4 focus:ring-orange/20";
const ZONE = "w-full resize-y rounded-[16px] border-2 border-ligne bg-white px-4 py-3 text-[19px] leading-relaxed text-encre outline-none focus:border-orange focus:ring-4 focus:ring-orange/20";

/** Date du jour + n jours, au format des champs (AAAA-MM-JJ). */
const dansJours = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export default function PageCreerExamen({ coursId }: { coursId: string }) {
  const tx = useTextes(tProf);
  const id = Number(coursId);
  const [location, naviguer] = useLocation();
  const recherche = useSearch();
  const accueil = useAccueilSimple();
  const c = accueil.data?.cours.find((x) => x.coursId === id);
  const [etape, setEtape] = useState(1);
  const [type, setType] = useState<Type>("depot");
  const [titre, setTitre] = useState("");
  const [date, setDate] = useState(dansJours(7));
  const [heureLimite, setHeureLimite] = useState("23:59");
  const [duree, setDuree] = useState("");
  const [devoirId, setDevoirId] = useState<number | null>(() => {
    const n = Number(new URLSearchParams(recherche).get("devoir"));
    return Number.isInteger(n) && n > 0 ? n : null;
  });
  /** Le type tel qu'enregistré sur le serveur (null tant que rien n'est créé). */
  const [typeEnregistre, setTypeEnregistre] = useState<Type | null>(null);
  const [questions, setQuestions] = useState("");
  const [criteres, setCriteres] = useState("");
  /** Ce que le serveur a déjà (pour n'envoyer que ce qui change), et la version du corrigé lue. */
  const enregistre = useRef({ consigne: "", corrige: "", corrigeStatut: null as string | null, corrigeVersion: null as number | null });
  const [dejaPublie, setDejaPublie] = useState(false);
  const [occupe, setOccupe] = useState<null | "infos" | "ia" | "publier" | "brouillon" | "question" | "suivant" | "quitter">(null);
  const [choixIa, setChoixIa] = useState(false);
  // Toujours relu à l'ouverture (refetchOnMount) : le préremplissage attend cette lecture fraîche.
  const detail = useQuery<DevoirDetailEnseignant>({ queryKey: [`/api/devoirs/${devoirId}`], enabled: Boolean(devoirId), refetchOnMount: "always" });
  const repris = useRef(false);
  const etapes = type === "depot" ? 5 : 4;
  const numero = type === "quiz" && etape === 5 ? 4 : etape;
  const erreur = (e: unknown) => toast(e instanceof Error ? e.message : String(e), "erreur");
  const retourListe = `/enseigner/mon-cours/${id}/videos-examens`;
  const qcm = detail.data?.questions ?? [];

  // Brouillon repris (?devoir=ID) : tout est prérempli, on commence au titre. Jamais avec une copie du cache d'une
  // visite précédente : on attend la lecture fraîche du serveur.
  useEffect(() => {
    const d = detail.data;
    if (!d || repris.current || !detail.isFetchedAfterMount) return;
    repris.current = true;
    const t: Type = d.devoir.type === "quiz" ? "quiz" : "depot";
    setType(t);
    setTypeEnregistre(t);
    setTitre(d.devoir.titre);
    const limite = new Date(d.devoir.dateLimite).toISOString();
    setDate(limite.slice(0, 10));
    setHeureLimite(limite.slice(11, 16));
    setDuree(d.devoir.dureeMinutes ? String(d.devoir.dureeMinutes) : "");
    setDejaPublie(d.devoir.publie);
    if (t === "depot") setQuestions(d.devoir.consigne);
    if (d.corrige?.contenu && t === "depot") setCriteres(d.corrige.contenu);
    noter(d);
    setEtape(2);
    toast(tx("examen.reprise"), "info");
  }, [detail.data, detail.isFetchedAfterMount]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Garde ce que le serveur a enregistré, et la version du corrigé (évite un faux « modifié ailleurs » au PATCH suivant). */
  function noter(r: DevoirDetailEnseignant | null | undefined) {
    if (!r) return;
    enregistre.current = {
      consigne: r.devoir.consigne,
      corrige: r.corrige?.contenu ?? "",
      corrigeStatut: r.corrige?.statut ?? null,
      corrigeVersion: r.corrige?.version ?? null,
    };
  }

  const enregistrerInfos = async () => {
    setOccupe("infos");
    try {
      const dateLimite = new Date(`${date}T${heureLimite || "23:59"}:00Z`).toISOString();
      const corps: Record<string, unknown> = { titre: titre.trim(), dateLimite, ...(type === "quiz" ? { dureeMinutes: duree ? Number(duree) : null } : {}) };
      if (devoirId) {
        // Type changé en revenant à l'étape 1 : le brouillon suit (le serveur refuse s'il y a déjà des copies).
        if (typeEnregistre && typeEnregistre !== type) {
          if (typeEnregistre === "quiz") for (const q of qcm) await suppr(`/api/devoirs/${devoirId}/questions/${q.id}`);
          corps.type = type;
          if (type === "quiz") corps.consigne = "";
        }
        noter(await patch<DevoirDetailEnseignant>(`/api/devoirs/${devoirId}`, corps));
        setTypeEnregistre(type);
        await rafraichir(`/api/devoirs/${devoirId}`);
      } else {
        const r = await post<DevoirDetailEnseignant>("/api/devoirs", { coursId: id, type, consigne: "", publie: false, ...corps });
        repris.current = true;
        setDevoirId(r.devoir.id);
        setTypeEnregistre(type);
        noter(r);
        // Un rechargement ou un retour du navigateur reprend ce brouillon (jamais un deuxième).
        naviguer(`${location}?devoir=${r.devoir.id}`, { replace: true });
      }
      setEtape(3);
    } catch (e) {
      erreur(e);
    } finally {
      setOccupe(null);
    }
  };

  /** Enregistre la consigne (questions écrites) et les critères s'ils ont changé ; critères proposés gardés tels quels : validés. */
  const enregistrerTextes = async (avecCriteres: boolean) => {
    if (!devoirId || type !== "depot") return;
    const corps: Record<string, unknown> = {};
    if (questions.trim() !== enregistre.current.consigne.trim()) corps.consigne = questions.trim();
    const crit = criteres.trim();
    if (avecCriteres && crit && crit !== enregistre.current.corrige.trim()) {
      corps.corrige = crit;
      if (enregistre.current.corrigeVersion !== null) corps.corrigeVersion = enregistre.current.corrigeVersion;
    }
    if (Object.keys(corps).length) noter(await patch<DevoirDetailEnseignant>(`/api/devoirs/${devoirId}`, corps));
    if (avecCriteres && crit && crit === enregistre.current.corrige.trim() && enregistre.current.corrigeStatut === "propose" && enregistre.current.corrigeVersion !== null) {
      await post(`/api/enseigner/corriges/${devoirId}/valider`, { version: enregistre.current.corrigeVersion });
      enregistre.current.corrigeStatut = "valide";
    }
  };

  const suivantTextes = async (vers: number, avecCriteres: boolean) => {
    setOccupe("suivant");
    try {
      await enregistrerTextes(avecCriteres);
      setEtape(vers);
    } catch (e) {
      erreur(e);
    } finally {
      setOccupe(null);
    }
  };

  /** « Retour à Vidéos et examens » : ce qui est tapé est gardé dans le brouillon, puis on part. */
  const quitter = async () => {
    setOccupe("quitter");
    try {
      await enregistrerTextes(etape >= 4);
    } catch {
      /* on part quand même : le brouillon garde la dernière version enregistrée */
    } finally {
      setOccupe(null);
    }
    await rafraichir(cleVideosExamens(id), cleResumeCours(id), ...(devoirId ? [`/api/devoirs/${devoirId}`] : []));
    naviguer(retourListe);
  };

  const proposer = async (mode: "remplacer" | "ajouter") => {
    setChoixIa(false);
    setOccupe("ia");
    try {
      const r = await post<PropositionExamenDto>(`/api/enseigner/mon-cours/${id}/examen/proposer`, { type, nombre: type === "quiz" ? 10 : 5, titre: titre.trim() || undefined });
      if (r.type === "depot") {
        const lignes = r.questions.map((q, i) => `${i + 1}. ${q}`).join("\n\n");
        setQuestions((avant) => (mode === "ajouter" && avant.trim() ? `${avant.trim()}\n\n${lignes}` : lignes));
        if (mode === "remplacer" || !criteres.trim()) setCriteres(r.criteres);
      } else if (devoirId) {
        if (mode === "remplacer") for (const q of qcm) await suppr(`/api/devoirs/${devoirId}/questions/${q.id}`);
        for (const q of r.qcm) await post(`/api/devoirs/${devoirId}/questions`, { type: "qcm", enonce: q.enonce, options: q.options, bonnesReponses: [q.bonne], explication: q.explication, points: 1 });
        await rafraichir(`/api/devoirs/${devoirId}`);
      }
    } catch (e) {
      erreur(e);
    } finally {
      setOccupe(null);
    }
  };
  /** Des questions existent déjà : « Remplacer » ou « Ajouter à la suite » (jamais de doublons sans le vouloir). */
  const demanderIa = () => {
    const deja = type === "depot" ? Boolean(questions.trim()) : qcm.length > 0;
    if (deja) setChoixIa(true);
    else void proposer("remplacer");
  };

  const terminer = async (publier: boolean) => {
    if (!devoirId) return;
    setOccupe(publier ? "publier" : "brouillon");
    try {
      await enregistrerTextes(true);
      if (publier && !dejaPublie) await patch(`/api/devoirs/${devoirId}`, { publie: true });
      toast(dejaPublie ? tx("examen.enregistre") : publier ? tx("examen.publie") : tx("examen.garde"));
      await rafraichir(cleVideosExamens(id), cleResumeCours(id), "/api/devoirs", `/api/devoirs/${devoirId}`);
      naviguer(retourListe);
    } catch (e) {
      erreur(e);
    } finally {
      setOccupe(null);
    }
  };

  const peutSuivre3 = type === "depot" ? Boolean(questions.trim()) : qcm.length > 0;
  const chargementBrouillon = Boolean(devoirId) && !repris.current && !detail.error;

  return (
    <Page className="gap-6 sm:gap-8">
      <RetourGros href={retourListe} onClick={() => void quitter()}>
        {tx("examen.quitter")}
      </RetourGros>
      <BandeauCours couleur={c?.couleur ?? "#E4793A"} etiquette={c?.titre ?? ""} titre={tx("examen.titre")} />
      <div className="flex flex-col gap-2" aria-live="polite">
        <span className="font-mono text-[14px] font-semibold uppercase tracking-[0.14em] text-orange-profond" data-etape={numero}>
          {tx("examen.etape", { v: { n: numero, total: etapes } })}
        </span>
        <div className="flex gap-2" aria-hidden>
          {Array.from({ length: etapes }, (_, i) => (
            <span key={i} className={cn("h-2 flex-1 rounded-full", i < numero ? "bg-orange" : "bg-ligne")} />
          ))}
        </div>
      </div>

      {chargementBrouillon ? (
        <p className="text-[22px] font-bold text-texte-doux" aria-busy="true">
          …
        </p>
      ) : (
        <>
          {etape === 1 && (
            <section className="flex flex-col gap-4">
              <h2 className="font-sans text-[30px] font-black">{tx("examen.type.titre")}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                <GrosBloc
                  testId="type-depot"
                  icone={<PenLine className="h-8 w-8" strokeWidth={2.25} />}
                  cercle={{ fond: "#141414", couleur: "#FFFFFF" }}
                  titre={tx("examen.type.depot")}
                  sousTitre={tx("examen.type.depot.texte")}
                  className={cn(typeEnregistre === "depot" && "border-orange")}
                  onClick={() => {
                    setType("depot");
                    setEtape(2);
                  }}
                />
                <GrosBloc
                  testId="type-quiz"
                  icone={<ListChecks className="h-8 w-8" strokeWidth={2.25} />}
                  cercle={{ fond: "#FFF1E6", couleur: "#A34C17" }}
                  titre={tx("examen.type.quiz")}
                  sousTitre={tx("examen.type.quiz.texte")}
                  className={cn(typeEnregistre === "quiz" && "border-orange")}
                  onClick={() => {
                    setType("quiz");
                    setEtape(2);
                  }}
                />
              </div>
            </section>
          )}

          {etape === 2 && (
            <section className="flex max-w-3xl flex-col gap-5">
              <h2 className="font-sans text-[30px] font-black">{tx("examen.infos.titre")}</h2>
              <label className="flex flex-col gap-2 text-[19px] font-bold">
                {tx("examen.infos.nom")}
                <input className={CHAMP} value={titre} onChange={(e) => setTitre(e.target.value)} placeholder={tx("examen.infos.nom.exemple")} maxLength={200} data-champ="titre" />
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-[19px] font-bold">
                  {tx("examen.infos.date")}
                  <input type="date" className={CHAMP} value={date} min={dansJours(0)} onChange={(e) => setDate(e.target.value)} data-champ="date" />
                </label>
                <label className="flex flex-col gap-2 text-[19px] font-bold">
                  {tx("examen.infos.heure")}
                  <input type="time" className={CHAMP} value={heureLimite} onChange={(e) => setHeureLimite(e.target.value)} />
                </label>
              </div>
              {type === "quiz" && (
                <label className="flex flex-col gap-2 text-[19px] font-bold">
                  {tx("examen.infos.duree")}
                  <input type="number" inputMode="numeric" min={1} max={600} className={CHAMP} value={duree} onChange={(e) => setDuree(e.target.value)} />
                </label>
              )}
              <Navigation retour={() => setEtape(1)} suivant={() => void enregistrerInfos()} peutSuivre={titre.trim().length >= 2 && Boolean(date)} chargement={occupe === "infos"} />
            </section>
          )}

          {etape === 3 && (
            <section className="flex flex-col gap-5">
              <h2 className="font-sans text-[30px] font-black">{tx("examen.questions.titre")}</h2>
              <GrosBloc
                testId="ia-propose"
                ton="encre"
                icone={<Sparkles className="h-8 w-8" strokeWidth={2.25} />}
                titre={tx("examen.questions.ia")}
                sousTitre={occupe === "ia" ? tx("examen.questions.ia.attente") : tx("examen.questions.ia.texte")}
                attente={occupe === "ia"}
                onClick={occupe ? undefined : demanderIa}
              />
              {choixIa && (
                <div className="flex flex-col gap-3 rounded-[22px] border-2 border-orange bg-orange-clair p-5" role="alertdialog" aria-label={tx("examen.questions.ia.encore")} data-choix-ia>
                  <p className="text-[21px] font-black">{tx("examen.questions.ia.encore")}</p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <GrosBouton onClick={() => void proposer("remplacer")}>{tx("examen.questions.ia.remplacer")}</GrosBouton>
                    <GrosBouton ton="contour" onClick={() => void proposer("ajouter")}>
                      {tx("examen.questions.ia.ajouter")}
                    </GrosBouton>
                    <GrosBouton ton="contour" onClick={() => setChoixIa(false)}>
                      {tx("examen.questions.ia.annuler")}
                    </GrosBouton>
                  </div>
                </div>
              )}
              {type === "depot" ? (
                <label className="flex flex-col gap-2 text-[19px] font-bold">
                  {tx("examen.questions.depot.champ")}
                  <textarea className={cn(ZONE, "min-h-[260px]")} value={questions} onChange={(e) => setQuestions(e.target.value)} data-champ="questions" />
                </label>
              ) : (
                <ListeQcm devoirId={devoirId} questions={qcm} occupe={occupe === "question"} setOccupe={(v) => setOccupe(v ? "question" : null)} />
              )}
              <Navigation
                retour={() => setEtape(2)}
                suivant={() => (type === "depot" ? void suivantTextes(4, false) : setEtape(5))}
                peutSuivre={peutSuivre3}
                chargement={occupe === "suivant"}
              />
            </section>
          )}

          {etape === 4 && type === "depot" && (
            <section className="flex max-w-4xl flex-col gap-5">
              <h2 className="font-sans text-[30px] font-black">{tx("examen.criteres.titre")}</h2>
              <p className="text-[20px] text-texte-doux">{tx("examen.criteres.texte")}</p>
              <label className="flex flex-col gap-2 text-[19px] font-bold">
                {tx("examen.criteres.champ")}
                <textarea className={cn(ZONE, "min-h-[240px]")} value={criteres} onChange={(e) => setCriteres(e.target.value)} placeholder={tx("examen.criteres.exemple")} data-champ="criteres" />
              </label>
              <Navigation retour={() => setEtape(3)} suivant={() => void suivantTextes(5, true)} peutSuivre={Boolean(criteres.trim())} chargement={occupe === "suivant"} />
            </section>
          )}

          {etape === 5 && (
            <section className="flex max-w-4xl flex-col gap-5">
              <h2 className="font-sans text-[30px] font-black">{tx("examen.publier.titre")}</h2>
              <div className="flex flex-col gap-2 rounded-[24px] border-2 border-ligne bg-white p-6 shadow-carte">
                <p className="flex items-center gap-2 break-words text-[24px] font-black">
                  <ClipboardList className="h-6 w-6 shrink-0 text-orange-profond" aria-hidden /> {titre}
                </p>
                <p className="text-[19px]">{tx("examen.resume.limite", { v: { date: `${dateCourte(`${date}T12:00:00Z`)} · ${heureLimite.replace(":", "h")}` } })}</p>
                <p className="text-[19px]">{tx("examen.resume.questions", { v: { n: type === "quiz" ? qcm.length : questions.split(/\n+/).filter((l) => l.trim()).length } })}</p>
                {type === "depot" && (
                  <p className="flex items-center gap-2 text-[18px] font-bold text-[#145F3F]">
                    <CheckCircle2 className="h-5 w-5" aria-hidden /> {tx("videos.criteres.professeur")}
                  </p>
                )}
              </div>
              {dejaPublie ? (
                <>
                  <p className="text-[20px] text-texte-doux">{tx("examen.publier.dejaPublie")}</p>
                  <GrosBouton onClick={() => void terminer(true)} chargement={occupe === "publier"} disabled={Boolean(occupe)}>
                    {tx("examen.publier.enregistrer")}
                  </GrosBouton>
                </>
              ) : (
                <>
                  <p className="text-[20px] text-texte-doux">{type === "depot" ? tx("examen.publier.texte") : tx("examen.publier.quiz")}</p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <GrosBouton onClick={() => void terminer(true)} chargement={occupe === "publier"} disabled={Boolean(occupe)}>
                      {tx("examen.publier.bouton")}
                    </GrosBouton>
                    <GrosBouton ton="contour" onClick={() => void terminer(false)} chargement={occupe === "brouillon"} disabled={Boolean(occupe)}>
                      {tx("examen.publier.brouillon")}
                    </GrosBouton>
                  </div>
                </>
              )}
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <button type="button" onClick={() => setEtape(type === "depot" ? 4 : 3)} className="min-h-[48px] text-[18px] font-bold underline underline-offset-4">
                  {tx("examen.retour")}
                </button>
                {devoirId && (
                  <a href={`/enseigner/devoirs/${devoirId}`} className="inline-flex min-h-[48px] items-center text-[18px] font-bold text-orange-profond underline underline-offset-4">
                    {tx("examen.editeurComplet")}
                  </a>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </Page>
  );
}

function Navigation({ retour, suivant, peutSuivre, chargement }: { retour: () => void; suivant: () => void; peutSuivre: boolean; chargement?: boolean }) {
  const tx = useTextes(tProf);
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <GrosBouton onClick={suivant} disabled={!peutSuivre} chargement={chargement}>
        {tx("examen.suivant")}
      </GrosBouton>
      <GrosBouton ton="contour" onClick={retour}>
        {tx("examen.retour")}
      </GrosBouton>
    </div>
  );
}

/** Formulaire d'une question de QCM : en écrire une, ou modifier une question existante (préremplie). */
function FormulaireQuestion({
  depart,
  occupe,
  onEnregistrer,
  onAnnuler,
}: {
  depart?: QuestionQcm;
  occupe: boolean;
  onEnregistrer: (q: { enonce: string; options: string[]; bonne: number }) => void;
  onAnnuler: () => void;
}) {
  const tx = useTextes(tProf);
  const [enonce, setEnonce] = useState(depart?.enonce ?? "");
  const [options, setOptions] = useState<string[]>(() => {
    const o = [...(depart?.options ?? [])];
    while (o.length < 4) o.push("");
    return o;
  });
  const [bonne, setBonne] = useState(() => Number(depart?.bonnesReponses?.[0] ?? 0));
  const nom = `bonne-${depart?.id ?? "nouvelle"}`;
  const valider = () => {
    // Les réponses vides sont retirées : la bonne réponse garde la sienne.
    const gardees = options.map((o, j) => ({ o: o.trim(), j })).filter((x) => x.o);
    const indice = Math.max(0, gardees.findIndex((x) => x.j === bonne));
    onEnregistrer({ enonce: enonce.trim(), options: gardees.map((x) => x.o), bonne: indice });
  };
  return (
    <div className="flex flex-col gap-3 rounded-[22px] border-2 border-orange bg-creme p-5" data-formulaire-question={depart?.id ?? "nouvelle"}>
      <label className="flex flex-col gap-2 text-[18px] font-bold">
        {tx("examen.questions.enonce")}
        <textarea className={cn(ZONE, "min-h-[90px]")} value={enonce} onChange={(e) => setEnonce(e.target.value)} />
      </label>
      {options.map((o, j) => (
        <div key={j} className="flex items-center gap-3">
          <input
            type="radio"
            name={nom}
            checked={bonne === j}
            onChange={() => setBonne(j)}
            className="h-6 w-6 shrink-0 accent-[#16774C]"
            aria-label={`${tx("examen.questions.bonne")} : ${tx("examen.questions.option", { v: { n: j + 1 } })}`}
          />
          <input className={CHAMP} value={o} placeholder={tx("examen.questions.option", { v: { n: j + 1 } })} onChange={(e) => setOptions(options.map((x, k) => (k === j ? e.target.value : x)))} />
        </div>
      ))}
      <p className="text-[16px] text-texte-doux">{tx("examen.questions.bonne.aide")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <GrosBouton onClick={valider} chargement={occupe} disabled={!enonce.trim() || options.filter((x) => x.trim()).length < 2 || !options[bonne]?.trim()}>
          {depart ? tx("examen.publier.enregistrer") : tx("examen.questions.enregistrer")}
        </GrosBouton>
        <GrosBouton ton="contour" onClick={onAnnuler}>
          {tx("documents.annuler")}
        </GrosBouton>
      </div>
    </div>
  );
}

/** Les questions du QCM (enregistrées dans le devoir) : les voir, en écrire une, en modifier une, en retirer une (confirmé). */
function ListeQcm({ devoirId, questions, occupe, setOccupe }: { devoirId: number | null; questions: QuestionQcm[]; occupe: boolean; setOccupe: (v: boolean) => void }) {
  const tx = useTextes(tProf);
  const [ouvert, setOuvert] = useState(false);
  const [enModif, setEnModif] = useState<number | null>(null);
  const [aRetirer, setARetirer] = useState<number | null>(null);
  const enregistrer = async (q: { enonce: string; options: string[]; bonne: number }, qid?: number) => {
    if (!devoirId) return;
    setOccupe(true);
    try {
      const corps = { type: "qcm", enonce: q.enonce, options: q.options, bonnesReponses: [q.bonne] };
      if (qid) await patch(`/api/devoirs/${devoirId}/questions/${qid}`, corps);
      else await post(`/api/devoirs/${devoirId}/questions`, { ...corps, points: 1 });
      setOuvert(false);
      setEnModif(null);
      await rafraichir(`/api/devoirs/${devoirId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "erreur");
    } finally {
      setOccupe(false);
    }
  };
  const retirer = async (qid: number) => {
    if (!devoirId) return;
    try {
      await suppr(`/api/devoirs/${devoirId}/questions/${qid}`);
      await rafraichir(`/api/devoirs/${devoirId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "erreur");
    } finally {
      setARetirer(null);
    }
  };
  return (
    <div className="flex flex-col gap-3" data-liste-qcm={questions.length}>
      {!questions.length && <p className="text-[19px] text-texte-doux">{tx("examen.questions.aucune")}</p>}
      {questions.map((q, i) =>
        enModif === q.id ? (
          <FormulaireQuestion key={q.id} depart={q} occupe={occupe} onEnregistrer={(v) => void enregistrer(v, q.id)} onAnnuler={() => setEnModif(null)} />
        ) : (
          <article key={q.id} className="rounded-[20px] border-2 border-ligne bg-white p-4 shadow-carte" data-question={q.id}>
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-clair text-[16px] font-black text-orange-profond">{i + 1}</span>
              <p className="min-w-0 flex-1 break-words text-[19px] font-bold">{q.enonce}</p>
            </div>
            <ul className="mt-2 grid grid-cols-1 gap-1 pl-12 sm:grid-cols-2">
              {q.options.map((o, j) => (
                <li key={j} className={cn("break-words text-[17px]", q.bonnesReponses.map(Number).includes(j) ? "font-bold text-[#145F3F]" : "text-texte-doux")}>
                  {q.bonnesReponses.map(Number).includes(j) ? "✓ " : "· "}
                  {o}
                </li>
              ))}
            </ul>
            {aRetirer === q.id ? (
              <div className="mt-3 flex flex-col gap-2 rounded-[16px] bg-danger-clair p-3 sm:flex-row sm:items-center" role="alertdialog" aria-label={tx("examen.questions.retirer.titre", { v: { n: i + 1 } })}>
                <span className="text-[16px] font-bold text-[#7A2E0E] sm:flex-1">{tx("examen.questions.retirer.titre", { v: { n: i + 1 } })}</span>
                <button type="button" onClick={() => void retirer(q.id)} className="min-h-[48px] rounded-[12px] bg-[#B42318] px-4 text-[16px] font-black text-white" data-confirmer-retrait-question>
                  {tx("examen.questions.retirer.oui")}
                </button>
                <button type="button" onClick={() => setARetirer(null)} className="min-h-[48px] rounded-[12px] border-2 border-encre bg-white px-4 text-[16px] font-bold">
                  {tx("examen.questions.retirer.non")}
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2 pl-12">
                <button
                  type="button"
                  onClick={() => {
                    setOuvert(false);
                    setEnModif(q.id);
                  }}
                  className="inline-flex min-h-[48px] items-center gap-1 rounded-[14px] border-2 border-encre px-4 text-[16px] font-bold"
                  aria-label={`${tx("examen.questions.modifier")} ${i + 1}`}
                  data-modifier-question={q.id}
                >
                  <PenLine className="h-4 w-4" aria-hidden /> {tx("examen.questions.modifier")}
                </button>
                <button type="button" onClick={() => setARetirer(q.id)} className="inline-flex min-h-[48px] items-center gap-1 px-3 text-[16px] font-bold text-[#B42318]" aria-label={`${tx("examen.questions.retirer")} ${i + 1}`}>
                  <Trash2 className="h-4 w-4" aria-hidden /> {tx("examen.questions.retirer")}
                </button>
              </div>
            )}
          </article>
        ),
      )}
      {ouvert ? (
        <FormulaireQuestion occupe={occupe} onEnregistrer={(v) => void enregistrer(v)} onAnnuler={() => setOuvert(false)} />
      ) : (
        <GrosBouton
          ton="contour"
          onClick={() => {
            setEnModif(null);
            setOuvert(true);
          }}
          icone={<PenLine className="h-6 w-6" aria-hidden />}
        >
          {tx("examen.questions.ajouter")}
        </GrosBouton>
      )}
    </div>
  );
}
