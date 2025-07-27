#!/usr/bin/env python3
"""
Pipeline principal pour le traitement des bulles de manga
Orchestre la détection, nettoyage, traduction et réinsertion
"""

import os
import sys
import argparse
import logging
from pathlib import Path

# Patch de compatibilité pour Pillow >= 10.0
try:
    from PIL import Image
    if not hasattr(Image, "Resampling"):
        # Pour compatibilité Pillow < 10
        Image.Resampling = Image
    if not hasattr(Image, "LANCZOS"):
        # Remplacer ANTIALIAS par LANCZOS si nécessaire
        Image.LANCZOS = Image.ANTIALIAS if hasattr(Image, "ANTIALIAS") else Image.Resampling.LANCZOS
except ImportError:
    pass

# Configuration du logging (seulement si pas déjà configuré)
if not logging.getLogger().handlers:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('pipeline.log'),
            logging.StreamHandler()
        ]
    )
logger = logging.getLogger(__name__)

def run_pipeline(image_path, output_dir="output", clean_only=False, translate_only=False, verbose=False):
    """
    Exécute le pipeline complet de traitement des bulles
    
    Args:
        image_path (str): Chemin vers l'image à traiter
        output_dir (str): Répertoire de sortie
        clean_only (bool): Nettoyer seulement (pas de traduction)
        translate_only (bool): Traduire seulement (pas de nettoyage)
    """
    image_path = Path(image_path)
    output_dir = Path(output_dir)
    
    if not image_path.exists():
        logger.error(f"Image non trouvée: {image_path}")
        return False
    
    # Création des répertoires de sortie selon le type d'opération
    if clean_only:
        # Nettoyage seulement : un seul dossier
        cleaned_dir = output_dir
        cleaned_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Dossier de sortie cree: {cleaned_dir}")
    elif translate_only:
        # Traduction seulement : dossiers pour traductions
        translations_dir = output_dir / "translations"
        translations_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"📁 Dossier de traductions créé: {translations_dir}")
    else:
        # Pipeline complet : tous les dossiers
        cleaned_dir = output_dir / "cleaned"
        translations_dir = output_dir / "translations"
        final_dir = output_dir / "final"
        
        for dir_path in [cleaned_dir, translations_dir, final_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"DOSSIERS: Dossiers de sortie crees: {output_dir}")
    
    try:
        # Étape 1: Nettoyage des bulles
        if not translate_only:
            logger.info("Etape 1: Nettoyage des bulles...")
            
            if clean_only:
                # Nettoyage seulement : sauvegarder directement dans le dossier principal
                cleaned_path = cleaned_dir / f"cleaned_{image_path.name}"
            else:
                # Pipeline complet : sauvegarder dans le sous-dossier cleaned
                cleaned_path = cleaned_dir / f"cleaned_{image_path.name}"
            
            # Import et exécution du nettoyage
            from clean_bubbles import clean_bubbles, predictor
            import cv2
            
            image = cv2.imread(str(image_path))
            outputs = predictor(image)
            cleaned_image = clean_bubbles(image, outputs)
            cv2.imwrite(str(cleaned_path), cleaned_image)
            logger.info(f"Image nettoyee: {cleaned_path}")
        
        # Étape 2: Extraction et traduction
        if not clean_only:
            logger.info("Etape 2: Extraction et traduction du texte...")
            basename = image_path.stem
            
            # Import et exécution de la traduction
            from translate_bubbles import extract_and_translate, predictor
            import cv2
            import json
            
            image = cv2.imread(str(image_path))
            outputs = predictor(image)
            results = extract_and_translate(image, outputs)
            
            # Sauvegarde des résultats
            txt_path = translations_dir / f"{basename}.txt"
            json_path = translations_dir / f"{basename}.json"
            
            with open(txt_path, "w", encoding="utf-8") as f:
                for r in results:
                    f.write(f"[{r['index']}] {r['class']} ({r['confidence']*100:.1f}%)\n")
                    f.write(f"Anglais   : {r['ocr_text']}\n")
                    f.write(f"Français  : {r['translated_text']}\n\n")
            
            with open(json_path, "w", encoding="utf-8") as jf:
                json.dump(results, jf, ensure_ascii=False, indent=2)
            
            logger.info(f"OK: Traductions sauvegardees: {txt_path}, {json_path}")
            
            # Étape 3: Réinsertion du texte traduit (seulement pour le pipeline complet)
            if not clean_only and not translate_only and results:
                logger.info("Etape 3: Reinsertion du texte traduit...")
                from reinsert_translations import draw_translated_text
                
                final_path = final_dir / f"{basename}_translated.png"
                draw_translated_text(str(cleaned_path), str(json_path), str(final_path))
                logger.info(f"Image finale: {final_path}")
        
        logger.info("Pipeline termine avec succes!")
        return True
        
    except Exception as e:
        logger.error(f"ERREUR: Erreur dans le pipeline: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Pipeline de traitement des bulles de manga")
    parser.add_argument("image_path", help="Chemin vers l'image à traiter")
    parser.add_argument("--output-dir", default="output", help="Répertoire de sortie")
    parser.add_argument("--clean-only", action="store_true", help="Nettoyer seulement")
    parser.add_argument("--translate-only", action="store_true", help="Traduire seulement")
    parser.add_argument("--verbose", "-v", action="store_true", help="Mode verbeux")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    success = run_pipeline(
        args.image_path,
        args.output_dir,
        args.clean_only,
        args.translate_only
    )
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main() 