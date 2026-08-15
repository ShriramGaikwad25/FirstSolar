import {
  formatCompartmentCount,
  getCompartmentCumulativeCount,
  getCompartmentDisplayCount,
  getCompartmentSecondaryCount,
  nodeHasPolicyCounts,
} from "@/lib/compartments-api";
import type { CompartmentTreeNode } from "@/types/oci-compartments";

type CompartmentCountDisplayProps = {
  node: CompartmentTreeNode;
  variant?: "inline" | "badge";
  countMode?: "direct" | "cumulative";
  className?: string;
};

const BADGE_CLASS =
  "absolute -bottom-2 -right-2 z-20 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-none text-white shadow-md ring-2 ring-white";

function countLabel(node: CompartmentTreeNode, count: number): string {
  if (nodeHasPolicyCounts(node)) {
    return `${count.toLocaleString()} ${count === 1 ? "policy" : "policies"}`;
  }
  return `${count.toLocaleString()} resources`;
}

export function CompartmentCountDisplay({
  node,
  variant = "inline",
  countMode = "direct",
  className,
}: CompartmentCountDisplayProps) {
  const count =
    countMode === "cumulative"
      ? getCompartmentCumulativeCount(node)
      : getCompartmentDisplayCount(node);
  const secondary = countMode === "direct" ? getCompartmentSecondaryCount(node) : null;
  const showBadge = count != null && (nodeHasPolicyCounts(node) || count > 0);

  if (!showBadge && !secondary) return null;

  if (variant === "badge") {
    if (!showBadge) return null;
    return (
      <span className={className ?? BADGE_CLASS} title={countLabel(node, count!)}>
        {formatCompartmentCount(count!)}
      </span>
    );
  }

  return (
    <span
      className={
        className ??
        "mt-0.5 block text-[10px] font-bold leading-none tabular-nums text-white/90"
      }
      title={showBadge ? countLabel(node, count!) : secondary?.title}
    >
      {showBadge
        ? formatCompartmentCount(count!)
        : secondary
          ? `${secondary.value} sub`
          : null}
    </span>
  );
}

/** @deprecated Use CompartmentCountDisplay */
export const CompartmentCountBadge = CompartmentCountDisplay;
