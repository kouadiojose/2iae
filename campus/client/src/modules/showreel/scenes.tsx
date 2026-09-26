// Les plans du showreel, un rendu par type. Chaque plan a son animation
// propre (mots qui montent, chiffres qui défilent, glissés, masques) ; les
// délais sont des fractions de la durée du plan : un plan plus court joue la
// même partition, plus vite. Tout le texte est du vrai texte.
import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { FormateurShowreel, PlanShowreel } from "@shared/schema";
import { cn } from "@/lib/utils";
import { heureH, phraseCampus, rendezVous } from "./outils";

export type FormatShowreel = "paysage" | "portrait";

type PropsScene = { plan: PlanShowreel; formateur: FormateurShowreel; format: FormatShowreel };

/** Mesure relative au lecteur (1 u = 1 % de son plus petit côté). */
const u = (n: number) => `calc(var(--u) * ${n})`;
/**
 * Taille de texte relative au lecteur, avec un plancher lisible : dans un petit
 * aperçu (éditeur, fiche sur téléphone), les petites lignes restent lisibles.
 */
const uf = (n: number) => {
  const plancher = n < 4 ? 8.5 : n < 6 ? 10.5 : n < 9 ? 13 : 0;
  return plancher ? `max(${plancher}px, calc(var(--u) * ${n}))` : `calc(var(--u) * ${n})`;
};
/** Délai d'animation en secondes. */
const apres = (s: number, extra?: CSSProperties): CSSProperties => ({ animationDelay: `${Math.max(0, s).toFixed(2)}s`, ...extra });

/** Texte découpé en mots qui montent l'un après l'autre derrière un masque. */
function Mots({ texte, debut, pas = 0.09, doux }: { texte: string; debut: number; pas?: number; doux?: boolean }) {
  const mots = texte.split(/\s+/).filter(Boolean);
  return (
    <>
      {mots.map((m, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          {doux ? (
            <span className="sr-mot-doux" style={apres(debut + i * pas)}>
              {m}
            </span>
          ) : (
            <span className="sr-mot">
              <span style={apres(debut + i * pas)}>{m}</span>
            </span>
          )}
        </Fragment>
      ))}
    </>
  );
}

/** Compteur à rouleaux : chaque chiffre défile avant de s'arrêter sur sa valeur. */
function Compteur({ valeur, debut }: { valeur: string; debut: number }) {
  let rang = 0;
  const nbChiffres = (valeur.match(/\d/g) ?? []).length;
  return (
    <span aria-hidden className="inline-flex whitespace-nowrap">
      {[...valeur].map((c, i) => {
        if (/\d/.test(c)) {
          const k = rang++;
          return (
            <span key={i} className="sr-odo">
              <span className="sr-odo-bande" style={{ "--n": 10 + Number(c), animationDelay: `${(debut + k * 0.12).toFixed(2)}s`, animationDuration: `${1.25 + (nbChiffres - k) * 0.22}s` } as CSSProperties}>
                {Array.from({ length: 20 }, (_, j) => (
                  <span key={j}>{j % 10}</span>
                ))}
              </span>
            </span>
          );
        }
        return (
          <span key={i} className="sr-odo-signe" style={apres(debut + 1.2 + nbChiffres * 0.1)}>
            {c === " " ? " " : c}
          </span>
        );
      })}
    </span>
  );
}

function Logo({ style, hauteur, statique }: { style?: CSSProperties; hauteur: number; statique?: boolean }) {
  return <img src="/marque-2iae-detouree.png" alt="2IAE" className={cn("absolute", !statique && "sr-fondu")} style={{ height: u(hauteur), width: "auto", ...style }} draggable={false} />;
}

function initiales(f: FormateurShowreel) {
  const p = f.prenom.replace(/\.$/, "").length <= 2 ? "" : f.prenom[0];
  return `${p}${f.nom[0] ?? ""}`.toUpperCase();
}

/** Photo : silhouette détourée posée sur le décor, ou portrait rond cerclé d'orange ; initiales sans photo. */
function Photo({ formateur, format }: { formateur: FormateurShowreel; format: FormatShowreel }) {
  const paysage = format === "paysage";
  const zone: CSSProperties = paysage
    ? { left: u(92), top: 0, bottom: 0, width: u(86) }
    : { left: 0, right: 0, top: u(9), height: "52%", WebkitMaskImage: "linear-gradient(#000 78%, transparent)", maskImage: "linear-gradient(#000 78%, transparent)" };
  const disque = paysage ? { left: u(102), top: u(18), width: u(70), height: u(70) } : { left: u(14), top: u(18), width: u(72), height: u(72) };
  return (
    <>
      {/* Le disque et l'anneau sont là dès la première image (vignette des vidéos partagées). */}
      <div className="sr-grandit absolute rounded-full" style={{ ...disque, background: "var(--orange)" }} aria-hidden />
      <div className="sr-grandit absolute rounded-full" style={{ left: paysage ? u(90) : u(3), top: paysage ? u(6) : u(7), width: u(94), height: u(94), border: `${u(0.35)} solid rgba(228,121,58,.45)`, ...apres(0.1) }} aria-hidden />
      <div className="absolute" style={zone}>
        {formateur.photoUrl && formateur.photoForme === "detoure" ? (
          <img src={formateur.photoUrl} alt="" className="sr-photo-detouree" style={{ left: 0, right: 0, margin: "0 auto", ...apres(0.12) }} draggable={false} />
        ) : formateur.photoUrl ? (
          <>
            <img
              src={formateur.photoUrl}
              alt=""
              className="sr-photo-ronde"
              style={paysage ? { left: u(19), top: u(22), width: u(56), height: u(56), ...apres(0.35) } : { left: u(22), top: u(12), width: u(56), height: u(56), ...apres(0.35) }}
              draggable={false}
            />
            <svg
              className="sr-anneau absolute"
              viewBox="0 0 100 100"
              style={paysage ? { left: u(15), top: u(18), width: u(64), height: u(64), transform: "rotate(-90deg)" } : { left: u(18), top: u(8), width: u(64), height: u(64), transform: "rotate(-90deg)" }}
              aria-hidden
            >
              <circle cx="50" cy="50" r="48" fill="none" stroke="#fff" strokeWidth="1.2" pathLength={100} style={apres(0.5)} />
            </svg>
          </>
        ) : (
          <div
            className="sr-echelle absolute grid place-items-center rounded-full font-black"
            style={{ ...(paysage ? { left: u(19), top: u(22), width: u(56), height: u(56) } : { left: u(22), top: u(12), width: u(56), height: u(56) }), background: "var(--encre)", color: "var(--orange)", fontSize: uf(20), letterSpacing: "-0.05em", ...apres(0.35) }}
            aria-hidden
          >
            {initiales(formateur)}
          </div>
        )}
      </div>
    </>
  );
}

// ── 1. Nom et photo ────────────────────────────────────────────────────────

function Ouverture({ plan, formateur, format }: PropsScene) {
  const paysage = format === "paysage";
  const nom = plan.titre || formateur.nomAffiche;
  const long = nom.length > 18;
  return (
    <div className="sr-scene sr-encre">
      <Photo formateur={formateur} format={format} />
      <Logo hauteur={paysage ? 8 : 9} statique style={paysage ? { left: u(9), top: u(9) } : { left: u(8), top: u(9) }} />
      <div
        className="absolute flex flex-col"
        style={paysage ? { left: u(9), top: u(20), bottom: u(10), width: u(84), justifyContent: "center", gap: u(2.6) } : { left: u(8), right: u(8), bottom: u(17), gap: u(3) }}
      >
        {plan.surtitre && (
          <p className="sr-mono sr-surtitre" style={{ fontSize: uf(paysage ? 2.8 : 3.4), ...apres(0.2) }}>
            {plan.surtitre}
          </p>
        )}
        <h2 className="font-black" style={{ fontSize: uf(paysage ? (long ? 11.5 : 13) : long ? 12.5 : 14.5), lineHeight: 0.92, letterSpacing: "-0.045em", margin: 0 }}>
          <Mots texte={nom} debut={0.32} pas={0.11} />
        </h2>
        <span className="sr-trait block" style={{ width: u(14), height: u(1.1), background: "var(--orange)", ...apres(0.85) }} aria-hidden />
        {plan.texte && (
          <p className="sr-glisse font-semibold" style={{ fontSize: uf(paysage ? 3.6 : 4.6), lineHeight: 1.25, color: "rgba(255,255,255,.84)", maxWidth: u(paysage ? 78 : 84), ...apres(1) }}>
            {plan.texte}
          </p>
        )}
      </div>
    </div>
  );
}

// ── 2. Un chiffre fort ─────────────────────────────────────────────────────

function Chiffre({ plan, format }: PropsScene) {
  const paysage = format === "paysage";
  // La taille suit la longueur du chiffre : « 5 » géant, « 200+ » encore dans le cadre en 9:16.
  const l = plan.valeur.length;
  const taille = paysage ? (l <= 3 ? 40 : l === 4 ? 36 : 28) : l <= 2 ? 44 : l === 3 ? 38 : l === 4 ? 31 : 24;
  return (
    <div className="sr-scene sr-orange sr-revele-droite">
      <p className="sr-contour absolute" aria-hidden style={{ fontSize: uf(paysage ? 70 : 80), right: u(-6), bottom: u(-4), WebkitTextStroke: `${u(0.2)} rgba(20,20,20,.13)`, animation: "sr-derive 9s linear both" }}>
        {plan.valeur}
      </p>
      <div
        className="absolute flex"
        style={paysage ? { left: u(12), right: u(10), top: 0, bottom: 0, alignItems: "center", gap: u(6) } : { left: u(9), right: u(9), top: 0, bottom: 0, flexDirection: "column", justifyContent: "center", gap: u(4) }}
      >
        <p className="font-black" style={{ fontSize: uf(taille), lineHeight: 1, letterSpacing: "-0.06em", margin: 0 }}>
          <span className="sr-only">{plan.valeur}</span>
          <Compteur valeur={plan.valeur} debut={0.35} />
        </p>
        <div className="flex flex-col" style={{ gap: u(2.2), maxWidth: paysage ? u(84) : "100%" }}>
          <span className="sr-trait block" style={{ width: u(12), height: u(1), background: "var(--encre)", ...apres(0.9) }} aria-hidden />
          <p className="font-black" style={{ fontSize: uf(paysage ? 7 : 8.4), lineHeight: 0.98, letterSpacing: "-0.035em", margin: 0 }}>
            <Mots texte={plan.titre} debut={0.8} pas={0.1} />
          </p>
          {plan.texte && (
            <p className="sr-glisse font-semibold" style={{ fontSize: uf(paysage ? 3.3 : 4.2), lineHeight: 1.3, color: "rgba(20,20,20,.78)", ...apres(1.5) }}>
              {plan.texte}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 3. Parcours ────────────────────────────────────────────────────────────

function Parcours({ plan, format }: PropsScene) {
  const paysage = format === "paysage";
  const n = plan.elements.length;
  const deuxColonnes = paysage && n > 3;
  const pas = Math.min(0.55, (plan.duree * 0.5) / Math.max(1, n));
  return (
    <div className="sr-scene sr-encre sr-revele-bas">
      <p className="sr-contour absolute" aria-hidden style={{ fontSize: uf(paysage ? 36 : 30), left: u(paysage ? 6 : 4), bottom: u(paysage ? -3 : 2), animation: "sr-derive 12s linear both" }}>
        {plan.surtitre || "Parcours"}
      </p>
      <p className="sr-mono sr-surtitre absolute" style={{ left: u(paysage ? 9 : 8), top: u(paysage ? 10 : 12), fontSize: uf(paysage ? 2.8 : 3.4), ...apres(0.3) }}>
        {plan.surtitre || "Parcours"}
      </p>
      <ol
        className="absolute grid list-none"
        style={
          paysage
            ? { left: u(9), right: u(9), top: u(20), bottom: u(12), gridTemplateColumns: deuxColonnes ? "1fr 1fr" : "1fr", gridAutoRows: "min-content", alignContent: "center", columnGap: u(8), rowGap: u(4.2), margin: 0, padding: 0 }
            : { left: u(8), right: u(8), top: u(22), bottom: u(16), alignContent: "center", rowGap: u(5.2), margin: 0, padding: 0 }
        }
      >
        {plan.elements.map((e, i) => {
          const debut = 0.45 + i * pas;
          return (
            <li key={i} className="flex" style={{ gap: u(2.6), alignItems: "flex-start" }}>
              <span className="sr-mono sr-fondu" style={{ fontSize: uf(paysage ? 2.3 : 2.9), color: "var(--orange)", paddingTop: u(0.9), ...apres(debut) }} aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="sr-trait-haut block" style={{ width: u(0.5), alignSelf: "stretch", background: "var(--orange)", ...apres(debut + 0.05) }} aria-hidden />
              <span className="sr-glisse flex min-w-0 flex-col" style={{ gap: u(0.8), ...apres(debut + 0.1) }}>
                <span className="font-extrabold" style={{ fontSize: uf(paysage ? (n > 4 ? 4.6 : 5.4) : n > 4 ? 5.8 : 6.8), lineHeight: 1.02, letterSpacing: "-0.03em" }}>
                  {e.nom}
                </span>
                {e.detail && (
                  <span className="sr-mono" style={{ fontSize: uf(paysage ? 2.1 : 2.8), letterSpacing: "0.06em", color: "rgba(255,255,255,.62)", textTransform: "none" }}>
                    {e.detail}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── 4. Expertise ───────────────────────────────────────────────────────────

function Expertise({ plan, format }: PropsScene) {
  const paysage = format === "paysage";
  const n = plan.elements.length;
  const taille = paysage ? (n <= 3 ? 8.4 : n === 4 ? 7.2 : 6.2) : n <= 3 ? 9 : n === 4 ? 8 : 7;
  const pas = Math.min(0.5, (plan.duree * 0.45) / Math.max(1, n));
  return (
    <div className="sr-scene sr-creme sr-revele-cercle">
      <div className="sr-echelle absolute rounded-full" aria-hidden style={{ right: u(-18), bottom: u(-22), width: u(62), height: u(62), border: `${u(7)} solid var(--orange)`, ...apres(0.25) }} />
      <p className="sr-mono sr-surtitre absolute" style={{ left: u(paysage ? 9 : 8), top: u(paysage ? 10 : 12), fontSize: uf(paysage ? 2.8 : 3.4), ...apres(0.35) }}>
        {plan.surtitre || "Expertise"}
      </p>
      <ul className="absolute flex list-none flex-col" style={{ left: u(paysage ? 9 : 8), right: u(paysage ? 30 : 8), top: u(paysage ? 18 : 22), bottom: u(paysage ? 10 : 18), justifyContent: "center", gap: u(paysage ? 2.2 : 3), margin: 0, padding: 0 }}>
        {plan.elements.map((e, i) => {
          const debut = 0.5 + i * pas;
          return (
            <li key={i} className="sr-glisse" style={apres(debut)}>
              <span className="font-black" style={{ fontSize: uf(taille), lineHeight: 1.08, letterSpacing: "-0.04em" }}>
                <span className="sr-marque" style={apres(debut + 0.3)}>
                  {e.nom}
                </span>
              </span>
              {e.detail && (
                <span className="sr-mono block" style={{ fontSize: uf(paysage ? 2.1 : 2.7), letterSpacing: "0.06em", color: "rgba(20,20,20,.62)", textTransform: "none", marginTop: u(0.6) }}>
                  {e.detail}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── 5. Une réalisation ─────────────────────────────────────────────────────

function Realisation({ plan, format }: PropsScene) {
  const paysage = format === "paysage";
  const titre = plan.titre.trim();
  const principal = titre || plan.texte;
  const secondaire = titre ? plan.texte : "";
  const taille = principal.length > 70 ? (paysage ? 6.4 : 7.4) : principal.length > 40 ? (paysage ? 8.2 : 9.4) : paysage ? 10 : 11.5;
  return (
    <div className="sr-scene sr-encre sr-revele-gauche">
      <div className="absolute rounded-full" aria-hidden style={{ right: u(paysage ? -16 : -30), bottom: u(paysage ? -30 : -24), width: u(paysage ? 74 : 80), height: u(paysage ? 74 : 80), background: "var(--orange)", animation: "sr-tourne 1.2s var(--courbe) 0.2s both" }} />
      <div className="absolute flex flex-col" style={paysage ? { left: u(9), right: u(52), top: 0, bottom: 0, justifyContent: "center", gap: u(3) } : { left: u(8), right: u(8), top: u(14), bottom: u(40), justifyContent: "center", gap: u(3.4) }}>
        {plan.surtitre && (
          <p className="sr-mono sr-surtitre" style={{ fontSize: uf(paysage ? 2.8 : 3.4), ...apres(0.35) }}>
            {plan.surtitre}
          </p>
        )}
        <h3 className="font-black" style={{ fontSize: uf(taille), lineHeight: 0.98, letterSpacing: "-0.04em", margin: 0 }}>
          <Mots texte={principal} debut={0.5} pas={0.08} />
        </h3>
        <span className="sr-trait block" style={{ width: u(18), height: u(1.1), background: "var(--orange)", ...apres(1.1) }} aria-hidden />
        {secondaire && (
          <p className="sr-glisse font-semibold" style={{ fontSize: uf(paysage ? 3.5 : 4.5), lineHeight: 1.3, color: "rgba(255,255,255,.82)", ...apres(1.3) }}>
            {secondaire}
          </p>
        )}
      </div>
    </div>
  );
}

// ── 6. Une citation ────────────────────────────────────────────────────────

function Citation({ plan, formateur, format }: PropsScene) {
  const paysage = format === "paysage";
  const l = plan.texte.length;
  const taille = paysage ? (l <= 90 ? 6.8 : l <= 160 ? 5.8 : 4.8) : l <= 90 ? 8.4 : l <= 160 ? 7 : 6;
  const nbMots = plan.texte.split(/\s+/).length;
  const pas = Math.min(0.14, (plan.duree * 0.5) / Math.max(1, nbMots));
  return (
    <div className="sr-scene sr-creme sr-revele-coin">
      <span className="sr-echelle absolute font-black" aria-hidden style={{ left: u(paysage ? 7 : 6), top: u(paysage ? 2 : 6), fontSize: uf(paysage ? 36 : 42), lineHeight: 1, color: "var(--orange)", ...apres(0.25) }}>
        «
      </span>
      <figure className="absolute flex flex-col" style={paysage ? { left: u(9), right: u(12), top: u(24), bottom: u(10), justifyContent: "center", gap: u(4), margin: 0 } : { left: u(8), right: u(8), top: u(30), bottom: u(16), justifyContent: "center", gap: u(5), margin: 0 }}>
        <blockquote className="font-extrabold" style={{ fontSize: uf(taille), lineHeight: 1.18, letterSpacing: "-0.025em", margin: 0 }}>
          <Mots texte={plan.texte} debut={0.55} pas={pas} doux />
          <span className="sr-mot-doux" style={{ color: "var(--orange)", ...apres(0.6 + nbMots * pas) }} aria-hidden>
            {" »"}
          </span>
        </blockquote>
        <figcaption className="sr-glisse flex items-center" style={{ gap: u(2), ...apres(0.8 + nbMots * pas) }}>
          <span style={{ width: u(7), height: u(0.6), background: "var(--orange)" }} aria-hidden />
          <span className="sr-mono" style={{ fontSize: uf(paysage ? 2.5 : 3.2) }}>
            {plan.titre || formateur.nomAffiche}
          </span>
        </figcaption>
      </figure>
    </div>
  );
}

// ── 7. Au campus 2IAE (emploi du temps) ────────────────────────────────────

function Campus({ plan, formateur, format }: PropsScene) {
  const paysage = format === "paysage";
  const c = formateur.campus;
  const cours = c.cours?.titre ?? "Campus numérique 2IAE";
  const liste = c.campus;
  const pasCampus = Math.min(0.32, (plan.duree * 0.35) / Math.max(1, liste.length));
  const debutCampus = paysage ? 1.3 : 1.7;
  return (
    <div className="sr-scene sr-encre sr-revele-haut">
      <div className={paysage ? "contents" : "absolute flex flex-col"} style={paysage ? undefined : { left: u(8), right: u(8), top: u(12), bottom: u(12), justifyContent: "center", gap: u(10) }}>
      <div className={paysage ? "absolute flex flex-col" : "flex flex-col"} style={paysage ? { left: u(9), width: u(104), top: 0, bottom: 0, justifyContent: "center", gap: u(3) } : { gap: u(3.4) }}>
        <p className="sr-mono sr-surtitre" style={{ fontSize: uf(paysage ? 2.8 : 3.4), ...apres(0.3) }}>
          {c.cours ? "Au campus 2IAE" : "Formateur du campus numérique"}
        </p>
        <h3 className="font-black" style={{ fontSize: uf(cours.length > 24 ? (paysage ? 8 : 9.5) : paysage ? 10 : 11.5), lineHeight: 0.95, letterSpacing: "-0.045em", margin: 0 }}>
          <Mots texte={cours} debut={0.45} pas={0.1} />
        </h3>
        {c.jourLibelle && c.heureDebut && (
          <div className="flex flex-wrap items-center" style={{ gap: u(2.4), marginTop: u(1) }}>
            <span className="sr-mono sr-echelle font-bold" style={{ background: "var(--orange)", color: "var(--encre)", fontSize: uf(paysage ? 3 : 3.6), padding: `${u(1)} ${u(2.2)}`, borderRadius: u(1.2), ...apres(0.95) }}>
              {c.jourLibelle}
            </span>
            <span className="sr-glisse font-black tabular-nums" style={{ fontSize: uf(paysage ? 6.4 : 7.6), letterSpacing: "-0.04em", lineHeight: 1, ...apres(1.05) }}>
              {heureH(c.heureDebut)}–{heureH(c.heureFin)}
            </span>
            <span className="sr-mono sr-fondu" style={{ fontSize: uf(paysage ? 2.2 : 2.8), color: "rgba(255,255,255,.62)", ...apres(1.25) }}>
              heure d'Abidjan
            </span>
          </div>
        )}
        {c.heureDebutLocale && c.ville && (
          <p className="sr-mono sr-glisse" style={{ fontSize: uf(paysage ? 2.6 : 3.2), color: "var(--orange)", textTransform: "none", letterSpacing: "0.04em", ...apres(1.45) }}>
            {heureH(c.heureDebutLocale)}–{heureH(c.heureFinLocale)} à {c.ville}, en direct
          </p>
        )}
        {c.public && (
          <p className="sr-mono sr-fondu" style={{ fontSize: uf(paysage ? 2.3 : 2.9), color: "rgba(255,255,255,.66)", ...apres(1.6) }}>
            {c.public}
          </p>
        )}
      </div>
      <div className={paysage ? "absolute flex flex-col" : "flex flex-col"} style={paysage ? { right: u(10), top: 0, bottom: 0, justifyContent: "center" } : undefined}>
        <ul className="relative flex list-none flex-col" style={{ gap: u(paysage ? 3.6 : 3.2), margin: 0, padding: 0 }}>
          <span className="sr-trait-haut absolute" aria-hidden style={{ left: u(1.1), top: u(1.8), bottom: u(1.8), width: u(0.25), background: "rgba(228,121,58,.55)", ...apres(debutCampus - 0.2) }} />
          {liste.map((nom, i) => (
            <li key={nom} className="relative flex items-center" style={{ gap: u(2.4) }}>
              <span className="sr-point" style={apres(debutCampus + i * pasCampus)} aria-hidden />
              <span className="sr-glisse font-bold" style={{ fontSize: uf(paysage ? 3.4 : 4), letterSpacing: "-0.01em", ...apres(debutCampus + i * pasCampus + 0.05) }}>
                {nom}
              </span>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </div>
  );
}

// ── 8. Fin ─────────────────────────────────────────────────────────────────

function Fin({ formateur, format }: PropsScene) {
  const paysage = format === "paysage";
  const c = formateur.campus;
  const rdv = rendezVous(c);
  return (
    <div className="sr-scene sr-encre sr-revele-cercle" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="absolute rounded-full" aria-hidden style={{ width: u(120), height: u(120), left: "50%", top: "50%", marginLeft: u(-60), marginTop: u(-60), background: "radial-gradient(closest-side, rgba(228,121,58,.38), rgba(228,121,58,0))", animation: "sr-pulse 3.2s ease-in-out infinite both" }} />
      <div className="relative flex flex-col items-center text-center" style={{ gap: u(paysage ? 2.6 : 3.4), padding: `0 ${u(8)}` }}>
        <img src="/marque-2iae-detouree.png" alt="Groupe Écoles 2IAE International" className="sr-echelle" style={{ height: u(paysage ? 17 : 19), width: "auto", marginBottom: u(2), ...apres(0.25) }} draggable={false} />
        <p className="font-black" style={{ fontSize: uf(rdv ? (paysage ? 14 : 15) : paysage ? 11 : 12), lineHeight: 0.95, letterSpacing: "-0.05em", margin: 0 }}>
          <Mots texte={rdv ?? "Bientôt en direct"} debut={0.55} pas={0.14} />
        </p>
        <p className="sr-glisse font-bold" style={{ fontSize: uf(paysage ? 4.4 : 5.2), color: "var(--orange)", letterSpacing: "-0.02em", ...apres(1.05) }}>
          {phraseCampus(c)}
        </p>
        {c.prochaineDateLibelle && (
          <p className="sr-mono sr-fondu" style={{ fontSize: uf(paysage ? 2.3 : 2.9), color: "rgba(255,255,255,.7)", marginTop: u(1), ...apres(1.5) }}>
            Prochain cours : {c.prochaineDateLibelle}
          </p>
        )}
      </div>
      <p className="sr-mono sr-fondu absolute" style={{ bottom: u(paysage ? 8 : 12), fontSize: uf(paysage ? 2.2 : 2.8), color: "rgba(255,255,255,.55)", ...apres(1.8) }}>
        Campus numérique 2IAE
      </p>
    </div>
  );
}

const RENDUS: Record<PlanShowreel["type"], (p: PropsScene) => ReactNode> = {
  ouverture: Ouverture,
  chiffre: Chiffre,
  parcours: Parcours,
  expertise: Expertise,
  realisation: Realisation,
  citation: Citation,
  campus: Campus,
  fin: Fin,
};

/** Le rendu d'un plan (l'ouverture est le premier plan : elle entre en fondu). */
export function Scene(props: PropsScene & { premier?: boolean }) {
  const Rendu = RENDUS[props.plan.type];
  if (!Rendu) return null;
  const contenu = <Rendu plan={props.plan} formateur={props.formateur} format={props.format} />;
  if (props.plan.type === "ouverture" && !props.premier) {
    return <div className="sr-scene sr-revele-droite">{contenu}</div>;
  }
  return <>{contenu}</>;
}
