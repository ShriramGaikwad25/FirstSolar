"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { executeQuery } from "@/lib/api";
import { coerceRowObject, extractResultRows } from "@/lib/nhi-dashboard";

const TENANT_ID = "a0000000-0000-0000-0000-000000000001";

type Identity = {
  nhi_id: string;
  name: string;
  nhi_type: string;
  state?: string;
  risk_level?: string;
};

/**
 * Edge from `kf_nhi_lineage_walk` — UI maps each node to `target_label` + `target_node_type`,
 * and each link to `edge_relation`.
 */
export type LineageWalkEdge = {
  node_origin: "Upstream" | "Downstream";
  depth: number;
  source_id: string;
  target_id: string;
  source_label: string;
  target_label: string;
  source_node_type: string;
  target_node_type: string;
  edge_relation: string;
  concatenated_entitlements: string;
};

type LayoutNode = {
  id: string;
  x: number;
  y: number;
  /** Maps API `target_label` (and focal name from Identity row). */
  target_label: string;
  /** Maps API `target_node_type` (formatted for display). */
  target_node_type: string;
  /** Raw API `target_node_type` (e.g. `account`). */
  raw_target_node_type: string;
  kind: "focal" | "upstream" | "downstream" | "entitlement_synth";
  /** Parsed from walk; expanded into child entitlement nodes when present. */
  grant_entitlements?: string;
};

type LayoutEdge = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Maps API `edge_relation`. */
  edge_relation: string;
  dashed: boolean;
  /** Optional label anchor (mid-edge for pills; on-segment for inline “grants”). */
  pillX?: number;
  pillY?: number;
};

/** Synthetic account→entitlement edges use relation `grants`; draw label on the stroke, not as a pill. */
function isGrantsInlineEdge(edge_relation: string): boolean {
  return edge_relation.trim().toLowerCase() === "grants";
}

/** Keep angled edge labels readable (avoid upside-down text). */
function edgeLabelRotationDeg(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg > 90) deg -= 180;
  if (deg < -90) deg += 180;
  return deg;
}

function asText(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function normalizeFieldKey(k: string): string {
  return k.toLowerCase().replace(/[\s_-]/g, "");
}

function pickRowField(row: Record<string, unknown>, ...candidateNames: string[]): string {
  const byNorm = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normalizeFieldKey(k), v])
  );
  for (const name of candidateNames) {
    const v = byNorm[normalizeFieldKey(name)];
    if (v != null && String(v).trim() !== "") return asText(v);
  }
  return "";
}

function formatTargetNodeType(raw: string): string {
  const s = raw.trim();
  if (!s) return "Unknown";
  const key = s.toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    usr: "User",
    user: "User",
    identity: "Identity",
    owner: "Owner",
    account: "Account",
    security: "Security",
    applicationinstance: "Application",
    application: "Application",
    app: "Application",
    entitlement: "Entitlement",
    secret: "Secret",
    nhi: "NHI",
    ai_agent: "AI Agent",
    agent: "AI Agent",
  };
  if (map[key]) return map[key];
  if (/^[a-z_]+$/.test(key)) {
    return key
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return s;
}

function nodeTypeStyle(targetNodeType: string): { fill: string; stroke: string } {
  const t = targetNodeType.toLowerCase();
  if (t.includes("owner") || t.includes("user")) return { fill: "#dbeafe", stroke: "#2563eb" };
  if (t.includes("security")) return { fill: "#dcfce7", stroke: "#16a34a" };
  if (t.includes("application") || t === "app") return { fill: "#d1fae5", stroke: "#059669" };
  if (t.includes("secret")) return { fill: "#ffedd5", stroke: "#ea580c" };
  if (t.includes("entitlement")) return { fill: "#fee2e2", stroke: "#dc2626" };
  if (t.includes("account")) return { fill: "#e0e7ff", stroke: "#4f46e5" };
  if (t.includes("agent") || t.includes("nhi") || t.includes("identity")) return { fill: "#ede9fe", stroke: "#7c3aed" };
  return { fill: "#f1f5f9", stroke: "#64748b" };
}

function isDashedEdgeRelation(relation: string): boolean {
  const r = relation.toLowerCase();
  return r.includes("delegate") || r.includes("grant") || r.includes("permission");
}

/** Edges that carry `concatenated_entitlements` onto an account (API varies: Grants, grants, authenticates_as, …). */
function isEntitlementCarryingEdgeRelation(relation: string): boolean {
  const r = relation.trim().toLowerCase().replace(/\s+/g, "_");
  if (!r) return false;
  if (r === "grants" || r === "grant") return true;
  if (r.includes("grant")) return true;
  if (r === "authenticates_as") return true;
  return false;
}

function normalizeEntitlementsValue(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map((x) => asText(x).trim()).filter(Boolean).join(", ");
  return asText(v).trim();
}

/** Read entitlements from row (string, array, or odd API shapes). */
function rowEntitlementsColumn(row: Record<string, unknown>): string {
  const byNorm = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normalizeFieldKey(k), v])
  );
  const v =
    byNorm[normalizeFieldKey("concatenated_entitlements")] ??
    byNorm[normalizeFieldKey("entitlements")];
  return normalizeEntitlementsValue(v);
}

function accountEntitlementsForNode(edges: LineageWalkEdge[], targetId: string): string {
  const chunks: string[] = [];
  for (const e of edges) {
    if (e.target_id !== targetId) continue;
    if (e.target_node_type.trim().toLowerCase() !== "account") continue;
    if (!isEntitlementCarryingEdgeRelation(e.edge_relation)) continue;
    const s = e.concatenated_entitlements.trim();
    if (s) chunks.push(s);
  }
  return chunks.length ? [...new Set(chunks)].join("; ") : "";
}

/** Split API `concatenated_entitlements` into individual entitlement labels (e.g. `payments:process`). */
function parseEntitlementNames(blob: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of blob.split(/[,;]+/)) {
    const s = part.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

const R_ENT = 26;

function expandAccountEntitlementsToGraph(
  nodes: LayoutNode[],
  layoutEdges: LayoutEdge[],
  nodePos: Map<string, { x: number; y: number }>,
  focalId: string,
  rFocal: number,
  rSat: number
): void {
  const radiusForId = (id: string) => {
    if (id.startsWith("syn-ent:")) return R_ENT;
    return id === focalId ? rFocal : rSat;
  };

  const parents = nodes.filter(
    (n) => n.grant_entitlements?.trim() && isAccountRawType(n.raw_target_node_type)
  );

  for (const parent of parents) {
    const names = parseEntitlementNames(parent.grant_entitlements!);
    if (!names.length) continue;
    parent.grant_entitlements = undefined;
    const p = nodePos.get(parent.id);
    if (!p) continue;

    const maxLen = Math.max(...names.map((s) => s.length), 1);
    /** Horizontal pitch between entitlement centers — scales with longest name so labels don’t collide. */
    const hSpacing = Math.max(168, Math.min(340, 64 + maxLen * 7.4));
    /** Extra drop so entitlement row clears labels above. */
    const rowY = p.y + 188;

    names.forEach((label, i) => {
      const id = `syn-ent:${parent.id}:${i}`;
      const x = p.x + (i - (names.length - 1) / 2) * hSpacing;
      const y = rowY;
      nodePos.set(id, { x, y });
      nodes.push({
        id,
        x,
        y,
        target_label: label,
        target_node_type: "Entitlement",
        raw_target_node_type: "entitlement",
        kind: "entitlement_synth",
      });
      const s = shortenLine(p.x, p.y, x, y, radiusForId(parent.id), R_ENT);
      const vx = s.x2 - s.x1;
      const vy = s.y2 - s.y1;
      /** Stagger along the segment so parallel grant labels stay on the line but don’t overlap. */
      const t = Math.min(0.82, Math.max(0.22, 0.58 + (i - (names.length - 1) / 2) * 0.038));
      const px = s.x1 + vx * t;
      const py = s.y1 + vy * t;
      layoutEdges.push({
        ...s,
        edge_relation: "grants",
        dashed: false,
        pillX: px,
        pillY: py,
      });
    });
  }
}

/** Tight axis-aligned bounds of all node graphics (circles + labels / entitlement cards). */
function layoutContentBounds(
  nodes: LayoutNode[],
  nodePos: Map<string, { x: number; y: number }>,
  rFocal: number,
  rSat: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const n of nodes) {
    const p = nodePos.get(n.id);
    if (!p) continue;
    const r =
      n.kind === "entitlement_synth" ? R_ENT : n.kind === "focal" ? rFocal : rSat;
    const top = p.y - r - 6;
    const bottom =
      n.kind === "entitlement_synth"
        ? p.y + r + 10 + 54 + 14
        : p.y + r + 52;
    minY = Math.min(minY, top);
    maxY = Math.max(maxY, bottom);
    const padX = n.kind === "entitlement_synth" ? 132 : 148;
    minX = Math.min(minX, p.x - padX);
    maxX = Math.max(maxX, p.x + padX);
  }
  if (!Number.isFinite(minY)) minY = 0;
  if (!Number.isFinite(maxY)) maxY = 400;
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(maxX)) maxX = 1020;
  return { minX, minY, maxX, maxY };
}

function paddedViewBox(b: { minX: number; minY: number; maxX: number; maxY: number }): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const padL = 56;
  const padR = 72;
  const padT = 64;
  const padB = 132;
  const innerW = b.maxX - b.minX;
  const innerH = b.maxY - b.minY;
  const w = Math.max(1020, innerW + padL + padR);
  const h = Math.max(620, innerH + padT + padB);
  return {
    x: b.minX - padL,
    y: b.minY - padT,
    w,
    h,
  };
}

function isAccountRawType(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t === "account" || t.endsWith("_account");
}

function parseLineageWalkRows(
  rows: Record<string, unknown>[],
  focalNhiId: string
): {
  identityHint: { nhi_id: string; target_label: string; target_node_type: string } | null;
  edges: LineageWalkEdge[];
} {
  let identityHint: { nhi_id: string; target_label: string; target_node_type: string } | null = null;
  const edges: LineageWalkEdge[] = [];
  const focalKey = focalNhiId.trim().toLowerCase();

  for (const row of rows) {
    const origin = asText(row.node_origin).trim();
    const o = origin.toLowerCase();
    if (o === "identity") {
      const nodeType =
        pickRowField(
          row,
          "target_node_type",
          "targetnodetype",
          "target_type",
          "node_type",
          "nodetype",
          "resource_type",
          "type"
        ) || "identity";
      const rowNhi = pickRowField(row, "target_id", "targetid", "nhi_id");
      identityHint = {
        nhi_id: rowNhi.trim() || focalNhiId,
        target_label: pickRowField(row, "target_label", "targetlabel", "label", "name", "target_name"),
        target_node_type: nodeType,
      };
      continue;
    }
    if (o !== "upstream" && o !== "downstream") continue;

    const source_id = pickRowField(row, "source_id", "sourceid");
    const target_id = pickRowField(row, "target_id", "targetid");
    if (!source_id || !target_id) continue;

    const depthRaw = row.depth;
    const depth =
      typeof depthRaw === "number" && !Number.isNaN(depthRaw)
        ? depthRaw
        : parseInt(asText(depthRaw), 10) || 0;

    edges.push({
      node_origin: o === "upstream" ? "Upstream" : "Downstream",
      depth,
      source_id,
      target_id,
      source_label: pickRowField(row, "source_label", "sourcelabel"),
      target_label: pickRowField(row, "target_label", "targetlabel"),
      source_node_type: pickRowField(row, "source_node_type", "sourcenodetype", "source_type"),
      target_node_type: pickRowField(row, "target_node_type", "targetnodetype", "target_type"),
      edge_relation: pickRowField(row, "edge_relation", "edgerelation", "relation"),
      concatenated_entitlements: rowEntitlementsColumn(row),
    });
  }

  const hint = identityHint;
  if (hint && focalKey && hint.nhi_id.trim().toLowerCase() !== focalKey) {
    return { identityHint: null, edges };
  }

  return { identityHint: hint, edges };
}

function shortenLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2: number
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: x1 + ux * r1,
    y1: y1 + uy * r1,
    x2: x2 - ux * r2,
    y2: y2 - uy * r2,
  };
}

function truncateLabel(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/** Up to two initials for inside the node circle (handles `svc_finance`, `oauth-agent-…`, SAP-style ids). */
function initialsFromLabel(raw: string, maxChars = 2): string {
  const s = raw.trim();
  if (!s) return "?";
  const parts = s.split(/[\s_\-./:]+/).filter((p) => p.length > 0);
  if (parts.length >= 2) {
    let out = "";
    for (const p of parts) {
      const m = p.match(/[a-zA-Z0-9]/);
      if (m) out += m[0].toUpperCase();
      if (out.length >= maxChars) return out;
    }
    return out || "?";
  }
  const alnum = s.match(/[a-zA-Z0-9]/g);
  if (!alnum?.length) return "?";
  if (alnum.length === 1) return alnum[0].toUpperCase();
  return (alnum[0] + alnum[1]).toUpperCase();
}

export type LineageGraphPageProps = {
  embeddedNhiId?: string | null;
};

export function LineageGraphPage(props: LineageGraphPageProps = {}) {
  const { embeddedNhiId = null } = props;
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [focalId, setFocalId] = useState(embeddedNhiId ?? "");
  const [focal, setFocal] = useState<Identity | null>(null);
  const [walkEdges, setWalkEdges] = useState<LineageWalkEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (embeddedNhiId) {
      setFocalId(embeddedNhiId);
      return;
    }
    (async () => {
      try {
        const rows = extractResultRows(
          await executeQuery<unknown>(
            `SELECT nhi_id, name, nhi_type
               FROM public.kf_nhi_identity
              WHERE tenant_id = ?::uuid
              ORDER BY name LIMIT 500`,
            [TENANT_ID]
          )
        );
        const parsed = rows.map((r) => ({
          nhi_id: asText(r.nhi_id),
          name: asText(r.name),
          nhi_type: asText(r.nhi_type),
        }));
        setIdentities(parsed);
        setFocalId((prev) => prev || (parsed.length ? parsed[0].nhi_id : ""));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load identities");
      } finally {
        setLoading(false);
      }
    })();
  }, [embeddedNhiId]);

  const loadLineage = useCallback(async () => {
    if (!focalId) return;
    setLoading(true);
    setError(null);
    try {
      const walkSql = `SELECT * FROM public.kf_nhi_lineage_walk(?::uuid)`;

      const [focalRows, walkRaw] = await Promise.all([
        extractResultRows(
          await executeQuery<unknown>(
            `SELECT nhi_id, name, nhi_type, state, risk_level
               FROM public.kf_nhi_identity
              WHERE tenant_id = ?::uuid AND nhi_id = ?::uuid`,
            [TENANT_ID, focalId]
          )
        ),
        extractResultRows(await executeQuery<unknown>(walkSql, [focalId])),
      ]);

      const walkRows: Record<string, unknown>[] = [];
      for (const raw of walkRaw) {
        const row =
          coerceRowObject(raw) ??
          (raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null);
        if (row) walkRows.push(row);
      }

      const { identityHint, edges: parsedEdges } = parseLineageWalkRows(walkRows, focalId);
      setWalkEdges(parsedEdges);

      const dbFocal = focalRows[0]
        ? {
            nhi_id: asText(focalRows[0].nhi_id),
            name: asText(focalRows[0].name),
            nhi_type: asText(focalRows[0].nhi_type),
            state: asText(focalRows[0].state),
            risk_level: asText(focalRows[0].risk_level),
          }
        : null;

      const coalesceTrim = (a: string, b: string) => {
        const ta = a.trim();
        const tb = b.trim();
        return ta || tb;
      };

      const hintMatchesFocal =
        !!identityHint &&
        identityHint.nhi_id.trim().toLowerCase() === focalId.trim().toLowerCase();

      if (dbFocal && hintMatchesFocal && identityHint) {
        setFocal({
          ...dbFocal,
          name: coalesceTrim(dbFocal.name, identityHint.target_label) || dbFocal.name || identityHint.target_label,
          nhi_type: coalesceTrim(dbFocal.nhi_type, identityHint.target_node_type),
        });
      } else if (dbFocal) {
        setFocal(dbFocal);
      } else if (hintMatchesFocal && identityHint) {
        setFocal({
          nhi_id: focalId,
          name: identityHint.target_label,
          nhi_type: identityHint.target_node_type.trim() || "identity",
          state: "",
          risk_level: "",
        });
      } else {
        setFocal(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lineage");
    } finally {
      setLoading(false);
    }
  }, [focalId]);

  useEffect(() => {
    void loadLineage();
  }, [loadLineage]);

  const layout = useMemo(
    () => buildWalkLineageLayout(focalId, focal, walkEdges),
    [focalId, focal, walkEdges]
  );

  const upstreamCount = useMemo(() => walkEdges.filter((e) => e.node_origin === "Upstream").length, [walkEdges]);
  const downstreamCount = useMemo(() => walkEdges.filter((e) => e.node_origin === "Downstream").length, [walkEdges]);

  return (
    <div className="w-full space-y-4 pb-8">
      {!embeddedNhiId && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Lineage Graph</h1>
          <div className="flex items-center gap-2">
            <select
              className="min-w-[300px] rounded border border-slate-300 px-3 py-1.5 text-sm"
              value={focalId}
              onChange={(e) => setFocalId(e.target.value)}
            >
              {identities.map((i) => (
                <option key={i.nhi_id} value={i.nhi_id}>
                  {i.name} — {i.nhi_type}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              onClick={() => void loadLineage()}
              title="Refresh"
              aria-label="Refresh"
            >
              ↻
            </button>
          </div>
        </div>
      )}
      {embeddedNhiId && (
        <div className="flex justify-end">
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => void loadLineage()}
            title="Refresh lineage"
            aria-label="Refresh lineage"
          >
            ↻ Refresh
          </button>
        </div>
      )}

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading && !focal && <div className="text-sm text-slate-500">Loading lineage…</div>}

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm text-slate-700">
          {focal ? (
            <>
              Focal — <span className="font-semibold text-slate-900">{focal.name}</span>{" "}
              <span className="text-slate-500">({formatTargetNodeType(focal.nhi_type)})</span>
              <span className="ml-3 text-xs text-slate-500">
                upstream={upstreamCount} · downstream={downstreamCount}
              </span>
            </>
          ) : (
            "No focal NHI"
          )}
        </div>

        <div className="max-h-[calc(100vh-140px)] min-h-[780px] overflow-x-auto overflow-y-auto rounded border border-slate-200 bg-slate-50 py-5">
          <svg
            viewBox={`${layout.viewBox.x} ${layout.viewBox.y} ${layout.viewBox.w} ${layout.viewBox.h}`}
            className="w-full"
            style={{
              fontFamily: "inherit",
              height: Math.min(960, Math.max(680, layout.viewBox.h * 0.98)),
              minHeight: 680,
            }}
            preserveAspectRatio="xMidYMid meet"
          >
            {layout.edges.map((e, i) => {
              const strokeProps = {
                stroke: "#94a3b8",
                strokeWidth: 1.5,
                strokeDasharray: e.dashed ? "6 4" : undefined,
              } as const;
              if (isGrantsInlineEdge(e.edge_relation)) {
                const lx = e.pillX ?? (e.x1 + e.x2) / 2;
                const ly = e.pillY ?? (e.y1 + e.y2) / 2;
                const dx = e.x2 - e.x1;
                const dy = e.y2 - e.y1;
                const len = Math.hypot(dx, dy) || 1;
                const ux = dx / len;
                const uy = dy / len;
                const tw = Math.max(14, e.edge_relation.length * 6.2 + 14);
                const halfGap = Math.min(len * 0.48, Math.max(tw / 2 + 6, 8));
                const xA = lx - ux * halfGap;
                const yA = ly - uy * halfGap;
                const xB = lx + ux * halfGap;
                const yB = ly + uy * halfGap;
                const rot = edgeLabelRotationDeg(e.x1, e.y1, e.x2, e.y2);
                return (
                  <g key={`e-line-${i}`}>
                    <line x1={e.x1} y1={e.y1} x2={xA} y2={yA} {...strokeProps} />
                    <line x1={xB} y1={yB} x2={e.x2} y2={e.y2} {...strokeProps} />
                    <g transform={`translate(${lx},${ly}) rotate(${rot})`}>
                      <title>{e.edge_relation}</title>
                      <rect
                        x={-tw / 2}
                        y={-10}
                        width={tw}
                        height={20}
                        rx={10}
                        ry={10}
                        fill="#ffffff"
                        stroke="#cbd5e1"
                        strokeWidth={1}
                      />
                      <text
                        x={0}
                        y={4}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={500}
                        fill="#475569"
                      >
                        {e.edge_relation}
                      </text>
                    </g>
                  </g>
                );
              }
              return (
                <line
                  key={`e-line-${i}`}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  {...strokeProps}
                />
              );
            })}

            {layout.edges.map((e, i) => {
              const label = e.edge_relation;
              if (!label || isGrantsInlineEdge(label)) return null;
              const mx = e.pillX ?? (e.x1 + e.x2) / 2;
              const my = e.pillY ?? (e.y1 + e.y2) / 2;
              const tw = Math.max(14, label.length * 6.2 + 14);
              return (
                <g key={`e-pill-${i}`} transform={`translate(${mx}, ${my})`}>
                  <title>{label}</title>
                  <rect
                    x={-tw / 2}
                    y={-10}
                    width={tw}
                    height={20}
                    rx={10}
                    ry={10}
                    fill="#ffffff"
                    stroke="#cbd5e1"
                    strokeWidth={1}
                  />
                  <text
                    x={0}
                    y={4}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={500}
                    fill="#475569"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {layout.nodes.map((n) => {
              if (n.kind === "entitlement_synth") {
                const r = R_ENT;
                const cardW = 236;
                const cardH = 54;
                const cardX = -cardW / 2;
                const cardY = r + 10;
                return (
                  <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                    <title>
                      {n.target_label}
                      {"\n"}
                      {n.target_node_type}
                    </title>
                    <circle r={r} fill="#fee2e2" stroke="#dc2626" strokeWidth={2} />
                    <text
                      x={0}
                      y={0}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={11}
                      fontWeight={700}
                      fill="#991b1b"
                    >
                      {initialsFromLabel(n.target_label)}
                    </text>
                    <foreignObject x={cardX} y={cardY} width={cardW} height={cardH}>
                      <div
                        xmlns="http://www.w3.org/1999/xhtml"
                        className="text-center text-[10px] font-semibold leading-tight text-slate-900"
                        style={{
                          whiteSpace: "nowrap",
                          overflowX: "auto",
                          overflowY: "hidden",
                          maxWidth: "100%",
                          scrollbarWidth: "thin",
                        }}
                      >
                        {n.target_label}
                        <div className="mt-0.5 text-[9px] font-normal text-slate-500">{n.target_node_type}</div>
                      </div>
                    </foreignObject>
                  </g>
                );
              }

              const r = n.kind === "focal" ? 46 : 34;
              const { fill, stroke } =
                n.kind === "focal" ? { fill: "#ede9fe", stroke: "#7c3aed" } : nodeTypeStyle(n.target_node_type);
              const labelY = r + 18;
              const typeY = r + 40;
              return (
                <g key={n.id} transform={`translate(${n.x}, ${n.y})`} style={{ pointerEvents: "all" }}>
                  <title>
                    {n.target_label}
                    {"\n"}
                    {n.target_node_type}
                  </title>
                  <circle r={r} fill={fill} stroke={stroke} strokeWidth={2} />
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={n.kind === "focal" ? 19 : 14}
                    fontWeight={700}
                    fill="#0f172a"
                  >
                    {initialsFromLabel(n.target_label)}
                  </text>
                  <text
                    y={labelY}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={600}
                    fill="#0f172a"
                    dominantBaseline="hanging"
                  >
                    {truncateLabel(n.target_label, 28)}
                  </text>
                  <text
                    y={typeY}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#64748b"
                    dominantBaseline="hanging"
                  >
                    {n.target_node_type}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>
    </div>
  );
}

function buildWalkLineageLayout(focalId: string, focal: Identity | null, edges: LineageWalkEdge[]) {
  const colStep = 272;
  const rFocal = 46;
  const rSat = 34;
  const hasAccountEntitlements = edges.some(
    (e) =>
      e.target_node_type.trim().toLowerCase() === "account" &&
      isEntitlementCarryingEdgeRelation(e.edge_relation) &&
      e.concatenated_entitlements.trim() !== ""
  );
  /** Space between stacked node centers — circle + labels (account entitlements fan out below as separate nodes). */
  const rowGap =
    Math.max(168, rFocal + 18 + 14 + 22 + 12 + 28 + rSat) + (hasAccountEntitlements ? 40 : 0);
  const leftX = 120;
  const cx = 340;

  const upstream = edges.filter((e) => e.node_origin === "Upstream");
  const downstream = edges.filter((e) => e.node_origin === "Downstream");
  const maxDownDepth = downstream.reduce((m, e) => Math.max(m, e.depth), 0);

  const upTargets = new Map<string, LineageWalkEdge>();
  for (const e of upstream) {
    if (!upTargets.has(e.target_id)) upTargets.set(e.target_id, e);
  }
  const upList = [...upTargets.values()];

  const depths = [...new Set(downstream.map((e) => e.depth))]
    .filter((d) => d >= 1)
    .sort((a, b) => a - b);
  const tierSizes = [
    upList.length,
    ...depths.map((d) => {
      const at = downstream.filter((e) => e.depth === d);
      const m = new Map<string, LineageWalkEdge>();
      for (const e of at) {
        if (!m.has(e.target_id)) m.set(e.target_id, e);
      }
      return m.size;
    }),
  ];
  const maxTier = Math.max(1, ...tierSizes);
  const height = Math.max(580, 200 + maxTier * rowGap);
  const width = Math.max(1020, cx + colStep * Math.max(1, maxDownDepth) + 200);

  const cy = height / 2;

  const nodes: LayoutNode[] = [];
  const layoutEdges: LayoutEdge[] = [];
  const nodePos = new Map<string, { x: number; y: number }>();

  const radiusFor = (id: string) => {
    if (id.startsWith("syn-ent:")) return R_ENT;
    return id === focalId ? rFocal : rSat;
  };

  const placeNode = (
    id: string,
    target_label: string,
    raw_target_node_type: string,
    kind: LayoutNode["kind"],
    x: number,
    y: number
  ) => {
    if (nodePos.has(id)) return;
    nodePos.set(id, { x, y });
    const raw = raw_target_node_type.trim();
    nodes.push({
      id,
      x,
      y,
      target_label: target_label.trim() || "—",
      target_node_type: formatTargetNodeType(raw_target_node_type),
      raw_target_node_type: raw || raw_target_node_type,
      kind,
    });
  };

  const drawEdge = (sourceId: string, targetId: string, edge_relation: string) => {
    const p1 = nodePos.get(sourceId);
    const p2 = nodePos.get(targetId);
    if (!p1 || !p2) return;
    const s = shortenLine(p1.x, p1.y, p2.x, p2.y, radiusFor(sourceId), radiusFor(targetId));
    layoutEdges.push({
      ...s,
      edge_relation,
      dashed: isDashedEdgeRelation(edge_relation),
    });
  };

  if (!focal) {
    return {
      viewBox: { x: 0, y: 0, w: width, h: height },
      nodes,
      edges: layoutEdges,
    };
  }

  placeNode(focal.nhi_id, focal.name, focal.nhi_type, "focal", cx, cy);

  const attachAccountGrantEntitlements = () => {
    for (const n of nodes) {
      if (!isAccountRawType(n.raw_target_node_type)) continue;
      const g = accountEntitlementsForNode(edges, n.id);
      if (g) n.grant_entitlements = g;
    }
  };

  upList.forEach((e, i) => {
    const n = upList.length;
    const y = cy + (i - (n - 1) / 2) * rowGap;
    placeNode(e.target_id, e.target_label, e.target_node_type, "upstream", leftX, y);
  });

  for (const d of depths) {
    const atD = downstream.filter((e) => e.depth === d);
    const byT = new Map<string, LineageWalkEdge>();
    for (const e of atD) {
      if (!byT.has(e.target_id)) byT.set(e.target_id, e);
    }
    const list = [...byT.values()];
    const x = cx + colStep * d;
    list.forEach((e, i) => {
      const n = list.length;
      const y = cy + (i - (n - 1) / 2) * rowGap;
      placeNode(e.target_id, e.target_label, e.target_node_type, "downstream", x, y);
    });
  }

  attachAccountGrantEntitlements();

  const edgeKey = new Set<string>();
  for (const e of upstream) {
    const k = `${e.source_id}|${e.target_id}|${e.edge_relation}`;
    if (edgeKey.has(k)) continue;
    edgeKey.add(k);
    drawEdge(e.source_id, e.target_id, e.edge_relation);
  }
  for (const e of downstream) {
    const k = `${e.source_id}|${e.target_id}|${e.edge_relation}`;
    if (edgeKey.has(k)) continue;
    edgeKey.add(k);
    drawEdge(e.source_id, e.target_id, e.edge_relation);
  }

  expandAccountEntitlementsToGraph(nodes, layoutEdges, nodePos, focalId, rFocal, rSat);
  const bounds = layoutContentBounds(nodes, nodePos, rFocal, rSat);
  const viewBox = paddedViewBox(bounds);

  return { viewBox, nodes, edges: layoutEdges };
}
