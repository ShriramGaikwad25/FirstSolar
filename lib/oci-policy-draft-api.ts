/** KeyForge OCI policy draft-version creation endpoint (ACMECOM tenant). */
export const POLICY_DRAFT_API_BASE =
  "https://graph.keyforge.ai/ociservice/api/v1/ACMECOM/policy-versions";

export function buildPolicyDraftUrl(policyUid: string): string {
  return `${POLICY_DRAFT_API_BASE}/${encodeURIComponent(policyUid)}/draft`;
}

export type SavePolicyDraftInput = {
  name: string;
  description: string;
  compartmentId: string;
  statements: string[];
  changeLabel: string;
};

function parseApiError(text: string, status: number, statusText: string): string {
  if (!text.trim()) {
    return `Save draft request failed (${status} ${statusText})`;
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

export async function savePolicyDraft(
  policyUid: string,
  input: SavePolicyDraftInput
): Promise<unknown> {
  const res = await fetch(buildPolicyDraftUrl(policyUid), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
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
