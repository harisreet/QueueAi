"use client";
import React, { use, useState, useEffect, useCallback, useRef } from "react";
import { Clock, Activity, AlertTriangle, Monitor, Sparkles, User, RefreshCw, Volume2, VolumeX, ShieldAlert } from "lucide-react";
import { queueAPI, doctorAPI } from "@/lib/api";
import { connectDepartment, WSEvent } from "@/lib/websocket";

interface QueueEntry {
  id: string;
  token_no: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string | null;
  department: string;
  queue_position: number;
  predicted_wait: number;
  priority: string;
  status: string;
  complexity: string;
  is_emergency: boolean;
}

interface Doctor {
  id: string;
  name: string;
  department: string;
  status: string;
  is_available: boolean;
  avg_consult_time: number;
}

export default function DisplayPage({ params }: { params: Promise<{ department: string }> }) {
  const resolvedParams = use(params);
  const department = decodeURIComponent(resolvedParams.department);

  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [muteAudio, setMuteAudio] = useState(true);
  const [localTime, setLocalTime] = useState("");
  const [localDate, setLocalDate] = useState("");
  const [showFlash, setShowFlash] = useState(false);

  // Audio chime change tracker
  const prevServingTokens = useRef<string[]>([]);

  // Synthesize hospital chime (E5 -> A5)
  const playChime = () => {
    if (muteAudio) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;

      // E5 Chime
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // A5 Chime starting slightly later
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880.00, now + 0.25);
      gain2.gain.setValueAtTime(0.08, now + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.start(now + 0.25);
      osc2.stop(now + 0.75);
    } catch (e) {
      console.error("Audio Context error:", e);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [queueRes, doctorRes] = await Promise.all([
        queueAPI.getStatus(department),
        doctorAPI.list(department),
      ]);

      const queueList: QueueEntry[] = queueRes.data;
      setQueue(queueList);
      setDoctors(doctorRes.data);

      // Check if "Now Serving" (in_consultation) tokens changed to play chime
      const servingTokens = queueList
        .filter((q) => q.status === "in_consultation")
        .map((q) => q.token_no)
        .sort();

      if (
        prevServingTokens.current.length > 0 &&
        JSON.stringify(prevServingTokens.current) !== JSON.stringify(servingTokens)
      ) {
        // Trigger a temporary screen flash effect and audio chime
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 1500);
        playChime();
      }

      prevServingTokens.current = servingTokens;
    } catch (err) {
      console.error("Error loading display board data:", err);
    } finally {
      setLoading(false);
    }
  }, [department, muteAudio]);

  // Initial load & WebSocket listener
  useEffect(() => {
    loadData();

    const ws = connectDepartment(department, (e: WSEvent) => {
      // Whenever queue list updates, refetch latest status
      loadData();
    });

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    return () => {
      ws.close();
    };
  }, [department, loadData]);

  // Local Clock updater
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setLocalTime(
        d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setLocalDate(
        d.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter queues
  const serving = queue.filter((q) => q.status === "in_consultation");
  const waiting = queue.filter((q) => q.status === "waiting");
  const emergencyCount = waiting.filter((q) => q.is_emergency).length;

  const handleToggleMute = () => {
    // Unmute requires a user click to activate AudioContext
    const prevMute = muteAudio;
    setMuteAudio(!prevMute);
    if (prevMute) {
      // If we are unmuting, play a quick test chime to unlock the browser AudioContext
      setTimeout(() => {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
          gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.15);
        } catch (e) {
          console.error(e);
        }
      }, 50);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4">
        <Activity className="w-12 h-12 text-blue-500 animate-pulse" />
        <span className="text-sm font-semibold uppercase tracking-wider">Loading Display Board...</span>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none font-sans transition-all duration-300 ${
        showFlash ? "ring-8 ring-emerald-500/20 bg-slate-900" : ""
      }`}
    >
      {/* Dynamic Sound Action Banner for standard Autoplay limitations */}
      {muteAudio && (
        <div className="bg-gradient-to-r from-blue-600/90 to-blue-700/90 border-b border-blue-500/30 text-white text-center py-2.5 px-4 flex items-center justify-center gap-3 animate-pulse cursor-pointer" onClick={handleToggleMute}>
          <VolumeX className="w-4 h-4 text-blue-200" />
          <span className="text-xs font-bold tracking-wide uppercase">Sound is muted. Click here to enable clinical voice/audio alerts!</span>
        </div>
      )}

      {/* Main header bar */}
      <header className="border-b border-white/[0.08] px-8 py-5 flex items-center justify-between" style={{ background: "rgba(3,7,18,0.4)" }}>
        <div className="flex items-center gap-4">
          <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Live TV display board</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">{department} Department</h1>
        </div>

        {/* Digital clock */}
        <div className="flex flex-col items-center">
          <div className="text-2xl font-black text-white font-mono tracking-widest">{localTime}</div>
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{localDate}</div>
        </div>

        {/* Right side connection info */}
        <div className="flex items-center gap-4">
          {/* Sound button indicator */}
          <button
            onClick={handleToggleMute}
            className={`p-2.5 rounded-xl border transition-all ${
              muteAudio
                ? "bg-slate-900 border-white/10 text-slate-500 hover:text-slate-300"
                : "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
            }`}
            title={muteAudio ? "Unmute alerts" : "Mute alerts"}
          >
            {muteAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 animate-bounce" />}
          </button>

          {/* Web socket connection status */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-ping" : "bg-rose-500"}`} />
            <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">
              {connected ? "Connected" : "Reconnecting..."}
            </span>
          </div>
        </div>
      </header>

      {/* KPI counters widget */}
      <section className="px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: "Active Doctors", value: doctors.filter((d) => d.is_available).length, color: "text-emerald-400" },
          { label: "Patients Waiting", value: waiting.length, color: "text-amber-400" },
          { label: "Currently Serving", value: serving.length, color: "text-blue-400" },
          { label: "Emergency Cases", value: emergencyCount, color: "text-rose-500", highlight: emergencyCount > 0 },
        ].map((stat, idx) => (
          <div
            key={idx}
            className={`rounded-2xl border p-4 transition-all ${
              stat.highlight
                ? "border-rose-500/30 bg-rose-500/5 animate-pulse"
                : "border-white/[0.05] bg-white/[0.015]"
            }`}
          >
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</div>
            <div className={`text-3xl font-black ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </section>

      {/* Main Grid View */}
      <main className="flex-1 px-8 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* NOW SERVING CARD PANEL (col-span-2) */}
        <div className="lg:col-span-2 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Now Serving
            </h2>
            {serving.length > 0 && (
              <span className="text-[10px] font-bold text-emerald-400 uppercase bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full animate-pulse">
                Consultation active
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            {serving.length > 0 ? (
              serving.map((item) => {
                const doc = doctors.find((d) => d.id === item.doctor_id);
                return (
                  <div
                    key={item.id}
                    className="flex-1 min-h-[160px] rounded-3xl border border-emerald-500/20 p-8 flex flex-col justify-between relative overflow-hidden transition-all duration-300"
                    style={{
                      background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(3,7,18,0.75))",
                      boxShadow: "0 8px 32px rgba(16,185,129,0.03)",
                    }}
                  >
                    {/* Pulsing signal background element */}
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-emerald-500/10 flex items-center justify-center">
                      <div className="w-36 h-36 rounded-full border border-emerald-500/5 animate-ping flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10" />
                      </div>
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-[11px] font-black uppercase text-emerald-400 tracking-widest mb-1.5">
                          Patient Token
                        </div>
                        <div className="text-7xl font-black text-white tracking-wider font-mono">
                          {item.token_no}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 tracking-wider">
                          Active
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-end justify-between border-t border-white/[0.06] pt-6 mt-4">
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                          Patient Name
                        </div>
                        <div className="text-2xl font-extrabold text-slate-200">
                          {item.patient_name}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                          Assigned Medical Staff
                        </div>
                        <div className="text-xl font-bold text-white flex items-center gap-1.5 justify-end">
                          <User className="w-4 h-4 text-emerald-400" />
                          {doc ? doc.name : "Physician"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                className="flex-1 rounded-3xl border border-white/[0.04] p-8 flex flex-col items-center justify-center text-center relative overflow-hidden"
                style={{ background: "rgba(255,255,255,0.015)" }}
              >
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <Activity className="w-6 h-6 text-slate-500" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-300 mb-1.5">No Active Consultation</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Waiting for doctors to call the next patient. Please keep your tokens ready and proceed when prompted.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* UP NEXT QUEUE LIST (col-span-1) */}
        <div className="lg:col-span-1 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
              Up Next — Waiting Queue ({waiting.length})
            </h2>
          </div>

          <div className="flex-1 rounded-3xl border border-white/[0.07] p-5 overflow-hidden flex flex-col" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {waiting.length > 0 ? (
                waiting.map((item, index) => {
                  const isEmerg = item.is_emergency || item.priority === "emergency";
                  const isUrgent = item.priority === "urgent";

                  let cardStyle = "border-white/[0.04] bg-white/[0.015]";
                  let textStyle = "text-white";
                  let badgeStyle = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                  let badgeLabel = "Normal";

                  if (isEmerg) {
                    cardStyle = "border-rose-500/30 bg-rose-500/5 animate-pulse";
                    textStyle = "text-rose-400";
                    badgeStyle = "bg-rose-500/20 text-rose-400 border-rose-500/30 font-black animate-bounce";
                    badgeLabel = "🚨 Emergency";
                  } else if (isUrgent) {
                    cardStyle = "border-amber-500/25 bg-amber-500/5";
                    textStyle = "text-amber-400";
                    badgeStyle = "bg-amber-500/10 text-amber-400 border-amber-500/25";
                    badgeLabel = "Urgent";
                  }

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${cardStyle}`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-slate-400">
                          #{index + 1}
                        </div>
                        <div>
                          <div className={`text-xl font-black font-mono tracking-wider ${textStyle}`}>
                            {item.token_no}
                          </div>
                          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            {item.patient_name.length > 15 ? `${item.patient_name.substring(0, 15)}...` : item.patient_name}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${badgeStyle}`}>
                          {badgeLabel}
                        </span>
                        <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          Est: <span className="text-white">{Math.round(item.predicted_wait)}m</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-10">
                  <Activity className="w-8 h-8 text-slate-600 mb-3" />
                  <h4 className="text-sm font-bold text-slate-400">Queue is Empty</h4>
                  <p className="text-[10px] text-slate-500 max-w-xs mt-1">
                    All checked-in patients have been served. New patients book tokens at the reception desk.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer statistics tracker */}
      <footer className="border-t border-white/[0.08] px-8 py-4 flex items-center justify-between" style={{ background: "rgba(3,7,18,0.2)" }}>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
          QueueCare AI Waiting Room Platform
        </div>
        <div className="flex gap-6 items-center">
          <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-blue-400" />
            Total Physicians On shift: <span className="text-white font-black">{doctors.length}</span>
          </div>
          <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Queue Status: <span className="text-white font-black">{waiting.length} Waiting</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
