"use client";
import { useEffect, useState, useCallback } from "react";
import { Stethoscope, BarChart2, Calendar, Clock, Check, Power, AlertCircle, RefreshCw, Plus, Trash2 } from "lucide-react";
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

interface Shift {
  id: string;
  doctor_id: string;
  start_time: string;
  end_time: string;
}

export default function DoctorSchedulePage() {
  const { user } = useAuthStore();
  const [doctor, setDoctor] = useState<any>(null);
  const [status, setStatus] = useState("available");
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState("Today");

  // Shifts states
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [addingShift, setAddingShift] = useState(false);

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

  const loadShifts = useCallback(async () => {
    if (!doctor?.id) return;
    setShiftsLoading(true);
    try {
      const res = await doctorAPI.getShifts(doctor.id);
      setShifts(res.data);
    } catch {
      toast.error("Failed to load shifts");
    } finally {
      setShiftsLoading(false);
    }
  }, [doctor]);

  useEffect(() => {
    loadDoctor();
  }, [loadDoctor]);

  useEffect(() => {
    if (doctor) {
      loadShifts();
    }
  }, [doctor, loadShifts]);

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

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor?.id) return;
    if (!shiftStart || !shiftEnd) {
      toast.error("Please specify both start and end date/time");
      return;
    }

    const startIso = new Date(shiftStart).toISOString();
    const endIso = new Date(shiftEnd).toISOString();

    if (new Date(startIso) >= new Date(endIso)) {
      toast.error("Shift start time must be before end time");
      return;
    }

    setAddingShift(true);
    try {
      await doctorAPI.addShift(doctor.id, {
        start_time: startIso,
        end_time: endIso,
      });
      toast.success("Shift block scheduled!");
      setShiftStart("");
      setShiftEnd("");
      loadShifts();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to schedule shift block");
    } finally {
      setAddingShift(false);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      await doctorAPI.deleteShift(shiftId);
      toast.success("Shift removed");
      loadShifts();
    } catch {
      toast.error("Failed to delete shift");
    }
  };

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
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
      <div className="max-w-5xl mx-auto space-y-5 text-left">
        
        {/* Quick controls card */}
        <div className="rounded-2xl border border-white/[0.07] p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <div className="text-left">
            <h3 className="text-sm font-bold text-white">Duty Schedule Status</h3>
            <p className="text-xs text-slate-500">Toggle your active roster status in the patient queue</p>
          </div>
          
          <div className="flex gap-2 flex-wrap">
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

        <div className="grid md:grid-cols-2 gap-5">
          {/* Shift Manager card */}
          <div className="rounded-2xl border border-white/[0.07] p-5 flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
            <div>
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" /> Scheduled Duty Shifts
                </h3>
                <button onClick={loadShifts} className="p-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all hover:bg-white/5">
                  <RefreshCw className={`w-3.5 h-3.5 ${shiftsLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Add shift Form */}
              <form onSubmit={handleAddShift} className="space-y-4 mb-6 p-4 rounded-xl border border-white/[0.05]" style={{ background: "rgba(255,255,255,0.01)" }}>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Schedule Shift Block</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Start Time</label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full py-2 px-3 rounded-lg text-xs text-white outline-none border border-white/[0.08] focus:border-blue-500/50 bg-white/5 transition-all"
                      value={shiftStart}
                      onChange={e => setShiftStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">End Time</label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full py-2 px-3 rounded-lg text-xs text-white outline-none border border-white/[0.08] focus:border-blue-500/50 bg-white/5 transition-all"
                      value={shiftEnd}
                      onChange={e => setShiftEnd(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" disabled={addingShift}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold text-white hover:brightness-110 transition-all border border-blue-500/35 bg-blue-500/25">
                  <Plus className="w-3.5 h-3.5" /> {addingShift ? "Scheduling..." : "Add Shift Block"}
                </button>
              </form>

              {/* List of shifts */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {shifts.length > 0 ? (
                  shifts.map(shift => (
                    <div key={shift.id} className="flex items-center justify-between p-3 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                      <div className="text-xs text-slate-300 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <div>
                          <div className="font-semibold">{formatDateTime(shift.start_time)}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">to {formatDateTime(shift.end_time)}</div>
                        </div>
                      </div>
                      <button type="button" onClick={() => handleDeleteShift(shift.id)}
                        className="p-1.5 rounded-lg border border-red-500/20 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-slate-600 text-xs">
                    No scheduled shifts. General availability rules will apply.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Schedule List */}
          <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-bold text-white">Appointments for {selectedDay === "Today" ? "Today" : selectedDay}</h3>
              <button onClick={loadDoctor} className="p-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all hover:bg-white/5">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Calendar days timeline */}
            <div className="grid grid-cols-7 gap-1.5 mb-5">
              {scheduleDays.map(day => (
                <button key={day.name} onClick={() => setSelectedDay(day.name)}
                  className={`rounded-xl border py-2 px-1 text-center transition-all ${
                    selectedDay === day.name
                      ? "border-blue-500/40 text-white bg-blue-500/10"
                      : "border-white/[0.07] text-slate-400 hover:border-white/15 hover:text-white"
                  }`}>
                  <div className="text-[8px] uppercase font-bold tracking-wider">{day.name}</div>
                  <div className="text-xs font-black mt-0.5">{day.date.split(" ")[1]}</div>
                </button>
              ))}
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
                          <div className="text-xs font-bold text-white">{appt.patientName}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{appt.type}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold capitalize ${statusBadge}`}>
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

      </div>
    </DashboardLayout>
  );
}
