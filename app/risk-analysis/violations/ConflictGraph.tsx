"use client";

// Conflict-path graph for a single violation.
//
// Backend returns { nodes, edges }. We layer nodes left-to-right by kind
// (USER → ENTITLEMENT → PRIVILEGE → FUNCTION → RULE) and feed the result
// into React Flow. Each kind has a distinct chip style.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getViolationPath } from "@/lib/api/rm";
import type { ConflictNode, ConflictNodeKind } from "@/types/rm-violations";

const COLUMN: Record<ConflictNodeKind, number> = {
  USER: 0,
  ENTITLEMENT: 1,
  PRIVILEGE: 2,
  FUNCTION: 3,
  RULE: 4,
};

const STYLE: Record<ConflictNodeKind, { bg: string; border: string; fg: string }> = {
  USER: { bg: "#eff6ff", border: "#3b82f6", fg: "#1e40af" },
  ENTITLEMENT: { bg: "#f5f3ff", border: "#8b5cf6", fg: "#5b21b6" },
  PRIVILEGE: { bg: "#fff7ed", border: "#f97316", fg: "#9a3412" },
  FUNCTION: { bg: "#ecfeff", border: "#06b6d4", fg: "#155e75" },
  RULE: { bg: "#fef2f2", border: "#dc2626", fg: "#991b1b" },
};

const FALLBACK_STYLE = { bg: "#f8fafc", border: "#94a3b8", fg: "#334155" };

const COL_WIDTH = 220;
const ROW_HEIGHT = 80;

type ChipNode = Node<ConflictNode, "chip">;

function layout(nodes: ConflictNode[]): Map<string, { x: number; y: number }> {
  // Bucket by kind, sort within bucket for deterministic order.
  const byKind = new Map<ConflictNodeKind, ConflictNode[]>();
  for (const n of nodes) {
    if (!byKind.has(n.kind)) byKind.set(n.kind, []);
    byKind.get(n.kind)!.push(n);
  }
  const pos = new Map<string, { x: number; y: number }>();
  byKind.forEach((bucket, kind) => {
    bucket.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    const x = (COLUMN[kind] ?? 0) * COL_WIDTH;
    const span = bucket.length;
    bucket.forEach((n, i) => {
      pos.set(n.id, { x, y: (i - (span - 1) / 2) * ROW_HEIGHT });
    });
  });
  return pos;
}

function NodeChip({ data }: NodeProps<ChipNode>) {
  const s = STYLE[data.kind] ?? FALLBACK_STYLE;
  return (
    <div
      className="min-w-[160px] max-w-[200px] rounded-[10px] border-2 px-3 py-2 text-xs font-semibold shadow-sm"
      style={{ background: s.bg, borderColor: s.border, color: s.fg }}
      title={data.detail ? JSON.stringify(data.detail) : undefined}
    >
      <div className="text-[10px] uppercase tracking-wide opacity-70">
        {data.kind}
        {data.side && (
          <span className="ml-1 rounded-sm px-1 text-white" style={{ background: s.border }}>
            {data.side}
          </span>
        )}
      </div>
      <div className="break-words">{data.label}</div>
      {data.sub && <div className="mt-0.5 text-[10px] font-normal opacity-80">{data.sub}</div>}
    </div>
  );
}

const nodeTypes = { chip: NodeChip };

export default function ConflictGraph({ violationId }: { violationId: number }) {
  const q = useQuery({
    queryKey: ["violation-path", violationId],
    queryFn: async () => (await getViolationPath(violationId)).data,
  });

  const { rfNodes, rfEdges } = useMemo(() => {
    if (!q.data) return { rfNodes: [] as ChipNode[], rfEdges: [] as Edge[] };
    const positions = layout(q.data.nodes);
    const rfNodes: ChipNode[] = q.data.nodes.map((n) => ({
      id: n.id,
      type: "chip",
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      data: n,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      draggable: true,
    }));
    const rfEdges: Edge[] = q.data.edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      label: e.label ?? undefined,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
      style: { stroke: "#94a3b8" },
      labelStyle: { fontSize: 10, fill: "#64748b" },
      labelBgPadding: [4, 2] as [number, number],
      labelBgStyle: { fill: "#f8fafc", stroke: "#e2e8f0" },
    }));
    return { rfNodes, rfEdges };
  }, [q.data]);

  if (q.isLoading) return <div className="text-sm text-slate-500">Loading conflict path…</div>;
  if (q.error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {(q.error as Error).message}
      </div>
    );
  }
  if (!q.data || q.data.nodes.length === 0) {
    return <div className="text-sm text-slate-500">No path data available for this violation.</div>;
  }

  return (
    <div className="h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} color="#e2e8f0" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
