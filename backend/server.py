from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query
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
import random

# Initialize mock booking data for PAGE-11-BOOKINGS testing
async def initialize_mock_bookings():
    """Initialize mock booking data for testing purposes"""
    
    # Find existing test user or use any user with the test email
    test_user = await db.users.find_one({"email": "user_001@test.com"})
    if test_user:
        test_user_id = str(test_user["_id"])
    else:
        # If no test user exists, create one
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed_password = pwd_context.hash("TestPass123!")
        
        user_doc = {
            "email": "user_001@test.com",
            "password_hash": hashed_password,
            "role": "customer",
            "mfa_enabled": False,
            "failed_attempts": 0,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        result = await db.users.insert_one(user_doc)
        test_user_id = str(result.inserted_id)
    
    # Sample customer bookings for different users
    mock_bookings = [
        # Upcoming booking
        {
            "booking_id": "bk_upcoming_001",
            "user_id": test_user_id,
            "partner_id": None,
            "status": "scheduled",
            "service": {
                "type": "Deep Clean",
                "dwellingType": "House",
                "bedrooms": 3,
                "bathrooms": 2,
                "masters": 1,
                "addons": ["inside_fridge", "inside_oven"]
            },
            "address": {
                "line1": "123 Pine St",
                "city": "Springfield",
                "postalCode": "94105",
                "lat": 37.7749,
                "lng": -122.4194
            },
            "access": {},
            "totals": {
                "base": 120.0,
                "rooms": 30.0,
                "surge": True,
                "surgeAmount": 30.0,
                "tax": 0.0,
                "promo": 0.0,
                "credits": 0.0,
                "total": 180.0
            },
            "payment": {},
            "promo_code": None,
            "credits_applied": False,
            "created_at": datetime.utcnow() + timedelta(days=1),
            "updated_at": datetime.utcnow()
        },
        # In-progress booking
        {
            "booking_id": "bk_inprogress_002",
            "user_id": test_user_id,
            "partner_id": "partner_001",
            "status": "in_progress",
            "service": {
                "type": "Bathroom Only",
                "dwellingType": "Apartment",
                "bedrooms": 2,
                "bathrooms": 1,
                "masters": 0,
                "addons": []
            },
            "address": {
                "line1": "456 Oak Ave",
                "city": "Springfield",
                "postalCode": "94107",
                "lat": 37.7849,
                "lng": -122.4094
            },
            "access": {},
            "totals": {
                "base": 80.0,
                "rooms": 0.0,
                "surge": False,
                "tax": 0.0,
                "promo": -10.0,
                "credits": 0.0,
                "total": 70.0
            },
            "payment": {},
            "promo_code": "SHINE10",
            "credits_applied": False,
            "created_at": datetime.utcnow() - timedelta(hours=2),
            "updated_at": datetime.utcnow()
        },
        # Completed booking
        {
            "booking_id": "bk_completed_003",
            "user_id": test_user_id,
            "partner_id": "partner_001",
            "status": "completed",
            "service": {
                "type": "Standard Clean",
                "dwellingType": "House",
                "bedrooms": 4,
                "bathrooms": 3,
                "masters": 1,
                "addons": ["inside_windows"]
            },
            "address": {
                "line1": "789 Elm St",
                "city": "Springfield",
                "postalCode": "94108",
                "lat": 37.7949,
                "lng": -122.3994
            },
            "access": {},
            "totals": {
                "base": 100.0,
                "rooms": 40.0,
                "surge": False,
                "tax": 0.0,
                "promo": 0.0,
                "credits": -25.0,
                "total": 115.0
            },
            "payment": {},
            "promo_code": None,
            "credits_applied": True,
            "created_at": datetime.utcnow() - timedelta(days=7),
            "updated_at": datetime.utcnow() - timedelta(days=6)
        },
        # Partner job for today
        {
            "booking_id": "bk_partner_today_004",
            "user_id": "user_002",
            "partner_id": "partner_001",
            "status": "assigned",
            "service": {
                "type": "Move-out Clean",
                "dwellingType": "Apartment",
                "bedrooms": 1,
                "bathrooms": 1,
                "masters": 0,
                "addons": ["inside_fridge", "inside_oven", "inside_cabinets"]
            },
            "address": {
                "line1": "321 Market St",
                "city": "Downtown",
                "postalCode": "94102",
                "lat": 37.7849,
                "lng": -122.4194
            },
            "access": {},
            "totals": {
                "base": 150.0,
                "rooms": 0.0,
                "surge": False,
                "tax": 0.0,
                "promo": 0.0,
                "credits": 0.0,
                "total": 150.0
            },
            "payment": {},
            "promo_code": None,
            "credits_applied": False,
            "created_at": datetime.utcnow() - timedelta(hours=1),
            "updated_at": datetime.utcnow()
        }
    ]
    
    # Delete existing mock bookings first to avoid duplicates
    await db.bookings.delete_many({"booking_id": {"$in": ["bk_upcoming_001", "bk_inprogress_002", "bk_completed_003", "bk_partner_today_004"]}})
    
    # Insert mock bookings
    for booking in mock_bookings:
        await db.bookings.insert_one(booking)
    
    print(f"Mock booking data initialized for user {test_user_id}")

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
    
    # Create dispatch offer for partners
    create_dispatch_offer(booking_id, booking_data.service)
    
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

# Dispatch & Offer Models
class PartnerInfo(BaseModel):
    id: str
    name: str
    rating: float
    etaMinutes: int
    distanceKm: float

class CustomerStatusResponse(BaseModel):
    state: str  # searching|assigned|no_match|cancelled
    waitMins: int
    zone: str
    partner: Optional[PartnerInfo] = None

class Offer(BaseModel):
    offerId: str
    bookingId: str
    serviceType: str
    addressShort: str
    distanceKm: float
    etaMinutes: int
    when: str
    scheduleAt: Optional[str] = None
    payout: float
    currency: str = "usd"
    surge: dict
    countdownSec: int

class OfferMessage(BaseModel):
    type: str
    offer: Optional[Offer] = None
    offerId: Optional[str] = None
    detail: Optional[str] = None

class AcceptOfferRequest(BaseModel):
    idempotencyKey: str

class AcceptOfferResponse(BaseModel):
    assigned: bool
    bookingId: str

class DeclineOfferResponse(BaseModel):
    ok: bool

class CustomerCancelRequest(BaseModel):
    reason: str

class CustomerCancelResponse(BaseModel):
    ok: bool
    refundCredit: Optional[float] = None
    fee: Optional[float] = None

class OwnerDispatchKPIs(BaseModel):
    avgTimeToAssign: float
    acceptRate: float
    offersActive: int
    offersExpired: int

class OwnerDispatchOffer(BaseModel):
    offerId: str
    bookingId: str
    zone: str
    state: str
    pings: int
    surge: float

class OwnerDispatchResponse(BaseModel):
    kpis: OwnerDispatchKPIs
    offers: List[OwnerDispatchOffer]

# In-memory dispatch state (in production, use Redis)
active_offers = {}  # offerId -> offer_data
booking_status = {}  # bookingId -> status_data
partner_connections = {}  # partner_id -> websocket_connection

# Dispatch API Endpoints
@api_router.get("/dispatch/status/{booking_id}", response_model=CustomerStatusResponse)
async def get_customer_dispatch_status(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get customer dispatch status for a booking"""
    
    # Mock dispatch status based on booking_id
    if booking_id not in booking_status:
        # Initialize new booking dispatch
        booking_status[booking_id] = {
            "state": "searching",
            "waitMins": 3,
            "zone": "downtown_sf",
            "startTime": datetime.utcnow(),
            "partner": None
        }
    
    status = booking_status[booking_id]
    
    # Simulate progression over time
    elapsed_mins = (datetime.utcnow() - status["startTime"]).total_seconds() / 60
    
    if elapsed_mins > 8:  # After 8 minutes, assign a partner
        if status["state"] == "searching":
            status["state"] = "assigned"
            status["partner"] = {
                "id": "partner_123",
                "name": "Alex M.",
                "rating": 4.8,
                "etaMinutes": 12,
                "distanceKm": 2.3
            }
    elif elapsed_mins > 15:  # After 15 minutes, no match
        if status["state"] == "searching":
            status["state"] = "no_match"
    
    return CustomerStatusResponse(
        state=status["state"],
        waitMins=max(1, int(status["waitMins"] - elapsed_mins)),
        zone=status["zone"],
        partner=PartnerInfo(**status["partner"]) if status["partner"] else None
    )

@api_router.get("/partner/offers/poll")
async def poll_partner_offers(current_user: User = Depends(get_current_user)):
    """Polling fallback for partner offers"""
    
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    # Check for active offers for this partner
    partner_offers = [
        offer for offer in active_offers.values() 
        if offer.get("targetPartnerId") == current_user.id
    ]
    
    if partner_offers:
        offer_data = partner_offers[0]  # Return first offer
        return {"offer": offer_data}
    
    return {"offer": None}

@api_router.post("/partner/offers/{offer_id}/accept", response_model=AcceptOfferResponse)
async def accept_offer(
    offer_id: str,
    request: AcceptOfferRequest,
    current_user: User = Depends(get_current_user)
):
    """Accept a partner offer"""
    
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    # Check if offer exists and is still valid
    if offer_id not in active_offers:
        raise HTTPException(status_code=410, detail="Offer expired")
    
    offer = active_offers[offer_id]
    
    # Check if already taken by another partner
    if offer.get("status") == "accepted":
        raise HTTPException(status_code=409, detail="Offer already taken")
    
    # Check partner eligibility
    if current_user.partner_status != "verified":
        raise HTTPException(status_code=423, detail="Partner not eligible")
    
    # Accept the offer
    offer["status"] = "accepted"
    offer["acceptedBy"] = current_user.id
    offer["acceptedAt"] = datetime.utcnow()
    
    # Update booking status
    booking_id = offer["bookingId"]
    if booking_id in booking_status:
        booking_status[booking_id]["state"] = "assigned"
        booking_status[booking_id]["partner"] = {
            "id": current_user.id,
            "name": f"{current_user.email.split('@')[0]} P.",
            "rating": 4.7,
            "etaMinutes": offer["etaMinutes"],
            "distanceKm": offer["distanceKm"]
        }
    
    # Store idempotency key to prevent double accepts
    offer["idempotencyKey"] = request.idempotencyKey
    
    return AcceptOfferResponse(
        assigned=True,
        bookingId=booking_id
    )

@api_router.post("/partner/offers/{offer_id}/decline", response_model=DeclineOfferResponse)
async def decline_offer(
    offer_id: str,
    current_user: User = Depends(get_current_user)
):
    """Decline a partner offer"""
    
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    # Mark offer as declined
    if offer_id in active_offers:
        active_offers[offer_id]["status"] = "declined"
        active_offers[offer_id]["declinedBy"] = current_user.id
        active_offers[offer_id]["declinedAt"] = datetime.utcnow()
    
    return DeclineOfferResponse(ok=True)

@api_router.post("/bookings/{booking_id}/cancel", response_model=CustomerCancelResponse)
async def cancel_booking(
    booking_id: str,
    request: CustomerCancelRequest,
    current_user: User = Depends(get_current_user)
):
    """Cancel a customer booking"""
    
    if current_user.role != "customer":
        raise HTTPException(status_code=403, detail="Customer access required")
    
    # Check booking status
    if booking_id not in booking_status:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    status = booking_status[booking_id]
    
    # Check if can cancel
    if status["state"] == "assigned":
        raise HTTPException(status_code=409, detail="Cannot cancel after partner accepted")
    
    # Calculate cancellation fee/refund based on timing
    elapsed_mins = (datetime.utcnow() - status["startTime"]).total_seconds() / 60
    
    fee = None
    refund_credit = None
    
    if elapsed_mins < 5:  # Free cancellation window
        refund_credit = 0.0
    elif elapsed_mins < 10:  # Small fee
        fee = 5.0
    else:  # Larger fee  
        fee = 10.0
    
    # Update booking status
    status["state"] = "cancelled"
    status["cancelReason"] = request.reason
    status["cancelledAt"] = datetime.utcnow()
    
    return CustomerCancelResponse(
        ok=True,
        refundCredit=refund_credit,
        fee=fee
    )

@api_router.get("/owner/dispatch", response_model=OwnerDispatchResponse)
async def get_owner_dispatch_dashboard(current_user: User = Depends(get_current_user)):
    """Get owner dispatch dashboard with live metrics"""
    
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    
    # Calculate KPIs from active data
    total_offers = len(active_offers)
    accepted_offers = len([o for o in active_offers.values() if o.get("status") == "accepted"])
    expired_offers = len([o for o in active_offers.values() if o.get("status") == "expired"])
    
    accept_rate = (accepted_offers / max(1, total_offers)) * 100
    
    # Mock average time to assign
    avg_time_to_assign = 4.2  # minutes
    
    kpis = OwnerDispatchKPIs(
        avgTimeToAssign=avg_time_to_assign,
        acceptRate=accept_rate,
        offersActive=total_offers - accepted_offers - expired_offers,
        offersExpired=expired_offers
    )
    
    # Format offers for table
    offers_list = []
    for offer_id, offer_data in active_offers.items():
        offers_list.append(OwnerDispatchOffer(
            offerId=offer_id,
            bookingId=offer_data.get("bookingId", ""),
            zone=offer_data.get("zone", "downtown_sf"),
            state=offer_data.get("status", "offered"),
            pings=offer_data.get("pings", 1),
            surge=offer_data.get("surge", {}).get("multiplier", 1.0)
        ))
    
    return OwnerDispatchResponse(
        kpis=kpis,
        offers=offers_list
    )

# Helper function to create mock offers (called when bookings are created)
def create_dispatch_offer(booking_id: str, service_data: dict):
    """Create a new dispatch offer for partners"""
    
    offer_id = f"of_{secrets.token_urlsafe(16)}"
    
    # Mock surge based on time/demand
    current_hour = datetime.utcnow().hour
    surge_active = current_hour in [7, 8, 17, 18, 19]  # Rush hours
    surge_multiplier = 1.5 if surge_active else 1.0
    
    offer_data = {
        "offerId": offer_id,
        "bookingId": booking_id,
        "serviceType": service_data.get("serviceType", "basic"),
        "addressShort": "Downtown SF",  # Masked address
        "distanceKm": round(2.0 + (hash(booking_id) % 5), 1),
        "etaMinutes": 8 + (hash(booking_id) % 10),
        "when": service_data.get("timing", {}).get("when", "now"),
        "scheduleAt": service_data.get("timing", {}).get("scheduleAt"),
        "payout": 45.0 * surge_multiplier,
        "currency": "usd",
        "surge": {
            "active": surge_active,
            "multiplier": surge_multiplier
        },
        "countdownSec": 25,
        "status": "offered",
        "createdAt": datetime.utcnow(),
        "zone": "downtown_sf",
        "pings": 1
    }
    
    active_offers[offer_id] = offer_data
    
    # Initialize booking status for customer tracking
    booking_status[booking_id] = {
        "state": "searching",
        "waitMins": 5,
        "zone": "downtown_sf",
        "startTime": datetime.utcnow(),
        "partner": None
    }
    
    return offer_data

# Job & Tracking Models
class JobAddress(BaseModel):
    line1: str
    lat: float
    lng: float

class JobPartner(BaseModel):
    id: str
    name: str
    rating: float

class JobResponse(BaseModel):
    bookingId: str
    status: str
    serviceType: str
    address: JobAddress
    partner: JobPartner
    etaMinutes: int
    routePolyline: str
    requiredPhotos: dict

class LocationUpdateRequest(BaseModel):
    lat: float
    lng: float
    heading: float
    speed: float

class ArrivedRequest(BaseModel):
    timestamp: str

class StartVerificationRequest(BaseModel):
    method: str  # face|biometric

class StartVerificationResponse(BaseModel):
    sessionId: str
    expiresAt: str

class CompleteVerificationRequest(BaseModel):
    sessionId: str
    result: str  # success|fail
    evidenceId: str

class CompleteVerificationResponse(BaseModel):
    verified: bool

class PresignRequest(BaseModel):
    contentType: str  # image/jpeg|image/png

class PresignResponse(BaseModel):
    uploadUrl: str
    fileId: str

class AddPhotosRequest(BaseModel):
    type: str  # before|after
    fileIds: List[str]

class AddPhotosResponse(BaseModel):
    ok: bool
    counts: dict

class PauseJobRequest(BaseModel):
    reason: str

class JobStatusResponse(BaseModel):
    ok: bool
    status: str

class StartJobRequest(BaseModel):
    verified: bool

class CompleteJobRequest(BaseModel):
    notes: Optional[str] = None

class ApproveCompletionResponse(BaseModel):
    ok: bool
    status: str

class RaiseIssueRequest(BaseModel):
    reason: str
    photoIds: List[str]

class RaiseIssueResponse(BaseModel):
    ok: bool
    ticketId: str

class MaskedCallRequest(BaseModel):
    bookingId: str
    to: str  # customer|partner

class MaskedCallResponse(BaseModel):
    callId: str
    proxyNumber: str

class ChatMessage(BaseModel):
    id: str
    from_: str = Field(alias="from")
    text: str
    timestamp: str

class ChatResponse(BaseModel):
    messages: List[ChatMessage]

class CaptureRequest(BaseModel):
    paymentIntentId: str
    amount: float

class CaptureResponse(BaseModel):
    ok: bool

class SOSRequest(BaseModel):
    bookingId: str
    lat: float
    lng: float
    role: str  # customer|partner

# In-memory job state (in production, use Redis/database)
job_states = {}  # bookingId -> job_data
job_photos = {}  # bookingId -> {before: [], after: []}
job_chat = {}  # bookingId -> [messages]

# Job & Tracking API Endpoints
@api_router.get("/jobs/{booking_id}", response_model=JobResponse)
async def get_job(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get job details and current status"""
    
    # Initialize job if not exists (from booking)
    if booking_id not in job_states:
        # Get booking data
        booking = await db.bookings.find_one({"booking_id": booking_id})
        if not booking:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Get service type from booking data
        service_data = booking.get("service", {})
        service_type = service_data.get("serviceType") or service_data.get("type", "basic")
        
        # Initialize job state
        job_states[booking_id] = {
            "bookingId": booking_id,
            "status": "enroute",
            "serviceType": service_type,
            "address": {
                "line1": booking["address"]["line1"],
                "lat": booking["address"]["lat"],
                "lng": booking["address"]["lng"]
            },
            "partner": {
                "id": booking.get("partnerId", "partner_123"),
                "name": booking.get("partnerName", "Alex M."),
                "rating": 4.8
            },
            "etaMinutes": 15,
            "routePolyline": "encoded_polyline_mock",
            "requiredPhotos": {
                "before": 2 if service_type in ["deep", "bathroom"] else 1,
                "after": 2
            },
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        # Initialize photo tracking
        job_photos[booking_id] = {"before": [], "after": []}
        job_chat[booking_id] = []
    
    job_data = job_states[booking_id]
    
    return JobResponse(
        bookingId=job_data["bookingId"],
        status=job_data["status"],
        serviceType=job_data["serviceType"],
        address=JobAddress(**job_data["address"]),
        partner=JobPartner(**job_data["partner"]),
        etaMinutes=job_data["etaMinutes"],
        routePolyline=job_data["routePolyline"],
        requiredPhotos=job_data["requiredPhotos"]
    )

@api_router.post("/jobs/{booking_id}/location", response_model=JobStatusResponse)
async def update_location(
    booking_id: str,
    request: LocationUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Update partner location (for real-time tracking)"""
    
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    if booking_id not in job_states:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data = job_states[booking_id]
    job_data["partnerLocation"] = {
        "lat": request.lat,
        "lng": request.lng,
        "heading": request.heading,
        "speed": request.speed,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Update ETA based on distance (mock calculation)
    job_data["etaMinutes"] = max(1, job_data["etaMinutes"] - 1)
    job_data["updatedAt"] = datetime.utcnow()
    
    return JobStatusResponse(ok=True, status=job_data["status"])

@api_router.post("/jobs/{booking_id}/arrived", response_model=JobStatusResponse)
async def mark_arrived(
    booking_id: str,
    request: ArrivedRequest,
    current_user: User = Depends(get_current_user)
):
    """Mark partner as arrived at job location"""
    
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    if booking_id not in job_states:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data = job_states[booking_id]
    job_data["status"] = "arrived"
    job_data["arrivedAt"] = request.timestamp
    job_data["updatedAt"] = datetime.utcnow()
    
    return JobStatusResponse(ok=True, status="arrived")

@api_router.post("/jobs/{booking_id}/verify/start", response_model=StartVerificationResponse)
async def start_verification(
    booking_id: str,
    request: StartVerificationRequest,
    current_user: User = Depends(get_current_user)
):
    """Start partner verification (face/biometric)"""
    
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    if booking_id not in job_states:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Mock verification session
    session_id = f"vs_{secrets.token_urlsafe(16)}"
    expires_at = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
    
    job_data = job_states[booking_id]
    job_data["verificationSession"] = {
        "sessionId": session_id,
        "method": request.method,
        "expiresAt": expires_at,
        "status": "pending"
    }
    
    return StartVerificationResponse(
        sessionId=session_id,
        expiresAt=expires_at
    )

@api_router.post("/jobs/{booking_id}/verify/complete", response_model=CompleteVerificationResponse)
async def complete_verification(
    booking_id: str,
    request: CompleteVerificationRequest,
    current_user: User = Depends(get_current_user)
):
    """Complete partner verification"""
    
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    if booking_id not in job_states:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data = job_states[booking_id]
    verification = job_data.get("verificationSession", {})
    
    if verification.get("sessionId") != request.sessionId:
        raise HTTPException(status_code=400, detail="Invalid session")
    
    # Mock verification result (90% success rate)
    verified = request.result == "success" and hash(request.evidenceId) % 10 != 0
    
    verification["status"] = "success" if verified else "failed"
    verification["result"] = request.result
    verification["evidenceId"] = request.evidenceId
    verification["completedAt"] = datetime.utcnow().isoformat()
    
    if verified:
        job_data["status"] = "verifying_start"
        job_data["verified"] = True
    
    return CompleteVerificationResponse(verified=verified)

@api_router.post("/media/presign", response_model=PresignResponse)
async def get_presigned_url(
    request: PresignRequest,
    current_user: User = Depends(get_current_user)
):
    """Get presigned URL for photo upload"""
    
    # Mock presigned URL (in production, use S3/GCS)
    file_id = f"img_{secrets.token_urlsafe(16)}"
    upload_url = f"https://mock-storage.example.com/upload/{file_id}?signature=mock"
    
    return PresignResponse(
        uploadUrl=upload_url,
        fileId=file_id
    )

@api_router.post("/jobs/{booking_id}/photos", response_model=AddPhotosResponse)
async def add_photos(
    booking_id: str,
    request: AddPhotosRequest,
    current_user: User = Depends(get_current_user)
):
    """Add before/after photos to job"""
    
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    if booking_id not in job_photos:
        job_photos[booking_id] = {"before": [], "after": []}
    
    photos = job_photos[booking_id]
    
    if request.type == "before":
        photos["before"].extend(request.fileIds)
    elif request.type == "after":
        photos["after"].extend(request.fileIds)
    
    # Update job status based on photo requirements
    job_data = job_states.get(booking_id, {})
    required_before = job_data.get("requiredPhotos", {}).get("before", 1)
    
    if request.type == "before" and len(photos["before"]) >= required_before:
        job_data["canStart"] = job_data.get("verified", False)
    
    return AddPhotosResponse(
        ok=True,
        counts={
            "before": len(photos["before"]),
            "after": len(photos["after"])
        }
    )

@api_router.post("/jobs/{booking_id}/start", response_model=JobStatusResponse)
async def start_job(
    booking_id: str,
    request: StartJobRequest,
    current_user: User = Depends(get_current_user)
):
    """Start the job (after verification and photos)"""
    
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    if booking_id not in job_states:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data = job_states[booking_id]
    photos = job_photos.get(booking_id, {})
    
    # Validate requirements
    if not request.verified:
        raise HTTPException(status_code=400, detail="Verification required")
    
    required_before = job_data.get("requiredPhotos", {}).get("before", 1)
    if len(photos.get("before", [])) < required_before:
        raise HTTPException(status_code=400, detail=f"Minimum {required_before} before photos required")
    
    job_data["status"] = "in_progress"
    job_data["startedAt"] = datetime.utcnow().isoformat()
    job_data["updatedAt"] = datetime.utcnow()
    
    return JobStatusResponse(ok=True, status="in_progress")

@api_router.post("/jobs/{booking_id}/pause", response_model=JobStatusResponse)
async def pause_job(
    booking_id: str,
    request: PauseJobRequest,
    current_user: User = Depends(get_current_user)
):
    """Pause the job with reason"""
    
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    if booking_id not in job_states:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data = job_states[booking_id]
    job_data["status"] = "paused"
    job_data["pausedAt"] = datetime.utcnow().isoformat()
    job_data["pauseReason"] = request.reason
    job_data["updatedAt"] = datetime.utcnow()
    
    return JobStatusResponse(ok=True, status="paused")

@api_router.post("/jobs/{booking_id}/resume", response_model=JobStatusResponse)
async def resume_job(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Resume paused job"""
    
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    if booking_id not in job_states:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data = job_states[booking_id]
    job_data["status"] = "in_progress"
    job_data["resumedAt"] = datetime.utcnow().isoformat()
    job_data["updatedAt"] = datetime.utcnow()
    
    return JobStatusResponse(ok=True, status="in_progress")

@api_router.post("/jobs/{booking_id}/complete", response_model=JobStatusResponse)
async def complete_job(
    booking_id: str,
    request: CompleteJobRequest,
    current_user: User = Depends(get_current_user)
):
    """Complete the job (partner side)"""
    
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    if booking_id not in job_states:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data = job_states[booking_id]
    photos = job_photos.get(booking_id, {})
    
    # Validate after photos
    required_after = job_data.get("requiredPhotos", {}).get("after", 2)
    if len(photos.get("after", [])) < required_after:
        raise HTTPException(status_code=400, detail=f"Minimum {required_after} after photos required")
    
    job_data["status"] = "awaiting_customer_review"
    job_data["completedAt"] = datetime.utcnow().isoformat()
    job_data["partnerNotes"] = request.notes
    job_data["updatedAt"] = datetime.utcnow()
    
    return JobStatusResponse(ok=True, status="awaiting_customer_review")

@api_router.post("/jobs/{booking_id}/approve", response_model=ApproveCompletionResponse)
async def approve_completion(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Customer approves job completion"""
    
    if current_user.role != "customer":
        raise HTTPException(status_code=403, detail="Customer access required")
    
    if booking_id not in job_states:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data = job_states[booking_id]
    job_data["status"] = "completed"
    job_data["approvedAt"] = datetime.utcnow().isoformat()
    job_data["updatedAt"] = datetime.utcnow()
    
    return ApproveCompletionResponse(ok=True, status="completed")

@api_router.post("/jobs/{booking_id}/issue", response_model=RaiseIssueResponse)
async def raise_issue(
    booking_id: str,
    request: RaiseIssueRequest,
    current_user: User = Depends(get_current_user)
):
    """Customer raises an issue with job completion"""
    
    if current_user.role != "customer":
        raise HTTPException(status_code=403, detail="Customer access required")
    
    # Create support ticket
    ticket_id = f"sup_{secrets.token_urlsafe(16)}"
    
    # Store issue data
    job_data = job_states.get(booking_id, {})
    job_data["issue"] = {
        "ticketId": ticket_id,
        "reason": request.reason,
        "photoIds": request.photoIds,
        "reportedAt": datetime.utcnow().isoformat()
    }
    job_data["status"] = "disputed"
    
    return RaiseIssueResponse(ok=True, ticketId=ticket_id)

# Communication APIs (Mock implementations)
@api_router.post("/comm/call", response_model=MaskedCallResponse)
async def initiate_masked_call(
    request: MaskedCallRequest,
    current_user: User = Depends(get_current_user)
):
    """Initiate masked call between customer and partner"""
    
    call_id = f"call_{secrets.token_urlsafe(16)}"
    proxy_number = "+1-555-0123"  # Mock proxy number
    
    return MaskedCallResponse(
        callId=call_id,
        proxyNumber=proxy_number
    )

@api_router.get("/comm/chat/{booking_id}", response_model=ChatResponse)
async def get_chat_messages(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get chat messages for a job"""
    
    messages = job_chat.get(booking_id, [])
    
    return ChatResponse(messages=[
        ChatMessage(
            id=msg["id"],
            **{"from": msg["from"]},
            text=msg["text"],
            timestamp=msg["timestamp"]
        ) for msg in messages
    ])

@api_router.post("/comm/chat/{booking_id}")
async def send_chat_message(
    booking_id: str,
    message_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Send chat message"""
    
    if booking_id not in job_chat:
        job_chat[booking_id] = []
    
    message = {
        "id": f"msg_{secrets.token_urlsafe(8)}",
        "from": current_user.role,
        "text": message_data.get("text", ""),
        "timestamp": datetime.utcnow().isoformat()
    }
    
    job_chat[booking_id].append(message)
    
    return {"ok": True, "messageId": message["id"]}

# Payment Capture APIs
@api_router.post("/billing/capture/start", response_model=CaptureResponse)
async def capture_at_start(request: CaptureRequest):
    """Capture payment at job start"""
    
    # Mock payment capture
    return CaptureResponse(ok=True)

@api_router.post("/billing/capture/finish", response_model=CaptureResponse)
async def capture_at_finish(request: CaptureRequest):
    """Capture final payment at job completion"""
    
    # Mock payment capture
    return CaptureResponse(ok=True)

# SOS API
@api_router.post("/support/sos", response_model=CaptureResponse)
async def emergency_sos(
    request: SOSRequest,
    current_user: User = Depends(get_current_user)
):
    """Emergency SOS support request"""
    
    # Mock SOS handling - in production, would alert support team
    return CaptureResponse(ok=True)

# Rating & Tip Models
class CustomerInfo(BaseModel):
    id: str
    name: str

class RatingPartnerInfo(BaseModel):
    id: str
    name: str

class RatingContext(BaseModel):
    bookingId: str
    total: float
    currency: str
    partner: RatingPartnerInfo
    customer: CustomerInfo
    eligibleTipPresets: List[float]
    alreadyRated: dict

class TipInfo(BaseModel):
    amount: float
    currency: str

class CustomerRatingRequest(BaseModel):
    bookingId: str
    stars: int
    compliments: List[str]
    comment: Optional[str] = None
    tip: Optional[TipInfo] = None
    idempotencyKey: str

class TipCaptureInfo(BaseModel):
    ok: bool
    paymentIntentId: str

class CustomerRatingResponse(BaseModel):
    ok: bool
    tipCapture: TipCaptureInfo

class PartnerRatingRequest(BaseModel):
    bookingId: str
    stars: int
    notes: List[str]
    comment: Optional[str] = None
    idempotencyKey: str

class PartnerRatingResponse(BaseModel):
    ok: bool

class TipCaptureRequest(BaseModel):
    bookingId: str
    amount: float
    currency: str

class TipCaptureResponse(BaseModel):
    ok: bool
    paymentIntentId: str

class RatingItem(BaseModel):
    bookingId: str
    partnerRating: float
    customerRating: float
    tip: float
    flags: List[str]

class OwnerRatingsResponse(BaseModel):
    items: List[RatingItem]

# In-memory rating storage (in production, use database)
ratings_data = {}  # bookingId -> {customer_rating: {...}, partner_rating: {...}}

# Rating & Tip API Endpoints
@api_router.get("/ratings/context/{booking_id}", response_model=RatingContext)
async def get_rating_context(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get rating context for a completed booking"""
    
    # Get booking data
    booking = await db.bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if already rated
    existing_ratings = ratings_data.get(booking_id, {})
    already_rated = {
        "customer": "customer_rating" in existing_ratings,
        "partner": "partner_rating" in existing_ratings
    }
    
    # Get total amount from booking
    total = booking.get("totals", {}).get("total", 100.0)
    currency = booking.get("totals", {}).get("currency", "usd")
    
    # Mock partner and customer info
    partner_info = RatingPartnerInfo(
        id=booking.get("partnerId", "partner_123"),
        name=booking.get("partnerName", "Alex M.")
    )
    
    customer_info = CustomerInfo(
        id=current_user.id,
        name=current_user.email.split('@')[0].title()
    )
    
    # Calculate tip presets (percentages of total)
    tip_presets = [0, round(total * 0.15, 2), round(total * 0.18, 2), round(total * 0.20, 2), round(total * 0.25, 2)]
    
    return RatingContext(
        bookingId=booking_id,
        total=total,
        currency=currency,
        partner=partner_info,
        customer=customer_info,
        eligibleTipPresets=tip_presets,
        alreadyRated=already_rated
    )

@api_router.post("/ratings/customer", response_model=CustomerRatingResponse)
async def submit_customer_rating(
    request: CustomerRatingRequest,
    current_user: User = Depends(get_current_user)
):
    """Submit customer rating and optional tip"""
    
    if current_user.role != "customer":
        raise HTTPException(status_code=403, detail="Customer access required")
    
    # Check for duplicate submission
    if request.bookingId in ratings_data:
        existing = ratings_data[request.bookingId]
        if "customer_rating" in existing:
            # Check idempotency
            if existing["customer_rating"].get("idempotencyKey") == request.idempotencyKey:
                # Return existing response
                return CustomerRatingResponse(
                    ok=True,
                    tipCapture=TipCaptureInfo(ok=True, paymentIntentId=existing["customer_rating"].get("tipPaymentIntentId", ""))
                )
            else:
                raise HTTPException(status_code=409, detail="Already rated")
    
    # Validate star rating
    if not (1 <= request.stars <= 5):
        raise HTTPException(status_code=400, detail="Stars must be between 1 and 5")
    
    # Process tip if provided
    tip_payment_intent_id = ""
    tip_capture_success = True
    
    if request.tip and request.tip.amount > 0:
        # Mock tip capture (in production, integrate with Stripe)
        tip_payment_intent_id = f"pi_tip_{secrets.token_urlsafe(16)}"
        
        # Simulate payment failure for testing (5% failure rate)
        if hash(request.idempotencyKey) % 20 == 0:
            tip_capture_success = False
            raise HTTPException(status_code=402, detail="Tip payment declined")
    
    # Store rating
    if request.bookingId not in ratings_data:
        ratings_data[request.bookingId] = {}
    
    ratings_data[request.bookingId]["customer_rating"] = {
        "stars": request.stars,
        "compliments": request.compliments,
        "comment": request.comment,
        "tip": request.tip.dict() if request.tip else None,
        "idempotencyKey": request.idempotencyKey,
        "tipPaymentIntentId": tip_payment_intent_id,
        "submittedAt": datetime.utcnow().isoformat(),
        "userId": current_user.id
    }
    
    return CustomerRatingResponse(
        ok=True,
        tipCapture=TipCaptureInfo(
            ok=tip_capture_success,
            paymentIntentId=tip_payment_intent_id
        )
    )

@api_router.post("/ratings/partner", response_model=PartnerRatingResponse)
async def submit_partner_rating(
    request: PartnerRatingRequest,
    current_user: User = Depends(get_current_user)
):
    """Submit partner rating for customer"""
    
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    # Check for duplicate submission
    if request.bookingId in ratings_data:
        existing = ratings_data[request.bookingId]
        if "partner_rating" in existing:
            # Check idempotency
            if existing["partner_rating"].get("idempotencyKey") == request.idempotencyKey:
                # Return existing response
                return PartnerRatingResponse(ok=True)
            else:
                raise HTTPException(status_code=409, detail="Already rated")
    
    # Validate star rating
    if not (1 <= request.stars <= 5):
        raise HTTPException(status_code=400, detail="Stars must be between 1 and 5")
    
    # Store rating
    if request.bookingId not in ratings_data:
        ratings_data[request.bookingId] = {}
    
    ratings_data[request.bookingId]["partner_rating"] = {
        "stars": request.stars,
        "notes": request.notes,
        "comment": request.comment,
        "idempotencyKey": request.idempotencyKey,
        "submittedAt": datetime.utcnow().isoformat(),
        "userId": current_user.id
    }
    
    return PartnerRatingResponse(ok=True)

@api_router.post("/billing/tip", response_model=TipCaptureResponse)
async def capture_tip(
    request: TipCaptureRequest,
    current_user: User = Depends(get_current_user)
):
    """Capture tip payment separately"""
    
    if current_user.role != "customer":
        raise HTTPException(status_code=403, detail="Customer access required")
    
    # Mock tip capture
    payment_intent_id = f"pi_tip_{secrets.token_urlsafe(16)}"
    
    # Simulate payment failure for testing
    if request.amount > 50:  # Large tips more likely to fail
        raise HTTPException(status_code=402, detail="Tip card declined")
    
    return TipCaptureResponse(
        ok=True,
        paymentIntentId=payment_intent_id
    )

@api_router.get("/owner/ratings", response_model=OwnerRatingsResponse)
async def get_owner_ratings_dashboard(current_user: User = Depends(get_current_user)):
    """Get owner ratings dashboard"""
    
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    
    # Process ratings data for dashboard
    items = []
    
    for booking_id, rating_data in ratings_data.items():
        customer_rating = rating_data.get("customer_rating", {})
        partner_rating = rating_data.get("partner_rating", {})
        
        # Calculate metrics
        customer_stars = customer_rating.get("stars", 0)
        partner_stars = partner_rating.get("stars", 0)
        tip_amount = customer_rating.get("tip", {}).get("amount", 0)
        
        # Determine flags
        flags = []
        if customer_stars <= 2:
            flags.append("low_customer_rating")
        if partner_stars <= 2:
            flags.append("low_partner_rating")
        if tip_amount > 20:
            flags.append("high_tip")
        if customer_rating.get("comment") and len(customer_rating["comment"]) > 100:
            flags.append("detailed_feedback")
        
        items.append(RatingItem(
            bookingId=booking_id,
            partnerRating=float(partner_stars),
            customerRating=float(customer_stars),
            tip=float(tip_amount),
            flags=flags
        ))
    
    # Sort by most recent (mock - in production use timestamps)
    items = sorted(items, key=lambda x: x.bookingId, reverse=True)[:20]
    
    return OwnerRatingsResponse(items=items)

# ================================================================================================
# PAGE-9-EARNINGS: Partner Earnings & Payouts System (Uber-like)
# ================================================================================================

# Earnings & Payouts Models
class EarningsSummaryResponse(BaseModel):
    currency: str
    thisWeek: dict  # amount, jobs
    tipsYtd: float
    availableBalance: float

class EarningsSeriesPoint(BaseModel):
    date: str  # ISO format
    earnings: float
    tips: float

class EarningsSeriesResponse(BaseModel):
    points: List[EarningsSeriesPoint]

class StatementItem(BaseModel):
    id: str
    weekLabel: str
    amount: float
    trips: int
    status: str  # finalized|pending
    payoutDate: str  # ISO format

class StatementsListResponse(BaseModel):
    items: List[StatementItem]
    nextPage: Optional[int] = None

class JobLineItem(BaseModel):
    bookingId: str
    date: str  # ISO format
    service: str
    duration: int  # minutes
    payout: float
    tip: float

class StatementDetail(BaseModel):
    id: str
    period: dict  # from, to ISO dates
    currency: str
    gross: float
    tips: float
    surge: float
    adjustments: float
    fees: float
    taxWithheld: float
    net: float
    jobs: List[JobLineItem]

class StatementPdfResponse(BaseModel):
    url: str

class ExportRequest(BaseModel):
    fromDate: str  # ISO format
    toDate: str  # ISO format
    serviceType: str = "all"

class ExportResponse(BaseModel):
    jobId: str
    status: str  # queued

class ExportStatusResponse(BaseModel):
    status: str  # queued|ready|error
    url: Optional[str] = None

class PayoutItem(BaseModel):
    id: str
    date: str  # ISO format
    amount: float
    status: str  # in_transit|paid|failed
    destination: str  # masked bank info

class PayoutsListResponse(BaseModel):
    items: List[PayoutItem]

class InstantPayoutRequest(BaseModel):
    amount: float
    currency: str = "usd"
    idempotencyKey: str

class InstantPayoutResponse(BaseModel):
    payoutId: str
    fee: float
    status: str  # in_transit

class BankOnboardRequest(BaseModel):
    returnUrl: str

class BankOnboardResponse(BaseModel):
    url: str

class BankStatusResponse(BaseModel):
    verified: bool
    bankLast4: Optional[str] = None

class TaxContextResponse(BaseModel):
    status: str  # complete|incomplete
    availableForms: List[str]
    year: int

class TaxOnboardRequest(BaseModel):
    returnUrl: str

class TaxOnboardResponse(BaseModel):
    url: str

class TaxFormResponse(BaseModel):
    url: str

class NotificationPrefsResponse(BaseModel):
    payouts: bool
    statements: bool
    tax: bool

class NotificationPrefsRequest(BaseModel):
    payouts: bool
    statements: bool
    tax: bool

# In-memory storage for earnings data (in production, use database)
partner_earnings_data = {}
export_jobs = {}
payout_history = {}
bank_accounts = {}
tax_info = {}
notification_prefs = {}

# Helper function to get partner earnings summary
def get_partner_earnings_summary(booking_id: str, partner_id: str):
    """Get partner earnings summary including tips"""
    
    # Get booking data
    base_amount = 45.0  # Mock base payout
    surge_multiplier = 1.0  # Mock surge
    adjustments = 0.0  # Mock adjustments
    
    # Get tip from rating
    tip_amount = 0.0
    if booking_id in ratings_data:
        customer_rating = ratings_data[booking_id].get("customer_rating", {})
        tip_amount = customer_rating.get("tip", {}).get("amount", 0)
    
    total = base_amount * surge_multiplier + adjustments + tip_amount
    
    return {
        "base": base_amount,
        "surge": base_amount * (surge_multiplier - 1) if surge_multiplier > 1 else 0,
        "adjustments": adjustments,
        "tip": tip_amount,
        "total": total,
        "currency": "usd"
    }

def generate_earnings_data(partner_id: str):
    """Generate mock earnings data for partner"""
    if partner_id not in partner_earnings_data:
        # Generate mock data for past 12 weeks
        weeks_data = []
        total_tips_ytd = 0
        available_balance = 0
        
        for i in range(12):
            week_earnings = random.uniform(200, 800)
            week_tips = random.uniform(50, 200)
            jobs_count = random.randint(8, 25)
            
            weeks_data.append({
                "week": i + 1,
                "earnings": week_earnings,
                "tips": week_tips,
                "jobs": jobs_count,
                "date": (datetime.utcnow() - timedelta(weeks=11-i)).isoformat()
            })
            
            total_tips_ytd += week_tips
            if i >= 10:  # Last 2 weeks available for payout
                available_balance += week_earnings + week_tips
        
        partner_earnings_data[partner_id] = {
            "weeks": weeks_data,
            "tips_ytd": total_tips_ytd,
            "available_balance": available_balance
        }
    
    return partner_earnings_data[partner_id]

# Partner Earnings API Endpoints
@api_router.get("/partner/earnings/summary", response_model=EarningsSummaryResponse)
async def get_earnings_summary(current_user: User = Depends(get_current_user)):
    """Get partner earnings summary"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    earnings_data = generate_earnings_data(current_user.id)
    current_week = earnings_data["weeks"][-1]
    
    return EarningsSummaryResponse(
        currency="usd",
        thisWeek={
            "amount": current_week["earnings"] + current_week["tips"],
            "jobs": current_week["jobs"]
        },
        tipsYtd=earnings_data["tips_ytd"],
        availableBalance=earnings_data["available_balance"]
    )

@api_router.get("/partner/earnings/series", response_model=EarningsSeriesResponse)
async def get_earnings_series(
    fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None),
    bucket: str = Query("week", regex="^(day|week)$"),
    current_user: User = Depends(get_current_user)
):
    """Get earnings series data for charts"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    earnings_data = generate_earnings_data(current_user.id)
    
    # Return weekly data points
    points = []
    for week_data in earnings_data["weeks"]:
        points.append(EarningsSeriesPoint(
            date=week_data["date"],
            earnings=week_data["earnings"],
            tips=week_data["tips"]
        ))
    
    return EarningsSeriesResponse(points=points)

@api_router.get("/partner/earnings/statements", response_model=StatementsListResponse)
async def list_statements(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user)
):
    """List partner earnings statements"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    earnings_data = generate_earnings_data(current_user.id)
    
    # Generate mock statements
    statements = []
    for i, week_data in enumerate(earnings_data["weeks"]):
        statement_id = f"st_{current_user.id}_{i:02d}"
        week_start = datetime.fromisoformat(week_data["date"].replace('Z', '+00:00'))
        week_label = f"Week {week_start.strftime('%b %d')} - {(week_start + timedelta(days=6)).strftime('%b %d')}"
        
        statements.append(StatementItem(
            id=statement_id,
            weekLabel=week_label,
            amount=week_data["earnings"] + week_data["tips"],
            trips=week_data["jobs"],
            status="finalized" if i < 11 else "pending",
            payoutDate=(week_start + timedelta(days=7)).isoformat()
        ))
    
    # Reverse to show most recent first
    statements.reverse()
    
    # Pagination
    start_idx = (page - 1) * size
    end_idx = start_idx + size
    page_statements = statements[start_idx:end_idx]
    
    next_page = page + 1 if end_idx < len(statements) else None
    
    return StatementsListResponse(
        items=page_statements,
        nextPage=next_page
    )

@api_router.get("/partner/earnings/statements/{statement_id}", response_model=StatementDetail)
async def get_statement_detail(
    statement_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get detailed statement information"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    # Parse statement ID to get week index
    try:
        week_idx = int(statement_id.split('_')[-1])
    except:
        raise HTTPException(status_code=404, detail="Statement not found")
    
    earnings_data = generate_earnings_data(current_user.id)
    
    if week_idx >= len(earnings_data["weeks"]):
        raise HTTPException(status_code=404, detail="Statement not found")
    
    week_data = earnings_data["weeks"][week_idx]
    week_start = datetime.fromisoformat(week_data["date"].replace('Z', '+00:00'))
    
    # Generate mock job line items
    jobs = []
    for j in range(week_data["jobs"]):
        job_date = week_start + timedelta(days=random.randint(0, 6))
        service_types = ["Cleaning", "Lawn Care", "Snow Removal", "Dog Walking", "Beauty", "Baby Care"]
        
        jobs.append(JobLineItem(
            bookingId=f"bk_{secrets.token_urlsafe(8)}",
            date=job_date.isoformat(),
            service=random.choice(service_types),
            duration=random.randint(30, 180),
            payout=random.uniform(15, 80),
            tip=random.uniform(0, 25)
        ))
    
    gross = week_data["earnings"] + week_data["tips"]
    fees = gross * 0.15  # 15% platform fee
    tax_withheld = gross * 0.1  # 10% tax withheld
    net = gross - fees - tax_withheld
    
    return StatementDetail(
        id=statement_id,
        period={
            "from": week_start.isoformat(),
            "to": (week_start + timedelta(days=6)).isoformat()
        },
        currency="usd",
        gross=gross,
        tips=week_data["tips"],
        surge=week_data["earnings"] * 0.1,  # 10% surge
        adjustments=0.0,
        fees=fees,
        taxWithheld=tax_withheld,
        net=net,
        jobs=jobs
    )

@api_router.get("/partner/earnings/statements/{statement_id}/pdf", response_model=StatementPdfResponse)
async def download_statement_pdf(
    statement_id: str,
    current_user: User = Depends(get_current_user)
):
    """Generate PDF download URL for statement"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    # Mock PDF URL - in production, generate actual PDF
    pdf_url = f"https://statements.shine.com/pdf/{statement_id}.pdf?token={secrets.token_urlsafe(32)}"
    
    return StatementPdfResponse(url=pdf_url)

@api_router.post("/partner/earnings/export", response_model=ExportResponse)
async def request_export(
    request: ExportRequest,
    current_user: User = Depends(get_current_user)
):
    """Request CSV export of earnings data"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    # Validate date range
    try:
        from_date = datetime.fromisoformat(request.fromDate.replace('Z', '+00:00'))
        to_date = datetime.fromisoformat(request.toDate.replace('Z', '+00:00'))
        
        if (to_date - from_date).days > 90:
            raise HTTPException(status_code=400, detail="Date range cannot exceed 90 days")
            
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Create export job
    job_id = f"exp_{secrets.token_urlsafe(16)}"
    export_jobs[job_id] = {
        "partnerId": current_user.id,
        "status": "queued",
        "fromDate": request.fromDate,
        "toDate": request.toDate,
        "serviceType": request.serviceType,
        "createdAt": datetime.utcnow().isoformat()
    }
    
    return ExportResponse(jobId=job_id, status="queued")

@api_router.get("/partner/earnings/export/{job_id}", response_model=ExportStatusResponse)
async def get_export_status(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get export job status"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    if job_id not in export_jobs:
        raise HTTPException(status_code=404, detail="Export job not found")
    
    job = export_jobs[job_id]
    if job["partnerId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Mock processing - in production, check actual job status
    created_at = datetime.fromisoformat(job["createdAt"].replace('Z', '+00:00'))
    if (datetime.utcnow() - created_at).seconds > 30:  # 30 seconds processing time
        job["status"] = "ready"
        job["url"] = f"https://exports.shine.com/csv/{job_id}.csv?token={secrets.token_urlsafe(32)}"
    
    return ExportStatusResponse(
        status=job["status"],
        url=job.get("url")
    )

# Payout Management APIs
@api_router.get("/partner/payouts", response_model=PayoutsListResponse)
async def list_payouts(current_user: User = Depends(get_current_user)):
    """List partner payout history"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    # Generate mock payout history
    if current_user.id not in payout_history:
        payouts = []
        for i in range(8):
            payout_date = datetime.utcnow() - timedelta(weeks=i)
            amount = random.uniform(300, 1200)
            
            payouts.append(PayoutItem(
                id=f"po_{secrets.token_urlsafe(16)}",
                date=payout_date.isoformat(),
                amount=amount,
                status=random.choice(["paid", "in_transit"]) if i > 0 else "paid",
                destination="Bank ****1234"
            ))
        
        payout_history[current_user.id] = payouts
    
    return PayoutsListResponse(items=payout_history[current_user.id])

@api_router.post("/partner/payouts/instant", response_model=InstantPayoutResponse)
async def instant_payout(
    request: InstantPayoutRequest,
    current_user: User = Depends(get_current_user)
):
    """Process instant payout"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    # Check bank verification
    bank_info = bank_accounts.get(current_user.id, {"verified": False})
    if not bank_info["verified"]:
        raise HTTPException(status_code=409, detail="Bank account not verified")
    
    # Check minimum amount
    if request.amount < 1.0:
        raise HTTPException(status_code=400, detail="Below minimum amount ($1.00)")
    
    # Check available balance
    earnings_data = generate_earnings_data(current_user.id)
    if request.amount > earnings_data["available_balance"]:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Calculate fee
    fee_percent = 1.5  # 1.5% fee
    min_fee = 0.50
    fee = max(min_fee, request.amount * fee_percent / 100)
    
    # Mock payout failure for large amounts (testing)
    if request.amount > 500:
        raise HTTPException(status_code=402, detail="Payout failed - high amount detected")
    
    # Create payout
    payout_id = f"po_{secrets.token_urlsafe(16)}"
    
    # Update balance
    earnings_data["available_balance"] -= request.amount
    
    # Add to history
    if current_user.id not in payout_history:
        payout_history[current_user.id] = []
    
    payout_history[current_user.id].insert(0, PayoutItem(
        id=payout_id,
        date=datetime.utcnow().isoformat(),
        amount=request.amount,
        status="in_transit",
        destination="Bank ****1234"
    ))
    
    return InstantPayoutResponse(
        payoutId=payout_id,
        fee=fee,
        status="in_transit"
    )

# Bank Account Management APIs
@api_router.post("/partner/bank/onboard", response_model=BankOnboardResponse)
async def onboard_bank_account(
    request: BankOnboardRequest,
    current_user: User = Depends(get_current_user)
):
    """Start bank account onboarding process"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    # Mock Stripe Connect onboarding URL
    onboard_url = f"https://connect.stripe.com/setup/e/{secrets.token_urlsafe(32)}?return_url={request.returnUrl}"
    
    return BankOnboardResponse(url=onboard_url)

@api_router.get("/partner/bank/status", response_model=BankStatusResponse)
async def get_bank_status(current_user: User = Depends(get_current_user)):
    """Get bank account verification status"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    # Initialize bank info if not exists
    if current_user.id not in bank_accounts:
        bank_accounts[current_user.id] = {
            "verified": random.choice([True, False]),  # Random for demo
            "bankLast4": "1234" if random.choice([True, False]) else None
        }
    
    bank_info = bank_accounts[current_user.id]
    
    return BankStatusResponse(
        verified=bank_info["verified"],
        bankLast4=bank_info["bankLast4"]
    )

# Tax Management APIs
@api_router.get("/partner/tax/context", response_model=TaxContextResponse)
async def get_tax_context(current_user: User = Depends(get_current_user)):
    """Get tax information context"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    # Mock tax info
    current_year = datetime.utcnow().year
    
    return TaxContextResponse(
        status=random.choice(["complete", "incomplete"]),
        availableForms=["1099", "W-9"],
        year=current_year - 1
    )

@api_router.post("/partner/tax/onboard", response_model=TaxOnboardResponse)
async def onboard_tax_info(
    request: TaxOnboardRequest,
    current_user: User = Depends(get_current_user)
):
    """Start tax information onboarding"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    # Mock tax onboarding URL
    tax_url = f"https://tax.stripe.com/setup/{secrets.token_urlsafe(32)}?return_url={request.returnUrl}"
    
    return TaxOnboardResponse(url=tax_url)

@api_router.get("/partner/tax/forms/{form}/{year}", response_model=TaxFormResponse)
async def download_tax_form(
    form: str,
    year: int,
    current_user: User = Depends(get_current_user)
):
    """Download tax form"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    if form not in ["1099", "W-9", "W-8BEN"]:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Mock tax form URL
    form_url = f"https://tax-forms.shine.com/{form}/{year}/{current_user.id}.pdf?token={secrets.token_urlsafe(32)}"
    
    return TaxFormResponse(url=form_url)

# Notification Preferences APIs
@api_router.get("/partner/notifications/prefs", response_model=NotificationPrefsResponse)
async def get_notification_prefs(current_user: User = Depends(get_current_user)):
    """Get notification preferences"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    if current_user.id not in notification_prefs:
        notification_prefs[current_user.id] = {
            "payouts": True,
            "statements": True,
            "tax": True
        }
    
    prefs = notification_prefs[current_user.id]
    
    return NotificationPrefsResponse(
        payouts=prefs["payouts"],
        statements=prefs["statements"],
        tax=prefs["tax"]
    )

@api_router.post("/partner/notifications/prefs", response_model=dict)
async def set_notification_prefs(
    request: NotificationPrefsRequest,
    current_user: User = Depends(get_current_user)
):
    """Set notification preferences"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    notification_prefs[current_user.id] = {
        "payouts": request.payouts,
        "statements": request.statements,
        "tax": request.tax
    }
    
# ================================================================================================
# PAGE-10-SUPPORT: Support & Disputes System (Uber-like Help Center)
# ================================================================================================

# Support & Disputes Models
class FAQItem(BaseModel):
    id: str
    question: str
    answer: str

class FAQListResponse(BaseModel):
    items: List[FAQItem]

class SupportIssue(BaseModel):
    id: str
    role: str  # customer|partner
    category: str
    status: str  # open|progress|closed
    lastUpdate: str  # ISO format

class SupportIssuesList(BaseModel):
    items: List[SupportIssue]

class CreateIssueRequest(BaseModel):
    bookingId: Optional[str] = None
    role: str
    category: str
    description: str
    photoIds: List[str] = []

class CreateIssueResponse(BaseModel):
    id: str
    status: str

class UpdateIssueRequest(BaseModel):
    status: str  # progress|closed
    notes: Optional[str] = None

class RefundRequest(BaseModel):
    bookingId: str
    amount: float
    reason: str

class RefundResponse(BaseModel):
    ok: bool
    creditIssued: bool

class SupportTicket(BaseModel):
    id: str
    user: str
    role: str
    category: str
    status: str
    createdAt: str  # ISO format
    sla: float  # hours

class OwnerQueueResponse(BaseModel):
    tickets: List[SupportTicket]

class OwnerMetricsResponse(BaseModel):
    open: int
    avgSlaHours: float
    escalated: int

class TrainingGuide(BaseModel):
    id: str
    title: str
    description: str
    url: str

class TrainingGuidesResponse(BaseModel):
    items: List[TrainingGuide]

# In-memory storage for support data (in production, use database)
support_faqs = {}
support_issues = {}
support_tickets = {}
training_guides = {}

def initialize_support_data():
    """Initialize mock support data"""
    global support_faqs, training_guides
    
    # Initialize FAQs
    if not support_faqs:
        support_faqs = {
            "faq_001": {
                "id": "faq_001",
                "question": "How do I book a cleaning service?",
                "answer": "You can book a cleaning service by tapping the 'Book Now' button on the home screen, selecting your address, choosing your service type, and confirming payment."
            },
            "faq_002": {
                "id": "faq_002",
                "question": "What payment methods do you accept?",
                "answer": "We accept all major credit cards (Visa, Mastercard, American Express) and debit cards. Payment is processed securely through our platform."
            },
            "faq_003": {
                "id": "faq_003",
                "question": "How do I cancel my booking?",
                "answer": "You can cancel your booking through the app. Cancellations made more than 2 hours before the scheduled time are free. Later cancellations may incur a fee."
            },
            "faq_004": {
                "id": "faq_004",
                "question": "What if I'm not satisfied with the service?",
                "answer": "If you're not satisfied, please report the issue through the app within 24 hours. We'll investigate and may offer a refund or re-service."
            },
            "faq_005": {
                "id": "faq_005",
                "question": "How do I become a partner?",
                "answer": "To become a partner, sign up through the app, complete the verification process, and pass our background checks. Once approved, you can start accepting jobs."
            },
            "faq_006": {
                "id": "faq_006",
                "question": "When do I get paid as a partner?",
                "answer": "Partners are paid weekly for completed jobs. You can also use instant payout for a small fee to get paid immediately."
            },
            "faq_007": {
                "id": "faq_007",
                "question": "How do I contact customer support?",
                "answer": "You can contact customer support through this Help section, or use the emergency SOS feature during active jobs for immediate assistance."
            },
            "faq_008": {
                "id": "faq_008",
                "question": "What areas do you service?",
                "answer": "We currently service major metropolitan areas. Check the app to see if service is available in your location."
            }
        }
    
    # Initialize training guides for partners
    if not training_guides:
        training_guides = {
            "guide_001": {
                "id": "guide_001",
                "title": "Getting Started as a Partner",
                "description": "Learn the basics of using the SHINE partner app and accepting your first jobs.",
                "url": "https://help.shine.com/partner/getting-started"
            },
            "guide_002": {
                "id": "guide_002",
                "title": "Service Quality Standards",
                "description": "Understand our quality standards and how to maintain high customer ratings.",
                "url": "https://help.shine.com/partner/quality-standards"
            },
            "guide_003": {
                "id": "guide_003",
                "title": "Safety Guidelines",
                "description": "Important safety guidelines to follow during service appointments.",
                "url": "https://help.shine.com/partner/safety"
            },
            "guide_004": {
                "id": "guide_004",
                "title": "Payment and Earnings",
                "description": "How payments work, when you get paid, and managing your earnings.",
                "url": "https://help.shine.com/partner/payments"
            },
            "guide_005": {
                "id": "guide_005",
                "title": "Customer Communication",
                "description": "Best practices for communicating with customers before, during, and after service.",
                "url": "https://help.shine.com/partner/communication"
            },
            "guide_006": {
                "id": "guide_006",
                "title": "Dispute Resolution",
                "description": "How to handle disputes and raise concerns about ratings or payments.",
                "url": "https://help.shine.com/partner/disputes"
            }
        }

# Support API Endpoints
@api_router.get("/support/faqs", response_model=FAQListResponse)
async def get_faqs(current_user: User = Depends(get_current_user)):
    """Get list of frequently asked questions"""
    initialize_support_data()
    
    faqs = list(support_faqs.values())
    return FAQListResponse(items=faqs)

@api_router.get("/support/issues", response_model=SupportIssuesList)
async def list_support_issues(current_user: User = Depends(get_current_user)):
    """List user's support issues and disputes"""
    user_issues = []
    
    # Get issues for current user
    for issue_id, issue_data in support_issues.items():
        if issue_data.get("userId") == current_user.id:
            user_issues.append(SupportIssue(
                id=issue_id,
                role=issue_data["role"],
                category=issue_data["category"],
                status=issue_data["status"],
                lastUpdate=issue_data["lastUpdate"]
            ))
    
    # Sort by last update (most recent first)
    user_issues.sort(key=lambda x: x.lastUpdate, reverse=True)
    
    return SupportIssuesList(items=user_issues)

@api_router.post("/support/issues", response_model=CreateIssueResponse)
async def create_support_issue(
    request: CreateIssueRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new support issue or dispute"""
    
    # Check for duplicate issues on same booking
    if request.bookingId:
        for issue_id, issue_data in support_issues.items():
            if (issue_data.get("bookingId") == request.bookingId and 
                issue_data.get("userId") == current_user.id and
                issue_data.get("status") != "closed"):
                raise HTTPException(status_code=409, detail="Issue already exists for this booking")
    
    # Create new issue
    issue_id = f"sup_{secrets.token_urlsafe(16)}"
    issue_data = {
        "id": issue_id,
        "userId": current_user.id,
        "userEmail": current_user.email,
        "bookingId": request.bookingId,
        "role": request.role,
        "category": request.category,
        "description": request.description,
        "photoIds": request.photoIds,
        "status": "open",
        "createdAt": datetime.utcnow().isoformat(),
        "lastUpdate": datetime.utcnow().isoformat()
    }
    
    support_issues[issue_id] = issue_data
    
    # Add to support tickets for owner queue
    support_tickets[issue_id] = {
        "id": issue_id,
        "user": current_user.email,
        "role": current_user.role,
        "category": request.category,
        "status": "open",
        "createdAt": datetime.utcnow().isoformat(),
        "sla": 0.0  # Will be calculated based on time elapsed
    }
    
    return CreateIssueResponse(id=issue_id, status="open")

@api_router.patch("/support/issues/{issue_id}", response_model=dict)
async def update_support_issue(
    issue_id: str,
    request: UpdateIssueRequest,
    current_user: User = Depends(get_current_user)
):
    """Update support issue status (Owner/Admin only for now)"""
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    
    if issue_id not in support_issues:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    # Update issue
    support_issues[issue_id]["status"] = request.status
    support_issues[issue_id]["lastUpdate"] = datetime.utcnow().isoformat()
    if request.notes:
        support_issues[issue_id]["notes"] = request.notes
    
    # Update ticket in owner queue
    if issue_id in support_tickets:
        support_tickets[issue_id]["status"] = request.status
    
    return {"ok": True}

@api_router.post("/billing/refund", response_model=RefundResponse)
async def process_refund(
    request: RefundRequest,
    current_user: User = Depends(get_current_user)
):
    """Process refund for booking (Owner/Admin only)"""
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    
    # Mock refund processing
    # In production, integrate with Stripe for actual refunds
    
    # For demo, always issue credit instead of refunding to card
    credit_issued = True
    
    # Mock refund logic
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid refund amount")
    
    if request.amount > 500:  # Large refund threshold
        credit_issued = False  # Refund to original payment method
    
    return RefundResponse(ok=True, creditIssued=credit_issued)

@api_router.get("/owner/support/queue", response_model=OwnerQueueResponse)
async def get_owner_support_queue(current_user: User = Depends(get_current_user)):
    """Get support ticket queue for owners"""
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    
    tickets = []
    current_time = datetime.utcnow()
    
    for ticket_id, ticket_data in support_tickets.items():
        # Calculate SLA hours
        created_at = datetime.fromisoformat(ticket_data["createdAt"].replace('Z', '+00:00'))
        sla_hours = (current_time - created_at).total_seconds() / 3600
        
        tickets.append(SupportTicket(
            id=ticket_data["id"],
            user=ticket_data["user"],
            role=ticket_data["role"],
            category=ticket_data["category"],
            status=ticket_data["status"],
            createdAt=ticket_data["createdAt"],
            sla=round(sla_hours, 1)
        ))
    
    # Sort by SLA (longest first)
    tickets.sort(key=lambda x: x.sla, reverse=True)
    
    return OwnerQueueResponse(tickets=tickets)

@api_router.get("/owner/support/metrics", response_model=OwnerMetricsResponse)
async def get_owner_support_metrics(current_user: User = Depends(get_current_user)):
    """Get support metrics for owners"""
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    
    open_tickets = 0
    total_sla_hours = 0.0
    escalated_tickets = 0
    current_time = datetime.utcnow()
    
    for ticket_data in support_tickets.values():
        created_at = datetime.fromisoformat(ticket_data["createdAt"].replace('Z', '+00:00'))
        sla_hours = (current_time - created_at).total_seconds() / 3600
        
        if ticket_data["status"] == "open":
            open_tickets += 1
            total_sla_hours += sla_hours
            
            # Consider escalated if open for more than 24 hours
            if sla_hours > 24:
                escalated_tickets += 1
    
    avg_sla_hours = total_sla_hours / max(open_tickets, 1)
    
    return OwnerMetricsResponse(
        open=open_tickets,
        avgSlaHours=round(avg_sla_hours, 1),
        escalated=escalated_tickets
    )

@api_router.get("/partner/training/guides", response_model=TrainingGuidesResponse)
async def get_training_guides(current_user: User = Depends(get_current_user)):
    """Get training guides for partners"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    initialize_support_data()
    
    guides = list(training_guides.values())
    return TrainingGuidesResponse(items=guides)

# PAGE-11-BOOKINGS: Booking Management APIs

# Booking List Models
class BookingListItem(BaseModel):
    bookingId: str
    dateTime: Optional[str] = None  # For customer
    time: Optional[str] = None      # For partner
    serviceType: str
    addressShort: str
    status: str
    price: Optional[float] = None        # For customer
    payout: Optional[float] = None       # For partner
    currency: str = "USD"
    distanceKm: Optional[float] = None   # For partner
    surge: Optional[bool] = False        # For customer
    promoApplied: Optional[bool] = False # For customer
    creditsUsed: Optional[bool] = False  # For customer

class BookingListResponse(BaseModel):
    items: List[BookingListItem]
    nextPage: Optional[int] = None

# Detailed Booking Models
class BookingService(BaseModel):
    serviceType: str
    dwellingType: str
    bedrooms: int
    bathrooms: int
    masters: int
    addons: List[str] = []

class BookingAddress(BaseModel):
    line1: str
    city: str
    postalCode: str
    lat: float
    lng: float

class BookingPartner(BaseModel):
    id: str
    name: str
    rating: float
    badges: List[str] = []

class BookingCustomer(BaseModel):
    id: str
    firstNameInitial: str
    rating: float

class BookingTimelineEvent(BaseModel):
    ts: str
    event: str
    label: str

class BookingPhotos(BaseModel):
    before: List[str] = []
    after: List[str] = []

class BookingReceiptBreakdown(BaseModel):
    label: str
    amount: float

class BookingReceipt(BaseModel):
    breakdown: List[BookingReceiptBreakdown]
    tax: float
    promo: float
    credits: float
    total: float
    currency: str = "USD"

class BookingPolicy(BaseModel):
    cancellable: bool
    windowMins: int
    fee: float
    refundCreditEligible: bool

class BookingDetail(BaseModel):
    bookingId: str
    status: str
    service: BookingService
    address: BookingAddress
    partner: Optional[BookingPartner] = None
    customer: Optional[BookingCustomer] = None
    timeline: List[BookingTimelineEvent]
    photos: BookingPhotos
    receipt: BookingReceipt
    policy: BookingPolicy

class InvoiceResponse(BaseModel):
    url: str

# Booking List Endpoints
@api_router.get("/bookings/customer", response_model=BookingListResponse)
async def list_customer_bookings(
    status: str = Query(..., description="Status filter: upcoming|in_progress|past"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """List customer bookings with status filtering"""
    if current_user.role != "customer":
        raise HTTPException(status_code=403, detail="Customer access required")
    
    # Calculate skip for pagination
    skip = (page - 1) * size
    
    # Map status to database filters
    status_filter = {}
    if status == "upcoming":
        status_filter = {"status": {"$in": ["scheduled", "pending_dispatch"]}}
    elif status == "in_progress":
        status_filter = {"status": {"$in": ["assigned", "enroute", "arrived", "in_progress"]}}
    elif status == "past":
        status_filter = {"status": {"$in": ["completed", "cancelled"]}}
    
    # Query database
    query = {"user_id": current_user.id, **status_filter}
    cursor = db.bookings.find(query).sort("created_at", -1).skip(skip).limit(size + 1)
    bookings = await cursor.to_list(length=size + 1)
    
    # Check if there's a next page
    has_next_page = len(bookings) > size
    if has_next_page:
        bookings = bookings[:-1]  # Remove extra item
    next_page = page + 1 if has_next_page else None
    
    # Transform to response format
    items = []
    for booking in bookings:
        service_type = booking.get("service", {}).get("type", "Unknown")
        address = booking.get("address", {})
        address_short = f"{address.get('line1', '')} {address.get('city', '')}".strip()
        
        # Get booking date/time
        created_at = booking.get("created_at")
        date_time = created_at.isoformat() + "Z" if created_at else None
        
        # Calculate price from totals
        totals = booking.get("totals", {})
        price = totals.get("total", 0.0)
        
        items.append(BookingListItem(
            bookingId=booking["booking_id"],
            dateTime=date_time,
            serviceType=service_type,
            addressShort=address_short,
            status=booking["status"],
            price=price,
            currency="USD",
            surge=totals.get("surge", False),
            promoApplied=bool(booking.get("promo_code")),
            creditsUsed=booking.get("credits_applied", False)
        ))
    
    return BookingListResponse(items=items, nextPage=next_page)

@api_router.get("/bookings/partner", response_model=BookingListResponse)
async def list_partner_bookings(
    status: str = Query(..., description="Status filter: today|upcoming|completed"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """List partner job bookings with status filtering"""
    if current_user.role != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")
    
    # Calculate skip for pagination
    skip = (page - 1) * size
    
    # Map status to database filters and date ranges
    status_filter = {}
    today = datetime.utcnow().date()
    
    if status == "today":
        status_filter = {
            "status": {"$in": ["assigned", "enroute", "arrived", "in_progress"]},
            "created_at": {
                "$gte": datetime.combine(today, datetime.min.time()),
                "$lt": datetime.combine(today + timedelta(days=1), datetime.min.time())
            }
        }
    elif status == "upcoming":
        status_filter = {
            "status": {"$in": ["scheduled", "assigned"]},
            "created_at": {"$gte": datetime.combine(today + timedelta(days=1), datetime.min.time())}
        }
    elif status == "completed":
        status_filter = {"status": {"$in": ["completed", "cancelled"]}}
    
    # Query database (partner jobs are bookings assigned to this partner)
    query = {"partner_id": current_user.id, **status_filter}
    cursor = db.bookings.find(query).sort("created_at", -1).skip(skip).limit(size + 1)
    bookings = await cursor.to_list(length=size + 1)
    
    # Check if there's a next page
    has_next_page = len(bookings) > size
    if has_next_page:
        bookings = bookings[:-1]  # Remove extra item
    next_page = page + 1 if has_next_page else None
    
    # Transform to response format
    items = []
    for booking in bookings:
        service_type = booking.get("service", {}).get("type", "Unknown")
        address = booking.get("address", {})
        address_short = f"{address.get('line1', '')} {address.get('city', '')}".strip()
        
        # Get booking time
        created_at = booking.get("created_at")
        time = created_at.isoformat() + "Z" if created_at else None
        
        # Calculate partner payout (80% of total after fees)
        totals = booking.get("totals", {})
        total = totals.get("total", 0.0)
        payout = round(total * 0.8, 2)  # 80% to partner
        
        # Mock distance (would be calculated based on partner location)
        distance_km = round(random.uniform(1.0, 15.0), 1)
        
        items.append(BookingListItem(
            bookingId=booking["booking_id"],
            time=time,
            serviceType=service_type,
            addressShort=address_short,
            status=booking["status"],
            payout=payout,
            currency="USD",
            distanceKm=distance_km
        ))
    
    return BookingListResponse(items=items, nextPage=next_page)

@api_router.get("/bookings/{booking_id}", response_model=BookingDetail)
async def get_booking_detail(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get detailed booking information"""
    
    # Find booking in database
    booking = await db.bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check access permissions
    can_access = False
    if current_user.role == "customer" and booking.get("user_id") == current_user.id:
        can_access = True
    elif current_user.role == "partner" and booking.get("partner_id") == current_user.id:
        can_access = True
    elif current_user.role == "owner":
        can_access = True
    
    if not can_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Build service details
    service_data = booking.get("service", {})
    service = BookingService(
        serviceType=service_data.get("type", "Unknown"),
        dwellingType=service_data.get("dwellingType", "House"),
        bedrooms=service_data.get("bedrooms", 2),
        bathrooms=service_data.get("bathrooms", 1),
        masters=service_data.get("masters", 1),
        addons=service_data.get("addons", [])
    )
    
    # Build address details
    address_data = booking.get("address", {})
    address = BookingAddress(
        line1=address_data.get("line1", ""),
        city=address_data.get("city", ""),
        postalCode=address_data.get("postalCode", ""),
        lat=address_data.get("lat", 37.7749),
        lng=address_data.get("lng", -122.4194)
    )
    
    # Mock partner details (would come from partner collection)
    partner = None
    if booking.get("partner_id"):
        partner = BookingPartner(
            id=booking["partner_id"],
            name="Sarah J.",
            rating=4.8,
            badges=["verified", "pro"]
        )
    
    # Mock customer details (would come from user collection)
    customer = None
    if current_user.role != "customer":
        customer = BookingCustomer(
            id=booking["user_id"],
            firstNameInitial="M",
            rating=4.7
        )
    
    # Build timeline
    created_at = booking.get("created_at")
    timeline = [
        BookingTimelineEvent(
            ts=created_at.isoformat() + "Z" if created_at else "",
            event="created",
            label="Booking created"
        )
    ]
    
    # Add more timeline events based on status
    status = booking.get("status", "")
    if status in ["assigned", "enroute", "arrived", "in_progress", "completed"]:
        timeline.append(BookingTimelineEvent(
            ts=(created_at + timedelta(minutes=5)).isoformat() + "Z" if created_at else "",
            event="assigned",
            label="Partner assigned"
        ))
    
    # Mock photos
    photos = BookingPhotos(before=[], after=[])
    if status == "completed":
        photos = BookingPhotos(
            before=["https://example.com/before1.jpg"],
            after=["https://example.com/after1.jpg"]
        )
    
    # Build receipt
    totals = booking.get("totals", {})
    breakdown = [
        BookingReceiptBreakdown(label="Base Service", amount=totals.get("base", 100.0)),
        BookingReceiptBreakdown(label="Rooms", amount=totals.get("rooms", 20.0))
    ]
    
    if totals.get("surge"):
        breakdown.append(BookingReceiptBreakdown(label="Surge (1.2x)", amount=totals.get("surgeAmount", 24.0)))
    
    receipt = BookingReceipt(
        breakdown=breakdown,
        tax=totals.get("tax", 0.0),
        promo=totals.get("promo", 0.0),
        credits=totals.get("credits", 0.0),
        total=totals.get("total", 144.0),
        currency="USD"
    )
    
    # Build cancellation policy
    policy = BookingPolicy(
        cancellable=status in ["scheduled", "pending_dispatch"],
        windowMins=60,
        fee=0.0 if status == "scheduled" else 10.0,
        refundCreditEligible=True
    )
    
    return BookingDetail(
        bookingId=booking_id,
        status=status,
        service=service,
        address=address,
        partner=partner,
        customer=customer,
        timeline=timeline,
        photos=photos,
        receipt=receipt,
        policy=policy
    )

@api_router.get("/bookings/{booking_id}/invoice", response_model=InvoiceResponse)
async def get_booking_invoice(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get booking invoice PDF download URL"""
    
    # Find booking in database
    booking = await db.bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check access permissions (customer or owner only)
    can_access = False
    if current_user.role == "customer" and booking.get("user_id") == current_user.id:
        can_access = True
    elif current_user.role == "owner":
        can_access = True
    
    if not can_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if booking is completed (required for invoice)
    if booking.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Invoice only available for completed bookings")
    
    # Generate mock signed URL (15-minute TTL)
    # In production, this would generate a real signed URL for PDF storage
    timestamp = int(datetime.utcnow().timestamp())
    signature = hashlib.md5(f"{booking_id}_{timestamp}".encode()).hexdigest()
    signed_url = f"https://storage.shine.com/invoices/{booking_id}_{timestamp}_{signature}.pdf"
    
    return InvoiceResponse(url=signed_url)

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

# Router will be included at the end after all endpoints are defined

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
    await db.bookings.create_index("partner_id")  # New index for partner queries
    await db.bookings.create_index("booking_id", unique=True)
    await db.bookings.create_index("status")
    await db.bookings.create_index("created_at")
    await db.bookings.create_index([("user_id", 1), ("status", 1), ("created_at", -1)])  # Compound index for customer queries
    await db.bookings.create_index([("partner_id", 1), ("status", 1), ("created_at", -1)])  # Compound index for partner queries
    
    logger.info("Created database indexes")
    
    # Initialize mock booking data for testing
    await initialize_mock_bookings()
    
    # Initialize mock discovery data for PAGE-12-DISCOVERY
    await initialize_mock_discovery_data()

# PAGE-12-DISCOVERY: Search & Favorites APIs

# Discovery Models
class SearchResultItem(BaseModel):
    partnerId: str
    partnerName: str
    rating: float
    badges: List[str]
    serviceTypes: List[str]
    distanceKm: float
    priceHint: str
    fav: bool

class SearchResponse(BaseModel):
    items: List[SearchResultItem]
    nextPage: Optional[int] = None

class PartnerService(BaseModel):
    serviceType: str
    price: float
    duration: int  # minutes

class PartnerReview(BaseModel):
    customerName: str
    rating: float
    comment: str

class PartnerProfile(BaseModel):
    partnerId: str
    name: str
    rating: float
    badges: List[str]
    description: str
    photos: List[str]
    services: List[PartnerService]
    recentReviews: List[PartnerReview]
    status: str

class FavoriteToggleRequest(BaseModel):
    fav: bool

class FavoriteToggleResponse(BaseModel):
    ok: bool = True

class FavoritesListResponse(BaseModel):
    items: List[str]

class TopSearchTerm(BaseModel):
    term: str
    count: int

class TopFavoritePartner(BaseModel):
    partnerId: str
    count: int

class DiscoveryAnalytics(BaseModel):
    topSearches: List[TopSearchTerm]
    topFavorites: List[TopFavoritePartner]

# Mock data storage for discovery
mock_partners = {}
user_favorites = {}  # user_id -> set of partner_ids
search_analytics = {}  # search_term -> count
favorite_analytics = {}  # partner_id -> count

async def initialize_mock_discovery_data():
    """Initialize mock partner profiles and discovery data"""
    global mock_partners
    
    mock_partners = {
        "pa_101": {
            "partnerId": "pa_101",
            "name": "Sparkle Pros",
            "rating": 4.9,
            "badges": ["verified", "eco"],
            "description": "Premium eco-friendly home cleaning service with 5+ years experience. We use only non-toxic, biodegradable products safe for families and pets. Fully insured and bonded.",
            "photos": [
                "https://cdn.example.com/partners/sparkle-pros-1.jpg",
                "https://cdn.example.com/partners/sparkle-pros-2.jpg",
                "https://cdn.example.com/partners/sparkle-pros-3.jpg"
            ],
            "fareCards": [
                {"serviceType": "Deep Clean", "fromPrice": 119.0, "duration": 180},
                {"serviceType": "Standard Clean", "fromPrice": 89.0, "duration": 120},
                {"serviceType": "Bathroom Only", "fromPrice": 49.0, "duration": 60}
            ],
            "recentReviews": [
                {"customerName": "Sarah M.", "rating": 5.0, "comment": "Amazing work! Left my home spotless and smelling fresh."},
                {"customerName": "James K.", "rating": 5.0, "comment": "On time, professional, and thorough. Highly recommend!"},
                {"customerName": "Lisa R.", "rating": 4.8, "comment": "Great eco-friendly products. My allergies didn't act up at all."}
            ],
            "status": "verified",
            "serviceTypes": ["Deep Clean", "Standard Clean", "Bathroom Only"],
            "lat": 37.7749,
            "lng": -122.4194,
            "tags": ["eco", "green", "non-toxic", "family-safe", "pet-safe"],
            "fromPrice": 49.0  # Lowest price for discovery display
        },
        "pa_102": {
            "partnerId": "pa_102",
            "name": "Shiny Homes",
            "rating": 4.7,
            "badges": ["verified"],
            "description": "Reliable and affordable home cleaning services. Quick turnaround for busy families. Same-day service available.",
            "photos": [
                "https://cdn.example.com/partners/shiny-homes-1.jpg",
                "https://cdn.example.com/partners/shiny-homes-2.jpg"
            ],
            "fareCards": [
                {"serviceType": "Standard Clean", "fromPrice": 89.0, "duration": 90},
                {"serviceType": "Move-out Clean", "fromPrice": 149.0, "duration": 150}
            ],
            "recentReviews": [
                {"customerName": "Mike D.", "rating": 4.5, "comment": "Good value for money. Got the job done."},
                {"customerName": "Anna T.", "rating": 5.0, "comment": "Super fast and efficient. Perfect for my busy schedule."}
            ],
            "status": "verified",
            "serviceTypes": ["Standard Clean", "Move-out Clean"],
            "lat": 37.7849,
            "lng": -122.4094,
            "tags": ["fast", "affordable", "same-day", "reliable"],
            "fromPrice": 89.0
        },
        "pa_103": {
            "partnerId": "pa_103",
            "name": "GreenThumb Lawn Care",
            "rating": 4.8,
            "badges": ["verified", "seasonal"],
            "description": "Professional lawn care and landscaping services. Specializing in organic lawn treatments and seasonal maintenance.",
            "photos": [
                "https://cdn.example.com/partners/greenthumb-1.jpg",
                "https://cdn.example.com/partners/greenthumb-2.jpg"
            ],
            "fareCards": [
                {"serviceType": "Lawn Mowing", "fromPrice": 45.0, "duration": 45},
                {"serviceType": "Landscaping", "fromPrice": 120.0, "duration": 240},
                {"serviceType": "Seasonal Cleanup", "fromPrice": 85.0, "duration": 120}
            ],
            "recentReviews": [
                {"customerName": "Robert L.", "rating": 5.0, "comment": "Transformed my backyard! Professional and knowledgeable."},
                {"customerName": "Emily W.", "rating": 4.6, "comment": "Great organic approach. My lawn has never looked better."}
            ],
            "status": "verified",
            "serviceTypes": ["Lawn Mowing", "Landscaping", "Seasonal Cleanup"],
            "lat": 37.7649,
            "lng": -122.4294,
            "tags": ["organic", "lawn", "landscaping", "seasonal", "backyard"],
            "fromPrice": 45.0
        },
        "pa_104": {
            "partnerId": "pa_104",
            "name": "Paws & Walk",
            "rating": 4.6,
            "badges": ["verified", "insured"],
            "description": "Trusted dog walking and pet care services. All walkers are background-checked and insured. GPS tracking for all walks.",
            "photos": [
                "https://cdn.example.com/partners/paws-walk-1.jpg"
            ],
            "fareCards": [
                {"serviceType": "Dog Walk", "fromPrice": 25.0, "duration": 30},
                {"serviceType": "Pet Sitting", "fromPrice": 40.0, "duration": 60}
            ],
            "recentReviews": [
                {"customerName": "Jennifer S.", "rating": 4.8, "comment": "Love the GPS tracking! My dog is always happy after walks."},
                {"customerName": "Mark P.", "rating": 4.4, "comment": "Reliable and trustworthy. Great communication."}
            ],
            "status": "verified",
            "serviceTypes": ["Dog Walk", "Pet Sitting"],
            "lat": 37.7549,
            "lng": -122.4394,
            "tags": ["dog", "pet", "walk", "sitting", "gps", "insured"],
            "fromPrice": 25.0
        },
        "pa_105": {
            "partnerId": "pa_105",
            "name": "Beauty At Home",
            "rating": 4.5,
            "badges": ["pending"],
            "description": "Mobile beauty services brought to your home. Licensed cosmetologist with 10+ years experience.",
            "photos": [
                "https://cdn.example.com/partners/beauty-home-1.jpg"
            ],
            "fareCards": [
                {"serviceType": "Hair Cut", "fromPrice": 65.0, "duration": 60},
                {"serviceType": "Manicure", "fromPrice": 35.0, "duration": 45}
            ],
            "recentReviews": [
                {"customerName": "Amanda R.", "rating": 4.5, "comment": "Convenient service but still working on consistency."}
            ],
            "status": "pending",
            "serviceTypes": ["Hair Cut", "Manicure"],
            "lat": 37.7749,
            "lng": -122.4094,
            "tags": ["beauty", "hair", "nails", "mobile", "home"],
            "fromPrice": 35.0
        }
    }
    
    # Initialize search analytics
    global search_analytics, favorite_analytics
    search_analytics = {
        "clean": 145,
        "cleaning": 132,
        "lawn": 89,
        "dog walk": 67,
        "beauty": 43,
        "sparkle": 28,
        "eco": 19,
        "deep clean": 15
    }
    
    favorite_analytics = {
        "pa_101": 32,
        "pa_102": 28,
        "pa_103": 21,
        "pa_104": 19,
        "pa_105": 8
    }
    
    print("Mock discovery data initialized")

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two points in kilometers (simplified)"""
    # Simplified distance calculation for demo
    import math
    
    lat_diff = abs(lat1 - lat2)
    lng_diff = abs(lng1 - lng2)
    
    # Rough approximation: 1 degree ≈ 111 km
    distance = math.sqrt((lat_diff * 111) ** 2 + (lng_diff * 111) ** 2)
    return round(distance, 1)

def fuzzy_match(query: str, text: str, max_distance: int = 1) -> bool:
    """Simple fuzzy matching with edit distance"""
    if len(query) < 4:
        return query.lower() in text.lower()
    
    # Simple edit distance for fuzzy matching
    query = query.lower()
    text = text.lower()
    
    if query in text:
        return True
    
    # Check for single character differences
    for i in range(len(query)):
        modified = query[:i] + query[i+1:]  # Remove character
        if modified in text:
            return True
        
        if i < len(text):
            modified = query[:i] + text[i] + query[i+1:]  # Replace character
            if modified in text:
                return True
    
    return False

@api_router.get("/discovery/search", response_model=SearchResponse)
async def search_partners(
    q: str = Query("", description="Search query"),
    filter: str = Query("All", description="Service category filter"),
    lat: float = Query(37.7749, description="User latitude"),
    lng: float = Query(-122.4194, description="User longitude"),
    radiusKm: float = Query(10.0, description="Search radius in km"),
    sort: str = Query("relevance", description="Sort order: relevance|rating|distance"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """Search for partners with filters and pagination"""
    
    # Validate query length
    if q and len(q) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")
    
    # Sanitize query
    q = q.strip()[:64] if q else ""
    
    # Get user's favorites
    user_favs = user_favorites.get(current_user.id, set())
    
    # Filter partners
    matching_partners = []
    
    for partner_id, partner_data in mock_partners.items():
        # Calculate distance
        distance = calculate_distance(lat, lng, partner_data["lat"], partner_data["lng"])
        
        # Filter by radius
        if distance > radiusKm:
            continue
        
        # Filter by category
        if filter != "All":
            category_mapping = {
                "Cleaning": ["Deep Clean", "Standard Clean", "Bathroom Only", "Move-out Clean"],
                "Lawn": ["Lawn Mowing", "Landscaping", "Seasonal Cleanup"],
                "Dog Walk": ["Dog Walk", "Pet Sitting"],
                "Beauty": ["Hair Cut", "Manicure"],
                "Snow": ["Snow Removal"],
                "Baby Care": ["Baby Care"]
            }
            
            if filter in category_mapping:
                category_services = category_mapping[filter]
                if not any(service in partner_data["serviceTypes"] for service in category_services):
                    continue
        
        # Search matching
        matches_search = True
        if q:
            # Check partner name, service types, and tags
            search_fields = [
                partner_data["name"],
                " ".join(partner_data["serviceTypes"]),
                " ".join(partner_data.get("tags", []))
            ]
            
            matches_search = any(
                fuzzy_match(q, field) for field in search_fields
            )
        
        if matches_search:
            # Calculate price hint
            min_price = min(service["price"] for service in partner_data["services"])
            price_hint = f"From ${int(min_price)}"
            
            matching_partners.append({
                "partner_data": partner_data,
                "distance": distance,
                "price_hint": price_hint,
                "is_favorite": partner_id in user_favs
            })
    
    # Sort results
    if sort == "rating":
        matching_partners.sort(key=lambda x: x["partner_data"]["rating"], reverse=True)
    elif sort == "distance":
        matching_partners.sort(key=lambda x: x["distance"])
    else:  # relevance (default)
        # Simple relevance: rating + inverse distance
        matching_partners.sort(key=lambda x: x["partner_data"]["rating"] - (x["distance"] / 10), reverse=True)
    
    # Pagination
    start_idx = (page - 1) * size
    end_idx = start_idx + size
    page_partners = matching_partners[start_idx:end_idx + 1]  # Get one extra to check if there's next page
    
    has_next_page = len(page_partners) > size
    if has_next_page:
        page_partners = page_partners[:-1]  # Remove extra item
    
    # Build response
    items = []
    for partner_info in page_partners:
        partner_data = partner_info["partner_data"]
        items.append(SearchResultItem(
            partnerId=partner_data["partnerId"],
            partnerName=partner_data["name"],
            rating=partner_data["rating"],
            badges=partner_data["badges"],
            serviceTypes=partner_data["serviceTypes"],
            distanceKm=partner_info["distance"],
            priceHint=partner_info["price_hint"],
            fav=partner_info["is_favorite"]
        ))
    
    # Track search analytics
    if q:
        search_analytics[q.lower()] = search_analytics.get(q.lower(), 0) + 1
    
    # Telemetry
    print(f"Telemetry: discovery.search - role: {current_user.role}, query: '{q}', filter: {filter}, results: {len(items)}")
    
    return SearchResponse(
        items=items,
        nextPage=page + 1 if has_next_page else None
    )

@api_router.get("/partners/{partner_id}/profile", response_model=PartnerProfile)
async def get_partner_profile(
    partner_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get detailed partner profile"""
    
    if partner_id not in mock_partners:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    partner_data = mock_partners[partner_id]
    
    # Convert to response format
    services = [
        PartnerService(
            serviceType=service["serviceType"],
            price=service["price"],
            duration=service["duration"]
        )
        for service in partner_data["services"]
    ]
    
    reviews = [
        PartnerReview(
            customerName=review["customerName"],
            rating=review["rating"],
            comment=review["comment"]
        )
        for review in partner_data["recentReviews"]
    ]
    
    # Telemetry
    print(f"Telemetry: discovery.partner.profile.open - role: {current_user.role}, partnerId: {partner_id}")
    
    return PartnerProfile(
        partnerId=partner_data["partnerId"],
        name=partner_data["name"],
        rating=partner_data["rating"],
        badges=partner_data["badges"],
        description=partner_data["description"],
        photos=partner_data["photos"],
        services=services,
        recentReviews=reviews,
        status=partner_data["status"]
    )

@api_router.post("/favorites/{partner_id}", response_model=FavoriteToggleResponse)
async def toggle_favorite(
    partner_id: str,
    request: FavoriteToggleRequest,
    current_user: User = Depends(get_current_user)
):
    """Toggle partner favorite status"""
    
    if current_user.role != "customer":
        raise HTTPException(status_code=403, detail="Only customers can manage favorites")
    
    if partner_id not in mock_partners:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    # Initialize user favorites if not exists
    if current_user.id not in user_favorites:
        user_favorites[current_user.id] = set()
    
    user_favs = user_favorites[current_user.id]
    
    # Check favorites limit
    if request.fav and len(user_favs) >= 200:
        raise HTTPException(status_code=400, detail="Maximum 200 favorites allowed")
    
    # Toggle favorite
    if request.fav:
        user_favs.add(partner_id)
        # Update analytics
        favorite_analytics[partner_id] = favorite_analytics.get(partner_id, 0) + 1
    else:
        user_favs.discard(partner_id)
        # Update analytics (decrement)
        if partner_id in favorite_analytics and favorite_analytics[partner_id] > 0:
            favorite_analytics[partner_id] -= 1
    
    # Telemetry
    print(f"Telemetry: discovery.favorite.toggle - role: {current_user.role}, partnerId: {partner_id}, favState: {request.fav}")
    
    return FavoriteToggleResponse(ok=True)

@api_router.get("/favorites", response_model=FavoritesListResponse)
async def list_favorites(current_user: User = Depends(get_current_user)):
    """Get user's favorite partners"""
    
    if current_user.role != "customer":
        raise HTTPException(status_code=403, detail="Only customers can view favorites")
    
    user_favs = user_favorites.get(current_user.id, set())
    
    return FavoritesListResponse(items=list(user_favs))

@api_router.get("/analytics/discovery", response_model=DiscoveryAnalytics)
async def get_discovery_analytics(current_user: User = Depends(get_current_user)):
    """Get discovery analytics for owners"""
    
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    
    # Top searches (sorted by count)
    top_searches = [
        TopSearchTerm(term=term, count=count)
        for term, count in sorted(search_analytics.items(), key=lambda x: x[1], reverse=True)[:10]
    ]
    
    # Top favorites (sorted by count)
    top_favorites = [
        TopFavoritePartner(partnerId=partner_id, count=count)
        for partner_id, count in sorted(favorite_analytics.items(), key=lambda x: x[1], reverse=True)[:10]
    ]
    
    # Telemetry
    print(f"Telemetry: discovery.analytics.view - role: {current_user.role}")
    
    return DiscoveryAnalytics(
        topSearches=top_searches,
        topFavorites=top_favorites
    )

# PLATFORM PRICING ENGINE (CHG-PLATFORM-PRICING-001)

# Pricing Models
class Dwelling(BaseModel):
    type: str  # House|Apartment|Condo|Office
    bedrooms: int
    bathrooms: int
    masters: int
    sqft: Optional[int] = None

class PricingRequest(BaseModel):
    serviceType: str
    dwelling: Dwelling
    addons: List[str] = []
    when: dict  # {type: "now|scheduled", iso: "ISO8601"}
    address: dict  # {lat: number, lng: number, zoneId?: string}

class FareBreakdown(BaseModel):
    label: str
    amount: float

class Fare(BaseModel):
    subtotal: float
    surgeMultiplier: float
    tax: float
    total: float
    currency: str = "USD"

class Surge(BaseModel):
    active: bool
    reason: Optional[str] = None

class PricingResponse(BaseModel):
    fare: Fare
    breakdown: List[FareBreakdown]
    surge: Surge
    estimateId: str
    pricingEngineVersion: str = "v1.0"

class PricingRules(BaseModel):
    zones: List[str]
    baseFares: dict
    modifiers: dict
    surge: dict
    version: str = "v1.0"

class PayoutCalculationRequest(BaseModel):
    bookingId: str

class PayoutDetails(BaseModel):
    base: float
    surgeShare: float
    bonuses: float
    total: float
    currency: str = "USD"

class PayoutCalculationResponse(BaseModel):
    fareTotal: float
    takeRatePercent: float
    surgeSharePercent: float
    payout: PayoutDetails

# Mock pricing configuration
PRICING_CONFIG = {
    "zones": [
        {"zoneId": "Z-URBAN", "name": "Urban Core", "surgeBase": 1.2},
        {"zoneId": "Z-SUBURB", "name": "Suburban", "surgeBase": 1.0}
    ],
    "baseFares": {
        "deep": {"base": 119, "perBedroom": 15, "perBathroom": 18, "durationMin": 180},
        "standard": {"base": 89, "perBedroom": 10, "perBathroom": 12, "durationMin": 120},
        "basic": {"base": 59, "perBedroom": 10, "perBathroom": 12, "durationMin": 90},
        "bathroom_only": {"base": 49, "perBathroom": 15, "durationMin": 60},
        "lawn_mowing": {"base": 45, "per1000Sqft": 8, "durationMin": 45},
        "snow_driveway": {"base": 55, "per100Sqft": 3, "durationMin": 40},
        "dog_walk": {"base": 25, "per15Min": 8, "durationMin": 30},
        "haircut": {"base": 65, "durationMin": 60},
        "manicure": {"base": 35, "durationMin": 45},
        "baby_sitting": {"base": 22, "perHour": 22, "minHours": 2}
    },
    "addons": {
        "eco_products": 7,
        "bring_supplies": 10,
        "inside_fridge": 15,
        "inside_oven": 15
    },
    "taxPercent": 0.0,
    "surgeRules": [
        {"demandSupply": 1.0, "multiplier": 1.0},
        {"demandSupply": 1.3, "multiplier": 1.1},
        {"demandSupply": 1.6, "multiplier": 1.25},
        {"demandSupply": 2.0, "multiplier": 1.5}
    ],
    "surgeCap": 2.5,
    "takeRatePercent": 75.0,
    "surgeSharePercent": 50.0
}

def determine_zone(lat: float, lng: float) -> str:
    """Determine zone based on coordinates (mock logic)"""
    # Simple mock logic: Urban core around SF center
    if abs(lat - 37.7749) < 0.02 and abs(lng - (-122.4194)) < 0.02:
        return "Z-URBAN"
    return "Z-SUBURB"

def calculate_surge_multiplier(zone_id: str, when_type: str) -> tuple[float, bool, str]:
    """Calculate surge multiplier based on demand/supply (mock)"""
    # Mock surge logic
    if when_type == "now" and zone_id == "Z-URBAN":
        # Simulate high demand in urban areas for immediate bookings
        return 1.2, True, "High demand in Urban Core"
    elif when_type == "now" and zone_id == "Z-SUBURB":
        # Moderate demand in suburbs
        return 1.1, True, "Moderate demand"
    else:
        # Scheduled bookings have no surge
        return 1.0, False, None

def calculate_platform_fare(request: PricingRequest) -> tuple[Fare, List[FareBreakdown], Surge]:
    """Calculate platform-controlled fare"""
    
    # Determine zone
    zone_id = request.address.get("zoneId") or determine_zone(
        request.address["lat"], 
        request.address["lng"]
    )
    
    # Get base fare for service type
    service_key = request.serviceType.lower().replace(" ", "_").replace("-", "_")
    if service_key not in PRICING_CONFIG["baseFares"]:
        raise HTTPException(status_code=400, detail=f"Service type '{request.serviceType}' not supported")
    
    base_config = PRICING_CONFIG["baseFares"][service_key]
    
    # Calculate base fare
    subtotal = base_config["base"]
    breakdown = [FareBreakdown(label="Base", amount=base_config["base"])]
    
    # Add room-based charges
    if "perBedroom" in base_config and request.dwelling.bedrooms > 0:
        bedroom_charge = request.dwelling.bedrooms * base_config["perBedroom"]
        subtotal += bedroom_charge
        breakdown.append(FareBreakdown(
            label=f"Bedrooms x{request.dwelling.bedrooms}", 
            amount=bedroom_charge
        ))
    
    if "perBathroom" in base_config and request.dwelling.bathrooms > 0:
        bathroom_charge = request.dwelling.bathrooms * base_config["perBathroom"]
        subtotal += bathroom_charge
        breakdown.append(FareBreakdown(
            label=f"Bathrooms x{request.dwelling.bathrooms}", 
            amount=bathroom_charge
        ))
    
    # Add addon charges
    addon_total = 0
    for addon in request.addons:
        if addon in PRICING_CONFIG["addons"]:
            addon_price = PRICING_CONFIG["addons"][addon]
            addon_total += addon_price
            breakdown.append(FareBreakdown(
                label=addon.replace("_", " ").title(), 
                amount=addon_price
            ))
    
    subtotal += addon_total
    
    # Calculate surge
    surge_multiplier, surge_active, surge_reason = calculate_surge_multiplier(
        zone_id, request.when["type"]
    )
    
    surge_amount = 0
    if surge_multiplier > 1.0:
        surge_amount = subtotal * (surge_multiplier - 1.0)
        breakdown.append(FareBreakdown(
            label=f"Surge x{surge_multiplier}", 
            amount=round(surge_amount, 2)
        ))
    
    # Calculate final total
    tax = subtotal * (PRICING_CONFIG["taxPercent"] / 100)
    total = (subtotal + surge_amount + tax)
    
    return (
        Fare(
            subtotal=round(subtotal, 2),
            surgeMultiplier=surge_multiplier,
            tax=round(tax, 2),
            total=round(total, 2)
        ),
        breakdown,
        Surge(active=surge_active, reason=surge_reason)
    )

# Pricing API endpoints
@api_router.post("/pricing/quote", response_model=PricingResponse)
async def get_pricing_quote(
    request: PricingRequest,
    current_user: User = Depends(get_current_user)
):
    """Get platform-calculated pricing quote"""
    
    try:
        # Calculate fare
        fare, breakdown, surge = calculate_platform_fare(request)
        
        # Generate estimate ID
        estimate_id = f"EST-{request.serviceType[:2].upper()}-{random.randint(1000, 9999)}"
        
        # Telemetry
        print(f"Telemetry: pricing.quote.request - role: {current_user.role}, serviceType: {request.serviceType}, total: {fare.total}")
        
        response = PricingResponse(
            fare=fare,
            breakdown=breakdown,
            surge=surge,
            estimateId=estimate_id
        )
        
        print(f"Telemetry: pricing.quote.response - estimateId: {estimate_id}, total: {fare.total}")
        
        return response
        
    except Exception as e:
        print(f"Telemetry: pricing.quote.error - error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/pricing/rules", response_model=PricingRules)
async def get_pricing_rules(current_user: User = Depends(get_current_user)):
    """Get pricing rules configuration (owner only)"""
    
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    
    return PricingRules(
        zones=[zone["zoneId"] for zone in PRICING_CONFIG["zones"]],
        baseFares=PRICING_CONFIG["baseFares"],
        modifiers={
            "addons": PRICING_CONFIG["addons"],
            "surgeRules": PRICING_CONFIG["surgeRules"],
            "surgeCap": PRICING_CONFIG["surgeCap"]
        },
        surge={
            "enabled": True,
            "cap": PRICING_CONFIG["surgeCap"],
            "rules": PRICING_CONFIG["surgeRules"]
        }
    )

@api_router.post("/partner/earnings/payout-calc", response_model=PayoutCalculationResponse)
async def calculate_partner_payout(
    request: PayoutCalculationRequest,
    current_user: User = Depends(get_current_user)
):
    """Calculate partner payout from booking fare"""
    
    if current_user.role not in ["partner", "owner"]:
        raise HTTPException(status_code=403, detail="Partner or owner access required")
    
    # Find booking
    booking = await db.bookings.find_one({"booking_id": request.bookingId})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check access permissions
    if current_user.role == "partner" and booking.get("partner_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get fare total
    totals = booking.get("totals", {})
    fare_total = totals.get("total", 0.0)
    
    # Calculate payout
    take_rate_percent = PRICING_CONFIG["takeRatePercent"]
    surge_share_percent = PRICING_CONFIG["surgeSharePercent"]
    
    # Base payout (take rate)
    base_payout = fare_total * (take_rate_percent / 100)
    
    # Surge share (if surge was applied)
    surge_share = 0.0
    if totals.get("surge", False):
        surge_amount = totals.get("surgeAmount", 0.0)
        surge_share = surge_amount * (surge_share_percent / 100)
    
    # Mock bonuses (streak, zone, etc.)
    bonuses = 0.0
    
    total_payout = base_payout + surge_share + bonuses
    
    # Telemetry
    print(f"Telemetry: earn.payout.calc - bookingId: {request.bookingId}, fareTotal: {fare_total}, payout: {total_payout}")
    
    return PayoutCalculationResponse(
        fareTotal=fare_total,
        takeRatePercent=take_rate_percent,
        surgeSharePercent=surge_share_percent,
        payout=PayoutDetails(
            base=round(base_payout, 2),
            surgeShare=round(surge_share, 2),
            bonuses=round(bonuses, 2),
            total=round(total_payout, 2)
        )
    )

# Update booking creation to support estimateId and re-pricing
@api_router.post("/bookings", response_model=BookingResponse)
async def create_booking_with_pricing(
    request: BookingRequest,
    current_user: User = Depends(get_current_user)
):
    """Create booking with platform pricing validation"""
    
    if current_user.role != "customer":
        raise HTTPException(status_code=403, detail="Customer access required")
    
    # Generate booking ID
    booking_id = f"bk_{random.randint(1000000, 9999999)}"
    
    # Re-price the booking if estimateId provided
    if hasattr(request, 'estimateId') and request.estimateId:
        # In a real system, we'd validate the estimate ID and re-calculate
        # For now, we'll use the existing totals calculation but add pricing version
        pass
    
    # Calculate totals using existing logic but mark as platform-calculated
    service_type = request.service.type.lower()
    base_prices = {
        "basic": 59, "standard": 89, "deep": 119,
        "bathroom": 49, "move-out": 149
    }
    base_price = base_prices.get(service_type, 100)
    
    # Room calculations
    room_price = (request.service.bedrooms * 10) + (request.service.bathrooms * 12)
    
    # Addons
    addon_prices = {"inside_fridge": 15, "inside_oven": 15, "inside_windows": 20}
    addon_total = sum(addon_prices.get(addon, 0) for addon in request.service.addons)
    
    subtotal = base_price + room_price + addon_total
    surge_multiplier = 1.2 if random.random() > 0.7 else 1.0  # 30% chance of surge
    total = subtotal * surge_multiplier
    
    # Create booking document with pricing version
    booking_doc = {
        "booking_id": booking_id,
        "user_id": current_user.id,
        "service": {
            "type": request.service.type,
            "dwellingType": request.service.dwellingType,
            "bedrooms": request.service.bedrooms,
            "bathrooms": request.service.bathrooms,
            "masters": request.service.masters,
            "addons": request.service.addons
        },
        "address": {
            "line1": request.address.line1,
            "line2": request.address.line2,
            "city": request.address.city,
            "state": request.address.state,
            "postalCode": request.address.postalCode,
            "lat": request.address.lat,
            "lng": request.address.lng
        },
        "access": {
            "type": request.access.type,
            "instructions": request.access.instructions
        },
        "totals": {
            "base": base_price,
            "rooms": room_price,
            "addons": addon_total,
            "surge": surge_multiplier > 1.0,
            "surgeAmount": subtotal * (surge_multiplier - 1.0) if surge_multiplier > 1.0 else 0.0,
            "tax": 0.0,
            "promo": 0.0,
            "credits": 0.0,
            "total": round(total, 2)
        },
        "payment": {
            "method": request.payment.method,
            "paymentMethodId": request.payment.paymentMethodId
        },
        "status": "pending_dispatch",
        "pricingEngineVersion": "v1.0",  # New field for platform pricing
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Save to database
    await db.bookings.insert_one(booking_doc)
    
    # Add to booking status tracking
    booking_status[booking_id] = {
        "status": "pending_dispatch",
        "partner_id": None,
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Telemetry
    print(f"Telemetry: checkout.reprice - bookingId: {booking_id}, total: {total}")
    
    return BookingResponse(
        bookingId=booking_id,
        status="confirmed",
        totals={
            "subtotal": subtotal,
            "tax": 0.0,
            "total": total,
            "currency": "USD"
        }
    )

# Include the router in the main app after all endpoints are defined
app.include_router(api_router)