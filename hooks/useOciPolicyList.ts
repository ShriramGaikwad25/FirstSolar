"use client";

import { useQuery } from "@tanstack/react-query";
import {
  buildPolicyListUrl,
  fetchPolicyList,
  isPolicyListApiConfigured,
} from "@/lib/policy-list-api";
import {
  enrichPolicyListAnalytics,
  enrichPolicyListItems,
} from "@/lib/oci-policy-list-enrichment";
import type { PolicyListAnalytics, PolicyListItem, OciTenancy } from "@/types/oci-policy";

export type PolicyListResponse = {
  configured: boolean;
  policies: PolicyListItem[];
  tenancyId: string | null;
  tenancyName: string | null;
  tenancies: OciTenancy[];
  analytics: PolicyListAnalytics | null;
};

async function fetchPolicies(tenancyId?: string | null): Promise<PolicyListResponse> {
  const result = await fetchPolicyList(undefined, tenancyId);
  const policies = enrichPolicyListItems(
    result.policies.map((policy) => ({
      ...policy,
      statements: policy.statements ?? [],
    }))
  );

  return {
    configured: isPolicyListApiConfigured(),
    policies,
    tenancyId: result.tenancyId,
    tenancyName: result.tenancyName,
    tenancies: result.tenancies,
    analytics: enrichPolicyListAnalytics(result.analytics, policies),
  };
}

export function useOciPolicyList(tenancyId?: string | null) {
  const normalizedTenancyId = tenancyId?.trim() || null;

  return useQuery({
    queryKey: ["oci-policies", buildPolicyListUrl(normalizedTenancyId), "v8"],
    queryFn: () => fetchPolicies(normalizedTenancyId),
    staleTime: 30_000,
  });
}
