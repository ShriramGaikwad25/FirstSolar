"use client";

import React, { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { createConditionRule } from "../condition-rules-shared";

const listHref = "/settings/gateway/lookup-custom-approvers";

type FieldRow = { id: number; value: string };

function reorder<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

export default function LookupCustomApproverNewRulePage() {
  const router = useRouter();
  const fieldIdRef = useRef(2);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<number>(5);
  const [separator, setSeparator] = useState("|");
  const [fieldRows, setFieldRows] = useState<FieldRow[]>([
    { id: 0, value: "" },
    { id: 1, value: "" },
  ]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setFieldValue = useCallback((id: number, value: string) => {
    setFieldRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, value } : row)),
    );
  }, []);

  const addFieldRow = useCallback(() => {
    setFieldRows((prev) => [
      ...prev,
      { id: fieldIdRef.current++, value: "" },
    ]);
  }, []);

  const removeFieldRow = useCallback((id: number) => {
    setFieldRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((row) => row.id !== id),
    );
  }, []);

  const moveField = useCallback((index: number, delta: -1 | 1) => {
    setFieldRows((prev) => reorder(prev, index, index + delta));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setSubmitError("Name is required.");
      return;
    }

    const fields = fieldRows.map((r) => r.value.trim()).filter(Boolean);
    if (fields.length === 0) {
      setSubmitError("Add at least one condition field.");
      return;
    }

    const sep = separator.trim() || "|";
    const payload = {
      name: trimmedName,
      description: description.trim(),
      condition: {
        fields,
        separator: sep,
      },
      priority: Number.isFinite(priority) ? Math.trunc(priority) : 0,
      mappings: [],
    };

    setIsSubmitting(true);
    try {
      await createConditionRule(payload);
      router.push(listHref);
      router.refresh();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create rule.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden p-4">
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col gap-3"
        noValidate
      >
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight text-gray-900">
              New condition rule
            </h1>
            <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">
              Field order defines the condition key; separated by the separator
              below.
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-end sm:pt-0.5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create rule"
              )}
            </button>
          </div>
        </div>

        {submitError && (
          <div
            className="shrink-0 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {submitError}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Rule
            </h2>
            <div className="mt-2 space-y-2.5">
              <div>
                <label
                  htmlFor="rule-name"
                  className="block text-xs font-medium text-gray-600"
                >
                  Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="rule-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="rule-description"
                  className="block text-xs font-medium text-gray-600"
                >
                  Description
                </label>
                <textarea
                  id="rule-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-0.5 w-full resize-y rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="w-28">
                <label
                  htmlFor="rule-priority"
                  className="block text-xs font-medium text-gray-600"
                >
                  Priority
                </label>
                <input
                  id="rule-priority"
                  type="number"
                  value={priority}
                  onChange={(e) =>
                    setPriority(parseInt(e.target.value, 10) || 0)
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
                      htmlFor="condition-separator"
                      className="block text-xs font-medium text-gray-600"
                    >
                      Separator
                    </label>
                    <input
                      id="condition-separator"
                      type="text"
                      value={separator}
                      onChange={(e) => setSeparator(e.target.value)}
                      maxLength={8}
                      className="mt-0.5 w-16 rounded-md border border-gray-200 px-2 py-1.5 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              {fieldRows.map((row, index) => (
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
                      disabled={index === fieldRows.length - 1}
                      className="rounded p-1.5 text-gray-600 hover:bg-white disabled:pointer-events-none disabled:opacity-30"
                      aria-label={`Move field ${index + 1} down`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFieldRow(row.id)}
                      disabled={fieldRows.length <= 1}
                      className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-30"
                      aria-label={`Remove field ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </form>
    </div>
  );
}
