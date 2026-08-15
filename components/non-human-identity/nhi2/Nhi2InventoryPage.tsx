"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then((mod) => mod.AgGridReact), { ssr: false });
import "@/lib/ag-grid-setup";
import type { ColDef, ICellRendererParams } from "ag-grid-enterprise";
import Link from "next/link";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { RotateCw, Search } from "lucide-react";
import { getNhiV2TenantId, nhiV2ExecuteQuery } from "@/lib/nhi-v2-api";
import { groupCount, NHI_V2_PALETTE } from "@/lib/nhi-v2-charts";
import { NHI2_PAGE_SHELL_CLASS } from "@/lib/nhi-shell";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const Doughnut = dynamic(() => import("react-chartjs-2").then((m) => m.Doughnut), { ssr: false });
const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), { ssr: false });

const NHI_IDENTITIES_QUERY = `SELECT i.nhi_id, i.name, i.nhi_type, i.state, i.risk_level,
                i.criticality, i.execution_type, i.load_source,
                i.createddate, i.review_status
           FROM public.kf_nhi_identity i
          WHERE i.tenant_id = ?::uuid
          ORDER BY i.createddate DESC
          LIMIT 500`;

type IdentityRow = Record<string, unknown>;

function chartFromGroups(groups: { name: string; value: number }[], offset = 0) {
  return {
    labels: groups.map((g) => g.name),
    datasets: [
      {
        data: groups.map((g) => g.value),
        backgroundColor: groups.map((_, i) => NHI_V2_PALETTE[(i + offset) % NHI_V2_PALETTE.length]),
        borderWidth: 0,
      },
    ],
  };
}

function cellText(v: unknown): string {
  if (v == null || v === "") return "—";
  return String(v);
}

function formatCreated(v: unknown): string {
  if (v == null || v === "") return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString();
}

/** NHI_V2 NHIInventory.jsx — faithful port with ispm Tailwind. */
export function Nhi2InventoryPage() {
  const [rows, setRows] = useState<IdentityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const tid = getNhiV2TenantId();
      const { rows: r } = await nhiV2ExecuteQuery(NHI_IDENTITIES_QUERY, [tid]);
      setRows(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byType = useMemo(() => groupCount(rows, "nhi_type"), [rows]);
  const byState = useMemo(() => groupCount(rows, "state"), [rows]);
  const byCriticality = useMemo(() => groupCount(rows, "criticality"), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.name,
        r.nhi_id,
        r.nhi_type,
        r.state,
        r.risk_level,
        r.criticality,
        r.execution_type,
        r.review_status,
        r.load_source,
      ]
        .map((v) => cellText(v).toLowerCase())
        .join(" ")
        .includes(q)
    );
  }, [rows, search]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Name",
        field: "name",
        minWidth: 160,
        cellRenderer: (params: ICellRendererParams<IdentityRow>) => {
          const nhiId = cellText(params.data?.nhi_id);
          return (
            <Link
              href={`/non-human-identity-2/nhis/${encodeURIComponent(nhiId)}`}
              className="font-medium text-blue-700 hover:underline break-words"
            >
              {cellText(params.data?.name)}
            </Link>
          );
        },
      },
      { headerName: "Type", field: "nhi_type", valueFormatter: (p) => cellText(p.value) },
      { headerName: "State", field: "state", valueFormatter: (p) => cellText(p.value) },
      { headerName: "Risk", field: "risk_level", valueFormatter: (p) => cellText(p.value) },
      { headerName: "Criticality", field: "criticality", minWidth: 110, valueFormatter: (p) => cellText(p.value) },
      { headerName: "Execution", field: "execution_type", minWidth: 105, valueFormatter: (p) => cellText(p.value) },
      { headerName: "Review", field: "review_status", valueFormatter: (p) => cellText(p.value) },
      { headerName: "Source", field: "load_source", valueFormatter: (p) => cellText(p.value) },
      {
        headerName: "Created",
        field: "createddate",
        minWidth: 110,
        valueFormatter: (p) => formatCreated(p.value),
      },
      {
        headerName: "Actions",
        sortable: false,
        filter: false,
        flex: 0,
        width: 90,
        cellRenderer: (params: ICellRendererParams<IdentityRow>) => {
          const nhiId = cellText(params.data?.nhi_id);
          return (
            <Link
              href={`/non-human-identity-2/nhis/${encodeURIComponent(nhiId)}`}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              Edit →
            </Link>
          );
        },
      },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: false,
      flex: 1,
      minWidth: 90,
      resizable: true,
      wrapHeaderText: false,
      autoHeaderHeight: false,
      suppressHeaderMenuButton: true,
    }),
    []
  );

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-500">
        Loading NHI inventory…
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-800">{err}</p>
        <button type="button" onClick={() => void load()} className="mt-2 text-sm text-red-700 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`${NHI2_PAGE_SHELL_CLASS} space-y-6`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">NHI Inventory</h1>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RotateCw className="h-4 w-4" aria-hidden />
          Refresh
        </button>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="By type">
          <Doughnut
            data={chartFromGroups(byType)}
            options={{ responsive: true, maintainAspectRatio: false, cutout: "45%", plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } } }}
          />
        </ChartCard>
        <ChartCard title="By state">
          <Doughnut
            data={chartFromGroups(byState, 2)}
            options={{ responsive: true, maintainAspectRatio: false, cutout: "45%", plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } } }}
          />
        </ChartCard>
        <ChartCard title="By criticality">
          <Bar
            data={{
              labels: byCriticality.map((g) => g.name),
              datasets: [{ data: byCriticality.map((g) => g.value), backgroundColor: "#6366f1", borderRadius: 6 }],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
          />
        </ChartCard>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <div className="relative w-full min-w-[12rem] max-w-xs">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or NHI id…"
                autoComplete="off"
                aria-label="Search identities"
                className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Identities ({filtered.length})</h2>
          </div>
        </div>
        <div className="p-4">
          <div className="ag-theme-alpine">
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
        </div>
      </section>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      <div className="h-[240px]">{children}</div>
    </div>
  );
}
