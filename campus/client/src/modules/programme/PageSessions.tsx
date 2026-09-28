// /pilotage/programme : les sessions de l'emploi du temps. Une carte par
// session (titre, année, public, période, statut, créneaux, prochaine
// séance), « Nouvelle session », « Dupliquer » (mêmes créneaux, nouvelles
// dates : la deuxième session se prépare en deux minutes).
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Copy, Plus, Printer, TriangleAlert, ChevronRight } from "lucide-react";
import type { SessionResumeDto, SessionEditionDto } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Badge, Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Fenetre } from "@/components/ui/fenetre";
import { Champ } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { maintenantServeur } from "@/lib/horloge";
import { pluriel, cn } from "@/lib/utils";
import { SousNav } from "@/modules/pilotage/composants/SousNav";
import { FenetreReglages } from "./FenetreReglages";
import { LIBELLES_STATUT_SESSION, ajouterJours, ecartJours, heureAbidjan, isoJour, jourIso, libelleJour, periode, titreSuivant } from "./outils";

export default function PageSessions() {
  const { data, isLoading, error, refetch } = useQuery<SessionResumeDto[]>({ queryKey: ["/api/pilotage/programme/sessions"] });
  const [creation, setCreation] = useState(false);
  const [copie, setCopie] = useState<SessionResumeDto | null>(null);
  const [voirArchives, setVoirArchives] = useState(false);
  const [, naviguer] = useLocation();
  const aujourdhui = isoJour(new Date(maintenantServeur()));
  const liste = data ?? [];
  const groupes = [
    { cle: "courantes", titre: "En cours et à venir", sessions: liste.filter((s) => s.statut !== "archivee" && s.fin >= aujourdhui) },
    { cle: "terminees", titre: "Terminées", sessions: liste.filter((s) => s.statut !== "archivee" && s.fin < aujourdhui) },
  ];
  const archives = liste.filter((s) => s.statut === "archivee");

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette="Pilotage · Emploi du temps"
        titre="Emploi du temps"
        sousTitre="Saisissez les créneaux de chaque session et publiez : les séances du direct se créent toutes seules, étudiants et formateurs sont prévenus, le site public se met à jour."
        actions={
          <Bouton taille="lg" icone={<Plus className="h-5 w-5" />} onClick={() => setCreation(true)} className="min-h-[52px]">
            Nouvelle session
          </Bouton>
        }
      />

      {isLoading ? (
        <Chargement lignes={3} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => refetch()} />
      ) : !liste.length ? (
        <EtatVide
          icone={<CalendarRange className="h-6 w-6" />}
          titre="Aucun emploi du temps pour l'instant."
          texte="Créez la première session (par exemple « Première session », du lundi 28 septembre au samedi 10 octobre), ajoutez ses créneaux, puis publiez-la."
          action={<Bouton onClick={() => setCreation(true)}>Créer la première session</Bouton>}
        />
      ) : (
        <>
          {groupes
            .filter((g) => g.sessions.length)
            .map((g) => (
              <section key={g.cle} className="flex flex-col gap-3">
                <h2 className="text-xl font-extrabold">{g.titre}</h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  {g.sessions.map((s) => (
                    <CarteSession key={s.id} s={s} aujourdhui={aujourdhui} surDupliquer={() => setCopie(s)} />
                  ))}
                </div>
              </section>
            ))}
          {archives.length > 0 && (
            <section className="flex flex-col gap-3">
              <button type="button" onClick={() => setVoirArchives((v) => !v)} className="flex min-h-[44px] items-center gap-2 self-start text-lg font-extrabold text-texte-doux hover:text-encre" aria-expanded={voirArchives}>
                <ChevronRight className={cn("h-5 w-5 transition-transform", voirArchives && "rotate-90")} /> Archivées ({archives.length})
              </button>
              {voirArchives && (
                <div className="grid gap-3 lg:grid-cols-2">
                  {archives.map((s) => (
                    <CarteSession key={s.id} s={s} aujourdhui={aujourdhui} surDupliquer={() => setCopie(s)} />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {creation && (
        <FenetreReglages
          onFermer={() => setCreation(false)}
          surEnregistre={(s) => {
            setCreation(false);
            void rafraichir("/api/pilotage/programme");
            naviguer(`/pilotage/programme/${s.id}`);
          }}
        />
      )}
      {copie && <FenetreDupliquer source={copie} onFermer={() => setCopie(null)} surCree={(id) => naviguer(`/pilotage/programme/${id}`)} />}
    </Page>
  );
}

function CarteSession({ s, aujourdhui, surDupliquer }: { s: SessionResumeDto; aujourdhui: string; surDupliquer: () => void }) {
  const enCours = s.debut <= aujourdhui && s.fin >= aujourdhui && s.statut === "publiee";
  return (
    <article className={cn("flex flex-col gap-4 rounded-2xl border bg-white p-5", s.aRepercuter ? "border-alerte" : "border-ligne")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-xs text-texte-gris">Année académique {s.anneeAcademique}</span>
          <Link href={`/pilotage/programme/${s.id}`} className="text-2xl font-black tracking-serre text-encre no-underline hover:text-orange-fonce">
            {s.titre}
          </Link>
          {s.public && <span className="text-[15px] font-semibold text-texte-doux">{s.public}</span>}
          <span className="text-[15px] text-texte-pale">{periode(s.debut, s.fin)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge ton={s.statut === "publiee" ? "succes" : s.statut === "archivee" ? "gris" : "alerte"}>{LIBELLES_STATUT_SESSION[s.statut]}</Badge>
          {enCours && <Badge ton="orange">En cours</Badge>}
        </div>
      </div>
      {s.aRepercuter && (
        <p className="flex items-start gap-2 rounded-xl bg-alerte-clair px-3 py-2 text-sm font-semibold text-alerte">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> Modifiée depuis la publication : pensez à mettre à jour les séances.
        </p>
      )}
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-creme px-2 py-2.5">
          <dt className="font-mono text-[11px] uppercase text-texte-gris">Créneaux</dt>
          <dd className="text-xl font-black">{s.nbCreneaux}</dd>
        </div>
        <div className="rounded-xl bg-creme px-2 py-2.5">
          <dt className="font-mono text-[11px] uppercase text-texte-gris">Classes</dt>
          <dd className="text-xl font-black">{s.nbClasses}</dd>
        </div>
        <div className="rounded-xl bg-creme px-2 py-2.5">
          <dt className="font-mono text-[11px] uppercase text-texte-gris">Séances</dt>
          <dd className="text-xl font-black">{s.nbSeances}</dd>
        </div>
      </dl>
      {s.prochaine && (
        <p className="text-[15px] text-texte-doux">
          <span className="font-mono text-xs uppercase text-texte-gris">Prochain · </span>
          <strong className="text-encre">{s.prochaine.libelle}</strong>, {libelleJour(s.prochaine.date)} à {heureAbidjan(s.prochaine.debut)}
          {s.prochaine.intervenant ? ` · ${s.prochaine.intervenant}` : ""}
        </p>
      )}
      <div className="mt-auto flex flex-wrap gap-2">
        <LienBouton href={`/pilotage/programme/${s.id}`} className="min-h-[48px]">
          {s.modifiable && s.statut !== "archivee" ? "Ouvrir l'éditeur" : "Consulter"}
        </LienBouton>
        <Bouton variante="contour" icone={<Copy className="h-4 w-4" />} onClick={surDupliquer} className="min-h-[48px]">
          Dupliquer
        </Bouton>
        <LienBouton href={`/pilotage/programme/${s.id}/imprimer`} variante="fantome" icone={<Printer className="h-4 w-4" />} className="min-h-[48px]">
          Imprimer
        </LienBouton>
      </div>
    </article>
  );
}

/** Dupliquer : mêmes créneaux et mêmes classes, nouvelles dates (proposées juste après la session copiée). */
export function FenetreDupliquer({ source, onFermer, surCree }: { source: Pick<SessionResumeDto, "id" | "titre" | "debut" | "fin" | "anneeAcademique" | "nbCreneaux">; onFermer: () => void; surCree: (id: number) => void }) {
  const lendemain = ajouterJours(source.fin, 1);
  const lundi = ajouterJours(lendemain, (8 - jourIso(lendemain)) % 7);
  const [titre, setTitre] = useState(titreSuivant(source.titre));
  const [debut, setDebut] = useState(lundi);
  const [fin, setFin] = useState(ajouterJours(lundi, ecartJours(source.debut, source.fin)));
  const [envoi, setEnvoi] = useState(false);
  const valider = async () => {
    setEnvoi(true);
    try {
      const s = await post<SessionEditionDto>(`/api/pilotage/programme/sessions/${source.id}/dupliquer`, { titre, debut, fin });
      toast(`« ${s.titre} » est prête : vérifiez-la, puis publiez-la.`);
      void rafraichir("/api/pilotage/programme");
      surCree(s.id);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      titre="Dupliquer la session"
      description={`Les ${pluriel(source.nbCreneaux, "créneau", "créneaux")} et les classes de « ${source.titre} » sont repris. La copie reste en brouillon tant que vous ne la publiez pas.`}
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton onClick={valider} chargement={envoi} disabled={!titre.trim() || !debut || !fin || fin < debut}>
            Créer la copie
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Champ libelle="Titre de la nouvelle session" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={120} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle="Premier jour"
            type="date"
            value={debut}
            onChange={(e) => {
              const v = e.target.value;
              setDebut(v);
              if (v) setFin(ajouterJours(v, ecartJours(source.debut, source.fin)));
            }}
          />
          <Champ libelle="Dernier jour" type="date" value={fin} min={debut} onChange={(e) => setFin(e.target.value)} erreur={fin && debut && fin < debut ? "Le dernier jour doit venir après le premier." : undefined} />
        </div>
        {debut && fin && fin >= debut && <p className="text-sm text-texte-pale">{periode(debut, fin)}.</p>}
      </div>
    </Fenetre>
  );
}
