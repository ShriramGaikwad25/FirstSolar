"use client";

import React, { useEffect, useMemo, useState } from "react";
import { themeQuartz } from "ag-grid-community";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useForm, Control, FieldValues, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Check, ChevronLeft, ChevronRight, Eye, Tag, FileText, User, Hash, Search } from "lucide-react";
import { asterisk } from "@/utils/utils";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";
import ExpressionBuilder from "@/components/ExpressionBuilder";
import { executeQuery } from "@/lib/api";
import CustomPagination from "@/components/agTable/CustomPagination";
import type { ColDef } from "ag-grid-community";

type Status = "Staging" | "Active" | "Inactive";

type SelectionColorSet = { border: string; bg: string; ring: string; text: string; dot: string };

const STATUS_COLORS: Record<Status, SelectionColorSet> = {
  Staging: {
    border: "border-amber-500",
    bg: "bg-amber-50",
    ring: "ring-1 ring-amber-500/30",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  Active: {
    border: "border-emerald-500",
    bg: "bg-emerald-50",
    ring: "ring-1 ring-emerald-500/30",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  Inactive: {
    border: "border-gray-400",
    bg: "bg-gray-50",
    ring: "ring-1 ring-gray-400/30",
    text: "text-gray-700",
    dot: "bg-gray-500",
  },
};

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

// Hardcoded to match the "ACMECOM" tenant convention already used elsewhere in this app
// (e.g. add-application/page.tsx), but kf_wf_p_upsert_approval_policy expects the tenant's UUID.
const APPROVAL_POLICY_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

function slugifyPolicyCode(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${base || "APPROVAL_POLICY"}_V1`;
}

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
    priority: number | null;
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
  const [listCurrentPage, setListCurrentPage] = useState<number>(1);
  const [listPageSize, setListPageSize] = useState<number | "all">(10);
  const [listError, setListError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ApprovalPolicyFormData>({
    step1: {
      name: "",
      description: "",
      owner: "",
      tags: "",
      priority: null,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [workflowRows, setWorkflowRows] = useState<WorkflowDefinition[]>([]);
  const { isVisible: isSidebarVisible, sidebarWidthPx } = useLeftSidebar();
  const reviewEditRequested = searchParams.get("edit") === "1";
  // Mode is derived from the URL (not local state) so the sidebar's "Back to Approval
  // Policy" link (Navigation.tsx) can detect create mode, and so the browser back
  // button / that sidebar link reliably return to the list view.
  const viewParam = searchParams.get("view") ?? "";
  const mode: "list" | "create" = viewParam === "create" || reviewEditRequested ? "create" : "list";

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
    // Preserve any existing query params (e.g. `edit=1` from the Review page) while
    // adding `view=create`, so mode derivation above keeps working for both entry points.
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("view", "create");
    router.push(`/settings/gateway/manage-approval-policies?${nextParams.toString()}`);
    setCurrentStep(1);

    const linkedWorkflowId = getWorkflowTemplateIdFromPolicyRow(row);

    setFormData({
      step1: {
        name: row.name || "",
        description: row.description || "",
        owner: row.owner || "",
        tags: "", // tags not available from view yet
        priority:
          row.priority !== undefined && row.priority !== null && row.priority !== ""
            ? Number(row.priority)
            : null,
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

  /** Reset the wizard back to a blank state before starting a fresh "Create" flow — otherwise
   * form state from a previous edit/create session (formData, step, conditions) carries over,
   * since navigating between ?view=create and the list is a query-param change, not a remount. */
  const handleStartNewPolicy = () => {
    setFormData({
      step1: {
        name: "",
        description: "",
        owner: "",
        tags: "",
        priority: null,
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
    setCurrentStep(1);
    setConditionSubject("Request Type");
    conditionSetValue("approvalConditions", [], {
      shouldDirty: false,
      shouldValidate: false,
    });
    setWorkflowSearch("");
    router.push("/settings/gateway/manage-approval-policies?view=create");
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
                className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
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
                <Eye className="w-4 h-4" />
              </button>
            </div>
          );
        },
      },
    ],
    [onEditPolicy]
  );

  const listTotalPages = Math.max(
    1,
    listPageSize === "all" ? 1 : Math.ceil(policies.length / (listPageSize as number))
  );
  const paginatedPolicies = useMemo(() => {
    if (listPageSize === "all") return policies;
    const start = (listCurrentPage - 1) * (listPageSize as number);
    return policies.slice(start, start + (listPageSize as number));
  }, [policies, listCurrentPage, listPageSize]);

  const approvalListRows = useMemo(
    () =>
      paginatedPolicies.flatMap((p) => [
        { ...p, _rowType: "main" },
        { ...p, _rowType: "description" },
      ]),
    [paginatedPolicies]
  );

  // Reset to first page whenever the policy list is (re)loaded
  useEffect(() => {
    setListCurrentPage(1);
  }, [policies]);

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
          priority !== null &&
          Number.isFinite(priority) &&
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

  const handleSubmit = async () => {
    setSubmitError(null);
    setIsSubmitting(true);

    const policyPayload = {
      tenantId: APPROVAL_POLICY_TENANT_ID,
      code: slugifyPolicyCode(formData.step1.name),
      name: formData.step1.name,
      description: formData.step1.description,
      version: 1,
      status: formData.step1.status.toUpperCase(),
      priority: formData.step1.priority ?? 0,
      businessObjectType: "ACCESS_REQUEST",
      selectorJson: {
        scope: "CUSTOM",
        conditions: approvalConditions.map((cond: any) => ({
          subject: conditionSubject,
          attribute: cond.attribute?.value ?? null,
          operator: cond.operator?.value ?? null,
          value: cond.value ?? null,
          logicalOp: cond.logicalOp ?? null,
        })),
      },
      validFrom: new Date().toISOString(),
      validTo: null,
      isActive: formData.step1.status === "Active",
      groupingPolicyCode: null,
      actor: "SYSTEM",
    };

    try {
      await executeQuery<unknown>(
        "CALL kf_wf_p_upsert_approval_policy(?::jsonb, NULL)",
        [policyPayload]
      );
      alert("Approval policy saved successfully.");
      router.push("/settings/gateway/manage-approval-policies");
    } catch (e: any) {
      console.error("Failed to save approval policy:", e);
      setSubmitError(e?.message || "Failed to save approval policy.");
    } finally {
      setIsSubmitting(false);
    }
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
        <div className="w-full px-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="space-y-6 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative min-w-0">
                  <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 pointer-events-none" aria-hidden />
                  <input
                    type="text"
                    value={formData.step1.name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        step1: { ...prev.step1, name: e.target.value },
                      }))
                    }
                    className="w-full pl-10 pr-9 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                    placeholder=" "
                  />
                  <label
                    className={`absolute left-10 transition-all duration-200 pointer-events-none ${
                      formData.step1.name ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"
                    }`}
                  >
                    Name *
                  </label>
                  {formData.step1.name.trim() && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" aria-hidden />
                  )}
                </div>

                <div className="relative min-w-0">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" aria-hidden />
                  <input
                    type="text"
                    value={formData.step1.owner}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        step1: { ...prev.step1, owner: e.target.value },
                      }))
                    }
                    className="w-full pl-10 pr-9 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                    placeholder=" "
                  />
                  <label
                    className={`absolute left-10 transition-all duration-200 pointer-events-none ${
                      formData.step1.owner ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"
                    }`}
                  >
                    Owner *
                  </label>
                  {formData.step1.owner.trim() && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" aria-hidden />
                  )}
                </div>
              </div>

              <div className="relative">
                <FileText className="absolute left-3.5 top-5 w-4 h-4 text-amber-500 pointer-events-none" aria-hidden />
                <textarea
                  value={formData.step1.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, description: e.target.value },
                    }))
                  }
                  className="w-full pl-10 pr-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline resize-none"
                  rows={3}
                  placeholder=" "
                />
                <label
                  className={`absolute left-10 transition-all duration-200 pointer-events-none ${
                    formData.step1.description ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"
                  }`}
                >
                  Description *
                </label>
                <div className="text-right text-xs text-gray-400 mt-1">
                  {formData.step1.description.length} characters
                </div>
              </div>

              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 pointer-events-none" aria-hidden />
                <input
                  type="text"
                  value={formData.step1.tags}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, tags: e.target.value },
                    }))
                  }
                  className="w-full pl-10 pr-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                  placeholder=" "
                />
                <label
                  className={`absolute left-10 transition-all duration-200 pointer-events-none ${
                    formData.step1.tags ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"
                  }`}
                >
                  Tags
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    className={`block text-sm font-medium text-gray-700 mb-2 ${asterisk}`}
                  >
                    Priority
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={formData.step1.priority ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        step1: {
                          ...prev.step1,
                          priority: raw === "" ? null : Number(raw),
                        },
                      }));
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter priority (e.g. 10)"
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium text-gray-700 mb-2 ${asterisk}`}
                  >
                    Status
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["Staging", "Active", "Inactive"] as Status[]).map((status) => {
                      const isSelected = formData.step1.status === status;
                      const colors = STATUS_COLORS[status];
                      return (
                        <div
                          key={status}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              step1: { ...prev.step1, status },
                            }))
                          }
                          className={`relative p-3.5 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md text-center ${
                            isSelected
                              ? `${colors.border} ${colors.bg} ${colors.ring}`
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <span className={`text-sm font-medium ${isSelected ? colors.text : "text-gray-900"}`}>
                            {status}
                          </span>
                          {isSelected && (
                            <span className={`absolute top-2 right-2 w-4 h-4 ${colors.dot} rounded-full flex items-center justify-center shrink-0`}>
                              <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                            </span>
                          )}
                        </div>
                      );
                    })}
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
        <div className="w-full px-6 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Condition Rule
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {(
                [
                  "Request Type",
                  "Application",
                  "Entitlement",
                  "Service Account",
                  "User",
                ] as ConditionSubject[]
              ).map((s) => {
                const isSelected = conditionSubject === s;
                return (
                  <div
                    key={s}
                    onClick={() => setConditionSubject(s)}
                    className={`relative p-3.5 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md text-center ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/30"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span className={`text-sm font-medium ${isSelected ? "text-blue-700" : "text-gray-900"}`}>
                      {s}
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="w-full px-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4 gap-3">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
                <input
                  type="text"
                  value={workflowSearch}
                  onChange={(e) => setWorkflowSearch(e.target.value)}
                  placeholder="Search workflows by name, description, tags, owner..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap shrink-0">
                {filteredWorkflows.length} workflow
                {filteredWorkflows.length === 1 ? "" : "s"} found
              </div>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredWorkflows.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-10">
                  No workflows match your search.
                </div>
              ) : (
                filteredWorkflows.map((wf) => {
                  const isSelected = formData.step3.selectedWorkflowId === wf.id;
                  return (
                    <div
                      key={wf.id}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          step3: { selectedWorkflowId: wf.id },
                        }))
                      }
                      className={`relative px-4 py-3 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/30"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className={`text-sm font-semibold truncate ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                            {wf.name}
                          </h3>
                          <p className="text-xs text-gray-600 truncate">{wf.description}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5 shrink-0 max-w-[45%]">
                          {wf.stages !== undefined && wf.stages !== null && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-medium">
                              Stages: {wf.stages}
                            </span>
                          )}
                          {wf.businessFunction && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium">
                              {wf.businessFunction}
                            </span>
                          )}
                          {wf.owner && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium">
                              Owner: {wf.owner}
                            </span>
                          )}
                        </div>
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 4) {
      const tags =
        formData.step1.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean) || [];

      const statusColors = STATUS_COLORS[formData.step1.status];

      const summaryField = (label: string, value: React.ReactNode) => (
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
          <div className="text-sm text-gray-900 font-medium break-words">{value}</div>
        </div>
      );

      return (
        <div className="w-full px-6 space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Approval Policy</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              {summaryField(
                "Name",
                formData.step1.name || <span className="text-gray-400 font-normal">Not provided</span>
              )}
              {summaryField(
                "Owner",
                formData.step1.owner || <span className="text-gray-400 font-normal">Not provided</span>
              )}
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Priority</div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                  {formData.step1.priority ?? <span className="text-gray-400 font-normal">Not provided</span>}
                </span>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors.bg} ${statusColors.text}`}>
                  {formData.step1.status}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {summaryField(
                "Description",
                formData.step1.description || (
                  <span className="text-gray-400 font-normal">Not provided</span>
                )
              )}
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Tags</div>
                {tags.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">None</span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Conditions</div>
            {approvalConditions.length ? (
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-800">
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
              <p className="text-sm text-gray-400">No conditions defined.</p>
            )}

            <div className="mt-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Expression Preview
              </div>
              <pre className="text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded-md p-3 overflow-auto font-mono max-h-32">
{renderConditionsPreview()}
              </pre>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Attached Workflow</div>
            {currentWorkflow ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900">{currentWorkflow.name}</div>
                <div className="text-sm text-gray-700">
                  {currentWorkflow.description}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-medium">
                    Stages: {currentWorkflow.stages}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium">
                    {currentWorkflow.businessFunction}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium">
                    Owner: {currentWorkflow.owner}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No workflow selected. Go back to Step 3 to attach a workflow.
              </p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Please review all the information above. Click &quot;Submit&quot; to save this approval policy.
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  // List view: initial table with Create button
  if (mode === "list") {
    return (
      <div className="min-h-screen bg-gray-100">
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
              onClick={handleStartNewPolicy}
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
            <>
              <div className="mt-2">
                <CustomPagination
                  totalItems={policies.length}
                  currentPage={listCurrentPage}
                  totalPages={listTotalPages}
                  pageSize={listPageSize}
                  onPageChange={setListCurrentPage}
                  onPageSizeChange={(newPageSize) => {
                    setListPageSize(newPageSize);
                    setListCurrentPage(1);
                  }}
                  pageSizeOptions={[10, 20, 50, 100, "all"]}
                />
              </div>
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
              <div className="mt-2">
                <CustomPagination
                  totalItems={policies.length}
                  currentPage={listCurrentPage}
                  totalPages={listTotalPages}
                  pageSize={listPageSize}
                  onPageChange={setListCurrentPage}
                  onPageSizeChange={(newPageSize) => {
                    setListPageSize(newPageSize);
                    setListCurrentPage(1);
                  }}
                  pageSizeOptions={[10, 20, 50, 100, "all"]}
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (mode === "create" && reviewEditRequested) {
    return (
      <div className="min-h-screen bg-gray-100">
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
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Check className="h-4 w-4" />
                {isSubmitting ? "Saving..." : "Update Policy"}
              </button>
            </div>
            {submitError && (
              <p className="mt-2 text-xs text-red-600">{submitError}</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="space-y-6 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative min-w-0">
                  <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 pointer-events-none" aria-hidden />
                  <input
                    type="text"
                    value={formData.step1.name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        step1: { ...prev.step1, name: e.target.value },
                      }))
                    }
                    className="w-full pl-10 pr-9 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                    placeholder=" "
                  />
                  <label
                    className={`absolute left-10 transition-all duration-200 pointer-events-none ${
                      formData.step1.name ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"
                    }`}
                  >
                    Name *
                  </label>
                  {formData.step1.name.trim() && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" aria-hidden />
                  )}
                </div>

                <div className="relative min-w-0">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" aria-hidden />
                  <input
                    type="text"
                    value={formData.step1.owner}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        step1: { ...prev.step1, owner: e.target.value },
                      }))
                    }
                    className="w-full pl-10 pr-9 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                    placeholder=" "
                  />
                  <label
                    className={`absolute left-10 transition-all duration-200 pointer-events-none ${
                      formData.step1.owner ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"
                    }`}
                  >
                    Owner *
                  </label>
                  {formData.step1.owner.trim() && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" aria-hidden />
                  )}
                </div>
              </div>

              <div className="relative">
                <FileText className="absolute left-3.5 top-5 w-4 h-4 text-amber-500 pointer-events-none" aria-hidden />
                <textarea
                  value={formData.step1.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, description: e.target.value },
                    }))
                  }
                  className="w-full pl-10 pr-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline resize-none"
                  rows={3}
                  placeholder=" "
                />
                <label
                  className={`absolute left-10 transition-all duration-200 pointer-events-none ${
                    formData.step1.description ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"
                  }`}
                >
                  Description *
                </label>
                <div className="text-right text-xs text-gray-400 mt-1">
                  {formData.step1.description.length} characters
                </div>
              </div>

              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 pointer-events-none" aria-hidden />
                <input
                  type="text"
                  value={formData.step1.tags}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, tags: e.target.value },
                    }))
                  }
                  className="w-full pl-10 pr-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                  placeholder=" "
                />
                <label
                  className={`absolute left-10 transition-all duration-200 pointer-events-none ${
                    formData.step1.tags ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"
                  }`}
                >
                  Tags
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium text-gray-700 mb-2 ${asterisk}`}>
                    Priority
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={formData.step1.priority ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        step1: {
                          ...prev.step1,
                          priority: raw === "" ? null : Number(raw),
                        },
                      }));
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter priority (e.g. 10)"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium text-gray-700 mb-2 ${asterisk}`}>
                    Status
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["Staging", "Active", "Inactive"] as Status[]).map((status) => {
                      const isSelected = formData.step1.status === status;
                      const colors = STATUS_COLORS[status];
                      return (
                        <div
                          key={status}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              step1: { ...prev.step1, status },
                            }))
                          }
                          className={`relative p-3.5 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md text-center ${
                            isSelected
                              ? `${colors.border} ${colors.bg} ${colors.ring}`
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <span className={`text-sm font-medium ${isSelected ? colors.text : "text-gray-900"}`}>
                            {status}
                          </span>
                          {isSelected && (
                            <span className={`absolute top-2 right-2 w-4 h-4 ${colors.dot} rounded-full flex items-center justify-center shrink-0`}>
                              <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Condition Rule
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {(
                [
                  "Request Type",
                  "Application",
                  "Entitlement",
                  "Service Account",
                  "User",
                ] as ConditionSubject[]
              ).map((s) => {
                const isSelected = conditionSubject === s;
                return (
                  <div
                    key={s}
                    onClick={() => setConditionSubject(s)}
                    className={`relative p-3.5 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md text-center ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/30"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span className={`text-sm font-medium ${isSelected ? "text-blue-700" : "text-gray-900"}`}>
                      {s}
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4 gap-3">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
                <input
                  type="text"
                  value={workflowSearch}
                  onChange={(e) => setWorkflowSearch(e.target.value)}
                  placeholder="Search workflows by name, description, tags, owner..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap shrink-0">
                {filteredWorkflows.length} workflow
                {filteredWorkflows.length === 1 ? "" : "s"} found
              </div>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredWorkflows.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-10">
                  No workflows match your search.
                </div>
              ) : (
                filteredWorkflows.map((wf) => {
                  const isSelected = formData.step3.selectedWorkflowId === wf.id;
                  return (
                    <div
                      key={wf.id}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          step3: { selectedWorkflowId: wf.id },
                        }))
                      }
                      className={`relative px-4 py-3 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/30"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className={`text-sm font-semibold truncate ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                            {wf.name}
                          </h3>
                          <p className="text-xs text-gray-600 truncate">{wf.description}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5 shrink-0 max-w-[45%]">
                          {wf.stages !== undefined && wf.stages !== null && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-medium">
                              Stages: {wf.stages}
                            </span>
                          )}
                          {wf.businessFunction && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium">
                              {wf.businessFunction}
                            </span>
                          )}
                          {wf.owner && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium">
                              Owner: {wf.owner}
                            </span>
                          )}
                        </div>
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Wizard view: current step form
  return (
    <div className="min-h-screen bg-gray-100">
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
                disabled={isSubmitting}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4 mr-2" />
                {isSubmitting ? "Saving..." : reviewEditRequested ? "Update Policy" : "Submit"}
              </button>
            )}
          </div>
        </div>
      </div>
      {submitError && (
        <div className="px-6">
          <p className="text-xs text-red-600">{submitError}</p>
        </div>
      )}

      {/* Spacer so content is not hidden under fixed step bar */}
      <div className="h-16" aria-hidden />

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

