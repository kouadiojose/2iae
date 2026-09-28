// Onglet « Pièces » du dossier étudiant : les pièces requises (reçues ou
// manquantes) puis les autres. Au guichet on coche « Reçue », ou on
// photographie le document ; les pièces déposées par l'étudiant depuis son
// espace arrivent « À vérifier » : on les valide ou on les refuse avec un motif.
import { useEffect, useState, type ChangeEvent } from "react";
import { Check, Camera, X, ExternalLink, MoreVertical, Trash2, FilePlus2, Paperclip } from "lucide-react";
import type { PieceDossier } from "@shared/schema";
import { Badge, BarreProgression } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { Carte, TitreSection } from "@/components/ui/carte";
import { Champ, ZoneTexte } from "@/components/ui/champs";
import { Fenetre } from "@/components/ui/fenetre";
import { Menu, ElementMenu } from "@/components/ui/menu";
import { toast, toastErreur } from "@/components/ui/toast";
import { post, patch, suppr, televerser } from "@/lib/api";
import { dateCourte } from "@/lib/dates";
import { cn, taille } from "@/lib/utils";
import { ETATS_PIECE } from "../outils-crm";
import { majCrm, perimerListes } from "./DossierOutils";

// L'usage « piece » existe côté serveur (server/fichiers.ts) ; le type de televerser() ne le liste pas encore.
const USAGE_PIECE = "piece" as Parameters<typeof televerser>[1];
const TYPES_FICHIER = "image/*,application/pdf";
const MOTIFS_REFUS = ["Photo floue ou illisible", "Pièce expirée", "Document incomplet", "Ce n'est pas le bon document"];
const SUGGESTIONS_AUTRE = ["Attestation de bourse", "Certificat de résidence", "Relevé de notes du BAC"];

const cle = (p: PieceDossier) => (p.id !== null ? `id-${p.id}` : `type-${p.type}`);

async function televerserPiece(fichier: File): Promise<number> {
  const [f] = await televerser([fichier], USAGE_PIECE);
  if (!f) throw new Error("Le fichier n'a pas pu être envoyé. Réessayez.");
  return f.id;
}

export function DossierPieces({ etudiantId, pieces }: { etudiantId: number; pieces: PieceDossier[] }) {
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [refus, setRefus] = useState<PieceDossier | null>(null);
  const [autre, setAutre] = useState(false);
  const base = `/api/pilotage/etudiants/${etudiantId}/pieces`;

  // Les requises d'abord (le serveur les renvoie déjà ainsi, on s'en assure).
  const liste = [...pieces].sort((a, b) => Number(b.requise) - Number(a.requise));
  const requises = pieces.filter((p) => p.requise);
  const recues = requises.filter((p) => p.statut === "recue").length;
  const aVerifier = pieces.filter((p) => p.statut === "a_verifier").length;

  /** Lance une action qui renvoie la nouvelle liste des pièces. */
  const agir = async (p: PieceDossier | null, action: () => Promise<PieceDossier[]>, message: string) => {
    setEnvoi(p ? cle(p) : "autre");
    try {
      const nouvelles = await action();
      majCrm(etudiantId, (d) => ({ ...d, pieces: nouvelles }));
      void perimerListes(etudiantId);
      toast(message);
      return true;
    } catch (e) {
      toastErreur(e);
      return false;
    } finally {
      setEnvoi(null);
    }
  };

  const recueAuGuichet = (p: PieceDossier) =>
    agir(
      p,
      // « Autre » déjà enregistrée : on la valide (un nouvel envoi créerait un doublon).
      () => (p.type === "autre" && p.id !== null ? patch<PieceDossier[]>(`/api/pilotage/pieces/${p.id}`, { statut: "recue" }) : post<PieceDossier[]>(base, { type: p.type })),
      "Pièce reçue",
    );

  const scanner = (p: PieceDossier) => async (e: ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    await agir(
      p,
      async () => {
        const fichierId = await televerserPiece(fichier);
        if (p.type === "autre" && p.id !== null) {
          // « Autre » : la nouvelle version remplace l'ancienne.
          await post<PieceDossier[]>(base, { type: "autre", libelle: p.libelle, fichierId });
          return suppr<PieceDossier[]>(`/api/pilotage/pieces/${p.id}`);
        }
        return post<PieceDossier[]>(base, { type: p.type, fichierId });
      },
      "Pièce enregistrée avec son fichier",
    );
  };

  const valider = (p: PieceDossier) => agir(p, () => patch<PieceDossier[]>(`/api/pilotage/pieces/${p.id}`, { statut: "recue" }), "Pièce validée");

  const retirer = (p: PieceDossier) => {
    if (!window.confirm(`Retirer « ${p.libelle} » du dossier ?${p.requise ? " Elle redeviendra manquante." : ""}`)) return;
    void agir(p, () => suppr<PieceDossier[]>(`/api/pilotage/pieces/${p.id}`), "Pièce retirée");
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <TitreSection
          titre="Pièces du dossier"
          action={
            <Bouton variante="contour" taille="sm" icone={<FilePlus2 className="h-4 w-4" />} onClick={() => setAutre(true)} className="min-h-[44px]">
              <span className="hidden sm:inline">Ajouter une autre pièce</span>
              <span className="sm:hidden">Autre pièce</span>
            </Bouton>
          }
        />
        <Carte className="mb-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[15px] font-bold">
              {recues} sur {requises.length} pièces requises reçues
            </span>
            <div className="flex flex-wrap gap-1.5">
              {recues === requises.length && requises.length > 0 && <Badge ton="succes">Dossier complet</Badge>}
              {aVerifier > 0 && <Badge ton="alerte">{aVerifier} à vérifier</Badge>}
            </div>
          </div>
          <BarreProgression valeur={requises.length ? (recues / requises.length) * 100 : 0} ton={recues === requises.length ? "succes" : "orange"} />
        </Carte>
        <Carte className="p-0">
          <ul className="flex flex-col divide-y divide-ligne-douce">
            {liste.map((p) => (
              <LignePiece
                key={cle(p)}
                p={p}
                occupe={envoi === cle(p)}
                bloque={envoi !== null}
                onRecue={() => void recueAuGuichet(p)}
                onScanner={scanner(p)}
                onValider={() => void valider(p)}
                onRefuser={() => setRefus(p)}
                onRetirer={() => retirer(p)}
              />
            ))}
          </ul>
        </Carte>
        <p className="mt-2 text-[13px] text-texte-gris">Les pièces déposées par l'étudiant depuis « Mon dossier » arrivent ici « À vérifier ».</p>
      </section>

      <FenetreRefus
        piece={refus}
        onFermer={() => setRefus(null)}
        onRefuser={async (note) => {
          if (!refus) return;
          const ok = await agir(refus, () => patch<PieceDossier[]>(`/api/pilotage/pieces/${refus.id}`, { statut: "refusee", note }), "Pièce refusée : l'étudiant verra le motif");
          if (ok) setRefus(null);
        }}
        envoi={refus !== null && envoi === cle(refus)}
      />
      <FenetreAutrePiece
        ouverte={autre}
        onFermer={() => setAutre(false)}
        envoi={envoi === "autre"}
        onAjouter={async ({ libelle, note, fichier }) => {
          const ok = await agir(
            null,
            async () => {
              const fichierId = fichier ? await televerserPiece(fichier) : null;
              return post<PieceDossier[]>(base, { type: "autre", libelle, note: note || null, ...(fichierId ? { fichierId } : {}) });
            },
            "Pièce ajoutée au dossier",
          );
          if (ok) setAutre(false);
        }}
      />
    </div>
  );
}

function LignePiece({
  p,
  occupe,
  bloque,
  onRecue,
  onScanner,
  onValider,
  onRefuser,
  onRetirer,
}: {
  p: PieceDossier;
  occupe: boolean;
  bloque: boolean;
  onRecue: () => void;
  onScanner: (e: ChangeEvent<HTMLInputElement>) => void;
  onValider: () => void;
  onRefuser: () => void;
  onRetirer: () => void;
}) {
  const etat = ETATS_PIECE[p.statut];
  const aRecevoir = p.statut === "manquante" || p.statut === "refusee" || p.statut === "a_verifier";
  return (
    <li className={cn("flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center", occupe && "opacity-60")} aria-busy={occupe}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{p.libelle}</span>
          <Badge ton={etat.ton}>{etat.texte}</Badge>
          {!p.requise && <span className="font-mono text-[11px] text-texte-gris">facultative</span>}
        </div>
        <div className="mt-0.5 text-[13px] text-texte-gris">
          {p.statut === "manquante"
            ? "Pas encore remise."
            : [p.statut === "a_verifier" ? `Déposée par ${p.ajouteePar ?? "l'étudiant"}` : p.ajouteePar ? `Ajoutée par ${p.ajouteePar}` : null, p.creeLe ? `le ${dateCourte(p.creeLe)}` : null]
                .filter(Boolean)
                .join(" ")}
        </div>
        {p.note && (
          <p className={cn("mt-1 text-sm", p.statut === "refusee" ? "font-semibold text-danger" : "text-texte-doux")}>
            {p.statut === "refusee" ? `Motif du refus : ${p.note}` : `« ${p.note} »`}
          </p>
        )}
        {p.fichier && (
          <a
            href={p.fichier.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-[44px] max-w-full items-center gap-1.5 text-sm font-bold text-orange-fonce no-underline hover:text-encre"
          >
            <ExternalLink className="h-4 w-4 shrink-0" /> Voir <span className="truncate font-normal text-texte-gris">({p.fichier.nom})</span>
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {p.statut === "a_verifier" && (
          <>
            <Bouton taille="sm" icone={<Check className="h-4 w-4" />} onClick={onValider} disabled={bloque} className="min-h-[44px]">
              Valider
            </Bouton>
            <Bouton taille="sm" variante="contour" icone={<X className="h-4 w-4" />} onClick={onRefuser} disabled={bloque} className="min-h-[44px] border-danger text-danger hover:bg-danger-clair">
              Refuser
            </Bouton>
          </>
        )}
        {aRecevoir && (
          <>
            <Bouton taille="sm" variante={p.statut === "a_verifier" ? "fantome" : "encre"} icone={<Check className="h-4 w-4" />} onClick={onRecue} disabled={bloque} className="min-h-[44px]">
              Reçue au guichet
            </Bouton>
            <label
              className={cn(
                "inline-flex min-h-[44px] cursor-pointer select-none items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-encre bg-white px-3 py-2 text-[13px] font-bold text-encre transition-colors focus-within:ring-2 focus-within:ring-orange/40 hover:bg-orange-pale",
                bloque && "pointer-events-none opacity-50",
              )}
            >
              <Camera className="h-4 w-4" /> Scanner ou photographier
              <input type="file" accept={TYPES_FICHIER} className="sr-only" onChange={onScanner} disabled={bloque} />
            </label>
          </>
        )}
        {p.id !== null && (
          <Menu
            declencheur={
              <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-texte-pale hover:bg-creme hover:text-encre" aria-label={`Plus d'actions : ${p.libelle}`} disabled={bloque}>
                <MoreVertical className="h-5 w-5" />
              </button>
            }
          >
            <ElementMenu danger icone={<Trash2 className="h-4 w-4" />} onSelect={onRetirer}>
              Retirer du dossier
            </ElementMenu>
          </Menu>
        )}
      </div>
    </li>
  );
}

function FenetreRefus({ piece, onFermer, onRefuser, envoi }: { piece: PieceDossier | null; onFermer: () => void; onRefuser: (note: string) => void; envoi: boolean }) {
  const [texte, setTexte] = useState("");
  useEffect(() => setTexte(""), [piece]);
  if (!piece) return null;
  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      titre="Refuser la pièce"
      description={`${piece.libelle}. L'étudiant verra ce motif dans « Mon dossier » et pourra en déposer une nouvelle.`}
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer} disabled={envoi}>
            Annuler
          </Bouton>
          <Bouton variante="danger" onClick={() => onRefuser(texte.trim())} chargement={envoi} disabled={texte.trim().length < 2}>
            Refuser la pièce
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {MOTIFS_REFUS.map((m) => (
            <button key={m} type="button" onClick={() => setTexte(m)} className="min-h-[44px] rounded-full border border-ligne px-3 py-1.5 text-left text-sm font-semibold text-texte-doux hover:border-orange hover:text-encre">
              {m}
            </button>
          ))}
        </div>
        <ZoneTexte libelle="Motif du refus" value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} maxLength={500} placeholder="Ex. : la photo est floue, le nom n'est pas lisible." />
      </div>
    </Fenetre>
  );
}

function FenetreAutrePiece({
  ouverte,
  onFermer,
  onAjouter,
  envoi,
}: {
  ouverte: boolean;
  onFermer: () => void;
  onAjouter: (d: { libelle: string; note: string; fichier: File | null }) => void;
  envoi: boolean;
}) {
  const [libelle, setLibelle] = useState("");
  const [note, setNote] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  useEffect(() => {
    if (!ouverte) return;
    setLibelle("");
    setNote("");
    setFichier(null);
  }, [ouverte]);
  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Ajouter une autre pièce"
      description="Une pièce hors de la liste requise : attestation, certificat, document de la famille…"
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer} disabled={envoi}>
            Annuler
          </Bouton>
          <Bouton onClick={() => onAjouter({ libelle: libelle.trim(), note: note.trim(), fichier })} chargement={envoi} disabled={!libelle.trim()}>
            Ajouter au dossier
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Champ libelle="Nom de la pièce *" value={libelle} onChange={(e) => setLibelle(e.target.value)} maxLength={120} placeholder="Ex. : attestation de bourse" />
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS_AUTRE.map((s) => (
              <button key={s} type="button" onClick={() => setLibelle(s)} className="min-h-[44px] rounded-full border border-ligne px-3 py-1.5 text-sm font-semibold text-texte-doux hover:border-orange hover:text-encre">
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-encre">Fichier (facultatif)</span>
          <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ligne-forte px-4 py-3 text-[15px] focus-within:border-orange hover:border-orange">
            {fichier ? <Paperclip className="h-5 w-5 shrink-0 text-orange-fonce" /> : <Camera className="h-5 w-5 shrink-0 text-texte-gris" />}
            <span className={cn("min-w-0 flex-1 truncate", fichier ? "font-semibold text-encre" : "text-texte-gris")}>
              {fichier ? `${fichier.name} (${taille(fichier.size)})` : "Photographier ou choisir un fichier (image ou PDF)"}
            </span>
            <input
              type="file"
              accept={TYPES_FICHIER}
              className="sr-only"
              onChange={(e) => {
                setFichier(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-[13px] text-texte-gris">Sans fichier, la pièce est notée « reçue au guichet ».</p>
        </div>
        <Champ libelle="Précision (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Ex. : original vu, copie gardée" />
      </div>
    </Fenetre>
  );
}
