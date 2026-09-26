// /pilotage/visio — la visio du campus pour la direction et la vie scolaire :
// minutes-participant Daily du mois (lues côté serveur dans l'API Daily),
// qui les consomme (formateurs, salles, étudiants, équipe), coût estimé, et
// réglages (fournisseur par défaut, vidéo étudiante par défaut, places).
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FlaskConical, Save, Video } from "lucide-react";
import { put } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { useMoiConnecte } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { relatif } from "@/lib/dates";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte, TitreSection } from "@/components/ui/carte";
import { Champ, Selection, Interrupteur } from "@/components/ui/champs";
import { BarreProgression, Chargement, Chiffre, EtatVide, Erreur } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import type { FournisseurVisio, ReglagesVisioDto, UsageVisioDto } from "@shared/schema";
import { ConfirmationFuseau } from "./Fuseau";

const LIBELLES_PROFIL: Record<UsageVisioDto["parProfil"][number]["profil"], string> = {
  formateur: "Formateurs",
  salle: "Écrans de salle",
  etudiant: "Étudiants en vidéo",
  equipe: "Équipe (direction, vie scolaire)",
  inconnu: "Autres (anciens comptes, invités)",
};

const LIBELLES_FOURNISSEUR: Record<FournisseurVisio, string> = {
  daily: "Daily (recommandé)",
  campus: "Visio du campus",
  jitsi: "Jitsi",
  externe: "Lien externe",
  demo: "Sans visio",
};

const nombre = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const dollars = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

function decalerMois(mois: string, delta: number): string {
  const [a, m] = mois.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
const nomMois = (mois: string) => {
  const t = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${mois}-01T00:00:00Z`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export default function PagePilotageVisio() {
  const moi = useMoiConnecte();
  const moisCourant = new Date().toISOString().slice(0, 7);
  const [mois, setMois] = useState(moisCourant);
  const usage = useQuery<UsageVisioDto>({ queryKey: [`/api/visio/usage?mois=${mois}`] });
  const reglages = useQuery<ReglagesVisioDto>({ queryKey: ["/api/visio/reglages"] });

  return (
    <Page className="max-w-5xl">
      <EnTetePage
        etiquette="Pilotage · visio"
        titre="La visio du campus"
        sousTitre="Ce que la visio Daily a consommé, ce que cela coûte, et les réglages qui gardent la facture basse."
        actions={
          <LienBouton href="/visio/essai#salle-essai" icone={<FlaskConical className="h-4 w-4" />}>
            Entrer dans la salle d'essai
          </LienBouton>
        }
      />
      <ConfirmationFuseau />

      <section className="flex flex-col gap-4" aria-labelledby="titre-conso">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titre-conso" className="text-xl font-extrabold">
            Consommation
          </h2>
          <div className="flex items-center gap-1 rounded-full border border-ligne bg-white p-1">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full hover:bg-creme" aria-label="Mois précédent" onClick={() => setMois((m) => decalerMois(m, -1))}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="min-w-[150px] text-center text-[15px] font-bold">{nomMois(mois)}</span>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-creme disabled:opacity-30"
              aria-label="Mois suivant"
              disabled={mois >= moisCourant}
              onClick={() => setMois((m) => decalerMois(m, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
        {usage.isLoading ? (
          <Chargement lignes={3} />
        ) : usage.error ? (
          <Erreur message={(usage.error as Error).message} reessayer={() => void usage.refetch()} />
        ) : usage.data ? (
          <Consommation u={usage.data} />
        ) : null}
      </section>

      <Reperes r={reglages.data} />

      <section className="flex flex-col gap-4" aria-labelledby="titre-reglages">
        <h2 id="titre-reglages" className="text-xl font-extrabold">
          Réglages
        </h2>
        {reglages.data ? <FormulaireReglages r={reglages.data} modifiable={moi.role === "admin"} /> : reglages.error ? <Erreur message={(reglages.error as Error).message} /> : <Chargement lignes={2} />}
      </section>
    </Page>
  );
}

function Consommation({ u }: { u: UsageVisioDto }) {
  if (!u.disponible) {
    return <EtatVide icone={<Video className="h-6 w-6" />} titre="Consommation indisponible" texte={u.raison ?? "Le service Daily n'a pas répondu. Réessayez dans quelques minutes."} />;
  }
  const totalProfils = u.parProfil.reduce((t, p) => t + p.minutes, 0) || 1;
  const restantes = Math.max(0, u.cout.minutesOffertes - u.minutes - u.minutesAutresSalles);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Chiffre valeur={nombre(u.minutes)} libelle="Minutes-participant" detail={`${nombre(u.reunions)} séance${u.reunions > 1 ? "s" : ""} de visio · lu ${relatif(u.lu)}`} />
        <Chiffre
          valeur={dollars(u.cout.usd)}
          libelle="Coût estimé"
          ton={u.cout.usd > 0 ? "orange" : "succes"}
          detail={u.cout.usd > 0 ? `≈ ${nombre(u.cout.fcfa)} FCFA · ${nombre(u.cout.minutesFacturables)} minutes facturées` : "Dans les minutes offertes par Daily."}
        />
        <Chiffre valeur={nombre(restantes)} libelle="Minutes offertes restantes" detail={`Sur ${nombre(u.cout.minutesOffertes)} par mois pour tout le compte Daily.`} />
      </div>
      {u.minutes === 0 ? (
        <EtatVide
          icone={<Video className="h-6 w-6" />}
          titre="Aucune minute de visio ce mois-ci."
          texte="Dès qu'un formateur, une salle ou un étudiant entre dans une salle Daily du campus (cours, répétition ou salle d'essai), ses minutes apparaissent ici."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Carte className="flex flex-col gap-3">
            <TitreSection titre="Qui consomme" className="mb-0" />
            <ul className="flex flex-col gap-3">
              {u.parProfil.map((p) => (
                <li key={p.profil} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-[15px]">
                    <span className="font-semibold">{LIBELLES_PROFIL[p.profil]}</span>
                    <span className="shrink-0 font-mono text-[13px] text-texte-doux">
                      {nombre(p.minutes)} min · {p.personnes} pers.
                    </span>
                  </div>
                  <BarreProgression valeur={(p.minutes / totalProfils) * 100} ton={p.profil === "etudiant" ? "orange" : "succes"} />
                </li>
              ))}
            </ul>
            <p className="text-[13px] leading-snug text-texte-gris">
              La visio est pensée pour le formateur et les cinq écrans de salle. Les étudiants au téléphone suivent en « son + diapos » et ne comptent ici que s'ils choisissent la vidéo.
            </p>
          </Carte>
          <Carte className="flex flex-col gap-3">
            <TitreSection titre="Par salle de visio" className="mb-0" />
            <ul className="flex flex-col divide-y divide-ligne-douce">
              {u.parSalle.slice(0, 12).map((s) => (
                <li key={s.salle} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 truncate text-[15px] font-semibold">{s.libelle}</span>
                  <span className="shrink-0 font-mono text-[13px] text-texte-doux">
                    {nombre(s.minutes)} min{s.reunions > 1 ? ` · ${s.reunions}×` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Carte>
        </div>
      )}
      {u.minutesAutresSalles > 0 && (
        <p className="rounded-2xl bg-creme px-4 py-3 text-[14px] leading-snug text-texte-doux">
          Le compte Daily sert aussi à d'autres plateformes : leurs {nombre(u.minutesAutresSalles)} minutes ce mois-ci ne sont pas comptées ci-dessus, mais elles puisent dans les mêmes minutes offertes.
        </p>
      )}
    </div>
  );
}

/** Repères de coût : un cours type, au prix réglé. */
function Reperes({ r }: { r?: ReglagesVisioDto }) {
  if (!r?.daily) return null;
  const cout = (minutes: number) => minutes * r.prixMinuteUsd;
  const lignes = [
    { libelle: "Un cours de 4 h · formateur et 5 salles", minutes: 6 * 240 },
    { libelle: "Le même cours · avec 20 étudiants en vidéo", minutes: 26 * 240 },
    { libelle: "Une répétition de 20 min · formateur et 1 salle", minutes: 2 * 20 },
  ];
  return (
    <Carte className="flex flex-col gap-3 bg-creme">
      <TitreSection titre="Repères" className="mb-0" />
      <ul className="flex flex-col gap-2">
        {lignes.map((l) => (
          <li key={l.libelle} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <span className="text-[15px]">{l.libelle}</span>
            <span className="font-mono text-[13px] text-texte-doux">
              {nombre(l.minutes)} min · {dollars(cout(l.minutes))} (≈ {nombre(cout(l.minutes) * r.tauxFcfa)} FCFA)
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-texte-gris">Au prix réglé ci-dessous, hors minutes offertes. La radio du cours ne coûte rien chez Daily.</p>
    </Carte>
  );
}

function FormulaireReglages({ r, modifiable }: { r: ReglagesVisioDto; modifiable: boolean }) {
  const [f, setF] = useState(r);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => setF(r), [r]);
  const change = JSON.stringify(f) !== JSON.stringify(r);

  const enregistrer = async () => {
    setEnvoi(true);
    try {
      await put<ReglagesVisioDto>("/api/visio/reglages", {
        fournisseurParDefaut: f.fournisseurParDefaut,
        videoEtudiantParDefaut: f.videoEtudiantParDefaut,
        placesDailyEtudiants: Number(f.placesDailyEtudiants),
        prixMinuteUsd: Number(f.prixMinuteUsd),
        minutesOffertes: Number(f.minutesOffertes),
        tauxFcfa: Number(f.tauxFcfa),
      });
      await rafraichir("/api/visio");
      toast("Réglages de la visio enregistrés.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Carte className="flex flex-col gap-5">
      {!r.daily && (
        <p className="rounded-xl bg-alerte-clair px-4 py-3 text-[15px] text-encre">
          La visio Daily n'est pas reliée au campus : les cours passent par la visio intégrée. Pour l'activer, la clé du compte Daily doit être ajoutée aux réglages du serveur.
        </p>
      )}
      <Selection
        libelle="Visio des nouvelles séances"
        aide="Les séances déjà planifiées gardent leur visio. Daily est recommandé : c'est la visio la plus solide avec les cinq salles."
        value={f.fournisseurParDefaut}
        disabled={!modifiable}
        onChange={(e) => setF({ ...f, fournisseurParDefaut: e.target.value as FournisseurVisio })}
      >
        {r.fournisseurs
          .filter((x) => x !== "externe")
          .map((x) => (
            <option key={x} value={x}>
              {LIBELLES_FOURNISSEUR[x]}
            </option>
          ))}
      </Selection>
      <div className="flex items-start justify-between gap-4 rounded-2xl bg-creme p-4">
        <div>
          <p className="text-[16px] font-extrabold">Vidéo pour les étudiants, par défaut</p>
          <p className="mt-0.5 text-[14px] leading-snug text-texte-pale">
            {f.videoEtudiantParDefaut
              ? "Un étudiant sur ordinateur entre en vidéo. Chaque étudiant en vidéo compte dans les minutes Daily (150 à 250 Mo par heure pour lui)."
              : "Recommandé : chaque étudiant entre en « son + diapos » (12 à 15 Mo par heure, rien chez Daily) et choisit la vidéo s'il le veut."}
          </p>
        </div>
        <div className={cn("pt-1", !modifiable && "pointer-events-none opacity-60")}>
          <Interrupteur actif={f.videoEtudiantParDefaut} onChange={(v) => setF({ ...f, videoEtudiantParDefaut: v })} libelle="Vidéo étudiante par défaut" />
        </div>
      </div>
      <Champ
        libelle="Étudiants en vidéo par séance, au plus"
        type="number"
        min={0}
        max={200}
        inputMode="numeric"
        disabled={!modifiable}
        value={String(f.placesDailyEtudiants)}
        onChange={(e) => setF({ ...f, placesDailyEtudiants: Number(e.target.value) })}
        aide="Au-delà, la salle est complète : les étudiants suivent en son + diapos. Le formateur, les salles et l'équipe ont toujours leur place."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Champ libelle="Prix d'une minute (dollars)" type="number" step="0.0001" min={0} disabled={!modifiable} value={String(f.prixMinuteUsd)} onChange={(e) => setF({ ...f, prixMinuteUsd: Number(e.target.value) })} />
        <Champ libelle="Minutes offertes par mois" type="number" min={0} disabled={!modifiable} value={String(f.minutesOffertes)} onChange={(e) => setF({ ...f, minutesOffertes: Number(e.target.value) })} />
        <Champ libelle="1 dollar en FCFA" type="number" min={1} disabled={!modifiable} value={String(f.tauxFcfa)} onChange={(e) => setF({ ...f, tauxFcfa: Number(e.target.value) })} />
      </div>
      <p className="text-[13px] text-texte-gris">Tarif public de Daily : 0,004 dollar la minute-participant, 10 000 minutes offertes par mois. Ajustez selon votre contrat.</p>
      {modifiable ? (
        <Bouton icone={<Save className="h-4 w-4" />} disabled={!change} chargement={envoi} onClick={() => void enregistrer()} className="self-start">
          Enregistrer les réglages
        </Bouton>
      ) : (
        <p className="text-[14px] text-texte-pale">Seule la direction modifie ces réglages.</p>
      )}
    </Carte>
  );
}
