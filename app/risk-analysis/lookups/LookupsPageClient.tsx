"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listLookupTypes,
  listLookupValues,
  upsertLookupValue,
  deleteLookupValue,
} from "@/lib/api/rm";
import type { Lookup, LookupType, UpsertLookupValueInput } from "@/types/rm-lookups";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import { Plus, Trash2, Edit3, ScanSearch } from "lucide-react";

type EditState = (Partial<Lookup> & { type_code: string }) | null;

export default function LookupsPageClient() {
  const qc = useQueryClient();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState>(null);

  const types = useQuery({
    queryKey: ["lookup-types"],
    queryFn: async () => (await listLookupTypes()).data ?? [],
  });

  const values = useQuery({
    enabled: selectedType != null,
    queryKey: ["lookup", selectedType],
    queryFn: async () => (await listLookupValues(selectedType!)).data ?? [],
  });

  useEffect(() => {
    if (selectedType != null) return;
    const list = types.data;
    if (list && list.length > 0) {
      setSelectedType(list[0].type_code);
    }
  }, [selectedType, types.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (editing == null || selectedType == null) return;
      const payload: UpsertLookupValueInput = {
        type_code: selectedType,
        value_code: editing.value_code ?? "",
        value_name: editing.value_name ?? "",
        description: editing.description,
        sort_order: editing.sort_order,
        numeric_meta: editing.numeric_meta ?? null,
        color_hex: editing.color_hex,
        icon: editing.icon,
        attributes: (editing as { attributes?: Record<string, unknown> }).attributes ?? {},
        is_default: editing.is_default,
      };
      if (editing.lookup_value_id != null && editing.lookup_value_id > 0) {
        payload.lookup_value_id = editing.lookup_value_id;
      }
      return upsertLookupValue(payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lookup-types"] });
      void qc.invalidateQueries({ queryKey: ["lookup", selectedType] });
      setEditing(null);
    },
  });

  const del = useMutation({
    mutationFn: async (id: number) => deleteLookupValue(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lookup-types"] });
      void qc.invalidateQueries({ queryKey: ["lookup", selectedType] });
    },
  });

  const typeRow: LookupType | undefined = types.data?.find((t) => t.type_code === selectedType);

  return (
    <div className="w-full min-w-0">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ScanSearch className="h-6 w-6 text-indigo-600 shrink-0" />
          Lookups
        </h1>
        {typeRow?.allow_user_add && (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            onClick={() =>
              setEditing({ sort_order: 100, is_default: false, type_code: selectedType! })
            }
          >
            <Plus className="h-4 w-4 shrink-0" />
            New value
          </button>
        )}
      </div>

      {types.isLoading && <div className="text-sm text-slate-500">Loading types…</div>}
      {types.isError && (
        <div className="text-sm text-red-600">
          {types.error instanceof Error ? types.error.message : String(types.error)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          {types.data?.map((t) => (
            <button
              key={t.type_code}
              type="button"
              onClick={() => setSelectedType(t.type_code)}
              className={`mb-1 flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                selectedType === t.type_code
                  ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                  : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
              }`}
            >
              <span>{t.type_name}</span>
              <span className="text-xs text-slate-500">
                {t.value_count != null ? t.value_count : "—"}
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          {typeRow && (
            <div className="border-b border-gray-100 p-4">
              <h2 className="text-lg font-semibold text-gray-900">{typeRow.type_name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span>
                  Code: <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{typeRow.type_code}</code>
                </span>
                {typeRow.is_system && <Badge label="System" color="#6366f1" />}
                {!typeRow.allow_user_add && <Badge label="Fixed list" color="#64748b" />}
              </div>
              {typeRow.description && (
                <p className="mt-2 text-sm text-slate-600">{typeRow.description}</p>
              )}
            </div>
          )}

          {values.isLoading && <div className="p-4 text-sm text-slate-500">Loading values…</div>}
          {values.isError && (
            <div className="p-4 text-sm text-red-600">
              {values.error instanceof Error ? values.error.message : String(values.error)}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed border-collapse text-sm text-left">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[26%]" />
                <col className="w-[8%]" />
                <col className="w-[10%]" />
                <col className="w-[18%]" />
                <col className="w-[8%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                  <th className="py-2.5 px-3 font-medium">Code</th>
                  <th className="py-2.5 px-3 font-medium">Name</th>
                  <th className="py-2.5 px-3 font-medium text-center">Sort</th>
                  <th className="py-2.5 px-3 font-medium text-center">Weight</th>
                  <th className="py-2.5 px-3 font-medium">Color</th>
                  <th className="py-2.5 px-3 font-medium text-center">Default</th>
                  <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {values.data?.map((v) => (
                  <tr key={v.lookup_value_id || v.value_code} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 px-3 truncate">
                      <code className="text-xs text-gray-800">{v.value_code}</code>
                    </td>
                    <td className="py-2.5 px-3 text-gray-800 truncate">{v.value_name}</td>
                    <td className="py-2.5 px-3 text-center tabular-nums">{v.sort_order ?? "—"}</td>
                    <td className="py-2.5 px-3 text-center tabular-nums">{v.numeric_meta ?? "—"}</td>
                    <td className="py-2.5 px-3 truncate">
                      {v.color_hex && (
                        <span className="inline-flex items-center gap-1.5 max-w-full">
                          <span
                            className="h-3.5 w-3.5 rounded border border-gray-200 shrink-0"
                            style={{ background: v.color_hex }}
                          />
                          <code className="text-xs truncate">{v.color_hex}</code>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">{v.is_default ? "✓" : ""}</td>
                    <td className="py-2.5 pl-3 pr-2 text-right whitespace-nowrap">
                      {typeRow?.allow_user_edit && !v.is_system && (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded border border-gray-200 bg-white p-1.5 text-gray-700 hover:bg-gray-50"
                            onClick={() => setEditing({ ...v, type_code: selectedType! })}
                            title="Edit"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          {v.lookup_value_id > 0 && (
                            <button
                              type="button"
                              className="rounded border border-red-200 bg-white p-1.5 text-red-700 hover:bg-red-50"
                              onClick={() => del.mutate(v.lookup_value_id)}
                              title="Delete"
                              disabled={del.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                      {v.is_system && <span className="text-xs text-slate-400">Protected</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={editing != null}
        title="Lookup value"
        wide
        onClose={() => setEditing(null)}
        footer={
          <>
            <button
              type="button"
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              Save
            </button>
          </>
        }
      >
        {editing != null && (
          <div className="space-y-3 text-sm max-h-[min(70vh,520px)] overflow-y-auto pr-1">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Code</label>
              <input
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5"
                value={editing.value_code ?? ""}
                onChange={(e) => setEditing({ ...editing, value_code: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Name</label>
              <input
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5"
                value={editing.value_name ?? ""}
                onChange={(e) => setEditing({ ...editing, value_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Sort order</label>
              <input
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5"
                type="number"
                value={editing.sort_order ?? 100}
                onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Numeric weight (e.g. severity)
              </label>
              <input
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5"
                type="number"
                value={editing.numeric_meta ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    numeric_meta: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Color hex</label>
              <input
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5"
                value={editing.color_hex ?? ""}
                onChange={(e) => setEditing({ ...editing, color_hex: e.target.value })}
                placeholder="#dc2626"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Description</label>
              <textarea
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5"
                rows={2}
                value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <div>
              <label className="inline-flex items-center gap-2 text-gray-800">
                <input
                  type="checkbox"
                  checked={editing.is_default ?? false}
                  onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })}
                />
                Default value
              </label>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
