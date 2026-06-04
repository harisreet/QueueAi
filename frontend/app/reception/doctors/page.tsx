"use client";
import { useEffect, useState, useCallback } from "react";
import { Users, UserPlus, AlertTriangle, Stethoscope, RefreshCw, Search, CheckCircle, XCircle, Coffee, Power } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { doctorAPI } from "@/lib/api";
import { connectGlobal, WSEvent } from "@/lib/websocket";
import toast from "react-hot-toast";

const NAV = [
  { label: "Queue Monitor", href: "/reception",           icon: Users        },
  { label: "Add Patient",   href: "/reception/add",       icon: UserPlus     },
  { label: "Emergency",     href: "/reception/emergency", icon: AlertTriangle },
  { label: "Doctors",       href: "/reception/doctors",   icon: Stethoscope  },
];

const DEPTS = ["All", "Cardiology","Orthopedics","Neurology","Pediatrics","General Medicine","Emergency","Dermatology","ENT","Gynecology","Ophthalmology","Psychiatry","Radiology"];

const STATUS_OPTIONS = [
  { val: "available", label: "Set Available", icon: CheckCircle, color: "text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5" },
  { val: "break",     label: "On Break",      icon: Coffee,      color: "text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/5"   },
  { val: "offline",   label: "Go Offline",    icon: Power,       color: "text-red-400 hover:border-red-500/30 hover:bg-red-500/5"          },
];

interface Doctor {
  id: string;
  name: string;
  department: string;
  specialization: string;
  avg_consult_time: number;
  status: string;
  is_available: boolean;
  patients_served_today: number;
}

export default function ReceptionDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await doctorAPI.list();
      setDoctors(res.data);
    } catch (e) {
      toast.error("Failed to load doctor directory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctors();
    const ws = connectGlobal((e: WSEvent) => {
      if (e.event === "doctor_status_changed") loadDoctors();
    });
    return () => ws.close();
  }, [loadDoctors]);

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await doctorAPI.updateStatus(id, status);
      toast.success(`Doctor status → ${status}`);
      loadDoctors();
    } catch (e) {
      toast.error("Failed to update doctor status");
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = doctors.filter(d => {
    const deptMatch = deptFilter === "All" || d.department === deptFilter;
    const searchMatch = search === "" || d.name.toLowerCase().includes(search.toLowerCase()) || d.specialization?.toLowerCase().includes(search.toLowerCase());
    return deptMatch && searchMatch;
  });

  const available = doctors.filter(d => d.is_available).length;
  const onBreak = doctors.filter(d => d.status === "break").length;
  const offline = doctors.filter(d => d.status === "offline").length;

  return (
    <DashboardLayout navItems={NAV} title="Doctor Directory" subtitle="Monitor all doctors across departments and toggle live availability status">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Status summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Available", value: available, color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/10", icon: CheckCircle },
            { label: "On Break",  value: onBreak,   color: "text-amber-400",   border: "border-amber-500/20",   bg: "bg-amber-500/10",   icon: Coffee      },
            { label: "Offline",   value: offline,   color: "text-red-400",     border: "border-red-500/20",     bg: "bg-red-500/10",     icon: XCircle     },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border ${s.border} p-4`} style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
              <div className={`w-8 h-8 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center mb-3`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input className="w-full py-2.5 pl-9 pr-4 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none border border-white/[0.08] focus:border-blue-500/50 transition-all"
              style={{ background: "rgba(255,255,255,0.04)" }}
              placeholder="Search doctor or specialization..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="py-2.5 px-4 rounded-xl text-sm text-white outline-none border border-white/[0.08] bg-[#0b0f19] cursor-pointer">
            {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <button onClick={loadDoctors} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all hover:bg-white/5 text-xs font-semibold">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* Doctors Table */}
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">
              {filtered.length} Doctors
              {deptFilter !== "All" && <span className="text-slate-500 font-normal text-xs ml-2">— {deptFilter}</span>}
            </h3>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <div className="live-dot" /> Live Status
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.05] text-slate-400">
                  <th className="py-3 px-4 font-semibold">Doctor</th>
                  <th className="py-3 px-4 font-semibold">Specialization</th>
                  <th className="py-3 px-4 font-semibold">Department</th>
                  <th className="py-3 px-4 font-semibold">Avg Consult</th>
                  <th className="py-3 px-4 font-semibold">Served Today</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filtered.length > 0 ? (
                  filtered.map(d => (
                    <tr key={d.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)" }}>
                            {d.name[0]}
                          </div>
                          <span className="font-bold text-white">{d.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{d.specialization || "General Practice"}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 border border-white/10 text-slate-300 capitalize">{d.department}</span>
                      </td>
                      <td className="py-3.5 px-4 text-amber-400 font-bold">{d.avg_consult_time}m</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-bold">{d.patients_served_today}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold capitalize ${
                          d.is_available
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : d.status === "break"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                        }`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex gap-1.5">
                          {STATUS_OPTIONS.map(s => (
                            <button key={s.val}
                              onClick={() => handleStatusChange(d.id, s.val)}
                              disabled={updatingId === d.id || d.status === s.val}
                              title={s.label}
                              className={`p-1.5 rounded-lg border border-white/5 text-slate-500 transition-all disabled:opacity-30 ${s.color}`}>
                              <s.icon className="w-3.5 h-3.5" />
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      {loading ? "Loading doctors..." : "No doctors found matching filters"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
