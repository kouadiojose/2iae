// /pilotage : le tableau de la vie scolaire et de la direction. Les grands
// chiffres du périmètre, chaque campus d'un coup d'œil, puis les étudiants à
// contacter aujourd'hui et les raccourcis du quotidien.
//
// Chiffres justes (chantier C8) : présence aux directs là où elle est connue
// (une salle non émargée laisse la présence « inconnue », jamais absente),
// copies rendues « à ce jour », actifs du jour, « revenus » au lieu des « vus
// en 7 jours », « ont suivi un direct » là où la présence est connue, et lien
// vers le tableau « Engagement et participation ». La liste « à contacter »
// arrive avec le tableau ; le serveur garde le calcul 2 minutes par périmètre.
//
// En tête (8 octobre 2026 au soir) : la grande carte « Voir tout le travail du campus » (/pilotage/travail).
import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Printer, CalendarClock, BarChart3, Globe, Sparkles, ArrowRight, PartyPopper, GraduationCap, UserPlus, Activity } from "lucide-react";
import type { Droit } from "@shared/schema";
import type { IndicateursTableau, TableauPilotageEngagement } from "@shared/engagement/indicateurs";
import { t as te, selonNombre } from "@shared/textes/engagement";
import { useTextes } from "@/lib/textes";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Chiffre, BarreProgression, Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { LienBouton } from "@/components/ui/bouton";
import { CarteLien, TitreSection } from "@/components/ui/carte";
import { useMoiConnecte, profilPermet } from "@/lib/auth";
import { salutation } from "@/lib/dates";
import { maintenantServeur } from "@/lib/horloge";
import { cn, pluriel } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { LigneAContacter } from "./composants/LigneAContacter";
import { FenetreSuivi } from "./composants/FenetreSuivi";
import { CarteRentree } from "./composants/CarteRentree";
import { CarteTravail } from "./composants/CarteTravail";
import { LimiteSilencieuse } from "@/components/ui/limite-silencieuse";
import { pourcent } from "./outils";

export default function PageTableau() {
  const moi = useMoiConnecte();
  // Ce que le profil permet (ext-profils.ts) : le tableau ne montre que ce que la personne peut utiliser.
  const peutSuivre = profilPermet(moi, "suivi");
  const tx = useTextes(te);
  // Le tableau apporte aussi les 4 premiers « à contacter » (la liste complète, paginée, est sur /pilotage/suivi).
  const tableau = useQuery<TableauPilotageEngagement>({ queryKey: ["/api/pilotage/tableau"] });
  const [suivi, setSuivi] = useState<{ id: number; prenom: string; nom: string } | null>(null);
  const t = tableau.data;
  const aContacter = t?.aContacter ?? null;
  const nb = peutSuivre ? (aContacter?.total ?? t?.total.aContacter ?? 0) : 0;
  const voitEngagement = profilPermet(moi, "presences_voir");
  const raccourcis = RACCOURCIS.filter((r) => profilPermet(moi, r.droit));

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette={t ? `Pilotage · ${t.perimetre.tout ? "Tout le groupe" : `Campus ${t.perimetre.site ?? ""}`}` : "Pilotage"}
        titre={`${salutation(new Date(maintenantServeur()))} ${moi.prenom}.`}
        sousTitre={tx("tableau.sousTitre")}
        actions={
          nb > 0 ? (
            <LienBouton href="/pilotage/suivi" taille="lg" icone={<ArrowRight className="h-5 w-5" />} className="min-h-[52px]">
              Contacter {pluriel(nb, "étudiant")}
            </LienBouton>
          ) : undefined
        }
      />

      {/* « Le travail du campus » d'abord : ce qui a été fait, avant les statistiques. */}
      {profilPermet(moi, ["notes", "presences_voir"]) && (
        <LimiteSilencieuse nom="CarteTravail">
          <CarteTravail />
        </LimiteSilencieuse>
      )}

      {profilPermet(moi, "outils_campus") && <CarteRentree />}

      {tableau.isLoading && <Chargement lignes={2} />}
      {tableau.error && <Erreur message={(tableau.error as Error).message} reessayer={() => tableau.refetch()} />}

      {t && (
        <>
          <section aria-label="Chiffres clés" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Chiffre libelle="Étudiants" valeur={t.total.etudiants} detail={t.perimetre.tout ? "dans les 5 campus" : `au campus ${t.perimetre.site ?? ""}`} />
            <Chiffre
              libelle="Comptes activés"
              valeur={pourcent(t.total.tauxActivation)}
              detail={`${t.total.actives} sur ${t.total.etudiants}`}
              ton={t.total.tauxActivation !== null && t.total.tauxActivation < 70 ? "orange" : "encre"}
            />
            <Chiffre
              libelle={tx("tableau.actifsAujourdhui")}
              valeur={t.total.actifsAujourdhui}
              detail={selonNombre(tx, "tableau.actifsAujourdhui.detail", t.total.apprenantsAujourdhui)}
            />
            <Chiffre libelle={tx("tableau.revenus")} valeur={pourcent(t.total.revenus.taux)} detail={tx("tableau.revenus.detail")} />
            {/* Là où la présence est connue : une salle non émargée ne fait pas croire que les étudiants n'ont rien suivi. */}
            <Chiffre
              libelle={tx("tableau.ontSuivi")}
              valeur={pourcent(t.total.ontSuivi.taux)}
              detail={
                t.total.ontSuiviInconnue
                  ? tx("tableau.ontSuivi.detailInconnue", { v: { n: t.total.ontSuiviInconnue } })
                  : tx("tableau.ontSuivi.detail")
              }
              ton={t.total.ontSuiviInconnue !== null && t.total.ontSuiviInconnue >= 50 ? "orange" : "encre"}
            />
            <Chiffre
              libelle={tx("tableau.presence")}
              valeur={pourcent(t.total.presence30j)}
              detail={
                t.total.presence.partInconnue
                  ? tx("tableau.presence.detail", { v: { n: t.total.presence.partInconnue } })
                  : tx("tableau.presence.detailConnue")
              }
              ton={t.total.presence.partInconnue !== null && t.total.presence.partInconnue >= 50 ? "orange" : "encre"}
            />
            <Chiffre
              libelle={tx("tableau.copies")}
              valeur={pourcent(t.total.copies.taux)}
              detail={tx("tableau.copies.detail", { v: { n: t.total.copies.n ?? 0, sur: t.total.copies.sur } })}
            />
            <Chiffre libelle="À contacter" valeur={t.total.aContacter} ton={t.total.aContacter ? "danger" : "succes"} detail={!t.total.aContacter ? "personne pour l'instant" : peutSuivre ? "voir la liste ci-dessous" : "suivis par la vie scolaire"} />
          </section>

          {voitEngagement && (
            <CarteLien href="/pilotage/engagement" className="flex min-h-[64px] items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-clair text-orange-fonce">
                <Activity className="h-5 w-5" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-extrabold">{tx("tableau.lienEngagement")}</span>
                <span className="text-[13px] text-texte-gris">{tx("tableau.lienEngagement.texte")}</span>
              </span>
              <ArrowRight className="ml-auto h-5 w-5 shrink-0" />
            </CarteLien>
          )}

          {t.campus.length > 1 && (
            <section>
              <TitreSection titre="Campus par campus" />
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {t.campus.map((c) => (
                  <CarteCampus key={c.siteId} c={c} lienSuivi={peutSuivre} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {peutSuivre && <section>
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
        {tableau.isLoading ? (
          <Chargement lignes={2} />
        ) : tableau.error ? null : !aContacter?.lignes.length ? (
          <EtatVide
            icone={<PartyPopper className="h-6 w-6" />}
            titre="Personne à relancer pour l'instant."
            texte={tx("tableau.aContacter.vide")}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {aContacter.lignes.slice(0, 4).map((l) => (
              <LigneAContacter key={l.etudiant.id} ligne={l} onSuivi={setSuivi} compacte />
            ))}
          </ul>
        )}
      </section>}

      {raccourcis.length > 0 && (
        <section>
          <TitreSection titre="Raccourcis" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {raccourcis.map((r) => (
              <Raccourci key={r.href} href={r.href} icone={r.icone} titre={r.titre} texte={r.texte} />
            ))}
          </div>
        </section>
      )}

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

/** Raccourcis du tableau, chacun avec le droit du profil qu'il demande (ext-profils.ts). */
const RACCOURCIS: { href: string; icone: ReactNode; titre: string; texte: string; droit?: Droit }[] = [
  { href: "/pilotage/comptes/import", icone: <FileSpreadsheet className="h-5 w-5" />, titre: "Importer des étudiants", texte: "Coller depuis Excel", droit: "comptes_gerer" },
  { href: "/pilotage/comptes?etat=non_actives&role=etudiant", icone: <Printer className="h-5 w-5" />, titre: "Fiches de connexion", texte: "Pour les non-activés", droit: "nouveau_code" },
  { href: "/pilotage/etudiants", icone: <GraduationCap className="h-5 w-5" />, titre: "Étudiants", texte: "Chercher un étudiant", droit: "comptes_voir" },
  { href: "/pilotage/preinscrits", icone: <UserPlus className="h-5 w-5" />, titre: "Préinscrits", texte: "Demandes du site 2iae.com", droit: "crm" },
  { href: "/pilotage/planning", icone: <CalendarClock className="h-5 w-5" />, titre: "Planning", texte: "Lives de la semaine" },
  { href: "/pilotage/presences", icone: <BarChart3 className="h-5 w-5" />, titre: "Présences", texte: "Par séance, export", droit: "presences_voir" },
  { href: "/pilotage/site", icone: <Globe className="h-5 w-5" />, titre: "Site public", texte: "Pages et 2iae.com", droit: "outils_campus" },
  { href: "/pilotage/ia", icone: <Sparkles className="h-5 w-5" />, titre: "Budget IA", texte: "Consommation 30 jours", droit: "outils_campus" },
];

function CarteCampus({ c, lienSuivi }: { c: IndicateursTableau; lienSuivi: boolean }) {
  const tx = useTextes(te);
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
          <Indicateur libelle={tx("tableau.presence")} valeur={c.presence30j} />
          <Indicateur libelle={tx("tableau.copiesCourt")} valeur={c.devoirsRendus} />
          {c.emargement && c.emargement.seances > 0 && (
            <p className={cn("text-[13px]", c.emargement.emargees === 0 ? "font-bold text-alerte" : "text-texte-pale")}>
              {tx("tableau.emargement", { v: { e: c.emargement.emargees, n: c.emargement.seances } })}
            </p>
          )}
          <div className="flex items-center justify-between border-t border-ligne-douce pt-3 text-sm">
            <span className="text-texte-pale"><strong className="text-encre">{c.actifsAujourdhui}</strong> {tx(c.actifsAujourdhui <= 1 ? "tableau.actifsCourt.un" : "tableau.actifsCourt.n")}</span>
            {lienSuivi && (
              <Link href={`/pilotage/suivi?site=${c.siteId}`} className={cn("font-bold no-underline", c.aContacter ? "text-danger" : "text-succes")}>
                {c.aContacter ? `${c.aContacter} à contacter` : "Rien à signaler"}
              </Link>
            )}
          </div>
        </>
      )}
    </li>
  );
}

function Raccourci({ href, icone, titre, texte }: { href: string; icone: ReactNode; titre: string; texte: string }) {
  return (
    <CarteLien href={href} className="flex min-h-[112px] flex-col gap-2 p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-clair text-orange-fonce">{icone}</span>
      <span className="font-extrabold leading-tight">{titre}</span>
      <span className="text-[13px] text-texte-gris">{texte}</span>
    </CarteLien>
  );
}
