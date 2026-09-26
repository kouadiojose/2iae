// /formateurs/:slug/presentation : la présentation de 30 secondes d'un
// formateur, en page autonome à partager (WhatsApp, lien copié).
// - téléphone : 9:16 plein écran, barre d'actions en bas ;
// - ordinateur : 16:9 au centre, nom, partage et liens dessous ;
// - « ?plein=1 » : le lecteur seul, sans commandes, qui démarre aussitôt
//   (enregistrement vidéo, écran d'une salle de conférence) ; « &boucle=1 »
//   pour recommencer sans fin ; « &video=1 » sans la date du prochain cours.
// Les balises Open Graph (aperçu WhatsApp) sont posées par le serveur.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Check, Copy, ExternalLink, Globe, Linkedin, Share2 } from "lucide-react";
import { ErreurApi } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import type { ShowreelPublicDto } from "@shared/schema";
import { Showreel, useMouvementReduit } from "./Showreel";

const lienWhatsapp = (texte: string) => `https://wa.me/?text=${encodeURIComponent(texte)}`;

function useEstTelephone(): boolean {
  const requete = "(max-width: 767px), (max-aspect-ratio: 4/5)";
  const [oui, setOui] = useState(() => typeof window !== "undefined" && window.matchMedia(requete).matches);
  useEffect(() => {
    const m = window.matchMedia(requete);
    const ecouter = () => setOui(m.matches);
    m.addEventListener("change", ecouter);
    return () => m.removeEventListener("change", ecouter);
  }, []);
  return oui;
}

export function messagePartage(d: ShowreelPublicDto): string {
  const c = d.formateur.campus;
  const cours = c.cours ? `, formateur ${c.cours.titre.match(/^[aeiouéèhIA]/i) ? "d'" : "de "}${c.cours.titre} au campus numérique 2IAE` : ", formateur du campus numérique 2IAE";
  return `Découvrez ${d.formateur.nomAffiche} en 30 secondes${cours} : ${d.urlPage}`;
}

function BoutonsPartage({ d, sombre = true, compact }: { d: ShowreelPublicDto; sombre?: boolean; compact?: boolean }) {
  const [copie, setCopie] = useState(false);
  async function copier() {
    try {
      await navigator.clipboard.writeText(d.urlPage);
      setCopie(true);
      toast("Lien copié : collez-le où vous voulez.");
      window.setTimeout(() => setCopie(false), 2500);
    } catch {
      window.prompt("Copiez ce lien :", d.urlPage);
    }
  }
  return (
    <div className="flex gap-2">
      <a
        href={lienWhatsapp(messagePartage(d))}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-orange px-5 text-[15px] font-bold text-encre no-underline hover:bg-white hover:text-encre sm:flex-none"
      >
        <Share2 className="h-[18px] w-[18px]" /> {compact ? "WhatsApp" : "Partager sur WhatsApp"}
      </a>
      <button
        type="button"
        onClick={copier}
        className={
          sombre
            ? "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] border border-white/25 px-4 text-[15px] font-bold text-white hover:bg-white/10"
            : "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] border border-ligne px-4 text-[15px] font-bold text-encre hover:bg-creme"
        }
      >
        {copie ? <Check className="h-[18px] w-[18px]" /> : <Copy className="h-[18px] w-[18px]" />} {compact ? (copie ? "Copié" : "Copier") : copie ? "Lien copié" : "Copier le lien"}
      </button>
    </div>
  );
}

function Introuvable() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-encre px-6 text-center text-white">
      <div className="flex max-w-md flex-col items-center gap-4">
        <img src="/marque-2iae-detouree.png" alt="2IAE" className="h-14 w-auto" />
        <h1 className="text-3xl font-black tracking-serre">Cette présentation n'est pas en ligne.</h1>
        <p className="text-nuit-doux">Elle a peut-être été retirée, ou le lien est incomplet. Découvrez les formateurs du campus numérique.</p>
        <Link href="/formateurs" className="inline-flex min-h-[48px] items-center gap-2 rounded-[14px] bg-orange px-5 font-bold text-encre no-underline hover:bg-white hover:text-encre">
          Voir les formateurs
        </Link>
      </div>
    </main>
  );
}

export default function PagePresentationPublique({ slug }: { slug: string }) {
  const q = useQuery<ShowreelPublicDto>({ queryKey: ["/api/public/presentations", slug], staleTime: 60_000 });
  const telephone = useEstTelephone();
  const reduit = useMouvementReduit();
  const parametres = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const modePlein = parametres.get("plein") === "1";
  const boucle = parametres.get("boucle") === "1";
  // « &video=1 » : pour une vidéo à partager, pas de date qui vieillit (« Prochain cours : lundi 28 septembre »).
  const video = parametres.get("video") === "1";
  const d = q.data;

  useEffect(() => {
    if (d) document.title = `${d.formateur.nomAffiche} en 30 secondes · Campus numérique 2IAE`;
  }, [d]);

  // Plein écran (enregistrement, écran de salle) : la lecture attend les polices et la photo, pour que la première image soit juste.
  const [pret, setPret] = useState(!modePlein);
  useEffect(() => {
    if (!modePlein || !d) return;
    const photo = d.formateur.photoUrl;
    const image = photo ? Object.assign(new Image(), { src: photo }) : null;
    let fini = false;
    const go = () => !fini && ((fini = true), setPret(true));
    void Promise.all([document.fonts?.ready, image?.decode().catch(() => undefined)]).then(go);
    const filet = window.setTimeout(go, 4000);
    return () => window.clearTimeout(filet);
  }, [modePlein, d]);

  if (q.error instanceof ErreurApi && q.error.statut === 404) return <Introuvable />;
  if (!d) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-encre" aria-busy="true">
        <span className="flex items-center gap-3 font-mono text-sm text-nuit-gris">
          <span className="point-direct bg-orange" /> Chargement de la présentation…
        </span>
      </main>
    );
  }

  const format = modePlein ? (window.innerWidth < window.innerHeight ? "portrait" : "paysage") : telephone ? "portrait" : "paysage";

  if (modePlein) {
    const formateur = video ? { ...d.formateur, campus: { ...d.formateur.campus, prochaineDateLibelle: null } } : d.formateur;
    return <main className="fixed inset-0 bg-encre">{pret && <Showreel scenes={d.scenes} formateur={formateur} format={format} plein sansCommandes immediat forcerAnimation boucle={boucle} />}</main>;
  }

  if (telephone && reduit) {
    // Moins de mouvement : la version fixe se lit en faisant défiler la page.
    return (
      <main className="min-h-[100dvh] bg-encre text-white">
        <div className="flex flex-col gap-4 px-4 pb-32 pt-5">
          <div className="flex items-center gap-3">
            <img src="/marque-2iae-detouree.png" alt="" className="h-9 w-auto" />
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-orange">En 30 secondes</p>
              <h1 className="text-[24px] font-black leading-tight tracking-serre">{d.formateur.nomAffiche}</h1>
            </div>
          </div>
          <Showreel scenes={d.scenes} formateur={d.formateur} format="portrait" />
        </div>
        <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-encre px-4 pt-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <BoutonsPartage d={d} compact />
        </div>
      </main>
    );
  }

  if (telephone) {
    return (
      <main className="flex h-[100dvh] flex-col bg-encre text-white">
        <h1 className="sr-only">
          {d.formateur.nomAffiche} en 30 secondes, formateur du campus numérique 2IAE
        </h1>
        <div className="relative min-h-0 flex-1">
          <Showreel scenes={d.scenes} formateur={d.formateur} format="portrait" plein autoplay />
        </div>
        <div className="bas-sur flex flex-col gap-2 border-t border-white/10 bg-encre px-4 pt-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <BoutonsPartage d={d} compact />
          <div className="flex items-center justify-between gap-3 font-mono text-[12px] text-nuit-gris">
            <Link href={new URL(d.urlFiche ?? d.urlPage).pathname} className="inline-flex min-h-[32px] items-center gap-1 text-nuit-doux no-underline hover:text-white">
              Voir sa fiche <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <Link href="/" className="inline-flex min-h-[32px] items-center text-nuit-gris no-underline hover:text-white">
              Campus numérique 2IAE
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const ouverture = d.scenes.find((s) => s.type === "ouverture");
  return (
    <main className="min-h-[100dvh] bg-encre text-white">
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-7 py-5">
        <Link href="/" className="flex items-center gap-3 text-white no-underline hover:text-white">
          <img src="/marque-2iae-detouree.png" alt="" className="h-10 w-auto" />
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-extrabold tracking-serre">Campus numérique</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-nuit-gris">Groupe Écoles 2IAE International</span>
          </span>
        </Link>
        <Link href="/formateurs" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-[14px] font-semibold text-nuit-doux no-underline hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Tous les formateurs
        </Link>
      </header>
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-7 pb-14">
        <div className="overflow-hidden rounded-[28px] shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)] ring-1 ring-white/10">
          <Showreel scenes={d.scenes} formateur={d.formateur} format="paysage" autoplay />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-0 max-w-2xl flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange">En 30 secondes</span>
            <h1 className="text-[40px] font-black leading-[1.02] tracking-serre">{d.formateur.nomAffiche}</h1>
            {ouverture?.texte && <p className="text-[17px] text-nuit-doux">{ouverture.texte}</p>}
            {d.liens.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-2">
                {d.liens.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer me" className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] font-semibold text-white no-underline hover:bg-white/20 hover:text-white">
                      {l.type === "linkedin" ? <Linkedin className="h-4 w-4" /> : <Globe className="h-4 w-4" />} {l.nom}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <BoutonsPartage d={d} />
            {d.urlFiche && (
              <Link href={new URL(d.urlFiche).pathname} className="inline-flex min-h-[40px] items-center gap-1.5 font-semibold text-nuit-doux no-underline hover:text-white">
                Voir sa fiche et ses cours <ExternalLink className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
        <p className="font-mono text-xs text-nuit-gris">Espace pour mettre en pause · flèches pour changer de plan · la présentation est muette.</p>
      </div>
    </main>
  );
}
