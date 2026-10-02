# R08. Opérations d'agence, expérience client, portail de validation, tarification et cadre juridique

Rapport de recherche pour le projet de « machine » social media multi-clients de José Kouadio (Markel-Tech, SEVARTA, 2IAE). Rédigé le 1er octobre 2026. Chaque prix, limite ou règle est daté ; lorsqu'une page officielle n'a pas pu être ouverte (Cloudflare, captcha, page déplacée), le fait est marqué « à vérifier » et repris dans la section des incertitudes. Ce rapport ne constitue pas un avis juridique : il sert à concevoir le produit et à préparer les questions à poser à un avocat en Ontario, en France et à Abidjan.

## 1. Résumé

1. Les PME ne quittent pas une agence parce qu'elle poste trop peu. Elles partent parce qu'elles ne voient pas le lien entre le travail et leur chiffre d'affaires, parce que l'agence répond lentement, parce que le contenu ignore les tendances et les formats vidéo, et parce que l'arrivée de l'IA leur fait croire que le service devrait coûter moins cher. L'enquête AgencyAnalytics 2026 (494 agences, février à avril 2026) chiffre ces pressions : 55 % des agences entendent chaque mois « pouvez-vous relier la performance au revenu ? », 44 % subissent une demande de délais plus courts, 30 % constatent que le client juge le service « moins précieux » parce qu'il suppose que l'IA réduit les coûts, et 10 % des dirigeants citent déjà le flou d'attribution comme cause de départ, un motif qui « n'existait presque pas un an plus tôt ».
2. Côté audience, la pression vient de la culture et de la vidéo : 90 % des consommateurs utilisent les réseaux pour suivre les tendances (Sprout Social Index 2025), 73 % achètent chez un concurrent si une marque ne répond pas (Sprout), et la vidéo courte est le format au meilleur retour (41 % des marketeurs B2B, LinkedIn 2025). Mais l'IA visible est un risque : près d'un tiers des consommateurs se disent moins enclins à choisir une marque qui utilise des publicités IA (Hootsuite Social Trends 2026) et 46 % sont mal à l'aise avec les influenceurs IA (Sprout 2026). La machine doit donc produire vite, suivre les tendances et rester humaine en apparence et en responsabilité.
3. Le portail de validation est un marché mûr et bon marché : Planable à 33 ou 49 $ par espace de travail et par mois, Kontentino de 49 à 199 € par mois, Gain de 99 à 399 $ par mois pour 6 à 30 espaces clients avec validation par lien magique sans compte, Ziflow et Filestage à 199 et 329 $ par mois pour la relecture de fichiers, Later avec approbation à partir de 37,50 $ par mois, Canva Business à 250 $ US par personne et par an avec approbations. Aucun ne combine planche visuelle hebdomadaire, validation par WhatsApp et production vidéo : c'est la place à prendre.
4. Les tarifs d'agence restent larges : 500 à 5 000 $ US par mois pour une gestion externalisée (WebFX, 2026), 35 à 150 $ de l'heure en freelance, 40 à 150 $ par publication produite. En France, un community manager salarié gagne 1 700 à 3 000 € brut par mois (Hellowork). En Côte d'Ivoire, l'échelle salariale générale va de 148 939 à 599 167 FCFA par mois (Paylab 2026) ; les forfaits d'agence locaux n'ont pas pu être documentés par une source primaire et sont donnés à titre d'estimation.
5. Juridiquement, trois faits structurent le produit : les sorties des moteurs sont librement exploitables commercialement sur les plans payants (OpenAI assigne la sortie à l'utilisateur, Higgsfield « ne revendique aucune propriété » et « ne restreint pas l'usage commercial », Suno et ElevenLabs réservent l'usage commercial aux abonnés payants), mais une image ou une vidéo produite sans apport créatif humain n'a probablement pas d'auteur au sens du droit canadien, français ou OAPI ; l'étiquetage des contenus IA réalistes est devenu obligatoire dans l'Union européenne le 2 août 2026 (article 50 de l'AI Act, code de bonnes pratiques publié le 10 juin 2026) et sur TikTok depuis les règles entrées en vigueur le 24 septembre 2026 ; enfin, chaque relance commerciale par courriel ou WhatsApp exige un consentement traçable (CASL au Canada : jusqu'à 10 millions de dollars par violation pour une entreprise ; politique de messagerie WhatsApp Business du 23 septembre 2026 : opt-in obligatoire et modèles approuvés hors fenêtre de 24 heures).

## 2. Méthode

Le budget de recherche web de la session était épuisé au démarrage de cette mission ; le travail s'est donc fait en ouvrant directement une cinquantaine de pages primaires (pages de prix, conditions d'utilisation, textes officiels, rapports d'enquête), dont une trentaine ont répondu. Les pages bloquées (Legifrance, CRTC, CAI du Québec, Malt, Glassdoor, OpenAI directement, Canva directement) ont été contournées par des copies lisibles quand c'était possible, sinon signalées. Les chiffres des rapports frères (R01 marché, R03 images, R04 vidéo) sont réutilisés pour les unit economics, avec leur source d'origine.

## 3. Pourquoi les PME quittent leur agence, et ce qui les retient

### 3.1 Les causes de départ, chiffrées

| Cause | Donnée | Source et date |
|---|---|---|
| Preuve de résultats absente | 55 % des agences : « relier la performance au revenu » est la question client la plus fréquente de 2026 ; 10 % des dirigeants citent le flou d'attribution comme cause de départ | AgencyAnalytics, enquête de 494 agences, février à avril 2026 |
| Lenteur | 44 % des agences constatent une demande de délais plus courts | AgencyAnalytics 2026 |
| Valeur perçue en baisse à cause de l'IA | 30 % des agences disent que le client juge le service moins précieux « parce qu'il suppose que l'IA devrait réduire les coûts » | AgencyAnalytics 2026 |
| Tendances non suivies | 90 % des consommateurs comptent sur les réseaux pour suivre les tendances et les moments culturels | Sprout Social Index 2025 |
| Réactivité | 73 % des utilisateurs achètent chez un concurrent si la marque ne répond pas | Sprout Social, statistiques 2026 |
| Vidéo non exploitée | la vidéo courte est le format au meilleur retour pour 41 % des marketeurs B2B ; sur Instagram, les Reels sont le format le plus engageant | LinkedIn B2B Benchmark 2025 ; Sprout Content Strategy Report 2026 |
| IA trop visible | près d'un tiers des consommateurs se disent moins enclins à choisir une marque qui utilise des publicités IA ; 46 % mal à l'aise avec les influenceurs IA ; « le contenu humain est la priorité numéro un en 2026 » | Hootsuite Social Trends 2026 ; Sprout Social 2026 |

Source : https://agencyanalytics.com/blog/agency-benchmarks-2026-attribution
Source : https://sproutsocial.com/insights/social-media-statistics/
Source : https://www.hootsuite.com/research/social-trends
Source : https://www.hubspot.com/state-of-marketing

Les causes citées par José (tendances ignorées, vidéos non exploitées, produits non mis en avant, communication plate) recoupent exactement les trois premières lignes. Le quatrième motif, la baisse de valeur perçue à cause de l'IA, est nouveau et piégeux : si la machine est vendue comme « de l'IA », le client attendra un rabais ; si elle est vendue comme « un gestionnaire humain outillé qui livre plus vite, plus de vidéos, et prouve les résultats », elle justifie le prix.

### 3.2 Ce qui retient

Les sources convergent sur quatre leviers : des rapports qui relient l'activité au revenu (demandes de devis, inscriptions, ventes, pas seulement des « j'aime ») ; une cadence visible (le client voit le calendrier, les planches et l'avancement sans demander) ; une réactivité mesurée (délai de réponse aux commentaires et messages) ; et un rituel de revue (mensuel, puis trimestriel) où l'on décide ensemble de ce qu'on arrête et de ce qu'on amplifie. La doctrine déjà écrite par José (mesure en trois couches, revue mensuelle, itération à 90 jours) est alignée sur ces leviers ; il manque l'outillage qui les rend automatiques.

## 4. Portail client : meilleures pratiques

### 4.1 La planche de propositions comme unité de travail

Les outils du marché valident des posts un par un dans un calendrier. Les clients de José (une fondatrice de marque de beauté, un pasteur, un président d'association) ne vont pas ouvrir un calendrier : ils regardent une image sur leur téléphone. La bonne unité est donc la planche hebdomadaire : une seule page visuelle (format 1080×1350 et PDF) avec 6 à 10 propositions, chacune portant une maquette basse définition clairement marquée « maquette », le hook, le format (Reel, carrousel, story, post LinkedIn), la plateforme et la date. Coût de production d'une planche selon R03 : 0,03 à 0,20 $ avec GPT Image 2.5 en qualité basse ou Nano Banana 2 Lite, composition HTML et export PDF par Playwright.

### 4.2 Validation en un tap

Gain, la référence des agences sur ce point, le formule ainsi : « les clients et parties prenantes ne coûtent jamais un siège » et « approuvent via un lien magique sans compte », avec rappels automatiques, annotations et historique horodaté. C'est exactement le mécanisme à reproduire : un lien signé, à durée de vie limitée, qui ouvre une page mobile sans mot de passe, avec deux boutons par proposition (« Oui, lancez », « Non, modifiez ») et un champ de commentaire. Le même lien est envoyé par courriel (Resend) et par WhatsApp (modèle approuvé, voir section 7.9). Un rappel après 48 heures, un second après 5 jours, puis escalade au gestionnaire humain.

Source : https://gainapp.com/pricing

### 4.3 Commentaires sur un visuel, versions et historique

Les outils de relecture (Ziflow, Filestage) montrent le standard : commentaire ancré sur une zone de l'image ou sur un instant de la vidéo, versions numérotées avec comparaison côte à côte, piste d'audit (qui a vu, qui a approuvé, quand). Filestage limite le gratuit à 1 projet actif et 5 fichiers par mois ; Ziflow offre un plan gratuit à 2 utilisateurs, 2 Go et 60 jours d'historique. Pour la machine, le minimum viable est : commentaire par proposition (texte ou vocal WhatsApp transcrit), version n+1 générée automatiquement à partir du commentaire, et conservation de l'historique pendant toute la durée du contrat plus 12 mois (utile en cas de litige, voir section 8).

### 4.4 Calendrier partagé et rapports lisibles

Le calendrier partagé est en lecture seule pour le client, avec trois états par contenu (proposé, validé, publié) et le lien vers la publication réelle. Le rapport mensuel doit tenir sur une page : trois couches (indicateurs avancés, croissance, affaires), cinq chiffres maximum par couche, une phrase de décision par chiffre, et une section « ce que nous avons appris et ce que nous changeons ». Gain et Kontentino vendent des rapports PDF en marque blanche ; Planable facture l'analytique 12 $ par espace et par mois en supplément.

### 4.5 Onboarding

Les portails sérieux demandent au départ : le brand kit (logo, couleurs, polices, ton, mots interdits), les accès aux comptes (par Business Manager Meta et par rôles, jamais par partage de mot de passe), le dépôt de produits et de photos (avec champ « droits : qui est sur la photo, avons-nous le consentement ? »), la liste des interlocuteurs et leur canal préféré (WhatsApp ou courriel), et les règles de validation (qui peut dire oui, en combien de temps, que se passe-t-il sans réponse). Canva Business inclut 100 brand kits et des approbations ; Canva Pro n'en a pas (5 brand kits, pas d'approbation).

Source : https://www.canva.com/pricing/ (lue via copie lisible, prix en dollars US affichés le 1er octobre 2026)

### 4.6 Notifications

Règle d'or observée chez Gain et Later : notifier peu, mais au bon moment. Une notification par planche, un rappel, une escalade. Les commentaires du client déclenchent une notification au gestionnaire, pas l'inverse. Chaque message sortant doit respecter CASL et la politique WhatsApp (section 7.9).

## 5. Outils de validation : comparatif et prix (relevés le 1er octobre 2026)

| Outil | Modèle | Prix | Validation client | Limites notables |
|---|---|---|---|---|
| Planable | par espace de travail | Basic 33 $ (60 posts, approbation « optionnelle »), Pro 49 $ (150 posts, approbation « requise »), Enterprise sur devis (multi-niveaux) ; 50 premiers posts gratuits ; analytics 12 $, inbox 7,50 à 9 $, écoute 82,50 à 99 $ par espace | invités illimités, commentaires contextuels | pas de production média |
| Kontentino | par compte | Starter 49 € (69 € mensuel, 3 utilisateurs, 10 profils, approbation interne seulement), Standard 109 € (149 € mensuel, 10 utilisateurs, 40 profils, approbations clients), Pro 199 € (269 € mensuel, profils illimités), Enterprise sur devis | accès client à partir de Standard | prix en € ou $ selon région |
| Gain | par nombre d'espaces clients | Starter 99 $ (6 espaces, 3 membres), Agency 199 $ (12 espaces, 6 membres), Agency Premium 399 $ (30 espaces, 20 membres), Enterprise sur devis ; 20 % de remise en annuel | lien magique sans compte, relecteurs illimités, rappels, historique horodaté, marque blanche à partir d'Agency | pas de production média |
| Later | par « social set » | Starter 18,75 $ (1 set), Growth 37,50 $ (2 sets, 2 utilisateurs, workflow d'approbation et commentaires externes), Scale 82,50 $ (6 sets, 4 utilisateurs) en annuel | approbation à partir de Growth | pensé pour les créateurs, pas pour les agences |
| Ziflow | par utilisateur créateur | Personal gratuit (2 utilisateurs, 2 Go, 1 étape, 60 jours), Standard 199 $ (15 utilisateurs, 2 étapes), Pro 329 $ (20 utilisateurs, 3 étapes), Enterprise sur devis | relecteurs illimités, versions illimitées, 1 200 types de fichiers | outil de relecture, pas de publication |
| Filestage | par plan | Free 0 $ (1 projet, 5 fichiers par mois), Starter 199 $, Business 329 $ (agents de revue, automatisations), Enterprise sur devis (données en Allemagne) | relecteurs illimités | idem |
| Canva | par personne | Free, Pro 144 $ US par an, Business 250 $ US par personne et par an (approbations, 100 brand kits), Enterprise sur devis | approbations à partir de Business | pas de calendrier multi-clients |

Source : https://planable.io/pricing/
Source : https://www.kontentino.com/pricing
Source : https://gainapp.com/pricing
Source : https://later.com/pricing/
Source : https://www.ziflow.com/pricing
Source : https://filestage.io/pricing/
Source : https://www.canva.com/pricing/

Lecture : pour six clients, Gain Starter coûte 99 $ par mois, Planable Pro 294 $, Kontentino Standard 109 €. Construire son propre portail n'a de sens que si l'on y ajoute ce que ces outils n'ont pas : la planche hebdomadaire, le canal WhatsApp, et la liaison directe avec la production. La fonction « validation » seule vaut 15 à 50 $ par client et par mois sur le marché ; c'est le plafond de ce qu'un client acceptera de payer pour cette brique si elle est facturée séparément.

## 6. Tarification des agences et unit economics

### 6.1 Fourchettes observées

| Marché | Donnée | Source et date |
|---|---|---|
| États-Unis et Canada anglophone (référence) | gestion externalisée 500 à 5 000 $ US par mois ; freelance 35 à 150 $ de l'heure ; création de contenu 40 à 150 $ par publication ; graphisme sur mesure 1 000 à 8 000 $ par mois ; publicité sociale gérée 850 à 2 000 $ par mois ; 25 % des entreprises paient 1 001 à 5 000 $ par mois à une agence | WebFX, données 2026 |
| France | salaire community manager 1 700 à 2 000 € brut par mois en junior, 2 500 à 3 000 € en expérimenté, médiane 2 500 € ; 19 000 à 36 000 € brut par an | Hellowork (page consultée le 1er octobre 2026, non datée) |
| France, freelance | TJM courant de 250 à 450 € selon l'expérience ; forfaits mensuels de 400 à 1 500 € pour 2 à 3 réseaux et 8 à 16 publications | estimation d'usage, les pages Malt et Codeur n'ont pas pu être lues, à vérifier |
| Côte d'Ivoire | échelle salariale générale 148 939 (minimum) à 599 167 FCFA (plus haute moyenne) par mois ; pas d'entrée « community manager » | Paylab 2026 |
| Côte d'Ivoire, agences | forfaits locaux observés dans la pratique de 100 000 à 500 000 FCFA par mois selon le volume, jusqu'à 1 000 000 FCFA avec vidéo ; 1 € = 655,957 FCFA (parité fixe) | estimation, aucune page de prix publique n'a pu être ouverte, à vérifier auprès de trois agences d'Abidjan |
| Canada, fourchette cible en CAD | pour une PME de l'Ontario, 600 à 1 500 CAD par mois pour 2 plateformes et 12 à 16 contenus avec vidéo paraît cohérent avec les fourchettes US converties et avec les salaires locaux | déduction, pas de source canadienne primaire ouverte (helloDarwin 404), à vérifier |

Source : https://www.webfx.com/social-media/pricing/
Source : https://www.hellowork.com/fr-fr/metiers/community-manager.html
Source : https://www.paylab.com/ci/salaryinfo/marketing-advertising-pr/community-manager

### 6.2 Les quatre modèles et leur adéquation

| Modèle | Qui le pratique | Avantage | Risque pour José |
|---|---|---|---|
| Par siège utilisateur | Hootsuite, Sprout, Kontentino | simple | punit l'agence qui a peu de sièges et beaucoup de clients |
| Par espace client | Planable, Gain | aligné sur l'agence | plafonne le prix par client à celui d'un logiciel |
| Par volume de contenus | Predis, Blotato (crédits) | lisible | le client compte les posts, pas les résultats |
| Forfait mensuel par client, tout compris | agences | lisible pour une église ou une PME ivoirienne | exige de maîtriser le coût de production |

Le marché SaaS facture 15 à 50 $ par client et par mois pour l'outil seul (section 5). Une agence facture 500 à 5 000 $ par mois pour le service. La machine se place entre les deux : un forfait par client qui inclut la production, la validation et un gestionnaire humain, avec des paliers par volume (nombre de vidéos et de visuels), et un palier « logiciel seul » pour les clients qui ont déjà un community manager.

### 6.3 Unit economics d'une offre « machine + gestionnaire humain »

Hypothèses de coût unitaire reprises de R03 et R04 (prix API de septembre 2026) : visuel final GPT Image 2.5 ou équivalent 0,05 à 0,20 $ ; contrôle qualité par vision 0,01 $ par image ; clip vidéo de 10 secondes en 720p avec audio 0,50 $ (Veo 3.1 Lite) à 4 $ (Veo 3.1 Standard), soit moins de 15 $ pour une publicité de 30 secondes avec trois prises par plan ; voix française ElevenLabs v3 0,08 $ par 1 000 caractères ; rendu Remotion environ 0,02 $ la minute ; publication 0 $ avec Postiz auto-hébergé ; Higgsfield Ultra 99 à 129 $ par mois partagé entre tous les clients pour les clips « premium » faits à la main.

Palier type « Présence » (12 visuels, 4 vidéos de 15 à 30 s, 2 plateformes) :

| Poste | Coût mensuel par client |
|---|---|
| Visuels, carrousels, planches, QC | 3 à 6 $ |
| Vidéos génératives (4 clips, 3 prises par plan) | 20 à 60 $ |
| LLM (veille, rédaction, légendes, rapport) | 5 à 15 $ |
| Voix, musique, rendu | 3 à 10 $ |
| Part de Higgsfield Ultra et des abonnements mutualisés (sur 8 clients) | 15 à 25 $ |
| Gestionnaire humain : 4 à 6 heures (relecture des planches, échanges, publication supervisée, revue mensuelle) | Canada 160 à 300 CAD à 40 à 50 CAD de l'heure ; Côte d'Ivoire 20 000 à 45 000 FCFA à un salaire de 250 000 à 350 000 FCFA par mois (estimation) |
| Total hors humain | 45 à 115 $ US |

À 900 CAD par mois au Canada, la marge brute dépasse 60 % une fois l'humain payé ; à 250 000 FCFA à Abidjan (environ 380 €), elle reste supérieure à 50 % si le gestionnaire est local et si la part de vidéo générative reste à 4 clips. Deux conclusions : la vidéo générative est le seul poste qui peut faire déraper le coût (chaque prise supplémentaire coûte 1 à 4 $), donc le nombre de prises par plan doit être plafonné et le client doit valider la planche avant toute génération ; et l'humain reste le premier poste, donc tout ce qui réduit son temps (planche propre, validation en un tap, publication automatisée) augmente directement la marge.

## 7. Cadre juridique et politique

### 7.1 Droits d'auteur sur les contenus générés par IA

**Canada.** La loi sur le droit d'auteur n'a pas été modifiée. Le gouvernement a mené une consultation sur « le droit d'auteur à l'ère de l'IA générative », close le 15 janvier 2024, et déclare « continuer d'examiner » la question ; aucun projet de loi n'était adopté au 1er octobre 2026. En l'état, la protection exige un auteur humain exerçant « talent et jugement » (arrêt CCH de 2004) ; une image produite par un prompt court sans intervention ultérieure est très probablement sans auteur, donc sans droit exclusif opposable aux tiers. À l'inverse, un carrousel dont le texte, la structure et la mise en page sont le fait du gestionnaire est protégé.

Source : https://ised-isde.canada.ca/site/strategic-policy-sector/en/marketplace-framework-policy/consultation-copyright-age-generative-artificial-intelligence

**France et Union européenne.** L'originalité se définit comme « la création intellectuelle propre à son auteur » ; le droit français parle d'empreinte de la personnalité. Une sortie purement machinique n'est pas une œuvre ; une sortie retravaillée avec des choix créatifs humains documentés peut l'être. L'AI Act (règlement 2024/1689) ne tranche pas la titularité : il impose la transparence (section 7.6). Le rapport du CSPLA sur l'IA n'a pas pu être relu ; sa position d'origine (2020) était de ne pas créer de droit nouveau, à vérifier.

Source : https://en.wikipedia.org/wiki/Artificial_intelligence_and_copyright

**OAPI et Côte d'Ivoire.** La Côte d'Ivoire est l'un des 17 États membres de l'OAPI ; l'Accord de Bangui révisé le 14 décembre 2015 régit la propriété littéraire et artistique par son annexe VII (certaines annexes en vigueur depuis le 14 novembre 2020). L'annexe VII définit l'auteur comme la personne physique qui crée l'œuvre ; aucune disposition sur l'IA n'a été trouvée. La loi ivoirienne 2016-555 sur le droit d'auteur suit la même logique (à vérifier dans le texte).

Source : https://fr.wikipedia.org/wiki/Organisation_africaine_de_la_propri%C3%A9t%C3%A9_intellectuelle

**Autres repères.** États-Unis : le Copyright Office (rapport de janvier 2025) protège les œuvres « assistées par IA » où l'expression humaine reste visible, pas celles « dont les éléments expressifs sont déterminés par la machine » ; Thaler c. Perlmutter confirmé en appel. Royaume-Uni : l'article 9(3) du CDPA 1988 attribue l'œuvre « générée par ordinateur » à la personne qui a pris les dispositions nécessaires. Chine : le tribunal Internet de Pékin a reconnu un droit sur une image IA le 27 novembre 2023.

Conséquence pratique : la machine ne peut pas promettre au client « vous détenez les droits exclusifs » sur une image brute. Elle peut promettre : « vous avez le droit d'utiliser commercialement tout ce que nous livrons, nous conservons la preuve de l'apport humain, et personne ne peut vous l'interdire ». Le contrat doit le dire ainsi (section 8).

### 7.2 Licences des moteurs (conditions lues le 1er octobre 2026)

| Moteur | Propriété de la sortie | Usage commercial | Conditions notables | Date des conditions |
|---|---|---|---|---|
| OpenAI (ChatGPT, API, gpt-image) | « vous conservez vos droits sur l'Input et possédez l'Output » ; « nous vous cédons tous nos droits, le cas échéant, sur l'Output » | oui | la sortie « peut ne pas être unique » ; interdit de « présenter l'Output comme produit par un humain alors qu'il ne l'est pas » ; interdit d'extraire l'Output de façon automatisée hors API | conditions d'utilisation en vigueur au 1er janvier 2026 (lues via copie lisible) |
| Google (Gemini API, Imagen, Veo) | « Google ne revendiquera pas la propriété » du contenu généré, mais se réserve le droit de générer un contenu similaire pour d'autres | oui, réservé aux usages professionnels ; service payant obligatoire pour servir des utilisateurs de l'EEE, de Suisse et du Royaume-Uni | en gratuit, Google utilise prompts et réponses pour améliorer ses produits ; en payant, non | 23 mars 2026 (page mise à jour le 28 avril 2026) |
| Higgsfield | « la Société ne revendique aucune propriété sur vos Inputs ou Outputs et ne restreint pas votre usage commercial des Outputs » ; droits transférables et sous-licenciables aux clients (section 4.4) | oui | la Société peut entraîner ses modèles sur le contenu sauf client entreprise ; les photos ou vidéos avec visages exigent le consentement des personnes représentées (5.3) ; interdiction de représenter quelqu'un « sans permission » (5.1) | 26 juillet 2026 |
| Suno | Pro et Premier : « Suno vous cède tous ses droits » sur l'Output généré ; Free et Basic : « usage personnel et non commercial uniquement » | oui en payant, avec téléchargement « permis » dont le nombre dépend du palier | interdit de retirer ou masquer l'empreinte, le filigrane ou les métadonnées ; Suno peut dire publiquement qu'un titre vient de Suno | 10 août 2026, en vigueur le 3 septembre 2026 |
| ElevenLabs | licence d'usage | gratuit : « usages non commerciaux seulement » ; payant : usage commercial | clonage de voix réservé aux voix dont on détient l'autorisation ; licence large accordée à ElevenLabs sur la voix fournie | 31 mars 2026 |

Source : https://openai.com/policies/terms-of-use/
Source : https://ai.google.dev/gemini-api/terms
Source : https://higgsfield.ai/terms-of-use-agreement
Source : https://suno.com/terms
Source : https://elevenlabs.io/terms-of-use

Deux points à retenir pour la plateforme : chaque client doit avoir ses médias produits sous un compte payant (jamais le palier gratuit de Suno ou d'ElevenLabs pour un contenu publié), et la machine doit conserver, par média, le moteur, la version, le prompt, la date, le compte utilisé et le plan de ce compte : c'est la preuve de licence en cas de contestation.

### 7.3 Musique sur les réseaux

Meta (Music Guidelines) : « vous restez seul responsable du contenu que vous publiez, y compris la musique » ; « l'utilisation de musique à des fins commerciales ou non personnelles en particulier est interdite sauf licence appropriée » ; plus la densité de musique est élevée, plus le contenu risque d'être bloqué, coupé ou privé de monétisation. Les comptes professionnels n'ont accès qu'au catalogue libre de droits (Sound Collection) pour les Reels, pas aux titres commerciaux disponibles aux comptes personnels (fonctionnement bien établi, page d'aide non ouverte, à vérifier dans l'interface). TikTok : « les entreprises ne peuvent pas utiliser la bibliothèque musicale générale pour un usage commercial » ; la Commercial Music Library compte « 1 million de titres » utilisables en organique, en publicité et en contenu de marque. Suno en plan payant ou ElevenLabs Music (0,15 $ la minute selon R04) sont les voies propres pour une musique originale.

Source : https://www.facebook.com/legal/music_guidelines
Source : https://ads.tiktok.com/help/article/commercial-music-library

### 7.4 Droit à l'image et consentement

**France.** Autorisation écrite nécessaire pour publier l'image d'une personne reconnaissable ; exceptions pour les scènes de foule, les événements publics couverts à titre d'information et les personnes publiques dans leurs fonctions, sans usage commercial. Mineurs : consentement écrit des parents « sans exception ». Sanctions : captation dans un lieu privé sans consentement, 1 an de prison et 45 000 € ; publication sans autorisation, 1 an et 15 000 €. La loi 2024-120 du 19 février 2024 a ajouté au Code civil que les parents protègent ensemble l'image de l'enfant et que le juge peut interdire une publication (texte non relu, à vérifier).

Source : https://www.service-public.gouv.fr/particuliers/vosdroits/F32103

**Québec et Canada.** Au Québec, « personne ne peut utiliser une photo de vous à moins que vous ne lui permettiez de le faire » (Code civil, arrêt Aubry c. Vice-Versa 1998), avec exceptions pour la foule, les personnes publiques et l'intérêt public ; recours en dommages. En Ontario, pas de loi générale sur l'image, mais la LPRPDE encadre la collecte d'images dans une activité commerciale, et la common law reconnaît l'appropriation de personnalité ; une église ou un organisme sans but lucratif n'est en général pas soumis à la LPRPDE sauf activité commerciale.

Source : https://educaloi.qc.ca/capsules/le-droit-a-limage/
Source : https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/

**Côte d'Ivoire.** La loi 2013-450 protège les données personnelles, dont l'image ; l'autorité est l'ARTCI (site dédié autoritedeprotection.ci). Les traitements biométriques exigent une autorisation préalable ; un correspondant à la protection des données peut être désigné, « le responsable de traitement ne pouvant être désigné correspondant ».

Source : https://www.autoritedeprotection.ci/faqdcp/

**Application aux sermons.** Un sermon filmé montre le pasteur (qui consent par contrat), des fidèles (foule : tolérée pour un plan large d'information, pas pour un gros plan réutilisé dans un clip promotionnel) et parfois des enfants (consentement parental écrit indispensable en France, fortement recommandé partout). Règle produit : la machine ne découpe que des plans où seul le prédicateur est identifiable, floute automatiquement les visages du public, exclut tout plan d'enfant, et l'église signe une clause attestant qu'elle a informé l'assemblée de la captation (affichage à l'entrée, annonce) et qu'elle recueille les consentements pour les témoignages individuels.

**Application aux moteurs d'image.** Higgsfield exige le consentement des personnes dont le visage est fourni en référence ; TikTok (règles en vigueur depuis le 24 septembre 2026) interdit le contenu IA trompeur « sur des sujets d'importance publique ou nuisible aux personnes ». Donc : jamais de visage de client, d'auteur ou de fidèle en référence sans consentement signé stocké dans le portail, et jamais de visage de mineur.

### 7.5 Allégations sur les produits de beauté

**Canada.** La ligne cosmétique/médicament est tranchée par la Loi sur les aliments et drogues : un cosmétique « nettoie, améliore ou modifie » l'apparence ; dès qu'il prétend traiter (acné, pellicules, rides par action physiologique, protection solaire), c'est un médicament soumis à licence. Ad Standards fait la préapprobation des publicités cosmétiques diffusées depuis 1992 selon les lignes directrices de Santé Canada ; les allégations acceptables parlent d'« apparence » (réduit l'apparence des rides) et non d'effet structurel. Un formulaire de déclaration de cosmétique doit être déposé dans les 10 jours suivant la première vente (page des lignes directrices non ouverte, délai à vérifier).

Source : https://adstandards.ca/preclearance/cosmetics/
Source : https://www.canada.ca/en/health-canada/services/consumer-product-safety/cosmetics.html

**France et Union européenne.** Le règlement 655/2013 fixe six critères : conformité, véracité, preuves (« éléments adéquats et vérifiables »), sincérité (« les effets allégués ne peuvent excéder les effets démontrés »), équité, et choix en connaissance de cause (« claires et compréhensibles pour le consommateur moyen »). La DGCCRF contrôle les allégations et l'ANSM la sécurité ; la loi du 9 juin 2023 sur les influenceurs impose la mention « publicité » et interdit la promotion de certains actes esthétiques (à vérifier dans le texte). L'obligation de mentionner « photographie retouchée » sur les images commerciales de mannequins dont la silhouette est modifiée (décret de 2017) s'applique potentiellement aux visuels IA de corps (à vérifier).

Source : https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32013R0655

**Meta.** « Les publicités promouvant des produits, procédures ou chirurgies cosmétiques doivent cibler des personnes d'au moins 18 ans » ; interdiction du contenu « impliquant ou tentant de générer une perception négative de soi » pour vendre un produit de santé ou de régime ; restrictions sur les images suggestives. L'interdiction classique des images « avant/après » et des gros plans sur une partie du corps dans les publicités santé relève de la même politique (page détaillée non ouverte, à vérifier).

Source : https://transparency.meta.com/policies/ad-standards/

Règle produit : un lexique d'allégations interdites par pays (« traite », « guérit », « élimine l'acné », « anti-âge » sans « apparence », « SPF » sans licence) et un contrôle automatique par Claude de chaque légende et de chaque texte incrusté avant la planche, avec blocage et explication.

### 7.6 Étiquetage des contenus IA

| Cadre | Obligation | Date |
|---|---|---|
| AI Act (UE), article 50 | les fournisseurs marquent les sorties « dans un format lisible par machine et détectable comme générées ou manipulées artificiellement » ; les déployeurs révèlent les deepfakes et les textes IA publiés « pour informer le public », sauf relecture humaine avec responsabilité éditoriale ; exception limitée pour les œuvres « manifestement artistiques, créatives, satiriques ou fictives » ; information « au plus tard lors de la première interaction ou exposition » | applicable depuis le 2 août 2026 ; code de bonnes pratiques publié le 10 juin 2026, avec icônes standardisées |
| Meta | étiquette « AI info » appliquée sur détection d'indicateurs standard ou sur auto-déclaration ; contenu non déclaré conservé mais étiqueté, rétrogradé s'il est jugé faux ou altéré par les vérificateurs ; déclaration obligatoire dans certaines publicités politiques | depuis mai 2024, ajustée en septembre 2024 |
| TikTok | obligation d'« étiqueter le contenu généré ou significativement modifié par IA qui montre des scènes ou des personnes d'apparence réaliste » ; sinon retrait, restriction ou étiquetage d'office ; interdiction du contenu IA trompeur sur les sujets d'importance publique ou nuisible aux personnes ; interdiction des outils d'automatisation et du faux engagement | règles publiées le 25 août 2026, en vigueur le 24 septembre 2026 |
| YouTube | divulgation obligatoire du contenu réaliste altéré ou synthétique (personne faisant ou disant ce qu'elle n'a pas fait, événement réel modifié, scène réaliste inventée) ; pas de divulgation pour l'animation non réaliste, les miniatures, les scripts, le clonage de sa propre voix ; sanctions : étiquette imposée, retrait, suspension du programme partenaire ; « divulguer ne limite pas l'audience ni la monétisation » | en vigueur |
| OpenAI | interdit de « présenter l'Output comme produit par un humain alors qu'il ne l'est pas » | conditions du 1er janvier 2026 |

Source : https://artificialintelligenceact.eu/article/50/
Source : https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content
Source : https://about.fb.com/news/2024/04/metas-approach-to-labeling-ai-generated-content-and-manipulated-media/
Source : https://r.jina.ai/https://www.tiktok.com/community-guidelines/en/integrity-authenticity
Source : https://support.google.com/youtube/answer/14328491

Conséquence : la machine doit porter, pour chaque média, un drapeau « réaliste ou non » et « personne réelle représentée ou non », conserver les métadonnées C2PA ou le filigrane du moteur (Suno interdit de les retirer), et cocher automatiquement la case de divulgation à la publication quand le drapeau l'exige. Pour les clients français ou visant l'Union européenne, l'étiquetage des deepfakes est une obligation légale depuis le 2 août 2026, pas seulement une règle de plateforme.

### 7.7 Protection des données personnelles

| Régime | Champ | Obligations clés pour la machine | Sanctions |
|---|---|---|---|
| LPRPDE (Canada fédéral) | organisations privées en activité commerciale ; Québec, Alberta et Colombie-Britannique ont des lois « essentiellement similaires » qui s'appliquent à la place | 10 principes (responsabilité, finalités, consentement, limitation, exactitude, mesures de sécurité, transparence, accès, contestation) ; notification des atteintes | non chiffrées sur la page lue |
| Loi 25 (Québec) | entreprises traitant des renseignements de résidents du Québec | responsable de la protection désigné, registre et notification des incidents, politique de confidentialité, consentement, évaluation des facteurs relatifs à la vie privée avant toute communication hors Québec, portabilité depuis septembre 2024 | sanctions administratives et pénales, montants non lus (de mémoire : jusqu'à 10 M$ ou 2 % du chiffre d'affaires mondial en administratif, 25 M$ ou 4 % au pénal, à vérifier) |
| RGPD (UE) | tout organisme établi dans l'UE ou ciblant des résidents de l'UE, « quelle que soit sa taille » | base légale par traitement, registre des traitements, information, droits d'accès et d'effacement, encadrement des transferts hors UE, DPO le cas échéant | jusqu'à 20 M€ ou 4 % du chiffre d'affaires mondial (règlement, non relu ici) |
| Loi 2013-450 (Côte d'Ivoire) | traitements de données personnelles, autorité ARTCI | déclaration ou autorisation selon le traitement, autorisation préalable pour la biométrie et les données sensibles, correspondant à la protection indépendant, registre national des correspondants, audits de conformité en cours en 2025-2026 | peines en FCFA et prison prévues, montants non lus, à vérifier |

Source : https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/
Source : https://www.cai.gouv.qc.ca/entreprises/
Source : https://www.cnil.fr/fr/rgpd-de-quoi-parle-t-on
Source : https://www.autoritedeprotection.ci/

Points sensibles pour la machine : les photos de visages (données personnelles, biométriques si on en extrait un gabarit) ; les listes d'abonnés et de commentateurs lues par l'API Meta (données de plateforme soumises aux Platform Terms, section 7.8) ; l'hébergement sur Railway (région des serveurs à documenter pour la Loi 25 et le RGPD) ; et les sous-traitants IA (OpenAI, Google, Higgsfield, ElevenLabs) qui reçoivent des données, avec, pour Google en gratuit et Higgsfield hors entreprise, un usage pour l'entraînement.

### 7.8 Conditions d'utilisation des plateformes

- Meta Platform Terms (en vigueur depuis le 3 février 2026) : les données de plateforme ne peuvent servir à « construire ou enrichir des profils d'utilisateurs » sans consentement valide, ni à la surveillance ; partage limité aux prestataires ; « nous pouvons exiger que vous soumettiez votre App à notre revue » ; tout changement de fonction impose une nouvelle revue. Publier au nom de plusieurs clients passe par un Business Manager, des Pages et des comptes Instagram professionnels liés, avec les autorisations pages_manage_posts, instagram_content_publish et consorts obtenues par App Review (le processus est détaillé dans R02).
- Instagram : « jusqu'à 10 comptes connectés en même temps » dans l'application ; aucune autre règle sur les comptes multiples sur cette page. Les comptes gérés doivent rester ceux des clients, avec José en rôle d'administrateur ou d'éditeur, jamais des comptes « agence » déguisés.
- LinkedIn : interdiction de tout logiciel qui « utilise des méthodes automatisées pour accéder au service, ajouter ou télécharger des contacts, envoyer ou rediriger des messages », sous peine de restriction ou de fermeture du compte. Publier sur une Page entreprise par l'API officielle (Community Management API, partenaire requis) est le seul chemin propre ; l'automatisation par navigateur sur un profil personnel est à proscrire.
- TikTok : interdiction des « outils d'automatisation » et de tout « service qui gonfle artificiellement l'engagement » (règles du 24 septembre 2026) ; publication par la Content Posting API après audit (voir R02).
- YouTube API : interdit de « télécharger, importer, sauvegarder, mettre en cache ou stocker des copies du contenu audiovisuel YouTube sans l'approbation écrite préalable de YouTube ». Pour découper un sermon, la machine doit recevoir le fichier source de l'église (export de YouTube Studio par le propriétaire de la chaîne, ou fichier de la régie), pas le récupérer par un outil de téléchargement.
- Higgsfield piloté par navigateur (Claude-in-Chrome) : les conditions (5.2 et 5.3) n'interdisent pas explicitement l'automatisation par l'interface, mais prévoient la suspension pour comptes en retard de paiement et encadrent la biométrie ; l'API et le MCP sont le chemin contractuellement sûr.

Source : https://developers.facebook.com/terms/
Source : https://help.instagram.com/1682672155283228
Source : https://www.linkedin.com/help/linkedin/answer/a1341387
Source : https://developers.google.com/youtube/terms/developer-policies

### 7.9 Anti-pourriel et relances (courriel, WhatsApp)

**CASL (Canada).** S'applique à tout message électronique commercial envoyé par ou vers une entreprise canadienne, « courriel, SMS et messagerie instantanée » compris. Consentement exprès ou implicite (relation d'affaires existante, limitée dans le temps : 2 ans après la dernière transaction, 6 mois après une demande de renseignements, selon la loi, durées à vérifier sur la page du CRTC qui n'a pas pu être lue) ; identification de l'expéditeur et mécanisme de désabonnement obligatoires dans chaque message ; sanctions jusqu'à 1 M$ par violation pour une personne et 10 M$ pour une organisation, « chaque infraction constituant une violation distincte » ; droit privé d'action. Les relances de validation adressées à un client sous contrat relèvent de la relation d'affaires (consentement implicite), mais une prospection de nouveaux clients par courriel exige un consentement exprès ou une exception stricte.

Source : https://en.wikipedia.org/wiki/Canada%27s_Anti-Spam_Legislation
Source : https://crtc.gc.ca/eng/internet/anti.htm

**WhatsApp Business Messaging Policy (23 septembre 2026).** « Vous ne pouvez contacter des personnes sur WhatsApp que si (a) elles vous ont donné leur numéro et (b) vous avez reçu une permission d'opt-in » ; en dehors de la fenêtre de 24 heures ouverte par le client, seule l'envoi d'un « modèle de message approuvé » est possible ; les messages marketing sont une catégorie réglementée soumise aux lois locales. CallMeBot, utilisé aujourd'hui par José pour des alertes, n'est pas un canal conforme pour écrire à des clients : il faut un compte WhatsApp Business Platform (via Meta directement ou un fournisseur comme Twilio ou 360dialog) avec des modèles « validation de planche » et « rappel » approuvés.

Source : https://whatsappbusiness.com/policy/

**RGPD et ePrivacy (France).** Prospection B2B tolérée sur adresse professionnelle avec lien de désinscription ; B2C sur consentement. Relances contractuelles sans problème. Les mêmes principes valent en Côte d'Ivoire sous la loi 2013-450.

## 8. Clauses contractuelles et garde-fous produits

### 8.1 Clauses à prévoir dans le contrat client

1. Objet et périmètre : nombre de plateformes, de contenus et de vidéos par mois, langue, délais de production, créneau de publication, ce qui est hors forfait (publicité payante, tournage, gestion de crise).
2. Validation : le client valide la planche hebdomadaire sous 3 jours ouvrés ; sans réponse après deux rappels, l'agence publie les contenus « valeur » et « relation » et retient les contenus « promotion » (ou l'inverse selon le client : à cocher à l'onboarding). Toute validation par lien magique, courriel ou WhatsApp vaut accord écrit.
3. Exactitude des informations fournies : le client garantit la véracité des prix, des dates, des allégations produits et des photos qu'il dépose ; il indemnise l'agence pour toute réclamation née d'une information fausse.
4. Droits sur les éléments fournis : le client garantit détenir les droits sur ses logos, photos, vidéos (dont les sermons), musiques et textes, ainsi que les consentements des personnes représentées ; pour les mineurs, consentement parental écrit déposé dans le portail.
5. Contenus générés par IA : information claire que des images, vidéos, voix et textes sont produits avec des outils d'IA ; licence d'usage commercial illimitée dans le temps et dans l'espace cédée au client sur les livrables ; absence de garantie d'exclusivité ou de protection par le droit d'auteur sur les éléments bruts générés ; engagement de l'agence à conserver la preuve de l'apport humain et des licences de moteurs ; étiquetage IA appliqué selon les règles des plateformes et de la loi, sans que le client puisse l'interdire.
6. Clause « pas de deepfake » : interdiction de représenter une personne réelle (dirigeant, auteur, fidèle, concurrent, personnalité) par IA sans consentement écrit de cette personne ; interdiction des mineurs ; interdiction de cloner une voix sans autorisation signée.
7. Allégations réglementées : pour les produits de beauté, de santé, d'alimentation et les services financiers, le client fournit les preuves ; l'agence peut refuser toute allégation non conforme (Santé Canada, règlement 655/2013, politiques Meta) sans que cela constitue un manquement.
8. Comptes et accès : les comptes restent la propriété du client ; l'agence intervient par rôles (Business Manager, administrateur de Page, éditeur) et ne détient aucun mot de passe ; retrait des accès sous 5 jours après la fin du contrat ; interdiction pour le client de demander des pratiques contraires aux CGU des plateformes (achat d'abonnés, automatisation de messages privés).
9. Données personnelles : rôles (le client est responsable de traitement pour ses abonnés, l'agence sous-traitant) ; liste des sous-traitants IA et hébergeurs avec leur pays ; durée de conservation ; notification des incidents sous 72 heures ; clause spécifique Loi 25 (évaluation avant transfert hors Québec) pour les clients québécois et RGPD pour les clients européens.
10. Musique : uniquement bibliothèques commerciales des plateformes, musique originale générée sous licence payante, ou licence fournie par le client ; aucune utilisation de titres commerciaux grand public sur un compte professionnel.
11. Mesure et rapport : définition des trois couches, rapport mensuel sous 7 jours, revue trimestrielle ; aucune garantie de résultat chiffré (portée, ventes), sauf accord séparé de type performance.
12. Prix et révision : forfait mensuel, paliers par volume, surcoût par prise vidéo supplémentaire au-delà du plafond, révision annuelle, suspension du service après 30 jours d'impayé, préavis de résiliation de 30 jours, propriété des livrables payés.
13. Responsabilité : plafond égal aux honoraires des 3 derniers mois ; exclusion des pertes indirectes ; exclusion des suspensions de comptes décidées par les plateformes sans faute de l'agence.
14. Références et portfolio : droit pour l'agence de citer le client et de montrer les livrables, sauf opposition écrite.
15. Loi applicable et for : Ontario pour Markel-Tech, droit français pour les clients français, droit ivoirien pour les clients d'Abidjan, avec médiation préalable.

### 8.2 Garde-fous à coder dans le produit

1. Registre de provenance par média : moteur, version, prompt, références fournies, compte et plan utilisés, date, drapeaux « réaliste », « personne réelle », « mineur », métadonnées C2PA conservées.
2. Registre de consentements : par personne représentée (nom, pièce signée, portée, durée), lié aux médias ; blocage de toute génération ou publication qui référence un visage sans consentement actif ; exclusion totale des mineurs.
3. Floutage automatique des visages du public dans les clips de sermons ; sélection de plans où seul le prédicateur est identifiable.
4. Lexique d'allégations interdites par pays et par verticale, contrôle de chaque texte (légende, incrustation, voix off) avant la planche, avec motif et proposition de reformulation.
5. Divulgation IA automatique : case cochée à la publication sur Meta, TikTok et YouTube dès qu'un drapeau l'exige ; mention dans la légende pour les clients de l'Union européenne.
6. Musique : seuls les catalogues commerciaux des plateformes ou les pistes générées sous compte payant sont sélectionnables ; vérification du plan du compte avant l'export.
7. Consentement aux messages : opt-in WhatsApp et courriel enregistrés à l'onboarding avec date et preuve ; modèles WhatsApp approuvés ; lien de désinscription dans chaque courriel ; aucune prospection sortante depuis la machine sans liste de consentement exprès.
8. Accès par rôles : OAuth et Business Manager uniquement ; aucun stockage de mot de passe ; révocation en un clic à la fin du contrat ; journal des actions faites au nom du client.
9. Plafonds de coût : nombre de prises vidéo par plan, budget mensuel par client, alerte au gestionnaire à 80 %.
10. Validation humaine obligatoire avant publication pour les contenus « promotion », les verticales réglementées (beauté, santé) et tout média marqué « personne réelle » ; publication automatique possible seulement pour les contenus validés sur planche et sans drapeau.
11. Export complet des données et des livrables du client à la résiliation, et suppression programmée après 12 mois.
12. Rapport mensuel généré avec les trois couches, lisible sur téléphone, avec une section « ce que nous changeons ».

## 9. Incertitudes et points à vérifier

1. Les pages de prix et de conditions ont été lues le 1er octobre 2026 ; Planable et Gain affichent des prix annuels « avec deux mois offerts » ou « 20 % de remise » dont le détail mensuel exact varie selon la facturation.
2. Les conditions d'OpenAI et la page de prix de Canva n'ont pu être lues que via une copie lisible (r.jina.ai) ; les citations sont à confirmer sur les pages d'origine.
3. Les montants des sanctions de la Loi 25 (Québec) et de la loi ivoirienne 2013-450 n'ont pas pu être lus sur une page officielle ; ceux de la Loi 25 sont donnés de mémoire.
4. Les durées de consentement implicite CASL (2 ans et 6 mois) viennent de la loi telle que connue, la page du CRTC étant bloquée par un captcha.
5. Les tarifs d'agence en France (TJM, forfaits) et en Côte d'Ivoire (forfaits en FCFA) sont des estimations : Malt, Codeur, Glassdoor et helloDarwin n'ont pas répondu ou n'existent plus à ces adresses. Trois devis réels à Abidjan et trois en Ontario donneraient la vraie fourchette.
6. La règle Meta selon laquelle les comptes professionnels n'ont accès qu'à la Sound Collection pour les Reels est connue de longue date mais la page d'aide correspondante n'a pas répondu ; à vérifier dans l'interface d'un compte professionnel.
7. Le détail des politiques Meta sur les images « avant/après » et les gros plans corporels n'a pas été relu sur la page spécifique (404).
8. La loi française 2024-120 sur l'image des enfants et la loi « influenceurs » du 9 juin 2023 sont citées de mémoire (Legifrance et vie-publique bloqués ou déplacés).
9. Le texte de l'annexe VII de l'Accord de Bangui et la loi ivoirienne 2016-555 n'ont pas été lus ; la définition de l'auteur comme personne physique est à confirmer.
10. La position du CSPLA (France) sur les œuvres générées par IA n'a pas pu être relue.
11. Les lignes directrices de Santé Canada sur les allégations cosmétiques et le délai de 10 jours du formulaire de déclaration n'ont pas été lus sur la page officielle (404).
12. Les statistiques Sprout Social proviennent de la page de synthèse de Sprout, pas du rapport complet ; les pourcentages sont ceux affichés par Sprout avec l'année du rapport.
13. Les coûts unitaires de production (images, vidéo) sont ceux de R03 et R04 ; ils bougent chaque trimestre.

## 10. Implications pour la machine de José

1. **Vendre un service humain outillé, pas « de l'IA ».** 30 % des agences voient leur valeur perçue baisser parce que le client suppose que l'IA réduit les coûts (AgencyAnalytics 2026) et près d'un tiers des consommateurs se méfient des publicités IA (Hootsuite 2026). Le positionnement doit être : « votre gestionnaire livre chaque semaine une planche, produit de vraies vidéos, publie, et prouve les résultats » ; l'IA est l'atelier, pas l'enseigne.
2. **Faire de la planche hebdomadaire validée par WhatsApp l'objet central.** Aucun outil du marché (Planable, Gain, Kontentino, Later, Canva) ne l'a ; Gain prouve que le lien magique sans compte est le standard attendu par les agences ; la planche coûte 0,03 à 0,20 $ à produire (R03) et sa validation évite de générer des vidéos pour rien.
3. **Construire la validation sur un vrai compte WhatsApp Business Platform, pas sur CallMeBot.** La politique du 23 septembre 2026 impose l'opt-in et des modèles approuvés hors fenêtre de 24 heures ; deux modèles suffisent (« planche à valider », « rappel »), enregistrés une fois.
4. **Tarifer par client avec trois paliers, et un palier « logiciel seul ».** Les SaaS plafonnent à 15 à 50 $ par client pour la validation ; les agences facturent 500 à 5 000 $ par mois. Proposer, par exemple, Présence, Croissance et Vidéo+, avec un nombre de vidéos et de visuels explicite, et un palier logiciel pour les clients équipés d'un community manager. Fourchettes à tester : 600 à 1 500 CAD en Ontario, 500 à 1 500 € en France, 150 000 à 500 000 FCFA à Abidjan.
5. **Plafonner la vidéo générative.** C'est le seul poste de coût qui peut tripler la facture (1 à 4 $ par prise de 10 s) ; fixer un nombre de prises par plan, un budget par client et une alerte à 80 %. Le gestionnaire humain reste le premier coût : chaque minute gagnée sur la relecture vaut plus que n'importe quelle optimisation d'API.
6. **Un rapport mensuel d'une page, en trois couches, orienté revenu.** La question client numéro un en 2026 est « reliez la performance au revenu » (55 % des agences). Intégrer les demandes de devis, inscriptions (2IAE), ventes (beauté, SEVARTA) et dons ou présences (églises) comme couche « affaires » dès le premier mois.
7. **Mesurer et afficher la réactivité.** 73 % des utilisateurs partent chez un concurrent sans réponse (Sprout). Un indicateur « délai médian de réponse aux commentaires et messages » par client, visible du client, est un argument de rétention et un garde-fou.
8. **Tenir un registre de provenance et de licence par média.** Les moteurs cèdent l'usage commercial sur leurs plans payants (OpenAI, Higgsfield, Suno Pro, ElevenLabs payant) ; une image brute n'a probablement pas d'auteur au Canada, en France ou dans l'OAPI ; la seule protection réelle est la preuve de l'apport humain et des licences. Stocker moteur, version, prompt, références, compte, plan, date, et ne jamais retirer les métadonnées (Suno l'interdit).
9. **Jamais de palier gratuit pour un contenu publié.** Suno Free et Basic et ElevenLabs Free sont « non commerciaux » ; Google en gratuit utilise les données pour l'entraînement ; Higgsfield entraîne sur le contenu sauf compte entreprise. Un compte payant par moteur, au nom de l'agence, avec sous-licence au client dans le contrat.
10. **Étiqueter l'IA automatiquement.** AI Act article 50 applicable depuis le 2 août 2026 (code de bonnes pratiques du 10 juin 2026), TikTok depuis le 24 septembre 2026, Meta et YouTube par auto-déclaration ; OpenAI interdit de faire passer une sortie pour humaine. Un drapeau « réaliste » par média, coché à la génération, qui déclenche la divulgation à la publication.
11. **Un module « sermons » conforme par construction.** Fichier source fourni par l'église (jamais téléchargé depuis YouTube, l'API l'interdit), plans sur le prédicateur seul, floutage du public, aucun enfant, clause d'information de l'assemblée ; les témoignages individuels passent par un consentement signé dans le portail.
12. **Un module « beauté » avec lexique d'allégations.** Santé Canada (cosmétique contre médicament, « apparence des rides » et non « réduit les rides »), règlement 655/2013 (preuves et sincérité), Meta (18 ans et plus, pas de perception négative de soi). Le contrôle se fait sur la légende, le texte incrusté et la voix off avant la planche.
13. **Musique : catalogues commerciaux ou génération payante seulement.** Meta interdit l'usage commercial sans licence et TikTok impose la Commercial Music Library aux comptes professionnels ; la machine ne propose que ces sources ou une piste Suno ou ElevenLabs Music générée sous compte payant.
14. **Accès par rôles, jamais par mot de passe.** Business Manager Meta, rôles de Page, API officielles TikTok, LinkedIn et YouTube ; aucune automatisation de profil LinkedIn ni d'outil d'engagement artificiel (bannis par LinkedIn et TikTok). Les comptes restent au client, l'agence se retire en un clic.
15. **Données : documenter les sous-traitants et la région d'hébergement.** Railway (région), OpenAI, Google, Higgsfield, ElevenLabs ; une page « confidentialité » par client avec cette liste ; pour un client québécois, une évaluation avant transfert hors Québec (Loi 25) ; pour un client européen, registre des traitements et clauses de sous-traitance ; pour Abidjan, vérifier la déclaration à l'ARTCI et désigner un correspondant indépendant si le volume le justifie.
16. **Contrat type en trois versions (Ontario, France, Côte d'Ivoire)** à partir des quinze clauses de la section 8.1, relu par un avocat de chaque pays ; coût unique, réutilisé pour chaque client.
17. **Onboarding en 30 minutes, avec consentements.** Brand kit, accès par rôles, dépôt de produits et de photos avec le champ « qui est sur la photo et avons-nous son accord », canal préféré, règles de validation par défaut (que publier sans réponse), opt-in WhatsApp et courriel horodatés.
18. **Rituel de rétention codé.** Revue mensuelle automatique (rapport, trois décisions proposées), revue à 90 jours avec comparaison avant/après, et alerte interne « risque de départ » quand le client ne valide plus, ne commente plus ou voit ses indicateurs baisser deux mois de suite.

## 11. Sources consultées

Pages ouvertes avec succès (lecture directe ou via copie lisible, 1er octobre 2026) : https://planable.io/pricing/ ; https://www.kontentino.com/pricing ; https://gainapp.com/pricing ; https://later.com/pricing/ ; https://www.ziflow.com/pricing ; https://filestage.io/pricing/ ; https://www.canva.com/pricing/ ; https://www.webfx.com/social-media/pricing/ ; https://www.hellowork.com/fr-fr/metiers/community-manager.html ; https://www.paylab.com/ci/salaryinfo/marketing-advertising-pr/community-manager ; https://agencyanalytics.com/blog/agency-benchmarks-2026-attribution ; https://agencyanalytics.com/blog/why-clients-leave-agencies ; https://sproutsocial.com/insights/social-media-statistics/ ; https://sproutsocial.com/insights/index/ ; https://www.hootsuite.com/research/social-trends ; https://www.hubspot.com/state-of-marketing ; https://artificialintelligenceact.eu/article/50/ ; https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content ; https://about.fb.com/news/2024/04/metas-approach-to-labeling-ai-generated-content-and-manipulated-media/ ; https://www.tiktok.com/community-guidelines/en/integrity-authenticity ; https://newsroom.tiktok.com/en-us/new-labels-for-disclosing-ai-generated-content ; https://support.google.com/youtube/answer/14328491 ; https://openai.com/policies/terms-of-use/ ; https://ai.google.dev/gemini-api/terms ; https://policies.google.com/terms/generative-ai ; https://higgsfield.ai/terms-of-use-agreement ; https://suno.com/terms ; https://elevenlabs.io/terms-of-use ; https://www.facebook.com/legal/music_guidelines ; https://ads.tiktok.com/help/article/commercial-music-library ; https://ised-isde.canada.ca/site/strategic-policy-sector/en/marketplace-framework-policy/consultation-copyright-age-generative-artificial-intelligence ; https://en.wikipedia.org/wiki/Artificial_intelligence_and_copyright ; https://fr.wikipedia.org/wiki/Organisation_africaine_de_la_propri%C3%A9t%C3%A9_intellectuelle ; https://www.wipo.int/about-ip/en/artificial_intelligence/ ; https://www.service-public.gouv.fr/particuliers/vosdroits/F32103 ; https://educaloi.qc.ca/capsules/le-droit-a-limage/ ; https://adstandards.ca/preclearance/cosmetics/ ; https://www.canada.ca/en/health-canada/services/consumer-product-safety/cosmetics.html ; https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32013R0655 ; https://transparency.meta.com/policies/ad-standards/ ; https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/ ; https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/ ; https://www.cai.gouv.qc.ca/entreprises/ ; https://www.cnil.fr/fr/rgpd-de-quoi-parle-t-on ; https://www.autoritedeprotection.ci/ ; https://www.autoritedeprotection.ci/faqdcp/ ; https://www.artci.ci/ ; https://developers.facebook.com/terms/ ; https://help.instagram.com/1682672155283228 ; https://www.linkedin.com/help/linkedin/answer/a1341387 ; https://developers.google.com/youtube/terms/developer-policies ; https://whatsappbusiness.com/policy/ ; https://en.wikipedia.org/wiki/Canada%27s_Anti-Spam_Legislation ; https://crtc.gc.ca/eng/internet/anti.htm.

Pages tentées sans succès (403, 404, captcha) : Legifrance (loi 2024-120), vie-publique, CRTC guide CASL, CAI Québec (copie lisible bloquée), quebec.ca Loi 25, Malt, Codeur, Glassdoor, helloDarwin, Santé Canada (lignes directrices allégations), Meta ad standards santé et apparence, Meta aide musique comptes professionnels, culture.gouv.fr CSPLA, oapi.int, dataguidance.com, swello, lafabriquedunet, agencyanalytics.com/benchmarks.

Rapports frères réutilisés : R01 (marché et prix des outils), R03 (coût des images et des planches), R04 (coût des vidéos, voix et musique).
