"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CARD_SHELL,
  GuardrailStatusBadge,
  RiskManagementPageHeader,
  SeverityDot,
} from "@/components/oci-policy-risk-management/RiskManagementShared";
import { useOciGuardrailTenant } from "@/hooks/useOciGuardrailTenant";
import { GUARDRAILS } from "@/lib/oci-guardrail-posture-data";
import type { GuardrailStatus } from "@/types/oci-guardrail-posture";

const STATUS_FILTERS: Array<GuardrailStatus | "All"> = [
  "All",
  "Missing",
  "Partial",
  "Implemented",
];

const TH =
  "whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-blue-600 border-b border-gray-200 bg-blue-50";
const TD = "px-3 py-3 text-sm text-gray-800 border-b border-gray-100";

export default function GuardrailsPage() {
  const router = useRouter();
  const { tenantId } = useOciGuardrailTenant();
  const [statusFilter, setStatusFilter] = useState<GuardrailStatus | "All">("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return GUARDRAILS.filter((guardrail) => {
      if (statusFilter !== "All" && guardrail.status !== statusFilter) return false;
      if (!normalized) return true;
      return (
        guardrail.name.toLowerCase().includes(normalized) ||
        guardrail.domain.toLowerCase().includes(normalized)
      );
    });
  }, [query, statusFilter]);

  const openRemediation = (guardrailId: string) => {
    router.push(
      `/oci-policy-risk-management/risk-remediation?guardrail=${encodeURIComponent(guardrailId)}&tenant=${encodeURIComponent(tenantId)}`
    );
  };

  return (
    <div className="w-full min-w-0 pb-8">
      <RiskManagementPageHeader
        title="Guardrails"
        subtitle="Critical deny-policy checks and their status"
      />

      <div className={CARD_SHELL}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === filter
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 bg-white text-gray-500 hover:border-gray-400"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter guardrails…"
            className="w-full max-w-[220px] rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            aria-label="Filter guardrails"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className={`${TH} w-[44%]`}>Guardrail (deny policy)</th>
                <th className={TH}>Domain</th>
                <th className={TH}>Severity</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((guardrail) => (
                <tr
                  key={guardrail.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => openRemediation(guardrail.id)}
                >
                  <td className={`${TD} font-mono text-xs`}>{guardrail.name}</td>
                  <td className={`${TD} text-gray-500`}>{guardrail.domain}</td>
                  <td className={TD}>
                    <span className="inline-flex items-center gap-2">
                      <SeverityDot severity={guardrail.severity} />
                      {guardrail.severity}
                    </span>
                  </td>
                  <td className={TD}>
                    <GuardrailStatusBadge status={guardrail.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Showing {filtered.length} of {GUARDRAILS.length} guardrails
        </p>
      </div>
    </div>
  );
}
