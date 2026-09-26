// /confidentialite : ce que le campus numérique enregistre et pourquoi, qui
// y a accès, les prestataires techniques, la durée de conservation, les
// droits (loi ivoirienne n° 2013-450 relative à la protection des données à
// caractère personnel, ARTCI) et le contact. Le responsable, le contact et
// la durée de conservation se modifient dans « Site public ».
import type { ReactNode } from "react";
import { Link } from "wouter";
import { Mail } from "lucide-react";
import { EnTetePagePublique, Paragraphes } from "./composants";
import { useSitePublicOuSecours } from "./donnees";
import { MiseEnPagePublique } from "./MiseEnPagePublique";
import { useTitreDocument } from "./outils";

const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function Bloc({ id, titre, children }: { id: string; titre: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-4 border-t border-ligne pt-8">
      <h2 className="text-[26px] font-black leading-tight tracking-serre sm:text-[32px]">{titre}</h2>
      <div className="flex flex-col gap-4 text-[16.5px] leading-[1.65] text-texte-doux">{children}</div>
    </section>
  );
}

function Liste({ elements }: { elements: { titre: string; texte: string }[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {elements.map((e) => (
        <li key={e.titre} className="rounded-2xl bg-creme p-4 sm:p-5">
          <strong className="block text-encre">{e.titre}</strong>
          <span>{e.texte}</span>
        </li>
      ))}
    </ul>
  );
}

const SOMMAIRE = [
  { id: "responsable", titre: "Qui est responsable" },
  { id: "donnees", titre: "Ce que le campus enregistre" },
  { id: "pourquoi", titre: "Pourquoi" },
  { id: "acces", titre: "Qui y a accès" },
  { id: "prestataires", titre: "Les prestataires techniques" },
  { id: "conservation", titre: "Combien de temps" },
  { id: "droits", titre: "Vos droits" },
  { id: "cookies", titre: "Cookies et téléphone" },
];

export default function PageConfidentialite() {
  useTitreDocument("Confidentialité · Campus numérique 2IAE");
  const site = useSitePublicOuSecours();
  const conf = site.confidentialite;
  const miseAJour = /^\d{4}-\d{2}-\d{2}$/.test(conf.miseAJour) ? fmtDate.format(new Date(`${conf.miseAJour}T12:00:00Z`)) : conf.miseAJour;
  const contactEstEmail = /@/.test(conf.contact);

  return (
    <MiseEnPagePublique>
      <EnTetePagePublique
        fil={[{ libelle: "Confidentialité" }]}
        etiquette={`Mise à jour le ${miseAJour}`}
        titre="Vos données au campus numérique."
        texte="Ce que le campus enregistre, pourquoi, qui peut le voir, combien de temps, et comment exercer vos droits. En clair."
      />

      <div className="conteneur grid gap-10 pb-16 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="Sommaire de la page" className="lg:sticky lg:top-24 lg:self-start">
          <ol className="flex flex-col gap-0.5 rounded-3xl bg-creme p-3">
            {SOMMAIRE.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-texte-doux no-underline hover:bg-white hover:text-encre">
                  <span className="font-mono text-xs text-orange-fonce">{String(i + 1).padStart(2, "0")}</span>
                  {s.titre}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex max-w-[760px] flex-col gap-10">
          <Bloc id="responsable" titre="Qui est responsable">
            <p>
              Le campus numérique appartient au <strong className="text-encre">{conf.responsable}</strong>. Pour toute question sur vos données, écrivez à{" "}
              {contactEstEmail ? <a href={`mailto:${conf.contact}`}>{conf.contact}</a> : conf.contact}.
            </p>
          </Bloc>

          <Bloc id="donnees" titre="Ce que le campus enregistre">
            <Liste
              elements={[
                { titre: "Le compte", texte: "Nom, prénom, matricule, campus et classe ; le téléphone et l'e-mail s'ils sont renseignés ; une photo seulement si vous en ajoutez une." },
                {
                  titre: "La scolarité",
                  texte: "La présence aux cours en direct (arrivée, durée, façon de suivre), l'émargement en salle, les devoirs rendus, les notes et les commentaires des formateurs.",
                },
                { titre: "Les échanges", texte: "Les messages et notes vocales avec les formateurs et la vie scolaire, les questions posées pendant les cours, les conversations avec l'assistant IA." },
                {
                  titre: "Les cours enregistrés",
                  texte: "Le replay d'un cours garde la voix et l'image du formateur, et la voix des étudiants qui prennent la parole. L'enregistrement est signalé en salle.",
                },
                { titre: "La sécurité", texte: "Un journal des connexions (date, adresse IP) protège les comptes contre les tentatives répétées." },
              ]}
            />
          </Bloc>

          <Bloc id="pourquoi" titre="Pourquoi">
            <p>
              Pour faire cours et suivre la scolarité : ouvrir les cours à chaque étudiant, compter les présences, recevoir et corriger les devoirs, publier les
              notes, remettre un reçu à chaque dépôt, et repérer à temps un étudiant qui décroche pour l'aider.
            </p>
            <p>Les données ne servent jamais à la publicité et ne sont jamais vendues.</p>
          </Bloc>

          <Bloc id="acces" titre="Qui y a accès">
            <Liste
              elements={[
                { titre: "L'étudiant", texte: "Il voit tout ce qui le concerne : ses présences, ses devoirs, ses notes, ses messages." },
                { titre: "Ses formateurs", texte: "Pour leurs cours seulement : les copies, les notes et les présences." },
                { titre: "La vie scolaire et la direction", texte: "La vie scolaire d'un campus voit les étudiants de son campus ; la direction voit tout le groupe." },
                { titre: "Les parents", texte: "Par le lien du relevé que la vie scolaire leur transmet : présence et moyennes. Ce lien peut être retiré à tout moment." },
                {
                  titre: "Le site public",
                  texte: "Il ne montre jamais le nom d'un étudiant, seulement des chiffres d'ensemble. Un formateur n'y est présenté qu'avec son accord.",
                },
              ]}
            />
          </Bloc>

          <Bloc id="prestataires" titre="Les prestataires techniques">
            <p>Le campus s'appuie sur des services spécialisés, situés hors de Côte d'Ivoire, qui traitent les données pour son compte seulement :</p>
            <Liste
              elements={[
                { titre: "Hébergement", texte: "Railway : le serveur, la base de données et les fichiers déposés." },
                { titre: "Cours en direct", texte: "Daily : la visioconférence et l'enregistrement des cours." },
                { titre: "Assistant IA", texte: "Anthropic (Claude) : il reçoit les questions et les leçons du cours, jamais le nom de l'étudiant." },
                { titre: "E-mails", texte: "Resend : l'envoi des liens de connexion et des invitations." },
              ]}
            />
          </Bloc>

          <Bloc id="conservation" titre="Combien de temps">
            <Paragraphes texte={conf.conservation} className="text-[16.5px]" />
          </Bloc>

          <Bloc id="droits" titre="Vos droits">
            <p>
              La loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel vous donne le droit d'être informé,
              d'accéder à vos données, de les faire rectifier, de vous opposer à leur traitement et d'en demander la suppression.
            </p>
            <p>
              Pour exercer ces droits, écrivez à {contactEstEmail ? <a href={`mailto:${conf.contact}`}>{conf.contact}</a> : conf.contact} ou adressez-vous à la
              vie scolaire de votre campus. En cas de désaccord, vous pouvez saisir l'Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire
              (ARTCI).
            </p>
            {contactEstEmail && (
              <a
                href={`mailto:${conf.contact}?subject=${encodeURIComponent("Mes données au campus numérique")}`}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 self-start rounded-[14px] bg-orange px-6 text-base font-bold text-encre no-underline hover:bg-encre hover:text-white"
              >
                <Mail className="h-5 w-5" /> Écrire au sujet de mes données
              </a>
            )}
          </Bloc>

          <Bloc id="cookies" titre="Cookies et téléphone">
            <p>
              Un seul cookie : celui qui vous garde connecté. Aucun cookie publicitaire, aucune mesure d'audience. Sur un téléphone partagé, cochez « Téléphone
              partagé » à la connexion : le campus vous déconnecte à la fermeture du navigateur.
            </p>
            <p>
              Pour marcher sans réseau, le campus garde sur votre téléphone les pages consultées et les devoirs en attente d'envoi. Les rappels ne sont activés
              qu'avec votre accord, et ne montrent jamais une note.
            </p>
          </Bloc>

          <p className="border-t border-ligne pt-6 text-[15px] text-texte-pale">
            Voir aussi les <Link href="/questions">questions fréquentes</Link> et la page <Link href="/contact">contact</Link>.
          </p>
        </div>
      </div>
    </MiseEnPagePublique>
  );
}
