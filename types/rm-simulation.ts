import type { PrivilegeSearchRow } from "./rm-functions";

export type { PrivilegeSearchRow };

export type UserSearchRow = {
  userid: string;
  displayname: string;
  username: string;
  title?: string | null;
  department?: string | null;
};

export type EntitlementSearchRow = {
  entitlementid: string;
  entitlementname: string;
  entitlement_displayname?: string | null;
  app_name?: string | null;
  privilege_count: number;
};

export type UserAccessEntitlement = {
  entitlementid: string;
  entitlementname: string;
  entitlement_displayname?: string | null;
  privilege_count: number;
};

export type UserAccessPayload = {
  entitlements: UserAccessEntitlement[];
};

export type SimulateUserAccessInput = {
  user_id: string | null;
  ruleset_id: number;
  add_entitlement_ids: string[];
  add_privilege_ids: number[];
  remove_entitlement_ids: string[];
};

export type SimulationHitPrivilege = {
  privilege_id: number;
  privilege_code: string;
  source: string;
  proposed_entitlement_name?: string | null;
};

export type SimulationRuleDetail = {
  function_id: number;
  function_code: string;
  system_type: string;
  condition_side: "A" | "B" | string;
  hit_privileges?: SimulationHitPrivilege[];
};

export type SimulationViolationRow = {
  rule_id: number;
  change_status: "NEW" | "EXISTING" | "RESOLVED" | string;
  rule_name?: string | null;
  rule_code: string;
  severity: string;
  severity_name?: string | null;
  severity_color: string;
  risk_score: number;
  current_violation: boolean;
  projected_violation: boolean;
  rule_description?: string | null;
  remediation?: string | null;
  details: SimulationRuleDetail[];
};

export type SimulationSummary = {
  current_violations: number;
  projected_violations: number;
  new_violations: number;
  resolved_violations: number;
  risk_score_added: number;
  risk_score_removed: number;
  current_privilege_count: number;
  projected_privilege_count: number;
  added_privilege_count: number;
  removed_privilege_count: number;
};

export type SimulationResult = {
  summary: SimulationSummary;
  violations: SimulationViolationRow[];
};

export type SimulationApiResult = {
  success: boolean;
  data?: SimulationResult;
  error?: string;
};

/* ---------- Compare roles (rm_role_pair_detail, from the role SoD coverage matrix) ---------- */

export type RolePairRole = {
  entitlement_id: string;
  entitlement_name: string;
  app_name?: string | null;
};

export type RolePairRule = {
  rule_id: number;
  rule_code: string;
  rule_name?: string | null;
  rule_type: string;
  severity: string;
  severity_name?: string | null;
  severity_color?: string | null;
  risk_score: number;
};

export type RolePairTotals = { count: number; total_risk: number };

export type RolePairDetail = {
  role_a: RolePairRole;
  role_b: RolePairRole;
  a_intrinsic: RolePairRule[];
  b_intrinsic: RolePairRule[];
  combination_only: RolePairRule[];
  totals: {
    a_intrinsic: RolePairTotals;
    b_intrinsic: RolePairTotals;
    combination_only: RolePairTotals;
  };
};

/* ---------- Request with data scope (rm_check_request_sod_scoped) ---------- */

export type { ScopeValue } from "./rm-rules";

/** One requested access: a resolved entitlement or a typed code/name, each in zero or more scopes. */
export type ScopedRequestItemInput = (
  | { entitlement_id: string; access?: never }
  | { access: string; entitlement_id?: never }
) & { scopes: { type: string; value: string }[] };

export type ScopedCheckInput = {
  user_id: string | null;
  items: ScopedRequestItemInput[];
  ruleset_codes?: string[];
};

export type ScopedCheckAccessRef = {
  item?: number | null;
  access: string;
  scopeType?: string | null;
  scopeId?: string | null;
  source?: string | null;
};

export type ScopedCheckItem = {
  item: number;
  input?: { access?: string; scopes?: unknown[] };
  access?: string;
  access_name?: string | null;
  instance?: string | null;
  resolved: boolean;
  systems?: string[];
  scope_mode?: "NOT_APPLICABLE" | "ALL_SCOPES" | "SCOPED" | string;
  system_scope_types?: string[];
  scopes?: {
    type: string;
    scope_id?: string;
    value?: string;
    resolved_by?: string;
    maps_to?: { type: string; scope_id: string }[];
  }[];
};

export type ScopedCheckViolation = {
  ruleset: string;
  ruleId: number;
  ruleCode: string;
  ruleName?: string | null;
  severity: string;
  enforcement: "BLOCK" | "WARN" | string;
  conflictWith: "HELD_ACCESS" | "PENDING_REQUEST" | "SAME_REQUEST" | string;
  requested: ScopedCheckAccessRef[];
  conflicting: ScopedCheckAccessRef[];
};

export type ScopedCheckResult = {
  verdict: "CLEAN" | "WARN" | "BLOCK" | "UNRESOLVED" | string;
  user: { found: boolean; user_id?: string | null; username?: string | null };
  rulesets: string[];
  items: ScopedCheckItem[];
  violations: ScopedCheckViolation[];
  errors: { item?: number | null; message: string; candidates?: unknown[] }[];
  warnings: { item?: number | null; message: string }[];
};
