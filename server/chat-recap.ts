// Récapitulatif par e-mail des conversations du chatbot : quand une session
// reste inactive assez longtemps, le fil complet est envoyé aux admissions.
// Deux mécanismes se complètent : un minuteur par session (remis à zéro à
// chaque message) et un balayage périodique qui rattrape les sessions dont le
// minuteur a été perdu lors d'un redéploiement.
import { pool } from "./db";
import { storage } from "./storage";
import { envoyerEmail, emailConfigure } from "./mail";

const INACTIVITE_MS = 10 * 60 * 1000; // silence après lequel la discussion est close
const BALAYAGE_MS = 5 * 60 * 1000;

const DESTINATAIRES = (process.env.CONTACT_EMAIL || "ptchimou92@gmail.com,skoua2000@yahoo.fr,kouadiojose@gmail.com")
  .split(",")
  .map((a) => a.trim())
  .filter(Boolean);

const minuteries = new Map<string, NodeJS.Timeout>();

/** À appeler après chaque échange : (re)programme le récap de la session. */
export function planifierRecap(sessionId: string): void {
  const existante = minuteries.get(sessionId);
  if (existante) clearTimeout(existante);
  minuteries.set(
    sessionId,
    setTimeout(() => {
      minuteries.delete(sessionId);
      void envoyerRecapSession(sessionId);
    }, INACTIVITE_MS),
  );
}

/** Repère un numéro de téléphone laissé par le visiteur (8 chiffres et plus). */
function chercherTelephone(textes: string[]): string | null {
  for (const t of textes) {
    const m = t.replace(/[\s.\-]/g, "").match(/(?:\+?225)?(\d{8,10})/);
    if (m) return m[1];
  }
  return null;
}

async function envoyerRecapSession(sessionId: string): Promise<void> {
  if (!emailConfigure()) return;
  try {
    const messages = await storage.getChatMessages(sessionId);
    if (messages.length === 0) return;

    const dernier = messages[messages.length - 1].createdAt ?? new Date();
    const premier = messages[0].createdAt ?? dernier;

    // Ne pas renvoyer un récap déjà couvert (le balayage et le minuteur
    // peuvent viser la même session).
    const vu = await pool.query(
      `SELECT last_message_at FROM chat_recaps WHERE session_id = $1`,
      [sessionId],
    );
    if (
      (vu.rowCount ?? 0) > 0 &&
      vu.rows[0].last_message_at &&
      new Date(vu.rows[0].last_message_at) >= dernier
    ) {
      return;
    }

    const telephone = chercherTelephone(messages.map((m) => m.message));
    const dateFr = (d: Date) =>
      d.toLocaleString("fr-FR", { timeZone: "Africa/Abidjan", dateStyle: "short", timeStyle: "short" });

    const fil = messages
      .map((m) => `👤 Visiteur :\n${m.message}\n\n🤖 Assistant :\n${m.response}`)
      .join("\n\n————————————\n\n");

    const sujet =
      `Chat du site — ${messages.length} échange${messages.length > 1 ? "s" : ""}` +
      (telephone ? ` — numéro laissé : ${telephone}` : "");

    const texte = [
      `Récapitulatif d'une conversation avec l'assistant du site www.2iae.com`,
      ``,
      `Début : ${dateFr(premier)} — dernier message : ${dateFr(dernier)} (heure d'Abidjan)`,
      telephone ? `📞 Numéro repéré dans la conversation : ${telephone}` : `(Aucun numéro de téléphone laissé dans la conversation.)`,
      ``,
      `============================`,
      ``,
      fil,
    ].join("\n");

    const ok = await envoyerEmail({ to: DESTINATAIRES.join(","), subject: sujet, text: texte });
    if (ok) {
      await pool.query(
        `INSERT INTO chat_recaps (session_id, last_message_at, sent_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (session_id) DO UPDATE SET last_message_at = $2, sent_at = NOW()`,
        [sessionId, dernier],
      );
      console.log(`📮 Récap chat envoyé (${sessionId}, ${messages.length} échanges)`);
    }
  } catch (err) {
    console.error("❌ Récap chat :", (err as Error).message);
  }
}

/**
 * Initialise la table de suivi puis lance le balayage périodique. Au tout
 * premier passage, les conversations antérieures sont marquées comme déjà
 * traitées pour ne pas inonder la boîte des admissions avec l'historique.
 */
export async function demarrerRecapsChat(): Promise<void> {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS chat_recaps (
      session_id TEXT PRIMARY KEY,
      last_message_at TIMESTAMP,
      sent_at TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    const MARQUE = "chat-recaps-init";
    const vu = await pool.query(`SELECT 1 FROM _migrations WHERE name = $1`, [MARQUE]);
    if ((vu.rowCount ?? 0) === 0) {
      await pool.query(
        `INSERT INTO chat_recaps (session_id, last_message_at, sent_at)
         SELECT session_id, MAX(created_at), NOW() FROM chat_messages GROUP BY session_id
         ON CONFLICT (session_id) DO NOTHING`,
      );
      await pool.query(`INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [MARQUE]);
      console.log("📮 Récaps chat : historique existant marqué comme traité.");
    }
  } catch (err) {
    console.error("❌ Init récaps chat :", (err as Error).message);
    return;
  }

  setInterval(async () => {
    try {
      const aTraiter = await pool.query(
        `SELECT m.session_id
           FROM chat_messages m
           LEFT JOIN chat_recaps r ON r.session_id = m.session_id
          GROUP BY m.session_id, r.last_message_at
         HAVING MAX(m.created_at) < NOW() - INTERVAL '10 minutes'
            AND (r.last_message_at IS NULL OR MAX(m.created_at) > r.last_message_at)
          LIMIT 20`,
      );
      for (const ligne of aTraiter.rows) {
        await envoyerRecapSession(ligne.session_id);
      }
    } catch (err) {
      console.error("❌ Balayage récaps chat :", (err as Error).message);
    }
  }, BALAYAGE_MS);
}
