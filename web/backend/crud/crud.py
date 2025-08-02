from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from models import models
from datetime import datetime, timedelta
import secrets

# Opérations utilisateur
def create_user(db: Session, email: str, username: str, hashed_password: str):
    db_user = models.User(
        email=email,
        username=username,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def authenticate_user(db: Session, email: str, password: str, verify_password_func):
    user = get_user_by_email(db, email)
    if not user or not verify_password_func(password, user.hashed_password):
        return None
    return user

def update_user_verification(db: Session, user_id: int, is_verified: bool = True):
    user = get_user_by_id(db, user_id)
    if user:
        user.is_verified = is_verified
        db.commit()
        db.refresh(user)
    return user

# Opérations statistiques
def get_user_usage_stats(db: Session, user_id: int):
    return db.query(models.UsageStats).filter(models.UsageStats.user_id == user_id).first()

def create_usage_stats(db: Session, user_id: int):
    usage_stats = models.UsageStats(user_id=user_id)
    db.add(usage_stats)
    db.commit()
    db.refresh(usage_stats)
    return usage_stats

def update_usage_stats(db: Session, user_id: int, images_processed: int = 1, processing_time: float = 0.0):
    usage_stats = get_user_usage_stats(db, user_id)
    if not usage_stats:
        usage_stats = create_usage_stats(db, user_id)
    
    usage_stats.images_processed += images_processed
    usage_stats.total_processing_time += processing_time
    usage_stats.last_activity = datetime.utcnow()
    
    db.commit()
    db.refresh(usage_stats)
    return usage_stats

def increment_retreatment_count(db: Session, user_id: int):
    """Incrémente le compteur de retraitements"""
    usage_stats = get_user_usage_stats(db, user_id)
    if not usage_stats:
        usage_stats = create_usage_stats(db, user_id)
    
    usage_stats.retreatment_count += 1
    usage_stats.last_activity = datetime.utcnow()
    
    db.commit()
    db.refresh(usage_stats)
    return usage_stats

def check_retreatment_limit(db: Session, user_id: int, max_retreatments: int = 2):
    """Vérifie si l'utilisateur peut encore faire des retraitements"""
    usage_stats = get_user_usage_stats(db, user_id)
    if not usage_stats:
        return True  # Premier retraitement
    
    return usage_stats.retreatment_count < max_retreatments

def get_retreatment_count(db: Session, user_id: int):
    """Récupère le nombre de retraitements effectués"""
    usage_stats = get_user_usage_stats(db, user_id)
    if not usage_stats:
        return 0
    return usage_stats.retreatment_count

# Opérations retraitements par image
def get_image_retreatment(db: Session, user_id: int, image_hash: str):
    """Récupère les informations de retraitement pour une image spécifique"""
    return db.query(models.ImageRetreatment).filter(
        and_(
            models.ImageRetreatment.user_id == user_id,
            models.ImageRetreatment.image_hash == image_hash
        )
    ).first()

def create_image_retreatment(db: Session, user_id: int, image_hash: str):
    """Crée un nouveau suivi de retraitement pour une image"""
    retreatment = models.ImageRetreatment(
        user_id=user_id,
        image_hash=image_hash,
        retreatment_count=0
    )
    db.add(retreatment)
    db.commit()
    db.refresh(retreatment)
    return retreatment

def increment_image_retreatment(db: Session, user_id: int, image_hash: str):
    """Incrémente le compteur de retraitements pour une image spécifique"""
    retreatment = get_image_retreatment(db, user_id, image_hash)
    if not retreatment:
        retreatment = create_image_retreatment(db, user_id, image_hash)
    
    retreatment.retreatment_count += 1
    retreatment.last_retreatment = datetime.utcnow()
    
    db.commit()
    db.refresh(retreatment)
    return retreatment

def check_image_retreatment_limit(db: Session, user_id: int, image_hash: str, max_retreatments: int = 2):
    """Vérifie si l'utilisateur peut encore retraiter cette image spécifique"""
    retreatment = get_image_retreatment(db, user_id, image_hash)
    if not retreatment:
        return True  # Premier retraitement pour cette image
    
    return retreatment.retreatment_count < max_retreatments

def get_image_retreatment_count(db: Session, user_id: int, image_hash: str):
    """Récupère le nombre de retraitements pour une image spécifique"""
    retreatment = get_image_retreatment(db, user_id, image_hash)
    if not retreatment:
        return 0
    return retreatment.retreatment_count

# Opérations quotas
def get_user_quotas(db: Session, user_id: int):
    return db.query(models.UserQuota).filter(models.UserQuota.user_id == user_id).all()

def get_user_quota_by_type(db: Session, user_id: int, quota_type: str):
    return db.query(models.UserQuota).filter(
        and_(
            models.UserQuota.user_id == user_id,
            models.UserQuota.quota_type == quota_type
        )
    ).first()

def create_user_quota(db: Session, user_id: int, quota_type: str, limit_value: int):
    # Calculer la date de reset
    now = datetime.utcnow()
    if quota_type == "daily":
        # Reset à minuit le lendemain
        reset_date = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif quota_type == "monthly":
        # Reset le 1er du mois prochain
        if now.month == 12:
            reset_date = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            reset_date = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        reset_date = now + timedelta(days=365)
    
    quota = models.UserQuota(
        user_id=user_id,
        quota_type=quota_type,
        limit_value=limit_value,
        reset_date=reset_date
    )
    db.add(quota)
    db.commit()
    db.refresh(quota)
    return quota

def check_and_update_quota(db: Session, user_id: int, quota_type: str):
    """Vérifie et incrémente le quota (utilisé pour le traitement d'images)"""
    quota = get_user_quota_by_type(db, user_id, quota_type)

    if not quota:
        # Créer un quota par défaut
        if quota_type == "daily":
            limit = 15
        elif quota_type == "monthly":
            limit = 200
        else:
            limit = 1000
        quota = create_user_quota(db, user_id, quota_type, limit)

    # Vérifier si le quota est expiré
    if datetime.utcnow().replace(tzinfo=None) > quota.reset_date.replace(tzinfo=None):
        quota.used_value = 0
        now = datetime.utcnow()
        if quota_type == "daily":
            quota.reset_date = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        elif quota_type == "monthly":
            if now.month == 12:
                quota.reset_date = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            else:
                quota.reset_date = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
        db.commit()
    
    # Vérifier si l'utilisateur a encore des crédits
    if quota.used_value >= quota.limit_value:
        return False, quota
    
    # Incrémenter l'utilisation
    quota.used_value += 1
    db.commit()
    return True, quota

def check_quota_only(db: Session, user_id: int, quota_type: str):
    """Vérifie seulement le quota sans l'incrémenter (utilisé pour l'affichage)"""
    quota = get_user_quota_by_type(db, user_id, quota_type)

    if not quota:
        # Créer un quota par défaut
        if quota_type == "daily":
            limit = 15
        elif quota_type == "monthly":
            limit = 200
        else:
            limit = 1000
        quota = create_user_quota(db, user_id, quota_type, limit)

    # Vérifier si le quota est expiré
    if datetime.utcnow().replace(tzinfo=None) > quota.reset_date.replace(tzinfo=None):
        quota.used_value = 0
        now = datetime.utcnow()
        if quota_type == "daily":
            quota.reset_date = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        elif quota_type == "monthly":
            if now.month == 12:
                quota.reset_date = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            else:
                quota.reset_date = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
        db.commit()
    
    return quota

def check_and_increment_quotas(db: Session, user_id: int):
    """Vérifie et incrémente les quotas (utilisé pour le traitement d'images)"""
    daily_ok, daily_quota = check_and_update_quota(db, user_id, "daily")
    monthly_ok, monthly_quota = check_and_update_quota(db, user_id, "monthly")
    
    can_process = daily_ok and monthly_ok
    message = None
    
    if not daily_ok:
        message = f"Limite quotidienne de {daily_quota.limit_value} images atteinte. Réessayez demain."
    elif not monthly_ok:
        message = f"Limite mensuelle de {monthly_quota.limit_value} images atteinte. Réessayez le mois prochain."
    
    return {
        "can_process": can_process,
        "message": message,
        "daily_used": daily_quota.used_value,
        "daily_limit": daily_quota.limit_value,
        "monthly_used": monthly_quota.used_value,
        "monthly_limit": monthly_quota.limit_value
    }

def check_quotas_for_retreatment(db: Session, user_id: int):
    """Vérifie les quotas sans incrémentation (utilisé pour le retraitement)"""
    daily_quota = check_quota_only(db, user_id, "daily")
    monthly_quota = check_quota_only(db, user_id, "monthly")
    
    daily_ok = daily_quota.used_value < daily_quota.limit_value
    monthly_ok = monthly_quota.used_value < monthly_quota.limit_value
    
    can_process = daily_ok and monthly_ok
    message = None
    
    if not daily_ok:
        message = f"Limite quotidienne de {daily_quota.limit_value} images atteinte. Réessayez demain."
    elif not monthly_ok:
        message = f"Limite mensuelle de {monthly_quota.limit_value} images atteinte. Réessayez le mois prochain."
    
    return {
        "can_process": can_process,
        "message": message,
        "daily_used": daily_quota.used_value,
        "daily_limit": daily_quota.limit_value,
        "monthly_used": monthly_quota.used_value,
        "monthly_limit": monthly_quota.limit_value
    }

def check_user_quotas(db: Session, user_id: int):
    """Vérifie les quotas quotidiens et mensuels (sans incrémentation)"""
    daily_quota = check_quota_only(db, user_id, "daily")
    monthly_quota = check_quota_only(db, user_id, "monthly")
    
    daily_ok = daily_quota.used_value < daily_quota.limit_value
    monthly_ok = monthly_quota.used_value < monthly_quota.limit_value
    
    can_process = daily_ok and monthly_ok
    message = None
    
    if not daily_ok:
        message = f"Limite quotidienne de {daily_quota.limit_value} images atteinte. Réessayez demain."
    elif not monthly_ok:
        message = f"Limite mensuelle de {monthly_quota.limit_value} images atteinte. Réessayez le mois prochain."
    
    return {
        "can_process": can_process,
        "message": message,
        "daily_used": daily_quota.used_value,
        "daily_limit": daily_quota.limit_value,
        "monthly_used": monthly_quota.used_value,
        "monthly_limit": monthly_quota.limit_value
    }

# Opérations sessions
def create_user_session(db: Session, user_id: int, ip_address: str = None, user_agent: str = None):
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=30)  # Session de 30 jours
    
    session = models.UserSession(
        user_id=user_id,
        session_token=session_token,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=expires_at
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

def get_user_session(db: Session, session_token: str):
    return db.query(models.UserSession).filter(
        and_(
            models.UserSession.session_token == session_token,
            models.UserSession.is_active == True,
            models.UserSession.expires_at > datetime.utcnow()
        )
    ).first()

def deactivate_session(db: Session, session_token: str):
    session = get_user_session(db, session_token)
    if session:
        session.is_active = False
        db.commit()
    return session

def deactivate_all_user_sessions(db: Session, user_id: int):
    sessions = db.query(models.UserSession).filter(
        and_(
            models.UserSession.user_id == user_id,
            models.UserSession.is_active == True
        )
    ).all()
    
    for session in sessions:
        session.is_active = False
    
    db.commit()
    return sessions

def cleanup_expired_sessions(db: Session):
    """Nettoie les sessions expirées"""
    expired_sessions = db.query(models.UserSession).filter(
        models.UserSession.expires_at <= datetime.utcnow()
    ).all()
    
    for session in expired_sessions:
        session.is_active = False
    
    db.commit()
    return len(expired_sessions)

# Nouvelles fonctions pour la gestion des utilisateurs
def update_user_password(db: Session, user_id: int, new_hashed_password: str):
    """Met à jour le mot de passe d'un utilisateur"""
    user = get_user_by_id(db, user_id)
    if user:
        user.hashed_password = new_hashed_password
        user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(user)
    return user

def update_user_username(db: Session, user_id: int, new_username: str):
    """Met à jour le nom d'utilisateur"""
    user = get_user_by_id(db, user_id)
    if user:
        user.username = new_username
        user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(user)
    return user

def update_user_email(db: Session, user_id: int, new_email: str):
    """Met à jour l'email d'un utilisateur"""
    user = get_user_by_id(db, user_id)
    if user:
        user.email = new_email
        user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(user)
    return user

def create_password_reset_token(db: Session, user_id: int, token: str, expires_at: datetime):
    """Crée un token de récupération de mot de passe"""
    # Désactiver les anciens tokens non utilisés
    old_tokens = db.query(models.PasswordReset).filter(
        and_(
            models.PasswordReset.user_id == user_id,
            models.PasswordReset.is_used == False
        )
    ).all()
    
    for old_token in old_tokens:
        old_token.is_used = True
    
    # Créer le nouveau token
    reset_token = models.PasswordReset(
        user_id=user_id,
        token=token,
        expires_at=expires_at
    )
    db.add(reset_token)
    db.commit()
    db.refresh(reset_token)
    return reset_token

def get_password_reset_token(db: Session, token: str):
    """Récupère un token de récupération de mot de passe"""
    return db.query(models.PasswordReset).filter(
        and_(
            models.PasswordReset.token == token,
            models.PasswordReset.is_used == False,
            models.PasswordReset.expires_at > datetime.utcnow()
        )
    ).first()

def mark_password_reset_token_used(db: Session, token: str):
    """Marque un token de récupération comme utilisé"""
    reset_token = get_password_reset_token(db, token)
    if reset_token:
        reset_token.is_used = True
        db.commit()
        db.refresh(reset_token)
    return reset_token

def cleanup_expired_password_resets(db: Session):
    """Nettoie les tokens de récupération expirés"""
    now = datetime.utcnow()
    expired_tokens = db.query(models.PasswordReset).filter(
        models.PasswordReset.expires_at < now
    ).all()
    
    for token in expired_tokens:
        token.is_used = True
    
    db.commit()
    return len(expired_tokens) 