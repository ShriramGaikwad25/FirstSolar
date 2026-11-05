/** Files of a rule-library import; any one may come alone (rule_functions only with rules). */
export type RuleLibraryFileKind = "functions" | "rules" | "rule_functions";

export type ImportRuleLibraryInput = {
  functions?: File;
  rules?: File;
  rule_functions?: File;
  /** Ruleset the rules go into: an existing code or a new one */
  ruleset_code?: string;
  /** Name for a new ruleset; an existing one keeps its name when blank */
  ruleset_name?: string;
  /** UPSERT adds and updates; REPLACE deactivates the ruleset's rules not in the file */
  mode: "UPSERT" | "REPLACE";
  /** true runs the import and reports what it would do, without saving anything */
  check: boolean;
};

export type RuleLibrarySystemReport = {
  functions: number;
  created: number;
  privilege_links: number;
  roles_as_access_points: number;
  missing_count: number;
  privileges_missing: string[];
};

export type RuleLibraryUnresolvedRule = {
  rule: string;
  functions: { side: string; function: string; system?: string | null; why: string }[];
  missing_side?: string | null;
};

export type RuleLibraryReport = {
  ruleset_code?: string;
  functions: {
    rows_in: number;
    by_system?: Record<string, RuleLibrarySystemReport>;
    rows_incomplete: number;
    incomplete_rows: number[];
    errors: { system: string; error: string }[];
  };
  rules: {
    rows_in: number;
    created: number;
    updated: number;
    skipped: number;
    deactivated: number;
    unresolved: RuleLibraryUnresolvedRule[];
    severity_defaulted: number;
    scope_defaulted: number;
    duplicate_codes: number;
    without_name: number;
    rule_functions_unused?: { row: number }[];
    found_by_name: { function: string; matched: string }[];
  };
  owners?: { set: number; unresolved: string[] };
};

export type ImportRuleLibraryResult = { report: RuleLibraryReport };
