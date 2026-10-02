"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Check,
  Code2,
  Copy,
  CopyPlus,
  Filter,
  ListChecks,
  Package,
  Plus,
  Trash2,
  UserRound,
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
  /** UI-only: category picked in the first field dropdown before a field is chosen */
  group?: string;
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
      ? {
          ...base,
          lineItemMode: "conditions",
          conditions: [newCondition("lineitem.actionType", "ieq", shorthandAction.toUpperCase())],
        }
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

const controlClass =
  "h-9 w-full min-w-0 px-3 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

const ROW_GRID = "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px_minmax(0,1.2fr)_72px]";

const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Request Line Item": ListChecks,
  "Requested For (Identity)": UserRound,
  "Catalog Item": Package,
};

const splitValues = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const conditionErrors = (c: SelectorCondition) => {
  const errs: string[] = [];
  if (!c.path.trim()) errs.push("Choose a field");
  const v = conditionValue(c);
  if (Array.isArray(v) ? !v.length : !v) errs.push("Enter a value");
  return errs;
};

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
    <div className="inline-flex p-0.5 rounded-md bg-gray-100 border border-gray-200">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 h-7 text-xs font-semibold rounded transition-colors ${
            value === o.value ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-blue-50 hover:text-blue-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Multi-value input for the `in` operator; stores values as a comma separated string. */
function TagInput({
  value,
  onChange,
  suggestions,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions?: string[];
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const tags = splitValues(value);
  const addTags = (raw: string[]) => {
    const next = [...tags];
    raw.map((r) => r.trim()).forEach((t) => {
      if (t && !next.includes(t)) next.push(t);
    });
    onChange(next.join(", "));
  };
  const remaining = (suggestions ?? []).filter((s) => !tags.includes(s));

  return (
    <div className="space-y-1.5">
      <div
        className={`flex flex-wrap items-center gap-1 min-h-9 px-1.5 py-1 border rounded-md bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 ${
          invalid ? "border-amber-300" : "border-gray-300"
        }`}
      >
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded bg-blue-50 text-blue-700 text-xs font-medium"
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== t).join(", "))}
              className="p-0.5 rounded hover:bg-blue-100"
              aria-label={`Remove ${t}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            const parts = e.target.value.split(",");
            if (parts.length > 1) addTags(parts.slice(0, -1));
            setDraft(parts[parts.length - 1]);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTags([draft]);
              setDraft("");
            } else if (e.key === "Backspace" && !draft && tags.length) {
              onChange(tags.slice(0, -1).join(", "));
            }
          }}
          onBlur={() => {
            if (draft.trim()) addTags([draft]);
            setDraft("");
          }}
          placeholder={tags.length ? "" : "Type and press Enter"}
          className="flex-1 min-w-[80px] h-6 px-1 text-sm bg-transparent focus:outline-none"
        />
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTags([s])}
              className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded border border-dashed border-gray-300 text-[11px] text-gray-500 hover:border-blue-400 hover:text-blue-700"
            >
              <Plus className="w-2.5 h-2.5" />
              {s}
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
  const isLineItem = value.scope === "LINEITEM" && value.lineItemMode === "conditions";
  const incompleteCount = value.conditions.filter((c) => conditionErrors(c).length).length;

  const update = (patch: Partial<SelectorBuilderState>) => onChange({ ...value, ...patch });

  const updateCondition = (id: string, patch: Partial<SelectorCondition>) =>
    update({ conditions: value.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const removeCondition = (id: string) =>
    update({ conditions: value.conditions.filter((c) => c.id !== id) });

  const duplicateCondition = (id: string) => {
    const idx = value.conditions.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const next = [...value.conditions];
    next.splice(idx + 1, 0, { ...value.conditions[idx], id: newId() });
    update({ conditions: next });
  };

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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-600 shrink-0">
            <Filter className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">Conditions</h3>
            <p className="text-xs text-gray-500">
              {isLineItem
                ? "The policy applies to request line items that satisfy these rules."
                : "Define what this policy should match."}
            </p>
          </div>
        </div>
        {isLineItem && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>Request must match</span>
            <Segmented
              value={value.matchType}
              onChange={(m) => update({ matchType: m })}
              options={[
                { value: "all", label: "All" },
                { value: "any", label: "Any" },
              ]}
            />
            <span>of the following</span>
          </div>
        )}
      </div>

      <div className="p-5">
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

        {isLineItem && (
          <div>
            {/* Column labels */}
            <div className="hidden md:flex gap-3 mb-2">
              <span className="w-12 shrink-0" />
              <div
                className={`flex-1 grid ${ROW_GRID} gap-2 px-3 text-[11px] font-medium text-gray-500 uppercase tracking-wide`}
              >
                <span>Category</span>
                <span>Field</span>
                <span>Operator</span>
                <span>Value</span>
                <span />
              </div>
            </div>

            <ol>
              {value.conditions.map((c, index) => {
                const def = FIELD_DEFS.find((f) => f.path === c.path);
                const isCustom = !!c.custom || (!def && c.path !== "");
                const group = def?.group ?? c.group ?? "";
                const GroupIcon = isCustom ? Code2 : GROUP_ICONS[group];
                const listId = `selector-suggestions-${c.id}`;
                const rowErrors = showErrors ? conditionErrors(c) : [];
                const invalid = rowErrors.length > 0;
                return (
                  <li key={c.id} className="relative flex gap-3 pb-3">
                    {/* Connector rail */}
                    <div className="relative flex flex-col items-center w-12 shrink-0 pt-4">
                      {index > 0 && <span className="absolute top-0 h-4 w-px bg-gray-200" aria-hidden />}
                      <span
                        className={`relative inline-flex items-center justify-center min-w-[40px] h-6 px-2 rounded-full text-[11px] font-bold tracking-wide ${
                          index === 0
                            ? "bg-gray-900 text-white"
                            : connector === "AND"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-violet-100 text-violet-700"
                        }`}
                      >
                        {index === 0 ? "IF" : connector}
                      </span>
                      <span className="flex-1 w-px bg-gray-200 -mb-3" aria-hidden />
                    </div>

                    <div
                      className={`flex-1 min-w-0 rounded-lg border p-3 transition-colors ${
                        invalid ? "border-amber-200 bg-amber-50/40" : "border-gray-200 bg-gray-50/60 hover:border-gray-300"
                      }`}
                    >
                      <div className={`grid grid-cols-1 ${ROW_GRID} items-start gap-2`}>
                        {/* Category */}
                        <div className="relative min-w-0">
                          {GroupIcon && (
                            <GroupIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                          )}
                          <select
                            value={isCustom ? CUSTOM_PATH : group}
                            aria-label="Category"
                            onChange={(e) =>
                              updateCondition(
                                c.id,
                                e.target.value === CUSTOM_PATH
                                  ? { custom: true, group: undefined, path: "" }
                                  : { custom: false, group: e.target.value, path: "" }
                              )
                            }
                            className={`${controlClass} ${GroupIcon ? "pl-8" : ""} ${
                              isCustom || group ? "" : "text-gray-400"
                            }`}
                          >
                            <option value="" disabled>
                              Select category…
                            </option>
                            {FIELD_GROUPS.map((g) => (
                              <option key={g} value={g} className="text-gray-900">
                                {g}
                              </option>
                            ))}
                            <option value={CUSTOM_PATH} className="text-gray-900">
                              Custom path…
                            </option>
                          </select>
                        </div>

                        {/* Field */}
                        {isCustom ? (
                          <input
                            type="text"
                            value={c.path}
                            aria-label="Custom path"
                            onChange={(e) => updateCondition(c.id, { path: e.target.value })}
                            placeholder="e.g. requestedFor.location"
                            title={c.path}
                            className={`${controlClass} font-mono text-xs`}
                          />
                        ) : (
                          <select
                            value={c.path}
                            title={c.path}
                            aria-label="Field"
                            disabled={!group}
                            onChange={(e) => updateCondition(c.id, { path: e.target.value })}
                            className={`${controlClass} disabled:bg-gray-100 disabled:cursor-not-allowed ${
                              c.path ? "" : "text-gray-400"
                            }`}
                          >
                            <option value="" disabled>
                              {group ? "Select field…" : "Pick a category first"}
                            </option>
                            {FIELD_DEFS.filter((f) => f.group === group).map((f) => (
                              <option key={f.path} value={f.path} className="text-gray-900">
                                {f.label}
                              </option>
                            ))}
                          </select>
                        )}

                        {/* Operator */}
                        <select
                          value={c.op}
                          aria-label="Operator"
                          onChange={(e) => {
                            const op = e.target.value as SelectorOp;
                            // Leaving the multi-value operator keeps only the first value.
                            const nextValue =
                              c.op === "in" && op !== "in" ? (splitValues(c.value)[0] ?? "") : c.value;
                            updateCondition(c.id, { op, value: nextValue });
                          }}
                          className={`${controlClass} font-medium text-gray-700`}
                        >
                          {OP_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>

                        {/* Value */}
                        <div className="min-w-0">
                          {c.op === "in" ? (
                            <TagInput
                              value={c.value}
                              onChange={(v) => updateCondition(c.id, { value: v })}
                              suggestions={def?.suggestions}
                              invalid={invalid && !splitValues(c.value).length}
                            />
                          ) : (
                            <>
                              <input
                                type="text"
                                value={c.value}
                                aria-label="Value"
                                list={def?.suggestions ? listId : undefined}
                                onChange={(e) => updateCondition(c.id, { value: e.target.value })}
                                placeholder={def?.suggestions ? `e.g. ${def.suggestions[0]}` : "Value"}
                                className={controlClass}
                              />
                              {def?.suggestions && (
                                <datalist id={listId}>
                                  {def.suggestions.map((s) => (
                                    <option key={s} value={s} />
                                  ))}
                                </datalist>
                              )}
                            </>
                          )}
                        </div>

                        {/* Row actions */}
                        <div className="flex items-center justify-end gap-0.5 h-9">
                          <button
                            type="button"
                            onClick={() => duplicateCondition(c.id)}
                            title="Duplicate condition"
                            aria-label="Duplicate condition"
                            className="flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <CopyPlus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCondition(c.id)}
                            disabled={value.conditions.length === 1}
                            title="Remove condition"
                            aria-label="Remove condition"
                            className="flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {invalid && (
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {rowErrors.join(" · ")}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="flex gap-3">
              <span className="w-12 shrink-0 flex justify-center" aria-hidden>
                <span className="w-px h-3 bg-gray-200" />
              </span>
              <button
                type="button"
                onClick={() => update({ conditions: [...value.conditions, newCondition()] })}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-blue-700 border border-dashed border-blue-300 rounded-md bg-white hover:bg-blue-50 hover:border-blue-400"
              >
                <Plus className="w-4 h-4" /> Add condition
              </button>
            </div>
          </div>
        )}

        {showErrors && !isLineItem && errors.length > 0 && (
          <div className="mt-3 flex items-start gap-2 text-xs text-amber-700">
            <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
            <span>{errors.join(" ")}</span>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="border-t border-gray-100 bg-gray-50/70">
        <div className="flex items-start justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Applies to</div>
            {errors.length ? (
              <p className="text-sm text-gray-400">
                {isLineItem && incompleteCount
                  ? `${incompleteCount} of ${value.conditions.length} condition${
                      value.conditions.length === 1 ? "" : "s"
                    } incomplete. Fill them in to see a preview.`
                  : "Complete the selector above"}
              </p>
            ) : isLineItem ? (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {value.conditions.map((c, i) => {
                  const op = OP_OPTIONS.find((o) => o.value === c.op)?.symbol ?? c.op;
                  return (
                    <React.Fragment key={c.id}>
                      {i > 0 && (
                        <span
                          className={`px-1 font-bold text-[10px] ${
                            connector === "AND" ? "text-blue-700" : "text-violet-700"
                          }`}
                        >
                          {connector}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1">
                        <span className="font-medium text-gray-800">{fieldLabel(c.path)}</span>
                        <span className="font-mono text-gray-400">{op}</span>
                        <span className="font-semibold text-blue-700">
                          {c.op === "in" ? `[${splitValues(c.value).join(", ")}]` : `"${c.value.trim()}"`}
                        </span>
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-800 break-words">{describeSelector(value)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowJson((v) => !v)}
            className="inline-flex items-center gap-1 shrink-0 h-7 px-2 text-xs font-medium text-gray-600 rounded hover:bg-gray-200/70"
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
