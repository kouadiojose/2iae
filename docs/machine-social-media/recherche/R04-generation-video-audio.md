# R04. Génération vidéo et audio par API, et place de Higgsfield (état au 1er octobre 2026)

Rapport de recherche pour la machine social media multi-clients de José Kouadio (Markel-Tech, SEVARTA, 2IAE). Toutes les données sont datées. Quand une donnée n'a pas pu être vérifiée sur une source primaire, elle est marquée « à vérifier » et reprise dans la section Incertitudes.

## 0. Résumé exécutif

1. Higgsfield a désormais un MCP officiel hébergé (mcp.higgsfield.ai/mcp, 30 avril 2026), une API publique payée à la génération (changelog du 16 septembre 2026, console open.higgsfield.ai), des SDK Python et TypeScript, une CLI et des Agent Skills pour Claude Code. Mais l'Unlimited de José ne vaut que sur le site web : Higgsfield écrit que le MCP, la CLI et les autres surfaces « tournent sur crédits », et interdit « automation, scripting, credential sharing and reselling ».
2. Les prix des API vidéo se sont effondrés. En septembre 2026, 10 s en 720p avec audio natif coûtent de 0,50 $ (Veo 3.1 Lite) à 4 $ (Veo 3.1 Standard) ; Kling 3.0, Seedance, Wan 3.0, MiniMax H3 et LTX-2.3 couvrent la zone 0,06 à 0,30 $/s. Sora 2 a été retirée de l'API OpenAI le 24 septembre 2026.
3. Les voix françaises coûtent presque rien : ElevenLabs v3 0,08 $ par 1 000 caractères, Eleven v4 0,022 $ en promotion jusqu'au 12 octobre 2026, OpenAI gpt-4o-mini-tts environ 0,015 $ la minute, Google Chirp 3 HD 30 $ par million de caractères. La musique reste délicate : Suno n'a pas d'API publique ; ElevenLabs Music (0,15 $/min) et Lyria 3 (0,04 à 0,08 $ par morceau) sont les voies programmables avec droits commerciaux.
4. Pour la vidéo programmée (texte, sous-titres mot à mot, chiffres, planches), Remotion est gratuit jusqu'à 3 personnes, puis 25 $/mois par siège ou 0,01 $ par rendu avec minimum 100 $/mois ; le rendu coûte environ 0,02 $ la minute sur Lambda. Shotstack, Creatomate et JSON2Video coûtent 39 à 54 $/mois.
5. Sur TikTok, les vidéos de 15 à 30 s font le meilleur engagement (6,00 %, Socialinsider, 111 000 vidéos de marques, janvier à juin 2026), le crochet se joue sous 2 à 3 s, le style natif bat le style cinéma. Les labels IA sont quasi automatiques (C2PA, 3 milliards de vidéos étiquetées sur TikTok, détection YouTube depuis mai 2026, label de profil Instagram depuis le 31 août 2026) et l'article 50 de l'AI Act s'applique depuis le 2 août 2026. Le label n'est pas un signal de rétrogradation ; le contenu IA non déclaré, lui, est pénalisé.

## 1. Higgsfield.ai : API, MCP, Unlimited et automatisation

### 1.1 Ce qui existe officiellement (septembre 2026)

Le centre d'aide de Higgsfield (page « official Higgsfield platforms », publiée le 5 septembre 2026, modifiée le 24 septembre 2026) liste comme surfaces officielles : le site higgsfield.ai, Open Higgsfield (console API, open.higgsfield.ai, pour les clés, le catalogue, l'usage et la facturation), la documentation docs.higgsfield.ai, et le MCP officiel dont « la seule URL officielle est mcp.higgsfield.ai/mcp ».
Source : https://higgsfield.ai/creator-hub/help-center/getting-started/official-higgsfield-platforms

Le changelog Higgsfield date les lancements de 2026 : MCP (fin avril 2026, 30 avril selon la presse spécialisée), Kling 3.0 Turbo (16 juin), Gemini Omni Flash et Nano Banana Pro / 2 Lite (29 juin), Seedream 5.0 (7 juillet), Seedance 2.0 et 2.5 (6 août, clips jusqu'à 30 s et jusqu'à 50 références), Cinema Studio 4.0 (12 août, générations de 30 s), Wan 3.0 Prime (24 août), Recraft V4 (27 août), MiniMax H3 Max (31 août), Genjutsu (1er septembre, transfert de mouvement), 3D Jutsu (4 septembre), Higgsfield API (16 septembre, « standalone developer product », 50+ modèles, paiement à la génération), GPT Image 2.5 (22 septembre), Production Skills Bundle et Seedream 5.0 Pro (23 septembre), Eleven v4 (28 septembre).
Source : https://higgsfield.ai/creator-hub/changelog

La documentation API décrit « une API authentifiée et asynchrone » : on soumet une requête à l'endpoint d'un modèle, on relit le statut par polling ou webhook, et les fichiers de sortie restent disponibles « au moins sept jours ». Pages documentées : authentification, cycle de vie des requêtes, polling, webhooks, upload de fichiers, erreurs et reprises, limites de débit, facturation et rétention, SDK officiels Python et TypeScript. Les modèles et leur documentation se découvrent depuis la console (console.higgsfield.ai). La doc ne publie pas de grille de prix centralisée : chaque modèle a sa page.
Sources : https://docs.higgsfield.ai/docs et https://docs.higgsfield.ai/docs/llms.txt

Les profils tiers (API Evangelist, septembre 2026) décrivent l'offre : SDK Python « higgsfield-client », SDK Node « @higgsfield/client », CLI « @higgsfield/cli », MCP distant et jeu public d'Agent Skills pour Claude, Cursor et Codex ; facturation uniquement des générations réussies ; trois appels (soumettre, interroger, récupérer).
Source : https://github.com/api-evangelist/higgsfield

Le MCP officiel (page higgsfield.ai/mcp) fonctionne avec Claude, Claude Code, ChatGPT et tout client MCP, « sans clé API » (connexion OAuth au compte Higgsfield), et expose « 30+ modèles » dont Nano Banana Pro, Google Omni Flash, Seedance 2.5, Seedream 5.0 Lite, Seedance 2.0, Kling 3, GPT Image 2 et Soul 2.0. La page ne précise ni prix ni limites.
Source : https://higgsfield.ai/mcp

Fait important pour José : tout ce que fait le MCP est débité en crédits du compte. L'article officiel « Annual Unlimited AI Image and Video Plans » dit que l'illimité « s'applique sur higgsfield.ai » et que « la production via MCP, CLI, Canvas, Supercomputer et Marketing Studio tourne sur crédits ».
Source : https://higgsfield.ai/blog/annual-unlimited-ai-video-plans

### 1.2 Modèles proposés sur Higgsfield (2026)

Vidéo : Seedance 2.0 et 2.5 (jusqu'à 30 s), Kling 3.0 et Turbo, Veo 3.1, Gemini Omni Flash, Wan 3.0 Prime, MiniMax H3 Max, Sora 2 (jusqu'à son retrait), Genjutsu (transfert de mouvement), Cinema Studio 4.0 (caméra, lumière, multi-plans, 30 s ; la page produit revendique 4K et une minute, à vérifier), Lipsync.
Image : Soul 2.0 et Soul Cinema (photoréalisme), Soul ID (visage persistant entraîné sur environ 20 photos, réutilisable dans Kling, Veo et Seedance), Popcorn (storyboard de 4 à 8 images cohérentes), Nano Banana Pro et 2, Seedream 4.5 et 5.0, FLUX.2 Pro, GPT Image 2 et 2.5, Recraft V4 (SVG).
Audio : Eleven v3 puis v4.
Sources : https://higgsfield.ai/creator-hub/help-center/ai-models/which-ai-model-should-i-use ; https://higgsfield.ai/blog/how-to-keep-ai-persona-consistent-higgsfield-popcorn ; https://higgsfield.ai/creator-hub/changelog

### 1.3 Le plan Unlimited : ce qui est illimité et ce qui ne l'est pas

Grille de prix relevée en septembre 2026 par plusieurs guides concordants : Free 0 $ (10 crédits par jour, filigrane) ; Starter 19 $/mois (270 crédits) ; Plus 47 $/mois en annuel ou 59 $ mensuel (1 200 crédits) ; Ultra 99 $/mois en annuel ou 129 $ mensuel (3 000 crédits). L'article officiel « All Unlimited » cite Plus à 49 $/mois. Les prix ont bougé plusieurs fois dans l'année.
Sources : https://sloptv.co/guides/higgsfield-pricing ; https://www.krea.ai/blog/higgsfield-pricing-explained-2026-unlimited-credits-and-real-monthly-costs ; https://higgsfield.ai/blog/higgsfield-all-unlimited-explained

Règles de l'« All Unlimited » (article officiel) :
- 23 modèles (11 image, 7 vidéo, 5 audio) dont Seedance 2.0, Kling 3.0, FLUX.2 Pro, Eleven v3.
- Accès par fenêtre : 7 jours inclus avec Plus et au-dessus ; passes Marketplace de 1 jour (99 $) ou 3 jours (250 $) ; essai gratuit de 1 jour pour les nouveaux comptes qui se convertit en Plus.
- Concurrence : « Unlimited mode runs a maximum of 1 concurrent image, video, or audio generation at a time, shared across all models ».
- Plafonds : images jusqu'à 2K, vidéo 720p à 1080p, jusqu'à 8 s par défaut (15 s sur les paliers supérieurs ou en annuel).
- File d'attente : « Unlimited runs in the standard queue, while credit-based generations always take the priority queue ».
- Interdictions : « Automation, scripting, credential sharing, and reselling are prohibited ».
Source : https://higgsfield.ai/blog/higgsfield-all-unlimited-explained

Le « 365 Unlimited » (annuel) couvre six modèles d'image, pas de vidéo : Seedream 5.0 Lite, Flux.2 Pro 1K, Seedream 4.5, Nano Banana, Kling O1 Image, GPT Image ; valable 365 jours à partir de l'activation tant que l'abonnement reste actif ; « une vidéo ou deux images à la fois » ; les nouveaux modèles n'y entrent pas automatiquement et arrivent en fenêtres de 7 jours ou en passes Marketplace.
Source : https://higgsfield.ai/blog/annual-unlimited-ai-video-plans

Droits commerciaux : la page de prix dit « usage commercial non inclus » sur le plan gratuit, tandis que les conditions (section 4.4) ne restreignent pas la propriété des sorties selon un guide tiers ; les conditions elles-mêmes répondaient 404 le 1er octobre 2026. Aucune source ne mentionne la case « I own rights » ; elle concerne vraisemblablement l'upload d'images de référence, à vérifier dans l'interface. Higgsfield a levé 400 M$ en août 2026 (valorisation 5,4 Md$) : un intermédiaire solide qui revend Kling, Seedance, Veo, Wan, MiniMax et Flux, pas un modèle en propre.
Source : https://sloptv.co/guides/higgsfield-pricing

### 1.4 Automatiser sans API : Claude-in-Chrome, fiabilité, risque

Ce que José fait aujourd'hui (skill « production-video-higgsfield » : pilotage du navigateur, une vidéo à la fois, boucle auto-planifiée) tombe sous la clause « automation, scripting » de l'Unlimited, et les guides notent une « revue manuelle des comptes à activité inhabituelle ». Anthropic rappelle que l'utilisateur « reste responsable de toutes les actions du navigateur effectuées par Claude en son nom, y compris le respect des conditions des sites tiers sur l'accès automatisé ».
Sources : https://support.claude.com/en/articles/12902428-use-claude-in-chrome-safely ; https://higgsfield.ai/blog/higgsfield-all-unlimited-explained

Fiabilité : un seul flux à la fois, file standard, captcha, interface qui change plusieurs fois par semaine, sessions qui expirent. Des pipelines publics Claude Code + Playwright + Higgsfield existent, ce qui prouve que c'est faisable, pas que c'est autorisé.
Source : https://gist.github.com/AKCodez/0d3f9874d0e147bd75a097ca0cc1dcc3

Conclusion : l'Unlimited reste un bon atelier manuel à 99 à 129 $/mois pour les clips de 15 s en Seedance 2.5 ou Kling 3.0. Pour une plateforme multi-clients qui tourne sans surveillance, la voie propre est l'API Higgsfield (ou le MCP) en crédits, ou les API directes (fal, Gemini, Kling, BytePlus), moins chères pour le même modèle.

## 2. Les API vidéo directes (septembre 2026)

### 2.1 Tableau comparatif

Prix relevés entre le 25 septembre et le 1er octobre 2026 sur les pages officielles ou les premières plateformes de revente. « I2V » = image-to-video. Les délais de rendu sont des ordres de grandeur rapportés par les fournisseurs ou des guides datés, pas des mesures de ma part.

| Modèle | Accès | Prix (sept. 2026) | Durée max | Résolution | I2V | Audio natif | Cohérence personnage | Délai | Points de vigilance |
|---|---|---|---|---|---|---|---|---|---|
| Veo 3.1 Standard | API Gemini, Vertex | 0,40 $/s (720p, 1080p), 0,60 $/s (4K) | 4, 6, 8 s ; extension +7 s jusqu'à 148 s (720p seulement) | 720p à 4K (1080p et 4K : 8 s seulement) | oui, first/last frame | oui | jusqu'à 3 images de référence (8 s, ratio identique) | 11 s à 6 min | personGeneration « allow_adult » seulement en I2V et en UE/UK/CH/MENA ; SynthID ; vidéos conservées 2 jours |
| Veo 3.1 Fast | idem | 0,10 $/s (720p), 0,12 $/s (1080p), 0,30 $/s (4K) | idem | idem | oui | oui | idem | plus court | idem |
| Veo 3.1 Lite | idem | 0,05 $/s (720p), 0,08 $/s (1080p), pas de 4K | idem | 720p, 1080p | oui | oui | idem | court | idem |
| Gemini Omni Flash | API Gemini | environ 0,10 $/s à 720p (5 792 tokens vidéo/s à 17,50 $/M), 0,034 $/s 360p, 0,152 $/s 1080p, 0,304 $/s 4K | 10 s, extension jusqu'à 40 s | 360p à 4K | oui (texte, image, audio, vidéo en entrée) | oui | mis en avant par Google (« character consistency », édition conversationnelle multi-tours) | non publié | modèle « par défaut » recommandé par Google depuis juin 2026 |
| Kling 3.0 Omni | API officielle kling.ai/dev (packs prépayés) | 0,084 $/s 720p sans audio ; 0,112 $/s 720p audio ou 1080p sans audio ; 0,140 $/s 1080p audio ; 0,42 $/s 4K | 15 s | 720p à 4K | oui | oui (option) | éléments / Soul ID via Higgsfield | quelques minutes | packs à partir de 9,80 $ (essai) puis 700 $ ; crédits non transférables depuis le plan grand public |
| Seedance 2.0 | fal, BytePlus ModelArk | fal : 0,136 $/s 480p, 0,3024 $/s 720p, 0,2419 $/s Fast, 0,682 $/s 1080p ; BytePlus : 4,3 à 7 $ par million de tokens 720p | 15 s (30 s annoncé sur Higgsfield) | 480p à 1080p | oui, image de début et de fin, jusqu'à 50 références (Higgsfield) | oui, « musique, effets, dialogue synchronisé sans surcoût » | bonne (références multiples) | quelques minutes | prix très variable selon la plateforme (Replicate 0,18 $/s 720p) |
| Seedance 2.5 | fal, BytePlus | environ 0,23 $/s 720p (teamday) ; 0,79 $/s 1080p audio (Hedra, 25 sept. 2026) ; BytePlus 6,4 à 10,7 $/M tokens | 30 s | 720p, 1080p | oui | oui | bonne | quelques minutes | le plus cher des modèles chinois |
| Seedance 1.5 Pro | fal | 0,1125 $/s 1080p audio ; 0,0563 $/s sans audio | 12 s | 720p, 1080p | oui | oui | moyenne | 1 à 3 min | bon rapport qualité-prix |
| Runway Gen-4.5 | API Runway (crédits 0,01 $) | 0,12 $/s (12 crédits/s) | 10 s | 720p, 1080p | oui | non | références | 1 à 2 min | top-up minimum 10 $ ; crédits API séparés du site |
| Luma Ray 3.2 | API Luma | environ 0,06 $/s 720p, 0,24 $/s 1080p SDR, x2 HDR, x3 HDR+EXR | 10 s | 720p à 1080p (4K upscale) | oui | non | moyenne | 1 à 2 min | reframe vidéo 0,03 à 0,36 $/s |
| OpenAI Sora 2 / 2 Pro | API OpenAI (retirée) | était 0,10 $/s (720p) ; Pro 0,30 à 0,70 $/s | 20 s (120 s avec extensions) | 720p à 1080p | oui | oui | personnages (« cameos ») | minutes | dépréciation annoncée le 24 mars 2026, arrêt le 24 septembre 2026, aucun remplaçant listé |
| MiniMax Hailuo 2.3 / H3 | API MiniMax | Hailuo 2.3 : 0,28 $ (768p 6 s), 0,56 $ (768p 10 s), 0,49 $ (1080p 6 s) ; 2.3 Fast : 0,19 $, 0,32 $, 0,33 $ ; modèles « legacy », remplacés par MiniMax H3 et H3 Max facturés à la seconde (environ 0,08 $/s 768p) | 10 s (H3 : 15 s) | 768p, 1080p | oui | H3 : oui | moyenne | 1 à 3 min | Hailuo 2.3 déprécié ; vérifier H3 |
| Wan 2.6 / 2.7 / 3.0 (Alibaba) | fal, Replicate, Alibaba Cloud | Wan 2.6 : 0,04 $/s 480p à 0,12 $/s 1080p (T2V), 0,10 à 0,15 $/s I2V ; Wan 2.7 : 0,15 $/s 1080p ; Wan 3.0 : 0,083 $/s 720p, 0,20 $/s 1080p ; Prime 0,28 $/s | 15 s (Wan 3.0 : 30 s) | 480p à 1080p | oui | Wan 3.0 : oui, multi-locuteurs | correcte | 1 à 4 min | Wan 2.2 ouvert (Apache 2.0, juillet 2025) ; 2.6 et suivants sont commerciaux |
| LTX-2.3 (Lightricks) | fal, Replicate, poids ouverts | 0,06 $/s 1080p, 0,12 $/s 1440p, 0,24 $/s 2160p ; Fast 0,04 / 0,08 / 0,16 $/s ; audio-to-video 0,10 $/s | 20 s | 1080p à 4K, 50 fps | oui | oui, lipsync | moyenne | rapide | licence gratuite sous 10 M$ de revenu annuel ; auto-hébergeable |
| Pika 2.5 | API Pika, agrégateurs | 0,05 à 0,15 $/s | 10 s | 1080p | oui | effets Pikaffects | faible | 1 à 2 min | surtout effets « fun » |
| Vidu Q2 | API Vidu | environ 0,0375 $/s ; Q2 Pro 28 crédits/s | 8 s | 1080p | oui, références multiples | non | bonne (références) | rapide | agrégateurs |
| Grok Imagine Video 1.5 (xAI) | API xAI | 0,14 $/s 720p | 15 s | 720p | oui | oui | moyenne | rapide | nouveau |

Sources principales :
- Veo 3.1 : https://ai.google.dev/gemini-api/docs/pricing (page datée du 1er octobre 2026) et https://ai.google.dev/gemini-api/docs/veo
- Gemini Omni Flash : https://ai.google.dev/gemini-api/docs/video ; https://www.atlascloud.ai/models/gemini-omni ; https://aireiter.com/blog/gemini-omni-flash-pricing-api-guide
- Kling : https://kling.ai/dev/pricing ; https://www.cloudzero.com/blog/kling-ai-pricing/
- Seedance : https://fal.ai/models/bytedance/seedance-2.0/image-to-video ; https://techjacksolutions.com/ai-tools/bytedance-seed/bytedance-seed-pricing/ ; https://www.hedra.com/blog/video-model-api-cost-comparison (25 septembre 2026)
- Sora 2 : https://developers.openai.com/api/docs/deprecations ; https://unifically.com/blogs/sora-api
- Runway : https://runway.com/pricing ; https://www.eesel.ai/blog/runway-ai-pricing
- Luma : https://docs.agents.lumalabs.ai/guides/pricing/ ; https://www.atlascloud.ai/models/luma-ray-3.2
- MiniMax : https://platform.minimax.io/docs/guides/pricing-paygo
- Wan : https://evolink.ai/blog/wan-api-pricing-guide ; https://www.atlascloud.ai/blog/tips/wan-2-6-api-guide
- LTX-2 : https://www.globenewswire.com/news-release/2026/01/06/3213304/0/en/Lightricks-Open-Sources-LTX-2-the-First-Production-Ready-Audio-and-Video-Generation-Model-With-Truly-Open-Weights.html ; https://fal.ai/ltx-2.3
- Pika, Vidu : https://dev.pika.art/pricing ; https://muapi.ai/comparison/vidu-q2-text-to-image
- Classement par prix (septembre 2026) : https://www.teamday.ai/blog/best-ai-video-models-2026

### 2.2 Lecture du tableau

Coût d'un clip de 10 s en 720p avec audio, septembre 2026 : Veo 3.1 Lite 0,50 $, LTX-2.3 0,60 $, MiniMax H3 0,80 $, Wan 3.0 0,83 $, Gemini Omni Flash et Veo 3.1 Fast 1,00 $, Kling 3.0 1,12 $, Runway Gen-4.5 1,20 $ (sans audio), Seedance 2.0 1,50 à 3,00 $ selon la plateforme, Veo 3.1 Standard 4,00 $. « Même avec trois prises par plan, la plupart des modèles coûtent moins de 15 $ pour une publicité de 30 s ».
Source : https://www.teamday.ai/blog/best-ai-video-models-2026

Veo 3.1 impose trois contraintes : 1) les personnes en image-to-video sont limitées à « allow_adult » (pas d'enfants), seule valeur acceptée en UE, UK, Suisse et MENA ; 2) 1080p, 4K et images de référence imposent 8 s ; 3) l'extension ne marche qu'en 720p. Le forum Google rapporte des faux positifs du filtre « sécurité des enfants » sur des storyboards commerciaux anodins.
Sources : https://ai.google.dev/gemini-api/docs/veo ; https://discuss.ai.google.dev/t/veo-3-1-image-to-video-blocks-wholesome-commercial-storyboard-child-safety-false-positive/131917

Filtres et sujets religieux : aucune documentation (Google, Kling, ByteDance, OpenAI) ne cite la religion comme catégorie bloquée ; les catégories sont violence, sexualité, haine, personnes réelles identifiables, mineurs, tromperie. Pour les églises et SEVARTA, le risque n'est pas le blocage d'un verset mais celui d'un visage de pasteur réel ou d'une scène avec enfants. À tester modèle par modèle.
Sources : https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/responsible-ai-and-usage-guidelines ; https://unifically.com/blogs/sora-api

Droits commerciaux : fal indique que l'API Seedance 2.0 « permet les applications commerciales » ; Google, Kling, Runway, Luma et Lightricks (sous 10 M$ de revenu) accordent l'usage commercial sur leurs offres payantes ; les revendeurs héritent des conditions de chaque modèle. Sora 2 : dépréciation annoncée le 24 mars 2026, arrêt le 24 septembre 2026, aucun remplaçant listé.
Source : https://developers.openai.com/api/docs/deprecations

## 3. Avatars, lipsync, voix, musique

### 3.1 Avatars et lipsync

| Service | Offre | Prix (2026) | Remarques |
|---|---|---|---|
| HeyGen API | Avatar IV / V (photo), Digital Twin, Studio Avatar, Video Agent, Cinematic Avatar | Avatar IV photo 0,05 $/s (3 $/min) ; Avatar V, IV Digital Twin, Studio 0,0667 $/s (4 $/min) ; Avatar III Digital Twin 0,0167 $/s ; Video Agent 0,0333 $/s ; Cinematic Avatar 7 $ par clip de 4 à 15 s ; portefeuille prépayé à partir de 5 $ ; plus de crédits API gratuits depuis février 2026 | API séparée des abonnements ; traduction vidéo disponible ; la page officielle redirige vers app.heygen.com/developers/api (non chargée) |
| Sync Labs (sync.so) | lipsync-2, lipsync-2-pro, sync-3 | lipsync-2 : 0,04 à 0,05 $/s ; lipsync-2-pro : 0,067 à 0,083 $/s ; sync-3 : 0,107 à 0,133 $/s ; plans Hobbyist 5 $ (vidéos de 1 min max), Creator 19 $, Growth 49 $, Scale 249 $ (30 min max) | aussi via fal ; idéal pour « redoubler » une vidéo existante (sermon traduit, nouveau texte sur un visage existant) |
| ByteDance OmniHuman 1.5 | audio + image vers vidéo parlante | 0,12 $/s sur BytePlus (officiel) ; 0,16 $/s sur Hedra ; 0,14 à 0,21 $/s chez les revendeurs | expressivité corporelle, pas seulement les lèvres |
| Hedra Character-3 | avatar omnimodal | 0,025 $/s 540p, 0,05 $/s 720p, 0,0625 $/s 1080p (grille API) ; passage à des crédits (6 crédits/s) ; plans jusqu'à 75 $/mois | Hedra héberge aussi OmniHuman et Omnia |

Sources : https://www.g2.com/articles/heygen-api-pricing ; https://realtimeavatar.ai/blog/heygen-api-pricing-explained ; https://sync.so/pricing ; https://sync.so/docs/models/lipsync ; https://www.byteplus.com/en/product/OmniHuman ; https://www.hedra.com/models/video/bytedance/omnihuman-15 ; https://www.usagepricing.com/blueprint/hedra

Pour les verticales de José : un avatar « présentateur » d'école (2IAE) ou de maison d'édition (SEVARTA) coûte 3 à 4 $ la minute en HeyGen, ou moins de 1 $ la minute en OmniHuman / Hedra sur une photo générée (Soul, Nano Banana). Le lipsync sur un vrai pasteur exige son consentement écrit (deepfake au sens de l'AI Act, voir 5.3).

### 3.2 Voix (TTS)

| Service | Prix (2026) | Français et accents | Remarques |
|---|---|---|---|
| ElevenLabs v3 | 0,08 $ par 1 000 caractères (page API, 1er octobre 2026) ; Multilingual v2 0,08 $ ; Flash/Turbo 0,04 $ | 74 langues dont français ; tags d'émotion ; clonage de voix par ID | licence commerciale à partir de Starter (6 $/mois) ; Creator 22 $, Pro 99 $, Scale 299 $, Business 990 $ |
| ElevenLabs v4 | 0,022 $ par 1 000 caractères (réduction de 72 % jusqu'au 12 octobre 2026) ; v4 Turbo 0,011 $ | 90+ langues, multi-locuteurs | sorti fin septembre 2026 |
| OpenAI gpt-4o-mini-tts | 0,60 $ par million de caractères d'entrée + 12 $ par million de tokens audio (environ 0,015 $ la minute) | français correct, accent neutre, instructions de style | pas de clonage |
| OpenAI gpt-realtime-2.1 | 32 $/M tokens audio entrée, 64 $/M sortie (environ 0,077 $/min parlée) ; mini à 10 $ / 20 $ | temps réel | pour agents vocaux, pas pour la production |
| Google Chirp 3 HD | 30 $ par million de caractères ; 1 million gratuit par mois | fr-FR et fr-CA ; pas de voix « français d'Afrique de l'Ouest » documentée | Gemini 3.8 Flash TTS annoncé à 1 $/M texte et 18 $/M audio à partir du 1er janvier 2027 |
| MiniMax speech-2.6 turbo | 60 $ par million de caractères (legacy) | multilingue | clonage |

Sources : https://elevenlabs.io/pricing/api ; https://developer.puter.com/tutorials/elevenlabs-api-pricing/ ; https://community.openai.com/t/understanding-gpt-4o-mini-tts-pricing-input-characters-cost/1151816 ; https://www.layer3labs.io/guides/openai-realtime-api-pricing ; https://cloud.google.com/text-to-speech/pricing ; https://ai.google.dev/gemini-api/docs/pricing ; https://platform.minimax.io/docs/guides/pricing-paygo

Accent ivoirien ou ouest-africain : aucune API ne propose un accent « français d'Abidjan » étiqueté. La seule voie fiable est le clonage instantané ou professionnel d'une voix consentante (ElevenLabs, à partir du plan Creator pour le clonage professionnel) : José ou un collaborateur enregistre 30 minutes, et la voix devient un actif de la plateforme (voix 2IAE, voix SEVARTA). À 0,08 $ par 1 000 caractères, une voix off de 60 s (environ 900 caractères) coûte 0,07 $.

### 3.3 Musique et droits

| Service | API | Prix (2026) | Droits sur les réseaux |
|---|---|---|---|
| Suno | pas d'API publique (invitation ou entreprise seulement) | Pro 8 $/mois (2 500 crédits), Premier 24 $ (10 000 crédits) | droits commerciaux pour Pro et Premier, avec clause de limitation de responsabilité sur les ressemblances ; le MCP et les automatisations tierces reposent sur des API non officielles (risque de ban) |
| ElevenLabs Music | oui | 0,15 $ par minute (page API) ; environ 900 crédits par minute sur les plans | licence commerciale dès Starter ; entraînée sur catalogues licenciés (Merlin, Kobalt) |
| Google Lyria | Lyria 2 sur Vertex AI : 0,06 $ par 30 s ; Lyria 3 Clip Preview 0,04 $ par morceau, Lyria 3 Pro 0,08 $ par morceau sur l'API Gemini (août 2026) | SynthID | usage commercial sur Vertex et l'API payante |
| Stable Audio 2.5 | oui (Stability, fal) | 0,20 $ par génération quelle que soit la durée | licence commerciale sur la plateforme payante ; Stable Audio 3.0 annoncé |
| Udio | pas d'API ; plateforme en reconstruction après les accords UMG (octobre 2025), Warner (novembre 2025) et Merlin (janvier 2026) ; téléchargements désactivés (« walled garden ») | abonnements | nouvelle plateforme licenciée annoncée pour 2026 |
| MiniMax Music | API discontinuée pour les nouveaux clients depuis le 20 août 2026 | était 0,15 $ par morceau de 5 min | sans objet |
| Epidemic Sound | API développeurs (50 000 titres, 200 000 effets), plans « Scale » au volume et Enterprise ; sous-licence aux utilisateurs finaux ; soundtracking automatique | sur devis | musique humaine, « cleared » pour tous les réseaux, safelisting YouTube |
| Artlist | licence unifiée musique + SFX + footage + templates ; pas d'API publique documentée | abonnement (environ 199 $/an) | tous usages y compris publicité |

Sources : https://musicapi.ai/blog/best-ai-music-api-2026 ; https://sonilo.com/blog/comparisons/pay-as-you-go-ai-music-api-commercial-use-rights ; https://elevenlabs.io/pricing/api ; https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/lyria-music-generation ; https://cellcog.ai/blog/lyria-3-5/ ; https://github.com/api-evangelist/stability-audio ; https://www.musicbusinessworldwide.com/udio-strikes-ai-licensing-deal-with-merlin-after-umg-and-warner-music-settlements/ ; https://platform.minimax.io/docs/guides/pricing-paygo ; https://www.epidemicsound.com/blog/epidemic-sound-api/ ; https://developers.epidemicsound.com/

Point juridique : la musique IA ne déclenche pas de revendication Content ID, mais elle n'est pas non plus protégée pour le client. Epidemic Sound reste la seule voie « blanchie » avec API pour les clients exigeants (églises sur YouTube, publicité). Pour les Reels et TikTok organiques, la bibliothèque interne de la plateforme reste la plus performante et la plus sûre (les comptes business n'ont accès qu'à la bibliothèque commerciale).

## 4. Vidéo programmée par modèles (texte, données, sous-titres)

| Outil | Modèle | Prix (2026) | Rendu | Pour José |
|---|---|---|---|---|
| Remotion | React, composants vidéo ; rendu sur serveur, Lambda ou Cloud Run | gratuit pour individus et entreprises jusqu'à 3 personnes ; au-delà : Creators 25 $/mois par siège, Automators 0,01 $ par rendu avec minimum 100 $/mois, Enterprise | Lambda : 1 min de vidéo 0,017 $ (fonction chaude) à 0,021 $ (froide), 10 min HD 0,103 $, 10 s en 4K 0,013 $ (us-east-1, 2 048 Mo) ; plus S3 et logs | la pile de José (Node, React, Vite, Tailwind) est exactement celle de Remotion ; Markel-Tech étant à 3 personnes ou moins, la licence gratuite s'applique probablement (à confirmer selon l'effectif réel) |
| Shotstack | JSON, API de montage, templates | à partir de 39 $/mois pour 200 min ; pay as you go 0,30 $/min ; dépassement +30 % | cloud | bon pour des templates simples ; TTS en sus |
| Creatomate | JSON, templates, éditeur | à partir de 54 $/mois (environ 143 min 720p) ; plus rentable en volume (jusqu'à 40 %) | cloud | TTS en crédits supplémentaires |
| JSON2Video | JSON, templates | 49 $/mois pour 200 min Full HD, TTS (Azure, ElevenLabs) inclus, arrêt net sans dépassement, 10 min gratuites | cloud | le moins cher à l'entrée |
| Plainly | After Effects vers API | Starter 69 $ (50 min), Explorer 134 $ (100 min, API), Team 259 $, Pro 649 $, Unlimited 1 500 $ | cloud | pour des templates AE existants |
| Nexrender | After Effects, open source | gratuit auto-hébergé (nécessite AE sous licence) ; Nexrender Cloud 119 $/mois + 0,21 $ par minute rendue | serveur Windows/Mac avec AE | lourd |
| Editframe | API de montage | non vérifié en 2026 | | à écarter faute de données |
| FFmpeg + libass | sous-titres ASS « karaoké » mot à mot | gratuit | serveur | Whisper ne donne pas de timestamps par mot fiables ; utiliser WhisperX (alignement wav2vec2) ou whisper-timestamped ; projets ouverts : karaoke-caption, auto-captions, word-by-word-captions |

Sources : https://www.remotion.pro/license ; https://www.remotion.dev/docs/lambda/cost-example ; https://json2video.com/how-to/shotstack-alternative/ ; https://json2video.com/how-to/creatomate-alternative/ ; https://samautomation.work/blog/best-video-apis-developers-2026/ ; https://www.capterra.com/p/10026817/Plainly/ ; https://www.plainlyvideos.com/blog/nexrender-review ; https://github.com/hqman/karaoke-caption ; https://github.com/nikhil-reddy05/auto-captions ; https://whipscribe.com/tools/whisperx

Découpage de sermons : OpusClip (gratuit 60 min source, Starter 15 $ pour 150 min, Pro 29 $ pour 300 min avec API limitée, Zapier et MCP) et Vizard (Creator 29 $/mois ou 14,50 $ en annuel pour 600 crédits-minutes, score de viralité, API avec webhook, publication sur six réseaux). Les deux comptent les minutes sources : un sermon de 60 minutes = 60 crédits quel que soit le nombre de clips.
Sources : https://overlap.ai/blogs/best-ai-video-clipping-tools-2026 ; https://quso.ai/blog/best-sermon-clip-generators ; https://techsy.io/en/blog/opusclip-vs-vizard

## 5. Ce qui marche sur TikTok et Reels en 2026, et les règles de signalement IA

### 5.1 Formats et durées

- Socialinsider (111 000 vidéos de pages business, janvier à juin 2026) : sur TikTok, le taux d'engagement est maximal pour les vidéos de 0 à 30 s (6,00 %), puis 4,20 % (30 à 45 s), 4,30 % (45 à 60 s), 4,80 % (60 à 90 s), 5,20 % (90 à 120 s), 5,50 % (120 à 180 s), 5,80 % (plus de 180 s). Les vues, elles, montent avec la durée, avec le plus grand saut entre 120 et 180 s. Instagram Reels : engagement 0,80 % pour les petits comptes (1 000 à 5 000 abonnés) contre 0,40 % pour les grands ; meilleures durées 45 à 60 s (0,35 %, 10 374 vues moyennes). Facebook Reels : 0,30 % à 0,15 %, 120 à 180 s. LinkedIn : 6,70 % à 5,50 %, 120 à 180 s.
Sources : https://www.socialinsider.io/social-media-benchmarks/social-media-video-statistics ; https://www.socialinsider.io/blog/how-long-are-tiktok-videos/
- Crochet : « 63 % des vidéos au meilleur taux de clic donnent leur message principal dans les 3 premières secondes » ; les guides de 2026 convergent sur un crochet sous 2 s (mouvement, visage, texte à l'écran qui pose une promesse ou une tension), un texte à l'écran permanent (lecture sans son), des coupes toutes les 1 à 2 s, une « payoff » explicite, 24 à 38 s pour raconter hook, valeur, chute.
Source : https://awisee.com/blog/tiktok-video-length/ ; https://reap.video/blog/best-video-length-youtube-shorts-reels-tiktok
- Natif contre cinématique : le style créateur, tourné au téléphone, à la première personne, bat les spots « brillants » sur Meta et TikTok parce qu'il « se lit comme natif au fil ». L'UGC synthétique (avatars IA en talking-head) atteint un CPA à 10 à 15 % de l'UGC humain en trafic froid, avec un léger avantage à l'humain sur TikTok ; les sorties trop lisses sont rejetées rapidement par l'audience. Les clips « cinéma » (Seedance, Kling, Veo) ont leur place pour les teasers d'événement, les clips musicaux (SEVARTA), les reconstitutions historiques (genèse d'un événement culturel), moins pour les ventes de produits de beauté, où la démonstration crédible gagne.
Sources : https://kompozy.io/guides/ai-ugc-ads ; https://higgsfield.ai/blog/ai-avatars-vs-ugc-creators-2026 ; https://tok-vibes.com/blog/ugc-vs-ai-avatar-ads

### 5.2 Règles de signalement par plateforme (état au 1er octobre 2026)

- TikTok : label « AI-generated » obligatoire pour tout visuel ou audio IA montrant des personnes ou des scènes réalistes ; interdits : deepfakes de personnes réelles sans divulgation, médias synthétiques de personnes privées même étiquetés, contenus trompeurs ; label automatique via C2PA (depuis janvier 2025) et filigrane invisible ; 3 milliards de vidéos étiquetées fin juillet 2026 (1,3 milliard en novembre 2025) ; les textes IA (scripts, hashtags) n'exigent pas de label ; contenu non étiqueté détecté : label forcé, distribution réduite ou retrait ; le contenu étiqueté reste éligible au Creator Rewards Program ; l'utilisateur peut réduire le contenu IA dans « Manage Topics ». « Le label lui-même n'est pas un signal de rétrogradation » ; la ferme de contenu IA et le non-signalement le sont.
Sources : https://storrito.com/resources/tiktoks-2026-ai-labeling-rules-and-what-they-signal-for-platform-governance/ ; https://kompozy.io/guides/tiktok-ai-labeling-at-scale
- Meta : label « AI info » sur les posts organiques depuis mai 2026, automatique en publicité depuis juillet 2026 ; le 31 août 2026, Meta a renommé le label de compte en « AI-generated profile » et prévient que les profils IA non déclarés « peuvent voir leur portée limitée ». Meta affirme que le label de post n'a pas d'effet sur la portée ; des créateurs rapportent des baisses, explicables par les signaux d'engagement. Une étude évaluée par les pairs (Electronic Markets, mars 2026) montre que le label réduit l'engagement affectif et comportemental, surtout sur les contenus émotionnels.
Sources : https://techcrunch.com/2026/08/31/instagram-puts-new-limits-on-undisclosed-ai-profiles/ ; https://lookfamed.de/en/news/ai-labeling-on-instagram/ ; https://link.springer.com/article/10.1007/s12525-026-00883-2
- YouTube : depuis fin mai 2026, détection automatique des usages « photoréalistes significatifs » et label apposé même sans déclaration, placé au-dessus de l'icône de chaîne (long format) ou en bas à gauche (Shorts) ; label permanent pour les contenus faits avec Veo ou Dream Screen ou portant des métadonnées C2PA de génération complète ; contestation possible dans YouTube Studio pour les autres ; légères baisses de CTR observées sur les vidéos étiquetées.
Sources : https://9to5google.com/2026/05/27/youtube-updating-ai-content-labels/ ; https://www.digitalapplied.com/blog/ai-content-labeling-rules-advertisers-2026-reference
- C2PA : une vidéo sortie de Veo, Omni Flash ou d'un outil intégré porte des Content Credentials qui déclenchent le label à l'upload. Un ré-encodage FFmpeg retire souvent les métadonnées, pas le filigrane SynthID, et la détection par modèle continue. Retirer volontairement les marques viole les conditions des plateformes.
Source : https://www.sammapix.com/blog/what-are-content-credentials-c2pa
- AI Act (UE) : l'article 50 s'applique depuis le 2 août 2026. Les déployeurs qui produisent des deepfakes (image, audio, vidéo ressemblant à des personnes, objets ou lieux réels) doivent le divulguer quelle que soit l'intention, y compris artistique ou commerciale, au plus tard à la première exposition ; idem pour les textes IA d'intérêt public sans revue éditoriale. Le Code of Practice a été publié en version finale le 10 juin 2026 après trois brouillons ; environ 190 organisations l'avaient signé fin juillet 2026 ; il propose des icônes communes. Les clients de José en Ontario et en Côte d'Ivoire n'y sont soumis que s'ils visent un public de l'UE (diaspora, ventes SEVARTA en Europe).
Sources : https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content ; https://blog.peterkapartners.com/article-50-of-the-ai-act-in-practice-transparency-of-ai-systems-content-labeling-and-deepfakes/

### 5.3 Effet sur la portée : ce qu'on peut affirmer

Trois constats : 1) aucune plateforme n'annonce de pénalité pour un contenu IA correctement étiqueté ; 2) les pénalités frappent le non-signalement détecté, les profils IA non déclarés et les comptes « usine à contenu » ; 3) une partie du public réagit moins aux contenus émotionnels étiquetés IA, ce qui pèse sur les sermons et témoignages plus que sur un tutoriel ou une planche produit. Règle pratique : étiqueter ce qui est photoréaliste ou vocal, ne pas étiqueter le motion design et les captures d'écran, garder l'humain réel là où l'émotion porte le message.

## 6. Grille « type de vidéo, chaîne de production recommandée, coût unitaire, délai »

Coûts estimés par unité produite, hors main-d'œuvre humaine et hors coût des appels de rédaction (Claude), au 1er octobre 2026. « Prises » = nombre de générations lancées pour en retenir une.

| Type de vidéo | Chaîne recommandée | Coût unitaire estimé | Délai machine |
|---|---|---|---|
| Reel « nouveau produit beauté » 20 s, 9:16 (packshot animé + texte + voix) | photo produit déposée par la cliente, détourage (Canva MCP ou Nano Banana), 2 clips I2V de 8 s en Veo 3.1 Fast ou Kling 3.0 (3 prises), montage Remotion (texte, logo, CTA), voix ElevenLabs v3, musique bibliothèque de la plateforme ou ElevenLabs Music | vidéo : 2 x 8 s x 0,10 à 0,126 $ x 3 prises = 4,80 à 6 $ ; voix 0,05 $ ; musique 0,05 $ ; rendu 0,02 $ ; total 5 à 6,50 $ | 10 à 20 min |
| Clip UGC synthétique « avis cliente » 30 s | portrait Soul ou Nano Banana (0,07 $), script Claude, voix ElevenLabs (0,07 $), OmniHuman 1.5 ou HeyGen Avatar IV (30 s x 0,12 à 0,05 $), sous-titres mot à mot ASS, label IA | 1,70 à 3,80 $ | 5 à 10 min |
| Teaser « événement culturel » 15 s cinématique (genèse, ambiance) | storyboard Popcorn ou Nano Banana (3 images, 0,20 $), Seedance 2.0 ou Kling 3.0 I2V 15 s (3 prises), musique Lyria 3 Pro (0,08 $) ou Epidemic, titrage Remotion | 15 s x 0,126 à 0,30 $ x 3 = 5,70 à 13,60 $ ; total 6 à 14 $ | 15 à 30 min |
| Clip musical ou « music video » SEVARTA 60 s | Suno à la main (abonnement, 8 à 24 $/mois) ou ElevenLabs Music (0,15 $), 6 à 8 plans Seedance 2.5 ou Kling 3.0 de 8 à 15 s (3 prises), Soul ID pour la cohérence du personnage, montage Remotion ou FFmpeg | 60 s x 0,126 à 0,23 $ x 3 = 22 à 41 $ | 1 à 2 h |
| Highlights de sermon YouTube : 5 clips de 45 à 60 s | téléchargement YouTube, Scribe ou WhisperX (1 h = 0,22 $), sélection des moments par Claude, découpe FFmpeg, recadrage 9:16 (Luma reframe 0,12 $/s 720p ou recadrage par détection de visage maison), sous-titres mot à mot ASS, habillage Remotion ; pas de génération, pas de label IA (contenu réel) | 0,25 à 2 $ par lot de 5 clips (maison) ; ou 15 à 29 $/mois OpusClip/Vizard | 10 à 20 min par sermon |
| Sermon animé : extrait 30 s illustré en motion design | transcription, choix d'une citation, Claude Design ou Remotion (typographie animée, fond, versets), voix réelle du pasteur conservée, musique Epidemic | 0,05 à 0,30 $ | 5 min |
| Tutoriel logiciel 60 à 90 s (2IAE, Markel-Tech) | captures d'écran ou enregistrement d'écran, zooms et curseur animés en Remotion, voix off ElevenLabs ou voix clonée, sous-titres | 0,15 à 0,40 $ | 10 min |
| Carrousel ou planche produit statique (Instagram, LinkedIn) | Nano Banana Pro ou GPT Image via Higgsfield API, Canva MCP pour la mise en page, export | 0,07 à 0,20 $ par image, 0,50 à 1,50 $ par carrousel | 3 min |
| Planche de propositions (maquettes pour validation client) | images fixes (Nano Banana, 0,07 $ pièce), captures Remotion « frame 0 », mise en page PDF | 0,50 à 2 $ par calendrier hebdomadaire | 5 min |
| Vidéo « vie de campus » 2IAE 30 s avec étudiants réels | tournage téléphone, montage FFmpeg + Remotion, sous-titres, musique Epidemic ; aucune génération (enfants et mineurs possibles, visages réels) | 0,10 à 0,30 $ | 10 min |
| Avatar présentateur 60 s (admissions, nouveau livre) | script Claude, HeyGen Avatar IV (3 $/min) ou Hedra Character-3 (3 $/min 720p), label IA | 3 à 4 $ | 5 à 10 min |
| Vidéo LinkedIn B2B 90 s Markel-Tech (données, étude de cas) | Remotion (graphiques animés, chiffres, logos), voix clonée de José, sous-titres | 0,20 à 0,50 $ | 10 min |

Ordre de grandeur mensuel pour un client « beauté » à 12 Reels générés, 8 carrousels et 4 UGC synthétiques : 60 à 80 $ de génération, 20 à 30 $ de planches et prises écartées, soit moins de 110 $ de coûts variables, à comparer aux 99 à 129 $/mois de l'Unlimited Higgsfield qui ne produit qu'une vidéo à la fois et à la main.

## 7. Incertitudes et points à vérifier

1. Prix par modèle de l'API Higgsfield : la doc ne publie pas de grille centrale, et je n'ai pas pu charger les pages modèle de la console (connexion requise). À relever dans open.higgsfield.ai avec le compte de José.
2. Conditions d'utilisation Higgsfield : les URL /terms et /terms-of-use répondent 404 ; la clause « automation, scripting, credential sharing, reselling prohibited » vient de l'article officiel All Unlimited et de guides tiers. La case « I own rights » n'apparaît dans aucune source écrite.
3. Prix Unlimited : trois grilles coexistent dans les sources (Plus 47/49/59 $, Ultra 99/129 $) selon l'annuel, le mensuel et la date ; la page de prix bouge souvent.
4. Cinema Studio 4.0 : le changelog dit 30 s, la page produit dit 4K et jusqu'à une minute. Non recoupé.
5. Seedance 2.0 : durée max 15 s sur fal et BytePlus, « jusqu'à 30 s » sur Higgsfield (changelog du 6 août 2026). Le 30 s pourrait être une extension côté Higgsfield.
6. Gemini Omni Flash : prix calculé à partir des tokens (5 792 tokens/s à 17,50 $/M) par des sources tierces ; la page de prix Gemini chargée le 1er octobre 2026 n'a pas renvoyé de ligne Omni. À confirmer sur ai.google.dev.
7. Veo 3.1 : la doc dit « allow_all » en text-to-video et « allow_adult » en I2V ; un fil du forum (2026) rapporte des rejets de « allow_adult » pourtant documenté. Comportement à tester avec un compte et une région (Canada) donnés.
8. MiniMax H3 / H3 Max : tarification à la seconde non relevée sur la page officielle (seules les lignes « legacy » Hailuo 2.3 étaient lisibles).
9. HeyGen : la page de prix API redirige vers l'application (non chargée) ; les chiffres viennent de G2 et de guides datés 2026.
10. Remotion : licence gratuite « jusqu'à 3 personnes » ; vérifier si l'effectif de Markel-Tech (employés et contractuels) reste sous ce seuil et si une plateforme vendue à des clients est considérée comme usage interne.
11. ElevenLabs v4 à 0,022 $ : prix promotionnel « jusqu'au 12 octobre 2026 » ; prix normal probablement 0,08 $.
12. Suno : absence d'API publique confirmée par plusieurs sources, mais le programme « entreprise sur invitation » n'est pas documenté ; les « API Suno » vendues en ligne sont non officielles.
13. Epidemic Sound API : prix non publics (« Scale » au volume, Enterprise sur devis).
14. Effets des labels IA sur la portée : affirmations des plateformes contre témoignages de créateurs ; une seule étude évaluée par les pairs (mars 2026). Mesurer sur les comptes de José.
15. Filtres religieux : aucune documentation ne les cite ; absence de preuve, pas preuve d'absence. Tester des prompts « culte », « prière », « baptême », « croix » sur Veo, Kling, Seedance avant de promettre quoi que ce soit aux églises.
16. Editframe : aucune donnée 2026 trouvée ; peut-être arrêté ou renommé.
17. Luma Ray 3 : seules des pages sur Ray 3.2 et un reframe ont été trouvées ; durée et prix T2V restent indicatifs.

## 8. Implications pour la machine de José (recommandations)

1. Ne pas bâtir la plateforme sur le pilotage navigateur de l'Unlimited : contraire aux conditions de Higgsfield, une génération à la fois en file standard, cassé à chaque changement d'interface, et un bannissement couperait tous les clients d'un coup. Garder l'Unlimited comme atelier manuel de José (clips musicaux SEVARTA, essais), hors du chemin critique.
2. Mettre une couche « fournisseur de génération » abstraite (soumettre, interroger, récupérer, webhooks) avec trois adaptateurs : Gemini (Veo 3.1 Fast et Lite, Omni Flash, Nano Banana, Lyria 3, TTS), fal (Seedance, Kling, Wan, LTX-2.3, Sync lipsync, Stable Audio) et Higgsfield API (Soul ID, Popcorn, Cinema Studio). Ces API sont toutes asynchrones et semblables ; l'abstraction coûte peu et protège contre les disparitions : Sora 2 retirée en six mois, Hailuo 2.3 dépréciée, MiniMax Music fermée aux nouveaux clients le 20 août 2026. Ajouter un test hebdomadaire automatique par fournisseur.
3. Modèles par défaut : Veo 3.1 Fast (0,10 $/s, audio, 9:16) pour les Reels produits ; Kling 3.0 (0,112 $/s 720p audio, 15 s) pour les scènes avec personnages ; LTX-2.3 (0,06 $/s) pour les brouillons ; Seedance 2.5 pour les clips premium. Prévoir un mode brouillon (Lite, 480p, 1 prise) pour les planches envoyées au client et un mode production (3 prises, 1080p) après validation : c'est le flux « est-ce que ça vous convient, madame ? », et il divise par 5 à 10 le coût de ce qui n'est pas validé.
4. Faire de Remotion le cœur de la fabrication. La plupart des formats qui manquent aux clients (produits non mis en avant, sermons non découpés, tutoriels, chiffres, calendriers) sont de la vidéo programmée : texte, captures, sous-titres mot à mot, chiffres animés, logo. Remotion parle React et TypeScript comme le dépôt, se rend pour 0,02 $ la minute sur Lambda ou un conteneur Railway, et chaque client devient un design system de composants. Les clips IA ne sont que des plans insérés dans une composition.
5. Construire la chaîne « sermon vers clips » en interne : transcription (Scribe 0,22 $/h ou WhisperX), sélection des moments par Claude (promesse, tension, verset, chute), découpe FFmpeg, recadrage 9:16 par détection de visage, sous-titres ASS, habillage Remotion. Moins de 2 $ par sermon, aucune génération IA, donc ni label ni deepfake : la voix et le visage du pasteur restent réels.
6. Pour les églises et SEVARTA, pas de lipsync ni d'avatar du pasteur ou de l'auteur sans consentement écrit et sans label : c'est un deepfake au sens de l'AI Act et des règles TikTok. Les avatars synthétiques neutres (présentateur d'admissions 2IAE, hôtesse SEVARTA) sont acceptables, étiquetés.
7. Signalement par défaut : chaque actif porte un champ « génération IA photoréaliste ou vocale » (oui/non) calculé depuis la chaîne de production ; la publication coche le label natif de TikTok, Meta et YouTube quand c'est oui ; motion design, captures et vidéos réelles ne sont pas étiquetés. Conserver les métadonnées C2PA. Ajouter l'icône du Code of Practice pour les clients qui diffusent vers l'UE.
8. Mesurer l'effet du label sur chaque compte (portée et engagement sur 90 jours, étiqueté contre non étiqueté) dans la revue mensuelle : les données publiques se contredisent, celles de José trancheront.
9. Privilégier le natif pour les ventes : la planche hebdomadaire de la cliente beauté mélange produit réel animé en I2V, UGC synthétique ou réel, et carrousels. Les clips cinématiques servent aux teasers (événement culturel, nouveau livre, rentrée 2IAE) et aux clips musicaux.
10. Fixer la structure dans les templates : crochet sous 2 s (texte plus mouvement), 15 à 30 s sur TikTok, 45 à 60 s sur Reels, 90 à 180 s sur Facebook et LinkedIn, texte lisible sans son, une promesse, un appel à l'action.
11. Une voix par client (clonage ElevenLabs de la fondatrice, du pasteur avec accord, ou de José) plutôt qu'une voix de catalogue : seule façon d'obtenir un accent ouest-africain crédible. Stocker les voix comme actifs du client, jamais partagés.
12. Musique à trois niveaux : bibliothèque native (TikTok, Reels) pour l'organique ; ElevenLabs Music ou Lyria 3 Pro (0,08 à 0,15 $) pour les vidéos hors plateforme et les planches ; Epidemic Sound (API, sous-licence) pour les églises sur YouTube et la publicité. Ne pas automatiser Suno.
13. Budget : provisionner 3 à 8 $ par vidéo générée et 0,05 à 0,50 $ par vidéo programmée ; un client à 12 Reels, 8 carrousels et 4 UGC par mois coûte moins de 110 $ de génération. Suivre le coût par actif, par client et par modèle dans la base.
14. Kits de référence par client pour la cohérence : 3 images de référence Veo, jusqu'à 50 références Seedance via Higgsfield, Soul ID pour un personnage récurrent, images produit détourées, stockés dans le bucket du client et injectés automatiquement.
15. Prévoir les files et les délais : Veo peut prendre 6 minutes en pointe ; lancer les lots de nuit heure d'Abidjan avec webhooks ; copier les sorties dans le bucket (Veo supprime après 2 jours, Higgsfield après 7).
16. Tester les filtres de contenu par verticale avant de signer : culte, enfants, cosmétiques sur peau, foules. Documenter le modèle qui passe et basculer automatiquement vers le suivant en cas de refus.
17. Garder la main humaine là où l'émotion porte le message : témoignages, sermons, visages d'étudiants, fondatrice qui présente son produit. La machine prépare, découpe, sous-titre, habille et planifie ; elle ne remplace pas ces visages, ce qui protège aussi des pénalités « profil IA » et « usine à contenu ».

## 9. Sources consultées (liste)

- https://higgsfield.ai/creator-hub/help-center/getting-started/official-higgsfield-platforms
- https://higgsfield.ai/creator-hub/changelog
- https://docs.higgsfield.ai/docs
- https://docs.higgsfield.ai/docs/llms.txt
- https://higgsfield.ai/mcp
- https://higgsfield.ai/blog/higgsfield-all-unlimited-explained
- https://higgsfield.ai/blog/annual-unlimited-ai-video-plans
- https://higgsfield.ai/blog/how-to-keep-ai-persona-consistent-higgsfield-popcorn
- https://higgsfield.ai/creator-hub/help-center/ai-models/which-ai-model-should-i-use
- https://higgsfield.ai/blog/ai-avatars-vs-ugc-creators-2026
- https://github.com/api-evangelist/higgsfield
- https://sloptv.co/guides/higgsfield-pricing
- https://www.krea.ai/blog/higgsfield-pricing-explained-2026-unlimited-credits-and-real-monthly-costs
- https://apiframe.ai/guides/higgsfield-api-guide
- https://gist.github.com/AKCodez/0d3f9874d0e147bd75a097ca0cc1dcc3
- https://support.claude.com/en/articles/12902428-use-claude-in-chrome-safely
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/veo
- https://ai.google.dev/gemini-api/docs/video
- https://discuss.ai.google.dev/t/veo-3-1-image-to-video-blocks-wholesome-commercial-storyboard-child-safety-false-positive/131917
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/responsible-ai-and-usage-guidelines
- https://www.atlascloud.ai/models/gemini-omni
- https://aireiter.com/blog/gemini-omni-flash-pricing-api-guide
- https://developers.openai.com/api/docs/deprecations
- https://unifically.com/blogs/sora-api
- https://fal.ai/models/bytedance/seedance-2.0/image-to-video
- https://fal.ai/ltx-2.3
- https://techjacksolutions.com/ai-tools/bytedance-seed/bytedance-seed-pricing/
- https://www.hedra.com/blog/video-model-api-cost-comparison
- https://www.teamday.ai/blog/best-ai-video-models-2026
- https://kling.ai/dev/pricing
- https://www.cloudzero.com/blog/kling-ai-pricing/
- https://modelslab.com/blog/api/veo-3-1-vs-kling-3-sora-2-ai-video-api-cost-2026
- https://runway.com/pricing
- https://www.eesel.ai/blog/runway-ai-pricing
- https://docs.agents.lumalabs.ai/guides/pricing/
- https://www.atlascloud.ai/models/luma-ray-3.2
- https://platform.minimax.io/docs/guides/pricing-paygo
- https://evolink.ai/blog/wan-api-pricing-guide
- https://www.atlascloud.ai/blog/tips/wan-2-6-api-guide
- https://www.globenewswire.com/news-release/2026/01/06/3213304/0/en/Lightricks-Open-Sources-LTX-2-the-First-Production-Ready-Audio-and-Video-Generation-Model-With-Truly-Open-Weights.html
- https://dev.pika.art/pricing
- https://muapi.ai/comparison/vidu-q2-text-to-image
- https://www.g2.com/articles/heygen-api-pricing
- https://realtimeavatar.ai/blog/heygen-api-pricing-explained
- https://sync.so/pricing
- https://sync.so/docs/models/lipsync
- https://www.byteplus.com/en/product/OmniHuman
- https://www.hedra.com/models/video/bytedance/omnihuman-15
- https://www.usagepricing.com/blueprint/hedra
- https://elevenlabs.io/pricing/api
- https://developer.puter.com/tutorials/elevenlabs-api-pricing/
- https://community.openai.com/t/understanding-gpt-4o-mini-tts-pricing-input-characters-cost/1151816
- https://www.layer3labs.io/guides/openai-realtime-api-pricing
- https://cloud.google.com/text-to-speech/pricing
- https://musicapi.ai/blog/best-ai-music-api-2026
- https://sonilo.com/blog/comparisons/pay-as-you-go-ai-music-api-commercial-use-rights
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/lyria-music-generation
- https://cellcog.ai/blog/lyria-3-5/
- https://github.com/api-evangelist/stability-audio
- https://www.musicbusinessworldwide.com/udio-strikes-ai-licensing-deal-with-merlin-after-umg-and-warner-music-settlements/
- https://www.epidemicsound.com/blog/epidemic-sound-api/
- https://developers.epidemicsound.com/
- https://www.remotion.pro/license
- https://www.remotion.dev/docs/lambda/cost-example
- https://json2video.com/how-to/shotstack-alternative/
- https://json2video.com/how-to/creatomate-alternative/
- https://samautomation.work/blog/best-video-apis-developers-2026/
- https://www.capterra.com/p/10026817/Plainly/
- https://www.plainlyvideos.com/blog/nexrender-review
- https://github.com/hqman/karaoke-caption
- https://github.com/nikhil-reddy05/auto-captions
- https://whipscribe.com/tools/whisperx
- https://overlap.ai/blogs/best-ai-video-clipping-tools-2026
- https://quso.ai/blog/best-sermon-clip-generators
- https://techsy.io/en/blog/opusclip-vs-vizard
- https://www.socialinsider.io/social-media-benchmarks/social-media-video-statistics
- https://www.socialinsider.io/blog/how-long-are-tiktok-videos/
- https://awisee.com/blog/tiktok-video-length/
- https://reap.video/blog/best-video-length-youtube-shorts-reels-tiktok
- https://kompozy.io/guides/ai-ugc-ads
- https://tok-vibes.com/blog/ugc-vs-ai-avatar-ads
- https://storrito.com/resources/tiktoks-2026-ai-labeling-rules-and-what-they-signal-for-platform-governance/
- https://kompozy.io/guides/tiktok-ai-labeling-at-scale
- https://techcrunch.com/2026/08/31/instagram-puts-new-limits-on-undisclosed-ai-profiles/
- https://lookfamed.de/en/news/ai-labeling-on-instagram/
- https://link.springer.com/article/10.1007/s12525-026-00883-2
- https://9to5google.com/2026/05/27/youtube-updating-ai-content-labels/
- https://www.digitalapplied.com/blog/ai-content-labeling-rules-advertisers-2026-reference
- https://www.sammapix.com/blog/what-are-content-credentials-c2pa
- https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content
- https://blog.peterkapartners.com/article-50-of-the-ai-act-in-practice-transparency-of-ai-systems-content-labeling-and-deepfakes/
