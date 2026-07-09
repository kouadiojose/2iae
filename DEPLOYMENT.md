# Déploiement sur DigitalOcean App Platform

> ℹ️ Pour un déploiement sur **Railway**, consultez [RAILWAY.md](./RAILWAY.md).

Ce guide explique comment déployer l'application 2IAE International sur DigitalOcean App Platform.

## Prérequis

1. Compte DigitalOcean avec accès à App Platform
2. Repository GitHub avec le code de l'application
3. Clé API OpenAI

## Configuration du Déploiement

### 1. Préparer le Repository GitHub

```bash
# Ajouter tous les fichiers
git add .

# Commit les changements
git commit -m "Préparation pour déploiement DigitalOcean"

# Pusher vers GitHub
git push origin main
```

### 2. Créer l'Application sur DigitalOcean

1. Connectez-vous à votre Dashboard DigitalOcean
2. Allez dans "App Platform"
3. Cliquez sur "Create App"
4. Choisissez "GitHub" comme source
5. Sélectionnez votre repository
6. Utilisez la configuration automatique ou uploadez le fichier `.do/app.yaml`

### 3. Configuration des Variables d'Environnement

Dans le dashboard DigitalOcean App Platform, ajoutez ces variables :

- `OPENAI_API_KEY` : Votre clé API OpenAI (marquée comme SECRET)
- `NODE_ENV` : `production`

Les variables de base de données (`DATABASE_URL`, `PGHOST`, etc.) seront automatiquement configurées lors de la création de la base de données managée.

### 4. Base de Données

1. Dans la configuration de l'app, ajoutez une base de données PostgreSQL
2. DigitalOcean créera automatiquement une base de données managée
3. Les variables d'environnement seront automatiquement injectées

### 5. Domaine (Optionnel)

Si vous avez un domaine personnalisé :
1. Ajoutez votre domaine dans la section "Domains"
2. Configurez les enregistrements DNS selon les instructions DigitalOcean

## Déploiement Automatique

Une fois configuré, l'application se redéploiera automatiquement à chaque push sur la branche `main`.

## Vérification Post-Déploiement

1. Vérifiez que l'application démarre sans erreur
2. Testez l'API : `https://votre-app.ondigitalocean.app/api/test`
3. Vérifiez la connexion à la base de données
4. Testez le chatbot OpenAI
5. Vérifiez l'interface d'administration

## Commandes Utiles

```bash
# Appliquer les changements de schéma de base de données
npm run db:push

# Vérifier la compilation TypeScript
npm run check

# Build local pour tester
npm run build
npm start
```

## Surveillance

- Consultez les logs dans le dashboard DigitalOcean
- Configurez des alertes pour surveiller les performances
- Utilisez les métriques intégrées pour optimiser les ressources

## Support

En cas de problème, vérifiez :
1. Les logs de l'application dans le dashboard
2. La connectivité de la base de données
3. Les variables d'environnement
4. La configuration des domaines