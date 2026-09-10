// Notification par e-mail des messages de contact et préinscriptions.
//
// Chaque envoi part vers CONTACT_EMAIL (par défaut ptchimou92@gmail.com),
// qui est aussi l'adresse de réponse de tout courrier sortant du site.
//
// Deux transports, dans cet ordre de préférence :
//   1. Resend  — RESEND_API_KEY (et RESEND_FROM une fois un domaine vérifié,
//      ex. « Groupe 2IAE <contact@2iae.com> » ; défaut : contact@2iae.com,
//      le domaine 2iae.com étant vérifié sur Resend)
//   2. SMTP    — SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
//
// Sans configuration, l'envoi est simplement ignoré (les messages restent
// dans l'administration) — le formulaire ne doit jamais échouer parce que
// l'e-mail est indisponible.
import nodemailer from "nodemailer";
import type { Contact } from "@shared/schema";

// Plusieurs destinataires possibles, séparés par des virgules dans CONTACT_EMAIL.
const DESTINATAIRES = (process.env.CONTACT_EMAIL || "ptchimou92@gmail.com,skoua2000@yahoo.fr,kouadiojose@gmail.com,honorablejeanmissionnaire@gmail.com")
  .split(",")
  .map((a) => a.trim())
  .filter(Boolean);
const REPONDRE_A = process.env.REPLY_TO_EMAIL || "ptchimou92@gmail.com";

// Noms des membres de l'équipe de suivi : chaque notification est envoyée
// individuellement et personnalisée pour pousser à l'action.
const NOMS_EQUIPE: Record<string, string> = {
  "ptchimou92@gmail.com": "Mme Konaté",
  "skoua2000@yahoo.fr": "M. Koua",
  "kouadiojose@gmail.com": "José",
  "honorablejeanmissionnaire@gmail.com": "Honorable Jean",
};

function nomDe(email: string): string {
  return NOMS_EQUIPE[email.toLowerCase()] ?? "cher membre de l'équipe";
}

/**
 * Envoie un message à chaque membre de l'équipe de suivi, individuellement
 * et personnalisé par son nom — un e-mail nominatif engage bien plus qu'une
 * liste de diffusion. Ne lève jamais ; vrai si au moins un envoi a abouti.
 */
export async function envoyerAEquipe(opts: {
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<boolean> {
  let auMoinsUn = false;
  for (const dest of DESTINATAIRES) {
    const ok = await envoyerEmail({
      to: dest,
      subject: opts.subject,
      replyTo: opts.replyTo,
      text: `Bonjour ${nomDe(dest)},\n\n${opts.text}`,
    });
    auMoinsUn = auMoinsUn || ok;
  }
  return auMoinsUn;
}
// Le domaine 2iae.com est vérifié sur Resend : l'expéditeur officiel est
// utilisé par défaut, RESEND_FROM permet d'en changer sans redéployer.
const EXPEDITEUR_DEFAUT = "Groupe 2IAE <contact@2iae.com>";

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
          from: process.env.RESEND_FROM || EXPEDITEUR_DEFAUT,
          to: opts.to.split(",").map((a) => a.trim()).filter(Boolean),
          reply_to: replyTo,
          subject: opts.subject,
          text: opts.text,
        }),
      });
      if (!rep.ok) {
        const corps = await rep.text();
        // Compte Resend en mode test (domaine non vérifié) : seul le
        // propriétaire du compte peut recevoir. On se replie sur son adresse
        // pour ne perdre aucune notification ; ce repli disparaît de lui-même
        // dès que le domaine est vérifié.
        const test = corps.match(/your own email address \(([^)]+)\)/);
        if (rep.status === 403 && test) {
          const secours = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM || EXPEDITEUR_DEFAUT,
              to: [test[1]],
              reply_to: replyTo,
              subject: `${opts.subject} [domaine Resend non vérifié]`,
              text:
                `⚠️ Destinataires prévus : ${opts.to} — livrés ici car le domaine ` +
                `n'est pas encore vérifié sur resend.com/domains.\n\n` + opts.text,
            }),
          });
          if (secours.ok) {
            console.warn(`📮 Resend en mode test : notification livrée à ${test[1]} (repli).`);
            return true;
          }
        }
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

  const ok = await envoyerAEquipe({
    subject: sujet,
    // Répondre depuis la boîte doit joindre le demandeur directement.
    replyTo: contact.email || undefined,
    text: [
      preinscription
        ? `${contact.name} vient de faire le premier pas vers 2IAE en se préinscrivant sur le site. À nous de faire le second : un appel dans l'heure transforme une préinscription en inscription.`
        : `${contact.name} vient d'écrire au Groupe 2IAE via le site. Une réponse rapide fait toute la différence.`,
      ``,
      `Nom : ${contact.name}`,
      `Téléphone : ${contact.phone}`,
      `Email : ${contact.email}`,
      ``,
      contact.message ?? "",
      ``,
      `👉 Pouvez-vous prendre ce contact en charge maintenant ? Appelez, puis notez le résultat dans www.2iae.com/admin/leads pour que toute l'équipe le voie. Chaque étudiant inscrit a commencé par un appel passé à temps.`,
      ``,
      `— L'assistant du site 2iae.com`,
    ].join("\n"),
  });
  if (ok) console.log(`📮 Notification personnalisée envoyée à l'équipe (${sujet})`);
}
