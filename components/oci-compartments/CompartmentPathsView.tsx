"use client";

import { collectCompartmentPaths, selectTopCompartmentPaths } from "@/lib/compartments-api";
import type { CompartmentTreeNode } from "@/types/oci-compartments";
import { CompartmentCountDisplay } from "@/components/oci-compartments/CompartmentCountBadge";
import { ZoomPanViewport } from "@/components/oci-compartments/ZoomPanViewport";

const PATH_LINE_COLORS = ["bg-red-700", "bg-blue-500", "bg-red-700", "bg-blue-500"] as const;

function CompartmentPathColumn({
  path,
  colorClass,
}: {
  path: CompartmentTreeNode[];
  colorClass: string;
}) {
  const leaf = path[path.length - 1];

  return (
    <div className="flex w-[8.5rem] shrink-0 select-none flex-col items-center">
      <div className="relative flex w-full flex-col items-center gap-2.5 py-1">
        <div
          className={`absolute bottom-2 left-1/2 top-2 w-1 -translate-x-1/2 rounded-full ${colorClass}`}
          aria-hidden
        />
        {path.map((node, index) => {
          const isLast = index === path.length - 1;
          return (
            <div
              key={`${node.id}-${index}`}
              className="relative z-10 w-full overflow-visible rounded-lg bg-[#004a77] px-2 py-1.5 text-center text-[11px] font-medium text-white [overflow-wrap:anywhere]"
            >
              {index === 0 ? "Root" : node.name}
              {isLast ? (
                <CompartmentCountDisplay node={node} variant="badge" countMode="cumulative" />
              ) : null}
            </div>
          );
        })}
        {leaf.resourceType ? (
          <span className="relative z-10 text-center text-[10px] font-medium text-blue-900">
            {leaf.resourceType}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function CompartmentPathsView({ root }: { root: CompartmentTreeNode | null }) {
  const allPaths = root ? collectCompartmentPaths(root) : [];
  const paths = selectTopCompartmentPaths(allPaths, 3);

  return (
    <ZoomPanViewport
      title="Paths"
      empty={!root || paths.length === 0}
      emptyMessage={
        root ? "No paths to display." : "Paths appear when compartment data loads."
      }
      fitKey={paths.map((path) => path.map((node) => node.id).join(">")).join("|")}
      footer={
        paths.length > 0
          ? allPaths.length > paths.length
            ? `Top ${paths.length} of ${allPaths.length} paths by policy count · drag to pan · scroll to zoom`
            : `${paths.length} paths · drag to pan · scroll to zoom`
          : undefined
      }
    >
      <div className="flex gap-5 p-4">
        {paths.map((path, index) => (
          <CompartmentPathColumn
            key={`${path.map((node) => node.id).join(">")}-${index}`}
            path={path}
            colorClass={PATH_LINE_COLORS[index % PATH_LINE_COLORS.length]}
          />
        ))}
      </div>
    </ZoomPanViewport>
  );
}
