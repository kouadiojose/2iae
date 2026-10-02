# La Machine : dossier de conception de la plateforme social media multi-clients

Version 2, 2 octobre 2026. Plateforme d'agence de José Kouadio (Markel-Tech, SEVARTA, 2IAE) pour gérer les réseaux sociaux de plusieurs clients à Abidjan et au Canada : veille, planche hebdomadaire validée sur WhatsApp, production d'images et de vidéos, publication, mesure reliée aux affaires.

Ce dossier est le résultat de dix-sept rapports de recherche (dossier `recherche/`), de cinq conceptions concurrentes notées par trois juges (dossier `conceptions/`), d'une synthèse, puis de trois critiques adverses et de leurs arbitrages (dossier `critiques/`). Les références du type « R05 §8.3 » renvoient aux rapports de recherche ; R26 prévaut en cas de divergence.

Toute la persistance vit sur Railway (Postgres, buckets), provisionnée avec le Railway CLI, dans un projet distinct du site et du campus.

## Sommaire

- 0. Ce que la version 2 change
- 1. Thèse
- 2. Les personnes
- 3. La routine
- 4. Les routines par verticale
- 5. La planche de propositions et la validation client
- 6. Le poste de pilotage du gestionnaire
- 7. L'usine de production
- 8. La veille et l'intelligence
- 9. L'architecture agentique (dont 9.8, les demandes de José réponse par réponse)
- 10. Publication, mesure et apprentissage
- 11. Architecture technique et modèle de données
- 12. Coûts et modèle économique
- 13. Risques, limites et garde-fous
- 14. Feuille de route
- 15. Questions ouvertes pour José
- 16. Faiblesses qui restent
- Annexes A à K (contrat, onboarding, support, facturation, sortie d'un client, bilinguisme et accessibilité, gouvernance des données, indicateurs du pilote, kit commercial, fiche de poste, trésorerie)

> Note de dernière minute : le calcul de la section 12 montre que Chaire Essentiel à 95 000 FCFA ne couvre pas sa part des outils (marge de −16 à 18 %). Recommandation : le relever vers 120 000 FCFA ou le limiter à un client sur quatre.

## 0. Ce que la version 2 change

### 0.1 D'où vient la version 2

La version 1 (SYNTHESE-v1, 2 octobre 2026) a été relue par trois équipes rouges : faisabilité et exactitude (CR1), qualité éditoriale et expérience client (CR2), économie, concurrence et complétude (CR3). Leurs critiques ont été tranchées dans un document d'arbitrage qui s'impose à toutes les sections. La v2 garde l'architecture de la v1 : machine à états en Postgres, planche hebdomadaire validée sur WhatsApp, deux produits verticaux, trois portes humaines, couche affaires en tête du rapport. Elle corrige les chiffres faux, rend le calendrier tenable, ferme des failles de sécurité, recalcule l'économie avec le vrai temps humain et réécrit l'expérience de la cliente. R26 prévaut toujours en cas de divergence entre rapports.

La plateforme s'appelle provisoirement « la Machine » ; le nom commercial est une question ouverte pour José. Les produits verticaux gardent leurs noms de travail : « Chaire » (église) et « Dépôt » (lancement de produit).

### 0.2 Corrections de la v1 vers la v2

| Domaine | v1 | v2 |
|---|---|---|
| Fait | Sermon Shots 53 à 97 $ en annuel | 53 à 87 $ en annuel, 63 à 97 $ en mensuel (R05 §2.2) |
| Fait | API Vizard 14,50 $ par mois | 29 $ sans engagement, 3 requêtes par minute et 20 par heure (R05 §2.1) |
| Fait | maquette gpt-image-2.5-flare à 0,006 $ | prix fal de gpt-image-2 ; coût inconnu avant le banc de 20 générations, jamais dans un devis (R26 §2.2) |
| Fait | scène signature Seedance 2.5 à 3,09 $ les 15 s | 9,30 à 18,50 $ pour 15 à 30 s avec 3 prises, musique en plus (R26 §2.4) |
| Fait | `MetaDirectConnector` sans revue grâce au rôle sur la Page | c'est le rôle sur l'application Meta qui dispense de revue (R02 §2.1) |
| Fait | jetons Meta rafraîchis chaque jour | Instagram Login rafraîchi à J-5 ; Page Facebook contrôlée par `debug_token` ; jeton d'utilisateur système pour les clients avec Page (R21 §5.3) |
| Fait | rendu Serverless à 13 $ | faux (connexion Postgres et pg-boss empêchent la veille), retiré (R25) |
| Fait | Upload-Post fournit commentaires et statistiques | non acquis (R02 §8.1) |
| Économie | gestionnaire 4 à 6 h par client, 8 à 12 clients, 574 $ | 8 à 12 h par client et par mois, à mesurer ; 8 à 10 clients au plus ; environ 715 $ par mois charges et frais compris |
| Économie | trois clients couvrent les fixes | 4 à 5 clients payants, dont un Présence ou Vidéo+ au moins (section 12) |
| Économie | grille avec France et Logiciel seul, Chaire Canada 450 CAD | grille v1 de la section 1.4 ; France sur devis ; Logiciel seul en phase 4 |
| Économie | pack vidéo local 500 000 à 900 000 FCFA | 750 000 à 900 000 FCFA, une seule grille non datée (R10 §7.1) |
| Économie | aucun frais, change ni taxe | ligne « frais, taxes, charges » par client ; taxes en sus ; Upload-Post Advanced dès 8 clients |
| Calendrier | 90 jours, phase 1 de 6 semaines | phase 1 de 8 semaines jusqu'au 13 décembre 2026, pilote en ligne au plus tôt le 30 novembre ; environ 20 semaines jusqu'au 28 février 2027 |
| Calendrier | toutes les revues en phase 0 | vérification d'entreprise en phase 0 ; revue Meta publication et insights, audits YouTube et TikTok en fin de phase 1 ; accès avancé réaliste en 2 à 4 mois |
| Calendrier | Toronto pour le Mois de l'histoire des Noirs | client signé avant le 10 janvier 2027, sinon l'été |
| Sécurité | limite dure Railway à 1,5 fois | 3 fois la facture, alertes à 1,2 et 1,5, disjoncteurs applicatifs |
| Sécurité | sauvegardes écrites par la Machine | dumps chiffrés par clé publique, tirés depuis un projet de sauvegarde dans un espace Railway distinct |
| Sécurité | aucune règle chez les fournisseurs, `web` sans clé définie | règle de transit (copie sous 24 h puis suppression) ; `web` en sealed box |
| Sécurité | gestionnaire sans authentification ; MCP avec `approve` | passkey ou lien plus TOTP, 12 h, audit ; MCP en lecture seule plus `log_decision` |
| Sécurité | José seul administrateur, un numéro, un fournisseur vidéo | second administrateur, numéro de réserve, Kling via fal en repli de Higgsfield, Sonnet en repli d'Opus |
| Technique | Batch le jeudi 02:00 | lot le mercredi 18:00, reprise synchrone jeudi 05:00 (R07) |
| Technique | sept modèles utilitaires, Blotato pour TikTok | cinq modèles utilitaires, rapport au tarif marketing ; Blotato retiré, écran TikTok en porte 3 |
| Expérience | deux planches par semaine pour une église | une planche par client et par semaine, plafond de messages bloquant |
| Expérience | composite de 6 à 10 vignettes avec jargon | 6 vignettes numérotées au plus, vue client simplifiée, aperçu vidéo de 5 à 6 s |
| Expérience | « Je valide tout » partout | retiré pour églises et beauté |
| Expérience | réserve de 6 contenus, voie rapide statique | réserve de démarrage de 12 contenus ; voie rapide statique puis vidéo ; mandat tendance |
| Expérience | voix tirée des 50 derniers posts | voix tirée de la parole réelle, test en aveugle (R11 §5.1) |
| Expérience | Chaire : clips bruts ; Dépôt « en document » | highlights animés, verset animé, audiogrammes, fond de catalogue ; photo normale acceptée |
| Expérience | José à moins de 2 h par semaine | 6 à 10 h l'an 1, moins de 2 h en croisière, mode José absent |

### 0.3 Arbitrages conservés

1. Toute persistance sur Railway, sauvegarde comprise (R25 §2.2, §11.3).
2. Higgsfield Unlimited et Claude in Chrome hors de la plateforme (R26 §2.4) ; API officielle pour la Machine, MCP officiel (mcp.higgsfield.ai/mcp, en crédits, R04 §1) pour José dans Claude ou Cowork.
3. Porte 1 à 24 heures, jamais contournée ; aucune publication sans oui ou réserve validée.
4. Premier pilote : une église d'Abidjan avec régie (R05 §8.20), SEVARTA en interne.
5. Juge sur Haiku 4.5, calibré sur 100 posts par verticale (R11 §15.4).
6. UGC synthétique jamais par défaut ; clips de sermon du mardi au samedi.
7. Chaîne sermon maison dès la phase 1, Vizard en filet tant qu'il sert ; Agent SDK hors du MVP.

### 0.4 Arbitrages nouveaux

1. Thèse réécrite : « personne ne le fait sur place, en français, avec un humain et une preuve d'affaires » ; « une doctrine ne se copie pas » retiré.
2. Grille de prix v1, clients canadiens servis depuis Abidjan.
3. Temps humain chronométré dès le pilote, critère de sortie de phase.
4. Coupes MVP : Chaire de bout en bout, quatre files, un moteur par famille, un pilote (section 14).
5. Une planche par semaine, cinq modèles, budget de messages bloquant.
6. Réserve de démarrage et défaut « sans réponse » tranché par José avant le pilote (proposition : réserve).
7. Mandat tendance, voie rapide vidéo, exceptions assumées écrites (section 3.11).
8. Claude Code par Routines et bouton « Confier à Claude » (phase 3) ; Cowork par une tâche planifiée qui lit le MCP.

---

## 1. Thèse en une page

### 1.1 La phrase de positionnement

« Votre gestionnaire regarde ce qui se passe chez vous et autour de vous, vous propose la semaine en images, attend votre oui sur WhatsApp, produit et publie de vraies vidéos en français, et vous montre chaque mois ce que cela a rapporté. »

La phrase reste celle de la v1. L'IA est l'atelier, pas l'enseigne : 30 % des agences voient leur valeur perçue baisser quand le client croit que « l'IA réduit les coûts », et près d'un tiers des consommateurs se méfient des publicités IA (R08 §3.1 et §10.1).

### 1.2 La thèse : personne ne le fait sur place, en français, avec un humain et une preuve d'affaires

Au 2 octobre 2026, chaque outil du marché couvre un morceau. Hootsuite (99, 199, 399 $ par siège et par mois, R26 §2.5) a le signal sans vidéo, en anglais. Predis (55 $) fait de la vidéo de gabarit sans signal ni validation. Planable valide sans produire. n8n produit sans porte humaine. Sermon Shots (53 à 87 $ par mois en annuel, 63 à 97 $ en mensuel, R05 §2.2) et Pulpit AI (39, 59, 129 $, R05 §2.2) découpent des sermons en anglais, sans publication ni validation pastorale. Aucun ne parle le français d'Abidjan, n'encaisse en mobile money ni ne relie un Reel à une vente (R01 §1 et §6).

Ce qui se copie, il faut le dire : la doctrine, le juge, la planche WhatsApp (n8n et une API de publication en un week-end) et les indicateurs se reproduisent en six mois (CR3 §4). La menace numéro un n'est pas un SaaS : c'est un community manager d'Abidjan équipé de Claude Cowork, du MCP Metricool (43 €), de Canva et de CapCut, qui fait 80 % de Présence pour 100 $ par mois. La parade est de vendre un résultat (vidéo réelle, couche affaires, continuité garantie) et de ne jamais vendre l'outil aux concurrents locaux.

Ce qui est défendable, c'est ce qui ne tient pas dans un prompt :

| Avantage | En quoi il consiste |
|---|---|
| Distribution | réseau de José, églises d'Abidjan, diaspora de Toronto, 2IAE comme vivier de gestionnaires formés |
| Opération locale | gestionnaire francophone à Abidjan, encaissement Wave Business et prélèvement PAD, créneaux et fêtes de chaque pays |
| Données accumulées | paires de corrections par client, médianes locales de performance, banc de transcription sur l'accent ivoirien, bibliothèque de formats gagnants par verticale |
| Accès approuvés | application Meta vérifiée, audits TikTok et YouTube, numéro WhatsApp vérifié : 2 à 4 mois de file d'attente pour un nouvel entrant |
| Dispositif de conformité | consentements reliés à chaque média, étiquetage IA par variante, lexique d'allégations par pays, validation pastorale tracée |

Contre Pulpit AI et Sermon Shots, qui peuvent traduire leur produit en quelques semaines, la parade est la vitesse : dix églises avant la mi-2027, Segond 1910, transcription testée sur l'accent ivoirien, mobile money, publication et validation pastorale (CR3 §4).

### 1.3 Les cinq choix qui rendent la Machine supérieure au marché

1. **La doctrine de José comme contrat exécutable.** Deux plateformes par client, piliers 60/25/15, frameworks PAS, AIDA, BAB, FAB, 3 à 5 hashtags (plafond dur Instagram de 5, R26 §2.6), mesure en trois couches. La Machine refuse une semaine à plus de 15 % de promotion ou à moins de 60 % de valeur (R06 §16.15) et un contenu sans fait vérifiable. Un juge à sept critères (R11 §8.2, seuil 15/21) bloque avant chaque planche ; pour le pilier relation, il exige 3/3 en ancrage réel. La doctrine n'est pas un secret : c'est une discipline tenue chaque semaine, qui fait la différence tant que l'opération suit.
2. **Une planche par semaine, validée sur WhatsApp, et une Machine qui ne laisse jamais une semaine vide.** Six vignettes numérotées au plus, un aperçu de 5 à 6 secondes pour chaque vidéo, un modèle utilitaire à 0,004 $ en Côte d'Ivoire et 0,0034 $ au Canada (R22 §0). La validation avant génération divise par cinq à dix le coût de ce qui n'est pas validé (R04 §8.3). Quand la cliente se tait, la réserve de démarrage de 12 contenus qu'elle a validés à l'onboarding tient les créneaux.
3. **Deux produits verticaux que personne ne vend en français : Chaire et Dépôt.** Chaire transforme le sermon du dimanche en clips, highlights animés, verset animé, audiogrammes, format long, citations et dévotionnel pour moins de 2,50 $ de coût marchand par sermon (R05 §4), sans génération IA donc sans étiquette. Dépôt transforme deux photos envoyées sur WhatsApp en une séquence de lancement en cinq temps, INCI vérifié, packshot réel (R09 §3.8, R21 §9.5), et suit la couverture de tout le catalogue.
4. **Des indicateurs « à la page » et la couche affaires en tête du rapport.** Délai signal vers publication, nouveautés sous 14 jours, couverture du catalogue, sermons réemployés sous 7 jours, tendances vues par le client avant nous (section 6.6). Au-dessus, dès le premier mois, liens traçables et QR maison, puis coupons (R24 §2) : relier la performance au revenu est la question numéro un de 55 % des 494 agences interrogées (R08 §3.1).
5. **Acheter la plomberie, construire la différence, ne jamais dépendre d'un agent vivant.** Upload-Post pendant que les revues officielles courent (R02 §12.1), transcription et génération à l'acte ; le développement va à la planche, à Chaire, à Dépôt, au juge et à la mesure. Toute attente est un état en Postgres (R07 §11.7) : un redéploiement ne perd rien, leçon de l'incident du campus du 29 septembre 2026.

**Claude Code et Cowork dès la thèse.** José pilote la Machine depuis Claude Code : une Routine se déclenche par `POST /fire` (30 tirs par heure et par routine, R07 §2.6) et, en phase 3, un bouton « Confier à Claude » dans la PWA envoie des ordres types (genèse d'événement, vidéo explicative de logiciel, relecture de planche). Cowork ne se déclenche pas directement, faute d'API d'entrée (R07 §2.7) : une tâche planifiée Cowork lit les ordres en attente par le serveur MCP de la Machine. Rien de critique n'en dépend.

### 1.4 Grille de prix v1

| Palier | Abidjan (FCFA par mois) | Canada (CAD par mois) | Contenu |
|---|---|---|---|
| Chaire Essentiel | 95 000 | non proposé | 1 compte, 3 clips par semaine, sans format long |
| Chaire | 175 000 | 700 | église avec régie, 2 comptes (église et pasteur), 5 clips par semaine, 2 highlights animés et 1 verset animé par sermon, format long, citations, dévotionnel, rapport |
| Présence (engagement 3 mois) | 300 000 | 900 | 12 visuels, 4 vidéos programmées, 2 plateformes, planche hebdomadaire, rapport |
| Vidéo+ | 650 000 au catalogue, 550 000 pour les pilotes | 2 200 | 12 Reels dont 6 génératifs, 8 carrousels, 4 UGC montés à partir de vidéos réelles, rapport ; boîte de réception dès qu'elle existe (phase 3) |
| Frais d'intégration (remboursés si engagement de 6 mois) | 125 000 | 400 | onboarding de 1 à 2 semaines, réserve de démarrage, fond de catalogue |
| Option boîte de réception | 40 000 | 120 | réponse sous 24 h ouvrées, brouillons dans la voix du client, validation humaine (phase 3) |
| Option boost supervisé | 15 % du budget, minimum 15 000 FCFA | 15 %, minimum 50 CAD | jamais automatique (R23 §8.10) |
| Reel génératif supplémentaire | 15 000 | 50 | au-delà du plafond du palier |

Taxes en sus : TVH de 13 % en Ontario ; la fiscalité ivoirienne (retenue sur honoraires de non-résident, TVA) est à faire trancher par un avocat (CR3 §2.3). Encaissement : prélèvement préautorisé PAD au Canada (1 % plus 0,40 CAD, plafond 5 CAD), Wave Business à Abidjan (1 %), CinetPay et Stripe en repli (R10 §7.3). France : sur devis, hors grille v1. Logiciel seul : retiré de la v1, phase 4, réservé à des agences partenaires hors Abidjan, facturé par espace (par exemple 250 CAD pour 5 clients), avec clause de non-concurrence.

Repères : Chaire à 175 000 FCFA (environ 287 $) coûte 3,0 à 5,4 fois Sermon Shots, mais près de six fois moins que Church Media Squad (1 697 $, service humain en anglais, R05 §1). Les packs vidéo d'agence d'Abidjan se vendent 750 000 à 900 000 FCFA, sur une seule grille non datée (R10 §7.1) : Vidéo+ se place dessous avec plus de vidéos. Les clients canadiens sont servis par le gestionnaire d'Abidjan ; un humain canadien n'intervient que pour les appels, ce qui rend Chaire viable à 700 CAD.

### 1.5 Seuil, calendrier

**Seuil** : 4 à 5 clients payants selon le mix, dont au moins un Présence ou Vidéo+, couvrent les coûts fixes, gestionnaire d'Abidjan compris ; quatre églises seules ne suffisent pas. Le calcul exact, les coûts par client type et la ligne « frais, taxes, charges » sont en section 12. Les pilotes à 50 % ne couvrent pas les fixes : la conversion au plein tarif est le vrai test.

**Calendrier** : phase 0 du 5 au 18 octobre 2026, phase 1 « Chaire minimal » du 19 octobre au 13 décembre 2026 avec un pilote en ligne au plus tôt le 30 novembre, phase 2 jusqu'au 28 février 2027 : environ 20 semaines de construction, marge de 25 % comprise. Le palier de 8 clients payants arrive au plus tôt à l'été 2027 (section 14).

---
## 2. Les personnes

### 2.1 José, propriétaire et architecte

José voit un seul écran « santé de l'agence » : clients, planches en attente par porte, risques de départ, coût de génération contre plafond, connexions, indicateurs « à la page » agrégés, minutes de gestionnaire par client. Le lundi à 07:00, il reçoit sur WhatsApp un message du numéro de la Machine avec trois boutons : « Voir », « Approuver tout ce qui est prêt », « Reporter ». Le deuxième bouton ne programme que des éléments déjà passés en porte 3 et en attente d'un arbitrage (créneau, plafond, report) ; il ne touche jamais une planche en porte 1 ni un rendu non contrôlé.

Il arbitre les escalades (trois refus du juge, client silencieux à J+5, plafond atteint), relit les posts LinkedIn de Markel-Tech (automatisation du profil interdite, R08 §7.8), mène les revues à 90 jours et pilote Claude Code. Son atelier personnel (Claude in Chrome, Suno, Higgsfield) n'entre pas dans la plateforme.

**Temps de José, trajectoire honnête.**

| Période | Heures par semaine | À quoi elles servent |
|---|---|---|
| Construction (octobre 2026 à février 2027) | environ 500 h au total, hors exploitation (CR3 §2.7) | code, bancs, revues Meta, TikTok, YouTube, contrat |
| Année 1 d'exploitation | 6 à 10 h | vente et démonstrations, calibration du juge (100 posts par verticale, environ une journée par verticale), onboarding en visio, portes 1 et 3 tant que le gestionnaire n'est pas recruté, formation du gestionnaire, arbitrages, dépréciations des fournisseurs, sa propre présence (SEVARTA, 2IAE, Markel-Tech, LinkedIn) |
| Régime de croisière (année 2) | moins de 2 h | message du lundi, escalades, revues à 90 jours, recalibration mensuelle du juge (environ une heure par verticale) |

**Mode José absent.** Un drapeau `agency.jose_absent`, posé par José ou par le second administrateur, bascule l'agence en fonctionnement sans lui pour une durée datée. Les alertes rouges vont au second administrateur de Markel-Tech et au gestionnaire ; la porte 1 reste tenue par le gestionnaire seul ; aucun plafond ne monte au-delà du contrat ; aucun nouveau client n'est intégré ; les Routines et le bouton « Confier à Claude » sont suspendus ; les posts LinkedIn du fondateur sont mis en pause. La Machine continue de produire et de publier ce qui a passé les portes. Une procédure d'urgence écrite (accès Meta Business, Railway, numéro de réserve) est tenue par le second administrateur (CR1 §2.M).

### 2.2 Le gestionnaire humain

**Charge** : 8 à 12 heures par client et par mois, Chaire au bas, Vidéo+ au haut. C'est une hypothèse de travail : elle est chronométrée dans la PWA dès le pilote (section 6.3) et devient un critère de sortie de phase. Un gestionnaire à temps plein à Abidjan tient 8 à 10 clients au plus. Son coût employeur est d'environ 410 000 FCFA (350 000 brut plus des charges CNPS hypothétiques) et 25 000 FCFA de téléphone, données et transport, soit environ 715 $ par mois. Son statut est à fixer (annexe J).

**Qui sert qui.** Les clients canadiens sont servis par le gestionnaire d'Abidjan, francophone, avec 4 à 5 heures de décalage. Un humain canadien, payé à l'heure, n'intervient que pour les appels. Jusqu'au recrutement, José tient lui-même les portes 1 et 3 du pilote.

**Sa semaine type**, avec les postes qu'il faut mesurer :

| Moment | Tâche | Mesure dans la PWA |
|---|---|---|
| Jeudi 09:00 à vendredi 09:00 | porte 1 : relire chaque planche, environ 5 à 10 minutes par client | minutes par planche |
| Lundi 08:00 à 11:30 | porte 1 des planches Chaire | minutes par planche |
| Lundi et mardi | lire les validations, traiter les « à revoir » d'église et de beauté, appeler les silencieux | minutes par client |
| Chaque jour | porte 3 (rendus avec drapeau), paquets manuels (Channels et Status WhatsApp, TikTok sans son commercial), commentaires TikTok dans l'application (R23 §8.9) | minutes par file |
| Chaque semaine | dévotionnel d'église au Channel : 5 publications manuelles par église, 15 pour trois églises (CR2 §3) | minutes par paquet |
| Premier lundi après le 3 | rapport mensuel lu avec le client | minutes par appel |

Chaque correction devient une paire (brouillon, correction, motif) réinjectée dans la mémoire du client (R11 §15.10). Chaque ligne d'une file porte le média, le texte et le bouton. Un échantillon de ses validations est relu par José chaque semaine pendant l'année 1 (annexe J).

### 2.3 Le client, par verticale

| Verticale | Qui valide | Ce qu'il reçoit | Ce qu'il fait | Ce qu'il fournit lui-même |
|---|---|---|---|---|
| Église (Chaire) | le pasteur ou son délégué | une planche le lundi midi : clips numérotés avec verset, durée, réseau, aperçu de 5 à 6 s ; récapitulatif le dimanche soir | valide chaque extrait (validation doctrinale, R09 §5.7), dans la PWA ou le Flow (phase 2) ; répond lui-même aux demandes de prière (R23 §8.5) | le fichier de la régie, 10 anciens sermons à l'onboarding, message face caméra, témoignages consentis |
| Beauté (Dépôt) | la fondatrice | « Reçu : Sérum Éclat, 30 ml, gamme Visage. On prépare le lancement ? » dans la minute après un dépôt (R21 §9.10) ; planche le vendredi ; récapitulatif le dimanche | un tap par proposition, parfois un vocal ; envoie deux photos normales (document seulement si l'INCI est illisible) | tutoriels face caméra, application sur la main, vidéos d'avis tournées sur script guidé (phase 2) |
| Association culturelle | président ou chargé de communication | planche de séquence par événement (teaser J-21, genèse J-14, programme J-7, rappel J-1, récap J+2, R09 §4.8) | valide la séquence, envoie le flyer, un vocal du président sur l'histoire de l'événement, les plans tournés | archives photo, portraits, directs |
| SEVARTA | José, l'auteur pour ses extraits | séquence de sortie de six semaines, citations animées | valide ; l'auteur lit ses extraits | lecture, interview |
| 2IAE | la direction | compte à rebours d'admission, carrousels métiers, récaps sous 48 h | valide ; fournit le registre des autorisations d'image | étudiants ambassadeurs, enseignants ; données publiques du campus seulement |
| Markel-Tech | José | angles de posts fondateur, documents natifs, vidéo explicative à chaque projet livré (phase 3) | écrit ou valide ; obtient l'accord du client cité | posts du fondateur, compte de démonstration du logiciel livré |

Le client n'a pas de compte. WhatsApp d'abord, courriel en double au Canada (WhatsApp n'y touche qu'un tiers des internautes, R10 §2.2), lien magique pour le détail. Le nombre de messages qu'il reçoit est plafonné et mesuré (section 5.5). Il ne se reconnecte pas lui-même quand il a une Page Facebook : le jeton d'utilisateur système de Facebook Login for Business n'expire pas par défaut (R21 §5.3).

---

## 3. La routine : le cycle complet par client comme machine à états

### 3.1 Principe

Toute attente humaine est un état en base, jamais un agent qui attend : zéro jeton pendant l'attente, reprise garantie après redéploiement (R07 §5 et §11.7). Chaque transition est une tâche pg-boss idempotente (clé `tenant:type:date:hash`) qui lit l'état, agit, écrit l'état suivant et enfile la tâche suivante. Cinq objets portent les états : signal, planche (`board`), contenu (`content_item`), tâche de génération, publication. Les heures sont celles de `tenant.timezone` ; les exemples sont donnés pour Abidjan (GMT).

### 3.2 Les horloges

| Horloge | Cadence | Travail | Phase |
|---|---|---|---|
| H0 tick | 5 minutes, Railway cron, sort en moins d'une minute (R07 §11.6) | échéances, rappels, escalades, quotas, tâches orphelines, plafond de messages | 1 |
| H1 tendances | 2 heures, durée de vie 48 heures (R06 §16.14) | Trending Now RSS (CI, CA, FR), Google News RSS ; GDELT et SerpApi en phase 3 | 2, complète en 3 |
| H2 flux client | horaire et webhooks | Atom YouTube et PubSubHubbub, dépôts WhatsApp, Drive de la régie, crawl quotidien du site et du catalogue (R06 §16.10) | 1 (sermons), 2 (catalogue) |
| H3 sons et formats | hebdomadaire, lundi 06:00, durée de vie 3 semaines | run Apify partagé du Creative Center pour trois pays, chaque son daté de sa première apparition (R06 §16.4) ; sons Instagram par l'Audio API (R26 §3) | 3 |
| H4 calendrier | hebdomadaire, horizon 8 semaines | fêtes fixes, lunaires (fenêtre de plus ou moins deux jours, confirmation la veille), événements vivants, revérification 48 heures avant (R10 §8.9) | 1 |
| H5 cycle éditorial | mercredi 18:00 lot Batch ; jeudi 05:00 reprise synchrone ; jeudi 06:00 planche ; vendredi 10:00 envoi | idéation, brouillons, juge, porte 1, envoi, rappels, réserve, production, porte 3, programmation | 1 (Chaire), 2 (généraliste) |
| H6 mesure | 05:00 GMT et relevés par média | comptes la veille ; médias J+1, J+3, J+7, J+30, J+90 ; Stories H+6, H+12, H+23 (R24 §10.8) ; au MVP, couche affaires maison et ce qu'Upload-Post fournit réellement | 1 |
| H7 rapport | premier lundi après le 3, avant 9 h heure client (R24 §10.8) | PDF d'une page, résumé WhatsApp de cinq lignes | 1 |
| H8 itération | 90 jours | avant et après, médianes locales, sources coupées ou renforcées (R06 §16.19) | 2 |
| H9 santé | quotidienne, hebdomadaire, trimestrielle | voir le tableau 3.3 | 1 |

### 3.3 H9, l'horloge de santé

| Objet | Contrôle | Délai |
|---|---|---|
| Jeton Instagram Login (60 jours) | rafraîchi à J-5, possible seulement s'il a plus de 24 h et n'est pas expiré | quotidien |
| Jeton de Page Facebook (dérivé d'un jeton long, n'expire pas) | `debug_token` : validité, permissions, révocation | hebdomadaire |
| Jeton d'utilisateur système (Facebook Login for Business) | `debug_token` ; n'expire pas par défaut (R21 §5.3) | hebdomadaire |
| LinkedIn | alerte à J-10 (R02 §12.9) | quotidien |
| TikTok | rafraîchi avant chaque publication | à l'usage |
| PubSubHubbub YouTube | réabonnement tous les 3 jours (R21 §9.13) | tous les 3 jours |
| Canal Drive `changes.watch` de la régie | 604 800 s au plus (7 jours), sans renouvellement automatique : renouvelé à J+6 (R21 §3.4) | tous les 6 jours |
| Fournisseurs (OpenAI, fal, Higgsfield, AssemblyAI, Upload-Post) | génération ou appel de test, coût unitaire relu (R04 §8.2) | hebdomadaire |
| Mesure | test qui échoue bruyamment sur « invalid metric » (R24 §10.20) | hebdomadaire |
| Pages primaires (prix, conditions, changelogs) | diff avec alerte WhatsApp (R26 §5.19) | trimestriel |
| Sauvegarde | restauration de test depuis le projet de sauvegarde | trimestriel |

### 3.4 Les états d'un contenu

`idee` → `brouillon` → `juge` (deux retours au plus, puis `revue_humaine`, R07 §11.13) → `en_planche` → `propose` → `valide` | `a_revoir` (motif, version n+1) | `refuse` | `reserve` → `en_production` (tâches chaînées) → `controle` (contrôle déterministe, vision, puis porte 3 humaine si promotion, verticale réglementée, personne réelle, TikTok ou YouTube) → `programme` → `publie` | `publie_manuel` | `en_attente_reconnexion` | `echec` → `mesure` → `archive`.

Un déclencheur sur `ref.content_transition` interdit tout passage à `programme` sans `judge_score` d'au moins 15, sans `asset_rights` valides pour chaque personne identifiable, sans `ai_label` calculé, et sans décision client `valide`, provenance `reserve` ou provenance `mandat_tendance` (section 3.8).

### 3.5 Le cycle hebdomadaire généraliste (Présence, Vidéo+, association, école)

| Moment (GMT) | Événement | Acteur | Délai et repli |
|---|---|---|---|
| Mercredi 18:00 | lot Batch : scoring de la veille de la semaine, calendrier à 8 semaines, pré-classement par pilier | Machine | un lot finit souvent en moins d'une heure, jusqu'à 24 h (R07) |
| Jeudi 05:00 | les `custom_id` non terminés repassent en synchrone | Machine | aucun retard sur la planche |
| Jeudi 06:00 à 08:00 | idéation synchrone sur Opus 5.5 avec cerveau en cache, 6 propositions en séquences (R09 §11.15), vérification 60/25/15, maquettes, « frame 0 » Remotion, brouillons vidéo de 5 à 6 s (LTX-2.3 à 0,06 $ la seconde, R04 §8.3), juge synchrone, vision, deux propositions de réserve | Machine | si la planche n'est pas prête à 08:00, bascule automatique sur Sonnet 5.5 |
| Jeudi 09:00 | porte 1 : file « À relire » | gestionnaire | 24 heures ; vendredi 09:00 alerte à José (au second administrateur en mode José absent) ; jamais d'envoi sans relecture |
| Vendredi 10:00 | `planche_prete` (composite de 6 vignettes numérotées, trois boutons) et courriel avec le même lien | Machine | le tap ouvre la fenêtre de 24 heures ; les aperçus vidéo partent dans cette fenêtre |
| Dès le premier oui | production de la proposition validée (3 prises, 1080p), contrôle, porte 3 si drapeau | Machine, gestionnaire | 24 à 48 heures après validation |
| Lundi 09:00 | rappel 1 (J+3), qui réutilise `planche_prete` avec la date limite | Machine | |
| Mercredi 09:00 | rappel 2, dernier (J+5, R22 §10.10), tâche « appeler la cliente » | Machine, gestionnaire | s'il reste de la place dans le plafond de messages, sinon appel seul |
| Mardi à samedi | publication aux créneaux du fuseau (Facebook 7 h à 9 h et 13 h à 15 h, TikTok 18 h à 20 h à Abidjan ; mardi à jeudi 11 h à 17 h heure de l'Est ; jamais le dimanche sauf directs d'église, R10 §8.7) | Machine | |
| Dès mardi | créneau non validé tenu par la réserve si la règle « sans réponse » est « réserve » ; créneaux promotion tenus par la réserve produit (sans prix ni allégation) | Machine | automatique |
| Dimanche 18:00 | récapitulatif `publication_faite` : ce qui est sorti, ce qui est en production, propositions de boost, séquences en cours | Machine | un seul message |
| Vendredi suivant | planche expirée, propositions non validées archivées « silence », nouvelle planche | Machine | J+7 |

La planche hebdomadaire porte le fond de semaine (valeur, relation) ; elle a trois à dix jours d'âge à la publication. Ce qui doit être « à la page » ne l'attend pas : la tendance (voie rapide, section 3.9), le dépôt de produit (mini-planche sous 24 heures dans la fenêtre ouverte par le dépôt, R21 §9.18), l'événement (séquence à J-21), le sermon (cycle Chaire).

### 3.6 Le cycle Chaire (église)

Pour une église, la planche du lundi midi remplace celle du vendredi : une seule planche par semaine.

| Moment (GMT) | Événement | Délai et repli |
|---|---|---|
| Dimanche, après le culte | fichier de la régie dans le Drive partagé (`changes.watch`) ou audio seul par WhatsApp (43 Mo pour 90 minutes, R21 §9.8) ; ingestion d'un proxy 720p | jamais de téléchargement depuis YouTube (R08 §10.11) |
| Dimanche soir | transcription AssemblyAI (`language=fr` forcé, R05 §8.3), analyse en Batch | les tâches non terminées repassent en synchrone lundi 06:00 |
| Lundi 06:00 à 08:00 | coupes, sous-titres, highlights animés, verset animé, audiogrammes, citations, dévotionnel ; juge ; aperçus de 5 à 6 s tirés des vrais clips | |
| Lundi 08:00 à 11:30 | porte 1 | à 11:30 non relue : envoi au plus tard à 15:00 après relecture, alerte à José ; jamais sans relecture |
| Lundi 12:00 | `planche_prete` : 6 vignettes numérotées sur le composite, toutes les propositions dans la PWA | validation pièce par pièce, pas de « Je valide tout » |
| Mardi et mercredi | rappel 1 mardi 12:00, rappel 2 mercredi 12:00 et appel du gestionnaire | proposition à éprouver au pilote : les clips vieillissent plus vite qu'une planche généraliste |
| Mardi à samedi | un clip par jour, format long le jeudi ; chaque clip validé part au créneau suivant | un clip non validé ne part jamais ; la réserve d'anciens sermons tient le créneau si la règle l'autorise |
| Dimanche 18:00 | récapitulatif de la semaine | |

### 3.7 Ce qui se passe quand le client ne répond pas

Deux rappels au plus (note de qualité du numéro, politique « fréquence » du 23 septembre 2026, R22 §10.10), puis l'humain appelle, puis la règle `tenant.regle_sans_reponse` cochée au contrat (R08 §8.1.2) : « réserve » ou « tout retenir ». Le défaut est tranché par José avant le premier pilote ; la proposition de ce dossier est « réserve activée ».

**La réserve de démarrage.** Pendant l'onboarding (minutes 45 à 55 de la séance de validation, R21 §5.5), la cliente valide 12 contenus intemporels tirés de ses propres actifs : citations de ses sermons passés (le fond de catalogue de 10 anciens sermons pour une église), gestes d'usage, textures et rituels de ses produits pour une marque de beauté, métiers et anciens élèves pour une école. Aucun prix, aucune allégation, aucun visage non consenti. Elle est renouvelée chaque mois depuis les actifs du client, avec ancrage réel obligatoire, pour ne pas devenir générique chez le client le plus silencieux, qui est aussi le plus à risque. Les deux propositions de réserve de chaque planche la réalimentent.

La réserve enrichie couvre aussi les créneaux promotion : contenus produit sans prix ni allégation (usage, texture, geste), ce qui évite des créneaux vides chez une marque qui ne répond pas (CR2 §1). Un client silencieux ne coûte rien en génération au-delà de la réserve.

**Signal de départ.** Deux planches en silence, une hausse des « À revoir » sur trois semaines ou un délai de réponse médian qui s'allonge déclenchent l'alerte « risque de départ » : alerte à José, revue de 20 minutes proposée (R08 §10.18).

### 3.8 Le mandat tendance

Option du contrat, cochée ou non par le client. Elle autorise le gestionnaire à valider à la place du client une proposition de voie rapide, puis à l'informer dans le récapitulatif. Elle est limitée aux formats sans visage, sans prix et sans sujet religieux. Elle n'existe pas pour les églises, SEVARTA et 2IAE, ni pour toute allégation beauté. Le contenu porte la provenance `mandat_tendance`, visible dans le rapport. Raison : à Abidjan, une fenêtre de 4 heures pour répondre à une tendance est trop courte pour une fondatrice qui tient sa boutique (CR2 §2.4).

### 3.9 La voie rapide : statique, puis vidéo

La voie rapide ne part que dans une fenêtre de 24 heures déjà ouverte par le client, sans modèle payant. Hors fenêtre, le gestionnaire appelle, ou le mandat tendance s'applique. Le modèle `tendance_express` de la v1 est supprimé (risque de reclassement marketing, R22 §3.1).

| Étape | Délai cible | Repli |
|---|---|---|
| Détection, dédoublonnage (URL, hash, `pg_trgm`), scoring Haiku | moins de 15 minutes | aucun |
| Vérification à deux sources dont une primaire (R06 §16.13) | moins de 45 minutes | une seule source : `a_verifier_humain` |
| Proposition au gestionnaire : angle, source, visuel statique (phase 2) ou gabarit vidéo Remotion déjà prêt pour ce format de tendance (fin de phase 2) | moins d'une heure | statique si aucun gabarit ne colle |
| Si un visage est nécessaire : script de 15 secondes envoyé à la cliente, qu'elle tourne | même jour | sinon format sans visage |
| Son : attaché par l'Instagram Audio API (1er juin 2026, R26 §3) ; sur TikTok, ajouté à la main dans l'application, seulement si la bibliothèque commerciale le permet (drapeau « usage commercial à vérifier », R06 §12) | à la publication | sans son tendance |
| Validation client dans la fenêtre ouverte, ou mandat tendance | 4 heures | aucune publication sans oui ni mandat |
| Publication | cible 24 heures après détection | paquet manuel |

Sujets politiques et religieux controversés exclus pour les églises, SEVARTA et 2IAE (R06 §16.16).

**Le chronomètre et ses angles morts.** Le délai part de `signal.detected_at`, ou de la date de première apparition d'un son dans le Creative Center quand elle est connue (R06 §16.4). Une tendance que la Machine ne voit pas n'entre jamais dans ce délai : d'où la **boîte à tendances de la cliente** (phase 2). Elle transfère un lien TikTok ou Reel au numéro de la Machine ; le lien devient un `signal` daté de son envoi, part en voie rapide, et alimente l'indicateur « tendances vues par vous avant nous » (R21 §4.1). Cibles par nature de signal : tendance 24 heures, nouveauté produit 72 heures, événement 48 heures, sermon 24 heures (R09 §11.16).

### 3.10 Les trois portes humaines

Porte 1 : planche avant envoi, par le gestionnaire. Porte 2 : le client. Porte 3 : rendu final avant publication (R01 §8.9).

Publication sans porte 3 seulement pour un contenu validé sur planche, sans drapeau « personne réelle », « promotion » ni « verticale réglementée ». Jamais sur TikTok ni YouTube. Pour TikTok, l'écran de porte 3 de la PWA reprend ce qu'exige l'audit (R02 §12.3) : réglage de confidentialité choisi sans valeur par défaut, aperçu du média, case de divulgation commerciale, consentement exprès par publication. Le même écran sert de vidéo pour l'audit TikTok déposé en fin de phase 1. Pour les églises, chaque extrait passe par le pasteur (R09 §5.7). Un rendu non relu à l'échéance est reporté d'un jour avec alerte, jamais publié.

### 3.11 Les exceptions assumées

Ces cas contournent un principe ; ils sont écrits pour être visibles, pas tolérés en silence.

| Exception | Condition | Jamais pour |
|---|---|---|
| Version n+1 envoyée sans relecture | motif « À revoir » standard coché (pas « autre »), juge d'au moins 15, dans la fenêtre de 24 heures | églises, beauté |
| Publication de la réserve sans nouveau oui | règle « réserve » cochée au contrat, contenu validé à l'onboarding ou sur une planche | contenu promotionnel avec prix |
| Mandat tendance | option cochée, format sans visage, sans prix, sans sujet religieux | églises, SEVARTA, 2IAE, allégations beauté |
| Publication sans porte 3 | contenu validé sans drapeau | TikTok, YouTube, promotion, personne réelle, verticale réglementée |
| Bouton « Approuver tout ce qui est prêt » de José | éléments déjà passés en porte 3 | porte 1, rendus non contrôlés |
| Planche produite par Sonnet 5.5 | Opus 5.5 non terminé à 08:00 | aucun : le juge et la porte 1 s'appliquent pareil |

### 3.12 Reprise après panne et replis

Identifiant externe écrit avant chaque appel (conteneur Meta, `publish_id` TikTok, requête Higgsfield ou fal, `batch_id` et `custom_id` Anthropic, résultats conservés 29 jours, R07 §11.4) ; au redémarrage, relecture de l'état chez le fournisseur, jamais de resoumission ni de republication d'un conteneur `FINISHED`. Aucune tâche de plus de 30 minutes sans point de reprise (R07 §8.3) : un sermon est une chaîne de tâches. Services `worker` et `rendu` séparés, arrêt gracieux `SIGTERM` sous 30 secondes, aucun volume sur un service applicatif. Médias WhatsApp téléchargés dans la minute (URL valable 5 minutes, R21 §9.9) ; sorties de génération copiées sous 24 heures puis supprimées chez le fournisseur quand c'est possible (règle de transit, CR1 §2.E).

| Panne | Repli |
|---|---|
| API Higgsfield (lancée le 16 septembre 2026) | Kling 3.0 via fal, 0,112 $ la seconde (R04) |
| Opus 5.5 lent ou en erreur | Sonnet 5.5 automatique à 08:00 |
| Numéro WhatsApp principal bloqué ou en note rouge | numéro de réserve dans le même compte WhatsApp Business |
| Upload-Post en panne ou refus | paquet manuel « prêt à publier » |
| Jeton invalide (erreur 190, 401) | état `a_reconnecter`, publications en `en_attente_reconnexion` |
| Facture Railway qui dérive | disjoncteurs applicatifs, puis limite dure à 3 fois la facture |

---
## 4. Les routines par verticale

Les séquences par déclencheur vivent dans `ref.sequence_template` (lancement produit 5 étapes, sortie de livre 8, événement 5, admission 4, R09 §11.15) : le client valide une séquence entière, proposition par proposition. Benchmarks encodés par verticale (R09 §11.1), remplacés par la médiane locale après trois mois (R24 §10.13). Chaque élément porte sa phase : 1 (19 octobre au 13 décembre 2026), 2 (14 décembre 2026 au 28 février 2027), 3 (mars à mai 2027), 4 (été 2027).

### 4.1 Église : le sermon (Chaire)

**Sources** : PubSubHubbub de la chaîne (gratuit, hors quota, R21 §9.6) pour savoir qu'un sermon existe ; fichier déposé par la régie dans un Drive partagé (`changes.watch`) ou audio seul par WhatsApp pour l'avoir. Jamais de téléchargement depuis YouTube (R08 §10.11). La salle Daily (1,21 $ par sermon de 90 minutes, R21 §9.7) est reportée et n'entre qu'après un test d'écriture vers un bucket Railway (CR1 §2.E).

**Chaîne** : proxy 720p (le disque éphémère de `rendu` est mesuré en phase 0), AssemblyAI Universal-3.5 Pro à 0,21 $ par heure avec `language=fr` forcé (R05 §8.3), segmentation Haiku 4.5, choix des moments, titres et hooks par Opus 5.5 avec transcription en cache (0,14 $, 0,07 $ en Batch, R07 §7), exclusion des annonces et de la quête, aucune coupe dans un verset, versets résolus contre une Segond 1910 locale (R05 §8.7), découpe ffmpeg, recadrage centré, sous-titres karaoké libass, habillage Remotion avec une introduction originale de 2 secondes contre le critère « gabarit » de YouTube du 16 juillet 2026 (R11 §15.8), floutage du public, aucun enfant.

| Élément | Contenu | Phase |
|---|---|---|
| Clips | 5 par semaine (3 en Chaire Essentiel) : TikTok 15 à 30 s, Reels 30 à 45 s, Shorts 45 à 58 s, Facebook 45 à 75 s | 1 |
| Highlights animés | 2 par sermon, typographie cinétique Remotion sur la phrase forte et la voix du pasteur, quelques centimes, sans étiquette IA (R05 §3.8, R11 §6.3) | 1 |
| Verset animé | 1 par sermon, verset résolu contre la Segond 1910, texte posé par composition, jamais par un modèle de diffusion | 1 |
| Audiogrammes | forme d'onde calculée en ffmpeg (`showwaves`) ou Remotion, sans service payant (R05 §3.8) ; pour le Status et les églises sans vidéo exploitable | 1 |
| Format long | 2 à 3 minutes, le jeudi (Shorts jusqu'à 3 minutes, Instagram jusqu'à 15 minutes, Facebook Reels 90 s, R26 §2.1 et §5.1) | 1 |
| Citations et dévotionnel | citations graphiques en HTML ; dévotionnel de cinq jours pour le Channel en paquet manuel (R10 §8.1) ; chapitrage poussé par `videos.update` (R05 §3.9) | 1 |
| Fond de catalogue des sermons | à l'onboarding, l'église fournit ses 10 meilleurs anciens sermons ; la Machine en tire une série thématique et la réserve de démarrage ; preuve visible dès la semaine 1 | 1, fait partie du pilote |
| Deux comptes | église et pasteur (4 à 10 fois l'audience, R09 §11.7) | 1 |
| Recadrage par suivi de visage (MediaPipe) | | 2 |
| Réponse vidéo aux commentaires | trois questions identiques produisent un script de réponse que le pasteur tourne | 3 |
| Trial Reels | montrer un clip d'abord aux non-abonnés (R26 §5.5) | 4 |

Coût : 0,80 à 2,50 $ par sermon (R05 §4), sans étiquette IA (R04 §8.5). Humain : validation doctrinale de chaque extrait, message face caméra, témoignages consentis, prières (R23 §8.5). Voix de marque : extraite des sermons transcrits, pas des posts de la page.

### 4.2 Beauté : le dépôt de produits (Dépôt)

**Sources** : fiches produit du site (crawl quotidien, flux Shopify ou WordPress, R06 §16.10), dépôts WhatsApp, commentaires, calendrier commercial et saison ; Creative Center TikTok du pays en phase 3.

**Déclencheur produit déposé** : la fondatrice envoie deux photos normales (face et dos). Accusé de réception structuré dans la minute avec boutons (R21 §9.10) ; extraction Sonnet 5.5 en JSON Schema (0,015 $, R21 §9.1) ; INCI vérifié contre une base de noms (R21 §9.5). Le document n'est demandé que si la zone INCI est illisible. Mini-planche sous 24 heures, dans la fenêtre ouverte par le dépôt : teaser J-3, unboxing J0, tutoriel J+3, carrousel teintes J+7, rappel WhatsApp J+10 (R09 §3.8).

| Élément | Contenu | Phase |
|---|---|---|
| Dépôt et mini-planche | photo normale, maquette produite, INCI vérifié | 2 |
| Packshot réel détouré | Photoroom 0,02 $ (R03 §12.6), remis en scène, jamais synthétisé | 2 |
| Carrousels, visuels avec texte HTML, légendes PAS, BAB, FAB | | 2 |
| Reels génératifs produit | 15 à 20 s par l'API Higgsfield (Kling 3.0), repli Kling 3.0 via fal ; plafond de génération au contrat | fin de phase 2 |
| Couverture du catalogue | chaque produit du site montré au moins une fois tous les 90 jours, mesuré sur le crawl quotidien (R06 §16.10) | 2 |
| Produit oublié du mois | le produit le moins montré entre d'office dans une planche du mois (R11 §12) | 2 |
| Réserve produit | contenus sans prix ni allégation (usage, texture, geste) pour les créneaux promotion sans réponse | 2 |
| Tournage guidé | script de 15 à 20 s, plan dessiné et exemple dans la planche ; la cliente filme, la Machine monte et sous-titre (R09 §3.4, R11 §15.16) | 2 |
| Collecte d'UGC réel « AVIS » | mot clé « AVIS » en commentaire ou par Click-to-WhatsApp, demande de vidéo à la cliente finale, lien de consentement signé rangé dans `consent` (R23 §8.3 et §8.17, R09 §3.7) ; c'est la source des 4 UGC montés de Vidéo+ | 3 |
| Réponse vidéo aux commentaires | trois questions identiques sur un produit donnent un script de réponse à tourner (R09 §3.4) | 3 |

Avant la collecte « AVIS », les UGC de Vidéo+ viennent des vidéos que la fondatrice obtient elle-même de ses clientes, avec le même lien de consentement. Deux plateformes par pays : Facebook et TikTok à Abidjan (Instagram y est marginal, R10 §2.1), Instagram et TikTok à Toronto, WhatsApp pour la relation. Humain : tout visage (20 % du mix 100 % humain, R11 §15.16), toute allégation (Santé Canada, règlement 655/2013, règles Meta du 23 juillet 2026, R26 §2.8), tout comparatif, exclusion de l'éclaircissement de la peau (R09 §11.10), plaintes. Pas de « Je valide tout ».

### 4.3 Association culturelle : événements et genèse

**Sources** : agenda du site, flyers déposés (OCR Haiku 4.5 à 0,005 $ : titre, dates, lieu, prix, R21 §2.1), agendas de ville (Toronto Open Data, BlogTO, Abidjan.net), journées internationales ; pages Facebook des festivals et Google Events en phase 3 (R10 §8.10, R06 §16.2).

**Déclencheur événement** : teaser J-21, genèse J-14, programme J-7, rappel J-1, récap J+2 (R09 §4.8). Événement tiers : carrousel « à voir cette semaine ». Journée internationale : citation animée.

| Élément | Contenu | Phase |
|---|---|---|
| Teaser Remotion 10 à 20 s, carrousels programme, affiche (scène générée, texte HTML), QR dynamique sur chaque support (R24 §10.4) | | 2 |
| Genèse en vidéo animée | Remotion 30 à 60 s (R09 §4.4) à partir des archives photo de l'association et d'un vocal du président qui raconte l'histoire ; chaque fait sourcé (deux sources dont une primaire, R06 §16.13) ; relecture humaine des faits | 3, ordre type « Confier à Claude » |
| Agenda culturel de la semaine | carrousel automatique | 3 |
| Récap d'événement | montage 30 à 60 s des plans fournis par l'association | 2 |

Le vocal du président est demandé pour éviter une genèse faite de seules recherches web, sans récit vivant (CR2 §1). Public double au Canada : membres (WhatsApp, Facebook) et ville (Instagram, agendas, bilingue), avec un calendrier février, juin, août, septembre (R10 §8.17). Le premier client de Toronto vise le Mois de l'histoire des Noirs seulement s'il est signé avant le 10 janvier 2027, sinon l'été. Humain : portraits, directs, faits de genèse, crédits, autorisations (foule en plan large tolérée, personne individualisée interdite sans accord, R08 §7.4).

### 4.4 Édition : SEVARTA

Sources : base des titres, chaîne YouTube des auteurs (chaîne Chaire, R09 §11.6), avis, page Amazon par Firecrawl, calendrier liturgique, salons. Déclencheur nouveau titre : séquence de six semaines (couverture J-42, extrait J-28, précommande J-21, extrait J-14, interview J-7, sortie J0, avis J+14, bilan J+30, R09 §6.3). Formats : citations animées, carrousels « 5 idées du chapitre », révélation de couverture, audiogrammes (phase 1, client interne) ; bande-annonce de 15 à 30 s en Seedance 2.5 par l'API Higgsfield, 9,30 à 18,50 $ avec 3 prises, musique en plus (fin de phase 2). Humain : lecture par l'auteur (voix réelle, ou clonée consentie et étiquetée, voix clonées reportées après le MVP), interview, validation doctrinale. Les clips musicaux SEVARTA ne sont pas un produit de la plateforme.

### 4.5 École : 2IAE

Sources : calendrier académique (rentrée le 14 septembre 2026, inscriptions du 25 août au 30 septembre, réorientations en janvier et février, R10 §5.1), site public, registre des autorisations d'image, données publiques du campus seulement. Déclencheurs : admission J-30, rentrée J-14, résultat, événement (récap sous 48 heures), nouvelle formation (carrousel métiers, R09 §7.8). Formats : comptes à rebours Remotion, carrousels métiers, récaps montés, miniatures, message WhatsApp hebdomadaire (phase 2, pour la réorientation de janvier) ; documents LinkedIn (phase 3). Les événements GA4 sont demandés à la session du site, qui seule touche au site. Humain : ambassadeurs, enseignants, autorisation parentale pour tout mineur avec blocage automatique (R09 §11.9).

### 4.6 B2B : Markel-Tech

Sources : registre des projets livrés, questions clients, veille sectorielle. Déclencheurs : projet en ligne (avant-après J+3, étude de cas J+14 après accord écrit, témoignage J+30), trois questions identiques (check-list), fin de mois (sondage, R09 §8.8). Formats : documents natifs (7,00 %, meilleur format LinkedIn), carrousels (6,45 %), sondages ; jamais de lien externe en premier (3,25 %) (R09 §2.1). Page entreprise par la Community Management API (phase 3) ; posts du fondateur publiés par José.

**Vidéo explicative de logiciel (phase 3).** Déclencheur « projet Markel-Tech livré » : la Machine demande au client un compte de démonstration, écrit un script de 60 à 90 secondes que le client valide, puis produit la vidéo à partir d'un parcours Playwright scripté (zooms et curseur Remotion, voix gpt-4o-mini-tts ou voix clonée consentie, sous-titres), pour 0,15 à 0,40 $ de coût marchand (R04 §6). Contrôle : chaque étape du script retrouvée sur une image clé, lisibilité à 390 px. Vendue à l'unité, prix à fixer. Ordre type du bouton « Confier à Claude ».

### 4.7 Mécanismes communs à toutes les verticales

| Mécanisme | Contenu | Phase |
|---|---|---|
| Voix de marque tirée de la parole réelle | sermons transcrits, vocaux de la fondatrice, réponses aux commentaires, page « à propos » ; jamais les posts d'une agence précédente ni des brouillons IA ; test d'acceptation en aveugle : deux relecteurs trient des textes générés mêlés à de vrais textes, et s'ils battent le hasard confortablement, la fiche n'est pas finie (R11 §5.1) | 1 |
| Vocal du lundi | une minute de vocal « ma semaine, mes nouveautés, mes événements » devient l'entrée prioritaire de l'idéation (R22 §10.9) | 2 |
| Boîte à tendances de la cliente | lien transféré au numéro de la Machine, signal daté de son envoi | 2 |
| Bibliothèque de formats gagnants par verticale | structures seulement (famille de hook, format, durée), jamais le contenu d'un client (R11 §15.9) | dès le mois 2 d'exploitation |
| « Ce qui marche chez vos voisins cette semaine » | carte dans la planche et page du rapport, par Business Discovery sur 5 à 10 comptes voisins (R06 §4.3, R09 §11.17), sous réserve de l'accès avancé Meta | 3 |
| Remontée des meilleurs contenus | un contenu gagnant revient avec un nouveau hook ou décliné (Reel vers carrousel, clip vers verset animé), jamais reposté tel quel (R11 §10) | 3 |
| Pré-test des hooks adapté au pays | Trial Reels au Canada (R26 §5.5) ; à Abidjan, variantes sur TikTok et Facebook à des jours distincts, rétention à 3 s montrée (R11 §7.1, R10 §2.1) | 4 |

---
## 5. La planche de propositions et la validation client

### 5.1 Deux vues d'un même objet

La planche est un objet versionné (`board`, `board_version`, `board_item`). Le client et le gestionnaire n'en voient pas la même chose.

| Vue client | Vue gestionnaire (en plus) |
|---|---|
| visuel ou aperçu, numéroté | pilier, framework, score du juge par critère |
| hook en moins de 8 mots, en français parlé si la fiche de voix l'autorise (R10 §8.8) | faits et sources, confiance par champ |
| jour et réseau | moteur des maquettes, coût prévu si tout est validé, coût contre plafond |
| « ce que nous attendons de vous » (« filmez 20 secondes d'application sur votre main avant mercredi », R09 §11.11) | drapeaux : personne réelle, promotion, verticale réglementée, `ai_label` |
| en détail (un tap) : texte complet, « Source : URL » sous chaque fait (R06 §16.13), « faits à confirmer » posés comme une question (R11 §15.15) | historique des versions, motifs « À revoir » |

Pilier, framework et coût sont du vocabulaire d'agence : ils ne sont jamais montrés au client (CR2 §2.2).

### 5.2 Le composite et l'aperçu vidéo

Le composite est une image 1080 × 1350 de moins de 5 Mo pour l'en-tête du modèle WhatsApp, avec **6 vignettes numérotées au plus** (environ 350 px par vignette à l'écran d'un téléphone). Chaque vignette porte un numéro, le jour et le réseau, et un bandeau « MAQUETTE » sur les visuels non définitifs. Quand une planche compte plus de six propositions (une semaine Chaire : 5 clips, 2 highlights, 1 verset, 1 format long), le composite montre les six premières et la PWA montre tout. La page PWA est dessinée pour 390 px, une carte par proposition, vignettes sous 300 Ko (R22 §10.8 et §10.14). Rendu React par Playwright sur le service `rendu`.

**Aperçu vidéo.** Une image fixe ne permet pas de valider une vidéo. Pour chaque proposition vidéo, un aperçu de 5 à 6 secondes part dans la fenêtre de 24 heures ouverte par le tap de la cliente, en message à boutons avec en-tête vidéo (jusqu'à 3 boutons, R22 §1.1) : « Je valide », « À revoir ». Pour un clip de sermon, l'aperçu est un extrait du vrai clip, sans coût de génération. Pour un Reel génératif, c'est une prise unique en brouillon LTX-2.3 (0,06 $ la seconde, soit environ 0,30 à 0,36 $, R04 §8.3). Pour un gabarit Remotion, c'est le rendu basse définition de la composition.

### 5.3 Canaux

**WhatsApp Business Platform en accès direct Cloud API** sous le portefeuille Markel-Tech, sans fournisseur intermédiaire (R22 §10.1) ; trois numéros dans le même compte : SIM +225, numéro +1, numéro de réserve ; entreprise vérifiée (R22 §10.3).

**Cinq modèles utilitaires seulement**, soumis en phase 0 :

| Modèle | Usage | Pourquoi il reste utilitaire |
|---|---|---|
| `planche_prete` | planche de la semaine, et ses deux rappels avec la date limite | lié à une planche précise que le client a commandée |
| `production_terminee` | rendu d'une vidéo que la cliente a tournée ou demandée | lié à une demande précise |
| `publication_faite` | récapitulatif du dimanche | liste de publications effectuées pour le client |
| `confirmation_optin` | à la signature | transaction d'abonnement |
| `alerte_gestionnaire` | alertes rouges au gestionnaire et à José | interne |

Texte du modèle principal : « Bonjour {{1}}, votre planche n° {{2}} ({{3}} propositions) est prête pour validation. Merci de répondre avant le {{4}}. » Le rapport mensuel part au tarif marketing (0,0225 $ en Côte d'Ivoire, R22 §0), budgété comme tel. Le webhook `message_template_category_update` bloque tout modèle reclassé et alerte José (R22 §10.5). L'image en en-tête d'un message Flow n'est pas confirmée (R22 §9.3) : le Flow n'est jamais le premier message.

**Le tap** ouvre la fenêtre de 24 heures. En phase 1, il mène au lien magique (PWA) ; en phase 2, à un Flow générique à deux écrans (validées ; à revoir avec motifs), en mode `navigate` sans endpoint (R22 §10.6 et §10.7). **Vocaux** : téléchargés sous 5 minutes, transcrits par `gpt-4o-mini-transcribe` (0,003 $ la minute), renvoyés en citation avec « C'est bien ça ? », puis transformés en instruction de retouche (R22 §10.9). **Courriel (Resend)** : même lien signé, composite en pièce jointe, désinscription (CASL), en double au Canada. **Lien magique** : jeton de 256 bits haché en base (`magic_link.token_hash`), une planche, expiration 14 jours, révocation à la clôture ; même table `validation` que WhatsApp. Toute validation vaut accord écrit (R08 §8.1.2).

### 5.4 Comment chaque client valide

| Verticale | Bouton « Je valide tout » | Validation |
|---|---|---|
| Église | non | chaque extrait, dans la PWA (phase 1) ou le Flow (phase 2) ; validation doctrinale tracée |
| Beauté | non | chaque proposition ; allégations relues par le gestionnaire avant la planche |
| Association, école, SEVARTA, Markel-Tech | oui, sur le composite de 6 vignettes au plus | en un tap, ou pièce par pièce |

Le bouton est retiré du modèle pour les églises et la beauté : à 350 px par vignette, il pousse à valider sans lire (CR1 §2.Q), et ces deux verticales portent un risque doctrinal ou réglementaire.

### 5.5 Le budget de messages, mesuré et bloquant

Chaque message envoyé ou reçu est écrit dans `whatsapp_message` (client, modèle, catégorie, prix appliqué, fenêtre ouverte ou non). Le tick H0 calcule le compteur du mois avant chaque envoi.

| Messages hors fenêtre (modèles) par client et par mois | Nombre |
|---|---|
| `planche_prete` | 4 (5 les mois de cinq semaines) |
| `publication_faite`, récapitulatif du dimanche | 4 (5) |
| Rapport mensuel (marketing) | 1 |
| Rappels (`planche_prete`) et `production_terminee` | ce qui reste sous le plafond |
| **Plafond dur** | **12** |

Au douzième modèle, le suivant est bloqué : le rappel devient un appel du gestionnaire, la production terminée attend le récapitulatif, et l'alerte apparaît dans la file « En attente client ». Les messages dans une fenêtre ouverte par le client (accusés de réception, aperçus vidéo, version n+1, mini-planche d'un dépôt, voie rapide, boîte à tendances) ne comptent pas dans ce plafond ; ils sont comptés à part, et plus de 30 par mois déclenchent une revue avec la cliente, signe de friction. Coût : environ 0,07 $ par client et par mois en modèles (11 × 0,004 $ plus 0,0225 $) ; la franchise de 1 000 messages de service par numéro et par mois reste à confirmer sur la page Meta (R22 §3.6, R10 §9.3).

Tout le reste (propositions de boost, séquences d'événement en cours, productions en route) est regroupé dans le récapitulatif du dimanche. Le pasteur ne reçoit plus deux planches par semaine.

### 5.6 États, relances, versions

États de la planche : `brouillon`, `relue`, `envoyee`, `vue` (webhook `read`), `partiellement_validee`, `validee`, `a_revoir`, `expiree`, `remplacee`. Relances J+3 et J+5 (Chaire : mardi et mercredi midi), puis humain, jamais de troisième (R22 §10.10).

Un « À revoir » génère la version n+1 depuis le motif coché ou le vocal transcrit (Opus 5.5, cerveau en cache) ; seules les propositions révisées repartent, dans la fenêtre de 24 heures, en message interactif sans modèle payant. La relecture par le gestionnaire est la règle ; l'envoi sans relecture est une exception assumée (section 3.11) : motif standard, juge d'au moins 15, jamais pour une église ni une marque de beauté. Historique conservé la durée du contrat plus 12 mois (R08 §4.3). Indicateurs : acceptation sans modification majeure (70 %, R11 §12), délai dépôt vers planche (24 heures, R21 §9.18).

### 5.7 Opt-in et conformité

Opt-in nominatif en deux cases au contrat, journal de preuve (horodatage, source, texte, numéro haché), STOP automatique, `confirmation_optin` à la signature (R22 §10.12). Aucune prospection sortante. Grille Meta datée dans `ref.tarif_whatsapp` (R22 §10.16). L'onboarding complet (1 à 2 semaines, réserve de démarrage, fond de catalogue) est décrit en annexe B.

---

## 6. Le poste de pilotage du gestionnaire

Une PWA React pensée pour un téléphone, mêmes composants que le reste. WhatsApp pour l'alerte, la PWA pour l'écran, le courriel pour le récapitulatif quotidien (R22 §7.1). Web Push (VAPID) arrive en phase 2.

### 6.1 Accès et authentification

Le gestionnaire se connecte par passkey, ou par lien envoyé par courriel suivi d'un code TOTP. Sessions de 12 heures. Ses droits viennent de `membership` (gestionnaire, administrateur, lecture seule) et ne couvrent que les clients qui lui sont attribués. Chaque action (validation, publication, relèvement de plafond, lecture d'un consentement) est écrite dans un journal d'audit (CR1 §2.L). Le second administrateur a son propre accès, jamais celui de José.

### 6.2 Les files : quatre au MVP, neuf ensuite

| File | Contenu | Action en un clic | Phase |
|---|---|---|---|
| À relire (porte 1) | planches en brouillon, délai restant ; au MVP, aussi les « À revoir » | « Approuver et envoyer », « Modifier », « Retirer une proposition » | 1 |
| En attente client | planches envoyées, J+n, rappels, plafond de messages, voie rapide (chronomètre sur 4 heures) | « Relancer maintenant », « Appeler », « Appliquer la réserve » | 1 |
| À contrôler (porte 3) | rendus terminés, checklist (orthographe, droits, étiquette IA, musique), contrôle en trois couches, écran TikTok | « Approuver et programmer », « Retouche », « Remplacer par une réserve » | 1 |
| À publier à la main | Channels et Status WhatsApp, dévotionnels, TikTok avec son ajouté dans l'application, carrousels de 11 à 20 (R02 §10.5) | « Copier le texte », « Télécharger le média », « Ouvrir dans l'app », « J'ai publié : coller l'URL » | 1 |
| Panneau « état des jetons » | jetons, PubSubHubbub, canal Drive, test hebdomadaire | « Envoyer le lien de reconnexion » | 1 (panneau), 2 (file) |
| Retours à traiter | « À revoir » avec motif, vocal transcrit, version n+1 prête | « Envoyer la v2 », « Reprendre à la main » | 2 |
| Dépôts incomplets | INCI illisible, flyer sans date, photo inexploitable | « Demander la pièce manquante » | 2 |
| Coûts | clients à 80 % du plafond, tâches en dead letter (R25 §11.12) | « Relever le plafond pour la journée », « Basculer en brouillon », « Relancer la tâche » | 2 |
| Commentaires et messages sensibles | critiques, prière, santé, argent, doctrine (R23 §8.5) | « Envoyer le brouillon » (HUMAN_AGENT journalisé), « Transmettre au client » | 3, après l'accès avancé Meta |

### 6.3 Chronométrage des minutes par client

Le temps humain est le premier poste de coût et la première inconnue. La PWA le mesure dès le premier jour du pilote :

- chaque ouverture d'un élément ouvre un compteur rattaché au client, fermé à l'action ou après 2 minutes d'inactivité ;
- les appels, les paquets manuels et les tournages se chronomètrent par un bouton « démarrer, arrêter » sur la ligne ;
- l'écran « Agence » affiche les minutes par client et par semaine, par file et par verticale.

Cibles : Chaire au plus 120 minutes par semaine (8 heures par mois), Vidéo+ au plus 180 minutes (12 heures par mois). Plus de 8 heures par mois pour Chaire deux mois de suite est un critère d'arrêt ou de révision de prix (annexe H, CR3 §5.9).

### 6.4 Autres écrans

**Client** (Relation, Marque, Affaires : règle sans réponse, mandat tendance, consentements, fiche de voix, réserve, liens et conversions). **Planche** (vue client plus colonnes cachées). **Production**. **Conformité** (consentements, `licence_registry`, étiquettes IA, versions bibliques). **Agence**, pour José (coûts par client et par fournisseur, facture Railway, minutes de gestionnaire, tests, bancs). **Confier à Claude** (phase 3) : ordres types envoyés à une Routine, résultat rangé dans « À relire ».

### 6.5 Alertes

Niveau rouge, par `alerte_gestionnaire` (Web Push en plus dès la phase 2) avec lien profond : planche non relue à 24 heures (Chaire : à 11:30 le lundi) ; client sans réponse à J+5 ; plafond de messages atteint ; voie rapide à 3 heures sans décision ; trois refus du juge ; plafond de génération à 80 % puis 100 % ; jeton à reconnecter ; publication échouée trois fois ; modèle reclassé ; note de qualité du numéro en orange ; « invalid metric » ; publication bloquée faute d'étiquette ou de consentement ; conversation Click-to-WhatsApp sans réponse depuis 2 heures (phase 3, R23 §8.17).

**Risque de départ**, alerte élargie : deux planches en silence, hausse des « À revoir » sur trois semaines, ou délai médian de réponse qui s'allonge trois semaines de suite.

### 6.6 Indicateurs « à la page », en semaine et dans le rapport

| Indicateur | Cible | Phase |
|---|---|---|
| Sermons réemployés (3 clips au moins sous 7 jours) | 100 % | 1 |
| Délai médian signal vers publication | tendance 24 h, nouveauté 72 h, événement 48 h, sermon 24 h | 1 (sermon), 2 (autres) |
| Tendances vues par le client avant nous (boîte à tendances) | chaque cas analysé ; nombre en baisse d'un trimestre à l'autre | 2 |
| Nouveautés exploitées sous 14 jours | 100 % | 2 |
| Couverture du catalogue (chaque produit montré au moins une fois sur 90 jours) | 100 % | 2 |
| Ce qui marche chez les voisins (5 à 10 comptes suivis) | carte présente chaque semaine | 3 |
| Taux de vidéos | 40 à 60 % selon la verticale | 1 |
| Ancrage réel (au moins un actif réel) | 80 % et plus ; 3/3 pour le pilier relation | 1 |
| Acceptation des planches sans modification majeure | 70 % et plus | 1 |
| Écart au mix 60/25/15 | moins de 10 points | 1 |
| Étiquetage IA conforme | 100 % | 1 |
| Délai de première réponse aux commentaires (option boîte de réception) | sous 24 h ouvrées | 3 |
| Envois et enregistrements par portée, rétention à 3 secondes | contre la médiane de la verticale, puis la médiane locale (R24 §10.13) | 1 |
| Minutes de gestionnaire par client et par semaine (interne) | Chaire 120, Vidéo+ 180 au plus | 1 |

Les cinq premières lignes répondent aux reproches des clients perdus (« pas à la page ») ; la dernière n'est jamais montrée au client.

### 6.7 Le message du lundi à José

Lundi 07:00 : planches en attente par porte, clients en risque de départ, minutes de gestionnaire de la semaine par client, coût de génération contre plafond, alertes ouvertes, et le bouton « Approuver tout ce qui est prêt » limité aux éléments déjà passés en porte 3. En mode José absent, le message part au second administrateur sans ce bouton.

## 7. L'usine de production

### 7.1 Principes

Deux couches partout (R03 §12.1) : un moteur génératif pour les scènes, une composition déterministe (React rendu par Playwright, Remotion pour la vidéo) pour tout texte, logo et aplat. Un titre, une date, un prix, un verset ne dépendent jamais d'un modèle de diffusion.

Quatre familles abstraites (`ImageProvider`, `VideoProvider`, `TranscribeProvider`, `TtsProvider`), chacune avec défaut, repli et ligne dans `engine_registry` (moteur, version, `dernier_test_ok`, `cout_unitaire_mesure`), parce qu'un fournisseur change tous les trois mois : gpt-image-1 s'arrête le 23 octobre 2026, gpt-image-1.5 et chatgpt-image-latest le 1er décembre 2026, Sora 2 a quitté l'API le 24 septembre 2026 (R26 §2.2, R04 §0).

Brouillon pour la planche, production après validation (R04 §8.3). Kit de référence par client (`reference_kit`). Aucune référence envoyée à Higgsfield ne montre un pasteur, un auteur, une fondatrice ni un enfant : hors contrat Enterprise, la section 4.4 de ses conditions l'autorise à entraîner ses modèles sur les entrées et les sorties (R26 §2.4).

Profils d'export : « Afrique mobile », 720p vertical sous 10 Mo, 2 premières secondes sans logo (R10 §8.6) ; « Canada », 1080 × 1920 à 8 Mbps ; MP4 sans edit lists, moov en tête, H.264 à GOP fermé, AAC 48 kHz, 300 Mo au plus (R26 §2.1).

`ai_label` calculé par variante (vrai si visage, voix, décor ou produit photoréaliste synthétique ; faux pour le motion design, les captures et la vidéo réelle), posé à la publication (`is_ai_generated`, `is_aigc`), C2PA conservé. Chaque actif garde moteur, version, prompt, références et coût réel lu dans `usage` (R08 §10.8). La vidéo générative, seul poste qui peut tripler une facture, est bornée : 3 prises par plan, réservation dans `cost_ledger` avant l'appel, plafond mensuel, alerte à 80 % (R25 §7.2).

### 7.2 Un moteur par famille au MVP, les replis ensuite

| Famille | Phases 0 et 1 (« Chaire minimal ») | Phase 2 | Phase 3 et suivantes |
|---|---|---|---|
| Image | gpt-image-2.5-flare (génération) et -sunburst (édition masquée), un seul adaptateur OpenAI, Responses API | repli FLUX.2 [pro] via fal (0,03 $) | Nano Banana 2 sur banc |
| Vidéo générative | aucune | API Higgsfield (Kling 3.0, Seedance 2.5) ; repli Kling 3.0 via fal ; LTX-2.3 via fal pour les aperçus | Veo 3.1 Fast, Wan 3.0 |
| Vidéo déterministe | ffmpeg, libass, Remotion CPU | gabarits de voie rapide | MediaPipe |
| Transcription | AssemblyAI Universal-3.5 Pro, `language=fr` ; vocaux par gpt-4o-mini-transcribe | repli ElevenLabs Scribe v2 (0,22 $ l'heure) | banc anglais pour Toronto |
| Voix de synthèse | aucune | gpt-4o-mini-tts (0,015 $ la minute) | voix clonée ElevenLabs (Creator 22 $ par mois) |
| Filet de découpe | API Vizard, 29 $ par mois sans engagement (14,50 $ seulement en annuel), 3 requêtes par minute et 20 par heure (R05 §2.1) | coupée quand la chaîne maison gagne le banc | retirée |

Licence Remotion : gratuite jusqu'à 3 personnes, mais Automators (0,01 $ par rendu, minimum 100 $ par mois) dès que la plateforme vend des rendus automatisés à des clients (R25 §8, R04 §4). Les 100 $ restent au socle jusqu'à réponse écrite de Remotion, demandée en phase 0. Pas de Remotion Lambda : le rendu reste sur Railway.

### 7.3 Tableau récapitulatif par type de contenu (prix des 1er et 2 octobre 2026)

| Type | Chaîne exacte | Coût unitaire | Contrôle spécifique | Repli | Phase |
|---|---|---|---|---|---|
| Post texte, légende, hashtags | Opus 5.5, cerveau en cache 1 h, sortie structurée, rejet au-delà de 5 hashtags (R26 §2.6) | 0,022 $ (0,011 $ en Batch, R07 §7) | juge Haiku 4.5 (0,0045 $), lexique d'allégations | Sonnet 5.5 (0,012 $) | 1 |
| Citation, carte de verset, annonce de culte | gabarit React par client, Playwright 1080 × 1350, verset tiré d'une Segond 1910 locale | moins de 0,01 $ | texte exact par construction, contraste WCAG | aucun | 1 |
| Carrousel 3 à 10 pages | plan JSON Opus 5.5 (0,068 $), slides React, couverture générée en option | 0,07 $ plus la couverture | police d'au moins 40 px, 10 diapositives par API | 11 à 20 en paquet manuel | 1 |
| Visuel avec scène générée | scène gpt-image-2.5-flare, texte en HTML | inconnu avant le banc de 20 générations par qualité ; absent de tout devis (R26 §2.2) | OCR par vision contre le JSON | FLUX.2 [pro] via fal, 0,03 $ (phase 2) | 1 |
| Clips de sermon (5 durées) et format long de 2 à 3 min | proxy 720p, AssemblyAI 0,21 $ l'heure, Haiku 4.5 puis Opus 5.5 (0,14 $), ffmpeg, libass, introduction Remotion de 2 s, floutage | 0,80 à 2,50 $ par sermon pour 8 clips (R05 §4) | verset contre Segond 1910, aucune coupe dans un verset, porte du pasteur | Vizard en filet | 1 |
| 2 highlights animés et 1 verset animé par sermon, audiogrammes | typographie cinétique Remotion sur l'audio ; `showwaves` ffmpeg (R05 §3.8, R09 §5.4) | quelques centimes | texte contre la transcription, étiquette IA fausse | citation fixe | 1 |
| Story | dérivée d'un clip ou d'une carte, hors zones d'interface | moins de 0,05 $ | 60 s, 100 Mo | paquet manuel pour le Status | 1 |
| Reel programmé (compte à rebours, chiffres, tutoriel) | composition React, rendu CPU sur `rendu` | 0,05 à 0,50 $ | durée, zones sûres, hash perceptuel | ffmpeg seul | 1 (église), 2 |
| Planche de propositions | maquettes gpt-image-2.5-flare en low, vignettes de clips, composite à 6 vignettes numérotées au plus | maquettes : coût inconnu avant le banc ; jetons environ 0,10 $ | bandeau « MAQUETTE » | vignettes sans génération | 1 |
| Aperçu vidéo de 5 à 6 s | LTX-2.3 via fal, 1 prise, envoyé dans la fenêtre de 24 h, message à boutons avec en-tête vidéo (R22 §1.1) | 0,30 à 0,36 $ (R04 §2.1) | mention « brouillon » | image fixe | 2 |
| Photo produit mise en scène | packshot réel détouré (Photoroom 0,02 $), fond en édition masquée gpt-image-2.5-sunburst | 0,02 $ plus l'édition (banc) | packaging comparé par vision, conformité beauté | FLUX.2, humain | 2 |
| Voie rapide statique puis vidéo | gabarits HTML puis Remotion par format tendance, son par l'Instagram Audio API quand le connecteur Meta direct publie (R26 §3), script de 15 s si un visage est nécessaire | moins de 0,50 $ | sources, risque, droits du son | son ajouté dans l'application (paquet) | 2 |
| Tournage guidé, montage de vidéo réelle | script, plan dessiné, exemple ; la cliente filme ; Remotion, sous-titres (R09 §3.4) | 0,10 à 0,30 $ | consentement enregistré | aucun | 2 |
| Genèse d'événement animée, 30 à 60 s | recherche sourcée (10 $ les 1 000 recherches), archives photo, vocal du président, Remotion (R09 §4.4) | 0,30 à 0,80 $ hors temps humain (estimation) | deux sources par fait, relecture humaine | carrousel genèse | 2 |
| Vidéo explicative de logiciel, 60 à 90 s | compte de démonstration, script validé, parcours Playwright enregistré, zooms Remotion, voix gpt-4o-mini-tts | 0,15 à 0,40 $ plus le temps humain (R04 §6) ; vendue à l'unité | chaque étape sur une image clé | voix enregistrée de José | 2 |
| Reel génératif produit, 15 à 20 s | Kling 3.0 par l'API Higgsfield (0,084 $ la seconde, R26 §2.4), 3 prises, montage Remotion | 4 à 6,50 $ (R04 §6) | vision sur 3 images clés, étiquette IA vraie | Kling 3.0 via fal (de l'ordre de 0,112 $ la seconde, prix fal à relever) | 2 (fin) |
| Scène signature | Seedance 2.5 par l'API Higgsfield, 4 à 30 s, 50 références, 0,2057 $ la seconde, 3 prises | 9,30 $ (15 s) à 18,50 $ (30 s) plus la musique | sur commande écrite seulement | Kling 3.0 | 2 (fin) |
| Voix et musique | voix réelle par défaut ; voix clonée consentie (ElevenLabs) ; musique native ou sous licence, jamais Suno gratuit (R04 §8.12) | 0,07 $ la minute de voix clonée ; 0 à 0,15 $ de musique | licence vérifiée | voix de catalogue | 3 |

Ordre de grandeur mensuel : moins de 10 $ de production pour une église ; 60 à 80 $ de génération plus 20 à 30 $ de prises écartées pour une marque en Vidéo+ (R04 §6). Le plafond beauté de 120 $ n'absorbe qu'une ou deux scènes signature ; au-delà, elles sont facturées à part (section 12).

### 7.4 Les chaînes nouvelles de la version 2

**Chaire animée (phase 1).** L'analyse Opus 5.5 désigne, en plus des 5 clips, deux passages de 20 à 40 secondes à fort rythme verbal et un verset central. Le passage devient un highlight en typographie cinétique, calé sur les horodatages mot à mot d'AssemblyAI ; le verset, une carte animée de 10 à 15 secondes dont le texte vient de la Segond 1910 locale, jamais du modèle. Aucun moteur génératif, donc pas d'étiquette IA : c'est la réponse à « vidéos animées et highlights » (CR2 §1).

**Proxy 720p des sermons (phase 1).** Un sermon de 90 minutes en 1080p pèse jusqu'à 3,4 Go (R21 §3.5), et la limite du disque éphémère de `rendu` n'est publiée nulle part (CR1 §2.P). L'original arrive en envoi multipart direct dans le bucket ; `rendu` en tire en flux un proxy 720p et l'audio ; chaque clip est découpé par ffmpeg en lecture par plages sur une URL présignée de l'original, sans copier le fichier entier. L'original est supprimé à 30 jours, le proxy et l'audio restent la durée du contrat (à confirmer au contrat). Livrable de phase 0 : remplir le disque de `rendu` par paliers de 1 Go jusqu'à l'erreur et fixer la concurrence en conséquence.

**Fond de catalogue des sermons (phase 1).** Les 10 meilleurs anciens sermons fournis à l'onboarding donnent une série thématique et la réserve de démarrage, donc une preuve dès la semaine 1 (R21 §3.4, R05 §3.10).

**Genèse animée, vidéo explicative, tournage guidé (phase 2).** La genèse exige le vocal du président et deux sources dont une primaire par fait ; sans vocal, carrousel seulement (R06 §13.4). La vidéo explicative part de l'état « livré » d'un projet Markel-Tech (R09 §8.8) et exige un compte de démonstration, jamais la production, et un script validé par écrit. Le tournage guidé met dans la planche un script de 15 à 20 secondes, un plan dessiné et un exemple réel (R11 §15.16).

**Voie rapide vidéo (phase 2).** Une tendance est un son ou un format, pas une image fixe (CR2 §1). Gabarits Remotion par format (liste, avant et après, « POV », compte à rebours, question et réponse), remplis avec les médias réels du client ; cible : publication sous 24 heures après la détection.

### 7.5 Contrôle qualité en trois couches, bloquant avant la planche et avant la publication

**Couche 1, déterministe, 0 $.** Dimensions, poids, encodage (ffprobe), logo par hash perceptuel, couleurs de marque par échantillonnage, zones sûres, contraste WCAG, durée par plateforme, 3 à 5 hashtags, C2PA présent.

**Couche 2, vision sur Haiku 4.5.** Image réduite à 1 000 px (environ 1,30 $ pour mille images, R11 §15.5), zoom à pleine résolution sur les zones de texte, prompt structuré avec logo et packshot de référence, sortie JSON (texte lu, écarts, logo, produit, anomalies anatomiques, lisibilité à 390 px). Jamais « est-ce que ça a l'air IA » : Claude ne détecte pas les images synthétiques et ne nomme pas les personnes (R07 §6.2).

**Couche 3, juge éditorial.** Sept critères notés de 0 à 3 : spécificité, originalité par test de substitution, voix, hook, appel à l'action, ancrage réel, conformité. Seuil 15 sur 21, au moins 2 sur spécificité, voix et conformité (R11 §8.2), et 3 sur 3 en ancrage réel pour tout contenu du pilier relation (CR2 §1). Juge figé (modèle, version de rubrique, hash du prompt), ordre aléatoire contre le biais de position, 40 contre-exemples, calibration mensuelle.

**Boucle de correction.** Édition masquée à deux essais, moteur de repli à partir de la phase 2, puis file humaine. Chaque rejet est journalisé dans `qc_result` par moteur et par client (R03 §10).

### 7.6 Bancs d'essai (phase 0, puis à chaque changement de version)

| Banc | Contenu | Livrable |
|---|---|---|
| Images | 30 phrases françaises accentuées par moteur, notées par OCR (R03 §12.11) ; 20 générations gpt-image-2.5 par qualité (low, medium, high) avec lecture de `usage` (R26 §4.8) | coût réel par maquette et par visuel, écrit dans `engine_registry` |
| Transcription | 5 sermons de référence (Abidjan, Paris, Montréal), WER par moteur (R05 §8.3) ; transcriptions de référence humaines d'environ 7,5 heures d'audio, à payer (CR3 §2.10) | moteur retenu, liste de termes (noms ivoiriens, vocabulaire religieux) |
| Découpe | même banc, chaîne maison contre Vizard | date de coupure de Vizard |
| Vidéo générative (phase 2) | prompts « culte », « prière », « baptême », « enfants », « peau » sur Kling et Seedance via Higgsfield puis via fal (R04 §8.16) | filtres refusés par moteur et par verticale |
| Disque de `rendu` | remplissage par paliers de 1 Go | limite mesurée, concurrence fixée |
| Juge | 50 cas par verticale, cinq essais par configuration (R07 §11.20) | taux de passage, kappa d'au moins 0,6 |
| Santé | test hebdomadaire par fournisseur (horloge H9) | alerte rouge si échec |

---

## 8. La veille et l'intelligence

### 8.1 Phasage

La veille complète est reportée (CR1 §3). Le MVP ne garde que ce qui sert l'église pilote et ne dépend d'aucune revue d'application.

| Flux | Phase | Pourquoi |
|---|---|---|
| A, le client (sa chaîne, son site, ses dépôts) | 1 | indispensable à Chaire, gratuit |
| D, le calendrier des moments | 1 (fêtes fixes, calendrier liturgique, événements de l'église), 2 (complet) | gratuit, sert la planche |
| Boîte à tendances de la cliente | 2 | lien transféré au numéro de la machine |
| Couverture du catalogue | 2 | arrive avec Dépôt beauté |
| B, le domaine et la région | 3 | coût partagé, utile au-delà de trois clients |
| C, formats et sons | 3 | dépend d'Apify et de la lecture de comptes |
| « Ce qui marche chez vos voisins » | 3 | Business Discovery de 5 à 10 concurrents |

Page Public Content Access est abandonné : la permission exige une revue, une vérification d'entreprise et parfois un contrat, et en mode développement elle ne lit que les Pages administrées par l'équipe (R06 §4.3, CR1 §2.B).

### 8.2 Sources par flux et fréquences (R06 §13.2 et §16, R10 §8.10)

| Flux | Sources | Fréquence | Coût | Phase |
|---|---|---|---|---|
| A, le client | Atom et PubSubHubbub de la chaîne YouTube (gratuit, hors quota, réabonnement tous les 3 jours, R21 §9.13), Drive `changes.watch` de la régie (canal renouvelé avant 7 jours), dépôts WhatsApp, crawl quotidien du site | horaire, temps réel, quotidien | 0 $ | 1 |
| D, calendrier | fêtes fixes (Nager, canada-holidays), fêtes lunaires saisies avec fenêtre de deux jours et confirmation la veille, calendrier liturgique, événements vivants (FEMUA, MASA, Afrofest, rentrée, admissions 2IAE), journées ONU (R10 §8.9) | hebdomadaire, horizon 8 semaines | 0 $ | 1 et 2 |
| B, domaine et région | Trending Now RSS (CI, CA, FR), Google News RSS, GDELT, RSS d'Abidjan.net, Fratmat, BlogTO ; SerpApi partagé (Trends, Events, News) ; changedetection.io ; Tavily, Exa | 2 h à hebdomadaire | 25 à 75 $ partagé | 3 |
| C, formats et sons | Apify quotidien du Creative Center TikTok pour trois pays (moins de 20 $) ; 10 sons Reels saisis chaque semaine ; 30 hashtags Instagram par 7 jours et par compte (R06 §4.1) | quotidien, hebdomadaire | 25 à 35 $ partagé | 3 |

L'Instagram Audio API (1er juin 2026) recherche et attache un son à la publication (R26 §2.1) ; les rapports ne disent pas qu'elle liste les sons tendance, qui restent détectés par le flux C (R06 §4.2). Interdits : pytrends et tout scraper Google Trends sur Railway (429, R06 §16.3), NewsAPI, Bing News. Plan B par configuration pour chaque flux gratuit ; scrapers isolés des comptes de publication (R06 §16.18 et §16.20).

### 8.3 Trois entrées nouvelles

**Boîte à tendances de la cliente (phase 2).** La cliente transfère un lien TikTok ou Reels au numéro de la machine ; il devient un `signal` de nature `client`, daté de son envoi, et part en voie rapide. Indicateur affiché : « tendances vues par vous avant nous », part des signaux client sans signal machine antérieur sur le sujet (CR2 §4.1). Un chiffre haut signale une veille défaillante.

**Couverture du catalogue (phase 2).** Le crawl du site alimente `product` (R06 §16.10). Chaque produit actif est montré au moins une fois tous les 90 jours ; la planche propose chaque mois le « produit oublié du mois ». Les réserves contiennent des contenus produit sans prix ni allégation (usage, texture, geste), pour que les créneaux promotion ne restent pas vides quand la cliente se tait (CR2 §1).

**« Ce qui marche chez vos voisins » (phase 3).** Business Discovery lit sans scraping les compteurs publics de 5 à 10 comptes Instagram professionnels voisins (R06 §4.3) : carte dans la planche, page dans le rapport (R09 §11.17). La requête part du compte Instagram de l'agence, dont José a un rôle sur l'application ; si le mode développement ne suffit pas (vérifié en phase 0), la carte attend l'accès avancé.

### 8.4 Pipeline : collecte, dédoublonnage, scoring

1. **Collecte** : `item` avec URL canonique (UTM retirés, liens Google News résolus) et hash de contenu (R06 §13.3).
2. **Dédoublonnage au MVP** : par URL canonique, par hash, puis par similarité de trigrammes (`pg_trgm`) sur le titre, sur 7 jours, seuil à calibrer sur un mois. Extension standard de PostgreSQL, disponibilité sur l'image Railway vérifiée en phase 0. Un doublon renforce l'item pivot. Les plongements viendront plus tard, avec fournisseur et prix nommés ; pgvector sur Railway n'est pas vérifié (CR1 §2.O).
3. **Scoring** : Haiku 4.5 par lots de 20, profil client en cache ; pertinence, pilier, urgence, risque, format, angle ; Batch nocturne sauf newsjacking (R06 §16.12).
4. **Score composite** : pertinence × fraîcheur (demi-vie 36 heures pour une tendance, 14 jours pour un événement) × signal × diversité.
5. **Genèse** : Claude avec recherche web (10 $ pour 1 000 recherches), dossier avec URL et extrait par fait.
6. **Mix** : refus d'une semaine sans 60 % d'items « valeur » (R06 §16.15).

### 8.5 Vérification des faits : règles dures (R06 §13.4)

Toute date et tout lieu sont corroborés par deux sources indépendantes, dont une primaire (site de l'organisateur, page de l'événement, billetterie, communiqué). Chaque fait extrait porte une confiance par champ ; un champ sous 0,8 bloque et part au gestionnaire. Un fait vérifié il y a plus de 7 jours est revérifié 48 heures avant la publication. Les sujets politiques et religieux controversés sont exclus du newsjacking pour les églises, SEVARTA et 2IAE. La planche montre « Source : URL » sous chaque fait, et une ligne « faits à confirmer » posée comme une question. Pour un sermon, la seule source est la transcription horodatée : aucun fait extérieur n'y est ajouté sans source.

### 8.6 Mesure de la veille

Pour chaque item : proposé, accepté, publié, performance. Sources sans item accepté coupées à 90 jours (R06 §16.19). Le chronomètre « tendance vers publication » part de `signal.detected_at` ; pour un signal de nature `client`, l'heure de l'envoi par la cliente fait foi, ce qui empêche une tendance non vue par la machine d'échapper à l'indicateur (CR2 §1).

### 8.7 Coût mensuel (R06 §14)

| Phase | Socle partagé | Par client |
|---|---|---|
| 1 (flux A et D) | 0 $ hors hébergement | moins de 1 $ de jetons |
| 2 (boîte à tendances, catalogue) | Firecrawl ou crawl maison, 0 à 16 $ | 1 à 3 $ |
| 3 (flux B et C, voisins) | 60 à 170 $ (SerpApi 25 à 75 $, Apify 19 $, Tavily 0 à 30 $, Exa 0 à 10 $, changedetection.io 5 à 15 $, workers 10 à 20 $) | léger 5 à 10 $ (église, association), standard 12 à 25 $ (beauté, SEVARTA, 2IAE), intensif 30 à 60 $ |

La veille est le poste de valeur, pas le poste de coût : Hootsuite, qui bâtit son offre autour de l'agent Wisdom et de la détection de tendances, facture 99 à 399 $ par utilisateur et par mois, en anglais (R26 §2.5, R01 §2).

---

## 9. L'architecture agentique

### 9.1 Doctrine : 80 % d'appels structurés, 20 % d'agents, zéro agent en attente

Le cœur tourne sur l'API Messages avec sorties structurées, cache de prompt et Batch, orchestré par pg-boss : chaque tâche est un appel de 0,005 à 0,32 $ (R07 §7). Un agent consomme 4 à 15 fois plus de jetons sans gain sur une tâche bien spécifiée (R07 §3). Toute attente humaine est un état en base : zéro jeton pendant l'attente (R07 §5).

Le Claude Agent SDK (TypeScript, conteneur `agent`, `SessionStore` Postgres, `maxBudgetUsd` de 2 $ par tâche, profondeur 1, hooks `PreToolUse` d'audit et `defer` sur toute action irréversible, R07 §2.3 et §11.8) n'entre qu'en phase 3, et seulement si le lot d'évaluation montre un gain : audit du site d'un client, sermon à croiser avec les annonces de l'église.

### 9.2 Modèles par tâche (prix officiels lus le 2 octobre 2026, R26 §2.3)

| Tâche | Modèle | Prix par million de jetons : entrée / sortie / lecture de cache | Mode | Phase |
|---|---|---|---|---|
| Création : posts, carrousels, scripts, clips, dérivés, rapport, planche | Opus 5.5 | 4 $ / 20 $ / 0,20 $ (0,05x, seul modèle Claude à ce taux) ; écriture de cache 5 min 5 $, 1 h 8 $ ; Batch 2 $ / 10 $ | synchrone pour la planche du jeudi, Batch pour le lot du mercredi | 1 |
| Repli de création | Sonnet 5.5 | 2 $ / 10 $ / 0,20 $ ; Batch 1 $ / 5 $ | bascule automatique (section 9.3) | 1 |
| Synthèses de veille, extraction INCI et PDF, brouillons sensibles | Sonnet 5.5 | idem | Batch quand possible | 2 |
| Juges, scoring, vision, classification, flyers, segmentation des sermons | Haiku 4.5 | 1 $ / 5 $ / 0,10 $ ; minimum cacheable 4 096 jetons (R07 §4) ; Batch 0,50 $ / 2,50 $ | juge de planche synchrone ; scoring en Batch nocturne | 1 |
| Sessions d'agent longues (audit de site, sermon croisé, revue multi-clients) | Fable 5.1 | 10 $ / 50 $ / 0,25 $ (0,025x) ; Batch 5 $ / 25 $ | Agent SDK ; jamais une légende (R26 §5.8) | 3 |
| Recherche web (genèse, vérification) | outil de recherche Claude | 10 $ pour 1 000 recherches ; web fetch sans supplément | synchrone | 2 |
| Images | gpt-image-2.5-flare et -sunburst | 5 $ texte en entrée (1,25 $ en cache), 8 $ image en entrée (2 $ en cache, Responses API seulement), 30 $ image en sortie ; Batch moitié prix ; aucun prix par image publié (R26 §2.2) | brouillon en low, production en high | 1 |
| Vocaux WhatsApp | gpt-4o-mini-transcribe | 0,003 $ la minute (R22 §4.2) | synchrone | 1 |
| Second juge d'une autre famille sur 10 % des contenus | gpt-4o-mini | prix non vérifié dans les rapports | échantillon (R11 §15.4) | 3 |

Règles : entrées majorées de 30 % pour le tokenizer (R26 §2.3) ; jamais de changement de modèle en cours de conversation (le cache est par modèle) ; cerveau en cache d'une heure ; clé Console séparée de l'abonnement Max de José, car offrir une connexion claude.ai dans un produit tiers est interdit (R07 §11.17) ; alerte à 15 $ de jetons par client et par mois. Panier type : 9 à 14 $ par client et par mois (R07 §7).

### 9.3 Horloge du Batch et replis

Le Batch divise le prix par deux mais un lot peut prendre jusqu'à 24 heures, même s'il finit souvent en moins d'une heure (R07 §7, CR1 §2.N). L'horloge du cycle généraliste devient :

| Moment (heure du client) | Travail | Mode |
|---|---|---|
| Mercredi 18:00 | lot de la semaine : scoring en retard, idéation, brouillons de la planche, calendrier du mois suivant | Batch |
| Jeudi 05:00 | tout `custom_id` non terminé repasse en synchrone, même prompt, même modèle | synchrone |
| Jeudi 06:00 à 08:00 | maquettes, juge de planche, vision | synchrone |
| Jeudi 08:00 | si Opus 5.5 a échoué ou refusé (indisponibilité, surcharge), les éléments manquants sont regénérés sur Sonnet 5.5 et marqués « repli » pour le gestionnaire | synchrone |
| Jeudi 09:00 | porte 1 | gestionnaire |

Pour Chaire, la planche du lundi midi part de la chaîne sermon, en synchrone, sans lot. Le juge de planche est toujours synchrone : il conditionne l'envoi.

### 9.4 Cerveau de marque, voix et mémoire

Trois couches (R07 §4) : stable dans `brand_brain` versionné (fiche de voix, piliers, doctrine, registre de langue, R10 §8.8, interdits lexicaux, profil de conformité) ; vivante, en tables exposées par outils pour ne pas casser le préfixe en cache ; agentique dans `SessionStore` en phase 3.

**La voix vient de la parole réelle, jamais des posts de l'agence (CR2 §1).** Corpus : sermons transcrits, vocaux de la fondatrice ou du président, réponses écrites par le client lui-même, page « à propos ». Exclus : posts d'agences précédentes, brouillons IA, invités (R11 §5.1). La fiche est faite de grandeurs mesurables (longueur et variance des phrases, rythme, personne et temps dominants, ouvertures) converties en règles par le prompt de R11 §5.4. Les 50 derniers posts servent de mesure de référence, pas de modèle.

**Test d'acceptation en aveugle (R11 §5.1).** Dix textes mélangés, cinq générés et cinq réels, triés par deux relecteurs (gestionnaire et client). Si les textes générés sont reconnus nettement mieux que le hasard (seuil retenu : 8 sur 10), la fiche n'est pas finie. Refait à chaque recalibration.

Réinjection mensuelle des dix meilleurs posts et des dernières paires de corrections (R11 §10.2) ; `asset_ids` obligatoire sur tout contenu émotionnel (R11 §15.2).

### 9.5 Juge et garde-fous

Le juge de la section 7.5 est calibré le premier mois sur 100 posts notés par José, par verticale (kappa d'au moins 0,6, R11 §8.4), puis chaque mois et à chaque changement de modèle. Si un critère reste sous 0,6 après deux recalibrations, ce critère seul passe sur Sonnet 5.5. Garde-fous encodés : lexique d'allégations par pays, versets vérifiés par outil, consentement d'image pour tout visage (vue SQL `publishable_assets`), chiffres de 2IAE issus de la base, `ai_label` par variante, « faits à confirmer » sur la planche. Trois refus du juge sur un client ouvrent un incident et alertent José ; la Routine « incident » s'y ajoute en phase 3 (R07 §11.12).

### 9.6 Place exacte de chaque surface Claude

| Surface | Rôle | Phase | Garde-fous |
|---|---|---|---|
| Claude Code | construit la plateforme ; en exploitation, la lit par le MCP | 0, puis 3 | jeton porteur haché et révocable avant l'OAuth |
| Serveur MCP « machine-social » | expose la plateforme à Claude Code, aux Routines, à Cowork | 3 | lecture seule, plus `log_decision`, plus `approve` limité à la porte 1 avec confirmation PWA |
| Routines Claude Code (aperçu de recherche) | exécutent les ordres « Confier à Claude » | 3 | 30 tirs API par heure et par Routine, 100 par heure et par compte, intervalle planifié d'au moins une heure, aucune idempotence (R07 §2.6) ; seul connecteur : machine-social |
| Claude Cowork | outil personnel de José ; une tâche planifiée lit les ordres en attente | 3 | aucune API d'entrée (R07 §2.7) |
| Claude in Chrome | hors plateforme | jamais | aucun `browser_toolset` sur Railway (R07 §2.8) |

**Le serveur MCP** (Streamable HTTP, joignable depuis les adresses d'Anthropic, R07 §2.5). Lecture : `list_pending_briefs`, `list_agent_orders`, `get_brand_brain`, `get_assets`, `get_board`, `get_metrics`, `get_costs`. Écriture journalisée : `log_decision`, qui accepte une note ou une proposition structurée (script, plan, faits sourcés) validée par JSON Schema et déposée comme brouillon dans « à relire ». `approve` ne vaut que pour la porte 1 : il crée une `approval_request`, et la planche n'est approuvée qu'après un tap de confirmation dans la PWA. Ni porte 2, ni porte 3, ni `reject`, ni publication, ni génération payante (CR1 §2.I). OAuth 2.1 complet (PKCE, RFC 9728, 8414, 7591, 8707) pour Cowork ensuite : une à deux semaines de travail.

**Les Routines** s'exécutent sous l'identité de José, sur son abonnement, sans invite de permission, avec par défaut tous ses connecteurs en écriture, Gmail et Zoho CRM compris (R07 §2.6). Chaque Routine de la machine ne garde donc que machine-social. `tick` tire `POST /v1/claude_code/routines/{id}/fire` une fois par clé `client:ordre:id`, journalisée dans `routine_fire`, avec des identifiants seulement ; le bloc `routine-fire-payload` est une donnée non fiable. Rien de critique n'en dépend : un ordre non traité reste dans la file du gestionnaire.

### 9.7 Fournisseurs de génération

- **Higgsfield, API officielle seulement** (open.higgsfield.ai, lancée le 16 septembre 2026, paiement à la génération, sorties conservées au moins sept jours donc copiées, limite de concurrence dépendant du compte, 4 requêtes concurrentes dans l'exemple documenté, R26 §2.4). L'usage par agent et par MCP est prévu par la section 11.12 des conditions. L'API a deux semaines d'existence : d'où le repli immédiat Kling 3.0 via fal, testé chaque semaine (CR1 §2.M).
- **fal** : FLUX.2, LTX-2.3, Kling 3.0 de repli. Aucun plafond par clé : plafonds tenus dans `cost_ledger` (R25 §7.1).
- **Gemini** (Veo 3.1 Fast, Nano Banana 2, Lyria 3) : phase 3, sur banc.

### 9.8 Les demandes de José, réponse par réponse

| Demande | Possible ? | Comment | Quand | Interdit, et pourquoi |
|---|---|---|---|---|
| « ChatGPT Image » | Oui. ChatGPT Image, c'est la famille GPT Image d'OpenAI. | La plateforme l'utilise par l'API : gpt-image-2.5-flare (génération) et gpt-image-2.5-sunburst (édition), sorties le 8 septembre 2026, via la Responses API (R26 §2.2). Une image faite à la main dans ChatGPT peut être déposée dans la PWA, avec provenance et `ai_label`. | phase 1 | Nommer chatgpt-image-latest, gpt-image-1.5 ou gpt-image-1 dans le code : ils s'arrêtent le 23 octobre et le 1er décembre 2026. Citer un prix par image : OpenAI n'en publie pas pour 2.5, le coût se mesure au banc. |
| Higgsfield (« Xfield ») | Oui, par deux portes officielles. | La plateforme passe par l'API Higgsfield (Kling 3.0 à 0,084 $ la seconde, Seedance 2.5 à 0,2057 $ la seconde). José, dans Claude ou Cowork, passe par le MCP officiel (mcp.higgsfield.ai/mcp, lancé le 30 avril 2026, connexion OAuth, débité en crédits, R04 §1.1) ; ce qu'il y crée entre dans la plateforme par dépôt, avec provenance « Higgsfield MCP, compte José ». | API : fin de phase 2 ; MCP de José : dès maintenant, hors plateforme | Piloter l'Unlimited par Claude in Chrome ou un script : la section 10.6 des conditions (26 juillet 2026) et le centre d'aide (28 août 2026, « automation tools, scripting, credential sharing, and reselling access are strictly prohibited ») l'interdisent, sanction possible par suspension. Le skill /clips, qui pilote l'Unlimited par Chrome, relève de cette interdiction : la plateforme ne l'utilise pas et ne compte aucun rendu venant de là ; l'usage manuel de l'Unlimited reste libre. Envoyer en référence le visage d'un pasteur ou d'un enfant : clause d'entraînement 4.4. |
| Déclencher Claude Code | Oui. | Bouton « Confier à Claude » dans la PWA : le gestionnaire choisit un ordre type, `tick` tire la Routine (`POST /fire`), Claude Code lit le contexte par le MCP et rend sa proposition par `log_decision`, qui arrive dans « à relire ». Ordres types : genèse d'événement sourcée ; script et parcours Playwright d'une vidéo explicative de logiciel ; relecture de planche (second regard, notes par critère) ; audit du site d'un client ; revue hebdomadaire multi-clients ; analyse d'incident après trois refus du juge. | phase 3 | Donner à une Routine Gmail, Zoho ou tout autre connecteur ; lui laisser approuver une porte 2 ou 3 ; dépendre d'une Routine pour une échéance client. |
| Déclencher Cowork | Pas directement : Cowork n'a pas d'API d'entrée (R07 §2.7). | Une tâche planifiée de Cowork, réglée par José (par exemple chaque matin), appelle `list_agent_orders` par le MCP, traite les ordres marqués « Cowork » et répond par `log_decision`. C'est Cowork qui tire ; la plateforme dépose. | phase 3, après le MCP OAuth | Promettre un déclenchement immédiat de Cowork depuis la plateforme. |
| Vidéos explicatives de logiciel | Oui. | Chaîne de la section 7.4 : projet livré, compte de démonstration, script validé, parcours Playwright, Remotion, voix, sous-titres ; prix à l'unité. | phase 2 (Claude Code écrit le parcours en phase 3) | Enregistrer sur la production d'un client ou avec ses vrais identifiants. |
| Genèse d'événement en petite vidéo animée | Oui. | Remotion 30 à 60 s à partir des archives photo et du vocal du président ; faits à deux sources dont une primaire ; relecture humaine (section 7.4). | phase 2 | Raconter une histoire sans vocal ni source : sans vocal, carrousel genèse seulement. |
| Highlights animés du sermon | Oui. | 2 highlights en typographie cinétique, 1 verset animé et des audiogrammes par sermon, en Remotion et ffmpeg, sans étiquette IA (section 7.4). | phase 1 | Couper dans un verset ; citer une traduction biblique sous licence sans licence (Segond 1910 du domaine public par défaut, R05 §3.7). |

### 9.9 Observabilité

Phase 1 : `llm_call` (modèle, jetons, cache, coût, latence, `stop_reason`, `batch_id`) et `cost_ledger` ; journaux pino avec `tenant_id`, `job_id`, `content_type`, expurgés de tout jeton par un sérialiseur unique. Phase 2 : Langfuse Hobby (50 000 unités gratuites, R07 §8.2), puis auto-hébergé ou Core à 29 $, score du juge par trace ; comparaison mensuelle entre la facture Console et les estimations locales (R07 §11.16).

### 9.10 Phasage de l'architecture agentique

| Phase | Ce qui entre |
|---|---|
| 0 | clés Console et OpenAI séparées, lot d'évaluation de 50 cas par verticale, banc gpt-image-2.5 |
| 1 | Opus 5.5 et repli Sonnet 5.5, juge Haiku 4.5 synchrone, Batch du mercredi, cerveau de marque tiré de la parole réelle, test en aveugle, `llm_call` |
| 2 | recherche web pour la genèse, Langfuse, adaptateurs Higgsfield et fal |
| 3 | serveur MCP (jeton porteur puis OAuth), Routines limitées au connecteur machine-social, bouton « Confier à Claude », Cowork par tâche planifiée, Agent SDK et Fable 5.1 sur preuve, second juge |
| 4 | bandit des hooks par verticale |

---

## 10. Publication, mesure et apprentissage

### 10.1 Couche de publication : trajectoire

Interface `Connecteur` (`publier`, `programmer`, `lire`, `sante` ; `statistiques` et `commentaires` seulement là où la capacité est prouvée), deux implémentations (R02 §12.1).

**Upload-Post** : Professional à 50 $ (25 profils, marque blanche) au départ, Advanced à 147 $ (75 profils) dès 8 clients, Business à 438 $ (225 profils) à 20 (R02 §8). Un profil est un compte sur une plateforme : 8 clients font 30 à 38 profils. R02 se contredit sur l'unité ; le décompte réel est vérifié sur le plan gratuit en phase 0 (CR1 §1.13). Upload-Post porte les revues Meta et l'audit TikTok ; ses commentaires sont « partiels » et ses statistiques des « analyses IA » : la mesure n'en dépend pas.

**`MetaDirectConnector`** (Graph API v25.0) : sans revue, il ne sert que les utilisateurs qui ont un rôle sur l'application Meta (administrateur, développeur, testeur), pas un rôle sur la Page (R02 §2.1). En phases 1 et 2, il publie donc les pages de l'agence (2IAE, SEVARTA, Markel-Tech) ; après l'accès avancé, tous les clients, avec Trial Reels, Audio API et étiquette IA natifs.

**Blotato est retiré** : Upload-Post porte déjà l'audit TikTok (CR1 §2.F). Les MCP Blotato et Metricool restent des sorties de secours de marché, sans intégration (R26 §5.17).

**Paquet manuel de premier rang** (médias, légende, texte alternatif, heure, cases à cocher, lien profond, R02 §10.5) : Channels et Status WhatsApp, Snapchat, carrousels de 11 à 20 diapositives, refus d'API.

### 10.2 Revues officielles, échelonnées

Une revue Meta exige un screencast par fonctionnalité et par permission ; la première cause de rejet est une permission demandée sans fonctionnalité démontrée ; chaque décision peut prendre 20 jours (R02 §2.1). D'où un calendrier en trois temps (CR1 §2.B).

| Moment | Meta | YouTube | TikTok | LinkedIn |
|---|---|---|---|---|
| Phase 0 (5 au 18 octobre 2026) | vérification d'entreprise de Markel-Tech Inc. ; application en mode développement ; numéro WhatsApp et modèles | projet Google Cloud, écran de consentement | application en mode développement | application Community Management, tier de développement |
| Fin de phase 1 (décembre 2026) | revue limitée à la publication et aux insights, avec la vidéo de chaque fonctionnalité | audit des YouTube API Services avec vidéo (2 à 4 semaines) | audit Content Posting avec la vidéo de l'écran porte 3 | |
| Phase 2 (janvier et février 2027) | revue commentaires, messagerie, HUMAN_AGENT | | | |
| Phase 3 | Business Discovery si le mode développement ne suffit pas ; Marketing API selon le besoin | | | Standard Tier |

Accès avancé réaliste : 2 à 4 mois après le premier dépôt, soit entre février et avril 2027. Page Public Content Access n'est pas demandé. Avant les audits, YouTube verrouille en privé les vidéos d'un projet non audité et TikTok limite à 5 utilisateurs par 24 heures en SELF_ONLY (R26 §2.7) : Upload-Post publie pour les clients jusque-là.

### 10.3 Contraintes par plateforme, codées dans `ref.platform_rule`

| Plateforme | Règles encodées |
|---|---|
| Instagram | lire `content_publishing_limit` avant chaque publication, 50 comme plafond prudent tant que le compteur n'a pas prouvé 100 (R26 §2.1) ; Reels de 3 s à 15 min, 300 Mo ; carrousel 10 ; 5 hashtags au plus ; `is_ai_generated` ; médias servis par URL présignée Railway de 48 heures sur une copie `pub/`, révoquée après `FINISHED`, purgée à 7 jours, testée la première semaine (R25 §11.3) |
| Facebook | Reels de 3 à 90 s, 30 par 24 heures ; Stories de 60 s ; insights limités à 90 jours par requête |
| Threads | 250 publications par 24 heures, carrousel de 20 |
| YouTube | 100 envois par jour et par projet, lissés ; Shorts jusqu'à 3 minutes (R26 §5.1) ; consentement exprès horodaté par client (R02 §4) ; projet Google en mode « test » : jetons de rafraîchissement à 7 jours, d'où le passage en production avant le premier client |
| TikTok | FILE_UPLOAD par défaut (4 Go, morceaux de 5 à 64 Mo) ; PULL_FROM_URL seulement depuis un domaine vérifié ; écran porte 3 conforme ; `is_aigc` ; durée maximale lue dans `creator_info/query` ; 6 requêtes par minute par jeton |
| LinkedIn | documents natifs et multi-images, pas de planification native ; version mensuelle en paramètre (202510 retirée le 15 octobre 2026) |
| WhatsApp Channels et Status | aucune API : paquet manuel ; adaptateur isolé pour le jour où Meta ouvrira la programmation (R10 §8.20) |

Créneaux par fuseau (R10 §8.7) ; dimanche interdit par défaut sauf directs d'église (R09 §11.5).

### 10.4 L'écran porte 3, conforme à TikTok

TikTok exige, pour chaque publication par API, un écran où un humain choisit (R02 §3) : pseudonyme du créateur affiché ; menu de confidentialité sans valeur par défaut, limité aux options renvoyées par `creator_info/query` ; cases commentaires, duet et stitch décochées par défaut ; bascule « divulgation de contenu commercial » éteinte par défaut, avec « Your Brand » et « Branded Content » ; mention « By posting, you agree to TikTok's Music Usage Confirmation » ; aperçu du média ; avertissement que le traitement prend quelques minutes. L'écran « À contrôler » de la PWA implémente ces éléments, plus `is_aigc`, pour chaque vidéo TikTok, et sert de vidéo d'audit. Aucune validation groupée ne le remplace. YouTube exige de même un consentement exprès (R02 §4).

### 10.5 Jetons, reconnexion, repli manuel

| Plateforme | Règle |
|---|---|
| Instagram Login | jeton long de 60 jours, rafraîchi à J-5 (possible s'il a plus de 24 heures et n'est pas expiré ; un jeton expiré impose une reconnexion) |
| Page Facebook | jeton de Page dérivé d'un jeton utilisateur long : il n'expire pas, mais tombe si le mot de passe change, si l'utilisateur perd son rôle ou si l'application perd l'accès ; contrôle hebdomadaire par `debug_token` (CR1 §1.8) |
| Clients structurés (Business Manager) | jeton d'utilisateur système de Facebook Login for Business, qui n'expire pas par défaut (R21 §5.3) : plus de reconnexion côté client ; disponible avec l'accès avancé |
| TikTok | jeton d'accès de 24 heures rafraîchi avant chaque publication ; jeton de rafraîchissement de 365 jours, réautorisation annuelle |
| LinkedIn | 60 jours, alerte à J-10 |
| Google | jeton de rafraîchissement durable en production |

Erreur 190, 401 ou `access_token_invalid` : état `a_reconnecter`, alerte, courriel au client avec lien de reconnexion, publications en `en_attente_reconnexion`. Échec de publication réessayé trois fois avec attente croissante, puis converti en paquet manuel.

### 10.6 Mesure : la couche affaires en tête, puis trois couches (R24)

**Couche affaires maison, dès le premier mois et sans revue (CR1 §2.H).** Tout lien sortant devient un `tracked_link` avec UTM conventionnés (`utm_campaign = {client}-{aaaa-mm}-{pilier}`, `utm_content = c{id}-{format}`), servi par un raccourcisseur maison qui compte le clic côté serveur (R24 §2.1) ; lien en bio maison (R24 §2.5) ; QR dynamiques sur affiches et bulletins (R24 §2.6) ; un coupon par contenu promotionnel (R24 §2.7). Premier rapport : cette couche, ce qu'Upload-Post fournit réellement (vérifié en phase 0), les pages de l'agence, YouTube Analytics avec `creatorContentType=SHORTS` (R24 §3.4), les URL des paquets manuels.

**Avec l'accès avancé (phase 3)** : collecte nocturne en ajout seul (Instagram retarde de 48 heures et efface les Stories à 24 heures, Facebook limite à 90 jours par requête, R24 §3), `metric_alias` versionnée, test hebdomadaire sur « invalid metric », envois et enregistrements par portée contre la médiane de la verticale puis la médiane locale.

| Couche | Exemples | Disponible |
|---|---|---|
| Affaires (en tête du rapport) | clics de liens maison, scans de QR, coupons, demandes de prière, dossiers d'admission | phase 1 |
| Croissance | abonnés nets, visites, messages | partiel en phase 1, complet en phase 3 |
| Indicateurs avancés | envois et enregistrements par portée, rétention à 3 s, taux de saut | phase 3 |

### 10.7 Rapport mensuel et boucle d'apprentissage

PDF d'une page par Playwright et résumé WhatsApp de cinq lignes avec les trois meilleures publications, le premier lundi après le 3, avant 9 h heure du client (R24 §4.2). Le résumé passe au tarif marketing (0,0225 $ en Côte d'Ivoire, R22 §3.5) : seuls cinq modèles restent utilitaires (`planche_prete`, `production_terminee`, `publication_faite`, `confirmation_optin`, `alerte_gestionnaire`, CR1 §2.G). Contenu : note de confiance, couche affaires en premier même avec de petits chiffres, croissance, indicateurs avancés avec pastille médiane, indicateurs « à la page » et chronomètre, une publication qui a échoué et sa leçon, trois décisions. Coût : 1 à 3 $ par client (R24 §8).

**Boucle d'apprentissage, par phase.**

| Mécanisme | Ce qu'il fait | Phase |
|---|---|---|
| Réinjection mensuelle | corrections du gestionnaire, décisions client, performance réelle, dans le cerveau de marque (R11 §10) | 1 |
| Bibliothèque de formats gagnants par verticale | structures seulement (famille de hook, format, durée, verticale, pays, performance médiane), jamais le contenu ni les données d'un client (R09, R11 §15.9) | dès le mois 2 d'exploitation |
| Remontée des meilleurs contenus | un contenu au-dessus de la médiane revient avec un nouveau hook ou décliné (Reel vers carrousel, clip vers verset animé), jamais reposté tel quel (R11 §10) | 3 |
| Moments de sermon nourris par les clips qui ont marché | l'analyse Opus reçoit les types de moments gagnants de l'église (R05 §8.14) | 2 |
| Trial Reels | un clip montré d'abord aux non-abonnés, gradué sur performance (R26 §3) ; au Canada surtout, où Instagram compte | 4 |
| Pré-test des hooks adapté au pays | 3 à 5 hooks de familles différentes par idée vidéo ; au Canada en Trial Reels ; à Abidjan, variantes sur TikTok et Facebook à des jours distincts, rétention à 3 s montrée au gestionnaire (R11 §7.1, R10 §2.1) | 4 |
| Bandit par verticale | récompense : envois plus enregistrements par portée, 20 % d'exploration, probabilités affichées (R11 §7.2) | 4 |

### 10.8 Après la publication (R23)

| Fonction | Contenu | Phase |
|---|---|---|
| Boîte de réception | API Meta gratuites (750 réponses privées par heure), tri Haiku 4.5 en six classes, brouillons dans la voix du client, HUMAN_AGENT journalisé, jamais d'automate sur une plainte (R23 §2 et §4) ; tâche quotidienne TikTok dans l'application, faute d'API de commentaires (R02 §3) | 3 |
| « Commentez MOT CLÉ » | réponse privée unique sous 7 jours (R23 §3.2) | 3 |
| Réponse vidéo aux commentaires | trois questions identiques produisent un script de réponse vidéo à tourner (R09 §3.4) | 3 |
| Collecte d'UGC réel | mot clé « AVIS » en commentaire ou Click-to-WhatsApp, demande de vidéo, lien de consentement signé rangé dans `consent` (R23 §8.17) ; condition des UGC de Vidéo+ | 3 |
| Boost supervisé | détection à 24 heures (deux conditions sur trois au-dessus de 1,5 fois la médiane des 30 dernières publications), proposition au client, exécution par le gestionnaire après validation écrite, dans le gestionnaire de publicités du client ; minimum Meta 1 $ par jour, TikTok Spark Ads 20 $ par jour (R23 §5) | 2 à la main ; automatisation par la Marketing API en phase 4 |
| Click-to-WhatsApp | 72 heures de messages gratuits si réponse sous 24 heures (R23 §5.4) | 3 |

---

## 11. Architecture technique et modèle de données

### 11.1 Services Railway

Projet Railway « machine », distinct du projet « Groupe 2iae », dans un espace Markel-Tech au plan Pro (R25 §11.1). Région EU West Amsterdam, la plus proche d'Abidjan (5 290 km), latence mesurée en phase 0 (R25 §2.4). Tout est provisionné par le Railway CLI, par un script versionné. Monorepo pnpm (`apps/web`, `worker`, `rendu`, `tick`, `agent` ; `packages/db` en Drizzle, `core`, `providers`, `remotion`).

| Service | Rôle | Taille de départ | Coût estimé à 6 clients |
|---|---|---|---|
| `web` | API, webhooks, PWA, pages magiques, lien en bio, raccourcisseur ; MCP en phase 3 ; ne détient qu'une clé publique de scellement | 0,5 vCPU, 1 Go, 2 réplicas | 20 $ |
| `worker` | files pg-boss (veille, rédaction, juge, génération, publication, mesure, purge, jetons, santé) ; seul porteur des clés fournisseurs et de la clé privée | 0,5 vCPU, 2 Go | 30 $ |
| `rendu` | ffmpeg, libass, Chromium Playwright, Remotion CPU ; concurrence 1 par réplica, 2 réplicas au plus | 4 vCPU, 8 Go en limite | 15 à 25 $ (hypothèse : repos plus 2 h de travail par jour) |
| `tick` | cron toutes les 5 minutes, sort en moins d'une minute (R07 §11.6) | 0,25 vCPU | moins de 2 $ |
| `agent` (phase 3) | Agent SDK, séparé du rendu | 0,5 vCPU, 2 Go | 10 à 30 $ |
| `postgres` | schémas `app` (RLS), `pgboss`, `audit`, `ref` ; `railway.internal` seulement ; PITR dès le premier jour | 0,25 vCPU, 1 Go, volume 5 Go | 16 $ |
| bucket `machine-ams` | `t/{tenant_id}/orig`, `der`, `pub`, `exp`, et `relais/` pour les dumps chiffrés ; URL présignées jusqu'à 90 jours ; 0,015 $ par Go, sortie gratuite (R25 §2.3) | | 6,40 $ |
| environnement `staging` | base anonymisée, tailles minimales | | 10 à 20 $ (hypothèse) |

Le mode Serverless de `rendu` est retiré : une connexion de base ouverte empêche la mise en veille, et un consommateur pg-boss la tient en permanence (R25 §2.1, CR1 §1.12). Aucun volume sur un service applicatif, donc aucune coupure au redéploiement, à l'inverse du campus le 29 septembre 2026 (R25 §2.2). Les buckets Railway n'ont ni accès public, ni cycle de vie, ni versionnage, ni verrou, ni droits par préfixe (R25 §2.3, §5.2) : job quotidien `retention_purge` (supprime, vérifie par `HEAD`, écrit `purged_at`) et isolation applicative par `keyFor(tenantId, ...)`. Rétention : originaux de sermon 30 jours, rendus 90 jours, copies `pub/` 7 jours.

### 11.2 Limite de dépense et disjoncteurs

La limite dure de Railway met tous les services hors ligne, Postgres et webhooks compris (R25 §2.1). Elle est donc posée à 3 fois la facture attendue (environ 330 $ à 6 clients), avec alertes par courriel à 1,2 et 1,5 fois (CR1 §2.C). Le vrai frein est applicatif :

| Disjoncteur | Règle |
|---|---|
| `cost_ledger` et `tenant_budget` | réservation avant chaque appel payant, refus au-delà du plafond du client (église 15 $ par jour et 60 $ par mois, beauté 10 $ par jour et 120 $ par mois), état `plafond_atteint`, alerte à 80 % (R25 §7.2) |
| Plafond global par fournisseur | somme journalière tous clients par fournisseur ; au-delà, la file du fournisseur se met en pause et José est alerté |
| Réplicas | `rendu` limité à 2 réplicas, `worker` à 1 au départ |
| Concurrence pg-boss | bornée par file (génération vidéo 2, rendu 1 par réplica, publication 2) |
| Coupe-circuit fournisseur | après 5 erreurs consécutives sur un fournisseur, file en pause 15 minutes, bascule sur le repli si la famille en a un |
| Boucles | tout job porte un compteur de tentatives ; au-delà de 3, file morte visible dans la PWA |
| OpenAI | projet « machine-prod » avec plafond mensuel dur ; clés à 90 jours (R25 §7.2) |

### 11.3 Postgres : tables principales

Schéma validé par le skill `/db` avec le Railway CLI avant la première ligne de code. Conventions (R25 §9) : UUIDv7, `tenant_id` non nul sur chaque table métier, clé composite `(tenant_id, id)` sur les tables volumineuses, `timestamptz`, montants en `usd_micro` bigint, `tenant.data_region` et `asset.storage` dès la première migration, partitions mensuelles d'`audit_log`, `cost_ledger` et `llm_call` en phase 3.

| Groupe | Tables (colonnes clés) | Contraintes |
|---|---|---|
| Locataire et accès | `tenant` (verticale, pays, fuseau, plan, `regle_sans_reponse`, `reserve_activee`, `mandat_tendance`, data_region) ; `user` ; `membership` (owner, admin, manager, client_viewer) ; `person` (opt-in horodaté, `stop_at`) ; `tenant_key` (DEK chiffrée, version) ; `tenant_secret` (chiffré, nonce, tag) ; `sealed_inbox` ; `magic_link` (`token_hash`) | unique (tenant_id, user_id) |
| Authentification du gestionnaire | `webauthn_credential`, `totp_secret`, `login_link` (15 min), `staff_session` (12 h) | |
| Facturation | `subscription` (palier, devise FCFA ou CAD, prix, engagement, options) ; `invoice` (numéro, période, hors taxes, taxes, total, état) ; `payment` (PAD, Wave Business, CinetPay, Stripe ; référence, frais) ; `credit_note` (facture d'origine, motif) ; `overage` (Reel génératif, scène signature, vidéo explicative ; quantité, prix) | facture figée après émission |
| Marque | `brand_brain` (fiche de voix, corpus avec provenance, piliers, conformité, `cached_prompt_hash`, `blind_test_score`) ; `reference_kit` ; `learning_pair` | une version courante |
| Médias et droits | `asset` (sha256, stockage, rétention, `expires_at`, `legal_hold`, `purged_at`) ; `asset_variant` ; `asset_rights` ; `consent` ; `ai_label` ; `licence_registry` ; `asset_url` ; `product` (`last_shown_at`) | unique (tenant_id, sha256) ; vue `publishable_assets` |
| Veille | `source` ; `item` (URL canonique, hash, scores) ; `dossier` ; `signal` (nature machine ou client, `detected_at`) ; `calendar_moment` | unique (tenant_id, hash) ; index trigrammes |
| Contenus | `content_item`, `content_version`, `judge_score`, `qc_result`, `board`, `board_item`, `validation` | trigger `ref.content_transition` |
| Production | `generation_job` (`external_id` écrit avant l'appel, coût réservé et réel, `fallback_of`) ; `render_job` ; `engine_registry` ; `provider_transit` | |
| Agents | `agent_order` ; `routine_fire` (clé unique) ; `mcp_token` (haché) ; `approval_request` (porte 1, confirmée par, le) | |
| Publication | `social_connection` (connecteur, état, expiration, `last_debug_token_at`) ; `publication` ; `manual_package` ; `whatsapp_message` (catégorie, coût, fenêtre) ; `whatsapp_template` | plafond de notifications vérifié avant envoi |
| Mesure et affaires | `account_metric_daily`, `media_metric_snapshot`, `metric_alias`, `benchmark`, `tracked_link`, `link_click`, `conversion_event`, `coupon`, `monthly_report` | ajout seul |
| Coûts et audit | `llm_call`, `cost_ledger`, `tenant_budget`, `provider_cap`, `audit.audit_log` | UPDATE et DELETE interdits ; 13 mois |
| Référentiels | `ref.platform_rule`, `ref.tarif_whatsapp`, `ref.holiday`, `ref.bible_segond1910`, `ref.format_library` (structures gagnantes, sans `tenant_id`) | sans RLS |

Le plafond de notifications bloque : avant chaque envoi non sollicité, le worker compte les messages du mois dans `whatsapp_message` (CR2 §2.1). Webhooks Wave et CinetPay, mentions TVH, relance et suspension douce : annexe D.

### 11.4 Sécurité

**Rôles Postgres.** `migrator` (propriétaire, migrations seulement) ; `app_login`, rôle de connexion non superutilisateur, sans `BYPASSRLS`, qui ne peut que `SET ROLE app_rw` ou `app_ro` ; `app_rw` (RLS forcée) ; `app_ro` (tableaux de bord, exports) ; `pgboss_rw`, limité au schéma `pgboss` ; `backup` (lecture, `row_security = off` pour qu'un dump partiel échoue au lieu de passer en silence) (R25 §9).

**RLS corrigée (CR1 §2.K).** Politique restrictive sur chaque table métier, en `USING` et `WITH CHECK` :

```sql
tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
```

Sans `NULLIF`, une variable remise à vide ferait échouer la conversion au lieu de ne renvoyer aucune ligne. `app.tenant_id` et `app.actor_id` sont posés par `set_config(..., true)` puis `set local role app_rw` dans chaque transaction Drizzle. Les charges pg-boss ne contiennent que des identifiants ; le worker rouvre une transaction avec le `tenant_id` du job, puis revérifie que la ligne cible porte bien ce `tenant_id` avant d'agir. Batterie d'isolation à chaque migration (deux locataires, chaque table, chaque rôle).

**Chiffrement par enveloppe, `web` en sealed box (CR1 §2.J).** Une DEK AES-256-GCM par client dans `tenant_key`, chiffrée par la KEK, qui ne vit que dans les variables de `worker`. Le service `web`, exposé à Internet, reçoit pourtant les jetons OAuth et les clés BYOK : il ne détient qu'une clé publique X25519 et scelle immédiatement chaque secret (sealed box) dans `sealed_inbox` ; `worker` ouvre le scellé avec la clé privée et rechiffre avec la DEK du client. Un test de construction échoue si un champ secret apparaît dans une charge de job ou dans un journal. Rotation de la KEK une fois par an, des clés fournisseurs à 90 jours ; DEK supprimée en fin de contrat (R25 §5.3).

**Authentification du gestionnaire (CR1 §2.L).** Passkey (WebAuthn) par défaut ; à défaut, lien par courriel valable 15 minutes plus code TOTP. Session de 12 heures, renouvelée par un nouveau geste. Droits par `membership` : un gestionnaire ne voit que les clients qui lui sont attribués ; seuls owner et admin voient les coûts et la facturation. Chaque connexion, approbation, publication, export et changement de droit est écrit dans `audit_log`. Les clients n'ont pas de mot de passe : lien magique d'une planche, 256 bits haché, 14 jours, révoqué à la clôture. Webhooks vérifiés par signature avant mise en file ; URL présignées jamais journalisées en clair.

### 11.5 Sauvegardes à clé publique, tirées depuis le projet de sauvegarde

En v1, la KEK vivait dans « machine » : projet supprimé, sauvegardes illisibles ; et le worker qui écrivait les archives pouvait les effacer, faute de verrou d'objet (CR1 §2.D).

| Élément | Règle |
|---|---|
| Espace | projet « machine-sauvegarde » dans un espace Railway distinct, autre moyen de paiement, second administrateur ; bucket `archives` |
| Chiffrement | dumps et copies chiffrés par clé publique (age, X25519) ; « machine » ne connaît que la clé publique |
| Clé privée et copie de la KEK | gestionnaire de mots de passe de José et variables du projet de sauvegarde, jamais dans « machine » |
| Sens de la copie | « machine » dépose chaque semaine un `pg_dump --format=custom` chiffré dans `relais/` ; le projet de sauvegarde le tire, avec les nouveaux originaux ; « machine » n'a aucun identifiant d'écriture sur `archives`, et Postgres reste privé |
| Couches | instantanés de volume (6, 27, 89 jours), PITR (environ 4 semaines), dump hors projet (12 semaines, puis mensuel 12 mois) (R25 §2.2, §5.6) |
| Exercice | restauration trimestrielle chronométrée, consignée dans `audit_log` |

Limite acceptée : le projet de sauvegarde détient les clés du bucket `machine-ams`, en lecture et écriture, faute de droits par préfixe (R25 §5.2).

### 11.6 Règle de transit chez les fournisseurs

Plusieurs fournisseurs conservent des données : Higgsfield au moins 7 jours, Veo 2 jours, AssemblyAI, Upload-Post, Meta, Daily (CR1 §2.E). Règle : (1) tout résultat est copié dans le bucket Railway sous 24 heures ; (2) la suppression chez le fournisseur est demandée dès la copie quand elle existe (DELETE de la transcription AssemblyAI, suppression de l'enregistrement Daily) ; (3) chaque passage est écrit dans `provider_transit` ; (4) la liste des sous-traitants, avec ce que chacun conserve, est publique et annexée au contrat (annexe G). Daily n'écrit ses enregistrements que dans un bucket S3 ou OCI du client : il n'est utilisé qu'après un test d'écriture réussi vers un bucket Railway (phase 2 au plus tôt).

### 11.7 Points uniques de défaillance

| Point | Parade |
|---|---|
| José seul administrateur (Meta, WhatsApp, Railway, Anthropic, OpenAI, Higgsfield) | second administrateur Markel-Tech sur Meta Business, sur les deux espaces Railway et sur les consoles fournisseurs ; procédure d'urgence écrite |
| Un seul numéro WhatsApp +225 | numéro de réserve dans le même compte WhatsApp Business, modèles déjà approuvés |
| API Higgsfield jeune | Kling 3.0 via fal en repli immédiat |
| Opus 5.5 indisponible | Sonnet 5.5 en repli automatique à 08:00 |
| Upload-Post | paquet manuel ; connecteur Meta direct pour les pages de l'agence |
| Région Railway | dump hors projet ; services sans volume redéployables ailleurs |

### 11.8 Déploiement et tests

GitHub vers Railway automatiquement sur `main` ; migrations Drizzle par `migrator` en pré-déploiement de `web`, idempotentes, destructives seulement en deux temps ; garde de service inspirée de `scripts/garde-service.mjs` du dépôt 2IAE, qui arrête la construction si un service reçoit le mauvais code ; jamais `railway up` à la main. Fenêtre d'évitement de 05:45 à 06:30 GMT et pendant un lot de sermons. Tests : batterie RLS, contrats par connecteur sur comptes de test chaque semaine, lot d'évaluation du juge, bancs de la section 7.6, rendus comparés par hash perceptuel, page de validation à 390 px en Playwright, restauration trimestrielle, diff trimestriel des pages primaires (six faits sur dix avaient bougé en six mois, R26 §5.19), surveillance des canaux Drive `changes.watch` qui expirent à 7 jours (horloge H9).

### 11.9 Coûts d'hébergement

| Poste | 6 clients | 20 clients |
|---|---|---|
| `web`, `worker`, `tick` (plan Pro crédité) | 50 à 55 $ | 110 à 115 $ |
| `rendu` sans Serverless | 15 à 25 $ | 40 à 60 $ |
| Postgres, PITR, bucket, sortie | 27 $ | 69 $ |
| `staging` | 10 à 20 $ | 15 à 25 $ |
| Espace de sauvegarde | 10 à 30 $ | 25 à 45 $ |
| Total | environ 115 à 160 $ | environ 260 à 330 $ |

Base R25 §8 (85 à 110 $ et 230 à 290 $), corrigée du Serverless, du `staging` et de l'espace distinct, ces deux lignes étant des hypothèses à mesurer. Moins de 3 % du chiffre d'affaires ; c'est la génération qu'il faut plafonner. Remotion, Upload-Post et les abonnements sont au socle de la section 12.

## 12. Coûts et modèle économique

Cette section refait tous les calculs de la version 1 avec la grille de prix v1, le temps humain de 8 à 12 heures par client, la ligne « frais, taxes, charges », le socle recalculé et les coûts uniques. Les autres sections citent seulement « 4 à 5 clients payants » et renvoient ici.

### 12.1 Conventions de calcul

- Taux de référence (R10 §9.9) : 610 FCFA pour 1 $ ; 1 CAD = 0,705 $ ; 1 € = 655,957 FCFA. Tous les montants sont en dollars américains sauf mention, prix relevés les 1er et 2 octobre 2026.
- « Hypothèse » marque toute valeur qui ne vient d'aucun rapport R01 à R26. Elle est à remplacer par une mesure ou un devis.
- Chaque fourchette se lit « cas favorable à cas défavorable ». Les marges se calculent sur le prix hors taxes.
- Deux mesures de rentabilité, pour ne pas compter deux fois le gestionnaire :
  - la **marge complète** d'un client type : prix moins coûts directs, part du socle et de l'hébergement à 8 clients, heures de gestionnaire au taux chargé, humain canadien, frais ;
  - la **contribution hors gestionnaire** : prix moins coûts directs, humain canadien et frais. Elle sert au seuil, parce que le gestionnaire est un coût fixe tant qu'il n'est pas plein.

### 12.2 Grille de prix v1 et équivalents en dollars

| Palier | Abidjan (FCFA) | Équivalent | Canada (CAD) | Équivalent | Contenu mensuel |
|---|---|---|---|---|---|
| Chaire Essentiel | 95 000 | 156 $ | non proposé | | 1 compte, 3 clips par semaine (12 par mois), sans format long |
| Chaire | 175 000 | 287 $ | 700 | 494 $ | église avec régie, 2 comptes, 5 clips par sermon, 2 highlights animés et 1 verset animé par sermon, format long, dévotionnel, rapport |
| Présence (engagement 3 mois) | 300 000 | 492 $ | 900 | 635 $ | 12 visuels, 4 vidéos programmées, 2 plateformes, planche hebdomadaire, rapport |
| Vidéo+ catalogue | 650 000 | 1 066 $ | 2 200 | 1 551 $ | 12 Reels dont 6 génératifs, 8 carrousels, 4 UGC montés, boost supervisé |
| Vidéo+ pilote | 550 000 | 902 $ | | | les trois premiers mois d'un pilote |
| Frais d'intégration (crédités si engagement de 6 mois) | 125 000 | 205 $ | 400 | 282 $ | onboarding de 1 à 2 semaines |
| Option boîte de réception (réponse sous 24 h ouvrées) | 40 000 | 66 $ | 120 | 85 $ | tri, brouillons, validation humaine |
| Option boost supervisé | 15 % du budget, minimum 15 000 | 25 $ minimum | 15 %, minimum 50 | 35 $ minimum | jamais automatique |
| Reel génératif supplémentaire | 15 000 | 25 $ | 50 | 35 $ | au-delà des 6 inclus |

Taxes en sus : TVH 13 % en Ontario ; fiscalité ivoirienne (TVA, retenue à la source sur des honoraires de non-résident) à faire trancher par un avocat (hypothèse, CR3 §2.3). La France et l'offre « Logiciel seul » sont retirées de la v1. Encaissement : prélèvement préautorisé (PAD) au Canada, Wave Business à Abidjan, CinetPay et Stripe en repli (R10 §7.3).

### 12.3 Le temps humain et son coût

**Gestionnaire d'Abidjan, coût employeur** : 350 000 FCFA brut, plus charges CNPS de 15 à 20 % (hypothèse, CR3 §2.4), soit environ 410 000 FCFA, plus 25 000 FCFA de téléphone, data et transport : 435 000 FCFA, **715 $ par mois** (435 000 / 610 = 713 $, arrondi).

**Heures attribuables.** Un temps plein fait environ 173 heures par mois. Une partie ne s'attribue à aucun client : formation, files communes, réserve, attente, coordination. Hypothèse de travail : 90 heures attribuables par mois, ce qui correspond à 8 à 10 clients à 9 à 11 heures chacun, la limite fixée par DECISIONS.

**Taux chargé** : 715 $ / 90 h = **7,94 $ par heure client**.

| Offre | Heures de gestionnaire par mois | Coût | Statut |
|---|---|---|---|
| Chaire Essentiel | 6 h | 48 $ | hypothèse, sous le bas de la fourchette : un compte, pas de format long |
| Chaire Abidjan | 8 h | 64 $ | bas de la fourchette DECISIONS ; plafond du critère d'arrêt |
| Chaire Canada | 9 h | 72 $ | une heure de plus pour le double canal courriel et WhatsApp (hypothèse) |
| Présence Abidjan | 10 h | 79 $ | milieu de fourchette |
| Présence Canada | 11 h | 87 $ | idem plus une heure (hypothèse) |
| Vidéo+ Abidjan | 12 h | 95 $ | haut de fourchette |
| Vidéo+ Canada | 13 h | 103 $ | idem plus une heure (hypothèse) |

**Humain canadien.** Les clients canadiens sont servis depuis Abidjan (francophone, 4 à 5 heures de décalage). Un humain canadien ne fait que les appels : 1 heure par mois pour Chaire et Présence, 2 heures pour Vidéo+ (hypothèse), à 45 CAD de l'heure (milieu de 40 à 50 CAD, R08 §6.3), soit **32 $ l'heure**.

**Sensibilité.** Quatre heures de plus par client coûtent 32 $ par mois. Ces heures ne sont pas mesurées : l'indicateur « minutes de gestionnaire par client et par semaine », chronométré dans la PWA dès le pilote, remplace l'hypothèse avant la phase 3.

### 12.4 La ligne « frais, taxes, charges »

| Composante | Abidjan | Canada | Source |
|---|---|---|---|
| Encaissement | Wave Business environ 1 % ; repli CinetPay 2 à 3,5 % | PAD 1 % + 0,40 CAD plafonné à 5 CAD (0,2 à 0,7 % sur 700 à 2 200 CAD), Stripe Billing 0,7 %, Stripe Tax 0,5 % ; repli carte 2,9 % + 0,30 CAD | R10 §7.3 |
| Change | 1 à 3 % | 1 à 3 % | hypothèse (CR3 §2.2) |
| Provision pour impayés | 5 % | 5 % | CR3 §2.9 |
| **Total retenu** | **7 à 11,5 %** | **8 à 12 %** (7,4 % arrondi au-dessus) | |

La TVH de 13 % est collectée en sus et reversée : neutre pour la marge si Markel-Tech est inscrite. La retenue ivoirienne éventuelle ne l'est pas. Tant que l'avocat n'a pas répondu, un calcul de sensibilité : **chaque tranche de 10 points de retenue retire 29 $ par mois à une Chaire d'Abidjan, 49 $ à une Présence, 107 $ à un Vidéo+ au catalogue.** Le gestionnaire et les frais locaux sont payés en FCFA, ce qui limite le change à la marge.

### 12.5 Coûts directs variables par offre

Coûts qui naissent avec le client, hors socle, hébergement de base et humain. Prix unitaires de la section 7 et de R04, R05, R06, R07, R22, R24, R25.

**Chaire (Abidjan et Canada) : 4 sermons, 20 clips, 8 highlights animés, 4 versets animés, format long, citations, dévotionnels, 2 comptes**

| Poste | Calcul | Coût mensuel |
|---|---|---|
| Transcription AssemblyAI | 4 sermons × 1,5 h × 0,21 $ (R05 §8.3) | 1,3 $ |
| Analyse des sermons | 0,07 à 0,14 $ par sermon, Batch ou synchrone (R07 §7) | 0,3 à 0,6 $ |
| Autres jetons | citations, dévotionnels, juge Haiku, planche, rapport | 4 à 6 $ |
| Rendu | 20 clips, format long, highlights et versets Remotion (quelques centimes l'unité, R05 §3.8), audiogrammes | 1 à 2 $ |
| Images | cartes de versets HTML, miniatures | 0,5 à 1 $ |
| Enregistrement Daily | option après test d'écriture vers Railway : 4 × 1,21 $ (R21 §3.4) ; 0 $ en dépôt Drive | 0 à 4,8 $ |
| Veille, profil léger | R06 §14.2 | 5 à 10 $ |
| Stockage incrémental | proxy 720p plus audio (R25) | 0,5 à 1,5 $ |
| WhatsApp | 4 planches à 0,004 $, rappels, rapport au tarif marketing 0,0225 $ (R22), provision de 1 $ (R22 §10.16) | 1 $ |
| Mesure | collecte et rapport (R24 §8) | 1 à 3 $ |
| **Total** | | **15 à 31 $** |

**Chaire Essentiel : 4 sermons, 12 clips, 1 verset animé par sermon, 1 compte**

| Poste | Coût mensuel |
|---|---|
| Transcription (4 × 1,5 h × 0,21 $) | 1,3 $ |
| Analyse des sermons | 0,3 à 0,6 $ |
| Jetons (clips, citations, planche, rapport court) | 2 à 4 $ |
| Rendu (12 clips, 4 versets animés) | 0,5 à 1 $ |
| Images | 0,3 à 0,5 $ |
| Veille réduite au calendrier liturgique et aux fêtes (hypothèse) | 3 à 6 $ |
| Stockage, WhatsApp, mesure | 2,5 à 4 $ |
| **Total** | **10 à 17 $** |

**Présence (client externe, plus 2IAE) : 12 visuels, 4 vidéos programmées, 2 carrousels, 2 plateformes**

| Poste | Calcul | Coût mensuel |
|---|---|---|
| Images et carrousels | composition HTML (R03 §12.18) | 2 à 4 $ |
| Vidéos programmées, miniatures | Remotion, rendu CPU | 2 à 5 $ |
| Clips génératifs occasionnels | 2 teasers par an, lissés | 2 à 4 $ |
| Aperçus vidéo de 5 à 6 s pour la planche | 4 × 6 s × 0,06 $ (LTX-2.3, R04) = 1,44 $ | 1 à 2 $ |
| Jetons | R07 §7 | 9 à 14 $ |
| Veille standard | R06 §14.2 | 12 à 20 $ |
| WhatsApp et mesure | | 3 à 5 $ |
| Stockage | | 0,5 à 1 $ |
| **Total** | | **32 à 55 $** |

**Vidéo+ (beauté, Abidjan et Canada) : 12 Reels dont 6 génératifs, 8 carrousels, 4 UGC montés**

| Poste | Calcul | Coût mensuel |
|---|---|---|
| Vidéo générative | 6 Reels de 15 à 20 s à 5 à 6,50 $, 3 prises (R04 §6) | 30 à 39 $ |
| Scène signature lissée | 1 par trimestre à 9,30 à 18,50 $ (Seedance 2.5 à 0,2057 $ la seconde, 3 prises, CR1 §1.4) | 3,1 à 6,2 $ |
| Reels programmés, UGC montés, voix, musique | | 4 à 10 $ |
| Planches, aperçus vidéo, prises écartées | brouillons LTX-2.3 et maquettes ; coût des maquettes gpt-image-2.5 inconnu avant le banc de 20 générations (CR1 §1.3) | 15 à 25 $ |
| Images, détourage, carrousels, QC vision | R03 §9 | 3 à 6 $ |
| Jetons | création, juges, veille, tri de 2 000 commentaires (R23 §8.4) | 12 à 20 $ |
| Veille standard | | 12 à 25 $ |
| Extraction INCI, WhatsApp, mesure | | 3 à 5 $ |
| Stockage | | 1 à 2 $ |
| **Total** | | **83 à 138 $** |

La génération (vidéo, signature, planches) pèse 48 à 70 $, sous le plafond beauté de 120 $ (R25). Chaque Reel génératif supplémentaire coûte 5 à 6,50 $ et se vend 15 000 FCFA (25 $) ou 50 CAD (35 $) : 74 à 81 % de marge sur l'extra. La boîte de réception de Vidéo+ attend l'accès avancé Meta (phase 4, CR1 §2.H) ; son temps est déjà compté dans les 12 heures.

### 12.6 Le socle partagé recalculé

| Poste | 4 clients | 8 clients | 20 clients | Source |
|---|---|---|---|---|
| Veille partagée (SerpApi, Apify, Tavily, Exa, changedetection) | 30 à 100 (flux C incomplet, hypothèse) | 60 à 170 | 60 à 170 | R06 §14.1 |
| Upload-Post (1 profil = 1 compte sur 1 plateforme) | Pro 50 (25 profils) | Advanced 147 (75 profils) | Business 438 (225 profils) | R02 §8.1, CR3 E8 |
| Remotion Automators, jusqu'à réponse écrite | 100 | 100 | 100 | R25, CR1 §1.9 |
| ElevenLabs Creator (clonage) | 22 | 22 | 22 à 99 (Pro si plus de voix, hypothèse) | R04 |
| API Vizard, tant qu'elle sert de comparateur | 29 | 0 à 29 | 0 | R05, CR1 §1.2 |
| Canva Business (ex-Teams), 20 $ par siège | 20 | 20 à 60 | 40 à 60 | R01 ; minimum de sièges : hypothèse |
| Firecrawl Hobby | 0 à 16 | 0 à 16 | 16 | R06, R21 |
| Resend au-delà du palier gratuit | 0 à 20 | 0 à 20 | 0 à 20 | hypothèse |
| Numéros WhatsApp (+225, +1, numéro de réserve) | 5 à 15 | 5 à 15 | 10 à 20 | hypothèse |
| Langfuse | 0 | 0 à 29 | 0 à 29 | R07 |
| **Total socle** | **256 à 372** | **354 à 608** | **686 à 952** | |

Blotato est retiré (Upload-Post porte l'audit TikTok, CR1 §2.F). Epidemic Sound est sur devis et non compté : à ajouter au prix d'une église qui l'exige. Claude Max de José reste un outil personnel non imputé (R07 §11.17).

**Hébergement Railway**, corrigé : le service `rendu` ne dort jamais (une connexion pg-boss ouverte empêche la mise en veille, R25), et la sauvegarde vit dans un espace Railway distinct.

| Poste | 4 clients | 8 clients | 20 clients |
|---|---|---|---|
| Projet « machine » (web, worker, Postgres, buckets, PITR ; R25 : 85 à 110 $ à 6 clients, 230 à 290 $ à 20) | 80 à 100 (interpolé, hypothèse) | 100 à 130 (interpolé) | 230 à 290 |
| `rendu` toujours allumé : mémoire au repos (hypothèse) | 3 à 10 | 3 à 10 | 6 à 20 |
| Espace de sauvegarde distinct (plan Hobby 5 $ ou Pro 20 $) et staging en veille | 12 à 35 | 17 à 35 | 24 à 30 |
| **Total hébergement** | **95 à 145** | **120 à 175** | **260 à 340** |

À 8 clients, socle plus hébergement font 474 à 783 $, soit **59 à 98 $ par client** ; à 20 clients, 946 à 1 292 $, soit 47 à 65 $ par client. La limite dure Railway se pose à 3 fois la facture attendue (450 à 525 $ à 8 clients), alertes à 1,2 et 1,5 fois (CR1 §2.C).

### 12.7 Coût complet, marge et contribution par client type

Dollars par mois ; part du socle et de l'hébergement calculée à 8 clients.

| Client type | Prix | Coûts directs | Part socle et hébergement | Gestionnaire | Humain canadien | Frais, taxes, charges | **Coût complet** | **Marge complète** | Contribution hors gestionnaire |
|---|---|---|---|---|---|---|---|---|---|
| Église, Chaire Essentiel, Abidjan | 156 | 10 à 17 | 59 à 98 | 48 | 0 | 11 à 18 | **128 à 181** | **−16 à 18 %** | 121 à 135 |
| Église, Chaire, Abidjan | 287 | 15 à 31 | 59 à 98 | 64 | 0 | 20 à 33 | **158 à 225** | **21 à 45 %** | 223 à 252 |
| Église, Chaire, Canada | 494 | 15 à 31 | 59 à 98 | 72 | 32 | 39 à 59 | **217 à 291** | **41 à 56 %** | 372 à 407 |
| Présence externe, Abidjan | 492 | 32 à 55 | 59 à 98 | 79 | 0 | 34 à 57 | **205 à 289** | **41 à 58 %** | 380 à 425 |
| Présence, Canada | 635 | 32 à 55 | 59 à 98 | 87 | 32 | 51 à 76 | **261 à 348** | **45 à 59 %** | 472 à 520 |
| Beauté, Vidéo+ pilote, Abidjan | 902 | 83 à 138 | 59 à 98 | 95 | 0 | 63 à 104 | **301 à 435** | **52 à 67 %** | 660 à 756 |
| Beauté, Vidéo+ catalogue, Abidjan | 1 066 | 83 à 138 | 59 à 98 | 95 | 0 | 75 à 123 | **312 à 454** | **57 à 71 %** | 805 à 908 |
| Beauté, Vidéo+, Canada | 1 551 | 83 à 138 | 59 à 98 | 103 | 63 | 124 à 186 | **433 à 589** | **62 à 72 %** | 1 163 à 1 280 |

Exemple refait pas à pas, Chaire d'Abidjan, cas défavorable : 31 $ de coûts directs + 98 $ de socle + 8 h × 7,94 $ = 64 $ + 11,5 % × 287 $ = 33 $, total 225 $ ; marge (287 − 225) / 287 = 21 %. Cas favorable : 15 + 59 + 64 + 20 = 158 $ ; marge 45 %. En FCFA : 96 000 à 137 000 FCFA de coût pour 175 000 FCFA de prix.

Lecture :
- **Chaire Essentiel ne couvre pas sa part du socle** à 8 clients. C'est une porte d'entrée : sa contribution (121 à 135 $) paie ses coûts directs et son gestionnaire, pas l'infrastructure. Règle : jamais plus d'un Essentiel pour quatre clients, montée vers Chaire proposée au 3e mois, et révision du prix si le temps mesuré dépasse 6 heures.
- **Chaire d'Abidjan** est mince (21 à 45 %) : elle dépend du temps humain. À 12 heures au lieu de 8, la marge tombe à 10 à 34 %.
- **Le Canada servi depuis Abidjan** rend Chaire Canada rentable (41 à 56 %), contrairement à la v1 où le gestionnaire canadien la rendait déficitaire (CR3 E3, E5).
- **Vidéo+ porte l'économie** : sa contribution vaut 3 à 4 Chaire.

Comparaisons de marché, recalculées (CR3 E6) : Chaire d'Abidjan coûte 3,0 à 5,4 fois Sermon Shots (53 à 87 $ en annuel, 63 à 97 $ en mensuel, R05 §2.2) et Church Media Squad (1 697 $) coûte 5,9 fois Chaire d'Abidjan et 3,4 fois Chaire Canada. Vidéo+ à 650 000 FCFA se place sous les packs vidéo d'agence d'Abidjan (750 000 à 900 000 FCFA pour les packs avec vidéo, une seule grille non datée, R10 §7.1). Vidéo+ Canada à 2 200 CAD reste dans le bas des agences boutique de Toronto (1 500 à 5 000 CAD, R10).

### 12.8 Structure à 4, 8 et 20 clients payants

Les clients internes (SEVARTA, 2IAE, Markel-Tech) sont hors calcul : leur coût direct (environ 40 à 60 $ chacun, hypothèse) est refacturé au coût à l'entité concernée.

| | 4 clients (printemps 2027) | 8 clients (été 2027) | 20 clients (horizon 2028) |
|---|---|---|---|
| Mix | 2 Chaire Abidjan, 1 Présence Abidjan, 1 Vidéo+ Abidjan au prix pilote | 3 Chaire Abidjan, 1 Essentiel, 1 Chaire Canada, 1 Présence Abidjan, 1 Présence Canada, 1 Vidéo+ Abidjan au catalogue | 8 Chaire Abidjan, 3 Essentiel, 2 Chaire Canada, 3 Présence Abidjan, 1 Présence Canada, 2 Vidéo+ Abidjan, 1 Vidéo+ Canada |
| Chiffre d'affaires mensuel | 1 967 $ | 3 702 $ | 9 541 $ |
| Coûts directs | 145 à 255 $ | 217 à 389 $ | 557 à 995 $ |
| Humain canadien | 0 $ | 63 $ | 159 $ |
| Frais, taxes, charges | 138 à 226 $ | 270 à 431 $ | 700 à 1 113 $ |
| Gestionnaires d'Abidjan | 715 $ (1 ; 38 h attribuées sur 90) | 715 $ (1 ; 72 h sur 90) | 1 430 à 2 145 $ (2 à 3 ; 178 h) |
| Socle | 256 à 372 $ | 354 à 608 $ | 686 à 952 $ |
| Hébergement | 95 à 145 $ | 120 à 175 $ | 260 à 340 $ |
| Assurance (1 000 à 3 000 CAD par an, hypothèse) | 59 à 176 $ | 59 à 176 $ | 59 à 176 $ |
| **Total des coûts** | **1 407 à 1 889 $** | **1 799 à 2 558 $** | **3 850 à 5 880 $** |
| **Résultat avant temps de José, impôt et coûts uniques** | **78 à 560 $** | **1 144 à 1 903 $** | **3 661 à 5 691 $** |
| **Marge d'exploitation** | **4 à 28 %** | **31 à 51 %** | **38 à 60 %** |

Corrections de la v1 : la marge à 8 clients n'est pas 45 à 60 % mais 31 à 51 % ; à 20 clients, 38 à 60 % et non 55 à 65 % (CR3 E1, E2). À 6 clients (3 Chaire Abidjan, 1 Chaire Canada, 1 Présence Abidjan, 1 Vidéo+ catalogue ; 2 912 $ de chiffre d'affaires), le résultat vaut **684 à 1 312 $ par mois** pour José avant impôt (24 à 45 %), et non 1 500 $.

### 12.9 Seuil de rentabilité exact

**Coûts fixes mensuels au seuil** : gestionnaire 715 $ + socle à 4 clients 256 à 372 $ + hébergement 95 à 145 $ + assurance 59 à 176 $ = **1 125 à 1 408 $**.

**Règle** : le seuil est atteint quand la somme des contributions hors gestionnaire dépasse 1 408 $ (cas défavorable) ou 1 125 $ (cas favorable).

| Mix de clients payants | Contribution | Écart au cas défavorable / favorable | Verdict |
|---|---|---|---|
| 4 Chaire Abidjan | 892 à 1 007 $ | −517 / −118 $ | non : quatre églises seules ne suffisent pas |
| 5 Chaire Abidjan | 1 114 à 1 259 $ | −294 / +134 $ | non |
| 7 Chaire Abidjan | 1 560 à 1 763 $ | +152 / +638 $ | oui, mais à 7 clients |
| 3 Chaire + 1 Présence | 1 049 à 1 181 $ | −359 / +56 $ | non |
| 3 Chaire + 1 Vidéo+ pilote | 1 329 à 1 511 $ | −80 / +386 $ | seulement en cas favorable |
| **2 Chaire + 1 Présence + 1 Vidéo+ pilote** | **1 486 à 1 685 $** | **+78 / +560 $** | **oui : seuil à 4 clients** |
| **3 Chaire + 2 Présence** | **1 429 à 1 606 $** | **+21 / +481 $** | **oui : seuil à 5 clients sans Vidéo+** |
| 1 Chaire + 1 Présence + 1 Vidéo+ catalogue | 1 408 à 1 585 $ | 0 / +460 $ | équilibre exact à 3 clients |

**Seuil retenu : 4 clients payants si le mix compte au moins un Présence et un Vidéo+ (même au prix pilote) ; 5 clients sans Vidéo+ (3 Chaire, 2 Présence) ; 7 églises si l'on ne vend que Chaire.** Les pilotes à 50 % ne comptent pas : une Chaire à 87 500 FCFA (143 $) contribue 92 à 109 $. Au-delà de 90 heures attribuées (9 à 11 clients selon le mix), un second gestionnaire ajoute 715 $ de fixes : le résultat baisse d'autant le mois de l'embauche, et il faut 2 à 3 clients de plus pour le retrouver.

### 12.10 Coûts uniques

| Poste | Montant | Échéance | Statut |
|---|---|---|---|
| Juridique : contrat type (Abidjan, Ontario), accord de sous-traitance des données, accord de pilote, avis fiscal, ARTCI, statut du gestionnaire, marques « Chaire », « Dépôt » et nom commercial | 3 000 à 10 000 $ | octobre 2026 à avril 2027 | hypothèse (CR3 §2.6) |
| Assurance responsabilité professionnelle et cyber | 1 000 à 3 000 CAD par an (705 à 2 115 $) | avant le pilote en ligne | hypothèse |
| Banc de transcriptions de référence (5 sermons, environ 7,5 h d'audio, transcription humaine) | 150 à 400 $ | phase 0 | hypothèse |
| Bancs d'essai payants (20 générations gpt-image-2.5 par qualité, prompts vidéo par verticale) | 50 à 150 $ | phase 0 | hypothèse |
| Équipement du gestionnaire (ordinateur portable) et recrutement | 350 à 600 $ | décembre 2026 | hypothèse |
| Boîte photo LED prêtée aux clientes beauté | 18 000 FCFA (30 $) | février 2027 | R21 |
| Vérification d'entreprise Meta, modèles WhatsApp, audits YouTube et TikTok | 0 $ | phases 0 et 1 | R02, R22 |
| **Total** | **4 285 à 13 295 $** | | |

Non chiffré : le temps de José (environ 500 heures de construction, puis 6 à 10 heures par semaine la première année, CR3 §2.7) et la calibration du juge (une journée par verticale).

### 12.11 Plan de trésorerie, octobre 2026 à décembre 2027 (scénario central)

Hypothèses du scénario central :
- Clients : église pilote en ligne le 30 novembre, facturée à 50 % (143 $) de décembre à février puis au plein tarif ; Présence Abidjan en février ; marque de beauté au prix pilote Vidéo+ (902 $) de mars à mai puis au catalogue ; deuxième Chaire en avril ; Chaire Essentiel en mai ; Présence à Toronto en juin ; troisième Chaire en juillet ; Chaire Canada en août. Huit clients payants en août 2027.
- Coûts variables au milieu des fourchettes de 12.5 ; frais au milieu de 12.4.
- Gestionnaire en poste le 4 janvier 2027 (715 $ par mois).
- Socle au rythme des phases : Vizard d'octobre à février ; Remotion dès la première facture (décembre) ; Canva en janvier ; ElevenLabs en février ; Upload-Post Basic 24 $ en décembre et janvier, Pro 50 $ de février à juin, Advanced 147 $ dès juillet ; veille de 10 $ à 115 $ selon les flux ouverts ; API de développement 100, 75 et 50 $ d'octobre à décembre.
- Coûts uniques au milieu des fourchettes : juridique 6 500 $ (2 500 en octobre, 1 500 en novembre, 1 500 en février, 1 000 en avril), assurance 1 410 $ en novembre 2026 et en novembre 2027.
- Commission de vente sur place : 50 % du premier mois plein tarif pour les clients d'Abidjan trouvés par le vendeur (avril, mai, juillet ; hypothèse).
- Frais d'intégration non comptés (prudence : ils sont crédités en cas d'engagement de 6 mois).
- Encaissement le mois de la facture ; les retards sont couverts par la provision de 5 %.

| Mois | Clients payants | Encaissements | Coûts directs, humain canadien, frais | Gestionnaire | Socle et hébergement | Coûts uniques et commissions | Solde du mois | Cumul |
|---|---|---|---|---|---|---|---|---|
| oct. 2026 | 0 | 0 | 0 | 0 | 189 | 2 900 | −3 089 | −3 089 |
| nov. 2026 | 0 | 0 | 0 | 0 | 184 | 2 910 | −3 094 | −6 183 |
| déc. 2026 | 1 | 143 | 36 | 0 | 328 | 450 | −671 | −6 854 |
| janv. 2027 | 1 | 143 | 36 | 715 | 298 | 0 | −906 | −7 760 |
| févr. 2027 | 2 | 635 | 125 | 715 | 346 | 1 530 | −2 081 | −9 841 |
| mars 2027 | 3 | 1 680 | 332 | 715 | 417 | 0 | 216 | −9 625 |
| avr. 2027 | 4 | 1 967 | 382 | 715 | 417 | 1 143 | −690 | **−10 315** |
| mai 2027 | 5 | 2 123 | 410 | 715 | 417 | 78 | 503 | −9 812 |
| juin 2027 | 6 | 2 921 | 564 | 715 | 453 | 0 | 1 190 | −8 622 |
| juil. 2027 | 7 | 3 208 | 613 | 715 | 600 | 143 | 1 137 | −7 486 |
| août 2027 | 8 | 3 702 | 717 | 715 | 600 | 0 | 1 669 | −5 816 |
| sept. 2027 | 8 | 3 702 | 717 | 715 | 600 | 0 | 1 669 | −4 147 |
| oct. 2027 | 8 | 3 702 | 717 | 715 | 600 | 0 | 1 669 | −2 477 |
| nov. 2027 | 8 | 3 702 | 717 | 715 | 600 | 1 410 | 259 | −2 218 |
| déc. 2027 | 8 | 3 702 | 717 | 715 | 600 | 0 | 1 669 | −548 |
| **Total** | | **31 331** | **6 086** | **8 580** | **6 649** | **10 565** | **−548** | |

Résultats :
- **Besoin de trésorerie du scénario central : 10 315 $, atteint en avril 2027.** Premier mois positif : mars 2027 ; mois positifs sans interruption à partir de mai 2027. Le cumul revient à −548 $ fin décembre 2027.
- **Scénario défavorable** (chaque client sauf le pilote arrive deux mois plus tard, coûts au haut des fourchettes, socle et hébergement +20 %, juridique 10 000 $, assurance 3 000 CAD) : **besoin de 17 656 $ en avril 2027**, cumul de −13 740 $ fin 2027, huit clients seulement en octobre 2027 (annexe K).
- **Recommandation** : engager 12 000 $ (scénario central plus 15 %) et réserver une ligne de 6 000 $ débloquée seulement si les portes de décision de la section 14 sont franchies. Le total de 18 000 $ couvre le scénario défavorable. Hors temps de José.

### 12.12 Ce que la machine remplace, pour 10 clients

Hootsuite Professional à trois sièges 597 $ (R26 §5), Planable Pro 490 $, Linktree Pro 150 $, AgencyAnalytics 200 $, ManyChat Pro 290 à 390 $, Sermon Shots pour cinq églises 265 à 485 $ : 2 000 à 2 400 $ par mois d'abonnements pour une couverture partielle, sans veille locale, sans planche WhatsApp, sans vidéo réelle en français, sans couche affaires. La machine coûte à 10 clients environ 550 à 870 $ de socle et d'hébergement (interpolation de 12.6) plus 1 à 2 gestionnaires. L'argument de vente n'est pas le coût des outils : c'est le résultat opéré sur place.

### 12.13 Ce qui fait bouger la marge, par ordre d'effet

| Variable | Effet mensuel | Où la mesurer |
|---|---|---|
| Heures de gestionnaire (+4 h par client) | −32 $ par client ; Chaire d'Abidjan à 10 à 34 % | chronomètre de la PWA, dès le pilote |
| Retenue à la source ivoirienne (+10 points) | −29 $ par Chaire, −107 $ par Vidéo+ | avis d'avocat avant la première facture d'Abidjan |
| Mix sans Vidéo+ | seuil de 4 à 5, puis 7 clients | tableau de bord commercial |
| Upload-Post au palier supérieur | +97 $ (Pro vers Advanced), +291 $ (Advanced vers Business) | nombre de profils, chaque mois |
| Remotion gratuite si Remotion répond par écrit | +100 $ | réponse écrite de Remotion |
| Prises vidéo au-delà de 3 | 1 à 4 $ par prise (R08 §6.3) | `cost_ledger` |
| Change et frais de carte au lieu de Wave et PAD | jusqu'à −4,5 points de chiffre d'affaires | rapprochement mensuel |

## 13. Risques, limites et garde-fous

Échelle : probabilité faible, moyenne ou forte sur les douze prochains mois ; gravité de 1 (gêne) à 5 (arrêt du service ou perte définitive). Les risques de gravité 5 ont une parade en place avant le pilote en ligne.

### 13.1 Dépendances et points uniques de défaillance (CR1)

| Risque | Probabilité | Gravité | Parade |
|---|---|---|---|
| José seul administrateur de Meta Business, WhatsApp, Railway, Anthropic, OpenAI, Higgsfield : maladie, voyage, perte de téléphone | moyenne | 5 | second administrateur Markel-Tech sur Meta Business et Railway ; procédure d'urgence écrite dans le gestionnaire de mots de passe ; « mode José absent » (le gestionnaire tient les portes 1 et 3, aucune décision de prix ni de nouveau client) |
| Un seul numéro WhatsApp +225 suspendu ou en note basse | faible | 5 | numéro de réserve dans le même compte WhatsApp Business ; courriel et lien magique en double ; plafond de messages bloquant |
| Limite de dépense dure Railway : elle met TOUS les services hors ligne, Postgres et webhooks compris (R25) | faible | 5 | limite dure à 3 fois la facture attendue, alertes à 1,2 et 1,5 fois ; disjoncteurs applicatifs : `cost_ledger` avant chaque appel, 2 réplicas de `rendu` au plus, concurrence pg-boss bornée |
| Sauvegardes perdues ou illisibles : clé de chiffrement dans le projet « machine », worker capable d'effacer les archives, buckets sans verrou (R25 §1.3) | faible | 5 | dumps chiffrés par clé publique (age ou X25519) ; clé privée et copie de la KEK dans le gestionnaire de mots de passe de José et dans le projet de sauvegarde ; la copie tourne DANS le projet de sauvegarde et tire depuis « machine », qui n'a aucun identifiant d'écriture sur les archives ; espace Railway distinct, autre moyen de paiement, second administrateur ; restauration trimestrielle chronométrée |
| API Higgsfield jeune : lancée le 16 septembre 2026, 4 requêtes concurrentes dans l'exemple de la documentation (R26 §2.4) | moyenne | 3 | Kling 3.0 via fal (0,112 $ la seconde, R04) en repli immédiat dans `engine_registry` ; aucun volume vidéo garanti au contrat ; banc de 5 prompts par verticale avant chaque changement |
| Anthropic seul moteur de création, planche en retard | faible | 3 | Sonnet 5.5 en repli automatique si la planche n'est pas prête à 08:00 ; lot Batch lancé le mercredi 18:00, `custom_id` non terminés repassés en synchrone à 05:00 ; juge de planche synchrone |
| Dépréciations trimestrielles (gpt-image-1 le 23 octobre 2026 ; gpt-image-1.5, gpt-image-1-mini et chatgpt-image-latest le 1er décembre 2026 ; LinkedIn 202510 le 15 octobre 2026) | forte | 2 | moteurs et connecteurs abstraits, versions en configuration, tests hebdomadaires, diff trimestriel des pages primaires (R26 §5.19) |
| Données qui persistent chez les fournisseurs (Higgsfield 7 jours, Veo 2 jours, AssemblyAI, Daily, Upload-Post, Meta) | forte | 3 | règle de transit : copie sous 24 heures, puis suppression chez le fournisseur quand elle existe (DELETE AssemblyAI, suppression Daily) ; liste publique des sous-traitants (annexe G) ; Daily seulement après un test d'écriture vers Railway |
| Fuite d'un secret : le service `web` détenait la KEK | faible | 5 | `web` ne détient qu'une clé publique (sealed box) ; seul `worker` déchiffre et rechiffre avec la DEK du client ; test de construction qui échoue si un secret apparaît dans une charge de tâche |
| Fuite entre clients par une RLS mal posée | faible | 5 | `NULLIF(current_setting('app.tenant_id', true), '')::uuid` ; rôle de connexion non superutilisateur ; rôle pg-boss limité au schéma `pgboss` ; `tenant_id` de la tâche revérifié contre la ligne cible ; batterie RLS à chaque migration |
| Compte du gestionnaire usurpé | faible | 4 | passkey ou lien par courriel plus TOTP, sessions de 12 heures, droits par `membership`, journal d'audit |
| Disque éphémère de `rendu` saturé par un sermon de 3,4 Go | moyenne | 2 | mesure en phase 0 ; ingestion d'un proxy 720p plus audio |
| Canal Drive `changes.watch` expiré à 7 jours : sermons non vus | forte sans parade | 2 | renouvellement dans l'horloge de santé H9 ; alerte si aucun dépôt le lundi 08:00 |

### 13.2 Plateformes et accès

| Risque | Probabilité | Gravité | Parade |
|---|---|---|---|
| Revue Meta lente ou rejetée : un screencast par fonctionnalité et par permission, rejet si une permission n'est pas démontrée (R02 §2.1) | forte | 4 | phase 0 : vérification d'entreprise et applications en mode développement ; fin de phase 1 : revue limitée à la publication et aux statistiques, une vidéo par fonctionnalité ; phase 2 : commentaires, messagerie, HUMAN_AGENT ; Page Public Content Access abandonné ; accès avancé réaliste en 2 à 4 mois |
| Dépendance à Upload-Post : perte d'une application, commentaires et statistiques « partiels, à vérifier », unité de profil incohérente (CR1 §1.13) | moyenne | 4 | connecteur abstrait ; MetaDirectConnector pour les pages où Markel-Tech a un rôle sur l'APPLICATION Meta ; paquet manuel de premier rang ; MCP Metricool en sortie de secours ; mesure initiale sur la couche affaires maison |
| TikTok : écran obligatoire par publication (confidentialité sans défaut, aperçu, divulgation commerciale) | moyenne | 3 | l'écran de porte 3 de la PWA implémente ces éléments et sert de vidéo d'audit ; Upload-Post porte l'audit en attendant |
| YouTube : vidéos privées tant que l'audit n'est pas obtenu | forte avant audit | 2 | audit déposé en fin de phase 1 avec sa vidéo ; publication par la régie ou à la main entre-temps |
| Modèles WhatsApp reclassés en marketing, blocage silencieux (R22 §3.1) | moyenne | 3 | cinq modèles utilitaires seulement (`planche_prete`, `production_terminee`, `publication_faite`, `confirmation_optin`, `alerte_gestionnaire`) ; rapport mensuel budgété au tarif marketing (0,0225 $) ; voie rapide seulement dans une fenêtre de 24 heures ouverte, sinon appel du gestionnaire ; webhook de reclassement surveillé |
| Jetons expirés : reconnexion à la charge du client | moyenne | 2 | jeton d'utilisateur système (Facebook Login for Business) pour tout client avec une Page ; Instagram Login rafraîchi à J-5 ; Page Facebook contrôlée chaque semaine par `debug_token` |

### 13.3 Juridique et conformité (repris de la v1)

| Risque | Probabilité | Gravité | Parade |
|---|---|---|---|
| Droits sur les sorties IA : une image brute n'a probablement pas d'auteur au Canada ni dans l'OAPI (R08 §1.5) | moyenne | 3 | `licence_registry` par média, preuve de l'apport humain, licence d'usage commercial sans exclusivité sur les éléments bruts (clause 5, annexe A) |
| Palier gratuit d'un moteur non commercial ou entraînant (Suno Free, ElevenLabs Free ; Higgsfield hors Enterprise entraîne, R26) | forte sans parade | 3 | compte payant par moteur au nom de l'agence ; aucun visage de client chez Higgsfield sans contrat Enterprise |
| Étiquetage IA : AI Act article 50 depuis le 2 août 2026, TikTok, Meta et YouTube par déclaration (R08 §10.10) | moyenne | 3 | `ai_label` par variante, drapeau natif à la publication, C2PA conservé, taux d'étiquetage affiché |
| Droit à l'image, mineurs, fidèles filmés | moyenne | 4 | registre de consentements relié à chaque média, blocage sans consentement, floutage du public, aucun enfant sans autorisation parentale |
| Allégations cosmétiques (Santé Canada, règlement 655/2013, politique Meta du 23 juillet 2026) | moyenne | 4 | lexique par pays, contrôle avant la planche, refus sans manquement contractuel (clause 7) |
| Données religieuses sensibles (demandes de prière), transfert hors Côte d'Ivoire, ARTCI (CR3 §5.8) | moyenne | 4 | minimisation, chiffrement, conservation courte, accès restreint (annexe G) ; avis d'avocat sur la déclaration ou l'autorisation ARTCI avant le pilote |
| Anti-pourriel : CASL, politique WhatsApp du 23 septembre 2026 | faible | 4 | opt-in en deux cases, journal de preuve, STOP, aucune prospection depuis le numéro machine |
| Conditions des plateformes : YouTube interdit le téléchargement, LinkedIn l'automatisation de profil, Higgsfield l'automatisation de l'Unlimited | faible | 4 | fichier fourni par l'église, API officielles, posts du fondateur publiés par José, API Higgsfield à l'acte au nom de l'agence ; José utilise le MCP officiel en crédits dans Claude ou Cowork |

### 13.4 Économie, concurrence, fiscalité et vente (CR3)

| Risque | Probabilité | Gravité | Parade |
|---|---|---|---|
| Menace numéro un : un community manager d'Abidjan avec Claude Cowork, le MCP Metricool (43 €), Canva et CapCut couvre 80 % de Présence pour environ 100 $ par mois | forte | 4 | vendre le résultat opéré : vidéo réelle, couche affaires, continuité garantie, gestionnaire nommé ; ne jamais vendre d'outil aux concurrents locaux |
| Pulpit AI ou Sermon Shots traduits en français en quelques semaines | moyenne | 3 | vitesse : 10 églises avant mi-2027 ; Segond 1910, reconnaissance vocale testée sur l'accent ivoirien, mobile money, publication et validation pastorale |
| OpusClip et ses clips sous-titrés en français | forte | 2 | cibler les églises sans équipe média ; validation doctrinale, dévotionnel, highlights animés, publication |
| ContentStudio Agency (139 $), Blotato plus n8n : portail et production à l'aveugle | moyenne | 2 | trois portes humaines, verticales réglementées, opération sur place |
| Cannibalisation par un « Logiciel seul » ou un MCP « partenaire agence » vendu aux community managers d'Abidjan | moyenne | 3 | retiré de la v1 ; phase 4 seulement, agences partenaires hors Abidjan, facturé par espace, clause de non-concurrence |
| Fiscalité : retenue à la source sur honoraires de non-résident, TVA 18 % (hypothèse), entité qui facture | moyenne | 4 | avis d'avocat avant la première facture d'Abidjan ; prix affichés hors taxes ; sensibilité en 12.4 |
| Trésorerie : pilotes à 50 %, retards de paiement fréquents (R10 §8.11) | forte | 4 | provision de 5 % ; Wave et PAD ; relance et suspension douce (annexe D) ; budget de 12 000 $ plus 6 000 $ de réserve (12.11) |
| Personne pour vendre et faire les démonstrations à Abidjan | forte | 4 | vendeur à la commission (50 % du premier mois plein tarif, hypothèse) ; kit commercial (annexe I) ; réseau d'églises de José |
| Prix d'Abidjan fondés sur une seule grille non datée (R10 §9.8) | moyenne | 3 | trois devis réels avant de figer la grille v2 ; révision au premier anniversaire |
| Mix trop riche en Chaire : 7 églises nécessaires si l'on ne vend que Chaire | moyenne | 4 | objectif commercial de phase 2 : un Présence et un Vidéo+ avant la deuxième église |

### 13.5 Qualité et expérience (CR2)

| Risque | Probabilité | Gravité | Parade |
|---|---|---|---|
| Contenu tiède : le juge à 15/21 laisse passer du générique | moyenne | 4 | 3/3 exigé en ancrage réel pour le pilier relation ; voix tirée de la parole réelle (sermons, vocaux, réponses, page « à propos »), jamais des posts d'une agence précédente ; test d'acceptation en aveugle (R11 §5.1) ; bibliothèque de formats gagnants par verticale dès le mois 2 |
| Cliente muette dès la première semaine | forte | 3 | réserve de démarrage de 12 contenus validée pendant l'onboarding ; défaut « sans réponse » tranché avant le pilote ; alerte « risque de départ » élargie à la hausse des « à revoir » et au délai de réponse qui s'allonge |
| Trop de notifications : le client se lasse ou bloque | moyenne | 3 | une seule planche par client et par semaine (lundi midi pour Chaire) ; le reste dans le récapitulatif du dimanche ; plafond mesuré dans `whatsapp_message` et bloquant |
| Planche illisible sur téléphone, validation sans lecture | moyenne | 3 | vue client limitée à visuel, hook, jour, réseau, « ce que nous attendons de vous » ; composite de 6 vignettes numérotées au plus ; « Je valide tout » retiré pour églises et beauté |
| Charge de José intenable (construction, portes, calibration, vente) | forte | 4 | trajectoire écrite : 6 à 10 heures par semaine la première année, moins de 2 heures en année 2 ; gestionnaire en janvier 2027 ; bouton « Approuver tout ce qui est prêt » limité aux éléments passés en porte 3 ; version n+1 sans relecture seulement en exception écrite (motif standard, juge au moins 15, jamais église ni beauté) |
| Gestionnaire introuvable, mal formé ou qui part | moyenne | 5 | fiche de poste (annexe J) ; double relecture par José le premier mois puis échantillon de 10 % ; remplaçant formé dans le vivier 2IAE ; procédures écrites dans la PWA |
| Heures de Toronto (14 h à 22 h GMT) non couvertes | moyenne | 2 | horaire décalé du gestionnaire deux jours par semaine, astreinte d'incident jusqu'à 22 h GMT ; humain canadien pour les appels |

### 13.6 Limites que la machine ne lève pas

- 56 % des utilisateurs voient souvent du « AI slop » et la moitié de la génération Z a bloqué une marque pour cela (R11 §1) : la qualité perçue reste un risque permanent, géré par l'ancrage réel et 20 % de contenus humains, jamais supprimé.
- Claude ne détecte pas les images synthétiques et ne nomme pas les personnes (R07 §11.14) : le consentement d'un visage repose sur le registre tenu par le gestionnaire.
- Les médianes locales n'existent qu'après trois mois de collecte ; aucun benchmark public ne couvre la Côte d'Ivoire ni le Canada francophone (R24).
- La « boutique Facebook avec paiement » n'existe pas en Côte d'Ivoire (R23 §8.19) : la machine dit ce qu'elle ne livre pas.
- Les Routines restent en aperçu, sans idempotence (R07 §10.4) : rien de critique n'en dépend.

## 14. Feuille de route

### 14.1 Durée réelle et principes

Du 5 octobre 2026 à la fin de la phase 2 (28 février 2027) : **environ 21 semaines**, marge de 25 % comprise dans les dates, pause des fêtes comprise. Le dossier n'écrit plus « 90 jours ». Trois principes :
1. Une seule église pilote en phase 1, plus SEVARTA en interne. Le pilote est en ligne au plus tôt le 30 novembre 2026.
2. Chaque phase a deux critères de sortie : technique (la machine tient) et commercial (quelqu'un paie). Une phase ne se ferme pas sur le seul critère technique.
3. Une porte de décision à la fin de chaque phase, avec des critères d'arrêt écrits à l'avance (14.5).

### 14.2 Acheter ou construire

| Brique | Décision | Justification |
|---|---|---|
| Publication multi-plateformes | acheter Upload-Post (Basic puis Pro, Advanced dès 8 clients) ; construire `MetaDirectConnector` pour les pages où Markel-Tech a un rôle sur l'application Meta ; apps propres après les revues | revues incompressibles (R02 §12.1) ; Blotato retiré |
| Transcription | acheter AssemblyAI (0,21 $ l'heure), second moteur au banc | WhisperX seulement au-delà de 200 heures par mois (R05) |
| Images, détourage, vidéo générative | acheter : OpenAI (gpt-image-2.5 flare et sunburst), fal, API Higgsfield, repli Kling 3.0 via fal | API officielles, asynchrones, abstraites |
| Découpe de sermons, composition, vidéos programmées | construire (ffmpeg, libass, Remotion, Playwright) | centimes par rendu, différenciation française |
| Clips bruts pendant la construction | louer l'API Vizard (29 $ par mois sans engagement) | filet et comparateur, coupé quand le banc donne l'avantage à la chaîne maison |
| Veille, calendrier, voie rapide | construire sur flux gratuits, SerpApi, Apify, Tavily | personne ne couvre Abidjan en français (R01) |
| Planche, validation WhatsApp, lien magique | construire (Cloud API directe) | objet central sans équivalent (R08 §10.2) |
| Cerveau de marque, juge, QC vision, bancs | construire (API Messages) | qualité mesurée, données accumulées |
| Boîte de réception, lien en bio, QR, rapport | construire, la boîte de réception en phase 3 et 4 | remplace ManyChat, Linktree, AgencyAnalytics |
| Facturation | acheter Stripe (PAD) et Wave Business ; construire les tables et webhooks (annexe D) | deux rails, R10 §7.3 |
| Orchestration, observabilité | pg-boss, tables maison, Langfuse Hobby en phase 2 | aucun composant de plus |
| Pilotage par Claude | MCP en lecture seule plus `log_decision`, Routines (`POST /fire`) limitées au connecteur machine-social, bouton « Confier à Claude » en phase 3 | rien de critique n'en dépend (R07 §2.6) |

### 14.3 Les coupes du MVP (phases 0 et 1, CR1 §3)

| Garder | Reporter |
|---|---|
| Chaire de bout en bout : ffmpeg, libass, Remotion, AssemblyAI | voie rapide et `tendance_express` |
| Planche par modèle WhatsApp plus lien magique PWA, sans Flow | veille des flux B et C, plongements |
| Quatre files (à relire, en attente client, à contrôler, à publier à la main) plus l'état des jetons | Dépôt beauté et vidéo générative Higgsfield (fin de phase 2) |
| Upload-Post et paquet manuel | boîte de réception, boost, Click-to-WhatsApp, Conversions API, coupons |
| Un moteur par famille | bandit, Trial Reels |
| Un juge Haiku | Flow, Web Push |
| `cost_ledger`, RLS, sauvegardes corrigées | MCP, Routines, Cowork, Agent SDK, Langfuse |
| Liens traçables et QR | MetaDirectConnector hors pages de l'agence |
| Un seul pilote (église) plus SEVARTA en interne | Blotato, Daily, MediaPipe, Canva, voix clonées |
| | LinkedIn et X ; second juge gpt-4o-mini ; attestation PDF, partitions mensuelles, diff trimestriel |

### 14.4 Les phases

**Phase 0. Fondations et accès, du 5 au 18 octobre 2026 (2 semaines)**

Contenu : vérification d'entreprise Meta ; applications Meta, Google et TikTok en mode développement ; numéro WhatsApp +225 vérifié, numéro de réserve, cinq modèles utilitaires soumis ; projets Railway « machine » et « machine-sauvegarde » (espace distinct, autre moyen de paiement), limite dure à 3 fois, second administrateur ; skill `/db` sur le schéma jusqu'au feu vert ; mesure du disque éphémère de `rendu` et de la latence Abidjan vers Amsterdam ; bancs (30 phrases, 5 sermons avec transcriptions de référence, prompts par verticale, 20 générations gpt-image-2.5 par qualité avec lecture de `usage`) ; retrait de gpt-image-1 avant le 23 octobre ; avocats mandatés ; question écrite à Remotion.

Sortie technique : schéma validé par `/db`, premier message utilitaire reçu sur un téléphone d'Abidjan, coûts unitaires inscrits dans `engine_registry`, restauration d'essai depuis le projet de sauvegarde.
Sortie commerciale : église pilote signée (accord de pilote, annexe A.5), budget de trésorerie engagé, défaut « sans réponse » choisi.

**Phase 1. « Chaire minimal », du 19 octobre au 13 décembre 2026 (8 semaines)**

Contenu : la liste « Garder » de 14.3 ; onboarding de l'église (annexe B) avec réserve de démarrage de 12 contenus et fond de catalogue de 10 anciens sermons ; une planche par semaine le lundi midi ; 5 clips du mardi au samedi, 2 highlights animés et 1 verset animé par sermon, format long ; écran de porte 3 conforme TikTok ; chronomètre « minutes de gestionnaire » dans la PWA ; authentification du gestionnaire. **Pilote en ligne au plus tôt le 30 novembre 2026.** Fin de phase : dépôt de la revue Meta (publication, statistiques) et des audits YouTube et TikTok, chacun avec sa vidéo.

Sortie technique : un sermon déposé le dimanche donne une planche le lundi midi et cinq clips du mardi au samedi, sans intervention de José hors validation ; coût réel sous 3 $ par sermon ; WER mesuré sur 5 sermons contre un second moteur ; batterie RLS verte ; zéro jeton en clair dans les journaux ; disjoncteurs testés ; dossiers de revue déposés avec numéros de suivi.
Sortie commerciale : deux dimanches traités en production ; première facture du pilote émise ; deux rendez-vous commerciaux obtenus (un Présence, une marque de beauté) ; gestionnaire recruté pour le 4 janvier.

**Phase 2. Généraliste, Dépôt et vidéo générative, du 14 décembre 2026 au 28 février 2027 (11 semaines avec la pause des fêtes)**

Contenu : planche généraliste ; Présence ; Dépôt beauté (photo normale acceptée, document seulement pour l'INCI) ; vidéo générative par l'API Higgsfield, repli Kling 3.0 via fal, plafond de 120 $ ; aperçu vidéo de 5 à 6 s dans la fenêtre de 24 heures ; voie rapide (statique puis vidéo par gabarits Remotion) ; boîte à tendances de la cliente ; couverture du catalogue et « produit oublié du mois » ; tournage guidé ; vocal du lundi ; réserve enrichie sans prix ni allégation ; Canva et voix clonées consenties ; revue Meta commentaires, messagerie, HUMAN_AGENT. Les critères des quatre semaines du pilote église sont mesurés ici.

Sortie technique : dépôt vers planche sous 24 heures ; génération beauté sous plafond ; 100 % des médias photoréalistes étiquetés ; juge accepté au premier coup à plus de 70 % ; premier rapport avec couche affaires non vide.
Sortie commerciale : 3 clients payants signés dont au moins un Présence et un Vidéo+ (au prix pilote) ; pilote église jugé sur ses quatre semaines (annexe H) ; minutes de gestionnaire mesurées par client ; délai de paiement médian connu ; gestionnaire formé et autonome sur les quatre files.

**Phase 3. Veille complète, mesure, Canada, de mars à mai 2027**

Contenu : veille des flux B et C ; boîte de réception dès l'accès avancé ; mesure complète ; MCP en lecture seule plus `log_decision` et Routines limitées au connecteur machine-social ; bouton « Confier à Claude » avec ordres types (genèse d'événement, vidéo explicative de logiciel, relecture de planche) ; Cowork par une tâche planifiée qui lit les ordres en attente ; LinkedIn ; « ce qui marche chez vos voisins » ; réponse vidéo aux commentaires ; collecte d'UGC réel par le mot clé « AVIS » ; remontée des meilleurs contenus. Toronto : client signé avant le 10 janvier 2027 pour le Mois de l'histoire des Noirs, sinon viser l'été (Juneteenth, Caribbean Carnival début août, rentrée), avec modèles et juge en anglais (annexe F).

Sortie technique : test hebdomadaire vert quatre semaines de suite ; José exécute une revue hebdomadaire depuis Claude Code par le MCP ; facture Railway sous 150 $.
Sortie commerciale : **5 clients payants (le seuil de 12.9)** ; au moins 2 pilotes sur 3 convertis au plein tarif à 90 jours ; client de Toronto signé ou rendez-vous fixés pour l'été.

**Phase 4. Palier de 8 clients, de juin à septembre 2027**

Contenu : palier de 8 clients payants ; pré-test des hooks adapté au pays (Trial Reels au Canada, variantes sur des jours distincts à Abidjan) ; bandit par verticale ; boost supervisé ; offre partenaires réservée à des agences hors Abidjan (facturée par espace, non-concurrence) ; prix de la grille v2 fixés sur trois devis réels par marché.

Sortie technique : apps propres pour au moins une plateforme ; aucune panne de plus de 4 heures sur le trimestre.
Sortie commerciale : 8 clients payants ; marge d'exploitation mesurée d'au moins 31 % (bas de 12.8) et visée à 40 % ; aucun client perdu pour « pas à la page » ; temps de José sous 4 heures par semaine, en route vers 2.

### 14.5 Portes de décision et critères d'arrêt

| Porte | Date | Question | Si non |
|---|---|---|---|
| G0 | 18 octobre 2026 | Entreprise Meta vérifiée ou en cours, église pilote signée, budget engagé ? | décaler la phase 1 de deux semaines, pas plus ; au-delà, revoir le projet |
| G1 | 13 décembre 2026 | Pilote en ligne, revue Meta déposée, gestionnaire recruté ? | prolonger la phase 1 de quatre semaines au plus ; aucun deuxième client tant que la chaîne Chaire ne tient pas seule |
| G2 | 28 février 2027 | 3 clients payants, critères du pilote atteints, temps humain mesuré ? | appliquer les critères d'arrêt ci-dessous |
| G3 | 31 mai 2027 | 5 clients payants, 2 pilotes sur 3 convertis ? | pivot : Chaire seul à 7 églises, ou prix relevés |
| G4 | 30 septembre 2027 | 8 clients payants, marge mesurée ? | geler le recrutement d'un second gestionnaire |

**Critères d'arrêt ou de pivot (CR3 §5.9)**, mesurés aux portes G2 et G3 :
1. moins de 2 pilotes sur 3 convertis au plein tarif à 90 jours ;
2. temps humain supérieur à 8 heures par client et par mois pour Chaire, mesuré sur quatre semaines ;
3. acceptation des planches sous 50 % deux mois de suite ;
4. marge d'exploitation mesurée sous 40 % à 6 clients.

Le quatrième critère est exigeant : la prévision à 6 clients est de 24 à 45 % (12.8). Il se déclenche donc dans le cas défavorable, et c'est voulu : dans ce cas, on relève les prix ou on coupe le socle avant de recruter.

### 14.6 Le premier pilote

Une église d'Abidjan dont le pasteur a déjà une audience vidéo et une régie (R09 §11.7), une chaîne YouTube active et un sermon chaque dimanche. Conditions : 50 % pendant trois mois, frais d'intégration offerts, conversion automatique, témoignage si les critères sont atteints (annexe A.5). Coût direct sous 3 $ par sermon, aucune étiquette IA, preuve visible en deux dimanches. Critères des quatre semaines : WER, acceptation des propositions, sermons réemployés sous 7 jours, rétention à 3 secondes, portée hors assemblée, minutes de gestionnaire (annexe H).

## 15. Questions ouvertes pour José

Seulement ce que la recherche ne tranche pas. Chaque question porte une recommandation et une échéance.

| N° | Question | Recommandation | Échéance |
|---|---|---|---|
| 1 | Budget de trésorerie | engager 12 000 $, plus 6 000 $ de réserve débloqués aux portes G2 et G3 (12.11) | 18 octobre 2026 |
| 2 | Église pilote | une église d'Abidjan avec régie et chaîne YouTube active, prête à 50 % pendant 3 mois contre données et témoignage | 18 octobre 2026 |
| 3 | Avocats | un cabinet en Ontario (contrat, TVH, assurance) et un à Abidjan (contrat local, fiscalité, ARTCI, statut du gestionnaire) ; le Québec seulement au premier client québécois | mandat le 18 octobre ; contrat de pilote prêt le 15 novembre |
| 4 | Second administrateur | une personne de confiance de Markel-Tech sur Meta Business et sur l'espace Railway de sauvegarde, avec la procédure d'urgence | 18 octobre 2026 |
| 5 | Défaut « sans réponse » | réserve activée : publier la réserve validée (valeur, relation), jamais de promotion ; « tout retenir » reste une case au contrat | 15 novembre 2026 |
| 6 | Entité qui facture | Markel-Tech Inc. pour le Canada (TVH) ; pour Abidjan, attendre l'avis fiscal : une entité ivoirienne si une retenue à la source frappe les honoraires de Markel-Tech | 30 novembre 2026 |
| 7 | Gestionnaire : profil, statut, date | salarié à Abidjan (CNPS) plutôt que prestataire, recruté dans le vivier 2IAE, en poste le 4 janvier 2027 ; entretiens en décembre | décision le 30 novembre 2026 |
| 8 | Remotion | écrire à Remotion pour savoir si une plateforme qui vend des rendus automatisés relève d'Automators ; payer 100 $ par mois dès la première facture en attendant | question en phase 0 |
| 9 | Nom commercial | une marque distincte de Markel-Tech pour la plateforme, déposée avec « Chaire » et « Dépôt » ; Markel-Tech reste l'entité contractante au Canada | 15 décembre 2026 |
| 10 | Vendeur sur place | un vendeur à la commission issu du réseau des églises, 50 % du premier mois plein tarif (hypothèse), à partir de mars 2027 | 31 janvier 2027 |
| 11 | Visages et Higgsfield | aucun visage de client dans la vidéo générative sans contrat Enterprise ; les visages viennent de vidéos réelles filmées (tournage guidé) | 15 janvier 2027 |
| 12 | Voix clonées | enregistrer la voix de José pour SEVARTA et Markel-Tech en phase 2 ; clients seulement sur consentement écrit, voix détruite à la sortie (annexe E) | 31 janvier 2027 |
| 13 | Toronto | viser le Mois de l'histoire des Noirs seulement si une association est signée avant le 10 janvier 2027, sinon l'été | 10 janvier 2027 |
| 14 | Sermons : originaux ou proxy | proxy 720p plus audio, original gardé par l'église | phase 0 |
| 15 | 2IAE et le site | demander à la session du site trois événements GA4 pour les admissions ; lecture seule des données publiques du campus | mars 2027 |

## 16. Faiblesses qui restent, honnêtement

1. **Toute l'économie repose sur une heure qui n'a jamais été mesurée.** 8 à 12 heures par client est une hypothèse ; à 12 heures, Chaire d'Abidjan tombe à 10 à 34 % de marge. Le chronomètre du pilote tranche, pas ce dossier.
2. **Chaire Essentiel ne couvre pas sa part du socle** (−16 à 18 % de marge complète). Elle n'est défendable que comme porte d'entrée, limitée en nombre.
3. **Le seuil exige un Vidéo+.** Avec seulement des églises, il faut 7 clients ; or la beauté arrive en fin de phase 2, avec la vidéo générative la moins éprouvée.
4. **Le besoin de trésorerie est réel** : 10 315 $ au centre, 17 656 $ en défavorable, hors temps de José. Le cumul ne redevient pas positif avant 2028 dans le scénario défavorable.
5. **La fiscalité ivoirienne est inconnue.** Une retenue à la source sur les honoraires de Markel-Tech peut retirer 10 points ou plus à chaque facture d'Abidjan.
6. **Les prix d'Abidjan reposent sur une seule grille non datée** (R10 §9.8) ; l'écart peut atteindre 20 % après trois devis.
7. **Le gestionnaire n'existe pas encore**, et José tient seul les portes jusqu'au 4 janvier 2027 tout en construisant.
8. **Le temps de José reste lourd la première année** : 6 à 10 heures par semaine, sans compter environ 500 heures de construction.
9. **Les accès plateformes ne sont pas sous contrôle** : accès avancé Meta en 2 à 4 mois, audits YouTube et TikTok sans date garantie ; entre-temps, Upload-Post, dont l'unité de profil reste incohérente dans R02.
10. **L'API Higgsfield a deux semaines** au moment d'écrire ; le repli Kling via fal coûte 0,112 $ la seconde contre 0,084 $.
11. **Le coût des maquettes gpt-image-2.5 est inconnu** avant le banc de 20 générations ; il n'entre dans aucun devis.
12. **Les hypothèses non sourcées pèsent** : charges CNPS, juridique, assurance, change, Resend, numéros, commission du vendeur, heures attribuables. Elles sont marquées, pas vérifiées.
13. **Le quatrième critère d'arrêt (marge sous 40 % à 6 clients) tombe au milieu de la prévision** (24 à 45 %) : il peut se déclencher sans échec réel du produit.
14. **Toronto exige un second jeu de qualité** : modèles, juge et banc vocal en anglais, sans budget distinct dans ce dossier.
15. **La franchise de 1 000 messages de service WhatsApp** n'est confirmée que par des sources secondaires (R22 §3.6) ; montant faible, incertitude réelle.
16. **Claude ne détecte pas les images synthétiques** et la machine se mesure elle-même ; seuls les retours clients et les ventes attribuées valident la qualité.

## Annexes

### Annexe A. Contrat, niveau de service et accord de pilote

**A.1 Documents.** Contrat cadre ; annexe tarifaire (grille 12.2) ; annexe de niveau de service ; accord de sous-traitance des données (annexe G) ; accord de pilote s'il y a lieu. Signature électronique ; la validation par lien magique, courriel ou WhatsApp vaut accord écrit.

**A.2 Les quinze clauses (R08 §8.1), rédaction de travail à faire relire par l'avocat**

1. **Objet** : plateformes, nombre de contenus et de vidéos par mois, langue, délais, créneaux ; hors forfait listé en A.4.
2. **Validation** : planche hebdomadaire à valider sous 3 jours ouvrés ; sans réponse après deux rappels et un appel, règle cochée : « réserve activée » ou « tout retenir ».
3. **Exactitude** : le client garantit prix, dates, allégations et photos qu'il dépose.
4. **Droits fournis** : logos, photos, sermons, musiques, consentements des personnes ; autorisation parentale écrite pour tout mineur.
5. **Contenus générés par IA** : information claire ; licence d'usage commercial illimitée sur les livrables ; pas d'exclusivité sur les éléments bruts ; étiquetage IA appliqué selon les plateformes et la loi.
6. **Pas de deepfake** : aucune personne réelle représentée par IA sans consentement écrit ; aucun mineur ; aucune voix clonée sans autorisation signée.
7. **Allégations réglementées** : preuves fournies par le client ; refus de l'agence sans manquement.
8. **Comptes** : propriété du client ; accès par rôles, aucun mot de passe ; retrait des accès sous 5 jours après la fin.
9. **Données** : client responsable, agence sous-traitante ; liste des sous-traitants ; incident notifié sous 72 heures.
10. **Musique** : bibliothèques commerciales, musique générée sous licence payante ou licence fournie.
11. **Mesure** : trois couches, rapport mensuel le premier lundi après le 3 ; aucune garantie de résultat chiffré.
12. **Prix** : forfait mensuel, surcoût au-delà du plafond de génération, révision annuelle, suspension douce à 30 jours d'impayé, préavis de résiliation de 30 jours.
13. **Responsabilité** : plafond égal aux honoraires des 3 derniers mois ; exclusion des pertes indirectes et des suspensions décidées par les plateformes.
14. **Références** : droit de citer le client sauf opposition écrite.
15. **Loi applicable** : Ontario pour les contrats de Markel-Tech ; droit ivoirien pour Abidjan si l'avocat le recommande ; médiation préalable.

**A.3 Définitions.** « Planche » : l'ensemble des propositions de la semaine. « Proposition » : un contenu daté pour un réseau. « Validé » : tap « Je valide », réponse écrite ou vocale « oui », ou clic sur le lien magique. « À revoir » : demande de modification avec motif. « Réserve » : contenus intemporels validés à l'avance, publiables sans nouvelle validation. « Publié » : contenu en ligne avec URL enregistrée. « Jour ouvré » : lundi à vendredi hors jours fériés du pays du client. « Heures ouvrées » : 8 h à 18 h GMT à Abidjan ; 9 h à 17 h heure de l'Est à Toronto.

**A.4 Niveau de service**

| Engagement | Valeur |
|---|---|
| Envoi de la planche | lundi midi pour Chaire ; vendredi 10 h pour les autres |
| Production après validation | 24 à 48 heures |
| Versions incluses par proposition | deux (« à revoir » une fois, puis une seconde fois avec un motif nouveau) ; au-delà, la proposition est remplacée |
| Retrait d'un post erroné | moins d'une heure en heures ouvrées, moins de 4 heures hors heures ouvrées |
| Réponse au support | moins de 4 heures ouvrées |
| Boîte de réception (option) | réponse sous 24 heures ouvrées |
| Rapport mensuel | premier lundi après le 3, avant 9 h heure du client |
| Plafond de génération | église 60 $, beauté 120 $ par mois ; Reel génératif supplémentaire 15 000 FCFA ou 50 CAD |
| Hors forfait | budget publicitaire, tournage sur place, gestion de crise au-delà de 2 heures, contenus en plus de la grille |
| Engagement | Présence : 3 mois ; frais d'intégration crédités sur la 6e facture si engagement de 6 mois |

**A.5 Accord de pilote.** Durée 3 mois ; remise de 50 % (Vidéo+ : 550 000 FCFA) ; frais d'intégration offerts ; critères de succès écrits (annexe H) ; conversion automatique au plein tarif sauf résiliation écrite 15 jours avant la fin ; témoignage écrit ou vidéo si les critères sont atteints ; droit d'utiliser les structures apprises (jamais le contenu) ; options cochées : règle « sans réponse », mandat tendance (formats sans visage, sans prix, sans sujet religieux).

### Annexe B. Onboarding pas à pas (1 à 2 semaines)

| Jour | Étape | Responsable | Outil |
|---|---|---|---|
| J-7 | Signature, paiement des frais d'intégration ou accord de pilote | José | contrat, Wave ou PAD |
| J-7 | Opt-in WhatsApp en deux cases non précochées (service, propositions commerciales) | client | lien de consentement |
| J-6 | Accès : partage d'actifs Business Manager par l'identifiant de portefeuille de Markel-Tech ; sans Business Manager, création assistée en visio ou Instagram Login ; jeton d'utilisateur système pour toute Page | client, guidé par le gestionnaire | Meta Business Suite |
| J-6 | Chaîne YouTube : Markel-Tech gestionnaire ; dossier Drive de dépôt partagé avec le compte de service | client | YouTube, Drive |
| J-5 | Brand kit extrait du site, validé | machine, gestionnaire | Firecrawl, Claude |
| J-5 | Corpus de voix : sermons transcrits, vocaux, réponses aux commentaires, page « à propos » ; jamais les posts d'une agence précédente | gestionnaire | PWA |
| J-4 | Registre des consentements : personnes filmées, mineurs exclus ou autorisation parentale | client, gestionnaire | `consent` |
| J-3 | Fond de catalogue : 10 meilleurs anciens sermons (église) ou catalogue produits (beauté) | client | Drive, WhatsApp |
| J-2 | Réserve de démarrage : 12 contenus proposés et validés pendant la visio (minutes 45 à 55) | client, gestionnaire | lien magique |
| J-1 | Test d'acceptation en aveugle de la fiche de voix (deux relecteurs) ; planche zéro | gestionnaire, José | PWA |
| J0 | Première planche réelle | machine, gestionnaire | WhatsApp |
| J+7 | Point de 20 minutes : ce qui a plu, ce qui manque | gestionnaire | appel |
| J+14 | Fin d'onboarding : chronomètre lu, réglages corrigés | gestionnaire | PWA |

Messages types :
- Accueil : « Bonjour [prénom], bienvenue. Je suis [gestionnaire], votre gestionnaire. Chaque lundi à midi, vous recevrez ici vos propositions de la semaine. Un tap suffit pour valider. »
- Accès : « Pour que nous publiions sans jamais connaître vos mots de passe, ouvrez ce lien et ajoutez Markel-Tech comme partenaire. Cela prend 3 minutes. Je reste en ligne si besoin. »
- Fond de catalogue : « Envoyez-nous vos 10 sermons préférés des derniers mois. Nous en tirons vos premières publications dès cette semaine. »
- Réserve : « Voici 12 publications intemporelles. Celles que vous validez nous servent si vous êtes occupé une semaine. Nous ne publions jamais rien que vous n'avez pas vu. »

### Annexe C. Support et incidents

- **Canaux** : WhatsApp du numéro machine (clients), téléphone du gestionnaire, courriel du support. Aucun client n'écrit au numéro personnel de José.
- **Horaires** : lundi à samedi, 8 h à 18 h GMT. Toronto (14 h à 22 h GMT) : gestionnaire décalé de 11 h à 20 h GMT deux jours par semaine, astreinte d'incident jusqu'à 22 h GMT, humain canadien pour les appels.

| Niveau | Exemple | Délai d'action | Qui |
|---|---|---|---|
| P1 | post erroné, faux, propos sensible, compte piraté | moins d'1 heure : retrait | gestionnaire, José prévenu |
| P2 | publication bloquée, jeton expiré, panne d'un fournisseur | moins de 4 heures | gestionnaire |
| P3 | planche en retard, rendu raté | dans la journée | gestionnaire |
| P4 | demande de changement | sous 3 jours ouvrés | gestionnaire |

**Retrait d'un post erroné** : 1. supprimer ou archiver sur chaque réseau ; 2. geler les publications programmées du client ; 3. prévenir le client avec le message type ; 4. noter la cause dans `audit_log` ; 5. corriger la règle ou le lexique ; 6. revue sous 48 heures. Message type : « Nous avons retiré à [heure] la publication [titre] : [erreur]. C'est notre faute. Rien d'autre ne partira avant votre accord. Voici ce que nous changeons : [mesure]. »

**Crise** (commentaire viral hostile, deuil, rumeur) : gel de toutes les publications programmées, aucun commentaire de l'agence sans accord écrit du client, brouillon de déclaration soumis au client, fin de gel décidée par le client.

**Remplaçant** : un remplaçant formé (vivier 2IAE) ; en son absence, « mode José absent » inversé : José tient les portes 1 et 3, la production de nouvelles propositions ralentit, la réserve tient les créneaux.

### Annexe D. Facturation

**Tables** : `subscription` (tenant, plan, prix, devise, début, engagement, statut) ; `invoice` (numéro, période, montant HT, taxes, devise, échéance, statut) ; `payment` (rail : PAD, Stripe, Wave, CinetPay ; référence externe ; montant ; frais ; date) ; `credit_note` (avoir, motif, facture liée) ; `overage` (Reels supplémentaires, prises au-delà du plafond, boost).

**Flux** :
- Canada : abonnement Stripe avec prélèvement PAD ; facture PDF en CAD avec numéro de TVH et TVH de 13 % pour l'Ontario, générée par le skill `markel-invoice` ; webhook Stripe vers `payment`.
- Abidjan : facture en FCFA émise le 1er ; lien de paiement Wave Business envoyé par courriel et repris dans le récapitulatif du dimanche ; webhook Wave, CinetPay en repli ; mentions fiscales selon l'avis de l'avocat.
- Synchronisation des contrats et factures dans Zoho CRM (compte, affaire, montant mensuel).

**Calendrier** : facture le 1er ; relance à J+3 par courriel ; appel du gestionnaire à J+10 ; **suspension douce à J+30** (plus de nouvelles propositions, les publications programmées partent) ; suspension à J+60, accès conservés ; prorata au jour pour un début en cours de mois ; avoir en cas de retrait d'un post erroné imputable à l'agence. Aucun sixième modèle WhatsApp de relance avant la phase 3.

### Annexe E. Sortie d'un client

| Étape | Délai | Détail |
|---|---|---|
| Préavis | 30 jours | confirmation écrite, date de fin |
| Publications programmées | à la date de fin | liste remise au client ; maintenues ou annulées selon son choix écrit |
| Export | sous 10 jours | ZIP avec manifeste et sommes de contrôle : livrables payés, fichiers sources, légendes, rapports, fiche de voix et brand kit |
| Propriété | | livrables payés et fiche de voix au client ; gabarits Remotion, code et juge à l'agence |
| Accès | sous 5 jours | rôles Business Manager retirés, jetons révoqués, Drive et YouTube détachés |
| Voix clonée | sous 5 jours | suppression chez ElevenLabs, preuve jointe à l'attestation |
| Données | sous 30 jours | suppression vérifiée par `HEAD` ; suppression de la DEK, qui rend illisibles les copies restant dans les dumps jusqu'à leur expiration (89 jours) |
| Attestation | à la fin | PDF de fin de contrat ; registre des consentements conservé pour la durée de preuve indiquée par l'avocat |

Message type : « Votre contrat se termine le [date]. Vous recevrez votre dossier complet le [date]. Nous retirons nos accès le [date] et supprimons vos données et votre voix ; l'attestation suivra. Merci pour ces [n] mois. »

### Annexe F. Bilinguisme et accessibilité

Anglais pour Toronto, avant le premier client :
- [ ] les cinq modèles WhatsApp traduits et approuvés en anglais ;
- [ ] lexiques d'interdits et d'allégations en anglais ;
- [ ] juge calibré sur 100 posts en anglais et 40 contre-exemples ;
- [ ] banc vocal en anglais (accents de la diaspora) ;
- [ ] PWA, planche et rapport bilingues ; bilinguisme exigé pour une association ontarienne subventionnée (R10 §7.2) ;
- [ ] pour un client québécois : Loi 96 et Loi 25 (évaluation avant transfert hors Québec).

Accessibilité, pour tous :
- [ ] texte alternatif sur chaque image publiée ;
- [ ] sous-titres incrustés sur chaque vidéo, fichier SRT pour YouTube ;
- [ ] pages client (planche, rapport, lien en bio) conformes WCAG 2.1 AA : contraste, lecture à 390 px, focus clavier ; AODA en Ontario ;
- [ ] cartes de versets et citations avec contraste vérifié par la couche 1 du QC.

### Annexe G. Gouvernance des données

| Catégorie | Exemples | Règle |
|---|---|---|
| Données de marque | logos, posts, brand kit | conservées pendant le contrat |
| Données personnelles d'abonnés | commentaires, messages | minimisées, 13 mois au plus |
| Données sensibles | demandes de prière, santé, convictions religieuses | transmises au pasteur, jamais réutilisées en contenu, chiffrées, purgées à 30 jours (hypothèse à valider par l'avocat), accès gestionnaire et client seulement |
| Biométrie | visages, voix clonées | consentement écrit, aucune extraction de gabarit, destruction à la sortie |

**Sous-traitants publiés** (pays et durée de conservation à tenir à jour) : Railway (EU West, Amsterdam), Anthropic, OpenAI, fal, Higgsfield (entraîne sur les comptes hors Enterprise ; 7 jours), Google (Veo, 2 jours), AssemblyAI (suppression par DELETE), ElevenLabs, Upload-Post, Meta, YouTube, TikTok, Daily (si utilisé), Resend, Stripe, Wave, CinetPay.

**Obligations** : registre des traitements ; avis de l'avocat sur la déclaration ou l'autorisation ARTCI pour les données sensibles et le transfert hors Côte d'Ivoire ; plan d'incident à 72 heures (détecter, contenir, évaluer, notifier client et autorité si requis, corriger) ; apprentissage inter-clients limité aux structures (famille de hook, format, durée), jamais le contenu d'un client ; demandes d'accès et d'effacement traitées sous 30 jours.

### Annexe H. Indicateurs du pilote et critères d'arrêt

| Indicateur | Cible | Mesure |
|---|---|---|
| WER sur 5 sermons de référence | meilleur des deux moteurs retenu | banc de la phase 0 |
| Coût réel par sermon | moins de 3 $ | `cost_ledger` |
| Dépôt vers planche | moins de 24 heures | horodatages |
| Acceptation des propositions sans modification majeure | plus de 70 % | `board_item` |
| Sermons réemployés (3 clips sous 7 jours) | 100 % | `content_item` |
| Rétention à 3 secondes, portée hors assemblée | au-dessus de la médiane du premier mois | collecte nocturne |
| **Minutes de gestionnaire par client et par semaine** | moins de 110 minutes pour Chaire (8 heures par mois) | chronomètre de la PWA |
| Conversion au plein tarif à 90 jours | 2 pilotes sur 3 | facturation |
| Délai de paiement médian | moins de 10 jours (hypothèse) | `payment` |
| Recommandation (« recommanderiez-vous ? » de 0 à 10) | au moins 8 | question du rapport du 3e mois |
| Témoignage obtenu | oui | accord de pilote |

Critères d'arrêt ou de pivot : voir 14.5. Décision écrite à la porte, avec les chiffres du tableau ci-dessus.

### Annexe I. Kit commercial et vente sur place

**Client cible église** : régie en place, chaîne YouTube active, un sermon par semaine, pasteur qui veut être vu hors de l'assemblée, budget de communication déjà dépensé (bénévoles, imprimeur). **Présence** : PME, école ou association qui publie déjà sans régularité. **Vidéo+** : marque de beauté avec des produits physiques et une fondatrice prête à filmer.

**Démonstration** : sur un sermon fourni par l'église (jamais téléchargé de YouTube), trois clips et un verset animé présentés au rendez-vous ; coût sous 3 $.

| Objection | Réponse |
|---|---|
| « Nos bénévoles le font déjà. » | Ils gardent le direct. Nous livrons 5 clips, 2 highlights et un dévotionnel chaque semaine, validés par le pasteur, publiés à l'heure. |
| « C'est de l'IA, ça va se voir. » | Vos clips sont votre vraie voix et votre vraie image. Rien n'est inventé ; tout passe par le pasteur. |
| « C'est cher. » | Chaire Essentiel à 95 000 FCFA, ou 3 mois de pilote à moitié prix. |
| « Et si je n'ai pas le temps de valider ? » | Un tap le lundi. Si vous êtes occupé, votre réserve validée tient la semaine. |
| « Qu'est-ce que ça rapporte ? » | Chaque mois, le rapport compte les visiteurs, dons et inscriptions venus des publications (liens, QR). |

**Objectifs** : 8 rendez-vous par mois à partir de mars 2027, un client signé pour 4 rendez-vous (hypothèses à mesurer). **Vendeur sur place** : commission de 50 % du premier mois plein tarif (hypothèse), versée après le premier paiement ; prospection par le réseau personnel, jamais depuis le numéro machine.

### Annexe J. Fiche de poste du gestionnaire

- **Intitulé** : gestionnaire de comptes social media. **Lieu** : Abidjan. **Rattachement** : José Kouadio.
- **Statut** : salarié (à confirmer par l'avocat, question 7) ; période d'essai selon le droit ivoirien.
- **Rémunération** : 350 000 FCFA brut par mois, plus 25 000 FCFA de téléphone, data et transport ; coût employeur environ 435 000 FCFA (715 $).
- **Horaires** : lundi à vendredi, 8 h à 17 h GMT, deux jours décalés à 11 h à 20 h GMT pour Toronto ; samedi matin en rotation.
- **Missions** : porte 1 (relire et envoyer les planches) ; suivi des clients en attente, appels ; porte 3 (contrôle des rendus, conformité, étiquette IA) ; publications à la main (Channels, Status, carrousels longs) ; commentaires sensibles ; onboarding ; rapport lu avec le client.
- **Compétences** : français écrit impeccable, anglais écrit pour Toronto, culture des réseaux sociaux d'Abidjan, sens éditorial, connaissance du milieu des églises appréciée.
- **Indicateurs** : minutes par client et par semaine ; délai de la porte 1 (moins de 24 heures) ; erreurs passées en porte 3 ; acceptation des planches de ses clients ; retards de paiement de ses clients.
- **Formation** (2 semaines) : les quatre files, la rubrique du juge, la conformité (consentements, allégations, étiquetage), Meta Business Suite, procédures P1 à P4.
- **Contrôle qualité** : double relecture par José le premier mois, puis échantillon de 10 % chaque semaine.
- **Remplaçant** : un stagiaire 2IAE formé en parallèle, activé en cas d'absence.

### Annexe K. Plan de trésorerie : règles et scénario défavorable

Le scénario central mois par mois est en 12.11. Scénario défavorable (chaque client sauf le pilote décalé de deux mois, coûts au haut des fourchettes, socle et hébergement +20 %, juridique 10 000 $, assurance 3 000 CAD) :

| Mois | Clients payants | Encaissements | Coûts directs, humain canadien, frais | Gestionnaire | Socle et hébergement | Coûts uniques et commissions | Solde du mois | Cumul |
|---|---|---|---|---|---|---|---|---|
| oct. 2026 | 0 | 0 | 0 | 0 | 227 | 4 550 | −4 777 | −4 777 |
| nov. 2026 | 0 | 0 | 0 | 0 | 221 | 5 115 | −5 336 | −10 113 |
| déc. 2026 | 1 | 143 | 47 | 0 | 394 | 600 | −898 | −11 010 |
| janv. 2027 | 1 | 143 | 47 | 715 | 358 | 0 | −977 | −11 987 |
| févr. 2027 | 1 | 143 | 47 | 715 | 415 | 2 030 | −3 064 | −15 051 |
| mars 2027 | 1 | 287 | 64 | 715 | 500 | 0 | −993 | −16 044 |
| avr. 2027 | 2 | 779 | 176 | 715 | 500 | 1 000 | −1 612 | **−17 656** |
| mai 2027 | 3 | 1 680 | 417 | 715 | 500 | 0 | 48 | −17 608 |
| juin 2027 | 4 | 1 967 | 481 | 715 | 544 | 143 | 84 | −17 524 |
| juil. 2027 | 5 | 2 123 | 516 | 715 | 720 | 78 | 94 | −17 430 |
| août 2027 | 6 | 2 921 | 698 | 715 | 720 | 0 | 789 | −16 642 |
| sept. 2027 | 7 | 3 208 | 762 | 715 | 720 | 143 | 868 | −15 774 |
| oct. 2027 | 8 | 3 702 | 884 | 715 | 720 | 0 | 1 383 | −14 391 |
| nov. 2027 | 8 | 3 702 | 884 | 715 | 720 | 2 115 | −732 | −15 123 |
| déc. 2027 | 8 | 3 702 | 884 | 715 | 720 | 0 | 1 383 | −13 740 |

**Règles de gestion**
1. Revue de trésorerie le premier lundi de chaque mois, avec le rapport des clients : réel contre plan, ligne par ligne.
2. Les 6 000 $ de réserve ne se débloquent qu'aux portes G2 et G3 franchies.
3. Si le cumul dépasse −12 000 $ avant avril 2027 : gel du juridique non urgent, Upload-Post et Canva au palier inférieur, report de la phase 3.
4. Les frais d'intégration encaissés restent en réserve jusqu'à la 6e facture du client (ils peuvent être crédités).
5. Les comptes clients sont tenus en FCFA pour payer le gestionnaire sans change.
6. Le temps de José n'est pas dans le plan : il est sa mise de départ.
