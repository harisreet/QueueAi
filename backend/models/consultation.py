import uuid
from datetime import datetime
from sqlalchemy import String, Float, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from database.connection import Base


class ConsultationLog(Base):
    __tablename__ = "consultation_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    queue_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    doctor_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    consultation_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    consultation_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    actual_duration: Mapped[float | None] = mapped_column(Float, nullable=True)  # minutes
    actual_wait_time: Mapped[float | None] = mapped_column(Float, nullable=True)  # minutes
    predicted_wait_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    prediction_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_emergency: Mapped[bool] = mapped_column(Boolean, default=False)
    complexity: Mapped[str] = mapped_column(String(20), default="routine")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PredictionHistory(Base):
    __tablename__ = "prediction_history"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    queue_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(String, nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    predicted_wait: Mapped[float] = mapped_column(Float, nullable=False)
    actual_wait: Mapped[float | None] = mapped_column(Float, nullable=True)
    prediction_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_version: Mapped[str] = mapped_column(String(20), default="v1.0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
