// Écrire ou modifier une leçon : titre, type, contenu Markdown avec aperçu,
// vidéo ou lien, fichier déposé (usage « lecon »), durée, publication.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Paperclip, Trash2, Upload, AlertTriangle } from "lucide-react";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Champ, Selection, CaseACocher } from "@/components/ui/champs";
import { Chargement, Erreur } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { patch, post, suppr, televerser } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { cn, taille } from "@/lib/utils";
import { TYPES_LECON_INFOS, idYoutube } from "../../outils";
import { EditeurMarkdown } from "./EditeurMarkdown";
import { Confirmation } from "./Confirmation";
import { TYPES_LECON, type TypeLecon, type LeconDetail, type ChapitreDuCours, type FichierDeLecon } from "@shared/schema";

export type ModeFenetreLecon = { type: "creation"; chapitreId: number } | { type: "edition"; leconId: number };

type Etat = {
  titre: string;
  type: TypeLecon;
  contenu: string;
  url: string;
  duree: string;
  fichier: FichierDeLecon | null;
  publiee: boolean;
  chapitreId: number;
};

const ACCEPTE: Record<TypeLecon, string> = {
  texte: "application/pdf,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.ods,.odp,.txt,.csv,.zip",
  video: "video/mp4,video/webm",
  pdf: "application/pdf",
  lien: "application/pdf",
  fichier: "application/pdf,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.ods,.odp,.txt,.csv,.zip,audio/*",
};

/** Au-delà, on prévient : un étudiant en 4G prépayée paie chaque méga. */
const POIDS_ALERTE = 8 * 1024 * 1024;

export function FenetreLecon({
  coursId,
  chapitres,
  mode,
  onFermer,
  coursPublie,
}: {
  coursId: number;
  chapitres: ChapitreDuCours[];
  mode: ModeFenetreLecon | null;
  onFermer: () => void;
  /** Les étudiants ne sont prévenus d'une leçon que si le cours est publié. */
  coursPublie: boolean;
}) {
  const edition = mode?.type === "edition" ? mode.leconId : null;
  const { data: lecon, isLoading, error, isFetchedAfterMount } = useQuery<LeconDetail>({
    queryKey: ["/api/cours", coursId, "lecons", edition ?? 0],
    enabled: edition !== null,
    staleTime: 0,
  });
  const [etat, setEtat] = useState<Etat | null>(null);
  const [erreurs, setErreurs] = useState<Partial<Record<keyof Etat, string>>>({});
  const [envoi, setEnvoi] = useState(false);
  const [depot, setDepot] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);

  // Initialise le formulaire une seule fois par ouverture : un
  // rafraîchissement en arrière-plan n'écrase jamais ce qui est en cours de saisie.
  const initialise = useRef<ModeFenetreLecon | null>(null);
  useEffect(() => {
    if (!mode) {
      initialise.current = null;
      setEtat(null);
      setErreurs({});
      return;
    }
    if (initialise.current === mode) return;
    if (mode.type === "creation") {
      initialise.current = mode;
      setEtat({ titre: "", type: "texte", contenu: "", url: "", duree: "", fichier: null, publiee: false, chapitreId: mode.chapitreId });
    } else if (lecon && lecon.id === mode.leconId && isFetchedAfterMount) {
      // On attend la version fraîche du serveur, pas celle du cache.
      initialise.current = mode;
      setEtat({
        titre: lecon.titre,
        type: lecon.type,
        contenu: lecon.contenu,
        url: lecon.url ?? "",
        duree: lecon.dureeMinutes ? String(lecon.dureeMinutes) : "",
        fichier: lecon.fichier,
        publiee: lecon.publiee,
        chapitreId: lecon.chapitre.id,
      });
    }
  }, [mode, lecon, isFetchedAfterMount]);

  const maj = (m: Partial<Etat>) => setEtat((e) => (e ? { ...e, ...m } : e));

  async function deposer(f: File | undefined) {
    if (!f) return;
    setDepot(true);
    try {
      const [depose] = await televerser([f], "lecon");
      maj({ fichier: depose });
      if (depose.taille > POIDS_ALERTE) toast(`Fichier lourd (${taille(depose.taille)}) : pensez aux étudiants en 4G, un PDF compressé suffit souvent.`, "info");
    } catch (e) {
      toastErreur(e);
    } finally {
      setDepot(false);
      if (fichierRef.current) fichierRef.current.value = "";
    }
  }

  function verifier(e: Etat) {
    const r: Partial<Record<keyof Etat, string>> = {};
    if (!e.titre.trim()) r.titre = "Donnez un titre à la leçon.";
    if (e.url && !/^https?:\/\/\S+$/.test(e.url.trim())) r.url = "L'adresse doit commencer par https://";
    if (e.type === "video" && !e.url.trim() && !e.fichier?.mime.startsWith("video/")) r.url = "Collez l'adresse de la vidéo YouTube, ou déposez un fichier vidéo.";
    if (e.type === "lien" && !e.url.trim()) r.url = "Collez l'adresse du site.";
    if ((e.type === "pdf" || e.type === "fichier") && !e.fichier) r.fichier = "Déposez le fichier de la leçon.";
    if (e.type === "pdf" && e.fichier && e.fichier.mime !== "application/pdf") r.fichier = "Ce fichier n'est pas un PDF : choisissez le type « Fichier ».";
    if (e.duree && (!/^\d+$/.test(e.duree) || Number(e.duree) < 1 || Number(e.duree) > 600)) r.duree = "Une durée en minutes, entre 1 et 600.";
    return r;
  }

  const messagePublication = coursPublie
    ? "Leçon publiée : les étudiants sont prévenus."
    : "Leçon publiée. Les étudiants la verront quand le cours sera publié.";

  async function enregistrer() {
    if (!etat || !mode) return;
    const r = verifier(etat);
    setErreurs(r);
    if (Object.keys(r).length) return;
    setEnvoi(true);
    const corps = {
      titre: etat.titre.trim(),
      type: etat.type,
      contenu: etat.contenu,
      url: etat.type === "video" || etat.type === "lien" ? etat.url.trim() || null : null,
      fichierId: etat.fichier?.id ?? null,
      dureeMinutes: etat.duree ? Number(etat.duree) : null,
      publiee: etat.publiee,
    };
    try {
      if (mode.type === "creation") {
        await post(`/api/chapitres/${etat.chapitreId}/lecons`, corps);
        toast(etat.publiee ? messagePublication : "Leçon enregistrée en brouillon.");
      } else {
        const avantPubliee = lecon?.publiee;
        await patch(`/api/lecons/${mode.leconId}`, { ...corps, ...(lecon && etat.chapitreId !== lecon.chapitre.id ? { chapitreId: etat.chapitreId } : {}) });
        toast(!avantPubliee && etat.publiee ? messagePublication : "Leçon enregistrée.");
      }
      await rafraichir("/api/cours");
      onFermer();
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer() {
    if (mode?.type !== "edition") return;
    setEnvoi(true);
    try {
      await suppr(`/api/lecons/${mode.leconId}`);
      toast("Leçon supprimée.");
      await rafraichir("/api/cours");
      setConfirmer(false);
      onFermer();
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  const yt = etat?.type === "video" ? idYoutube(etat.url) : null;

  return (
    <>
      <Fenetre
        ouverte={Boolean(mode)}
        onFermer={onFermer}
        large
        titre={mode?.type === "creation" ? "Nouvelle leçon" : "Modifier la leçon"}
        description={mode?.type === "creation" ? "Elle reste en brouillon tant que vous ne cochez pas « Publier »." : undefined}
        pied={
          <>
            {mode?.type === "edition" && (
              <Bouton variante="fantome" icone={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmer(true)} className="mr-auto min-h-[48px] text-danger hover:text-danger">
                Supprimer
              </Bouton>
            )}
            <Bouton variante="fantome" onClick={onFermer} className="min-h-[48px]">
              Annuler
            </Bouton>
            <Bouton chargement={envoi} onClick={() => void enregistrer()} disabled={!etat || depot} className="min-h-[48px]">
              {etat?.publiee && !(lecon?.publiee && mode?.type === "edition") ? "Enregistrer et publier" : "Enregistrer"}
            </Bouton>
          </>
        }
      >
        {edition !== null && (isLoading || !etat) && !error ? (
          <Chargement lignes={3} />
        ) : error ? (
          <Erreur message={(error as Error).message} />
        ) : etat ? (
          <div className="flex flex-col gap-5 pb-2">
            <Champ libelle="Titre de la leçon" value={etat.titre} onChange={(e) => maj({ titre: e.target.value })} erreur={erreurs.titre} maxLength={160} className="[&_input]:text-base" autoFocus={mode?.type === "creation"} />

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-bold">Type de leçon</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {TYPES_LECON.map((t) => {
                  const I = TYPES_LECON_INFOS[t].icone;
                  const actif = etat.type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={actif}
                      onClick={() => maj({ type: t })}
                      className={cn(
                        "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] px-2 py-2 text-sm font-bold transition-colors",
                        actif ? "border-encre bg-orange-pale text-encre" : "border-ligne text-texte-pale hover:border-ligne-forte hover:text-encre",
                      )}
                    >
                      <I className="h-5 w-5" />
                      {TYPES_LECON_INFOS[t].libelle}
                    </button>
                  );
                })}
              </div>
              <p className="text-[13px] text-texte-gris">{TYPES_LECON_INFOS[etat.type].aide}</p>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              {chapitres.length > 1 && (
                <Selection libelle="Chapitre" value={etat.chapitreId} onChange={(e) => maj({ chapitreId: Number(e.target.value) })} className="[&_select]:text-base">
                  {chapitres.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.numero}. {ch.titre}
                    </option>
                  ))}
                </Selection>
              )}
              <Champ
                libelle="Durée (minutes)"
                inputMode="numeric"
                value={etat.duree}
                onChange={(e) => maj({ duree: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                erreur={erreurs.duree}
                placeholder="10"
                aide={etat.type === "video" ? "Sert à estimer le poids de la vidéo pour l'étudiant." : "Temps de lecture ou de travail estimé."}
                className="[&_input]:text-base"
              />
            </div>

            {(etat.type === "video" || etat.type === "lien") && (
              <Champ
                libelle={etat.type === "video" ? "Adresse de la vidéo" : "Adresse du site"}
                type="url"
                inputMode="url"
                value={etat.url}
                onChange={(e) => maj({ url: e.target.value })}
                erreur={erreurs.url}
                placeholder={etat.type === "video" ? "https://www.youtube.com/watch?v=…" : "https://…"}
                aide={
                  etat.type === "video"
                    ? yt
                      ? "Vidéo YouTube reconnue : l'étudiant verra d'abord la miniature et choisira de la charger."
                      : "YouTube de préférence : l'étudiant verra seulement la miniature et le poids estimé avant de charger."
                    : "Le lien s'ouvrira dans un nouvel onglet."
                }
                className="[&_input]:text-base"
              />
            )}

            {etat.type !== "lien" && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-bold">
                  {etat.type === "pdf" ? "Fichier PDF" : etat.type === "fichier" ? "Fichier à télécharger" : etat.type === "video" ? "Ou un fichier vidéo (facultatif)" : "Support joint (facultatif)"}
                </span>
                {etat.fichier ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ligne bg-creme px-4 py-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Paperclip className="h-4 w-4 shrink-0 text-orange-fonce" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{etat.fichier.nom}</span>
                        <span className={cn("font-mono text-[13px]", etat.fichier.taille > POIDS_ALERTE ? "text-alerte" : "text-texte-pale")}>
                          {taille(etat.fichier.taille)}
                          {etat.fichier.taille > POIDS_ALERTE && " · lourd pour la 4G"}
                        </span>
                      </span>
                    </span>
                    <span className="flex gap-1">
                      <Bouton variante="fantome" taille="sm" onClick={() => fichierRef.current?.click()} chargement={depot} className="min-h-[44px]">
                        Remplacer
                      </Bouton>
                      <Bouton variante="fantome" taille="sm" onClick={() => maj({ fichier: null })} className="min-h-[44px]">
                        Retirer
                      </Bouton>
                    </span>
                  </div>
                ) : (
                  <Bouton variante="contour" icone={<Upload className="h-4 w-4" />} chargement={depot} onClick={() => fichierRef.current?.click()} className="min-h-[52px] self-start">
                    Déposer un fichier
                  </Bouton>
                )}
                <input ref={fichierRef} type="file" accept={ACCEPTE[etat.type]} className="hidden" onChange={(e) => void deposer(e.target.files?.[0])} />
                {erreurs.fichier ? (
                  <p className="text-[13px] font-semibold text-danger">{erreurs.fichier}</p>
                ) : (
                  <p className="text-[13px] text-texte-gris">L'étudiant voit le poids avant de télécharger. 25 Mo au plus.</p>
                )}
              </div>
            )}

            <EditeurMarkdown valeur={etat.contenu} onChange={(contenu) => maj({ contenu })} libelle={etat.type === "texte" ? "Contenu de la leçon" : "Texte d'accompagnement (facultatif)"} />

            <div className="rounded-2xl border border-ligne p-4">
              <CaseACocher
                checked={etat.publiee}
                onChange={(publiee) => maj({ publiee })}
                libelle="Publier la leçon"
                aide={
                  !etat.publiee
                    ? "Brouillon : seuls les formateurs et l'équipe la voient."
                    : coursPublie
                      ? "Les étudiants la voient. À la première publication, ils reçoivent une notification (sans sonnerie)."
                      : "Elle sera visible dès que le cours sera publié."
                }
              />
            </div>

            {etat.publiee && etat.type === "texte" && !etat.contenu.trim() && (
              <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-alerte">
                <AlertTriangle className="h-4 w-4" /> La leçon est vide : les étudiants verront une page blanche.
              </p>
            )}
          </div>
        ) : null}
      </Fenetre>

      <Confirmation
        ouverte={confirmer}
        onFermer={() => setConfirmer(false)}
        titre="Supprimer la leçon ?"
        texte="La leçon et la progression des étudiants sur cette leçon seront effacées. Cette action est définitive."
        libelle="Supprimer"
        variante="danger"
        chargement={envoi}
        onConfirmer={() => void supprimer()}
      />
    </>
  );
}
