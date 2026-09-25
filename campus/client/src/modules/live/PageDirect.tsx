// /direct — l'onglet « Live ». Un live en cours : on y entre directement.
// Sinon : le prochain live avec son compte à rebours, « Ajouter à mon
// agenda », puis « Déjà passés » (replays). Le formateur y retrouve ses
// prochaines séances et « Nouvelle séance » ; l'équipe, les lives du jour.
import { useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Radio, Plus, PlayCircle, CalendarPlus } from "lucide-react";
import { useMoiConnecte, estEquipe } from "@/lib/auth";
import { dateEtHeure, heureDouble } from "@/lib/dates";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte, TitreSection } from "@/components/ui/carte";
import { Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { Selection } from "@/components/ui/champs";
import { CompteARebours, DecompteCourt, useMaintenant } from "@/components/ui/compte-a-rebours";
import { LigneSeance } from "./ui";
import type { EnCours, SeanceResume } from "@shared/api";

type CoursResume = { id: number; code: string; titre: string };

export default function PageDirect() {
  const moi = useMoiConnecte();
  const { data: enCours, isLoading } = useQuery<EnCours>({ queryKey: ["/api/live/en-cours"], refetchInterval: 30_000 });
  const avenir = useQuery<SeanceResume[]>({ queryKey: ["/api/seances?periode=avenir&limite=20"] });
  const passees = useQuery<SeanceResume[]>({ queryKey: ["/api/seances?periode=passees&limite=12"] });
  const [choixCours, setChoixCours] = useState(false);

  if (moi.role === "salle") return <Redirect to="/salle" replace />;
  if (enCours?.enDirect && !estEquipe(moi.role)) return <Redirect to={`/live/${enCours.enDirect.id}`} replace />;

  const enseignant = moi.role === "formateur" || estEquipe(moi.role);
  const prochaine = enCours?.prochaine ?? null;
  const suivantes = (avenir.data ?? []).filter((s) => s.id !== prochaine?.id);

  return (
    <Page>
      <EnTetePage
        etiquette={moi.role === "formateur" ? "Studio · classe en direct" : "Classe en direct · 5 campus"}
        titre={moi.role === "formateur" ? "Vos lives" : estEquipe(moi.role) ? "Les lives du campus" : "Live"}
        sousTitre={
          moi.role === "etudiant"
            ? "Suis le cours depuis ta salle de conférence, ton téléphone ou ton ordinateur."
            : "Un cours, cinq salles de conférence et les étudiants en ligne, en même temps."
        }
        actions={
          moi.role === "formateur" || estEquipe(moi.role) ? (
            <Bouton icone={<Plus className="h-4 w-4" />} onClick={() => setChoixCours(true)}>
              Nouvelle séance
            </Bouton>
          ) : undefined
        }
      />

      {isLoading ? (
        <Chargement lignes={2} />
      ) : enCours?.enDirect ? (
        <CarteDirect s={enCours.enDirect} />
      ) : prochaine ? (
        <CarteProchaine s={prochaine} enseignant={enseignant} />
      ) : (
        <EtatVide
          icone={<Radio className="h-6 w-6" />}
          titre="Aucun live prévu pour l'instant."
          texte={
            moi.role === "formateur"
              ? "Créez votre prochaine séance : les étudiants des cinq campus seront prévenus 24 h et 15 min avant."
              : "Dès qu'un formateur programme un live dans l'un de tes cours, il apparaît ici avec un compte à rebours. Tu reçois aussi un rappel la veille."
          }
          action={moi.role === "formateur" ? <Bouton onClick={() => setChoixCours(true)}>Préparer une séance</Bouton> : <LienBouton href="/cours" variante="contour">Voir mes cours</LienBouton>}
        />
      )}

      {/* grid-cols-1 (minmax(0, 1fr)) et min-w-0 : un titre de séance très long se tronque au lieu d'élargir la page. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="min-w-0">
          <TitreSection titre={enseignant ? "Prochaines séances" : "À venir"} />
          {avenir.error ? (
            <Erreur message={(avenir.error as Error).message} reessayer={() => void avenir.refetch()} />
          ) : !suivantes.length ? (
            <p className="rounded-2xl bg-creme p-5 text-[15px] text-texte-pale">Rien d'autre de programmé pour le moment.</p>
          ) : (
            <div>
              {suivantes.map((s) => (
                <LigneSeance key={s.id} s={s} enseignant={enseignant} />
              ))}
            </div>
          )}
        </section>
        <section className="min-w-0">
          <TitreSection titre="Déjà passés" />
          {passees.error ? (
            <Erreur message={(passees.error as Error).message} reessayer={() => void passees.refetch()} />
          ) : !passees.data?.length ? (
            <p className="rounded-2xl bg-creme p-5 text-[15px] text-texte-pale">
              Les replays de tes lives apparaîtront ici : vidéo, transcription et fiche de révision, avec leur poids affiché avant de les charger.
            </p>
          ) : (
            <div className="flex min-w-0 flex-col gap-3 rounded-[20px] bg-encre p-5 text-white">
              <span className="font-mono text-xs text-orange-peche">Replays récents</span>
              {passees.data.map((s) => (
                <LienBouton key={s.id} href={`/replays/${s.id}`} variante="encre" className="w-full min-w-0 justify-start gap-3.5 overflow-hidden bg-transparent px-0 py-1.5 text-left hover:bg-transparent hover:text-orange-peche">
                  <span className="grid h-12 w-[76px] shrink-0 place-items-center rounded-[10px] bg-nuit-ligne font-mono text-[11px] text-orange">
                    {s.replayDisponible ? <PlayCircle className="h-5 w-5" /> : `${s.dureeMinutes} min`}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] font-bold">{s.titre}</span>
                    <span className="truncate text-[12px] font-normal text-nuit-gris">
                      {s.coursCode} · {dateEtHeure(s.debut).split(" · ")[0]}
                    </span>
                  </span>
                </LienBouton>
              ))}
            </div>
          )}
        </section>
      </div>
      <ChoixCoursNouvelleSeance ouverte={choixCours} onFermer={() => setChoixCours(false)} />
    </Page>
  );
}

function CarteDirect({ s }: { s: SeanceResume }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-5 rounded-[24px] bg-encre p-6 text-white sm:p-7">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#FF8A6B]">
          <span className="point-direct" /> En direct maintenant
        </span>
        <span className="break-words text-2xl font-extrabold tracking-[-0.02em]">{s.titre}</span>
        <span className="text-[15px] text-nuit-doux">
          {s.coursCode} · {s.formateur ? `${s.formateur.prenom} ${s.formateur.nom}` : "Formateur"}
        </span>
      </div>
      <LienBouton href={`/live/${s.id}`} taille="lg">
        Observer le live
      </LienBouton>
    </div>
  );
}

function CarteProchaine({ s, enseignant }: { s: SeanceResume; enseignant: boolean }) {
  const ville = s.formateur?.localisation?.split(",")[0];
  const maintenant = useMaintenant(15_000);
  const bientot = new Date(s.debut).getTime() - maintenant < 30 * 60_000;
  const passe = new Date(s.debut).getTime() <= maintenant;
  return (
    <div className="grid gap-6 rounded-[28px] bg-encre p-6 text-white sm:p-8 lg:grid-cols-[1fr_380px] lg:items-center">
      <div className="flex min-w-0 flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-orange-peche">
          {passe ? "C'est l'heure · en attente du formateur" : <>Prochain live · dans <DecompteCourt cible={s.debut} /></>}
        </span>
        <span className="break-words text-[28px] font-black leading-tight tracking-serre sm:text-[34px]">{s.titre}</span>
        <span className="text-[15px] text-nuit-doux">
          {s.coursCode} · {s.coursTitre}
        </span>
        <span className="text-[15px] text-nuit-doux">
          {enseignant ? `${dateEtHeure(s.debut).split(" · ")[0]} · ${heureDouble(s.debut)}` : dateEtHeure(s.debut).replace(/ · [^·]*Paris$/, "")} · {s.dureeMinutes} min
          {s.formateur ? ` · ${s.formateur.prenom} ${s.formateur.nom}${ville ? ` depuis ${ville}` : ""}` : ""}
        </span>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <LienBouton href={enseignant ? `/enseigner/seances/${s.id}` : `/live/${s.id}`} taille="lg">
            {enseignant ? "Préparer la séance" : bientot ? "Entrer dans la classe" : "Voir la classe"}
          </LienBouton>
          {enseignant ? (
            <LienBouton href={`/live/${s.id}`} variante="nuit" taille="lg">
              Ouvrir le studio
            </LienBouton>
          ) : (
            <a
              href={`/api/agenda/seances/${s.id}.ics`}
              className="inline-flex items-center gap-2 rounded-[14px] border-[1.5px] border-white px-6 py-4 text-base font-bold text-white no-underline hover:bg-white hover:text-encre"
            >
              <CalendarPlus className="h-5 w-5" /> Ajouter à mon agenda
            </a>
          )}
        </div>
      </div>
      {passe ? (
        <p className="rounded-[18px] bg-nuit-carte p-5 text-[15px] leading-relaxed text-nuit-doux">La classe s'ouvre dès que le formateur démarre le direct. Tu recevras une notification.</p>
      ) : (
        <CompteARebours cible={s.debut} />
      )}
    </div>
  );
}

/** « Nouvelle séance » : choisir le cours (formateur : ses cours ; équipe : tous). */
function ChoixCoursNouvelleSeance({ ouverte, onFermer }: { ouverte: boolean; onFermer: () => void }) {
  const [, naviguer] = useLocation();
  const { data: liste } = useQuery<CoursResume[]>({ queryKey: ["/api/cours"], enabled: ouverte, retry: false });
  const { data: seances } = useQuery<SeanceResume[]>({ queryKey: ["/api/seances?limite=100"], enabled: ouverte });
  const [coursId, setCoursId] = useState("");
  // Cours que la personne peut programmer (module « cours » : « enseignant ») ; à défaut
  // de cette liste, ceux des séances déjà connues.
  const parId = new Map<number, CoursResume>();
  if (Array.isArray(liste)) {
    for (const c of liste as (CoursResume & { enseignant?: boolean })[]) if (c?.id && c.enseignant !== false) parId.set(c.id, { id: c.id, code: c.code, titre: c.titre });
  } else {
    for (const s of seances ?? []) if (!parId.has(s.coursId)) parId.set(s.coursId, { id: s.coursId, code: s.coursCode, titre: s.coursTitre });
  }
  const cours = [...parId.values()];
  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Nouvelle séance"
      description="Pour quel cours ?"
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton disabled={!coursId} onClick={() => naviguer(`/enseigner/seances/nouvelle?cours=${coursId}`)}>
            Continuer
          </Bouton>
        </>
      }
    >
      {cours.length ? (
        <Selection libelle="Cours" value={coursId} onChange={(e) => setCoursId(e.target.value)}>
          <option value="">Choisir un cours…</option>
          {cours.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.titre}
            </option>
          ))}
        </Selection>
      ) : (
        <Carte className="bg-creme text-[15px] text-texte-pale">Aucun cours à votre nom pour le moment. Demandez à la direction des études de vous rattacher à un cours.</Carte>
      )}
    </Fenetre>
  );
}
