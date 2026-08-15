"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  CARD_SHELL,
  GuardrailStatusBadge,
  RiskManagementPageHeader,
  SeverityDot,
} from "@/components/oci-policy-risk-management/RiskManagementShared";
import {
  buildRecommendedDenyPolicy,
  getGuardrailById,
  guardrailCurrentState,
  GUARDRAIL_ROLLOUT_STEPS,
  guardrailWhyItMatters,
} from "@/lib/oci-guardrail-posture-data";

export default function RiskRemediationPage() {
  const searchParams = useSearchParams();
  const guardrailId = searchParams.get("guardrail");
  const guardrail = guardrailId ? getGuardrailById(guardrailId) : undefined;

  const tenantQuery = searchParams.get("tenant");
  const guardrailsHref = tenantQuery
    ? `/oci-policy-risk-management/guardrails?tenant=${encodeURIComponent(tenantQuery)}`
    : "/oci-policy-risk-management/guardrails";

  return (
    <div className="w-full min-w-0 pb-8">
      <RiskManagementPageHeader
        title="Remediation"
        subtitle="Recommended policy and rollout steps"
      />

      {!guardrail ? (
        <div className={`${CARD_SHELL} text-sm text-gray-600`}>
          Select a guardrail from the{" "}
          <Link href={guardrailsHref} className="font-medium text-indigo-600 hover:underline">
            Guardrails
          </Link>{" "}
          page to view remediation guidance.
        </div>
      ) : (
        <div className={CARD_SHELL}>
          <h2 className="font-mono text-sm font-semibold text-gray-900">{guardrail.name}</h2>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
              {guardrail.domain}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
              <SeverityDot severity={guardrail.severity} />
              {guardrail.severity}
            </span>
            <GuardrailStatusBadge status={guardrail.status} />
          </div>

          <section className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900">Current state</h3>
            <p className="mt-1 text-sm text-gray-600">{guardrailCurrentState(guardrail.status)}</p>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-semibold text-gray-900">Recommended deny policy</h3>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 px-4 py-3 font-mono text-xs leading-relaxed text-slate-100 whitespace-pre-wrap break-words">
              {buildRecommendedDenyPolicy(guardrail.name)}
            </pre>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-semibold text-gray-900">Why it matters</h3>
            <p className="mt-1 text-sm text-gray-600">{guardrailWhyItMatters(guardrail)}</p>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-semibold text-gray-900">Rollout steps</h3>
            <ol className="mt-2 divide-y divide-gray-100">
              {GUARDRAIL_ROLLOUT_STEPS.map((step, index) => (
                <li
                  key={step}
                  className="relative py-2.5 pl-8 text-sm text-gray-700"
                >
                  <span className="absolute left-0 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-600">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            <strong>Break-glass:</strong> every deny carries{" "}
            <code className="font-mono">
              where request.principal.id != &apos;&lt;break-glass&gt;&apos;
            </code>{" "}
            so emergencies stay possible and admins are never locked out.
          </div>
        </div>
      )}
    </div>
  );
}
