# QueueCare AI — Project README

## 🏥 QueueCare AI — Intelligent Hospital Queue Prediction & Patient Flow Optimization

> Enterprise-grade AI-powered hospital queue management platform using XGBoost, FastAPI, Next.js, PostgreSQL, and WebSockets.

---

## 📁 Project Structure

```
queueai/
├── frontend/          # Next.js 16 + Tailwind CSS + Recharts + Lucide Icons
├── backend/           # FastAPI + SQLAlchemy + WebSockets
│   ├── app.py         # Main FastAPI application & Router configuration
│   ├── routes/        # Auth, Queue, Doctors, Analytics, Users, AI
│   ├── models/        # SQLAlchemy ORM + Pydantic schemas
│   ├── ai_engine/     # XGBoost predictor + training pipeline
│   ├── auth/          # JWT authentication
│   ├── database/      # Async PostgreSQL connection
│   └── websocket/     # Connection manager for real-time updates
├── ml-models/         # Trained XGBoost model artifacts
├── datasets/          # Synthetic training dataset
└── docker-compose.yml # Full stack Docker setup
```

---

## 🚀 Quick Start & Local Run

### Prerequisites
- Python 3.11+
- Node.js 20+ (Next.js dev/Turbopack)
- PostgreSQL 15+ (local database service)

### 1. Database Configuration
Create a PostgreSQL database named `queuecare` (locally). Update [backend/.env](file:///t:/queueai/backend/.env) to include your credentials:
```env
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/queuecare
JWT_SECRET=supersecretjwtkeyforlocaldevelopmentonlychangeinprod
```

### 2. Train the AI Model & Seed Database
Initialize your virtual environment, install requirements, train the predictive XGBoost model, and seed the demo data:
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate   # On Windows
pip install -r requirements.txt
python ai_engine/train.py

# Seed database with initial users and queues
python -m scratch.seed_db
```

### 🔑 Demo Logins
All seeded accounts use the default password: **`demo1234`**

| Role | Email | View Access |
|---|---|---|
| **Admin** | `admin@demo.com` | Full metrics, AI insights, system config, model retraining |
| **Doctor** | `doctor@demo.com` | Personal queue management, schedule, stats |
| **Receptionist** | `recept@demo.com` | Check-in, add patient, emergency override, status controls |
| **Patient** | `patient@demo.com` | Live token booking, wait time predictions, visit history |

### 3. Start the Backend
Start the FastAPI server:
```bash
cd backend
.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Start the Frontend
Install Node dependencies and start the Next.js Turbopack dev server:
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🔧 Windows local troubleshooting
* **Bcrypt AttributeError/ValueError**: Modern `bcrypt` versions may raise issues under Python 3.11+ Windows environment with `passlib`. Pin `bcrypt==3.2.0` in your venv.
* **UnicodeEncodeError**: Ensure terminal emojis (e.g. `✅`, `🛑`) are sanitized to plain-text log symbols (`[INFO]`, `[ERROR]`) in `app.py` when running on Windows command line interfaces.

---

## 🧠 AI Engine

| Feature | Detail |
|---|---|
| Algorithm | XGBoost Regressor |
| Architecture | Hybrid: Rule-based + AI Correction |
| Training Data | 8,000 synthetic hospital queue records |
| MAE | ~3.2 minutes |
| R² Score | ~0.972 |
| Confidence | 78–94% |

### Input Features
- Queue length, doctors available, avg consultation time
- Emergency cases, department, time of day, weekday
- Patient priority, consultation complexity (derived: load ratio)

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Create account |
| POST | `/auth/login` | Login |
| GET | `/auth/me` | Current user |
| POST | `/queue/book-token` | Book queue token |
| GET | `/queue/status/{dept}` | Live queue |
| GET | `/queue/my-token` | My tokens |
| POST | `/queue/update-status` | Update status |
| GET | `/doctors/` | List doctors |
| POST | `/doctors/start-consultation` | Begin consult |
| POST | `/doctors/end-consultation` | End consult |
| GET | `/analytics/summary` | Dashboard KPIs |
| GET | `/analytics/hourly-traffic` | Hourly chart |
| GET | `/analytics/peak-hour-forecast/{dept}` | AI forecast |
| POST | `/ai/predict-wait-time` | Predict wait |
| POST | `/ai/retrain-model` | Retrain XGBoost |
| GET | `/ai/model-status` | Model info |
| GET | `/users` | List all users (Admin only) |
| DELETE | `/doctors/{id}` | Delete doctor profile (Admin only) |
| PUT | `/doctors/{id}` | Update doctor average time/status |

### WebSocket Channels
- `ws://host/ws/global` — Admin/Reception global events
- `ws://host/ws/department/{dept}` — Department queue updates
- `ws://host/ws/patient/{id}` — Personal patient notifications

---

## 👥 User Roles

| Role | Access |
|---|---|
| Patient | Book tokens, live queue status, AI prediction |
| Receptionist | Queue monitor, emergency override, doctor management |
| Doctor | Patient queue, start/end consultation, status control |
| Admin | Full analytics, AI insights, model retraining |

---

## 🐳 Deployment

```
Frontend  → Vercel / Docker
Backend   → Render / Railway / AWS
ML Model  → Served via FastAPI AI Engine
```

---

## 🛠️ Recent Bug Fixes (Completed)

We resolved several key operational issues across the stack:
- **Consolidated Transactions**: Refactored `start_consultation` and `end_consultation` in `doctors.py` to process logs, doctor statuses, and queue recalculations in a single transaction (`commit=False` in `_recalculate_queue`), preventing greenlet database session conflicts.
- **Reception Emergency Override Name Fix**: Added name validation and a patient name text input to the quick-emergency form on the Reception Dashboard. This prevents the token from automatically registering under the receptionist's name.
- **Doctor Status Sync**: Updated the Doctor Dashboard and WebSockets to dynamically reload the doctor's status when they start/end a consultation or modify availability, including a pulsing "Busy" badge.
- **Immediate checkin_time Defaulting**: Ensured the database is seeded and tokens are instantiated with a guaranteed `datetime.utcnow()` value in the python model layer.

---

## 🗺️ Advanced Production Roadmap

To expand QueueCare AI into a fully complete hospital-grade system, the following features are planned:
1. **Doctor Shift & Schedule Integration**: Forecast wait times dynamically by reading doctors' calendars, accounting for shift start/end times and scheduled breaks.
2. **GPS Geofencing Patient Check-In**: Prevent queue stagnation by keeping online token bookings in a "pending" state until a patient is within $500\text{m}$ of the clinic.
3. **No-Show & Tardiness Probability Predictor**: Use a classification model to evaluate no-show risk based on weather, traffic, and past attendance to adapt queue predictions dynamically.
4. **NLP Symptom Complexity Sorter**: Read the patient's symptom description during booking to auto-classify triage priority and clinical complexity.
5. **Cross-Department Load Balancing**: Automatically recommend alternate, less-busy departments to patients with low-priority conditions to distribute wait times evenly.

