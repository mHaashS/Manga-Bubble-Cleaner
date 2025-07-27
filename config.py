"""
Configuration centralisée pour le projet Bubble Cleaner
"""

import os
from pathlib import Path

# Configuration technique avec valeurs par défaut
# Variables d'environnement optionnelles pour surcharger

# Chemins du projet
PROJECT_ROOT = Path(__file__).parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
MODELS_DIR = PROJECT_ROOT / "models"
OUTPUT_DIR = PROJECT_ROOT / os.getenv("OUTPUT_DIR", "output")
DATA_DIR = PROJECT_ROOT / "data"

# Configuration du modèle Detectron2
DETECTRON_CONFIG = {
    "config_file": "COCO-InstanceSegmentation/mask_rcnn_R_50_FPN_3x.yaml",
    "model_weights": str(MODELS_DIR / "model_final.pth"),
    "score_threshold": float(os.getenv("MODEL_CONFIDENCE_THRESHOLD", "0.75")),
    "device": "cuda" if os.getenv("USE_CUDA", "true").lower() == "true" else "cpu"
}

# Configuration OCR
OCR_CONFIG = {
    "languages": ["en"],
    "gpu": os.getenv("USE_CUDA", "true").lower() == "true",
    "confidence_threshold": float(os.getenv("OCR_CONFIDENCE_THRESHOLD", "0.75"))
}

# Configuration OpenAI (clé API depuis .env)
OPENAI_CONFIG = {
    "api_key": os.getenv("OPENAI_API_KEY", ""),  # Secret obligatoire
    "model": os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
    "max_tokens": int(os.getenv("OPENAI_MAX_TOKENS", "1000")),
    "temperature": float(os.getenv("OPENAI_TEMPERATURE", "0.3"))
}

# Configuration du nettoyage
CLEANING_CONFIG = {
    "fill_color": (255, 255, 255),  # Blanc
    "inpaint_radius": 3,
    "dilation_kernel": (5, 5),
    "dilation_iterations": 1
}

# Configuration de la réinsertion de texte
TEXT_INSERTION_CONFIG = {
    "default_font_size": 24,
    "min_font_size": 10,
    "text_color": (0, 0, 0),  # Noir
    "margin_ratio": 0.9,  # 90% de la zone disponible
    "font_paths": [
        "arial.ttf",
        "Arial.ttf", 
        "/System/Library/Fonts/Arial.ttf",  # macOS
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Linux
        "C:/Windows/Fonts/arial.ttf"  # Windows
    ]
}

# Configuration des polices
FONT_CONFIG = {
    "anime_fonts": [
        "fonts/animeace2_bld.ttf",
        "fonts/animeace2_reg.ttf", 
        "fonts/animeace2_ital.ttf"
    ],
    "fallback_fonts": [
        "fonts/animeace.ttf",
        "fonts/animeace2.ttf"
    ]
}

# Configuration des couleurs
COLOR_CONFIG = {
    "bubble_color": (255, 255, 255),  # Blanc
    "text_color": (0, 0, 0),          # Noir
    "highlight_color": (255, 255, 0)   # Jaune
}

# Configuration des répertoires de sortie
OUTPUT_CONFIG = {
    "cleaned_dir": OUTPUT_DIR / "cleaned",
    "translated_dir": OUTPUT_DIR / "translated",
    "final_dir": OUTPUT_DIR / "final"
}

# Création automatique des répertoires
for dir_path in OUTPUT_CONFIG.values():
    dir_path.mkdir(parents=True, exist_ok=True) 