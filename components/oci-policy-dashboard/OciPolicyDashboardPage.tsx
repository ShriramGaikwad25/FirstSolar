"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { useOciPolicyList } from "@/hooks/useOciPolicyList";
import {
  storeOciTenancyId,
  useOciTenancyOptions,
} from "@/hooks/useOciTenancyOptions";
import { buildOciTenancy, DEFAULT_OCI_TENANCY_NAME, defaultOciTenancy } from "@/lib/oci-tenancy-metadata";
import {
  applyPolicyListFilters,
  collectPolicyCompartmentOptions,
  collectPolicyStatusOptions,
} from "@/lib/oci-policy-list-filters";
import { filterPolicyListItems } from "@/lib/oci-policy-list-search";
import {
  EMPTY_POLICY_LIST_FILTERS,
  OciPoliciesTable,
  type PolicyListFilters,
} from "@/components/OciPoliciesTable";
import { OciTenancySelect } from "@/components/OciTenancySelect";
import { PolicyAnalyticsCards } from "@/components/oci-policy-dashboard/PolicyAnalyticsCards";

export default function OciPolicyDashboardPage() {
  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
  } = useOciPolicyList(null);

  const policyTenancies = useMemo(() => {
    if (!data) return [];
    if (data.tenancies.length > 0) return data.tenancies;
    const fallback = buildOciTenancy(
      data.tenancyId ?? data.tenancyName,
      data.tenancyName ?? data.tenancyId ?? DEFAULT_OCI_TENANCY_NAME
    );
    return fallback ? [fallback] : [defaultOciTenancy()];
  }, [data]);

  const {
    tenancies,
    selectedTenancyId,
    setSelectedTenancyId,
    displayLabel,
    isLoading: tenanciesLoading,
  } = useOciTenancyOptions(policyTenancies);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [listFilters, setListFilters] = useState<PolicyListFilters>(EMPTY_POLICY_LIST_FILTERS);

  const configured = data?.configured ?? false;
  const policies = data?.policies ?? [];
  const analytics = data?.analytics ?? null;
  const normalizedSearch = searchQuery.trim();

  const statusOptions = useMemo(() => collectPolicyStatusOptions(policies), [policies]);
  const compartmentOptions = useMemo(
    () => collectPolicyCompartmentOptions(policies),
    [policies]
  );

  const handleTenancyChange = (tenancyId: string) => {
    setSelectedTenancyId(tenancyId);
    storeOciTenancyId(tenancyId);
    setPage(1);
  };

  const filteredPolicies = useMemo(() => {
    const searched = filterPolicyListItems(policies, normalizedSearch);
    return applyPolicyListFilters(searched, listFilters);
  }, [policies, normalizedSearch, listFilters]);

  useEffect(() => {
    setPage(1);
  }, [policies.length, pageSize, normalizedSearch, selectedTenancyId, listFilters]);

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 shrink-0">
        <div className="mb-2 flex flex-wrap items-start justify-end gap-3">
          <OciTenancySelect
            tenancies={tenancies}
            value={selectedTenancyId}
            displayLabel={displayLabel}
            onChange={handleTenancyChange}
            isLoading={tenanciesLoading || (isFetching && tenancies.length === 0)}
          />
        </div>
      </div>

      {!configured && !isLoading && (
        <div className="mb-3 flex shrink-0 items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Sign in to load policies from KeyForge.</p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-8 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading policies…
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error instanceof Error ? error.message : "Failed to load policies"}
        </div>
      )}

      {!isLoading && !isError && analytics && (
        <PolicyAnalyticsCards analytics={analytics} />
      )}

      {!isLoading && !isError && policies.length > 0 && (
        <OciPoliciesTable
          policies={filteredPolicies}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          filters={listFilters}
          onFiltersChange={setListFilters}
          statusOptions={statusOptions}
          compartmentOptions={compartmentOptions}
        />
      )}

      {!isLoading && !isError && configured && policies.length === 0 && (
        <p className="text-sm text-gray-600">
          No policies returned from the API. Use Load Policies on the Policy Optimization page
          first, then select a tenancy above.
        </p>
      )}
    </div>
  );
}
