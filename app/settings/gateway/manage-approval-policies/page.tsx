"use client";

import React, { useEffect, useMemo, useState } from "react";
import { themeQuartz } from "ag-grid-community";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useForm, Control, FieldValues, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Check, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { asterisk, downArrow } from "@/utils/utils";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";
import ExpressionBuilder from "@/components/ExpressionBuilder";
import { executeQuery } from "@/lib/api";
import type { ColDef } from "ag-grid-community";

type Status = "Staging" | "Active" | "Inactive";
type Priority = "Low" | "Medium" | "High" | "Critical";

type ConditionSubject =
  | "Request Type"
  | "Application"
  | "Entitlement"
  | "Service Account"
  | "User";

type Operand =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "in"
  | "not_in";

interface ConditionRule {
  id: string;
  subject: ConditionSubject;
  attribute: string;
  operand: Operand;
  value: string;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  stages?: number;
  businessFunction?: string;
  tags?: string[];
  owner?: string;
  raw?: any;
}

const ATTRIBUTE_OPTIONS: Record<ConditionSubject, string[]> = {
  "Request Type": ["Type", "Channel", "Urgency", "Risk"],
  Application: ["Name", "Category", "Risk", "Region"],
  Entitlement: ["Name", "Type", "Risk", "SoD Flag"],
  "Service Account": ["Name", "System", "Criticality"],
  User: ["Department", "Location", "Job Title", "Manager", "Employment Type"],
};

// Attribute options for ExpressionBuilder (reuse existing builder attributes)
const EXPRESSION_ATTRIBUTES: Partial<
  Record<ConditionSubject, { label: string; value: string }[]>
> = {
  Application: [
    { label: "Risk", value: "risk" },
    { label: "Pre-Requisite", value: "pre_requisite" },
    { label: "Shared Pwd", value: "shared_pwd" },
    { label: "Regulatory Scope", value: "regulatory_scope" },
    { label: "Access Scope", value: "access_scope" },
    { label: "Review Schedule", value: "review_schedule" },
    { label: "Business Unit", value: "business_unit" },
    { label: "Data Classification", value: "data_classification" },
    { label: "Privileged", value: "privileged" },
    { label: "Non Persistent Access", value: "non_persistent_access" },
    { label: "License Type", value: "license_type" },
    { label: "Tags", value: "tags" },
  ],
  Entitlement: [
    { label: "Risk", value: "risk" },
    { label: "Pre-Requisite", value: "pre_requisite" },
    { label: "Shared Pwd", value: "shared_pwd" },
    { label: "Regulatory Scope", value: "regulatory_scope" },
    { label: "Access Scope", value: "access_scope" },
    { label: "Review Schedule", value: "review_schedule" },
    { label: "Business Unit", value: "business_unit" },
    { label: "Data Classification", value: "data_classification" },
    { label: "Privileged", value: "privileged" },
    { label: "Non Persistent Access", value: "non_persistent_access" },
    { label: "License Type", value: "license_type" },
    { label: "Tags", value: "tags" },
  ],
};

const OPERAND_OPTIONS: { value: Operand; label: string }[] = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not equals" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
  { value: "in", label: "In (comma separated)" },
  { value: "not_in", label: "Not in (comma separated)" },
];

// Fallback workflows used only if API call fails or returns no rows
const FALLBACK_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "wf-fallback-standard",
    name: "Standard Access Workflow",
    description: "Default multi-stage approval workflow.",
    stages: 3,
    businessFunction: "ACCESS_REQUEST",
    tags: ["fallback"],
    owner: "System",
  },
];

interface ApprovalPolicyFormData {
  step1: {
    name: string;
    description: string;
    owner: string;
    tags: string;
    priority: Priority;
    status: Status;
  };
  step2: {
    rules: ConditionRule[];
  };
  step3: {
    selectedWorkflowId: string | null;
  };
}

const APPROVAL_POLICY_VIEW_STORAGE_KEY = "approvalPolicyViewDraft";

/** Match policy row FK to workflow grid row id (kf_wf_template_t) */
function getWorkflowTemplateIdFromPolicyRow(row: unknown): string | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const v =
    r.wftemplate_id ??
    r.wftemplateid ??
    r.WFTEMPLATE_ID ??
    r.workflow_template_id ??
    r.WORKFLOW_TEMPLATE_ID;
  if (v !== undefined && v !== null && String(v).trim() !== "") {
    return String(v).trim();
  }
  return null;
}

export default function ManageApprovalPoliciesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"list" | "create">("list");
  const [policies, setPolicies] = useState<
    {
      id: string;
      name: string;
      description: string | null;
      owner: string | null;
      priority: number | null;
      status: string | null;
      /** Carried through for Review page Conditions (selector_json from view/API) */
      selector_json?: unknown;
      /** FK to kf_wf_template_t for Review page Attached Workflow */
      wftemplate_id?: string;
    }[]
  >([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ApprovalPolicyFormData>({
    step1: {
      name: "",
      description: "",
      owner: "",
      tags: "",
      priority: "Medium",
      status: "Staging",
    },
    step2: {
      rules: [
        {
          id: `rule-${Date.now()}`,
          subject: "Request Type",
          attribute: "Type",
          operand: "equals",
          value: "Access Request",
        },
      ],
    },
    step3: {
      selectedWorkflowId: null,
    },
  });
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [workflowRows, setWorkflowRows] = useState<WorkflowDefinition[]>([]);
  const { isVisible: isSidebarVisible, sidebarWidthPx } = useLeftSidebar();
  const reviewEditRequested = searchParams.get("edit") === "1";

  const AgGridReact = useMemo(
    () => dynamic(() => import("ag-grid-react").then((mod) => mod.AgGridReact), { ssr: false }),
    []
  );

  // Expression builder state (Define Condition)
  const {
    control: conditionControl,
    setValue: conditionSetValue,
    watch: conditionWatch,
  } = useForm({
    defaultValues: {
      approvalConditions: [] as any[],
    },
  });

  const [conditionSubject, setConditionSubject] = useState<ConditionSubject>("Request Type");
  const approvalConditions = (conditionWatch("approvalConditions") as any[]) || [];

  const onEditPolicy = (row: any) => {
    setMode("create");
    setCurrentStep(1);

    const linkedWorkflowId = getWorkflowTemplateIdFromPolicyRow(row);

    setFormData({
      step1: {
        name: row.name || "",
        description: row.description || "",
        owner: row.owner || "",
        tags: "", // tags not available from view yet
        priority:
          (row.priority as Priority) && ["Low", "Medium", "High", "Critical"].includes(String(row.priority))
            ? (row.priority as Priority)
            : "Medium",
        status:
          (row.status as Status) && ["Staging", "Active", "Inactive"].includes(String(row.status))
            ? (row.status as Status)
            : "Staging",
      },
      step2: {
        // Conditions not yet modeled in view; start empty
        rules: [],
      },
      step3: {
        selectedWorkflowId: linkedWorkflowId,
      },
    });

    conditionSetValue("approvalConditions", [], {
      shouldDirty: false,
      shouldValidate: false,
    });
    setWorkflowSearch("");
  };

  useEffect(() => {
    if (!reviewEditRequested) return;
    try {
      const raw = localStorage.getItem(APPROVAL_POLICY_VIEW_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { raw?: Record<string, unknown> };
      const draftRow = parsed?.raw;
      if (!draftRow || typeof draftRow !== "object") return;
      onEditPolicy(draftRow);
    } catch (error) {
      console.error("Unable to load approval policy edit draft:", error);
    }
  }, [reviewEditRequested]);

  const approvalListColumnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Name",
        field: "name",
        flex: 2,
        minWidth: 260,
        colSpan: (params: any) =>
          params.data?._rowType === "description" ? 5 : 1,
        cellRenderer: (params: any) => {
          const rowType = params.data?._rowType || "main";
          const name = params.data?.name || "";
          const description = params.data?.description || "";

          if (rowType === "description") {
            return (
              <div className="text-sm text-gray-600 py-1">
                {description || "Not provided"}
              </div>
            );
          }

          return (
            <span className="font-medium text-gray-900">{name}</span>
          );
        },
      },
      { headerName: "Owner", field: "owner", flex: 0.6, minWidth: 100, maxWidth: 200 },
      { headerName: "Priority", field: "priority", width: 160, minWidth: 140 },
      { headerName: "Status", field: "status", width: 140 },
      {
        headerName: "Action",
        field: "actions",
        width: 140,
        cellRenderer: (params: any) => {
          if (params.data?._rowType === "description") {
            return null;
          }
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="View approval policy"
                onClick={() => {
                  const row = params.data;
                  if (!row) return;
                  try {
                    const r = row as Record<string, unknown>;
                    const selectorJson =
                      r.selector_json ?? r.SELECTOR_JSON ?? r.selectorJson;
                    localStorage.setItem(
                      APPROVAL_POLICY_VIEW_STORAGE_KEY,
                      JSON.stringify({
                        id: row.id,
                        name: row.name,
                        owner: row.owner ?? "",
                        description: row.description ?? "",
                        priority: row.priority,
                        status: row.status ?? "",
                        ...(selectorJson !== undefined && selectorJson !== null
                          ? { selector_json: selectorJson }
                          : {}),
                        raw: row,
                      })
                    );
                  } catch (error) {
                    console.error("Unable to save approval policy view draft:", error);
                  }
                  router.push("/settings/gateway/manage-approval-policies/review");
                }}
              >
                <Eye className="w-4 h-4 text-gray-700" />
              </button>
            </div>
          );
        },
      },
    ],
    [onEditPolicy]
  );

  const approvalListRows = useMemo(
    () =>
      policies.flatMap((p) => [
        { ...p, _rowType: "main" },
        { ...p, _rowType: "description" },
      ]),
    [policies]
  );

  // Load policies list from API when in list mode
  useEffect(() => {
    if (mode !== "list") return;

    const fetchPolicies = async () => {
      try {
        setIsLoadingList(true);
        setListError(null);

        const query = "select * from kf_wf_approval_policy_vw order by ?";
        const parameters = [" "];

        const response = await executeQuery<any>(query, parameters);
        const rows: any[] =
          Array.isArray(response)
            ? response
            : Array.isArray((response as any).resultSet)
            ? (response as any).resultSet
            : Array.isArray((response as any).rows)
            ? (response as any).rows
            : [];

        const normalized = rows.map((row, idx) => {
          const id =
            row.id ??
            row.policy_id ??
            row.policyid ??
            row.code ??
            row.POLICY_ID ??
            idx;

          const name =
            row.policy_name ??
            row.POLICY_NAME ??
            row.name ??
            row.NAME ??
            "Unnamed Policy";

          const description =
            row.policy_description ??
            row.POLICY_DESCRIPTION ??
            row.description ??
            row.DESCRIPTION ??
            null;

          const owner =
            row.owner ??
            row.OWNER ??
            row.created_by ??
            row.CREATED_BY ??
            null;

          const priorityRaw =
            row.priority ??
            row.PRIORITY ??
            row.priority_level ??
            null;

          const status =
            row.status ??
            row.STATUS ??
            row.policy_status ??
            row.STATE ??
            null;

          const selectorJson =
            row.selector_json ??
            row.SELECTOR_JSON ??
            row.selectorJson ??
            null;

          const wfTemplateId =
            row.wftemplate_id ??
            row.wftemplateid ??
            row.WFTEMPLATE_ID ??
            row.workflow_template_id ??
            row.WORKFLOW_TEMPLATE_ID ??
            null;

          return {
            id: String(id),
            name: String(name),
            description: description ? String(description) : null,
            owner: owner ? String(owner) : null,
            priority:
              priorityRaw !== undefined && priorityRaw !== null
                ? Number(priorityRaw)
                : null,
            status: status ? String(status) : null,
            ...(selectorJson !== undefined && selectorJson !== null
              ? { selector_json: selectorJson }
              : {}),
            ...(wfTemplateId !== undefined &&
            wfTemplateId !== null &&
            String(wfTemplateId).trim() !== ""
              ? { wftemplate_id: String(wfTemplateId) }
              : {}),
          };
        });

        setPolicies(normalized);
      } catch (e: any) {
        console.error("Failed to load approval policies:", e);
        setListError(
          e?.message ||
            "Failed to load approval policies from executeQuery API."
        );
      } finally {
        setIsLoadingList(false);
      }
    };

    fetchPolicies();
  }, [mode]);

  const steps = [
    { id: 1, title: "Define Approval Policy" },
    { id: 2, title: "Define Condition" },
    { id: 3, title: "Attach Workflow" },
    { id: 4, title: "Review and Submit" },
  ];

  const currentWorkflow = useMemo(
    () => {
      const source = workflowRows.length ? workflowRows : FALLBACK_WORKFLOWS;
      return source.find((wf) => wf.id === formData.step3.selectedWorkflowId) || null;
    },
    [formData.step3.selectedWorkflowId, workflowRows]
  );

  const filteredWorkflows = useMemo(() => {
    const source = workflowRows.length ? workflowRows : FALLBACK_WORKFLOWS;
    const query = workflowSearch.trim().toLowerCase();
    if (!query) return source;
    return source.filter((wf) => {
      const haystack = [
        wf.name,
        wf.description,
        wf.businessFunction ?? "",
        wf.owner ?? "",
        (wf.tags ?? []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [workflowSearch, workflowRows]);

  // Load workflow templates from API when on Step 3
  useEffect(() => {
    if (mode !== "create" || (currentStep !== 3 && !reviewEditRequested)) return;

    let cancelled = false;

    const loadWorkflows = async () => {
      try {
        const query = "select * from public.kf_wf_template_t";
        const parameters: any[] = [];
        const response = await executeQuery<any>(query, parameters);
        const rows: any[] = Array.isArray(response)
          ? response
          : Array.isArray((response as any).resultSet)
          ? (response as any).resultSet
          : Array.isArray((response as any).rows)
          ? (response as any).rows
          : [];

        if (cancelled || !rows.length) {
          if (!cancelled) setWorkflowRows([]);
          return;
        }

        const mapped: WorkflowDefinition[] = rows.map((row, idx) => {
          const id =
            row.id ??
            row.wftemplateid ??
            row.template_id ??
            row.code ??
            `wf-${idx}`;

          const name =
            row.wftemplatename ??
            row.wftemplate_name ??
            row.name ??
            row.code ??
            `Workflow ${idx + 1}`;

          const description =
            row.wftemplatedescription ??
            row.description ??
            "";

          // Derive stages count from definition_json.stages (preferred) or other hints
          let stages: number | undefined;
          try {
            const def = row.definition_json;
            const parsedDef =
              typeof def === "string" && def
                ? JSON.parse(def)
                : def && typeof def === "object"
                ? def
                : null;

            if (parsedDef && Array.isArray((parsedDef as any).stages)) {
              stages = (parsedDef as any).stages.length;
            }
          } catch {
            // ignore JSON parse errors, leave stages undefined
          }

          const businessFunction =
            row.business_object_type ??
            row.business_function ??
            "";

          const owner = row.created_by ?? row.owner ?? "";

          return {
            id: String(id),
            name: String(name),
            description: String(description),
            stages,
            businessFunction: businessFunction ? String(businessFunction) : undefined,
            tags: undefined,
            owner: owner ? String(owner) : undefined,
            raw: row,
          };
        });

        setWorkflowRows(mapped);
      } catch (error) {
        console.error("Failed to load workflow templates for Step 3:", error);
        setWorkflowRows([]);
      }
    };

    loadWorkflows();

    return () => {
      cancelled = true;
    };
  }, [mode, currentStep, reviewEditRequested]);

  // After templates load on step 3, align selection with grid row ids (edit flow)
  useEffect(() => {
    if (mode !== "create" || currentStep !== 3) return;
    if (!workflowRows.length) return;

    setFormData((prev) => {
      const sel = prev.step3.selectedWorkflowId;
      if (!sel) return prev;
      if (workflowRows.some((w) => w.id === sel)) return prev;

      const match = workflowRows.find((w) => {
        const raw = w.raw as Record<string, unknown> | undefined;
        const candidates = [
          w.id,
          raw?.id,
          raw?.wftemplateid,
          raw?.template_id,
        ]
          .filter((x) => x !== undefined && x !== null)
          .map((x) => String(x).trim());
        return candidates.some((c) => c === sel);
      });

      if (!match) return prev;
      if (match.id === sel) return prev;
      return {
        ...prev,
        step3: { selectedWorkflowId: match.id },
      };
    });
  }, [mode, currentStep, workflowRows]);

  const addRule = () => {
    setFormData((prev) => ({
      ...prev,
      step2: {
        rules: [
          ...prev.step2.rules,
          {
            id: `rule-${Date.now()}`,
            subject: "Request Type",
            attribute: "Type",
            operand: "equals",
            value: "",
          },
        ],
      },
    }));
  };

  const updateRule = <K extends keyof ConditionRule>(
    id: string,
    field: K,
    value: ConditionRule[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      step2: {
        rules: prev.step2.rules.map((rule) =>
          rule.id === id
            ? {
                ...rule,
                [field]: value,
                ...(field === "subject"
                  ? {
                      attribute:
                        ATTRIBUTE_OPTIONS[value as ConditionSubject][0] || "",
                    }
                  : null),
              }
            : rule
        ),
      },
    }));
  };

  const removeRule = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      step2: {
        rules:
          prev.step2.rules.length > 1
            ? prev.step2.rules.filter((rule) => rule.id !== id)
            : prev.step2.rules,
      },
    }));
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1: {
        const { name, description, owner, priority, status } = formData.step1;
        return (
          !!name.trim() &&
          !!description.trim() &&
          !!owner.trim() &&
          !!priority &&
          !!status
        );
      }
      case 2: {
        return formData.step2.rules.every(
          (rule) =>
            !!rule.subject &&
            !!rule.attribute &&
            !!rule.operand &&
            !!rule.value.trim()
        );
      }
      case 3:
        return !!formData.step3.selectedWorkflowId;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = () => {
    const payload = {
      name: formData.step1.name,
      description: formData.step1.description,
      owner: formData.step1.owner,
      tags: formData.step1.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      priority: formData.step1.priority,
      status: formData.step1.status,
      conditions: formData.step2.rules,
      workflow: currentWorkflow,
    };

    // In a real implementation this would POST to an API.
    // For now we log and show a confirmation.
    console.log("Approval policy payload", payload);
    alert("Approval policy saved successfully.");
  };

  const renderConditionsPreview = () => {
    if (!approvalConditions.length) {
      return "No conditions defined.";
    }

    const subjectToken = conditionSubject.replace(/\s+/g, "_").toLowerCase();

    return approvalConditions
      .map((cond: any, index: number) => {
        const logicalOp = cond.logicalOp || (index === 0 ? "" : "AND");
        const attributeToken = cond.attribute?.value
          ? String(cond.attribute.value).replace(/\s+/g, "_").toLowerCase()
          : "attribute";
        const operator = cond.operator?.value || "equals";
        const value = cond.value || "";

        const field = `${subjectToken}.${attributeToken}`;

        let expr: string;
        switch (operator) {
          case "equals":
            expr = `${field} == "${value}"`;
            break;
          case "not_equals":
            expr = `${field} != "${value}"`;
            break;
          case "contains":
            expr = `${field}.contains("${value}")`;
            break;
          case "excludes":
            expr = `!${field}.contains("${value}")`;
            break;
          case "starts_with":
            expr = `${field}.startsWith("${value}")`;
            break;
          case "ends_with":
            expr = `${field}.endsWith("${value}")`;
            break;
          case "in":
            expr = `${field} in ["${value}"]`;
            break;
          case "not_in":
            expr = `${field} !in ["${value}"]`;
            break;
          default:
            expr = `${field} == "${value}"`;
        }

        return logicalOp && index > 0 ? `${logicalOp} ${expr}` : expr;
      })
      .join(" ");
  };

  const renderStep = () => {
    if (currentStep === 1) {
      return (
        <div className="w-full py-3 px-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Approval Policy Details
            </h2>

            <div className="space-y-4 text-sm">
              <div>
                <label
                  className={`block text-sm font-medium text-gray-700 mb-1 ${asterisk}`}
                >
                  Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.step1.name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, name: e.target.value },
                    }))
                  }
                  placeholder="e.g. High-Risk SAP Access Approval"
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium text-gray-700 mb-1 ${asterisk}`}
                >
                  Description
                </label>
                <textarea
                  className="form-input resize-y"
                  rows={3}
                  value={formData.step1.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, description: e.target.value },
                    }))
                  }
                  placeholder="Short description of when and how this approval policy should be used."
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium text-gray-700 mb-1 ${asterisk}`}
                >
                  Owner
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.step1.owner}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, owner: e.target.value },
                    }))
                  }
                  placeholder="e.g. IAM Team / Risk Office"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.step1.tags}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, tags: e.target.value },
                    }))
                  }
                  placeholder="Comma-separated tags, e.g. sox, high-risk, sap"
                />
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div className="w-full md:w-1/3">
                  <label
                    className={`block text-sm font-medium text-gray-700 mb-1 ${asterisk}`}
                  >
                    Priority
                  </label>
                  <select
                    className="form-input bg-white"
                    value={formData.step1.priority}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        step1: {
                          ...prev.step1,
                          priority: e.target.value as Priority,
                        },
                      }))
                    }
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div className="flex-1">
                  <label
                    className={`block text-sm font-medium text-gray-700 mb-2 ${asterisk}`}
                  >
                    Status
                  </label>
                  <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                    {(["Staging", "Active", "Inactive"] as Status[]).map(
                      (status, index, array) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              step1: { ...prev.step1, status },
                            }))
                          }
                          className={`relative px-4 py-2 text-xs font-medium border-r last:border-r-0 ${
                            formData.step1.status === status
                              ? `bg-[#15274E] text-white ${downArrow}`
                              : "bg-white text-gray-700"
                          } ${
                            index === 0
                              ? "rounded-l-md"
                              : index === array.length - 1
                              ? "rounded-r-md"
                              : ""
                          }`}
                        >
                          {status}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="w-full py-3 px-3 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap mr-1">
              Condition Rule
            </label>
            <select
              className="form-input w-56 bg-white"
              value={conditionSubject}
              onChange={(e) =>
                setConditionSubject(e.target.value as ConditionSubject)
              }
            >
              {(
                [
                  "Request Type",
                  "Application",
                  "Entitlement",
                  "Service Account",
                  "User",
                ] as ConditionSubject[]
              ).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <ExpressionBuilder
            title="Build Expression"
            control={
              conditionControl as unknown as Control<FieldValues>
            }
            setValue={
              conditionSetValue as unknown as UseFormSetValue<FieldValues>
            }
            watch={
              conditionWatch as unknown as UseFormWatch<FieldValues>
            }
            fieldName="approvalConditions"
            attributesOptions={
              EXPRESSION_ATTRIBUTES[conditionSubject] ??
              ATTRIBUTE_OPTIONS[conditionSubject].map((attr) => ({
                label: attr,
                value: attr.replace(/\s+/g, "_").toLowerCase(),
              }))
            }
            fullWidth
          />
        </div>
      );
    }

    if (currentStep === 3) {
      const rowData = filteredWorkflows.map((wf) => ({
        ...wf,
        tagsDisplay: (wf.tags ?? []).join(", "),
      }));

      const columnDefs = [
        {
          headerName: "",
          width: 60,
          maxWidth: 60,
          pinned: "left",
          cellRenderer: (params: any) => {
            const checked = formData.step3.selectedWorkflowId === params.data.id;
            return (
              <input
                type="radio"
                checked={checked}
                onChange={() =>
                  setFormData((prev) => ({
                    ...prev,
                    step3: { selectedWorkflowId: params.data.id },
                  }))
                }
              />
            );
          },
        },
        { headerName: "Name", field: "name", flex: 1, minWidth: 220 },
        { headerName: "Description", field: "description", flex: 2, minWidth: 260 },
        {
          headerName: "Stages",
          field: "stages",
          width: 110,
          valueFormatter: (params: any) =>
            params.value !== undefined && params.value !== null && params.value !== ""
              ? String(params.value)
              : "-",
        },
        {
          headerName: "Business Object Type",
          field: "businessFunction",
          flex: 1,
          minWidth: 180,
        },
        { headerName: "Owner", field: "owner", flex: 1, minWidth: 160 },
      ];

      const defaultColDef = {
        sortable: true,
        filter: false,
        resizable: true,
        wrapText: true,
        autoHeight: true,
        cellStyle: {
          whiteSpace: "normal",
          wordBreak: "break-word",
          lineHeight: 1.6,
          fontSize: "14px",
        },
      };

      return (
        <div className="w-full">
          <div className="flex justify-between items-center mb-3">
            <div className="relative max-w-md w-full">
              <input
                type="text"
                value={workflowSearch}
                onChange={(e) => setWorkflowSearch(e.target.value)}
                placeholder="Search workflows by name, description, tags, owner..."
                className="form-input w-full"
              />
            </div>
            <div className="text-[11px] text-gray-500">
              {filteredWorkflows.length} workflow
              {filteredWorkflows.length === 1 ? "" : "s"} found
            </div>
          </div>

          <div className="ag-theme-alpine w-full">
            <div style={{ width: "100%", minHeight: 260 }}>
              {/* @ts-ignore - dynamic AgGridReact type */}
              <AgGridReact
                theme={themeQuartz}
                rowData={rowData}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                rowSelection="single"
                onRowClicked={(event: any) =>
                  setFormData((prev) => ({
                    ...prev,
                    step3: { selectedWorkflowId: event.data.id },
                  }))
                }
                domLayout="autoHeight"
              />
            </div>
          </div>

          <style jsx global>{`
            .ag-theme-alpine {
              font-size: 14px;
            }
            .ag-theme-alpine .ag-cell,
            .ag-theme-alpine .ag-header-cell-text {
              line-height: 1.6;
            }
          `}</style>

          {/* {currentWorkflow && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
              <div className="font-semibold mb-1">
                Selected workflow: {currentWorkflow.name}
              </div>
              <div>{currentWorkflow.description}</div>
            </div>
          )} */}
        </div>
      );
    }

    if (currentStep === 4) {
      const tags =
        formData.step1.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean) || [];

      return (
        <div className="w-full py-3 px-6 space-y-6">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Approval Policy</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="font-medium text-gray-600 mb-1">Name</div>
                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-gray-900">
                  {formData.step1.name || (
                    <span className="text-gray-400">Not provided</span>
                  )}
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-600 mb-1">Owner</div>
                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-gray-900">
                  {formData.step1.owner || (
                    <span className="text-gray-400">Not provided</span>
                  )}
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-600 mb-1">Priority</div>
                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-gray-900">
                  {formData.step1.priority}
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-600 mb-1">Status</div>
                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-gray-900">
                  {formData.step1.status}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="font-medium text-gray-600 mb-1">Description</div>
                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-gray-900">
                  {formData.step1.description || (
                    <span className="text-gray-400">Not provided</span>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="font-medium text-gray-600 mb-1">Tags</div>
                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
                  {tags.length ? (
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-[10px] text-gray-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">None</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Conditions
            </h4>
            {approvalConditions.length ? (
              <ol className="list-decimal list-inside space-y-1 text-xs text-gray-800">
                {approvalConditions.map((cond: any, index: number) => (
                  <li key={cond.id || `cond-${index}`}>
                    <span className="font-medium">{conditionSubject}</span>{" "}
                    where{" "}
                    <span className="font-medium">
                      {cond.attribute?.label || ""}
                    </span>{" "}
                    {(cond.operator?.label || "").toLowerCase()}{" "}
                    <span className="font-mono">{cond.value}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-gray-400">No conditions defined.</p>
            )}

            <div className="mt-3">
              <div className="text-[11px] font-semibold text-gray-700 mb-1">
                Expression Preview
              </div>
              <pre className="text-xs text-gray-800 bg-gray-100 border border-gray-200 rounded-md p-3 overflow-auto font-mono max-h-32">
{renderConditionsPreview()}
              </pre>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Attached Workflow
            </h4>
            {currentWorkflow ? (
              <div className="space-y-1 text-xs text-gray-900">
                <div className="font-medium">{currentWorkflow.name}</div>
                <div className="text-gray-700">
                  {currentWorkflow.description}
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-[10px] text-gray-700">
                    Stages: {currentWorkflow.stages}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-[10px] text-gray-700">
                    {currentWorkflow.businessFunction}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-[10px] text-gray-700">
                    Owner: {currentWorkflow.owner}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                No workflow selected. Go back to Step 3 to attach a workflow.
              </p>
            )}
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-blue-800">
              Please review all the information above. Click &quot;Submit&quot; to save this approval policy.
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderAttachWorkflowSection = () => {
    const rowData = filteredWorkflows.map((wf) => ({
      ...wf,
      tagsDisplay: (wf.tags ?? []).join(", "),
    }));

    const columnDefs = [
      {
        headerName: "",
        width: 60,
        maxWidth: 60,
        pinned: "left",
        cellRenderer: (params: any) => {
          const checked = formData.step3.selectedWorkflowId === params.data.id;
          return (
            <input
              type="radio"
              checked={checked}
              onChange={() =>
                setFormData((prev) => ({
                  ...prev,
                  step3: { selectedWorkflowId: params.data.id },
                }))
              }
            />
          );
        },
      },
      { headerName: "Name", field: "name", flex: 1, minWidth: 220 },
      { headerName: "Description", field: "description", flex: 2, minWidth: 260 },
      {
        headerName: "Stages",
        field: "stages",
        width: 110,
        valueFormatter: (params: any) =>
          params.value !== undefined && params.value !== null && params.value !== ""
            ? String(params.value)
            : "-",
      },
      {
        headerName: "Business Object Type",
        field: "businessFunction",
        flex: 1,
        minWidth: 180,
      },
      { headerName: "Owner", field: "owner", flex: 1, minWidth: 160 },
    ];

    const defaultColDef = {
      sortable: true,
      filter: false,
      resizable: true,
      wrapText: true,
      autoHeight: true,
      cellStyle: {
        whiteSpace: "normal",
        wordBreak: "break-word",
        lineHeight: 1.6,
        fontSize: "14px",
      },
    };

    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-3">
          <div className="relative max-w-md w-full">
            <input
              type="text"
              value={workflowSearch}
              onChange={(e) => setWorkflowSearch(e.target.value)}
              placeholder="Search workflows by name, description, tags, owner..."
              className="form-input w-full"
            />
          </div>
          <div className="text-[11px] text-gray-500">
            {filteredWorkflows.length} workflow
            {filteredWorkflows.length === 1 ? "" : "s"} found
          </div>
        </div>

        <div className="ag-theme-alpine w-full">
          <div style={{ width: "100%", minHeight: 260 }}>
            {/* @ts-ignore - dynamic AgGridReact type */}
            <AgGridReact
              theme={themeQuartz}
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              rowSelection="single"
              onRowClicked={(event: any) =>
                setFormData((prev) => ({
                  ...prev,
                  step3: { selectedWorkflowId: event.data.id },
                }))
              }
              domLayout="autoHeight"
            />
          </div>
        </div>
      </div>
    );
  };

  // List view: initial table with Create button
  if (mode === "list") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full py-4 px-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Approval Policy
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                View and manage approval policies. Click &quot;Create&quot; to configure a new policy.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMode("create")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Create Approval Policy
            </button>
          </div>

          {isLoadingList ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Loading approval policies...
            </div>
          ) : listError ? (
            <div className="py-6 px-4 text-sm text-red-600">
              {listError}
            </div>
          ) : policies.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              No approval policies configured yet.
            </div>
          ) : (
            <div className="ag-theme-alpine w-full mt-2">
              {/* @ts-ignore dynamic type */}
              <AgGridReact
                rowData={approvalListRows}
                columnDefs={approvalListColumnDefs}
                rowSelection="single"
                rowModelType="clientSide"
                animateRows={true}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                  wrapHeaderText: true,
                  autoHeaderHeight: true,
                }}
                theme={themeQuartz}
                domLayout="autoHeight"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === "create" && reviewEditRequested) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full py-4 px-6 space-y-4">
          <div className="rounded-xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900">
                  Edit Approval Policy
                </h1>
                <p className="mt-1 text-xs text-gray-600">
                  Update the policy from this page without using the step form.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                <Check className="h-4 w-4" />
                Update Policy
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Approval Policy Details
            </h2>
            <div className="space-y-4 text-sm">
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-1 ${asterisk}`}>Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.step1.name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, name: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-1 ${asterisk}`}>Description</label>
                <textarea
                  className="form-input resize-y"
                  rows={3}
                  value={formData.step1.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, description: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-1 ${asterisk}`}>Owner</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.step1.owner}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, owner: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="w-full md:w-1/3">
                  <label className={`block text-sm font-medium text-gray-700 mb-1 ${asterisk}`}>Priority</label>
                  <select
                    className="form-input bg-white"
                    value={formData.step1.priority}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        step1: { ...prev.step1, priority: e.target.value as Priority },
                      }))
                    }
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className={`block text-sm font-medium text-gray-700 mb-2 ${asterisk}`}>Status</label>
                  <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                    {(["Staging", "Active", "Inactive"] as Status[]).map((status, index, array) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            step1: { ...prev.step1, status },
                          }))
                        }
                        className={`relative px-4 py-2 text-xs font-medium border-r last:border-r-0 ${
                          formData.step1.status === status
                            ? `bg-[#15274E] text-white ${downArrow}`
                            : "bg-white text-gray-700"
                        } ${
                          index === 0 ? "rounded-l-md" : index === array.length - 1 ? "rounded-r-md" : ""
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap mr-1">
                Condition Rule
              </label>
              <select
                className="form-input w-56 bg-white"
                value={conditionSubject}
                onChange={(e) => setConditionSubject(e.target.value as ConditionSubject)}
              >
                {(["Request Type", "Application", "Entitlement", "Service Account", "User"] as ConditionSubject[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <ExpressionBuilder
              title="Build Expression"
              control={conditionControl as unknown as Control<FieldValues>}
              setValue={conditionSetValue as unknown as UseFormSetValue<FieldValues>}
              watch={conditionWatch as unknown as UseFormWatch<FieldValues>}
              fieldName="approvalConditions"
              attributesOptions={
                EXPRESSION_ATTRIBUTES[conditionSubject] ??
                ATTRIBUTE_OPTIONS[conditionSubject].map((attr) => ({
                  label: attr,
                  value: attr.replace(/\s+/g, "_").toLowerCase(),
                }))
              }
              fullWidth
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Attach Workflow</h2>
            {renderAttachWorkflowSection()}
          </div>
        </div>
      </div>
    );
  }

  // Wizard view: current step form
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed step bar below header; aligned with content area */}
      <div
        className="fixed top-[60px] z-20 bg-white border-b border-gray-200 shadow-sm px-6 py-4"
        style={{
          left: isSidebarVisible ? sidebarWidthPx : 0,
          right: 0,
          transition: "left 300ms ease-in-out",
        }}
      >
        <div className="flex items-center gap-4 max-w-full">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium shrink-0 ${
              currentStep === 1
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </button>

          <div className="flex-1 flex items-center min-w-0">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border shrink-0 ${
                      currentStep >= step.id
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className="ml-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className="flex-1 h-0.5 bg-gray-200 mx-4 min-w-[16px]" aria-hidden />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="shrink-0">
            {currentStep < steps.length ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!isStepValid(currentStep)}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                  !isStepValid(currentStep)
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
              >
                <Check className="w-4 h-4 mr-2" />
                {reviewEditRequested ? "Update Policy" : "Submit"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spacer so content is not hidden under fixed step bar */}
      <div className="h-[72px]" aria-hidden />

      <div className="w-full py-3 px-6">
        <div className="w-full">
          <div className="space-y-6">
            {renderStep()}
          </div>
        </div>
      </div>
    </div>
  );
}

