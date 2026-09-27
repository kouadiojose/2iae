// /rejoindre/:jeton : le lien que la direction partage à l'équipe
// administrative. La personne fait sa demande (nom, e-mail, fonction, campus,
// mot de passe) ; la direction la valide, puis elle se connecte avec son
// e-mail et ce mot de passe.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Eye, EyeOff, Link2Off } from "lucide-react";
import { post } from "@/lib/api";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Champ, Selection } from "@/components/ui/champs";
import type { InfoLienInscriptionDto } from "@shared/schema";
import { CadrePublic } from "./composants/CadrePublic";

export default function PageRejoindre({ jeton }: { jeton: string }) {
  const { data, error, isLoading } = useQuery<InfoLienInscriptionDto>({ queryKey: [`/api/rejoindre/${encodeURIComponent(jeton)}`], retry: false });
  const [envoyee, setEnvoyee] = useState<{ prenom: string; email: string } | null>(null);

  if (isLoading) return <CadrePublic>{<p className="text-texte-gris">Chargement…</p>}</CadrePublic>;
  if (error || !data)
    return (
      <CadrePublic>
        <div className="flex flex-col gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-clair text-orange-fonce">
            <Link2Off className="h-7 w-7" />
          </span>
          <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">Ce lien ne marche plus.</h1>
          <p className="text-base leading-relaxed text-texte-pale">{(error as Error | null)?.message ?? "Demandez le nouveau lien à la direction."}</p>
          <LienBouton href="/connexion" taille="lg" className="mt-2 min-h-[56px] w-full text-[17px]">
            J'ai déjà un compte : me connecter
          </LienBouton>
        </div>
      </CadrePublic>
    );
  if (envoyee)
    return (
      <CadrePublic>
        <div className="flex flex-col gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#E4F5EA] text-[#1F7A45]">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">Demande envoyée, {envoyee.prenom}.</h1>
          <p className="text-base leading-relaxed text-texte-pale">
            La direction va valider votre accès. Vous recevrez un e-mail à <strong className="text-encre">{envoyee.email}</strong>. Ensuite, connectez-vous avec cette adresse et le mot de passe que vous
            venez de choisir.
          </p>
          <LienBouton href="/connexion" variante="contour" taille="lg" className="mt-2 min-h-[56px] w-full text-[17px]">
            Aller à la page de connexion
          </LienBouton>
        </div>
      </CadrePublic>
    );
  return (
    <CadrePublic>
      <Formulaire jeton={jeton} info={data} onEnvoyee={setEnvoyee} />
    </CadrePublic>
  );
}

function Formulaire({ jeton, info, onEnvoyee }: { jeton: string; info: InfoLienInscriptionDto; onEnvoyee: (x: { prenom: string; email: string }) => void }) {
  const [f, setF] = useState({ prenom: "", nom: "", email: "", telephone: "", fonction: "", site: "", motDePasse: "", confirmation: "" });
  const [voir, setVoir] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = (cle: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [cle]: e.target.value }));
  const differents = f.confirmation.length > 0 && f.confirmation !== f.motDePasse;

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (f.motDePasse !== f.confirmation) return setErreur("Les deux mots de passe ne sont pas identiques.");
    setEnvoi(true);
    try {
      await post(`/api/rejoindre/${encodeURIComponent(jeton)}`, {
        prenom: f.prenom,
        nom: f.nom,
        email: f.email,
        telephone: f.telephone || undefined,
        fonction: f.fonction,
        siteId: f.site ? Number(f.site) : null,
        motDePasse: f.motDePasse,
      });
      onEnvoyee({ prenom: f.prenom.trim(), email: f.email.trim().toLowerCase() });
    } catch (x) {
      setErreur((x as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-orange-fonce">Équipe administrative</span>
        <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">Rejoindre le campus numérique</h1>
        <p className="text-[15px] leading-relaxed text-texte-pale">
          Créez votre accès : vous suivrez les cours en direct, les présences et les statistiques des campus. La direction valide chaque demande.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Champ libelle="Prénom" value={f.prenom} onChange={maj("prenom")} autoComplete="given-name" required />
        <Champ libelle="Nom" value={f.nom} onChange={maj("nom")} autoComplete="family-name" required />
      </div>
      <Champ libelle="Adresse e-mail" type="email" value={f.email} onChange={maj("email")} autoComplete="email" aide="Elle vous servira d'identifiant." required />
      <Champ libelle="Téléphone (facultatif)" type="tel" value={f.telephone} onChange={maj("telephone")} autoComplete="tel" placeholder="07 07 12 34 56" />
      <Champ libelle="Fonction" value={f.fonction} onChange={maj("fonction")} placeholder="Ex. : comptable, directeur des études" required />
      <Selection libelle="Campus" value={f.site} onChange={maj("site")}>
        <option value="">Siège, ou tous les campus</option>
        {info.sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nomCourt}
          </option>
        ))}
      </Selection>
      <div className="relative">
        <Champ
          libelle="Mot de passe"
          type={voir ? "text" : "password"}
          value={f.motDePasse}
          onChange={maj("motDePasse")}
          autoComplete="new-password"
          aide="10 caractères au moins. Une petite phrase se retient bien."
          required
        />
        <button
          type="button"
          onClick={() => setVoir((v) => !v)}
          className="absolute right-2 top-[34px] grid h-10 w-10 place-items-center rounded-lg text-texte-gris hover:text-encre"
          aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {voir ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      <Champ
        libelle="Mot de passe, encore une fois"
        type={voir ? "text" : "password"}
        value={f.confirmation}
        onChange={maj("confirmation")}
        autoComplete="new-password"
        erreur={differents ? "Les deux mots de passe ne sont pas identiques." : undefined}
        required
      />
      {erreur && (
        <p className="rounded-xl bg-[#FDECEA] px-4 py-3 text-[15px] font-semibold text-danger" role="alert">
          {erreur}
        </p>
      )}
      <Bouton type="submit" taille="lg" pleineLargeur chargement={envoi} disabled={differents}>
        Envoyer ma demande
      </Bouton>
      <p className="text-center text-[13px] text-texte-gris">
        Vous avez déjà un compte ?{" "}
        <a href="/connexion" className="font-bold text-orange-fonce">
          Connectez-vous
        </a>
      </p>
    </form>
  );
}
