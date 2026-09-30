"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Code2,
  Copy,
  LayoutGrid,
  ListChecks,
  Package,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

/**
 * Builds the `selector_json` of an approval policy (see Approval Policy Cookbook):
 *  - APPLICATION / CATALOG scopes are evaluated in the background on catalog sync (Hint Refresh).
 *  - LINEITEM scope is evaluated at runtime when an access request is submitted.
 */

export type SelectorScope = "APPLICATION" | "CATALOG" | "LINEITEM";
export type SelectorOp = "ieq" | "eq" | "neq" | "in" | "contains";

export interface SelectorCondition {
  id: string;
  path: string;
  op: SelectorOp;
  value: string;
  /** UI-only: user picked "Custom path…" in the field dropdown */
  custom?: boolean;
}

export interface SelectorBuilderState {
  scope: SelectorScope;
  /** APPLICATION scope */
  applicationName: string;
  /** CATALOG scope */
  catalogMatchBy: "name" | "id";
  catalogValue: string;
  /** LINEITEM scope: `lineitem.actionType` shorthand or a `match` block */
  lineItemMode: "actionType" | "conditions";
  actionType: string;
  matchType: "all" | "any";
  conditions: SelectorCondition[];
}

interface FieldDef {
  path: string;
  label: string;
  group: string;
  suggestions?: string[];
}

const FIELD_DEFS: FieldDef[] = [
  { path: "lineitem.actionType", label: "Action Type", group: "Request Line Item", suggestions: ["ADD", "REVOKE"] },
  {
    path: "lineitem.targetAccount.accountType",
    label: "Target Account Type",
    group: "Request Line Item",
    suggestions: ["SERVICE_ACCOUNT"],
  },
  { path: "requestedFor.userType", label: "User Type", group: "Requested For (Identity)", suggestions: ["Employee", "Contractor"] },
  { path: "requestedFor.department", label: "Department", group: "Requested For (Identity)" },
  { path: "catalog.applicationname", label: "Application Name", group: "Catalog Item" },
  { path: "catalog.name", label: "Catalog Item Name", group: "Catalog Item" },
  { path: "catalog.risk", label: "Risk", group: "Catalog Item", suggestions: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
];

const FIELD_GROUPS = Array.from(new Set(FIELD_DEFS.map((f) => f.group)));
const CUSTOM_PATH = "__custom__";

const OP_OPTIONS: { value: SelectorOp; label: string; symbol: string }[] = [
  { value: "ieq", label: "equals (ignore case)", symbol: "=" },
  { value: "eq", label: "equals (exact)", symbol: "==" },
  { value: "neq", label: "not equals", symbol: "!=" },
  { value: "in", label: "in (comma separated)", symbol: "in" },
  { value: "contains", label: "contains", symbol: "contains" },
];

const ACTION_TYPES = ["ADD", "REVOKE"];

let idCounter = 0;
const newId = () => `cond-${Date.now()}-${idCounter++}`;

const newCondition = (path = "", op: SelectorOp = "ieq", value = ""): SelectorCondition => ({
  id: newId(),
  path,
  op,
  value,
});

export const createEmptySelectorState = (): SelectorBuilderState => ({
  scope: "LINEITEM",
  applicationName: "",
  catalogMatchBy: "name",
  catalogValue: "",
  lineItemMode: "conditions",
  actionType: "REVOKE",
  matchType: "all",
  conditions: [newCondition()],
});

const TEMPLATES: { label: string; build: () => SelectorBuilderState }[] = [
  {
    label: "Application-wide",
    build: () => ({ ...createEmptySelectorState(), scope: "APPLICATION", applicationName: "SAP_S4" }),
  },
  {
    label: "Specific catalog item",
    build: () => ({ ...createEmptySelectorState(), scope: "CATALOG", catalogValue: "AWS Administrator Access" }),
  },
  {
    label: "Revoke action",
    build: () => ({ ...createEmptySelectorState(), lineItemMode: "actionType", actionType: "REVOKE" }),
  },
  {
    label: "Service account target",
    build: () => ({
      ...createEmptySelectorState(),
      conditions: [newCondition("lineitem.targetAccount.accountType", "ieq", "SERVICE_ACCOUNT")],
    }),
  },
  {
    label: "Contractor in Finance",
    build: () => ({
      ...createEmptySelectorState(),
      conditions: [
        newCondition("requestedFor.userType", "ieq", "Contractor"),
        newCondition("requestedFor.department", "ieq", "Finance"),
      ],
    }),
  },
  {
    label: "Employee ADD to high-risk SAP",
    build: () => ({
      ...createEmptySelectorState(),
      conditions: [
        newCondition("lineitem.actionType", "ieq", "ADD"),
        newCondition("requestedFor.userType", "ieq", "Employee"),
        newCondition("catalog.applicationname", "ieq", "SAP_S4"),
        newCondition("catalog.risk", "ieq", "HIGH"),
      ],
    }),
  },
];

const conditionValue = (c: SelectorCondition): string | string[] =>
  c.op === "in"
    ? c.value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : c.value.trim();

/** Convert builder state into the selector_json payload expected by the policy engine. */
export function buildSelectorJson(state: SelectorBuilderState): Record<string, unknown> {
  switch (state.scope) {
    case "APPLICATION":
      return { scope: "APPLICATION", catalog: { applicationname: state.applicationName.trim() } };
    case "CATALOG":
      return { scope: "CATALOG", catalog: { [state.catalogMatchBy]: state.catalogValue.trim() } };
    case "LINEITEM":
    default:
      if (state.lineItemMode === "actionType") {
        return { scope: "LINEITEM", lineitem: { actionType: state.actionType } };
      }
      return {
        scope: "LINEITEM",
        match: {
          [state.matchType]: state.conditions.map((c) => ({
            path: c.path.trim(),
            op: c.op,
            value: conditionValue(c),
          })),
        },
      };
  }
}

/** Returns a list of problems; empty when the selector is complete. */
export function validateSelector(state: SelectorBuilderState): string[] {
  const errors: string[] = [];
  if (state.scope === "APPLICATION" && !state.applicationName.trim()) {
    errors.push("Application name is required.");
  }
  if (state.scope === "CATALOG" && !state.catalogValue.trim()) {
    errors.push(`Catalog item ${state.catalogMatchBy === "id" ? "ID" : "name"} is required.`);
  }
  if (state.scope === "LINEITEM") {
    if (state.lineItemMode === "actionType") {
      if (!state.actionType) errors.push("Action type is required.");
    } else if (!state.conditions.length) {
      errors.push("Add at least one condition.");
    } else {
      state.conditions.forEach((c, i) => {
        if (!c.path.trim()) errors.push(`Condition ${i + 1}: field is required.`);
        const v = conditionValue(c);
        if (Array.isArray(v) ? !v.length : !v) errors.push(`Condition ${i + 1}: value is required.`);
      });
    }
  }
  return errors;
}

/**
 * Parse a stored selector_json back into builder state (used when editing a policy).
 * Returns null when the JSON is in a shape the builder cannot represent.
 */
export function parseSelectorJson(input: unknown): SelectorBuilderState | null {
  let json: any = input;
  if (typeof json === "string") {
    try {
      json = JSON.parse(json);
    } catch {
      return null;
    }
  }
  if (!json || typeof json !== "object") return null;

  const base = createEmptySelectorState();
  const scope = String(json.scope ?? "LINEITEM").toUpperCase();

  if (scope === "APPLICATION") {
    const name = json.catalog?.applicationname;
    return typeof name === "string" ? { ...base, scope: "APPLICATION", applicationName: name } : null;
  }
  if (scope === "CATALOG") {
    const catalog = json.catalog ?? {};
    if (typeof catalog.id === "string" || typeof catalog.id === "number") {
      return { ...base, scope: "CATALOG", catalogMatchBy: "id", catalogValue: String(catalog.id) };
    }
    if (typeof catalog.name === "string") {
      return { ...base, scope: "CATALOG", catalogMatchBy: "name", catalogValue: catalog.name };
    }
    return null;
  }
  if (scope !== "LINEITEM") return null;

  const matchType: "all" | "any" = Array.isArray(json.match?.any) ? "any" : "all";
  const rawConditions = json.match?.[matchType];
  const shorthandAction = json.lineitem?.actionType;

  if (!Array.isArray(rawConditions)) {
    return typeof shorthandAction === "string"
      ? { ...base, lineItemMode: "actionType", actionType: shorthandAction.toUpperCase() }
      : null;
  }

  const conditions: SelectorCondition[] = rawConditions.map((c: any) => {
    const op = OP_OPTIONS.some((o) => o.value === c?.op) ? (c.op as SelectorOp) : "ieq";
    const value = Array.isArray(c?.value) ? c.value.join(", ") : String(c?.value ?? "");
    return newCondition(String(c?.path ?? ""), op, value);
  });
  if (typeof shorthandAction === "string") {
    conditions.unshift(newCondition("lineitem.actionType", "ieq", shorthandAction));
  }
  return { ...base, lineItemMode: "conditions", matchType, conditions };
}

const fieldLabel = (path: string) => {
  const def = FIELD_DEFS.find((f) => f.path === path);
  return def ? def.label : path;
};

/** Human-readable, one-line summary of the selector (for review screens). */
export function describeSelector(state: SelectorBuilderState): string {
  if (state.scope === "APPLICATION") {
    return `Every catalog item of application "${state.applicationName}"`;
  }
  if (state.scope === "CATALOG") {
    return `Catalog item whose ${state.catalogMatchBy} is "${state.catalogValue}"`;
  }
  if (state.lineItemMode === "actionType") {
    return `Request line items with action type ${state.actionType}`;
  }
  const joiner = state.matchType === "all" ? " AND " : " OR ";
  return state.conditions
    .map((c) => {
      const op = OP_OPTIONS.find((o) => o.value === c.op)?.symbol ?? c.op;
      return `${fieldLabel(c.path)} ${op} "${c.value}"`;
    })
    .join(joiner);
}

const SCOPE_OPTIONS: {
  value: SelectorScope;
  title: string;
  description: string;
  evaluation: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "APPLICATION",
    title: "Entire Application",
    description: "All catalog items of one application",
    evaluation: "catalog sync",
    icon: LayoutGrid,
  },
  {
    value: "CATALOG",
    title: "Catalog Item",
    description: "One catalog item by name or ID",
    evaluation: "catalog sync",
    icon: Package,
  },
  {
    value: "LINEITEM",
    title: "Request Line Item",
    description: "Requester, action and target account",
    evaluation: "request submission",
    icon: ListChecks,
  },
];

const controlClass =
  "h-9 w-full min-w-0 px-3 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

const ROW_GRID = "md:grid-cols-[52px_minmax(0,1.3fr)_200px_minmax(0,1fr)_36px]";

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex p-0.5 rounded-md bg-white border border-gray-300">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 h-7 text-xs font-medium rounded transition-colors ${
            value === o.value
              ? "bg-blue-600 text-white shadow-sm"
              : "text-gray-600 hover:bg-blue-50 hover:text-blue-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TemplatesMenu({ onPick }: { onPick: (s: SelectorBuilderState) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
      >
        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
        Use a template
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-md border border-gray-200 bg-white shadow-lg py-1">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => {
                onPick(t.build());
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  value: SelectorBuilderState;
  onChange: (next: SelectorBuilderState) => void;
  /** Show inline validation messages */
  showErrors?: boolean;
}

export default function ApprovalPolicySelectorBuilder({ value, onChange, showErrors = true }: Props) {
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const jsonText = JSON.stringify(buildSelectorJson(value), null, 2);
  const errors = validateSelector(value);
  const connector = value.matchType === "all" ? "AND" : "OR";

  const update = (patch: Partial<SelectorBuilderState>) => onChange({ ...value, ...patch });

  const updateCondition = (id: string, patch: Partial<SelectorCondition>) =>
    update({ conditions: value.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const removeCondition = (id: string) =>
    update({ conditions: value.conditions.filter((c) => c.id !== id) });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); ignore.
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Where should this policy apply?</h3>
          <p className="text-xs text-gray-500 mt-0.5">Choose a scope, then define what the policy should match.</p>
        </div>
        <TemplatesMenu onPick={onChange} />
      </div>

      {/* Scope */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SCOPE_OPTIONS.map((s) => {
          const isSelected = value.scope === s.value;
          const Icon = s.icon;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => update({ scope: s.value })}
              className={`relative flex items-start gap-3 p-3 text-left border rounded-lg transition-all duration-200 ${
                isSelected
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/30"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <span
                className={`flex items-center justify-center w-9 h-9 rounded-md shrink-0 ${
                  isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                <Icon className="w-4 h-4" />
              </span>
              <span className="min-w-0 pr-4">
                <span className={`block text-sm font-medium ${isSelected ? "text-blue-700" : "text-gray-900"}`}>
                  {s.title}
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">{s.description}</span>
                <span className="block text-[11px] text-gray-400 mt-1">Evaluated on {s.evaluation}</span>
              </span>
              {isSelected && (
                <span className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Scope-specific editor */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        {value.scope === "APPLICATION" && (
          <div className="max-w-md">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Application Name *</label>
            <input
              type="text"
              value={value.applicationName}
              onChange={(e) => update({ applicationName: e.target.value })}
              placeholder="e.g. SAP_S4"
              className={controlClass}
            />
          </div>
        )}

        {value.scope === "CATALOG" && (
          <div className="max-w-xl">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Catalog Item *</label>
            <div className="flex">
              <select
                value={value.catalogMatchBy}
                onChange={(e) => update({ catalogMatchBy: e.target.value as "name" | "id" })}
                className="h-9 px-3 border border-gray-300 rounded-l-md bg-gray-100 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Name</option>
                <option value="id">ID</option>
              </select>
              <input
                type="text"
                value={value.catalogValue}
                onChange={(e) => update({ catalogValue: e.target.value })}
                placeholder={value.catalogMatchBy === "id" ? "Catalog item ID" : "e.g. AWS Administrator Access"}
                className={`${controlClass} -ml-px rounded-l-none`}
              />
            </div>
          </div>
        )}

        {value.scope === "LINEITEM" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented
                value={value.lineItemMode}
                onChange={(m) => update({ lineItemMode: m })}
                options={[
                  { value: "conditions", label: "Match conditions" },
                  { value: "actionType", label: "Action type only" },
                ]}
              />
              {value.lineItemMode === "conditions" && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>Match</span>
                  <Segmented
                    value={value.matchType}
                    onChange={(m) => update({ matchType: m })}
                    options={[
                      { value: "all", label: "All" },
                      { value: "any", label: "Any" },
                    ]}
                  />
                  <span>of the conditions</span>
                </div>
              )}
            </div>

            {value.lineItemMode === "actionType" ? (
              <div className="max-w-xs">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Action Type *</label>
                <select
                  value={value.actionType}
                  onChange={(e) => update({ actionType: e.target.value })}
                  className={controlClass}
                >
                  {ACTION_TYPES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className={`hidden md:grid ${ROW_GRID} gap-2 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wide`}
                >
                  <span />
                  <span>Field</span>
                  <span>Operator</span>
                  <span>Value</span>
                  <span />
                </div>

                {value.conditions.map((c, index) => {
                  const def = FIELD_DEFS.find((f) => f.path === c.path);
                  const isCustom = !!c.custom || (!def && c.path !== "");
                  const listId = `selector-suggestions-${c.id}`;
                  return (
                    <div
                      key={c.id}
                      className={`grid grid-cols-1 ${ROW_GRID} items-center gap-2 p-2 bg-white border border-gray-200 rounded-md`}
                    >
                      <span
                        className={`justify-self-start md:justify-self-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          index === 0 ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {index === 0 ? "IF" : connector}
                      </span>

                      {isCustom ? (
                        <div className="relative">
                          <input
                            type="text"
                            value={c.path}
                            onChange={(e) => updateCondition(c.id, { path: e.target.value })}
                            placeholder="Custom path, e.g. requestedFor.location"
                            className={`${controlClass} pr-8 font-mono text-xs`}
                          />
                          <button
                            type="button"
                            title="Choose from field list"
                            onClick={() => updateCondition(c.id, { custom: false, path: "" })}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <select
                          value={c.path}
                          title={c.path}
                          onChange={(e) =>
                            updateCondition(
                              c.id,
                              e.target.value === CUSTOM_PATH
                                ? { custom: true, path: "" }
                                : { custom: false, path: e.target.value }
                            )
                          }
                          className={`${controlClass} ${c.path ? "" : "text-gray-400"}`}
                        >
                          <option value="" disabled>
                            Select field…
                          </option>
                          {FIELD_GROUPS.map((g) => (
                            <optgroup key={g} label={g}>
                              {FIELD_DEFS.filter((f) => f.group === g).map((f) => (
                                <option key={f.path} value={f.path} className="text-gray-900">
                                  {f.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          <option value={CUSTOM_PATH} className="text-gray-900">
                            Custom path…
                          </option>
                        </select>
                      )}

                      <select
                        value={c.op}
                        onChange={(e) => updateCondition(c.id, { op: e.target.value as SelectorOp })}
                        className={controlClass}
                      >
                        {OP_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>

                      <div className="min-w-0">
                        <input
                          type="text"
                          value={c.value}
                          list={def?.suggestions ? listId : undefined}
                          onChange={(e) => updateCondition(c.id, { value: e.target.value })}
                          placeholder={c.op === "in" ? "Value1, Value2" : "Value"}
                          className={controlClass}
                        />
                        {def?.suggestions && (
                          <datalist id={listId}>
                            {def.suggestions.map((s) => (
                              <option key={s} value={s} />
                            ))}
                          </datalist>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeCondition(c.id)}
                        disabled={value.conditions.length === 1}
                        className="justify-self-end md:justify-self-center flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                        aria-label="Remove condition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => update({ conditions: [...value.conditions, newCondition()] })}
                  className="w-full flex items-center justify-center gap-1.5 h-9 text-sm font-medium text-blue-700 border border-dashed border-blue-300 rounded-md bg-white hover:bg-blue-50"
                >
                  <Plus className="w-4 h-4" /> Add condition
                </button>
              </div>
            )}
          </div>
        )}

        {showErrors && errors.length > 0 && (
          <div className="mt-3 flex items-start gap-2 text-xs text-amber-700">
            <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
            <span>{errors.join(" ")}</span>
          </div>
        )}
      </div>

      {/* Summary + JSON */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 py-3 bg-white">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Applies to</div>
            <p className="text-sm text-gray-800 mt-0.5 break-words">
              {errors.length ? (
                <span className="text-gray-400">Complete the selector above</span>
              ) : (
                describeSelector(value)
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowJson((v) => !v)}
            className="inline-flex items-center gap-1 shrink-0 h-7 px-2 text-xs font-medium text-gray-600 rounded hover:bg-gray-100"
          >
            <Code2 className="w-3.5 h-3.5" />
            {showJson ? "Hide JSON" : "View JSON"}
          </button>
        </div>
        {showJson && (
          <div className="relative border-t border-gray-200 bg-slate-900">
            <button
              type="button"
              onClick={handleCopy}
              className="absolute top-2 right-2 inline-flex items-center gap-1 h-7 px-2 text-xs text-slate-300 rounded hover:bg-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <pre className="text-xs text-slate-100 p-4 overflow-auto font-mono max-h-72">{jsonText}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
