import type {
  PolicyOptimizationGrant,
  PolicyOptimizationItem,
  PolicyOptimizationResult,
  PolicyOptimizationSummary,
} from "@/types/oci-policy";

/** KeyForge OCI policy optimization endpoint (ACMECOM tenant). */
export const POLICY_OPTIMIZATION_API_URL =
  "https://graph.keyforge.ai/ociservice/api/v1/ACMECOM/policy-optimization";

/** KeyForge OCI policy graph load endpoint (ACMECOM tenant). */
export const POLICY_GRAPH_LOAD_API_URL =
  "https://graph.keyforge.ai/ociservice/api/v1/ACMECOM/policies/graph/load";

export function isPolicyOptimizationApiConfigured(): boolean {
  return true;
}

interface PolicyOptimizationFinding {
  type: string;
  severity: string;
  subject: { kind: string; name: string };
  verb: string;
  resource: string;
  compartment: { name?: string; ocid?: string; scope: string };
  redundantGrants: PolicyOptimizationGrant[];
  coveredBy?: PolicyOptimizationGrant[];
  reason: string;
  suggestedAction: string;
}

interface PolicyOptimizationApiResponse {
  tenancyId?: string;
  tenancyName?: string;
  summary?: PolicyOptimizationSummary;
  findings?: PolicyOptimizationFinding[];
  rows?: PolicyOptimizationItem[];
  data?: PolicyOptimizationItem[];
}

function normalizeOptimizationType(type: string): string {
  const normalized = type.trim().toUpperCase().replace(/\s+/g, "_");
  if (normalized === "OVER_BROAD") return "OVER_PRIVILEGED";
  return type;
}

function normalizeOptimizationRows(rows: PolicyOptimizationItem[]): PolicyOptimizationItem[] {
  return rows.map((row) => ({
    ...row,
    optimizationType: normalizeOptimizationType(row.optimizationType),
  }));
}

function extractConditionFromRaw(raw: string): string | null {
  const match = raw.match(/\bwhere\b(.+)$/i);
  return match ? match[1].trim() : null;
}

function formatSubject(subject: { kind: string; name: string }): string {
  const name = subject.name?.trim() || "—";
  if (subject.kind === "GROUP") return name;
  if (subject.kind === "SERVICE") return `service ${name}`;
  if (subject.kind === "UNKNOWN") return name;
  return `${subject.kind}: ${name}`;
}

function formatCompartment(compartment: PolicyOptimizationFinding["compartment"]): {
  compartment: string;
  compartmentTitle: string;
  compartmentOcid: string | null;
} {
  const name = compartment.name?.trim();
  const ocid = compartment.ocid?.trim();
  const scope = compartment.scope?.trim();

  if (name) {
    return {
      compartment: name,
      compartmentTitle: ocid ? `${name} · ${ocid}` : name,
      compartmentOcid: ocid ?? null,
    };
  }

  if (scope === "TENANCY") {
    return {
      compartment: "tenancy",
      compartmentTitle: ocid ?? "tenancy",
      compartmentOcid: ocid ?? null,
    };
  }

  if (ocid) {
    const label = scope === "COMPARTMENT" ? "Compartment" : scope || "Compartment";
    return {
      compartment: label,
      compartmentTitle: ocid,
      compartmentOcid: ocid,
    };
  }

  return {
    compartment: scope || "—",
    compartmentTitle: scope || "—",
    compartmentOcid: null,
  };
}

export function mapFindingsToRows(findings: PolicyOptimizationFinding[]): PolicyOptimizationItem[] {
  return findings.map((finding, index) => {
    const redundantGrants = (finding.redundantGrants ?? []).map((grant) => ({
      ref: grant.ref,
      policyName: grant.policyName,
      raw: grant.raw,
    }));
    const coveredBy = (finding.coveredBy ?? []).map((grant) => ({
      ref: grant.ref,
      policyName: grant.policyName,
      raw: grant.raw,
    }));
    const firstGrant = redundantGrants[0];
    const compartmentFields = formatCompartment(finding.compartment);

    return {
      findingId: `${finding.type}-${index}`,
      policyName: firstGrant?.policyName ?? "—",
      statement: redundantGrants.map((grant) => grant.ref).join(", ") || "—",
      groupName: formatSubject(finding.subject),
      owner: "—",
      action: finding.verb,
      resource: finding.resource,
      compartment: compartmentFields.compartment,
      compartmentTitle: compartmentFields.compartmentTitle,
      compartmentOcid: compartmentFields.compartmentOcid,
      condition: firstGrant ? extractConditionFromRaw(firstGrant.raw) : null,
      optimizationType: normalizeOptimizationType(finding.type),
      reason: finding.reason,
      coveredByStatement: coveredBy[0]?.ref ?? null,
      recommendation: finding.suggestedAction,
      severity: finding.severity,
      rawStatement: firstGrant?.raw,
      coveredByRaw: coveredBy[0]?.raw ?? null,
      redundantGrants,
      coveredBy,
    };
  });
}

function normalizePolicyOptimizationSummary(
  summary: PolicyOptimizationSummary | undefined
): PolicyOptimizationSummary | null {
  if (!summary) return null;

  const legacy = summary as PolicyOptimizationSummary & { overBroad?: number };
  const overPrivileged = summary.overPrivileged ?? legacy.overBroad ?? 0;

  return {
    ...summary,
    overPrivileged,
  };
}

function parsePolicyOptimizationResponse(payload: unknown): PolicyOptimizationResult {
  if (Array.isArray(payload)) {
    return {
      rows: normalizeOptimizationRows(payload as PolicyOptimizationItem[]),
      summary: null,
      tenancyName: null,
    };
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Policy optimization API returned an unexpected response shape");
  }

  const record = payload as PolicyOptimizationApiResponse;

  if (Array.isArray(record.findings)) {
    return {
      rows: mapFindingsToRows(record.findings),
      summary: normalizePolicyOptimizationSummary(record.summary ?? undefined),
      tenancyName: record.tenancyName ?? null,
    };
  }

  if (Array.isArray(record.rows)) {
    return {
      rows: normalizeOptimizationRows(record.rows),
      summary: normalizePolicyOptimizationSummary(record.summary ?? undefined),
      tenancyName: record.tenancyName ?? null,
    };
  }

  if (Array.isArray(record.data)) {
    return {
      rows: normalizeOptimizationRows(record.data),
      summary: normalizePolicyOptimizationSummary(record.summary ?? undefined),
      tenancyName: record.tenancyName ?? null,
    };
  }

  throw new Error("Policy optimization API returned an unexpected response shape");
}

function parseApiError(text: string, status: number, statusText: string): string {
  if (!text.trim()) {
    return `Policy optimization API request failed (${status} ${statusText})`;
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

export function policyOptimizationScopesUrl(policyName: string): string {
  return `${POLICY_OPTIMIZATION_API_URL}/scopes/${encodeURIComponent(policyName.trim())}`;
}

export async function fetchPolicyOptimizationScopes(
  policyName: string,
  bearerToken?: string | null
): Promise<unknown> {
  const trimmedName = policyName.trim();
  if (!trimmedName) {
    throw new Error("Policy name is required to load scopes.");
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const token =
    bearerToken?.trim() || process.env.POLICY_OPTIMIZATION_API_KEY?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(policyOptimizationScopesUrl(trimmedName), {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(parseApiError(text, res.status, res.statusText)) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const text = await res.text().catch(() => "");
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function fetchPolicyOptimizationRows(
  bearerToken?: string | null
): Promise<PolicyOptimizationResult> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const token =
    bearerToken?.trim() || process.env.POLICY_OPTIMIZATION_API_KEY?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(POLICY_OPTIMIZATION_API_URL, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(parseApiError(text, res.status, res.statusText)) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const payload = (await res.json()) as unknown;
  return parsePolicyOptimizationResponse(payload);
}

export async function loadPolicyGraph(
  bearerToken?: string | null
): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const token =
    bearerToken?.trim() || process.env.POLICY_OPTIMIZATION_API_KEY?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(POLICY_GRAPH_LOAD_API_URL, {
    method: "POST",
    headers,
    body: "{}",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(parseApiError(text, res.status, res.statusText)) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const text = await res.text().catch(() => "");
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export type LoadPolicyGraphCard = {
  label: string;
  value: string;
  accent?: string;
};

function humanizeLoadPolicyKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function formatLoadPolicyCardValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value.trim() || "—";
  if (Array.isArray(value)) {
    return value.length === 0 ? "None" : value.length.toLocaleString();
  }
  return JSON.stringify(value);
}

function pushLoadPolicyCards(
  cards: LoadPolicyGraphCard[],
  label: string,
  value: unknown
): void {
  cards.push({
    label,
    value: formatLoadPolicyCardValue(value),
    accent: typeof value === "number" ? "text-blue-700" : undefined,
  });
}

export function buildLoadPolicyGraphCards(payload: unknown): LoadPolicyGraphCard[] {
  if (payload == null || payload === "") {
    return [{ label: "Status", value: "Policies loaded successfully." }];
  }

  if (typeof payload === "string") {
    return [{ label: "Message", value: payload }];
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((item, index) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return Object.entries(item as Record<string, unknown>).map(([key, value]) => ({
          label: `${humanizeLoadPolicyKey(key)} ${index + 1}`,
          value: formatLoadPolicyCardValue(value),
          accent: typeof value === "number" ? "text-blue-700" : undefined,
        }));
      }

      return [
        {
          label: `Item ${index + 1}`,
          value: formatLoadPolicyCardValue(item),
        },
      ];
    });
  }

  if (typeof payload === "object") {
    const cards: LoadPolicyGraphCard[] = [];

    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const [nestedKey, nestedValue] of Object.entries(
          value as Record<string, unknown>
        )) {
          pushLoadPolicyCards(
            cards,
            `${humanizeLoadPolicyKey(key)} · ${humanizeLoadPolicyKey(nestedKey)}`,
            nestedValue
          );
        }
        continue;
      }

      pushLoadPolicyCards(cards, humanizeLoadPolicyKey(key), value);
    }

    return cards.length > 0
      ? cards
      : [{ label: "Status", value: "Policies loaded successfully." }];
  }

  return [{ label: "Result", value: String(payload) }];
}
