import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach token automatically
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("queuecare_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("queuecare_token");
      localStorage.removeItem("queuecare_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  signup: (data: SignupPayload) => api.post("/auth/signup", data),
  login: (data: LoginPayload) => api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
};

// ── Queue ─────────────────────────────────────────────────────────────────────
export const queueAPI = {
  bookToken: (data: BookTokenPayload) => api.post("/queue/book-token", data),
  getStatus: (department: string) => api.get(`/queue/status/${department}`),
  getMyTokens: () => api.get("/queue/my-token"),
  updateStatus: (data: { queue_id: string; status: string }) =>
    api.post("/queue/update-status", data),
};

// ── Doctors ───────────────────────────────────────────────────────────────────
export const doctorAPI = {
  list: (department?: string) =>
    api.get("/doctors/", { params: department ? { department } : {} }),
  create: (data: DoctorPayload) => api.post("/doctors/", data),
  update: (doctorId: string, data: Partial<DoctorPayload>) =>
    api.put(`/doctors/${doctorId}`, data),
  delete: (doctorId: string) =>
    api.delete(`/doctors/${doctorId}`),
  getQueue: (doctorId: string) => api.get(`/doctors/queue/${doctorId}`),
  startConsultation: (queue_id: string) =>
    api.post("/doctors/start-consultation", { queue_id }),
  endConsultation: (queue_id: string, notes?: string) =>
    api.post("/doctors/end-consultation", { queue_id, notes }),
  updateStatus: (doctorId: string, status: string) =>
    api.put(`/doctors/${doctorId}/status?status=${status}`),
  getShifts: (doctorId: string) => api.get(`/doctors/${doctorId}/shifts`),
  addShift: (doctorId: string, data: { start_time: string; end_time: string }) => api.post(`/doctors/${doctorId}/shifts`, data),
  deleteShift: (shiftId: string) => api.delete(`/doctors/shifts/${shiftId}`),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersAPI = {
  list: (role?: string) =>
    api.get("/users/", { params: role ? { role } : {} }),
  get: (userId: string) =>
    api.get(`/users/${userId}`),
  toggleActive: (userId: string) =>
    api.put(`/users/${userId}/toggle-active`),
  updateRole: (userId: string, role: string) =>
    api.put(`/users/${userId}/role?role=${role}`),
};

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiAPI = {
  predict: (data: PredictPayload) => api.post("/ai/predict-wait-time", data),
  retrain: () => api.post("/ai/retrain-model"),
  status: () => api.get("/ai/model-status"),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  summary: () => api.get("/analytics/summary"),
  hourlyTraffic: () => api.get("/analytics/hourly-traffic"),
  waitTimeTrend: () => api.get("/analytics/wait-time-trend"),
  departmentLoad: () => api.get("/analytics/department-load"),
  doctorUtilization: () => api.get("/analytics/doctor-utilization"),
  peakForecast: (dept: string) => api.get(`/analytics/peak-hour-forecast/${dept}`),
  consultationLogs: (params?: { limit?: number; offset?: number; department?: string }) =>
    api.get("/analytics/consultation-logs", { params }),
  allQueues: () => api.get("/analytics/all-queues"),
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SignupPayload {
  name: string; email: string; password: string;
  role: string; phone?: string; age?: number; gender?: string;
  department?: string; specialization?: string;
}
export interface LoginPayload { email: string; password: string; }
export interface BookTokenPayload {
  department: string; doctor_id?: string;
  priority?: string; complexity?: string;
  patient_name?: string;
}
export interface DoctorPayload {
  name: string; department: string; specialization?: string; avg_consult_time?: number;
}
export interface PredictPayload {
  queue_length: number; doctors_available: number; avg_consult_time: number;
  emergency_cases: number; department: string; time_of_day: string;
  weekday: string; patient_priority?: string; consultation_complexity?: string;
}
