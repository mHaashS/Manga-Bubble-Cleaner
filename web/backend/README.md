# Backend Bubble Cleaner Web

## Installation

### 1. Créer un environnement virtuel
```bash
python -m venv venv
venv\Scripts\activate  # Windows
# ou
source venv/bin/activate  # Linux/Mac
```

### 2. Installer les dépendances
```bash
pip install -r requirements.txt
```

### 3. Configuration

#### Variables d'environnement requises :
- `OPENAI_API_KEY` : Votre clé API OpenAI pour la traduction

#### Fichiers requis :
- `models/model_final.pth` : Modèle Detectron2 pour la détection de bulles
- `fonts/` : Polices pour la réinsertion de texte

## Lancement

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### POST /process
Traite une image de manga et retourne l'image avec les bulles nettoyées et le texte traduit.

**Paramètres :**
- `file` : Fichier image (multipart/form-data)

**Réponse :**
- Image PNG traitée

## Pipeline de traitement

1. **Détection des bulles** : Utilise Detectron2 pour détecter les bulles de texte
2. **Nettoyage** : Supprime le texte original des bulles
3. **OCR** : Extrait le texte avec EasyOCR
4. **Traduction** : Traduit le texte avec OpenAI GPT-3.5
5. **Réinsertion** : Dessine le texte traduit dans les bulles

## Structure du projet

```
web/backend/
├── main.py                 # Application FastAPI
├── requirements.txt        # Dépendances Python
├── processing/            # Modules de traitement
│   ├── clean_bubbles.py   # Détection et nettoyage
│   ├── translate_bubbles.py # OCR et traduction
│   ├── reinsert_translations.py # Réinsertion de texte
│   └── pipeline.py        # Orchestration du pipeline
├── models/                # Modèles ML
│   └── model_final.pth    # Modèle Detectron2
└── fonts/                 # Polices
    ├── animeace2_bld.ttf
    ├── animeace2_reg.ttf
    └── animeace2_ital.ttf
``` 