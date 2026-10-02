# R03. Génération d'images et de visuels de marque par API (état au 1er octobre 2026)

Rapport de recherche pour la « machine social media » multi-clients de José Kouadio (Markel-Tech, SEVARTA, 2IAE). Toutes les valeurs sont datées. Quand une donnée n'a pas pu être vérifiée sur une source primaire, elle est signalée comme telle dans la section « Incertitudes ».

Convention : les prix sont en dollars américains, hors taxes, tels qu'affichés par l'éditeur ou l'agrégateur à la date indiquée.

## 1. Résumé exécutif

Le marché a basculé en 2026. Trois faits structurent tout le reste :

1. **Le texte dans l'image n'est plus un problème réservé à Ideogram.** Sur le banc d'essai indépendant img.ly (septembre 2026), neuf modèles atteignent 5,0/5 en « text accuracy » : GPT Image 2 et 2.5, Nano Banana 2 et Pro, FLUX.2 [pro], Recraft V4.1, Seedream 5.0 Pro (4,9). Ideogram 3.0, longtemps la référence, est classé 20e sur 23 en texte. La question n'est plus « quel moteur sait écrire », mais « quel moteur écrit bien en français, vite, pas cher, et avec un fond transparent ».
2. **Les prix se sont effondrés et se sont alignés sur la résolution.** GPT Image 2.5 (8 septembre 2026) coûte 0,006 à 0,053 dollar l'image carrée 1024 selon la qualité (tarif fal.ai, octobre 2026), contre 0,133 pour GPT Image 1.5 en haute qualité. Nano Banana 2 est à 0,067 (1K) et Nano Banana Pro à 0,134 (1K/2K) et 0,24 (4K), moitié prix en mode Batch. FLUX.2 [pro] est à 0,03 le premier mégapixel. Recraft V4.1 à 0,035. Seedream 5.0 Pro à 0,0675 (jusqu'à 1536 px). Une image de qualité production coûte donc entre 3 et 15 cents, et un visuel « brouillon pour planche de proposition » coûte moins d'un cent.
3. **Pour un visuel de marque avec texte garanti exact (affiche, citation, carrousel, miniature), la génération pure n'est pas la bonne réponse.** La bonne architecture est hybride : un moteur génératif produit le fond et les éléments (produit, scène, personnage), puis une couche de composition programmatique (HTML vers PNG avec Satori ou Playwright, ou Canva Connect Autofill, désormais ouvert aux plans Pro et Teams depuis le 21 septembre 2026) pose le texte, le logo et les couleurs de marque avec une exactitude de 100 %. Le texte généré par l'IA sert aux cas où il fait partie de la scène (enseigne, étiquette, packaging), pas aux titres.

Le reste du rapport détaille chaque moteur, les techniques de cohérence de marque, les règles Meta de 2026 (avant/après beauté autorisés depuis le 22 juillet 2026 sous conditions, étiquette IA obligatoire pour le photoréaliste), et propose une grille de choix par type de visuel avec coût unitaire et contrôle qualité automatique.

## 2. Méthode et périmètre

Trente et une recherches web et une quarantaine de pages ouvertes entre le 1er octobre 2026 : documentation officielle d'OpenAI, Google (Gemini API), Black Forest Labs, Recraft, Canva Developers, fal.ai, Replicate, Photoroom, Templated, Abyssale, Placid ; benchmarks img.ly et Atlas Cloud ; analyses datées de politiques Meta (AuditSocials, Adligator) ; annonce OpenAI sur la provenance (mai 2026). Les pages d'agrégateurs de prix (aifreeapi, pricepertoken, eesel) ont servi de recoupement, jamais de source unique.

Limite : plusieurs pages officielles (prix BFL, prix Ideogram, page Topaz sur fal) ne livrent leurs prix que via des calculateurs interactifs que l'outil de lecture ne rend pas. Les valeurs correspondantes viennent alors de pages de modèle individuelles ou de sources secondaires datées, signalées dans la section 11.

## 3. Les moteurs de génération, un par un

### 3.1 OpenAI : la famille GPT Image (« ChatGPT Images »)

État de la gamme au 1er octobre 2026, d'après la page de prix et le guide « Image generation » d'OpenAI :

| Modèle | Statut | Sortie | Points saillants |
|---|---|---|---|
| gpt-image-2.5-sunburst | actuel, « précision d'édition » | 8 septembre 2026 | 16 images de référence, 4K (3 840 px de grand côté), qualités low, medium, high, xhigh, max |
| gpt-image-2.5-flare | actuel, « rapide » | 8 septembre 2026 | même API, latence annoncée 50 % plus basse que GPT Image 2 |
| gpt-image-2 | précédent | 21 avril 2026 | premier modèle avec « raisonnement », multilingue (latin, arabe, hindi, bengali, CJK) annoncé > 95 % |
| gpt-image-1.5 | ancien | 16 décembre 2025 | tailles 1024², 1024×1536, 1536×1024 ; canal alpha |
| gpt-image-1 et 1-mini | anciens | 2025 | le mini reste le moins cher |

Source : https://developers.openai.com/api/docs/guides/image-generation et https://developers.openai.com/api/docs/models/gpt-image-2.5-flare

**Tailles et formats (GPT Image 2 et 2.5).** Dimensions personnalisées en multiples de 16, ratio entre 1:3 et 3:1, grand côté 3 840 px maximum, 655 360 à 8 294 400 pixels au total. Sorties PNG, JPEG, WebP, avec compression réglable et fond transparent (`background: "transparent"` en PNG ou WebP). Jusqu'à 4 images par requête. Streaming d'images partielles. Source : guide ci-dessus.

**Édition.** Endpoint `v1/images/edits` avec masque PNG transparent (inpainting) et images de référence multiples (16 maximum sur 2.5, via Responses API ou l'endpoint edits). C'est aujourd'hui le point fort revendiqué de 2.5 : « change un seul élément, un produit, un fond, une ligne de texte, et le reste de l'image tient », avec une stabilité multi-tours. Source : https://fal.ai/gpt-image-2.5 et DataCamp (septembre 2026).

**Prix.** OpenAI facture en jetons : 30 dollars par million de jetons image en sortie (15 en Batch), 8 dollars par million en entrée image, 5 dollars par million en texte. La doc précise que le calculateur de GPT Image 2 « n'estime pas la consommation de GPT Image 2.5 ». Prix par image publiés par fal.ai pour GPT Image 2.5 (identiques Flare et Sunburst, octobre 2026) :

| Résolution | low | medium | high |
|---|---|---|---|
| 1024×1024 | 0,0060 $ | 0,0133 $ | 0,0528 $ |
| 1024×768 | 0,0041 $ | 0,0091 $ | 0,0362 $ |
| 1920×1080 | 0,0045 $ | 0,0096 $ | 0,0395 $ |
| 3840×2160 (4K) | 0,0112 $ | 0,0260 $ | 0,1002 $ |

Les qualités xhigh et max consomment davantage (non chiffré). L'édition ajoute environ 0,008 $ par référence 1024². Pour mémoire, GPT Image 1.5 en 1024² : 0,009 / 0,034 / 0,133 $ (low / medium / high) et 0,013 / 0,05 / 0,20 $ en portrait ou paysage ; GPT Image 1 mini : 0,005 / 0,011 / 0,036 $. Sources : https://fal.ai/gpt-image-2.5 ; https://www.aifreeapi.com/en/posts/openai-image-generation-api-pricing (vérifié le 6 septembre 2026) ; https://developers.openai.com/api/docs/pricing

**Latence.** Le guide OpenAI prévient que « les prompts complexes peuvent prendre jusqu'à 2 minutes ». Mesures img.ly (p50, septembre 2026) : GPT Image 2 110,1 s, GPT Image 2.5 Flare 21,3 s. Source : https://img.ly/ai-benchmarks/models/gpt-image-2/ et https://img.ly/ai-benchmarks/models/gpt-image-2-5-flare/

**Qualité du texte, y compris français.** img.ly donne 5,0/5 en exactitude du texte à GPT Image 2 et 2.5 Flare, 4,8 à 4,9 en adhérence au prompt. Atlas Cloud (12 juin 2026) mesure 98,5 % de précision typographique pour GPT Image 2 contre 91,2 % pour Nano Banana 2 et 94,8 % pour Nano Banana Pro. Aucun benchmark public ne mesure spécifiquement le français avec accents et cédilles ; OpenAI annonce un rendu multilingue sur alphabets non latins, ce qui est un bon indicateur pour les diacritiques, mais il faut le tester (voir section 10). Sources : https://www.atlascloud.ai/blog/tips/2026-ai-image-api-benchmark-gpt-image-2-vs-nano-banana-2-pro-vs-seedream-5-0 ; https://x.com/OpenAIDevs/status/2046671238534496259

**Transparence.** Attention : img.ly note que GPT Image 2 « a perdu le canal alpha de son prédécesseur » (0,00 contre 4,22 pour 1.5) ; GPT Image 2.5 le réintroduit officiellement (« vrais canaux alpha PNG/WebP ») mais obtient encore 2,7/5 en « Transparency & Cutouts ». Pour du détourage, passer par Photoroom ou Bria (section 6.5).

**Politique de contenu et provenance.** Paramètre `moderation` : `auto` (défaut) ou `low` ; refus retournés avec `error.code = "moderation_blocked"`. Depuis le 19 mai 2026, toutes les images produites par ChatGPT, Codex et l'API portent des métadonnées C2PA et un filigrane invisible SynthID, et OpenAI prépare un outil public de vérification. Conséquence directe : Meta lit le C2PA et peut étiqueter automatiquement ces images « Made with AI ». Sources : https://openai.com/index/advancing-content-provenance/ ; https://petapixel.com/2026/05/20/openai-gets-serious-about-detecting-fake-images/

### 3.2 Google : Nano Banana 2, Nano Banana Pro, Imagen 4 (retiré)

**Gamme Gemini API (octobre 2026).**

| Modèle | Identifiant | Résolutions | Références |
|---|---|---|---|
| Nano Banana Pro | gemini-3-pro-image | 1K, 2K, 4K | jusqu'à 6 objets + 5 personnages (doc Google) ; des guides tiers citent « 14 images » |
| Nano Banana 2 | gemini-3.1-flash-image | 0,5K, 1K, 2K, 4K | jusqu'à 10 objets + 4 personnages |
| Nano Banana 2 Lite | gemini-3.1-flash-lite-image | 1K seulement | jusqu'à 14 objets |
| Nano Banana (2.5 Flash Image) | gemini-2.5-flash-image | 1K | déprécié, migration recommandée |

Source : https://ai.google.dev/gemini-api/docs/image-generation

**Prix officiels (page de prix Gemini API, lue le 1er octobre 2026).**

| Modèle | 1K | 2K | 4K | Batch |
|---|---|---|---|---|
| Nano Banana Pro | 0,134 $ | 0,134 $ | 0,24 $ | 0,067 / 0,12 $ |
| Nano Banana 2 | 0,067 $ | 0,101 $ | 0,151 $ | 0,022 à 0,076 $ |
| Nano Banana 2 Lite | 0,0336 $ | non | non | 0,0168 $ |
| 2.5 Flash Image | 0,039 $ | non | non | 0,0195 $ |

Entrée image de référence : environ 0,0011 $ par image (0,0006 $ en Batch). Grounding Google Search facturé en plus, par requête. Source : https://ai.google.dev/gemini-api/docs/pricing

**Capacités.** « Advanced text rendering » pour infographies et visuels marketing, grounding Google Search (données en temps réel, utile pour une affiche d'événement régional), mode « thinking » avec images intermédiaires non facturées, édition multi-tours, cohérence multi-images (jusqu'à 5 personnages sur Pro). Toutes les sorties portent un filigrane SynthID.

**Benchmarks.** img.ly (septembre 2026) : Nano Banana 2 score global 3,34/5, p50 13,2 s, 0,08 $ chez fal, texte 5,0, typographie 3,8, couleurs de marque 3,2 (8e). Nano Banana Pro : 3,13/5 (17e sur 23), p50 23,3 s, 0,15 $ chez fal, texte 5,0, adhérence 4,6. Le banc conclut que le Pro « sous-performe par rapport à son prix », Nano Banana 2 faisant mieux pour moitié prix. Ni l'un ni l'autre n'a de canal alpha. Sources : https://img.ly/ai-benchmarks/models/nano-banana-2/ ; https://img.ly/ai-benchmarks/models/nano-banana-pro/

**Imagen 4.** Déprécié sur Vertex AI le 24 mars 2026, arrêté sur Gemini API le 17 août 2026. Ses trois paliers (Fast 0,02 $, Standard 0,04 $, Ultra 0,06 $) n'existent plus ; Google renvoie vers gemini-3.1-flash-image. Ne pas construire dessus. Source : https://aicybr.com/blog/imagen-4-api-shutdown-migrate-gemini-image

### 3.3 Black Forest Labs : FLUX.2, FLUX.1 Kontext, FLUX 3

**FLUX.2** (25 novembre 2025) : famille unifiée génération + édition, jusqu'à 10 images de référence simultanées pour la cohérence personnage / produit / style, édition jusqu'à 4 mégapixels, typographie « fiable en production », prompts JSON structurés et codes HEX pour la couleur. Variantes : [pro], [flex] (paramètres réglables), [dev] (32 B, poids ouverts), [klein] 4B et 9B (Apache 2.0, distillés). Source : https://bfl.ai/blog/flux-2 ; https://fal.ai/models/fal-ai/flux-2-pro

Prix (par mégapixel, premier MP puis MP suivants, septembre 2026) : klein 4B 0,014 puis 0,001 $ ; klein 9B dès 0,015 $ ; [pro] 0,03 puis 0,015 $ ; [flex] dès 0,05 $ ; [max] 0,07 puis 0,03 $. Une image 1024² en [pro] coûte donc 0,03 $, une 2K environ 0,075 $. Sources : https://developer.puter.com/tutorials/flux-api-pricing/ ; https://openrouter.ai/black-forest-labs/flux.2-pro

Benchmark img.ly : FLUX.2 [pro] 3,18/5, p50 11,5 s, 0,03 $, texte 5,0, typographie 3,9, adhérence 4,5, mais couleur 2,3/5 et résolution 2,0/5. Source : https://img.ly/ai-benchmarks/models/flux-2-pro/

**FLUX.1 Kontext** (édition par instruction) : [pro] 0,04 $ et [max] 0,08 $ par image (tarif officiel repris par Replicate et fal). Reste utile pour des retouches simples, mais FLUX.2 l'englobe.

**FLUX 3 Image** (sorti aujourd'hui, 1er octobre 2026, après un accès anticipé le 23 juillet) : modèle multimodal (image, vidéo 20 s avec audio, actions robotiques) ; côté image, jusqu'à 10 références, « layout system » par éléments nommés et boîtes englobantes sur une grille 0 à 1000, 15 ratios, jusqu'à environ 16 MP. Prix à la résolution : 768² 0,041 $, 1K 0,048 $, 2K 0,10 $, 4K 0,607 $ (moitié prix jusqu'au 8 octobre 2026). Aucun benchmark indépendant encore. Sources : https://venturebeat.com/technology/black-forest-labs-launches-flux-3-capable-of-generating-images-and-20-second-video-with-audio-but-in-limited-release-to-start ; https://kingy.ai/blog/flux-3-image-specs-benchmarks-comparison/

Le système de layout de FLUX 3 (positionner un texte ou un logo dans une boîte) est exactement ce dont une affiche d'événement a besoin ; à tester dès que les premiers benchmarks sortent.

### 3.4 Ideogram 3.0

Prix officiels par image : Turbo 0,03 $, Default 0,06 $, Quality 0,09 $. Référence de personnage : 0,10 / 0,15 / 0,20 $. Upscale sur Default : 1× 0,07 $, 2× 0,19 $, 4× 0,23 $. L'API exige le plan Pro (42 à 48 $/mois). Source : https://developer.puter.com/tutorials/ideogram-api-pricing/ ; https://costbench.com/software/ai-image-generators/ideogram/ (la page de prix officielle docs.ideogram.ai a été déplacée au moment de la lecture).

Benchmark img.ly : 3,08/5, p50 17,9 s, texte 4,7, typographie 3,7, 20e sur 23 en texte, « ne remporte aucun prompt ». Son avantage historique a été absorbé par les modèles généralistes. Source : https://img.ly/ai-benchmarks/models/ideogram-v3/

### 3.5 Recraft V3, V4, V4.1

Le seul moteur qui produit du **vectoriel SVG natif** et qui propose des **styles de marque** (couleurs exactes, textures) et un verrou de style. Gamme : V4.1 (défaut, mai 2026), V4 (février 2026), V3 (moins cher), V4 Styles (transfert de style). Variantes Standard, Vector, Pro, Utility, Flash.

Prix officiels (1 000 unités = 1 $, octobre 2026) :

| Opération | Prix |
|---|---|
| V4.1 Flash | 0,007 $ |
| V4.1 / V4.1 Utility (raster) | 0,035 $ |
| V4.1 Pro | 0,21 $ |
| V4.1 Vector | 0,08 $ ; Pro Vector 0,30 $ |
| V4 Styles / Styles Pro | 0,035 / 0,10 $ |
| V3 raster / vector | 0,04 / 0,08 $ |
| Image-to-image, inpaint (V3) | 0,04 $ raster, 0,08 $ vector |
| Vectorize | 0,01 $ |
| Remove background | 0,01 $ |
| Crisp upscale / Creative upscale | 0,004 / 0,25 $ |

Source : https://www.recraft.ai/docs/api-reference/pricing

Benchmark img.ly : V4.1 est 3e sur 23 (3,65/5), p50 10,7 s, 0,035 $, texte 5,0, typographie 4,0, mais transparence 2,0/5 (47 % de pixels semi-transparents). Source : https://img.ly/ai-benchmarks/models/recraft-v4-1/

### 3.6 Midjourney

Toujours **aucune API officielle** au 1er octobre 2026 ; les CGU interdisent l'automatisation, et les « API Midjourney » (APIFrame, PiAPI, ImaginePro) sont des robots qui pilotent un compte, avec risque de bannissement. Abonnement web ou Discord à partir de 10 $/mois. À exclure d'une plateforme automatisée. Sources : https://www.wireflow.ai/blog/best-midjourney-api-tools-in-2026 ; https://unifically.com/blogs/midjourney-api

### 3.7 ByteDance Seedream 4.5 et 5.0

**Seedream 4.5** : 0,04 $ par image sur fal, jusqu'à 4 MP (2048²), 1 à 6 images par appel, génération et édition unifiées. Source : https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/text-to-image

**Seedream 5.0 Pro** (version du 12 août 2026 chez OpenRouter) : 0,0675 $ jusqu'à 1536², 0,135 $ jusqu'à 2048² sur fal ; référence supplémentaire 0,003 à 0,0045 $ ; jusqu'à 10 à 14 références selon la plateforme ; texte natif en 14 langues. Benchmark img.ly : **2e sur 23** (3,88/5), gagne 29 des 37 prompts, texte 4,9, composition 4,78, mais p50 65,3 s et pas de canal alpha. La version Lite offre la même résolution pour 0,035 $. Sources : https://fal.ai/models/fal-ai/bytedance/seedream ; https://img.ly/ai-benchmarks/models/seedream-5-pro/ ; https://openrouter.ai/bytedance-seed/seedream-5-0-pro

### 3.8 Qwen-Image (Alibaba)

Qwen-Image 2.0 : 0,04 $ par image chez Together, 512 à 2048², typographie « haute fidélité en anglais et chinois », édition de texte dans l'image. Qwen-Image-2512 (poids ouverts) : 0,02 $ par mégapixel. Qwen Image 3.0 (5 août 2026) : Standard 0,03 $ (1K/2K), Pro 0,04 $ (1K) et 0,075 $ (2K) sur Alibaba Cloud Singapour ; disponibilité des poids ouverts non confirmée. Le français n'est pas cité parmi les langues optimisées. Sources : https://www.together.ai/models/qwen-image-20 ; https://www.orcarouter.ai/blog/qwen-image-2-1-vs-qwen-image-3-0

### 3.9 Reve 2.1

Lancé le 9 juillet 2026. Architecture « layout-first » (structure avant rendu), 4K natif sur les endpoints v2, bon rendu du texte. Prix API : 10 $ minimum pour 7 500 crédits ; v2 Create ou Edit 150 crédits (environ 0,20 $) ; endpoints legacy Create 0,024 $, Edit Fast et Remix Fast 0,007 $. Plafond 1 000 $/jour. Source : https://www.eesel.ai/blog/reve-2-1-pricing

### 3.10 Stable Diffusion 3.5

API Stability : SD 3.5 Large 0,065 $, Large Turbo 0,04 $, Medium 0,035 $, Stable Image Ultra 0,08 $ (1 crédit = 0,01 $). Poids ouverts sous licence communautaire. Sans intérêt en 2026 pour du texte dans l'image ; intérêt résiduel pour l'auto-hébergement et les LoRA. Source : https://developer.puter.com/tutorials/stability-ai-api-pricing/

## 4. Agrégateurs : fal.ai et Replicate

| Critère | fal.ai | Replicate |
|---|---|---|
| Modèle de facturation | par image, par mégapixel, par seconde GPU selon le modèle | par seconde GPU (T4 0,000225 $/s, L40S 0,000975, A100 0,0014, H100 0,001525) ou par sortie |
| Catalogue image (exemples, octobre 2026) | Nano Banana 2 0,08 $, Nano Banana Pro 0,15 $, FLUX.1 schnell 0,003 $/MP, FLUX.2 pro 0,03 $, Seedream 4.5 0,04 $, Seedream 5 Pro 0,0675 $, GPT Image 2.5, Recraft V3, Topaz, Bria RMBG 2.0 0,018 $ | FLUX 1.1 Pro 0,04 $, FLUX Dev 0,025 $, FLUX Schnell 3 $/1 000, Ideogram V3 0,09 $, Recraft V3 0,04 $, GPT Image 2 |
| Entraînement LoRA | FLUX LoRA Fast 2 $/run ; FLUX.2 trainer 0,008 $/pas (8 $ pour 1 000 pas) ; Kontext trainer 2,50 $/1 000 pas | modèles d'entraînement tiers (ostris, etc.), facturés au temps GPU |
| GPU dédiés | H100 4,50 $/h liste (2,49 $ remisé), B300 12,99 $/h | A100 5,04 $/h, H100 5,49 $/h |

Sources : https://fal.ai/pricing ; https://replicate.com/pricing ; https://fal.ai/models/fal-ai/flux-lora-fast-training ; https://blog.fal.ai/training-flux-2-loras

Avantage pour José : un seul compte, une seule clé, un seul SDK pour OpenAI, Google, BFL, ByteDance, Recraft, Topaz et Bria, avec files d'attente, webhooks et prix souvent égaux aux tarifs officiels. Inconvénient : les surcoûts (fal facture Nano Banana Pro 0,15 $ contre 0,134 $ chez Google) et la dépendance à un intermédiaire. Replicate reste utile pour les modèles ouverts exotiques et les LoRA personnalisés.

## 5. Tableau comparatif synthétique (octobre 2026)

| Moteur | Prix 1K typique | Texte (img.ly) | p50 latence | Références | Alpha | 4K | Points forts | Points faibles |
|---|---|---|---|---|---|---|---|---|
| GPT Image 2.5 Flare | 0,006 à 0,053 $ | 5,0 | 21 s | 16 | oui (2,7/5) | oui | édition précise, multilingue, prix | thinking lent, alpha moyen |
| GPT Image 2.5 Sunburst | idem | n.d. | plus lent | 16 | oui | oui | précision d'édition | latence |
| Nano Banana 2 | 0,067 $ | 5,0 | 13 s | 10 + 4 pers. | non | oui (0,151 $) | équilibre, grounding Search | couleurs de marque 3,2 |
| Nano Banana Pro | 0,134 $ | 5,0 | 23 s | 6 + 5 pers. | non | oui (0,24 $) | infographies, 5 personnages | rapport qualité/prix |
| FLUX.2 [pro] | 0,03 $ | 5,0 | 11,5 s | 10 | n.d. | 4 MP | prix, cohérence produit, HEX | couleurs 2,3, résolution 2,0 |
| FLUX 3 Image | 0,048 $ | n.d. | n.d. | 10 | n.d. | oui (0,607 $) | layout par boîtes | sorti aujourd'hui, non testé |
| Recraft V4.1 | 0,035 $ | 5,0 | 10,7 s | styles | partiel (2,0/5) | Pro | SVG, styles de marque, 3e global | alpha sale |
| Seedream 5.0 Pro | 0,0675 $ | 4,9 | 65 s | 10 à 14 | non | 2K | 2e global, 14 langues | lent |
| Ideogram 3.0 | 0,03 à 0,09 $ | 4,7 | 17,9 s | personnage (+0,07 $) | n.d. | upscale payant | historique texte | dépassé, plan Pro requis |
| Qwen Image 3.0 | 0,03 $ | n.d. | n.d. | édition | n.d. | 2K | prix, chinois | français non documenté |
| Reve 2.1 | 0,20 $ (v2) | n.d. | n.d. | édition | n.d. | 4K | layout-first | prix v2 élevé |
| SD 3.5 Large | 0,065 $ | faible | n.d. | LoRA | non | non | poids ouverts | texte |
| Midjourney | abonnement | n.d. | n.d. | oui | non | oui | esthétique | pas d'API |

## 6. Cohérence de marque : techniques et coûts

### 6.1 Images de référence (zéro entraînement)

C'est devenu la méthode par défaut. GPT Image 2.5 accepte 16 références, FLUX.2 et FLUX 3 dix, Seedream 5.0 Pro dix à quatorze, Nano Banana 2 dix objets plus quatre personnages. Pour une marque de beauté : fournir le packshot du produit, le logo, deux photos d'ambiance et une photo de la fondatrice, puis demander une mise en scène. Coût marginal : 0,0011 $ par référence chez Google, 0,003 à 0,0045 $ chez Seedream, environ 0,008 $ chez OpenAI. Limite : le packaging est « plausible », pas « identique » ; les petits textes d'étiquette dérivent. Sources : sections 3.1, 3.2, 3.3, 3.7.

### 6.2 Références de style et styles de marque

Recraft est le seul à formaliser un « style » réutilisable par identifiant (V4 Styles 0,035 $, Styles Pro 0,10 $) avec couleurs exactes imposées. FLUX.2 accepte des codes HEX dans un prompt JSON. Nano Banana et GPT Image s'appuient sur les références. img.ly mesure la fidélité des couleurs de marque : Nano Banana 2 3,2/5, GPT Image 2 3,1/5, FLUX.2 pro 2,3/5. Conclusion : aucun moteur ne garantit un HEX exact ; les aplats de marque doivent être posés par la couche de composition (section 7).

### 6.3 Produit intact (packaging d'une marque de beauté)

Trois stratégies par ordre de fiabilité croissante :
1. **Référence + prompt « keep packaging identical »** (GPT Image 2.5 Sunburst ou FLUX.2) : 90 % des cas, 0,03 à 0,06 $.
2. **Détourage du vrai packshot puis composition** : Photoroom 0,02 $ ou Bria RMBG 2.0 0,018 $ sur fal ou Recraft 0,01 $, puis fond généré (FLUX.2 0,03 $ ou Photoroom « AI backgrounds » 0,10 $) et assemblage HTML. Le produit est pixel-exact. C'est la méthode recommandée pour la cosmétique.
3. **LoRA produit** sur FLUX.2 [dev] : 8 $ pour 1 000 pas chez fal, 15 à 30 photos du produit, puis inférence sur FLUX.2 [dev] LoRA (prix par MP). Rentable seulement si un client génère des centaines de visuels du même produit.

Sources : https://www.photoroom.com/api/pricing ; https://fal.ai/models/fal-ai/flux-2/lora ; https://www.recraft.ai/docs/api-reference/pricing

### 6.4 Personnage ou visage récurrent (pasteur, fondatrice, mascotte)

Nano Banana Pro maintient jusqu'à 5 personnages par scène ; GPT Image 2.5 annonce une « meilleure cohérence des visages » ; Ideogram facture le « character reference » 0,10 à 0,20 $. Pour une personne réelle (pasteur, auteur SEVARTA), rappel juridique et de plateforme : Meta et TikTok exigent l'étiquette IA pour tout humain photoréaliste synthétique, et TikTok interdit les deepfakes de particuliers sans consentement documenté (section 8). Recommandation : consentement écrit du client, et préférer une mascotte ou un style illustré pour les contenus récurrents.

### 6.5 Détourage

| Service | Prix | Note |
|---|---|---|
| Photoroom Remove Background API | 0,02 $/image (Basic), 0,10 $ avec fonds IA, ombres, expand (Plus) ; 1 000 essais sandbox | résolution max 6 000 px |
| Bria RMBG 2.0 | 0,08 $ chez Bria, 0,018 $ sur fal | licence commerciale propre |
| Recraft remove background | 0,01 $ | intégré au même compte |
| remove.bg | 0,178 à 0,225 $ ; site fermé au 1er décembre 2026, API migrée chez Leonardo.ai | à éviter |
| BiRefNet (open source) | 0 $ auto-hébergé | GPU à gérer |

Sources : https://www.photoroom.com/api/pricing ; https://poof.bg/blog/top-5-ai-background-removal-apis-2026

### 6.6 Upscale

| Service | Prix | Usage |
|---|---|---|
| Topaz sur fal (Precision Standard V2) | 0,08 $ par 24 MP de sortie | agrandissement propre |
| Topaz Generative (Wonder 3.5) | 0,24 $ par 24 MP ; autres modèles le double | reconstruction |
| Topaz Creative (Bloom 2) | 0,96 $ par 24 MP | artistique |
| Topaz sur Segmind | 0,375 $ par génération | forfait |
| Magnific (Freepik, rebaptisé Magnific le 28 avril 2026) | environ 0,08 $ en 2K, 0,16 $ en 4K ; abonnements 14,50 à 210 $/mois | « hallucine » des détails |
| Clarity Upscaler (open) | 0,03 $/MP sur fal | bon rapport |
| Recraft Crisp upscale | 0,004 $ | le moins cher |

Sources : https://rangy.ai/blog/best-ai-image-upscaler-2026/ ; https://www.segmind.com/models/topaz-image-upscale/pricing ; https://pikes.ai/blog/magnific-freepik-pricing-2026 ; https://www.recraft.ai/docs/api-reference/pricing

Avec GPT Image 2.5, Nano Banana et Seedream en 2K/4K natif, l'upscale devient un outil de secours (photos clients de mauvaise qualité, captures YouTube de sermons en 720p), pas une étape systématique.

### 6.7 Retouche ciblée

Masque PNG (GPT Image 2.5 edits), instruction en langage naturel (FLUX.2 édition, Kontext 0,04 $, Nano Banana 2 édition multi-tours), inpaint Recraft 0,04 $. Pour corriger un mot faux sur une étiquette, le masque + GPT Image 2.5 Sunburst est aujourd'hui le plus fiable (stabilité multi-tours annoncée).

## 7. Composition programmatique : texte garanti exact

### 7.1 Principe

Un titre, une date, un prix, un verset, un nom de produit ne doivent jamais dépendre d'un modèle de diffusion. Ils sont posés par un moteur de rendu déterministe. Deux familles : rendu HTML/CSS maison, ou API de templates.

### 7.2 HTML vers PNG : Satori et Playwright

| | Satori (+ resvg ou sharp) | Playwright / Chromium |
|---|---|---|
| Ce que c'est | bibliothèque Vercel qui convertit JSX/HTML en SVG, puis PNG | navigateur headless, capture d'écran |
| Fidélité CSS | sous-ensemble : flexbox (Yoga), dégradés, transforms, filtres, masques, variables CSS ; **pas de grid, pas de z-index, pas de calc()**, pas de WOFF2, pas de bidi complet | tout le CSS, polices web, animations figées, emoji couleur |
| Vitesse et coût | pas de navigateur, fonctionne en edge ou Node 16+ ; Vercel annonce « 160× moins cher que Chromium en serverless » | 0,5 à 2 s par capture, 200 à 400 Mo de RAM ; sur Railway, un conteneur dédié suffit |
| Polices | TTF, OTF, WOFF chargées manuellement, ligatures HarfBuzz | Google Fonts ou fichiers locaux |
| Recommandation | cartes simples, citations, carrousels texte, miniatures à gabarit fixe | affiches riches, carrousels avec superpositions, rendu « Claude Design » |

Sources : https://github.com/vercel/satori/blob/main/README.md ; https://vercel.com/blog/introducing-vercel-og-image-generation-fast-dynamic-social-card-images ; https://www.pkgpulse.com/guides/ipx-vs-vercel-og-vs-satori-dynamic-image-2026

José a déjà la pile (Node, React, Tailwind, Railway) et pratique déjà le « motion design HTML rendu en MP4 » avec Claude Design : la couche de composition est donc un composant React par gabarit, rendu par Playwright, avec les mêmes tokens de marque (couleurs, polices, logo) stockés par client. Coût marginal : nul, hors CPU.

### 7.3 Canva Connect API et Canva MCP

Changements décisifs de septembre 2026 (changelog officiel) :
- **21 septembre 2026** : les API Autofill sont ouvertes aux apps agissant pour des utilisateurs **Canva Pro ou Teams**, plus seulement Enterprise.
- **23 septembre 2026** : champs « chart » et autofill vidéo en disponibilité générale.
- **18 septembre 2026** : export MP4 avec `quality` en pixels cibles, sans bandes noires.
- **29 septembre 2026** : « Design generation job v2 » (preview) : générer document, présentation ou tableau blanc depuis un brief texte, avec images ou brand templates.

Export : JPG, PNG (lossless, transparent sur Pro), GIF, MP4 (480p à 4K), PDF, PPTX, CSV, HTML ; dimensions 40 à 25 000 px ; limites 750 exports par 5 min par app, 5 000 par 24 h, 500 par utilisateur par 24 h. Plan Free : pas de PNG transparent, pas de « pro quality », agrandissement limité à 1,125×. Sources : https://www.canva.dev/docs/connect/changelog/ ; https://www.canva.dev/docs/connect/api-reference/exports/create-design-export-job/

Canva MCP (mcp.canva.com/mcp) : outils `generate-design`, `create-design-from-brand-template`, `autofill-design` (60 req/min), `list-brand-kits`, `search-brand-templates`, `resize-design`, `export-design`, `remove-background`, `separate-image-layers`, `generate-image`. Autofill, Brand Templates et Resize exigent **Pro ou supérieur** ; export, assets et édition sont sur tous les plans. Source : https://www.canva.dev/docs/apps/mcp/tools/

Lecture pratique : avec un seul compte Canva Teams, la machine peut maintenir un Brand Kit et 10 à 20 brand templates par client (post carré, story, affiche, miniature, carrousel), les remplir par Autofill (texte, image générée, graphique), les redimensionner et les exporter en PNG ou MP4. Et le même MCP est déjà connecté à Claude Cowork chez José. Le coût est l'abonnement Canva, pas le volume.

### 7.4 API de templates spécialisées

| Service | Prix (octobre 2026) | Coût unitaire image | Spécificités |
|---|---|---|---|
| Bannerbear | Automate 49 $/1 000 crédits ; Scale 149 $/10 000 ; Enterprise 299 $/50 000 ; essai 30 crédits | 0,049 à 0,006 $ | vidéo et PDF plus chers, import PSD |
| Placid | Basic 19 $/500 crédits ; Pro 2 500 ; Business 25 000 ; VIP 100 000 | environ 0,038 $ en Basic | vidéo 10 crédits par 10 s, PDF 2 crédits/page, MCP, n8n, Make, report jusqu'à 2× |
| Templated.io | Starter 29 $/1 000 ; Scale 79 $/5 000 ; Enterprise 179 $/25 000 ; essai 50 crédits | 0,029 à 0,007 $ | API sur tous les plans, générateur de templates IA, vidéo au calcul (1080p 30 fps 10 s ≈ 13 crédits), 15 templates max en Starter |
| Abyssale | Pro 36 $/siège/mois (450 générations + 900 crédits IA) ; Suite 60 $ (750 ; HTML5, CMYK, workflow d'approbation) ; crédits extra 0,01 $ | 0,08 $ en Pro | MCP officiel, « ad-network compliance checks », approbation intégrée |

Sources : https://sudomock.com/blog/bannerbear-api-pricing-2026 ; https://placid.app/pricing ; https://templated.io/pricing ; https://www.abyssale.com/pricing

Ces services apportent un éditeur visuel que les clients peuvent toucher. Pour José, qui a déjà Canva et une pile React, ils sont redondants, sauf Abyssale si le workflow d'approbation client clé en main et les contrôles de conformité publicitaire sont jugés prioritaires.

### 7.5 Carrousels

Un carrousel Instagram ou LinkedIn (3 à 10 pages 1080×1350) est le format le plus rentable en portée organique et le plus simple à industrialiser : c'est une liste de slides HTML. Pattern éprouvé par le projet open source « open-carrusel » (Claude Code génère des slides HTML/CSS, capture PNG aux dimensions exactes). Pipeline : plan du carrousel en JSON (hook, 5 à 7 points, CTA) produit par Claude, gabarit React par client, rendu Playwright, image de couverture optionnelle générée (GPT Image 2.5 ou FLUX.2), export PDF pour LinkedIn. Coût : 0 à 0,05 $ par carrousel. Source : https://github.com/Hainrixz/open-carrusel

## 8. Règles de plateformes à coder dans la machine

### 8.1 Meta, beauté et santé (mise à jour du 22 juillet 2026)

Meta a réécrit sa politique « Health and Wellness ». L'examen est passé de la catégorie de produit à l'allégation. Ce qui change :
- **Avant/après** : plus d'auto-rejet pour cosmétiques et procédures, autorisé pour un public **18+** si le texte n'inclut « ni résultat garanti, ni délai, ni message qui fait sentir le spectateur inadéquat ». Les analyses de juin 2026 maintiennent une interdiction pour les produits amaigrissants et les traitements anti-âge ; le maquillage et les extensions sont largement exemptés. Les sources tierces divergent sur le périmètre exact : vérifier sur les Advertising Standards de Meta avant chaque campagne beauté.
- **Toujours interdit** : « pinched-fat imagery », mise en avant d'un défaut à corriger, idéal unique d'apparence, allégations sensationnelles, produits éclaircissants pour la peau (interdiction au niveau du produit), promesses chiffrées (« moins 10 kg en 3 semaines »).
- **Suppléments** : plus de ciblage 18+ par défaut, sauf allégation de perte de poids ; accès aux placements catalogue.

Sources : https://adligator.com/blog/meta-health-wellness-ad-policy-update-2026 ; https://www.auditsocials.com/blog/meta-beauty-cosmetics-ads-2026-before-after-photos-appearance-claims-policy ; règle officielle : https://transparency.meta.com/policies/ad-standards/

Rappel important pour une cliente beauté en Côte d'Ivoire ou au Canada : les allégations « soigne », « répare la peau », « traite l'acné » sont des allégations de type médicament, à bannir du générateur de légendes.

### 8.2 Étiquetage du contenu IA

| Plateforme | Obligation | Mécanisme | Sanction |
|---|---|---|---|
| Meta (FB, IG, Threads) | contenu **photoréaliste** généré ou altéré (images, vidéo, audio) ; publicités créées ou modifiées par IA | bascule « AI info » à la publication ou mention dans la légende ; détection automatique via C2PA et IPTC (OpenAI, Google, Adobe, Midjourney signent leurs fichiers) ; case à cocher dans Ads Manager | étiquette « Made with AI » forcée, baisse de distribution (10 à 20 % auto-déclaré, 30 à 50 % détecté non déclaré selon aiofm.info), rejet d'annonce, pénalités en cas de récidive |
| TikTok | tout contenu réaliste IA, voix clonées | curseur « AI-generated » à la création, détection à l'upload | 1re violation : étiquette rétroactive + 48 h de distribution réduite ; 3e : 7 jours de suspension |
| YouTube | représentations synthétiques de personnes réelles, voix clonées | divulgation dans YouTube Studio (« Altered or synthetic content ») | démonétisation, suspension du programme partenaire |
| UE (AI Act art. 50) | marquage lisible par machine de tout contenu synthétique | C2PA | jusqu'à 15 M€ ou 3 % du CA mondial |

Les contenus **stylisés** (illustration, animation, motion design) ne sont pas soumis à l'étiquette Meta. Les sorties OpenAI (depuis le 19 mai 2026) et Google (SynthID) sont marquées à la source ; la machine doit donc partir du principe que Meta « sait », et déclarer elle-même. Sources : https://www.auditsocials.com/blog/cross-platform-ai-content-labeling-requirements-2026-meta-google-tiktok-youtube-comparison ; https://aiofm.info/en/guides/instagram-ai-rules ; https://openai.com/index/advancing-content-provenance/

## 9. Grille de choix : quel moteur pour quel visuel

Coûts unitaires au tarif liste d'octobre 2026, pour une pièce finale (hors brouillons et rejets). « QC » désigne le contrôle qualité automatique de la section 10.

| Type de visuel | Chaîne recommandée | Coût unitaire | QC spécifique |
|---|---|---|---|
| **Photo produit** (beauté, livre SEVARTA) | packshot client détouré (Photoroom 0,02 $) + fond FLUX.2 [pro] 0,03 $ ou GPT Image 2.5 high 0,053 $ avec 3 références ; composition HTML ; variante : GPT Image 2.5 Sunburst edit avec packshot en référence | 0,05 à 0,10 $ | comparaison du packaging par Claude vision avec le packshot original (logo, nom, couleur) ; vérification que le texte d'étiquette est lisible et identique |
| **Affiche d'événement** (association culturelle, 2IAE journée portes ouvertes) | scène illustrée Nano Banana 2 1K 0,067 $ (grounding Search pour le lieu) ou FLUX.2 0,03 $ ; **tout le texte** (titre, date, lieu, prix) posé en HTML ou par Canva Autofill ; alternative à tester : FLUX 3 layout 0,048 $ | 0,03 à 0,07 $ | OCR par Claude vision du PNG final comparé au JSON de l'événement ; détection de texte parasite généré dans la scène |
| **Citation de sermon** (église) | capture YouTube du pasteur (image réelle, pas de synthèse de visage) ou fond abstrait FLUX.2 klein 0,014 $ ; verset et citation en HTML ; variante vidéo : extrait YouTube + sous-titres | 0,00 à 0,02 $ | exactitude du verset vérifiée contre une Bible de référence (texte, pas image) ; aucun visage synthétique |
| **Carrousel éducatif** (2IAE, Markel-Tech LinkedIn) | plan JSON par Claude, slides React, rendu Playwright, cover optionnelle GPT Image 2.5 medium 0,013 $ | 0,00 à 0,03 $ | lisibilité (contraste, taille de police ≥ 40 px sur 1080), nombre de mots par slide, cohérence des couleurs de marque par pixel sampling |
| **Miniature YouTube** (sermons, 2IAE) | portrait réel détouré (Photoroom 0,02 $) + fond Nano Banana 2 0,067 $ (ou Gemini déjà en place) + titre de 3 à 5 mots en HTML ; skill youtube-thumbnail existant | 0,07 à 0,10 $ | test de lisibilité à 168×94 px (taille réelle sur mobile) par Claude vision ; visage non déformé |
| **Story / Reel cover (9:16)** | GPT Image 2.5 Flare 1024×1536 medium (≈0,02 $) ou Nano Banana 2 ; texte HTML ; export aussi en MP4 via Canva | 0,02 à 0,05 $ | zones sûres (haut 250 px, bas 340 px) sans texte ; ratio vérifié |
| **Visuel « tendance » / mème réactif** | Nano Banana 2 Lite 0,0336 $ ou GPT Image 2.5 low 0,006 $ ; texte HTML | < 0,04 $ | revue humaine obligatoire (ton), étiquette IA si photoréaliste |
| **Planche de propositions** (3 à 6 maquettes pour validation client) | GPT Image 2.5 low 0,006 $ ou Nano Banana 2 Lite 0,0336 $ par maquette, composition HTML, PDF Playwright | 0,03 à 0,20 $ la planche | aucun QC lourd ; mention « maquette » visible |
| **Logo, icône, pictogramme vectoriel** | Recraft V4.1 Vector 0,08 $ | 0,08 $ | validation humaine, dépôt éventuel |
| **Infographie chiffrée** (statistiques d'école, bilan annuel) | données réelles en JSON, graphiques en HTML (Recharts) rendus Playwright ; jamais de chiffres générés par un modèle d'image | 0,00 $ | vérification chiffre à chiffre contre la source |

Ordre de grandeur mensuel : un client à 20 publications par mois avec 3 brouillons par publication et 1 visuel final consomme environ 60 brouillons (0,006 à 0,034 $) et 20 finaux (0,03 à 0,10 $), soit **1,5 à 4 dollars par client et par mois** en génération d'images, détourage et upscale compris. Le coût réel est ailleurs : abonnement Canva, jetons Claude pour l'idéation et le QC, temps humain de validation.

## 10. Contrôle qualité automatique

Trois couches, toutes exécutables dans le pipeline avant la planche client.

**Couche 1, déterministe (0 $).** Dimensions et ratio exacts par plateforme, poids du fichier, présence du logo (hash perceptuel du calque logo), couleurs de marque mesurées par échantillonnage des pixels des aplats, zones sûres, contraste WCAG du texte posé en HTML, métadonnées C2PA conservées ou retirées selon la politique du client.

**Couche 2, vision par LLM (environ 0,005 à 0,02 $ par image avec un modèle Claude ou GPT à vision, selon la taille).** Prompt structuré retournant un JSON : texte détecté dans l'image (OCR) à comparer au texte attendu, présence de texte parasite ou de pseudo-lettres dans la scène, mains et doigts (nombre, position), visages (déformation, yeux), logos déformés ou inventés, objets impossibles, packaging différent de la référence, éléments contraires aux règles Meta (avant/après non autorisé, gros plan corporel « inadéquat », allégation médicale lisible). La recherche (ArtifactLens, février 2026) montre que des VLM atteignent une détection fiable des artefacts (« deformed hand », « distorted face ») avec quelques centaines d'exemples étiquetés par type, et que les mains, les bords et le texte sont statistiquement les zones les plus fautives. Source : https://arxiv.org/html/2602.09475

**Couche 3, boucle de correction.** Si la couche 2 signale un défaut localisé, relancer une édition masquée (GPT Image 2.5 Sunburst, Nano Banana 2 édition, FLUX.2) sur la zone, deux tentatives maximum, puis basculer vers un autre moteur, puis vers la file humaine. Chaque rejet est journalisé avec le moteur, le prompt et la cause : c'est la base de l'apprentissage par client (quels moteurs échouent sur quels produits).

Test spécifique au français à intégrer dès le premier jour : un jeu de 30 phrases avec accents, cédilles, apostrophes typographiques et guillemets français (« Rentrée 2026 : inscrivez-vous dès aujourd'hui ! », « Évènement gratuit, entrée libre »), générées sur chaque moteur, notées par OCR. Aucun benchmark public ne couvre ce point.

## 11. Incertitudes et points à vérifier

1. **Prix par image de GPT Image 2.5 en xhigh et max** : non publiés ; le calculateur OpenAI ne couvre pas 2.5. Mesurer la consommation de jetons sur 20 générations réelles.
2. **Écart entre sources sur GPT Image 2** : aifreeapi donne 0,211 $ en high 1024², img.ly mesure 0,155 $, Atlas Cloud 0,28 $. L'écart vient probablement des jetons de « raisonnement » et des tailles. Ne pas budgéter GPT Image 2 ; utiliser 2.5.
3. **Nombre de références de Nano Banana Pro** : la doc Google lue le 1er octobre 2026 dit 6 objets + 5 personnages ; les guides tiers disent 14. La doc officielle prime, à revérifier car Google modifie ces limites.
4. **Prix Black Forest Labs** : la page bfl.ai/pricing n'a livré que des bribes (0,048 et 0,024 $/image, probablement FLUX 3 1K liste et lancement). Les prix FLUX.2 par mégapixel viennent de Puter et OpenRouter (septembre 2026).
5. **FLUX 3 Image** : sorti le jour de ce rapport, aucun benchmark indépendant, prix de lancement valable jusqu'au 8 octobre 2026 seulement, 4K à 0,607 $ en tarif liste.
6. **Ideogram** : la page de prix officielle a été déplacée ; les prix (0,03 / 0,06 / 0,09 $) sont corroborés par Replicate (0,09 $ pour V3 Quality) et deux sources secondaires.
7. **Topaz sur fal** : les prix exacts sont sur chaque page d'endpoint ; les valeurs « par 24 MP » viennent d'une source secondaire (rangy.ai, 2026).
8. **Règle Meta avant/après anti-âge et perte de poids** : AuditSocials (25 juin 2026) la dit toujours interdite, Adligator (22 juillet 2026) dit que « le blanket ban a disparu ». La politique officielle a changé entre ces deux dates ; lire le texte des Advertising Standards avant toute campagne.
9. **Taux de baisse de portée des contenus IA non déclarés** (10 à 50 %) : chiffres d'un blog tiers, pas de Meta.
10. **Qualité du français dans l'image** : aucune mesure publique ; à produire en interne (section 10).
11. **Canva Autofill sur plan Teams** : ouvert depuis le 21 septembre 2026, en très récent ; vérifier les quotas réels et la persistance des brand templates par client dans un seul compte Teams.
12. **Qwen Image 3.0 poids ouverts** : contradictoire selon les sources ; sans importance si l'on reste en API.
13. **Latences img.ly** mesurées via fal ou API directe en septembre 2026, variables selon la charge ; GPT Image 2 à 110 s p50 est à confirmer sur 2.5 Sunburst.

## 12. Implications pour la machine de José

1. **Architecture « deux couches » obligatoire** : moteur génératif pour les scènes et les éléments, couche de composition déterministe (React + Playwright sur Railway, ou Canva Autofill) pour tout texte éditorial, logo et aplat de marque. C'est ce qui règle d'un coup les trois reproches des clients perdus : visuels « plats », produits absents, texte approximatif.
2. **Moteur par défaut : GPT Image 2.5 Flare** (clé OpenAI déjà en place) pour la génération et **Sunburst** pour l'édition masquée. Rapport qualité/prix inégalé en octobre 2026 : 0,0133 $ en medium, 0,053 $ en high, 16 références, 4K, alpha, multilingue. Prévoir le moteur de secours automatique.
3. **Moteurs de secours câblés via fal.ai** : FLUX.2 [pro] (0,03 $, rapide, cohérence produit), Nano Banana 2 (0,067 $, grounding Search pour les événements régionaux), Seedream 5.0 Pro (0,0675 $, meilleur score global, lent) ; une seule clé fal pour les trois plus Topaz, Bria et Recraft. Garder Google en direct pour Nano Banana en mode Batch (0,022 $) sur les gros lots de brouillons nocturnes.
4. **Ne pas construire sur Imagen 4 (arrêté le 17 août 2026), Ideogram 3.0 (dépassé, plan Pro requis) ni Midjourney (pas d'API, CGU).** Reve v2 est trop cher (0,20 $) pour ce qu'il apporte.
5. **Brouillons et planches de propositions en qualité basse** : GPT Image 2.5 low (0,006 $) ou Nano Banana 2 Lite (0,0336 $). La planche de 6 maquettes envoyée à la cliente beauté coûte moins de 0,10 $ ; la production finale ne démarre qu'après validation, ce qui est exactement le flux décrit par José.
6. **Beauté : produit pixel-exact, jamais synthétisé.** Packshot client détouré (Photoroom 0,02 $ ou Recraft 0,01 $), fond généré, composition. Les visuels de produit « tout IA » sont réservés à l'ambiance, et toujours vérifiés par comparaison vision avec le packshot original.
7. **Églises : zéro visage synthétique du pasteur.** Capture réelle du sermon YouTube, citation posée en HTML, verset vérifié contre une Bible de référence par texte. Les règles Meta, TikTok et YouTube sur les humains photoréalistes synthétiques rendent toute autre approche risquée pour la réputation d'une église.
8. **Canva comme couche de marque partagée avec le client** : un compte Teams, un Brand Kit et 10 à 20 brand templates par client, Autofill par l'API Connect (ouvert à Teams depuis le 21 septembre 2026) ou par le MCP déjà connecté à Cowork. Le gestionnaire humain et le client retouchent dans Canva, pas dans le code. Exporter MP4 pour les stories.
9. **Carrousels comme format prioritaire** pour 2IAE, Markel-Tech et SEVARTA : coût quasi nul, portée organique élevée, génération entièrement déterministe à partir d'un JSON. Export PDF pour LinkedIn.
10. **Contrôle qualité en trois couches** (déterministe, vision LLM, boucle de correction) exécuté avant toute planche client, avec journal des rejets par moteur et par client. Budget QC : environ 0,01 $ par image, soit moins que l'image elle-même.
11. **Jeu de test français** de 30 phrases accentuées, rejoué à chaque changement de version de moteur (OpenAI dépréciera 1.5 ; 2.5 remplacera 2). Les versions changent tous les 3 à 5 mois : la machine doit abstraire le moteur derrière une interface unique (prompt, références, taille, qualité, masque) et stocker, pour chaque visuel, le moteur et la version utilisés.
12. **Conformité codée, pas rappelée** : par client, un profil de règles (beauté : pas d'allégation médicale, pas d'avant/après sans profil 18+ et sans promesse chiffrée, pas de « pinched fat » ; église : pas de visage synthétique ; tous : étiquette IA déclarée si photoréaliste). Le générateur de légendes et le QC vision lisent ce profil. Prévoir une case « AI info » automatique lors de la publication Meta pour tout visuel photoréaliste généré.
13. **Provenance assumée** : conserver les métadonnées C2PA d'OpenAI et le SynthID de Google plutôt que les retirer ; Meta les lit. Mentionner « visuel créé avec IA » dans la légende quand c'est photoréaliste ; privilégier les styles illustrés et motion design (non soumis à étiquette) pour les contenus de marque récurrents.
14. **Styles de marque Recraft** pour les clients qui veulent un univers illustré reconnaissable (association culturelle, SEVARTA jeunesse) : style créé une fois, 0,035 $ par image, SVG pour les icônes et logos à 0,08 $.
15. **LoRA seulement sur demande justifiée** : 8 $ d'entraînement FLUX.2 chez fal pour un produit ou une mascotte générés plusieurs centaines de fois. Dans les autres cas, les 10 à 16 images de référence suffisent et coûtent moins d'un cent.
16. **Upscale en secours, pas en routine** : 2K/4K natifs chez OpenAI, Google et Seedream. Réserver Topaz Precision (0,08 $ par 24 MP) aux photos clients médiocres et aux captures 720p de sermons.
17. **FLUX 3 Image à mettre en observation** : son système de layout par boîtes (texte et logo positionnés) pourrait, s'il tient ses promesses, remplacer la composition HTML pour les affiches ; décision après un premier banc d'essai interne et après la fin de l'offre de lancement du 8 octobre 2026.
18. **Budget réaliste à annoncer aux clients** : 1,5 à 4 dollars par client et par mois de génération d'images pour 20 publications, auxquels s'ajoutent Canva Teams, les jetons Claude et le temps de validation. Le prix de vente de la prestation ne dépend pas du coût des images ; il dépend de la régularité, de la conformité et de la mise en avant des produits, ce que la machine garantit.

## 13. Sources consultées (liste principale)

- https://developers.openai.com/api/docs/guides/image-generation
- https://developers.openai.com/api/docs/models/gpt-image-2.5-flare
- https://developers.openai.com/api/docs/models/gpt-image-1.5
- https://developers.openai.com/api/docs/pricing
- https://fal.ai/gpt-image-2.5
- https://www.aifreeapi.com/en/posts/openai-image-generation-api-pricing
- https://openai.com/index/advancing-content-provenance/
- https://petapixel.com/2026/05/20/openai-gets-serious-about-detecting-fake-images/
- https://x.com/OpenAIDevs/status/2046671238534496259
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/image-generation
- https://www.aifreeapi.com/en/posts/nano-banana-pro-pricing
- https://aicybr.com/blog/imagen-4-api-shutdown-migrate-gemini-image
- https://bfl.ai/blog/flux-2
- https://fal.ai/models/fal-ai/flux-2-pro
- https://developer.puter.com/tutorials/flux-api-pricing/
- https://openrouter.ai/black-forest-labs/flux.2-pro
- https://venturebeat.com/technology/black-forest-labs-launches-flux-3-capable-of-generating-images-and-20-second-video-with-audio-but-in-limited-release-to-start
- https://kingy.ai/blog/flux-3-image-specs-benchmarks-comparison/
- https://developer.puter.com/tutorials/ideogram-api-pricing/
- https://costbench.com/software/ai-image-generators/ideogram/
- https://www.recraft.ai/docs/api-reference/pricing
- https://www.recraft.ai/docs
- https://www.wireflow.ai/blog/best-midjourney-api-tools-in-2026
- https://unifically.com/blogs/midjourney-api
- https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/text-to-image
- https://openrouter.ai/bytedance-seed/seedream-5-0-pro
- https://www.together.ai/models/qwen-image-20
- https://www.orcarouter.ai/blog/qwen-image-2-1-vs-qwen-image-3-0
- https://www.eesel.ai/blog/reve-2-1-pricing
- https://developer.puter.com/tutorials/stability-ai-api-pricing/
- https://fal.ai/pricing
- https://replicate.com/pricing
- https://fal.ai/models/fal-ai/flux-lora-fast-training
- https://blog.fal.ai/training-flux-2-loras
- https://img.ly/ai-benchmarks/models/
- https://img.ly/ai-benchmarks/models/gpt-image-2/
- https://img.ly/ai-benchmarks/models/gpt-image-2-5-flare/
- https://img.ly/ai-benchmarks/models/nano-banana-2/
- https://img.ly/ai-benchmarks/models/nano-banana-pro/
- https://img.ly/ai-benchmarks/models/flux-2-pro/
- https://img.ly/ai-benchmarks/models/recraft-v4-1/
- https://img.ly/ai-benchmarks/models/seedream-5-pro/
- https://img.ly/ai-benchmarks/models/ideogram-v3/
- https://www.atlascloud.ai/blog/tips/2026-ai-image-api-benchmark-gpt-image-2-vs-nano-banana-2-pro-vs-seedream-5-0
- https://www.photoroom.com/api/pricing
- https://poof.bg/blog/top-5-ai-background-removal-apis-2026
- https://rangy.ai/blog/best-ai-image-upscaler-2026/
- https://www.segmind.com/models/topaz-image-upscale/pricing
- https://fal.ai/topaz
- https://pikes.ai/blog/magnific-freepik-pricing-2026
- https://github.com/vercel/satori/blob/main/README.md
- https://vercel.com/blog/introducing-vercel-og-image-generation-fast-dynamic-social-card-images
- https://www.pkgpulse.com/guides/ipx-vs-vercel-og-vs-satori-dynamic-image-2026
- https://www.canva.dev/docs/connect/changelog/
- https://www.canva.dev/docs/connect/api-reference/exports/create-design-export-job/
- https://www.canva.dev/docs/apps/mcp/tools/
- https://sudomock.com/blog/bannerbear-api-pricing-2026
- https://placid.app/pricing
- https://templated.io/pricing
- https://www.abyssale.com/pricing
- https://github.com/Hainrixz/open-carrusel
- https://adligator.com/blog/meta-health-wellness-ad-policy-update-2026
- https://www.auditsocials.com/blog/meta-beauty-cosmetics-ads-2026-before-after-photos-appearance-claims-policy
- https://www.auditsocials.com/blog/cross-platform-ai-content-labeling-requirements-2026-meta-google-tiktok-youtube-comparison
- https://aiofm.info/en/guides/instagram-ai-rules
- https://transparency.meta.com/policies/ad-standards/
- https://arxiv.org/html/2602.09475
