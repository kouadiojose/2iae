#!/bin/bash

# Script de déploiement production pour DigitalOcean App Platform
# 2IAE International Website

echo "🚀 Préparation du déploiement production 2IAE..."

# Vérification des prérequis
echo "📋 Vérification des prérequis..."

if ! command -v doctl &> /dev/null; then
    echo "❌ doctl CLI n'est pas installé"
    echo "Installez-le: https://docs.digitalocean.com/reference/doctl/"
    exit 1
fi

echo "✅ doctl CLI disponible"

# Vérification de l'authentification DigitalOcean
if ! doctl auth list &> /dev/null; then
    echo "❌ Authentification DigitalOcean requise"
    echo "Exécutez: doctl auth init"
    exit 1
fi

echo "✅ Authentification DigitalOcean OK"

# Test de la base PostgreSQL
echo "🗃️  Test de connexion PostgreSQL..."

if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL non définie (normal en développement)"
    echo "Elle sera automatiquement injectée par DigitalOcean"
else
    echo "✅ DATABASE_URL configurée"
    node scripts/test-production.js
fi

# Vérification des secrets
echo "🔐 Vérification des secrets requis..."

REQUIRED_SECRETS=("OPENAI_API_KEY" "SESSION_SECRET")
MISSING_SECRETS=()

for secret in "${REQUIRED_SECRETS[@]}"; do
    if [ -z "${!secret}" ]; then
        MISSING_SECRETS+=($secret)
    fi
done

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
    echo "❌ Secrets manquants:"
    for secret in "${MISSING_SECRETS[@]}"; do
        echo "  - $secret"
    done
    echo ""
    echo "📝 Ajoutez-les dans DigitalOcean App Platform > Settings > Environment Variables"
    exit 1
fi

echo "✅ Tous les secrets sont configurés"

# Build test
echo "🔨 Test de build production..."
npm ci
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Échec du build"
    exit 1
fi

echo "✅ Build réussi"

# Déploiement
echo "🚀 Déploiement vers DigitalOcean App Platform..."

# Mettre à jour l'application via doctl
doctl apps update $(doctl apps list --format ID --no-header) --spec .do/app.yaml

echo ""
echo "🎉 Déploiement lancé !"
echo "📊 Suivez le progrès sur: https://cloud.digitalocean.com/apps"
echo ""
echo "🔗 Une fois déployé, votre site sera disponible sur votre domaine DigitalOcean"