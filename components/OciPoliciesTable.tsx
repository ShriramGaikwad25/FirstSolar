"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Eye, Search, X } from "lucide-react";
import {
  EMPTY_POLICY_LIST_FILTERS,
  hasActivePolicyListFilters,
} from "@/lib/oci-policy-list-filters";
import { PolicyDateRangeFilter } from "@/components/PolicyDateRangeFilter";
import type { PolicyListFilters, PolicyListItem } from "@/types/oci-policy";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const FILTER_FIELD = "flex min-w-0 flex-col gap-1 text-sm text-gray-700";
const FILTER_LABEL = "text-xs font-medium uppercase text-gray-500";
const FILTER_CONTROL =
  "h-[38px] w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";

const TH =
  "whitespace-nowrap px-3 py-3.5 text-left text-[11px] font-semibold text-blue-800 uppercase tracking-wide align-middle bg-blue-50/80 border-b border-blue-100";
const TH_CENTER = `${TH} text-center`;
const TH_ACTION = `${TH} text-right`;
const TD = "px-3 py-3 align-top text-sm leading-snug text-gray-800 bg-white";
const TD_CENTER = `${TD} text-center`;
const TD_ACTION = "px-3 py-3 align-top text-right text-sm bg-white";

export type { PolicyListFilters };
export { EMPTY_POLICY_LIST_FILTERS };

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function riskClass(risk: string): string {
  if (risk === "High") return "text-red-700";
  if (risk === "Medium") return "text-yellow-600";
  return "text-green-700";
}

function statusClass(status: string): string {
  const lower = status.toLowerCase();
  if (lower === "active") return "bg-green-100 text-green-800";
  if (lower === "inactive") return "bg-gray-100 text-gray-700";
  if (lower === "deleted") return "bg-red-100 text-red-800";
  return "bg-blue-100 text-blue-800";
}

function policyWorkspaceHref(policyName: string): string {
  return `/oci-policy-analysis/policies/${encodeURIComponent(policyName)}`;
}

export function OciPoliciesTable({
  policies,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  searchQuery,
  onSearchQueryChange,
  filters,
  onFiltersChange,
  statusOptions,
  compartmentOptions,
}: {
  policies: PolicyListItem[];
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  filters: PolicyListFilters;
  onFiltersChange: (filters: PolicyListFilters) => void;
  statusOptions: string[];
  compartmentOptions: string[];
}) {
  const totalPages = Math.max(1, Math.ceil(policies.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = useMemo(
    () => policies.slice(start, start + pageSize),
    [policies, start, pageSize]
  );
  const normalizedSearch = searchQuery.trim();
  const hasFilters = hasActivePolicyListFilters(filters);

  const updateFilter = <K extends keyof PolicyListFilters>(
    key: K,
    value: PolicyListFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => onFiltersChange(EMPTY_POLICY_LIST_FILTERS);

  const emptyMessage =
    normalizedSearch || hasFilters
      ? "No policies match your search or filters."
      : "No policies to display.";

  return (
    <section className="rounded-lg border border-blue-100 bg-white shadow-sm">
      <div className="relative z-20 overflow-visible border-b border-blue-100 bg-blue-50/50 px-4 py-3">
        <div
          className={`grid w-full min-w-0 items-end gap-3 ${
            hasFilters
              ? "grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]"
              : "grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]"
          }`}
        >
          <div className="relative min-w-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search policy name, description, owner…"
              className={`${FILTER_CONTROL} pl-10 pr-9 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              aria-label="Search policies"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>

          <label className={FILTER_FIELD}>
            <span className={FILTER_LABEL}>Risk</span>
            <select
              value={filters.risk}
              onChange={(e) =>
                updateFilter("risk", e.target.value as PolicyListFilters["risk"])
              }
              className={FILTER_CONTROL}
              aria-label="Filter by risk"
            >
              <option value="">All risks</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </label>

          <label className={FILTER_FIELD}>
            <span className={FILTER_LABEL}>Compartment</span>
            <select
              value={filters.compartment}
              onChange={(e) => updateFilter("compartment", e.target.value)}
              className={`${FILTER_CONTROL} truncate`}
              aria-label="Filter by compartment"
            >
              <option value="">All compartments</option>
              {compartmentOptions.map((compartment) => (
                <option key={compartment} value={compartment}>
                  {compartment}
                </option>
              ))}
            </select>
          </label>

          <label className={FILTER_FIELD}>
            <span className={FILTER_LABEL}>Status</span>
            <select
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value)}
              className={FILTER_CONTROL}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <PolicyDateRangeFilter
            className="min-w-0"
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onChange={(dateField, dateFrom, dateTo) =>
              onFiltersChange({ ...filters, dateField, dateFrom, dateTo })
            }
          />

          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-[38px] shrink-0 items-center gap-1.5 self-end rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <X className="h-4 w-4" aria-hidden />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {policies.length === 0 ? (
        <p className="px-4 py-8 text-sm text-gray-600">{emptyMessage}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th scope="col" className={TH}>
                    Policy
                  </th>
                  <th scope="col" className={TH}>
                    Compartment
                  </th>
                  <th scope="col" className={TH}>
                    Owner
                  </th>
                  <th scope="col" className={TH}>
                    Created On
                  </th>
                  <th scope="col" className={TH}>
                    Created By
                  </th>
                  <th scope="col" className={TH_CENTER}>
                    Risk
                  </th>
                  <th scope="col" className={TH_CENTER}>
                    # Statements
                  </th>
                  <th scope="col" className={TH_CENTER}>
                    Status
                  </th>
                  <th scope="col" className={TH_ACTION}>
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pageRows.map((row) => (
                  <tr key={row.name} className="hover:bg-blue-50/40">
                    <td className={`${TD} max-w-[280px]`}>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-medium text-gray-900 [overflow-wrap:anywhere]">
                          {row.name}
                        </span>
                        {row.description && row.description !== "—" ? (
                          <span
                            className="line-clamp-2 text-xs leading-snug text-gray-500 [overflow-wrap:anywhere]"
                            title={row.description}
                          >
                            {row.description}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={`${TD} text-gray-600`}>{row.compartment || "—"}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-700`}>
                      {row.owner || "—"}
                    </td>
                    <td className={`${TD} whitespace-nowrap tabular-nums text-gray-600`}>
                      {formatDateOnly(row.createdOn)}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-gray-700`}>
                      {row.createdBy || "—"}
                    </td>
                    <td className={`${TD_CENTER} font-semibold ${riskClass(row.risk)}`}>
                      {row.risk}
                    </td>
                    <td className={`${TD_CENTER} font-medium tabular-nums text-gray-900`}>
                      {row.statementCount}
                    </td>
                    <td className={TD_CENTER}>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className={TD_ACTION}>
                      <Link
                        href={policyWorkspaceHref(row.name)}
                        className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-white p-1.5 text-blue-700 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50"
                        aria-label={`View policy workspace for ${row.name}`}
                        title={`View ${row.name}`}
                      >
                        <Eye className="h-4 w-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            <label className="flex items-center gap-2 text-gray-600">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="rounded border border-gray-300 bg-white px-2 py-1"
                aria-label="Rows per page"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-3 text-gray-600">
              <span className="tabular-nums">
                {start + 1}–{Math.min(start + pageSize, policies.length)} of {policies.length}
              </span>
              <button
                type="button"
                onClick={() => onPageChange(safePage - 1)}
                disabled={safePage <= 1}
                className="rounded border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => onPageChange(safePage + 1)}
                disabled={safePage >= totalPages}
                className="rounded border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
