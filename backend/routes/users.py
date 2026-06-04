"""
Admin user management routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import Optional

from database import get_db
from models.user import User
from models.schemas import UserResponse
from auth.dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/", response_model=list[UserResponse])
async def list_users(
    role: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: list all users with optional role filter."""
    if current_user.role not in ("admin", "receptionist"):
        raise HTTPException(403, "Insufficient permissions")
    query = select(User)
    if role:
        query = query.where(User.role == role)
    result = await db.execute(query.order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [
        UserResponse(
            id=u.id, name=u.name, email=u.email, role=u.role,
            phone=u.phone, age=u.age, gender=u.gender,
            department=u.department, created_at=str(u.created_at),
        )
        for u in users
    ]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(403, "Insufficient permissions")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    return UserResponse(
        id=user.id, name=user.name, email=user.email, role=user.role,
        phone=user.phone, age=user.age, gender=user.gender,
        department=user.department, created_at=str(user.created_at),
    )


@router.put("/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, "Admin only")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    await db.execute(
        update(User).where(User.id == user_id).values(is_active=not user.is_active)
    )
    await db.commit()
    return {"message": f"User {'activated' if not user.is_active else 'deactivated'}", "user_id": user_id, "is_active": not user.is_active}


@router.put("/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, "Admin only")
    valid_roles = ("patient", "receptionist", "doctor", "admin")
    if role not in valid_roles:
        raise HTTPException(400, f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    await db.execute(update(User).where(User.id == user_id).values(role=role))
    await db.commit()
    return {"message": f"Role updated to {role}", "user_id": user_id}
