// « Rendre mon devoir » : gros bouton « Prendre en photo » (plusieurs pages,
// ordre, suppression, aperçu), « Ajouter un fichier », texte. Tout est gardé
// sur le téléphone (texte dans localStorage, pages dans IndexedDB) jusqu'à
// l'envoi, qui passe par la file d'envoi hors ligne : reçu vert tout de suite,
// ou « En attente de réseau, partira tout seul » — le brouillon n'est effacé
// qu'une fois le reçu arrivé.
import { useEffect, useRef, useState } from "react";
import { Camera, Paperclip, Trash2, ArrowLeft, ArrowRight, Send, FileText, Check } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { ZoneTexte } from "@/components/ui/champs";
import { Fenetre } from "@/components/ui/fenetre";
import { toastErreur } from "@/components/ui/toast";
import { alleger, put } from "@/lib/api";
import { envoyerOuMettreEnFile } from "@/lib/file-envoi";
import { maintenantServeur } from "@/lib/horloge";
import { taille, pluriel, cn } from "@/lib/utils";
import type { RecuDepot } from "@shared/schema";
import {
  lireTexteBrouillon,
  ecrireTexteBrouillon,
  lirePagesBrouillon,
  ecrirePagesBrouillon,
  effacerBrouillon,
  effacerBrouillonAuRecu,
  oublierEnvoi,
  dateEtHeureCourte,
  type PageBrouillon,
} from "../outils";

const idPage = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Aperçu d'une page (URL locale libérée quand la vignette disparaît). */
function ApercuPage({ page, className }: { page: PageBrouillon; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(page.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [page.blob]);
  if (!page.type.startsWith("image/")) {
    return (
      <span className={cn("grid place-items-center bg-creme p-2 text-center", className)}>
        <FileText className="h-7 w-7 text-orange-fonce" />
        <span className="line-clamp-2 break-all text-[11px] text-texte-pale">{page.nom}</span>
      </span>
    );
  }
  return url ? <img src={url} alt={page.nom} className={cn("object-cover", className)} /> : <span className={cn("bg-creme", className)} />;
}

export function ZoneRendu({
  utilisateurId,
  devoir,
  remplacement,
  renduPrecedentLe,
  texteServeur,
  enRetard,
  onRecu,
  onEnFile,
  onAnnuler,
}: {
  utilisateurId: number;
  devoir: { id: number; titre: string };
  /** Une copie est déjà rendue : l'envoi la remplacera. */
  remplacement: boolean;
  renduPrecedentLe: string | null;
  /** Brouillon enregistré sur le campus (autre téléphone), repris si rien n'est gardé ici. */
  texteServeur: string | null;
  enRetard: boolean;
  onRecu: (r: RecuDepot) => void;
  onEnFile: (cle: string) => void;
  onAnnuler?: () => void;
}) {
  const [texte, setTexte] = useState(() => lireTexteBrouillon(utilisateurId, devoir.id) || texteServeur || "");
  const [pages, setPages] = useState<PageBrouillon[]>([]);
  const [chargees, setChargees] = useState(false);
  const [traitement, setTraitement] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [apercu, setApercu] = useState<PageBrouillon | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [garde, setGarde] = useState(false);
  const photo = useRef<HTMLInputElement>(null);
  const fichier = useRef<HTMLInputElement>(null);

  // Pages gardées lors d'une visite précédente (ou avant que l'appareil photo ne recharge la page).
  useEffect(() => {
    void lirePagesBrouillon(utilisateurId, devoir.id).then((p) => {
      setPages(p);
      setChargees(true);
    });
  }, [utilisateurId, devoir.id]);

  useEffect(() => {
    if (chargees) void ecrirePagesBrouillon(utilisateurId, devoir.id, pages);
  }, [pages, chargees, utilisateurId, devoir.id]);

  // Texte : gardé sur le téléphone à chaque frappe, et sur le campus (brouillon) après une pause.
  useEffect(() => {
    ecrireTexteBrouillon(utilisateurId, devoir.id, texte);
    if (!texte.trim()) return;
    setGarde(true);
    if (remplacement || !navigator.onLine) return;
    const t = setTimeout(() => void put(`/api/devoirs/${devoir.id}/brouillon`, { texte, fichierIds: [] }).catch(() => undefined), 4000);
    return () => clearTimeout(t);
  }, [texte, utilisateurId, devoir.id, remplacement]);

  async function ajouter(liste: FileList | null) {
    if (!liste?.length) return;
    setTraitement(true);
    try {
      const nouvelles: PageBrouillon[] = [];
      for (const f of Array.from(liste)) {
        // Photo allégée tout de suite (~250 Ko au lieu de 4 Mo) : le poids affiché est celui qui partira.
        const leger = await alleger(f);
        nouvelles.push({ id: idPage(), nom: leger.name || f.name, type: leger.type || f.type || "application/octet-stream", blob: leger });
      }
      setPages((p) => [...p, ...nouvelles].slice(0, 30));
    } finally {
      setTraitement(false);
      if (photo.current) photo.current.value = "";
      if (fichier.current) fichier.current.value = "";
    }
  }

  const deplacer = (i: number, sens: -1 | 1) =>
    setPages((p) => {
      const j = i + sens;
      if (j < 0 || j >= p.length) return p;
      const copie = [...p];
      [copie[i], copie[j]] = [copie[j], copie[i]];
      return copie;
    });

  const poids = pages.reduce((s, p) => s + p.blob.size, 0);
  const photos = pages.filter((p) => p.type.startsWith("image/")).length;
  const vide = !texte.trim() && !pages.length;

  async function envoyer() {
    setConfirmer(false);
    if (vide) return;
    setEnvoi(true);
    const cle = `rendu-${devoir.id}-${Date.now()}`;
    // Le brouillon n'est effacé qu'avec le reçu : tout de suite si l'envoi part, sinon à l'arrivée
    // de « campus:envoi-reussi » pour cette clé (lien posé avant l'envoi, qui peut partir très vite).
    effacerBrouillonAuRecu(cle, utilisateurId, devoir.id);
    try {
      const r = await envoyerOuMettreEnFile<RecuDepot>({
        cle,
        description: `Devoir · ${devoir.titre}`,
        url: `/api/devoirs/${devoir.id}/rendre`,
        methode: "POST",
        corps: { texte, fichierIds: [], prepareLe: new Date(maintenantServeur()).toISOString() },
        fichiers: pages.map((p) => new File([p.blob], p.nom, { type: p.type })),
        usageFichiers: "rendu",
        champFichiers: "fichierIds",
      });
      if (r.statut === "envoye") {
        oublierEnvoi(cle);
        effacerBrouillon(utilisateurId, devoir.id);
        onRecu(r.reponse);
      } else onEnFile(cle); // en attente de réseau : le brouillon reste sur le téléphone jusqu'au reçu
    } catch (e) {
      // Refus immédiat : rien n'est parti, le brouillon reste.
      oublierEnvoi(cle);
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-[24px] border border-ligne bg-white p-4 sm:p-6" aria-labelledby="titre-rendre">
      <div className="flex flex-col gap-1">
        <h2 id="titre-rendre" className="text-[22px] font-black tracking-serre">
          {remplacement ? "Remplacer ma copie" : "Rendre mon devoir"}
        </h2>
        <p className="text-[15px] text-texte-pale">Photographie ton cahier page par page, ajoute un fichier ou écris ta réponse. Tu peux mélanger.</p>
      </div>

      <input ref={photo} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void ajouter(e.target.files)} />
      <input
        ref={fichier}
        type="file"
        multiple
        accept="image/*,application/pdf,.doc,.docx,.odt,.xls,.xlsx,.ppt,.pptx,.txt"
        className="hidden"
        onChange={(e) => void ajouter(e.target.files)}
      />

      <div className="flex flex-col gap-2.5">
        <Bouton taille="lg" pleineLargeur className="min-h-[64px] text-[17px]" icone={<Camera className="h-6 w-6" />} onClick={() => photo.current?.click()} chargement={traitement}>
          {photos ? "Ajouter une page" : "Prendre en photo"}
        </Bouton>
        <Bouton variante="contour" pleineLargeur className="min-h-[52px]" icone={<Paperclip className="h-5 w-5" />} onClick={() => fichier.current?.click()} disabled={traitement}>
          Ajouter un fichier
        </Bouton>
      </div>

      {pages.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-bold">{pluriel(pages.length, photos === pages.length ? "page" : "élément")}</span>
            <span className="font-mono text-xs text-texte-gris">{taille(poids)} à envoyer</span>
          </div>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pages.map((p, i) => (
              <li key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-ligne bg-creme">
                <button type="button" onClick={() => setApercu(p)} className="relative block" aria-label={`Voir la page ${i + 1} en grand`}>
                  <ApercuPage page={p} className="aspect-[3/4] w-full" />
                  <span className="absolute left-2 top-2 rounded-full bg-encre/85 px-2 py-0.5 font-mono text-[11px] text-white">
                    {p.type.startsWith("image/") ? `Page ${i + 1}` : `Fichier ${i + 1}`}
                  </span>
                </button>
                <div className="flex items-center justify-between bg-white px-1 py-1">
                  <button type="button" onClick={() => deplacer(i, -1)} disabled={i === 0} className="grid h-11 w-11 place-items-center rounded-xl text-texte-doux hover:bg-creme disabled:opacity-30" aria-label="Avancer cette page">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => setPages((l) => l.filter((x) => x.id !== p.id))} className="grid h-11 w-11 place-items-center rounded-xl text-danger hover:bg-danger-clair" aria-label="Retirer cette page">
                    <Trash2 className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => deplacer(i, 1)} disabled={i === pages.length - 1} className="grid h-11 w-11 place-items-center rounded-xl text-texte-doux hover:bg-creme disabled:opacity-30" aria-label="Reculer cette page">
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <ZoneTexte
        libelle="Ou écris ta réponse"
        placeholder="Tape ta réponse ici…"
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={5}
        className="[&_textarea]:text-base"
        aide={
          garde && texte.trim() ? (
            <span className="inline-flex items-center gap-1 text-succes">
              <Check className="h-3.5 w-3.5" /> Gardé sur ton téléphone
            </span>
          ) : (
            "Ton texte est gardé sur ce téléphone, même sans réseau."
          )
        }
      />

      {enRetard && <p className="rounded-xl bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger">La date limite est passée : ta copie sera marquée en retard.</p>}

      <div className="flex flex-col gap-2">
        <Bouton
          taille="lg"
          pleineLargeur
          className="min-h-[60px] text-[17px]"
          icone={<Send className="h-5 w-5" />}
          chargement={envoi}
          disabled={vide || traitement}
          onClick={() => (remplacement ? setConfirmer(true) : void envoyer())}
        >
          {remplacement ? "Envoyer ma nouvelle copie" : "Envoyer mon devoir"}
        </Bouton>
        {vide && <p className="text-center text-sm text-texte-gris">Ajoute une photo, un fichier ou un texte pour pouvoir envoyer.</p>}
        {onAnnuler && (
          <Bouton variante="fantome" pleineLargeur onClick={onAnnuler}>
            Garder ma copie actuelle
          </Bouton>
        )}
      </div>

      <Fenetre
        ouverte={Boolean(apercu)}
        onFermer={() => setApercu(null)}
        titre={apercu ? (apercu.type.startsWith("image/") ? `Page ${pages.findIndex((p) => p.id === apercu.id) + 1}` : apercu.nom) : ""}
        large
        pied={
          <>
            <Bouton
              variante="contour"
              icone={<Trash2 className="h-4 w-4" />}
              onClick={() => {
                if (apercu) setPages((l) => l.filter((x) => x.id !== apercu.id));
                setApercu(null);
              }}
            >
              Retirer
            </Bouton>
            <Bouton onClick={() => setApercu(null)}>C'est bon</Bouton>
          </>
        }
      >
        {apercu && <ApercuPage page={apercu} className="max-h-[70dvh] w-full rounded-xl object-contain" />}
      </Fenetre>

      <Fenetre
        ouverte={confirmer}
        onFermer={() => setConfirmer(false)}
        titre="Remplacer ta copie ?"
        description={
          renduPrecedentLe
            ? `Ta nouvelle copie remplacera celle envoyée le ${dateEtHeureCourte(renduPrecedentLe)}. Ton formateur ne verra que la nouvelle.`
            : "Ta nouvelle copie remplacera la précédente. Ton formateur ne verra que la nouvelle."
        }
        pied={
          <>
            <Bouton variante="contour" onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton onClick={() => void envoyer()} chargement={envoi}>
              Oui, remplacer
            </Bouton>
          </>
        }
      />
    </section>
  );
}
