"use client";

import { useRouter } from "next/navigation";
import {
  CARD_SHELL,
  RiskManagementPageHeader,
  SummaryKpiCard,
} from "@/components/oci-policy-risk-management/RiskManagementShared";
import {
  computeFleetKpis,
  GUARDRAIL_TENANTS,
  GUARDRAILS_TRACKED,
  scoreBgClass,
  scoreTextClass,
} from "@/lib/oci-guardrail-posture-data";

const TH =
  "whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-blue-600 border-b border-gray-200 bg-blue-50";
const TD = "px-3 py-3 text-sm text-gray-800 border-b border-gray-100";

export default function FleetOverviewPage() {
  const router = useRouter();
  const kpis = computeFleetKpis(GUARDRAIL_TENANTS);

  const openTenantPosture = (tenantId: string) => {
    router.push(`/oci-policy-risk-management/tenant-posture?tenant=${encodeURIComponent(tenantId)}`);
  };

  return (
    <div className="w-full min-w-0 pb-8">
      <RiskManagementPageHeader
        title="Fleet overview"
        subtitle="Posture across all monitored OCI tenants"
        showTenantSelect={false}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryKpiCard label="Tenants monitored" value={kpis.tenantsMonitored} />
        <SummaryKpiCard
          label="Avg posture"
          value={`${kpis.avgPosture}%`}
          valueClassName={scoreTextClass(kpis.avgPosture)}
        />
        <SummaryKpiCard label="Guardrails tracked" value={kpis.guardrailsTracked} />
        <SummaryKpiCard
          label="Critical gaps"
          value={kpis.criticalGaps}
          valueClassName="text-red-600"
        />
      </div>

      <div className={CARD_SHELL}>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Tenants</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Tenant</th>
                <th className={TH}>Environment</th>
                <th className={TH}>Posture</th>
                <th className={TH}>Implemented</th>
                <th className={TH}>Critical gaps</th>
                <th className={TH}>Last scan</th>
              </tr>
            </thead>
            <tbody>
              {GUARDRAIL_TENANTS.map((tenant) => (
                <tr
                  key={tenant.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => openTenantPosture(tenant.id)}
                >
                  <td className={`${TD} font-medium`}>{tenant.id}</td>
                  <td className={`${TD} text-gray-500`}>{tenant.environment}</td>
                  <td className={TD}>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${scoreBgClass(tenant.score)}`}
                    >
                      {tenant.score}%
                    </span>
                  </td>
                  <td className={TD}>
                    {tenant.implemented}/{GUARDRAILS_TRACKED}
                  </td>
                  <td className={`${TD} font-medium text-red-600`}>{tenant.criticalGaps}</td>
                  <td className={`${TD} text-gray-500`}>{tenant.lastScan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
