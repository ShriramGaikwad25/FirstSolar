"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { runNhiRows, type NhiApiMode } from "@/lib/nhi-v2-query";
import "@/lib/ag-grid-setup";
import type { ColDef, ICellRendererParams } from "ag-grid-enterprise";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), { ssr: false });
const Doughnut = dynamic(() => import("react-chartjs-2").then((m) => m.Doughnut), { ssr: false });
const AgGridReact = dynamic(() => import("ag-grid-react").then((mod) => mod.AgGridReact), { ssr: false });

const TENANT_ID = "a0000000-0000-0000-0000-000000000001";
const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];
const STATUS_OPTIONS = [
  "all",
  "draft",
  "submitted",
  "pending_approval",
  "approved",
  "rejected",
  "in_progress",
  "completed",
  "cancelled",
] as const;

type ChangeRow = {
  request_id: string;
  request_type: string;
  status: string;
  priority: string;
  risk_score: number | null;
  business_process: string;
  itsm_reference: string;
  nhi_id: string;
  nhi_name: string;
  requested_at: string;
  decided_at: string;
  completed_at: string;
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

function groupCount(rows: ChangeRow[], key: keyof ChangeRow): { name: string; value: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = asText(r[key]) || "(null)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function statusTone(st: string): string {
  const s = st.toLowerCase();
  if (["rejected", "cancelled"].includes(s)) return "bg-red-50 text-red-700 border-red-200";
  if (["submitted", "pending_approval", "in_progress"].includes(s)) return "bg-amber-50 text-amber-700 border-amber-200";
  if (["approved", "completed"].includes(s)) return "bg-green-50 text-green-700 border-green-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export function ChangesPage({ apiMode = "legacy" }: { apiMode?: NhiApiMode } = {}) {
  const [rows, setRows] = useState<ChangeRow[]>([]);
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const baseSql = `
        SELECT cr.request_id, cr.request_type, cr.status, cr.priority,
               cr.risk_score, cr.business_process, cr.itsm_reference,
               cr.nhi_id, i.name AS nhi_name,
               cr.requested_at, cr.decided_at, cr.completed_at
          FROM public.kf_nhi_change_request cr
     LEFT JOIN public.kf_nhi_identity i
            ON i.nhi_id = cr.nhi_id AND i.tenant_id = cr.tenant_id
         WHERE cr.tenant_id = ?::uuid`;
      const sql =
        status === "all"
          ? `${baseSql} ORDER BY cr.requested_at DESC LIMIT 500`
          : `${baseSql} AND cr.status = ? ORDER BY cr.requested_at DESC LIMIT 500`;
      const params = status === "all" ? [TENANT_ID] : [TENANT_ID, status];
      const result = await runNhiRows(apiMode, sql, params);
      setRows(
        result.map((r) => ({
          request_id: asText(r.request_id),
          request_type: asText(r.request_type),
          status: asText(r.status),
          priority: asText(r.priority),
          risk_score: asNum(r.risk_score),
          business_process: asText(r.business_process),
          itsm_reference: asText(r.itsm_reference),
          nhi_id: asText(r.nhi_id),
          nhi_name: asText(r.nhi_name),
          requested_at: asText(r.requested_at),
          decided_at: asText(r.decided_at),
          completed_at: asText(r.completed_at),
        }))
      );
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load change requests");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const byStatus = useMemo(() => groupCount(rows, "status"), [rows]);
  const byType = useMemo(() => groupCount(rows, "request_type"), [rows]);
  const openCount = useMemo(
    () =>
      rows.filter((r) =>
        ["submitted", "approved", "in_progress", "pending_approval"].includes(
          r.status.toLowerCase()
        )
      ).length,
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.request_type,
        r.status,
        r.priority,
        r.nhi_name,
        r.business_process,
        r.itsm_reference,
        r.request_id,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Type",
        field: "request_type",
        valueFormatter: (p) => p.value || "—",
      },
      {
        headerName: "Status",
        field: "status",
        cellRenderer: (params: ICellRendererParams<ChangeRow>) => {
          const r = params.data as ChangeRow;
          return (
            <span className={`rounded-full border px-2 py-0.5 text-xs ${statusTone(r.status)}`}>
              {r.status || "—"}
            </span>
          );
        },
      },
      {
        headerName: "Priority",
        field: "priority",
        valueFormatter: (p) => p.value || "—",
      },
      {
        headerName: "NHI",
        field: "nhi_name",
        valueFormatter: (p) => p.value || "—",
      },
      {
        headerName: "Process",
        field: "business_process",
        valueFormatter: (p) => p.value || "—",
      },
      {
        headerName: "Risk",
        field: "risk_score",
        cellRenderer: (params: ICellRendererParams<ChangeRow>) => {
          const r = params.data as ChangeRow;
          return r.risk_score != null ? String(r.risk_score) : "—";
        },
      },
      {
        headerName: "ITSM ref",
        field: "itsm_reference",
        valueFormatter: (p) => p.value || "—",
      },
      {
        headerName: "Requested",
        field: "requested_at",
        cellRenderer: (params: ICellRendererParams<ChangeRow>) => {
          const r = params.data as ChangeRow;
          return r.requested_at ? new Date(r.requested_at).toLocaleString() : "—";
        },
      },
      {
        headerName: "Decided",
        field: "decided_at",
        cellRenderer: (params: ICellRendererParams<ChangeRow>) => {
          const r = params.data as ChangeRow;
          return r.decided_at ? new Date(r.decided_at).toLocaleDateString() : "—";
        },
      },
      {
        headerName: "Completed",
        field: "completed_at",
        cellRenderer: (params: ICellRendererParams<ChangeRow>) => {
          const r = params.data as ChangeRow;
          return r.completed_at ? new Date(r.completed_at).toLocaleDateString() : "—";
        },
      },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({ sortable: true, filter: false,
      flex: 1,
      minWidth: 100, resizable: true, wrapHeaderText: true, autoHeaderHeight: true, }),
    []
  );

  return (
    <div className="w-full space-y-4 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Change Requests</h1>
        <div className="flex items-center gap-2">
          <select
            className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as (typeof STATUS_OPTIONS)[number])}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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
      </div>

      {loading && <div className="text-sm text-slate-500">Loading change requests…</div>}
      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-3 xl:items-stretch">
        <div className="h-full rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="grid h-full gap-2 sm:grid-cols-2">
            <Kpi label="Total" value={String(rows.length)} compact />
            <Kpi label="Open" value={String(openCount)} tone={openCount > 0 ? "warn" : "ok"} compact />
            <Kpi label="Types" value={String(byType.length)} compact />
            <Kpi label="Statuses" value={String(byStatus.length)} compact />
          </div>
        </div>

        <ChartCard title="By status">
          <Bar
            data={{
              labels: byStatus.map((x) => x.name),
              datasets: [{ label: "Count", data: byStatus.map((x) => x.value), backgroundColor: "#6366f1", borderRadius: 4 }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } },
                x: { ticks: { maxRotation: 20, minRotation: 20, font: { size: 10 } }, grid: { display: false } },
              },
            }}
          />
        </ChartCard>

        <ChartCard title="By request type">
          <Doughnut
            data={{
              labels: byType.map((x) => x.name),
              datasets: [{ data: byType.map((x) => x.value), backgroundColor: byType.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 0 }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: "55%",
              plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } },
            }}
          />
        </ChartCard>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Requests ({filtered.length})</h2>
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
          <div className="px-2 py-3 text-xs text-slate-500">No change requests.</div>
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
  tone?: "default" | "ok" | "warn";
  compact?: boolean;
}) {
  const cls = tone === "ok" ? "text-green-700" : tone === "warn" ? "text-amber-700" : "text-slate-900";
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
      <div className="h-[220px]">{children}</div>
    </div>
  );
}

