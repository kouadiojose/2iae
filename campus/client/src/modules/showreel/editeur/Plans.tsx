// Étape 4 de l'éditeur : chaque plan en clair. Textes modifiables,
// réordonner, retirer, ajouter un plan d'un type donné. Le plan « campus » et
// la fin sont lus dans l'emploi du temps (non modifiables ici).
import { ArrowDown, ArrowUp, BadgeCheck, CalendarRange, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { Badge } from "@/components/ui/divers";
import { Menu, ElementMenu } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import {
  AIDES_TYPES_PLAN,
  CHAMPS_PAR_TYPE,
  LIBELLES_TYPES_PLAN,
  LIMITES_PLAN,
  PLANS_MAX,
  SOURCE_CAMPUS,
  SOURCE_PROFIL,
  TYPES_PLAN,
  estPlanCampus,
  planVide,
  type LienCampusShowreel,
  type PlanShowreel,
  type SourceShowreel,
  type TypePlan,
} from "@shared/schema";
import { heureH, idPlan, phraseCampus, rendezVous } from "../outils";

const CHAMP_BASE =
  "w-full rounded-xl border border-ligne bg-white px-3 py-2.5 text-[16px] text-encre placeholder:text-texte-gris outline-none focus:border-orange focus:ring-2 focus:ring-orange/20";

function nomSource(id: string | null, sources: SourceShowreel[], preuve: string): string {
  if (id === SOURCE_PROFIL) return "Profil du campus";
  if (id === SOURCE_CAMPUS) return "Emploi du temps";
  if (id === "pdf") return "PDF du profil";
  const s = sources.find((x) => x.id === id);
  if (s) return s.nom;
  if (/linkedin/i.test(preuve)) return "Profil LinkedIn (vérifié)";
  return "Écrit à la main";
}

function resumeCampus(p: PlanShowreel, c: LienCampusShowreel): string {
  if (p.type === "fin") return `${rendezVous(c) ?? "Bientôt en direct"} · ${phraseCampus(c)}${c.prochaineDateLibelle ? ` · prochain cours : ${c.prochaineDateLibelle}` : ""}`;
  if (!c.cours) return "Aucun cours ni créneau à venir pour l'instant : « Formateur du campus numérique » et les campus reliés.";
  const quand = c.jourLibelle && c.heureDebut ? ` · ${c.jourLibelle} ${heureH(c.heureDebut)}–${heureH(c.heureFin)} (Abidjan)` : "";
  const local = c.heureDebutLocale && c.ville ? ` · ${heureH(c.heureDebutLocale)} à ${c.ville}` : "";
  return `${c.cours.titre}${quand}${local}${c.public ? ` · ${c.public}` : ""}`;
}

function CartePlan({
  plan,
  index,
  total,
  sources,
  campus,
  onChange,
  onDeplacer,
  onRetirer,
}: {
  plan: PlanShowreel;
  index: number;
  total: number;
  sources: SourceShowreel[];
  campus: LienCampusShowreel;
  onChange: (p: PlanShowreel) => void;
  onDeplacer: (sens: -1 | 1) => void;
  onRetirer: () => void;
}) {
  const champs = CHAMPS_PAR_TYPE[plan.type];
  const maj = (partiel: Partial<PlanShowreel>) => onChange({ ...plan, ...partiel });
  const libelleElements = plan.type === "parcours" ? { nom: "Entreprise ou institution", detail: "Poste · lieu · années" } : { nom: "Domaine", detail: "Précision (facultatif)" };
  return (
    <li className={cn("rounded-2xl border bg-white", plan.aVerifier ? "border-alerte" : "border-ligne")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-ligne-douce px-3 py-2.5 sm:px-4">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-creme font-mono text-xs font-bold">{index + 1}</span>
        <span className="text-[15px] font-extrabold">{LIBELLES_TYPES_PLAN[plan.type]}</span>
        <span className="font-mono text-xs text-texte-gris">{plan.duree.toFixed(1).replace(".", ",")} s</span>
        <span className="flex-1" />
        <div className="flex items-center gap-1">
          <button type="button" disabled={index === 0} onClick={() => onDeplacer(-1)} className="grid h-10 w-10 place-items-center rounded-lg text-texte-pale hover:bg-creme hover:text-encre disabled:opacity-30" aria-label={`Monter le plan ${index + 1}`}>
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" disabled={index === total - 1} onClick={() => onDeplacer(1)} className="grid h-10 w-10 place-items-center rounded-lg text-texte-pale hover:bg-creme hover:text-encre disabled:opacity-30" aria-label={`Descendre le plan ${index + 1}`}>
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={onRetirer} className="grid h-10 w-10 place-items-center rounded-lg text-texte-pale hover:bg-danger-clair hover:text-danger" aria-label={`Retirer le plan ${index + 1}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        {estPlanCampus(plan.type) ? (
          <div className="flex items-start gap-3 rounded-xl bg-creme p-3">
            <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
            <div className="min-w-0 text-[14px]">
              <p className="font-semibold text-encre">{resumeCampus(plan, campus)}</p>
              <p className="mt-0.5 text-texte-pale">Repris de l'emploi du temps au moment de l'affichage : toujours à jour, jamais écrit par l'IA.</p>
            </div>
          </div>
        ) : (
          <>
            {champs
              .filter((c) => c.champ !== "elements")
              .map((c) => {
                const max = c.champ === "surtitre" ? LIMITES_PLAN.surtitre : c.champ === "titre" ? LIMITES_PLAN.titre : c.champ === "valeur" ? LIMITES_PLAN.valeur : LIMITES_PLAN.texte;
                const valeur = plan[c.champ as "surtitre" | "titre" | "texte" | "valeur"];
                const id = `plan-${plan.id}-${c.champ}`;
                return (
                  <div key={c.champ} className="flex flex-col gap-1">
                    <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-bold">
                      {c.libelle}
                      <span className={cn("font-mono text-[11px] font-normal", valeur.length > max * 0.9 ? "text-alerte" : "text-texte-gris")}>
                        {valeur.length}/{max}
                      </span>
                    </label>
                    {c.champ === "texte" ? (
                      <textarea id={id} rows={plan.type === "citation" ? 3 : 2} maxLength={max} placeholder={c.exemple} value={valeur} onChange={(e) => maj({ texte: e.target.value })} className={cn(CHAMP_BASE, "resize-y leading-snug")} />
                    ) : (
                      <input id={id} maxLength={max} placeholder={c.exemple} value={valeur} onChange={(e) => maj({ [c.champ]: e.target.value } as Partial<PlanShowreel>)} className={cn(CHAMP_BASE, c.champ === "valeur" && "max-w-[180px] text-xl font-black")} />
                    )}
                  </div>
                );
              })}
            {champs.some((c) => c.champ === "elements") && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-bold">{champs.find((c) => c.champ === "elements")?.libelle}</legend>
                {plan.elements.map((e, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_40px] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px]">
                    <input aria-label={`${libelleElements.nom} ${i + 1}`} maxLength={LIMITES_PLAN.elementNom} placeholder={libelleElements.nom} value={e.nom} onChange={(ev) => maj({ elements: plan.elements.map((x, j) => (j === i ? { ...x, nom: ev.target.value } : x)) })} className={cn(CHAMP_BASE, "font-semibold")} />
                    <button type="button" onClick={() => maj({ elements: plan.elements.filter((_, j) => j !== i) })} className="row-span-2 grid h-11 w-10 place-items-center self-start rounded-lg text-texte-pale hover:bg-danger-clair hover:text-danger sm:order-3 sm:row-span-1" aria-label={`Retirer la ligne ${i + 1}`}>
                      <X className="h-4 w-4" />
                    </button>
                    <input aria-label={`${libelleElements.detail} ${i + 1}`} maxLength={LIMITES_PLAN.elementDetail} placeholder={libelleElements.detail} value={e.detail} onChange={(ev) => maj({ elements: plan.elements.map((x, j) => (j === i ? { ...x, detail: ev.target.value } : x)) })} className={cn(CHAMP_BASE, "text-[15px] sm:order-2")} />
                  </div>
                ))}
                {plan.elements.length < LIMITES_PLAN.elements && (
                  <Bouton variante="doux" taille="sm" className="self-start" icone={<Plus className="h-4 w-4" />} onClick={() => maj({ elements: [...plan.elements, { nom: "", detail: "" }] })}>
                    Ajouter une ligne
                  </Bouton>
                )}
              </fieldset>
            )}
          </>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Badge ton="gris">Source : {nomSource(plan.sourceId, sources, plan.preuve)}</Badge>
          {plan.aVerifier && (
            <>
              <Badge ton="alerte">
                <TriangleAlert className="h-3.5 w-3.5" /> À relire
              </Badge>
              <Bouton variante="fantome" taille="sm" icone={<BadgeCheck className="h-4 w-4" />} onClick={() => maj({ aVerifier: false })}>
                C'est vérifié
              </Bouton>
            </>
          )}
        </div>
        {plan.preuve && !estPlanCampus(plan.type) && (
          <details className="text-[13px] text-texte-pale">
            <summary className="cursor-pointer select-none font-semibold text-texte-doux">Extrait de la source</summary>
            <p className="mt-1 border-l-2 border-orange pl-3 italic">{plan.preuve}</p>
          </details>
        )}
      </div>
    </li>
  );
}

/** Insère un plan à sa place logique : avant le campus et la fin, sauf s'il s'agit d'eux. */
function inserer(plans: PlanShowreel[], nouveau: PlanShowreel): PlanShowreel[] {
  if (nouveau.type === "fin") return [...plans, nouveau];
  const iFin = plans.findIndex((p) => p.type === "fin");
  const iCampus = plans.findIndex((p) => p.type === "campus");
  const avant = nouveau.type === "campus" ? iFin : iCampus >= 0 ? iCampus : iFin;
  if (avant < 0) return [...plans, nouveau];
  return [...plans.slice(0, avant), nouveau, ...plans.slice(avant)];
}

export function EditeurPlans({
  plans,
  sources,
  campus,
  onChange,
}: {
  plans: PlanShowreel[];
  sources: SourceShowreel[];
  campus: LienCampusShowreel;
  onChange: (plans: PlanShowreel[]) => void;
}) {
  const plein = plans.length >= PLANS_MAX;
  const disponibles = TYPES_PLAN.filter((t) => !(estPlanCampus(t) && plans.some((p) => p.type === t)));
  const ajouter = (t: TypePlan) => {
    const p = planVide(t, idPlan());
    if (t === "ouverture") p.surtitre = "Formateur · Campus numérique 2IAE";
    if (t === "parcours" || t === "expertise") {
      p.surtitre = LIBELLES_TYPES_PLAN[t];
      p.elements = [{ nom: "", detail: "" }];
    }
    if (t === "realisation") p.surtitre = "Réalisation";
    if (estPlanCampus(t)) p.sourceId = SOURCE_CAMPUS;
    onChange(inserer(plans, p));
  };
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {plans.map((p, i) => (
          <CartePlan
            key={p.id}
            plan={p}
            index={i}
            total={plans.length}
            sources={sources}
            campus={campus}
            onChange={(x) => onChange(plans.map((y) => (y.id === x.id ? x : y)))}
            onDeplacer={(sens) => {
              const copie = [...plans];
              const [x] = copie.splice(i, 1);
              copie.splice(i + sens, 0, x);
              onChange(copie);
            }}
            onRetirer={() => onChange(plans.filter((y) => y.id !== p.id))}
          />
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <Menu
          align="start"
          declencheur={
            <Bouton variante="doux" icone={<Plus className="h-4 w-4" />} disabled={plein}>
              Ajouter un plan
            </Bouton>
          }
        >
          {disponibles.map((t) => (
            <ElementMenu key={t} onSelect={() => ajouter(t)}>
              <span className="flex flex-col">
                <span className="font-semibold">{LIBELLES_TYPES_PLAN[t]}</span>
                <span className="max-w-[280px] text-xs text-texte-gris">{AIDES_TYPES_PLAN[t]}</span>
              </span>
            </ElementMenu>
          ))}
        </Menu>
        <span className="font-mono text-xs text-texte-gris">
          {plans.length} plan{plans.length > 1 ? "s" : ""} sur {PLANS_MAX} au plus · 30 secondes au total, le rythme s'ajuste tout seul
        </span>
      </div>
    </div>
  );
}
