#!/bin/bash

# Script post-installation pour Railway
echo "🔧 Installation des dépendances AI..."

# Installer PyTorch
echo "📦 Installation de PyTorch..."
python -m pip install torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1

# Installer Detectron2
echo "🤖 Installation de Detectron2..."
python -m pip install git+https://github.com/facebookresearch/detectron2.git@b15f64ec4429e23a148972175a0207c5a9ab84cf

echo "✅ Installation des dépendances AI terminée" 