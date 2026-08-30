// Notification par e-mail des messages de contact et préinscriptions.
//
// Chaque envoi part vers CONTACT_EMAIL (par défaut ptchimou92@gmail.com),
// qui est aussi l'adresse de réponse de tout courrier sortant du site.
//
// Deux transports, dans cet ordre de préférence :
//   1. Resend  — RESEND_API_KEY (et RESEND_FROM une fois un domaine vérifié,
//      ex. « Groupe 2IAE <contact@2iae.com> » ; défaut : onboarding@resend.dev)
//   2. SMTP    — SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
//
// Sans configuration, l'envoi est simplement ignoré (les messages restent
// dans l'administration) — le formulaire ne doit jamais échouer parce que
// l'e-mail est indisponible.
import nodemailer from "nodemailer";
import type { Contact } from "@shared/schema";

// Plusieurs destinataires possibles, séparés par des virgules dans CONTACT_EMAIL.
const DESTINATAIRES = (process.env.CONTACT_EMAIL || "ptchimou92@gmail.com,skoua2000@yahoo.fr")
  .split(",")
  .map((a) => a.trim())
  .filter(Boolean);
const REPONDRE_A = process.env.REPLY_TO_EMAIL || "ptchimou92@gmail.com";

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
  return Boolean(
    process.env.RESEND_API_KEY ||
      (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  );
}

/** Envoi générique : Resend si configuré, sinon SMTP. Ne lève jamais. */
export async function envoyerEmail(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<boolean> {
  const replyTo = opts.replyTo || REPONDRE_A;

  if (process.env.RESEND_API_KEY) {
    try {
      const rep = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Site 2IAE <onboarding@resend.dev>",
          to: opts.to.split(",").map((a) => a.trim()).filter(Boolean),
          reply_to: replyTo,
          subject: opts.subject,
          text: opts.text,
        }),
      });
      if (!rep.ok) {
        const corps = await rep.text();
        console.error(`❌ Resend ${rep.status} : ${corps.slice(0, 300)}`);
        return false;
      }
      return true;
    } catch (err) {
      console.error("❌ Envoi Resend :", (err as Error).message);
      return false;
    }
  }

  const t = transport();
  if (!t) return false;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: opts.to,
      replyTo,
      subject: opts.subject,
      text: opts.text,
    });
    return true;
  } catch (err) {
    console.error("❌ Envoi SMTP :", (err as Error).message);
    return false;
  }
}

/** Envoie la notification d'un nouveau contact ; ne lève jamais. */
export async function notifierContact(contact: Contact): Promise<void> {
  if (!emailConfigure()) {
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

  const ok = await envoyerEmail({
    to: DESTINATAIRES.join(","),
    subject: sujet,
    // Répondre depuis la boîte doit joindre le demandeur directement.
    replyTo: contact.email || undefined,
    text: [
      `Nom : ${contact.name}`,
      `Téléphone : ${contact.phone}`,
      `Email : ${contact.email}`,
      ``,
      contact.message ?? "",
      ``,
      `— Envoyé automatiquement par le site 2iae.com`,
    ].join("\n"),
  });
  if (ok) console.log(`📮 Notification envoyée à ${DESTINATAIRES.join(", ")} (${sujet})`);
}
