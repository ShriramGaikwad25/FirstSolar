import type { OciTenancy } from "@/types/oci-policy";
import { getActiveTenantId } from "@/lib/tenant";

const OCI_SERVICE_BASE = "https://graph.keyforge.ai/ociservice/api/v1";

export function ociTenanciesApiUrl(): string {
  const registeredApp = getActiveTenantId() ?? "ACMECOM";
  return `${OCI_SERVICE_BASE}/${registeredApp}/tenancies`;
}

function readOptionalString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseOciTenancy(value: unknown): OciTenancy | null {
  if (!isRecord(value)) return null;

  const id =
    readOptionalString(value, "id", "tenancyId", "tenancy_id", "ocid", "tenancyOcid") ?? "";
  const name =
    readOptionalString(value, "name", "tenancyName", "tenancy_name", "displayName") ?? "";
  const label = readOptionalString(value, "label") ?? (name || id);

  if (!id && !name) return null;

  return {
    id: id || name,
    name: name || id,
    label: label || name || id,
  };
}

export function parseOciTenanciesResponse(payload: unknown): {
  tenancies: OciTenancy[];
  activeTenancyId: string | null;
} {
  if (Array.isArray(payload)) {
    return {
      tenancies: payload.map(parseOciTenancy).filter((item): item is OciTenancy => item !== null),
      activeTenancyId: null,
    };
  }

  if (!isRecord(payload)) {
    return { tenancies: [], activeTenancyId: null };
  }

  const nested = payload.tenancies ?? payload.items ?? payload.data ?? payload.results;
  const tenancies = Array.isArray(nested)
    ? nested.map(parseOciTenancy).filter((item): item is OciTenancy => item !== null)
    : [];

  const activeTenancyId =
    readOptionalString(payload, "activeTenancyId", "active_tenancy_id", "tenancyId", "tenancy_id") ??
    null;

  return { tenancies, activeTenancyId };
}

function parseApiError(text: string, status: number, statusText: string): string {
  if (!text.trim()) {
    return `Tenancies API request failed (${status} ${statusText})`;
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

export async function fetchOciTenancies(
  bearerToken?: string | null
): Promise<{ tenancies: OciTenancy[]; activeTenancyId: string | null }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const token = bearerToken?.trim() || process.env.POLICY_OPTIMIZATION_API_KEY?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(ociTenanciesApiUrl(), {
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
  return parseOciTenanciesResponse(payload);
}
