'use client';

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useLoading } from "@/contexts/LoadingContext";
import { useEffect } from "react";
import {
  getCertifications,
  getCertificationDetails,
  getAccessDetails,
} from "@/lib/api";
import type { CertificationRow } from "@/types/certification";
import type { CertAnalyticsResponse } from "@/types/api";

export const useCertificationsWithLoading = (
  reviewerId: string,
  pageSize?: number,
  pageNumber?: number,
  setTotalPages?: (totalPages: number) => void,
  setTotalItems?: (totalItems: number) => void,
  enabled = true
): UseQueryResult<{ certifications: CertificationRow; analytics: CertAnalyticsResponse }> => {
  const { showApiLoader, hideApiLoader } = useLoading();

  const query = useQuery({
    queryKey: ["certifications", reviewerId, pageSize, pageNumber],
    queryFn: async () => {
      showApiLoader("Loading certifications and analytics...");
      try {
        const res = await getCertifications(reviewerId, pageSize, pageNumber);
        setTotalPages?.(res.certifications.total_pages ?? 1);
        setTotalItems?.(res.certifications.total_items ?? res.certifications.items?.length ?? 0);
        return res;
      } finally {
        hideApiLoader();
      }
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (query.isLoading) {
      showApiLoader("Loading certifications and analytics...");
    } else {
      hideApiLoader();
    }
  }, [query.isLoading, showApiLoader, hideApiLoader]);

  return query;
};


export const useCertificationDetailsWithLoading = (
  reviewerId: string,
  certId: string,
  pageSize?: number,
  pageNumber?: number,
  setTotalPages?: (totalPages: number) => void,
  setTotalItems?: (totalItems: number) => void,
  enabled = true
): UseQueryResult<any> => {
  const { showApiLoader, hideApiLoader } = useLoading();

  const query = useQuery({
    queryKey: [
      "certificationDetails",
      reviewerId,
      certId,
      pageSize,
      pageNumber,
    ],
    queryFn: async () => {
      showApiLoader("Loading certification details...");
      try {
        const res = await getCertificationDetails(
          reviewerId,
          certId,
          pageSize,
          pageNumber
        );
        setTotalPages?.(res.total_pages ?? 1);
        setTotalItems?.(res.total_items ?? res.items?.length ?? 0);
        return { ...res };
      } finally {
        hideApiLoader();
      }
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (query.isLoading) {
      showApiLoader("Loading certification details...");
    } else {
      hideApiLoader();
    }
  }, [query.isLoading, showApiLoader, hideApiLoader]);

  return query;
};

export const useAccessDetailsWithLoading = (
  reviewerId: string,
  certId: string,
  taskId?: string,
  all?: string,
  pageSize?: number,
  pageNumber?: number,
  setTotalPages?: (totalPages: number) => void,
  setTotalItems?: (totalItems: number) => void,
  enabled = true
) => {
  const { showApiLoader, hideApiLoader } = useLoading();

  const query = useQuery({
    queryKey: [
      "accessDetails",
      reviewerId,
      certId,
      taskId,
      all,
      pageSize,
      pageNumber,
    ],
    queryFn: async () => {
      showApiLoader("Loading access details...");
      try {
        const res = await getAccessDetails(
          reviewerId,
          certId,
          taskId,
          all,
          pageSize,
          pageNumber
        );
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
            description: "",
            applicationName: applicationInfo.accountName || "Unknown",
            lastLogin: applicationInfo.lastLogin || null,
            recommendation: item.aiassist?.Recommendation || "None",
            entitlementRecommendations: recommendations,
            action: appInstance.action || "None",
            oldComments: appInstance.oldComments || "",
            lineItemId: appInstance.lineItemId || "Unknown",
            taskId: item.taskId || "Unknown",
            entitlementNames,
            entitlementDescriptions
          });
        });

        return flattened;
      } finally {
        hideApiLoader();
      }
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (query.isLoading) {
      showApiLoader("Loading access details...");
    } else {
      hideApiLoader();
    }
  }, [query.isLoading, showApiLoader, hideApiLoader]);

  return query;
};
