"use client";

import { useQuery } from "@tanstack/react-query";
import type { OciPolicyGraphData } from "@/types/oci-policy-graph";

type GraphResponse = {
  configured: boolean;
  graph?: OciPolicyGraphData;
  message?: string;
};

async function fetchGraph(policy: string): Promise<GraphResponse> {
  const params = new URLSearchParams({ policy });
  const res = await fetch(`/api/oci-policy-graph?${params}`, { cache: "no-store" });
  const data = (await res.json()) as GraphResponse;
  if (!res.ok) {
    throw new Error(data.message ?? `Failed to load graph (${res.status})`);
  }
  return data;
}

export function useOciPolicyGraph(policyName: string, enabled = true) {
  return useQuery({
    queryKey: ["oci-policy-graph", "v2", policyName],
    queryFn: () => fetchGraph(policyName),
    staleTime: 60_000,
    enabled: enabled && Boolean(policyName.trim()),
  });
}
