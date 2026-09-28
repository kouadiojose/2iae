// Téléphone et e-mail. L'e-mail reçoit les liens « code oublié » : le
// changer demande le code secret actuel (vérifié par le serveur).
import { useEffect, useState, type FormEvent } from "react";
import { Phone } from "lucide-react";
import { patch, ErreurApi } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champs";
import { Erreur } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import type { Moi } from "@shared/schema";
import { formaterTelephone, majMoi, tuOuVous } from "../../outils";
import { Section } from "./Section";

const chiffres = (s: string) => s.replace(/\D/g, "");

export function Coordonnees({ moi }: { moi: Moi }) {
  const t = tuOuVous(moi);
  const [telephone, setTelephone] = useState(formaterTelephone(moi.telephone));
  const [email, setEmail] = useState(moi.email ?? "");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  // Les valeurs enregistrées changent (autre onglet, enregistrement) : on repart d'elles.
  useEffect(() => setTelephone(formaterTelephone(moi.telephone)), [moi.telephone]);
  useEffect(() => setEmail(moi.email ?? ""), [moi.email]);

  const telChange = chiffres(telephone) !== chiffres(moi.telephone ?? "");
  const emailChange = email.trim().toLowerCase() !== (moi.email ?? "");
  const modifie = telChange || emailChange;

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    if (!modifie) return;
    if (emailChange && !code) return setErreur(t("Pour changer ton e-mail, tape ton code secret.", "Pour changer votre e-mail, tapez votre mot de passe."));
    setErreur(null);
    setEnvoi(true);
    try {
      const corps: Record<string, unknown> = {};
      if (telChange) corps.telephone = telephone.trim() || null;
      if (emailChange) {
        corps.email = email.trim() || null;
        corps.codeActuel = code;
      }
      majMoi(await patch<Moi>("/api/compte/profil", corps));
      setCode("");
      toast(t("Tes coordonnées sont enregistrées.", "Vos coordonnées sont enregistrées."));
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : "Une erreur est survenue. Réessaie dans un instant.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Section
      id="coordonnees"
      titre={t("Mes coordonnées", "Mes coordonnées")}
      icone={<Phone className="h-5 w-5" />}
      description={t("Pour que la vie scolaire puisse te joindre.", "Pour que l'équipe du campus puisse vous joindre.")}
    >
      <form onSubmit={enregistrer} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle="Téléphone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Ex. 07 07 12 34 56"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            aide={moi.role === "etudiant" ? "Tu pourras aussi te connecter avec ce numéro." : undefined}
            className="[&_input]:min-h-[52px] [&_input]:text-[16px]"
          />
          <Champ
            libelle="E-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder={moi.role === "etudiant" ? "Facultatif" : ""}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aide={moi.role === "etudiant" ? "Pour recevoir un lien si tu oublies ton code." : "Il sert à vous connecter."}
            className="[&_input]:min-h-[52px] [&_input]:text-[16px]"
          />
        </div>
        {emailChange && (
          <Champ
            libelle={t("Ton code secret, pour confirmer", "Votre mot de passe, pour confirmer")}
            type="password"
            inputMode={moi.role === "etudiant" ? "numeric" : "text"}
            autoComplete="current-password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="[&_input]:min-h-[52px] [&_input]:text-[16px] sm:max-w-xs"
          />
        )}
        {erreur && <Erreur message={erreur} />}
        {modifie && (
          <div className="flex flex-wrap gap-2">
            <Bouton type="submit" taille="lg" chargement={envoi} className="min-h-[52px]">
              Enregistrer
            </Bouton>
            <Bouton
              variante="fantome"
              taille="lg"
              className="min-h-[52px]"
              onClick={() => {
                setTelephone(formaterTelephone(moi.telephone));
                setEmail(moi.email ?? "");
                setCode("");
                setErreur(null);
              }}
            >
              Annuler
            </Bouton>
          </div>
        )}
      </form>
    </Section>
  );
}
