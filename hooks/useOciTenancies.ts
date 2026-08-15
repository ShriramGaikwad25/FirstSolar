"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchOciTenancies, ociTenanciesApiUrl } from "@/lib/oci-tenancies-api";
import type { OciTenancy } from "@/types/oci-policy";

export type OciTenanciesResponse = {
  tenancies: OciTenancy[];
  activeTenancyId: string | null;
};

async function fetchTenancies(): Promise<OciTenanciesResponse> {
  return fetchOciTenancies();
}

export function useOciTenancies() {
  return useQuery({
    queryKey: ["oci-tenancies", ociTenanciesApiUrl(), "v1"],
    queryFn: fetchTenancies,
    staleTime: 60_000,
    retry: false,
  });
}
