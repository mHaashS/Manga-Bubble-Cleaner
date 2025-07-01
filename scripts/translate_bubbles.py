import os
import sys
import cv2
import torch
import json
import numpy as np
import easyocr
import openai

from detectron2.config import get_cfg
from detectron2.engine import DefaultPredictor
from detectron2 import model_zoo

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
CONFIDENCE_THRESHOLD = 0.75

# === OPENAI (nouvelle API) ===
client = openai.OpenAI(api_key="YOUR_API_KEY_HERE")

def translate(text):
    if not text.strip():
        return ""
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Tu es un traducteur automatique. Ne commente jamais. Donne uniquement la traduction française brute du texte fourni."},
                {"role": "user", "content": f"Traduis ce texte en français : {text}"}
            ]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"[ERREUR DE TRADUCTION: {e}]"

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

        print(f"→ BULLE {i+1}: {class_name}, confidence={score:.2f}")
        print(f"   OCR : {ocr_text}")

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
        print("❌ Aucun résultat à sauvegarder.")
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

    print(f"✅ Traductions enregistrées dans :\n→ {txt_path}\n→ {json_path}")
