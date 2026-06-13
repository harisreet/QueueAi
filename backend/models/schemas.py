from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from enum import Enum


class UserRole(str, Enum):
    patient = "patient"
    receptionist = "receptionist"
    doctor = "doctor"
    admin = "admin"


class SignupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.patient
    phone: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=150)
    gender: Optional[str] = None
    department: Optional[str] = None
    specialization: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    name: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    phone: Optional[str]
    age: Optional[int]
    gender: Optional[str]
    department: Optional[str]
    created_at: str

    class Config:
        from_attributes = True
