// /bienvenue : le parcours de première connexion, en étapes courtes, avec une
// barre de progression et un seul bouton par écran.
//
// Étudiant : c'est bien toi ? → code secret (pavé géant) → charte → comment
// suis-tu les cours ? → visite en 3 écrans → premier devoir d'essai → rappels.
// Formateur et équipe : même esprit, sans devoir d'essai ni forfait internet.
// Les étapes déjà faites sont sautées ; ?visite=1 ne montre que la visite.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, BellRing, Check, CheckCircle2, MessageCircleQuestion, Signal, Wifi } from "lucide-react";
import { useMoiConnecte, accueilDuRole, seDeconnecter } from "@/lib/auth";
import { post, patch, ErreurApi } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Avatar, BarreProgression, Erreur, Squelette } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { toast } from "@/components/ui/toast";
import { Marque, lienAide } from "@/components/layout/coquille";
import { ActiverNotifications } from "@/modules/pwa/ActiverNotifications";
import { InviteInstallation } from "@/modules/pwa/InviteInstallation";
import { rafraichir } from "@/lib/queryClient";
import { cn, nomComplet } from "@/lib/utils";
import { LIBELLES_ROLES, type Moi, type ParcoursBienvenue } from "@shared/schema";
import { PiedAction, LienDiscret } from "./composants/PiedAction";
import { PaveCode } from "./composants/PaveCode";
import { FormulaireMotDePasse } from "./composants/FormulaireMotDePasse";
import { ContenuCharte } from "./composants/Charte";
import { CarteChoix, GroupeChoix, OPTIONS_SUIVI, type ModeSuivi } from "./composants/Choix";
import { useEcransVisite } from "./composants/Visite";
import { EssaiDepot } from "./composants/EssaiDepot";
import { ListeContactsSites } from "./composants/AideWhatsApp";
import { majMoi, retourSur, tuOuVous } from "./outils";

type Etape = "moi" | "code" | "charte" | "suivi" | "visite" | "essai" | "rappels";

const LIBELLES: Record<Etape, [tu: string, vous: string]> = {
  moi: ["C'est bien toi ?", "C'est bien vous ?"],
  code: ["Ton code secret", "Votre mot de passe"],
  charte: ["La charte", "La charte"],
  suivi: ["Tes habitudes", "Vos habitudes"],
  visite: ["La visite", "La visite"],
  essai: ["Ton premier devoir", "Premier devoir"],
  rappels: ["Les rappels", "Les rappels"],
};

/** ?visite=1 : revoir la visite · ?essai=1 : refaire le devoir d'essai (lien possible depuis l'accueil). */
type Mode = "complet" | "visite" | "essai";

/** Étapes qu'il reste à faire pour cette personne (calculées une fois, à l'arrivée). */
function etapesDuParcours(moi: Moi, p: ParcoursBienvenue, mode: Mode): Etape[] {
  if (mode === "visite") return moi.role === "salle" ? [] : ["visite"];
  if (mode === "essai") return moi.role === "etudiant" ? ["essai"] : [];
  // L'écran d'une salle de conférence n'a besoin que de son mot de passe.
  if (moi.role === "salle") return p.codeChoisi ? [] : ["code"];
  const etudiant = moi.role === "etudiant";
  const liste: Etape[] = [];
  if (!p.codeChoisi) liste.push("moi", "code");
  if (!p.charteAcceptee) liste.push("charte");
  if (etudiant && !p.modeSuiviChoisi) liste.push("suivi");
  if (!p.visiteFaite) liste.push("visite");
  if (etudiant && !p.essai) liste.push("essai");
  // Rappels et installation : seulement lors de la vraie première fois.
  if (liste.includes("code") || liste.includes("visite")) liste.push("rappels");
  return liste;
}

export default function PageBienvenue() {
  const moi = useMoiConnecte();
  const t = tuOuVous(moi);
  const [, naviguer] = useLocation();
  const recherche = new URLSearchParams(useSearch());
  const mode: Mode = recherche.get("visite") === "1" ? "visite" : recherche.get("essai") === "1" ? "essai" : "complet";
  const seulementVisite = mode === "visite";
  const retour = retourSur(recherche.get("retour"));

  // Toujours relu à l'arrivée : un parcours gardé en cache ferait rejouer des étapes déjà faites.
  const { data: parcours, error, refetch, isFetchedAfterMount } = useQuery<ParcoursBienvenue>({ queryKey: ["/api/compte/parcours"], staleTime: 0, refetchOnMount: "always" });
  const [etapes, setEtapes] = useState<Etape[] | null>(null);
  const [index, setIndex] = useState(0);
  const [ecranVisite, setEcranVisite] = useState(0);
  /** Confirmation affichée en haut de l'étape suivante (« code enregistré »), sans toast qui cacherait le bouton. */
  const [bandeau, setBandeau] = useState<string | null>(null);

  useEffect(() => {
    if (parcours && isFetchedAfterMount && !etapes) setEtapes(etapesDuParcours(moi, parcours, mode));
  }, [parcours, isFetchedAfterMount, etapes, moi, mode]);

  const destination = retour ?? accueilDuRole(moi.role);
  const premiereFois = Boolean(etapes?.includes("rappels"));

  function terminer() {
    void rafraichir("/api/compte/parcours");
    if (premiereFois) toast(t(`Bienvenue sur ton campus, ${moi.prenom} !`, `Bienvenue sur le campus, ${moi.prenom}.`));
    naviguer(destination, { replace: true });
  }

  function suivant() {
    if (!etapes) return;
    if (index + 1 >= etapes.length) return terminer();
    setIndex(index + 1);
    setEcranVisite(0);
    setBandeau(null);
    window.scrollTo({ top: 0 });
  }

  // Rien à faire (tout est déjà fait) : direction l'accueil.
  useEffect(() => {
    if (etapes && etapes.length === 0) naviguer(destination, { replace: true });
  }, [etapes, destination, naviguer]);

  if (error) {
    return (
      <Cadre>
        <Erreur message={error instanceof ErreurApi ? error.message : t("Impossible de charger ton parcours.", "Impossible de charger votre parcours.")} reessayer={() => void refetch()} />
      </Cadre>
    );
  }
  if (!etapes || etapes.length === 0) {
    return (
      <Cadre>
        <div className="flex flex-col gap-4" aria-busy="true">
          <Squelette className="h-10 w-3/4" />
          <Squelette className="h-6 w-full" />
          <Squelette className="h-56 w-full" />
        </div>
      </Cadre>
    );
  }

  const etape = etapes[Math.min(index, etapes.length - 1)];
  const precedente = index > 0 ? etapes[index - 1] : null;
  // On peut revenir en arrière, sauf vers ce qui est déjà enregistré pour de bon (code, charte, essai).
  const peutRevenir = precedente === "moi" || precedente === "suivi" || precedente === "visite";
  const fraction = etape === "visite" ? (ecranVisite + 1) / 3 : 1;
  const progression = ((index + fraction) / etapes.length) * 100;
  const libelleProgression = seulementVisite
    ? `Visite guidée · ${ecranVisite + 1} sur 3`
    : mode === "essai"
      ? "Devoir d'essai · non noté"
      : `Étape ${index + 1} sur ${etapes.length} · ${t(...LIBELLES[etape])}`;

  return (
    <Cadre
      etapes={mode === "complet" ? etapes : undefined}
      index={index}
      entete={
        <div className="flex items-center gap-3">
          {peutRevenir ? (
            <button
              type="button"
              onClick={() => {
                setIndex(index - 1);
                setEcranVisite(0);
                setBandeau(null);
              }}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-texte-doux hover:bg-creme hover:text-encre"
              aria-label="Étape précédente"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="h-12 w-1 shrink-0" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="truncate font-mono text-xs text-texte-gris">{libelleProgression}</span>
            <BarreProgression valeur={progression} className="h-2" />
          </div>
          <BoutonAide moi={moi} />
        </div>
      }
    >
      {/* Opacité seule : une animation de « transform » décrocherait le bouton collé en bas (position fixed). */}
      <div key={`${etape}-${index}`} className="animate-apparait">
        {bandeau && (
          <p className="mb-5 flex items-center gap-2.5 rounded-2xl bg-succes-clair px-4 py-3 text-[15px] font-bold text-succes" role="status">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            {bandeau}
          </p>
        )}
        {etape === "moi" && <EtapeMoi moi={moi} onOui={suivant} />}
        {etape === "code" && (
          <EtapeCode
            moi={moi}
            onFini={() => {
              suivant();
              setBandeau(t("Ton code secret est enregistré. Retiens-le bien !", "Votre mot de passe est enregistré."));
            }}
          />
        )}
        {etape === "charte" && <EtapeCharte moi={moi} onFini={suivant} />}
        {etape === "suivi" && <EtapeSuivi moi={moi} onFini={suivant} />}
        {etape === "visite" && <EtapeVisite moi={moi} ecran={ecranVisite} setEcran={setEcranVisite} onFini={suivant} derniere={index + 1 >= etapes.length} />}
        {etape === "essai" && <EssaiDepot onFini={suivant} onPlusTard={suivant} />}
        {etape === "rappels" && <EtapeRappels moi={moi} onFini={terminer} />}
      </div>
    </Cadre>
  );
}

// ── Mise en page ───────────────────────────────────────────────────────────

/**
 * Téléphone : barre de progression en haut, contenu, bouton collé en bas.
 * Ordinateur : la liste des étapes à gauche, sur un panneau crème.
 */
function Cadre({ children, entete, etapes, index = 0 }: { children: ReactNode; entete?: ReactNode; etapes?: Etape[]; index?: number }) {
  const moi = useMoiConnecte();
  const t = tuOuVous(moi);
  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="hidden min-h-dvh flex-col gap-10 border-r border-ligne-douce bg-creme p-10 lg:flex">
        <Marque />
        {etapes && (
          <div className="flex flex-col gap-4">
            <span className="etiquette">{t("Ton arrivée sur le campus", "Votre arrivée sur le campus")}</span>
            <ol className="flex flex-col gap-1">
              {etapes.map((e, i) => {
                const faite = i < index;
                const courante = i === index;
                return (
                  <li key={e} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-bold", courante ? "bg-white text-encre shadow-carte" : faite ? "text-texte-doux" : "text-texte-gris")}>
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-xs",
                        faite ? "bg-succes text-white" : courante ? "bg-orange text-encre" : "border border-ligne-forte bg-white",
                      )}
                    >
                      {faite ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                    </span>
                    {t(...LIBELLES[e])}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        <p className="mt-auto font-mono text-[11px] text-texte-gris">Groupe Écoles 2IAE International · Campus numérique</p>
      </aside>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-20 border-b border-ligne-douce bg-white/95 px-3 py-2 backdrop-blur-md sm:px-6 lg:border-0 lg:bg-transparent lg:px-10 lg:pt-8">
          <div className="mx-auto w-full max-w-[560px]">{entete}</div>
        </header>
        <main className="flex-1 px-4 pb-44 pt-6 sm:px-6 sm:pb-16 lg:px-10 lg:pt-6">
          <div className="mx-auto w-full max-w-[520px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

function BoutonAide({ moi }: { moi: Moi }) {
  const lien = lienAide(moi);
  if (!lien) return <span className="h-12 w-1 shrink-0" />;
  return (
    <a
      href={lien}
      target="_blank"
      rel="noopener noreferrer"
      className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-orange-fonce hover:bg-creme hover:text-encre"
      aria-label="Besoin d'aide ? Écrire à la vie scolaire sur WhatsApp"
      title="Besoin d'aide ?"
    >
      <MessageCircleQuestion className="h-6 w-6" />
    </a>
  );
}

function Titre({ etiquette, titre, texte }: { etiquette?: string; titre: ReactNode; texte?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {etiquette && <span className="etiquette">{etiquette}</span>}
      <h1 className="text-[32px] font-black leading-[1.02] tracking-serre sm:text-[38px]">{titre}</h1>
      {texte && <p className="text-base leading-relaxed text-texte-pale">{texte}</p>}
    </div>
  );
}

// ── Étapes ─────────────────────────────────────────────────────────────────

function EtapeMoi({ moi, onOui }: { moi: Moi; onOui: () => void }) {
  const t = tuOuVous(moi);
  const [pasMoi, setPasMoi] = useState(false);
  const lignes = [
    moi.role === "etudiant" ? { l: "Classe", v: moi.classe?.nom } : { l: "Profil", v: LIBELLES_ROLES[moi.role] },
    { l: "Campus", v: moi.site?.nom },
    moi.matricule ? { l: "Matricule", v: moi.matricule } : { l: "E-mail", v: moi.email },
  ].filter((x): x is { l: string; v: string } => Boolean(x.v));
  return (
    <div className="flex flex-col gap-6">
      <Titre etiquette={t("Première connexion", "Première connexion")} titre={t(`C'est bien toi, ${moi.prenom} ?`, `C'est bien vous, ${moi.prenom} ?`)} texte={t("Vérifie ton nom, ta classe et ton campus.", "Vérifiez vos informations.")} />
      <div className="rounded-[24px] border border-ligne bg-white p-5 shadow-carte">
        <div className="flex items-center gap-4">
          <Avatar prenom={moi.prenom} nom={moi.nom} photo={moi.photoUrl} taille={64} />
          <div className="min-w-0">
            <p className="text-[22px] font-black leading-tight tracking-serre">{nomComplet(moi)}</p>
            <p className="font-mono text-xs text-texte-gris">{LIBELLES_ROLES[moi.role]}</p>
          </div>
        </div>
        <dl className="mt-5 flex flex-col divide-y divide-ligne-douce">
          {lignes.map((x) => (
            <div key={x.l} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="font-mono text-xs uppercase tracking-wider text-texte-gris">{x.l}</dt>
              <dd className="text-right text-base font-bold">{x.v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <PiedAction>
        <Bouton taille="lg" pleineLargeur className="min-h-[56px] text-[17px]" onClick={onOui}>
          {t("Oui, c'est moi", "Oui, c'est moi")}
        </Bouton>
        <LienDiscret onClick={() => setPasMoi(true)}>Ce n'est pas moi</LienDiscret>
      </PiedAction>
      <Fenetre
        ouverte={pasMoi}
        onFermer={() => setPasMoi(false)}
        titre={t("Ce n'est pas ton compte ?", "Ce n'est pas votre compte ?")}
        description={t("Ne va pas plus loin : préviens la vie scolaire de ton campus, elle va vérifier ta fiche.", "N'allez pas plus loin : prévenez la vie scolaire, elle vérifiera la fiche.")}
      >
        <div className="flex flex-col gap-4 pb-3">
          <ListeContactsSites />
          <Bouton variante="contour" taille="lg" pleineLargeur onClick={() => void seDeconnecter()}>
            Me déconnecter
          </Bouton>
        </div>
      </Fenetre>
    </div>
  );
}

function EtapeCode({ moi, onFini }: { moi: Moi; onFini: () => void }) {
  const { data: parcours } = useQuery<ParcoursBienvenue>({ queryKey: ["/api/compte/parcours"] });
  const minimum = parcours?.longueurMinimale ?? (moi.role === "etudiant" ? 6 : 10);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [remise, setRemise] = useState(0);

  async function enregistrer(nouveau: string) {
    await post("/api/auth/mot-de-passe", { nouveau });
    majMoi({ ...moi, doitChangerMotDePasse: false });
    onFini();
  }

  if (moi.role === "etudiant") {
    return (
      <div className="flex flex-col items-center">
        <span className="etiquette mb-2">Code secret</span>
        <PaveCode
          mode="choix"
          titre="Choisis ton code secret"
          aide={`${minimum} chiffres, comme pour Orange Money ou Wave. Il remplace le code de ta fiche. Ne le donne à personne.`}
          longueur={Math.max(6, minimum)}
          occupe={occupe}
          erreur={erreur}
          remise={remise}
          onTermine={async (code) => {
            setOccupe(true);
            setErreur(null);
            try {
              await enregistrer(code);
            } catch (e) {
              setErreur(e instanceof ErreurApi ? e.message : "Une erreur est survenue. Réessaie dans un instant.");
              setRemise((n) => n + 1);
              setOccupe(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Titre
        etiquette="Mot de passe"
        titre={moi.role === "salle" ? "Choisissez le mot de passe de cet écran" : "Choisissez votre mot de passe"}
        texte={`${minimum} caractères au moins. Il remplace le mot de passe provisoire qui vous a été remis.`}
      />
      <FormulaireMotDePasse minimum={minimum} libelleBouton="Enregistrer mon mot de passe" onValider={(n) => enregistrer(n)} enveloppeBouton={(b) => <PiedAction>{b}</PiedAction>} />
    </div>
  );
}

function EtapeCharte({ moi, onFini }: { moi: Moi; onFini: () => void }) {
  const t = tuOuVous(moi);
  const [envoi, setEnvoi] = useState(false);
  async function accepter() {
    setEnvoi(true);
    try {
      majMoi(await post<Moi>("/api/compte/charte"));
      onFini();
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : "Une erreur est survenue. Réessaie dans un instant.", "erreur");
      setEnvoi(false);
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <Titre etiquette="Charte du campus" titre={t("Trois règles pour bien commencer", "Trois engagements pour bien commencer")} texte={t("Lis-les, c'est court.", "Elles tiennent en une minute.")} />
      <ContenuCharte role={moi.role} />
      <PiedAction>
        <Bouton taille="lg" pleineLargeur chargement={envoi} className="min-h-[56px] text-[17px]" onClick={accepter}>
          J'accepte
        </Bouton>
        <p className="pb-1 pt-1 text-center text-[13px] text-texte-gris">{t("Tu pourras la relire à tout moment dans ton profil.", "Vous pourrez la relire à tout moment dans votre profil.")}</p>
      </PiedAction>
    </div>
  );
}

function EtapeSuivi({ moi, onFini }: { moi: Moi; onFini: () => void }) {
  const [mode, setMode] = useState<ModeSuivi | undefined>(moi.preferences?.modeSuivi);
  // Petit forfait coché d'avance : la plupart des étudiants suivent en 4G prépayée.
  const [reduites, setReduites] = useState(moi.preferences?.donneesReduites ?? true);
  const [envoi, setEnvoi] = useState(false);

  async function enregistrer() {
    if (!mode) return;
    setEnvoi(true);
    try {
      majMoi(await patch<Moi>("/api/compte/preferences", { modeSuivi: mode, donneesReduites: reduites }));
      onFini();
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : "Une erreur est survenue. Réessaie dans un instant.", "erreur");
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-4">
        <Titre etiquette="Tes habitudes" titre="Comment suis‑tu les cours ?" texte="Le plus souvent. Tu pourras changer d'avis dans ton profil." />
        <GroupeChoix libelle="Comment suis-tu les cours ?">
          {OPTIONS_SUIVI.map((o) => (
            <CarteChoix key={o.valeur} choisie={mode === o.valeur} onChoisir={() => setMode(o.valeur)} titre={o.titre} detail={o.detail} icone={o.icone} />
          ))}
        </GroupeChoix>
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="text-[22px] font-black tracking-serre">Ton forfait internet</h2>
        <GroupeChoix libelle="Ton forfait internet">
          <CarteChoix
            choisie={reduites}
            onChoisir={() => setReduites(true)}
            titre="Petit forfait : j'économise"
            detail="Lives en audio et diapos, images allégées."
            icone={<Signal className="h-6 w-6" />}
          />
          <CarteChoix choisie={!reduites} onChoisir={() => setReduites(false)} titre="Wi-Fi ou gros forfait" detail="Lives en vidéo quand c'est possible." icone={<Wifi className="h-6 w-6" />} />
        </GroupeChoix>
      </div>
      <PiedAction>
        <Bouton taille="lg" pleineLargeur chargement={envoi} disabled={!mode} className="min-h-[56px] text-[17px]" onClick={enregistrer}>
          {mode ? "Continuer" : "Choisis comment tu suis les cours"}
        </Bouton>
      </PiedAction>
    </div>
  );
}

function EtapeVisite({ moi, ecran, setEcran, onFini, derniere }: { moi: Moi; ecran: number; setEcran: (n: number) => void; onFini: () => void; derniere: boolean }) {
  const t = tuOuVous(moi);
  const ecrans = useEcransVisite(moi.role);
  const [envoi, setEnvoi] = useState(false);
  const e = ecrans[Math.min(ecran, ecrans.length - 1)];
  const dernierEcran = ecran >= ecrans.length - 1;

  async function finir() {
    setEnvoi(true);
    try {
      majMoi(await patch<Moi>("/api/compte/preferences", { visiteFaite: true }));
    } catch {
      /* la visite n'est pas bloquante : on continue même si l'enregistrement échoue */
    }
    onFini();
  }

  return (
    <div className="flex flex-col gap-6">
      <div key={e.cle} className="flex animate-monte flex-col gap-6">
        <div className="rounded-[28px] bg-creme px-4 py-6 sm:px-6">{e.illustration}</div>
        <Titre etiquette={e.etiquette} titre={e.titre} texte={e.texte} />
      </div>
      <div className="flex justify-center gap-2" aria-hidden>
        {ecrans.map((x, i) => (
          <span key={x.cle} className={cn("h-2 rounded-full transition-all", i === ecran ? "w-6 bg-orange" : "w-2 bg-ligne-forte")} />
        ))}
      </div>
      <PiedAction>
        <Bouton taille="lg" pleineLargeur chargement={envoi} className="min-h-[56px] text-[17px]" onClick={() => (dernierEcran ? void finir() : setEcran(ecran + 1))}>
          {dernierEcran ? (derniere ? t("J'ai compris, entrer", "J'ai compris, entrer") : "J'ai compris") : "Suivant"}
        </Bouton>
        {!dernierEcran && <LienDiscret onClick={() => void finir()}>Passer la visite</LienDiscret>}
      </PiedAction>
    </div>
  );
}

function EtapeRappels({ moi, onFini }: { moi: Moi; onFini: () => void }) {
  const t = tuOuVous(moi);
  const exemple = useMemo(() => (moi.role === "etudiant" ? "Initiation à l'IA commence dans 15 min. Touche pour rejoindre le live." : "Votre séance commence dans 15 min. Ouvrez le studio."), [moi.role]);
  return (
    <div className="flex flex-col gap-6">
      <Titre
        etiquette="Dernière chose"
        titre={t("Ne rate aucun cours", "Ne manquez aucune séance")}
        texte={t(
          "On te prévient 15 minutes avant chaque cours en direct et la veille d'un devoir. Jamais la nuit, et jamais le contenu d'une note.",
          "Un rappel 15 minutes avant chaque séance, et quand un étudiant vous écrit. Jamais la nuit.",
        )}
      />
      {/* Aperçu d'un rappel, pour qu'on sache à quoi on dit oui. */}
      <div className="rounded-[28px] bg-encre p-4" aria-hidden>
        <div className="flex items-start gap-3 rounded-2xl bg-white/95 p-3.5 shadow-carte">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange text-encre">
            <BellRing className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-extrabold">Campus 2IAE</span>
              <span className="font-mono text-[11px] text-texte-gris">maintenant</span>
            </div>
            <p className="text-[14px] leading-snug text-texte-doux">{exemple}</p>
          </div>
        </div>
      </div>
      <ActiverNotifications />
      <InviteInstallation />
      <PiedAction>
        <Bouton taille="lg" pleineLargeur className="min-h-[56px] text-[17px]" onClick={onFini}>
          {t("Entrer dans mon campus", "Entrer dans le campus")}
        </Bouton>
      </PiedAction>
    </div>
  );
}
