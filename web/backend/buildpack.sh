#!/bin/bash

# Script de buildpack pour Railway
echo "Installation des dépendances système..."

# Installation des packages système nécessaires
apt-get update
apt-get install -y \
    git \
    build-essential \
    python3-dev \
    libgl1-mesa-glx \
    python3-distutils \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    tesseract-ocr \
    libtesseract-dev

# Nettoyage
apt-get clean
rm -rf /var/lib/apt/lists/*

echo "Dépendances système installées avec succès" 