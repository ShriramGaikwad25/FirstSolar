import { LineItemDetail } from "@/types/lineItem";
import { PaginatedResponse, CertAnalyticsResponse } from "@/types/api";
import { string } from "yup";
import { apiRequestWithAuth, checkTokenExpiredError, getCookie, COOKIE_NAMES } from "./auth";
import { getOriginalFetch } from "./authFetch";
import { mergeSupportedObjectsExtensions } from "./supported-objects-extensions";
import { getActiveTenantId } from "./tenant";
import { tenantId as defaultTenantId } from "./config";

const BASE_URL = "https://preview.keyforge.ai/certification/api/v1/ACMECOM";

const BASE_URL2 = "https://preview.keyforge.ai/entities/api/v1/ACMECOM";

// Uses apiRequestWithAuth so JWT expire -> refresh via access token -> retry once; access token expire -> logout
export async function fetchApi<T>(
  endpoint: string,
  pageSize?: number,
  pageNumber?: number,
  options: RequestInit = {}
): Promise<T> {
  try {
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

    return apiRequestWithAuth<T>(url.toString(), { ...options, headers });
  } catch (error) {
    throw new Error(`API request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// New authenticated API function
export async function fetchApiWithAuth<T>(
  endpoint: string,
  pageSize?: number,
  pageNumber?: number,
  options: RequestInit = {}
): Promise<T> {
  try {
    const url = new URL(endpoint);

    if (pageSize !== undefined) {
      url.searchParams.append("pageSize", pageSize.toString());
    }

    if (pageNumber !== undefined) {
      url.searchParams.append("pageNumber", pageNumber.toString());
    }

    return apiRequestWithAuth<T>(url.toString(), options);
  } catch (error) {
    throw new Error(`Authenticated API request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getCertifications<T>(
  reviewerId: string,
  pageSize?: number,
  pageNumber?: number
): Promise<{ certifications: PaginatedResponse<T>; analytics: CertAnalyticsResponse }> {
  // Call both APIs in parallel for better performance
  const [certifications, analytics] = await Promise.all([
    fetchApi<PaginatedResponse<T>>(`${BASE_URL}/getCertificationList/${reviewerId}`, pageSize, pageNumber),
    getCertAnalytics(reviewerId)
  ]);

  return {
    certifications,
    analytics
  };
}

export async function getCertAnalytics(
  reviewerId: string
): Promise<CertAnalyticsResponse> {
  const endpoint = `https://preview.keyforge.ai/certification/api/v1/ACMECOM/getCertAnalytics/${reviewerId}`;
  return fetchApi(endpoint);
}


export async function getCertificationDetails<T>(
  reviewerId: string,
  certId: string,
  pageSize?: number,
  pageNumber?: number
): Promise<PaginatedResponse<T>> {
  const endpoint = `${BASE_URL}/getCertificationDetails/${reviewerId}/${certId}`;
  return fetchApi(endpoint, pageSize, pageNumber);
}

export async function getAccessDetails<T>(
  reviewerId: string,
  certId: string,
  taskId?: string,
  all?: string,
  pageSize?: number,
  pageNumber?: number,
  filter?: string,
  retryCount: number = 0
): Promise<PaginatedResponse<T>> {
  if (!taskId && !all) {
    throw new Error("Either taskId or all must be provided");
  }
  const finalPart = all ? "All" : taskId!;
  let endpoint = `${BASE_URL}/getAccessDetails/${reviewerId}/${certId}/${finalPart}`;
  
  // Add filter as query parameter if provided
  if (filter) {
    const url = new URL(endpoint);
    url.searchParams.append("filter", filter);
    endpoint = url.toString();
  }
  
  return fetchApi(endpoint, pageSize, pageNumber);
}

export async function getLineItemDetails(
  reviewerId: string,
  certId: string,
  taskId: string,
  lineItemId: string,
  pageSize?: number,
  pageNumber?: number,
  /**
   * Optional filter expression, e.g. "action eq Reject" | "action eq Approve" | "action eq Pending"
   */
  filter?: string
): Promise<LineItemDetail[]> {
  const baseEndpoint = `${BASE_URL}/getLineItemDetails/${reviewerId}/${certId}/${taskId}/${lineItemId}`;
  const url = new URL(baseEndpoint);

  if (filter) {
    url.searchParams.append("filter", filter);
  }

  const response: { items?: LineItemDetail[] } = await fetchApi(
    url.toString(),
    pageSize,
    pageNumber
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

export async function updateAction(
  reviewerId: string,
  certId: string,
  payload: UpdateActionPayload
): Promise<void> {
  const endpoint = `${BASE_URL}/updateAction/${reviewerId}/${certId}`;
  await fetchApi(endpoint, undefined, undefined, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface ModifyAccessRemoveItem {
  parentLineItemId: string;
  lineItemId: string;
  name: string;
  accountId: string;
  applicationName: string;
  justification: string;
  /** Optional end date for conditional access (format MM-DD-YYYY) */
  endDate?: string;
}

export interface ModifyAccessAddItem {
  parentLineItemId: string;
  name: string;
  accountId: string;
  applicationName: string;
  justification: string;
}

export interface ModifyAccessPayload {
  reviewerName: string;
  reviewerId: string;
  certificationId: string;
  taskId: string;
  removeAccess: ModifyAccessRemoveItem[];
  addAccess: ModifyAccessAddItem[];
}

/** Uses same-origin proxy to avoid CORS when calling KeyForge certification API */
function getCertificationProxyUrl(path: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/certification/${path}`;
  }
  return `${BASE_URL}/${path}`;
}

export async function modifyAccess(
  reviewerId: string,
  certId: string,
  taskId: string,
  lineItemId: string,
  payload: ModifyAccessPayload
): Promise<void> {
  const path = `modifyAccess/${reviewerId}/${certId}/${taskId}/${lineItemId}`;
  const endpoint = getCertificationProxyUrl(path);
  await apiRequestWithAuth<void>(endpoint, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface ImmediateRevokeRemoveEntitlement {
  parentLineItemId: string;
  lineItemId: string;
  name: string;
  accountId: string;
  applicationName: string;
  justification: string;
}

export interface ImmediateRevokePayload {
  reviewerName: string;
  reviewerId: string;
  certificationId: string;
  taskId: string;
  revokeEntityType: "entitlement";
  removeAccounts: unknown[];
  removeEntitlements: ImmediateRevokeRemoveEntitlement[];
}

export async function immediateRevoke(
  reviewerId: string,
  certId: string,
  taskId: string,
  lineItemId: string,
  payload: ImmediateRevokePayload
): Promise<void> {
  const path = `immediateRevoke/${reviewerId}/${certId}/${taskId}`;
  const endpoint = getCertificationProxyUrl(path);
  await apiRequestWithAuth<void>(endpoint, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAppOwnerDetails<T>(
  reviewerId: string,
  certId: string,
  pageSize?: number,
  pageNumber?: number
): Promise<PaginatedResponse<T>> {
  const endpoint = `${BASE_URL}/getAPPOCertificationDetails/${reviewerId}/${certId}`;
  return fetchApi(endpoint, pageSize, pageNumber);
}

export async function getApplications(
reviewerId: string,
):Promise<void>{
  const endpoint = `${BASE_URL2}/getApplications/${reviewerId}`
  return fetchApi(endpoint)
}
  
export async function getGroupedAppOwnerDetails<T>(
  reviewerId: string,
  certId: string,
  pageSize?: number,
  pageNumber?: number,
  /**
   * Optional filter expression, e.g. "action eq Pending" | "action eq Approve" | "action eq Reject"
   */
  filter?: string
): Promise<PaginatedResponse<T>> {
  const baseEndpoint = `${BASE_URL}/getAPPOGroupByEntsCertDetails/${reviewerId}/${certId}`;
  const url = new URL(baseEndpoint);

  if (filter) {
    url.searchParams.append("filter", filter);
  }
  if (pageSize !== undefined) {
    url.searchParams.append("pageSize", pageSize.toString());
  }
  if (pageNumber !== undefined) {
    url.searchParams.append("pageNumber", pageNumber.toString());
  }

  const headers = {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  return apiRequestWithAuth<PaginatedResponse<T>>(url.toString(), { headers });
}

export async function getAppAccounts(
reviewerId: string,
applicationinstanceid:string
):Promise<void>{
  const endpoint = `${BASE_URL2}/getAppAccounts/${reviewerId}/${applicationinstanceid}`
  return fetchApi(endpoint)
}

export async function getAppEntitlement(
reviewerId: string,
applicationinstanceid:string
):Promise<void>{
  const endpoint = `${BASE_URL2}/getAppEntitlements/${reviewerId}/${applicationinstanceid}`
  return fetchApi(endpoint)
}

export async function getAllRegisteredApps(
  reviewerId: string
): Promise<{ items: Array<{ applicationId: string; applicationName: string; scimurl: string; filter: string }>; executionStatus: string }> {
  const endpoint = `https://preview.keyforge.ai/entities/api/v1/ACMECOM/getAllRegisteredApp/${reviewerId}`;
  return fetchApi(endpoint);
}

export async function searchUsers(
  payload: { filter: string; applicationId: string; scimurl: string; applicationName: string }
): Promise<any> {
  const endpoint = `https://preview.keyforge.ai/entities/api/v1/ACMECOM/search/user`;
  return apiRequestWithAuth<any>(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(payload),
  });
}

export async function getAPPOCertificationDetailsWithFilter<T>(
  reviewerId: string,
  certificationId: string,
  filter: string,
  pageSize?: number,
  pageNumber?: number
): Promise<PaginatedResponse<T>> {
  const endpoint = `https://preview.keyforge.ai/certification/api/v1/ACMECOM/getAPPOCertificationDetails/${reviewerId}/${certificationId}`;
  
  const url = new URL(endpoint);
  url.searchParams.append("filter", filter);
  if (pageSize !== undefined) {
    url.searchParams.append("pageSize", pageSize.toString());
  }
  if (pageNumber !== undefined) {
    url.searchParams.append("pageNumber", pageNumber.toString());
  }

  const headers = {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  return apiRequestWithAuth<PaginatedResponse<T>>(url.toString(), { headers });
}

export async function getEntitlementDetails(
  appInstanceId: string,
  entitlementId: string
): Promise<any> {
  const endpoint = `https://preview.keyforge.ai/catalog/api/v1/ACMECOM/app/${appInstanceId}/entitlement/${entitlementId}`;
  
  // Use apiRequestWithAuth to automatically handle token refresh and authentication
  return apiRequestWithAuth<any>(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
}

export async function getCatalogEntitlements<T>(
  appInstanceId: string,
  reviewerId: string,

): Promise<T> {
  const endpoint = `https://preview.keyforge.ai/catalog/api/v1/ACMECOM/app/${appInstanceId}/entitlement`;
  
  const url = new URL(endpoint);
  url.searchParams.append("filter", `appownerid eq ${reviewerId}`);
  
  // Use apiRequestWithAuth to automatically handle token refresh and authentication
  return apiRequestWithAuth<T>(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
}

function resolveEntitiesTenant(): string {
  return getActiveTenantId() || defaultTenantId?.trim() || "ACMECOM";
}

export async function executeQuery<T>(
  query: string,
  parameters: any[]
): Promise<T> {
  const endpoint = `https://preview.keyforge.ai/entities/api/v1/${resolveEntitiesTenant()}/executeQuery`;
  
  const payload = {
    query,
    parameters
  };

  // apiRequestWithAuth already handles token expiration and refresh internally
  const result = await apiRequestWithAuth<T>(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(payload),
  });

  return result;
}

/** Builds applicationinstance.configuration from schema mapping rows. */
export function buildApplicationInstanceConfiguration(
  mappings: Array<{ source?: string; target?: string; keyfieldMapping?: boolean }>
): Record<string, string> {
  const keyfield = mappings.find((m) => m.keyfieldMapping && m.target?.trim() && m.source?.trim());
  if (keyfield) {
    return {
      matchUserAttribute: keyfield.target!.trim(),
      identityMatchingAttribute: keyfield.source!.trim(),
    };
  }
  const userNameMapping = mappings.find(
    (m) => m.target?.trim().toLowerCase() === "username" && m.source?.trim()
  );
  if (userNameMapping) {
    return {
      matchUserAttribute: userNameMapping.target!.trim(),
      identityMatchingAttribute: userNameMapping.source!.trim(),
    };
  }
  const first = mappings.find((m) => m.target?.trim() && m.source?.trim());
  if (first) {
    return {
      matchUserAttribute: first.target!.trim(),
      identityMatchingAttribute: first.source!.trim(),
    };
  }
  return {
    matchUserAttribute: "userName",
    identityMatchingAttribute: "username",
  };
}

/** executeQuery: register new app via DB function after SCIM registration. */
export async function executeAddNewAppFunction(applicationName: string): Promise<unknown> {
  return executeQuery(`select kf_app_add_new_app_fn(?)`, [applicationName]);
}

/** executeQuery: persist applicationinstance configuration (identity matching attrs). */
export async function executeUpdateApplicationInstanceConfiguration(
  appId: string,
  configuration: Record<string, string>
): Promise<unknown> {
  return executeQuery("CALL kf_update_applicationinstance_configuration(?,?::jsonb)", [
    appId,
    configuration,
  ]);
}

// Update campaign schedule
export async function updateCampaignSchedule(payload: {
  campaignName: string;
  campaignId: string;
  description: string;
  startDate: string;
  zoneId: string;
  runItOnce: string;
  neverEnds: string;
  endsOn?: string;
  enableStaging: string;
  frequency?: {
    period: string;
    periodValue: string;
  };
}): Promise<any> {
  const endpoint = "https://preview.keyforge.ai/kfscheduler/api/v1/ACMECOM/jobs/updateschedule/campaign";
  
  // apiRequestWithAuth already handles token expiration and refresh internally
  const result = await apiRequestWithAuth<any>(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "ISPM-Scheduler/1.0",
    },
    body: JSON.stringify(payload),
  });

  return result;
}

// Get all supported application types for registration (registerscimapp uses access token)
export async function getAllSupportedApplicationTypes(): Promise<any> {
  const endpoint =
    "https://preview.keyforge.ai/registerscimapp/registerfortenant/ACMECOM/getAllSupportedObjects";
  const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  if (!accessToken) {
    throw new Error("No access token available");
  }
  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`getAllSupportedObjects failed: ${response.status} - ${errorText}`);
  }
  const data = await response.json();
  if (await checkTokenExpiredError(data)) {
    throw new Error("Token Expired");
  }
  return mergeSupportedObjectsExtensions(data);
}

// Get all registered applications
export interface Application {
  ApplicationType: string;
  TenantID: string;
  ApplicationName: string;
  SCIMURL: string;
  APIToken: string;
  ApplicationID: string;
}

export interface GetAllApplicationsResponse {
  Applications: Application[];
  message?: string;
  status?: string;
}

export async function getAllApplications(): Promise<any> {
  const endpoint = "https://preview.keyforge.ai/registerscimapp/registerfortenant/ACMECOM/getAllApplications";
  
  try {
    // Get access token for authentication
    const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    // Use Headers object to ensure accessToken is used (not JWT from global patch)
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('X-Requested-With', 'XMLHttpRequest');
    headers.set('Authorization', `Bearer ${accessToken}`);
    
    // Use original fetch (before JWT patch) to ensure accessToken is used, not JWT
    // This bypasses the global fetch patch that adds JWT tokens
    const fetchFn = typeof window !== 'undefined' ? getOriginalFetch() : fetch;
    
    // Make request with required headers for registerscimapp endpoints
    // Using original fetch ensures the Authorization header with accessToken is used
    // and won't be overridden by the global JWT patch
    const response = await fetchFn(endpoint, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Check if error body contains token expired error
      try {
        const errorData = JSON.parse(errorText);
        if (await checkTokenExpiredError(errorData)) {
          throw new Error('Token Expired');
        }
      } catch (e) {
        // If parsing fails, continue with original error
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    // Check for token expired error in successful responses
    if (await checkTokenExpiredError(data)) {
      throw new Error('Token Expired');
    }
    
    console.log('getAllApplications response:', data);
    return data;
  } catch (error) {
    console.error('Error fetching applications:', error);
    throw error;
  }
}

/** POST registerscimapp newApp — create app registration after Integration Setting (step 3). */
export async function registerScimAppNewApp(payload: {
  ApplicationName: string;
  ApplicationType: string;
  ApplicationDetails: Record<string, string>;
}): Promise<unknown> {
  const endpoint = "https://preview.keyforge.ai/registerscimapp/registerfortenant/ACMECOM/newApp";
  const body = {
    ApplicationName: payload.ApplicationName,
    ApplicationType: payload.ApplicationType,
    ApplicationDetails: payload.ApplicationDetails,
    OAuthDetails: {
      OAuthType: "KPOAUTH",
      adminID: "ACMEADMIN",
    },
  };

  const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  if (!accessToken) {
    throw new Error("No access token available");
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  headers.set("Authorization", `Bearer ${accessToken}`);

  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      if (await checkTokenExpiredError(errorData)) {
        throw new Error("Token Expired");
      }
    } catch (e) {
      if (e instanceof Error && e.message === "Token Expired") throw e;
    }
    throw new Error(`newApp failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (await checkTokenExpiredError(data)) {
    throw new Error("Token Expired");
  }
  return data;
}

export const CONNECTION_PARAMETERS_GROUP_ID = "connectionParameters";

export const GROUPED_ONBOARD_APPLICATION_TYPES = [
  "Database",
  "RESTService Application",
  "ScreenScrapping",
] as const;

export type GroupedOnboardApplicationType = (typeof GROUPED_ONBOARD_APPLICATION_TYPES)[number];

export function isGroupedOnboardApplicationType(type: string | undefined): type is GroupedOnboardApplicationType {
  if (!type?.trim()) return false;
  return (GROUPED_ONBOARD_APPLICATION_TYPES as readonly string[]).includes(type.trim());
}

/** REST-style AI Agent onboard types (URL-first integration, no DB session). */
export function isRestLikeGroupedOnboardApplicationType(type: string | undefined): boolean {
  if (!type?.trim()) return false;
  const t = type.trim();
  return t === "RESTService Application" || t === "ScreenScrapping";
}

/** Application types with the specialized AI Agent wizard flow. Also available in normal Add Application. */
export function isAiAgentOnboardApplicationType(type: string | undefined): boolean {
  return isGroupedOnboardApplicationType(type);
}

/** Types that only appear as the (AI Agent) card — no standard onboard card. */
export function isAiAgentOnlyOnboardApplicationType(type: string | undefined): boolean {
  return type?.trim() === "ScreenScrapping";
}

/** Integration field keys hidden in the Database onboarding UI (still allowed in API payloads if set). */
export function filterIntegrationFieldsForApplicationType(
  applicationType: string,
  fieldKeys: string[]
): string[] {
  if (applicationType.trim() !== "Database") return fieldKeys;
  return fieldKeys.filter((k) => k.trim().toLowerCase() !== "driver");
}

function connectionTestAuthHeaders(): Headers {
  const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  if (!accessToken) {
    throw new Error("No access token available");
  }
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  headers.set("Authorization", `Bearer ${accessToken}`);
  return headers;
}

export type ConnectionTestResult = {
  ok: boolean;
  message: string;
  session_id?: string;
};

/** Parses gatewayassist / legacy test-connection JSON for UI feedback. */
export function parseConnectionTestResult(data: unknown): ConnectionTestResult {
  if (data == null) {
    return { ok: true, message: "Connection successful." };
  }
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (o.success === true) {
      const session_id = String(o.session_id ?? o.sessionId ?? "").trim() || undefined;
      return {
        ok: true,
        message: String(o.message ?? "Connection successful.").trim() || "Connection successful.",
        session_id,
      };
    }
    if (o.success === false) {
      return {
        ok: false,
        message: String(o.message ?? o.errorMessage ?? "Connection test failed.").trim(),
      };
    }
    const status = String(o.status ?? o.Status ?? "").toLowerCase().trim();
    const message = String(
      o.message ?? o.Message ?? o.errorMessage ?? o.error ?? ""
    ).trim();
    if (status === "success" || status === "ok") {
      const session_id = String(o.session_id ?? o.sessionId ?? "").trim() || undefined;
      return { ok: true, message: message || "Connection successful.", session_id };
    }
    if (status === "error" || status === "failed" || status === "failure") {
      return { ok: false, message: message || "Connection test failed." };
    }
    if (message) {
      return { ok: true, message };
    }
  }
  return { ok: true, message: "Connection successful." };
}

export type DatabaseFetchSchemaPayload = {
  session_id: string;
  view_name: string;
  is_stored_procedure: boolean;
};

function pickSchemaFieldString(o: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = o[key];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function databaseColumnNameFromEntry(entry: unknown): string {
  if (entry == null) return "";
  if (typeof entry === "string") return entry.trim();
  if (typeof entry === "object" && !Array.isArray(entry)) {
    const o = entry as Record<string, unknown>;
    return pickSchemaFieldString(
      o,
      "column_name",
      "columnName",
      "column",
      "target",
      "name",
      "field",
      "attribute",
      "Attribute",
      "key",
      "rest_field",
      "restField",
      "connector_attribute",
      "connectorAttribute",
      "json_path",
      "jsonPath",
      "source_field",
      "sourceField"
    );
  }
  return "";
}

function parseDatabaseSchemaMappingEntry(
  entry: unknown,
  idx: number
): WizardSchemaMappingRow | null {
  const dbColumn = databaseColumnNameFromEntry(entry);
  if (!dbColumn) return null;

  let bestMatch = "";
  let option2 = "";
  if (entry != null && typeof entry === "object" && !Array.isArray(entry)) {
    const o = entry as Record<string, unknown>;
    bestMatch = pickSchemaFieldString(
      o,
      "best_match",
      "bestMatch",
      "best_match_attribute",
      "bestMatchAttribute",
      "variable",
      "source",
      "source_attribute",
      "sourceAttribute"
    );
    option2 = pickSchemaFieldString(
      o,
      "option_2",
      "option2",
      "option_2_attribute",
      "option2Attribute",
      "second_match",
      "secondMatch"
    );
    if (!bestMatch && o.suggested != null) {
      bestMatch = displayFromSuggestOption(o.suggested);
    }
    if (!option2) {
      const other = o.other_options ?? o.otherOptions;
      if (Array.isArray(other) && other.length > 0) {
        option2 = displayFromSuggestOption(other[0]);
      }
    }
  }

  return {
    id: `db-schema-${idx}`,
    target: dbColumn,
    source: bestMatch,
    bestMatch,
    option2,
    defaultValue: "",
    type: "direct",
    keyfieldMapping: false,
  };
}

function collectDatabaseSchemaMappingEntries(node: unknown, depth = 0): unknown[] {
  if (node == null || depth > 6) return [];
  if (Array.isArray(node)) {
    const rows: unknown[] = [];
    for (const item of node) {
      if (databaseColumnNameFromEntry(item)) rows.push(item);
      else rows.push(...collectDatabaseSchemaMappingEntries(item, depth + 1));
    }
    return rows;
  }
  if (typeof node !== "object") return [];

  const o = node as Record<string, unknown>;
  const listKeys = [
    "columns",
    "fields",
    "attributes",
    "schema_columns",
    "column_names",
    "schema",
    "mappings",
    "schema_mappings",
    "schemaMappings",
    "user_columns",
    "userColumns",
    "user_attributes",
    "userAttributes",
    "users_schema",
    "user_schema",
    "userSchema",
    "rest_columns",
    "restColumns",
    "data",
    "result",
    "response",
    "body",
    "users",
    "content",
    "items",
    "records",
    "results",
  ];
  for (const key of listKeys) {
    if (key in o) {
      const found = collectDatabaseSchemaMappingEntries(o[key], depth + 1);
      if (found.length > 0) return found;
    }
  }
  return [];
}

/** Maps fetch-schema API response to database wizard rows (target = DB column, source = selected IGA attribute). */
export function attributeMappingsFromFetchSchemaJson(json: unknown): WizardSchemaMappingRow[] {
  const entries = collectDatabaseSchemaMappingEntries(json);
  const rows: WizardSchemaMappingRow[] = [];
  const seenColumns = new Set<string>();
  entries.forEach((entry, idx) => {
    const row = parseDatabaseSchemaMappingEntry(entry, idx);
    if (!row) return;
    const key = row.target.toLowerCase();
    if (seenColumns.has(key)) return;
    seenColumns.add(key);
    rows.push(row);
  });
  return rows;
}

/** POST gatewayassist schemamapper db fetch-schema (after test-connection session_id). */
export async function fetchDatabaseSchema(payload: DatabaseFetchSchemaPayload): Promise<unknown> {
  const endpoint =
    "https://preview.keyforge.ai/gatewayassist/api/v1/KEYFORGE/schemamapper/db/fetch-schema";
  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers: connectionTestAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (!response.ok) {
      throw new Error(text || `fetch-schema failed: ${response.status}`);
    }
  }
  if (data != null && (await checkTokenExpiredError(data))) {
    throw new Error("Token Expired");
  }
  if (!response.ok) {
    const msg =
      data != null && typeof data === "object"
        ? String((data as Record<string, unknown>).message ?? (data as Record<string, unknown>).errorMessage ?? text)
        : text;
    throw new Error(msg || `fetch-schema failed: ${response.status}`);
  }
  if (data != null && typeof data === "object" && (data as Record<string, unknown>).success === false) {
    throw new Error(
      String((data as Record<string, unknown>).message ?? "Failed to fetch database schema.")
    );
  }
  return data;
}

export type RestUsersSchemaPayload = {
  users_url: string;
  user_url: string;
  groups_url: string;
  headers: Record<string, string>;
};

function normalizeBearerAuthorization(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^bearer\s+/i.test(t)) {
    return `bearer ${t.replace(/^bearer\s+/i, "").trim()}`;
  }
  return `bearer ${t}`;
}

/** Maps wizard step3 fields to gatewayassist schemamapper/rest/users payload. */
export function buildRestUsersSchemaPayload(step3: Record<string, unknown>): RestUsersSchemaPayload {
  const users_url = pickViewGetAllUsersFromStep3(step3);
  const user_url = pickStep3String(step3, "getUserService", "user_url", "userUrl");
  const groups_url = pickStep3String(
    step3,
    "getAllGroupsService",
    "groups_url",
    "groupsUrl",
    "getGroupService"
  );

  const headers: Record<string, string> = {};
  const jwtToken = getCookie(COOKIE_NAMES.JWT_TOKEN)?.trim();
  if (jwtToken) {
    headers.Authorization = normalizeBearerAuthorization(jwtToken);
  } else {
    const authRaw = pickStep3String(
      step3,
      "bearerToken",
      "authorization",
      "accessToken",
      "access_token",
      "Authorization"
    );
    if (authRaw) {
      headers.Authorization = normalizeBearerAuthorization(authRaw);
    }
  }

  const headerAttributes = pickStep3String(step3, "headerAttributes");
  if (headerAttributes) {
    try {
      const parsed = JSON.parse(headerAttributes) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          const val = value != null ? String(value).trim() : "";
          if (val) headers[key] = val;
        }
      }
    } catch {
      // ignore invalid headerAttributes JSON
    }
  }

  return { users_url, user_url, groups_url, headers };
}

export function isRestUsersSchemaPayloadComplete(payload: RestUsersSchemaPayload): boolean {
  return Boolean(payload.users_url.trim() && Object.keys(payload.headers).length > 0);
}

/** POST gatewayassist schemamapper/rest/users — RESTService schema mapping. */
export async function fetchRestUsersSchema(
  payload: RestUsersSchemaPayload,
  tenantId?: string
): Promise<unknown> {
  const tenant = tenantId?.trim() || resolveEntitiesTenant();
  const endpoint = `https://preview.keyforge.ai/gatewayassist/api/v1/${encodeURIComponent(tenant)}/schemamapper/rest/users`;
  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers: connectionTestAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (!response.ok) {
      throw new Error(text || `rest/users failed: ${response.status}`);
    }
  }
  if (data != null && (await checkTokenExpiredError(data))) {
    throw new Error("Token Expired");
  }
  if (!response.ok) {
    const msg =
      data != null && typeof data === "object"
        ? String((data as Record<string, unknown>).message ?? (data as Record<string, unknown>).errorMessage ?? text)
        : text;
    throw new Error(msg || `rest/users failed: ${response.status}`);
  }
  if (data != null && typeof data === "object" && (data as Record<string, unknown>).success === false) {
    throw new Error(
      String((data as Record<string, unknown>).message ?? "Failed to fetch REST user schema.")
    );
  }
  return data;
}

function restSchemaMappingEntriesFromJson(json: unknown): Record<string, unknown>[] {
  if (json == null) return [];
  if (Array.isArray(json)) {
    return json.filter((item): item is Record<string, unknown> => item != null && typeof item === "object");
  }
  if (typeof json !== "object") return [];

  const root = json as Record<string, unknown>;
  const listKeys = [
    "mappings",
    "schema_mappings",
    "schemaMappings",
    "fields",
    "columns",
    "attributes",
    "user_columns",
    "userColumns",
    "user_attributes",
    "userAttributes",
    "users_schema",
    "user_schema",
    "userSchema",
    "rest_columns",
    "restColumns",
    "data",
    "result",
    "response",
    "body",
  ];
  for (const key of listKeys) {
    const node = root[key];
    if (Array.isArray(node)) {
      return node.filter((item): item is Record<string, unknown> => item != null && typeof item === "object");
    }
    if (node != null && typeof node === "object" && !Array.isArray(node)) {
      const nested = restSchemaMappingEntriesFromJson(node);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

function findRestUserSampleRecords(json: unknown, depth = 0): Record<string, unknown>[] | null {
  if (json == null || depth > 6) return null;
  if (Array.isArray(json)) {
    if (
      json.length > 0 &&
      json.every((item) => item != null && typeof item === "object" && !Array.isArray(item))
    ) {
      return json as Record<string, unknown>[];
    }
    return null;
  }
  if (typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  for (const key of ["users", "accounts", "content", "items", "records", "data", "results", "value"]) {
    if (!(key in o)) continue;
    const found = findRestUserSampleRecords(o[key], depth + 1);
    if (found) return found;
  }
  return null;
}

/** Maps schemamapper/rest/users `detected_fields` + `mapping_suggestions` response. */
function attributeMappingsFromRestDetectedFieldsJson(json: unknown): WizardSchemaMappingRow[] {
  if (json == null || typeof json !== "object") return [];
  const root = json as Record<string, unknown>;

  const suggestionByField = new Map<string, Record<string, unknown>>();
  const suggestionsRaw = root.mapping_suggestions ?? root.mappingSuggestions;
  if (Array.isArray(suggestionsRaw)) {
    for (const item of suggestionsRaw) {
      if (item == null || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const field = String(o.source_field ?? o.sourceField ?? "").trim();
      if (field) suggestionByField.set(field.toLowerCase(), o);
    }
  }

  const buildRow = (
    columnName: string,
    suggestion: Record<string, unknown> | undefined,
    idx: number
  ): WizardSchemaMappingRow => {
    const suggestedScim = suggestion
      ? String(suggestion.suggested_scim ?? suggestion.suggestedScim ?? "").trim()
      : "";
    const autoAccept = suggestion ? Boolean(suggestion.auto_accept ?? suggestion.autoAccept) : false;
    return {
      id: `rest-detected-${idx}`,
      target: columnName,
      source: autoAccept ? suggestedScim : "",
      bestMatch: suggestedScim,
      option2: "",
      defaultValue: "",
      type: "direct",
      keyfieldMapping: false,
    };
  };

  const detectedRaw = root.detected_fields ?? root.detectedFields;
  const rows: WizardSchemaMappingRow[] = [];
  if (Array.isArray(detectedRaw)) {
    let idx = 0;
    for (const field of detectedRaw) {
      if (field == null || typeof field !== "object") continue;
      const o = field as Record<string, unknown>;
      const columnName = String(o.column_name ?? o.columnName ?? "").trim();
      if (!columnName) continue;
      rows.push(buildRow(columnName, suggestionByField.get(columnName.toLowerCase()), idx));
      idx += 1;
    }
  }

  if (rows.length > 0) return rows;

  if (suggestionByField.size > 0) {
    let idx = 0;
    for (const [fieldKey, suggestion] of suggestionByField.entries()) {
      const columnName = String(suggestion.source_field ?? suggestion.sourceField ?? fieldKey).trim();
      if (!columnName) continue;
      rows.push(buildRow(columnName, suggestion, idx));
      idx += 1;
    }
  }

  return rows;
}

/** Maps schemamapper/rest/users response to wizard schema mapping rows. */
export function attributeMappingsFromRestUsersSchemaJson(json: unknown): WizardSchemaMappingRow[] {
  let rows = attributeMappingsFromRestDetectedFieldsJson(json);
  if (rows.length > 0) return rows;

  rows = attributeMappingsFromFetchSchemaJson(json);
  if (rows.length > 0) return rows;

  const entries = restSchemaMappingEntriesFromJson(json);
  const seen = new Set<string>();
  let idx = 0;
  for (const entry of entries) {
    const row = parseDatabaseSchemaMappingEntry(entry, idx);
    if (!row) continue;
    const key = row.target.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
    idx += 1;
  }
  if (rows.length > 0) return rows;

  rows = attributeMappingsFromSuggestMappingJson(json);
  if (rows.length > 0) return rows;

  rows = attributeMappingsFromGetMappedSchemaJson(json);
  if (rows.length > 0) return rows;

  const samples = findRestUserSampleRecords(json);
  if (samples?.length) {
    const keys = Object.keys(samples[0]).filter((k) => k.trim() && !k.startsWith("_"));
    rows = keys.map((key, i) => ({
      id: `rest-user-field-${i}`,
      target: key,
      source: "",
      defaultValue: "",
      type: "direct",
      keyfieldMapping: false,
    }));
    if (rows.length > 0) return rows;
  }

  const deepEntries = collectRestSchemaColumnEntriesDeep(json);
  for (const entry of deepEntries) {
    const row = parseDatabaseSchemaMappingEntry(entry, idx);
    if (!row) continue;
    const key = row.target.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
    idx += 1;
  }

  return rows;
}

function collectRestSchemaColumnEntriesDeep(node: unknown, depth = 0): unknown[] {
  if (node == null || depth > 8) return [];
  if (Array.isArray(node)) {
    if (node.length > 0 && node.every((item) => typeof item === "string")) {
      return node;
    }
    const objectRows = node.filter((item) => databaseColumnNameFromEntry(item));
    if (objectRows.length > 0) return objectRows;
    for (const item of node) {
      const found = collectRestSchemaColumnEntriesDeep(item, depth + 1);
      if (found.length > 0) return found;
    }
    return [];
  }
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (databaseColumnNameFromEntry(o)) return [o];
    for (const value of Object.values(o)) {
      const found = collectRestSchemaColumnEntriesDeep(value, depth + 1);
      if (found.length > 0) return found;
    }
  }
  return [];
}

export type DatabaseSuggestMappingPayload = {
  session_id: string;
  top_n: number;
};

export type DatabaseColumnSuggestion = {
  bestMatch: string;
  option2: string;
  autoAccept: boolean;
};

function displayFromSuggestOption(opt: unknown): string {
  if (opt == null || typeof opt !== "object") return "";
  return pickSchemaFieldString(
    opt as Record<string, unknown>,
    "display",
    "name",
    "attribute",
    "field",
    "variable"
  );
}

/** Ranked suggestions from a suggest-mapping `mappings[]` item (`suggested` + `other_options`). */
function suggestionDisplaysFromMappingEntry(entry: Record<string, unknown>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (label: string) => {
    const t = label.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  push(displayFromSuggestOption(entry.suggested));
  const other = entry.other_options ?? entry.otherOptions;
  if (Array.isArray(other)) {
    for (const opt of other) {
      push(displayFromSuggestOption(opt));
    }
  }
  return out;
}

function suggestMappingEntriesFromJson(json: unknown): Record<string, unknown>[] {
  if (json == null) return [];
  if (Array.isArray(json)) {
    return json.filter((item): item is Record<string, unknown> => item != null && typeof item === "object");
  }
  if (typeof json === "object") {
    const root = json as Record<string, unknown>;
    if (Array.isArray(root.mappings)) {
      return root.mappings.filter(
        (item): item is Record<string, unknown> => item != null && typeof item === "object"
      );
    }
    for (const key of [
      "schema_mappings",
      "schemaMappings",
      "fields",
      "columns",
      "attributes",
      "data",
      "result",
      "response",
      "body",
    ]) {
      const node = root[key];
      if (Array.isArray(node)) {
        return node.filter(
          (item): item is Record<string, unknown> => item != null && typeof item === "object"
        );
      }
      if (node != null && typeof node === "object") {
        const nested = suggestMappingEntriesFromJson(node);
        if (nested.length > 0) return nested;
      }
    }
  }
  return [];
}

function suggestMappingColumnName(entry: Record<string, unknown>): string {
  return pickSchemaFieldString(
    entry,
    "column_name",
    "columnName",
    "column",
    "target",
    "field",
    "attribute",
    "name",
    "key",
    "rest_field",
    "restField",
    "connector_attribute",
    "connectorAttribute",
    "json_path",
    "jsonPath"
  );
}

/** Parse KEYFORGE suggest-mapping response: bestMatch = suggested.display, option2 = other_options[0].display. */
export function databaseColumnSuggestionsFromJson(
  json: unknown
): Map<string, DatabaseColumnSuggestion> {
  const map = new Map<string, DatabaseColumnSuggestion>();
  for (const entry of suggestMappingEntriesFromJson(json)) {
    const columnName = suggestMappingColumnName(entry);
    if (!columnName) continue;
    const displays = suggestionDisplaysFromMappingEntry(entry);
    const autoAccept = Boolean(entry.auto_accept ?? entry.autoAccept);
    map.set(columnName.toLowerCase(), {
      bestMatch: displays[0] ?? "",
      option2: displays[1] ?? "",
      autoAccept,
    });
  }
  return map;
}

function suggestionStringsFromValue(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") {
    const t = value.trim();
    return t ? [t] : [];
  }
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const item of value) {
      if (typeof item === "string") {
        const t = item.trim();
        if (t) out.push(t);
      } else if (item != null && typeof item === "object") {
        const io = item as Record<string, unknown>;
        const t = pickSchemaFieldString(
          io,
          "display",
          "attribute",
          "name",
          "field",
          "variable",
          "target",
          "value",
          "source_attribute",
          "sourceAttribute",
          "match"
        );
        if (t) out.push(t);
        else if (typeof io.score === "number" && io.attribute == null) {
          const nested = suggestionStringsFromValue(io.match ?? io.suggestion);
          out.push(...nested);
        }
      }
    }
    return out;
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const nested = o.suggestions ?? o.matches ?? o.options ?? o.top_matches ?? o.attributes;
    if (nested != null) return suggestionStringsFromValue(nested);
  }
  return [];
}

/** Build map of database column name → ranked source attribute suggestions. */
export function columnSuggestionsFromSuggestMappingJson(json: unknown): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (json == null) return map;

  const addEntry = (columnKey: string, suggestions: unknown) => {
    const col = columnKey.trim();
    if (!col) return;
    const list = suggestionStringsFromValue(suggestions);
    if (list.length === 0) return;
    const key = col.toLowerCase();
    const existing = map.get(key);
    if (!existing || list.length > existing.length) {
      map.set(key, list);
    }
  };

  if (Array.isArray(json)) {
    for (const item of json) {
      if (item == null || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const col = pickSchemaFieldString(
        o,
        "column_name",
        "columnName",
        "column",
        "source_column",
        "sourceColumn",
        "db_column",
        "dbColumn",
        "name",
        "field",
        "target"
      );
      if (col) {
        if (o.suggested != null || o.other_options != null || o.otherOptions != null) {
          const list = suggestionDisplaysFromMappingEntry(o);
          if (list.length > 0) {
            const key = col.toLowerCase();
            map.set(key, list);
          }
        } else {
          const sugs =
            o.suggestions ??
            o.matches ??
            o.options ??
            o.top_matches ??
            o.attributes ??
            o.mapping_suggestions;
          addEntry(col, sugs ?? o);
        }
      }
    }
    return map;
  }

  if (typeof json !== "object") return map;
  const root = json as Record<string, unknown>;

  const listKeys = [
    "mappings",
    "suggestions",
    "column_mappings",
    "columnMappings",
    "schema_mappings",
    "results",
    "data",
    "result",
  ];
  for (const key of listKeys) {
    if (key in root && Array.isArray(root[key])) {
      return columnSuggestionsFromSuggestMappingJson(root[key]);
    }
  }

  const mapKeys = ["suggestions", "column_suggestions", "columnSuggestions", "mapping"];
  for (const key of mapKeys) {
    const node = root[key];
    if (node != null && typeof node === "object" && !Array.isArray(node)) {
      for (const [col, sugs] of Object.entries(node as Record<string, unknown>)) {
        addEntry(col, sugs);
      }
      if (map.size > 0) return map;
    }
  }

  for (const [col, sugs] of Object.entries(root)) {
    if (
      col === "status" ||
      col === "message" ||
      col === "success" ||
      col === "session_id" ||
      col === "sessionId"
    ) {
      continue;
    }
    if (Array.isArray(sugs) || (sugs != null && typeof sugs === "object")) {
      addEntry(col, sugs);
    }
  }

  return map;
}

/** Apply suggest-mapping API results to wizard rows (bestMatch = suggested.display, option2 = other_options[0].display). */
export function applyDatabaseSuggestMappingToRows(
  rows: WizardSchemaMappingRow[],
  suggestJson: unknown
): WizardSchemaMappingRow[] {
  const byColumn = databaseColumnSuggestionsFromJson(suggestJson);
  if (byColumn.size === 0) {
    const legacy = columnSuggestionsFromSuggestMappingJson(suggestJson);
    if (legacy.size === 0) return rows;
    return rows.map((row) => {
      const suggestions = legacy.get(row.target.toLowerCase()) ?? [];
      const bestMatch = suggestions[0] ?? row.bestMatch ?? "";
      const option2 = suggestions[1] ?? row.option2 ?? "";
      const source = row.source?.trim() || bestMatch;
      return { ...row, bestMatch, option2, source };
    });
  }

  return rows.map((row) => {
    const hint = byColumn.get(row.target.toLowerCase());
    if (!hint) return row;
    const bestMatch = hint.bestMatch || row.bestMatch || "";
    const option2 = hint.option2 || row.option2 || "";
    const existingSource = row.source?.trim() ?? "";
    const source = existingSource || (hint.autoAccept ? bestMatch : "");
    return { ...row, bestMatch, option2, source };
  });
}

/** Build mapping rows from suggest-mapping `mappings` when fetch-schema rows are not yet available. */
export function attributeMappingsFromSuggestMappingJson(
  json: unknown
): WizardSchemaMappingRow[] {
  const byColumn = databaseColumnSuggestionsFromJson(json);
  const rows: WizardSchemaMappingRow[] = [];
  let idx = 0;
  for (const entry of suggestMappingEntriesFromJson(json)) {
    const columnName = suggestMappingColumnName(entry);
    if (!columnName) continue;
    const hint = byColumn.get(columnName.toLowerCase());
    if (!hint) continue;
    rows.push({
      id: `db-suggest-${idx++}`,
      target: columnName,
      source: hint.autoAccept ? hint.bestMatch : "",
      bestMatch: hint.bestMatch,
      option2: hint.option2,
      defaultValue: "",
      type: "direct",
      keyfieldMapping: false,
    });
  }
  return rows;
}

/** POST gatewayassist schemamapper db suggest-mapping (after fetch-schema). */
export async function fetchDatabaseSuggestMapping(
  payload: DatabaseSuggestMappingPayload
): Promise<unknown> {
  const endpoint =
    "https://preview.keyforge.ai/gatewayassist/api/v1/KEYFORGE/schemamapper/db/suggest-mapping";
  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers: connectionTestAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (!response.ok) {
      throw new Error(text || `suggest-mapping failed: ${response.status}`);
    }
  }
  if (data != null && (await checkTokenExpiredError(data))) {
    throw new Error("Token Expired");
  }
  if (!response.ok) {
    const msg =
      data != null && typeof data === "object"
        ? String(
            (data as Record<string, unknown>).message ??
              (data as Record<string, unknown>).errorMessage ??
              text
          )
        : text;
    throw new Error(msg || `suggest-mapping failed: ${response.status}`);
  }
  if (data != null && typeof data === "object" && (data as Record<string, unknown>).success === false) {
    throw new Error(
      String((data as Record<string, unknown>).message ?? "Failed to fetch mapping suggestions.")
    );
  }
  return data;
}

export type DatabaseConfirmMappingDecisionAction = "accept" | "pick" | "manual" | "skip";

export type DatabaseConfirmMappingDecision = {
  column_name: string;
  action: DatabaseConfirmMappingDecisionAction;
  picked?: string;
  manual_entry?: string;
};

export type DatabaseConfirmMappingPayload = {
  session_id: string;
  decisions: DatabaseConfirmMappingDecision[];
};

export type DatabaseConfirmMappingRowInput = {
  target: string;
  source?: string;
  bestMatch?: string;
  option2?: string;
  sourceSelection?: "bestMatch" | "option2" | "custom";
};

/** Build confirm-mapping `decisions` from schema mapping UI rows. */
export function buildDatabaseConfirmMappingDecisions(
  rows: DatabaseConfirmMappingRowInput[]
): DatabaseConfirmMappingDecision[] {
  return rows
    .filter((row) => row.target?.trim())
    .map((row) => {
      const column_name = row.target.trim();
      const source = (row.source ?? "").trim();
      const selection = row.sourceSelection;

      if (selection === "bestMatch") {
        return { column_name, action: "accept" as const };
      }
      if (selection === "option2") {
        const picked = (row.option2 ?? "").trim() || source;
        return { column_name, action: "pick" as const, picked };
      }
      if (selection === "custom") {
        return {
          column_name,
          action: "manual" as const,
          manual_entry: source,
        };
      }

      if (!source) {
        return { column_name, action: "skip" as const };
      }

      const srcNorm = source.toLowerCase();
      const bestNorm = (row.bestMatch ?? "").trim().toLowerCase();
      const opt2Norm = (row.option2 ?? "").trim().toLowerCase();

      if (bestNorm && srcNorm === bestNorm) {
        return { column_name, action: "accept" as const };
      }
      if (opt2Norm && srcNorm === opt2Norm) {
        return { column_name, action: "pick" as const, picked: source };
      }
      return { column_name, action: "manual" as const, manual_entry: source };
    });
}

/** POST gatewayassist schemamapper db confirm-mapping (finalize mapping decisions for session). */
export async function confirmDatabaseMapping(
  payload: DatabaseConfirmMappingPayload
): Promise<unknown> {
  const endpoint =
    "https://preview.keyforge.ai/gatewayassist/api/v1/KEYFORGE/schemamapper/db/confirm-mapping";
  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers: connectionTestAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (!response.ok) {
      throw new Error(text || `confirm-mapping failed: ${response.status}`);
    }
  }
  if (data != null && (await checkTokenExpiredError(data))) {
    throw new Error("Token Expired");
  }
  if (!response.ok) {
    const msg =
      data != null && typeof data === "object"
        ? String(
            (data as Record<string, unknown>).message ??
              (data as Record<string, unknown>).errorMessage ??
              text
          )
        : text;
    throw new Error(msg || `confirm-mapping failed: ${response.status}`);
  }
  if (data != null && typeof data === "object" && (data as Record<string, unknown>).success === false) {
    throw new Error(
      String((data as Record<string, unknown>).message ?? "Failed to confirm database mapping.")
    );
  }
  return data;
}

export type DatabaseTestConnectionPayload = {
  db_type: string;
  host: string;
  port: number;
  db_name: string;
  username: string;
  password: string;
};

function pickStep3String(step3: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = step3[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

/** Normalizes UI database type labels to gatewayassist db_type values. */
export function normalizeDatabaseTestDbType(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  if (t.includes("postgres")) return "postgres";
  if (t.includes("mysql") || t.includes("maria")) return "mysql";
  if (t.includes("oracle")) return "oracle";
  if (t.includes("sqlserver") || t.includes("mssql")) return "sqlserver";
  return t.replace(/\s+/g, "");
}

/** Parses host/port/database from JDBC URL or host:port/db strings. */
export function parseDatabaseConnectionTarget(
  connectionURL: string,
  dbTypeHint?: string
): { host: string; port?: number; db_name: string } {
  const url = connectionURL.trim();
  if (!url) return { host: "", db_name: "" };

  const jdbc = url.match(/^jdbc:([^:]+):\/\/([^/:]+)(?::(\d+))?(?:\/([^?;]+))?/i);
  if (jdbc) {
    return {
      host: jdbc[2],
      port: jdbc[3] ? Number(jdbc[3]) : defaultDatabasePort(dbTypeHint ?? jdbc[1]),
      db_name: (jdbc[4] || "").trim(),
    };
  }

  const hostPortDb = url.match(/^([^:/]+):(\d+)(?:\/(.+))?$/);
  if (hostPortDb) {
    return {
      host: hostPortDb[1],
      port: Number(hostPortDb[2]),
      db_name: (hostPortDb[3] || "").trim(),
    };
  }

  if (!url.includes("://") && !url.includes(":")) {
    return { host: url, db_name: "" };
  }

  try {
    const withScheme = /^https?:\/\//i.test(url) ? url : `http://${url}`;
    const u = new URL(withScheme);
    return {
      host: u.hostname,
      port: u.port ? Number(u.port) : undefined,
      db_name: u.pathname.replace(/^\//, "").trim(),
    };
  } catch {
    return { host: "", db_name: "" };
  }
}

function defaultDatabasePort(dbType?: string): number | undefined {
  const t = (dbType ?? "").toLowerCase();
  if (t.includes("postgres")) return 5432;
  if (t.includes("mysql") || t.includes("maria")) return 3306;
  if (t.includes("oracle")) return 1521;
  if (t.includes("sqlserver") || t.includes("mssql")) return 1433;
  return undefined;
}

/** Maps wizard step3 connection fields to gatewayassist test-connection payload. */
export function buildDatabaseTestConnectionPayload(
  step3: Record<string, unknown>
): DatabaseTestConnectionPayload {
  const db_type = normalizeDatabaseTestDbType(
    pickStep3String(step3, "databaseType", "db_type", "dbType")
  );
  const username = pickStep3String(step3, "username");
  const password = pickStep3String(step3, "password");

  let host = pickStep3String(step3, "host", "hostname");
  let portStr = pickStep3String(step3, "port");
  let db_name = pickStep3String(
    step3,
    "db_name",
    "dbName",
    "databaseName",
    "jdbcReadDatabaseName"
  );

  const connectionURL = pickStep3String(
    step3,
    "connectionURL",
    "connectionUrl",
    "jdbc_url",
    "jdbcUrl"
  );
  if (connectionURL && (!host || !portStr || !db_name)) {
    const parsed = parseDatabaseConnectionTarget(connectionURL, db_type);
    if (!host) host = parsed.host;
    if (!portStr && parsed.port != null) portStr = String(parsed.port);
    if (!db_name) db_name = parsed.db_name;
  }

  const port = portStr ? Number(portStr) : defaultDatabasePort(db_type) ?? 0;

  return {
    db_type,
    host,
    port: Number.isFinite(port) ? port : 0,
    db_name,
    username,
    password,
  };
}

export function isDatabaseTestConnectionPayloadComplete(
  payload: DatabaseTestConnectionPayload
): boolean {
  return Boolean(
    payload.db_type &&
      payload.host &&
      payload.port > 0 &&
      payload.db_name &&
      payload.username &&
      payload.password
  );
}

/** POST gatewayassist schemamapper db test-connection. */
export async function testDatabaseConnection(
  payload: DatabaseTestConnectionPayload
): Promise<unknown> {
  const endpoint =
    "https://preview.keyforge.ai/gatewayassist/api/v1/KEYFORGE/schemamapper/db/test-connection";
  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers: connectionTestAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (!response.ok) {
      throw new Error(text || `Connection test failed: ${response.status}`);
    }
  }
  if (data != null && (await checkTokenExpiredError(data))) {
    throw new Error("Token Expired");
  }
  if (!response.ok) {
    const parsed = parseConnectionTestResult(data);
    throw new Error(parsed.message || text || `Connection test failed: ${response.status}`);
  }
  return data;
}

/** POST screenagent testconnection — ScreenScrapping connection parameters. */
export async function testScreenScrappingConnection(
  payload: Record<string, string>
): Promise<unknown> {
  const endpoint =
    "https://preview.keyforge.ai/aiagentcontroller/api/v1/ACMECOM/screenagent/testconnection";
  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers: connectionTestAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (!response.ok) {
      throw new Error(text || `Connection test failed: ${response.status}`);
    }
  }
  if (data != null && (await checkTokenExpiredError(data))) {
    throw new Error("Token Expired");
  }
  if (!response.ok) {
    const parsed = parseConnectionTestResult(data);
    throw new Error(parsed.message || text || `Connection test failed: ${response.status}`);
  }
  return data;
}

/** POST restagent testconnection — RESTService Application connection parameters. */
export async function testRestServiceConnection(
  payload: Record<string, string>
): Promise<unknown> {
  const endpoint =
    "https://preview.keyforge.ai/aiagentcontroller/api/v1/ACMECOM/restagent/testconnection";
  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers: connectionTestAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (!response.ok) {
      throw new Error(text || `Connection test failed: ${response.status}`);
    }
  }
  if (data != null && (await checkTokenExpiredError(data))) {
    throw new Error("Token Expired");
  }
  if (!response.ok) {
    const parsed = parseConnectionTestResult(data);
    throw new Error(parsed.message || text || `Connection test failed: ${response.status}`);
  }
  return data;
}

/** Maps wizard step3 fields to gatewayassist schemamapper/screen/users payload. */
export type ScreenUsersSchemaPayload = RestUsersSchemaPayload & {
  baseURL: string;
  config_json: string;
};

export function buildScreenUsersSchemaPayload(step3: Record<string, unknown>): ScreenUsersSchemaPayload {
  const baseURL = pickScreenScrappingBaseUrlFromStep3(step3);
  const config_json = pickScreenScrappingJsonFromStep3(step3);
  const restPayload = buildRestUsersSchemaPayload({
    ...step3,
    [VIEW_GET_ALL_USERS_FIELD]: baseURL,
  });
  return {
    ...restPayload,
    users_url: baseURL,
    baseURL,
    config_json,
  };
}

/** POST gatewayassist schemamapper/screen/users — ScreenScrapping schema mapping. */
export async function fetchScreenUsersSchema(
  payload: ScreenUsersSchemaPayload,
  tenantId?: string
): Promise<unknown> {
  const tenant = tenantId?.trim() || resolveEntitiesTenant();
  const endpoint = `https://preview.keyforge.ai/gatewayassist/api/v1/${encodeURIComponent(tenant)}/schemamapper/screen/users`;
  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers: connectionTestAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (!response.ok) {
      throw new Error(text || `screen/users failed: ${response.status}`);
    }
  }
  if (data != null && (await checkTokenExpiredError(data))) {
    throw new Error("Token Expired");
  }
  if (!response.ok) {
    const msg =
      data != null && typeof data === "object"
        ? String((data as Record<string, unknown>).message ?? (data as Record<string, unknown>).errorMessage ?? text)
        : text;
    throw new Error(msg || `screen/users failed: ${response.status}`);
  }
  if (data != null && typeof data === "object" && (data as Record<string, unknown>).success === false) {
    throw new Error(
      String((data as Record<string, unknown>).message ?? "Failed to fetch screen scraping user schema.")
    );
  }
  return data;
}

/** GET schemamapper getmappedschema — provisioning/reconciliation maps for an application id. */
export async function getMappedSchema(tenantId: string, applicationId: string): Promise<unknown> {
  const url = `https://preview.keyforge.ai/schemamapper/getmappedschema/${encodeURIComponent(tenantId)}/${encodeURIComponent(applicationId)}`;
  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`getmappedschema failed: ${response.status} - ${text}`);
  }
  return response.json();
}

export type MapFieldsProvisioningEntry =
  | { variable: string }
  | { inboundTransform: string }
  | { outboundTransform: string };

export type MapFieldsPayload = {
  provisioningAttrMap: Record<string, MapFieldsProvisioningEntry>;
  reconcilliationAttrMap: Record<string, unknown>;
};

/** Flat provisioning entries from getmappedschema (supports scimTargetMap or flat map). */
export function getProvisioningAttrMapEntries(
  json: unknown
): Record<string, Record<string, unknown>> {
  if (json == null || typeof json !== "object") return {};
  const root = json as Record<string, unknown>;
  const pam = root.provisioningAttrMap;
  if (!pam || typeof pam !== "object") return {};
  const container = pam as Record<string, unknown>;
  if (
    container.scimTargetMap &&
    typeof container.scimTargetMap === "object" &&
    !Array.isArray(container.scimTargetMap)
  ) {
    return container.scimTargetMap as Record<string, Record<string, unknown>>;
  }
  const entries: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(container)) {
    if (key === "scimTargetMap") continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      entries[key] = value as Record<string, unknown>;
    }
  }
  return entries;
}

export function transformationMappingsFromMappedSchema(json: unknown): {
  inbound: { id: string; igaField: string; transformationProvider: string }[];
  outbound: { id: string; targetField: string; transformationProvider: string }[];
} {
  const entries = getProvisioningAttrMapEntries(json);
  const inbound: { id: string; igaField: string; transformationProvider: string }[] = [];
  const outbound: { id: string; targetField: string; transformationProvider: string }[] = [];
  let idx = 0;
  for (const [key, value] of Object.entries(entries)) {
    if (value && typeof value === "object" && "inboundTransform" in value) {
      const igaField = String((value as { inboundTransform?: unknown }).inboundTransform ?? "").trim();
      const provider = key.trim();
      if (provider && igaField) {
        inbound.push({
          id: `inbound-loaded-${idx++}`,
          igaField,
          transformationProvider: provider,
        });
      }
    } else if (value && typeof value === "object" && "outboundTransform" in value) {
      const provider = String((value as { outboundTransform?: unknown }).outboundTransform ?? "").trim();
      const targetField = key.trim();
      if (targetField && provider) {
        outbound.push({
          id: `outbound-loaded-${idx++}`,
          targetField,
          transformationProvider: provider,
        });
      }
    }
  }
  return { inbound, outbound };
}

/** Merge schema variable mappings with inbound/outbound transformation rows for mapfields POST. */
export function buildMapFieldsPayloadWithTransformations(
  existingMappedSchema: unknown,
  inboundRows: { igaField: string; transformationProvider: string }[],
  outboundRows: { targetField: string; transformationProvider: string }[]
): MapFieldsPayload {
  const entries = getProvisioningAttrMapEntries(existingMappedSchema);
  const provisioningAttrMap: Record<string, MapFieldsProvisioningEntry> = {};

  for (const [key, value] of Object.entries(entries)) {
    if (value && typeof value === "object" && "variable" in value) {
      const variable = String((value as { variable?: unknown }).variable ?? "").trim();
      if (variable) {
        provisioningAttrMap[key] = { variable };
      }
    }
  }

  inboundRows.forEach((row) => {
    const provider = row.transformationProvider.trim();
    const igaField = row.igaField.trim();
    if (provider && igaField) {
      provisioningAttrMap[provider] = { inboundTransform: igaField };
    }
  });

  outboundRows.forEach((row) => {
    const targetField = row.targetField.trim();
    const provider = row.transformationProvider.trim();
    if (targetField && provider) {
      provisioningAttrMap[targetField] = { outboundTransform: provider };
    }
  });

  const root = existingMappedSchema as Record<string, unknown> | null;
  const reconciliation =
    root?.reconcilliationAttrMap ?? root?.reconciliationAttrMap;
  const reconcilliationAttrMap =
    reconciliation && typeof reconciliation === "object" && !Array.isArray(reconciliation)
      ? (reconciliation as Record<string, unknown>)
      : {};

  return { provisioningAttrMap, reconcilliationAttrMap };
}

/** POST schemamapper mapfields — same API as Schema Mapping save. */
export async function mapSchemaFields(
  tenantId: string,
  applicationId: string,
  payload: MapFieldsPayload
): Promise<void> {
  const url = `https://preview.keyforge.ai/schemamapper/mapfields/${encodeURIComponent(tenantId)}/${encodeURIComponent(applicationId)}`;
  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `mapfields failed: ${response.status}`);
  }
}

/** Parses newApp JSON for an application id used in getmappedschema URL. */
export function extractApplicationIdFromRegisterNewAppResponse(data: unknown): string | null {
  if (data == null) return null;
  if (typeof data === "string") {
    const t = data.trim();
    return t || null;
  }
  if (typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const tryVal = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return s || null;
  };

  // newApp returns SCIMURL like https://.../scim/v2/ACMECOM/33A8AHT1 — id is last segment after tenant
  const scimUrlRaw = o.SCIMURL ?? o.scimURL ?? o.ScimUrl ?? o.scimurl;
  if (typeof scimUrlRaw === "string" && scimUrlRaw.trim()) {
    const scimUrl = scimUrlRaw.trim();
    try {
      const url = new URL(scimUrl);
      const parts = url.pathname.split("/").filter(Boolean);
      const tenant = String(o.TenantID ?? o.tenantID ?? "ACMECOM").trim();
      const tenantIdx = parts.findIndex((p) => p.toLowerCase() === tenant.toLowerCase());
      if (tenantIdx >= 0 && parts[tenantIdx + 1]) {
        const id = parts[tenantIdx + 1].trim();
        if (id) return id;
      }
      const m = scimUrl.match(/\/scim\/v2\/[^/]+\/([^/?#]+)/i);
      if (m?.[1]) return m[1].trim();
    } catch {
      const m = scimUrl.match(/\/scim\/v2\/[^/]+\/([^/?#]+)/i) ?? scimUrl.match(/\/ACMECOM\/([^/?#]+)/i);
      if (m?.[1]) return m[1].trim();
    }
  }

  const keys = [
    "ApplicationID",
    "applicationID",
    "ApplicationId",
    "applicationId",
    "AppId",
    "appId",
    "application_id",
    "key",
    "Key",
    "id",
    "ID",
  ];
  for (const k of keys) {
    const id = tryVal(o[k]);
    if (id) return id;
  }
  const nested = o.Application ?? o.application ?? o.data ?? o.result;
  if (nested && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    for (const k of keys) {
      const id = tryVal(n[k]);
      if (id) return id;
    }
  }
  return null;
}

/** Stores APIToken from newApp for app-inventory flows (mapfields, getApplicationDetails, etc.). */
export function persistAppInventoryTokenFromRegisterNewAppResponse(
  data: unknown,
  applicationId: string | null
): void {
  if (typeof window === "undefined" || !applicationId?.trim()) return;
  if (data == null || typeof data !== "object") return;
  const o = data as Record<string, unknown>;
  const token = o.APIToken ?? o.apiToken ?? o.ApiToken;
  if (typeof token === "string" && token.trim()) {
    sessionStorage.setItem(`app-inventory-token-${applicationId.trim()}`, token.trim());
  }
}

export type WizardSchemaMappingRow = {
  id: string;
  source: string;
  target: string;
  defaultValue: string;
  type: string;
  keyfieldMapping: boolean;
  /** Database fetch-schema: suggested source attribute (column 2). */
  bestMatch?: string;
  /** Database fetch-schema: alternate suggestion (column 3). */
  option2?: string;
};

/** Source IGA/SCIM attribute names already mapped in schema (lowercase keys for comparison). */
export function integratedIgaSourceKeysFromMappedSchema(json: unknown): Set<string> {
  const keys = new Set<string>();
  if (json == null || typeof json !== "object") return keys;
  const provisioning = getProvisioningAttrMapEntries(json);
  for (const value of Object.values(provisioning)) {
    if (value && typeof value === "object" && "variable" in value) {
      const source = String((value as { variable?: unknown }).variable ?? "").trim();
      if (source) keys.add(source.toLowerCase());
    }
  }
  const root = json as Record<string, unknown>;
  const reconciliation =
    (root.reconcilliationAttrMap as { scimTargetMap?: Record<string, unknown> } | undefined)?.scimTargetMap ??
    (root.reconciliationAttrMap as { scimTargetMap?: Record<string, unknown> } | undefined)?.scimTargetMap ??
    {};
  for (const [source] of Object.entries(reconciliation)) {
    const s = String(source).trim();
    if (s) keys.add(s.toLowerCase());
  }
  return keys;
}

/** Maps getmappedschema JSON into wizard attribute rows (matches SchemaMappingTab semantics). */
export function attributeMappingsFromGetMappedSchemaJson(json: unknown): WizardSchemaMappingRow[] {
  const rows: WizardSchemaMappingRow[] = [];
  const seen = new Set<string>();
  const pairKey = (s: string, t: string) => `${s}\0${t}`;
  let idx = 0;
  const root = json as Record<string, any>;
  const provisioning = root?.provisioningAttrMap?.scimTargetMap ?? {};
  Object.entries(provisioning).forEach(([target, value]) => {
    const source = String((value as { variable?: unknown })?.variable ?? value ?? "").trim();
    const t = String(target).trim();
    if (!source && !t) return;
    const pk = pairKey(source, t);
    if (seen.has(pk)) return;
    seen.add(pk);
    rows.push({
      id: `mapped-p-${idx++}`,
      source,
      target: t,
      defaultValue: "",
      type: "direct",
      keyfieldMapping: false,
    });
  });
  const reconciliation =
    root?.reconcilliationAttrMap?.scimTargetMap ?? root?.reconciliationAttrMap?.scimTargetMap ?? {};
  Object.entries(reconciliation).forEach(([source, value]) => {
    const target = String((value as { variable?: unknown })?.variable ?? value ?? "").trim();
    const s = String(source).trim();
    if (!s && !target) return;
    const pk = pairKey(s, target);
    if (seen.has(pk)) return;
    seen.add(pk);
    rows.push({
      id: `mapped-r-${idx++}`,
      source: s,
      target,
      defaultValue: "",
      type: "direct",
      keyfieldMapping: false,
    });
  });
  return rows;
}

/** One row inferred from POST .../submitrequest schema metadata for the wizard table. */
export interface ItAssetSubmitRequestSchemaRow {
  /** Connector / LDAP / app attribute side (maps as Target in the UI). */
  target: string;
  /** IAM / SCIM attribute path (maps as Source in the UI). */
  source: string;
  /** Wizard mapping kind: direct | expression | constant, etc. */
  type: string;
}

function asSubmitRecord(data: unknown): Record<string, unknown> | null {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
}

function normalizeWizardMappingType(apiType: string): string {
  const t = String(apiType ?? "")
    .trim()
    .toLowerCase();
  if (t === "expression" || t === "constant" || t === "direct") return t;
  return t || "direct";
}

function coerceNameTypeMappingRow(raw: unknown): ItAssetSubmitRequestSchemaRow | null {
  const o = asSubmitRecord(raw);
  if (!o) return null;
  const name =
    o.name ??
    o.Name ??
    o.attributeName ??
    o.AttributeName ??
    o.targetAttribute ??
    o.TargetAttribute ??
    o.target ??
    o.Target;
  const nameStr = name != null ? String(name).trim() : "";
  if (!nameStr) return null;
  const typeRaw = o.type ?? o.Type ?? o.mappingType ?? o.MappingType ?? "direct";
  const sourceRaw =
    o.source ??
    o.Source ??
    o.variable ??
    o.Variable ??
    o.from ??
    o.connectorAttribute ??
    o.ConnectorAttribute;
  const sourceStr = sourceRaw != null ? String(sourceRaw).trim() : "";
  return {
    target: nameStr,
    source: sourceStr,
    type: normalizeWizardMappingType(String(typeRaw)),
  };
}

/** provisioningAttrMap: { connectorAttr: { variable: "iamPath" } } → UI target=key, source=variable */
function coerceProvisioningAttrMapRows(mapVal: unknown): ItAssetSubmitRequestSchemaRow[] {
  const obj = mapVal && typeof mapVal === "object" ? (mapVal as Record<string, unknown>) : null;
  if (!obj) return [];
  const out: ItAssetSubmitRequestSchemaRow[] = [];
  for (const [targetKey, val] of Object.entries(obj)) {
    const tk = targetKey.trim();
    if (!tk) continue;
    let source = "";
    if (typeof val === "string") source = val.trim();
    else if (val && typeof val === "object") {
      const v = val as Record<string, unknown>;
      const variable = v.variable ?? v.Variable;
      source = variable != null ? String(variable).trim() : "";
    }
    out.push({ target: tk, source, type: "direct" });
  }
  return out;
}

/** reconcilliationAttrMap is inverse keyed; normalize to same target/source shape as provisioning. */
function coerceReconciliationAttrMapRows(mapVal: unknown): ItAssetSubmitRequestSchemaRow[] {
  const obj = mapVal && typeof mapVal === "object" ? (mapVal as Record<string, unknown>) : null;
  if (!obj) return [];
  const out: ItAssetSubmitRequestSchemaRow[] = [];
  for (const [iamKey, val] of Object.entries(obj)) {
    const source = iamKey.trim();
    if (!source) continue;
    let target = "";
    if (typeof val === "string") target = val.trim();
    else if (val && typeof val === "object") {
      const v = val as Record<string, unknown>;
      const variable = v.variable ?? v.Variable;
      target = variable != null ? String(variable).trim() : "";
    }
    if (!target) continue;
    out.push({ target, source, type: "direct" });
  }
  return out;
}

function reconciliationAttrMapKeys(obj: Record<string, unknown> | null): unknown {
  if (!obj) return undefined;
  return (
    obj.reconcilliationAttrMap ??
    obj.ReconcilliationAttrMap ??
    obj.reconciliationAttrMap ??
    obj.ReconciliationAttrMap ??
    obj.reconcilliation_attr_map ??
    obj.reconciliation_attr_map
  );
}

function firstNonEmptySubmitArray(...candidates: unknown[]): unknown[] {
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return [];
}

function looksLikeItAssetAppRecord(r: Record<string, unknown>): boolean {
  return (
    "tenantId" in r ||
    "schemaMappingDetails" in r ||
    "SchemaMappingDetails" in r ||
    "provisioningAttrMap" in r ||
    "ProvisioningAttrMap" in r ||
    "reconcilliationAttrMap" in r ||
    "reconciliationAttrMap" in r ||
    ("name" in r && "category" in r) ||
    "connectionDetails" in r ||
    "appid" in r
  );
}

function expandItAssetSubmitResponseToCandidateRecords(data: unknown): Record<string, unknown>[] {
  if (data === null || data === undefined) return [];

  const objectRecordsOnly = (arr: unknown): Record<string, unknown>[] => {
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is Record<string, unknown> => asSubmitRecord(x) !== null);
  };

  const direct = objectRecordsOnly(data);
  if (direct.length && direct.some(looksLikeItAssetAppRecord)) {
    return direct;
  }

  const rootObj = asSubmitRecord(data);
  if (rootObj) {
    const wrapperKeys = [
      "applications",
      "apps",
      "applicationList",
      "ApplicationList",
      "applicationRecords",
      "items",
      "data",
      "results",
      "payload",
      "value",
      "rows",
      "list",
      "records",
      "Records",
      "application",
    ] as const;
    for (const k of wrapperKeys) {
      const inner = objectRecordsOnly(rootObj[k]);
      if (inner.length) return inner;
    }
    for (const v of Object.values(rootObj)) {
      const inner = objectRecordsOnly(v);
      if (inner.length && inner.some(looksLikeItAssetAppRecord)) return inner;
    }
    return looksLikeItAssetAppRecord(rootObj) || Object.keys(rootObj).length > 0 ? [rootObj] : [];
  }

  return [];
}

function pickSubmitResponseAppRecord(
  records: Record<string, unknown>[],
  applicationName?: string,
  category?: string,
  ownerEmail?: string
): Record<string, unknown> | null {
  if (!records.length) return null;
  if (records.length === 1) return records[0]!;
  const wantName = applicationName?.trim();
  const wantCat = category?.trim();
  const ownerNorm = ownerEmail?.trim().toLowerCase();

  if (wantName) {
    const n = wantName.toLowerCase();
    const exact = records.find((r) => String(r.name ?? "").trim().toLowerCase() === n);
    if (exact) return exact;

    /* Backend sometimes returns stray leading/trailing whitespace in name */
    const loose = records.find((r) => String(r.name ?? "").trim() === applicationName!.trim());
    if (loose) return loose;
  }

  if (wantCat && ownerNorm) {
    const fuzzy = [...records].reverse().find((r) => {
      const st = String(r.status ?? "").toLowerCase();
      if (st !== "new" && st !== "inprogress" && st !== "in progress") return false;
      const cat =
        String(r.category ?? r.applicationType ?? r.ApplicationType ?? r.type ?? "")
          .trim()
          .toLowerCase();
      const own = r.owner && typeof r.owner === "object" ? (r.owner as Record<string, unknown>) : null;
      const ov = String(own?.value ?? own?.email ?? "").trim().toLowerCase();
      return cat === wantCat.toLowerCase() && ov === ownerNorm;
    });
    if (fuzzy) return fuzzy;
  }

  return records[records.length - 1]!;
}

/** Parses a single IT Asset app row / submit payload envelope for provisioning + optional reconciliation maps. */
export function extractSchemaMappingFromItAssetAppRecord(root: unknown): ItAssetSubmitRequestSchemaRow[] {
  const raw = asSubmitRecord(root);
  if (!raw) return [];

  const fromRootMap = coerceProvisioningAttrMapRows(
    raw.provisioningAttrMap ?? raw.ProvisioningAttrMap ?? raw.provisioning_attr_map
  );

  const nestedSchema =
    raw.schemaMapping ??
    raw.SchemaMapping ??
    raw.schema_mapping ??
    raw.schemaMappingDetails ??
    raw.SchemaMappingDetails;

  let list: unknown[] = [];
  const schemaRec = asSubmitRecord(nestedSchema);

  if (schemaRec) {
    list = firstNonEmptySubmitArray(
      Array.isArray(nestedSchema) ? nestedSchema : undefined,
      schemaRec.attributes,
      schemaRec.Attributes,
      schemaRec.schemaMappingAttributes,
      schemaRec.schemaMappings,
      schemaRec.schema_mappings,
      schemaRec.items,
      schemaRec.list,
      schemaRec.mappings
    );
    if (!list.length) {
      const inner = asSubmitRecord(schemaRec.schema);
      list = firstNonEmptySubmitArray(inner?.attributes, inner?.Mappings);
    }
  } else if (Array.isArray(nestedSchema)) {
    list = nestedSchema;
  }

  let listWide = list.length
    ? list
    : firstNonEmptySubmitArray(
        raw.schemaMappingAttributes,
        raw.schemaAttributes,
        raw.attributes,
        raw.Attributes,
        raw.mappings,
        raw.mapping,
        raw.Mapping
      );

  const resultRec = asSubmitRecord(raw.result);
  if (!listWide.length && resultRec) {
    listWide = firstNonEmptySubmitArray(
      resultRec.schemaMapping,
      resultRec.SchemaMapping,
      resultRec.attributes,
      resultRec.mapping
    );
    const resultSchemaRec = asSubmitRecord(resultRec.schemaMappingDetails ?? resultRec.SchemaMappingDetails);
    if (!listWide.length && resultSchemaRec) {
      listWide = firstNonEmptySubmitArray(resultSchemaRec.attributes, resultSchemaRec.schemaMappings);
    }
  }

  const fromNestedProv =
    schemaRec != null
      ? coerceProvisioningAttrMapRows(
          schemaRec.provisioningAttrMap ?? schemaRec.ProvisioningAttrMap ?? schemaRec.provisioning_attr_map
        )
      : [];

  const fromRootRecon = coerceReconciliationAttrMapRows(reconciliationAttrMapKeys(raw));
  const fromNestedRecon = coerceReconciliationAttrMapRows(schemaRec !== null ? reconciliationAttrMapKeys(schemaRec) : null);

  const provisioningRows =
    fromNestedProv.length > 0 ? fromNestedProv : fromRootMap.length > 0 ? fromRootMap : [];
  const reconciliationRowsOnly =
    fromNestedRecon.length > 0 ? fromNestedRecon : fromRootRecon.length > 0 ? fromRootRecon : [];

  const nameTypeRows = listWide
    .map(coerceNameTypeMappingRow)
    .filter((x): x is ItAssetSubmitRequestSchemaRow => x !== null && Boolean(x.target));

  const rows =
    provisioningRows.length > 0
      ? provisioningRows
      : nameTypeRows.length > 0
        ? nameTypeRows
        : reconciliationRowsOnly;

  const seen = new Set<string>();
  const deduped: ItAssetSubmitRequestSchemaRow[] = [];
  for (const row of rows) {
    if (!row.target.trim() || seen.has(row.target)) continue;
    seen.add(row.target);
    deduped.push(row);
  }
  return deduped;
}

export interface ParseItAssetSchemaMappingOptions {
  /** Match the catalog row whose `name` equals the app just submitted (recommended). */
  applicationName?: string;
  /** Helps disambiguate when name is duplicated or omitted. */
  category?: string;
  ownerEmail?: string;
}

/**
 * Parses `submitrequest` JSON: often a tenant-wide application array plus the newly created row.
 * Prefer **`applicationName`** so schema rows come from the correct app ("abcd"), not the last list item ("Mosaic").
 */
export function parseSchemaMappingFromItAssetSubmitRequestResponse(
  data: unknown,
  options?: ParseItAssetSchemaMappingOptions
): ItAssetSubmitRequestSchemaRow[] {
  let expanded = expandItAssetSubmitResponseToCandidateRecords(data);
  if (expanded.length === 0 && Array.isArray(data)) {
    expanded = data.filter((x): x is Record<string, unknown> => asSubmitRecord(x) !== null);
  }
  const root =
    expanded.length === 0
      ? (asSubmitRecord(data) ?? null)
      : expanded.length === 1
        ? expanded[0]!
        : pickSubmitResponseAppRecord(expanded, options?.applicationName, options?.category, options?.ownerEmail);
  return extractSchemaMappingFromItAssetAppRecord(root ?? data);
}

/** Fetches applications that are In Progress from the IT Asset API. Returns null on failure so the main app list still loads. */
export async function getInProgressApplications(loginremote_user: string = "ACMEADMIN"): Promise<any> {
  const endpoint = "https://preview.keyforge.ai/itasset/ACMECOM/getallapp";

  try {
    const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
    if (!accessToken) {
      return null;
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("X-Requested-With", "XMLHttpRequest");
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("loginremote_user", loginremote_user);

    const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
    const response = await fetchFn(endpoint, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        if (await checkTokenExpiredError(errorData)) {
          throw new Error("Token Expired");
        }
      } catch (e) {
        if (e instanceof Error && e.message === "Token Expired") throw e;
      }
      // 500 / 4xx from itasset API: log warning and return null so app inventory still loads
      console.warn("In-progress applications API unavailable:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    if (await checkTokenExpiredError(data)) {
      throw new Error("Token Expired");
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.message === "Token Expired") {
      throw error;
    }
    console.warn("In-progress applications API failed:", error);
    return null;
  }
}

/** Fetches flatfile app metadata users - getappmetadata/ACME_FlatfileLoad/users. Used on Flatfile File Upload step. */
export async function getFlatfileAppMetadataUsers(loginremote_user: string = "ACMEADMIN"): Promise<any> {
  const endpoint = "https://preview.keyforge.ai/itasset/ACMECOM/getappmetadata/ACME_FlatfileLoad/users";

  try {
    const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
    if (!accessToken) {
      return null;
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("X-Requested-With", "XMLHttpRequest");
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("loginremote_user", loginremote_user);

    const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
    const response = await fetchFn(endpoint, { method: "GET", headers });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        if (await checkTokenExpiredError(errorData)) {
          throw new Error("Token Expired");
        }
      } catch (e) {
        if (e instanceof Error && e.message === "Token Expired") throw e;
      }
      console.warn("getappmetadata/users API unavailable:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    if (await checkTokenExpiredError(data)) {
      throw new Error("Token Expired");
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.message === "Token Expired") {
      throw error;
    }
    console.warn("getFlatfileAppMetadataUsers failed:", error);
    return null;
  }
}

/** Fetches app metadata users for a given disconnected application name. */
export async function getAppMetadataUsers(
  applicationName: string,
  loginremote_user: string = "ACMEADMIN"
): Promise<any> {
  const encodedApp = encodeURIComponent(applicationName);
  const endpoint = `https://preview.keyforge.ai/itasset/ACMECOM/getappmetadata/${encodedApp}/users`;

  try {
    const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
    if (!accessToken) {
      return null;
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("X-Requested-With", "XMLHttpRequest");
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("loginremote_user", loginremote_user);

    const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
    const response = await fetchFn(endpoint, { method: "GET", headers });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        if (await checkTokenExpiredError(errorData)) {
          throw new Error("Token Expired");
        }
      } catch (e) {
        if (e instanceof Error && e.message === "Token Expired") throw e;
      }
      console.warn("getappmetadata/<app>/users API unavailable:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    if (await checkTokenExpiredError(data)) {
      throw new Error("Token Expired");
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.message === "Token Expired") {
      throw error;
    }
    console.warn("getAppMetadataUsers failed:", error);
    return null;
  }
}

/** Uploads a CSV file and returns schema for users - uploadandgetschema/users. */
export async function uploadAndGetSchemaUsers(
  csvfile: File,
  basicDefinition: { tenantId: string; applicationName: string; fieldDelimiter: string; multivalueDelimiter: string },
  loginremote_user: string = "ACMEADMIN"
): Promise<any> {
  const endpoint = "https://preview.keyforge.ai/itasset/ACMECOM/uploadandgetschema/users";

  try {
    const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
    if (!accessToken) {
      throw new Error("No access token available");
    }

    const headers = new Headers();
    // Let browser set multipart boundary; do not set Content-Type explicitly
    headers.set("X-Requested-With", "XMLHttpRequest");
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("loginremote_user", loginremote_user);

    const formData = new FormData();
    formData.append("csvfile", csvfile);
    formData.append("basicDefinition", JSON.stringify(basicDefinition));

    const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
    const response = await fetchFn(endpoint, { method: "POST", headers, body: formData });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        if (await checkTokenExpiredError(errorData)) {
          throw new Error("Token Expired");
        }
      } catch (e) {
        if (e instanceof Error && e.message === "Token Expired") throw e;
      }
      throw new Error(`uploadandgetschema/users failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (await checkTokenExpiredError(data)) {
      throw new Error("Token Expired");
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.message === "Token Expired") {
      throw error;
    }
    console.warn("uploadAndGetSchemaUsers failed:", error);
    throw error;
  }
}

/** Uploads a CSV file and returns schema for a multivalued field - uploadandgetschema/{fieldName}. */
export async function uploadAndGetSchemaForField(
  fieldName: string,
  csvfile: File,
  basicDefinition: { tenantId: string; applicationName: string; fieldDelimiter: string; multivalueDelimiter: string },
  loginremote_user: string = "ACMEADMIN"
): Promise<any> {
  const encodedField = encodeURIComponent(fieldName);
  const endpoint = `https://preview.keyforge.ai/itasset/ACMECOM/uploadandgetschema/${encodedField}`;

  try {
    const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
    if (!accessToken) {
      throw new Error("No access token available");
    }

    const headers = new Headers();
    headers.set("X-Requested-With", "XMLHttpRequest");
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("loginremote_user", loginremote_user);

    const formData = new FormData();
    formData.append("csvfile", csvfile);
    formData.append("basicDefinition", JSON.stringify(basicDefinition));

    const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
    const response = await fetchFn(endpoint, { method: "POST", headers, body: formData });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        if (await checkTokenExpiredError(errorData)) {
          throw new Error("Token Expired");
        }
      } catch (e) {
        if (e instanceof Error && e.message === "Token Expired") throw e;
      }
      throw new Error(`uploadandgetschema/${fieldName} failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (await checkTokenExpiredError(data)) {
      throw new Error("Token Expired");
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.message === "Token Expired") {
      throw error;
    }
    console.warn("uploadAndGetSchemaForField failed:", error);
    throw error;
  }
}

/** Saves base metadata for disconnected users file - savebasemetadata/users. */
export async function saveBaseMetadataUsers(
  payload: any,
  loginremote_user: string = "ACMEADMIN"
): Promise<any> {
  const endpoint = "https://preview.keyforge.ai/itasset/ACMECOM/savebasemetadata/users";

  const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  if (!accessToken) {
    throw new Error("No access token available");
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("loginremote_user", loginremote_user);

  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      if (await checkTokenExpiredError(errorData)) {
        throw new Error("Token Expired");
      }
    } catch (e) {
      if (e instanceof Error && e.message === "Token Expired") throw e;
    }
    throw new Error(`savebasemetadata/users failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (await checkTokenExpiredError(data)) {
    throw new Error("Token Expired");
  }
  return data;
}

/** Fetches a single application by id/name from IT Asset getapp. Used in Edit mode to show application details. */
export async function getItAssetApp(appIdOrName: string, loginremote_user: string = "ACMEADMIN"): Promise<any> {
  const encoded = encodeURIComponent(appIdOrName);
  const endpoint = `https://preview.keyforge.ai/itasset/ACMECOM/getapp/${encoded}`;

  try {
    const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
    if (!accessToken) {
      return null;
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("X-Requested-With", "XMLHttpRequest");
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("loginremote_user", loginremote_user);

    const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
    const response = await fetchFn(endpoint, { method: "GET", headers });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        if (await checkTokenExpiredError(errorData)) {
          throw new Error("Token Expired");
        }
      } catch (e) {
        if (e instanceof Error && e.message === "Token Expired") throw e;
      }
      console.warn("getapp API unavailable:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    if (await checkTokenExpiredError(data)) {
      throw new Error("Token Expired");
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.message === "Token Expired") {
      throw error;
    }
    console.warn("getapp failed:", error);
    return null;
  }
}

/** Saves base metadata for a multivalued field file - savebasemetadata/{fieldName}. */
export async function saveBaseMetadataForField(
  fieldName: string,
  payload: any,
  loginremote_user: string = "ACMEADMIN"
): Promise<any> {
  const encodedField = encodeURIComponent(fieldName);
  const endpoint = `https://preview.keyforge.ai/itasset/ACMECOM/savebasemetadata/${encodedField}`;

  const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  if (!accessToken) {
    throw new Error("No access token available");
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("loginremote_user", loginremote_user);

  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      if (await checkTokenExpiredError(errorData)) {
        throw new Error("Token Expired");
      }
    } catch (e) {
      if (e instanceof Error && e.message === "Token Expired") throw e;
    }
    throw new Error(`savebasemetadata/${fieldName} failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (await checkTokenExpiredError(data)) {
    throw new Error("Token Expired");
  }
  return data;
}

/** Saves application details (edit mode) - IT Asset saveappdetails. */
export async function saveAppDetails(payload: {
  tenantId?: string;
  appid?: string;
  name: string;
  description?: string;
  category: string;
  owner?: { type: string; value: string };
  connectionDetails?: Record<string, unknown>;
  [key: string]: unknown;
}): Promise<any> {
  const endpoint = "https://preview.keyforge.ai/itasset/ACMECOM/saveappdetails";

  const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  if (!accessToken) {
    throw new Error("No access token available");
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("loginremote_user", "ACMEADMIN");

  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      if (await checkTokenExpiredError(errorData)) {
        throw new Error("Token Expired");
      }
    } catch (e) {
      if (e instanceof Error && e.message === "Token Expired") throw e;
    }
    throw new Error(`saveappdetails failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (await checkTokenExpiredError(data)) {
    throw new Error("Token Expired");
  }
  return data;
}

/** Onboards application (edit mode) - IT Asset onboardapp. */
export async function onboardApp(payload: { tenantId?: string; appid?: string; [key: string]: unknown }): Promise<any> {
  const endpoint = "https://preview.keyforge.ai/itasset/ACMECOM/onboardapp";

  const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  if (!accessToken) {
    throw new Error("No access token available");
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("loginremote_user", "ACMEADMIN");

  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      if (await checkTokenExpiredError(errorData)) {
        throw new Error("Token Expired");
      }
    } catch (e) {
      if (e instanceof Error && e.message === "Token Expired") throw e;
    }
    throw new Error(`onboardapp failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (await checkTokenExpiredError(data)) {
    throw new Error("Token Expired");
  }
  return data;
}

export async function regenerateApiToken(oldApiToken: string, applicationId: string): Promise<any> {
  const endpoint = `https://preview.keyforge.ai/registerscimapp/registerfortenant/ACMECOM/regenerateToken/${applicationId}`;

  const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  if (!accessToken) {
    throw new Error("No access token available");
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  headers.set("Authorization", `Bearer ${accessToken}`);

  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ OldAPIToken: oldApiToken }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      if (await checkTokenExpiredError(errorData)) {
        throw new Error("Token Expired");
      }
    } catch (e) {
      // ignore parse errors
    }
    throw new Error(`Regenerate token failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  if (await checkTokenExpiredError(data)) {
    throw new Error("Token Expired");
  }
  return data;
}

export async function getApplicationDetails(
  applicationId: string,
  apiToken: string,
  applicationName?: string
): Promise<any> {
  const endpoint = `https://preview.keyforge.ai/registerscimapp/registerfortenant/ACMECOM/getApp/${applicationId}`;

  const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  if (!accessToken) {
    throw new Error("No access token available");
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  headers.set("Authorization", `Bearer ${accessToken}`);

  const body: { APIToken: string; ApplicationName: string } = {
    APIToken: apiToken || "",
    ApplicationName: typeof applicationName === "string" ? applicationName : "",
  };

  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      if (await checkTokenExpiredError(errorData)) {
        throw new Error("Token Expired");
      }
    } catch (e) {
      // ignore parse errors
    }
    throw new Error(`Get application details failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  if (await checkTokenExpiredError(data)) {
    throw new Error("Token Expired");
  }
  return data;
}

/** PUT updateApp: update application config (hooks, threshold, etc.) for a tenant app */
export async function updateAppConfig(
  applicationId: string,
  oldApiToken: string,
  applicationConfig: Record<string, unknown>
): Promise<any> {
  const endpoint = `https://preview.keyforge.ai/registerscimapp/registerfortenant/ACMECOM/updateApp/${applicationId}`;

  const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  if (!accessToken) {
    throw new Error("No access token available");
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  headers.set("Authorization", `Bearer ${accessToken}`);

  const body = JSON.stringify({
    OldAPIToken: oldApiToken,
    ApplicationConfig: applicationConfig,
  });

  const fetchFn = typeof window !== "undefined" ? getOriginalFetch() : fetch;
  const response = await fetchFn(endpoint, {
    method: "PUT",
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      if (await checkTokenExpiredError(errorData)) {
        throw new Error("Token Expired");
      }
    } catch (e) {
      // ignore parse errors
    }
    throw new Error(`Update app config failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json().catch(() => ({}));
  if (await checkTokenExpiredError(data)) {
    throw new Error("Token Expired");
  }
  return data;
}

// Get all applications for a user (AI Assist) - requires JWT in Authorization header
export async function getAllAppsForUserWithAI(loginId: string): Promise<any> {
  const encoded = encodeURIComponent(loginId);
  const endpoint = `https://preview.keyforge.ai/aiagentcontroller/api/v1/ACMECOM/getallapps/${encoded}`;
  // Use authenticated request to include JWT token
  return apiRequestWithAuth<any>(endpoint, { method: 'GET' });
}

// Client-safe proxy call (avoids CORS by using Next.js API route)
export async function getAllSupportedApplicationTypesViaProxy(): Promise<any> {
  const headers = {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  const res = await fetch(`/api/supported-objects`, {
    headers,
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Proxy fetch failed: ${res.status} ${res.statusText}\n${errorBody}`);
  }
  return res.json();
}

/**
 * Coerces a supported-objects field list entry (string or { name, field, key, ... }) to a form field key.
 */
export function coerceSupportedObjectsFieldKey(entry: unknown): string | null {
  if (entry == null) return null;
  if (typeof entry === "string") {
    const t = entry.trim();
    return t || null;
  }
  if (typeof entry === "object" && !Array.isArray(entry)) {
    const o = entry as Record<string, unknown>;
    const s = String(
      o.name ??
        o.field ??
        o.Field ??
        o.key ??
        o.Key ??
        o.attribute ??
        o.Attribute ??
        o.id ??
        o.Id ??
        ""
    ).trim();
    return s || null;
  }
  const s = String(entry).trim();
  return s || null;
}

export function normalizeSupportedObjectsFieldArray(fieldsVal: unknown): string[] {
  if (!Array.isArray(fieldsVal)) return [];
  return (fieldsVal as unknown[])
    .map(coerceSupportedObjectsFieldKey)
    .filter((k): k is string => Boolean(k));
}

/** One grouped block from `{ advancedSetting: [ { connectionParameters: [...] }, ... ] }` inside a type's field array. */
export type ApplicationTypeIntegrationFieldGroup = {
  id: string;
  label: string;
  fields: string[];
};

export const VIEW_GET_ALL_USERS_FIELD = "viewGetAllUsers";

export const SCREEN_SCRAPPING_BASE_URL_FIELD = "baseURL";
export const SCREEN_SCRAPPING_JSON_FILE_FIELD = "screenScrapingJsonFile";
export const SCREEN_SCRAPPING_JSON_FILE_NAME_FIELD = "screenScrapingJsonFileName";

const VIEW_NAME_STEP3_ALIASES = ["view_name", "viewName"] as const;

/** Database ApplicationDetails keys sent on newApp even when the wizard leaves them blank. */
export const DATABASE_ALWAYS_INCLUDE_APPLICATION_DETAIL_FIELDS = [
  "viewGetAllGroups",
  "viewGetAllRoleContents",
  "viewGetUser",
  "viewGetGroup",
  "viewGetRoleContent",
  "uniqueIDSchemaMap",
  "spRevokeGroupMembership",
  "revokeGroupMembershipDefinition",
  "revokeGroupMembershipResponseDefinition",
  "spAddGroupMembership",
  "addGroupMembershipDefinition",
  "addGroupMembershipResponseDefinition",
  "groupSchemaMap",
  "roleContentSchemaMap",
  "spCreateAccount",
  "createAccountDefinition",
  "createAccountResponseDefinition",
  "spUpdateAccount",
  "updateAccountDefinition",
  "updateAccountResponseDefinition",
  "spDeleteAccount",
  "deleteAccountDefinition",
  "deleteAccountResponseDefinition",
  "spEnableAccount",
  "enableAccountDefinition",
  "enableAccountResponseDefinition",
  "spDisableAccount",
  "disableAccountDefinition",
  "disableAccountResponseDefinition",
] as const;

/** RESTService ApplicationDetails keys always sent on newApp (empty string when unset). */
export const REST_SERVICE_ALWAYS_INCLUDE_APPLICATION_DETAIL_FIELDS = [
  "clientID",
  "updateUserPayloadPath",
  "createUserPayloadPath",
  "usersGroupIDAttributePath",
  "revokeAccessFromGroupService",
  "usersEntitlementAttributePath",
  "groupMembersIDAttributePath",
  "getALLUserService",
  "getGroupService",
  "groupsPayloadPath",
  "password",
  "eachGroupPayloadPath",
  "usersGroupAttributePath",
  "totalResultsAttributeForGroups",
  "userUIDAttribute",
  "assignAccessToGroupService",
  "getAllGroupsService",
  "scope",
  "eachUserPayloadPath",
  "authorizationType",
  "clientSecret",
  "usersEntitlementIDAttributePath",
  "totalResultsAttrForGroupsPath",
  "authUserName",
  "deleteUserService",
  "totalResultsAttrForUsersPath",
  "usersRoleDisplayAttributePath",
  "revokeAccessFromUserService",
  "totalResultsAttributeForUsers",
  "createUserService",
  "usersPayloadPath",
  "usersRoleAttributePath",
  "getUserService",
  "usersGroupDisplayAttributePath",
  "groupMembersAttributePath",
  "bearerToken",
  "authorizationURL",
  "updateUserService",
  "groupDisplayNameAttribute",
  "assignAccessToUserService",
  "grantType",
  "headerAttributes",
  "usersRoleIDAttributePath",
  "usersEntitlementDisplayAttributePath",
  "refreshToken",
  "groupIDAttribute",
] as const;

const REST_SERVICE_APPLICATION_DETAIL_DEFAULTS: Readonly<Record<string, string>> = {
  usersGroupIDAttributePath: "groups[].value",
  usersGroupAttributePath: "groups[]",
  usersGroupDisplayAttributePath: "groups[].display",
  usersPayloadPath: "Resources[]",
  userUIDAttribute: "userId",
  authorizationType: "bearer",
};

function buildRestGetAllUserServiceValue(step3: Record<string, unknown>): string {
  const direct = pickStep3String(step3, "getALLUserService", "getAllUserService");
  if (direct) return direct;
  const usersUrl = pickViewGetAllUsersFromStep3(step3);
  if (!usersUrl) return "";
  try {
    const parsed = JSON.parse(usersUrl) as unknown;
    if (parsed != null && typeof parsed === "object" && "url" in (parsed as object)) {
      return usersUrl;
    }
  } catch {
    // plain URL from Get All Users field
  }
  return JSON.stringify({
    url: usersUrl,
    operation: "GET",
    tenantid: resolveEntitiesTenant(),
  });
}

function pickRestServiceApplicationDetailValue(
  apiFieldKey: string,
  step3: Record<string, unknown>
): string {
  if (apiFieldKey === "getALLUserService") {
    return buildRestGetAllUserServiceValue(step3);
  }
  if (apiFieldKey === "clientID") {
    return pickStep3String(step3, "clientID", "clientId");
  }
  return pickStep3ValueForSupportedApiField(apiFieldKey, step3);
}

/** Flat + integration-group field keys from a supported-objects application type record. */
export function collectSupportedObjectsFieldKeys(
  flatFields: string[],
  integrationGroups: ApplicationTypeIntegrationFieldGroup[] | null | undefined
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const add = (key: string) => {
    const k = key.trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    ordered.push(k);
  };
  for (const fk of flatFields) add(fk);
  for (const group of integrationGroups ?? []) {
    for (const fk of group.fields) add(fk);
  }
  return ordered;
}

/** Resolves Get All Users from step3 (API key viewGetAllUsers or legacy view_name / viewName). */
export function pickViewGetAllUsersFromStep3(step3: Record<string, unknown>): string {
  return pickStep3String(step3, VIEW_GET_ALL_USERS_FIELD, ...VIEW_NAME_STEP3_ALIASES);
}

export function pickScreenScrappingBaseUrlFromStep3(step3: Record<string, unknown>): string {
  return pickStep3String(step3, SCREEN_SCRAPPING_BASE_URL_FIELD, "baseUrl");
}

export function pickScreenScrappingJsonFromStep3(step3: Record<string, unknown>): string {
  return pickStep3String(step3, SCREEN_SCRAPPING_JSON_FILE_FIELD);
}

export function isScreenScrappingIntegrationInputComplete(step3: Record<string, unknown>): boolean {
  return Boolean(
    pickScreenScrappingBaseUrlFromStep3(step3).trim() &&
      pickScreenScrappingJsonFromStep3(step3).trim()
  );
}

function pickStep3ValueForSupportedApiField(
  apiFieldKey: string,
  step3: Record<string, unknown>
): string {
  if (apiFieldKey === VIEW_GET_ALL_USERS_FIELD) {
    return pickViewGetAllUsersFromStep3(step3);
  }
  return pickStep3String(step3, apiFieldKey);
}

/** ApplicationDetails for newApp — all supported-objects fields (empty string when unset). */
export function buildGroupedApplicationDetailsForNewApp(
  step3: Record<string, unknown>,
  supportedFieldKeys: string[],
  appType?: string
): Record<string, string> {
  const isRestService = appType === "RESTService Application";
  const isScreenScrapping = appType === "ScreenScrapping";
  const alwaysIncludeEmpty = new Set<string>(
    appType === "Database"
      ? [...DATABASE_ALWAYS_INCLUDE_APPLICATION_DETAIL_FIELDS]
      : isRestService
        ? [...REST_SERVICE_ALWAYS_INCLUDE_APPLICATION_DETAIL_FIELDS]
        : isScreenScrapping
          ? [
              SCREEN_SCRAPPING_BASE_URL_FIELD,
              SCREEN_SCRAPPING_JSON_FILE_FIELD,
              SCREEN_SCRAPPING_JSON_FILE_NAME_FIELD,
            ]
          : []
  );
  const keysToEmit = [...new Set([...supportedFieldKeys, ...alwaysIncludeEmpty])];
  const ApplicationDetails: Record<string, string> = {};
  for (const apiKey of keysToEmit) {
    if (isRestService && apiKey === VIEW_GET_ALL_USERS_FIELD) continue;
    let val = isRestService
      ? pickRestServiceApplicationDetailValue(apiKey, step3)
      : isScreenScrapping && apiKey === SCREEN_SCRAPPING_BASE_URL_FIELD
        ? pickScreenScrappingBaseUrlFromStep3(step3)
        : isScreenScrapping && apiKey === SCREEN_SCRAPPING_JSON_FILE_FIELD
          ? pickScreenScrappingJsonFromStep3(step3)
          : isScreenScrapping && apiKey === SCREEN_SCRAPPING_JSON_FILE_NAME_FIELD
            ? pickStep3String(step3, SCREEN_SCRAPPING_JSON_FILE_NAME_FIELD)
            : pickStep3ValueForSupportedApiField(apiKey, step3);
    if (!val && isRestService && apiKey in REST_SERVICE_APPLICATION_DETAIL_DEFAULTS) {
      val = REST_SERVICE_APPLICATION_DETAIL_DEFAULTS[apiKey];
    }
    ApplicationDetails[apiKey] = val;
  }
  return ApplicationDetails;
}

const INTEGRATION_FIELD_LABEL_ACRONYMS = new Set([
  "api",
  "db",
  "id",
  "iga",
  "jdbc",
  "ldap",
  "lcm",
  "oauth",
  "oim",
  "rest",
  "scim",
  "sql",
  "sso",
  "ssl",
  "uid",
  "uri",
  "url",
]);

/** Turns supported-objects field keys (camelCase, snake_case, PascalCase) into UI labels. */
export function formatIntegrationFieldLabel(fieldKey: string): string {
  const spaced = String(fieldKey)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
  if (!spaced) return "";
  return spaced
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (INTEGRATION_FIELD_LABEL_ACRONYMS.has(lower)) {
        return lower === "oauth" ? "OAuth" : lower.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function formatIntegrationGroupLabel(sectionId: string): string {
  return formatIntegrationFieldLabel(sectionId);
}

/** Preferred tab order for Connection Parameters → Basic → Advanced on settings / configuration UI. */
export const INTEGRATION_SETTING_GROUP_TAB_ORDER = [
  CONNECTION_PARAMETERS_GROUP_ID,
  "basic",
  "advanced",
] as const;

export function normalizeIntegrationFieldKeyForMatch(key: string): string {
  return key.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/_/g, "");
}

export function sortIntegrationFieldGroups(
  groups: ApplicationTypeIntegrationFieldGroup[]
): ApplicationTypeIntegrationFieldGroup[] {
  const order = new Map(
    INTEGRATION_SETTING_GROUP_TAB_ORDER.map((id, index) => [id.toLowerCase(), index])
  );
  return [...groups].sort((a, b) => {
    const ai = order.get(a.id.toLowerCase()) ?? 999;
    const bi = order.get(b.id.toLowerCase()) ?? 999;
    return ai - bi || a.label.localeCompare(b.label);
  });
}

/** Maps saved ApplicationDetails keys into supported-objects integration groups. */
export function partitionApplicationDetailsByIntegrationGroups(
  details: Record<string, unknown> | null | undefined,
  groups: ApplicationTypeIntegrationFieldGroup[]
): {
  groupedFields: { group: ApplicationTypeIntegrationFieldGroup; fieldKeys: string[] }[];
  ungroupedFieldKeys: string[];
} {
  if (!details || typeof details !== "object" || !groups.length) {
    return { groupedFields: [], ungroupedFieldKeys: details ? Object.keys(details) : [] };
  }

  const detailKeys = Object.keys(details);
  const assigned = new Set<string>();

  const groupedFields = sortIntegrationFieldGroups(groups).map((group) => {
    const groupNormSet = new Set(
      group.fields.map((f) => normalizeIntegrationFieldKeyForMatch(f))
    );
    const fieldKeys: string[] = [];
    for (const dk of detailKeys) {
      if (assigned.has(dk)) continue;
      if (groupNormSet.has(normalizeIntegrationFieldKeyForMatch(dk))) {
        fieldKeys.push(dk);
        assigned.add(dk);
      }
    }
    return { group, fieldKeys };
  });

  const ungroupedFieldKeys = detailKeys.filter((k) => !assigned.has(k));
  return { groupedFields, ungroupedFieldKeys };
}

/** Operation sub-tabs shown inside the Advanced integration group (settings + onboarding). */
export type AdvancedIntegrationOperationTabDef = {
  id: string;
  label: string;
  fieldKeys: readonly string[];
};

export const ADVANCED_INTEGRATION_OPERATION_TABS: AdvancedIntegrationOperationTabDef[] = [
  {
    id: "create",
    label: "Create",
    fieldKeys: ["spCreateAccount", "createAccountDefinition", "createAccountResponseDefinition"],
  },
  {
    id: "update",
    label: "Update",
    fieldKeys: ["spUpdateAccount", "updateAccountDefinition", "updateAccountResponseDefinition"],
  },
  {
    id: "delete",
    label: "Delete",
    fieldKeys: ["spDeleteAccount", "deleteAccountDefinition", "deleteAccountResponseDefinition"],
  },
  {
    id: "disable",
    label: "Disable",
    fieldKeys: ["spDisableAccount", "disableAccountDefinition", "disableAccountResponseDefinition"],
  },
  {
    id: "enable",
    label: "Enable",
    fieldKeys: ["spEnableAccount", "enableAccountDefinition", "enableAccountResponseDefinition"],
  },
  {
    id: "revokeGroup",
    label: "Revoke Group",
    fieldKeys: [
      "spRevokeGroupMembership",
      "revokeGroupMembershipDefinition",
      "revokeGroupMembershipResponseDefinition",
    ],
  },
  {
    id: "addGroup",
    label: "Add Group",
    fieldKeys: [
      "spAddGroupMembership",
      "addGroupMembershipDefinition",
      "addGroupMembershipResponseDefinition",
      "groupSchemaMap",
    ],
  },
  {
    id: "roleContent",
    label: "Role Content",
    fieldKeys: ["viewGetAllRoleContents", "viewGetRoleContent", "roleContentSchemaMap"],
  },
];

export function isAdvancedIntegrationGroupId(groupId: string | undefined): boolean {
  return groupId?.trim().toLowerCase() === "advanced";
}

function inferAdvancedOperationTabId(normalizedFieldKey: string): string | null {
  if (normalizedFieldKey.includes("create") && normalizedFieldKey.includes("account")) return "create";
  if (normalizedFieldKey.includes("update") && normalizedFieldKey.includes("account")) return "update";
  if (normalizedFieldKey.includes("delete") && normalizedFieldKey.includes("account")) return "delete";
  if (normalizedFieldKey.includes("disable") && normalizedFieldKey.includes("account")) return "disable";
  if (normalizedFieldKey.includes("enable") && normalizedFieldKey.includes("account")) return "enable";
  if (normalizedFieldKey.includes("revoke") && normalizedFieldKey.includes("group")) return "revokeGroup";
  if (
    normalizedFieldKey.includes("add") &&
    normalizedFieldKey.includes("group") &&
    !normalizedFieldKey.includes("role")
  ) {
    return "addGroup";
  }
  if (normalizedFieldKey.includes("rolecontent")) return "roleContent";
  return null;
}

/** Splits advanced-group field keys into the 8 provisioning operation tabs. */
export function partitionFieldsByAdvancedOperationTabs(
  sourceFieldKeys: string[]
): { tab: AdvancedIntegrationOperationTabDef; fieldKeys: string[] }[] {
  const assigned = new Set<string>();
  const partitioned = ADVANCED_INTEGRATION_OPERATION_TABS.map((tab) => ({
    tab,
    fieldKeys: [] as string[],
  }));

  const assignToTab = (fieldKey: string, tabId: string) => {
    const entry = partitioned.find((p) => p.tab.id === tabId);
    if (!entry || assigned.has(fieldKey)) return;
    entry.fieldKeys.push(fieldKey);
    assigned.add(fieldKey);
  };

  for (const fk of sourceFieldKeys) {
    const norm = normalizeIntegrationFieldKeyForMatch(fk);
    let matched = false;
    for (const tab of ADVANCED_INTEGRATION_OPERATION_TABS) {
      if (tab.fieldKeys.some((k) => normalizeIntegrationFieldKeyForMatch(k) === norm)) {
        assignToTab(fk, tab.id);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const inferred = inferAdvancedOperationTabId(norm);
      if (inferred) assignToTab(fk, inferred);
    }
  }

  return partitioned;
}

/** Reads `advancedSetting: [ { connectionParameters: [...] }, { basic: [...] }, ... ]` from a type's field array. */
export function extractIntegrationAdvancedGroupsFromFieldsArray(
  fieldsVal: unknown
): ApplicationTypeIntegrationFieldGroup[] {
  if (!Array.isArray(fieldsVal)) return [];
  const groups: ApplicationTypeIntegrationFieldGroup[] = [];
  for (const entry of fieldsVal as unknown[]) {
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) continue;
    const o = entry as Record<string, unknown>;
    const adv = o.advancedSetting ?? o.AdvancedSetting;
    if (!Array.isArray(adv)) continue;
    for (const section of adv) {
      if (section == null || typeof section !== "object" || Array.isArray(section)) continue;
      const sec = section as Record<string, unknown>;
      const sectionKeys = Object.keys(sec);
      const sectionId = sectionKeys[0];
      if (!sectionId) continue;
      const list = sec[sectionId];
      const fieldKeys = normalizeSupportedObjectsFieldArray(list);
      if (fieldKeys.length === 0) continue;
      groups.push({
        id: sectionId,
        label: formatIntegrationGroupLabel(sectionId),
        fields: fieldKeys,
      });
    }
  }
  return groups;
}

/**
 * Splits a type field array into integration cards (nested advancedSetting) vs flat root string fields.
 * Root strings that duplicate fields already placed in a group are omitted from `flatFieldKeys`.
 */
export function flattenIntegrationFieldsAfterAdvancedGroups(fieldsVal: unknown): {
  groups: ApplicationTypeIntegrationFieldGroup[];
  flatFieldKeys: string[];
} {
  const groups = extractIntegrationAdvancedGroupsFromFieldsArray(fieldsVal);
  const inGroup = new Set(groups.flatMap((g) => g.fields));
  const seenFlat = new Set<string>();
  const flatOrdered: string[] = [];

  if (Array.isArray(fieldsVal)) {
    for (const entry of fieldsVal as unknown[]) {
      if (typeof entry === "string") {
        const k = coerceSupportedObjectsFieldKey(entry);
        if (k && !inGroup.has(k) && !seenFlat.has(k)) {
          seenFlat.add(k);
          flatOrdered.push(k);
        }
        continue;
      }
      if (entry != null && typeof entry === "object" && !Array.isArray(entry)) {
        const o = entry as Record<string, unknown>;
        if (o.advancedSetting != null || o.AdvancedSetting != null) continue;
        const k = coerceSupportedObjectsFieldKey(entry);
        if (k && !inGroup.has(k) && !seenFlat.has(k)) {
          seenFlat.add(k);
          flatOrdered.push(k);
        }
      }
    }
  }

  return { groups, flatFieldKeys: flatOrdered };
}

/** One entry from supported-objects `applicationType` array (may include `advancedSetting`). */
export type SupportedAppTypeAdvancedParts = {
  hook: unknown;
  threshold: unknown;
  autoRetry: unknown;
};

export type ParsedSupportedApplicationTypeItem = {
  typeName: string;
  /** Flat field keys not covered by {@link integrationFieldGroups} (avoids duplicating grouped inputs). */
  fields: string[];
  /** Top-level hook / threshold / autoRetry summary (different from nested integration groups). */
  advancedSettingParts: SupportedAppTypeAdvancedParts | null;
  /** Nested `{ advancedSetting: [ { connectionParameters: [...] }, ... ] }` inside the type's field array. */
  integrationFieldGroups: ApplicationTypeIntegrationFieldGroup[] | null;
};

/**
 * Parses a single supported-objects `applicationType` record.
 * Skips `advancedSetting` / `AdvancedSetting` when resolving the type name key.
 */
export function parseSupportedObjectsApplicationTypeItem(item: unknown): ParsedSupportedApplicationTypeItem | null {
  if (item == null || typeof item !== "object" || Array.isArray(item)) return null;
  const rec = item as Record<string, unknown>;
  const typeKeys = Object.keys(rec).filter((k) => !/^advancedsetting$/i.test(k));
  const typeName = typeKeys[0];
  if (!typeName) return null;
  const fieldsVal = rec[typeName];
  const { groups: integrationGroups, flatFieldKeys } = flattenIntegrationFieldsAfterAdvancedGroups(fieldsVal);

  const advRaw = rec.advancedSetting ?? rec.AdvancedSetting;
  let advancedSettingParts: SupportedAppTypeAdvancedParts | null = null;
  if (advRaw != null && typeof advRaw === "object" && !Array.isArray(advRaw)) {
    const o = advRaw as Record<string, unknown>;
    const hasHookShape =
      "hook" in o ||
      "Hook" in o ||
      "threshold" in o ||
      "Threshold" in o ||
      "autoRetry" in o ||
      "auto_retry" in o ||
      "AutoRetry" in o;
    if (hasHookShape) {
      advancedSettingParts = {
        hook: o.hook ?? o.Hook,
        threshold: o.threshold ?? o.Threshold,
        autoRetry: o.autoRetry ?? o.auto_retry ?? o.AutoRetry,
      };
    }
  }
  return {
    typeName,
    fields: flatFieldKeys,
    advancedSettingParts,
    integrationFieldGroups: integrationGroups.length > 0 ? integrationGroups : null,
  };
}

/** Short label for an advancedSetting slot on a summary card. */
export function describeAdvancedSettingSlotValue(val: unknown): string {
  if (val == null) return "—";
  if (Array.isArray(val)) return val.length ? `${val.length} item(s)` : "—";
  if (typeof val === "object") {
    const n = Object.keys(val as object).length;
    return n ? "Defined" : "—";
  }
  const s = String(val).trim();
  if (!s) return "—";
  return s.length > 22 ? `${s.slice(0, 22)}…` : s;
}

// Validate password for sign-off
export async function validatePassword(userName: string, password: string): Promise<boolean> {
  const endpoint = "https://preview.keyforge.ai/nativeusers/api/v1/ACMECOM/validatepassword";
  
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        userName,
        password,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // Check if error body contains token expired error
      try {
        const errorData = JSON.parse(errorBody);
        if (await checkTokenExpiredError(errorData)) {
          throw new Error('Token Expired');
        }
      } catch (e) {
        // If parsing fails, continue with original error
      }
      throw new Error(`Password validation failed: ${response.status} ${response.statusText}\n${errorBody}`);
    }

    const responseData = await response.json();
    // Check for token expired error in successful responses
    if (await checkTokenExpiredError(responseData)) {
      throw new Error('Token Expired');
    }
    
    // Response should be true or false
    return responseData === true || responseData === "true";
  } catch (error) {
    console.error('Password validation error:', error);
    throw error;
  }
}

// Sign off certification
export async function signOffCertification(
  reviewerId: string,
  certId: string,
  comments: string
): Promise<void> {
  const endpoint = `${BASE_URL}/signoff/${reviewerId}/${certId}`;
  
  return apiRequestWithAuth<void>(endpoint, {
    method: "POST",
    body: JSON.stringify({
      comments,
    }),
  });
}

// Schedule campaign template
export async function scheduleCampaign(payload: {
  campaignName: string;
  campaignId: string;
  description: string;
  startDate: string;
  zoneId: string;
  runItOnce: string;
  neverEnds: string;
  endsOn?: string;
  enableStaging: string;
  frequency?: {
    period: string;
    periodValue: string;
  };
}): Promise<any> {
  const endpoint = "https://preview.keyforge.ai/kfscheduler/api/v1/ACMECOM/jobs/schedule/campaign";
  
  // apiRequestWithAuth already handles token expiration and refresh internally
  const result = await apiRequestWithAuth<any>(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "ISPM-Scheduler/1.0",
    },
    body: JSON.stringify(payload),
  });

  return result;
}