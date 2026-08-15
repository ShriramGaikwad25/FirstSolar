"use client";

import { useMemo, useState } from "react";
import { Boxes, Database, Loader2 } from "lucide-react";
import {
  layoutCompartmentTree,
  truncateCompartmentLabel,
  type PositionedCompartmentNode,
} from "@/lib/compartment-tree-layout";
import {
  getCompartmentCumulativeCount,
  getCompartmentDisplayCount,
  nodeHasPolicyCounts,
} from "@/lib/compartments-api";
import type { CompartmentTreeNode } from "@/types/oci-compartments";
import { CompartmentCountDisplay } from "@/components/oci-compartments/CompartmentCountBadge";
import { ZoomPanViewport } from "@/components/oci-compartments/ZoomPanViewport";

function ResourceTypeIcon({ resourceType }: { resourceType: string | null }) {
  const normalized = resourceType?.trim().toLowerCase() ?? "";
  if (normalized.includes("database") || normalized.includes("db")) {
    return <Database className="h-4 w-4 text-blue-100" aria-hidden />;
  }
  if (normalized.includes("instance") || normalized.includes("pool")) {
    return <Boxes className="h-4 w-4 text-blue-100" aria-hidden />;
  }
  return null;
}

function CompartmentTreeNodeCard({
  positioned,
  isHovered,
  onHover,
}: {
  positioned: PositionedCompartmentNode;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const { node, x, y, width, height } = positioned;
  const left = x - width / 2;
  const icon = node.children.length === 0 ? <ResourceTypeIcon resourceType={node.resourceType} /> : null;

  return (
    <div
      className="absolute overflow-visible"
      style={{ left, top: y, width, height }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div
        className={`relative flex h-full flex-col items-center justify-center overflow-visible rounded-lg border px-2 py-1.5 text-center shadow-sm transition-colors ${
          isHovered
            ? "border-blue-400 bg-blue-800"
            : "border-blue-950/40 bg-[#004a77]"
        }`}
      >
        <span className="line-clamp-2 text-[11px] font-medium leading-tight text-white [overflow-wrap:anywhere]">
          {truncateCompartmentLabel(node.name, 24)}
        </span>
        {icon ? <div className="mt-0.5">{icon}</div> : null}
        <CompartmentCountDisplay node={node} variant="badge" />
      </div>
    </div>
  );
}

export function CompartmentGraphView({
  root,
  isLoading,
  isError,
  error,
}: {
  root: CompartmentTreeNode | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const layout = useMemo(() => (root ? layoutCompartmentTree(root) : null), [root]);
  const hoveredNode = layout?.nodes.find((n) => n.id === hoveredId)?.node ?? null;
  const hoveredDirect = hoveredNode ? getCompartmentDisplayCount(hoveredNode) : null;
  const hoveredCumulative = hoveredNode ? getCompartmentCumulativeCount(hoveredNode) : null;
  const policyMode = hoveredNode ? nodeHasPolicyCounts(hoveredNode) : false;

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col">
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden />
        </div>
      )}
      {isError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4 text-sm text-red-700">
          {error?.message ?? "Failed to load compartment tree"}
        </div>
      )}

      <ZoomPanViewport
        title="Compartment hierarchy"
        empty={!isLoading && !isError && !layout}
        emptyMessage="No compartment data to display."
        fitKey={layout ? `${layout.width}x${layout.height}-${layout.nodes.length}` : undefined}
        footer={
          layout
            ? `${layout.nodes.length} compartments · drag to pan · scroll to zoom`
            : undefined
        }
      >
        {layout ? (
          <div
            className="relative"
            style={{ width: layout.width, height: layout.height }}
          >
            <svg
              width={layout.width}
              height={layout.height}
              className="pointer-events-none absolute inset-0"
              aria-hidden
            >
              {layout.edges.map((edge, index) => (
                <path
                  key={`edge-${index}`}
                  d={edge.path}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  markerEnd="url(#compartment-arrow)"
                />
              ))}
              <defs>
                <marker
                  id="compartment-arrow"
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L6,3 L0,6 Z" fill="#3b82f6" />
                </marker>
              </defs>
            </svg>
            {layout.nodes.map((positioned) => (
              <CompartmentTreeNodeCard
                key={positioned.id}
                positioned={positioned}
                isHovered={hoveredId === positioned.id}
                onHover={setHoveredId}
              />
            ))}
          </div>
        ) : (
          <div className="h-px w-px" aria-hidden />
        )}
      </ZoomPanViewport>

      {hoveredNode && (
        <div className="pointer-events-none absolute bottom-12 left-3 z-10 max-w-[min(420px,calc(100%-1.5rem))] rounded-md border border-gray-200 bg-white/95 px-3 py-2 text-sm text-gray-700 shadow-md backdrop-blur-sm">
          <span className="font-semibold text-gray-900">{hoveredNode.name}</span>
          {policyMode ? (
            <>
              {hoveredDirect != null ? (
                <span className="text-gray-600">
                  {" "}
                  · {hoveredDirect.toLocaleString()} direct
                </span>
              ) : null}
              {hoveredCumulative != null && hoveredCumulative !== hoveredDirect ? (
                <span className="text-gray-600">
                  {" "}
                  · {hoveredCumulative.toLocaleString()} cumulative
                </span>
              ) : null}
            </>
          ) : hoveredDirect != null ? (
            <span className="text-gray-600">
              {" "}
              · {hoveredDirect.toLocaleString()} resources
            </span>
          ) : null}
          {hoveredNode.resourceType ? (
            <span className="block text-xs text-gray-500">{hoveredNode.resourceType}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
