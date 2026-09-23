"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, SquarePen, FileText, Filter, Workflow } from "lucide-react";
import { executeQuery } from "@/lib/api";
import { useRouter } from "next/navigation";

const APPROVAL_POLICY_VIEW_STORAGE_KEY = "approvalPolicyViewDraft";

type ApprovalPolicyViewData = {
  id: string;
  name: string;
  owner: string;
  description: string;
  priority: number | null;
  status: string;
  code?: string;
  businessObjectType?: string;
  workflowTemplateName?: string;
  workflowTemplateCode?: string;
  workflowTemplateDescription?: string;
  /** Pretty-printed full contents of selector_json from the policy row */
  selectorJsonDisplay?: string;
  createdBy?: string;
  createdAt?: string;
  validFrom?: string;
  version?: number | null;
  isActive?: boolean | null;
};

const EMPTY_DATA: ApprovalPolicyViewData = {
  id: "",
  name: "",
  owner: "",
  description: "",
  priority: null,
  status: "",
  code: "",
  businessObjectType: "",
  workflowTemplateName: "",
  workflowTemplateCode: "",
  workflowTemplateDescription: "",
  selectorJsonDisplay: "",
  createdBy: "",
  createdAt: "",
  validFrom: "",
  version: null,
  isActive: null,
};

function formatPriority(priority: number | null): string {
  if (priority === null || priority === undefined) return "-";
  // If backend already stores 1-4 etc., just show as is
  return String(priority);
}

/** Format whatever the API stored in selector_json for read-only display */
function formatSelectorJsonForDisplay(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  let parsed: unknown = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(parsed);
  }
}

/** Resolve selector JSON from a policy row; API keys vary by driver/view */
function getSelectorJsonFromRaw(raw: Record<string, unknown>): unknown {
  const direct =
    raw.selector_json ?? raw.SELECTOR_JSON ?? raw.selectorJson;
  if (direct !== undefined && direct !== null) return direct;
  for (const key of Object.keys(raw)) {
    const lower = key.toLowerCase();
    if (lower === "selector_json" || lower === "selectorjson") {
      const v = raw[key];
      if (v !== undefined && v !== null) return v;
    }
    if (lower.includes("selector") && lower.includes("json")) {
      const v = raw[key];
      if (v !== undefined && v !== null) return v;
    }
  }
  return undefined;
}

function getWorkflowTemplateIdFromPolicyRaw(
  raw: Record<string, unknown> | null
): string | null {
  if (!raw) return null;
  const v =
    raw.wftemplate_id ??
    raw.wftemplateid ??
    raw.WFTEMPLATE_ID ??
    raw.workflow_template_id ??
    raw.WORKFLOW_TEMPLATE_ID;
  if (v !== undefined && v !== null && String(v).trim() !== "") {
    return String(v);
  }
  for (const key of Object.keys(raw)) {
    const lower = key.toLowerCase();
    if (
      lower === "wftemplate_id" ||
      lower === "wftemplateid" ||
      lower === "workflow_template_id"
    ) {
      const val = raw[key];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val);
      }
    }
  }
  return null;
}

function normalizeExecuteQueryRows(response: unknown): any[] {
  if (Array.isArray(response)) return response;
  if (
    response &&
    typeof response === "object" &&
    Array.isArray((response as { resultSet?: unknown }).resultSet)
  ) {
    return (response as { resultSet: any[] }).resultSet;
  }
  if (
    response &&
    typeof response === "object" &&
    Array.isArray((response as { rows?: unknown }).rows)
  ) {
    return (response as { rows: any[] }).rows;
  }
  return [];
}

type WorkflowFromApi = {
  name: string;
  code: string;
  description: string;
  stages?: number;
  steps?: Array<{
    stageName: string;
    stageOrder: number | null;
    stepLabel: string;
    stepTypeCode: string;
    stepKind: string;
    stepType: string;
  }>;
  businessObjectType?: string;
};

function mapTemplateRowToWorkflow(row: Record<string, unknown>): WorkflowFromApi {
  const name =
    String(
      row.wftemplatename ??
        row.wftemplate_name ??
        row.name ??
        row.code ??
        ""
    ) || "Workflow";
  const code = String(row.wftemplatecode ?? row.code ?? "");
  const description = String(
    row.wftemplatedescription ?? row.description ?? ""
  );
  let stages: number | undefined;
  let steps:
    | Array<{
        stageName: string;
        stageOrder: number | null;
        stepLabel: string;
        stepTypeCode: string;
        stepKind: string;
        stepType: string;
      }>
    | undefined;
  try {
    const def = row.definition_json;
    const parsedDef =
      typeof def === "string" && def
        ? JSON.parse(def)
        : def && typeof def === "object"
          ? def
          : null;
    if (parsedDef && Array.isArray((parsedDef as { stages?: unknown }).stages)) {
      const parsedStages = (parsedDef as { stages: unknown[] }).stages;
      stages = parsedStages.length;
      steps = [];
      parsedStages.forEach((stage, stageIndex) => {
        if (!stage || typeof stage !== "object") return;
        const stageObj = stage as Record<string, unknown>;
        const stageName = String(stageObj.name ?? `Stage ${stageIndex + 1}`);
        const parsedOrder =
          stageObj.order !== undefined && stageObj.order !== null
            ? Number(stageObj.order)
            : null;
        const stageOrder = Number.isFinite(parsedOrder) ? parsedOrder : null;
        const stageSteps = Array.isArray(stageObj.steps)
          ? (stageObj.steps as unknown[])
          : [];

        stageSteps.forEach((step, stepIndex) => {
          if (!step || typeof step !== "object") return;
          const stepObj = step as Record<string, unknown>;
          const rawCode = String(
            stepObj.code ?? stepObj.stepTypeCode ?? stepObj.id ?? stepObj.type ?? ""
          ).toUpperCase();
          const rawType = String(stepObj.type ?? "").toUpperCase();
          const inferKindAndType = (): { kind: string; type: string } => {
            if (rawType === "AI_AGENT" || rawCode.startsWith("AI_")) {
              return { kind: "AI", type: "AI AGENT" };
            }
            if (
              rawType === "APPROVAL" ||
              rawCode.startsWith("APPROVAL_") ||
              rawCode === "HUMAN_APPROVAL"
            ) {
              return { kind: "HUMAN", type: "APPROVAL" };
            }
            if (
              rawType === "FULFILL" ||
              rawType === "FULFILLMENT" ||
              rawCode.endsWith("FULFILLMENT") ||
              rawCode.startsWith("SCIM_")
            ) {
              return { kind: "SYSTEM", type: "FULFILLMENT" };
            }
            if (rawType === "CUSTOM") {
              return { kind: "SYSTEM", type: "CUSTOM" };
            }
            return { kind: "SYSTEM", type: "LOGIC" };
          };
          const inferred = inferKindAndType();
          steps!.push({
            stageName,
            stageOrder,
            stepLabel: String(
              stepObj.label ??
                stepObj.name ??
                stepObj.id ??
                stepObj.code ??
                `Step ${stepIndex + 1}`
            ),
            stepTypeCode: rawCode || "N/A",
            stepKind: String(stepObj.kind ?? inferred.kind),
            stepType: String(stepObj.type ?? inferred.type).replaceAll("_", " "),
          });
        });
      });
    }
  } catch {
    // ignore
  }
  const businessObjectType = String(
    row.business_object_type ?? row.business_function ?? ""
  );
  return {
    name,
    code,
    description,
    ...(stages !== undefined ? { stages } : {}),
    ...(steps && steps.length > 0 ? { steps } : {}),
    ...(businessObjectType ? { businessObjectType } : {}),
  };
}

async function fetchPolicyRowFromView(
  policyId: string
): Promise<Record<string, unknown> | null> {
  const queries: { query: string; parameters: string[] }[] = [
    {
      query: "select * from kf_wf_approval_policy_vw where id = ?::uuid",
      parameters: [policyId],
    },
    {
      query: "select * from kf_wf_approval_policy_vw where id = ?",
      parameters: [policyId],
    },
    {
      query: "select * from kf_wf_approval_policy_vw where policy_id = ?::uuid",
      parameters: [policyId],
    },
    {
      query: "select * from kf_wf_approval_policy_vw where policy_id = ?",
      parameters: [policyId],
    },
  ];
  for (const { query, parameters } of queries) {
    try {
      const response = await executeQuery<unknown>(query, parameters);
      const rows = normalizeExecuteQueryRows(response);
      if (rows.length) return rows[0] as Record<string, unknown>;
    } catch {
      // try next
    }
  }
  return null;
}

async function fetchWorkflowTemplateById(
  templateId: string
): Promise<WorkflowFromApi | null> {
  const response = await executeQuery<unknown>(
    "select * from public.kf_wf_template_t",
    []
  );
  const rows = normalizeExecuteQueryRows(response);
  const row = rows.find((r: Record<string, unknown>) => {
    const rid = String(
      r.id ?? r.wftemplateid ?? r.template_id ?? ""
    ).trim();
    return rid === templateId.trim();
  });
  if (!row) return null;
  return mapTemplateRowToWorkflow(row as Record<string, unknown>);
}

export default function ApprovalPolicyReviewPage() {
  const router = useRouter();
  const [data, setData] = useState<ApprovalPolicyViewData>(EMPTY_DATA);
  const [hasData, setHasData] = useState(false);
  const [policyRaw, setPolicyRaw] = useState<Record<string, unknown> | null>(
    null
  );
  const [workflowFromApi, setWorkflowFromApi] =
    useState<WorkflowFromApi | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(APPROVAL_POLICY_VIEW_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as {
        id?: string;
        name?: string;
        owner?: string;
        description?: string;
        priority?: number | null;
        status?: string;
        raw?: Record<string, unknown> | null;
        selector_json?: unknown;
      };

      const raw = (parsed.raw ?? null) as Record<string, unknown> | null;
      setPolicyRaw(raw);

      let code = "";
      let businessObjectType = "";
      let wfName = "";
      let wfCode = "";
      let wfDescription = "";
      let selectorJsonDisplay = "";
      let createdBy = "";
      let createdAt = "";
      let validFrom = "";
      let version: number | null = null;
      let isActive: boolean | null = null;

      if (raw && typeof raw === "object") {
        code = String(raw.code ?? "");
        businessObjectType = String(raw.business_object_type ?? "");
        wfName = String(raw.wftemplatename ?? raw.wftemplate_name ?? "");
        wfCode = String(raw.wftemplatecode ?? "");
        wfDescription = String(raw.wftemplatedescription ?? "");
        createdBy = String(raw.created_by ?? "");
        createdAt = String(raw.created_at ?? "");
        validFrom = String(raw.valid_from ?? "");
        version =
          raw.version !== undefined && raw.version !== null
            ? Number(raw.version)
            : null;
        if (raw.is_active !== undefined && raw.is_active !== null) {
          isActive = Boolean(raw.is_active);
        }

        const selectorRaw = getSelectorJsonFromRaw(raw);
        const formatted = formatSelectorJsonForDisplay(selectorRaw);
        if (formatted !== null) {
          selectorJsonDisplay = formatted;
        }
      }

      if (!selectorJsonDisplay && parsed.selector_json !== undefined && parsed.selector_json !== null) {
        const formatted = formatSelectorJsonForDisplay(parsed.selector_json);
        if (formatted !== null) selectorJsonDisplay = formatted;
      }

      const normalized: ApprovalPolicyViewData = {
        id: parsed.id ?? "",
        name: parsed.name ?? "",
        owner: parsed.owner ?? "",
        description: parsed.description ?? "",
        priority: parsed.priority ?? null,
        status: parsed.status ?? "",
        code,
        businessObjectType,
        workflowTemplateName: wfName,
        workflowTemplateCode: wfCode,
        workflowTemplateDescription: wfDescription,
        selectorJsonDisplay,
        createdBy,
        createdAt,
        validFrom,
        version,
        isActive,
      };

      setData(normalized);
      setHasData(true);
    } catch (error) {
      console.error("Unable to load approval policy review data:", error);
    }
  }, []);

  useEffect(() => {
    if (!hasData || !data.id) return;

    let cancelled = false;

    const loadWorkflow = async () => {
      setWorkflowLoading(true);
      setWorkflowError(null);

      try {
        let templateId = getWorkflowTemplateIdFromPolicyRaw(policyRaw);

        if (!templateId) {
          const refreshed = await fetchPolicyRowFromView(data.id);
          if (!cancelled && refreshed) {
            templateId = getWorkflowTemplateIdFromPolicyRaw(refreshed);
          }
        }

        if (!templateId) {
          if (!cancelled) setWorkflowFromApi(null);
          return;
        }

        const wf = await fetchWorkflowTemplateById(templateId);
        if (!cancelled) setWorkflowFromApi(wf);
      } catch (e: unknown) {
        if (!cancelled) {
          setWorkflowError(
            e instanceof Error ? e.message : "Failed to load workflow template."
          );
          setWorkflowFromApi(null);
        }
      } finally {
        if (!cancelled) setWorkflowLoading(false);
      }
    };

    void loadWorkflow();

    return () => {
      cancelled = true;
    };
  }, [hasData, data.id, policyRaw]);

  const displayWorkflow: WorkflowFromApi | null =
    workflowFromApi ??
    (data.workflowTemplateName
      ? {
          name: data.workflowTemplateName,
          code: data.workflowTemplateCode ?? "",
          description: data.workflowTemplateDescription ?? "",
        }
      : null);

  const groupedWorkflowSteps = (displayWorkflow?.steps ?? []).reduce<
    Array<{
      stageName: string;
      stageOrder: number | null;
      steps: Array<{
        stepLabel: string;
        stepTypeCode: string;
        stepKind: string;
        stepType: string;
      }>;
    }>
  >((acc, step) => {
    const key = `${step.stageName}::${step.stageOrder ?? "na"}`;
    const existing = acc.find(
      (group) => `${group.stageName}::${group.stageOrder ?? "na"}` === key
    );
    const stepData = {
      stepLabel: step.stepLabel,
      stepTypeCode: step.stepTypeCode,
      stepKind: step.stepKind,
      stepType: step.stepType,
    };
    if (existing) {
      existing.steps.push(stepData);
      return acc;
    }
    acc.push({
      stageName: step.stageName,
      stageOrder: step.stageOrder,
      steps: [stepData],
    });
    return acc;
  }, []);

  groupedWorkflowSteps.sort((a, b) => {
    if (a.stageOrder == null && b.stageOrder == null) return 0;
    if (a.stageOrder == null) return 1;
    if (b.stageOrder == null) return -1;
    return a.stageOrder - b.stageOrder;
  });

  const stageHeaderColorClasses = [
    "bg-slate-800 text-white",
    "bg-amber-500 text-white",
    "bg-blue-600 text-white",
    "bg-emerald-600 text-white",
    "bg-violet-600 text-white",
    "bg-rose-600 text-white",
  ];

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 to-gray-100">
      <div className="mx-auto w-full max-w-6xl">
        <div className="space-y-4 px-6">
        <div className="flex items-center justify-end gap-2 mb-1">
          <div className="flex items-center gap-2">
            {hasData && (
              <button
                type="button"
                onClick={() =>
                  router.push("/settings/gateway/manage-approval-policies?edit=1")
                }
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <SquarePen className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            {hasData && (
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 shrink-0">
                {data.id || "Policy"}
              </span>
            )}
          </div>
        </div>

        {/* Legacy back button row removed and replaced with header above */}
        {/* <div className="pt-4 px-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Approval Policies
          </button>
        </div> */}

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
          {!hasData ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <p>No approval policy selected. Please use the View action from the Approval Policy page.</p>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Approval Policy summary */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 border-l-4 border-l-blue-400 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-100 text-blue-700">
                    <FileText className="w-4 h-4" />
                  </span>
                  <h4 className="text-sm font-semibold text-gray-900">Approval Policy</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
                    <div className="text-gray-600 font-medium mb-1">Name</div>
                    <div className="text-gray-900 break-words">
                      {data.name || <span className="text-gray-400">Not provided</span>}
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
                    <div className="text-gray-600 font-medium mb-1">Owner</div>
                    <div className="text-gray-900 break-words">
                      {data.owner || <span className="text-gray-400">Not provided</span>}
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
                    <div className="text-gray-600 font-medium mb-1">Priority</div>
                    <div className="text-gray-900">{formatPriority(data.priority)}</div>
                  </div>
                  <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
                    <div className="text-gray-600 font-medium mb-1">Status</div>
                    {data.status ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          data.status.toLowerCase() === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : data.status.toLowerCase() === "inactive"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {data.status}
                      </span>
                    ) : (
                      <span className="text-gray-400">Not provided</span>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50 md:col-span-2">
                    <div className="text-gray-600 font-medium mb-1">Description</div>
                    <div className="text-gray-900 break-words whitespace-pre-wrap">
                      {data.description || <span className="text-gray-400">Not provided</span>}
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
                    <div className="text-gray-600 font-medium mb-1">Policy Code</div>
                    <div className="text-gray-900 break-words">
                      {data.code || <span className="text-gray-400">Not provided</span>}
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
                    <div className="text-gray-600 font-medium mb-1">Business Object Type</div>
                    <div className="text-gray-900 break-words">
                      {data.businessObjectType || <span className="text-gray-400">Not provided</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Conditions: full selector_json from the policy row */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 border-l-4 border-l-purple-400 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-md bg-purple-100 text-purple-700">
                    <Filter className="w-4 h-4" />
                  </span>
                  <h4 className="text-sm font-semibold text-gray-900">Conditions</h4>
                </div>
                {data.selectorJsonDisplay ? (
                  <pre className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-[11px] text-gray-800 whitespace-pre-wrap overflow-auto max-h-96 font-mono leading-relaxed">
                    {data.selectorJsonDisplay}
                  </pre>
                ) : (
                  <p className="text-gray-400">
                    No selector_json on this policy. This policy may apply when no more specific selector matches.
                  </p>
                )}
              </div>

              {/* Attached workflow — loaded from kf_wf_template_t via API when possible */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 border-l-4 border-l-indigo-400 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-md bg-indigo-100 text-indigo-700">
                    <Workflow className="w-4 h-4" />
                  </span>
                  <h4 className="text-sm font-semibold text-gray-900">
                    Attached Workflow
                  </h4>
                </div>
                {workflowLoading && !displayWorkflow ? (
                  <p className="text-xs text-gray-500">Loading workflow…</p>
                ) : (
                  <>
                    {workflowError && (
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mb-2">
                        {workflowError}
                      </p>
                    )}
                    {workflowLoading && displayWorkflow && (
                      <p className="text-xs text-gray-500 mb-2">Refreshing workflow…</p>
                    )}
                    {displayWorkflow ? (
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-gray-900">
                          {displayWorkflow.name}
                          {displayWorkflow.code
                            ? ` (${displayWorkflow.code})`
                            : ""}
                        </div>
                        {displayWorkflow.description ? (
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">
                            {displayWorkflow.description}
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {displayWorkflow.stages != null && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-medium">
                              Stages: {displayWorkflow.stages}
                            </span>
                          )}
                          {(displayWorkflow.businessObjectType ||
                            data.businessObjectType) && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium">
                              {displayWorkflow.businessObjectType ??
                                data.businessObjectType}
                            </span>
                          )}
                          {data.version != null && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium">
                              Version: {data.version}
                            </span>
                          )}
                        </div>
                        {groupedWorkflowSteps.length > 0 && (
                          <div className="mt-2 w-full rounded-md border border-gray-200 bg-gray-50 p-2.5">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Workflow Steps
                            </p>
                            <div className="w-full min-w-0 overflow-hidden">
                              <div className="w-full flex flex-nowrap items-center gap-1.5 sm:gap-2">
                                <div className="h-18 w-18 shrink-0 rounded-full border-2 border-slate-200 bg-white text-center flex items-center justify-center px-1.5">
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700 leading-tight">
                                    Request Submitted
                                  </span>
                                </div>
                                <span className="text-slate-400 text-base shrink-0 self-center">→</span>

                                {groupedWorkflowSteps.map((group, groupIdx) => (
                                  <React.Fragment key={`${group.stageName}-${groupIdx}`}>
                                    <div className="min-w-0 flex-1">
                                      <div
                                        className={`rounded-md px-2.5 py-2 text-center text-[11px] font-semibold ${
                                          stageHeaderColorClasses[
                                            groupIdx % stageHeaderColorClasses.length
                                          ]
                                        }`}
                                      >
                                        {group.stageName}
                                      </div>
                                      <div className="mt-2 space-y-2">
                                        {group.steps.map((step, stepIdx) => (
                                          <div
                                            key={`${group.stageName}-${step.stepLabel}-${stepIdx}`}
                                            className={`rounded-md border px-2.5 py-2 text-center ${
                                              groupIdx % 2 === 0
                                                ? "border-slate-200 bg-white"
                                                : "border-amber-200 bg-amber-50/40"
                                            }`}
                                          >
                                            <div className="text-xs font-semibold text-slate-700 leading-tight">
                                              {step.stepLabel}
                                            </div>
                                            <div className="mt-1 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-800">
                                              {step.stepTypeCode}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    {groupIdx < groupedWorkflowSteps.length - 1 && (
                                      <span className="text-slate-400 text-base shrink-0 self-center">→</span>
                                    )}
                                  </React.Fragment>
                                ))}

                                <span className="text-slate-400 text-base shrink-0 self-center">→</span>
                                <div className="h-18 w-18 shrink-0 rounded-full border-2 border-slate-200 bg-white text-center flex items-center justify-center px-1.5">
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700 leading-tight">
                                    Request Completed
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">
                        No workflow template linked to this policy, or template id
                        could not be resolved.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

