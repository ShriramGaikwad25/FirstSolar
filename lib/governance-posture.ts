import { CHART_RISK_LEVEL_COLORS } from "@/lib/chart-colors";
import {
  coerceRowObject,
  extractResultRows,
  normalizeDashboardRow,
} from "@/lib/nhi-dashboard";

export const GOVERNANCE_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

export const DASHBOARD_V2_QUERY =
  "SELECT public.kf_nhi_get_dashboard_v2(?::uuid) AS result";

export const DASHBOARD_V1_QUERY = "SELECT * FROM public.kf_nhi_get_dashboard()";

export const FINDINGS_SEVERITY_QUERY = `SELECT severity, count(*)::int AS n
           FROM public.kf_nhi_finding
          WHERE tenant_id = ?::uuid AND status IN ('open','triaged','in_progress','blocked')
          GROUP BY severity
          ORDER BY CASE severity
                     WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                     WHEN 'medium' THEN 3 WHEN 'low'  THEN 4 ELSE 5 END`;

export type MetricTone = "blue" | "amber" | "red";

export type GovernanceMetricCard = {
  label: string;
  value: number;
  tone: MetricTone;
};

export type GovernanceViewModel = {
  overallScore: number;
  metrics: GovernanceMetricCard[];
  subScores: { label: string; value: number }[];
  findingsBySeverity: { severity: string; n: number }[];
};

export const SUB_SCORE_ORDER = [
  "ownership",
  "freshness",
  "review",
  "rotation",
  "expiry",
  "vault",
  "sod",
  "drift",
  "remediation",
] as const;

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  }
  return null;
}

function clamp0_100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function readFirstNumber(
  obj: Record<string, unknown> | null,
  keys: string[]
): number | null {
  if (!obj) return null;
  const byLower = new Map(
    Object.keys(obj).map((k) => [k.toLowerCase(), obj[k]])
  );
  for (const want of keys) {
    const v = byLower.get(want.toLowerCase());
    const n = toFiniteNumber(v);
    if (n !== null) return n;
  }
  return null;
}

function metricToneForLabel(label: string): MetricTone {
  const u = label.toUpperCase();
  if (u.includes("SLA") || u.includes("BREACH")) return "red";
  if (
    u.includes("FINDING") ||
    u.includes("SOD") ||
    u.includes("DRIFT") ||
    u.includes("VIOLATION")
  ) {
    return "amber";
  }
  return "blue";
}

function extractOverallScore(row: Record<string, unknown> | null): number {
  if (!row) return 0;
  const keys = [
    "overall_posture",
    "overallPosture",
    "overall_score",
    "overallScore",
    "posture_score",
    "postureScore",
    "governance_score",
    "governanceScore",
    "overall",
    "score",
  ];
  let n = readFirstNumber(row, keys);
  if (n !== null) return clamp0_100(n);
  for (const v of Object.values(row)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      n = readFirstNumber(v as Record<string, unknown>, keys);
      if (n !== null) return clamp0_100(n);
    }
  }
  return 0;
}

function pickMetricDeep(
  row: Record<string, unknown> | null,
  candidates: string[]
): number {
  if (!row) return 0;
  let n = readFirstNumber(row, candidates);
  if (n !== null) return Math.round(n);
  for (const v of Object.values(row)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      n = readFirstNumber(v as Record<string, unknown>, candidates);
      if (n !== null) return Math.round(n);
    }
  }
  return 0;
}

const SUB_SCORE_HINT_KEYS = [
  "sub_scores",
  "subScores",
  "sub_score",
  "subScore",
  "dimension_scores",
  "dimensionScores",
  "governance_sub_scores",
  "governanceSubScores",
  "pillars",
  "pillar_scores",
  "pillarScores",
  "score_breakdown",
  "scoreBreakdown",
];

function normKey(s: string): string {
  return s.toLowerCase().replace(/[_\s-]/g, "");
}

/** kf_nhi_get_dashboard_v2 nests scores under `posture` as `{dimension}_score`. */
function parseSubScoresFromPosture(
  posture: Record<string, unknown>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const dim of SUB_SCORE_ORDER) {
    const dNorm = normKey(dim);
    const wantNames = [`${dim}_score`, `${dim}Score`];
    for (const w of wantNames) {
      const wNorm = normKey(w);
      for (const [pk, pv] of Object.entries(posture)) {
        if (normKey(pk) !== wNorm) continue;
        const n = toFiniteNumber(pv);
        if (n !== null) {
          map.set(dNorm, clamp0_100(n));
          break;
        }
      }
      if (map.has(dNorm)) break;
    }
  }
  return map;
}

/** Depth-first search for a value stored under a sub-score hint key. */
function deepFindSubScoresPayload(root: unknown): unknown {
  if (root == null || typeof root !== "object") return null;
  const visited = new WeakSet<object>();

  function visit(node: unknown): unknown {
    if (node == null || typeof node !== "object") return null;
    if (visited.has(node as object)) return null;
    visited.add(node as object);

    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = visit(item);
        if (hit !== null && hit !== undefined) return hit;
      }
      return null;
    }

    const o = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      const nk = normKey(k);
      for (const hint of SUB_SCORE_HINT_KEYS) {
        if (nk === normKey(hint)) {
          if (v !== null && typeof v === "object") return v;
          if (typeof v === "string") {
            const t = v.trim();
            if (
              (t.startsWith("{") && t.endsWith("}")) ||
              (t.startsWith("[") && t.endsWith("]"))
            ) {
              try {
                return JSON.parse(t) as unknown;
              } catch {
                /* ignore */
              }
            }
          }
        }
      }
    }
    for (const v of Object.values(o)) {
      const hit = visit(v);
      if (hit !== null && hit !== undefined) return hit;
    }
    return null;
  }

  return visit(root);
}

/** Any nested object whose keys cover multiple known dimensions (flat map form). */
function findBestSubScoreObjectMap(
  root: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!root) return null;
  const visited = new WeakSet<object>();
  let best: Record<string, unknown> | null = null;
  let bestHits = 0;

  function visit(node: unknown): void {
    if (node == null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (visited.has(node as object)) return;
    visited.add(node as object);

    const o = node as Record<string, unknown>;
    const keysNorm = new Set(Object.keys(o).map(normKey));
    let hits = 0;
    for (const dim of SUB_SCORE_ORDER) {
      if (keysNorm.has(normKey(dim))) hits += 1;
    }
    if (hits >= 2 && hits > bestHits) {
      bestHits = hits;
      best = o;
    }
    for (const v of Object.values(o)) visit(v);
  }

  visit(root);
  return best;
}

function scoreFromEntry(e: Record<string, unknown>): number | null {
  return toFiniteNumber(
    e.score ??
      e.value ??
      e.weight ??
      e.points ??
      e.percent ??
      e.pct ??
      e.n ??
      e.v ??
      e.sub_score ??
      e.subScore
  );
}

function dimensionNameFromEntry(e: Record<string, unknown>): string {
  const raw = String(
    e.dimension ??
      e.dim ??
      e.dimension_name ??
      e.dimensionName ??
      e.metric ??
      e.name ??
      e.key ??
      e.category ??
      e.label ??
      e.pillar ??
      e.axis ??
      e.id ??
      e.code ??
      e.type ??
      ""
  ).trim();
  return normKey(raw.replace(/\s+/g, "_"));
}

function parseSubScoresFromArray(
  arr: unknown[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of arr) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const e = item as Record<string, unknown>;
    const name = dimensionNameFromEntry(e);
    if (!name) continue;
    const sc = scoreFromEntry(e);
    if (sc === null) continue;
    map.set(name, clamp0_100(sc));
  }
  return map;
}

function parseSubScoresFromObjectMap(
  bag: Record<string, unknown>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const dim of SUB_SCORE_ORDER) {
    const d = normKey(dim);
    for (const [k, v] of Object.entries(bag)) {
      const kn = normKey(k);
      if (
        kn === d ||
        kn === `${d}score` ||
        kn === `score${d}` ||
        kn === `${d}pct` ||
        kn === `${d}percent` ||
        kn === `${d}value` ||
        kn === `subscore${d}` ||
        kn === `sub${d}`
      ) {
        const n = toFiniteNumber(v);
        if (n !== null) map.set(d, clamp0_100(n));
        break;
      }
    }
  }
  return map;
}

function parseSubScores(row: Record<string, unknown> | null): {
  label: string;
  value: number;
}[] {
  const zeros = () =>
    SUB_SCORE_ORDER.map((label) => ({ label, value: 0 as number }));

  if (!row) return zeros();

  let map = new Map<string, number>();

  const postureRaw = row.posture ?? row.Posture;
  if (postureRaw && typeof postureRaw === "object" && !Array.isArray(postureRaw)) {
    map = parseSubScoresFromPosture(postureRaw as Record<string, unknown>);
  }

  if (map.size >= SUB_SCORE_ORDER.length) {
    return SUB_SCORE_ORDER.map((label) => ({
      label,
      value: map.get(normKey(label)) ?? 0,
    }));
  }

  let payload: unknown = deepFindSubScoresPayload(row);
  if (typeof payload === "string") {
    const t = payload.trim();
    if (
      (t.startsWith("{") && t.endsWith("}")) ||
      (t.startsWith("[") && t.endsWith("]"))
    ) {
      try {
        payload = JSON.parse(t) as unknown;
      } catch {
        payload = null;
      }
    } else {
      payload = null;
    }
  }
  if (Array.isArray(payload)) {
    map = parseSubScoresFromArray(payload);
  } else if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const o = payload as Record<string, unknown>;
    const inner = o.items ?? o.rows ?? o.data ?? o.values ?? o.list ?? o.series;
    if (Array.isArray(inner)) {
      map = parseSubScoresFromArray(inner);
    } else {
      map = parseSubScoresFromObjectMap(o);
    }
  }

  if (map.size === 0) {
    map = parseSubScoresFromObjectMap(row);
  }
  if (map.size === 0) {
    const best = findBestSubScoreObjectMap(row);
    if (best) {
      map = parseSubScoresFromObjectMap(best);
    }
  }

  if (map.size === 0) {
    const flat = row as Record<string, unknown>;
    for (const dim of SUB_SCORE_ORDER) {
      const candidates = [
        dim,
        `${dim}_score`,
        `score_${dim}`,
        `sub_score_${dim}`,
        `subScore${dim.charAt(0).toUpperCase()}${dim.slice(1)}`,
      ];
      const n = readFirstNumber(flat, candidates);
      if (n !== null) {
        map.set(normKey(dim), clamp0_100(n));
      }
    }
  }

  return SUB_SCORE_ORDER.map((label) => {
    const nk = normKey(label);
    let v = map.get(nk);
    if (v === undefined) {
      for (const [mk, mv] of map) {
        if (mk.includes(nk) || nk.includes(mk)) {
          v = mv;
          break;
        }
      }
    }
    return { label, value: v ?? 0 };
  });
}

function buildMetrics(row: Record<string, unknown> | null): GovernanceMetricCard[] {
  const specs: { label: string; keys: string[] }[] = [
    { label: "NHIS", keys: ["nhis", "nhi_count", "total_nhis", "nhi_total", "totalNhis"] },
    {
      label: "SECRETS",
      keys: [
        "secret_total",
        "secrets",
        "secret_count",
        "secrets_total",
        "total_secrets",
        "secretsTotal",
      ],
    },
    {
      label: "FINDINGS OPEN",
      keys: [
        "findings_open",
        "findingsOpen",
        "open_findings",
        "openFindings",
        "finding_open",
      ],
    },
    {
      label: "SLA BREACHED",
      keys: [
        "sla_breached",
        "slaBreached",
        "findings_sla_breached",
        "sla_breach",
        "breached_sla",
        "slaBreaches",
      ],
    },
    {
      label: "SOD VIOLATIONS",
      keys: [
        "sod_open",
        "sod_violations",
        "sodViolations",
        "sod_violation_count",
        "violations_sod",
        "sodCount",
      ],
    },
    {
      label: "ROLE DRIFTS",
      keys: [
        "drift_open",
        "role_drifts",
        "roleDrifts",
        "drift_count",
        "role_drift",
        "drifts",
      ],
    },
  ];
  return specs.map((s) => ({
    label: s.label,
    value: pickMetricDeep(row, s.keys),
    tone: metricToneForLabel(s.label),
  }));
}

/**
 * Flattens `kf_nhi_get_dashboard_v2` payload: `posture.*` and key `findings.sla_breached`
 * onto the root so existing pickMetric / chart parsers see scalar fields.
 */
export function hoistPostureAndFindings(
  row: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  const posture = out.posture ?? out.Posture;
  if (posture && typeof posture === "object" && !Array.isArray(posture)) {
    for (const [k, v] of Object.entries(posture as Record<string, unknown>)) {
      if (!(k in out)) out[k] = v;
    }
  }
  const findingsAgg = out.findings ?? out.Findings;
  if (
    findingsAgg &&
    typeof findingsAgg === "object" &&
    !Array.isArray(findingsAgg)
  ) {
    const fo = findingsAgg as Record<string, unknown>;
    if (fo.sla_breached != null) {
      out.sla_breached = fo.sla_breached;
    }
    if (fo.open != null && out.findings_open == null) {
      out.findings_open = fo.open;
    }
  }
  return out;
}

export function getNormalizedDashboardV2Row(
  response: unknown
): Record<string, unknown> | null {
  const rows = extractResultRows(response);
  const raw = rows[0];
  const obj = coerceRowObject(raw);
  if (!obj) return null;
  const normalized = normalizeDashboardRow(obj);
  return hoistPostureAndFindings(normalized);
}

export function parseFindingsSeverityResponse(
  response: unknown
): { severity: string; n: number }[] {
  const rows = extractResultRows(response);
  const out: { severity: string; n: number }[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const severity = String(o.severity ?? o.SEVERITY ?? "").trim();
    if (!severity) continue;
    const n =
      toFiniteNumber(o.n ?? o.count ?? o.cnt ?? o.total) ?? 0;
    out.push({ severity, n: Math.max(0, Math.round(n)) });
  }
  return out;
}

export function buildGovernanceView(
  normalizedRow: Record<string, unknown> | null,
  findings: { severity: string; n: number }[]
): GovernanceViewModel {
  return {
    overallScore: extractOverallScore(normalizedRow),
    metrics: buildMetrics(normalizedRow),
    subScores: parseSubScores(normalizedRow),
    findingsBySeverity: findings,
  };
}

export function severityChartColor(severity: string): string {
  const k = severity.trim().toLowerCase();
  if (k in CHART_RISK_LEVEL_COLORS) {
    return CHART_RISK_LEVEL_COLORS[k]!;
  }
  if (k.includes("critical")) return CHART_RISK_LEVEL_COLORS.critical;
  if (k.includes("high")) return CHART_RISK_LEVEL_COLORS.high;
  if (k.includes("medium")) return CHART_RISK_LEVEL_COLORS.medium;
  if (k.includes("low")) return CHART_RISK_LEVEL_COLORS.low;
  return CHART_RISK_LEVEL_COLORS.unknown;
}
