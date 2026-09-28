// /assistant/fiches — le formateur relit les fiches « L'essentiel en 5
// points » proposées par l'IA : il corrige, valide (elles nourrissent alors
// l'assistant et s'affichent « validées » aux étudiants) ou supprime.
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileCheck2, PencilLine, Trash2, CheckCircle2, Undo2, RefreshCw } from "lucide-react";
import { patch, post, suppr } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { dateCourte } from "@/lib/dates";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton } from "@/components/ui/bouton";
import { Selection, ZoneTexte, Champ } from "@/components/ui/champs";
import { Badge, Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { Onglets } from "@/components/ui/onglets";
import { Fenetre } from "@/components/ui/fenetre";
import { Markdown } from "@/components/ui/markdown";
import { toast, toastErreur } from "@/components/ui/toast";
import type { FicheRevisionDto } from "@shared/schema/ext-ia";
import { useCoursAssistant, useEtatIa, blocageDe } from "./api-ia";
import { EtiquetteIa } from "./composants";

type Filtre = "a-relire" | "validees";

export default function PageFiches() {
  const coursQ = useCoursAssistant();
  const [coursId, setCoursId] = useState(0);
  const [filtre, setFiltre] = useState<Filtre>("a-relire");
  const [edition, setEdition] = useState<FicheRevisionDto | null>(null);
  const [aSupprimer, setASupprimer] = useState<FicheRevisionDto | null>(null);
  const url = coursId ? `/api/ia/fiches?cours=${coursId}` : "/api/ia/fiches";
  const fichesQ = useQuery<FicheRevisionDto[]>({ queryKey: [url] });

  const toutes = fichesQ.data ?? [];
  const aRelire = toutes.filter((f) => !f.validee);
  const validees = toutes.filter((f) => f.validee);
  const liste = filtre === "a-relire" ? aRelire : validees;
  const mesCours = useMemo(() => (coursQ.data ?? []).filter((c) => c.enseignant), [coursQ.data]);

  const { data: etat } = useEtatIa();
  const [regeneration, setRegeneration] = useState<number | null>(null);

  /** Nouvelle proposition de l'IA pour la leçon (elle repasse « à relire »). */
  const regenerer = async (f: FicheRevisionDto) => {
    if (!f.leconId) return;
    setRegeneration(f.id);
    try {
      await post(`/api/ia/lecons/${f.leconId}/essentiel`, { regenerer: true });
      toast("Nouvelle proposition prête : relisez-la avant de la valider");
      setFiltre("a-relire");
      void rafraichir("/api/ia/fiches", "/api/ia/etat");
    } catch (e) {
      toastErreur(e);
    } finally {
      setRegeneration(null);
    }
  };

  const basculer = async (f: FicheRevisionDto, validee: boolean) => {
    try {
      await patch(`/api/ia/fiches/${f.id}`, { validee });
      toast(validee ? "Fiche validée : les étudiants la voient comme validée" : "Validation retirée");
      void rafraichir("/api/ia/fiches");
    } catch (e) {
      toastErreur(e);
    }
  };

  const supprimer = async () => {
    if (!aSupprimer) return;
    try {
      await suppr(`/api/ia/fiches/${aSupprimer.id}`);
      toast("Fiche supprimée");
      setASupprimer(null);
      void rafraichir("/api/ia/fiches");
    } catch (e) {
      toastErreur(e);
    }
  };

  return (
    <Page className="max-w-4xl">
      <Link href="/assistant" className="-ml-2 inline-flex min-h-12 w-fit items-center gap-2 rounded-xl px-2 text-[15px] font-bold text-texte-doux no-underline hover:bg-creme hover:text-encre">
        <ArrowLeft className="h-5 w-5" /> L'assistant
      </Link>
      <EnTetePage
        etiquette="Assistant IA · fiches de révision"
        titre="Relire les fiches"
        sousTitre="Quand un étudiant demande « L'essentiel en 5 points » d'une leçon, l'IA propose une fiche. Relisez-la, corrigez-la si besoin, puis validez-la : elle devient la fiche officielle de la leçon et l'assistant s'en sert pour répondre."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Onglets<Filtre>
          valeur={filtre}
          onChange={setFiltre}
          options={[
            { valeur: "a-relire", libelle: "À relire", compteur: aRelire.length },
            { valeur: "validees", libelle: "Validées", compteur: validees.length },
          ]}
        />
        {mesCours.length > 1 && (
          <Selection aria-label="Filtrer par cours" value={coursId} onChange={(e) => setCoursId(Number(e.target.value))} className="sm:w-72">
            <option value={0}>Tous mes cours</option>
            {mesCours.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.titre}
              </option>
            ))}
          </Selection>
        )}
      </div>

      {fichesQ.isLoading ? (
        <Chargement lignes={3} />
      ) : fichesQ.error ? (
        <Erreur message={(fichesQ.error as Error).message} reessayer={() => void fichesQ.refetch()} />
      ) : !liste.length ? (
        <EtatVide
          icone={<FileCheck2 className="h-6 w-6" />}
          titre={filtre === "a-relire" ? "Aucune fiche à relire" : "Aucune fiche validée pour l'instant"}
          texte={
            filtre === "a-relire"
              ? "Les fiches apparaissent ici dès qu'un étudiant demande « L'essentiel en 5 points » d'une de vos leçons."
              : "Les fiches que vous validez apparaîtront ici. Vous pourrez toujours les corriger."
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {liste.map((f) => (
            <li key={f.id} className="flex flex-col gap-3 rounded-[24px] border border-ligne bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                {f.validee ? (
                  <Badge ton="succes">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Validée
                  </Badge>
                ) : (
                  <EtiquetteIa />
                )}
                <Badge ton="gris">{f.cours.code}</Badge>
                {f.lecon && <Badge ton="gris">{f.lecon.numero ? `Leçon ${f.lecon.numero}` : "Leçon non publiée"}</Badge>}
                <span className="ml-auto font-mono text-xs text-texte-gris">{dateCourte(f.creeLe)}</span>
              </div>
              <h2 className="text-lg font-extrabold leading-snug">{f.lecon?.titre ?? f.titre}</h2>
              <div className="rounded-2xl bg-creme px-4 py-3">
                <Markdown source={f.contenu} className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0" />
              </div>
              <div className="flex flex-wrap gap-2">
                {f.validee ? (
                  <Bouton variante="contour" icone={<Undo2 className="h-4 w-4" />} onClick={() => void basculer(f, false)} className="min-h-12">
                    Retirer la validation
                  </Bouton>
                ) : (
                  <Bouton icone={<CheckCircle2 className="h-4 w-4" />} onClick={() => void basculer(f, true)} className="min-h-12">
                    Valider la fiche
                  </Bouton>
                )}
                <Bouton variante="doux" icone={<PencilLine className="h-4 w-4" />} onClick={() => setEdition(f)} className="min-h-12">
                  Corriger
                </Bouton>
                {f.leconId && (
                  <Bouton
                    variante="fantome"
                    icone={<RefreshCw className="h-4 w-4" />}
                    onClick={() => void regenerer(f)}
                    chargement={regeneration === f.id}
                    disabled={Boolean(blocageDe(etat))}
                    className="min-h-12"
                  >
                    Nouvelle proposition
                  </Bouton>
                )}
                <Bouton variante="fantome" icone={<Trash2 className="h-4 w-4" />} onClick={() => setASupprimer(f)} className="min-h-12">
                  Supprimer
                </Bouton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {edition && <FenetreEdition fiche={edition} onFermer={() => setEdition(null)} />}
      <Fenetre
        ouverte={aSupprimer !== null}
        onFermer={() => setASupprimer(null)}
        titre="Supprimer cette fiche ?"
        description="Un étudiant qui demandera « L'essentiel en 5 points » de cette leçon recevra une nouvelle proposition de l'IA."
        pied={
          <>
            <Bouton variante="fantome" onClick={() => setASupprimer(null)}>
              Garder
            </Bouton>
            <Bouton variante="danger" onClick={() => void supprimer()}>
              Supprimer
            </Bouton>
          </>
        }
      />
    </Page>
  );
}

function FenetreEdition({ fiche, onFermer }: { fiche: FicheRevisionDto; onFermer: () => void }) {
  const [titre, setTitre] = useState(fiche.titre);
  const [contenu, setContenu] = useState(fiche.contenu);
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async (valider: boolean) => {
    setEnvoi(true);
    try {
      await patch(`/api/ia/fiches/${fiche.id}`, { titre, contenu, ...(valider ? { validee: true } : {}) });
      toast(valider ? "Fiche corrigée et validée" : "Correction enregistrée");
      void rafraichir("/api/ia/fiches");
      onFermer();
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
      large
      titre="Corriger la fiche"
      description="Markdown simple : **gras**, listes numérotées. Les étudiants verront votre version."
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton variante="contour" onClick={() => void enregistrer(false)} chargement={envoi} disabled={!contenu.trim()}>
            Enregistrer
          </Bouton>
          {!fiche.validee && (
            <Bouton onClick={() => void enregistrer(true)} chargement={envoi} disabled={!contenu.trim()}>
              Enregistrer et valider
            </Bouton>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Champ libelle="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={200} />
        <ZoneTexte libelle="Contenu" value={contenu} onChange={(e) => setContenu(e.target.value)} rows={12} className="font-mono" />
      </div>
    </Fenetre>
  );
}
