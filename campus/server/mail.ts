// E-mails (Resend, comme le site). Sans RESEND_API_KEY, l'envoi est ignoré :
// le campus ne doit jamais échouer parce que l'e-mail est indisponible.
import { config } from "./config";

export async function envoyerEmail(o: { a: string; sujet: string; texte: string; html?: string }): Promise<boolean> {
  if (!config.mail.resendCle || !o.a) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.mail.resendCle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.mail.expediteur, to: [o.a], subject: o.sujet, text: o.texte, html: o.html }),
    });
    if (!r.ok) console.error("[mail] Resend :", r.status, await r.text().catch(() => ""));
    return r.ok;
  } catch (e) {
    console.error("[mail] envoi impossible :", (e as Error).message);
    return false;
  }
}
