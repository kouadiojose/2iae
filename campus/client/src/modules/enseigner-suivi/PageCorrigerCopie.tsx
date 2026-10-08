// /corriger/:id — une copie seule à l'écran, sur téléphone : la copie en grand
// (photos zoomables, fichiers, texte), une note d'un toucher, un mot ou un
// message vocal, puis UN bouton « Envoyer 14/20 à Aya » : la note part chez
// l'étudiant aussitôt et la copie suivante s'ouvre. « Plus tard » la passe.
// La correction détaillée par critères reste sur la page des copies du devoir.
//
// Écran nu (pas de barre d'onglets), comme l'interrogation : on se concentre.
// Réutilise les routes du module évaluations (copie, correction, proposition de
// l'IA) et POST /api/enseigner/rendus/:id/envoyer pour publier cette copie seule.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Sparkles, X } from "lucide-react";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Avatar, Badge, Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { ZoneTexte } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { ErreurApi, patch, post } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { Visionneuse, EnregistreurVocal } from "@/modules/evaluations/composants/Correction";
import type { CopieDetail } from "@shared/schema";
import { notesRapides, type CopieEnAttente, type CopiesEnAttenteDto } from "@shared/engagement/enseigner";
import { t, type CleEnseigner } from "@shared/textes/enseigner";
import { cleFile, copiesPassees, depuis, nombreFr } from "./outils";

const PHRASES: CleEnseigner[] = ["corriger.phrase.1", "corriger.phrase.2", "corriger.phrase.3", "corriger.phrase.4", "corriger.phrase.5", "corriger.phrase.6"];

/** Cadre nu : en-tête collant en haut, barre d'action fixée en bas (au-dessus de la zone du geste système). */
function Cadre({ entete, pied, children }: { entete: ReactNode; pied?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-20 border-b border-ligne-douce bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-3 py-2">{entete}</div>
      </header>
      <main className={cn("mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-5", pied ? "pb-36" : "pb-16")}>{children}</main>
      {pied && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ligne-douce bg-white/95 px-4 pt-3 backdrop-blur" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-2xl items-center gap-2">{pied}</div>
        </div>
      )}
    </div>
  );
}

export default function PageCorrigerCopie({ id }: { id: string }) {
  const tx = useTextes(t);
  const renduId = Number(id);
  const devoir = Number(new URLSearchParams(useSearch()).get("devoir")) || null;
  const suffixe = devoir ? `?devoir=${devoir}` : "";
  const [, naviguer] = useLocation();
  const file = useQuery<CopiesEnAttenteDto>({ queryKey: [cleFile(devoir)] });
  const copie = useQuery<CopieDetail>({ queryKey: ["/api/rendus", renduId], enabled: Number.isInteger(renduId) });

  // Ordre de la file : la plus ancienne d'abord, celles passées à la fin. Sans ?devoir=, la file ne mêle pas
  // ses devoirs et les exercices du campus (facultatifs, décision D2) : elle reste du côté de la copie ouverte.
  const automatique = file.data?.copies.find((x) => x.renduId === renduId)?.automatique ?? false;
  const ordre = useMemo(() => {
    const c = (file.data?.copies ?? []).filter((x) => devoir !== null || x.automatique === automatique);
    return [...c.filter((x) => !copiesPassees.has(x.renduId)), ...c.filter((x) => copiesPassees.has(x.renduId))];
  }, [file.data, devoir, automatique]);
  const position = ordre.findIndex((c) => c.renduId === renduId);
  const element = position >= 0 ? ordre[position] : null;

  /** Ouvre la copie suivante de la file (sans celle-ci), ou revient à la liste. */
  function suivante(passer: boolean) {
    if (passer) copiesPassees.add(renduId);
    const reste = ordre.filter((c) => c.renduId !== renduId);
    const prochaine = reste.find((c) => !copiesPassees.has(c.renduId)) ?? (passer ? null : reste[0]);
    naviguer(prochaine && prochaine.renduId !== renduId ? `/corriger/${prochaine.renduId}${suffixe}` : `/corriger${suffixe}`, { replace: true });
  }

  const quitter = (
    <Link href={`/corriger${suffixe}`} className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-[15px] font-semibold text-texte-pale no-underline hover:text-encre" aria-label={tx("corriger.quitter")}>
      <X className="h-5 w-5" aria-hidden />
      <span className="hidden sm:inline">{tx("corriger.quitter")}</span>
    </Link>
  );

  if (file.isLoading || copie.isLoading) {
    return (
      <Cadre entete={quitter}>
        <Chargement lignes={5} />
      </Cadre>
    );
  }
  if (copie.error || !copie.data) {
    return (
      <Cadre entete={quitter}>
        <Erreur message={(copie.error as Error)?.message ?? "Copie introuvable."} reessayer={() => void copie.refetch()} />
      </Cadre>
    );
  }
  const c = copie.data;

  // Copie déjà notée (ou hors de la file) : on propose de continuer.
  if (!element) {
    return (
      <Cadre entete={quitter}>
        <EtatVide
          titre={tx("corriger.dejaCorrigee")}
          texte={`${c.etudiant.prenom} ${c.etudiant.nom}`}
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              {ordre[0] && (
                <LienBouton href={`/corriger/${ordre[0].renduId}${suffixe}`} className="min-h-[48px]">
                  {tx("corriger.reprendre")}
                </LienBouton>
              )}
              <LienBouton href={`/enseigner/devoirs/${c.devoirId}/copies?etudiant=${c.etudiant.id}`} variante="contour" className="min-h-[48px]">
                {tx("corriger.vers.copies")}
              </LienBouton>
            </div>
          }
        />
      </Cadre>
    );
  }

  return (
    <Notation
      key={`${c.id}:${c.renduLe}`}
      copie={c}
      element={element}
      position={position}
      total={ordre.length}
      iaDisponible={file.data?.iaDisponible ?? false}
      quitter={quitter}
      onSuivante={suivante}
    />
  );
}

function Notation({
  copie,
  element,
  position,
  total,
  iaDisponible,
  quitter,
  onSuivante,
}: {
  copie: CopieDetail;
  element: CopieEnAttente;
  position: number;
  total: number;
  iaDisponible: boolean;
  quitter: ReactNode;
  onSuivante: (passer: boolean) => void;
}) {
  const tx = useTextes(t);
  const bareme = element.bareme;
  const proposition = copie.propositionIa;
  const [note, setNote] = useState<number | null>(copie.note);
  const [autre, setAutre] = useState(false);
  const [saisie, setSaisie] = useState(copie.note === null ? "" : String(copie.note));
  const [commentaire, setCommentaire] = useState(copie.commentaire ?? "");
  const [depuisIa, setDepuisIa] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [demandeIa, setDemandeIa] = useState(false);
  const rapides = notesRapides(bareme);

  // Une nouvelle copie s'affiche en haut de l'écran.
  useEffect(() => window.scrollTo(0, 0), [copie.id]);

  const valeur = autre ? (saisie.trim() === "" ? null : Number(saisie.replace(",", "."))) : note;
  const valide = valeur !== null && !Number.isNaN(valeur) && valeur >= 0 && valeur <= bareme;

  function choisir(v: number) {
    setNote(v);
    setAutre(false);
    setDepuisIa(false);
  }

  function reprendreIa() {
    if (!proposition) return;
    setNote(proposition.note);
    setSaisie(String(proposition.note));
    setAutre(!rapides.includes(proposition.note));
    if (proposition.commentaire) setCommentaire(proposition.commentaire);
    setDepuisIa(true);
  }

  function ajouterPhrase(cle: CleEnseigner) {
    const phrase = tx(cle);
    setCommentaire((avant) => (avant.includes(phrase) ? avant : `${avant.trim()}${avant.trim() ? " " : ""}${phrase}`));
  }

  async function demanderIa() {
    setDemandeIa(true);
    try {
      const maj = await post<CopieDetail>(`/api/rendus/${copie.id}/proposition-ia`);
      queryClient.setQueryData(["/api/rendus", copie.id], maj);
      toast(tx("corriger.ia.prete"), "info");
    } catch (e) {
      toastErreur(e);
    } finally {
      setDemandeIa(false);
    }
  }

  async function garderVocal(fichierId: number | null) {
    try {
      const maj = await patch<CopieDetail>(`/api/rendus/${copie.id}/correction`, { commentaireAudioId: fichierId, renduLe: copie.renduLe });
      queryClient.setQueryData(["/api/rendus", copie.id], maj);
    } catch (e) {
      toastErreur(e);
      if (e instanceof ErreurApi && e.statut === 409) void rafraichir("/api/rendus", "/api/enseigner");
    }
  }

  async function envoyer() {
    if (!valide || valeur === null) {
      toastErreur(new Error(tx("corriger.horsLimites", { v: { bareme: nombreFr(bareme) } })));
      return;
    }
    setEnvoi(true);
    try {
      // 1. La note, sur la copie affichée (une copie remplacée entre-temps est refusée : 409).
      const detail = depuisIa && proposition && valeur === proposition.note ? proposition.detail.map(({ critere, points, obtenu }) => ({ critere, points, obtenu })) : undefined;
      await patch<CopieDetail>(`/api/rendus/${copie.id}/correction`, {
        note: valeur,
        commentaire: commentaire.trim() || null,
        renduLe: copie.renduLe,
        ...(detail ? { noteDetail: detail } : {}),
      });
      // 2. Elle part tout de suite chez l'étudiant.
      await post(`/api/enseigner/rendus/${copie.id}/envoyer`);
      toast(tx("corriger.envoyee", { v: { prenom: copie.etudiant.prenom } }));
      onSuivante(false);
      void rafraichir("/api/enseigner", "/api/devoirs", "/api/accueil/formateur", "/api/rendus");
    } catch (e) {
      toastErreur(e);
      if (e instanceof ErreurApi && e.statut === 409) void rafraichir("/api/rendus", "/api/enseigner");
    } finally {
      setEnvoi(false);
    }
  }

  const entete = (
    <>
      {quitter}
      <span className="flex-1 text-center font-mono text-xs text-texte-gris">{tx("corriger.position", { v: { i: position + 1, n: total } })}</span>
      <span className="w-11" aria-hidden />
    </>
  );

  const pied = (
    <>
      <Bouton variante="fantome" onClick={() => onSuivante(true)} className="min-h-[52px] shrink-0 px-3">
        {tx("corriger.passer")}
      </Bouton>
      <Bouton taille="lg" onClick={() => void envoyer()} disabled={!valide} chargement={envoi} className="min-h-[52px] flex-1 px-3 leading-tight">
        {valide && valeur !== null ? tx("corriger.envoyer", { v: { note: nombreFr(valeur), bareme: nombreFr(bareme), prenom: copie.etudiant.prenom } }) : tx("corriger.choisir")}
      </Bouton>
    </>
  );

  return (
    <Cadre entete={entete} pied={pied}>
      <div className="flex items-center gap-3">
        <Avatar prenom={copie.etudiant.prenom} nom={copie.etudiant.nom} taille={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-extrabold leading-tight">
            {copie.etudiant.prenom} {copie.etudiant.nom}
          </div>
          <div className="truncate font-mono text-xs text-texte-gris">
            {element.coursCode} · {element.devoirTitre}
          </div>
        </div>
      </div>
      <div className="-mt-2 flex flex-wrap gap-1.5">
        <Badge ton={element.enRetard ? "danger" : "gris"}>
          {tx("corriger.rendue", { v: { quand: depuis(tx, element.renduLe) } })}
          {element.enRetard ? ` · ${tx("corriger.enRetard")}` : ""}
        </Badge>
        {copie.etudiant.site && <Badge ton="gris">{copie.etudiant.site}</Badge>}
      </div>

      <Visionneuse fichiers={copie.fichiers} texte={copie.texte} />

      <section aria-labelledby="titre-note" className="flex flex-col gap-3">
        <h2 id="titre-note" className="flex items-baseline justify-between gap-2 text-lg font-extrabold">
          {tx("corriger.note", { v: { bareme: nombreFr(bareme) } })}
          {valide && valeur !== null && (
            <span className="font-sans text-[28px] font-black tabular-nums">
              {nombreFr(valeur)}
              <span className="text-base text-texte-gris">/{nombreFr(bareme)}</span>
            </span>
          )}
        </h2>

        {proposition && (
          <div className="flex flex-col gap-2 rounded-2xl border border-orange/50 bg-orange-pale/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <Badge ton="orange">
                <Sparkles className="h-3 w-3" aria-hidden /> {tx("corriger.ia.propose", { v: { note: nombreFr(proposition.note), bareme: nombreFr(bareme) } })}
              </Badge>
              <Bouton variante="encre" taille="sm" onClick={reprendreIa} className="min-h-[40px]">
                {tx("corriger.ia.reprendre")}
              </Bouton>
            </div>
            {proposition.alerte && (
              <p className="flex items-start gap-2 rounded-xl bg-danger-clair px-3 py-2 text-sm text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {proposition.alerte}
              </p>
            )}
            {proposition.commentaire && <p className="text-sm text-texte-doux">{proposition.commentaire}</p>}
            <p className="text-xs text-texte-gris">{tx("corriger.ia.relire")}</p>
          </div>
        )}

        <div className="grid grid-cols-4 gap-2" role="group" aria-label={tx("corriger.note", { v: { bareme: nombreFr(bareme) } })}>
          {rapides.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => choisir(v)}
              aria-pressed={!autre && note === v}
              className={cn(
                "min-h-[52px] rounded-xl text-lg font-black tabular-nums transition-colors",
                !autre && note === v ? "bg-encre text-white" : "bg-creme text-encre hover:bg-orange-clair",
              )}
            >
              {nombreFr(v)}
            </button>
          ))}
        </div>
        {autre ? (
          <label className="flex items-center gap-3">
            <span className="flex-1 text-[15px] font-semibold">{tx("corriger.autreNote")}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={bareme}
              step={0.25}
              autoFocus
              value={saisie}
              onChange={(e) => {
                setSaisie(e.target.value);
                setDepuisIa(false);
              }}
              className="h-12 w-24 rounded-xl border border-ligne px-2 text-center text-lg font-bold tabular-nums outline-none focus:border-orange"
            />
            <span className="font-mono text-sm text-texte-gris">/{nombreFr(bareme)}</span>
          </label>
        ) : (
          <button type="button" onClick={() => setAutre(true)} className="min-h-[44px] self-start rounded-xl px-1 text-[15px] font-bold text-orange-fonce">
            {tx("corriger.autre")}…
          </button>
        )}
        {!proposition && iaDisponible && (copie.fichiers.length > 0 || copie.texte.trim()) && (
          <Bouton variante="doux" icone={<Sparkles className="h-4 w-4 text-orange-fonce" />} onClick={() => void demanderIa()} chargement={demandeIa} className="min-h-[48px] self-start">
            {tx("corriger.ia.demander")}
          </Bouton>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <ZoneTexte libelle={tx("corriger.commentaire")} rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} aide={tx("corriger.commentaire.aide")} />
        {/* Une seule ligne qui défile au doigt : les phrases ne repoussent pas la suite de l'écran. */}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {PHRASES.map((cle) => (
            <button key={cle} type="button" onClick={() => ajouterPhrase(cle)} className="min-h-[44px] shrink-0 whitespace-nowrap rounded-full bg-creme px-3.5 text-[13px] font-semibold text-texte-doux hover:bg-orange-clair">
              {tx(cle)}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">{tx("corriger.vocal")}</span>
        <EnregistreurVocal audio={copie.commentaireAudio} onChange={garderVocal} />
      </section>

      {element.avecGrille && (
        <Link href={`/enseigner/devoirs/${element.devoirId}/copies?etudiant=${copie.etudiant.id}`} className="inline-flex min-h-[44px] items-center self-start text-sm font-semibold text-texte-pale">
          {tx("corriger.detaillee")}
        </Link>
      )}
    </Cadre>
  );
}
