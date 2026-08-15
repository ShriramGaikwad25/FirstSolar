"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFunctionDetail, upsertFunction, deleteFunction, searchPrivileges } from "@/lib/api/rm";
import type {
  FunctionDetail,
  FunctionPrivilege,
  FunctionRequiredPermission,
  PrivilegeSearchRow,
} from "@/types/rm-functions";
import Modal from "@/components/Modal";
import {
  Pencil,
  Plus,
  X,
  Save,
  Search,
  Trash2,
  KeyRound,
  ShieldAlert,
  MousePointer,
  Lock,
  Database,
  Wrench,
} from "lucide-react";
import { FUNCTION_SYSTEMS } from "./constants";

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

type Tab = "OVERVIEW" | "PRIVILEGES" | "REQUIRED_PERMS" | "USAGE";

type Props = {
  open: boolean;
  functionId: number | null;
  creating: boolean;
  editMode: boolean;
  onClose: () => void;
  onSaved: () => void;
  onToggleEdit: () => void;
};

export function FunctionDetailModal({
  open,
  functionId,
  creating,
  editMode,
  onClose,
  onSaved,
  onToggleEdit,
}: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("OVERVIEW");

  const detailQ = useQuery({
    enabled: functionId !== null && !creating,
    queryKey: ["function-detail", functionId],
    queryFn: async () => {
      const { data } = await getFunctionDetail(functionId!);
      if (!data) throw new Error("Function not found");
      return data;
    },
  });

  const [form, setForm] = useState<FunctionDetail | null>(null);

  useEffect(() => {
    if (creating) return;
    if (detailQ.data) setForm(detailQ.data);
  }, [detailQ.data, creating]);

  useEffect(() => {
    if (creating && functionId === null) {
      setForm({
        function_id: 0,
        function_code: "",
        function_name: "",
        system_type: "GENERIC",
        status: "ACTIVE",
        description: "",
        privileges: [],
        required_permissions: [],
        rules: [],
      });
    }
  }, [creating, functionId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("No form");
      return upsertFunction({
        function_id: form.function_id || null,
        function_code: form.function_code,
        function_name: form.function_name,
        system_type: form.system_type,
        description: form.description,
        status: form.status,
        privileges: form.privileges.map((p) => ({ privilege_id: p.privilege_id })),
        required_permissions: form.required_permissions,
      });
    },
    onSuccess: onSaved,
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!form?.function_id) throw new Error("No function");
      return deleteFunction(form.function_id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["functions"] });
      onClose();
    },
  });

  if (!form) {
    return (
      <Modal open={open} onClose={onClose} extraWide>
        <div className="p-4 text-slate-600">
          {detailQ.isError
            ? (detailQ.error as Error).message
            : detailQ.isLoading
              ? "Loading…"
              : "—"}
        </div>
      </Modal>
    );
  }

  const update = <K extends keyof FunctionDetail>(k: K, v: FunctionDetail[K]) =>
    setForm((prev) => (prev ? { ...prev, [k]: v } : null));

  return (
    <Modal open={open} onClose={onClose} extraWide>
      <div className="flex flex-col gap-1 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <div className="text-xs text-slate-500 font-medium">
              {form.function_id ? `Function #${form.function_id}` : "New function"} · {form.system_type} ·{" "}
              {form.privileges.length} privileges · {form.required_permissions.length} required perms ·{" "}
              {form.rules.length} rules
            </div>
            <h3 className="text-base font-semibold text-gray-900 mt-0.5">
              {form.function_code || "New function"} — {form.function_name || ""}
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {!editMode && functionId !== null && !creating && (
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
                {save.isPending ? "Saving…" : "Save"}
              </button>
            )}
            {editMode && form.function_id > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800 disabled:opacity-50"
                disabled={del.isPending}
                onClick={() => {
                  if (
                    confirm(
                      form.rules.length
                        ? `This function is referenced by ${form.rules.length} rule(s). It will be deactivated instead of deleted. Continue?`
                        : "Delete this function?"
                    )
                  ) {
                    void del.mutate();
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {form.rules.length ? "Deactivate" : "Delete"}
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
        {(save.isError || del.isError) && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            {String((save.error ?? del.error) as Error)}
          </div>
        )}
      </div>

      <nav className="flex flex-wrap gap-0.5 border-b border-slate-200 mb-3">
        {(["OVERVIEW", "PRIVILEGES", "REQUIRED_PERMS", "USAGE"] as Tab[]).map((t) => {
          const label =
            t === "OVERVIEW"
              ? "Overview"
              : t === "PRIVILEGES"
                ? `Privileges (${form.privileges.length})`
                : t === "REQUIRED_PERMS"
                  ? `Required perms (${form.required_permissions.length})`
                  : `Used in rules (${form.rules.length})`;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-2 py-1.5 text-sm -mb-px border-b-2 ${
                tab === t
                  ? "border-blue-600 font-semibold text-blue-600"
                  : "border-transparent text-slate-600"
              }`}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {tab === "OVERVIEW" && <OverviewTab form={form} editMode={editMode} update={update} />}
      {tab === "PRIVILEGES" && (
        <PrivilegesEditor
          editMode={editMode}
          privileges={form.privileges}
          systemType={form.system_type}
          onChange={(ps) => update("privileges", ps)}
        />
      )}
      {tab === "REQUIRED_PERMS" && (
        <RequiredPermsEditor
          editMode={editMode}
          rows={form.required_permissions}
          onChange={(rs) => update("required_permissions", rs)}
        />
      )}
      {tab === "USAGE" && <UsageTab rules={form.rules} />}
    </Modal>
  );
}

function OverviewTab({
  form,
  editMode,
  update,
}: {
  form: FunctionDetail;
  editMode: boolean;
  update: <K extends keyof FunctionDetail>(k: K, v: FunctionDetail[K]) => void;
}) {
  if (!editMode) {
    return (
      <div className="text-[13px] leading-relaxed">
        <FRow label="Code" value={form.function_code} />
        <FRow label="Name" value={form.function_name ?? "—"} />
        <FRow label="System" value={form.system_type} />
        <FRow label="Status" value={form.status} />
        <FRow label="Description" value={form.description ?? "—"} />
        {form.created_at && <FRow label="Created" value={form.created_at} />}
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Function code">
          <input
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={form.function_code}
            onChange={(e) => update("function_code", e.target.value)}
            placeholder="e.g. create_ap_invoice"
          />
        </Field>
        <Field label="Function name">
          <input
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={form.function_name ?? ""}
            onChange={(e) => update("function_name", e.target.value)}
            placeholder="Create AP Invoice"
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="System">
          <select
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={form.system_type}
            onChange={(e) => update("system_type", e.target.value)}
          >
            {FUNCTION_SYSTEMS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </Field>
      </div>
      <Field label="Description">
        <textarea
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          rows={3}
          value={form.description ?? ""}
          onChange={(e) => update("description", e.target.value)}
          placeholder="What does this function represent? (used in rule-author tooltips)"
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-0.5">{label}</label>
      {children}
    </div>
  );
}

function FRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-0.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function PrivilegesEditor({
  editMode,
  privileges,
  systemType,
  onChange,
}: {
  editMode: boolean;
  privileges: FunctionPrivilege[];
  systemType: string;
  onChange: (p: FunctionPrivilege[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [filterSystem, setFilterSystem] = useState("");

  const effectiveSystem = filterSystem || systemType || "GENERIC";

  const pickable = useQuery({
    enabled: editMode,
    queryKey: ["priv-search", effectiveSystem],
    queryFn: async () => (await searchPrivileges(effectiveSystem, 50)).data ?? [],
  });

  const pickableFiltered = useMemo(() => {
    const rows = pickable.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) => {
      const code = (p.privilege_code ?? "").toLowerCase();
      const name = (p.privilege_name ?? "").toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [pickable.data, query]);

  const add = (p: PrivilegeSearchRow) => {
    if (privileges.some((x) => x.privilege_id === p.privilege_id)) return;
    onChange([
      ...privileges,
      {
        privilege_id: p.privilege_id,
        privilege_code: p.privilege_code,
        privilege_name: p.privilege_name,
        system_type: p.system_type,
        privilege_kind: p.privilege_kind ?? "ROLE",
        permission_count: 0,
      },
    ]);
  };
  const remove = (id: number) => onChange(privileges.filter((x) => x.privilege_id !== id));

  return (
    <div>
      <p className="text-[13px] text-slate-500 mb-2">
        <b>Privileges</b> bound to this function. The function is &quot;satisfied&quot; when a user holds
        at least one of these privileges (plus any <b>required permissions</b> on the next tab).
      </p>
      {privileges.length === 0 && (
        <div className="text-sm text-slate-500 p-4 text-center border border-slate-100 rounded">
          No privileges yet. {editMode && "Search below to add one."}
        </div>
      )}
      {privileges.length > 0 && (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs border-collapse min-w-[520px]">
            <thead>
              <tr className="border-b text-left text-slate-600">
                <th className="p-1.5">Code</th>
                <th className="p-1.5">Name</th>
                <th className="p-1.5">System</th>
                <th className="p-1.5">Kind</th>
                <th className="p-1.5">Permissions</th>
                {editMode && <th className="p-1.5 w-10" />}
              </tr>
            </thead>
            <tbody>
              {privileges.map((p) => (
                <tr key={p.privilege_id} className="border-b border-slate-100">
                  <td className="p-1.5 font-semibold">{p.privilege_code}</td>
                  <td className="p-1.5">{p.privilege_name ?? "—"}</td>
                  <td className="p-1.5">{p.system_type}</td>
                  <td className="p-1.5">
                    <KindBadge kind={p.privilege_kind} />
                  </td>
                  <td className="p-1.5 tabular-nums">{p.permission_count}</td>
                  {editMode && (
                    <td className="p-1.5">
                      <button
                        type="button"
                        className="p-1 rounded border border-red-200 text-red-700"
                        onClick={() => remove(p.privilege_id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editMode && (
        <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-700 mb-1.5">
            Add privilege (default filter: {systemType})
          </div>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            <span className="inline-flex items-center rounded border border-slate-300 bg-white px-2">
              <Search className="h-3.5 w-3.5 text-slate-500" />
            </span>
            <input
              className="flex-1 min-w-[160px] rounded border border-gray-300 px-2 py-1 text-sm"
              placeholder="Search privilege code or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="max-w-[160px] rounded border border-gray-300 px-2 py-1 text-sm"
              value={filterSystem}
              onChange={(e) => setFilterSystem(e.target.value)}
            >
              <option value="">System: {systemType}</option>
              {FUNCTION_SYSTEMS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-52 overflow-auto bg-white rounded border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-slate-600 text-left">
                  <th className="p-1.5">Code</th>
                  <th className="p-1.5">Name</th>
                  <th className="p-1.5">System</th>
                  <th className="p-1.5" />
                </tr>
              </thead>
              <tbody>
                {pickableFiltered.map((p) => {
                  const already = privileges.some((x) => x.privilege_id === p.privilege_id);
                  return (
                    <tr key={p.privilege_id} className="border-b border-slate-100">
                      <td className="p-1.5 font-semibold">{p.privilege_code}</td>
                      <td className="p-1.5">{p.privilege_name ?? "—"}</td>
                      <td className="p-1.5">{p.system_type}</td>
                      <td className="p-1.5">
                        <button
                          type="button"
                          className="rounded border border-blue-600 bg-blue-600 px-1.5 py-0.5 text-white text-xs disabled:opacity-50"
                          disabled={already}
                          onClick={() => add(p)}
                        >
                          {already ? "Added" : "Add"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!pickable.isLoading && !pickableFiltered.length && (
                  <tr>
                    <td colSpan={4} className="p-2 text-center text-slate-500">
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

function RequiredPermsEditor({
  editMode,
  rows,
  onChange,
}: {
  editMode: boolean;
  rows: FunctionRequiredPermission[];
  onChange: (r: FunctionRequiredPermission[]) => void;
}) {
  const addRow = () =>
    onChange([
      ...rows,
      {
        object_name: "",
        field_name: "",
        required_value_low: "",
        required_value_high: "",
        sort_order: rows.length,
        description: "",
      },
    ]);
  const updateRow = (idx: number, patch: Partial<FunctionRequiredPermission>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx));

  return (
    <div>
      <p className="text-[13px] text-slate-500 mb-2 flex gap-1 items-start">
        <Wrench className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          <b>Required permissions</b> — value-level rules (e.g. SAP ACTVT). Leave empty for simple
          &quot;any privilege&quot; semantics.
        </span>
      </p>
      {rows.length === 0 && (
        <div className="text-sm text-slate-500 p-4 text-center border border-slate-100 rounded mb-2">
          No required permissions. {editMode && "Click “Add row” to define one."}
        </div>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="border-b text-left text-slate-600">
                <th className="p-1.5 w-40">Object</th>
                <th className="p-1.5 w-28">Field</th>
                <th className="p-1.5 w-24">Value low</th>
                <th className="p-1.5 w-24">Value high</th>
                <th className="p-1.5">Note</th>
                {editMode && <th className="p-1.5 w-10" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) =>
                editMode ? (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="p-1">
                      <input
                        className="w-full rounded border border-gray-300 px-1 text-xs"
                        value={r.object_name}
                        onChange={(e) => updateRow(idx, { object_name: e.target.value })}
                        placeholder="F_BKPF_BUK"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full rounded border border-gray-300 px-1 text-xs"
                        value={r.field_name}
                        onChange={(e) => updateRow(idx, { field_name: e.target.value })}
                        placeholder="ACTVT"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full rounded border border-gray-300 px-1 text-xs"
                        value={r.required_value_low}
                        onChange={(e) => updateRow(idx, { required_value_low: e.target.value })}
                        placeholder="01"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full rounded border border-gray-300 px-1 text-xs"
                        value={r.required_value_high ?? ""}
                        onChange={(e) => updateRow(idx, { required_value_high: e.target.value })}
                        placeholder="(empty = same as low)"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full rounded border border-gray-300 px-1 text-xs"
                        value={r.description ?? ""}
                        onChange={(e) => updateRow(idx, { description: e.target.value })}
                        placeholder="Create"
                      />
                    </td>
                    <td className="p-1">
                      <button
                        type="button"
                        className="p-1 rounded border border-red-200 text-red-700"
                        onClick={() => removeRow(idx)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="p-1.5 font-mono">{r.object_name}</td>
                    <td className="p-1.5 font-mono">{r.field_name}</td>
                    <td className="p-1.5 font-mono">{r.required_value_low}</td>
                    <td className="p-1.5 font-mono">{r.required_value_high ?? "—"}</td>
                    <td className="p-1.5">{r.description ?? "—"}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
      {editMode && (
        <button
          type="button"
          onClick={addRow}
          className="mt-2 inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-sm"
        >
          <Plus className="h-3 w-3" />
          Add row
        </button>
      )}
    </div>
  );
}

function UsageTab({ rules }: { rules: FunctionDetail["rules"] }) {
  const bySide = useMemo(() => {
    const a = rules.filter((r) => r.condition_side === "A");
    const b = rules.filter((r) => r.condition_side === "B");
    return { a, b };
  }, [rules]);

  if (!rules.length) {
    return <div className="text-sm text-slate-500 p-4 text-center">Not referenced by any rule yet.</div>;
  }
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-slate-500">
        This function is bound to <b>{rules.length}</b> rule(s). Editing privileges here affects those
        rules.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="font-semibold text-sm mb-1.5">Side A ({bySide.a.length})</div>
          {bySide.a.map((r) => (
            <div key={r.rule_id} className="py-1.5 border-b border-slate-100 text-sm">
              <b>{r.rule_code}</b> <span className="text-slate-500">· rule #{r.rule_id}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="font-semibold text-sm mb-1.5">Side B ({bySide.b.length})</div>
          {bySide.b.map((r) => (
            <div key={r.rule_id} className="py-1.5 border-b border-slate-100 text-sm">
              <b>{r.rule_code}</b> <span className="text-slate-500">· rule #{r.rule_id}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
