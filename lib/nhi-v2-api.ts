/**
 * NHI v2 API helpers — aligned with kf-nhi-ui `src/api/client.js`.
 * Always targets ACMECOM tenant slug (same as NHI_V2 VITE_TENANT_SLUG).
 */
import { apiRequestWithAuth } from "@/lib/auth";

export const NHI_V2_TENANT_SLUG = "ACMECOM";
export const NHI_V2_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

const NHI_V2_EXECUTE_QUERY_URL = `https://preview.keyforge.ai/entities/api/v1/${NHI_V2_TENANT_SLUG}/executeQuery`;

export type NhiV2QueryResult = {
  rows: Record<string, unknown>[];
  raw: unknown;
};

function normaliseRows(body: unknown): Record<string, unknown>[] {
  if (body == null) return [];
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (typeof body !== "object") return [];

  const o = body as Record<string, unknown>;
  for (const k of ["resultSet", "rows", "records", "items", "result", "results", "data"]) {
    if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
  }

  if (o.data && typeof o.data === "object" && !Array.isArray(o.data)) {
    const d = o.data as Record<string, unknown>;
    for (const k of ["resultSet", "rows", "records", "items", "result", "results", "data"]) {
      if (Array.isArray(d[k])) return d[k] as Record<string, unknown>[];
    }
    if (o.status === "success") {
      return Array.isArray(o.data) ? (o.data as Record<string, unknown>[]) : [o.data as Record<string, unknown>];
    }
  }

  for (const v of Object.values(o)) {
    if (Array.isArray(v)) return v as Record<string, unknown>[];
    if (v && typeof v === "object") {
      for (const vv of Object.values(v as Record<string, unknown>)) {
        if (Array.isArray(vv)) return vv as Record<string, unknown>[];
      }
    }
  }

  return [o];
}

function assertNoWrapperError(body: unknown, httpStatus: number): void {
  if (!body || typeof body !== "object" || Array.isArray(body)) return;
  const o = body as Record<string, unknown>;
  const wrapperSaidError =
    o.status === "error" ||
    (typeof o.errorMessage === "string" && o.errorMessage.length > 0);
  if (wrapperSaidError) {
    const msg =
      (typeof o.errorMessage === "string" && o.errorMessage) ||
      (typeof o.message === "string" && o.message) ||
      (typeof o.error === "string" && o.error) ||
      (typeof o.detail === "string" && o.detail) ||
      `Query failed (HTTP ${httpStatus})`;
    throw new Error(msg);
  }
}

export async function nhiV2ExecuteQuery(
  query: string,
  parameters: unknown[] = []
): Promise<NhiV2QueryResult> {
  const raw = await apiRequestWithAuth<unknown>(NHI_V2_EXECUTE_QUERY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ query, parameters }),
  });
  assertNoWrapperError(raw, 200);
  return { rows: normaliseRows(raw), raw };
}

export async function nhiV2ExecuteScalar(
  query: string,
  parameters: unknown[] = []
): Promise<unknown> {
  const { rows } = await nhiV2ExecuteQuery(query, parameters);
  if (!rows.length) throw new Error("No rows returned");
  const keys = Object.keys(rows[0]);
  if (!keys.length) return null;
  const v = rows[0][keys[0]];
  if (typeof v === "string") {
    const t = v.trim();
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        return JSON.parse(t) as unknown;
      } catch {
        /* fall through */
      }
    }
  }
  return v;
}

export function getNhiV2TenantId(): string {
  return NHI_V2_TENANT_ID;
}
