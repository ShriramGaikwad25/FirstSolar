import { coerceRowObject, extractResultRows } from "@/lib/nhi-dashboard";

export const ROTATION_POLICY_GRID_QUERY =
  "SELECT * FROM v_kf_nhi_rotation_policy_grid ORDER BY priority DESC, name";

export type RotationPolicyGridRow = {
  id: string;
  name: string;
  description: string;
  nhiTypes: string[];
  frequencyLabel: string;
  identityCount: number;
  status: string;
  priority: number;
};

function keysOf(r: Record<string, unknown>): Map<string, string> {
  return new Map(Object.keys(r).map((k) => [k.toLowerCase(), k]));
}

function getField(r: Record<string, unknown>, ...names: string[]): unknown {
  const byLower = keysOf(r);
  for (const n of names) {
    const actual = byLower.get(n.toLowerCase());
    if (actual !== undefined) return r[actual];
  }
  return undefined;
}

function strField(r: Record<string, unknown>, ...names: string[]): string {
  const v = getField(r, ...names);
  if (v == null) return "";
  const s = String(v).trim();
  return s;
}

function numField(r: Record<string, unknown>, ...names: string[]): number {
  const v = getField(r, ...names);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** PostgreSQL array text format, e.g. `{api_key,service_account}` (not JSON). */
function parsePostgresArrayLiteral(s: string): string[] {
  const t = s.trim();
  if (!t.startsWith("{") || !t.endsWith("}")) return [];
  const inner = t.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(",").map((x) => x.trim()).filter(Boolean);
}

function humanizeScopeToken(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  return s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function parseNhiTypes(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v.map((x) => humanizeScopeToken(String(x))).filter(Boolean);
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return [];
    if (t.startsWith("{") && t.endsWith("}")) {
      const pg = parsePostgresArrayLiteral(t);
      if (pg.length) {
        return pg.map(humanizeScopeToken).filter(Boolean);
      }
      try {
        const p = JSON.parse(t) as unknown;
        if (Array.isArray(p)) {
          return p.map((x) => humanizeScopeToken(String(x))).filter(Boolean);
        }
      } catch {
        /* fall through */
      }
    }
    if (t.startsWith("[") && t.endsWith("]")) {
      try {
        const p = JSON.parse(t) as unknown;
        if (Array.isArray(p)) {
          return p.map((x) => humanizeScopeToken(String(x))).filter(Boolean);
        }
      } catch {
        /* fall through */
      }
    }
    return t
      .split(/[,;]/)
      .map((s) => humanizeScopeToken(s))
      .filter(Boolean);
  }
  return [];
}

/** API returns lowercase; normalize for display and filter dropdowns. */
function normalizePolicyStatus(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "—";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatFrequency(r: Record<string, unknown>): string {
  const label = strField(
    r,
    "rotation_frequency_label",
    "frequency_label",
    "cadence_label",
    "frequency_display",
    "rotation_frequency_display"
  );
  if (label) return label;
  const days = numField(r, "frequency_days", "rotation_days", "cadence_days", "rotation_interval_days");
  if (days > 0) return `Every ${days} days`;
  const raw = strField(r, "rotation_frequency", "frequency", "cadence", "rotation_cadence");
  return raw || "—";
}

export function parseRotationPolicyGridRow(raw: Record<string, unknown>, index: number): RotationPolicyGridRow {
  const r = { ...raw };
  const id =
    strField(r, "rotation_policy_id", "policy_id", "nhi_rotation_policy_id", "id") ||
    `row-${index}-${strField(r, "name", "policy_name") || index}`;

  const nhiTypesRaw = getField(
    r,
    "scope_nhi_types",
    "nhi_types",
    "applicable_nhi_types",
    "nhi_type_labels",
    "identity_types",
    "covered_nhi_types"
  );

  const statusRaw = strField(r, "status", "policy_status", "state");
  const status = statusRaw ? normalizePolicyStatus(statusRaw) : "—";

  const priority = numField(r, "priority", "sort_priority");

  return {
    id,
    name: strField(r, "name", "policy_name", "title") || "—",
    description: strField(r, "description", "summary", "notes", "policy_description"),
    nhiTypes: parseNhiTypes(nhiTypesRaw),
    frequencyLabel: formatFrequency(r),
    identityCount: numField(
      r,
      "identity_count",
      "identities_count",
      "assigned_identity_count",
      "n_identities",
      "covered_identity_count"
    ),
    status,
    priority,
  };
}

export function parseRotationPolicyGridResponse(response: unknown): RotationPolicyGridRow[] {
  const raw = extractResultRows(response);
  return raw.map((row, i) => {
    const obj = coerceRowObject(row) ?? (row as Record<string, unknown>);
    return parseRotationPolicyGridRow(obj, i);
  });
}
