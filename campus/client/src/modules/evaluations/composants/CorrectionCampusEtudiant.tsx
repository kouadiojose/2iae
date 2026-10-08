// Correction automatique côté étudiant (chantier K4, décision de José du 8 octobre 2026) : où en est la
// correction de sa copie par le campus, la demande de relecture de sa note et la réponse du formateur, le
// corrigé après la date limite. Le retour doit être rapide, clair et encourageant, sur un téléphone de 360 px.
// Le campus ne corrige une copie qu'après la date limite (sa note arrive le soir qui suit, attendueLe du
// serveur) ; une copie rendue en retard est corrigée tout de suite. Une copie avec une vidéo ou un son n'est
// jamais notée par le campus : elle va au formateur, et l'étudiant le lit dès le dépôt.
// Contrat : shared/engagement/corrections.ts (EtatCorrectionEtudiant, RelectureEtudiant, CorpsDemanderRelecture).
import { useRef, useState } from "react";
import { Hourglass, Camera, Eye, MessageSquareText, CheckCircle2, BookOpenCheck, ChevronDown } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { ZoneTexte } from "@/components/ui/champs";
import { Fenetre } from "@/components/ui/fenetre";
import { Markdown } from "@/components/ui/markdown";
import { toast, toastErreur } from "@/components/ui/toast";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { dateCourte, jourLong, relatif } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { t, type CleCorrectionsEtudiant } from "@shared/textes/corrections-etudiant";
import type { Traducteur } from "@shared/textes";
import { MOTIF_RELECTURE_MAX, type CorpsDemanderRelecture, type EtatCorrectionEtudiant } from "@shared/engagement/corrections";
import type { PieceJointe, RenduEtudiant } from "@shared/schema";
import { nombre } from "../outils";

type Tx = Traducteur<CleCorrectionsEtudiant>;

/** Longueur minimale d'un motif de relecture (même règle que le serveur). */
const MOTIF_MIN = 10;
const JOUR = 86_400_000;
/** Numéro du jour à Abidjan (GMT toute l'année). */
const jourAbidjan = (ms: number) => Math.floor(ms / JOUR);

/** Ce que le campus lit dans une copie : photos, PDF et texte. Le reste (vidéo, son, Word…) va au formateur. */
export const luParLeCampus = (mime: string) => mime.startsWith("image/") || mime === "application/pdf" || mime === "text/plain";
const estVideo = (f: Pick<PieceJointe, "mime">) => f.mime.startsWith("video/");
const estSon = (f: Pick<PieceJointe, "mime">) => f.mime.startsWith("audio/");

/**
 * L'état à montrer à l'étudiant. Une copie avec une vidéo ou un son n'est jamais notée par le campus, même
 * avec des photos ou du texte (le moteur la laisse au formateur) : dès le dépôt, on le lui dit, au lieu de
 * « ta note arrive jeudi soir » tant que le serveur la dit encore « en file » (il ne le sait qu'au passage du
 * moteur, après la date limite).
 */
export function etatAMontrer(c: EtatCorrectionEtudiant, fichiers: Pick<PieceJointe, "mime">[]): EtatCorrectionEtudiant {
  if (c.etat !== "en_file" && c.etat !== "erreur") return c;
  if (fichiers.some(estVideo)) return { etat: "a_revoir", raison: "video", attendueLe: null };
  if (fichiers.some(estSon)) return { etat: "a_revoir", raison: null, attendueLe: null };
  return c;
}

/**
 * Quand la note arrive, avec des mots : « ce soir », « demain soir », « jeudi soir », « le 12 oct. au soir ».
 * Une heure déjà passée (la routine du soir tourne peut-être) devient « très bientôt ».
 */
export function quandEnMots(iso: string, maintenant: number, tx: Tx): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms) || ms <= maintenant) return tx("quand.bientot");
  const soir = new Date(ms).getUTCHours() >= 18;
  const ecart = jourAbidjan(ms) - jourAbidjan(maintenant);
  if (ecart === 0) return tx(soir ? "quand.ceSoir" : "quand.aujourdhui");
  if (ecart === 1) return tx(soir ? "quand.demainSoir" : "quand.demain");
  if (ecart < 7) return tx(soir ? "quand.jourSoir" : "quand.jour", { v: { jour: jourLong(iso).split(" ")[0] } });
  return tx(soir ? "quand.dateSoir" : "quand.date", { v: { date: dateCourte(iso) } });
}

/**
 * Avant la date limite : « Le campus corrige ta copie après la date limite : ta note arrive jeudi soir. »
 * Après (copie en retard, ou date limite passée) : « Le campus corrige ta copie : ta note arrive ce soir. »
 */
export function phraseNoteAttendue(c: EtatCorrectionEtudiant, maintenant: number, tx: Tx, dateLimite?: string | null): string {
  const avantLimite = Boolean(dateLimite) && new Date(dateLimite!).getTime() > maintenant;
  if (avantLimite) return c.attendueLe ? tx("campus.apresLimite", { v: { quand: quandEnMots(c.attendueLe, maintenant, tx) } }) : tx("campus.apresLimite.bientot");
  return c.attendueLe ? tx("campus.enFile", { v: { quand: quandEnMots(c.attendueLe, maintenant, tx) } }) : tx("campus.enFile.bientot");
}

/**
 * Qui va regarder une copie que le campus ne note pas : sa vidéo, son enregistrement, ou sa copie. Une copie
 * difficile à lire qu'il ne peut plus remplacer (date limite passée) : le formateur la lit, sans l'inviter à
 * renvoyer une photo.
 */
function phraseFormateur(c: EtatCorrectionEtudiant, fichiers: Pick<PieceJointe, "mime">[], tx: Tx): string {
  if (c.raison === "video" || fichiers.some(estVideo)) return tx("campus.video");
  if (fichiers.some(estSon)) return tx("campus.son");
  if (c.raison === "illisible") return tx("campus.illisible.formateur");
  return tx("campus.formateur");
}

/**
 * La phrase du reçu, juste après le dépôt : quand la note arrive, ou qui va regarder la copie (« formateur » :
 * le campus ne la note pas).
 */
export function phraseApresDepot(
  c: EtatCorrectionEtudiant,
  fichiers: Pick<PieceJointe, "mime">[],
  maintenant: number,
  tx: Tx,
  dateLimite?: string | null,
): { texte: string; formateur: boolean } {
  const vu = etatAMontrer(c, fichiers);
  if (vu.etat === "a_revoir") return { texte: phraseFormateur(vu, fichiers, tx), formateur: true };
  return { texte: phraseNoteAttendue(vu, maintenant, tx, dateLimite), formateur: false };
}

/**
 * Copie rendue, pas encore notée : le campus la corrige (note attendue), ou il la laisse au formateur
 * (« à revoir »). Une copie illisible qu'il peut encore remplacer : le bouton de remplacement passe devant
 * (sans « onRemplacer » : la zone de remplacement est déjà ouverte, le bouton disparaît).
 */
export function EtatCorrectionCampus({
  correction: brute,
  fichiers = [],
  dateLimite,
  maintenant,
  peutRemplacer,
  onRemplacer,
}: {
  correction: EtatCorrectionEtudiant;
  /** Les fichiers de la copie : une vidéo ou un son la fait relire par le formateur. */
  fichiers?: Pick<PieceJointe, "mime">[];
  /** Date limite du devoir : avant, « le campus corrige ta copie après la date limite ». */
  dateLimite?: string | null;
  maintenant: number;
  peutRemplacer: boolean;
  onRemplacer?: () => void;
}) {
  const tx = useTextes(t);
  const correction = etatAMontrer(brute, fichiers);
  if (correction.etat === "a_revoir" && correction.raison === "illisible" && peutRemplacer) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-alerte/30 bg-alerte-clair p-4">
        <span className="flex items-start gap-2.5">
          <Camera className="mt-0.5 h-5 w-5 shrink-0 text-alerte" />
          <span className="flex flex-col gap-1">
            <strong className="text-base text-encre">{tx("campus.illisible.titre")}</strong>
            <span className="text-[15px] leading-snug text-texte-doux">{tx("campus.illisible.texte")}</span>
          </span>
        </span>
        {onRemplacer && (
          <Bouton onClick={onRemplacer} icone={<Camera className="h-5 w-5" />} pleineLargeur className="min-h-[52px]">
            {tx("campus.illisible.bouton")}
          </Bouton>
        )}
      </div>
    );
  }
  if (correction.etat === "a_revoir") {
    return (
      <p className="flex items-start gap-2.5 rounded-2xl bg-white/70 p-3.5 text-[15px] leading-snug">
        <Eye className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" />
        <span>
          <strong className="block text-encre">{phraseFormateur(correction, fichiers, tx)}</strong>
          <span className="text-texte-doux">{tx("campus.formateur.detail")}</span>
        </span>
      </p>
    );
  }
  // en_file, erreur (nouvel essai automatique au passage suivant) : la note est en route.
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white/70 p-3.5">
      <p className="flex items-start gap-2.5 text-[15px] leading-snug">
        <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" />
        <span>
          <strong className="block text-encre">{phraseNoteAttendue(correction, maintenant, tx, dateLimite)}</strong>
          <span className="text-texte-doux">{tx("campus.enFile.detail")}</span>
        </span>
      </p>
      {peutRemplacer && onRemplacer && <p className="pl-[30px] text-sm text-texte-pale">{tx("campus.remplacer")}</p>}
    </div>
  );
}

/**
 * Note publiée : la demande de relecture (bouton, puis son état et la réponse du formateur). Le bouton
 * n'apparaît que pour une note du campus sans demande ouverte ; une note refaite par le campus après la
 * réponse du formateur (corrigé précisé) peut faire l'objet d'une nouvelle demande. Fond sombre (bloc note).
 */
export function RelectureNote({ rendu, bareme }: { rendu: RenduEtudiant; bareme: number }) {
  const tx = useTextes(t);
  const [ouverte, setOuverte] = useState(false);
  const r = rendu.relecture ?? null;
  // Refaite par le campus (corrigé précisé) après la réponse : pas un simple enregistrement du formateur, dont la
  // note reste celle de la relecture (origine « formateur ») et dont la réponse doit rester visible.
  const noteRefaiteDepuis = Boolean(
    rendu.origineNote === "campus" && r?.traiteeLe && rendu.corrigeLe && new Date(rendu.corrigeLe).getTime() > new Date(r.traiteeLe).getTime(),
  );
  const peutDemander = rendu.origineNote === "campus" && (!r || (r.statut === "traitee" && noteRefaiteDepuis));
  // Critères où des points manquent : des débuts de phrase à un toucher.
  const criteresPerdus = (rendu.noteDetail ?? []).filter((l) => l.obtenu < l.points).slice(0, 4);

  return (
    <>
      {r && !(r.statut === "traitee" && noteRefaiteDepuis) && <EtatRelecture r={r} note={rendu.note} bareme={bareme} tx={tx} />}
      {peutDemander && (
        <div className="flex flex-col gap-2 border-t border-nuit-ligne pt-4">
          <p className="text-[15px] text-nuit-texte">{tx("relecture.question")}</p>
          <Bouton variante="nuit" onClick={() => setOuverte(true)} icone={<MessageSquareText className="h-4 w-4" />} className="min-h-[48px]">
            {tx("relecture.bouton")}
          </Bouton>
        </div>
      )}
      {peutDemander && <FenetreRelecture ouverte={ouverte} onFermer={() => setOuverte(false)} renduId={rendu.id} criteres={criteresPerdus.map((l) => l.critere)} tx={tx} />}
    </>
  );
}

function EtatRelecture({ r, note, bareme, tx }: { r: NonNullable<RenduEtudiant["relecture"]>; note: number | null; bareme: number; tx: Tx }) {
  if (r.statut === "ouverte") {
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-nuit-carte p-4">
        <span className="flex items-center gap-2 text-[15px] font-bold text-white">
          <Hourglass className="h-4 w-4 shrink-0 text-orange" /> {tx("relecture.ouverte.titre")}
        </span>
        <p className="text-[15px] leading-snug text-nuit-texte">{tx("relecture.ouverte.texte")}</p>
        <span className="font-mono text-xs text-nuit-gris">{tx("relecture.ouverte.le", { v: { quand: relatif(r.creeLe) } })}</span>
        <Motif motif={r.motif} tx={tx} />
      </div>
    );
  }
  const change = r.noteAvant !== null && r.noteApres !== null && r.noteApres !== r.noteAvant;
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-nuit-carte p-4">
      <span className="flex items-center gap-2 text-[15px] font-bold text-white">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-orange" /> {tx("relecture.traitee.titre")}
      </span>
      {r.reponse && <p className="whitespace-pre-line text-[15.5px] leading-relaxed text-nuit-texte">{r.reponse}</p>}
      <p className={cn("text-[15px] font-bold", change ? "text-orange-peche" : "text-nuit-doux")}>
        {change
          ? tx("relecture.noteChangee", { v: { avant: nombre(r.noteAvant), apres: nombre(r.noteApres), bareme: nombre(bareme) } })
          : tx("relecture.noteGardee", { v: { note: nombre(r.noteAvant ?? note), bareme: nombre(bareme) } })}
      </p>
      <Motif motif={r.motif} tx={tx} />
    </div>
  );
}

/** Le motif de l'étudiant, replié (il le connaît : il sert de rappel). */
function Motif({ motif, tx }: { motif: string; tx: Tx }) {
  return (
    <details className="group text-sm text-nuit-gris">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 font-semibold text-nuit-doux [&::-webkit-details-marker]:hidden">
        {tx("relecture.tonMotif")}
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <p className="whitespace-pre-line pb-1 leading-relaxed">{motif}</p>
    </details>
  );
}

function FenetreRelecture({ ouverte, onFermer, renduId, criteres, tx }: { ouverte: boolean; onFermer: () => void; renduId: number; criteres: string[]; tx: Tx }) {
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const zone = useRef<HTMLTextAreaElement>(null);
  const longueur = motif.trim().length;
  const manque = Math.max(0, MOTIF_MIN - longueur);

  const ajouter = (debut: string) => {
    setMotif((m) => `${m.trim() ? `${m.trimEnd()}\n` : ""}${debut}`.slice(0, MOTIF_RELECTURE_MAX));
    requestAnimationFrame(() => {
      const el = zone.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  async function envoyer() {
    if (manque > 0 || envoi) return;
    setEnvoi(true);
    try {
      const corps: CorpsDemanderRelecture = { motif: motif.trim() };
      await post(`/api/rendus/${renduId}/relecture`, corps);
      toast(tx("relecture.envoyee"));
      setMotif("");
      onFermer();
      void rafraichir("/api/devoirs", "/api/notes");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre={tx("relecture.titre")}
      description={tx("relecture.description")}
      pied={
        <>
          <Bouton variante="contour" onClick={onFermer} className="min-h-[48px]">
            {tx("relecture.annuler")}
          </Bouton>
          <Bouton onClick={() => void envoyer()} chargement={envoi} disabled={manque > 0} className="min-h-[48px]">
            {tx("relecture.envoyer")}
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-1">
        <div className="flex flex-col gap-2">
          <span className="text-sm text-texte-pale">{tx("relecture.pourCommencer")}</span>
          <div className="flex flex-wrap gap-2">
            <Suggestion onClick={() => ajouter(tx("relecture.suggestion.page.texte"))}>{tx("relecture.suggestion.page")}</Suggestion>
            {criteres.map((c) => (
              <Suggestion key={c} onClick={() => ajouter(`« ${c} » : `)}>
                « {c} »
              </Suggestion>
            ))}
          </div>
        </div>
        <ZoneTexte
          ref={zone}
          libelle={tx("relecture.libelle")}
          placeholder={tx("relecture.placeholder")}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          maxLength={MOTIF_RELECTURE_MAX}
          rows={5}
          className="[&_textarea]:text-base"
          aide={
            <span className="flex justify-between gap-3">
              <span>{manque > 0 ? tx("relecture.trop.court", { v: { n: manque } }) : ""}</span>
              <span className="font-mono">{tx("relecture.compteur", { v: { n: motif.length, max: MOTIF_RELECTURE_MAX } })}</span>
            </span>
          }
        />
      </div>
    </Fenetre>
  );
}

function Suggestion({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[44px] max-w-full truncate rounded-full border border-ligne bg-creme px-3.5 text-left text-sm font-semibold text-encre hover:border-orange hover:bg-orange-pale"
    >
      {children}
    </button>
  );
}

/** Le corrigé validé du devoir, après la date limite : replié, pour comparer avec sa copie. */
export function LeCorrige({ contenu }: { contenu: string }) {
  const tx = useTextes(t);
  const [ouvert, setOuvert] = useState(false);
  return (
    <Carte className="flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-succes-clair text-succes">
          <BookOpenCheck className="h-5 w-5" />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-extrabold">{tx("corrige.titre")}</h2>
          <p className="text-[15px] text-texte-pale">{tx("corrige.texte")}</p>
        </div>
      </div>
      <Bouton variante={ouvert ? "fantome" : "contour"} onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} className="min-h-[48px]">
        {tx(ouvert ? "corrige.cacher" : "corrige.voir")}
      </Bouton>
      {ouvert && (
        <div className="rounded-xl bg-succes-clair p-4">
          <Markdown source={contenu} className="text-base" />
        </div>
      )}
    </Carte>
  );
}
