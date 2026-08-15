"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  CARD_SHELL,
  PostureScoreRing,
  RiskManagementPageHeader,
} from "@/components/oci-policy-risk-management/RiskManagementShared";
import { useOciGuardrailTenant } from "@/hooks/useOciGuardrailTenant";
import {
  computeDomainPosture,
  getCriticalGapGuardrails,
  GUARDRAILS,
  scoreRingColor,
} from "@/lib/oci-guardrail-posture-data";

function domainBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export default function TenantPosturePage() {
  const router = useRouter();
  const { tenant } = useOciGuardrailTenant();

  if (!tenant) return null;

  const criticalGaps = getCriticalGapGuardrails(GUARDRAILS);
  const domains = computeDomainPosture(GUARDRAILS);
  const total = tenant.implemented + tenant.partial + tenant.missing;
  const implementedPct = total === 0 ? 0 : Math.round((tenant.implemented / total) * 100);
  const partialEndPct =
    total === 0 ? 0 : Math.round(((tenant.implemented + tenant.partial) / total) * 100);

  const openRemediation = (guardrailId: string) => {
    router.push(
      `/oci-policy-risk-management/risk-remediation?guardrail=${encodeURIComponent(guardrailId)}&tenant=${encodeURIComponent(tenant.id)}`
    );
  };

  return (
    <div className="w-full min-w-0 pb-8">
      <RiskManagementPageHeader
        title="Tenant posture"
        subtitle="Guardrail coverage for the selected tenant"
      />

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className={CARD_SHELL}>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Posture score</h2>
          <div className="flex flex-wrap items-center gap-6">
            <PostureScoreRing score={tenant.score} />
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  Implemented <strong className="text-gray-800">{tenant.implemented}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />
                  Partial <strong className="text-gray-800">{tenant.partial}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
                  Missing <strong className="text-gray-800">{tenant.missing}</strong>
                </span>
              </div>
              <div className="h-3.5 overflow-hidden rounded-md bg-gray-100">
                <div
                  className="h-full rounded-md"
                  style={{
                    width: "100%",
                    background: `linear-gradient(90deg, #0E9F6E 0 ${implementedPct}%, #D97706 0 ${partialEndPct}%, #DC2626 0)`,
                  }}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-gray-500">
                Weighted coverage of the critical deny-policy guardrails for this tenant. Partial
                counts as half.
              </p>
            </div>
          </div>
        </div>

        <div className={CARD_SHELL}>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Top critical gaps</h2>
          <div className="space-y-2">
            {criticalGaps.length === 0 ? (
              <p className="text-sm text-gray-500">No critical gaps found.</p>
            ) : (
              criticalGaps.map((guardrail) => (
                <button
                  key={guardrail.id}
                  type="button"
                  onClick={() => openRemediation(guardrail.id)}
                  className="flex w-full items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-left hover:border-gray-300 hover:bg-gray-50"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-gray-900">{guardrail.name}</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">{guardrail.domain}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className={CARD_SHELL}>
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Posture by domain</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {domains.map((domain) => {
            const barColor = domainBarColor(domain.score);
            const dotColor = scoreRingColor(domain.score);
            return (
              <div
                key={domain.domain}
                className="rounded-lg border border-gray-200 bg-white px-3.5 py-3"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-gray-800">{domain.domain}</span>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: dotColor }}
                    aria-hidden
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  {domain.score}% · {Math.round(domain.covered)}/{domain.total}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded bg-gray-100">
                  <div
                    className={`h-full rounded ${barColor}`}
                    style={{ width: `${domain.score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
