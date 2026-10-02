# R01. Marché et concurrence des outils de social media « IA » en 2026

Rapport de recherche pour le projet de « machine » social media multi-clients de José Kouadio (Markel-Tech, SEVARTA, 2IAE). Date de rédaction : 1er octobre 2026. Toutes les données de prix sont celles affichées en ligne entre septembre et octobre 2026, sauf mention contraire. Lorsqu'une page officielle n'affichait pas le prix (Hootsuite, Higgsfield), la valeur vient d'une source tierce datée et le fait est signalé en incertitude.

## 1. Résumé exécutif

Le marché 2026 des outils de gestion de réseaux sociaux « avec IA » compte une soixantaine d'acteurs sérieux, répartis en huit familles : les suites historiques (Hootsuite, Sprout Social, Agorapulse, Sendible), les planificateurs à prix doux (Buffer, Metricool, Vista Social, Publer, SocialBee, ContentStudio, Later, Loomly, Planable), les générateurs « IA natifs » (Predis.ai, Blaze.ai, Ocoya, Blotato, FeedHive, Lately), l'open source (Postiz, Mixpost), les découpeurs de longs formats (OpusClip, Vizard, Klap, Submagic, Munch, Castmagic), les studios vidéo et avatars (HeyGen, Creatify, Arcads, Captions/Mirage, InVideo, Pictory, Lumen5, Canva, Adobe Express), les plateformes d'agents et d'automatisation (n8n, Make, Zapier Agents, Lindy, Relevance AI, Manus, Genspark, Claude Cowork, Claude Code) et les niches verticales (Sermon Shots et Pulpit AI pour les églises, Swello en France).

Trois constats structurent ce rapport.

Premier constat : personne ne ferme la boucle complète « veille → idées → planche de propositions → validation client → production vidéo réelle → publication → mesure » pour plusieurs clients à la fois. Les suites historiques ont la veille (Hootsuite Listening via Talkwalker et son moteur Blue Silk), l'approbation et la mesure, mais leur « IA » génère des légendes, pas des vidéos. Les générateurs IA natifs (Predis, Blotato, ContentStudio) produisent des vidéos de template ou des « faceless videos » à base de stock, mais n'ont ni veille sérieuse ni portail client. Les découpeurs (OpusClip, Vizard) font du clip, mais pas d'animation ni de calendrier éditorial. Les agents (Claude Cowork, n8n) peuvent tout orchestrer, mais ne détiennent aucun jeton OAuth de publication et aucun portail client : il faut leur ajouter une couche de publication (Postiz, Blotato, Buffer, API Meta).

Deuxième constat : la vraie vidéo générative (Seedance, Kling, Veo) reste hors des suites de gestion. Elle vit chez Higgsfield (sans API publique), chez les agrégateurs d'API (fal.ai, Krea, CometAPI) et chez Canva (Veo 3). Les suites qui disent « AI video » (Predis, Blotato, Postiz, ContentStudio) vendent des vidéos de montage automatique (stock + voix + sous-titres) ou de petits quotas de génération.

Troisième constat : le marché francophone et africain est servi par défaut en anglais. Swello (France) est le seul outil francophone natif identifié ; il n'a ni génération vidéo ni portail client élaboré. Aucun outil identifié ne traite le cas « église francophone d'Afrique de l'Ouest avec sermon YouTube de deux heures ».

La machine de José peut être supérieure non pas en imitant ces outils, mais en assemblant ce qu'ils ne font pas ensemble : une veille par client, une planche de propositions visuelle validée en un tap par WhatsApp, une production vidéo pilotée par agent (Higgsfield via navigateur, Claude Design pour l'animation HTML, API Kling ou Seedance pour la génération), un gestionnaire humain dans la boucle, et une publication directe via les API officielles ou via Postiz auto-hébergé.

## 2. Périmètre et méthode

Trente-trois recherches web distinctes et vingt-quatre pages primaires ouvertes (pages de prix officielles de Sprout Social, Metricool, Vista Social, OpusClip, Postiz, Blotato, Predis, Planable, ContentStudio, Buffer, Agorapulse, HeyGen, Vizard, Hootsuite, documentation de prix OpenAI, articles datés de Krea, Blotato, ReachRight, Carly). Les prix sont donnés en dollars US sauf mention (euros pour Metricool, Simplified, FeedHive, Swello). Les prix « annuels » sont les prix mensuels équivalents en facturation annuelle.

Grille d'évaluation, appliquée à chaque outil majeur : veille et tendances ; génération de textes ; génération d'images ; génération de vidéos (réelle ou par template) ; approbation client ; portail client ; multi-marques et agence ; publication directe par plateforme ; analytics ; réponses aux commentaires ; prix ; limites ; réputation.

## 3. Cartographie par famille

### 3.1 Les suites historiques

**Hootsuite.** Le 24 juin 2026, Hootsuite a annoncé sa reconstruction « pour l'ère de l'IA » autour de Wisdom, un agent qui remplace OwlyWriter, OwlyGPT et Yeti, inclus dans tous les plans. Wisdom s'appuie sur plus de 150 millions de sources surveillées et sur Blue Silk, le moteur d'analyse de Talkwalker (racheté en avril 2024), qui détecte les pics de conversation, prédit les tendances, suit 40 000 logos et scènes dans les images et vidéos et analyse le sentiment dans 187 langues. Hootsuite a aussi lancé des connecteurs MCP pour que ChatGPT, Gemini et Claude accèdent à ses données et fonctions. Prix 2026 : Standard 99 $ par utilisateur et par mois (10 comptes), Professional 199 $ (comptes illimités), Advanced 399 $ (approbation d'équipe, routage), Enterprise sur devis. La page officielle n'affiche pas les prix (sélection par région) ; les montants viennent de SocialRails, PostDaily et Turrboo (2026). Limites : prix par siège élevé pour une agence, veille complète réservée au palier Enterprise « Hootsuite Listening », pas de génération vidéo. Réputation : solide, mais régulièrement jugé cher pour les petites agences.
Source : https://www.hootsuite.com/newsroom/press-releases/hootsuite-rebuilds-for-ai-era-introducing-wisdom
Source : https://www.hootsuite.com/plans
Source : https://socialrails.com/blog/hootsuite-pricing
Source : https://blog.hootsuite.com/ai-social-listening/

**Sprout Social.** Page officielle (octobre 2026) : Essentials 79 $ par siège et par mois en annuel (99 $ en mensuel, 5 profils), Standard 199 $, Professional 299 $ (profils illimités, « Enhance Post by AI Assist »), Advanced 399 $ (réponses assistées par IA), Enterprise sur devis. Chaque siège reçoit 100 crédits mensuels d'agent « Trellis AI ». Fonctions : inbox, écoute (option), rapports, approbation. Limites : aucune génération d'image ou de vidéo ; le coût explose avec le nombre de sièges. Réputation : référence pour les grandes équipes, trop cher pour une agence de trois personnes.
Source : https://sproutsocial.com/pricing/

**Agorapulse.** Page officielle : Standard 79 $ par utilisateur et par mois en annuel (99 $ en mensuel), Professional 119 $ (149 $), Advanced 149 $ (199 $), Custom sur devis ; 10 profils inclus par plan, X en option payante. Assistant d'écriture IA sur tous les plans, approbation simple à partir de Professional, multi-étapes sur Advanced, rapports en marque blanche. L'entreprise est française d'origine (Paris) et l'interface existe en français. Limites : pas de génération visuelle, écoute avancée en option, coût par utilisateur.
Source : https://www.agorapulse.com/pricing/

**Sendible.** Core 35 $ (30 $ en annuel), Plus 99 $, Premium 199 $, Elite 299 $ (90 profils, rapports en marque blanche), Enterprise 750 $ (300 profils). Crédits IA illimités sur tous les plans en 2026 (légendes, reformulation, image basique). Marque blanche complète en option à partir de 240 $ par mois sur Elite et Enterprise, soit un tableau de bord brandé à partir d'environ 539 $ par mois. Réputation : agence-friendly, mais interface vieillissante.
Source : https://www.socialpilot.co/blog/sendible-pricing
Source : https://socialk.it/en/pricing/sendible

### 3.2 Les planificateurs abordables à orientation agence

**Metricool.** Page officielle (octobre 2026) : Free (1 marque, 20 posts par mois), Starter 16 à 29 € par mois (5 à 10 marques, 20 crédits IA par marque), Advanced 43 à 130 € par mois en annuel (15, 25 ou 50 marques ; 53 à 210 $ en mensuel) avec gestion d'équipe et de clients, système d'approbation, 35 crédits IA par marque, Custom avec marque blanche. Point remarquable : « Metricool MCP » inclus sur tous les plans, donc pilotable par Claude ou ChatGPT. L'entreprise est espagnole et l'interface existe en français. Limites : crédits IA faibles, pas de génération vidéo, approbation réservée à Advanced.
Source : https://metricool.com/pricing/

**Vista Social.** Page officielle : Professional 99 $ par mois (950 $ par an) pour 15 profils et 2 utilisateurs, Advanced 199 $ (30 profils, 3 utilisateurs), Scale 449 $ (70 profils, 4 utilisateurs), Enterprise sur devis. Crédits IA : 1 000, 2 000, 3 500 par mois, illimités en Enterprise. Approbation à une et plusieurs étapes sur tous les plans. Portail client et marque blanche réservés à Scale et Enterprise. Options : X 29 $ par mois, écoute web 75 $ par mois. Réputation : le meilleur rapport fonctions-prix pour une agence selon G2, mais le portail client est au palier 449 $.
Source : https://vistasocial.com/pricing/

**Buffer.** Page officielle (prix mis à jour novembre 2025) : Free (3 canaux, 10 posts par canal, assistant IA inclus), Essentials 5 $ par canal et par mois (60 $ par an), Team 10 $ par canal (120 $ par an) avec membres illimités, approbation, rapports brandés, 5 clés API et 15 000 requêtes par mois. Dégressif à partir du 11e canal. Limites : pas de veille, pas de génération d'image ou de vidéo, pas de portail client.
Source : https://buffer.com/pricing

**Publer.** Professional 5 $ par compte social et par mois, Business 10 $ par compte (AI Assist illimité couvert par Publer ; sur Free et Professional il faut sa propre clé OpenAI), membres 3 $ par mois, espaces de travail illimités. Limites : pas d'approbation structurée ni de marque blanche selon les tests 2026.
Source : https://coldiq.com/tools/publer
Source : https://costbench.com/software/social-media-management/publer/

**SocialBee.** Bootstrap 29 $, Accelerate 49 $, Pro 99 $ (3 utilisateurs, 25 profils, 5 espaces, rapports brandés), puis Pro50, Pro100, Pro150 de 149 à 374 $ par mois en annuel pour 50 à 150 profils. AI Copilot (stratégie, légendes, images). Limites : pas de vidéo, pas de veille.
Source : https://www.socialchamp.com/blog/socialbee-pricing/

**ContentStudio.** Page officielle (octobre 2026) : Standard 19 $ en annuel (29 $ en mensuel) ; Advanced 49 $ (69 $) avec approbation et tableau de bord client ; Agency Unlimited 99 $ (139 $) avec 25 comptes, espaces et utilisateurs illimités, 125 000 crédits texte, 125 images, 500 crédits vidéo, 500 minutes de découpage, 250 réponses automatiques, marque blanche ; plan API 15 $ par mois (3 000 requêtes). C'est l'outil qui coche le plus de cases sur le papier : veille (découverte de contenu par mots-clés), texte, image, vidéo, découpage, réponses, approbation, client. Limites : la « vidéo IA » est un montage de stock et de voix, pas de la génération ; la veille est un agrégateur d'articles, pas une détection de tendances locales.
Source : https://contentstudio.io/pricing

**Later.** Starter 18,75 $ en annuel (25 $ en mensuel, 1 « social set » de 8 profils, 5 crédits IA), Growth 37,50 $ (2 sets, 50 crédits), Scale 82,50 $ (6 sets, 48 profils, 100 crédits). Le palier Agency a été supprimé en 2026. Pas d'API de publication.
Source : https://www.blotato.com/blog/later-pricing

**Loomly.** Base 32 $, Standard 60 $, Advanced 131 $, Premium 277 $ par mois. Idées de posts à partir de tendances, fêtes et flux RSS, conseils d'optimisation en direct, approbation. Limites : pas de génération d'image ni de vidéo.
Source : https://socialrails.com/blog/loomly-pricing

**Planable.** Page officielle : Basic 33 $ par espace de travail et par mois (60 posts, 4 pages, approbation « optionnelle »), Pro 49 $ (150 posts, 10 pages, approbation « requise »), Enterprise sur devis (approbation multi-niveaux). Add-ons : analytics 12 $, inbox 9 $, écoute 99 $. Les 50 premiers posts sont gratuits sans limite de temps. IA limitée à la réécriture et à la génération de posts. C'est la référence du marché pour l'expérience de validation client (commentaires contextuels, invités illimités), mais sans production média.
Source : https://planable.io/pricing

### 3.3 Les générateurs « IA natifs »

**Predis.ai.** Page officielle (octobre 2026) : Core 24 $ par mois en annuel (32 $ en mensuel, 1 300 crédits, 1 marque, 10 comptes, pas d'auto-publication), Rise 55 $ (79 $, 3 200 crédits, 4 marques, 20 comptes, auto-publication), Enterprise+ 212 $ (249 $, 10 000 crédits, marques illimitées, 60 comptes). Barème des crédits selon les sources tierces : 15 par image, 200 par 8 secondes de vidéo « standard/UGC », 5 par 10 secondes de vidéo « faceless », 15 par slide de carrousel ; soit environ 325 images ou 33 vidéos sur Core. Analyse de concurrents incluse (60 à 600 runs par mois). Limites : qualité visuelle de template, crédits rapidement consommés par la vidéo, pas d'approbation client structurée.
Source : https://www.predis.ai/pricing/
Source : https://soku.ai/alternatives/predis-ai/review

**Blaze.ai.** Starter 79 $ par mois (3 comptes, 600 crédits, 1 utilisateur), Growth 149 $ (10 comptes, 1 500 crédits, utilisateurs illimités), All-In-One 2 499 $ par mois (marketing géré). Remise de 25 % en annuel. Le point fort est la « Brand Voice » extraite du site web et le mode « Autopilot » qui remplit un calendrier. Limites : orienté PME et non agence multi-clients, pas de vidéo générative, pas de portail client.
Source : https://affinco.com/blaze-ai-pricing/

**Blotato.** Page officielle : Starter 29 $ par mois (1 250 crédits, 20 comptes), Creator 97 $ (5 000 crédits, 40 comptes), Agency 499 $ (28 000 crédits, traitement dédié) ; annuel moins 17 %. Création de « faceless videos », avatars, voix, sous-titres, réécriture virale et surtout une API unifiée de publication avec nœuds officiels n8n et Make. Positionnement : le moteur de publication pour les automatisations IA. Limites : vidéo de stock et avatars, pas d'approbation client, pas de veille.
Source : https://www.blotato.com/pricing

**Ocoya.** Bronze 15 $, Silver 39 $, Gold 79 $, Diamond 159 $ par mois ; différences par espaces (1 à illimité), utilisateurs (1 à 50), profils (5 à 150), crédits IA (100 à illimité), runs d'automatisation (10 à 10 000). Réputation : simple, visuels de template.
Source : https://www.g2.com/products/ocoya/reviews

**FeedHive.** Creator 19 €, Brand 29 €, Agency 299 € par mois. Prédiction de performance par IA, recyclage. Limites : pas de vidéo.
Source : https://apaya.com/blog/best-ai-social-media-tools

**Lately.ai.** Starter 14 $ en annuel, Growth 199 $, Enterprise sur devis. Découpe un long texte ou une transcription en dizaines de posts dans la voix de la marque. Limites : texte seulement.
Source : https://apaya.com/blog/best-ai-social-media-tools

### 3.4 L'open source

**Postiz.** Licence AGPL-3.0, plus de 34 000 étoiles GitHub, 30 plateformes. Page officielle (octobre 2026) : Standard 29 $ par mois (5 canaux, 3 vidéos IA, 60 minutes de découpage), Team 39 $ (10 canaux, 100 images IA, 10 vidéos, 120 minutes), Pro 49 $ (30 canaux, 300 images, 30 vidéos, 300 minutes), Ultimate 99 $ (100 canaux, 500 images, 60 vidéos, 600 minutes). Tous les plans incluent un serveur MCP, une CLI, une API publique et un « Smart Agent ». Auto-hébergement gratuit. C'est l'outil le plus naturel pour un agent Claude : « Claude, ChatGPT, Codex peuvent rédiger et planifier pendant que vous approuvez dans le calendrier ». Limites : la vidéo IA est en petit quota, pas de portail client, pas de veille, et l'auto-hébergement exige Temporal, Postgres et Redis.
Source : https://postiz.com/pricing
Source : https://postiz.com/compare/postiz/mixpost
Source : https://postiz.com/agent

**Mixpost.** Laravel, licence perpétuelle : Lite gratuit, Pro 299 $ une fois, Enterprise 1 199 $ une fois, un an de mises à jour. API mais pas de serveur MCP. Plus léger que Postiz.
Source : https://postiz.com/compare/postiz/mixpost

### 3.5 Les outils de niche LinkedIn et X

**Typefully** : gratuit, Starter 8 $, Creator 19 $ (IA), Team 39 $ par mois. **Taplio** : 39 $ (sans crédits IA), Standard 65 $, Pro 199 $. **Hypefury** : a abandonné X en 2026 et vise LinkedIn, Bluesky, Threads et Instagram à partir de 6 $ par canal (anciens plans 29 à 199 $). Ces outils servent la verticale B2B de Markel-Tech, mais n'ont ni vidéo ni multi-clients sérieux.
Source : https://socialrails.com/blog/taplio-pricing
Source : https://www.wearefounders.uk/hypefury-vs-typefully-2026-which-x-tool-is-worth-paying-for/

### 3.6 Les suites de rédaction IA

**Jasper** : Creator 49 $ en annuel (59 $ en mensuel), Pro 69 $ (79 $, 3 voix de marque), Business sur devis (agents, API, souvent 900 à 6 000 $ par mois) ; hausse de 27 % en 2026. **Copy.ai** : gratuit 2 000 mots, Starter 49 $, Advanced 249 $ (Workflows GTM). **Writesonic** : Lite 39 $ en annuel. **Simplified** : Pro 9 €, Business 19 €, Growth 49 € par mois en annuel (12, 29, 79 € en mensuel) avec design, vidéo, planificateur et rédacteur. Ces outils apportent la voix de marque et les frameworks, mais pas la publication multi-clients ni la vidéo réelle. Pour José, la valeur est nulle face à Claude avec un fichier de doctrine (PAS, AIDA, BAB, FAB, piliers 60/25/15).
Source : https://costbench.com/software/ai-writing-tools/jasper/
Source : https://www.eesel.ai/blog/simplified-ai-pricing

### 3.7 Le découpage de longs formats

**OpusClip.** Page officielle : Free (60 minutes, filigrane, médias effacés après 3 jours), Starter 15 $ par mois (150 minutes, publication YouTube Shorts, TikTok, Instagram, voix IA 20 par jour), Pro 29 $ (14,50 $ en annuel ; 300 minutes, « Prompt to clip », AI B-Roll par Agent Opus, doublage, 4 modèles de marque, équipe de 4, API d'édition et de planification, Zapier 300 crédits), Business sur devis (file dédiée, API, analyse de tendances en temps réel). ClipAnything analyse les indices visuels, audio et de sentiment ; sous-titres en plus de 25 langues. Réputation : leader de la catégorie (10 millions d'utilisateurs revendiqués), mais 1 minute envoyée = 1 crédit, donc un sermon de 90 minutes consomme 90 crédits ; les clips restent des recadrages sous-titrés, pas des animations.
Source : https://www.opus.pro/pricing
Source : https://www.eesel.ai/blog/opusclip-pricing

**Vizard.** Free 60 crédits par mois, Creator à partir d'environ 14,50 $ en annuel (29 $ en mensuel), 7 200 à 60 000 crédits par an, 4K, planification, brand kit ; Business avec API et 20 comptes. **Klap** 29 $ (10 uploads, 100 clips). **Submagic** 19 $ (11 $ en annuel, 15 vidéos, sous-titres animés). **Munch** 49 $, orienté tendances. **Castmagic** Hobby 39 $ (300 minutes), Starter 59 $ (800 minutes), Rising Star 299 $ (2 500 minutes), 0,10 à 0,20 $ par minute supplémentaire ; transforme un audio en posts, notes, titres. **Repurpose.io** Content Marketer 35 $ (29 $ en annuel), Agency 149 $ (124 $ en annuel, 20 comptes par réseau) ; redistribue automatiquement les vidéos entre plateformes.
Source : https://www.vizard.ai/pricing
Source : https://www.ssemble.com/blog/best-ai-clipping-tools-2026
Source : https://hackceleration.com/labs/castmagic-pricing
Source : https://www.castmagic.io/software-reviews/repurpose-io

Aucun de ces outils ne produit un clip « animé » au sens de José (typographie cinétique, motion design, illustrations) : ils recadrent, sous-titrent, ajoutent des B-roll de stock ou générés (OpusClip Pro) et des emojis.

### 3.8 La génération vidéo et image

**Higgsfield.** La page officielle de prix n'a pas pu être lue (contenu chargé en JavaScript). D'après l'analyse de Krea datée de septembre 2026 : Starter 19 $ par mois (270 crédits, Seedance Fast et Mini), Plus 47 $ en annuel ou 59 $ en mensuel (1 200 crédits, Seedance complet), Ultra 99 $ en annuel ou 129 $ en mensuel (3 000 crédits, Nano Banana Pro). Seedance 2.0 coûte 23 crédits (5 s, 720p) à 90 crédits (10 s, 1080p). Les fenêtres « Unlimited » durent typiquement sept jours pour un modèle phare, s'appliquent au site web seulement (pas au MCP ni à la CLI) et ne sont pas permanentes. Aucune API publique Higgsfield n'est documentée. C'est exactement la contrainte que José a déjà rencontrée : production via navigateur piloté par Claude-in-Chrome.
Source : https://www.krea.ai/blog/higgsfield-pricing-explained-2026-unlimited-credits-and-real-monthly-costs
Source : https://higgsfield.ai/blog/credits-vs-unlimited-ai-video-generation

**API vidéo par modèle (2026).** Veo 3.1 Fast 0,15 $ par seconde avec audio, Veo 3.1 Standard 0,40 $ par seconde, Veo 3.1 sur Vertex jusqu'à 0,75 $ par seconde avec audio ; Kling 0,084 à 0,168 $ par seconde en API officielle, Kling 3.0 à environ 0,029 $ par seconde via fal.ai ; Seedance 2.0 à 0,0849 $ par seconde via Krea ; Sora 2 environ 0,10 $ par seconde en 720p, avec une fermeture de l'API Sora 2 annoncée pour le 24 septembre 2026 selon une source tierce (à vérifier). Un clip vertical de 15 secondes coûte donc entre 0,45 $ (Kling via fal) et 6 $ (Veo 3.1 Standard).
Source : https://modelslab.com/blog/api/veo-3-1-vs-kling-3-sora-2-ai-video-api-cost-2026
Source : https://www.cometapi.com/ai-video-api-pricing/
Source : https://tokenmix.ai/blog/ai-video-generation-api

**OpenAI gpt-image.** La page de prix OpenAI liste gpt-image-2.5-sunburst, gpt-image-2.5-flare, gpt-image-2, gpt-image-1.5, gpt-image-1-mini, gpt-image-1, facturés par million de tokens (sortie 10 à 40 $). Converti par image (prix vérifiés le 6 septembre 2026 par aifreeapi) : gpt-image-2 en 1024×1024 : 0,006 $ (low), 0,053 $ (medium), 0,211 $ (high) ; gpt-image-1.5 : 0,009 $, 0,034 $, 0,133 $. Le modèle courant est gpt-image-2 (snapshot 2026-04-21). Pour José : 100 visuels de qualité haute par mois et par client coûtent environ 21 $.
Source : https://developers.openai.com/api/docs/pricing
Source : https://www.aifreeapi.com/en/posts/openai-image-generation-api-pricing

**Canva.** Pro 15 $ par mois (500 crédits IA, Brand Kit), Business 20 $ par utilisateur et par mois (ancien Teams), Enterprise sur devis. Magic Studio : Dream Lab (image), Magic Write, génération vidéo par Google Veo 3. MCP Canva disponible (déjà connecté chez José). **Adobe Express** : environ 7,99 à 9,99 $ par siège, Firefly, vidéo générative limitée.
Source : https://aiproductivity.ai/blog/canva-vs-adobe-express-2026/
Source : https://gptprompts.ai/ai-pricing/canva-ai-pricing

**Studios vidéo de template.** Lumen5 Basic 19 $, Starter 59 $, Professional 149 $ ; Pictory à partir de 19 à 25 $ ; InVideo AI à partir de 20 à 28 $. Ils transforment un texte en vidéo de stock. Qualité jugée « plate » par rapport aux attentes TikTok 2026.
Source : https://www.saasworthy.com/product/lumen5/pricing

**Avatars et UGC.** HeyGen (page officielle) : Free 3 vidéos, Creator 29 $ (24 $ en annuel, 600 crédits), Pro 49 $ (1 000 crédits, 4K), Business 149 $ + 20 $ par siège (1 500 crédits, API, nœuds n8n, Make, Zapier), Enterprise. Creatify : Starter 33 à 39 $, Pro 49 $, Business 99 $. Arcads : Starter 110 $ (environ 10 vidéos), Creator 220 $, Pro 550 $, sans plan gratuit. Captions, rebaptisé Mirage en septembre 2025 : Pro 9,99 $, Max 24,99 $, Scale 69,99 $ ; API sous-titres 0,15 $ par minute, avatar Mirage 0,15 $ par seconde. Icon.com : 999 $ par mois pour 6 pubs UGC filmées par des humains. MakeUGC 49 à 149 $. Poppy AI ne publie plus ses prix (anciennement 33 $ et 189 $ par mois en annuel).
Source : https://www.heygen.com/pricing
Source : https://www.wireflow.ai/blog/arcads-pricing
Source : https://captions.ai/help/docs/api/pricing
Source : https://resources.rework.com/tools/ai-tools/best-ai-ad-creative-tools-2026

### 3.9 Agents et automatisation

**n8n.** Cloud à partir de 20 $ par utilisateur et par mois (2 500 exécutions), auto-hébergement sans limite. Plus de 1 759 workflows communautaires « content creation », dont « Fully automated AI video generation and multi-platform publishing » et « Generate and auto-post AI videos with Veo3 and Blotato ». **Make** : non vérifié dans cette recherche. **Zapier Agents** : Free 400 activités, Pro 50 $ par mois (1 500 activités). **Lindy** : Plus 29,99 $ (3 000 crédits), Pro 99,99 $, Max 199,99 $ par utilisateur. **Relevance AI** : Pro 19 $, Team 234 $ par mois en annuel. **Manus** : gratuit 300 crédits par jour, Pro 20 $ (4 000 crédits), 40 $, 200 $ (40 000 crédits). **Genspark** : Plus 24,99 $ (10 000 crédits), Pro 249,99 $ (125 000 crédits), vidéo et agents décomptés.
Source : https://n8n.io/workflows/5035-generate-and-auto-post-ai-videos-to-social-media-with-veo3-and-blotato/
Source : https://www.eesel.ai/blog/lindy-vs-relevance-ai
Source : https://felloai.com/genspark-ai-pricing/
Source : https://www.taskade.com/blog/manus-ai-review

**Agents généraux.** ChatGPT agent mode (qui avait absorbé Operator et Deep Research en juillet 2025) a été retiré début août 2026 sans remplacement direct ; OpenAI renvoie vers ChatGPT Work, un navigateur cloud limité et Codex. Claude Cowork, lancé en aperçu en janvier 2026 et étendu au web et au mobile en juillet 2026, est inclus dans les plans Claude payants ; il publie via MCP (Postiz, Metricool, Hootsuite, Canva) mais ne se déclenche pas sur un événement externe sans un planificateur. Le test Blotato du 23 septembre 2026 sur 12 agents conclut : « chaque agent raisonne ; aucun ne détient un jeton OAuth » ; il faut une couche de publication.
Source : https://www.usecarly.com/blog/chatgpt-agent-mode/
Source : https://www.blotato.com/blog/ai-agents-social-media
Source : https://techsy.io/en/blog/claude-cowork-vs-chatgpt-agents

### 3.10 Niches verticales et francophonie

**Églises.** Sermon Shots : gratuit 2 clips, Plus environ 40 $ par mois en annuel (479,88 $ par an), Full-service 147 $ par mois ; transcription, suivi de l'orateur, suggestions de moments, sous-titres, charte de l'église, dévotionnels et guides de discussion. Pulpit AI : environ 49 à 50 $ par mois, Pro environ 129 $ ; plus de 20 contenus par sermon, bouton « Create a clip » ajouté en mai 2026. Aucun ne mentionne le français ni l'animation ; ils ciblent les églises anglophones américaines.
Source : https://reachrightstudios.com/blog/best-sermon-clip-software/
Source : https://insights.velocityaipartners.co/tools/pulpit-ai

**France.** Swello (Montpellier, depuis 2010) : Medium 19 € HT par mois (1 utilisateur, 5 profils), Large 59 € (3 utilisateurs, 10 profils), Entreprise 99 € (5 utilisateurs, 15 profils, veille sectorielle). Support en français, prisé des collectivités. Pas de génération visuelle ni vidéo, pas de portail client.
Source : https://www.lafabriquedunet.fr/logiciel/swello
Source : https://tool-advisor.fr/blog/outils-reseaux-sociaux/

**Afrique francophone.** Aucun outil SaaS de gestion social media IA né en Afrique francophone n'a été identifié ; le marché est servi par des agences (PixlStudio à Abidjan, Blue Lions, Yeb Digital) et par des outils d'analyse d'influence (Favikon avec 35°Ouest, Top 100 des leaders d'Afrique francophone). Côte d'Ivoire : plus de 8,4 millions d'utilisateurs Facebook, audience publicitaire en hausse de 22,6 % sur un an (DataReportal 2025), Facebook reste dominant, TikTok monte. Les contraintes locales (paiement mobile money, WhatsApp comme canal de validation, bande passante, français et langues locales) ne sont traitées par aucun outil cartographié.
Source : https://www.agenceecofin.com/reseaux-sociaux/3011-114180-35-ouest-et-favikon-devoilent-le-top-100-des-leaders-et-entrepreneurs-d-afrique-francophone-les-plus-influents-sur-les-reseaux-sociaux
Source : https://www.pixlstudio.africa/top-14-des-influenceurs-a-suivre-pour-votre-communication-en-cote-d-ivoire-2026

## 4. Tableau comparatif des fonctions (outils majeurs)

Légende : O = oui, natif ; P = partiel ou par template ; N = non ; $ = option payante.

| Outil | Veille, tendances | Texte IA | Image IA | Vidéo IA réelle | Découpage long format | Approbation client | Portail client | Multi-marques agence | Publication directe | Analytics | Réponses commentaires IA |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Hootsuite (Wisdom, Blue Silk) | O ($ Enterprise pour l'écoute complète) | O | O (génération) | N | N | O (Advanced) | N | O (par siège) | O | O | O (smart replies) |
| Sprout Social | O ($) | O | N | N | N | O | N | O | O | O | O (Advanced) |
| Agorapulse | $ | O | N | N | N | O (Professional+) | P (lien de validation) | O | O | O | O (modération) |
| Sendible | P | O | P | N | N | O | $ marque blanche | O | O | O | P |
| Metricool | P (concurrents) | O (crédits) | N | N | N | O (Advanced) | P | O (5 à 50 marques) | O | O | N |
| Vista Social | $ (75 $) | O (crédits) | P | N | N | O | O (Scale 449 $) | O | O | O | O |
| Buffer | N | O | N | N | N | O (Team) | N | P | O | O | N |
| ContentStudio | P (découverte) | O | O | P (stock) | O (quota) | O (Advanced+) | O (Advanced+) | O | O | O | O (250/mois) |
| Planable | N | P | N | N | N | O (le meilleur) | O | O (par espace) | O | $ | N |
| Predis.ai | P (concurrents) | O | O | P (template, UGC) | N | P | N | O (4 à illimité) | O (Rise+) | O | N |
| Blaze.ai | N | O | O | P | N | P | N | P | O | P | N |
| Blotato | N | O | O | P (faceless, avatar) | N | N | N | P | O (API) | P | N |
| Postiz | N | O | O (quota) | P (quota) | O (quota) | P (calendrier) | N | O (100 canaux) | O (30 plateformes, MCP) | P | N |
| Mixpost | N | P | N | N | N | P | N | O | O | P | N |
| OpusClip | P (Business) | P | N | P (B-roll généré) | O | N | N | P | O (6 plateformes) | P | N |
| Vizard | N | P | N | N | O | N | N | P | O | N | N |
| Castmagic | N | O | N | N | P (audio → texte) | N | N | P | N | N | N |
| HeyGen | N | P | N | P (avatar) | N | N | N | P | N | N | N |
| Creatify, Arcads | N | O | N | P (UGC avatar) | N | N | N | P | N | N | N |
| Canva Magic Studio | N | O | O | P (Veo 3) | N | P | N | O (Brand Kit) | O (planificateur) | N | N |
| n8n, Make, Zapier Agents | selon workflow | selon modèle | selon API | selon API | selon API | à construire | à construire | à construire | via API ou Blotato, Postiz | à construire | à construire |
| Claude Cowork, Claude Code | O (recherche web) | O | via API | via API, navigateur | via API | à construire | à construire | à construire | via MCP (Postiz, Metricool, Hootsuite) | via MCP | via MCP |
| Sermon Shots, Pulpit AI | N | O | P (citations) | N | O (sermons) | N | N | N | P | N | N |
| Swello | P (veille sectorielle) | P | N | N | N | O | N | P | O | O | N |

## 5. Tableau des prix 2026 (palier d'entrée agence)

| Outil | Palier utile pour une agence de 6 clients | Prix mensuel (annuel) | Unité de facturation | Source datée |
|---|---|---|---|---|
| Hootsuite Professional | 1 siège, comptes illimités | 199 $ | par siège | SocialRails 2026 |
| Sprout Social Professional | 1 siège, profils illimités | 299 $ | par siège | sproutsocial.com, oct. 2026 |
| Agorapulse Professional | 10 profils | 149 $ (119 $) | par utilisateur | agorapulse.com, oct. 2026 |
| Sendible Elite | 90 profils | 299 $ (254 $) | forfait | SocialPilot 2026 |
| Metricool Advanced 15 marques | 15 marques | 53 $ (43 €) | forfait | metricool.com, oct. 2026 |
| Vista Social Advanced | 30 profils, 3 utilisateurs | 199 $ (159 $) | forfait | vistasocial.com, oct. 2026 |
| Vista Social Scale (portail client) | 70 profils | 449 $ (359 $) | forfait | idem |
| Buffer Team | 6 clients × 3 canaux = 18 canaux | environ 148 $ | par canal | buffer.com, nov. 2025 |
| ContentStudio Agency Unlimited | 25 comptes, espaces illimités | 139 $ (99 $) | forfait | contentstudio.io, oct. 2026 |
| Planable Pro | 1 espace par client | 49 $ × 6 = 294 $ | par espace | planable.io, oct. 2026 |
| Predis Rise | 4 marques | 79 $ (55 $) | crédits | predis.ai, oct. 2026 |
| Blaze Growth | 10 comptes | 149 $ | crédits | Affinco 2026 |
| Blotato Creator | 40 comptes | 97 $ | crédits | blotato.com, oct. 2026 |
| Postiz Pro (cloud) | 30 canaux | 49 $ | forfait | postiz.com, oct. 2026 |
| Postiz auto-hébergé | illimité | 0 $ + serveur | AGPL | idem |
| OpusClip Pro | 300 minutes | 29 $ (14,50 $) | minutes | opus.pro, oct. 2026 |
| HeyGen Business | 1 500 crédits, API | 149 $ + 20 $ par siège | crédits | heygen.com, oct. 2026 |
| Higgsfield Ultra | 3 000 crédits, fenêtres Unlimited | 129 $ (99 $) | crédits | Krea, sept. 2026 |
| gpt-image-2 high | 100 images | environ 21 $ | par image | OpenAI, sept. 2026 |
| Kling 3.0 via fal.ai | 100 clips de 15 s | environ 44 $ | par seconde | ModelsLab 2026 |
| Veo 3.1 Fast | 100 clips de 15 s | environ 225 $ | par seconde | ModelsLab 2026 |
| Sermon Shots Plus | église | 40 $ | forfait | ReachRight, avril 2026 |
| Swello Entreprise | 15 profils | 99 € HT | forfait | La Fabrique du Net 2026 |

## 6. Analyse des trous du marché

### 6.1 Qui ferme la boucle complète ?

Personne. Le tableau de la section 4 montre que la colonne « veille » et la colonne « vidéo IA réelle » ne sont jamais vertes sur la même ligne, et que la colonne « portail client » n'est verte que chez Planable, ContentStudio et Vista Social Scale, trois outils sans production vidéo réelle.

Le plus proche d'une boucle est ContentStudio Agency Unlimited (99 $ en annuel) : découverte de contenu, texte, images, vidéos de stock, découpage, approbation, portail client, publication, réponses automatiques. Mais sa veille n'est qu'un agrégateur d'articles par mots-clés (pas de détection d'événements locaux ni de tendances TikTok), sa vidéo est un montage automatique et sa qualité visuelle est celle d'un template. Hootsuite ferme la boucle « signal → action » côté entreprise avec Wisdom, mais sans production vidéo et à un prix par siège incompatible avec une agence de taille modeste.

Les chaînes n8n (« Google Sheet → GPT → Veo 3 → Blotato → publication ») ferment techniquement la boucle de production, mais sans planche de propositions, sans validation client et sans gestionnaire humain : elles publient à l'aveugle, ce qui est exactement ce qu'un client d'église ou de marque de beauté ne veut pas.

### 6.2 Qui fait de la vraie vidéo IA ?

Les modèles existent (Seedance 2.x, Kling 3.0, Veo 3.1, Sora 2, Wan) et leurs API coûtent entre 0,03 et 0,75 $ par seconde. Mais aucune suite de gestion ne les intègre nativement avec une direction artistique : Canva propose Veo 3 dans un éditeur, Postiz et ContentStudio donnent des quotas de « vidéos IA » dont le modèle n'est pas précisé, Predis facture 200 crédits par 8 secondes. Higgsfield, qui possède les meilleurs modèles et les fenêtres Unlimited, n'a pas d'API : la production reste manuelle ou pilotée par navigateur, ce qui limite le volume à quelques dizaines de clips par jour par opérateur.

Conséquence : la « vraie » vidéo IA en 2026 se fait soit à la main chez Higgsfield ou Krea, soit par code (fal.ai, Replicate, Vertex, Krea API) dans un pipeline maison. Le trou est précisément là : un pipeline qui enchaîne brief → prompt image → image de référence → prompt vidéo → clip 15 s → montage avec typographie et musique → export vertical, sous contrôle humain, pour plusieurs marques.

### 6.3 Qui découpe les longs formats avec animation ?

OpusClip, Vizard, Klap, Submagic, Munch recadrent et sous-titrent ; OpusClip Pro ajoute des B-roll générés et un « Prompt to clip ». Sermon Shots et Pulpit AI appliquent la même mécanique aux sermons anglophones et ajoutent des dévotionnels texte. Aucun outil ne produit, à partir d'un sermon de deux heures, un clip de 45 secondes avec typographie animée du verset, illustration générée, sous-titres français et musique, prêt pour TikTok. Ce que José fait déjà avec Claude Design (HTML animé rendu en MP4) et Suno est exactement ce qui manque au marché.

### 6.4 Qui propose un portail client simple, validation en un tap ?

Planable est la référence (50 posts gratuits, commentaires contextuels, approbation requise sur Pro à 49 $ par espace), Vista Social l'offre à 449 $ par mois, Agorapulse et Metricool ont des liens de validation sans compte. Mais tous supposent un client qui ouvre un navigateur, se connecte à un espace et parcourt un calendrier. Aucun n'envoie une planche visuelle par WhatsApp avec deux boutons « Oui, lancez » et « Non, modifiez ». Pour une cliente de produits de beauté à Abidjan ou un pasteur, c'est WhatsApp ou rien ; José utilise déjà CallMeBot pour les alertes.

### 6.5 Qui sert les marchés francophones et africains ?

Agorapulse (origine française) et Metricool (espagnol) ont une interface en français ; Swello est français mais limité. Les autres sont anglais d'abord. Aucun outil n'intègre les codes culturels (événements régionaux ivoiriens, fêtes chrétiennes francophones, calendrier académique africain), le paiement mobile money ou l'optimisation pour une bande passante faible. Les tendances TikTok et Instagram détectées par les outils américains ne sont pas celles d'Abidjan, de Dakar ou de la diaspora de Toronto.

### 6.6 Les autres trous

Facturation : tous les outils facturent par siège, par canal ou par crédits, ce qui pénalise une agence qui veut mettre un gestionnaire et un reviewer par client. La « voix de marque » n'est jamais une doctrine complète (piliers 60/25/15, frameworks, hooks, hashtags) mais un ton extrait du site. La mesure en trois couches (indicateurs avancés, croissance, affaires) n'existe nulle part : les analytics s'arrêtent à la portée et à l'engagement, jamais au chiffre d'affaires du client.

## 7. Incertitudes et points à vérifier

1. Hootsuite n'affiche pas ses prix sur sa page (sélection régionale). Les 99, 199, 399 $ par siège viennent de trois sources tierces 2026 concordantes ; à confirmer en se connectant depuis le Canada.
2. Higgsfield : la page de prix n'a pas pu être lue ; les montants (19, 59, 129 $) et la durée des fenêtres Unlimited (sept jours) viennent de Krea (septembre 2026), un concurrent. À confirmer sur le compte de José.
3. La fermeture de l'API Sora 2 au 24 septembre 2026 est rapportée par une seule source tierce ; non confirmée sur une page OpenAI.
4. gpt-image-1.5 : une source annonce une dépréciation au 23 octobre 2026, une autre ne la mentionne pas. Le modèle courant est gpt-image-2 ; prévoir le code pour changer de modèle.
5. Prix Make 2026 non vérifiés dans cette recherche.
6. Blotato : la disponibilité d'un serveur MCP n'est pas confirmée sur la page de prix (API et nœuds n8n, Make confirmés).
7. Predis : barème des crédits par média (15 par image, 200 par 8 s de vidéo) issu d'une source tierce ; la page officielle donne seulement les équivalences (environ 325 images ou 33 vidéos sur Core).
8. Vista Social : deux grilles circulent (79, 149, 349 $ dans les blogs ; 99, 199, 449 $ sur la page officielle en octobre 2026). Le rapport retient la page officielle.
9. ContentStudio : le plan Agency Unlimited est limité à 25 comptes sociaux sur la page officielle malgré son nom ; vérifier le coût des comptes supplémentaires.
10. Sermon Shots et Pulpit AI : prise en charge du français non documentée.
11. Les prix annuels des découpeurs (Vizard « à partir de 0 $ » avec remise affichée) sont illisibles sur la page ; retenus d'après les comparatifs 2026.
12. Capacités réelles de « Wisdom » (Hootsuite) en français et en Afrique de l'Ouest non testées.
13. Statut légal de l'auto-hébergement de Postiz (AGPL-3.0) pour un SaaS commercial : toute modification du code doit être publiée si le service est exposé en réseau ; une utilisation comme brique interne non modifiée est sans contrainte.

## 8. Implications pour la machine de José

1. **Ne pas reconstruire un planificateur.** La publication multi-plateformes est un problème résolu et bon marché : Postiz auto-hébergé (0 $, 30 plateformes, MCP, API) ou Postiz cloud Pro (49 $ pour 30 canaux), ou Blotato Creator (97 $) si l'on veut aussi ses nœuds n8n. Investir le temps de développement dans ce que personne ne fait : veille locale, planche, validation WhatsApp, production vidéo dirigée.

2. **Faire de la planche de propositions l'objet central du produit.** Chaque semaine, par client, la machine produit une page visuelle (grille de 6 à 10 propositions avec visuel de référence gpt-image-2, hook, format, plateforme, date) et l'envoie par WhatsApp et par courriel avec un lien de validation sans compte, deux boutons par proposition. Aucun concurrent n'a cette unité de travail ; Planable valide des posts, pas des campagnes.

3. **Validation en un tap, sans compte, par WhatsApp.** Lien signé à usage unique, page mobile de 1 écran par proposition, réponse « Oui » ou commentaire vocal transcrit. CallMeBot ne suffit pas pour recevoir des réponses ; prévoir l'API WhatsApp Business (Meta Cloud API) ou un relais Twilio, et garder le courriel (Resend) comme repli.

4. **Veille par client en trois flux.** Flux A : site et réseaux du client (changements de pages, nouveaux produits, nouveaux événements, via scraping programmé et Graph API). Flux B : domaine et région (recherche web par Claude avec requêtes en français et localisées : « Abidjan octobre 2026 festival », « salon beauté Abidjan », « rentrée 2IAE »). Flux C : tendances de format (sons, hooks, structures) relevées par un agent qui lit les comptes de référence de la verticale. Hootsuite vend cela à partir de 399 $ par siège et seulement en anglais ; la machine le fait avec Claude et des sources ouvertes pour quelques dollars par client.

5. **Production vidéo à trois moteurs selon le brief.** Moteur 1, génératif : Kling 3.0 via fal.ai (environ 0,03 $ par seconde) ou Seedance via Krea API (0,085 $ par seconde) pour les clips produit et ambiance ; Higgsfield par navigateur reste l'outil d'exception pour les scènes signature pendant les fenêtres Unlimited. Moteur 2, motion design : Claude Design HTML → MP4 pour les versets, citations, chiffres, annonces d'événements. Moteur 3, découpage : transcription Whisper ou AssemblyAI, sélection des moments par Claude, recadrage par ffmpeg, sous-titres français, puis habillage par le moteur 2. Aucun outil du marché ne combine les trois.

6. **Un pipeline sermon spécifique.** Entrée : URL YouTube. Sorties : 5 clips de 30 à 60 secondes avec verset animé, 3 citations image, 1 dévotionnel texte, 1 post LinkedIn pasteur, 1 résumé pour WhatsApp de l'église. Sermon Shots fait cela en anglais à 40 $ par mois sans animation ; la machine le fait en français avec animation. C'est un produit vendable seul aux églises.

7. **Un pipeline « dépôt de nouveaux produits ».** La cliente beauté envoie 5 photos par WhatsApp ; la machine détoure (Canva MCP remove-background), génère des mises en scène avec gpt-image-2 et Nano Banana, écrit 3 angles (PAS, BAB, FAB), propose une semaine de calendrier, et produit après validation 2 Reels de 15 secondes par produit. Predis vend un embryon de ceci à 55 $ par mois en qualité template.

8. **Encoder la doctrine comme contrat, pas comme « brand voice ».** Un fichier par client : deux plateformes (découverte + relation), piliers 60/25/15 vérifiés automatiquement sur le calendrier, frameworks autorisés, hooks, 3 à 5 hashtags, interdits. L'agent refuse une semaine qui dépasse 15 % de promotion. Jasper et Blaze n'ont qu'un ton ; la doctrine est un avantage défendable.

9. **Gestionnaire humain dans la boucle avec trois portes.** Porte 1 : la planche avant envoi au client (le gestionnaire corrige en 5 minutes). Porte 2 : la validation client. Porte 3 : contrôle de la vidéo finale avant publication (lecture, droits, orthographe). Les chaînes n8n publient sans porte ; les suites ont une porte ; la machine en a trois, avec délais par défaut (si pas de réponse en 48 heures, relance, puis publication des seuls contenus « valeur » déjà validés dans le cadre).

10. **Mesure en trois couches reliée aux affaires.** Couche 1 : indicateurs avancés par post (vues 3 secondes, rétention, partages, enregistrements) via Graph API, TikTok API, YouTube Analytics. Couche 2 : croissance mensuelle par plateforme. Couche 3 : affaires (inscriptions 2IAE, commandes, dons, messages WhatsApp entrants) saisies par le client ou remontées par le site. Revue mensuelle générée automatiquement, itération à 90 jours. Aucun outil du marché ne relie la couche 3.

11. **Tarifer par client, pas par siège ni par crédit.** Le marché facture par siège (Hootsuite, Sprout, Agorapulse), par canal (Buffer, Publer) ou par crédits (Predis, Blotato, Blaze). Une offre « par client et par mois, tout compris, avec X vidéos et Y visuels » est lisible pour une église ou une PME ivoirienne, et la structure de coûts le permet : environ 21 $ de visuels, 10 à 45 $ de vidéo générative, quelques dollars de LLM, 0 $ de publication (Postiz auto-hébergé).

12. **Français d'abord, Afrique de l'Ouest incluse.** Interface, prompts, hashtags, calendrier des fêtes et événements (Tabaski, Pâques, rentrée, Fête nationale ivoirienne du 7 août, Journée internationale de la Francophonie), horaires de publication en GMT et en heure de l'Est. Aucun concurrent n'y est ; Swello et Agorapulse sont français mais hexagonaux.

13. **Déclencheur Claude Cowork et Claude Code depuis la plateforme.** La plateforme écrit un « ordre de production » (JSON : client, brief, formats, moteurs, délais) et le dépose dans un dossier surveillé ou l'envoie via MCP ; Claude Code ou Cowork l'exécute et dépose les rendus dans le bucket S3 Railway. Les tests de septembre 2026 confirment que ces agents fonctionnent bien avec un serveur MCP de publication ; il faut cependant un planificateur externe (routine Railway ou cron) car Cowork ne réagit pas seul à un événement.

14. **Garder une sortie de secours vers les outils existants.** Exposer un serveur MCP et une API de la machine (comme Metricool, Postiz et Hootsuite le font en 2026) pour qu'un client qui a déjà Metricool ou Buffer continue d'y publier. Cela rend la machine compatible avec le marché au lieu de le combattre.

15. **Qualité visuelle comme barrière d'entrée.** Les clients perdus l'ont été sur la « page » et les « tendances », pas sur la planification. Fixer un standard : chaque semaine, au moins 2 vidéos par client avec hook en 2 secondes, sous-titres animés, musique Suno, format 9:16, et au moins 1 contenu lié à un événement ou une tendance de la semaine. Mesurer ce standard dans le tableau de bord du gestionnaire.

16. **Prévoir le remplacement des modèles.** gpt-image-1.5 cède à gpt-image-2, Sora 2 ferme, Hypefury quitte X, ChatGPT agent mode disparaît : en 2026, un fournisseur change tous les trois mois. Abstraire chaque moteur (image, vidéo, transcription, LLM) derrière une interface interne avec un fournisseur par défaut et un repli.

17. **Commencer par trois verticales et un client pilote chacune.** Église (sermon), beauté (produits), école (2IAE, admissions). Markel-Tech en LinkedIn B2B et SEVARTA en édition viennent ensuite, car leurs formats (articles longs, lancements de livres) sont mieux couverts par le marché existant (Typefully, Taplio, Canva).

18. **Ne pas sous-estimer la couche juridique.** Droits des visuels générés (gpt-image-2 et Kling autorisent l'usage commercial ; vérifier Higgsfield par plan), musique Suno (plan payant requis pour l'usage commercial), extraits de sermons (autorisation écrite de l'église), données personnelles des clients (hébergement Railway, région à choisir).

19. **Positionnement.** « La seule machine qui regarde ce qui se passe chez vous et autour de vous, vous propose la semaine en images, attend votre oui sur WhatsApp, puis produit et publie de vraies vidéos, en français, avec un humain qui vérifie. » Face à Hootsuite (signal sans vidéo), Predis (vidéo sans signal ni validation), Planable (validation sans production) et n8n (production sans validation), cette phrase n'a pas de concurrent direct en octobre 2026.

## 9. Sources consultées

Pages officielles : https://www.hootsuite.com/plans ; https://www.hootsuite.com/pricing ; https://www.hootsuite.com/newsroom/press-releases/hootsuite-rebuilds-for-ai-era-introducing-wisdom ; https://sproutsocial.com/pricing/ ; https://www.agorapulse.com/pricing/ ; https://metricool.com/pricing/ ; https://vistasocial.com/pricing/ ; https://buffer.com/pricing ; https://contentstudio.io/pricing ; https://planable.io/pricing ; https://www.predis.ai/pricing/ ; https://www.blotato.com/pricing ; https://postiz.com/pricing ; https://postiz.com/agent ; https://postiz.com/compare/postiz/mixpost ; https://www.opus.pro/pricing ; https://www.vizard.ai/pricing ; https://www.heygen.com/pricing ; https://developers.openai.com/api/docs/pricing ; https://captions.ai/help/docs/api/pricing ; https://higgsfield.ai/blog/credits-vs-unlimited-ai-video-generation ; https://n8n.io/workflows/5035-generate-and-auto-post-ai-videos-to-social-media-with-veo3-and-blotato/ ; https://blog.hootsuite.com/ai-social-listening/.

Analyses et comparatifs datés 2026 : https://socialrails.com/blog/hootsuite-pricing ; https://www.postdaily.app/blog/hootsuite-pricing ; https://www.eesel.ai/blog/sprout-social-pricing ; https://www.socialpilot.co/blog/sendible-pricing ; https://socialk.it/en/pricing/sendible ; https://www.socialchamp.com/blog/socialbee-pricing/ ; https://coldiq.com/tools/publer ; https://costbench.com/software/social-media-management/publer/ ; https://www.blotato.com/blog/later-pricing ; https://socialrails.com/blog/loomly-pricing ; https://soku.ai/alternatives/predis-ai/review ; https://affinco.com/blaze-ai-pricing/ ; https://www.g2.com/products/ocoya/reviews ; https://apaya.com/blog/best-ai-social-media-tools ; https://socialrails.com/blog/taplio-pricing ; https://www.wearefounders.uk/hypefury-vs-typefully-2026-which-x-tool-is-worth-paying-for/ ; https://costbench.com/software/ai-writing-tools/jasper/ ; https://www.eesel.ai/blog/simplified-ai-pricing ; https://www.eesel.ai/blog/opusclip-pricing ; https://www.ssemble.com/blog/best-ai-clipping-tools-2026 ; https://hackceleration.com/labs/castmagic-pricing ; https://www.castmagic.io/software-reviews/repurpose-io ; https://www.krea.ai/blog/higgsfield-pricing-explained-2026-unlimited-credits-and-real-monthly-costs ; https://modelslab.com/blog/api/veo-3-1-vs-kling-3-sora-2-ai-video-api-cost-2026 ; https://www.cometapi.com/ai-video-api-pricing/ ; https://tokenmix.ai/blog/ai-video-generation-api ; https://www.aifreeapi.com/en/posts/openai-image-generation-api-pricing ; https://aiproductivity.ai/blog/canva-vs-adobe-express-2026/ ; https://gptprompts.ai/ai-pricing/canva-ai-pricing ; https://www.saasworthy.com/product/lumen5/pricing ; https://www.wireflow.ai/blog/arcads-pricing ; https://resources.rework.com/tools/ai-tools/best-ai-ad-creative-tools-2026 ; https://www.eesel.ai/blog/lindy-vs-relevance-ai ; https://felloai.com/genspark-ai-pricing/ ; https://www.taskade.com/blog/manus-ai-review ; https://www.usecarly.com/blog/chatgpt-agent-mode/ ; https://www.blotato.com/blog/ai-agents-social-media ; https://techsy.io/en/blog/claude-cowork-vs-chatgpt-agents ; https://reachrightstudios.com/blog/best-sermon-clip-software/ ; https://insights.velocityaipartners.co/tools/pulpit-ai ; https://www.lafabriquedunet.fr/logiciel/swello ; https://tool-advisor.fr/blog/outils-reseaux-sociaux/ ; https://www.agenceecofin.com/reseaux-sociaux/3011-114180-35-ouest-et-favikon-devoilent-le-top-100-des-leaders-et-entrepreneurs-d-afrique-francophone-les-plus-influents-sur-les-reseaux-sociaux ; https://www.pixlstudio.africa/top-14-des-influenceurs-a-suivre-pour-votre-communication-en-cote-d-ivoire-2026.
