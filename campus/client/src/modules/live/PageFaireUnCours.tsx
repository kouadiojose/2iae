// /enseigner/nouveau — « Faire un cours », en un seul écran (21 novembre 2026, José : « il est très compliqué de créer un
// cours à la volée, il faut chercher, chercher, chercher »). Avant : inventer un code, l'éditeur du cours, les classes
// campus par campus, publier, puis la grande page d'une séance. Ici, trois questions en gros boutons :
//   1. Quel cours ? (un de mes cours, ou un nouveau : son nom et pour qui) ;
//   2. Quand ? (maintenant, ou plus tard : le jour et l'heure) ;
//   3. Combien de temps ?
// Un seul bouton à la fin. Maintenant : la classe s'ouvre et le professeur y entre. Plus tard : les étudiants sont
// prévenus. Le code du cours est trouvé par le campus (POST /api/enseigner/cours-express). Personnel vouvoyé.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Check, MonitorPlay, Plus, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { Page } from "@/components/layout/coquille";
import { toast, toastErreur } from "@/components/ui/toast";
import type { CoursResume, OptionsEditionCours } from "@shared/schema";

const DUREES: [number, string][] = [
  [60, "1 h"],
  [120, "2 h"],
  [180, "3 h"],
  [240, "4 h"],
];

type Reponse = { seanceId: number; coursId: number; coursCode: string; coursTitre: string; nouveau: boolean; maintenant: boolean; prevenus: number; conflits: unknown[] };

/** Un gros choix à toucher (56 px au moins), coché quand il est choisi. */
function Choix({ actif, onClick, children, sous, icone, className }: { actif: boolean; onClick: () => void; children: ReactNode; sous?: ReactNode; icone?: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        "flex min-h-[64px] items-center gap-3 rounded-[20px] border-2 px-5 py-3 text-left text-[20px] font-black leading-tight transition-colors",
        actif ? "border-orange bg-orange text-encre shadow-carte" : "border-ligne bg-white text-encre hover:border-orange",
        className,
      )}
    >
      {icone && <span className="shrink-0">{icone}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="break-words">{children}</span>
        {sous && <span className={cn("text-[15px] font-semibold", actif ? "text-encre/80" : "text-texte-doux")}>{sous}</span>}
      </span>
      {actif && <Check className="h-6 w-6 shrink-0" strokeWidth={3} />}
    </button>
  );
}

function Question({ numero, titre, children }: { numero: number; titre: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-3 text-[26px] leading-tight text-encre sm:text-[30px]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-encre text-[20px] font-black text-white">{numero}</span>
        {titre}
      </h2>
      {children}
    </section>
  );
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);

export default function PageFaireUnCours() {
  const [, naviguer] = useLocation();
  const recherche = useSearch();
  const coursDemande = Number(new URLSearchParams(recherche).get("cours")) || null;
  const { data: liste, isLoading } = useQuery<CoursResume[]>({ queryKey: ["/api/cours"] });
  const { data: options } = useQuery<OptionsEditionCours>({ queryKey: ["/api/cours/options"] });
  const mesCours = useMemo(() => (liste ?? []).filter((c) => c.enseignant && c.statut !== "archive"), [liste]);

  // 1. Quel cours : un de mes cours (son id) ou « nouveau ».
  const [choix, setChoix] = useState<number | "nouveau" | null>(coursDemande);
  const [titreCours, setTitreCours] = useState("");
  const [niveaux, setNiveaux] = useState<string[]>([]);
  /** Filières cochées, « niveau|filière ». Aucune pour un niveau : toutes ses filières. */
  const [filieres, setFilieres] = useState<string[]>([]);
  const [affiner, setAffiner] = useState(false);
  /** Les classes sans étudiant restent repliées (« Voir les autres classes »). */
  const [toutes, setToutes] = useState(false);
  // 2. Quand.
  const [quand, setQuand] = useState<"maintenant" | "plus_tard">("maintenant");
  const [date, setDate] = useState(aujourdhui);
  const [heureDebut, setHeureDebut] = useState("08:30");
  // 3. Durée et sujet.
  const [duree, setDuree] = useState(120);
  const [sujet, setSujet] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // Aucun cours encore : on part directement sur « nouveau ». Un seul : il est déjà choisi.
  useEffect(() => {
    if (choix !== null || isLoading) return;
    if (!mesCours.length) setChoix("nouveau");
    else if (mesCours.length === 1) setChoix(mesCours[0].id);
  }, [choix, isLoading, mesCours]);

  // Les classes que la personne peut choisir, regroupées par niveau puis par filière, tous campus confondus.
  const parNiveau = useMemo(() => {
    const m = new Map<string, { effectif: number; filieres: Map<string, { effectif: number; ids: number[] }> }>();
    for (const s of options?.sites ?? []) {
      if (!s.modifiable) continue;
      for (const c of s.classes) {
        const n = m.get(c.niveau) ?? { effectif: 0, filieres: new Map() };
        const f = n.filieres.get(c.filiere) ?? { effectif: 0, ids: [] };
        f.effectif += c.effectif;
        f.ids.push(c.id);
        n.effectif += c.effectif;
        n.filieres.set(c.filiere, f);
        m.set(c.niveau, n);
      }
    }
    // Les classes qui ont des étudiants d'abord, les plus nombreuses en tête.
    return [...m.entries()].sort((a, b) => b[1].effectif - a[1].effectif || a[0].localeCompare(b[0], "fr"));
  }, [options]);

  const classeIds = useMemo(() => {
    const ids: number[] = [];
    for (const [niveau, n] of parNiveau) {
      if (!niveaux.includes(niveau)) continue;
      const cochees = [...n.filieres.keys()].filter((f) => filieres.includes(`${niveau}|${f}`));
      for (const [f, x] of n.filieres) if (!cochees.length || cochees.includes(f)) ids.push(...x.ids);
    }
    return ids;
  }, [parNiveau, niveaux, filieres]);
  const effectif = useMemo(() => {
    let t = 0;
    for (const [niveau, n] of parNiveau) {
      if (!niveaux.includes(niveau)) continue;
      const cochees = [...n.filieres.keys()].filter((f) => filieres.includes(`${niveau}|${f}`));
      for (const [f, x] of n.filieres) if (!cochees.length || cochees.includes(f)) t += x.effectif;
    }
    return t;
  }, [parNiveau, niveaux, filieres]);

  const basculer = (liste: string[], v: string) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]);
  const coursChoisi = typeof choix === "number" ? mesCours.find((c) => c.id === choix) : undefined;

  const manque =
    choix === null
      ? "Choisissez un cours."
      : choix === "nouveau" && titreCours.trim().length < 3
        ? "Donnez un nom au cours."
        : choix === "nouveau" && !classeIds.length
          ? "Choisissez pour qui est le cours."
          : quand === "plus_tard" && (!date || !heureDebut)
            ? "Choisissez le jour et l'heure."
            : null;

  const valider = async () => {
    if (manque) return toast(manque, "erreur");
    let debut: string | null = null;
    if (quand === "plus_tard") {
      // Heure d'Abidjan (GMT), comme partout sur le campus.
      const d = new Date(`${date}T${heureDebut}:00Z`);
      if (Number.isNaN(d.getTime())) return toast("Date ou heure invalide.", "erreur");
      if (d.getTime() < Date.now()) return toast("Cette heure est déjà passée. Choisissez « Maintenant » ou une heure à venir.", "erreur");
      debut = d.toISOString();
    }
    setEnvoi(true);
    try {
      const r = await post<Reponse>("/api/enseigner/cours-express", {
        ...(typeof choix === "number" ? { coursId: choix } : { titreCours: titreCours.trim(), classeIds }),
        sujet: sujet.trim() || undefined,
        debut,
        dureeMinutes: duree,
      });
      if (r.maintenant) {
        // La classe s'ouvre tout de suite (les étudiants sont prévenus), et le professeur y entre.
        await post(`/api/seances/${r.seanceId}/demarrer`, {}).catch(() => undefined);
        await rafraichir("/api/cours", "/api/seances", "/api/accueil", "/api/live/en-cours", "/api/agenda");
        naviguer(`/live/${r.seanceId}`);
      } else {
        await rafraichir("/api/cours", "/api/seances", "/api/accueil", "/api/agenda");
        toast(r.prevenus ? `Cours programmé. ${r.prevenus} étudiant${r.prevenus > 1 ? "s" : ""} prévenu${r.prevenus > 1 ? "s" : ""}.` : "Cours programmé.");
        naviguer("/enseigner");
      }
    } catch (e) {
      toastErreur(e);
      setEnvoi(false);
    }
  };

  return (
    <Page className="max-w-[860px] gap-7 pb-40">
      <button type="button" onClick={() => naviguer("/enseigner")} className="-mb-2 flex min-h-[44px] items-center gap-2 self-start text-[18px] font-bold text-texte-doux">
        <ArrowLeft className="h-5 w-5" /> Retour
      </button>
      <header className="flex flex-col gap-1">
        <h1 className="text-[40px] leading-[1.02] text-encre sm:text-[52px]">Faire un cours</h1>
        <p className="text-[20px] text-texte-doux">Trois questions, et la classe est prête.</p>
      </header>

      <Question numero={1} titre="Quel cours ?">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mesCours.map((c) => (
            <Choix key={c.id} actif={choix === c.id} onClick={() => setChoix(c.id)} sous={c.nbEtudiants != null ? `${c.code} · ${c.nbEtudiants} étudiant${c.nbEtudiants > 1 ? "s" : ""}` : c.code}>
              {c.titre}
            </Choix>
          ))}
          <Choix actif={choix === "nouveau"} onClick={() => setChoix("nouveau")} icone={<Plus className="h-6 w-6" strokeWidth={3} />} sous="Donnez son nom et choisissez les classes">
            Un nouveau cours
          </Choix>
        </div>

        {choix === "nouveau" && (
          <div className="flex flex-col gap-4 rounded-[24px] border-2 border-ligne bg-creme p-5 sm:p-6" data-nouveau-cours>
            <label className="flex flex-col gap-2">
              <span className="text-[20px] font-black">Le nom du cours</span>
              <input
                value={titreCours}
                onChange={(e) => setTitreCours(e.target.value)}
                placeholder="Par exemple : Droit des affaires"
                maxLength={140}
                autoFocus
                className="min-h-[60px] rounded-[16px] border-2 border-ligne bg-white px-4 text-[22px] font-bold outline-none focus:border-orange"
              />
            </label>
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[20px] font-black">
                <Users className="h-5 w-5" /> Pour qui ?
              </span>
              <p className="text-[16px] text-texte-doux">Tous les campus sont compris. Touchez une ou plusieurs classes.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {parNiveau
                  .filter(([niveau, n]) => toutes || n.effectif > 0 || niveaux.includes(niveau) || !parNiveau.some(([, x]) => x.effectif > 0))
                  .map(([niveau, n]) => (
                  <Choix
                    key={niveau}
                    actif={niveaux.includes(niveau)}
                    onClick={() => {
                      setNiveaux((l) => basculer(l, niveau));
                      setFilieres((l) => l.filter((x) => !x.startsWith(`${niveau}|`)));
                    }}
                    sous={`${n.effectif} étudiant${n.effectif > 1 ? "s" : ""} · ${n.filieres.size} filière${n.filieres.size > 1 ? "s" : ""}`}
                  >
                    {niveau}
                  </Choix>
                ))}
              </div>
              {!parNiveau.length && <p className="text-[18px] font-bold text-texte-doux">Les classes arrivent…</p>}
              {!toutes && parNiveau.some(([, n]) => n.effectif > 0) && parNiveau.some(([, n]) => n.effectif === 0) && (
                <button type="button" onClick={() => setToutes(true)} className="min-h-[44px] self-start text-[17px] font-bold text-orange-profond underline underline-offset-4">
                  Voir les autres classes
                </button>
              )}
              {niveaux.length > 0 && (
                <>
                  <button type="button" onClick={() => setAffiner((v) => !v)} className="min-h-[44px] self-start text-[17px] font-bold text-orange-profond underline underline-offset-4">
                    {affiner ? "Garder toutes les filières" : "Seulement certaines filières ?"}
                  </button>
                  {affiner &&
                    parNiveau
                      .filter(([niveau]) => niveaux.includes(niveau))
                      .map(([niveau, n]) => (
                        <div key={niveau} className="flex flex-col gap-2">
                          <span className="text-[16px] font-black uppercase tracking-wide text-texte-doux">{niveau}</span>
                          <div className="flex flex-wrap gap-2">
                            {[...n.filieres.entries()]
                              .sort((a, b) => a[0].localeCompare(b[0], "fr"))
                              .map(([f, x]) => {
                                const cle = `${niveau}|${f}`;
                                const actif = filieres.includes(cle);
                                return (
                                  <button
                                    key={cle}
                                    type="button"
                                    aria-pressed={actif}
                                    onClick={() => setFilieres((l) => basculer(l, cle))}
                                    className={cn("min-h-[48px] rounded-full border-2 px-4 text-[16px] font-bold", actif ? "border-orange bg-orange text-encre" : "border-ligne bg-white")}
                                  >
                                    {f} · {x.effectif}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      ))}
                  <p className="rounded-[16px] bg-white px-4 py-3 text-[18px] font-bold" role="status">
                    {effectif} étudiant{effectif > 1 ? "s" : ""} suivront ce cours.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </Question>

      <Question numero={2} titre="Quand ?">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Choix actif={quand === "maintenant"} onClick={() => setQuand("maintenant")} icone={<Zap className="h-6 w-6" />} sous="La classe s'ouvre tout de suite">
            Maintenant
          </Choix>
          <Choix actif={quand === "plus_tard"} onClick={() => setQuand("plus_tard")} icone={<CalendarClock className="h-6 w-6" />} sous="Les étudiants sont prévenus">
            Plus tard
          </Choix>
        </div>
        {quand === "plus_tard" && (
          <div className="grid grid-cols-1 gap-3 rounded-[24px] border-2 border-ligne bg-creme p-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-[18px] font-black">Le jour</span>
              <input type="date" value={date} min={aujourdhui()} onChange={(e) => setDate(e.target.value)} className="min-h-[60px] rounded-[16px] border-2 border-ligne bg-white px-4 text-[20px] font-bold outline-none focus:border-orange" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[18px] font-black">L'heure (heure d'Abidjan)</span>
              <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} className="min-h-[60px] rounded-[16px] border-2 border-ligne bg-white px-4 text-[20px] font-bold outline-none focus:border-orange" />
            </label>
          </div>
        )}
      </Question>

      <Question numero={3} titre="Combien de temps ?">
        <div className="grid grid-cols-4 gap-3">
          {DUREES.map(([m, l]) => (
            <Choix key={m} actif={duree === m} onClick={() => setDuree(m)} className="justify-center !px-2 text-center [&>svg]:hidden">
              {l}
            </Choix>
          ))}
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-[18px] font-bold text-texte-doux">Le sujet du jour (facultatif)</span>
          <input
            value={sujet}
            onChange={(e) => setSujet(e.target.value)}
            placeholder={coursChoisi ? `Par exemple : ${coursChoisi.titre}, chapitre 2` : "Par exemple : chapitre 2"}
            maxLength={160}
            className="min-h-[56px] rounded-[16px] border-2 border-ligne bg-white px-4 text-[20px] outline-none focus:border-orange"
          />
        </label>
      </Question>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ligne bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+84px)] pt-3 backdrop-blur sm:pb-4" data-valider-cours>
        <div className="mx-auto flex max-w-[860px] flex-col gap-2">
          {manque && <p className="text-center text-[16px] font-bold text-texte-doux">{manque}</p>}
          <button
            type="button"
            onClick={() => void valider()}
            disabled={envoi}
            className={cn(
              "flex min-h-[68px] w-full items-center justify-center gap-3 rounded-[22px] text-[22px] font-black text-encre transition-opacity",
              manque ? "bg-orange/40" : "bg-orange shadow-carte",
              envoi && "opacity-60",
            )}
          >
            {quand === "maintenant" ? <MonitorPlay className="h-7 w-7" strokeWidth={2.5} /> : <CalendarClock className="h-7 w-7" strokeWidth={2.5} />}
            {envoi ? "Un instant…" : quand === "maintenant" ? "Ouvrir la classe maintenant" : "Programmer et prévenir les étudiants"}
          </button>
        </div>
      </div>
    </Page>
  );
}
