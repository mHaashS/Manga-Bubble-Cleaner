from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import os
from dotenv import load_dotenv

from database.database import get_db
from crud import crud
from schemas import schemas

load_dotenv()

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

# Cryptage des mots de passe
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Sécurité HTTP
security = HTTPBearer()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    try:
        print(f"🔐 Vérification du token avec SECRET_KEY: {SECRET_KEY[:10]}..." if SECRET_KEY else "SECRET_KEY manquant")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"📦 Payload décodé: {payload}")
        email: str = payload.get("sub")
        if email is None:
            print("❌ Pas d'email dans le payload")
            return None
        return email
    except JWTError as e:
        print(f"❌ Erreur JWT: {e}")
        return None

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Impossible de valider les identifiants",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    print(f"🔍 Token reçu: {token[:20]}..." if token else "Token vide")
    
    email = verify_token(token)
    print(f"📧 Email extrait: {email}")
    
    if email is None:
        print("❌ Token invalide ou expiré")
        raise credentials_exception
    
    user = crud.get_user_by_email(db, email=email)
    print(f"👤 Utilisateur trouvé: {user.email if user else 'Aucun'}")
    
    if user is None:
        print("❌ Utilisateur non trouvé")
        raise credentials_exception
    
    return user

async def get_current_active_user(current_user: schemas.User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Utilisateur inactif")
    return current_user

def authenticate_user(db: Session, email: str, password: str):
    user = crud.get_user_by_email(db, email=email)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user 