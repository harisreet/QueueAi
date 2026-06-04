from .auth import router as auth_router
from .queue import router as queue_router
from .doctors import router as doctor_router
from .analytics import router as analytics_router
from .ai import router as ai_router

__all__ = ["auth_router", "queue_router", "doctor_router", "analytics_router", "ai_router"]
