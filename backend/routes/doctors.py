from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from datetime import datetime, date

from database import get_db
from models.user import User
from models.doctor import Doctor
from models.queue import Queue
from models.consultation import ConsultationLog
from models.queue_schemas import DoctorCreate, DoctorUpdate, DoctorResponse, StartConsultationRequest, EndConsultationRequest
from auth.dependencies import get_current_user
from websocket.manager import manager
import uuid

router = APIRouter(prefix="/doctors", tags=["Doctors"])


@router.post("/", response_model=DoctorResponse, status_code=201)
async def create_doctor(
    payload: DoctorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "receptionist"):
        raise HTTPException(403, "Insufficient permissions")

    doc = Doctor(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=payload.name,
        department=payload.department,
        specialization=payload.specialization,
        avg_consult_time=payload.avg_consult_time,
    )
    db.add(doc)
    await db.flush()
    return DoctorResponse(
        id=doc.id, name=doc.name, department=doc.department,
        specialization=doc.specialization, avg_consult_time=doc.avg_consult_time,
        status=doc.status, is_available=doc.is_available,
        patients_served_today=doc.patients_served_today,
    )


@router.get("/", response_model=list[DoctorResponse])
async def list_doctors(department: str | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Doctor)
    if department:
        query = query.where(Doctor.department == department)
    result = await db.execute(query)
    return [
        DoctorResponse(
            id=d.id, name=d.name, department=d.department,
            specialization=d.specialization, avg_consult_time=d.avg_consult_time,
            status=d.status, is_available=d.is_available,
            patients_served_today=d.patients_served_today,
        )
        for d in result.scalars().all()
    ]


@router.get("/queue/{doctor_id}", response_model=list)
async def get_doctor_queue(
    doctor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Queue)
        .where(Queue.doctor_id == doctor_id, Queue.status.in_(["waiting", "in_consultation"]))
        .order_by(Queue.queue_position)
    )
    return [
        {
            "queue_id": q.id, "token_no": q.token_no, "patient_name": q.patient_name,
            "department": q.department, "priority": q.priority, "status": q.status,
            "complexity": q.complexity, "predicted_wait": q.predicted_wait,
            "is_emergency": q.is_emergency, "checkin_time": str(q.checkin_time),
        }
        for q in result.scalars().all()
    ]


@router.post("/start-consultation")
async def start_consultation(
    payload: StartConsultationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Queue).where(Queue.id == payload.queue_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Queue entry not found")

    now = datetime.utcnow()
    await db.execute(update(Queue).where(Queue.id == payload.queue_id).values(status="in_consultation"))

    # Create consultation log
    log = ConsultationLog(
        id=str(uuid.uuid4()),
        queue_id=entry.id,
        patient_id=entry.patient_id,
        doctor_id=entry.doctor_id or current_user.id,
        department=entry.department,
        consultation_start=now,
        predicted_wait_time=entry.predicted_wait,
        is_emergency=entry.is_emergency,
        complexity=entry.complexity,
    )
    db.add(log)
    await db.commit()

    await manager.send_to_patient(entry.patient_id, "consultation_started", {
        "token_no": entry.token_no, "message": "Your consultation has started!"
    })
    return {"message": "Consultation started", "consultation_id": log.id}


@router.post("/end-consultation")
async def end_consultation(
    payload: EndConsultationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Queue).where(Queue.id == payload.queue_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Queue entry not found")

    now = datetime.utcnow()
    await db.execute(update(Queue).where(Queue.id == payload.queue_id).values(status="completed"))

    # Update consultation log
    log_res = await db.execute(
        select(ConsultationLog).where(ConsultationLog.queue_id == payload.queue_id).order_by(ConsultationLog.created_at.desc())
    )
    log = log_res.scalar_one_or_none()
    if log and log.consultation_start:
        duration = (now - log.consultation_start).total_seconds() / 60
        checkin = entry.checkin_time
        actual_wait = (log.consultation_start - checkin).total_seconds() / 60
        accuracy = max(0, 1 - abs(entry.predicted_wait - actual_wait) / max(actual_wait, 1))

        await db.execute(
            update(ConsultationLog)
            .where(ConsultationLog.id == log.id)
            .values(
                consultation_end=now,
                actual_duration=round(duration, 2),
                actual_wait_time=round(actual_wait, 2),
                prediction_accuracy=round(accuracy, 4),
                notes=payload.notes,
            )
        )

        # Update doctor's rolling avg consult time
        if entry.doctor_id:
            dr_res = await db.execute(select(Doctor).where(Doctor.id == entry.doctor_id))
            doc = dr_res.scalar_one_or_none()
            if doc:
                new_avg = round(doc.avg_consult_time * 0.9 + duration * 0.1, 2)  # exponential moving avg
                await db.execute(
                    update(Doctor).where(Doctor.id == doc.id)
                    .values(avg_consult_time=new_avg, patients_served_today=doc.patients_served_today + 1)
                )

    await db.commit()

    # Recalculate downstream queue
    from routes.queue import _recalculate_queue
    await _recalculate_queue(db, entry.department)

    await manager.broadcast_global("consultation_ended", {"department": entry.department, "token_no": entry.token_no})
    return {"message": "Consultation ended", "queue_id": payload.queue_id}


@router.put("/{doctor_id}")
async def update_doctor(
    doctor_id: str,
    payload: DoctorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin/receptionist: update doctor profile info."""
    if current_user.role not in ("admin", "receptionist"):
        raise HTTPException(403, "Insufficient permissions")
    result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Doctor not found")
    updates = payload.model_dump(exclude_unset=True)
    if updates:
        await db.execute(update(Doctor).where(Doctor.id == doctor_id).values(**updates))
        await db.commit()
    return {"message": "Doctor updated", "doctor_id": doctor_id}


@router.delete("/{doctor_id}")
async def delete_doctor(
    doctor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin only: remove doctor record."""
    if current_user.role != "admin":
        raise HTTPException(403, "Admin only")
    result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Doctor not found")
    await db.delete(doc)
    await db.commit()
    return {"message": "Doctor deleted", "doctor_id": doctor_id}


@router.put("/{doctor_id}/status")
async def update_doctor_status(
    doctor_id: str,
    status: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_available = status == "available"
    await db.execute(
        update(Doctor).where(Doctor.id == doctor_id).values(status=status, is_available=is_available)
    )
    await db.commit()
    await manager.broadcast_global("doctor_status_changed", {"doctor_id": doctor_id, "status": status})
    return {"message": f"Doctor status set to {status}"}
