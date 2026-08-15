"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { executeQuery } from "@/lib/api";
import {
  extractResultRows,
  coerceRowObject,
  normalizeDashboardRow,
  parseNhisByType,
  parseNhisByLifecycle,
  parseNhisByRisk,
  parseSecretsPostureStats,
} from "@/lib/nhi-dashboard";
import { SecretsPostureScoreCard } from "@/components/non-human-identity/SecretsPostureScoreCard";
import {
  CHART_SERIES_COLORS,
  CHART_TRACK_GRAY,
  buildNhiTypeLegendColorMap,
  secretHealthArcColor,
} from "@/lib/chart-colors";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const Doughnut = dynamic(() => import("react-chartjs-2").then((m) => m.Doughnut), { ssr: false });
const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), { ssr: false });

const NHI_DASHBOARD_QUERY = "select * from public.kf_nhi_get_dashboard()";

/**
 * `HeaderContent` registers chartjs-plugin-datalabels globally. Stacked bars then
 * render a label for every series — including zeros. Hide labels when value is 0.
 */
const DATALABELS_HIDE_ZERO = {
  display: (context: { dataset: { data: unknown[] }; dataIndex: number }) => {
    const raw = context.dataset.data[context.dataIndex];
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) && n !== 0;
  },
};

function ChartCard({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col min-h-[280px]">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="flex-1 flex items-center justify-center min-h-[240px] w-full">
        {empty ? (
          <p className="text-sm text-gray-500 text-center px-2">No data for this chart.</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export default function NhiDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await executeQuery<unknown>(NHI_DASHBOARD_QUERY, []);
      const rows = extractResultRows(response);
      const rawFirst = rows[0];
      const asObject = coerceRowObject(rawFirst);
      if (!asObject) {
        setRow(null);
        return;
      }
      setRow(normalizeDashboardRow(asObject));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byType = useMemo(() => (row ? parseNhisByType(row) : []), [row]);
  const byLifecycle = useMemo(() => (row ? parseNhisByLifecycle(row) : null), [row]);

  /** Shared legend colors for chart 1 + 2 (same NHI type → same color) */
  const nhiTypeLegendColorMap = useMemo(() => {
    const labels: string[] = [];
    byType.forEach((x) => labels.push(x.label));
    byLifecycle?.datasets?.forEach((ds) => labels.push(ds.label));
    return buildNhiTypeLegendColorMap(labels);
  }, [byType, byLifecycle]);
  const byRisk = useMemo(() => (row ? parseNhisByRisk(row) : []), [row]);
  const secretsPosture = useMemo(() => (row ? parseSecretsPostureStats(row) : null), [row]);

  const typeChartData = useMemo(() => {
    if (!byType.length) return null;
    return {
      labels: byType.map((x) => x.label),
      datasets: [
        {
          data: byType.map((x) => x.value),
          backgroundColor: byType.map(
            (x) => nhiTypeLegendColorMap.get(x.label) ?? CHART_SERIES_COLORS[0]
          ),
          borderWidth: 0,
        },
      ],
    };
  }, [byType, nhiTypeLegendColorMap]);

  const lifecycleChartData = useMemo(() => {
    if (!byLifecycle?.labels?.length || !byLifecycle.datasets?.length) return null;
    return {
      labels: byLifecycle.labels,
      datasets: byLifecycle.datasets.map((ds) => ({
        label: ds.label,
        data: ds.data,
        backgroundColor:
          ds.backgroundColor ??
          nhiTypeLegendColorMap.get(ds.label) ??
          CHART_SERIES_COLORS[0],
        borderWidth: 0,
      })),
    };
  }, [byLifecycle, nhiTypeLegendColorMap]);

  /** Max stacked height per category — drives y-axis so ticks aren’t stuck at 0–1 */
  const lifecycleYMax = useMemo(() => {
    if (!lifecycleChartData?.labels?.length) return 1;
    const n = lifecycleChartData.labels.length;
    const sums = new Array(n).fill(0);
    for (const ds of lifecycleChartData.datasets) {
      for (let i = 0; i < n; i++) {
        sums[i] += Number((ds.data as number[])[i] ?? 0);
      }
    }
    const peak = Math.max(0, ...sums);
    return Math.max(1, Math.ceil(peak));
  }, [lifecycleChartData]);

  const riskChartData = useMemo(() => {
    if (!byRisk.length) return null;
    return {
      labels: byRisk.map((x) => x.label),
      datasets: [
        {
          label: "",
          data: byRisk.map((x) => x.value),
          backgroundColor: byRisk.map((x) => x.color),
          borderWidth: 0,
          borderRadius: 4,
        },
      ],
    };
  }, [byRisk]);

  const riskXMax = useMemo(() => {
    if (!byRisk.length) return 1;
    const peak = Math.max(0, ...byRisk.map((x) => x.value));
    return Math.max(1, Math.ceil(peak));
  }, [byRisk]);

  const gaugeData = useMemo(() => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-7xl mx-auto pb-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">NHI Dashboard</h1>
          {(loading || error) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {loading && <span className="text-sm text-gray-500">Loading…</span>}
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          )}
        </div>

        {loading && !row && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[300px] rounded-lg bg-gray-200 animate-pulse border border-gray-200"
              />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Total NHIs by Type" empty={!typeChartData}>
            {typeChartData && (
              <div className="h-[240px] w-full relative">
                <Doughnut
                  data={typeChartData}
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
            )}
          </ChartCard>

          <ChartCard title="NHIs by Lifecycle State" empty={!lifecycleChartData}>
            {lifecycleChartData && (
              <div className="w-full h-[240px] relative">
                <Bar
                  data={lifecycleChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { stacked: true, grid: { display: false } },
                      y: {
                        stacked: true,
                        beginAtZero: true,
                        max: lifecycleYMax,
                        ticks: {
                          precision: 0,
                          ...(lifecycleYMax <= 20 ? { stepSize: 1 } : { maxTicksLimit: 12 }),
                        },
                      },
                    },
                    plugins: {
                      legend: {
                        position: "right",
                        align: "center",
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
            )}
          </ChartCard>

          <ChartCard title="NHIs by Risk Level" empty={!riskChartData}>
            {riskChartData && (
              <div className="w-full h-[240px] relative">
                <Bar
                  data={riskChartData}
                  options={{
                    indexAxis: "y",
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: {
                        beginAtZero: true,
                        max: riskXMax,
                        grid: { color: CHART_TRACK_GRAY },
                        ticks: {
                          precision: 0,
                          ...(riskXMax <= 20 ? { stepSize: 1 } : { maxTicksLimit: 12 }),
                          callback: (value) =>
                            Math.round(typeof value === "number" ? value : Number(value)),
                        },
                      },
                      y: { grid: { display: false } },
                    },
                    plugins: {
                      legend: {
                        display: true,
                        position: "right",
                        align: "center",
                        labels: {
                          boxWidth: 12,
                          font: { size: 11 },
                          generateLabels: (chart) => {
                            const ds = chart.data.datasets[0];
                            const lbls = chart.data.labels;
                            if (!lbls?.length || !ds) return [];
                            const bg = ds.backgroundColor;
                            return lbls.map((label, i) => ({
                              text: String(label),
                              fillStyle: Array.isArray(bg) ? bg[i] : bg,
                              strokeStyle: Array.isArray(bg) ? bg[i] : bg,
                              lineWidth: 0,
                              hidden: false,
                              datasetIndex: 0,
                              index: i,
                            }));
                          },
                        },
                      },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => {
                            const raw = ctx.parsed.x;
                            const n = Math.round(typeof raw === "number" ? raw : Number(raw));
                            const risk = ctx.label ?? "";
                            return risk ? `${risk}: ${n}` : String(n);
                          },
                        },
                      },
                      datalabels: DATALABELS_HIDE_ZERO,
                    },
                  }}
                />
              </div>
            )}
          </ChartCard>

          <SecretsPostureScoreCard stats={secretsPosture} gaugeData={gaugeData} />
        </div>
      </div>
    </div>
  );
}
