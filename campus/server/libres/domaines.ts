// Rangement des livres de l'index dans les rayons du portail, d'après la
// classification de la Bibliothèque du Congrès quand la source la donne
// (Project Gutenberg) et d'après les sujets et le titre (en français et en
// anglais) sinon.
import type { DomaineLibre } from "@shared/schema";
import { normaliser } from "../catalogues";

/** Minuscules sans accents, ligatures dépliées (« Œuvres » → « oeuvres »). */
export const normaliserIndex = (t: string) => normaliser(t.replace(/œ/g, "oe").replace(/Œ/g, "Oe").replace(/æ/g, "ae").replace(/Æ/g, "Ae").replace(/ß/g, "ss"));

// Mots-clés : « econom* » = mot qui commence par « econom », sinon mot entier.
const MOTS: Record<DomaineLibre, string> = {
  gestion:
    "management gestion entreprise* business* leadership organisation* organization* entrepreneur* administration* manager* ressources humaines human resources personnel office secretar* strategie* strategy",
  compta_finance:
    "comptab* accounting accountant* bookkeeping audit* finance* financ* banque* bank* banking monnaie* money monetary credit assurance* insurance investment* investissement* bourse stock exchange fiscal* impot* tax taxation",
  economie:
    "econom* development developpement croissance growth poverty pauvrete trade labor labour travail emploi employment industrie* industry industries prix prices inflation macroeconom* microeconom* commerce international",
  marketing: "marketing publicite* advertising vente* selling salesmanship consommat* consumer* commerce commercial* retail distribution",
  droit: "droit law laws legal juridique* jurisprudence constitution* code civil contrat* contract* justice legislation* tribunal* lawyer*",
  informatique:
    "informatique computer* ordinateur* programming programmation software logiciel* internet numerique digital data donnees intelligence artificielle artificial algorithm* python java web cybersecurity",
  agriculture:
    "agricult* agronom* farming farm farms farmer* elevage livestock crops culture cultures horticult* jardinage gardening soil soils irrigation foret forest* forestry peche fisheries fishery environnement environment* climat climate ecolog* agroecolog* cacao cocoa cafe coffee",
  afrique:
    "afrique africa african* africain* ivoire ivoirien* ivory senegal* mali burkina ghana nigeria cameroun cameroon congo guinee guinea benin togo niger sahel madagascar kenya ethiopi* maroc morocco algerie algeria tunisie tunisia egypt* gabon tchad chad rwanda uganda tanzania zambia zimbabwe angola mozambique soudan sudan mauritani*",
  sciences:
    "mathemat* physique physics chimie chemistry biolog* statisti* science sciences astronom* geolog* botan* zoolog* algebra algebre geometr* calculus",
  techniques: "engineering ingenierie mecanique mechanic* electric* electri* construction batiment building* technolog* manufactur* machine* energy energie",
  sante: "medecine medicine medical sante health hygiene nursing soins maladie* disease* pharmac* nutrition anatom* surgery chirurgie",
  societe:
    "histoire history historical politique politics political sociolog* societe society social geograph* anthropolog* guerre war colonial* colonisation civilisation civilization",
  philosophie: "philosoph* ethique ethics morale moral religion* theolog* bible islam* christian* chretien* spiritual*",
  education: "education pedagog* enseignement teaching ecole school schools apprentissage learning",
  langues: "grammaire grammar dictionnaire* dictionary dictionaries vocabula* linguisti* orthographe conjugaison phonetic* language languages",
  litterature:
    "fiction roman romans novel novels poesie poetry poems poemes poete* theatre drama plays contes tales stories nouvelles litterature literature fables comedie comedy tragedie tragedy",
  arts: "musique music peinture painting art arts architecture photograph* cinema design sculpture dessin drawing",
};

const MOTIFS = Object.fromEntries(
  Object.entries(MOTS).map(([d, liste]) => {
    const parties = liste.split(/\s+/).map((m) => (m.endsWith("*") ? `${m.slice(0, -1)}[a-z0-9]*` : m));
    return [d, new RegExp(`(?:^| )(?:${parties.join("|")})(?= |$)`)];
  }),
) as Record<DomaineLibre, RegExp>;

/** Classification de la Bibliothèque du Congrès (deux premières lettres) → rayons. */
function parCote(cote: string): DomaineLibre[] {
  const c = cote.trim().toUpperCase();
  if (!c) return [];
  const l = c[0];
  const deux = c.slice(0, 2);
  if (deux === "HB" || deux === "HC" || deux === "HD" || deux === "HE" || deux === "HJ") return ["economie"];
  if (deux === "HF") return ["marketing", "gestion"];
  if (deux === "HG") return ["compta_finance"];
  if (deux === "HA") return ["sciences"];
  if (l === "H") return ["societe"];
  if (deux === "JX" || deux === "JZ") return ["droit", "societe"];
  if (l === "K") return ["droit"];
  if (l === "J" || l === "D" || l === "E" || l === "F" || l === "C") return ["societe"];
  if (l === "G") return deux === "GV" ? ["arts"] : ["societe"];
  if (l === "Q") return ["sciences"];
  if (l === "R") return ["sante"];
  if (l === "S") return ["agriculture"];
  if (l === "T") return ["techniques"];
  if (l === "B") return ["philosophie"];
  if (l === "L") return ["education"];
  if (l === "M" || l === "N") return ["arts"];
  if (["PB", "PC", "PD", "PE", "PF", "PG", "PM"].includes(deux) || c === "P") return ["langues"];
  if (l === "P") return ["litterature"];
  return [];
}

/** Rayons d'un livre (au plus quatre), d'après sa cote, ses sujets et son titre. */
export function domainesDe(o: { cotes?: string; sujets: string; titre: string }): DomaineLibre[] {
  const trouves = new Set<DomaineLibre>();
  for (const cote of (o.cotes ?? "").split(/[;,]/)) for (const d of parCote(cote)) trouves.add(d);
  const sujets = ` ${normaliserIndex(o.sujets)} `;
  const titre = ` ${normaliserIndex(o.titre)} `;
  for (const [d, re] of Object.entries(MOTIFS) as [DomaineLibre, RegExp][]) {
    if (re.test(sujets)) trouves.add(d);
    // Le titre seul ne range pas en littérature (« L'art de la guerre » n'est pas un roman).
    else if (d !== "litterature" && d !== "arts" && re.test(titre)) trouves.add(d);
  }
  return [...trouves].slice(0, 4);
}

/** Code de langue à deux lettres (« fre », « French », « fr_FR » → « fr »). */
export function codeLangue(v: string | null | undefined): string | null {
  const t = (v ?? "").trim().toLowerCase();
  if (!t) return null;
  const table: Record<string, string> = {
    fre: "fr", fra: "fr", french: "fr", francais: "fr", "français": "fr",
    eng: "en", english: "en", anglais: "en",
    spa: "es", spanish: "es", espanol: "es", "español": "es",
    por: "pt", portuguese: "pt",
    ger: "de", deu: "de", german: "de",
    ita: "it", italian: "it",
    lat: "la", latin: "la",
    dut: "nl", nld: "nl", dutch: "nl",
    ara: "ar", arabic: "ar",
  };
  if (table[t]) return table[t];
  const m = t.match(/^([a-z]{2})(?:[_-]|$)/);
  return m ? m[1] : null;
}

/** Texte de recherche : le titre compte double. */
export function texteRecherche(o: { titre: string; autresTitres?: string[]; auteurs: string; sujets: string }): string {
  return normaliserIndex([o.titre, o.titre, ...(o.autresTitres ?? []), o.auteurs, o.sujets].join(" ")).slice(0, 4000);
}

/** Texte sans balises HTML ni blancs en rafale, coupé proprement. */
export function texteSimple(html: string | null | undefined, max = 700): string | null {
  if (!html) return null;
  const t = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const coupe = t.slice(0, max);
  return `${coupe.slice(0, Math.max(coupe.lastIndexOf(" "), max - 40))}…`;
}
