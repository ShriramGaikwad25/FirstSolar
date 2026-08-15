import type { CompartmentTreeNode, CompartmentsTreeResult } from "@/types/oci-compartments";

/** KeyForge OCI compartments tree endpoint (ACMECOM tenant). */
export const COMPARTMENTS_API_URL =
  "https://graph.keyforge.ai/ociservice/api/v1/ACMECOM/resources/compartments";

export function isCompartmentsApiConfigured(): boolean {
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function readCountField(
  record: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }
  return null;
}

function readResourceCount(record: Record<string, unknown>): number | null {
  const direct = readCountField(
    record,
    "resourceCount",
    "resource_count",
    "totalResources",
    "total_resources",
    "numResources",
    "num_resources"
  );
  if (direct != null) return direct;

  const countField = readCountField(record, "count");
  if (countField != null && readDirectPolicyCount(record) == null) {
    return countField;
  }

  const resources = record.resources ?? record.resourceItems ?? record.items;
  if (Array.isArray(resources) && resources.length > 0) return resources.length;

  const stats = record.stats ?? record.summary;
  if (isRecord(stats)) {
    const nested = readResourceCount(stats);
    if (nested != null) return nested;
  }

  return null;
}

function readDirectPolicyCount(record: Record<string, unknown>): number | null {
  return readCountField(record, "directPolicyCount", "direct_policy_count");
}

function readCumulativePolicyCount(record: Record<string, unknown>): number | null {
  return readCountField(record, "cumulativePolicyCount", "cumulative_policy_count");
}

function readResourceType(record: Record<string, unknown>): string | null {
  return (
    readOptionalString(
      record,
      "resourceType",
      "resource_type",
      "type",
      "kind",
      "leafType",
      "leaf_type"
    ) ?? null
  );
}

function readNodeId(record: Record<string, unknown>, fallback: string): string {
  return (
    readOptionalString(
      record,
      "id",
      "compartmentId",
      "compartment_id",
      "ocid",
      "identifier"
    ) ?? fallback
  );
}

function readNodeName(record: Record<string, unknown>, fallback: string): string {
  return (
    readOptionalString(
      record,
      "name",
      "displayName",
      "display_name",
      "compartmentName",
      "compartment_name",
      "label",
      "title"
    ) ?? fallback
  );
}

function parseCompartmentNode(record: Record<string, unknown>, index: number): CompartmentTreeNode {
  const childrenRaw =
    record.children ??
    record.childCompartments ??
    record.child_compartments ??
    record.compartments ??
    record.nodes;

  const children = Array.isArray(childrenRaw)
    ? childrenRaw
        .filter(isRecord)
        .map((child, childIndex) => parseCompartmentNode(child, childIndex))
    : [];

  let resourceCount = readResourceCount(record);
  const directPolicyCount = readDirectPolicyCount(record);
  const cumulativePolicyCount = readCumulativePolicyCount(record);
  const resourceType = readResourceType(record);
  if (resourceCount == null && children.length === 0 && resourceType) {
    resourceCount = 1;
  }

  return {
    id: readNodeId(record, `compartment-${index}`),
    name: readNodeName(record, `Compartment ${index + 1}`),
    resourceCount,
    directPolicyCount,
    cumulativePolicyCount,
    resourceType,
    children,
  };
}

function buildTreeFromFlat(records: Record<string, unknown>[]): CompartmentTreeNode | null {
  if (records.length === 0) return null;

  const nodes = new Map<string, CompartmentTreeNode>();
  const parentById = new Map<string, string | null>();

  records.forEach((record, index) => {
    const id = readNodeId(record, `flat-${index}`);
    nodes.set(id, {
      id,
      name: readNodeName(record, `Compartment ${index + 1}`),
      resourceCount: readResourceCount(record),
      directPolicyCount: readDirectPolicyCount(record),
      cumulativePolicyCount: readCumulativePolicyCount(record),
      resourceType: readResourceType(record),
      children: [],
    });

    const parentId = readOptionalString(
      record,
      "parentId",
      "parent_id",
      "parentCompartmentId",
      "parent_compartment_id",
      "parentOcid",
      "parent_ocid"
    );
    parentById.set(id, parentId ?? null);
  });

  const roots: CompartmentTreeNode[] = [];

  for (const [id, node] of nodes) {
    const parentId = parentById.get(id);
    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  if (roots.length === 1) return roots[0];
  if (roots.length === 0) return null;

  return {
    id: "synthetic-root",
    name: "Root",
    resourceCount: roots.reduce((sum, node) => sum + (node.resourceCount ?? 0), 0) || null,
    directPolicyCount: null,
    cumulativePolicyCount: null,
    resourceType: null,
    children: roots,
  };
}

function extractCompartmentRecords(payload: unknown): Record<string, unknown>[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.filter(isRecord);

  if (!isRecord(payload)) return [];

  const hierarchy = payload.hierarchy;
  if (isRecord(hierarchy)) return [hierarchy];

  const nested =
    payload.compartments ??
    payload.items ??
    payload.data ??
    payload.results ??
    payload.nodes;

  if (Array.isArray(nested)) return nested.filter(isRecord);

  if (isRecord(nested)) {
    const inner =
      nested.compartments ?? nested.items ?? nested.children ?? nested.nodes;
    if (Array.isArray(inner)) return inner.filter(isRecord);
  }

  const rootCandidate =
    payload.root ?? payload.tree ?? payload.compartment ?? payload.tenancy;
  if (isRecord(rootCandidate)) return [rootCandidate];

  return [payload];
}

function parseRootNode(records: Record<string, unknown>[]): CompartmentTreeNode | null {
  if (records.length === 0) return null;

  const first = records[0];
  const hasNestedChildren = [first.children, first.childCompartments, first.compartments].some(
    Array.isArray
  );

  if (records.length === 1 && hasNestedChildren) {
    return parseCompartmentNode(first, 0);
  }

  const hasParentRefs = records.some((record) =>
    Boolean(
      readOptionalString(
        record,
        "parentId",
        "parent_id",
        "parentCompartmentId",
        "parent_compartment_id"
      )
    )
  );

  if (hasParentRefs || records.length > 1) {
    return buildTreeFromFlat(records);
  }

  return parseCompartmentNode(first, 0);
}

export function parseCompartmentsPayload(payload: unknown): CompartmentsTreeResult {
  const record = isRecord(payload) ? payload : {};
  const records = extractCompartmentRecords(payload);
  const root = parseRootNode(records);

  const hierarchy = isRecord(record.hierarchy) ? record.hierarchy : null;
  const totalPolicies = readCountField(record, "totalPolicies", "total_policies");

  return {
    tenancyId:
      readOptionalString(record, "tenancyId", "tenancy_id") ??
      (hierarchy ? readOptionalString(hierarchy, "ocid", "id") : undefined) ??
      null,
    tenancyName:
      readOptionalString(record, "tenancyName", "tenancy_name", "name", "displayName") ??
      (hierarchy ? readOptionalString(hierarchy, "name") : undefined) ??
      root?.name ??
      null,
    totalPolicies,
    root,
  };
}

function parseApiError(text: string, status: number, statusText: string): string {
  if (!text.trim()) {
    return `Compartments API request failed (${status} ${statusText})`;
  }
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    const message = body.message ?? body.error ?? body.statusMessage;
    if (typeof message === "string" && message.trim()) return message.trim();
  } catch {
    // not JSON
  }
  return text;
}

export async function fetchCompartmentsTree(
  bearerToken?: string | null
): Promise<CompartmentsTreeResult> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const token = bearerToken?.trim() || process.env.POLICY_OPTIMIZATION_API_KEY?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(COMPARTMENTS_API_URL, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(parseApiError(text, res.status, res.statusText)) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const payload = (await res.json()) as unknown;
  return parseCompartmentsPayload(payload);
}

export function collectCompartmentPaths(
  node: CompartmentTreeNode,
  prefix: CompartmentTreeNode[] = []
): CompartmentTreeNode[][] {
  const path = [...prefix, node];
  if (node.children.length === 0) return [path];
  return node.children.flatMap((child) => collectCompartmentPaths(child, path));
}

export function sumPathResourceCounts(path: CompartmentTreeNode[]): number {
  const leaf = path[path.length - 1];
  if (leaf?.cumulativePolicyCount != null) {
    return leaf.cumulativePolicyCount;
  }

  return path.reduce(
    (sum, node) => sum + (node.directPolicyCount ?? node.resourceCount ?? 0),
    0
  );
}

export function selectTopCompartmentPaths(
  paths: CompartmentTreeNode[][],
  limit = 3
): CompartmentTreeNode[][] {
  if (limit <= 0 || paths.length <= limit) return paths;

  return [...paths]
    .sort((a, b) => sumPathResourceCounts(b) - sumPathResourceCounts(a))
    .slice(0, limit);
}

export function formatCompartmentCount(count: number): string {
  if (count > 999_999) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count > 999) return `${Math.round(count / 1000)}k`;
  return String(count);
}

/** Direct policy count on the node, or legacy resource count. */
export function getCompartmentDisplayCount(node: CompartmentTreeNode): number | null {
  if (node.directPolicyCount != null) {
    return node.directPolicyCount;
  }

  if (node.resourceCount != null && node.resourceCount > 0) {
    return node.resourceCount;
  }

  if (node.children.length === 0) {
    return node.directPolicyCount;
  }

  const childTotal = node.children.reduce(
    (sum, child) => sum + (getCompartmentDisplayCount(child) ?? 0),
    0
  );
  return childTotal > 0 ? childTotal : null;
}

export function getCompartmentCumulativeCount(node: CompartmentTreeNode): number | null {
  if (node.cumulativePolicyCount != null) {
    return node.cumulativePolicyCount;
  }
  return getCompartmentDisplayCount(node);
}

export function nodeHasPolicyCounts(node: CompartmentTreeNode): boolean {
  return node.directPolicyCount != null || node.cumulativePolicyCount != null;
}

/** Shown when no resource count is available (e.g. parent with child compartments only). */
export function getCompartmentSecondaryCount(
  node: CompartmentTreeNode
): { value: number; title: string } | null {
  if (getCompartmentDisplayCount(node) != null) return null;
  if (node.children.length > 0) {
    return {
      value: node.children.length,
      title: `${node.children.length} sub-compartments`,
    };
  }
  return null;
}
