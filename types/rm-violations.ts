export type ViolationDetailLine = {
  system_type?: string | null;
  function_code: string;
  scope_type?: string | null;
  scope_name?: string | null;
};

export type Violation = {
  violation_id: number;
  username: string;
  user_name?: string | null;
  rule_code: string;
  rule_name?: string | null;
  rule_type: string;
  rule_type_name?: string | null;
  severity: string;
  severity_name?: string | null;
  /** Hex color for {@link Badge} */
  severity_color?: string | null;
  violation_status: string;
  status_name?: string | null;
  status_color?: string | null;
  details?: ViolationDetailLine[];
  created_at: string;
};

export type ListViolationsParams = {
  /** Passed to `kf_rm_list_violations_v2` (5th arg). Use `null` for any / all. */
  status?: string | null;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc" | string;
  /** Lookup / label locale for the API (default `en`). */
  locale?: string;
  /** Client-only filters (not in v2 list signature). */
  search?: string | null;
  severity?: string | null;
  rule_type?: string | null;
  system_type?: string | null;
  scope_type?: string | null;
};

export type ViolationPagination = {
  total: number;
  page: number;
  page_size: number;
};

export type ListViolationsResult = {
  data: Violation[];
  pagination: ViolationPagination;
};

export type ViolationComment = {
  comment_id: number;
  body: string;
  posted_at: string;
  posted_by?: string | null;
  posted_by_name?: string | null;
};

/** Full violation detail for the drawer (`kf_rm_get_violation_detail`). */
export type ViolationDetailFull = {
  violation_id: number;
  violation_status: string;
  status_name?: string | null;
  status_color?: string | null;
  rule_id: number;
  rule_code: string;
  rule_name?: string | null;
  severity: string;
  severity_name?: string | null;
  severity_color?: string | null;
  risk_score?: number | null;
  user_id: string;
  username?: string | null;
  display_name?: string | null;
  email?: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  assigned_at?: string | null;
  due_date?: string | null;
  comment_count?: number;
  created_at: string;
  run_id?: number;
  details: Array<{
    violation_detail_id: number;
    function_id?: number;
    function_code?: string | null;
    system_type?: string | null;
    privilege_id?: number;
    privilege_code?: string | null;
    data_scope_type?: string | null;
    data_scope_name?: string | null;
    is_global_scope?: boolean | null;
  }>;
  comments: ViolationComment[];
};

export type ConflictNodeKind = "USER" | "ENTITLEMENT" | "PRIVILEGE" | "FUNCTION" | "RULE";

export type ConflictNode = {
  id: string;
  kind: ConflictNodeKind;
  label: string;
  sub?: string | null;
  side?: "A" | "B" | null;
  detail?: Record<string, unknown>;
};

export type ConflictEdge = { source: string; target: string; label?: string | null };

/** Conflict path (`kf_rm_get_violation_path`): USER → ENTITLEMENT → PRIVILEGE → FUNCTION → RULE. */
export type ConflictPath = { nodes: ConflictNode[]; edges: ConflictEdge[] };
