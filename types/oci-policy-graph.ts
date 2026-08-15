export type OciGraphNodeKind =
  | "Policy"
  | "PolicyStatement"
  | "StatementType"
  | "Group"
  | "Action"
  | "ResourceType"
  | "Compartment"
  | "Condition";

export interface OciGraphNode {
  id: string;
  label: string;
  kind: OciGraphNodeKind;
  /** Display name / primary text */
  name: string;
}

export interface OciGraphLink {
  source: string;
  target: string;
  type: string;
}

export interface OciPolicyGraphData {
  nodes: OciGraphNode[];
  links: OciGraphLink[];
  policyNames: string[];
  meta: {
    policyFilter: string | null;
    statementFilter?: string | null;
    statementLimit: number;
    truncated: boolean;
  };
}
