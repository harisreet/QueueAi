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


async def _recalculate_queue(db: AsyncSession, department: str):
    """Recalculate predicted wait times for all waiting patients."""
    result = await db.execute(
        select(Queue).where(
            Queue.department == department,
            Queue.status == "waiting",
        ).order_by(Queue.queue_position)
    )
    waiting = result.scalars().all()

    # Fetch available doctors
    dr = await db.execute(
        select(Doctor).where(Doctor.department == department, Doctor.is_available == True)
    )
    doctors = dr.scalars().all()
    doctors_count = max(1, len(doctors))
    avg_time = sum(d.avg_consult_time for d in doctors) / doctors_count if doctors else 10.0

    # Emergency count
    emg = sum(1 for q in waiting if q.is_emergency)
    now = datetime.utcnow()
    tod = _get_time_of_day(now)
    day = now.strftime("%A")

    for i, entry in enumerate(waiting):
        # For each patient, queue_length is their position
        pred = predict_wait_time(
            queue_length=i + 1,
            doctors_available=doctors_count,
            avg_consult_time=avg_time,
            emergency_cases=emg,
            department=department,
            time_of_day=tod,
            weekday=day,
            patient_priority=entry.priority,
            consultation_complexity=entry.complexity,
        )
        await db.execute(
            update(Queue)
            .where(Queue.id == entry.id)
            .values(
                queue_position=i + 1,
                predicted_wait=pred["predicted_wait_time"],
                confidence_score=pred["confidence"],
            )
        )
    await db.commit()

    # Broadcast via WebSocket
    refreshed = await db.execute(
        select(Queue).where(Queue.department == department, Queue.status == "waiting").order_by(Queue.queue_position)
    )
    queue_list = [
        {"token_no": q.token_no, "patient_name": q.patient_name,
         "position": q.queue_position, "predicted_wait": q.predicted_wait,
         "priority": q.priority, "status": q.status}
        for q in refreshed.scalars().all()
    ]
    await manager.broadcast_queue_update(department, queue_list)


@router.post("/book-token", response_model=QueueStatusResponse, status_code=201)
async def book_token(
    payload: BookTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    # Emergency patients jump to position 1
    position = 1 if is_emergency else queue_len

    entry = Queue(
        id=str(uuid.uuid4()),
        token_no=token,
        patient_id=current_user.id,
        patient_name=current_user.name,
        doctor_id=payload.doctor_id,
        department=payload.department,
        queue_position=position,
        predicted_wait=pred["predicted_wait_time"],
        confidence_score=pred["confidence"],
        priority=payload.priority,
        complexity=payload.complexity,
        is_emergency=is_emergency,
        appointment_time=payload.appointment_time,
    )
    db.add(entry)
    await db.flush()

    # Notify patient
    await manager.send_to_patient(current_user.id, "token_booked", {
        "token_no": token,
        "predicted_wait": pred["predicted_wait_time"],
        "position": position,
        "department": payload.department,
    })

    # Recalculate rest of queue
    await _recalculate_queue(db, payload.department)

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
