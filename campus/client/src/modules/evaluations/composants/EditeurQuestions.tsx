// Éditeur des questions d'une interrogation : QCM, choix multiple, vrai/faux,
// réponse courte. « Proposer des questions avec l'IA » renvoie des brouillons
// marqués « Proposé par l'IA », que le formateur relit avant de les garder.
import { useState } from "react";
import { Plus, Trash2, PenLine, ArrowUp, ArrowDown, Sparkles, Check, X } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { Champ, Selection, ZoneTexte, CaseACocher } from "@/components/ui/champs";
import { Badge } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { toast, toastErreur } from "@/components/ui/toast";
import { post, patch, put, suppr } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { cn, pluriel } from "@/lib/utils";
import { TYPES_QUESTION, type QuestionEnseignant, type QuestionProposee, type TypeQuestion } from "@shared/schema";
import { LETTRES, LIBELLES_QUESTION, nombre } from "../outils";

type Brouillon = { type: TypeQuestion; enonce: string; options: string[]; bonnes: number[]; acceptees: string; explication: string; points: number };

const vide = (): Brouillon => ({ type: "qcm", enonce: "", options: ["", "", ""], bonnes: [], acceptees: "", explication: "", points: 1 });

const depuisQuestion = (q: QuestionProposee | QuestionEnseignant): Brouillon => ({
  type: q.type,
  enonce: q.enonce,
  options: q.type === "vrai_faux" ? ["Vrai", "Faux"] : q.type === "reponse_courte" ? [] : [...q.options],
  bonnes: q.type === "reponse_courte" ? [] : q.bonnesReponses.map(Number),
  acceptees: q.type === "reponse_courte" ? q.bonnesReponses.map(String).join(" ; ") : "",
  explication: q.explication ?? "",
  points: q.points,
});

/** Brouillon → corps attendu par l'API. */
const versApi = (b: Brouillon) => ({
  type: b.type,
  enonce: b.enonce.trim(),
  options: b.type === "reponse_courte" ? [] : b.type === "vrai_faux" ? ["Vrai", "Faux"] : b.options.map((o) => o.trim()).filter(Boolean),
  bonnesReponses:
    b.type === "reponse_courte"
      ? b.acceptees
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
      : b.bonnes,
  explication: b.explication.trim() || null,
  points: b.points || 1,
});

function FormulaireQuestion({ initial, onValider, onAnnuler, envoi }: { initial: Brouillon; onValider: (b: Brouillon) => void; onAnnuler: () => void; envoi?: boolean }) {
  const [b, setB] = useState<Brouillon>(initial);
  const maj = (champ: Partial<Brouillon>) => setB((x) => ({ ...x, ...champ }));
  const changerType = (type: TypeQuestion) =>
    maj({
      type,
      bonnes: [],
      options: type === "vrai_faux" ? ["Vrai", "Faux"] : type === "reponse_courte" ? [] : b.options.length >= 2 && b.type !== "vrai_faux" ? b.options : ["", "", ""],
    });
  const basculer = (i: number) => {
    if (b.type === "choix_multiple") maj({ bonnes: b.bonnes.includes(i) ? b.bonnes.filter((x) => x !== i) : [...b.bonnes, i].sort() });
    else maj({ bonnes: [i] });
  };
  return (
    <div className="flex flex-col gap-4 rounded-2xl border-2 border-orange/50 bg-orange-pale/40 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <Selection libelle="Type de question" value={b.type} onChange={(e) => changerType(e.target.value as TypeQuestion)}>
          {TYPES_QUESTION.map((t) => (
            <option key={t} value={t}>
              {LIBELLES_QUESTION[t]}
            </option>
          ))}
        </Selection>
        <Champ libelle="Points" type="number" inputMode="decimal" min={0.5} step={0.5} value={b.points} onChange={(e) => maj({ points: Number(e.target.value) })} />
      </div>
      <ZoneTexte libelle="Énoncé" rows={2} value={b.enonce} onChange={(e) => maj({ enonce: e.target.value })} placeholder="Ex. : Un modèle de langage…" />

      {b.type === "reponse_courte" ? (
        <Champ
          libelle="Réponses acceptées"
          value={b.acceptees}
          onChange={(e) => maj({ acceptees: e.target.value })}
          placeholder="FCFA ; franc CFA ; francs CFA"
          aide="Séparez les variantes par un point-virgule. Majuscules et accents ne comptent pas ; « 2,5 » et « 2.5 » sont équivalents."
        />
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-bold">
            Réponses possibles <span className="font-normal text-texte-pale">· touchez {b.type === "choix_multiple" ? "les bonnes réponses" : "la bonne réponse"}</span>
          </legend>
          {b.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => basculer(i)}
                aria-pressed={b.bonnes.includes(i)}
                aria-label={`Marquer ${LETTRES[i]} comme bonne réponse`}
                className={cn(
                  "grid h-12 w-12 shrink-0 place-items-center border-2 font-mono text-sm font-bold transition-colors",
                  b.type === "choix_multiple" ? "rounded-xl" : "rounded-full",
                  b.bonnes.includes(i) ? "border-succes bg-succes text-white" : "border-ligne bg-white text-texte-pale",
                )}
              >
                {b.bonnes.includes(i) ? <Check className="h-5 w-5" /> : LETTRES[i]}
              </button>
              {b.type === "vrai_faux" ? (
                <span className="flex-1 text-[15px] font-semibold">{o}</span>
              ) : (
                <>
                  <input
                    value={o}
                    onChange={(e) => maj({ options: b.options.map((x, j) => (j === i ? e.target.value : x)) })}
                    placeholder={`Réponse ${LETTRES[i]}`}
                    className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-ligne bg-white px-3 text-[15px] outline-none focus:border-orange"
                  />
                  {b.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => maj({ options: b.options.filter((_, j) => j !== i), bonnes: b.bonnes.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)) })}
                      className="grid h-12 w-10 shrink-0 place-items-center rounded-xl text-texte-gris hover:text-danger"
                      aria-label={`Retirer la réponse ${LETTRES[i]}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          {b.type !== "vrai_faux" && b.options.length < 6 && (
            <Bouton variante="fantome" taille="sm" icone={<Plus className="h-4 w-4" />} onClick={() => maj({ options: [...b.options, ""] })} className="self-start">
              Ajouter une réponse
            </Bouton>
          )}
        </fieldset>
      )}
      <Champ libelle="Explication (montrée avec la correction)" value={b.explication} onChange={(e) => maj({ explication: e.target.value })} placeholder="Pourquoi c'est la bonne réponse (facultatif)" />
      <div className="flex flex-wrap justify-end gap-2">
        <Bouton variante="contour" onClick={onAnnuler}>
          Annuler
        </Bouton>
        <Bouton onClick={() => onValider(b)} chargement={envoi}>
          Enregistrer la question
        </Bouton>
      </div>
    </div>
  );
}

function ApercuQuestion({ q, index }: { q: QuestionProposee | QuestionEnseignant; index: number }) {
  const bonnes = new Set(q.bonnesReponses.map(Number));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-texte-gris">Question {index + 1}</span>
        <Badge ton="gris" className="py-0.5">
          {LIBELLES_QUESTION[q.type]}
        </Badge>
        <span className="font-mono text-xs text-texte-gris">{nombre(q.points)} pt{q.points > 1 ? "s" : ""}</span>
      </div>
      <p className="text-[16px] font-bold leading-snug">{q.enonce}</p>
      {q.type === "reponse_courte" ? (
        <p className="text-sm text-texte-pale">
          Réponses acceptées : <strong className="text-succes">{q.bonnesReponses.join(" · ")}</strong>
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {q.options.map((o, j) => (
            <li key={j} className={cn("flex items-center gap-2 text-[15px]", bonnes.has(j) ? "font-semibold text-succes" : "text-texte-doux")}>
              <span className="font-mono text-xs">{LETTRES[j]}.</span> {o}
              {bonnes.has(j) && <Check className="h-4 w-4" />}
            </li>
          ))}
        </ul>
      )}
      {q.explication && <p className="text-sm italic text-texte-pale">{q.explication}</p>}
    </div>
  );
}

export function EditeurQuestions({ devoirId, questions, iaDisponible }: { devoirId: number; questions: QuestionEnseignant[]; iaDisponible: boolean }) {
  const [edition, setEdition] = useState<number | "nouvelle" | null>(questions.length ? null : "nouvelle");
  const [envoi, setEnvoi] = useState(false);
  const [ia, setIa] = useState(false);
  const recharger = () => rafraichir("/api/devoirs");

  async function enregistrer(b: Brouillon, id?: number) {
    setEnvoi(true);
    try {
      if (id) await patch(`/api/devoirs/${devoirId}/questions/${id}`, versApi(b));
      else await post(`/api/devoirs/${devoirId}/questions`, versApi(b));
      await recharger();
      setEdition(null);
      toast(id ? "Question modifiée." : "Question ajoutée.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(id: number) {
    try {
      await suppr(`/api/devoirs/${devoirId}/questions/${id}`);
      await recharger();
    } catch (e) {
      toastErreur(e);
    }
  }

  async function deplacer(i: number, sens: -1 | 1) {
    const ids = questions.map((q) => q.id);
    const j = i + sens;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      await put(`/api/devoirs/${devoirId}/questions/ordre`, { ids });
      await recharger();
    } catch (e) {
      toastErreur(e);
    }
  }

  const total = questions.reduce((s, q) => s + q.points, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">Questions</h2>
          <p className="text-sm text-texte-pale">
            {questions.length ? `${pluriel(questions.length, "question")} · ${nombre(total)} points, ramenés au barème` : "Ajoutez au moins une question pour pouvoir publier."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Bouton variante="encre" icone={<Sparkles className="h-4 w-4 text-orange" />} onClick={() => setIa(true)} disabled={!iaDisponible} className="min-h-[48px]">
            Proposer des questions avec l'IA
          </Bouton>
          {!iaDisponible && <span className="max-w-xs text-right text-xs text-texte-gris">L'IA n'est pas disponible pour le moment : écrivez vos questions vous-même.</span>}
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <li key={q.id}>
            {edition === q.id ? (
              <FormulaireQuestion initial={depuisQuestion(q)} onValider={(b) => void enregistrer(b, q.id)} onAnnuler={() => setEdition(null)} envoi={envoi} />
            ) : (
              <div className="flex gap-3 rounded-2xl border border-ligne bg-white p-4">
                <div className="min-w-0 flex-1">
                  <ApercuQuestion q={q} index={i} />
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" onClick={() => setEdition(q.id)} className="grid h-11 w-11 place-items-center rounded-xl text-texte-doux hover:bg-creme" aria-label="Modifier la question">
                    <PenLine className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => void deplacer(i, -1)} disabled={i === 0} className="grid h-11 w-11 place-items-center rounded-xl text-texte-doux hover:bg-creme disabled:opacity-30" aria-label="Monter">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => void deplacer(i, 1)} disabled={i === questions.length - 1} className="grid h-11 w-11 place-items-center rounded-xl text-texte-doux hover:bg-creme disabled:opacity-30" aria-label="Descendre">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => void supprimer(q.id)} className="grid h-11 w-11 place-items-center rounded-xl text-danger hover:bg-danger-clair" aria-label="Supprimer la question">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>

      {edition === "nouvelle" ? (
        <FormulaireQuestion initial={vide()} onValider={(b) => void enregistrer(b)} onAnnuler={() => setEdition(null)} envoi={envoi} />
      ) : (
        <Bouton variante="contour" icone={<Plus className="h-5 w-5" />} onClick={() => setEdition("nouvelle")} className="min-h-[52px]">
          Ajouter une question
        </Bouton>
      )}

      <FenetreIa ouverte={ia} onFermer={() => setIa(false)} devoirId={devoirId} onAjoutees={recharger} />
    </div>
  );
}

/** Questions proposées par l'IA : brouillon à relire, rien n'est enregistré sans le formateur. */
function FenetreIa({ ouverte, onFermer, devoirId, onAjoutees }: { ouverte: boolean; onFermer: () => void; devoirId: number; onAjoutees: () => Promise<unknown> }) {
  const [nombreQ, setNombreQ] = useState(5);
  const [niveau, setNiveau] = useState<"facile" | "moyen" | "difficile">("moyen");
  const [propositions, setPropositions] = useState<QuestionProposee[] | null>(null);
  const [gardees, setGardees] = useState<Set<number>>(new Set());
  const [attente, setAttente] = useState(false);

  async function proposer() {
    setAttente(true);
    try {
      const r = await post<{ questions: QuestionProposee[] }>(`/api/devoirs/${devoirId}/questions/generer`, { nombre: nombreQ, niveau });
      setPropositions(r.questions);
      setGardees(new Set(r.questions.map((_, i) => i)));
      if (!r.questions.length) toast("L'IA n'a rien proposé d'utilisable. Réessayez ou écrivez vos questions.", "info");
    } catch (e) {
      toastErreur(e);
    } finally {
      setAttente(false);
    }
  }

  async function garder() {
    if (!propositions) return;
    const choisies = propositions.filter((_, i) => gardees.has(i));
    if (!choisies.length) return;
    setAttente(true);
    try {
      await post(`/api/devoirs/${devoirId}/questions`, { questions: choisies });
      await onAjoutees();
      toast(`${pluriel(choisies.length, "question")} ajoutée${choisies.length > 1 ? "s" : ""}. Relisez-les avant de publier.`);
      setPropositions(null);
      onFermer();
    } catch (e) {
      toastErreur(e);
    } finally {
      setAttente(false);
    }
  }

  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      large
      titre="Proposer des questions avec l'IA"
      description="L'IA s'appuie sur les leçons du cours. Ses questions sont un brouillon : gardez, retirez ou modifiez-les ensuite."
      pied={
        propositions ? (
          <>
            <Bouton variante="contour" onClick={() => setPropositions(null)}>
              Proposer à nouveau
            </Bouton>
            <Bouton onClick={() => void garder()} chargement={attente} disabled={!gardees.size}>
              Garder {pluriel(gardees.size, "question")}
            </Bouton>
          </>
        ) : (
          <Bouton onClick={() => void proposer()} chargement={attente} icone={<Sparkles className="h-4 w-4" />}>
            Proposer
          </Bouton>
        )
      }
    >
      {!propositions ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Selection libelle="Nombre de questions" value={nombreQ} onChange={(e) => setNombreQ(Number(e.target.value))}>
            {[3, 5, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n} questions
              </option>
            ))}
          </Selection>
          <Selection libelle="Niveau" value={niveau} onChange={(e) => setNiveau(e.target.value as typeof niveau)}>
            <option value="facile">Facile</option>
            <option value="moyen">Moyen</option>
            <option value="difficile">Difficile</option>
          </Selection>
          {attente && <p className="text-sm text-texte-pale sm:col-span-2">L'IA lit les leçons et prépare ses questions… (quelques secondes)</p>}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {propositions.map((q, i) => (
            <li key={i} className={cn("flex flex-col gap-3 rounded-2xl border p-4", gardees.has(i) ? "border-orange bg-orange-pale/40" : "border-ligne opacity-60")}>
              <Badge ton="orange" className="self-start">
                <Sparkles className="h-3 w-3" /> Proposé par l'IA
              </Badge>
              <ApercuQuestion q={q} index={i} />
              <CaseACocher
                checked={gardees.has(i)}
                onChange={(v) =>
                  setGardees((s) => {
                    const n = new Set(s);
                    if (v) n.add(i);
                    else n.delete(i);
                    return n;
                  })
                }
                libelle="Garder cette question"
              />
            </li>
          ))}
        </ul>
      )}
    </Fenetre>
  );
}
