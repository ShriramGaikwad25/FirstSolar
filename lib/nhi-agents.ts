/**
 * Non-human Identity agents — from `kf_nhi_mv_agent_posture` list query or embedded `agents[]` in dashboards.
 */

import {
  coerceRowObject,
  extractResultRows,
  normalizeDashboardRow,
} from "@/lib/nhi-dashboard";

export const NHI_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

export const AGENT_DASHBOARD_QUERY =
  "SELECT public.kf_nhi_get_agent_dashboard(?::uuid) AS result";

export const AGENT_POSTURE_LIST_QUERY = `SELECT p.nhi_id, p.agent_name, p.vendor, p.model_name, p.model_version,
                p.evaluation_score, p.tools_enabled, p.active_delegations,
                p.actions_last_24h, p.denied_last_24h,
                p.hallucinations_last_7d, p.avg_latency_ms_24h,
                p.tokens_last_24h, p.cost_usd_24h,
                i.state AS identity_state,
                i.nhi_type AS identity_classification,
                ai.instancename AS platform_name,
                COALESCE(NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), ''), u.username) AS business_owner_name,
                (SELECT e.endpoint_type FROM public.kf_nhi_trusted_endpoint e
                  WHERE e.nhi_id = p.nhi_id ORDER BY e.endpoint_type LIMIT 1) AS interface_type,
                COALESCE(NULLIF(TRIM(i.customattributes->>'environment'), ''), '') AS environment_label
           FROM public.kf_nhi_mv_agent_posture p
           LEFT JOIN public.kf_nhi_identity i ON i.nhi_id = p.nhi_id AND i.tenant_id = p.tenant_id
           LEFT JOIN public.usr u ON u.userid = i.ownerid
           LEFT JOIN public.applicationinstance ai ON ai.instanceid = i.instanceid
          WHERE p.tenant_id = ?::uuid
          ORDER BY p.actions_last_24h DESC NULLS LAST`;

export type NhiAgentRow = {
  nhi_id?: string;
  vendor?: string;
  tenant_id?: string;
  agent_name?: string;
  model_name?: string;
  computed_at?: string;
  cost_usd_24h?: number | null;
  model_version?: string;
  tools_enabled?: number | null;
  denied_last_24h?: number | null;
  tokens_last_24h?: number | null;
  actions_last_24h?: number | null;
  evaluation_score?: number | null;
  active_delegators?: number | null;
  active_delegations?: number | null;
  avg_latency_ms_24h?: number | null;
  rate_limit_per_min?: number | null;
  token_budget_per_day?: number | null;
  hallucinations_last_7d?: number | null;
  /** From identity / joins (filters + display) */
  identity_state?: string;
  identity_classification?: string;
  platform_name?: string;
  business_owner_name?: string;
  interface_type?: string;
  environment_label?: string;
};

export function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim());
  return 0;
}

/** Map one API object (dashboard agent or mv row) to {@link NhiAgentRow}. */
export function mapRecordToAgentRow(o: Record<string, unknown>): NhiAgentRow {
  const str = (k: string) => {
    const v = o[k];
    return v != null && String(v).trim() !== "" ? String(v) : undefined;
  };
  return {
    nhi_id: o.nhi_id != null ? String(o.nhi_id) : undefined,
    vendor: o.vendor != null ? String(o.vendor) : undefined,
    tenant_id: o.tenant_id != null ? String(o.tenant_id) : undefined,
    agent_name: o.agent_name != null ? String(o.agent_name) : undefined,
    model_name: o.model_name != null ? String(o.model_name) : undefined,
    computed_at: o.computed_at != null ? String(o.computed_at) : undefined,
    identity_state: str("identity_state"),
    identity_classification: str("identity_classification"),
    platform_name: str("platform_name"),
    business_owner_name: str("business_owner_name"),
    interface_type: str("interface_type"),
    environment_label: str("environment_label"),
    cost_usd_24h:
      o.cost_usd_24h == null ? null : toNum(o.cost_usd_24h) || null,
    model_version: o.model_version != null ? String(o.model_version) : undefined,
    tools_enabled:
      o.tools_enabled == null ? null : Math.round(toNum(o.tools_enabled)),
    denied_last_24h:
      o.denied_last_24h == null
        ? null
        : Math.round(toNum(o.denied_last_24h)),
    tokens_last_24h:
      o.tokens_last_24h == null
        ? null
        : Math.round(toNum(o.tokens_last_24h)),
    actions_last_24h:
      o.actions_last_24h == null
        ? null
        : Math.round(toNum(o.actions_last_24h)),
    evaluation_score:
      o.evaluation_score == null ? null : toNum(o.evaluation_score) || null,
    active_delegators:
      o.active_delegators == null
        ? null
        : Math.round(toNum(o.active_delegators)),
    active_delegations:
      o.active_delegations == null
        ? null
        : Math.round(toNum(o.active_delegations)),
    avg_latency_ms_24h:
      o.avg_latency_ms_24h == null
        ? null
        : Math.round(toNum(o.avg_latency_ms_24h)),
    rate_limit_per_min:
      o.rate_limit_per_min == null
        ? null
        : Math.round(toNum(o.rate_limit_per_min)),
    token_budget_per_day:
      o.token_budget_per_day == null
        ? null
        : Math.round(toNum(o.token_budget_per_day)),
    hallucinations_last_7d:
      o.hallucinations_last_7d == null
        ? null
        : Math.round(toNum(o.hallucinations_last_7d)),
  };
}

/** `agents` may sit on the row or inside `result` / `data` / `payload` after API wrapping. */
function findAgentsArrayInDashboard(row: Record<string, unknown>): unknown[] | null {
  const top = row.agents ?? row.Agents;
  if (Array.isArray(top)) return top;
  for (const k of ["result", "data", "payload", "dashboard", "Data", "Result"]) {
    const v = row[k];
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const inner = v as Record<string, unknown>;
    const a = inner.agents ?? inner.Agents;
    if (Array.isArray(a)) return a;
  }
  return null;
}

export function parseAgentsFromDashboard(
  row: Record<string, unknown> | null
): NhiAgentRow[] {
  if (!row) return [];
  const raw = findAgentsArrayInDashboard(row);
  if (!Array.isArray(raw)) return [];
  const out: NhiAgentRow[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object" || Array.isArray(a)) continue;
    out.push(mapRecordToAgentRow(a as Record<string, unknown>));
  }
  return out;
}

/** Rows from `kf_nhi_mv_agent_posture` list query. */
export function parseAgentPostureListRows(response: unknown): NhiAgentRow[] {
  const rows = extractResultRows(response);
  const out: NhiAgentRow[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object" || Array.isArray(r)) continue;
    out.push(mapRecordToAgentRow(r as Record<string, unknown>));
  }
  return out;
}

/** Normalized JSON from `kf_nhi_get_agent_dashboard` (column `result`). */
export function getNormalizedAgentDashboardRow(
  response: unknown
): Record<string, unknown> | null {
  const rows = extractResultRows(response);
  const raw = rows[0];
  const obj = coerceRowObject(raw);
  if (!obj) return null;
  const row = normalizeDashboardRow(obj) as Record<string, unknown>;
  if (!Array.isArray(row.agents) && !Array.isArray(row.Agents)) {
    const nested = findAgentsArrayInDashboard(row);
    if (nested) return { ...row, agents: nested };
  }
  return row;
}

export type AgentSummaryMetrics = {
  agentsTotal: number;
  activeDisplay: string | number;
  delegations: number;
  actions24h: number;
  denied24h: number;
  hallucinations7d: number;
};

function clamp100(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/** Same axis order as the Agent Posture UI radar (Capability → … → Delegation). */
const AGENT_RADAR_DIMENSIONS = [
  "capability",
  "authorization",
  "autonomy",
  "activity",
  "delegation",
] as const;

function normKeyLoose(s: string): string {
  return s.toLowerCase().replace(/[_\s-]/g, "");
}

function toFinite(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v.trim())) {
    return Number(v.trim());
  }
  return null;
}

/** Backend may return fractions 0–1 or scores 0–100. */
function normalizeRadarScale(values: number[]): number[] {
  const slice = values.slice(0, 5);
  const max = Math.max(...slice.map((x) => (Number.isFinite(x) ? Math.abs(x) : 0)));
  if (max <= 1.5) {
    return slice.map((x) => clamp100((Number.isFinite(x) ? x : 0) * 100));
  }
  return slice.map((x) => clamp100(Number.isFinite(x) ? x : 0));
}

function scoreForAgentDimension(
  o: Record<string, unknown>,
  dim: string
): number | null {
  const dimNK = normKeyLoose(dim);
  const asScoreNK = normKeyLoose(`${dim}_score`);
  for (const [k, v] of Object.entries(o)) {
    const nk = normKeyLoose(k);
    if (
      nk === dimNK ||
      nk === asScoreNK ||
      nk === `${dimNK}score`
    ) {
      const n = toFinite(v);
      if (n !== null) return n;
    }
  }
  return null;
}

/** Read five posture scores from one object (flat or nested `posture` payload). */
function readAgentRadarFromDimensionsObject(
  o: Record<string, unknown>
): number[] | null {
  const postureRaw =
    o.posture ??
    o.Posture ??
    o.agent_posture ??
    o.agentPosture ??
    o.pillar_scores ??
    o.pillarScores;
  const source =
    postureRaw && typeof postureRaw === "object" && !Array.isArray(postureRaw)
      ? (postureRaw as Record<string, unknown>)
      : o;

  const vals: number[] = [];
  for (const dim of AGENT_RADAR_DIMENSIONS) {
    const n =
      scoreForAgentDimension(source, dim) ?? scoreForAgentDimension(o, dim);
    if (n === null) return null;
    vals.push(n);
  }
  return normalizeRadarScale(vals);
}

/** Heuristic: 0–1 evaluation / capability scale → 0–100 for radar. */
function evaluationToRadarPercent(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw <= 1.5) return clamp100(raw * 100);
  return clamp100(raw);
}

/**
 * Strict array keys only — avoid generic `radar` / long arrays from unrelated fields.
 * Expect exactly 5 numbers in UI order: Capability … Delegation.
 */
const AGENT_RADAR_ARRAY_KEYS = [
  "radar_scores",
  "agent_posture_radar",
  "agent_radar",
  "posture_radar",
  "radar_axes",
] as const;

function tryAgentRadarNumericArray(byLower: Map<string, unknown>): number[] | null {
  for (const k of AGENT_RADAR_ARRAY_KEYS) {
    const v = byLower.get(k.toLowerCase());
    if (!Array.isArray(v)) continue;
    if (v.length < 5) continue;
    if (v.length > 8) continue;
    const nums = v.slice(0, 5).map((x) => toNum(x));
    if (!nums.every((x) => Number.isFinite(x))) continue;
    return normalizeRadarScale(nums);
  }
  // Bare `radar` only when exactly five values (avoids long unrelated arrays).
  const bare = byLower.get("radar");
  if (Array.isArray(bare) && bare.length === 5) {
    const nums = bare.map((x) => toNum(x));
    if (nums.every((x) => Number.isFinite(x))) return normalizeRadarScale(nums);
  }
  return null;
}

/**
 * Named breakdown arrays — agent-specific keys only (not `sub_scores` / `dimensions`,
 * which often belong to governance or other charts).
 */
const AGENT_RADAR_PAIR_ARRAY_KEYS = [
  "agent_radar_breakdown",
  "agent_posture_scores",
  "agent_sub_scores",
  "posture_radar_scores",
] as const;

function tryAgentRadarScorePairArrays(byLower: Map<string, unknown>): number[] | null {
  for (const k of AGENT_RADAR_PAIR_ARRAY_KEYS) {
    const raw = byLower.get(k.toLowerCase());
    if (!Array.isArray(raw) || raw.length < 5) continue;
    const first = raw[0];
    if (!first || typeof first !== "object" || Array.isArray(first)) continue;
    const map = new Map<string, number>();
    for (const item of raw) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const rec = item as Record<string, unknown>;
      const name = String(
        rec.dimension ?? rec.name ?? rec.label ?? rec.axis ?? rec.key ?? ""
      ).trim();
      const val = rec.score ?? rec.value ?? rec.points ?? rec.weight;
      const n = toFinite(val);
      if (!name || n === null) continue;
      map.set(normKeyLoose(name), n);
    }
    const ordered: number[] = [];
    for (const dim of AGENT_RADAR_DIMENSIONS) {
      const nk = normKeyLoose(dim);
      const alt = normKeyLoose(`${dim}_score`);
      const val =
        map.get(nk) ??
        map.get(alt) ??
        map.get(`${nk}score`);
      if (val === undefined) {
        ordered.length = 0;
        break;
      }
      ordered.push(val);
    }
    if (ordered.length === 5) return normalizeRadarScale(ordered);
  }
  return null;
}

/** Objects that may hold agent radar (no deep graph walk — avoids false positives). */
const AGENT_RADAR_OBJECT_PATHS = [
  "posture",
  "Posture",
  "agent_posture",
  "agentPosture",
  "agent_dashboard",
  "agentDashboard",
  "dashboard",
  "data",
  "payload",
] as const;

function collectRadarCandidateRoots(
  row: Record<string, unknown>
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [row];
  const seen = new Set<unknown>([row]);
  const byLower = new Map(
    Object.keys(row).map((k) => [k.toLowerCase(), row[k]])
  );

  const push = (o: unknown) => {
    if (!o || typeof o !== "object" || Array.isArray(o)) return;
    if (seen.has(o)) return;
    seen.add(o);
    out.push(o as Record<string, unknown>);
  };

  for (const path of AGENT_RADAR_OBJECT_PATHS) {
    push(byLower.get(path.toLowerCase()));
  }

  return out;
}

/**
 * Extract 5-axis radar (0–100) from `kf_nhi_get_agent_dashboard` JSON.
 * Intentionally avoids recursive walks over arbitrary keys (those picked governance arrays, etc.).
 */
export function tryRadarFromAgentDashboard(
  row: Record<string, unknown> | null
): number[] | null {
  if (!row) return null;

  for (const obj of collectRadarCandidateRoots(row)) {
    const byLower = new Map(
      Object.keys(obj).map((k) => [k.toLowerCase(), obj[k]])
    );

    const fromDims = readAgentRadarFromDimensionsObject(obj);
    if (fromDims) return fromDims;

    const fromArr = tryAgentRadarNumericArray(byLower);
    if (fromArr) return fromArr;

    const fromPairs = tryAgentRadarScorePairArrays(byLower);
    if (fromPairs) return fromPairs;
  }

  return null;
}

/**
 * Aggregate headline counts + radar (0–100) from agents list.
 * Radar axes: Capability, Authorization, Autonomy, Activity, Delegation.
 */
export function computeAgentSummary(agents: NhiAgentRow[]): {
  metrics: AgentSummaryMetrics;
  radar: number[];
} {
  const n = agents.length;
  let delegations = 0;
  let actions24h = 0;
  let denied24h = 0;
  let hallucinations7d = 0;
  let evalSum = 0;
  let evalCount = 0;
  let toolsSum = 0;
  let toolsN = 0;
  let delegSum = 0;
  let delegN = 0;
  for (const a of agents) {
    delegations += a.active_delegations ?? 0;
    actions24h += a.actions_last_24h ?? 0;
    denied24h += a.denied_last_24h ?? 0;
    hallucinations7d += a.hallucinations_last_7d ?? 0;
    if (a.evaluation_score != null && a.evaluation_score > 0) {
      evalSum += a.evaluation_score;
      evalCount += 1;
    }
    if (a.tools_enabled != null) {
      toolsSum += a.tools_enabled;
      toolsN += 1;
    }
    if (a.active_delegations != null && a.active_delegations > 0) {
      delegSum += a.active_delegations;
      delegN += 1;
    }
  }

  const avgEvalRaw = evalCount > 0 ? evalSum / evalCount : 0;
  const avgTools = toolsN > 0 ? toolsSum / toolsN : 0;
  const avgDeleg = n > 0 ? delegations / n : 0;
  const authPct =
    actions24h > 0
      ? clamp100(100 * (1 - denied24h / Math.max(1, actions24h)))
      : 100;
  const maxActions =
    agents.reduce((m, a) => Math.max(m, a.actions_last_24h ?? 0), 0) || 1;
  const activityPct = clamp100(
    n > 0 ? (actions24h / Math.max(1, n * maxActions)) * 100 : 0
  );
  const autonomyPct = clamp100((avgTools / 12) * 100);
  const delegationPct = clamp100((avgDeleg / 30) * 100);

  const radar = [
    evaluationToRadarPercent(avgEvalRaw),
    authPct,
    autonomyPct,
    activityPct,
    delegationPct,
  ];

  return {
    metrics: {
      agentsTotal: n,
      /** Dashboard JSON has no dedicated “active” count today — match UI placeholder. */
      activeDisplay: "—",
      delegations,
      actions24h,
      denied24h,
      hallucinations7d,
    },
    radar,
  };
}

/**
 * `kf_nhi_get_agent_dashboard` usually returns `{ agents, delegators, intent_distribution }`
 * (no separate radar/posture scores). Aggregate radar + headline metrics from embedded
 * `agents` the same way as {@link parseAgentPostureListRows}.
 */
export function computeAgentSummaryFromDashboardAgents(
  row: Record<string, unknown> | null
): { metrics: AgentSummaryMetrics; radar: number[] } | null {
  const list = parseAgentsFromDashboard(row);
  if (list.length === 0) return null;
  return computeAgentSummary(list);
}

export function formatUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}
