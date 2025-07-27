"""
Configuration centralisée pour le projet Bubble Cleaner
"""

import os
from pathlib import Path

# Chemins du projet
PROJECT_ROOT = Path(__file__).parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
MODELS_DIR = PROJECT_ROOT / "models"
OUTPUT_DIR = PROJECT_ROOT / "output"
DATA_DIR = PROJECT_ROOT / "data"

# Configuration du modèle Detectron2
DETECTRON_CONFIG = {
    "config_file": "COCO-InstanceSegmentation/mask_rcnn_R_50_FPN_3x.yaml",
    "model_weights": str(MODELS_DIR / "model_final.pth"),
    "score_threshold": 0.5,
    "num_classes": 3,
    "device": "cuda" if os.getenv("USE_CUDA", "true").lower() == "true" else "cpu"
}

# Configuration des classes
CLASS_NAMES = {
    0: "bubble",
    1: "floating_text", 
    2: "narration_box"
}

# Configuration OCR
OCR_CONFIG = {
    "languages": ["en"],
    "gpu": True,
    "confidence_threshold": 0.75
}

# Configuration OpenAI
OPENAI_CONFIG = {
    "model": "gpt-3.5-turbo",
    "max_tokens": 150,
    "temperature": 0.3,
    "system_prompt": "Tu es un traducteur automatique. Ne commente jamais. Donne uniquement la traduction française brute du texte fourni."
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

# Configuration des répertoires de sortie
OUTPUT_CONFIG = {
    "cleaned_dir": OUTPUT_DIR / "cleaned",
    "translations_dir": OUTPUT_DIR / "translations", 
    "final_dir": OUTPUT_DIR / "final",
    "logs_dir": OUTPUT_DIR / "logs"
}

# Création automatique des répertoires
for dir_path in OUTPUT_CONFIG.values():
    dir_path.mkdir(parents=True, exist_ok=True) 