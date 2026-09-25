// /pilotage/planning : les lives de la semaine, à l'heure d'Abidjan (Paris en
// petit pour les formateurs), avec les conflits de salle en rouge : deux
// séances qui se chevauchent et concernent un même campus occupent la même
// salle de conférence. Création et déplacement passent par l'API du live.
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, TriangleAlert, CalendarClock, Radio, BarChart3, Ban } from "lucide-react";
import type { PlanningSemaine, SeancePlanning, CoursResume, CoursDetail } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Badge, BadgeDirect, Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { Fenetre } from "@/components/ui/fenetre";
import { Champ, Selection, ZoneTexte } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { post, patch, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { heure, jourLong, dateEtHeure } from "@/lib/dates";
import { maintenantServeur } from "@/lib/horloge";
import { cn, pluriel } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { lundiIso, decalerSemaine, libelleSemaine } from "./outils";

const JOUR_MS = 86_400_000;
const DUREES = [45, 60, 90, 120, 150, 180];
const LIBELLES_FOURNISSEURS: Record<string, string> = { campus: "Visio du campus", daily: "Daily", jitsi: "Jitsi", externe: "Lien externe", demo: "Démonstration" };

type ReponseSeance = { id: number; conflits?: { id: number; titre: string; coursCode: string }[] };

export default function PagePlanning() {
  const [semaine, setSemaine] = useState(lundiIso());
  const url = `/api/pilotage/planning?semaine=${semaine}`;
  const { data, isLoading, error, refetch, isFetching } = useQuery<PlanningSemaine>({ queryKey: [url] });
  const [creation, setCreation] = useState(false);
  const [ouverte, setOuverte] = useState<SeancePlanning | null>(null);
  const courante = lundiIso();

  const jours = useMemo(() => {
    const debut = new Date(`${semaine}T00:00:00Z`).getTime();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(debut + i * JOUR_MS);
      const cle = d.toISOString().slice(0, 10);
      return { cle, date: d, seances: (data?.seances ?? []).filter((s) => s.debut.slice(0, 10) === cle) };
    });
  }, [semaine, data]);
  const parId = new Map((data?.seances ?? []).map((s) => [s.id, s]));
  const aujourdhui = new Date(maintenantServeur()).toISOString().slice(0, 10);

  return (
    <Page large>
      <SousNav />
      <EnTetePage
        etiquette="Pilotage · Planning des lives"
        titre="Planning"
        sousTitre="Heures d'Abidjan. Une salle de conférence par campus : deux lives qui se chevauchent sur un même campus sont signalés en rouge."
        actions={
          <Bouton taille="lg" icone={<Plus className="h-5 w-5" />} onClick={() => setCreation(true)} className="min-h-[52px]">
            Programmer un live
          </Bouton>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Bouton variante="contour" taille="icone" aria-label="Semaine précédente" onClick={() => setSemaine(decalerSemaine(semaine, -1))} className="h-12 w-12">
          <ChevronLeft className="h-5 w-5" />
        </Bouton>
        <h2 className="min-w-0 flex-1 text-center text-lg font-extrabold sm:flex-none sm:px-3">{libelleSemaine(semaine)}</h2>
        <Bouton variante="contour" taille="icone" aria-label="Semaine suivante" onClick={() => setSemaine(decalerSemaine(semaine, 1))} className="h-12 w-12">
          <ChevronRight className="h-5 w-5" />
        </Bouton>
        {semaine !== courante && (
          <Bouton variante="doux" onClick={() => setSemaine(courante)} className="min-h-[48px]">
            Cette semaine
          </Bouton>
        )}
        {data && <span className="ml-auto hidden text-sm text-texte-pale sm:block">{pluriel(data.seances.filter((s) => s.statut !== "annulee").length, "live")}</span>}
      </div>

      {data && data.conflits.length > 0 && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border-2 border-danger bg-danger-clair p-4 text-danger">
          <p className="flex items-center gap-2 font-extrabold">
            <TriangleAlert className="h-5 w-5" /> {pluriel(data.conflits.length, "conflit")} de salle cette semaine
          </p>
          <ul className="flex flex-col gap-1 text-[15px]">
            {data.conflits.map((c) => {
              const a = parId.get(c.a);
              const b = parId.get(c.b);
              if (!a || !b) return null;
              return (
                <li key={`${c.a}-${c.b}`}>
                  {jourLong(a.debut)} : <strong>{a.coursCode}</strong> ({heure(a.debut)}–{heure(a.fin)}) et <strong>{b.coursCode}</strong> ({heure(b.debut)}–{heure(b.fin)}) · salle de {c.sites.join(", ")}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {isLoading ? (
        <Chargement lignes={4} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => refetch()} />
      ) : (
        <>
          {!data?.seances.length && (
            <EtatVide
              icone={<CalendarClock className="h-6 w-6" />}
              titre="Aucun live programmé cette semaine."
              texte="Les formateurs peuvent proposer leurs créneaux ; vous pouvez aussi en programmer un ici. Les étudiants reçoivent un rappel la veille et 15 minutes avant."
              action={<Bouton onClick={() => setCreation(true)}>Programmer un live</Bouton>}
            />
          )}
          <div className={cn("grid gap-3 transition-opacity lg:grid-cols-7", isFetching && "opacity-70", !data?.seances.length && "hidden lg:grid")}>
            {jours.map((j) => (
              <section key={j.cle} className={cn("flex flex-col gap-2 lg:min-h-[240px] lg:rounded-2xl lg:bg-creme lg:p-2", !j.seances.length && "hidden lg:flex")} aria-label={jourLong(j.date)}>
                <h3 className={cn("px-1 text-sm font-extrabold first-letter:uppercase", j.cle === aujourdhui && "text-orange-fonce")}>
                  {jourLong(j.date)}
                  {j.cle === aujourdhui && <span className="ml-2 font-mono text-[11px] font-normal uppercase">aujourd'hui</span>}
                </h3>
                {j.seances.map((s) => (
                  <CarteSeance key={s.id} s={s} parId={parId} onOuvrir={() => setOuverte(s)} />
                ))}
              </section>
            ))}
          </div>
        </>
      )}

      <FenetreCreation ouverte={creation} onFermer={() => setCreation(false)} semaine={semaine} onCreee={(lundi) => setSemaine(lundi)} />
      {ouverte && <FenetreSeance key={ouverte.id} s={ouverte} onFermer={() => setOuverte(null)} />}
    </Page>
  );
}

function CarteSeance({ s, parId, onOuvrir }: { s: SeancePlanning; parId: Map<number, SeancePlanning>; onOuvrir: () => void }) {
  const conflit = s.conflits.length > 0;
  const annulee = s.statut === "annulee";
  return (
    <button
      type="button"
      onClick={onOuvrir}
      className={cn(
        "relative flex w-full flex-col gap-1.5 overflow-hidden rounded-xl border bg-white p-3 pl-4 text-left transition-colors hover:border-orange",
        conflit ? "border-2 border-danger" : "border-ligne",
        annulee && "opacity-60",
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: s.couleur }} aria-hidden />
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-[13px] font-semibold tabular-nums">
          {heure(s.debut)} – {heure(s.fin)}
        </span>
        {s.statut === "en_direct" && <BadgeDirect libelle="Direct" className="px-2 py-1 text-[10px]" />}
      </span>
      <span className={cn("text-[15px] font-extrabold leading-snug", annulee && "line-through")}>
        {s.coursCode} · {s.titre}
      </span>
      <span className="text-[13px] text-texte-pale">
        {heure(s.debut, "Europe/Paris")} à Paris{s.formateur ? ` · ${s.formateur}` : ""}
      </span>
      <span className="flex flex-wrap gap-1">
        {s.sites.map((x) => (
          <span key={x.id} className="rounded-md bg-creme px-1.5 py-0.5 font-mono text-[11px] text-texte-doux">
            {x.nomCourt}
          </span>
        ))}
      </span>
      {annulee && <span className="text-[13px] font-semibold text-danger">Annulé{s.motifAnnulation ? ` : ${s.motifAnnulation}` : ""}</span>}
      {conflit && (
        <span className="flex items-start gap-1 text-[13px] font-bold text-danger">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Même salle que {s.conflits.map((id) => parId.get(id)?.coursCode ?? "un autre live").join(", ")}
        </span>
      )}
    </button>
  );
}

// ── Programmer un live ─────────────────────────────────────────────────────

function FenetreCreation({ ouverte, onFermer, semaine, onCreee }: { ouverte: boolean; onFermer: () => void; semaine: string; onCreee: (lundi: string) => void }) {
  const cours = useQuery<CoursResume[]>({ queryKey: ["/api/cours"], enabled: ouverte });
  const demain = new Date(Math.max(maintenantServeur() + JOUR_MS, new Date(`${semaine}T00:00:00Z`).getTime()));
  const [coursId, setCoursId] = useState("");
  const [titre, setTitre] = useState("");
  const [date, setDate] = useState(demain.toISOString().slice(0, 10));
  const [horaire, setHoraire] = useState("10:00");
  const [duree, setDuree] = useState("90");
  const [externe, setExterne] = useState(false);
  const [lien, setLien] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  // Vérification des conflits avant d'enregistrer : campus du cours choisi × lives de la semaine visée.
  const detail = useQuery<CoursDetail>({ queryKey: [`/api/cours/${coursId}`], enabled: ouverte && Boolean(coursId) });
  const semaineVisee = date ? lundiIso(new Date(`${date}T12:00:00Z`)) : semaine;
  const planning = useQuery<PlanningSemaine>({ queryKey: [`/api/pilotage/planning?semaine=${semaineVisee}`], enabled: ouverte && Boolean(date) });
  const debutIso = date && horaire ? `${date}T${horaire}:00.000Z` : null;
  const conflits = useMemo(() => {
    if (!debutIso || !detail.data || !planning.data) return [];
    const debut = new Date(debutIso).getTime();
    const fin = debut + Number(duree) * 60_000;
    const mesSites = new Set(detail.data.sites.map((s) => s.id));
    return planning.data.seances.filter(
      (s) => s.statut !== "annulee" && new Date(s.debut).getTime() < fin && new Date(s.fin).getTime() > debut && s.sites.some((x) => mesSites.has(x.id)),
    );
  }, [debutIso, duree, detail.data, planning.data]);

  const enregistrer = async () => {
    if (!debutIso) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await post<ReponseSeance>("/api/seances", {
        coursId: Number(coursId),
        titre,
        debut: debutIso,
        dureeMinutes: Number(duree),
        ...(externe ? { fournisseur: "externe", lienExterne: lien } : {}),
      });
      if (r.conflits?.length) toast(`Live programmé, mais la salle est déjà prise par ${r.conflits.map((c) => c.coursCode).join(", ")}.`, "erreur");
      else toast("Live programmé : les étudiants seront prévenus la veille et 15 min avant.");
      await rafraichir("/api/pilotage/planning", "/api/seances", "/api/live");
      onCreee(semaineVisee);
      setTitre("");
      onFermer();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Une erreur est survenue.");
    } finally {
      setEnvoi(false);
    }
  };

  const listeCours = (cours.data ?? []).filter((c) => c.statut !== "archive");
  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Programmer un live"
      description="Heure d'Abidjan. Le formateur garde la main sur le contenu et peut préparer sa séance dès maintenant."
      pied={
        <Bouton onClick={enregistrer} chargement={envoi} disabled={!coursId || titre.trim().length < 3 || !debutIso || (externe && !lien)}>
          Programmer
        </Bouton>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Selection libelle="Cours" value={coursId} onChange={(e) => setCoursId(e.target.value)}>
          <option value="">Choisir le cours…</option>
          {listeCours.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.titre}
              {c.statut === "brouillon" ? " (brouillon)" : ""}
            </option>
          ))}
        </Selection>
        {detail.data && (
          <p className="-mt-2 text-sm text-texte-pale">
            {detail.data.sites.length ? `Salles concernées : ${detail.data.sites.map((s) => s.nomCourt).join(", ")}.` : "Aucune classe n'est encore rattachée à ce cours."}
          </p>
        )}
        <Champ libelle="Titre de la séance" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Séance 4 · Vérifier une réponse de l'IA" maxLength={160} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Champ libelle="Jour" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="col-span-2 sm:col-span-1" />
          <Champ libelle="Heure (Abidjan)" type="time" value={horaire} step={300} onChange={(e) => setHoraire(e.target.value)} />
          <Selection libelle="Durée" value={duree} onChange={(e) => setDuree(e.target.value)}>
            {DUREES.map((d) => (
              <option key={d} value={d}>
                {d >= 60 ? `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60}` : ""}` : `${d} min`}
              </option>
            ))}
          </Selection>
        </div>
        {debutIso && <p className="-mt-2 text-sm text-texte-pale">{dateEtHeure(debutIso)}</p>}
        <label className="flex min-h-[48px] cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-[#E4793A]" checked={externe} onChange={(e) => setExterne(e.target.checked)} />
          <span className="text-[15px] font-semibold">Le formateur utilise son propre lien (Zoom, Meet, Teams)</span>
        </label>
        {externe && <Champ libelle="Lien de la visio" value={lien} onChange={(e) => setLien(e.target.value)} placeholder="https://…" inputMode="url" />}
        {conflits.length > 0 && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border-2 border-danger bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            Salle déjà prise : {conflits.map((c) => `${c.coursCode} (${heure(c.debut)}–${heure(c.fin)}, ${c.sites.map((x) => x.nomCourt).join(", ")})`).join(" ; ")}. Choisissez un autre créneau si possible.
          </p>
        )}
        {erreur && (
          <p role="alert" className="rounded-xl bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger">
            {erreur}
          </p>
        )}
      </div>
    </Fenetre>
  );
}

// ── Détail d'une séance : déplacer, annuler, voir les présences ────────────

function FenetreSeance({ s, onFermer }: { s: SeancePlanning; onFermer: () => void }) {
  const [mode, setMode] = useState<"voir" | "deplacer" | "annuler">("voir");
  const [date, setDate] = useState(s.debut.slice(0, 10));
  const [horaire, setHoraire] = useState(s.debut.slice(11, 16));
  const [duree, setDuree] = useState(String(s.dureeMinutes));
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const passee = new Date(s.debut).getTime() < maintenantServeur();
  const modifiable = s.statut === "planifiee" && !passee;
  const fermer = onFermer;
  const deplacer = async () => {
    setEnvoi(true);
    try {
      const r = await patch<ReponseSeance>(`/api/seances/${s.id}`, { debut: `${date}T${horaire}:00.000Z`, dureeMinutes: Number(duree) });
      toast(r.conflits?.length ? `Déplacé, mais la salle est prise par ${r.conflits.map((c) => c.coursCode).join(", ")}.` : "Live déplacé : les inscrits sont prévenus.", r.conflits?.length ? "erreur" : "succes");
      await rafraichir("/api/pilotage/planning", "/api/seances", "/api/live");
      fermer();
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const annuler = async () => {
    setEnvoi(true);
    try {
      await post(`/api/seances/${s.id}/annuler`, { motif });
      toast("Live annulé : les inscrits et les salles sont prévenus.");
      await rafraichir("/api/pilotage/planning", "/api/seances", "/api/live");
      fermer();
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Fenetre
      ouverte
      onFermer={fermer}
      titre={`${s.coursCode} · ${s.titre}`}
      description={`${dateEtHeure(s.debut)} · ${s.dureeMinutes} min`}
      pied={
        mode === "deplacer" ? (
          <>
            <Bouton variante="fantome" onClick={() => setMode("voir")}>
              Retour
            </Bouton>
            <Bouton onClick={deplacer} chargement={envoi} disabled={!date || !horaire}>
              Enregistrer le nouvel horaire
            </Bouton>
          </>
        ) : mode === "annuler" ? (
          <>
            <Bouton variante="fantome" onClick={() => setMode("voir")}>
              Retour
            </Bouton>
            <Bouton variante="danger" onClick={annuler} chargement={envoi} disabled={motif.trim().length < 3}>
              Annuler ce live
            </Bouton>
          </>
        ) : (
          <>
            {modifiable && (
              <Bouton variante="fantome" icone={<Ban className="h-4 w-4" />} onClick={() => setMode("annuler")}>
                Annuler
              </Bouton>
            )}
            {modifiable && (
              <Bouton variante="contour" onClick={() => setMode("deplacer")}>
                Déplacer
              </Bouton>
            )}
          </>
        )
      }
    >
      {mode === "voir" && (
        <div className="flex flex-col gap-4 pb-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
            <dt className="text-texte-pale">Formateur</dt>
            <dd className="font-semibold">{s.formateur ?? "À confirmer"}</dd>
            <dt className="text-texte-pale">À Paris</dt>
            <dd className="font-semibold">{heure(s.debut, "Europe/Paris")}</dd>
            <dt className="text-texte-pale">Salles</dt>
            <dd className="font-semibold">{s.sites.map((x) => x.nomCourt).join(", ") || "Aucune classe rattachée"}</dd>
            <dt className="text-texte-pale">Visio</dt>
            <dd className="font-semibold">{LIBELLES_FOURNISSEURS[s.fournisseur] ?? s.fournisseur}</dd>
            <dt className="text-texte-pale">Statut</dt>
            <dd>
              <Badge ton={s.statut === "annulee" ? "danger" : s.statut === "en_direct" ? "direct" : s.statut === "terminee" ? "gris" : "orange"}>
                {s.statut === "planifiee" ? "Programmé" : s.statut === "en_direct" ? "En direct" : s.statut === "terminee" ? "Terminé" : "Annulé"}
              </Badge>
            </dd>
          </dl>
          {s.conflits.length > 0 && (
            <p className="flex items-start gap-2 rounded-xl bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /> Conflit de salle : déplacez l'un des deux lives ou prévenez le formateur.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/live/${s.id}`} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-creme font-bold text-encre no-underline hover:bg-orange-clair hover:text-encre">
              <Radio className="h-4 w-4" /> Salle live
            </Link>
            <Link href={`/pilotage/presences?seance=${s.id}`} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-creme font-bold text-encre no-underline hover:bg-orange-clair hover:text-encre">
              <BarChart3 className="h-4 w-4" /> Présences
            </Link>
          </div>
          {!modifiable && s.statut === "planifiee" && <p className="text-sm text-texte-gris">L'heure est passée : cette séance ne peut plus être déplacée.</p>}
        </div>
      )}
      {mode === "deplacer" && (
        <div className="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3">
          <Champ libelle="Jour" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="col-span-2 sm:col-span-1" />
          <Champ libelle="Heure (Abidjan)" type="time" step={300} value={horaire} onChange={(e) => setHoraire(e.target.value)} />
          <Selection libelle="Durée" value={duree} onChange={(e) => setDuree(e.target.value)}>
            {[...new Set([...DUREES, s.dureeMinutes])].sort((a, b) => a - b).map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </Selection>
          <p className="col-span-2 text-sm text-texte-pale sm:col-span-3">Les étudiants inscrits reçoivent une notification avec le nouvel horaire.</p>
        </div>
      )}
      {mode === "annuler" && (
        <div className="pb-2">
          <ZoneTexte libelle="Motif (affiché aux étudiants et sur les écrans de salle)" value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} maxLength={300} placeholder="Le formateur a un empêchement ; la séance sera reprogrammée." />
        </div>
      )}
    </Fenetre>
  );
}
