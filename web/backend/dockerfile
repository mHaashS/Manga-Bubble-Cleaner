# 1. Utilise une image officielle Python 3.10
FROM python:3.10-slim

# 2. Dossier de travail dans le conteneur
WORKDIR /app

# 3. Installe les dépendances système nécessaires à opencv, detectron2, etc.
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    python3-dev \
    libgl1-mesa-glx \
    python3-distutils \
    && rm -rf /var/lib/apt/lists/*

# 4. Copie le fichier requirements.txt
COPY requirements.txt .

# 5. Installe torch, torchvision, torchaudio d'abord (important pour detectron2)
RUN pip install --upgrade pip
RUN pip install torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1

# 6. Installe le reste des dépendances (sauf detectron2)
RUN pip install --no-deps -r requirements.txt

# 7. Installe detectron2 (après torch)
RUN pip install git+https://github.com/facebookresearch/detectron2.git@b15f64ec4429e23a148972175a0207c5a9ab84cf

# 8. Copie tout le code du backend
COPY . .

# 9. Expose le port (doit correspondre à celui utilisé par uvicorn)
EXPOSE 10000

# 10. Commande de démarrage
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]