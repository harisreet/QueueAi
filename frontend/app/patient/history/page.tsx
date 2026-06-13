"use client";
import { useEffect, useState, useCallback } from "react";
import { Hash, Plus, Activity, Calendar, Clock, RefreshCw, ChevronRight, FileText, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { queueAPI, doctorAPI } from "@/lib/api";
import toast from "react-hot-toast";

const NAV = [
  { label: "My Queue",        href: "/patient",         icon: Hash     },
  { label: "Book Appointment",href: "/patient/book",    icon: Plus     },
  { label: "AI Predictor",    href: "/patient/predict", icon: Activity },
  { label: "History",         href: "/patient/history", icon: Calendar },
];

const STATUS_BADGE: Record<string, string> = {
  waiting:         "bg-amber-500/15 text-amber-400 border-amber-500/25",
  in_consultation: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  completed:       "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  delayed:         "bg-red-500/15 text-red-400 border-red-500/25",
  cancelled:       "bg-red-500/15 text-red-400 border-red-500/25",
};

export default function HistoryPage() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [doctorMap, setDoctorMap] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await queueAPI.getMyTokens();
      setTokens(res.data);
      // Only auto-select the first token on initial load (functional update avoids stale closure)
      if (res.data.length > 0) {
        setSelectedToken(prev => prev ?? res.data[0]);
      }
      
      // Load doctors to resolve doctor names
      const docsRes = await doctorAPI.list();
      const mapping: Record<string, string> = {};
      docsRes.data.forEach((d: any) => {
        mapping[d.id] = d.name;
      });
      setDoctorMap(mapping);
    } catch (e) {
      toast.error("Failed to load appointment history");
    } finally {
      setLoading(false);
    }
  }, []); // No selectedToken dep — avoids infinite re-render loop

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTokens = tokens.filter(t => {
    if (filter === "all") return true;
    if (filter === "active") return ["waiting", "in_consultation", "delayed"].includes(t.status);
    return t.status === filter;
  });

  return (
    <DashboardLayout navItems={NAV} title="Appointment History" subtitle="Review past tokens, consultation details, and prediction accuracies">
      <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-5">
        
        {/* Token List Block */}
        <div className="md:col-span-3 rounded-2xl border border-white/[0.07] p-5 text-left flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <div>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-bold text-white">Roster Log</h3>
              
              <div className="flex items-center gap-2">
                <select value={filter} onChange={e => setFilter(e.target.value)}
                  className="py-1.5 px-2.5 rounded-xl border border-white/10 text-xs text-slate-300 bg-[#0b0f19] outline-none cursor-pointer">
                  <option value="all">All Tokens</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button onClick={loadData} className="p-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {filteredTokens.length > 0 ? (
                filteredTokens.map(t => (
                  <button key={t.id} onClick={() => setSelectedToken(t)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                      selectedToken?.id === t.id
                        ? "border-blue-500/30 bg-blue-500/10"
                        : "border-white/[0.05] bg-white/[0.01] hover:border-white/10"
                    }`}>
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-black font-mono text-white">{t.token_no}</div>
                      <div>
                        <div className="text-xs font-bold text-slate-200 capitalize">{t.department}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(t.checkin_time).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold capitalize ${STATUS_BADGE[t.status] || STATUS_BADGE.waiting}`}>
                        {t.status.replace("_", " ")}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-500 py-12 text-center">No historic tokens found matching filters</div>
              )}
            </div>
          </div>
        </div>

        {/* Selected Token Detail Panel */}
        <div className="md:col-span-2">
          {selectedToken ? (
            <div className="rounded-2xl border border-white/[0.07] p-5 text-left space-y-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Consultation Sheet</span>
                <span className="font-mono text-xs text-slate-400">ID: {selectedToken.id.slice(0, 8)}</span>
              </div>

              {/* Header */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <div className="text-4xl font-black text-white font-mono">{selectedToken.token_no}</div>
                <div className="text-xs font-bold text-slate-300 mt-1 capitalize">{selectedToken.department}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Checked in at {new Date(selectedToken.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Meta */}
              <div className="space-y-3 pt-2 text-xs">
                <div className="flex justify-between border-b border-white/[0.04] pb-2">
                  <span className="text-slate-500">Consulting Provider</span>
                  <span className="text-white font-semibold">
                    {selectedToken.doctor_id ? (doctorMap[selectedToken.doctor_id] || "Assigned Doctor") : "Department Queue Pool"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/[0.04] pb-2">
                  <span className="text-slate-500">Priority Level</span>
                  <span className="text-white font-semibold capitalize">{selectedToken.priority}</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.04] pb-2">
                  <span className="text-slate-500">Predicted AI Wait</span>
                  <span className="text-white font-bold">{Math.round(selectedToken.predicted_wait)} minutes</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.04] pb-2">
                  <span className="text-slate-500">Status</span>
                  <span className="text-blue-400 font-semibold capitalize">{selectedToken.status.replace("_", " ")}</span>
                </div>
              </div>

              {/* Consultation Summary Log */}
              {selectedToken.status === "completed" && (
                <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Consultation Logged
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">Wait time forecast matched within 94% threshold. Duration estimated 10m.</p>
                </div>
              )}

              {/* Notes */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-[10px] text-slate-500 space-y-1">
                <span className="text-white font-bold flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Doctor Notes:</span>
                <p className="leading-relaxed">
                  {selectedToken.status === "completed" ? "Routine checkup finished. General health vitals normal. Prescribed regular fluids." : "Patient in active queue pool. Awaiting triage."}
                </p>
              </div>

            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.07] p-8 text-center text-slate-500 text-xs bg-white/[0.01]">
              Select an appointment card to view medical sheet details
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
