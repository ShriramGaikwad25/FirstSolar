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
import { executeQuery } from "@/lib/api";
import { parseSecretsPostureStats } from "@/lib/nhi-dashboard";
import { SecretsPostureScoreCard } from "@/components/non-human-identity/SecretsPostureScoreCard";
import {
  buildNhiTypeLegendColorMap,
  CHART_SERIES_COLORS,
  CHART_TRACK_GRAY,
  secretHealthArcColor,
} from "@/lib/chart-colors";
import {
  buildGovernanceView,
  DASHBOARD_V2_QUERY,
  FINDINGS_SEVERITY_QUERY,
  getNormalizedDashboardV2Row,
  GOVERNANCE_TENANT_ID,
  parseFindingsSeverityResponse,
  severityChartColor,
  type GovernanceViewModel,
  type MetricTone,
} from "@/lib/governance-posture";
ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const Doughnut = dynamic(() => import("react-chartjs-2").then((m) => m.Doughnut), { ssr: false });
const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), { ssr: false });

const DATALABELS_HIDE_ZERO = {
  display: (context: { dataset: { data: unknown[] }; dataIndex: number }) => {
    const raw = context.dataset.data[context.dataIndex];
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) && n !== 0;
  },
};

/** Static slice data — mirrors NHI dashboard “Total NHIs by Type” donut style */
const STATIC_NHI_BY_TYPE = [
  { label: "Service Account", value: 142 },
  { label: "API Key", value: 89 },
  { label: "AI Agent", value: 56 },
  { label: "OAuth Client", value: 34 },
  { label: "Certificate", value: 21 },
] as const;

/** Managed / Unmanaged — static counts */
const STATIC_MANAGED_REVIEWED = 412;
const STATIC_MANAGED_NOT_REVIEWED = 156;
const STATIC_UNMANAGED = 283;

/** High risk NHI — donut segments */
const STATIC_HIGH_RISK_SEGMENTS = [
  { label: "Internet Exposed", value: 42 },
  { label: "Production Critical", value: 28 },
  { label: "Role Drifts", value: 19 },
  { label: "Over Privileged", value: 35 },
] as const;

/** Policy violations — semi-gauge segments */
const STATIC_POLICY_VIOLATIONS = [
  { label: "SoD Violation", value: 14 },
  { label: "AI Agent Violation", value: 9 },
  { label: "SLA Breach", value: 7 },
] as const;

const EMPTY_VIEW = buildGovernanceView(null, []);

function metricValueClass(tone: MetricTone): string {
  switch (tone) {
    case "blue":
      return "text-blue-600";
    case "amber":
      return "text-amber-600";
    case "red":
      return "text-red-600";
    default:
      return "text-gray-900";
  }
}

function ChartShell({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-[280px] flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}
    >
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
      <div className="flex min-h-[240px] flex-1 w-full items-center justify-center">{children}</div>
    </div>
  );
}

function LegendSwatch({
  color,
  label,
  value,
  size = "default",
}: {
  color: string;
  label: string;
  value: string;
  size?: "default" | "lg";
}) {
  const isLg = size === "lg";
  return (
    <li
      className={`flex items-center text-slate-600 ${isLg ? "gap-2.5 text-sm" : "gap-2 text-xs"}`}
    >
      <span
        className={`shrink-0 rounded-sm ${isLg ? "h-3 w-3" : "h-2.5 w-2.5"}`}
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="leading-tight">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500"> — {value}</span>
      </span>
    </li>
  );
}

export function GovernancePostureDashboard() {
  const [view, setView] = useState<GovernanceViewModel>(EMPTY_VIEW);
  const [dashboardRow, setDashboardRow] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const tenant = GOVERNANCE_TENANT_ID;
      const [dashRes, findRes] = await Promise.all([
        executeQuery<unknown>(DASHBOARD_V2_QUERY, [tenant]),
        executeQuery<unknown>(FINDINGS_SEVERITY_QUERY, [tenant]),
      ]);
      const norm = getNormalizedDashboardV2Row(dashRes);
      const findings = parseFindingsSeverityResponse(findRes);
      setDashboardRow(norm);
      setView(buildGovernanceView(norm, findings));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load governance data";
      setError(msg);
      setDashboardRow(null);
      setView(EMPTY_VIEW);
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

  const overallScore = view.overallScore;
  const gaugeArcColor = secretHealthArcColor(Math.min(100, Math.max(0, overallScore)));

  const gaugeData = useMemo(
    () => ({
      labels: ["Score", "Rest"],
      datasets: [
        {
          data: [overallScore, Math.max(0, 100 - overallScore)],
          backgroundColor: [gaugeArcColor, "#e5e7eb"],
          borderWidth: 0,
          circumference: 180,
          rotation: -90,
        },
      ],
    }),
    [overallScore, gaugeArcColor]
  );

  const staticTypeColorMap = useMemo(
    () => buildNhiTypeLegendColorMap([...STATIC_NHI_BY_TYPE.map((x) => x.label)]),
    []
  );

  const staticNhiByTypeChart = useMemo(
    () => ({
      labels: STATIC_NHI_BY_TYPE.map((x) => x.label),
      datasets: [
        {
          data: STATIC_NHI_BY_TYPE.map((x) => x.value),
          backgroundColor: STATIC_NHI_BY_TYPE.map(
            (x) => staticTypeColorMap.get(x.label) ?? CHART_SERIES_COLORS[0]
          ),
          borderWidth: 0,
        },
      ],
    }),
    [staticTypeColorMap]
  );

  const managedUnmanagedChart = useMemo(
    () => ({
      labels: ["Managed", "Unmanaged"],
      datasets: [
        {
          label: "Reviewed in 6 months",
          data: [STATIC_MANAGED_REVIEWED, 0],
          backgroundColor: "#11C65E",
          borderWidth: 0,
          borderRadius: 4,
        },
        {
          label: "Not Reviewed",
          data: [STATIC_MANAGED_NOT_REVIEWED, 0],
          backgroundColor: "#F9B824",
          borderWidth: 0,
          borderRadius: 4,
        },
        {
          label: "Unmanaged",
          data: [0, STATIC_UNMANAGED],
          backgroundColor: "#94A3B8",
          borderWidth: 0,
          borderRadius: 4,
        },
      ],
    }),
    []
  );

  const managedYMax = useMemo(() => {
    const managedTotal = STATIC_MANAGED_REVIEWED + STATIC_MANAGED_NOT_REVIEWED;
    return Math.max(managedTotal, STATIC_UNMANAGED, 1);
  }, []);

  const secretsPosture = useMemo(
    () => (dashboardRow ? parseSecretsPostureStats(dashboardRow) : null),
    [dashboardRow]
  );

  const secretsGaugeData = useMemo(() => {
    if (secretsPosture === null) return null;
    const p = secretsPosture.pct;
    const rest = Math.max(0, 100 - p);
    return {
      labels: ["Healthy ratio", "Remaining"],
      datasets: [
        {
          data: [p, rest],
          backgroundColor: [secretHealthArcColor(p), CHART_TRACK_GRAY],
          borderWidth: 0,
        },
      ],
    };
  }, [secretsPosture]);

  const highRiskNhiChart = useMemo(
    () => ({
      labels: STATIC_HIGH_RISK_SEGMENTS.map((x) => x.label),
      datasets: [
        {
          data: STATIC_HIGH_RISK_SEGMENTS.map((x) => x.value),
          backgroundColor: STATIC_HIGH_RISK_SEGMENTS.map(
            (_, i) => CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]
          ),
          borderWidth: 0,
        },
      ],
    }),
    []
  );

  const policyViolationsTotal = useMemo(
    () => STATIC_POLICY_VIOLATIONS.reduce((s, x) => s + x.value, 0),
    []
  );

  const policyViolationsChart = useMemo(() => {
    const values = STATIC_POLICY_VIOLATIONS.map((x) => x.value);
    const colors = [
      CHART_SERIES_COLORS[0],
      CHART_SERIES_COLORS[1],
      CHART_SERIES_COLORS[2],
    ];
    return {
      labels: STATIC_POLICY_VIOLATIONS.map((x) => x.label),
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderWidth: 0,
          circumference: 180,
          rotation: -90,
        },
      ],
    };
  }, []);

  const findingsChart = useMemo(() => {
    const rows = view.findingsBySeverity;
    if (!rows.length) return null;
    return {
      labels: rows.map((s) => s.severity),
      datasets: [
        {
          data: rows.map((s) => s.n),
          backgroundColor: rows.map((s) => severityChartColor(s.severity)),
          borderWidth: 0,
        },
      ],
    };
  }, [view.findingsBySeverity]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          Governance Posture
        </h1>
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

      {/* Section 1 — Overall Posture + six metric boxes */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm lg:col-span-5">
          <div className="relative mx-auto h-[200px] max-w-[300px]">
            <Doughnut
              data={gaugeData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: "78%",
                layout: { padding: { top: 8, bottom: 24 } },
                plugins: {
                  legend: { display: false },
                  tooltip: { enabled: false },
                },
              }}
            />
            <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center text-center">
              <span className="text-4xl font-semibold tabular-nums text-slate-900">
                {Number.isFinite(overallScore)
                  ? overallScore.toFixed(1)
                  : "—"}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Overall posture
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-7">
          {view.metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {m.label}
              </p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${metricValueClass(m.tone)}`}>
                {m.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2 — Total NHIs by type + Managed / Unmanaged */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartShell title="Total NHIs by Type">
          <div className="relative h-[240px] w-full">
            <Doughnut
              data={staticNhiByTypeChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: 4 },
                plugins: {
                  legend: {
                    position: "right",
                    align: "center",
                    labels: { boxWidth: 12, font: { size: 11 } },
                  },
                  datalabels: DATALABELS_HIDE_ZERO,
                },
              }}
            />
          </div>
        </ChartShell>

        <ChartShell title="Managed vs Unmanaged">
          <div className="h-[240px] w-full">
            <Bar
              data={managedUnmanagedChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: { stacked: true, grid: { display: false } },
                  y: {
                    stacked: true,
                    beginAtZero: true,
                    max: managedYMax,
                    ticks: {
                      precision: 0,
                      maxTicksLimit: 10,
                    },
                  },
                },
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: { boxWidth: 12, font: { size: 11 } },
                  },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => {
                        const name = ctx.dataset.label ?? "";
                        const raw = ctx.parsed.y;
                        const n = Math.round(typeof raw === "number" ? raw : Number(raw));
                        return name ? `${name}: ${n}` : String(n);
                      },
                    },
                  },
                  datalabels: DATALABELS_HIDE_ZERO,
                },
              }}
            />
          </div>
        </ChartShell>
      </div>

      {/* Section 3 — Secrets posture + High risk NHI */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SecretsPostureScoreCard stats={secretsPosture} gaugeData={secretsGaugeData} />

        <ChartShell title="High Risk NHI">
          <div className="relative h-[260px] w-full max-w-[340px]">
            <Doughnut
              data={highRiskNhiChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: 4 },
                plugins: {
                  legend: {
                    position: "right",
                    align: "center",
                    labels: { boxWidth: 12, font: { size: 11 } },
                  },
                  datalabels: DATALABELS_HIDE_ZERO,
                },
              }}
            />
          </div>
        </ChartShell>
      </div>

      {/* Section 4 — Policy violations + Open findings by severity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartShell title="Policy Violations">
          <div className="flex w-full flex-row flex-wrap items-center justify-center gap-6 sm:gap-8">
            <div className="relative h-[200px] w-[240px] shrink-0">
              <Doughnut
                data={policyViolationsChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: "78%",
                  layout: { padding: { top: 8, bottom: 12, left: 4, right: 4 } },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => {
                          const v = ctx.raw;
                          const n = typeof v === "number" ? v : Number(v);
                          return `${ctx.label}: ${n}`;
                        },
                      },
                    },
                  },
                }}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-10 flex flex-col items-center text-center">
                <span className="text-3xl font-semibold tabular-nums text-slate-900">
                  {policyViolationsTotal}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                  Total violations
                </span>
              </div>
            </div>
            <ul className="flex min-w-[160px] flex-col gap-2" aria-label="Policy violations legend">
              {STATIC_POLICY_VIOLATIONS.map((row, i) => (
                <LegendSwatch
                  key={row.label}
                  color={CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]}
                  label={row.label}
                  value={String(row.value)}
                />
              ))}
            </ul>
          </div>
        </ChartShell>

        <ChartShell title="Open findings by severity">
          {!view.findingsBySeverity.length ? (
            <p className="py-12 text-center text-sm text-slate-500">
              No open findings for this tenant.
            </p>
          ) : findingsChart ? (
            <div className="mx-auto flex h-[260px] max-w-[320px] items-center justify-center">
              <Doughnut
                data={findingsChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "right",
                      labels: { boxWidth: 12, font: { size: 11 }, color: "#475569" },
                    },
                  },
                }}
              />
            </div>
          ) : null}
        </ChartShell>
      </div>
    </div>
  );
}
