"use client";
import { useState } from "react";
import { BarChart2, Activity, Brain, Users, Shield, Save, Server, Sliders, Settings, HelpCircle } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import toast from "react-hot-toast";

const NAV = [
  { label: "Overview",       href: "/admin",         icon: BarChart2  },
  { label: "Queue Analytics",href: "/admin/queue",   icon: Activity   },
  { label: "AI Insights",    href: "/admin/ai",      icon: Brain      },
  { label: "Doctors",        href: "/admin/doctors", icon: Users      },
  { label: "Settings",       href: "/admin/settings",icon: Shield     },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    hospitalName: "QueueCare AI Memorial Hospital",
    avgCheckinWait: 5,
    maxQueueThreshold: 15,
    delayAlertThreshold: 30, // minutes
    enableEmergencyBypass: true,
    enableNotifications: true,
    aiModelPath: "ml-models/xgboost_wait_time.model",
    apiVersion: "v1.0.0",
    corsOrigins: "http://localhost:3000, http://localhost:8000"
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Settings saved successfully!");
    }, 800);
  };

  return (
    <DashboardLayout navItems={NAV} title="System Settings" subtitle="Configure hospital metadata, thresholds, notification controls, and AI triggers">
      <form onSubmit={handleSave} className="max-w-4xl mx-auto space-y-6">
        
        {/* Basic Config */}
        <div className="rounded-2xl border border-white/[0.07] p-6 text-left" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-white">General Configuration</h3>
              <p className="text-xs text-slate-500">Configure global metadata for this healthcare instance</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Hospital name</label>
              <input type="text" required value={config.hospitalName} onChange={e => setConfig({ ...config, hospitalName: e.target.value })}
                className="w-full py-3 px-4 rounded-xl text-sm text-white outline-none border border-white/[0.08] focus:border-blue-500/50" style={{ background: "rgba(255,255,255,0.04)" }} />
            </div>
          </div>
        </div>

        {/* Operational Thresholds */}
        <div className="rounded-2xl border border-white/[0.07] p-6 text-left" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <div className="flex items-center gap-3 mb-6">
            <Sliders className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Operational & Queue Thresholds</h3>
              <p className="text-xs text-slate-500">Tune alert limits and prediction correction parameters</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Limit queue */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-400 mb-2">
                  <span>Max Queue Length alert</span>
                  <span className="text-white font-bold">{config.maxQueueThreshold} patients</span>
                </div>
                <input type="range" min="5" max="50" value={config.maxQueueThreshold} onChange={e => setConfig({ ...config, maxQueueThreshold: parseInt(e.target.value) })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                <p className="text-[10px] text-slate-500 mt-1">Triggers dashboard warning when department queue reaches limit</p>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-400 mb-2">
                  <span>Wait Delay Warning Threshold</span>
                  <span className="text-white font-bold">{config.delayAlertThreshold} mins</span>
                </div>
                <input type="range" min="10" max="90" value={config.delayAlertThreshold} onChange={e => setConfig({ ...config, delayAlertThreshold: parseInt(e.target.value) })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                <p className="text-[10px] text-slate-500 mt-1">Warns reception staff when predicted wait exceeds this threshold</p>
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-col sm:flex-row gap-6 border-t border-white/[0.04] pt-5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={config.enableEmergencyBypass} onChange={e => setConfig({ ...config, enableEmergencyBypass: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-white/10 bg-white/5 rounded focus:ring-0 focus:ring-offset-0" />
                <div>
                  <span className="text-xs font-bold text-white block">Emergency Priority Bypass</span>
                  <span className="text-[10px] text-slate-500 block">Forces emergency status tokens to position 1 in queue</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={config.enableNotifications} onChange={e => setConfig({ ...config, enableNotifications: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-white/10 bg-white/5 rounded focus:ring-0 focus:ring-offset-0" />
                <div>
                  <span className="text-xs font-bold text-white block">Websocket Patient Alerts</span>
                  <span className="text-[10px] text-slate-500 block">Send real-time alerts to patients when wait positions shift</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* AI & Infrastructure settings */}
        <div className="rounded-2xl border border-white/[0.07] p-6 text-left" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <div className="flex items-center gap-3 mb-6">
            <Server className="w-5 h-5 text-violet-400" />
            <div>
              <h3 className="text-sm font-bold text-white">System & Engine Settings</h3>
              <p className="text-xs text-slate-500">Underlying ML paths and API CORS parameters</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">AI Model Binary File Path</label>
              <input type="text" readOnly value={config.aiModelPath}
                className="w-full py-3 px-4 rounded-xl text-slate-400 font-mono select-all outline-none border border-white/[0.04]" style={{ background: "rgba(255,255,255,0.015)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">API CORS Allowed Origins</label>
              <input type="text" readOnly value={config.corsOrigins}
                className="w-full py-3 px-4 rounded-xl text-slate-400 font-mono select-all outline-none border border-white/[0.04]" style={{ background: "rgba(255,255,255,0.015)" }} />
            </div>
          </div>
        </div>

        {/* Save bar */}
        <div className="flex justify-end gap-3">
          <button type="submit" disabled={loading} className="flex items-center gap-1.5 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-60">
            <Save className="w-4 h-4" /> {loading ? "Saving settings..." : "Save Config"}
          </button>
        </div>

      </form>
    </DashboardLayout>
  );
}
