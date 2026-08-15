import { useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  getCertifications,
  getCertificationDetails,
  getAccessDetails,
} from "@/lib/api";

import type { CertificationRow } from "@/types/certification";
import type { CertAnalyticsResponse } from "@/types/api";

export const useCertifications = (
  reviewerId: string,
  pageSize?: number,
  pageNumber?: number,
  setTotalPages?: (totalPages: number) => void,
  setTotalItems?: (totalItems: number) => void,
  enabled = true
): UseQueryResult<{ certifications: CertificationRow; analytics: CertAnalyticsResponse }> => {
  return useQuery({
    queryKey: ["certifications", reviewerId, pageSize, pageNumber],
    queryFn: async () => {
      const res = await getCertifications(reviewerId, pageSize, pageNumber);
      setTotalPages?.(res.certifications.total_pages ?? 1);
      setTotalItems?.(res.certifications.total_items ?? res.certifications.items?.length ?? 0);
      return res;
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });
};


export const useCertificationDetails = (
  reviewerId: string,
  certId: string,
  pageSize?: number,
  pageNumber?: number,
  setTotalPages?: (totalPages: number) => void,
  setTotalItems?: (totalItems: number) => void,
  enabled = true
): UseQueryResult<any> => {
  return useQuery({
    queryKey: [
      "certificationDetails",
      reviewerId,
      certId,
      pageSize,
      pageNumber,
    ],
    queryFn: async () => {
      const res = await getCertificationDetails(
        reviewerId,
        certId,
        pageSize,
        pageNumber
      );
      setTotalPages?.(res.total_pages ?? 1);
      setTotalItems?.(res.total_items ?? res.items?.length ?? 0);
      return { ...res };
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });
};

export const fetchAccessDetails = async (
  reviewerId: string,
  certId: string,
  taskId?: string,
  all?: string,
  pageSize?: number,
  pageNumber?: number,
  setTotalPages?: (totalPages: number) => void,
  setTotalItems?: (totalItems: number) => void,
  filter?: string
) => {
  // Call the API to get access details
  const res: {
    items?: any[];
    total_pages?: number;
    total_items?: number;
  } = await getAccessDetails(
    reviewerId,
    certId,
    taskId,
    all,
    pageSize,
    pageNumber,
    filter
  );

  // Update total pages and items if callback functions are provided
  setTotalPages?.(res.total_pages ?? 1);
  setTotalItems?.(res.total_items ?? res.items?.length ?? 0);

  // Flatten the items into an array of application instance-level objects
  const flattened: any[] = [];

  // Iterate over the top-level items (application instances)
  res.items?.forEach((item: any) => {
    const appInstance = item.entityAppinstance || {};
    const applicationInfo = item.applicationInfo || {};
    const entitlements = item.entityEntitlements?.items || [];

    // Aggregate entitlement names and descriptions
    const entitlementNames = entitlements.map((ent: any) => 
      ent.entityEntitlements?.entitlementName || "None"
    );
    const entitlementDescriptions = entitlements.map((ent: any) => 
      ent.entityEntitlements?.entitlementDescription || ""
    );
    const recommendations = entitlements.map((ent: any) => 
      ent.aiassist?.Recommendation || "None"
    );

    flattened.push({
      itemType: "ApplicationInstance",
      user: applicationInfo.username || "Unknown",
      risk: appInstance.itemRisk || "Unknown",
      description: "", // No description at app instance level in response
      applicationName: applicationInfo.applicationName || "Unknown",
      lastLogin: applicationInfo.lastLogin || null, // Not present, default to null
      recommendation: item.aiassist?.Recommendation || "None", // App instance-level recommendation
      entitlementRecommendations: recommendations, // Array of entitlement-level recommendations
      action: appInstance.action || "None",
      oldComments: appInstance.oldComments || "",
      lineItemId: appInstance.lineItemId || "Unknown",
      taskId: item.taskId || "Unknown",
      entitlementNames, // Array of entitlement names
      entitlementDescriptions // Array of entitlement descriptions
    });
  });

  return flattened;
};