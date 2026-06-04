"use client";
import { useEffect, useState, useCallback } from "react";
import { Users, UserPlus, AlertTriangle, Stethoscope, RefreshCw, Search, ChevronDown, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { queueAPI, doctorAPI } from "@/lib/api";
import { connectGlobal, WSEvent } from "@/lib/websocket";
import toast from "react-hot-toast";

const NAV = [
  { label: "Queue Monitor", href: "/reception",           icon: Users        },
  { label: "Add Patient",   href: "/reception/add",       icon: UserPlus     },
  { label: "Emergency",     href: "/reception/emergency", icon: AlertTriangle },
  { label: "Doctors",       href: "/reception/doctors",   icon: Stethoscope  },
];

const DEPTS = ["Cardiology","Orthopedics","Neurology","Pediatrics","General Medicine","Emergency","Dermatology","ENT","Gynecology","Ophthalmology","Psychiatry","Radiology"];

const STATUS_BADGE: Record<string, string> = {
  waiting:         "bg-amber-500/15 text-amber-400 border-amber-500/25",
  in_consultation: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  completed:       "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  delayed:         "bg-red-500/15 text-red-400 border-red-500/25",
  cancelled:       "bg-slate-500/15 text-slate-400 border-slate-500/25",
};

interface QueueEntry { id: string; token_no: string; patient_name: string; department: string; queue_position: number; predicted_wait: number; priority: string; status: string; is_emergency: boolean; }
interface Doctor     { id: string; name: string; department: string; status: string; is_available: boolean; avg_consult_time: number; }

export default function ReceptionDashboard() {
  const [dept, setDept]     = useState("General Medicine");
  const [queue, setQueue]   = useState<QueueEntry[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergencyDept, setEmergencyDept] = useState("General Medicine");
  const [booking, setBooking] = useState(false);

  const loadQueue   = useCallback(async () => { try { const r = await queueAPI.getStatus(dept);   setQueue(r.data);   } catch { /**/ } }, [dept]);
  const loadDoctors = useCallback(async () => { try { const r = await doctorAPI.list(dept);        setDoctors(r.data); } catch { /**/ } }, [dept]);

  useEffect(() => { loadQueue(); loadDoctors(); }, [loadQueue, loadDoctors]);
  useEffect(() => {
    const ws = connectGlobal((e: WSEvent) => {
      if (["queue_update","consultation_ended","doctor_status_changed"].includes(e.event)) { loadQueue(); loadDoctors(); }
    });
    return () => ws.close();
  }, [loadQueue, loadDoctors]);

  const updateStatus = async (id: string, status: string) => {
    try { await queueAPI.updateStatus({ queue_id: id, status }); toast.success(`Status → ${status}`); loadQueue(); }
    catch { toast.error("Update failed"); }
  };

  const addEmergency = async () => {
    setBooking(true);
    try { await queueAPI.bookToken({ department: emergencyDept, priority: "emergency", complexity: "complex" }); toast.success("🚨 Emergency patient added"); setShowEmergency(false); loadQueue(); }
    catch { toast.error("Failed"); }
    finally { setBooking(false); }
  };

  const filtered = queue.filter(q =>
    q.patient_name.toLowerCase().includes(search.toLowerCase()) ||
    q.token_no.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    waiting:   queue.filter(q => q.status === "waiting").length,
    inConsult: queue.filter(q => q.status === "in_consultation").length,
    available: doctors.filter(d => d.is_available).length,
    emergency: queue.filter(q => q.is_emergency && q.status === "waiting").length,
  };

  const inputCls = "w-full py-2.5 px-4 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none border border-white/[0.08] focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all";
  const inputBg  = { background: "rgba(255,255,255,0.04)" };

  return (
    <DashboardLayout navItems={NAV} title="Reception Dashboard" subtitle="Live queue monitoring & management">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Waiting",      value: stats.waiting,   icon: Users,         color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20"   },
            { label: "In Consult",   value: stats.inConsult, icon: Stethoscope,   color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20"    },
            { label: "Doctors Live", value: stats.available, icon: UserPlus,      color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            { label: "Emergencies",  value: stats.emergency, icon: AlertTriangle, color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20"     },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border ${s.border} p-5`} style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
              <div className={`w-9 h-9 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center mb-4`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className={`text-3xl font-black ${s.color} mb-1`}>{s.value}</div>
              <div className="text-xs text-slate-500 font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <select value={dept} onChange={e => setDept(e.target.value)}
              className="py-2.5 pl-4 pr-8 rounded-xl text-sm text-white outline-none border border-white/[0.08] focus:border-blue-500/50 appearance-none cursor-pointer w-52 transition-all"
              style={inputBg}>
              {DEPTS.map(d => <option key={d} className="bg-slate-900">{d}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input className={`${inputCls} pl-9`} style={inputBg} placeholder="Search patient or token..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => { loadQueue(); loadDoctors(); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 border border-white/10 hover:border-white/20 hover:text-white transition-all"
            style={{ background: "rgba(255,255,255,0.04)" }}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => setShowEmergency(!showEmergency)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:brightness-110 transition-all"
            style={{ background: "linear-gradient(135deg,#be123c,#e11d48)", boxShadow: "0 4px 12px rgba(225,29,72,0.3)" }}>
            <AlertTriangle className="w-4 h-4" /> Emergency Override
          </button>
        </div>

        {/* Emergency form */}
        {showEmergency && (
          <div className="rounded-2xl border border-red-500/25 p-5" style={{ background: "rgba(239,68,68,0.06)", backdropFilter: "blur(16px)" }}>
            <h3 className="text-sm font-bold text-red-400 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Add Emergency Patient
            </h3>
            <div className="flex gap-3 flex-wrap">
              <div className="relative">
                <select value={emergencyDept} onChange={e => setEmergencyDept(e.target.value)}
                  className="py-2.5 pl-4 pr-8 rounded-xl text-sm text-white outline-none border border-red-500/20 appearance-none cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.04)" }}>
                  {DEPTS.map(d => <option key={d} className="bg-slate-900">{d}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
              </div>
              <button onClick={addEmergency} disabled={booking}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 hover:brightness-110 transition-all"
                style={{ background: "linear-gradient(135deg,#be123c,#e11d48)", boxShadow: "0 4px 12px rgba(225,29,72,0.3)" }}>
                {booking ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : <><UserPlus className="w-4 h-4" /> Add Emergency</>}
              </button>
            </div>
          </div>
        )}

        {/* Queue table */}
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">
              Live Queue — <span className="text-blue-400">{dept}</span>
              <span className="ml-2 text-slate-500 font-normal text-xs">({filtered.length} entries)</span>
            </h3>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <div className="live-dot" /> Live
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">No patients in queue</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>#</th><th>Token</th><th>Patient</th><th>Priority</th><th>Est. Wait</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(entry => (
                  <tr key={entry.id} className={entry.is_emergency ? "bg-red-500/[0.03]" : ""}>
                    <td className="text-slate-600 font-semibold">{entry.queue_position}</td>
                    <td><span className="font-mono font-black text-white">{entry.token_no}</span></td>
                    <td>
                      <span className="text-white font-medium">{entry.patient_name}</span>
                      {entry.is_emergency && <span className="ml-2 text-sm">🚨</span>}
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${
                        entry.priority === "emergency" ? "bg-red-500/15 text-red-400 border-red-500/25"
                        : entry.priority === "urgent"  ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                        : "bg-blue-500/15 text-blue-400 border-blue-500/25"}`}>
                        {entry.priority}
                      </span>
                    </td>
                    <td className="font-semibold text-slate-200">{Math.round(entry.predicted_wait)} min</td>
                    <td>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_BADGE[entry.status] || STATUS_BADGE.waiting}`}>
                        {entry.status.replace("_"," ")}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        {entry.status === "waiting" && (
                          <button onClick={() => updateStatus(entry.id, "delayed")}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-400 border border-amber-500/20 hover:bg-amber-500/10 transition-all">
                            Delay
                          </button>
                        )}
                        {!["completed","cancelled"].includes(entry.status) && (
                          <button onClick={() => updateStatus(entry.id, "cancelled")}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Doctors status */}
        <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <h3 className="text-sm font-bold text-white mb-4">Doctors — {dept}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {doctors.map(doc => (
              <div key={doc.id} className="p-3 rounded-xl border border-white/[0.06] text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white mx-auto mb-2"
                  style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)" }}>
                  {doc.name.charAt(0)}
                </div>
                <div className="text-xs font-semibold text-white truncate mb-1.5">{doc.name}</div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${doc.is_available ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-red-500/15 text-red-400 border-red-500/25"}`}>
                  {doc.status}
                </span>
                <div className="text-[10px] text-slate-600 mt-1">{doc.avg_consult_time}m avg</div>
              </div>
            ))}
            {doctors.length === 0 && <div className="col-span-5 text-center py-6 text-slate-600 text-sm">No doctors found</div>}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
