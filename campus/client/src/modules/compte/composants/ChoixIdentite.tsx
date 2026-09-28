// Première connexion d'un formateur (arrivé par son lien d'invitation), ou
// d'un membre de l'équipe créé sans identifiant : il vérifie son prénom et
// son nom (préremplis, « M. Konaté » quand le prénom n'était pas connu),
// choisit l'identifiant avec lequel il se connectera ensuite (son e-mail, ou
// son numéro au format international) et son mot de passe. Un seul envoi :
// POST /api/compte/premiere-connexion.
import { useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, AtSign } from "lucide-react";
import type { Moi } from "@shared/schema";
import type { CorpsPremiereConnexion } from "@shared/lancement";
import { post, ErreurApi } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champs";
import { Erreur } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import { PiedAction } from "./PiedAction";
import { majMoi, formaterTelephone } from "../outils";

/** Prénom encore inconnu : « M. », « Mme », « Dr »… */
const civilite = (prenom: string) => /^(m|mme|mlle|dr|pr)\.?$/i.test(prenom.trim());

/** Identifiant de départ : l'e-mail du compte, sinon son téléphone. */
function identifiantInitial(moi: Moi): string {
  if (moi.email) return moi.email;
  if (!moi.telephone) return "";
  return /^\d{10}$/.test(moi.telephone) ? formaterTelephone(moi.telephone) : `+${moi.telephone}`;
}

export function ChoixIdentite({ moi, minimum, onFini }: { moi: Moi; minimum: number; onFini: () => void }) {
  const [prenom, setPrenom] = useState(moi.prenom);
  const [nom, setNom] = useState(moi.nom);
  const [identifiant, setIdentifiant] = useState(identifiantInitial(moi));
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const regles = [
    { ok: nouveau.length >= minimum, texte: `${minimum} caractères au moins` },
    { ok: nouveau.length > 0 && nouveau === confirmation, texte: "Les deux saisies sont identiques" },
  ];

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (!prenom.trim() || !nom.trim()) return setErreur("Indiquez votre prénom et votre nom.");
    if (!identifiant.trim()) return setErreur("Indiquez votre adresse e-mail ou votre numéro de téléphone.");
    if (nouveau.length < minimum) return setErreur(`Votre mot de passe doit faire au moins ${minimum} caractères.`);
    if (nouveau !== confirmation) return setErreur("Les deux saisies du mot de passe ne sont pas identiques.");
    setErreur(null);
    setEnvoi(true);
    try {
      const corps: CorpsPremiereConnexion = { prenom: prenom.trim(), nom: nom.trim(), identifiant: identifiant.trim(), nouveau };
      majMoi(await post<Moi>("/api/compte/premiere-connexion", corps));
      onFini();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : "Une erreur est survenue. Réessayez dans un instant.");
      setEnvoi(false);
    }
  }

  const champSecret = (libelle: string, valeur: string, changer: (v: string) => void) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold text-encre">{libelle}</span>
      <input
        type={voir ? "text" : "password"}
        value={valeur}
        onChange={(e) => changer(e.target.value)}
        autoComplete="new-password"
        className="min-h-[52px] w-full rounded-xl border border-ligne bg-white px-4 py-3 text-[17px] text-encre outline-none transition-colors focus:border-orange focus:ring-2 focus:ring-orange/20"
      />
    </label>
  );

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <span className="etiquette">Votre compte</span>
        <h1 className="text-[32px] font-black leading-[1.02] tracking-serre sm:text-[38px]">Vérifiez votre nom</h1>
        <p className="text-base leading-relaxed text-texte-pale">Il s'affiche aux étudiants, sur l'écran des salles et dans l'emploi du temps.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Champ
          libelle="Prénom"
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          autoComplete="given-name"
          maxLength={80}
          aide={civilite(prenom) ? "Remplacez « M. » par votre prénom si vous le souhaitez." : undefined}
        />
        <Champ libelle="Nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="family-name" maxLength={80} />
      </div>

      <section className="flex flex-col gap-3 rounded-2xl bg-creme p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <AtSign className="h-5 w-5 text-orange-fonce" /> Votre identifiant de connexion
        </h2>
        <Champ
          libelle="E-mail ou numéro de téléphone"
          value={identifiant}
          onChange={(e) => setIdentifiant(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="e-mail ou +1 514 555 0123"
          aide="C'est ce que vous taperez pour vous connecter, avec votre mot de passe. Un numéro étranger s'écrit avec l'indicatif du pays (+1 pour le Canada, +49 pour l'Allemagne)."
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">Votre mot de passe</h2>
        {champSecret("Mot de passe", nouveau, setNouveau)}
        {champSecret("Confirmez-le", confirmation, setConfirmation)}
        <button type="button" onClick={() => setVoir((v) => !v)} className="flex min-h-[44px] items-center gap-2 self-start text-sm font-bold text-texte-doux hover:text-encre">
          {voir ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {voir ? "Cacher les mots de passe" : "Afficher les mots de passe"}
        </button>
        <ul className="flex flex-col gap-1.5" aria-label="Règles du mot de passe">
          {regles.map((r) => (
            <li key={r.texte} className={cn("flex items-center gap-2 text-[15px]", r.ok ? "text-succes" : "text-texte-gris")}>
              <span className={cn("grid h-5 w-5 place-items-center rounded-full", r.ok ? "bg-succes text-white" : "border border-ligne-forte")}>{r.ok && <Check className="h-3.5 w-3.5" />}</span>
              {r.texte}
            </li>
          ))}
        </ul>
      </section>

      {erreur && <Erreur message={erreur} />}
      <PiedAction>
        <Bouton type="submit" taille="lg" pleineLargeur chargement={envoi} className="min-h-[56px] text-[17px]">
          Activer mon compte
        </Bouton>
      </PiedAction>
    </form>
  );
}
