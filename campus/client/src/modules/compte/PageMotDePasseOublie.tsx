// /mot-de-passe-oublie : lien par e-mail si le compte en a un, sinon la vie
// scolaire du campus est prévenue. La réponse est toujours la même : on ne
// révèle jamais si un matricule existe.
import { useState, type FormEvent } from "react";
import { Link, useSearch } from "wouter";
import { ArrowLeft, MailCheck } from "lucide-react";
import { post, ErreurApi } from "@/lib/api";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champs";
import { Erreur } from "@/components/ui/divers";
import { CadrePublic } from "./composants/CadrePublic";
import { ListeContactsSites } from "./composants/AideWhatsApp";

export default function PageMotDePasseOublie() {
  const recherche = new URLSearchParams(useSearch());
  const [identifiant, setIdentifiant] = useState(recherche.get("identifiant") ?? "");
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function demander(e: FormEvent) {
    e.preventDefault();
    if (!identifiant.trim()) return setErreur("Tape ton matricule ou ton numéro de téléphone.");
    setErreur(null);
    setEnvoi(true);
    try {
      await post("/api/compte/oubli", { identifiant: identifiant.trim() });
      setFait(true);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : "Une erreur est survenue. Réessaie dans un instant.");
    } finally {
      setEnvoi(false);
    }
  }

  if (fait) {
    return (
      <CadrePublic identifiant={identifiant}>
        <div className="flex flex-col gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-succes-clair text-succes">
            <MailCheck className="h-7 w-7" />
          </span>
          <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">C'est noté.</h1>
          <div className="flex flex-col gap-3 text-base leading-relaxed text-texte-doux">
            <p>
              <strong className="text-encre">Tu as une adresse e-mail sur ton compte ?</strong> Regarde ta boîte de réception : le lien pour choisir un nouveau code marche pendant 1 heure.
            </p>
            <p>
              <strong className="text-encre">Pas d'e-mail ?</strong> La vie scolaire de ton campus est prévenue : elle va te remettre un nouveau code. Pour aller plus vite, écris-lui :
            </p>
          </div>
          <ListeContactsSites identifiant={identifiant} />
          <LienBouton href={`/connexion?identifiant=${encodeURIComponent(identifiant.trim())}`} variante="contour" taille="lg" className="mt-2 min-h-[56px] w-full">
            Revenir à la connexion
          </LienBouton>
        </div>
      </CadrePublic>
    );
  }

  return (
    <CadrePublic identifiant={identifiant}>
      <Link href="/connexion" className="-ml-1 mb-4 inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-bold text-texte-doux no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" /> Connexion
      </Link>
      <div className="flex flex-col gap-2">
        <span className="etiquette">Code oublié</span>
        <h1 className="text-[38px] font-black leading-[0.98] tracking-tres-serre">Pas de panique.</h1>
        <p className="text-base leading-relaxed text-texte-pale">
          Tape ton matricule ou ton numéro. Tu recevras un lien par e-mail, ou la vie scolaire de ton campus te donnera un nouveau code.
        </p>
      </div>
      <form onSubmit={demander} className="mt-7 flex flex-col gap-5" noValidate>
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
          className="[&_input]:min-h-[52px] [&_input]:text-[17px]"
        />
        {erreur && <Erreur message={erreur} />}
        <Bouton type="submit" taille="lg" pleineLargeur chargement={envoi} className="min-h-[56px] text-[17px]">
          Demander un nouveau code
        </Bouton>
      </form>
    </CadrePublic>
  );
}
