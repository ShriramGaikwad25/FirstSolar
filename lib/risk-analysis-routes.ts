import { LayoutGrid, Library, ListChecks, Box, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type RiskAnalysisEntry = {
  name: string;
  href: string;
  icon: LucideIcon;
};

/** Order and labels match the Risk Analysis product sidebar. */
export const RISK_ANALYSIS_NAV: RiskAnalysisEntry[] = [
  { name: "Dashboard", href: "/risk-analysis", icon: LayoutGrid },
  { name: "Rulesets", href: "/risk-analysis/rulesets", icon: Library },
  { name: "Rules", href: "/risk-analysis/rules", icon: ListChecks },
  { name: "Functions", href: "/risk-analysis/functions", icon: Box },
  { name: "Violations", href: "/risk-analysis/violations", icon: ShieldAlert },
];

export const riskAnalysisSubItems = RISK_ANALYSIS_NAV.map((e) => ({
  name: e.name,
  href: e.href,
  icon: e.icon,
}));
