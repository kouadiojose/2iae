// /connexion : un champ pour l'identifiant (matricule, téléphone ou e-mail),
// un champ pour le mot de passe (ou code secret), un gros bouton. Rien d'autre à comprendre.
//
// Neutre pour tous (8 octobre 2026) : formateurs, équipe et étudiants arrivent par la même page. On vouvoie,
// comme chaque fois qu'on ne sait pas à qui l'on parle ; les champs viennent en premier, « Nouvel étudiant ?
// Créer mon compte » ensuite, plus discret.
//
// Mode campus (15 octobre 2026) : le lien donné au chargé du campus est /mon-campus ; sans session, il arrive ici avec
// ?retour=/mon-campus. La page devient « Espace du campus » : l'e-mail, le code secret, « Entrer ». Rien d'autre
// (ni « Téléphone partagé », ni « Créer mon compte »).
import { useState, type FormEvent } from "react";
import { Link, Redirect, useLocation, useSearch } from "wouter";
import { Eye, EyeOff, QrCode, UserPlus } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { t as textesCampus } from "@shared/textes/campus";
import { useMoi } from "@/lib/auth";
import { post, ErreurApi } from "@/lib/api";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Champ, CaseACocher } from "@/components/ui/champs";
import { Erreur } from "@/components/ui/divers";
import type { Moi } from "@shared/schema";
import { CadrePublic } from "./composants/CadrePublic";
import { AideWhatsApp } from "./composants/AideWhatsApp";
import { destinationApresConnexion, installerMoi, retourSur, ressembleEmail } from "./outils";

export default function PageConnexion() {
  const recherche = new URLSearchParams(useSearch());
  const retour = retourSur(recherche.get("retour"));
  if (retour?.startsWith("/mon-campus")) return <ConnexionCampus retour={retour} />;
  return <ConnexionCommune />;
}

/** « Espace du campus » : l'e-mail et le code secret donnés par la direction, puis « Entrer ». */
function ConnexionCampus({ retour }: { retour: string }) {
  const { moi } = useMoi();
  const tx = useTextes(textesCampus);
  const [, naviguer] = useLocation();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  if (moi && !envoi) return <Redirect to={destinationApresConnexion(moi, retour)} replace />;

  async function entrer(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !code) return setErreur(tx("connexion.vide"));
    setErreur(null);
    setEnvoi(true);
    try {
      const m = await post<Moi>("/api/auth/connexion", { identifiant: email.trim(), motDePasse: code });
      installerMoi(m, true);
      naviguer(destinationApresConnexion(m, retour), { replace: true });
    } catch (err) {
      setEnvoi(false);
      setCode("");
      // Trop d'essais : le message du serveur ; sinon une phrase simple.
      setErreur(err instanceof ErreurApi && err.statut === 429 ? err.message : err instanceof ErreurApi && err.statut === 0 ? err.message : tx("connexion.erreur"));
    }
  }

  const champ = "min-h-[64px] w-full rounded-[18px] border-[3px] border-encre bg-white px-5 text-[22px] text-encre outline-none focus:border-orange";
  return (
    <div className="min-h-dvh bg-white text-encre">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-7 px-4 pb-16 pt-8 sm:pt-14">
        <img src="/marque-2iae.png" alt="Groupe Écoles 2IAE" className="h-14 w-auto self-start" />
        <h1 className="text-[40px] font-black leading-tight sm:text-[44px]">{tx("connexion.titre")}</h1>
        <form onSubmit={entrer} className="flex flex-col gap-6" noValidate>
          <label className="flex flex-col gap-2">
            <span className="text-[22px] font-bold">{tx("connexion.email")}</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={champ}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[22px] font-bold">{tx("connexion.code")}</span>
            <span className="relative block">
              <input
                type={voir ? "text" : "password"}
                autoComplete="current-password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${champ} pr-20`}
              />
              <button
                type="button"
                onClick={() => setVoir((v) => !v)}
                className="absolute right-2 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-xl text-encre"
                aria-label={voir ? tx("connexion.cacher") : tx("connexion.voir")}
                aria-pressed={voir}
              >
                {voir ? <EyeOff className="h-7 w-7" /> : <Eye className="h-7 w-7" />}
              </button>
            </span>
          </label>
          {erreur && (
            <p className="rounded-[18px] bg-danger-clair px-5 py-4 text-[22px] font-bold text-danger" role="alert">
              {erreur}
            </p>
          )}
          <button type="submit" disabled={envoi} className="min-h-[72px] w-full rounded-[20px] bg-orange px-6 text-[26px] font-black text-encre disabled:opacity-80">
            {tx("connexion.entrer")}
          </button>
        </form>
        <p className="text-[20px] text-texte-doux">{tx("connexion.aide")}</p>
      </main>
    </div>
  );
}

function ConnexionCommune() {
  const { moi } = useMoi();
  const recherche = new URLSearchParams(useSearch());
  const retour = retourSur(recherche.get("retour"));
  const [, naviguer] = useLocation();

  const [identifiant, setIdentifiant] = useState(recherche.get("identifiant") ?? "");
  const [code, setCode] = useState("");
  const [voirCode, setVoirCode] = useState(false);
  const [lettres, setLettres] = useState(false);
  const [partage, setPartage] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [aide, setAide] = useState(false);

  // Déjà connecté (lien ouvert depuis WhatsApp, bouton retour…) : on file à destination.
  if (moi && !envoi) return <Redirect to={destinationApresConnexion(moi, retour)} replace />;

  // Personnel : une adresse e-mail, ou un numéro étranger (formateur au Canada, en Allemagne… : +1, +49, jamais +225).
  const personnel = ressembleEmail(identifiant) || /^\s*(\+|00)(?!\s*225)/.test(identifiant);
  // Clavier à chiffres pour les codes des étudiants ; clavier complet pour le personnel.
  const clavierChiffres = !personnel && !lettres;

  async function entrer(e: FormEvent) {
    e.preventDefault();
    if (!identifiant.trim()) return setErreur("Indiquez votre identifiant : e-mail, téléphone ou matricule.");
    if (!code) return setErreur(personnel ? "Tapez votre mot de passe." : "Tapez votre code secret.");
    setErreur(null);
    setEnvoi(true);
    try {
      const m = await post<Moi>("/api/auth/connexion", { identifiant: identifiant.trim(), motDePasse: code, appareilPartage: partage });
      installerMoi(m, true);
      naviguer(destinationApresConnexion(m, retour), { replace: true });
    } catch (err) {
      setEnvoi(false);
      setCode("");
      setErreur(err instanceof ErreurApi ? err.message : "Une erreur est survenue. Réessayez dans un instant.");
    }
  }

  const lienOubli = `/mot-de-passe-oublie${identifiant.trim() ? `?identifiant=${encodeURIComponent(identifiant.trim())}` : ""}`;

  return (
    <CadrePublic identifiant={identifiant}>
      <div className="flex flex-col gap-2">
        <span className="etiquette">Campus numérique</span>
        <h1 className="text-[36px] font-black leading-[1.02] tracking-tres-serre sm:text-[44px]">
          Bienvenue sur le <span className="text-orange">campus 2IAE</span>
        </h1>
        <p className="text-[17px] leading-relaxed text-texte-pale">Entrez votre identifiant et votre mot de passe.</p>
      </div>

      <form onSubmit={entrer} className="mt-6 flex flex-col gap-5" noValidate>
        <Champ
          libelle="Identifiant : e-mail, téléphone ou matricule"
          placeholder="e-mail ou 07 07 12 34 56"
          value={identifiant}
          onChange={(e) => setIdentifiant(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          className="[&_input]:min-h-[52px] [&_input]:text-[17px]"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="code-secret" className="text-sm font-bold text-encre">
            {personnel ? "Mot de passe" : "Code secret"}
          </label>
          <div className="relative">
            <input
              id="code-secret"
              type={voirCode ? "text" : "password"}
              inputMode={clavierChiffres ? "numeric" : "text"}
              autoComplete="current-password"
              enterKeyHint="go"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={personnel ? "" : "••••••"}
              className="min-h-[52px] w-full rounded-xl border border-ligne bg-white py-3 pl-4 pr-14 text-[17px] tracking-wide text-encre outline-none transition-colors placeholder:text-texte-gris focus:border-orange focus:ring-2 focus:ring-orange/20"
            />
            <button
              type="button"
              onClick={() => setVoirCode((v) => !v)}
              className="absolute right-1 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-xl text-texte-pale hover:bg-creme hover:text-encre"
              aria-label={voirCode ? "Cacher le code" : "Afficher le code"}
              aria-pressed={voirCode}
            >
              {voirCode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {!personnel && (
            <button type="button" onClick={() => setLettres((l) => !l)} className="-my-2 min-h-[44px] self-start text-[14px] font-semibold text-texte-gris underline-offset-2 hover:text-encre hover:underline">
              {lettres ? "Mon code n'a que des chiffres" : "Mon code contient des lettres"}
            </button>
          )}
        </div>

        <CaseACocher checked={partage} onChange={setPartage} libelle="Téléphone partagé" aide="Me déconnecter en quittant le campus." />

        {erreur && <Erreur message={erreur} />}

        <Bouton type="submit" taille="lg" pleineLargeur chargement={envoi} className="min-h-[60px] text-[18px]">
          Entrer
        </Bouton>

        <div className="flex items-center justify-between gap-3 text-[15px] font-bold">
          <Link href={lienOubli} className="inline-flex min-h-[48px] items-center">
            {personnel ? "Mot de passe oublié ?" : "Code oublié ?"}
          </Link>
          <button type="button" onClick={() => setAide(true)} className="inline-flex min-h-[48px] items-center text-orange-fonce hover:text-encre">
            Besoin d'aide ?
          </button>
        </div>
      </form>

      {/* En second, plus discret : les nouveaux étudiants créent leur compte eux-mêmes. */}
      <div className="mt-7 flex flex-col gap-3 border-t border-ligne-douce pt-6">
        <LienBouton href="/inscription" taille="lg" variante="contour" icone={<UserPlus className="h-5 w-5 text-orange-fonce" />} className="min-h-[56px] w-full text-[16px]">
          Nouvel étudiant ? Créer mon compte
        </LienBouton>
        <div className="flex gap-3 rounded-2xl bg-creme p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-orange-fonce">
            <QrCode className="h-5 w-5" />
          </span>
          <p className="text-[15px] leading-snug text-texte-doux">
            <strong className="text-encre">Une fiche de connexion avec un QR code ?</strong> Scannez-le avec l'appareil photo : vous entrez sans rien taper.
          </p>
        </div>
      </div>

      <AideWhatsApp ouverte={aide} onFermer={() => setAide(false)} identifiant={identifiant} />
    </CadrePublic>
  );
}
