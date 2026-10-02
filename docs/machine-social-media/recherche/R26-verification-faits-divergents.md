# R26. Vérification des faits contradictoires ou non confirmés entre les onze rapports (état au 2 octobre 2026)

## Résumé

Dix faits structurants des rapports R01 à R11 divergeaient d'un rapport à l'autre ou reposaient sur une source tierce unique. Chacun a été relu sur la page primaire (documentation officielle, page de prix, conditions d'utilisation, texte de loi ou page officielle d'autorité), daté, et tranché. Résultat : sur dix faits, six rapports contenaient au moins une valeur fausse ou périmée, deux faits restent partiellement non vérifiables sur page officielle (le détail du changement de politique Meta du 23 juillet 2026, le montant de la sanction administrative pour une personne physique au Québec), et trois découvertes annexes modifient des hypothèses de conception (Instagram publie deux plafonds différents, 50 et 100 publications par 24 heures, sur deux pages officielles ; la ligne Claude compte désormais un modèle Fable 5.1 à 10 et 50 dollars ; Higgsfield s'autorise contractuellement à entraîner ses modèles sur les contenus des comptes non entreprise).

Les corrections les plus lourdes de conséquences : un Reel Instagram publié par l'API accepte 15 minutes et 300 Mo (R05 et R09 sont à corriger, le « 90 secondes » venait de deux blogs tiers périmés) ; gpt-image-1.5 n'est pas retiré le 23 octobre 2026 mais le 1er décembre 2026, c'est gpt-image-1 qui disparaît le 23 octobre (R01 à corriger) ; Opus 5 coûte 5 et 25 dollars et son cache 0,50, seul Opus 5.5 bénéficie du 0,05x (R11 à corriger) ; Higgsfield a bien une API publique, tarifée au dollar sans crédits pour le développeur, Seedance 2.5 y accepte 4 à 30 secondes (R01 à corriger, R04 confirmé) ; TikTok non audité limite à 5 utilisateurs publiant par 24 heures, pas 5 publications (R02 à corriger) ; le plafond de 5 hashtags Instagram est bien sur une page officielle d'aide (R09 confirmé et renforcé) ; la grille Hootsuite 99, 199, 399 dollars est écrite noir sur blanc dans la FAQ de la page officielle des plans (R01 confirmé).

## Méthode

Pour chaque fait : (1) relever la formulation exacte dans les rapports concernés ; (2) ouvrir la page primaire citée ou attendue ; (3) en cas d'échec (404, 403, page rendue en JavaScript), tenter une URL voisine du même éditeur, puis seulement une source tierce datée ; (4) noter la date de la page (date affichée, date de changelog, ou à défaut date de lecture, le 2 octobre 2026) ; (5) trancher et désigner les rapports à corriger. 48 pages ont été consultées, dont 41 pages officielles des éditeurs ou autorités concernés. Le budget de recherche web de la session étant épuisé au moment de cette vérification, le travail a reposé sur la lecture directe des URL primaires ; aucune valeur n'a été tirée de mémoire.

## 1. Tableau de synthèse

| Numéro | Fait | Valeur retenue | Source primaire | Date | Rapports à corriger |
|---|---|---|---|---|---|
| 1a | Durée d'un Reel Instagram publié par API | 3 secondes minimum, 15 minutes maximum | developers.facebook.com, référence ig-user/media, section Reel Specifications | page lue le 2 octobre 2026 (dernière note datée sur la page : 9 juillet 2025) | R05 (90 s), R09 (3 min présenté comme limite API) |
| 1b | Taille maximale d'un Reel par API | 300 Mo | même page | idem | R02 (lever le doute « 1 Go ») |
| 1c | Durée d'un Reel dans l'application Instagram | 3 secondes à 3 minutes selon le guide officiel Instagram | about.instagram.com, guide « How to make Instagram Reels » | non daté, lu le 2 octobre 2026 | R09 : exact pour l'application, mais ce n'est pas la limite API |
| 1d | Facebook Reels par API | 3 à 90 secondes, 30 Reels par 24 heures glissantes | developers.facebook.com, Reels publishing guide | lu le 2 octobre 2026 | R02 confirmé ; R05 a transposé à tort ce 90 s à Instagram |
| 2a | Lignée gpt-image : modèle courant | gpt-image-2.5-sunburst et gpt-image-2.5-flare, snapshots 2026-09-08 | developers.openai.com, pages modèles | 8 septembre 2026 | R01 (présente gpt-image-2 comme courant) |
| 2b | Retrait de gpt-image-1.5 | annoncé le 2 juin 2026, arrêt le 1er décembre 2026 (avec gpt-image-1-mini et chatgpt-image-latest) | developers.openai.com/api/docs/deprecations | 2 juin 2026 | R01 (23 octobre) |
| 2c | Retrait de gpt-image-1 | annoncé le 22 avril 2026, arrêt le 23 octobre 2026 | même page | 22 avril 2026 | R01 (confusion 1 et 1.5) |
| 2d | Prix direct OpenAI de gpt-image-2.5 | 5 $ texte entrée, 8 $ image entrée, 30 $ image sortie par million de jetons ; Batch à moitié prix ; aucun prix par image publié pour 2 et 2.5 | developers.openai.com/api/docs/pricing | lu le 2 octobre 2026 | R03 (prix fal présentés comme prix OpenAI : à requalifier), R05 (0,053 $ gpt-image-2 : non officiel) |
| 2e | Prix par image officiel de gpt-image-1.5 | low 0,009 à 0,013 $, medium 0,034 à 0,05 $, high 0,133 à 0,20 $ | page modèle gpt-image-1.5 | snapshot 2025-12-16 | aucun (confirme R03) |
| 2f | Images de référence | jusqu'à 16 images par requête sur l'endpoint edits pour les modèles GPT Image | référence API images/createEdit | lu le 2 octobre 2026 | aucun (confirme R03) |
| 2g | Qualités et tailles 2.5 | low, medium, high, xhigh, max, auto ; tailles libres multiples de 16, ratio 1:3 à 3:1, 3840×2160 maximum | même page | idem | R03 : « 3 840 px de grand côté » à préciser en 3840×2160 |
| 3a | Prix Opus 5.5 | 4 $ entrée, 20 $ sortie, cache 0,20 $ (0,05x), écriture 5 min 5 $, 1 h 8 $, Batch 2 et 10 $ | platform.claude.com/docs/en/about-claude/pricing | lu le 2 octobre 2026 | R11 (cite Opus 5 à 5 $ comme référence) |
| 3b | Prix Opus 5 | 5 $ et 25 $, cache 0,50 $ (0,1x) | même page | idem | R11 : le modèle existe encore mais n'est plus le bon repère |
| 3c | Prix Sonnet 5.5 et Haiku 4.5 | Sonnet 5.5 : 2 $ et 10 $, cache 0,20 $ ; Haiku 4.5 : 1 $ et 5 $, cache 0,10 $ | même page | idem | aucun (confirme R05, R06, R07) |
| 3d | Cache à 0,05x | vrai uniquement sur Opus 5.5 ; 0,1x sur tous les autres sauf Fable 5.1 et Mythos 5.1 à 0,025x | même page | idem | R11 (« 5 à 10 % selon les modèles » devient précis) |
| 3e | Modèle le plus récent | Claude Fable 5.1 : 10 $ et 50 $, cache 0,25 $, Batch 5 et 25 $ | même page et claude.com/pricing | idem | R07 (table incomplète, sans Fable) |
| 4a | Conditions d'utilisation Higgsfield | page existante : higgsfield.ai/terms-of-use-agreement, dernière mise à jour 26 juillet 2026, effective le 27 août 2026 pour les anciens comptes | higgsfield.ai/terms-of-use-agreement | 26 juillet 2026 | R04 (404 sur /terms : l'URL était fausse) |
| 4b | Clause Unlimited | section 10.6 : usage « automated or materially exceeds typical individual use » peut être restreint, suspendu, ralenti | même page | idem | R04 : préciser la section ; R01 : rien à corriger |
| 4c | Clause explicite « automation, scripting, credential sharing, reselling » | elle figure dans le centre d'aide, article « What are Unlimited models », publié le 3 août 2026, modifié le 28 août 2026 | higgsfield.ai/creator-hub/help-center/credits/... | 28 août 2026 | R04 : source à préciser |
| 4d | API publique Higgsfield | existe : console open.higgsfield.ai, lancement le 16 septembre 2026, paiement à la génération | changelog Higgsfield, docs.higgsfield.ai | 16 septembre 2026 | R01 (« aucune API publique ») |
| 4e | Prix API par modèle | Seedance 2.5 : 0,2057 $ par seconde ; Kling 3.0 : 0,084 $ par seconde ; Wan 3.0 Prime à partir de 0,068 $ par seconde ; Cinema Studio 4.0 à partir de 0,2057 $ par seconde ; Genjutsu à partir de 0,318 $ par seconde ; Z-Image Turbo 0,015 $ par image ; Soul 2 à partir de 0,0032 $ par image | open.higgsfield.ai | lu le 2 octobre 2026 | R04 (prix non relevés) |
| 4f | Seedance 2.5 durée | 4 à 30 secondes, sur le site et dans l'API (paramètre duration : minimum 4, maximum 30, défaut 5) ; Seedance 2.0 : 4 à 15 secondes | docs.higgsfield.ai, centre d'aide « How do I use Seedance » (9 septembre 2026) | 9 septembre 2026 | R01 et skill interne (« 15 s ») : 15 s est un choix, pas une limite |
| 4g | Unlimited et MCP | Unlimited ne vaut que sur higgsfield.ai ; MCP, CLI, Canvas et Supercomputer débitent des crédits | centre d'aide et blog officiel « Credits vs Unlimited » (prix vérifiés le 11 septembre 2026) | septembre 2026 | aucun (confirme R04) |
| 5 | Hootsuite | « Paid plans start at $99 for a Standard plan, $199 for a Professional plan, and range up to $399 for an Advanced plan », par utilisateur et par mois en facturation annuelle | hootsuite.com/plans, FAQ | lu le 2 octobre 2026 | R01 : lever la réserve « sources tierces » |
| 6 | Hashtags Instagram | « You can use up to 5 tags on a post. If you include more than 5 tags on a single photo/video, your comment won't post. » | help.instagram.com, article 351460621611097 « Use hashtags on Instagram » (lisible via facebook.com/help/instagram/351460621611097) | non daté, lu le 2 octobre 2026 | R09 : lever la réserve « à confirmer » |
| 7 | TikTok non audité | « Unaudited API Clients can allow up to 5 users to post in a 24 hour window » ; SELF_ONLY uniquement ; comptes privés obligatoires ; 6 requêtes par minute par jeton ; environ 15 publications par jour et par créateur | developers.tiktok.com, Content Sharing Guidelines et référence Direct Post | lu le 2 octobre 2026 | R02 (« 5 publications par 24 h ») ; R05 confirmé |
| 8 | Politique Meta santé et apparence | changelog affiché : 23 juillet 2026 et 27 décembre 2024 ; avant/après autorisé pour les produits et procédures cosmétiques généraux, 18 ans et plus pour les procédures invasives et les produits de perte de poids | transparency.meta.com/policies/ad-standards/restricted-goods-services/health-wellness/ | 23 juillet 2026 | R03 (22 juillet : date fausse d'un jour), R09 (« dernière mise à jour 27 décembre 2024 » : périmé) |
| 9 | Loi 25 Québec | sanction administrative : jusqu'à 2 % du chiffre d'affaires mondial ou 10 millions de dollars ; pénal : personne physique 5 000 $ à 100 000 $, entreprise 15 000 $ à 25 M$ ou 4 % du chiffre d'affaires mondial de l'exercice précédent, le plus élevé ; doublement en cas de récidive | cai.gouv.qc.ca, page « Sanctions aux entreprises et poursuites » | lu le 2 octobre 2026 | R08 : mémoire exacte, réserve à lever ; R09 et R11 : ajouter la source |
| 10a | Metricool MCP | « Metricool MCP » coché sur tous les plans, Free compris ; page metricool.com/mcp : fonctionne « avec n'importe quel plan, y compris le compte gratuit » | metricool.com/pricing, metricool.com/mcp | lu le 2 octobre 2026 | aucun (confirme R01) |
| 10b | Metricool API | « Metricool API (Zapier, Make) » à partir d'Advanced (43 à 130 € par mois en annuel) et Custom | metricool.com/pricing, help.metricool.com | idem | aucun (confirme R02) |
| 10c | Blotato API et MCP | « API access (including MCP) requires a paid subscription » ; inclus sur Starter, Creator et Agency ; exclu de l'essai gratuit ; générer une clé pendant l'essai déclenche la facturation ; serveur mcp.blotato.com/mcp ; ligne « Social media API » sur Starter | help.blotato.com (documentation complète), blotato.com/pricing, blotato.com/mcp (« Updated August 2026 ») | août 2026 | R01 et R02 : lever le doute |

## 2. Détail par fait

### 2.1 Reels Instagram par API : 15 minutes et 300 Mo

La page de référence `POST /{ig-user-id}/media` donne, section « Reel Specifications » : « Duration: 15 mins maximum, 3 seconds minimum » et « File size: 300MB maximum ». Le reste des contraintes : conteneur MOV ou MP4 sans edit lists, atome moov en tête, HEVC ou H.264 progressif, GOP fermé, 4:2:0, AAC 48 kHz 1 ou 2 canaux, 23 à 60 images par seconde, 25 Mbps maximum, 128 kbps audio, 1920 pixels de large maximum, ratio 9:16 recommandé (accepté de 0,01:1 à 10:1). Les stories vidéo sont limitées à 60 secondes et 100 Mo. Les images restent en JPEG seul, 8 Mo, 320 à 1440 pixels de large, ratio 4:5 à 1,91:1. Les carrousels acceptent 10 éléments, images ou vidéos, mais pas de Reels.
Source : https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media

Le changelog de la plateforme Instagram, relu pour 2025 et 2026, ne contient aucune entrée sur la durée des Reels ; il contient en revanche trois entrées utiles à la machine : Trial Reels par API (22 avril 2026, paramètre `trial_params`), Instagram Audio API (1er juin 2026, recherche et attachement de sons au moment de la création) et étiquette IA par API (22 juin 2026, paramètre `is_ai_generated`, à poser sur le conteneur carrousel seulement pour un carrousel).
Source : https://developers.facebook.com/docs/instagram-platform/changelog

D'où venaient les 90 secondes de R05 ? De deux blogs tiers (postproxy.dev, tokportal.com) qui décrivaient l'ancien plafond. Et le « 3 secondes à 3 minutes » de R09 ? Du guide officiel Instagram pour les créateurs, qui décrit l'application et recommande 15 à 60 secondes comme « sweet spot » : exact pour l'interface, mais ce n'est pas la limite de l'API. Le guide Facebook Reels, lui, dit bien « 3 to 90 seconds » et « 30 API-published posts within a 24-hour moving period » : R05 a transposé la limite Facebook à Instagram.
Sources : https://about.instagram.com/blog/tips-and-tricks/how-to-make-instagram-reels ; https://developers.facebook.com/docs/video-api/guides/reels-publishing/

Conséquence directe : les « enseignements » de 2 à 3 minutes découpés dans un sermon se publient par l'API Instagram sans passer par un outil tiers ni par la main. La recommandation 11 de R05 (« publier à la main les clips de 2 à 3 minutes ») est caduque. La contrainte réelle devient Facebook Reels (90 secondes) et YouTube Shorts (3 minutes), pas Instagram.

Découverte annexe : deux pages officielles Meta donnent deux plafonds de publication différents. Le guide « Content Publishing » dit « Instagram accounts are limited to 100 API-published posts within a 24-hour moving period » ; la référence `media_publish` dit « An Instagram professional account can only publish 50 posts within a 24 hour moving period ». Les deux pages sont en ligne le 2 octobre 2026. Le compteur à interroger avant d'envoyer est `GET /{ig-id}/content_publishing_limit` ; la machine doit lire ce compteur plutôt que coder 100 en dur.
Sources : https://developers.facebook.com/docs/instagram-platform/content-publishing/ ; https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media_publish

### 2.2 Lignée gpt-image chez OpenAI

La page de prix OpenAI liste sept identifiants : gpt-image-2.5-sunburst, gpt-image-2.5-flare, gpt-image-2, gpt-image-1.5, gpt-image-1-mini, gpt-image-1 et chatgpt-image-latest. Prix standard par million de jetons : 2.5 Sunburst, 2.5 Flare et 2 : 5 $ texte en entrée (1,25 $ en cache), 8 $ image en entrée (2 $ en cache), 30 $ image en sortie ; 1.5 et chatgpt-image-latest : 32 $ en sortie ; 1-mini : 2 $, 2,50 $, 8 $ ; 1 : 5 $, 10 $, 40 $. Le Batch divise tout par deux. Note importante : « Cached input rates for GPT Image 2 and GPT Image 2.5 only apply to images generated with the Responses API ». La page ne publie aucun prix par image pour 2 et 2.5 ; elle renvoie au calculateur du guide, et la page modèle de 2.5 Flare précise que le calculateur de GPT Image 2 « n'estime pas la consommation de GPT Image 2.5 ».
Sources : https://developers.openai.com/api/docs/pricing ; https://developers.openai.com/api/docs/models/gpt-image-2.5-flare

Les pages modèles donnent les snapshots : gpt-image-2.5-sunburst-2026-09-08 (« editing precision ») et gpt-image-2.5-flare-2026-09-08 (« fast, high-quality everyday image generation »), qualités low, medium, high, xhigh, max et auto ; gpt-image-2-2026-04-21 ; gpt-image-1.5-2025-12-16, qualifié de « our previous image generation model », avec la seule grille par image officielle disponible : low 0,009 à 0,013 $, medium 0,034 à 0,05 $, high 0,133 à 0,20 $ selon la taille. Limites de débit de gpt-image-2 : Tier 1 : 100 000 jetons par minute et 5 images par minute ; Tier 2 : 20 images par minute ; Tier 3 : 50 ; Tier 4 : 150 ; Tier 5 : 250.
Sources : https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst ; https://developers.openai.com/api/docs/models/gpt-image-1.5 ; https://developers.openai.com/api/docs/models/gpt-image-2

La référence de l'endpoint `images/edits` confirme : « For GPT image models, you can provide up to 16 images » ; pour gpt-image-2 et 2.5, « arbitrary resolutions are supported as WIDTHxHEIGHT strings », largeur et hauteur divisibles par 16, ratio entre 1:3 et 3:1, maximum 3840×2160 ; les trois tailles standard restent 1024×1024, 1536×1024 et 1024×1536.
Source : https://developers.openai.com/api/docs/api-reference/images/createEdit

Dépréciations (page officielle) : le 22 avril 2026, OpenAI a annoncé l'arrêt de gpt-image-1 au 23 octobre 2026 ; le 2 juin 2026, l'arrêt de gpt-image-1-mini, gpt-image-1.5 et chatgpt-image-latest au 1er décembre 2026, remplacement recommandé « gpt-image-2.5-sunburst » ou « gpt-image-2.5-flare ». DALL-E 2 et 3 sont arrêtés depuis le 12 mai 2026.
Source : https://developers.openai.com/api/docs/deprecations

Arbitrage : R01 avait la bonne liste de modèles mais une mauvaise date (le 23 octobre concerne gpt-image-1, pas 1.5) et présentait gpt-image-2 comme modèle courant alors que la génération 2.5 est sortie le 8 septembre 2026. R03 est juste sur la lignée et les 16 références, mais ses prix par image (0,006 / 0,0133 / 0,053 $) sont des prix fal.ai, pas des prix OpenAI : OpenAI facture en jetons et ne publie pas d'équivalent par image pour 2.5. R05 cite « gpt-image-2 qualité moyenne environ 0,053 $ » : chiffre tiers (aifreeapi), à remplacer par une mesure réelle. Le seul moyen de connaître le coût unitaire réel de 2.5 par qualité est de lire `usage` sur vingt générations, comme R03 le proposait déjà en incertitude 1.

### 2.3 Prix Claude

Page officielle lue le 2 octobre 2026. Claude Opus 5.5 : 4 $ en entrée, 20 $ en sortie, écriture de cache 5 minutes 5 $, 1 heure 8 $, lecture de cache 0,20 $ ; note 2 : « Cache hits and refreshes on Claude Opus 5.5 are priced at 0.05x the base input price ». Claude Opus 5 : 5 $, 25 $, cache 6,25 $, 10 $, lecture 0,50 $. Claude Sonnet 5.5 : 2 $, 10 $, lecture 0,20 $. Claude Sonnet 5 : 2 $ et 10 $, prix introductif devenu définitif (la hausse à 3 et 15 $ prévue le 1er septembre 2026 « will not occur »). Claude Haiku 4.5 : 1 $, 5 $, lecture 0,10 $. Nouveauté absente de tous les rapports : Claude Fable 5.1 (et Mythos 5.1, accès limité) à 10 $ et 50 $, lecture de cache 0,25 $ (0,025x) ; Claude Fable 5 au même prix mais cache à 1 $. Batch : moitié prix partout (Opus 5.5 : 2 et 10 $ ; Fable 5.1 : 5 et 25 $). Fast mode : Opus 5.5 à 8 et 40 $, Opus 5 et 4.8 à 10 et 50 $, API directe seulement. Recherche web : 10 $ pour 1 000 recherches ; web fetch sans supplément ; exécution de code gratuite avec web_search ou web_fetch, sinon 1 550 heures gratuites par mois puis 0,05 $ par heure et par conteneur. Managed Agents : 0,08 $ par heure de session. Le tokenizer des modèles 4.7 et suivants produit « approximately 30% more tokens for the same text ».
Sources : https://platform.claude.com/docs/en/about-claude/pricing ; https://claude.com/pricing

Arbitrage : R05, R06 et R07 (table en cache du 25 septembre 2026) sont exacts à la ligne près ; R07 est seulement incomplet (pas de Fable 5.1). R11 est à corriger : « Opus 5 à 5 USD » est vrai mais ce n'est plus le modèle de référence ; « lecture de cache à 5 à 10 % du tarif » devient : 5 % sur Opus 5.5, 10 % ailleurs, 2,5 % sur Fable 5.1. La note tokenizer (+30 % de jetons) manque dans les chiffrages de R05 et R07 et augmente mécaniquement d'un tiers les coûts d'entrée estimés.

### 2.4 Higgsfield : conditions, clause anti-automatisation, API, prix, Seedance 2.5

Conditions d'utilisation. L'URL exacte est https://higgsfield.ai/terms-of-use-agreement (les URL /terms, /terms-of-use, /terms-of-service, /legal, /tos répondent 404 ; le lien figure dans le pied de page et dans la politique de confidentialité). « Last updated: July 26, 2026. Effective: immediately for users who register on or after July 26, 2026; on August 27, 2026 for users who registered before July 26, 2026 ». Clauses pertinentes :
- Section 10.6, Unlimited Use Plans : « model usage under subscription tiers marketed as “Unlimited” is subject to Company's fair-use limits and the dynamic speed and concurrency limitations described below. Company may restrict, suspend, throttle, or place on a slower processing queue usage that is automated or materially exceeds typical individual use ». Les modèles Unlimited tournent « on a dedicated processing queue, separate from the priority queue used for credit-based generations ».
- Section 5.2 (vi) : interdiction d'utiliser « spiders, robots, crawlers, avatars, data-mining tools » pour extraire des données du service ; 5.2 (i) : interdiction de « license, resell, rent, transfer... or otherwise commercially exploit the Service ».
- Section 2.4 : « You may not share your Account or login credentials with anyone ».
- Section 4.4 : « Company does not claim ownership of any of your Inputs or Outputs, nor does it restrict your commercial use of Outputs » ; les droits survivent à la résiliation et sont transférables aux clients. Mais la même section ajoute que les contenus, entrées et sorties « may be used by Company to train, develop, enhance... its AI models », sauf pour les clients sous Enterprise Agreement.
- Section 11.12, Agent and Automated Access : l'utilisateur est « solely responsible » des actions de tout agent, plateforme d'automatisation ou outil d'orchestration connecté « including via MCP » ; « Company treats all activity conducted through your Developer Access as your activity ». Section 11.13 couvre les clients MCP tiers (Claude compris). Section 1.5 autorise « rate limiting, throttling, queuing, or temporary suspension » ; 11.9 permet de suspendre immédiatement l'accès développeur en cas de risque.
Source : https://higgsfield.ai/terms-of-use-agreement

La phrase courte citée par R04 (« automation, scripting, credential sharing and reselling ») ne vient pas des conditions mais du centre d'aide, article « What are Unlimited models and which plans include them » (publié le 3 août 2026, modifié le 28 août 2026) : « Unlimited access applies only on higgsfield.ai: outside it, generations always deduct credits » et « Automation tools, scripting, credential sharing, and reselling access are strictly prohibited ». Concurrence : 1 vidéo à la fois, 2 images simultanées en Unlimited.
Source : https://higgsfield.ai/creator-hub/help-center/credits/what-are-unlimited-models-and-which-plans-include-them

Le blog officiel « Credits vs Unlimited » (prix vérifiés le 11 septembre 2026) confirme : « Unlimited applies on higgsfield.ai; MCP, CLI, Canvas, and Supercomputer run on credits », et cite Starter 15 $, Plus 49 $, Ultra 129 $ par mois. L'analyse Krea du 5 septembre 2026 donne Starter 19 $ (270 crédits), Plus 47 $ en annuel ou 59 $ en mensuel (1 200 crédits), Ultra 99 $ en annuel ou 129 $ en mensuel (3 000 crédits) et « Seedance 2.5 uses 52 credits for eight seconds at 720p ». Les deux grilles ne coïncident pas (15 contre 19 $, 49 contre 47 ou 59 $) : la page officielle de prix est rendue en JavaScript et n'a pas pu être lue ; retenir la grille de la page officielle au moment de l'achat.
Sources : https://higgsfield.ai/blog/credits-vs-unlimited-ai-video-generation ; https://www.krea.ai/blog/higgsfield-pricing-explained-2026-unlimited-credits-and-real-monthly-costs

API publique. Le changelog officiel date le lancement de l'API « standalone » au 16 septembre 2026 : « Pay per generation. No subscriptions or seats; public per-model rates », 50 modèles et plus, remise de lancement « 15% off all models, up to 50% off on 4 models of your choice ». La console open.higgsfield.ai (anciennement console.higgsfield.ai, redirection 301) affiche sans connexion des prix en dollars : Seedance 2.5 0,2057 $ par seconde ; Kling 3.0 0,084 $ par seconde ; Wan 3.0 Prime à partir de 0,068 $ par seconde ; Cinema Studio 4.0 à partir de 0,2057 $ par seconde ; Genjutsu à partir de 0,318 $ par seconde ; Marketing Studio Image à partir de 0,0162 $ par image ; Soul 2 à partir de 0,0032 $ par image ; Z-Image Turbo 0,015 $ par image ; Grok Imagine 2.0 à partir de 0,04 $ par image. La documentation (docs.higgsfield.ai) explique que l'API facture « successful generation requests using account credits », que les requêtes « failed » ou « nsfw » ne sont pas facturées, que les crédits expirent après un an, que les sorties restent disponibles « at least seven days », et que les limites de débit « depend on the account and the selected model » (exemple d'erreur : 4 requêtes concurrentes). Exemple d'estimation documenté : 1,500 crédit = 0,094 $, soit environ 0,063 $ par crédit.
Sources : https://higgsfield.ai/changelog ; https://open.higgsfield.ai/ ; https://docs.higgsfield.ai/docs/concepts/billing-and-retention.md ; https://docs.higgsfield.ai/docs/concepts/rate-limits.md

Seedance 2.5. La documentation API du endpoint text-to-video donne `duration` minimum 4, maximum 30, défaut 5 ; résolutions 480p, 720p, 1080p ; ratios 16:9, 4:3, 1:1, 3:4, 9:16, 21:9. Le centre d'aide (article modifié le 9 septembre 2026) dit pour le site : Seedance 2.5 « 4s to 30s », jusqu'à 1080p « on Pro and Plus plans and above », non inclus dans Starter et Basic ; Seedance 2.0 « 4s to 15s », 480p à 4K. Le changelog du 6 août 2026 confirme 30 secondes et jusqu'à 50 références. Le MCP officiel (higgsfield.ai/mcp) liste « 30+ models » dont Seedance 2.5, « no API key required », sans prix.
Sources : https://docs.higgsfield.ai/docs/models/seedance-2-5/text-to-video.md ; https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-seedance ; https://higgsfield.ai/mcp

Arbitrage : R04 est confirmé sur tout et gagne une URL de conditions exacte avec numéros de sections ; R01 est à corriger (« sans API publique », « n'a pas d'API ») ; le « 15 s » du skill de production vidéo de José est un réglage choisi, pas une limite du modèle. À 0,2057 $ par seconde, un clip Seedance 2.5 de 15 secondes coûte 3,09 $ par l'API Higgsfield, contre 0,3024 $ par seconde chez fal pour Seedance 2.0 en 720p (R04) : l'API Higgsfield n'est pas la voie la moins chère pour Seedance, elle l'est pour Kling 3.0 (0,084 $ par seconde, soit 1,26 $ les 15 secondes).

### 2.5 Hootsuite

La page officielle des plans affiche quatre paliers (Standard, 10 comptes ; Professional, « most popular », comptes illimités ; Advanced ; Enterprise sur devis), sans montant dans les cartes (sélection régionale), mais la FAQ de la même page écrit : « Hootsuite pricing is tiered based on your plan type. Paid plans start at $99 for a Standard plan, $199 for a Professional plan, and range up to $399 for an Advanced plan. Custom solutions are available for Enterprise organizations ». La page précise que les prix sont « based on annual billing, but do not include applicable taxes », par utilisateur et par mois, essai 14 jours. La devise n'est pas écrite dans la FAQ ; le symbole $ et le site .com désignent le dollar américain par défaut.
Source : https://www.hootsuite.com/plans ; https://www.hootsuite.com/pricing

Arbitrage : R01 avait les bons chiffres et une réserve inutile ; la grille est officielle.

### 2.6 Hashtags Instagram : 5 au maximum

L'article du centre d'aide Instagram « Use hashtags on Instagram » (identifiant 351460621611097) est rendu en JavaScript sur help.instagram.com, mais sa copie sur facebook.com/help/instagram/351460621611097 est lisible : « You can use up to 5 tags on a post. If you include more than 5 tags on a single photo/video, your comment won't post ». L'article n'est pas daté. Later (article mis à jour le 21 avril 2026) situe le passage de 30 à 5 en décembre 2025 ; aucune page Meta datée ne confirme le mois.
Sources : https://www.facebook.com/help/instagram/351460621611097 ; https://later.com/blog/instagram-hashtags/

Arbitrage : R09 est confirmé par une page officielle ; la doctrine « 3 à 5 hashtags » de José devient une contrainte dure à encoder dans le générateur de légendes.

### 2.7 TikTok non audité : 5 utilisateurs, pas 5 publications

Les Content Sharing Guidelines disent : « Unaudited API Clients can only post contents in SELF_ONLY viewership », « All user accounts using the API client to post must be set to private at the time of posting » et « Unaudited API Clients can allow up to 5 users to post in a 24 hour window ». Pour tous les clients : « There is a limit on the number of posts that can be made to a creator account in a 24-hour window via Direct Post API. The upper limit may vary among creators (typically around 15 posts per day/ creator account) ». La référence Direct Post ajoute « Each user access_token is limited to 6 requests per minute », les niveaux PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, FOLLOWER_OF_CREATOR, SELF_ONLY, et les codes d'erreur `unaudited_client_can_only_post_to_private_accounts`, `spam_risk_too_many_posts` et `reached_active_user_cap`. L'URL « content-posting-api-reference-guidelines » citée dans la mission répond 404 ; la page vivante est « content-sharing-guidelines ».
Sources : https://developers.tiktok.com/doc/content-sharing-guidelines/ ; https://developers.tiktok.com/doc/content-posting-api-reference-direct-post ; https://developers.tiktok.com/doc/content-posting-api-get-started/

Arbitrage : R05 avait raison (5 utilisateurs), R02 est à corriger (il avait placé la bonne valeur en « source secondaire »). Conséquence : avant audit, la machine peut tester avec au plus 5 comptes clients, tous en privé ; l'audit est le vrai verrou, pas le nombre de posts.

### 2.8 Politique Meta santé et apparence : 23 juillet 2026

La page des Advertising Standards « Health and wellness » affiche un journal de modifications avec trois entrées : « Today », « Jul 23, 2026 » et « Dec 27, 2024 ». Le texte en vigueur : les publicités « can't » contenir de « statements of inferiority about physical appearance » ni de gros plan « pinching fat », ni de « clickbait tactics » avec « promises of specific outcomes within a set timeframe without disclaimers » ; pour un public de 18 ans et plus, les annonceurs peuvent montrer « general cosmetic products, procedures, surgeries depicting before and after transformation », les chirurgies (augmentation et réduction mammaire, abdominoplastie, blépharoplastie, rhinoplastie), et les « dietary weight loss or weight gain products » en montrant usage et résultats avec le temps nécessaire indiqué ; « Ads promoting or marketing dietary, health, or weight loss or weight gain products and services must be targeted to people at least 18 years or older ». Le contenu détaillé des entrées de changelog n'est pas rendu dans la page telle que lue ; la version antérieure au 23 juillet 2026 n'a pas pu être comparée mot à mot.
Source : https://transparency.meta.com/policies/ad-standards/restricted-goods-services/health-wellness/

Arbitrage : R03 est juste sur le fond et faux d'un jour sur la date (23 juillet, pas 22) ; R09 citait la mise à jour du 27 décembre 2024 comme dernière, ce qui était vrai avant juillet 2026 et ne l'est plus. Les deux rapports convergent sur la règle utile pour la cliente beauté : avant/après autorisé, audience 18 ans et plus, aucune promesse chiffrée dans un délai sans avertissement, aucun message d'infériorité.

### 2.9 Loi 25 du Québec : montants officiels

La page de la Commission d'accès à l'information « Sanctions aux entreprises et poursuites » écrit : « La Commission peut imposer des sanctions administratives pécuniaires aux entreprises qui commettent un manquement à certaines obligations de la Loi sur le privé. Ces sanctions peuvent atteindre jusqu'à 2 % de leur chiffre d'affaires mondial ou 10 millions de dollars ». Pour les poursuites pénales : personne physique « 5 000 $ à 100 000 $ » ; entreprise « entre 15 000 $ et, selon le montant le plus élevé, 25 M$ ou un montant correspondant à 4 % de son chiffre d'affaires mondial de l'exercice financier précédent » ; « En cas de récidive, les amendes sont doublées ». La page n'affiche pas de date de mise à jour. Le texte de loi (P-39.1, articles 90.12 et 91) sur LégisQuébec et CanLII répond 403 au robot ; le montant administratif applicable à une personne physique (50 000 $ dans la loi) n'a donc pas pu être lu sur page officielle et reste non confirmé ici.
Source : https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/sanctions-entreprises-poursuites

Arbitrage : la mémoire de R08 était exacte ; la réserve est levée pour les entreprises. R09 et R11 doivent citer la page de la CAI.

### 2.10 Metricool et Blotato : MCP et API par plan

Metricool. La page de prix coche « Metricool MCP » sous « Measure & Grow » pour tous les plans, Free compris (Free : 1 marque, données sur 30 jours, 20 publications par mois ; Starter 16 à 29 € par mois pour 5 à 10 marques ; Advanced 43 à 130 € par mois en annuel, 53 à 210 $ en mensuel, pour 15 à 50 marques ; Custom sur devis). « Metricool API (Zapier, Make) » n'est coché qu'à partir d'Advanced ; le « Post approval system » aussi ; le « White Label » est réservé à Custom. La page metricool.com/mcp confirme : le MCP « funciona con cualquier plan de Metricool, incluida la cuenta gratuita », connexion par connecteur vérifié dans Claude, OAuth ou jetons `METRICOOL_USER_TOKEN` et `METRICOOL_USER_ID`, clients cités : Claude Code, Claude Desktop, ChatGPT (Developer Mode), Cursor, Le Chat, Make, n8n. Le centre d'aide répète : « The Metricool API is available on Advanced and Custom plans ».
Sources : https://metricool.com/pricing/ ; https://metricool.com/mcp/ ; https://help.metricool.com/api-access-export-your-metricool-data-to-other-tools-and-automate-tasks-x8ln5

Blotato. La page de prix liste sur Starter (29 $ par mois, 1 250 crédits, 20 comptes, 1 000 contacts actifs) les lignes « Social media API », « n8n & Make official nodes » et « Up to 900 TikTok posts/month » ; Creator (97 $, 5 000 crédits, 40 comptes, 6 000 contacts) et Agency (499 $, 28 000 crédits, 15 000 contacts, « dedicated video processing ») héritent de tout ; le nombre de comptes d'Agency n'est pas écrit sur la page. La documentation complète (help.blotato.com, fichier llms-full.txt) tranche : « API and MCP access is included in paid Starter, Creator, and Agency subscriptions. The free trial does not include API or MCP access. Generating an API key during a trial ends the trial and starts the paid subscription ». Serveur MCP distant : https://mcp.blotato.com/mcp (OAuth ou en-tête `blotato-api-key`), API REST https://backend.blotato.com/v2 ; limites : 30 requêtes par minute sur Upload Media et sur Publish Post, 120 par minute sur d'autres routes ; paramètre `trial` pour les Trial Reels Instagram (`graduationStrategy` MANUAL ou SS_PERFORMANCE) et `isAiGenerated`. La page blotato.com/mcp est datée « Updated August 2026 ».
Sources : https://www.blotato.com/pricing ; https://www.blotato.com/mcp ; https://help.blotato.com/llms-full.txt ; https://help.blotato.com/settings/api-keys.md

Arbitrage : R01 et R02 sont confirmés et complétés ; le doute « API absente de la page de prix » est levé : la ligne « Social media API » figure sur Starter, et le MCP est inclus dans tout plan payant.

## 3. Découvertes annexes qui touchent la conception

1. Instagram, deux plafonds officiels contradictoires (50 et 100 publications par 24 heures) : coder la lecture de `content_publishing_limit` et ne jamais supposer 100.
2. Instagram, étiquette IA par API (`is_ai_generated`, 22 juin 2026) et Audio API (1er juin 2026) : la machine peut déclarer le contenu synthétique et attacher un son tendance au moment de la publication, sans passer par l'application.
3. Instagram, Trial Reels par API (22 avril 2026) : un clip de sermon peut être montré d'abord aux non-abonnés et « gradué » selon la performance ; Blotato expose déjà ce paramètre.
4. Claude Fable 5.1 (10 et 50 $, cache à 0,025x) existe et n'apparaît dans aucun rapport ; à réserver aux tâches longues d'agent, pas à la rédaction de posts.
5. Le tokenizer des modèles Claude 4.7 et suivants produit environ 30 % de jetons en plus : les chiffrages de R05 et R07 sont à majorer d'un tiers sur l'entrée.
6. Higgsfield, section 4.4 : hors contrat Enterprise, les entrées et sorties peuvent servir à entraîner les modèles de Higgsfield. Les packshots d'une cliente beauté et les visages d'un pasteur envoyés en référence tombent sous cette clause ; à mentionner au client ou à exclure.
7. Higgsfield, section 11.12 : le pilotage par MCP ou agent est explicitement prévu et autorisé par l'API ; c'est le pilotage navigateur de l'Unlimited qui reste contraire à la section 10.6 et au centre d'aide.
8. OpenAI, les tarifs en cache de GPT Image 2 et 2.5 ne s'appliquent qu'avec la Responses API : la machine doit générer via Responses, pas via `images/generations`, pour profiter de l'entrée image à 2 $ au lieu de 8 $ quand elle réutilise les mêmes références.
9. gpt-image-1 disparaît le 23 octobre 2026 et gpt-image-1.5 le 1er décembre 2026 : tout code qui nomme encore ces modèles cassera dans les 60 jours.
10. Blotato annonce « Up to 900 TikTok posts/month » sur Starter et porte l'audit TikTok à la place de l'intégrateur : pour un lancement rapide des clients église et beauté sur TikTok, c'est la voie la plus courte.

## 4. Incertitudes et points à vérifier

1. Instagram, application : le guide officiel dit 3 minutes, l'API accepte 15 minutes ; la limite réelle de l'application en octobre 2026 (certains comptes ont vu des Reels plus longs) n'a pas été vérifiée sur une page datée. Sans conséquence pour la publication par API.
2. Instagram, 50 contre 100 publications par 24 heures : les deux pages Meta sont en ligne ; seule la lecture du compteur fera foi. Tester sur un compte de test.
3. Meta, changelog du 23 juillet 2026 : le contenu du changement n'est pas rendu dans la page lue ; la différence exacte entre la version du 27 décembre 2024 et celle du 23 juillet 2026 n'a pas pu être établie. Relire la page dans un navigateur et archiver une capture datée.
4. Loi 25 : montant administratif pour une personne physique non lu sur page officielle (LégisQuébec et CanLII refusent le robot). À lire dans un navigateur, article 90.12 de la loi P-39.1.
5. Higgsfield, grille d'abonnements : page de prix non lisible par robot ; le blog officiel (15, 49, 129 $) et Krea (19, 47 ou 59, 99 ou 129 $) divergent. Relever dans le compte de José.
6. Higgsfield, prix API : la console affiche des prix « from » pour plusieurs modèles ; le prix exact de Seedance 2.5 en 1080p ou avec audio, et celui de Nano Banana Pro et GPT Image 2.5 via Higgsfield, n'ont pas été relevés. Les remises de lancement (15 %, jusqu'à 50 % sur 4 modèles) ont une durée non précisée.
7. Higgsfield, taux de conversion crédit vers dollar : 0,063 $ par crédit d'après un exemple de documentation, à confirmer sur une estimation réelle.
8. OpenAI, coût par image de gpt-image-2.5 par qualité (low à max) : aucune grille officielle ; mesurer `usage` sur vingt générations par qualité.
9. Hashtags Instagram : la date du passage à 5 (décembre 2025 selon Later) ne figure sur aucune page Meta datée.
10. TikTok : le « typically around 15 posts per day » est indicatif ; la limite par créateur se lit dans `creator_info/query`.
11. Hootsuite : la devise n'est pas écrite dans la FAQ ; depuis le Canada, la page peut afficher des montants en dollars canadiens.
12. Blotato : nombre de comptes du plan Agency non écrit sur la page de prix (R02 citait 100 : source non retrouvée).
13. Claude : la page de prix mentionne un tokenizer plus dense « for Claude 4.7 and later » ; l'impact exact sur du français n'est pas chiffré ; le mesurer avec `count_tokens` sur un cerveau de marque réel.

## 5. Implications pour la machine de José

1. Produire par défaut, pour chaque sermon, un format long de 2 à 3 minutes destiné à Instagram Reels et YouTube Shorts, en plus des 30 à 60 secondes ; l'API Instagram accepte 15 minutes et 300 Mo, la contrainte de 90 secondes ne s'applique qu'à Facebook Reels. Le planificateur refuse un clip de plus de 90 secondes pour Facebook et de plus de 3 minutes pour Shorts, et laisse passer jusqu'à 15 minutes pour Instagram.
2. Encoder les contraintes d'encodage Instagram dans le rendu ffmpeg : MP4 sans edit lists, moov en tête, H.264 progressif GOP fermé 4:2:0, AAC 48 kHz 128 kbps, 23 à 60 images par seconde, 25 Mbps maximum, 300 Mo maximum ; viser 1080×1920 à 8 Mbps pour rester sous 300 Mo même à 3 minutes.
3. Lire `content_publishing_limit` avant chaque publication Instagram et traiter 50 comme plafond prudent tant que le compteur n'a pas prouvé 100 ; journaliser la valeur renvoyée pour trancher.
4. Poser `is_ai_generated: true` sur tout média photoréaliste généré (et sur le conteneur carrousel seulement) ; c'est à la fois une obligation de politique Meta et une protection pour le client. Prévoir le champ équivalent sur TikTok (`containsSyntheticMedia` chez Blotato).
5. Utiliser les Trial Reels par API pour les clips de sermon et les lancements produit : montrer d'abord aux non-abonnés, graduer sur performance ; la machine apprend ainsi quel hook marche sans exposer la communauté à un raté.
6. Basculer la génération d'images sur gpt-image-2.5-flare (brouillons et planches en low, production en high) et gpt-image-2.5-sunburst pour l'édition masquée, via la Responses API pour bénéficier de l'entrée image en cache à 2 $ par million de jetons ; retirer gpt-image-1 avant le 23 octobre 2026 et gpt-image-1.5 avant le 1er décembre 2026 de tout code et de toute fiche de coût.
7. Mesurer le coût réel par image de 2.5 par qualité sur vingt générations (lecture de `usage`) et stocker ce coût par client ; ne plus citer de prix par image tiers (fal, aifreeapi) dans les devis.
8. Chiffrer les coûts LLM avec la grille officielle : Opus 5.5 4 et 20 $ (cache 0,20 $), Sonnet 5.5 2 et 10 $, Haiku 4.5 1 et 5 $, et majorer les entrées de 30 % pour le tokenizer ; réserver Fable 5.1 (10 et 50 $) aux sessions d'agent longues (orchestration d'un sermon complet, revue mensuelle), jamais à la génération de légendes.
9. Ne pas changer de modèle en cours de conversation (le cache est par modèle) et placer le cerveau de marque derrière un `cache_control` 1 heure ; sur Opus 5.5 la lecture à 0,05x rend le cache rentable dès la première relecture en TTL 5 minutes.
10. Sortir définitivement le pilotage navigateur de l'Unlimited Higgsfield du chemin critique : la section 10.6 des conditions (26 juillet 2026) et le centre d'aide (28 août 2026) l'interdisent et autorisent la suspension ; garder l'Unlimited comme atelier manuel de José. Pour la plateforme, utiliser l'API Higgsfield (section 11.12 : usage par agent et MCP explicitement prévu) ou les API directes.
11. Choisir le moteur vidéo par prix et par besoin : Kling 3.0 via l'API Higgsfield à 0,084 $ par seconde (1,26 $ les 15 secondes) pour les clips produit et ambiance ; Seedance 2.5 (0,2057 $ par seconde chez Higgsfield, soit 3,09 $ les 15 secondes et 6,17 $ les 30 secondes) seulement pour les scènes signature multi-références ; les durées 4 à 30 secondes de Seedance 2.5 permettent un plan de 20 à 30 secondes d'une seule génération, ce qui réduit les raccords.
12. Informer chaque client, dans le contrat d'agence, que les références envoyées à Higgsfield hors contrat Enterprise peuvent servir à l'entraînement (section 4.4) ; exclure les visages de pasteurs et les enfants des références Higgsfield, ou négocier un contrat Enterprise si le volume le justifie.
13. Encoder le plafond de 5 hashtags Instagram comme contrainte dure du générateur de légendes (la doctrine 3 à 5 de José devient la règle), avec rejet automatique au-delà de 5 et table de hashtags « de fête » par pays.
14. Sur TikTok, limiter la phase pré-audit à 5 comptes clients en privé et respecter 6 requêtes par minute par jeton ; déposer l'audit dès le premier mois ou passer par Blotato (29 $ par mois, « up to 900 TikTok posts/month », audit porté par Blotato) pour les clients église et beauté pressés.
15. Pour la cliente beauté, intégrer dans le profil de conformité la règle Meta du 23 juillet 2026 : avant/après autorisé, audience 18 ans et plus, pas de promesse chiffrée dans un délai sans avertissement, pas de message d'infériorité, pas de gros plan « pinching fat » ; archiver une capture datée de la page de politique à chaque campagne.
16. Inscrire dans le dossier juridique de l'agence les montants officiels de la Loi 25 (jusqu'à 10 M$ ou 2 % du chiffre d'affaires mondial en administratif ; 15 000 $ à 25 M$ ou 4 % au pénal pour une entreprise, doublés en cas de récidive) avec la source CAI, et désigner José comme responsable de la protection des renseignements personnels pour Markel-Tech.
17. Prévoir deux sorties de secours vers le marché : le MCP Metricool (inclus même en plan Free, OAuth ou jetons) pour un client qui a déjà Metricool, et le MCP Blotato (mcp.blotato.com/mcp, tout plan payant) comme couche de publication de repli ; l'API Metricool, elle, exige le plan Advanced (43 € par mois minimum).
18. Pour comparer Hootsuite dans les argumentaires commerciaux, citer la FAQ officielle (99, 199, 399 $ par utilisateur et par mois en annuel) plutôt que des blogs : à trois sièges, Hootsuite Professional coûte 597 $ par mois, soit l'équivalent de 2 à 3 clients « tout compris » de la machine.
19. Mettre en place un contrôle trimestriel automatique des pages primaires citées ici (prix OpenAI et Claude, dépréciations, référence ig-user/media, guidelines TikTok, conditions Higgsfield, page CAI) avec diff et alerte WhatsApp ; sur dix faits, six avaient bougé en moins de six mois.
20. Corriger les rapports : R01 (API Higgsfield, dates gpt-image), R02 (TikTok 5 utilisateurs, taille 300 Mo confirmée, plafond 50 ou 100), R03 (23 juillet, prix fal à requalifier), R05 (Reels 15 minutes, prix gpt-image tiers), R09 (politique Meta datée, limite application contre API), R11 (grille Claude et cache).

## Sources

Pages officielles lues le 2 octobre 2026 :
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media_publish
- https://developers.facebook.com/docs/instagram-platform/content-publishing/
- https://developers.facebook.com/docs/instagram-platform/changelog
- https://developers.facebook.com/docs/video-api/guides/reels-publishing/
- https://about.instagram.com/blog/tips-and-tricks/how-to-make-instagram-reels
- https://www.facebook.com/help/instagram/351460621611097
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/deprecations
- https://developers.openai.com/api/docs/models/gpt-image-2.5-flare
- https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
- https://developers.openai.com/api/docs/models/gpt-image-2
- https://developers.openai.com/api/docs/models/gpt-image-1.5
- https://developers.openai.com/api/docs/guides/image-generation
- https://developers.openai.com/api/docs/api-reference/images/createEdit
- https://platform.claude.com/docs/en/about-claude/pricing
- https://claude.com/pricing
- https://higgsfield.ai/terms-of-use-agreement
- https://higgsfield.ai/privacy-policy
- https://higgsfield.ai/changelog
- https://higgsfield.ai/mcp
- https://higgsfield.ai/blog/credits-vs-unlimited-ai-video-generation
- https://higgsfield.ai/creator-hub/help-center
- https://higgsfield.ai/creator-hub/help-center/credits/what-are-unlimited-models-and-which-plans-include-them
- https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-seedance
- https://open.higgsfield.ai/
- https://docs.higgsfield.ai/
- https://docs.higgsfield.ai/docs/llms.txt
- https://docs.higgsfield.ai/docs/models/seedance-2-5/text-to-video.md
- https://docs.higgsfield.ai/docs/concepts/billing-and-retention.md
- https://docs.higgsfield.ai/docs/concepts/rate-limits.md
- https://www.hootsuite.com/plans
- https://www.hootsuite.com/pricing
- https://developers.tiktok.com/doc/content-sharing-guidelines/
- https://developers.tiktok.com/doc/content-posting-api-get-started/
- https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- https://transparency.meta.com/policies/ad-standards/restricted-goods-services/health-wellness/
- https://transparency.meta.com/policies/ad-standards/
- https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/sanctions-entreprises-poursuites
- https://www.cai.gouv.qc.ca/entreprises/
- https://metricool.com/pricing/
- https://metricool.com/mcp/
- https://help.metricool.com/api-access-export-your-metricool-data-to-other-tools-and-automate-tasks-x8ln5
- https://www.blotato.com/pricing
- https://www.blotato.com/mcp
- https://help.blotato.com/llms-full.txt
- https://help.blotato.com/settings/api-keys.md

Sources tierces datées, utilisées seulement en complément :
- https://later.com/blog/instagram-hashtags/ (mis à jour le 21 avril 2026)
- https://www.krea.ai/blog/higgsfield-pricing-explained-2026-unlimited-credits-and-real-monthly-costs (5 septembre 2026)

Pages tentées sans succès (404, 403 ou rendu JavaScript) : higgsfield.ai/terms, /terms-of-use, /terms-of-service, /legal, /tos ; docs.higgsfield.ai/pricing ; higgsfield.ai/pricing (contenu non rendu) ; developers.tiktok.com/doc/content-posting-api-reference-guidelines ; help.instagram.com/351460621611097 et /270963803047681 (rendu JavaScript) ; about.instagram.com/blog/announcements/reels-3-minutes ; legisquebec.gouv.qc.ca et canlii.org (403) ; cai.gouv.qc.ca/protection-renseignements-personnels/sanctions-et-recours/ ; openai.com/index/gpt-image-2-5/ (403) ; facebook.com/business/help pages de politique (404).
