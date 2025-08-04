#!/bin/bash

# Script de démarrage pour Railway
echo "🚀 Démarrage de l'application Bubble Cleaner..."

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
python -c "import detectron2; print(f'✅ Detectron2 v{detectron2.__version__} installé')" || {
    echo "⚠️  Installation de Detectron2..."
    pip install git+https://github.com/facebookresearch/detectron2.git@b15f64ec4429e23a148972175a0207c5a9ab84cf
}

# Démarrer l'application
echo "🎯 Démarrage de l'API..."
exec uvicorn main:app --host 0.0.0.0 --port $PORT 