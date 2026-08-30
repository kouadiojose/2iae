// Alertes WhatsApp instantanées vers l'équipe des admissions, via CallMeBot
// (passerelle gratuite : chaque numéro destinataire l'active une fois en
// envoyant « I allow callmebot to send me messages » au numéro CallMeBot,
// puis reçoit sa clé API personnelle).
//
// Configuration : WHATSAPP_ALERTES="2250747726729:cleApi1,2250584249090:cleApi2"
// Sans configuration, l'envoi est ignoré silencieusement — l'alerte e-mail
// instantanée prend le relais dans tous les cas.

type Cible = { numero: string; cle: string };

function cibles(): Cible[] {
  return (process.env.WHATSAPP_ALERTES || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const [numero, cle] = c.split(":").map((x) => x.trim());
      return numero && cle ? { numero: numero.replace(/\D/g, ""), cle } : null;
    })
    .filter((c): c is Cible => c !== null);
}

export function whatsappConfigure(): boolean {
  return cibles().length > 0;
}

/** Envoie le texte à tous les numéros configurés. Ne lève jamais. */
export async function alerterWhatsApp(texte: string): Promise<number> {
  let envoyes = 0;
  for (const { numero, cle } of cibles()) {
    try {
      const url =
        `https://api.callmebot.com/whatsapp.php?phone=${numero}` +
        `&apikey=${encodeURIComponent(cle)}&text=${encodeURIComponent(texte)}`;
      const rep = await fetch(url);
      if (rep.ok) {
        envoyes++;
      } else {
        console.error(`❌ WhatsApp (${numero}) : HTTP ${rep.status}`);
      }
    } catch (err) {
      console.error(`❌ WhatsApp (${numero}) :`, (err as Error).message);
    }
  }
  if (envoyes > 0) console.log(`📲 Alerte WhatsApp envoyée à ${envoyes} numéro(s).`);
  return envoyes;
}
