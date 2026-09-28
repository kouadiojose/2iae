// Onglet « Suivi » du dossier étudiant : le journal des échanges (appel,
// WhatsApp, rendez-vous, famille…) et les relances à faire avant une date,
// confiées à quelqu'un de l'équipe. Jamais visible par l'étudiant.
import { useId, useState } from "react";
import { NotebookPen, MoreVertical, CalendarPlus, Trash2, BellPlus } from "lucide-react";
import type { DossierCrm, SuiviCrm, TacheSuivi, TypeSuivi } from "@shared/schema";
import { TYPES_SUIVI, LIBELLES_TYPES_SUIVI } from "@shared/schema";
import { Bouton } from "@/components/ui/bouton";
import { Carte, TitreSection } from "@/components/ui/carte";
import { Champ, Selection, ZoneTexte } from "@/components/ui/champs";
import { Menu, ElementMenu, SeparateurMenu } from "@/components/ui/menu";
import { toast, toastErreur } from "@/components/ui/toast";
import { post, patch, suppr } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { useMoiConnecte } from "@/lib/auth";
import { dateCourte, heure } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { jourCourt, aujourdhui } from "../outils-crm";
import { majCrm, perimerListes, urlCrm, dansJours, jourRelatif, ICONES_SUIVI, RACCOURCIS_ECHEANCE } from "./DossierOutils";

const INVITES: Record<TypeSuivi, string> = {
  note: "Ce que la personne suivante doit savoir…",
  appel: "Qui avez-vous appelé ? Qu'est-ce qui a été convenu ?",
  whatsapp: "Message envoyé ou reçu, et la réponse…",
  sms: "Message envoyé, et la réponse…",
  rendez_vous: "Avec qui, et ce qui a été décidé…",
  email: "Objet du message, et la réponse…",
  famille: "Échange avec les parents : ce qui a été dit…",
};
const SUGGESTIONS_RELANCE = ["Rappeler pour la tranche en retard", "Relancer pour les pièces manquantes", "Prendre des nouvelles"];

export function DossierSuivi({ etudiantId, crm }: { etudiantId: number; crm: DossierCrm }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Journal etudiantId={etudiantId} suivis={crm.suivis} />
      <Relances etudiantId={etudiantId} taches={crm.taches} equipe={crm.equipe} />
    </div>
  );
}

function Journal({ etudiantId, suivis }: { etudiantId: number; suivis: SuiviCrm[] }) {
  const [type, setType] = useState<TypeSuivi>("note");
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const ajouter = async () => {
    setEnvoi(true);
    try {
      const s = await post<SuiviCrm>(`/api/pilotage/etudiants/${etudiantId}/suivis`, { type, texte: texte.trim() });
      majCrm(etudiantId, (d) => ({ ...d, suivis: [s, ...d.suivis] }));
      setTexte("");
      setType("note");
      toast("Ajouté au journal");
      void perimerListes(etudiantId);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const tries = [...suivis].sort((a, b) => b.creeLe.localeCompare(a.creeLe));

  return (
    <section className="min-w-0">
      <TitreSection titre="Journal des échanges" />
      <Carte className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Type d'échange">
            {TYPES_SUIVI.map((t) => {
              const Icone = ICONES_SUIVI[t];
              const actif = t === type;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  onClick={() => setType(t)}
                  className={cn(
                    "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-sm font-bold transition-colors",
                    actif ? "border-encre bg-encre text-white" : "border-ligne bg-white text-texte-doux hover:border-orange hover:text-encre",
                  )}
                >
                  <Icone className="h-4 w-4" aria-hidden="true" />
                  {LIBELLES_TYPES_SUIVI[t]}
                </button>
              );
            })}
          </div>
          <ZoneTexte aria-label="Texte de l'échange" value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} maxLength={2000} placeholder={INVITES[type]} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] text-texte-gris">Jamais visible par l'étudiant.</span>
            <Bouton variante="encre" icone={<NotebookPen className="h-4 w-4" />} onClick={ajouter} chargement={envoi} disabled={texte.trim().length < 2} className="min-h-[48px]">
              Ajouter
            </Bouton>
          </div>
        </div>
        {!tries.length ? (
          <p className="text-[15px] text-texte-pale">Aucun échange noté pour l'instant. Notez chaque appel, message ou rendez-vous : la personne suivante saura où on en est.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {tries.map((s) => {
              const Icone = ICONES_SUIVI[s.type] ?? ICONES_SUIVI.note;
              return (
                <li key={s.id} className="flex gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-clair text-orange-fonce" aria-hidden="true">
                    <Icone className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-texte-gris">
                      <span className="font-bold text-encre">{LIBELLES_TYPES_SUIVI[s.type] ?? "Note"}</span> · {dateCourte(s.creeLe)} à {heure(s.creeLe)} · {s.auteur}
                    </div>
                    <p className="mt-0.5 whitespace-pre-line break-words text-[15px] text-texte-doux">{s.texte}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Carte>
    </section>
  );
}

function Relances({ etudiantId, taches, equipe }: { etudiantId: number; taches: TacheSuivi[]; equipe: DossierCrm["equipe"] }) {
  const moi = useMoiConnecte();
  const [envoi, setEnvoi] = useState<number | null>(null);
  const ouvertes = taches.filter((t) => !t.faiteLe).sort((a, b) => a.echeance.localeCompare(b.echeance) || a.id - b.id);
  const faites = taches.filter((t) => t.faiteLe).sort((a, b) => (b.faiteLe ?? "").localeCompare(a.faiteLe ?? ""));

  /** Remplace une relance dans le cache du dossier. */
  const remplacer = (t: TacheSuivi) => majCrm(etudiantId, (d) => ({ ...d, taches: d.taches.map((x) => (x.id === t.id ? t : x)) }));

  const modifier = async (t: TacheSuivi, corps: { faite?: boolean; echeance?: string }, message?: string) => {
    // Case cochée : affichée tout de suite, corrigée si le serveur refuse.
    if (corps.faite !== undefined) remplacer({ ...t, faiteLe: corps.faite ? new Date().toISOString() : null, faitePar: corps.faite ? `${moi.prenom} ${moi.nom}` : null, enRetard: false });
    setEnvoi(t.id);
    try {
      remplacer(await patch<TacheSuivi>(`/api/pilotage/taches/${t.id}`, corps));
      if (message) toast(message);
      void perimerListes(etudiantId);
    } catch (e) {
      toastErreur(e);
      void rafraichir(urlCrm(etudiantId));
    } finally {
      setEnvoi(null);
    }
  };

  const supprimer = async (t: TacheSuivi) => {
    if (!window.confirm(`Supprimer la relance « ${t.titre} » ?`)) return;
    setEnvoi(t.id);
    try {
      await suppr(`/api/pilotage/taches/${t.id}`);
      majCrm(etudiantId, (d) => ({ ...d, taches: d.taches.filter((x) => x.id !== t.id) }));
      toast("Relance supprimée");
      void perimerListes(etudiantId);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  };

  return (
    <section className="min-w-0">
      <TitreSection titre={ouvertes.length ? `Relances (${ouvertes.length})` : "Relances"} />
      <div className="flex flex-col gap-4">
        <NouvelleRelance etudiantId={etudiantId} equipe={equipe} moiId={moi.id} />
        <Carte className="p-0">
          {!taches.length ? (
            <p className="px-5 py-4 text-[15px] text-texte-pale">Aucune relance pour cet étudiant. Programmez un rappel : il apparaîtra le jour venu dans la page Relances de la personne choisie.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-ligne-douce">
              {[...ouvertes, ...faites].map((t) => (
                <LigneTache
                  key={t.id}
                  t={t}
                  occupe={envoi === t.id}
                  onCocher={(faite) => void modifier(t, { faite }, faite ? "Relance faite" : "Relance rouverte")}
                  onReporter={(jours) => void modifier(t, { echeance: dansJours(jours) }, jours === 1 ? "Reportée à demain" : `Reportée dans ${jours} jours`)}
                  onSupprimer={() => void supprimer(t)}
                />
              ))}
            </ul>
          )}
        </Carte>
      </div>
    </section>
  );
}

function LigneTache({
  t,
  occupe,
  onCocher,
  onReporter,
  onSupprimer,
}: {
  t: TacheSuivi;
  occupe: boolean;
  onCocher: (faite: boolean) => void;
  onReporter: (jours: number) => void;
  onSupprimer: () => void;
}) {
  const id = useId();
  const faite = Boolean(t.faiteLe);
  const retard = !faite && t.echeance < aujourdhui();
  return (
    <li className={cn("flex items-start gap-1 py-2 pl-2 pr-1", retard && "bg-danger-clair/40", occupe && "opacity-70")}>
      <label htmlFor={id} className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center">
        <input id={id} type="checkbox" className="h-5 w-5 accent-[#E4793A]" checked={faite} disabled={occupe} onChange={(e) => onCocher(e.target.checked)} aria-label={faite ? `Rouvrir : ${t.titre}` : `Marquer comme faite : ${t.titre}`} />
      </label>
      <div className="min-w-0 flex-1 py-2">
        <div className={cn("break-words font-semibold", faite && "text-texte-gris line-through")}>{t.titre}</div>
        <div className="mt-0.5 text-[13px] text-texte-gris">
          {faite ? (
            <>
              Faite le {dateCourte(t.faiteLe!)}
              {t.faitePar ? ` par ${t.faitePar}` : ""}
            </>
          ) : (
            <>
              <span className={cn(retard && "font-bold text-danger")}>
                {retard ? "En retard : " : "Pour le "}
                {jourCourt(t.echeance)} ({jourRelatif(t.echeance)})
              </span>
              {t.responsable ? ` · ${t.responsable.nom}` : ""}
            </>
          )}
        </div>
      </div>
      <Menu
        declencheur={
          <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-texte-pale hover:bg-creme hover:text-encre" aria-label={`Actions : ${t.titre}`} disabled={occupe}>
            <MoreVertical className="h-5 w-5" />
          </button>
        }
      >
        {!faite && (
          <>
            <ElementMenu icone={<CalendarPlus className="h-4 w-4" />} onSelect={() => onReporter(1)}>
              Reporter à demain
            </ElementMenu>
            <ElementMenu icone={<CalendarPlus className="h-4 w-4" />} onSelect={() => onReporter(7)}>
              Reporter dans 7 jours
            </ElementMenu>
            <SeparateurMenu />
          </>
        )}
        <ElementMenu danger icone={<Trash2 className="h-4 w-4" />} onSelect={onSupprimer}>
          Supprimer
        </ElementMenu>
      </Menu>
    </li>
  );
}

function NouvelleRelance({ etudiantId, equipe, moiId }: { etudiantId: number; equipe: DossierCrm["equipe"]; moiId: number }) {
  const parDefaut = equipe.some((p) => p.id === moiId) ? String(moiId) : "";
  const [titre, setTitre] = useState("");
  const [echeance, setEcheance] = useState(dansJours(1));
  const [responsable, setResponsable] = useState(parDefaut);
  const [envoi, setEnvoi] = useState(false);

  const ajouter = async () => {
    setEnvoi(true);
    try {
      const t = await post<TacheSuivi>(`/api/pilotage/etudiants/${etudiantId}/taches`, { titre: titre.trim(), echeance, responsableId: responsable ? Number(responsable) : null });
      majCrm(etudiantId, (d) => ({ ...d, taches: [...d.taches, t] }));
      setTitre("");
      setEcheance(dansJours(1));
      setResponsable(parDefaut);
      toast(`Relance programmée pour le ${jourCourt(t.echeance)}`);
      void perimerListes(etudiantId);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Carte className="flex flex-col gap-4">
      <h3 className="text-base font-extrabold">Nouvelle relance</h3>
      <div className="flex flex-col gap-2">
        <Champ libelle="À faire" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={200} placeholder="Ex. : rappeler le père pour la 2e tranche" />
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS_RELANCE.map((s) => (
            <button key={s} type="button" onClick={() => setTitre(s)} className="min-h-[44px] rounded-full border border-ligne px-3 py-1.5 text-left text-sm font-semibold text-texte-doux hover:border-orange hover:text-encre">
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Champ libelle="Échéance" type="date" min={aujourdhui()} value={echeance} onChange={(e) => setEcheance(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {RACCOURCIS_ECHEANCE.map((r) => {
            const jour = dansJours(r.jours);
            return (
              <button
                key={r.jours}
                type="button"
                onClick={() => setEcheance(jour)}
                aria-pressed={echeance === jour}
                className={cn(
                  "min-h-[44px] rounded-full border px-3 py-1.5 text-sm font-bold transition-colors",
                  echeance === jour ? "border-encre bg-encre text-white" : "border-ligne text-texte-doux hover:border-orange hover:text-encre",
                )}
              >
                {r.libelle}
              </button>
            );
          })}
        </div>
      </div>
      {equipe.length > 0 && (
        <Selection libelle="Qui s'en charge ?" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
          {!parDefaut && <option value="">Moi</option>}
          {equipe.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === moiId ? `${p.nom} (moi)` : p.nom}
            </option>
          ))}
        </Selection>
      )}
      <Bouton icone={<BellPlus className="h-4 w-4" />} onClick={ajouter} chargement={envoi} disabled={!titre.trim() || !echeance} className="min-h-[48px] self-start">
        Programmer la relance
      </Bouton>
    </Carte>
  );
}
