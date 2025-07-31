import cv2
import numpy as np
import logging
from .clean_bubbles import predictor
from .translate_bubbles import extract_and_translate
import torch

logger = logging.getLogger(__name__)

def simplify_polygon(points, target_points=8):
    """
    Simplifie un polygone en réduisant le nombre de points à target_points
    en utilisant l'algorithme de Douglas-Peucker
    """
    if len(points) <= target_points:
        return points
    
    # Utiliser l'algorithme de Douglas-Peucker pour simplifier
    epsilon = 0.02 * cv2.arcLength(points, True)
    simplified = cv2.approxPolyDP(points, epsilon, True)
    
    # Si on a encore trop de points, on enlève les points les plus proches
    while len(simplified) > target_points:
        # Trouver la paire de points la plus proche
        min_dist = float('inf')
        min_idx = 0
        
        for i in range(len(simplified)):
            p1 = simplified[i][0]
            p2 = simplified[(i + 1) % len(simplified)][0]
            dist = np.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)
            if dist < min_dist:
                min_dist = dist
                min_idx = i
        
        # Supprimer le point avec la plus petite distance
        simplified = np.delete(simplified, min_idx, axis=0)
    
    return simplified

def mask_to_polygon(mask):
    """
    Convertit un masque binaire en polygone simplifié
    """
    # Trouver les contours du masque
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return None
    
    # Prendre le plus grand contour
    largest_contour = max(contours, key=cv2.contourArea)
    
    # Simplifier le polygone à 8 points
    simplified = simplify_polygon(largest_contour, 8)
    
    # Convertir en format liste de points
    points = []
    for point in simplified:
        points.append([int(point[0][0]), int(point[0][1])])
    
    return points

def get_bubble_polygons(image):
    """
    Extrait les masques de bulles et les convertit en polygones simplifiés
    """
    try:
        # Détecter les bulles avec le modèle
        outputs = predictor(image)
        masks = outputs["instances"].pred_masks.to("cpu").numpy()
        classes = outputs["instances"].pred_classes.to("cpu").numpy()
        scores = outputs["instances"].scores.to("cpu").numpy()
        
        polygons = []
        
        for i, (mask, class_id, score) in enumerate(zip(masks, classes, scores)):
            if score < 0.5:  # Seuil de confiance
                continue
            
            # Convertir le masque en polygone
            polygon = mask_to_polygon(mask)
            
            if polygon is not None:
                # Calculer les coordonnées de la bounding box
                y_indices, x_indices = np.where(mask)
                if len(x_indices) > 0 and len(y_indices) > 0:
                    x_min, x_max = int(np.min(x_indices)), int(np.max(x_indices))
                    y_min, y_max = int(np.min(y_indices)), int(np.max(y_indices))
                    
                    polygons.append({
                        "id": i,
                        "class": int(class_id),
                        "confidence": float(score),
                        "polygon": polygon,
                        "bbox": {
                            "x_min": x_min,
                            "x_max": x_max,
                            "y_min": y_min,
                            "y_max": y_max
                        }
                    })
        
        logger.info(f"Extrait {len(polygons)} polygones de bulles")
        return polygons
        
    except Exception as e:
        logger.error(f"Erreur lors de l'extraction des polygones: {e}")
        raise e

def create_mock_outputs(image, custom_polygons):
    """
    Crée un objet outputs simulé à partir de polygones personnalisés
    pour être compatible avec les fonctions existantes
    """
    height, width = image.shape[:2]
    masks = []
    classes = []
    scores = []
    
    for polygon_data in custom_polygons:
        # Créer un masque vide
        mask = np.zeros((height, width), dtype=np.uint8)
        
        # Dessiner le polygone sur le masque
        polygon = np.array(polygon_data["polygon"], dtype=np.int32)
        cv2.fillPoly(mask, [polygon], 255)
        
        masks.append(mask.astype(bool))
        classes.append(polygon_data.get("class", 0))
        scores.append(polygon_data.get("confidence", 1.0))
    
    # Créer un objet outputs simulé compatible avec Detectron2
    class MockInstances:
        def __init__(self, masks, classes, scores):
            self.pred_masks = torch.tensor(masks)
            self.pred_classes = torch.tensor(classes)
            self.scores = torch.tensor(scores)
    
    class MockOutputs:
        def __init__(self, masks, classes, scores):
            self.instances = MockInstances(masks, classes, scores)
    
    return MockOutputs(masks, classes, scores)

def process_with_custom_polygons(image, custom_polygons):
    """
    Traite une image avec des polygones de bulles personnalisés
    au lieu de la détection automatique
    """
    try:
        # Utiliser la fonction create_mock_outputs pour créer l'objet outputs
        outputs = create_mock_outputs(image, custom_polygons)
        
        # Utiliser la fonction existante pour extraire et traduire
        translations = extract_and_translate(image, outputs)
        
        return translations
        
    except Exception as e:
        logger.error(f"Erreur lors du traitement avec polygones personnalisés: {e}")
        raise e 