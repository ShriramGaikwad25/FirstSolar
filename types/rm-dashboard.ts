/** Risk Management dashboard API payload (matches getDashboard response body). */
export type RmKpis = {
  open_violations: number;
  high_severity_open: number;
  mitigated: number;
  unique_users: number;
};

export type RmBySeverity = {
  severity_name: string;
  open_count: number;
  color_hex?: string | null;
};

export type RmByStatus = {
  status_name: string;
  cnt: string | number;
  color_hex?: string | null;
};

export type RmBySystem = {
  system_name: string;
  cnt: number;
  color_hex?: string | null;
};

export type RmTopRiskyUser = {
  userid: string;
  displayname?: string | null;
  username?: string | null;
  violation_count: number;
  risk_score: number;
};

export type RmRecentRun = {
  run_id: number;
  ruleset_code: string;
  run_type: string;
  run_status_name?: string | null;
  run_status?: string | null;
  run_status_color?: string | null;
  total_violations: number;
  started_at: string;
};

export type RmDashboardData = {
  kpis: RmKpis;
  by_severity: RmBySeverity[];
  by_status: RmByStatus[];
  by_system: RmBySystem[];
  top_risky_users: RmTopRiskyUser[];
  recent_runs: RmRecentRun[];
};

export type RmRuleset = {
  ruleset_id: number;
  ruleset_name?: string | null;
  ruleset_code?: string | null;
  status?: string | null;
  active_rule_count?: number;
};

/** Flat CSV row for ruleset import (Fusion SoD tool shape; columns are dynamic). */
export type RulesetCsvRow = Record<string, string | number | null | undefined>;
