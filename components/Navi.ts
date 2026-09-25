import {
  Settings,
  ListTodo,
  ListTree,
  LayoutDashboard,
  LayoutPanelLeft,
  User2Icon,
  UserCircle2Icon,
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
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "My Workspace",
    href: "/profile",
    icon: User,
    subItems: [
      { name: "My Profile", href: "/profile", icon: UserCircle2Icon },
      { name: "Users", href: "/user", icon: User2Icon },
      { name: "Applications", href: "/applications", icon: LayoutPanelLeft },
    ],
  },
  {
    name: "Request Management",
    href: "/access-request",
    icon: ClipboardList,
    subItems: [
      { name: "Access Management", href: "/access-request", icon: ClipboardList },
      { name: "Track Request", href: "/track-request", icon: Search },
      { name: "My Approvals", href: "/access-request/pending-approvals", icon: AlertCircle },
    ],
  },
  {
    name: "Risk Analysis",
    href: "/risk-analysis",
    icon: LineChart,
    subItems: riskAnalysisSubItems.filter((i) =>
      ["Dashboard", "Rulesets", "Rules", "Functions", "Violations"].includes(i.name)
    ),
  },
  {
    name: "Administration",
    href: "/settings",
    icon: Settings,
    subItems: [
      { name: "Integrations", href: "/settings/app-inventory", icon: Package },
      { name: "Scheduler", href: "/settings/gateway/scheduler", icon: Clock },
      { name: "Approval Policy", href: "/settings/gateway/manage-approval-policies", icon: Workflow },
      { name: "Workflow Builder", href: "/settings/gateway/workflow-builder", icon: Workflow },
      { name: "Email Templates", href: "/settings/gateway/email-templates", icon: FileText },
      { name: "Entitlement management", href: "/settings/gateway/entitlement-management", icon: FileCode2 },
      { name: "Manage Native Users", href: "/settings/gateway/native-users", icon: Users },
    ],
  },
];
