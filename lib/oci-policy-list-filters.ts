import type { PolicyListDateField, PolicyListFilters, PolicyListItem } from "@/types/oci-policy";

export const EMPTY_POLICY_LIST_FILTERS: PolicyListFilters = {
  risk: "",
  compartment: "",
  status: "",
  dateField: "",
  dateFrom: "",
  dateTo: "",
};

function parseFilterDate(value: string): number | null {
  if (!value.trim()) return null;
  const time = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(time) ? null : time;
}

function parsePolicyDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
}

function policyMatchesDateRange(
  policy: PolicyListItem,
  field: PolicyListDateField,
  fromTime: number | null,
  toTime: number | null
): boolean {
  if (!field) return true;

  const raw = policy.createdOn;
  const policyTime = parsePolicyDate(raw);
  if (policyTime == null) return false;

  if (fromTime != null && policyTime < fromTime) return false;
  if (toTime != null && policyTime > toTime + 86_399_999) return false;
  return true;
}

function policyMatchesCompartment(policy: PolicyListItem, compartment: string): boolean {
  if (!compartment) return true;
  if (policy.compartment === compartment) return true;
  return (policy.compartments ?? []).includes(compartment);
}

export function collectPolicyStatusOptions(policies: PolicyListItem[]): string[] {
  const statuses = new Set<string>();
  for (const policy of policies) {
    if (policy.status) statuses.add(policy.status);
  }
  return Array.from(statuses).sort((a, b) => a.localeCompare(b));
}

export function collectPolicyCompartmentOptions(policies: PolicyListItem[]): string[] {
  const compartments = new Set<string>();
  for (const policy of policies) {
    if (policy.compartment && policy.compartment !== "—") {
      compartments.add(policy.compartment);
    }
    for (const compartment of policy.compartments ?? []) {
      if (compartment && compartment !== "—") compartments.add(compartment);
    }
  }
  return Array.from(compartments).sort((a, b) => a.localeCompare(b));
}

export function applyPolicyListFilters(
  policies: PolicyListItem[],
  filters: PolicyListFilters
): PolicyListItem[] {
  const fromTime = parseFilterDate(filters.dateFrom);
  const toTime = parseFilterDate(filters.dateTo);

  return policies.filter((policy) => {
    if (filters.risk && policy.risk !== filters.risk) return false;
    if (!policyMatchesCompartment(policy, filters.compartment)) return false;
    if (filters.status && policy.status !== filters.status) return false;

    if (
      (fromTime != null || toTime != null) &&
      !policyMatchesDateRange(policy, "createdOn", fromTime, toTime)
    ) {
      return false;
    }

    return true;
  });
}

export function hasActivePolicyListFilters(filters: PolicyListFilters): boolean {
  return Boolean(
    filters.risk ||
      filters.compartment ||
      filters.status ||
      filters.dateFrom ||
      filters.dateTo
  );
}
