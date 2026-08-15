import { LineItemDetail } from "@/types/lineItem";
import { PaginatedResponse, CertAnalyticsResponse } from "@/types/api";
import { getCertifications } from "@/lib/api";
import { apiRequestWithAuth } from "./auth";

const BASE_URL = "https://preview.keyforge.ai/certification/api/v1/ACMECOM";
const BASE_URL2 = "https://preview.keyforge.ai/entities/api/v1/ACMECOM";

// Uses apiRequestWithAuth: JWT expire -> refresh via access token -> retry once; access token expire -> logout
export async function fetchApiWithLoading<T>(
  endpoint: string,
  pageSize?: number,
  pageNumber?: number,
  options: RequestInit = {},
  onLoadingChange?: (loading: boolean, message?: string) => void
): Promise<T> {
  try {
    onLoadingChange?.(true, 'Loading data...');

    const url = new URL(endpoint);

    if (pageSize !== undefined) {
      url.searchParams.append("pageSize", pageSize.toString());
    }

    if (pageNumber !== undefined) {
      url.searchParams.append("pageNumber", pageNumber.toString());
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(options.headers as Record<string, string>),
    };

    return await apiRequestWithAuth<T>(url.toString(), { ...options, headers });
  } catch (error) {
    throw new Error(`API request failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    onLoadingChange?.(false);
  }
}

export async function getCertificationsWithLoading<T>(
  reviewerId: string,
  pageSize?: number,
  pageNumber?: number,
  onLoadingChange?: (loading: boolean, message?: string) => void
): Promise<{ certifications: PaginatedResponse<T>; analytics: CertAnalyticsResponse }> {
  onLoadingChange?.(true, "Loading certifications and analytics...");
  try {
    const res = await getCertifications<T>(reviewerId, pageSize, pageNumber);
    return res;
  } finally {
    onLoadingChange?.(false);
  }
}

export async function getCertificationDetailsWithLoading<T>(
  reviewerId: string,
  certId: string,
  pageSize?: number,
  pageNumber?: number,
  onLoadingChange?: (loading: boolean, message?: string) => void
): Promise<PaginatedResponse<T>> {
  const endpoint = `${BASE_URL}/getCertificationDetails/${reviewerId}/${certId}`;
  return fetchApiWithLoading(endpoint, pageSize, pageNumber, {}, onLoadingChange);
}

export async function getAccessDetailsWithLoading<T>(
  reviewerId: string,
  certId: string,
  taskId?: string,
  all?: string,
  pageSize?: number,
  pageNumber?: number,
  onLoadingChange?: (loading: boolean, message?: string) => void
): Promise<PaginatedResponse<T>> {
  if (!taskId && !all) {
    throw new Error("Either taskId or all must be provided");
  }
  const finalPart = all ? "All" : taskId!;
  const endpoint = `${BASE_URL}/getAccessDetails/${reviewerId}/${certId}/${finalPart}`;
  return fetchApiWithLoading(endpoint, pageSize, pageNumber, {}, onLoadingChange);
}

export async function getLineItemDetailsWithLoading(
  reviewerId: string,
  certId: string,
  taskId: string,
  lineItemId: string,
  pageSize?: number,
  pageNumber?: number,
  onLoadingChange?: (loading: boolean, message?: string) => void
): Promise<LineItemDetail[]> {
  const endpoint = `${BASE_URL}/getLineItemDetails/${reviewerId}/${certId}/${taskId}/${lineItemId}`;
  const response: { items?: LineItemDetail[] } = await fetchApiWithLoading(
    endpoint,
    pageSize,
    pageNumber,
    {},
    onLoadingChange
  );

  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response)) return response;

  return [];
}

interface UpdateActionPayload {
  useraction?: Array<{ userId: string; actionType: "Approve" | "Revoke"; justification: string }>;
  accountAction?: Array<{ lineItemId: string; actionType: "Approve" | "Revoke"; justification: string }>;
  entitlementAction?: Array<{ lineItemIds: string[]; actionType: "Approve" | "Revoke"; justification: string }>;
}

export async function updateActionWithLoading(
  reviewerId: string,
  certId: string,
  payload: UpdateActionPayload,
  onLoadingChange?: (loading: boolean, message?: string) => void
): Promise<void> {
  const endpoint = `${BASE_URL}/updateAction/${reviewerId}/${certId}`;
  await fetchApiWithLoading(endpoint, undefined, undefined, {
    method: "POST",
    body: JSON.stringify(payload),
  }, onLoadingChange);
}

export async function getAppOwnerDetailsWithLoading<T>(
  reviewerId: string,
  certId: string,
  pageSize?: number,
  pageNumber?: number,
  onLoadingChange?: (loading: boolean, message?: string) => void
): Promise<PaginatedResponse<T>> {
  const endpoint = `${BASE_URL}/getAPPOCertificationDetails/${reviewerId}/${certId}`;
  return fetchApiWithLoading(endpoint, pageSize, pageNumber, {}, onLoadingChange);
}

export async function getApplicationsWithLoading(
  reviewerId: string,
  onLoadingChange?: (loading: boolean, message?: string) => void
): Promise<void> {
  const endpoint = `${BASE_URL2}/getApplications/${reviewerId}`;
  return fetchApiWithLoading(endpoint, undefined, undefined, {}, onLoadingChange);
}

export async function getGroupedAppOwnerDetailsWithLoading<T>(
  reviewerId: string,
  certId: string,
  pageSize?: number,
  pageNumber?: number,
  onLoadingChange?: (loading: boolean, message?: string) => void
): Promise<PaginatedResponse<T>> {
  const endpoint = `${BASE_URL}/getAPPOGroupByEntsCertDetails/${reviewerId}/${certId}`;
  return fetchApiWithLoading(endpoint, pageSize, pageNumber, {}, onLoadingChange);
}

export async function getAppAccountsWithLoading(
  reviewerId: string,
  applicationinstanceid: string,
  onLoadingChange?: (loading: boolean, message?: string) => void
): Promise<void> {
  const endpoint = `${BASE_URL2}/getAppAccounts/${reviewerId}/${applicationinstanceid}`;
  return fetchApiWithLoading(endpoint, undefined, undefined, {}, onLoadingChange);
}

export async function getAppEntitlementWithLoading(
  reviewerId: string,
  applicationinstanceid: string,
  onLoadingChange?: (loading: boolean, message?: string) => void
): Promise<void> {
  const endpoint = `${BASE_URL2}/getAppEntitlements/${reviewerId}/${applicationinstanceid}`;
  return fetchApiWithLoading(endpoint, undefined, undefined, {}, onLoadingChange);
}
