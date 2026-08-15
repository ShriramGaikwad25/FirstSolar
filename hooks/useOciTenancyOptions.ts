"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchOciTenancies } from "@/lib/oci-tenancies-api";
import {
  COMPARTMENTS_API_URL,
  fetchCompartmentsTree,
} from "@/lib/compartments-api";
import {
  DEFAULT_OCI_TENANCY_NAME,
  defaultOciTenancy,
  extractTenancyMetadata,
  mergeOciTenancies,
  tenanciesFromFields,
} from "@/lib/oci-tenancy-metadata";
import type { OciTenancy } from "@/types/oci-policy";

const SELECTED_OCI_TENANCY_KEY = "kf_selected_oci_tenancy_id";

export function readStoredOciTenancyId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(SELECTED_OCI_TENANCY_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function storeOciTenancyId(tenancyId: string): void {
  if (typeof window === "undefined" || !tenancyId.trim()) return;
  try {
    sessionStorage.setItem(SELECTED_OCI_TENANCY_KEY, tenancyId.trim());
  } catch {
    // ignore
  }
}

async function loadTenancySources() {
  const [tenanciesResult, compartmentsResult] = await Promise.allSettled([
    fetchOciTenancies(),
    fetchCompartmentsTree(),
  ]);

  const fromTenanciesApi =
    tenanciesResult.status === "fulfilled" ? tenanciesResult.value.tenancies : [];
  const activeTenancyId =
    tenanciesResult.status === "fulfilled" ? tenanciesResult.value.activeTenancyId : null;

  const compartmentsMeta =
    compartmentsResult.status === "fulfilled"
      ? extractTenancyMetadata(compartmentsResult.value)
      : { tenancyId: null, tenancyName: null, tenancies: [] };

  const tenancies = mergeOciTenancies(
    fromTenanciesApi,
    compartmentsMeta.tenancies,
    tenanciesFromFields(compartmentsMeta.tenancyId, compartmentsMeta.tenancyName)
  );

  const defaultTenancyName =
    compartmentsMeta.tenancyName ??
    fromTenanciesApi.find((tenancy) => tenancy.name === DEFAULT_OCI_TENANCY_NAME)?.name ??
    fromTenanciesApi[0]?.name ??
    tenancies.find((tenancy) => tenancy.name === DEFAULT_OCI_TENANCY_NAME)?.name ??
    tenancies[0]?.name ??
    DEFAULT_OCI_TENANCY_NAME;

  const resolvedTenancies =
    tenancies.length > 0
      ? tenancies
      : [defaultOciTenancy()];

  return {
    tenancies: resolvedTenancies,
    activeTenancyId:
      activeTenancyId ??
      compartmentsMeta.tenancyId ??
      compartmentsMeta.tenancyName ??
      resolvedTenancies.find((tenancy) => tenancy.name === DEFAULT_OCI_TENANCY_NAME)?.id ??
      resolvedTenancies[0]?.id ??
      DEFAULT_OCI_TENANCY_NAME,
    defaultTenancyName,
  };
}

export function useOciTenancyOptions(extraTenancies: OciTenancy[] = []) {
  const query = useQuery({
    queryKey: ["oci-tenancy-options", COMPARTMENTS_API_URL, "v4"],
    queryFn: loadTenancySources,
    staleTime: 60_000,
    retry: false,
  });

  const [selectedTenancyId, setSelectedTenancyId] = useState("");
  const [initialized, setInitialized] = useState(false);

  const tenancies = useMemo(() => {
    const merged = mergeOciTenancies(extraTenancies, query.data?.tenancies);
    if (merged.length > 0) return merged;
    return [defaultOciTenancy()];
  }, [extraTenancies, query.data?.tenancies]);

  useEffect(() => {
    if (tenancies.length === 0) return;

    const storedId = readStoredOciTenancyId();
    const normalizedStored =
      storedId && storedId.toUpperCase() !== "ACMECOM" ? storedId : null;
    const preferredId =
      normalizedStored ??
      query.data?.activeTenancyId ??
      query.data?.defaultTenancyName ??
      tenancies.find((tenancy) => tenancy.name === DEFAULT_OCI_TENANCY_NAME)?.id ??
      tenancies[0]?.id;
    const matched =
      tenancies.find((tenancy) => tenancy.id === preferredId) ??
      tenancies.find((tenancy) => tenancy.name === preferredId) ??
      tenancies[0];

    setSelectedTenancyId((current) => {
      if (!initialized) return matched.id;
      if (current && tenancies.some((tenancy) => tenancy.id === current)) return current;
      return matched.id;
    });
    setInitialized(true);
  }, [initialized, query.data?.activeTenancyId, query.data?.defaultTenancyName, tenancies]);

  const selectedTenancy = useMemo(
    () => tenancies.find((tenancy) => tenancy.id === selectedTenancyId) ?? tenancies[0],
    [selectedTenancyId, tenancies]
  );

  const displayLabel =
    selectedTenancy?.label ||
    selectedTenancy?.name ||
    query.data?.defaultTenancyName ||
    DEFAULT_OCI_TENANCY_NAME ||
    selectedTenancyId ||
    null;

  return {
    tenancies,
    selectedTenancyId: selectedTenancyId || selectedTenancy?.id || "",
    setSelectedTenancyId,
    displayLabel,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
