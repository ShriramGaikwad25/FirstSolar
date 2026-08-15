/** KeyForge OCI policy-version impact-analysis endpoint (ACMECOM tenant). */
export const POLICY_IMPACT_ANALYSIS_API_BASE =
  "https://graph.keyforge.ai/ociservice/api/v1/ACMECOM/policy-versions";

export function buildPolicyImpactAnalysisUrl(policyUid: string): string {
  return `${POLICY_IMPACT_ANALYSIS_API_BASE}/${encodeURIComponent(policyUid)}/impact-analysis`;
}

function parseApiError(text: string, status: number, statusText: string): string {
  if (!text.trim()) {
    return `Run impact analysis request failed (${status} ${statusText})`;
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

export async function runPolicyImpactAnalysis(policyUid: string): Promise<unknown> {
  const res = await fetch(buildPolicyImpactAnalysisUrl(policyUid), {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(parseApiError(text, res.status, res.statusText));
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}
