"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  type ConditionRule,
  fetchConditionRulesFromApi,
  formatConditionRuleDate,
  getConditionFieldPillStyle,
  type UpdateConditionRulePayload,
  updateConditionRule,
} from "../condition-rules-shared";

type FieldRow = { id: number; value: string };

function reorder<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

function buildFieldRows(fields: string[], idRef: { current: number }): FieldRow[] {
  idRef.current = 0;
  if (fields.length === 0) {
    return [{ id: idRef.current++, value: "" }];
  }
  return fields.map((value) => ({ id: idRef.current++, value }));
}

export default function LookupCustomApproverRuleDetailPage() {
  const params = useParams<{ id: string }>();
  const idParam = params?.id;
  const ruleId =
    typeof idParam === "string" ? parseInt(idParam, 10) : Number.NaN;

  const [rule, setRule] = useState<ConditionRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fieldIdRef = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState(0);
  const [editSeparator, setEditSeparator] = useState("|");
  const [editFieldRows, setEditFieldRows] = useState<FieldRow[]>([]);

  const loadRule = useCallback(async () => {
    if (!Number.isFinite(ruleId)) return;
    const { rules } = await fetchConditionRulesFromApi();
    const found = rules.find((r) => r.id === ruleId) ?? null;
    setRule(found);
    if (!found) {
      setError(`No rule found with id ${ruleId}.`);
    }
  }, [ruleId]);

  useEffect(() => {
    if (!Number.isFinite(ruleId)) {
      setLoading(false);
      setError("Invalid rule id");
      setRule(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchConditionRulesFromApi()
      .then(({ rules }) => {
        if (cancelled) return;
        const found = rules.find((r) => r.id === ruleId) ?? null;
        if (!found) {
          setError(`No rule found with id ${ruleId}.`);
          setRule(null);
        } else {
          setRule(found);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load rule",
          );
          setRule(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ruleId]);

  const beginEdit = useCallback(() => {
    if (!rule) return;
    setEditError(null);
    setEditName(rule.name);
    setEditDescription(rule.description ?? "");
    setEditPriority(rule.priority);
    setEditSeparator(rule.condition?.separator ?? "|");
    setEditFieldRows(
      buildFieldRows(rule.condition?.fields ?? [], fieldIdRef),
    );
    setIsEditing(true);
  }, [rule]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditError(null);
  }, []);

  const setFieldValue = useCallback((id: number, value: string) => {
    setEditFieldRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, value } : row)),
    );
  }, []);

  const addFieldRow = useCallback(() => {
    setEditFieldRows((prev) => [
      ...prev,
      { id: fieldIdRef.current++, value: "" },
    ]);
  }, []);

  const removeFieldRow = useCallback((id: number) => {
    setEditFieldRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((row) => row.id !== id),
    );
  }, []);

  const moveField = useCallback((index: number, delta: -1 | 1) => {
    setEditFieldRows((prev) => reorder(prev, index, index + delta));
  }, []);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rule) return;
    setEditError(null);

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError("Name is required.");
      return;
    }

    const fields = editFieldRows.map((r) => r.value.trim()).filter(Boolean);
    if (fields.length === 0) {
      setEditError("Add at least one condition field.");
      return;
    }

    const sep = editSeparator.trim() || "|";
    const payload: UpdateConditionRulePayload = {
      id: rule.id,
      name: trimmedName,
      description: editDescription.trim(),
      condition: {
        fields,
        separator: sep,
        nullHandling: rule.condition?.nullHandling ?? "empty",
        placeholder: rule.condition?.placeholder ?? null,
        caseTransform: rule.condition?.caseTransform ?? "none",
      },
      priority: Number.isFinite(editPriority) ? Math.trunc(editPriority) : 0,
      isActive: rule.isActive,
      mappings: rule.mappings ?? [],
    };

    setIsSaving(true);
    try {
      await updateConditionRule(rule.id, payload);
      await loadRule();
      setIsEditing(false);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Failed to save rule.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full w-full p-4">
      <div className="w-full min-w-0 max-w-none">
        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            Loading rule…
          </div>
        )}

        {!loading && error && (
          <div
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Could not load this rule</p>
              <p className="mt-1 text-red-700">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && rule && !isEditing && (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold leading-tight text-gray-900">
                  {rule.name}
                </h1>
                <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">
                  {rule.description || "—"}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-gray-500">Priority</dt>
                    <dd className="text-gray-900">{rule.priority}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Status</dt>
                    <dd>
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                          rule.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {rule.isActive ? "Active" : "Inactive"}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Last updated</dt>
                    <dd className="text-gray-900">
                      {formatConditionRuleDate(rule.updatedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Created</dt>
                    <dd className="text-gray-900">
                      {formatConditionRuleDate(rule.createdAt)}
                    </dd>
                  </div>
                </dl>
              </div>
              <button
                type="button"
                onClick={beginEdit}
                className="shrink-0 rounded-lg border border-gray-200 bg-white p-2 text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                aria-label="Edit rule"
              >
                <Pencil className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">
                Condition
              </h2>
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <th className="w-36 py-1.5 pr-3 align-top text-xs font-medium text-gray-500">
                      Fields
                    </th>
                    <td className="py-1.5 align-top text-gray-900">
                      {(rule.condition?.fields ?? []).length === 0 ? (
                        <span className="text-sm text-gray-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(rule.condition?.fields ?? []).map((field, idx) => {
                            const { Icon, pill, icon } =
                              getConditionFieldPillStyle(field, idx);
                            return (
                              <span
                                key={`${field}-${idx}`}
                                className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${pill}`}
                              >
                                <Icon
                                  className={`h-4 w-4 shrink-0 ${icon}`}
                                  strokeWidth={2}
                                />
                                <span className="min-w-0 break-all font-mono">
                                  {field}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-1.5 pr-3 align-top text-xs font-medium text-gray-500">
                      Separator
                    </th>
                    <td className="py-1.5 text-gray-900">
                      {rule.condition?.separator ?? "—"}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-1.5 pr-3 align-top text-xs font-medium text-gray-500">
                      Null handling
                    </th>
                    <td className="py-1.5 text-gray-900">
                      {rule.condition?.nullHandling ?? "—"}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-1.5 pr-3 align-top text-xs font-medium text-gray-500">
                      Case transform
                    </th>
                    <td className="py-1.5 text-gray-900">
                      {rule.condition?.caseTransform ?? "—"}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-1.5 pr-3 align-top text-xs font-medium text-gray-500">
                      Placeholder
                    </th>
                    <td className="py-1.5 font-mono text-xs text-gray-900">
                      {rule.condition?.placeholder ?? "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold text-gray-900">
                Mappings ({rule.mappings?.length ?? 0})
              </h2>
              {(rule.mappings?.length ?? 0) === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-sm italic text-gray-500">
                  No mappings for this rule.
                </p>
              ) : (
                <ul className="m-0 list-none space-y-2 p-0">
                  {rule.mappings.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                    >
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                            Condition value
                          </p>
                          <p className="break-all font-mono text-sm text-gray-900">
                            {m.conditionValue}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                            Approver
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            {m.approverName}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                            Reviewer
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            {m.reviewerName}
                          </p>
                        </div>
                        <div className="flex min-w-0 items-end lg:items-start lg:justify-end">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              m.isActive
                                ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20"
                                : "bg-gray-100 text-gray-600 ring-1 ring-gray-200"
                            }`}
                          >
                            {m.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {!loading && !error && rule && isEditing && (
          <form
            ref={formRef}
            onSubmit={handleSaveEdit}
            className="flex flex-col gap-3"
            noValidate
          >
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Edit condition rule
              </h1>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                  aria-label="Cancel editing"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => formRef.current?.requestSubmit()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>

            {editError && (
              <div
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {editError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
              <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Rule
                </h2>
                <div className="mt-2 space-y-2.5">
                  <div>
                    <label
                      htmlFor="edit-rule-name"
                      className="block text-xs font-medium text-gray-600"
                    >
                      Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="edit-rule-name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mt-0.5 w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoComplete="off"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-rule-description"
                      className="block text-xs font-medium text-gray-600"
                    >
                      Description
                    </label>
                    <textarea
                      id="edit-rule-description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      className="mt-0.5 w-full resize-y rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="w-28">
                    <label
                      htmlFor="edit-rule-priority"
                      className="block text-xs font-medium text-gray-600"
                    >
                      Priority
                    </label>
                    <input
                      id="edit-rule-priority"
                      type="number"
                      value={editPriority}
                      onChange={(e) =>
                        setEditPriority(parseInt(e.target.value, 10) || 0)
                      }
                      min={0}
                      className="mt-0.5 w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Condition
                    </h2>
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                      <div>
                        <label
                          htmlFor="edit-condition-separator"
                          className="block text-xs font-medium text-gray-600"
                        >
                          Separator
                        </label>
                        <input
                          id="edit-condition-separator"
                          type="text"
                          value={editSeparator}
                          onChange={(e) => setEditSeparator(e.target.value)}
                          maxLength={8}
                          className="mt-0.5 w-16 rounded-md border border-gray-200 px-2 py-1.5 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addFieldRow}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    Add field
                  </button>
                </div>

                <p className="mt-2 text-sm font-medium text-gray-600">
                  Condition fields <span className="text-red-600">*</span>
                </p>
                <ul className="mt-2 max-h-[min(240px,42vh)] list-none space-y-1.5 overflow-y-auto overscroll-contain p-0">
                  {editFieldRows.map((row, index) => (
                    <li
                      key={row.id}
                      className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50/90 py-1.5 pl-1.5 pr-1"
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white text-xs font-medium text-gray-500 tabular-nums ring-1 ring-gray-200"
                        aria-hidden
                      >
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={row.value}
                        onChange={(e) => setFieldValue(row.id, e.target.value)}
                        className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2.5 py-1.5 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        aria-label={`Condition field ${index + 1}`}
                        autoComplete="off"
                      />
                      <div className="flex shrink-0 items-center">
                        <button
                          type="button"
                          onClick={() => moveField(index, -1)}
                          disabled={index === 0}
                          className="rounded p-1.5 text-gray-600 hover:bg-white disabled:pointer-events-none disabled:opacity-30"
                          aria-label={`Move field ${index + 1} up`}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(index, 1)}
                          disabled={index === editFieldRows.length - 1}
                          className="rounded p-1.5 text-gray-600 hover:bg-white disabled:pointer-events-none disabled:opacity-30"
                          aria-label={`Move field ${index + 1} down`}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFieldRow(row.id)}
                          disabled={editFieldRows.length <= 1}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-30"
                          aria-label={`Remove field ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-gray-500">
                  Null handling, case transform, and placeholder are unchanged on
                  save. Mappings are not edited here.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3">
              <h2 className="mb-1 text-xs font-semibold text-gray-700">
                Mappings ({rule.mappings?.length ?? 0}) — read only
              </h2>
              {(rule.mappings?.length ?? 0) === 0 ? (
                <p className="text-xs text-gray-500">No mappings.</p>
              ) : (
                <p className="text-xs text-gray-500">
                  Existing mappings are kept when you save.
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
