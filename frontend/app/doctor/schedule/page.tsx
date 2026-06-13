"use client";
import { useEffect, useState, useCallback } from "react";
import { Stethoscope, BarChart2, Calendar, Clock, Check, Power, AlertCircle, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { doctorAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import toast from "react-hot-toast";

const NAV = [
  { label: "My Queue",   href: "/doctor",          icon: Stethoscope },
  { label: "Statistics", href: "/doctor/stats",    icon: BarChart2   },
  { label: "Schedule",   href: "/doctor/schedule", icon: Calendar    },
];

interface Appointment {
  id: string;
  time: string;
  patientName: string;
  type: string;
  status: "confirmed" | "completed" | "cancelled";
}

export default function DoctorSchedulePage() {
  const { user } = useAuthStore();
  const [doctor, setDoctor] = useState<any>(null);
  const [status, setStatus] = useState("available");
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState("Today");

  const loadDoctor = useCallback(async () => {
    setLoading(true);
    try {
      const r = await doctorAPI.list();
      const me = r.data.find((d: any) => d.user_id === user?.user_id);
      if (me) {
        setDoctor(me);
        setStatus(me.status);
      }
    } catch (e) {
      toast.error("Failed to load schedule metadata");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDoctor();
  }, [loadDoctor]);

  const handleStatusChange = async (newStatus: string) => {
    if (!doctor?.id) return;
    try {
      await doctorAPI.updateStatus(doctor.id, newStatus);
      setStatus(newStatus);
      toast.success(`Schedule status: ${newStatus}`);
    } catch (e) {
      toast.error("Failed to update schedule status");
    }
  };

  const scheduleDays = [
    { name: "Mon", date: "June 08", count: 4 },
    { name: "Tue", date: "June 09", count: 6 },
    { name: "Wed", date: "June 10", count: 3 },
    { name: "Today", date: "June 04", count: 5 },
    { name: "Fri", date: "June 05", count: 7 },
    { name: "Sat", date: "June 06", count: 2 },
    { name: "Sun", date: "June 07", count: 0 }
  ];

  const appointments: Record<string, Appointment[]> = {
    Today: [
      { id: "1", time: "09:00 AM", patientName: "Arthur Pendragon", type: "Regular Checkup", status: "completed" },
      { id: "2", time: "10:30 AM", patientName: "Guinevere Pendragon", type: "Follow-up Consultation", status: "completed" },
      { id: "3", time: "11:15 AM", patientName: "Merlin Ambrosius", type: "Emergency Assessment", status: "confirmed" },
      { id: "4", time: "02:00 PM", patientName: "Lancelot Du Lac", type: "Chronic Care Review", status: "confirmed" },
      { id: "5", time: "04:30 PM", patientName: "Morgana Le Fay", type: "Diagnostic Review", status: "confirmed" }
    ],
    Fri: [
      { id: "6", time: "09:30 AM", patientName: "Gawain Orkney", type: "First Visit", status: "confirmed" },
      { id: "7", time: "11:00 AM", patientName: "Galahad Pure", type: "Annual Physical", status: "confirmed" }
    ],
    Mon: [
      { id: "8", time: "10:00 AM", patientName: "Kay Seneschal", type: "Prescription Refill", status: "confirmed" }
    ]
  };

  const activeAppts = appointments[selectedDay] || [];

  return (
    <DashboardLayout navItems={NAV} title="Consultation Schedule" subtitle="Manage your calendar slots, availability blocks, and appointment lists">
      <div className="max-w-5xl mx-auto space-y-5">
        
        {/* Quick controls card */}
        <div className="rounded-2xl border border-white/[0.07] p-5 flex flex-col sm:flex-row justify-between items-center gap-4" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <div className="text-left">
            <h3 className="text-sm font-bold text-white">Duty Schedule Status</h3>
            <p className="text-xs text-slate-500">Toggle your active roster status in the patient queue</p>
          </div>
          
          <div className="flex gap-2">
            {[
              { val: "available", label: "Active Duty", color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" },
              { val: "break", label: "Temporary Break", color: "text-amber-400 border-amber-500/20 bg-amber-500/10" },
              { val: "offline", label: "Sign Off Duty", color: "text-red-400 border-red-500/20 bg-red-500/10" }
            ].map(item => (
              <button key={item.val} onClick={() => handleStatusChange(item.val)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                  status === item.val
                    ? item.color
                    : "text-slate-400 border-white/5 bg-white/2 hover:text-white hover:border-white/10"
                }`}>
                <Power className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar days timeline */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {scheduleDays.map(day => (
            <button key={day.name} onClick={() => setSelectedDay(day.name)}
              className={`rounded-2xl border p-4 text-center transition-all ${
                selectedDay === day.name
                  ? "border-blue-500/40 text-white"
                  : "border-white/[0.07] text-slate-400 hover:border-white/15 hover:text-white"
              }`}
              style={{
                background: selectedDay === day.name ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.025)",
                backdropFilter: "blur(16px)"
              }}>
              <div className="text-[10px] uppercase font-bold tracking-wider">{day.name}</div>
              <div className="text-base font-black mt-1">{day.date.split(" ")[1]}</div>
              <div className="text-[10px] text-slate-500 mt-2">{day.count} Slots</div>
            </button>
          ))}
        </div>

        {/* Schedule List */}
        <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-sm font-bold text-white">Appointments for {selectedDay === "Today" ? "Today" : selectedDay}</h3>
            <button onClick={loadDoctor} className="p-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all hover:bg-white/5">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="space-y-3">
            {activeAppts.length > 0 ? (
              activeAppts.map(appt => {
                let statusBadge = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                if (appt.status === "completed") statusBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                
                return (
                  <div key={appt.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-white/[0.05] hover:bg-white/[0.01] transition-all"
                    style={{ background: "rgba(255,255,255,0.01)" }}>
                    <div className="flex items-center gap-4">
                      <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 font-mono text-xs text-slate-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        {appt.time}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{appt.patientName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{appt.type}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold capitalize ${statusBadge}`}>
                        {appt.status}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-slate-500">
                <AlertCircle className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                No appointments booked for this day.
              </div>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
