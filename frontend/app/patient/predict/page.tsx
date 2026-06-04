"use client";
import { useState, useEffect, useCallback } from "react";
import { Hash, Plus, Activity, Calendar, Clock, ChevronDown, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { aiAPI, doctorAPI, queueAPI } from "@/lib/api";
import toast from "react-hot-toast";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const NAV = [
  { label: "My Queue",        href: "/patient",         icon: Hash     },
  { label: "Book Appointment",href: "/patient/book",    icon: Plus     },
  { label: "AI Predictor",    href: "/patient/predict", icon: Activity },
  { label: "History",         href: "/patient/history", icon: Calendar },
];

const DEPTS = ["Cardiology","Orthopedics","Neurology","Pediatrics","General Medicine","Emergency","Dermatology","ENT","Gynecology","Ophthalmology","Psychiatry","Radiology"];

/* eslint-disable @typescript-eslint/no-explicit-any */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl border border-white/10 text-xs" style={{ background: "rgba(3,7,18,0.95)", backdropFilter: "blur(16px)" }}>
      <p className="text-slate-400 mb-1">{label}:00</p>
      {payload.map((p: any, i: number) => <p key={i} className="text-white font-bold">{p.name}: {p.value}%</p>)}
    </div>
  );
};

export default function AIPredictorPage() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    department: "General Medicine",
    queue_length: 5,
    doctors_available: 2,
    avg_consult_time: 10,
    emergency_cases: 0,
    priority: "normal",
    complexity: "routine"
  });

  const [result, setResult] = useState<any>(null);

  // Auto-fill sliders based on actual live data when department changes
  const autofillFromRoster = useCallback(async () => {
    try {
      const docRes = await doctorAPI.list(form.department);
      const availDocs = docRes.data.filter((d: any) => d.is_available).length;
      
      const qRes = await queueAPI.getStatus(form.department);
      const qWaiting = qRes.data.filter((q: any) => q.status === "waiting").length;

      setForm(f => ({
        ...f,
        queue_length: Math.max(1, qWaiting),
        doctors_available: Math.max(1, availDocs)
      }));
    } catch (e) {
      // Ignore
    }
  }, [form.department]);

  useEffect(() => {
    autofillFromRoster();
  }, [form.department, autofillFromRoster]);

  const handlePredict = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const h = new Date().getHours();
      const tod = h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
      const day = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];

      const res = await aiAPI.predict({
        queue_length: form.queue_length,
        doctors_available: form.doctors_available,
        avg_consult_time: form.avg_consult_time,
        emergency_cases: form.emergency_cases,
        department: form.department,
        time_of_day: tod,
        weekday: day,
        patient_priority: form.priority,
        consultation_complexity: form.complexity
      });
      setResult(res.data);
    } catch (err: unknown) {
      toast.error("Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handlePredict();
  }, [form.queue_length, form.doctors_available, form.avg_consult_time, form.emergency_cases, form.priority, form.complexity]);

  // Mock heatmap traffic for department
  const heatmapData = Array.from({ length: 15 }, (_, i) => ({
    label: (i + 7).toString(),
    "Congestion Rate": [20, 30, 45, 60, 85, 95, 90, 75, 60, 65, 80, 75, 50, 35, 15][i]
  }));

  return (
    <DashboardLayout navItems={NAV} title="AI Wait-Time Predictor" subtitle="Simulate queue loads, emergency spikes, and see XGBoost predictions in real-time">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-5">
        
        {/* Predictor Form */}
        <div className="rounded-2xl border border-white/[0.07] p-5 text-left space-y-4" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Simulator Controls</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Department</label>
            <div className="relative">
              <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                className="w-full py-2.5 px-3 pr-8 rounded-xl text-sm text-white outline-none border border-white/[0.08] bg-[#0b0f19] appearance-none cursor-pointer">
                {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                <span>Queue Position / Length</span>
                <span className="text-white font-bold">{form.queue_length} Patients</span>
              </div>
              <input type="range" min="1" max="50" value={form.queue_length} onChange={e => setForm({ ...form, queue_length: parseInt(e.target.value) })}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>

            <div>
              <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                <span>Available Doctors</span>
                <span className="text-white font-bold">{form.doctors_available} Active</span>
              </div>
              <input type="range" min="1" max="10" value={form.doctors_available} onChange={e => setForm({ ...form, doctors_available: parseInt(e.target.value) })}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Priority Level</label>
                <div className="relative">
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full py-2.5 px-3 pr-8 rounded-xl text-sm text-white outline-none border border-white/[0.08] bg-[#0b0f19] appearance-none cursor-pointer">
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Case Complexity</label>
                <div className="relative">
                  <select value={form.complexity} onChange={e => setForm({ ...form, complexity: e.target.value })}
                    className="w-full py-2.5 px-3 pr-8 rounded-xl text-sm text-white outline-none border border-white/[0.08] bg-[#0b0f19] appearance-none cursor-pointer">
                    <option value="routine">Routine</option>
                    <option value="moderate">Moderate</option>
                    <option value="complex">Complex</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                  <span>Avg Consult</span>
                  <span className="text-white font-bold">{form.avg_consult_time}m</span>
                </div>
                <input type="range" min="5" max="30" value={form.avg_consult_time} onChange={e => setForm({ ...form, avg_consult_time: parseInt(e.target.value) })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500" />
              </div>
              
              <div>
                <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                  <span>Emergencies</span>
                  <span className="text-white font-bold">{form.emergency_cases} cases</span>
                </div>
                <input type="range" min="0" max="5" value={form.emergency_cases} onChange={e => setForm({ ...form, emergency_cases: parseInt(e.target.value) })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Prediction Results Block */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-500/20 p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.08),rgba(3,7,18,0.8))", backdropFilter: "blur(16px)" }}>
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> XGBoost wait estimate
            </h4>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                Calculating ML predictions...
              </div>
            ) : result ? (
              <div className="space-y-4 text-left">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-5xl font-black text-white">{Math.round(result.predicted_wait_time)}m</div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Estimated Waiting Duration</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-emerald-400">{Math.round(result.confidence * 100)}%</div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Confidence Metric</div>
                  </div>
                </div>

                {/* Sub metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-white/[0.05]">
                  <div className="px-3.5 py-2.5 rounded-xl border border-white/[0.04]" style={{ background: "rgba(255,255,255,0.015)" }}>
                    <span className="text-slate-500 block mb-0.5">Baseline Wait</span>
                    <span className="text-white font-bold">{Math.round(result.baseline_estimate)}m</span>
                  </div>
                  <div className="px-3.5 py-2.5 rounded-xl border border-white/[0.04]" style={{ background: "rgba(255,255,255,0.015)" }}>
                    <span className="text-slate-500 block mb-0.5">AI Adjustment</span>
                    <span className={`font-bold ${result.ai_adjustment > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {result.ai_adjustment > 0 ? `+${Math.round(result.ai_adjustment)}` : Math.round(result.ai_adjustment)}m
                    </span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-[10px] text-slate-400 flex items-start gap-2 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-white font-bold block mb-0.5">Peak hour congestion risk: {result.peak_hour_risk}</span>
                    {result.recommendation}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Peak hour heatmap */}
          <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
            <h4 className="text-xs font-bold text-white mb-4 uppercase tracking-widest">Expected Daily Traffic Curve</h4>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={heatmapData}>
                <defs>
                  <linearGradient id="hc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 8 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Congestion Rate" stroke="#3b82f6" fill="url(#hc)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
