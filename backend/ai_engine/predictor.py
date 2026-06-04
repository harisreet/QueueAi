"""
QueueCare AI — XGBoost Waiting Time Prediction Engine
Hybrid: Rule-Based Baseline + AI Correction Layer
"""
import os
import json
import numpy as np
import pandas as pd
import joblib
from datetime import datetime
from typing import Optional
from core.config import settings


DEPARTMENT_MAP = {
    "Cardiology": 0, "Orthopedics": 1, "Neurology": 2, "Pediatrics": 3,
    "General Medicine": 4, "Emergency": 5, "Dermatology": 6, "ENT": 7,
    "Gynecology": 8, "Ophthalmology": 9, "Psychiatry": 10, "Radiology": 11,
}

TIME_MAP = {"morning": 0, "afternoon": 1, "evening": 2, "night": 3}
DAY_MAP = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
           "Friday": 4, "Saturday": 5, "Sunday": 6}
PRIORITY_MAP = {"normal": 0, "urgent": 1, "emergency": 2}
COMPLEXITY_MAP = {"routine": 0, "moderate": 1, "complex": 2}

# Peak-hour weights per department
DEPT_PEAK_WEIGHTS = {
    "Emergency": 1.4, "Cardiology": 1.3, "Pediatrics": 1.2,
    "General Medicine": 1.25, "Orthopedics": 1.15,
}

MODEL_VERSION = "v1.0"
_model = None
_model_loaded = False


def _load_model():
    global _model, _model_loaded
    try:
        model_path = os.path.abspath(settings.MODEL_PATH)
        if os.path.exists(model_path):
            _model = joblib.load(model_path)
            _model_loaded = True
            print(f"[AI Engine] XGBoost model loaded from {model_path}")
        else:
            print(f"[AI Engine] Model not found at {model_path}. Using rule-based fallback.")
            _model_loaded = False
    except Exception as e:
        print(f"[AI Engine] Model load error: {e}. Using rule-based fallback.")
        _model_loaded = False


_load_model()


def _baseline_estimate(
    queue_length: int,
    doctors_available: int,
    avg_consult_time: float,
    emergency_cases: int,
    department: str,
) -> float:
    """Layer 1 — Rule-based formula with emergency interruption penalty."""
    if doctors_available <= 0:
        doctors_available = 1
    base = (queue_length * avg_consult_time) / doctors_available
    emergency_penalty = emergency_cases * avg_consult_time * 0.5
    dept_weight = DEPT_PEAK_WEIGHTS.get(department, 1.0)
    return round((base + emergency_penalty) * dept_weight, 2)


def _is_peak_hour(time_of_day: str, weekday: str) -> bool:
    peak_times = {"morning", "afternoon"}
    peak_days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}
    return time_of_day in peak_times and weekday in peak_days


def _get_peak_risk(time_of_day: str, weekday: str, department: str) -> str:
    if _is_peak_hour(time_of_day, weekday):
        if department in ("Emergency", "Cardiology", "General Medicine"):
            return "HIGH"
        return "MEDIUM"
    return "LOW"


def _build_feature_vector(
    queue_length: int,
    doctors_available: int,
    avg_consult_time: float,
    emergency_cases: int,
    department: str,
    time_of_day: str,
    weekday: str,
    patient_priority: str,
    consultation_complexity: str,
) -> np.ndarray:
    is_peak = int(_is_peak_hour(time_of_day, weekday))
    return np.array([[
        queue_length,
        doctors_available,
        avg_consult_time,
        emergency_cases,
        DEPARTMENT_MAP.get(department, 4),
        TIME_MAP.get(time_of_day, 0),
        DAY_MAP.get(weekday, 0),
        PRIORITY_MAP.get(patient_priority, 0),
        COMPLEXITY_MAP.get(consultation_complexity, 0),
        is_peak,
        queue_length / max(doctors_available, 1),   # derived: load ratio
        emergency_cases / max(queue_length, 1),      # derived: emergency ratio
    ]], dtype=np.float32)


def _confidence_score(
    queue_length: int,
    doctors_available: int,
    model_loaded: bool,
) -> float:
    """Estimate confidence based on model availability and queue clarity."""
    base_conf = 0.91 if model_loaded else 0.78
    # More patients or fewer doctors = slightly less certain
    penalty = min(0.15, (queue_length / 50) * 0.1 + (1 / max(doctors_available, 1)) * 0.05)
    return round(max(0.60, base_conf - penalty), 2)


def predict_wait_time(
    queue_length: int,
    doctors_available: int,
    avg_consult_time: float,
    emergency_cases: int,
    department: str,
    time_of_day: Optional[str] = None,
    weekday: Optional[str] = None,
    patient_priority: str = "normal",
    consultation_complexity: str = "routine",
) -> dict:
    """
    Hybrid prediction:
    Layer 1 — Rule-based baseline
    Layer 2 — XGBoost AI correction (if model available)
    """
    now = datetime.utcnow()
    if not time_of_day:
        h = now.hour
        time_of_day = "morning" if h < 12 else "afternoon" if h < 17 else "evening" if h < 21 else "night"
    if not weekday:
        weekday = now.strftime("%A")

    baseline = _baseline_estimate(
        queue_length, doctors_available, avg_consult_time, emergency_cases, department
    )

    ai_prediction = baseline
    ai_adjustment = 0.0

    if _model_loaded and _model is not None:
        try:
            X = _build_feature_vector(
                queue_length, doctors_available, avg_consult_time, emergency_cases,
                department, time_of_day, weekday, patient_priority, consultation_complexity
            )
            ai_prediction = float(_model.predict(X)[0])
            ai_adjustment = round(ai_prediction - baseline, 2)
        except Exception as e:
            print(f"[AI Engine] Prediction error: {e}. Using baseline.")
            ai_prediction = baseline

    # Priority boost
    priority_mult = {"normal": 1.0, "urgent": 0.85, "emergency": 0.5}
    final_wait = round(ai_prediction * priority_mult.get(patient_priority, 1.0), 1)

    confidence = _confidence_score(queue_length, doctors_available, _model_loaded)
    peak_risk = _get_peak_risk(time_of_day, weekday, department)

    # Smart recommendation
    if peak_risk == "HIGH" and final_wait > 30:
        recommendation = f"High congestion period. Consider visiting after 3 PM for ~40% shorter wait."
    elif final_wait > 60:
        recommendation = "Long wait expected. Appointment booking recommended."
    elif final_wait < 15:
        recommendation = "Short wait expected. Please check in at reception."
    else:
        recommendation = "Moderate wait. Staff will notify you before your turn."

    return {
        "predicted_wait_time": final_wait,
        "confidence": confidence,
        "baseline_estimate": baseline,
        "ai_adjustment": ai_adjustment,
        "peak_hour_risk": peak_risk,
        "recommendation": recommendation,
        "model_version": MODEL_VERSION,
        "model_active": _model_loaded,
    }


def get_peak_hour_forecast(department: str) -> list[dict]:
    """Return hourly congestion forecast for a department."""
    hours = []
    base_load = {
        "Emergency": 1.4, "Cardiology": 1.3, "General Medicine": 1.25,
        "Pediatrics": 1.2, "Orthopedics": 1.1,
    }.get(department, 1.0)

    hourly_pattern = [
        0.3, 0.2, 0.2, 0.2, 0.3, 0.5, 0.7, 0.9,  # 0–7
        1.0, 1.2, 1.3, 1.2, 1.0, 1.1, 0.9, 0.8,  # 8–15
        0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.2,  # 16–23
    ]
    for h, factor in enumerate(hourly_pattern):
        load = round(factor * base_load * 100, 0)
        hours.append({
            "hour": h,
            "label": f"{h:02d}:00",
            "load_percent": min(100, int(load)),
            "risk": "HIGH" if load > 100 else "MEDIUM" if load > 60 else "LOW",
        })
    return hours


def reload_model():
    """Hot-reload the model from disk (for retraining endpoint)."""
    global _model, _model_loaded
    _model = None
    _model_loaded = False
    _load_model()
    return _model_loaded
