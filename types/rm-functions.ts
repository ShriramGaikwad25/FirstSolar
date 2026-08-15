/** List / table row */
export type FunctionListRow = {
  function_id: number;
  function_code: string;
  function_name: string;
  description?: string | null;
  system_type: string;
  privilege_count: number;
  required_permission_count: number;
  rule_count: number;
  status: string;
};

export type FunctionRuleRef = {
  rule_id: number;
  rule_code: string;
  condition_side: "A" | "B";
};

export type FunctionPrivilege = {
  privilege_id: number;
  privilege_code: string;
  privilege_name?: string | null;
  system_type: string;
  privilege_kind: string;
  permission_count: number;
};

export type FunctionRequiredPermission = {
  object_name: string;
  field_name: string;
  required_value_low: string;
  required_value_high?: string | null;
  sort_order: number;
  description?: string | null;
};

export type FunctionDetail = {
  function_id: number;
  function_code: string;
  function_name: string;
  system_type: string;
  status: string;
  description?: string | null;
  created_at?: string;
  privileges: FunctionPrivilege[];
  required_permissions: FunctionRequiredPermission[];
  rules: FunctionRuleRef[];
};

export type PrivilegeSearchRow = {
  privilege_id: number;
  privilege_code: string;
  privilege_name?: string | null;
  system_type: string;
  privilege_kind?: string;
};

/** Matches `kf_rm_list_functions_paged(NULL::uuid, NULL::varchar, NULL::varchar, status, page, page_size)`. */
export type ListFunctionsPagedParams = {
  status?: string;
  /** 1-based page (default 1) */
  page?: number;
  page_size?: number;
};

export type UpsertFunctionInput = {
  function_id: number | null;
  function_code: string;
  function_name: string;
  system_type: string;
  description?: string | null;
  status: string;
  privileges: Array<{ privilege_id: number }>;
  required_permissions: FunctionRequiredPermission[];
};
