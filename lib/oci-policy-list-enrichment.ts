import type {
  PolicyListAnalytics,
  PolicyListItem,
  PolicyListRisk,
  PolicyListStatement,
} from "@/types/oci-policy";

export const POLICY_DEMO_OWNERS = ["Harish", "Srinivas", "Adisri", "Mark", "Kyle"] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function assignDemoPolicyOwner(policyName: string): string {
  return POLICY_DEMO_OWNERS[hashString(policyName) % POLICY_DEMO_OWNERS.length];
}

export function assignDemoStatementRisk(policyName: string, index: number): PolicyListRisk {
  const roll = hashString(`${policyName}:${index}`) % 100;
  if (roll < 8) return "High";
  if (roll < 23) return "Medium";
  return "Low";
}

function summarizeStatementRisks(statements: PolicyListStatement[]): {
  highCount: number;
  mediumCount: number;
  lowCount: number;
  risk: PolicyListRisk;
} {
  const highCount = statements.filter((statement) => statement.risk === "High").length;
  const mediumCount = statements.filter((statement) => statement.risk === "Medium").length;
  const lowCount = statements.filter((statement) => statement.risk === "Low").length;

  const risk: PolicyListRisk =
    highCount > 0 ? "High" : mediumCount > 0 ? "Medium" : "Low";

  return { highCount, mediumCount, lowCount, risk };
}

export function enrichPolicyListItem(policy: PolicyListItem): PolicyListItem {
  const statements = policy.statements.map((statement, index) => ({
    ...statement,
    risk: statement.risk ?? assignDemoStatementRisk(policy.name, index),
  }));

  const riskCounts = summarizeStatementRisks(statements);

  return {
    ...policy,
    owner: assignDemoPolicyOwner(policy.name),
    statements,
    ...riskCounts,
  };
}

export function enrichPolicyListItems(policies: PolicyListItem[]): PolicyListItem[] {
  return policies.map(enrichPolicyListItem);
}

export function countHighRiskStatements(policies: PolicyListItem[]): number {
  return policies.reduce((total, policy) => total + policy.highCount, 0);
}

export function enrichPolicyListAnalytics(
  analytics: PolicyListAnalytics | null,
  policies: PolicyListItem[]
): PolicyListAnalytics | null {
  const highRiskStatements = countHighRiskStatements(policies);

  if (!analytics) {
    if (policies.length === 0) return null;

    return {
      totalPolicies: policies.length,
      totalStatements: policies.reduce((sum, policy) => sum + policy.statementCount, 0),
      distinctSubjects: 0,
      subjectsByKind: { DYNAMIC_GROUP: 0, GROUP: 0, SERVICE: 0, UNKNOWN: 0 },
      distinctCompartments: 0,
      distinctResources: 0,
      conditionalPolicies: 0,
      conditionalStatements: 0,
      unparsableStatements: 0,
      highRiskStatements,
    };
  }

  return {
    ...analytics,
    highRiskStatements,
  };
}
