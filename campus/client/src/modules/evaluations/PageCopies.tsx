// /enseigner/devoirs/:id/copies : correction guidée. La liste des copies
// (rendues, en retard, non rendues), la copie en grand (photos zoomables,
// texte, fichiers), la notation par critère, le commentaire écrit et vocal,
// la correction proposée par l'IA (brouillon à valider), les touches J/K pour
// passer d'une copie à l'autre, et « Publier les notes ».
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Send, Sparkles, AlertTriangle, CheckCheck, Upload, BookOpenCheck, PenLine, Keyboard, FileImage } from "lucide-react";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { ZoneTexte, CaseACocher } from "@/components/ui/champs";
import { Avatar, Badge, Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { toast, toastErreur } from "@/components/ui/toast";
import { useMoiConnecte, estEquipe } from "@/lib/auth";
import { useCanal } from "@/lib/flux";
import { patch, post, televerser, ErreurApi } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { jourLong, heure, heureDouble } from "@/lib/dates";
import { cn, pluriel, taille } from "@/lib/utils";
import type { ListeCopies, CopieResume, CopieDetail, CritereGrille, RecuDepot } from "@shared/schema";
import { Visionneuse, EnregistreurVocal } from "./composants/Correction";
import { CorrectionQuiz } from "./composants/CorrectionQuiz";
import { envoyeeEnDiffere, nombre } from "./outils";

type Filtre = "toutes" | "a_corriger" | "rendues" | "retard" | "non_rendues";

const FILTRES: Record<Filtre, (c: CopieResume) => boolean> = {
  toutes: () => true,
  a_corriger: (c) => c.etat !== "non_rendu" && c.note === null,
  rendues: (c) => c.etat !== "non_rendu",
  retard: (c) => c.etat === "en_retard",
  non_rendues: (c) => c.etat === "non_rendu",
};

const quand = (iso: string) => `${jourLong(iso)} à ${heure(iso)}`;

export default function PageCopies({ id }: { id: string }) {
  const moi = useMoiConnecte();
  const devoirId = Number(id);
  const recherche = new URLSearchParams(useSearch());
  const [chemin, naviguer] = useLocation();
  const { data, isLoading, error, refetch } = useQuery<ListeCopies>({ queryKey: ["/api/devoirs", devoirId, "copies"], enabled: Number.isInteger(devoirId) });
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [publier, setPublier] = useState(false);
  const [publication, setPublication] = useState(false);
  const selection = Number(recherche.get("etudiant")) || null;

  useCanal(`u:${moi.id}`, (e) => {
    if (e.type === "copie-recue" && e.data?.devoirId === devoirId) void rafraichir(`/api/devoirs`);
  });

  const copies = data?.copies ?? [];
  const visibles = useMemo(() => copies.filter(FILTRES[filtre]), [copies, filtre]);
  const choisir = useCallback(
    (etudiantId: number | null) => naviguer(etudiantId ? `${chemin}?etudiant=${etudiantId}` : chemin, { replace: true }),
    [chemin, naviguer],
  );
  const courante = copies.find((c) => c.etudiant.id === selection) ?? null;
  // Copie suivante / précédente dans la liste filtrée (touches J et K).
  const position = courante ? visibles.findIndex((c) => c.etudiant.id === courante.etudiant.id) : -1;
  const aller = useCallback(
    (sens: 1 | -1) => {
      if (!visibles.length) return;
      const i = position === -1 ? 0 : Math.min(visibles.length - 1, Math.max(0, position + sens));
      choisir(visibles[i].etudiant.id);
    },
    [visibles, position, choisir],
  );

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      if (cible && (["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName) || cible.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "J") aller(1);
      if (e.key === "k" || e.key === "K") aller(-1);
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [aller]);

  if (isLoading) {
    return (
      <Page large>
        <Chargement lignes={4} />
      </Page>
    );
  }
  if (error || !data) {
    return (
      <Page className="max-w-3xl">
        <Erreur message={(error as Error)?.message ?? "Devoir introuvable."} reessayer={() => void refetch()} />
      </Page>
    );
  }

  const { devoir, compteurs } = data;
  const quiz = devoir.type === "quiz";
  const nonRendues = copies.filter((c) => c.etat === "non_rendu").length;

  async function publierNotes() {
    setPublication(true);
    try {
      const r = await post<{ publiees: number; sansNote: number }>(`/api/devoirs/${devoirId}/publier-notes`);
      await rafraichir("/api/devoirs", "/api/rendus");
      toast(`${pluriel(r.publiees, "note publiée", "notes publiées")}. Les étudiants sont prévenus.${r.sansNote ? ` ${r.sansNote} copie(s) sans note restent à corriger.` : ""}`);
      setPublier(false);
    } catch (e) {
      toastErreur(e);
    } finally {
      setPublication(false);
    }
  }

  return (
    <Page large>
      <Link href="/corrections" className="-mb-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-semibold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" /> Corrections
      </Link>
      <EnTetePage
        etiquette={`${devoir.coursCode} · ${quiz ? "Interrogation" : "Copies"} · ${new Date(devoir.dateLimite).getTime() < Date.now() ? "close le" : "à rendre avant le"} ${jourLong(devoir.dateLimite)} · ${heureDouble(devoir.dateLimite)}`}
        titre={devoir.titre}
        actions={
          <>
            {!quiz && data.peutCorriger && (
              <Bouton icone={<Send className="h-4 w-4" />} onClick={() => setPublier(true)} disabled={!compteurs.aPublier} className="min-h-[48px]">
                Publier les notes{compteurs.aPublier ? ` (${compteurs.aPublier})` : ""}
              </Bouton>
            )}
            <LienBouton href={`/enseigner/notes/${devoir.coursId}`} variante="contour" icone={<BookOpenCheck className="h-4 w-4" />} className="min-h-[48px]">
              Carnet
            </LienBouton>
            {data.peutCorriger && (
              <LienBouton href={`/enseigner/devoirs/${devoirId}`} variante="fantome" icone={<PenLine className="h-4 w-4" />} className="min-h-[48px]">
                Modifier
              </LienBouton>
            )}
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge ton="gris">{pluriel(compteurs.inscrits, "inscrit")}</Badge>
        <Badge ton="succes">
          {compteurs.rendus} {quiz ? "terminée" : "rendue"}
          {compteurs.rendus > 1 ? "s" : ""}
        </Badge>
        {compteurs.enRetard > 0 && <Badge ton="danger">{compteurs.enRetard} en retard</Badge>}
        <Badge ton="gris">{nonRendues} non {quiz ? "faite" : "rendue"}{nonRendues > 1 ? "s" : ""}</Badge>
        {!quiz && <Badge ton="orange">{compteurs.aCorriger} à corriger</Badge>}
        {!quiz && compteurs.publiees > 0 && <Badge ton="succes">{compteurs.publiees} publiée{compteurs.publiees > 1 ? "s" : ""}</Badge>}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Liste des copies (sur téléphone : masquée quand une copie est ouverte). */}
        <section className={cn("flex flex-col gap-3", courante && "hidden lg:flex")} aria-label="Liste des copies">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrer les copies">
            {(
              [
                { valeur: "toutes", libelle: "Toutes", n: copies.length },
                ...(quiz ? [] : [{ valeur: "a_corriger" as Filtre, libelle: "À corriger", n: copies.filter(FILTRES.a_corriger).length }]),
                { valeur: "rendues", libelle: quiz ? "Terminées" : "Rendues", n: copies.filter(FILTRES.rendues).length },
                ...(quiz ? [] : [{ valeur: "retard" as Filtre, libelle: "En retard", n: copies.filter(FILTRES.retard).length }]),
                { valeur: "non_rendues", libelle: quiz ? "Pas faites" : "Non rendues", n: copies.filter(FILTRES.non_rendues).length },
              ] as { valeur: Filtre; libelle: string; n: number }[]
            ).map((o) => (
              <button
                key={o.valeur}
                type="button"
                role="tab"
                aria-selected={filtre === o.valeur}
                onClick={() => setFiltre(o.valeur)}
                className={cn(
                  "flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-colors",
                  filtre === o.valeur ? "bg-encre text-white" : "bg-creme text-texte-doux hover:bg-orange-clair",
                )}
              >
                {o.libelle}
                <span className={cn("font-mono text-[11px]", filtre === o.valeur ? "text-orange-peche" : "text-texte-gris")}>{o.n}</span>
              </button>
            ))}
          </div>
          {visibles.length ? (
            <ul className="flex flex-col gap-1.5 lg:max-h-[calc(100dvh-280px)] lg:overflow-y-auto lg:pr-1">
              {visibles.map((c) => (
                <li key={c.etudiant.id}>
                  <button
                    type="button"
                    onClick={() => choisir(c.etudiant.id)}
                    aria-current={courante?.etudiant.id === c.etudiant.id}
                    className={cn(
                      "flex min-h-[64px] w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                      courante?.etudiant.id === c.etudiant.id ? "border-orange bg-orange-pale" : "border-ligne bg-white hover:border-orange/60",
                    )}
                  >
                    <Avatar prenom={c.etudiant.prenom} nom={c.etudiant.nom} taille={38} className={c.etat === "non_rendu" ? "bg-creme text-texte-gris" : ""} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-bold">
                        {c.etudiant.prenom} {c.etudiant.nom}
                      </span>
                      <span className="flex items-center gap-1.5 truncate font-mono text-[11px] text-texte-gris">
                        {c.etudiant.site ?? "—"}
                        {c.renduLe && ` · ${heure(c.renduLe)}`}
                        {c.vuLe && !quiz && <CheckCheck className="h-3.5 w-3.5 text-succes" aria-label="Copie ouverte" />}
                        {c.aPropositionIa && <Sparkles className="h-3 w-3 text-orange-fonce" aria-label="Correction proposée par l'IA" />}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {c.note !== null ? (
                        <span className={cn("text-[17px] font-black tabular-nums", c.noteBrouillon ? "text-texte-gris" : "text-encre")}>
                          {nombre(c.note)}
                          <span className="text-[11px] font-normal">/{nombre(devoir.bareme)}</span>
                        </span>
                      ) : null}
                      {c.etat === "non_rendu" ? (
                        <Badge ton="gris" className="px-2 py-0.5 text-[10px]">Non rendu</Badge>
                      ) : c.etat === "en_retard" ? (
                        <Badge ton="danger" className="px-2 py-0.5 text-[10px]">En retard</Badge>
                      ) : c.noteBrouillon ? (
                        <Badge ton="alerte" className="px-2 py-0.5 text-[10px]">À publier</Badge>
                      ) : c.note === null ? (
                        <Badge ton="orange" className="px-2 py-0.5 text-[10px]">À corriger</Badge>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EtatVide titre="Aucune copie ici." texte={filtre === "a_corriger" ? "Toutes les copies rendues ont une note. Pensez à publier les notes." : "Changez de filtre pour voir les autres copies."} />
          )}
          <p className="hidden items-center gap-2 text-xs text-texte-gris lg:flex">
            <Keyboard className="h-4 w-4" /> Touches J et K : copie suivante et précédente.
          </p>
        </section>

        {/* La copie ouverte. */}
        <section className={cn(!courante && "hidden lg:block")} aria-label="Copie">
          {courante ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <Bouton variante="fantome" icone={<ArrowLeft className="h-4 w-4" />} onClick={() => choisir(null)} className="min-h-[48px] lg:hidden">
                  Liste
                </Bouton>
                <span className="font-mono text-xs text-texte-gris">
                  Copie {position + 1}/{visibles.length}
                </span>
                <div className="flex gap-1.5">
                  <Bouton variante="contour" taille="icone" onClick={() => aller(-1)} disabled={position <= 0} aria-label="Copie précédente (K)" className="h-12 w-12">
                    <ChevronLeft className="h-5 w-5" />
                  </Bouton>
                  <Bouton variante="contour" taille="icone" onClick={() => aller(1)} disabled={position >= visibles.length - 1} aria-label="Copie suivante (J)" className="h-12 w-12">
                    <ChevronRight className="h-5 w-5" />
                  </Bouton>
                </div>
              </div>
              {courante.renduId ? (
                <CopieOuverte
                  key={courante.renduId}
                  renduId={courante.renduId}
                  bareme={devoir.bareme}
                  grille={devoir.grille}
                  quiz={quiz}
                  lectureSeule={!data.peutCorriger}
                  iaDisponible={data.iaDisponible}
                  onSuivante={() => aller(1)}
                  derniere={position >= visibles.length - 1}
                />
              ) : (
                <CopieAbsente copie={courante} devoirId={devoirId} devoirTitre={devoir.titre} peutDeposer={estEquipe(moi.role) && !quiz} quiz={quiz} />
              )}
            </div>
          ) : (
            <EtatVide
              titre={visibles.length ? "Choisissez une copie à gauche." : "Aucune copie pour ce filtre."}
              texte="Les copies rendues sont en haut, les plus anciennes d'abord. Passez de l'une à l'autre avec J et K."
              action={
                visibles.length ? (
                  <Bouton onClick={() => aller(1)} className="min-h-[48px]">
                    Ouvrir la première copie
                  </Bouton>
                ) : undefined
              }
            />
          )}
        </section>
      </div>

      <Fenetre
        ouverte={publier}
        onFermer={() => setPublier(false)}
        titre={`Publier ${pluriel(compteurs.aPublier, "note")} ?`}
        description="Les étudiants recevront « Nouvelle note disponible » (sans la note sur l'écran verrouillé) et verront leur note, votre commentaire et votre message vocal. Les copies sans note restent en attente."
        pied={
          <>
            <Bouton variante="contour" onClick={() => setPublier(false)}>
              Pas maintenant
            </Bouton>
            <Bouton onClick={() => void publierNotes()} chargement={publication} icone={<Send className="h-4 w-4" />}>
              Publier
            </Bouton>
          </>
        }
      />
    </Page>
  );
}

/** Une copie rendue : visionneuse + notation. */
function CopieOuverte({
  renduId,
  bareme,
  grille,
  quiz,
  lectureSeule,
  iaDisponible,
  onSuivante,
  derniere,
}: {
  renduId: number;
  bareme: number;
  grille: CritereGrille[];
  quiz: boolean;
  lectureSeule: boolean;
  iaDisponible: boolean;
  onSuivante: () => void;
  derniere: boolean;
}) {
  const { data: c, isLoading, error, refetch } = useQuery<CopieDetail>({ queryKey: ["/api/rendus", renduId] });

  useEffect(() => {
    // L'ouverture a posé la deuxième coche : la liste la montre aussitôt.
    if (c?.vuLe) void rafraichir("/api/devoirs");
  }, [c?.vuLe]);

  if (isLoading) return <Chargement lignes={3} />;
  if (error || !c) return <Erreur message={(error as Error)?.message ?? "Copie introuvable."} reessayer={() => void refetch()} />;

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-4">
        <Carte className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-3">
            <Avatar prenom={c.etudiant.prenom} nom={c.etudiant.nom} taille={44} />
            <div className="min-w-0">
              <div className="text-lg font-extrabold leading-tight">
                {c.etudiant.prenom} {c.etudiant.nom}
              </div>
              <div className="font-mono text-xs text-texte-gris">
                {c.etudiant.matricule ?? "—"} · {c.etudiant.site ?? "sans campus"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {c.renduLe && (
              <Badge ton={c.enRetard ? "danger" : "succes"}>
                {quiz ? "Terminée" : "Rendue"} {quand(c.renduLe)}
                {!quiz && (c.enRetard ? " · en retard" : " · à l'heure")}
              </Badge>
            )}
            {c.recu && <Badge ton="gris">Reçu {c.recu}</Badge>}
            {c.deposePar && <Badge ton="alerte">Copie papier déposée par {c.deposePar.prenom} {c.deposePar.nom}</Badge>}
          </div>
          {envoyeeEnDiffere(c.prepareLe, c.renduLe) && c.prepareLe && <p className="text-sm text-texte-pale">Préparée sur le téléphone à {heure(c.prepareLe)} (hors ligne), arrivée à {c.renduLe ? heure(c.renduLe) : "—"}. L'heure d'arrivée fait foi.</p>}
        </Carte>
        {quiz ? (
          c.reponsesQuiz ? (
            <CorrectionQuiz questions={c.reponsesQuiz} vous />
          ) : (
            <p className="text-texte-pale">Aucune tentative terminée.</p>
          )
        ) : (
          <Visionneuse fichiers={c.fichiers} texte={c.texte} />
        )}
      </div>
      {quiz ? (
        <Carte className="flex flex-col gap-2 xl:sticky xl:top-24">
          <span className="font-mono text-xs uppercase tracking-wider text-texte-gris">Note calculée automatiquement</span>
          <span className="text-[44px] font-black leading-none tracking-tres-serre tabular-nums">
            {nombre(c.note)}
            <span className="text-xl text-texte-gris">/{nombre(bareme)}</span>
          </span>
          <span className="text-sm text-texte-pale">Meilleure tentative retenue.</span>
        </Carte>
      ) : lectureSeule ? (
        <Carte className="flex flex-col gap-2 xl:sticky xl:top-24">
          <span className="font-mono text-xs uppercase tracking-wider text-texte-gris">
            {c.statut === "corrige" ? "Note publiée" : c.note !== null ? "Note posée, pas encore publiée" : "Pas encore notée"}
          </span>
          {c.note !== null && (
            <span className="text-[44px] font-black leading-none tracking-tres-serre tabular-nums">
              {nombre(c.note)}
              <span className="text-xl text-texte-gris">/{nombre(bareme)}</span>
            </span>
          )}
          {c.commentaire && <p className="whitespace-pre-line text-[15px] text-texte-doux">{c.commentaire}</p>}
          <span className="text-sm text-texte-pale">Ce cours est suivi par plusieurs campus : seul son formateur le corrige et publie les notes.</span>
        </Carte>
      ) : (
        // Une copie remplacée par l'étudiant (autre heure d'arrivée) repart d'une notation vierge.
        <PanneauNotation key={`${c.id}:${c.renduLe}`} copie={c} bareme={bareme} grille={grille} iaDisponible={iaDisponible} onSuivante={onSuivante} derniere={derniere} />
      )}
    </div>
  );
}

/** Notation par critère, commentaire écrit et vocal, proposition de l'IA. */
function PanneauNotation({
  copie,
  bareme,
  grille,
  iaDisponible,
  onSuivante,
  derniere,
}: {
  copie: CopieDetail;
  bareme: number;
  grille: CritereGrille[];
  iaDisponible: boolean;
  onSuivante: () => void;
  derniere: boolean;
}) {
  const criteres = grille.length ? grille : null;
  const initialDetail = () =>
    criteres ? criteres.map((g) => copie.noteDetail?.find((l) => l.critere === g.critere)?.obtenu ?? null).map((v) => (v === null ? "" : String(v))) : [];
  const [detail, setDetail] = useState<string[]>(initialDetail);
  const [globale, setGlobale] = useState(copie.note === null ? "" : String(copie.note));
  const [commentaire, setCommentaire] = useState(copie.commentaire ?? "");
  const [depuisIa, setDepuisIa] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [demandeIa, setDemandeIa] = useState(false);
  const proposition = copie.propositionIa;

  const valeurs = detail.map((v) => (v === "" ? null : Number(v.replace(",", "."))));
  const total = criteres ? (valeurs.every((v) => v === null) ? null : valeurs.reduce<number>((s, v) => s + (v ?? 0), 0)) : globale === "" ? null : Number(globale.replace(",", "."));
  const publiee = copie.statut === "corrige";

  function reprendreIa() {
    if (!proposition) return;
    if (criteres) setDetail(criteres.map((g) => String(proposition.detail.find((l) => l.critere === g.critere)?.obtenu ?? "")));
    else setGlobale(String(proposition.note));
    setCommentaire(proposition.commentaire);
    setDepuisIa(true);
  }

  async function demanderIa() {
    setDemandeIa(true);
    try {
      const maj = await post<CopieDetail>(`/api/rendus/${copie.id}/proposition-ia`);
      queryClient.setQueryData(["/api/rendus", copie.id], maj);
      void rafraichir("/api/devoirs");
      toast("Correction proposée par l'IA. Relisez-la avant de l'utiliser.", "info");
    } catch (e) {
      toastErreur(e);
      copieRemplacee(e);
    } finally {
      setDemandeIa(false);
    }
  }

  /** 409 : l'étudiant a remplacé sa copie pendant la correction ; on affiche la nouvelle. */
  function copieRemplacee(e: unknown) {
    if (e instanceof ErreurApi && e.statut === 409) void rafraichir("/api/rendus", "/api/devoirs");
  }

  async function enregistrer(suivante: boolean, corpsEnPlus?: Record<string, unknown>) {
    setEnvoi(true);
    try {
      let corps: Record<string, unknown> = { commentaire, ...corpsEnPlus };
      if (!corpsEnPlus) {
        if (criteres) {
          if (valeurs.some((v, i) => v !== null && (Number.isNaN(v) || v < 0 || v > criteres[i].points))) throw new Error("Une note de critère est hors limites.");
          corps = { ...corps, noteDetail: criteres.map((g, i) => ({ critere: g.critere, points: g.points, obtenu: valeurs[i] ?? 0 })), note: total };
          if (valeurs.every((v) => v === null)) corps = { commentaire, note: null, noteDetail: null };
        } else {
          if (total !== null && (Number.isNaN(total) || total < 0 || total > bareme)) throw new Error(`La note doit être entre 0 et ${nombre(bareme)}.`);
          corps = { ...corps, note: total };
        }
      }
      // renduLe : la copie corrigée est bien celle affichée (pas une copie remplacée entre-temps).
      const maj = await patch<CopieDetail>(`/api/rendus/${copie.id}/correction`, { ...corps, renduLe: copie.renduLe });
      queryClient.setQueryData(["/api/rendus", copie.id], maj);
      await rafraichir("/api/devoirs");
      if (!corpsEnPlus) toast(publiee ? "Note mise à jour : l'étudiant est prévenu." : "Correction enregistrée (pas encore publiée).");
      if (suivante && !derniere) onSuivante();
    } catch (e) {
      toastErreur(e);
      copieRemplacee(e);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Carte className="flex flex-col gap-5 xl:sticky xl:top-24">
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-texte-gris">Note</span>
          <div className="text-[44px] font-black leading-none tracking-tres-serre tabular-nums">
            {total === null || Number.isNaN(total) ? <span className="font-normal text-texte-gris">…</span> : nombre(total)}
            <span className="text-xl text-texte-gris">/{nombre(bareme)}</span>
          </div>
        </div>
        {publiee ? <Badge ton="succes">Publiée</Badge> : copie.note !== null ? <Badge ton="alerte">Pas encore publiée</Badge> : <Badge ton="orange">À corriger</Badge>}
      </div>

      {proposition && (
        <div className="flex flex-col gap-2 rounded-2xl border border-orange/50 bg-orange-pale/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <Badge ton="orange">
              <Sparkles className="h-3 w-3" /> Proposé par l'IA · {nombre(proposition.note)}/{nombre(bareme)}
            </Badge>
            <Bouton variante="encre" taille="sm" onClick={reprendreIa}>
              Reprendre
            </Bouton>
          </div>
          {proposition.alerte && (
            <p className="flex items-start gap-2 rounded-xl bg-danger-clair px-3 py-2 text-sm text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {proposition.alerte}
            </p>
          )}
          <p className="text-sm text-texte-doux">{proposition.commentaire}</p>
          <p className="text-xs text-texte-gris">Une proposition, jamais une note : c'est vous qui décidez.</p>
        </div>
      )}

      {criteres ? (
        <ul className="flex flex-col gap-3">
          {criteres.map((g, i) => {
            const ia = proposition?.detail.find((l) => l.critere === g.critere);
            return (
              <li key={g.critere} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <label htmlFor={`critere-${i}`} className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">
                    {g.critere}
                  </label>
                  <input
                    id={`critere-${i}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={g.points}
                    step={0.25}
                    value={detail[i] ?? ""}
                    onChange={(e) => {
                      setDetail((d) => d.map((x, j) => (j === i ? e.target.value : x)));
                      setDepuisIa(false);
                    }}
                    className={cn(
                      "h-12 w-20 rounded-xl border px-2 text-center text-lg font-bold tabular-nums outline-none focus:border-orange",
                      depuisIa ? "border-orange bg-orange-pale" : "border-ligne",
                    )}
                  />
                  <span className="w-10 font-mono text-sm text-texte-gris">/{nombre(g.points)}</span>
                </div>
                <div className="flex gap-1.5">
                  {[0, g.points / 2, g.points].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setDetail((d) => d.map((x, j) => (j === i ? String(v) : x)));
                        setDepuisIa(false);
                      }}
                      className="min-h-[36px] rounded-lg bg-creme px-3 font-mono text-xs text-texte-doux hover:bg-orange-clair"
                    >
                      {nombre(v)}
                    </button>
                  ))}
                </div>
                {ia && (
                  <p className="text-[13px] text-texte-gris">
                    <span className="font-semibold text-orange-fonce">IA : {nombre(ia.obtenu)}/{nombre(g.points)}</span> · {ia.justification}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <label className="flex items-center gap-3">
          <span className="flex-1 text-[15px] font-semibold">Note globale</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={bareme}
            step={0.25}
            value={globale}
            onChange={(e) => {
              setGlobale(e.target.value);
              setDepuisIa(false);
            }}
            className={cn("h-12 w-24 rounded-xl border px-2 text-center text-lg font-bold tabular-nums outline-none focus:border-orange", depuisIa ? "border-orange bg-orange-pale" : "border-ligne")}
          />
          <span className="font-mono text-sm text-texte-gris">/{nombre(bareme)}</span>
        </label>
      )}

      <ZoneTexte
        libelle="Commentaire pour l'étudiant"
        rows={4}
        value={commentaire}
        onChange={(e) => setCommentaire(e.target.value)}
        placeholder="Un point fort, un point à améliorer, un conseil."
        aide={depuisIa ? "Repris de la proposition de l'IA : relisez et ajustez." : undefined}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Commentaire vocal</span>
        <EnregistreurVocal audio={copie.commentaireAudio} onChange={(id) => enregistrer(false, { commentaireAudioId: id })} />
      </div>

      <div className="flex flex-col gap-2">
        <Bouton taille="lg" pleineLargeur onClick={() => void enregistrer(true)} chargement={envoi} className="min-h-[56px]">
          {derniere ? "Enregistrer" : "Enregistrer et copie suivante"}
        </Bouton>
        <div className="flex flex-col gap-1">
          <Bouton variante="doux" pleineLargeur icone={<Sparkles className="h-4 w-4 text-orange-fonce" />} onClick={() => void demanderIa()} chargement={demandeIa} disabled={!iaDisponible} className="min-h-[48px]">
            {proposition ? "Proposer à nouveau (IA)" : "Proposer une correction (IA)"}
          </Bouton>
          {!iaDisponible && <span className="text-center text-xs text-texte-gris">L'IA n'est pas disponible pour le moment : corrigez avec la grille.</span>}
        </div>
      </div>
    </Carte>
  );
}

/** Pas de copie : la vie scolaire peut déposer une copie papier scannée pour l'étudiant. */
function CopieAbsente({
  copie,
  devoirId,
  devoirTitre,
  peutDeposer,
  quiz,
}: {
  copie: CopieResume;
  devoirId: number;
  devoirTitre: string;
  peutDeposer: boolean;
  quiz: boolean;
}) {
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [aLHeure, setALHeure] = useState(true);
  const choix = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState(false);

  async function deposer() {
    setEnvoi(true);
    try {
      const recus = await televerser(fichiers, "rendu");
      const r = await post<RecuDepot>(`/api/devoirs/${devoirId}/rendre-pour/${copie.etudiant.id}`, { fichierIds: recus.map((x) => x.id), aLHeure });
      await rafraichir("/api/devoirs");
      toast(`Copie déposée pour ${copie.etudiant.prenom} · reçu ${r.recu}`);
      setFichiers([]);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <EtatVide
        titre={`${copie.etudiant.prenom} ${copie.etudiant.nom} n'a ${quiz ? "pas fait l'interrogation" : "pas rendu de copie"}.`}
        texte={`${copie.etudiant.site ?? "Sans campus"} · ${copie.etudiant.matricule ?? ""}. Un message peut suffire à débloquer la situation (réseau, téléphone, compréhension de la consigne).`}
        action={
          <LienBouton href={`/messages/nouveau?a=${copie.etudiant.id}&contexte=${encodeURIComponent(`À propos du devoir : ${devoirTitre}`.slice(0, 200))}`} variante="contour" className="min-h-[48px]">
            Écrire à l'étudiant
          </LienBouton>
        }
      />
      {peutDeposer && (
        <Carte className="flex flex-col gap-3">
          <h3 className="text-lg font-extrabold">Déposer une copie papier</h3>
          <p className="text-sm text-texte-pale">Scannez ou photographiez la copie remise à la vie scolaire. Le dépôt est tracé au journal et l'étudiant reçoit son reçu.</p>
          <input ref={choix} type="file" multiple accept="image/*,application/pdf" onChange={(e) => setFichiers(Array.from(e.target.files ?? []))} className="hidden" />
          <Bouton variante="doux" icone={<FileImage className="h-4 w-4" />} onClick={() => choix.current?.click()} className="min-h-[48px] self-start">
            {fichiers.length ? "Changer les pages" : "Choisir les pages scannées"}
          </Bouton>
          {fichiers.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-texte-doux">
              {fichiers.map((f, i) => (
                <li key={i} className="flex justify-between gap-3 rounded-lg bg-creme px-3 py-2">
                  <span className="truncate">
                    {i + 1}. {f.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-texte-gris">{taille(f.size)}</span>
                </li>
              ))}
            </ul>
          )}
          <CaseACocher checked={aLHeure} onChange={setALHeure} libelle="Copie remise à l'heure en main propre" aide="Décoché : l'heure du dépôt fait foi (retard possible)." />
          <Bouton icone={<Upload className="h-4 w-4" />} onClick={() => void deposer()} disabled={!fichiers.length} chargement={envoi} className="min-h-[48px] self-start">
            Déposer pour {copie.etudiant.prenom}
          </Bouton>
        </Carte>
      )}
    </div>
  );
}
