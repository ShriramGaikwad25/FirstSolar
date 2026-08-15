"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code,
  Compass,
  GitBranch,
  Layers,
  Minus,
  Plus,
  Settings,
  ShieldCheck,
  Bell,
  SquarePen,
  X,
} from "lucide-react";
import { useForm, Control, FieldValues, UseFormSetValue, UseFormWatch } from "react-hook-form";
import MultiSelect from "@/components/MultiSelect";
import { loadUsers, customOption, loadIspmApps } from "@/components/MsAsyncData";
import { asterisk, downArrow, userGroups, excludeUsers, defaultExpression } from "@/utils/utils";
import ExpressionBuilder from "@/components/ExpressionBuilder";
import ToggleSwitch from "@/components/ToggleSwitch";
import FileDropzone from "@/components/FileDropzone";
import { useRouter, useSearchParams } from "next/navigation";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";
import { GuidedPolicyBuilder } from "./guided-policy-builder";
import { STEP_PALETTE, type StepPaletteEntry } from "./step-palette";
import { INITIAL_EVENT_DEFINITIONS } from "@/components/continuous-compliance/eventDefinitionsData";
import { AGENT_TASKS } from "@/lib/agent-task-library";
import { executeQuery } from "@/lib/api";

const STAGE_COLUMN_HEADING_CLASS = [
  "bg-sky-100 text-sky-900",
  "bg-indigo-100 text-indigo-900",
  "bg-teal-100 text-teal-900",
  "bg-rose-100 text-rose-900",
  "bg-orange-100 text-orange-900",
];

/** Stage title pill color by normalized stage name (overrides index-based color). */
const STAGE_HEADING_BY_NAME: Record<string, string> = {
  validate: "bg-blue-100 text-blue-900",
};

/** Slightly narrower stage columns + matching “Add Stage” control */
const STAGE_COLUMN_MIN = "min-w-[252px]";

const APPROVAL_FN_TO_UI: Record<string, string> = {
  FN_RESOLVE_MANAGER: "line-manager",
  FN_RESOLVE_DEPT_HEAD: "department-head",
  FN_RESOLVE_APP_OWNER: "app-owner",
  FN_RESOLVE_ROLE_OWNER: "role-owner",
  FN_RESOLVE_CUSTOM: "custom",
};

/**
 * Fallback Condition (CEL) text applied when editing an existing workflow whose
 * definition_json step has no condition of its own. Matched by workflow name (exact,
 * case-insensitive) + step code substring, so the default only applies to that
 * specific saved record instead of every workflow.
 */
const DEFAULT_CONDITION_BY_WORKFLOW_AND_CODE: Array<{
  workflowName: string;
  match: string;
  condition: string;
}> = [
  {
    workflowName: "Oracle Access Governance Orchastration",
    match: "SOD",
    condition: [
      "context.sod.risklevel.approval.required={'HIGH','CRITICAL'},",
      "context.ag.approval.sod.risklevelcheck={'HIGH','CRITICAL'},",
      "context.sod.risklevel.approval.warning={'MEDIUM','LOW'},",
    ].join("\n"),
  },
  {
    workflowName: "Oracle Access Governance Orchastration",
    match: "TRAINING",
    condition: [
      "context.validation.training.mode={'ADVISORY'},",
      "context.validation.training.notificationtemplate={'TEMPLATE_TRNG01'},",
      "context.ag.approval.trainingComplete={},",
      "context.validation.training.trainingCheckIntervalMinutes: 240",
    ].join("\n"),
  },
];

function defaultConditionForCode(stepCodeUpper: string, workflowName?: string): string | null {
  const normalizedWorkflowName = (workflowName || "").trim().toLowerCase();
  if (!normalizedWorkflowName) return null;

  const hit = DEFAULT_CONDITION_BY_WORKFLOW_AND_CODE.find(
    (entry) =>
      entry.workflowName.trim().toLowerCase() === normalizedWorkflowName &&
      stepCodeUpper.includes(entry.match)
  );
  return hit ? hit.condition : null;
}

function approverFieldsFromApiConfig(config: any, stepCodeUpper: string) {
  const cfg = config || {};
  const isCustomApprovalCode =
    stepCodeUpper === "APPROVAL_CUSTOM" || stepCodeUpper === "CUSTOM_APPROVAL";
  const useCustomLookup =
    String(cfg.approverSource || "").toUpperCase() === "LOOKUP" ||
    (isCustomApprovalCode && cfg.lookupRuleId != null);
  if (useCustomLookup) {
    return {
      approverResolver: "custom-lookup" as const,
      taskName: typeof cfg.taskName === "string" ? cfg.taskName : undefined,
      lookupRuleId: cfg.lookupRuleId != null ? Number(cfg.lookupRuleId) : undefined,
      escalateAfter: Number(cfg.escalationHours) || 24,
      skipIfRequestorIsApprover: cfg.skipSelf !== false,
    };
  }
  const fn = typeof cfg.approverResolver === "string" ? cfg.approverResolver : "";
  return {
    approverResolver: APPROVAL_FN_TO_UI[fn] || "line-manager",
    escalateAfter: Number(cfg.escalationHours) || 24,
    skipIfRequestorIsApprover: cfg.skipSelf !== false,
  };
}

function applyApprovalStepToWorkflowJson(stepJSON: { config: any }, step: any) {
  if (step.type !== "APPROVAL") return;
  if (step.approverResolver === "custom-lookup") {
    stepJSON.config.approverSource = "LOOKUP";
    if (step.lookupRuleId != null) stepJSON.config.lookupRuleId = step.lookupRuleId;
    if (step.taskName) stepJSON.config.taskName = step.taskName;
  } else {
    const resolverMap: Record<string, string> = {
      "line-manager": "FN_RESOLVE_MANAGER",
      "department-head": "FN_RESOLVE_DEPT_HEAD",
      "app-owner": "FN_RESOLVE_APP_OWNER",
      "role-owner": "FN_RESOLVE_ROLE_OWNER",
      custom: "FN_RESOLVE_CUSTOM",
    };
    stepJSON.config.approverResolver = resolverMap[step.approverResolver] || "FN_RESOLVE_MANAGER";
  }
  stepJSON.config.escalationHours = step.escalateAfter || 24;
  stepJSON.config.skipSelf = step.skipIfRequestorIsApprover !== false;
}

/** Same three buckets the Guided tab groups steps into (validate/approval/fulfillment). */
type StepPaletteCategory = "VALIDATE" | "APPROVAL" | "FULFILLMENT";

/** Normalize a kf_wf_f_get_step_types() row's default_stage_bucket into a palette category. */
function normalizePaletteBucket(raw: unknown): StepPaletteCategory | null {
  const b = String(raw ?? "").toUpperCase().trim();
  if (!b) return null;
  if (b.includes("VALID")) return "VALIDATE";
  if (b.includes("APPROV")) return "APPROVAL";
  if (b.includes("FULFIL") || b.includes("FULFUL")) return "FULFILLMENT";
  return null;
}

function normalizePaletteKind(raw: unknown): StepPaletteEntry["kind"] {
  const k = String(raw ?? "").toUpperCase().trim();
  if (k === "HUMAN") return "HUMAN";
  if (k === "AI") return "AI";
  return "SYSTEM";
}

function normalizePaletteType(
  raw: unknown,
  kind: StepPaletteEntry["kind"],
  bucket: StepPaletteCategory
): StepPaletteEntry["type"] {
  const t = String(raw ?? "").toUpperCase().trim();
  if (t === "APPROVAL") return "APPROVAL";
  if (t === "FULFILLMENT") return "FULFILLMENT";
  if (t === "AI AGENT" || t === "AI_AGENT") return "AI AGENT";
  if (t === "LOGIC") return "LOGIC";
  if (kind === "AI") return "AI AGENT";
  if (bucket === "APPROVAL") return "APPROVAL";
  if (bucket === "FULFILLMENT") return "FULFILLMENT";
  return "LOGIC";
}

/** Maps a raw row from `SELECT * FROM kf_wf_f_get_step_types()` to a palette entry + category. */
function mapApiStepTypeRow(
  row: any
): { category: StepPaletteCategory; entry: StepPaletteEntry } | null {
  if (!row || typeof row !== "object") return null;

  const rawCode =
    row.step_code ?? row.STEP_CODE ?? row.code ?? row.CODE ?? row.type_code ?? row.TYPE_CODE ?? null;
  const rawLabel =
    row.step_name ??
    row.STEP_NAME ??
    row.label ??
    row.LABEL ??
    row.name ??
    row.NAME ??
    row.title ??
    row.TITLE ??
    null;
  const label = String(rawLabel ?? rawCode ?? "").trim();
  if (!label && !rawCode) return null;

  const category = normalizePaletteBucket(
    row.default_stage_bucket ??
      row.DEFAULT_STAGE_BUCKET ??
      row.stage_bucket ??
      row.STAGE_BUCKET ??
      row.bucket ??
      row.BUCKET
  );
  if (!category) return null;

  const code = String(rawCode ?? label).toUpperCase().replace(/-/g, "_").trim();
  const kind = normalizePaletteKind(row.step_kind ?? row.STEP_KIND ?? row.kind ?? row.KIND);
  const type = normalizePaletteType(
    row.step_type ?? row.STEP_TYPE ?? row.type ?? row.TYPE,
    kind,
    category
  );

  return {
    category,
    entry: {
      id: code.toLowerCase().replace(/_/g, "-"),
      label: label || code,
      kind,
      type,
    },
  };
}

/** Always-available fallback per category, same as Guided's "Custom step/approval/fulfillment". */
const CUSTOM_STEP_ENTRY: Record<StepPaletteCategory, StepPaletteEntry> = {
  VALIDATE: { id: "custom-step", label: "Custom Step", kind: "SYSTEM", type: "CUSTOM" },
  APPROVAL: { id: "custom-approval", label: "Custom Approval", kind: "HUMAN", type: "APPROVAL" },
  FULFILLMENT: {
    id: "custom-fulfillment",
    label: "Custom Fulfillment",
    kind: "SYSTEM",
    type: "FULFILLMENT",
  },
};

interface PolicyBuilderProps {
  formData: any;
  setFormData: any;
  hideStepPalette?: boolean;
}

const PolicyBuilder: React.FC<PolicyBuilderProps> = ({ formData, setFormData, hideStepPalette = false }) => {
  const [apiStepPalette, setApiStepPalette] = useState<Record<StepPaletteCategory, StepPaletteEntry[]>>({
    VALIDATE: [],
    APPROVAL: [],
    FULFILLMENT: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await executeQuery<any>("SELECT * FROM kf_wf_f_get_step_types()", []);
        const rows: any[] = Array.isArray(response)
          ? response
          : Array.isArray(response?.resultSet)
            ? response.resultSet
            : Array.isArray(response?.rows)
              ? response.rows
              : [];

        const grouped: Record<StepPaletteCategory, StepPaletteEntry[]> = {
          VALIDATE: [],
          APPROVAL: [],
          FULFILLMENT: [],
        };
        const seen = new Set<string>();
        rows.forEach((row) => {
          const mapped = mapApiStepTypeRow(row);
          if (!mapped) return;
          const key = `${mapped.category}:${mapped.entry.id}`;
          if (seen.has(key)) return;
          seen.add(key);
          grouped[mapped.category].push(mapped.entry);
        });

        if (!cancelled) setApiStepPalette(grouped);
      } catch (e) {
        console.error("Failed to load step types from kf_wf_f_get_step_types():", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stepPalette: Record<StepPaletteCategory, StepPaletteEntry[]> = {
    VALIDATE: apiStepPalette.VALIDATE.length
      ? apiStepPalette.VALIDATE
      : [...STEP_PALETTE.LOGIC, ...STEP_PALETTE.AI_AGENTS],
    APPROVAL: apiStepPalette.APPROVAL.length ? apiStepPalette.APPROVAL : STEP_PALETTE.APPROVALS,
    FULFILLMENT: apiStepPalette.FULFILLMENT.length ? apiStepPalette.FULFILLMENT : STEP_PALETTE.FULFILLMENT,
  };

  const [policyUiTab, setPolicyUiTab] = useState<"guided" | "advanced">("guided");
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [stepConfig, setStepConfig] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"General" | "Conditions" | "AI Context" | "Approvers" | "Context">("General");
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState<string>("");
  const [addStepMenuStageId, setAddStepMenuStageId] = useState<string | null>(null);
  const conditionTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!addStepMenuStageId) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-add-step-menu]")) {
        setAddStepMenuStageId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [addStepMenuStageId]);

  const handleSkipLogicChange = (value: string) => {
    updateStepConfig("skipLogic", value);
    if (value === "condition") {
      requestAnimationFrame(() => {
        conditionTextareaRef.current?.focus();
      });
    }
  };

  const stages = formData.step2.stages || [];

  const addStage = () => {
    const newStage = {
      id: `stage-${Date.now()}`,
      name: `Stage ${stages.length + 1}`,
      order: stages.length + 1,
      steps: [],
    };
    setFormData((prev: any) => ({
      ...prev,
      step2: {
        ...prev.step2,
        stages: [...prev.step2.stages, newStage],
      },
    }));
    setSelectedStageId(newStage.id);
  };

  const removeStage = (stageId: string) => {
    if (window.confirm("Remove this stage? All steps inside will be lost.")) {
      setFormData((prev: any) => ({
        ...prev,
        step2: {
          ...prev.step2,
          stages: prev.step2.stages
            .filter((s: any) => s.id !== stageId)
            .map((s: any, idx: number) => ({ ...s, order: idx + 1 })),
        },
      }));
      if (selectedStageId === stageId) {
        setSelectedStageId(null);
        setSelectedStepId(null);
        setStepConfig(null);
      }
    }
  };

  const addStepToStage = (stageId: string, stepTemplate: any) => {
    const newStep = {
      id: `step-${Date.now()}`,
      label: stepTemplate.label,
      code: stepTemplate.id.toUpperCase().replace(/-/g, "_"),
      kind: stepTemplate.kind,
      type: stepTemplate.type,
      condition: "true",
    };

    setFormData((prev: any) => ({
      ...prev,
      step2: {
        ...prev.step2,
        stages: prev.step2.stages.map((stage: any) =>
          stage.id === stageId
            ? { ...stage, steps: [...stage.steps, newStep] }
            : stage
        ),
      },
    }));

    setSelectedStepId(newStep.id);
    setStepConfig(newStep);
  };

  /** Same convention Guided uses: first stage = validate, last = fulfillment, middle = approval. */
  const categoryForStageIndex = (index: number): StepPaletteCategory => {
    if (index === 0) return "VALIDATE";
    if (stages.length >= 2 && index === stages.length - 1) return "FULFILLMENT";
    return "APPROVAL";
  };

  const renderAddStepMenu = (
    stageId: string,
    category: StepPaletteCategory,
    variant: "chip" | "empty" = "chip"
  ) => {
    const entries = stepPalette[category];
    const customEntry = CUSTOM_STEP_ENTRY[category];
    return (
      <div
        data-add-step-menu
        className={`relative ${variant === "empty" ? "w-full" : "inline-block"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() =>
            setAddStepMenuStageId((current) => (current === stageId ? null : stageId))
          }
          className={
            variant === "empty"
              ? "flex w-full items-center justify-center gap-1 py-2 text-xs text-gray-500 border-2 border-dashed border-gray-300 rounded bg-white hover:border-blue-400 hover:text-blue-600"
              : "mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          }
        >
          {variant === "empty" ? "+ Add Step" : "+ Step"}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${addStepMenuStageId === stageId ? "rotate-180" : ""}`}
          />
        </button>
        {addStepMenuStageId === stageId && (
          <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {category}
            </p>
            {entries.length === 0 ? (
              <p className="px-2.5 py-1.5 text-xs text-gray-400">No step types available.</p>
            ) : (
              entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    addStepToStage(stageId, entry);
                    setAddStepMenuStageId(null);
                  }}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-blue-50 ${
                    entry.type === "AI AGENT" ? "text-purple-700" : "text-gray-800"
                  }`}
                >
                  {entry.label}
                </button>
              ))
            )}
            <div className="mt-1 border-t border-gray-100 pt-1">
              <button
                type="button"
                onClick={() => {
                  addStepToStage(stageId, customEntry);
                  setAddStepMenuStageId(null);
                }}
                className="w-full rounded-md px-2 py-1.5 text-left text-xs text-gray-600 hover:bg-blue-50"
              >
                {customEntry.label}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const removeStep = (stageId: string, stepId: string) => {
    const step = stages
      .find((s: any) => s.id === stageId)
      ?.steps.find((st: any) => st.id === stepId);
    const stepName = step?.label || "this step";
    
    if (window.confirm(`Are you sure you want to remove "${stepName}"? This action cannot be undone.`)) {
      setFormData((prev: any) => ({
        ...prev,
        step2: {
          ...prev.step2,
          stages: prev.step2.stages.map((stage: any) =>
            stage.id === stageId
              ? { ...stage, steps: stage.steps.filter((s: any) => s.id !== stepId) }
              : stage
          ),
        },
      }));
      if (selectedStepId === stepId) {
        setSelectedStepId(null);
        setStepConfig(null);
      }
    }
  };

  const selectStep = (stageId: string, step: any) => {
    setSelectedStageId(stageId);
    setSelectedStepId(step.id);
    setStepConfig(step);
    setActiveTab("General");
  };

  const closeStepConfiguration = () => {
    setSelectedStepId(null);
    setStepConfig(null);
  };

  const updateStepConfig = (field: string, value: any) => {
    if (!selectedStageId || !selectedStepId) return;

    setFormData((prev: any) => ({
      ...prev,
      step2: {
        ...prev.step2,
        stages: prev.step2.stages.map((stage: any) =>
          stage.id === selectedStageId
            ? {
                ...stage,
                steps: stage.steps.map((s: any) =>
                  s.id === selectedStepId ? { ...s, [field]: value } : s
                ),
              }
            : stage
        ),
      },
    }));

    setStepConfig((prev: any) => (prev ? { ...prev, [field]: value } : null));
  };

  const selectedStep = stages
    .flatMap((s: any) => s.steps.map((step: any) => ({ ...step, stageId: s.id })))
    .find((s: any) => s.id === selectedStepId);

  const generateWorkflowJSON = () => {
    const workflowStages = stages.map((stage: any) => {
      let stageCondition = "true";
      if (stage.steps.length > 0) {
        const stepWithCondition = stage.steps.find((s: any) => s.condition && s.condition !== "true");
        if (stepWithCondition) {
          stageCondition = stepWithCondition.condition;
        } else if (stage.steps[0].condition) {
          stageCondition = stage.steps[0].condition;
        }
      }
      
      const stageSteps = stage.steps.map((step: any) => {
        const stepJSON: any = {
          code: step.code,
          label: step.label,
          kind: step.kind,
          type: step.type === "AI AGENT" ? "AI_AGENT" : step.type === "FULFILLMENT" ? "FULFILL" : step.type,
          config: {
            blocking: step.blocking !== false,
          },
        };

        if (step.type === "AI AGENT") {
          stepJSON.ai = {
            enabled: true,
            peerGroup: step.inputSignals?.peerGroupAnalysis !== false,
            historicalApprovals: step.inputSignals?.historicalApprovals !== false,
            hrCorrelation: step.inputSignals?.hrAttributeCorrelation !== false,
            externalThreat: step.inputSignals?.externalThreatIntel === true,
            confidence: step.confidenceThreshold || 87,
            hardStops: {
              highRisk: step.hardStopRules?.riskHigh !== false,
              sodViolation: step.hardStopRules?.sodViolation !== false,
            },
          };
        }

        if (step.type === "APPROVAL") {
          applyApprovalStepToWorkflowJson(stepJSON, step);
        }

        const conditionStr =
          typeof step.condition === "string"
            ? step.condition
            : step.condition?.expression ?? step.condition?.expr ?? "true";

        if (step.type === "FULFILLMENT") {
          stepJSON.config.mode = "ASYNC";
          if (conditionStr && conditionStr !== "true") {
            stepJSON.config.conditionExpr = conditionStr;
          }
        } else {
          // Always wrap step condition in { expression: "..." } for API
          stepJSON.condition = { expression: conditionStr || "true" };
        }

        if (step.type === "CUSTOM") {
          stepJSON.config.description = step.description || "";
        }

        return stepJSON;
      });

      return {
        name: stage.name,
        order: stage.order,
        condition:
          stageCondition === "true" || !stageCondition
            ? stageCondition
            : { expression: stageCondition },
        steps: stageSteps,
      };
    });

    return {
      templateCode: "WF_STD_KEYFORGE",
      version: 1,
      type: "ACCESS_REQUEST",
      stages: workflowStages,
    };
  };

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-bold tracking-tight text-[#1759e4]">Configure workflow steps</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {policyUiTab === "guided"
              ? "Toggle steps on or off, then arrange their execution order in the flow panel."
              : "Select a stage, then add steps from the palette to build your workflow."}
          </p>
        </div>
        <div
          className="inline-flex shrink-0 rounded-lg border border-blue-200 bg-white p-1 shadow-sm"
          role="tablist"
          aria-label="Policy builder mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={policyUiTab === "guided"}
            onClick={() => setPolicyUiTab("guided")}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              policyUiTab === "guided"
                ? "bg-[#1759e4] text-white shadow-sm ring-1 ring-blue-300"
                : "text-[#1759e4]/80 hover:bg-[#E5EEFC] hover:text-[#1759e4]"
            }`}
          >
            <Compass className="h-3.5 w-3.5 shrink-0" />
            Guided
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={policyUiTab === "advanced"}
            onClick={() => setPolicyUiTab("advanced")}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              policyUiTab === "advanced"
                ? "bg-[#1759e4] text-white shadow-sm ring-1 ring-blue-300"
                : "text-[#1759e4]/80 hover:bg-[#E5EEFC] hover:text-[#1759e4]"
            }`}
          >
            <Settings className="h-3.5 w-3.5 shrink-0" />
            Advanced
          </button>
        </div>
      </div>

      {policyUiTab === "guided" ? (
        <div className="mb-4 w-full">
          <GuidedPolicyBuilder formData={formData} setFormData={setFormData} />
        </div>
      ) : (
      <div className="flex h-[600px] gap-4 w-full mb-4">
        {/* Left Panel - Step Palette */}
        {!hideStepPalette && (
          <div className="flex h-full w-64 flex-col rounded-lg border border-gray-200 bg-gray-50 p-3">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-gray-900">STEP PALETTE</h3>
            <div className="flex-1 grid grid-cols-1 gap-3 overflow-hidden">
              {Object.entries(stepPalette).map(([category, steps]) => (
                <div key={category} className="flex flex-col min-h-0">
                  <h4 className="text-[10px] font-semibold text-gray-700 mb-1 uppercase">
                    {category.replace(/_/g, " ")}
                  </h4>
                  <div className="flex-1 space-y-1 overflow-y-auto">
                    {steps.map((step) => (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => {
                          if (selectedStageId) {
                            addStepToStage(selectedStageId, step);
                          } else {
                            alert("Please select a stage first");
                          }
                        }}
                        className={`w-full text-left px-2 py-1 text-[11px] border rounded transition-colors ${
                          step.type === "AI AGENT"
                            ? "bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100 hover:border-purple-400"
                            : "bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-400"
                        }`}
                      >
                        {step.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-gray-200 leading-tight">
              Select a stage, then click a chip to add that step. This prototype runs entirely in the browser.
            </p>
          </div>
        )}

        {/* Center Panel - Workflow Canvas */}
        <div className="flex-1 overflow-x-auto rounded-xl border border-gray-200 bg-gradient-to-b from-white via-gray-50 to-gray-100 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Approval Workflow Template</h3>
              <p className="text-xs text-gray-600">
                Design KeyForge approval stages, steps, and AI agents for a given use case.
              </p>
            </div>
          </div>

          <div className="flex gap-4 min-w-max pb-2">
            {stages.map((stage: any, stageIndex: number) => (
              <div
                key={stage.id}
                className={`${STAGE_COLUMN_MIN} bg-gray-50 rounded-xl p-3 border transition-all duration-200 shadow-sm ${
                  selectedStageId === stage.id
                    ? "border-blue-500 ring-1 ring-blue-100 shadow-md"
                    : "border-gray-200 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    {editingStageId === stage.id ? (
                      <input
                        type="text"
                        value={editingStageName}
                        onChange={(e) => setEditingStageName(e.target.value)}
                        onBlur={() => {
                          if (editingStageName.trim()) {
                            setFormData((prev: any) => ({
                              ...prev,
                              step2: {
                                ...prev.step2,
                                stages: prev.step2.stages.map((s: any) =>
                                  s.id === stage.id ? { ...s, name: editingStageName.trim() } : s
                                ),
                              },
                            }));
                          }
                          setEditingStageId(null);
                          setEditingStageName("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          } else if (e.key === "Escape") {
                            setEditingStageId(null);
                            setEditingStageName("");
                          }
                        }}
                        autoFocus
                        className="w-full px-2 py-1 text-xs font-semibold border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <>
                        <h4
                          className={`font-semibold text-xs px-2 py-1 rounded-md inline-block max-w-full ${
                            STAGE_HEADING_BY_NAME[stage.name.trim().toLowerCase()] ??
                            STAGE_COLUMN_HEADING_CLASS[stageIndex % STAGE_COLUMN_HEADING_CLASS.length]
                          }`}
                        >
                          {stage.name.toUpperCase()}
                        </h4>
                        <p className="text-xs text-gray-500">Order {stage.order}</p>
                      </>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStageId(stage.id);
                        setEditingStageName(stage.name);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="Rename stage"
                    >
                      <Minus className="w-4 h-4 text-gray-600" />
                    </button>
                    {stage.order > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStage(stage.id)}
                        className="p-1 hover:bg-red-100 rounded"
                        title="Remove"
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {stage.steps.map((step: any) => (
                    <div
                      key={step.id}
                      onClick={() => selectStep(stage.id, step)}
                      className={`min-w-0 p-2.5 border rounded cursor-pointer transition-colors ${
                        selectedStepId === step.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-xs text-gray-900">{step.label}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeStep(stage.id, step.id);
                          }}
                          className="p-1 hover:bg-red-100 rounded"
                        >
                          <X className="w-3 h-3 text-red-600" />
                        </button>
                      </div>
                      <div className="flex gap-2 mb-2">
                        {step.type === "AI AGENT" ? (
                          <span className="text-xs px-2 py-0.5 rounded font-medium bg-purple-100 text-purple-700">
                            AI AGENT
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                            {step.kind}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {renderAddStepMenu(
                    stage.id,
                    categoryForStageIndex(stageIndex),
                    stage.steps.length === 0 ? "empty" : "chip"
                  )}
                </div>
              </div>
            ))}

            {/* Add Stage Button */}
            <button
              type="button"
              onClick={addStage}
              className={`${STAGE_COLUMN_MIN} h-fit px-3 py-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-gray-100 flex flex-col items-center justify-center gap-2 transition-colors`}
            >
              <Plus className="w-5 h-5 text-gray-400" />
              <span className="text-xs font-medium text-gray-600">Add Stage</span>
            </button>
          </div>
        </div>

        {selectedStep && (
        <div className="w-72 bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold text-slate-900 px-2 py-1 rounded-md bg-slate-200">
              Step Configuration
            </h3>
            <button
              type="button"
              onClick={closeStepConfiguration}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors shrink-0"
              aria-label="Close step configuration"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
            <div>
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-900 px-2 py-1 rounded-md bg-gray-100 inline-block max-w-full">
                  {selectedStep.label}
                </h4>
                <p className="text-xs text-gray-600">
                  Stage: {stages.find((s: any) => s.id === selectedStep.stageId)?.name} · Kind: {selectedStep.kind} · Type:{" "}
                  {selectedStep.type === "AI AGENT" ? "AI_AGENT" : selectedStep.type}
                </p>
              </div>

              {/* Tabs */}
              {(selectedStep.type === "AI AGENT" ||
                selectedStep.type === "APPROVAL" ||
                selectedStep.type === "LOGIC" ||
                selectedStep.type === "CUSTOM" ||
                selectedStep.type === "FULFILLMENT") && (
                <div className="flex gap-2 mb-4 border-b border-gray-200">
                  {(
                    selectedStep.type === "AI AGENT"
                      ? (["General", "Conditions", "AI Context"] as const)
                      : selectedStep.type === "APPROVAL"
                      ? (["General", "Conditions", "Approvers"] as const)
                      : selectedStep.type === "CUSTOM"
                      ? (["General", "Conditions", "Context"] as const)
                      : (["General", "Conditions"] as const)
                  ).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab as any)}
                      className={`px-2 py-1.5 text-[11px] font-medium rounded-t-lg transition-colors ${
                        activeTab === tab
                          ? "bg-blue-50 text-blue-700 border-b-2 border-blue-500"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}

              {/* Tab Content */}
              <div className="space-y-4">
                {selectedStep.type === "AI AGENT" && activeTab === "General" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Step label</label>
                      <input
                        type="text"
                        value={stepConfig?.label || ""}
                        onChange={(e) => updateStepConfig("label", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
                      <input
                        type="text"
                        value={stepConfig?.code || ""}
                        onChange={(e) => updateStepConfig("code", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description (internal)</label>
                      <textarea
                        value={stepConfig?.description || ""}
                        onChange={(e) => updateStepConfig("description", e.target.value)}
                        rows={3}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Timeout (seconds)</label>
                      <input
                        type="number"
                        value={stepConfig?.timeout || 30}
                        onChange={(e) => updateStepConfig("timeout", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-700">Blocking step</label>
                      <ToggleSwitch
                        checked={stepConfig?.blocking !== false}
                        onChange={(checked) => updateStepConfig("blocking", checked)}
                      />
                    </div>
                  </>
                )}

                {selectedStep.type === "AI AGENT" && activeTab === "Conditions" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Skip logic (no-code hint)
                      </label>
                      <select
                        value={stepConfig?.skipLogic || "never"}
                        onChange={(e) => handleSkipLogicChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="never">Never skip</option>
                        <option value="risk-low">Skip when risk = LOW</option>
                        <option value="display-only">Skip display-only entitlements</option>
                        <option value="condition">Skip on Condition</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Condition (CEL / expression)
                      </label>
                      <textarea
                        ref={conditionTextareaRef}
                        value={stepConfig?.condition && stepConfig.condition !== "true" ? stepConfig.condition : ""}
                        onChange={(e) => updateStepConfig("condition", e.target.value)}
                        disabled={stepConfig?.skipLogic !== "condition"}
                        rows={6}
                        placeholder='e.g. risk >= "HIGH" || entitlement.tags.contains("SOX")'
                        className={`w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono ${
                          stepConfig?.skipLogic !== "condition"
                            ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "border-gray-300"
                        }`}
                      />
                    </div>
                  </div>
                )}

                {selectedStep.type === "AI AGENT" && activeTab === "AI Context" && (
                  <div className="space-y-6">
                    <div>
                      <h5 className="text-xs font-semibold text-gray-900 mb-2">Input Signals</h5>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-gray-700">Peer Group Analysis</label>
                          <ToggleSwitch
                            checked={stepConfig?.inputSignals?.peerGroupAnalysis !== false}
                            onChange={(checked) =>
                              updateStepConfig("inputSignals", {
                                ...stepConfig?.inputSignals,
                                peerGroupAnalysis: checked,
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-gray-700">Historical Approvals</label>
                          <ToggleSwitch
                            checked={stepConfig?.inputSignals?.historicalApprovals !== false}
                            onChange={(checked) =>
                              updateStepConfig("inputSignals", {
                                ...stepConfig?.inputSignals,
                                historicalApprovals: checked,
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-gray-700">HR Attribute Correlation</label>
                          <ToggleSwitch
                            checked={stepConfig?.inputSignals?.hrAttributeCorrelation !== false}
                            onChange={(checked) =>
                              updateStepConfig("inputSignals", {
                                ...stepConfig?.inputSignals,
                                hrAttributeCorrelation: checked,
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-gray-700">External Threat Intel</label>
                          <ToggleSwitch
                            checked={stepConfig?.inputSignals?.externalThreatIntel === true}
                            onChange={(checked) =>
                              updateStepConfig("inputSignals", {
                                ...stepConfig?.inputSignals,
                                externalThreatIntel: checked,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-xs font-semibold text-gray-900 mb-2">Confidence Gate</h5>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">50%</span>
                          <span className="text-xs text-gray-600">100%</span>
                        </div>
                        <div className="relative">
                          <div className="relative h-2 bg-gray-200 rounded-lg">
                            <div
                              className="absolute top-0 left-0 h-2 bg-blue-600 rounded-lg"
                              style={{
                                width: `${((stepConfig?.confidenceThreshold || 87) - 50) / 50 * 100}%`,
                              }}
                            />
                            <input
                              type="range"
                              min="50"
                              max="100"
                              value={stepConfig?.confidenceThreshold || 87}
                              onChange={(e) =>
                                updateStepConfig("confidenceThreshold", parseInt(e.target.value))
                              }
                              className="absolute top-0 left-0 w-full h-2 bg-transparent appearance-none cursor-pointer z-10"
                              style={{
                                background: "transparent",
                              }}
                            />
                          </div>
                          <style jsx>{`
                            input[type="range"]::-webkit-slider-thumb {
                              appearance: none;
                              width: 18px;
                              height: 18px;
                              border-radius: 50%;
                              background: #3b82f6;
                              cursor: pointer;
                              border: 2px solid white;
                              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                              position: relative;
                              z-index: 20;
                            }
                            input[type="range"]::-moz-range-thumb {
                              width: 18px;
                              height: 18px;
                              border-radius: 50%;
                              background: #3b82f6;
                              cursor: pointer;
                              border: 2px solid white;
                              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                              position: relative;
                              z-index: 20;
                            }
                          `}</style>
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-medium text-gray-900">
                            Auto-approve confidence threshold: {stepConfig?.confidenceThreshold || 87}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-xs font-semibold text-gray-900 mb-2">Hard Stop Rules (AI Override)</h5>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-gray-700">If risk level is HIGH</label>
                          <ToggleSwitch
                            checked={stepConfig?.hardStopRules?.riskHigh !== false}
                            onChange={(checked) =>
                              updateStepConfig("hardStopRules", {
                                ...stepConfig?.hardStopRules,
                                riskHigh: checked,
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-gray-700">If SoD violation exists</label>
                          <ToggleSwitch
                            checked={stepConfig?.hardStopRules?.sodViolation !== false}
                            onChange={(checked) =>
                              updateStepConfig("hardStopRules", {
                                ...stepConfig?.hardStopRules,
                                sodViolation: checked,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedStep.type === "APPROVAL" && activeTab === "General" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Step label</label>
                      <input
                        type="text"
                        value={stepConfig?.label || ""}
                        onChange={(e) => updateStepConfig("label", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
                      <input
                        type="text"
                        value={stepConfig?.code || ""}
                        onChange={(e) => updateStepConfig("code", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description (internal)</label>
                      <textarea
                        value={stepConfig?.description || ""}
                        onChange={(e) => updateStepConfig("description", e.target.value)}
                        rows={3}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Timeout (seconds)</label>
                      <input
                        type="number"
                        value={stepConfig?.timeout || 30}
                        onChange={(e) => updateStepConfig("timeout", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-700">Blocking step</label>
                      <ToggleSwitch
                        checked={stepConfig?.blocking !== false}
                        onChange={(checked) => updateStepConfig("blocking", checked)}
                      />
                    </div>
                  </>
                )}

                {selectedStep.type === "APPROVAL" && activeTab === "Conditions" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Skip logic (no-code hint)
                      </label>
                      <select
                        value={stepConfig?.skipLogic || "never"}
                        onChange={(e) => handleSkipLogicChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="never">Never skip</option>
                        <option value="risk-low">Skip when risk = LOW</option>
                        <option value="display-only">Skip display-only entitlements</option>
                        <option value="condition">Skip on Condition</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Condition (CEL / expression)
                      </label>
                      <textarea
                        ref={conditionTextareaRef}
                        value={stepConfig?.condition && stepConfig.condition !== "true" ? stepConfig.condition : ""}
                        onChange={(e) => updateStepConfig("condition", e.target.value)}
                        disabled={stepConfig?.skipLogic !== "condition"}
                        rows={6}
                        placeholder='e.g. risk >= "HIGH" || entitlement.tags.contains("SOX")'
                        className={`w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono ${
                          stepConfig?.skipLogic !== "condition"
                            ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "border-gray-300"
                        }`}
                      />
                    </div>
                  </div>
                )}

                {selectedStep.type === "APPROVAL" && activeTab === "Approvers" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Approver resolver</label>
                      <select
                        value={stepConfig?.approverResolver || "line-manager"}
                        onChange={(e) => updateStepConfig("approverResolver", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="line-manager">Line manager (HR)</option>
                        <option value="department-head">Department head</option>
                        <option value="app-owner">Application owner</option>
                        <option value="role-owner">Role / role collection owner</option>
                        <option value="custom-lookup">Custom Lookup</option>
                        <option value="custom">Custom lookup</option>
                      </select>
                      {stepConfig?.approverResolver === "custom-lookup" && (
                        <div className="mt-2">
                          <span className="mb-1 block text-xs font-medium text-gray-700">Task name</span>
                          <div className="rounded border border-gray-300 bg-slate-50 px-2.5 py-2 text-xs leading-snug text-slate-900 min-h-[2.25rem]">
                            {String(stepConfig?.taskName ?? "").trim() || "—"}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Escalate after (hours)
                      </label>
                      <input
                        type="number"
                        value={stepConfig?.escalateAfter || 24}
                        onChange={(e) =>
                          updateStepConfig("escalateAfter", parseInt(e.target.value))
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-700">
                        Skip if requestor is approver
                      </label>
                      <ToggleSwitch
                        checked={stepConfig?.skipIfRequestorIsApprover !== false}
                        onChange={(checked) =>
                          updateStepConfig("skipIfRequestorIsApprover", checked)
                        }
                      />
                    </div>
                  </div>
                )}

                {selectedStep.type === "LOGIC" && activeTab === "General" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Step label</label>
                      <input
                        type="text"
                        value={stepConfig?.label || ""}
                        onChange={(e) => updateStepConfig("label", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
                      <input
                        type="text"
                        value={stepConfig?.code || ""}
                        onChange={(e) => updateStepConfig("code", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Description (internal)
                      </label>
                      <textarea
                        value={stepConfig?.description || ""}
                        onChange={(e) => updateStepConfig("description", e.target.value)}
                        rows={3}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Timeout (seconds)</label>
                      <input
                        type="number"
                        value={stepConfig?.timeout || 30}
                        onChange={(e) => updateStepConfig("timeout", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-700">Blocking step</label>
                      <ToggleSwitch
                        checked={stepConfig?.blocking !== false}
                        onChange={(checked) => updateStepConfig("blocking", checked)}
                      />
                    </div>
                  </>
                )}

                {selectedStep.type === "LOGIC" && activeTab === "Conditions" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Skip logic (no-code hint)
                      </label>
                      <select
                        value={stepConfig?.skipLogic || "never"}
                        onChange={(e) => handleSkipLogicChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="never">Never skip</option>
                        <option value="risk-low">Skip when risk = LOW</option>
                        <option value="display-only">Skip display-only entitlements</option>
                        <option value="condition">Skip on Condition</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Condition (CEL / expression)
                      </label>
                      <textarea
                        ref={conditionTextareaRef}
                        value={stepConfig?.condition && stepConfig.condition !== "true" ? stepConfig.condition : ""}
                        onChange={(e) => updateStepConfig("condition", e.target.value)}
                        disabled={stepConfig?.skipLogic !== "condition"}
                        rows={6}
                        placeholder='e.g. risk >= "HIGH" || entitlement.tags.contains("SOX")'
                        className={`w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono ${
                          stepConfig?.skipLogic !== "condition"
                            ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "border-gray-300"
                        }`}
                      />
                    </div>
                  </div>
                )}

                {selectedStep.type === "CUSTOM" && activeTab === "General" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Select Agent Task</label>
                      <select
                        value={stepConfig?.label || ""}
                        onChange={(e) => updateStepConfig("label", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Select an agent task</option>
                        {AGENT_TASKS.map((task) => (
                          <option key={task.id} value={task.name}>
                            {task.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
                      <input
                        type="text"
                        value={stepConfig?.code || ""}
                        onChange={(e) => updateStepConfig("code", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Description (internal)
                      </label>
                      <textarea
                        value={stepConfig?.description || ""}
                        onChange={(e) => updateStepConfig("description", e.target.value)}
                        rows={3}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Timeout (seconds)</label>
                      <input
                        type="number"
                        value={stepConfig?.timeout || 30}
                        onChange={(e) => updateStepConfig("timeout", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-700">Blocking step</label>
                      <ToggleSwitch
                        checked={stepConfig?.blocking !== false}
                        onChange={(checked) => updateStepConfig("blocking", checked)}
                      />
                    </div>
                  </>
                )}

                {selectedStep.type === "CUSTOM" && activeTab === "Conditions" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Skip logic (no-code hint)
                      </label>
                      <select
                        value={stepConfig?.skipLogic || "never"}
                        onChange={(e) => handleSkipLogicChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="never">Never skip</option>
                        <option value="risk-low">Skip when risk = LOW</option>
                        <option value="display-only">Skip display-only entitlements</option>
                        <option value="condition">Skip on Condition</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Condition (CEL / expression)
                      </label>
                      <textarea
                        ref={conditionTextareaRef}
                        value={stepConfig?.condition && stepConfig.condition !== "true" ? stepConfig.condition : ""}
                        onChange={(e) => updateStepConfig("condition", e.target.value)}
                        disabled={stepConfig?.skipLogic !== "condition"}
                        rows={6}
                        placeholder='e.g. risk >= "HIGH" || entitlement.tags.contains("SOX")'
                        className={`w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono ${
                          stepConfig?.skipLogic !== "condition"
                            ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "border-gray-300"
                        }`}
                      />
                    </div>
                  </div>
                )}

                {selectedStep.type === "CUSTOM" && activeTab === "Context" && (
                  <div className="space-y-6">
                    {(() => {
                      const selectedAgentTask = AGENT_TASKS.find((t) => t.name === stepConfig?.label);
                      return (
                        <>
                          <div>
                            <h5 className="text-xs font-semibold text-gray-900 mb-2">Input Signals</h5>
                            {selectedAgentTask ? (
                              <div className="flex flex-wrap gap-2">
                                {selectedAgentTask.inputs.map((input) => (
                                  <span
                                    key={input}
                                    className="rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] text-blue-700"
                                  >
                                    {input}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500">
                                Select an agent task in the General tab to see its input signals.
                              </p>
                            )}
                          </div>

                          <div>
                            <h5 className="text-xs font-semibold text-gray-900 mb-2">Output Schema</h5>
                            {selectedAgentTask ? (
                              <div className="flex flex-wrap gap-2">
                                {selectedAgentTask.schema.map((field) => (
                                  <span
                                    key={field.field}
                                    title={field.description}
                                    className="rounded-full border border-purple-300 bg-purple-50 px-2.5 py-1 text-[11px] text-purple-700"
                                  >
                                    {field.field}
                                    <span className="text-purple-400"> · {field.type}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500">
                                Select an agent task in the General tab to see its output schema.
                              </p>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {selectedStep.type === "FULFILLMENT" && activeTab === "General" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Step label</label>
                      <input
                        type="text"
                        value={stepConfig?.label || ""}
                        onChange={(e) => updateStepConfig("label", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
                      <input
                        type="text"
                        value={stepConfig?.code || ""}
                        onChange={(e) => updateStepConfig("code", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Description (internal)
                      </label>
                      <textarea
                        value={stepConfig?.description || ""}
                        onChange={(e) => updateStepConfig("description", e.target.value)}
                        rows={3}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-700">Blocking step</label>
                      <ToggleSwitch
                        checked={stepConfig?.blocking !== false}
                        onChange={(checked) => updateStepConfig("blocking", checked)}
                      />
                    </div>
                  </>
                )}

                {selectedStep.type === "FULFILLMENT" && activeTab === "Conditions" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Skip logic (no-code hint)
                      </label>
                      <select
                        value={stepConfig?.skipLogic || "never"}
                        onChange={(e) => handleSkipLogicChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="never">Never skip</option>
                        <option value="risk-low">Skip when risk = LOW</option>
                        <option value="display-only">Skip display-only entitlements</option>
                        <option value="condition">Skip on Condition</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Condition (CEL / expression)
                      </label>
                      <textarea
                        ref={conditionTextareaRef}
                        value={stepConfig?.condition && stepConfig.condition !== "true" ? stepConfig.condition : ""}
                        onChange={(e) => updateStepConfig("condition", e.target.value)}
                        disabled={stepConfig?.skipLogic !== "condition"}
                        rows={6}
                        placeholder='e.g. risk >= "HIGH" || entitlement.tags.contains("SOX")'
                        className={`w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono ${
                          stepConfig?.skipLogic !== "condition"
                            ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "border-gray-300"
                        }`}
                      />
                    </div>
                  </div>
                )}

                {selectedStep.type !== "AI AGENT" &&
                  selectedStep.type !== "APPROVAL" &&
                  selectedStep.type !== "LOGIC" &&
                  selectedStep.type !== "CUSTOM" &&
                  selectedStep.type !== "FULFILLMENT" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Step label</label>
                        <input
                          type="text"
                          value={stepConfig?.label || ""}
                          onChange={(e) => updateStepConfig("label", e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
                        <input
                          type="text"
                          value={stepConfig?.code || ""}
                          onChange={(e) => updateStepConfig("code", e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Description (internal)
                        </label>
                        <textarea
                          value={stepConfig?.description || ""}
                          onChange={(e) => updateStepConfig("description", e.target.value)}
                          rows={3}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Timeout (seconds)</label>
                        <input
                          type="number"
                          value={stepConfig?.timeout || 30}
                          onChange={(e) => updateStepConfig("timeout", e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-700">Blocking step</label>
                        <ToggleSwitch
                          checked={stepConfig?.blocking !== false}
                          onChange={(checked) => updateStepConfig("blocking", checked)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Condition</label>
                        <input
                          type="text"
                          value={stepConfig?.condition || "true"}
                          onChange={(e) => updateStepConfig("condition", e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}
              </div>
            </div>
        </div>
        )}
      </div>
      )}

      {policyUiTab === "advanced" && (
        <div className="w-full mt-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-gray-900 mb-2 px-2 py-1 rounded-md bg-gray-200 inline-block">
              Workflow-as-Code Preview (read-only)
            </h3>
            <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-auto text-[11px] leading-relaxed font-mono max-h-64">
              {JSON.stringify(generateWorkflowJSON(), null, 2)}
            </pre>
          </div>
        </div>
      )}

    </div>
  );
};

const getInitialFormData = () => ({
  step1: {
    ownerUser: [] as any[],
    ownerGroup: [] as any[],
    certificationTemplate: "",
    workflowType: "",
    eventType: "",
    description: "",
    tags: "",
    owner: "",
    ownerType: "User",
    userType: "",
    specificUserExpression: [defaultExpression] as { attribute: any; operator: any; value: string }[],
    specificApps: [] as string[] | null,
    expressionApps: [] as { attribute: any; operator: any; value: string }[],
    expressionEntitlement: [defaultExpression] as { attribute: any; operator: any; value: string }[],
    groupListIsChecked: false,
    userGroupList: null as string | null,
    importNewUserGroup: null as File | null,
    excludeUsersIsChecked: false,
    excludeUsers: null as string | null,
    selectData: "",
  },
  step2: {
    stages: [
      {
        id: "stage-validate",
        name: "Validate",
        order: 1,
        steps: [
          {
            id: "step-sod-analysis",
            label: "SoD Analysis",
            code: "SOD_ANALYSIS",
            kind: "SYSTEM",
            type: "LOGIC",
            condition: "true",
          },
          {
            id: "step-ai-auto-approve",
            label: "AI Auto-Approve Analysis",
            code: "AI_AUTO_APPROVE_ANALYSIS",
            kind: "AI",
            type: "AI AGENT",
            condition: "true",
          },
        ],
      },
      {
        id: "stage-manager-approval",
        name: "Manager Approval",
        order: 2,
        steps: [
          {
            id: "step-manager-approval",
            label: "Manager Approval",
            code: "MANAGER_APPROVAL",
            kind: "HUMAN",
            type: "APPROVAL",
            condition: 'risk >= "MEDIUM"',
          },
        ],
      },
      {
        id: "stage-operational-approval",
        name: "Operational Approval",
        order: 3,
        steps: [
          {
            id: "step-app-owner-approval",
            label: "App Owner Approval",
            code: "APP_OWNER_APPROVAL",
            kind: "HUMAN",
            type: "APPROVAL",
            condition: "true",
          },
        ],
      },
      {
        id: "stage-fulfillment",
        name: "Fulfillment",
        order: 4,
        steps: [
          {
            id: "step-scim-fulfillment",
            label: "SCIM Fulfillment",
            code: "SCIM_FULFILLMENT",
            kind: "SYSTEM",
            type: "FULFILLMENT",
            condition: "approved == true",
          },
        ],
      },
    ],
    selectedStep: null,
    selectedStage: null,
  },
  step3: {
    notificationEnabled: false,
    emailTemplate: "",
    escalationEnabled: false,
    escalationTime: "",
  },
});

function buildWorkflowJsonPreview(formData: any) {
  const stages = formData?.step2?.stages || [];
  const workflowStages = stages.map((stage: any) => {
    let stageCondition = "true";
    if (stage.steps?.length > 0) {
      const stepWithCondition = stage.steps.find((st: any) => st.condition && st.condition !== "true");
      if (stepWithCondition) {
        stageCondition = stepWithCondition.condition;
      } else if (stage.steps[0].condition) {
        stageCondition = stage.steps[0].condition;
      }
    }

    const stageSteps = (stage.steps || []).map((step: any) => {
      const stepJSON: any = {
        code: step.code,
        label: step.label,
        kind: step.kind,
        type:
          step.type === "AI AGENT" ? "AI_AGENT" : step.type === "FULFILLMENT" ? "FULFILL" : step.type,
        config: {
          blocking: step.blocking !== false,
        },
      };

      if (step.type === "AI AGENT") {
        stepJSON.ai = {
          enabled: true,
          peerGroup: step.inputSignals?.peerGroupAnalysis !== false,
          historicalApprovals: step.inputSignals?.historicalApprovals !== false,
          hrCorrelation: step.inputSignals?.hrAttributeCorrelation !== false,
          externalThreat: step.inputSignals?.externalThreatIntel === true,
          confidence: step.confidenceThreshold || 87,
          hardStops: {
            highRisk: step.hardStopRules?.riskHigh !== false,
            sodViolation: step.hardStopRules?.sodViolation !== false,
          },
        };
      }

      if (step.type === "APPROVAL") {
        applyApprovalStepToWorkflowJson(stepJSON, step);
      }

      const conditionStr =
        typeof step.condition === "string"
          ? step.condition
          : step.condition?.expression ?? step.condition?.expr ?? "true";

      if (step.type === "FULFILLMENT") {
        stepJSON.config.mode = "ASYNC";
        if (conditionStr && conditionStr !== "true") {
          stepJSON.config.conditionExpr = conditionStr;
        }
      } else {
        stepJSON.condition = { expression: conditionStr || "true" };
      }

      if (step.type === "CUSTOM") {
        stepJSON.config.description = step.description || "";
      }

      return stepJSON;
    });

    return {
      name: stage.name,
      order: stage.order,
      condition:
        stageCondition === "true" || !stageCondition
          ? stageCondition
          : { expression: stageCondition },
      steps: stageSteps,
    };
  });

  return {
    templateCode: "WF_STD_KEYFORGE",
    version: 1,
    type: "ACCESS_REQUEST",
    stages: workflowStages,
  };
}

function ReviewSectionHeader({
  icon: Icon,
  title,
  iconClassName,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  iconClassName?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${iconClassName ?? "text-sky-600"}`} />
        <h3 className="text-sm font-semibold tracking-tight text-sky-700">{title}</h3>
      </div>
      {action}
    </div>
  );
}

function formatStep1Owners(s1: any): string {
  if (s1.ownerType === "User" && Array.isArray(s1.ownerUser) && s1.ownerUser.length > 0) {
    return s1.ownerUser.map((u: any) => u?.label ?? u).filter(Boolean).join(", ");
  }
  if (s1.ownerType === "Group" && Array.isArray(s1.ownerGroup) && s1.ownerGroup.length > 0) {
    return s1.ownerGroup.map((g: any) => g?.label ?? g).filter(Boolean).join(", ");
  }
  return s1.owner ? String(s1.owner) : "";
}

const STAGE_HEADER_TONES = [
  "bg-slate-800 text-white",
  "bg-amber-500 text-white",
  "bg-blue-600 text-white",
  "bg-emerald-600 text-white",
  "bg-violet-600 text-white",
  "bg-rose-600 text-white",
];

function SectionEditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
    >
      <SquarePen className="h-3.5 w-3.5" />
      Edit
    </button>
  );
}

function WorkflowReviewSubmit({
  formData,
  fullWidth = false,
  onEditSection,
}: {
  formData: any;
  fullWidth?: boolean;
  onEditSection?: (step: 1 | 2) => void;
}) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const stages = formData?.step2?.stages || [];

  const allSteps = stages.flatMap((st: any) => st.steps || []);
  const codeU = (step: any) => String(step.code || "").toUpperCase();
  const hasSod = allSteps.some((st: any) => codeU(st).includes("SOD"));
  const hasTraining = allSteps.some((st: any) => codeU(st).includes("TRAINING"));
  const hasAi = allSteps.some((st: any) => st.kind === "AI" || st.type === "AI AGENT");

  const securityPolicies = [
    { id: "sod", label: "sod", enabled: hasSod },
    { id: "training", label: "training", enabled: hasTraining },
    { id: "aiRisk", label: "aiRisk", enabled: hasAi },
    { id: "normalize", label: "normalize", enabled: false },
    { id: "riskClassify", label: "riskClassify", enabled: false },
    { id: "aiExplain", label: "aiExplain", enabled: false },
  ];

  const s1 = formData?.step1 || {};
  const s3 = formData?.step3 || {};
  const dash = (v: string) => (v && String(v).trim() ? v : "—");
  const dashOptional = (v: unknown) => {
    if (v === null || v === undefined) return "—";
    const s = String(v).trim();
    return s || "—";
  };

  return (
    <div className={fullWidth ? "w-full space-y-5 pb-6" : "mx-auto max-w-4xl space-y-5 pb-6"}>
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <ReviewSectionHeader
          icon={Layers}
          title="Basic Information (Step 1)"
          action={onEditSection && <SectionEditButton onClick={() => onEditSection(1)} />}
        />
        <dl className="divide-y divide-gray-100">
          <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <dt className="shrink-0 font-medium text-gray-600">Name</dt>
            <dd className="text-right font-medium text-gray-900">{dash(s1.certificationTemplate)}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
            <dt className="shrink-0 font-medium text-gray-600">Description</dt>
            <dd className="max-w-[70%] text-right text-gray-900">{dash(s1.description)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <dt className="shrink-0 font-medium text-gray-600">Owner type</dt>
            <dd className="text-right font-medium text-gray-900">{dashOptional(s1.ownerType)}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
            <dt className="shrink-0 font-medium text-gray-600">Owners</dt>
            <dd className="max-w-[70%] text-right text-gray-900">{dash(formatStep1Owners(s1))}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <dt className="shrink-0 font-medium text-gray-600">Tags</dt>
            <dd className="text-right text-gray-900">{dash(s1.tags)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <dt className="shrink-0 font-medium text-gray-600">Workflow Type</dt>
            <dd className="text-right font-medium text-gray-900">{dash(s1.workflowType)}</dd>
          </div>
          {s1.workflowType === "Assurance Event" && (
            <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
              <dt className="shrink-0 font-medium text-gray-600">Select Event Type</dt>
              <dd className="max-w-[70%] text-right text-gray-900">
                {dash(
                  (() => {
                    const matched = INITIAL_EVENT_DEFINITIONS.find((e) => e.id === s1.eventType);
                    return matched ? `${matched.id} - ${matched.name}` : s1.eventType;
                  })()
                )}
              </dd>
            </div>
          )}
          {(s1.excludeUsersIsChecked || s1.groupListIsChecked) && (
            <div className="py-2.5 text-sm">
              <dt className="font-medium text-gray-600">Additional scope options</dt>
              <dd className="mt-1 text-right text-xs text-gray-700">
                {[
                  s1.groupListIsChecked ? "Custom user group list" : null,
                  s1.excludeUsersIsChecked ? "Exclude users" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <ReviewSectionHeader
          icon={GitBranch}
          title="Workflow Stages & Steps (Step 2)"
          action={onEditSection && <SectionEditButton onClick={() => onEditSection(2)} />}
        />
        {stages.length === 0 ? (
          <p className="text-xs text-gray-500">Add stages in Policy Builder to see them here.</p>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto">
            <div className="w-max min-w-full flex flex-nowrap items-center gap-1.5 sm:gap-2">
              <div className="h-18 w-18 shrink-0 rounded-full border-2 border-slate-200 bg-white text-center flex items-center justify-center px-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-700 leading-tight">
                  Request Submitted
                </span>
              </div>
              <span className="text-slate-400 text-base shrink-0 self-center">→</span>

              {stages.map((stage: any, idx: number) => {
                const stepsList = stage.steps || [];
                return (
                  <React.Fragment key={stage.id ?? `flow-stage-${idx}`}>
                    <div className="min-w-[160px] flex-1">
                      <div
                        className={`rounded-md px-2.5 py-2 text-center text-[11px] font-semibold ${
                          STAGE_HEADER_TONES[idx % STAGE_HEADER_TONES.length]
                        }`}
                      >
                        {String(stage.name || `Stage ${idx + 1}`).toUpperCase()}
                      </div>
                      <div className="mt-2 space-y-2">
                        {stepsList.length === 0 ? (
                          <p className="text-[10px] text-gray-400 text-center">No steps in this stage.</p>
                        ) : (
                          stepsList.map((step: any, stepIdx: number) => (
                            <div
                              key={step.id ?? `${stage.id ?? idx}-step-${stepIdx}`}
                              className={`rounded-md border px-2.5 py-2 text-center ${
                                idx % 2 === 0
                                  ? "border-slate-200 bg-white"
                                  : "border-amber-200 bg-amber-50/40"
                              }`}
                            >
                              <div className="text-xs font-semibold text-slate-700 leading-tight">
                                {String(step.label || `Step ${stepIdx + 1}`).toUpperCase()}
                              </div>
                              <div className="mt-1 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-800">
                                {step.code || "N/A"}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <span className="text-slate-400 text-base shrink-0 self-center">→</span>
                  </React.Fragment>
                );
              })}

              <div className="h-18 w-18 shrink-0 rounded-full border-2 border-slate-200 bg-white text-center flex items-center justify-center px-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-700 leading-tight">
                  Request Completed
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {(s3.notificationEnabled ||
        s3.escalationEnabled ||
        (s3.emailTemplate && String(s3.emailTemplate).trim()) ||
        (s3.escalationTime && String(s3.escalationTime).trim())) && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <ReviewSectionHeader icon={Bell} title="Notifications" />
          <dl className="divide-y divide-gray-100">
            <div className="flex items-center justify-between gap-4 py-2 text-sm">
              <dt className="text-gray-600">Notifications</dt>
              <dd className="text-xs font-semibold uppercase text-gray-900">
                {s3.notificationEnabled ? "On" : "Off"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 text-sm">
              <dt className="text-gray-600">Email template</dt>
              <dd className="max-w-[60%] truncate text-right text-gray-900">
                {dash(s3.emailTemplate)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 text-sm">
              <dt className="text-gray-600">Escalation</dt>
              <dd className="text-xs font-semibold uppercase text-gray-900">
                {s3.escalationEnabled ? "On" : "Off"}
                {s3.escalationEnabled && s3.escalationTime
                  ? ` · ${s3.escalationTime}`
                  : ""}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <ReviewSectionHeader icon={ShieldCheck} title="Security Policies" />
        <ul className="divide-y divide-gray-100">
          {securityPolicies.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="font-mono text-xs font-medium text-gray-800">{p.label}</span>
              {p.enabled ? (
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                  Enabled
                </span>
              ) : (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Disabled
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-1">
        <button
          type="button"
          onClick={() => setJsonOpen((o) => !o)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
        >
          <Code className="h-4 w-4 shrink-0" aria-hidden />
          {jsonOpen ? "Hide" : "Show"} Workflow-as-Code (JSON)
        </button>
        {jsonOpen && (
          <pre className="mt-3 max-h-[min(28rem,50vh)] overflow-auto rounded-xl border border-gray-200 bg-slate-950 p-4 text-left text-[11px] leading-relaxed text-emerald-100">
            {JSON.stringify(buildWorkflowJsonPreview(formData), null, 2)}
          </pre>
        )}
      </div>

    </div>
  );
}

export default function WorkflowBuilderCreatePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(() =>
    searchParams.get("step") === "2" ? 2 : 1
  );
  const [formData, setFormData] = useState(getInitialFormData);
  const { isVisible: isSidebarVisible, sidebarWidthPx } = useLeftSidebar();

  const steps = [
    { id: 1, title: "Basic Information" },
    { id: 2, title: "Policy Builder" },
    { id: 3, title: "Review and Submit" },
  ];

  const {
    register,
    setValue,
    reset,
    control,
    watch,
    resetField,
    formState: { errors, isValid: step1Valid },
  } = useForm({
    mode: "onChange",
    defaultValues: {
      ownerUser: formData.step1.ownerUser || [],
      ownerGroup: formData.step1.ownerGroup || [],
      certificationTemplate: formData.step1.certificationTemplate || "",
      workflowType: formData.step1.workflowType || "",
      eventType: formData.step1.eventType || "",
      description: formData.step1.description || "",
      tags: formData.step1.tags || "",
      owner: formData.step1.owner || "",
      ownerType: formData.step1.ownerType || "User",
      userType: formData.step1.userType || "",
      specificUserExpression: formData.step1.specificUserExpression || [defaultExpression],
      specificApps: formData.step1.specificApps || [],
      expressionApps: formData.step1.expressionApps || [],
      expressionEntitlement: formData.step1.expressionEntitlement || [defaultExpression],
      groupListIsChecked: formData.step1.groupListIsChecked || false,
      userGroupList: formData.step1.userGroupList || null,
      importNewUserGroup: formData.step1.importNewUserGroup || null,
      excludeUsersIsChecked: formData.step1.excludeUsersIsChecked || false,
      excludeUsers: formData.step1.excludeUsers || null,
      selectData: formData.step1.selectData || "",
    },
  });

  const ownerType = watch("ownerType");
  const userType = watch("userType");
  const groupListIsChecked = watch("groupListIsChecked");
  const excludeUsersIsChecked = watch("excludeUsersIsChecked");
  const selectData = watch("selectData");
  const workflowType = watch("workflowType");
  const editPolicyId = searchParams.get("id");
  const isViewMode = searchParams.get("view") === "1" && Boolean(editPolicyId);
  const isEditFromView = isViewMode && searchParams.get("edit") === "1";
  const jumpToSection = searchParams.get("step");
  const policyBuilderSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isEditFromView && jumpToSection === "2") {
      policyBuilderSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isEditFromView, jumpToSection]);

  useEffect(() => {
    if (workflowType !== "Assurance Event") {
      setValue("eventType", "", { shouldValidate: false });
    }
  }, [workflowType, setValue]);

  useEffect(() => {
    if (ownerType === "User") {
      setValue("ownerGroup", [], { shouldValidate: true });
    } else if (ownerType === "Group") {
      setValue("ownerUser", [], { shouldValidate: true });
    }
  }, [ownerType, setValue]);

  useEffect(() => {
    if (userType === "All users") {
      setValue("userGroupList", "", { shouldValidate: false });
      setValue("specificUserExpression", [], { shouldValidate: false });
      setValue("groupListIsChecked", false, { shouldValidate: false });
    } else if (userType === "Custom User Group") {
      setValue("specificUserExpression", [], { shouldValidate: false });
      if (groupListIsChecked) {
        setValue("userGroupList", "", { shouldValidate: false });
      }
    } else if (userType === "Specific users") {
      setValue("userGroupList", "", { shouldValidate: false });
      setValue("groupListIsChecked", false, { shouldValidate: false });
    }
    if (!groupListIsChecked) {
      resetField("importNewUserGroup");
    }
    if (!excludeUsersIsChecked) {
      resetField("excludeUsers");
    }
  }, [
    userType,
    groupListIsChecked,
    excludeUsersIsChecked,
    resetField,
    setValue,
  ]);

  useEffect(() => {
    if (selectData === "Entitlement") {
      setValue("specificApps", [], { shouldValidate: false });
      setValue("expressionApps", [], { shouldValidate: false });
    }
    if (selectData === "Roles") {
      setValue("expressionEntitlement", [], { shouldValidate: false });
    }
    if (selectData === "Application") {
      setValue("expressionEntitlement", [], { shouldValidate: false });
    }
    if (selectData === "Entitlement") {
      setValue("specificApps", [], { shouldValidate: false });
    }
  }, [selectData, setValue]);

  // Create new (no ?id=): fresh form; do not hydrate from last "Edit" in localStorage.
  // Edit (?id=): prefill when localStorage row matches the URL id.
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!editPolicyId) {
      try {
        window.localStorage.removeItem("selectedWorkflowPolicy");
      } catch {
        /* ignore */
      }
      const fresh = getInitialFormData();
      setFormData(fresh);
      reset({
        ownerUser: fresh.step1.ownerUser,
        ownerGroup: fresh.step1.ownerGroup,
        certificationTemplate: fresh.step1.certificationTemplate,
        workflowType: fresh.step1.workflowType,
        eventType: fresh.step1.eventType,
        description: fresh.step1.description,
        tags: fresh.step1.tags,
        owner: fresh.step1.owner,
        ownerType: fresh.step1.ownerType,
        userType: fresh.step1.userType,
        specificUserExpression: fresh.step1.specificUserExpression,
        specificApps: fresh.step1.specificApps,
        expressionApps: fresh.step1.expressionApps,
        expressionEntitlement: fresh.step1.expressionEntitlement,
        groupListIsChecked: fresh.step1.groupListIsChecked,
        userGroupList: fresh.step1.userGroupList,
        importNewUserGroup: fresh.step1.importNewUserGroup,
        excludeUsersIsChecked: fresh.step1.excludeUsersIsChecked,
        excludeUsers: fresh.step1.excludeUsers,
        selectData: fresh.step1.selectData,
      });
      setCurrentStep(1);
      return;
    }

    try {
      const raw = window.localStorage.getItem("selectedWorkflowPolicy");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (String(data.id) !== String(editPolicyId)) return;

      setValue("certificationTemplate", data.name ?? "", { shouldValidate: true });
      setValue("description", data.description ?? "", { shouldValidate: true });

      const ownerFromData = data.created_by ?? data.owner ?? "";
      if (ownerFromData) {
        setValue("owner", ownerFromData, { shouldValidate: true });
      }

      if (data.tags) {
        setValue("tags", data.tags ?? "", { shouldValidate: false });
      }

      const workflowTypeFromData = String(
        data.business_object_type ?? data.workflow_type ?? ""
      )
        .replace(/_/g, " ")
        .trim();
      if (workflowTypeFromData) {
        setValue("workflowType", workflowTypeFromData, { shouldValidate: true });
      }

      const eventTypeFromData = data.code ? String(data.code).trim() : "";
      if (eventTypeFromData) {
        setValue("eventType", eventTypeFromData, { shouldValidate: true });
      }

      // Keep local step1 snapshot in sync during edit prefill.
      // Without this, Next can remain disabled until any field is manually changed.
      setFormData((prev) => ({
        ...prev,
        step1: {
          ...prev.step1,
          certificationTemplate: data.name ?? "",
          description: data.description ?? "",
          owner: ownerFromData ?? "",
          tags: data.tags ?? "",
          workflowType: workflowTypeFromData || prev.step1.workflowType,
          eventType: eventTypeFromData || prev.step1.eventType,
        },
      }));

      // If we have a definition_json.stages payload, hydrate step2 from it
      const def = data.definition_json || data.definitionJson || data.definition;
      if (def && Array.isArray(def.stages)) {
        const normalizedStages = (def.stages as any[]).map((stage: any, stageIdx: number) => {
          const stageName =
            stage.name ||
            (typeof stage.id === "string"
              ? stage.id
                  .replace(/_/g, " ")
                  .toLowerCase()
                  .replace(/\b\w/g, (c: string) => c.toUpperCase())
              : "") ||
            `Stage ${stageIdx + 1}`;

          const mappedSteps = Array.isArray(stage.steps)
            ? stage.steps.map((step: any, stepIdx: number) => {
                const rawCode: string =
                  step.code ||
                  step.stepTypeCode ||
                  step.type ||
                  step.id ||
                  `STEP_${stepIdx + 1}`;

                const upperCode = String(rawCode).toUpperCase();

                let kind: "SYSTEM" | "HUMAN" | "AI" = "SYSTEM";
                let type: "LOGIC" | "APPROVAL" | "FULFILLMENT" | "AI AGENT" | "CUSTOM" = "LOGIC";

                if (upperCode === "AI_AUTO_APPROVE_ANALYSIS" || upperCode.startsWith("AI_")) {
                  kind = "AI";
                  type = "AI AGENT";
                } else if (
                  upperCode.startsWith("APPROVAL_") ||
                  upperCode === "HUMAN_APPROVAL"
                ) {
                  kind = "HUMAN";
                  type = "APPROVAL";
                } else if (
                  upperCode.endsWith("FULFILLMENT") ||
                  upperCode.startsWith("SCIM_") ||
                  upperCode.includes("ITSM") ||
                  upperCode.includes("JIT_GRANT")
                ) {
                  kind = "SYSTEM";
                  type = "FULFILLMENT";
                } else if (
                  upperCode.startsWith("AGENT_") ||
                  upperCode.startsWith("CUSTOM_")
                ) {
                  kind = "AI";
                  type = "CUSTOM";
                } else {
                  kind = "SYSTEM";
                  type = "LOGIC";
                }

                const conditionExpr =
                  step.condition?.expression ||
                  step.conditionExpr ||
                  step.config?.conditionExpr ||
                  null;
                // "true" is the builder's own placeholder for "no condition set" — treat it
                // the same as missing so a workflow-specific default can still fill it in.
                const hasRealConditionExpr = !!conditionExpr && conditionExpr !== "true";
                const fallbackCondition = hasRealConditionExpr
                  ? null
                  : defaultConditionForCode(upperCode, data.name);

                const prettyLabelSource: string =
                  step.name || step.id || rawCode || `Step ${stepIdx + 1}`;
                const label = String(prettyLabelSource)
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c: string) => c.toUpperCase());

                const baseStep = {
                  id: `step-${stageIdx + 1}-${stepIdx + 1}-${upperCode}`,
                  label,
                  code: upperCode,
                  kind,
                  type,
                  condition: fallbackCondition || conditionExpr || "true",
                  skipLogic: hasRealConditionExpr ? "condition" : "never",
                };

                if (type === "APPROVAL") {
                  return {
                    ...baseStep,
                    ...approverFieldsFromApiConfig(step.config, upperCode),
                  };
                }

                return baseStep;
              })
            : [];

          return {
            id: stage.id || `stage-${stageIdx + 1}`,
            name: stageName,
            order: stage.sequence ?? stage.order ?? stageIdx + 1,
            steps: mappedSteps,
          };
        });

        setFormData((prev) => ({
          ...prev,
          step2: {
            ...prev.step2,
            stages: normalizedStages,
          },
        }));
      }
    } catch {
      // ignore bad JSON / storage issues
    }
  }, [editPolicyId, setValue, setFormData, reset]);

  useEffect(() => {
    const subscription = watch((values) => {
      setFormData((prev) => ({
        ...prev,
        step1: {
          ownerUser: values.ownerUser || [],
          ownerGroup: values.ownerGroup || [],
          certificationTemplate: values.certificationTemplate || "",
          workflowType: values.workflowType || "",
          eventType: values.eventType || "",
          description: values.description || "",
          tags: values.tags || "",
          owner: values.owner || "",
          ownerType: values.ownerType || "User",
          userType: values.userType || "",
          specificUserExpression: values.specificUserExpression || [defaultExpression],
          specificApps: values.specificApps || [],
          expressionApps: values.expressionApps || [],
          expressionEntitlement: values.expressionEntitlement || [defaultExpression],
          groupListIsChecked: values.groupListIsChecked || false,
          userGroupList: values.userGroupList || null,
          importNewUserGroup: values.importNewUserGroup || null,
          excludeUsersIsChecked: values.excludeUsersIsChecked || false,
          excludeUsers: values.excludeUsers || null,
          selectData: values.selectData || "",
        },
      }));
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return (
          !!(
            formData.step1.certificationTemplate &&
            formData.step1.workflowType &&
            (formData.step1.workflowType !== "Assurance Event" || formData.step1.eventType) &&
            formData.step1.description &&
            formData.step1.owner
          )
        );
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const renderBasicInfo = (sideBySide: boolean) => (
    <div className={sideBySide ? "w-full" : "w-full max-w-3xl mx-auto"}>
          <div className={sideBySide ? "grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2" : "space-y-5"}>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <ReviewSectionHeader icon={Layers} title="General Details" />
              <p className="mb-4 text-xs text-gray-500">
                Name this workflow and describe the process it automates.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Standard Access Request"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  {...register("certificationTemplate", { required: true })}
                />
                {errors.certificationTemplate?.message &&
                  typeof errors.certificationTemplate.message === "string" && (
                    <p className="mt-1 text-red-500 text-xs">
                      {errors.certificationTemplate.message}
                    </p>
                  )}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Explain when this workflow runs and what it's for"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  rows={3}
                  {...register("description", { required: true })}
                />
                {errors.description?.message &&
                  typeof errors.description.message === "string" && (
                    <p className="mt-1 text-red-500 text-xs">
                      {errors.description.message}
                    </p>
                  )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <ReviewSectionHeader icon={ShieldCheck} title="Ownership & Classification" />
              <p className="mb-4 text-xs text-gray-500">
                Assign who's accountable for this workflow, tag it for discovery, and classify what kind of process it is.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Owners <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. jane.doe@company.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register("owner", { required: true })}
                  />
                  {errors.owner?.message &&
                    typeof errors.owner.message === "string" && (
                      <p className="mt-1 text-red-500 text-xs">
                        {errors.owner.message}
                      </p>
                    )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. finance, sox"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register("tags")}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Workflow Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    {...register("workflowType", { required: true })}
                  >
                    <option value="">Select workflow type</option>
                    <option value="Access Request">Access Request</option>
                    <option value="Access Review">Access Review</option>
                    <option value="Assurance Event">Assurance Event</option>
                  </select>
                  {errors.workflowType?.message &&
                    typeof errors.workflowType.message === "string" && (
                      <p className="mt-1 text-red-500 text-xs">
                        {errors.workflowType.message}
                      </p>
                    )}
                </div>

                {workflowType === "Assurance Event" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Event Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      {...register("eventType", { required: workflowType === "Assurance Event" })}
                    >
                      <option value="">Select event type</option>
                      {INITIAL_EVENT_DEFINITIONS.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.id} - {event.name}
                        </option>
                      ))}
                    </select>
                    {errors.eventType?.message &&
                      typeof errors.eventType.message === "string" && (
                        <p className="mt-1 text-red-500 text-xs">
                          {errors.eventType.message}
                        </p>
                      )}
                  </div>
                )}
              </div>
            </div>
          </div>
    </div>
  );

  const policyBuilderSection = (
    <PolicyBuilder formData={formData} setFormData={setFormData} hideStepPalette />
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderBasicInfo(false);
      case 2:
        return policyBuilderSection;
      case 3:
        return <WorkflowReviewSubmit formData={formData} />;
      default:
        return null;
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSubmit = () => {
    console.log("Form submitted:", formData);
    alert(editPolicyId ? "Workflow updated successfully!" : "Workflow created successfully!");
  };

  if (isViewMode && isEditFromView) {
    return (
      <div className="relative min-h-screen bg-gradient-to-b from-slate-50 to-gray-100">
        <div className="w-full">
          <div className="space-y-4 px-6 pb-10">
            <div className="rounded-xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Edit Workflow Policy
                  </h1>
                  <p className="mt-1 text-xs text-gray-600">
                    Update the policy from this page without using the step form.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!editPolicyId) return;
                      router.push(
                        `/settings/gateway/workflow-builder/new?id=${encodeURIComponent(editPolicyId)}&view=1`
                      );
                    }}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
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
            </div>

            <div className="space-y-6">
              {renderBasicInfo(true)}
              <div ref={policyBuilderSectionRef}>{policyBuilderSection}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isViewMode && !isEditFromView) {
    return (
      <div className="relative min-h-screen bg-gradient-to-b from-slate-50 to-gray-100">
        <div className="w-full">
          <div className="space-y-4 px-6">
            <div className="rounded-xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900">
                  Review Workflow Policy
                </h1>
                <p className="mt-1 text-xs text-gray-600">
                  Review policy details before making updates.
                </p>
              </div>
            </div>

            <WorkflowReviewSubmit
              formData={formData}
              fullWidth
              onEditSection={(step) => {
                if (!editPolicyId) return;
                router.push(
                  `/settings/gateway/workflow-builder/new?id=${encodeURIComponent(editPolicyId)}&view=1&edit=1&step=${step}`
                );
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full pt-16">
      {/* Fixed Step Bar */}
      <div
        className="fixed top-16 right-0 z-20 border-b border-gray-200 bg-white px-4 py-3 shadow-sm"
        style={{ left: isSidebarVisible ? sidebarWidthPx : 0 }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-6">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className={`flex items-center rounded-md px-4 py-2 text-sm font-medium ${
              currentStep === 1
                ? "cursor-not-allowed bg-gray-100 text-gray-400"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </button>

          <div className="flex flex-1 items-center justify-center">
            <div className="flex w-full max-w-xl items-center justify-center gap-2">
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                        currentStep > step.id
                          ? "bg-[#1759e4] text-white"
                          : currentStep === step.id
                            ? "border-2 border-[#1759e4] bg-white text-[#1759e4]"
                            : "border-2 border-blue-300 bg-white text-blue-500"
                      }`}
                    >
                      {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                    </div>
                    <div className="ml-2">
                      <p className="text-xs font-medium text-gray-900">{step.title}</p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`mx-2 h-0.5 flex-1 ${
                        currentStep > step.id ? "bg-[#1759e4]" : "bg-gray-200"
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {currentStep < steps.length ? (
            <button
              onClick={handleNext}
              disabled={!isStepValid(currentStep)}
              className={`flex items-center rounded-md px-4 py-2 text-sm font-medium ${
                !isStepValid(currentStep)
                  ? "cursor-not-allowed bg-gray-100 text-gray-400"
                  : "bg-[#1759e4] text-white hover:brightness-95"
              }`}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex items-center rounded-md bg-[#1759e4] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
            >
              Submit
            </button>
          )}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 2 || currentStep === 3 ? (
        // Steps 2 & 3: use full available width
        <div className="px-4 pt-4 pb-10">
          {renderStepContent()}
        </div>
      ) : (
        // Step 1: centered form layout
        <div className="max-w-6xl mx-auto px-6 pb-10">
          <div className="w-full mb-6 min-h-[400px]">
            <div className="flex justify-center">{renderStepContent()}</div>
          </div>
        </div>
      )}
    </div>
  );
}

