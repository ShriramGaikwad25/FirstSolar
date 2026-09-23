"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Printer,
  User,
  AtSign,
  Mail,
  Hash,
  Building2,
  Briefcase,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { getReviewerId } from "@/lib/auth";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import { getAccessRequestStatusBadgeClasses } from "@/lib/access-request-status-badge";

interface InstanceStep {
  action: string;
  date: string;
  userActor: string;
  status: string;
  /** Free-text decision comment, when the backend provides one on the step/task. */
  comment?: string;
  sodViolations?: Array<{ message: string; severity: string }>;
  sodClean?: boolean;
  sodStatus?: string;
  trainingWarnings?: Array<{ message: string }>;
  trainingNotRequired?: boolean;
}

interface RequestDetails {
  dateCreated: string;
  /** Date + time, for the header card ("Sep 03, 21:53"-style display). */
  dateCreatedTime: string;
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
  /** Target-system account this entitlement is granted on; falls back to the beneficiary's username. */
  accountName: string;
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
  beneficiaryUsername: string;
  beneficiaryEmail: string;
  beneficiaryDepartment: string;
  beneficiaryJobTitle: string;
  beneficiaryEmployeeId: string;
  beneficiaryManager: string;
  requesterName: string;
  requesterUsername: string;
  requesterEmail: string;
  requesterDepartment: string;
  requesterJobTitle: string;
  requesterEmployeeId: string;
  requesterManager: string;
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

/** Uppercase label + value pair used in the header summary row. */
const HeaderField: React.FC<{ label: string; value: React.ReactNode; accent?: boolean }> = ({
  label,
  value,
  accent,
}) => (
  <div className="min-w-0">
    <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</div>
    <div
      className={`mt-0.5 truncate text-sm font-semibold ${accent ? "text-blue-700" : "text-gray-900"}`}
    >
      {value}
    </div>
  </div>
);

/** Uppercase label + value pair used inside the Request History / User Details cards. */
const DetailField: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className="min-w-0">
    <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</div>
    <div
      className={`mt-0.5 whitespace-pre-wrap break-words text-sm text-gray-900 ${
        mono ? "font-mono text-[12.5px]" : ""
      }`}
    >
      {value}
    </div>
  </div>
);

/** Label + value pair with a leading icon, used for the User Details card's identity fields. */
const IconDetailField: React.FC<{ icon: LucideIcon; label: string; value: React.ReactNode }> = ({
  icon: Icon,
  label,
  value,
}) => (
  <div className="flex min-w-0 items-start gap-2.5">
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
      <Icon className="h-3.5 w-3.5" />
    </div>
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-0.5 truncate text-sm text-gray-900">{value}</div>
    </div>
  </div>
);

/** Compact single-line label + value row used for the SOD/training annotations under an approval step. */
const StepMessageRow: React.FC<{ label: string; value: React.ReactNode; emphasize?: boolean }> = ({
  label,
  value,
  emphasize,
}) => (
  <div className="w-full text-left text-[11px] leading-snug">
    <span className="font-semibold uppercase tracking-wide text-blue-500">{label}:</span>{" "}
    <span className={emphasize ? "font-semibold text-gray-800" : "text-gray-700"}>{value}</span>
  </div>
);

type DetailTab = "history" | "user";

const DETAIL_TABS: Array<{ key: DetailTab; label: string }> = [
  { key: "history", label: "Request History" },
  { key: "user", label: "User Details" },
];

const TrackRequestDetailPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = React.use(params);
  const { openSidebar } = useRightSidebar();
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLineItems, setExpandedLineItems] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<DetailTab>("history");

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
            comment:
              (
                step?.comment ??
                step?.comments ??
                step?.decision_comment ??
                step?.decisionComment ??
                step?.approver_comment ??
                step?.approverComment ??
                step?.tasks?.[0]?.comment ??
                step?.tasks?.[0]?.comments ??
                step?.tasks?.[0]?.decision_comment ??
                step?.notes ??
                ""
              )
                .toString()
                .trim() || undefined,
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

          const beneficiaryUsernameFromObject: string =
            beneficiary.username || beneficiary.userid || beneficiary.email || "";

          const requesterUsernameFromObject: string =
            requester.username || requester.userid || requester.email || "";

          const beneficiaryEmailFromObject: string = beneficiary.email || "";
          const requesterEmailFromObject: string = requester.email || "";

          const beneficiaryDepartmentFromObject: string = beneficiary.department || "";
          const requesterDepartmentFromObject: string = requester.department || "";

          const beneficiaryJobTitleFromObject: string =
            beneficiary.title || beneficiary.jobtitle || beneficiary.job_title || "";
          const requesterJobTitleFromObject: string =
            requester.title || requester.jobtitle || requester.job_title || "";

          const beneficiaryEmployeeIdFromObject: string = String(
            beneficiary.employeeid || beneficiary.employee_id || ""
          );
          const requesterEmployeeIdFromObject: string = String(
            requester.employeeid || requester.employee_id || ""
          );

          const beneficiaryManagerFromObject: string =
            beneficiary.manager_name ||
            beneficiary.managername ||
            beneficiary.manager ||
            "";
          const requesterManagerFromObject: string =
            requester.manager_name || requester.managername || requester.manager || "";

          const displayNameFromCatalog =
            catalog.name || catalog.entitlementname || catalog.applicationname || "";

          const entityTypeFromCatalog =
            catalog.type || catalog.entitlementtype || (catalog.metadata?.entitlementType as string) || "";

          const requestedOn: string | undefined =
            accessRequest.created_at ?? row.requestedon ?? row.created_at;
          const raisedOn = formatDate(requestedOn);
          const raisedOnDateTime = formatDateTime(requestedOn) || raisedOn;

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
            const lineAccountName =
              item?.account_name ||
              item?.accountname ||
              item?.account?.name ||
              beneficiaryUsernameFromObject ||
              "";
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
              accountName: String(lineAccountName || ""),
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
                    accountName: String(beneficiaryUsernameFromObject || ""),
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
            beneficiaryUsername: String(beneficiaryUsernameFromObject),
            beneficiaryEmail: String(beneficiaryEmailFromObject),
            beneficiaryDepartment: String(beneficiaryDepartmentFromObject),
            beneficiaryJobTitle: String(beneficiaryJobTitleFromObject),
            beneficiaryEmployeeId: String(beneficiaryEmployeeIdFromObject),
            beneficiaryManager: String(beneficiaryManagerFromObject),
            requesterName: String(requesterNameFromObject),
            requesterUsername: String(requesterUsernameFromObject),
            requesterEmail: String(requesterEmailFromObject),
            requesterDepartment: String(requesterDepartmentFromObject),
            requesterJobTitle: String(requesterJobTitleFromObject),
            requesterEmployeeId: String(requesterEmployeeIdFromObject),
            requesterManager: String(requesterManagerFromObject),
            displayName: String(displayNameFromCatalog),
            entityType: String(entityTypeFromCatalog || "Entitlement"),
            daysOpen,
            status,
            canWithdraw: status.toLowerCase().includes("awaiting") || status.toLowerCase().includes("pending"),
            canProvideAdditionalDetails: status.toLowerCase().includes("provide information"),
            details: {
              dateCreated: raisedOn,
              dateCreatedTime: raisedOnDateTime,
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

  const isStepPending = (step: InstanceStep | undefined): boolean => {
    if (!step) return false;
    const s = (step.status || "").toLowerCase();
    return !s || s.includes("pending");
  };

  const findApprovalStep = (
    steps: InstanceStep[],
    actionLabel: string
  ): InstanceStep | undefined => steps.find((s) => s.action === actionLabel);

  /** Circle / pill / connector colors for one step of the approval stepper, by its status text. */
  const stepVisualClasses = (
    status: string | undefined
  ): { circle: string; pill: string; line: string } => {
    const s = (status || "").toLowerCase();
    if (s.includes("reject")) {
      return { circle: "bg-red-600", pill: "bg-red-100 text-red-700", line: "bg-red-400" };
    }
    if (s.includes("complet")) {
      return { circle: "bg-green-600", pill: "bg-green-100 text-green-700", line: "bg-green-500" };
    }
    if (s.includes("pending") || s.includes("progress") || s.includes("running")) {
      return { circle: "bg-blue-600", pill: "bg-blue-100 text-blue-700", line: "bg-gray-200" };
    }
    return { circle: "bg-gray-300", pill: "bg-gray-100 text-gray-600", line: "bg-gray-200" };
  };

  const primaryHeaderName =
    request.beneficiaryName || request.requesterName || request.displayName || "Access Request";

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
      <div className="rounded-lg border border-dashed border-rose-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <FileText className="h-5 w-5 shrink-0 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">{primaryHeaderName}</h2>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${getAccessRequestStatusBadgeClasses(
              request.status
            )}`}
          >
            {request.status}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <HeaderField label="Request Id" value={request.id} />
          <HeaderField label="Requester" value={request.requesterName || "-"} accent />
          <HeaderField label="Beneficiary" value={request.beneficiaryName || "-"} accent />
          <HeaderField
            label="Created"
            value={request.details.dateCreatedTime || request.details.dateCreated || "-"}
          />
        </div>
      </div>

      {/* Approval History — always visible, not tab-gated */}
      {visibleInstanceSteps.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-5 sm:p-6">
          <div className="overflow-x-auto">
            <div className="flex min-w-[640px] items-start">
              {visibleInstanceSteps.map((step, idx) => {
                const hideMetaColumns = firstPendingIndex !== -1 && idx >= firstPendingIndex;
                const visuals = stepVisualClasses(step.status);
                const prevVisuals =
                  idx > 0 ? stepVisualClasses(visibleInstanceSteps[idx - 1].status) : null;
                return (
                  <React.Fragment key={`${step.action}-${step.date}-${idx}`}>
                    {idx > 0 && (
                      <div
                        className={`mt-4 h-0.5 flex-1 ${prevVisuals?.line ?? "bg-gray-200"}`}
                      />
                    )}
                    <div className="flex w-40 shrink-0 flex-col items-center text-center sm:w-48">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${visuals.circle}`}
                      >
                        {idx + 1}
                      </div>
                      <div className="mt-1.5 text-xs font-semibold leading-snug text-gray-900">
                        {step.action || "-"}
                      </div>
                      <span
                        className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${visuals.pill}`}
                      >
                        {step.status || "-"}
                      </span>
                      {!hideMetaColumns && (
                        <div className="mt-1 text-[11px] leading-snug text-gray-500">
                          {step.userActor || "—"} · {step.date || "-"}
                        </div>
                      )}
                      {!hideMetaColumns && step.sodViolations && step.sodViolations.length > 0 && (
                        <div className="mt-1.5 w-full space-y-0.5">
                          {step.sodViolations.map((violation, vIdx) => (
                            <div key={vIdx}>
                              <StepMessageRow label="Message" value={violation.message || "-"} />
                              <StepMessageRow
                                label="Severity"
                                value={violation.severity || "-"}
                                emphasize
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      {!hideMetaColumns && step.sodClean && (
                        <div className="mt-1.5 w-full space-y-0.5">
                          <StepMessageRow label="Message" value="No SOD violation found" />
                          <StepMessageRow label="Status" value={step.sodStatus || "-"} emphasize />
                        </div>
                      )}
                      {!hideMetaColumns && step.trainingWarnings && step.trainingWarnings.length > 0 && (
                        <div className="mt-1.5 w-full space-y-0.5">
                          {step.trainingWarnings.map((warning, wIdx) => (
                            <StepMessageRow key={wIdx} label="Message" value={warning.message || "-"} />
                          ))}
                        </div>
                      )}
                      {!hideMetaColumns && step.trainingNotRequired && (
                        <div className="mt-1.5 w-full">
                          <StepMessageRow label="Message" value="Training not required" />
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500">
          No approval history yet.
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Request detail tabs">
          {DETAIL_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
              aria-current={activeTab === tab.key ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Line Item Details */}
      {activeTab === "history" && (
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        {request.lineItems.map((lineItem, index) => {
          const lineItemKey = String(index);
          const isItemExpanded = expandedLineItems[lineItemKey] ?? true;
          const toggleTooltip = isItemExpanded ? "Collapse line item" : "Expand line item";
          return (
            <div key={lineItemKey} className="border border-gray-200 rounded-lg bg-white">
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
                className="w-full flex flex-wrap items-start gap-3 px-4 py-2.5 border-b border-gray-200 text-left hover:bg-gray-100 transition-colors cursor-pointer"
                aria-expanded={isItemExpanded}
              >
                <div className="flex flex-col gap-1.5 min-w-0 py-0.5">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{lineItem.name}</h3>
                  {(lineItem.hasHighRisk ||
                    lineItem.hasTrainingCheck ||
                    (lineItem.applicationName &&
                      lineItem.applicationName.trim().toLowerCase() !==
                        lineItem.name.trim().toLowerCase())) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {lineItem.hasHighRisk && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-red-300 bg-red-50 text-red-600">
                          High Risk
                        </span>
                      )}
                      {lineItem.applicationName &&
                        lineItem.applicationName.trim().toLowerCase() !==
                          lineItem.name.trim().toLowerCase() && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-violet-300 bg-violet-50 text-violet-700">
                            {lineItem.applicationName}
                          </span>
                        )}
                      {lineItem.hasTrainingCheck && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-emerald-300 bg-emerald-50 text-emerald-600">
                          Training Check
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 relative self-stretch">
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
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-auto py-0.5">
                  <span className="text-gray-500 ml-1" aria-hidden title={toggleTooltip}>
                    {isItemExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                </div>
              </div>

              {isItemExpanded && (() => {
                const itemSteps =
                  lineItem.instanceSteps && lineItem.instanceSteps.length > 0
                    ? lineItem.instanceSteps
                    : visibleInstanceSteps;
                const level1Step = findApprovalStep(itemSteps, "Assigned to User Manager");
                const level2Step = findApprovalStep(itemSteps, "Assigned to App Owner");
                const level1Text = level1Step
                  ? level1Step.comment ||
                    (isStepPending(level1Step)
                      ? "No comment yet — awaiting manager review."
                      : "No comment provided.")
                  : "Not yet reached.";
                const level2Text = level2Step
                  ? level2Step.comment ||
                    (isStepPending(level2Step)
                      ? "No comment yet — awaiting app owner review."
                      : "No comment provided.")
                  : "Not yet reached — pending Level 1 outcome.";

                return (
                  <div className="px-4 py-3.5 space-y-3.5 text-sm">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                      <DetailField label="Request Type" value={lineItem.type || "-"} />
                      <DetailField label="Username" value={request.beneficiaryUsername || "-"} />
                      <DetailField label="Account Name" value={lineItem.accountName || "-"} />
                      <DetailField
                        label="Security System"
                        value={lineItem.applicationName || "-"}
                      />
                    </div>

                    <DetailField label="Entitlement" value={lineItem.name || "-"} mono />

                    <DetailField
                      label="Requester Comment"
                      value={lineItem.comments || "No additional comments provided."}
                    />

                    <div className="border-t border-gray-200 pt-3 -mt-0.5">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Approver Comments
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailField label="Level 1 Comment (User Manager)" value={level1Text} />
                        <DetailField label="Level 2 Comment (App Owner)" value={level2Text} />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
      )}

      {activeTab === "user" && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Requester
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <IconDetailField icon={User} label="Name" value={request.requesterName || "-"} />
            <IconDetailField icon={AtSign} label="Username" value={request.requesterUsername || "-"} />
            <IconDetailField icon={Hash} label="Employee ID" value={request.requesterEmployeeId || "-"} />
            <IconDetailField icon={Mail} label="Email" value={request.requesterEmail || "-"} />
            <IconDetailField icon={Building2} label="Department" value={request.requesterDepartment || "-"} />
            <IconDetailField icon={Briefcase} label="Job Title" value={request.requesterJobTitle || "-"} />
            <IconDetailField icon={UserCog} label="Manager" value={request.requesterManager || "-"} />
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default TrackRequestDetailPage;

