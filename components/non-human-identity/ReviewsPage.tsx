"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
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

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);
const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), { ssr: false });
const AgGridReact = dynamic(() => import("ag-grid-react").then((mod) => mod.AgGridReact), {
  ssr: false,
});

const TENANT_ID = "a0000000-0000-0000-0000-000000000001";
const STATUS_OPTIONS = [
  "all",
  "not_due",
  "due",
  "in_review",
  "overdue",
  "certified",
  "revoked",
  "risk_accepted",
] as const;

type ReviewRow = {
  review_id: string;
  review_type: string;
  status: string;
  decision: string;
  nhi_id: string;
  nhi_name: string;
  opened_at: string;
  due_at: string;
  closed_at: string;
  escalated_at: string;
  sla_breached: boolean;
};

function asText(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return Boolean(v);
}

function statusColor(s: string): string {
  const key = s.toLowerCase();
  return (
    {
      certified: "#10b981",
      revoked: "#ef4444",
      risk_accepted: "#f59e0b",
      in_review: "#6366f1",
      due: "#06b6d4",
      overdue: "#f97316",
      not_due: "#64748b",
    }[key] ?? "#6b7280"
  );
}

function statusTone(s: string): string {
  const key = s.toLowerCase();
  if (key === "revoked" || key === "overdue") return "bg-red-50 text-red-700 border-red-200";
  if (key === "due" || key === "in_review") return "bg-amber-50 text-amber-700 border-amber-200";
  if (key === "certified" || key === "risk_accepted") return "bg-green-50 text-green-700 border-green-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function groupCount(rows: ReviewRow[], key: keyof ReviewRow): { name: string; value: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = asText(r[key]) || "(null)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function ReviewsPage({ apiMode = "legacy" }: { apiMode?: NhiApiMode } = {}) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const baseSql = `
        SELECT rc.review_id, rc.review_type, rc.status, rc.decision,
               rc.nhi_id, i.name AS nhi_name,
               rc.opened_at, rc.due_at, rc.closed_at,
               rc.escalated_at,
               CASE WHEN rc.status IN ('due','in_review','overdue') AND rc.due_at < now()
                    THEN true ELSE false END AS sla_breached
          FROM public.kf_nhi_review_cycle rc
     LEFT JOIN public.kf_nhi_identity i
            ON i.nhi_id = rc.nhi_id AND i.tenant_id = rc.tenant_id
         WHERE rc.tenant_id = ?::uuid`;
      const sql =
        status === "all"
          ? `${baseSql} ORDER BY rc.due_at NULLS LAST, rc.opened_at DESC LIMIT 500`
          : `${baseSql} AND rc.status = ? ORDER BY rc.due_at NULLS LAST, rc.opened_at DESC LIMIT 500`;
      const params = status === "all" ? [TENANT_ID] : [TENANT_ID, status];
      const result = await runNhiRows(apiMode, sql, params);
      setRows(
        result.map((r) => ({
          review_id: asText(r.review_id),
          review_type: asText(r.review_type),
          status: asText(r.status),
          decision: asText(r.decision),
          nhi_id: asText(r.nhi_id),
          nhi_name: asText(r.nhi_name),
          opened_at: asText(r.opened_at),
          due_at: asText(r.due_at),
          closed_at: asText(r.closed_at),
          escalated_at: asText(r.escalated_at),
          sla_breached: asBool(r.sla_breached),
        }))
      );
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load review cycles");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const byStatus = useMemo(() => groupCount(rows, "status"), [rows]);
  const byType = useMemo(() => groupCount(rows, "review_type"), [rows]);
  const dueSoon = useMemo(
    () =>
      rows.filter((r) => {
        const st = r.status.toLowerCase();
        return ["due", "in_review"].includes(st) && r.due_at && new Date(r.due_at) > new Date();
      }).length,
    [rows]
  );
  const breached = useMemo(() => rows.filter((r) => r.sla_breached).length, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.review_type, r.status, r.decision, r.nhi_name, r.review_id]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      { headerName: "Type", field: "review_type", valueFormatter: (p) => p.value || "—" },
      {
        headerName: "Status",
        field: "status",
        cellRenderer: (params: ICellRendererParams<ReviewRow>) => {
          const r = params.data;
          const s = r?.status ?? "";
          return (
            <span className={`rounded-full border px-2 py-0.5 text-xs ${statusTone(s)}`}>
              {s || "—"}
            </span>
          );
        },
      },
      { headerName: "Decision", field: "decision", valueFormatter: (p) => p.value || "—" },
      { headerName: "NHI", field: "nhi_name", valueFormatter: (p) => p.value || "—" },
      {
        headerName: "Opened",
        field: "opened_at",
        cellRenderer: (params: ICellRendererParams<ReviewRow>) => {
          const v = params.data?.opened_at;
          return <span>{v ? new Date(v).toLocaleDateString() : "—"}</span>;
        },
      },
      {
        headerName: "Due",
        field: "due_at",
        cellRenderer: (params: ICellRendererParams<ReviewRow>) => {
          const v = params.data?.due_at;
          return <span>{v ? new Date(v).toLocaleDateString() : "—"}</span>;
        },
      },
      {
        headerName: "Closed",
        field: "closed_at",
        cellRenderer: (params: ICellRendererParams<ReviewRow>) => {
          const v = params.data?.closed_at;
          return <span>{v ? new Date(v).toLocaleDateString() : "—"}</span>;
        },
      },
      {
        headerName: "SLA",
        field: "sla_breached",
        cellRenderer: (params: ICellRendererParams<ReviewRow>) => {
          const breached = params.data?.sla_breached;
          return breached ? (
            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
              breached
            </span>
          ) : (
            <span>ok</span>
          );
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
        <h1 className="text-2xl font-semibold text-slate-900">Reviews</h1>
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

      {loading && <div className="text-sm text-slate-500">Loading review cycles…</div>}
      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-3 xl:items-stretch">
        <div className="h-full rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="grid h-full gap-2 sm:grid-cols-2">
            <Kpi label="Total" value={String(rows.length)} compact />
            <Kpi label="Due soon" value={String(dueSoon)} tone={dueSoon > 0 ? "warn" : "ok"} compact />
            <Kpi label="SLA breached" value={String(breached)} tone={breached > 0 ? "danger" : "ok"} compact />
            <Kpi label="Review types" value={String(byType.length)} compact />
          </div>
        </div>

        <ChartCard title="By status">
          <Bar
            data={{
              labels: byStatus.map((x) => x.name),
              datasets: [
                {
                  label: "Count",
                  data: byStatus.map((x) => x.value),
                  backgroundColor: byStatus.map((x) => statusColor(x.name)),
                  borderRadius: 4,
                },
              ],
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

        <ChartCard title="By type">
          <Bar
            data={{
              labels: byType.map((x) => x.name),
              datasets: [{ label: "Count", data: byType.map((x) => x.value), backgroundColor: "#6366f1", borderRadius: 4 }],
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
        </ChartCard>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Review cycles ({filtered.length})</h2>
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
          <div className="px-2 py-3 text-sm text-slate-500">No review cycles.</div>
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
      <div className="h-[220px]">{children}</div>
    </div>
  );
}

