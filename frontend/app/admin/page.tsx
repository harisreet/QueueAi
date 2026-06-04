"use client";
import { useEffect, useState, useCallback } from "react";
import { BarChart2, Users, Clock, Brain, TrendingUp, Activity, RefreshCw, Shield, Zap, AlertTriangle } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { analyticsAPI, aiAPI } from "@/lib/api";
import { connectGlobal, WSEvent } from "@/lib/websocket";
import toast from "react-hot-toast";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const NAV = [
  { label: "Overview",       href: "/admin",         icon: BarChart2  },
  { label: "Queue Analytics",href: "/admin/queue",   icon: Activity   },
  { label: "AI Insights",    href: "/admin/ai",      icon: Brain      },
  { label: "Doctors",        href: "/admin/doctors", icon: Users      },
  { label: "Settings",       href: "/admin/settings",icon: Shield     },
];

const CHART_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316"];

/* eslint-disable @typescript-eslint/no-explicit-any */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl border border-white/10 text-xs" style={{ background: "rgba(3,7,18,0.95)", backdropFilter: "blur(16px)" }}>
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => <p key={i} className="text-white font-bold">{p.name}: {p.value}</p>)}
    </div>
  );
};

interface Summary { total_patients_today: number; avg_wait_time: number; current_queue_length: number; active_doctors: number; completed_consultations: number; prediction_accuracy: number; delay_probability: number; peak_hour_forecast: string; }
interface HourlyEntry { hour: number; label: string; patients: number; }
interface DeptLoad    { department: string; load: number; }
interface DoctorUtil  { doctor_id: string; consultations: number; avg_duration: number; }
interface Forecast    { hour: number; label: string; load_percent: number; risk: string; }

export default function AdminDashboard() {
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [hourly, setHourly]       = useState<HourlyEntry[]>([]);
  const [deptLoad, setDeptLoad]   = useState<DeptLoad[]>([]);
  const [doctors, setDoctors]     = useState<DoctorUtil[]>([]);
  const [forecast, setForecast]   = useState<Forecast[]>([]);
  const [modelStatus, setModelStatus] = useState<{ model_loaded: boolean; model_version: string } | null>(null);
  const [retraining, setRetraining]   = useState(false);

  const loadAll = useCallback(async () => {
    const [sumRes, hourRes, deptRes, docRes, modelRes, forecastRes] = await Promise.allSettled([
      analyticsAPI.summary(), analyticsAPI.hourlyTraffic(), analyticsAPI.departmentLoad(),
      analyticsAPI.doctorUtilization(), aiAPI.status(), analyticsAPI.peakForecast("General Medicine"),
    ]);
    if (sumRes.status === "fulfilled")     setSummary(sumRes.value.data);
    if (hourRes.status === "fulfilled")    setHourly(hourRes.value.data);
    if (deptRes.status === "fulfilled")    setDeptLoad(deptRes.value.data);
    if (docRes.status === "fulfilled")     setDoctors(docRes.value.data);
    if (modelRes.status === "fulfilled")   setModelStatus(modelRes.value.data);
    if (forecastRes.status === "fulfilled") setForecast(forecastRes.value.data.hourly_forecast ?? []);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    const ws = connectGlobal((e: WSEvent) => { if (["consultation_ended","queue_update"].includes(e.event)) loadAll(); });
    return () => ws.close();
  }, [loadAll]);

  const handleRetrain = async () => {
    setRetraining(true);
    try { await aiAPI.retrain(); toast.success("🧠 Model retraining started!"); }
    catch { toast.error("Retrain requires backend connection"); }
    finally { setTimeout(() => setRetraining(false), 3000); }
  };

  // Fallback demo data
  const hourlyData = hourly.length > 0 ? hourly.filter((_, i) => i >= 6 && i <= 20) :
    Array.from({ length: 15 }, (_, i) => ({ label: `${(i+6).toString().padStart(2,"0")}:00`, patients: Math.round(5 + Math.sin(i * 0.6) * 8 + (i > 2 && i < 8 ? 10 : 0)) }));

  const deptData = deptLoad.length > 0 ? deptLoad :
    [{ department: "Cardiology", load: 14 }, { department: "Pediatrics", load: 8 }, { department: "General Medicine", load: 12 }, { department: "Orthopedics", load: 6 }, { department: "Emergency", load: 18 }];

  const forecastData = forecast.length > 0 ? forecast.filter((_, i) => i >= 6 && i <= 21) :
    Array.from({ length: 16 }, (_, i) => ({
      label: `${(i+6).toString().padStart(2,"0")}`,
      load_percent: [25,35,60,80,95,90,70,55,65,85,80,60,45,35,25,15][i],
      risk: ["LOW","LOW","MEDIUM","HIGH","HIGH","HIGH","MEDIUM","MEDIUM","HIGH","HIGH","MEDIUM","MEDIUM","LOW","LOW","LOW","LOW"][i]
    }));

  const KPIS = summary ? [
    { label: "Patients Today",  value: summary.total_patients_today,               suffix: "",   icon: Users,      color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20"    },
    { label: "Avg Wait Time",   value: summary.avg_wait_time,                      suffix: "m",  icon: Clock,      color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20"   },
    { label: "Current Queue",   value: summary.current_queue_length,               suffix: "",   icon: Activity,   color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/20"  },
    { label: "Active Doctors",  value: summary.active_doctors,                     suffix: "",   icon: Zap,        color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { label: "Completed",       value: summary.completed_consultations,            suffix: "",   icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { label: "AI Accuracy",     value: summary.prediction_accuracy,                suffix: "%",  icon: Brain,      color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20"    },
    { label: "Delay Risk",      value: Math.round(summary.delay_probability * 100),suffix: "%",  icon: AlertTriangle, color: "text-red-400",   bg: "bg-red-500/10",     border: "border-red-500/20"     },
    { label: "Avg Consult",     value: "10",                                       suffix: "m",  icon: Clock,      color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/20"  },
  ] : [];

  return (
    <DashboardLayout navItems={NAV} title="Admin Analytics" subtitle="Real-time hospital intelligence & AI insights">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* KPI Grid */}
        {KPIS.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {KPIS.map(k => (
              <div key={k.label} className={`rounded-2xl border ${k.border} p-5`} style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
                <div className={`w-9 h-9 rounded-xl ${k.bg} border ${k.border} flex items-center justify-center mb-4`}>
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                </div>
                <div className={`text-3xl font-black ${k.color} mb-1`}>{k.value}{k.suffix}</div>
                <div className="text-xs text-slate-500 font-medium">{k.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[["Total Patients","—","text-blue-400","border-blue-500/20"],["Avg Wait","—","text-amber-400","border-amber-500/20"],["Queue Length","—","text-violet-400","border-violet-500/20"],["Active Doctors","—","text-emerald-400","border-emerald-500/20"]].map(([l,v,c,b]) => (
              <div key={l} className={`rounded-2xl border ${b} p-5 animate-pulse`} style={{ background: "rgba(255,255,255,0.025)" }}>
                <div className={`text-2xl font-black ${c} mb-1`}>{v}</div>
                <div className="text-xs text-slate-500">{l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Charts row */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* Hourly traffic */}
          <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-white">Hourly Patient Traffic</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">Today</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="patients" stroke="#3b82f6" fill="url(#tg)" strokeWidth={2} name="Patients" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Dept load */}
          <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-white">Department Queue Load</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5"><div className="live-dot" /> Live</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={deptData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="department" type="category" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} width={100} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="load" name="Patients" radius={[0,6,6,0]}>
                  {deptData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak-hour heatmap */}
        <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" /> Peak-Hour Forecast
              <span className="text-slate-500 font-normal text-xs">— General Medicine</span>
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-400 border border-violet-500/25">AI Prediction</span>
          </div>
          <div className="flex items-end gap-1.5 h-20">
            {forecastData.map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-1 min-w-0 group">
                <div className="w-full rounded-md relative"
                  style={{
                    height: `${h.load_percent}%`,
                    background: h.risk === "HIGH" ? `rgba(239,68,68,${0.3 + h.load_percent/200})`
                              : h.risk === "MEDIUM" ? `rgba(245,158,11,${0.3 + h.load_percent/200})`
                              : `rgba(16,185,129,${0.3 + h.load_percent/200})`,
                    transition: "opacity 0.2s",
                  }}
                  title={`${h.label}:00 — ${h.load_percent}% load`}
                />
                <span className="text-[9px] text-slate-600 hidden sm:block">{h.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-5 mt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-500/60 inline-block" /> HIGH</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500/60 inline-block" /> MEDIUM</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500/60 inline-block" /> LOW</span>
          </div>
        </div>

        {/* Doctor utilization + AI Panel */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* Doctor pie */}
          <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
            <h3 className="text-sm font-bold text-white mb-5">Doctor Utilization</h3>
            {doctors.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Users className="w-10 h-10 text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">No consultation data yet</p>
                <p className="text-slate-600 text-xs mt-1">Data appears once consultations begin</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={doctors} dataKey="consultations" nameKey="doctor_id" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                    {doctors.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* AI Engine */}
          <div className="rounded-2xl border border-blue-500/20 p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.08),rgba(3,7,18,0.8))", backdropFilter: "blur(16px)" }}>
            <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full pointer-events-none" style={{ background: "rgba(59,130,246,0.06)", filter: "blur(30px)" }} />
            <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-blue-400" />
              </div>
              AI Engine Status
            </h3>
            <div className="space-y-2.5 mb-5">
              {[
                { label: "Model Status",  value: modelStatus?.model_loaded ? "Active (XGBoost)" : "Rule-Based Fallback", color: modelStatus?.model_loaded ? "text-emerald-400" : "text-amber-400" },
                { label: "Version",       value: modelStatus?.model_version || "v1.0",     color: "text-slate-200"  },
                { label: "Algorithm",     value: "XGBoost Regressor",                      color: "text-blue-400"   },
                { label: "Accuracy",      value: summary ? `${summary.prediction_accuracy}%` : "92.63%", color: "text-emerald-400" },
                { label: "Training Data", value: "8,000 records",                          color: "text-slate-300"  },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-white/[0.05]" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <span className="text-xs text-slate-500">{item.label}</span>
                  <span className={`text-xs font-bold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2.5">
              <button onClick={handleRetrain} disabled={retraining}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-60 hover:brightness-110 transition-all"
                style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)", boxShadow: "0 4px 12px rgba(37,99,235,0.3)" }}>
                {retraining ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Retraining...</> : <><Brain className="w-3.5 h-3.5" /> Retrain Model</>}
              </button>
              <button onClick={loadAll} className="px-3.5 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all" style={{ background: "rgba(255,255,255,0.04)" }}>
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Peak alert */}
        {summary?.peak_hour_forecast && (
          <div className="rounded-2xl border border-amber-500/20 p-4 flex items-start gap-3" style={{ background: "rgba(245,158,11,0.05)" }}>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-400 mb-0.5">AI Peak Hour Forecast</div>
              <div className="text-xs text-slate-400 leading-relaxed">{summary.peak_hour_forecast}</div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
