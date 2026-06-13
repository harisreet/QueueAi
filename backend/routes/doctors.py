from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from datetime import datetime, date

from database import get_db
from models.user import User
from models.doctor import Doctor
from models.doctor_shift import DoctorShift
from models.queue import Queue
from models.consultation import ConsultationLog
from models.queue_schemas import DoctorCreate, DoctorUpdate, DoctorResponse, StartConsultationRequest, EndConsultationRequest, ShiftCreate, ShiftResponse
from auth.dependencies import get_current_user
from auth.jwt_handler import get_password_hash
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

    linked_user_id = current_user.id

    # If email + password provided, create a linked User account for the doctor
    if payload.email and payload.password:
        existing = await db.execute(select(User).where(User.email == payload.email))
        if existing.scalar_one_or_none():
            raise HTTPException(400, "A user with this email already exists")
        new_user = User(
            id=str(uuid.uuid4()),
            name=payload.name,
            email=payload.email,
            hashed_password=get_password_hash(payload.password),
            role="doctor",
            department=payload.department,
        )
        db.add(new_user)
        await db.flush()
        linked_user_id = new_user.id

    doc = Doctor(
        id=str(uuid.uuid4()),
        user_id=linked_user_id,
        name=payload.name,
        department=payload.department,
        specialization=payload.specialization,
        avg_consult_time=payload.avg_consult_time,
        status="available",
        is_available=True,
    )
    db.add(doc)
    await db.flush()
    return DoctorResponse(
        id=doc.id, user_id=doc.user_id, name=doc.name, department=doc.department,
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
            id=d.id, user_id=d.user_id, name=d.name, department=d.department,
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

    # Update doctor status to busy
    if entry.doctor_id:
        await db.execute(
            update(Doctor).where(Doctor.id == entry.doctor_id)
            .values(status="busy", is_available=False)
        )

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

    # Recalculate wait times for rest of queue now that a patient started consultation
    from routes.queue import _recalculate_queue
    await _recalculate_queue(db, entry.department, commit=False)
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

    # Set doctor back to available after consultation ends
    if entry.doctor_id:
        await db.execute(
            update(Doctor).where(Doctor.id == entry.doctor_id)
            .values(status="available", is_available=True)
        )

    # Recalculate downstream queue
    from routes.queue import _recalculate_queue
    await _recalculate_queue(db, entry.department, commit=False)
    await db.commit()

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


@router.get("/{doctor_id}/shifts", response_model=list[ShiftResponse])
async def list_doctor_shifts(
    doctor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all shifts scheduled for a doctor."""
    result = await db.execute(
        select(DoctorShift)
        .where(DoctorShift.doctor_id == doctor_id)
        .order_by(DoctorShift.start_time.asc())
    )
    return result.scalars().all()


@router.post("/{doctor_id}/shifts", response_model=ShiftResponse, status_code=201)
async def create_doctor_shift(
    doctor_id: str,
    payload: ShiftCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new scheduled shift block for a doctor."""
    # Authenticate: Only doctor themselves, receptionist, or admin can schedule/edit shifts
    if current_user.role not in ("admin", "receptionist"):
        # Check if the doctor matches the logged in user
        dr_res = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
        doc = dr_res.scalar_one_or_none()
        if not doc or doc.user_id != current_user.id:
            raise HTTPException(403, "Insufficient permissions to edit this doctor's shifts")

    if payload.start_time >= payload.end_time:
        raise HTTPException(400, "Shift start time must be before end time")

    # Check for overlaps
    overlap_res = await db.execute(
        select(DoctorShift).where(
            DoctorShift.doctor_id == doctor_id,
            DoctorShift.start_time < payload.end_time,
            DoctorShift.end_time > payload.start_time,
        )
    )
    if overlap_res.scalar_one_or_none():
        raise HTTPException(400, "This shift overlaps with an existing scheduled shift")

    shift = DoctorShift(
        id=str(uuid.uuid4()),
        doctor_id=doctor_id,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    db.add(shift)
    await db.commit()
    
    # Broadcast status change to keep the UI refreshed
    await manager.broadcast_global("doctor_status_changed", {"doctor_id": doctor_id, "status": "shift_added"})
    
    return shift


@router.delete("/shifts/{shift_id}")
async def delete_doctor_shift(
    shift_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete/cancel a scheduled shift."""
    result = await db.execute(select(DoctorShift).where(DoctorShift.id == shift_id))
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(404, "Shift not found")

    # Auth check: only doctor themselves, receptionist, or admin
    if current_user.role not in ("admin", "receptionist"):
        dr_res = await db.execute(select(Doctor).where(Doctor.id == shift.doctor_id))
        doc = dr_res.scalar_one_or_none()
        if not doc or doc.user_id != current_user.id:
            raise HTTPException(403, "Insufficient permissions to delete this shift")

    await db.delete(shift)
    await db.commit()
    
    await manager.broadcast_global("doctor_status_changed", {"doctor_id": shift.doctor_id, "status": "shift_deleted"})
    return {"message": "Shift deleted", "shift_id": shift_id}
