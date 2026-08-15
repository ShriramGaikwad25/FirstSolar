"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPolicyImpactSummary } from "@/lib/oci-policy-impact-summary-api";

export function useOciPolicyImpactSummary(policyUid: string | null | undefined) {
  return useQuery({
    queryKey: ["oci-policy-impact-summary", policyUid],
    queryFn: () => fetchPolicyImpactSummary(policyUid as string),
    enabled: Boolean(policyUid),
    staleTime: 30_000,
  });
}
