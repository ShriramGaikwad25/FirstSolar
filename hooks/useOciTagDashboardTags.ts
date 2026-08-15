"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchTagDashboardTags,
  TAG_DASHBOARD_TAGS_API_URL,
} from "@/lib/tag-dashboard-api";
import type { TagDashboardTagsView } from "@/types/oci-policy";

export function useOciTagDashboardTags() {
  return useQuery({
    queryKey: ["oci-tag-dashboard-tags", TAG_DASHBOARD_TAGS_API_URL],
    queryFn: () => fetchTagDashboardTags(),
    staleTime: 30_000,
  });
}

export type { TagDashboardTagsView };
