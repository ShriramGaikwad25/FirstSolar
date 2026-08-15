"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  Calendar,
  ChevronRight,
  ClipboardList,
  Map,
  Plus,
  Search,
} from "lucide-react";
import CustomPagination from "@/components/agTable/CustomPagination";
import {
  type ConditionRule,
  fetchConditionRulesFromApi,
  formatConditionRuleDate,
  getConditionFieldPillStyle,
} from "./condition-rules-shared";

export default function LookupCustomApproversPage() {
  const [rules, setRules] = useState<ConditionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(10);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchConditionRulesFromApi()
      .then(({ rules: list }) => {
        if (cancelled) return;
        setRules(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load rules");
          setRules([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredRules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter((rule) => {
      const name = rule.name.toLowerCase();
      const desc = (rule.description ?? "").toLowerCase();
      const fields = (rule.condition?.fields ?? []).join(" ").toLowerCase();
      return (
        name.includes(q) ||
        desc.includes(q) ||
        fields.includes(q) ||
        String(rule.id).includes(q)
      );
    });
  }, [rules, searchQuery]);

  const paginatedRules = useMemo(() => {
    if (pageSize === "all") return filteredRules;
    const start = (currentPage - 1) * (pageSize as number);
    return filteredRules.slice(start, start + (pageSize as number));
  }, [filteredRules, currentPage, pageSize]);

  return (
    <div className="h-full w-full p-4">
      <div className="w-full min-w-0 max-w-none">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-600 py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
            Loading condition rules…
          </div>
        )}

        {!loading && error && (
          <div
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Could not load condition rules</p>
              <p className="mt-1 text-red-700">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full min-w-0 max-w-xs sm:max-w-sm">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  aria-label="Search condition rules"
                  autoComplete="off"
                />
              </div>
              <Link
                href="/settings/gateway/lookup-custom-approvers/new"
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                Create rule
              </Link>
            </div>

            {rules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                No condition rules returned.
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                No rules match your search.
              </div>
            ) : (
              <div className="w-full min-w-0 max-w-none space-y-2">
                <ul className="m-0 w-full min-w-0 list-none space-y-2 p-0">
                  {paginatedRules.map((rule) => {
                    const fields = rule.condition?.fields ?? [];
                    const updated = formatConditionRuleDate(rule.updatedAt);
                    const mapCount = rule.mappings?.length ?? 0;
                    return (
                      <li
                        key={rule.id}
                        className="flex w-full min-w-0 max-w-none flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm transition-shadow hover:shadow-md lg:flex-row lg:items-stretch lg:gap-0 lg:p-2 lg:pr-1.5"
                      >
                        {/* Left: title + subtitle + condition fields */}
                        <div className="min-w-0 flex-1 space-y-1 lg:py-0.5 lg:pr-4">
                          <h3
                            className="text-sm font-semibold leading-tight text-gray-900"
                            title={rule.name}
                          >
                            {rule.name}
                          </h3>
                          <p
                            className="text-xs leading-snug text-gray-500 line-clamp-1"
                            title={
                              rule.description?.trim()
                                ? rule.description
                                : undefined
                            }
                          >
                            {rule.description?.trim()
                              ? rule.description
                              : "No description."}
                          </p>
                          <div className="space-y-0.5 pt-0">
                            <p className="text-xs font-medium text-gray-500">
                              Condition fields
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {fields.length > 0 ? (
                                fields.map((field, idx) => {
                                  const { Icon, pill, icon } =
                                    getConditionFieldPillStyle(field, idx);
                                  return (
                                    <span
                                      key={`${field}-${idx}`}
                                      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${pill}`}
                                    >
                                      <Icon
                                        className={`h-3.5 w-3.5 shrink-0 ${icon}`}
                                        strokeWidth={2}
                                      />
                                      <span className="min-w-0 truncate font-mono">
                                        {field}
                                      </span>
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-xs text-gray-400">
                                  None
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Divider */}
                        <div
                          className="h-px w-full bg-gray-200 lg:hidden"
                          aria-hidden
                        />
                        <div
                          className="hidden w-px shrink-0 self-stretch bg-gray-200 lg:block"
                          aria-hidden
                        />

                        {/* Metadata: label row + value row per column */}
                        <div className="flex min-w-0 flex-1 items-center lg:px-4">
                          <div className="grid w-full grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 lg:grid-cols-4 lg:gap-x-5">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                              <ClipboardList
                                className="h-3.5 w-3.5 shrink-0 text-gray-400"
                                strokeWidth={2}
                              />
                              <span>Priority</span>
                            </div>
                            <span className="inline-flex w-fit rounded-md bg-violet-100 px-1.5 py-px text-xs font-semibold tabular-nums text-violet-800">
                              {rule.priority}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                              <Map
                                className="h-3.5 w-3.5 shrink-0 text-gray-400"
                                strokeWidth={2}
                              />
                              <span>Mappings</span>
                            </div>
                            <span className="inline-flex w-fit rounded-md bg-gray-100 px-1.5 py-px text-xs font-medium tabular-nums text-gray-800">
                              {mapCount}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  rule.isActive
                                    ? "bg-emerald-500"
                                    : "bg-gray-300"
                                }`}
                                aria-hidden
                              />
                              <span>Status</span>
                            </div>
                            <span
                              className={
                                rule.isActive
                                  ? "inline-flex w-fit rounded-md bg-emerald-50 px-1.5 py-px text-xs font-semibold text-emerald-800"
                                  : "inline-flex w-fit rounded-md bg-gray-100 px-1.5 py-px text-xs font-medium text-gray-600"
                              }
                            >
                              {rule.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                              <Calendar
                                className="h-3.5 w-3.5 shrink-0 text-gray-400"
                                strokeWidth={2}
                              />
                              <span>Updated</span>
                            </div>
                            <p
                              className="text-xs leading-snug text-gray-800"
                              title={updated}
                            >
                              {updated}
                            </p>
                          </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 justify-end border-t border-gray-100 pt-2 lg:flex lg:items-center lg:justify-center lg:border-t-0 lg:pt-0 lg:pl-1">
                          <Link
                            href={`/settings/gateway/lookup-custom-approvers/${rule.id}`}
                            aria-label={`Open details for ${rule.name}`}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 lg:self-center"
                          >
                            <ChevronRight className="h-4 w-4" strokeWidth={2} />
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <CustomPagination
                  totalItems={filteredRules.length}
                  currentPage={currentPage}
                  totalPages={
                    pageSize === "all"
                      ? 1
                      : Math.max(
                          1,
                          Math.ceil(
                            filteredRules.length / (pageSize as number),
                          ),
                        )
                  }
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(sz) => {
                    setPageSize(sz);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
