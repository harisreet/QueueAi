from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from datetime import datetime
import uuid

from database import get_db
from models.user import User
from models.queue import Queue
from models.doctor import Doctor
from models.queue_schemas import (
    BookTokenRequest, QueueStatusResponse, UpdateQueueStatusRequest
)
from auth.dependencies import get_current_user
from ai_engine.predictor import predict_wait_time
from websocket.manager import manager

router = APIRouter(prefix="/queue", tags=["Queue"])


def _get_time_of_day(dt: datetime) -> str:
    h = dt.hour
    if h < 12: return "morning"
    if h < 17: return "afternoon"
    if h < 21: return "evening"
    return "night"


async def _next_token(db: AsyncSession, department: str) -> str:
    prefix = department[:3].upper()
    result = await db.execute(
        select(func.count(Queue.id)).where(
            func.date(Queue.created_at) == datetime.utcnow().date(),
            Queue.department == department,
        )
    )
    count = result.scalar() or 0
    return f"{prefix}{count + 1:03d}"


PRIORITY_ORDER = {"emergency": 0, "urgent": 1, "normal": 2}


async def _recalculate_queue(db: AsyncSession, department: str, commit: bool = True):
    """Recalculate predicted wait times for all waiting patients using triage ordering."""
    result = await db.execute(
        select(Queue).where(
            Queue.department == department,
            Queue.status == "waiting",
        )
    )
    waiting = list(result.scalars().all())

    # Sort by triage: emergency first, then urgent, then normal, then by check-in time
    waiting.sort(key=lambda q: (
        PRIORITY_ORDER.get(q.priority, 2),
        0 if q.is_emergency else 1,
        q.checkin_time or datetime.utcnow(),
    ))

    # Fetch available doctors
    dr = await db.execute(
        select(Doctor).where(Doctor.department == department, Doctor.is_available == True)
    )
    doctors = dr.scalars().all()
    doctors_count = max(1, len(doctors))
    avg_time = sum(d.avg_consult_time for d in doctors) / doctors_count if doctors else 10.0

    # Count ongoing consultation (occupies a doctor slot)
    in_consult = await db.execute(
        select(func.count(Queue.id)).where(
            Queue.department == department, Queue.status == "in_consultation"
        )
    )
    in_consult_count = in_consult.scalar() or 0
    effective_doctors = max(1, doctors_count - in_consult_count)

    # Emergency count
    emg = sum(1 for q in waiting if q.is_emergency)
    now = datetime.utcnow()
    tod = _get_time_of_day(now)
    day = now.strftime("%A")

    cumulative_wait = 0.0
    for i, entry in enumerate(waiting):
        pred = predict_wait_time(
            queue_length=i + 1,
            doctors_available=effective_doctors,
            avg_consult_time=avg_time,
            emergency_cases=emg,
            department=department,
            time_of_day=tod,
            weekday=day,
            patient_priority=entry.priority,
            consultation_complexity=entry.complexity,
        )
        # Cumulative wait so positions further back account for those ahead
        slot_wait = pred["predicted_wait_time"]
        cumulative_wait = max(cumulative_wait, slot_wait) if i == 0 else cumulative_wait + avg_time * (1.0 / effective_doctors)
        await db.execute(
            update(Queue)
            .where(Queue.id == entry.id)
            .values(
                queue_position=i + 1,
                predicted_wait=round(slot_wait + (i * avg_time / effective_doctors), 1),
                confidence_score=pred["confidence"],
            )
        )
    if commit:
        await db.commit()

    # Broadcast via WebSocket
    refreshed = await db.execute(
        select(Queue).where(Queue.department == department, Queue.status == "waiting").order_by(Queue.queue_position)
    )
    queue_list = [
        {"token_no": q.token_no, "patient_name": q.patient_name,
         "position": q.queue_position, "predicted_wait": q.predicted_wait,
         "priority": q.priority, "status": q.status, "is_emergency": q.is_emergency}
        for q in refreshed.scalars().all()
    ]
    await manager.broadcast_queue_update(department, queue_list)



@router.post("/book-token", response_model=QueueStatusResponse, status_code=201)
async def book_token(
    payload: BookTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only patients and receptionists can book tokens
    if current_user.role not in ("patient", "receptionist", "admin"):
        raise HTTPException(403, "Only patients or receptionists can book tokens")

    # Prevent duplicate active token in same department
    existing = await db.execute(
        select(Queue).where(
            Queue.patient_id == current_user.id,
            Queue.department == payload.department,
            Queue.status.in_(["waiting", "in_consultation"]),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "You already have an active token in this department")

    # Get doctors available in department
    dr = await db.execute(
        select(Doctor).where(Doctor.department == payload.department, Doctor.is_available == True)
    )
    doctors = dr.scalars().all()
    doctors_count = max(1, len(doctors))
    avg_time = sum(d.avg_consult_time for d in doctors) / doctors_count if doctors else 10.0

    # Current queue length
    ql_result = await db.execute(
        select(func.count(Queue.id)).where(
            Queue.department == payload.department, Queue.status == "waiting"
        )
    )
    queue_len = (ql_result.scalar() or 0) + 1

    emg_result = await db.execute(
        select(func.count(Queue.id)).where(
            Queue.department == payload.department,
            Queue.is_emergency == True,
            Queue.status == "waiting",
        )
    )
    emergency_count = emg_result.scalar() or 0

    now = datetime.utcnow()
    pred = predict_wait_time(
        queue_length=queue_len,
        doctors_available=doctors_count,
        avg_consult_time=avg_time,
        emergency_cases=emergency_count,
        department=payload.department,
        patient_priority=payload.priority,
        consultation_complexity=payload.complexity,
    )

    token = await _next_token(db, payload.department)
    is_emergency = payload.priority == "emergency"

    # Initial position — triage recalc will re-order properly after insert
    position = queue_len

    # Receptionists/admins can register walk-in patients by name
    effective_patient_name = (
        payload.patient_name.strip()
        if payload.patient_name and current_user.role in ("receptionist", "admin")
        else current_user.name
    )

    entry = Queue(
        id=str(uuid.uuid4()),
        token_no=token,
        patient_id=current_user.id,
        patient_name=effective_patient_name,
        doctor_id=payload.doctor_id,
        department=payload.department,
        queue_position=position,
        predicted_wait=pred["predicted_wait_time"],
        confidence_score=pred["confidence"],
        priority=payload.priority,
        complexity=payload.complexity,
        is_emergency=is_emergency,
        appointment_time=payload.appointment_time,
        checkin_time=datetime.utcnow(),
    )
    db.add(entry)
    await db.flush()

    # Recalculate entire queue with triage ordering — this will re-rank this patient correctly
    await _recalculate_queue(db, payload.department)

    # Refresh entry to get recalculated position
    await db.refresh(entry)

    # Notify patient
    await manager.send_to_patient(current_user.id, "token_booked", {
        "token_no": token,
        "predicted_wait": entry.predicted_wait,
        "position": entry.queue_position,
        "department": payload.department,
        "is_emergency": is_emergency,
    })

    return QueueStatusResponse(
        id=entry.id, token_no=entry.token_no, patient_id=entry.patient_id,
        patient_name=entry.patient_name, doctor_id=entry.doctor_id,
        department=entry.department, queue_position=entry.queue_position,
        predicted_wait=entry.predicted_wait, confidence_score=entry.confidence_score,
        priority=entry.priority, status=entry.status, complexity=entry.complexity,
        is_emergency=entry.is_emergency, checkin_time=str(entry.checkin_time),
        created_at=str(entry.created_at),
    )


@router.get("/status/{department}", response_model=list[QueueStatusResponse])
async def get_queue_status(department: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Queue)
        .where(Queue.department == department, Queue.status.in_(["waiting", "in_consultation"]))
        .order_by(Queue.queue_position)
    )
    return [
        QueueStatusResponse(
            id=q.id, token_no=q.token_no, patient_id=q.patient_id,
            patient_name=q.patient_name, doctor_id=q.doctor_id,
            department=q.department, queue_position=q.queue_position,
            predicted_wait=q.predicted_wait, confidence_score=q.confidence_score,
            priority=q.priority, status=q.status, complexity=q.complexity,
            is_emergency=q.is_emergency, checkin_time=str(q.checkin_time),
            created_at=str(q.created_at),
        )
        for q in result.scalars().all()
    ]


@router.get("/my-token", response_model=list[QueueStatusResponse])
async def get_my_tokens(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Queue).where(Queue.patient_id == current_user.id).order_by(Queue.created_at.desc()).limit(10)
    )
    return [
        QueueStatusResponse(
            id=q.id, token_no=q.token_no, patient_id=q.patient_id,
            patient_name=q.patient_name, doctor_id=q.doctor_id,
            department=q.department, queue_position=q.queue_position,
            predicted_wait=q.predicted_wait, confidence_score=q.confidence_score,
            priority=q.priority, status=q.status, complexity=q.complexity,
            is_emergency=q.is_emergency, checkin_time=str(q.checkin_time),
            created_at=str(q.created_at),
        )
        for q in result.scalars().all()
    ]


@router.post("/update-status")
async def update_status(
    payload: UpdateQueueStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Queue).where(Queue.id == payload.queue_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Queue entry not found")

    old_status = entry.status
    await db.execute(update(Queue).where(Queue.id == payload.queue_id).values(status=payload.status))
    await db.commit()

    if payload.status in ("completed", "cancelled") and old_status != payload.status:
        await _recalculate_queue(db, entry.department)

    return {"message": f"Status updated to {payload.status}", "queue_id": payload.queue_id}
