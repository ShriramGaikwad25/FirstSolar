export type SlaDomain = "User" | "Application" | "Account";
export type SlaStatus = "Active" | "Draft";

export type SlaPolicy = {
  id: string;
  name: string;
  domain: SlaDomain;
  appliesTo: string;
  sla: string;
  reminder: string;
  escalation: string;
  breach: string;
  owner: string;
  status: SlaStatus;
};

export const APPLIES_TO_OPTIONS = [
  "User role change events",
  "User job title or department change events",
  "User manager change events",
  "Newly discovered entitlements",
  "Entitlement description events",
  "Privileged access flag events",
  "Training code events",
  "Application owner events",
  "Entitlement owner events",
  "Service account events",
  "Orphan account events",
  "Inactive account events",
];

export const CLOCK_TYPE_OPTIONS = ["Business days", "Calendar days", "Business hours"];

export const CLOCK_STARTS_OPTIONS = [
  "When event is generated",
  "When assigned to owner",
  "When workflow task is created",
  "When write-back is approved",
];

export const REMINDER_WHEN_OPTIONS = [
  "50% of SLA elapsed",
  "1 day before breach",
  "2 days before breach",
  "4 business hours before breach",
];

export const REMINDER_TARGET_OPTIONS = [
  "Primary owner",
  "Entitlement owner",
  "Application owner",
  "User manager",
  "NHI owner",
  "IAM Governance team",
];

export const ESCALATE_TO_OPTIONS = [
  "Owner's manager",
  "Application owner",
  "Entitlement owner",
  "User manager",
  "IAM Governance team",
  "IAM Operations queue",
  "Security Operations team",
  "Named fallback user",
];

export const BREACH_ACTION_OPTIONS = [
  "Create escalation task",
  "Create ServiceNow ticket",
  "Require exception approval",
  "Freeze auto-remediation",
  "Suppress requestability until resolved",
];

export const DEFERRAL_OPTIONS = ["Yes, with reason", "No", "Only with owner justification"];

export const MAX_DEFERRAL_OPTIONS = ["5 business days", "10 business days", "15 business days", "Not applicable"];

export const INITIAL_SLA_POLICIES: SlaPolicy[] = [
  {
    id: "SLA-U-001",
    name: "User Role Change Review SLA",
    domain: "User",
    appliesTo: "Role change events",
    sla: "5 business days",
    reminder: "Day 3 → User Manager",
    escalation: "Owner’s Manager",
    breach: "Create escalation task",
    owner: "IAM Governance",
    status: "Active",
  },
  {
    id: "SLA-U-002",
    name: "Department or Job Title Change SLA",
    domain: "User",
    appliesTo: "Job title / department change events",
    sla: "7 business days",
    reminder: "Day 5 → User Manager",
    escalation: "IAM Governance",
    breach: "Create access review escalation",
    owner: "Identity Operations",
    status: "Active",
  },
  {
    id: "SLA-U-003",
    name: "Manager Change Validation SLA",
    domain: "User",
    appliesTo: "Manager change events",
    sla: "10 business days",
    reminder: "Day 7 → User Manager",
    escalation: "HR Data Steward",
    breach: "Create data-quality task",
    owner: "HRIS + IAM Governance",
    status: "Active",
  },
  {
    id: "SLA-A-001",
    name: "Entitlement Description Remediation SLA",
    domain: "Application",
    appliesTo: "Missing or inadequate entitlement descriptions",
    sla: "5 business days",
    reminder: "Day 3 → Entitlement Owner",
    escalation: "Application Owner",
    breach: "Create escalation task",
    owner: "IAM Governance",
    status: "Active",
  },
  {
    id: "SLA-A-002",
    name: "Privileged Access Flag Correction SLA",
    domain: "Application",
    appliesTo: "Privileged flag missing / inconsistent",
    sla: "3 business days",
    reminder: "Day 1 → Application Owner",
    escalation: "Security Operations",
    breach: "Freeze auto-remediation",
    owner: "Security Operations",
    status: "Active",
  },
  {
    id: "SLA-A-003",
    name: "Application Owner Integrity SLA",
    domain: "Application",
    appliesTo: "Missing / inactive application owner",
    sla: "3 business days",
    reminder: "Day 1 → Backup Owner",
    escalation: "Owner’s Manager",
    breach: "Create ServiceNow ticket",
    owner: "Application Governance",
    status: "Active",
  },
  {
    id: "SLA-A-004",
    name: "Entitlement Owner Reassignment SLA",
    domain: "Application",
    appliesTo: "Missing, inactive, or invalid entitlement owner",
    sla: "3 business days",
    reminder: "Day 1 → Application Owner",
    escalation: "IAM Governance",
    breach: "Assign fallback owner task",
    owner: "IAM Governance",
    status: "Active",
  },
  {
    id: "SLA-A-005",
    name: "Training Code Metadata SLA",
    domain: "Application",
    appliesTo: "Missing or invalid training code",
    sla: "7 business days",
    reminder: "Day 5 → Entitlement Owner",
    escalation: "Application Owner",
    breach: "Require exception approval",
    owner: "Compliance Operations",
    status: "Draft",
  },
  {
    id: "SLA-AC-001",
    name: "Service Account Ownership SLA",
    domain: "Account",
    appliesTo: "Service account owner missing / inactive",
    sla: "3 business days",
    reminder: "Day 1 → NHI Owner",
    escalation: "Application Owner",
    breach: "Create ServiceNow ticket",
    owner: "NHI Governance",
    status: "Active",
  },
  {
    id: "SLA-AC-002",
    name: "Orphan Account Remediation SLA",
    domain: "Account",
    appliesTo: "Orphan account detected",
    sla: "2 business days",
    reminder: "50% elapsed → IAM Operations",
    escalation: "Security Operations",
    breach: "Require exception approval",
    owner: "IAM Operations",
    status: "Active",
  },
  {
    id: "SLA-AC-003",
    name: "Inactive Account Closure SLA",
    domain: "Account",
    appliesTo: "Inactive account above threshold",
    sla: "10 business days",
    reminder: "Day 7 → Account Owner",
    escalation: "IAM Operations queue",
    breach: "Create deactivation task",
    owner: "IAM Operations",
    status: "Draft",
  },
];
