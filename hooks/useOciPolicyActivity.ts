"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPolicyActivity } from "@/lib/oci-policy-activity-api";

export function useOciPolicyActivity(policyUid: string | null | undefined) {
  return useQuery({
    queryKey: ["oci-policy-activity", policyUid],
    queryFn: () => fetchPolicyActivity(policyUid as string),
    enabled: Boolean(policyUid),
    staleTime: 30_000,
  });
}
