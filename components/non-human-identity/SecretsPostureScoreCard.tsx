"use client";

import dynamic from "next/dynamic";
import type { SecretsPostureStats } from "@/lib/nhi-dashboard";

const Doughnut = dynamic(() => import("react-chartjs-2").then((m) => m.Doughnut), { ssr: false });

export type SecretsPostureGaugeData = {
  labels: string[];
  datasets: { data: number[]; backgroundColor: string[]; borderWidth: number }[];
};

export function SecretsPostureScoreCard({
  stats,
  gaugeData,
}: {
  stats: SecretsPostureStats | null;
  gaugeData: SecretsPostureGaugeData | null;
}) {
  if (!stats || !gaugeData) {
    return (
      <div className="flex min-h-[320px] flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Secrets Posture Score</h2>
        <div className="flex min-h-[240px] flex-1 items-center justify-center">
          <p className="px-2 text-center text-sm text-gray-500">No data for this chart.</p>
        </div>
      </div>
    );
  }

  const pct = stats.pct;
  const healthyDisplay = stats.total > 0 ? `${stats.healthy} / ${stats.total}` : "—";

  return (
    <div className="flex min-h-[320px] flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Secrets Posture Score</h2>
      <div className="flex flex-1 flex-col">
        <div className="relative mx-auto h-[150px] w-full max-w-[280px]">
          <Doughnut
            data={gaugeData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              circumference: 180,
              rotation: 270,
              cutout: "72%",
              layout: { padding: { top: 8, bottom: 0, left: 4, right: 4 } },
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      if (ctx.dataIndex === 0) return `Healthy secrets ratio: ${pct}%`;
                      return "";
                    },
                  },
                },
                datalabels: { display: false },
              },
            }}
          />
        </div>
        <div className="-mt-2 text-center">
          <p className="text-3xl font-bold tracking-tight text-slate-900">{pct}%</p>
          <p className="mt-1 text-sm text-gray-600">Healthy secrets ratio</p>
        </div>
        <dl className="mt-4 space-y-2.5 border-t border-gray-100 pt-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-700">Healthy</dt>
            <dd className="tabular-nums text-gray-900">{healthyDisplay}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-700">Rotation overdue</dt>
            <dd className="font-medium tabular-nums text-red-600">{stats.rotationOverdue}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-700">Expiring soon</dt>
            <dd className="font-medium tabular-nums text-amber-600">{stats.expiringSoon}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-700">Expired</dt>
            <dd className="font-medium tabular-nums text-rose-400">{stats.expired}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-700">Never rotated</dt>
            <dd className="font-medium tabular-nums text-amber-600">{stats.neverRotated}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
