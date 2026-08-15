export type AgentTaskDomain = "User" | "Application" | "Account";
export type AgentTaskExecutionType = "LLM" | "ML Algorithm" | "Deterministic";

export type AgentTaskSchemaField = {
  field: string;
  type: string;
  description: string;
};

export type AgentTask = {
  id: string;
  name: string;
  domain: AgentTaskDomain;
  exec: AgentTaskExecutionType;
  version: string;
  status: "Active";
  primary: string;
  description: string;
  inputs: string[];
  schema: AgentTaskSchemaField[];
};

export const AGENT_TASKS: AgentTask[] = [
  {
    id: "AGT-APP-001",
    name: "Entitlement Description Generator",
    domain: "Application",
    exec: "LLM",
    version: "v1.4",
    status: "Active",
    primary: "Candidate description",
    description:
      "Generates a business-readable entitlement description grounded in application context, naming patterns, membership usage, and related entitlements.",
    inputs: [
      "Entitlement name",
      "Current description",
      "Application name",
      "Entitlement owner",
      "Membership count",
      "Related entitlements",
      "Request history",
      "Privileged flag",
    ],
    schema: [
      { field: "recommendation", type: "string", description: "Generated business description" },
      { field: "confidence_score", type: "number", description: "0–100 confidence score" },
      { field: "execution_type", type: "enum", description: "LLM" },
    ],
  },
  {
    id: "AGT-APP-002",
    name: "Data Classification Recommender",
    domain: "Application",
    exec: "LLM",
    version: "v1.1",
    status: "Active",
    primary: "Data Classification",
    description:
      "Recommends entitlement data classification based on entitlement name, description, application name, membership profile and AI Agent training.",
    inputs: [
      "Entitlement name",
      "Description",
      "Application name",
      "Membership profile",
      "Peer entitlements",
      "Application category",
      "Access request volume",
      "Usage frequency",
    ],
    schema: [
      { field: "recommendation", type: "string", description: "Recommended data classification" },
      { field: "confidence_score", type: "number", description: "0–100 confidence score" },
      { field: "execution_type", type: "enum", description: "LLM" },
    ],
  },
  {
    id: "AGT-APP-003",
    name: "Service Account Owner Resolver",
    domain: "Account",
    exec: "Deterministic",
    version: "v1.2",
    status: "Active",
    primary: "Resolved owner",
    description:
      "Applies deterministic rules to identify service account owner by using application owner, service account users, account creation and modification metadata, associated business process, business process owner.",
    inputs: [
      "Application owner",
      "Service account users",
      "Account creation metadata",
      "Account modification metadata",
      "Associated business process",
      "Business process owner",
    ],
    schema: [
      { field: "recommendation", type: "string", description: "Resolved service account owner recommendation" },
      { field: "confidence_score", type: "number", description: "0–100 confidence score" },
      { field: "execution_type", type: "enum", description: "Deterministic" },
    ],
  },
  {
    id: "AGT-APP-004",
    name: "SOD Classification Validation Check",
    domain: "Application",
    exec: "LLM",
    version: "v1.0",
    status: "Active",
    primary: "SOD Flag recommendation",
    description:
      "Checks existing entitlements against SOD rule engine to identify entitlements that need to have their SOD flag enabled. Performs menu item level analysis for EBS, SAP, Fusion Apps.",
    inputs: [
      "Entitlement name",
      "Menu item path",
      "SOD rule engine ruleset",
      "Application type",
      "Conflicting entitlements",
      "Business process",
    ],
    schema: [
      { field: "recommendation", type: "string", description: "SOD flag enablement recommendation" },
      { field: "confidence_score", type: "number", description: "0–100 confidence score" },
      { field: "execution_type", type: "enum", description: "LLM" },
    ],
  },
  {
    id: "AGT-USER-001",
    name: "User Attribute Change Classifier",
    domain: "User",
    exec: "ML Algorithm",
    version: "v1.0",
    status: "Active",
    primary: "Change significance score",
    description:
      "Classifies user attribute changes to determine whether the change is governance-relevant and should trigger access review or assurance workflow.",
    inputs: [
      "Previous attribute value",
      "New attribute value",
      "Effective date",
      "User population peer group",
      "Access footprint",
      "Historical changes",
      "Manager hierarchy",
    ],
    schema: [
      { field: "recommendation", type: "string", description: "Recommended access review or assurance action" },
      { field: "confidence_score", type: "number", description: "0–100 confidence score" },
      { field: "execution_type", type: "enum", description: "ML Algorithm" },
    ],
  },
  {
    id: "AGT-USER-002",
    name: "Manager Relationship Resolver",
    domain: "User",
    exec: "Deterministic",
    version: "v1.0",
    status: "Active",
    primary: "Resolved manager path",
    description:
      "Uses HR hierarchy and fallback rules to identify a valid manager or escalation target for user-centric assurance events.",
    inputs: [
      "Current manager",
      "Manager HR status",
      "User HR record",
      "Department head",
      "Fallback manager rule",
      "Effective date",
    ],
    schema: [
      { field: "recommendation", type: "string", description: "Resolved manager or escalation path" },
      { field: "confidence_score", type: "number", description: "0–100 confidence score" },
      { field: "execution_type", type: "enum", description: "Deterministic" },
    ],
  },
  {
    id: "AGT-USER-003",
    name: "Access Impact Summarizer",
    domain: "User",
    exec: "LLM",
    version: "v1.2",
    status: "Active",
    primary: "Access impact summary",
    description:
      "Summarizes the likely access impact of a user role, department, or job title change for human reviewers using current access and peer access context.",
    inputs: [
      "User current access",
      "Old role",
      "New role",
      "Old department",
      "New department",
      "Peer group access",
      "Sensitive entitlements",
      "Recent requests",
    ],
    schema: [
      { field: "recommendation", type: "string", description: "Plain-language access impact recommendation" },
      { field: "confidence_score", type: "number", description: "0–100 confidence score" },
      { field: "execution_type", type: "enum", description: "LLM" },
    ],
  },
  {
    id: "AGT-ACC-001",
    name: "NHI Owner Resolver",
    domain: "Account",
    exec: "ML Algorithm",
    version: "v1.3",
    status: "Active",
    primary: "Likely NHI owner",
    description:
      "Infers likely non-human identity owner using usage patterns, credential vault metadata, host/application relationships, last modifier, and ticket history.",
    inputs: [
      "Account name",
      "Application association",
      "Vault metadata",
      "Last modifier",
      "Host/service relationship",
      "Ticket history",
      "Usage pattern",
      "Current owner",
    ],
    schema: [
      { field: "recommendation", type: "string", description: "Likely NHI owner recommendation" },
      { field: "confidence_score", type: "number", description: "0–100 confidence score" },
      { field: "execution_type", type: "enum", description: "ML Algorithm" },
    ],
  },
  {
    id: "AGT-ACC-002",
    name: "Orphan Account Evidence Builder",
    domain: "Account",
    exec: "Deterministic",
    version: "v1.0",
    status: "Active",
    primary: "Evidence package",
    description:
      "Compiles deterministic evidence for orphan or inactive account findings, including correlation attempts, HR status, last login, source system, and remediation channel.",
    inputs: [
      "Account ID",
      "Correlation result",
      "Linked identity candidates",
      "HR status",
      "Last login",
      "Source application",
      "Account status",
      "Remediation channel",
    ],
    schema: [
      { field: "recommendation", type: "string", description: "Evidence package and next-action recommendation" },
      { field: "confidence_score", type: "number", description: "0–100 confidence score" },
      { field: "execution_type", type: "enum", description: "Deterministic" },
    ],
  },
  {
    id: "AGT-APP-005",
    name: "SOD Mitigating Control Resolver",
    domain: "Application",
    exec: "LLM",
    version: "v1.0",
    status: "Active",
    primary: "Mitigating control recommendation",
    description:
      "Drafts a candidate mitigating control statement using entitlement context, conflicting access pattern, application process, and prior approved controls.",
    inputs: [
      "Entitlement pair",
      "Conflict description",
      "Application process",
      "Existing control library",
      "User population",
      "Prior mitigations",
      "Control owner",
    ],
    schema: [
      { field: "recommendation", type: "string", description: "Candidate mitigating control recommendation" },
      { field: "confidence_score", type: "number", description: "0–100 confidence score" },
      { field: "execution_type", type: "enum", description: "LLM" },
    ],
  },
  {
    id: "AGT-APP-006",
    name: "Training Requirement Impact Analysis",
    domain: "Application",
    exec: "LLM",
    version: "v1.0",
    status: "Active",
    primary: "Training Code Impact Analysis & Action",
    description:
      "Analyzes change of training code and its associated impact on existing users and in flight access requests. Fulfillment through email notification for updated training and AI insights update for in-flight access requests.",
    inputs: [
      "Training code",
      "Previous training code",
      "Affected user population",
      "In-flight access requests",
      "Entitlement name",
      "Application name",
    ],
    schema: [
      { field: "recommendation", type: "string", description: "Training impact analysis and remediation action" },
      { field: "confidence_score", type: "number", description: "0–100 confidence score" },
      { field: "execution_type", type: "enum", description: "LLM" },
    ],
  },
];
