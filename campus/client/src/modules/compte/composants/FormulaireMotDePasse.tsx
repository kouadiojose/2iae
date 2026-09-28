// Mot de passe du personnel (10 caractères au moins) et des écrans de salle.
// Les étudiants, eux, utilisent le pavé à chiffres (PaveCode).
import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { ErreurApi } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Erreur } from "@/components/ui/divers";
import { cn } from "@/lib/utils";

type Props = {
  minimum: number;
  /** Demander le mot de passe actuel (changement depuis le profil). */
  actuelRequis?: boolean;
  libelleBouton: string;
  onValider: (nouveau: string, actuel?: string) => Promise<void>;
  /** Enveloppe du bouton (ex. barre collée en bas de l'écran sur téléphone). */
  enveloppeBouton?: (bouton: ReactNode) => ReactNode;
};

export function FormulaireMotDePasse({ minimum, actuelRequis, libelleBouton, onValider, enveloppeBouton }: Props) {
  const [actuel, setActuel] = useState("");
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
    if (actuelRequis && !actuel) return setErreur("Tapez d'abord votre mot de passe actuel.");
    if (nouveau.length < minimum) return setErreur(`Votre mot de passe doit faire au moins ${minimum} caractères.`);
    if (nouveau !== confirmation) return setErreur("Les deux saisies ne sont pas identiques.");
    setErreur(null);
    setEnvoi(true);
    try {
      await onValider(nouveau, actuelRequis ? actuel : undefined);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : "Une erreur est survenue. Réessayez dans un instant.");
    } finally {
      setEnvoi(false);
    }
  }

  const bouton = (
    <Bouton type="submit" taille="lg" pleineLargeur chargement={envoi} className="min-h-[56px]">
      {libelleBouton}
    </Bouton>
  );

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-4" noValidate>
      {actuelRequis && <ChampSecret libelle="Mot de passe actuel" valeur={actuel} onChange={setActuel} voir={voir} autoComplete="current-password" />}
      <ChampSecret libelle="Nouveau mot de passe" valeur={nouveau} onChange={setNouveau} voir={voir} autoComplete="new-password" />
      <ChampSecret libelle="Confirmez-le" valeur={confirmation} onChange={setConfirmation} voir={voir} autoComplete="new-password" />
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
      {erreur && <Erreur message={erreur} />}
      {enveloppeBouton ? enveloppeBouton(bouton) : bouton}
    </form>
  );
}

function ChampSecret({ libelle, valeur, onChange, voir, autoComplete }: { libelle: string; valeur: string; onChange: (v: string) => void; voir: boolean; autoComplete: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold text-encre">{libelle}</span>
      <input
        type={voir ? "text" : "password"}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="min-h-[52px] w-full rounded-xl border border-ligne bg-white px-4 py-3 text-[17px] text-encre outline-none transition-colors focus:border-orange focus:ring-2 focus:ring-orange/20"
      />
    </label>
  );
}
