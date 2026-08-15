import type {
  PolicyListAnalytics,
  PolicyListItem,
  PolicyListRisk,
  PolicyListResult,
  PolicyListStatement,
  PolicyStatementSubject,
  PolicySubjectsByKind,
} from "@/types/oci-policy";
import { extractTenancyMetadata } from "@/lib/oci-tenancy-metadata";

/** KeyForge OCI policies list endpoint (ACMECOM tenant). */
export const POLICY_LIST_API_URL =
  "https://graph.keyforge.ai/ociservice/api/v1/ACMECOM/policies";

export function isPolicyListApiConfigured(): boolean {
  return true;
}

function parseApiError(text: string, status: number, statusText: string): string {
  if (!text.trim()) {
    return `Policies API request failed (${status} ${statusText})`;
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

function readOptionalString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  return readOptionalString(record, ...keys) ?? "—";
}

function readOptionalNumber(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function readStringArray(record: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value)) continue;
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          return readOptionalString(obj, "name", "displayName", "value") ?? "";
        }
        return "";
      })
      .filter(Boolean);
  }
  return [];
}

function normalizePolicyStatus(raw: string): string {
  const value = raw.trim();
  if (!value || value === "—") return "Active";
  const lower = value.toLowerCase();
  if (lower === "active" || lower === "enabled") return "Active";
  if (lower === "inactive" || lower === "disabled") return "Inactive";
  if (lower === "deleted") return "Deleted";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function readOracleTags(record: Record<string, unknown>): Record<string, unknown> | null {
  const definedTags = record.definedTags ?? record.defined_tags;
  if (!definedTags || typeof definedTags !== "object" || Array.isArray(definedTags)) {
    return null;
  }

  const tagNamespaces = definedTags as Record<string, unknown>;
  const oracleTags = tagNamespaces["Oracle-Tags"] ?? tagNamespaces.OracleTags;
  if (!oracleTags || typeof oracleTags !== "object" || Array.isArray(oracleTags)) {
    return null;
  }

  return oracleTags as Record<string, unknown>;
}

function formatOracleCreatedBy(raw: string): string {
  return raw.trim().replace(/^default\//i, "");
}

function readOracleTagCreatedBy(record: Record<string, unknown>): string | undefined {
  const oracleTags = readOracleTags(record);
  if (!oracleTags) return undefined;
  const createdBy = readOptionalString(oracleTags, "CreatedBy", "createdBy", "created_by");
  return createdBy ? formatOracleCreatedBy(createdBy) : undefined;
}

function readOracleTagCreatedOn(record: Record<string, unknown>): string | undefined {
  const oracleTags = readOracleTags(record);
  if (!oracleTags) return undefined;
  return readOptionalString(oracleTags, "CreatedOn", "createdOn", "created_on");
}

function normalizeRisk(
  raw: string | undefined,
  highCount: number,
  mediumCount: number
): PolicyListRisk {
  const normalized = raw?.trim();
  if (normalized === "High" || normalized === "Medium" || normalized === "Low") {
    return normalized;
  }
  if (highCount > 0) return "High";
  if (mediumCount > 0) return "Medium";
  return "Low";
}

function isPolicyLikeRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Boolean(
    readOptionalString(record, "name", "policyName", "policy_name") ||
      Array.isArray(record.statements) ||
      readOptionalString(
        record,
        "raw",
        "statement",
        "statementText",
        "statement_text",
        "policyStatement"
      )
  );
}

function normalizePolicyMap(value: Record<string, unknown>): unknown[] {
  return Object.entries(value).map(([key, item]) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const policy = { ...(item as Record<string, unknown>) };
    if (!readOptionalString(policy, "name", "policyName", "policy_name")) {
      policy.name = key;
    }
    return policy;
  });
}

function extractPoliciesArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  for (const key of ["policies", "data", "items", "results", "rows"]) {
    const value = record[key];
    if (Array.isArray(value) && value.length > 0) return value;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const mapped = normalizePolicyMap(value as Record<string, unknown>);
      if (mapped.length > 0) return mapped;
    }
  }

  const policyLikeEntries = Object.entries(record).filter(([, value]) =>
    isPolicyLikeRecord(value)
  );
  if (policyLikeEntries.length > 0) {
    return normalizePolicyMap(Object.fromEntries(policyLikeEntries));
  }

  return [];
}

function formatStatementSubject(subject: unknown): string | undefined {
  if (typeof subject === "string" && subject.trim()) return subject.trim();
  if (!subject || typeof subject !== "object") return undefined;

  const record = subject as Record<string, unknown>;
  const name = readOptionalString(record, "name", "displayName", "value");
  const kind = readOptionalString(record, "kind", "type");

  if (!name) return undefined;
  if (kind === "GROUP" || kind === "group") return name;
  if (kind === "SERVICE" || kind === "service") return `service ${name}`;
  if (kind === "UNKNOWN" || !kind) return name;
  return `${kind}: ${name}`;
}

function parseStatementSubjects(record: Record<string, unknown>): PolicyStatementSubject[] {
  const subjects: PolicyStatementSubject[] = [];

  const pushSubject = (kind: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    subjects.push({ kind: kind.trim() || "UNKNOWN", name: trimmed });
  };

  const rawSubjects = record.subjects;
  if (Array.isArray(rawSubjects)) {
    for (const item of rawSubjects) {
      if (typeof item === "string") {
        pushSubject("UNKNOWN", item);
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const subjectRecord = item as Record<string, unknown>;
      const name = readOptionalString(subjectRecord, "name", "displayName", "value");
      const kind = readOptionalString(subjectRecord, "kind", "type") ?? "UNKNOWN";
      if (name) pushSubject(kind, name);
    }
  }

  if (subjects.length === 0) {
    const single = record.subject ?? record.group;
    if (typeof single === "string" && single.trim()) {
      pushSubject("UNKNOWN", single);
    } else if (single && typeof single === "object") {
      const subjectRecord = single as Record<string, unknown>;
      const name = readOptionalString(subjectRecord, "name", "displayName", "value");
      const kind = readOptionalString(subjectRecord, "kind", "type") ?? "UNKNOWN";
      if (name) pushSubject(kind, name);
    } else {
      const fallbackName = readOptionalString(
        record,
        "groupName",
        "group",
        "group_name",
        "subjectName"
      );
      if (fallbackName) pushSubject("UNKNOWN", fallbackName);
    }
  }

  return subjects;
}

function parseStatementStructuredFields(
  record: Record<string, unknown>
): Pick<
  PolicyListStatement,
  "type" | "subjects" | "verb" | "resource" | "compartmentName" | "condition"
> {
  const subjects = parseStatementSubjects(record);
  const type = readOptionalString(record, "type", "keyword", "effect", "permissionType");
  const verb = readOptionalString(record, "verb", "action", "permission");
  const resource = readOptionalString(
    record,
    "resource",
    "resourceType",
    "resource_type",
    "resourceFamily"
  );

  let compartmentName = readOptionalString(
    record,
    "compartmentName",
    "compartment_name",
    "scope"
  );
  const compartmentValue = record.compartment;
  if (!compartmentName && typeof compartmentValue === "string") {
    compartmentName = compartmentValue.trim();
  } else if (!compartmentName && compartmentValue && typeof compartmentValue === "object") {
    compartmentName = readOptionalString(
      compartmentValue as Record<string, unknown>,
      "name",
      "compartmentName",
      "scope"
    );
  }

  const condition =
    readOptionalString(record, "condition", "whereClause", "where") ?? null;

  return { type, subjects, verb, resource, compartmentName, condition };
}

function buildStatementTextFromParts(record: Record<string, unknown>): string | undefined {
  const structured = parseStatementStructuredFields(record);
  const subject =
    structured.subjects?.map((item) => subjectDisplayName(item)).join(", ") ??
    formatStatementSubject(record.subject) ??
    readOptionalString(record, "groupName", "group", "group_name", "subjectName");
  const verb = structured.verb;
  const resource = structured.resource;
  const compartment = structured.compartmentName;
  const condition = structured.condition ?? undefined;

  if (!subject && !verb && !resource) return undefined;

  const keyword = structured.type?.toLowerCase() ?? "allow";
  const parts = [keyword, subject, "to", verb, resource].filter(Boolean);
  let text = parts.join(" ");
  if (compartment) text += ` in ${compartment}`;
  if (condition) text += ` where ${condition}`;
  return text.trim() || undefined;
}

function subjectDisplayName(subject: PolicyStatementSubject): string {
  const kind = subject.kind.trim().toUpperCase();
  const name = subject.name.trim();
  if (!name) return "—";
  if (kind === "SERVICE") return `service ${name}`;
  if (kind === "DYNAMIC_GROUP") return `dynamic-group ${name}`;
  if (kind === "GROUP") return name;
  if (kind === "UNKNOWN" || !kind) return name;
  return `${subject.kind}: ${name}`;
}

function extractStatementsArray(record: Record<string, unknown>): unknown[] {
  for (const key of [
    "statements",
    "policyStatements",
    "policy_statements",
    "statementList",
    "statement_list",
    "hasStatements",
  ]) {
    const value = record[key];
    if (Array.isArray(value)) {
      if (value.length > 0) return value;
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const values = Object.values(value as Record<string, unknown>);
      if (values.length > 0) return values;
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      return value
        .split(/\r?\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
    }
  }

  const versions = record.versions;
  if (Array.isArray(versions)) {
    for (const version of versions) {
      if (!version || typeof version !== "object") continue;
      const nested = extractStatementsArray(version as Record<string, unknown>);
      if (nested.length > 0) return nested;
    }
  }

  const single = readOptionalString(
    record,
    "raw",
    "rawStatement",
    "raw_statement",
    "statement",
    "policyStatement",
    "statementText",
    "statement_text",
    "iamStatement",
    "text"
  );
  return single ? [single] : [];
}

function parseStatementItem(item: unknown, index: number): PolicyListStatement | null {
  if (typeof item === "string") {
    const text = item.trim();
    if (!text) return null;
    return { id: `stmt-${index}`, ref: `#${index}`, text };
  }

  if (!item || typeof item !== "object") return null;

  const record = item as Record<string, unknown>;
  const text =
    readOptionalString(
      record,
      "raw",
      "rawStatement",
      "raw_statement",
      "text",
      "statement",
      "statement_text",
      "statementText",
      "fullText",
      "statementBody",
      "iamStatement",
      "policyStatement",
      "content",
      "body",
      "value"
    ) ?? buildStatementTextFromParts(record);

  if (!text) return null;

  const id =
    readOptionalString(record, "id", "statementId", "statement_id") ?? `stmt-${index}`;
  const ref =
    readOptionalString(
      record,
      "ref",
      "statementRef",
      "statement_ref",
      "statementId",
      "statement_id",
      "index",
      "label"
    ) ?? String(index);

  const structured = parseStatementStructuredFields(record);

  return {
    id,
    ref,
    text,
    ...structured,
  };
}

function parseStatements(record: Record<string, unknown>): PolicyListStatement[] {
  const seen = new Set<string>();
  const statements: PolicyListStatement[] = [];

  for (const item of extractStatementsArray(record)) {
    const parsed = parseStatementItem(item, statements.length);
    if (!parsed) continue;
    const key = `${parsed.ref ?? ""}:${parsed.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    statements.push(parsed);
  }

  return statements;
}

function dedupeStatements(statements: PolicyListStatement[]): PolicyListStatement[] {
  const seen = new Set<string>();
  return statements.filter((statement) => {
    const key = `${statement.ref ?? ""}:${statement.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergePoliciesByName(policies: PolicyListItem[]): PolicyListItem[] {
  const byName = new Map<string, PolicyListItem>();

  for (const policy of policies) {
    const existing = byName.get(policy.name);
    if (!existing) {
      byName.set(policy.name, {
        ...policy,
        statements: dedupeStatements(policy.statements ?? []),
      });
      continue;
    }

    const mergedStatements = dedupeStatements([
      ...(existing.statements ?? []),
      ...(policy.statements ?? []),
    ]);

    byName.set(policy.name, {
      ...existing,
      uid: existing.uid ?? policy.uid,
      description: existing.description !== "—" ? existing.description : policy.description,
      owner: existing.owner !== "—" ? existing.owner : policy.owner,
      compartment: existing.compartment !== "—" ? existing.compartment : policy.compartment,
      compartmentId: existing.compartmentId ?? policy.compartmentId,
      statementCount: Math.max(
        existing.statementCount,
        policy.statementCount,
        mergedStatements.length
      ),
      statements: mergedStatements,
    });
  }

  return Array.from(byName.values());
}

function parseSubjectsByKind(value: unknown): PolicySubjectsByKind {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    DYNAMIC_GROUP: readOptionalNumber(record, "DYNAMIC_GROUP") ?? 0,
    GROUP: readOptionalNumber(record, "GROUP") ?? 0,
    SERVICE: readOptionalNumber(record, "SERVICE") ?? 0,
    UNKNOWN: readOptionalNumber(record, "UNKNOWN") ?? 0,
  };
}

function parsePolicyAnalytics(record: Record<string, unknown> | null): PolicyListAnalytics | null {
  const raw = record?.analytics;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const analytics = raw as Record<string, unknown>;

  return {
    totalPolicies: readOptionalNumber(analytics, "totalPolicies") ?? 0,
    totalStatements: readOptionalNumber(analytics, "totalStatements") ?? 0,
    distinctSubjects: readOptionalNumber(analytics, "distinctSubjects") ?? 0,
    subjectsByKind: parseSubjectsByKind(analytics.subjectsByKind),
    distinctCompartments: readOptionalNumber(analytics, "distinctCompartments") ?? 0,
    distinctResources: readOptionalNumber(analytics, "distinctResources") ?? 0,
    conditionalPolicies: readOptionalNumber(analytics, "conditionalPolicies") ?? 0,
    conditionalStatements: readOptionalNumber(analytics, "conditionalStatements") ?? 0,
    unparsableStatements: readOptionalNumber(analytics, "unparsableStatements") ?? 0,
    highRiskStatements:
      readOptionalNumber(
        analytics,
        "highRiskStatements",
        "high_risk_statements",
        "highRiskStatementCount"
      ) ?? 0,
    totalTags: readOptionalNumber(analytics, "totalTags", "total_tags") ?? 0,
  };
}

function parsePolicyRecord(item: unknown, index: number): PolicyListItem | null {
  if (!item || typeof item !== "object") return null;

  const record = item as Record<string, unknown>;
  const name = readString(record, "name", "policyName", "policy_name", "displayName");
  if (!name || name === "—") return null;

  const statements = parseStatements(record);
  const statementCount = Math.max(
    readOptionalNumber(record, "statementCount", "statement_count", "statementsCount") ?? 0,
    statements.length
  );

  const highCount =
    readOptionalNumber(record, "highCount", "high_count", "highFindings", "high") ?? 0;
  const mediumCount =
    readOptionalNumber(record, "mediumCount", "medium_count", "mediumFindings", "medium") ?? 0;
  const lowCount =
    readOptionalNumber(record, "lowCount", "low_count", "lowFindings", "low") ?? 0;

  const groups = readStringArray(record, "groups", "groupNames", "group_names");
  const compartments = readStringArray(
    record,
    "compartments",
    "compartmentNames",
    "compartment_names"
  );
  const compartment =
    readString(record, "compartment", "compartmentName", "compartment_name") !== "—"
      ? readString(record, "compartment", "compartmentName", "compartment_name")
      : compartments[0] || "—";

  const statusRaw = readOptionalString(
    record,
    "status",
    "lifecycleState",
    "lifecycle_state",
    "state"
  );

  const oracleCreatedBy = readOracleTagCreatedBy(record);
  const oracleCreatedOn = readOracleTagCreatedOn(record);

  const uid =
    readOptionalString(
      record,
      "uid",
      "policyUid",
      "policy_uid",
      "ocid",
      "policyId",
      "policy_id",
      "id"
    ) ?? null;

  const compartmentId =
    readOptionalString(
      record,
      "compartmentId",
      "compartment_id",
      "compartmentOcid",
      "compartment_ocid"
    ) ?? null;

  return {
    uid,
    name,
    description: readString(record, "description", "policyDescription", "policy_description"),
    owner: readString(record, "owner", "createdBy", "created_by"),
    createdOn:
      readOptionalString(record, "createdOn", "created_on", "timeCreated", "time_created") ??
      oracleCreatedOn ??
      null,
    createdBy:
      oracleCreatedBy ?? readString(record, "createdBy", "created_by", "owner"),
    lastModified:
      readOptionalString(
        record,
        "lastModified",
        "last_modified",
        "timeUpdated",
        "time_updated",
        "updatedOn"
      ) ?? null,
    lastSync:
      readOptionalString(record, "lastSync", "last_sync", "lastSyncedOn", "last_synced_on") ??
      null,
    risk: normalizeRisk(readOptionalString(record, "risk"), highCount, mediumCount),
    status: normalizePolicyStatus(statusRaw ?? ""),
    compartment,
    compartmentId,
    groups,
    compartments,
    statementCount,
    highCount,
    mediumCount,
    lowCount,
    statements,
  };
}

export function buildPolicyListUrl(tenancyId?: string | null): string {
  const url = new URL(POLICY_LIST_API_URL);
  const id = tenancyId?.trim();
  if (id) url.searchParams.set("tenancyId", id);
  return url.toString();
}

export function parsePolicyListResponse(payload: unknown): PolicyListResult {
  if (!payload || (typeof payload !== "object" && !Array.isArray(payload))) {
    throw new Error("Policies API returned an unexpected response");
  }

  const record =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;

  const tenancyMeta = extractTenancyMetadata(payload);

  const policies = mergePoliciesByName(
    extractPoliciesArray(payload)
      .map((item, index) => parsePolicyRecord(item, index))
      .filter((item): item is PolicyListItem => item !== null)
  );

  return {
    policies,
    tenancyId: tenancyMeta.tenancyId,
    tenancyName: tenancyMeta.tenancyName,
    tenancies: tenancyMeta.tenancies,
    analytics: record ? parsePolicyAnalytics(record) : null,
  };
}

export async function fetchPolicyList(
  bearerToken?: string | null,
  tenancyId?: string | null
): Promise<PolicyListResult> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const token =
    bearerToken?.trim() || process.env.POLICY_OPTIMIZATION_API_KEY?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(buildPolicyListUrl(tenancyId), {
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
  return parsePolicyListResponse(payload);
}
