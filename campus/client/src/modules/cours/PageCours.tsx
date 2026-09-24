// Page d'un cours : en-tête coloré puis onglets Leçons · Séances · Devoirs ·
// Questions du cours · À propos. L'étudiant reprend où il en était ; le
// formateur modifie son cours.
import { useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, CheckCircle2, MapPin, MessageCircle, PenLine, RotateCcw, Target, Users } from "lucide-react";
import { Page } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Avatar, Chargement, EtatVide, Erreur, Badge } from "@/components/ui/divers";
import { Onglets } from "@/components/ui/onglets";
import { Markdown } from "@/components/ui/markdown";
import { useMoiConnecte } from "@/lib/auth";
import { ErreurApi } from "@/lib/api";
import { dateComplete } from "@/lib/dates";
import { pluriel } from "@/lib/utils";
import { SeancesDuCours } from "@/modules/live/SeancesDuCours";
import { DevoirsDuCours } from "@/modules/evaluations/DevoirsDuCours";
import { EnTeteCours } from "./composants/EnTeteCours";
import { ProgrammeLecons } from "./composants/ProgrammeLecons";
import { classeSansSite, listeObjectifs, texteSur, typographie } from "./outils";
import type { CoursDetail } from "@shared/schema";

type Onglet = "lecons" | "seances" | "devoirs" | "questions" | "apropos";
const ONGLETS: Onglet[] = ["lecons", "seances", "devoirs", "questions", "apropos"];

export default function PageCours({ id }: { id: string }) {
  const moi = useMoiConnecte();
  const etudiant = moi.role === "etudiant";
  const coursId = Number(id);
  const { data: cours, isLoading, error, refetch } = useQuery<CoursDetail>({ queryKey: ["/api/cours", coursId], enabled: Number.isInteger(coursId) });

  const recherche = useSearch();
  const [chemin, naviguer] = useLocation();
  const demande = new URLSearchParams(recherche).get("onglet") as Onglet | null;
  const onglet: Onglet = demande && ONGLETS.includes(demande) ? demande : "lecons";
  const changerOnglet = (o: Onglet) => naviguer(o === "lecons" ? chemin : `${chemin}?onglet=${o}`, { replace: true });

  // Sur téléphone, l'onglet choisi (même arrivé par un lien) reste visible dans la bande.
  const bandeOnglets = useRef<HTMLDivElement>(null);
  const charge = Boolean(cours);
  useEffect(() => {
    if (onglet === "lecons") return; // premier onglet : toujours visible
    const actif = bandeOnglets.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    actif?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [onglet, charge]);

  if (isLoading) {
    return (
      <Page>
        <div className="h-64 animate-pulse rounded-[24px] bg-creme" />
        <Chargement lignes={4} />
      </Page>
    );
  }
  if (error || !cours) {
    const statut = error instanceof ErreurApi ? error.statut : 0;
    return (
      <Page>
        {statut === 403 || statut === 404 ? (
          <EtatVide
            icone={<BookOpen className="h-6 w-6" />}
            titre={statut === 404 ? "Ce cours n'existe pas (ou plus)." : etudiant ? "Tu n'es pas inscrit à ce cours." : "Ce cours ne vous est pas accessible."}
            texte={etudiant ? "Retrouve tous tes cours dans l'onglet Cours. Si un cours manque, préviens la vie scolaire de ton campus." : "Retrouvez vos cours dans « Mes cours »."}
            action={
              <LienBouton href="/cours" variante="contour" icone={<ArrowLeft className="h-4 w-4" />} className="min-h-[48px]">
                {etudiant ? "Mes cours" : "Retour aux cours"}
              </LienBouton>
            }
          />
        ) : (
          <Erreur message={(error as Error)?.message ?? "Cours introuvable."} reessayer={() => void refetch()} />
        )}
      </Page>
    );
  }

  const clair = texteSur(cours.couleur) === "encre";
  const bouton = clair ? "encre" : "contour";
  const nbLecons = cours.chapitres.reduce((n, ch) => n + ch.lecons.length, 0);

  // Une seule action dans l'en-tête.
  let action = null;
  if (cours.enseignant) {
    action = (
      <LienBouton href={`/enseigner/cours/${cours.id}`} variante={bouton} taille="lg" icone={<PenLine className="h-5 w-5" />}>
        Modifier le cours
      </LienBouton>
    );
  } else if (etudiant && cours.reprendre) {
    action = (
      <LienBouton
        href={`/cours/${cours.id}/lecons/${cours.reprendre.leconId}`}
        variante={bouton}
        taille="lg"
        icone={<ArrowRight className="h-5 w-5 shrink-0" />}
        className="min-h-[56px] w-full justify-start text-left sm:w-auto"
      >
        {cours.reprendre.commence ? (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="font-mono text-[11px] font-normal uppercase tracking-wider opacity-75">Reprendre · leçon {cours.reprendre.numero}</span>
            <span className="line-clamp-2">{cours.reprendre.titre}</span>
          </span>
        ) : (
          "Commencer le cours"
        )}
      </LienBouton>
    );
  } else if (etudiant && cours.progression && cours.progression.total > 0) {
    const premiere = cours.chapitres[0]?.lecons[0];
    action = (
      <span className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-2 text-base font-bold ${clair ? "text-encre" : "text-white"}`}>
          <CheckCircle2 className="h-5 w-5" /> Bravo, tu as terminé toutes les leçons.
        </span>
        {premiere && (
          <LienBouton href={`/cours/${cours.id}/lecons/${premiere.id}`} variante={bouton} icone={<RotateCcw className="h-4 w-4" />}>
            Revoir depuis le début
          </LienBouton>
        )}
      </span>
    );
  }

  return (
    <Page>
      <LienBouton href="/cours" variante="fantome" taille="sm" icone={<ArrowLeft className="h-4 w-4" />} className="-mb-3 -ml-2 self-start">
        {etudiant ? "Mes cours" : "Cours"}
      </LienBouton>

      <EnTeteCours cours={cours} action={action} etudiant={etudiant} />

      {/* Sur téléphone, les onglets défilent : un fondu à droite l'indique. */}
      <div ref={bandeOnglets} className="relative after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-10 after:bg-gradient-to-l after:from-creme after:to-transparent sm:after:hidden -mx-4 sm:mx-0">
      <Onglets<Onglet>
        valeur={onglet}
        onChange={changerOnglet}
        options={[
          { valeur: "lecons", libelle: "Leçons", compteur: nbLecons || undefined },
          { valeur: "seances", libelle: "Séances" },
          { valeur: "devoirs", libelle: "Devoirs" },
          { valeur: "questions", libelle: "Questions du cours" },
          { valeur: "apropos", libelle: "À propos" },
        ]}
        className="rounded-none px-4 pr-10 sm:rounded-2xl sm:px-1.5 [&>button]:min-h-[44px]"
      />
      </div>

      <div role="tabpanel">
        {onglet === "lecons" &&
          (cours.chapitres.length ? (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <ProgrammeLecons coursId={cours.id} chapitres={cours.chapitres} reprendreId={cours.reprendre?.leconId ?? null} etudiant={etudiant} />
              <AsideLecons cours={cours} etudiant={etudiant} onQuestions={() => changerOnglet("questions")} />
            </div>
          ) : cours.enseignant ? (
            <EtatVide
              icone={<BookOpen className="h-6 w-6" />}
              titre="Aucune leçon pour l'instant"
              texte="Organisez le cours en chapitres, écrivez vos leçons (texte, vidéo, PDF, lien) et publiez-les quand elles sont prêtes."
              action={
                <LienBouton href={`/enseigner/cours/${cours.id}#programme`} icone={<PenLine className="h-4 w-4" />} className="min-h-[48px]">
                  Ajouter des leçons
                </LienBouton>
              }
            />
          ) : (
            <EtatVide
              icone={<BookOpen className="h-6 w-6" />}
              titre="Les leçons arrivent"
              texte={`${cours.formateur ? `${cours.formateur.prenom} ${cours.formateur.nom} prépare` : "Ton formateur prépare"} les leçons de ce cours. Tu recevras une notification dès qu'une leçon sera publiée.`}
            />
          ))}

        {onglet === "seances" && <SeancesDuCours coursId={cours.id} enseignant={cours.enseignant} />}

        {onglet === "devoirs" && <DevoirsDuCours coursId={cours.id} enseignant={cours.enseignant} />}

        {onglet === "questions" && <OngletQuestions cours={cours} etudiant={etudiant} />}

        {onglet === "apropos" && <OngletAPropos cours={cours} />}
      </div>
    </Page>
  );
}

/** Colonne de droite sur ordinateur : objectifs et questions, sans quitter les leçons. */
function AsideLecons({ cours, etudiant, onQuestions }: { cours: CoursDetail; etudiant: boolean; onQuestions: () => void }) {
  const objectifs = listeObjectifs(cours.objectifs);
  return (
    <aside className="hidden flex-col gap-4 lg:sticky lg:top-24 lg:flex">
      {objectifs.length > 0 && (
        <Carte>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
            <Target className="h-5 w-5 text-orange-fonce" /> {etudiant ? "À la fin, tu sauras" : "Objectifs du cours"}
          </h2>
          <ul className="flex flex-col gap-2">
            {objectifs.map((o) => (
              <li key={o} className="flex items-start gap-2.5 text-[15px] text-texte-doux">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-succes" />
                {o}
              </li>
            ))}
          </ul>
        </Carte>
      )}
      <Carte className="flex flex-col gap-3 bg-creme">
        <span className="inline-flex items-center gap-2 text-lg font-extrabold">
          <MessageCircle className="h-5 w-5 text-orange-fonce" /> {etudiant ? "Une question ?" : "Questions des étudiants"}
        </span>
        <p className="text-[15px] text-texte-doux">
          {etudiant ? "Pose-la dans les questions du cours : le formateur et les autres campus te répondent." : "Retrouvez les questions posées par les étudiants de tous les campus."}
        </p>
        <button type="button" onClick={onQuestions} className="self-start text-[15px] font-bold text-orange-fonce underline underline-offset-2 hover:text-encre">
          Questions du cours →
        </button>
      </Carte>
    </aside>
  );
}

function OngletQuestions({ cours, etudiant }: { cours: CoursDetail; etudiant: boolean }) {
  const f = cours.formateur;
  const nbCampus = cours.sites.length;
  return (
    <Carte className="flex flex-col gap-4 bg-creme sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-orange text-encre">
          <MessageCircle className="h-6 w-6" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-extrabold">Questions du cours</h2>
          <p className="max-w-xl text-base text-texte-doux">
            {etudiant
              ? `Pose ta question à ${f ? `${f.prenom} ${f.nom}` : "ton formateur"}${nbCampus > 1 ? ` et aux étudiants des ${nbCampus} campus` : ""}. Tout le monde voit la réponse : ta question aide aussi les autres.`
              : "Répondez aux questions des étudiants de tous les campus. Vous pouvez masquer un message ou répondre à tous d'un coup."}
          </p>
        </div>
      </div>
      <LienBouton href={`/messages/cours/${cours.id}`} icone={<MessageCircle className="h-5 w-5" />} className="min-h-[48px] shrink-0">
        {etudiant ? "Poser une question" : "Ouvrir les questions"}
      </LienBouton>
    </Carte>
  );
}

function OngletAPropos({ cours }: { cours: CoursDetail }) {
  const objectifs = listeObjectifs(cours.objectifs);
  const formateurs = [...(cours.formateur ? [cours.formateur] : []), ...cours.coFormateurs];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-5">
        {cours.description ? (
          <Carte>
            <h2 className="mb-1 text-xl font-extrabold">Le cours</h2>
            <Markdown source={typographie(cours.description)} className="text-base" />
          </Carte>
        ) : null}
        <Carte>
          <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold">
            <Target className="h-5 w-5 text-orange-fonce" /> À la fin, tu sauras
          </h2>
          {objectifs.length ? (
            <ul className="flex flex-col gap-2.5">
              {objectifs.map((o) => (
                <li key={o} className="flex items-start gap-3 text-base text-texte-doux">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-succes" />
                  {o}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-texte-pale">Le formateur n'a pas encore détaillé les objectifs de ce cours.</p>
          )}
        </Carte>
        {(cours.dateDebut || cours.dateFin) && (
          <Carte className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" />
            <p className="text-base text-texte-doux">
              {cours.dateDebut && <>Début : {dateComplete(cours.dateDebut)}</>}
              {cours.dateDebut && cours.dateFin && <br />}
              {cours.dateFin && <>Fin : {dateComplete(cours.dateFin)}</>}
            </p>
          </Carte>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {formateurs.map((f) => (
          <Carte key={f.id} className="flex items-center gap-4">
            <Avatar prenom={f.prenom} nom={f.nom} photo={f.photoUrl} taille={56} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-texte-gris">{f.id === cours.formateur?.id ? "Formateur" : "Co-formateur"}</span>
              <span className="text-lg font-extrabold leading-tight">
                {f.prenom} {f.nom}
              </span>
              {f.titre && <span className="text-sm text-texte-pale">{f.titre}</span>}
              {f.localisation && (
                <span className="inline-flex items-center gap-1 text-sm text-texte-pale">
                  <MapPin className="h-3.5 w-3.5" /> Enseigne depuis {f.localisation}
                </span>
              )}
            </div>
          </Carte>
        ))}

        <Carte>
          <h2 className="mb-3 text-lg font-extrabold">Campus concernés</h2>
          {cours.sites.length ? (
            <ul className="flex flex-col gap-2">
              {cours.sites.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-creme px-4 py-3">
                  <span className="font-bold">{s.nomCourt}</span>
                  <span className="text-right text-sm text-texte-pale">{s.salleConference}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-texte-pale">Aucune classe n'est encore inscrite à ce cours.</p>
          )}
          {cours.enseignant && cours.classes.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 border-t border-ligne-douce pt-4">
              <span className="inline-flex items-center gap-2 text-sm font-bold">
                <Users className="h-4 w-4" /> {pluriel(cours.classes.length, "classe")}
                {cours.nbEtudiants !== null && ` · ${pluriel(cours.nbEtudiants, "étudiant")}`}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {cours.classes.map((cl) => (
                  <Badge key={cl.id} ton="gris">
                    {classeSansSite(cl.nom, cl.site)} · {cl.site}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Carte>
      </div>
    </div>
  );
}
