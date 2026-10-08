// Corrigés à valider par le formateur (chantier K1 de la correction automatique, 8 octobre 2026).
// La logique vit dans server/corriges.ts ; contrat des échanges : shared/engagement/corrections.ts.
//
//   GET  /api/enseigner/corriges                    à valider, récents, en préparation (ListeCorriges)
//   GET  /api/enseigner/corriges/:devoirId          un corrigé (CorrigeAValider)
//   POST /api/enseigner/corriges/:devoirId/valider  { version } : « Valider le corrigé » (ReponseCorrige)
//   PUT  /api/enseigner/corriges/:devoirId          { version, contenu } : corrigé de l'exercice modifié, vaut validation
//   GET  /api/corriges/lien/:jeton                  lien de l'e-mail du jour : page de confirmation, sans connexion
//   POST /api/corriges/lien/:jeton                  bouton de cette page : valide les corrigés encore proposés
//
// Droits : le formateur qui enseigne le cours ou la direction ; l'équipe (vie scolaire avec le droit « notes »)
// lit sans agir. Un étudiant n'ouvre jamais ces routes. Tout part en « no-store » : les bonnes réponses d'un
// QCM encore ouvert ne restent ni dans le service worker ni dans un cache partagé.
import type { Express, Response } from "express";
import { z } from "zod";
import { exigerRole, droitSiEquipe, moi } from "../auth";
import { idParam, route, valider } from "../http";
import { COULEURS_EMAIL, echapper } from "../mail";
import {
  CORRIGE_MAX,
  corrigeDuDevoirPour,
  etatDuLien,
  lireJetonValidation,
  listeCorriges,
  modifierCorrige,
  validerCorrige,
  validerParLien,
  type EtatCorrigeDuLien,
} from "../corriges";
import type { CorpsModifierCorrige, CorpsValiderCorrige } from "@shared/engagement/corrections";
import { selonNombre, t, type CleEnseigner } from "@shared/textes/enseigner";
import { formaterDate } from "@shared/textes";

const vous = { registre: "vous" as const };
const PAS_DE_CACHE = "private, no-store";

const schemaValider: z.ZodType<CorpsValiderCorrige> = z.object({ version: z.number().int().min(0) });
const schemaModifier: z.ZodType<CorpsModifierCorrige> = z.object({
  version: z.number().int().min(0),
  // La longueur exacte est vérifiée après le retrait des espaces (corriges.ts) : ici, une borne contre les abus.
  contenu: z.string().max(CORRIGE_MAX + 2000),
});

// ── Page du lien de l'e-mail ───────────────────────────────────────────────
// Page simple aux couleurs des e-mails, lisible sur téléphone, servie par le serveur (aucun écran de
// l'application n'est chargé). Servie en XHTML (application/xhtml+xml) : le service worker du campus garde
// comme coquille de l'application toute page « text/html » ouverte en navigation ; celle-ci ne doit pas la
// remplacer. Le balisage reste donc du XML bien formé (balises fermées, entités numériques).

const { ORANGE, ORANGE_FONCE, ENCRE, TEXTE_PALE, CREME, LIGNE } = COULEURS_EMAIL;

function page(o: { titre: string; paragraphes: string[]; corriges?: EtatCorrigeDuLien[]; bouton?: { libelle: string; action: string }; fuseau?: string | null }): string {
  const etat = (c: EtatCorrigeDuLien) =>
    c.etat === "a_valider"
      ? c.echeanceLe
        ? t("corriges.lien.etat.propose", { ...vous, v: { quand: `le ${formaterDate(c.echeanceLe, { style: "jourHeure", fuseau: o.fuseau })}` } })
        : t("corriges.lien.etat.proposeSansDate", vous)
      : t(`corriges.lien.etat.${c.etat}` as CleEnseigner, vous);
  const liste = (o.corriges ?? [])
    .map(
      (c) =>
        `<li><strong>${echapper(c.titre || `Devoir ${c.devoirId}`)}</strong><span class="meta">${echapper([c.coursCode, etat(c)].filter(Boolean).join(" · "))}</span></li>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="fr" xml:lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<meta name="color-scheme" content="light" />
<title>${echapper(o.titre)} · Campus 2IAE</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:24px 16px;background:${CREME};color:${ENCRE};font-family:Archivo,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5}
main{max-width:560px;margin:0 auto;background:#fff;border:1px solid ${LIGNE};border-radius:20px;padding:24px 20px}
img{display:block;width:150px;height:auto;margin:0 0 16px}
.etiquette{margin:0 0 6px;font-family:'IBM Plex Mono',Menlo,Consolas,monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${ORANGE_FONCE}}
h1{margin:0 0 14px;font-size:26px;line-height:1.15;font-weight:900;letter-spacing:-.02em}
p{margin:0 0 14px;color:#3D3833}
ul{list-style:none;margin:0 0 18px;padding:0;border-top:1px solid ${LIGNE}}
li{padding:12px 0;border-bottom:1px solid ${LIGNE}}
li strong{display:block;font-size:16px;line-height:1.3}
.meta{display:block;margin-top:2px;font-size:14px;color:${TEXTE_PALE}}
form{margin:0 0 12px}
.principal,.secondaire{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;padding:12px 20px;border-radius:12px;font:inherit;font-size:16px;font-weight:800;text-decoration:none;text-align:center;cursor:pointer}
.principal{border:0;background:${ORANGE};color:${ENCRE}}
.secondaire{border:2px solid ${ENCRE};background:#fff;color:${ENCRE}}
footer{max-width:560px;margin:14px auto 0;font-size:12px;color:#8A7F76;text-align:center}
</style>
</head>
<body>
<main>
<img src="/logo-2iae.png" width="150" height="78" alt="Groupe Écoles 2IAE International" />
<p class="etiquette">${echapper(t("corriges.lien.etiquette", vous))}</p>
<h1>${echapper(o.titre)}</h1>
${o.paragraphes.map((p) => `<p>${echapper(p)}</p>`).join("\n")}
${liste ? `<ul>${liste}</ul>` : ""}
${o.bouton ? `<form method="post" action="${echapper(o.bouton.action)}"><button type="submit" class="principal">${echapper(o.bouton.libelle)}</button></form>` : ""}
<a class="secondaire" href="/enseigner/corriges">${echapper(t(o.bouton ? "corriges.lien.voir" : "corriges.lien.ouvrir", vous))}</a>
</main>
<footer>Campus numérique · Groupe Écoles 2IAE International</footer>
</body>
</html>`;
}

function envoyerPage(res: Response, statut: number, html: string) {
  res.status(statut);
  res.setHeader("Cache-Control", PAS_DE_CACHE);
  res.setHeader("Content-Type", "application/xhtml+xml; charset=utf-8");
  res.send(html);
}

export function enregistrerCorriges(app: Express) {
  app.get(
    "/api/enseigner/corriges",
    exigerRole("formateur", "admin", "vie_scolaire"),
    droitSiEquipe("notes"),
    route(async (req, res) => {
      const liste = await listeCorriges(moi(req));
      res.setHeader("Cache-Control", PAS_DE_CACHE);
      res.json(liste);
    }),
  );

  app.get(
    "/api/enseigner/corriges/:devoirId(\\d+)",
    exigerRole("formateur", "admin", "vie_scolaire"),
    droitSiEquipe("notes"),
    route(async (req, res) => {
      const corrige = await corrigeDuDevoirPour(moi(req), idParam(req, "devoirId"));
      res.setHeader("Cache-Control", PAS_DE_CACHE);
      res.json(corrige);
    }),
  );

  app.post(
    "/api/enseigner/corriges/:devoirId(\\d+)/valider",
    exigerRole("formateur", "admin"),
    route(async (req, res) => {
      const { version } = valider(schemaValider, req.body);
      const reponse = await validerCorrige(moi(req), idParam(req, "devoirId"), version);
      res.setHeader("Cache-Control", PAS_DE_CACHE);
      res.json(reponse);
    }),
  );

  app.put(
    "/api/enseigner/corriges/:devoirId(\\d+)",
    exigerRole("formateur", "admin"),
    route(async (req, res) => {
      const { version, contenu } = valider(schemaModifier, req.body);
      const reponse = await modifierCorrige(moi(req), idParam(req, "devoirId"), version, contenu);
      res.setHeader("Cache-Control", PAS_DE_CACHE);
      res.json(reponse);
    }),
  );

  // ── Lien de l'e-mail (public, sans connexion : le jeton signé fait foi) ──

  // GET n'écrit rien : une messagerie ou un antivirus qui ouvre le lien pour l'analyser ne valide rien.
  app.get(
    "/api/corriges/lien/:jeton",
    route(async (req, res) => {
      const jeton = String(req.params.jeton);
      const j = lireJetonValidation(jeton);
      if (!j) return envoyerPage(res, 404, page({ titre: t("corriges.lien.invalide.titre", vous), paragraphes: [t("corriges.lien.invalide", vous)] }));
      if (j.expire) return envoyerPage(res, 410, page({ titre: t("corriges.lien.expire.titre", vous), paragraphes: [t("corriges.lien.expire", vous)] }));
      const { formateur, corriges } = await etatDuLien(j);
      if (!formateur) return envoyerPage(res, 403, page({ titre: t("corriges.lien.invalide.titre", vous), paragraphes: [t("corriges.lien.refuse", vous)] }));
      const fuseau = formateur.fuseau;
      const aValider = corriges.filter((c) => c.etat === "a_valider").length;
      const fait = typeof req.query.fait === "string" && /^\d{1,3}$/.test(req.query.fait) ? Number(req.query.fait) : null;
      if (fait !== null && fait > 0) {
        return envoyerPage(
          res,
          200,
          page({ titre: t("corriges.lien.fait.titre", vous), paragraphes: [selonNombre(t, "corriges.lien.fait", fait, vous), t("corriges.lien.fait.suite", vous)], corriges, fuseau }),
        );
      }
      if (!aValider) return envoyerPage(res, 200, page({ titre: t("corriges.lien.rien.titre", vous), paragraphes: [t("corriges.lien.rien", vous)], corriges, fuseau }));
      // Rien n'a pu être validé alors que des corrigés restent proposés : il n'enseigne plus ce cours (sans bouton,
      // pour ne pas tourner en rond).
      if (fait === 0) return envoyerPage(res, 403, page({ titre: t("corriges.lien.invalide.titre", vous), paragraphes: [t("corriges.lien.refuse", vous)], corriges, fuseau }));
      envoyerPage(
        res,
        200,
        page({
          titre: t(aValider === 1 ? "corriges.lien.titre.un" : "corriges.lien.titre.n", vous),
          paragraphes: [t("corriges.lien.intro", vous)],
          corriges,
          bouton: { libelle: selonNombre(t, "corriges.lien.valider", aValider, vous), action: `/api/corriges/lien/${jeton}` },
          fuseau,
        }),
      );
    }),
  );

  // Le bouton de la page : valide au nom du formateur ce qui est encore proposé dans la version de l'e-mail,
  // puis revient à la page (un rechargement ne renvoie pas le formulaire).
  app.post(
    "/api/corriges/lien/:jeton",
    route(async (req, res) => {
      const jeton = String(req.params.jeton);
      const j = lireJetonValidation(jeton);
      res.setHeader("Cache-Control", PAS_DE_CACHE);
      if (!j) return envoyerPage(res, 404, page({ titre: t("corriges.lien.invalide.titre", vous), paragraphes: [t("corriges.lien.invalide", vous)] }));
      const n = await validerParLien(j);
      res.redirect(303, `/api/corriges/lien/${jeton}?fait=${n}`);
    }),
  );
}
