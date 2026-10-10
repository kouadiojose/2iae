// E-mails (Resend, comme le site). Sans RESEND_API_KEY, l'envoi est ignoré :
// le campus ne doit jamais échouer parce que l'e-mail est indisponible.
//
// Tous les e-mails du campus passent par gabaritEmail() : le vrai logo du
// Groupe Écoles 2IAE International en tête, un titre, quelques phrases, un
// seul bouton orange, et le pied de page officiel. Mise en page en tableaux
// et styles en ligne : lisible dans Gmail, Outlook et les messageries des
// téléphones, et encore lisible si les images sont bloquées.
import { config } from "./config";
import { selonNombre, t as tEnseigner } from "@shared/textes/enseigner";
import type { TypeQuestion } from "@shared/schema";

/** Le service d'e-mail est-il configuré ? */
export const emailDisponible = () => Boolean(config.mail.resendCle);

/** Pièce jointe d'un e-mail (le guide PDF, par exemple). */
export type PieceJointe = { nom: string; contenu: Buffer };

/**
 * Envoie un e-mail ; vrai s'il est parti. Faux sans clé Resend, sans adresse
 * ou en cas de refus : l'appelant le note (relances : statut « echec »).
 * « entetes » : en-têtes ajoutés au message, par exemple List-Unsubscribe et
 * List-Unsubscribe-Post (désinscription en un geste depuis la messagerie, RFC 8058).
 */
export async function envoyerEmail(o: {
  a: string;
  sujet: string;
  texte: string;
  html?: string;
  pieces?: PieceJointe[];
  entetes?: Record<string, string>;
}): Promise<boolean> {
  if (!config.mail.resendCle || !o.a) return false;
  try {
    const attachments = o.pieces?.map((p) => ({ filename: p.nom, content: p.contenu.toString("base64") }));
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.mail.resendCle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: config.mail.expediteur,
        to: [o.a],
        subject: o.sujet,
        text: o.texte,
        html: o.html,
        ...(attachments?.length ? { attachments } : {}),
        ...(o.entetes && Object.keys(o.entetes).length ? { headers: o.entetes } : {}),
      }),
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
/** Couleurs des e-mails, reprises par les pages servies hors de l'application (lien de validation des corrigés). */
export const COULEURS_EMAIL = { ORANGE, ORANGE_FONCE, ENCRE, TEXTE_PALE, CREME, LIGNE } as const;

/** Contacts officiels du groupe (www.2iae.com). */
export const CONTACTS_2IAE = {
  whatsapp: "+225 07 47 72 67 29",
  lienWhatsapp: "https://wa.me/2250747726729",
  email: "contacts@2iae.com",
  site: "https://www.2iae.com",
};

export const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type ContenuEmail = {
  /** Petite ligne en capitales au-dessus du titre (« Invitation »). */
  etiquette?: string;
  titre: string;
  /** Paragraphes (texte brut, échappé). Les ** entourent un passage en gras. */
  paragraphes: string[];
  bouton?: { libelle: string; lien: string };
  /** Second bouton, plus discret (contour), à côté du premier (« Voir et modifier »). */
  boutonSecondaire?: { libelle: string; lien: string };
  /** Petites lignes sous le bouton. */
  apresBouton?: string[];
  /** Encadré crème : paires libellé / valeur (identifiant, lien à copier…). */
  encadre?: { libelle: string; valeur: string; mono?: boolean }[];
  /** Étapes numérotées (guide pas à pas), sous l'encadré : titre, texte, et une adresse facultative. */
  etapes?: { titre: string; texte: string; adresse?: string }[];
  /** Intertitre au-dessus des étapes (« Votre guide pas à pas »). */
  titreEtapes?: string;
  /** Petite phrase d'aperçu, lue par la messagerie à côté du sujet (invisible dans le message). */
  apercu?: string;
  /** Rubriques courtes entre les paragraphes et le bouton (e-mail de la semaine) : un intertitre et des lignes. */
  sections?: { titre: string; lignes: string[] }[];
  /**
   * Fiches encadrées entre les rubriques et le bouton (corrigés du jour) : une petite étiquette, un titre, des
   * lignes (** pour le gras, retours à la ligne gardés) et un lien discret facultatif.
   */
  blocs?: { etiquette?: string; titre: string; lignes: string[]; lien?: { libelle: string; lien: string } }[];
  /** Étudiant : le pied de page le tutoie (« Écris-nous »). */
  tutoiement?: boolean;
  /** E-mails d'engagement : pourquoi on le reçoit, et le lien signé « Ne plus recevoir ces e-mails » (sans connexion). */
  desinscription?: { raison: string; libelle: string; lien: string };
};

/** Paragraphe : échappe puis met en gras ce qui est entre ** **. */
const enrichir = (s: string) => echapper(s).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${ENCRE}">$1</strong>`);
const enClair = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1");
/** Ligne d'une fiche : comme un paragraphe, et les retours à la ligne deviennent des sauts de ligne (gras ligne par ligne). */
const enrichirLignes = (s: string) => s.split("\n").map(enrichir).join("<br>");

/** Construit la version HTML et la version texte d'un e-mail du campus. */
export function gabaritEmail(c: ContenuEmail): { html: string; texte: string } {
  const logo = `${config.urlCampus}/logo-2iae.png`;
  const police = "font-family:Archivo,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const html = `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${echapper(c.titre)}</title></head>
<body style="margin:0;padding:0;background:${CREME};${police};color:${ENCRE}">
${c.apercu ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CREME}">${echapper(c.apercu)}</div>` : ""}
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
${(c.sections ?? [])
  .filter((s) => s.lignes.length)
  .map(
    (s) => `<tr><td style="padding:6px 32px 8px">
  <h2 style="margin:0 0 8px;font-size:17px;line-height:1.25;font-weight:900;color:${ENCRE}">${echapper(s.titre)}</h2>
  ${s.lignes.map((l) => `<p style="margin:0;padding:7px 0;border-top:1px solid ${LIGNE};font-size:15px;line-height:1.45;color:#3D3833">${enrichir(l)}</p>`).join("\n  ")}
</td></tr>`,
  )
  .join("\n")}
${(c.blocs ?? [])
  .map(
    (b) => `<tr><td style="padding:8px 32px 8px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREME};border:1px solid ${LIGNE};border-radius:14px">
  <tr><td style="padding:14px 16px 4px">
    ${b.etiquette ? `<p style="margin:0 0 4px;font-family:'IBM Plex Mono',Menlo,Consolas,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:${ORANGE_FONCE}">${echapper(b.etiquette)}</p>` : ""}
    <p style="margin:0 0 6px;font-size:16px;line-height:1.3;font-weight:800;color:${ENCRE}">${echapper(b.titre)}</p>
  </td></tr>
  ${b.lignes.map((l) => `<tr><td style="padding:8px 16px;border-top:1px solid ${LIGNE};font-size:14.5px;line-height:1.5;color:#3D3833">${enrichirLignes(l)}</td></tr>`).join("\n  ")}
  ${b.lien ? `<tr><td style="padding:6px 16px 14px"><a href="${echapper(b.lien.lien)}" style="font-size:14px;font-weight:700;color:${ORANGE_FONCE};text-decoration:none">${echapper(b.lien.libelle)} →</a></td></tr>` : `<tr><td style="padding:0 0 6px"></td></tr>`}
  </table>
</td></tr>`,
  )
  .join("\n")}
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
  c.boutonSecondaire
    ? `<tr><td style="padding:8px 32px 6px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:12px;border:2px solid ${ENCRE}">
    <a href="${echapper(c.boutonSecondaire.lien)}" style="display:inline-block;padding:13px 24px;font-size:16px;font-weight:800;color:${ENCRE};text-decoration:none;border-radius:12px">${echapper(c.boutonSecondaire.libelle)}</a>
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
      ${e.adresse ? `<p style="margin:6px 0 0;font-family:'IBM Plex Mono',Menlo,Consolas,monospace;font-size:12.5px"><a href="${echapper(e.adresse)}" style="color:${ORANGE_FONCE};text-decoration:none;font-weight:600">${echapper(e.adresse.replace(/^https?:\/\//, ""))}</a></p>` : ""}
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
    Une question ? ${c.tutoiement ? "Écris-nous" : "Écrivez-nous"} sur WhatsApp au <a href="${CONTACTS_2IAE.lienWhatsapp}" style="color:${ORANGE_FONCE};font-weight:700;text-decoration:none">${CONTACTS_2IAE.whatsapp}</a> ou à <a href="mailto:${CONTACTS_2IAE.email}" style="color:${ORANGE_FONCE};font-weight:700;text-decoration:none">${CONTACTS_2IAE.email}</a>.
  </p>
  <p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#8A7F76">
    <strong style="color:${ENCRE}">Campus numérique · Groupe Écoles 2IAE International</strong><br>
    Institut International des Affaires en Entrepreneuriat · <a href="${CONTACTS_2IAE.site}" style="color:#8A7F76">www.2iae.com</a>
  </p>
  ${
    c.desinscription
      ? `<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#8A7F76">${echapper(c.desinscription.raison)} <a href="${echapper(c.desinscription.lien)}" style="color:#8A7F76;text-decoration:underline">${echapper(c.desinscription.libelle)}</a></p>`
      : ""
  }
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
    ...(c.sections ?? []).filter((s) => s.lignes.length).flatMap((s) => [s.titre.toUpperCase(), ...s.lignes.map((l) => `- ${enClair(l)}`), ""]),
    ...(c.blocs ?? []).flatMap((b) => [
      [b.etiquette, b.titre].filter(Boolean).join(" · ").toUpperCase(),
      ...b.lignes.map((l) => enClair(l)),
      ...(b.lien ? [`${b.lien.libelle} : ${b.lien.lien}`] : []),
      "",
    ]),
    ...(c.bouton ? [`${c.bouton.libelle} : ${c.bouton.lien}`, ""] : []),
    ...(c.boutonSecondaire ? [`${c.boutonSecondaire.libelle} : ${c.boutonSecondaire.lien}`, ""] : []),
    ...(c.apresBouton ?? []).map(enClair),
    ...(c.encadre?.length ? ["", ...c.encadre.map((l) => `${l.libelle} : ${l.valeur}`)] : []),
    ...(c.etapes?.length
      ? ["", ...(c.titreEtapes ? [c.titreEtapes.toUpperCase(), ""] : []), ...c.etapes.flatMap((e, i) => [`${i + 1}. ${e.titre}`, `   ${enClair(e.texte)}`, ...(e.adresse ? [`   ${e.adresse}`] : []), ""])]
      : []),
    "",
    `Une question ? WhatsApp ${CONTACTS_2IAE.whatsapp} · ${CONTACTS_2IAE.email}`,
    "Campus numérique · Groupe Écoles 2IAE International · www.2iae.com",
    ...(c.desinscription ? ["", c.desinscription.raison, `${c.desinscription.libelle} : ${c.desinscription.lien}`] : []),
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
          texte: `Allez sur **${hote}/connexion**. Tapez votre adresse e-mail et le mot de passe que vous venez de choisir. Mot de passe oublié ? Sur la page de connexion, touchez « Mot de passe oublié ? » : un lien vous arrive par e-mail.`,
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
          texte: "Dans « **Corrections** », « Nouveau devoir » : un **devoir à rendre** (copie en photo, PDF ou Word) ou une **interrogation** corrigée toute seule, avec la consigne, la date limite et le barème, puis « Publier ». Chaque jour, le campus vous envoie le **corrigé** des devoirs de vos cours (bonnes réponses du QCM, corrigé de l'exercice) : validez-le ou modifiez-le ; sans réponse, il est tenu pour bon au bout de 24 heures. Le campus **corrige alors les copies** d'après ce corrigé et publie les notes. Vous gardez la main : vous changez toute note, et vous tranchez les copies douteuses et les demandes de relecture des étudiants.",
        },
        {
          titre: "Après le cours",
          texte: "Sur la page de la séance : le bilan des présences par campus, la fiche de révision rédigée par l'IA (vous la relisez avant de la publier), et le **replay**, qui arrive tout seul dans le cours.",
        },
      ]
    : [
        {
          titre: "Se connecter",
          texte: `Allez sur **${hote}/connexion**. Tapez votre adresse e-mail et le mot de passe que vous venez de choisir. Mot de passe oublié ? Sur la page de connexion, touchez « Mot de passe oublié ? ».`,
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
  const pdf = formateur ? "Le **manuel illustré du formateur** (PDF, en images) est joint à cet e-mail." : "Le **guide de l'administration** complet (PDF) est joint à cet e-mail.";
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
    apresBouton: [o.pdfJoint ? pdf : `${formateur ? "Le manuel illustré du formateur" : "Le guide complet"} (PDF) se télécharge ici : ${o.lienPdf}`],
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

/**
 * Guide de bienvenue d'un étudiant qui vient de créer son compte par le lien
 * d'inscription (tutoiement) : son matricule, puis le campus pas à pas.
 */
export function emailGuideEtudiant(o: {
  prenom: string;
  matricule: string;
  classe: string | null;
  premierCours?: string | null;
  pdfJoint: boolean;
  lienPdf: string;
}): { sujet: string; html: string; texte: string } {
  const hote = config.urlCampus.replace(/^https?:\/\//, "");
  const { html, texte } = gabaritEmail({
    etiquette: "Bienvenue · Ton campus numérique",
    tutoiement: true,
    titre: `Bienvenue, ${o.prenom.trim()} !`,
    paragraphes: [
      `Ton compte étudiant est prêt${o.classe ? `, en classe **${o.classe}**` : ""}. Voici, pas à pas, comment suivre tes cours sur le campus numérique du Groupe Écoles 2IAE International. Garde cet e-mail : il te servira d'aide-mémoire.`,
      ...(o.premierCours ? [`Ton prochain cours : **${o.premierCours}**.`] : []),
    ],
    bouton: { libelle: "Entrer dans mon campus", lien: `${config.urlCampus}/connexion` },
    apresBouton: [o.pdfJoint ? "Ton **manuel illustré** (PDF, en images) est joint à cet e-mail." : `Ton manuel illustré (PDF) se télécharge ici : ${o.lienPdf}`],
    encadre: [
      { libelle: "Adresse du campus", valeur: hote },
      { libelle: "Ton matricule (ton identifiant)", valeur: o.matricule, mono: true },
      { libelle: "Ton code secret", valeur: "Celui que tu viens de choisir" },
    ],
    titreEtapes: "Ton campus, pas à pas",
    etapes: [
      {
        titre: "Te connecter",
        texte: `Va sur **${hote}/connexion**. Tape ton matricule (ou ton numéro de téléphone, ou ton e-mail) et ton code secret. Code oublié ? Touche « Code oublié ? » sur la page de connexion.`,
      },
      {
        titre: "Installer l'application",
        texte: "Sur ton téléphone, ouvre le campus dans Chrome : il te propose de l'installer. Il s'ouvre ensuite comme une application, avec son icône.",
      },
      {
        titre: "Activer les alertes",
        texte: "Quand le campus te le demande, touche « Autoriser » : tu reçois une alerte dès qu'un cours commence, qu'un devoir est publié ou qu'une note arrive.",
      },
      {
        titre: "Suivre un cours en direct",
        texte: "Au début du cours, tu reçois l'alerte « En direct ». Touche-la, ou ouvre « **Live** » puis « Entrer dans la classe ». Choisis **Son + diapos** (très léger, pour la 3G/4G) ou **Vidéo** (au Wi-Fi). Tu peux lever la main, poser tes questions et répondre aux sondages.",
      },
      {
        titre: "Tes cours et les replays",
        texte: "« **Cours** » : les leçons et les documents de tes formateurs, et le **replay** de chaque cours en direct pour revoir ce que tu as manqué.",
      },
      {
        titre: "Rendre un devoir",
        texte: "« **Devoirs** » : ouvre le devoir, touche « Rendre mon devoir » et prends ta copie en photo nette (ou joins un PDF). Le campus la corrige d'après le corrigé de ton formateur : ta note et les conseils critère par critère arrivent dès qu'ils sont publiés. Une note te semble fausse ? Demande une relecture à ton formateur.",
      },
      {
        titre: "Besoin d'aide",
        texte: "« **Messages** » : écris à tes formateurs et à la vie scolaire de ton campus.",
      },
    ],
  });
  return { sujet: "Bienvenue sur ton campus numérique 2IAE : ton guide pas à pas", html, texte };
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
    tutoiement: tu,
    bouton: { libelle: tu ? "Choisir mon nouveau code" : "Choisir mon nouveau mot de passe", lien: o.lien },
    apresBouton: [
      tu ? "Le lien marche une seule fois, pendant 1 heure." : "Le lien est valable une seule fois, pendant 1 heure.",
      tu ? "Si ce n'est pas toi, ne fais rien : ton code actuel reste valable." : "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.",
    ],
  });
  return { sujet: tu ? "Ton nouveau code secret · Campus 2IAE" : "Votre nouveau mot de passe · Campus 2IAE", html, texte };
}

/** Manuel illustré du formateur (PDF servi par le campus, client/src/modules/manuels/manuels.ts). */
export const guideFormateurUrl = () => `${config.urlCampus}/guides/manuel-formateurs.pdf`;

/** Lien personnel d'inscription d'un formateur, envoyé par e-mail depuis le pilotage. */
export function emailLienFormateur(o: { pour: string; lien: string; expireLe: Date }): { sujet: string; html: string; texte: string } {
  const { html, texte } = gabaritEmail({
    etiquette: "Invitation · Campus numérique",
    titre: o.pour ? `Bonjour ${o.pour},` : "Bonjour,",
    paragraphes: [
      "Le Groupe Écoles 2IAE International vous ouvre son campus numérique. C'est de là que vous donnerez vos cours en direct, en même temps aux salles de conférence de nos campus et aux étudiants connectés depuis leur téléphone.",
      "Pour créer votre compte, ouvrez ce lien : vous y entrerez votre nom, votre adresse e-mail et le mot de passe de votre choix. Dès que c'est fait, vous êtes connecté et vous recevez par e-mail votre guide pas à pas.",
    ],
    bouton: { libelle: "Créer mon compte formateur", lien: o.lien },
    apresBouton: [
      `Ce lien est personnel et ne sert qu'une fois. Il reste valable jusqu'au ${fmtDate.format(o.expireLe)}.`,
      "Le bouton ne s'ouvre pas ? Copiez le lien ci-dessous dans votre navigateur (Chrome, Edge, Firefox ou Safari).",
    ],
    encadre: [{ libelle: "Lien d'inscription", valeur: o.lien, mono: true }],
  });
  return { sujet: "Créez votre compte formateur · Campus numérique 2IAE", html, texte };
}

// ── Corrigés du jour (correction automatique, 8 octobre 2026) ──────────────

/**
 * Markdown lisible en texte d'e-mail : titres et listes gardés comme lignes, liens et images réduits à leur
 * texte, gras gardé (** **), le reste des marques retiré. Coupé proprement à « max » caractères (fin de ligne
 * ou de phrase), avec « … » : « coupe » dit si le texte a été raccourci.
 */
export function markdownEnTexte(md: string, max: number): { texte: string; coupe: boolean } {
  const lignes = md
    .replace(/\r\n?/g, "\n")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`{1,3}/g, "")
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s{0,3}#{1,6}\s+(.*)$/, "**$1**")
        .replace(/^\s*[-*+]\s+/, "• ")
        .replace(/^\s*>\s?/, "")
        .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1$2")
        .replace(/__([^_]+)__/g, "**$1**")
        .replace(/\s+$/, ""),
    );
  // Pas plus d'une ligne vide d'affilée.
  const propre = lignes.filter((l, i) => l !== "" || (i > 0 && lignes[i - 1] !== "")).join("\n").trim();
  if (propre.length <= max) return { texte: propre, coupe: false };
  const debut = propre.slice(0, max);
  const fin = Math.max(debut.lastIndexOf("\n"), debut.lastIndexOf(". "));
  const coupe = (fin > max * 0.6 ? debut.slice(0, fin + 1) : debut).trimEnd();
  // Un gras ouvert et pas refermé dans la partie gardée n'est pas affiché tel quel.
  const ouverts = (coupe.match(/\*\*/g) ?? []).length % 2;
  return { texte: `${ouverts ? `${coupe}**` : coupe} …`, coupe: true };
}

/** Un corrigé à montrer dans l'e-mail du jour (préparé par server/corriges.ts). */
export type CorrigeDuJourEmail = {
  type: "quiz" | "depot";
  titre: string;
  coursCode: string;
  seanceTitre: string | null;
  consigne: string;
  bareme: number;
  grille: { critere: string; points: number }[];
  contenu: string;
  questions: { type: TypeQuestion; enonce: string; options: string[]; bonnes: (number | string)[]; explication: string | null }[];
  /** Page du corrigé sur le campus. */
  lien: string;
};

/** Longueurs gardées dans l'e-mail (Gmail coupe un message au-delà de 100 Ko environ). */
const MAX_CONSIGNE_EMAIL = 700;
const MAX_CORRIGE_EMAIL = 2200;
const MAX_ENONCE_EMAIL = 300;
const MAX_OPTION_EMAIL = 200;
const MAX_EXPLICATION_EMAIL = 260;

const enUneLigne = (s: string, max: number) => {
  const l = s.replace(/\s+/g, " ").trim();
  return l.length > max ? `${l.slice(0, max - 1).trimEnd()}…` : l;
};
const LETTRES = "ABCDEFGHIJ";

/** La bonne réponse d'une question, lisible (« B. Une fonction »), quel que soit son type. */
function bonneReponseLisible(q: CorrigeDuJourEmail["questions"][number]): string {
  if (q.type === "reponse_courte") return q.bonnes.map((b) => `« ${enUneLigne(String(b), MAX_OPTION_EMAIL)} »`).join(" ou ");
  if (q.type === "vrai_faux") return q.bonnes.map((b) => (Number(b) === 0 ? tEnseigner("corriges.email.vrai") : tEnseigner("corriges.email.faux"))).join(", ");
  return q.bonnes
    .map((b) => Number(b))
    .filter((i) => Number.isInteger(i) && i >= 0 && i < q.options.length)
    .map((i) => `${LETTRES[i] ?? i + 1}. ${enUneLigne(q.options[i], MAX_OPTION_EMAIL)}`)
    .join(" + ");
}

/** La fiche d'un corrigé dans l'e-mail : questions et bonnes réponses (QCM), consigne, grille et corrigé (exercice). */
function blocCorrige(c: CorrigeDuJourEmail): NonNullable<ContenuEmail["blocs"]>[number] {
  const v = { code: c.coursCode };
  if (c.type === "quiz") {
    return {
      etiquette: tEnseigner("corriges.email.bloc.quiz", { v }),
      titre: c.titre,
      lignes: [
        selonNombre(tEnseigner, "corriges.email.bloc.questions", c.questions.length),
        ...c.questions.map(
          (q, i) =>
            tEnseigner("corriges.email.question", { v: { i: i + 1, enonce: enUneLigne(q.enonce, MAX_ENONCE_EMAIL), reponse: bonneReponseLisible(q) } }) +
            (q.explication?.trim() ? tEnseigner("corriges.email.explication", { v: { explication: enUneLigne(q.explication, MAX_EXPLICATION_EMAIL) } }) : ""),
        ),
      ],
      lien: { libelle: tEnseigner("corriges.email.lireTout"), lien: c.lien },
    };
  }
  const consigne = markdownEnTexte(c.consigne, MAX_CONSIGNE_EMAIL);
  const corrige = markdownEnTexte(c.contenu, MAX_CORRIGE_EMAIL);
  return {
    etiquette: tEnseigner("corriges.email.bloc.depot", { v }),
    titre: c.titre,
    lignes: [
      ...(consigne.texte ? [tEnseigner("corriges.email.consigne", { v: { texte: consigne.texte } })] : []),
      c.grille.length
        ? tEnseigner("corriges.email.grille", { v: { bareme: c.bareme, criteres: c.grille.map((g) => `${g.critere} (${g.points})`).join(" · ") } })
        : tEnseigner("corriges.email.sansGrille", { v: { bareme: c.bareme } }),
      tEnseigner("corriges.email.corrige", { v: { texte: corrige.texte } }),
    ],
    lien: { libelle: tEnseigner(corrige.coupe || consigne.coupe ? "corriges.email.suite" : "corriges.email.lireTout"), lien: c.lien },
  };
}

/**
 * E-mail du jour au formateur : le corrigé des devoirs que ses étudiants ont reçus (bonnes réponses du QCM,
 * consigne, grille et corrigé de l'exercice), l'heure à laquelle ils seront tenus pour bons, et deux boutons :
 * « Tout est juste : valider » (lien signé, qui ouvre une page de confirmation) et « Voir et modifier ».
 * « autres » : corrigés envoyés aussi mais pas détaillés ici (trop nombreux pour un e-mail).
 */
export function emailCorrigesDuJour(o: {
  personne: { prenom: string; nom: string };
  corriges: CorrigeDuJourEmail[];
  autres: number;
  /** « demain, vendredi 9 octobre à 15h00 » */
  quand: string;
  /** « jeudi 8 octobre » */
  date: string;
  lienValider: string | null;
  lienVoir: string;
}): { sujet: string; html: string; texte: string } {
  const n = o.corriges.length + o.autres;
  const appel = /^(m|mme|mlle|dr|pr)\.?$/i.test(o.personne.prenom.trim()) ? nomAffiche(o.personne) : o.personne.prenom.trim() || nomAffiche(o.personne);
  const avecQcm = o.corriges.some((c) => c.type === "quiz");
  const { html, texte } = gabaritEmail({
    etiquette: tEnseigner("corriges.email.etiquette", { v: { date: o.date } }),
    titre: tEnseigner("corriges.email.titre", { v: { appel } }),
    apercu: tEnseigner("corriges.email.apercu"),
    paragraphes: [selonNombre(tEnseigner, "corriges.email.intro", n), selonNombre(tEnseigner, "corriges.email.regle", n, { v: { quand: o.quand } })],
    blocs: o.corriges.map(blocCorrige),
    sections: [],
    bouton: o.lienValider ? { libelle: tEnseigner("corriges.email.valider"), lien: o.lienValider } : undefined,
    boutonSecondaire: { libelle: tEnseigner("corriges.email.voir"), lien: o.lienVoir },
    apresBouton: [
      ...(o.autres ? [selonNombre(tEnseigner, "corriges.email.autres", o.autres)] : []),
      ...(o.lienValider ? [tEnseigner("corriges.email.apres.confirmer")] : []),
      ...(avecQcm ? [tEnseigner("corriges.email.apres.qcm")] : []),
    ],
  });
  return { sujet: selonNombre(tEnseigner, "corriges.email.sujet", n), html, texte };
}
