import type {
  DomainPosture,
  FleetKpis,
  Guardrail,
  GuardrailSeverity,
  GuardrailStatus,
  GuardrailTenant,
} from "@/types/oci-guardrail-posture";

export const GUARDRAILS_TRACKED = 23;

export const GUARDRAIL_TENANTS: GuardrailTenant[] = [
  {
    id: "acme-prod",
    environment: "Production",
    score: 57,
    implemented: 11,
    partial: 4,
    missing: 8,
    criticalGaps: 5,
    lastScan: "26 Jun 2026 03:14",
  },
  {
    id: "acme-nonprod",
    environment: "Non-production",
    score: 72,
    implemented: 14,
    partial: 3,
    missing: 6,
    criticalGaps: 2,
    lastScan: "26 Jun 2026 03:10",
  },
  {
    id: "globex-prod",
    environment: "Production",
    score: 48,
    implemented: 9,
    partial: 3,
    missing: 11,
    criticalGaps: 6,
    lastScan: "25 Jun 2026 22:02",
  },
  {
    id: "initech-prod",
    environment: "Production",
    score: 66,
    implemented: 13,
    partial: 2,
    missing: 8,
    criticalGaps: 3,
    lastScan: "26 Jun 2026 01:40",
  },
  {
    id: "umbrella-prod",
    environment: "Production",
    score: 61,
    implemented: 12,
    partial: 3,
    missing: 8,
    criticalGaps: 4,
    lastScan: "26 Jun 2026 02:55",
  },
];

const GUARDRAIL_ROWS: Omit<Guardrail, "id">[] = [
  {
    name: "deny manage policies in tenancy",
    domain: "IAM — Root of Trust",
    severity: "Critical",
    status: "Missing",
  },
  {
    name: "self-protection: deny manage policies where type=deny",
    domain: "IAM — Root of Trust",
    severity: "Critical",
    status: "Missing",
  },
  {
    name: "deny manage groups in tenancy",
    domain: "IAM — Root of Trust",
    severity: "Critical",
    status: "Missing",
  },
  {
    name: "deny manage dynamic-groups in tenancy",
    domain: "IAM — Root of Trust",
    severity: "Critical",
    status: "Partial",
  },
  {
    name: "deny manage identity-providers in tenancy",
    domain: "IAM — Root of Trust",
    severity: "Critical",
    status: "Implemented",
  },
  {
    name: "deny manage domains in tenancy",
    domain: "IAM — Root of Trust",
    severity: "High",
    status: "Missing",
  },
  {
    name: "deny { DB_SYSTEM_DELETE, DATABASE_DELETE, … }",
    domain: "Database & Data",
    severity: "Critical",
    status: "Implemented",
  },
  {
    name: "deny { AUTONOMOUS_DATABASE_DELETE, … }",
    domain: "Database & Data",
    severity: "Critical",
    status: "Implemented",
  },
  {
    name: "deny { MYSQL_INSTANCE_DELETE, MYSQL_BACKUP_DELETE }",
    domain: "Database & Data",
    severity: "High",
    status: "Implemented",
  },
  {
    name: "deny { NOSQL_TABLE_DROP }",
    domain: "Database & Data",
    severity: "High",
    status: "Partial",
  },
  {
    name: "deny { BUCKET_DELETE, OBJECT_DELETE, PAR_MANAGE }",
    domain: "Object / Block / File",
    severity: "Critical",
    status: "Implemented",
  },
  {
    name: "deny { VOLUME_DELETE, BOOT_VOLUME_DELETE, … }",
    domain: "Object / Block / File",
    severity: "High",
    status: "Implemented",
  },
  {
    name: "deny { KEY_DELETE, VAULT_DELETE }",
    domain: "Vault, KMS & Secrets",
    severity: "Critical",
    status: "Implemented",
  },
  {
    name: "deny manage cloud-guard-family in tenancy",
    domain: "Security Control Plane",
    severity: "Critical",
    status: "Missing",
  },
  {
    name: "deny manage waas-family in tenancy",
    domain: "Security Control Plane",
    severity: "High",
    status: "Missing",
  },
  {
    name: "deny manage audit in tenancy",
    domain: "Security Control Plane",
    severity: "Critical",
    status: "Partial",
  },
  {
    name: "deny { VCN_DELETE, DRG_DELETE, IGW_DELETE, … }",
    domain: "Networking",
    severity: "Critical",
    status: "Implemented",
  },
  {
    name: "deny { INSTANCE_AGENT_COMMAND_CREATE } (RCE)",
    domain: "Compute & Orchestration",
    severity: "High",
    status: "Partial",
  },
  {
    name: "deny manage compartments in tenancy",
    domain: "Compartments & Tenancy",
    severity: "High",
    status: "Implemented",
  },
  {
    name: "deny manage disaster-recovery-family in tenancy",
    domain: "Disaster Recovery",
    severity: "High",
    status: "Missing",
  },
  {
    name: "deny { ALARM_DELETE, … } observability",
    domain: "Observability",
    severity: "High",
    status: "Implemented",
  },
  {
    name: "deny manage certificate-authority-family",
    domain: "Marketplace / Supply Chain",
    severity: "Critical",
    status: "Implemented",
  },
  {
    name: "deny manage tenancies in tenancy",
    domain: "Billing & Account",
    severity: "Critical",
    status: "Missing",
  },
];

export const GUARDRAILS: Guardrail[] = GUARDRAIL_ROWS.map((row, index) => ({
  ...row,
  id: slugifyGuardrail(row.name, index),
}));

export function slugifyGuardrail(name: string, index: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base || `guardrail-${index}`;
}

export function getGuardrailById(id: string): Guardrail | undefined {
  return GUARDRAILS.find((g) => g.id === id);
}

export function scoreColor(score: number): "green" | "amber" | "red" {
  if (score >= 70) return "green";
  if (score >= 50) return "amber";
  return "red";
}

export function scoreTextClass(score: number): string {
  const tone = scoreColor(score);
  if (tone === "green") return "text-emerald-700";
  if (tone === "amber") return "text-amber-600";
  return "text-red-600";
}

export function scoreBgClass(score: number): string {
  const tone = scoreColor(score);
  if (tone === "green") return "bg-emerald-50 text-emerald-700";
  if (tone === "amber") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

export function scoreRingColor(score: number): string {
  const tone = scoreColor(score);
  if (tone === "green") return "#0E9F6E";
  if (tone === "amber") return "#D97706";
  return "#DC2626";
}

export function statusBadgeClass(status: GuardrailStatus): string {
  if (status === "Implemented") return "bg-emerald-50 text-emerald-700";
  if (status === "Partial") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

export function severityDotColor(severity: GuardrailSeverity): string {
  if (severity === "Critical") return "bg-red-500";
  if (severity === "High") return "bg-amber-500";
  return "bg-gray-400";
}

export function computeFleetKpis(tenants: GuardrailTenant[]): FleetKpis {
  const tenantsMonitored = tenants.length;
  const avgPosture =
    tenantsMonitored === 0
      ? 0
      : Math.round(tenants.reduce((sum, t) => sum + t.score, 0) / tenantsMonitored);
  const criticalGaps = tenants.reduce((sum, t) => sum + t.criticalGaps, 0);
  return {
    tenantsMonitored,
    avgPosture,
    guardrailsTracked: GUARDRAILS_TRACKED,
    criticalGaps,
  };
}

export function computeDomainPosture(guardrails: Guardrail[]): DomainPosture[] {
  const byDomain = new Map<string, { covered: number; total: number }>();

  for (const guardrail of guardrails) {
    const entry = byDomain.get(guardrail.domain) ?? { covered: 0, total: 0 };
    entry.total += 1;
    if (guardrail.status === "Implemented") entry.covered += 1;
    else if (guardrail.status === "Partial") entry.covered += 0.5;
    byDomain.set(guardrail.domain, entry);
  }

  return [...byDomain.entries()]
    .map(([domain, { covered, total }]) => ({
      domain,
      covered,
      total,
      score: total === 0 ? 0 : Math.round((covered / total) * 100),
    }))
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

export function getCriticalGapGuardrails(guardrails: Guardrail[]): Guardrail[] {
  return guardrails.filter((g) => g.status === "Missing" && g.severity === "Critical");
}

export function guardrailCurrentState(status: GuardrailStatus): string {
  if (status === "Missing") {
    return "No matching deny policy found in the tenant. This destructive capability is currently ungoverned.";
  }
  if (status === "Partial") {
    return "A related deny exists but is too broad or scoped to the wrong compartment — it does not fully cover this action.";
  }
  return "A matching deny policy is present and active. Verify the break-glass exemption and scope remain correct.";
}

export function buildRecommendedDenyPolicy(guardrailName: string): string {
  const base = guardrailName.replace(/\s+in tenancy$/, "");
  return `${base}\n  in tenancy\n  where request.principal.id != '<BREAKGLASS_OCID>'`;
}

export function guardrailWhyItMatters(guardrail: Guardrail): string {
  return `This grant confers a destructive or privilege-escalating capability in the ${guardrail.domain} domain. Without a deny guardrail, any principal holding the matching allow can perform it — and a deny overrides every allow, including the Administrators group.`;
}

export const GUARDRAIL_ROLLOUT_STEPS = [
  "Confirm the resource/permission strings against the tenant's policy reference.",
  "Add the deny statement above, scoped to your break-glass principal.",
  "Validate in a non-production compartment first.",
  "Apply tenancy-wide and re-run the scanner to confirm status flips to Implemented.",
  "Add the self-protection deny so the guardrail cannot be removed.",
];

export const DEFAULT_GUARDRAIL_TENANT_ID = GUARDRAIL_TENANTS[0]?.id ?? "";
