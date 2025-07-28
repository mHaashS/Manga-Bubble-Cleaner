from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from processing.pipeline import process_image_pipeline

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
    result_bytes = process_image_pipeline(image_bytes)
    return Response(content=result_bytes, media_type="image/png") 