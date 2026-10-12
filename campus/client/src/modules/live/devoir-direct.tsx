// Devoir donné en direct (demande de José du 12 octobre 2026 : « Je veux créer le devoir pendant le cours, en
// direct : ils répondent, moi, je vois directement »).
//
//   - Studio (vouvoiement) : l'onglet « Devoir » du panneau de droite. Formulaire court (consigne, titre facultatif,
//     échéance, une réponse par groupe), un seul bouton orange « Donner le devoir » ; puis le suivi en direct
//     (compteur, réponses qui arrivent, « +5 min », « Arrêter les réponses ») ; toucher une réponse l'ouvre dans
//     « Devoirs et copies » (devoirs.tsx), d'où elle se projette à la classe, nom caché.
//   - Étudiant (tutoiement, téléphone d'abord) : une carte en haut de la classe, « Répondre » ; la réponse s'écrit
//     dans une vue posée par-dessus la classe (portail) : la visio, la radio et la présence continuent dessous. On
//     ne navigue jamais vers /devoirs/:id pendant le direct. L'envoi passe par ZoneRendu (photos allégées, file
//     d'envoi hors ligne, brouillon gardé jusqu'au reçu).
// C'est un vrai devoir du campus : il est dans « Devoirs » et « Notes », corrigé comme les autres.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardPen, Clock, Plus, Square, Trash2, RotateCcw, UsersRound, Loader2 } from "lucide-react";
import { patch, post, suppr } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useTousEvenements } from "@/lib/flux";
import { useFileEnvoi } from "@/lib/file-envoi";
import { useTextes } from "@/lib/textes";
import { heure, heureDouble } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useVueSuperposee } from "@/lib/vue-superposee";
import { Bouton } from "@/components/ui/bouton";
import { Champ, Interrupteur, ZoneTexte } from "@/components/ui/champs";
import { Fenetre } from "@/components/ui/fenetre";
import { Markdown } from "@/components/ui/markdown";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { maintenantServeur } from "@/lib/horloge";
import { toast, toastErreur } from "@/components/ui/toast";
import { ZoneRendu } from "@/modules/evaluations/composants/ZoneRendu";
import { lirePagesBrouillon, lireTexteBrouillon } from "@/modules/evaluations/outils";
import { titreDeConsigne, CONSIGNE_DIRECT_MAX } from "@shared/devoir-direct";
import { t as textesDirect } from "@shared/textes/devoir-direct";
import { t as textesCopies } from "@shared/textes/copies-direct";
import type {
  CopieDuDirectDto,
  CorpsDevoirDirect,
  DevoirDirectDto,
  EtatDirectDto,
  GroupesDto,
  ListeCopiesDuDirectDto,
  Moi,
  MonRenduDirectDto,
  PourGroupe,
  RecuDepot,
  SeanceDetailDto,
} from "@shared/schema";
import { cleDirect } from "./outils";
import { cleGroupes } from "./groupes";
import { codeErreur } from "./copie-projetee";
import { resumeCopie } from "./devoirs";

const MINUTE = 60_000;

/** « 12 min », « 1 h 05 » : durée restante, à la minute supérieure. */
export function dureeCourte(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / MINUTE));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/**
 * Nouveau rendu à l'échéance du devoir : « En cours » passe à « Terminé » (Studio), « Répondre » à « Temps écoulé »
 * (étudiant) à l'heure dite, sans attendre le prochain tour de l'horloge (15 à 30 s).
 */
function useRenduALEcheance(dateLimite: string | null | undefined) {
  const [, forcer] = useState(0);
  useEffect(() => {
    if (!dateLimite) return;
    const reste = new Date(dateLimite).getTime() - maintenantServeur();
    if (reste < 0 || reste > 6 * 3600_000) return;
    const id = setTimeout(() => forcer((x) => x + 1), reste + 1500);
    return () => clearTimeout(id);
  }, [dateLimite]);
}

/** Met à jour le devoir en direct dans l'état du direct (cache de GET /direct), sans relire. */
function majDevoirDirect(seanceId: number, f: (d: DevoirDirectDto | null) => DevoirDirectDto | null) {
  queryClient.setQueryData<EtatDirectDto>(cleDirect(seanceId), (etat) => (etat ? { ...etat, devoirDirect: f(etat.devoirDirect ?? null) } : etat));
}

/** Une ligne de réponses : une copie individuelle, ou toutes les copies d'une même réponse de groupe. */
export type LigneReponses = {
  cle: string;
  /** Copie qui sert à l'aperçu et à la projection : celle de l'auteur de la réponse, sinon la plus récente. */
  representante: CopieDuDirectDto;
  copies: CopieDuDirectDto[];
  groupe: CopieDuDirectDto["groupe"];
  renduLe: string;
};

/**
 * Regroupe les copies d'un même groupe (même groupe.id) en une ligne ; les copies individuelles restent seules. La plus
 * récente en haut. Aussi employée par « Devoirs et copies » (devoirs.tsx).
 */
export function regrouperReponses(copies: CopieDuDirectDto[]): LigneReponses[] {
  const lignes: LigneReponses[] = [];
  const parGroupe = new Map<number, CopieDuDirectDto[]>();
  for (const c of copies) {
    if (!c.groupe) lignes.push({ cle: `c${c.renduId}`, representante: c, copies: [c], groupe: null, renduLe: c.renduLe });
    else parGroupe.set(c.groupe.id, [...(parGroupe.get(c.groupe.id) ?? []), c]);
  }
  for (const [id, liste] of parGroupe) {
    const triees = [...liste].sort((a, b) => b.renduLe.localeCompare(a.renduLe));
    const recente = triees[0].renduLe;
    const representante = triees.find((c) => c.groupe?.auteur && c.renduLe === recente) ?? triees.find((c) => c.groupe?.auteur) ?? triees[0];
    lignes.push({ cle: `g${id}`, representante, copies: triees, groupe: representante.groupe, renduLe: recente });
  }
  return lignes.sort((a, b) => b.renduLe.localeCompare(a.renduLe));
}

// ── Studio : onglet « Devoir » ─────────────────────────────────────────────

/** Échéance choisie dans le formulaire : fin du cours, n minutes, ce soir (null : la valeur par défaut). */
type ChoixEcheance = "fin" | "soir" | number;

/** Formulaire gardé dans le Studio : il ne se perd pas quand on change d'onglet. */
export type FormulaireDevoirDirect = {
  consigne: string;
  titre: string;
  echeance: ChoixEcheance | null;
  /** null : activé par défaut dès que des groupes sont ouverts, tant que l'animateur n'y a pas touché. */
  enGroupe: boolean | null;
  corrige: string;
  /** « Donner un autre devoir » : le formulaire passe devant le suivi. */
  autre: boolean;
};
export const formulaireVide = (): FormulaireDevoirDirect => ({ consigne: "", titre: "", echeance: null, enGroupe: null, corrige: "", autre: false });

/** 23h59 du jour d'Abidjan (GMT) : « Ce soir ». */
const ceSoir = (maintenant: number) => {
  const d = new Date(maintenant);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 0, 0);
};
const minuteSuperieure = (ms: number) => Math.ceil(ms / MINUTE) * MINUTE;

export function PanneauDevoirDirect({
  seance,
  etat,
  groupes,
  moi,
  formulaire,
  setFormulaire,
  onOuvrir,
}: {
  seance: SeanceDetailDto;
  etat: EtatDirectDto;
  groupes: GroupesDto | undefined;
  moi: Pick<Moi, "role">;
  formulaire: FormulaireDevoirDirect;
  setFormulaire: (f: (avant: FormulaireDevoirDirect) => FormulaireDevoirDirect) => void;
  onOuvrir: (devoirId: number, renduId: number) => void;
}) {
  const tx = useTextes(textesDirect);
  // L'horloge avance toutes les 15 s ; une échéance changée (« Arrêter les réponses ») se voit dès le rendu suivant.
  const maintenant = Math.max(useMaintenant(15_000), maintenantServeur());
  const dd = etat.devoirDirect ?? null;
  useRenduALEcheance(dd?.dateLimite);
  if (etat.statut === "planifiee") {
    return <p className="p-5 text-center text-[15px] leading-relaxed text-nuit-doux">{tx("studio.avantDirect")}</p>;
  }
  if (!dd || formulaire.autre) {
    return <FormulaireDevoir seance={seance} etat={etat} groupes={groupes} moi={moi} formulaire={formulaire} setFormulaire={setFormulaire} />;
  }
  return (
    <SuiviDevoir
      key={dd.id}
      seance={seance}
      dd={dd}
      groupes={groupes}
      termine={new Date(dd.dateLimite).getTime() <= maintenant}
      maintenant={maintenant}
      onAutre={() => setFormulaire((f) => ({ ...f, autre: true }))}
      onOuvrir={onOuvrir}
    />
  );
}

function FormulaireDevoir({
  seance,
  etat,
  groupes,
  moi,
  formulaire: f,
  setFormulaire,
}: {
  seance: SeanceDetailDto;
  etat: EtatDirectDto;
  groupes: GroupesDto | undefined;
  moi: Pick<Moi, "role">;
  formulaire: FormulaireDevoirDirect;
  setFormulaire: (f: (avant: FormulaireDevoirDirect) => FormulaireDevoirDirect) => void;
}) {
  const tx = useTextes(textesDirect);
  const maintenant = useMaintenant(15_000);
  const [envoi, setEnvoi] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const enDirect = etat.statut === "en_direct";
  const changer = (champs: Partial<FormulaireDevoirDirect>) => setFormulaire((x) => ({ ...x, ...champs }));

  // Échéances proposées : fin du cours (même calcul que le chrono du Studio), 10, 15, 30 min, ce soir.
  const finCours = (etat.demarreeLe ? new Date(etat.demarreeLe).getTime() : new Date(seance.debut).getTime()) + seance.dureeMinutes * MINUTE;
  const finProposee = finCours >= maintenant + 10 * MINUTE;
  // Chaque pastille : son nom, puis l'heure (d'Abidjan) à laquelle les réponses s'arrêteront (arrondie comme le serveur).
  const options: { choix: ChoixEcheance; libelle: string; cible: number }[] = [
    ...(finProposee ? [{ choix: "fin" as const, libelle: tx("studio.echeance.fin"), cible: minuteSuperieure(finCours) }] : []),
    ...[10, 15, 30].map((n) => ({ choix: n, libelle: tx("studio.echeance.minutes", { v: { n } }), cible: minuteSuperieure(maintenant + n * MINUTE) })),
    { choix: "soir" as const, libelle: tx("studio.echeance.soir"), cible: ceSoir(maintenant) },
  ];
  const parDefaut: ChoixEcheance = finProposee ? "fin" : 10;
  const echeance = options.some((o) => o.choix === f.echeance) ? (f.echeance as ChoixEcheance) : parDefaut;
  const cible = options.find((o) => o.choix === echeance)!.cible;

  // Une réponse par groupe : seulement avec des groupes ouverts, activée par défaut tant qu'on n'y a pas touché.
  const groupesOuverts = Boolean(groupes?.session);
  const enGroupe = groupesOuverts && (f.enGroupe ?? true);
  const avecSalle = groupesOuverts && Boolean(groupes?.groupes.some((g) => g.membres.some((m) => m.role === "salle")));
  const peutEcrireCorrige = moi.role === "formateur" || moi.role === "admin";
  const titreIndicatif = titreDeConsigne(f.consigne);
  const consigneOk = f.consigne.trim().length >= 3;
  const precedentOuvert = etat.devoirDirect && new Date(etat.devoirDirect.dateLimite).getTime() > maintenant ? etat.devoirDirect : null;

  const donner = async () => {
    setConfirmer(false);
    setEnvoi(true);
    try {
      const corps: CorpsDevoirDirect = {
        consigne: f.consigne.trim(),
        ...(f.titre.trim() ? { titre: f.titre.trim() } : {}),
        echeance,
        enGroupe,
        ...(peutEcrireCorrige && f.corrige.trim() ? { corrige: f.corrige } : {}),
      };
      const dd = await post<DevoirDirectDto>(`/api/seances/${seance.id}/devoirs-direct`, corps);
      majDevoirDirect(seance.id, () => ({ ...dd, monRendu: null }));
      setFormulaire(() => formulaireVide());
      toast(tx("studio.toast.donne"));
    } catch (e) {
      if (codeErreur(e) === "groupes_fermes") changer({ enGroupe: false });
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="defile-fin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3.5">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-[17px] font-extrabold">
          <ClipboardPen className="h-5 w-5 text-orange" /> {tx("studio.titre")}
        </h3>
        <p className="text-[13px] leading-snug text-nuit-doux">{tx("studio.aide")}</p>
      </div>
      <div className="champs-nuit flex flex-col gap-3">
        <ZoneTexte
          libelle={tx("studio.consigne")}
          value={f.consigne}
          onChange={(e) => changer({ consigne: e.target.value })}
          placeholder={tx("studio.consigne.exemple")}
          rows={4}
          maxLength={CONSIGNE_DIRECT_MAX}
          className="[&_label]:text-white [&_textarea]:border-nuit-bord [&_textarea]:bg-nuit-carte [&_textarea]:text-white [&_textarea]:placeholder:text-nuit-gris"
        />
        <Champ
          libelle={tx("studio.titreDevoir")}
          value={f.titre}
          onChange={(e) => changer({ titre: e.target.value })}
          placeholder={titreIndicatif || undefined}
          maxLength={200}
          aide={<span className="text-nuit-gris">{tx("studio.titreDevoir.aide")}</span>}
          className="[&_input]:border-nuit-bord [&_input]:bg-nuit-carte [&_input]:text-white [&_input]:placeholder:text-nuit-gris [&_label]:text-white"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold text-white">{tx("studio.echeance")}</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={tx("studio.echeance")}>
          {options.map((o) => {
            const actif = o.choix === echeance;
            return (
              <button
                key={String(o.choix)}
                type="button"
                role="radio"
                aria-checked={actif}
                onClick={() => changer({ echeance: o.choix })}
                className={cn(
                  "flex min-h-12 min-w-0 flex-col items-start justify-center rounded-xl border px-2.5 py-1.5 text-left transition-colors",
                  actif ? "border-orange bg-orange/15 text-white" : "border-nuit-ligne bg-nuit-carte text-nuit-texte hover:border-nuit-bord",
                )}
              >
                <span className="whitespace-nowrap text-[14px] font-bold">{o.libelle}</span>
                <span className="font-mono text-[11px] text-nuit-gris">{heure(o.cible)}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[12px] text-nuit-doux">{tx("studio.echeance.resume", { v: { heure: heureDouble(cible) } })}</p>
      </fieldset>

      {groupesOuverts && (
        <div className="flex flex-col gap-1.5 rounded-[14px] bg-nuit-bulle p-3">
          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[14px] font-bold text-white">
              <UsersRound className="h-4 w-4 text-orange" /> {tx("studio.groupe")}
            </span>
            <Interrupteur actif={enGroupe} onChange={(v) => changer({ enGroupe: v })} libelle={tx("studio.groupe")} />
          </label>
          <p className="text-[12px] leading-snug text-nuit-doux">{tx("studio.groupe.aide")}</p>
          {enGroupe && avecSalle && <p className="text-[12px] leading-snug text-orange-peche">{tx("studio.groupe.salle")}</p>}
          {enGroupe && echeance === "soir" && <p className="text-[12px] leading-snug text-orange-peche">{tx("studio.groupe.apres")}</p>}
        </div>
      )}

      {peutEcrireCorrige && (
        <details className="rounded-[14px] bg-nuit-bulle px-3 py-2.5" open={Boolean(f.corrige)}>
          <summary className="cursor-pointer text-[14px] font-bold text-white">{tx("studio.corrige")}</summary>
          <div className="flex flex-col gap-1.5 pt-2.5">
            <ZoneTexte
              value={f.corrige}
              onChange={(e) => changer({ corrige: e.target.value })}
              rows={6}
              maxLength={20_000}
              aria-label={tx("studio.corrige")}
              className="[&_textarea]:border-nuit-bord [&_textarea]:bg-nuit-carte [&_textarea]:text-white"
            />
            <p className="text-[12px] leading-snug text-nuit-doux">{tx("studio.corrige.aide")}</p>
          </div>
        </details>
      )}

      <div className="flex flex-col gap-2">
        <Bouton
          variante="nuit-actif"
          taille="lg"
          pleineLargeur
          className="min-h-14"
          icone={<ClipboardPen className="h-5 w-5" />}
          chargement={envoi}
          disabled={!consigneOk || !enDirect}
          onClick={() => (precedentOuvert ? setConfirmer(true) : void donner())}
        >
          {tx("studio.donner")}
        </Bouton>
        {f.autre && etat.devoirDirect && (
          <Bouton variante="nuit" onClick={() => changer({ autre: false })}>
            {tx("studio.annuler")}
          </Bouton>
        )}
      </div>

      <Fenetre
        ouverte={confirmer}
        onFermer={() => setConfirmer(false)}
        titre={tx("studio.remplacer.titre")}
        description={precedentOuvert ? tx("studio.remplacer.texte", { v: { titre: precedentOuvert.titre, heure: heure(precedentOuvert.dateLimite) } }) : undefined}
        pied={
          <>
            <Bouton variante="contour" onClick={() => setConfirmer(false)}>
              {tx("studio.annuler")}
            </Bouton>
            <Bouton onClick={() => void donner()} chargement={envoi}>
              {tx("studio.remplacer.oui")}
            </Bouton>
          </>
        }
      />
    </div>
  );
}

function SuiviDevoir({
  seance,
  dd,
  groupes,
  termine,
  maintenant,
  onAutre,
  onOuvrir,
}: {
  seance: SeanceDetailDto;
  dd: DevoirDirectDto;
  groupes: GroupesDto | undefined;
  termine: boolean;
  maintenant: number;
  onAutre: () => void;
  onOuvrir: (devoirId: number, renduId: number) => void;
}) {
  const tx = useTextes(textesDirect);
  const txc = useTextes(textesCopies);
  const [voirConsigne, setVoirConsigne] = useState(false);
  const [action, setAction] = useState<"prolonger" | "clore" | "supprimer" | null>(null);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  // Réponses nominatives : relues par l'animateur seul (route du Studio), 400 ms après chaque changement du compteur
  // public ou chaque copie reçue, et toutes les 30 s tant que la date limite n'est pas passée (filet).
  const url = `/api/seances/${seance.id}/devoirs/${dd.id}/copies`;
  const liste = useQuery<ListeCopiesDuDirectDto>({ queryKey: [url], refetchInterval: termine ? false : 30_000 });
  const relire = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relireBientot = () => {
    if (relire.current) return;
    relire.current = setTimeout(() => {
      relire.current = null;
      void queryClient.invalidateQueries({ queryKey: [url] });
    }, 400);
  };
  const premier = useRef(true);
  useEffect(() => {
    if (premier.current) {
      premier.current = false;
      return;
    }
    relireBientot();
  }, [dd.copies]);
  useTousEvenements((e) => {
    if (e.type === "copie-recue" && e.data?.devoirId === dd.id) relireBientot();
  });
  useEffect(
    () => () => {
      if (relire.current) clearTimeout(relire.current);
    },
    [],
  );

  const lignes = useMemo(() => regrouperReponses(liste.data?.copies ?? []), [liste.data]);
  const lignesGroupes = lignes.filter((l) => l.groupe);
  const individuelles = lignes.length - lignesGroupes.length;
  const ouverts = Boolean(groupes?.session);
  const groupesSansSalle = ouverts ? (groupes?.groupes ?? []).filter((g) => !g.membres.some((m) => m.role === "salle")) : [];
  const repondus = new Set(lignesGroupes.map((l) => l.groupe!.id));
  const enAttente = dd.enGroupe && ouverts ? groupesSansSalle.filter((g) => !repondus.has(g.id)).map((g) => g.nom) : [];
  const copiesRendues = liste.data?.devoir.copiesRendues ?? dd.copies;
  const inscrits = liste.data?.devoir.inscrits ?? 0;
  // Réponse attendue envoyée (corrigé validé) : le serveur ne dit « absent » ou « non validé » que sans elle.
  const corrige = liste.data?.devoir.corrige;
  const avecCorrige = Boolean(corrige && (corrige.montrable || (corrige.raison !== "absent" && corrige.raison !== "non_valide")));

  const compteur = dd.enGroupe
    ? [
        ouverts && groupesSansSalle.length
          ? tx(lignesGroupes.length === 0 ? "suivi.groupes.total.zero" : lignesGroupes.length === 1 ? "suivi.groupes.total.un" : "suivi.groupes.total", {
              v: { n: lignesGroupes.length, total: groupesSansSalle.length },
            })
          : lignesGroupes.length === 0
            ? tx("suivi.groupes.zero")
            : lignesGroupes.length === 1
              ? tx("suivi.groupes.un")
              : tx("suivi.groupes", { v: { n: lignesGroupes.length } }),
        individuelles === 1 ? tx("suivi.individuelles.une") : individuelles > 1 ? tx("suivi.individuelles", { v: { n: individuelles } }) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : copiesRendues === 0
      ? tx("suivi.reponses.zero", { v: { inscrits } })
      : copiesRendues === 1
        ? tx("suivi.reponses.une", { v: { inscrits } })
        : tx("suivi.reponses", { v: { n: copiesRendues, inscrits } });

  const regler = async (a: "prolonger" | "clore") => {
    setAction(a);
    try {
      const maj = await patch<DevoirDirectDto>(`/api/seances/${seance.id}/devoirs-direct/${dd.id}`, { action: a });
      majDevoirDirect(seance.id, (x) => (x && x.id === maj.id ? { ...maj, monRendu: x.monRendu } : x));
      toast(a === "prolonger" ? tx("studio.toast.prolonge", { v: { heure: heure(maj.dateLimite) } }) : tx("studio.toast.clos"));
    } catch (e) {
      toastErreur(e);
    } finally {
      setAction(null);
    }
  };
  const supprimer = async () => {
    setConfirmerSuppression(false);
    setAction("supprimer");
    try {
      const r = await suppr<{ ok: true; devoirDirect: DevoirDirectDto | null }>(`/api/seances/${seance.id}/devoirs-direct/${dd.id}`);
      majDevoirDirect(seance.id, () => r.devoirDirect);
      toast(tx("studio.toast.supprime"));
    } catch (e) {
      toastErreur(e);
    } finally {
      setAction(null);
    }
  };

  return (
    <div className="defile-fin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3.5">
      <div className={cn("flex flex-col gap-2 rounded-[16px] border bg-nuit-bulle p-4", termine ? "border-nuit-ligne" : "border-orange")}>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] uppercase tracking-wider text-orange">
          <Clock className="h-3.5 w-3.5" />
          {termine ? (
            tx("suivi.termine", { v: { heure: heure(dd.dateLimite) } })
          ) : (
            <>
              <span>{tx("suivi.enCours", { v: { heure: heure(dd.dateLimite) } })}</span>
              <span className="normal-case text-orange-peche">· {tx("suivi.reste", { v: { duree: dureeCourte(new Date(dd.dateLimite).getTime() - maintenant) } })}</span>
            </>
          )}
        </span>
        <p className="text-[16px] font-extrabold leading-snug">{dd.titre}</p>
        <div className={cn("text-[13px] text-nuit-texte", !voirConsigne && "line-clamp-2")}>
          <Markdown source={dd.consigne} nuit className="text-[13px]" />
        </div>
        {(dd.consigne.length > 110 || dd.consigne.includes("\n")) && (
          <button type="button" onClick={() => setVoirConsigne((v) => !v)} className="self-start text-[12px] font-bold text-orange-peche underline-offset-2 hover:underline">
            {voirConsigne ? tx("suivi.consigne.masquer") : tx("suivi.consigne.voir")}
          </button>
        )}
        <p className="text-[15px] font-bold text-white" aria-live="polite">
          {compteur}
        </p>
        {enAttente.length > 0 && <p className="text-[12px] leading-snug text-nuit-doux">{tx("suivi.attente", { v: { groupes: enAttente.join(", ") } })}</p>}
        <p className="text-[12px] leading-snug text-nuit-gris">{avecCorrige ? tx("suivi.correction.corrige") : tx("suivi.correction.campus")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {termine ? (
          <>
            <Bouton variante="nuit" taille="sm" className="min-h-11" icone={<RotateCcw className="h-4 w-4" />} chargement={action === "prolonger"} onClick={() => void regler("prolonger")}>
              {tx("suivi.rouvrir")}
            </Bouton>
            <Bouton variante="nuit-actif" taille="sm" className="min-h-11" icone={<Plus className="h-4 w-4" />} onClick={onAutre}>
              {tx("suivi.autre")}
            </Bouton>
          </>
        ) : (
          <>
            <Bouton variante="nuit" taille="sm" className="min-h-11" icone={<Plus className="h-4 w-4" />} chargement={action === "prolonger"} onClick={() => void regler("prolonger")}>
              {tx("suivi.prolonger")}
            </Bouton>
            <Bouton
              variante="nuit"
              taille="sm"
              className="min-h-11"
              icone={<Square className="h-4 w-4" />}
              chargement={action === "clore"}
              title={tx("suivi.clore.aide")}
              onClick={() => void regler("clore")}
            >
              {tx("suivi.clore")}
            </Bouton>
            {dd.copies === 0 && (
              <Bouton variante="nuit" taille="sm" className="min-h-11" icone={<Trash2 className="h-4 w-4" />} chargement={action === "supprimer"} onClick={() => setConfirmerSuppression(true)}>
                {tx("suivi.supprimer")}
              </Bouton>
            )}
          </>
        )}
      </div>
      {!termine && <p className="-mt-1 text-[11px] leading-snug text-nuit-gris lg:hidden">{tx("suivi.clore.aide")}</p>}

      {liste.isLoading ? (
        <p className="flex items-center gap-2 px-1 text-[14px] text-nuit-doux">
          <Loader2 className="h-4 w-4 animate-spin" /> {tx("suivi.chargement")}
        </p>
      ) : !lignes.length ? (
        <p className="px-2 py-6 text-center text-[14px] leading-relaxed text-nuit-doux">{tx("suivi.vide")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {lignes.map((l) => {
            const c = l.representante;
            const details = [heure(l.renduLe), resumeCopie(txc, c.resume)].filter(Boolean).join(" · ");
            return (
              <li key={l.cle}>
                <button
                  type="button"
                  onClick={() => onOuvrir(dd.id, c.renduId)}
                  aria-label={`${tx("suivi.ouvrir")} : ${l.groupe ? l.groupe.nom : `${c.prenom} ${c.initiale}`}`}
                  className="flex min-h-12 w-full flex-col gap-0.5 rounded-[14px] border border-nuit-ligne bg-nuit-carte px-3 py-2 text-left transition-colors hover:border-orange-peche/60"
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {l.groupe ? (
                      <span className="flex items-center gap-1.5 text-[15px] font-extrabold text-white">
                        <UsersRound className="h-4 w-4 text-orange" /> {l.groupe.nom}
                      </span>
                    ) : (
                      <>
                        <span className="text-[15px] font-extrabold text-white">
                          {c.prenom} {c.initiale}
                        </span>
                        {c.site && <span className="text-[13px] text-nuit-doux">· {c.site}</span>}
                      </>
                    )}
                    {c.enRetard && <span className="rounded-full bg-direct/20 px-2 py-0.5 text-[11px] font-bold text-orange-peche">{tx("suivi.ligne.retard")}</span>}
                  </span>
                  {l.groupe && (
                    <span className="text-[13px] text-nuit-doux">
                      {tx("suivi.ligne.groupe", { v: { nom: l.groupe.parNom } })} · {l.copies.length === 1 ? tx("suivi.ligne.membre") : tx("suivi.ligne.membres", { v: { n: l.copies.length } })}
                    </span>
                  )}
                  <span className="text-[12px] text-nuit-gris">{details}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Fenetre
        ouverte={confirmerSuppression}
        onFermer={() => setConfirmerSuppression(false)}
        titre={tx("suivi.supprimer.titre")}
        description={tx("suivi.supprimer.texte")}
        pied={
          <>
            <Bouton variante="contour" onClick={() => setConfirmerSuppression(false)}>
              {tx("studio.annuler")}
            </Bouton>
            <Bouton variante="danger" onClick={() => void supprimer()}>
              {tx("suivi.supprimer.oui")}
            </Bouton>
          </>
        }
      />
    </div>
  );
}

// ── Étudiant : la carte en haut de la classe ───────────────────────────────

const prenomInitiale = (m: Pick<Moi, "prenom" | "nom">) => `${m.prenom.trim()} ${m.nom.trim() ? `${m.nom.trim().charAt(0).toUpperCase()}.` : ""}`.trim();
const versPourGroupeDto = (p: PourGroupe | null | undefined, moiId: number) => (p ? { groupeId: p.groupeId, nom: p.nom, parNom: p.parNom, parMoi: p.parId === moiId } : null);

/**
 * Le devoir en direct, en haut de la classe : consigne, échéance, groupe, et au plus un bouton orange (« Répondre »).
 * Placée avant la vue du groupe (elle reste visible pendant le travail en groupe). Aucune requête périodique : elle
 * vit de l'état du direct, des événements du canal et de « devoir-rendu ».
 */
export function DevoirEnDirect({ seance, etat, groupes, moi }: { seance: SeanceDetailDto; etat: EtatDirectDto; groupes: GroupesDto | undefined; moi: Moi }) {
  const tx = useTextes(textesDirect);
  const maintenant = Math.max(useMaintenant(30_000), maintenantServeur());
  const dd = etat.devoirDirect ?? null;
  useRenduALEcheance(dd?.dateLimite);
  const [vue, setVue] = useState(false);
  const [plus, setPlus] = useState(false);
  const [rejoindre, setRejoindre] = useState(false);
  const [aBrouillon, setABrouillon] = useState(false);
  const file = useFileEnvoi();
  const enAttente = dd ? file.find((e) => e.url === `/api/devoirs/${dd.id}/rendre`) : undefined;
  const groupeDevoir = dd && groupes?.groupeDevoir?.devoirId === dd.id ? groupes.groupeDevoir : null;
  const relireGroupes = () => void queryClient.invalidateQueries({ queryKey: cleGroupes(seance.id) });

  // Nouveau devoir, échéance repoussée ou avancée, devoir retiré : un mot (la vue ne s'ouvre jamais toute seule).
  const avant = useRef<{ id: number | null; dateLimite: string | null }>({ id: dd?.id ?? null, dateLimite: dd?.dateLimite ?? null });
  useEffect(() => {
    const p = avant.current;
    avant.current = { id: dd?.id ?? null, dateLimite: dd?.dateLimite ?? null };
    if (!dd) {
      if (p.id !== null && vue) {
        setVue(false);
        toast(tx("carte.toast.retire"), "info");
      }
      return;
    }
    if (dd.id !== p.id) {
      if (vue) setVue(false);
      setPlus(false);
      // Devoir en groupe : « mon groupe pour ce devoir » est calculé par le serveur (GET /groupes), relu tout de suite.
      if (dd.enGroupe) relireGroupes();
      toast(tx("carte.toast.nouveau", { v: { titre: dd.titre } }), "info");
      return;
    }
    if (p.dateLimite && p.dateLimite !== dd.dateLimite) {
      const nouvelle = new Date(dd.dateLimite).getTime();
      if (nouvelle > new Date(p.dateLimite).getTime()) toast(tx("carte.toast.prolonge", { v: { heure: heure(dd.dateLimite) } }), "info");
      else if (nouvelle <= Date.now() + MINUTE) toast(tx("carte.toast.clos"), "info");
    }
  }, [dd?.id, dd?.dateLimite]);

  // Arrivée sur la classe avec un devoir en groupe que l'état des groupes ne connaît pas encore : relu une fois.
  const groupesConnus = groupes?.groupeDevoir?.devoirId === dd?.id;
  useEffect(() => {
    if (dd?.enGroupe && groupes && !groupesConnus) relireGroupes();
  }, [dd?.id, Boolean(groupes)]);

  // Brouillon gardé sur le téléphone (texte, ou pages photographiées avant que l'appareil photo ne recharge la page).
  useEffect(() => {
    if (!dd || vue) return;
    let fini = false;
    if (lireTexteBrouillon(moi.id, dd.id).trim()) setABrouillon(true);
    else void lirePagesBrouillon(moi.id, dd.id).then((p) => !fini && setABrouillon(p.length > 0));
    return () => {
      fini = true;
    };
  }, [dd?.id, vue, moi.id]);

  // Ma copie : « devoir-rendu » (chaque copie écrite, aussi celle qu'un camarade a rendue pour le groupe), « devoir-corrige ».
  useTousEvenements((e) => {
    if (!dd || e.data?.devoirId !== dd.id) return;
    if (e.type === "devoir-rendu" && e.data.renduLe) {
      const pg = (e.data.pourGroupe ?? null) as PourGroupe | null;
      const monRendu: MonRenduDirectDto = { statut: "rendu", renduLe: e.data.renduLe, recu: e.data.recu ?? null, enRetard: Boolean(e.data.enRetard), pourGroupe: versPourGroupeDto(pg, moi.id) };
      majDevoirDirect(seance.id, (x) => (x && x.id === dd.id ? { ...x, monRendu } : x));
      if (pg) {
        queryClient.setQueryData<GroupesDto>(cleGroupes(seance.id), (g) =>
          g?.groupeDevoir && g.groupeDevoir.devoirId === dd.id && g.groupeDevoir.groupeId === pg.groupeId
            ? { ...g, groupeDevoir: { ...g.groupeDevoir, copie: { parNom: pg.parNom, parMoi: pg.parId === moi.id, renduLe: e.data.renduLe } } }
            : g,
        );
      }
    } else if (e.type === "devoir-corrige") {
      majDevoirDirect(seance.id, (x) => (x && x.id === dd.id && x.monRendu ? { ...x, monRendu: { ...x.monRendu, statut: "corrige" } } : x));
    }
  });

  // Réponse restée dans la file d'envoi : partie au retour du réseau, ou refusée par le serveur (brouillon gardé). La
  // coquille dit déjà « Envoyé automatiquement » ou « Envoi refusé » avec le message du serveur : la carte se met à
  // jour sans second message.
  useEffect(() => {
    if (!dd) return;
    const prefixe = `rendu-${dd.id}-`;
    const reussi = (ev: Event) => {
      const d = (ev as CustomEvent<{ cle: string; reponse: RecuDepot }>).detail;
      if (!d?.cle?.startsWith(prefixe) || !d.reponse?.recu) return;
      majDevoirDirect(seance.id, (x) =>
        x && x.id === dd.id
          ? {
              ...x,
              monRendu: {
                statut: "rendu",
                renduLe: d.reponse.renduLe,
                recu: d.reponse.recu,
                enRetard: d.reponse.enRetard,
                pourGroupe: d.reponse.groupe && groupeDevoir ? { groupeId: groupeDevoir.groupeId, nom: d.reponse.groupe.nom, parNom: prenomInitiale(moi), parMoi: true } : (x.monRendu?.pourGroupe ?? null),
              },
            }
          : x,
      );
    };
    const refuse = (ev: Event) => {
      const d = (ev as CustomEvent<{ cle: string; message: string }>).detail;
      if (!d?.cle?.startsWith(prefixe)) return;
      relireGroupes();
    };
    window.addEventListener("campus:envoi-reussi", reussi);
    window.addEventListener("campus:envoi-refuse", refuse);
    return () => {
      window.removeEventListener("campus:envoi-reussi", reussi);
      window.removeEventListener("campus:envoi-refuse", refuse);
    };
  }, [dd?.id, groupeDevoir?.groupeId]);

  if (!dd) return null;
  const limite = new Date(dd.dateLimite).getTime();
  const passe = maintenant > limite;
  const monRendu = dd.monRendu;
  const enGroupe = Boolean(groupeDevoir);
  const copieGroupe = groupeDevoir?.copie ?? null;
  const ligneLimite = passe
    ? tx("carte.limitePassee", { v: { heure: heure(dd.dateLimite) } })
    : tx("carte.limite", { v: { heure: heure(dd.dateLimite), reste: tx("carte.reste", { v: { duree: dureeCourte(limite - maintenant) } }) } });
  const ligneGroupe = groupeDevoir
    ? groupeDevoir.membres.length
      ? tx("carte.groupe", { v: { groupe: groupeDevoir.nom, membres: groupeDevoir.membres.join(", ") } })
      : tx("carte.groupe.seul", { v: { groupe: groupeDevoir.nom } })
    : null;
  const libelleRepondre = enGroupe ? tx("carte.repondreGroupe") : aBrouillon ? tx("carte.reprendre") : tx("carte.repondre");

  const avoirLaCopie = async () => {
    if (!groupeDevoir?.copie) return;
    setRejoindre(true);
    try {
      const r = await post<RecuDepot>(`/api/devoirs/${dd.id}/rendre`, {
        texte: "",
        fichierIds: [],
        groupe: { seanceId: seance.id, groupeId: groupeDevoir.groupeId, dejaRenduLe: groupeDevoir.copie.renduLe, rejoindre: true },
      });
      toast(tx("recu.toastRejoint", { v: { recu: r.recu } }));
      majDevoirDirect(seance.id, (x) =>
        x && x.id === dd.id
          ? { ...x, monRendu: { statut: "rendu", renduLe: r.renduLe, recu: r.recu, enRetard: r.enRetard, pourGroupe: { groupeId: groupeDevoir.groupeId, nom: groupeDevoir.nom, parNom: groupeDevoir.copie!.parNom, parMoi: false } } }
          : x,
      );
    } catch (e) {
      toastErreur(e);
      relireGroupes();
    } finally {
      setRejoindre(false);
    }
  };

  // État de la carte (premier qui s'applique) et au plus un bouton orange.
  let etatTexte: string | null = null;
  let etatRendu = false;
  let principal: { libelle: string; action: () => void; chargement?: boolean } | null = null;
  let secondaire: { libelle: string; action: () => void } | null = null;
  // Membre arrivé dans un groupe qui a déjà répondu : sans copie, ou avec la copie de son ancien groupe.
  const copieDUnAutreGroupe = Boolean(monRendu?.pourGroupe && groupeDevoir && monRendu.pourGroupe.groupeId !== groupeDevoir.groupeId);
  if (enAttente) etatTexte = tx("carte.attente");
  else if (monRendu?.statut === "corrige") {
    etatTexte = tx("carte.corrige");
    etatRendu = true;
  }
  else if (copieGroupe && copieDUnAutreGroupe) {
    etatTexte = tx("carte.groupeDeja", { v: { nom: copieGroupe.parNom, heure: heure(copieGroupe.renduLe) } });
    if (!passe) principal = { libelle: tx("carte.rejoindre"), action: () => void avoirLaCopie(), chargement: rejoindre };
    if (!passe) secondaire = { libelle: tx("carte.repondreGroupe"), action: () => setVue(true) };
  } else if (monRendu && !monRendu.pourGroupe) {
    etatTexte = tx("carte.rendu", { v: { recu: monRendu.recu ?? "", heure: heure(monRendu.renduLe) } });
    etatRendu = true;
    if (!passe) secondaire = { libelle: tx("carte.remplacer"), action: () => setVue(true) };
  } else if (monRendu?.pourGroupe) {
    etatTexte = monRendu.pourGroupe.parMoi
      ? tx("carte.renduGroupeMoi", { v: { recu: monRendu.recu ?? "", heure: heure(monRendu.renduLe) } })
      : tx("carte.renduGroupe", { v: { nom: monRendu.pourGroupe.parNom, heure: heure(monRendu.renduLe) } });
    etatRendu = true;
    // Remplacer la réponse du groupe : seulement depuis la classe, pour le même groupe, avant la date limite.
    if (!passe && enGroupe) secondaire = { libelle: tx("carte.remplacerGroupe"), action: () => setVue(true) };
    else if (!passe) secondaire = { libelle: tx("carte.remplacer"), action: () => setVue(true) };
  } else if (copieGroupe && !monRendu) {
    etatTexte = tx("carte.groupeDeja", { v: { nom: copieGroupe.parNom, heure: heure(copieGroupe.renduLe) } });
    if (!passe) principal = { libelle: tx("carte.rejoindre"), action: () => void avoirLaCopie(), chargement: rejoindre };
    secondaire = { libelle: tx("carte.repondreGroupe"), action: () => setVue(true) };
  } else if (passe && dd.accepteRetard) {
    etatTexte = tx("carte.termine.retard");
    principal = { libelle: libelleRepondre, action: () => setVue(true) };
  } else if (passe) etatTexte = tx("carte.termine.ferme");
  else principal = { libelle: libelleRepondre, action: () => setVue(true) };
  const aRendre = !monRendu && !enAttente;

  return (
    <section
      className={cn("flex flex-col gap-2.5 rounded-[18px] bg-nuit-panneau p-4", aRendre && !(passe && !dd.accepteRetard) ? "ring-2 ring-orange" : "ring-1 ring-nuit-ligne")}
      aria-label={tx("carte.etiquette")}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-orange">
          <ClipboardPen className="h-3.5 w-3.5" /> {tx("carte.etiquette")}
        </span>
        <span className="font-mono text-[12px] text-orange-peche">{ligneLimite}</span>
      </div>
      <h2 className="text-[17px] font-extrabold leading-snug text-white">{dd.titre}</h2>
      <div className={cn("text-[15px] leading-relaxed text-nuit-texte", !plus && "line-clamp-4")}>
        <Markdown source={dd.consigne} nuit />
      </div>
      {dd.consigne.length > 160 || dd.consigne.split("\n").length > 4 ? (
        <button type="button" onClick={() => setPlus((v) => !v)} className="-mt-1 self-start text-[13px] font-bold text-orange-peche underline-offset-2 hover:underline">
          {plus ? tx("carte.consigne.moins") : tx("carte.consigne.plus")}
        </button>
      ) : null}
      {ligneGroupe && (
        <p className="flex items-start gap-2 rounded-xl bg-nuit-carte px-3 py-2 text-[14px] leading-snug text-white">
          <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-orange" /> {ligneGroupe}
        </p>
      )}
      {etatTexte && (
        <p className={cn("text-[15px] font-semibold", etatRendu ? "text-[#6FCF97]" : "text-nuit-texte")} role="status">
          {etatTexte}
        </p>
      )}
      {(principal || secondaire) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {principal && (
            <Bouton variante="nuit-actif" taille="lg" className="min-h-12 w-full sm:w-auto" chargement={principal.chargement} onClick={principal.action}>
              {principal.libelle}
            </Bouton>
          )}
          {secondaire && (
            <Bouton variante="nuit" className="min-h-12 w-full sm:w-auto" onClick={secondaire.action}>
              {secondaire.libelle}
            </Bouton>
          )}
        </div>
      )}
      {vue && (
        <VueReponse
          key={dd.id}
          seance={seance}
          dd={dd}
          groupeDevoir={groupeDevoir}
          moi={moi}
          passe={passe}
          ligneLimite={ligneLimite}
          ligneGroupe={ligneGroupe}
          onFermer={() => setVue(false)}
          relireGroupes={relireGroupes}
        />
      )}
    </section>
  );
}

// ── Étudiant : répondre sans quitter la classe ─────────────────────────────

function VueReponse({
  seance,
  dd,
  groupeDevoir,
  moi,
  passe,
  ligneLimite,
  ligneGroupe,
  onFermer,
  relireGroupes,
}: {
  seance: SeanceDetailDto;
  dd: DevoirDirectDto;
  groupeDevoir: GroupesDto["groupeDevoir"] | null;
  moi: Moi;
  passe: boolean;
  ligneLimite: string;
  ligneGroupe: string | null;
  onFermer: () => void;
  relireGroupes: () => void;
}) {
  const tx = useTextes(textesDirect);
  const ref = useRef<HTMLDivElement>(null);
  // Geste retour du téléphone et Échap : la vue se referme, la classe reste (visio, radio, présence).
  useVueSuperposee(ref, onFermer);
  const monRendu = dd.monRendu;
  const enGroupe = Boolean(groupeDevoir);
  // Réponse du groupe que l'étudiant connaît : la sienne si sa copie est celle de ce groupe, sinon la dernière du groupe.
  const dejaRenduLe = groupeDevoir
    ? monRendu?.pourGroupe?.groupeId === groupeDevoir.groupeId
      ? monRendu.renduLe
      : (groupeDevoir.copie?.renduLe ?? null)
    : null;
  const copieOuverture = useRef(groupeDevoir?.copie?.renduLe ?? null);
  const vientDeRendre = groupeDevoir?.copie && !groupeDevoir.copie.parMoi && groupeDevoir.copie.renduLe !== copieOuverture.current ? groupeDevoir.copie : null;
  const remplacement = enGroupe ? Boolean(monRendu) || dejaRenduLe !== null : Boolean(monRendu);
  const precedentLe = enGroupe ? (dejaRenduLe ?? monRendu?.renduLe ?? null) : (monRendu?.renduLe ?? null);
  const auteurPrecedent = groupeDevoir && dejaRenduLe ? (groupeDevoir.copie?.renduLe === dejaRenduLe ? groupeDevoir.copie.parNom : (monRendu?.pourGroupe?.parNom ?? null)) : null;

  const surRecu = (r: RecuDepot) => {
    onFermer();
    if (r.groupe && groupeDevoir) {
      toast(r.groupe.copies > 1 ? tx("recu.toastGroupe", { v: { n: r.groupe.copies, recu: r.recu } }) : tx("recu.toastGroupe.une", { v: { recu: r.recu } }));
      if (r.groupe.ignores.length) toast(tx("recu.sauf", { v: { noms: r.groupe.ignores.join(", ") } }), "info");
    } else toast(tx("recu.toast", { v: { recu: r.recu, heure: heure(r.renduLe) } }));
    majDevoirDirect(seance.id, (x) =>
      x && x.id === dd.id
        ? {
            ...x,
            monRendu: {
              statut: "rendu",
              renduLe: r.renduLe,
              recu: r.recu,
              enRetard: r.enRetard,
              pourGroupe: r.groupe && groupeDevoir ? { groupeId: groupeDevoir.groupeId, nom: r.groupe.nom, parNom: prenomInitiale(moi), parMoi: true } : null,
            },
          }
        : x,
    );
    if (groupeDevoir) relireGroupes();
  };

  // Refus d'une réponse de groupe : le message du serveur, les groupes relus ; la vue reste ouverte, rien n'est perdu.
  const surErreur = (e: unknown) => {
    const code = codeErreur(e);
    if (code === "groupe_deja_rendu" || code === "groupe_change" || code === "pas_en_groupe" || code === "groupe_salle") {
      toast((e as Error).message, code === "groupe_deja_rendu" ? "info" : "erreur");
      relireGroupes();
      return true;
    }
    return false;
  };

  return createPortal(
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={dd.titre} className="fixed inset-0 z-[45] flex flex-col bg-creme text-encre outline-none">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ligne bg-white px-3 py-2">
        <Bouton variante="fantome" className="min-h-12 px-3" icone={<ArrowLeft className="h-5 w-5" />} onClick={onFermer}>
          {tx("vue.revenir")}
        </Bouton>
        <span className="flex items-center gap-2 text-[13px] text-texte-pale">
          <span className="point-direct" /> {tx("vue.direct")}
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-28 pt-4">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[12px] text-orange-fonce">{ligneLimite}</span>
            <h1 className="text-[22px] font-black leading-tight tracking-serre">{groupeDevoir ? tx("vue.titreGroupe", { v: { groupe: groupeDevoir.nom } }) : dd.titre}</h1>
            {groupeDevoir && <p className="text-[15px] font-bold">{dd.titre}</p>}
            <Markdown source={dd.consigne} className="text-[15.5px]" />
            {ligneGroupe && <p className="rounded-xl bg-orange-pale px-3 py-2 text-[14px] leading-snug">{ligneGroupe}</p>}
            {vientDeRendre && (
              <p className="rounded-xl bg-alerte-clair px-3 py-2 text-[14px] font-semibold leading-snug" role="status">
                {tx("vue.groupeVientDeRendre", { v: { nom: vientDeRendre.parNom } })}
              </p>
            )}
          </div>
          <ZoneRendu
            utilisateurId={moi.id}
            devoir={{ id: dd.id, titre: dd.titre }}
            correctionCampus
            remplacement={remplacement}
            renduPrecedentLe={precedentLe}
            texteServeur={null}
            enRetard={passe}
            onRecu={surRecu}
            onEnFile={() => {
              onFermer();
              toast(tx("file.toast"), "info");
            }}
            onAnnuler={remplacement ? onFermer : undefined}
            sansVideo
            corpsEnPlus={groupeDevoir ? { groupe: { seanceId: seance.id, groupeId: groupeDevoir.groupeId, dejaRenduLe } } : undefined}
            libelles={
              groupeDevoir
                ? {
                    titre: tx("rendu.titre"),
                    envoyer: tx("rendu.envoyer"),
                    garder: tx("rendu.garder"),
                    confirmerTitre: tx("rendu.confirmerTitre"),
                    ...(auteurPrecedent && precedentLe ? { confirmerTexte: tx("rendu.confirmerTexte", { v: { nom: auteurPrecedent, heure: heure(precedentLe) } }) } : {}),
                  }
                : undefined
            }
            surErreur={surErreur}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
