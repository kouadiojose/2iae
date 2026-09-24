// /connexion : un champ pour l'identifiant (matricule, téléphone ou e-mail),
// un champ pour le code secret, un gros bouton. Rien d'autre à comprendre.
import { useState, type FormEvent } from "react";
import { Link, Redirect, useLocation, useSearch } from "wouter";
import { Eye, EyeOff, QrCode } from "lucide-react";
import { useMoi } from "@/lib/auth";
import { post, ErreurApi } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Champ, CaseACocher } from "@/components/ui/champs";
import { Erreur } from "@/components/ui/divers";
import type { Moi } from "@shared/schema";
import { CadrePublic } from "./composants/CadrePublic";
import { AideWhatsApp } from "./composants/AideWhatsApp";
import { destinationApresConnexion, installerMoi, retourSur, ressembleEmail } from "./outils";

export default function PageConnexion() {
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

  const personnel = ressembleEmail(identifiant);
  // Clavier à chiffres pour les codes des étudiants ; clavier complet pour le personnel.
  const clavierChiffres = !personnel && !lettres;

  async function entrer(e: FormEvent) {
    e.preventDefault();
    if (!identifiant.trim()) return setErreur("Tape ton matricule ou ton numéro de téléphone.");
    if (!code) return setErreur(personnel ? "Tapez votre mot de passe." : "Tape ton code secret.");
    setErreur(null);
    setEnvoi(true);
    try {
      const m = await post<Moi>("/api/auth/connexion", { identifiant: identifiant.trim(), motDePasse: code, appareilPartage: partage });
      installerMoi(m, true);
      naviguer(destinationApresConnexion(m, retour), { replace: true });
    } catch (err) {
      setEnvoi(false);
      setCode("");
      setErreur(err instanceof ErreurApi ? err.message : "Une erreur est survenue. Réessaie dans un instant.");
    }
  }

  const lienOubli = `/mot-de-passe-oublie${identifiant.trim() ? `?identifiant=${encodeURIComponent(identifiant.trim())}` : ""}`;

  return (
    <CadrePublic identifiant={identifiant}>
      <div className="flex flex-col gap-2">
        <span className="etiquette">Campus numérique</span>
        <h1 className="text-[40px] font-black leading-[0.98] tracking-tres-serre sm:text-[48px]">
          Akwaba
          <br />
          <span className="text-orange">au campus.</span>
        </h1>
        <p className="text-base leading-relaxed text-texte-pale">Ton matricule et ton code sont sur ta fiche de connexion.</p>
      </div>

      <form onSubmit={entrer} className="mt-7 flex flex-col gap-5" noValidate>
        <Champ
          libelle="Matricule ou numéro de téléphone"
          placeholder="24GC0123 ou 07 07 12 34 56"
          aide="Personnel du campus : votre adresse e-mail."
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
            <button type="button" onClick={() => setLettres((l) => !l)} className="self-start py-1 text-[13px] font-semibold text-texte-gris underline-offset-2 hover:text-encre hover:underline">
              {lettres ? "Mon code n'a que des chiffres" : "Mon code contient des lettres"}
            </button>
          )}
        </div>

        <CaseACocher checked={partage} onChange={setPartage} libelle="Téléphone partagé" aide="Me déconnecter en quittant le campus." />

        {erreur && <Erreur message={erreur} />}

        <Bouton type="submit" taille="lg" pleineLargeur chargement={envoi} className="min-h-[56px] text-[17px]">
          Entrer dans mon campus
        </Bouton>

        <div className="flex items-center justify-between gap-3 text-[15px] font-bold">
          <Link href={lienOubli} className="inline-flex min-h-[48px] items-center">
            Code oublié ?
          </Link>
          <button type="button" onClick={() => setAide(true)} className="inline-flex min-h-[48px] items-center text-orange-fonce hover:text-encre">
            Besoin d'aide ?
          </button>
        </div>
      </form>

      <div className="mt-4 flex gap-3 rounded-2xl bg-creme p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-orange-fonce">
          <QrCode className="h-5 w-5" />
        </span>
        <p className="text-[15px] leading-snug text-texte-doux">
          <strong className="text-encre">Première fois ?</strong> Scanne le QR code de ta fiche avec l'appareil photo : tu entres sans rien taper.
        </p>
      </div>

      <AideWhatsApp ouverte={aide} onFermer={() => setAide(false)} identifiant={identifiant} />
    </CadrePublic>
  );
}
