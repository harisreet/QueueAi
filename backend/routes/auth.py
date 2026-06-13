from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.user import User
from models.doctor import Doctor
from models.schemas import SignupRequest, LoginRequest, TokenResponse, UserResponse
from auth.jwt_handler import get_password_hash, verify_password, create_access_token
from auth.dependencies import get_current_user
import uuid

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=payload.role.value,
        phone=payload.phone,
        age=payload.age,
        gender=payload.gender,
        department=payload.department,
    )
    db.add(user)
    await db.flush()

    # Auto-create Doctor profile if registering as a doctor
    if payload.role.value == "doctor":
        doctor = Doctor(
            id=str(uuid.uuid4()),
            user_id=user.id,
            name=user.name,
            department=payload.department or "General Medicine",
            specialization=payload.specialization,
            avg_consult_time=10.0,
            status="available",
            is_available=True,
        )
        db.add(doctor)
        await db.flush()

    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(access_token=token, role=user.role, user_id=user.id, name=user.name)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(access_token=token, role=user.role, user_id=user.id, name=user.name)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        phone=current_user.phone,
        age=current_user.age,
        gender=current_user.gender,
        department=current_user.department,
        created_at=str(current_user.created_at),
    )
