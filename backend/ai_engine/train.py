"""
QueueCare AI — Synthetic Dataset Generator + XGBoost Model Training Pipeline
Run: python train.py
"""
import os
import sys
import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import mean_absolute_error, r2_score
import xgboost as xgb

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

RANDOM_SEED = 42
N_SAMPLES = 8000
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../ml-models"))
DATASET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../datasets"))

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(DATASET_DIR, exist_ok=True)

DEPARTMENTS = ["Cardiology","Orthopedics","Neurology","Pediatrics",
               "General Medicine","Emergency","Dermatology","ENT",
               "Gynecology","Ophthalmology","Psychiatry","Radiology"]
TIMES = ["morning","afternoon","evening","night"]
DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
PRIORITIES = ["normal","urgent","emergency"]
COMPLEXITIES = ["routine","moderate","complex"]

DEPT_BASE_TIMES = {
    "Emergency": 12, "Cardiology": 14, "Neurology": 16, "Orthopedics": 13,
    "General Medicine": 8, "Pediatrics": 9, "Dermatology": 7, "ENT": 8,
    "Gynecology": 12, "Ophthalmology": 10, "Psychiatry": 20, "Radiology": 11,
}

np.random.seed(RANDOM_SEED)


def generate_dataset(n: int = N_SAMPLES) -> pd.DataFrame:
    print(f"[Dataset] Generating {n} synthetic hospital queue records...")
    rows = []
    for _ in range(n):
        dept = np.random.choice(DEPARTMENTS)
        time_of_day = np.random.choice(TIMES, p=[0.35, 0.30, 0.20, 0.15])
        weekday = np.random.choice(DAYS, p=[0.18, 0.17, 0.16, 0.16, 0.15, 0.10, 0.08])
        priority = np.random.choice(PRIORITIES, p=[0.75, 0.18, 0.07])
        complexity = np.random.choice(COMPLEXITIES, p=[0.60, 0.30, 0.10])

        is_peak = int(time_of_day in ("morning","afternoon") and weekday in
                      ("Monday","Tuesday","Wednesday","Thursday","Friday"))

        doctors_available = np.random.randint(1, 6)
        queue_length = np.random.randint(1, 30) + (is_peak * np.random.randint(5, 15))
        emergency_cases = np.random.binomial(3, 0.1 if priority != "emergency" else 0.5)

        base_consult = DEPT_BASE_TIMES[dept]
        complexity_mult = {"routine": 1.0, "moderate": 1.35, "complex": 1.75}[complexity]
        avg_consult_time = max(5.0, np.random.normal(base_consult * complexity_mult, 2.0))

        # Ground-truth wait time (realistic formula + noise)
        base_wait = (queue_length * avg_consult_time) / doctors_available
        emergency_penalty = emergency_cases * avg_consult_time * 0.5
        peak_mult = 1.25 if is_peak else 1.0
        priority_mult = {"normal": 1.0, "urgent": 0.85, "emergency": 0.5}[priority]
        noise = np.random.normal(0, base_wait * 0.08)
        actual_wait = max(2.0, (base_wait + emergency_penalty) * peak_mult * priority_mult + noise)

        rows.append({
            "queue_length": queue_length,
            "doctors_available": doctors_available,
            "avg_consult_time": round(avg_consult_time, 2),
            "emergency_cases": emergency_cases,
            "department": dept,
            "time_of_day": time_of_day,
            "weekday": weekday,
            "patient_priority": priority,
            "consultation_complexity": complexity,
            "is_peak_hour": is_peak,
            "load_ratio": round(queue_length / max(doctors_available, 1), 2),
            "emergency_ratio": round(emergency_cases / max(queue_length, 1), 3),
            "actual_wait_time": round(actual_wait, 2),
        })
    return pd.DataFrame(rows)


def encode_features(df: pd.DataFrame):
    encoders = {}
    cat_cols = ["department", "time_of_day", "weekday", "patient_priority", "consultation_complexity"]
    for col in cat_cols:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col])
        encoders[col] = le
    return df, encoders


def train_model(df: pd.DataFrame, encoders: dict):
    feature_cols = [
        "queue_length", "doctors_available", "avg_consult_time", "emergency_cases",
        "department", "time_of_day", "weekday", "patient_priority",
        "consultation_complexity", "is_peak_hour", "load_ratio", "emergency_ratio",
    ]
    X = df[feature_cols].values.astype(np.float32)
    y = df["actual_wait_time"].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=RANDOM_SEED)

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    print("[Training] Fitting XGBoost Regressor...")
    model = xgb.XGBRegressor(
        n_estimators=500,
        max_depth=7,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=3,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=RANDOM_SEED,
        n_jobs=-1,
        early_stopping_rounds=30,
        eval_metric="mae",
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=50)

    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    accuracy_pct = max(0, round((1 - mae / y_test.mean()) * 100, 2))

    print(f"\n{'='*50}")
    print(f"  MAE  : {mae:.2f} minutes")
    print(f"  R²   : {r2:.4f}")
    print(f"  Est. Accuracy: {accuracy_pct}%")
    print(f"{'='*50}\n")

    return model, scaler, encoders, {"mae": mae, "r2": r2, "accuracy_pct": accuracy_pct}


def save_artifacts(model, scaler, encoders, metrics):
    joblib.dump(model, os.path.join(OUTPUT_DIR, "xgb_model.joblib"))
    joblib.dump(scaler, os.path.join(OUTPUT_DIR, "scaler.joblib"))
    joblib.dump(encoders, os.path.join(OUTPUT_DIR, "encoders.joblib"))

    import json
    with open(os.path.join(OUTPUT_DIR, "model_metadata.json"), "w") as f:
        json.dump({"version": "v1.0", "metrics": metrics, "n_samples": N_SAMPLES}, f, indent=2)

    print(f"[Saved] Model artifacts -> {OUTPUT_DIR}")


if __name__ == "__main__":
    df = generate_dataset()
    df.to_csv(os.path.join(DATASET_DIR, "hospital_queue_data.csv"), index=False)
    print(f"[Saved] Dataset -> {DATASET_DIR}/hospital_queue_data.csv  ({len(df)} rows)")

    df_enc, encoders = encode_features(df)
    model, scaler, encoders, metrics = train_model(df_enc, encoders)
    save_artifacts(model, scaler, encoders, metrics)
    print("\n[DONE] QueueCare AI model training complete!")
