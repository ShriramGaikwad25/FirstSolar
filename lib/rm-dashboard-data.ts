import { coerceRowObject, extractResultRows, unwrapRowJson } from "@/lib/nhi-dashboard";
import type { RmDashboardData, RmKpis, RmRuleset } from "@/types/rm-dashboard";

/**
 * `resultSet[].result` is often a stringified JSON: `{"data": ..., "success": true}` (ruleset list
 * or dashboard). Returns the inner `data` when present, otherwise the parsed cell.
 */
function parseResultCellEnvelope(cell: unknown): unknown {
  if (cell == null) return null;
  let v: unknown = cell;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v) as unknown;
    } catch {
      return null;
    }
  }
  if (v && typeof v === "object" && !Array.isArray(v) && "data" in v) {
    return (v as { data: unknown }).data;
  }
  return v;
}

/**
 * First row's `result` cell → unwrapped `data` (or direct payload for legacy shapes).
 */
export function getKfResultData(response: unknown): unknown {
  const rows = extractResultRows(response);
  if (rows.length === 0) return null;
  const o = coerceRowObject(rows[0]);
  if (!o) return null;
  const u = unwrapRowJson(o);
  return parseResultCellEnvelope(u.result);
}

function asNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pickNested(row: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  const u = unwrapRowJson(row);
  for (const k of keys) {
    const lk = k.toLowerCase();
    for (const rk of Object.keys(u)) {
      if (rk.toLowerCase() === lk) {
        const v = u[rk];
        if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
      }
    }
  }
  return null;
}

/** Merges nested dashboard blobs (same idea as NHI `normalizeDashboardRow`). */
function normalizeRmRow(row: Record<string, unknown>): Record<string, unknown> {
  const u = unwrapRowJson(row);
  const nest = pickNested(u, [
    "dashboard",
    "payload",
    "data",
    "result",
    "kf_rm_get_dashboard",
    "kf_rm_get_dashboard_v2",
    "rm_dashboard",
  ]);
  if (nest) {
    return { ...nest, ...u };
  }
  return u;
}

function toKpis(o: Record<string, unknown> | null | undefined): RmKpis {
  if (!o) {
    return { open_violations: 0, high_severity_open: 0, mitigated: 0, unique_users: 0 };
  }
  return {
    open_violations: asNum(
      o.open_violations ?? o.openViolations
    ),
    high_severity_open: asNum(
      o.high_severity_open ?? o.highSeverityOpen
    ),
    mitigated: asNum(o.mitigated),
    unique_users: asNum(
      o.unique_users ?? o.uniqueUsers
    ),
  };
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/**
 * Map `executeQuery` resultSet (with `result` string → `{ data: { kpis, … } }`) to the chart/table shape.
 */
export function mapExecuteQueryToDashboard(response: unknown): RmDashboardData {
  const payload = getKfResultData(response);
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return emptyDashboard();
  }
  const d = normalizeRmRow(payload as Record<string, unknown>);
  const nestedKpis = pickNested(d, ["kpis", "kpi"]);
  const kpiSource =
    nestedKpis ||
    (d.kpis && typeof d.kpis === "object" && !Array.isArray(d.kpis)
      ? (d.kpis as Record<string, unknown>)
      : d);

  return {
    kpis: toKpis(kpiSource),
    by_severity: asArray(d.by_severity),
    by_status: asArray(d.by_status),
    by_system: asArray(d.by_system),
    top_risky_users: asArray(d.top_risky_users),
    recent_runs: asArray(d.recent_runs),
  };
}

function emptyDashboard(): RmDashboardData {
  return {
    kpis: toKpis(null),
    by_severity: [],
    by_status: [],
    by_system: [],
    top_risky_users: [],
    recent_runs: [],
  };
}

function mapOneRuleset(r: Record<string, unknown>): RmRuleset | null {
  const idRaw = r.ruleset_id ?? r.rulesetid ?? r.id;
  const ruleset_id = asNum(idRaw, NaN);
  if (!Number.isFinite(ruleset_id)) return null;
  const ar = r.active_rule_count ?? r.activeRuleCount ?? r.rule_count;
  return {
    ruleset_id,
    ruleset_name: (r.ruleset_name ?? r.rulesetname ?? r.name ?? null) as string | null,
    ruleset_code: (r.ruleset_code ?? r.rulesetcode ?? r.code ?? null) as string | null,
    status: (r.status ?? r.ruleset_status ?? r.rulesetStatus ?? null) as string | null,
    active_rule_count:
      ar !== undefined && ar !== null ? asNum(ar, 0) : undefined,
  };
}

/**
 * Unwraps `result` → `{ data: RmRuleset[], success, pagination }` or a raw array/rows (legacy).
 */
export function mapExecuteQueryToRulesets(response: unknown): RmRuleset[] {
  const data = getKfResultData(response);
  if (data == null) return [];
  if (Array.isArray(data)) {
    return data
      .map((item) => {
        const row = coerceRowObject(item);
        if (!row) return null;
        return mapOneRuleset(unwrapRowJson(row));
      })
      .filter((m): m is RmRuleset => m != null);
  }
  // legacy: one row = one ruleset, or pre-parsed `result` array without envelope
  const rows = extractResultRows(response);
  const out: RmRuleset[] = [];
  for (const r of rows) {
    const o = coerceRowObject(r);
    if (!o) continue;
    const u = unwrapRowJson(o);
    const res = u.result;
    if (Array.isArray(res)) {
      for (const item of res) {
        const row = coerceRowObject(item);
        if (row) {
          const m = mapOneRuleset(unwrapRowJson(row));
          if (m) out.push(m);
        }
      }
      continue;
    }
    const m = mapOneRuleset(u);
    if (m) out.push(m);
  }
  return out;
}
