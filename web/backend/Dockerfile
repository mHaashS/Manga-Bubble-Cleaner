# Dockerfile optimisé pour Railway
FROM python:3.10-slim

# Variables d'environnement pour optimiser le build
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# Dossier de travail
WORKDIR /app

# Installation des dépendances système
RUN apt-get update && apt-get install -y \
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
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Mise à jour de pip
RUN pip install --upgrade pip

# Copie des requirements
COPY requirements-essential.txt requirements.txt

# Installation des dépendances avec optimisations
RUN pip install --no-cache-dir torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 \
    && pip install --no-cache-dir --no-deps -r requirements.txt \
    && pip install --no-cache-dir git+https://github.com/facebookresearch/detectron2.git@b15f64ec4429e23a148972175a0207c5a9ab84cf

# Copie du code
COPY . .

# Exposition du port
EXPOSE 8000

# Script de démarrage corrigé
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]