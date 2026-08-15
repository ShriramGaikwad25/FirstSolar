"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleX,
  RotateCcw,
  Printer,
} from "lucide-react";
import { getReviewerId } from "@/lib/auth";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import InsightsIcon from "@/components/InsightsIcon";

interface RequestLineItem {
  lineItemId: string;
  catalogId?: string;
  entitlementId: string;
  name: string;
  displayName: string;
  applicationName: string;
  type: string;
  startDate: string;
  endDate: string;
  comments: string;
  hasInfoIcon?: boolean;
  hasHighRisk?: boolean;
  hasTrainingCheck?: boolean;
  beneficiaryAnalysis?: string;
  contextualRisk?: string;
  riskSensitivityAnalysis?: string;
  peerAnalysis?: string;
}

interface RequestDetails {
  dateCreated: string;
  type: string;
  justification: string;
}

interface SodPolicyDetails {
  Owner?: string;
  Description?: string;
  "Business Process"?: string;
  "SOD Policy ID"?: string;
  "Policy Name"?: string;
  [key: string]: unknown;
}

interface PendingApprovalDetail {
  id: string;
  taskId?: number | string;
  reviewerId: string;
  fallbackEntitlementId: string;
  beneficiaryName: string;
  requesterName: string;
  durationDays?: number;
  details: RequestDetails;
  lineItems: RequestLineItem[];
  initialLineItemActions?: Record<string, "approve" | "reject" | null>;
  baselineLineItemActions?: Record<
    string,
    "approve" | "reject" | "consulted" | null
  >;
  sodPolicyDetails?: SodPolicyDetails | null;
  sodSeverity?: string | null;
  sodConflictingRoles?: string[];
}

const formatDate = (value: string | null | undefined): string => {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    const yyyy = String(parsed.getFullYear());
    return `${mm}/${dd}/${yyyy}`;
  }
  return value;
};

const toStringSafe = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

const normalizeId = (value: unknown): string =>
  toStringSafe(value).trim().toLowerCase();

const toArraySafe = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).filter(
      (entry) => entry && typeof entry === "object",
    ) as any[];
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") {
        return Object.values(parsed as Record<string, unknown>).filter(
          (entry) => entry && typeof entry === "object",
        ) as any[];
      }
    } catch {
      // ignore invalid json string
    }
  }
  return [];
};

const toInsightMessage = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const fromMessage = toStringSafe(obj.message ?? obj.value ?? "").trim();
    if (fromMessage) return fromMessage;
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (entry && typeof entry === "object") {
          const obj = entry as Record<string, unknown>;
          return toStringSafe(obj.message ?? obj.value ?? "").trim();
        }
        return "";
      })
      .filter(Boolean);
    return parts.length ? parts.join(" ") : null;
  }
  return null;
};

const toAiRecommendationArray = (value: unknown): Record<string, any>[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (entry) => entry && typeof entry === "object",
    ) as Record<string, any>[];
  }
  if (value && typeof value === "object") {
    return [value as Record<string, any>];
  }
  return [];
};

const toObjectSafe = (value: unknown): Record<string, any> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
    } catch {
      // ignore invalid json
    }
  }
  return {};
};

function collectLineItemIdSet(entry: unknown): Set<string> {
  const ids = new Set<string>();
  const add = (v: unknown) => {
    const n = normalizeId(v);
    if (n) ids.add(n);
  };
  if (!entry || typeof entry !== "object") return ids;
  const o = entry as Record<string, unknown>;
  add(o.lineItemId ?? o.line_item_id ?? o.lineitemid ?? o.lineitemId);
  add(o.catalogId ?? o.catalog_id ?? o.catalogid);
  add(o.entitlementId ?? o.entitlement_id ?? o.entitlementid);
  add(
    o.requested_itemid ??
      o.requestedItemId ??
      o.requesteditemid ??
      o.requestedItemid,
  );
  add(o.entity_id ?? o.entityId);
  add(o.item_id ?? o.itemId);
  const cat = o.catalog;
  if (cat && typeof cat === "object" && !Array.isArray(cat)) {
    const c = cat as Record<string, unknown>;
    add(c.catalogid ?? c.catalogId ?? c.catalog_id ?? c.id);
    add(c.entitlementid ?? c.entitlementId ?? c.entitlement_id);
  }
  return ids;
}

/** Resolve action_payload.lineItems entries to full objects from itemdetails when possible. */
function findItemDetailForActionLine(
  actionLine: unknown,
  details: any[],
): any | undefined {
  const actionIds = collectLineItemIdSet(actionLine);
  if (actionIds.size === 0) return undefined;
  for (const d of details) {
    const detailIds = collectLineItemIdSet(d);
    for (const id of actionIds) {
      if (detailIds.has(id)) return d;
    }
  }
  return undefined;
}

const REQUESTER_COMMENTS_STORAGE_PREFIX =
  "ispm:pending-approval-requester-comments";

function loadRequesterCommentsFromStorage(
  requestId: string,
): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(
      `${REQUESTER_COMMENTS_STORAGE_PREFIX}:${requestId}`,
    );
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // ignore invalid JSON
  }
  return {};
}

function saveRequesterCommentsToStorage(
  requestId: string,
  map: Record<string, string>,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${REQUESTER_COMMENTS_STORAGE_PREFIX}:${requestId}`,
      JSON.stringify(map),
    );
  } catch {
    // ignore quota / private mode
  }
}

const PendingApprovalDetailPage = ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = React.use(params);
  const router = useRouter();
  const {
    openSidebar,
    isOpen: isRightSidebarOpen,
    title: rightSidebarTitle,
  } = useRightSidebar();
  const [request, setRequest] = useState<PendingApprovalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLineItems, setExpandedLineItems] = useState<
    Record<string, boolean>
  >({});
  const [lineItemActions, setLineItemActions] = useState<
    Record<string, "approve" | "reject" | null>
  >({});
  const [lineItemLoading, setLineItemLoading] = useState<
    Record<string, boolean>
  >({});
  const [lineItemError, setLineItemError] = useState<
    Record<string, string | null>
  >({});
  const [lineItemComments, setLineItemComments] = useState<
    Record<string, string>
  >(() => loadRequesterCommentsFromStorage(id));

  useEffect(() => {
    if (!id) return;
    setLineItemComments(loadRequesterCommentsFromStorage(id));
  }, [id]);

  const [commentModalItemKey, setCommentModalItemKey] = useState<string | null>(
    null,
  );
  const [commentDraft, setCommentDraft] = useState("");
  const [commentCategory, setCommentCategory] = useState("");
  const [commentSubcategory, setCommentSubcategory] = useState("");
  const [isCommentDropdownOpen, setIsCommentDropdownOpen] = useState(false);
  const [infoRequestItemKey, setInfoRequestItemKey] = useState<string | null>(
    null,
  );
  const [infoRequestMessage, setInfoRequestMessage] = useState("");
  const [infoRequestLoading, setInfoRequestLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeInsightsLineItemKey, setActiveInsightsLineItemKey] = useState<
    string | null
  >(null);
  const [baselineLineItemActions, setBaselineLineItemActions] = useState<
    Record<string, "approve" | "reject" | "consulted" | null>
  >({});

  const commentOptions: Record<string, string[]> = {
    Approve: [
      "Access required to perform current job responsibilities.",
      "Access aligns with user's role and department functions.",
      "Validated with manager/business owner – appropriate access.",
      "No SoD (Segregation of Duties) conflict identified.",
      "User continues to work on project/system requiring this access.",
    ],
    Revoke: [
      "User no longer in role requiring this access.",
      "Access redundant – duplicate with other approved entitlements.",
      "Access not used in last 90 days (inactive entitlement).",
      "SoD conflict identified – removing conflicting access.",
      "Temporary/project-based access – no longer required.",
    ],
  };

  useEffect(() => {
    const url =
      "https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery";
    const reviewerId = getReviewerId();

    if (!reviewerId) {
      console.warn(
        "[PendingApprovalDetail] No reviewerId found in cookies; skipping fetch and showing not found.",
      );
      setLoading(false);
      setRequest(null);
      return;
    }
    setLoading(true);
    setError(null);

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query:
          "select * from kf_wf_get_approval_task where assignee_id = ?::uuid AND task_status = 'OPEN'",
        parameters: [reviewerId],
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const rows: any[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.resultSet)
            ? (data as any).resultSet
            : Array.isArray((data as any)?.rows)
              ? (data as any).rows
              : Array.isArray((data as any)?.data)
                ? (data as any).data
                : [];

        const mapped = rows.map((row, rowIdx) => {
          if (rowIdx === 0) {
            console.log(
              "[PendingApprovalDetail] raw row keys:",
              Object.keys(row || {}),
            );
            console.log(
              "[PendingApprovalDetail] full row:",
              JSON.stringify(row, null, 2),
            );
          }
          const contextJson = toObjectSafe(
            row.context_json ?? row.contextJson ?? {},
          );
          const requestJson = toObjectSafe(
            row.request_json ??
              row.requestJson ??
              row.requestjson ??
              row.payload_json ??
              row.payloadJson ??
              {},
          );
          const sodResults =
            contextJson?.sodResults ??
            contextJson?.sod_results ??
            contextJson?.sodresults ??
            requestJson?.workflow_instance?.context_json?.sodResults ??
            requestJson?.workflow_instance?.context_json?.sod_results ??
            requestJson?.workflow_instance?.context_json?.sodresults ??
            requestJson?.workflowInstance?.context_json?.sodResults ??
            requestJson?.workflowInstance?.context_json?.sod_results ??
            requestJson?.workflowInstance?.context_json?.sodresults ??
            requestJson?.workflow_instance?.contextJson?.sodResults ??
            requestJson?.workflow_instance?.contextJson?.sod_results ??
            requestJson?.workflow_instance?.contextJson?.sodresults ??
            requestJson?.workflowInstance?.contextJson?.sodResults ??
            requestJson?.workflowInstance?.contextJson?.sod_results ??
            requestJson?.workflowInstance?.contextJson?.sodresults;
          const hasGlobalSodConflict = Boolean(sodResults?.hasConflict);
          const sodConflictingRoles: string[] = Array.isArray(
            sodResults?.conflictingRoles,
          )
            ? sodResults.conflictingRoles
                .map((r: any) => String(r).trim())
                .filter(Boolean)
            : [];
          const primaryConflictingRole = sodConflictingRoles[0] ?? "";
          const sodPolicyDetails: SodPolicyDetails | null =
            (sodResults?.sodPolicyDetails as SodPolicyDetails | undefined) ??
            (sodResults?.SODPolicyDetails as SodPolicyDetails | undefined) ??
            (sodResults?.sod_policy_details as SodPolicyDetails | undefined) ??
            null;
          const sodSeverity: string | null =
            typeof sodResults?.severity === "string"
              ? sodResults.severity
              : null;

          // Debug SOD signal used to compute the red badge.
          // This helps confirm whether we have: sodResults.hasConflict, conflictingRoles[0],
          // and whether request.sodPolicyDetails is present.
          if (
            hasGlobalSodConflict ||
            primaryConflictingRole ||
            sodPolicyDetails
          ) {
            console.log("[PendingApprovalDetail][SOD]", {
              hasGlobalSodConflict,
              primaryConflictingRole,
              hasSodPolicyDetails: Boolean(sodPolicyDetails),
              sodSeverity,
              sodPolicyDetailsKeys: sodPolicyDetails
                ? Object.keys(sodPolicyDetails)
                : [],
            });
          }
          const requestId = toStringSafe(
            row.request_id ??
              row.requestId ??
              row.requestid ??
              row.req_id ??
              row.task_id ??
              row.taskId ??
              row.taskid ??
              row.id,
          );
          const requesterName = toStringSafe(
            row?.requester?.displayname ??
              row.requester_name ??
              row.requestor_name ??
              row.requested_by,
          );
          const beneficiaryName = toStringSafe(
            row?.beneficiary?.username ??
              row.beneficiary_name ??
              row.beneficiary ??
              row.user_name,
          );
          const createdOnRaw =
            row.created_on ??
            row.createdOn ??
            row.created_at ??
            row.assigned_on ??
            row.assignedOn;
          const createdOn = formatDate(toStringSafe(createdOnRaw));
          const justification = toStringSafe(
            row.requester_justification ??
              row.comments ??
              row.comment ??
              row.remarks,
          );

          const itemDetails: any[] = toArraySafe(
            row.itemdetails ?? row.itemDetails,
          );

          const actionPayload = toObjectSafe(
            row.action_payload ??
              row.actionPayload ??
              row.actionpayload ??
              contextJson.action_payload ??
              contextJson.actionPayload ??
              requestJson.action_payload ??
              requestJson.actionPayload ??
              {},
          );
          const actionLineItemsFromPayload = toArraySafe(
            actionPayload.lineItems ?? actionPayload.lineitems,
          );
          const detailItemsForMapping =
            actionLineItemsFromPayload.length > 0
              ? actionLineItemsFromPayload.map((actionLine) => {
                  const match = findItemDetailForActionLine(
                    actionLine,
                    itemDetails,
                  );
                  if (match) return match;
                  const al = actionLine as Record<string, any>;
                  const cat = al.catalog;
                  return {
                    ...al,
                    catalog:
                      cat &&
                      typeof cat === "object" &&
                      !Array.isArray(cat)
                        ? cat
                        : {},
                  };
                })
              : itemDetails;

          const aiRecommendations = toAiRecommendationArray(
            row.ai_recommendation ??
              row.aiRecommendation ??
              requestJson?.ai_recommendation ??
              requestJson?.aiRecommendation ??
              contextJson?.ai_recommendation ??
              contextJson?.aiRecommendation,
          );

          const lineItems: RequestLineItem[] = detailItemsForMapping.map(
            (item, itemIdx) => {
              const catalog = item?.catalog ?? {};
              if (itemIdx === 0) {
                console.log(
                  "[PendingApprovalDetail] raw item keys:",
                  Object.keys(item || {}),
                );
                console.log(
                  "[PendingApprovalDetail] raw catalog keys:",
                  Object.keys(catalog || {}),
                );
                console.log(
                  "[PendingApprovalDetail] full item:",
                  JSON.stringify(item, null, 2),
                );
              }
              const lineName = toStringSafe(
                catalog.name ??
                  catalog.entitlementname ??
                  catalog.applicationname ??
                  item?.entity_name ??
                  item?.entityName ??
                  item?.name,
              );
              const lineType = toStringSafe(
                catalog.type ??
                  catalog.entitlementtype ??
                  catalog.metadata?.entitlementType ??
                  item?.entity_type ??
                  item?.entityType ??
                  "Entitlement",
              );
              const applicationName = toStringSafe(
                catalog.applicationname ??
                  catalog.applicationName ??
                  item?.application_name ??
                  item?.applicationName,
              );
              const startDate = formatDate(toStringSafe(item?.item_startdate));
              const endDate = formatDate(toStringSafe(item?.item_enddate));
              const riskLevel = String(catalog.risk ?? "").toLowerCase();
              const lineNameKey = toStringSafe(
                catalog.name ??
                  catalog.entitlementname ??
                  catalog.applicationname ??
                  item?.entity_name ??
                  item?.entityName ??
                  item?.name,
              ).trim();
              const lineEntitlementIdKey = toStringSafe(
                catalog?.entitlementid ??
                  catalog?.entitlementId ??
                  item?.entitlement_id ??
                  item?.entitlementId ??
                  "",
              ).trim();
              const lineIdKey = toStringSafe(
                catalog?.catalogid ??
                  catalog?.catalogId ??
                  catalog?.catalog_id ??
                  catalog?.id ??
                  "",
              ).trim();
              const lineHasConflict =
                hasGlobalSodConflict &&
                primaryConflictingRole &&
                (lineNameKey === primaryConflictingRole ||
                  lineIdKey === primaryConflictingRole ||
                  lineEntitlementIdKey === primaryConflictingRole ||
                  applicationName === primaryConflictingRole);
              if (
                itemIdx < 3 &&
                (hasGlobalSodConflict || primaryConflictingRole) // avoid spam when no SOD at all
              ) {
                console.log("[PendingApprovalDetail][SOD][Line]", {
                  itemIdx,
                  primaryConflictingRole,
                  lineNameKey,
                  lineIdKey,
                  lineEntitlementIdKey,
                  applicationName,
                  matchByName: lineNameKey === primaryConflictingRole,
                  matchByCatalogId: lineIdKey === primaryConflictingRole,
                  matchByEntitlementId:
                    lineEntitlementIdKey === primaryConflictingRole,
                  matchByApplicationName:
                    applicationName === primaryConflictingRole,
                  lineHasConflict,
                });
              }
              const hasTrainingCheck = (() => {
                const raw =
                  catalog?.training_code ??
                  catalog?.trainingCode ??
                  item?.training_code ??
                  item?.trainingCode;
                const arr = Array.isArray(raw) ? raw : [];
                if (arr.length === 0) return false;
                const first = arr[0] as Record<string, unknown>;
                return !!toStringSafe(first?.code).trim();
              })();

              const requestedItemId = toStringSafe(
                item?.requested_itemid ??
                  item?.requestedItemId ??
                  item?.requesteditemid ??
                  item?.requestedItemid ??
                  "",
              );
              const entitlementId = toStringSafe(
                catalog?.entitlementid ??
                  catalog?.entitlementId ??
                  item?.entitlement_id ??
                  item?.entitlementId ??
                  item?.entity_id ??
                  item?.entityId ??
                  item?.lineItemId ??
                  item?.line_item_id ??
                  item?.itemId ??
                  item?.item_id ??
                  item?.id ??
                  "",
              );

              const catalogId = toStringSafe(
                catalog?.catalogid ??
                  catalog?.catalogId ??
                  catalog?.catalog_id ??
                  catalog?.id ??
                  "",
              );

              const matchedAiRecommendation =
                aiRecommendations.find((rec) => {
                  const recRequestedItemId = toStringSafe(
                    rec?.requested_itemid ?? rec?.requestedItemId,
                  ).trim();
                  const recLineItemId = toStringSafe(
                    rec?.lineitemid ?? rec?.lineItemId,
                  ).trim();
                  const recEntitlementId = toStringSafe(
                    rec?.entitlement?.entitlement_id ??
                      rec?.entitlement?.entitlementId,
                  ).trim();
                  return (
                    (requestedItemId &&
                      recRequestedItemId &&
                      requestedItemId === recRequestedItemId) ||
                    (catalogId &&
                      recLineItemId &&
                      catalogId === recLineItemId) ||
                    (entitlementId &&
                      recEntitlementId &&
                      entitlementId === recEntitlementId)
                  );
                }) ?? aiRecommendations[0];

              const peerSummaryMessages = Array.isArray(
                matchedAiRecommendation?.peer_analysis?.summary,
              )
                ? matchedAiRecommendation.peer_analysis.summary
                    .map((entry: any) => toInsightMessage(entry?.message))
                    .filter(Boolean)
                    .join(" ")
                : null;

              return {
                lineItemId: requestedItemId || catalogId || entitlementId,
                catalogId,
                entitlementId,
                name: lineName,
                displayName: lineName,
                applicationName,
                type: lineType,
                startDate,
                endDate,
                comments: "",
                hasConflict: lineHasConflict,
                hasInfoIcon:
                  String(catalog.privileged ?? "").toLowerCase() === "yes" ||
                  riskLevel.startsWith("high"),
                hasHighRisk: riskLevel.startsWith("high"),
                hasTrainingCheck,
                beneficiaryAnalysis:
                  toInsightMessage(
                    matchedAiRecommendation?.beneficiary_analysis?.message ??
                      matchedAiRecommendation?.beneficiary_analysis ??
                      item?.beneficiary_analysis ??
                      item?.beneficiaryAnalysis ??
                      catalog?.beneficiary_analysis ??
                      catalog?.beneficiaryAnalysis,
                  ) ?? undefined,
                contextualRisk:
                  toInsightMessage(
                    matchedAiRecommendation?.contextual_risk?.message ??
                      matchedAiRecommendation?.contextual_risk ??
                      item?.contextual_risk ??
                      item?.contextualRisk ??
                      catalog?.contextual_risk ??
                      catalog?.contextualRisk,
                  ) ?? undefined,
                riskSensitivityAnalysis:
                  toInsightMessage(
                    matchedAiRecommendation?.risk_sensitivity_analysis
                      ?.message ??
                      matchedAiRecommendation?.risk_sensitivity_analysis ??
                      item?.risk_sensitivity_analysis ??
                      item?.riskSensitivityAnalysis ??
                      catalog?.risk_sensitivity_analysis ??
                      catalog?.riskSensitivityAnalysis,
                  ) ?? undefined,
                peerAnalysis:
                  toInsightMessage(
                    peerSummaryMessages ??
                      matchedAiRecommendation?.peer_analysis?.message ??
                      matchedAiRecommendation?.peer_analysis ??
                      item?.peer_analysis ??
                      item?.peerAnalysis ??
                      catalog?.peer_analysis ??
                      catalog?.peerAnalysis,
                  ) ?? undefined,
              };
            },
          );

          const reviewerId = toStringSafe(
            row.assignee_id ??
              row.assigneeId ??
              row.reviewer_id ??
              row.reviewerId ??
              "f558e3b2-348b-4ff3-be4c-a3c5dc8b5a91",
          );
          const taskIdRaw =
            row.task_id ?? row.taskId ?? row.taskid ?? row.id ?? requestId;
          const numericTaskId = Number(taskIdRaw);
          const taskId =
            Number.isFinite(numericTaskId) && taskIdRaw !== ""
              ? numericTaskId
              : toStringSafe(taskIdRaw);
          const fallbackEntitlementId = toStringSafe(
            row.entitlement_id ??
              row.entitlementId ??
              row.entity_id ??
              row.entityId ??
              row.certification_id ??
              row.certificationId ??
              row.cert_id ??
              row.certId ??
              "",
          );

          const normalizedLineItems =
            lineItems.length > 0
              ? lineItems
              : [
                  {
                    lineItemId: toStringSafe(
                      row.requested_itemid ??
                        row.requestedItemId ??
                        row.requesteditemid ??
                        row.requestedItemid ??
                        row.entitlement_id ??
                        row.entitlementId ??
                        row.entity_id ??
                        row.entityId ??
                        row.lineItemId ??
                        row.line_item_id ??
                        row.item_id ??
                        "",
                    ),
                    catalogId: toStringSafe(
                      row.catalog_id ??
                        row.catalogId ??
                        row.catalogid ??
                        row.id ??
                        "",
                    ),
                    entitlementId: toStringSafe(
                      row.entitlement_id ??
                        row.entitlementId ??
                        row.entity_id ??
                        row.entityId ??
                        "",
                    ),
                    name: toStringSafe(
                      row.entity_name ?? row.entityName ?? "Requested Access",
                    ),
                    displayName: toStringSafe(
                      row.entity_name ?? row.entityName ?? "Requested Access",
                    ),
                    applicationName: toStringSafe(
                      row.application_name ?? row.applicationName ?? "",
                    ),
                    type: toStringSafe(
                      row.entity_type ?? row.entityType ?? "Entitlement",
                    ),
                    startDate: "",
                    endDate: "",
                    comments: "",
                    hasConflict: (() => {
                      if (!hasGlobalSodConflict || !primaryConflictingRole)
                        return false;
                      const nameKey = toStringSafe(
                        row.entity_name ?? row.entityName ?? "Requested Access",
                      ).trim();
                      const idKey = toStringSafe(
                        row.entitlement_id ??
                          row.entitlementId ??
                          row.entity_id ??
                          row.entityId ??
                          "",
                      ).trim();
                      return (
                        nameKey === primaryConflictingRole ||
                        idKey === primaryConflictingRole
                      );
                    })(),
                    hasInfoIcon: false,
                    hasHighRisk: false,
                    hasTrainingCheck: (() => {
                      const raw = row.training_code ?? row.trainingCode;
                      const arr = Array.isArray(raw) ? raw : [];
                      if (arr.length === 0) return false;
                      const first = arr[0] as Record<string, unknown>;
                      return !!toStringSafe(first?.code).trim();
                    })(),
                  },
                ];

          // Read server decisions so refreshed page can render filled action buttons.
          const decisionJson = toObjectSafe(
            row.decision_json ?? row.decisionJson ?? row.decisionjson ?? {},
          );
          const decisionLineItems = toArraySafe(
            decisionJson.lineItems ?? decisionJson.lineitems,
          );

          const decisionActionByLineItemId: Record<
            string,
            "approve" | "reject" | "consulted"
          > = {};
          const decisionActionByCatalogId: Record<
            string,
            "approve" | "reject" | "consulted"
          > = {};

          decisionLineItems.forEach((item) => {
            const actionRaw = toStringSafe(
              item?.ACTION ?? item?.action ?? item?.Action,
            )
              .trim()
              .toUpperCase();
            const mappedAction =
              actionRaw === "APPROVE"
                ? "approve"
                : actionRaw === "REJECT" || actionRaw === "REVOKE"
                  ? "reject"
                  : actionRaw === "CONSULTED"
                    ? "consulted"
                    : null;
            if (!mappedAction) return;

            const decisionLineItemId = normalizeId(
              item?.lineItemId ?? item?.line_item_id,
            );
            const decisionCatalogId = normalizeId(
              item?.catalogId ?? item?.catalogid ?? item?.catalog_id,
            );

            if (decisionLineItemId) {
              decisionActionByLineItemId[decisionLineItemId] = mappedAction;
            }
            if (decisionCatalogId) {
              decisionActionByCatalogId[decisionCatalogId] = mappedAction;
            }
          });

          const initialLineItemActions: Record<
            string,
            "approve" | "reject" | null
          > = {};
          const baselineLineItemActions: Record<
            string,
            "approve" | "reject" | "consulted" | null
          > = {};
          normalizedLineItems.forEach((lineItem, idx) => {
            const byLineItemId =
              decisionActionByLineItemId[normalizeId(lineItem.lineItemId)];
            const byCatalogId =
              decisionActionByCatalogId[normalizeId(lineItem.catalogId)];
            const baselineAction = byLineItemId ?? byCatalogId ?? null;
            baselineLineItemActions[String(idx)] = baselineAction;
            initialLineItemActions[String(idx)] =
              baselineAction === "approve" || baselineAction === "reject"
                ? baselineAction
                : null;
          });

          const durationDays = createdOnRaw
            ? Math.max(
                0,
                Math.round(
                  (Date.now() - new Date(String(createdOnRaw)).getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              )
            : undefined;

          return {
            id: requestId,
            taskId,
            reviewerId,
            fallbackEntitlementId: fallbackEntitlementId || requestId,
            requesterName,
            beneficiaryName,
            durationDays,
            details: {
              dateCreated: createdOn,
              type: toStringSafe(row.request_type ?? row.type ?? "Entitlement"),
              justification,
            },
            lineItems: normalizedLineItems,
            initialLineItemActions,
            baselineLineItemActions,
            sodPolicyDetails,
            sodSeverity,
            sodConflictingRoles,
          } as PendingApprovalDetail;
        });

        const routeId = normalizeId(id);
        const matched = mapped.find((row) => normalizeId(row.id) === routeId);
        setRequest(matched ?? null);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Failed to load request.",
        );
        setRequest(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!request?.lineItems?.length) return;
    const defaults: Record<string, boolean> = {};
    request.lineItems.forEach((_, idx) => {
      defaults[String(idx)] = true;
    });
    setExpandedLineItems(defaults);
    const initialActions = request.initialLineItemActions ?? {};
    setLineItemActions(initialActions);
    setBaselineLineItemActions(request.baselineLineItemActions ?? {});
  }, [request]);

  const openCommentModal = (
    e: React.MouseEvent | null,
    lineItemKey: string,
  ) => {
    e?.stopPropagation();
    setCommentModalItemKey(lineItemKey);
    setCommentDraft(lineItemComments[lineItemKey] ?? "");
    setCommentCategory("");
    setCommentSubcategory("");
    setIsCommentDropdownOpen(false);
  };

  const closeCommentModal = () => {
    setCommentModalItemKey(null);
    setCommentDraft("");
    setCommentCategory("");
    setCommentSubcategory("");
    setIsCommentDropdownOpen(false);
  };

  const handleLineItemAction = async (
    lineItemKey: string,
    action: "approve" | "reject",
  ) => {
    if (!request) return;
    const lineItem = request.lineItems[Number(lineItemKey)];
    if (!lineItem) return;

    const currentAction = lineItemActions[lineItemKey] ?? null;
    if (currentAction === action) {
      setLineItemActions((prev) => ({ ...prev, [lineItemKey]: null }));
      return;
    }

    setLineItemLoading((prev) => ({ ...prev, [lineItemKey]: true }));
    setLineItemError((prev) => ({ ...prev, [lineItemKey]: null }));

    try {
      const justification =
        lineItemComments[lineItemKey] ||
        (action === "approve" ? "Approved via UI" : "Revoked via UI");
      setLineItemActions((prev) => ({ ...prev, [lineItemKey]: action }));
      setLineItemComments((prev) => {
        const next = { ...prev, [lineItemKey]: justification };
        if (id) saveRequesterCommentsToStorage(id, next);
        return next;
      });
    } catch (err: any) {
      console.error(`Failed to ${action} line item:`, err);
      setLineItemError((prev) => ({
        ...prev,
        [lineItemKey]: err?.message || `Failed to ${action}`,
      }));
    } finally {
      setLineItemLoading((prev) => ({ ...prev, [lineItemKey]: false }));
    }
  };

  const saveComment = async () => {
    if (!commentModalItemKey || !commentDraft.trim() || !request) return;

    if (!request.lineItems[Number(commentModalItemKey)]) return;

    setLineItemLoading((prev) => ({ ...prev, [commentModalItemKey]: true }));
    setLineItemError((prev) => ({ ...prev, [commentModalItemKey]: null }));

    try {
      setLineItemComments((prev) => {
        const next = { ...prev, [commentModalItemKey]: commentDraft.trim() };
        saveRequesterCommentsToStorage(id, next);
        return next;
      });
      closeCommentModal();
    } catch (err: any) {
      console.error("Failed to save comment:", err);
      setLineItemError((prev) => ({
        ...prev,
        [commentModalItemKey]: err?.message || "Failed to save comment",
      }));
    } finally {
      setLineItemLoading((prev) => ({
        ...prev,
        [commentModalItemKey!]: false,
      }));
    }
  };

  const pendingActionEntries = useMemo(
    () =>
      Object.entries(lineItemActions).filter(
        ([lineItemKey, action]) =>
          (action === "approve" || action === "reject") &&
          action !==
            (baselineLineItemActions[lineItemKey] === "approve" ||
            baselineLineItemActions[lineItemKey] === "reject"
              ? baselineLineItemActions[lineItemKey]
              : null),
      ) as Array<[string, "approve" | "reject"]>,
    [lineItemActions, baselineLineItemActions],
  );

  const pendingActionCount = pendingActionEntries.length;

  const handleSubmitActions = async () => {
    if (!request || pendingActionCount === 0 || submitLoading) return;

    setSubmitLoading(true);
    setSubmitError(null);

    try {
      const selectedActionByKey = new Map<string, "approve" | "reject">(
        pendingActionEntries,
      );

      const lineItemsPayload = request.lineItems.map((lineItem, idx) => {
        const key = String(idx);
        const selectedAction = selectedActionByKey.get(key);
        const baselineAction = baselineLineItemActions[key] ?? null;
        const effectiveAction = selectedAction ?? baselineAction;
        const parsedLineItemId = Number(lineItem.lineItemId);

        return {
          catalogId: lineItem.catalogId || lineItem.entitlementId || null,
          lineItemId: Number.isFinite(parsedLineItemId)
            ? parsedLineItemId
            : lineItem.lineItemId,
          ...(effectiveAction
            ? {
                ACTION:
                  effectiveAction === "approve"
                    ? "APPROVE"
                    : effectiveAction === "reject"
                      ? "REJECT"
                      : "CONSULTED",
                // Only send comments when the user explicitly staged a new action
                // for this line item, so existing server comments are preserved.
                ...(selectedAction
                  ? {
                      comments:
                        lineItemComments[key]?.trim() ||
                        (effectiveAction === "approve"
                          ? "Approved via UI"
                          : "Revoked via UI"),
                    }
                  : {}),
              }
            : {}),
          entitlementName: null,
        };
      });

      const allItemsActioned = request.lineItems.every((_, idx) => {
        const key = String(idx);
        const currentAction = selectedActionByKey.get(key);
        const baselineAction = baselineLineItemActions[key] ?? null;
        return Boolean(currentAction ?? baselineAction);
      });

      const payload = {
        taskid: request.taskId ?? request.id,
        overallAction: allItemsActioned ? "APPROVE" : "",
        comments: "",
        lineItems: lineItemsPayload,
      };

      const response = await fetch(
        `https://preview.keyforge.ai/workflow/api/v1/ACMECOM/approveraction/${request.reviewerId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error(`Approver action failed (${response.status})`);
      }

      setLineItemActions({});
      if (allItemsActioned) {
        router.push("/access-request/pending-approvals");
        return;
      }
      window.location.reload();
    } catch (err: any) {
      console.error("Failed to submit staged actions:", err);
      setSubmitError(err?.message || "Failed to submit actions");
    } finally {
      setSubmitLoading(false);
    }
  };

  const openInsightsSidebarForLineItem = useCallback(
    (lineItemKey: string) => {
      if (!request) return;
      const lineItem = request.lineItems[Number(lineItemKey)];
      if (!lineItem) return;

      const selectedAction = lineItemActions[lineItemKey] ?? null;
      const isLockedByServer =
        (baselineLineItemActions[lineItemKey] ?? null) !== null;
      const approveFilled = selectedAction === "approve";
      const rejectFilled = selectedAction === "reject";
      const isItemLoading = lineItemLoading[lineItemKey] ?? false;
      const isActionsDisabled = isItemLoading || isLockedByServer;

      openSidebar(
        <div className="space-y-2">
          <div className="rounded border border-gray-200 border-l-4 border-l-sky-500 bg-sky-50/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">
              Beneficiary Analysis
            </p>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
              {lineItem.beneficiaryAnalysis ? (
                lineItem.beneficiaryAnalysis
              ) : (
                <span className="italic text-gray-500">
                  No beneficiary analysis available.
                </span>
              )}
            </p>
          </div>

          <div className="rounded border border-gray-200 border-l-4 border-l-rose-600 bg-rose-50/50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-800">
              Contextual Risk
            </p>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
              {lineItem.contextualRisk ? (
                lineItem.contextualRisk
              ) : (
                <span className="italic text-gray-500">
                  No contextual risk details available.
                </span>
              )}
            </p>
          </div>

          <div className="rounded border border-gray-200 border-l-4 border-l-amber-500 bg-amber-50/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
              Risk Sensitivity Analysis
            </p>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
              {lineItem.riskSensitivityAnalysis ? (
                lineItem.riskSensitivityAnalysis
              ) : (
                <span className="italic text-gray-500">
                  No risk sensitivity analysis available.
                </span>
              )}
            </p>
          </div>

          <div className="rounded border border-gray-200 border-l-4 border-l-indigo-500 bg-indigo-50/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
              Peer Analysis
            </p>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
              {lineItem.peerAnalysis ? (
                lineItem.peerAnalysis
              ) : (
                <span className="italic text-gray-500">
                  No peer analysis available.
                </span>
              )}
            </p>
          </div>

          <div className="rounded border border-gray-200 border-l-4 border-l-blue-600 bg-blue-50/50 p-2">
            <h3 className="text-xs font-semibold text-gray-800">
              Should this user have this access?
            </h3>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                title={approveFilled ? "Undo Approve" : "Approve"}
                aria-label="Approve"
                disabled={isActionsDisabled}
                onClick={() => handleLineItemAction(lineItemKey, "approve")}
                className={`p-1 rounded flex items-center justify-center ${isActionsDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div className="relative inline-flex items-center justify-center w-8 h-8">
                  <CircleCheck
                    color="#1c821cff"
                    strokeWidth="1"
                    size="32"
                    fill={approveFilled ? "#1c821cff" : "none"}
                  />
                  {approveFilled && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      className="absolute pointer-events-none"
                      style={{
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <path
                        d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
                        fill="#ffffff"
                      />
                    </svg>
                  )}
                </div>
              </button>
              <button
                type="button"
                title={rejectFilled ? "Undo Reject" : "Reject"}
                aria-label="Reject"
                disabled={isActionsDisabled}
                onClick={() => handleLineItemAction(lineItemKey, "reject")}
                className={`p-1 rounded flex items-center justify-center ${isActionsDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div className="relative inline-flex items-center justify-center w-8 h-8">
                  <CircleX
                    color="#FF2D55"
                    strokeWidth="1"
                    size="32"
                    fill={rejectFilled ? "#FF2D55" : "none"}
                  />
                  {rejectFilled && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      className="absolute pointer-events-none"
                      style={{
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <path
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                        fill="#ffffff"
                      />
                    </svg>
                  )}
                </div>
              </button>
              <button
                type="button"
                title="Requester comment"
                aria-label="Requester comment"
                disabled={isItemLoading}
                onClick={() => openCommentModal(null, lineItemKey)}
                className={`p-1 rounded flex items-center justify-center ${isItemLoading ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 32 32"
                  className="cursor-pointer hover:opacity-80"
                >
                  <path
                    d="M0.700195 0V19.5546H3.5802V25.7765C3.57994 25.9525 3.62203 26.1247 3.70113 26.2711C3.78022 26.4176 3.89277 26.5318 4.02449 26.5992C4.15621 26.6666 4.30118 26.6842 4.44101 26.6498C4.58085 26.6153 4.70926 26.5304 4.80996 26.4058C6.65316 24.1232 10.3583 19.5546 10.3583 19.5546H25.1802V0H0.700195ZM2.1402 1.77769H23.7402V17.7769H9.76212L5.0202 23.6308V17.7769H2.1402V1.77769ZM5.0202 5.33307V7.11076H16.5402V5.33307H5.0202ZM26.6202 5.33307V7.11076H28.0602V23.11H25.1802V28.9639L20.4383 23.11H9.34019L7.9002 24.8877H19.8421C19.8421 24.8877 23.5472 29.4563 25.3904 31.7389C25.4911 31.8635 25.6195 31.9484 25.7594 31.9828C25.8992 32.0173 26.0442 31.9997 26.1759 31.9323C26.3076 31.8648 26.4202 31.7507 26.4993 31.6042C26.5784 31.4578 26.6204 31.2856 26.6202 31.1096V24.8877H29.5002V5.33307H26.6202ZM5.0202 8.88845V10.6661H10.7802V8.88845H5.0202ZM5.0202 12.4438V14.2215H19.4202V12.4438H5.0202Z"
                    fill="#2684FF"
                  />
                </svg>
              </button>
              <button
                type="button"
                title="Request more information"
                aria-label="Request more information"
                disabled={isActionsDisabled}
                onClick={() => {
                  setInfoRequestItemKey(lineItemKey);
                  setInfoRequestMessage("");
                }}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors ${isActionsDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <RotateCcw className="h-4 w-4 text-blue-600" />
              </button>
            </div>
          </div>
        </div>,
        { widthPx: 500, title: "Insights" },
      );
    },
    [
      request,
      lineItemActions,
      baselineLineItemActions,
      lineItemLoading,
      openSidebar,
    ],
  );

  useEffect(() => {
    if (!activeInsightsLineItemKey) return;
    if (!isRightSidebarOpen || rightSidebarTitle !== "Insights") return;
    openInsightsSidebarForLineItem(activeInsightsLineItemKey);
  }, [
    activeInsightsLineItemKey,
    isRightSidebarOpen,
    rightSidebarTitle,
    lineItemActions,
    baselineLineItemActions,
    lineItemLoading,
    openInsightsSidebarForLineItem,
  ]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Loading request...
        </h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">
          Unable to load request
        </h1>
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Request not found
        </h1>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 z-10 print:hidden p-0 m-0">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center justify-center pr-8 m-0 border-0 bg-transparent text-gray-600 shadow-none hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
          title="Print page"
          aria-label="Print page"
        >
          <Printer className="h-5 w-5" />
        </button>
      </div>
      <div className="p-6 space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              <h2 className="text-sm font-semibold text-gray-900">
                Request ID: {request.id}
              </h2>
            </div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700 self-end sm:self-auto">
              Request Type:{" "}
              <span className="ml-1 font-semibold">{request.details.type}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
            <div>
              <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                Date Created
              </div>
              <div className="text-gray-900">{request.details.dateCreated}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                Requester
              </div>
              <div className="text-gray-900">{request.requesterName}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                Beneficiary
              </div>
              <div className="text-gray-900">{request.beneficiaryName}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                Justification
              </div>
              <div className="text-gray-900 whitespace-pre-wrap break-words">
                {request.details.justification}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          {request.lineItems.map((lineItem, index) => {
            const lineItemKey = String(index);
            const isItemExpanded = expandedLineItems[lineItemKey] ?? true;
            const actionBtnClass =
              "inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors";
            const selectedAction = lineItemActions[lineItemKey] ?? null;
            const isLockedByServer =
              (baselineLineItemActions[lineItemKey] ?? null) !== null;
            const lockedAction = baselineLineItemActions[lineItemKey] ?? null;
            const approveFilled = selectedAction === "approve";
            const rejectFilled = selectedAction === "reject";
            const isItemLoading = lineItemLoading[lineItemKey] ?? false;
            const isActionsDisabled = isItemLoading || isLockedByServer;
            const itemError = lineItemError[lineItemKey] ?? null;
            const effectiveComment = lineItemComments[lineItemKey] ?? "";

            return (
              <div
                key={lineItemKey}
                className="border border-gray-200 rounded-lg bg-gray-50"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setExpandedLineItems((prev) => ({
                      ...prev,
                      [lineItemKey]: !(prev[lineItemKey] ?? true),
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedLineItems((prev) => ({
                        ...prev,
                        [lineItemKey]: !(prev[lineItemKey] ?? true),
                      }));
                    }
                  }}
                  className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 text-left hover:bg-gray-100 transition-colors cursor-pointer"
                  aria-expanded={isItemExpanded}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {lineItem.name}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {lineItem.hasHighRisk && (
                        <span className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-medium border border-red-300 bg-red-50 text-red-600">
                          High Risk
                        </span>
                      )}
                      <span className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-medium border border-blue-300 bg-blue-50 text-blue-600">
                        {lineItem.applicationName || "No Application"}
                      </span>
                      {lineItem.hasTrainingCheck && (
                        <span className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-medium border border-emerald-300 bg-emerald-50 text-emerald-600">
                          Training Check
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 relative">
                    {lineItem.hasConflict && request.sodPolicyDetails && (
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const details = request.sodPolicyDetails || {};
                            const severity = (
                              request.sodSeverity || ""
                            ).toUpperCase();
                            const severityColorClasses =
                              severity === "HIGH"
                                ? "bg-red-100 text-red-800 border-red-300"
                                : severity === "MEDIUM"
                                  ? "bg-amber-50 text-amber-800 border-amber-300"
                                  : "bg-gray-100 text-gray-800 border-gray-300";
                            openSidebar(
                              <div className="space-y-4 text-sm text-gray-900 bg-slate-50 -m-4 p-4 min-h-full">
                                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3 text-sm">
                                  <div className="space-y-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 block">
                                      Policy Name
                                    </span>
                                    <span className="font-semibold">
                                      {String(
                                        details["Policy Name"] ??
                                          details["SOD Policy ID"] ??
                                          "-",
                                      )}
                                    </span>
                                  </div>

                                  {severity && (
                                    <div className="space-y-1">
                                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 block">
                                        Severity
                                      </span>
                                      <span
                                        className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${severityColorClasses}`}
                                      >
                                        {severity}
                                      </span>
                                    </div>
                                  )}

                                  <div className="space-y-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 block">
                                      SOD Policy ID
                                    </span>
                                    <span>
                                      {String(details["SOD Policy ID"] ?? "-")}
                                    </span>
                                  </div>

                                  <div className="space-y-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 block">
                                      Owner
                                    </span>
                                    <span>
                                      {String(details["Owner"] ?? "-")}
                                    </span>
                                  </div>

                                  <div className="space-y-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 block">
                                      Business Process
                                    </span>
                                    <span>
                                      {String(
                                        details["Business Process"] ?? "-",
                                      )}
                                    </span>
                                  </div>

                                  <div className="space-y-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 block">
                                      Description
                                    </span>
                                    <p className="leading-relaxed text-gray-800 whitespace-pre-wrap break-words">
                                      {String(details["Description"] ?? "-")}
                                    </p>
                                  </div>
                                </div>
                              </div>,
                              { widthPx: 460, title: "SOD Policy Details" },
                            );
                          }}
                          className="inline-flex items-center px-3 py-1.5 rounded-md text-[11px] font-semibold border border-red-400 bg-red-50 text-red-600"
                        >
                          SOD Policy Violation Detected
                        </button>
                      </div>
                    )}
                    <div className="flex justify-end pr-10">
                      <button
                        type="button"
                        title="AI Insights"
                        aria-label="AI Insights"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveInsightsLineItemKey(lineItemKey);
                          openInsightsSidebarForLineItem(lineItemKey);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                      >
                        <InsightsIcon
                          size={18}
                          className="shrink-0 text-amber-500"
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isLockedByServer ? (
                      <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            lockedAction === "approve"
                              ? "bg-green-100 text-green-700"
                              : lockedAction === "reject"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-sky-100 text-sky-700"
                          }`}
                        >
                          {lockedAction === "approve"
                            ? "Approved"
                            : lockedAction === "reject"
                              ? "Rejected"
                              : "Consulted"}
                        </span>
                        <button
                          type="button"
                          title="View comment"
                          aria-label="View comment"
                          disabled={isItemLoading}
                          onClick={(e) => openCommentModal(e, lineItemKey)}
                          className={`text-xs font-medium text-blue-600 hover:text-blue-700 ${
                            isItemLoading ? "cursor-not-allowed opacity-60" : ""
                          }`}
                        >
                          View comment
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          title={approveFilled ? "Undo Approve" : "Approve"}
                          aria-label="Approve"
                          disabled={isActionsDisabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLineItemAction(lineItemKey, "approve");
                          }}
                          className={`p-1 rounded flex items-center justify-center ${isActionsDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <div className="relative inline-flex items-center justify-center w-8 h-8">
                            <CircleCheck
                              className="cursor-pointer"
                              color="#1c821cff"
                              strokeWidth="1"
                              size="32"
                              fill={approveFilled ? "#1c821cff" : "none"}
                            />
                            {approveFilled && (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                className="absolute pointer-events-none"
                                style={{
                                  left: "50%",
                                  top: "50%",
                                  transform: "translate(-50%, -50%)",
                                }}
                              >
                                <path
                                  d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
                                  fill="#ffffff"
                                />
                              </svg>
                            )}
                          </div>
                        </button>
                        <button
                          type="button"
                          title={rejectFilled ? "Undo Reject" : "Reject"}
                          aria-label="Reject"
                          disabled={isActionsDisabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLineItemAction(lineItemKey, "reject");
                          }}
                          className={`p-1 rounded flex items-center justify-center ${isActionsDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <div className="relative inline-flex items-center justify-center w-8 h-8">
                            <CircleX
                              className="cursor-pointer"
                              color="#FF2D55"
                              strokeWidth="1"
                              size="32"
                              fill={rejectFilled ? "#FF2D55" : "none"}
                            />
                            {rejectFilled && (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                className="absolute pointer-events-none"
                                style={{
                                  left: "50%",
                                  top: "50%",
                                  transform: "translate(-50%, -50%)",
                                }}
                              >
                                <path
                                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                                  fill="#ffffff"
                                />
                              </svg>
                            )}
                          </div>
                        </button>
                        <button
                          type="button"
                          title="Requester comment"
                          aria-label="Requester comment"
                          disabled={isItemLoading}
                          onClick={(e) => openCommentModal(e, lineItemKey)}
                          className={`p-1 rounded flex items-center justify-center ${isItemLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <svg
                            width="30"
                            height="30"
                            viewBox="0 0 32 32"
                            className="cursor-pointer hover:opacity-80"
                          >
                            <path
                              d="M0.700195 0V19.5546H3.5802V25.7765C3.57994 25.9525 3.62203 26.1247 3.70113 26.2711C3.78022 26.4176 3.89277 26.5318 4.02449 26.5992C4.15621 26.6666 4.30118 26.6842 4.44101 26.6498C4.58085 26.6153 4.70926 26.5304 4.80996 26.4058C6.65316 24.1232 10.3583 19.5546 10.3583 19.5546H25.1802V0H0.700195ZM2.1402 1.77769H23.7402V17.7769H9.76212L5.0202 23.6308V17.7769H2.1402V1.77769ZM5.0202 5.33307V7.11076H16.5402V5.33307H5.0202ZM26.6202 5.33307V7.11076H28.0602V23.11H25.1802V28.9639L20.4383 23.11H9.34019L7.9002 24.8877H19.8421C19.8421 24.8877 23.5472 29.4563 25.3904 31.7389C25.4911 31.8635 25.6195 31.9484 25.7594 31.9828C25.8992 32.0173 26.0442 31.9997 26.1759 31.9323C26.3076 31.8648 26.4202 31.7507 26.4993 31.6042C26.5784 31.4578 26.6204 31.2856 26.6202 31.1096V24.8877H29.5002V5.33307H26.6202ZM5.0202 8.88845V10.6661H10.7802V8.88845H5.0202ZM5.0202 12.4438V14.2215H19.4202V12.4438H5.0202Z"
                              fill="#2684FF"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Request more information"
                          aria-label="Request more information"
                          disabled={isActionsDisabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            setInfoRequestItemKey(lineItemKey);
                            setInfoRequestMessage("");
                          }}
                          className={`${actionBtnClass} ${isActionsDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <RotateCcw className="h-4 w-4 text-blue-600" />
                        </button>
                      </>
                    )}
                    <span className="text-gray-500 ml-1" aria-hidden>
                      {isItemExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </div>
                </div>

                {isItemExpanded && (
                  <div className="px-4 py-3 space-y-3 text-sm">
                    {itemError && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
                        {itemError}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                          Requester Comment
                        </div>
                        <div className="text-gray-900 whitespace-pre-wrap break-words">
                          {request.details.justification || "No justification provided."}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                          Attachment
                        </div>
                        <span className="text-gray-500 text-sm">
                          No Attachment
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {pendingActionCount > 0 && (
          <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
            <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-lg">
              <span className="text-sm font-medium text-gray-700">
                {pendingActionCount} action{pendingActionCount === 1 ? "" : "s"}{" "}
                selected
              </span>
              <button
                type="button"
                onClick={handleSubmitActions}
                disabled={submitLoading}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold text-white transition-colors ${
                  submitLoading
                    ? "cursor-not-allowed bg-blue-400"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {submitLoading ? "Submitting..." : "Submit"}
              </button>
            </div>
            {submitError && (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                {submitError}
              </div>
            )}
          </div>
        )}

        {commentModalItemKey !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-3">
            <div
              className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const isCommentReadOnly =
                  commentModalItemKey !== null &&
                  (baselineLineItemActions[commentModalItemKey] ?? null) !==
                    null;
                return (
                  <>
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Requester Comment
                      </h3>
                    </div>

                    {!isCommentReadOnly && (
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Comment Suggestions
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-left focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white flex items-center justify-between"
                            onClick={() =>
                              setIsCommentDropdownOpen(!isCommentDropdownOpen)
                            }
                          >
                            <span className="text-gray-500">
                              {commentSubcategory
                                ? `${commentCategory} - ${commentSubcategory}`
                                : "Select a comment suggestion..."}
                            </span>
                            <svg
                              className={`w-4 h-4 transition-transform ${isCommentDropdownOpen ? "rotate-180" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </button>

                          {isCommentDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
                              <div className="p-2 space-y-2">
                                <div>
                                  <div className="flex items-center p-1">
                                    <div className="w-3 h-3 rounded-full border-2 mr-2 flex items-center justify-center border-green-500 bg-green-500">
                                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                    </div>
                                    <span className="text-xs font-medium text-gray-900">
                                      Approve
                                    </span>
                                  </div>
                                  <div className="ml-5 mt-1 space-y-1">
                                    {commentOptions["Approve"].map(
                                      (option, idx) => (
                                        <div
                                          key={idx}
                                          className="text-xs text-gray-600 cursor-pointer hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
                                          onClick={() => {
                                            setCommentCategory("Approve");
                                            setCommentSubcategory(option);
                                            setCommentDraft(
                                              `Approve - ${option}`,
                                            );
                                            setIsCommentDropdownOpen(false);
                                          }}
                                        >
                                          {option}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center p-1">
                                    <div className="w-3 h-3 rounded-full border-2 mr-2 flex items-center justify-center border-red-500 bg-red-500">
                                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                    </div>
                                    <span className="text-xs font-medium text-gray-900">
                                      Revoke
                                    </span>
                                  </div>
                                  <div className="ml-5 mt-1 space-y-1">
                                    {commentOptions["Revoke"].map(
                                      (option, idx) => (
                                        <div
                                          key={idx}
                                          className="text-xs text-gray-600 cursor-pointer hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
                                          onClick={() => {
                                            setCommentCategory("Revoke");
                                            setCommentSubcategory(option);
                                            setCommentDraft(
                                              `Revoke - ${option}`,
                                            );
                                            setIsCommentDropdownOpen(false);
                                          }}
                                        >
                                          {option}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Requester Comment
                      </label>
                      <textarea
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder={
                          commentCategory
                            ? `Enter additional details for ${commentCategory.toLowerCase()}...`
                            : "Select an action type and reason, or enter your comment here..."
                        }
                        className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                        readOnly={isCommentReadOnly}
                      />
                    </div>

                    {commentModalItemKey &&
                      lineItemError[commentModalItemKey] && (
                        <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
                          {lineItemError[commentModalItemKey]}
                        </div>
                      )}

                    <div className="flex justify-end items-center gap-3">
                      <button
                        onClick={closeCommentModal}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors min-w-[72px]"
                      >
                        {isCommentReadOnly ? "Close" : "Cancel"}
                      </button>
                      {!isCommentReadOnly && (
                        <button
                          onClick={saveComment}
                          disabled={
                            !commentDraft.trim() ||
                            (commentModalItemKey
                              ? (lineItemLoading[commentModalItemKey] ?? false)
                              : false)
                          }
                          className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 transition-colors min-w-[72px] ${
                            commentDraft.trim()
                              ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                          }`}
                        >
                          {commentModalItemKey &&
                          (lineItemLoading[commentModalItemKey] ?? false)
                            ? "Saving..."
                            : "Save"}
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {infoRequestItemKey !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-3">
            <div
              className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Request More Information
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Send a message to the requester for additional details.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={infoRequestMessage}
                  onChange={(e) => setInfoRequestMessage(e.target.value)}
                  placeholder="Please provide more information about this access request..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              {lineItemError[infoRequestItemKey] && (
                <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
                  {lineItemError[infoRequestItemKey]}
                </div>
              )}

              <div className="flex justify-end items-center gap-3">
                <button
                  onClick={() => {
                    setInfoRequestItemKey(null);
                    setInfoRequestMessage("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors min-w-[72px]"
                >
                  Cancel
                </button>
                <button
                  disabled={!infoRequestMessage.trim() || infoRequestLoading}
                  onClick={async () => {
                    if (
                      !request ||
                      !infoRequestItemKey ||
                      !infoRequestMessage.trim()
                    )
                      return;
                    const lineItem =
                      request.lineItems[Number(infoRequestItemKey)];
                    if (!lineItem) return;

                    setInfoRequestLoading(true);
                    setLineItemError((prev) => ({
                      ...prev,
                      [infoRequestItemKey]: null,
                    }));

                    try {
                      const message = infoRequestMessage.trim();
                      const lineItemsPayload = request.lineItems.map(
                        (lineItem, idx) => {
                          const key = String(idx);
                          const parsedLineItemId = Number(lineItem.lineItemId);

                          const base = {
                            catalogId:
                              lineItem.catalogId ||
                              lineItem.entitlementId ||
                              null,
                            lineItemId: Number.isFinite(parsedLineItemId)
                              ? parsedLineItemId
                              : lineItem.lineItemId,
                            entitlementName: null,
                          };

                          if (key === infoRequestItemKey) {
                            return {
                              ...base,
                              ACTION: "CONSULTED",
                              comments: message,
                            };
                          }

                          const effectiveAction =
                            lineItemActions[key] ??
                            baselineLineItemActions[key] ??
                            null;

                          if (!effectiveAction) return base;

                          return {
                            ...base,
                            ACTION:
                              effectiveAction === "approve"
                                ? "APPROVE"
                                : effectiveAction === "reject"
                                  ? "REJECT"
                                  : "CONSULTED",
                          };
                        },
                      );

                      const payload = {
                        taskid: request.taskId ?? request.id,
                        comments: "",
                        lineItems: lineItemsPayload,
                      };

                      const response = await fetch(
                        `https://preview.keyforge.ai/workflow/api/v1/ACMECOM/approveraction/${request.reviewerId}`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        },
                      );

                      if (!response.ok) {
                        throw new Error(
                          `Approver action failed (${response.status})`,
                        );
                      }

                      setLineItemComments((prev) => {
                        const next = {
                          ...prev,
                          [infoRequestItemKey]: message,
                        };
                        if (id) saveRequesterCommentsToStorage(id, next);
                        return next;
                      });
                      setInfoRequestItemKey(null);
                      setInfoRequestMessage("");
                      window.location.reload();
                    } catch (err: unknown) {
                      console.error("Failed to send info request:", err);
                      setLineItemError((prev) => ({
                        ...prev,
                        [infoRequestItemKey]:
                          err instanceof Error
                            ? err.message
                            : "Failed to send request",
                      }));
                    } finally {
                      setInfoRequestLoading(false);
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 transition-colors min-w-[140px] ${
                    infoRequestMessage.trim() && !infoRequestLoading
                      ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {infoRequestLoading ? "Sending..." : "Send to Requester"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingApprovalDetailPage;
