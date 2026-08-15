import type { PolicyActivityEvent, PolicyActivityResult } from "@/types/oci-policy";

/** KeyForge OCI policy version/activity history endpoint (ACMECOM tenant). */
export const POLICY_ACTIVITY_API_BASE =
  "https://graph.keyforge.ai/ociservice/api/v1/ACMECOM/policy-versions";

export function buildPolicyActivityUrl(policyUid: string): string {
  return `${POLICY_ACTIVITY_API_BASE}/${encodeURIComponent(policyUid)}`;
}

function parseApiError(text: string, status: number, statusText: string): string {
  if (!text.trim()) {
    return `Policy activity request failed (${status} ${statusText})`;
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

function readString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readNumber(record: Record<string, unknown>, ...keys: string[]): number | null {
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

function extractActivityArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  for (const key of ["versions", "results", "data", "items", "events", "activity"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function describeEvent(
  changeLabel: string | null,
  versionNo: number | null,
  status: string | null
): string {
  if (changeLabel) return changeLabel;
  if (versionNo != null && status) return `Version ${versionNo} — ${status}`;
  if (versionNo != null) return `Version ${versionNo}`;
  if (status) return status;
  return "Policy activity";
}

function parseActivityEvent(item: unknown, index: number): PolicyActivityEvent | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;

  const versionNo = readNumber(record, "versionNo", "version", "versionNumber");
  const status = readString(record, "status", "lifecycleState", "state");
  const changeLabel = readString(record, "changeLabel", "change_label");

  const id =
    readString(record, "id", "versionId", "version_id") ??
    (versionNo != null ? `v-${versionNo}` : `activity-${index}`);

  return {
    id,
    event: describeEvent(changeLabel, versionNo, status),
    versionNo,
    status,
    origin: readString(record, "origin"),
    basedOnVersion: readNumber(record, "basedOnVersion", "based_on_version"),
    changedBy: readString(record, "changedBy", "changed_by", "createdBy", "created_by", "by", "owner"),
    added: readNumber(record, "added"),
    modified: readNumber(record, "modified"),
    removed: readNumber(record, "removed"),
    changeLabel,
    createdAt: readString(record, "createdAt", "created_at", "createdOn", "created_on", "timeCreated"),
    enforcedAt: readString(record, "enforcedAt", "enforced_at", "enforcedOn", "enforced_on"),
    impactStatus: readString(record, "impactStatus", "impact_status"),
    raw: item,
  };
}

export async function fetchPolicyActivity(policyUid: string): Promise<PolicyActivityResult> {
  const res = await fetch(buildPolicyActivityUrl(policyUid), {
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

  const events = extractActivityArray(payload)
    .map((item, index) => parseActivityEvent(item, index))
    .filter((event): event is PolicyActivityEvent => event !== null);

  return { events };
}
