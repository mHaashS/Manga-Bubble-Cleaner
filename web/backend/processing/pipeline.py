import cv2
import numpy as np
import logging
import traceback
from .clean_bubbles import clean_bubbles, predictor as clean_predictor
from .translate_bubbles import extract_and_translate, predictor as translate_predictor
from .reinsert_translations import draw_translated_text

logger = logging.getLogger(__name__)

def process_image_pipeline(image_bytes: bytes) -> bytes:
    """
    Pipeline complet de traitement d'image pour l'API web
    Prend une image en bytes et retourne l'image traitée en bytes
    """
    try:
        # Convertir les bytes en image OpenCV
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            logger.error("Impossible de décoder l'image")
            return image_bytes
        
        logger.info("Début du pipeline de traitement")
        
        # Étape 1: Détection et nettoyage des bulles
        logger.info("Étape 1: Détection et nettoyage des bulles...")
        outputs = clean_predictor(image)
        cleaned_image = clean_bubbles(image, outputs)
        logger.info("Nettoyage terminé")
        
        # Étape 2: Extraction et traduction du texte
        logger.info("Étape 2: Extraction et traduction du texte...")
        translations = extract_and_translate(image, outputs)
        logger.info(f"Traduction terminée: {len(translations)} bulles traitées")
        
        # Étape 3: Réinsertion du texte traduit
        if translations:
            logger.info("Étape 3: Réinsertion du texte traduit...")
            final_image = draw_translated_text(cleaned_image, translations)
            logger.info("Réinsertion terminée")
        else:
            logger.info("Aucune traduction à réinsérer, utilisation de l'image nettoyée")
            final_image = cleaned_image
        
        # Convertir l'image finale en bytes
        _, buffer = cv2.imencode('.png', final_image)
        result_bytes = buffer.tobytes()
        
        logger.info("Pipeline terminé avec succès")
        return result_bytes
        
    except Exception as e:
        logger.error(f"Erreur dans le pipeline: {e}")
        traceback.print_exc()
        # En cas d'erreur, retourner l'image originale
        return image_bytes 