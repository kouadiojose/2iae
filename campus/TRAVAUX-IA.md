# Travaux d'IA du soir (routine du soir)

Le campus n'a plus de crédit d'API Anthropic. Avec la variable Railway `CAMPUS_IA_SOIR=oui`, il n'appelle
plus l'API :

- l'assistant interactif (tuteur, bibliothécaire, questions éclair) affiche « en pause » ;
- le travail de fond garde chaque demande qu'il aurait envoyée à l'API (table `demandes_ia`), avec ses
  consignes et le schéma JSON de la réponse attendue. C'est le cas du **cours complet** tiré de
  l'enregistrement d'une séance (notes, cours rédigé, quiz, exercices, évaluation) et du **dossier de
  lecture** d'un livre demandé à la bibliothèque.

Chaque soir, une routine Claude Code fait ce travail à la place de l'API : elle lit les demandes, écrit les
réponses, et le campus termine tout seul. Il prévient alors les étudiants et les formateurs (notification et
téléphone), exactement comme avant.

## Ce que fait la routine

Depuis la racine du dépôt :

1. `node campus/scripts/travaux-ia.mjs tour`
   Le campus fait avancer chaque travail jusqu'à sa prochaine demande sans réponse. L'outil écrit chaque
   demande en attente dans `campus/.travaux-ia/<id>/` (dossier ignoré par git) :
   - `consignes.md` : les consignes (système) et le message, comme l'API les aurait reçus ;
   - `images/` : les diapositives, quand la demande en contient (les lire avec l'outil de lecture d'images) ;
   - `schema.json` : le schéma exact de la réponse.
2. Pour chaque demande : lire `consignes.md` (et les images), puis écrire la réponse dans
   `campus/.travaux-ia/<id>/reponse.json`, puis l'envoyer :
   `node campus/scripts/travaux-ia.mjs repondre <id>`
   Une réponse qui ne respecte pas le schéma est refusée, avec la liste des écarts : corriger et renvoyer.
3. Recommencer le `tour` : les travaux avancent à l'étape suivante (après les notes de lecture vient le cours
   rédigé, puis l'entraînement, puis l'évaluation). Continuer jusqu'à « Aucune demande en attente ».

## Comment répondre

- Faire exactement ce que demandent les consignes, en français, avec le même soin que l'API : c'est le travail
  que les étudiants recevront. Le tutoiement ou le vouvoiement est dit dans les consignes.
- S'en tenir au contenu fourni (transcription, diapositives, extraits du livre) : ne rien inventer.
- La réponse est **un seul objet JSON** conforme à `schema.json` : toutes les propriétés sont requises, aucune
  autre n'est permise, les entiers sont des entiers (par exemple `debutSecondes`), et les valeurs d'une liste
  fermée (`enum`) sont reprises telles quelles.
- Respecter la longueur indicative (le nombre de jetons de la demande) : les notes d'un extrait sont
  détaillées mais ne recopient pas la transcription.

## Ce que la routine ne fait jamais

- Elle ne met rien en ligne (pas de `railway up`, pas de `deployer.sh`), ne modifie ni le code ni les
  variables Railway, et n'écrit rien d'autre que les réponses aux demandes.
- Elle n'affiche jamais la clé `TRAVAUX_IA_JETON`.
- Si le `tour` est refusé (clé absente ou invalide, campus en panne), elle s'arrête et le dit dans son compte
  rendu, sans chercher à contourner.

## Questions en direct : l'IA gratuite

Le tuteur, le bibliothécaire, les outils des leçons et la recherche de livres répondent tout de suite grâce à
l'offre gratuite d'un autre service (server/ia-gratuite.ts), sans carte bancaire, donc sans facture possible :

- Railway, service `campus` : `IA_GRATUITE_CLE` (clé Google AI Studio, aistudio.google.com) ; facultatif :
  `IA_GRATUITE_MODELE` (par défaut `gemini-flash-latest`). Pour Mistral : `IA_GRATUITE_URL=https://api.mistral.ai/v1`
  et `IA_GRATUITE_MODELE=mistral-small-latest`.
- Ne jamais ajouter de carte bancaire au compte du service : au-delà du quota gratuit du jour, il refuse
  simplement (l'assistant dit de réessayer plus tard), rien n'est facturé.
- Sur l'offre gratuite, le service peut lire les échanges pour améliorer ses modèles : l'interface demande de
  ne pas y écrire d'informations personnelles.

## Mise en place (déjà faite)

- Railway, service `campus` : `CAMPUS_IA_SOIR=oui` et `TRAVAUX_IA_JETON` (clé aléatoire, à ne jamais
  partager). Pour revenir à l'API quand le crédit sera rechargé : retirer `CAMPUS_IA_SOIR`.
- Environnement Claude Code de la routine : le secret `TRAVAUX_IA_JETON`, même valeur que sur Railway.
- Routine Claude Code « Travaux d'IA du soir », chaque soir à 20 h 47 (heure d'Abidjan).
