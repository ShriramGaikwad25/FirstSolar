/**
 * Normalizes rows from executeQuery / kf_nhi_get_dashboard() for chart components.
 * Supports several common column names and JSON shapes from PostgreSQL.
 */

import { CHART_RISK_LEVEL_COLORS, CHART_SERIES_COLORS } from "./chart-colors";

export type TypeSlice = { label: string; value: number };

export type StackedLifecycle = {
  labels: string[];
  datasets: { label: string; data: number[]; backgroundColor?: string }[];
};

export type RiskBar = { label: string; value: number; color: string };

function riskColor(label: string): string {
  const k = label.trim().toLowerCase();
  if (k in CHART_RISK_LEVEL_COLORS) return CHART_RISK_LEVEL_COLORS[k];
  if (k.includes("critical")) return CHART_RISK_LEVEL_COLORS.critical;
  if (k.includes("high")) return CHART_RISK_LEVEL_COLORS.high;
  if (k.includes("medium")) return CHART_RISK_LEVEL_COLORS.medium;
  if (k.includes("low")) return CHART_RISK_LEVEL_COLORS.low;
  return CHART_RISK_LEVEL_COLORS.unknown;
}

/** Display names for chart axis + legend (matches API keys like `critical`, `high`, …) */
function riskLevelLegendLabel(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (k.includes("critical")) return "Critical Risk";
  if (k.includes("high")) return "High Risk";
  if (k.includes("medium")) return "Medium Risk";
  if (k.includes("low")) return "Low Risk";
  return formatSnakeLabel(raw);
}

function arrayFromContainer(o: Record<string, unknown>): Record<string, unknown>[] | null {
  for (const key of ["resultSet", "rows", "items", "data", "records"]) {
    const v = o[key];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
  }
  return null;
}

export function extractResultRows(response: unknown): Record<string, unknown>[] {
  if (Array.isArray(response)) return response as Record<string, unknown>[];
  if (response && typeof response === "object") {
    const o = response as Record<string, unknown>;
    const direct = arrayFromContainer(o);
    if (direct) return direct;
    // e.g. { data: { resultSet: [...] } } or { body: { rows: [...] } }
    for (const wrap of ["data", "body", "payload", "result"]) {
      const inner = o[wrap];
      if (inner && typeof inner === "object" && !Array.isArray(inner)) {
        const nested = arrayFromContainer(inner as Record<string, unknown>);
        if (nested) return nested;
      }
    }
  }
  return [];
}

/** If the API returns one JSON string row instead of an object */
export function coerceRowObject(row: unknown): Record<string, unknown> | null {
  if (row && typeof row === "object" && !Array.isArray(row)) {
    return row as Record<string, unknown>;
  }
  if (typeof row === "string") {
    try {
      const p = JSON.parse(row) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function parseMaybeJson<T = unknown>(v: unknown): T | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const t = v.trim();
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try {
        return JSON.parse(t) as T;
      } catch {
        return undefined;
      }
    }
  }
  return v as T;
}

/** Unwrap JSON string columns on a row */
export function unwrapRowJson(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const k of Object.keys(out)) {
    const parsed = parseMaybeJson(out[k]);
    if (parsed !== undefined && typeof parsed === "object") {
      out[k] = parsed as unknown;
    }
  }
  return out;
}

/** Merge nested dashboard JSON (`dashboard`, `payload`, `data`, `result`) into the row for lookups */
export function normalizeDashboardRow(row: Record<string, unknown>): Record<string, unknown> {
  const u = unwrapRowJson(row);
  const nest = pickField(u, [
    "dashboard",
    "payload",
    "data",
    "result",
    "kf_nhi_get_dashboard",
    "kf_nhi_get_dashboard_v2",
    "kf_nhi_get_agent_dashboard",
  ]);
  if (nest && typeof nest === "object" && !Array.isArray(nest)) {
    return { ...(nest as Record<string, unknown>), ...u };
  }
  return u;
}

function pickField(row: Record<string, unknown>, names: string[]): unknown {
  const keys = Object.keys(row);
  const lower = new Map(keys.map((k) => [k.toLowerCase(), row[k]]));
  for (const n of names) {
    const v = lower.get(n.toLowerCase());
    if (v !== undefined) return v;
  }
  return undefined;
}

function formatSnakeLabel(s: string): string {
  return s
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Rows from `kf_nhi_get_dashboard().nhi_summary` */
function getNhiSummary(row: Record<string, unknown>): Record<string, unknown>[] | null {
  const raw = pickField(row, ["nhi_summary"]);
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rows = raw.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object");
  return rows.length ? rows : null;
}

/** Stack NHIs by lifecycle `state`, one series per `nhi_type` (sums `nhi_count`) */
function pivotNhiSummaryLifecycle(summary: Record<string, unknown>[]): StackedLifecycle | null {
  const states = [...new Set(summary.map((r) => String(r.state ?? "unknown")))].sort();
  const types = [...new Set(summary.map((r) => String(r.nhi_type ?? "unknown")))].sort();
  if (!states.length || !types.length) return null;

  const stateIdx = new Map(states.map((s, i) => [s, i]));
  const matrix = new Map<string, number[]>();
  for (const t of types) {
    matrix.set(t, states.map(() => 0));
  }
  for (const r of summary) {
    const state = String(r.state ?? "unknown");
    const type = String(r.nhi_type ?? "unknown");
    const n = Number(r.nhi_count ?? 0) || 0;
    const si = stateIdx.get(state);
    if (si === undefined) continue;
    const arr = matrix.get(type);
    if (arr) arr[si] += n;
  }

  const datasets = types.map((t) => ({
    label: formatSnakeLabel(t),
    data: matrix.get(t)!,
  }));

  return {
    labels: states.map((s) => formatSnakeLabel(s)),
    datasets,
  };
}

/** Aggregate secret_health[] into a 0–100 score from totals vs risk signals */
function computeSecretHealthScoreFromRows(rows: Record<string, unknown>[]): number {
  let totalSecrets = 0;
  let issueWeight = 0;
  for (const r of rows) {
    const ts = Number(r.total_secrets ?? 0) || 0;
    totalSecrets += ts;
    const expired = Number(r.expired_count ?? 0) || 0;
    const expiring = Number(r.expiring_soon_count ?? 0) || 0;
    const overdue = Number(r.rotation_overdue_count ?? 0) || 0;
    const noPolicy = Number(r.no_rotation_policy_count ?? 0) || 0;
    issueWeight += expired + expiring + overdue + noPolicy * 0.5;
  }
  if (totalSecrets <= 0) {
    return rows.length > 0 ? 100 : 100;
  }
  const ratio = Math.min(1, issueWeight / totalSecrets);
  return Math.round(Math.max(0, Math.min(100, 100 * (1 - ratio))));
}

/** Total NHIs by type → pie/donut */
export function parseNhisByType(row: Record<string, unknown>): TypeSlice[] {
  const summary = getNhiSummary(row);
  if (summary?.length) {
    const byType = new Map<string, number>();
    for (const r of summary) {
      const t = String(r.nhi_type ?? "unknown");
      const c = Number(r.nhi_count ?? 0) || 0;
      byType.set(t, (byType.get(t) ?? 0) + c);
    }
    return Array.from(byType.entries())
      .map(([label, value]) => ({ label: formatSnakeLabel(label), value }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }

  const raw = pickField(row, [
    "nhis_by_type",
    "total_nhis_by_type",
    "by_type",
    "nhi_by_type",
    "type_breakdown",
  ]);
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const o = item as Record<string, unknown>;
        const label = String(
          o.type ?? o.nhi_type ?? o.name ?? o.label ?? o.category ?? o.key ?? ""
        );
        const value = Number(o.count ?? o.total ?? o.value ?? o.n ?? 0);
        if (!label || Number.isNaN(value)) return null;
        return { label, value };
      })
      .filter((x): x is TypeSlice => x !== null);
  }

  if (typeof raw === "object" && raw !== null) {
    return Object.entries(raw as Record<string, unknown>)
      .map(([label, v]) => ({
        label,
        value: typeof v === "number" ? v : Number(v) || 0,
      }))
      .filter((x) => x.value > 0 || x.label);
  }

  return [];
}

const LIFECYCLE_LABEL_KEYS = new Set([
  "lifecycle",
  "lifecycle_state",
  "lifecyclestate",
  "state",
  "status",
  "phase",
  "label",
]);

function isNumericLike(v: unknown): boolean {
  return typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)));
}

/** NHIs by lifecycle (stacked bar) */
export function parseNhisByLifecycle(row: Record<string, unknown>): StackedLifecycle | null {
  const summary = getNhiSummary(row);
  if (summary?.length) {
    const stacked = pivotNhiSummaryLifecycle(summary);
    if (stacked) return stacked;
  }

  const raw = pickField(row, [
    "nhis_by_lifecycle",
    "by_lifecycle",
    "lifecycle_breakdown",
    "lifecycle_stack",
  ]);
  if (!raw) return null;

  // Pre-shaped Chart.js style
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.labels) && Array.isArray(o.datasets)) {
      const ds = (o.datasets as unknown[]).map((d, i) => {
        if (!d || typeof d !== "object") return null;
        const dsObj = d as Record<string, unknown>;
        const label = String(dsObj.label ?? `Series ${i + 1}`);
        const data = Array.isArray(dsObj.data)
          ? (dsObj.data as unknown[]).map((n) => Number(n) || 0)
          : [];
        const backgroundColor =
          typeof dsObj.backgroundColor === "string" ? dsObj.backgroundColor : undefined;
        return { label, data, backgroundColor };
      });
      const ok = ds.filter((x): x is NonNullable<typeof x> => x !== null && x.data.length > 0);
      if (ok.length && Array.isArray(o.labels) && o.labels.length)
        return {
          labels: (o.labels as unknown[]).map(String),
          datasets: ok,
        };
    }
    // { series: [ { name, data: [] } ], labels: [] }
    if (Array.isArray(o.series) && Array.isArray(o.labels)) {
      const series = o.series as unknown[];
      const datasets = series
        .map((s, i) => {
          if (!s || typeof s !== "object") return null;
          const so = s as Record<string, unknown>;
          const label = String(so.name ?? so.label ?? `Series ${i + 1}`);
          const data = Array.isArray(so.data)
            ? (so.data as unknown[]).map((n) => Number(n) || 0)
            : [];
          return { label, data };
        })
        .filter((x): x is { label: string; data: number[] } => x !== null);
      if (datasets.length)
        return { labels: (o.labels as unknown[]).map(String), datasets };
    }
  }

  if (!Array.isArray(raw) || raw.length === 0) return null;

  const first = raw[0];
  if (!first || typeof first !== "object") return null;
  const sample = first as Record<string, unknown>;
  const labelKey =
    Object.keys(sample).find((k) => LIFECYCLE_LABEL_KEYS.has(k.toLowerCase())) ??
    Object.keys(sample)[0];

  const stackKeys = Object.keys(sample).filter(
    (k) => k !== labelKey && isNumericLike(sample[k])
  );
  if (!stackKeys.length) return null;

  const labels = raw.map((r) => {
    if (!r || typeof r !== "object") return "";
    return String((r as Record<string, unknown>)[labelKey] ?? "");
  });

  const datasets = stackKeys.map((key, i) => ({
    label: key.replace(/_/g, " "),
    data: raw.map((r) => {
      if (!r || typeof r !== "object") return 0;
      return Number((r as Record<string, unknown>)[key] ?? 0) || 0;
    }),
    backgroundColor: CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length],
  }));

  return { labels, datasets };
}

const RISK_ORDER = ["critical", "high", "medium", "low", "info"];

function riskSortIndex(label: string): number {
  const k = label.trim().toLowerCase();
  let idx = RISK_ORDER.findIndex((r) => k.includes(r));
  if (idx < 0) idx = RISK_ORDER.length;
  return idx;
}

/** NHIs by risk level → horizontal colored bars */
export function parseNhisByRisk(row: Record<string, unknown>): RiskBar[] {
  const summary = getNhiSummary(row);
  if (summary?.length) {
    const byRisk = new Map<string, number>();
    for (const r of summary) {
      const rl = String(r.risk_level ?? "unknown");
      const c = Number(r.nhi_count ?? 0) || 0;
      byRisk.set(rl, (byRisk.get(rl) ?? 0) + c);
    }
    return Array.from(byRisk.entries())
      .map(([label, value]) => ({ label: riskLevelLegendLabel(label), value }))
      .sort((a, b) => riskSortIndex(a.label) - riskSortIndex(b.label))
      .map((p) => ({
        ...p,
        color: riskColor(p.label.toLowerCase()),
      }));
  }

  const raw = pickField(row, ["nhis_by_risk", "by_risk", "risk_breakdown", "risk_levels"]);
  if (!raw) return [];

  let pairs: { label: string; value: number }[] = [];

  if (Array.isArray(raw)) {
    pairs = raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const o = item as Record<string, unknown>;
        const label = String(
          o.risk_level ?? o.risk ?? o.level ?? o.name ?? o.label ?? o.tier ?? ""
        );
        const value = Number(o.count ?? o.total ?? o.value ?? o.n ?? 0);
        if (!label) return null;
        return { label, value };
      })
      .filter((x): x is { label: string; value: number } => x !== null);
  } else if (typeof raw === "object" && raw !== null) {
    pairs = Object.entries(raw as Record<string, unknown>).map(([label, v]) => ({
      label,
      value: typeof v === "number" ? v : Number(v) || 0,
    }));
  }

  return pairs
    .map((p) => ({ ...p, label: riskLevelLegendLabel(p.label) }))
    .sort((a, b) => riskSortIndex(a.label) - riskSortIndex(b.label))
    .map((p) => ({
      ...p,
      color: riskColor(p.label.toLowerCase()),
    }));
}

/** Secret health score 0–100 for gauge/donut */
export function parseSecretHealth(row: Record<string, unknown>): number | null {
  const stats = parseSecretsPostureStats(row);
  if (stats) return stats.pct;

  const sh = pickField(row, ["secret_health"]);
  if (Array.isArray(sh) && sh.length > 0) {
    const rows = sh.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object");
    if (rows.length) return computeSecretHealthScoreFromRows(rows);
  }
  if (typeof sh === "number" && !Number.isNaN(sh)) {
    return Math.max(0, Math.min(100, sh));
  }
  if (typeof sh === "string" && sh.trim() !== "") {
    const n = Number(sh);
    if (!Number.isNaN(n)) return Math.max(0, Math.min(100, n));
  }

  const raw = pickField(row, [
    "secret_health_pct",
    "secret_health_score",
    "secrets_health",
    "secret_score",
  ]);
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

/** Totals for Secrets Posture Score widget (aggregates `secret_health[]` when present). */
export type SecretsPostureStats = {
  pct: number;
  healthy: number;
  total: number;
  rotationOverdue: number;
  expiringSoon: number;
  expired: number;
  neverRotated: number;
};

function aggregateSecretsPostureFromRows(rows: Record<string, unknown>[]): SecretsPostureStats {
  let total = 0;
  let expired = 0;
  let expiringSoon = 0;
  let rotationOverdue = 0;
  let neverRotated = 0;
  let healthySum = 0;
  let healthyRowCount = 0;

  for (const r of rows) {
    total += Number(r.total_secrets ?? r.total ?? 0) || 0;
    expired += Number(r.expired_count ?? r.expired ?? 0) || 0;
    expiringSoon += Number(r.expiring_soon_count ?? r.expiring_soon ?? 0) || 0;
    rotationOverdue += Number(r.rotation_overdue_count ?? r.rotation_overdue ?? 0) || 0;
    neverRotated +=
      Number(
        r.never_rotated_count ??
          r.never_rotated ??
          r.secrets_never_rotated ??
          r.never_rotated_secrets ??
          0
      ) || 0;
    const h = r.healthy_secrets_count ?? r.healthy_count ?? r.fresh_secrets_count;
    if (h != null && h !== "") {
      healthySum += Number(h) || 0;
      healthyRowCount += 1;
    }
  }

  let healthy = healthyRowCount > 0 ? healthySum : 0;
  if (healthyRowCount === 0 && total > 0) {
    const rawHealthy = total - expired - expiringSoon - rotationOverdue - neverRotated;
    healthy = Math.max(0, Math.min(total, rawHealthy));
  }

  let pct =
    total > 0 ? Math.round((healthy / total) * 100) : computeSecretHealthScoreFromRows(rows);

  if (total === 0 && healthyRowCount === 0) {
    pct = computeSecretHealthScoreFromRows(rows);
  }

  return {
    pct,
    healthy,
    total,
    rotationOverdue,
    expiringSoon,
    expired,
    neverRotated,
  };
}

export function parseSecretsPostureStats(row: Record<string, unknown>): SecretsPostureStats | null {
  const sh = pickField(row, ["secret_health"]);
  if (Array.isArray(sh) && sh.length > 0) {
    const rows = sh.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object");
    if (rows.length) return aggregateSecretsPostureFromRows(rows);
  }

  const raw = pickField(row, [
    "secret_health_pct",
    "secret_health_score",
    "secrets_health",
    "secret_score",
  ]);
  if (raw !== undefined && raw !== null) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isNaN(n)) {
      return {
        pct: Math.max(0, Math.min(100, n)),
        healthy: 0,
        total: 0,
        rotationOverdue: 0,
        expiringSoon: 0,
        expired: 0,
        neverRotated: 0,
      };
    }
  }

  return null;
}
