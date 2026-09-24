// Éditeur d'un cours (formateur, équipe) : Informations · Classes et campus ·
// Programme · Site 2iae.com. Les informations, les classes et le site
// s'enregistrent ensemble (barre « Enregistrer ») ; le programme, lui,
// s'enregistre geste par geste.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Archive, Eye, MoreHorizontal, RotateCcw, Send, Undo2, AlertTriangle } from "lucide-react";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Badge, Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { Menu, ElementMenu } from "@/components/ui/menu";
import { toast, toastErreur } from "@/components/ui/toast";
import { ErreurApi, patch, put } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { cn, pluriel } from "@/lib/utils";
import { LIBELLES_STATUT } from "./outils";
import { depuisDetail, differences, classesChangees, estModifie, erreursFormulaire, type FormulaireCours } from "./composants/editeur/formulaire";
import { SectionInformations } from "./composants/editeur/SectionInformations";
import { SectionClasses } from "./composants/editeur/SectionClasses";
import { SectionProgramme } from "./composants/editeur/SectionProgramme";
import { SectionSite } from "./composants/editeur/SectionSite";
import { Confirmation } from "./composants/editeur/Confirmation";
import type { CoursDetail, OptionsEditionCours, StatutCours } from "@shared/schema";

const SECTIONS = [
  { id: "informations", libelle: "Informations" },
  { id: "classes", libelle: "Classes et campus" },
  { id: "programme", libelle: "Programme" },
  { id: "site", libelle: "Site 2iae.com" },
];

export default function PageEditeurCours({ id }: { id: string }) {
  const coursId = Number(id);
  const cle = ["/api/cours", coursId];
  const { data: cours, isLoading, error, refetch } = useQuery<CoursDetail>({ queryKey: cle });
  const { data: options } = useQuery<OptionsEditionCours>({ queryKey: ["/api/cours/options"] });
  const leconAOuvrir = Number(new URLSearchParams(useSearch()).get("lecon")) || null;

  const base = useMemo(() => (cours ? depuisDetail(cours) : null), [cours]);
  const [form, setForm] = useState<FormulaireCours | null>(null);
  const baseAvant = useRef<FormulaireCours | null>(null);

  // Le formulaire suit le serveur tant que la personne n'a rien modifié.
  useEffect(() => {
    if (!base) return;
    setForm((f) => (!f || !baseAvant.current || !estModifie(f, baseAvant.current) ? base : f));
    baseAvant.current = base;
  }, [base]);

  const modifie = Boolean(form && base && estModifie(form, base));
  const erreurs = form ? erreursFormulaire(form) : {};
  const [envoi, setEnvoi] = useState(false);
  const [confirmation, setConfirmation] = useState<StatutCours | null>(null);

  // Prévenir avant de quitter la page avec des modifications non enregistrées.
  useEffect(() => {
    if (!modifie) return;
    const avant = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avant);
    return () => window.removeEventListener("beforeunload", avant);
  }, [modifie]);

  // Arrivée sur une section précise (#programme depuis la page du cours).
  const pret = Boolean(cours && form);
  useEffect(() => {
    if (!pret || !window.location.hash) return;
    const t = setTimeout(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" }), 120);
    return () => clearTimeout(t);
  }, [pret]);

  const modifier = (maj: Partial<FormulaireCours>) => setForm((f) => (f ? { ...f, ...maj } : f));

  async function enregistrer(): Promise<boolean> {
    if (!form || !base || !cours) return false;
    if (Object.keys(erreurs).length) {
      toast("Corrigez les champs signalés en rouge.", "erreur");
      return false;
    }
    setEnvoi(true);
    try {
      const corps = differences(form, base);
      if (Object.keys(corps).length) {
        const detail = await patch<CoursDetail>(`/api/cours/${cours.id}`, corps);
        queryClient.setQueryData(cle, detail);
      }
      if (classesChangees(form, base)) await put(`/api/cours/${cours.id}/classes`, { classeIds: form.classeIds });
      // Le serveur fait foi : on repart de sa version.
      const frais = await queryClient.fetchQuery<CoursDetail>({ queryKey: cle, staleTime: 0 });
      setForm(depuisDetail(frais));
      void rafraichir("/api/cours");
      toast("Modifications enregistrées.");
      return true;
    } catch (e) {
      toastErreur(e);
      return false;
    } finally {
      setEnvoi(false);
    }
  }

  async function changerStatut(statut: StatutCours) {
    if (!cours) return;
    if (modifie && !(await enregistrer())) return;
    setEnvoi(true);
    try {
      const detail = await patch<CoursDetail>(`/api/cours/${cours.id}`, { statut });
      queryClient.setQueryData(cle, detail);
      void rafraichir("/api/cours");
      toast(
        statut === "publie"
          ? detail.nbEtudiants
            ? `Cours publié : ${pluriel(detail.nbEtudiants, "étudiant")} prévenu${detail.nbEtudiants > 1 ? "s" : ""}.`
            : "Cours publié."
          : statut === "archive"
            ? "Cours archivé : il n'apparaît plus aux étudiants."
            : "Cours repassé en brouillon : les étudiants ne le voient plus.",
      );
      setConfirmation(null);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  if (isLoading || (cours && !form)) {
    return (
      <Page>
        <Chargement lignes={5} />
      </Page>
    );
  }
  if (error || !cours || !form || !base) {
    const statut = error instanceof ErreurApi ? error.statut : 0;
    return (
      <Page>
        {statut === 403 || statut === 404 ? (
          <EtatVide
            titre={statut === 404 ? "Ce cours n'existe pas." : "Ce cours ne vous est pas accessible."}
            texte="Retrouvez vos cours dans « Mes cours »."
            action={
              <LienBouton href="/cours" variante="contour" icone={<ArrowLeft className="h-4 w-4" />} className="min-h-[48px]">
                Mes cours
              </LienBouton>
            }
          />
        ) : (
          <Erreur message={(error as Error)?.message ?? "Cours introuvable."} reessayer={() => void refetch()} />
        )}
      </Page>
    );
  }

  if (!cours.enseignant) {
    return (
      <Page>
        <EtatVide
          titre="Vous ne pouvez pas modifier ce cours."
          texte="Seuls son formateur et la direction le modifient. Un cours partagé entre plusieurs campus ne se modifie pas depuis la vie scolaire d'un seul campus."
          action={
            <LienBouton href={`/cours/${cours.id}`} variante="contour" icone={<Eye className="h-4 w-4" />} className="min-h-[48px]">
              Voir le cours
            </LienBouton>
          }
        />
      </Page>
    );
  }

  const nbPubliees = cours.chapitres.reduce((n, ch) => n + ch.lecons.filter((l) => l.publiee).length, 0);
  // Effectif des classes cochées dans le formulaire (même non encore enregistrées).
  const effectifCoche = options
    ? options.sites.flatMap((s) => s.classes).filter((c) => form.classeIds.includes(c.id)).reduce((n, c) => n + c.effectif, 0)
    : (cours.nbEtudiants ?? 0);
  const tonStatut = cours.statut === "publie" ? "succes" : cours.statut === "archive" ? "gris" : "alerte";

  return (
    <Page className="pb-40">
      <Link href="/cours" className="-mb-3 inline-flex min-h-[44px] items-center gap-2 self-start text-[15px] font-semibold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" /> Mes cours
      </Link>

      <EnTetePage
        etiquette={
          <span className="inline-flex flex-wrap items-center gap-2">
            Éditeur de cours · <span className="text-orange-fonce">{cours.code}</span>
            <Badge ton={tonStatut}>{LIBELLES_STATUT[cours.statut]}</Badge>
          </span>
        }
        titre={cours.titre}
        sousTitre={
          cours.statut === "publie"
            ? `Visible par ${pluriel(cours.nbEtudiants ?? 0, "étudiant")} · ${pluriel(nbPubliees, "leçon publiée", "leçons publiées")}`
            : cours.statut === "brouillon"
              ? "Brouillon : les étudiants ne voient pas encore ce cours."
              : "Archivé : les étudiants ne voient plus ce cours."
        }
        actions={
          <>
            <LienBouton href={`/cours/${cours.id}`} variante="contour" icone={<Eye className="h-4 w-4" />} className="min-h-[48px]">
              Voir la page
            </LienBouton>
            {cours.statut === "brouillon" && (
              <Bouton icone={<Send className="h-4 w-4" />} onClick={() => setConfirmation("publie")} className="min-h-[48px]">
                Publier le cours
              </Bouton>
            )}
            {cours.statut === "archive" && (
              <Bouton icone={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirmation("publie")} className="min-h-[48px]">
                Republier
              </Bouton>
            )}
            {cours.statut === "publie" && (
              <Menu
                declencheur={
                  <button type="button" className="grid h-12 w-12 place-items-center rounded-xl border-[1.5px] border-encre bg-white hover:bg-orange-pale" aria-label="Plus d'actions">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                }
              >
                <ElementMenu icone={<Undo2 className="h-4 w-4" />} onSelect={() => setConfirmation("brouillon")}>
                  Repasser en brouillon
                </ElementMenu>
                <ElementMenu icone={<Archive className="h-4 w-4" />} onSelect={() => setConfirmation("archive")}>
                  Archiver le cours
                </ElementMenu>
              </Menu>
            )}
          </>
        }
      />

      {/* Sommaire des sections */}
      <nav aria-label="Sections de l'éditeur" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex min-h-[44px] shrink-0 items-center rounded-full bg-creme px-4 text-sm font-bold text-texte-doux no-underline hover:bg-orange-clair hover:text-encre"
          >
            {s.libelle}
          </a>
        ))}
      </nav>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-6">
          <SectionInformations form={form} modifier={modifier} erreurs={erreurs} options={options} />
          <SectionClasses classeIds={form.classeIds} onChange={(classeIds) => modifier({ classeIds })} options={options} />
          <SectionProgramme cours={cours} leconAOuvrir={leconAOuvrir} />
        </div>
        <div className="flex flex-col gap-6 lg:sticky lg:top-24">
          <SectionSite cours={cours} form={form} modifier={modifier} options={options} erreur={erreurs.accrocheSite} />
        </div>
      </div>

      {/* Barre d'enregistrement : n'apparaît que s'il y a des modifications. */}
      <div
        className={cn(
          "fixed inset-x-0 z-40 px-3 transition-all sm:px-6",
          "bottom-[84px] lg:bottom-6",
          modifie ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
        aria-hidden={!modifie}
      >
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-encre px-4 py-3 text-white shadow-carte sm:px-5">
          <span className="text-[15px] font-semibold">Modifications non enregistrées</span>
          <span className="flex gap-2">
            <Bouton variante="nuit" onClick={() => setForm(base)} disabled={envoi} className="min-h-[48px]">
              Annuler
            </Bouton>
            <Bouton onClick={() => void enregistrer()} chargement={envoi} className="min-h-[48px]">
              Enregistrer
            </Bouton>
          </span>
        </div>
      </div>

      <Confirmation
        ouverte={confirmation === "publie"}
        onFermer={() => setConfirmation(null)}
        titre="Publier le cours ?"
        texte={
          form.classeIds.length
            ? `Les étudiants des classes cochées (${pluriel(effectifCoche, "étudiant")}) verront le cours et recevront une notification.`
            : "Aucune classe n'est cochée : personne ne verra le cours pour l'instant."
        }
        libelle={modifie ? "Enregistrer et publier" : "Publier"}
        chargement={envoi}
        onConfirmer={() => void changerStatut("publie")}
      >
        {(!nbPubliees || !form.classeIds.length) && (
          <ul className="flex flex-col gap-2 pb-2">
            {!form.classeIds.length && (
              <li className="flex items-start gap-2 rounded-xl bg-alerte-clair px-4 py-3 text-[15px] text-alerte">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Cochez les classes dans « Classes et campus ».
              </li>
            )}
            {!nbPubliees && (
              <li className="flex items-start gap-2 rounded-xl bg-alerte-clair px-4 py-3 text-[15px] text-alerte">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Aucune leçon publiée : les étudiants verront un cours vide.
              </li>
            )}
          </ul>
        )}
      </Confirmation>
      <Confirmation
        ouverte={confirmation === "brouillon"}
        onFermer={() => setConfirmation(null)}
        titre="Repasser en brouillon ?"
        texte="Les étudiants ne verront plus ce cours tant que vous ne le republiez pas. Leur progression est conservée."
        libelle="Repasser en brouillon"
        chargement={envoi}
        onConfirmer={() => void changerStatut("brouillon")}
      />
      <Confirmation
        ouverte={confirmation === "archive"}
        onFermer={() => setConfirmation(null)}
        titre="Archiver le cours ?"
        texte="Le cours disparaît pour les étudiants mais reste consultable par vous et l'équipe. Vous pourrez le republier."
        libelle="Archiver"
        chargement={envoi}
        onConfirmer={() => void changerStatut("archive")}
      />
    </Page>
  );
}
