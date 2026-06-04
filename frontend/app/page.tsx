"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Activity, Brain, Clock, Users, ArrowRight, Zap, Shield, TrendingUp, ChevronRight, Star, Sparkles } from "lucide-react";

const STATS = [
  { label: "Prediction Accuracy", value: "94.2%", icon: Brain,     color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20" },
  { label: "Avg Wait Reduced",   value: "38%",     icon: Clock,     color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { label: "Patients Served",    value: "12,400+", icon: Users,     color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/20" },
  { label: "Active Hospitals",   value: "47",      icon: Shield,    color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
];

const FEATURES = [
  { icon: Brain,      title: "AI Waiting Time Prediction",  desc: "XGBoost model trained on 8,000+ queue records predicts wait time with 94% accuracy using 12 operational features.",        color: "text-blue-400",    bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { icon: Zap,        title: "Real-Time Queue Updates",     desc: "WebSocket-powered live recalculation whenever a consultation ends, emergency arrives, or a doctor becomes unavailable.",  color: "text-yellow-400",  bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  { icon: TrendingUp, title: "Peak-Hour Forecasting",      desc: "Hourly congestion forecast per department helps patients and staff plan smarter visits and reduce delays.",               color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { icon: Activity,   title: "Dynamic Queue Optimization",  desc: "Emergency override, priority scoring, doctor load balancing, and smart rescheduling built into every queue update.",    color: "text-pink-400",    bg: "bg-pink-500/10", border: "border-pink-500/20" },
  { icon: Shield,     title: "Role-Based Dashboards",       desc: "Dedicated enterprise interfaces for patients, receptionists, doctors, and admins with fine-grained access control.",    color: "text-violet-400",  bg: "bg-violet-500/10", border: "border-violet-500/20" },
  { icon: Clock,      title: "Continuous AI Learning",      desc: "Every completed consultation updates the model. Predictions improve automatically as the system learns your hospital.",  color: "text-cyan-400",    bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
];

const LIVE_QUEUE = [
  { dept: "Cardiology",       patients: 14, wait: 32, risk: "HIGH",   riskColor: "bg-red-500/15 text-red-400 border-red-500/30" },
  { dept: "General Medicine", patients: 8,  wait: 18, risk: "MEDIUM", riskColor: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { dept: "Orthopedics",      patients: 5,  wait: 11, risk: "LOW",    riskColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { dept: "Pediatrics",       patients: 11, wait: 27, risk: "MEDIUM", riskColor: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
];

function useCounter(target: number, duration = 1500) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const t = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(Math.round(start));
      if (start >= target) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [target, duration]);
  return val;
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at 20% 0%, rgba(37,99,235,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(16,185,129,0.08) 0%, transparent 50%), linear-gradient(160deg, #030712 0%, #0a0f1e 40%, #030b1a 100%)" }}>

      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06]" style={{ background: "rgba(3,7,18,0.8)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center glow-blue" style={{ background: "linear-gradient(135deg, #1d4ed8, #3b82f6)" }}>
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-base font-bold text-white">QueueCare</span>
              <span className="text-base font-bold text-gradient ml-1">AI</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            {["Features", "Live Queue", "AI Engine"].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(" ", "-")}`} className="hover:text-white transition-colors">{item}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm font-semibold text-slate-300 rounded-lg border border-white/10 hover:border-white/20 hover:text-white transition-all">
              Sign In
            </Link>
            <Link href="/signup" className="px-4 py-2 text-sm font-semibold text-white rounded-lg flex items-center gap-2 glow-blue" style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)" }}>
              Get Started <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="pt-40 pb-24 px-6 max-w-7xl mx-auto text-center relative">
        {/* Glow orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full pointer-events-none" style={{ background: "rgba(37,99,235,0.1)", filter: "blur(80px)" }} />
        <div className="absolute top-32 right-1/4 w-72 h-72 rounded-full pointer-events-none" style={{ background: "rgba(16,185,129,0.06)", filter: "blur(80px)" }} />

        <div className={`transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-8 text-sm font-medium text-blue-300 border-blue-500/25" style={{ background: "rgba(37,99,235,0.1)" }}>
            <div className="live-dot" />
            AI-Powered Hospital Queue Intelligence
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          </div>

          <h1 className="text-6xl md:text-7xl font-black text-white mb-6 leading-[1.05] tracking-tight">
            Predict Wait Times<br />
            <span className="text-shimmer">Before They Happen</span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            QueueCare AI uses <strong className="text-white font-semibold">XGBoost machine learning</strong> to predict patient waiting times with <strong className="text-blue-400 font-semibold">94% accuracy</strong>, dynamically optimizing hospital queues in real-time.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 text-base font-bold text-white rounded-2xl glow-blue transition-all hover:scale-105 hover:brightness-110" style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb, #3b82f6)" }}>
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-slate-300 rounded-2xl border border-white/10 hover:border-white/20 hover:text-white transition-all" style={{ background: "rgba(255,255,255,0.04)" }}>
              View Live Demo
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {STATS.map((s) => (
              <div key={s.label} className={`glass p-5 text-center border ${s.border}`} style={{ background: "rgba(255,255,255,0.025)" }}>
                <div className={`w-10 h-10 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center mx-auto mb-3`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className={`text-2xl font-black ${s.color} mb-1`}>{s.value}</div>
                <div className="text-xs text-slate-500 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Queue ────────────────────────────────────────────────────────── */}
      <section id="live-queue" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-4">
            <div className="live-dot" /> Live Queue Intelligence
          </div>
          <h2 className="text-4xl font-black text-white mb-4">Real-Time Queue Monitor</h2>
          <p className="text-slate-400 max-w-xl mx-auto">AI recalculates predicted wait times instantly when the queue changes.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-10">
          {LIVE_QUEUE.map((q) => (
            <div key={q.dept} className="glass p-5 flex items-center justify-between gap-4 border border-white/[0.06] hover:border-white/10 transition-all hover:-translate-y-1 cursor-default" style={{ background: "rgba(255,255,255,0.025)" }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="font-bold text-white text-base">{q.dept}</div>
                  <div className="text-sm text-slate-400">{q.patients} patients waiting</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-3xl font-black text-white">{q.wait}<span className="text-sm font-normal text-slate-500 ml-1">min</span></div>
                <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${q.riskColor}`}>{q.risk} LOAD</span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold text-white rounded-2xl glow-blue hover:scale-105 transition-all" style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)" }}>
            Book My Appointment <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-black text-white mb-4">Enterprise-Grade Intelligence</h2>
          <p className="text-slate-400 max-w-xl mx-auto">Everything a modern hospital needs to eliminate queue chaos.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass p-6 border border-white/[0.06] hover:border-white/10 hover:-translate-y-1 transition-all cursor-default" style={{ background: "rgba(255,255,255,0.025)" }}>
              <div className={`w-12 h-12 rounded-xl ${f.bg} border ${f.border} flex items-center justify-center mb-5`}>
                <f.icon className={`w-6 h-6 ${f.color}`} />
              </div>
              <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI Engine ─────────────────────────────────────────────────────────── */}
      <section id="ai-engine" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="glass border border-white/[0.07] p-10 md:p-14 relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(3,7,18,0.8))" }}>
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full pointer-events-none" style={{ background: "rgba(59,130,246,0.06)", filter: "blur(80px)" }} />
          <div className="relative grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-blue-300 border border-blue-500/25 mb-6" style={{ background: "rgba(37,99,235,0.12)" }}>
                <Brain className="w-3.5 h-3.5" /> AI Engine — XGBoost + Hybrid Architecture
              </span>
              <h2 className="text-4xl font-black text-white mb-5 leading-tight">Hybrid Prediction<br />Architecture</h2>
              <p className="text-slate-400 mb-8 leading-relaxed text-sm">
                <strong className="text-white">Layer 1:</strong> Rule-based baseline using queue length, doctor availability, and consultation history.<br /><br />
                <strong className="text-white">Layer 2:</strong> XGBoost AI correction engine trained on 8,000+ synthetic records with emergency and peak-hour behavioral patterns.
              </p>
              <div className="space-y-3">
                {[
                  { label: "Mean Absolute Error", value: "10.03 min",  color: "text-emerald-400" },
                  { label: "R² Score",            value: "0.9800",    color: "text-blue-400"    },
                  { label: "Training Samples",    value: "8,000+",    color: "text-violet-400"  },
                  { label: "Est. Accuracy",       value: "92.63%",    color: "text-amber-400"   },
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <span className="text-sm text-slate-400">{m.label}</span>
                    <span className={`text-sm font-bold ${m.color}`}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {/* Code block */}
              <div className="rounded-2xl border border-white/[0.06] overflow-hidden" style={{ background: "rgba(3,7,18,0.9)" }}>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                  <span className="ml-2 text-xs text-slate-500 font-mono">AI Prediction Response</span>
                </div>
                <pre className="p-5 text-sm font-mono leading-6 text-emerald-400 overflow-x-auto">
{`{
  "predicted_wait_time": 28.4,
  "confidence": 0.91,
  "baseline_estimate": 31.0,
  "ai_adjustment": -2.6,
  "peak_hour_risk": "MEDIUM",
  "recommendation": "Moderate wait.
   Staff will notify you."
}`}
                </pre>
              </div>
              <Link href="/signup" className="flex items-center justify-center gap-2 w-full py-4 text-sm font-bold text-white rounded-2xl glow-blue hover:scale-[1.01] transition-all" style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)" }}>
                Try the AI Predictor <Brain className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] py-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)" }}>
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-white">QueueCare AI</span>
        </div>
        <p className="text-xs text-slate-600">AI-Powered Hospital Queue Optimization Platform • XGBoost + FastAPI + Next.js</p>
      </footer>
    </div>
  );
}
