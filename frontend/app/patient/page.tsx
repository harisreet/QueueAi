"use client";
import { useEffect, useState, useCallback } from "react";
import { Hash, Plus, Activity, Calendar, Clock, TrendingUp, RefreshCw, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { queueAPI, doctorAPI, aiAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { connectPatient, WSEvent } from "@/lib/websocket";
import toast from "react-hot-toast";

const NAV = [
  { label: "My Queue",        href: "/patient",         icon: Hash     },
  { label: "Book Appointment",href: "/patient/book",    icon: Plus     },
  { label: "AI Predictor",    href: "/patient/predict", icon: Activity },
  { label: "History",         href: "/patient/history", icon: Calendar },
];

const DEPTS = ["Cardiology","Orthopedics","Neurology","Pediatrics","General Medicine","Emergency","Dermatology","ENT","Gynecology","Ophthalmology","Psychiatry","Radiology"];

const STATUS_BADGE: Record<string, string> = {
  waiting:         "bg-amber-500/15 text-amber-400 border-amber-500/25",
  in_consultation: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  completed:       "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  delayed:         "bg-red-500/15 text-red-400 border-red-500/25",
  cancelled:       "bg-red-500/15 text-red-400 border-red-500/25",
};

interface QueueEntry {
  id: string; token_no: string; department: string; queue_position: number;
  predicted_wait: number; confidence_score: number; priority: string;
  status: string; is_emergency: boolean; checkin_time: string;
}
interface Prediction { predicted_wait_time: number; confidence: number; peak_hour_risk: string; recommendation: string; }

export default function PatientDashboard() {
  const { user } = useAuthStore();
  const [tokens, setTokens]         = useState<QueueEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showBook, setShowBook]     = useState(false);
  const [booking, setBooking]       = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [form, setForm]             = useState({ department: "General Medicine", priority: "normal", complexity: "routine" });

  const loadTokens = useCallback(async () => {
    try { const r = await queueAPI.getMyTokens(); setTokens(r.data); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const fetchPrediction = useCallback(async () => {
    try {
      const docs    = await doctorAPI.list(form.department);
      const avail   = docs.data.filter((d: { is_available: boolean }) => d.is_available).length;
      const qRes    = await queueAPI.getStatus(form.department);
      const qLen    = qRes.data.filter((q: { status: string }) => q.status === "waiting").length;
      const h       = new Date().getHours();
      const tod     = h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
      const day     = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
      const res     = await aiAPI.predict({ queue_length: qLen + 1, doctors_available: Math.max(1, avail), avg_consult_time: 10, emergency_cases: 0, department: form.department, time_of_day: tod, weekday: day, patient_priority: form.priority, consultation_complexity: form.complexity });
      setPrediction(res.data);
    } catch { /* ignore */ }
  }, [form]);

  useEffect(() => { loadTokens(); }, [loadTokens]);
  useEffect(() => { fetchPrediction(); }, [fetchPrediction]);
  useEffect(() => {
    if (!user?.user_id) return;
    const ws = connectPatient(user.user_id, (evt: WSEvent) => {
      if (evt.event === "token_booked" || evt.event === "queue_update") loadTokens();
      if (evt.event === "consultation_started") toast.success("Your consultation has started!");
    });
    return () => ws.close();
  }, [user, loadTokens]);

  const handleBook = async () => {
    setBooking(true);
    try {
      await queueAPI.bookToken(form);
      toast.success("Token booked!");
      setShowBook(false);
      loadTokens();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Booking failed");
    } finally { setBooking(false); }
  };

  const active = tokens.find(t => ["waiting","in_consultation"].includes(t.status));
  const riskColor = prediction?.peak_hour_risk === "HIGH" ? "text-red-400" : prediction?.peak_hour_risk === "MEDIUM" ? "text-amber-400" : "text-emerald-400";

  return (
    <DashboardLayout navItems={NAV} title="Patient Dashboard" subtitle="Your real-time queue status & appointments">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* ── Active Token Card ── */}
        {active ? (
          <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 p-6"
            style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.12),rgba(3,7,18,0.8))", backdropFilter: "blur(16px)" }}>
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none" style={{ background: "rgba(59,130,246,0.08)", filter: "blur(40px)" }} />
            <div className="relative flex flex-wrap gap-6 items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Active Token</p>
                <div className="text-7xl font-black text-white tracking-tight mb-3">{active.token_no}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/25">{active.department}</span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_BADGE[active.status] || STATUS_BADGE.waiting}`}>
                    {active.status.replace("_"," ").toUpperCase()}
                  </span>
                  {active.is_emergency && <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/25">🚨 EMERGENCY</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-500 mb-1">Est. Wait Time</p>
                <div className="text-6xl font-black text-gradient leading-none">{Math.round(active.predicted_wait)}</div>
                <div className="text-sm text-slate-400 mt-1">minutes</div>
                <div className="text-xs text-slate-500 mt-1">AI Confidence: <span className="text-emerald-400 font-semibold">{Math.round(active.confidence_score * 100)}%</span></div>
              </div>
            </div>
            <div className="relative mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-5 text-xs text-slate-500">
              <span>Position <span className="text-white font-semibold">#{active.queue_position}</span></span>
              <span>•</span>
              <span>Checked in at {new Date(active.checkin_time).toLocaleTimeString()}</span>
              <button onClick={loadTokens} className="ml-auto flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors font-medium">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
          </div>
        ) : !loading ? (
          <div className="rounded-2xl border border-white/[0.07] p-12 text-center"
            style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No active token</h3>
            <p className="text-slate-400 text-sm mb-5">Book an appointment to get your queue token</p>
            <button onClick={() => setShowBook(true)} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white hover:brightness-110 transition-all"
              style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)", boxShadow: "0 4px 16px rgba(37,99,235,0.4)" }}>
              <Plus className="w-4 h-4" /> Book Appointment
            </button>
          </div>
        ) : null}

        {/* ── AI Prediction ── */}
        {prediction && (
          <div className="rounded-2xl border border-white/[0.07] p-5"
            style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-sm font-bold text-white">AI Wait Prediction</span>
              <span className="text-xs text-slate-500">— {form.department}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Estimated Wait",  value: `${Math.round(prediction.predicted_wait_time)} min`, color: "text-blue-400" },
                { label: "AI Confidence",   value: `${Math.round(prediction.confidence * 100)}%`,       color: "text-emerald-400" },
                { label: "Congestion Risk", value: prediction.peak_hour_risk,                           color: riskColor },
                { label: "Tip",             value: prediction.recommendation.slice(0, 40) + "…",        color: "text-slate-300", small: true },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4 border border-white/[0.06] text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className={`text-xl font-black mb-1 ${s.color} ${s.small ? "!text-xs !font-normal leading-snug text-left" : ""}`}>{s.value}</div>
                  {!s.small && <div className="text-xs text-slate-500">{s.label}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Book Panel ── */}
        <div className="rounded-2xl border border-white/[0.07]" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <button onClick={() => setShowBook(!showBook)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-all rounded-2xl">
            <span className="flex items-center gap-2 text-sm font-bold text-white">
              <Plus className="w-4 h-4 text-blue-400" /> Book New Appointment
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${showBook ? "rotate-180" : ""}`} />
          </button>

          {showBook && (
            <div className="px-5 pb-5 pt-1 border-t border-white/[0.06]">
              <div className="grid sm:grid-cols-3 gap-4 mb-4">
                {[
                  { label: "Department",      key: "department", opts: DEPTS },
                  { label: "Priority",        key: "priority",   opts: ["normal","urgent","emergency"] },
                  { label: "Case Complexity", key: "complexity", opts: ["routine","moderate","complex"] },
                ].map(({ label, key, opts }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">{label}</label>
                    <div className="relative">
                      <select className="w-full py-2.5 px-3 pr-8 rounded-xl text-sm text-white outline-none border border-white/[0.08] focus:border-blue-500/50 appearance-none cursor-pointer transition-all"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                        value={(form as Record<string,string>)[key]}
                        onChange={e => setForm({ ...form, [key]: e.target.value })}>
                        {opts.map(o => <option key={o} className="bg-slate-900 capitalize">{o}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={handleBook} disabled={booking}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 hover:brightness-110 transition-all"
                  style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)", boxShadow: "0 4px 12px rgba(37,99,235,0.35)" }}>
                  {booking ? <><Loader2 className="w-4 h-4 animate-spin" /> Booking...</> : <><Plus className="w-4 h-4" /> Get Token</>}
                </button>
                <button onClick={fetchPrediction} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 border border-white/10 hover:border-white/20 hover:text-white transition-all"
                  style={{ background: "rgba(255,255,255,0.04)" }}>
                  <TrendingUp className="w-4 h-4" /> Update Prediction
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── History Table ── */}
        {tokens.length > 0 && (
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-bold text-white">Appointment History</h3>
            </div>
            <table className="data-table">
              <thead><tr><th>Token</th><th>Department</th><th>Position</th><th>Est. Wait</th><th>Status</th></tr></thead>
              <tbody>
                {tokens.map(t => (
                  <tr key={t.id}>
                    <td><span className="font-mono font-black text-white text-sm">{t.token_no}</span></td>
                    <td className="text-slate-300">{t.department}</td>
                    <td className="text-slate-400">#{t.queue_position}</td>
                    <td className="text-slate-300 font-semibold">{Math.round(t.predicted_wait)} min</td>
                    <td><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_BADGE[t.status] || STATUS_BADGE.waiting}`}>{t.status.replace("_"," ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
