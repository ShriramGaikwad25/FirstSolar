export interface CompartmentTreeNode {
  id: string;
  name: string;
  resourceCount: number | null;
  directPolicyCount: number | null;
  cumulativePolicyCount: number | null;
  resourceType: string | null;
  children: CompartmentTreeNode[];
}

export interface CompartmentsTreeResult {
  tenancyId: string | null;
  tenancyName: string | null;
  totalPolicies: number | null;
  root: CompartmentTreeNode | null;
}
