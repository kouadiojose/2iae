// /pilotage/fiches?ids=… : les fiches de connexion à imprimer (page nue).
// Huit fiches par feuille A4, à découper : logo, nom, classe, campus,
// identifiant, code provisoire, QR vers le lien d'activation et trois étapes.
import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { Printer, ArrowLeft, ScanLine, KeyRound, GraduationCap, TriangleAlert } from "lucide-react";
import type { FicheConnexion, LotFiches } from "@shared/schema";
import { Bouton } from "@/components/ui/bouton";
import { toastErreur } from "@/components/ui/toast";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { pluriel } from "@/lib/utils";
import { Qr } from "./composants/Qr";
import { fichesMemorisees, memoriserFiches } from "./outils";

const PAR_FEUILLE = 8;
const LARGEUR_A4_PX = 794; // 210 mm à 96 ppp

const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Abidjan" });

export default function PageFiches() {
  const brut = new URLSearchParams(useSearch()).get("ids") ?? "";
  const ids = useMemo(
    () =>
      brut
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0),
    [brut],
  );
  const [fiches, setFiches] = useState<FicheConnexion[] | null>(() => fichesMemorisees(ids));
  const [ignores, setIgnores] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    document.title = "Fiches de connexion · Campus numérique 2IAE";
    const ajuster = () => setZoom(Math.min(1, (window.innerWidth - 24) / LARGEUR_A4_PX));
    ajuster();
    window.addEventListener("resize", ajuster);
    return () => window.removeEventListener("resize", ajuster);
  }, []);

  const preparer = async () => {
    setEnvoi(true);
    try {
      const lot = await post<LotFiches>("/api/pilotage/fiches", { utilisateurIds: ids });
      memoriserFiches(lot.fiches);
      setFiches(lot.fiches);
      setIgnores(lot.ignores);
      await rafraichir("/api/pilotage/comptes");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  const feuilles: FicheConnexion[][] = [];
  for (let i = 0; i < (fiches?.length ?? 0); i += PAR_FEUILLE) feuilles.push(fiches!.slice(i, i + PAR_FEUILLE));
  const hote = window.location.host;

  return (
    <div className="min-h-dvh bg-[#EFE7E0] print:min-h-0 print:bg-white">
      <style>{CSS_IMPRESSION}</style>

      <header className="sans-impression sticky top-0 z-10 border-b border-ligne bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[900px] flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/pilotage/comptes" className="flex min-h-[48px] items-center gap-2 font-bold text-encre no-underline">
            <ArrowLeft className="h-5 w-5" /> Comptes
          </Link>
          <div className="min-w-0 flex-1">
            <div className="font-extrabold leading-tight">Fiches de connexion</div>
            <div className="text-[13px] text-texte-gris">
              {fiches ? `${pluriel(fiches.length, "fiche")} · ${pluriel(feuilles.length, "feuille")} A4 · 8 par feuille, à découper` : `${pluriel(ids.length, "compte")} choisi${ids.length > 1 ? "s" : ""}`}
            </div>
          </div>
          {fiches && fiches.length > 0 && (
            <Bouton icone={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Imprimer
            </Bouton>
          )}
        </div>
      </header>

      {!fiches ? (
        <div className="sans-impression mx-auto flex max-w-lg flex-col gap-4 px-4 py-12">
          {ids.length === 0 ? (
            <>
              <h1 className="text-3xl font-black tracking-serre">Aucun compte choisi.</h1>
              <p className="text-texte-pale">Cochez des comptes dans la liste, puis « Imprimer les fiches ».</p>
              <Link href="/pilotage/comptes" className="font-bold">
                Aller aux comptes
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-black tracking-serre">Préparer {pluriel(ids.length, "fiche")} de connexion</h1>
              <div className="flex items-start gap-3 rounded-2xl bg-alerte-clair p-4 text-[15px] text-alerte">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  Chaque fiche porte un <strong>nouveau code</strong> valable 30 jours. Les anciens codes et fiches de ces comptes ne marcheront plus, et les personnes déjà connectées devront se reconnecter avec leur nouvelle fiche.
                </p>
              </div>
              <Bouton taille="lg" onClick={preparer} chargement={envoi} icone={<Printer className="h-5 w-5" />} className="min-h-[56px]">
                Préparer les fiches
              </Bouton>
            </>
          )}
        </div>
      ) : (
        <main className="flex flex-col items-center gap-6 py-6 print:block print:p-0">
          {ignores > 0 && (
            <p className="sans-impression mx-4 max-w-[794px] rounded-xl bg-white px-4 py-3 text-sm text-texte-pale">
              {pluriel(ignores, "compte ignoré", "comptes ignorés")} : désactivé, hors de votre campus, ou votre propre compte.
            </p>
          )}
          {feuilles.map((feuille, i) => (
            <section key={i} className="feuille-a4 shadow-telephone" style={{ zoom }} aria-label={`Feuille ${i + 1}`}>
              {feuille.map((f) => (
                <Fiche key={f.id} f={f} hote={hote} />
              ))}
            </section>
          ))}
          <p className="sans-impression px-4 text-center text-sm text-texte-gris">
            Conseil : imprimez en A4, marges « aucune », à 100 %. Rangez les fiches non distribuées sous clé.
          </p>
        </main>
      )}
    </div>
  );
}

function Fiche({ f, hote }: { f: FicheConnexion; hote: string }) {
  const tu = f.role === "etudiant";
  const etapes = tu
    ? [
        { icone: ScanLine, texte: "Scanne le QR avec l'appareil photo de ton téléphone" },
        { icone: KeyRound, texte: "Choisis ton code secret : 6 chiffres que toi seul connais" },
        { icone: GraduationCap, texte: "Retrouve tes cours, tes lives et tes devoirs" },
      ]
    : [
        { icone: ScanLine, texte: "Scannez le QR avec l'appareil photo du téléphone" },
        { icone: KeyRound, texte: "Choisissez votre code secret (10 caractères au moins)" },
        { icone: GraduationCap, texte: "Retrouvez le campus et vos outils" },
      ];
  return (
    <article className="fiche">
      <div className="flex items-center gap-[2mm]">
        <img src="/marque-2iae.svg" alt="2IAE" className="h-[7mm] w-auto" />
        <div className="border-l border-ligne-forte pl-[2mm] leading-tight">
          <div className="text-[8.5pt] font-extrabold">Campus numérique</div>
          <div className="font-mono text-[6pt] text-texte-gris">Groupe 2IAE International</div>
        </div>
        <div className="ml-auto rounded-full bg-orange px-[2mm] py-[0.6mm] font-mono text-[6pt] font-semibold uppercase tracking-wider text-encre">Fiche de connexion</div>
      </div>

      <div className="mt-[2.5mm] flex gap-[3mm]">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5pt] font-black leading-tight tracking-serre">
            {f.prenom} <span className="uppercase">{f.nom}</span>
          </div>
          <div className="mt-[0.6mm] line-clamp-2 text-[7pt] leading-snug text-texte-doux">
            {[f.classe, f.site && !(f.classe ?? "").includes(f.site) ? `Campus ${f.site}` : null].filter(Boolean).join(" · ") || "Personnel du campus"}
          </div>
          <div className="mt-[2mm] grid grid-cols-[auto_1fr] items-baseline gap-x-[2mm] gap-y-[0.8mm]">
            <span className="font-mono text-[6pt] uppercase tracking-wider text-texte-gris">Identifiant</span>
            <span className="truncate font-mono text-[10pt] font-bold">{f.identifiant}</span>
            <span className="font-mono text-[6pt] uppercase tracking-wider text-texte-gris">Code</span>
            <span className="font-mono text-[15pt] font-bold leading-none tracking-[0.14em]">{f.code}</span>
          </div>
          <div className="mt-[1.2mm] text-[6pt] leading-snug text-texte-pale">
            Valable jusqu'au {fmtDate.format(new Date(f.expireLe))}. Sans QR : {tu ? "ouvre" : "ouvrez"} <span className="font-mono">{hote}</span> et {tu ? "tape" : "tapez"} l'identifiant et le code.
          </div>
        </div>
        <div className="flex w-[28mm] shrink-0 flex-col items-center gap-[1mm]">
          <Qr texte={f.lien} className="w-[27mm]" titre={`QR d'activation de ${f.prenom}`} />
          <span className="font-mono text-[6pt] uppercase tracking-wider text-texte-gris">{tu ? "Scanne-moi" : "À scanner"}</span>
        </div>
      </div>

      <ol className="mt-auto grid grid-cols-3 gap-[2mm] border-t border-ligne pt-[2mm]">
        {etapes.map((e, i) => (
          <li key={i} className="flex items-start gap-[1.2mm]">
            <span className="grid h-[5mm] w-[5mm] shrink-0 place-items-center rounded-full bg-orange text-[6.5pt] font-black text-encre">{i + 1}</span>
            <span className="flex flex-col gap-[0.5mm]">
              <e.icone className="h-[3.2mm] w-[3.2mm] text-orange-fonce" strokeWidth={2.4} />
              <span className="text-[6pt] leading-[1.25] text-texte-doux">{e.texte}</span>
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}

const CSS_IMPRESSION = `
.feuille-a4 {
  width: 210mm;
  height: 297mm;
  display: grid;
  grid-template-columns: repeat(2, 105mm);
  grid-template-rows: repeat(4, 74.25mm);
  background: #fff;
  overflow: hidden;
}
.fiche {
  display: flex;
  flex-direction: column;
  padding: 5mm 5.5mm 4.5mm;
  border-right: 0.25mm dashed #C9BCB0;
  border-bottom: 0.25mm dashed #C9BCB0;
  overflow: hidden;
  color: #141414;
}
.fiche:nth-child(2n) { border-right: none; }
.fiche:nth-child(n + 7) { border-bottom: none; }
@page { size: A4 portrait; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .sans-impression { display: none !important; }
  .feuille-a4 { zoom: 1 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
  .feuille-a4:last-of-type { break-after: auto; page-break-after: auto; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
