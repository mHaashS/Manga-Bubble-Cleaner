import os
import sys
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

def draw_translated_text(image_path, json_path, output_path, font_path="arial.ttf"):
    # Chargement image
    image = cv2.imread(image_path)
    if image is None:
        print(f"❌ Impossible de charger l'image : {image_path}")
        return
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    img_pil = Image.fromarray(image_rgb)
    draw = ImageDraw.Draw(img_pil)

    # Police
    try:
        font = ImageFont.truetype(font_path, size=24)
    except:
        font = ImageFont.load_default()
        print("⚠️ Police 'arial.ttf' non trouvée. Police par défaut utilisée.")

    # Chargement JSON
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for r in data:
        if not all(k in r for k in ["translated_text", "index", "confidence"]):
            continue

        # Vérifie et calcule bounding box si manquante
        if not all(k in r for k in ["x_min", "x_max", "y_min", "y_max"]):
            print(f"⚠️ Bulle {r['index']} n’a pas de coordonnées. Tu dois les ajouter lors de la détection.")
            continue

        text = r["translated_text"]
        x_min, x_max, y_min, y_max = r["x_min"], r["x_max"], r["y_min"], r["y_max"]

        # Ajustement dynamique de la taille de police
        box_width = x_max - x_min
        box_height = y_max - y_min

        font_size = 24
        while True:
            font = ImageFont.truetype(font_path, font_size)
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            if text_width <= box_width * 0.9 and text_height <= box_height * 0.9:
                break
            font_size -= 1
            if font_size < 10:
                break

        # Position du texte centré
        text_x = x_min + (box_width - text_width) // 2
        text_y = y_min + (box_height - text_height) // 2

        draw.text((text_x, text_y), text, font=font, fill=(0, 0, 0))

    # Sauvegarde
    final_img = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
    cv2.imwrite(output_path, final_img)
    print(f"✅ Image enregistrée : {output_path}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage : python reinsert_translations.py chemin/image_clean.png chemin/image.json")
        sys.exit(1)

    image_path = sys.argv[1]
    json_path = sys.argv[2]
    output_path = image_path.replace(".png", "_translated.png")

    draw_translated_text(image_path, json_path, output_path)
