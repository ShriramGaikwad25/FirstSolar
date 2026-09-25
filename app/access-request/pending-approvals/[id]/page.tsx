"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleX,
  CircleArrowOutUpRight,
  MessageCircle,
  MessageCircleQuestion,
  Hand,
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
import { getReviewerId, apiRequestWithAuth } from "@/lib/auth";
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
  /** Approver group code (e.g. "GRP_FINANCE_OPS") when this step was routed to a group instead of a single user. */
  groupCode?: string;
}

interface RequestLineItem {
  lineItemId: string;
  catalogId?: string;
  entitlementId: string;
  name: string;
  displayName: string;
  applicationName: string;
  /** Target-system account this entitlement is granted on; falls back to the beneficiary's username. */
  accountName: string;
  type: string;
  startDate: string;
  endDate: string;
  comments: string;
  hasConflict?: boolean;
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
  /** Date + time, for the header card's "Created" field. */
  dateCreatedTime: string;
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
  /** This page only lists OPEN approval tasks, so the header badge is always this. */
  status: string;
  beneficiaryName: string;
  beneficiaryUsername: string;
  requesterName: string;
  requesterUsername: string;
  requesterEmail: string;
  requesterDepartment: string;
  requesterJobTitle: string;
  requesterEmployeeId: string;
  requesterManager: string;
  durationDays?: number;
  /** "QUEUE" tasks aren't assigned to a specific user — claimable=false means it's already claimed (by this reviewer). */
  assigneeType?: string;
  claimable?: boolean;
  details: RequestDetails;
  lineItems: RequestLineItem[];
  instanceSteps: InstanceStep[];
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
    ].includes(k),
  );
  const hasActionAndStatus =
    keys.some((k) =>
      ["action", "action_item", "item_action", "action_name", "actionname"].includes(k),
    ) && keys.some((k) => ["status", "step_status", "stepstatus", "state"].includes(k));
  const looksLikeOutboxEvent =
    keys.includes("event_type") || keys.includes("aggregatetype") || keys.includes("aggregate_type");
  return (hasStepIdentity || hasActionAndStatus) && !looksLikeOutboxEvent;
};

const toStepsArray = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  if (typeof value === "string") {
    try {
      return toStepsArray(JSON.parse(value));
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
      return deepCollectStepArrays(JSON.parse(value), maxDepth - 1);
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

const resolveStepActionLabel = (
  step: any,
  actionFromCode: string,
  actionFromFields: string,
): string => {
  let action = String(actionFromCode ? actionFromCode : actionFromFields).trim();
  const isCustomApproval =
    action.toUpperCase() === "CUSTOM APPROVAL" ||
    String(step?.step_code ?? "").toUpperCase().replace(/_/g, " ") === "CUSTOM APPROVAL";
  if (!isCustomApproval) return action;

  const taskNameRaw =
    step?.task?.name ?? step?.Task?.name ?? step?.tasks?.[0]?.name ?? step?.tasks?.[0]?.Task?.name;
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
  sodValidation?: any,
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
        ? trainingWarningsRaw.map((w: any) => ({ message: String(w?.message ?? w?.Message ?? "") }))
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
    const sodClean = isSodStep && Array.isArray(sodViolationsRaw) && sodViolationsRaw.length === 0;

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
      action: resolveStepActionLabel(step, actionFromCode, actionFromFields),
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
            step?.timestamp,
        ),
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
          "",
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
            step?.currentStatus,
        ),
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

/** Circle / pill / connector colors for one step of the approval stepper, by its status text. */
const stepVisualClasses = (
  status: string | undefined,
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

const isStepPending = (step: InstanceStep | undefined): boolean => {
  if (!step) return false;
  const s = (step.status || "").toLowerCase();
  return !s || s.includes("pending");
};

const findApprovalStep = (
  steps: InstanceStep[],
  actionLabel: string,
): InstanceStep | undefined => steps.find((s) => s.action === actionLabel);

type DetailTab = "history" | "user";

const DETAIL_TABS: Array<{ key: DetailTab; label: string }> = [
  { key: "history", label: "Request History" },
  { key: "user", label: "User Details" },
];

const PendingApprovalDetailPage = ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = React.use(params);
  const router = useRouter();
  const { openSidebar } = useRightSidebar();
  const [request, setRequest] = useState<PendingApprovalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("history");
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
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [showClaimConfirm, setShowClaimConfirm] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
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

    const trimmedReviewerId = String(reviewerId).trim();
    const url = `https://preview.keyforge.ai/workflow/api/v1/ACMECOM/task/approvals/detail/${encodeURIComponent(
      String(id).trim(),
    )}`;

    // assigneeType / claimable / claimedBy live on the task-list endpoint's rows, not on this
    // detail endpoint's tasks[] — fetch it in parallel and match by requestUuid so the Claim /
    // Release affordances can reflect the same queue-assignment state the list page shows.
    const listUrl = `https://preview.keyforge.ai/workflow/api/v1/ACMECOM/task/approvals/${encodeURIComponent(
      trimmedReviewerId,
    )}`;
    const fetchListPage = (page: number) =>
      apiRequestWithAuth<any>(`${listUrl}?page=${page}&size=100&status=OPEN`, {
        method: "GET",
      });
    const extractListPageItems = (pageData: any): any[] =>
      Array.isArray(pageData?.dbResponse?.data) ? pageData.dbResponse.data : [];
    const findMatchingListTask = async (): Promise<any | undefined> => {
      try {
        const routeUuid = normalizeId(id);
        const firstPage = await fetchListPage(0);
        const totalPages = Number(firstPage?.dbResponse?.page?.totalPages ?? 1) || 1;
        let allListTasks = extractListPageItems(firstPage);
        if (totalPages > 1) {
          const rest = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) => fetchListPage(i + 1)),
          );
          for (const pageData of rest) {
            allListTasks = allListTasks.concat(extractListPageItems(pageData));
          }
        }
        return allListTasks.find((t) => {
          if (normalizeId(t?.requestUuid) === routeUuid) return true;
          const items = toArraySafe(t?.itemNames);
          return items.some((it) => normalizeId(it?.requestUuids) === routeUuid);
        });
      } catch (err) {
        console.warn("[PendingApprovalDetail] Failed to look up queue-assignment state:", err);
        return undefined;
      }
    };

    apiRequestWithAuth<any>(url, { method: "GET" })
      .then(async (data) => {
        console.log("[PendingApprovalDetail] raw response:", data);
        const dbResponse = toObjectSafe((data as any)?.dbResponse ?? data);
        const tasks: any[] = toArraySafe(dbResponse.tasks);

        if (tasks.length === 0) {
          setRequest(null);
          return;
        }

        // The task assigned to the current reviewer that's still open is the one this page
        // lets them act on; fall back to any open task, then to the most recent task.
        const activeTask =
          tasks.find(
            (t) =>
              normalizeId(t?.assignee_id) === normalizeId(trimmedReviewerId) &&
              String(t?.task_status ?? "").toUpperCase() === "OPEN",
          ) ??
          tasks.find(
            (t) => String(t?.task_status ?? "").toUpperCase() === "OPEN",
          ) ??
          tasks[tasks.length - 1];

        const matchingListTask =
          activeTask?.assigneeType != null && activeTask?.claimable != null
            ? undefined
            : await findMatchingListTask();

        const requesterObj = toObjectSafe(activeTask?.requester);
        const beneficiaryObj = toObjectSafe(activeTask?.beneficiary);

        const requesterName = toStringSafe(
          requesterObj.displayname ?? requesterObj.display_name,
        );
        const beneficiaryName = toStringSafe(
          beneficiaryObj.displayname ?? beneficiaryObj.display_name,
        );
        const requesterUsername = toStringSafe(
          requesterObj.username ??
            requesterObj.userid ??
            requesterObj.email?.work ??
            requesterObj.email,
        );
        const beneficiaryUsername = toStringSafe(
          beneficiaryObj.username ??
            beneficiaryObj.userid ??
            beneficiaryObj.email?.work ??
            beneficiaryName,
        );
        const requesterEmail = toStringSafe(
          requesterObj.email?.work ?? requesterObj.email,
        );
        const requesterDepartment = toStringSafe(requesterObj.department);
        const requesterJobTitle = toStringSafe(requesterObj.title);
        const requesterEmployeeId = toStringSafe(requesterObj.employeeid);
        const requesterManager = toStringSafe(
          requesterObj.managername ?? requesterObj.manager_name,
        );

        const createdOnRaw = activeTask?.created_at;
        const createdOn = formatDate(toStringSafe(createdOnRaw));
        const createdOnDateTime =
          formatDateTime(toStringSafe(createdOnRaw)) || createdOn;
        const justification = toStringSafe(activeTask?.requester_justification);

        // Every task for this request carries the same catalog-backed line items; use the
        // active task's copy, falling back to any task that has one.
        const itemDetails: any[] =
          toArraySafe(activeTask?.itemdetails).length > 0
            ? toArraySafe(activeTask?.itemdetails)
            : (tasks
                .map((t) => toArraySafe(t?.itemdetails))
                .find((arr) => arr.length > 0) ?? []);

        const contextJson = toObjectSafe(activeTask?.context_json);
        const sodValidation = toObjectSafe(contextJson?.validation?.sod);
        const trainingValidation = toObjectSafe(contextJson?.validation?.training);
        const hasSodConflict = Boolean(
          sodValidation?.hasConflict ?? contextJson?.vars?.sodHasConflict,
        );
        const sodSeverity: string | null =
          typeof sodValidation?.riskLevel === "string" &&
          sodValidation.riskLevel.toUpperCase() !== "NONE"
            ? sodValidation.riskLevel
            : null;
        // This payload doesn't carry a named SOD policy record (owner / business process /
        // description) — only violations + risk level — so there's nothing to show in the
        // policy-details sidebar.
        const sodPolicyDetails: SodPolicyDetails | null = null;
        const sodConflictingRoles: string[] = [];

        // context_json.lineItems[].lineItemId is the numeric id the approver-action API
        // expects; itemdetails[].lineitemid is a different ("business") id used only for
        // display, so map from catalogId to recover the id actions must be sent with.
        const contextLineItems: any[] = toArraySafe(contextJson?.lineItems);
        const lineItemIdByCatalogId = new Map<string, number>();
        contextLineItems.forEach((cli) => {
          const catId = normalizeId(cli?.catalogId);
          const lid = Number(cli?.lineItemId);
          if (catId && Number.isFinite(lid)) lineItemIdByCatalogId.set(catId, lid);
        });

        const aiRecommendations = toAiRecommendationArray(
          activeTask?.ai_recommendation,
        );

        const lineItems: RequestLineItem[] = itemDetails.map((item) => {
          const catalog = item?.catalog ?? {};
          const lineName = toStringSafe(
            catalog.name ?? catalog.entitlementname ?? catalog.applicationname,
          );
          const lineType = toStringSafe(
            catalog.entitlementtype ??
              catalog.type ??
              catalog?.metadata?.entitlementType ??
              "Entitlement",
          );
          const applicationName = toStringSafe(catalog.applicationname);
          const accountName = toStringSafe(item?.account_name ?? beneficiaryUsername);
          const startDate = formatDate(toStringSafe(item?.item_startdate));
          const endDate = formatDate(toStringSafe(item?.item_enddate));
          const riskLevel = String(catalog.risk ?? "").toLowerCase();

          const requestedItemId = toStringSafe(item?.requested_itemid);
          const catalogId = toStringSafe(catalog?.catalogid ?? requestedItemId);
          const entitlementId = toStringSafe(catalog?.entitlementid ?? "");
          const resolvedLineItemId =
            lineItemIdByCatalogId.get(normalizeId(catalogId)) ?? item?.lineitemid;

          const hasTrainingCheck = (() => {
            const raw = catalog?.training_code;
            const arr = Array.isArray(raw) ? raw : [];
            if (arr.length === 0) return false;
            const first = arr[0] as Record<string, unknown>;
            return !!toStringSafe(first?.code).trim();
          })();

          const matchedAiRecommendation =
            aiRecommendations.find((rec) => {
              const recRequestedItemId = toStringSafe(
                rec?.requested_itemid ?? rec?.requestedItemId,
              ).trim();
              return (
                requestedItemId &&
                recRequestedItemId &&
                requestedItemId === recRequestedItemId
              );
            }) ?? aiRecommendations[0];

          return {
            lineItemId: toStringSafe(resolvedLineItemId),
            catalogId,
            entitlementId,
            name: lineName,
            displayName: lineName,
            applicationName,
            accountName,
            type: lineType,
            startDate,
            endDate,
            comments: toStringSafe(item?.item_comments),
            hasConflict: hasSodConflict,
            hasInfoIcon: riskLevel.startsWith("high"),
            hasHighRisk: riskLevel.startsWith("high"),
            hasTrainingCheck,
            beneficiaryAnalysis:
              toInsightMessage(
                matchedAiRecommendation?.beneficiary_analysis?.message ??
                  matchedAiRecommendation?.beneficiary_analysis,
              ) ?? undefined,
            contextualRisk:
              toInsightMessage(
                matchedAiRecommendation?.contextual_risk?.message ??
                  matchedAiRecommendation?.contextual_risk,
              ) ?? undefined,
            riskSensitivityAnalysis:
              toInsightMessage(
                matchedAiRecommendation?.risk_sensitivity_analysis?.message ??
                  matchedAiRecommendation?.risk_sensitivity_analysis,
              ) ?? undefined,
            peerAnalysis:
              toInsightMessage(
                matchedAiRecommendation?.peer_analysis?.message ??
                  matchedAiRecommendation?.peer_analysis,
              ) ?? undefined,
          };
        });

        // Read this task's already-recorded per-item decisions (if any) so a refreshed page
        // still renders filled action buttons instead of re-offering Approve/Reject.
        const decisionJson = toObjectSafe(activeTask?.decision_json);
        const decisionLineItems = toArraySafe(decisionJson.lineItems);
        const decisionActionByLineItemId: Record<
          string,
          "approve" | "reject" | "consulted"
        > = {};
        decisionLineItems.forEach((entry) => {
          const actionRaw = toStringSafe(entry?.action ?? entry?.ACTION)
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
          const decisionLineItemId = normalizeId(entry?.lineItemId);
          if (decisionLineItemId) {
            decisionActionByLineItemId[decisionLineItemId] = mappedAction;
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
        lineItems.forEach((lineItem, idx) => {
          const baselineAction =
            decisionActionByLineItemId[normalizeId(lineItem.lineItemId)] ?? null;
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

        // Approval-history stepper: same instance_steps shape the requester-facing Track
        // Request detail page consumes.
        // Each stepper entry's tasks[0].id maps to a full record in dbResponse.tasks[] (the same
        // array activeTask was picked from) — that's where itemdetails/context_json with the
        // group-approver info actually live, not on the lightweight instance_steps[].tasks[] entry.
        const tasksByTaskId = new Map<string, any>();
        tasks.forEach((t) => {
          const tid = normalizeId(t?.taskid ?? t?.taskId);
          if (tid) tasksByTaskId.set(tid, t);
        });

        // context_json is a running snapshot of every step's resolved approver (not just the
        // current one), and itemdetails[].catalog.approver_group_code is a static property of the
        // entitlement itself — both leak the group code onto every step. Only the Owner Approval
        // step is actually ever group-routed, so gate on that step specifically.
        const resolveStepGroupCode = (step: any): string | undefined => {
          const isOwnerApprovalStep = String(step?.step_code ?? "").toUpperCase() === "OWNER_APPROVAL";
          if (!isOwnerApprovalStep) return undefined;

          const stepTaskId = normalizeId(step?.tasks?.[0]?.id);
          const fullTask = stepTaskId ? tasksByTaskId.get(stepTaskId) : undefined;
          if (!fullTask) return undefined;

          const contextLineItemsForTask = toArraySafe(fullTask?.context_json?.lineItems);
          const fromContext = contextLineItemsForTask
            .map((li) =>
              li?.metadata?.approver?.type === "GROUP"
                ? toStringSafe(li?.metadata?.approver?.groupCode)
                : "",
            )
            .find((code) => code);
          return fromContext || undefined;
        };

        const sortedRawSteps = sortStepsByTemplateOrder(toArraySafe(dbResponse.instance_steps));
        const mappedWorkflowSteps = mapInstanceSteps(
          sortedRawSteps,
          trainingValidation,
          sodValidation,
        ).map((mappedStep, idx) => ({
          ...mappedStep,
          groupCode: resolveStepGroupCode(sortedRawSteps[idx]),
        }));
        const submittedStep: InstanceStep[] = createdOnRaw
          ? [
              {
                action: "Request Submitted",
                date: formatDateTime(toStringSafe(createdOnRaw)),
                userActor: requesterName ? `${requesterName} (Requester)` : "Requester",
                status: "Completed",
              },
            ]
          : [];
        const instanceSteps: InstanceStep[] =
          mappedWorkflowSteps.length > 0
            ? [...submittedStep, ...mappedWorkflowSteps]
            : [];

        const activeReviewerId =
          toStringSafe(activeTask?.assignee_id) || trimmedReviewerId;

        const built: PendingApprovalDetail = {
          id: toStringSafe(dbResponse.requestUuid ?? id),
          taskId: activeTask?.taskid ?? activeTask?.taskId,
          reviewerId: activeReviewerId,
          fallbackEntitlementId: lineItems[0]?.entitlementId || "",
          status:
            String(activeTask?.task_status ?? "").toUpperCase() === "OPEN"
              ? "Pending"
              : normalizeStatus(activeTask?.task_status) || "Pending",
          assigneeType: toStringSafe(activeTask?.assigneeType ?? matchingListTask?.assigneeType),
          claimable: Boolean(activeTask?.claimable ?? matchingListTask?.claimable),
          requesterName,
          requesterUsername,
          requesterEmail,
          requesterDepartment,
          requesterJobTitle,
          requesterEmployeeId,
          requesterManager,
          beneficiaryName,
          beneficiaryUsername,
          durationDays,
          details: {
            dateCreated: createdOn,
            dateCreatedTime: createdOnDateTime,
            type: lineItems[0]?.type || "Entitlement",
            justification,
          },
          lineItems,
          instanceSteps,
          initialLineItemActions,
          baselineLineItemActions,
          sodPolicyDetails,
          sodSeverity,
          sodConflictingRoles,
        };

        setRequest(built);
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

      const effectiveActions = request.lineItems.map((_, idx) => {
        const key = String(idx);
        const currentAction = selectedActionByKey.get(key);
        const baselineAction = baselineLineItemActions[key] ?? null;
        return currentAction ?? baselineAction;
      });
      const allItemsActioned = effectiveActions.every(Boolean);
      const allSameAction =
        allItemsActioned && effectiveActions.every((a) => a === effectiveActions[0]);
      const overallActionValue = allSameAction
        ? effectiveActions[0] === "approve"
          ? "APPROVE"
          : effectiveActions[0] === "reject"
            ? "REJECT"
            : ""
        : "";

      const payload = {
        taskid: request.taskId ?? request.id,
        overallAction: overallActionValue,
        comments: "",
        lineItems: lineItemsPayload,
      };

      // Actions are submitted as the logged-in reviewer, not whoever/whatever the task's
      // assignee_id currently is (for a QUEUE task that's a group placeholder, not "me").
      const submittingReviewerId = getReviewerId();
      const response = await fetch(
        `https://preview.keyforge.ai/workflow/api/v1/ACMECOM/approveraction/${String(submittingReviewerId ?? request.reviewerId).trim()}`,
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

  const handleRelease = async () => {
    if (!request || releaseLoading) return;

    // Release is always performed by the logged-in reviewer, not whoever/whatever the task's
    // assignee_id currently is (for a QUEUE task that's a group placeholder, not "me").
    const reviewerId = getReviewerId();
    if (!reviewerId) return;

    setReleaseLoading(true);
    setReleaseError(null);

    try {
      const parsedTaskId = Number(request.taskId);
      const response = await fetch(
        `https://preview.keyforge.ai/workflow/api/v1/ACMECOM/task/release/${String(reviewerId).trim()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: Number.isFinite(parsedTaskId) ? parsedTaskId : request.taskId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Release failed (${response.status})`);
      }

      router.push("/access-request/pending-approvals");
    } catch (err: any) {
      console.error("Failed to release task:", err);
      setReleaseError(err?.message || "Failed to release task");
    } finally {
      setReleaseLoading(false);
      setShowReleaseConfirm(false);
    }
  };

  const handleClaim = async () => {
    if (!request || claimLoading) return;

    const reviewerId = getReviewerId();
    if (!reviewerId) return;

    setClaimLoading(true);
    setClaimError(null);

    try {
      const parsedTaskId = Number(request.taskId);
      const response = await fetch(
        `https://preview.keyforge.ai/workflow/api/v1/ACMECOM/task/claim/${String(reviewerId).trim()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: Number.isFinite(parsedTaskId) ? parsedTaskId : request.taskId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Claim failed (${response.status})`);
      }

      window.location.reload();
    } catch (err: any) {
      console.error("Failed to claim task:", err);
      setClaimError(err?.message || "Failed to claim task");
    } finally {
      setClaimLoading(false);
      setShowClaimConfirm(false);
    }
  };

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
        {/* Request Header Section */}
        <div className="rounded-lg border border-dashed border-rose-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">
              {request.beneficiaryName || request.requesterName || "Access Request"}
            </h2>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${getAccessRequestStatusBadgeClasses(
                request.status,
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
        {(() => {
          const visibleInstanceSteps = request.instanceSteps.filter(
            (step) => step.action !== "Assigned for SOD Approval",
          );
          const firstPendingIndex = visibleInstanceSteps.findIndex((step) =>
            String(step.status ?? "").toLowerCase().includes("pending"),
          );
          if (visibleInstanceSteps.length === 0) {
            return (
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500">
                No approval history yet.
              </div>
            );
          }
          return (
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
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${visuals.circle}`}
                          >
                            {idx + 1}
                          </div>
                          <div className="mt-2 text-sm font-semibold leading-snug text-gray-900">
                            {step.action || "-"}
                          </div>
                          <span
                            className={`mt-1.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${visuals.pill}`}
                          >
                            {step.status || "-"}
                          </span>
                          {!hideMetaColumns && (
                            <div className="mt-1.5 text-xs leading-snug text-gray-500">
                              {step.groupCode || step.userActor || "—"} · {step.date || "-"}
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
          );
        })()}

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

        {activeTab === "history" && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          {request.lineItems.map((lineItem, index) => {
            const lineItemKey = String(index);
            const isItemExpanded = expandedLineItems[lineItemKey] ?? true;
            const selectedAction = lineItemActions[lineItemKey] ?? null;
            const isLockedByServer =
              (baselineLineItemActions[lineItemKey] ?? null) !== null;
            const lockedAction = baselineLineItemActions[lineItemKey] ?? null;
            const approveFilled = selectedAction === "approve";
            const rejectFilled = selectedAction === "reject";
            const isItemLoading = lineItemLoading[lineItemKey] ?? false;
            const isActionsDisabled = isItemLoading || isLockedByServer;
            const isClaimableQueueTask =
              request.assigneeType === "QUEUE" && request.claimable === true;
            const itemError = lineItemError[lineItemKey] ?? null;
            const effectiveComment = lineItemComments[lineItemKey] ?? "";

            return (
              <div
                key={lineItemKey}
                className="border border-gray-200 rounded-lg bg-white"
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
                      {lineItem.applicationName &&
                        lineItem.applicationName.trim().toLowerCase() !==
                          lineItem.name.trim().toLowerCase() && (
                          <span className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-medium border border-blue-300 bg-blue-50 text-blue-600">
                            {lineItem.applicationName}
                          </span>
                        )}
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
                        {isClaimableQueueTask ? (
                          <button
                            type="button"
                            title="Claim"
                            aria-label="Claim"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowClaimConfirm(true);
                            }}
                            className="p-1 rounded flex items-center justify-center"
                          >
                            <Hand color="#0D9488" strokeWidth={1} size={26} fill="none" />
                          </button>
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
                          </>
                        )}
                        <button
                          type="button"
                          title="Requester comment"
                          aria-label="Requester comment"
                          disabled={isItemLoading}
                          onClick={(e) => openCommentModal(e, lineItemKey)}
                          className={`p-1 rounded flex items-center justify-center ${isItemLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <MessageCircle color="#2684FF" strokeWidth={1} size={26} fill="none" />
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
                          className={`p-1 rounded flex items-center justify-center ${isActionsDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <MessageCircleQuestion color="#F59E0B" strokeWidth={1} size={26} fill="none" />
                        </button>
                        {request.assigneeType === "QUEUE" && request.claimable === false && (
                          <button
                            type="button"
                            title="Release"
                            aria-label="Release"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowReleaseConfirm(true);
                            }}
                            className="p-1 rounded flex items-center justify-center"
                          >
                            <CircleArrowOutUpRight color="#8B5CF6" strokeWidth={1} size={26} fill="none" />
                          </button>
                        )}
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
                  <div className="px-4 py-3.5 space-y-3.5 text-sm">
                    {itemError && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
                        {itemError}
                      </div>
                    )}
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
                      value={request.details.justification || "No additional comments provided."}
                    />
                  </div>
                )}
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
              <IconDetailField
                icon={AtSign}
                label="Username"
                value={request.requesterUsername || "-"}
              />
              <IconDetailField
                icon={Hash}
                label="Employee ID"
                value={request.requesterEmployeeId || "-"}
              />
              <IconDetailField icon={Mail} label="Email" value={request.requesterEmail || "-"} />
              <IconDetailField
                icon={Building2}
                label="Department"
                value={request.requesterDepartment || "-"}
              />
              <IconDetailField
                icon={Briefcase}
                label="Job Title"
                value={request.requesterJobTitle || "-"}
              />
              <IconDetailField
                icon={UserCog}
                label="Manager"
                value={request.requesterManager || "-"}
              />
            </div>
          </div>
        )}

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

                      const submittingReviewerId = getReviewerId();
                      const response = await fetch(
                        `https://preview.keyforge.ai/workflow/api/v1/ACMECOM/approveraction/${String(submittingReviewerId ?? request.reviewerId).trim()}`,
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

        {showReleaseConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3"
            onClick={() => setShowReleaseConfirm(false)}
          >
            <div
              className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-gray-900">Release this task?</h3>
              <p className="mt-1.5 text-sm text-gray-600">
                It will go back to the queue for another reviewer to claim.
              </p>
              {releaseError && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                  {releaseError}
                </div>
              )}
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowReleaseConfirm(false)}
                  disabled={releaseLoading}
                  className="rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRelease}
                  disabled={releaseLoading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {releaseLoading ? "Releasing..." : "Release"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showClaimConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3"
            onClick={() => setShowClaimConfirm(false)}
          >
            <div
              className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-gray-900">Claim this task?</h3>
              <p className="mt-1.5 text-sm text-gray-600">
                You&apos;ll be assigned this request and it will no longer be available
                for other reviewers to claim.
              </p>
              {claimError && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                  {claimError}
                </div>
              )}
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowClaimConfirm(false)}
                  disabled={claimLoading}
                  className="rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={claimLoading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {claimLoading ? "Claiming..." : "Claim"}
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
