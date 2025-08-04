#!/bin/bash
# Script de téléchargement du modèle AI

echo "📥 Téléchargement du modèle AI..."

# Créer le dossier models_ai s'il n'existe pas
mkdir -p models_ai

# URL du modèle Google Drive (format direct download)
MODEL_URL="https://drive.google.com/uc?export=download&id=1o39PdWVxOrUzMbW6LsB8G4tz1maMH5Ib"
MODEL_PATH="models_ai/model_final.pth"

# Télécharger le modèle
if curl -L -o "$MODEL_PATH" "$MODEL_URL"; then
    echo "✅ Modèle téléchargé avec succès: $MODEL_PATH"
    ls -la "$MODEL_PATH"
else
    echo "⚠️  Échec du téléchargement, utilisation du modèle par défaut"
    # Supprimer le fichier corrompu s'il existe
    rm -f "$MODEL_PATH"
fi 