// Correction automatique des copies (décision de José du 8 octobre 2026), côté formateur : ce que partagent
// les écrans des copies (PageCopies, /corriger/:id) et ceux du module « côté formateur » (corrigés du jour,
// copies à revoir) : l'échéance du corrigé dite avec des mots, le badge « Corrigé par le campus », la raison
// d'une copie retenue, l'état de la correction d'une copie, la justification par critère et la réponse à
// une demande de relecture. Textes : shared/textes/corrections.ts (vouvoiement ; la réponse à l'étudiant
// est tutoyée). Contrat des échanges : shared/engagement/corrections.ts.
import { useState } from "react";
import { EyeOff, FileQuestion, FileX, Hourglass, MessageSquareQuote, RefreshCw, School, ShieldAlert, Video, type LucideIcon } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { ZoneTexte } from "@/components/ui/champs";
import { Badge } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { post } from "@/lib/api";
import { heureDouble, jourLong, relatif } from "@/lib/dates";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import type { Traducteur } from "@shared/textes";
import { selonNombre, t, type CleCorrections } from "@shared/textes/corrections";
import { ESSAIS_MAX_CORRECTION, MOTIF_RELECTURE_MAX, type CorpsTraiterRelecture, type CorrigeAValider, type RaisonARevoir } from "@shared/engagement/corrections";
import type { CopieDetail } from "@shared/schema";
import { nombre } from "../outils";

type Tx = Traducteur<CleCorrections>;
const JOUR = 86_400_000;

/** « aujourd'hui », « demain » ou « jeudi 9 octobre » (jours d'Abidjan, GMT). */
export function jourEcheance(tx: Tx, iso: string, maintenant = Date.now()): string {
  const ecart = Math.floor(new Date(iso).getTime() / JOUR) - Math.floor(maintenant / JOUR);
  if (ecart === 0) return tx("echeance.aujourdhui");
  if (ecart === 1) return tx("echeance.demain");
  return jourLong(iso);
}

/** « Tenu pour bon demain à 07h00 Abidjan sans réponse de votre part. » (avec l'heure de chez lui s'il est loin). */
export function texteEcheance(tx: Tx, iso: string, maintenant = Date.now()): string {
  if (new Date(iso).getTime() <= maintenant) return tx("echeance.depassee");
  return tx("echeance.tenuPourBon", { v: { jour: jourEcheance(tx, iso, maintenant), heure: heureDouble(iso) } });
}

/** « 12 copies rendues · 8 notées par le campus · 1 à revoir » (exercice), « 15 étudiants l'ont fait » (QCM). */
export function resumeCopies(tx: Tx, c: Pick<CorrigeAValider, "type" | "copies">): string[] {
  if (c.type === "quiz") return [selonNombre(tx, "copies.tentatives", c.copies.rendues)];
  return [
    selonNombre(tx, "copies.rendues", c.copies.rendues),
    c.copies.notees > 0 ? selonNombre(tx, "copies.notees", c.copies.notees) : null,
    c.copies.enFile > 0 ? selonNombre(tx, "copies.enFile", c.copies.enFile) : null,
    c.copies.aRevoir > 0 ? selonNombre(tx, "copies.aRevoir", c.copies.aRevoir) : null,
  ].filter((x): x is string => Boolean(x));
}

/** Pastille « Corrigé par le campus » (note publiée par la correction automatique). */
export function BadgeCampus({ className, court }: { className?: string; court?: boolean }) {
  const tx = useTextes(t);
  return (
    <Badge ton="succes" className={className}>
      <School className="h-3 w-3" aria-hidden /> {tx(court ? "liste.campus" : "campus.badge")}
    </Badge>
  );
}

export const ICONES_RAISON: Record<RaisonARevoir | "relecture", LucideIcon> = {
  alerte: ShieldAlert,
  illisible: EyeOff,
  video: Video,
  format: FileQuestion,
  vide: FileX,
  echecs: RefreshCw,
  relecture: MessageSquareQuote,
};

export const libelleRaison = (tx: Tx, raison: RaisonARevoir | "relecture") => tx(`raison.${raison}`);
export const texteRaison = (tx: Tx, raison: RaisonARevoir | "relecture") => tx(`raison.${raison}.texte` as CleCorrections, { v: { n: ESSAIS_MAX_CORRECTION } });

/**
 * Ce que le campus a fait (ou fait) de cette copie, au-dessus de la notation : note publiée par le campus,
 * correction en cours, ou copie retenue (et pourquoi). Rien pour une copie hors du circuit.
 */
export function EtatCorrectionCopie({ copie, bareme, className }: { copie: CopieDetail; bareme: number; className?: string }) {
  const tx = useTextes(t);
  const auto = copie.correctionAuto ?? null;
  const parLeCampus = copie.origineNote === "campus" && copie.statut === "corrige";

  if (parLeCampus) {
    return (
      <div className={cn("flex flex-col gap-1.5 rounded-2xl bg-succes-clair/70 p-3", className)}>
        <BadgeCampus className="self-start" />
        <p className="text-sm leading-snug text-texte-doux">{tx("campus.notee")}</p>
      </div>
    );
  }
  if (!auto) return null;
  if (auto.etat === "a_revoir" && auto.raison) {
    const Icone = ICONES_RAISON[auto.raison];
    return (
      <div className={cn("flex flex-col gap-1.5 rounded-2xl bg-alerte-clair p-3", className)} role="status">
        <span className="flex items-center gap-2 text-[15px] font-bold text-alerte">
          <Icone className="h-4 w-4 shrink-0" aria-hidden />
          {tx("campus.aRevoir")} · {libelleRaison(tx, auto.raison)}
        </span>
        <p className="text-sm leading-snug text-texte-doux">{texteRaison(tx, auto.raison)}</p>
        {auto.detail && <p className="rounded-xl bg-white/70 px-3 py-2 text-sm leading-snug text-texte-doux">{auto.detail}</p>}
      </div>
    );
  }
  if (auto.etat === "en_file" || auto.etat === "erreur") {
    return (
      <div className={cn("flex items-start gap-2.5 rounded-2xl bg-creme p-3", className)} role="status">
        <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-texte-pale" aria-hidden />
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-bold">{tx(auto.etat === "en_file" ? "campus.enFile" : "campus.erreur")}</span>
          <span className="text-sm leading-snug text-texte-pale">{tx(auto.etat === "en_file" ? "campus.enFile.texte" : "campus.erreur.texte")}</span>
        </span>
      </div>
    );
  }
  // Note du campus changée ensuite par un formateur : on garde la trace de l'écart.
  if (auto.noteCampus !== null && copie.note !== null && auto.noteCampus !== copie.note) {
    return <p className={cn("text-[13px] text-texte-gris", className)}>{tx("campus.noteChangee", { v: { note: nombre(auto.noteCampus), bareme: nombre(bareme) } })}</p>;
  }
  return null;
}

/** Pourquoi le campus a donné ces points à ce critère (note du campus). */
export function JustificationCritere({ texte, className }: { texte: string; className?: string }) {
  const tx = useTextes(t);
  return (
    <p className={cn("text-[13px] leading-snug text-texte-pale", className)}>
      <span className="font-semibold text-succes">{tx("campus.pourquoi")} · </span>
      {texte}
    </p>
  );
}

const PHRASES: Record<"garder" | "changer", CleCorrections[]> = {
  garder: ["relecture.phrase.garder.1", "relecture.phrase.garder.2", "relecture.phrase.garder.3"],
  changer: ["relecture.phrase.changer.1", "relecture.phrase.changer.2", "relecture.phrase.changer.3"],
};

/**
 * Réponse du formateur à une demande de relecture : le motif de l'étudiant, « Garder la note » ou
 * « Changer la note », un mot pour lui (tutoyé, phrases rapides), puis UN bouton qui envoie
 * (POST /api/enseigner/relectures/:id). L'étudiant est prévenu par le campus.
 */
export function TraiterRelecture({
  relecture,
  prenom,
  note,
  bareme,
  onFait,
  className,
}: {
  relecture: { id: number; motif: string; creeLe: string };
  prenom: string;
  /** Note actuelle de la copie (celle que l'étudiant conteste). */
  note: number | null;
  bareme: number;
  onFait?: () => void;
  className?: string;
}) {
  const tx = useTextes(t);
  const [choix, setChoix] = useState<"garder" | "changer" | null>(null);
  const [saisie, setSaisie] = useState(note === null ? "" : String(note));
  const [reponse, setReponse] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const valeur = saisie.trim() === "" ? null : Number(saisie.replace(",", "."));
  const noteValide = valeur !== null && !Number.isNaN(valeur) && valeur >= 0 && valeur <= bareme;
  const pret = choix === "garder" || (choix === "changer" && noteValide);

  function ajouterPhrase(cle: CleCorrections) {
    const phrase = tx(cle);
    setReponse((avant) => (avant.includes(phrase) ? avant : `${avant.trim()}${avant.trim() ? " " : ""}${phrase}`));
  }

  async function envoyer() {
    if (!choix) return;
    if (choix === "changer" && !noteValide) {
      toastErreur(new Error(tx("relecture.horsLimites", { v: { bareme: nombre(bareme) } })));
      return;
    }
    if (!reponse.trim()) {
      toastErreur(new Error(tx("relecture.reponseVide")));
      return;
    }
    setEnvoi(true);
    try {
      const corps: CorpsTraiterRelecture = choix === "changer" ? { note: valeur, reponse: reponse.trim() } : { reponse: reponse.trim() };
      await post(`/api/enseigner/relectures/${relecture.id}`, corps);
      toast(tx("relecture.envoyee", { v: { prenom } }));
      await rafraichir("/api/enseigner", "/api/rendus", "/api/devoirs");
      onFait?.();
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <figure className="flex flex-col gap-1 rounded-2xl bg-creme p-3">
        <figcaption className="text-[13px] font-bold text-texte-pale">{tx("revoir.motif", { v: { prenom } })}</figcaption>
        <blockquote className="whitespace-pre-line text-[15px] leading-relaxed text-encre">« {relecture.motif} »</blockquote>
        <span className="font-mono text-[11px] text-texte-gris">{tx("revoir.demandee", { v: { quand: relatif(relecture.creeLe) } })}</span>
      </figure>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label={tx("relecture.choisir")}>
        {(["garder", "changer"] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={choix === c}
            onClick={() => setChoix(c)}
            className={cn(
              "flex min-h-[52px] flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-[15px] font-bold leading-tight transition-colors",
              choix === c ? "bg-encre text-white" : "bg-creme text-encre hover:bg-orange-clair",
            )}
          >
            {tx(c === "garder" ? "relecture.garder" : "relecture.changer")}
            {c === "garder" && note !== null && (
              <span className={cn("font-mono text-xs font-normal", choix === c ? "text-orange-peche" : "text-texte-gris")}>
                {nombre(note)}/{nombre(bareme)}
              </span>
            )}
          </button>
        ))}
      </div>

      {choix === "changer" && (
        <label className="flex items-center gap-3">
          <span className="flex-1 text-[15px] font-semibold">{tx("relecture.nouvelleNote")}</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={bareme}
            step={0.25}
            autoFocus
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            className="h-12 w-24 rounded-xl border border-ligne px-2 text-center text-lg font-bold tabular-nums outline-none focus:border-orange"
          />
          <span className="font-mono text-sm text-texte-gris">/{nombre(bareme)}</span>
        </label>
      )}

      {choix && (
        <div className="flex flex-col gap-2">
          <ZoneTexte
            libelle={tx("relecture.reponse", { v: { prenom } })}
            rows={3}
            maxLength={MOTIF_RELECTURE_MAX}
            value={reponse}
            onChange={(e) => setReponse(e.target.value)}
            aide={tx("relecture.reponse.aide")}
          />
          {/* Une seule ligne qui défile au doigt, comme les phrases rapides de la correction. */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap">
            {PHRASES[choix].map((cle) => (
              <button
                key={cle}
                type="button"
                onClick={() => ajouterPhrase(cle)}
                className="min-h-[44px] shrink-0 whitespace-nowrap rounded-full bg-creme px-3.5 text-[13px] font-semibold text-texte-doux hover:bg-orange-clair"
              >
                {tx(cle)}
              </button>
            ))}
          </div>
        </div>
      )}

      <Bouton taille="lg" pleineLargeur onClick={() => void envoyer()} disabled={!pret} chargement={envoi} className="min-h-[52px] px-3 leading-tight">
        {!choix
          ? tx("relecture.choisir")
          : choix === "changer" && noteValide && valeur !== null
            ? tx("relecture.envoyer.note", { v: { note: nombre(valeur), bareme: nombre(bareme), prenom } })
            : tx("relecture.envoyer", { v: { prenom } })}
      </Bouton>
    </div>
  );
}
