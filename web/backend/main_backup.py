from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from processing.pipeline import process_image_pipeline_with_bubbles
from processing.reinsert_translations import draw_translated_text
from processing.bubble_editor import get_bubble_polygons, process_with_custom_polygons
import base64
import numpy as np
import cv2
import json

app = FastAPI()

# Autoriser le frontend local (à adapter en prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/process")
async def process_image(file: UploadFile = File(...)):
    image_bytes = await file.read()
    result_bytes, bubbles, cleaned_base64 = process_image_pipeline_with_bubbles(image_bytes)
    image_base64 = base64.b64encode(result_bytes).decode('utf-8')
    return JSONResponse(content={
        "image_base64": image_base64,
        "bubbles": bubbles,
        "cleaned_base64": cleaned_base64
    })

@app.post("/get-bubble-polygons")
async def get_bubbles_for_editing(file: UploadFile = File(...)):
    """
    Récupère les masques de bulles et les convertit en polygones simplifiés pour l'édition manuelle
    """
    image_bytes = await file.read()
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        return JSONResponse(content={"error": "Image illisible"}, status_code=400)
    
    try:
        polygons = get_bubble_polygons(image)
        return JSONResponse(content={"polygons": polygons})
    except Exception as e:
        return JSONResponse(content={"error": f"Erreur lors de l'extraction des polygones: {str(e)}"}, status_code=500)

@app.post("/retreat-with-polygons")
async def retreat_with_custom_polygons(
    file: UploadFile = File(...),
    polygons: str = Form(...)
):
    """
    Retraite une image avec des polygones de bulles personnalisés
    """
    image_bytes = await file.read()
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        return JSONResponse(content={"error": "Image illisible"}, status_code=400)
    
    try:
        polygons_list = json.loads(polygons)
        
        # Créer les outputs simulés pour le nettoyage
        from processing.bubble_editor import create_mock_outputs
        mock_outputs = create_mock_outputs(image, polygons_list)
        
        # Extraire et traduire le texte depuis l'image originale
        from processing.translate_bubbles import extract_and_translate
        translations = extract_and_translate(image, mock_outputs)
        
        # Nettoyer l'image avec les polygones personnalisés
        from processing.clean_bubbles import clean_bubbles
        cleaned_image = clean_bubbles(image, mock_outputs)
        
        # Convertir l'image nettoyée en base64 (sans texte)
        _, cleaned_buffer = cv2.imencode('.png', cleaned_image)
        cleaned_base64 = base64.b64encode(cleaned_buffer.tobytes()).decode('utf-8')
        
        # Réinsérer le texte traduit
        if translations:
            final_image = draw_translated_text(cleaned_image, translations)
        else:
            final_image = cleaned_image
        
        # Convertir l'image finale en base64 (avec texte)
        _, final_buffer = cv2.imencode('.png', final_image)
        final_base64 = base64.b64encode(final_buffer.tobytes()).decode('utf-8')
        
        return JSONResponse(content={
            "image_base64": final_base64,
            "cleaned_base64": cleaned_base64,
            "bubbles": translations
        })
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Erreur détaillée: {error_details}")
        return JSONResponse(content={"error": f"Erreur lors du retraitement: {str(e)}"}, status_code=500)

@app.post("/reinsert")
async def reinsert_text(
    file: UploadFile = File(...),
    bubbles: str = Form(...)
):
    """
    Prend une image + une liste de bulles (JSON) et retourne l'image avec le texte réinséré dans chaque bulle.
    """
    image_bytes = await file.read()
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        return JSONResponse(content={"error": "Image illisible"}, status_code=400)
    try:
        bubbles_list = json.loads(bubbles)
    except Exception as e:
        return JSONResponse(content={"error": f"Bubbles JSON invalide: {e}"}, status_code=400)
    # Nettoyage et réinsertion du texte modifié
    final_image = draw_translated_text(image, bubbles_list)
    _, buffer = cv2.imencode('.png', final_image)
    image_base64 = base64.b64encode(buffer.tobytes()).decode('utf-8')
    return JSONResponse(content={"image_base64": image_base64}) 