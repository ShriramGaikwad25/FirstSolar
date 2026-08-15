"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then((mod) => mod.AgGridReact), { ssr: false });
import "@/lib/ag-grid-setup";
import type { ColDef, ICellRendererParams } from "ag-grid-enterprise";
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
import { RotateCw } from "lucide-react";
import { getNhiV2TenantId, nhiV2ExecuteQuery, nhiV2ExecuteScalar } from "@/lib/nhi-v2-api";
import { sumBy } from "@/lib/nhi-v2-charts";
import { formatUsd } from "@/lib/nhi-agents";
import { NHI2_PAGE_SHELL_CLASS } from "@/lib/nhi-shell";

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

const Radar = dynamic(() => import("react-chartjs-2").then((m) => m.Radar), { ssr: false });
const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), { ssr: false });

const AGENT_LIST_QUERY = `SELECT p.nhi_id, p.agent_name, p.vendor, p.model_name, p.model_version,
                p.evaluation_score, p.tools_enabled, p.active_delegations,
                p.actions_last_24h, p.denied_last_24h,
                p.hallucinations_last_7d, p.avg_latency_ms_24h,
                p.tokens_last_24h, p.cost_usd_24h
           FROM public.kf_nhi_mv_agent_posture p
          WHERE p.tenant_id = ?::uuid
          ORDER BY p.actions_last_24h DESC NULLS LAST`;

type DashPayload = Record<string, unknown>;
type AgentRow = Record<string, unknown>;

function asNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function KPICard({
  label,
  value,
  tone = "info",
}: {
  label: string;
  value: number | string | null | undefined;
  tone?: "info" | "ok" | "warn";
}) {
  const display = value == null || value === "" ? "—" : value;
  const color =
    tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{display}</p>
    </div>
  );
}

/** NHI_V2 AgentPosture.jsx — faithful port with ispm Tailwind. */
export function Nhi2AgentPosturePage() {
  const [dash, setDash] = useState<DashPayload | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const tenantId = getNhiV2TenantId();
      const d = (await nhiV2ExecuteScalar(
        "SELECT public.kf_nhi_get_agent_dashboard(?::uuid) AS result",
        [tenantId]
      )) as DashPayload | null;
      setDash((d as DashPayload) || {});

      const { rows } = await nhiV2ExecuteQuery(AGENT_LIST_QUERY, [tenantId]);
      setAgents(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const radarData = useMemo(
    () => [
      { metric: "Capability", v: asNum(dash?.capability_score ?? dash?.tools_score ?? 0) },
      { metric: "Authorization", v: asNum(dash?.authorization_score ?? dash?.authz_score ?? 0) },
      { metric: "Autonomy", v: asNum(dash?.autonomy_score ?? 0) },
      { metric: "Activity", v: asNum(dash?.activity_score ?? 0) },
      { metric: "Delegation", v: asNum(dash?.delegation_score ?? 0) },
    ],
    [dash]
  );

  const topN = useMemo(
    () =>
      agents.slice(0, 10).map((a) => ({
        name: String(a.agent_name || a.nhi_id || "—"),
        actions: asNum(a.actions_last_24h),
        denied: asNum(a.denied_last_24h),
      })),
    [agents]
  );

  const agentColumnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Agent",
        field: "agent_name",
        flex: 4,
        minWidth: 220,
        cellRenderer: (params: ICellRendererParams<AgentRow>) => (
          <span className="font-medium text-slate-900">{String(params.data?.agent_name ?? "—")}</span>
        ),
      },
      { headerName: "Vendor", field: "vendor", valueFormatter: (p) => String(p.value ?? "—") },
      { headerName: "Model", field: "model_name", valueFormatter: (p) => String(p.value ?? "—") },
      { headerName: "Eval", field: "evaluation_score", valueFormatter: (p) => (p.value ?? "—") as string },
      { headerName: "Tools", field: "tools_enabled", valueFormatter: (p) => (p.value ?? "—") as string },
      {
        headerName: "Delegations",
        field: "active_delegations",
        minWidth: 115,
        valueFormatter: (p) => (p.value ?? "—") as string,
      },
      {
        headerName: "Actions 24h",
        field: "actions_last_24h",
        minWidth: 115,
        valueFormatter: (p) => (p.value ?? "—") as string,
      },
      {
        headerName: "Denied 24h",
        field: "denied_last_24h",
        minWidth: 115,
        valueFormatter: (p) => (p.value ?? "—") as string,
      },
      {
        headerName: "Halluc. 7d",
        field: "hallucinations_last_7d",
        minWidth: 110,
        valueFormatter: (p) => (p.value ?? "—") as string,
      },
      { headerName: "Lat ms", field: "avg_latency_ms_24h", minWidth: 95, valueFormatter: (p) => (p.value ?? "—") as string },
      {
        headerName: "Tokens 24h",
        field: "tokens_last_24h",
        minWidth: 110,
        valueFormatter: (p) => (p.value ?? "—") as string,
      },
      {
        headerName: "$ 24h",
        field: "cost_usd_24h",
        minWidth: 90,
        cellRenderer: (params: ICellRendererParams<AgentRow>) =>
          formatUsd(params.data?.cost_usd_24h as number | null),
      },
    ],
    []
  );

  const agentDefaultColDef = useMemo<ColDef>(
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
        Loading agent posture…
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

  const deniedTotal = sumBy(agents, "denied_last_24h");
  const hallucTotal = sumBy(agents, "hallucinations_last_7d");

  return (
    <div className={`${NHI2_PAGE_SHELL_CLASS} space-y-6`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Agent Posture</h1>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RotateCw className="h-4 w-4" aria-hidden />
          Refresh
        </button>
      </div>

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-7">
          <KPICard label="Agents total" value={dash?.agent_total ?? agents.length} />
          <KPICard label="Active" value={dash?.active} tone="info" />
          <KPICard
            label="Delegations"
            value={dash?.delegations ?? sumBy(agents, "active_delegations")}
          />
          <KPICard
            label="Actions 24h"
            value={dash?.actions_last_24h ?? sumBy(agents, "actions_last_24h")}
            tone="info"
          />
          <KPICard
            label="Denied 24h"
            value={dash?.denied_last_24h ?? deniedTotal}
            tone={deniedTotal > 0 ? "warn" : "ok"}
          />
          <KPICard
            label="Hallucin. 7d"
            value={hallucTotal}
            tone={hallucTotal > 0 ? "warn" : "ok"}
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:col-span-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Agent posture radar</h2>
          <div className="mx-auto h-[260px] max-w-[320px]">
            <Radar
              data={{
                labels: radarData.map((d) => d.metric),
                datasets: [
                  {
                    label: "Score",
                    data: radarData.map((d) => d.v),
                    backgroundColor: "rgba(99, 102, 241, 0.35)",
                    borderColor: "#6366f1",
                    borderWidth: 2,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  r: { min: 0, max: 100, ticks: { stepSize: 25 } },
                },
                plugins: { legend: { display: false } },
              }}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Top agents by 24h action volume</h2>
        <div className="h-[260px]">
          <Bar
            data={{
              labels: topN.map((d) => d.name),
              datasets: [
                { label: "Actions", data: topN.map((d) => d.actions), backgroundColor: "#6366f1", borderRadius: 6 },
                { label: "Denied", data: topN.map((d) => d.denied), backgroundColor: "#ef4444", borderRadius: 6 },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: { y: { beginAtZero: true } },
            }}
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">All agents</h2>
        <div className="p-4">
          <div className="ag-theme-alpine">
            <AgGridReact
              rowData={agents}
              columnDefs={agentColumnDefs}
              defaultColDef={agentDefaultColDef}
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
