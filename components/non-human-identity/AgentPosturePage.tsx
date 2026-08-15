"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import Link from "next/link";
import { Eye, RotateCw, Search } from "lucide-react";
import { getNhiV2TenantId, nhiV2ExecuteQuery } from "@/lib/nhi-v2-api";
import {
  AGENT_POSTURE_LIST_QUERY,
  computeAgentSummary,
  formatUsd,
  parseAgentPostureListRows,
  type NhiAgentRow,
} from "@/lib/nhi-agents";
import "@/lib/ag-grid-setup";
import type { ColDef, ICellRendererParams } from "ag-grid-enterprise";

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);


ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const Radar = dynamic(() => import("react-chartjs-2").then((m) => m.Radar), {
  ssr: false,
});
const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), {
  ssr: false,
});

const RADAR_LABELS = [
  "Capability",
  "Authorization",
  "Autonomy",
  "Activity",
  "Delegation",
];

const TOP_N = 10;

/** Whole numbers for radar (avoids 84.0652-style tooltips). */
function roundRadarValues(values: number[]): number[] {
  return values.map((v) =>
    Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 0
  );
}

export function AgentPosturePage() {
  const [agents, setAgents] = useState<NhiAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [agentNameSearch, setAgentNameSearch] = useState("");
  const pageSize = 10;

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { rows: listRes } = await nhiV2ExecuteQuery(AGENT_POSTURE_LIST_QUERY, [
        getNhiV2TenantId(),
      ]);
      setAgents(parseAgentPostureListRows(listRes));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load agents");
      setAgents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const postureSummary = useMemo(
    () => computeAgentSummary(agents),
    [agents]
  );

  const metrics = postureSummary.metrics;

  const radar = useMemo(
    () => roundRadarValues(postureSummary.radar),
    [postureSummary.radar]
  );

  const radarData = useMemo(
    () => ({
      labels: RADAR_LABELS,
      datasets: [
        {
          label: "Posture",
          data: radar,
          hidden: true,
          backgroundColor: "rgba(41, 121, 255, 0.15)",
          borderColor: "#2979FF",
          borderWidth: 2,
          pointBackgroundColor: "#2979FF",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "#2979FF",
        },
      ],
    }),
    [radar]
  );

  const topByActions = useMemo(() => {
    return [...agents]
      .sort(
        (a, b) =>
          (b.actions_last_24h ?? 0) - (a.actions_last_24h ?? 0)
      )
      .slice(0, TOP_N);
  }, [agents]);

  const barData = useMemo(() => {
    const labels = topByActions.map((a) =>
      (a.agent_name ?? "—").length > 22
        ? `${(a.agent_name ?? "").slice(0, 20)}…`
        : a.agent_name ?? "—"
    );
    const actions = topByActions.map((a) => {
      const t = a.actions_last_24h ?? 0;
      const d = a.denied_last_24h ?? 0;
      return Math.max(0, t - d);
    });
    const denied = topByActions.map((a) => a.denied_last_24h ?? 0);
    return {
      labels,
      datasets: [
        {
          label: "Actions",
          data: actions,
          backgroundColor: "#2979FF",
          borderRadius: 4,
        },
        {
          label: "Denied",
          data: denied,
          backgroundColor: "#EF4444",
          borderRadius: 4,
        },
      ],
    };
  }, [topByActions]);

  const filtered = useMemo(() => {
    if (!agentNameSearch.trim()) return agents;
    const q = agentNameSearch.trim().toLowerCase();
    return agents.filter((a) => (a.agent_name ?? "").toLowerCase().includes(q));
  }, [agents, agentNameSearch]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Agent",
        field: "agent_name",
        minWidth: 120,
        cellRenderer: (params: ICellRendererParams<NhiAgentRow>) => (
          <span className="block max-w-[200px] truncate font-medium text-slate-900">
            {params.data?.agent_name ?? "—"}
          </span>
        ),
      },
      {
        headerName: "Vendor",
        field: "vendor",
        valueFormatter: (params) => params.value ?? "—",
      },
      {
        headerName: "Model",
        field: "model_name",
        cellRenderer: (params: ICellRendererParams<NhiAgentRow>) => (
          <span className="block max-w-[140px] truncate">
            {params.data?.model_name ?? "—"}
          </span>
        ),
      },
      {
        headerName: "Version",
        field: "model_version",
        cellRenderer: (params: ICellRendererParams<NhiAgentRow>) => (
          <span className="block max-w-[100px] truncate">
            {params.data?.model_version ?? "—"}
          </span>
        ),
      },
      {
        headerName: "Eval",
        field: "evaluation_score",
        valueFormatter: (params) =>
          params.value != null
            ? (Math.round(params.value * 10) / 10).toFixed(1)
            : "—",
      },
      {
        headerName: "Tools",
        field: "tools_enabled",
        valueFormatter: (params) => params.value ?? "—",
      },
      {
        headerName: "Delegations",
        field: "active_delegations",
        minWidth: 115,
        valueFormatter: (params) => params.value ?? "—",
      },
      {
        headerName: "Actions 24h",
        field: "actions_last_24h",
        minWidth: 115,
        valueFormatter: (params) => params.value ?? "—",
      },
      {
        headerName: "Denied 24h",
        field: "denied_last_24h",
        minWidth: 115,
        valueFormatter: (params) => params.value ?? "—",
      },
      {
        headerName: "Hallucin. 7d",
        field: "hallucinations_last_7d",
        minWidth: 120,
        valueFormatter: (params) => params.value ?? "—",
      },
      {
        headerName: "Lat ms",
        field: "avg_latency_ms_24h",
        minWidth: 95,
        valueFormatter: (params) => params.value ?? "—",
      },
      {
        headerName: "Tokens 24h",
        field: "tokens_last_24h",
        minWidth: 115,
        valueFormatter: (params) => params.value ?? "—",
      },
      {
        headerName: "$ 24h",
        field: "cost_usd_24h",
        minWidth: 90,
        cellRenderer: (params: ICellRendererParams<NhiAgentRow>) =>
          formatUsd(params.data?.cost_usd_24h),
      },
      {
        headerName: "View",
        sortable: false,
        filter: false,
        flex: 0,
        width: 80,
        cellRenderer: (params: ICellRendererParams<NhiAgentRow>) => {
          const a = params.data;
          return a?.nhi_id ? (
            <Link
              href={`/non-human-identity/ai-agent-inventory/${encodeURIComponent(a.nhi_id)}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              title="View agent details"
              aria-label={`View details for ${a.agent_name ?? "agent"}`}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className="text-slate-300">—</span>
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

  return (
    <div className="w-full min-w-0 space-y-6 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
            AI Agent Inventory
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Performance and posture across registered AI agents.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50"
        >
          <RotateCw
            className={`h-4 w-4 ${refreshing || loading ? "animate-spin" : ""}`}
            aria-hidden
          />
          Refresh
        </button>
      </div>

      {(loading || error) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {loading && <span className="text-slate-500">Loading…</span>}
          {error && <span className="text-red-600">{error}</span>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12 lg:items-stretch">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-8">
          <MetricCard label="Agents total" value={metrics.agentsTotal} tone="dark" />
          <MetricCard
            label="Active"
            value={metrics.activeDisplay}
            tone="muted"
          />
          <MetricCard
            label="Delegations"
            value={metrics.delegations}
            tone="dark"
          />
          <MetricCard
            label="Actions 24h"
            value={metrics.actions24h}
            tone="blue"
          />
          <MetricCard
            label="Denied 24h"
            value={metrics.denied24h}
            tone="amber"
          />
          <MetricCard
            label="Hallucin. 7d"
            value={metrics.hallucinations7d}
            tone="amber"
          />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
            Agent posture radar
          </h2>
          <div className="relative mx-auto h-[260px] max-w-[320px]">
            {agents.length === 0 && !loading ? (
              <p className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
                No agent rows yet — nothing to plot.
              </p>
            ) : (
              <Radar
                data={radarData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    r: {
                      min: 0,
                      max: 100,
                      ticks: { stepSize: 25, font: { size: 10 } },
                      grid: { color: "#e2e8f0" },
                      pointLabels: { font: { size: 11 } },
                    },
                  },
                  interaction: {
                    mode: "nearest",
                    intersect: false,
                  },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                    enabled: false,
                      callbacks: {
                        label: (ctx) => {
                          const labels = ctx.chart?.data?.labels;
                          const axis =
                            Array.isArray(labels) &&
                            typeof ctx.dataIndex === "number"
                              ? String(labels[ctx.dataIndex] ?? "")
                              : "";
                          const raw = ctx.raw;
                          const n =
                            typeof raw === "number" && Number.isFinite(raw)
                              ? Math.round(raw)
                              : raw;
                          return axis ? `${axis}: ${n}` : `${ctx.dataset.label}: ${n}`;
                        },
                      },
                    },
                  },
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-700">
          Top agents by 24h action volume
        </h2>
        <div className="h-[280px] w-full">
          {topByActions.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              No agent rows returned.
            </p>
          ) : (
            <Bar
              data={barData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "top",
                    labels: { boxWidth: 12, font: { size: 11 } },
                  },
                },
                scales: {
                  x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { font: { size: 10 }, maxRotation: 45 },
                  },
                  y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: "#f1f5f9" },
                  },
                },
              }}
            />
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                All agents
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Search by agent name.
              </p>
            </div>
          </div>

          <div className="mt-4 max-w-sm">
            <div className="min-w-0">
              <label htmlFor="agent-inv-name" className="text-sm font-medium text-gray-700">
                Agent name
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-gray-400" aria-hidden />
                </div>
                <input
                  id="agent-inv-name"
                  type="search"
                  value={agentNameSearch}
                  onChange={(e) => setAgentNameSearch(e.target.value)}
                  placeholder="Search by agent name…"
                  autoComplete="off"
                  className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>
          </div>
        </div>
        <div
            className="ag-theme-alpine"
            style={{ ["--ag-font-size" ]: "12px", ["--ag-header-font-size" ]: "12px" } as any}
          >
          <AgGridReact
            rowData={filtered}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination={true}
            paginationPageSize={pageSize}
            paginationPageSizeSelector={[10, 25, 50, 100]}
            domLayout="autoHeight"
            rowHeight={36}
            headerHeight={32}
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "dark" | "blue" | "amber" | "muted";
}) {
  const cls =
    tone === "blue"
      ? "text-blue-600"
      : tone === "amber"
        ? "text-amber-600"
        : tone === "muted"
          ? "text-slate-400"
          : "text-slate-900";
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${cls}`}>
        {value}
      </p>
    </div>
  );
}
