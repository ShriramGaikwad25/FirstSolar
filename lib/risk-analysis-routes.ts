import {
  LayoutGrid,
  Library,
  ListChecks,
  Box,
  ShieldAlert,
  BookOpen,
  Flag,
  FileSearch,
  FlaskConical,
  Database,
  ScanSearch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type RiskAnalysisEntry = {
  name: string;
  href: string;
  /** Path after /risk-analysis/ — omitted for the section dashboard (hub at /risk-analysis) */
  segment: string | null;
  icon: LucideIcon;
};

/** Order and labels match the Risk Analysis product sidebar. */
export const RISK_ANALYSIS_NAV: RiskAnalysisEntry[] = [
  { name: "Dashboard", href: "/risk-analysis", segment: null, icon: LayoutGrid },
  { name: "Rulesets", href: "/risk-analysis/rulesets", segment: "rulesets", icon: Library },
  { name: "Rules", href: "/risk-analysis/rules", segment: "rules", icon: ListChecks },
  { name: "Functions", href: "/risk-analysis/functions", segment: "functions", icon: Box },
  { name: "Violations", href: "/risk-analysis/violations", segment: "violations", icon: ShieldAlert },
  { name: "Mitigations", href: "/risk-analysis/mitigations", segment: "mitigations", icon: BookOpen },
  { name: "Exceptions", href: "/risk-analysis/exceptions", segment: "exceptions", icon: Flag },
  {
    name: "Analysis Runs",
    href: "/risk-analysis/analysis-runs",
    segment: "analysis-runs",
    icon: FileSearch,
  },
  { name: "Simulation", href: "/risk-analysis/simulation", segment: "simulation", icon: FlaskConical },
  { name: "ERP Systems", href: "/risk-analysis/erp-systems", segment: "erp-systems", icon: Database },
  { name: "Lookups", href: "/risk-analysis/lookups", segment: "lookups", icon: ScanSearch },
];

const SEGMENT_SET = new Set(
  RISK_ANALYSIS_NAV.map((e) => e.segment).filter((s): s is string => s != null)
);

export function isRiskAnalysisSegment(segment: string): boolean {
  return SEGMENT_SET.has(segment);
}

export const riskAnalysisSubItems = RISK_ANALYSIS_NAV.map((e) => ({
  name: e.name,
  href: e.href,
  icon: e.icon,
}));

/** For dynamic [segment] pages: human-readable title. */
export const RISK_ANALYSIS_TITLES: Record<string, string> = Object.fromEntries(
  RISK_ANALYSIS_NAV.filter((e) => e.segment).map((e) => [e.segment!, e.name])
) as Record<string, string>;
