from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# Schémas pour les utilisateurs
class UserBase(BaseModel):
    email: EmailStr
    username: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Schémas pour les tokens
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Schémas pour les statistiques
class UsageStatsBase(BaseModel):
    images_processed: int = 0
    total_processing_time: float = 0.0

class UsageStats(UsageStatsBase):
    id: int
    user_id: int
    last_activity: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

# Schémas pour les quotas
class UserQuotaBase(BaseModel):
    quota_type: str
    limit_value: int
    used_value: int = 0

class UserQuota(UserQuotaBase):
    id: int
    user_id: int
    reset_date: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

# Schémas pour les sessions
class UserSessionBase(BaseModel):
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class UserSession(UserSessionBase):
    id: int
    user_id: int
    session_token: str
    is_active: bool
    created_at: datetime
    expires_at: datetime
    
    class Config:
        from_attributes = True

# Schémas pour les réponses API
class UserProfile(BaseModel):
    user: User
    usage_stats: Optional[UsageStats] = None
    quotas: List[UserQuota] = []
    
    class Config:
        from_attributes = True

class QuotaStatus(BaseModel):
    daily_used: int
    daily_limit: int
    monthly_used: int
    monthly_limit: int
    can_process: bool
    message: Optional[str] = None 