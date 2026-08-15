"use client";

import { useQuery } from "@tanstack/react-query";
import type { OciGroupAccessDetail, OciGroupAccessSummary } from "@/types/oci-group";

export type OciGroupAccessListResponse = {
  configured: boolean;
  groups: OciGroupAccessSummary[];
  message?: string;
};

function buildGroupAccessListUrl(tenancyId?: string | null): string {
  const params = new URLSearchParams();
  const id = tenancyId?.trim();
  if (id) params.set("tenancyId", id);
  const qs = params.toString();
  return `/api/oci-group-access${qs ? `?${qs}` : ""}`;
}

async function fetchGroupAccessList(tenancyId?: string | null): Promise<OciGroupAccessListResponse> {
  const res = await fetch(buildGroupAccessListUrl(tenancyId), { cache: "no-store" });
  const data = (await res.json()) as OciGroupAccessListResponse;
  if (!res.ok) {
    throw new Error(data.message ?? `Failed to load group access (${res.status})`);
  }
  return data;
}

export function useOciGroupAccessList(tenancyId?: string | null) {
  const normalizedTenancyId = tenancyId?.trim() || null;

  return useQuery({
    queryKey: ["oci-group-access", buildGroupAccessListUrl(normalizedTenancyId)],
    queryFn: () => fetchGroupAccessList(normalizedTenancyId),
    staleTime: 30_000,
  });
}

export type OciGroupAccessDetailResponse = {
  configured: boolean;
  group: OciGroupAccessDetail;
  message?: string;
};

function buildGroupAccessDetailUrl(groupName: string, tenancyId?: string | null): string {
  const params = new URLSearchParams();
  const id = tenancyId?.trim();
  if (id) params.set("tenancyId", id);
  const qs = params.toString();
  return `/api/oci-group-access/${encodeURIComponent(groupName)}${qs ? `?${qs}` : ""}`;
}

async function fetchGroupAccessDetail(
  groupName: string,
  tenancyId?: string | null
): Promise<OciGroupAccessDetailResponse> {
  const res = await fetch(buildGroupAccessDetailUrl(groupName, tenancyId), { cache: "no-store" });
  const data = (await res.json()) as OciGroupAccessDetailResponse;
  if (!res.ok) {
    throw new Error(data.message ?? `Failed to load group access (${res.status})`);
  }
  return data;
}

export function useOciGroupAccessDetail(groupName: string, tenancyId?: string | null) {
  const normalizedGroupName = groupName.trim();
  const normalizedTenancyId = tenancyId?.trim() || null;

  return useQuery({
    queryKey: [
      "oci-group-access-detail",
      normalizedGroupName,
      buildGroupAccessDetailUrl(normalizedGroupName, normalizedTenancyId),
    ],
    queryFn: () => fetchGroupAccessDetail(normalizedGroupName, normalizedTenancyId),
    enabled: Boolean(normalizedGroupName),
    staleTime: 30_000,
  });
}
