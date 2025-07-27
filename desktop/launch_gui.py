#!/usr/bin/env python3
"""
Lanceur de l'interface graphique Bubble Cleaner
"""

# Patch de compatibilité pour Pillow >= 10.0 (DOIT être au tout début)
import pil_patch

import os
import sys
from pathlib import Path
import tkinter as tk
from tkinter import messagebox

def check_dependencies():
    """Vérifie que toutes les dépendances sont installées"""
    missing_deps = []
    
    try:
        import torch
        print("✅ PyTorch installé")
    except ImportError:
        missing_deps.append("torch")
    
    try:
        import cv2
        print("✅ OpenCV installé")
    except ImportError:
        missing_deps.append("opencv-python")
    
    try:
        import easyocr
        print("✅ EasyOCR installé")
    except ImportError:
        missing_deps.append("easyocr")
    
    try:
        import openai
        print("✅ OpenAI installé")
    except ImportError:
        missing_deps.append("openai")
    
    try:
        from PIL import Image, ImageDraw, ImageFont
        print("✅ Pillow installé")
    except ImportError:
        missing_deps.append("Pillow")
    
    if missing_deps:
        print(f"❌ Dépendances manquantes: {', '.join(missing_deps)}")
        print("💡 Installez-les avec: pip install -r requirements.txt")
        return False
    
    return True

def check_api_key():
    """Vérifie la présence de la clé API OpenAI"""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        # Essayer de charger depuis .env
        env_file = Path(".env")
        if env_file.exists():
            try:
                with open(env_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            os.environ[key.strip()] = value.strip()
                api_key = os.getenv("OPENAI_API_KEY")
            except Exception as e:
                print(f"⚠️ Erreur lors du chargement de .env: {e}")
    
    if not api_key:
        print("⚠️ Clé API OpenAI non trouvée")
        print("💡 Créez un fichier .env avec votre clé API:")
        print("   OPENAI_API_KEY=votre_clé_api")
        return False
    
    print("✅ Clé API OpenAI trouvée")
    return True

def check_models():
    """Vérifie la présence des modèles nécessaires"""
    models_dir = Path("models")
    if not models_dir.exists():
        print("⚠️ Dossier 'models' non trouvé")
        print("💡 Assurez-vous que les modèles sont téléchargés")
        return False
    
    # Vérifier la présence d'au moins un fichier de modèle
    model_files = list(models_dir.glob("*.pth")) + list(models_dir.glob("*.pkl"))
    if not model_files:
        print("⚠️ Aucun fichier de modèle trouvé dans le dossier 'models'")
        print("💡 Téléchargez les modèles nécessaires")
        return False
    
    print("✅ Modèles trouvés")
    return True

def main():
    """Fonction principale"""
    print("🎨 Bubble Cleaner - Lancement de l'interface graphique")
    print("=" * 50)
    
    # Vérifications préliminaires
    if not check_dependencies():
        print("\n❌ Impossible de lancer l'application")
        return
    
    if not check_api_key():
        print("\n⚠️ L'application peut être lancée mais la traduction ne fonctionnera pas")
    
    if not check_models():
        print("\n⚠️ L'application peut être lancée mais la détection ne fonctionnera pas")
    
    print("\n🚀 Lancement de l'interface graphique...")
    
    try:
        # Importer et lancer l'application GUI
        from gui_app import main as gui_main
        gui_main()
    except ImportError as e:
        print(f"❌ Erreur d'import: {e}")
        print("💡 Assurez-vous que gui_app.py est présent dans le répertoire")
    except Exception as e:
        print(f"❌ Erreur lors du lancement: {e}")

if __name__ == "__main__":
    main() 