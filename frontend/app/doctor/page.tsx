"use client";
import { useEffect, useState, useCallback } from "react";
import { Stethoscope, BarChart2, Calendar, Play, CheckCircle, Users, Clock, Activity, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { doctorAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { connectGlobal, WSEvent } from "@/lib/websocket";
import toast from "react-hot-toast";

const NAV = [
  { label: "My Queue",   href: "/doctor",          icon: Stethoscope },
  { label: "Statistics", href: "/doctor/stats",    icon: BarChart2   },
  { label: "Schedule",   href: "/doctor/schedule", icon: Calendar    },
];

const PRIORITY_BADGE: Record<string, string> = {
  emergency: "bg-red-500/15 text-red-400 border-red-500/25",
  urgent:    "bg-amber-500/15 text-amber-400 border-amber-500/25",
  normal:    "bg-blue-500/15 text-blue-400 border-blue-500/25",
};
const COMPLEXITY_BADGE: Record<string, string> = {
  complex:  "bg-red-500/15 text-red-400 border-red-500/25",
  moderate: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  routine:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
};

interface QueueEntry {
  queue_id: string; token_no: string; patient_name: string; department: string;
  priority: string; status: string; complexity: string;
  predicted_wait: number; is_emergency: boolean; checkin_time: string;
}
interface DoctorInfo {
  id: string; name: string; department: string;
  avg_consult_time: number; status: string; patients_served_today: number;
}

export default function DoctorDashboard() {
  const { user }    = useAuthStore();
  const [queue, setQueue]         = useState<QueueEntry[]>([]);
  const [doctor, setDoctor]       = useState<DoctorInfo | null>(null);
  const [activeId, setActiveId]   = useState<string | null>(null);
  const [busy, setBusy]           = useState<Record<string, boolean>>({});
  const [docStatus, setDocStatus] = useState("available");

  const loadQueue = useCallback(async () => {
    if (!doctor?.id) return;
    try {
      const r  = await doctorAPI.getQueue(doctor.id);
      setQueue(r.data);
      const cur = r.data.find((q: QueueEntry) => q.status === "in_consultation");
      setActiveId(cur?.queue_id ?? null);
    } catch { /**/ }
  }, [doctor]);

  const loadDoctor = useCallback(async () => {
    try {
      const r  = await doctorAPI.list();
      const me = r.data.find((d: DoctorInfo) => d.name === user?.name);
      if (me) setDoctor(me);
    } catch { /**/ }
  }, [user]);

  useEffect(() => { loadDoctor(); }, [loadDoctor]);
  useEffect(() => { if (doctor) loadQueue(); }, [doctor, loadQueue]);
  useEffect(() => {
    const ws = connectGlobal((e: WSEvent) => {
      if (e.event === "queue_update" || e.event === "consultation_ended") loadQueue();
    });
    return () => ws.close();
  }, [loadQueue]);

  const start = async (qId: string) => {
    setBusy(p => ({ ...p, [qId]: true }));
    try { await doctorAPI.startConsultation(qId); setActiveId(qId); toast.success("Consultation started"); loadQueue(); }
    catch { toast.error("Failed to start"); }
    finally { setBusy(p => ({ ...p, [qId]: false })); }
  };

  const end = async (qId: string) => {
    setBusy(p => ({ ...p, [qId]: true }));
    try { await doctorAPI.endConsultation(qId); setActiveId(null); toast.success("Consultation complete ✓"); loadQueue(); }
    catch { toast.error("Failed to end"); }
    finally { setBusy(p => ({ ...p, [qId]: false })); }
  };

  const changeStatus = async (s: string) => {
    if (!doctor?.id) return;
    try { await doctorAPI.updateStatus(doctor.id, s); setDocStatus(s); toast.success(`Status → ${s}`); }
    catch { toast.error("Failed"); }
  };

  const waiting   = queue.filter(q => q.status === "waiting");
  const inConsult = queue.find(q => q.status === "in_consultation");

  const STAT_STATUS = [
    { label: "available", color: "text-emerald-400", border: "border-emerald-500/30", bg: "rgba(16,185,129,0.1)"  },
    { label: "break",     color: "text-amber-400",   border: "border-amber-500/30",   bg: "rgba(245,158,11,0.1)"  },
    { label: "offline",   color: "text-red-400",     border: "border-red-500/30",     bg: "rgba(239,68,68,0.1)"   },
  ];

  return (
    <DashboardLayout navItems={NAV} title="Doctor Dashboard" subtitle="Manage consultations and patient queue">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Waiting",      value: waiting.length,                        icon: Clock,       color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
            { label: "Consulting",   value: inConsult ? 1 : 0,                     icon: Stethoscope, color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20"  },
            { label: "Served Today", value: doctor?.patients_served_today ?? 0,    icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20"},
            { label: "Avg Consult",  value: `${doctor?.avg_consult_time ?? 0}m`,   icon: Activity,    color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/20"},
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-5 ${s.border}`}
              style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
              <div className={`w-9 h-9 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center mb-4`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className={`text-3xl font-black ${s.color} mb-1`}>{s.value}</div>
              <div className="text-xs text-slate-500 font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Status control */}
          <div className="rounded-2xl border border-white/[0.07] p-5"
            style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" /> My Availability Status
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {STAT_STATUS.map(s => (
                <button key={s.label} onClick={() => changeStatus(s.label)}
                  className={`py-2.5 text-xs font-semibold rounded-xl border capitalize transition-all ${docStatus === s.label ? `${s.color} ${s.border}` : "text-slate-500 border-white/[0.07] hover:border-white/15 hover:text-slate-300"}`}
                  style={docStatus === s.label ? { background: s.bg } : { background: "rgba(255,255,255,0.03)" }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active consultation */}
          {inConsult ? (
            <div className="rounded-2xl border border-blue-500/25 p-5 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.12),rgba(3,7,18,0.8))", backdropFilter: "blur(16px)" }}>
              <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ background: "linear-gradient(180deg,#3b82f6,#10b981)" }} />
              <div className="pl-3">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">In Consultation</p>
                <p className="text-lg font-bold text-white mb-2">{inConsult.patient_name}</p>
                <div className="flex gap-2 mb-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${COMPLEXITY_BADGE[inConsult.complexity]}`}>{inConsult.complexity}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${PRIORITY_BADGE[inConsult.priority]}`}>{inConsult.priority}</span>
                </div>
                <button onClick={() => end(inConsult.queue_id)} disabled={busy[inConsult.queue_id]}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 hover:brightness-110 transition-all"
                  style={{ background: "linear-gradient(135deg,#059669,#10b981)", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>
                  {busy[inConsult.queue_id] ? "Ending..." : <><CheckCircle className="w-4 h-4" /> End Consultation</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.07] p-5 flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
              <div className="text-center">
                <Stethoscope className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No active consultation</p>
              </div>
            </div>
          )}
        </div>

        {/* Waiting queue */}
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" /> Waiting Queue
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-400 border border-blue-500/25">{waiting.length}</span>
            </h3>
            <button onClick={loadQueue} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-400 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {waiting.length === 0 ? (
            <div className="py-16 text-center">
              <Stethoscope className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No patients waiting</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {waiting.map((entry, i) => (
                <div key={entry.queue_id}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-all ${entry.is_emergency ? "ring-emergency" : entry.priority === "urgent" ? "ring-urgent" : ""}`}>
                  <div className="w-8 text-2xl font-black text-slate-700 shrink-0 text-center">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white text-sm">{entry.patient_name}</span>
                      {entry.is_emergency && <span className="text-xs">🚨</span>}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="font-mono text-xs text-slate-500">{entry.token_no}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${PRIORITY_BADGE[entry.priority]}`}>{entry.priority}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${COMPLEXITY_BADGE[entry.complexity]}`}>{entry.complexity}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-slate-400 mb-1.5">{Math.round(entry.predicted_wait)} min</div>
                    <button onClick={() => start(entry.queue_id)}
                      disabled={!!activeId || busy[entry.queue_id]}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
                      style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)" }}>
                      {busy[entry.queue_id] ? "..." : <><Play className="w-3 h-3" /> Start</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
