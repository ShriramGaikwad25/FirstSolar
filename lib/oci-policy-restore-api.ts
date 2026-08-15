/** KeyForge OCI policy version restore-to-draft endpoint (ACMECOM tenant). */
export const POLICY_RESTORE_API_BASE =
  "https://graph.keyforge.ai/ociservice/api/v1/ACMECOM/policy-versions";

export function buildPolicyRestoreUrl(
  policyUid: string,
  versionNo: string | number
): string {
  const url = new URL(`${POLICY_RESTORE_API_BASE}/${encodeURIComponent(policyUid)}/restore`);
  url.searchParams.set("to", String(versionNo));
  return url.toString();
}

function parseApiError(text: string, status: number, statusText: string): string {
  if (!text.trim()) {
    return `Restore version request failed (${status} ${statusText})`;
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

export async function restorePolicyVersion(
  policyUid: string,
  versionNo: string | number
): Promise<unknown> {
  const res = await fetch(buildPolicyRestoreUrl(policyUid, versionNo), {
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
