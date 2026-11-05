/** Row of the `rm_list_privileges` gateway op. */
export type PrivilegeListRow = {
  privilege_id: number;
  privilege_code: string;
  privilege_name?: string | null;
  system_type: string;
  privilege_kind: string;
  status: string;
  /** Roles granting it, directly or by inheritance */
  roles?: number | null;
  /** Functions built on it */
  functions?: number | null;
};

/** Privilege count per system (feeds the System filter). */
export type PrivilegeSystemCount = {
  system_type: string;
  privileges: number;
};

export type ListPrivilegesParams = {
  system_type?: string | null;
  search?: string | null;
  page?: number;
  page_size?: number;
};

export type ListPrivilegesResult = {
  data: PrivilegeListRow[];
  total: number;
  systems: PrivilegeSystemCount[];
};

/** Connected application (`rm_list_app_instances`). */
export type AppInstance = {
  instance_id: string;
  instance_name: string;
  /** System code saved for the application, or the one its roles already map to */
  system_code?: string | null;
  /** System its roles were imported under before */
  system_type?: string | null;
  /** "saved" when the code was saved for this application, "linked" when inferred from its roles */
  system_source?: string | null;
  roles: number;
  /** Roles already imported as privileges */
  imported: number;
  /** Roles already mapped to privileges */
  linked: number;
};

export type ImportTypeColumn = {
  name: string;
  required: boolean;
};

/** File layout a system accepts (`rm_list_import_types`). */
export type ImportType = {
  artifact_code: string;
  artifact_name: string;
  /** True when the system has no layouts of its own and uses the standard ones */
  standard?: boolean;
  columns: ImportTypeColumn[];
};

export type IngestLoadData = {
  rows_in: number;
  rows_written: number;
  rows_skipped: number;
  skip_reasons?: { column?: string; rows_null?: number }[] | null;
  skipped_sample?: unknown[] | null;
};

/** Response of the `ingest` upload: the file is staged, not applied yet. */
export type IngestResult = {
  load?: { success: boolean; data?: IngestLoadData; error?: string };
};

export type PromoteImportInput = {
  batch: string;
  system_type: string;
  artifact_code: string;
  file_name: string;
  rows_read: number;
  rows_written: number;
  rows_skipped: number;
  ruleset_code?: string;
  instance_id: string;
};

export type ImportJobStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED";

/** Background import (`rm_list_import_jobs`). */
export type ImportJob = {
  job_id: number | string;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  artifact_code: string;
  system_type: string;
  file_name?: string | null;
  rows_written?: number | null;
  rows_skipped?: number | null;
  status: ImportJobStatus;
  error_message?: string | null;
  created_by?: string | null;
};

export type OnboardAppRolesInput = {
  instanceId: string;
  systemType: string;
  systemName?: string;
  /** ROLE: roles or groups; SCOPE: API or tool scopes */
  kind: "ROLE" | "SCOPE";
  /** true only counts what an import would create */
  dryRun: boolean;
};

export type OnboardAppRolesResult = {
  instance?: string;
  system_type?: string;
  entitlements_found?: number;
  privileges_to_create?: number;
  privileges_created?: number;
  functions_created?: number;
};
