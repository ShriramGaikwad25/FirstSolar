/**
 * My NHIs helpers — ported from NHI_V2 src/pages/MyNHIs.jsx + src/api/client.js.
 * Uses nhiV2ExecuteQuery for row normalisation only; no ispm fallback/probe logic.
 */
import { nhiV2ExecuteQuery, nhiV2ExecuteScalar } from "@/lib/nhi-v2-api";

export const MY_NHIS_QUERY = `SELECT * FROM public.kf_nhi_get_my_nhis(?::uuid)`;

/** Exact SQL from NHI_V2 MyNHIs.jsx user resolve. */
export const USR_RESOLVE_MY_NHIS_QUERY = `SELECT userid FROM public.usr
              WHERE lower(username) = 'acmeadmin'
                 OR lower(email::text) LIKE lower(?::text)
              LIMIT 1`;

export const USR_PICKER_QUERY = `SELECT userid,
                  COALESCE(displayname,
                           NULLIF(btrim(coalesce(firstname,'')||' '||coalesce(lastname,'')),''),
                           username) AS fullname,
                  username
             FROM public.usr
            WHERE username NOT LIKE 'Identity\\_%' ESCAPE '\\'
            ORDER BY fullname
            LIMIT 1000`;

export const CRITICALITY_OPTIONS = [
  { code: "tier0_mission_critical", label: "Tier 0 — Mission critical" },
  { code: "tier1_critical", label: "Tier 1 — Critical" },
  { code: "tier2_important", label: "Tier 2 — Important" },
  { code: "tier3_standard", label: "Tier 3 — Standard" },
  { code: "tier4_low", label: "Tier 4 — Low" },
] as const;

export const TYPE_ICON: Record<string, string> = {
  agent: "🤖",
  bot: "🤖",
  service_account: "⚙️",
  api_key: "🔑",
  token: "🎫",
  certificate: "📜",
  ssh_key: "🗝️",
  webhook: "🪝",
  managed_identity: "☁️",
};

export type MyNhiRow = Record<string, unknown>;

export type UsrPickerRow = {
  userid: string;
  fullname: string;
  username: string;
};

/** NHI_V2 AuthContext user shape subset. */
export type NhiV2AuthUser = {
  userid?: string;
  preferred_username?: string;
  username?: string;
  sub?: string;
  email?: string;
};

export function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

export function asText(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

export function asNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return 0;
}

export async function runRows(query: string, parameters: unknown[] = []): Promise<MyNhiRow[]> {
  const { rows } = await nhiV2ExecuteQuery(query, parameters);
  return rows;
}

export async function runScalar(query: string, parameters: unknown[] = []): Promise<unknown> {
  return nhiV2ExecuteScalar(query, parameters);
}

/** Ported from NHI_V2 normalize.js — Postgres text[] literals. */
export function toArray(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v !== "string") return [];
  const s = v.trim();
  if (s === "" || s === "{}" || s === "[]" || s === "null") return [];
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s) as unknown;
      return Array.isArray(parsed) ? parsed.map((x) => String(x)).filter(Boolean) : [];
    } catch {
      /* fall through */
    }
  }
  if (s.startsWith("{") && s.endsWith("}")) {
    const inner = s.slice(1, -1);
    if (!inner) return [];
    return inner.split(",").map((t) => t.trim().replace(/^"|"$/g, "")).filter(Boolean);
  }
  return [s];
}

function normalizeMyNhiRows(rows: MyNhiRow[]): MyNhiRow[] {
  return rows.map((r) => ({ ...r, tags: toArray(r.tags) }));
}

/**
 * NHI_V2 MyNHIs.jsx usernameCandidates — do NOT inject ispm cookie/localStorage UUIDs.
 */
export function nhiV2UsernameCandidates(user: NhiV2AuthUser | null | undefined): string[] {
  return [
    user?.userid,
    user?.preferred_username,
    user?.username,
    user?.sub,
    user?.email,
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
}

/** Map ispm AuthContext user to NHI_V2 candidates (email only — same as bearer demo). */
export function nhiV2UsernameCandidatesFromIspm(
  authEmail?: string | null
): string[] {
  return nhiV2UsernameCandidates({ email: authEmail?.trim() || undefined });
}

/**
 * NHI_V2 MyNHIs.jsx resolve loop — UUID direct, else acmeadmin SQL.
 */
export async function resolveMyNhisActorUserId(
  candidates: string[]
): Promise<string | null> {
  for (const cand of candidates) {
    if (isUuid(cand)) return cand;
    const rows = await runRows(USR_RESOLVE_MY_NHIS_QUERY, [`${cand}%`]);
    const userid = rows[0]?.userid;
    if (userid) return asText(userid);
  }
  return null;
}

/** NHI_V2 MyNHIs.jsx load — executeQuery rows directly. */
export async function loadMyNhisRows(userid: string): Promise<MyNhiRow[]> {
  const { rows } = await nhiV2ExecuteQuery(MY_NHIS_QUERY, [userid]);
  return normalizeMyNhiRows(rows);
}

export function timeago(iso: unknown): string {
  if (!iso) return "";
  const d = new Date(asText(iso));
  if (Number.isNaN(d.getTime())) return "";
  const ms = Date.now() - d.getTime();
  const future = ms < 0;
  const abs = Math.abs(ms);
  const dy = Math.floor(abs / 86400000);
  const hr = Math.floor(abs / 3600000);
  if (dy > 0) return `${future ? "in " : ""}${dy}d${future ? "" : " ago"}`;
  if (hr > 0) return `${future ? "in " : ""}${hr}h${future ? "" : " ago"}`;
  return `${future ? "in " : ""}${Math.floor(abs / 60000)}m${future ? "" : " ago"}`;
}
