/**
 * Unified query runner for NHI pages — legacy ispm tenant vs fixed ACMECOM (NHI_V2).
 */
import { executeQuery } from "@/lib/api";
import { extractResultRows } from "@/lib/nhi-dashboard";
import { nhiV2ExecuteQuery, nhiV2ExecuteScalar } from "@/lib/nhi-v2-api";

export type NhiApiMode = "legacy" | "v2";

export async function runNhiQueryRaw(
  mode: NhiApiMode,
  query: string,
  parameters: unknown[] = []
): Promise<unknown> {
  if (mode === "v2") {
    const { raw } = await nhiV2ExecuteQuery(query, parameters);
    return raw;
  }
  return executeQuery<unknown>(query, parameters);
}

export async function runNhiRows(
  mode: NhiApiMode,
  query: string,
  parameters: unknown[] = []
): Promise<Record<string, unknown>[]> {
  const raw = await runNhiQueryRaw(mode, query, parameters);
  return extractResultRows(raw) as Record<string, unknown>[];
}

export async function runNhiScalar(
  mode: NhiApiMode,
  query: string,
  parameters: unknown[] = []
): Promise<unknown> {
  if (mode === "v2") {
    return nhiV2ExecuteScalar(query, parameters);
  }
  const rows = await runNhiRows(mode, query, parameters);
  if (!rows.length) return null;
  const key = Object.keys(rows[0])[0];
  return key ? rows[0][key] : null;
}
