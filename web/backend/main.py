from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from processing.pipeline import process_image_pipeline_with_bubbles
from processing.reinsert_translations import draw_translated_text
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