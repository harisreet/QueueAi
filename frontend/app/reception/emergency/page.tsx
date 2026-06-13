"use client";
import { useEffect, useState, useCallback } from "react";
import { Users, UserPlus, AlertTriangle, Stethoscope, RefreshCw, ChevronDown, Loader2, Sparkles, ShieldAlert } from "lucide-react";
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

interface QueueEntry {
  id: string;
  token_no: string;
  patient_name: string;
  department: string;
  queue_position: number;
  predicted_wait: number;
  priority: string;
  status: string;
  is_emergency: boolean;
}

export default function EmergencyManagementPage() {
  const [emergencies, setEmergencies] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState("General Medicine");
  const [booking, setBooking] = useState(false);
  const [emergencyPatientName, setEmergencyPatientName] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch active queues across all departments
      const res = await queueAPI.getStatus("Emergency");
      // Since getStatus(dept) takes department, let's load all and filter or make parallel requests
      const allDeptsRes = await Promise.allSettled(
        DEPTS.map(d => queueAPI.getStatus(d))
      );
      
      const combined: QueueEntry[] = [];
      allDeptsRes.forEach(r => {
        if (r.status === "fulfilled") {
          combined.push(...r.value.data);
        }
      });

      // Filter emergencies
      const emg = combined.filter(q => q.is_emergency || q.priority === "emergency" || q.priority === "urgent");
      setEmergencies(emg);
    } catch (e) {
      toast.error("Failed to load emergency roster");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const ws = connectGlobal((e: WSEvent) => {
      if (["queue_update", "consultation_ended", "consultation_started"].includes(e.event)) {
        loadData();
      }
    });
    return () => ws.close();
  }, [loadData]);

  const addEmergency = async () => {
    if (!emergencyPatientName.trim()) {
      toast.error("Please enter the patient's name before triggering an emergency override.");
      return;
    }
    setBooking(true);
    try {
      await queueAPI.bookToken({
        department: selectedDept,
        priority: "emergency",
        complexity: "complex",
        patient_name: emergencyPatientName.trim(),
      });
      toast.success(`🚨 Emergency override for ${emergencyPatientName}! Token placed at Position 1.`);
      setEmergencyPatientName("");
      loadData();
    } catch (e) {
      toast.error("Failed to initiate emergency override");
    } finally {
      setBooking(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await queueAPI.updateStatus({ queue_id: id, status });
      toast.success(`Patient set to ${status}`);
      loadData();
    } catch (e) {
      toast.error("Status update failed");
    }
  };

  return (
    <DashboardLayout navItems={NAV} title="Emergency & Priority Manager" subtitle="Manage critically ill bypass patients, priority queue positions, and triage overrides">
      <div className="max-w-5xl mx-auto space-y-5">
        
        {/* Urgent Override Console */}
        <div className="rounded-2xl border border-red-500/20 p-5 relative overflow-hidden text-left" style={{ background: "linear-gradient(135deg,rgba(239,68,68,0.06),rgba(3,7,18,0.8))", backdropFilter: "blur(16px)" }}>
          <div className="flex items-center gap-3 mb-4">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <div>
              <h3 className="text-sm font-bold text-red-400">Emergency Override Console</h3>
              <p className="text-xs text-slate-500">Inject critically ill patient immediately to top of selected department queue</p>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="block text-[10px] font-semibold text-red-400/70 uppercase tracking-wider mb-1.5">Patient Name *</label>
              <input
                type="text"
                placeholder="Critical patient name"
                value={emergencyPatientName}
                onChange={e => setEmergencyPatientName(e.target.value)}
                className="py-2.5 px-4 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none border border-red-500/25 bg-[#0b0f19] w-52"
              />
            </div>
            <div className="relative">
              <label className="block text-[10px] font-semibold text-red-400/70 uppercase tracking-wider mb-1.5">Department</label>
              <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)}
                className="py-2.5 pl-4 pr-8 rounded-xl text-sm text-white outline-none border border-red-500/25 bg-[#0b0f19] appearance-none cursor-pointer">
                {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 bottom-2.5 w-4 h-4 text-slate-600 pointer-events-none" />
            </div>
            
            <button onClick={addEmergency} disabled={booking || !emergencyPatientName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 hover:brightness-110 transition-all bg-red-600"
              style={{ boxShadow: "0 4px 12px rgba(239,68,68,0.3)" }}>
              {booking ? <><Loader2 className="w-4 h-4 animate-spin" /> Overriding...</> : <><UserPlus className="w-4 h-4" /> Trigger Immediate Bypass</>}
            </button>
          </div>
        </div>

        {/* Emergency active lists */}
        <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <div className="flex justify-between items-center mb-5">
            <div className="text-left">
              <h3 className="text-sm font-bold text-white">Active Priority Roster</h3>
              <p className="text-xs text-slate-500">All emergency and urgent cases currently queued</p>
            </div>
            
            <button onClick={loadData} className="p-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all hover:bg-white/5">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.05] text-slate-400">
                  <th className="py-3 px-4 font-semibold">Token</th>
                  <th className="py-3 px-4 font-semibold">Patient Name</th>
                  <th className="py-3 px-4 font-semibold">Department</th>
                  <th className="py-3 px-4 font-semibold">Queue Pos</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Classification</th>
                  <th className="py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {emergencies.length > 0 ? (
                  emergencies.map(e => (
                    <tr key={e.id} className="hover:bg-white/[0.01] transition-colors text-slate-300">
                      <td className="py-3.5 px-4 font-mono font-bold text-red-400">{e.token_no}</td>
                      <td className="py-3.5 px-4 text-white font-bold">{e.patient_name}</td>
                      <td className="py-3.5 px-4">{e.department}</td>
                      <td className="py-3.5 px-4 font-bold text-white">#{e.queue_position}</td>
                      <td className="py-3.5 px-4 capitalize">{e.status.replace("_", " ")}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold capitalize ${
                          e.is_emergency ? "bg-red-500/10 text-red-400 border-red-500/25" : "bg-amber-500/10 text-amber-400 border-amber-500/25"
                        }`}>
                          {e.is_emergency ? "emergency" : e.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex gap-2">
                          <button onClick={() => updateStatus(e.id, "in_consultation")}
                            className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all">
                            Triage
                          </button>
                          <button onClick={() => updateStatus(e.id, "cancelled")}
                            className="px-2 py-1 rounded-lg bg-red-500/5 text-slate-500 hover:text-red-400 border border-white/5 hover:border-red-500/20 transition-all">
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      {loading ? "Loading emergencies..." : "No active priority or emergency cases queued"}
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
