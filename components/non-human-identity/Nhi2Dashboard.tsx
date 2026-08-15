"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { RotateCw } from "lucide-react";
import { NHI2_PAGE_SHELL_CLASS } from "@/lib/nhi-shell";
import { getNhiV2TenantId, nhiV2ExecuteQuery, nhiV2ExecuteScalar } from "@/lib/nhi-v2-api";
import { severityChartColor } from "@/lib/governance-posture";
import { secretHealthArcColor } from "@/lib/chart-colors";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), { ssr: false });
const Doughnut = dynamic(() => import("react-chartjs-2").then((m) => m.Doughnut), { ssr: false });

type DashPayload = Record<string, unknown>;
type SevRow = { severity: string; n: number };

function subScoreBarColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function metricToneClass(tone: "info" | "ok" | "warn" | "danger"): string {
  switch (tone) {
    case "info":
      return "text-blue-600";
    case "warn":
      return "text-amber-600";
    case "danger":
      return "text-red-600";
    default:
      return "text-emerald-600";
  }
}

function PostureGauge({ value, label }: { value: number; label: string }) {
  const score = Math.min(100, Math.max(0, value));
  const arcColor = secretHealthArcColor(score);
  const gaugeData = useMemo(
    () => ({
      labels: ["Score", "Rest"],
      datasets: [
        {
          data: [score, Math.max(0, 100 - score)],
          backgroundColor: [arcColor, "#e5e7eb"],
          borderWidth: 0,
          circumference: 180,
          rotation: -90,
        },
      ],
    }),
    [score, arcColor]
  );

  return (
    <div className="relative mx-auto h-[200px] max-w-[300px]">
      <Doughnut
        data={gaugeData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "78%",
          layout: { padding: { top: 8, bottom: 24 } },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
        }}
      />
      <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center text-center">
        <span className="text-4xl font-semibold tabular-nums text-slate-900">
          {Number.isFinite(score) ? score.toFixed(1) : "—"}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  tone = "info",
}: {
  label: string;
  value: number | string | null | undefined;
  tone?: "info" | "ok" | "warn" | "danger";
}) {
  const display = value == null || value === "" ? "—" : value;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${metricToneClass(tone)}`}>
        {display}
      </p>
    </div>
  );
}

function readBlock(dash: DashPayload | null, key: string): Record<string, unknown> {
  if (!dash) return {};
  const block = dash[key] ?? dash[key.charAt(0).toUpperCase() + key.slice(1)];
  return block && typeof block === "object" && !Array.isArray(block)
    ? (block as Record<string, unknown>)
    : {};
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sevFromTrend(trend: SevRow[]) {
  return trend.map((r) => ({
    name: r.severity,
    value: r.n,
    fill: severityChartColor(r.severity),
  }));
}

function sevFromFindingsBlock(f: Record<string, unknown>) {
  return (["critical", "high", "medium", "low"] as const).reduce<
    { name: string; value: number; fill: string }[]
  >((acc, k) => {
    if (f[k] != null) {
      const n = Number(f[k]);
      if (Number.isFinite(n) && n > 0) {
        acc.push({ name: k, value: n, fill: severityChartColor(k) });
      }
    }
    return acc;
  }, []);
}

export function Nhi2Dashboard() {
  const [dash, setDash] = useState<DashPayload | null>(null);
  const [trend, setTrend] = useState<SevRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const tenantId = getNhiV2TenantId();
      const d = (await nhiV2ExecuteScalar(
        "SELECT public.kf_nhi_get_dashboard_v2(?::uuid) AS result",
        [tenantId]
      )) as DashPayload | null;
      setDash((d as DashPayload) || {});

      const { rows: bySev } = await nhiV2ExecuteQuery(
        `SELECT severity, count(*)::int AS n
           FROM public.kf_nhi_finding
          WHERE tenant_id = ?::uuid AND status IN ('open','triaged','in_progress','blocked')
          GROUP BY severity
          ORDER BY CASE severity
                     WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                     WHEN 'medium' THEN 3 WHEN 'low'  THEN 4 ELSE 5 END`,
        [tenantId]
      );
      setTrend(
        bySev.map((r) => ({
          severity: String(r.severity ?? ""),
          n: readNumber(r, "n"),
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load NHI posture");
      setDash(null);
      setTrend([]);
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

  const p = readBlock(dash, "posture");
  const f = readBlock(dash, "findings");

  const overallScore = Number(
    p.posture_score ?? dash?.posture_score ?? dash?.score ?? 0
  );

  const subBars = useMemo(
    () =>
      (
        [
          ["ownership", p.ownership_score],
          ["freshness", p.freshness_score],
          ["review", p.review_score],
          ["rotation", p.rotation_score],
          ["expiry", p.expiry_score],
          ["vault", p.vault_score],
          ["sod", p.sod_score],
          ["drift", p.drift_score],
          ["remediation", p.remediation_score],
        ] as const
      ).map(([metric, raw]) => {
        const score = Number(Number(raw ?? 0).toFixed(1));
        return { metric, score, fill: subScoreBarColor(score) };
      }),
    [p]
  );

  const sevData = trend.length ? sevFromTrend(trend) : sevFromFindingsBlock(f);

  const kpiSpecs = useMemo(
    () => [
      { label: "NHIs", value: p.nhi_total, tone: "info" as const },
      { label: "Secrets", value: p.secret_total, tone: "info" as const },
      {
        label: "Findings Open",
        value: f.open ?? p.findings_open,
        tone: Number(f.open ?? p.findings_open) > 0 ? ("warn" as const) : ("ok" as const),
      },
      {
        label: "SLA Breached",
        value: f.sla_breached ?? p.findings_sla_breached,
        tone:
          Number(f.sla_breached ?? p.findings_sla_breached) > 0
            ? ("danger" as const)
            : ("ok" as const),
      },
      {
        label: "SoD Violations",
        value: p.sod_open,
        tone: Number(p.sod_open) > 0 ? ("warn" as const) : ("ok" as const),
      },
      {
        label: "Role Drifts",
        value: p.drift_open,
        tone: Number(p.drift_open) > 0 ? ("warn" as const) : ("ok" as const),
      },
    ],
    [p, f]
  );

  const findingsChart =
    sevData.length > 0
      ? {
          labels: sevData.map((s) => s.name),
          datasets: [
            {
              data: sevData.map((s) => s.value),
              backgroundColor: sevData.map((s) => s.fill),
              borderWidth: 0,
            },
          ],
        }
      : null;

  if (loading && !refreshing) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">
        Loading NHI posture…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-800">{error}</p>
        <button
          type="button"
          onClick={handleRefresh}
          className="mt-3 text-sm font-medium text-red-700 underline hover:text-red-900"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`${NHI2_PAGE_SHELL_CLASS} space-y-6`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          Governance Posture
        </h1>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RotateCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </button>
      </div>

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm lg:col-span-5">
          <PostureGauge value={overallScore} label="Overall Posture" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-7">
          {kpiSpecs.map((kpi) => (
            <KPICard key={kpi.label} label={kpi.label} value={kpi.value as number} tone={kpi.tone} />
          ))}
        </div>
      </section>

      <section>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Sub-scores</h2>
          <div className="h-[260px] w-full">
            <Bar
              data={{
                labels: subBars.map((d) => d.metric),
                datasets: [
                  {
                    label: "Score",
                    data: subBars.map((d) => d.score),
                    backgroundColor: subBars.map((d) => d.fill),
                    borderRadius: 6,
                    borderSkipped: false,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: { grid: { display: false } },
                  y: { min: 0, max: 100, grid: { color: "#e5e7eb" } },
                },
                plugins: { legend: { display: false } },
              }}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Open Findings by Severity</h2>
          {!sevData.length ? (
            <p className="py-12 text-center text-sm text-slate-500">No open findings</p>
          ) : findingsChart ? (
            <div className="mx-auto h-[260px] max-w-[320px]">
              <Doughnut
                data={findingsChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: "55%",
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: { boxWidth: 12, font: { size: 11 } },
                    },
                  },
                }}
              />
            </div>
          ) : null}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Raw dashboard payload</h2>
          <pre className="max-h-[260px] overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(dash, null, 2)}
          </pre>
        </div>
      </section>
    </div>
  );
}
