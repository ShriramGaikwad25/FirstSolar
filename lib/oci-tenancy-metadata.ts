import type { OciTenancy } from "@/types/oci-policy";
import { parseOciTenancy } from "@/lib/oci-tenancies-api";

/** OCI tenancy display name returned by KeyForge APIs (`"name": "keyforgeai"`). */
export const DEFAULT_OCI_TENANCY_NAME = "keyforgeai";

export function defaultOciTenancy(): OciTenancy {
  return {
    id: DEFAULT_OCI_TENANCY_NAME,
    name: DEFAULT_OCI_TENANCY_NAME,
    label: DEFAULT_OCI_TENANCY_NAME,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function buildOciTenancy(
  tenancyId: string | null | undefined,
  tenancyName: string | null | undefined,
  label?: string | null
): OciTenancy | null {
  const id = tenancyId?.trim();
  const name = tenancyName?.trim();
  if (!id && !name) return null;
  const resolvedId = id ?? name!;
  const resolvedName = name ?? id!;
  const resolvedLabel = label?.trim() || resolvedName;
  return {
    id: resolvedId,
    name: resolvedName,
    label: resolvedLabel,
  };
}

function readRootTenancyName(payload: Record<string, unknown>): string | undefined {
  const name = readOptionalString(payload, "name");
  if (!name) return undefined;

  const looksLikeApiEnvelope =
    payload.policies !== undefined ||
    payload.analytics !== undefined ||
    payload.tenancyId !== undefined ||
    payload.tenancy_id !== undefined ||
    payload.tenancyName !== undefined ||
    payload.tenancy_name !== undefined ||
    payload.tenancy !== undefined ||
    payload.compartments !== undefined ||
    payload.root !== undefined ||
    payload.tree !== undefined ||
    Array.isArray(payload.tenancies);

  return looksLikeApiEnvelope ? name : undefined;
}

export function tenanciesFromFields(
  tenancyId: string | null | undefined,
  tenancyName: string | null | undefined
): OciTenancy[] {
  const tenancy = buildOciTenancy(tenancyId, tenancyName);
  return tenancy ? [tenancy] : [];
}

export function extractTenancyMetadata(payload: unknown): {
  tenancyId: string | null;
  tenancyName: string | null;
  tenancies: OciTenancy[];
} {
  if (!isRecord(payload)) {
    return { tenancyId: null, tenancyName: null, tenancies: [] };
  }

  const tenancyObject = isRecord(payload.tenancy) ? payload.tenancy : null;
  const metadata = isRecord(payload.metadata) ? payload.metadata : null;
  const analytics = isRecord(payload.analytics) ? payload.analytics : null;
  const context = isRecord(payload.context) ? payload.context : null;

  const tenancyId =
    readOptionalString(payload, "tenancyId", "tenancy_id", "activeTenancyId", "active_tenancy_id") ??
    (tenancyObject ? readOptionalString(tenancyObject, "id", "tenancyId", "ocid", "tenancyOcid") : undefined) ??
    (metadata ? readOptionalString(metadata, "tenancyId", "tenancy_id") : undefined) ??
    (context ? readOptionalString(context, "tenancyId", "tenancy_id") : undefined) ??
    null;

  const tenancyName =
    readOptionalString(payload, "tenancyName", "tenancy_name", "tenancyDisplayName", "displayName") ??
    (tenancyObject
      ? readOptionalString(tenancyObject, "name", "tenancyName", "displayName", "label")
      : undefined) ??
    (metadata ? readOptionalString(metadata, "tenancyName", "tenancy_name", "name") : undefined) ??
    (analytics ? readOptionalString(analytics, "tenancyName", "tenancy_name", "name") : undefined) ??
    (context ? readOptionalString(context, "tenancyName", "tenancy_name", "name") : undefined) ??
    readRootTenancyName(payload) ??
    null;

  const nestedTenancies =
    payload.tenancies ?? payload.items ?? payload.availableTenancies ?? payload.tenancyList;

  const parsedTenancies = Array.isArray(nestedTenancies)
    ? nestedTenancies.map(parseOciTenancy).filter((item): item is OciTenancy => item !== null)
    : [];

  const fallback = buildOciTenancy(tenancyId ?? tenancyName, tenancyName);
  const tenancies =
    parsedTenancies.length > 0
      ? parsedTenancies
      : fallback
        ? [fallback]
        : [];

  return {
    tenancyId: tenancyId ?? fallback?.id ?? null,
    tenancyName: tenancyName ?? fallback?.name ?? null,
    tenancies,
  };
}

export function mergeOciTenancies(...groups: Array<OciTenancy[] | undefined>): OciTenancy[] {
  const merged: OciTenancy[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const tenancy of group ?? []) {
      const key = tenancy.id.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(tenancy);
    }
  }

  return merged;
}
