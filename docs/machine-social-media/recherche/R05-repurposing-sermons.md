# R05. Découpage et réexploitation de vidéos longues (sermons YouTube, conférences, webinaires) en clips animés

Rapport de recherche pour la machine social media de José Kouadio (Markel-Tech, SEVARTA, 2IAE). Date du rapport : 1er octobre 2026. Tous les prix sont en dollars américains sauf mention contraire, et datés de la page consultée. Quand une information n'a pas été trouvée, c'est écrit.

## 1. Résumé exécutif

Le marché du « long vers court » est mature : une dizaine d'outils généralistes (OpusClip, Vizard, Klap, Submagic, Munch, Descript, Captions/Mirage, Riverside, Veed, Kapwing) et une niche d'outils dédiés aux églises (Sermonshots, Pulpit AI, Sermon Clips, Choppity, Church Media Squad en service humain). Les prix convergent entre 15 et 97 dollars par mois, et trois outils exposent une API utilisable depuis une plateforme comme celle de José : Vizard (API dès le plan Creator), Klap (facturation à l'acte, environ 0,44 dollar par vidéo traitée, 0,32 dollar par short et 0,48 dollar par export) et OpusClip (API sur plan Pro bêta, Max et Business, 1 crédit par minute, minimum 10 crédits par projet). Submagic vend une API de sous-titrage seule (0,10 à 0,23 dollar la minute).

Les briques pour construire soi-même le flux existent, sont bon marché et sont pour la plupart open source. Un sermon de 60 minutes coûte entre 0,15 et 0,36 dollar à transcrire (Deepgram Nova-3, AssemblyAI Universal, ElevenLabs Scribe v2, OpenAI gpt-4o-transcribe), entre 0,30 et 1,20 dollar à analyser par un LLM selon le modèle (Claude Haiku 4.5 à Opus 5.5, prix du 25 septembre 2026) et quelques centimes à rendre en vidéo verticale (ffmpeg + libass, ou Remotion). Le coût marchand total par sermon se situe entre 1 et 3 dollars, contre 5 à 8 dollars par sermon chez Pulpit AI, 4 à 5 dollars via l'API Klap, et 53 à 97 dollars par mois chez Sermonshots.

Le vrai différenciateur n'est pas le découpage mécanique (tout le monde le fait), c'est la chaîne complète en français, avec compréhension de la structure du sermon, cartes de versets, highlights animés, dérivés écrits (dévotionnel, article, chapitrage) et une boucle de validation client. C'est ce que ni OpusClip ni Vizard ne font, et ce que les outils d'église font seulement en anglais.

## 2. État de l'art des outils

### 2.1 Tableau comparatif des généralistes (prix relevés le 1er octobre 2026)

| Outil | Entrée de gamme | Unité | Durée max de source | API | Remarques |
|---|---|---|---|---|---|
| OpusClip | Free 60 crédits, Starter 15 $/mois 150 crédits, Pro 29 $/mois (14,50 $ en annuel) 300 crédits, Business sur devis | 1 crédit = 1 minute de vidéo source | import jusqu'à 10 Go (Free, Starter), 30 Go (Pro) | Pro (bêta), Max, Business ; 30 requêtes/min ; 4 projets simultanés sur Pro, 50 sur Business ; webhooks ; minimum 10 crédits par projet ; projets effacés après 30 jours | ClipAnything (multimodal, paramètre customPrompt), score de viralité, 20 langues et plus, connecteur MCP annoncé sur la page de prix |
| Vizard | Free 60 crédits, Creator 29 $/mois (14,50 $ en annuel) 600 crédits, Business 39 $/mois (19,50 $ en annuel) | 1 crédit = 1 minute source | illimité en export 4K sur plans payants, 10 min en Free | API dès le plan Free (1 req/min), Creator (3 req/min, 20/h), Business (10 req/min, 60/h) ; endpoints clipping, publication, comptes sociaux ; vidéo minimum 1 minute | sous-titres auto et traduction, B-roll, emojis, auto reframe, 6 à 20 comptes sociaux |
| Klap | Starter 29 $/mois (23 $ annuel) 10 uploads et 100 clips, Pro 79 $ (63 $) 30 uploads, Pro+ 189 $ (151 $) 100 uploads | uploads par mois | 45 min (Starter), 2 h (Pro), 3 h (Pro+) | API v2 à l'usage : 0,44 $ par traitement vidéo, 0,32 $ par short généré, 0,48 $ par export (docs.klap.app/pricing, 1er octobre 2026) | essai 3 jours avec carte |
| Submagic | Free 3 vidéos, Starter 19 $ (12 $ annuel) 15 vidéos de 2 min, Pro 39 $ (23 $) 40 vidéos de 5 min, Business 69 $ (41 $) 100 vidéos de 30 min | vidéos par mois | 30 min max (Business) | API : 10 min/mois inclus sur Starter et Pro, 100 min sur Business ; packs 250 min 57 $ (0,23 $/min), 500 min 75 $ (0,15 $/min), 5 000 min et plus 0,10 $/min | sous-titres animés, B-roll, zooms ; c'est un sous-titreur, pas un découpeur de longue vidéo |
| Munch | Essential 38 $/mois (annuel) 200 min, Premium 60 $ 500 min, Studio 118 $ 1 000 min, Scale 318 $ 7 500 min | minutes uploadées | | pas d'API publique trouvée | prix affichés seulement après inscription, pas de plan gratuit |
| Descript | Free 60 min, Hobbyist 16 $/mois (annuel) 10 h, Creator 24 $ 30 h, Business 50 $ 40 h | heures de transcription + crédits IA (créer des clips = 30 crédits) | | API publique en bêta ouverte en 2026 (projets, actions Underlord, imports) ; intégration Zapier et MCP | éditeur texte-vidéo, Underlord comme co-éditeur ; excellent pour la retouche humaine, pas pour le volume |
| Captions (Mirage) | Free 200 crédits, Pro 9,99 $, Max 24,99 $, Scale 69,99 $ à 279,99 $ | crédits | | API : sous-titres 0,15 $/min, avatar Mirage 0,15 $ par seconde (par tranche de 6 s) | entreprise rebaptisée Mirage en septembre 2025 ; orientée mobile et avatars |
| Riverside | Free, Pro 29 $/mois (24 $ annuel), Grow 39 $ (34 $), Webinar 99 $ (79 $) | heures d'enregistrement | | pas d'API de clipping publique trouvée | Magic Clips sur tous les plans (1 jeu par enregistrement en Free, 3 sur Pro, 5 sur Business), prix vérifiés le 20 août 2026 par Castmagic |
| Veed | Lite 18 $/mois (annuel), Pro 30 $ (42 $ mensuel), Business 59 $ par siège | | | pas d'API publique trouvée pour Magic Cut | sous-titres et traduction 50 langues et plus sur Pro |
| Kapwing | Pro 24 $/mois (16 $ annuel) 1 000 crédits IA, Business 64 $ (50 $) 4 000 crédits | crédits | 120 min par vidéo sur Pro | pas d'API publique trouvée | éditeur navigateur, bon plan gratuit |
| AutoPod | 29 $/mois (26,58 $ annuel), essai 30 jours | | | aucune (plugin Premiere Pro) | multicam jusqu'à 10 caméras par détection de niveau audio, Social Clip Creator ; utile pour un monteur humain, pas pour une machine |

Sources : https://www.opus.pro/pricing ; https://help.opus.pro/api-reference/overview ; https://vizard.ai/pricing ; https://docs.vizard.ai/ ; https://docs.klap.app/pricing ; https://www.submagic.co/pricing ; https://opentools.ai/tools/munch ; https://www.g2.com/products/descript/pricing ; https://help.mirage.app/docs/api/pricing ; https://www.castmagic.io/blog/riverside-pricing ; https://flowith.io/blog/veed-io-pricing-2026-free-vs-basic-vs-pro/ ; https://checkthat.ai/brands/kapwing/pricing ; https://diyai.io/ai-tools/video-generation/reviews/autopod-review/

Lecture : pour une machine qui traite plusieurs clients, seuls Vizard, Klap et OpusClip sont réellement « programmables ». Vizard est le moins cher à l'unité (600 minutes pour 14,50 dollars en annuel, soit 10 sermons d'une heure pour moins de 1,50 dollar chacun) et son API est incluse dès le plan payant. Klap est le plus transparent (prix à l'acte, pas d'abonnement obligatoire pour l'API d'après sa page, à vérifier à la création du compte). OpusClip est le plus connu et le plus riche (ClipAnything, score de viralité, MCP), mais l'API reste en bêta sur Pro et son minimum de 10 crédits par projet pénalise les petites vidéos.

### 2.2 Outils dédiés aux églises

| Outil | Prix (date) | Ce qu'il produit | Limites observées |
|---|---|---|---|
| Sermonshots | Free (2 clips une seule fois), Plus 63 $/mois (53 $ annuel), Silver Suite 67 $ (57 $), Gold Suite 97 $ (87 $) ; 10 heures d'upload par mois sur tous les plans payants, clips illimités (page de prix, 1er octobre 2026) | transcription, clips, audio podcast, intégration livestream ; Silver ajoute citations en image, générateur d'articles, dévotionnels 5 jours, « Quotes & Verses », guides de discussion ; Gold ajoute doublage IA en 33 langues | « 40+ languages » annoncées ; aucune API ; refonte mobile juillet 2026, guides de discussion 2.0 avril 2026, partage Facebook et Instagram mars 2026 |
| Pulpit AI (Subsplash) | Basic 39 $/mois 5 uploads, Standard 59 $ 10 uploads, Pro 129 $ 25 uploads ; essai 2 uploads sans carte (pulpitai.com/pricing, 1er octobre 2026) | « plus de 20 contenus » par sermon : clips automatiques et personnalisés illimités, résumés, transcriptions, articles, newsletters, matériel de discipulat, guides de discussion, chat avec le sermon (Pro) | aucune mention du français sur la page de prix ; aucune API ; soit 4,64 à 8 $ par sermon |
| Sermon Clips (sermon-clips.com) | 23,99 $/mois « Founding Pastor » ou 9,99 $/semaine | clips, captions cinématiques, B-roll | petit acteur, à tester |
| Sermon Transcription (sermon-transcription.com) | Sermon Clips Pro 49 $/mois, sermons et clips illimités | clips avec captions et B-roll | |
| Choppity | dès 20 $/mois | clip, montage, programmation, analytics, critères IA personnalisés (Écriture, appel à l'action) | article comparatif écrit par son fondateur (10 juin 2026), donc partial |
| Church Media Squad | service humain : Unlimited Graphics 797 $/mois, Graphics + Video 1 697 $/mois (vidéos de moins de 15 min), All-In 2 497 $/mois, All-In Premium 3 497 $/mois sur 12 mois ; essai 14 jours ou 3 projets | graphisme et montage illimités par des humains | c'est le prix de référence d'une agence : la machine de José doit livrer l'équivalent pour un dixième |
| Sermon.ai / SermonAI | Basic 15 $/mois, Pro 29 $/mois | rédaction et préparation de sermons, pas de clipping | hors sujet pour le découpage |

Sources : https://www.sermonshots.com/pricing ; https://www.pulpitai.com/pricing ; https://sermon-clips.com/alternatives/sermonshots ; https://www.choppity.com/blog/best-sermon-shots-alternatives/ ; https://churchmediasquad.com/pricing ; https://churchgraphics.app/blog/church-media-squad-alternatives ; https://reachrightstudios.com/blog/best-sermon-clip-software/

Lecture : les outils d'église ont compris le besoin (versets, dévotionnels, guides de discussion, podcast audio) mais sont anglophones, sans API, et tarifés à l'église. Aucun ne gère plusieurs clients dans un même compte avec validation client. Aucun ne traite le français d'Afrique de l'Ouest (accents, mélange français et langues locales, louange en fond sonore). C'est la place à prendre.

## 3. Briques techniques pour le construire soi-même

### 3.1 Récupérer la vidéo source

Trois voies, de la plus propre à la plus fragile.

1. Upload direct par le client dans la plateforme (fichier MP4 ou MOV, ou lien vers un bucket). C'est la voie recommandée : pas de dépendance à YouTube, qualité d'origine (souvent 1080p ou 4K), et les églises ont presque toujours le fichier de leur régie. Sur Railway, un bucket S3 avec upload multipart présigné suffit.
2. YouTube Data API v3 pour les métadonnées et les sous-titres de la propre chaîne du client (OAuth du propriétaire) : channels.list, playlistItems.list, captions.download. L'API ne télécharge jamais le fichier vidéo lui-même. Quota par défaut de 10 000 unités par jour ; depuis le 4 décembre 2025, un upload (videos.insert) coûte environ 100 unités au lieu de 1 600, et depuis le 1er juin 2026 le quota est granulaire par méthode (videos.insert et search.list d'abord). Source : https://developers.google.com/youtube/v3/revision_history et https://www.getphyllo.com/post/youtube-api-limits-how-to-calculate-api-usage-cost-and-fix-exceeded-api-quota
3. yt-dlp. L'outil est légal, mais l'article 5.1.H des conditions YouTube interdit de télécharger sans fonction officielle, même sa propre vidéo via un outil tiers. Pour la propre chaîne du client, les voies officielles sont YouTube Studio (téléchargement souvent limité à 720p) et Google Takeout (fichiers d'origine). Sources : https://legallyexplained.com/is-it-legal-to-download-youtube-videos/ ; https://apexgear.blog/download-your-own-youtube-videos ; https://techwiser.com/download-your-own-youtube-videos-in-4k/

Recommandation : contrat de service où le client déclare être titulaire des droits, upload direct ou lien de son stockage, et yt-dlp seulement en secours documenté avec l'autorisation écrite du propriétaire de la chaîne, jamais sur du contenu tiers. Pour les églises, demander l'enregistrement de régie (meilleure image, pistes audio séparées parfois disponibles).

### 3.2 Transcription : prix, français, diarisation, horodatage mot à mot

| Service | Prix par heure d'audio (date) | Français | Diarisation | Mots horodatés | Notes |
|---|---|---|---|---|---|
| Deepgram Nova-3 batch | 0,26 $ monolingue (0,0043 $/min), 0,31 $ multilingue (0,0052 $/min) ; crédit gratuit 200 $ (deepgram.com/pricing, 1er octobre 2026) | oui, 45 langues et plus, détection automatique | incluse en batch, 0,002 $/min en streaming | oui, chaque mot avec start et end en secondes ; utterances et paragraphes | plainte publique du 23 mars 2026 : WER de 40 à 50 % en détection multilingue sur du français, 10 à 20 % en forçant language=fr ; toujours forcer la langue |
| AssemblyAI Universal-2 | 0,15 $ ; Universal-3.5 Pro 0,21 $ ; 50 $ de crédit à l'inscription (assemblyai.com/pricing, 1er octobre 2026) | oui, 99 langues en pré-enregistré | incluse en standard, identification nominative +0,02 $/h, expérimentale +0,065 $/h | oui | le moins cher des services managés ; traduction +0,06 $/h |
| ElevenLabs Scribe v2 | 0,22 $ ; Realtime 0,39 $ ; keyterms +0,05 $/h, entités +0,07 $/h (elevenlabs.io/pricing/api, 1er octobre 2026) | 90 langues et plus, « plus de 98 % de précision » annoncés sans détail par langue | oui en batch, pas en temps réel | oui | bon sur les accents d'après les tests indépendants, à vérifier sur du français ivoirien |
| OpenAI gpt-4o-transcribe | 0,36 $ (0,006 $/min) ; gpt-4o-mini-transcribe 0,18 $ ; gpt-4o-transcribe-diarize 0,36 $ ; whisper-1 0,36 $ (costgoat, vérifié le 5 septembre 2026 ; openai.com/api/pricing renvoyait 403 à la consultation) | oui | gpt-4o-transcribe-diarize | seul whisper-1 fournit les timestamps mot à mot ; les modèles gpt-4o ne les fournissent pas | limite de 25 Mo par requête, donc découpage du fichier en morceaux obligatoire pour 60 minutes |
| Gemini 3.5 Transcribe (API Gemini) | entrée audio 0,003 $/min, sortie 0,002 $/min, soit environ 0,30 $ l'heure (ai.google.dev/gemini-api/docs/pricing, 1er octobre 2026) | oui | partielle via prompt | horodatage demandé par prompt, moins fiable qu'un aligneur | 32 tokens par seconde d'audio pour les modèles multimodaux classiques |
| WhisperX auto-hébergé (faster-whisper + alignement wav2vec2 + pyannote) | 0,02 à 0,05 $ l'heure en GPU loué (L40S à 0,75 $/h, 25 à 30 fois le temps réel) ; RTX 4090 à 0,48 $/h | oui, large-v3 | pyannote (licence à vérifier) | oui, précision annoncée ±50 ms contre ±500 ms en Whisper natif | exige un GPU, donc hors Railway classique ; Modal ou RunPod à la demande |

Sources : https://deepgram.com/pricing ; https://github.com/orgs/deepgram/discussions/1571 ; https://www.assemblyai.com/pricing ; https://elevenlabs.io/pricing/api ; https://costgoat.com/pricing/openai-transcription ; https://ai.google.dev/gemini-api/docs/pricing ; https://www.forasoft.com/learn/ai-for-video-engineering/articles-ai/whisperx-diarization-word-level-timestamps ; https://www.spheron.network/blog/faster-whisper-gpu-cloud-production-deployment-guide/

Recommandation : AssemblyAI Universal-3.5 Pro ou Deepgram Nova-3 avec language=fr comme moteur principal (0,21 à 0,31 dollar l'heure, mots horodatés inclus), ElevenLabs Scribe v2 en second avis sur les sermons à fort accent. Prévoir un banc d'essai interne de 5 sermons (Abidjan, Paris, Montréal) avec WER mesuré avant de figer le choix ; aucune des pages officielles ne publie de WER par langue.

### 3.3 Détection des temps forts par LLM

C'est la brique où la valeur se joue. Les outils grand public scorent chaque segment sur « force du hook, intensité émotionnelle, citabilité, complétude narrative » (OpenClip, 2026) et des travaux académiques sur la période d'accroche des vidéos (arXiv 2602.22299, 2026) confirment qu'un LLM multimodal repère bien l'appel émotionnel et le défi lancé au spectateur. Source : https://openclip.app/use-cases/auto-detect-viral-moments ; https://arxiv.org/html/2602.22299

Pour un sermon, la grille recommandée par les praticiens (ReachRight, avril 2026, mis à jour 25 septembre 2026) tient en cinq types de moments : la phrase-choc qui cadre le message, l'histoire ou l'illustration, l'application d'un passage biblique (lecture + une phrase d'éclairage), la prise de position à contre-courant, l'appel à l'action. Règle : « un clip, une idée, jamais deux ». Source : https://reachrightstudios.com/blog/sermon-clips-for-social-media/

Structure d'un sermon à faire reconnaître par le modèle : accueil et annonces (à exclure), lecture du texte, exposition point par point (souvent 3 points), illustrations, application, appel et prière finale. Le LLM reçoit la transcription segmentée (phrases avec start et end, pas les mots, pour économiser des tokens) et renvoie un JSON : liste de candidats avec bornes, type de moment, note sur chaque critère, phrase de hook proposée, titre, versets cités, raison du choix. Un second passage affine les bornes au mot près (début sur une attaque de phrase, fin sur une chute) en relisant seulement la fenêtre concernée avec les mots horodatés.

Coût LLM pour 60 minutes (environ 9 000 mots de français, soit 15 000 à 20 000 tokens en segments) aux prix Anthropic du 25 septembre 2026 : Claude Opus 5.5 à 4 $ par million de tokens en entrée et 20 $ en sortie ; Claude Sonnet 5.5 à 2 $ et 10 $ ; Claude Haiku 4.5 à 1 $ et 5 $. Une chaîne complète (structure, candidats, affinage de 8 fenêtres, titres et hooks, versets, dévotionnel, article, chapitrage) représente environ 150 000 tokens en entrée et 20 000 en sortie, soit environ 1,00 $ avec Opus 5.5, 0,50 $ avec Sonnet 5.5, 0,25 $ avec Haiku 4.5 ; la mise en cache de la transcription (lecture de cache à 0,20 $ par million sur Opus 5.5) divise encore l'entrée par trois ou quatre. Par comparaison, gpt-4o-mini, que José utilise déjà pour classer des publications, ferait le tri grossier pour quelques centimes mais n'a pas la finesse requise pour juger un sermon. Source : table de prix du skill claude-api (cache 25 septembre 2026), à confirmer sur https://platform.claude.com/docs/en/about-claude/pricing

### 3.4 Détection de scènes

PySceneDetect (ContentDetector, AdaptiveDetector, HistogramDetector) et le filtre scdet de ffmpeg détectent les coupes franches et les fondus. Sur un sermon à une ou deux caméras, la détection de scène sert surtout à deux choses : savoir quand la régie bascule sur un plan large (pour ne pas recadrer sur un visage absent) et détecter les diapositives ou versets affichés à l'écran (OCR possible ensuite). Elle ne sert pas à choisir les temps forts, qui viennent du texte et de l'audio. Source : https://www.scenedetect.com/ ; https://github.com/Breakthrough/PySceneDetect

### 3.5 Recadrage vertical avec suivi du visage

Trois projets open source 2026 reproduisent la fonction « auto reframe » des outils payants et tournent sur CPU :

- FrameShift (fralapo) : héritier d'AutoFlip de Google (MediaPipe), un recadrage fixe par scène autour des visages et objets, audio remuxé par ffmpeg.
- auto-vertical-reframe (delvilo) : MediaPipe face detection et pose, caméra virtuelle avec panoramique et zoom lissés.
- ClippyMe (fralapo) : alternative auto-hébergée complète à OpusClip, détection de moments par Gemini, transcription, suivi du locuteur actif par YOLOv8 + MediaPipe FaceMesh (variance d'ouverture de bouche), sous-titres, édition navigateur, programmation TikTok, Reels, Shorts.

Sources : https://github.com/fralapo/FrameShift ; https://github.com/delvilo/auto-vertical-reframe ; https://github.com/fralapo/clippyme ; https://research.google/blog/autoflip-an-open-source-framework-for-intelligent-video-reframing/

Pour un prédicateur qui marche sur une estrade, la bonne stratégie est le « cameraman virtuel » : détecter le visage toutes les 5 images, lisser la trajectoire (filtre exponentiel ou Kalman simple), interdire les mouvements brusques, et basculer en plan centré fixe quand la régie passe en plan large. Un clip de 60 s à 30 images par seconde représente 1 800 images, soit 360 détections MediaPipe : moins d'une minute de CPU. Les services managés (OpusClip, Vizard, Klap) font la même chose pour le prix du crédit.

### 3.6 Sous-titres mot à mot stylisés

Le standard technique est le format ASS rendu par libass dans ffmpeg (filtre subtitles), avec les balises karaoké \k et \kf pour la progression mot à mot, ou des groupes de 3 à 5 mots avec le mot actif coloré et agrandi. Le projet ffmpeg-caption-burn-ass (nik-devs) propose les deux modes (karaoké et carrousel un mot à la fois avec pop-in) en Python standard plus ffmpeg, sans navigateur. Entrée : les mots horodatés de la transcription. Sortie : un seul passage ffmpeg. Source : https://github.com/nik-devs/ffmpeg-caption-burn-ass ; https://www.ffmpeg-micro.com/blog/ffmpeg-subtitles-filter-guide

Règles éditoriales : 85 % des vidéos sociales sont regardées sans le son (ReachRight, 2026), donc sous-titres incrustés obligatoires, 1 à 3 lignes, 3 à 6 secondes par ligne, fort contraste, police lisible sur téléphone, mots-clés surlignés (nom de Dieu, verset, mot du hook). Pour un rendu plus riche (animations, logos, bandeaux de verset), Remotion ou Claude Design prennent le relais, voir 3.9.

### 3.7 B-roll, hooks de titre, cartes de versets

- B-roll : pour un sermon, le B-roll est rarement souhaitable (le visage du prédicateur est le contenu). Les outils (Submagic, Vizard) insèrent des banques d'images génériques ; la meilleure option est le B-roll du client lui-même (plans de l'assemblée, louange, baptêmes) stocké dans sa médiathèque de plateforme et tagué par un modèle de vision.
- Hooks de titre : le LLM propose 3 titres de 4 à 8 mots par clip, affichés dans la première seconde, sans langage de mise en contexte (« dimanche dernier », « extrait de ») qui tue la rétention. 50 à 60 % des abandons sur Shorts se produisent dans les trois premières secondes (données citées par Miraflow, 2026). Source : https://miraflow.ai/blog/youtube-shorts-best-practices-2026-complete-guide
- Cartes de versets : API.Bible (scripture.api.bible) propose un plan Starter gratuit de 5 000 appels par mois réservé au non commercial (Bibles du domaine public et Creative Commons), un plan Pro à partir de 29 $/mois avec 150 000 appels et des traductions sous licence à partir de 10 $/mois par traduction ; bible-api.com et l'API open source wldeh/bible-api sont gratuits et sans clé, avec des versions du domaine public dont la Louis Segond 1910. Pour l'usage commercial d'une agence, le plan Pro d'API.Bible ou l'hébergement local d'une Segond 1910 (domaine public) sont les deux voies sûres ; la Semeur, la NBS ou la Segond 21 exigent une licence. Source : https://docs.api.bible/your-account/plans-pricing/ ; https://bible-api.com/ ; https://github.com/wldeh/bible-api

### 3.8 Highlights animés, typographie cinétique, audiogrammes

Deux moteurs de rendu pour les formats « citation sur fond animé » et « verset animé » :

- Remotion (React) : gratuit pour les particuliers, les associations, l'évaluation et les entreprises de 3 salariés ou moins ; au-delà, licence Creators à 25 $/mois par développeur ou Automators à 0,01 $ par rendu avec minimum 100 $/mois ; Enterprise à partir de 500 $/mois. Rendu sur Remotion Lambda dans son propre compte AWS pour environ 1 à 2 centimes par vidéo courte. Markel-Tech (moins de 4 salariés) entre vraisemblablement dans la gratuité, à confirmer par l'effectif réel. Source : https://www.remotion.dev/docs/license/pricing ; https://www.remotion.dev/docs/lambda/cost-example
- Claude Design (HTML animé rendu en MP4), que José utilise déjà pour le motion design : adapté aux planches de propositions et aux formats citation, moins adapté au volume automatisé.
- Audiogrammes : Headliner vend l'API seulement en Enterprise sur devis (plans publics 9,99 à 49,99 $/mois) ; un audiogramme se fabrique en ffmpeg avec le filtre showwaves ou en Remotion avec la forme d'onde calculée depuis le fichier audio. Pas besoin d'un service. Source : https://www.creatorstackclub.com/software/headliner/pricing

### 3.9 Chapitrage, articles, dévotionnels dérivés

À partir de la transcription structurée, le même LLM produit : chapitres YouTube (horodatages et titres, à pousser via videos.update), description YouTube, résumé en 5 points, article de blog de 800 mots, dévotionnel de 5 jours (verset, méditation, question, prière, comme Sermonshots Silver), guide de discussion pour les groupes de maison, 10 citations graphiques, un fil de 5 posts texte, une newsletter. Ce sont les « 20 contenus » que Pulpit AI vend 39 à 129 $/mois, pour quelques dizaines de centimes de tokens.

### 3.10 Flux complet YouTube vers Shorts, Reels, TikTok, Facebook

Ingestion (upload client ou lien) → extraction audio (ffmpeg) → transcription mots horodatés → structure et candidats (LLM) → affinage des bornes → recadrage et suivi du visage → sous-titres ASS → habillage (Remotion ou ffmpeg) → planche de propositions (captures, titres, hooks, durée) → validation client dans la plateforme → rendu final par plateforme → publication → mesure.

Contraintes de publication (2026) :
- YouTube Data API : videos.insert environ 100 unités depuis le 4 décembre 2025, quota par défaut 10 000 unités par jour, donc une centaine de Shorts par jour et par projet avant demande d'extension. Source : https://developers.google.com/youtube/v3/revision_history
- Instagram Graph API v25 : Reels publiés via conteneur media_type=REELS, plafond de 100 publications par 24 h, et durée maximale de 90 secondes via l'API alors que l'application accepte 3 minutes. Source : https://postproxy.dev/blog/instagram-reels-api-publishing-guide/ ; https://www.tokportal.com/learn/instagram-reels-posting-api-limitations
- TikTok Content Posting API : 6 requêtes par minute par jeton, environ 15 publications par créateur et par jour, 5 utilisateurs publiant par 24 h tant que l'application n'est pas auditée, et les publications restent privées jusqu'à l'audit. Source : https://vorplabs.com/agent-tools/tiktok-content-posting-api ; https://zernio.com/blog/tiktok-posting-api
- Facebook Reels : via l'API Graph des pages, même famille que la relecture de page déjà en place chez José.

## 4. Coût et temps machine par sermon de 60 minutes

Hypothèses : 60 minutes de vidéo 1080p, 8 clips candidats rendus, 5 clips publiés, 5 cartes de versets, dérivés écrits. Prix du 1er octobre 2026.

| Poste | Option | Coût | Temps machine |
|---|---|---|---|
| Transcription | AssemblyAI Universal-3.5 Pro | 0,21 $ | 2 à 4 min |
| | Deepgram Nova-3 multilingue, language=fr | 0,31 $ | 1 à 3 min |
| | gpt-4o-transcribe + whisper-1 pour les mots | 0,36 à 0,72 $ | 5 à 8 min (découpage 25 Mo) |
| | WhisperX sur GPU loué | 0,02 à 0,05 $ | 2 à 3 min plus démarrage |
| Analyse LLM (structure, candidats, affinage, titres, versets, dérivés) | Claude Opus 5.5 | environ 1,00 $ (0,40 $ avec cache) | 3 à 6 min |
| | Claude Sonnet 5.5 | environ 0,50 $ | 2 à 4 min |
| | Claude Haiku 4.5 pour le tri, Opus pour le choix final | environ 0,45 $ | 2 à 4 min |
| Recadrage et suivi du visage (MediaPipe, CPU) | 8 clips de 60 s | négligeable (CPU Railway, moins de 0,01 $) | 4 à 8 min |
| Sous-titres et rendu vidéo (ffmpeg + libass, 1080x1920) | 8 clips | négligeable (moins de 0,02 $ de CPU) | 4 à 10 min sur 2 vCPU |
| Habillage Remotion (si utilisé) | 8 rendus Lambda | 0,10 à 0,20 $ AWS, licence 0 $ si effectif de 3 ou moins | 2 à 4 min en parallèle |
| Cartes de versets | gpt-image-1.5 basse qualité 0,009 $ l'image, gpt-image-2 qualité moyenne environ 0,053 $ l'image | 0,05 à 0,27 $ pour 5 cartes ; 0 $ en rendu HTML ou Remotion | 1 à 3 min |
| Stockage | 2 Go source + 400 Mo de sorties sur bucket Railway | quelques centimes par mois | |
| Total construit soi-même | | 0,80 à 2,50 $ par sermon | 15 à 35 minutes de bout en bout, parallélisable |
| Comparaison : API Klap | 1 traitement + 5 shorts + 5 exports | 0,44 + 1,60 + 2,40 = 4,44 $ | 10 à 20 min |
| Comparaison : Vizard Creator annuel | 60 crédits sur 600 | 1,45 $ (plus abonnement) | 10 à 20 min |
| Comparaison : OpusClip Pro annuel | 60 crédits sur 300 | 2,90 $ (plus abonnement) | 10 à 20 min |
| Comparaison : Pulpit AI Standard | 1 upload sur 10 | 5,90 $ | |
| Comparaison : Church Media Squad | service humain | 1 697 $/mois | jours |

Sources : voir sections 2 et 3, plus https://developers.openai.com/api/docs/models/gpt-image-1.5 ; https://unifically.com/blogs/gpt-image-2

Lecture : le coût marchand est marginal. Le coût réel est le temps de développement et la qualité éditoriale. Un flux hybride (API Vizard ou Klap pour les clips bruts, chaîne maison pour la compréhension française, les versets et l'habillage) peut raccourcir la mise au marché de plusieurs semaines, pour 1,50 à 4,50 $ par sermon.

## 5. Ce que font les églises performantes en vidéo courte

### 5.1 États-Unis

- Elevation Church (Matthews, Caroline du Nord) est première du Church Influence 100 de 2026 avec 28,97 millions d'abonnés cumulés (église, Elevation Worship, Elevation YTH) ; Bethel suit avec 14,2 millions. Le top 10 concentre 52 % de l'audience des 100 églises classées. Presque toutes les églises du top 10 traitent YouTube comme canal principal, pas comme archive. Seules 32 églises sur 100 sont actives sur TikTok, et 35 sur 100 sont hors États-Unis (19 pays). Source : https://www.switcherstudio.com/whats-new/2026-church-influence-100
- Transformation Church (Tulsa, Michael Todd) : passée de 1 800 à 100 000 abonnés YouTube en moins de 45 jours fin 2018 après qu'une spectatrice a posté un clip de 2 minutes de la série Relationship Goals, vu 2 millions de fois en 48 heures ; la série cumule près de 30 millions de vues. Tactiques documentées par Pro Church Tools : environ cinq publications par jour sur Instagram, aucune semaine sans publication, adoption immédiate des nouveaux formats (« Reels sont l'avenir ? On y va à fond tout de suite »), contenu tourné au téléphone, piliers mêlés (prédication, famille, forme physique). Résultats : plus de 2 millions d'abonnés Instagram et YouTube, plus de 1 million sur Facebook et TikTok. Sources : https://careynieuwhof.com/episode336/ ; https://prochurchtools.com/blog-post/how-pastor-mike-todd-dominates-social-media
- Repères 2026 des praticiens : 3 à 5 clips par sermon (7 à 10 seulement avec une vraie équipe), un clip par jour du lundi au samedi par plateforme, Reels 30 à 45 s, Shorts 45 à 58 s, Facebook Reels 45 à 75 s, TikTok 15 à 30 s ; un clip atteint 5 000 à 50 000 personnes hors assemblée ; les Reels dépassent les visuels statiques de 10 à 30 fois en portée. Le reformatage du direct en vertical est « le geste à plus fort impact que la plupart des équipes vidéo d'église ne font pas avec constance ». Sources : https://reachrightstudios.com/blog/sermon-clips-for-social-media/ ; https://ruahcreativehouse.org/blog/church-social-media-strategy/

### 5.2 Monde francophone

- Impact Centre Chrétien (ICC, Yvan et Yves Castanou) : plus de 100 implantations, plus de 43 000 personnes le dimanche, culte diffusé en direct chaque dimanche à 10 h, chaîne YouTube ICC TV, compte TikTok @egliseicc actif en 2026, Yvan Castanou à 634 000 abonnés Instagram et 3 523 publications. Format observé : extraits de prédication sous-titrés, messages courts du pasteur face caméra, événements. Sources : https://en.wikipedia.org/wiki/Yvan_Castanou ; https://www.tiktok.com/@egliseicc ; https://www.instagram.com/yvancastanou/
- Vases d'Honneur (Abidjan, Mohammed Sanogo) : chaîne YouTube « Église Vases d'Honneur » avec « Matinale des miracles » quotidienne en direct, comptes TikTok @mohammedsanogo et hashtags d'église, 43 000 abonnés LinkedIn pour le pasteur ; événements C'Pentecôte 2026 et Eden Love 2026 largement relayés en extraits. Les chiffres précis d'audience TikTok et YouTube n'ont pas pu être relevés. Source : https://www.youtube.com/channel/UCOBrKVhgjiUcSoGyqeo29WA ; https://www.tiktok.com/@mohammedsanogo
- Hillsong Paris : aucune donnée chiffrée fiable trouvée dans cette recherche ; à relever manuellement.

Lecture pour José : les églises francophones qui performent ont un prédicateur charismatique et une régie, mais le découpage reste artisanal et irrégulier. Le gisement est là : chaque culte de 2 heures à Abidjan contient 5 à 10 moments publiables, et ils ne sont presque jamais extraits dans la semaine.

## 6. Même logique pour une maison d'édition et une école

### 6.1 Maison d'édition chrétienne (SEVARTA)

Le marché a prouvé que la vidéo courte vend des livres : BookTok a influencé 59 millions de ventes imprimées aux États-Unis en 2024 (plus de 760 millions de dollars) et plus de 50 millions de livres en Europe en 2025 (environ 800 millions d'euros, chiffres TikTok) ; 45 % des utilisateurs de TikTok disent avoir acheté un livre après une recommandation. Sources : https://newsroom.tiktok.com/booktok-community-50-million-books?lang=en-150 ; https://www.oscarghostwriting.com/blog/booktok-marketing-for-authors-costs-strategy-and-results/

Sources longues à découper chez un éditeur : interviews d'auteur (vidéo ou audio), lectures d'extraits par l'auteur, prédications de l'auteur (SEVARTA publie des pasteurs dont les sermons existent déjà sur YouTube), conférences de lancement, émissions. Dérivés : clip d'interview 30 à 45 s, extrait lu en audiogramme avec la couverture, citation animée sur fond texturé, « la phrase qui a tout changé » (hook à contre-courant), bande-annonce 15 s, carrousel de 5 citations, article « 5 idées du livre ». Pour un livre tiré d'un sermon, le même sermon alimente le clip ET le post de lancement : c'est la synergie propre à SEVARTA.

### 6.2 École supérieure (2IAE)

Les écoles francophones utilisent TikTok pour les témoignages d'étudiants, les coulisses des admissions et la vie de campus (Université Côte d'Azur, EDHEC pour les admissibles 2026, ESUP). Sources longues chez 2IAE : cours enregistrés du campus numérique (replays Daily déjà stockés), conférences, cérémonies, témoignages. Dérivés : « 60 secondes pour comprendre » tiré d'un cours (hook question, un concept, une phrase de conclusion), témoignage étudiant 30 s, « ce que vous allez apprendre cette semaine », montage des moments forts d'une journée d'intégration, chapitrage et résumé d'un cours pour la fiche de révision. Attention : droits à l'image des étudiants (consentement écrit) et interdiction de clipper un cours sans accord de l'enseignant ; le campus numérique est une session Claude distincte, la plateforme social media doit seulement lire les replays rendus publics. Source : https://www.tiktok.com/@univ_cotedazur

## 7. Incertitudes et points à vérifier

1. Pages de prix mouvantes : OpusClip, Vizard, Klap, Submagic ont été relevés le 1er octobre 2026 ; OpenAI (openai.com/api/pricing) a renvoyé 403, les prix de transcription viennent d'un agrégateur vérifié le 5 septembre 2026. Revérifier avant tout engagement.
2. Qualité du français ivoirien : aucun fournisseur ne publie de WER par langue ; la discussion Deepgram du 23 mars 2026 (WER 40 à 50 % en multilingue) montre le risque. Un banc d'essai sur 5 sermons réels est obligatoire.
3. Klap : la page de tarification API affiche des prix à l'acte sans abonnement ; des sources tierces disent que l'API est liée aux plans payants. À vérifier à l'ouverture du compte.
4. OpusClip : API « bêta » sur Pro, minimum 10 crédits par projet, projets effacés après 30 jours ; le connecteur MCP mentionné sur la page de prix n'a pas été documenté dans cette recherche.
5. Vizard : la page de prix consultée affichait « $0 » pour Creator et Business après remise (rendu de page défectueux) ; les 14,50 $ et 19,50 $ en annuel viennent de revues tierces de 2026.
6. Licence Remotion : gratuité jusqu'à 3 salariés ; vérifier comment Remotion compte les sous-traitants et les deux structures (Markel-Tech et SEVARTA).
7. pyannote (diarisation de WhisperX) a changé de licence plusieurs fois ; vérifier avant usage commercial.
8. Versions bibliques : seule la Louis Segond 1910 est sûrement libre ; Semeur, NBS, Segond 21, Parole de Vie exigent une licence éditeur, même pour des cartes de versets.
9. Conditions YouTube : yt-dlp sur sa propre vidéo reste une violation des conditions même si le droit d'auteur n'est pas en cause ; privilégier l'upload et Takeout.
10. TikTok : publication publique impossible via API avant l'audit de l'application ; compter 2 à 6 semaines.
11. Instagram API : 90 secondes maximum pour un Reel publié par API ; les clips de 45 à 75 s conseillés pour Facebook restent sous la barre, mais les « enseignements » de 2 à 3 minutes devront être publiés à la main ou via un outil tiers.
12. Chiffres d'audience des églises francophones (ICC, Vases d'Honneur, Hillsong Paris) : seules les données Instagram d'Yvan Castanou ont été relevées ; le reste reste à mesurer directement sur les comptes.
13. Les repères de rétention (50 à 60 % d'abandon dans les 3 premières secondes, 10 à 30 fois la portée des visuels statiques) viennent de blogs d'éditeurs d'outils, pas d'études indépendantes.
14. Prix Claude cités depuis la table du skill (cache du 25 septembre 2026) ; confirmer sur la page officielle avant chiffrage client.

## 8. Implications pour la machine de José

1. Construire la chaîne maison plutôt que revendre un outil. Coût marchand de 0,80 à 2,50 $ par sermon contre 4,44 $ via l'API Klap et 5 à 8 $ chez Pulpit AI ; surtout, aucun concurrent ne combine français, versets, dérivés écrits, multi-clients et validation client.
2. Démarrer en hybride pour aller vite : API Vizard (600 min pour 14,50 $/mois en annuel) ou Klap (prix à l'acte) pour les clips bruts dès le mois 1, pendant que la chaîne maison (transcription + LLM + ffmpeg) se construit ; basculer quand la qualité maison dépasse la leur sur le banc d'essai.
3. Transcription : AssemblyAI Universal-3.5 Pro (0,21 $/h) ou Deepgram Nova-3 avec language=fr forcé (0,31 $/h) ; jamais la détection automatique de langue sur du français africain. Garder ElevenLabs Scribe v2 (0,22 $/h) comme second moteur et comparer les WER sur 5 sermons de référence.
4. Toujours exiger les mots horodatés dans la réponse de transcription : ils alimentent à la fois le sous-titrage karaoké et l'affinage des bornes de clip. Éviter gpt-4o-transcribe pour cette raison (pas de timestamps mot à mot).
5. Analyse à deux étages : Claude Haiku 4.5 (1 $ par million de tokens en entrée) pour segmenter et pré-noter, Claude Opus 5.5 (4 $ et 20 $) pour choisir, titrer, écrire les hooks et produire les dérivés ; transcription mise en cache pour que les 6 à 8 passages ne la paient qu'une fois.
6. Encoder la doctrine de José dans le prompt de sélection : piliers 60/25/15, frameworks PAS, AIDA, BAB, hooks, 3 à 5 hashtags, règle des deux plateformes. Le modèle doit sortir, pour chaque clip, le pilier, le framework et la plateforme cible, pas seulement des bornes.
7. Grille sermon spécifique : cinq types de moments (phrase-choc, illustration, application du passage, contre-courant, appel), exclusion automatique des annonces, de la quête et de la prière finale sauf demande, détection des versets cités avec résolution via API.Bible ou base Segond 1910 locale.
8. Rendu : ffmpeg + libass pour les sous-titres karaoké (un seul passage, CPU Railway), MediaPipe pour le cameraman virtuel, Remotion pour l'habillage de marque (fond animé, bandeau verset, logo), Claude Design réservé aux planches de propositions et aux formats citation premium. Vérifier l'éligibilité à la licence Remotion gratuite.
9. Planche de propositions avant production : pour chaque sermon, une page dans la plateforme avec 8 vignettes (capture à l'image du hook, titre, durée, plateforme, type de moment, verset), validation en un clic par le client ou le pasteur, commentaire possible ; le rendu final ne part qu'après validation. C'est exactement le « est-ce que ça vous convient, madame ? » que José décrit.
10. Cadence imposée par défaut : 5 clips par sermon, un par jour du lundi au samedi, Reels 30 à 45 s, Shorts 45 à 58 s, TikTok 15 à 30 s, Facebook 45 à 75 s ; le planificateur refuse de publier les 5 clips le même jour.
11. Dérivés écrits inclus dans l'offre église : chapitres YouTube poussés automatiquement, description, dévotionnel 5 jours, guide de groupe de maison, 10 citations, newsletter. Marge quasi nulle en coût, valeur perçue élevée (c'est ce que Sermonshots facture 67 à 97 $/mois).
12. Ingestion propre : upload direct ou lien de stockage du client, OAuth YouTube pour les métadonnées, les sous-titres existants et la publication ; yt-dlp uniquement en secours avec autorisation écrite et sur la chaîne du client. Faire signer une clause de titularité des droits (musique de louange comprise, qui peut déclencher Content ID sur les Shorts).
13. Publication : YouTube (environ 100 unités par upload, 10 000 par jour), Instagram (100 publications par jour, 90 s max par API), TikTok (demander l'audit de l'application dès le premier mois, sinon publications privées), Facebook Reels par l'API Graph déjà connectée. Prévoir une file de publication par client avec reprise sur erreur.
14. Mesure en trois couches branchée sur les clips : indicateurs avancés (rétention à 3 s, complétion, partages), croissance (abonnés par plateforme), affaires (visiteurs, dons, inscriptions, ventes de livres) ; relire les statistiques via les API et nourrir le modèle de sélection avec les clips qui ont marché (boucle d'apprentissage par client).
15. Garde-fous doctrinaux et de marque : relecture obligatoire par un humain avant publication pour les églises (un clip sorti de son contexte peut dire le contraire du sermon), liste de mots sensibles, interdiction de couper au milieu d'un verset, respect des versions bibliques licenciées.
16. Verticale édition : traiter l'interview d'auteur et le sermon de l'auteur comme sources longues, produire audiogrammes avec couverture, citations animées et bande-annonce 15 s ; chaque lancement SEVARTA génère 15 à 20 contenus courts en une heure de machine.
17. Verticale école : clipper les replays de cours rendus publics et les témoignages, format « 60 secondes pour comprendre », consentement écrit des étudiants et des enseignants ; la plateforme lit seulement les données publiques du campus, conformément à la séparation des sessions.
18. Tarification suggérée pour l'offre église : coût direct inférieur à 3 $ par sermon et 15 à 35 minutes de machine, donc un abonnement de 150 à 300 $ par mois par église (4 à 5 sermons, 20 à 25 clips, dérivés, publication, rapport mensuel) reste 5 à 10 fois sous Church Media Squad et 2 à 4 fois au-dessus de Sermonshots, justifié par le français, la validation et la publication incluse.
19. Prévoir un GPU à la demande (Modal, RunPod) uniquement si le volume dépasse 200 heures par mois : en dessous, les API managées restent moins chères que le temps d'ingénierie d'un WhisperX auto-hébergé.
20. Mesurer avant de promettre : lancer un pilote de 4 semaines avec une église d'Abidjan et SEVARTA, 1 sermon par semaine, WER, taux d'acceptation des propositions par le client, rétention à 3 s et portée hors assemblée comme critères de succès.
