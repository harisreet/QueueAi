import uuid
from datetime import datetime
from sqlalchemy import String, Float, DateTime, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from database.connection import Base


class Queue(Base):
    __tablename__ = "queue"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    token_no: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    patient_name: Mapped[str] = mapped_column(String(100), nullable=False)
    doctor_id: Mapped[str | None] = mapped_column(String, nullable=True)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    queue_position: Mapped[int] = mapped_column(Integer, nullable=False)
    predicted_wait: Mapped[float] = mapped_column(Float, default=0.0)  # minutes
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    priority: Mapped[str] = mapped_column(String(20), default="normal")  # normal, urgent, emergency
    status: Mapped[str] = mapped_column(String(30), default="waiting")  # waiting, in_consultation, completed, delayed, cancelled
    complexity: Mapped[str] = mapped_column(String(20), default="routine")  # routine, moderate, complex
    is_emergency: Mapped[bool] = mapped_column(Boolean, default=False)
    appointment_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    checkin_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
