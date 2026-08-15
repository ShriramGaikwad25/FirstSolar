import type { PolicyListItem, PolicyListStatement, PolicyStatementSubject } from "@/types/oci-policy";
import type {
  OciGraphLink,
  OciGraphNode,
  OciGraphNodeKind,
  OciPolicyGraphData,
} from "@/types/oci-policy-graph";

/** Distinct, readable node colors for the policy relationship graph. */
export const GRAPH_NODE_COLORS: Record<OciGraphNodeKind, string> = {
  Policy: "#1d4ed8",
  PolicyStatement: "#4338ca",
  StatementType: "#0f766e",
  Group: "#059669",
  Action: "#d97706",
  ResourceType: "#0284c7",
  Compartment: "#525252",
  Condition: "#9333ea",
};

/** User-facing labels for graph node kinds (legend, hover, node labels). */
export const GRAPH_NODE_KIND_LABELS: Record<OciGraphNodeKind, string> = {
  Policy: "Policy",
  PolicyStatement: "Statement",
  StatementType: "Type",
  Group: "Subject",
  Action: "Verb",
  ResourceType: "Resource",
  Compartment: "Compartment",
  Condition: "Condition",
};

export function graphNodeDisplayLabel(kind: OciGraphNodeKind, name: string): string {
  if (kind === "PolicyStatement") return name;
  return `${GRAPH_NODE_KIND_LABELS[kind]}: ${name}`;
}

function policyNodeId(name: string) {
  return `policy:${name}`;
}

function statementNodeId(id: string) {
  return `statement:${id}`;
}

export function getStatementGraphNodeId(statement: PolicyListStatement, index: number): string {
  const statementKey = statement.id || String(statement.ref ?? index);
  return statementNodeId(statementKey);
}

export function resolveStatementIndexFromNodeId(
  nodeId: string,
  statements: PolicyListStatement[]
): number {
  if (!nodeId.startsWith("statement:")) return -1;
  const key = nodeId.slice("statement:".length);
  return statements.findIndex((statement, index) => {
    const statementKey = statement.id || String(statement.ref ?? index);
    return statementKey === key;
  });
}

function entityNodeId(kind: OciGraphNodeKind, statementKey: string, name: string) {
  return `${kind.toLowerCase()}:${statementKey}:${name}`;
}

function ensureNode(
  nodeMap: Map<string, OciGraphNode>,
  id: string,
  kind: OciGraphNodeKind,
  name: string
) {
  if (!nodeMap.has(id)) {
    nodeMap.set(id, {
      id,
      kind,
      name,
      label: graphNodeDisplayLabel(kind, name),
    });
  }
}

function addLink(
  linkKeys: Set<string>,
  links: OciGraphLink[],
  source: string,
  target: string,
  type: string
) {
  const key = `${source}|${type}|${target}`;
  if (linkKeys.has(key)) return;
  linkKeys.add(key);
  links.push({ source, target, type });
}

const EMPTY_STATEMENT_FIELD = "—";

function subjectDisplayName(subject: PolicyStatementSubject): string {
  const kind = subject.kind.trim().toUpperCase();
  const name = subject.name.trim();
  if (!name) return EMPTY_STATEMENT_FIELD;
  if (kind === "SERVICE") return `service ${name}`;
  if (kind === "DYNAMIC_GROUP") return `dynamic-group ${name}`;
  if (kind === "GROUP") return name;
  if (kind === "UNKNOWN" || !kind) return name;
  return `${subject.kind}: ${name}`;
}

export type PolicyStatementDisplayFields = {
  type: string;
  subject: string;
  verb: string;
  resource: string;
  compartment: string;
  condition: string;
};

function parseStatementTextFields(text: string): PolicyStatementDisplayFields | null {
  const normalized = text.trim().replace(/\s+/g, " ");
  const match = normalized.match(
    /^(allow|endorse|admit)\s+(.+?)\s+to\s+(\S+(?:-\S+)*)\s+(\S+)(?:\s+in\s+(.+?))?(?:\s+where\s+(.+))?$/i
  );
  if (!match) return null;

  return {
    type: match[1]?.trim() || EMPTY_STATEMENT_FIELD,
    subject: match[2]?.trim() || EMPTY_STATEMENT_FIELD,
    verb: match[3]?.trim() || EMPTY_STATEMENT_FIELD,
    resource: match[4]?.trim() || EMPTY_STATEMENT_FIELD,
    compartment: match[5]?.trim() || EMPTY_STATEMENT_FIELD,
    condition: match[6]?.trim() || EMPTY_STATEMENT_FIELD,
  };
}

export function getPolicyStatementDisplayFields(
  statement: PolicyListStatement
): PolicyStatementDisplayFields {
  const type = statement.type?.trim() ?? "";
  const verb = statement.verb?.trim() ?? "";
  const resource = statement.resource?.trim() ?? "";
  const compartment = statement.compartmentName?.trim() ?? "";
  const condition = statement.condition?.trim() ?? "";
  const subject = (statement.subjects ?? [])
    .map(subjectDisplayName)
    .filter((name) => name !== EMPTY_STATEMENT_FIELD)
    .join(", ");

  if (type || verb || resource || compartment || condition || subject) {
    return {
      type: type || EMPTY_STATEMENT_FIELD,
      subject: subject || EMPTY_STATEMENT_FIELD,
      verb: verb || EMPTY_STATEMENT_FIELD,
      resource: resource || EMPTY_STATEMENT_FIELD,
      compartment: compartment || EMPTY_STATEMENT_FIELD,
      condition: condition || EMPTY_STATEMENT_FIELD,
    };
  }

  return (
    parseStatementTextFields(statement.text) ?? {
      type: EMPTY_STATEMENT_FIELD,
      subject: EMPTY_STATEMENT_FIELD,
      verb: EMPTY_STATEMENT_FIELD,
      resource: EMPTY_STATEMENT_FIELD,
      compartment: EMPTY_STATEMENT_FIELD,
      condition: EMPTY_STATEMENT_FIELD,
    }
  );
}

function enrichStatementFromStructured(
  statement: PolicyListStatement,
  statementKey: string,
  nodeMap: Map<string, OciGraphNode>,
  linkKeys: Set<string>,
  links: OciGraphLink[],
  sId: string
): boolean {
  const type = statement.type?.trim();
  const verb = statement.verb?.trim();
  const resource = statement.resource?.trim();
  const compartmentName = statement.compartmentName?.trim();
  const condition = statement.condition?.trim();
  const subjects = statement.subjects ?? [];

  const hasStructured =
    Boolean(type || verb || resource || compartmentName || condition) || subjects.length > 0;
  if (!hasStructured) return false;

  if (type) {
    const typeId = entityNodeId("StatementType", statementKey, type);
    ensureNode(nodeMap, typeId, "StatementType", type);
    addLink(linkKeys, links, sId, typeId, "HAS_TYPE");
  }

  for (const subject of subjects) {
    const display = subjectDisplayName(subject);
    const subjectId = entityNodeId("Group", statementKey, display);
    ensureNode(nodeMap, subjectId, "Group", display);
    addLink(linkKeys, links, sId, subjectId, "SUBJECT");
  }

  if (verb) {
    const actionId = entityNodeId("Action", statementKey, verb);
    ensureNode(nodeMap, actionId, "Action", verb);
    addLink(linkKeys, links, sId, actionId, "ALLOWS_ACTION");
  }

  if (resource) {
    const resourceId = entityNodeId("ResourceType", statementKey, resource);
    ensureNode(nodeMap, resourceId, "ResourceType", resource);
    addLink(linkKeys, links, sId, resourceId, "ON_RESOURCE");
  }

  if (compartmentName) {
    const scopeId = entityNodeId("Compartment", statementKey, compartmentName);
    ensureNode(nodeMap, scopeId, "Compartment", compartmentName);
    addLink(linkKeys, links, sId, scopeId, "SCOPED_TO");
  }

  if (condition) {
    const conditionId = entityNodeId("Condition", statementKey, condition.slice(0, 160));
    ensureNode(nodeMap, conditionId, "Condition", condition.slice(0, 160));
    addLink(linkKeys, links, sId, conditionId, "HAS_CONDITION");
  }

  return true;
}

function enrichStatementFromText(
  statementText: string,
  statementKey: string,
  nodeMap: Map<string, OciGraphNode>,
  linkKeys: Set<string>,
  links: OciGraphLink[],
  sId: string
) {
  const parsed = parseStatementTextFields(statementText);
  if (!parsed) return;

  enrichStatementFromStructured(
    {
      id: statementKey,
      text: statementText,
      type: parsed.type === EMPTY_STATEMENT_FIELD ? undefined : parsed.type,
      subjects:
        parsed.subject === EMPTY_STATEMENT_FIELD
          ? []
          : [{ kind: "UNKNOWN", name: parsed.subject }],
      verb: parsed.verb === EMPTY_STATEMENT_FIELD ? undefined : parsed.verb,
      resource: parsed.resource === EMPTY_STATEMENT_FIELD ? undefined : parsed.resource,
      compartmentName:
        parsed.compartment === EMPTY_STATEMENT_FIELD ? undefined : parsed.compartment,
      condition: parsed.condition === EMPTY_STATEMENT_FIELD ? null : parsed.condition,
    },
    statementKey,
    nodeMap,
    linkKeys,
    links,
    sId
  );
}

export function buildGraphFromPolicyListItem(policy: PolicyListItem): OciPolicyGraphData {
  const nodeMap = new Map<string, OciGraphNode>();
  const linkKeys = new Set<string>();
  const links: OciGraphLink[] = [];
  const pId = policyNodeId(policy.name);

  ensureNode(nodeMap, pId, "Policy", policy.name);

  for (const [index, statement] of policy.statements.entries()) {
    const statementKey = statement.id || String(statement.ref ?? index);
    const sId = statementNodeId(statementKey);
    const label = statement.ref ? `Statement ${statement.ref}` : `Statement ${index + 1}`;

    ensureNode(nodeMap, sId, "PolicyStatement", label);
    addLink(linkKeys, links, pId, sId, "HAS_STATEMENT");

    const mapped = enrichStatementFromStructured(
      statement,
      statementKey,
      nodeMap,
      linkKeys,
      links,
      sId
    );
    if (!mapped) {
      enrichStatementFromText(statement.text, statementKey, nodeMap, linkKeys, links, sId);
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    links,
    policyNames: [policy.name],
    meta: {
      policyFilter: policy.name,
      statementLimit: policy.statements.length,
      truncated: false,
    },
  };
}
