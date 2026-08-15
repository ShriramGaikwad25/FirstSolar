"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { runNhiRows, type NhiApiMode } from "@/lib/nhi-v2-query";
import "@/lib/ag-grid-setup";
import type { ColDef, ICellRendererParams } from "ag-grid-enterprise";

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement
);
const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), { ssr: false });
const Line = dynamic(() => import("react-chartjs-2").then((m) => m.Line), { ssr: false });
const AgGridReact = dynamic(() => import("ag-grid-react").then((mod) => mod.AgGridReact), {
  ssr: false,
});

const TENANT_ID = "a0000000-0000-0000-0000-000000000001";

type RunRow = {
  run_id: string;
  control_id: string;
  control_code: string;
  control_name: string;
  framework: string;
  severity: string;
  status: string;
  result_count: number | null;
  duration_ms: number | null;
  executed_at: string;
  error_message: string;
};

function asText(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return null;
}

function severityTone(sev: string): string {
  const s = sev.toLowerCase();
  if (s === "critical") return "bg-red-50 text-red-700 border-red-200";
  if (s === "high") return "bg-orange-50 text-orange-700 border-orange-200";
  if (s === "medium") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "low") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s === "pass") return "bg-green-50 text-green-700 border-green-200";
  if (s === "fail" || s === "error") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export function ControlRunsPage({ apiMode = "legacy" }: { apiMode?: NhiApiMode } = {}) {
  const [rows, setRows] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await runNhiRows(
        apiMode,
        `SELECT cr.run_id, cr.control_id, c.control_code, c.name AS control_name,
                c.framework, c.severity,
                cr.status, cr.result_count, cr.duration_ms,
                cr.executed_at, cr.error_message
           FROM public.kf_nhi_control_run cr
           JOIN public.kf_nhi_control c ON c.control_id = cr.control_id
          WHERE cr.tenant_id = ?::uuid
          ORDER BY cr.executed_at DESC
          LIMIT 500`,
        [TENANT_ID]
      );
      setRows(
        result.map((r) => ({
          run_id: asText(r.run_id),
          control_id: asText(r.control_id),
          control_code: asText(r.control_code),
          control_name: asText(r.control_name),
          framework: asText(r.framework),
          severity: asText(r.severity),
          status: asText(r.status),
          result_count: asNum(r.result_count),
          duration_ms: asNum(r.duration_ms),
          executed_at: asText(r.executed_at),
          error_message: asText(r.error_message),
        }))
      );
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load control runs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const trend = useMemo(() => {
    const by = new Map<string, { day: string; pass: number; fail: number }>();
    for (const r of rows) {
      if (!r.executed_at) continue;
      const d = new Date(r.executed_at);
      if (Number.isNaN(d.getTime())) continue;
      const day = d.toISOString().slice(0, 10);
      const cur = by.get(day) ?? { day, pass: 0, fail: 0 };
      if (r.status.toLowerCase() === "pass") cur.pass += 1;
      else if (["fail", "error"].includes(r.status.toLowerCase())) cur.fail += 1;
      by.set(day, cur);
    }
    return [...by.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [rows]);

  const topFailing = useMemo(() => {
    const by = new Map<string, number>();
    for (const r of rows) {
      const s = r.status.toLowerCase();
      if (s !== "fail" && s !== "error") continue;
      const key = r.control_code || "unknown";
      by.set(key, (by.get(key) ?? 0) + 1);
    }
    return [...by.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [rows]);

  const passCount = rows.filter((r) => r.status.toLowerCase() === "pass").length;
  const failCount = rows.filter((r) => ["fail", "error"].includes(r.status.toLowerCase())).length;
  const passPct = rows.length ? Math.round((passCount / rows.length) * 100) : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.control_code, r.control_name, r.framework, r.severity, r.status, r.error_message]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Control",
        field: "control_code",
        cellRenderer: (params: ICellRendererParams<RunRow>) => params.data?.control_code || "—",
      },
      {
        headerName: "Name",
        field: "control_name",
        cellRenderer: (params: ICellRendererParams<RunRow>) => params.data?.control_name || "—",
      },
      {
        headerName: "Framework",
        field: "framework",
        cellRenderer: (params: ICellRendererParams<RunRow>) => params.data?.framework || "—",
      },
      {
        headerName: "Severity",
        field: "severity",
        cellRenderer: (params: ICellRendererParams<RunRow>) => {
          const r = params.data;
          if (!r || !r.severity) return "—";
          return (
            <span className={`rounded-full border px-2 py-0.5 text-xs ${severityTone(r.severity)}`}>
              {r.severity}
            </span>
          );
        },
      },
      {
        headerName: "Status",
        field: "status",
        cellRenderer: (params: ICellRendererParams<RunRow>) => {
          const r = params.data;
          if (!r || !r.status) return "—";
          return (
            <span className={`rounded-full border px-2 py-0.5 text-xs ${statusTone(r.status)}`}>
              {r.status}
            </span>
          );
        },
      },
      {
        headerName: "Count",
        field: "result_count",
        cellRenderer: (params: ICellRendererParams<RunRow>) => {
          const r = params.data;
          return r?.result_count != null ? String(r.result_count) : "—";
        },
      },
      {
        headerName: "ms",
        field: "duration_ms",
        cellRenderer: (params: ICellRendererParams<RunRow>) => {
          const r = params.data;
          return r?.duration_ms != null ? String(r.duration_ms) : "—";
        },
      },
      {
        headerName: "Executed",
        field: "executed_at",
        cellRenderer: (params: ICellRendererParams<RunRow>) => {
          const r = params.data;
          return r?.executed_at ? new Date(r.executed_at).toLocaleString() : "—";
        },
      },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({ sortable: true, filter: false,
      flex: 1,
      minWidth: 100, resizable: true, wrapHeaderText: true, autoHeaderHeight: true,
      suppressHeaderMenuButton: true, }),
    []
  );

  return (
    <div className="w-full space-y-4 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Control Runs</h1>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          onClick={() => void load()}
          title="Refresh"
          aria-label="Refresh"
        >
          ↻
        </button>
      </div>

      {loading && <div className="text-sm text-slate-500">Loading control runs…</div>}
      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-3 xl:items-stretch">
        <div className="h-full rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="grid h-full gap-2 sm:grid-cols-2">
            <Kpi label="Total runs" value={String(rows.length)} compact />
            <Kpi label="Pass" value={String(passCount)} tone="ok" compact />
            <Kpi label="Fail" value={String(failCount)} tone={failCount > 0 ? "danger" : "ok"} compact />
            <Kpi
              label="Pass rate"
              value={`${passPct}%`}
              tone={passPct >= 90 ? "ok" : passPct >= 70 ? "warn" : "danger"}
              compact
            />
          </div>
        </div>

        <div className="xl:col-span-2">
          <ChartCard title="Pass / fail trend">
            <Line
              data={{
                labels: trend.map((x) => x.day),
                datasets: [
                  { label: "pass", data: trend.map((x) => x.pass), borderColor: "#10b981", borderWidth: 2, pointRadius: 0, tension: 0.25 },
                  { label: "fail", data: trend.map((x) => x.fail), borderColor: "#ef4444", borderWidth: 2, pointRadius: 0, tension: 0.25 },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: "top", labels: { boxWidth: 10, font: { size: 11 } } } },
                scales: {
                  y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } },
                  x: { ticks: { font: { size: 10 } }, grid: { color: "#f1f5f9" } },
                },
              }}
            />
          </ChartCard>
        </div>
      </section>

      <section className="flex items-stretch gap-4">
        <div className="w-1/3 min-w-0">
          <ChartCard title="Top failing controls">
          {topFailing.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">All controls passed 🎉</p>
          ) : (
            <Bar
              data={{
                labels: topFailing.map((x) => x.name),
                datasets: [{ label: "Fails", data: topFailing.map((x) => x.value), backgroundColor: "#ef4444", borderRadius: 4 }],
              }}
              options={{
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { beginAtZero: true, ticks: { precision: 0 } },
                  y: { ticks: { font: { size: 10 } }, grid: { display: false } },
                },
              }}
            />
          )}
          </ChartCard>
        </div>

        <section className="w-2/3 min-w-0 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Recent runs ({filtered.length})</h2>
            <div className="flex items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${rows.length} rows...`}
                className="w-56 rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">No control runs.</p>
          ) : (
            <div
            className="ag-theme-alpine nhi-compact-grid"
            style={{ ["--ag-font-size" ]: "12px", ["--ag-header-font-size" ]: "12px" } as any}
          >
              <AgGridReact
                rowData={filtered}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                pagination={true}
                paginationPageSize={25}
                paginationPageSizeSelector={[10, 25, 50, 100]}
                domLayout="autoHeight"
                rowHeight={36}
                headerHeight={32}
              />
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "default",
  compact = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn" | "danger";
  compact?: boolean;
}) {
  const cls =
    tone === "ok"
      ? "text-green-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-red-700"
          : "text-slate-900";
  return (
    <div className={`rounded-lg border border-gray-200 bg-white ${compact ? "px-3 py-2" : "px-4 py-3"} shadow-sm`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`${compact ? "mt-0.5 text-3xl" : "mt-1 text-2xl"} font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="h-[240px]">{children}</div>
    </div>
  );
}

