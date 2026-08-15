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
