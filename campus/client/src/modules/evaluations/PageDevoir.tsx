// /devoirs/:id (étudiant) : consigne, pièces jointes avec leur poids, zone
// « Rendre mon devoir », reçu vert, puis la correction (note, commentaire,
// commentaire vocal). « Écrire au formateur » et le tuteur IA sont à un toucher.
import { useCallback, useState } from "react";
import { Link, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, MessageCircle, AlertTriangle, Mic, ClipboardList, Eye } from "lucide-react";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Chargement, EtatVide, Erreur, Badge, BarreProgression } from "@/components/ui/divers";
import { Markdown } from "@/components/ui/markdown";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { useMoiConnecte } from "@/lib/auth";
import { ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { useFileEnvoi } from "@/lib/file-envoi";
import { relatif, heure } from "@/lib/dates";
import { taille, cn } from "@/lib/utils";
import { BoutonAssistant } from "@/modules/ia/BoutonAssistant";
import type { DevoirDetail, DevoirDetailEtudiant, RecuDepot } from "@shared/schema";
import { ZoneRendu } from "./composants/ZoneRendu";
import { EcranRecu, EcranEnAttente, ListePieces, Vignette } from "./composants/Recu";
import { Coches } from "./composants/CarteDevoir";
import { useEvenementsDevoirs } from "./PageDevoirs";
import { dateEtHeureCourte, lienEcrireAuFormateur, nombre } from "./outils";

export default function PageDevoir({ id }: { id: string }) {
  const moi = useMoiConnecte();
  const devoirId = Number(id);
  const { data, isLoading, error, refetch } = useQuery<DevoirDetail>({ queryKey: ["/api/devoirs", devoirId], enabled: Number.isInteger(devoirId) });
  useEvenementsDevoirs();

  if (isLoading) {
    return (
      <Page className="max-w-5xl">
        <Chargement lignes={3} />
      </Page>
    );
  }
  if (error || !data) {
    const statut = error instanceof ErreurApi ? error.statut : 0;
    return (
      <Page className="max-w-3xl">
        {statut === 403 || statut === 404 ? (
          <EtatVide
            icone={<ClipboardList className="h-6 w-6" />}
            titre={statut === 404 ? "Ce devoir n'existe pas (ou plus)." : "Ce devoir ne t'est pas accessible."}
            texte={(error as Error).message}
            action={
              <LienBouton href="/devoirs" variante="contour" icone={<ArrowLeft className="h-4 w-4" />} className="min-h-[48px]">
                Mes devoirs
              </LienBouton>
            }
          />
        ) : (
          <Erreur message={(error as Error)?.message ?? "Devoir introuvable."} reessayer={() => void refetch()} />
        )}
      </Page>
    );
  }
  // Le formateur et l'équipe arrivent sur l'éditeur ; une interrogation se passe sur son écran dédié.
  if (data.vue === "enseignant") return <Redirect to={`/enseigner/devoirs/${devoirId}`} replace />;
  if (data.devoir.type === "quiz") return <Redirect to={`/quiz/${devoirId}`} replace />;
  return <DevoirEtudiant d={data} utilisateurId={moi.id} />;
}

function DevoirEtudiant({ d, utilisateurId }: { d: DevoirDetailEtudiant; utilisateurId: number }) {
  const maintenant = useMaintenant(30_000);
  const [remplacer, setRemplacer] = useState(false);
  const [recu, setRecu] = useState<RecuDepot | null>(null);
  const [cleEnFile, setCleEnFile] = useState<string | null>(null);
  const file = useFileEnvoi();
  const enAttente = file.find((e) => e.url === `/api/devoirs/${d.devoir.id}/rendre`);

  const recuArrive = useCallback(
    (r: RecuDepot) => {
      setCleEnFile(null);
      setRemplacer(false);
      setRecu(r);
      void rafraichir("/api/devoirs", "/api/notes");
    },
    [],
  );

  const { devoir, rendu, statut } = d;
  const depasse = new Date(devoir.dateLimite).getTime() < maintenant;
  const renduEnvoye = rendu && rendu.statut !== "brouillon" ? rendu : null;
  const lienFormateur = lienEcrireAuFormateur(devoir.formateur?.id, devoir.titre);

  // Écrans plein cadre : reçu, ou copie en attente de réseau.
  let principal: React.ReactNode;
  if (recu) principal = <EcranRecu recu={recu} onFermer={() => setRecu(null)} />;
  else if (enAttente || cleEnFile) principal = <EcranEnAttente cle={enAttente?.cle ?? cleEnFile ?? undefined} titre={devoir.titre} onRecu={recuArrive} />;
  else if (d.peutRendre && (!renduEnvoye || remplacer)) {
    principal = (
      <ZoneRendu
        utilisateurId={utilisateurId}
        devoir={{ id: devoir.id, titre: devoir.titre }}
        remplacement={Boolean(renduEnvoye)}
        renduPrecedentLe={renduEnvoye?.renduLe ?? null}
        texteServeur={rendu?.statut === "brouillon" ? rendu.texte : null}
        enRetard={depasse}
        onRecu={recuArrive}
        onEnFile={setCleEnFile}
        onAnnuler={renduEnvoye ? () => setRemplacer(false) : undefined}
      />
    );
  } else principal = null;

  return (
    <Page className="max-w-5xl">
      <Link href="/devoirs" className="-mb-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-semibold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" /> Mes devoirs
      </Link>
      <EnTetePage
        etiquette={`${devoir.coursCode} · ${devoir.coursTitre}`}
        titre={devoir.titre}
        sousTitre={
          <span className={cn(depasse && !renduEnvoye && "font-semibold text-danger")}>
            <Clock className="mr-1.5 inline h-4 w-4 align-[-2px]" />
            {renduEnvoye
              ? `Date limite : ${dateEtHeureCourte(devoir.dateLimite)} (heure d'Abidjan)`
              : `À rendre avant le ${dateEtHeureCourte(devoir.dateLimite)} (heure d'Abidjan) · ${relatif(devoir.dateLimite, maintenant)}`}
          </span>
        }
      />

      {/* Téléphone : état de la copie, puis consigne, puis « Rendre ». Ordinateur : consigne à gauche, le reste à droite. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-6">
        {!recu && (
          <div className="flex flex-col gap-5 empty:hidden lg:col-start-2 lg:row-start-1">
            <EtatCopie d={d} onRemplacer={() => setRemplacer(true)} remplacement={remplacer} enAttente={Boolean(enAttente || cleEnFile)} />
          </div>
        )}
        <div className="flex flex-col gap-5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <Carte className="flex flex-col gap-4 p-5 sm:p-6">
            <h2 className="text-lg font-extrabold">Consigne</h2>
            {devoir.consigne.trim() ? <Markdown source={devoir.consigne} className="text-base" /> : <p className="text-texte-pale">Pas de consigne écrite : suis les indications données en cours.</p>}
            {devoir.piecesJointes.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-[15px] font-bold">Documents joints</h3>
                <ListePieces pieces={devoir.piecesJointes} />
              </div>
            )}
          </Carte>

          {devoir.grille.length > 0 && statut !== "corrige" && (
            <Carte className="flex flex-col gap-3 p-5 sm:p-6">
              <h2 className="text-lg font-extrabold">Comment tu seras noté</h2>
              <ul className="flex flex-col divide-y divide-ligne-douce">
                {devoir.grille.map((g) => (
                  <li key={g.critere} className="flex items-start justify-between gap-4 py-2.5">
                    <span className="flex flex-col">
                      <span className="text-[15px] font-semibold">{g.critere}</span>
                      {g.description && <span className="text-sm text-texte-pale">{g.description}</span>}
                    </span>
                    <span className="shrink-0 font-mono text-sm text-texte-gris">{nombre(g.points)} pts</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-texte-gris">
                Noté sur {nombre(devoir.bareme)} · coefficient {nombre(devoir.coefficient)}
              </p>
            </Carte>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <LienBouton href={lienFormateur} variante="contour" icone={<MessageCircle className="h-5 w-5" />} className="min-h-[52px] whitespace-nowrap">
              Écrire au formateur
            </LienBouton>
            <BoutonAssistant coursId={devoir.coursId} devoirId={devoir.id} variante="bouton" />
          </div>
        </div>

        {principal && <div className={cn("flex flex-col gap-5 lg:col-start-2", recu ? "lg:row-start-1" : "lg:row-start-2")}>{principal}</div>}
      </div>
    </Page>
  );
}

/** Où en est la copie : retard, manqué, ✓ envoyé, ✓✓ vu, ou la correction publiée. */
function EtatCopie({ d, onRemplacer, remplacement, enAttente }: { d: DevoirDetailEtudiant; onRemplacer: () => void; remplacement: boolean; enAttente: boolean }) {
  const { rendu, statut, devoir } = d;
  const [voirCopie, setVoirCopie] = useState(false);
  if (enAttente) return null;

  if (statut === "corrige" && rendu) {
    return (
      <section className="flex flex-col gap-4 rounded-[24px] bg-encre p-5 text-white sm:p-6" aria-label="Correction">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-orange-peche">Corrigé{rendu.correcteur ? ` par ${rendu.correcteur.prenom} ${rendu.correcteur.nom}` : ""}</div>
            <div className="mt-1 text-[56px] font-black leading-none tracking-tres-serre tabular-nums">
              {nombre(rendu.note)}
              <span className="text-2xl text-nuit-gris">/{nombre(devoir.bareme)}</span>
            </div>
          </div>
          {rendu.enRetard && <Badge ton="direct">Rendu en retard</Badge>}
        </div>
        {rendu.noteDetail && rendu.noteDetail.length > 0 && (
          <ul className="flex flex-col gap-3">
            {rendu.noteDetail.map((l) => (
              <li key={l.critere} className="flex flex-col gap-1.5">
                <span className="flex justify-between gap-3 text-[15px]">
                  <span>{l.critere}</span>
                  <span className="font-mono text-nuit-doux">
                    {nombre(l.obtenu)}/{nombre(l.points)}
                  </span>
                </span>
                <BarreProgression valeur={(l.obtenu / l.points) * 100} ton="nuit" />
              </li>
            ))}
          </ul>
        )}
        {rendu.commentaireAudio && (
          <div className="flex flex-col gap-2 rounded-2xl bg-nuit-carte p-4">
            <span className="flex items-center gap-2 text-[15px] font-bold">
              <Mic className="h-4 w-4 text-orange" /> Le mot de ton formateur
              <span className="font-mono text-xs font-normal text-nuit-gris">{taille(rendu.commentaireAudio.taille)}</span>
            </span>
            <audio controls preload="none" src={rendu.commentaireAudio.url} className="w-full">
              Ton navigateur ne peut pas lire ce message vocal.
            </audio>
          </div>
        )}
        {rendu.commentaire && <p className="whitespace-pre-line rounded-2xl bg-nuit-carte p-4 text-[15.5px] leading-relaxed text-nuit-texte">{rendu.commentaire}</p>}
        <Bouton variante="nuit" onClick={() => setVoirCopie((v) => !v)} icone={<Eye className="h-4 w-4" />} className="min-h-[48px]">
          {voirCopie ? "Masquer ma copie" : "Revoir ma copie"}
        </Bouton>
        {voirCopie && <MaCopie rendu={rendu} nuit />}
      </section>
    );
  }

  if (rendu && (statut === "rendu" || statut === "vu")) {
    return (
      <section className="flex flex-col gap-3 rounded-[24px] border border-succes/30 bg-succes-clair p-5" aria-label="Ma copie">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-succes" />
          <div className="flex flex-col gap-1">
            <span className="text-[17px] font-extrabold">
              Rendu · reçu n° <span className="font-mono">{rendu.recu}</span>
            </span>
            <span className="text-[15px] text-texte-doux">
              Reçu le {rendu.renduLe ? dateEtHeureCourte(rendu.renduLe) : ""}
              {rendu.deposeParEquipe ? " · copie papier déposée par la vie scolaire" : ""}
            </span>
            {rendu.prepareLe && <span className="text-sm text-texte-pale">Préparé sur ton téléphone à {heure(rendu.prepareLe)}, envoyé au retour du réseau.</span>}
            <span className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold">
              <Coches vu={statut === "vu"} className="h-5 w-5" />
              {statut === "vu" ? "Ton formateur a ouvert ta copie." : "Ton formateur ne l'a pas encore ouverte."}
            </span>
            {rendu.enRetard && <Badge ton="danger" className="mt-1 self-start">Rendu en retard</Badge>}
          </div>
        </div>
        <p className="text-sm text-texte-pale">La note apparaîtra ici quand ton formateur l'aura publiée. Tu recevras un rappel.</p>
        <div className="flex flex-wrap gap-2">
          <Bouton variante="contour" onClick={() => setVoirCopie((v) => !v)} icone={<Eye className="h-4 w-4" />} className="min-h-[48px] flex-1">
            {voirCopie ? "Masquer ma copie" : "Voir ma copie"}
          </Bouton>
          {d.peutRemplacer && !remplacement && (
            <Bouton variante="encre" onClick={onRemplacer} className="min-h-[48px] flex-1">
              Remplacer ma copie
            </Bouton>
          )}
        </div>
        {voirCopie && <MaCopie rendu={rendu} />}
      </section>
    );
  }

  if (statut === "en_retard") {
    return (
      <p className="flex items-start gap-3 rounded-[20px] bg-danger-clair p-4 text-[15px] text-danger">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          <strong className="block text-base">La date limite est passée.</strong>
          Ton formateur accepte encore les copies en retard : rends-la vite, elle sera marquée « en retard ».
        </span>
      </p>
    );
  }
  if (statut === "manque") {
    return (
      <div className="flex flex-col gap-3 rounded-[20px] bg-creme p-5">
        <strong className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-danger" /> Date limite dépassée
        </strong>
        <p className="text-[15px] text-texte-doux">Ce devoir n'accepte plus de copie. Si tu as eu un problème (réseau, maladie…), explique-le à ton formateur.</p>
        <LienBouton href={lienEcrireAuFormateur(devoir.formateur?.id, devoir.titre)} variante="encre" className="min-h-[48px]" icone={<MessageCircle className="h-4 w-4" />}>
          Écrire au formateur
        </LienBouton>
      </div>
    );
  }
  return null;
}

function MaCopie({ rendu, nuit }: { rendu: NonNullable<DevoirDetailEtudiant["rendu"]>; nuit?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl p-3", nuit ? "bg-nuit-carte" : "bg-white")}>
      {rendu.fichiers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rendu.fichiers.map((f) => (
            <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir ${f.nom}`}>
              <Vignette f={f} className="h-28 w-20" />
            </a>
          ))}
        </div>
      )}
      {rendu.texte.trim() && <p className={cn("whitespace-pre-line text-[15px] leading-relaxed", nuit ? "text-nuit-texte" : "text-texte-doux")}>{rendu.texte}</p>}
    </div>
  );
}
