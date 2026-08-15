"use client";

import React, { useEffect, useState } from "react";
import { FileText, ChevronDown, ChevronUp, Printer } from "lucide-react";
import { getReviewerId } from "@/lib/auth";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import InsightsIcon from "@/components/InsightsIcon";

interface InstanceStep {
  action: string;
  date: string;
  userActor: string;
  status: string;
  sodViolations?: Array<{ message: string; severity: string }>;
  sodClean?: boolean;
  sodStatus?: string;
  trainingWarnings?: Array<{ message: string }>;
  trainingNotRequired?: boolean;
}

interface RequestDetails {
  dateCreated: string;
  type: string;
  name: string;
  justification: string;
  startDate: string;
  endDate: string;
  globalComments?: string;
}

interface RequestLineItem {
  name: string;
  displayName: string;
  applicationName: string;
  type: string;
  startDate: string;
  endDate: string;
  comments: string;
  hasHighRisk?: boolean;
  hasTrainingCheck?: boolean;
  hasConflict?: boolean;
  canWithdraw?: boolean;
  canProvideAdditionalDetails?: boolean;
  instanceSteps: InstanceStep[];
  beneficiaryAnalysis?: string;
  contextualRisk?: string;
  riskSensitivityAnalysis?: string;
  peerAnalysis?: string;
}

interface SodPolicyDetails {
  Owner?: string;
  Description?: string;
  "Business Process"?: string;
  "SOD Policy ID"?: string;
  "Policy Name"?: string;
  [key: string]: unknown;
}

interface Request {
  id: string | number;
  requestId: string;
  wfInstanceId: string;
  lookupKeys: string[];
  beneficiaryName: string;
  requesterName: string;
  displayName: string;
  entityType: string;
  daysOpen: number;
  status: string;
  canWithdraw?: boolean;
  canProvideAdditionalDetails?: boolean;
  details?: RequestDetails;
  lineItems: RequestLineItem[];
  instanceSteps: InstanceStep[];
  sodPolicyDetails?: SodPolicyDetails | null;
  sodSeverity?: string | null;
  sodConflictingRoles?: string[];
}

const toInsightMessage = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const fromMessage = String(obj.message ?? obj.value ?? "").trim();
    if (fromMessage) return fromMessage;
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (entry && typeof entry === "object") {
          const obj = entry as Record<string, unknown>;
          return String(obj.message ?? obj.value ?? "").trim();
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
    return value.filter((entry) => entry && typeof entry === "object") as Record<string, any>[];
  }
  if (value && typeof value === "object") {
    return [value as Record<string, any>];
  }
  return [];
};

const normalizeId = (value: unknown): string => String(value ?? "").trim().toLowerCase();
const TrackRequestDetailPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = React.use(params);
  const { openSidebar } = useRightSidebar();
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLineItems, setExpandedLineItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const reviewerId = getReviewerId();
    if (!reviewerId) {
      setError("Reviewer ID not found.");
      return;
    }

    const url = "https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery";
    setLoading(true);
    setError(null);

    const body = {
      query: "select * from vw_access_request_full_json where requested_by_user_id = ?::uuid",
      parameters: [reviewerId],
    };

    const formatDate = (value: string | null | undefined): string => {
      if (!value) return "";
      const raw = String(value).trim();

      // Handles YYYY-MM-DD and ISO datetime starting with YYYY-MM-DD.
      const isoPrefixMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoPrefixMatch) {
        const [, yyyy, mm, dd] = isoPrefixMatch;
        return `${mm}/${dd}/${yyyy}`;
      }

      // Handles DD-MM-YYYY format if returned by backend.
      const dmyMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})/);
      if (dmyMatch) {
        const [, dd, mm, yyyy] = dmyMatch;
        return `${mm}/${dd}/${yyyy}`;
      }

      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return new Intl.DateTimeFormat("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        }).format(parsed);
      }
      return raw;
    };

    const formatDateTime = (value: string | null | undefined): string => {
      if (!value) return "";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return String(value);
      return new Intl.DateTimeFormat("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(parsed);
    };

    const normalizeStatus = (value: string | null | undefined): string => {
      if (!value) return "";
      return String(value)
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const stepCodeToAction = (code: string | null | undefined): string => {
      const normalized = String(code ?? "").toUpperCase();
      if (normalized === "SOD_CHECK") return "Assigned for SOD Approval";
      if (normalized === "MANAGER_APPROVAL") return "Assigned to User Manager";
      if (normalized === "APP_OWNER_APPROVAL") return "Assigned to App Owner";
      if (normalized === "PROVISION_SCIM") return "Request Fulfillment";
      return normalized ? normalized.replace(/_/g, " ") : "";
    };

    const getTemplateStepOrder = (step: any): number => {
      const raw =
        step?.template_step_id ??
        step?.templateStepId ??
        step?.templatestepid ??
        step?.template_stepid;
      const num = Number(raw);
      return Number.isFinite(num) ? num : Number.POSITIVE_INFINITY;
    };

    const sortStepsByTemplateOrder = (steps: any[]): any[] =>
      [...steps].sort((a, b) => getTemplateStepOrder(a) - getTemplateStepOrder(b));

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        let rawRows: any[] = [];
        if (Array.isArray(data)) rawRows = data;
        else if (Array.isArray((data as any).resultSet)) rawRows = (data as any).resultSet;
        else if (Array.isArray((data as any).rows)) rawRows = (data as any).rows;

        if (!rawRows || rawRows.length === 0) {
          setRequest(null);
          return;
        }
        const isStepLikeObject = (value: any): boolean => {
          if (!value || typeof value !== "object" || Array.isArray(value)) return false;
          const keys = Object.keys(value).map((k) => k.toLowerCase());
          const hasStepIdentity = keys.some((k) =>
            [
              "step_code",
              "stepcode",
              "template_step_id",
              "templatestepid",
              "instance_step_id",
              "instancestepid",
              "step_name",
              "stepname",
            ].includes(k)
          );
          const hasActionAndStatus =
            keys.some((k) => ["action", "action_item", "item_action", "action_name", "actionname"].includes(k)) &&
            keys.some((k) => ["status", "step_status", "stepstatus", "state"].includes(k));
          const looksLikeOutboxEvent =
            keys.includes("event_type") || keys.includes("aggregatetype") || keys.includes("aggregate_type");
          return (hasStepIdentity || hasActionAndStatus) && !looksLikeOutboxEvent;
        };

        const toStepsArray = (value: any): any[] => {
          if (Array.isArray(value)) return value;
          if (!value) return [];

          if (typeof value === "string") {
            try {
              const parsed = JSON.parse(value);
              return toStepsArray(parsed);
            } catch {
              return [];
            }
          }

          if (typeof value === "object") {
            const obj = value as Record<string, unknown>;
            const candidates = [
              obj.instance_steps,
              obj.instancesteps,
              obj.instanceSteps,
              obj.steps,
              obj.workflow_steps,
              obj.workflowSteps,
              obj.data,
              obj.result,
            ];
            for (const candidate of candidates) {
              const arr = toStepsArray(candidate);
              if (arr.length > 0) return arr;
            }
          }

          return [];
        };

        const deepCollectStepArrays = (value: any, maxDepth = 6): any[][] => {
          if (maxDepth < 0 || !value) return [];

          if (Array.isArray(value)) {
            const arrays: any[][] = [];
            const allStepLike = value.length > 0 && value.every((v) => isStepLikeObject(v));
            if (allStepLike) arrays.push(value);
            for (const item of value) {
              arrays.push(...deepCollectStepArrays(item, maxDepth - 1));
            }
            return arrays;
          }

          if (typeof value === "string") {
            try {
              const parsed = JSON.parse(value);
              return deepCollectStepArrays(parsed, maxDepth - 1);
            } catch {
              return [];
            }
          }

          if (typeof value === "object") {
            const obj = value as Record<string, unknown>;
            let arrays: any[][] = [];
            for (const child of Object.values(obj)) {
              arrays = arrays.concat(deepCollectStepArrays(child, maxDepth - 1));
            }
            return arrays;
          }

          return [];
        };

        const pickBestStepArray = (...sources: any[]): any[] => {
          const explicitCandidate = sources
            .map((s) => toStepsArray(s))
            .find((arr) => arr.length > 0 && arr.every((v) => isStepLikeObject(v)));
          if (explicitCandidate) return explicitCandidate;

          let best: any[] = [];
          for (const source of sources) {
            const arrays = deepCollectStepArrays(source);
            for (const arr of arrays) {
              if (arr.length > best.length) best = arr;
            }
          }
          return best;
        };

        const resolveTrackStepActionLabel = (step: any, actionFromCode: string, actionFromFields: string): string => {
          let action = String(actionFromCode ? actionFromCode : actionFromFields).trim();
          const isCustomApproval =
            action.toUpperCase() === "CUSTOM APPROVAL" ||
            String(step?.step_code ?? "")
              .toUpperCase()
              .replace(/_/g, " ") === "CUSTOM APPROVAL";
          if (!isCustomApproval) return action;

          const taskNameRaw =
            step?.task?.name ??
            step?.Task?.name ??
            step?.tasks?.[0]?.name ??
            step?.tasks?.[0]?.Task?.name;
          const taskName =
            typeof taskNameRaw === "string"
              ? taskNameRaw.trim()
              : taskNameRaw != null && taskNameRaw !== ""
                ? String(taskNameRaw).trim()
                : "";
          return taskName || "CUSTOM APPROVAL";
        };

        const mapInstanceSteps = (
          steps: any[],
          trainingValidation?: any,
          sodValidation?: any
        ): InstanceStep[] =>
          steps.map((step) => {
            const actionFromCode = stepCodeToAction(step?.step_code);
            const isTrainingCheckStep = String(step?.step_code ?? "").toUpperCase().includes("TRAINING");
            const trainingStatus = trainingValidation?.status ?? trainingValidation?.Status;
            const trainingWarningsRaw = trainingValidation?.warnings ?? trainingValidation?.Warnings;
            const trainingCompletedNotRequired =
              isTrainingCheckStep &&
              String(trainingStatus ?? "").toUpperCase() === "COMPLETED" &&
              Array.isArray(trainingWarningsRaw) &&
              trainingWarningsRaw.length === 0;
            const trainingWarnings =
              isTrainingCheckStep && Array.isArray(trainingWarningsRaw) && trainingWarningsRaw.length > 0
                ? trainingWarningsRaw.map((w: any) => ({
                    message: String(w?.message ?? w?.Message ?? ""),
                  }))
                : undefined;

            const isSodStep = String(step?.step_code ?? "").toUpperCase().includes("SOD");
            const sodViolationsRaw = sodValidation?.violations ?? sodValidation?.Violations;
            const sodStatusRaw = sodValidation?.status ?? sodValidation?.Status;
            const sodViolations =
              isSodStep && Array.isArray(sodViolationsRaw) && sodViolationsRaw.length > 0
                ? sodViolationsRaw.map((v: any) => ({
                    message: String(v?.message ?? v?.Message ?? ""),
                    severity: String(v?.severity ?? v?.Severity ?? ""),
                  }))
                : undefined;
            const sodClean =
              isSodStep && Array.isArray(sodViolationsRaw) && sodViolationsRaw.length === 0;

            const actionFromFields =
              step?.action ??
              step?.action_item ??
              step?.item_action ??
              step?.actionItem ??
              step?.action_name ??
              step?.actionName ??
              step?.step_name ??
              step?.stepName ??
              step?.name ??
              "";

            return {
            action: resolveTrackStepActionLabel(step, actionFromCode, actionFromFields),
            date: String(
              formatDateTime(
                step?.created_at ??
                  step?.updated_at ??
                  step?.completed_at ??
                  step?.date ??
                  step?.action_date ??
                  step?.actionDate ??
                  step?.createdon ??
                  step?.createdOn ??
                  step?.requestedon ??
                  step?.requestedOn ??
                  step?.timestamp
              )
            ),
            userActor: String(
              step?.tasks?.[0]?.assignee?.display_name ??
                [step?.tasks?.[0]?.assignee?.first_name, step?.tasks?.[0]?.assignee?.last_name]
                  .filter(Boolean)
                  .join(" ") ??
                step?.tasks?.[0]?.assignee?.username ??
                step?.user_actor ??
                step?.userActor ??
                step?.assigned_to ??
                step?.assignedTo ??
                step?.actor ??
                step?.user ??
                step?.performed_by ??
                step?.performedBy ??
                step?.username ??
                ""
            ),
            status: String(
              normalizeStatus(
                step?.status ??
                  step?.tasks?.[0]?.task_status ??
                  step?.tasks?.[0]?.step_state ??
                  step?.step_status ??
                  step?.stepStatus ??
                  step?.state ??
                  step?.current_status ??
                  step?.currentStatus
              )
            ),
            sodViolations,
            sodClean,
            sodStatus: sodClean ? String(sodStatusRaw ?? "") : undefined,
            trainingWarnings,
            trainingNotRequired: trainingCompletedNotRequired,
          };
          });

        const mapped: Request[] = rawRows.map((row) => {
          const requestJson = row.request_json ?? {};
          const sodResults =
            requestJson?.workflow_instance?.context_json?.sodResults ??
            requestJson?.workflowInstance?.context_json?.sodResults ??
            requestJson?.workflow_instance?.contextJson?.sodResults ??
            requestJson?.workflowInstance?.contextJson?.sodResults;
          const hasGlobalSodConflict = Boolean(sodResults?.hasConflict);
          const conflictingRoleNames: string[] = Array.isArray(sodResults?.conflictingRoles)
            ? sodResults.conflictingRoles.map((r: any) => String(r).trim()).filter(Boolean)
            : [];
          const primaryConflictingRole = conflictingRoleNames[0] ?? "";
          const sodPolicyDetails: SodPolicyDetails | null =
            (sodResults?.sodPolicyDetails as SodPolicyDetails | undefined) ?? null;
          const sodSeverity: string | null =
            (typeof sodResults?.severity === "string" ? sodResults.severity : null);
          const sodConflictingRoles: string[] = Array.isArray(sodResults?.conflictingRoles)
            ? sodResults.conflictingRoles.map((r: any) => String(r).trim()).filter(Boolean)
            : [];
          const accessRequest = requestJson.access_request ?? {};
          const requester = accessRequest.requested_by ?? row.requester ?? row.requestedby ?? row.requested_by ?? {};
          const beneficiary = accessRequest.requested_for ?? row.beneficiary ?? {};
          const accessItems: any[] = Array.isArray(requestJson.access_items)
            ? requestJson.access_items
            : Array.isArray(row.itemdetails)
              ? row.itemdetails
              : [];
          const firstItem = accessItems[0] ?? {};
          const catalog = firstItem.catalog ?? {};

          const requesterNameFromObject =
            requester.display_name ||
            requester.displayname ||
            requester.display_name ||
            [requester.firstname, requester.lastname].filter(Boolean).join(" ") ||
            [requester.first_name, requester.last_name].filter(Boolean).join(" ") ||
            requester.username ||
            row.requesterdisplayname ||
            row.requester_display_name ||
            row.requestername ||
            row.requester_name ||
            row.requestedbyname ||
            row.requested_by_name ||
            "";

          const beneficiaryNameFromObject =
            beneficiary.display_name ||
            beneficiary.displayname ||
            [beneficiary.firstname, beneficiary.lastname].filter(Boolean).join(" ") ||
            [beneficiary.first_name, beneficiary.last_name].filter(Boolean).join(" ") ||
            beneficiary.username ||
            "";

          const displayNameFromCatalog =
            catalog.name || catalog.entitlementname || catalog.applicationname || "";

          const entityTypeFromCatalog =
            catalog.type || catalog.entitlementtype || (catalog.metadata?.entitlementType as string) || "";

          const requestedOn: string | undefined =
            accessRequest.created_at ?? row.requestedon ?? row.created_at;
          const raisedOn = formatDate(requestedOn);

          let daysOpen = 0;
          if (requestedOn) {
            const datePart = requestedOn.split(" ")[0] ?? requestedOn;
            const d = new Date(datePart);
            if (!Number.isNaN(d.getTime())) {
              const now = new Date();
              const diffMs = now.getTime() - d.getTime();
              daysOpen = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
            }
          }

          const status: string =
            typeof accessRequest.status === "string" && accessRequest.status.trim()
              ? accessRequest.status
              : typeof row.status === "string" && row.status.trim()
                ? row.status
              : row.isjit
                ? "JIT Request Submitted"
                : "Request Submitted";

          const justification: string =
            (accessRequest.justification as string) ||
            (row.requester_justification as string) ||
            (firstItem.item_comments as string) ||
            "";

          const startDate = firstItem.item_startdate ? formatDate(String(firstItem.item_startdate)) : raisedOn;
          const endDate = firstItem.item_enddate ? formatDate(String(firstItem.item_enddate)) : "";
          const requestJsonStepsRaw = pickBestStepArray(
            requestJson?.instance_steps,
            requestJson?.workflow_instance?.instance_steps,
            requestJson?.workflowInstance?.instance_steps,
            row?.instance_steps,
            requestJson,
            row
          );
          const trainingValidation =
            requestJson?.workflow_instance?.context_json?.validation?.training ??
            requestJson?.workflowInstance?.context_json?.validation?.training ??
            requestJson?.workflow_instance?.contextJson?.validation?.training ??
            requestJson?.workflowInstance?.contextJson?.validation?.training;
          const sodValidation =
            requestJson?.workflow_instance?.context_json?.validation?.sod ??
            requestJson?.workflowInstance?.context_json?.validation?.sod ??
            requestJson?.workflow_instance?.contextJson?.validation?.sod ??
            requestJson?.workflowInstance?.contextJson?.validation?.sod;
          const rowLevelAiRecommendations = toAiRecommendationArray(
            row.ai_recommendation ??
              row.aiRecommendation ??
              requestJson?.ai_recommendation ??
              requestJson?.aiRecommendation ??
              requestJson?.workflow_instance?.context_json?.ai_recommendation ??
              requestJson?.workflowInstance?.context_json?.ai_recommendation ??
              requestJson?.workflow_instance?.contextJson?.ai_recommendation ??
              requestJson?.workflowInstance?.contextJson?.ai_recommendation
          );
          const lineItems: RequestLineItem[] = accessItems.map((item) => {
            const lineCatalog = item?.catalog ?? {};
            const instanceSteps = mapInstanceSteps(
              sortStepsByTemplateOrder(toStepsArray(item?.instance_steps)),
              trainingValidation,
              sodValidation
            );
            const lineDisplayName =
              lineCatalog.name || lineCatalog.entitlementname || lineCatalog.applicationname || "";
            const lineApplicationName =
              lineCatalog.applicationname || lineCatalog.applicationName || lineCatalog.name || "";
            const lineType =
              lineCatalog.type ||
              lineCatalog.entitlementtype ||
              (lineCatalog.metadata?.entitlementType as string) ||
              "Entitlement";
            const lineComments =
              (item?.item_comments as string) || (row.requester_justification as string) || "";
            const lineStartDate = item?.item_startdate ? formatDate(String(item.item_startdate)) : raisedOn;
            const lineEndDate = item?.item_enddate ? formatDate(String(item.item_enddate)) : "";
            const lineRisk = String(lineCatalog.risk ?? "").toLowerCase();
            const lineNameKey = String(lineDisplayName).trim();
            const lineIdKey = String(lineCatalog.catalogId ?? lineCatalog.catalogid ?? "").trim();
            const lineHasConflict = Boolean(
              hasGlobalSodConflict &&
                primaryConflictingRole &&
                (lineNameKey === primaryConflictingRole || lineIdKey === primaryConflictingRole)
            );
            const lineHasTrainingCheck = (() => {
              const raw =
                lineCatalog?.training_code ??
                lineCatalog?.trainingCode ??
                item?.training_code ??
                item?.trainingCode;
              const arr = Array.isArray(raw) ? raw : [];
              if (arr.length === 0) return false;
              const first = arr[0] as Record<string, unknown>;
              const code = String(first?.code ?? "").trim();
              return !!code;
            })();
            const requestedItemId = String(
              item?.requested_itemid ??
                item?.requestedItemId ??
                item?.requesteditemid ??
                ""
            ).trim();
            const catalogId = String(
              lineCatalog?.catalogId ??
                lineCatalog?.catalogid ??
                lineCatalog?.catalog_id ??
                lineCatalog?.id ??
                ""
            ).trim();
            const lineItemId = String(item?.lineitemid ?? item?.lineItemId ?? "").trim();
            const entitlementId = String(
              lineCatalog?.entitlementid ??
                lineCatalog?.entitlementId ??
                item?.entitlement_id ??
                item?.entitlementId ??
                ""
            ).trim();
            const itemLevelAiRecommendations = toAiRecommendationArray(
              item?.ai_recommendation ?? item?.aiRecommendation
            );
            const allAiRecommendations = [
              ...itemLevelAiRecommendations,
              ...rowLevelAiRecommendations,
            ];
            const matchedAiRecommendation =
              allAiRecommendations.find((rec) => {
                const recRequestedItemId = String(
                  rec?.requested_itemid ?? rec?.requestedItemId ?? ""
                ).trim();
                const recLineItemId = String(
                  rec?.lineitemid ?? rec?.lineItemId ?? ""
                ).trim();
                const recEntitlementId = String(
                  rec?.entitlement?.entitlement_id ?? rec?.entitlement?.entitlementId ?? ""
                ).trim();
                const recRequestId = String(rec?.request_id ?? rec?.requestId ?? "").trim();
                const rowRequestId = String(
                  accessRequest.id ?? row.request_id ?? row.requestid ?? row.id ?? ""
                ).trim();
                return (
                  (normalizeId(requestedItemId) &&
                    normalizeId(recRequestedItemId) &&
                    normalizeId(requestedItemId) === normalizeId(recRequestedItemId)) ||
                  (normalizeId(lineItemId) &&
                    normalizeId(recLineItemId) &&
                    normalizeId(lineItemId) === normalizeId(recLineItemId)) ||
                  (normalizeId(catalogId) &&
                    normalizeId(recLineItemId) &&
                    normalizeId(catalogId) === normalizeId(recLineItemId)) ||
                  (normalizeId(entitlementId) &&
                    normalizeId(recEntitlementId) &&
                    normalizeId(entitlementId) === normalizeId(recEntitlementId)) ||
                  (normalizeId(rowRequestId) &&
                    normalizeId(recRequestId) &&
                    normalizeId(rowRequestId) === normalizeId(recRequestId))
                );
              }) ?? allAiRecommendations[0];
            const peerSummaryMessages = Array.isArray(
              matchedAiRecommendation?.peer_analysis?.summary
            )
              ? matchedAiRecommendation.peer_analysis.summary
                  .map((entry: any) => toInsightMessage(entry?.message))
                  .filter(Boolean)
                  .join(" ")
              : null;

            return {
              name: String(lineDisplayName || ""),
              displayName: String(lineDisplayName || ""),
              applicationName: String(lineApplicationName || ""),
              type: String(lineType),
              startDate: lineStartDate,
              endDate: lineEndDate,
              comments: lineComments,
              hasTrainingCheck: lineHasTrainingCheck,
              hasConflict: lineHasConflict,
              hasHighRisk: lineRisk.startsWith("high"),
              canWithdraw: status.toLowerCase().includes("awaiting") || status.toLowerCase().includes("pending"),
              canProvideAdditionalDetails: status.toLowerCase().includes("provide information"),
              instanceSteps,
              beneficiaryAnalysis: toInsightMessage(
                matchedAiRecommendation?.beneficiary_analysis?.message ??
                  matchedAiRecommendation?.beneficiary_analysis
              ) ?? undefined,
              contextualRisk: toInsightMessage(
                matchedAiRecommendation?.contextual_risk?.message ??
                  matchedAiRecommendation?.contextual_risk
              ) ?? undefined,
              riskSensitivityAnalysis: toInsightMessage(
                matchedAiRecommendation?.risk_sensitivity_analysis?.message ??
                  matchedAiRecommendation?.risk_sensitivity_analysis
                              ) ?? undefined,
              peerAnalysis: toInsightMessage(
                peerSummaryMessages ??
                  matchedAiRecommendation?.peer_analysis?.message ??
                  matchedAiRecommendation?.peer_analysis
              ) ?? undefined,
            };
          });
          const normalizedLineItems =
            lineItems.length > 0
              ? lineItems
              : [
                  {
                    name: String(displayNameFromCatalog || ""),
                    displayName: String(displayNameFromCatalog || ""),
                    applicationName: String(catalog.applicationname || catalog.applicationName || catalog.name || ""),
                    type: String(entityTypeFromCatalog || "Entitlement"),
                    startDate,
                    endDate,
                    comments: justification,
                    hasTrainingCheck: (() => {
                      const raw = catalog?.training_code ?? catalog?.trainingCode;
                      const arr = Array.isArray(raw) ? raw : [];
                      if (arr.length === 0) return false;
                      const first = arr[0] as Record<string, unknown>;
                      return !!String(first?.code ?? "").trim();
                    })(),
                    hasConflict: (() => {
                      if (!hasGlobalSodConflict || !primaryConflictingRole) return false;
                      const nameKey = String(displayNameFromCatalog).trim();
                      const idKey = String(catalog.catalogId ?? catalog.catalogid ?? "").trim();
                      return nameKey === primaryConflictingRole || idKey === primaryConflictingRole;
                    })(),
                    hasHighRisk: String(catalog.risk ?? "").toLowerCase().startsWith("high"),
                    canWithdraw:
                      status.toLowerCase().includes("awaiting") || status.toLowerCase().includes("pending"),
                    canProvideAdditionalDetails: status.toLowerCase().includes("provide information"),
                    instanceSteps: [],
                  },
                ];
          const mappedWorkflowSteps = mapInstanceSteps(
            sortStepsByTemplateOrder(requestJsonStepsRaw),
            trainingValidation,
            sodValidation
          );
          const submittedStep: InstanceStep[] = requestedOn
            ? [
                {
                  action: "Request Submitted",
                  date: formatDateTime(requestedOn),
                  userActor: requesterNameFromObject
                    ? `${requesterNameFromObject} (Requester)`
                    : "Requester",
                  status: "Completed",
                },
              ]
            : [];
          const requestInstanceSteps =
            mappedWorkflowSteps.length > 0 ? [...submittedStep, ...mappedWorkflowSteps] : [];

          const wfInstanceIdFromItem =
            firstItem?.wf_instance_id ??
            accessItems.find((item: any) => item?.wf_instance_id != null)?.wf_instance_id;
          const wfInstanceIdFromRequestJson =
            requestJson?.workflow_instance?.id ??
            requestJson?.workflowInstance?.id;
          // Same ID resolution as app/track-request/page.tsx (grid "ID" column)
          const requestDisplayId =
            requestJson?.workflow_instance?.id ??
            row.request_id ??
            accessRequest.id ??
            row.requestid ??
            row.id ??
            "";
          const lookupKeys = [
            wfInstanceIdFromRequestJson,
            wfInstanceIdFromItem,
            row.wf_instance_id,
            row.wfinstanceid,
            row.request_id,
            accessRequest.id,
            row.requestid,
            row.id,
          ]
            .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
            .map((value) => String(value));
          const resolvedRequestId = String(
            accessRequest.id ?? row.request_id ?? row.requestid ?? row.id ?? ""
          );
          const resolvedWfInstanceId = String(
            wfInstanceIdFromRequestJson ??
              wfInstanceIdFromItem ??
              row.wf_instance_id ??
              row.wfinstanceid ??
              ""
          );

          return {
            id: requestDisplayId,
            requestId: resolvedRequestId,
            wfInstanceId: resolvedWfInstanceId,
            lookupKeys,
            beneficiaryName: String(beneficiaryNameFromObject),
            requesterName: String(requesterNameFromObject),
            displayName: String(displayNameFromCatalog),
            entityType: String(entityTypeFromCatalog || "Entitlement"),
            daysOpen,
            status,
            canWithdraw: status.toLowerCase().includes("awaiting") || status.toLowerCase().includes("pending"),
            canProvideAdditionalDetails: status.toLowerCase().includes("provide information"),
            details: {
              dateCreated: raisedOn,
              type: String(entityTypeFromCatalog || "Entitlement"),
              name: String(displayNameFromCatalog || ""),
              justification,
              startDate,
              endDate,
              globalComments: justification || undefined,
            },
            lineItems: normalizedLineItems,
            instanceSteps: requestInstanceSteps,
            sodPolicyDetails,
            sodSeverity,
            sodConflictingRoles,
          };
        });

        const incomingId = String(id);
        const scoreCandidate = (candidate: Request): number => {
          let score = 0;
          if (candidate.requestId && candidate.requestId === incomingId) score += 1000;
          if (candidate.wfInstanceId && candidate.wfInstanceId === incomingId) score += 900;
          if (candidate.lookupKeys.includes(incomingId)) score += 700;
          if (String(candidate.id) === incomingId) score += 500;
          score += (candidate.instanceSteps?.length ?? 0) * 10;
          score += candidate.lineItems?.length ?? 0;
          return score;
        };

        const primaryCandidates = mapped.filter(
          (r) =>
            (r.requestId && r.requestId === incomingId) ||
            (r.wfInstanceId && r.wfInstanceId === incomingId) ||
            r.lookupKeys.includes(incomingId) ||
            String(r.id) === incomingId
        );

        const bestPrimary =
          [...primaryCandidates].sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0] ?? null;

        const relatedByBestPrimary =
          bestPrimary == null
            ? []
            : mapped.filter((r) => {
                const sameRequestId =
                  bestPrimary.requestId !== "" && r.requestId === bestPrimary.requestId;
                const sameWfInstanceId =
                  bestPrimary.wfInstanceId !== "" && r.wfInstanceId === bestPrimary.wfInstanceId;
                return sameRequestId || sameWfInstanceId;
              });

        const bestRelated =
          [...relatedByBestPrimary].sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0] ??
          null;

        setRequest(bestRelated ?? bestPrimary ?? null);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load request.";
        setError(message);
        setRequest(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!request?.lineItems?.length) return;
    const defaultExpandedState: Record<string, boolean> = {};
    request.lineItems.forEach((_, index) => {
      defaultExpandedState[String(index)] = true;
    });
    setExpandedLineItems(defaultExpandedState);
  }, [request]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Loading request…</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Unable to load request</h1>
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    );
  }

  if (!request || !request.details) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Request not found</h1>
      </div>
    );
  }

  const requestLevelSteps = Array.isArray(request.instanceSteps)
    ? request.instanceSteps
    : [];
  const lineLevelSteps = Array.isArray(request.lineItems)
    ? request.lineItems.flatMap((lineItem) =>
        Array.isArray(lineItem.instanceSteps) ? lineItem.instanceSteps : []
      )
    : [];
  const topInstanceSteps =
    requestLevelSteps.length > 0 ? requestLevelSteps : lineLevelSteps;

  // Hide the "Assigned for SOD Approval" row since it represents the same
  // logical event as the initial "Request Submitted" entry.
  const stepsWithoutSodCheck = topInstanceSteps.filter(
    (step) => step.action !== "Assigned for SOD Approval"
  );

  // Provisioning is always the terminal step, but some backends return it
  // earlier in instance_steps than the approvals that must precede it, so
  // pin it to the end here instead of trusting raw array order.
  const visibleInstanceSteps = [
    ...stepsWithoutSodCheck.filter((step) => step.action !== "Request Fulfillment"),
    ...stepsWithoutSodCheck.filter((step) => step.action === "Request Fulfillment"),
  ];

  const firstPendingIndex = visibleInstanceSteps.findIndex((step) =>
    String(step.status ?? "").toLowerCase().includes("pending")
  );

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
      {/* Request Header Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        {/* Row 1: Request ID + Request Type */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-900">
              Request ID: {request.id}
            </h2>
          </div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700 self-end sm:self-auto">
            Request Type:{" "}
            <span className="ml-1 font-semibold">
              {request.details.type || request.entityType}
            </span>
          </div>
        </div>

        {/* Row 2: Date Created | Requester | Beneficiary | Duration (optional) | Justification */}
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

      {visibleInstanceSteps.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 text-xs">
              <thead className="bg-blue-100">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium text-blue-900 uppercase">
                    S. No
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium text-blue-900 uppercase">
                    Action
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium text-blue-900 uppercase">
                    Date
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium text-blue-900 uppercase">
                    User
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium text-blue-900 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {visibleInstanceSteps.map((step, idx) => {
                  const hideMetaColumns = firstPendingIndex !== -1 && idx >= firstPendingIndex;
                  return (
                    <React.Fragment key={`${step.action}-${step.date}-${idx}`}>
                      <tr>
                        <td className="px-3 py-1.5 text-gray-900">{idx + 1}</td>
                        <td className="px-3 py-1.5 text-gray-900">{step.action || "-"}</td>
                        <td className="px-3 py-1.5 text-gray-500">
                          {hideMetaColumns ? "" : (step.date || "-")}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500">
                          {hideMetaColumns ? "" : (step.userActor || "-")}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500">
                          {hideMetaColumns ? "" : (step.status || "-")}
                        </td>
                      </tr>
                      {!hideMetaColumns && step.sodViolations && step.sodViolations.length > 0 && (
                        <tr>
                          <td></td>
                          <td colSpan={4} className="px-3 py-2">
                            <div className="space-y-1.5">
                              {step.sodViolations.map((violation, vIdx) => (
                                <div key={vIdx} className="flex items-center gap-2 text-xs">
                                  <span className="font-semibold uppercase tracking-wide text-blue-400 text-[10px] shrink-0">
                                    Message:
                                  </span>
                                  <span className="text-gray-700">{violation.message || "-"}</span>
                                  <span className="text-gray-300">|</span>
                                  <span className="font-semibold uppercase tracking-wide text-blue-400 text-[10px] shrink-0">
                                    Severity:
                                  </span>
                                  <span className="font-semibold text-gray-800 shrink-0">
                                    {violation.severity || "-"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      {!hideMetaColumns && step.sodClean && (
                        <tr>
                          <td></td>
                          <td colSpan={4} className="px-3 py-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold uppercase tracking-wide text-blue-400 text-[10px] shrink-0">
                                Message:
                              </span>
                              <span className="text-gray-700">No SOD violation found</span>
                              <span className="text-gray-300">|</span>
                              <span className="font-semibold uppercase tracking-wide text-blue-400 text-[10px] shrink-0">
                                Status:
                              </span>
                              <span className="font-semibold text-gray-800 shrink-0">
                                {step.sodStatus || "-"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      {!hideMetaColumns && step.trainingWarnings && step.trainingWarnings.length > 0 && (
                        <tr>
                          <td></td>
                          <td colSpan={4} className="px-3 py-2">
                            <div className="space-y-1.5">
                              {step.trainingWarnings.map((warning, wIdx) => (
                                <div key={wIdx} className="flex items-center gap-2 text-xs">
                                  <span className="font-semibold uppercase tracking-wide text-blue-400 text-[10px] shrink-0">
                                    Message:
                                  </span>
                                  <span className="text-gray-700">{warning.message || "-"}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      {!hideMetaColumns && step.trainingNotRequired && (
                        <tr>
                          <td></td>
                          <td colSpan={4} className="px-3 py-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold uppercase tracking-wide text-blue-400 text-[10px] shrink-0">
                                Message:
                              </span>
                              <span className="text-gray-700">Training not required</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Line Item Details */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        {request.lineItems.map((lineItem, index) => {
          const lineItemKey = String(index);
          const isItemExpanded = expandedLineItems[lineItemKey] ?? true;
          const toggleTooltip = isItemExpanded ? "Collapse line item" : "Expand line item";
          return (
            <div key={lineItemKey} className="border border-gray-200 rounded-lg bg-gray-50">
              {/* Line item header: requested access item + tags + actions */}
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
                className="w-full flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200 text-left hover:bg-gray-100 transition-colors cursor-pointer"
                aria-expanded={isItemExpanded}
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{lineItem.name}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {lineItem.hasHighRisk && (
                      <span className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-medium border border-red-300 bg-red-50 text-red-600">
                        High Risk
                      </span>
                    )}
                    <span className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-medium border border-violet-300 bg-violet-50 text-violet-700">
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
                          const severity = (request.sodSeverity || "").toUpperCase();
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
                                    {String(details["Policy Name"] ?? details["SOD Policy ID"] ?? "-")}
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
                                  <span>{String(details["SOD Policy ID"] ?? "-")}</span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 block">
                                    Owner
                                  </span>
                                  <span>{String(details["Owner"] ?? "-")}</span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 block">
                                    Business Process
                                  </span>
                                  <span>{String(details["Business Process"] ?? "-")}</span>
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
                            { widthPx: 460, title: "SOD Policy Details" }
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
                                  <span className="italic text-gray-500">No beneficiary analysis available.</span>
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
                                  <span className="italic text-gray-500">No contextual risk details available.</span>
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
                                  <span className="italic text-gray-500">No risk sensitivity analysis available.</span>
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
                                  <span className="italic text-gray-500">No peer analysis available.</span>
                                )}
                              </p>
                            </div>
                          </div>,
                          { widthPx: 500, title: "Insights" }
                        );
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                    >
                      <InsightsIcon size={18} className="shrink-0 text-amber-500" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <span className="text-gray-500 ml-1" aria-hidden title={toggleTooltip}>
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
                  {/* Compact row: access duration, comments, attachment */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                        Access Duration
                      </div>
                      <div className="text-gray-900">
                        {lineItem.startDate
                          ? lineItem.endDate
                            ? `${lineItem.startDate} - ${lineItem.endDate}`
                            : `${lineItem.startDate} (ongoing)`
                          : lineItem.endDate
                            ? `Until ${lineItem.endDate}`
                            : "-"}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                        Comments
                      </div>
                      <div className="text-gray-900 whitespace-pre-wrap break-words">
                        {lineItem.comments || "No additional comments provided."}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                        Attachment
                      </div>
                      <div className="text-gray-900">No Attachment</div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
};

export default TrackRequestDetailPage;

