// Notification par e-mail des messages de contact et préinscriptions.
//
// Chaque envoi part vers CONTACT_EMAIL (par défaut ptchimou92@gmail.com).
// Le transport SMTP se configure par variables d'environnement :
//
//   SMTP_HOST  ex. smtp.gmail.com  (ou smtp-relay.brevo.com…)
//   SMTP_PORT  ex. 465 (SSL) ou 587 (STARTTLS)
//   SMTP_USER  identifiant du compte d'envoi
//   SMTP_PASS  mot de passe (pour Gmail : un « mot de passe d'application »)
//   SMTP_FROM  optionnel, adresse d'expéditeur affichée (défaut : SMTP_USER)
//
// Sans configuration, l'envoi est simplement ignoré (les messages restent
// dans l'administration) — le formulaire ne doit jamais échouer parce que
// l'e-mail est indisponible.
import nodemailer from "nodemailer";
import type { Contact } from "@shared/schema";

const DESTINATAIRE = process.env.CONTACT_EMAIL || "ptchimou92@gmail.com";

function transport() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export function emailConfigure(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Envoie la notification d'un nouveau contact ; ne lève jamais. */
export async function notifierContact(contact: Contact): Promise<void> {
  const t = transport();
  if (!t) {
    console.log(
      `📮 Contact reçu de ${contact.name} — e-mail non configuré, ` +
        `visible dans l'administration.`,
    );
    return;
  }

  // La table contacts ne porte pas de colonne sujet : la première ligne du
  // message (le formulaire de préinscription y écrit « Préinscription… »)
  // fait office de sujet.
  const premiereLigne = (contact.message ?? "").split("\n")[0].trim();
  const preinscription = /pr[ée]-?inscription/i.test(contact.message ?? "");
  const sujet = preinscription
    ? `🎓 Nouvelle préinscription — ${contact.name}`
    : `📨 Nouveau message${premiereLigne ? ` (${premiereLigne.slice(0, 60)})` : ""} — ${contact.name}`;

  const lignes = [
    `Nom : ${contact.name}`,
    `Téléphone : ${contact.phone}`,
    `Email : ${contact.email}`,
    ``,
    contact.message ?? "",
    ``,
    `— Envoyé automatiquement par le site 2iae.com`,
  ];

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: DESTINATAIRE,
      replyTo: contact.email || undefined,
      subject: sujet,
      text: lignes.join("\n"),
    });
    console.log(`📮 Notification envoyée à ${DESTINATAIRE} (${sujet})`);
  } catch (err) {
    console.error("❌ Envoi de la notification de contact :", (err as Error).message);
  }
}
