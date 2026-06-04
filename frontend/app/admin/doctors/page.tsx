"use client";
import { useEffect, useState, useCallback } from "react";
import { BarChart2, Activity, Brain, Users, Shield, UserPlus, Edit2, Trash2, Check, X, RefreshCw, Star, Heart } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { doctorAPI, analyticsAPI } from "@/lib/api";
import toast from "react-hot-toast";

const NAV = [
  { label: "Overview",       href: "/admin",         icon: BarChart2  },
  { label: "Queue Analytics",href: "/admin/queue",   icon: Activity   },
  { label: "AI Insights",    href: "/admin/ai",      icon: Brain      },
  { label: "Doctors",        href: "/admin/doctors", icon: Users      },
  { label: "Settings",       href: "/admin/settings",icon: Shield     },
];

const DEPTS = ["Cardiology", "Orthopedics", "Neurology", "Pediatrics", "General Medicine", "Emergency", "Dermatology", "ENT", "Gynecology", "Ophthalmology", "Psychiatry", "Radiology"];

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

export default function DoctorManagementPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [utilization, setUtilization] = useState<any[]>([]);

  // Add/Edit states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    name: "",
    department: "General Medicine",
    specialization: "",
    avg_consult_time: 10
  });

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const [docRes, utilRes] = await Promise.allSettled([
        doctorAPI.list(),
        analyticsAPI.doctorUtilization()
      ]);
      
      if (docRes.status === "fulfilled") setDoctors(docRes.value.data);
      if (utilRes.status === "fulfilled") setUtilization(utilRes.value.data);
    } catch (e) {
      toast.error("Failed to load doctor database");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await doctorAPI.create(form);
      toast.success("👨‍⚕️ Doctor profile registered successfully!");
      setIsAddOpen(false);
      setForm({ name: "", department: "General Medicine", specialization: "", avg_consult_time: 10 });
      loadDoctors();
    } catch (e) {
      toast.error("Failed to register doctor");
    }
  };

  const handleEdit = (doc: Doctor) => {
    setEditId(doc.id);
    setForm({
      name: doc.name,
      department: doc.department,
      specialization: doc.specialization || "",
      avg_consult_time: doc.avg_consult_time
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await doctorAPI.update(id, form);
      toast.success("Doctor details updated");
      setEditId(null);
      loadDoctors();
    } catch (e) {
      toast.error("Failed to update doctor details");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this doctor from the system?")) return;
    try {
      await doctorAPI.delete(id);
      toast.success("Doctor deleted successfully");
      loadDoctors();
    } catch (e) {
      toast.error("Failed to delete doctor");
    }
  };

  const handleToggleStatus = async (doc: Doctor) => {
    const nextStatus = doc.is_available ? "offline" : "available";
    try {
      await doctorAPI.updateStatus(doc.id, nextStatus);
      toast.success(`Doctor set to ${nextStatus}`);
      loadDoctors();
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  // Find custom stats for doctor
  const getDoctorUtil = (id: string) => {
    const data = utilization.find(u => u.doctor_id === id);
    return data ? {
      consultations: data.consultations,
      avg_duration: Math.round(data.avg_duration * 10) / 10,
      accuracy: Math.round(data.accuracy)
    } : { consultations: 0, avg_duration: 0, accuracy: 92 };
  };

  return (
    <DashboardLayout navItems={NAV} title="Doctor Directory" subtitle="Manage healthcare providers, live consultation logs, and availability">
      <div className="max-w-7xl mx-auto space-y-5">
        
        {/* Actions header */}
        <div className="flex justify-between items-center bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
          <div className="text-xs text-slate-400">
            <span className="text-white font-bold">{doctors.length}</span> Doctors registered
            <span className="mx-2">•</span>
            <span className="text-emerald-400 font-bold">{doctors.filter(d => d.is_available).length}</span> Online
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setIsAddOpen(true); setEditId(null); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Add Doctor
            </button>
            <button onClick={loadDoctors} className="p-2 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all hover:bg-white/5">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Register Dialog */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md border border-white/10 rounded-2xl p-6 text-left" style={{ background: "linear-gradient(160deg,#0a0f1e, #030712)" }}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-bold text-white">Register Doctor</h3>
                <button onClick={() => setIsAddOpen(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAddDoctor} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Doctor Name</label>
                  <input type="text" required placeholder="Dr. Jane Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full py-3 px-4 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none border border-white/[0.08] focus:border-blue-500/50" style={{ background: "rgba(255,255,255,0.04)" }} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Department</label>
                    <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                      className="w-full py-3 px-4 rounded-xl text-sm text-white outline-none border border-white/[0.08] bg-[#0b0f19]">
                      {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Specialization</label>
                    <input type="text" placeholder="Cardiologist" value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })}
                      className="w-full py-3 px-4 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none border border-white/[0.08] focus:border-blue-500/50" style={{ background: "rgba(255,255,255,0.04)" }} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Avg Consultation Duration (Minutes)</label>
                  <input type="number" required min="1" max="120" value={form.avg_consult_time} onChange={e => setForm({ ...form, avg_consult_time: parseInt(e.target.value) })}
                    className="w-full py-3 px-4 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none border border-white/[0.08] focus:border-blue-500/50" style={{ background: "rgba(255,255,255,0.04)" }} />
                </div>

                <button type="submit" className="w-full py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all">
                  Register Profile
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Doctor Grid / List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {doctors.length > 0 ? (
            doctors.map(d => {
              const u = getDoctorUtil(d.id);
              const isEditing = editId === d.id;

              return (
                <div key={d.id} className="rounded-2xl border border-white/[0.07] p-5 relative flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
                  
                  {/* Top card bar */}
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        {isEditing ? (
                          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-white/10 text-white font-bold text-sm px-2 py-1 rounded" />
                        ) : (
                          <h4 className="text-sm font-black text-white">{d.name}</h4>
                        )}
                        
                        {isEditing ? (
                          <input type="text" value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} className="bg-white/10 text-slate-400 text-xs px-2 py-1 mt-1 rounded block" />
                        ) : (
                          <p className="text-xs text-slate-400 mt-0.5">{d.specialization || "General Medicine Practitioner"}</p>
                        )}
                      </div>
                      
                      <button onClick={() => handleToggleStatus(d)} className={`px-2 py-0.5 rounded-full border text-[9px] font-bold capitalize transition-all ${
                        d.is_available
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      }`}>
                        {d.status}
                      </button>
                    </div>

                    <div className="flex gap-2 mb-4">
                      {isEditing ? (
                        <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="bg-white/10 text-xs text-slate-300 p-1 rounded">
                          {DEPTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                        </select>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 border border-white/10 text-slate-300 capitalize">{d.department}</span>
                      )}
                    </div>

                    {/* Stats block */}
                    <div className="grid grid-cols-3 gap-2 bg-white/[0.015] border border-white/[0.04] rounded-xl p-3 mb-4 text-center">
                      <div>
                        <div className="text-base font-bold text-blue-400">{d.patients_served_today}</div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Served</div>
                      </div>
                      <div>
                        <div className="text-base font-bold text-amber-400">
                          {isEditing ? (
                            <input type="number" value={form.avg_consult_time} onChange={e => setForm({ ...form, avg_consult_time: parseInt(e.target.value) })} className="bg-white/10 w-10 text-center rounded text-xs" />
                          ) : (
                            `${d.avg_consult_time}m`
                          )}
                        </div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Avg Consult</div>
                      </div>
                      <div>
                        <div className="text-base font-bold text-emerald-400">{u.accuracy}%</div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Accuracy</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-between border-t border-white/[0.05] pt-3.5 mt-2">
                    <div className="text-[10px] text-slate-500 font-mono">ID: {d.id.slice(0, 8)}...</div>
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={() => handleSaveEdit(d.id)} className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white transition-all">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg bg-slate-600/20 text-slate-400 border border-slate-500/20 hover:bg-slate-600 hover:text-white transition-all">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleEdit(d)} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg bg-red-500/5 border border-red-500/10 text-slate-500 hover:text-red-400 hover:border-red-500/25 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              );
            })
          ) : (
            <div className="col-span-full py-16 text-center text-slate-500 bg-white/[0.01] border border-white/10 rounded-2xl">
              {loading ? "Loading doctors..." : "No doctors in system. Click 'Add Doctor' to register first provider."}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
