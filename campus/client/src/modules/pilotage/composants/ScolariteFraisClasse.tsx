// Fenêtre « Frais de la classe » (page Scolarité, onglet « Frais par classe ») :
// l'échéancier modèle d'une classe, ligne par ligne (libellé, date limite,
// montant), avec un modèle rapide et la copie depuis une autre classe. Une
// fois enregistré, il peut être appliqué d'un geste aux étudiants de la classe
// qui n'ont pas encore d'échéancier (les autres ne sont jamais modifiés).
import { useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, ListPlus, Plus, Trash2 } from "lucide-react";
import type { FraisClasseLigne, LigneEcheancier } from "@shared/schema";
import { post, put } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Champ, Selection } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { cn, pluriel } from "@/lib/utils";
import { fcfa, montant, lireMontant } from "../outils-crm";
import { classeSansCampus } from "./ScolariteElements";

const MAX_LIGNES = 24;

type LigneSaisie = { cle: number; libelle: string; date: string; montant: string };

let prochaineCle = 1;
const nouvelleLigne = (l?: Partial<LigneEcheancier>): LigneSaisie => ({
  cle: prochaineCle++,
  libelle: l?.libelle ?? "",
  date: l?.date ?? "",
  montant: l?.montant === undefined || l?.montant === null ? "" : montant(l.montant),
});

const bissextile = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;

/** Décale l'année d'une date AAAA-MM-JJ (copie des frais d'une classe d'une autre année scolaire). */
function decalerAnnee(date: string | null, ecart: number): string | null {
  if (!date || !ecart) return date;
  const annee = Number(date.slice(0, 4)) + ecart;
  const md = date.slice(4);
  return md === "-02-29" && !bissextile(annee) ? `${annee}-02-28` : `${annee}${md}`;
}

/** Première année de « 2026-2027 » (l'année en cours si illisible). */
function debutAnnee(anneeScolaire: string): number {
  const n = Number(anneeScolaire.slice(0, 4));
  return Number.isInteger(n) && n > 2000 ? n : new Date().getUTCFullYear();
}

/** Copie l'échéancier de la classe à ses étudiants qui n'en ont pas encore. */
export async function appliquerFraisClasse(classeId: number): Promise<number> {
  const { appliques } = await post<{ appliques: number }>(`/api/pilotage/frais-classes/${classeId}/appliquer`);
  toast(appliques ? `Échéancier appliqué à ${pluriel(appliques, "étudiant")}.` : "Tous les étudiants de la classe avaient déjà un échéancier.");
  await rafraichir("/api/pilotage/frais-classes", "/api/pilotage/scolarite", "/api/pilotage/etudiants");
  return appliques;
}

export function FenetreFraisClasse({ classe, classes, onFermer }: { classe: FraisClasseLigne | null; classes: FraisClasseLigne[]; onFermer: () => void }) {
  if (!classe) return null;
  // Une clé par classe : l'éditeur repart de l'échéancier enregistré à chaque ouverture.
  return <EditeurFrais key={classe.classeId} classe={classe} classes={classes} onFermer={onFermer} />;
}

function EditeurFrais({ classe, classes, onFermer }: { classe: FraisClasseLigne; classes: FraisClasseLigne[]; onFermer: () => void }) {
  const [lignes, setLignes] = useState<LigneSaisie[]>(() => classe.echeancier.map((l) => nouvelleLigne(l)));
  const [erreurs, setErreurs] = useState<Record<number, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [etape, setEtape] = useState<"saisie" | "enregistre">("saisie");
  const [application, setApplication] = useState(false);
  const nom = classeSansCampus(classe.classe, classe.site);
  const debut = debutAnnee(classe.anneeScolaire);
  const sources = classes.filter((c) => c.classeId !== classe.classeId && c.echeancier.length > 0);
  const total = lignes.reduce((t, l) => t + (lireMontant(l.montant) ?? 0), 0);

  const modifier = (cle: number, champ: "libelle" | "date" | "montant", valeur: string) => {
    setLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, [champ]: valeur } : l)));
    if (erreurs[cle])
      setErreurs((e) => {
        const n = { ...e };
        delete n[cle];
        return n;
      });
  };
  const deplacer = (i: number, sens: -1 | 1) =>
    setLignes((ls) => {
      const j = i + sens;
      if (j < 0 || j >= ls.length) return ls;
      const n = [...ls];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const retirer = (cle: number) => setLignes((ls) => ls.filter((l) => l.cle !== cle));
  const ajouter = () => setLignes((ls) => (ls.length >= MAX_LIGNES ? ls : [...ls, nouvelleLigne()]));

  const modeleRapide = () =>
    setLignes([
      nouvelleLigne({ libelle: "Frais d'inscription", date: `${debut}-09-15` }),
      nouvelleLigne({ libelle: "1re tranche", date: `${debut}-10-31` }),
      nouvelleLigne({ libelle: "2e tranche", date: `${debut + 1}-01-31` }),
      nouvelleLigne({ libelle: "3e tranche", date: `${debut + 1}-03-31` }),
    ]);

  const copier = (classeId: string) => {
    const source = sources.find((c) => String(c.classeId) === classeId);
    if (!source) return;
    const ecart = debut - debutAnnee(source.anneeScolaire);
    setLignes(source.echeancier.map((l) => nouvelleLigne({ ...l, date: decalerAnnee(l.date, ecart) })));
    setErreurs({});
    toast(`Frais de ${classeSansCampus(source.classe, source.site)} copiés : vérifiez, puis enregistrez.`, "info");
  };

  const enregistrer = async () => {
    const echeancier: LigneEcheancier[] = [];
    const errs: Record<number, string> = {};
    for (const l of lignes) {
      const libelle = l.libelle.trim().replace(/\s+/g, " ");
      const m = lireMontant(l.montant);
      if (!libelle && m === null && !l.date) continue; // ligne laissée vide : ignorée
      if (!libelle) errs[l.cle] = "Donnez un nom à cette ligne (par exemple « 1re tranche »).";
      else if (libelle.length > 80) errs[l.cle] = "Nom trop long : 80 caractères au plus.";
      else if (m === null) errs[l.cle] = "Saisissez le montant (0 s'il n'y a rien à payer).";
      else if (m > 50_000_000) errs[l.cle] = "Montant trop élevé.";
      else echeancier.push({ libelle, date: l.date || null, montant: m });
    }
    setErreurs(errs);
    const premiere = Object.keys(errs)[0];
    if (premiere) {
      document.getElementById(`ligne-frais-${premiere}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setEnvoi(true);
    try {
      await put(`/api/pilotage/frais-classes/${classe.classeId}`, { echeancier });
      await rafraichir("/api/pilotage/frais-classes", "/api/pilotage/scolarite", "/api/pilotage/etudiants");
      if (classe.sansEcheancier > 0 && echeancier.some((l) => l.montant > 0)) setEtape("enregistre");
      else {
        toast(`Frais de ${nom} enregistrés.`);
        onFermer();
      }
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  const appliquer = async () => {
    setApplication(true);
    try {
      await appliquerFraisClasse(classe.classeId);
      onFermer();
    } catch (e) {
      toastErreur(e);
    } finally {
      setApplication(false);
    }
  };

  if (etape === "enregistre") {
    const n = classe.sansEcheancier;
    return (
      <Fenetre
        ouverte
        onFermer={onFermer}
        titre="Frais enregistrés"
        description={`${nom}, année ${classe.anneeScolaire}.`}
        pied={
          <>
            <Bouton variante="contour" onClick={onFermer} className="min-h-[48px]">
              Plus tard
            </Bouton>
            <Bouton onClick={appliquer} chargement={application} className="min-h-[48px]">
              Appliquer {n > 1 ? `aux ${n} étudiants` : "à l'étudiant"} sans échéancier
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="flex items-start gap-3 rounded-2xl bg-succes-clair p-4 text-[15px] text-succes">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <span>
              Total : <strong>{fcfa(total)}</strong>. Ces frais seront copiés à chaque nouvel étudiant inscrit dans la classe.
            </span>
          </p>
          <p className="text-[15px] text-texte-doux">
            {n > 1 ? `${n} étudiants de cette classe n'ont` : "1 étudiant de cette classe n'a"} pas encore d'échéancier. Vous pouvez leur appliquer ces frais maintenant. Les
            étudiants qui ont déjà un échéancier ne sont pas modifiés.
          </p>
        </div>
      </Fenetre>
    );
  }

  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      large
      titre={`Frais de ${nom}`}
      description={`Année ${classe.anneeScolaire}. Modifier ce modèle ne change pas l'échéancier des étudiants qui en ont déjà un.`}
      pied={
        <>
          <Bouton variante="contour" onClick={onFermer} className="min-h-[48px]">
            Annuler
          </Bouton>
          <Bouton onClick={enregistrer} chargement={envoi} className="min-h-[48px]">
            Enregistrer les frais
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {sources.length > 0 && (
          <Selection libelle="Copier les frais d'une autre classe" value="" onChange={(e) => copier(e.target.value)}>
            <option value="">Choisir une classe…</option>
            {sources.map((c) => (
              <option key={c.classeId} value={c.classeId}>
                {classeSansCampus(c.classe, c.site)} · {c.site} · {fcfa(c.total)}
              </option>
            ))}
          </Selection>
        )}

        {lignes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ligne px-5 py-8 text-center">
            <p className="text-lg font-extrabold">Aucune ligne pour l'instant.</p>
            <p className="max-w-md text-[15px] text-texte-pale">Partez du modèle courant (les dates sont proposées, les montants à saisir), ou ajoutez les lignes une à une.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Bouton icone={<ListPlus className="h-4 w-4" />} onClick={modeleRapide} className="min-h-[48px]">
                Inscription + 3 tranches
              </Bouton>
              <Bouton variante="doux" icone={<Plus className="h-4 w-4" />} onClick={ajouter} className="min-h-[48px]">
                Ajouter une ligne
              </Bouton>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1fr)_10.5rem_9.5rem_9.5rem] gap-2 px-3 font-mono text-[11px] uppercase tracking-wider text-texte-gris sm:grid" aria-hidden>
              <span>Libellé</span>
              <span>Date limite</span>
              <span>Montant (F CFA)</span>
              <span />
            </div>
            <ol className="flex flex-col gap-2">
              {lignes.map((l, i) => (
                <li key={l.cle} id={`ligne-frais-${l.cle}`} className={cn("rounded-2xl border bg-white p-3", erreurs[l.cle] ? "border-danger" : "border-ligne")}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_10.5rem_9.5rem_9.5rem] sm:items-end">
                    <Champ
                      libelle={<span className="sm:sr-only">Libellé</span>}
                      className="col-span-2 sm:col-span-1"
                      value={l.libelle}
                      maxLength={80}
                      placeholder="Ex. 1re tranche"
                      onChange={(e) => modifier(l.cle, "libelle", e.target.value)}
                    />
                    <Champ libelle={<span className="sm:sr-only">Date limite</span>} type="date" value={l.date} onChange={(e) => modifier(l.cle, "date", e.target.value)} />
                    <Champ
                      libelle={<span className="sm:sr-only">Montant (F CFA)</span>}
                      inputMode="numeric"
                      autoComplete="off"
                      value={l.montant}
                      placeholder="0"
                      style={{ textAlign: "right" }}
                      onChange={(e) => {
                        const n = lireMontant(e.target.value);
                        modifier(l.cle, "montant", n === null ? "" : montant(n));
                      }}
                    />
                    <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
                      <Bouton variante="fantome" taille="icone" className="h-11 w-11" aria-label="Monter la ligne" disabled={i === 0} onClick={() => deplacer(i, -1)}>
                        <ArrowUp className="h-5 w-5" />
                      </Bouton>
                      <Bouton variante="fantome" taille="icone" className="h-11 w-11" aria-label="Descendre la ligne" disabled={i === lignes.length - 1} onClick={() => deplacer(i, 1)}>
                        <ArrowDown className="h-5 w-5" />
                      </Bouton>
                      <Bouton variante="fantome" taille="icone" className="h-11 w-11 text-danger hover:text-danger" aria-label="Retirer la ligne" onClick={() => retirer(l.cle)}>
                        <Trash2 className="h-5 w-5" />
                      </Bouton>
                    </div>
                  </div>
                  {erreurs[l.cle] && <p className="mt-2 text-[13px] font-semibold text-danger">{erreurs[l.cle]}</p>}
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Bouton variante="doux" icone={<Plus className="h-4 w-4" />} onClick={ajouter} disabled={lignes.length >= MAX_LIGNES} className="min-h-[48px]">
                Ajouter une ligne
              </Bouton>
              <div className="text-right">
                <div className="font-mono text-[11px] uppercase tracking-wider text-texte-gris">Total de l'année</div>
                <div className="text-2xl font-black tabular-nums tracking-serre">{fcfa(total)}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </Fenetre>
  );
}
