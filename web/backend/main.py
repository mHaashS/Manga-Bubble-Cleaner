from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException, status

from fastapi.responses import JSONResponse

from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.orm import Session

from datetime import datetime, timedelta

import time

import os



from processing.pipeline import process_image_pipeline_with_bubbles

from processing.reinsert_translations import draw_translated_text

from processing.bubble_editor import get_bubble_polygons, process_with_custom_polygons



# Import des modules de base de données

from database.database import get_db, engine

from models import models

from schemas import schemas

from crud import crud

from auth.auth import get_current_active_user, create_access_token, get_password_hash, verify_password



# Import du service d'email

from services.email_service import send_password_reset_email, send_welcome_email



import base64

import numpy as np

import cv2

import json



# Créer les tables

models.Base.metadata.create_all(bind=engine)



app = FastAPI(title="Bubble Cleaner API", version="1.0.0")



# Autoriser le frontend local (à adapter en prod)



origins = ["http://localhost:3000",

        "https://www.bubblehack.fr"]



app.add_middleware(

    CORSMiddleware,

    allow_origins=origins,

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)



# ==================== ROUTES D'AUTHENTIFICATION ====================



@app.get("/")
async def root():
    """Route racine de l'API"""
    return {
        "message": "Bubble Cleaner API",
        "version": "1.0.0",
        "status": "running"
    }

@app.post("/register", response_model=schemas.User)

async def register(user: schemas.UserCreate, db: Session = Depends(get_db)):

    """Inscription d'un nouvel utilisateur"""

    # Vérifier si l'email existe déjà

    db_user = crud.get_user_by_email(db, email=user.email)

    if db_user:

        raise HTTPException(status_code=400, detail="Email déjà enregistré")

    

    # Vérifier si le username existe déjà

    db_user = crud.get_user_by_username(db, username=user.username)

    if db_user:

        raise HTTPException(status_code=400, detail="Nom d'utilisateur déjà pris")

    

    # Créer l'utilisateur

    hashed_password = get_password_hash(user.password)

    db_user = crud.create_user(db, user.email, user.username, hashed_password)

    

    # Envoyer un email de bienvenue (en arrière-plan, sans bloquer la réponse)

    try:

        await send_welcome_email(email=db_user.email, username=db_user.username)

    except Exception as e:

        print(f"Erreur lors de l'envoi de l'email de bienvenue: {e}")

        # On ne fait pas échouer l'inscription si l'email échoue

    

    return db_user



@app.post("/login", response_model=schemas.Token)

async def login(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):

    """Connexion d'un utilisateur"""

    user = crud.authenticate_user(db, user_credentials.email, user_credentials.password, verify_password)

    if not user:

        raise HTTPException(

            status_code=status.HTTP_401_UNAUTHORIZED,

            detail="Email ou mot de passe incorrect",

            headers={"WWW-Authenticate": "Bearer"},

        )

    

    # Créer le token d'accès

    access_token = create_access_token(data={"sub": user.email})

    return {"access_token": access_token, "token_type": "bearer"}



@app.get("/profile", response_model=schemas.UserProfile)

async def get_user_profile(current_user: schemas.User = Depends(get_current_active_user), db: Session = Depends(get_db)):

    """Récupérer le profil de l'utilisateur connecté"""

    usage_stats = crud.get_user_usage_stats(db, current_user.id)

    quotas = crud.get_user_quotas(db, current_user.id)

    

    return {

        "user": current_user,

        "usage_stats": usage_stats,

        "quotas": quotas

    }



@app.get("/quotas")

async def get_user_quotas(current_user: schemas.User = Depends(get_current_active_user), db: Session = Depends(get_db)):

    """Récupérer les quotas de l'utilisateur"""

    quota_status = crud.check_user_quotas(db, current_user.id)

    

    return {

        **quota_status,

        "retreatment_limit": 2,

        "retreatment_info": "Limite de 2 retraitements par image"

    }



# ==================== ROUTES DE TRAITEMENT D'IMAGES (AVEC AUTHENTIFICATION) ====================



@app.post("/process")
async def process_image(
    file: UploadFile = File(...),
    current_user: schemas.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Traiter une image avec authentification et vérification des quotas"""
    start_time = time.time()
    
    print(f"🖼️  Début du traitement pour l'utilisateur: {current_user.email}")
    print(f"📁 Fichier reçu: {file.filename}, taille: {file.size} bytes")
    
    # Vérifier et incrémenter les quotas
    quota_status = crud.check_and_increment_quotas(db, current_user.id)
    if not quota_status["can_process"]:
        raise HTTPException(status_code=429, detail=quota_status["message"])
    
    # Traitement de l'image
    image_bytes = await file.read()
    print(f"📊 Image lue: {len(image_bytes)} bytes")
    
    try:
        result_bytes, bubbles, cleaned_base64 = process_image_pipeline_with_bubbles(image_bytes)
        print(f"✅ Traitement terminé: {len(result_bytes)} bytes, {len(bubbles)} bulles détectées")
        
        image_base64 = base64.b64encode(result_bytes).decode('utf-8')
        
        # Mettre à jour les statistiques
        processing_time = time.time() - start_time
        crud.update_usage_stats(db, current_user.id, 1, processing_time)
        
        return JSONResponse(content={
            "image_base64": image_base64,
            "bubbles": bubbles,
            "cleaned_base64": cleaned_base64,
            "quota_status": quota_status
        })
    except Exception as e:
        print(f"❌ Erreur lors du traitement: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur lors du traitement: {str(e)}")



@app.post("/get-bubble-polygons")

async def get_bubbles_for_editing(

    file: UploadFile = File(...),

    current_user: schemas.User = Depends(get_current_active_user)

):

    """Récupère les masques de bulles et les convertit en polygones simplifiés pour l'édition manuelle"""

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

    polygons: str = Form(...),

    current_user: schemas.User = Depends(get_current_active_user),

    db: Session = Depends(get_db)

):

    """Retraite une image avec des polygones de bulles personnalisés"""

    start_time = time.time()

    

    # Vérifier les quotas sans incrémentation (retraitement)

    quota_status = crud.check_quotas_for_retreatment(db, current_user.id)

    if not quota_status["can_process"]:

        raise HTTPException(status_code=429, detail=quota_status["message"])

    

    # Lire l'image et calculer son hash

    image_bytes = await file.read()

    import hashlib

    image_hash = hashlib.md5(image_bytes).hexdigest()

    

    # Vérifier la limite de retraitements pour cette image spécifique

    if not crud.check_image_retreatment_limit(db, current_user.id, image_hash, max_retreatments=2):

        retreatment_count = crud.get_image_retreatment_count(db, current_user.id, image_hash)

        raise HTTPException(

            status_code=429, 

            detail=f"Limite de retraitements atteinte pour cette image ({retreatment_count}/2). Vous ne pouvez plus retraiter cette image."

        )

    

    # Utiliser les bytes déjà lus

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

        

        # Mettre à jour les statistiques

        processing_time = time.time() - start_time

        crud.update_usage_stats(db, current_user.id, 1, processing_time)

        

        # Incrémenter le compteur de retraitements pour cette image spécifique

        crud.increment_image_retreatment(db, current_user.id, image_hash)

        

        return JSONResponse(content={

            "image_base64": final_base64,

            "cleaned_base64": cleaned_base64,

            "bubbles": translations,

            "quota_status": quota_status

        })

        

    except Exception as e:

        import traceback

        error_details = traceback.format_exc()

        print(f"Erreur détaillée: {error_details}")

        return JSONResponse(content={"error": f"Erreur lors du retraitement: {str(e)}"}, status_code=500)



@app.post("/reinsert")

async def reinsert_text(

    file: UploadFile = File(...),

    bubbles: str = Form(...),

    current_user: schemas.User = Depends(get_current_active_user)

):

    """Prend une image + une liste de bulles (JSON) et retourne l'image avec le texte réinséré dans chaque bulle."""

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



# ==================== ROUTE DE SANTÉ ====================



@app.get("/health")
async def health_check():
    """Vérification de la santé de l'API"""
    # Vérifier l'installation de Detectron2
    try:
        import detectron2
        detectron_status = f"✅ Detectron2 v{detectron2.__version__}"
    except ImportError:
        detectron_status = "❌ Detectron2 non installé"
    
    return {
        "status": "healthy", 
        "message": "Bubble Cleaner API is running",
        "detectron2": detectron_status
    }



# ==================== ROUTES DE GESTION DES UTILISATEURS ====================



@app.post("/forgot-password")

async def forgot_password(request: schemas.ForgotPassword, db: Session = Depends(get_db)):

    """Demande de récupération de mot de passe"""

    user = crud.get_user_by_email(db, email=request.email)

    if not user:

        # Pour des raisons de sécurité, on ne révèle pas si l'email existe

        return {"message": "Si cet email existe, un lien de récupération a été envoyé"}

    

    # Générer un token de récupération

    import secrets

    token = secrets.token_urlsafe(32)

    expires_at = datetime.utcnow() + timedelta(hours=24)  # Expire dans 24h

    

    # Créer le token en base

    crud.create_password_reset_token(db, user.id, token, expires_at)

    

    # Construire l'URL de récupération

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

    reset_url = f"{frontend_url}/reset-password?token={token}"

    

    # Envoyer l'email de récupération

    email_sent = await send_password_reset_email(

        email=user.email,

        username=user.username,

        reset_token=token,

        reset_url=reset_url

    )

    

    if email_sent:

        return {"message": "Email de récupération envoyé. Vérifiez votre boîte mail."}

    else:

        # En cas d'échec d'envoi, on peut retourner le lien directement (pour le développement)

        if os.getenv("ENVIRONMENT") == "development":

            return {

                "message": "Erreur lors de l'envoi de l'email. Lien de récupération (développement uniquement):",

                "reset_url": reset_url

            }

        else:

            raise HTTPException(status_code=500, detail="Erreur lors de l'envoi de l'email")



@app.post("/reset-password")

async def reset_password(request: schemas.ResetPassword, db: Session = Depends(get_db)):

    """Réinitialisation du mot de passe avec un token"""

    # Vérifier le token

    reset_token = crud.get_password_reset_token(db, request.token)

    if not reset_token:

        raise HTTPException(status_code=400, detail="Token invalide ou expiré")

    

    # Hasher le nouveau mot de passe

    new_hashed_password = get_password_hash(request.new_password)

    

    # Mettre à jour le mot de passe

    user = crud.update_user_password(db, reset_token.user_id, new_hashed_password)

    if not user:

        raise HTTPException(status_code=400, detail="Erreur lors de la mise à jour")

    

    # Marquer le token comme utilisé

    crud.mark_password_reset_token_used(db, request.token)

    

    # Désactiver toutes les sessions de l'utilisateur

    crud.deactivate_all_user_sessions(db, user.id)

    

    return {"message": "Mot de passe mis à jour avec succès"}



@app.post("/change-password")

async def change_password(

    request: schemas.PasswordChange,

    current_user: schemas.User = Depends(get_current_active_user),

    db: Session = Depends(get_db)

):

    """Changement de mot de passe (utilisateur connecté)"""

    # Vérifier l'ancien mot de passe

    if not verify_password(request.current_password, current_user.hashed_password):

        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")

    

    # Hasher le nouveau mot de passe

    new_hashed_password = get_password_hash(request.new_password)

    

    # Mettre à jour le mot de passe

    user = crud.update_user_password(db, current_user.id, new_hashed_password)

    if not user:

        raise HTTPException(status_code=400, detail="Erreur lors de la mise à jour")

    

    # Désactiver toutes les sessions de l'utilisateur

    crud.deactivate_all_user_sessions(db, current_user.id)

    

    return {"message": "Mot de passe mis à jour avec succès"}



@app.post("/change-username")

async def change_username(

    request: schemas.UsernameChange,

    current_user: schemas.User = Depends(get_current_active_user),

    db: Session = Depends(get_db)

):

    """Changement de nom d'utilisateur"""

    # Vérifier le mot de passe

    if not verify_password(request.password, current_user.hashed_password):

        raise HTTPException(status_code=400, detail="Mot de passe incorrect")

    

    # Vérifier si le nouveau username existe déjà

    existing_user = crud.get_user_by_username(db, request.new_username)

    if existing_user and existing_user.id != current_user.id:

        raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est déjà pris")

    

    # Mettre à jour le username

    user = crud.update_user_username(db, current_user.id, request.new_username)

    if not user:

        raise HTTPException(status_code=400, detail="Erreur lors de la mise à jour")

    

    return {"message": "Nom d'utilisateur mis à jour avec succès", "new_username": request.new_username}



@app.post("/change-email")

async def change_email(

    request: schemas.EmailChange,

    current_user: schemas.User = Depends(get_current_active_user),

    db: Session = Depends(get_db)

):

    """Changement d'email"""

    # Vérifier le mot de passe

    if not verify_password(request.password, current_user.hashed_password):

        raise HTTPException(status_code=400, detail="Mot de passe incorrect")

    

    # Vérifier si le nouveau email existe déjà

    existing_user = crud.get_user_by_email(db, request.new_email)

    if existing_user and existing_user.id != current_user.id:

        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    

    # Mettre à jour l'email

    user = crud.update_user_email(db, current_user.id, request.new_email)

    if not user:

        raise HTTPException(status_code=400, detail="Erreur lors de la mise à jour")

    

    return {"message": "Email mis à jour avec succès", "new_email": request.new_email}



@app.delete("/logout")

async def logout(current_user: schemas.User = Depends(get_current_active_user), db: Session = Depends(get_db)):

    """Déconnexion de l'utilisateur"""

    # Désactiver toutes les sessions de l'utilisateur

    crud.deactivate_all_user_sessions(db, current_user.id)

    return {"message": "Déconnexion réussie"} 