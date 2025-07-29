import os
import sys
import json
import cv2
import numpy as np
import logging
from PIL import Image, ImageDraw, ImageFont
import textwrap
from pathlib import Path

# Patch de compatibilité pour Pillow >= 10.0
if not hasattr(Image, "Resampling"):
    # Pour compatibilité Pillow < 10
    Image.Resampling = Image
# Image.LANCZOS est toujours disponible dans Pillow >= 10

# Configuration du logging
logger = logging.getLogger(__name__)

def find_font():
    """Trouve une police disponible sur le système"""
    font_paths = [
        "fonts/animeace2_reg.ttf",  # Regular en premier
        "fonts/animeace2_bld.ttf",  # Bold en second
        "fonts/animeace2_ital.ttf",
        "arial.ttf",
        "Arial.ttf",
        "/System/Library/Fonts/Arial.ttf",  # macOS
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Linux
        "C:/Windows/Fonts/arial.ttf"  # Windows
    ]
    
    for path in font_paths:
        if os.path.exists(path):
            return path
    
    return None

def wrap_text(text, font, max_width):
    """Enveloppe le texte pour qu'il tienne dans la largeur donnée"""
    words = text.split()
    lines = []
    current_line = []
    
    for word in words:
        test_line = ' '.join(current_line + [word])
        bbox = font.getbbox(test_line)
        line_width = bbox[2] - bbox[0]
        
        if line_width <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(' '.join(current_line))
                current_line = [word]
            else:
                # Si un seul mot est trop long, le couper
                lines.append(word)
                current_line = []
    
    if current_line:
        lines.append(' '.join(current_line))
    
    return lines

def draw_text_on_image(image, bubble_data, text):
    """Dessine le texte sur l'image à la position de la bulle"""
    try:
        # Convertir l'image OpenCV en PIL
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        img_pil = Image.fromarray(image_rgb)
        draw = ImageDraw.Draw(img_pil)
        
        # Obtenir les coordonnées de la bulle
        x_min = int(bubble_data.get('x_min', 0))
        y_min = int(bubble_data.get('y_min', 0))
        x_max = int(bubble_data.get('x_max', 0))
        y_max = int(bubble_data.get('y_max', 0))
        
        # Calculer les dimensions de la bulle
        box_width = x_max - x_min
        box_height = y_max - y_min

        # Marges pour éviter que le texte touche les bords
        margin_x = int(box_width * 0.15)  # 15% de marge
        margin_y = int(box_height * 0.15)  # 15% de marge
        available_width = box_width - (2 * margin_x)
        available_height = box_height - (2 * margin_y)
        
        # Charger la police
        font_path = find_font()
        if font_path:
            logger.info(f"OK: Police chargee: {os.path.basename(font_path)}")
        else:
            logger.warning("ATTENTION: Police non trouvee, utilisation de la police par defaut")
        
        # Taille de police par défaut (gérer les deux formats)
        font_size = bubble_data.get('font_size', bubble_data.get('fontSize', 16))
        
        # Charger la police
        try:
            if font_path:
                font = ImageFont.truetype(font_path, font_size)
            else:
                font = ImageFont.load_default()
        except Exception as e:
            logger.error(f"ERREUR: Impossible de charger la police: {e}")
            font = ImageFont.load_default()
        
        # Envelopper le texte
        wrapped_lines = wrap_text(text, font, available_width)
        
        # Calculer la position de départ pour centrer verticalement
        line_height = font.getbbox("Ay")[3]
        total_text_height = len(wrapped_lines) * line_height
        start_y = y_min + margin_y + (available_height - total_text_height) // 2
        
        # Dessiner chaque ligne
        for i, line in enumerate(wrapped_lines):
            # Calculer la largeur de cette ligne pour centrer horizontalement
            bbox = font.getbbox(line)
            line_width = bbox[2] - bbox[0]
            line_x = x_min + margin_x + (available_width - line_width) // 2
            line_y = start_y + (i * line_height)
            
            # Dessiner le texte en noir
            draw.text((line_x, line_y), line, font=font, fill=(0, 0, 0))

        # Convertir de PIL vers OpenCV
        final_img = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
        return final_img
        
    except Exception as e:
        logger.error(f"ERREUR lors du dessin du texte: {e}")
        return image

def draw_translated_text(image, translations):
    """Dessine le texte traduit sur l'image nettoyée"""
    try:
        logger.info(f"OK: {len(translations)} bulles chargees")
        
        # Dessiner chaque texte traduit
        for i, bubble_data in enumerate(translations):
            # Gérer les deux formats possibles (backend et frontend)
            translated_text = bubble_data.get('translated_text', bubble_data.get('translatedText', ''))
            if not translated_text:
                continue
            
            # Obtenir les coordonnées de la bulle
            x_min = int(bubble_data.get('x_min', 0))
            y_min = int(bubble_data.get('y_min', 0))
            x_max = int(bubble_data.get('x_max', 0))
            y_max = int(bubble_data.get('y_max', 0))
            
            # Calculer la taille de police basée sur la taille de la bulle
            bubble_width = x_max - x_min
            bubble_height = y_max - y_min
            font_size = min(bubble_width // 10, bubble_height // 2, 72)  # Limiter à 72pt max
            font_size = max(font_size, 8)  # Minimum 8pt
            
            # Charger la police
            font_path = find_font()
            if font_path:
                logger.info(f"OK: Police chargee: {os.path.basename(font_path)}")
            else:
                logger.warning("ATTENTION: Police non trouvee, utilisation de la police par defaut")
            
            # Dessiner le texte
            image = draw_text_on_image(image, bubble_data, translated_text)
        
        return image
        
    except Exception as e:
        logger.error(f"ERREUR lors de la reinsertion: {e}")
        return image 