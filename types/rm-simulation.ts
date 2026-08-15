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
