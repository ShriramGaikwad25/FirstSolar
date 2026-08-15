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

type SodRow = {
  violation_id: string;
  rule_code: string;
  rule_name: string;
  severity: string;
  subject_type: string;
  subject_id: string;
  detected_at: string;
  is_resolved: boolean;
  resolution: string;
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

function sevColour(s: string): string {
  const key = s.toLowerCase();
  return (
    {
      critical: "#ef4444",
      high: "#f97316",
      medium: "#f59e0b",
      low: "#3b82f6",
    }[key] ?? "#6366f1"
  );
}

function groupCount<T extends Record<string, unknown>>(rows: T[], key: keyof T): { name: string; value: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = asText(r[key]) || "(null)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function severityTone(sev: string): string {
  const s = sev.toLowerCase();
  if (s === "critical") return "bg-red-50 text-red-700 border-red-200";
  if (s === "high") return "bg-orange-50 text-orange-700 border-orange-200";
  if (s === "medium") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "low") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export function SodViolationsPage({
  suppressPageHeader,
  refreshNonce = 0,
  apiMode = "legacy",
}: { suppressPageHeader?: boolean; refreshNonce?: number; apiMode?: NhiApiMode } = {}) {
  const [rows, setRows] = useState<SodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await runNhiRows(
        apiMode,
        `SELECT v.violation_id, r.rule_code, r.rule_name, v.severity,
                v.subject_type, v.subject_id, v.detected_at,
                v.resolved_at IS NOT NULL AS is_resolved,
                v.resolution
           FROM public.kf_nhi_sod_violation v
      LEFT JOIN public.kf_nhi_sod_rule r
             ON r.sod_rule_id = v.sod_rule_id AND r.tenant_id = v.tenant_id
          WHERE v.tenant_id = ?::uuid
          ORDER BY v.detected_at DESC
          LIMIT 500`,
        [TENANT_ID]
      );
      setRows(
        result.map((r) => ({
          violation_id: asText(r.violation_id),
          rule_code: asText(r.rule_code),
          rule_name: asText(r.rule_name),
          severity: asText(r.severity),
          subject_type: asText(r.subject_type),
          subject_id: asText(r.subject_id),
          detected_at: asText(r.detected_at),
          is_resolved: asBool(r.is_resolved),
          resolution: asText(r.resolution),
        }))
      );
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load SoD violations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshNonce]);

  const bySeverity = useMemo(() => groupCount(rows, "severity"), [rows]);
  const byRule = useMemo(() => groupCount(rows, "rule_code").slice(0, 10), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.rule_code, r.rule_name, r.severity, r.subject_type, r.subject_id, r.resolution]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      { headerName: "Rule", field: "rule_code", cellRenderer: (params: ICellRendererParams<SodRow>) => params.data?.rule_code || "—" },
      { headerName: "Name", field: "rule_name", cellRenderer: (params: ICellRendererParams<SodRow>) => params.data?.rule_name || "—" },
      {
        headerName: "Severity",
        field: "severity",
        cellRenderer: (params: ICellRendererParams<SodRow>) => {
          const sev = params.data?.severity ?? "";
          return (
            <span className={`rounded-full border px-2 py-0.5 text-xs ${severityTone(sev)}`}>
              {sev || "—"}
            </span>
          );
        },
      },
      { headerName: "Subject", field: "subject_type", cellRenderer: (params: ICellRendererParams<SodRow>) => params.data?.subject_type || "—" },
      { headerName: "Subject ID", field: "subject_id", cellRenderer: (params: ICellRendererParams<SodRow>) => params.data?.subject_id || "—" },
      {
        headerName: "Resolved",
        field: "is_resolved",
        cellRenderer: (params: ICellRendererParams<SodRow>) => (params.data?.is_resolved ? "yes" : "no"),
      },
      {
        headerName: "Detected",
        field: "detected_at",
        cellRenderer: (params: ICellRendererParams<SodRow>) =>
          params.data?.detected_at ? new Date(params.data.detected_at).toLocaleString() : "—",
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
    <div className={`w-full space-y-4 ${suppressPageHeader ? "" : "pb-8"}`}>
      {!suppressPageHeader && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Separation-of-Duty Violations</h1>
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
      )}

      {loading && <div className="text-sm text-slate-500">Loading SoD violations…</div>}
      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="flex items-stretch gap-4">
        <div className="w-1/3 min-w-0">
          <ChartCard title="By severity">
            <Bar
              data={{
                labels: bySeverity.map((x) => x.name),
                datasets: [
                  {
                    label: "Count",
                    data: bySeverity.map((x) => x.value),
                    backgroundColor: bySeverity.map((x) => sevColour(x.name)),
                    borderRadius: 4,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
              }}
            />
          </ChartCard>
        </div>
        <div className="w-2/3 min-w-0">
          <ChartCard title="Top 10 triggered rules">
            <Bar
              data={{
                labels: byRule.map((x) => x.name),
                datasets: [{ label: "Count", data: byRule.map((x) => x.value), backgroundColor: "#6366f1", borderRadius: 4 }],
              }}
              options={{
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#e5e7eb" } },
                  y: { ticks: { font: { size: 11 } }, grid: { display: false } },
                },
              }}
            />
          </ChartCard>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Violations ({filtered.length})</h2>
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
          <div className="px-2 py-3 text-xs text-slate-500">No SoD violations.</div>
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="h-[240px]">{children}</div>
    </div>
  );
}

