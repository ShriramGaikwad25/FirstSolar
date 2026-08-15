/** KeyForge OCI policy syntax validation endpoint (ACMECOM tenant). */
export const POLICY_VALIDATE_API_URL =
  "https://graph.keyforge.ai/ociservice/api/v1/ACMECOM/policies/validate";

export type PolicyValidationFinding = {
  severity: string;
  position?: number;
  found?: string;
  message: string;
};

export type PolicyValidationStatementResult = {
  statementNumber: number;
  statement: string;
  valid: boolean;
  findings: PolicyValidationFinding[];
};

export type PolicyValidationResult = {
  valid: boolean;
  statementCount: number;
  results: PolicyValidationStatementResult[];
  raw: unknown;
};

function parseApiError(text: string, status: number, statusText: string): string {
  if (!text.trim()) {
    return `Policy validation request failed (${status} ${statusText})`;
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

function parseFinding(raw: unknown): PolicyValidationFinding | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const message = o.message;
  if (typeof message !== "string") return null;
  return {
    severity: typeof o.severity === "string" ? o.severity : "INFO",
    position: typeof o.position === "number" ? o.position : undefined,
    found: typeof o.found === "string" ? o.found : undefined,
    message,
  };
}

function parseStatementResult(
  raw: unknown,
  fallbackIndex: number
): PolicyValidationStatementResult {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const findingsRaw = Array.isArray(o.findings) ? o.findings : [];
  return {
    statementNumber:
      typeof o.statementNumber === "number" ? o.statementNumber : fallbackIndex + 1,
    statement: typeof o.statement === "string" ? o.statement : "",
    valid: typeof o.valid === "boolean" ? o.valid : true,
    findings: findingsRaw.map(parseFinding).filter((f): f is PolicyValidationFinding => f !== null),
  };
}

export async function validatePolicySyntax(policyText: string): Promise<PolicyValidationResult> {
  const res = await fetch(POLICY_VALIDATE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ policyText }),
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

  const record =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  const resultsRaw = Array.isArray(record.results) ? record.results : [];
  const results = resultsRaw.map((r, i) => parseStatementResult(r, i));

  return {
    valid: typeof record.valid === "boolean" ? record.valid : results.every((r) => r.valid),
    statementCount:
      typeof record.statementCount === "number" ? record.statementCount : results.length,
    results,
    raw: payload,
  };
}
