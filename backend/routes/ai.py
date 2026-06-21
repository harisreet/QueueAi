from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from models.queue_schemas import PredictWaitRequest, PredictWaitResponse
from ai_engine.predictor import predict_wait_time, reload_model, get_peak_hour_forecast
from ai_engine.symptom_classifier import classify_symptoms
from auth.dependencies import get_current_user
from models.user import User

router = APIRouter(prefix="/ai", tags=["AI Engine"])


class SymptomRequest(BaseModel):
    symptoms: str


@router.post("/classify-symptoms")
async def classify_symptom_endpoint(payload: SymptomRequest):
    """
    Classify free-text patient symptoms into triage priority and complexity.
    No auth required — called live as patient types on booking form.
    """
    result = classify_symptoms(payload.symptoms)
    return {
        "priority":         result.priority,
        "complexity":       result.complexity,
        "matched_keywords": result.matched_keywords,
        "confidence":       result.confidence,
        "reasoning":        result.reasoning,
    }



@router.post("/predict-wait-time", response_model=PredictWaitResponse)
async def predict(payload: PredictWaitRequest):
    result = predict_wait_time(
        queue_length=payload.queue_length,
        doctors_available=payload.doctors_available,
        avg_consult_time=payload.avg_consult_time,
        emergency_cases=payload.emergency_cases,
        department=payload.department,
        time_of_day=payload.time_of_day,
        weekday=payload.weekday,
        patient_priority=payload.patient_priority,
        consultation_complexity=payload.consultation_complexity,
    )
    return PredictWaitResponse(**{k: result[k] for k in PredictWaitResponse.model_fields})


@router.post("/retrain-model")
async def retrain_model(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        from fastapi import HTTPException
        raise HTTPException(403, "Admin only")

    def _retrain():
        import subprocess, sys, os
        train_path = os.path.join(os.path.dirname(__file__), "..", "ai_engine", "train.py")
        subprocess.run([sys.executable, train_path], check=True)
        reload_model()

    background_tasks.add_task(_retrain)
    return {"message": "Model retraining started in background. This may take a few minutes."}


@router.get("/model-status")
async def model_status():
    from ai_engine.predictor import _model_loaded, MODEL_VERSION
    import os
    from core.config import settings
    model_path = os.path.abspath(settings.MODEL_PATH)
    return {
        "model_loaded": _model_loaded,
        "model_version": MODEL_VERSION,
        "model_path": model_path,
        "model_exists": os.path.exists(model_path),
    }
