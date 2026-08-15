"use client";

import { ChevronDown, RefreshCw, ShieldAlert } from "lucide-react";
import { useOciGuardrailTenant } from "@/hooks/useOciGuardrailTenant";

const CARD_SHELL =
  "rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm";

export function SummaryKpiCard({
  label,
  value,
  valueClassName = "text-gray-900",
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div className={CARD_SHELL}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClassName}`}>{value}</p>
    </div>
  );
}

export function GuardrailStatusBadge({ status }: { status: string }) {
  const className =
    status === "Implemented"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Partial"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: string }) {
  const color =
    severity === "Critical"
      ? "bg-red-500"
      : severity === "High"
        ? "bg-amber-500"
        : "bg-gray-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden />;
}

export function PostureScoreRing({ score }: { score: number }) {
  const ringColor =
    score >= 70 ? "#0E9F6E" : score >= 50 ? "#D97706" : "#DC2626";

  return (
    <div
      className="flex h-[150px] w-[150px] shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${ringColor} ${score}%, #EEF2F7 0)`,
      }}
      role="img"
      aria-label={`Posture score ${score} percent`}
    >
      <div className="flex h-[112px] w-[112px] flex-col items-center justify-center rounded-full bg-white">
        <span className="text-3xl font-bold text-gray-900">{score}%</span>
        <span className="text-xs text-gray-500">coverage</span>
      </div>
    </div>
  );
}

export function RiskManagementPageHeader({
  title,
  subtitle,
  showTenantSelect = true,
}: {
  title: string;
  subtitle: string;
  showTenantSelect?: boolean;
}) {
  const { tenantId, tenants, setTenantId } = useOciGuardrailTenant();

  const handleRescan = () => {
    window.alert("Demo: triggers the policy scanner for the selected tenant.");
  };

  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <ShieldAlert className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-500">
            Confidential
          </span>
          {showTenantSelect && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <span className="font-medium">Tenant</span>
              <div className="relative">
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="appearance-none rounded-md border border-gray-300 bg-white py-2 pl-3 pr-9 text-sm text-gray-900 min-w-[180px] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  aria-label="Select tenant"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden
                />
              </div>
            </label>
          )}
          <button
            type="button"
            onClick={handleRescan}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Re-scan
          </button>
        </div>
      </div>
    </header>
  );
}

export { CARD_SHELL };
