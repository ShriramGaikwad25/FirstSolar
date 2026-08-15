"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchTagDashboardSummary,
  isTagDashboardApiConfigured,
  TAG_DASHBOARD_SUMMARY_API_URL,
} from "@/lib/tag-dashboard-api";
import type { TagDashboardSummary } from "@/types/oci-policy";

export type TagDashboardResponse = {
  configured: boolean;
  summary: TagDashboardSummary | null;
  tenancyName: string | null;
};

async function fetchTagDashboard(): Promise<TagDashboardResponse> {
  const result = await fetchTagDashboardSummary();
  return {
    configured: isTagDashboardApiConfigured(),
    summary: result.summary,
    tenancyName: result.tenancyName,
  };
}

export function useOciTagDashboard() {
  return useQuery({
    queryKey: ["oci-tag-dashboard", TAG_DASHBOARD_SUMMARY_API_URL],
    queryFn: fetchTagDashboard,
    staleTime: 30_000,
  });
}
