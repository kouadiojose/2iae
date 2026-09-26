// Fac-similé A4 paysage de l'emploi du temps du service des études :
// logo complet en haut à gauche, « ANNÉE ACADÉMIQUE … », « EMPLOI DU TEMPS
// TRONC COMMUN : 1BTS / 2BTS », titre de la session souligné, grille, dates
// de la session et signature. Le navigateur fait le PDF (« Enregistrer en
// PDF » dans la fenêtre d'impression).
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import type { SessionDto } from "@shared/schema";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { GrilleProgramme } from "./GrilleProgramme";
import { libelleJour, publicImprime } from "./outils";

const SERIF = "'Times New Roman', Times, 'Liberation Serif', 'Nimbus Roman', FreeSerif, serif";
const MM = 96 / 25.4; // pixels CSS par millimètre

/** La feuille A4 paysage (297 × 210 mm), prête à imprimer. */
export function DocumentProgramme({ session, projet }: { session: SessionDto; projet?: boolean }) {
  const ligne2 = publicImprime(session.public);
  return (
    <div className="feuille-programme relative overflow-hidden bg-white text-black" style={{ width: "297mm", height: "210mm", fontFamily: SERIF }}>
      <img src="/logo-2iae-hd.png" alt="Groupe écoles 2IAE International" className="absolute" style={{ left: "16mm", top: "4.5mm", width: "43mm" }} />
      {projet && (
        <div className="absolute right-[12mm] top-[8mm] rounded border border-[#C2410C] px-[2mm] py-[1mm] font-mono text-[8pt] font-semibold uppercase tracking-wider text-[#C2410C]">
          Projet · non publié
        </div>
      )}
      <div className="absolute inset-x-0 text-center font-bold" style={{ top: "24mm", fontSize: "15pt", letterSpacing: "0.06em", wordSpacing: "0.45em" }}>
        ANNÉE ACADÉMIQUE {session.anneeAcademique}
      </div>
      <div className="absolute inset-x-0 text-center font-bold" style={{ top: "34.5mm", fontSize: "15pt", letterSpacing: "0.02em" }}>
        EMPLOI DU TEMPS{ligne2 ? ` ${ligne2}` : ""}
      </div>
      <div className="absolute inset-x-0 text-center" style={{ top: "45.5mm" }}>
        <span className="font-bold uppercase underline decoration-[1.6px] underline-offset-[5px]" style={{ fontSize: "17pt" }}>
          {session.titre}
        </span>
      </div>
      <div className="absolute" style={{ left: "23mm", right: "15mm", top: "59.5mm", height: "106.5mm" }}>
        <GrilleProgramme session={session} variante="impression" className="h-full" />
      </div>
      <div className="absolute font-bold" style={{ left: "25mm", top: "170.5mm", fontSize: "13pt" }}>
        Du {libelleJour(session.debut, { annee: true })}
      </div>
      <div className="absolute font-bold" style={{ left: "126.5mm", top: "170mm", fontSize: "13pt" }}>
        Au {libelleJour(session.fin, { annee: true })}
      </div>
      <div className="absolute font-bold uppercase underline decoration-[1.4px] underline-offset-[4px]" style={{ left: "203mm", top: "181mm", fontSize: "13pt" }}>
        {session.signataire}
      </div>
      {session.note && (
        <div className="absolute italic" style={{ left: "25mm", right: "100mm", top: "181mm", fontSize: "10pt", lineHeight: 1.3 }}>
          {session.note}
        </div>
      )}
    </div>
  );
}

/** Adapte la feuille à la largeur de l'écran (téléphone compris) ; à l'impression, taille réelle. */
function Apercu({ children }: { children: ReactNode }) {
  const boite = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState(1);
  useLayoutEffect(() => {
    const el = boite.current;
    if (!el) return;
    const calculer = () => setEchelle(Math.min(1, el.clientWidth / (297 * MM)));
    calculer();
    const obs = new ResizeObserver(calculer);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={boite} className="w-full">
      <div className="apercu-programme mx-auto" style={{ width: 297 * MM * echelle, height: 210 * MM * echelle }}>
        <div className="origin-top-left shadow-telephone print:shadow-none" style={{ transform: `scale(${echelle})`, width: "297mm" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

const STYLE_IMPRESSION = `
@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { width: 297mm; height: 210mm; margin: 0; background: #fff !important; }
  .apercu-programme { width: 297mm !important; height: 210mm !important; }
  .apercu-programme > div { transform: none !important; }
  .feuille-programme { page-break-after: avoid; break-after: avoid; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

/** Page d'impression (sans coquille) : barre d'outils à l'écran, feuille seule à l'impression. */
export function PageImpression({
  session,
  chargement,
  erreur,
  retour,
  libelleRetour,
  projet,
}: {
  session: SessionDto | undefined;
  chargement: boolean;
  erreur: Error | null;
  retour: string;
  libelleRetour: string;
  projet?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-[#EFE7E0] print:min-h-0 print:bg-white">
      <style>{STYLE_IMPRESSION}</style>
      <header className="sticky top-0 z-10 border-b border-ligne bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <LienBouton href={retour} variante="fantome" icone={<ArrowLeft className="h-4 w-4" />} className="min-h-[48px] px-3">
            {libelleRetour}
          </LienBouton>
          <div className="flex flex-wrap items-center gap-3">
            <p className="hidden max-w-sm text-[13px] leading-snug text-texte-pale md:block">Dans la fenêtre d'impression, choisissez « Enregistrer en PDF » pour obtenir le fichier. L'orientation paysage est déjà réglée.</p>
            <Bouton icone={<Printer className="h-4 w-4" />} onClick={() => window.print()} disabled={!session} className="min-h-[48px]">
              Imprimer ou enregistrer en PDF
            </Bouton>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1180px] px-4 py-6 print:m-0 print:max-w-none print:p-0 sm:px-6">
        {chargement ? (
          <Chargement lignes={3} />
        ) : erreur ? (
          <Erreur message={erreur.message} />
        ) : !session ? (
          <EtatVide titre="Emploi du temps introuvable." texte="Il a peut-être été retiré, ou le lien est incomplet." action={<LienBouton href={retour}>{libelleRetour}</LienBouton>} />
        ) : (
          <Apercu>
            <DocumentProgramme session={session} projet={projet} />
          </Apercu>
        )}
        <p className="mt-4 text-center text-[13px] text-texte-pale print:hidden md:hidden">Pour obtenir un PDF, touchez « Imprimer » puis choisissez « Enregistrer en PDF ».</p>
      </main>
    </div>
  );
}
