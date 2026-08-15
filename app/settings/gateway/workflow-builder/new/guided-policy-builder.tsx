"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  GitBranch,
  GripVertical,
  Minus,
  Plus,
  X,
  Zap,
} from "lucide-react";
import ToggleSwitch from "@/components/ToggleSwitch";
import { executeQuery } from "@/lib/api";
import { STEP_PALETTE, type StepPaletteEntry } from "./step-palette";

type StepTemplate = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  kind: "SYSTEM" | "HUMAN" | "AI";
  type: "LOGIC" | "APPROVAL" | "FULFILLMENT" | "AI AGENT" | "CUSTOM";
  /** Match existing step.code values (uppercase) */
  matchCodes: string[];
  /** When code is missing or unknown (e.g. API hydration), match normalized step.label */
  matchLabels?: string[];
};

const VALIDATE_TEMPLATES: StepTemplate[] = [
  {
    id: "sso-check",
    label: "SSO",
    shortLabel: "SSO",
    description: "Verify SSO session and identity provider state.",
    kind: "SYSTEM",
    type: "LOGIC",
    matchCodes: ["SSO_CHECK", "SSO_SESSION_CHECK", "SSO_VALIDATION"],
  },
  {
    id: "user-enabled-check",
    label: "User enabled check",
    shortLabel: "USER ENABLED",
    description: "Verify account is enabled before proceeding.",
    kind: "SYSTEM",
    type: "LOGIC",
    matchCodes: ["USER_ENABLED_CHECK"],
  },
  {
    id: "training-check",
    label: "Training Check",
    shortLabel: "TRAINING CHECK",
    description: "Ensure required training is complete before proceed.",
    kind: "SYSTEM",
    type: "LOGIC",
    matchCodes: ["TRAINING_CHECK"],
  },
  {
    id: "sod-analysis",
    label: "SoD Analysis",
    shortLabel: "SOD",
    description: "Segregation of duties analysis for the request.",
    kind: "SYSTEM",
    type: "LOGIC",
    matchCodes: ["SOD_ANALYSIS", "SOD"],
  },
  {
    id: "ai-auto-approve",
    label: "AI Analysis",
    shortLabel: "AI ANALYSIS",
    description: "AI-assisted risk and context analysis.",
    kind: "AI",
    type: "AI AGENT",
    matchCodes: ["AI_AUTO_APPROVE_ANALYSIS", "AI_AUTO_APPROVE", "AI_ANALYSIS"],
  },
  {
    id: "ai-recommender",
    label: "AI Recommender",
    shortLabel: "AI RECOMMENDER",
    description: "AI recommendation for approvers and risk context.",
    kind: "AI",
    type: "AI AGENT",
    matchCodes: ["AI_RECOMMENDER"],
  },
];

const APPROVAL_TEMPLATES: StepTemplate[] = [
  {
    id: "manager-approval",
    label: "Manager Approval",
    shortLabel: "MANAGER",
    description: "Line manager sign-off.",
    kind: "HUMAN",
    type: "APPROVAL",
    matchCodes: ["MANAGER_APPROVAL"],
  },
  {
    id: "dept-head-approval",
    label: "Dept Head Approval",
    shortLabel: "DEPT HEAD",
    description: "Department head sign-off.",
    kind: "HUMAN",
    type: "APPROVAL",
    matchCodes: ["DEPT_HEAD_APPROVAL", "DEPARTMENT_HEAD_APPROVAL"],
  },
  {
    id: "app-owner-approval",
    label: "App Owner Approval",
    shortLabel: "APP OWNER",
    description: "Application owner approval.",
    kind: "HUMAN",
    type: "APPROVAL",
    matchCodes: ["APP_OWNER_APPROVAL"],
  },
  {
    id: "role-owner-approval",
    label: "Role Owner Approval",
    shortLabel: "ROLE OWNER",
    description: "Role or role-collection owner approval.",
    kind: "HUMAN",
    type: "APPROVAL",
    matchCodes: ["ROLE_OWNER_APPROVAL"],
  },
  {
    id: "security-approval",
    label: "Security Approval",
    shortLabel: "SECURITY",
    description: "Security team review.",
    kind: "HUMAN",
    type: "APPROVAL",
    matchCodes: ["SECURITY_APPROVAL", "SECURITY"],
    matchLabels: ["Security", "Security Approval", "Security Review"],
  },
  {
    id: "comp-controls-approval",
    label: "Comp Controls",
    shortLabel: "COMP CONTROLS",
    description: "Compliance controls approval.",
    kind: "HUMAN",
    type: "APPROVAL",
    matchCodes: ["COMP_CONTROLS_APPROVAL", "COMP_CONTROLS", "COMPLIANCE_CONTROLS"],
    matchLabels: [
      "Comp Controls",
      "Comp Control",
      "Compliance Controls",
      "Compliance Control",
      "Compliance",
    ],
  },
];

const FULFILLMENT_CORE: StepTemplate[] = [
  {
    id: "set-expiry",
    label: "Set Expiry",
    shortLabel: "SET EXPIRY",
    description: "Set timebound expiry for auto-revoke.",
    kind: "SYSTEM",
    type: "CUSTOM",
    matchCodes: ["SET_EXPIRY"],
  },
  {
    id: "fulfillment-worker",
    label: "Fulfillment",
    shortLabel: "FULFILL",
    description: "Publish connector operation to fulfillment worker.",
    kind: "SYSTEM",
    type: "FULFILLMENT",
    matchCodes: ["FULFILLMENT", "CONNECTOR_FULFILL", "GENERIC_FULFILLMENT", "FULFILL"],
  },
];

const FULFILLMENT_EXTRA: StepTemplate[] = [
  {
    id: "scim-fulfillment",
    label: "SCIM Fulfillment",
    shortLabel: "SCIM FULFILLMENT",
    description: "Publishes SCIM add/remove/modify operation to your fulfillment worker.",
    kind: "SYSTEM",
    type: "FULFILLMENT",
    matchCodes: ["SCIM_FULFILLMENT", "SCIM_FULFILL", "FULFILL_SCIM"],
  },
  {
    id: "itsm-ticket",
    label: "ITSM Create Ticket",
    shortLabel: "ITSM TICKET",
    description: "Create an ITSM ticket (ServiceNow/Jira/etc.) for fulfillment.",
    kind: "SYSTEM",
    type: "FULFILLMENT",
    matchCodes: ["ITSM_TICKET", "ITSM", "ITSM_CREATE_TICKET"],
  },
  {
    id: "jit-grant",
    label: "JIT Grant",
    shortLabel: "JIT GRANT",
    description: "Creates JIT session record and (optionally) publishes to worker.",
    kind: "SYSTEM",
    type: "FULFILLMENT",
    matchCodes: ["JIT_GRANT"],
  },
  {
    id: "notification",
    label: "Notification",
    shortLabel: "NOTIFICATION",
    description: "Notify requester/approver/ops via email/teams/slack/webhook.",
    kind: "SYSTEM",
    type: "CUSTOM",
    matchCodes: ["NOTIFICATION", "NOTIFY"],
  },
  {
    id: "audit-log",
    label: "Audit Log",
    shortLabel: "AUDIT LOG",
    description: "Write a structured audit record to wf_event_log and/or external audit sink.",
    kind: "SYSTEM",
    type: "CUSTOM",
    matchCodes: ["AUDIT_LOG", "AUDIT", "AUDIT_EVENT"],
  },
];

/** Added via “Add step” (no toggle row) */
const GUIDED_CUSTOM_VALIDATE: StepTemplate = {
  id: "guided-custom-logic",
  label: "Custom step",
  shortLabel: "CUSTOM",
  description: "Custom logic or integration — refine in Advanced mode.",
  kind: "SYSTEM",
  type: "CUSTOM",
  matchCodes: ["GUIDED_CUSTOM_LOGIC"],
  matchLabels: ["Custom Step", "Custom Logic"],
};

const GUIDED_CUSTOM_APPROVAL: StepTemplate = {
  id: "guided-custom-approval",
  label: "Custom approval",
  shortLabel: "CUSTOM APP",
  description: "Custom human approval — refine approvers in Advanced mode.",
  kind: "HUMAN",
  type: "APPROVAL",
  matchCodes: ["GUIDED_CUSTOM_APPROVAL"],
  matchLabels: ["Custom Approval"],
};

const GUIDED_CUSTOM_FULFILLMENT: StepTemplate = {
  id: "guided-custom-fulfillment",
  label: "Custom fulfillment",
  shortLabel: "CUSTOM FULFILL",
  description: "Custom fulfillment action — refine in Advanced mode.",
  kind: "SYSTEM",
  type: "FULFILLMENT",
  matchCodes: ["GUIDED_CUSTOM_FULFILLMENT"],
  matchLabels: ["Custom Fulfillment"],
};

/** Resolve Guided templates by palette id so Add step matches STEP_PALETTE + matchCodes. */
const PALETTE_ID_TO_TEMPLATE = new Map<string, StepTemplate>(
  [...VALIDATE_TEMPLATES, ...APPROVAL_TEMPLATES, ...FULFILLMENT_CORE, ...FULFILLMENT_EXTRA].map(
    (t) => [t.id, t]
  )
);

function stepTemplatesFromPaletteEntries(entries: readonly StepPaletteEntry[]): StepTemplate[] {
  return entries.map((p) => {
    const found = PALETTE_ID_TO_TEMPLATE.get(p.id);
    if (found) return found;
    const code = p.id.toUpperCase().replace(/-/g, "_");
    return {
      id: p.id,
      label: p.label,
      shortLabel: code,
      description: p.label,
      kind: p.kind,
      type: p.type,
      matchCodes: [code],
    };
  });
}

/** Normalize a kf_wf_f_get_step_types() row's default_stage_bucket to a Guided section. */
function normalizeStageBucket(raw: unknown): GuidedSection | null {
  const b = String(raw ?? "").toUpperCase().trim();
  if (!b) return null;
  if (b.includes("VALID")) return "validate";
  if (b.includes("APPROV")) return "approval";
  if (b.includes("FULFIL") || b.includes("FULFUL")) return "fulfillment";
  return null;
}

function normalizeStepKind(raw: unknown): StepTemplate["kind"] {
  const k = String(raw ?? "").toUpperCase().trim();
  if (k === "HUMAN") return "HUMAN";
  if (k === "AI") return "AI";
  return "SYSTEM";
}

function normalizeStepType(raw: unknown): StepTemplate["type"] {
  const t = String(raw ?? "").toUpperCase().trim();
  if (t === "APPROVAL") return "APPROVAL";
  if (t === "FULFILLMENT") return "FULFILLMENT";
  if (t === "AI AGENT" || t === "AI_AGENT") return "AI AGENT";
  if (t === "LOGIC") return "LOGIC";
  return "CUSTOM";
}

/** Maps a raw row from `SELECT * FROM kf_wf_f_get_step_types()` to a Guided step template + bucket. */
function mapApiStepTypeRow(row: any): { bucket: GuidedSection; template: StepTemplate } | null {
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

  const bucket = normalizeStageBucket(
    row.default_stage_bucket ??
      row.DEFAULT_STAGE_BUCKET ??
      row.stage_bucket ??
      row.STAGE_BUCKET ??
      row.bucket ??
      row.BUCKET
  );
  if (!bucket) return null;

  const code = normalizeStepCode(String(rawCode ?? label));
  const description = String(
    row.description ??
      row.DESCRIPTION ??
      row.step_description ??
      row.STEP_DESCRIPTION ??
      label
  ).trim();

  return {
    bucket,
    template: {
      id: code.toLowerCase().replace(/_/g, "-"),
      label: label || code,
      shortLabel: (label || code).toUpperCase(),
      description,
      kind: normalizeStepKind(row.step_kind ?? row.STEP_KIND ?? row.kind ?? row.KIND),
      type: normalizeStepType(row.step_type ?? row.STEP_TYPE ?? row.type ?? row.TYPE),
      matchCodes: [code],
    },
  };
}

const VALIDATE_ADD_MENU: StepTemplate[] = [
  ...stepTemplatesFromPaletteEntries(STEP_PALETTE.LOGIC),
  ...stepTemplatesFromPaletteEntries(STEP_PALETTE.AI_AGENTS),
  GUIDED_CUSTOM_VALIDATE,
];
const APPROVAL_ADD_MENU: StepTemplate[] = [
  ...stepTemplatesFromPaletteEntries(STEP_PALETTE.APPROVALS),
  GUIDED_CUSTOM_APPROVAL,
];
const FULFILLMENT_ADD_MENU: StepTemplate[] = [
  ...stepTemplatesFromPaletteEntries(STEP_PALETTE.FULFILLMENT),
  GUIDED_CUSTOM_FULFILLMENT,
];

/**
 * Normalize raw step codes from the palette, Advanced builder, or API/hydration
 * so Guided toggles stay in sync (e.g. APPROVAL_MANAGER → MANAGER_APPROVAL).
 */
function normalizeStepCode(raw: string | undefined | null): string {
  const c = String(raw || "")
    .toUpperCase()
    .replace(/-/g, "_")
    .trim();
  if (!c) return "";

  const ALIASES: Record<string, string> = {
    // API / definition_json style (APPROVAL_*)
    APPROVAL_MANAGER: "MANAGER_APPROVAL",
    APPROVAL_LINE_MANAGER: "MANAGER_APPROVAL",
    LINE_MANAGER_APPROVAL: "MANAGER_APPROVAL",
    APPROVAL_APP_OWNER: "APP_OWNER_APPROVAL",
    APPROVAL_APPLICATION_OWNER: "APP_OWNER_APPROVAL",
    APPLICATION_OWNER_APPROVAL: "APP_OWNER_APPROVAL",
    APPROVAL_DEPT_HEAD: "DEPT_HEAD_APPROVAL",
    APPROVAL_DEPARTMENT_HEAD: "DEPT_HEAD_APPROVAL",
    APPROVAL_ROLE_OWNER: "ROLE_OWNER_APPROVAL",
    APPROVAL_SECURITY: "SECURITY_APPROVAL",
    APPROVAL_COMP_CONTROLS: "COMP_CONTROLS_APPROVAL",
    APPROVAL_COMPLIANCE: "COMP_CONTROLS_APPROVAL",
    // Fulfillment variants
    SCIM_OPERATION: "SCIM_FULFILLMENT",
    FULFILLMENT_SCIM: "SCIM_FULFILLMENT",
    // Generic fulfillment worker step names from APIs
    FULFILL_CONNECTOR: "FULFILLMENT",
    CONNECTOR_OPERATION: "FULFILLMENT",
    // AI
    AI_AUTO_APPROVE: "AI_AUTO_APPROVE_ANALYSIS",
    // Logic / validate
    USER_ENABLED: "USER_ENABLED_CHECK",
    ENABLED_CHECK: "USER_ENABLED_CHECK",
    SOD_CHECK: "SOD_ANALYSIS",
  };

  return ALIASES[c] || c;
}

/** Lowercase alphanumerics only — for stable label comparison */
function normalizeMatchLabel(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function stepLabelKeys(step: any): string[] {
  const raw = String(step.label || "").trim();
  if (!raw) return [];
  const keys = new Set<string>();
  keys.add(normalizeMatchLabel(raw));
  const upper = raw.toUpperCase().replace(/\s+/g, " ").trim();
  if (upper && upper !== raw) keys.add(normalizeMatchLabel(upper));
  return [...keys].filter((k) => k.length >= 2);
}

function templateLabelKeys(t: StepTemplate): string[] {
  const keys = new Set<string>();
  const add = (s: string) => {
    const k = normalizeMatchLabel(s);
    if (k.length >= 2) keys.add(k);
  };
  add(t.label);
  add(t.shortLabel);
  (t.matchLabels || []).forEach(add);
  return [...keys];
}

function stepMatchesTemplate(step: any, t: StepTemplate): boolean {
  const code = normalizeStepCode(step.code);
  if (code) {
    if (t.matchCodes.some((m) => code === normalizeStepCode(m))) return true;
  }
  const stepKeys = stepLabelKeys(step);
  if (stepKeys.length === 0) return false;
  const tmplKeys = templateLabelKeys(t);
  return tmplKeys.some((tk) => stepKeys.some((sk) => sk === tk));
}

function findTemplateForStep(step: any, list: StepTemplate[]): StepTemplate | undefined {
  const code = normalizeStepCode(step.code);
  if (code) {
    const byCode = list.find((t) => t.matchCodes.some((m) => code === normalizeStepCode(m)));
    if (byCode) return byCode;
  }
  return list.find((t) => {
    const stepKeys = stepLabelKeys(step);
    if (stepKeys.length === 0) return false;
    const tmplKeys = templateLabelKeys(t);
    return tmplKeys.some((tk) => stepKeys.some((sk) => sk === tk));
  });
}

function templateToStep(template: StepTemplate) {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    label: template.label,
    code: template.id.toUpperCase().replace(/-/g, "_"),
    kind: template.kind,
    type: template.type,
    condition: "true",
  };
}

/** Task label for custom lookup approvals (Advanced + API hydration). */
function stepTaskName(step: any): string {
  return String(step?.taskName ?? step?.config?.taskName ?? "").trim();
}

const ALL_FLOW_TEMPLATES: StepTemplate[] = [
  ...VALIDATE_TEMPLATES,
  ...APPROVAL_TEMPLATES,
  ...FULFILLMENT_CORE,
  ...FULFILLMENT_EXTRA,
  GUIDED_CUSTOM_VALIDATE,
  GUIDED_CUSTOM_APPROVAL,
  GUIDED_CUSTOM_FULFILLMENT,
];

function SortableFlowStepRow({
  id,
  step,
  index,
  total,
  templateList,
  onMoveUp,
  onMoveDown,
}: {
  id: string;
  step: any;
  index: number;
  total: number;
  templateList: StepTemplate[];
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : undefined,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
  };

  const title = (findTemplateForStep(step, templateList)?.shortLabel || step.label).toUpperCase();
  const kind = step.kind || "SYSTEM";
  const taskNameLine = stepTaskName(step);

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-white px-2.5 py-2 shadow-sm">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1759e4] text-[11px] font-semibold leading-none text-white">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="truncate text-xs font-semibold leading-tight text-gray-900">{title}</p>
          {taskNameLine && (
            <p className="mt-0.5 truncate text-[10px] leading-snug text-gray-500">{taskNameLine}</p>
          )}
          <div className="mt-1 flex items-center gap-1 text-[9px] leading-none text-gray-500">
            <Clock className="h-2.5 w-2.5 shrink-0" />
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium leading-tight text-slate-600">{kind}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-l border-gray-100 pl-2">
          <button
            type="button"
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Move up"
            disabled={index === 0}
            onClick={onMoveUp}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Move down"
            disabled={index >= total - 1}
            onClick={onMoveDown}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <span
            className="inline-flex cursor-grab touch-none rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5 pointer-events-none" />
          </span>
        </div>
      </div>
      {index < total - 1 && (
        <div className="flex justify-center py-1">
          <ArrowDown className="h-3.5 w-3.5 text-gray-400" />
        </div>
      )}
    </div>
  );
}

function SortableSequentialFlow({
  steps,
  templateList,
  onReorderById,
  onMoveStep,
}: {
  steps: any[];
  templateList: StepTemplate[];
  onReorderById: (activeId: string, overId: string) => void;
  onMoveStep: (index: number, delta: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorderById(String(active.id), String(over.id));
  };
  const itemIds = steps.map((s) => s.id);
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div>
          {steps.map((st, i) => (
            <SortableFlowStepRow
              key={st.id}
              id={st.id}
              step={st}
              index={i}
              total={steps.length}
              templateList={templateList}
              onMoveUp={() => onMoveStep(i, -1)}
              onMoveDown={() => onMoveStep(i, 1)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export interface GuidedPolicyBuilderProps {
  formData: any;
  setFormData: any;
}

type GuidedSection = "validate" | "approval" | "fulfillment";

export const GuidedPolicyBuilder: React.FC<GuidedPolicyBuilderProps> = ({
  formData,
  setFormData,
}) => {
  const stages = formData.step2.stages || [];

  const validateStage = stages[0] ?? null;
  const fulfillmentStage = stages.length >= 2 ? stages[stages.length - 1] : null;
  const approvalStages = useMemo(() => {
    if (stages.length < 3) return [];
    return stages.slice(1, -1);
  }, [stages]);

  const [expanded, setExpanded] = useState<GuidedSection | null>(null);
  const [showFlow, setShowFlow] = useState(true);
  const [addMenuSection, setAddMenuSection] = useState<GuidedSection | null>(null);

  useEffect(() => {
    if (!addMenuSection) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-add-step-menu]")) {
        setAddMenuSection(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [addMenuSection]);

  const [apiStepTypesByBucket, setApiStepTypesByBucket] = useState<
    Record<GuidedSection, StepTemplate[]>
  >({ validate: [], approval: [], fulfillment: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await executeQuery<any>(
          "SELECT * FROM kf_wf_f_get_step_types()",
          []
        );
        const rows: any[] = Array.isArray(response)
          ? response
          : Array.isArray(response?.resultSet)
            ? response.resultSet
            : Array.isArray(response?.rows)
              ? response.rows
              : [];

        const grouped: Record<GuidedSection, StepTemplate[]> = {
          validate: [],
          approval: [],
          fulfillment: [],
        };
        const seen = new Set<string>();
        rows.forEach((row) => {
          const mapped = mapApiStepTypeRow(row);
          if (!mapped) return;
          const key = `${mapped.bucket}:${mapped.template.id}`;
          if (seen.has(key)) return;
          seen.add(key);
          grouped[mapped.bucket].push(mapped.template);
        });

        if (!cancelled) setApiStepTypesByBucket(grouped);
      } catch (e) {
        console.error("Failed to load step types from kf_wf_f_get_step_types():", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const validateAddMenu = useMemo(
    () =>
      apiStepTypesByBucket.validate.length > 0
        ? [...apiStepTypesByBucket.validate, GUIDED_CUSTOM_VALIDATE]
        : VALIDATE_ADD_MENU,
    [apiStepTypesByBucket]
  );
  const approvalAddMenu = useMemo(
    () =>
      apiStepTypesByBucket.approval.length > 0
        ? [...apiStepTypesByBucket.approval, GUIDED_CUSTOM_APPROVAL]
        : APPROVAL_ADD_MENU,
    [apiStepTypesByBucket]
  );
  const fulfillmentAddMenu = useMemo(
    () =>
      apiStepTypesByBucket.fulfillment.length > 0
        ? [...apiStepTypesByBucket.fulfillment, GUIDED_CUSTOM_FULFILLMENT]
        : FULFILLMENT_ADD_MENU,
    [apiStepTypesByBucket]
  );

  const approvalStepsFlat = useMemo(() => {
    return approvalStages.flatMap((s: any) =>
      (s.steps || []).map((step: any) => ({ step, stageId: s.id }))
    );
  }, [approvalStages]);

  const setStageParallel = useCallback(
    (stageId: string, parallel: boolean) => {
      setFormData((prev: any) => ({
        ...prev,
        step2: {
          ...prev.step2,
          stages: prev.step2.stages.map((s: any) =>
            s.id === stageId ? { ...s, parallelExecution: parallel } : s
          ),
        },
      }));
    },
    [setFormData]
  );

  const addStep = useCallback(
    (stageId: string, template: StepTemplate) => {
      const newStep = templateToStep(template);
      setFormData((prev: any) => ({
        ...prev,
        step2: {
          ...prev.step2,
          stages: prev.step2.stages.map((s: any) =>
            s.id === stageId ? { ...s, steps: [...s.steps, newStep] } : s
          ),
        },
      }));
    },
    [setFormData]
  );

  const removeStep = useCallback(
    (stageId: string, stepId: string) => {
      setFormData((prev: any) => ({
        ...prev,
        step2: {
          ...prev.step2,
          stages: prev.step2.stages.map((s: any) =>
            s.id === stageId ? { ...s, steps: s.steps.filter((x: any) => x.id !== stepId) } : s
          ),
        },
      }));
    },
    [setFormData]
  );

  const ensureApprovalPipeline = useCallback(() => {
    setFormData((prev: any) => {
      const st = prev.step2.stages || [];
      if (st.length >= 3) return prev;
      if (st.length < 2) return prev;
      const approvalStage = {
        id: `stage-approval-${Date.now()}`,
        name: "Approval",
        order: 2,
        steps: [] as any[],
        parallelExecution: false,
      };
      const renumbered = [
        { ...st[0], order: 1 },
        approvalStage,
        { ...st[st.length - 1], order: 3 },
      ];
      return {
        ...prev,
        step2: { ...prev.step2, stages: renumbered },
      };
    });
  }, [setFormData]);

  const toggleTemplate = useCallback(
    (stageId: string | null, template: StepTemplate, on: boolean) => {
      if (!stageId) return;
      setFormData((prev: any) => {
        const stage = prev.step2.stages.find((s: any) => s.id === stageId);
        if (!stage) return prev;
        const existing = (stage.steps || []).find((st: any) => stepMatchesTemplate(st, template));
        if (on && !existing) {
          const newStep = templateToStep(template);
          return {
            ...prev,
            step2: {
              ...prev.step2,
              stages: prev.step2.stages.map((s: any) =>
                s.id === stageId ? { ...s, steps: [...(s.steps || []), newStep] } : s
              ),
            },
          };
        }
        if (!on && existing) {
          return {
            ...prev,
            step2: {
              ...prev.step2,
              stages: prev.step2.stages.map((s: any) =>
                s.id === stageId
                  ? { ...s, steps: (s.steps || []).filter((x: any) => x.id !== existing.id) }
                  : s
              ),
            },
          };
        }
        return prev;
      });
    },
    [setFormData]
  );

  const toggleApprovalTemplate = useCallback(
    (template: StepTemplate, on: boolean) => {
      setFormData((prev: any) => {
        let st = [...(prev.step2.stages || [])];
        if (st.length === 2) {
          const approvalStage = {
            id: `stage-approval-${Date.now()}`,
            name: "Approval",
            order: 2,
            steps: [] as any[],
            parallelExecution: false,
          };
          st = [
            { ...st[0], order: 1 },
            approvalStage,
            { ...st[st.length - 1], order: 3 },
          ];
        }
        if (st.length < 3) return { ...prev, step2: { ...prev.step2, stages: st } };

        const slice = st.slice(1, -1);
        const targetId = slice[slice.length - 1]?.id;
        if (!targetId) return { ...prev, step2: { ...prev.step2, stages: st } };

        const existingFlat = st
          .slice(1, -1)
          .flatMap((s: any) => s.steps || [])
          .find((x: any) => stepMatchesTemplate(x, template));

        if (on && !existingFlat) {
          const newStep = templateToStep(template);
          return {
            ...prev,
            step2: {
              ...prev.step2,
              stages: st.map((s: any) =>
                s.id === targetId ? { ...s, steps: [...(s.steps || []), newStep] } : s
              ),
            },
          };
        }
        if (!on && existingFlat) {
          const holder = st.find((s: any) => s.steps?.some((x: any) => x.id === existingFlat.id));
          if (!holder) return { ...prev, step2: { ...prev.step2, stages: st } };
          return {
            ...prev,
            step2: {
              ...prev.step2,
              stages: st.map((s: any) =>
                s.id === holder.id
                  ? { ...s, steps: s.steps.filter((x: any) => x.id !== existingFlat.id) }
                  : s
              ),
            },
          };
        }
        return { ...prev, step2: { ...prev.step2, stages: st } };
      });
    },
    [setFormData]
  );

  const approvalHasTemplate = useCallback(
    (template: StepTemplate) =>
      approvalStepsFlat.some(({ step }: { step: any }) => stepMatchesTemplate(step, template)),
    [approvalStepsFlat]
  );

  const mergeApprovalOrder = useCallback(
    (orderedSteps: any[]) => {
      setFormData((prev: any) => {
        const st = prev.step2.stages || [];
        if (st.length < 3) return prev;
        const firstApprovalIdx = 1;
        const lastApprovalIdx = st.length - 2;
        return {
          ...prev,
          step2: {
            ...prev.step2,
            stages: st.map((s: any, i: number) => {
              if (i === firstApprovalIdx) return { ...s, steps: orderedSteps };
              if (i > firstApprovalIdx && i <= lastApprovalIdx) return { ...s, steps: [] };
              return s;
            }),
          },
        };
      });
    },
    [setFormData]
  );

  const reorderStepsInStageByIds = useCallback(
    (stageId: string, activeId: string, overId: string) => {
      setFormData((prev: any) => {
        const st = prev.step2.stages || [];
        const stage = st.find((s: any) => s.id === stageId);
        if (!stage?.steps?.length) return prev;
        const stepArr = [...stage.steps];
        const oldIndex = stepArr.findIndex((x: any) => x.id === activeId);
        const newIndex = stepArr.findIndex((x: any) => x.id === overId);
        if (oldIndex < 0 || newIndex < 0) return prev;
        return {
          ...prev,
          step2: {
            ...prev.step2,
            stages: st.map((s: any) =>
              s.id === stageId ? { ...s, steps: arrayMove(stepArr, oldIndex, newIndex) } : s
            ),
          },
        };
      });
    },
    [setFormData]
  );

  const reorderApprovalByIds = useCallback(
    (activeId: string, overId: string) => {
      setFormData((prev: any) => {
        const st = prev.step2.stages || [];
        if (st.length < 3) return prev;
        const flat = st.slice(1, -1).flatMap((s: any) => s.steps || []);
        const oldIndex = flat.findIndex((x: any) => x.id === activeId);
        const newIndex = flat.findIndex((x: any) => x.id === overId);
        if (oldIndex < 0 || newIndex < 0) return prev;
        const reordered = arrayMove(flat, oldIndex, newIndex);
        const firstApprovalIdx = 1;
        const lastApprovalIdx = st.length - 2;
        return {
          ...prev,
          step2: {
            ...prev.step2,
            stages: st.map((s: any, i: number) => {
              if (i === firstApprovalIdx) return { ...s, steps: reordered };
              if (i > firstApprovalIdx && i <= lastApprovalIdx) return { ...s, steps: [] };
              return s;
            }),
          },
        };
      });
    },
    [setFormData]
  );

  const moveStepInStage = useCallback(
    (stageId: string, index: number, delta: number) => {
      setFormData((prev: any) => ({
        ...prev,
        step2: {
          ...prev.step2,
          stages: prev.step2.stages.map((s: any) => {
            if (s.id !== stageId) return s;
            const next = [...s.steps];
            const j = index + delta;
            if (j < 0 || j >= next.length) return s;
            [next[index], next[j]] = [next[j], next[index]];
            return { ...s, steps: next };
          }),
        },
      }));
    },
    [setFormData]
  );

  const moveApprovalFlat = useCallback(
    (from: number, delta: number) => {
      const arr = approvalStepsFlat.map((x: { step: any }) => x.step);
      const j = from + delta;
      if (j < 0 || j >= arr.length) return;
      const next = [...arr];
      [next[from], next[j]] = [next[j], next[from]];
      mergeApprovalOrder(next);
    },
    [approvalStepsFlat, mergeApprovalOrder]
  );

  const firstApprovalStage = approvalStages[0];
  const parallelApproval = !!firstApprovalStage?.parallelExecution;
  const parallelFulfillment = !!fulfillmentStage?.parallelExecution;
  const parallelValidate = !!validateStage?.parallelExecution;

  const renderAddStepMenu = (
    section: GuidedSection,
    menuItems: StepTemplate[],
    currentSteps: any[],
    onPick: (t: StepTemplate) => void
  ) => {
    const tone =
      section === "approval"
        ? "border-blue-200 bg-white text-blue-900 hover:bg-[#E5EEFC]"
        : section === "fulfillment"
          ? "border-green-200 bg-white text-green-900 hover:bg-green-50"
          : "border-blue-200 bg-white text-[#1759e4] hover:bg-[#E5EEFC]";
    return (
      <div data-add-step-menu className="relative mt-3">
        <button
          type="button"
          onClick={() => setAddMenuSection((c) => (c === section ? null : section))}
          className={`inline-flex w-auto items-center justify-start gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-left text-xs font-medium ${tone}`}
        >
          <Plus className="h-3.5 w-3.5" />
          Add step
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${addMenuSection === section ? "rotate-180" : ""}`}
          />
        </button>
        {addMenuSection === section && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white py-0.5 shadow-lg">
            {menuItems.map((t) => (
              <button
                key={t.id}
                type="button"
                className="w-full px-2.5 py-1.5 text-left hover:bg-gray-50"
                onClick={() => {
                  if (!currentSteps.some((st: any) => stepMatchesTemplate(st, t))) {
                    onPick(t);
                  }
                  setAddMenuSection(null);
                }}
              >
                <div className="text-xs font-semibold text-gray-900">{t.label}</div>
                <div className="text-[10px] text-gray-500">{t.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const parallelFlowKindBadge = (step: any) => {
    const k = step.kind || "SYSTEM";
    if (k === "AI") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#1759e4]">
          <Zap className="h-2.5 w-2.5 shrink-0" aria-hidden />
          AI agent
        </span>
      );
    }
    if (k === "HUMAN") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#F4F5FA] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-800">
          <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden />
          Human
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#E5EEFC] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#1759e4]">
        <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden />
        System
      </span>
    );
  };

  const renderParallelFork = (steps: any[]) => (
    <div>
      <div className="relative ml-0.5 border-l-2 border-blue-200 pl-4">
        <div className="relative -mt-0.5 mb-3 flex min-h-[1.25rem] items-center">
          <span
            className="absolute -left-[calc(1rem+1px)] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#1759e4] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
            aria-hidden
          />
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#1759e4]">
            Fork — all start together
          </span>
        </div>

        <ul className="space-y-3">
          {steps.map((step: any) => {
            const title = (
              findTemplateForStep(step, ALL_FLOW_TEMPLATES)?.shortLabel || step.label
            ).toUpperCase();
            const taskNameLine = stepTaskName(step);
            return (
              <li key={step.id} className="relative">
                <span
                  className="absolute left-0 top-1/2 h-px w-4 -translate-x-full -translate-y-1/2 bg-blue-200"
                  aria-hidden
                />
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {parallelFlowKindBadge(step)}
                    <span className="text-xs font-bold uppercase tracking-tight text-slate-800">{title}</span>
                  </div>
                  {taskNameLine && (
                    <p className="mt-1 text-[10px] leading-snug text-gray-500">{taskNameLine}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="relative mt-4">
          <span
            className="absolute -left-[calc(1rem+1px)] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#16a34a] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
            aria-hidden
          />
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-green-800">
            Join — wait for all to complete
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[10px] leading-relaxed text-slate-600 shadow-sm">
        All steps run simultaneously. The stage completes when every step finishes.
      </p>
    </div>
  );

  const renderSectionBody = (
    section: GuidedSection,
    stage: any | null,
    templates: StepTemplate[],
    addMenuTemplates: StepTemplate[],
    opts: { accent: string; border: string; bg: string; labelClass: string }
  ) => {
    if (!stage) {
      return (
        <p className="text-xs text-gray-500">
          This section needs a workflow stage. Use Advanced to add stages, or continue in Basic setup.
        </p>
      );
    }

    const parallel =
      section === "validate"
        ? parallelValidate
        : section === "approval"
          ? parallelApproval
          : parallelFulfillment;

    const setParallel = (v: boolean) => setStageParallel(stage.id, v);

    const steps = stage.steps || [];

    return (
      <div className={`grid gap-3 ${showFlow ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">
              Available steps
            </span>
            <button
              type="button"
              onClick={() => setShowFlow((s) => !s)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[9px] font-medium text-gray-700 hover:bg-gray-50"
            >
              {showFlow ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showFlow ? "Hide flow" : "Show flow"}
            </button>
          </div>
          <div className="space-y-2">
            {steps.length === 0 && (
              <p className="text-xs text-gray-400">No steps yet. Use Add step below.</p>
            )}
            {templates
              .filter((t) => steps.some((st: any) => stepMatchesTemplate(st, t)))
              .map((t) => (
                <div
                  key={t.id}
                  className={`flex items-start justify-between gap-2 rounded-lg border px-2.5 py-2 ${opts.border} ${opts.bg}`}
                >
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-gray-900">{t.label}</span>
                    <p className="mt-0.5 text-[10px] leading-snug text-gray-500">{t.description}</p>
                  </div>
                  <ToggleSwitch
                    checked
                    onChange={(on) => toggleTemplate(stage.id, t, on)}
                  />
                </div>
              ))}
            {section === "validate" &&
              steps
                .filter((st: any) => !VALIDATE_TEMPLATES.some((c) => stepMatchesTemplate(st, c)))
                .map((st: any) => (
                  <div
                    key={st.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-blue-200 bg-[#E5EEFC]/50 px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-900">{st.label}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                          Custom
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove step"
                      onClick={() => removeStep(stage.id, st.id)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
            {section === "fulfillment" &&
              steps
                .filter(
                  (st: any) =>
                    !FULFILLMENT_CORE.some((c) => stepMatchesTemplate(st, c)) &&
                    !FULFILLMENT_EXTRA.some((c) => stepMatchesTemplate(st, c))
                )
                .map((st: any) => (
                  <div
                    key={st.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-green-200 bg-green-50/50 px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-900">{st.label}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                          Custom
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove step"
                      onClick={() => removeStep(stage.id, st.id)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
            {section === "fulfillment" &&
              steps
                .filter((st: any) =>
                  FULFILLMENT_EXTRA.some((c) => stepMatchesTemplate(st, c))
                )
                .map((st: any) => {
                  const tmpl = FULFILLMENT_EXTRA.find((c) => stepMatchesTemplate(st, c));
                  return (
                    <div
                      key={st.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-green-200 bg-green-50/80 px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-900">
                            {tmpl?.label ?? st.label}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                            System
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-gray-500">{tmpl?.description}</p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${tmpl?.label}`}
                        onClick={() => removeStep(stage.id, st.id)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
          </div>

          {addMenuTemplates.length > 0 &&
            renderAddStepMenu(section, addMenuTemplates, steps, (t) => addStep(stage.id, t))}
        </div>

        {showFlow && (
          <div className="min-h-[180px] rounded-xl border border-gray-100 bg-white/60 p-2.5 lg:border-l lg:pl-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                Execution flow
              </span>
              <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 text-[9px] font-semibold">
                <button
                  type="button"
                  onClick={() => setParallel(false)}
                  className={`rounded-md px-2 py-1 ${
                    !parallel ? "bg-[#1759e4] text-white shadow-sm" : "text-gray-500"
                  }`}
                >
                  Sequential
                </button>
                <button
                  type="button"
                  onClick={() => setParallel(true)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${
                    parallel
                      ? "bg-[#1759e4] text-white shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  <GitBranch className="h-3 w-3" />
                  Parallel
                </button>
              </div>
            </div>

            {steps.length === 0 ? (
              <p className="text-xs text-gray-400">Add steps above to see the flow.</p>
            ) : parallel ? (
              renderParallelFork(steps)
            ) : (
              <div>
                <SortableSequentialFlow
                  steps={steps}
                  templateList={ALL_FLOW_TEMPLATES}
                  onReorderById={(activeId, overId) =>
                    reorderStepsInStageByIds(stage.id, activeId, overId)
                  }
                  onMoveStep={(i, delta) => moveStepInStage(stage.id, i, delta)}
                />
                <p className="mt-2 rounded-md bg-gray-50 px-2 py-1 text-[10px] leading-snug text-gray-600">
                  Drag the grip to reorder with the mouse, or use the arrows.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderApprovalBody = () => {
    if (approvalStages.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-blue-200 bg-[#E5EEFC]/30 p-4 text-center">
          <p className="text-xs text-gray-600">No approval stage yet.</p>
          <button
            type="button"
            onClick={ensureApprovalPipeline}
            className="mt-2 rounded-lg bg-[#1759e4] px-3 py-1.5 text-xs font-medium text-white hover:brightness-95"
          >
            Add approval stage
          </button>
        </div>
      );
    }

    const stage = firstApprovalStage;
    const mergedSteps = approvalStepsFlat.map((x: { step: any }) => x.step);
    const displayStageId = stage.id;

    return (
      <div className={`grid gap-3 ${showFlow ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">
              Available steps
            </span>
            <button
              type="button"
              onClick={() => setShowFlow((s) => !s)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[9px] font-medium text-gray-700 hover:bg-gray-50"
            >
              {showFlow ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showFlow ? "Hide flow" : "Show flow"}
            </button>
          </div>
          <div className="space-y-2">
            {mergedSteps.length === 0 && (
              <p className="text-xs text-gray-400">No steps yet. Use Add step below.</p>
            )}
            {APPROVAL_TEMPLATES.filter((t) => approvalHasTemplate(t)).map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-blue-200 bg-[#E5EEFC]/80 px-2.5 py-2"
              >
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-gray-900">{t.label}</span>
                  <p className="mt-0.5 text-[10px] text-gray-500">{t.description}</p>
                </div>
                <ToggleSwitch checked onChange={(on) => toggleApprovalTemplate(t, on)} />
              </div>
            ))}
            {approvalStepsFlat
              .filter(
                ({ step }: { step: any }) =>
                  !APPROVAL_TEMPLATES.some((c) => stepMatchesTemplate(step, c))
              )
              .map(({ step, stageId }: { step: any; stageId: string }) => {
                const taskNameLine = stepTaskName(step);
                return (
                  <div
                    key={step.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/50 px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-900">{step.label}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                          Custom
                        </span>
                      </div>
                      {taskNameLine && (
                        <p className="mt-0.5 text-[10px] leading-snug text-gray-500">{taskNameLine}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove step"
                      onClick={() => removeStep(stageId, step.id)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
          </div>
          {renderAddStepMenu(
            "approval",
            approvalAddMenu,
            mergedSteps,
            (t) => toggleApprovalTemplate(t, true)
          )}
        </div>

        {showFlow && (
          <div className="min-h-[180px] rounded-xl border border-gray-100 bg-white/60 p-2.5 lg:border-l lg:pl-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                Execution flow
              </span>
              <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 text-[9px] font-semibold">
                <button
                  type="button"
                  onClick={() => setStageParallel(displayStageId, false)}
                  className={`rounded-md px-2 py-1 ${
                    !parallelApproval ? "bg-[#1759e4] text-white shadow-sm" : "text-gray-500"
                  }`}
                >
                  Sequential
                </button>
                <button
                  type="button"
                  onClick={() => setStageParallel(displayStageId, true)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${
                    parallelApproval
                      ? "bg-[#1759e4] text-white shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  <GitBranch className="h-3 w-3" />
                  Parallel
                </button>
              </div>
            </div>

            {mergedSteps.length === 0 ? (
              <p className="text-xs text-gray-400">Enable approvers on the left.</p>
            ) : parallelApproval ? (
              renderParallelFork(mergedSteps)
            ) : (
              <div>
                <SortableSequentialFlow
                  steps={mergedSteps}
                  templateList={APPROVAL_TEMPLATES}
                  onReorderById={reorderApprovalByIds}
                  onMoveStep={(i, delta) => moveApprovalFlat(i, delta)}
                />
                <p className="mt-2 rounded-md bg-gray-50 px-2 py-1 text-[10px] leading-snug text-gray-600">
                  Drag the grip to reorder with the mouse, or use the arrows.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const accordion = (
    section: GuidedSection,
    title: string,
    titleClass: string,
    pillBg: string,
    borderClass: string,
    bgClass: string,
    stepCount: number,
    parallel: boolean,
    collapsedPills: { label: string; tone: string }[],
    body: React.ReactNode
  ) => {
    const isOpen = expanded === section;
    const hasCollapsedPills = !isOpen && collapsedPills.length > 0;
    const seqLabel = parallel ? "PARALLEL" : "SEQUENTIAL";
    const openRing =
      section === "validate"
        ? "shadow-md shadow-blue-500/10 ring-2 ring-[#1759e4]/25"
        : section === "approval"
          ? "shadow-md shadow-blue-500/10 ring-2 ring-blue-200"
          : "shadow-md shadow-green-500/10 ring-2 ring-green-200/90";
    return (
      <div
        className={`rounded-2xl border-2 ${borderClass} ${bgClass} transition-all duration-200 ${isOpen ? openRing : "hover:shadow-sm"}`}
      >
        <button
          type="button"
          onClick={() => setExpanded(isOpen ? null : section)}
          className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-t-2xl px-3.5 py-3 text-left"
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#1759e4] bg-white text-[11px] font-bold text-[#1759e4] shadow-sm ${hasCollapsedPills ? "translate-y-[10px]" : ""}`}
          >
            {section === "validate" ? 1 : section === "approval" ? 2 : 3}
          </span>
          <span className="grid min-w-0 grid-cols-[auto_1fr] items-center gap-2">
            <span
              className={`inline-flex h-8 shrink-0 items-center justify-center rounded-full px-3.5 text-xs font-bold uppercase leading-none tracking-wide shadow-sm ${pillBg} ${titleClass} ${hasCollapsedPills ? "translate-y-[10px]" : ""}`}
            >
              {title}
            </span>
            <span className="flex min-w-0 items-center justify-end gap-1.5">
              <span className="whitespace-nowrap text-[10px] font-medium text-slate-600">
                {stepCount} step{stepCount !== 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full border border-blue-200 bg-[#E5EEFC] px-2 py-0.5 text-[9px] font-bold text-[#1759e4] shadow-sm">
                {parallel ? (
                  <GitBranch className="h-2.5 w-2.5" />
                ) : (
                  <ArrowDown className="h-2.5 w-2.5" />
                )}
                {seqLabel}
              </span>
            </span>
          </span>
          <span className="text-slate-400">
            {isOpen ? <Minus className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>
        {!isOpen && collapsedPills.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-3 pb-2 pt-0.5">
            {collapsedPills.map((p, i) => (
              <span
                key={`${p.label}-${i}`}
                className={`rounded-full px-3.5 py-0.5 text-xs font-semibold ${p.tone}`}
              >
                {i + 1} {p.label}
              </span>
            ))}
          </div>
        )}
        {isOpen && <div className="px-3 py-3">{body}</div>}
      </div>
    );
  };

  const validatePills = (validateStage?.steps || []).map((st: any, i: number) => ({
    label: (findTemplateForStep(st, VALIDATE_TEMPLATES)?.shortLabel || st.label).toUpperCase(),
    tone:
      st.type === "AI AGENT"
        ? "border border-blue-200 bg-blue-50 text-[#1759e4] shadow-sm"
        : "border border-gray-200 bg-[#F4F5FA] text-slate-800 shadow-sm",
  }));

  const approvalPills = approvalStepsFlat.map(({ step }: { step: any }, i: number) => ({
    label: (findTemplateForStep(step, APPROVAL_TEMPLATES)?.shortLabel || step.label).toUpperCase(),
    tone: "border border-blue-200 bg-[#E5EEFC] text-[#1759e4] shadow-sm",
  }));

  const fulfillmentPills = (fulfillmentStage?.steps || []).map((st: any) => ({
    label: (
      findTemplateForStep(st, [...FULFILLMENT_CORE, ...FULFILLMENT_EXTRA])?.shortLabel || st.label
    ).toUpperCase(),
    tone: "border border-green-200 bg-green-50 text-green-800 shadow-sm",
  }));

  return (
    <div className="w-full space-y-4 text-xs text-slate-800">
      <div className="space-y-3">
        {accordion(
          "validate",
          "Validate",
          "text-[#1759e4]",
          "bg-[#E5EEFC]",
          "border-blue-200",
          "bg-gradient-to-br from-[#E5EEFC]/50 via-white to-white",
          validateStage?.steps?.length ?? 0,
          parallelValidate,
          validatePills,
          renderSectionBody("validate", validateStage, VALIDATE_TEMPLATES, validateAddMenu, {
            accent: "blue",
            border: "border-blue-200",
            bg: "bg-[#E5EEFC]/60",
            labelClass: "text-slate-800",
          })
        )}

        {accordion(
          "approval",
          "Approval",
          "text-blue-900",
          "bg-blue-100",
          "border-blue-200",
          "bg-gradient-to-br from-white via-[#F4F5FA]/40 to-white",
          approvalStepsFlat.length,
          parallelApproval,
          approvalPills,
          renderApprovalBody()
        )}

        {accordion(
          "fulfillment",
          "Fulfillment",
          "text-green-800",
          "bg-green-100",
          "border-green-200",
          "bg-gradient-to-br from-green-50/50 via-white to-white",
          fulfillmentStage?.steps?.length ?? 0,
          parallelFulfillment,
          fulfillmentPills,
          renderSectionBody("fulfillment", fulfillmentStage, FULFILLMENT_CORE, fulfillmentAddMenu, {
            accent: "green",
            border: "border-green-200",
            bg: "bg-green-50/80",
            labelClass: "text-green-900",
          })
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-gray-200 bg-[#F4F5FA] py-2.5">
        <span className="rounded-full border border-blue-200 bg-[#E5EEFC] px-3 py-1 text-[10px] font-bold tracking-wide text-[#1759e4]">
          VALIDATE
        </span>
        <span className="text-gray-400" aria-hidden>
          →
        </span>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-bold tracking-wide text-blue-900">
          APPROVAL
        </span>
        <span className="text-gray-400" aria-hidden>
          →
        </span>
        <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-bold tracking-wide text-green-800">
          FULFILLMENT
        </span>
      </div>
    </div>
  );
};
