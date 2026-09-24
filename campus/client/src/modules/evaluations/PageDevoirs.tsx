// /devoirs (étudiant) : À rendre · Rendus · Corrigés. Tri par échéance, retard
// en rouge et en mots, ✓ envoyé / ✓✓ vu / note, et les copies encore en
// attente de réseau dans la file d'envoi du téléphone.
import { useState } from "react";
import { Redirect, useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, CheckCheck, GraduationCap, CloudUpload } from "lucide-react";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { Onglets } from "@/components/ui/onglets";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { useMoiConnecte } from "@/lib/auth";
import { useCanal } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { useFileEnvoi } from "@/lib/file-envoi";
import { pluriel } from "@/lib/utils";
import type { ListeDevoirs, DevoirEtudiantResume } from "@shared/schema";
import { CarteDevoir } from "./composants/CarteDevoir";

type Onglet = "a_rendre" | "rendus" | "corriges";

/** Rafraîchit les devoirs quand le formateur ouvre une copie (✓✓) ou publie les notes. */
export function useEvenementsDevoirs() {
  const moi = useMoiConnecte();
  useCanal(`u:${moi.id}`, (e) => {
    if (["devoir-vu", "devoir-corrige", "devoir-rendu", "quiz-termine", "notification"].includes(e.type)) void rafraichir("/api/devoirs", "/api/notes");
  });
}

export default function PageDevoirs() {
  const moi = useMoiConnecte();
  const recherche = new URLSearchParams(useSearch());
  const [chemin, naviguer] = useLocation();
  const demande = recherche.get("onglet") as Onglet | null;
  const [onglet, setOnglet] = useState<Onglet>(demande && ["a_rendre", "rendus", "corriges"].includes(demande) ? demande : "a_rendre");
  const maintenant = useMaintenant(60_000);
  const file = useFileEnvoi();
  useEvenementsDevoirs();
  const { data, isLoading, error, refetch } = useQuery<ListeDevoirs>({ queryKey: ["/api/devoirs"], enabled: moi.role === "etudiant" });

  // Le formateur et l'équipe corrigent : leur page est « Corrections ».
  if (moi.role !== "etudiant") return <Redirect to="/corrections" replace />;

  const devoirs = data?.vue === "etudiant" ? data.devoirs : [];
  // Copies rangées dans la file d'envoi (pas encore arrivées au campus).
  const enAttente = new Set(
    file.map((e) => /^\/api\/devoirs\/(\d+)\/rendre$/.exec(e.url)?.[1]).filter((x): x is string => Boolean(x)).map(Number),
  );
  const estAFaire = (d: DevoirEtudiantResume) => !enAttente.has(d.id) && ["a_rendre", "en_retard", "en_cours", "manque"].includes(d.statut);
  const aRendre = devoirs
    .filter((d) => estAFaire(d) && (d.statut !== "manque" || maintenant - new Date(d.dateLimite).getTime() < 30 * 86_400_000))
    // Les devoirs encore faisables d'abord (par échéance), puis ceux dont la date est passée.
    .sort((a, b) => Number(a.statut === "manque") - Number(b.statut === "manque") || a.dateLimite.localeCompare(b.dateLimite));
  const rendus = devoirs
    .filter((d) => enAttente.has(d.id) || d.statut === "rendu" || d.statut === "vu")
    .sort((a, b) => (b.renduLe ?? "").localeCompare(a.renduLe ?? ""));
  const corriges = devoirs.filter((d) => d.statut === "corrige").sort((a, b) => b.dateLimite.localeCompare(a.dateLimite));
  const aFaireVraiment = aRendre.filter((d) => d.statut !== "manque").length;

  const changer = (o: Onglet) => {
    setOnglet(o);
    naviguer(o === "a_rendre" ? chemin : `${chemin}?onglet=${o}`, { replace: true });
  };

  const liste = onglet === "a_rendre" ? aRendre : onglet === "rendus" ? rendus : corriges;

  return (
    <Page className="max-w-3xl">
      <EnTetePage
        etiquette="Mes devoirs et interrogations"
        titre="Devoirs"
        sousTitre={
          data
            ? aFaireVraiment
              ? `Tu as ${pluriel(aFaireVraiment, "devoir")} à faire. Le plus urgent est en haut.`
              : "Tu es à jour. Bravo !"
            : undefined
        }
        actions={
          <LienBouton href="/notes" variante="contour" icone={<GraduationCap className="h-4 w-4" />} className="min-h-[48px]">
            Mes notes
          </LienBouton>
        }
      />

      <Onglets
        valeur={onglet}
        onChange={changer}
        options={[
          { valeur: "a_rendre", libelle: "À rendre", compteur: aFaireVraiment },
          { valeur: "rendus", libelle: "Rendus", compteur: rendus.length },
          { valeur: "corriges", libelle: "Corrigés", compteur: corriges.length },
        ]}
        className="self-start"
      />

      {isLoading ? (
        <Chargement lignes={4} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => void refetch()} />
      ) : liste.length ? (
        <div className="flex flex-col gap-3" role="tabpanel">
          {onglet === "rendus" && enAttente.size > 0 && (
            <p className="flex items-start gap-2 rounded-2xl bg-orange-clair px-4 py-3 text-[15px] text-orange-profond">
              <CloudUpload className="mt-0.5 h-5 w-5 shrink-0" />
              Les copies « En attente de réseau » sont gardées sur ton téléphone. Elles partiront toutes seules au retour de la connexion, et tu recevras ton reçu.
            </p>
          )}
          {liste.map((d, i) => (
            <div key={d.id}>
              {onglet === "a_rendre" && d.statut === "manque" && aRendre[i - 1]?.statut !== "manque" && (
                <h2 className="mb-2 mt-4 font-mono text-xs uppercase tracking-wider text-texte-gris">Date dépassée</h2>
              )}
              <CarteDevoir d={d} maintenant={maintenant} enAttente={enAttente.has(d.id)} />
            </div>
          ))}
        </div>
      ) : onglet === "a_rendre" ? (
        <EtatVide
          icone={<ClipboardList className="h-6 w-6" />}
          titre="Aucun devoir à rendre."
          texte="Quand un formateur donne un devoir, il apparaît ici avec sa date limite, et tu reçois un rappel la veille."
          action={
            <LienBouton href="/cours" variante="contour" className="min-h-[48px]">
              Voir mes cours
            </LienBouton>
          }
        />
      ) : onglet === "rendus" ? (
        <EtatVide
          icone={<CheckCheck className="h-6 w-6" />}
          titre="Aucune copie en attente de correction."
          texte="Tes copies envoyées apparaissent ici avec leur reçu : ✓ reçue par le campus, ✓✓ ouverte par ton formateur."
        />
      ) : (
        <EtatVide
          icone={<GraduationCap className="h-6 w-6" />}
          titre="Pas encore de note."
          texte="Quand ton formateur publie les notes, tu les retrouves ici avec son commentaire (parfois un message vocal)."
        />
      )}
    </Page>
  );
}
