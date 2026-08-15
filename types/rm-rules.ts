/** Rule list row (table) — `conditions` may be partial from list API */
export type RuleListRow = {
  rule_id: number;
  rule_code: string;
  rule_name: string;
  rule_type: string;
  severity: string;
  risk_score?: number | null;
  status: string;
  conditions?: Array<{ condition_side?: string }>;
};

export type RulePermission = {
  object_name?: string | null;
  action_name?: string | null;
  field_name?: string | null;
  value_low?: string | null;
  value_high?: string | null;
};

export type RulePrivilege = {
  privilege_id: number;
  privilege_code: string;
  privilege_name?: string | null;
  privilege_kind: string;
  permission?: RulePermission | null;
};

export type RuleFunctionBinding = {
  rule_condition_id: number;
  condition_side: "A" | "B";
  function_id: number;
  function_code: string;
  function_name: string;
  system_type: string;
  privileges: RulePrivilege[];
};

export type RuleUserCondition = {
  condition_side: "A" | "B" | "X";
  logic_op: "AND" | "OR";
  attribute_name: string;
  operator: string;
  attribute_value?: string | null;
};

export type RuleMitigationRef = {
  mitigation_code: string;
};

export type RuleDetail = {
  rule_id: number;
  ruleset_id: number;
  ruleset_code?: string;
  rule_code: string;
  rule_name: string;
  description?: string | null;
  remediation_guidance?: string | null;
  rule_type: string;
  severity: string;
  risk_score: number;
  scope_enforcement: string;
  status: string;
  functions: RuleFunctionBinding[];
  user_conditions: RuleUserCondition[];
  mitigations: RuleMitigationRef[];
  open_violation_count: number;
  created_at: string;
  updated_at: string;
};

export type UserAttributeCatalog = {
  attribute_name: string;
  display_name: string;
};

export type FunctionRow = {
  function_id: number;
  function_code: string;
  function_name: string;
  system_type: string;
  privilege_count: number;
};

export type UpsertRuleV2Input = {
  ruleset_id: number;
  rule_code: string;
  rule_type: string;
  severity: string;
  risk_score: number;
  scope_enforcement: string;
  rule_name: string;
  description?: string | null;
  remediation?: string | null;
  side_a_function_ids: number[];
  side_b_function_ids: number[];
  user_conditions: RuleUserCondition[];
  status: string;
};
