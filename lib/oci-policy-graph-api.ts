import { fetchPolicyList } from "@/lib/policy-list-api";
import { buildGraphFromPolicyListItem, graphNodeDisplayLabel } from "@/lib/oci-policy-graph";
import type { PolicyListItem, PolicyListStatement } from "@/types/oci-policy";
import type {
  OciGraphLink,
  OciGraphNode,
  OciGraphNodeKind,
  OciPolicyGraphData,
} from "@/types/oci-policy-graph";

/** KeyForge OCI policy graph endpoint (ACMECOM tenant). */
export const POLICY_GRAPH_API_URL =
  "https://graph.keyforge.ai/ociservice/api/v1/ACMECOM/policies/graph";

export function isPolicyGraphApiConfigured(): boolean {
  return true;
}

const NODE_LABEL_KIND_MAP: Record<string, OciGraphNodeKind> = {
  Policy: "Policy",
  PolicyStatement: "PolicyStatement",
  StatementType: "StatementType",
  Group: "Group",
  DynamicGroup: "Group",
  DYNAMIC_GROUP: "Group",
  Subject: "Group",
  Service: "Group",
  SERVICE: "Group",
  Action: "Action",
  Verb: "Action",
  ResourceType: "ResourceType",
  Resource: "ResourceType",
  Compartment: "Compartment",
  Condition: "Condition",
};

function parseApiError(text: string, status: number, statusText: string): string {
  if (!text.trim()) {
    return `Policy graph API request failed (${status} ${statusText})`;
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

function readOptionalString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function readNodeId(record: Record<string, unknown>, fallback: string): string {
  return readOptionalString(record, "id", "nodeId", "node_id") ?? fallback;
}

function readLinkEndpoint(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    return readOptionalString(value as Record<string, unknown>, "id", "nodeId", "node_id");
  }
  return undefined;
}

function nodeKindFromRecord(record: Record<string, unknown>): OciGraphNodeKind {
  const labels = record.labels;
  if (Array.isArray(labels)) {
    for (const label of labels) {
      const mapped = NODE_LABEL_KIND_MAP[String(label)];
      if (mapped) return mapped;
    }
  }

  const candidates = [
    readOptionalString(record, "kind", "nodeKind", "node_kind", "label"),
    readOptionalString(record, "nodeLabel", "node_label"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const mapped =
      NODE_LABEL_KIND_MAP[candidate] ?? NODE_LABEL_KIND_MAP[candidate.replace(/\s+/g, "")];
    if (mapped) return mapped;
    const allowed: OciGraphNodeKind[] = [
      "Policy",
      "PolicyStatement",
      "StatementType",
      "Group",
      "Action",
      "ResourceType",
      "Compartment",
      "Condition",
    ];
    if (allowed.includes(candidate as OciGraphNodeKind)) {
      return candidate as OciGraphNodeKind;
    }
  }

  return "Group";
}

function parseGraphNode(item: unknown, index: number): OciGraphNode | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const id = readNodeId(record, `node-${index}`);
  const kind = nodeKindFromRecord(record);
  const name =
    readOptionalString(record, "name", "displayName", "display_name", "text", "title", "value") ??
    id;
  const label =
    readOptionalString(record, "label", "caption") ?? graphNodeDisplayLabel(kind, name);

  return { id, kind, name, label };
}

function parseGraphLink(item: unknown): OciGraphLink | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const source = readLinkEndpoint(record.source ?? record.from ?? record.start ?? record.sourceId);
  const target = readLinkEndpoint(record.target ?? record.to ?? record.end ?? record.targetId);
  const type = readOptionalString(record, "type", "relType", "relationship", "rel") ?? "RELATED";
  if (!source || !target) return null;
  return { source, target, type };
}

function extractGraphRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const nested = record.graph ?? record.data ?? record.result;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return record;
}

function graphHasEntityNodes(graph: OciPolicyGraphData): boolean {
  return graph.nodes.some((node) =>
    ["StatementType", "Group", "Action", "ResourceType", "Compartment", "Condition"].includes(
      node.kind
    )
  );
}

function parsePolicyGraphResponse(
  payload: unknown,
  policyName: string
): OciPolicyGraphData | null {
  const record = extractGraphRecord(payload);
  if (!record) return null;

  const rawNodes = record.nodes ?? record.vertices;
  const rawLinks = record.links ?? record.edges ?? record.relationships;

  if (!Array.isArray(rawNodes) || !Array.isArray(rawLinks)) return null;

  const nodes = rawNodes
    .map((item, index) => parseGraphNode(item, index))
    .filter((item): item is OciGraphNode => item !== null);

  const links = rawLinks
    .map((item) => parseGraphLink(item))
    .filter((item): item is OciGraphLink => item !== null);

  if (nodes.length === 0) return null;

  const meta = record.meta;
  const truncated = Boolean(
    record.truncated ??
      (meta && typeof meta === "object" && (meta as Record<string, unknown>).truncated)
  );
  const statementLimit =
    typeof record.statementLimit === "number"
      ? record.statementLimit
      : nodes.filter((node) => node.kind === "PolicyStatement").length;

  const graph: OciPolicyGraphData = {
    nodes,
    links,
    policyNames: Array.isArray(record.policyNames)
      ? (record.policyNames as unknown[]).map(String)
      : [policyName],
    meta: {
      policyFilter: policyName,
      statementLimit,
      truncated,
    },
  };

  return graphHasEntityNodes(graph) ? graph : null;
}

function policyFromGraphPayload(payload: unknown, policyName: string): PolicyListItem | null {
  const record = extractGraphRecord(payload);
  if (!record) return null;

  const statementsRaw = record.statements ?? record.policyStatements;
  if (!Array.isArray(statementsRaw) || statementsRaw.length === 0) return null;

  const statements = statementsRaw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const statementRecord = item as Record<string, unknown>;
      const text =
        readOptionalString(
          statementRecord,
          "raw",
          "text",
          "statement",
          "statementText",
          "statement_text"
        ) ?? "";
      if (!text && !statementRecord.subjects && !statementRecord.verb) return null;

      return {
        id: readOptionalString(statementRecord, "id", "statementId") ?? `stmt-${index}`,
        ref: readOptionalString(statementRecord, "ref", "statementRef") ?? String(index),
        text,
        type: readOptionalString(statementRecord, "type", "keyword", "effect"),
        subjects: Array.isArray(statementRecord.subjects)
          ? (statementRecord.subjects as PolicyListStatement["subjects"])
          : undefined,
        verb: readOptionalString(statementRecord, "verb", "action"),
        resource: readOptionalString(statementRecord, "resource", "resourceType"),
        compartmentName: readOptionalString(
          statementRecord,
          "compartmentName",
          "compartment_name",
          "compartment"
        ),
        condition:
          readOptionalString(statementRecord, "condition", "whereClause", "where") ?? null,
      } satisfies PolicyListStatement;
    })
    .filter((item): item is PolicyListStatement => item !== null);

  if (statements.length === 0) return null;

  return {
    name: policyName,
    description: "—",
    owner: "—",
    createdOn: null,
    createdBy: "—",
    lastModified: null,
    lastSync: null,
    risk: "Low",
    status: "Active",
    compartment: "—",
    groups: [],
    compartments: [],
    statementCount: statements.length,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    statements,
  };
}

export async function fetchPolicyGraph(
  policyName: string,
  bearerToken?: string | null
): Promise<OciPolicyGraphData> {
  const trimmedName = policyName.trim();
  if (!trimmedName) {
    throw new Error("Policy name is required to load the graph.");
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const token =
    bearerToken?.trim() || process.env.POLICY_OPTIMIZATION_API_KEY?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const list = await fetchPolicyList(bearerToken);
  const policyFromList = list.policies.find((item) => item.name === trimmedName);
  if (policyFromList && policyFromList.statements.length > 0) {
    return buildGraphFromPolicyListItem(policyFromList);
  }

  const url = `${POLICY_GRAPH_API_URL}?policyName=${encodeURIComponent(trimmedName)}`;
  const res = await fetch(url, { headers, cache: "no-store" });

  if (res.ok) {
    const payload = (await res.json()) as unknown;
    const parsedGraph = parsePolicyGraphResponse(payload, trimmedName);
    if (parsedGraph) return parsedGraph;

    const policyFromGraph = policyFromGraphPayload(payload, trimmedName);
    if (policyFromGraph) {
      return buildGraphFromPolicyListItem(policyFromGraph);
    }
  }

  if (policyFromList) {
    return buildGraphFromPolicyListItem(policyFromList);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(parseApiError(text, res.status, res.statusText));
  }

  throw new Error(`Policy not found: ${trimmedName}`);
}
