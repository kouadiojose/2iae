# Reprise automatique de la page Facebook

La page [Groupe 2IAE International](https://www.facebook.com/Groupe2ife2iae) est
tenue à jour bien plus souvent que le site. Cette intégration reprend ses
publications, les classe en rubriques et les publie sur le site.

## Ce qui se passe pour une publication

```
Publication Facebook
   ↓  webhook Meta (temps réel) ou rattrapage horaire
Récupération via la Graph API
   ↓
Téléchargement des images sur le volume du serveur   ← indispensable, voir plus bas
   ↓
Classement : rubrique, titre, résumé, importance
   ↓
   ├─ hors sujet  → écartée, motif consigné dans facebook_posts
   └─ retenue     → actualité (+ album si 3 photos ou plus)
                    └─ mise à la une si l'importance dépasse le seuil de sa rubrique
```

## Pourquoi les images sont téléchargées

Les URL d'images renvoyées par Facebook pointent vers son CDN et **expirent**,
la date étant encodée dans le paramètre `oe=`. Le site en a déjà fait les
frais : un slider pointait vers une URL portant `oe=68B4E9A7`, soit le
30 août 2025, et l'image ne s'affichait plus.

Aucune URL Facebook n'est donc jamais stockée. Chaque image est copiée dans
`$UPLOADS_DIR/facebook/` sous un nom dérivé d'une empreinte de l'URL d'origine,
ce qui évite de dupliquer un fichier lors d'une resynchronisation.

## Les rubriques

Définies dans `server/facebook/rubriques.ts` :

| Rubrique | Contenu | Seuil de mise à la une |
|---|---|---|
| Cérémonies & Diplômes | Remises de diplômes, sorties de promotion | 60 |
| Partenariats | Conventions, accords, signatures | 60 |
| Admissions | Inscriptions, rentrée, concours | 55 |
| Distinctions | Prix, récompenses, classements | 60 |
| Événements | Conférences, forums, portes ouvertes | 50 |
| Vie du campus | Quotidien : cours, sport, culture, ambiance | 85 |
| Formations | Filières, programmes, nouvelles offres | 55 |
| International | Mobilité, missions, délégations | 60 |
| Communiqués | Annonces officielles de la direction | 65 |

Le seuil élevé de « Vie du campus » est délibéré : ces publications nourrissent
le site et sa page galerie sans occuper la page d'accueil. Une seule actualité
est à la une à la fois.

La page `/actualites` construit ses filtres à partir des catégories présentes en
base. Ajouter une rubrique dans ce fichier la fait donc apparaître seule sur le
site dès qu'un contenu l'utilise, sans toucher au code du front.

## Le classement

Deux moteurs, dans cet ordre :

1. **OpenAI** (`OPENAI_API_KEY`) — rédige un vrai titre et un résumé propres à
   partir d'un texte de réseau social souvent brut, et choisit la rubrique.
2. **Règles lexicales** — utilisées si la clé manque, si l'appel échoue, ou si
   la réponse est inexploitable (rubrique inventée, JSON invalide).

Le second n'est pas un choix de configuration : c'est ce qui garantit que la
synchronisation continue quand OpenAI est indisponible.

Une formule de politesse (« bonne semaine », « bon week-end ») ne suffit pas à
écarter une publication : elle ne disqualifie que si le message ne parle de rien
d'autre. Sans cette nuance, la vie de campus disparaîtrait du site.

## Configuration

| Variable | Obligatoire | Rôle |
|---|---|---|
| `FACEBOOK_PAGE_ID` | ✅ | Identifiant numérique de la page |
| `FACEBOOK_PAGE_TOKEN` | ✅ | Jeton d'accès à la page |
| `FACEBOOK_APP_SECRET` | Pour le webhook | Vérifie la signature des notifications |
| `FACEBOOK_VERIFY_TOKEN` | Pour le webhook | Chaîne choisie librement, à recopier chez Meta |
| `OPENAI_API_KEY` | Recommandé | Sans elle, classement par règles uniquement |
| `OPENAI_MODEL` | Non | `gpt-4o-mini` par défaut |
| `FACEBOOK_SYNC_INTERVAL_MINUTES` | Non | Rattrapage, 60 par défaut, minimum 15 |

Sans `FACEBOOK_PAGE_TOKEN`, l'intégration se met simplement en veille et
journalise `Intégration Facebook inactive` au démarrage. Le site fonctionne
normalement.

## Obtenir les identifiants

Vous devez être **administrateur de la page** Facebook.

1. **Créer l'application** — sur [developers.facebook.com](https://developers.facebook.com/apps),
   *Créer une application* → type **Entreprise**.
   Relevez l'**identifiant** et la **clé secrète** dans *Paramètres → Général*
   (la clé secrète va dans `FACEBOOK_APP_SECRET`).

2. **Obtenir le jeton de page** — dans l'*Explorateur de l'API Graph* :
   sélectionnez votre application, puis *Générer un jeton d'accès*, en
   accordant `pages_show_list` et `pages_read_engagement`.
   Choisissez ensuite la page 2IAE dans la liste déroulante : le jeton affiché
   est un jeton **de page**. Son identifiant numérique est votre
   `FACEBOOK_PAGE_ID`.

   > Ces deux permissions **ne nécessitent pas de revue par Meta** tant que vous
   > lisez une page dont vous êtes administrateur. Aucun délai d'approbation.

3. **Le rendre permanent** — un jeton issu de l'explorateur expire en une à deux
   heures. Deux options :
   - *Simple* : échangez-le contre un jeton longue durée (environ 60 jours) via
     l'*Outil de débogage des jetons* → *Étendre le jeton d'accès*. À renouveler.
   - *Durable* : créez un **utilisateur système** dans le Business Manager
     (*Paramètres d'entreprise → Utilisateurs système*), affectez-lui la page,
     et générez un jeton avec les mêmes permissions. Ce jeton **n'expire pas**.
     C'est l'option à retenir pour la production.

4. **Le webhook** *(facultatif — sans lui, le rattrapage horaire suffit)* —
   dans l'application, *Webhooks* → *Page* :
   - URL de rappel : `https://VOTRE-DOMAINE/api/webhooks/facebook`
   - Jeton de vérification : la valeur que vous mettrez dans `FACEBOOK_VERIFY_TOKEN`
   - Abonnez-vous au champ **`feed`**, puis abonnez l'application à la page.

## Exploitation

```bash
# Rattrapage manuel (authentification admin requise)
curl -X POST https://VOTRE-DOMAINE/api/admin/facebook/sync \
     -H "Content-Type: application/json" -d '{"limite":25}'

# Journal des publications vues, publiées ou écartées
curl https://VOTRE-DOMAINE/api/admin/facebook/log

# État de la configuration
curl https://VOTRE-DOMAINE/api/admin/facebook/etat
```

La table `facebook_posts` conserve une ligne par publication vue, avec son
statut (`published`, `skipped`, `failed`), le motif et la rubrique retenue.
C'est là qu'on regarde pour comprendre pourquoi une publication n'est pas
apparue sur le site.

Une publication en `failed` est réessayée à la synchronisation suivante ; une
publication `skipped` ne l'est pas.

## Vérifier sans toucher à Facebook

```bash
DATABASE_URL="postgresql://..." npx tsx scripts/test-facebook.ts
```

Ce script injecte des publications représentatives — remise de diplômes,
signature de convention, message d'anniversaire, ouverture des inscriptions,
photo d'ambiance — et contrôle le classement, la mise à la une, la création des
albums, l'absence d'URL Facebook en base et l'idempotence.

## Retirer une publication du site

Une publication reprise est une actualité ordinaire : elle se modifie et se
dépublie depuis l'administration comme les autres. Elle ne sera pas recréée,
son identifiant Facebook restant consigné dans `facebook_posts`.
