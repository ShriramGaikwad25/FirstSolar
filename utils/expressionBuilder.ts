/**
 * Converts flat expression list (attribute, operator, value, logicalOp per row)
 * into nested structure: { operator: "OR"|"AND", conditions: [ ... ] }
 * where each condition is either { field, operator, value } or a nested group.
 *
 * logicalOp on condition[i] is the operator between condition[i-1] and condition[i].
 * We split at OR to form segments; each segment is ANDed; segments are ORed at top level.
 */
export type NestedConditionLeaf = {
  field: string;
  operator: string;
  value: unknown;
};

export type NestedConditionGroup = {
  operator: "AND" | "OR";
  conditions: (NestedConditionLeaf | NestedConditionGroup)[];
};

export type NestedExpression = NestedConditionGroup;

function toLeaf(exp: {
  attribute?: { value?: string } | string | null;
  operator?: { value?: string } | string | null;
  value?: unknown;
}): NestedConditionLeaf {
  const field = exp.attribute && typeof exp.attribute === "object" && "value" in exp.attribute
    ? (exp.attribute as { value?: string }).value
    : typeof exp.attribute === "string"
    ? exp.attribute
    : "";
  const operator = exp.operator && typeof exp.operator === "object" && "value" in exp.operator
    ? (exp.operator as { value?: string }).value
    : typeof exp.operator === "string"
    ? exp.operator
    : "";
  return {
    field: field ?? "",
    operator: operator ?? "",
    value: exp.value !== undefined && exp.value !== null ? exp.value : "",
  };
}

export function buildNestedExpression(expressions: any[]): NestedExpression | null {
  if (!expressions || expressions.length === 0) return null;

  const flat = expressions as Array<{
    attribute?: { value?: string } | string | null;
    operator?: { value?: string } | string | null;
    value?: unknown;
    logicalOp?: string | { value?: string; label?: string };
  }>;

  const getLogicalOp = (exp: (typeof flat)[0]): string => {
    const op = exp.logicalOp;
    if (!op) return "AND";
    if (typeof op === "string") return op;
    return (op as { value?: string }).value ?? "AND";
  };

  // Split into segments at OR: when conditions[i].logicalOp === "OR", new segment starts at i
  const segments: typeof flat[] = [];
  let current: typeof flat = [flat[0]];

  for (let i = 1; i < flat.length; i++) {
    if (getLogicalOp(flat[i]) === "OR") {
      segments.push(current);
      current = [flat[i]];
    } else {
      current.push(flat[i]);
    }
  }
  segments.push(current);

  // Only AND: single level { operator: "AND", conditions: [ leaf, leaf, ... ] }
  if (segments.length === 1) {
    return {
      operator: "AND",
      conditions: segments[0].map((exp) => toLeaf(exp)),
    };
  }

  // Has OR: nested — { operator: "OR", conditions: [ { operator: "AND", conditions: [ ... ] }, ... ] }
  return {
    operator: "OR",
    conditions: segments.map((seg) => ({
      operator: "AND" as const,
      conditions: seg.map((exp) => toLeaf(exp)),
    })),
  };
}
