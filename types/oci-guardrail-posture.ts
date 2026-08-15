export type GuardrailStatus = "Implemented" | "Partial" | "Missing";

export type GuardrailSeverity = "Critical" | "High" | "Medium";

export type GuardrailTenant = {
  id: string;
  environment: string;
  score: number;
  implemented: number;
  partial: number;
  missing: number;
  criticalGaps: number;
  lastScan: string;
};

export type Guardrail = {
  id: string;
  name: string;
  domain: string;
  severity: GuardrailSeverity;
  status: GuardrailStatus;
};

export type DomainPosture = {
  domain: string;
  score: number;
  covered: number;
  total: number;
};

export type FleetKpis = {
  tenantsMonitored: number;
  avgPosture: number;
  guardrailsTracked: number;
  criticalGaps: number;
};
