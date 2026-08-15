"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PieController,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { getDashboard, listRulesets } from "@/lib/api/rm";
import type { RmDashboardData } from "@/types/rm-dashboard";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PieController, Tooltip, Legend);

function Kpi({
  label,
  value,
  danger,
  warn,
}: {
  label: string;
  value: number;
  danger?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 bg-white shadow-sm ${
        danger ? "border-red-200 bg-red-50/50" : warn ? "border-amber-200 bg-amber-50/50" : "border-gray-200"
      }`}
    >
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{value ?? 0}</div>
    </div>
  );
}

function RunStatusBadge({ label, color }: { label: string; color?: string | null }) {
  const text = (label || "").trim() || "—";
  if (color && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color)) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
        style={{
          color,
          backgroundColor: `${color}18`,
          border: `1px solid ${color}55`,
        }}
      >
        {text}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-800 px-2 py-0.5 text-xs font-medium">
      {text}
    </span>
  );
}

function SeverityBarChart({ data }: { data: RmDashboardData["by_severity"] }) {
  const chartData = useMemo(
    () => ({
      labels: data.map((s) => s.severity_name),
      datasets: [
        {
          label: "Open",
          data: data.map((s) => s.open_count),
          backgroundColor: data.map((s) => s.color_hex ?? "#2563eb"),
          borderRadius: 4,
        },
      ],
    }),
    [data]
  );
  const options: ChartOptions<"bar"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    }),
    []
  );
  return (
    <div className="h-[260px] w-full">
      <Bar data={chartData} options={options} />
    </div>
  );
}

function StatusPieChart({ data }: { data: RmDashboardData["by_status"] }) {
  const filtered = useMemo(
    () => data.filter((x) => Number(x.cnt) > 0),
    [data]
  );
  const chartData = useMemo(
    () => ({
      labels: filtered.map((s) => s.status_name),
      datasets: [
        {
          data: filtered.map((s) => Number(s.cnt)),
          backgroundColor: filtered.map((s) => s.color_hex ?? "#64748b"),
          borderWidth: 0,
        },
      ],
    }),
    [filtered]
  );
  const options: ChartOptions<"pie"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { enabled: true },
      },
    }),
    []
  );
  return (
    <div className="h-[260px] w-full">
      <Pie data={chartData} options={options} />
    </div>
  );
}

function SystemBarChart({ data }: { data: RmDashboardData["by_system"] }) {
  const chartData = useMemo(
    () => ({
      labels: data.map((s) => s.system_name),
      datasets: [
        {
          label: "Count",
          data: data.map((s) => s.cnt),
          backgroundColor: data.map((s) => s.color_hex ?? "#2563eb"),
          borderRadius: 4,
        },
      ],
    }),
    [data]
  );
  const options: ChartOptions<"bar"> = useMemo(
    () => ({
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: {
          ticks: { maxRotation: 0, autoSkip: false, font: { size: 11 } },
        },
      },
    }),
    []
  );
  return (
    <div className="h-[220px] w-full">
      <Bar data={chartData} options={options} />
    </div>
  );
}

export default function RiskAnalysisDashboardClient() {
  const [rulesetId, setRulesetId] = useState<number | undefined>(undefined);

  const rulesets = useQuery({
    queryKey: ["rulesets-active"],
    queryFn: async () => (await listRulesets("ACTIVE", 1, 50)).data ?? [],
  });

  /** API lists all; prefer ACTIVE in the filter when `status` is present. */
  const rulesetOptions = useMemo(
    () =>
      (rulesets.data ?? []).filter(
        (r) => r.status == null || r.status === "" || r.status === "ACTIVE"
      ),
    [rulesets.data]
  );

  const dash = useQuery({
    queryKey: ["dashboard", rulesetId],
    queryFn: async () => (await getDashboard(rulesetId)).data,
    refetchInterval: 60_000,
  });

  const d = dash.data;

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Risk Dashboard</h1>
        <label className="flex flex-col gap-1 min-w-0 sm:w-72">
          <span className="text-xs font-medium text-gray-500">Ruleset</span>
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            value={rulesetId ?? ""}
            onChange={(e) => setRulesetId(e.target.value ? Number(e.target.value) : undefined)}
            disabled={rulesets.isLoading}
          >
            <option value="">All rulesets</option>
            {rulesetOptions.map((r) => (
              <option key={r.ruleset_id} value={r.ruleset_id}>
                {r.ruleset_name ?? r.ruleset_code}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rulesets.isError && (
        <p className="text-sm text-red-600 mb-2">
          {rulesets.error instanceof Error ? rulesets.error.message : String(rulesets.error)}
        </p>
      )}

      {dash.isLoading && <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">Loading dashboard…</div>}
      {dash.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {String(dash.error instanceof Error ? dash.error.message : dash.error)}
        </div>
      )}

      {d && !dash.isLoading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi label="Open Violations" value={d.kpis.open_violations} danger />
            <Kpi label="High Severity Open" value={d.kpis.high_severity_open} danger />
            <Kpi label="Mitigated" value={d.kpis.mitigated} warn />
            <Kpi label="Users at Risk" value={d.kpis.unique_users} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Open Violations by Severity</h2>
              <SeverityBarChart data={d.by_severity} />
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Violation Status Breakdown</h2>
              <StatusPieChart data={d.by_status} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Open Violations by ERP</h2>
              <SystemBarChart data={d.by_system} />
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Top Risky Users</h2>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-sm text-left">
                  <colgroup>
                    <col className="w-[50%]" />
                    <col className="w-[25%]" />
                    <col className="w-[25%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-600">
                      <th className="py-2 px-3 font-medium">User</th>
                      <th className="py-2 px-3 font-medium text-center">Violations</th>
                      <th className="py-2 px-3 font-medium text-center">Risk Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.top_risky_users.map((u) => (
                      <tr key={u.userid} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 px-3 text-gray-900 truncate">{u.displayname || u.username}</td>
                        <td className="py-2 px-3 text-center tabular-nums text-gray-800">{u.violation_count}</td>
                        <td className="py-2 px-3 text-center font-semibold text-red-600 tabular-nums">{u.risk_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm mt-4">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Recent Analysis Runs</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] table-fixed border-collapse text-sm text-left">
                <colgroup>
                  <col className="w-[8%]" />
                  <col className="w-[18%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                  <col className="w-[36%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="py-2 px-3 font-medium">Run</th>
                    <th className="py-2 px-3 font-medium">Ruleset</th>
                    <th className="py-2 px-3 font-medium">Type</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium text-center">Violations</th>
                    <th className="py-2 px-3 font-medium">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent_runs.map((r) => (
                    <tr key={r.run_id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 px-3 text-gray-900 tabular-nums">#{r.run_id}</td>
                      <td className="py-2 px-3 text-gray-800 truncate">{r.ruleset_code}</td>
                      <td className="py-2 px-3 text-gray-800 truncate">{r.run_type}</td>
                      <td className="py-2 px-3">
                        <RunStatusBadge
                          label={r.run_status_name || r.run_status || "—"}
                          color={r.run_status_color}
                        />
                      </td>
                      <td className="py-2 px-3 text-center tabular-nums">{r.total_violations}</td>
                      <td className="py-2 px-3 text-gray-500 text-xs whitespace-nowrap">
                        {r.started_at ? new Date(r.started_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
