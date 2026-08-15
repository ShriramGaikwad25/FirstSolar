import type { CompartmentTreeNode } from "@/types/oci-compartments";

export const COMPARTMENT_NODE_WIDTH = 132;
export const COMPARTMENT_NODE_HEIGHT = 68;
export const COMPARTMENT_H_GAP = 32;
export const COMPARTMENT_V_GAP = 72;
export const COMPARTMENT_CANVAS_PADDING = 48;

export type PositionedCompartmentNode = {
  id: string;
  node: CompartmentTreeNode;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CompartmentTreeEdge = {
  path: string;
};

function measureSubtreeWidth(node: CompartmentTreeNode): number {
  if (node.children.length === 0) return COMPARTMENT_NODE_WIDTH;

  const childrenWidth = node.children.reduce(
    (sum, child) => sum + measureSubtreeWidth(child),
    0
  );
  const gaps = COMPARTMENT_H_GAP * Math.max(node.children.length - 1, 0);
  return Math.max(COMPARTMENT_NODE_WIDTH, childrenWidth + gaps);
}

function layoutSubtree(
  node: CompartmentTreeNode,
  left: number,
  depth: number,
  nodes: PositionedCompartmentNode[],
  edges: CompartmentTreeEdge[],
  parent?: PositionedCompartmentNode
): void {
  const subtreeWidth = measureSubtreeWidth(node);
  const x = left + subtreeWidth / 2;
  const y = COMPARTMENT_CANVAS_PADDING + depth * (COMPARTMENT_NODE_HEIGHT + COMPARTMENT_V_GAP);

  const positioned: PositionedCompartmentNode = {
    id: node.id,
    node,
    x,
    y,
    width: COMPARTMENT_NODE_WIDTH,
    height: COMPARTMENT_NODE_HEIGHT,
  };
  nodes.push(positioned);

  if (parent) {
    const parentBottom = parent.y + parent.height;
    const childTop = positioned.y;
    const midY = parentBottom + (childTop - parentBottom) / 2;
    edges.push({
      path: `M ${parent.x} ${parentBottom} V ${midY} H ${positioned.x} V ${childTop}`,
    });
  }

  if (node.children.length === 0) return;

  const childrenWidth =
    node.children.reduce((sum, child) => sum + measureSubtreeWidth(child), 0) +
    COMPARTMENT_H_GAP * Math.max(node.children.length - 1, 0);
  let childLeft = left + (subtreeWidth - childrenWidth) / 2;

  for (const child of node.children) {
    const childWidth = measureSubtreeWidth(child);
    layoutSubtree(child, childLeft, depth + 1, nodes, edges, positioned);
    childLeft += childWidth + COMPARTMENT_H_GAP;
  }
}

export function layoutCompartmentTree(root: CompartmentTreeNode): {
  nodes: PositionedCompartmentNode[];
  edges: CompartmentTreeEdge[];
  width: number;
  height: number;
} {
  const nodes: PositionedCompartmentNode[] = [];
  const edges: CompartmentTreeEdge[] = [];
  layoutSubtree(root, COMPARTMENT_CANVAS_PADDING, 0, nodes, edges);

  const maxX = Math.max(...nodes.map((n) => n.x + n.width / 2), COMPARTMENT_CANVAS_PADDING);
  const maxY = Math.max(...nodes.map((n) => n.y + n.height), COMPARTMENT_CANVAS_PADDING);

  return {
    nodes,
    edges,
    width: maxX + COMPARTMENT_CANVAS_PADDING,
    height: maxY + COMPARTMENT_CANVAS_PADDING,
  };
}

export function truncateCompartmentLabel(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return `${name.slice(0, maxLen - 1)}…`;
}
