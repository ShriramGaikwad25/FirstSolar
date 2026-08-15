"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listFunctionsPaged } from "@/lib/api/rm";
import type { FunctionListRow } from "@/types/rm-functions";
import Badge from "@/components/Badge";
import {
  Pencil,
  Eye,
  Plus,
  Search,
  Boxes,
  Wrench,
} from "lucide-react";
import { FunctionDetailModal } from "./FunctionDetailModal";
import { FUNCTION_SYSTEMS } from "./constants";

export default function FunctionsPageClient() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [systemType, setSystemType] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  const q = useQuery({
    queryKey: ["functions", status, 1, 100],
    queryFn: async () =>
      (await listFunctionsPaged({ status, page: 1, page_size: 100 })).data ?? [],
  });

  const rows = useMemo(() => {
    const raw = q.data ?? [];
    const s = search.trim().toLowerCase();
    return raw.filter((f) => {
      if (systemType && f.system_type !== systemType) return false;
      if (!s) return true;
      const name = (f.function_name ?? "").toLowerCase();
      const code = (f.function_code ?? "").toLowerCase();
      return code.includes(s) || name.includes(s);
    });
  }, [q.data, search, systemType]);

  const [openFnId, setOpenFnId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [creating, setCreating] = useState(false);

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Boxes className="h-6 w-6 text-slate-600 shrink-0" />
          Functions
        </h1>
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditMode(true);
            setOpenFnId(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New function
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="p-3 flex flex-col sm:flex-row flex-wrap gap-2 border-b border-gray-100 items-center">
          <span className="inline-flex items-center text-slate-600">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1 min-w-[200px]"
            placeholder="Search code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-w-[160px]"
            value={systemType}
            onChange={(e) => setSystemType(e.target.value)}
          >
            <option value="">All systems</option>
            {FUNCTION_SYSTEMS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-w-[140px]"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="">All</option>
          </select>
        </div>

        {q.isLoading && <div className="p-4 text-sm text-gray-500">Loading…</div>}
        {q.isError && (
          <div className="p-4 text-sm text-red-600">
            {q.error instanceof Error ? q.error.message : String(q.error)}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-sm text-left">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[26%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[7%]" />
              <col className="w-[10%]" />
              <col className="w-[19%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="py-2.5 px-3 font-medium">Code</th>
                <th className="py-2.5 px-3 font-medium">Name</th>
                <th className="py-2.5 px-3 font-medium">System</th>
                <th className="py-2.5 px-3 font-medium text-center">Privileges</th>
                <th className="py-2.5 px-3 font-medium text-center">Required perms</th>
                <th className="py-2.5 px-3 font-medium text-center">Rules</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f: FunctionListRow) => (
                <tr key={f.function_id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2.5 px-3 font-semibold text-gray-900 truncate">{f.function_code}</td>
                  <td className="py-2.5 px-3 text-gray-800">
                    <div className="truncate">{f.function_name}</div>
                    {f.description && (
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">{f.description}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-[11px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-900 rounded">
                      {f.system_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center tabular-nums">{f.privilege_count}</td>
                  <td className="py-2.5 px-3 text-center text-sm">
                    {f.required_permission_count > 0 ? (
                      <span title="SAP value-level rule expression" className="inline-flex items-center justify-center gap-1">
                        <Wrench className="h-3 w-3 text-amber-700" />
                        {f.required_permission_count}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center tabular-nums">{f.rule_count}</td>
                  <td className="py-2.5 px-3">
                    <Badge
                      label={f.status}
                      color={f.status === "ACTIVE" ? "#16a34a" : "#64748b"}
                    />
                  </td>
                  <td className="py-2.5 pl-3 pr-2 text-right whitespace-nowrap">
                    <div className="inline-flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded border border-gray-200 p-1.5 hover:bg-gray-50"
                        title="View"
                        onClick={() => {
                          setOpenFnId(f.function_id);
                          setEditMode(false);
                          setCreating(false);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded border border-gray-200 p-1.5 hover:bg-gray-50"
                        title="Edit"
                        onClick={() => {
                          setOpenFnId(f.function_id);
                          setEditMode(true);
                          setCreating(false);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && !q.isLoading && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No functions match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(openFnId !== null || creating) && (
        <FunctionDetailModal
          open
          functionId={openFnId}
          creating={creating}
          editMode={editMode}
          onClose={() => {
            setOpenFnId(null);
            setEditMode(false);
            setCreating(false);
          }}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["functions"] });
            setOpenFnId(null);
            setEditMode(false);
            setCreating(false);
          }}
          onToggleEdit={() => setEditMode((e) => !e)}
        />
      )}
    </div>
  );
}
