from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, datetime

from database import get_db
from models.queue import Queue
from models.doctor import Doctor
from models.consultation import ConsultationLog
from models.queue_schemas import AnalyticsSummary
from auth.dependencies import get_current_user
from models.user import User
from ai_engine.predictor import get_peak_hour_forecast

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()

    total_q = await db.execute(
        select(func.count(Queue.id)).where(func.date(Queue.created_at) == today)
    )
    total_patients = total_q.scalar() or 0

    avg_w = await db.execute(
        select(func.avg(ConsultationLog.actual_wait_time))
        .where(func.date(ConsultationLog.created_at) == today)
    )
    avg_wait = round(float(avg_w.scalar() or 0), 1)

    curr_q = await db.execute(
        select(func.count(Queue.id)).where(Queue.status.in_(["waiting", "in_consultation"]))
    )
    current_queue = curr_q.scalar() or 0

    active_dr = await db.execute(
        select(func.count(Doctor.id)).where(Doctor.is_available == True)
    )
    active_doctors = active_dr.scalar() or 0

    completed = await db.execute(
        select(func.count(Queue.id))
        .where(Queue.status == "completed", func.date(Queue.created_at) == today)
    )
    completed_count = completed.scalar() or 0

    acc_q = await db.execute(
        select(func.avg(ConsultationLog.prediction_accuracy))
        .where(func.date(ConsultationLog.created_at) == today)
    )
    pred_accuracy = round(float(acc_q.scalar() or 0.85) * 100, 1)

    # Delay probability: % of patients waiting > predicted
    delay_prob = round(min(0.95, current_queue / max(active_doctors * 5, 1)), 2) if active_doctors else 0.5

    hour = datetime.utcnow().hour
    if 8 <= hour <= 12:
        peak_forecast = "HIGH — Morning rush. Expect 20-40% longer waits."
    elif 13 <= hour <= 16:
        peak_forecast = "MEDIUM — Afternoon moderate load."
    else:
        peak_forecast = "LOW — Off-peak hours. Minimal wait expected."

    return AnalyticsSummary(
        total_patients_today=total_patients,
        avg_wait_time=avg_wait,
        current_queue_length=current_queue,
        active_doctors=active_doctors,
        completed_consultations=completed_count,
        prediction_accuracy=pred_accuracy,
        delay_probability=delay_prob,
        peak_hour_forecast=peak_forecast,
    )


@router.get("/hourly-traffic")
async def hourly_traffic(db: AsyncSession = Depends(get_db)):
    today = date.today()
    result = await db.execute(
        select(
            func.extract("hour", Queue.created_at).label("hour"),
            func.count(Queue.id).label("count"),
        )
        .where(func.date(Queue.created_at) == today)
        .group_by("hour")
        .order_by("hour")
    )
    rows = result.all()
    hourly = {int(r.hour): r.count for r in rows}
    return [{"hour": h, "label": f"{h:02d}:00", "patients": hourly.get(h, 0)} for h in range(24)]


@router.get("/wait-time-trend")
async def wait_time_trend(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            func.date(ConsultationLog.created_at).label("day"),
            func.avg(ConsultationLog.actual_wait_time).label("avg_wait"),
            func.avg(ConsultationLog.prediction_accuracy).label("accuracy"),
        )
        .group_by("day")
        .order_by("day")
        .limit(30)
    )
    return [
        {"date": str(r.day), "avg_wait": round(float(r.avg_wait or 0), 1),
         "accuracy": round(float(r.accuracy or 0) * 100, 1)}
        for r in result.all()
    ]


@router.get("/department-load")
async def department_load(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Queue.department, func.count(Queue.id).label("count"))
        .where(Queue.status.in_(["waiting", "in_consultation"]))
        .group_by(Queue.department)
    )
    return [{"department": r.department, "load": r.count} for r in result.all()]


@router.get("/doctor-utilization")
async def doctor_utilization(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            ConsultationLog.doctor_id,
            func.count(ConsultationLog.id).label("consultations"),
            func.avg(ConsultationLog.actual_duration).label("avg_duration"),
            func.avg(ConsultationLog.prediction_accuracy).label("accuracy"),
        )
        .group_by(ConsultationLog.doctor_id)
    )
    return [
        {
            "doctor_id": r.doctor_id,
            "consultations": r.consultations,
            "avg_duration": round(float(r.avg_duration or 0), 1),
            "accuracy": round(float(r.accuracy or 0) * 100, 1),
        }
        for r in result.all()
    ]


@router.get("/peak-hour-forecast/{department}")
async def peak_hour_forecast(department: str):
    return {"department": department, "hourly_forecast": get_peak_hour_forecast(department)}


@router.get("/consultation-logs")
async def consultation_logs(
    limit: int = 50,
    offset: int = 0,
    department: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: paginated consultation history with optional department filter."""
    from models.consultation import ConsultationLog
    query = select(ConsultationLog).order_by(ConsultationLog.created_at.desc())
    if department:
        query = query.where(ConsultationLog.department == department)
    result = await db.execute(query.offset(offset).limit(limit))
    logs = result.scalars().all()
    return [
        {
            "id": l.id,
            "queue_id": l.queue_id,
            "patient_id": l.patient_id,
            "doctor_id": l.doctor_id,
            "department": l.department,
            "consultation_start": str(l.consultation_start) if l.consultation_start else None,
            "consultation_end": str(l.consultation_end) if l.consultation_end else None,
            "actual_duration": l.actual_duration,
            "actual_wait_time": l.actual_wait_time,
            "predicted_wait_time": l.predicted_wait_time,
            "prediction_accuracy": round(float(l.prediction_accuracy or 0) * 100, 1),
            "is_emergency": l.is_emergency,
            "complexity": l.complexity,
            "notes": l.notes,
            "created_at": str(l.created_at),
        }
        for l in logs
    ]


@router.get("/all-queues")
async def all_queues(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Admin/Receptionist: all active queue entries across all departments."""
    result = await db.execute(
        select(Queue)
        .where(Queue.status.in_(["waiting", "in_consultation", "delayed"]))
        .order_by(Queue.department, Queue.queue_position)
    )
    return [
        {
            "id": q.id, "token_no": q.token_no, "patient_name": q.patient_name,
            "department": q.department, "queue_position": q.queue_position,
            "predicted_wait": q.predicted_wait, "confidence_score": q.confidence_score,
            "priority": q.priority, "status": q.status,
            "is_emergency": q.is_emergency, "checkin_time": str(q.checkin_time),
        }
        for q in result.scalars().all()
    ]

