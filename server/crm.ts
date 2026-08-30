// Mini-CRM du site : chaque visiteur qui laisse un contact (chatbot,
// préinscription, formulaire de contact) devient un lead suivi dans un
// pipeline jusqu'à l'inscription. Le module gère le dédoublonnage, la
// cadence de relance par étape et le digest quotidien envoyé aux admissions.
import { and, desc, eq, isNotNull, lte, or, sql as dsql } from "drizzle-orm";
import { db, pool } from "./db";
import { chatMessages, leads, type Lead, type StageLead } from "@shared/schema";
import { envoyerEmail, emailConfigure } from "./mail";
import { alerterWhatsApp } from "./whatsapp";

const DESTINATAIRES = (process.env.CONTACT_EMAIL || "ptchimou92@gmail.com,skoua2000@yahoo.fr,kouadiojose@gmail.com")
  .split(",")
  .map((a) => a.trim())
  .filter(Boolean);

// Cadence de suivi : délai (en jours) avant la prochaine action selon l'étape.
// null = plus de relance (dossier clos ou gagné).
const CADENCE_JOURS: Record<StageLead, number | null> = {
  nouveau: 0, // à appeler le jour même
  contacte: 3, // relance WhatsApp à J+3
  relance: 4, // nouvelle relance à J+4 (puis l'équipe décide)
  visite: 2, // après une visite de campus, rappeler sous 48 h
  preinscrit: 2, // finaliser le dossier sous 48 h
  inscrit: null,
  perdu: null,
};

// Ce que l'équipe doit faire à chaque étape — repris tel quel dans le digest.
const ACTIONS_STAGE: Record<StageLead, string> = {
  nouveau: "Appeler dans la journée (le lead est chaud) : se présenter, répondre à ses questions, proposer la préinscription ou une visite de campus.",
  contacte: "Relancer par WhatsApp : rappeler la filière évoquée, joindre la fiche du campus (2iae.com/tarifs) et les résultats BTS (2iae.com/resultats-bts-2026), proposer un rendez-vous.",
  relance: "Dernière relance téléphonique : lever la dernière objection (échéancier, internat), proposer une visite. Sans réponse, marquer 'perdu' avec la raison en note.",
  visite: "Rappeler après la visite : recueillir l'impression, proposer de finaliser la préinscription en ligne ensemble.",
  preinscrit: "Finaliser le dossier : vérifier les pièces, expliquer l'échéancier et les moyens de paiement (virement, chèque, Wave, Orange Money).",
  inscrit: "Dossier gagné — rien à faire.",
  perdu: "Dossier clos — rien à faire.",
};

function normaliserTelephone(brut: string | null | undefined): string | null {
  if (!brut) return null;
  let n = brut.replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("225")) n = n.slice(3);
  return n.length >= 8 ? n : null;
}

export function extraireCoordonnees(texte: string): { phone: string | null; email: string | null } {
  const email = texte.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] ?? null;
  const phone = normaliserTelephone(
    texte.replace(/[\s.\-]/g, "").match(/(?:\+?225)?(\d{8,10})/)?.[1] ?? null,
  );
  return { phone, email };
}

function prochaineRelance(stage: StageLead, depuis: Date = new Date()): Date | null {
  const jours = CADENCE_JOURS[stage];
  if (jours === null) return null;
  return new Date(depuis.getTime() + jours * 24 * 60 * 60 * 1000);
}

/**
 * Alerte instantanée à l'équipe dès qu'un lead laisse un moyen de le joindre :
 * WhatsApp (si CallMeBot est configuré) et e-mail, avec le contexte de la
 * conversation et la raison d'appeler vite.
 */
async function alerterNouveauLead(lead: Lead): Promise<void> {
  try {
    // Contexte : les derniers messages laissés par le visiteur dans le chat.
    let contexte = "";
    if (lead.sessionId) {
      const fil = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, lead.sessionId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(3);
      if (fil.length > 0) {
        contexte = fil
          .reverse()
          .map((m) => `« ${m.message.slice(0, 120)} »`)
          .join(" / ");
      }
    }
    if (!contexte && lead.notes) contexte = lead.notes.split("\n").pop() ?? "";

    const identite = [
      lead.name || "Nom non communiqué",
      lead.phone ? `📞 ${lead.phone}` : null,
      lead.email ? `✉️ ${lead.email}` : null,
    ]
      .filter(Boolean)
      .join(" — ");
    const detail = [
      lead.filiere ? `Filière : ${lead.filiere}` : null,
      lead.campus ? `Campus : ${lead.campus}` : null,
      `Source : ${lead.source}`,
    ]
      .filter(Boolean)
      .join(" · ");

    const texte = [
      `🔥 NOUVEAU LEAD 2IAE — À RAPPELER MAINTENANT`,
      ``,
      identite,
      detail,
      contexte ? `Contexte : ${contexte}` : null,
      lead.phone ? `👉 WhatsApp direct : wa.me/225${lead.phone}` : null,
      ``,
      `⏱️ Cette personne vient de laisser ses coordonnées sur le site et le chat lui a promis un rappel rapide : un prospect appelé dans l'heure se préinscrit bien plus souvent qu'un prospect rappelé le lendemain. Après l'appel, notez le résultat dans www.2iae.com/admin/leads pour programmer la suite.`,
    ]
      .filter((l): l is string => l !== null)
      .join("\n");

    void alerterWhatsApp(texte);
    if (emailConfigure()) {
      void envoyerEmail({
        to: DESTINATAIRES.join(","),
        subject: `🔥 Nouveau lead à rappeler — ${lead.name || lead.phone || lead.email || "visiteur du site"}`,
        text: texte,
      });
    }
  } catch (err) {
    console.error("❌ Alerte nouveau lead :", (err as Error).message);
  }
}

export async function initCrm(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS leads (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    phone TEXT,
    email TEXT,
    source TEXT NOT NULL DEFAULT 'chatbot',
    session_id TEXT,
    campus TEXT,
    filiere TEXT,
    stage TEXT NOT NULL DEFAULT 'nouveau',
    notes TEXT,
    next_follow_up_at TIMESTAMP,
    last_contact_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE INDEX IF NOT EXISTS leads_phone_idx ON leads (phone)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS leads_session_idx ON leads (session_id)`);
}

/**
 * Crée ou complète un lead. Le dédoublonnage se fait par téléphone normalisé,
 * puis par e-mail, puis par session de chat : les champs vides sont complétés,
 * jamais écrasés, et une note est ajoutée à l'historique.
 */
export async function upsertLead(entree: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string;
  sessionId?: string | null;
  campus?: string | null;
  filiere?: string | null;
  note?: string | null;
  stage?: StageLead;
}): Promise<Lead | null> {
  const phone = normaliserTelephone(entree.phone);
  const email = entree.email?.trim().toLowerCase() || null;
  const sessionId = entree.sessionId || null;
  if (!phone && !email && !sessionId) return null;

  const criteres = [
    phone ? eq(leads.phone, phone) : null,
    email ? eq(leads.email, email) : null,
    sessionId ? eq(leads.sessionId, sessionId) : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null);

  const existants = await db
    .select()
    .from(leads)
    .where(criteres.length === 1 ? criteres[0] : or(...criteres))
    .orderBy(desc(leads.createdAt))
    .limit(1);

  const horodatage = new Date().toLocaleString("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "short",
    timeStyle: "short",
  });

  if (existants.length > 0) {
    const lead = existants[0];
    const nouvellesNotes = entree.note
      ? `${lead.notes ? lead.notes + "\n" : ""}[${horodatage}] ${entree.note}`
      : lead.notes;
    // Un lead déjà « perdu » qui revient vers nous redevient actif.
    const stage =
      entree.stage && entree.stage !== lead.stage
        ? entree.stage
        : lead.stage === "perdu"
          ? ("nouveau" as StageLead)
          : (lead.stage as StageLead);
    const [maj] = await db
      .update(leads)
      .set({
        name: lead.name || entree.name || null,
        phone: lead.phone || phone,
        email: lead.email || email,
        sessionId: lead.sessionId || sessionId,
        campus: lead.campus || entree.campus || null,
        filiere: lead.filiere || entree.filiere || null,
        stage,
        notes: nouvellesNotes,
        nextFollowUpAt:
          stage !== lead.stage ? prochaineRelance(stage) : lead.nextFollowUpAt,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id))
      .returning();
    // Si le lead vient seulement d'obtenir un moyen de le joindre (le chat
    // avait créé la fiche sans téléphone), l'équipe est alertée maintenant.
    if (!lead.phone && !lead.email && (maj.phone || maj.email)) {
      void alerterNouveauLead(maj);
    }
    return maj;
  }

  const stage = entree.stage ?? "nouveau";
  const [cree] = await db
    .insert(leads)
    .values({
      name: entree.name || null,
      phone,
      email,
      source: entree.source ?? "chatbot",
      sessionId,
      campus: entree.campus || null,
      filiere: entree.filiere || null,
      stage,
      notes: entree.note ? `[${horodatage}] ${entree.note}` : null,
      nextFollowUpAt: prochaineRelance(stage),
    })
    .returning();
  console.log(`🎯 Nouveau lead (${cree.source}) : ${cree.phone ?? cree.email ?? cree.sessionId}`);
  if (cree.phone || cree.email) void alerterNouveauLead(cree);
  return cree;
}

/** Change d'étape : recalcule la prochaine relance et date le contact. */
export async function changerStage(
  id: string,
  stage: StageLead,
  note?: string | null,
): Promise<Lead | undefined> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) return undefined;
  const horodatage = new Date().toLocaleString("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "short",
    timeStyle: "short",
  });
  const contactEffectif = ["contacte", "relance", "visite", "preinscrit", "inscrit"].includes(stage);
  const [maj] = await db
    .update(leads)
    .set({
      stage,
      lastContactAt: contactEffectif ? new Date() : lead.lastContactAt,
      nextFollowUpAt: prochaineRelance(stage),
      notes: note
        ? `${lead.notes ? lead.notes + "\n" : ""}[${horodatage}] ${note}`
        : lead.notes,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id))
    .returning();
  return maj;
}

/** Détecte un contact laissé dans un message du chat et alimente le pipeline. */
export async function traiterMessageChat(sessionId: string, message: string): Promise<void> {
  try {
    const { phone, email } = extraireCoordonnees(message);
    if (!phone && !email) return;
    await upsertLead({
      phone,
      email,
      source: "chatbot",
      sessionId,
      note: `Coordonnées laissées dans le chat : « ${message.slice(0, 160)} »`,
    });
  } catch (err) {
    console.error("❌ CRM (chat) :", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Digest quotidien : la « to-do » commerciale du jour pour les admissions.
// ---------------------------------------------------------------------------

const LIBELLES: Record<StageLead, string> = {
  nouveau: "🔥 NOUVEAUX LEADS — à appeler aujourd'hui",
  contacte: "📲 RELANCES WhatsApp (contactés il y a 3 jours)",
  relance: "☎️ DERNIÈRES RELANCES avant clôture",
  visite: "🏫 APRÈS-VISITE — à rappeler",
  preinscrit: "📋 PRÉINSCRITS — dossiers à finaliser",
  inscrit: "",
  perdu: "",
};

function ligneLead(l: Lead): string {
  const morceaux = [
    l.name || "(nom inconnu)",
    l.phone ? `📞 ${l.phone}` : null,
    l.email ? `✉️ ${l.email}` : null,
    l.filiere ? `filière : ${l.filiere}` : null,
    l.campus ? `campus : ${l.campus}` : null,
    `source : ${l.source}`,
  ].filter(Boolean);
  const note = l.notes ? `\n    Dernière note : ${l.notes.split("\n").pop()}` : "";
  return `  • ${morceaux.join(" — ")}${note}`;
}

export async function composerDigest(): Promise<string | null> {
  const maintenant = new Date();
  const dus = await db
    .select()
    .from(leads)
    .where(and(isNotNull(leads.nextFollowUpAt), lte(leads.nextFollowUpAt, maintenant)))
    .orderBy(leads.nextFollowUpAt);
  if (dus.length === 0) return null;

  const parStage = new Map<StageLead, Lead[]>();
  for (const l of dus) {
    const s = l.stage as StageLead;
    if (!parStage.has(s)) parStage.set(s, []);
    parStage.get(s)!.push(l);
  }

  const [compteurs] = await db
    .select({
      total: dsql<number>`count(*)::int`,
      inscrits: dsql<number>`count(*) filter (where stage = 'inscrit')::int`,
      preinscrits: dsql<number>`count(*) filter (where stage = 'preinscrit')::int`,
    })
    .from(leads);

  const sections: string[] = [
    `SUIVI COMMERCIAL 2IAE — ${maintenant.toLocaleDateString("fr-FR", { timeZone: "Africa/Abidjan", dateStyle: "full" })}`,
    ``,
    `${dus.length} action(s) à mener aujourd'hui. Pipeline : ${compteurs.total} lead(s) au total, dont ${compteurs.preinscrits} préinscrit(s) et ${compteurs.inscrits} inscrit(s).`,
    `Gestion du pipeline : www.2iae.com/admin/leads`,
  ];

  for (const stage of ["nouveau", "preinscrit", "visite", "contacte", "relance"] as StageLead[]) {
    const groupe = parStage.get(stage);
    if (!groupe || groupe.length === 0) continue;
    sections.push(``, `${LIBELLES[stage]} (${groupe.length})`, `Action : ${ACTIONS_STAGE[stage]}`, ``);
    sections.push(...groupe.map(ligneLead));
  }

  sections.push(
    ``,
    `Rappel de la méthode : appeler un nouveau lead dans l'heure multiplie les chances de conversion. Après chaque action, mettre à jour l'étape du lead dans l'admin pour que la prochaine relance se programme toute seule.`,
  );
  return sections.join("\n");
}

/** Vérifie chaque heure ; envoie le digest une fois par jour vers 8 h (Abidjan). */
export function demarrerDigestLeads(): void {
  const verifier = async () => {
    try {
      if (!emailConfigure()) return;
      const heure = parseInt(
        new Date().toLocaleString("fr-FR", { timeZone: "Africa/Abidjan", hour: "2-digit", hour12: false }),
        10,
      );
      if (heure < 8) return;
      const jour = new Date().toLocaleDateString("fr-CA", { timeZone: "Africa/Abidjan" });
      const MARQUE = `crm-digest-${jour}`;
      const vu = await pool.query(`SELECT 1 FROM _migrations WHERE name = $1`, [MARQUE]);
      if ((vu.rowCount ?? 0) > 0) return;
      const digest = await composerDigest();
      if (!digest) {
        await pool.query(`INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [MARQUE]);
        return;
      }
      const ok = await envoyerEmail({
        to: DESTINATAIRES.join(","),
        subject: `Suivi commercial 2IAE — actions du jour`,
        text: digest,
      });
      if (ok) {
        await pool.query(`INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [MARQUE]);
        console.log("📮 Digest CRM du jour envoyé.");
      }
    } catch (err) {
      console.error("❌ Digest CRM :", (err as Error).message);
    }
  };
  setTimeout(verifier, 60_000);
  setInterval(verifier, 60 * 60 * 1000);
}

export async function demarrerCrm(): Promise<void> {
  try {
    await initCrm();
    demarrerDigestLeads();
    console.log("🎯 CRM leads initialisé.");
  } catch (err) {
    console.error("❌ Init CRM :", (err as Error).message);
  }
}
