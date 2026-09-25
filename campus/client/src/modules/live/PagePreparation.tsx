// /enseigner/seances/nouvelle?cours=<id> et /enseigner/seances/:id —
// préparer une séance (horaire Abidjan et Paris, visio, lien de secours,
// plan minuté, diapos, sondages préparés, proposition sur 2iae.com), puis
// après la séance : bilan (présences par campus, questions non traitées,
// sondages, baromètre) et fiche de révision (générer, relire, publier).
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Copy, Plus, Radio, Trash2, Upload, Sparkles, Send, Globe, ChevronLeft, ChevronRight, AlertTriangle, FileText, Check } from "lucide-react";
import { api, post, patch, put, suppr, alleger } from "@/lib/api";
import { rafraichir, queryClient } from "@/lib/queryClient";
import { useMoiConnecte } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { dateEtHeure, depuisChampDate, heureDouble, versChampDate } from "@/lib/dates";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte, TitreSection } from "@/components/ui/carte";
import { Champ, ZoneTexte, Selection, CaseACocher } from "@/components/ui/champs";
import { Badge, BadgeDirect, Chargement, EtatVide, Erreur, Chiffre } from "@/components/ui/divers";
import { Onglets } from "@/components/ui/onglets";
import { Markdown } from "@/components/ui/markdown";
import { Fenetre } from "@/components/ui/fenetre";
import { toast, toastErreur } from "@/components/ui/toast";
import { ResultatsParCampus, Barometre } from "./panneaux";
import { DESCRIPTION_FOURNISSEUR, LIBELLES_FOURNISSEUR, LIBELLES_PRESENCE, LIBELLES_STATUT_SEANCE, useSeance } from "./outils";
import type { SeanceDetailDto, BilanDto, FournisseurVisio, EtapePlan, SondageDto, ResultatsSondageDto, LignePresenceDto, DiapoDto } from "@shared/schema";

type Onglet = "preparer" | "bilan" | "fiche";
type OptionsLive = { fournisseurs: FournisseurVisio[]; fournisseurParDefaut: FournisseurVisio; iaDisponible: boolean; pdfAccepte: boolean };
type Conflit = { id: number; titre: string; debut: string; coursCode: string };

export default function PagePreparation({ id }: { id?: string }) {
  const nouvelle = !id;
  const coursParam = Number(new URLSearchParams(window.location.search).get("cours")) || null;
  if (nouvelle) return <NouvelleSeance coursId={coursParam} />;
  return <SeanceExistante id={Number(id)} />;
}

// ── Création ───────────────────────────────────────────────────────────────

function NouvelleSeance({ coursId }: { coursId: number | null }) {
  const [, naviguer] = useLocation();
  if (!coursId) {
    return (
      <Page>
        <EtatVide titre="Choisissez d'abord un cours." texte="Une séance appartient toujours à un cours : ouvrez « Nouvelle séance » depuis l'onglet Studio ou depuis la page du cours." action={<LienBouton href="/direct">Aller au studio</LienBouton>} />
      </Page>
    );
  }
  return (
    <Page className="max-w-4xl">
      <EnTetePage etiquette="Classe en direct · préparation" titre="Nouvelle séance" sousTitre="Les étudiants des cinq campus seront prévenus 24 h et 15 min avant. Vous pourrez ajouter diapos et sondages juste après." />
      <FormulaireSeance
        coursId={coursId}
        onEnregistre={(s, conflits) => {
          if (conflits.length) toast(`Attention : ${conflits.length} autre${conflits.length > 1 ? "s" : ""} live${conflits.length > 1 ? "s" : ""} au même moment dans une même salle.`, "info");
          else toast("Séance créée.");
          naviguer(`/enseigner/seances/${s.id}`, { replace: true });
        }}
      />
    </Page>
  );
}

// ── Séance existante ───────────────────────────────────────────────────────

function SeanceExistante({ id }: { id: number }) {
  const { data: seance, error, isLoading, refetch } = useSeance(id);
  const [, naviguer] = useLocation();
  const [onglet, setOnglet] = useState<Onglet | null>(null);
  const [annuler, setAnnuler] = useState(false);

  if (isLoading) return <Page><Chargement lignes={4} /></Page>;
  if (error || !seance) return <Page><Erreur message={(error as Error)?.message ?? "Séance introuvable."} reessayer={() => void refetch()} /></Page>;
  if (seance.monRole !== "formateur" && seance.monRole !== "equipe") {
    return <Page><EtatVide titre="Cette page est réservée au formateur du cours." action={<LienBouton href={`/live/${seance.id}`}>Voir le live</LienBouton>} /></Page>;
  }
  const apres = seance.statut === "terminee";
  // Vie scolaire d'un campus sur un cours partagé : le bilan et la présence de son site, sans préparer.
  const lectureSeule = !seance.peutModifier;
  const courant: Onglet = lectureSeule ? "bilan" : (onglet ?? (apres ? "bilan" : "preparer"));

  const dupliquer = async () => {
    try {
      const copie = await post<SeanceDetailDto>(`/api/seances/${seance.id}/dupliquer`, {});
      toast(`Séance dupliquée au ${dateEtHeure(copie.debut)}.`);
      naviguer(`/enseigner/seances/${copie.id}`);
    } catch (e) {
      toastErreur(e);
    }
  };
  const supprimer = async () => {
    if (!window.confirm("Supprimer définitivement cette séance ?")) return;
    try {
      await suppr(`/api/seances/${seance.id}`);
      toast("Séance supprimée.");
      await rafraichir("/api/seances", "/api/live");
      naviguer("/direct");
    } catch (e) {
      toastErreur(e);
    }
  };

  return (
    <Page>
      <EnTetePage
        etiquette={`${seance.coursCode} · ${seance.coursTitre}`}
        titre={seance.titre}
        sousTitre={`${dateEtHeure(seance.debut)} · ${seance.dureeMinutes} min · ${LIBELLES_FOURNISSEUR[seance.fournisseur]}`}
        actions={
          <>
            {seance.statut === "en_direct" ? <BadgeDirect /> : <Badge ton={seance.statut === "annulee" ? "danger" : "gris"}>{LIBELLES_STATUT_SEANCE[seance.statut]}</Badge>}
            {(seance.statut === "planifiee" || seance.statut === "en_direct") && (
              <LienBouton href={`/live/${seance.id}`} icone={<Radio className="h-4 w-4" />}>
                {seance.monRole === "equipe" ? "Observer" : "Ouvrir le studio"}
              </LienBouton>
            )}
            {apres && (
              <LienBouton href={`/replays/${seance.id}`} variante="contour">
                Voir le replay
              </LienBouton>
            )}
            {!lectureSeule && (
              <Bouton variante="doux" icone={<Copy className="h-4 w-4" />} onClick={dupliquer}>
                Dupliquer
              </Bouton>
            )}
          </>
        }
      />
      {seance.statut === "annulee" && <Erreur message={`Séance annulée : ${seance.motifAnnulation ?? ""}`} />}
      {lectureSeule ? (
        <p className="rounded-2xl bg-creme px-5 py-3.5 text-[15px] text-texte-doux">
          Ce cours est suivi par plusieurs campus : son formateur et la direction préparent la séance. Vous suivez ici la présence de votre campus.
        </p>
      ) : (
        <Onglets
          valeur={courant}
          onChange={setOnglet}
          options={[
            { valeur: "preparer", libelle: "Préparer" },
            { valeur: "bilan", libelle: "Bilan" },
            { valeur: "fiche", libelle: "Fiche de révision" },
          ]}
          className="w-fit"
        />
      )}
      {courant === "preparer" && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <TitreSection titre="La séance" />
            <FormulaireSeance
              seance={seance}
              coursId={seance.coursId}
              onEnregistre={(_s, conflits) => {
                toast(conflits.length ? `Enregistré · attention : ${conflits.length} live(s) en même temps dans une même salle.` : "Modifications enregistrées.", conflits.length ? "info" : "succes");
              }}
            />
            {seance.statut === "planifiee" && (
              <div className="flex flex-wrap gap-2 border-t border-ligne pt-4">
                <Bouton variante="contour" onClick={() => setAnnuler(true)}>
                  Signaler un empêchement
                </Bouton>
                <Bouton variante="fantome" icone={<Trash2 className="h-4 w-4" />} onClick={supprimer}>
                  Supprimer
                </Bouton>
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-8">
            <SectionDiapos seance={seance} />
            <SectionSondages seance={seance} />
          </div>
        </div>
      )}
      {courant === "bilan" && <SectionBilan seance={seance} />}
      {courant === "fiche" && <SectionFiche seance={seance} />}
      <FenetreAnnulation seance={seance} ouverte={annuler} onFermer={() => setAnnuler(false)} />
    </Page>
  );
}

// ── Formulaire (création et modification) ──────────────────────────────────

const DUREES = [30, 45, 60, 75, 90, 120, 150, 180, 240];

function FormulaireSeance({ seance, coursId, onEnregistre }: { seance?: SeanceDetailDto; coursId: number; onEnregistre: (s: SeanceDetailDto, conflits: Conflit[]) => void }) {
  const moi = useMoiConnecte();
  const demain = useMemo(() => {
    const d = new Date(Date.now() + 86_400_000);
    d.setUTCHours(10, 0, 0, 0);
    return d.toISOString();
  }, []);
  const { data: options } = useQuery<OptionsLive>({ queryKey: ["/api/live/options"], staleTime: 10 * 60_000 });
  const [titre, setTitre] = useState(seance?.titre ?? "");
  const [description, setDescription] = useState(seance?.description ?? "");
  const [debut, setDebut] = useState(versChampDate(seance?.debut ?? demain));
  const [duree, setDuree] = useState(seance?.dureeMinutes ?? 90);
  const [fournisseur, setFournisseur] = useState<FournisseurVisio | "">(seance?.fournisseur ?? "");
  const choisi: FournisseurVisio | "" = fournisseur || options?.fournisseurParDefaut || "";
  const [lienExterne, setLienExterne] = useState(seance?.lienExterne ?? "");
  const [lienSecours, setLienSecours] = useState(seance?.lienSecours ?? "");
  const [plan, setPlan] = useState<EtapePlan[]>(seance?.plan ?? []);
  const [publier, setPublier] = useState(Boolean(seance?.proposeSurSite || seance?.publierSurSite));
  const [envoi, setEnvoi] = useState(false);
  const [conflits, setConflits] = useState<Conflit[]>([]);

  // Fournisseurs proposés : ceux que ce serveur sait utiliser (Daily et Jitsi seulement s'ils sont configurés).
  const disponibles: FournisseurVisio[] = options?.fournisseurs ?? seance?.fournisseursDisponibles ?? ["campus", "externe", "demo"];
  const iso = depuisChampDate(debut);
  const totalPlan = plan.reduce((a, e) => a + (e.minutes ?? 0), 0);
  const modifiable = !seance || seance.statut === "planifiee" || seance.statut === "en_direct";

  const enregistrer = async () => {
    if (!iso) return toast("Indiquez la date et l'heure.", "erreur");
    setEnvoi(true);
    const corps = {
      titre: titre.trim(),
      description: description.trim(),
      debut: iso,
      dureeMinutes: duree,
      ...(choisi ? { fournisseur: choisi } : {}),
      lienExterne: choisi === "externe" ? lienExterne.trim() || null : null,
      lienSecours: lienSecours.trim() || null,
      plan: plan.filter((e) => e.titre.trim()).map((e) => ({ titre: e.titre.trim(), ...(e.minutes ? { minutes: e.minutes } : {}) })),
      ...(moi.role === "admin" ? { publierSurSite: publier } : { proposeSurSite: publier }),
    };
    try {
      const r = seance
        ? await patch<SeanceDetailDto & { conflits: Conflit[] }>(`/api/seances/${seance.id}`, corps)
        : await post<SeanceDetailDto & { conflits: Conflit[] }>("/api/seances", { coursId, ...corps });
      setConflits(r.conflits ?? []);
      queryClient.setQueryData([`/api/seances/${r.id}`], r);
      await rafraichir("/api/seances", "/api/live");
      onEnregistre(r, r.conflits ?? []);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void enregistrer();
      }}
    >
      <Champ libelle="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. : Les modèles de langage" required minLength={3} maxLength={160} disabled={!modifiable} />
      <ZoneTexte libelle="Ce que les étudiants vont apprendre" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={4000} disabled={!modifiable} />
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Champ
          libelle="Date et heure (heure d'Abidjan)"
          type="datetime-local"
          value={debut}
          onChange={(e) => setDebut(e.target.value)}
          aide={iso ? dateEtHeure(iso).split(" · ")[0] : "Heure d'Abidjan (GMT)"}
          required
          disabled={seance ? seance.statut !== "planifiee" : false}
        />
        <Selection libelle="Durée" value={duree} onChange={(e) => setDuree(Number(e.target.value))} disabled={!modifiable}>
          {[...new Set([...DUREES, duree])].sort((a, b) => a - b).map((d) => (
            <option key={d} value={d}>
              {d >= 60 ? `${Math.floor(d / 60)} h ${d % 60 ? String(d % 60).padStart(2, "0") : ""}`.trim() : `${d} min`}
            </option>
          ))}
        </Selection>
      </div>
      {iso && <p className="-mt-3 rounded-xl bg-creme px-4 py-2.5 font-mono text-[13px] text-texte-doux">{heureDouble(iso)} · fin {heureDouble(new Date(new Date(iso).getTime() + duree * 60_000))}</p>}

      <fieldset className="flex flex-col gap-2" disabled={!modifiable}>
        <legend className="mb-1.5 text-sm font-bold">Visio</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(choisi ? [...new Set([...disponibles, choisi])] : disponibles).map((f) => (
            <label key={f} className={cn("flex cursor-pointer gap-3 rounded-2xl border-[1.5px] p-3.5", choisi === f ? "border-orange bg-orange-pale" : "border-ligne hover:border-orange-peche")}>
              <input type="radio" name="fournisseur" className="mt-1 h-4 w-4 accent-[#E4793A]" checked={choisi === f} onChange={() => setFournisseur(f)} />
              <span className="flex flex-col">
                <span className="text-[15px] font-bold">{LIBELLES_FOURNISSEUR[f]}</span>
                <span className="text-[13px] text-texte-pale">{DESCRIPTION_FOURNISSEUR[f]}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-[13px] text-texte-gris">Quel que soit le choix, les étudiants en 3G/4G peuvent suivre en « son + diapos » (radio, ≈ 12 à 15 Mo/h).</p>
      </fieldset>
      {choisi === "externe" && <Champ libelle="Lien de la visio (Zoom, Meet, Teams)" value={lienExterne} onChange={(e) => setLienExterne(e.target.value)} placeholder="https://…" inputMode="url" required />}
      <Champ
        libelle="Lien de secours (Plan B)"
        value={lienSecours}
        onChange={(e) => setLienSecours(e.target.value)}
        placeholder="https://meet.google.com/…"
        inputMode="url"
        aide="Si la visio tombe, un clic dans le studio envoie tout le monde sur ce lien."
        disabled={!modifiable}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-2">
          <span className="text-sm font-bold">Plan minuté</span>
          <span className={cn("font-mono text-[12px]", totalPlan > duree ? "text-danger" : "text-texte-gris")}>
            {totalPlan} / {duree} min
          </span>
        </div>
        {plan.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 text-right font-mono text-[13px] text-texte-gris">{i + 1}.</span>
            <input
              value={e.titre}
              onChange={(ev) => setPlan(plan.map((x, j) => (j === i ? { ...x, titre: ev.target.value } : x)))}
              placeholder="Étape"
              aria-label={`Étape ${i + 1}`}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-ligne px-3 text-[15px] outline-none focus:border-orange"
            />
            <input
              type="number"
              min={1}
              max={480}
              value={e.minutes ?? ""}
              onChange={(ev) => setPlan(plan.map((x, j) => (j === i ? { ...x, minutes: Number(ev.target.value) || undefined } : x)))}
              aria-label={`Minutes de l'étape ${i + 1}`}
              className="min-h-11 w-20 rounded-xl border border-ligne px-2 text-center text-[15px] outline-none focus:border-orange"
            />
            <div className="flex">
              <button type="button" onClick={() => i > 0 && setPlan(plan.map((x, j) => (j === i - 1 ? plan[i] : j === i ? plan[i - 1] : x)))} className="p-2 text-texte-gris hover:text-encre" aria-label="Monter l'étape">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => i < plan.length - 1 && setPlan(plan.map((x, j) => (j === i + 1 ? plan[i] : j === i ? plan[i + 1] : x)))} className="p-2 text-texte-gris hover:text-encre" aria-label="Descendre l'étape">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setPlan(plan.filter((_, j) => j !== i))} className="p-2 text-texte-gris hover:text-danger" aria-label="Retirer l'étape">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Bouton type="button" variante="doux" taille="sm" icone={<Plus className="h-4 w-4" />} onClick={() => setPlan([...plan, { titre: "", minutes: 15 }])} className="w-fit" disabled={plan.length >= 30}>
            Ajouter une étape
          </Bouton>
          {/* L'assistant propose un plan minuté et des sondages éclair (brouillon à reprendre ici). */}
          <LienBouton href={`/assistant/preparer-seance?cours=${coursId}`} variante="fantome" taille="sm" icone={<Sparkles className="h-4 w-4" />} className="w-fit">
            Préparer avec l'assistant IA
          </LienBouton>
        </div>
      </div>

      <div className="rounded-2xl border border-ligne p-4">
        <CaseACocher
          checked={publier}
          onChange={setPublier}
          libelle={moi.role === "admin" ? "Annoncer sur 2iae.com" : "Proposer sur 2iae.com"}
          aide={moi.role === "admin" ? "Le live apparaît aussitôt sur le site de l'école." : "La direction valide en un clic avant la publication sur le site."}
        />
        {publier && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-encre p-3.5 text-white">
            <Globe className="h-5 w-5 shrink-0 text-orange" />
            <div className="min-w-0">
              <div className="font-mono text-[11px] text-orange-peche">Aperçu sur 2iae.com · Bientôt au campus numérique</div>
              <div className="truncate text-[15px] font-bold">{titre || "Titre de la séance"}</div>
              <div className="text-[12px] text-nuit-gris">{iso ? dateEtHeure(iso) : ""}</div>
            </div>
          </div>
        )}
        {seance?.proposeSurSite && !seance.publierSurSite && <p className="mt-2 text-[13px] text-texte-gris">Proposé · en attente de la direction.</p>}
        {seance?.publierSurSite && <p className="mt-2 text-[13px] font-semibold text-succes">✓ Annoncé sur 2iae.com</p>}
      </div>

      {conflits.length > 0 && (
        <div className="flex gap-3 rounded-2xl bg-alerte-clair p-4 text-[14px] text-alerte">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Salles déjà réservées à ce moment :</p>
            <ul className="list-disc pl-5">
              {conflits.map((c) => (
                <li key={c.id}>
                  {c.coursCode} · {c.titre} · {dateEtHeure(c.debut)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {modifiable && (
        <Bouton type="submit" taille="lg" chargement={envoi} disabled={titre.trim().length < 3}>
          {seance ? "Enregistrer" : "Créer la séance"}
        </Bouton>
      )}
    </form>
  );
}

// ── Diapos ─────────────────────────────────────────────────────────────────

function SectionDiapos({ seance }: { seance: SeanceDetailDto }) {
  const entree = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState(false);
  const accepte = seance.pdfAccepte ? "image/jpeg,image/png,image/webp,application/pdf" : "image/jpeg,image/png,image/webp";
  const deposer = async (liste: FileList | null) => {
    if (!liste?.length) return;
    setEnvoi(true);
    try {
      const donnees = new FormData();
      for (const f of Array.from(liste).slice(0, 10)) donnees.append("fichiers", await alleger(f), f.name);
      await api<DiapoDto[]>(`/api/seances/${seance.id}/diapos`, { methode: "POST", corps: donnees });
      await rafraichir(`/api/seances/${seance.id}`);
      toast("Diapos ajoutées.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
      if (entree.current) entree.current.value = "";
    }
  };
  const ordonner = async (ordre: number[]) => {
    try {
      await put(`/api/seances/${seance.id}/diapos`, { ordre });
      await rafraichir(`/api/seances/${seance.id}`);
    } catch (e) {
      toastErreur(e);
    }
  };
  const ids = seance.diapos.map((d) => d.fichierId);
  return (
    <section className="flex flex-col gap-3">
      <TitreSection
        titre={`Diapos${seance.diapos.length ? ` · ${seance.diapos.length}` : ""}`}
        action={
          <>
            <input ref={entree} type="file" accept={accepte} multiple className="hidden" onChange={(e) => void deposer(e.target.files)} />
            <Bouton variante="doux" taille="sm" icone={<Upload className="h-4 w-4" />} chargement={envoi} onClick={() => entree.current?.click()}>
              Déposer
            </Bouton>
          </>
        }
      />
      {!seance.diapos.length ? (
        <EtatVide
          icone={<FileText className="h-6 w-6" />}
          titre="Pas encore de diapos"
          texte={
            seance.pdfAccepte
              ? "Déposez votre PDF ou vos images : chaque page devient une image légère, affichée chez tous les étudiants au rythme de vos ← →."
              : "Déposez vos diapos en images (exportez-les depuis PowerPoint ou Google Slides en JPEG ou PNG). Elles s'affichent chez tous les étudiants au rythme de vos ← →, pour quelques Mo seulement."
          }
          action={
            <Bouton variante="contour" onClick={() => entree.current?.click()} chargement={envoi}>
              Choisir mes diapos
            </Bouton>
          }
        />
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {seance.diapos.map((d, i) => (
            <div key={d.fichierId} className="group relative overflow-hidden rounded-xl border border-ligne">
              <img src={d.url} alt={`Diapo ${i + 1}`} loading="lazy" className="aspect-video w-full object-cover" />
              <span className="absolute left-1.5 top-1.5 rounded bg-encre/80 px-1.5 font-mono text-[11px] text-white">{i + 1}</span>
              <div className="flex justify-between bg-creme px-1">
                <button onClick={() => i > 0 && ordonner(ids.map((x, j) => (j === i - 1 ? ids[i] : j === i ? ids[i - 1] : x)))} className="p-1.5 text-texte-gris hover:text-encre" aria-label={`Avancer la diapo ${i + 1}`}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => ordonner(ids.filter((x) => x !== d.fichierId))} className="p-1.5 text-texte-gris hover:text-danger" aria-label={`Retirer la diapo ${i + 1}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
                <button onClick={() => i < ids.length - 1 && ordonner(ids.map((x, j) => (j === i + 1 ? ids[i] : j === i ? ids[i + 1] : x)))} className="p-1.5 text-texte-gris hover:text-encre" aria-label={`Reculer la diapo ${i + 1}`}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Sondages préparés ──────────────────────────────────────────────────────

function SectionSondages({ seance }: { seance: SeanceDetailDto }) {
  const cle = [`/api/seances/${seance.id}/sondages`];
  const { data: liste, refetch } = useQuery<(SondageDto & { resultats: ResultatsSondageDto | null })[]>({ queryKey: cle });
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [bonne, setBonne] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const valides = options.map((o) => o.trim()).filter(Boolean);
  const ajouter = async () => {
    setEnvoi(true);
    try {
      await post(`/api/seances/${seance.id}/sondages`, { question: question.trim(), options: valides, bonneReponse: bonne !== null && bonne < valides.length ? bonne : null });
      setQuestion("");
      setOptions(["", "", "", ""]);
      setBonne(null);
      await refetch();
      toast("Sondage préparé : lancez-le d'un clic pendant le direct.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const retirer = async (id: number) => {
    try {
      await suppr(`/api/seances/${seance.id}/sondages/${id}`);
      await refetch();
    } catch (e) {
      toastErreur(e);
    }
  };
  const prepares = (liste ?? []).filter((s) => !s.ouvertLe);
  return (
    <section className="flex flex-col gap-3">
      <TitreSection titre={`Sondages préparés${prepares.length ? ` · ${prepares.length}` : ""}`} />
      {prepares.map((s) => (
        <Carte key={s.id} className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-[15px] font-bold">{s.question}</p>
            <p className="text-[13px] text-texte-pale">
              {s.options.map((o, i) => (
                <span key={i} className={cn(i === s.bonneReponse && "font-bold text-succes")}>
                  {String.fromCharCode(65 + i)}. {o}
                  {i < s.options.length - 1 ? " · " : ""}
                </span>
              ))}
            </p>
            {s.parIa && <Badge ton="gris" className="mt-1">Proposé par l'IA</Badge>}
          </div>
          <button onClick={() => retirer(s.id)} className="p-2 text-texte-gris hover:text-danger" aria-label="Retirer ce sondage">
            <Trash2 className="h-4 w-4" />
          </button>
        </Carte>
      ))}
      <Carte className="flex flex-col gap-3 bg-creme">
        <Champ libelle="Nouvelle question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex. : Un modèle de langage…" />
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBonne(bonne === i ? null : i)}
              className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full font-mono text-sm", bonne === i ? "bg-succes text-white" : "bg-white text-texte-pale")}
              aria-label={`Marquer ${String.fromCharCode(65 + i)} comme bonne réponse`}
            >
              {bonne === i ? <Check className="h-4 w-4" /> : String.fromCharCode(65 + i)}
            </button>
            <input
              value={o}
              onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Réponse ${String.fromCharCode(65 + i)}${i >= 2 ? " (facultative)" : ""}`}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-ligne bg-white px-3 text-[15px] outline-none focus:border-orange"
            />
          </div>
        ))}
        <Bouton onClick={ajouter} chargement={envoi} disabled={question.trim().length < 3 || valides.length < 2} className="w-fit">
          Préparer ce sondage
        </Bouton>
      </Carte>
    </section>
  );
}

// ── Bilan ──────────────────────────────────────────────────────────────────

function SectionBilan({ seance }: { seance: SeanceDetailDto }) {
  const { data: bilan, error, isLoading, refetch } = useQuery<BilanDto>({ queryKey: [`/api/seances/${seance.id}/bilan`] });
  if (isLoading) return <Chargement lignes={3} />;
  if (error || !bilan) return <Erreur message={(error as Error)?.message ?? "Bilan indisponible."} reessayer={() => void refetch()} />;
  const pasCommencee = seance.statut === "planifiee";
  // Jamais démarrée (« Séance non tenue ») : ni présents ni absents.
  const nonTenue = !bilan.tenue && !pasCommencee;
  return (
    <div className="flex flex-col gap-8">
      {pasCommencee && <p className="rounded-2xl bg-creme p-4 text-[15px] text-texte-pale">La séance n'a pas encore eu lieu : le bilan se remplit pendant le direct.</p>}
      {nonTenue && (
        <p className="rounded-2xl bg-creme p-4 text-[15px] text-texte-pale">
          Cette séance n'a jamais été démarrée{seance.motifAnnulation ? ` (${seance.motifAnnulation})` : ""} : aucune présence ni absence n'est comptée.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Chiffre
          libelle="Présents"
          valeur={nonTenue ? "—" : `${bilan.totaux.presents} / ${bilan.totaux.inscrits}`}
          detail={nonTenue ? "Séance non tenue" : `${bilan.totaux.taux} % des inscrits · en ligne : ${bilan.seuilMinutes} min minimum`}
          ton="orange"
        />
        <Chiffre libelle="Questions posées" valeur={bilan.questionsTotal} detail={`${bilan.questionsNonTraitees.length} sans réponse`} />
        <Chiffre libelle="Sondages" valeur={bilan.sondages.length} detail={bilan.sondages.length ? `${bilan.sondages.reduce((a, s) => a + s.resultats.total, 0)} réponses au total` : "Aucun sondage lancé"} />
      </div>

      {!nonTenue && (
        <section>
          <TitreSection titre="Présences par campus" />
          <div className="overflow-x-auto rounded-2xl border border-ligne">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead className="bg-creme font-mono text-[11px] uppercase tracking-wider text-texte-gris">
                <tr>
                  {["Campus", "Inscrits", "En salle", "En ligne", "Retard", "Partiel", "Absents", "Justifiés", "Incident", "Effectif déclaré"].map((t) => (
                    <th key={t} className="px-3 py-2.5 font-normal">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bilan.sites.map((s) => (
                  <tr key={s.site} className="border-t border-ligne-douce">
                    <td className="px-3 py-2.5 font-bold">
                      {s.site}
                      {s.incidentSalle && <span className="ml-2 rounded bg-danger-clair px-1.5 py-0.5 text-[11px] font-bold text-danger">{s.incidentSalle}</span>}
                      {s.horsCampus > 0 && (
                        <span className="ml-2 rounded bg-alerte-clair px-1.5 py-0.5 text-[11px] font-bold text-encre" title="Émargés dans cette salle alors qu'ils sont rattachés à un autre campus">
                          {s.horsCampus} hors campus
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{s.inscrits}</td>
                    <td className="px-3 py-2.5 tabular-nums">{s.enSalle}</td>
                    <td className="px-3 py-2.5 tabular-nums">{s.enLigne}</td>
                    <td className="px-3 py-2.5 tabular-nums">{s.retard}</td>
                    <td className="px-3 py-2.5 tabular-nums">{s.partiel}</td>
                    <td className="px-3 py-2.5 tabular-nums">{s.absents}</td>
                    <td className="px-3 py-2.5 tabular-nums">{s.justifies}</td>
                    <td className="px-3 py-2.5 tabular-nums">{s.incident}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {s.effectifDeclare ?? "—"}
                      {s.ecart ? <span className={cn("ml-1.5 font-mono text-[12px]", Math.abs(s.ecart) > 2 ? "font-bold text-danger" : "text-texte-gris")}>(écart {s.ecart > 0 ? `+${s.ecart}` : s.ecart})</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <FeuillePresence seance={seance} />
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <TitreSection titre="Questions restées sans réponse" />
          {!bilan.questionsNonTraitees.length ? (
            <p className="rounded-2xl bg-creme p-4 text-[15px] text-texte-pale">Toutes les questions ont été traitées. Bravo !</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {bilan.questionsNonTraitees.map((q) => (
                <li key={q.id} className="flex items-start justify-between gap-3 rounded-2xl border border-ligne p-3.5">
                  <span className="text-[15px]">
                    <span className="block font-mono text-[11px] text-orange-fonce">
                      {q.site ?? "En ligne"} · {q.auteurReel}
                    </span>
                    {q.texte}
                  </span>
                  <Badge ton="gris">▲ {q.votes}</Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[13px] text-texte-gris">Répondez-y dans le salon du cours ou dans la fiche de révision.</p>
        </section>
        <section>
          <TitreSection titre="Baromètre de la séance" />
          <div className="rounded-2xl bg-encre p-5">
            <Barometre barometre={bilan.barometre} />
          </div>
        </section>
      </div>

      {bilan.sondages.length > 0 && (
        <section>
          <TitreSection titre="Sondages" />
          <div className="grid gap-4 lg:grid-cols-2">
            {bilan.sondages.map((s) => (
              <div key={s.id} className="rounded-2xl bg-encre p-5 text-white">
                <p className="mb-3 text-[16px] font-extrabold">{s.question}</p>
                <ResultatsParCampus sondage={s} resultats={s.resultats} />
              </div>
            ))}
          </div>
        </section>
      )}

      {bilan.evenements.length > 0 && (
        <section>
          <TitreSection titre="Déroulé" />
          <ol className="flex flex-col gap-1.5 border-l-2 border-ligne pl-4">
            {bilan.evenements.map((e, i) => (
              <li key={i} className="text-[14px]">
                <span className="font-mono text-[12px] text-texte-gris">{heureDouble(e.creeLe).split(" · ")[0]}</span> · {e.libelle}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function FeuillePresence({ seance }: { seance: SeanceDetailDto }) {
  const moi = useMoiConnecte();
  const [ouverte, setOuverte] = useState(false);
  const { data: lignes, refetch } = useQuery<LignePresenceDto[]>({ queryKey: [`/api/seances/${seance.id}/presences`], enabled: ouverte });
  const peutPointer = moi.role === "admin" || moi.role === "vie_scolaire";
  const pointer = async (l: LignePresenceDto, statut: "present" | "absent" | "justifie") => {
    const justification = statut === "justifie" ? window.prompt("Justification (ex. : certificat médical)") ?? "" : undefined;
    if (statut === "justifie" && !justification) return;
    try {
      await post(`/api/seances/${seance.id}/pointage`, { utilisateurId: l.utilisateurId, statut, justification });
      await Promise.all([refetch(), rafraichir(`/api/seances/${seance.id}/bilan`)]);
    } catch (e) {
      toastErreur(e);
    }
  };
  const nomSite = (id: number | null) => seance.sites.find((s) => s.id === id)?.nomCourt ?? "—";
  return (
    <div className="mt-3">
      <Bouton variante="doux" taille="sm" onClick={() => setOuverte((v) => !v)}>
        {ouverte ? "Masquer la feuille de présence" : "Voir la feuille de présence"}
      </Bouton>
      {ouverte && (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-ligne">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead className="bg-creme font-mono text-[11px] uppercase tracking-wider text-texte-gris">
              <tr>
                <th className="px-3 py-2.5 font-normal">Étudiant</th>
                <th className="px-3 py-2.5 font-normal">Campus</th>
                <th className="px-3 py-2.5 font-normal">Statut</th>
                <th className="px-3 py-2.5 font-normal">Minutes</th>
                {peutPointer && <th className="px-3 py-2.5 font-normal">Pointage</th>}
              </tr>
            </thead>
            <tbody>
              {(lignes ?? []).map((l) => (
                <tr key={l.utilisateurId} className="border-t border-ligne-douce">
                  <td className="px-3 py-2.5">
                    <span className="font-bold">
                      {l.prenom} {l.nom}
                    </span>
                    <span className="block font-mono text-[11px] text-texte-gris">{l.matricule}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {nomSite(l.siteId)}
                    {l.horsCampus && (
                      <span className="mt-0.5 block w-fit rounded bg-alerte-clair px-1.5 py-0.5 text-[11px] font-bold text-encre">Hors de son campus · inscrit à {nomSite(l.siteInscription)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge ton={l.statut === "salle" || l.statut === "en_ligne" ? "succes" : l.statut === "absent" ? "danger" : l.statut === "incident" || l.statut === "justifie" ? "gris" : "alerte"}>{LIBELLES_PRESENCE[l.statut]}</Badge>
                    {l.emargeQr && <span className="ml-1.5 font-mono text-[11px] text-texte-gris">code</span>}
                    {l.pointe && <span className="ml-1.5 font-mono text-[11px] text-texte-gris">pointé</span>}
                    {l.arriveeSalleLe && l.mode === "salle" && <span className="ml-1.5 font-mono text-[11px] text-texte-gris">arrivé {heureDouble(l.arriveeSalleLe).split(" ")[0]}</span>}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{l.minutes}</td>
                  {peutPointer && (
                    <td className="flex gap-1 px-3 py-2">
                      <Bouton variante="doux" taille="sm" onClick={() => pointer(l, "present")}>
                        Présent
                      </Bouton>
                      <Bouton variante="fantome" taille="sm" onClick={() => pointer(l, "absent")}>
                        Absent
                      </Bouton>
                      <Bouton variante="fantome" taille="sm" onClick={() => pointer(l, "justifie")}>
                        Justifié
                      </Bouton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {lignes && !lignes.length && <p className="p-4 text-[14px] text-texte-pale">Aucun étudiant inscrit dans votre périmètre.</p>}
        </div>
      )}
    </div>
  );
}

// ── Fiche de révision ──────────────────────────────────────────────────────

function SectionFiche({ seance }: { seance: SeanceDetailDto }) {
  const cleBilan = [`/api/seances/${seance.id}/bilan`];
  const { data: bilan, refetch } = useQuery<BilanDto>({ queryKey: cleBilan });
  const [contenu, setContenu] = useState<string | null>(null);
  const [parIa, setParIa] = useState(false);
  const [valide, setValide] = useState(false);
  const [envoi, setEnvoi] = useState<"generer" | "brouillon" | "publier" | null>(null);
  const [apercu, setApercu] = useState(false);

  useEffect(() => {
    if (bilan && contenu === null && bilan.fiche.contenu) {
      setContenu(bilan.fiche.contenu);
      setParIa(bilan.fiche.parIa);
      setValide(bilan.fiche.valide);
    }
  }, [bilan]);

  const generer = async () => {
    if (contenu && !window.confirm("Remplacer la fiche actuelle par une nouvelle version ?")) return;
    setEnvoi("generer");
    try {
      const r = await post<{ contenu: string; parIa: boolean }>(`/api/seances/${seance.id}/resume`);
      setContenu(r.contenu);
      setParIa(r.parIa);
      setValide(false);
      toast(r.parIa ? "Brouillon proposé par l'IA : relisez-le avant de le publier." : "Canevas prêt : complétez-le puis publiez.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  };
  const enregistrer = async (publier?: boolean) => {
    if (!contenu) return;
    setEnvoi(publier ? "publier" : "brouillon");
    try {
      const r = await patch<{ valide: boolean }>(`/api/seances/${seance.id}/resume`, { contenu, ...(publier !== undefined && { valider: publier }) });
      setValide(r.valide);
      await Promise.all([refetch(), rafraichir(`/api/seances/${seance.id}`)]);
      toast(publier ? "Fiche publiée : les étudiants sont prévenus." : publier === false ? "Fiche retirée des étudiants." : "Brouillon enregistré.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  };

  if (contenu === null) {
    return (
      <EtatVide
        icone={<Sparkles className="h-6 w-6" />}
        titre="Pas encore de fiche de révision"
        texte={
          seance.iaDisponible
            ? "L'assistant rédige un brouillon à partir de la transcription, du plan et des questions posées. Vous le relisez, le corrigez, puis vous l'envoyez aux étudiants."
            : "L'assistant IA n'est pas configuré sur ce campus : le campus prépare un canevas avec votre plan et les questions posées, que vous complétez avant de l'envoyer."
        }
        action={
          <Bouton icone={<Sparkles className="h-4 w-4" />} chargement={envoi === "generer"} onClick={generer}>
            {seance.iaDisponible ? "Générer la fiche de révision" : "Préparer le canevas de la fiche"}
          </Bouton>
        }
      />
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {valide ? <Badge ton="succes">✓ Publiée aux étudiants</Badge> : <Badge ton="alerte">Brouillon</Badge>}
          {parIa && !valide && <Badge ton="orange">Proposé par l'IA · à relire</Badge>}
          <button onClick={() => setApercu((v) => !v)} className="ml-auto text-sm font-bold text-orange-fonce lg:hidden">
            {apercu ? "Modifier" : "Aperçu"}
          </button>
        </div>
        {!apercu && <ZoneTexte libelle="Fiche (Markdown)" value={contenu} onChange={(e) => setContenu(e.target.value)} rows={22} className="font-mono" />}
        <div className="flex flex-wrap gap-2">
          <Bouton variante="contour" chargement={envoi === "brouillon"} onClick={() => enregistrer()}>
            Enregistrer le brouillon
          </Bouton>
          {valide ? (
            <Bouton variante="fantome" onClick={() => enregistrer(false)}>
              Retirer la publication
            </Bouton>
          ) : (
            <Bouton icone={<Send className="h-4 w-4" />} chargement={envoi === "publier"} onClick={() => enregistrer(true)} disabled={contenu.trim().length < 20}>
              Valider et envoyer aux étudiants
            </Bouton>
          )}
          <Bouton variante="fantome" icone={<Sparkles className="h-4 w-4" />} chargement={envoi === "generer"} onClick={generer}>
            {seance.iaDisponible ? "Régénérer" : "Nouveau canevas"}
          </Bouton>
        </div>
      </div>
      <div className={cn("rounded-2xl border border-ligne p-5", !apercu && "hidden lg:block")}>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-texte-gris">Aperçu côté étudiant</p>
        <Markdown source={contenu} />
      </div>
    </div>
  );
}

function FenetreAnnulation({ seance, ouverte, onFermer }: { seance: SeanceDetailDto; ouverte: boolean; onFermer: () => void }) {
  const [motif, setMotif] = useState("Le formateur a un empêchement. La séance sera reprogrammée.");
  const [envoi, setEnvoi] = useState(false);
  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Signaler un empêchement"
      description="La séance est annulée : les inscrits sont prévenus et le message s'affiche sur les écrans des salles."
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer}>
            Retour
          </Bouton>
          <Bouton
            variante="danger"
            chargement={envoi}
            onClick={async () => {
              setEnvoi(true);
              try {
                await post(`/api/seances/${seance.id}/annuler`, { motif });
                await rafraichir(`/api/seances/${seance.id}`, "/api/live");
                toast("Séance annulée, tout le monde est prévenu.");
                onFermer();
              } catch (e) {
                toastErreur(e);
              } finally {
                setEnvoi(false);
              }
            }}
          >
            Annuler la séance
          </Bouton>
        </>
      }
    >
      <ZoneTexte libelle="Message" value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} />
    </Fenetre>
  );
}

