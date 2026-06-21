"use client";
import { useEffect, useState, useCallback } from "react";
import { Hash, Plus, Activity, Calendar, Clock, RefreshCw, ChevronRight, FileText, CheckCircle2, Star } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { queueAPI, doctorAPI } from "@/lib/api";
import toast from "react-hot-toast";

const NAV = [
  { label: "My Queue",         href: "/patient",         icon: Hash     },
  { label: "Book Appointment", href: "/patient/book",    icon: Plus     },
  { label: "AI Predictor",     href: "/patient/predict", icon: Activity },
  { label: "History",          href: "/patient/history", icon: Calendar },
];

const STATUS_BADGE: Record<string, string> = {
  waiting:         "bg-amber-500/15 text-amber-400 border-amber-500/25",
  in_consultation: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  completed:       "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  delayed:         "bg-red-500/15 text-red-400 border-red-500/25",
  cancelled:       "bg-red-500/15 text-red-400 border-red-500/25",
};

// ── Star Rating Component ────────────────────────────────────────────────────
function StarRating({
  value, onChange, readonly = false,
}: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`transition-transform ${readonly ? "cursor-default" : "cursor-pointer hover:scale-125"}`}
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              star <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "text-slate-600"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ── Feedback Panel ────────────────────────────────────────────────────────────
function FeedbackPanel({ token, onSubmitted }: { token: any; onSubmitted: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!token._rated);

  const handleSubmit = async () => {
    if (rating === 0) { toast.error("Please select a star rating"); return; }
    setSubmitting(true);
    try {
      await doctorAPI.submitFeedback(token.id, { rating, comment: comment || undefined });
      toast.success("Thank you for your feedback! ⭐");
      setSubmitted(true);
      onSubmitted();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to submit feedback";
      if (msg.includes("already")) {
        toast("Feedback already submitted for this visit", { icon: "ℹ️" });
        setSubmitted(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
          <Star className="w-3.5 h-3.5 fill-amber-400" /> Feedback Recorded
        </div>
        <p className="text-[10px] text-slate-400">Your review has been saved. Thank you!</p>
      </div>
    );
  }

  return (
    <div className="border border-indigo-500/20 bg-indigo-500/5 rounded-xl p-4 space-y-3">
      <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
        Rate your experience
      </div>
      <StarRating value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Optional comment (max 500 chars)…"
        maxLength={500}
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none resize-none focus:border-indigo-500/40 transition-colors"
      />
      <button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="w-full py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-all"
      >
        {submitting ? "Submitting…" : "Submit Feedback"}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
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
      if (res.data.length > 0) {
        setSelectedToken((prev: any) => prev ?? res.data[0]);
      }
      const docsRes = await doctorAPI.list();
      const mapping: Record<string, string> = {};
      docsRes.data.forEach((d: any) => { mapping[d.id] = d.name; });
      setDoctorMap(mapping);
    } catch (e) {
      toast.error("Failed to load appointment history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredTokens = tokens.filter(t => {
    if (filter === "all") return true;
    if (filter === "active") return ["waiting", "in_consultation", "delayed"].includes(t.status);
    return t.status === filter;
  });

  return (
    <DashboardLayout navItems={NAV} title="Appointment History" subtitle="Review past tokens, consultation details, and leave feedback">
      <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-5">

        {/* Token List */}
        <div className="md:col-span-3 rounded-2xl border border-white/[0.07] p-5 text-left flex flex-col" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
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

          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
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

        {/* Detail Panel */}
        <div className="md:col-span-2">
          {selectedToken ? (
            <div className="rounded-2xl border border-white/[0.07] p-5 text-left space-y-4" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Consultation Sheet</span>
                <span className="font-mono text-xs text-slate-400">ID: {selectedToken.id.slice(0, 8)}</span>
              </div>

              {/* Token header */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <div className="text-4xl font-black text-white font-mono">{selectedToken.token_no}</div>
                <div className="text-xs font-bold text-slate-300 mt-1 capitalize">{selectedToken.department}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Checked in at {new Date(selectedToken.checkin_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>

              {/* Meta rows */}
              <div className="space-y-3 text-xs">
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
                  <span className="text-slate-500">AI Predicted Wait</span>
                  <span className="text-white font-bold">{Math.round(selectedToken.predicted_wait)} min</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.04] pb-2">
                  <span className="text-slate-500">Status</span>
                  <span className="text-blue-400 font-semibold capitalize">{selectedToken.status.replace("_", " ")}</span>
                </div>
              </div>

              {/* Completed: Consultation note + Feedback */}
              {selectedToken.status === "completed" && (
                <>
                  <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Consultation Complete
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5 text-[10px] text-slate-400 space-y-1">
                      <span className="text-white font-bold flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Doctor Notes:
                      </span>
                      <p className="leading-relaxed">Routine checkup finished. General health vitals normal.</p>
                    </div>
                  </div>

                  {/* ⭐ Feedback Widget */}
                  <FeedbackPanel token={selectedToken} onSubmitted={loadData} />
                </>
              )}

              {/* Active / waiting note */}
              {selectedToken.status !== "completed" && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-[10px] text-slate-500">
                  <span className="text-white font-bold flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3" /> Queue Status
                  </span>
                  Patient in active queue pool. Awaiting triage.
                </div>
              )}
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
