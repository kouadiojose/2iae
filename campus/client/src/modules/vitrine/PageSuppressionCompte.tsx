// /suppression-compte : comment demander la suppression de son compte du
// campus numérique (site et application Android « Campus numérique 2IAE »),
// ce qui est effacé et ce que l'établissement garde. Page exigée par Google
// Play pour les applications avec des comptes. Le contact vient de « Site
// public » (confidentialité), comme sur /confidentialite.
import { Link } from "wouter";
import { Mail } from "lucide-react";
import { EnTetePagePublique } from "./composants";
import { useSitePublicOuSecours } from "./donnees";
import { MiseEnPagePublique } from "./MiseEnPagePublique";
import { useTitreDocument } from "./outils";

const EFFACE = [
  "Le compte : identifiant, mot de passe, téléphone, e-mail et photo",
  "Les conversations avec l'assistant IA",
  "Les abonnements aux rappels sur le téléphone",
  "Les connexions ouvertes sur vos appareils",
];

const GARDE = [
  "Le dossier scolaire (présences, devoirs rendus, notes, échanges avec les formateurs) : l'établissement doit le garder pendant la durée d'archivage fixée par la direction du Groupe 2IAE, communiquée sur simple demande.",
  "Les replays des cours, qui appartiennent au cours et à la classe.",
];

export default function PageSuppressionCompte() {
  useTitreDocument("Supprimer mon compte · Campus numérique 2IAE");
  const conf = useSitePublicOuSecours().confidentialite;
  const contactEstEmail = /@/.test(conf.contact);
  const mailto = `mailto:${conf.contact}?subject=${encodeURIComponent("Suppression de mon compte")}&body=${encodeURIComponent(
    "Bonjour,\n\nJe demande la suppression de mon compte du campus numérique 2IAE.\n\nNom et prénom :\nMatricule (ou e-mail du compte) :\nCampus :\n\nMerci.",
  )}`;

  return (
    <MiseEnPagePublique>
      <EnTetePagePublique
        fil={[{ href: "/confidentialite", libelle: "Confidentialité" }, { libelle: "Supprimer mon compte" }]}
        etiquette="Campus numérique 2IAE"
        titre="Supprimer mon compte."
        texte="Vous pouvez demander à tout moment la suppression de votre compte du campus numérique 2IAE, sur campus.2iae.com comme dans l'application Android « Campus numérique 2IAE »."
      />

      <section className="conteneur grid gap-10 pb-16 sm:pb-24 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <h2 className="text-[28px] font-black leading-tight tracking-serre">Comment faire</h2>
          <ol className="flex flex-col gap-4">
            {[
              <>
                Écrivez à <strong className="text-encre">{conf.contact}</strong> avec l'objet « Suppression de mon compte », depuis l'e-mail de votre compte ou en
                indiquant votre nom, votre matricule et votre campus. Vous pouvez aussi vous adresser à la vie scolaire de votre campus.
              </>,
              <>La vie scolaire vérifie qu'il s'agit bien de vous, au besoin en vous rappelant au numéro de votre dossier.</>,
              <>Le compte est supprimé dans les 30 jours. Vous recevez une confirmation par e-mail ou par téléphone.</>,
            ].map((texte, i) => (
              <li key={i} className="flex items-start gap-4 text-[16.5px] leading-relaxed text-texte-doux">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange text-base font-black text-encre">{i + 1}</span>
                <span className="pt-1">{texte}</span>
              </li>
            ))}
          </ol>
          {contactEstEmail && (
            <a
              href={mailto}
              className="inline-flex min-h-[56px] items-center justify-center gap-2 self-start rounded-[14px] bg-orange px-6 text-base font-bold text-encre no-underline hover:bg-encre hover:text-white"
            >
              <Mail className="h-5 w-5" aria-hidden /> Demander la suppression par e-mail
            </a>
          )}
          <p className="text-[15px] leading-relaxed text-texte-pale">
            Pour seulement corriger une information ou obtenir une copie de vos données, écrivez à la même adresse. Voir aussi la page{" "}
            <Link href="/confidentialite">confidentialité</Link>.
          </p>
        </div>
        <div className="flex flex-col gap-5">
          <div className="rounded-3xl bg-creme p-5 sm:p-6">
            <h3 className="mb-3 text-lg font-extrabold">Ce qui est effacé</h3>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-texte-doux">
              {EFFACE.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-ligne p-5 sm:p-6">
            <h3 className="mb-3 text-lg font-extrabold">Ce que l'établissement garde</h3>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-texte-doux">
              {GARDE.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </MiseEnPagePublique>
  );
}
