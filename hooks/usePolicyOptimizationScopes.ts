"use client";

import { useQuery } from "@tanstack/react-query";

type PolicyScopesResponse = {
  configured: boolean;
  policyName?: string;
  scopes?: unknown;
  message?: string;
};

export async function fetchPolicyScopes(policyName: string): Promise<PolicyScopesResponse> {
  const res = await fetch(
    `/api/oci-policy-optimization/scopes/${encodeURIComponent(policyName)}`,
    { cache: "no-store" }
  );
  const data = (await res.json()) as PolicyScopesResponse;
  if (!res.ok) {
    throw new Error(data.message ?? `Failed to load policy scopes (${res.status})`);
  }
  return data;
}

export function usePolicyOptimizationScopes(policyName: string, enabled = true) {
  return useQuery({
    queryKey: ["oci-policy-optimization-scopes", policyName],
    queryFn: () => fetchPolicyScopes(policyName),
    staleTime: 60_000,
    enabled: enabled && Boolean(policyName.trim()),
  });
}
