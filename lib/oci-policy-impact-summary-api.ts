import type { PolicyImpactSummary } from "@/types/oci-policy";

/** KeyForge OCI policy impact-analysis endpoint (ACMECOM tenant). */
export const POLICY_IMPACT_SUMMARY_API_BASE =
  "https://graph.keyforge.ai/ociservice/api/v1/ACMECOM/policy-versions";

export function buildPolicyImpactSummaryUrl(policyUid: string): string {
  return `${POLICY_IMPACT_SUMMARY_API_BASE}/${encodeURIComponent(policyUid)}/impact-analysis`;
}

function parseApiError(text: string, status: number, statusText: string): string {
  if (!text.trim()) {
    return `Impact summary request failed (${status} ${statusText})`;
  }
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    const message = body.message ?? body.error ?? body.statusMessage;
    if (typeof message === "string" && message.trim()) return message.trim();
  } catch {
    // not JSON
  }
  return text;
}

function readOptionalString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readOptionalNumber(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function parseSummary(payload: unknown): PolicyImpactSummary {
  const record =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  return {
    blastRadius: readOptionalString(record, "blastRadius", "blast_radius"),
    principalsAffected: readOptionalNumber(record, "principalsAffected", "principals_affected"),
    permissionsAdded: readOptionalNumber(record, "permissionsAdded", "permissions_added"),
    permissionsRemoved: readOptionalNumber(record, "permissionsRemoved", "permissions_removed"),
    resourceFamiliesAffected: readOptionalNumber(
      record,
      "resourceFamiliesAffected",
      "resource_families_affected"
    ),
    compartmentsAffected: readOptionalNumber(record, "compartmentsAffected", "compartments_affected"),
    overallRiskFrom: readOptionalString(record, "overallRiskFrom", "overall_risk_from", "riskFrom"),
    overallRiskTo: readOptionalString(
      record,
      "overallRiskTo",
      "overall_risk_to",
      "riskTo",
      "overallRisk",
      "overall_risk"
    ),
    criticalExposures: readOptionalNumber(record, "criticalExposures", "critical_exposures"),
    privilegeExpansions: readOptionalNumber(record, "privilegeExpansions", "privilege_expansions"),
    accessLosses: readOptionalNumber(record, "accessLosses", "access_losses"),
    comparedWithVersion: readOptionalString(
      record,
      "comparedWithVersion",
      "compared_with_version",
      "enforcedVersion",
      "enforced_version"
    ),
    analyzedOn: readOptionalString(record, "analyzedOn", "analyzed_on", "completedOn", "completed_on"),
    summary: readOptionalString(record, "summary", "description"),
    raw: payload,
  };
}

export async function fetchPolicyImpactSummary(policyUid: string): Promise<PolicyImpactSummary> {
  const res = await fetch(buildPolicyImpactSummaryUrl(policyUid), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(parseApiError(text, res.status, res.statusText));
  }

  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  return parseSummary(payload);
}
