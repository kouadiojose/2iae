# R11. Qualité éditoriale : éviter le contenu IA plat, modéliser une voix de marque, mesurer et améliorer

Rapport de recherche pour la plateforme multi-clients de José Kouadio (Markel-Tech, SEVARTA, 2IAE). Date du rapport : 2 octobre 2026. Toutes les dates, chiffres et prix sont ceux trouvés dans les sources citées ; quand une donnée n'a pas été trouvée, le rapport le dit.

## 1. Résumé exécutif

Le problème que José décrit (« communication plate », clients qui partent) est documenté par les études 2026 : la quantité de contenu généré par IA explose, mais sa valeur perçue baisse. Sprout Social (février 2026, 2 250 répondants) mesure que 56 % des utilisateurs voient du « AI slop » souvent ou très souvent, que 50 % de la génération Z ont déjà désabonné, coupé ou bloqué une marque pour cette raison, et que « publier du contenu IA sans étiquette » est la première chose (28 %) que les consommateurs voudraient voir les marques arrêter. Gartner (mars 2026, 307 consommateurs américains) : 49 % jugent que l'IA générative a dégradé la qualité des contenus. Harris Poll / 4As / Infillion (juin 2026) : 78 % trouvent que l'IA rend les publicités « moins authentiques ».

Le paradoxe clé : Bynder (juin 2026, 2 000 consommateurs) montre que 56 % préfèrent l'article écrit par IA quand il n'est pas étiqueté, mais que 52 % se disent moins engagés dès qu'ils l'apprennent. Autrement dit, ce n'est pas la machine qui est rejetée, c'est le contenu générique, interchangeable, sans ancrage réel. Les plateformes le sanctionnent désormais : YouTube a précisé le 13 et 16 juillet 2026 que les contenus « qui ont l'air faits avec un gabarit » ou répétitifs ne sont plus monétisables ; Instagram a annoncé le 31 août 2026 une baisse de portée pour les profils de personnes générées par IA non étiquetés ; l'article 50 de l'AI Act européen s'applique depuis le 2 août 2026.

Ce qui marche se résume en six mécanismes que la machine de José doit implémenter : (1) une fiche de voix mesurable extraite des meilleurs posts du client, avec interdits lexicaux et test de discrimination en aveugle ; (2) l'ancrage dans des faits réels et locaux, en particulier une banque d'assets authentiques du client (photos, vidéos, témoignages, produits) ; (3) des hooks variés et testés en petits lots, avec une expérimentation légère de type bandit ; (4) un juge LLM à rubrique précise (spécificité, originalité, voix, appel à l'action, conformité), calibré sur des notes humaines (kappa d'au moins 0,6) et protégé contre les biais connus ; (5) un contrôle visuel par vision LLM (texte, logo, cadrage, zones de sécurité) avant chaque planche ; (6) une boucle d'apprentissage qui réinjecte les corrections du gestionnaire et les performances réelles (envois, enregistrements, rétention à 3 secondes) dans la mémoire par client.

Le rapport fournit les rubriques, des prompts d'évaluation types, les métriques de preuve (« délai tendance → publication », taux de vidéos, taux de produits mis en avant, envois par portée, enregistrements par portée), les techniques pour rendre images et vidéos IA moins « IA », et leurs limites honnêtes.

## 2. Pourquoi le contenu IA est perçu comme « plat » : les données 2025-2026

### 2.1 Fatigue, détection et désabonnement

| Étude (date, échantillon) | Résultat | Source |
|---|---|---|
| Sprout Social Q1 2026 Pulse Survey (5 au 9 février 2026, 2 250 utilisateurs US, UK, Australie, via Glimpse) | 56 % voient du AI slop souvent ou très souvent, 83 % au moins parfois. 50 % des Gen Z, 44 % des millennials, 38 % des Gen X, 29 % des boomers ont désabonné, coupé ou bloqué une marque ou un créateur dont le contenu « semblait du AI slop ». 66 % se disent plus sélectifs qu'il y a un an. 88 % font moins confiance aux actualités sur les réseaux à cause des outils de génération vidéo. | https://media.sproutsocial.com/uploads/2026/03/Sprout-Social-Q1-2026-Pulse-Survey-Analysis.pdf |
| Même étude | Première chose que les consommateurs voudraient voir les marques arrêter en 2026 : « publier du contenu généré par IA sans étiquette » (28 %), devant l'engagement bait (23 %). Contenu le plus demandé : posts éducatifs sur produits et services (40 %), contenu communautaire (27 %), séries épisodiques (20 %), coulisses (19 %), employés de terrain (16 %) contre dirigeants (9 %). 44 % regarderaient un contenu long si les cinq premières secondes accrochent. | idem |
| Gartner (mars 2026, 307 consommateurs US, publié le 9 juin 2026) | 49 % jugent que la GenAI a dégradé la qualité du contenu disponible ; 57 % chez Gen Z et millennials. Citation de Kate Muhl : l'IA augmente « le volume de médias que les consommateurs rencontrent, mais pas nécessairement la valeur ». | https://www.gartner.com/en/newsroom/press-releases/2026-06-09-gartner-survey-finds-49-of-u-s-consumers-say-genai-has-made-content-quality-worse (page 403 à la lecture automatique ; chiffres confirmés via https://www.cxtoday.com/marketing-sales-technology/gartner-ai-generated-content-quality-marketing-fatigue/) |
| Harris Poll, 4As, Infillion (présenté à Cannes Lions, article du 24 juin 2026) | 78 % : l'IA rend les publicités « moins authentiques » ; 78 % trouvent les marques « cringey » quand elles surutilisent l'IA ; 73 % font moins confiance à une pub qu'ils soupçonnent générée par IA ; 63 % moins enclins à acheter. Taille d'échantillon non précisée dans l'article. | https://www.marketingbrew.com/stories/harris-poll-ai-fatigue-less-trust-ai-generated-ads-cannes-lions |
| Bynder (publié le 1er juin 2026, 2 000 consommateurs UK et US) | Sans étiquette, 56 % trouvent l'article IA plus engageant que celui du rédacteur professionnel ; une fois informés, 52 % se disent moins engagés. 82 % acceptent l'IA « tant que le texte semble écrit par un humain ». Marques utilisant l'IA perçues comme « impersonnelles » (26 %), « paresseuses » (20 %), « sans créativité » (18 %), « innovantes » (17 %). | https://martech.org/consumers-like-ai-content-until-they-know-its-ai/ et https://www.bynder.com/en/press-media/ai-vs-human-made-content-study/ |
| Hookline, 2025 AI in Content Marketing Report (mis à jour 9 juin 2025) | 82,1 % des Américains disent repérer du contenu IA au moins parfois (88,4 % chez les jeunes) ; 40,4 % penseraient moins de bien d'une marque qui l'utilise. | https://www.columnfivemedia.com/new-study-82-1-of-americans-can-spot-ai-generated-content/ |
| Capgemini (2023 à 2025, 10 000 consommateurs) | La confiance dans le contenu créé par IA générative recule de 73 % (2023) à 55 % (2025) selon la synthèse reprise par plusieurs médias ; la page Capgemini 2025 ne donne que la tendance (« baisse par rapport à 2023 »). | https://www.capgemini.com/insights/research-library/ai-and-consumers-2025/ |
| Sprout Social, State of Social Media 2026 | 84 % s'inquiètent des deepfakes ; 38 % disent que l'IA les rend plus sceptiques envers les pubs en général ; 33 % citent l'originalité comme moteur de fidélité (deuxième après la qualité, 44 %) ; 85 % attendent des contenus culturellement pertinents. | https://sproutsocial.com/insights/the-state-of-social-media/ |

### 2.2 L'« emotional tax » de l'étiquette IA

Deux études académiques de 2026 confirment un effet d'aversion robuste : un article de l'International Journal of Human-Computer Interaction (expérience en deux vagues, 400 puis 256 participants) mesure une « taxe émotionnelle » quand un contenu vrai est étiqueté IA ; une étude Nature Communications Psychology montre que des interlocuteurs IA créent plus de proximité que des humains, mais uniquement quand ils sont étiquetés humains. Conséquence pour la machine : l'étiquette est obligatoire sur les visuels réalistes (section 3), donc la seule façon d'éviter la taxe est de ne pas rendre l'étiquette nécessaire sur les contenus émotionnels (vrais visages, vraies voix, vrais lieux) et de réserver l'IA aux contenus utilitaires (infographies, montages, animations typographiques).
Source : https://www.tandfonline.com/doi/full/10.1080/10447318.2026.2618553
Source : https://www.nature.com/articles/s44271-025-00391-7

### 2.3 Baisse générale de l'engagement

Socialinsider (35 millions de posts Instagram, 447 613 pages, janvier à décembre 2025, publié comme « 2026 ») : taux d'engagement moyen Instagram 0,48 %, en baisse de 24 % sur un an. Carrousels 0,50 % au T2 2026, Reels 0,48 %, images 0,33 % (baisse de 17 % sur un an pour les images). Les carrousels dominent les enregistrements (98 par post pour les comptes de 100 000 à 1 million d'abonnés contre 43 pour les images). Sur 70 millions de posts toutes plateformes : TikTok 2,60 % (baisse de 10 %), Facebook 0,15 %, X 0,10 % ; mais les partages progressent partout : +45 % sur TikTok (248 par post), +12 % sur Instagram (45 par post), +30 % sur Facebook (17 par post).
Source : https://www.socialinsider.io/social-media-benchmarks/instagram
Source : https://www.socialinsider.io/social-media-benchmarks

Lecture pour José : l'engagement « passif » (likes) s'effondre, les signaux « actifs » (partages, enregistrements) montent. La preuve de qualité se mesure donc sur les envois et enregistrements, pas sur les likes.

### 2.4 Le cas particulier des marchés de José

Les études ci-dessus sont américaines, britanniques et australiennes. Pour la Côte d'Ivoire, les données disponibles sont moins solides : I am Beezy (10 mars 2026, sans sources externes citées) avance 10,5 millions d'utilisateurs actifs des réseaux sociaux en Côte d'Ivoire, une confiance trois fois supérieure aux témoignages vidéo de vrais clients par rapport aux publicités, un coût de 15 000 à 500 000 FCFA par contenu de créateur UGC selon le profil. Systalink affirme que les contenus en nouchi, en dioula ou mêlant français et expressions locales génèrent 2,5 fois plus d'engagement que le français formel. Ces chiffres sont à traiter comme des ordres de grandeur, pas comme des mesures.
Source : https://blog.iambeezy.app/fr/contenu-ugc-createur-cote-divoire-marques-marketing-2026/
Source : https://systalink.com/reseaux-sociaux-en-afrique/

## 3. Ce que les plateformes et la loi imposent en 2026

| Plateforme ou texte | Règle | Date | Source |
|---|---|---|---|
| YouTube, politique « contenu inauthentique » | Renommage de « contenu répétitif » en « contenu inauthentique » ; cible le contenu « produit en masse », les « récits avec des différences superficielles », les diaporamas à narration identique. Les chaînes utilisant l'IA restent monétisables si elles ajoutent une vision créative. | 15 juillet 2025 | https://www.socialmediatoday.com/news/youtube-clarifies-monetization-update-inauthentic-repeated-content/752892/ |
| YouTube, clarification | Trois catégories non monétisables : (1) contenu « qui a l'air fait avec un gabarit, ou qui peut sembler répétitif » ; (2) contenu reposant sur des « formules émotionnellement manipulatrices » ou conçu pour choquer ; (3) personas IA se présentant comme experts humains en santé, droit, finance, politique. Les chaînes avec « des quantités excessives » de ces contenus sortent du Partner Program. | 13 au 16 juillet 2026 | https://www.tubefilter.com/2026/07/13/youtube-inauthentic-content-monetization-policy-update/ et https://techcrunch.com/2026/07/20/youtube-clarifies-policies-around-ai-slop-and-upsetting-videos/ |
| Meta (Facebook, Instagram, Threads) | Étiquette « AI Info » appliquée quand Meta détecte des indicateurs standard (C2PA, IPTC) ou quand le créateur déclare. Déploiement large depuis mai 2024. | mai 2024 | https://transparency.meta.com/governance/tracking-impact/labeling-ai-content |
| Instagram, profils IA | Étiquette « AI creator » renommée « AI-generated profile » ; portée réduite pour les profils de personnes générées par IA non étiquetés ; pas d'étiquette requise pour la retouche photo, la réécriture de légendes, la création de graphiques. | 31 août 2026 | https://techcrunch.com/2026/08/31/instagram-puts-new-limits-on-undisclosed-ai-profiles/ |
| TikTok | Étiquette « AI-generated » obligatoire pour visages synthétiques, voix clonées, décors IA, produits photoréalistes ; détection automatique via C2PA depuis janvier 2025, étiquette non retirable ; l'activation volontaire « n'affecte pas la distribution » selon le support TikTok. Scripts et hashtags assistés par IA exemptés. | 2025-2026 | https://storrito.com/resources/tiktoks-2026-ai-labeling-rules-and-what-they-signal-for-platform-governance/ |
| UE, AI Act article 50 | Depuis le 2 août 2026 : marquage lisible par machine obligatoire des sorties synthétiques par les fournisseurs ; étiquetage des deepfakes ; textes IA publiés pour informer le public à étiqueter sauf relecture humaine avec responsabilité éditoriale. Amendes jusqu'à 15 millions d'euros ou 3 % du chiffre d'affaires mondial. Systèmes antérieurs : délai au 2 décembre 2026. | 2 août 2026 | https://blog.peterkapartners.com/article-50-of-the-ai-act-in-practice-transparency-of-ai-systems-content-labeling-and-deepfakes/ |
| Google, images Gemini (Nano Banana, Nano Banana Pro) | « Toutes les images générées incluent un filigrane SynthID ». | documentation en vigueur | https://ai.google.dev/gemini-api/docs/image-generation |

Conséquence directe : toute image Gemini (que José utilise pour les miniatures) est marquée SynthID, donc susceptible d'être étiquetée « AI Info » sur Meta et « AI-generated » sur TikTok. Idem pour les sorties Higgsfield si elles embarquent du C2PA (non vérifié, voir incertitudes). La machine doit donc décider, contenu par contenu, si l'étiquette est acceptable (infographie, animation) ou si un asset réel est indispensable (visage, témoignage, produit en main).

## 4. Ce que les algorithmes récompensent : envois, enregistrements, premières secondes

- Instagram (guide créateurs, juillet 2026, repris par Social Media Today) : « Si les enregistrements sont élevés mais les partages faibles, le contenu est peut-être utile mais pas assez partageable. » Instagram Insights expose « sends per reach » et « saves per reach ». Les contenus avec filigrane d'une autre plateforme et les reposts sont dépriorisés (Later, mis à jour 21 avril 2026). Les « Trial Reels » permettent de tester un contenu auprès de non-abonnés avant de l'exposer à la communauté.
  Source : https://www.socialmediatoday.com/news/instagram-shares-tips-on-video-creation/827172/
  Source : https://later.com/blog/how-instagram-algorithm-works/
- Attention aux chiffres qui circulent (« un envoi vaut 15 likes », « 3 à 5 fois plus de portée ») : ils proviennent de blogs d'outils tiers, pas de Meta. Socialync précise lui-même qu'il n'existe pas de citation exacte de Mosseri avec ces multiplicateurs.
  Source : https://www.socialync.io/blog/adam-mosseri-shares-instagram-algorithm-2026
- Rétention des trois premières secondes : les sources sectorielles (Segwise, Hypenest, Greenfrog Labs, 2026) convergent sur des seuils d'usage : 20 à 25 % de rétention à 3 s en moyenne sur Meta, 30 % et plus est bon ; 25 à 32 % sur TikTok, 40 % et plus est bon. VidMob (rapport 2025) : les hooks visuels « incomplets » (une action qui commence sans se finir) retiennent 2,4 fois plus à 3 secondes que les hooks à texte superposé. Ces chiffres ne sont pas des données officielles de plateforme.
  Source : https://segwise.ai/blog/video-ad-hooks-drive-conversions
  Source : https://greenfroglabs.com/blog/video-hooks-scroll-stopping-2026
- UGC contre contenu de marque : les benchmarks 2026 (Billo, Finsi, Reloop) donnent des CTR de 1,8 à 2,4 % pour du contenu créateur sur TikTok contre 0,6 à 0,9 % pour du contenu produit par la marque ; Superscale (2 janvier 2026) mesure une authenticité perçue de 81/100 pour l'UGC humain contre 63/100 pour l'UGC IA, l'écart tombant à 5 points quand l'IA est déclarée franchement. Les verticales de confiance (santé, finance, communauté) restent dominées par l'humain.
  Source : https://superscale.ai/learn/ai-vs-traditional-ugc-complete-comparison/
  Source : https://billo.app/blog/ugc-statistics/

## 5. Modéliser la voix de marque : fiche de voix mesurable, pas adjectifs

### 5.1 Méthode d'extraction (convergence des guides 2026)

Trois sources convergent (Digital Applied, 2 août 2026 ; CXL ; Search Engine Land) sur une méthode en quatre temps :

1. Constituer un corpus de référence : uniquement des textes publiés et validés par le client (les 5 à 20 meilleurs posts, page « à propos » du site, mails de la fondatrice, réponses aux commentaires). Exclure les brouillons IA, les posts d'agences précédentes, les invités.
2. Mesurer des grandeurs calculables : distribution de longueur de phrases (moyenne et variance), rythme des paragraphes, diversité lexicale (MTLD plutôt que type-token ratio brut), ratio « hedges » / « boosters » pour 100 mots, personne et temps dominants, motifs d'ouverture et de clôture, constructions jamais employées.
3. Convertir en règles mécaniques et vérifiables, pas en adjectifs. « Conversationnel mais professionnel » ne produit rien ; « ouvrir par le résultat, jamais par le contexte ; une idée par paragraphe ; maximum deux phrases par paragraphe quand on veut insister ; jamais de question rhétorique en ouverture » produit une différence mesurable.
4. Test d'acceptation en aveugle : mélanger des textes générés avec de vrais textes du client et demander à deux relecteurs de les trier. « S'ils battent le hasard confortablement, la fiche n'est pas finie. »

Source : https://www.digitalapplied.com/blog/extract-brand-voice-guide-ai-content-2026
Source : https://cxl.com/blog/llm-tone-of-voice/
Source : https://searchengineland.com/guide/how-to-train-in-house-llms-on-brand-voice

### 5.2 Structure de la fiche de voix (par client, stockée en base)

| Bloc | Contenu | Exemple SEVARTA (à valider par José) |
|---|---|---|
| Identité | Qui parle (la maison, la fondatrice, un auteur), à qui, pourquoi | « SEVARTA parle aux lecteurs chrétiens francophones d'Afrique de l'Ouest et de la diaspora, en éditeur qui a lu le livre, pas en vendeur » |
| Valeurs nommées (3 maximum) | Chaque valeur suivie de règles | « Fidélité à la Parole : citer le verset avec la référence exacte, jamais de paraphrase inventée » |
| Règles mécaniques | Longueur de phrase cible, paragraphe, personne, temps, ponctuation | « Phrases de 8 à 18 mots, une longue suivie d'une courte ; tutoiement interdit ; pas de point d'exclamation en série » |
| Lexique autorisé | 30 à 50 mots et tournures signature tirés du corpus | « édition », « témoignage », « cheminement » |
| Interdits lexicaux | Mots IA, jargon, anglicismes selon le client | voir 5.3 |
| Preuves attendues | Type d'ancrage obligatoire par post | « un extrait réel du livre, le nom de l'auteur, la date de parution, le prix en FCFA et en euros » |
| Exemples « avant / après » | 5 paires : brouillon plat / version voix | tirés des corrections du gestionnaire |
| Meilleurs posts | 10 posts avec leurs métriques (envois, enregistrements) | alimentés automatiquement par la mesure |

### 5.3 Interdits lexicaux : la liste française à construire

Les listes publiées (GPTZero, Plus AI, Alston Antony, 2026) sont anglaises : « delve », « tapestry », « testament », « landscape », « navigate », « pivotal », « it's worth noting », les listes de trois dont le troisième élément est abstrait. GPTZero indique que ce vocabulaire apparaît 2 à 182 fois plus souvent dans les textes machine. Aucune liste française de référence n'a été trouvée dans cette recherche. La machine doit donc construire la sienne par comparaison statistique : fréquence des mots dans 500 brouillons IA non corrigés contre fréquence dans le corpus validé des clients. Candidats évidents en français : « plongeons », « explorons », « dans un monde où », « il est essentiel de », « n'hésitez pas à », « révolutionner », « booster », « au cœur de », « que vous soyez… ou… », les triplets adjectivaux, l'emoji en tête de chaque ligne, le hashtag en rafale.
Source : https://chatgptzero-ai.com/blog/gpt-zero-explained
Source : https://plusai.com/blog/the-most-overused-chatgpt-words/

### 5.4 Prompt type d'extraction de voix (à exécuter une fois par client, puis à chaque trimestre)

```
Tu es analyste de style. Voici 15 textes publiés et validés par le client {nom} (posts, page À propos, réponses aux commentaires), avec pour chacun ses métriques (portée, envois, enregistrements).
Tâche : produire une FICHE DE VOIX au format JSON strict avec les champs :
- longueur_phrases: {moyenne, ecart_type, min, max} calculés sur le corpus
- paragraphes: {phrases_par_paragraphe_moyen, motif_rythme}
- personne_et_temps: pronoms dominants, temps dominants, avec fréquences
- ouvertures: 5 motifs d'ouverture observés, cités mot pour mot
- clotures_et_cta: 5 motifs de clôture ou d'appel à l'action, cités mot pour mot
- lexique_signature: 40 mots ou tournures présents dans au moins 3 textes
- interdits: constructions absentes du corpus mais fréquentes dans les textes IA (liste fournie ci-dessous) 
- preuves: types de faits concrets cités (produits, prix, dates, lieux, noms, versets, chiffres)
- regles: 12 règles mécaniques vérifiables oui/non, dérivées des mesures
Contraintes : ne pas utiliser d'adjectifs de ton (« chaleureux », « dynamique ») ; chaque règle doit être testable par un relecteur en moins de 10 secondes ; citer le texte source de chaque règle par son identifiant.
```

### 5.5 Fine-tuning, RAG ou prompting ?

Les retours d'expérience 2026 (Dev.to, « I fine-tuned an LLM for a client, then told them not to use it » ; cadres de décision Medium et Substack) convergent : pour la voix, garder le modèle de base, mettre les faits dans un index récupérable (RAG) pour pouvoir les mettre à jour, et porter la voix par la fiche plus 5 à 10 exemples « few-shot » dans le prompt système. Le fine-tuning a donné une voix légèrement meilleure mais a coûté la mise à jour des faits et la gouvernance. Pour une agence à six verticales et des clients qui changent, le couple fiche de voix + exemples récupérés par similarité est le bon compromis. Les coûts de prompt sont contenus par le cache de prompt (lecture de cache facturée 10 % du tarif d'entrée sur la plupart des modèles Claude, selon les comparatifs de prix 2026).
Source : https://dev.to/zaffar/i-fine-tuned-an-llm-for-a-client-then-told-them-not-to-use-it-36pi
Source : https://www.kunalganglani.com/blog/fine-tuning-vs-rag-prompt-engineering
Source : https://www.finout.io/blog/anthropic-api-pricing

## 6. Ancrage dans le réel : le client dépose 5 photos, la machine fait 20 contenus

### 6.1 La banque d'assets authentiques, pièce centrale

Tout ce que les études de la section 2 réclament (« vrais visages, vraies dates, vraies citations ») suppose que la machine ait accès à des assets vrais. La banque d'assets par client doit contenir, avec métadonnées exploitables :

| Type d'asset | Métadonnées obligatoires | Usage dans la machine |
|---|---|---|
| Photos produits (fond neutre et en situation) | nom exact, référence, prix FCFA et devise secondaire, date d'ajout, droits | incrustation dans visuels IA, carrousels, fiches |
| Photos de l'équipe et de la fondatrice, avec consentement daté | nom, rôle, autorisation d'usage, date | contenus « coulisses », « employés de terrain » (16 % de demande, Sprout 2026) |
| Vidéos brutes du client (téléphone) | lieu, date, personnes, transcription auto | découpage en clips, b-roll réel sous voix off |
| Témoignages clients (texte, audio, vidéo) | prénom, ville, autorisation, date | preuve sociale, hooks « citation » |
| Sermons YouTube (églises), chapitres (SEVARTA), cours (2IAE) | transcription, timecodes, références | clips, citations exactes, carrousels |
| Site web du client (crawl hebdomadaire) | pages produits, actualités, événements | détection de nouveautés non exploitées |
| Événements régionaux (association culturelle) | date, lieu, intervenants | calendrier, veille |

Règle de production : chaque contenu généré doit référencer au moins un asset réel par son identifiant (champ `asset_ids` en base). Un contenu sans asset réel est marqué « générique » et ne peut pas atteindre la planche client sans justification (par exemple une infographie éducative).

### 6.2 Faits vérifiables et contrôle anti-hallucination

Le juge (section 8) vérifie que chaque fait cité (prix, date, nom, verset, horaire) correspond à une entrée de la base ou du crawl du site. Les faits non retrouvés sont surlignés dans la planche pour validation du client. Cette vérification est d'autant plus nécessaire que les textes IA « polis » échappent largement aux détecteurs (Pangram annonce 73 % de justesse seulement sur les textes humains retouchés par IA, et sa confiance tombe « d'environ 95 % sur l'IA pure à environ 55 % sur le contenu fortement paraphrasé »), ce qui veut dire que personne ne détectera un prix faux à la place du client.
Source : https://hackceleration.com/labs/review/pangram

### 6.3 Le ratio humain / IA par type de contenu

| Type de contenu | Part humaine minimale | Part IA | Étiquette attendue |
|---|---|---|---|
| Témoignage, visage, voix | 100 % réel (asset client) | montage, sous-titres, titrage | non requise |
| Produit en situation | photo réelle du produit | décor, lumière, variations de cadrage | selon plateforme (produit photoréaliste IA sur TikTok : oui) |
| Infographie, carrousel éducatif | faits réels vérifiés | mise en page, illustrations | généralement non requise (graphiques exemptés chez Instagram) |
| Clip de sermon | 100 % réel | découpe, titrage, b-roll animé | non requise |
| Animation typographique, motion design | texte validé | 100 % IA ou Claude Design | non requise sauf visage synthétique |
| Vidéo IA « cinéma » (Seedance) | produit réel en référence, voix humaine | images | oui (scènes réalistes) |

## 7. Hooks testés, variantes et expérimentation légère

### 7.1 Génération de variantes

Pour chaque idée, la machine produit 3 à 5 hooks selon des familles distinctes (question directe, chiffre, contradiction, « avant / après », citation réelle du client, action visuelle incomplète), et non 5 reformulations du même hook. Les guides 2026 recommandent de publier une variante par jour à la même heure et de comparer les courbes de rétention à 1 s et 3 s après 24 heures. Sur Instagram, les Trial Reels permettent de tester auprès de non-abonnés sans exposer la communauté.
Source : https://hypenest.ai/blogs/tiktok-algorithm-2026-video-hooks-retention

### 7.2 Bandit à petits volumes : prudent mais utile

Thompson Sampling (tutoriel de référence, Russo et al.) maintient une distribution de probabilité par « bras » (ici : famille de hook, format, heure, pilier) et tire au sort proportionnellement à la probabilité d'être le meilleur. Braze positionne le bandit comme « adaptation » là où le test A/B est « validation ». Aucune des sources consultées ne donne de seuil minimal de volume ; avec des pages de 1 000 à 20 000 abonnés et 12 à 20 posts par mois, un bandit par client n'aura pas de signal statistique fiable avant plusieurs mois. Recommandation : un bandit au niveau de la verticale (toutes les églises, toutes les marques beauté) avec un contexte client, récompense = envois par portée + enregistrements par portée (pondérés), exploration forcée de 20 % pour ne pas figer les formats, et affichage au gestionnaire des probabilités plutôt que décision automatique.
Source : https://arxiv.org/pdf/1707.02038
Source : https://www.braze.com/resources/articles/multi-armed-bandit

## 8. Rubriques d'évaluation : le juge LLM

### 8.1 Ce que dit la recherche 2026 sur les juges

- Les rubriques doivent être concrètes et testables (oui/non), pas des étiquettes de qualité vagues ; les méta-juges évaluent les rubriques elles-mêmes sur correction, spécificité, couverture (EACL 2026 Findings ; arXiv 2605.30568).
  Source : https://aclanthology.org/2026.findings-eacl.335.pdf
  Source : https://arxiv.org/html/2605.30568v1
- Avertissement important : un article accepté à EMNLP 2026 (soumis le 31 août 2026) montre que des classifieurs entraînés uniquement sur le texte de la rubrique, sans voir la réponse, prédisent en partie la note du juge ; les juges « ne réajustent pas de façon fiable » quand on inverse la réponse ou le critère. Il faut donc tester la rubrique par contre-exemples (un post volontairement mauvais doit obtenir une note basse).
  Source : https://arxiv.org/abs/2609.02942
- Biais mesurés (synthèse Future AGI, 24 mars 2026, mise à jour 20 mai 2026, citant Zheng 2024 et Wang 2023) : position (10 à 15 points d'écart en comparaison par paires), verbosité (15 à 30 points en faveur des textes longs), auto-préférence (10 à 25 points quand le juge note sa propre famille de modèles), format (5 à 15 points), dérive à chaque changement de version (3 à 8 points). Mitigations : ordre aléatoire et moyenne des deux ordres, rubrique neutre en longueur, juge d'une autre famille que le générateur, contrat de juge figé (modèle, version de rubrique, hash du prompt), recalibration mensuelle sur 100 à 300 exemples notés par des humains, kappa de Cohen d'au moins 0,6 pour des rubriques marketing (0,85 pour les contextes à enjeu).
  Source : https://futureagi.com/blog/evaluating-llm-judge-bias-mitigation-2026/

### 8.2 Rubrique « anti-plat » à sept critères (score 0 à 3 chacun, 21 au total)

| Critère | 0 | 3 | Vérification |
|---|---|---|---|
| Spécificité | aucun fait propre au client | au moins 3 faits vérifiables (produit, prix, date, lieu, nom, citation) tous retrouvés en base | liste des faits avec `asset_id` ou URL source |
| Originalité | pourrait être publié par n'importe quel concurrent en changeant le logo | angle, exemple ou formulation introuvables dans les 200 derniers posts de la verticale | test de substitution : remplacer le nom du client par un concurrent ; si le post tient, note 0 |
| Voix | viole au moins 3 règles de la fiche | respecte toutes les règles mécaniques, aucun interdit lexical | compteur de règles violées |
| Hook | ouverture générique (« Saviez-vous que… ») | promesse concrète en moins de 8 mots, ou action visuelle incomplète pour la vidéo | longueur et famille du hook |
| Appel à l'action | absent ou « n'hésitez pas à » | une seule action, mesurable, cohérente avec le pilier (valeur 60 / relation 25 / promo 15) | présence et type |
| Ancrage réel | aucun asset client | au moins un asset réel (photo, vidéo, témoignage) référencé | `asset_ids` non vide |
| Conformité | mention trompeuse, revendication non prouvée, verset mal cité, musique non licenciée, étiquette IA manquante | tout vérifié | checklist section 10 |

Seuil proposé : un contenu passe à la planche client s'il obtient au moins 15/21 et au moins 2 sur Spécificité, Voix et Conformité. Les notes sont stockées avec la version de la rubrique.

### 8.3 Prompt d'évaluation type

```
Rôle : juge éditorial pour l'agence. Tu ne réécris pas, tu notes.
Entrées : (1) FICHE DE VOIX du client {json} ; (2) BASE DE FAITS du client {json : produits, prix, dates, personnes, citations, assets} ; (3) les 200 derniers posts de la verticale {liste résumée} ; (4) le CONTENU À NOTER {texte, légende, hook, cta, asset_ids, format, plateforme, pilier}.
Pour chaque critère (specificite, originalite, voix, hook, cta, ancrage, conformite) :
- donne une note entière 0 à 3,
- cite la ou les phrases exactes qui justifient la note,
- pour specificite : liste chaque fait et indique s'il est retrouvé dans la BASE DE FAITS (oui/non) ; tout fait non retrouvé plafonne la note à 1,
- pour originalite : exécute le test de substitution et dis si le post resterait vrai pour un concurrent,
- pour voix : liste les règles violées par leur identifiant,
- pour conformite : vérifie étiquette IA requise, droit à l'image, revendication produit, référence biblique exacte, prix cohérent.
Règles : ne favorise pas les textes longs ; note indépendamment de l'ordre des entrées ; si une information manque, dis « non vérifiable » plutôt que de supposer.
Sortie : JSON {notes, justifications, faits_verifies, regles_violees, decision: "planche" | "retour_generation" | "revue_humaine", raisons}.
```

### 8.4 Calibration et contrôle du juge

1. Jeu de calibration : 100 posts par verticale notés par José ou le gestionnaire (une heure par verticale environ). Mesurer le kappa entre juge et humain par critère ; viser au moins 0,6 ; en dessous, réécrire le critère.
2. Contre-exemples : 20 posts volontairement plats et 20 posts avec faits faux doivent sortir « retour_generation ».
3. Juge d'une autre famille que le générateur quand c'est possible (par exemple générer avec un modèle Claude, contre-noter un échantillon avec gpt-4o-mini que José utilise déjà), ou au minimum un second passage Claude avec ordre inversé.
4. Figer le contrat : identifiant de modèle, version de rubrique, hash du prompt, enregistrés avec chaque note. Recalibrer chaque mois et à chaque changement de modèle.

## 9. Tests de rendu visuel par vision LLM

### 9.1 Ce que la documentation Claude permet et interdit

Documentation officielle (platform.claude.com, consultée le 2 octobre 2026) : images JPEG, PNG, GIF, WebP ; jusqu'à 100 images par requête sur les modèles à contexte 200k, 600 sur les autres ; 10 Mo par image ; coût en jetons = ⌈largeur/28⌉ × ⌈hauteur/28⌉ ; une image 1000×1000 coûte 1 296 jetons, soit « environ 1,30 USD pour mille images » avec Claude Haiku 4.5 à 1 USD par million de jetons d'entrée, et « environ 6,48 USD pour mille images » avec Claude Opus 5 à 5 USD par million. Les modèles Claude 4.7 et suivants traitent la haute résolution (long côté 2 576 px, jusqu'à 4 784 jetons), ce qui multiplie le coût par trois environ ; il faut donc redimensionner avant envoi. Limites explicites : Claude « ne peut pas déterminer si une image est générée par IA », ses coordonnées sont approximatives, il peut se tromper sur du texte très petit (moins de 200 px) ou des images pivotées, et il ne nomme pas les personnes. Les métadonnées ne sont pas lues.
Source : https://platform.claude.com/docs/en/build-with-claude/vision

### 9.2 Checklist visuelle automatisable

| Contrôle | Méthode | Décision |
|---|---|---|
| Texte incrusté exact | OCR par vision : comparer au texte validé caractère par caractère (accents, FCFA, dates) | tout écart bloque |
| Logo présent, non déformé, bonne version | comparer à l'asset logo de référence (image 1 : référence, image 2 : rendu) | écart de couleur ou proportion bloque |
| Zones de sécurité | vérifier que texte et logo sont hors des zones d'interface (bas 20 % et droite 15 % des Reels et TikTok, barre de titre) | rendu refusé si chevauchement |
| Produit réel | le produit visible correspond à la photo d'asset (forme, étiquette, couleur) | écart signalé |
| Lisibilité mobile | redimensionner le rendu à 390 px de large et relire le texte | illisible = refus |
| Mains, visages, doigts, typographie fantôme | demander un décompte et une description des anomalies | toute anomalie = refus pour les contenus réalistes |
| Cadrage | sujet principal dans le tiers attendu, pas de coupe de tête | signalement |

Prompt type : « Image 1 : logo de référence. Image 2 : photo du produit de référence. Image 3 : rendu à contrôler. Texte attendu : "{texte}". Vérifie et renvoie en JSON : texte_lu, ecarts_texte, logo_conforme (oui/non, raisons), produit_conforme, anomalies_anatomiques (liste), chevauchement_zones_interface (oui/non), lisibilite_390px (oui/non). Ne suppose rien d'invisible. »

Note : d'après l'étude arXiv 2608.30210 (31 août 2026), les modèles de vision de pointe atteignent 91,9 à 92,8 % de précision pour détecter des portraits générés par IA, mieux que les jeunes adultes (environ 88,5 %), mais leur calibration est mauvaise (critères de décision très dispersés). On ne confie donc pas la détection « ça a l'air IA » au modèle ; on lui confie des contrôles factuels.
Source : https://arxiv.org/abs/2608.30210

## 10. Boucle d'apprentissage et calibration par le gestionnaire

### 10.1 Trois sources de signal

1. Corrections du gestionnaire : chaque modification avant envoi de la planche est enregistrée comme paire (brouillon, version corrigée) avec un motif choisi dans une liste fermée (voix, fait faux, hook faible, trop long, interdit lexical, mauvais pilier, visuel). CXL : « traiter chaque modification manuelle comme une donnée de retour ».
2. Décisions du client sur la planche : accepté, accepté avec modification, refusé, avec motif.
3. Performance réelle à J+2 et J+7 : portée, envois par portée, enregistrements par portée, rétention à 3 s, commentaires, clics, par hook, format, pilier, heure.

### 10.2 Réinjection en mémoire

- Les 10 meilleurs posts du client (par envois + enregistrements par portée) deviennent les exemples few-shot du prompt de génération ; ils tournent chaque mois.
- Les paires de correction deviennent des exemples « avant / après » dans la fiche de voix (5 à 10 maximum, les plus récents).
- Les motifs de refus récurrents deviennent de nouvelles règles mécaniques dans la fiche (après validation de José).
- Facultatif, plus tard : constituer un jeu de préférences (brouillon refusé, version acceptée) pour un éventuel DPO. Les travaux EDM 2025 (« teachers in the loop ») montrent que la collecte peut se faire pendant la correction, sans travail supplémentaire. Ce n'est pas prioritaire tant que le volume est inférieur à quelques milliers de paires.
  Source : https://educationaldatamining.org/EDM2025/proceedings/2025.EDM.short-papers.166/index.html
  Source : https://apxml.com/courses/mlops-for-large-models-llmops/chapter-5-llm-monitoring-observability-maintenance/llm-feedback-loops

### 10.3 Revue mensuelle automatisée

Un rapport par client, généré le premier lundi du mois : top 5 et flop 5 par envois par portée, familles de hooks gagnantes, formats gagnants, écart au mix 60/25/15, taux d'acceptation des planches, délai moyen de validation, faits corrigés. Ce rapport alimente l'itération à 90 jours de la doctrine de José.

## 11. Rendre images et vidéos IA moins « IA » : techniques et limites honnêtes

### 11.1 Images

Techniques convergentes (Pixova, 24 juin 2026 ; Zsky ; Imagera ; Flux-art) :
- Dans le prompt, avant génération : « film grain », « natural skin texture, visible pores », « slight chromatic aberration », lumière directionnelle nommée (« single window light from the left, hard shadow right »), composition asymétrique, référence de pellicule (« Kodak Portra 400 »), environnement précis (fil électrique, panneau, poussière, un objet qui dépasse du cadre). Supprimer « perfect », « masterpiece », « flawless », « 8k ». Pour les modèles à paramètre, baisser le CFG (3,5 à 4 au lieu de 7).
- En post-traitement : grain uniforme à faible opacité (environ 5 % en calque), profil couleur d'appareil, léger vignettage, bruit ISO cohérent avec la lumière.
- Le plus efficace reste la composition d'un vrai produit : photographier le produit du client, détourer (Canva « remove background » disponible via le MCP de José), l'insérer dans le décor IA, puis harmoniser lumière et grain. Nano Banana Pro accepte jusqu'à 6 objets et 5 personnages de référence selon la documentation Google ; les tests tiers signalent des limites sur les petits textes, les petits visages et une cohérence de personnage « pas fiable à 100 % ».
  Source : https://www.pixova.io/blog/how-to-make-ai-images-look-less-like-ai
  Source : https://ai.google.dev/gemini-api/docs/image-generation

### 11.2 Vidéos

- Seedance 2.0 sur Higgsfield : références @character, @style, @motion, @audio ; recommandation Higgsfield de commencer en image-to-video 720p avec une image de référence nette, de face, bien éclairée, 3 à 5 références par génération, prompt cohérent avec les références (une référence rouge et un prompt « bleu » donnent un résultat imprévisible).
  Source : https://higgsfield.ai/blog/generating-with-seedance-2-0
  Source : https://clipdance.ai/blog/ai-video-reference-images-guide
- Voix : remplacer la voix générée par une vraie voix (celle de la fondatrice, du pasteur, de José) ou, à défaut, une voix clonée avec consentement. Réglages ElevenLabs cités par les guides 2026 : stabilité 30 à 40 %, similarité 75 à 80 %, style 15 à 25 %, speaker boost activé, modèle v3 pour la narration, vitesse 0,95 à 1,05, deux ou trois pauses explicites par script de 60 s ; plan Creator à 22 USD par mois pour 100 000 caractères (environ 30 reels). ElevenLabs lui-même rappelle que « le robotique vient presque toujours du script » : phrases courtes, contractions, voix active.
  Source : https://www.michydev.com/elevenlabs-voice-settings/
  Source : https://elevenlabs.io/blog/how-to-make-text-to-speech-sound-less-robotic
- Mélange : alterner plans IA et plans réels du client (b-roll téléphone), sous-titres avec la typographie du client, musique Suno mixée sous une voix humaine, grain et étalonnage identiques sur tous les plans.

### 11.3 Limites honnêtes

1. Les détecteurs humains sont faibles sur la vidéo (24,5 % de détection des vidéos synthétiques de qualité dans les tests contrôlés, 9,5 % des personnes capables de distinguer de façon fiable selon Kapwing 2026), mais les plateformes détectent par métadonnées (SynthID, C2PA) : la question n'est pas « est-ce que ça se voit » mais « est-ce que ça sera étiqueté ».
   Source : https://www.kapwing.com/resources/55-ai-generated-video-statistics-disclosure-detection-and-trust/
2. Masquer délibérément l'origine IA d'un visage ou d'une voix réaliste contrevient aux règles TikTok, Instagram (31 août 2026) et, en Europe, à l'article 50. Le grain sert à la qualité, pas à la dissimulation.
3. Les mains, les textes longs, les logos complexes et les visages de personnes réelles restent les points faibles ; les contenus à forte charge émotionnelle (témoignage, sermon, deuil, naissance) doivent rester 100 % réels.
4. Les chiffres d'« authenticité » et de rétention des blogs d'outils ne sont pas des études indépendantes.

## 12. Métriques pour prouver au client que « c'est à la page »

| Métrique | Définition | Cible proposée (à calibrer par client) | Pourquoi |
|---|---|---|---|
| Délai tendance → publication | heures entre la détection d'une tendance ou d'une nouveauté (crawl du site, veille) et la publication | moins de 72 h pour une nouveauté produit, moins de 48 h pour un événement | répond directement au reproche « tendances non suivies » |
| Taux de nouveautés exploitées | nouveautés détectées sur le site ou déposées par le client, couvertes par au moins un contenu dans les 14 jours | 100 % | « nouveaux produits non mis en avant » |
| Taux de vidéos | part des publications en vidéo (reels, shorts, clips) | 40 à 60 % selon la verticale | « vidéos non exploitées » |
| Taux de réemploi des sermons | sermons YouTube découpés en au moins 3 clips sous 7 jours | 100 % | reproche des églises |
| Taux d'ancrage réel | contenus référençant au moins un asset réel | 80 % et plus | anti-slop |
| Envois par portée, enregistrements par portée | selon Instagram Insights et équivalents | progression mensuelle | signaux que l'algorithme récompense |
| Rétention à 3 s | pour les vidéos | 30 % et plus sur Meta, 40 % et plus sur TikTok | seuils d'usage 2026 |
| Score juge moyen et taux de passage | rubrique 8.2 | 15/21 et plus, taux de retour en génération en baisse | preuve de qualité interne |
| Taux d'acceptation des planches | planches validées sans modification majeure | 70 % et plus | satisfaction client mesurée |
| Mix de piliers | répartition réelle 60/25/15 | écart inférieur à 10 points | doctrine de José |
| Taux d'étiquetage conforme | contenus nécessitant une étiquette IA qui la portent | 100 % | conformité plateformes et loi |

## 13. Checklist de qualité avant publication (fusion des checklists d'agences 2026)

Sources agrégées : SocialBu (checklist agences 2026), Postoria (QC pré-publication), Red Falcon (creative QA), Third Chair (revue juridique), Seeqnc (musique).
Source : https://socialbu.com/blog/social-media-publishing-checklist-for-agencies
Source : https://postoria.io/blog/content-quality-control-pre-publishing-checklists
Source : https://usethirdchair.com/blog/brand-legal-checklist-for-social-content-approvals

1. Orthographe et grammaire en français, accents, typographie (pas de tiret cadratin, espaces insécables avant « : » et « ? » selon la norme choisie par le client).
2. Noms de marque, de produit, de personnes exacts ; prix et devises ; dates et horaires ; lieux.
3. Références bibliques exactes (livre, chapitre, verset, version) pour les églises et SEVARTA.
4. Revendications prouvées (beauté : aucune promesse thérapeutique ; école : chiffres d'insertion sourcés).
5. Droit à l'image daté pour chaque visage ; consentement pour les voix clonées.
6. Musique licenciée pour l'usage commercial (Suno : vérifier le plan et la licence du client).
7. Étiquette IA quand elle est requise (visage, voix, décor réaliste, produit photoréaliste).
8. Texte incrusté lisible à 390 px, hors des zones d'interface ; logo conforme.
9. Alt text et sous-titres présents ; sous-titres relus (les transcriptions automatiques écorchent les noms ivoiriens et les termes religieux).
10. Hashtags : 3 à 5, dont au moins un local ; pas de hashtag générique en rafale.
11. Lien testé ; UTM présent ; page d'atterrissage à jour.
12. Pilier et format conformes au calendrier ; date et heure en heure d'Abidjan et de Toronto selon la cible.
13. Approbation enregistrée (qui, quand, version).

## 14. Incertitudes et points à vérifier

1. Les multiplicateurs « un envoi vaut 15 likes » ou « 3 à 5 fois plus de portée » n'ont pas de source officielle Meta ; seul le principe « sends per reach parmi les signaux les plus importants » est documenté. À vérifier sur le compte Instagram de Mosseri et dans Creators avant d'écrire ces chiffres dans une proposition client.
2. Les seuils de rétention à 3 s (20 à 25 %, 30 %, 40 %) proviennent de blogs d'outils ; ils doivent être recalibrés sur les comptes réels de José dès le premier mois.
3. Le chiffre Capgemini (73 % vers 55 %) est repris de synthèses tierces ; la page Capgemini 2025 consultée ne donne que la tendance. Le PDF complet est à télécharger pour la citation exacte.
4. Les chiffres ivoiriens (10,5 millions d'utilisateurs, engagement 2,5 fois supérieur en nouchi, tarifs UGC) viennent de blogs locaux sans sources citées ; à confronter aux rapports DataReportal 2026 pour la Côte d'Ivoire.
5. Higgsfield et Seedance : la présence ou non de marquage C2PA dans les exports n'a pas été vérifiée. À tester en téléversant un export sur TikTok et Instagram et en observant l'étiquette.
6. Aucune liste publiée d'« interdits lexicaux IA » en français n'a été trouvée ; la liste proposée en 5.3 est une hypothèse de départ à mesurer sur les brouillons réels.
7. Tarifs Claude : la documentation vision cite Haiku 4.5 à 1 USD et Opus 5 à 5 USD par million de jetons d'entrée ; les comparatifs tiers mentionnent Opus 5.5 (22 septembre 2026) à 4 USD d'entrée et 20 USD de sortie et une lecture de cache à 5 à 10 % du tarif. À confirmer sur claude.com/pricing avant chiffrage.
8. Pangram : support de 20 langues annoncé, mais « la précision baisse pour les langues non anglaises » ; ses résultats sur le français ne sont pas publiés. Ne pas l'utiliser comme critère de qualité ; il ne mesure pas l'intérêt du contenu.
9. L'applicabilité de l'article 50 de l'AI Act aux clients de José dépend de l'exposition de contenus à des personnes dans l'UE ; un avis juridique est nécessaire pour SEVARTA (lecteurs en France) et Markel-Tech (Canada). La loi 25 du Québec et les règles canadiennes n'ont pas été étudiées ici.
10. Le juge LLM : les résultats de kappa d'au moins 0,6 et les tailles de jeux de calibration (100 à 300) sont des recommandations de praticiens, pas des normes ; l'étude EMNLP 2026 sur les artefacts de rubrique invite à tester chaque rubrique par contre-exemples avant de s'y fier.
11. Les benchmarks UGC contre IA (CTR 1,8 contre 1,1 %, authenticité 81 contre 63) viennent de prestataires qui vendent l'une ou l'autre solution.
12. Le détail de l'exception Instagram du 31 août 2026 (retouche, légendes, graphiques exemptés) concerne l'étiquette de profil ; l'étiquette « AI Info » par contenu reste pilotée par les métadonnées et la déclaration.

## 15. Implications pour la machine de José

1. Créer une table `fiche_voix` par client, versionnée, avec règles mécaniques, lexique, interdits, exemples avant/après et dix meilleurs posts ; la générer par le prompt 5.4 à partir de 15 textes validés, puis la faire valider par le client sur la première planche. Argument : les guides 2026 convergent sur « règles mesurables, pas adjectifs », et le test en aveugle est le seul critère d'acceptation honnête.
2. Faire de la banque d'assets réels la porte d'entrée du client (« déposez 5 photos, 1 vidéo, 1 témoignage ») et rendre obligatoire le champ `asset_ids` sur chaque contenu ; refuser la planche à tout contenu émotionnel sans asset réel. Argument : c'est la réponse directe aux 56 % de Sprout et aux 78 % de Harris Poll, et c'est ce que les plateformes exemptent d'étiquette.
3. Implémenter le juge à sept critères (8.2) comme étape bloquante avant la planche, avec seuil 15/21, vérification des faits contre la base, test de substitution pour l'originalité, et stockage de la version de rubrique. Argument : un post qui reste vrai pour un concurrent est, par définition, du contenu plat.
4. Calibrer le juge le premier mois : 100 posts notés par José par verticale, kappa par critère, 40 contre-exemples ; recalibrer chaque mois et à chaque changement de modèle. Utiliser gpt-4o-mini (déjà en place) comme second juge d'une autre famille sur un échantillon de 10 %. Argument : biais de position, de verbosité et d'auto-préférence mesurés à 10 à 30 points.
5. Ajouter un contrôle visuel par vision Claude sur chaque rendu avant planche (texte, logo, produit, zones de sécurité, lisibilité 390 px), avec images redimensionnées à 1 000 px de côté pour tenir le coût autour de 1,30 USD pour mille images sur Haiku 4.5. Ne jamais lui demander « est-ce que ça a l'air IA » (non supporté par la documentation).
6. Construire la liste française d'interdits lexicaux par statistique : comparer la fréquence des mots dans 500 brouillons IA bruts contre le corpus validé des clients ; mettre à jour tous les trimestres. Argument : aucune liste française fiable n'existe, et les listes anglaises ne se traduisent pas.
7. Gérer l'étiquetage IA comme une donnée : champ `etiquette_ia_requise` calculé par le juge (visage, voix, décor réaliste, produit photoréaliste), rappel dans la checklist, et choix systématique de l'asset réel pour les contenus émotionnels. Argument : Instagram 31 août 2026, TikTok, article 50 depuis le 2 août 2026, SynthID sur toutes les images Gemini.
8. Pour les églises, produire au moins trois clips par sermon sous sept jours avec texte incrusté relu et référence biblique vérifiée ; ajouter une courte introduction originale (contexte, question) par clip pour échapper au critère « gabarit » de YouTube (16 juillet 2026) et conserver la monétisation.
9. Générer trois à cinq hooks de familles différentes par idée, publier les variantes sur des jours distincts ou en Trial Reels, et mesurer la rétention à 3 s ; nourrir un bandit par verticale (pas par client) avec récompense envois + enregistrements par portée et 20 % d'exploration ; afficher les probabilités au gestionnaire plutôt que décider à sa place.
10. Enregistrer chaque correction du gestionnaire comme paire (brouillon, correction, motif) et chaque décision client sur la planche ; réinjecter les 10 meilleurs posts et les 5 à 10 dernières paires dans le prompt de génération chaque mois. Argument : CXL, « chaque modification manuelle est une donnée de retour ».
11. Rendre les vidéos IA « moins IA » par la méthode, pas par la dissimulation : produit réel en référence Seedance, voix humaine ou clonée avec consentement (réglages 11.2), b-roll réel intercalé, grain et étalonnage uniformes ; documenter l'origine de chaque plan dans la base pour l'étiquetage.
12. Mettre en place le tableau de bord « à la page » (section 12) avec les quatre indicateurs qui répondent nommément aux reproches des anciens clients : délai tendance → publication, taux de nouveautés exploitées, taux de vidéos, taux de sermons réemployés ; l'envoyer au client dans la revue mensuelle.
13. Suivre les envois par portée et les enregistrements par portée comme indicateurs principaux de la couche « indicateurs avancés » de la doctrine, et reléguer les likes en indicateur secondaire. Argument : Socialinsider 2026, +45 % de partages sur TikTok et +12 % sur Instagram pendant que le taux d'engagement global recule de 24 %.
14. Adapter les fiches de voix aux marchés : pour la Côte d'Ivoire, autoriser explicitement le nouchi et les expressions locales dans le lexique signature quand le client le souhaite, et interdire les traductions mot à mot de slogans anglais ; pour Markel-Tech sur LinkedIn, règles de preuve chiffrée et absence de jargon IA.
15. Prévoir dans la planche client une ligne « faits à confirmer » (prix, dates, noms non retrouvés en base) : cela transforme la vérification anti-hallucination en service visible, et donne au client la sensation d'être écouté (« est-ce que ça vous convient, madame ? »).
16. Réserver 20 % du mix à des contenus 100 % humains fournis par le client (coulisses, employés de terrain, fondatrice), que la machine se contente de monter et de sous-titrer ; c'est le contenu le plus demandé par les consommateurs (Sprout 2026 : coulisses 19 %, employés 16 %) et le moins risqué.
17. Tenir un journal de conformité par contenu (étiquette, droit à l'image, musique, approbation) exportable en PDF : il protège l'agence en cas de litige et sert d'argument commercial face aux agences concurrentes qui publient « au feeling ».

## 16. Sources consultées (sélection, toutes ouvertes entre le 1er et le 2 octobre 2026)

- Sprout Social Q1 2026 Pulse Survey Analysis (PDF) : https://media.sproutsocial.com/uploads/2026/03/Sprout-Social-Q1-2026-Pulse-Survey-Analysis.pdf
- Sprout Social, State of Social Media 2026 : https://sproutsocial.com/insights/the-state-of-social-media/
- Gartner, communiqué du 9 juin 2026 : https://www.gartner.com/en/newsroom/press-releases/2026-06-09-gartner-survey-finds-49-of-u-s-consumers-say-genai-has-made-content-quality-worse
- CX Today sur Gartner : https://www.cxtoday.com/marketing-sales-technology/gartner-ai-generated-content-quality-marketing-fatigue/
- Marketing Brew, Harris Poll / 4As / Infillion : https://www.marketingbrew.com/stories/harris-poll-ai-fatigue-less-trust-ai-generated-ads-cannes-lions
- MarTech, étude Bynder : https://martech.org/consumers-like-ai-content-until-they-know-its-ai/
- Bynder, communiqué : https://www.bynder.com/en/press-media/ai-vs-human-made-content-study/
- Column Five, étude Hookline : https://www.columnfivemedia.com/new-study-82-1-of-americans-can-spot-ai-generated-content/
- Capgemini, AI and consumers 2025 : https://www.capgemini.com/insights/research-library/ai-and-consumers-2025/
- Tandfonline, étiquettes IA et effets émotionnels : https://www.tandfonline.com/doi/full/10.1080/10447318.2026.2618553
- Nature Communications Psychology : https://www.nature.com/articles/s44271-025-00391-7
- Socialinsider, Instagram benchmarks : https://www.socialinsider.io/social-media-benchmarks/instagram
- Socialinsider, benchmarks toutes plateformes : https://www.socialinsider.io/social-media-benchmarks
- Social Media Today, YouTube juillet 2025 : https://www.socialmediatoday.com/news/youtube-clarifies-monetization-update-inauthentic-repeated-content/752892/
- Tubefilter, YouTube 13 juillet 2026 : https://www.tubefilter.com/2026/07/13/youtube-inauthentic-content-monetization-policy-update/
- TechCrunch, YouTube 20 juillet 2026 : https://techcrunch.com/2026/07/20/youtube-clarifies-policies-around-ai-slop-and-upsetting-videos/
- Meta Transparency Center, étiquetage IA : https://transparency.meta.com/governance/tracking-impact/labeling-ai-content
- TechCrunch, Instagram 31 août 2026 : https://techcrunch.com/2026/08/31/instagram-puts-new-limits-on-undisclosed-ai-profiles/
- Storrito, règles TikTok 2026 : https://storrito.com/resources/tiktoks-2026-ai-labeling-rules-and-what-they-signal-for-platform-governance/
- Peterka Partners, article 50 AI Act : https://blog.peterkapartners.com/article-50-of-the-ai-act-in-practice-transparency-of-ai-systems-content-labeling-and-deepfakes/
- Later, algorithme Instagram 2026 : https://later.com/blog/how-instagram-algorithm-works/
- Social Media Today, conseils vidéo Instagram : https://www.socialmediatoday.com/news/instagram-shares-tips-on-video-creation/827172/
- Socialync, Mosseri et les partages : https://www.socialync.io/blog/adam-mosseri-shares-instagram-algorithm-2026
- Segwise, hooks vidéo : https://segwise.ai/blog/video-ad-hooks-drive-conversions
- Greenfrog Labs, hooks 2026 : https://greenfroglabs.com/blog/video-hooks-scroll-stopping-2026
- Hypenest, rétention TikTok : https://hypenest.ai/blogs/tiktok-algorithm-2026-video-hooks-retention
- Superscale, UGC IA contre UGC humain : https://superscale.ai/learn/ai-vs-traditional-ugc-complete-comparison/
- Billo, statistiques UGC : https://billo.app/blog/ugc-statistics/
- Digital Applied, extraction de voix : https://www.digitalapplied.com/blog/extract-brand-voice-guide-ai-content-2026
- CXL, LLM tone of voice : https://cxl.com/blog/llm-tone-of-voice/
- Search Engine Land, brand voice : https://searchengineland.com/guide/how-to-train-in-house-llms-on-brand-voice
- GPTZero expliqué : https://chatgptzero-ai.com/blog/gpt-zero-explained
- Plus AI, mots surutilisés : https://plusai.com/blog/the-most-overused-chatgpt-words/
- Dev.to, fine-tuning pour un client : https://dev.to/zaffar/i-fine-tuned-an-llm-for-a-client-then-told-them-not-to-use-it-36pi
- Kunal Ganglani, fine-tuning vs RAG vs prompting : https://www.kunalganglani.com/blog/fine-tuning-vs-rag-prompt-engineering
- Finout, tarifs API Anthropic : https://www.finout.io/blog/anthropic-api-pricing
- Hackceleration, Pangram : https://hackceleration.com/labs/review/pangram
- ACL, rubriques et juges (EACL 2026) : https://aclanthology.org/2026.findings-eacl.335.pdf
- arXiv 2605.30568, rubriques dynamiques : https://arxiv.org/html/2605.30568v1
- arXiv 2609.02942, artefacts de rubrique (EMNLP 2026) : https://arxiv.org/abs/2609.02942
- Future AGI, biais des juges LLM : https://futureagi.com/blog/evaluating-llm-judge-bias-mitigation-2026/
- Russo et al., tutoriel Thompson Sampling : https://arxiv.org/pdf/1707.02038
- Braze, multi-armed bandit : https://www.braze.com/resources/articles/multi-armed-bandit
- Claude Platform Docs, Vision : https://platform.claude.com/docs/en/build-with-claude/vision
- arXiv 2608.30210, VLM et portraits IA : https://arxiv.org/abs/2608.30210
- EDM 2025, DPO avec enseignants : https://educationaldatamining.org/EDM2025/proceedings/2025.EDM.short-papers.166/index.html
- APXML, boucles de feedback LLM : https://apxml.com/courses/mlops-for-large-models-llmops/chapter-5-llm-monitoring-observability-maintenance/llm-feedback-loops
- Pixova, images moins IA : https://www.pixova.io/blog/how-to-make-ai-images-look-less-like-ai
- Google, Gemini image generation : https://ai.google.dev/gemini-api/docs/image-generation
- Higgsfield, tutoriel Seedance 2.0 : https://higgsfield.ai/blog/generating-with-seedance-2-0
- Clipdance, références Seedance : https://clipdance.ai/blog/ai-video-reference-images-guide
- Michydev, réglages ElevenLabs : https://www.michydev.com/elevenlabs-voice-settings/
- ElevenLabs, voix moins robotique : https://elevenlabs.io/blog/how-to-make-text-to-speech-sound-less-robotic
- Kapwing, statistiques vidéo IA : https://www.kapwing.com/resources/55-ai-generated-video-statistics-disclosure-detection-and-trust/
- SocialBu, checklist agences : https://socialbu.com/blog/social-media-publishing-checklist-for-agencies
- Postoria, QC pré-publication : https://postoria.io/blog/content-quality-control-pre-publishing-checklists
- Third Chair, checklist juridique : https://usethirdchair.com/blog/brand-legal-checklist-for-social-content-approvals
- I am Beezy, UGC Côte d'Ivoire : https://blog.iambeezy.app/fr/contenu-ugc-createur-cote-divoire-marques-marketing-2026/
- Systalink, réseaux sociaux en Afrique : https://systalink.com/reseaux-sociaux-en-afrique/
- Value Add VC, attention economy 2026 : https://valueaddvc.com/blog/the-attention-economy-in-2026-is-there-any-value-left-after-ai-saturates-content
