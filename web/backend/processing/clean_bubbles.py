import os
import cv2
import torch
import numpy as np
import logging
from detectron2.config import get_cfg
from detectron2.engine import DefaultPredictor
from detectron2 import model_zoo

# Configuration du logging
logger = logging.getLogger(__name__)

# === CONFIGURATION DES CHEMINS ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

cfg = get_cfg()
cfg.merge_from_file(model_zoo.get_config_file("COCO-InstanceSegmentation/mask_rcnn_R_50_FPN_3x.yaml"))
cfg.MODEL.WEIGHTS = os.path.join(PROJECT_DIR, "models", "model_final.pth")
cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = 0.5
cfg.MODEL.ROI_HEADS.NUM_CLASSES = 3  # bubble, floating_text, narration_box
cfg.MODEL.DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

predictor = DefaultPredictor(cfg)

# === PARAMÈTRES DE NETTOYAGE ===
FILL_COLOR = (255, 255, 255)  # Blanc

CLASS_NAMES = {
    0: "bubble",
    1: "floating_text",
    2: "narration_box"
}

def clean_bubbles(image, outputs):
    # Gérer à la fois les outputs de Detectron2 et nos MockOutputs
    if hasattr(outputs, 'instances'):
        # MockOutputs
        instances = outputs.instances
    else:
        # Detectron2 outputs
        instances = outputs["instances"]
    
    masks = instances.pred_masks.to("cpu").numpy()
    classes = instances.pred_classes.to("cpu").numpy()

    result = image.copy()

    for i, mask in enumerate(masks):
        class_id = classes[i]
        class_name = CLASS_NAMES.get(class_id, "unknown")

        mask_uint8 = (mask * 255).astype(np.uint8)

        if class_name in ["bubble", "narration_box"]:
            result[mask > 0] = FILL_COLOR
        elif class_name == "floating_text":
            inpaint_mask = cv2.dilate(mask_uint8, np.ones((5, 5), np.uint8), iterations=1)
            result = cv2.inpaint(result, inpaint_mask, inpaintRadius=3, flags=cv2.INPAINT_TELEA)

    return result 