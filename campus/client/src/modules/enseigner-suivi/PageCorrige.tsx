// /enseigner/corriges/:devoirId — un corrigé du jour, à vérifier : « est-ce que cela correspond à ce que
// vous avez expliqué ? ». QCM : les questions, les options et la bonne réponse bien visible, l'explication,
// et le lien vers l'éditeur de questions existant pour corriger une réponse (les notes déjà données sont
// recalculées). Exercice : la consigne, la grille et le corrigé (Markdown) ; « Modifier le corrigé » ouvre
// un éditeur, « Enregistrer et valider » l'envoie (PUT). UN bouton principal : « Valider le corrigé » (POST).
// Ensuite, l'état du corrigé et où en sont les copies notées par le campus. Version périmée (409, un
// collègue ou le campus l'a changé entre-temps) : on le dit et on recharge, sans perdre le texte écrit.
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronUp, Clock3, Eye, PenLine, School } from "lucide-react";
import { Page } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { ZoneTexte } from "@/components/ui/champs";
import { Badge, Chargement, Erreur } from "@/components/ui/divers";
import { Markdown } from "@/components/ui/markdown";
import { toast, toastErreur } from "@/components/ui/toast";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { useMoiConnecte } from "@/lib/auth";
import { ErreurApi, post, put } from "@/lib/api";
import { jourLong } from "@/lib/dates";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn, nomComplet } from "@/lib/utils";
import { LETTRES, nombre } from "@/modules/evaluations/outils";
import { resumeCopies, texteEcheance } from "@/modules/evaluations/composants/CorrectionCampus";
import { selonNombre, t, type CleCorrections } from "@shared/textes/corrections";
import type { CorpsModifierCorrige, CorpsValiderCorrige, CorrigeAValider, ListeCorriges, QuestionCorrige, ReponseCorrige } from "@shared/engagement/corrections";
import type { Traducteur } from "@shared/textes";

type Tx = Traducteur<CleCorrections>;
/** Une consigne plus longue se replie : le formateur la connaît, il vient vérifier le corrigé. */
const CONSIGNE_REPLIEE = 700;

export default function PageCorrige({ devoirId: brut }: { devoirId: string }) {
  const tx = useTextes(t);
  const moi = useMoiConnecte();
  const devoirId = Number(brut);
  const cle = ["/api/enseigner/corriges", devoirId];
  const { data: c, isLoading, error, refetch } = useQuery<CorrigeAValider>({ queryKey: cle, enabled: Number.isInteger(devoirId) });
  // La liste sert seulement à proposer le corrigé suivant après une validation.
  const liste = useQuery<ListeCorriges>({ queryKey: ["/api/enseigner/corriges"] });
  const maintenant = useMaintenant(60_000);

  const [edition, setEdition] = useState<string | null>(null);
  const [apercu, setApercu] = useState(false);
  const [envoi, setEnvoi] = useState<"valider" | "modifier" | null>(null);
  const [perime, setPerime] = useState<"lecture" | "edition" | null>(null);
  const [fait, setFait] = useState(false);

  // Version périmée : le message s'affiche au-dessus des boutons, à l'écran.
  useEffect(() => {
    if (perime) document.getElementById("alerte-perime")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [perime]);

  const retour = (
    <Link href="/enseigner/corriges" className="-mb-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-semibold text-texte-pale no-underline hover:text-encre">
      <ArrowLeft className="h-4 w-4" aria-hidden /> {tx("corrige.retour")}
    </Link>
  );

  if (isLoading) {
    return (
      <Page className="max-w-2xl gap-6">
        {retour}
        <Chargement lignes={4} />
      </Page>
    );
  }
  if (error || !c) {
    return (
      <Page className="max-w-2xl gap-6">
        {retour}
        <Erreur message={(error as Error)?.message ?? tx("corrige.introuvable")} reessayer={() => void refetch()} />
      </Page>
    );
  }

  const quiz = c.type === "quiz";
  // La vie scolaire consulte ; les formateurs du cours et la direction décident (le serveur le vérifie aussi).
  const lectureSeule = moi.role === "vie_scolaire";
  const peutValider = !lectureSeule && (c.statut === "propose" || c.statut === "tacite");
  // Un corrigé encore en préparation peut aussi être écrit par le formateur lui-même (PUT, version 1).
  const peutModifier = !lectureSeule && !quiz;
  const suivant = fait ? liste.data?.aValider.find((x) => x.devoirId !== devoirId) : undefined;

  /**
   * Le serveur a refusé une version périmée (409, details.version : la version actuelle) : on recharge le
   * corrigé jusqu'à cette version et on le dit ; le texte en cours reste dans l'éditeur. Une autre 409
   * (corrigé encore en préparation…) garde le message du serveur.
   */
  async function versionPerimee(e: unknown, enEdition: boolean): Promise<boolean> {
    const actuelle = e instanceof ErreurApi && e.statut === 409 ? (e.details as { version?: unknown } | undefined)?.version : undefined;
    if (typeof actuelle !== "number") return false;
    setPerime(enEdition ? "edition" : "lecture");
    let r = await refetch();
    // Un cache intermédiaire pourrait encore rendre l'ancienne version : un second essai suffit.
    if (r.data && r.data.version < actuelle) r = await refetch();
    void rafraichir("/api/enseigner/corriges");
    return true;
  }

  async function valider() {
    if (!c) return;
    setEnvoi("valider");
    try {
      const corps: CorpsValiderCorrige = { version: c.version };
      const r = await post<ReponseCorrige>(`/api/enseigner/corriges/${devoirId}/valider`, corps);
      queryClient.setQueryData(cle, r.corrige);
      setPerime(null);
      setFait(true);
      toast(tx("corrige.valide.toast"));
      window.scrollTo({ top: 0, behavior: "smooth" });
      void rafraichir("/api/enseigner/corriges", "/api/enseigner/apres-seance", "/api/enseigner/a-relire");
    } catch (e) {
      if (!(await versionPerimee(e, false))) toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  }

  async function enregistrer() {
    if (!c || edition === null) return;
    if (!edition.trim()) {
      toastErreur(new Error(tx("corrige.editeur.vide")));
      return;
    }
    setEnvoi("modifier");
    try {
      const corps: CorpsModifierCorrige = { version: c.version, contenu: edition.trim() };
      const r = await put<ReponseCorrige>(`/api/enseigner/corriges/${devoirId}`, corps);
      queryClient.setQueryData(cle, r.corrige);
      setEdition(null);
      setApercu(false);
      setPerime(null);
      setFait(true);
      toast(selonNombre(tx, "corrige.modifie.toast", r.copiesRecorrigees));
      window.scrollTo({ top: 0, behavior: "smooth" });
      void rafraichir("/api/enseigner/corriges", "/api/enseigner/apres-seance", "/api/devoirs");
    } catch (e) {
      if (!(await versionPerimee(e, true))) toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  }

  return (
    <Page className="max-w-2xl gap-6">
      {retour}
      <header className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-fonce">
          {c.coursCode} · {tx(quiz ? "corriges.quiz" : "corriges.depot")}
        </span>
        <h1 className="titre-page">{c.titre}</h1>
        <p className="text-sm text-texte-pale">
          {[c.seance ? tx("corrige.seance", { v: { jour: jourLong(c.seance.debut) } }) : c.coursTitre, tx("corrige.limite", { v: { jour: jourLong(c.dateLimite) } })].join(" · ")}
        </p>
        <p className="flex items-center gap-1.5 text-[13px] text-texte-gris">
          <School className="h-3.5 w-3.5 shrink-0" aria-hidden /> {tx(c.source === "campus" ? "source.campus" : "source.formateur")}
        </p>
      </header>

      <Etat c={c} tx={tx} maintenant={maintenant} duFormateur={lectureSeule} />

      {fait && suivant && (
        <LienBouton href={`/enseigner/corriges/${suivant.devoirId}`} taille="lg" className="min-h-[56px] w-full">
          {tx("corrige.suivant")} <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
        </LienBouton>
      )}

      {quiz ? (
        <section aria-labelledby="titre-questions" className="flex flex-col gap-3">
          <h2 id="titre-questions" className="flex items-baseline justify-between gap-3 text-lg font-extrabold">
            {tx("corrige.questionsTitre")}
            <span className="font-mono text-xs font-normal text-texte-gris">{selonNombre(tx, "corriges.questions", c.questions.length)}</span>
          </h2>
          <ol className="flex flex-col gap-3">
            {c.questions.map((q, i) => (
              <Question key={q.id} q={q} i={i} tx={tx} />
            ))}
          </ol>
          {!lectureSeule && (
            <div className="flex flex-col gap-1">
              <LienBouton href={`/enseigner/devoirs/${devoirId}`} variante="contour" icone={<PenLine className="h-4 w-4" />} className="min-h-[48px] self-start">
                {tx("corrige.modifierQuestions")}
              </LienBouton>
              <span className="text-[13px] text-texte-gris">{tx("corrige.modifierQuestions.aide")}</span>
            </div>
          )}
        </section>
      ) : (
        <>
          <Consigne source={c.consigne} tx={tx} />
          <section aria-labelledby="titre-grille" className="flex flex-col gap-2">
            <h2 id="titre-grille" className="flex items-baseline justify-between gap-3 text-lg font-extrabold">
              {tx("corrige.grille")}
              <span className="font-mono text-xs font-normal text-texte-gris">/{nombre(c.bareme)}</span>
            </h2>
            {c.grille.length ? (
              <ul className="flex flex-col divide-y divide-ligne-douce rounded-2xl border border-ligne bg-white">
                {c.grille.map((g) => (
                  <li key={g.critere} className="flex items-start gap-3 px-4 py-3">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[15px] font-semibold leading-snug">{g.critere}</span>
                      {g.description && <span className="text-[13px] leading-snug text-texte-pale">{g.description}</span>}
                    </span>
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums">{nombre(g.points)} pt</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl bg-creme px-4 py-3 text-sm text-texte-pale">{tx("corrige.grille.vide", { v: { bareme: nombre(c.bareme) } })}</p>
            )}
          </section>

          <section aria-labelledby="titre-corrige" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <h2 id="titre-corrige" className="text-lg font-extrabold">
                {tx("corrige.corrige")}
              </h2>
              {edition !== null && (
                <Bouton variante="fantome" taille="sm" icone={apercu ? <PenLine className="h-4 w-4" /> : <Eye className="h-4 w-4" />} onClick={() => setApercu((a) => !a)} className="min-h-[44px]">
                  {tx(apercu ? "corrige.ecrire" : "corrige.apercu")}
                </Bouton>
              )}
            </div>
            <p className="-mt-1 text-[13px] leading-snug text-texte-gris">{tx("corrige.corrige.aide")}</p>
            {edition === null ? (
              <div className="rounded-2xl border border-ligne bg-white p-4">
                {c.contenu.trim() ? <Markdown source={c.contenu} /> : <p className="text-texte-gris">{tx("corrige.corrige.vide")}</p>}
              </div>
            ) : apercu ? (
              <div className="min-h-[200px] rounded-2xl border border-ligne bg-creme/40 p-4">
                {edition.trim() ? <Markdown source={edition} /> : <p className="text-texte-gris">{tx("corrige.corrige.vide")}</p>}
              </div>
            ) : (
              <ZoneTexte value={edition} onChange={(e) => setEdition(e.target.value)} rows={14} autoFocus aria-label={tx("corrige.corrige")} aide={tx("corrige.editeur.aide")} />
            )}
            {edition !== null && (c.statut === "valide" || c.statut === "tacite") && <p className="text-[13px] leading-snug text-alerte">{tx("corrige.editeur.apresCoup")}</p>}
          </section>
        </>
      )}

      {/* Près des boutons : c'est là que le formateur regarde quand le serveur refuse une version périmée. */}
      {perime && (
        <p id="alerte-perime" className="flex scroll-mt-24 items-start gap-2 rounded-2xl bg-alerte-clair px-4 py-3 text-[15px] leading-snug text-alerte" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {tx(perime === "edition" ? "corrige.perime.edition" : "corrige.perime")}
        </p>
      )}

      {lectureSeule ? (
        <p className="rounded-2xl bg-creme px-4 py-3 text-sm text-texte-pale">{tx("corrige.lectureSeule")}</p>
      ) : edition !== null ? (
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Bouton taille="lg" icone={<Check className="h-5 w-5" />} onClick={() => void enregistrer()} chargement={envoi === "modifier"} className="min-h-[56px] sm:flex-1">
            {tx("corrige.enregistrer")}
          </Bouton>
          <Bouton
            variante="fantome"
            onClick={() => {
              setEdition(null);
              setApercu(false);
            }}
            className="min-h-[48px]"
          >
            {tx("corrige.annuler")}
          </Bouton>
        </div>
      ) : peutValider || peutModifier ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {peutValider && (
            <Bouton taille="lg" icone={<Check className="h-5 w-5" />} onClick={() => void valider()} chargement={envoi === "valider"} className="min-h-[56px] sm:flex-1">
              {tx(c.statut === "tacite" ? "corrige.confirmer" : "corrige.valider")}
            </Bouton>
          )}
          {peutModifier && (
            <Bouton
              variante={peutValider ? "contour" : "encre"}
              taille="lg"
              icone={<PenLine className="h-5 w-5" />}
              onClick={() => {
                setEdition(c.contenu);
                setApercu(false);
              }}
              className="min-h-[56px] sm:flex-1"
            >
              {tx("corrige.modifier")}
            </Bouton>
          )}
        </div>
      ) : null}

      <Copies c={c} tx={tx} />
    </Page>
  );
}

/** Où en est le corrigé : à valider (et quand il sera tenu pour bon), validé, tacite ou en préparation. */
function Etat({ c, tx, maintenant, duFormateur }: { c: CorrigeAValider; tx: Tx; maintenant: number; duFormateur: boolean }) {
  if (c.statut === "propose") {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-orange/60 bg-orange-pale p-4">
        <Badge ton="orange" className="self-start">
          {tx("statut.propose")}
        </Badge>
        {c.echeanceLe && (
          <p className="flex items-start gap-2 text-[15px] font-semibold leading-snug">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-orange-fonce" aria-hidden />
            {texteEcheance(tx, c.echeanceLe, maintenant, duFormateur)}
          </p>
        )}
        <p className="text-[17px] font-extrabold leading-snug">{tx("corrige.question")}</p>
      </div>
    );
  }
  if (c.statut === "en_preparation") {
    return <p className="rounded-2xl bg-creme px-4 py-3 text-[15px] leading-snug text-texte-doux">{tx("statut.enPreparation")}</p>;
  }
  const date = c.valideLe ? `${jourLong(c.valideLe)}` : "";
  return (
    <div className={cn("flex items-start gap-2.5 rounded-2xl p-4", c.statut === "valide" ? "bg-succes-clair" : "bg-creme")}>
      <CheckCircle2 className={cn("mt-0.5 h-5 w-5 shrink-0", c.statut === "valide" ? "text-succes" : "text-texte-pale")} aria-hidden />
      <p className="text-[15px] font-semibold leading-snug">
        {c.statut === "tacite"
          ? tx("statut.taciteLe", { v: { date } })
          : c.validePar
            ? tx("statut.valideLe", { v: { nom: nomComplet(c.validePar), date } })
            : tx("statut.valideLeSansNom", { v: { date } })}
      </p>
    </div>
  );
}

function Question({ q, i, tx }: { q: QuestionCorrige; i: number; tx: Tx }) {
  const courte = q.options.length === 0;
  return (
    <li className="flex flex-col gap-2.5 rounded-2xl border border-ligne bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[16px] font-bold leading-snug">
          <span className="mr-1.5 font-mono text-sm text-texte-gris">{i + 1}.</span>
          {q.enonce}
        </p>
        <span className="shrink-0 font-mono text-xs text-texte-gris">{selonNombre(tx, "corrige.points", q.points)}</span>
      </div>
      {courte ? (
        <p className="flex items-start gap-2 rounded-xl bg-succes-clair px-3 py-2 text-[15px] font-semibold text-succes">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {tx("corrige.reponsesAcceptees", { v: { reponses: q.bonnes.map(String).join(" ou ") } })}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {q.options.map((o, j) => {
            const bonne = q.bonnes.some((b) => Number(b) === j);
            return (
              <li
                key={j}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl px-3 py-2 text-[15px]",
                  bonne ? "border-[1.5px] border-succes bg-succes-clair font-semibold text-encre" : "text-texte-pale",
                )}
              >
                <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-[11px]", bonne ? "border-succes bg-succes text-white" : "border-current")}>
                  {LETTRES[j]}
                </span>
                <span className="flex-1 leading-snug">{o}</span>
                {/* La bonne réponse se lit aussi en mots, pas seulement en couleur. */}
                {bonne && (
                  <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold uppercase text-succes">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden min-[400px]:inline">{tx("corrige.bonneReponse")}</span>
                    <span className="sr-only min-[400px]:hidden">{tx("corrige.bonneReponse")}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {q.explication && <p className="rounded-xl bg-creme px-3 py-2 text-sm leading-relaxed text-texte-doux">{q.explication}</p>}
    </li>
  );
}

function Consigne({ source, tx }: { source: string; tx: Tx }) {
  const [ouverte, setOuverte] = useState(false);
  const longue = source.length > CONSIGNE_REPLIEE;
  return (
    <section aria-labelledby="titre-consigne" className="flex flex-col gap-2">
      <h2 id="titre-consigne" className="text-lg font-extrabold">
        {tx("corrige.consigne")}
      </h2>
      <div className={cn("relative overflow-hidden rounded-2xl bg-creme p-4", longue && !ouverte && "max-h-[260px]")}>
        <Markdown source={source} />
        {longue && !ouverte && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-creme" aria-hidden />}
      </div>
      {longue && (
        <button type="button" onClick={() => setOuverte((o) => !o)} aria-expanded={ouverte} className="flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-bold text-orange-fonce">
          {ouverte ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          {tx(ouverte ? "corrige.consigne.masquer" : "corrige.consigne.voir")}
        </button>
      )}
    </section>
  );
}

/** Après la validation : ce que le campus fait des copies (exercice) ou des tentatives (QCM). */
function Copies({ c, tx }: { c: CorrigeAValider; tx: Tx }) {
  const quiz = c.type === "quiz";
  const utilisable = c.statut === "valide" || c.statut === "tacite";
  return (
    <Carte className="flex flex-col gap-3 p-4 sm:p-5">
      <h2 className="text-lg font-extrabold">{tx("corrige.copiesTitre")}</h2>
      <p className="text-[15px] leading-snug text-texte-doux">{tx(quiz ? "corrige.quiz.auto" : utilisable ? "corrige.copies.enCours" : "corrige.copies.attente")}</p>
      <ul className="flex flex-wrap gap-1.5">
        {resumeCopies(tx, c).map((m) => (
          <li key={m}>
            <Badge ton="gris">{m}</Badge>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <LienBouton href={`/enseigner/devoirs/${c.devoirId}/copies`} variante="contour" className="min-h-[48px]">
          {tx(quiz ? "copies.voirResultats" : "copies.voir")}
        </LienBouton>
        {!quiz && c.copies.aRevoir > 0 && (
          <LienBouton href="/enseigner/a-revoir" variante="doux" className="min-h-[48px]">
            {tx("corrige.aRevoir")}
          </LienBouton>
        )}
      </div>
    </Carte>
  );
}
