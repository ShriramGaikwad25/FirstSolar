import type {
  PolicyIncomingSimulationConflictRow,
  PolicyIncomingSimulationResult,
  PolicySimulationStatementRef,
} from "@/types/oci-policy";

/** KeyForge OCI policy recommendation endpoint (ACMECOM tenant). */
export const POLICY_RECOMMENDATION_API_URL =
  "https://graph.keyforge.ai/ociservice/api/v1/ACMECOM/policy-recommendation";

export const DEFAULT_POLICY_RECOMMENDATION_NAME = "kf-iam-export-readonly";

export type PolicyRecommendationInput = {
  policyName: string;
  statement: string;
};

const WRAPPER_KEYS = ["data", "result", "payload", "response", "body"] as const;

function parseApiError(text: string, status: number, statusText: string): string {
  if (!text.trim()) {
    return `Policy recommendation API request failed (${status} ${statusText})`;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function readStringArray(record: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value)) continue;
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (typeof item === "number" && Number.isFinite(item)) return String(item);
        return "";
      })
      .filter(Boolean);
  }
  return [];
}

function parseGrantRef(item: unknown, index: number): PolicySimulationStatementRef | null {
  if (typeof item === "string") {
    const fullText = item.trim();
    if (!fullText) return null;
    return {
      statementId: String(index),
      policy: "—",
      fullText,
    };
  }

  if (!isRecord(item)) return null;

  const policy =
    readString(item, "policyName", "policy_name", "policy", "policyId", "policy_id") ||
    "—";
  const statementId =
    readString(
      item,
      "ref",
      "statementId",
      "statement_id",
      "statementIndex",
      "statement_index",
      "id"
    ) || String(index);
  const fullText =
    readString(
      item,
      "raw",
      "fullText",
      "full_text",
      "statement",
      "text",
      "statementText",
      "statement_text"
    ) || "—";

  if (policy === "—" && fullText === "—") return null;

  return { policy, statementId, fullText };
}

function parseGrantRefs(value: unknown): PolicySimulationStatementRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => parseGrantRef(item, index))
    .filter((item): item is PolicySimulationStatementRef => item !== null);
}

function readGrantRefs(record: Record<string, unknown>, ...keys: string[]): PolicySimulationStatementRef[] {
  for (const key of keys) {
    const refs = parseGrantRefs(record[key]);
    if (refs.length > 0) return refs;
  }
  return [];
}

function isFindingRecord(record: Record<string, unknown>): boolean {
  return Boolean(
    readString(record, "reason") ||
      readString(record, "suggestedAction", "suggested_action") ||
      Array.isArray(record.coveredBy) ||
      Array.isArray(record.covered_by) ||
      Array.isArray(record.redundantGrants) ||
      Array.isArray(record.redundant_grants) ||
      readString(record, "type")
  );
}

function extractFindingRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  if (isFindingRecord(record)) return record;

  const finding = record.finding;
  if (isRecord(finding) && isFindingRecord(finding)) return finding;

  const findings = record.findings;
  if (Array.isArray(findings)) {
    for (const item of findings) {
      if (isRecord(item) && isFindingRecord(item)) return item;
    }
  }

  return null;
}

function unwrapRecords(payload: unknown): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  let current: unknown = payload;

  for (let depth = 0; depth < 6; depth += 1) {
    if (!isRecord(current)) break;

    records.push(current);

    const finding = extractFindingRecord(current);
    if (finding && finding !== current) {
      records.push(finding);
    }

    let next: unknown = null;
    for (const key of WRAPPER_KEYS) {
      const nested = current[key];
      if (nested != null) {
        next = nested;
        break;
      }
    }

    if (next == null) break;
    current = next;
  }

  return records;
}

function readIncomingStatement(
  record: Record<string, unknown>,
  fallbackStatement?: string
): string {
  const direct = readString(
    record,
    "incomingStatement",
    "incoming_statement",
    "statement",
    "incoming"
  );
  if (direct) return direct;

  if (fallbackStatement?.trim()) return fallbackStatement.trim();

  const redundantGrants = readGrantRefs(
    record,
    "redundantGrants",
    "redundant_grants",
    "redundantGrant",
    "redundant_grant"
  );
  if (redundantGrants[0]?.fullText) return redundantGrants[0].fullText;

  return "—";
}

function readReasonAsVerdicts(record: Record<string, unknown>): string[] {
  const reason = record.reason;
  if (typeof reason === "string" && reason.trim()) {
    return [reason.trim()];
  }
  if (Array.isArray(reason)) {
    return reason
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (typeof item === "number" && Number.isFinite(item)) return String(item);
        return "";
      })
      .filter(Boolean);
  }
  return readStringArray(record, "verdicts", "verdict", "verdict_list", "verdictList");
}

function parseCoveredByRows(record: Record<string, unknown>): PolicyIncomingSimulationConflictRow[] {
  const coveredBy = record.coveredBy ?? record.covered_by;
  if (!Array.isArray(coveredBy)) return [];

  const category = readString(record, "type", "category", "findingType", "finding_type") || "COVERED_BY";

  return coveredBy
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const policy =
        readString(item, "policyName", "policy_name", "policy") || "—";
      const fullText =
        readString(item, "raw", "fullText", "full_text", "statement", "text") ||
        "—";
      const statementId =
        readString(item, "ref", "statementId", "statement_id", "id") ||
        String(index);
      if (policy === "—" && fullText === "—") return null;
      return {
        category,
        policy,
        statementId,
        fullText,
      };
    })
    .filter((item): item is PolicyIncomingSimulationConflictRow => item !== null);
}

function normalizeFindingRecord(
  record: Record<string, unknown>,
  fallbackStatement?: string
): PolicyIncomingSimulationResult {
  return {
    incomingStatement: readIncomingStatement(record, fallbackStatement),
    verdicts: readReasonAsVerdicts(record),
    recommendation:
      readString(record, "suggestedAction", "suggested_action", "recommendation") ||
      "—",
    exactDuplicates: readGrantRefs(record, "exactDuplicates", "exact_duplicates", "duplicates"),
    coveredByHigherVerb: readGrantRefs(
      record,
      "coveredByHigherVerb",
      "covered_by_higher_verb"
    ),
    coveredByScope: readGrantRefs(record, "coveredByScope", "covered_by_scope"),
    makesVerbRedundant: readGrantRefs(
      record,
      "makesVerbRedundant",
      "makes_verb_redundant"
    ),
    makesScopeRedundant: readGrantRefs(
      record,
      "makesScopeRedundant",
      "makes_scope_redundant"
    ),
  };
}

function hasLegacySimulationFields(record: Record<string, unknown>): boolean {
  return Boolean(
    readString(record, "incomingStatement", "incoming_statement") ||
      readReasonAsVerdicts(record).length > 0 ||
      readString(record, "suggestedAction", "suggested_action", "recommendation") ||
      parseCoveredByRows(record).length > 0
  );
}

function normalizeLegacySimulationRecord(
  record: Record<string, unknown>,
  fallbackStatement?: string
): PolicyIncomingSimulationResult {
  return {
    incomingStatement: readIncomingStatement(record, fallbackStatement),
    verdicts: readReasonAsVerdicts(record),
    recommendation:
      readString(record, "suggestedAction", "suggested_action", "recommendation") ||
      "—",
    exactDuplicates: readGrantRefs(
      record,
      "exactDuplicates",
      "exact_duplicates",
      "exactDuplicate",
      "exact_duplicate",
      "duplicates"
    ),
    coveredByHigherVerb: readGrantRefs(
      record,
      "coveredByHigherVerb",
      "covered_by_higher_verb"
    ),
    coveredByScope: readGrantRefs(record, "coveredByScope", "covered_by_scope"),
    makesVerbRedundant: readGrantRefs(
      record,
      "makesVerbRedundant",
      "makes_verb_redundant"
    ),
    makesScopeRedundant: readGrantRefs(
      record,
      "makesScopeRedundant",
      "makes_scope_redundant"
    ),
  };
}

export function parsePolicyRecommendationResponse(
  payload: unknown,
  fallbackStatement?: string
): PolicyIncomingSimulationResult | null {
  if (payload == null || payload === "") return null;

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return null;
    try {
      return parsePolicyRecommendationResponse(JSON.parse(trimmed) as unknown, fallbackStatement);
    } catch {
      return {
        incomingStatement: trimmed,
        verdicts: [],
        recommendation: "—",
        exactDuplicates: [],
        coveredByHigherVerb: [],
        coveredByScope: [],
        makesVerbRedundant: [],
        makesScopeRedundant: [],
      };
    }
  }

  for (const record of unwrapRecords(payload)) {
    const finding = extractFindingRecord(record);
    if (finding) {
      return normalizeFindingRecord(finding, fallbackStatement);
    }
    if (hasLegacySimulationFields(record)) {
      return normalizeLegacySimulationRecord(record, fallbackStatement);
    }
  }

  return null;
}

export function readPolicyRecommendationConflictRows(
  payload: unknown
): PolicyIncomingSimulationConflictRow[] {
  for (const record of unwrapRecords(payload)) {
    const finding = extractFindingRecord(record) ?? record;
    const coveredByRows = parseCoveredByRows(finding);
    if (coveredByRows.length > 0) return coveredByRows;
  }

  const parsed = parsePolicyRecommendationResponse(payload);
  if (!parsed) return [];

  return [
    ...(parsed.exactDuplicates ?? []).map((item) => ({
      category: "EXACT_DUPLICATE",
      policy: item.policy,
      statementId: item.statementId,
      fullText: item.fullText,
    })),
    ...(parsed.coveredByHigherVerb ?? []).map((item) => ({
      category: "COVERED_BY_HIGHER_VERB",
      policy: item.policy,
      statementId: item.statementId,
      fullText: item.fullText,
    })),
    ...(parsed.coveredByScope ?? []).map((item) => ({
      category: "COVERED_BY_SCOPE",
      policy: item.policy,
      statementId: item.statementId,
      fullText: item.fullText,
    })),
    ...(parsed.makesVerbRedundant ?? []).map((item) => ({
      category: "MAKES_VERB_REDUNDANT",
      policy: item.policy,
      statementId: item.statementId,
      fullText: item.fullText,
    })),
    ...(parsed.makesScopeRedundant ?? []).map((item) => ({
      category: "MAKES_SCOPE_REDUNDANT",
      policy: item.policy,
      statementId: item.statementId,
      fullText: item.fullText,
    })),
  ];
}

export async function fetchPolicyRecommendation(
  input: PolicyRecommendationInput,
  bearerToken?: string | null
): Promise<unknown> {
  const policyName = input.policyName.trim();
  const statement = input.statement.trim();

  if (!policyName) {
    throw new Error("Policy name is required.");
  }
  if (!statement) {
    throw new Error("Policy statement is required.");
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const token =
    bearerToken?.trim() || process.env.POLICY_OPTIMIZATION_API_KEY?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(POLICY_RECOMMENDATION_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ policyName, statement }),
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
