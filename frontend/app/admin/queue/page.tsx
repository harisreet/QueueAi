"use client";
import { useEffect, useState, useCallback } from "react";
import { BarChart2, Activity, Brain, Users, Shield, Clock, TrendingUp, Filter, Download, AlertTriangle, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { analyticsAPI } from "@/lib/api";
import { connectGlobal, WSEvent } from "@/lib/websocket";
import toast from "react-hot-toast";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const NAV = [
  { label: "Overview",       href: "/admin",         icon: BarChart2  },
  { label: "Queue Analytics",href: "/admin/queue",   icon: Activity   },
  { label: "AI Insights",    href: "/admin/ai",      icon: Brain      },
  { label: "Doctors",        href: "/admin/doctors", icon: Users      },
  { label: "Settings",       href: "/admin/settings",icon: Shield     },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl border border-white/10 text-xs" style={{ background: "rgba(3,7,18,0.95)", backdropFilter: "blur(16px)" }}>
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => <p key={i} className="text-white font-bold">{p.name}: {p.value}</p>)}
    </div>
  );
};

interface QueueEntry {
  id: string;
  token_no: string;
  patient_name: string;
  department: string;
  queue_position: number;
  predicted_wait: number;
  confidence_score: number;
  priority: string;
  status: string;
  is_emergency: boolean;
  checkin_time: string;
}

export default function QueueAnalyticsPage() {
  const [queues, setQueues] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  
  // Stats
  const [trends, setTrends] = useState<any[]>([]);
  const [deptLoads, setDeptLoads] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [queuesRes, trendRes, loadRes] = await Promise.allSettled([
        analyticsAPI.allQueues(),
        analyticsAPI.waitTimeTrend(),
        analyticsAPI.departmentLoad()
      ]);

      if (queuesRes.status === "fulfilled") setQueues(queuesRes.value.data);
      if (trendRes.status === "fulfilled") setTrends(trendRes.value.data);
      if (loadRes.status === "fulfilled") setDeptLoads(loadRes.value.data);
    } catch (e) {
      toast.error("Failed to load queue analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const ws = connectGlobal((e: WSEvent) => {
      if (["consultation_ended", "queue_update", "consultation_started"].includes(e.event)) {
        loadData();
      }
    });
    return () => ws.close();
  }, [loadData]);

  // Export queue to CSV
  const handleExport = () => {
    if (queues.length === 0) {
      toast.error("No data to export");
      return;
    }
    const headers = ["Token No", "Patient Name", "Department", "Priority", "Status", "Wait Time (min)", "Check-in Time"];
    const csvRows = [
      headers.join(","),
      ...queues.map(q => [
        q.token_no,
        `"${q.patient_name}"`,
        q.department,
        q.priority,
        q.status,
        q.predicted_wait,
        q.checkin_time
      ].join(","))
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", `queuecare_live_queues_${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
    toast.success("Queue data exported successfully!");
  };

  // Filter queues
  const filteredQueues = queues.filter(q => {
    const dMatch = deptFilter === "All" || q.department === deptFilter;
    const pMatch = priorityFilter === "All" || q.priority.toLowerCase() === priorityFilter.toLowerCase();
    const sMatch = statusFilter === "All" || q.status.toLowerCase() === statusFilter.toLowerCase();
    return dMatch && pMatch && sMatch;
  });

  const depts = ["All", ...Array.from(new Set(queues.map(q => q.department)))];

  // Fallback demo trends
  const trendData = trends.length > 0 ? trends : [
    { date: "Mon", avg_wait: 18, accuracy: 92 },
    { date: "Tue", avg_wait: 22, accuracy: 94 },
    { date: "Wed", avg_wait: 15, accuracy: 91 },
    { date: "Thu", avg_wait: 28, accuracy: 89 },
    { date: "Fri", avg_wait: 24, accuracy: 93 },
    { date: "Sat", avg_wait: 12, accuracy: 95 },
    { date: "Sun", avg_wait: 10, accuracy: 96 },
  ];

  const deptLoadData = deptLoads.length > 0 ? deptLoads : [
    { department: "Cardiology", load: 5 },
    { department: "Pediatrics", load: 8 },
    { department: "General Medicine", load: 12 },
    { department: "Orthopedics", load: 4 },
    { department: "Emergency", load: 9 }
  ];

  // Live Metrics
  const avgWait = queues.length ? Math.round(queues.reduce((acc, q) => acc + q.predicted_wait, 0) / queues.length) : 0;
  const emergencies = queues.filter(q => q.is_emergency).length;
  const delayed = queues.filter(q => q.status === "delayed").length;

  return (
    <DashboardLayout navItems={NAV} title="Queue Analytics" subtitle="Comprehensive patient flow monitoring and wait-time diagnostics">
      <div className="max-w-7xl mx-auto space-y-5">
        
        {/* Metric Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Queue", value: queues.length, sub: "Patients waiting/consulting", color: "text-blue-400", border: "border-blue-500/20" },
            { label: "Avg Est Wait Time", value: `${avgWait}m`, sub: "Across all departments", color: "text-amber-400", border: "border-amber-500/20" },
            { label: "Active Emergencies", value: emergencies, sub: "Bypassed priority queue", color: "text-red-400", border: "border-red-500/20" },
            { label: "Delayed Consultations", value: delayed, sub: "Exceeded prediction threshold", color: "text-violet-400", border: "border-violet-500/20" }
          ].map(k => (
            <div key={k.label} className={`rounded-2xl border ${k.border} p-5`} style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
              <div className={`text-3xl font-black ${k.color} mb-1`}>{k.value}</div>
              <div className="text-xs text-white font-bold mb-1">{k.label}</div>
              <div className="text-[10px] text-slate-500">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* Wait Time Trend */}
          <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
            <h3 className="text-sm font-bold text-white mb-5">Wait Time Trend (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', color: '#fff' }} />
                <Line yAxisId="left" type="monotone" dataKey="avg_wait" name="Avg Wait (min)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="monotone" dataKey="accuracy" name="AI Accuracy (%)" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Department Load */}
          <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
            <h3 className="text-sm font-bold text-white mb-5">Department Load Comparison</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptLoadData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="department" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="load" name="Patients In Queue" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Queue Table Block */}
        <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(16px)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-sm font-bold text-white">Live Patient Queue</h3>
              <p className="text-xs text-slate-500">Real-time status of all active tokens</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Department filter */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10" style={{ background: "rgba(255,255,255,0.03)" }}>
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="bg-transparent text-xs text-slate-300 outline-none cursor-pointer">
                  {depts.map(d => <option key={d} value={d} className="bg-[#0b0f19] text-white">{d}</option>)}
                </select>
              </div>

              {/* Priority filter */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10" style={{ background: "rgba(255,255,255,0.03)" }}>
                <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="bg-transparent text-xs text-slate-300 outline-none cursor-pointer">
                  <option value="All" className="bg-[#0b0f19] text-white">All Priorities</option>
                  <option value="Low" className="bg-[#0b0f19] text-white">Low</option>
                  <option value="Medium" className="bg-[#0b0f19] text-white">Medium</option>
                  <option value="High" className="bg-[#0b0f19] text-white">High</option>
                </select>
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10" style={{ background: "rgba(255,255,255,0.03)" }}>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-transparent text-xs text-slate-300 outline-none cursor-pointer">
                  <option value="All" className="bg-[#0b0f19] text-white">All Statuses</option>
                  <option value="Waiting" className="bg-[#0b0f19] text-white">Waiting</option>
                  <option value="In_Consultation" className="bg-[#0b0f19] text-white">In Consultation</option>
                  <option value="Delayed" className="bg-[#0b0f19] text-white">Delayed</option>
                </select>
              </div>

              <button onClick={handleExport} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>

              <button onClick={loadData} className="p-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all hover:bg-white/5">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.05] text-slate-400">
                  <th className="py-3 px-4 font-semibold">Token</th>
                  <th className="py-3 px-4 font-semibold">Patient Name</th>
                  <th className="py-3 px-4 font-semibold">Department</th>
                  <th className="py-3 px-4 font-semibold">Queue Pos</th>
                  <th className="py-3 px-4 font-semibold">Priority</th>
                  <th className="py-3 px-4 font-semibold">Est Wait</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Check-in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredQueues.length > 0 ? (
                  filteredQueues.map(q => {
                    let priorityColor = "bg-slate-500/10 text-slate-400 border-slate-500/20";
                    if (q.priority === "high" || q.is_emergency) priorityColor = "bg-red-500/10 text-red-400 border-red-500/20";
                    else if (q.priority === "medium") priorityColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                    else if (q.priority === "low") priorityColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";

                    let statusColor = "bg-slate-500/10 text-slate-400";
                    if (q.status === "in_consultation") statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                    else if (q.status === "waiting") statusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                    else if (q.status === "delayed") statusColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";

                    return (
                      <tr key={q.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-1.5">
                          {q.is_emergency && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                          {q.token_no}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-200">{q.patient_name}</td>
                        <td className="py-3.5 px-4 text-slate-400">{q.department}</td>
                        <td className="py-3.5 px-4 text-slate-300 font-bold">{q.queue_position}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold capitalize ${priorityColor}`}>
                            {q.is_emergency ? "emergency" : q.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-200 font-bold">{q.predicted_wait}m</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold capitalize ${statusColor}`}>
                            {q.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {new Date(q.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      {loading ? "Loading live queues..." : "No active patients matching filters"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
