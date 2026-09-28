// Étape 1 de l'éditeur : les liens (site personnel lu par le campus,
// LinkedIn gardé comme lien affiché) et le PDF du profil LinkedIn.
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Globe, Linkedin, Link2, Plus, RefreshCw, Trash2, TriangleAlert, Upload, X } from "lucide-react";
import { patch, post, ErreurApi } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Badge, Erreur } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ShowreelEditionDto, SourceShowreel } from "@shared/schema";
import { televerserSource } from "../outils";
import { Bloc, dateJour, textes } from "./communs";

type Ligne = { cle: string; url: string; afficher: boolean };

const estLinkedin = (url: string) => /(^|\/\/|\.)(linkedin\.com|lnkd\.in)/i.test(url);
const estReseau = (url: string) => /(^|\/\/|\.)(facebook\.com|fb\.com|instagram\.com|x\.com|twitter\.com|tiktok\.com|youtube\.com|youtu\.be)/i.test(url);
const normaliser = (url: string) => {
  const t = url.trim();
  if (!t) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
};

function EtatSource({ s }: { s: SourceShowreel | undefined }) {
  if (!s) return <Badge ton="gris">Pas encore enregistré</Badge>;
  if (s.etat === "lu") return <Badge ton="succes">✓ Lu</Badge>;
  if (s.etat === "echec") return <Badge ton="danger">Illisible</Badge>;
  if (s.etat === "non_lisible") return <Badge ton="alerte">Lien affiché seulement</Badge>;
  return <Badge ton="gris">À lire</Badge>;
}

export function Sources({ d, surMaj }: { d: ShowreelEditionDto; surMaj: (x: ShowreelEditionDto) => void }) {
  const { t, votre } = textes(d);
  const cible = d.estMoi ? "moi" : String(d.formateur.id);
  const liens = d.sources.filter((s) => s.type !== "pdf");
  const pdf = d.sources.find((s) => s.type === "pdf");
  const [lignes, setLignes] = useState<Ligne[]>(() => liens.map((s) => ({ cle: s.id, url: s.url ?? "", afficher: s.afficher })));
  const [envoi, setEnvoi] = useState<"enregistrer" | "pdf" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const signature = JSON.stringify(liens.map((s) => [s.url, s.afficher]));

  // Nouvelle version du serveur : on reprend ses liens (identifiants, états).
  useEffect(() => {
    setLignes(liens.map((s) => ({ cle: s.id, url: s.url ?? "", afficher: s.afficher })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const modifie = JSON.stringify(lignes.filter((l) => l.url.trim()).map((l) => [normaliser(l.url), l.afficher])) !== JSON.stringify(liens.map((s) => [s.url, s.afficher]));
  const avecLinkedin = lignes.some((l) => estLinkedin(l.url));

  async function enregistrerEtLire() {
    setErreur(null);
    setEnvoi("enregistrer");
    try {
      let x = d;
      if (modifie) x = await patch<ShowreelEditionDto>(`/api/showreels/${cible}`, { liens: lignes.filter((l) => l.url.trim()).map((l) => ({ url: l.url.trim(), afficher: l.afficher })) });
      if (x.sources.some((s) => s.type === "site")) x = await post<ShowreelEditionDto>(`/api/showreels/${cible}/lire`);
      surMaj(x);
      const lus = x.sources.filter((s) => s.etat === "lu" && s.type === "site").length;
      const echecs = x.sources.filter((s) => s.etat === "echec").length;
      toast(echecs ? `${echecs > 1 ? `${echecs} liens n'ont` : "Un lien n'a"} pas pu être lu : voyez le message sous le lien.` : lus ? "Liens enregistrés et lus." : "Liens enregistrés.", echecs ? "info" : "succes");
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Les liens n'ont pas pu être enregistrés. Réessayez.");
    } finally {
      setEnvoi(null);
    }
  }

  async function deposerPdf(f: File | undefined) {
    if (!f) return;
    if (f.type !== "application/pdf") return setErreur("Déposez le profil au format PDF.");
    if (f.size > 10 * 1024 * 1024) return setErreur("Ce PDF est trop lourd (10 Mo au plus).");
    setErreur(null);
    setEnvoi("pdf");
    try {
      const recu = await televerserSource(f);
      surMaj(await patch<ShowreelEditionDto>(`/api/showreels/${cible}`, { pdfFichierId: recu.id }));
      toast("PDF reçu : il sera lu par l'assistant à la composition.");
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Le PDF n'a pas été reçu. Réessayez.");
    } finally {
      setEnvoi(null);
      if (fichier.current) fichier.current.value = "";
    }
  }

  async function retirerPdf() {
    try {
      surMaj(await patch<ShowreelEditionDto>(`/api/showreels/${cible}`, { pdfFichierId: null }));
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Le PDF n'a pas pu être retiré.");
    }
  }

  return (
    <Bloc
      id="sources"
      numero={1}
      titre={t("Vos liens et votre profil", `Les liens et le profil de ${d.formateur.nomAffiche}`)}
      description={t(
        "Collez vos liens : site personnel, LinkedIn, page d'entreprise. Le campus lit votre site ; l'assistant compose à partir de ce qu'il y trouve, et de rien d'autre.",
        "Collez ses liens : site personnel, LinkedIn, page d'entreprise. Le campus lit son site ; l'assistant compose à partir de ce qu'il y trouve, et de rien d'autre.",
      )}
    >
      <div className="flex flex-col gap-3">
        {lignes.map((l, i) => {
          const s = liens.find((x) => x.url === normaliser(l.url) || x.id === l.cle);
          const connu = s && s.url === normaliser(l.url) ? s : undefined;
          const Icone = estLinkedin(l.url) ? Linkedin : estReseau(l.url) ? Link2 : Globe;
          return (
            <div key={l.cle} className="rounded-2xl border border-ligne p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <Icone className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
                <label className="sr-only" htmlFor={`lien-${l.cle}`}>
                  Lien {i + 1}
                </label>
                <input
                  id={`lien-${l.cle}`}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://www.monsite.com"
                  value={l.url}
                  maxLength={500}
                  onChange={(e) => setLignes((ls) => ls.map((x) => (x.cle === l.cle ? { ...x, url: e.target.value } : x)))}
                  className="min-h-[48px] w-full min-w-0 rounded-xl border border-ligne bg-white px-3 text-[16px] outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                />
                <button
                  type="button"
                  onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-texte-pale hover:bg-danger-clair hover:text-danger"
                  aria-label={`Retirer le lien ${i + 1}`}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-7">
                <EtatSource s={connu} />
                <label className="flex min-h-[36px] cursor-pointer items-center gap-2 text-[14px] text-texte-doux">
                  <input type="checkbox" className="h-4 w-4 accent-[#E4793A]" checked={l.afficher} onChange={(e) => setLignes((ls) => ls.map((x) => (x.cle === l.cle ? { ...x, afficher: e.target.checked } : x)))} />
                  Afficher sous la présentation
                </label>
              </div>
              {connu?.message && <p className={cn("mt-1.5 pl-7 text-[14px]", connu.etat === "echec" ? "text-danger" : "text-texte-pale")}>{connu.message.replace(/ ([:;?!])/g, "\u00a0$1")}</p>}
              {connu?.etat === "lu" && connu.titrePage && <p className="mt-1 truncate pl-7 font-mono text-[12px] text-texte-gris">« {connu.titrePage} »</p>}
              {connu?.etat === "lu" && connu.pages.length > 1 && (
                <p className="mt-0.5 truncate pl-7 font-mono text-[12px] text-texte-gris">Pages lues : {connu.pages.map((p) => new URL(p).pathname).join(" · ")}</p>
              )}
            </div>
          );
        })}
        {lignes.length === 0 && <p className="rounded-2xl bg-creme px-4 py-3 text-[15px] text-texte-pale">{t("Aucun lien pour l'instant. Commencez par votre site personnel ou votre profil LinkedIn.", "Aucun lien pour l'instant. Commencez par son site personnel ou son profil LinkedIn.")}</p>}
        <div className="flex flex-wrap gap-2">
          <Bouton variante="doux" icone={<Plus className="h-4 w-4" />} disabled={lignes.length >= 6} onClick={() => setLignes((ls) => [...ls, { cle: `n${Date.now()}`, url: "", afficher: true }])}>
            Ajouter un lien
          </Bouton>
          <Bouton variante={modifie ? "principal" : "contour"} icone={<RefreshCw className="h-4 w-4" />} chargement={envoi === "enregistrer"} disabled={!modifie && !liens.some((s) => s.type === "site")} onClick={enregistrerEtLire}>
            {modifie ? "Enregistrer et lire les liens" : "Relire les liens"}
          </Bouton>
        </div>

        <div className={cn("mt-2 rounded-2xl p-4", avecLinkedin && !pdf ? "border-2 border-orange bg-orange-pale" : "bg-creme")}>
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold">Le PDF du profil LinkedIn</p>
              <p className="mt-1 text-[14px] leading-snug text-texte-doux">
                LinkedIn refuse toute lecture automatique. {t("Pour que l'assistant lise votre parcours", "Pour que l'assistant lise son parcours")} : sur LinkedIn, ouvrez {votre} profil, touchez <strong>« Plus »</strong> puis <strong>« Enregistrer au format PDF »</strong>, et déposez ce PDF ici.
              </p>
              {pdf ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-succes" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{pdf.nom}</span>
                  <span className="font-mono text-[12px] text-texte-gris">{pdf.etat === "lu" && pdf.luLe ? `transmis le ${dateJour(pdf.luLe)}` : "reçu"}</span>
                  <button type="button" onClick={retirerPdf} className="grid h-9 w-9 place-items-center rounded-lg text-texte-pale hover:bg-danger-clair hover:text-danger" aria-label="Retirer le PDF">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              <input ref={fichier} type="file" accept="application/pdf" className="sr-only" id="pdf-profil" onChange={(e) => void deposerPdf(e.target.files?.[0])} />
              <Bouton variante={avecLinkedin && !pdf ? "principal" : "contour"} className="mt-3" icone={<Upload className="h-4 w-4" />} chargement={envoi === "pdf"} onClick={() => fichier.current?.click()}>
                {pdf ? "Remplacer le PDF" : "Déposer le PDF du profil"}
              </Bouton>
              <p className="mt-2 text-[12px] text-texte-gris">PDF, 10 Mo au plus. Il ne sert qu'à composer cette présentation.</p>
            </div>
          </div>
        </div>
        {avecLinkedin && !pdf && !lignes.some((l) => l.url.trim() && !estLinkedin(l.url) && !estReseau(l.url)) && (
          <p className="flex items-start gap-2 text-[14px] text-alerte">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Avec LinkedIn seul, l'assistant n'a rien à lire : déposez le PDF du profil.
          </p>
        )}
        {erreur && <Erreur message={erreur} />}
      </div>
    </Bloc>
  );
}
