// E-mails (Resend, comme le site). Sans RESEND_API_KEY, l'envoi est ignoré :
// le campus ne doit jamais échouer parce que l'e-mail est indisponible.
//
// Tous les e-mails du campus passent par gabaritEmail() : le vrai logo du
// Groupe Écoles 2IAE International en tête, un titre, quelques phrases, un
// seul bouton orange, et le pied de page officiel. Mise en page en tableaux
// et styles en ligne : lisible dans Gmail, Outlook et les messageries des
// téléphones, et encore lisible si les images sont bloquées.
import { config } from "./config";

/** Le service d'e-mail est-il configuré ? */
export const emailDisponible = () => Boolean(config.mail.resendCle);

/** Pièce jointe d'un e-mail (le guide PDF, par exemple). */
export type PieceJointe = { nom: string; contenu: Buffer };

export async function envoyerEmail(o: { a: string; sujet: string; texte: string; html?: string; pieces?: PieceJointe[] }): Promise<boolean> {
  if (!config.mail.resendCle || !o.a) return false;
  try {
    const attachments = o.pieces?.map((p) => ({ filename: p.nom, content: p.contenu.toString("base64") }));
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.mail.resendCle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.mail.expediteur, to: [o.a], subject: o.sujet, text: o.texte, html: o.html, ...(attachments?.length ? { attachments } : {}) }),
      // Une pièce jointe de quelques Mo met plus longtemps à partir.
      signal: AbortSignal.timeout(o.pieces?.length ? 45_000 : 15_000),
    });
    if (!r.ok) console.error("[mail] Resend :", r.status, await r.text().catch(() => ""));
    return r.ok;
  } catch (e) {
    console.error("[mail] envoi impossible :", (e as Error).message);
    return false;
  }
}

// ── Gabarit ────────────────────────────────────────────────────────────────

const ORANGE = "#E4793A";
const ORANGE_FONCE = "#C85F22";
const ENCRE = "#141414";
const TEXTE_PALE = "#6B625B";
const CREME = "#FBF6F2";
const LIGNE = "#EADFD5";

/** Contacts officiels du groupe (www.2iae.com). */
export const CONTACTS_2IAE = {
  whatsapp: "+225 07 47 72 67 29",
  lienWhatsapp: "https://wa.me/2250747726729",
  email: "contacts@2iae.com",
  site: "https://www.2iae.com",
};

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type ContenuEmail = {
  /** Petite ligne en capitales au-dessus du titre (« Invitation »). */
  etiquette?: string;
  titre: string;
  /** Paragraphes (texte brut, échappé). Les ** entourent un passage en gras. */
  paragraphes: string[];
  bouton?: { libelle: string; lien: string };
  /** Petites lignes sous le bouton. */
  apresBouton?: string[];
  /** Encadré crème : paires libellé / valeur (identifiant, lien à copier…). */
  encadre?: { libelle: string; valeur: string; mono?: boolean }[];
  /** Guide pas à pas, sous l'encadré : étapes numérotées (texte brut, ** pour le gras). */
  etapes?: { titre: string; texte: string }[];
  /** Titre au-dessus des étapes (« Votre campus, pas à pas »). */
  titreEtapes?: string;
};

/** Paragraphe : échappe puis met en gras ce qui est entre ** **. */
const enrichir = (s: string) => echapper(s).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${ENCRE}">$1</strong>`);
const enClair = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1");

/** Construit la version HTML et la version texte d'un e-mail du campus. */
export function gabaritEmail(c: ContenuEmail): { html: string; texte: string } {
  const logo = `${config.urlCampus}/logo-2iae.png`;
  const police = "font-family:Archivo,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const html = `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${echapper(c.titre)}</title></head>
<body style="margin:0;padding:0;background:${CREME};${police};color:${ENCRE}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREME};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${LIGNE};border-radius:20px;overflow:hidden">
<tr><td style="padding:28px 32px 8px">
  <img src="${logo}" width="184" height="96" alt="Groupe Écoles 2IAE International" style="display:block;border:0;width:184px;height:auto;max-width:184px">
</td></tr>
<tr><td style="padding:12px 32px 0">
  ${c.etiquette ? `<p style="margin:0 0 8px;font-family:'IBM Plex Mono',Menlo,Consolas,monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${ORANGE_FONCE}">${echapper(c.etiquette)}</p>` : ""}
  <h1 style="margin:0 0 16px;font-size:26px;line-height:1.15;font-weight:900;letter-spacing:-.02em;color:${ENCRE}">${echapper(c.titre)}</h1>
  ${c.paragraphes.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#3D3833">${enrichir(p)}</p>`).join("\n  ")}
</td></tr>
${
  c.bouton
    ? `<tr><td style="padding:10px 32px 6px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:12px;background:${ORANGE}">
    <a href="${echapper(c.bouton.lien)}" style="display:inline-block;padding:15px 26px;font-size:16px;font-weight:800;color:${ENCRE};text-decoration:none;border-radius:12px">${echapper(c.bouton.libelle)}</a>
  </td></tr></table>
</td></tr>`
    : ""
}
${
  c.apresBouton?.length
    ? `<tr><td style="padding:10px 32px 0">${c.apresBouton.map((p) => `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:${TEXTE_PALE}">${enrichir(p)}</p>`).join("")}</td></tr>`
    : ""
}
${
  c.encadre?.length
    ? `<tr><td style="padding:14px 32px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREME};border-radius:14px">
  ${c.encadre
    .map(
      (l) => `<tr><td style="padding:12px 16px 0;font-family:'IBM Plex Mono',Menlo,Consolas,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8A7F76">${echapper(l.libelle)}</td></tr>
  <tr><td style="padding:4px 16px 12px;font-size:${l.mono ? "13px" : "15px"};font-weight:700;word-break:break-all;${l.mono ? "font-family:'IBM Plex Mono',Menlo,Consolas,monospace;font-weight:600;" : ""}color:${ENCRE}">${echapper(l.valeur)}</td></tr>`,
    )
    .join("\n  ")}
  </table>
</td></tr>`
    : ""
}
${
  c.etapes?.length
    ? `<tr><td style="padding:26px 32px 0">
  ${c.titreEtapes ? `<h2 style="margin:0 0 14px;font-size:19px;line-height:1.2;font-weight:900;letter-spacing:-.01em;color:${ENCRE}">${echapper(c.titreEtapes)}</h2>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  ${c.etapes
    .map(
      (e, i) => `<tr>
    <td width="40" valign="top" style="padding:0 0 16px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" valign="middle" width="30" height="30" style="width:30px;height:30px;border-radius:15px;background:${ORANGE};font-size:14px;font-weight:900;color:${ENCRE}">${i + 1}</td></tr></table>
    </td>
    <td valign="top" style="padding:3px 0 16px">
      <p style="margin:0 0 4px;font-size:16px;line-height:1.3;font-weight:800;color:${ENCRE}">${echapper(e.titre)}</p>
      <p style="margin:0;font-size:15px;line-height:1.55;color:#3D3833">${enrichir(e.texte)}</p>
    </td>
  </tr>`,
    )
    .join("\n  ")}
  </table>
</td></tr>`
    : ""
}
<tr><td style="padding:24px 32px 28px">
  <p style="margin:0;padding-top:18px;border-top:1px solid ${LIGNE};font-size:13px;line-height:1.55;color:${TEXTE_PALE}">
    Une question ? Écrivez-nous sur WhatsApp au <a href="${CONTACTS_2IAE.lienWhatsapp}" style="color:${ORANGE_FONCE};font-weight:700;text-decoration:none">${CONTACTS_2IAE.whatsapp}</a> ou à <a href="mailto:${CONTACTS_2IAE.email}" style="color:${ORANGE_FONCE};font-weight:700;text-decoration:none">${CONTACTS_2IAE.email}</a>.
  </p>
  <p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#8A7F76">
    <strong style="color:${ENCRE}">Campus numérique · Groupe Écoles 2IAE International</strong><br>
    Institut International des Affaires en Entrepreneuriat · <a href="${CONTACTS_2IAE.site}" style="color:#8A7F76">www.2iae.com</a>
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const texte = [
    c.titre,
    "",
    ...c.paragraphes.map(enClair).flatMap((p) => [p, ""]),
    ...(c.bouton ? [`${c.bouton.libelle} : ${c.bouton.lien}`, ""] : []),
    ...(c.apresBouton ?? []).map(enClair),
    ...(c.encadre?.length ? ["", ...c.encadre.map((l) => `${l.libelle} : ${l.valeur}`)] : []),
    ...(c.etapes?.length ? ["", ...(c.titreEtapes ? [c.titreEtapes.toUpperCase(), ""] : []), ...c.etapes.flatMap((e, i) => [`${i + 1}. ${e.titre}`, `   ${enClair(e.texte)}`, ""])] : []),
    "",
    `Une question ? WhatsApp ${CONTACTS_2IAE.whatsapp} · ${CONTACTS_2IAE.email}`,
    "Campus numérique · Groupe Écoles 2IAE International · www.2iae.com",
  ].join("\n");
  return { html, texte };
}

// ── Modèles ────────────────────────────────────────────────────────────────

const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Abidjan" });

/** « M. Konaté » (prénom inconnu) ou « Claude Trépanier ». */
export const nomAffiche = (p: { prenom: string; nom: string }) => `${p.prenom} ${p.nom}`.replace(/\s+/g, " ").trim();

/**
 * Invitation d'un formateur (ou d'un membre de l'équipe) : le lien lui fait
 * créer son compte (nom, e-mail, téléphone, mot de passe) ; le guide pas à
 * pas part par e-mail dès que le compte est créé.
 */
export function emailInvitation(o: {
  personne: { prenom: string; nom: string; role: string };
  lien: string;
  expireLe: Date;
  /** « Initiation à l'IA · lundi 28 septembre à 08:30 (heure d'Abidjan) » */
  premierCours?: string | null;
}): { sujet: string; html: string; texte: string } {
  const formateur = o.personne.role === "formateur";
  const { html, texte } = gabaritEmail({
    etiquette: "Invitation · Campus numérique",
    titre: `Bonjour ${nomAffiche(o.personne)},`,
    paragraphes: [
      formateur
        ? "Le Groupe Écoles 2IAE International vous ouvre son campus numérique. C'est de là que vous donnerez vos cours en direct, en même temps aux salles de conférence de nos cinq campus et aux étudiants connectés depuis leur téléphone."
        : "Le Groupe Écoles 2IAE International vous ouvre son campus numérique, l'outil de la vie scolaire de ses cinq campus.",
      ...(o.premierCours ? [`Votre prochain cours : **${o.premierCours}**.`] : []),
      "Pour entrer, un seul lien. Vous y créerez votre compte : votre nom, votre adresse e-mail (elle sera votre identifiant), votre téléphone et votre mot de passe.",
      "Dès que votre compte est créé, vous recevez par e-mail le **guide pas à pas** du campus : comment vous connecter, préparer et donner vos cours, déposer vos documents et corriger les devoirs.",
    ],
    bouton: { libelle: "Créer mon compte", lien: o.lien },
    apresBouton: [
      `Ce lien est personnel et ne sert qu'une fois. Il reste valable jusqu'au ${fmtDate.format(o.expireLe)}.`,
      "Le bouton ne s'ouvre pas ? Copiez le lien ci-dessous dans votre navigateur (Chrome, Edge, Firefox ou Safari).",
    ],
    encadre: [{ libelle: "Lien d'invitation", valeur: o.lien, mono: true }],
  });
  return { sujet: formateur ? "Votre accès au campus numérique 2IAE" : "Votre accès au campus numérique 2IAE (équipe)", html, texte };
}

/**
 * Guide de bienvenue, envoyé dès que le formateur (ou le membre de l'équipe)
 * a créé son compte : ses identifiants, puis le campus pas à pas. Le guide
 * complet en PDF est joint quand il est disponible.
 */
export function emailGuideBienvenue(o: {
  personne: { prenom: string; nom: string; role: string };
  email: string;
  premierCours?: string | null;
  pdfJoint: boolean;
  lienPdf: string;
}): { sujet: string; html: string; texte: string } {
  const formateur = o.personne.role === "formateur";
  const hote = config.urlCampus.replace(/^https?:\/\//, "");
  const appel = /^(m|mme|mlle|dr|pr)\.?$/i.test(o.personne.prenom.trim()) ? nomAffiche(o.personne) : o.personne.prenom.trim();
  const etapes: { titre: string; texte: string }[] = formateur
    ? [
        {
          titre: "Se connecter",
          texte: `Allez sur **${hote}/connexion**. Tapez votre adresse e-mail et le mot de passe que vous venez de choisir. Mot de passe oublié ? Sur la page de connexion, touchez « Code oublié ? » : un lien vous arrive par e-mail.`,
        },
        {
          titre: "Installer l'application",
          texte: "Sur ordinateur, dans Chrome ou Edge, l'icône « Installer » de la barre d'adresse met le campus dans une fenêtre à lui, comme un logiciel. Sur téléphone, le campus vous propose de l'installer.",
        },
        {
          titre: "Votre page « Aujourd'hui »",
          texte: "C'est votre accueil : votre prochaine séance, vos cours, et votre lieu. Un clic sur **Nice**, **Toronto** ou votre ville règle ce que voient les salles (« depuis Toronto ») et vos horaires « chez vous ».",
        },
        {
          titre: "Préparer une séance",
          texte: "Sur votre page « Aujourd'hui » ou dans « Studio », chaque séance a son bouton « Préparer la séance » : déposez votre **PowerPoint** ou votre PDF (chaque diapo devient une image légère), le déroulé minuté et vos sondages. L'assistant IA peut vous proposer un déroulé.",
        },
        {
          titre: "Donner le cours en direct",
          texte: "Ouvrez le **Studio** une vingtaine de minutes avant l'heure. Testez votre micro et votre caméra, vérifiez que les salles passent au vert, puis « **Démarrer le direct** ». Les cinq salles et les étudiants basculent sur votre cours, et l'enregistrement démarre tout seul. À la fin, « **Terminer** ».",
        },
        {
          titre: "Mettre vos leçons et vos documents",
          texte: "« **Mes cours** », puis votre cours : ajoutez des leçons avec un texte, des PDF, des PowerPoint, des documents Word ou des vidéos courtes (50 Mo par fichier). Vos étudiants les retrouvent sur leur téléphone.",
        },
        {
          titre: "Donner et corriger les devoirs",
          texte: "Dans « **Corrections** », « Nouveau devoir » : un **devoir à rendre** (copie en photo, PDF ou Word) ou une **interrogation** corrigée toute seule, avec la consigne, la date limite et le barème, puis « Publier ». Quand les copies arrivent, l'IA vous propose une note et un commentaire : vous relisez, vous décidez, puis « Publier les notes ».",
        },
        {
          titre: "Après le cours",
          texte: "Sur la page de la séance : le bilan des présences par campus, la fiche de révision rédigée par l'IA (vous la relisez avant de la publier), et le **replay**, qui arrive tout seul dans le cours.",
        },
      ]
    : [
        {
          titre: "Se connecter",
          texte: `Allez sur **${hote}/connexion**. Tapez votre adresse e-mail et le mot de passe que vous venez de choisir. Mot de passe oublié ? Sur la page de connexion, touchez « Code oublié ? ».`,
        },
        {
          titre: "Installer l'application",
          texte: "Sur ordinateur, l'icône « Installer » de la barre d'adresse de Chrome ou d'Edge. Sur téléphone, le campus vous propose de l'installer.",
        },
        {
          titre: "Le pilotage",
          texte: "« **Pilotage** » rassemble les cours du jour, les présences par campus, les étudiants, la scolarité et les annonces.",
        },
        {
          titre: "Suivre les cours en direct",
          texte: "« **Live** » : les cours en cours, les salles prêtes, et le replay de chaque séance terminée.",
        },
      ];
  const pdf = formateur ? "Le **guide du formateur** complet (16 pages, PDF) est joint à cet e-mail." : "Le **guide de l'administration** complet (PDF) est joint à cet e-mail.";
  const { html, texte } = gabaritEmail({
    etiquette: formateur ? "Bienvenue · Guide du formateur" : "Bienvenue · Campus numérique",
    titre: `Bienvenue, ${appel} !`,
    paragraphes: [
      formateur
        ? "Votre compte formateur est créé. Voici, pas à pas, comment entrer sur le campus numérique du Groupe Écoles 2IAE International et y donner vos cours. Gardez cet e-mail : il vous servira d'aide-mémoire."
        : "Votre compte est créé. Voici, pas à pas, comment entrer sur le campus numérique du Groupe Écoles 2IAE International. Gardez cet e-mail : il vous servira d'aide-mémoire.",
      ...(o.premierCours ? [`Votre prochain cours : **${o.premierCours}**.`] : []),
    ],
    bouton: { libelle: "Entrer dans mon campus", lien: `${config.urlCampus}/connexion` },
    apresBouton: [o.pdfJoint ? pdf : `Le guide complet (PDF) se télécharge ici : ${o.lienPdf}`],
    encadre: [
      { libelle: "Adresse du campus", valeur: hote },
      { libelle: "Votre identifiant", valeur: o.email, mono: true },
      { libelle: "Votre mot de passe", valeur: "Celui que vous venez de choisir" },
    ],
    titreEtapes: "Votre campus, pas à pas",
    etapes,
  });
  return { sujet: formateur ? "Bienvenue sur le campus numérique 2IAE : votre guide pas à pas" : "Bienvenue sur le campus numérique 2IAE", html, texte };
}

/** Lien « code oublié » reçu par e-mail (tutoiement pour les étudiants). */
export function emailReinitialisation(o: { prenom: string; etudiant: boolean; lien: string }): { sujet: string; html: string; texte: string } {
  const tu = o.etudiant;
  const { html, texte } = gabaritEmail({
    etiquette: "Campus numérique",
    titre: `Bonjour ${o.prenom},`,
    paragraphes: [
      tu
        ? "Tu as demandé un nouveau code secret pour le campus numérique 2IAE. Touche le bouton pour le choisir."
        : "Vous avez demandé un nouveau mot de passe pour le campus numérique 2IAE. Ouvrez le lien pour le choisir.",
    ],
    bouton: { libelle: tu ? "Choisir mon nouveau code" : "Choisir mon nouveau mot de passe", lien: o.lien },
    apresBouton: [
      tu ? "Le lien marche une seule fois, pendant 1 heure." : "Le lien est valable une seule fois, pendant 1 heure.",
      tu ? "Si ce n'est pas toi, ne fais rien : ton code actuel reste valable." : "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.",
    ],
  });
  return { sujet: tu ? "Ton nouveau code secret · Campus 2IAE" : "Votre nouveau mot de passe · Campus 2IAE", html, texte };
}
