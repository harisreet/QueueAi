"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, Stethoscope, Users, Shield, User } from "lucide-react";
import toast from "react-hot-toast";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";

const DEMO_ROLES = [
  { role: "patient",      label: "Patient",     icon: User,        color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20",    email: "patient@demo.com"  },
  { role: "doctor",       label: "Doctor",      icon: Stethoscope, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", email: "doctor@demo.com"   },
  { role: "receptionist", label: "Reception",   icon: Users,       color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20",   email: "recept@demo.com"   },
  { role: "admin",        label: "Admin",       icon: Shield,      color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/20",  email: "admin@demo.com"    },
];

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [form, setForm]         = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res  = await authAPI.login(form);
      const data = res.data;
      setUser({ user_id: data.user_id, name: data.name, role: data.role, access_token: data.access_token });
      toast.success(`Welcome back, ${data.name}!`);
      const routes: Record<string, string> = { patient: "/patient", doctor: "/doctor", receptionist: "/reception", admin: "/admin" };
      router.push(routes[data.role] || "/patient");
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Invalid credentials");
    } finally { setLoading(false); }
  };

  const demoLogin = (role: string, email: string) => {
    setSelected(role);
    setForm({ email, password: "demo1234" });
  };

  return (
    <div className="min-h-screen flex" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(37,99,235,0.12) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(16,185,129,0.07) 0%, transparent 55%), linear-gradient(160deg, #030712, #0a0f1e)" }}>

      {/* ── Left Panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 border-r border-white/[0.06] p-10" style={{ background: "rgba(255,255,255,0.015)" }}>
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center glow-blue" style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)" }}>
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-base font-bold text-white">QueueCare <span className="text-gradient">AI</span></div>
            <div className="text-xs text-slate-500">Hospital Intelligence</div>
          </div>
        </Link>

        <div>
          <h2 className="text-3xl font-black text-white mb-3 leading-tight">Intelligent queue<br />management starts here.</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">XGBoost-powered wait time prediction with real-time WebSocket updates across all hospital departments.</p>
          <div className="space-y-3">
            {[
              { label: "94% AI Prediction Accuracy", color: "bg-blue-500"    },
              { label: "Real-time WebSocket Queues",  color: "bg-emerald-500" },
              { label: "Role-Based Dashboards",       color: "bg-violet-500"  },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3 text-sm text-slate-300">
                <div className={`w-2 h-2 rounded-full ${f.color} shrink-0`} />
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-600">© 2025 QueueCare AI. All rights reserved.</p>
      </div>

      {/* ── Right: Form ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center glow-blue" style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)" }}>
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">QueueCare <span className="text-gradient">AI</span></span>
          </div>

          <h1 className="text-3xl font-black text-white mb-1">Welcome back</h1>
          <p className="text-slate-400 text-sm mb-8">Sign in to your dashboard to continue</p>

          {/* Quick demo access */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Quick Demo Access</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ROLES.map((d) => (
                <button key={d.role} onClick={() => demoLogin(d.role, d.email)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left transition-all ${
                    selected === d.role
                      ? `${d.bg} ${d.border} ${d.color}`
                      : "border-white/10 text-slate-400 hover:border-white/15 hover:text-white"
                  }`}
                  style={{ background: selected === d.role ? undefined : "rgba(255,255,255,0.03)" }}>
                  <d.icon className={`w-4 h-4 shrink-0 ${selected === d.role ? d.color : ""}`} />
                  <span className="text-sm font-medium">{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/[0.07]" />
            <span className="text-xs text-slate-600">or sign in manually</span>
            <div className="flex-1 h-px bg-white/[0.07]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                <input type="email" required placeholder="you@hospital.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all border border-white/[0.08] focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                <input type={showPass ? "text" : "password"} required placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all border border-white/[0.08] focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-110 hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb,#3b82f6)", boxShadow: "0 4px 20px rgba(37,99,235,0.4)" }}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
