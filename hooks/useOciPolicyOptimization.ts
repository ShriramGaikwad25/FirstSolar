"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchPolicyOptimizationRows,
  isPolicyOptimizationApiConfigured,
  POLICY_OPTIMIZATION_API_URL,
} from "@/lib/policy-optimization-api";
import type {
  PolicyOptimizationItem,
  PolicyOptimizationSummary,
} from "@/types/oci-policy";

export type PolicyOptimizationResponse = {
  configured: boolean;
  rows: PolicyOptimizationItem[];
  summary: PolicyOptimizationSummary | null;
  tenancyName: string | null;
  message?: string;
};

async function fetchPolicyOptimization(): Promise<PolicyOptimizationResponse> {
  const result = await fetchPolicyOptimizationRows();
  return {
    configured: isPolicyOptimizationApiConfigured(),
    rows: result.rows,
    summary: result.summary,
    tenancyName: result.tenancyName,
  };
}

export function useOciPolicyOptimization() {
  return useQuery({
    queryKey: ["oci-policy-optimization", POLICY_OPTIMIZATION_API_URL],
    queryFn: fetchPolicyOptimization,
    staleTime: 30_000,
  });
}
