// /invitation/:jeton : le lien personnel qu'un formateur (ou un membre de
// l'équipe) reçoit de la direction, par WhatsApp ou par e-mail. Il y crée son
// compte (nom, e-mail, téléphone, mot de passe) ; sa session s'ouvre aussitôt
// et le guide pas à pas du campus part à son adresse e-mail. Le lien ne sert
// qu'une fois.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BookOpen, CalendarClock, CheckCircle2, Eye, EyeOff, FileDown, Link2Off, MailCheck, MailWarning } from "lucide-react";
import { post } from "@/lib/api";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champs";
import type { InfoInvitation, InvitationAcceptee } from "@shared/lancement";
import { CadrePublic } from "./composants/CadrePublic";
import { installerMoi } from "./outils";
import { MANUELS } from "@/modules/manuels/manuels";

/** « M. », « Mme » : prénom encore inconnu, la personne le tape. */
const prenomInconnu = (p: string) => /^(m|mme|mlle|dr|pr)\.?$/i.test(p.trim());

/** Le formateur reçoit son manuel illustré ; l'équipe, le guide de l'administration (pas de manuel pour elle). */
const guidePdf = (role: InfoInvitation["role"]) => (role === "formateur" ? MANUELS.formateurs.pdf : "/guides/guide-administration.pdf");

export default function PageInvitation({ jeton }: { jeton: string }) {
  const { data, error, isLoading } = useQuery<InfoInvitation>({ queryKey: [`/api/invitation/${encodeURIComponent(jeton)}`], retry: false, staleTime: Infinity });
  const [cree, setCree] = useState<InvitationAcceptee | null>(null);

  if (isLoading) return <CadrePublic>{<p className="text-texte-gris">Chargement…</p>}</CadrePublic>;
  if (cree && data) return <CompteCree resultat={cree} role={data.role} />;
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
      <Formulaire jeton={jeton} info={data} onCree={setCree} />
    </CadrePublic>
  );
}

function Formulaire({ jeton, info, onCree }: { jeton: string; info: InfoInvitation; onCree: (r: InvitationAcceptee) => void }) {
  const formateur = info.role === "formateur";
  const [f, setF] = useState({
    prenom: info.nomAFournir || prenomInconnu(info.prenom) ? "" : info.prenom,
    nom: info.nomAFournir ? "" : info.nom,
    email: info.email ?? "",
    telephone: info.telephone ?? "",
    titre: info.titre ?? "",
    motDePasse: "",
    confirmation: "",
  });
  const [voir, setVoir] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = (cle: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [cle]: e.target.value }));
  const differents = f.confirmation.length > 0 && f.confirmation !== f.motDePasse;
  const tropCourt = f.motDePasse.length > 0 && f.motDePasse.length < info.longueurMinimale;
  const appel = info.nomAFournir ? null : prenomInconnu(info.prenom) ? `${info.prenom} ${info.nom}` : info.prenom;

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (f.motDePasse !== f.confirmation) return setErreur("Les deux mots de passe ne sont pas identiques.");
    if (f.motDePasse.length < info.longueurMinimale) return setErreur(`Votre mot de passe doit faire au moins ${info.longueurMinimale} caractères.`);
    setEnvoi(true);
    try {
      const r = await post<InvitationAcceptee>(`/api/invitation/${encodeURIComponent(jeton)}`, {
        prenom: f.prenom,
        nom: f.nom,
        email: f.email,
        telephone: f.telephone.trim() || undefined,
        titre: formateur ? f.titre.trim() || undefined : undefined,
        motDePasse: f.motDePasse,
      });
      onCree(r);
    } catch (x) {
      setErreur((x as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-orange-fonce">{formateur ? "Invitation · Formateur" : "Invitation · Équipe"}</span>
        <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">{appel ? `Bienvenue, ${appel}.` : "Bienvenue."}</h1>
        <p className="text-[15px] leading-relaxed text-texte-pale">
          {formateur
            ? "Le Groupe Écoles 2IAE International vous ouvre son campus numérique : c'est de là que vous donnerez vos cours en direct aux cinq campus. "
            : "Le Groupe Écoles 2IAE International vous ouvre son campus numérique. "}
          Créez votre compte en une minute{info.emailDisponible ? " : le guide pas à pas part aussitôt à votre adresse e-mail." : "."}
        </p>
      </div>
      {info.cours.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-creme px-4 py-3 text-[15px]">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-orange-fonce" />
          <span>
            {info.cours.length === 1 ? "Votre cours : " : "Vos cours : "}
            <strong>{info.cours.map((c) => `« ${c} »`).join(", ")}</strong>
          </span>
        </p>
      )}
      {info.premierCours && (
        <p className="flex items-start gap-2 rounded-xl bg-creme px-4 py-3 text-[15px]">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-orange-fonce" />
          <span>
            Votre prochain cours : <strong>{info.premierCours}</strong>
          </span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Champ libelle="Prénom" value={f.prenom} onChange={maj("prenom")} autoComplete="given-name" required />
        <Champ libelle="Nom" value={f.nom} onChange={maj("nom")} autoComplete="family-name" required />
      </div>
      <Champ
        libelle="Adresse e-mail"
        type="email"
        inputMode="email"
        value={f.email}
        onChange={maj("email")}
        autoComplete="email"
        placeholder="prenom.nom@exemple.com"
        aide={info.emailDisponible ? "Votre identifiant de connexion. Le guide du campus y sera envoyé." : "Votre identifiant de connexion."}
        required
      />
      <Champ
        libelle="Téléphone WhatsApp (facultatif)"
        type="tel"
        inputMode="tel"
        value={f.telephone}
        onChange={maj("telephone")}
        autoComplete="tel"
        placeholder="+1 514 555 0123"
        aide="Avec l'indicatif du pays. Pour vous joindre vite en cas d'imprévu le jour d'un cours."
      />
      {formateur && (
        <Champ
          libelle="Votre titre (facultatif)"
          value={f.titre}
          onChange={maj("titre")}
          maxLength={120}
          placeholder="Ex. : Consultant en intelligence artificielle"
          aide="Affiché sous votre nom sur le campus."
        />
      )}
      <div className="relative">
        <Champ
          libelle="Mot de passe"
          type={voir ? "text" : "password"}
          value={f.motDePasse}
          onChange={maj("motDePasse")}
          autoComplete="new-password"
          aide={`${info.longueurMinimale} caractères au moins. Une petite phrase se retient bien.`}
          erreur={tropCourt ? `Encore ${info.longueurMinimale - f.motDePasse.length} caractère${info.longueurMinimale - f.motDePasse.length > 1 ? "s" : ""} au moins.` : undefined}
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
        Créer mon compte
      </Bouton>
      <p className="text-center text-[13px] text-texte-gris">
        Ce lien est personnel et ne sert qu'une fois. Vous avez déjà un compte{"\u00a0"}?{" "}
        <a href="/connexion" className="font-bold text-orange-fonce">
          Connectez-vous
        </a>
      </p>
    </form>
  );
}

function CompteCree({ resultat, role }: { resultat: InvitationAcceptee; role: InfoInvitation["role"] }) {
  const [, naviguer] = useLocation();
  const { moi, guide } = resultat;
  const appel = prenomInconnu(moi.prenom) ? `${moi.prenom} ${moi.nom}` : moi.prenom;
  const entrer = () => {
    installerMoi(moi, true);
    // Après la courte visite de bienvenue : directement dans sa salle (prochaine séance, sinon son cours).
    naviguer(resultat.destination ? `/bienvenue?retour=${encodeURIComponent(resultat.destination)}` : "/bienvenue", { replace: true });
  };
  return (
    <CadrePublic>
      <div className="flex flex-col gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#E4F5EA] text-[#1F7A45]">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">Votre compte est prêt, {appel}.</h1>
        {guide.envoye ? (
          <p className="flex items-start gap-3 rounded-xl bg-creme px-4 py-3 text-[15px] leading-relaxed">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" />
            <span>
              Le guide pas à pas vient de partir à <strong className="break-all text-encre">{guide.adresse}</strong>. Gardez-le : il vous servira d'aide-mémoire. Pas reçu d'ici quelques minutes ? Regardez dans les
              courriers indésirables.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-3 rounded-xl bg-alerte-clair px-4 py-3 text-[15px] leading-relaxed text-alerte">
            <MailWarning className="mt-0.5 h-5 w-5 shrink-0" />
            <span>Le guide n'a pas pu partir par e-mail pour le moment. Téléchargez-le ci-dessous : c'est le même, en PDF.</span>
          </p>
        )}
        <div className="rounded-xl border border-ligne px-4 py-3 text-[15px] leading-relaxed">
          <div className="etiquette">Pour vous reconnecter</div>
          <p className="mt-1">
            Sur <strong>campus.2iae.com/connexion</strong>, avec <strong className="break-all">{moi.email}</strong> et le mot de passe que vous venez de choisir.
          </p>
        </div>
        <Bouton taille="lg" pleineLargeur onClick={entrer} className="mt-1 min-h-[56px] text-[17px]">
          {resultat.destination ? "Entrer dans mon cours" : "Entrer dans mon campus"}
        </Bouton>
        <a
          href={guidePdf(role)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[48px] items-center justify-center gap-2 text-[15px] font-bold text-orange-fonce hover:text-encre"
        >
          <FileDown className="h-5 w-5" />
          Télécharger le guide (PDF)
        </a>
      </div>
    </CadrePublic>
  );
}
