"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  Download,
  Save,
  Search,
  FilterX,
  CheckCircle2,
  ShieldOff,
  X,
} from "lucide-react";
import AgGridReact from "@/components/ClientOnlyAgGrid";
import "@/lib/ag-grid-setup";
import type {
  CellClickedEvent,
  ColDef,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  RowClassParams,
  RowDataUpdatedEvent,
  SelectionChangedEvent,
} from "ag-grid-enterprise";
import CustomPagination from "@/components/agTable/CustomPagination";
import { listViolations, bulkSetViolationStatus } from "@/lib/api/rm";
import type { ListViolationsParams, Violation } from "@/types/rm-violations";
import { useLookup } from "@/hooks/useLookup";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useAuth } from "@/contexts/AuthContext";
import { rowsToCsv, triggerDownload } from "@/lib/rm-csv";
import Badge from "@/components/Badge";
import ViolationDrawer from "./ViolationDrawer";

type ViolationFilter = {
  search: string | null;
  status: string | null;
  severity: string | null;
  rule_type: string | null;
  system_type: string | null;
  scope_type: string | null;
  sort_by: string;
  sort_dir: string;
  page: number;
  page_size: number;
};

const DEFAULTS: ViolationFilter = {
  search: null,
  status: "OPEN",
  severity: null,
  rule_type: null,
  system_type: null,
  scope_type: null,
  sort_by: "severity",
  sort_dir: "desc",
  page: 1,
  page_size: 25,
};

const EXPORT_PAGE_SIZE = 500;
/** Detail lines shown per row; the drawer lists the rest. */
const DETAIL_LINES = 3;
const EXPORT_MAX_PAGES = 200;


/** search / severity / rule_type / system_type / scope_type are not in the v2 list signature. */
function matchesClientFilters(v: Violation, f: ViolationFilter): boolean {
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

function serverParams(f: ViolationFilter, page: number, pageSize: number): ListViolationsParams {
  return {
    status: f.status,
    sort_by: f.sort_by,
    sort_dir: f.sort_dir,
    page,
    page_size: pageSize,
    locale: "en",
  };
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? "—" : t.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Saved filter presets — per-viewer, in localStorage.
// ---------------------------------------------------------------------------
type Preset = { id: string; name: string; filters: Partial<ViolationFilter> };
const PRESETS_KEY = "kf_filters:violations";

function useSavedFilters() {
  const [presets, setPresets] = useState<Preset[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      if (raw) setPresets(JSON.parse(raw) as Preset[]);
    } catch {
      /* storage unavailable or corrupted */
    }
  }, []);

  const persist = (next: Preset[]) => {
    setPresets(next);
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  return {
    presets,
    save: (name: string, filters: Partial<ViolationFilter>) =>
      persist([...presets, { id: `${Date.now()}`, name, filters }]),
    remove: (id: string) => persist(presets.filter((p) => p.id !== id)),
  };
}

export default function ViolationsPageClient() {
  const [filters, setFilters, resetFilters] = useUrlFilters<ViolationFilter>(DEFAULTS);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const qc = useQueryClient();
  const { user } = useAuth();
  const saved = useSavedFilters();

  const severities = useLookup("RULE_SEVERITY");
  const statuses = useLookup("VIOLATION_STATUS");
  const ruleTypes = useLookup("RULE_TYPE");
  const systems = useLookup("SYSTEM_TYPE");
  const scopes = useLookup("SCOPE_TYPE");

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const q = useQuery({
    queryKey: [
      "violations",
      "v2",
      filters.status,
      filters.sort_by,
      filters.sort_dir,
      filters.page,
      filters.page_size,
    ],
    queryFn: async () => listViolations(serverParams(filters, filters.page, filters.page_size)),
  });

  const rows = useMemo(
    () => (q.data?.data ?? []).filter((v) => matchesClientFilters(v, filters)),
    [q.data?.data, filters]
  );
  const pag = q.data?.pagination;
  const total = pag?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / filters.page_size));

  const hasClientOnlyFilters = Boolean(
    (filters.search ?? "").trim() ||
      filters.severity ||
      filters.rule_type ||
      filters.system_type ||
      filters.scope_type
  );

  const setF = (k: keyof ViolationFilter, v: string) =>
    setFilters({ [k]: v === "" ? null : v, page: 1 } as Partial<ViolationFilter>);

  async function handleExport() {
    setExporting(true);
    try {
      const all: Violation[] = [];
      for (let page = 1; page <= EXPORT_MAX_PAGES; page++) {
        const r = await listViolations(serverParams(filters, page, EXPORT_PAGE_SIZE));
        all.push(...r.data);
        if (all.length >= r.pagination.total || r.data.length < EXPORT_PAGE_SIZE) break;
      }
      const matching = all.filter((v) => matchesClientFilters(v, filters));
      const csv = rowsToCsv(
        matching.map((r) => ({
          "Violation ID": r.violation_id,
          User: r.user_name || r.username,
          Username: r.username,
          "Rule Code": r.rule_code,
          "Rule Name": r.rule_name ?? "",
          "Rule Type": r.rule_type_name ?? r.rule_type,
          Severity: r.severity_name ?? r.severity,
          "Risk Score": (r as unknown as { risk_score?: number | null }).risk_score ?? "",
          Status: r.status_name ?? r.violation_status,
          Detail:
            r.details
              ?.map(
                (d) =>
                  `${d.system_type ?? ""}:${d.function_code ?? ""}${
                    d.scope_name ? `@${d.scope_type}:${d.scope_name}` : ""
                  }`
              )
              .join(" | ") ?? "",
          "Detected At": r.created_at,
        }))
      );
      const stamp = new Date().toISOString().slice(0, 10);
      // UTF-8 BOM so Excel opens it with the right encoding.
      triggerDownload(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }), `violations_${stamp}.csv`);
      setNotice({ kind: "ok", text: `Exported ${matching.length} rows` });
    } catch (e) {
      setNotice({ kind: "err", text: `Export failed: ${(e as Error).message}` });
    } finally {
      setExporting(false);
    }
  }

  function saveCurrent() {
    const name = window.prompt("Save current filters as:");
    if (!name) return;
    saved.save(name, filters);
    setNotice({ kind: "ok", text: `Saved “${name}”` });
  }

  const bulkStatusMut = useMutation({
    mutationFn: async (status: string) =>
      bulkSetViolationStatus(Array.from(selected), status, { actor: user?.email }),
    onSuccess: (r, status) => {
      setNotice({ kind: "ok", text: `${r.data?.updated ?? selected.size} → ${status}` });
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ["violations"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => setNotice({ kind: "err", text: (e as Error).message }),
  });

  // AG Grid owns the checkboxes for the current page; `selected` keeps picks across pages.
  const gridApiRef = useRef<GridApi<Violation> | null>(null);
  const syncGridSelection = (api: GridApi<Violation>) => {
    api.forEachNode((node) => {
      if (node.data) node.setSelected(selected.has(node.data.violation_id), false, "api");
    });
  };
  const onSelectionChanged = (e: SelectionChangedEvent<Violation>) => {
    if (e.source === "api") return;
    setSelected((prev) => {
      const next = new Set(prev);
      e.api.forEachNode((node) => {
        if (!node.data) return;
        if (node.isSelected()) next.add(node.data.violation_id);
        else next.delete(node.data.violation_id);
      });
      return next;
    });
  };
  useEffect(() => {
    if (gridApiRef.current && selected.size === 0) gridApiRef.current.deselectAll("all", "api");
  }, [selected]);

  const columnDefs = useMemo<ColDef<Violation>[]>(
    () => [
      {
        headerName: "User",
        colId: "user",
        flex: 1,
        minWidth: 180,
        tooltipValueGetter: (p) =>
          p.data ? `${p.data.user_name || p.data.username}\n${p.data.username}` : undefined,
        cellRenderer: (p: ICellRendererParams<Violation>) =>
          p.data ? (
            <div className="w-full min-w-0 leading-snug">
              <div className="[overflow-wrap:anywhere] font-medium text-gray-900">
                {p.data.user_name || p.data.username}
              </div>
              <div className="mt-0.5 [overflow-wrap:anywhere] text-[11px] text-slate-500">{p.data.username}</div>
            </div>
          ) : null,
      },
      {
        headerName: "Rule",
        colId: "rule",
        flex: 1,
        minWidth: 200,
        tooltipValueGetter: (p) =>
          p.data?.rule_name ? `${p.data.rule_code}\n${p.data.rule_name}` : p.data?.rule_code,
        cellRenderer: (p: ICellRendererParams<Violation>) =>
          p.data ? (
            <div className="w-full min-w-0 leading-snug">
              <div className="[overflow-wrap:anywhere] font-medium text-blue-600">{p.data.rule_code}</div>
              {p.data.rule_name && (
                <div className="mt-0.5 [overflow-wrap:anywhere] text-[11px] text-slate-500">{p.data.rule_name}</div>
              )}
            </div>
          ) : null,
      },
      {
        headerName: "Type",
        colId: "rule_type",
        width: 190,
        cellRenderer: (p: ICellRendererParams<Violation>) =>
          p.data ? <Badge label={p.data.rule_type_name ?? p.data.rule_type} /> : null,
      },
      {
        headerName: "Severity",
        colId: "severity",
        width: 125,
        cellRenderer: (p: ICellRendererParams<Violation>) =>
          p.data ? (
            <Badge
              label={p.data.severity_name ?? p.data.severity}
              color={p.data.severity_color ?? "#64748b"}
            />
          ) : null,
      },
      {
        headerName: "Status",
        colId: "status",
        width: 135,
        cellRenderer: (p: ICellRendererParams<Violation>) =>
          p.data ? (
            <Badge
              label={p.data.status_name ?? p.data.violation_status}
              color={p.data.status_color ?? "#64748b"}
            />
          ) : null,
      },
      {
        headerName: "Detail",
        colId: "detail",
        flex: 1.5,
        minWidth: 240,
        cellRenderer: (p: ICellRendererParams<Violation>) => {
          const details = p.data?.details ?? [];
          const shown = details.slice(0, DETAIL_LINES);
          return (
            <div className="w-full min-w-0 text-xs leading-snug text-slate-600">
              {shown.map((d, i) => (
                <div key={i} className="[overflow-wrap:anywhere]">
                  {d.system_type ? `[${d.system_type}] ` : ""}
                  {d.function_code ?? ""}
                  {d.scope_name ? ` @ ${d.scope_type}:${d.scope_name}` : ""}
                </div>
              ))}
              {details.length > DETAIL_LINES && (
                <div className="mt-0.5 font-medium text-blue-600">
                  +{details.length - DETAIL_LINES} more — open to see all
                </div>
              )}
            </div>
          );
        },
      },
      {
        headerName: "Detected",
        field: "created_at",
        width: 125,
        valueFormatter: (p) => fmtDate(p.value),
        cellClass: "text-slate-500",
      },
    ],
    []
  );

  const pagination = (
    <CustomPagination
      totalItems={total}
      currentPage={filters.page}
      totalPages={totalPages}
      pageSize={filters.page_size}
      onPageChange={(page) => setFilters({ page })}
      onPageSizeChange={(n) => {
        if (n !== "all") setFilters({ page_size: n, page: 1 });
      }}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );

  const fieldClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
  const outlineBtn =
    "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50";

  const filterSelects: Array<{
    key: keyof ViolationFilter;
    label: string;
    any: string;
    options: { value_code: string; value_name: string }[] | undefined;
  }> = [
    { key: "status", label: "Status", any: "Any status", options: statuses.data },
    { key: "severity", label: "Severity", any: "Any severity", options: severities.data },
    { key: "rule_type", label: "Rule type", any: "Any rule type", options: ruleTypes.data },
    { key: "system_type", label: "ERP system", any: "Any ERP", options: systems.data },
    { key: "scope_type", label: "Scope", any: "Any scope", options: scopes.data },
  ];

  return (
    <div className="w-full min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-300 pb-2">
        <h1 className="text-2xl font-bold text-blue-950">Violations</h1>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={outlineBtn} onClick={saveCurrent}>
            <Save className="h-4 w-4" /> Save filter
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            onClick={() => void handleExport()}
            disabled={exporting || total === 0}
          >
            <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`mb-4 rounded-md border-l-4 p-4 text-sm ${
            notice.kind === "ok"
              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
              : "border-red-500 bg-red-50 text-red-700"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Search and filters */}
      <div className="mb-6 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex w-full flex-wrap items-end gap-4">
          <div className="relative w-72 shrink-0">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <Search className="absolute left-3 top-9 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              className={`${fieldClass} pl-9`}
              placeholder="User or rule"
              aria-label="Search violations"
              value={filters.search ?? ""}
              onChange={(e) => setF("search", e.target.value)}
            />
          </div>
          {filterSelects.map((f) => (
            <div key={f.key} className="min-w-[140px] flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <select
                className={fieldClass}
                aria-label={f.label}
                value={(filters[f.key] as string | null) ?? ""}
                onChange={(e) => setF(f.key, e.target.value)}
              >
                <option value="">{f.any}</option>
                {f.options?.map((v) => (
                  <option key={v.value_code} value={v.value_code}>
                    {v.value_name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <span
            className="inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700"
            title={hasClientOnlyFilters ? "Search and the Severity / Rule type / ERP / Scope filters apply to the current page" : undefined}
          >
            <ShieldAlert className="h-4 w-4" />
            Violations: <span className="text-blue-900">{total}</span>
            {hasClientOnlyFilters && (
              <span className="font-normal text-blue-700">· {rows.length} on this page</span>
            )}
          </span>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-[38px] shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            <FilterX className="h-3.5 w-3.5" /> Reset filters
          </button>
        </div>

        {saved.presets.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3" aria-label="Saved filters">
            <span className="mr-1 text-xs font-medium text-gray-600">Saved filters:</span>
            {saved.presets.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800"
              >
                <button type="button" onClick={() => setFilters({ ...DEFAULTS, ...p.filters, page: 1 })}>
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => saved.remove(p.id)}
                  aria-label={`Remove saved filter ${p.name}`}
                >
                  <X className="h-[11px] w-[11px]" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {q.isError && (
        <div className="mb-4 rounded-md border-l-4 border-red-500 bg-red-50 p-4 text-red-700">
          <p className="font-medium">Error loading violations</p>
          <p className="text-sm">{q.error instanceof Error ? q.error.message : String(q.error)}</p>
        </div>
      )}

      {/* Violations table (AG Grid) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="mb-1 border-b border-gray-100">{pagination}</div>

        {selected.size > 0 && (
          <div
            role="region"
            aria-label="Bulk actions"
            className="flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900"
          >
            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
              {selected.size}
            </span>
            <span>selected</span>
            <span className="mx-1 h-4 w-px bg-blue-200" />
            {(
              [
                ["MITIGATED", "Mark mitigated", CheckCircle2],
                ["REMEDIATED", "Mark remediated", CheckCircle2],
                ["EXCEPTED", "Mark excepted", ShieldOff],
              ] as const
            ).map(([code, label, Icon]) => (
              <button
                key={code}
                type="button"
                onClick={() => bulkStatusMut.mutate(code)}
                disabled={bulkStatusMut.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium hover:bg-blue-100 disabled:opacity-50"
              >
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          </div>
        )}

        <div className="ag-theme-quartz risk-analysis-grid w-full" style={{ width: "100%", minWidth: 0 }}>
          <AgGridReact
            rowData={rows}
            columnDefs={columnDefs}
            getRowId={(p: GetRowIdParams<Violation>) => String(p.data.violation_id)}
            rowClassRules={{
              "risk-analysis-row-striped": (p: RowClassParams<Violation>) =>
                (p.node.rowIndex ?? 0) % 2 === 1,
            }}
            rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: false }}
            selectionColumnDef={{
              width: 48,
              minWidth: 48,
              maxWidth: 48,
              suppressHeaderMenuButton: true,
              // Line the checkbox up with the first line of the top-aligned cells.
              cellStyle: { alignItems: "flex-start", paddingTop: "12px" },
            }}
            onSelectionChanged={onSelectionChanged}
            onGridReady={(e: GridReadyEvent<Violation>) => {
              gridApiRef.current = e.api;
            }}
            onRowDataUpdated={(e: RowDataUpdatedEvent<Violation>) => syncGridSelection(e.api)}
            onCellClicked={(e: CellClickedEvent<Violation>) => {
              const target = e.event?.target as HTMLElement | null;
              if (target?.closest(".ag-selection-checkbox, .ag-checkbox-input-wrapper, input")) return;
              if (e.colDef.colId === "ag-Grid-SelectionColumn") return;
              if (e.data) setOpenId(e.data.violation_id);
            }}
            rowStyle={{ cursor: "pointer" }}
            domLayout="autoHeight"
            pagination={false}
            headerHeight={44}
            rowHeight={56}
            tooltipShowDelay={300}
            defaultColDef={{
              // Paging and sorting are server-side, so sorting one page would mislead.
              sortable: false,
              filter: false,
              resizable: true,
              suppressSizeToFit: true,
              suppressHeaderMenuButton: true,
              // Wrap every cell and grow the row to fit, instead of cutting text off.
              wrapText: true,
              autoHeight: true,
              wrapHeaderText: true,
              autoHeaderHeight: true,
            }}
            loading={q.isLoading}
            overlayNoRowsTemplate={`<span class="ag-overlay-loading-center">No violations match. Try clearing a filter or picking a different status.</span>`}
          />
        </div>

        <div className="mt-1">{pagination}</div>
      </div>

      <ViolationDrawer violationId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
