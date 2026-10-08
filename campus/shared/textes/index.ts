// Couche de textes du campus, commune au serveur et au client (aucune dépendance).
//
// Chaque chantier du plan d'engagement range ses textes (écrans, rappels,
// e-mails) dans son dictionnaire, shared/textes/<chantier>.ts :
//
//   export const t = creerTextes({
//     "carte.titre": { tu: "Ta révision du jour", vous: "Votre révision du jour" },
//     "carte.reste": "Encore {n} cartes",
//   });
//
// puis l'emploie avec le registre de la personne : t("carte.titre", { registre: registreDe(u.role) })
// côté serveur, useTextes(t) côté client (lib/textes.ts). Étudiants tutoyés, personnel vouvoyé ;
// on écrit « rappel », jamais « notification push ». L'anglais viendra par le second argument de
// creerTextes : une clé qu'il n'a pas retombe sur le français. Voir campus/ENGAGEMENT.md.

export type Langue = "fr" | "en";
export type Registre = "tu" | "vous";
/** Un texte : le même pour tous, ou une forme tutoyée et une forme vouvoyée. */
export type Texte = string | { tu: string; vous: string };
export type Variables = Record<string, string | number>;
export type OptionsTexte = {
  /** Sans registre, le vouvoiement : le plus prudent quand on ne sait pas à qui l'on parle. */
  registre?: Registre;
  langue?: Langue;
  /** Valeurs des variables du texte : { n: 3 } remplace « {n} ». */
  v?: Variables;
};
export type Dictionnaire = Record<string, Texte>;
export type Traducteur<C extends string = string> = (cle: C, options?: OptionsTexte) => string;

export const LANGUE_PAR_DEFAUT: Langue = "fr";

/** Les étudiants sont tutoyés, tout autre compte (formateur, équipe, salle) vouvoyé. */
export const registreDe = (role: string | null | undefined): Registre => (role === "etudiant" ? "tu" : "vous");

const possede = (o: object, cle: string) => Object.prototype.hasOwnProperty.call(o, cle);

/** Remplace « {nom} » par sa valeur ; une variable sans valeur reste telle quelle, visible et sans erreur. */
function remplir(modele: string, v?: Variables): string {
  if (!v) return modele;
  return modele.replace(/\{(\w+)\}/g, (tout, nom: string) => (possede(v, nom) ? String(v[nom]) : tout));
}

const clesSignalees = new Set<string>();

/**
 * Traducteur d'un dictionnaire français (la référence : il porte toutes les clés)
 * et, plus tard, de ses traductions. Une clé absente partout est affichée telle
 * quelle, signalée une fois dans la console : l'écran ne casse jamais pour un texte.
 */
export function creerTextes<D extends Dictionnaire>(
  fr: D,
  autres: Partial<Record<Exclude<Langue, "fr">, Partial<Record<keyof D & string, Texte>>>> = {},
): Traducteur<keyof D & string> {
  return (cle, options = {}) => {
    const langue = options.langue ?? LANGUE_PAR_DEFAUT;
    const traduction = langue === "fr" ? undefined : autres[langue];
    const texte: Texte | undefined =
      (traduction && possede(traduction, cle) ? traduction[cle] : undefined) ?? (possede(fr, cle) ? fr[cle] : undefined);
    if (texte === undefined) {
      if (!clesSignalees.has(cle)) {
        clesSignalees.add(cle);
        console.warn(`[textes] clé absente : « ${cle} »`);
      }
      return cle;
    }
    const brut = typeof texte === "string" ? texte : texte[options.registre ?? "vous"];
    return remplir(brut ?? cle, options.v);
  };
}

// ── Dates ──────────────────────────────────────────────────────────────────

export type StyleDate = "jour" | "date" | "court" | "heure" | "jourHeure";
export type OptionsDate = { langue?: Langue; fuseau?: string | null; style?: StyleDate };

/** Le campus vit à l'heure d'Abidjan (GMT, sans heure d'été). */
const FUSEAU_ABIDJAN = "Africa/Abidjan";
const LOCALES: Record<Langue, string> = { fr: "fr-FR", en: "en-GB" };
const FORMATS: Record<StyleDate, Intl.DateTimeFormatOptions> = {
  /** « jeudi 8 octobre » */
  jour: { weekday: "long", day: "numeric", month: "long" },
  /** « 8 octobre 2026 » */
  date: { day: "numeric", month: "long", year: "numeric" },
  /** « 8 oct. » */
  court: { day: "numeric", month: "short" },
  /** « 08h30 » */
  heure: { hour: "2-digit", minute: "2-digit" },
  /** « jeudi 8 octobre à 08h30 » */
  jourHeure: { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" },
};
const formats = new Map<string, Intl.DateTimeFormat>();

function formatDe(langue: Langue, style: StyleDate, fuseau: string): Intl.DateTimeFormat {
  const cle = `${langue}|${style}|${fuseau}`;
  let f = formats.get(cle);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALES[langue], { ...FORMATS[style], timeZone: fuseau });
    formats.set(cle, f);
  }
  return f;
}

/**
 * Date lisible, en français et à l'heure d'Abidjan par défaut (« jeudi 8 octobre »).
 * Un fuseau mal saisi retombe sur Abidjan ; une date invalide donne une chaîne vide.
 * En français, l'heure s'écrit comme partout sur le campus : « 08h30 ».
 */
export function formaterDate(d: Date | string | number, { langue = LANGUE_PAR_DEFAUT, fuseau, style = "jour" }: OptionsDate = {}): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  let f: Intl.DateTimeFormat;
  try {
    f = formatDe(langue, style, fuseau || FUSEAU_ABIDJAN);
  } catch {
    f = formatDe(langue, style, FUSEAU_ABIDJAN);
  }
  const texte = f.format(date);
  return langue === "fr" ? texte.replace(/(\d{2}):(\d{2})/g, "$1h$2") : texte;
}
