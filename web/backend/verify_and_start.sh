#!/bin/bash

# Script de vérification et démarrage pour Railway
echo "🔍 Vérification des dépendances..."

# Vérifier que Python est disponible
if ! command -v python &> /dev/null; then
    echo "❌ Python n'est pas installé"
    exit 1
fi

# Vérifier que uvicorn est installé
if ! python -c "import uvicorn" &> /dev/null; then
    echo "⚠️  Installation de uvicorn..."
    pip install uvicorn==0.24.0
fi

# Vérifier que fastapi est installé
if ! python -c "import fastapi" &> /dev/null; then
    echo "⚠️  Installation de fastapi..."
    pip install fastapi==0.104.1
fi

# Vérifier que les dépendances système sont installées
if [ ! -f "/usr/bin/tesseract" ]; then
    echo "⚠️  Installation des dépendances système..."
    chmod +x buildpack.sh
    ./buildpack.sh
fi

# Vérifier que PyTorch est installé
python -c "import torch; print(f'✅ PyTorch v{torch.__version__} installé')" || {
    echo "⚠️  Installation de PyTorch..."
    pip install torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1
}

# Vérifier que Detectron2 est installé
python -c "import detectron2; print(f'✅ Detectron2 installé')" || {
    echo "⚠️  Installation de Detectron2..."
    pip install git+https://github.com/facebookresearch/detectron2.git@b15f64ec4429e23a148972175a0207c5a9ab84cf
}

# Test final des dépendances
echo "🧪 Test final des dépendances..."
python test_deploy.py

# Démarrer l'application
echo "🎯 Démarrage de l'API..."
exec python -m uvicorn main:app --host 0.0.0.0 --port $PORT 