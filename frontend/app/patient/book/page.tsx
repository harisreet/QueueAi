"use client";
import { useEffect, useState, useCallback } from "react";
import { Hash, Plus, Activity, Calendar, Clock, RefreshCw, ChevronDown, Loader2, User } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { queueAPI, doctorAPI, aiAPI } from "@/lib/api";
import toast from "react-hot-toast";

const NAV = [
  { label: "My Queue",        href: "/patient",         icon: Hash     },
  { label: "Book Appointment",href: "/patient/book",    icon: Plus     },
  { label: "AI Predictor",    href: "/patient/predict", icon: Activity },
  { label: "History",         href: "/patient/history", icon: Calendar },
];

const DEPTS = ["Cardiology","Orthopedics","Neurology","Pediatrics","General Medicine","Emergency","Dermatology","ENT","Gynecology","Ophthalmology","Psychiatry","Radiology"];

export default function BookAppointmentPage() {
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [form, setForm] = useState({
    department: "General Medicine",
    doctor_id: "",
    priority: "normal",
    complexity: "routine"
  });
  
  // AI Preview State
  const [preview, setPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Load doctors for selected department
  const loadDoctors = useCallback(async (dept: string) => {
    setLoadingDocs(true);
    try {
      const res = await doctorAPI.list(dept);
      setDoctors(res.data);
      if (res.data.length > 0) {
        setForm(f => ({ ...f, doctor_id: res.data[0].id }));
      } else {
        setForm(f => ({ ...f, doctor_id: "" }));
      }
    } catch (e) {
      toast.error("Failed to load department doctors");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    loadDoctors(form.department);
  }, [form.department, loadDoctors]);

  // Live Wait Time Prediction Preview
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
        consultation_complexity: form.complexity
      });
      setPreview(res.data);
    } catch (e) {
      // Ignore
    } finally {
      setLoadingPreview(false);
    }
  }, [form.department, form.priority, form.complexity, doctors]);

  useEffect(() => {
    if (doctors.length >= 0) {
      updatePreview();
    }
  }, [doctors, form.priority, form.complexity, updatePreview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await queueAPI.bookToken({
        department: form.department,
        doctor_id: form.doctor_id || undefined,
        priority: form.priority,
        complexity: form.complexity
      });
      toast.success("🎟️ Appointment booked & token generated!");
      setForm({
        department: "General Medicine",
        doctor_id: "",
        priority: "normal",
        complexity: "routine"
      });
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout navItems={NAV} title="Book Appointment" subtitle="Reroute patient load and check predicted waiting times live before queueing">
      <div className="max-w-4xl mx-auto grid md:grid-cols-5 gap-5">
        
        {/* Booking Form Block */}
        <div className="md:col-span-3 rounded-2xl border border-white/[0.07] p-5 text-left" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <h3 className="text-sm font-bold text-white mb-5">Appointment Registration</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            
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

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Available Doctors</label>
              <div className="relative">
                <select value={form.doctor_id} onChange={e => setForm({ ...form, doctor_id: e.target.value })}
                  className="w-full py-3 px-4 rounded-xl text-sm text-white outline-none border border-white/[0.08] bg-[#0b0f19] appearance-none cursor-pointer disabled:opacity-50"
                  disabled={loadingDocs || doctors.length === 0}>
                  {doctors.length > 0 ? (
                    doctors.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.specialization || "General Medicine"}) - {d.status}
                      </option>
                    ))
                  ) : (
                    <option value="">No doctors available in department</option>
                  )}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Priority Level</label>
                <div className="relative">
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
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
                  <select value={form.complexity} onChange={e => setForm({ ...form, complexity: e.target.value })}
                    className="w-full py-3 px-4 rounded-xl text-sm text-white outline-none border border-white/[0.08] bg-[#0b0f19] appearance-none cursor-pointer">
                    <option value="routine">Routine</option>
                    <option value="moderate">Moderate</option>
                    <option value="complex">Complex</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white hover:brightness-110 transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)", boxShadow: "0 4px 16px rgba(37,99,235,0.4)" }}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Booking...</> : "Book Appointment & Get Token"}
            </button>
          </form>
        </div>

        {/* AI wait time preview Block */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-2xl border border-blue-500/20 p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.08),rgba(3,7,18,0.8))", backdropFilter: "blur(16px)" }}>
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> AI Live Waiting Preview
            </h4>
            
            {loadingPreview ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                Updating wait time forecast...
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
                    <span className="text-slate-500">Department Load</span>
                    <span className="text-white font-bold">{doctors.length} Doctors</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Congestion Risk</span>
                    <span className={`font-bold ${preview.peak_hour_risk === "HIGH" ? "text-red-400" : "text-emerald-400"}`}>{preview.peak_hour_risk}</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-[10px] text-slate-400 leading-relaxed">
                  <span className="text-blue-400 font-bold block mb-0.5">Recommendation:</span>
                  {preview.recommendation}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                Enter booking criteria to display live waiting forecast
              </div>
            )}
          </div>

          {/* Department Doctors Listing */}
          <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
            <h4 className="text-xs font-bold text-white mb-4 uppercase tracking-widest">Department Doctors</h4>
            <div className="space-y-2.5 max-h-[180px] overflow-y-auto">
              {doctors.length > 0 ? (
                doctors.map((d: any) => (
                  <div key={d.id} className="flex justify-between items-center px-3 py-2.5 rounded-xl border border-white/[0.05]" style={{ background: "rgba(255,255,255,0.015)" }}>
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <div className="text-xs text-left">
                        <div className="text-white font-bold">{d.name}</div>
                        <div className="text-slate-500 text-[10px]">{d.specialization || "Practitioner"}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize ${d.is_available ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" : "bg-slate-500/10 text-slate-400 border border-slate-500/25"}`}>
                      {d.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 py-4 text-center">No doctors registered in this department</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
