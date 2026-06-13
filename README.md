<div align="center">

# 🏥 QueueCare AI

### Intelligent Hospital Queue Management & Prediction Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![XGBoost](https://img.shields.io/badge/XGBoost-ML%20Engine-orange?style=flat-square)](https://xgboost.readthedocs.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-blue?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

> A full-stack, production-ready AI platform that eliminates hospital waiting room chaos — predicting patient wait times with machine learning, managing dynamic triage queues in real time, and orchestrating multi-role clinical workflows through a modern web interface.

</div>

---

## 🎯 Problem Statement

Hospitals worldwide lose thousands of patient-hours annually to **unmanaged waiting room chaos** — patients waiting without estimates, doctors idling while queues stagnate, and receptionists manually tracking paper tokens. Emergency cases are routinely buried under non-critical walk-ins with no intelligent triage.

**QueueCare AI solves this** by replacing manual queue management with an AI-driven, real-time platform that predicts, prioritizes, and orchestrates patient flow from token booking to consultation completion.

---

## ✨ Feature Overview

### 🧠 AI-Powered Wait Time Prediction
- **Hybrid prediction engine**: XGBoost ML model layered over a rule-based formula (R² = 0.972, MAE ≈ 3.2 min)
- Considers **12 input features**: queue length, active doctors, avg consultation time, emergency case count, department type, time of day, weekday, patient priority, complexity, peak-hour flag, load ratio, and emergency ratio
- Outputs: predicted wait time, confidence score (78–94%), peak-hour risk level, and smart patient recommendations
- **Live retraining endpoint** — admin can trigger model retraining from the dashboard on-demand

### 📅 Doctor Shift & Schedule Integration *(Advanced Feature)*
- Doctors log scheduled duty shift blocks (start/end datetime) via an interactive calendar interface
- The queue prediction engine **projects each patient's expected slot start time** and dynamically fetches which doctors are on duty at that moment
- If a doctor's shift ends mid-queue, the predicted wait times for later patients **automatically inflate** to reflect reduced coverage
- Overlap detection prevents scheduling conflicts; WebSocket broadcast keeps all UIs synchronized instantly

### 🚨 Emergency Triage & Override System
- Full triage-priority queue sorting: `emergency` → `urgent` → `normal` → check-in time FIFO
- Receptionists can trigger an **Emergency Override** from the dashboard — immediately inserts a named patient at Position 1 of any department queue
- Emergency tokens flagged visually across all dashboards with real-time WebSocket propagation

### 👥 Multi-Role Clinical Workflow
Four distinct authenticated user roles, each with dedicated dashboards:

| Role | Dashboard Features |
|---|---|
| 🧑‍⚕️ **Patient** | Book token with department/doctor selection, live queue position tracking, AI wait prediction, appointment history, previous consultation logs |
| 🩺 **Doctor** | Personal patient queue, Start/End Consultation controls, real-time availability status (Available/Break/Offline), Busy badge on active consult, rolling avg consult time tracking, Shift Schedule manager |
| 🖥️ **Receptionist** | Live multi-department queue monitor, walk-in patient check-in, emergency patient override with name input, doctor status board |
| 🔐 **Admin** | System-wide analytics KPIs, hourly traffic charts, doctor utilization, prediction accuracy metrics, user account management, AI model retraining |

### 📡 Real-Time WebSocket Architecture
- Three dedicated WebSocket channels: `global` (admin/reception), `department/{dept}` (per-department updates), `patient/{id}` (personal notifications)
- Every consultation start/end, queue recalculation, doctor status change, and emergency override broadcasts instantly to all connected clients
- No polling — sub-second latency event propagation across all dashboards simultaneously

### 📊 Analytics & Insights Dashboard
- Live KPI summary: total patients today, avg wait time, queue depth, active doctors, completed consultations, prediction accuracy
- Hourly traffic visualization (Recharts)
- Department-level load distribution heatmap
- Doctor utilization breakdown
- Per-department peak-hour AI forecast (hourly congestion curve)

### 🔐 Secure Authentication
- JWT-based auth with role-embedded tokens (no separate role lookup per request)
- Auto-logout on 401 responses (token interceptor)
- Role-gated route protection via Next.js middleware
- Doctors can self-register and auto-receive a linked `Doctor` profile; or admins can create accounts with email/password from the dashboard

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 16 + Turbopack | App framework with SSR and file-based routing |
| **Styling** | Vanilla CSS + Custom Design System | Glassmorphism dark UI with animations |
| **Charts** | Recharts | Analytics dashboards and traffic trends |
| **Backend** | FastAPI (Python 3.11) | Async REST API + WebSocket server |
| **ORM** | SQLAlchemy 2.0 (AsyncSession) | Async PostgreSQL queries |
| **Database** | PostgreSQL 15 | Persistent storage |
| **ML Engine** | XGBoost + joblib | Wait time prediction model |
| **Auth** | JWT (python-jose) + bcrypt | Stateless authentication |
| **Real-time** | WebSocket (FastAPI native) | Live queue and consultation events |
| **Deployment** | Docker Compose | Full-stack containerized setup |

---

## 🧠 AI Engine Deep Dive

```
Prediction Flow:
─────────────────────────────────────────────────────
Input Features (12) → Rule-Based Baseline Formula
                    ↓
             XGBoost Correction Layer
                    ↓
           Priority Multiplier (0.5× emergency, 0.85× urgent)
                    ↓
     Output: Wait Time | Confidence | Peak Risk | Recommendation
─────────────────────────────────────────────────────
```

**Shift-Aware Dynamic Slot Prediction:**
```
For each patient[i] in waiting queue:
  estimated_start = now + cumulative_wait[i-1]
  active_doctors  = [d for d in all_doctors if on_shift(d, estimated_start)]
  wait[i]         = XGBoost(queue_pos=i+1, doctors=len(active_doctors), ...)
```

| Metric | Value |
|---|---|
| Algorithm | XGBoost Regressor |
| Architecture | Hybrid Rule-Based + AI Correction |
| Training Records | 8,000 synthetic hospital queue entries |
| MAE | ~3.2 minutes |
| R² Score | ~0.972 |
| Confidence Range | 78% – 94% |

---

## 📁 Project Structure

```
queueai/
├── frontend/                    # Next.js 16 + TypeScript
│   ├── app/
│   │   ├── patient/             # Patient dashboard, booking, history
│   │   ├── doctor/              # Doctor queue, stats, schedule + shift manager
│   │   ├── reception/           # Queue monitor, add patient, emergency, doctors
│   │   └── admin/               # Analytics, queue admin, user management
│   ├── components/layout/       # DashboardLayout, Navbar
│   └── lib/                     # api.ts (Axios client), auth.ts (Zustand), websocket.ts
│
├── backend/                     # FastAPI application
│   ├── routes/
│   │   ├── auth.py              # Signup/Login/JWT
│   │   ├── queue.py             # Token booking, shift-aware wait recalculation
│   │   ├── doctors.py           # Doctor CRUD, consultations, shift management
│   │   ├── analytics.py         # KPI aggregates and hourly traffic
│   │   ├── ai.py                # Prediction endpoint, model retraining
│   │   └── users.py             # User management (admin)
│   ├── models/
│   │   ├── doctor.py            # Doctor ORM model
│   │   ├── doctor_shift.py      # DoctorShift ORM model (new)
│   │   ├── queue.py             # Queue ORM model
│   │   ├── consultation.py      # ConsultationLog + PredictionHistory
│   │   └── queue_schemas.py     # Pydantic schemas (incl. ShiftCreate/ShiftResponse)
│   ├── ai_engine/
│   │   ├── predictor.py         # Hybrid XGBoost prediction engine
│   │   └── train.py             # Model training pipeline
│   ├── auth/                    # JWT handler + get_current_user dependency
│   ├── database/                # Async SQLAlchemy engine + Base
│   └── websocket/               # Connection manager (global/dept/patient channels)
│
├── ml-models/                   # Serialized XGBoost model (.joblib)
├── datasets/                    # 8,000-record synthetic training dataset
└── docker-compose.yml           # Full-stack Docker setup
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+, Node.js 20+, PostgreSQL 15+

### 1. Clone & Configure
```bash
git clone https://github.com/harisreet/QueueAi.git
cd QueueAi
```

Create `backend/.env`:
```env
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/queuecare
JWT_SECRET=your-secret-key-here
```

### 2. Train AI Model & Seed Database
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
python ai_engine/train.py     # Train XGBoost model
python -m scratch.seed_db     # Seed demo data
```

### 3. Start Backend
```bash
.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Start Frontend
```bash
cd ../frontend
npm install
npm run dev
```

Open **http://localhost:3000**

### 🔑 Demo Accounts (password: `demo1234`)

| Role | Email | Access |
|---|---|---|
| 👑 Admin | `admin@demo.com` | Full system: analytics, AI, user management |
| 🩺 Doctor | `doctor@demo.com` | Queue, consultations, shift scheduling |
| 🖥️ Receptionist | `recept@demo.com` | Check-in, emergency, queue ops |
| 🧑 Patient | `patient@demo.com` | Token booking, live tracking, history |

---

## 🔗 API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Register new user (auto-creates Doctor profile if role=doctor) |
| POST | `/auth/login` | Login → JWT token |
| GET | `/auth/me` | Get current user profile |

### Queue Management
| Method | Endpoint | Description |
|---|---|---|
| POST | `/queue/book-token` | Book a queue token (supports walk-in name override) |
| GET | `/queue/status/{dept}` | Live queue for a department (triage sorted) |
| GET | `/queue/my-token` | Current user's active tokens |
| POST | `/queue/update-status` | Update token status (delay/cancel) |

### Doctor & Shift Management
| Method | Endpoint | Description |
|---|---|---|
| GET | `/doctors/` | List all doctors (filterable by dept) |
| POST | `/doctors/` | Register doctor (with optional linked user account) |
| POST | `/doctors/start-consultation` | Begin consultation → marks doctor busy |
| POST | `/doctors/end-consultation` | End consultation → recalculates full queue |
| PUT | `/doctors/{id}/status` | Toggle availability |
| GET | `/doctors/{id}/shifts` | List all scheduled shifts |
| POST | `/doctors/{id}/shifts` | Add shift block (with overlap detection) |
| DELETE | `/doctors/shifts/{id}` | Remove a scheduled shift |

### AI & Analytics
| Method | Endpoint | Description |
|---|---|---|
| POST | `/ai/predict-wait-time` | On-demand wait prediction |
| POST | `/ai/retrain-model` | Trigger XGBoost retraining |
| GET | `/ai/model-status` | Model version and accuracy info |
| GET | `/analytics/summary` | System-wide KPIs |
| GET | `/analytics/hourly-traffic` | Per-hour patient volume |
| GET | `/analytics/department-load` | Load distribution across departments |
| GET | `/analytics/peak-hour-forecast/{dept}` | 24-hour congestion curve |
| GET | `/analytics/doctor-utilization` | Per-doctor usage stats |

### WebSocket Channels
```
ws://localhost:8000/ws/global             → Admin/Reception live events
ws://localhost:8000/ws/department/{dept}  → Department queue updates
ws://localhost:8000/ws/patient/{id}       → Personal patient notifications
```

---

## 🐳 Deployment

```
Frontend  → Vercel (zero-config Next.js deployment)
Backend   → Render / Railway / AWS ECS
Database  → Supabase / AWS RDS / Neon
ML Model  → Served in-process via FastAPI AI Engine
Full Stack → Docker Compose (single-command local deploy)
```

---

## 🔧 Platform Notes (Windows)

- **Bcrypt issue**: Pin `bcrypt==3.2.0` in venv if you hit `AttributeError` on Python 3.11+ Windows
- **Unicode errors**: All log statements use plain ASCII symbols (`[INFO]`, `[ERROR]`) — safe for Windows terminals

---

## 🗺️ Roadmap

| # | Feature | Status |
|---|---|---|
| ✅ | AI wait time prediction (XGBoost hybrid) | **Shipped** |
| ✅ | Real-time WebSocket queue updates | **Shipped** |
| ✅ | Emergency triage override | **Shipped** |
| ✅ | Multi-role dashboards | **Shipped** |
| ✅ | Doctor shift scheduling + shift-aware predictions | **Shipped** |
| 🔜 | No-Show & Tardiness Probability Predictor | Planned |
| 🔜 | NLP Symptom Complexity Classifier | Planned |
| 🔜 | Cross-Department Load Balancing | Planned |
| 🔜 | GPS Geofencing Patient Check-In | Planned |

---

## 👤 Author

**Harisree T**  
Full-Stack Developer & ML Engineer  
[GitHub](https://github.com/harisreet) · [LinkedIn](https://linkedin.com/in/harisreet)

---

<div align="center">
  <sub>Built with ❤️ to reduce suffering in hospital waiting rooms</sub>
</div>
