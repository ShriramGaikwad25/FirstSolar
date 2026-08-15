export type AnalysisRunListRow = {
  run_id: number;
  /** When present, the ruleset filter in the UI can narrow rows client-side. */
  ruleset_id?: number | null;
  run_type: string;
  run_status: string;
  total_violations: number;
  started_at?: string | null;
  completed_at?: string | null;
};
