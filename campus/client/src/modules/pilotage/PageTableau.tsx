// /pilotage : le tableau de la vie scolaire et de la direction. Les grands
// chiffres du périmètre, chaque campus d'un coup d'œil, puis les étudiants à
// contacter aujourd'hui et les raccourcis du quotidien.
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Printer, CalendarClock, BarChart3, Globe, Sparkles, ArrowRight, PartyPopper } from "lucide-react";
import type { TableauPilotage, ListeAContacter, IndicateursCampus } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Chiffre, BarreProgression, Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { LienBouton } from "@/components/ui/bouton";
import { CarteLien, TitreSection } from "@/components/ui/carte";
import { useMoiConnecte } from "@/lib/auth";
import { salutation } from "@/lib/dates";
import { maintenantServeur } from "@/lib/horloge";
import { cn, pluriel } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { LigneAContacter } from "./composants/LigneAContacter";
import { FenetreSuivi } from "./composants/FenetreSuivi";
import { pourcent } from "./outils";

export default function PageTableau() {
  const moi = useMoiConnecte();
  const tableau = useQuery<TableauPilotage>({ queryKey: ["/api/pilotage/tableau"] });
  const aContacter = useQuery<ListeAContacter>({ queryKey: ["/api/pilotage/a-contacter"] });
  const [suivi, setSuivi] = useState<{ id: number; prenom: string; nom: string } | null>(null);
  const t = tableau.data;
  const nb = aContacter.data?.total ?? t?.total.aContacter ?? 0;

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette={t ? `Pilotage · ${t.perimetre.tout ? "Tout le groupe" : `Campus ${t.perimetre.site ?? ""}`}` : "Pilotage"}
        titre={`${salutation(new Date(maintenantServeur()))} ${moi.prenom}.`}
        sousTitre="Où en sont nos étudiants ? Chiffres des 30 derniers jours, recalculés à chaque visite."
        actions={
          nb > 0 ? (
            <LienBouton href="/pilotage/suivi" taille="lg" icone={<ArrowRight className="h-5 w-5" />} className="min-h-[52px]">
              Contacter {pluriel(nb, "étudiant")}
            </LienBouton>
          ) : undefined
        }
      />

      {tableau.isLoading && <Chargement lignes={2} />}
      {tableau.error && <Erreur message={(tableau.error as Error).message} reessayer={() => tableau.refetch()} />}

      {t && (
        <>
          <section aria-label="Chiffres clés" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Chiffre libelle="Étudiants" valeur={t.total.etudiants} detail={t.perimetre.tout ? "dans les 5 campus" : `au campus ${t.perimetre.site ?? ""}`} />
            <Chiffre
              libelle="Comptes activés"
              valeur={pourcent(t.total.tauxActivation)}
              detail={`${t.total.actives} sur ${t.total.etudiants}`}
              ton={t.total.tauxActivation !== null && t.total.tauxActivation < 70 ? "orange" : "encre"}
            />
            <Chiffre libelle="Vus cette semaine" valeur={t.total.actifs7j} detail="venus sur le campus en 7 jours" />
            <Chiffre libelle="Présence aux lives" valeur={pourcent(t.total.presence30j)} detail="en salle ou en ligne" />
            <Chiffre libelle="Devoirs rendus" valeur={pourcent(t.total.devoirsRendus)} detail="devoirs échus ce mois" />
            <Chiffre libelle="À contacter" valeur={t.total.aContacter} ton={t.total.aContacter ? "danger" : "succes"} detail={t.total.aContacter ? "voir la liste ci-dessous" : "personne pour l'instant"} />
          </section>

          {t.campus.length > 1 && (
            <section>
              <TitreSection titre="Campus par campus" />
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {t.campus.map((c) => (
                  <CarteCampus key={c.siteId} c={c} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section>
        <TitreSection
          titre="À contacter aujourd'hui"
          action={
            nb > 4 ? (
              <Link href="/pilotage/suivi" className="text-sm font-bold">
                Voir les {nb}
              </Link>
            ) : undefined
          }
        />
        {aContacter.isLoading ? (
          <Chargement lignes={2} />
        ) : aContacter.error ? (
          <Erreur message={(aContacter.error as Error).message} reessayer={() => aContacter.refetch()} />
        ) : !aContacter.data?.lignes.length ? (
          <EtatVide
            icone={<PartyPopper className="h-6 w-6" />}
            titre="Personne à relancer pour l'instant."
            texte="Un étudiant apparaîtra ici s'il n'a pas activé son compte après 7 jours, n'est plus venu depuis 7 jours, a manqué deux lives d'affilée ou n'a pas rendu un devoir."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {aContacter.data.lignes.slice(0, 4).map((l) => (
              <LigneAContacter key={l.etudiant.id} ligne={l} onSuivi={setSuivi} compacte />
            ))}
          </ul>
        )}
      </section>

      <section>
        <TitreSection titre="Raccourcis" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Raccourci href="/pilotage/comptes/import" icone={<FileSpreadsheet className="h-5 w-5" />} titre="Importer des étudiants" texte="Coller depuis Excel" />
          <Raccourci href="/pilotage/comptes?etat=non_actives&role=etudiant" icone={<Printer className="h-5 w-5" />} titre="Fiches de connexion" texte="Pour les non-activés" />
          <Raccourci href="/pilotage/planning" icone={<CalendarClock className="h-5 w-5" />} titre="Planning" texte="Lives de la semaine" />
          <Raccourci href="/pilotage/presences" icone={<BarChart3 className="h-5 w-5" />} titre="Présences" texte="Par séance, export" />
          <Raccourci href="/pilotage/site" icone={<Globe className="h-5 w-5" />} titre="Site 2iae.com" texte="Publié et proposé" />
          <Raccourci href="/pilotage/ia" icone={<Sparkles className="h-5 w-5" />} titre="Budget IA" texte="Consommation 30 jours" />
        </div>
      </section>

      <FenetreSuivi etudiant={suivi} onFermer={() => setSuivi(null)} />
    </Page>
  );
}

function Indicateur({ libelle, valeur }: { libelle: string; valeur: number | null }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-texte-pale">{libelle}</span>
        <span className="font-bold tabular-nums">{pourcent(valeur)}</span>
      </div>
      <BarreProgression valeur={valeur ?? 0} className="mt-1.5" ton={valeur !== null && valeur >= 80 ? "succes" : "orange"} />
    </div>
  );
}

function CarteCampus({ c }: { c: IndicateursCampus }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-extrabold">{c.nom}</h3>
        {c.etudiants > 0 && <span className="whitespace-nowrap font-mono text-xs text-texte-gris">{pluriel(c.etudiants, "étudiant")}</span>}
      </div>
      {c.etudiants === 0 ? (
        <p className="text-sm text-texte-pale">Aucun étudiant inscrit pour l'instant. Importez la liste de la scolarité pour commencer.</p>
      ) : (
        <>
          <Indicateur libelle="Comptes activés" valeur={c.tauxActivation} />
          <Indicateur libelle="Présence aux lives" valeur={c.presence30j} />
          <Indicateur libelle="Devoirs rendus" valeur={c.devoirsRendus} />
          <div className="flex items-center justify-between border-t border-ligne-douce pt-3 text-sm">
            <span className="text-texte-pale">Vus en 7 jours : <strong className="text-encre">{c.actifs7j}</strong></span>
            <Link href={`/pilotage/suivi?site=${c.siteId}`} className={cn("font-bold no-underline", c.aContacter ? "text-danger" : "text-succes")}>
              {c.aContacter ? `${c.aContacter} à contacter` : "Rien à signaler"}
            </Link>
          </div>
        </>
      )}
    </li>
  );
}

function Raccourci({ href, icone, titre, texte }: { href: string; icone: React.ReactNode; titre: string; texte: string }) {
  return (
    <CarteLien href={href} className="flex min-h-[112px] flex-col gap-2 p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-clair text-orange-fonce">{icone}</span>
      <span className="font-extrabold leading-tight">{titre}</span>
      <span className="text-[13px] text-texte-gris">{texte}</span>
    </CarteLien>
  );
}
