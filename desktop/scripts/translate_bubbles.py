import os
import sys
import cv2
import torch
import json
import numpy as np
import easyocr
import openai
import logging
from pathlib import Path

# Patch de compatibilité pour Pillow >= 10.0 (utilisé par easyocr)
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

from detectron2.config import get_cfg
from detectron2.engine import DefaultPredictor
from detectron2 import model_zoo

# Configuration du logging
logger = logging.getLogger(__name__)

# === CONFIGURATION DETECTRON2 ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

cfg = get_cfg()
cfg.merge_from_file(model_zoo.get_config_file("COCO-InstanceSegmentation/mask_rcnn_R_50_FPN_3x.yaml"))
cfg.MODEL.WEIGHTS = os.path.join(PROJECT_DIR, "models", "model_final.pth")
cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = 0.5
cfg.MODEL.ROI_HEADS.NUM_CLASSES = 3
cfg.MODEL.DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

predictor = DefaultPredictor(cfg)
reader = easyocr.Reader(['en'], gpu=True)

CLASS_NAMES = {0: "bubble", 1: "floating_text", 2: "narration_box"}
# Import de la configuration hybride
import sys
sys.path.append(str(Path(__file__).parent.parent))
from config import OCR_CONFIG, OPENAI_CONFIG

# Utilise la configuration centralisée
CONFIDENCE_THRESHOLD = OCR_CONFIG["confidence_threshold"]

# === OPENAI (nouvelle API) ===
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY environment variable is required")

# Initialisation du client OpenAI avec gestion d'erreur robuste
def create_openai_client():
    """Crée un client OpenAI avec gestion d'erreur pour compatibilité"""
    try:
        # Essai standard
        return openai.OpenAI(api_key=api_key)
    except TypeError as e:
        if "proxies" in str(e):
            # Fallback 1: sans http_client
            try:
                return openai.OpenAI(api_key=api_key, http_client=None)
            except:
                pass
        # Fallback 2: avec paramètres minimaux
        try:
            return openai.OpenAI(api_key=api_key, base_url="https://api.openai.com/v1")
        except:
            pass
        # Fallback 3: approche alternative
        try:
            import httpx
            return openai.OpenAI(api_key=api_key, http_client=httpx.Client())
        except:
            pass
        # Si rien ne marche, on lève l'erreur originale
        raise e

client = create_openai_client()

def translate(text):
    if not text.strip():
        return ""
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Tu es un traducteur automatique. Ne commente jamais. Donne uniquement la traduction française brute du texte fourni."},
                {"role": "user", "content": f"Traduis ce texte en français : {text}"}
            ],
            max_tokens=150,
            temperature=0.3
        )
        return response.choices[0].message.content.strip()
    except openai.AuthenticationError:
        logger.error("ERREUR: Erreur d'authentification OpenAI. Verifiez votre cle API.")
        return f"[ERREUR: Clé API invalide]"
    except openai.RateLimitError:
        logger.error("ERREUR: Limite de taux depassee. Attendez avant de reessayer.")
        return f"[ERREUR: Limite de taux]"
    except Exception as e:
        logger.error(f"ERREUR: Erreur de traduction: {e}")
        return f"[ERREUR DE TRADUCTION: {str(e)}]"

def clean_ocr(text):
    return text.replace("\n", " ").replace("  ", " ").strip()

def extract_text_easyocr(image):
    results = reader.readtext(image)
    return " ".join([text for _, text, _ in results]).strip()

def extract_and_translate(image, outputs):
    masks = outputs["instances"].pred_masks.to("cpu").numpy()
    classes = outputs["instances"].pred_classes.to("cpu").numpy()
    scores = outputs["instances"].scores.to("cpu").numpy()

    results = []
    for i, (mask, class_id, score) in enumerate(zip(masks, classes, scores)):
        if score < CONFIDENCE_THRESHOLD:
            continue

        class_name = CLASS_NAMES.get(class_id, "unknown")
        y_indices, x_indices = np.where(mask)
        if len(x_indices) == 0 or len(y_indices) == 0:
            continue
        x_min, x_max = np.min(x_indices), np.max(x_indices)
        y_min, y_max = np.min(y_indices), np.max(y_indices)

        roi = image[y_min:y_max, x_min:x_max]
        ocr_text = extract_text_easyocr(roi)
        ocr_text = clean_ocr(ocr_text)

        logger.info(f"-> BULLE {i+1}: {class_name}, confidence={score:.2f}")
        logger.info(f"   OCR : {ocr_text}")

        if ocr_text.strip() == "":
            continue

        translated_text = translate(ocr_text)

        results.append({
            "index": len(results) + 1,
            "class": class_name,
            "confidence": float(score),
            "ocr_text": ocr_text,
            "translated_text": translated_text,
            "x_min": int(x_min),
            "x_max": int(x_max),
            "y_min": int(y_min),
            "y_max": int(y_max)
        })
    return results

def extract_and_translate_with_edited_bulles(image_path, edited_bulles):
    """Extrait et traduit le texte des bulles modifiées"""
    import cv2
    import numpy as np
    
    # Charger l'image
    image = cv2.imread(image_path)
    if image is None:
        logger.error(f"ERREUR: Impossible de charger l'image: {image_path}")
        return []
    
    results = []
    
    for i, bulle in enumerate(edited_bulles):
        try:
            # Extraire les points du polygone
            if "points" not in bulle:
                logger.warning(f"⚠️ Bulle {i+1} n'a pas de points, ignorée")
                continue
                
            points = bulle["points"]
            if not points:
                logger.warning(f"⚠️ Bulle {i+1} a une liste de points vide, ignorée")
                continue
            
            # Convertir les points en coordonnées numpy
            coords = np.array([[int(p["x"]), int(p["y"])] for p in points], dtype=np.int32)
            
            # Calculer les bounding box
            x_coords = [p["x"] for p in points]
            y_coords = [p["y"] for p in points]
            x_min, x_max = int(min(x_coords)), int(max(x_coords))
            y_min, y_max = int(min(y_coords)), int(max(y_coords))
            
            # Créer un masque pour la région d'intérêt
            mask = np.zeros(image.shape[:2], dtype=np.uint8)
            cv2.fillPoly(mask, [coords], 255)
            
            # Extraire la région d'intérêt
            roi = image[y_min:y_max, x_min:x_max]
            if roi.size == 0:
                logger.warning(f"⚠️ Bulle {i+1} a une région d'intérêt vide")
                continue
            
            # Appliquer le masque à la ROI
            roi_mask = mask[y_min:y_max, x_min:x_max]
            roi_masked = cv2.bitwise_and(roi, roi, mask=roi_mask)
            
            # Extraire le texte avec EasyOCR
            ocr_text = extract_text_easyocr(roi_masked)
            ocr_text = clean_ocr(ocr_text)
            
            confidence = bulle.get("confidence", 0.8)  # Valeur par défaut si pas de confidence
            
            logger.info(f"-> BULLE {i+1}: confidence={confidence:.2f}")
            logger.info(f"   OCR : {ocr_text}")
            
            if ocr_text.strip() == "":
                logger.info(f"   ⚠️ Aucun texte détecté dans la bulle {i+1}")
                continue
            
            # Traduire le texte
            translated_text = translate(ocr_text)
            
            results.append({
                "index": len(results) + 1,
                "class": "bubble",
                "confidence": float(confidence),
                "ocr_text": ocr_text,
                "translated_text": translated_text,
                "x_min": int(x_min),
                "x_max": int(x_max),
                "y_min": int(y_min),
                "y_max": int(y_max)
            })
            
        except Exception as e:
            logger.error(f"ERREUR: Erreur lors du traitement de la bulle {i+1}: {e}")
            continue
    
    return results

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage : python translate_bubbles_easyocr.py chemin/image.jpg")
        sys.exit(1)

    image_path = sys.argv[1]
    image = cv2.imread(image_path)
    outputs = predictor(image)
    print(f"✅ {len(outputs['instances'])} bulles détectées")
    results = extract_and_translate(image, outputs)

    print(f"🧾 Nombre de résultats à sauvegarder : {len(results)}")
    if not results:
        print("ERREUR: Aucun resultat a sauvegarder.")
        sys.exit(0)

    output_dir = os.path.join(PROJECT_DIR, "output", "translations")
    os.makedirs(output_dir, exist_ok=True)
    basename = os.path.splitext(os.path.basename(image_path))[0]
    txt_path = os.path.join(output_dir, f"{basename}.txt")
    json_path = os.path.join(output_dir, f"{basename}.json")

    with open(txt_path, "w", encoding="utf-8") as f:
        for r in results:
            f.write(f"[{r['index']}] {r['class']} ({r['confidence']*100:.1f}%)\n")
            f.write(f"Anglais   : {r['ocr_text']}\n")
            f.write(f"Français  : {r['translated_text']}\n\n")

    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(results, jf, ensure_ascii=False, indent=2)

    print(f"OK: Traductions enregistrees dans :\n-> {txt_path}\n-> {json_path}")
