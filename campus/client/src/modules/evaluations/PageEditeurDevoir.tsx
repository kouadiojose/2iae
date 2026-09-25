// /enseigner/devoirs/nouveau?cours=<id> et /enseigner/devoirs/:id : éditeur
// d'un devoir ou d'une interrogation. Type, consigne en Markdown, pièces
// jointes, ouverture et échéance (heure d'Abidjan, avec Paris), barème,
// coefficient, retard accepté, grille ; pour une interrogation : durée,
// tentatives, correction visible et questions (avec l'aide de l'IA).
import { useEffect, useRef, useState } from "react";
import { Link, Redirect, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, ListChecks, Paperclip, Trash2, Eye, PenLine, Save, Send, Users } from "lucide-react";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Champ, Selection, ZoneTexte, CaseACocher } from "@/components/ui/champs";
import { Chargement, Erreur, Badge } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { Markdown } from "@/components/ui/markdown";
import { toast, toastErreur } from "@/components/ui/toast";
import { post, patch, suppr, televerser } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { versChampDate, depuisChampDate, heureDouble, jourLong } from "@/lib/dates";
import { maintenantServeur } from "@/lib/horloge";
import { cn, taille } from "@/lib/utils";
import type { DevoirDetail, DevoirDetailEnseignant, PieceJointe, CritereGrille, TypeDevoir } from "@shared/schema";
import { EditeurGrille } from "./composants/EditeurGrille";
import { EditeurQuestions } from "./composants/EditeurQuestions";

type CoursEnseigne = { id: number; code: string; titre: string; couleur: string };

type Formulaire = {
  coursId: number | null;
  type: TypeDevoir;
  titre: string;
  consigne: string;
  pieces: PieceJointe[];
  ouverture: string;
  limite: string;
  bareme: number;
  coefficient: number;
  accepteRetard: boolean;
  dureeMinutes: string;
  tentativesMax: number;
  correctionVisible: boolean;
  grille: CritereGrille[];
  publie: boolean;
};

/** Échéance proposée par défaut : dans 7 jours à 23h59 (heure d'Abidjan). */
function echeanceParDefaut() {
  const d = new Date(maintenantServeur() + 7 * 86_400_000);
  d.setUTCHours(23, 59, 0, 0);
  return versChampDate(d);
}

const depuisDevoir = (d: DevoirDetailEnseignant["devoir"]): Formulaire => ({
  coursId: d.coursId,
  type: d.type,
  titre: d.titre,
  consigne: d.consigne,
  pieces: d.piecesJointes,
  ouverture: versChampDate(d.ouvertureLe),
  limite: versChampDate(d.dateLimite),
  bareme: d.bareme,
  coefficient: d.coefficient,
  accepteRetard: d.accepteRetard,
  dureeMinutes: d.dureeMinutes ? String(d.dureeMinutes) : "",
  tentativesMax: d.tentativesMax,
  correctionVisible: d.correctionVisible,
  grille: d.grille,
  publie: d.publie,
});

/** « jeudi 1 octobre · 23h59 Abidjan · 01h59 Paris » sous un champ de date. */
function AideDate({ valeur }: { valeur: string }) {
  const iso = depuisChampDate(valeur);
  if (!iso) return null;
  return (
    <span>
      {jourLong(iso)} · {heureDouble(iso)}
    </span>
  );
}

export default function PageEditeurDevoir({ id }: { id?: string }) {
  const nouveau = !id;
  const devoirId = Number(id);
  const recherche = new URLSearchParams(useSearch());
  const coursDemande = Number(recherche.get("cours")) || null;
  const [, naviguer] = useLocation();
  const { data, isLoading, error, refetch } = useQuery<DevoirDetail>({ queryKey: ["/api/devoirs", devoirId], enabled: !nouveau && Number.isInteger(devoirId) });
  const { data: mesCours } = useQuery<CoursEnseigne[]>({ queryKey: ["/api/evaluations/cours"] });

  const [f, setF] = useState<Formulaire>(() => ({
    coursId: coursDemande,
    type: "depot",
    titre: "",
    consigne: "",
    pieces: [],
    ouverture: "",
    limite: echeanceParDefaut(),
    bareme: 20,
    coefficient: 1,
    accepteRetard: true,
    dureeMinutes: "20",
    tentativesMax: 1,
    correctionVisible: true,
    grille: [],
    publie: true,
  }));
  const initialise = useRef(false);
  const [apercu, setApercu] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [televersement, setTeleversement] = useState(false);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const pieceRef = useRef<HTMLInputElement>(null);

  const detail = data?.vue === "enseignant" ? data : null;
  useEffect(() => {
    if (detail && !initialise.current) {
      initialise.current = true;
      setF(depuisDevoir(detail.devoir));
    }
  }, [detail]);
  // Un seul cours : il est choisi d'office.
  useEffect(() => {
    if (nouveau && !f.coursId && mesCours?.length === 1) setF((x) => ({ ...x, coursId: mesCours[0].id }));
  }, [mesCours, nouveau, f.coursId]);

  if (!nouveau && isLoading) {
    return (
      <Page className="max-w-5xl">
        <Chargement lignes={4} />
      </Page>
    );
  }
  if (!nouveau && (error || !data)) {
    return (
      <Page className="max-w-3xl">
        <Erreur message={(error as Error)?.message ?? "Devoir introuvable."} reessayer={() => void refetch()} />
      </Page>
    );
  }
  if (data?.vue === "etudiant") return <Redirect to={`/devoirs/${devoirId}`} replace />;

  const maj = (champ: Partial<Formulaire>) => setF((x) => ({ ...x, ...champ }));
  const quiz = f.type === "quiz";
  const typeVerrouille = Boolean(detail?.aDesRendus);
  const questions = detail?.questions ?? [];
  const totalGrille = f.grille.reduce((s, c) => s + (Number(c.points) || 0), 0);
  const grilleOk = !f.grille.length || Math.abs(totalGrille - f.bareme) < 0.001;

  async function ajouterPieces(liste: FileList | null) {
    if (!liste?.length) return;
    setTeleversement(true);
    try {
      const recus = await televerser(Array.from(liste), "devoir");
      maj({ pieces: [...f.pieces, ...recus] });
    } catch (e) {
      toastErreur(e);
    } finally {
      setTeleversement(false);
      if (pieceRef.current) pieceRef.current.value = "";
    }
  }

  function corps() {
    const dateLimite = depuisChampDate(f.limite);
    if (!f.coursId) throw new Error("Choisissez le cours concerné.");
    if (f.titre.trim().length < 2) throw new Error("Donnez un titre au devoir.");
    if (!dateLimite) throw new Error("Indiquez la date limite.");
    if (!grilleOk) throw new Error("Le total de la grille doit être égal au barème.");
    if (f.grille.some((c) => !c.critere.trim())) throw new Error("Chaque critère de la grille doit avoir un nom.");
    return {
      type: f.type,
      titre: f.titre.trim(),
      consigne: f.consigne,
      fichierIds: f.pieces.map((p) => p.id),
      ouvertureLe: depuisChampDate(f.ouverture),
      dateLimite,
      bareme: Number(f.bareme),
      coefficient: Number(f.coefficient),
      accepteRetard: f.accepteRetard,
      dureeMinutes: quiz && f.dureeMinutes ? Number(f.dureeMinutes) : null,
      tentativesMax: Number(f.tentativesMax) || 1,
      correctionVisible: f.correctionVisible,
      grille: f.grille.map((c) => ({ critere: c.critere.trim(), points: Number(c.points), ...(c.description?.trim() ? { description: c.description.trim() } : {}) })),
      publie: f.publie,
    };
  }

  async function enregistrer(publier?: boolean) {
    setEnvoi(true);
    try {
      const c = { ...corps(), ...(publier ? { publie: true } : {}) };
      if (nouveau) {
        const r = await post<DevoirDetailEnseignant>("/api/devoirs", { ...c, coursId: f.coursId });
        await rafraichir("/api/devoirs");
        toast(r.devoir.type === "quiz" ? "Interrogation créée en brouillon : ajoutez vos questions puis publiez-la." : r.devoir.publie ? "Devoir créé. Les étudiants sont prévenus." : "Devoir enregistré (non publié).");
        naviguer(`/enseigner/devoirs/${r.devoir.id}`, { replace: true });
      } else {
        const r = await patch<DevoirDetailEnseignant>(`/api/devoirs/${devoirId}`, c);
        setF(depuisDevoir(r.devoir));
        await rafraichir("/api/devoirs");
        toast(publier ? "Interrogation publiée. Les étudiants sont prévenus." : "Modifications enregistrées.");
      }
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer() {
    try {
      await suppr(`/api/devoirs/${devoirId}`);
      await rafraichir("/api/devoirs");
      toast("Devoir supprimé.");
      naviguer("/corrections", { replace: true });
    } catch (e) {
      setConfirmerSuppression(false);
      toastErreur(e);
    }
  }

  const coursChoisi = mesCours?.find((c) => c.id === f.coursId);

  return (
    <Page className="max-w-6xl">
      <Link href="/corrections" className="-mb-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-semibold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" /> Corrections
      </Link>
      <EnTetePage
        etiquette={coursChoisi ? `${coursChoisi.code} · ${coursChoisi.titre}` : detail ? `${detail.devoir.coursCode} · ${detail.devoir.coursTitre}` : "Nouveau"}
        titre={nouveau ? (quiz ? "Nouvelle interrogation" : "Nouveau devoir") : f.titre || "Devoir"}
        actions={
          detail && (
            <LienBouton href={`/enseigner/devoirs/${devoirId}/copies`} variante="contour" icone={<Users className="h-4 w-4" />} className="min-h-[48px]">
              {quiz ? "Résultats" : "Copies"} ({detail.compteurs.rendus}/{detail.compteurs.inscrits})
            </LienBouton>
          )
        }
      />

      {detail && quiz && !detail.devoir.publie && (
        <div className="flex flex-col gap-3 rounded-2xl bg-alerte-clair p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] text-alerte">
            <strong>Brouillon.</strong> Les étudiants ne voient pas encore cette interrogation.{" "}
            {questions.length ? "Relisez les questions, puis publiez-la." : "Ajoutez au moins une question pour pouvoir la publier."}
          </p>
          <Bouton icone={<Send className="h-4 w-4" />} disabled={!questions.length} onClick={() => void enregistrer(true)} chargement={envoi} className="min-h-[48px] shrink-0">
            Publier l'interrogation
          </Bouton>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          {(nouveau || !typeVerrouille) && (
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Type">
              {(
                [
                  { t: "depot", titre: "Devoir à rendre", texte: "Photo du cahier, fichier ou texte, corrigé par vous.", icone: FileText },
                  { t: "quiz", titre: "Interrogation", texte: "Questions en ligne, corrigées automatiquement.", icone: ListChecks },
                ] as const
              ).map(({ t, titre, texte, icone: Icone }) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={f.type === t}
                  onClick={() => maj({ type: t, ...(t === "quiz" ? { accepteRetard: false } : { accepteRetard: true }) })}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-colors",
                    f.type === t ? "border-orange bg-orange-pale" : "border-ligne bg-white hover:border-orange/60",
                  )}
                >
                  <Icone className={cn("h-6 w-6", f.type === t ? "text-orange-fonce" : "text-texte-gris")} />
                  <span className="text-[16px] font-extrabold">{titre}</span>
                  <span className="text-sm text-texte-pale">{texte}</span>
                </button>
              ))}
            </div>
          )}

          <Carte className="flex flex-col gap-5">
            <Champ libelle="Titre" value={f.titre} onChange={(e) => maj({ titre: e.target.value })} placeholder={quiz ? "Ex. : Interrogation sur les modèles de langage" : "Ex. : Étude de marché d'un maquis"} />
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Consigne</span>
                <Bouton variante="fantome" taille="sm" icone={apercu ? <PenLine className="h-4 w-4" /> : <Eye className="h-4 w-4" />} onClick={() => setApercu((a) => !a)}>
                  {apercu ? "Écrire" : "Aperçu"}
                </Bouton>
              </div>
              {apercu ? (
                <div className="min-h-[160px] rounded-xl border border-ligne bg-creme/40 p-4">
                  {f.consigne.trim() ? <Markdown source={f.consigne} /> : <p className="text-texte-gris">Rien à afficher.</p>}
                </div>
              ) : (
                <ZoneTexte
                  value={f.consigne}
                  onChange={(e) => maj({ consigne: e.target.value })}
                  rows={9}
                  placeholder={"## Ta mission\n\nExplique ce qui est attendu, étape par étape.\n\n1. …\n2. …"}
                  aide="Mise en forme simple : ## titre, **gras**, - liste, 1. liste numérotée. Tutoyez les étudiants, avec des exemples d'ici."
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold">Documents joints</span>
              {f.pieces.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {f.pieces.map((p) => (
                    <li key={p.id} className="flex min-h-[52px] items-center gap-3 rounded-xl border border-ligne px-3">
                      <FileText className="h-5 w-5 shrink-0 text-orange-fonce" />
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[15px] font-semibold text-encre no-underline">
                        {p.nom}
                      </a>
                      <span className="font-mono text-xs text-texte-gris">{taille(p.taille)}</span>
                      <button type="button" onClick={() => maj({ pieces: f.pieces.filter((x) => x.id !== p.id) })} className="grid h-11 w-11 place-items-center rounded-xl text-danger hover:bg-danger-clair" aria-label={`Retirer ${p.nom}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input ref={pieceRef} type="file" multiple className="hidden" onChange={(e) => void ajouterPieces(e.target.files)} />
              <Bouton variante="doux" icone={<Paperclip className="h-4 w-4" />} onClick={() => pieceRef.current?.click()} chargement={televersement} className="min-h-[48px] self-start">
                Joindre un document
              </Bouton>
              <span className="text-[13px] text-texte-gris">Le poids est affiché aux étudiants avant le téléchargement : préférez des PDF légers.</span>
            </div>
          </Carte>

          {!quiz && (
            <Carte className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-extrabold">Grille de correction</h2>
                <p className="text-sm text-texte-pale">Visible des étudiants avant de rendre. Elle guide aussi la correction proposée par l'IA.</p>
              </div>
              <EditeurGrille grille={f.grille} onChange={(grille) => maj({ grille })} bareme={f.bareme} onBareme={(bareme) => maj({ bareme })} />
            </Carte>
          )}

          {quiz && detail && (
            <Carte>
              <EditeurQuestions devoirId={devoirId} questions={questions} iaDisponible={detail.iaDisponible} />
            </Carte>
          )}
          {quiz && nouveau && (
            <p className="rounded-2xl bg-creme p-4 text-[15px] text-texte-doux">Enregistrez d'abord l'interrogation : vous pourrez ensuite écrire les questions (ou les faire proposer par l'IA), puis la publier.</p>
          )}
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
          <Carte className="flex flex-col gap-4">
            {nouveau && (
              <Selection libelle="Cours" value={f.coursId ?? ""} onChange={(e) => maj({ coursId: Number(e.target.value) || null })}>
                <option value="">Choisir un cours…</option>
                {mesCours?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.titre}
                  </option>
                ))}
              </Selection>
            )}
            {typeVerrouille && (
              <Badge ton="gris" className="self-start whitespace-normal">
                {quiz ? "Interrogation" : "Devoir à rendre"} · type verrouillé (copies reçues)
              </Badge>
            )}
            <Champ libelle="Date limite (heure d'Abidjan)" type="datetime-local" value={f.limite} onChange={(e) => maj({ limite: e.target.value })} aide={<AideDate valeur={f.limite} />} />
            <Champ
              libelle="Ouverture (facultatif)"
              type="datetime-local"
              value={f.ouverture}
              onChange={(e) => maj({ ouverture: e.target.value })}
              aide={f.ouverture ? <AideDate valeur={f.ouverture} /> : "Vide : visible dès la publication."}
            />
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle="Barème" type="number" inputMode="decimal" min={1} step={0.5} value={f.bareme} onChange={(e) => maj({ bareme: Number(e.target.value) })} />
              <Champ libelle="Coefficient" type="number" inputMode="decimal" min={0} step={0.5} value={f.coefficient} onChange={(e) => maj({ coefficient: Number(e.target.value) })} />
            </div>
            {quiz ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Champ libelle="Durée (min)" type="number" inputMode="numeric" min={1} value={f.dureeMinutes} onChange={(e) => maj({ dureeMinutes: e.target.value })} aide="Vide : sans chrono." />
                  <Champ libelle="Tentatives" type="number" inputMode="numeric" min={1} max={20} value={f.tentativesMax} onChange={(e) => maj({ tentativesMax: Number(e.target.value) })} />
                </div>
                <CaseACocher
                  checked={f.correctionVisible}
                  onChange={(v) => maj({ correctionVisible: v })}
                  libelle="Correction visible après la date limite"
                  aide="Les étudiants voient leurs erreurs et les explications une fois l'interrogation close."
                />
                <p className="text-[13px] text-texte-gris">Chrono tenu par le serveur ; l'interrogation se ferme à la date limite. La meilleure tentative est retenue.</p>
              </>
            ) : (
              <CaseACocher
                checked={f.accepteRetard}
                onChange={(v) => maj({ accepteRetard: v })}
                libelle="Accepter les copies en retard"
                aide="Elles seront marquées « en retard ». L'heure d'arrivée au campus fait foi."
              />
            )}
            <CaseACocher
              checked={quiz && !questions.length ? false : f.publie}
              onChange={(v) => maj({ publie: v })}
              disabled={quiz && !questions.length}
              libelle="Publié"
              aide={quiz && !questions.length ? "Ajoutez des questions pour pouvoir publier." : "Décoché : les étudiants ne le voient pas."}
            />
            <Bouton taille="lg" pleineLargeur icone={<Save className="h-5 w-5" />} onClick={() => void enregistrer()} chargement={envoi} className="min-h-[56px]">
              {nouveau ? (quiz ? "Créer l'interrogation" : f.publie ? "Créer et prévenir les étudiants" : "Enregistrer") : "Enregistrer"}
            </Bouton>
          </Carte>
          {detail && (
            <Bouton variante="fantome" icone={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmerSuppression(true)} className="self-center text-danger">
              Supprimer ce devoir
            </Bouton>
          )}
        </aside>
      </div>

      <Fenetre
        ouverte={confirmerSuppression}
        onFermer={() => setConfirmerSuppression(false)}
        titre="Supprimer ce devoir ?"
        description="C'est définitif. Si des copies ont déjà été rendues, la suppression est refusée : décochez plutôt « Publié »."
        pied={
          <>
            <Bouton variante="contour" onClick={() => setConfirmerSuppression(false)}>
              Annuler
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
