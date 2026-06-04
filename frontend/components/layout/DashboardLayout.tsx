"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LogOut, Bell, ChevronRight, Menu, X, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { LucideIcon } from "lucide-react";
import { connectGlobal, WSEvent } from "@/lib/websocket";

interface NavItem { label: string; href: string; icon: LucideIcon; }
interface Props {
  children: React.ReactNode;
  navItems: NavItem[];
  title: string;
  subtitle: string;
  accentColor?: string;
}

interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  time: Date;
}

const ROLE_STYLES: Record<string, { dot: string; text: string; badge: string }> = {
  patient:      { dot: "bg-blue-500",    text: "text-blue-400",    badge: "bg-blue-500/10 border-blue-500/20 text-blue-400"    },
  doctor:       { dot: "bg-emerald-500", text: "text-emerald-400", badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
  receptionist: { dot: "bg-amber-500",   text: "text-amber-400",   badge: "bg-amber-500/10 border-amber-500/20 text-amber-400"  },
  admin:        { dot: "bg-violet-500",  text: "text-violet-400",  badge: "bg-violet-500/10 border-violet-500/20 text-violet-400" },
};

function NotifIcon({ type }: { type: Notification["type"] }) {
  if (type === "success") return <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  if (type === "warning") return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  if (type === "error")   return <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
  return <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
}

export default function DashboardLayout({ children, navItems, title, subtitle }: Props) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const role    = user?.role || "patient";
  const styles  = ROLE_STYLES[role] || ROLE_STYLES.patient;
  const initials = user?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "U";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notification panel on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Connect to WebSocket for live notifications
  useEffect(() => {
    const ws = connectGlobal((e: WSEvent) => {
      let msg = "";
      let type: Notification["type"] = "info";

      switch (e.event) {
        case "consultation_started":
          msg = `Consultation started — ${e.data?.token_no || ""}`;
          type = "info";
          break;
        case "consultation_ended":
          msg = `Consultation completed in ${e.data?.department || ""}`;
          type = "success";
          break;
        case "queue_update":
          msg = `Queue updated — ${e.data?.department || ""}`;
          type = "info";
          break;
        case "doctor_status_changed":
          msg = `Doctor status changed → ${e.data?.status || ""}`;
          type = "warning";
          break;
        default:
          msg = `System event: ${e.event}`;
      }

      setNotifications(prev => [
        {
          id: crypto.randomUUID(),
          type,
          message: msg,
          time: new Date(),
        },
        ...prev.slice(0, 19), // Keep max 20
      ]);
    });
    return () => ws.close();
  }, []);

  const unread = notifications.length;

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/[0.06] shrink-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 glow-blue"
          style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)" }}>
          <Activity className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white leading-none">QueueCare <span className="text-gradient">AI</span></div>
          <div className={`text-xs font-semibold capitalize mt-0.5 ${styles.text}`}>{role}</div>
        </div>
        {/* Mobile close button */}
        <button className="ml-auto lg:hidden text-slate-500 hover:text-white" onClick={() => setSidebarOpen(false)}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "text-white border border-white/[0.08]"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
              style={active ? { background: "rgba(37,99,235,0.15)", borderColor: "rgba(59,130,246,0.2)" } : {}}>
              <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-blue-400" : ""}`} />
              <span className="truncate">{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto text-blue-400 shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div className="p-3 border-t border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
          style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)" }}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate leading-none">{user?.name}</div>
            <span className={`inline-block text-[10px] font-bold capitalize px-1.5 py-0.5 rounded-md border mt-1 ${styles.badge}`}>
              {role}
            </span>
          </div>
        </div>
        <button onClick={logout}
          className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ background: "linear-gradient(160deg,#030712 0%,#080d1e 50%,#030b1a 100%)" }}>

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex w-[220px] shrink-0 flex-col border-r border-white/[0.06]"
        style={{ background: "rgba(3,7,18,0.7)", backdropFilter: "blur(24px)" }}>
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          {/* Drawer */}
          <aside className="relative w-[220px] shrink-0 flex flex-col border-r border-white/[0.06] z-10 animate-slide-up"
            style={{ background: "rgba(3,7,18,0.96)", backdropFilter: "blur(24px)" }}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header className="h-16 shrink-0 flex items-center justify-between px-4 md:px-6 border-b border-white/[0.06]"
          style={{ background: "rgba(3,7,18,0.5)", backdropFilter: "blur(20px)" }}>

          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button className="lg:hidden p-2 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white transition-all"
              style={{ background: "rgba(255,255,255,0.03)" }}
              onClick={() => setSidebarOpen(true)}>
              <Menu className="w-4 h-4" />
            </button>

            <div>
              <h1 className="text-base md:text-lg font-bold text-white leading-none">{title}</h1>
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <div className="live-dot" /> Live
            </div>

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="relative w-9 h-9 rounded-xl border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:border-white/15 transition-all"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>

              {/* Notification Panel */}
              {notifOpen && (
                <div
                  className="absolute right-0 top-12 w-80 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  style={{ background: "rgba(6,9,20,0.98)", backdropFilter: "blur(24px)" }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                    <span className="text-xs font-bold text-white">Live Notifications</span>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => setNotifications([])}
                        className="text-[10px] text-slate-500 hover:text-white transition-colors">
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div key={n.id} className="flex items-start gap-3 px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                          <NotifIcon type={n.type} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-200 leading-snug">{n.message}</p>
                            <p className="text-[10px] text-slate-600 mt-0.5">
                              {n.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-slate-500 text-xs">
                        No live events yet. WebSocket is connected.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
