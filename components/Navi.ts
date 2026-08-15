import {
  Settings,
  ListTodo,
  ListTree,
  LayoutDashboard,
  LayoutPanelLeft,
  User2Icon,
  UserCircle2Icon,
  ScreenShareIcon,
  Package,
  Server,
  FileText,
  ClipboardList,
  Search,
  User,
  Shield,
  CheckCircle,
  AlertCircle,
  Clock,
  Lock,
  Workflow,
  Users,
  ShieldAlert,
  PlusCircle,
  LineChart,
  Building2,
  FileCode2,
  ShieldCheck,
  Tags,
  Target,
  Wrench,
  Zap,
  Sparkles,
} from "lucide-react";
import { riskAnalysisSubItems } from "@/lib/risk-analysis-routes";

export interface NavItem {
  name: string;
  href: string;
  icon: any;
  subItems?: NavItem[];
  /** Show β next to the label (e.g. pre-release features) */
  beta?: boolean;
}

export const navLinks: NavItem[] = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Access Review(s)",
    href: "/access-review",
    icon: ListTodo,
    subItems: [
      { name: "Access Review", href: "/access-review", icon: ListTodo },
      { name: "Manage Campaign", href: "/campaigns", icon: ListTree },
      {
        name: "Continuous Compliance",
        href: "/campaigns/continuous-compliance",
        icon: CheckCircle,
      },
    ],
  },
  {
    name: "Request Management",
    href: "/access-request",
    icon: ClipboardList,
    subItems: [
      { name: "Access Request", href: "/access-request", icon: ClipboardList },
      { name: "JIT Access", href: "/jit-access", icon: Zap },
      { name: "Track Request", href: "/track-request", icon: Search },
      {
        name: "My Approvals",
        href: "/access-request/pending-approvals",
        icon: AlertCircle,
      },
    ],
  },
  {
    name: "My Workspace",
    href: "/profile",
    icon: User,
    subItems: [
      { name: "My Profile", href: "/profile", icon: UserCircle2Icon },
      { name: "Users", href: "/user", icon: User2Icon },
      { name: "Applications", href: "/applications", icon: LayoutPanelLeft },
      { name: "Catalog", href: "/catalog", icon: ScreenShareIcon },
    ],
  },
  {
    name: "Risk Analysis",
    href: "/risk-analysis",
    icon: LineChart,
    subItems: riskAnalysisSubItems,
  },
  {
    name: "Audit and Compliance",
    href: "/reports",
    icon: Shield,
    subItems: [
      { name: "Reporting", href: "/oracle-reports", icon: FileText },
      { name: "Profiles", href: "/profiles", icon: UserCircle2Icon },
      { name: "SoD Audit", href: "/reports/sod-audit", icon: AlertCircle },
      {
        name: "NHI Dashboard",
        href: "/reports/nhi-dashboard",
        icon: LayoutDashboard,
        beta: true,
      },
    ],
  },
  {
    name: "Policy Dashboard",
    href: "/oci-policy-analysis",
    icon: ShieldAlert,
    subItems: [
      { name: "Policy Dashboard", href: "/oci-policy-analysis", icon: LayoutDashboard },
      { name: "Policy Optimization", href: "/oci-policy-analysis/policy-optimization", icon: Target },
      { name: "Group Access", href: "/oci-policy-analysis/group-access", icon: Users },
      { name: "Tags", href: "/oci-policy-analysis/tags", icon: Tags },
      { name: "Tags-2", href: "/oci-policy-analysis/tags-2", icon: Sparkles },
      { name: "Policy Builder", href: "/oci-policy-analysis/policy-builder", icon: FileCode2 },
      { name: "Risk Overview", href: "/oci-policy-risk-management", icon: LayoutDashboard },
      { name: "Tenant Posture", href: "/oci-policy-risk-management/tenant-posture", icon: Building2 },
      { name: "Guardrails", href: "/oci-policy-risk-management/guardrails", icon: ShieldCheck },
      { name: "Risk Remediation", href: "/oci-policy-risk-management/risk-remediation", icon: Wrench },
    ],
  },
  {
    name: "Administration",
    href: "/settings",
    icon: Settings,
    subItems: [
      { name: "Integrations", href: "/settings/app-inventory", icon: Package },
      {
        name: "Roles",
        href: "/settings/gateway/manage-business-roles",
        icon: Shield,
      },
      { name: "Scheduler", href: "/settings/gateway/scheduler", icon: Clock },
      {
        name: "Access Policy",
        href: "/settings/gateway/manage-access-policy",
        icon: Lock,
      },
      {
        name: "Approval Policy",
        href: "/settings/gateway/manage-approval-policies",
        icon: Workflow,
      },
      {
        name: "Workflow Builder",
        href: "/settings/gateway/workflow-builder",
        icon: Workflow,
      },
      { name: "SoD", href: "/settings/gateway/sod", icon: Shield },
      { name: "Generic", href: "/settings/gateway", icon: Server },
    ],
  },
];
