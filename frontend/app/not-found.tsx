"use client";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth";
import { Activity, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const { user } = useAuthStore();

  const dashboardLink = user?.role
    ? user.role === "admin" ? "/admin"
    : user.role === "doctor" ? "/doctor"
    : user.role === "receptionist" ? "/reception"
    : "/patient"
    : "/login";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center p-6"
      style={{
        background:
          "radial-gradient(ellipse at 30% 20%, rgba(37,99,235,0.10) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(16,185,129,0.06) 0%, transparent 55%), linear-gradient(160deg, #030712, #0a0f1e)",
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-14">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center glow-blue"
          style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)" }}
        >
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div className="text-left">
          <div className="text-base font-bold text-white leading-none">
            QueueCare <span className="text-gradient">AI</span>
          </div>
          <div className="text-xs text-slate-500">Hospital Intelligence</div>
        </div>
      </Link>

      {/* Giant 404 */}
      <div className="relative mb-8">
        <div
          className="text-[160px] font-black leading-none select-none"
          style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(16,185,129,0.12))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.04em",
          }}
        >
          404
        </div>
        {/* Glowing orb behind */}
        <div
          className="absolute inset-0 -z-10 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, rgba(37,99,235,0.08) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      {/* Message */}
      <h1 className="text-2xl font-black text-white mb-2">Page Not Found</h1>
      <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-10">
        The page you&apos;re looking for doesn&apos;t exist or has been moved. Head back to your dashboard to continue.
      </p>

      {/* CTAs */}
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href={dashboardLink}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white hover:brightness-110 hover:-translate-y-0.5 transition-all"
          style={{
            background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
            boxShadow: "0 4px 20px rgba(37,99,235,0.4)",
          }}
        >
          <Home className="w-4 h-4" /> Back to Dashboard
        </Link>
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-slate-300 border border-white/10 hover:border-white/20 hover:text-white transition-all"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>

      <p className="text-xs text-slate-600 mt-16">© 2025 QueueCare AI. All rights reserved.</p>
    </div>
  );
}
