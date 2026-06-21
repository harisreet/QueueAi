"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Hash, Plus, Activity, Calendar, ChevronDown, Loader2, User, Brain, CheckCircle2, AlertTriangle, AlertCircle, Sparkles } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { queueAPI, doctorAPI, aiAPI } from "@/lib/api";
import toast from "react-hot-toast";

const NAV = [
  { label: "My Queue",         href: "/patient",         icon: Hash     },
  { label: "Book Appointment", href: "/patient/book",    icon: Plus     },
  { label: "AI Predictor",     href: "/patient/predict", icon: Activity },
  { label: "History",          href: "/patient/history", icon: Calendar },
];

const DEPTS = ["Cardiology","Orthopedics","Neurology","Pediatrics","General Medicine","Emergency","Dermatology","ENT","Gynecology","Ophthalmology","Psychiatry","Radiology"];

// ── Priority badge config ────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string; border: string }> = {
  normal:    { label: "Normal",    icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  urgent:    { label: "Urgent",    icon: AlertTriangle, color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25"   },
  emergency: { label: "Emergency", icon: AlertCircle,   color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25"     },
};

const COMPLEXITY_COLORS: Record<string, string> = {
  routine:  "text-slate-400",
  moderate: "text-blue-400",
  complex:  "text-violet-400",
};

export default function BookAppointmentPage() {
  const [loading, setLoading]       = useState(false);
  const [doctors, setDoctors]       = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [form, setForm] = useState({
    department: "General Medicine",
    doctor_id: "",
    priority: "normal",
    complexity: "routine",
  });

  // NLP symptom state
  const [symptoms, setSymptoms]               = useState("");
  const [nlpResult, setNlpResult]             = useState<any>(null);
  const [nlpLoading, setNlpLoading]           = useState(false);
  const [nlpApplied, setNlpApplied]           = useState(false);
  const nlpDebounceRef                         = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI Preview
  const [preview, setPreview]         = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Load doctors for department
  const loadDoctors = useCallback(async (dept: string) => {
    setLoadingDocs(true);
    try {
      const res = await doctorAPI.list(dept);
      setDoctors(res.data);
      setForm(f => ({ ...f, doctor_id: res.data.length > 0 ? res.data[0].id : "" }));
    } catch {
      toast.error("Failed to load department doctors");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => { loadDoctors(form.department); }, [form.department, loadDoctors]);

  // Live wait preview
  const updatePreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const avail = doctors.filter((d: any) => d.is_available).length;
      const qRes = await queueAPI.getStatus(form.department);
      const qLen = qRes.data.filter((q: any) => q.status === "waiting").length;
      const h = new Date().getHours();
      const tod = h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
      const day = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
      const res = await aiAPI.predict({
        queue_length: qLen + 1,
        doctors_available: Math.max(1, avail),
        avg_consult_time: 10,
        emergency_cases: 0,
        department: form.department,
        time_of_day: tod,
        weekday: day,
        patient_priority: form.priority,
        consultation_complexity: form.complexity,
      });
      setPreview(res.data);
    } catch { /* silent */ } finally {
      setLoadingPreview(false);
    }
  }, [form.department, form.priority, form.complexity, doctors]);

  useEffect(() => { updatePreview(); }, [doctors, form.priority, form.complexity, updatePreview]);

  // ── NLP Symptom Classification (debounced 800ms) ────────────────────────
  const runNLP = useCallback(async (text: string) => {
    if (!text.trim() || text.trim().length < 5) { setNlpResult(null); return; }
    setNlpLoading(true);
    try {
      const res = await aiAPI.classifySymptoms(text);
      setNlpResult(res.data);
    } catch { setNlpResult(null); }
    finally { setNlpLoading(false); }
  }, []);

  const handleSymptomsChange = (text: string) => {
    setSymptoms(text);
    setNlpApplied(false);
    if (nlpDebounceRef.current) clearTimeout(nlpDebounceRef.current);
    nlpDebounceRef.current = setTimeout(() => runNLP(text), 800);
  };

  const applyNLPResult = () => {
    if (!nlpResult) return;
    setForm(f => ({ ...f, priority: nlpResult.priority, complexity: nlpResult.complexity }));
    setNlpApplied(true);
    toast.success(`AI set: ${nlpResult.priority} priority · ${nlpResult.complexity} complexity`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await queueAPI.bookToken({
        department: form.department,
        doctor_id: form.doctor_id || undefined,
        priority: form.priority,
        complexity: form.complexity,
      });
      toast.success("🎟️ Appointment booked & token generated!");
      setForm({ department: "General Medicine", doctor_id: "", priority: "normal", complexity: "routine" });
      setSymptoms(""); setNlpResult(null); setNlpApplied(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  const PriorityIcon = PRIORITY_CONFIG[form.priority]?.icon || CheckCircle2;

  return (
    <DashboardLayout navItems={NAV} title="Book Appointment" subtitle="Describe your symptoms — AI auto-classifies priority & complexity">
      <div className="max-w-4xl mx-auto grid md:grid-cols-5 gap-5">

        {/* Booking Form */}
        <div className="md:col-span-3 rounded-2xl border border-white/[0.07] p-5 text-left space-y-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <h3 className="text-sm font-bold text-white">Appointment Registration</h3>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Department */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Select Department</label>
              <div className="relative">
                <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                  className="w-full py-3 px-4 rounded-xl text-sm text-white outline-none border border-white/[0.08] bg-[#0b0f19] appearance-none cursor-pointer">
                  {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
              </div>
            </div>

            {/* Doctor */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Available Doctors</label>
              <div className="relative">
                <select value={form.doctor_id} onChange={e => setForm({ ...form, doctor_id: e.target.value })}
                  className="w-full py-3 px-4 rounded-xl text-sm text-white outline-none border border-white/[0.08] bg-[#0b0f19] appearance-none cursor-pointer disabled:opacity-50"
                  disabled={loadingDocs || doctors.length === 0}>
                  {doctors.length > 0
                    ? doctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.specialization || "General"}) — {d.status}</option>)
                    : <option value="">No doctors available</option>}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
              </div>
            </div>

            {/* ── NLP Symptom Input ─────────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-violet-400" />
                  Describe Your Symptoms
                  <span className="text-violet-400/60 font-normal">(AI auto-classifies)</span>
                </label>
                {nlpLoading && <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />}
              </div>
              <textarea
                value={symptoms}
                onChange={e => handleSymptomsChange(e.target.value)}
                placeholder="e.g. I have severe chest pain radiating to my left arm and feel short of breath..."
                rows={3}
                className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-violet-500/40 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none resize-none transition-colors"
              />

              {/* NLP Result Card */}
              {nlpResult && !nlpLoading && (
                <div className={`mt-2 rounded-xl border p-3 space-y-2 transition-all ${
                  nlpResult.priority === "emergency" ? "border-red-500/30 bg-red-500/5" :
                  nlpResult.priority === "urgent"    ? "border-amber-500/30 bg-amber-500/5" :
                  "border-violet-500/20 bg-violet-500/5"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">AI Classification</span>
                      <span className="text-[10px] text-slate-500">({Math.round(nlpResult.confidence * 100)}% confidence)</span>
                    </div>
                    {!nlpApplied ? (
                      <button type="button" onClick={applyNLPResult}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-violet-600 hover:bg-violet-500 text-white transition-colors">
                        Apply
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Applied
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold capitalize ${
                      PRIORITY_CONFIG[nlpResult.priority]?.color} ${PRIORITY_CONFIG[nlpResult.priority]?.bg} ${PRIORITY_CONFIG[nlpResult.priority]?.border}`}>
                      ⚡ {nlpResult.priority}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full border border-white/10 text-[10px] font-bold capitalize bg-white/5 ${COMPLEXITY_COLORS[nlpResult.complexity]}`}>
                      🔬 {nlpResult.complexity}
                    </span>
                  </div>

                  {nlpResult.matched_keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {nlpResult.matched_keywords.slice(0, 6).map((kw: string) => (
                        <span key={kw} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/[0.06] text-[9px] text-slate-500">{kw}</span>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500 leading-relaxed">{nlpResult.reasoning}</p>
                </div>
              )}
            </div>

            {/* Manual Priority + Complexity overrides */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Priority</label>
                <div className="relative">
                  <select value={form.priority} onChange={e => { setForm({ ...form, priority: e.target.value }); setNlpApplied(false); }}
                    className="w-full py-3 px-4 rounded-xl text-sm text-white outline-none border border-white/[0.08] bg-[#0b0f19] appearance-none cursor-pointer">
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Complexity</label>
                <div className="relative">
                  <select value={form.complexity} onChange={e => { setForm({ ...form, complexity: e.target.value }); setNlpApplied(false); }}
                    className="w-full py-3 px-4 rounded-xl text-sm text-white outline-none border border-white/[0.08] bg-[#0b0f19] appearance-none cursor-pointer">
                    <option value="routine">Routine</option>
                    <option value="moderate">Moderate</option>
                    <option value="complex">Complex</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Current triage badge */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${PRIORITY_CONFIG[form.priority]?.border} ${PRIORITY_CONFIG[form.priority]?.bg}`}>
              <PriorityIcon className={`w-4 h-4 ${PRIORITY_CONFIG[form.priority]?.color}`} />
              <span className={`text-xs font-bold ${PRIORITY_CONFIG[form.priority]?.color}`}>
                {PRIORITY_CONFIG[form.priority]?.label} Priority
              </span>
              <span className={`text-xs ml-auto capitalize ${COMPLEXITY_COLORS[form.complexity]}`}>
                {form.complexity} complexity
              </span>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white hover:brightness-110 transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)", boxShadow: "0 4px 16px rgba(37,99,235,0.4)" }}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Booking...</> : "Book Appointment & Get Token"}
            </button>
          </form>
        </div>

        {/* Right Panel */}
        <div className="md:col-span-2 space-y-4">
          {/* AI Wait Preview */}
          <div className="rounded-2xl border border-blue-500/20 p-5 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.08),rgba(3,7,18,0.8))", backdropFilter: "blur(16px)" }}>
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> AI Live Wait Forecast
            </h4>
            {loadingPreview ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                Updating forecast…
              </div>
            ) : preview ? (
              <div className="space-y-4 text-left">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-4xl font-black text-white">{Math.round(preview.predicted_wait_time)}</div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Minutes Estimated</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-400">{Math.round(preview.confidence * 100)}%</div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">AI Confidence</div>
                  </div>
                </div>
                <div className="border-t border-white/[0.05] pt-3 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dept Doctors</span>
                    <span className="text-white font-bold">{doctors.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Congestion Risk</span>
                    <span className={`font-bold ${preview.peak_hour_risk === "HIGH" ? "text-red-400" : "text-emerald-400"}`}>
                      {preview.peak_hour_risk}
                    </span>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-[10px] text-slate-400 leading-relaxed">
                  <span className="text-blue-400 font-bold block mb-0.5">Recommendation:</span>
                  {preview.recommendation}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">Waiting for forecast data…</div>
            )}
          </div>

          {/* Department Doctors */}
          <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
            <h4 className="text-xs font-bold text-white mb-4 uppercase tracking-widest">Department Doctors</h4>
            <div className="space-y-2.5 max-h-[180px] overflow-y-auto">
              {doctors.length > 0 ? doctors.map((d: any) => (
                <div key={d.id} className="flex justify-between items-center px-3 py-2.5 rounded-xl border border-white/[0.05]" style={{ background: "rgba(255,255,255,0.015)" }}>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <div className="text-xs text-left">
                      <div className="text-white font-bold">{d.name}</div>
                      <div className="text-slate-500 text-[10px]">{d.specialization || "Practitioner"}</div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize ${
                    d.is_available ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                                   : "bg-slate-500/10 text-slate-400 border border-slate-500/25"}`}>
                    {d.status}
                  </span>
                </div>
              )) : (
                <div className="text-xs text-slate-500 py-4 text-center">No doctors in this department</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
