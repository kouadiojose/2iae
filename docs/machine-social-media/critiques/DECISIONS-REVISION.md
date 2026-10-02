# Décisions de révision (v2), arrêtées après les trois rapports de l'équipe rouge

Ces décisions s'imposent aux trois rédacteurs. Elles tranchent les critiques CR1 (faisabilité), CR2 (qualité, expérience), CR3 (économie, concurrence). Toute autre correction factuelle de CR1, CR2, CR3 s'applique aussi.

## Nom de travail
La plateforme s'appelle provisoirement « la Machine » dans le dossier (nom commercial à choisir par José, question ouverte). Les produits verticaux restent « Chaire » (église) et « Dépôt » (lancement produit).

## Positionnement (CR3 §4)
Phrase de vente inchangée. Thèse réécrite : « personne ne le fait sur place, en français, avec un humain et une preuve d'affaires ». Défendable = distribution (réseau de José, églises, diaspora de Toronto, 2IAE vivier de gestionnaires), opération locale, données accumulées, accès approuvés, dispositif de conformité. Retirer l'affirmation « une doctrine ne se copie pas ».

## Grille de prix v1 (Abidjan FCFA / Canada CAD)
| Palier | Abidjan | Canada |
|---|---|---|
| Chaire Essentiel (1 compte, 3 clips par semaine, sans format long) | 95 000 | non proposé |
| Chaire (église avec régie, 2 comptes, 5 clips, 2 highlights animés et 1 verset animé par sermon, format long, dévotionnel, rapport) | 175 000 | 700 |
| Présence (engagement 3 mois) | 300 000 | 900 |
| Vidéo+ | 650 000 catalogue, 550 000 pour les pilotes | 2 200 |
| Frais d'intégration (remboursés si engagement 6 mois) | 125 000 | 400 |
| Option boîte de réception (réponse sous 24 h ouvrées) | 40 000 | 120 |
| Option boost supervisé | 15 % du budget, minimum 15 000 FCFA | 15 %, minimum 50 CAD |
| Reel génératif supplémentaire | 15 000 | 50 |
France : « sur devis », retirée de la grille v1. « Logiciel seul » retiré de la v1 : phase 4, réservé à des agences partenaires hors Abidjan, facturé par espace (ex. 250 CAD pour 5 clients), clause de non-concurrence. Taxes en sus (TVH 13 % en Ontario ; fiscalité ivoirienne à faire trancher par un avocat). Encaissement : PAD au Canada, Wave Business à Abidjan, CinetPay et Stripe en repli.
Par défaut, les clients canadiens sont servis par le gestionnaire d'Abidjan (francophone, 4 à 5 h de décalage), l'humain canadien seulement pour les appels.

## Temps humain et économie
- Hypothèse de travail : 8 à 12 heures de gestionnaire par client et par mois (Chaire au bas, Vidéo+ au haut), à MESURER dès le pilote (indicateur « minutes de gestionnaire par client et par semaine », chronométré dans la PWA). Un gestionnaire à temps plein à Abidjan tient 8 à 10 clients au plus.
- Coût employeur du gestionnaire d'Abidjan : environ 410 000 FCFA (350 000 brut + charges CNPS hypothétiques) + 25 000 FCFA de frais, soit environ 715 $ par mois.
- Ajouter à chaque client type une ligne « frais, taxes, charges » (encaissement 1 à 4 %, change 1 à 3 %, provision impayés 5 %).
- Socle recalculé avec les oublis (Remotion Automators 100 $ jusqu'à réponse écrite, ElevenLabs Creator 22 $, Vizard 29 $ tant qu'il sert, Upload-Post Advanced 147 $ dès 8 clients et Business 438 $ à 20, Canva Teams, Firecrawl, Resend, numéros).
- Seuil : 4 à 5 clients payants selon le mix, dont au moins un Présence ou Vidéo+ ; quatre églises seules ne suffisent pas. Le rédacteur de la section 12 refait tous les calculs et publie les chiffres exacts ; les autres sections citent seulement « 4 à 5 clients » et renvoient à la section 12.
- Coûts uniques : juridique 3 000 à 10 000 $ (hypothèse), assurance 1 000 à 3 000 CAD par an (hypothèse), banc de transcriptions de référence. Plan de trésorerie mois par mois d'octobre 2026 à décembre 2027, besoin estimé 6 000 à 15 000 $ hors temps de José.
- Temps de José : 6 à 10 h par semaine la première année ; moins de 2 h seulement en régime de croisière (année 2), avec un « mode José absent ».

## Calendrier (CR1 §A)
- Phase 0, 5 au 18 octobre 2026 (2 semaines) : vérification d'entreprise Meta, apps en mode développement, numéro WhatsApp et modèles, projets Railway (machine, machine-sauvegarde dans un espace distinct), `/db`, bancs d'essai, mesure du disque éphémère de `rendu`, signature de l'église pilote.
- Phase 1 « Chaire minimal », 19 octobre au 13 décembre 2026 (8 semaines) : pilote en ligne au plus tôt le 30 novembre. Contenu : coupes MVP ci-dessous. Fin de phase : dépôt de la revue Meta (publication, insights), audits YouTube et TikTok avec leurs vidéos.
- Phase 2, 14 décembre 2026 au 28 février 2027 (11 semaines, avec la pause des fêtes) : planche généraliste, Dépôt beauté, vidéo générative (API Higgsfield, repli Kling 3.0 via fal), voie rapide (statique puis vidéo par gabarits Remotion), réserve de démarrage, Présence, deuxième et troisième clients ; critères des quatre semaines du pilote mesurés ici ; revue Meta commentaires, messagerie, HUMAN_AGENT.
- Phase 3, mars à mai 2027 : veille complète (flux B et C), boîte de réception, mesure complète, MCP en lecture et Routines, bouton « Confier à Claude », LinkedIn, Toronto (client signé avant le 10 janvier pour le Mois de l'histoire des Noirs, sinon viser l'été : Juneteenth, Caribana, rentrée).
- Phase 4, été 2027 : palier 8 clients payants, bandit, Trial Reels, offre partenaires.
- Toujours écrire la durée réelle (environ 20 semaines jusqu'à la fin de la phase 2, marge de 25 % comprise dans les dates), jamais « 90 jours ».

## Coupes MVP (phases 0 et 1) : exactement la liste « Garder / Reporter » de CR1 §3.

## Corrections techniques obligatoires (CR1 §2)
Limite dure Railway à 3 fois la facture et disjoncteurs applicatifs ; sauvegardes à clé publique tirées depuis le projet de sauvegarde, espace Railway distinct, second administrateur ; règle de transit des données chez les fournisseurs ; Blotato retiré, Upload-Post porte TikTok, écran porte 3 conforme TikTok ; cinq modèles WhatsApp utilitaires seulement, rapport au tarif marketing ; mesure initiale sur la couche affaires maison ; MCP lecture seule plus `log_decision`, `approve` porte 1 seulement avec confirmation PWA, Routines limitées au connecteur machine-social ; `web` en sealed box ; RLS corrigée ; authentification du gestionnaire (passkey ou lien plus TOTP, 12 h, `membership`, audit) ; second administrateur, numéro de réserve, Kling via fal en repli de Higgsfield, Sonnet en repli d'Opus ; lot Batch le mercredi 18:00 ; dédoublonnage par URL, hash, `pg_trgm` ; proxy 720p pour les sermons ; « Je valide tout » retiré pour églises et beauté ; `changes.watch` dans H9. Jetons : Instagram Login rafraîchi à J-5, Page Facebook contrôlée par `debug_token`. MetaDirectConnector : rôle sur l'application. Serverless de `rendu` faux, retirer.

## Expérience et qualité retenues (CR2)
- Une seule planche par client et par semaine (pour Chaire, le lundi midi remplace le vendredi) ; autres messages regroupés dans le récapitulatif du dimanche ; plafond bloquant mesuré dans `whatsapp_message`.
- Vue client : visuel, hook, jour, réseau, « ce que nous attendons de vous » ; composite à 6 vignettes numérotées au plus ; pilier, framework, coût côté gestionnaire seulement.
- Aperçu vidéo de 5 à 6 s dans la fenêtre de 24 h pour chaque proposition vidéo.
- Réserve de démarrage de 12 contenus validée à l'onboarding ; réserve enrichie de contenus produit sans prix ni allégation ; défaut « sans réponse » tranché avant le pilote (proposition : réserve activée).
- Mandat tendance optionnel (formats sans visage, sans prix, sans sujet religieux).
- Voix de marque tirée de la parole réelle (sermons, vocaux, réponses, page « à propos »), jamais des posts de l'agence ; test d'acceptation en aveugle (R11 §5.1) ; 3/3 en ancrage réel pour le pilier relation.
- Dépôt : photo normale acceptée, document seulement pour l'INCI.
- Jeton d'utilisateur système (Facebook Login for Business) pour éviter les reconnexions côté client.
- Bouton « Approuver tout ce qui est prêt » de José limité aux éléments déjà passés en porte 3 ; version n+1 sans relecture assumée comme exception écrite (motif standard, juge ≥ 15, jamais pour église ni beauté).
- Alerte « risque de départ » élargie (hausse des « à revoir », délai de réponse qui s'allonge).
- Idées novatrices à intégrer avec leur phase : boîte à tendances de la cliente (phase 2) ; « ce qui marche chez vos voisins » (phase 3) ; couverture du catalogue et produit oublié du mois (phase 2) ; tournage guidé (phase 2) ; réponse vidéo aux commentaires (phase 3) ; collecte d'UGC réel par mot clé « AVIS » (phase 3, condition de Vidéo+) ; bibliothèque de formats gagnants par verticale (dès le mois 2 d'exploitation) ; pré-test des hooks adapté au pays (phase 4) ; remontée des meilleurs contenus (phase 3) ; fond de catalogue des sermons à l'onboarding (phase 1, fait partie du pilote) ; vocal du lundi (phase 2).
- Chaire : 2 highlights animés et 1 verset animé par sermon, audiogrammes ; genèse d'événement en vidéo animée Remotion 30 à 60 s à partir des archives et du vocal du président ; vidéo explicative de logiciel déclenchée par « projet Markel-Tech livré », compte de démonstration et script validé, prix à l'unité.

## Demandes explicites de José (nouvelle sous-section obligatoire, section 9)
- ChatGPT Image = famille GPT Image, utilisée par l'API (gpt-image-2.5 flare et sunburst) ; chatgpt-image-latest retiré le 1er décembre 2026.
- Higgsfield (« Xfield ») : oui. La plateforme passe par l'API officielle ; José, dans Claude ou Cowork, par le MCP officiel (mcp.higgsfield.ai/mcp, OAuth, en crédits) ; seul l'Unlimited piloté par Chrome est interdit par les conditions.
- Claude Code : oui, par Routines (`POST /fire`) et bouton « Confier à Claude » dans la PWA avec ordres types (phase 3). Cowork : pas de déclenchement direct ; une tâche planifiée Cowork lit les ordres en attente par le MCP.
- Vidéos explicatives de logiciel, genèse animée, highlights de sermon : voir ci-dessus.

## Annexes à ajouter (CR3 §5), rédacteur C
A. Contrat et annexe de niveau de service (quinze clauses R08 §8.1, définitions, versions incluses, hors forfait, engagement), accord de pilote. B. Onboarding pas à pas (1 à 2 semaines, responsables, messages types, réserve de démarrage, fond de catalogue). C. Support et incidents (canal, horaires, retrait d'un post erroné en moins d'une heure, crise, remplaçant, couverture des heures de Toronto). D. Facturation (tables, webhooks Wave et CinetPay, mentions TVH, relance, suspension douce, lien Zoho CRM et skill markel-invoice). E. Sortie d'un client (propriété, remise des comptes, publications programmées, sauvegardes, destruction de la voix clonée). F. Bilinguisme et accessibilité (anglais pour Toronto, juge anglais, WCAG 2.1 AA, AODA, sous-titres et SRT, texte alternatif). G. Gouvernance des données (données religieuses sensibles, ARTCI, sous-traitants, registre, incident 72 h, apprentissage inter-clients limité aux structures). H. Indicateurs du pilote et critères d'arrêt (CR3 §5.9). I. Kit commercial et vente sur place. J. Fiche de poste du gestionnaire. K. Plan de trésorerie.
