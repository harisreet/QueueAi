from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ── Queue Schemas ──────────────────────────────────────────────────────────────

class BookTokenRequest(BaseModel):
    department: str
    doctor_id: Optional[str] = None
    priority: str = "normal"        # normal | urgent | emergency
    complexity: str = "routine"     # routine | moderate | complex
    appointment_time: Optional[datetime] = None
    patient_name: Optional[str] = None  # Walk-in override — used by receptionists/admin


class QueueStatusResponse(BaseModel):
    id: str
    token_no: str
    patient_id: str
    patient_name: str
    doctor_id: Optional[str]
    department: str
    queue_position: int
    predicted_wait: float
    confidence_score: float
    priority: str
    status: str
    complexity: str
    is_emergency: bool
    checkin_time: str
    created_at: str

    class Config:
        from_attributes = True


class UpdateQueueStatusRequest(BaseModel):
    queue_id: str
    status: str  # waiting | in_consultation | completed | delayed | cancelled


# ── Doctor Schemas ─────────────────────────────────────────────────────────────

class DoctorCreate(BaseModel):
    name: str
    department: str
    specialization: Optional[str] = None
    avg_consult_time: float = 10.0
    email: Optional[str] = None
    password: Optional[str] = None


class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    specialization: Optional[str] = None
    avg_consult_time: Optional[float] = None
    status: Optional[str] = None
    is_available: Optional[bool] = None


class DoctorResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    name: str
    department: str
    specialization: Optional[str]
    avg_consult_time: float
    status: str
    is_available: bool
    patients_served_today: int

    class Config:
        from_attributes = True


class StartConsultationRequest(BaseModel):
    queue_id: str


class EndConsultationRequest(BaseModel):
    queue_id: str
    notes: Optional[str] = None


# ── AI Prediction Schemas ──────────────────────────────────────────────────────

class PredictWaitRequest(BaseModel):
    queue_length: int = Field(..., ge=0)
    doctors_available: int = Field(..., ge=1)
    avg_consult_time: float = Field(..., gt=0)
    emergency_cases: int = Field(0, ge=0)
    department: str
    time_of_day: str  # morning | afternoon | evening | night
    weekday: str      # Monday ... Sunday
    patient_priority: str = "normal"
    consultation_complexity: str = "routine"


class PredictWaitResponse(BaseModel):
    predicted_wait_time: float
    confidence: float
    baseline_estimate: float
    ai_adjustment: float
    peak_hour_risk: str
    recommendation: str


# ── Analytics Schemas ──────────────────────────────────────────────────────────

class AnalyticsSummary(BaseModel):
    total_patients_today: int
    avg_wait_time: float
    current_queue_length: int
    active_doctors: int
    completed_consultations: int
    prediction_accuracy: float
    delay_probability: float
    peak_hour_forecast: str


# ── Doctor Shift Schemas ───────────────────────────────────────────────────────

class ShiftCreate(BaseModel):
    start_time: datetime
    end_time: datetime


class ShiftResponse(BaseModel):
    id: str
    doctor_id: str
    start_time: datetime
    end_time: datetime

    class Config:
        from_attributes = True

