"""
QueueCare AI — FastAPI Main Application
"""
import os
import sys

# Ensure backend root is on path
sys.path.insert(0, os.path.dirname(__file__))

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import settings
from database.connection import engine, Base

# Import all models so SQLAlchemy registers them
from models import User, Doctor, Queue, ConsultationLog, PredictionHistory  # noqa: F401

from routes.auth import router as auth_router
from routes.queue import router as queue_router
from routes.doctors import router as doctor_router
from routes.analytics import router as analytics_router
from routes.ai import router as ai_router
from routes.users import router as users_router
from websocket.manager import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[INFO] QueueCare AI backend started - database tables ready")
    yield
    await engine.dispose()
    print("[INFO] QueueCare AI backend stopped")


app = FastAPI(
    title="QueueCare AI",
    description="AI-powered hospital queue prediction & optimization platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(queue_router)
app.include_router(doctor_router)
app.include_router(analytics_router)
app.include_router(ai_router)
app.include_router(users_router)


# ── WebSocket Endpoints ────────────────────────────────────────────────────────

@app.websocket("/ws/global")
async def ws_global(websocket: WebSocket):
    """Global broadcast channel — admin/reception dashboards."""
    await manager.connect(websocket, "global")
    try:
        while True:
            await websocket.receive_text()  # keep-alive
    except WebSocketDisconnect:
        manager.disconnect(websocket, "global")


@app.websocket("/ws/department/{department}")
async def ws_department(websocket: WebSocket, department: str):
    """Department-level queue channel."""
    await manager.connect(websocket, f"dept:{department}")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, f"dept:{department}")


@app.websocket("/ws/patient/{patient_id}")
async def ws_patient(websocket: WebSocket, patient_id: str):
    """Personal notification channel for a patient."""
    await manager.connect(websocket, f"patient:{patient_id}", client_id=patient_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, f"patient:{patient_id}", client_id=patient_id)


# ── Health Check ───────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy", "service": "QueueCare AI Backend", "version": "1.0.0"}


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to QueueCare AI API",
        "docs": "/docs",
        "health": "/health",
    }
