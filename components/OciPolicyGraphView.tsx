"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { OciPolicyGraphData } from "@/types/oci-policy-graph";
import { GRAPH_NODE_COLORS, GRAPH_NODE_KIND_LABELS } from "@/lib/oci-policy-graph";
import type { OciGraphNodeKind } from "@/types/oci-policy-graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-500">
      <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden />
      Loading graph engine…
    </div>
  ),
});

type GraphNode = {
  id: string;
  name: string;
  label: string;
  kind: OciGraphNodeKind;
  color: string;
};

type GraphLink = {
  source: string;
  target: string;
  type: string;
};

function toForceGraphData(data: OciPolicyGraphData) {
  const nodes: GraphNode[] = data.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    label: n.label,
    kind: n.kind,
    color: GRAPH_NODE_COLORS[n.kind] ?? "#94a3b8",
  }));

  const links: GraphLink[] = data.links.map((l) => ({
    source: l.source,
    target: l.target,
    type: l.type,
  }));

  return { nodes, links };
}

function nodeRadius(kind: OciGraphNodeKind): number {
  if (kind === "Policy") return 10;
  if (kind === "PolicyStatement") return 7;
  if (kind === "StatementType") return 6;
  return 5;
}

function truncateLabel(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return `${name.slice(0, maxLen - 1)}…`;
}

const LEGEND = (Object.keys(GRAPH_NODE_KIND_LABELS) as OciGraphNodeKind[]).map((kind) => ({
  kind,
  label: GRAPH_NODE_KIND_LABELS[kind],
}));

export function OciPolicyGraphView({
  graph,
  isLoading,
  isError,
  error,
  policyFilter,
  onPolicyFilterChange,
  statementLimit,
  onStatementLimitChange,
  policyNames,
  lockPolicyFilter = false,
  hideStatementLimit = false,
  hidePolicyFilter = false,
}: {
  graph: OciPolicyGraphData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  policyFilter: string;
  onPolicyFilterChange: (v: string) => void;
  statementLimit: number;
  onStatementLimitChange: (v: number) => void;
  policyNames: string[];
  lockPolicyFilter?: boolean;
  hideStatementLimit?: boolean;
  hidePolicyFilter?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const hasFitRef = useRef(false);
  const hoveredRef = useRef<GraphNode | null>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [dims, setDims] = useState({ width: 800, height: 520 });

  const setHoveredNode = useCallback((next: GraphNode | null) => {
    const prevId = hoveredRef.current?.id ?? null;
    const nextId = next?.id ?? null;
    if (prevId === nextId) return;

    hoveredRef.current = next;
    setHovered(next);
    graphRef.current?.refresh?.();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setDims({ width: el.clientWidth || 800, height: el.clientHeight || 520 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const forceData = useMemo(
    () => (graph ? toForceGraphData(graph) : { nodes: [], links: [] }),
    [graph]
  );

  const nodeCountsByKind = useMemo(() => {
    const counts = new Map<OciGraphNodeKind, number>();
    for (const node of forceData.nodes) {
      counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
    }
    return counts;
  }, [forceData.nodes]);

  useEffect(() => {
    hasFitRef.current = false;
  }, [forceData]);

  useEffect(() => {
    const g = graphRef.current;
    if (!g || forceData.nodes.length === 0) return;

    const linkForce = g.d3Force("link");
    linkForce?.distance((link: { source: GraphNode; target: GraphNode }) => {
      const sourceKind = typeof link.source === "object" ? link.source.kind : null;
      const targetKind = typeof link.target === "object" ? link.target.kind : null;
      if (sourceKind === "Policy" || targetKind === "Policy") return 90;
      if (sourceKind === "PolicyStatement" || targetKind === "PolicyStatement") return 65;
      return 45;
    });
    linkForce?.strength(0.7);

    g.d3Force("charge")?.strength(-220);
    g.d3Force("center")?.strength(0.04);
    g.d3ReheatSimulation();
  }, [forceData]);

  const fitGraph = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    g.zoomToFit(400, 56);
  }, []);

  const handleZoom = (factor: number) => {
    const g = graphRef.current;
    if (!g) return;
    g.zoom(g.zoom() * factor, 350);
  };

  const nodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode & { x?: number; y?: number };
      if (n.x == null || n.y == null) return;

      const active = hoveredRef.current;
      const isHovered = active?.id === n.id;
      const showLabel = n.kind === "Policy" || n.kind === "PolicyStatement";
      const radius = nodeRadius(n.kind);

      ctx.save();
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius + 1.5 / globalScale, 0, 2 * Math.PI);
      ctx.fillStyle = isHovered ? "rgba(29, 78, 216, 0.14)" : "rgba(255,255,255,0.9)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = n.color;
      ctx.fill();
      ctx.strokeStyle = isHovered ? "#1d4ed8" : "#f8fafc";
      ctx.lineWidth = (isHovered ? 2 : 1.5) / globalScale;
      ctx.stroke();
      ctx.restore();

      if (showLabel) {
        const fontSize = Math.min(Math.max(10 / globalScale, 3.5), 11);
        const maxLen = n.kind === "PolicyStatement" ? 30 : 22;
        const text = truncateLabel(n.name, maxLen);

        ctx.font = `${isHovered ? "600 " : "500 "}${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isHovered ? "#1e3a8a" : "#475569";
        ctx.fillText(text, n.x, n.y + radius + 4 / globalScale);
      }
    },
    []
  );

  const handleNodeHover = useCallback(
    (node: object | null) => {
      setHoveredNode((node as GraphNode | null) ?? null);
    },
    [setHoveredNode]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50 text-sm">
        {lockPolicyFilter && !hidePolicyFilter ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md">
            <span className="text-sm text-gray-600">Policy:</span>
            <span className="text-base font-bold text-gray-900">{policyFilter}</span>
          </span>
        ) : !lockPolicyFilter ? (
          <label className="flex items-center gap-2 text-gray-700 font-medium">
            Policy
            <select
              value={policyFilter}
              onChange={(e) => onPolicyFilterChange(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 min-w-[180px] max-w-[280px]"
            >
              <option value="">All (limited)</option>
              {policyNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {!hideStatementLimit && (
          <label className="flex items-center gap-2 text-gray-700 font-medium">
            Statements
            <select
              value={statementLimit}
              onChange={(e) => onStatementLimitChange(Number(e.target.value))}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm"
            >
              {[40, 60, 100, 150, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        {graph?.meta.truncated && (
          <span className="text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-md px-3 py-1">
            Showing first {graph.meta.statementLimit} statements
          </span>
        )}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => handleZoom(1.25)}
            className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(0.8)}
            className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={fitGraph}
            className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
            aria-label="Fit graph to view"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isLoading && !isError && forceData.nodes.length > 0 ? (
        <div className="shrink-0 flex items-center gap-2 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2">
          <span className="text-xs font-medium text-gray-500">Counts:</span>
          {LEGEND.map(({ kind, label }) => {
            const count = nodeCountsByKind.get(kind) ?? 0;
            if (count === 0) return null;
            return (
              <span
                key={kind}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700"
              >
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: GRAPH_NODE_COLORS[kind] }}
                />
                <span>{label}</span>
                <span className="font-bold tabular-nums text-gray-900">{count}</span>
              </span>
            );
          })}
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="flex-1 min-h-[420px] relative bg-[#f8fafc]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden />
          </div>
        )}
        {isError && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-sm text-red-700">
            {error?.message ?? "Failed to load graph"}
          </div>
        )}
        {!isLoading && !isError && forceData.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
            No graph data for this policy.
          </div>
        )}
        {!isLoading && !isError && forceData.nodes.length > 0 && (
          <ForceGraph2D
            ref={graphRef}
            graphData={forceData}
            nodeId="id"
            backgroundColor="rgba(0,0,0,0)"
            linkCurvature={0.18}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={0.92}
            linkColor={() => "rgba(100, 116, 139, 0.45)"}
            linkWidth={1.2}
            nodeVal={(node) => {
              const kind = (node as GraphNode).kind;
              if (kind === "Policy") return 16;
              if (kind === "PolicyStatement") return 10;
              return 6;
            }}
            onEngineStop={() => {
              if (hasFitRef.current) return;
              hasFitRef.current = true;
              fitGraph();
            }}
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => "replace"}
            nodePointerAreaPaint={(node, color, ctx, globalScale) => {
              const n = node as GraphNode & { x?: number; y?: number };
              if (n.x == null || n.y == null) return;
              const radius = nodeRadius(n.kind) + 8 / globalScale;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
              ctx.fill();
            }}
            onNodeHover={handleNodeHover}
            onBackgroundClick={() => setHoveredNode(null)}
            enableNodeDrag
            enableZoomInteraction
            enablePanInteraction
            warmupTicks={60}
            cooldownTicks={120}
            d3AlphaDecay={0.025}
            d3VelocityDecay={0.35}
            width={dims.width}
            height={dims.height}
          />
        )}
        {hovered && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[min(420px,calc(100%-1.5rem))] rounded-md border border-gray-200 bg-white/95 px-3 py-2 text-sm text-gray-700 shadow-md backdrop-blur-sm">
            <span className="font-semibold text-gray-900">{GRAPH_NODE_KIND_LABELS[hovered.kind]}</span>:{" "}
            <span className="break-all">{hovered.name}</span>
          </div>
        )}
      </div>

    </div>
  );
}
