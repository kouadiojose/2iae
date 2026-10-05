// Transcription des enregistrements de cours : quand le replay d'une séance est
// prêt et qu'aucune transcription n'a été prise pendant le direct, le campus
// demande au service de Daily (Batch Processor) de transcrire la vidéo, morceau
// par morceau, puis range le texte minuté dans les sous-titres de la séance.
// La transcription sert au replay (texte à lire et à chercher) et au cours
// complet préparé ensuite (etude-cours.ts).
import { and, asc, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "./db";
import * as visio from "./visio";
import { lienReplayBucket, stockageReplaysDisponible } from "./stockage-replays";
import { directsImmediats, morceauxReplay, replaysStockes, seances, sousTitres, transcriptionsReplays } from "@shared/schema";

/** On ne transcrit que les séances des 90 derniers jours. */
const FENETRE_JOURS = 90;
/** Une transcription qui n'aboutit pas en 12 h est abandonnée. */
const DELAI_MAX_MS = 12 * 3600_000;

/** Séances terminées, enregistrées, sans transcription (ni du direct, ni demandée). */
async function seancesATranscrire(limite: number) {
  return db
    .select({ id: seances.id, enregistrementId: seances.enregistrementId })
    .from(seances)
    .where(
      and(
        eq(seances.statut, "terminee"),
        isNotNull(seances.enregistrementId),
        gte(seances.debut, new Date(Date.now() - FENETRE_JOURS * 24 * 3600_000)),
        sql`NOT EXISTS (SELECT 1 FROM ${sousTitres} st WHERE st.seance_id = ${seances.id})`,
        sql`NOT EXISTS (SELECT 1 FROM ${transcriptionsReplays} tr WHERE tr.seance_id = ${seances.id})`,
        sql`NOT EXISTS (SELECT 1 FROM ${directsImmediats} di WHERE di.seance_id = ${seances.id} AND NOT di.prevenir)`,
      ),
    )
    .orderBy(desc(seances.debut))
    .limit(limite);
}

/** Source de la vidéo d'un morceau : chez Daily tant qu'il y est, sinon la copie du bucket des replays. */
async function sourceDe(enregistrementId: string, forcerBucket = false): Promise<{ recordingId: string } | { uri: string }> {
  const [copie] = await db.select().from(replaysStockes).where(eq(replaysStockes.enregistrementId, enregistrementId));
  if (copie && (copie.dailySupprimeLe || forcerBucket) && stockageReplaysDisponible()) {
    return { uri: (await lienReplayBucket(copie.cle, 24 * 3600)).url };
  }
  return { recordingId: enregistrementId };
}

/** Transcriptions en échec depuis plus de 24 h : nouvel essai (quatre au plus), avec la copie du bucket si elle existe. */
async function reessayerEchecs(): Promise<void> {
  const echecs = await db
    .select()
    .from(transcriptionsReplays)
    .where(and(eq(transcriptionsReplays.statut, "erreur"), lt(transcriptionsReplays.essais, 4), lt(transcriptionsReplays.fin, new Date(Date.now() - 24 * 3600_000))))
    .limit(3);
  for (const tr of echecs) {
    try {
      const travailId = await visio.soumettreTranscriptionDaily(await sourceDe(tr.enregistrementId, true));
      await db
        .update(transcriptionsReplays)
        .set({ travailId, statut: "soumise", essais: tr.essais + 1, debut: new Date(), fin: null })
        .where(eq(transcriptionsReplays.enregistrementId, tr.enregistrementId));
    } catch (e) {
      await db
        .update(transcriptionsReplays)
        .set({ essais: tr.essais + 1, fin: new Date(), message: (e as Error).message.slice(0, 300) })
        .where(eq(transcriptionsReplays.enregistrementId, tr.enregistrementId));
    }
  }
}

/** Demande la transcription des enregistrements qui n'en ont pas (deux séances à la fois au plus). */
export async function soumettreTranscriptions(): Promise<void> {
  if (!visio.dailyDisponible()) return;
  await reessayerEchecs();
  for (const s of await seancesATranscrire(2)) {
    const morceaux = await db.select().from(morceauxReplay).where(eq(morceauxReplay.seanceId, s.id)).orderBy(asc(morceauxReplay.numero));
    const pieces = morceaux.length
      ? morceaux.map((m) => ({ id: m.enregistrementId, numero: m.numero, decalage: Math.max(0, Math.round((m.debut.getTime() - morceaux[0].debut.getTime()) / 1000)) }))
      : [{ id: s.enregistrementId!, numero: 1, decalage: 0 }];
    for (const p of pieces) {
      try {
        const travailId = await visio.soumettreTranscriptionDaily(await sourceDe(p.id));
        await db
          .insert(transcriptionsReplays)
          .values({ enregistrementId: p.id, seanceId: s.id, numero: p.numero, decalageSecondes: p.decalage, travailId, statut: "soumise", essais: 1 })
          .onConflictDoNothing();
        console.log(`[transcription] séance ${s.id}, morceau ${p.numero} : demandée (${travailId})`);
      } catch (e) {
        await db
          .insert(transcriptionsReplays)
          .values({ enregistrementId: p.id, seanceId: s.id, numero: p.numero, decalageSecondes: p.decalage, statut: "erreur", essais: 1, message: (e as Error).message.slice(0, 300), fin: new Date() })
          .onConflictDoNothing();
        console.warn(`[transcription] séance ${s.id}, morceau ${p.numero} : demande refusée :`, (e as Error).message);
      }
    }
  }
}

// ── Lecture du fichier de sous-titres (WebVTT) ─────────────────────────────

const secondesDe = (horodatage: string) => {
  const parties = horodatage.trim().split(":").map(Number);
  return parties.reduce((t, x) => t * 60 + x, 0);
};

/** Répliques d'un fichier WebVTT, regroupées en phrases d'environ 240 caractères. */
export function lireVtt(vtt: string): { t: number; texte: string }[] {
  const repliques: { t: number; texte: string }[] = [];
  for (const bloc of vtt.replace(/\r/g, "").split(/\n\n+/)) {
    const lignes = bloc.split("\n");
    const i = lignes.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const debut = secondesDe(lignes[i].split("-->")[0]);
    const texte = lignes
      .slice(i + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (texte && Number.isFinite(debut)) repliques.push({ t: debut, texte });
  }
  const groupes: { t: number; texte: string }[] = [];
  for (const r of repliques) {
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.texte.length < 240 && r.t - dernier.t < 60) dernier.texte = `${dernier.texte} ${r.texte}`;
    else groupes.push({ ...r });
  }
  return groupes;
}

async function lireTexteDistant(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

/** Suit les transcriptions demandées ; range dans les sous-titres celles qui sont terminées. */
export async function suivreTranscriptions(): Promise<void> {
  if (!visio.dailyDisponible()) return;
  const enAttente = await db.select().from(transcriptionsReplays).where(eq(transcriptionsReplays.statut, "soumise")).limit(20);
  for (const tr of enAttente) {
    if (!tr.travailId) continue;
    try {
      const etat = await visio.etatTranscriptionDaily(tr.travailId);
      if (etat.statut === "finished") {
        const liens = await visio.liensTranscriptionDaily(tr.travailId);
        const vtt = liens.find((l) => l.format === "vtt");
        const txt = liens.find((l) => l.format === "txt");
        let lignes = vtt ? lireVtt((await lireTexteDistant(vtt.link)) ?? "") : [];
        if (!lignes.length && txt) {
          // Sans minutage : le texte est réparti régulièrement sur la durée du morceau.
          const brut = (await lireTexteDistant(txt.link)) ?? "";
          const phrases = brut.split(/(?<=[.!?])\s+/).filter(Boolean);
          lignes = phrases.map((p, i) => ({ t: Math.round((i / Math.max(1, phrases.length)) * 3600), texte: p }));
        }
        if (lignes.length) {
          await db.insert(sousTitres).values(lignes.map((l) => ({ seanceId: tr.seanceId, t: Math.round(l.t + tr.decalageSecondes), texte: l.texte.slice(0, 2000) })));
        }
        await db
          .update(transcriptionsReplays)
          .set({ statut: "terminee", fin: new Date(), message: lignes.length ? null : "Transcription vide (enregistrement silencieux ?)." })
          .where(eq(transcriptionsReplays.enregistrementId, tr.enregistrementId));
        console.log(`[transcription] séance ${tr.seanceId}, morceau ${tr.numero} : ${lignes.length} lignes`);
      } else if (etat.statut === "error") {
        // Premier échec avec l'identifiant Daily : nouvel essai avec la copie du bucket.
        if (tr.essais < 2) {
          const travailId = await visio.soumettreTranscriptionDaily(await sourceDe(tr.enregistrementId, true));
          await db
            .update(transcriptionsReplays)
            .set({ travailId, essais: tr.essais + 1, debut: new Date(), message: etat.erreur?.slice(0, 300) ?? null })
            .where(eq(transcriptionsReplays.enregistrementId, tr.enregistrementId));
        } else {
          await db
            .update(transcriptionsReplays)
            .set({ statut: "erreur", fin: new Date(), message: (etat.erreur ?? "Échec de la transcription.").slice(0, 300) })
            .where(eq(transcriptionsReplays.enregistrementId, tr.enregistrementId));
        }
      } else if (Date.now() - tr.debut.getTime() > DELAI_MAX_MS) {
        await db
          .update(transcriptionsReplays)
          .set({ statut: "erreur", fin: new Date(), message: "La transcription n'a pas abouti en 12 heures." })
          .where(eq(transcriptionsReplays.enregistrementId, tr.enregistrementId));
      }
    } catch (e) {
      console.warn(`[transcription] suivi de la séance ${tr.seanceId} :`, (e as Error).message);
    }
  }
}

/** Où en est la transcription d'une séance : « aucune », « en_cours », « terminee » (tous les morceaux), « erreur ». */
export async function etatTranscription(seanceId: number): Promise<"aucune" | "en_cours" | "terminee" | "erreur"> {
  const lignes = await db.select({ statut: transcriptionsReplays.statut }).from(transcriptionsReplays).where(eq(transcriptionsReplays.seanceId, seanceId));
  if (!lignes.length) return "aucune";
  if (lignes.some((l) => l.statut === "soumise")) return "en_cours";
  if (lignes.every((l) => l.statut === "erreur")) return "erreur";
  return "terminee";
}

/**
 * Recommence la transcription d'une séance (bouton du personnel) : les
 * sous-titres qu'elle avait produits sont retirés, la demande repart au
 * prochain passage de la tâche. Sans transcription demandée (sous-titres pris
 * pendant le direct), rien n'est touché.
 */
export async function relancerTranscription(seanceId: number): Promise<void> {
  const lignes = await db.select({ id: transcriptionsReplays.enregistrementId }).from(transcriptionsReplays).where(eq(transcriptionsReplays.seanceId, seanceId));
  if (!lignes.length) return;
  await db.transaction(async (tx) => {
    await tx.delete(sousTitres).where(eq(sousTitres.seanceId, seanceId));
    await tx.delete(transcriptionsReplays).where(eq(transcriptionsReplays.seanceId, seanceId));
  });
}
