"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listViolations } from "@/lib/api/rm";
import type { ListViolationsParams, Violation } from "@/types/rm-violations";
import { useLookup } from "@/hooks/useLookup";
import Badge from "@/components/Badge";
import { ShieldAlert } from "lucide-react";

const defaultFilters: ListViolationsParams = {
  status: "OPEN",
  page: 1,
  page_size: 25,
  sort_by: "severity",
  sort_dir: "desc",
  locale: "en",
};

function matchesClientFilters(v: Violation, f: ListViolationsParams): boolean {
  const s = (f.search ?? "").trim().toLowerCase();
  if (s) {
    const blob = [v.username, v.user_name ?? "", v.rule_code, v.rule_name ?? ""].join(" ").toLowerCase();
    if (!blob.includes(s)) return false;
  }
  if (f.severity) {
    if (v.severity !== f.severity && v.severity_name !== f.severity) return false;
  }
  if (f.rule_type) {
    if (v.rule_type !== f.rule_type && v.rule_type_name !== f.rule_type) return false;
  }
  if (f.system_type) {
    const top = (v as unknown as { system_type?: string | null }).system_type;
    const inDetails = v.details?.some((d) => d.system_type === f.system_type);
    if (top !== f.system_type && !inDetails) return false;
  }
  if (f.scope_type) {
    if (!v.details?.some((d) => d.scope_type === f.scope_type)) return false;
  }
  return true;
}

export default function ViolationsPageClient() {
  const [filters, setFilters] = useState<ListViolationsParams>(defaultFilters);

  const severities = useLookup("RULE_SEVERITY");
  const statuses = useLookup("VIOLATION_STATUS");
  const ruleTypes = useLookup("RULE_TYPE");
  const systems = useLookup("SYSTEM_TYPE");
  const scopes = useLookup("SCOPE_TYPE");

  const serverQueryKey = [
    "violations",
    "v2",
    filters.status,
    filters.sort_by,
    filters.sort_dir,
    filters.page,
    filters.page_size,
    filters.locale ?? "en",
  ] as const;

  const q = useQuery({
    queryKey: serverQueryKey,
    queryFn: async () =>
      listViolations({
        status: filters.status,
        page: filters.page,
        page_size: filters.page_size,
        sort_by: filters.sort_by,
        sort_dir: filters.sort_dir,
        locale: filters.locale ?? "en",
      }),
  });

  const rows = useMemo(() => {
    const raw = q.data?.data ?? [];
    return raw.filter((v) => matchesClientFilters(v, filters));
  }, [q.data?.data, filters]);

  const pag = q.data?.pagination;
  const totalPages = useMemo(
    () => (pag && pag.page_size > 0 ? Math.ceil(pag.total / pag.page_size) : 1),
    [pag]
  );

  const hasClientOnlyFilters = Boolean(
    (filters.search ?? "").trim() ||
      filters.severity ||
      filters.rule_type ||
      filters.system_type ||
      filters.scope_type
  );

  const setF = <K extends keyof ListViolationsParams>(k: K, v: ListViolationsParams[K]) => {
    setFilters((p) => ({
      ...p,
      [k]: (v === "" || v == null ? null : v) as ListViolationsParams[K],
      page: 1,
    }));
  };

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0" />
          Violations
        </h1>
        <div className="text-sm text-slate-600">
          {hasClientOnlyFilters ? (
            <>
              {rows.length} shown
              <span className="text-slate-400"> · {pag?.total ?? 0} from server</span>
            </>
          ) : (
            <>{pag?.total ?? 0} results</>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="p-3 flex flex-col xl:flex-row flex-wrap gap-2 border-b border-gray-100">
          <input
            className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1 min-w-[200px]"
            placeholder="Search user / rule…"
            value={filters.search ?? ""}
            onChange={(e) => setF("search", e.target.value || null)}
          />
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-w-[160px]"
            value={filters.status ?? ""}
            onChange={(e) => setF("status", e.target.value || null)}
          >
            <option value="">Any status</option>
            {statuses.data?.map((v) => (
              <option key={v.value_code} value={v.value_code}>
                {v.value_name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-w-[160px]"
            value={filters.severity ?? ""}
            onChange={(e) => setF("severity", e.target.value || null)}
          >
            <option value="">Any severity</option>
            {severities.data?.map((v) => (
              <option key={v.value_code} value={v.value_code}>
                {v.value_name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-w-[160px]"
            value={filters.rule_type ?? ""}
            onChange={(e) => setF("rule_type", e.target.value || null)}
          >
            <option value="">Any rule type</option>
            {ruleTypes.data?.map((v) => (
              <option key={v.value_code} value={v.value_code}>
                {v.value_name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-w-[160px]"
            value={filters.system_type ?? ""}
            onChange={(e) => setF("system_type", e.target.value || null)}
          >
            <option value="">Any ERP</option>
            {systems.data?.map((v) => (
              <option key={v.value_code} value={v.value_code}>
                {v.value_name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-w-[160px]"
            value={filters.scope_type ?? ""}
            onChange={(e) => setF("scope_type", e.target.value || null)}
          >
            <option value="">Any scope</option>
            {scopes.data?.map((v) => (
              <option key={v.value_code} value={v.value_code}>
                {v.value_name}
              </option>
            ))}
          </select>
        </div>

        {q.isLoading && <div className="p-4 text-sm text-slate-500">Loading…</div>}
        {q.isError && (
          <div className="p-4 text-sm text-red-600">
            {q.error instanceof Error ? q.error.message : String(q.error)}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-sm text-left">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[28%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="py-2.5 px-3 font-medium">User</th>
                <th className="py-2.5 px-3 font-medium">Rule</th>
                <th className="py-2.5 px-3 font-medium">Type</th>
                <th className="py-2.5 px-3 font-medium">Severity</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium">Detail</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">Detected</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.violation_id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-gray-900">{v.user_name || v.username}</div>
                    <div className="text-xs text-slate-500">{v.username}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-gray-900">{v.rule_code}</div>
                    {v.rule_name && <div className="text-xs text-slate-500">{v.rule_name}</div>}
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge label={v.rule_type_name ?? v.rule_type} />
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge
                      label={v.severity_name ?? v.severity}
                      color={v.severity_color ?? "#64748b"}
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge
                      label={v.status_name ?? v.violation_status}
                      color={v.status_color ?? "#64748b"}
                    />
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">
                    {v.details?.map((d, i) => (
                      <div key={i} className="mb-0.5 last:mb-0 truncate">
                        {d.system_type ? `[${d.system_type}] ` : ""}
                        {d.function_code}
                        {d.scope_name ? ` @ ${d.scope_type}:${d.scope_name}` : ""}
                      </div>
                    ))}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                    {v.created_at
                      ? (() => {
                          const t = new Date(v.created_at);
                          return Number.isNaN(t.getTime()) ? "—" : t.toLocaleDateString();
                        })()
                      : "—"}
                  </td>
                </tr>
              ))}
              {!q.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No violations match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pag && totalPages > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 border-t border-gray-100 text-sm text-slate-700">
            <span>
              Page {pag.page} of {totalPages}
            </span>
            <button
              type="button"
              className="rounded border border-gray-200 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
              disabled={!filters.page || filters.page <= 1}
              onClick={() => setFilters((p) => ({ ...p, page: Math.max(1, (p.page ?? 1) - 1) }))}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded border border-gray-200 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
              disabled={!filters.page || !totalPages || filters.page >= totalPages}
              onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
