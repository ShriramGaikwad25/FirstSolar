export type PolicyFindingSeverity = "High" | "Medium" | "Low" | string;

export interface PolicyFinding {
  id: string;
  policy: string;
  statement: string;
  severity: PolicyFindingSeverity;
  compartment: string;
  resource: string;
  groups: string[];
  actions: string[];
  conditions: string[];
  recommendation: string;
  detectedOn: string | null;
  deletedOn: string | null;
  isCurrent: boolean;
}

export interface OciPolicyAnalysisSummary {
  policiesScanned: number | null;
  openFindings: number;
  lastAnalysisRun: string | null;
}

export type PolicyListRisk = "High" | "Medium" | "Low";

export type PolicyListStatus = "Active" | "Inactive" | "Deleted" | string;

export interface PolicyListItem {
  uid: string | null;
  name: string;
  description: string;
  owner: string;
  createdOn: string | null;
  createdBy: string;
  lastModified: string | null;
  lastSync: string | null;
  risk: PolicyListRisk;
  status: PolicyListStatus;
  compartment: string;
  compartmentId: string | null;
  groups: string[];
  compartments: string[];
  statementCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  statements: PolicyListStatement[];
}

export interface PolicyStatementSubject {
  kind: string;
  name: string;
}

export interface PolicyListStatement {
  id: string;
  ref?: string;
  text: string;
  type?: string;
  subjects?: PolicyStatementSubject[];
  verb?: string;
  resource?: string;
  compartmentName?: string;
  condition?: string | null;
  risk?: PolicyListRisk;
}

export interface PolicyActivityEvent {
  id: string;
  event: string;
  versionNo: number | null;
  status: string | null;
  origin: string | null;
  basedOnVersion: number | null;
  changedBy: string | null;
  added: number | null;
  modified: number | null;
  removed: number | null;
  changeLabel: string | null;
  createdAt: string | null;
  enforcedAt: string | null;
  impactStatus: string | null;
  raw: unknown;
}

export interface PolicyActivityResult {
  events: PolicyActivityEvent[];
}

export interface PolicyImpactSummary {
  blastRadius: string | null;
  principalsAffected: number | null;
  permissionsAdded: number | null;
  permissionsRemoved: number | null;
  resourceFamiliesAffected: number | null;
  compartmentsAffected: number | null;
  overallRiskFrom: string | null;
  overallRiskTo: string | null;
  criticalExposures: number | null;
  privilegeExpansions: number | null;
  accessLosses: number | null;
  comparedWithVersion: string | null;
  analyzedOn: string | null;
  summary: string | null;
  raw: unknown;
}

export type PolicyListDateField = "" | "createdOn";

export interface PolicyListFilters {
  risk: "" | PolicyListRisk;
  compartment: string;
  status: string;
  dateField: PolicyListDateField;
  dateFrom: string;
  dateTo: string;
}

export interface PolicyListResult {
  policies: PolicyListItem[];
  tenancyId: string | null;
  tenancyName: string | null;
  tenancies: OciTenancy[];
  analytics: PolicyListAnalytics | null;
}

export interface OciTenancy {
  id: string;
  name: string;
  label: string;
}

export interface PolicySubjectsByKind {
  DYNAMIC_GROUP: number;
  GROUP: number;
  SERVICE: number;
  UNKNOWN: number;
}

export interface PolicyListAnalytics {
  totalPolicies: number;
  totalStatements: number;
  distinctSubjects: number;
  subjectsByKind: PolicySubjectsByKind;
  distinctCompartments: number;
  distinctResources: number;
  conditionalPolicies: number;
  conditionalStatements: number;
  unparsableStatements: number;
  highRiskStatements: number;
  totalTags: number;
}

export interface PolicyOptimizationGrant {
  ref: string;
  policyName: string;
  raw: string;
}

export interface PolicyOptimizationItem {
  findingId: string;
  policyName: string;
  statement: string;
  groupName: string;
  owner: string;
  action: string;
  resource: string;
  compartment: string;
  condition: string | null;
  optimizationType: string;
  reason: string;
  coveredByStatement: string | null;
  recommendation: string;
  severity?: string;
  rawStatement?: string;
  coveredByRaw?: string | null;
  compartmentTitle?: string;
  compartmentOcid?: string | null;
  redundantGrants?: PolicyOptimizationGrant[];
  coveredBy?: PolicyOptimizationGrant[];
}

export interface PolicyOptimizationSummary {
  grantsAnalyzed: number;
  duplicates: number;
  redundant: number;
  consolidations: number;
  overPrivileged: number;
  deadConditions: number;
  autoSafe: number;
  review: number;
}

export interface PolicyOptimizationResult {
  rows: PolicyOptimizationItem[];
  summary: PolicyOptimizationSummary | null;
  tenancyName: string | null;
}

export type TagDashboardSummary = Record<string, number>;

export interface TagDashboardResult {
  summary: TagDashboardSummary | null;
  tenancyName: string | null;
}

export type TagDashboardTagResource = {
  displayName?: string;
  resourceType?: string;
  lifecycleState?: string;
  timeCreated?: string;
  resourceOcid?: string;
};

export type TagDashboardTagRow = {
  id: string;
  kind?: string;
  namespace: string;
  key: string;
  value: string;
  resourceCount?: number;
  resources?: TagDashboardTagResource[];
  displayName?: string;
  resourceType?: string;
  lifecycleState?: string;
  timeCreated?: string;
  source?: string;
  resourceOcid?: string;
};

export type TagDashboardTagsView = {
  defined: TagDashboardTagRow[];
  freeform: TagDashboardTagRow[];
};

export interface PolicyOptimizationGroup {
  key: string;
  optimizationType: string;
  groupName: string;
  compartment: string;
  statements: PolicyOptimizationItem[];
}

export interface PolicySimulationStatement {
  policyName: string;
  statement: string;
  groupName: string;
  action: string;
  resource: string;
  compartment: string;
  condition: string | null;
  optimizationType: string;
  coveredByStatement: string | null;
}

export type PolicySimulationOutcome = "safe" | "review" | "access_loss";

export interface PolicySimulationImpact {
  statement: string;
  policyName: string;
  groupName: string;
  action: string;
  resource: string;
  compartment: string;
  outcome: PolicySimulationOutcome;
  coveredByStatement: string | null;
  coveredByPolicy: string | null;
  reason: string;
}

export interface PolicySimulationResult {
  currentStatementCount: number;
  projectedStatementCount: number;
  removedCount: number;
  safeRemovals: number;
  reviewRemovals: number;
  accessLosses: number;
  impacts: PolicySimulationImpact[];
}

export interface PolicyIncomingSimulationInput {
  group: string;
  action: string;
  resource: string;
  compartment: string;
  condition: string;
}

export interface PolicySimulationStatementRef {
  statementId: string;
  policy: string;
  fullText: string;
}

export interface PolicyIncomingSimulationResult {
  incomingStatement: string;
  verdicts: string[];
  recommendation: string;
  exactDuplicates: PolicySimulationStatementRef[];
  coveredByHigherVerb: PolicySimulationStatementRef[];
  coveredByScope: PolicySimulationStatementRef[];
  makesVerbRedundant: PolicySimulationStatementRef[];
  makesScopeRedundant: PolicySimulationStatementRef[];
}

export interface PolicyIncomingSimulationConflictRow {
  category: string;
  policy: string;
  statementId: string;
  fullText: string;
}

export interface PolicyScopeSubject {
  kind: string;
  name: string;
}

export interface PolicyScopeDefinedTag {
  namespace: string;
  key: string;
  value: string;
}

export interface PolicyScopeFreeformTag {
  key: string;
  value: string;
}

export interface PolicyScopeResource {
  compartmentName: string;
  displayName: string;
  resourceType: string;
  lifecycleState: string;
  definedTags: PolicyScopeDefinedTag[];
  freeformTags: PolicyScopeFreeformTag[];
}

export interface PolicyScopeCompartment {
  compartmentName: string;
  count: number;
  resources: PolicyScopeResource[];
}

export interface PolicyScopeView {
  subject: PolicyScopeSubject | null;
  verb: string | null;
  resource: string | null;
  coverage: string | null;
  groupsInScope: string[];
  compartmentsInScope: PolicyScopeCompartment[];
  resourcesInScope: PolicyScopeResource[];
  resourceCount: number | null;
  notes: string | null;
  residualConstraints: string[];
}
