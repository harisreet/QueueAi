import uuid
from datetime import datetime
from sqlalchemy import String, Float, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from database.connection import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    specialization: Mapped[str | None] = mapped_column(String(150), nullable=True)
    avg_consult_time: Mapped[float] = mapped_column(Float, default=10.0)  # in minutes
    status: Mapped[str] = mapped_column(String(30), default="available")  # available, busy, break, offline
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    patients_served_today: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
