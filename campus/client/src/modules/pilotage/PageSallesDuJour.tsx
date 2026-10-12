// /pilotage/salles : « Les salles du jour » (décision de José du 12 octobre 2026). Pour aujourd'hui
// ou demain (heure d'Abidjan), une carte par campus : chaque salle (« Riviera · L1 · Salle de
// conférence 1 »), ses cours, et le lien de son écran ; « Envoyer sur WhatsApp » ouvre WhatsApp
// vers la vie scolaire du campus avec le message prêt. Les liens donnent accès aux écrans : page
// réservée à la direction (droit des écrans), réponse sans cache. Les réglages des salles (ajouter,
// nom, public, installer l'écran) sont dans chaque carte : pas besoin d'aller chercher « Les campus ».
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy, MessageCircle, MonitorSmartphone, TriangleAlert } from "lucide-react";
import type { CampusDuJour, SalleDuJour, SallesDuJour, SallesDuSite } from "@shared/salles";
import { t as textesSalles } from "@shared/textes/salles";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton } from "@/components/ui/bouton";
import { Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { Onglets } from "@/components/ui/onglets";
import { toast } from "@/components/ui/toast";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { FenetreEcran } from "./composants/FenetreEcran";
import { SallesDuCampus, type EcranDeSalle } from "./composants/SallesCampus";
import { copier, telephoneLisible } from "./outils";

type Jour = "aujourdhui" | "demain";

export default function PageSallesDuJour() {
  const tx = useTextes(textesSalles);
  const [jour, setJour] = useState<Jour>(() => (new URLSearchParams(window.location.search).get("jour") === "demain" ? "demain" : "aujourdhui"));
  const { data, isLoading, error, refetch } = useQuery<SallesDuJour>({ queryKey: [`/api/pilotage/salles-du-jour?jour=${jour}`], staleTime: 0, gcTime: 60_000 });
  // Réglages des salles de chaque campus (sans lien), pour les régler sans quitter la page.
  const reglages = useQuery<SallesDuSite[]>({ queryKey: ["/api/pilotage/salles"] });
  const [ecran, setEcran] = useState<EcranDeSalle | null>(null);

  return (
    <Page>
      <SousNav />
      <EnTetePage etiquette={tx("jour.etiquette")} titre={tx("jour.titre")} sousTitre={tx("jour.sousTitre")} />
      <div className="flex flex-wrap items-center gap-3">
        <Onglets<Jour>
          valeur={jour}
          onChange={setJour}
          options={[
            { valeur: "aujourdhui", libelle: tx("jour.aujourdhui") },
            { valeur: "demain", libelle: tx("jour.demain") },
          ]}
        />
        {data && <span className="text-lg font-extrabold first-letter:uppercase">{data.libelle}</span>}
      </div>

      {isLoading ? (
        <Chargement lignes={3} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => refetch()} />
      ) : !data?.campus.length ? (
        <EtatVide icone={<MonitorSmartphone className="h-6 w-6" />} titre={tx("jour.vide")} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.campus.map((c) => (
            <CarteCampus key={c.siteId} c={c} date={data.date} reglages={reglages.data?.find((x) => x.siteId === c.siteId)} onEcran={setEcran} />
          ))}
        </ul>
      )}
      <FenetreEcran site={ecran} onFermer={() => setEcran(null)} />
    </Page>
  );
}

/** Envoi déjà fait ce jour-là depuis ce navigateur (un repère pour soi, rien de plus). */
function useEnvoye(cle: string): [boolean, () => void] {
  const [envoye, setEnvoye] = useState(() => {
    try {
      return localStorage.getItem(cle) === "1";
    } catch {
      return false;
    }
  });
  return [
    envoye,
    () => {
      setEnvoye(true);
      try {
        localStorage.setItem(cle, "1");
      } catch {
        /* navigateur sans stockage : le repère vaut pour la page ouverte */
      }
    },
  ];
}

function CarteCampus({ c, date, reglages, onEcran }: { c: CampusDuJour; date: string; reglages: SallesDuSite | undefined; onEcran: (e: EcranDeSalle) => void }) {
  const tx = useTextes(textesSalles);
  const [envoye, noterEnvoi] = useEnvoye(`campus:salles-du-jour:${date}:${c.siteId}`);
  const ecranDe = (s: SalleDuJour) => onEcran({ id: c.siteId, nom: c.campus, numero: s.numero, salle: s.nom });
  return (
    <li className="flex min-w-0 flex-col gap-4 rounded-2xl border border-ligne bg-white p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-extrabold tracking-serre">{tx("jour.campus", { v: { campus: c.campus } })}</h2>
        {envoye && (
          <span className="flex items-center gap-1 text-sm font-bold text-succes">
            <CheckCircle2 className="h-4 w-4" /> {tx("jour.envoye")}
          </span>
        )}
      </div>

      {c.alertes.length > 0 && (
        <div role="alert" className="flex flex-col gap-1.5 rounded-xl border border-alerte/40 bg-alerte-clair px-3 py-2.5 text-[15px] text-alerte">
          <strong className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 shrink-0" /> {tx("jour.alertes")}
          </strong>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {c.alertes.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {c.salles.map((s) => (
          <LigneSalle key={s.numero} s={s} onEcran={() => ecranDe(s)} />
        ))}
      </ul>

      <details className="group rounded-xl border border-ligne-douce" open={c.alertes.length > 0}>
        <summary className="flex min-h-[44px] cursor-pointer items-center px-3 text-sm font-bold">{tx("jour.reglerSalles")}</summary>
        <div className="px-3 pb-3">
          <SallesDuCampus site={{ id: c.siteId, nomCourt: c.campus, salleConference: c.salleConference }} donnees={reglages} onEcran={onEcran} />
        </div>
      </details>

      <details className="group rounded-xl bg-creme">
        <summary className="flex min-h-[44px] cursor-pointer items-center px-3 text-sm font-bold">{tx("jour.apercu")}</summary>
        <pre className="max-w-full whitespace-pre-wrap break-words px-3 pb-3 font-sans text-[14px] leading-relaxed">{c.message}</pre>
      </details>

      <div className="mt-auto flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <a
            href={c.lienWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={noterEnvoi}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-encre px-5 py-3 text-[15px] font-bold text-white no-underline hover:bg-orange hover:text-encre"
          >
            <MessageCircle className="h-4 w-4" />
            {tx("jour.envoyer")}
          </a>
          <Bouton
            variante="contour"
            className="min-h-[48px]"
            icone={<Copy className="h-4 w-4" />}
            onClick={async () => toast((await copier(c.message)) ? tx("jour.copie") : tx("jour.copieImpossible"), "info")}
          >
            {tx("jour.copier")}
          </Bouton>
        </div>
        <p className="text-sm text-texte-pale">
          {c.whatsapp ? tx("jour.vers", { v: { numero: telephoneLisible(c.whatsapp.replace(/^225/, "")) } }) : tx("jour.sansNumero")}
        </p>
      </div>
    </li>
  );
}

function LigneSalle({ s, onEcran }: { s: SalleDuJour; onEcran: () => void }) {
  const tx = useTextes(textesSalles);
  return (
    <li className="flex min-w-0 flex-col gap-1.5 border-l-4 border-orange pl-3">
      <div className="text-[16px] font-extrabold leading-snug">{s.etiquette}</div>
      {s.seances.length ? (
        <ul className="flex flex-col gap-0.5">
          {s.seances.map((x) => (
            <li key={x.id} className={cn("text-[15px]", x.statut === "terminee" && "text-texte-pale")}>
              <span className="font-mono font-semibold tabular-nums">{x.heures}</span> · {x.cours}
              {x.commun && s.public ? <span className="font-semibold"> ({tx("jour.commun")})</span> : null}
              {x.intervenant ? <span className="text-texte-doux"> · {x.intervenant}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-texte-pale">{tx("jour.aucunCours")}</p>
      )}
      {s.lien ? (
        <p className="flex items-center gap-1.5 text-sm text-succes">
          <MonitorSmartphone className="h-4 w-4" /> {tx("jour.ecranPret")}
        </p>
      ) : s.ecranInstalle ? (
        // Écran déjà installé, sans lien gardé : rien à faire. Un nouveau lien reste possible (fenêtre d'installation).
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5 text-sm text-succes">
            <MonitorSmartphone className="h-4 w-4" /> {tx("jour.ecranInstalle")}
          </span>
          <button type="button" onClick={onEcran} className="min-h-[44px] text-sm font-bold text-texte-pale underline hover:text-encre">
            {tx("jour.installer")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-alerte">{tx("jour.ecranAInstaller")}</span>
          <Bouton variante="doux" taille="sm" className="min-h-[44px]" onClick={onEcran} icone={<MonitorSmartphone className="h-4 w-4" />}>
            {tx("jour.installer")}
          </Bouton>
        </div>
      )}
    </li>
  );
}
