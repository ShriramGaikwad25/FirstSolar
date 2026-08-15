import type { PolicyListItem } from "@/types/oci-policy";
import { normalizeSearchText } from "@/lib/policy-optimization-search";

function policyListSearchHaystack(policy: PolicyListItem): string {
  return normalizeSearchText(
    [
      policy.name,
      policy.description,
      policy.owner,
      policy.createdBy,
      policy.compartment,
      policy.risk,
      policy.status,
      ...(policy.groups ?? []),
      ...(policy.compartments ?? []),
      ...(policy.statements ?? []).map((statement) => statement.text),
    ].join(" ")
  );
}

export function filterPolicyListItems(
  policies: PolicyListItem[],
  rawQuery: string
): PolicyListItem[] {
  const tokens = normalizeSearchText(rawQuery).split(" ").filter(Boolean);
  if (tokens.length === 0) return policies;
  return policies.filter((policy) => {
    const haystack = policyListSearchHaystack(policy);
    return tokens.every((token) => haystack.includes(token));
  });
}
