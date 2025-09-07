from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, validator
from typing import List, Optional, Union
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
from bson import ObjectId
import secrets
import string
import re
import hashlib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Roles
class UserRole(str):
    CUSTOMER = "customer"
    PARTNER = "partner"
    OWNER = "owner"

class PartnerStatus(str):
    PENDING = "pending"
    VERIFIED = "verified"

# Validation regex patterns
USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9_]{3,30}$')
PASSWORD_PATTERN = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{}:;\'\"<>,.?/]).{8,64}$')
PHONE_PATTERN = re.compile(r'^\+[1-9]\d{7,14}$')

# Helper Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def generate_otp_code():
    return ''.join(secrets.choice(string.digits) for _ in range(6))

def hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()

def validate_password_strength(password: str) -> bool:
    return bool(PASSWORD_PATTERN.match(password))

def normalize_email(email: str) -> str:
    return email.lower().strip()

def normalize_username(username: str) -> str:
    return username.lower().strip()

def is_valid_identifier(identifier: str) -> tuple[bool, str]:
    """Check if identifier is valid email or username. Returns (is_valid, type)"""
    identifier = identifier.strip()
    
    # Check if it's an email
    if '@' in identifier:
        try:
            # Simple email validation regex
            email_pattern = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
            if email_pattern.match(identifier):
                return True, 'email'
            else:
                return False, 'invalid'
        except:
            return False, 'invalid'
    
    # Check if it's a username
    if USERNAME_PATTERN.match(identifier):
        return True, 'username'
    
    return False, 'invalid'

# Enhanced Models
class User(BaseModel):
    id: Optional[str] = None
    email: EmailStr
    username: Optional[str] = None
    password_hash: str
    phone: Optional[str] = None
    role: str = UserRole.CUSTOMER
    partner_status: Optional[str] = None
    mfa_enabled: bool = False
    mfa_code: Optional[str] = None
    mfa_code_expires: Optional[datetime] = None
    reset_otp: Optional[str] = None
    reset_otp_expires: Optional[datetime] = None
    reset_channel: Optional[str] = None
    failed_attempts: int = 0
    locked_until: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserSignup(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    password: str
    role: str = UserRole.CUSTOMER
    phone: Optional[str] = None
    accept_tos: bool

    @validator('email')
    def normalize_email_field(cls, v):
        return normalize_email(v)

    @validator('username')
    def validate_username(cls, v):
        if v is not None:
            v = v.strip()
            if not USERNAME_PATTERN.match(v):
                raise ValueError('Username must be 3–30 letters/numbers/underscore.')
        return v

    @validator('password')
    def validate_password(cls, v):
        if not validate_password_strength(v):
            raise ValueError('Password must be 8–64 chars and include uppercase, lowercase, digit, and special character.')
        return v

    @validator('phone')
    def validate_phone(cls, v):
        if v is not None:
            v = v.strip()
            if not PHONE_PATTERN.match(v):
                raise ValueError('Phone number must be valid E.164 format (e.g., +14155552671).')
        return v

    @validator('accept_tos')
    def validate_tos(cls, v):
        if not v:
            raise ValueError('You must accept the Terms of Service and Privacy Policy.')
        return v

class UserLogin(BaseModel):
    identifier: str
    password: str
    role_hint: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    username: Optional[str] = None
    role: str
    partner_status: Optional[str] = None
    mfa_enabled: bool = False
    phone: Optional[str] = None

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class ResetStartRequest(BaseModel):
    email_or_phone: str

class ResetStartResponse(BaseModel):
    sent: bool
    channel: str

class ResetVerifyRequest(BaseModel):
    email_or_phone: str
    otp: str
    new_password: str

    @validator('new_password')
    def validate_password(cls, v):
        if not validate_password_strength(v):
            raise ValueError('Password must be 8–64 chars and include uppercase, lowercase, digit, and special character.')
        return v

class ResetVerifyResponse(BaseModel):
    ok: bool

class MFAVerifyRequest(BaseModel):
    user_id: str
    code: str

class MFAVerifyResponse(BaseModel):
    ok: bool
    token: Optional[str] = None
    user: Optional[UserResponse] = None

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Dependency to get current user
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise credentials_exception
    
    return User(**user, id=str(user["_id"]))

# Rate limiting helper
async def check_rate_limit(identifier: str, action_type: str) -> bool:
    """Check if user is rate limited. Returns True if allowed, False if rate limited."""
    # Simple rate limiting - in production, use Redis
    key = f"rate_limit:{action_type}:{identifier}"
    # For now, just check failed attempts in user record
    return True  # Simplified for demo

# Enhanced Auth Routes
@api_router.post("/auth/signup", response_model=TokenResponse)
async def signup(user_data: UserSignup):
    # Check if email already exists
    existing_email = await db.users.find_one({"email": user_data.email})
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )
    
    # Check if username already exists (if provided)
    if user_data.username:
        username_lower = normalize_username(user_data.username)
        existing_username = await db.users.find_one({"username_lower": username_lower})
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken"
            )
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Set partner status if role is partner
    partner_status = PartnerStatus.PENDING if user_data.role == UserRole.PARTNER else None
    
    # Create user document
    user_dict = {
        "email": user_data.email,
        "password_hash": hashed_password,
        "phone": user_data.phone,
        "role": user_data.role,
        "partner_status": partner_status,
        "mfa_enabled": user_data.role == UserRole.OWNER,  # Enable MFA for owners
        "failed_attempts": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Only add username fields if username is provided
    if user_data.username:
        user_dict["username"] = user_data.username
        user_dict["username_lower"] = normalize_username(user_data.username)
    
    try:
        result = await db.users.insert_one(user_dict)
        user_id = str(result.inserted_id)
    except Exception as e:
        # Handle MongoDB duplicate key errors
        if "duplicate key error" in str(e):
            if "email" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already registered"
                )
            elif "username_lower" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Username already taken"
                )
        # Handle other database errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again."
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_id}, expires_delta=access_token_expires
    )
    
    # Return response
    user_response = UserResponse(
        id=user_id,
        email=user_data.email,
        username=user_data.username,
        role=user_data.role,
        partner_status=partner_status,
        mfa_enabled=user_data.role == UserRole.OWNER,
        phone=user_data.phone
    )
    
    return TokenResponse(
        token=access_token,
        user=user_response
    )

# Home API Routes

# Customer Home APIs
@api_router.get("/partners/nearby")
async def get_nearby_partners(lat: float, lng: float, radius_km: Optional[float] = 5.0):
    """Get nearby partners for customer map view"""
    # Mock data - in production, this would query a geospatial database
    mock_partners = [
        {
            "id": "partner_1",
            "lat": lat + 0.01,
            "lng": lng + 0.01,
            "rating": 4.8,
            "badges": ["Verified", "Pro"]
        },
        {
            "id": "partner_2", 
            "lat": lat - 0.015,
            "lng": lng + 0.008,
            "rating": 4.6,
            "badges": ["Verified"]
        },
        {
            "id": "partner_3",
            "lat": lat + 0.008,
            "lng": lng - 0.012,
            "rating": 4.9,
            "badges": ["Verified", "Pro", "Eco"]
        },
        {
            "id": "partner_4",
            "lat": lat - 0.005,
            "lng": lng - 0.007,
            "rating": 4.7,
            "badges": ["Verified"]
        }
    ]
    
    return {"partners": mock_partners}

@api_router.get("/pricing/surge")
async def get_surge_status(lat: float, lng: float):
    """Get surge pricing status for customer location"""
    # Mock surge logic - in production, this would check real demand/supply
    import random
    
    # 30% chance of surge pricing for demo
    surge_active = random.random() < 0.3
    multiplier = round(random.uniform(1.2, 2.5), 1) if surge_active else 1.0
    
    return {
        "active": surge_active,
        "multiplier": multiplier
    }

# Partner Home APIs  
@api_router.get("/partner/home")
async def get_partner_dashboard(current_user: User = Depends(get_current_user)):
    """Get partner dashboard data"""
    if current_user.role != UserRole.PARTNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Partner access required"
        )
    
    # Mock job queue data
    mock_queue = []
    if current_user.partner_status == PartnerStatus.VERIFIED:
        mock_queue = [
            {
                "jobId": "job_001",
                "service": "House Cleaning",
                "eta": 15
            },
            {
                "jobId": "job_002", 
                "service": "Lawn Care",
                "eta": 30
            }
        ]
    
    return {
        "status": "offline",  # Default to offline
        "verification": current_user.partner_status or "pending",
        "queue": mock_queue
    }

@api_router.post("/partner/availability")
async def set_partner_availability(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    """Toggle partner online/offline status"""
    if current_user.role != UserRole.PARTNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Partner access required"
        )
    
    if current_user.partner_status == PartnerStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verification required"
        )
    
    new_status = request.get("status", "offline")
    if new_status not in ["online", "offline"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'online' or 'offline'"
        )
    
    # In production, this would update the partner's availability in the database
    # For now, just return success
    return {"ok": True}

# Owner Home APIs
@api_router.get("/owner/tiles")
async def get_owner_tiles(current_user: User = Depends(get_current_user)):
    """Get owner dashboard tiles data"""
    if current_user.role != UserRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required"
        )
    
    # Mock tiles data - in production, these would be real metrics
    import random
    
    return {
        "activeJobs": random.randint(15, 45),
        "partnersOnline": random.randint(8, 25),
        "supportOpen": random.randint(2, 12),
        "gmvToday": random.randint(1500, 8500)
    }

# Service Selection APIs

@api_router.get("/services/catalog")
async def get_services_catalog():
    """Get available cleaning services catalog"""
    services = [
        {
            "code": "basic",
            "name": "Basic Clean",
            "basePrice": 80,
            "defaults": {
                "bedrooms": 2,
                "bathrooms": 1
            },
            "desc": "Standard tidy & surfaces - dusting, vacuuming, basic bathroom and kitchen clean"
        },
        {
            "code": "deep",
            "name": "Deep Clean", 
            "basePrice": 150,
            "defaults": {
                "bedrooms": 2,
                "bathrooms": 1
            },
            "desc": "Detailed clean incl. baseboards - comprehensive cleaning including inside appliances, baseboards, and detailed scrubbing"
        },
        {
            "code": "bathroom",
            "name": "Bathroom-only",
            "basePrice": 45,
            "defaults": {
                "bathrooms": 1
            },
            "desc": "Bathrooms only - thorough cleaning of all bathroom fixtures, tiles, and surfaces"
        }
    ]
    
    return {"services": services}

@api_router.post("/media/presign")
async def create_presigned_upload(request: dict):
    """Create presigned URL for photo upload"""
    content_type = request.get("contentType", "image/jpeg")
    
    # Validate content type
    if content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported media type"
        )
    
    # Generate unique file ID
    file_id = f"photo_{uuid.uuid4().hex[:12]}"
    
    # In production, this would generate a real presigned URL to S3/GCS
    # For demo, return a mock URL
    upload_url = f"https://mockupload.example.com/upload/{file_id}"
    
    return {
        "uploadUrl": upload_url,
        "fileId": file_id
    }

@api_router.post("/pricing/quote")
async def get_pricing_quote(request: dict):
    """Calculate pricing quote for service"""
    service_type = request.get("serviceType")
    dwelling_type = request.get("dwellingType")
    bedrooms = request.get("bedrooms", 0)
    bathrooms = request.get("bathrooms", 1)
    masters = request.get("masters", 0)
    photo_ids = request.get("photoIds", [])
    when = request.get("when", "now")
    schedule_at = request.get("scheduleAt")
    lat = request.get("lat")
    lng = request.get("lng")

    # Validation
    if service_type not in ["basic", "deep", "bathroom"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid service type"
        )
    
    if dwelling_type not in ["House", "Apartment", "Condo", "Office"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid dwelling type"
        )
    
    # Validate photo requirements
    if service_type in ["deep", "bathroom"] and len(photo_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Deep Clean and Bathroom-only require at least 2 photos"
        )
    
    # Base prices
    base_prices = {
        "basic": 80,
        "deep": 150,
        "bathroom": 45
    }
    
    base_price = base_prices[service_type]
    
    # Calculate price based on rooms
    room_multipliers = {
        "basic": {"bedroom": 15, "bathroom": 10, "master": 20},
        "deep": {"bedroom": 25, "bathroom": 20, "master": 35},
        "bathroom": {"bedroom": 0, "bathroom": 15, "master": 0}
    }
    
    multiplier = room_multipliers[service_type]
    room_price = (bedrooms * multiplier["bedroom"] + 
                  bathrooms * multiplier["bathroom"] + 
                  masters * multiplier["master"])
    
    # Dwelling type adjustment
    dwelling_multipliers = {
        "House": 1.0,
        "Apartment": 0.9,
        "Condo": 1.1,
        "Office": 1.3
    }
    
    dwelling_adjustment = dwelling_multipliers.get(dwelling_type, 1.0)
    
    # Calculate base total
    subtotal = (base_price + room_price) * dwelling_adjustment
    
    # Check for surge pricing
    import random
    surge_active = random.random() < 0.2  # 20% chance
    surge_multiplier = round(random.uniform(1.2, 2.0), 1) if surge_active else 1.0
    
    # Apply surge
    final_price = subtotal * surge_multiplier
    
    # Estimate duration (minutes)
    base_durations = {
        "basic": 90,
        "deep": 180,
        "bathroom": 60
    }
    
    base_duration = base_durations[service_type]
    room_duration = bedrooms * 15 + bathrooms * 20 + masters * 25
    total_duration = base_duration + room_duration
    
    # Create breakdown
    breakdown = [
        {"label": f"{service_type.title()} Clean Base", "amount": base_price},
    ]
    
    if room_price > 0:
        breakdown.append({"label": "Room adjustments", "amount": room_price})
    
    if dwelling_adjustment != 1.0:
        adjustment_amount = subtotal - (base_price + room_price)
        breakdown.append({"label": f"{dwelling_type} adjustment", "amount": adjustment_amount})
    
    if surge_active:
        surge_amount = final_price - subtotal
        breakdown.append({"label": f"Surge x{surge_multiplier}", "amount": surge_amount})
    
    # Generate quote ID
    quote_id = f"quote_{uuid.uuid4().hex[:8]}"
    
    return {
        "quoteId": quote_id,
        "price": round(final_price, 2),
        "durationMinutes": total_duration,
        "surge": {
            "active": surge_active,
            "multiplier": surge_multiplier
        },
        "breakdown": breakdown
    }

@api_router.post("/partner/capabilities")
async def set_partner_capabilities(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    """Set partner service capabilities"""
    if current_user.role != UserRole.PARTNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Partner access required"
        )
    
    services_offered = request.get("servicesOffered", [])
    
    # Validate services
    valid_services = ["basic", "deep", "bathroom"]
    for service in services_offered:
        if service not in valid_services:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid service: {service}"
            )
    
    # In production, save to partner profile in database
    # For now, just return success
    await db.users.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {
            "services_offered": services_offered,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"ok": True}

@api_router.post("/auth/login")
async def login(user_data: UserLogin):
    # Validate identifier format
    is_valid, identifier_type = is_valid_identifier(user_data.identifier)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect credentials"
        )
    
    # Find user by identifier
    if identifier_type == 'email':
        user = await db.users.find_one({"email": normalize_email(user_data.identifier)})
    else:  # username
        user = await db.users.find_one({"username_lower": normalize_username(user_data.identifier)})
    
    # Check credentials
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect credentials"
        )
    
    user_id = str(user["_id"])
    
    # Check if account is locked
    if user.get("locked_until") and datetime.utcnow() < user["locked_until"]:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account locked"
        )
    
    # Reset failed attempts on successful login
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"failed_attempts": 0, "locked_until": None}}
    )
    
    # Check if MFA is required
    if user.get("mfa_enabled", False):
        # Generate and store MFA code
        mfa_code = generate_otp_code()
        mfa_expires = datetime.utcnow() + timedelta(minutes=15)
        
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "mfa_code": hash_otp(mfa_code),
                "mfa_code_expires": mfa_expires
            }}
        )
        
        # In production, send MFA code via SMS/Email
        # For dev, return the code
        return {
            "mfa_required": True,
            "user_id": user_id,
            "message": "MFA code required",
            "dev_mfa_code": mfa_code  # Remove in production
        }
    
    # Regular login without MFA
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_id}, expires_delta=access_token_expires
    )
    
    user_response = UserResponse(
        id=user_id,
        email=user["email"],
        username=user.get("username"),
        role=user["role"],
        partner_status=user.get("partner_status"),
        mfa_enabled=user.get("mfa_enabled", False),
        phone=user.get("phone")
    )
    
    return TokenResponse(
        token=access_token,
        user=user_response
    )

@api_router.post("/auth/mfa/verify", response_model=MFAVerifyResponse)
async def verify_mfa(mfa_data: MFAVerifyRequest):
    # Find user
    user = await db.users.find_one({"_id": ObjectId(mfa_data.user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Check MFA code
    if (not user.get("mfa_code") or 
        user["mfa_code"] != hash_otp(mfa_data.code) or
        datetime.utcnow() > user.get("mfa_code_expires", datetime.min)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid code"
        )
    
    # Clear MFA code
    await db.users.update_one(
        {"_id": ObjectId(mfa_data.user_id)},
        {"$unset": {"mfa_code": "", "mfa_code_expires": ""}}
    )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": mfa_data.user_id, "mfa_verified": True}, expires_delta=access_token_expires
    )
    
    user_response = UserResponse(
        id=mfa_data.user_id,
        email=user["email"],
        username=user.get("username"),
        role=user["role"],
        partner_status=user.get("partner_status"),
        mfa_enabled=user.get("mfa_enabled", False),
        phone=user.get("phone")
    )
    
    return MFAVerifyResponse(
        ok=True,
        token=access_token,
        user=user_response
    )

@api_router.post("/auth/reset/start", response_model=ResetStartResponse)
async def reset_password_start(reset_data: ResetStartRequest):
    identifier = reset_data.email_or_phone.strip()
    
    # Determine if it's email or phone
    if '@' in identifier:
        # Simple email validation
        email_pattern = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
        if email_pattern.match(identifier):
            channel = "email"
            user = await db.users.find_one({"email": normalize_email(identifier)})
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email or phone format."
            )
    elif identifier.startswith('+'):
        if not PHONE_PATTERN.match(identifier):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email or phone format."
            )
        channel = "sms"
        user = await db.users.find_one({"phone": identifier})
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or phone format."
        )
    
    # Generate and store OTP (even if user not found, to prevent enumeration)
    otp = generate_otp_code()
    otp_expires = datetime.utcnow() + timedelta(minutes=15)
    
    if user:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "reset_otp": hash_otp(otp),
                "reset_otp_expires": otp_expires,
                "reset_channel": channel
            }}
        )
        
        # In production, send OTP via email/SMS
        # For dev, log the OTP
        logger.info(f"Reset OTP for {identifier}: {otp}")
    
    return ResetStartResponse(sent=True, channel=channel)

@api_router.post("/auth/reset/verify", response_model=ResetVerifyResponse)
async def reset_password_verify(reset_data: ResetVerifyRequest):
    identifier = reset_data.email_or_phone.strip()
    
    # Find user by identifier
    if '@' in identifier:
        user = await db.users.find_one({"email": normalize_email(identifier)})
    else:
        user = await db.users.find_one({"phone": identifier})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP"
        )
    
    # Check OTP
    if (not user.get("reset_otp") or 
        user["reset_otp"] != hash_otp(reset_data.otp) or
        datetime.utcnow() > user.get("reset_otp_expires", datetime.min)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP"
        )
    
    # Update password and clear reset data
    hashed_password = get_password_hash(reset_data.new_password)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_hash": hashed_password,
            "updated_at": datetime.utcnow()
        },
        "$unset": {
            "reset_otp": "",
            "reset_otp_expires": "",
            "reset_channel": ""
        }}
    )
    
    return ResetVerifyResponse(ok=True)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        role=current_user.role,
        partner_status=current_user.partner_status,
        mfa_enabled=current_user.mfa_enabled,
        phone=current_user.phone
    )

@api_router.post("/auth/switch-role")
async def switch_role(current_user: User = Depends(get_current_user)):
    """Allow partner to switch to customer role"""
    if current_user.role != UserRole.PARTNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only partners can switch to customer role"
        )
    
    # Update user role to customer
    await db.users.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"role": UserRole.CUSTOMER, "updated_at": datetime.utcnow()}}
    )
    
    # Create new access token with customer role
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": current_user.id}, expires_delta=access_token_expires
    )
    
    user_response = UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        role=UserRole.CUSTOMER,
        partner_status=None,
        mfa_enabled=current_user.mfa_enabled,
        phone=current_user.phone
    )
    
    return TokenResponse(
        token=access_token,
        user=user_response
    )

# Address Models
class AddressBase(BaseModel):
    label: Optional[str] = None
    line1: str
    line2: Optional[str] = None
    city: str
    state: str
    postalCode: str
    country: str
    lat: float
    lng: float

class SaveAddressRequest(AddressBase):
    pass

class SaveAddressResponse(BaseModel):
    id: str

class AddressResponse(AddressBase):
    id: str

class ListAddressesResponse(BaseModel):
    addresses: List[AddressResponse]

class AutocompleteCandidate(BaseModel):
    placeId: str
    label: str
    line1: str
    city: str
    state: str
    postalCode: str
    country: str
    lat: float
    lng: float

class AutocompleteResponse(BaseModel):
    candidates: List[AutocompleteCandidate]

class ETARequest(BaseModel):
    lat: float
    lng: float
    timing: dict

class ETAResponse(BaseModel):
    window: str
    distanceKm: float

# Address API Endpoints
@api_router.get("/addresses", response_model=ListAddressesResponse)
async def list_saved_addresses(current_user: User = Depends(get_current_user)):
    """List saved addresses for the current user"""
    addresses = await db.addresses.find({"user_id": current_user.id}).to_list(100)
    
    address_responses = []
    for addr in addresses:
        address_responses.append(AddressResponse(
            id=str(addr["_id"]),
            label=addr.get("label"),
            line1=addr["line1"],
            line2=addr.get("line2"),
            city=addr["city"],
            state=addr["state"],
            postalCode=addr["postalCode"],
            country=addr["country"],
            lat=addr["lat"],
            lng=addr["lng"]
        ))
    
    return ListAddressesResponse(addresses=address_responses)

@api_router.post("/addresses", response_model=SaveAddressResponse)
async def save_address(
    address_data: SaveAddressRequest,
    current_user: User = Depends(get_current_user)
):
    """Save a new address for the current user"""
    
    # Check for duplicate addresses (same line1, city, postal code)
    existing = await db.addresses.find_one({
        "user_id": current_user.id,
        "line1": address_data.line1,
        "city": address_data.city,
        "postalCode": address_data.postalCode
    })
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Address already exists"
        )
    
    # Create address document
    address_doc = {
        "user_id": current_user.id,
        "label": address_data.label,
        "line1": address_data.line1,
        "line2": address_data.line2,
        "city": address_data.city,
        "state": address_data.state,
        "postalCode": address_data.postalCode,
        "country": address_data.country,
        "lat": address_data.lat,
        "lng": address_data.lng,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.addresses.insert_one(address_doc)
    
    return SaveAddressResponse(id=str(result.inserted_id))

@api_router.get("/places/autocomplete", response_model=AutocompleteResponse)
async def autocomplete_places(q: str):
    """Mock autocomplete service for addresses"""
    
    # Mock data based on search query
    if not q or len(q) < 3:
        return AutocompleteResponse(candidates=[])
    
    # Generate mock candidates based on the query
    mock_candidates = [
        AutocompleteCandidate(
            placeId=f"place_{i}_{hashlib.md5(q.encode()).hexdigest()[:8]}",
            label=f"{q} {suffix}",
            line1=f"{i*100 + 23} {q} {suffix}",
            city="San Francisco" if i % 2 == 0 else "New York",
            state="CA" if i % 2 == 0 else "NY",
            postalCode="94102" if i % 2 == 0 else "10001",
            country="USA",
            lat=37.7749 + (i * 0.01) if i % 2 == 0 else 40.7128 + (i * 0.01),
            lng=-122.4194 + (i * 0.01) if i % 2 == 0 else -74.0060 + (i * 0.01)
        )
        for i, suffix in enumerate(["Street", "Avenue", "Boulevard", "Lane", "Drive"][:3])
    ]
    
    return AutocompleteResponse(candidates=mock_candidates)

@api_router.post("/eta/preview", response_model=ETAResponse)
async def get_eta_preview(eta_request: ETARequest):
    """Mock ETA calculation service"""
    
    # Mock ETA calculation based on coordinates
    # Simulate different ETAs based on location
    base_distance = abs(eta_request.lat - 37.7749) + abs(eta_request.lng + 122.4194)
    distance_km = round(base_distance * 100, 1)  # Convert to reasonable km
    
    if distance_km < 5:
        window = "15–25 min"
    elif distance_km < 15:
        window = "30–45 min"
    else:
        window = "45–60 min"
    
    # Check if it's scheduled vs now
    timing = eta_request.timing
    if timing.get("when") == "schedule":
        window = f"Scheduled: {window}"
    
    return ETAResponse(
        window=window,
        distanceKm=min(distance_km, 25.0)  # Cap at 25km for realism
    )

# Payment & Billing Models
class PaymentMethod(BaseModel):
    id: str
    brand: str
    last4: str
    exp: str
    isDefault: bool

class ListPaymentMethodsResponse(BaseModel):
    methods: List[PaymentMethod]

class SetupIntentResponse(BaseModel):
    clientSecret: str

class AttachPaymentMethodRequest(BaseModel):
    paymentMethodId: str

class AttachPaymentMethodResponse(BaseModel):
    ok: bool

class PromoApplyRequest(BaseModel):
    quoteId: str
    code: str
    useCredits: bool = False

class PriceBreakdownItem(BaseModel):
    label: str
    amount: float

class PromoApplyResponse(BaseModel):
    breakdown: List[PriceBreakdownItem]
    total: float
    promoApplied: bool
    creditsApplied: float

class PaymentIntentRequest(BaseModel):
    amount: float
    currency: str = "usd"
    paymentMethodId: str
    captureStrategy: str = "dual"

class PaymentIntentResponse(BaseModel):
    paymentIntentId: str
    clientSecret: str
    requiresAction: bool

class ConfirmStripeActionRequest(BaseModel):
    paymentIntentId: str

class ConfirmStripeActionResponse(BaseModel):
    ok: bool

class BookingRequest(BaseModel):
    quoteId: str
    service: dict
    address: dict
    access: dict
    totals: dict
    payment: dict
    applyCredits: bool = False
    promoCode: Optional[str] = None

class BookingResponse(BaseModel):
    bookingId: str
    status: str
    etaWindow: Optional[str] = None
    next: str

class VoidPreauthRequest(BaseModel):
    paymentIntentId: str

class VoidPreauthResponse(BaseModel):
    ok: bool

# Billing & Payment API Endpoints
@api_router.get("/billing/methods", response_model=ListPaymentMethodsResponse)
async def list_payment_methods(current_user: User = Depends(get_current_user)):
    """List saved payment methods for the current user"""
    
    # Mock payment methods data
    mock_methods = [
        PaymentMethod(
            id="pm_1Abc123Def456",
            brand="visa",
            last4="4242",
            exp="12/26",
            isDefault=True
        ),
        PaymentMethod(
            id="pm_2Ghi789Jkl012",
            brand="mastercard", 
            last4="1234",
            exp="03/27",
            isDefault=False
        )
    ]
    
    return ListPaymentMethodsResponse(methods=mock_methods)

@api_router.post("/billing/setup-intent", response_model=SetupIntentResponse)
async def create_setup_intent(current_user: User = Depends(get_current_user)):
    """Create Stripe setup intent for adding new payment method"""
    
    # Mock setup intent
    mock_client_secret = f"seti_{secrets.token_urlsafe(24)}_secret_{secrets.token_urlsafe(16)}"
    
    return SetupIntentResponse(clientSecret=mock_client_secret)

@api_router.post("/billing/methods", response_model=AttachPaymentMethodResponse)
async def attach_payment_method(
    request: AttachPaymentMethodRequest,
    current_user: User = Depends(get_current_user)
):
    """Attach a payment method to customer"""
    
    # Mock successful attachment
    return AttachPaymentMethodResponse(ok=True)

@api_router.post("/pricing/promo/apply", response_model=PromoApplyResponse)
async def apply_promo_code(
    request: PromoApplyRequest,
    current_user: User = Depends(get_current_user)
):
    """Apply promo code and calculate pricing breakdown"""
    
    # Mock pricing calculation
    base_price = 89.00
    rooms_fee = 15.00
    surge_multiplier = 1.0
    
    # Simulate promo code validation
    valid_promos = ["SHINE20", "FIRST10", "SAVE15"]
    promo_applied = False
    discount = 0.0
    
    if request.code in valid_promos:
        promo_applied = True
        if request.code == "SHINE20":
            discount = 20.0
        elif request.code == "FIRST10":
            discount = 10.0
        elif request.code == "SAVE15":
            discount = 15.0
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid promo code"
        )
    
    # Calculate totals
    subtotal = base_price + rooms_fee
    surge_amount = subtotal * (surge_multiplier - 1) if surge_multiplier > 1 else 0
    promo_discount = discount if promo_applied else 0
    
    # Mock credits
    credits_available = 25.0
    credits_applied = min(credits_available, subtotal) if request.useCredits else 0
    
    tax_rate = 0.08875  # Mock tax rate
    taxable_amount = subtotal + surge_amount - promo_discount - credits_applied
    tax = max(0, taxable_amount * tax_rate)
    total = max(0, taxable_amount + tax)
    
    breakdown = [
        PriceBreakdownItem(label="Base Service", amount=base_price),
        PriceBreakdownItem(label="Rooms", amount=rooms_fee),
    ]
    
    if surge_amount > 0:
        breakdown.append(PriceBreakdownItem(label="Surge", amount=surge_amount))
    
    if promo_discount > 0:
        breakdown.append(PriceBreakdownItem(label=f"Promo ({request.code})", amount=-promo_discount))
    
    if credits_applied > 0:
        breakdown.append(PriceBreakdownItem(label="Credits", amount=-credits_applied))
    
    breakdown.extend([
        PriceBreakdownItem(label="Tax", amount=tax),
        PriceBreakdownItem(label="Total", amount=total)
    ])
    
    return PromoApplyResponse(
        breakdown=breakdown,
        total=total,
        promoApplied=promo_applied,
        creditsApplied=credits_applied
    )

@api_router.post("/billing/preauth", response_model=PaymentIntentResponse)
async def create_payment_intent_preauth(
    request: PaymentIntentRequest,
    current_user: User = Depends(get_current_user)
):
    """Create payment intent for pre-authorization"""
    
    # Mock payment intent creation
    mock_pi_id = f"pi_{secrets.token_urlsafe(24)}"
    mock_client_secret = f"{mock_pi_id}_secret_{secrets.token_urlsafe(16)}"
    
    # Simulate different scenarios based on payment method
    requires_action = False
    if "pm_sca" in request.paymentMethodId:
        requires_action = True
    elif "pm_declined" in request.paymentMethodId:
        raise HTTPException(
            status_code=402,
            detail="Your card was declined"
        )
    
    return PaymentIntentResponse(
        paymentIntentId=mock_pi_id,
        clientSecret=mock_client_secret,
        requiresAction=requires_action
    )

@api_router.post("/billing/confirm", response_model=ConfirmStripeActionResponse)
async def confirm_stripe_action(request: ConfirmStripeActionRequest):
    """Confirm Stripe action (SCA)"""
    
    # Mock successful confirmation
    return ConfirmStripeActionResponse(ok=True)

@api_router.post("/bookings", response_model=BookingResponse)
async def create_booking(
    booking_data: BookingRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a booking after successful payment pre-auth"""
    
    # Simulate booking creation
    booking_id = f"bk_{secrets.token_urlsafe(16)}"
    
    # Mock different booking statuses
    timing = booking_data.service.get("timing", {})
    if timing.get("when") == "now":
        status = "pending_dispatch"
        eta_window = "30-45 min"
        next_step = "dispatch"
    else:
        status = "scheduled"
        eta_window = None
        next_step = "tracking"
    
    # Store booking in database
    booking_doc = {
        "booking_id": booking_id,
        "user_id": current_user.id,
        "status": status,
        "service": booking_data.service,
        "address": booking_data.address,
        "access": booking_data.access,
        "totals": booking_data.totals,
        "payment": booking_data.payment,
        "promo_code": booking_data.promoCode,
        "credits_applied": booking_data.applyCredits,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.bookings.insert_one(booking_doc)
    
    return BookingResponse(
        bookingId=booking_id,
        status=status,
        etaWindow=eta_window,
        next=next_step
    )

@api_router.post("/billing/void", response_model=VoidPreauthResponse)
async def void_preauth(request: VoidPreauthRequest):
    """Void a payment pre-authorization"""
    
    # Mock successful void
    return VoidPreauthResponse(ok=True)

# Original routes
@api_router.get("/")
async def root():
    return {"message": "SHINE API v3.0"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Create indexes on startup
@app.on_event("startup")
async def create_indexes():
    # Create unique index on email
    await db.users.create_index("email", unique=True)
    
    # Create unique sparse index on username_lower (allows null values)
    await db.users.create_index("username_lower", unique=True, sparse=True)
    
    # Address indexes
    await db.addresses.create_index("user_id")
    await db.addresses.create_index([("user_id", 1), ("line1", 1), ("city", 1), ("postalCode", 1)])
    await db.addresses.create_index("created_at")
    
    # Booking indexes
    await db.bookings.create_index("user_id")
    await db.bookings.create_index("booking_id", unique=True)
    await db.bookings.create_index("status")
    await db.bookings.create_index("created_at")
    
    logger.info("Created database indexes")