// /inscription-formateur/:jeton : le lien personnel que la direction envoie à
// un formateur. Il y entre son nom, son e-mail, son téléphone, son titre, la
// ville d'où il enseigne et son mot de passe ; son compte est aussitôt prêt,
// il est connecté, et son guide pas à pas part par e-mail.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BookOpenCheck, CheckCircle2, Eye, EyeOff, Link2Off, MailCheck } from "lucide-react";
import { post } from "@/lib/api";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champs";
import type { InfoLienFormateurDto, InscriptionFormateurFaite } from "@shared/schema";
import { CadrePublic } from "./composants/CadrePublic";
import { destinationApresConnexion, installerMoi } from "./outils";

export default function PageInscriptionFormateur({ jeton }: { jeton: string }) {
  const { data, error, isLoading } = useQuery<InfoLienFormateurDto>({ queryKey: [`/api/inscription-formateur/${encodeURIComponent(jeton)}`], retry: false });
  const [faite, setFaite] = useState<InscriptionFormateurFaite | null>(null);

  if (faite) return <Bienvenue r={faite} />;
  if (isLoading) return <CadrePublic>{<p className="text-texte-gris">Chargement…</p>}</CadrePublic>;
  if (error || !data)
    return (
      <CadrePublic>
        <div className="flex flex-col gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-clair text-orange-fonce">
            <Link2Off className="h-7 w-7" />
          </span>
          <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">Ce lien ne marche plus.</h1>
          <p className="text-base leading-relaxed text-texte-pale">{(error as Error | null)?.message ?? "Demandez un nouveau lien à la direction."}</p>
          <LienBouton href="/connexion" taille="lg" className="mt-2 min-h-[56px] w-full text-[17px]">
            J'ai déjà un compte : me connecter
          </LienBouton>
        </div>
      </CadrePublic>
    );
  return (
    <CadrePublic>
      <Formulaire jeton={jeton} info={data} onFaite={setFaite} />
    </CadrePublic>
  );
}

function Bienvenue({ r }: { r: InscriptionFormateurFaite }) {
  const [, naviguer] = useLocation();
  return (
    <CadrePublic>
      <div className="flex flex-col gap-4" data-testid="inscription-formateur-faite">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#E4F5EA] text-[#1F7A45]">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">Votre compte est prêt, {r.prenom}.</h1>
        {r.guideEnvoye ? (
          <p className="flex gap-3 rounded-xl bg-creme p-4 text-[15px] leading-relaxed text-texte-doux">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" />
            <span>
              Votre guide pas à pas vient de partir à <strong className="text-encre">{r.email}</strong> : comment vous connecter, préparer vos séances, déposer vos documents,
              faire cours en direct, donner et corriger les devoirs. Gardez-le.
            </span>
          </p>
        ) : (
          <p className="text-base leading-relaxed text-texte-pale">Gardez le manuel illustré du formateur sous la main : tout y est, pas à pas, en images.</p>
        )}
        <p className="text-[15px] leading-relaxed text-texte-pale">
          Pour vous reconnecter : <strong className="text-encre">{r.email}</strong> et le mot de passe que vous venez de choisir.
        </p>
        <Bouton taille="lg" pleineLargeur className="mt-2 min-h-[56px] text-[17px]" onClick={() => naviguer(destinationApresConnexion(r.moi, "/enseigner"), { replace: true })}>
          Entrer dans mon espace formateur
        </Bouton>
        <a
          href={r.guideUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-ligne px-4 text-[15px] font-bold text-encre no-underline hover:bg-creme"
        >
          <BookOpenCheck className="h-5 w-5 text-orange-fonce" /> Le manuel illustré du formateur (PDF)
        </a>
      </div>
    </CadrePublic>
  );
}

function Formulaire({ jeton, info, onFaite }: { jeton: string; info: InfoLienFormateurDto; onFaite: (r: InscriptionFormateurFaite) => void }) {
  const [f, setF] = useState({
    prenom: info.prenom,
    nom: info.nom,
    email: info.email ?? "",
    telephone: info.telephone ?? "",
    titre: info.titre ?? "",
    localisation: info.localisation ?? "",
    motDePasse: "",
    confirmation: "",
  });
  const [voir, setVoir] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = (cle: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [cle]: e.target.value }));
  const differents = f.confirmation.length > 0 && f.confirmation !== f.motDePasse;
  const tropCourt = f.motDePasse.length > 0 && f.motDePasse.length < info.minimumMotDePasse;

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (f.motDePasse !== f.confirmation) return setErreur("Les deux mots de passe ne sont pas identiques.");
    setEnvoi(true);
    try {
      const r = await post<InscriptionFormateurFaite>(`/api/inscription-formateur/${encodeURIComponent(jeton)}`, {
        prenom: f.prenom,
        nom: f.nom,
        email: f.email,
        telephone: f.telephone || undefined,
        titre: f.titre || undefined,
        localisation: f.localisation || undefined,
        motDePasse: f.motDePasse,
      });
      installerMoi(r.moi, true);
      onFaite(r);
    } catch (x) {
      setErreur((x as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-4" data-testid="form-inscription-formateur">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-orange-fonce">Formateur · Campus numérique</span>
        <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">
          {info.prenom ? `Bienvenue, ${info.prenom}.` : "Bienvenue."}
          <span className="block">Créez votre compte.</span>
        </h1>
        <p className="text-[15px] leading-relaxed text-texte-pale">
          C'est depuis le campus numérique que vous donnerez vos cours en direct, en même temps aux salles de conférence de nos campus et aux étudiants en ligne. Deux minutes
          suffisent : dès que c'est fait, vous êtes connecté et votre guide pas à pas part par e-mail.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Champ libelle="Prénom" value={f.prenom} onChange={maj("prenom")} autoComplete="given-name" required />
        <Champ libelle="Nom" value={f.nom} onChange={maj("nom")} autoComplete="family-name" required />
      </div>
      <Champ
        libelle="Adresse e-mail"
        type="email"
        value={f.email}
        onChange={maj("email")}
        autoComplete="email"
        aide="Elle vous servira d'identifiant, et c'est là que partira votre guide."
        required
      />
      <Champ
        libelle="Téléphone (facultatif)"
        type="tel"
        value={f.telephone}
        onChange={maj("telephone")}
        autoComplete="tel"
        placeholder="+1 514 555 0123"
        aide="Avec l'indicatif du pays, pour que la direction puisse vous joindre sur WhatsApp."
      />
      <Champ
        libelle="Votre titre (facultatif)"
        value={f.titre}
        onChange={maj("titre")}
        autoComplete="organization-title"
        placeholder="Ex. : Consultant en marketing digital"
        aide="Tel que les étudiants le liront sous votre nom."
      />
      <Champ
        libelle="D'où enseignez-vous ? (facultatif)"
        value={f.localisation}
        onChange={maj("localisation")}
        placeholder="Ex. : Montréal, Canada"
        aide="Les salles liront « depuis Montréal » sous votre nom."
      />
      <div className="relative">
        <Champ
          libelle="Mot de passe"
          type={voir ? "text" : "password"}
          value={f.motDePasse}
          onChange={maj("motDePasse")}
          autoComplete="new-password"
          aide={`${info.minimumMotDePasse} caractères au moins. Une petite phrase se retient bien.`}
          erreur={tropCourt ? `Encore ${info.minimumMotDePasse - f.motDePasse.length} caractère${info.minimumMotDePasse - f.motDePasse.length > 1 ? "s" : ""} au moins.` : undefined}
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
      <Bouton type="submit" taille="lg" pleineLargeur chargement={envoi} disabled={differents || tropCourt}>
        Créer mon compte formateur
      </Bouton>
      <p className="text-center text-[13px] text-texte-gris">
        Ce lien est personnel et ne sert qu'une fois.{" "}
        <a href="/connexion" className="font-bold text-orange-fonce">
          J'ai déjà un compte
        </a>
      </p>
    </form>
  );
}
