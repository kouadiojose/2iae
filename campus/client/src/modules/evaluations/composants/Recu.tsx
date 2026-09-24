// Écran de reçu vert (la preuve à montrer : « Monsieur, je l'avais envoyé »)
// et écran « En attente de réseau » quand la copie est rangée dans la file.
import { useEffect } from "react";
import { CheckCircle2, CloudUpload, FileText, Share2, Clock } from "lucide-react";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { heure } from "@/lib/dates";
import { taille, pluriel } from "@/lib/utils";
import type { RecuDepot, PieceJointe } from "@shared/schema";
import { dateEtHeureCourte } from "../outils";

/** Miniature d'une pièce jointe : la photo elle-même, ou une icône de fichier avec son poids. */
export function Vignette({ f, className = "h-20 w-16" }: { f: PieceJointe; className?: string }) {
  if (f.mime.startsWith("image/")) {
    return <img src={f.url} alt={f.nom} loading="lazy" className={`${className} shrink-0 rounded-lg border border-ligne bg-creme object-cover`} />;
  }
  return (
    <span className={`${className} grid shrink-0 place-items-center rounded-lg border border-ligne bg-creme p-1 text-center`}>
      <FileText className="h-5 w-5 text-orange-fonce" />
      <span className="line-clamp-2 break-all text-[9px] leading-tight text-texte-pale">{f.nom}</span>
    </span>
  );
}

function partager(recu: RecuDepot) {
  const texte = `✓ Rendu · reçu n° ${recu.recu} · ${heure(recu.renduLe)} · ${recu.coursCode} « ${recu.titre} » (Campus numérique 2IAE)`;
  const nav = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> };
  if (nav.share) void nav.share({ title: "Reçu de dépôt", text: texte }).catch(() => undefined);
  else window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, "_blank", "noopener");
}

export function EcranRecu({ recu, onFermer }: { recu: RecuDepot; onFermer?: () => void }) {
  const pages = recu.fichiers.filter((f) => f.mime.startsWith("image/")).length;
  const autres = recu.fichiers.length - pages;
  const contenu = [pages ? pluriel(pages, "page") : null, autres ? pluriel(autres, "fichier") : null, recu.aDuTexte ? "texte" : null].filter(Boolean).join(" · ");
  return (
    <section className="flex flex-col items-center gap-5 rounded-[28px] bg-succes-clair px-5 py-8 text-center animate-monte sm:px-10" aria-live="polite">
      <span className="grid h-20 w-20 place-items-center rounded-full bg-succes text-white shadow-carte">
        <CheckCircle2 className="h-11 w-11" strokeWidth={2.2} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[28px] font-black leading-tight tracking-serre text-encre">{recu.remplace ? "Nouvelle copie reçue" : "Devoir reçu"}</h2>
        <p className="text-base text-texte-doux">
          {recu.coursCode} · « {recu.titre} »
        </p>
      </div>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-left shadow-carte">
        <div className="font-mono text-[11px] uppercase tracking-wider text-texte-gris">Reçu de dépôt</div>
        <div className="mt-1 font-mono text-[28px] font-semibold tracking-wide text-encre">{recu.recu}</div>
        <div className="mt-3 flex items-start gap-2 text-[15px] text-texte-doux">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-succes" />
          <span>
            Reçu par le campus le {dateEtHeureCourte(recu.renduLe)}
            {contenu && <span className="block text-texte-pale">{contenu}</span>}
          </span>
        </div>
        {recu.enRetard && <p className="mt-3 rounded-xl bg-danger-clair px-3 py-2 text-sm font-semibold text-danger">Rendu après la date limite : ton formateur le verra en retard.</p>}
        {recu.remplace && <p className="mt-3 text-sm text-texte-pale">Ta copie précédente est remplacée : ton formateur verra seulement celle-ci.</p>}
        {recu.fichiers.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {recu.fichiers.map((f) => (
              <Vignette key={f.id} f={f} />
            ))}
          </div>
        )}
      </div>
      <p className="max-w-sm text-sm text-texte-pale">Garde ce numéro : il prouve que ton devoir est bien arrivé. Tu verras ✓✓ quand ton formateur l'ouvrira.</p>
      <div className="flex w-full max-w-sm flex-col gap-2.5">
        <Bouton variante="encre" taille="lg" pleineLargeur icone={<Share2 className="h-5 w-5" />} onClick={() => partager(recu)}>
          Partager le reçu
        </Bouton>
        {onFermer ? (
          <Bouton variante="contour" taille="lg" pleineLargeur onClick={onFermer}>
            Voir mon devoir
          </Bouton>
        ) : (
          <LienBouton href="/devoirs" variante="contour" taille="lg" className="w-full">
            Revenir à mes devoirs
          </LienBouton>
        )}
      </div>
    </section>
  );
}

/** La copie est rangée dans le téléphone : elle partira toute seule. */
export function EcranEnAttente({ cle, titre, onRecu }: { cle?: string; titre: string; onRecu?: (r: RecuDepot) => void }) {
  useEffect(() => {
    const ok = (e: Event) => {
      const detail = (e as CustomEvent<{ cle: string; reponse: unknown }>).detail;
      if (!cle || detail.cle === cle) onRecu?.(detail.reponse as RecuDepot);
    };
    window.addEventListener("campus:envoi-reussi", ok);
    return () => window.removeEventListener("campus:envoi-reussi", ok);
  }, [cle, onRecu]);
  return (
    <section className="flex flex-col items-center gap-4 rounded-[28px] bg-orange-clair px-5 py-8 text-center animate-monte" aria-live="polite">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-orange text-encre">
        <CloudUpload className="h-8 w-8" />
      </span>
      <h2 className="text-2xl font-black tracking-serre">En attente de réseau</h2>
      <p className="max-w-sm text-[15px] leading-relaxed text-texte-doux">
        Ta copie « {titre} » est gardée sur ton téléphone. Elle partira toute seule dès que le réseau revient, même si tu fermes le campus. Tu recevras alors ton reçu.
      </p>
      <p className="text-sm text-texte-pale">C'est l'heure d'arrivée au campus qui compte pour la date limite.</p>
      <LienBouton href="/devoirs" variante="contour" className="min-h-[48px]">
        Revenir à mes devoirs
      </LienBouton>
    </section>
  );
}

/** Liste de pièces jointes avec leur poids (on sait ce qu'on télécharge). */
export function ListePieces({ pieces }: { pieces: PieceJointe[] }) {
  if (!pieces.length) return null;
  return (
    <ul className="flex flex-col gap-2">
      {pieces.map((p) => (
        <li key={p.id}>
          <a
            href={`${p.url}?telecharger=1`}
            className="flex min-h-[56px] items-center gap-3 rounded-xl border border-ligne bg-white px-4 py-2.5 text-encre no-underline hover:border-orange hover:text-encre"
          >
            <FileText className="h-5 w-5 shrink-0 text-orange-fonce" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{p.nom}</span>
            <span className="shrink-0 font-mono text-xs text-texte-gris">{taille(p.taille)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
