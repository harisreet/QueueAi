"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, User, Mail, Lock, Eye, EyeOff, Phone, ArrowRight, Loader2, Stethoscope, Users, Shield, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";

const ROLES = [
  { value: "patient",      label: "Patient",   icon: User,        desc: "Book appointments & track queue" },
  { value: "doctor",       label: "Doctor",    icon: Stethoscope, desc: "Manage consultations & patient queue" },
  { value: "receptionist", label: "Reception", icon: Users,       desc: "Monitor & manage queue operations" },
  { value: "admin",        label: "Admin",     icon: Shield,      desc: "Full analytics & system control" },
];
const DEPTS = ["Cardiology","Orthopedics","Neurology","Pediatrics","General Medicine","Emergency","Dermatology","ENT","Gynecology","Ophthalmology","Psychiatry","Radiology"];

export default function SignupPage() {
  const router    = useRouter();
  const { setUser } = useAuthStore();
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "patient", department: "General Medicine", age: "", gender: "other", specialization: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) { setStep(2); return; }
    setLoading(true);
    try {
      const res  = await authAPI.signup({ ...form, age: form.age ? parseInt(form.age) : undefined, specialization: form.specialization || undefined });
      const data = res.data;
      setUser({ user_id: data.user_id, name: data.name, role: data.role, access_token: data.access_token });
      toast.success(`Welcome, ${data.name}!`);
      const routes: Record<string, string> = { patient: "/patient", doctor: "/doctor", receptionist: "/reception", admin: "/admin" };
      router.push(routes[data.role] || "/patient");
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Signup failed");
    } finally { setLoading(false); }
  };

  const inputCls = "w-full py-3 px-4 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none border border-white/[0.08] focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all";
  const inputBg  = { background: "rgba(255,255,255,0.04)" };

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "radial-gradient(ellipse at 30% 0%,rgba(37,99,235,0.12) 0%,transparent 60%),linear-gradient(160deg,#030712,#0a0f1e)" }}>
      <div className="w-full max-w-4xl animate-slide-up">

        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center glow-blue" style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)" }}>
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">QueueCare <span className="text-gradient">AI</span></span>
          </Link>
          <h1 className="text-3xl font-black text-white mb-2">Create your account</h1>
          <p className="text-slate-400 text-sm">Join thousands of healthcare professionals</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-4 mb-10">
          {[{ n: 1, label: "Account Info" }, { n: 2, label: "Role & Details" }].map(({ n, label }, i) => (
            <div key={n} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= n ? "text-white glow-blue" : "text-slate-500 border border-white/10"}`}
                style={step >= n ? { background: "linear-gradient(135deg,#1d4ed8,#3b82f6)" } : { background: "rgba(255,255,255,0.04)" }}>
                {n}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${step >= n ? "text-white" : "text-slate-500"}`}>{label}</span>
              {i === 0 && <div className={`w-16 h-px mx-1 ${step > 1 ? "bg-blue-500" : "bg-white/10"}`} />}
            </div>
          ))}
        </div>

        <div className="border border-white/[0.07] rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(20px)" }}>
          <form onSubmit={handleSubmit}>

            {step === 1 && (
              <div className="p-8 md:p-10">
                <h2 className="text-xl font-bold text-white mb-7">Basic Information</h2>
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                      <input required placeholder="Dr. John Smith" value={form.name}
                        onChange={e => set("name", e.target.value)} className={`${inputCls} pl-10`} style={inputBg} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                      <input type="email" required placeholder="you@hospital.com" value={form.email}
                        onChange={e => set("email", e.target.value)} className={`${inputCls} pl-10`} style={inputBg} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                      <input type="tel" placeholder="+1 (555) 000-0000" value={form.phone}
                        onChange={e => set("phone", e.target.value)} className={`${inputCls} pl-10`} style={inputBg} />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                      <input type={showPass ? "text" : "password"} required minLength={8} placeholder="Min. 8 characters" value={form.password}
                        onChange={e => set("password", e.target.value)} className={`${inputCls} pl-10 pr-10`} style={inputBg} />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {form.password && (
                      <div className="flex items-center gap-2 mt-2">
                        {[8,12,16].map(len => <div key={len} className={`h-1 flex-1 rounded-full transition-all ${form.password.length >= len ? "bg-blue-500" : "bg-white/10"}`} />)}
                        <span className="text-xs text-slate-500">{form.password.length >= 12 ? "Strong" : form.password.length >= 8 ? "Fair" : "Weak"}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button type="submit" className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white mt-8 hover:brightness-110 hover:-translate-y-0.5 transition-all"
                  style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)", boxShadow: "0 4px 20px rgba(37,99,235,0.4)" }}>
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="p-8 md:p-10">
                <h2 className="text-xl font-bold text-white mb-7">Select Your Role</h2>
                <div className="grid md:grid-cols-2 gap-3 mb-8">
                  {ROLES.map(r => (
                    <button key={r.value} type="button" onClick={() => set("role", r.value)}
                      className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${form.role === r.value ? "border-blue-500/40" : "border-white/[0.07] hover:border-white/15"}`}
                      style={{ background: form.role === r.value ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.03)" }}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${form.role === r.value ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-slate-500"}`}>
                        <r.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className={`text-sm font-bold ${form.role === r.value ? "text-white" : "text-slate-300"}`}>{r.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{r.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="grid md:grid-cols-3 gap-5 mb-8">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Age</label>
                    <input type="number" placeholder="30" min="1" max="120" value={form.age}
                      onChange={e => set("age", e.target.value)} className={inputCls} style={inputBg} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Gender</label>
                    <div className="relative">
                      <select value={form.gender} onChange={e => set("gender", e.target.value)}
                        className={`${inputCls} appearance-none cursor-pointer pr-8`} style={inputBg}>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Department</label>
                    <div className="relative">
                      <select value={form.department} onChange={e => set("department", e.target.value)}
                        className={`${inputCls} appearance-none cursor-pointer pr-8`} style={inputBg}>
                        {DEPTS.map(d => <option key={d}>{d}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {form.role === "doctor" && (
                  <div className="mb-8">
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Specialization <span className="text-slate-600 font-normal">(optional)</span></label>
                    <input type="text" placeholder="e.g. Cardiologist, Pediatrician, Neurologist" value={form.specialization}
                      onChange={e => set("specialization", e.target.value)} className={inputCls} style={inputBg} />
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)}
                    className="px-6 py-3.5 rounded-xl text-sm font-semibold text-slate-300 border border-white/10 hover:border-white/20 hover:text-white transition-all"
                    style={{ background: "rgba(255,255,255,0.04)" }}>Back</button>
                  <button type="submit" disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-110 hover:-translate-y-0.5 transition-all"
                    style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)", boxShadow: "0 4px 20px rgba(37,99,235,0.4)" }}>
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
