"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  getRuleDetail,
  upsertRuleV2,
  listUserAttributes,
  searchFunctions,
} from "@/lib/api/rm";
import { useLookup } from "@/hooks/useLookup";
import type { RmLookupValue } from "@/lib/api/rm";
import type {
  RuleDetail,
  RuleFunctionBinding,
  RulePrivilege,
  RuleUserCondition,
  UserAttributeCatalog,
  FunctionRow,
} from "@/types/rm-rules";
import Modal from "@/components/Modal";
import {
  Pencil,
  Plus,
  X,
  Save,
  Search,
  ShieldAlert,
  KeyRound,
  Lock,
  Database,
  MousePointer,
  Trash2,
  Users,
} from "lucide-react";

const KIND_META: Record<string, { color: string; el: ReactNode }> = {
  ROLE: { color: "#2563eb", el: <ShieldAlert className="h-[11px] w-[11px] shrink-0" /> },
  ACTION: { color: "#7c3aed", el: <MousePointer className="h-[11px] w-[11px] shrink-0" /> },
  PERMISSION: { color: "#0891b2", el: <KeyRound className="h-[11px] w-[11px] shrink-0" /> },
  AUTH_OBJECT: { color: "#f59e0b", el: <Lock className="h-[11px] w-[11px] shrink-0" /> },
  DATA_SECURITY: { color: "#dc2626", el: <Database className="h-[11px] w-[11px] shrink-0" /> },
};

function KindBadge({ kind }: { kind: string }) {
  const m = KIND_META[kind] ?? {
    color: "#64748b",
    el: <KeyRound className="h-[11px] w-[11px] shrink-0" />,
  };
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ background: `${m.color}18`, color: m.color, borderColor: `${m.color}40` }}
    >
      {m.el} {kind.replaceAll("_", " ")}
    </span>
  );
}

export function PrivilegeRow({ p }: { p: RulePrivilege }) {
  return (
    <tr>
      <td>
        <div className="font-medium">{p.privilege_code}</div>
        {p.privilege_name && <div className="text-[11px] text-slate-500">{p.privilege_name}</div>}
      </td>
      <td>
        <KindBadge kind={p.privilege_kind} />
      </td>
      <td>
        {p.permission ? (
          <span className="font-mono text-[11px]">
            {p.permission.object_name}
            {p.permission.action_name ? ` / ${p.permission.action_name}` : ""}
            {p.permission.field_name ? ` / ${p.permission.field_name}` : ""}
            {p.permission.value_low
              ? ` = ${p.permission.value_low}${
                  p.permission.value_high ? ` .. ${p.permission.value_high}` : ""
                }`
              : ""}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}

type ModalTab = "OVERVIEW" | "SIDE_A" | "SIDE_B" | "USER_CONDITIONS";

type RuleDetailModalProps = {
  open: boolean;
  ruleId: number | null;
  creating: boolean;
  rulesetId: number;
  editMode: boolean;
  onClose: () => void;
  onSaved: () => void;
  onToggleEdit: () => void;
};

export function RuleDetailModal({
  ruleId,
  creating,
  rulesetId,
  editMode,
  onClose,
  onSaved,
  onToggleEdit,
  open,
}: RuleDetailModalProps) {
  const [tab, setTab] = useState<ModalTab>("OVERVIEW");
  const severities = useLookup("RULE_SEVERITY");
  const ruleTypes = useLookup("RULE_TYPE");

  const ruleQ = useQuery({
    enabled: ruleId !== null && !creating,
    queryKey: ["rule-detail", ruleId],
    queryFn: async () => {
      const { data } = await getRuleDetail(ruleId!);
      if (!data) throw new Error("Rule not found");
      return data;
    },
  });

  const [form, setForm] = useState<RuleDetail | null>(null);

  useEffect(() => {
    if (creating) return;
    if (ruleQ.data) setForm(ruleQ.data);
  }, [ruleQ.data, creating]);

  useEffect(() => {
    if (creating || ruleId === null) {
      setForm({
        rule_id: 0,
        ruleset_id: rulesetId,
        ruleset_code: "",
        rule_code: "",
        rule_name: "",
        description: "",
        remediation_guidance: "",
        rule_type: "SOD",
        severity: "HIGH",
        risk_score: 50,
        scope_enforcement: "SAME_SCOPE",
        status: "ACTIVE",
        functions: [],
        user_conditions: [],
        mitigations: [],
        open_violation_count: 0,
        created_at: "",
        updated_at: "",
      });
    }
  }, [creating, ruleId, rulesetId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("No form");
      return upsertRuleV2({
        ruleset_id: form.ruleset_id,
        rule_code: form.rule_code,
        rule_type: form.rule_type,
        severity: form.severity,
        risk_score: form.risk_score,
        scope_enforcement: form.scope_enforcement,
        rule_name: form.rule_name,
        description: form.description,
        remediation: form.remediation_guidance,
        side_a_function_ids: (form.functions ?? [])
          .filter((f) => f.condition_side === "A")
          .map((f) => f.function_id),
        side_b_function_ids: (form.functions ?? [])
          .filter((f) => f.condition_side === "B")
          .map((f) => f.function_id),
        user_conditions: form.user_conditions ?? [],
        status: form.status,
      });
    },
    onSuccess: onSaved,
  });

  if (!form) {
    return (
      <Modal open={open} onClose={onClose} extraWide>
        <div className="p-4 text-slate-600">
          {ruleQ.isError
            ? (ruleQ.error as Error).message
            : ruleQ.isLoading
              ? "Loading…"
              : "No data."}
        </div>
      </Modal>
    );
  }

  const functions = form.functions ?? [];
  const userConditions = form.user_conditions ?? [];
  const sideA = functions.filter((f) => f.condition_side === "A");
  const sideB = functions.filter((f) => f.condition_side === "B");

  const updateForm = <K extends keyof RuleDetail>(k: K, v: RuleDetail[K]) =>
    setForm((prev) => (prev ? { ...prev, [k]: v } : null));

  return (
    <Modal open={open} onClose={onClose} extraWide>
      <div className="flex flex-col gap-1 mb-1">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <div className="text-xs text-slate-500 font-medium">
              {form.ruleset_code || "New rule"} · risk {form.risk_score} · {form.open_violation_count} open
            </div>
            <h3 className="text-base font-semibold text-gray-900 mt-0.5">
              {form.rule_code || "New rule"} — {form.rule_name || ""}
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {!editMode && ruleId !== null && !creating && (
              <button
                type="button"
                onClick={onToggleEdit}
                className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            {editMode && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-blue-600 bg-blue-600 px-2 py-1 text-sm text-white disabled:opacity-50"
                disabled={save.isPending}
                onClick={() => void save.mutate()}
              >
                <Save className="h-3.5 w-3.5" />
                {save.isPending ? "Saving…" : "Save rule"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded border border-gray-200 p-1.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {save.isError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            {(save.error as Error).message}
          </div>
        )}
      </div>

      <nav className="flex flex-wrap gap-0.5 border-b border-slate-200 mb-3">
        {(["OVERVIEW", "SIDE_A", "SIDE_B", "USER_CONDITIONS"] as ModalTab[]).map((t) => {
          const label =
            t === "OVERVIEW"
              ? "Overview"
              : t === "SIDE_A"
                ? `Side A (${sideA.length})`
                : t === "SIDE_B"
                  ? `Side B (${sideB.length})`
                  : `User Conditions (${userConditions.length})`;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-2 py-1.5 text-sm -mb-px border-b-2 ${
                tab === t
                  ? "border-blue-600 font-semibold text-gray-900"
                  : "border-transparent text-slate-600"
              }`}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {tab === "OVERVIEW" && (
        <OverviewTab
          form={form}
          editMode={editMode}
          updateForm={updateForm}
          ruleTypes={ruleTypes.data as RmLookupValue[]}
          severities={severities.data as RmLookupValue[]}
        />
      )}
      {tab === "SIDE_A" && (
        <FunctionSideEditor
          label="Side A"
          side="A"
          editMode={editMode}
          functions={sideA}
          allFunctions={functions}
          onChange={(fns) => updateForm("functions", fns)}
        />
      )}
      {tab === "SIDE_B" && (
        <FunctionSideEditor
          label="Side B"
          side="B"
          editMode={editMode}
          functions={sideB}
          allFunctions={functions}
          onChange={(fns) => updateForm("functions", fns)}
        />
      )}
      {tab === "USER_CONDITIONS" && (
        <UserConditionsEditor
          editMode={editMode}
          conditions={userConditions}
          onChange={(uc) => updateForm("user_conditions", uc)}
        />
      )}
    </Modal>
  );
}

function OverviewTab({
  form,
  editMode,
  updateForm,
  ruleTypes,
  severities,
}: {
  form: RuleDetail;
  editMode: boolean;
  updateForm: <K extends keyof RuleDetail>(k: K, v: RuleDetail[K]) => void;
  ruleTypes: RmLookupValue[] | undefined;
  severities: RmLookupValue[] | undefined;
}) {
  if (!editMode) {
    return (
      <div className="text-[13px] leading-relaxed">
        <DetailRow label="Type" value={form.rule_type} />
        <DetailRow label="Severity" value={form.severity} />
        <DetailRow label="Risk score" value={String(form.risk_score)} />
        <DetailRow label="Scope enforcement" value={form.scope_enforcement} />
        <DetailRow label="Status" value={form.status} />
        <DetailRow label="Description" value={form.description ?? "—"} />
        <DetailRow label="Remediation" value={form.remediation_guidance ?? "—"} />
        {form.mitigations.length > 0 && (
          <DetailRow
            label="Mitigations"
            value={form.mitigations.map((m) => m.mitigation_code).join(", ")}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Rule code">
          <input
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={form.rule_code}
            onChange={(e) => updateForm("rule_code", e.target.value)}
          />
        </Field>
        <Field label="Rule name">
          <input
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={form.rule_name ?? ""}
            onChange={(e) => updateForm("rule_name", e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Field label="Type">
          <select
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={form.rule_type}
            onChange={(e) => updateForm("rule_type", e.target.value)}
          >
            {(ruleTypes ?? []).map((t) => (
              <option key={t.value_code} value={t.value_code}>
                {t.value_name}
              </option>
            ))}
            {!(ruleTypes && ruleTypes.length) && <option value="SOD">SOD</option>}
          </select>
        </Field>
        <Field label="Severity">
          <select
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={form.severity}
            onChange={(e) => updateForm("severity", e.target.value)}
          >
            {(severities ?? []).map((t) => (
              <option key={t.value_code} value={t.value_code}>
                {t.value_name}
              </option>
            ))}
            {!(severities && severities.length) && <option value="HIGH">HIGH</option>}
          </select>
        </Field>
        <Field label="Risk score">
          <input
            type="number"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            min={0}
            max={1000}
            value={form.risk_score}
            onChange={(e) => updateForm("risk_score", Number(e.target.value) || 0)}
          />
        </Field>
      </div>
      <Field label="Scope enforcement (data security)">
        <select
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          value={form.scope_enforcement}
          onChange={(e) => updateForm("scope_enforcement", e.target.value)}
        >
          <option value="ALWAYS">ALWAYS — flag even if scopes differ</option>
          <option value="SAME_SCOPE">
            SAME_SCOPE — only when both sides share a scope (recommended)
          </option>
          <option value="GLOBAL_ONLY">GLOBAL_ONLY — only when both sides are unrestricted</option>
        </select>
      </Field>
      <Field label="Description">
        <textarea
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          rows={3}
          value={form.description ?? ""}
          onChange={(e) => updateForm("description", e.target.value)}
        />
      </Field>
      <Field label="Remediation guidance">
        <textarea
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          rows={2}
          value={form.remediation_guidance ?? ""}
          onChange={(e) => updateForm("remediation_guidance", e.target.value)}
        />
      </Field>
      <Field label="Status">
        <select
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          value={form.status}
          onChange={(e) => updateForm("status", e.target.value)}
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-0.5">{label}</label>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-0.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function FunctionSideEditor({
  label,
  side,
  editMode,
  functions,
  allFunctions,
  onChange,
}: {
  label: string;
  side: "A" | "B";
  editMode: boolean;
  functions: RuleFunctionBinding[];
  allFunctions: RuleFunctionBinding[];
  onChange: (fns: RuleFunctionBinding[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("");

  const pickable = useQuery({
    enabled: editMode,
    queryKey: ["fn-search", query, kindFilter],
    queryFn: async () => (await searchFunctions(query || undefined, kindFilter || undefined, 50)).data ?? [],
  });

  const addFunction = (f: FunctionRow) => {
    if (functions.some((x) => x.function_id === f.function_id)) return;
    const newBinding: RuleFunctionBinding = {
      rule_condition_id: 0,
      condition_side: side,
      function_id: f.function_id,
      function_code: f.function_code,
      function_name: f.function_name,
      system_type: f.system_type,
      privileges: [],
    };
    onChange([...allFunctions, newBinding]);
  };
  const removeFunction = (fid: number) =>
    onChange(allFunctions.filter((x) => !(x.condition_side === side && x.function_id === fid)));

  return (
    <div>
      <p className="text-[13px] text-slate-500 mb-2">
        <b>{label}</b> — a user who has access to <b>all of one side</b> <i>and</i> <b>all of the other</b> triggers
        this rule. Each function expands to show its underlying privileges.
      </p>
      {functions.length === 0 && (
        <div className="text-sm text-slate-500 p-4 text-center border border-slate-100 rounded">
          No functions on {label} yet. {editMode && "Search below to add one."}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {functions.map((f) => (
          <FunctionCard
            key={f.function_id}
            fn={f}
            editMode={editMode}
            onRemove={() => removeFunction(f.function_id)}
            kindFilter={kindFilter}
          />
        ))}
      </div>
      {editMode && (
        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-700 mb-1.5">Add a function to {label}</div>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            <span className="inline-flex items-center rounded border border-slate-300 bg-white px-2">
              <Search className="h-3.5 w-3.5 text-slate-500" />
            </span>
            <input
              className="flex-1 min-w-[160px] rounded border border-gray-300 px-2 py-1 text-sm"
              placeholder="Search function by code or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="max-w-[180px] rounded border border-gray-300 px-2 py-1 text-sm"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
            >
              <option value="">All privilege kinds</option>
              <option value="ROLE">Role</option>
              <option value="ACTION">Action / TCode</option>
              <option value="PERMISSION">Permission</option>
              <option value="AUTH_OBJECT">Authorization Object</option>
              <option value="DATA_SECURITY">Data Security</option>
            </select>
          </div>
          <div className="max-h-44 overflow-auto bg-white rounded border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-slate-600">
                  <th className="p-1.5">Code</th>
                  <th className="p-1.5">Name</th>
                  <th className="p-1.5">System</th>
                  <th className="p-1.5">Privileges</th>
                  <th className="p-1.5" />
                </tr>
              </thead>
              <tbody>
                {pickable.data?.map((f) => {
                  const already = functions.some((x) => x.function_id === f.function_id);
                  return (
                    <tr key={f.function_id} className="border-b border-slate-100">
                      <td className="p-1.5 font-semibold">{f.function_code}</td>
                      <td className="p-1.5">{f.function_name}</td>
                      <td className="p-1.5">{f.system_type}</td>
                      <td className="p-1.5 tabular-nums">{f.privilege_count}</td>
                      <td className="p-1.5">
                        <button
                          type="button"
                          className="rounded border border-blue-600 bg-blue-600 px-1.5 py-0.5 text-white text-xs disabled:opacity-50"
                          disabled={already}
                          onClick={() => addFunction(f)}
                        >
                          {already ? "Added" : "Add"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!(pickable.data && pickable.data.length) && (
                  <tr>
                    <td colSpan={5} className="p-2 text-center text-slate-500">
                      No matches
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FunctionCard({
  fn,
  editMode,
  onRemove,
  kindFilter,
}: {
  fn: RuleFunctionBinding;
  editMode: boolean;
  onRemove: () => void;
  kindFilter: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const privs = kindFilter
    ? fn.privileges.filter((p) => p.privilege_kind === kindFilter)
    : fn.privileges;

  return (
    <div className="border border-slate-200 rounded-lg bg-white">
      <button
        type="button"
        className="w-full p-2.5 flex justify-between items-center gap-2 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex gap-2 items-center min-w-0">
          <span className="text-[11px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-900 rounded shrink-0">
            {fn.system_type}
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{fn.function_code}</div>
            <div className="text-xs text-slate-500 truncate">{fn.function_name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500">{fn.privileges.length} privileges</span>
          {editMode && (
            <button
              type="button"
              className="p-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2.5 border-t border-slate-100">
          {privs.length === 0 ? (
            <div className="text-sm text-slate-500 p-2">
              No privileges attached{kindFilter ? ` for kind ${kindFilter}` : ""}.
            </div>
          ) : (
            <table className="w-full text-xs mt-1">
              <thead>
                <tr className="text-left text-slate-600 border-b">
                  <th className="p-1">Privilege</th>
                  <th className="p-1">Kind</th>
                  <th className="p-1">Permission</th>
                </tr>
              </thead>
              <tbody>
                {privs.map((p) => (
                  <PrivilegeRow key={p.privilege_id} p={p} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const DEFAULT_UC_OPERATORS = [
  "EQUALS",
  "NOT_EQUALS",
  "IN",
  "NOT_IN",
  "LIKE",
  "STARTS_WITH",
  "IS_NULL",
  "IS_NOT_NULL",
] as const;

function UserConditionsEditor({
  editMode,
  conditions,
  onChange,
}: {
  editMode: boolean;
  conditions: RuleUserCondition[];
  onChange: (c: RuleUserCondition[]) => void;
}) {
  const attrsQ = useQuery({
    queryKey: ["user-attrs-catalog"],
    queryFn: () => listUserAttributes(),
  });
  const attrs: UserAttributeCatalog[] = attrsQ.data?.data ?? [];
  const operators: string[] =
    attrsQ.data?.operators && attrsQ.data.operators.length
      ? attrsQ.data.operators
      : [...DEFAULT_UC_OPERATORS];

  const addRow = () =>
    onChange([
      ...conditions,
      {
        condition_side: "X",
        logic_op: "AND",
        attribute_name: attrs[0]?.attribute_name ?? "",
        operator: "EQUALS",
        attribute_value: "",
      },
    ]);

  const updateRow = (idx: number, patch: Partial<RuleUserCondition>) =>
    onChange(conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  const removeRow = (idx: number) => onChange(conditions.filter((_, i) => i !== idx));
  const needsValue = (op: string) => op !== "IS_NULL" && op !== "IS_NOT_NULL";

  return (
    <div>
      <p className="text-[13px] text-slate-500 mb-2 flex gap-1 items-start">
        <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        User-attribute conditions: Side <b>A</b> / <b>B</b> or <b>Global (X)</b> scope a condition; logic combines
        rows.
      </p>
      {conditions.length === 0 && (
        <div className="text-sm text-slate-500 p-4 text-center border border-slate-100 rounded mb-2">
          No user conditions. {editMode && "Click “Add condition” to add one."}
        </div>
      )}
      {conditions.map((c, idx) => {
        const attrDef = attrs.find((a) => a.attribute_name === c.attribute_name);
        return (
          <div
            key={idx}
            className="grid gap-2 p-2 mb-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm items-center"
            style={{
              gridTemplateColumns: editMode
                ? "minmax(0,64px) minmax(0,0.6fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,1.2fr) 36px"
                : "minmax(0,64px) minmax(0,0.6fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,1.2fr)",
            }}
          >
            {idx === 0 ? (
              <span className="text-xs text-slate-500">WHERE</span>
            ) : editMode ? (
              <select
                className="rounded border text-xs w-full"
                value={c.logic_op}
                onChange={(e) => updateRow(idx, { logic_op: e.target.value as "AND" | "OR" })}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            ) : (
              <span className="text-xs font-semibold text-slate-600">{c.logic_op}</span>
            )}

            {editMode ? (
              <select
                className="rounded border text-xs w-full"
                value={c.condition_side}
                onChange={(e) => updateRow(idx, { condition_side: e.target.value as "A" | "B" | "X" })}
              >
                <option value="X">Global</option>
                <option value="A">Side A</option>
                <option value="B">Side B</option>
              </select>
            ) : (
              <span className="text-xs">{c.condition_side === "X" ? "Global" : `Side ${c.condition_side}`}</span>
            )}

            {editMode ? (
              <select
                className="rounded border text-xs w-full"
                value={c.attribute_name}
                onChange={(e) => updateRow(idx, { attribute_name: e.target.value })}
              >
                {attrs.map((a) => (
                  <option key={a.attribute_name} value={a.attribute_name}>
                    {a.display_name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs truncate" title={attrDef?.display_name ?? c.attribute_name}>
                {attrDef?.display_name ?? c.attribute_name}
              </span>
            )}

            {editMode ? (
              <select
                className="rounded border text-xs w-full"
                value={c.operator}
                onChange={(e) => updateRow(idx, { operator: e.target.value })}
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {op.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-mono text-[11px]">{c.operator}</span>
            )}

            {editMode ? (
              <input
                className="rounded border text-xs w-full min-w-0"
                placeholder={
                  c.operator === "IN" || c.operator === "NOT_IN"
                    ? "Comma-sep values"
                    : needsValue(c.operator)
                      ? "Value"
                      : "—"
                }
                disabled={!needsValue(c.operator)}
                value={c.attribute_value ?? ""}
                onChange={(e) => updateRow(idx, { attribute_value: e.target.value })}
              />
            ) : (
              <span className="font-mono text-xs">
                {needsValue(c.operator) ? (c.attribute_value ?? "—") : "—"}
              </span>
            )}

            {editMode && (
              <button
                type="button"
                className="p-1 rounded border border-red-200 text-red-700 justify-self-end"
                onClick={() => removeRow(idx)}
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}

      {editMode && (
        <button
          type="button"
          onClick={addRow}
          className="mt-1 inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-sm disabled:opacity-50"
          disabled={!attrs.length}
        >
          <Plus className="h-3 w-3" />
          Add condition
        </button>
      )}
    </div>
  );
}
