"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then((mod) => mod.AgGridReact), { ssr: false });
import "@/lib/ag-grid-setup";
import type { ColDef, ICellRendererParams } from "ag-grid-enterprise";
import { Copy, MoreHorizontal, Pencil, Power, Search } from "lucide-react";
import { runNhiQueryRaw, type NhiApiMode } from "@/lib/nhi-v2-query";
import {
  parseRotationPolicyGridResponse,
  ROTATION_POLICY_GRID_QUERY,
  type RotationPolicyGridRow,
} from "@/lib/nhi-rotation-policy-grid";

const DEFAULT_STATUSES = ["Active", "Draft", "Paused"] as const;

function statusBadgeClass(s: string): string {
  const k = s.trim().toLowerCase();
  switch (k) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "draft":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "paused":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function nhiBadgeClass(i: number): string {
  const palette = [
    "border-indigo-200 bg-indigo-50 text-indigo-800",
    "border-violet-200 bg-violet-50 text-violet-800",
    "border-sky-200 bg-sky-50 text-sky-800",
    "border-teal-200 bg-teal-50 text-teal-800",
    "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  ];
  return palette[i % palette.length];
}

function rowMatchesFrequencyFilter(row: RotationPolicyGridRow, freq: string): boolean {
  if (freq === "all") return true;
  if (freq === "event") return /event/i.test(row.frequencyLabel);
  return row.frequencyLabel.includes(freq);
}

function PolicyRowActions({ row }: { row: RotationPolicyGridRow }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-full items-center justify-end gap-1">
      <Link
        href={`/non-human-identity/rotation-policy/${encodeURIComponent(row.id)}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
        title="Edit"
        aria-label="Edit policy"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
        title="Duplicate / copy"
        aria-label="Duplicate policy"
      >
        <Copy className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
        title="Disable"
        aria-label="Disable policy"
      >
        <Power className="h-4 w-4" />
      </button>
      <div className="relative">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
          title="More actions"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setMenuOpen(false)}
            >
              Simulate
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
              onClick={() => setMenuOpen(false)}
            >
              Delete
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setMenuOpen(false)}
            >
              View audit log
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function RotationPolicyListPage({ apiMode = "legacy" }: { apiMode?: NhiApiMode } = {}) {
  const [policies, setPolicies] = useState<RotationPolicyGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [nhiFilter, setNhiFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [freqFilter, setFreqFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await runNhiQueryRaw(apiMode, ROTATION_POLICY_GRID_QUERY, []);
      setPolicies(parseRotationPolicyGridResponse(response));
    } catch (e) {
      setPolicies([]);
      setError(e instanceof Error ? e.message : "Failed to load rotation policies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nhiTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of policies) {
      for (const t of r.nhiTypes) {
        if (t) set.add(t);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [policies]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>(["all", ...DEFAULT_STATUSES]);
    for (const r of policies) {
      if (r.status && r.status !== "—") set.add(r.status);
    }
    return Array.from(set);
  }, [policies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return policies.filter((r) => {
      const blob = [r.name, r.description, r.nhiTypes.join(" "), r.status, r.frequencyLabel]
        .join(" ")
        .toLowerCase();
      if (q && !blob.includes(q)) return false;
      if (nhiFilter !== "all" && !r.nhiTypes.includes(nhiFilter)) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!rowMatchesFrequencyFilter(r, freqFilter)) return false;
      return true;
    });
  }, [policies, search, nhiFilter, statusFilter, freqFilter]);

  const summary = useMemo(() => {
    const totalPolicies = filtered.length;
    const identitiesCovered = filtered.reduce((acc, r) => acc + r.identityCount, 0);
    const reviewPolicies = filtered.filter((r) => r.status.toLowerCase() === "draft").length;
    const denom = 850;
    const coverageScopePct = Math.min(100, Math.round((identitiesCovered / denom) * 100));
    return { totalPolicies, identitiesCovered, reviewPolicies, coverageScopePct };
  }, [filtered]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Policy name",
        field: "name",
        flex: 2,
        minWidth: 220,
        cellRenderer: (params: ICellRendererParams<RotationPolicyGridRow>) => {
          const row = params.data as RotationPolicyGridRow;
          return (
            <div className="max-w-md py-1">
              <div className="font-medium text-gray-900">{row.name}</div>
              {row.description ? (
                <div className="mt-1 line-clamp-2 text-sm text-gray-600">{row.description}</div>
              ) : null}
            </div>
          );
        },
      },
      {
        headerName: "NHI types",
        field: "nhiTypes",
        flex: 1.5,
        minWidth: 180,
        cellRenderer: (params: ICellRendererParams<RotationPolicyGridRow>) => {
          const row = params.data as RotationPolicyGridRow;
          return (
            <div className="flex flex-wrap items-center gap-1 py-1">
              {row.nhiTypes.length === 0 ? (
                <span className="text-gray-500">—</span>
              ) : (
                row.nhiTypes.map((t, i) => (
                  <span
                    key={`${row.id}-${t}-${i}`}
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${nhiBadgeClass(i)}`}
                  >
                    {t}
                  </span>
                ))
              )}
            </div>
          );
        },
      },
      {
        headerName: "Rotation frequency",
        field: "frequencyLabel",
        flex: 1,
        minWidth: 160,
      },
      {
        headerName: "# Identities",
        field: "identityCount",
        flex: 1,
        minWidth: 130,
        cellRenderer: (params: ICellRendererParams<RotationPolicyGridRow>) => {
          const row = params.data as RotationPolicyGridRow;
          return (
            <Link
              href="/non-human-identity/nhi-inventory"
              className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
            >
              {row.identityCount}
            </Link>
          );
        },
      },
      {
        headerName: "Status",
        field: "status",
        flex: 1,
        minWidth: 120,
        cellRenderer: (params: ICellRendererParams<RotationPolicyGridRow>) => {
          const row = params.data as RotationPolicyGridRow;
          return (
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
            >
              {row.status}
            </span>
          );
        },
      },
      {
        headerName: "Actions",
        sortable: false,
        filter: false,
        flex: 0,
        width: 180,
        cellRenderer: (params: ICellRendererParams<RotationPolicyGridRow>) => (
          <PolicyRowActions row={params.data as RotationPolicyGridRow} />
        ),
      },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: false,
      flex: 1,
      minWidth: 100,
      resizable: true, wrapHeaderText: true, autoHeaderHeight: true,
    }),
    []
  );

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="w-full space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Credential Rotation Policies</h1>
            <p className="mt-2 text-sm text-gray-600">
              Define how non-human credentials are rotated, who is notified, and how overlaps are resolved when
              multiple policies apply.
            </p>
          </div>
          <Link
            href="/non-human-identity/rotation-policy/new"
            className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Create Policy
          </Link>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="rotation-policy-search" className="text-sm font-medium text-gray-700">
              Search
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-gray-400" aria-hidden />
              </div>
              <input
                id="rotation-policy-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Policy name, NHI type, status, rotation frequency…"
                autoComplete="off"
                disabled={loading}
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-50"
              />
            </div>
          </div>
          <div className="w-full sm:w-44">
            <label htmlFor="rotation-nhi-type" className="text-sm font-medium text-gray-700">
              NHI type
            </label>
            <select
              id="rotation-nhi-type"
              value={nhiFilter}
              onChange={(e) => setNhiFilter(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-50"
            >
              <option value="all">All types</option>
              {nhiTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-40">
            <label htmlFor="rotation-status" className="text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              id="rotation-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-50"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All statuses" : s}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-48">
            <label htmlFor="rotation-freq" className="text-sm font-medium text-gray-700">
              Rotation frequency
            </label>
            <select
              id="rotation-freq"
              value={freqFilter}
              onChange={(e) => setFreqFilter(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-50"
            >
              <option value="all">Any</option>
              <option value="30">~30 days</option>
              <option value="45">~45 days</option>
              <option value="90">~90 days</option>
              <option value="180">~180 days</option>
              <option value="365">~365 days</option>
              <option value="event">Event-triggered</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(
            [
              { label: "Total policies", value: String(summary.totalPolicies), tone: "text-slate-900" },
              { label: "Identities covered", value: String(summary.identitiesCovered), tone: "text-blue-600" },
              { label: "Review policies", value: String(summary.reviewPolicies), tone: "text-amber-600" },
              { label: "Coverage scope", value: `${summary.coverageScopePct}%`, tone: "text-emerald-600" },
            ] as const
          ).map((card) => (
            <div key={card.label} className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${card.tone}`}>{card.value}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Policies <span className="font-normal text-gray-500">({loading ? "…" : filtered.length})</span>
            </h2>
          </div>
          {loading && <p className="px-4 py-3 text-sm text-gray-500">Loading policies…</p>}
          {!loading && filtered.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-500">
              {policies.length === 0 ? "No policies returned from the server." : "No policies match your filters."}
            </p>
          )}
          <div
            className="ag-theme-alpine nhi-compact-grid"
            style={{ ["--ag-font-size" ]: "12px", ["--ag-header-font-size" ]: "12px" } as any}
          >
            <AgGridReact
              rowData={filtered}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              pagination={true}
              paginationPageSize={25}
              paginationPageSizeSelector={[10, 25, 50, 100]}
              domLayout="autoHeight"
              rowHeight={48}
              headerHeight={36}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
