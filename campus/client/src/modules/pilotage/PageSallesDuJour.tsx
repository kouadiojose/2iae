// /pilotage/salles : « Les salles du jour » (décision de José du 12 octobre 2026). Pour aujourd'hui
// ou demain (heure d'Abidjan), une carte par campus et, dans chaque carte, un message par salle
// (« Riviera · L1 · Salle de conférence 1 », ses cours, le lien de son écran) : « Envoyer sur
// WhatsApp » l'ouvre vers le coordinateur des salles avec le message déjà écrit, un toucher par
// message, et le repère « Envoyé » reste dans ce navigateur et sur le serveur (13 octobre 2026 : les
// autres appareils, l'autre casquette et les cartes du tableau le savent aussi). Le numéro du coordinateur se règle en
// haut de la page (direction). Chaque matin à 6 h 30, la direction reçoit un rappel qui ouvre cette
// page. Les liens donnent accès aux écrans : page réservée à la direction (droit des écrans),
// réponse sans cache. Les réglages des salles (ajouter, nom, public, installer l'écran) sont dans
// chaque carte : pas besoin d'aller chercher « Les campus ».
// Sur téléphone (13 octobre 2026), à l'ouverture, la page descend juste assez pour que le premier « Envoyer sur
// WhatsApp » soit visible au-dessus de la barre du bas (pas seulement dans l'écran) : on n'a pas à le chercher.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy, MessageCircle, MonitorSmartphone, Phone, TriangleAlert } from "lucide-react";
import { cleEnvoiSalle, PREFIXE_ENVOI_SALLES as PREFIXE_ENVOI, type CampusDuJour, type SalleDuJour, type SallesDuJour, type SallesDuSite } from "@shared/salles";
import { t as textesSalles } from "@shared/textes/salles";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton } from "@/components/ui/bouton";
import { Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { Champ } from "@/components/ui/champs";
import { Onglets } from "@/components/ui/onglets";
import { toast } from "@/components/ui/toast";
import { post, put, ErreurApi } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
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
  useEffect(oublierVieuxEnvois, []);
  usePremierEnvoiVisible(Boolean(data));

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
      {data && (
        <section className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-4 sm:p-5">
          <p className="text-[16px] font-bold">
            {data.messages === 0 ? tx("jour.compte.zero") : data.messages === 1 ? tx("jour.compte.un") : tx("jour.compte", { v: { n: data.messages } })}
          </p>
          {data.aPreparer > 0 && (
            <p className="text-sm font-semibold text-alerte">
              {data.aPreparer === 1 ? tx("jour.aPreparer.compte.un") : tx("jour.aPreparer.compte", { v: { n: data.aPreparer } })}
            </p>
          )}
          <NumeroCoordinateur numero={data.coordinateur} peutRegler={data.peutRegler} />
        </section>
      )}

      {isLoading ? (
        <Chargement lignes={3} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => refetch()} />
      ) : !data?.campus.length ? (
        <EtatVide icone={<MonitorSmartphone className="h-6 w-6" />} titre={tx("jour.vide")} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.campus.map((c) => (
            <CarteCampus
              key={c.siteId}
              c={c}
              date={data.date}
              envoyes={data.envoyes}
              reglages={reglages.data?.find((x) => x.siteId === c.siteId)}
              onEcran={setEcran}
            />
          ))}
        </ul>
      )}
      <FenetreEcran site={ecran} onFermer={() => setEcran(null)} />
    </Page>
  );
}

/**
 * À l'ouverture de la page, une seule fois : si le premier « Envoyer sur WhatsApp » passe sous le haut de la barre du bas
 * (téléphone : l'en-tête, le compte et le numéro le poussent dessous), ou sous le bas de l'écran sans barre (ordinateur),
 * la page descend juste assez pour le montrer au-dessus (marge de défilement du bouton). Rien si la personne a déjà fait
 * défiler, ni au changement d'onglet.
 */
function usePremierEnvoiVisible(pret: boolean) {
  const fait = useRef(false);
  useEffect(() => {
    if (!pret || fait.current) return;
    fait.current = true;
    const id = requestAnimationFrame(() => {
      const bouton = document.querySelector<HTMLElement>("[data-envoi-salle]");
      if (!bouton || window.scrollY > 40) return;
      const barre = document.querySelector<HTMLElement>("nav[aria-label='Navigation']");
      const limite = barre && getComputedStyle(barre).display !== "none" ? barre.getBoundingClientRect().top : window.innerHeight;
      // « end » et non « nearest » : Chrome ne fait rien avec « nearest » tant que le bouton lui-même est dans l'écran,
      // même sous la barre ; « end » le pose au-dessus, à sa marge de défilement (scroll-mb-32) du bas de l'écran.
      if (bouton.getBoundingClientRect().bottom > limite) bouton.scrollIntoView({ block: "end" });
    });
    return () => cancelAnimationFrame(id);
  }, [pret]);
}

/** « +225 07 07 72 09 40 » ; un autre pays : « +33612345678 ». */
function numeroLisible(n: string): string {
  return n.length === 13 && n.startsWith("225") ? `+225 ${telephoneLisible(n.slice(3))}` : `+${n}`;
}

/** Le numéro WhatsApp qui reçoit les messages (le coordinateur des salles) : la direction le change ici. */
function NumeroCoordinateur({ numero, peutRegler }: { numero: string; peutRegler: boolean }) {
  const tx = useTextes(textesSalles);
  const [valeur, setValeur] = useState(numeroLisible(numero));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => setValeur(numeroLisible(numero)), [numero]);
  const vers = (
    <p className="flex items-center gap-2 text-sm text-texte-doux">
      <Phone className="h-4 w-4 shrink-0" /> {tx("numero.vers", { v: { numero: numeroLisible(numero) } })}
    </p>
  );
  if (!peutRegler) return vers;
  const enregistrer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await put<{ coordinateur: string }>("/api/pilotage/salles-du-jour/numero", { numero: valeur });
      setValeur(numeroLisible(r.coordinateur));
      toast(tx("numero.enregistre"));
      await rafraichir("/api/pilotage/salles-du-jour");
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : tx("erreur"));
    } finally {
      setEnvoi(false);
    }
  };
  // Replié : le réglage sert rarement, les messages restent en haut de l'écran du téléphone.
  return (
    <div className="flex flex-col gap-1">
      {vers}
      <details className="rounded-xl border border-ligne-douce" open={Boolean(erreur) || undefined}>
        <summary className="flex min-h-[44px] cursor-pointer items-center px-3 text-sm font-bold">{tx("numero.changer")}</summary>
        <form
          className="flex flex-col gap-2 px-3 pb-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void enregistrer();
          }}
        >
          <Champ
            libelle={tx("numero.libelle")}
            aide={tx("numero.aide")}
            erreur={erreur ?? undefined}
            value={valeur}
            onChange={(e) => setValeur(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            className="min-w-0 flex-1"
          />
          <Bouton type="submit" variante="contour" className="min-h-[48px] sm:mb-[26px]" chargement={envoi} disabled={!valeur.trim()}>
            {tx("numero.enregistrer")}
          </Bouton>
        </form>
      </details>
    </div>
  );
}

/** Les repères « Envoyé » d'avant-hier et plus anciens ne servent plus : on les retire de ce navigateur. */
function oublierVieuxEnvois() {
  try {
    const limite = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const cle = localStorage.key(i);
      if (cle?.startsWith(PREFIXE_ENVOI) && cle.slice(PREFIXE_ENVOI.length, PREFIXE_ENVOI.length + 10) < limite) localStorage.removeItem(cle);
    }
  } catch {
    /* navigateur sans stockage */
  }
}

/**
 * Envoi de ce message (ce jour, cette salle, ce contenu) déjà fait : depuis ce navigateur (localStorage), ou depuis un
 * autre appareil ou l'autre casquette (repère gardé sur le serveur, surServeur). Relu à chaque changement de clé (passage
 * d'Aujourd'hui à Demain, message modifié). Au toucher, le repère part aussi au serveur, sans attendre (un échec ne
 * gêne pas l'envoi : le repère du navigateur reste), et le compte des cartes du tableau et de l'accueil est relu.
 */
function useEnvoye(cle: string, surServeur: boolean): [boolean, () => void] {
  const [notes, setNotes] = useState<Record<string, true>>({});
  const lu = useMemo(() => {
    try {
      return localStorage.getItem(cle) === "1";
    } catch {
      return false;
    }
  }, [cle]);
  return [
    Boolean(notes[cle]) || lu || surServeur,
    () => {
      setNotes((n) => ({ ...n, [cle]: true }));
      try {
        localStorage.setItem(cle, "1");
      } catch {
        /* navigateur sans stockage : le repère vaut pour la page ouverte */
      }
      post("/api/pilotage/salles-du-jour/envoi", { cle })
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/pilotage/salles-du-jour/compte"] }))
        .catch(() => undefined);
    },
  ];
}

function CarteCampus({
  c,
  date,
  envoyes,
  reglages,
  onEcran,
}: {
  c: CampusDuJour;
  date: string;
  /** Repères « Envoyé » gardés sur le serveur (SallesDuJour.envoyes ; absent d'une ancienne réponse). */
  envoyes: string[] | undefined;
  reglages: SallesDuSite | undefined;
  onEcran: (e: EcranDeSalle) => void;
}) {
  const tx = useTextes(textesSalles);
  const ecranDe = (s: SalleDuJour) => onEcran({ id: c.siteId, nom: c.campus, numero: s.numero, salle: s.nom });
  return (
    <li className="flex min-w-0 flex-col gap-4 rounded-2xl border border-ligne bg-white p-4 sm:p-5">
      <h2 className="text-xl font-extrabold tracking-serre">{tx("jour.campus", { v: { campus: c.campus } })}</h2>

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

      <ul className="flex flex-col gap-4">
        {c.salles.map((s) => {
          // Même repère que le compte du tableau et de l'accueil (shared/salles.ts) : un message envoyé y est retiré.
          const cleEnvoi = cleEnvoiSalle(date, c.siteId, s.numero, s.message);
          return <LigneSalle key={cleEnvoi} s={s} cleEnvoi={cleEnvoi} envoyeAilleurs={Boolean(envoyes?.includes(cleEnvoi))} onEcran={() => ecranDe(s)} />;
        })}
      </ul>

      <details className="group mt-auto rounded-xl border border-ligne-douce" open={c.alertes.length > 0}>
        <summary className="flex min-h-[44px] cursor-pointer items-center px-3 text-sm font-bold">{tx("jour.reglerSalles")}</summary>
        <div className="px-3 pb-3">
          <SallesDuCampus site={{ id: c.siteId, nomCourt: c.campus, salleConference: c.salleConference }} donnees={reglages} onEcran={onEcran} />
        </div>
      </details>
    </li>
  );
}

/** Une salle : ses cours, l'état de son écran et, si elle a cours ce jour-là, son message à envoyer. */
function LigneSalle({ s, cleEnvoi, envoyeAilleurs, onEcran }: { s: SalleDuJour; cleEnvoi: string; envoyeAilleurs: boolean; onEcran: () => void }) {
  const tx = useTextes(textesSalles);
  const [envoye, noterEnvoi] = useEnvoye(cleEnvoi, envoyeAilleurs);
  return (
    <li className="flex min-w-0 flex-col gap-2 border-l-4 border-orange pl-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 text-[16px] font-extrabold leading-snug">{s.etiquette}</div>
        {envoye && s.message && (
          <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-succes">
            <CheckCircle2 className="h-4 w-4" /> {tx("jour.envoye")}
          </span>
        )}
      </div>
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
        <p className="text-sm text-texte-pale">{tx("jour.sansMessage")}</p>
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
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-alerte">{tx("jour.ecranAInstaller")}</span>
            <Bouton variante="doux" taille="sm" className="min-h-[44px]" onClick={onEcran} icone={<MonitorSmartphone className="h-4 w-4" />}>
              {tx("jour.installer")}
            </Bouton>
          </div>
          {/* Des cours, mais pas encore de lien : pas de message à envoyer (il ne permettrait pas d'afficher le cours). */}
          {s.lienAPreparer && <p className="text-sm font-semibold text-alerte">{tx("jour.aPreparer")}</p>}
        </div>
      )}
      {s.message && s.lienWhatsApp && (
        <>
          <div className="flex flex-wrap gap-2">
            {/* Un bouton par message : jamais d'orange plein (un seul bouton orange par écran). Envoyé : il s'efface. */}
            <a
              href={s.lienWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              onClick={noterEnvoi}
              aria-label={`${tx("jour.envoyer")} · ${s.etiquette}`}
              data-envoi-salle=""
              className={cn(
                // Marge de défilement : amené à l'écran (usePremierEnvoiVisible), il s'arrête au-dessus de la barre du bas.
                "inline-flex min-h-[48px] scroll-mb-32 items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-bold no-underline lg:scroll-mb-6",
                envoye
                  ? "border-[1.5px] border-encre bg-white text-encre hover:bg-orange-pale hover:text-encre"
                  : "bg-encre text-white hover:bg-orange hover:text-encre",
              )}
            >
              <MessageCircle className="h-4 w-4" />
              {tx("jour.envoyer")}
            </a>
            <Bouton
              variante="contour"
              className="min-h-[48px]"
              icone={<Copy className="h-4 w-4" />}
              aria-label={`${tx("jour.copier")} · ${s.etiquette}`}
              onClick={async () => toast((await copier(s.message as string)) ? tx("jour.copie") : tx("jour.copieImpossible"), "info")}
            >
              {tx("jour.copier")}
            </Bouton>
          </div>
          <details className="rounded-xl bg-creme">
            <summary className="flex min-h-[44px] cursor-pointer items-center px-3 text-sm font-bold">{tx("jour.apercu")}</summary>
            <pre className="max-w-full whitespace-pre-wrap break-words px-3 pb-3 font-sans text-[14px] leading-relaxed [overflow-wrap:anywhere]">{s.message}</pre>
          </details>
        </>
      )}
    </li>
  );
}
