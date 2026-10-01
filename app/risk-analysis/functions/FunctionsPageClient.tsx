"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listFunctionsPaged } from "@/lib/api/rm";
import type { FunctionListRow } from "@/types/rm-functions";
import Badge from "@/components/Badge";
import { Pencil, Eye, Plus, Search, Boxes, Wrench } from "lucide-react";
import AgGridReact from "@/components/ClientOnlyAgGrid";
import "@/lib/ag-grid-setup";
import type {
  ColDef,
  GetRowIdParams,
  ICellRendererParams,
  RowClassParams,
} from "ag-grid-enterprise";
import CustomPagination from "@/components/agTable/CustomPagination";
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

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(rows.length / pageSize));
  // Filtering can shrink the list below the current page; clamp instead of resetting in an effect.
  const page = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    if (pageSize === "all") return rows;
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const openFunction = (id: number, edit: boolean) => {
    setOpenFnId(id);
    setEditMode(edit);
    setCreating(false);
  };

  const iconButton =
    "inline-flex shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50 hover:text-blue-600";

  const columnDefs = useMemo<ColDef<FunctionListRow>[]>(
    () => [
      {
        headerName: "Code",
        field: "function_code",
        flex: 1,
        minWidth: 130,
        tooltipField: "function_code",
        cellRenderer: (p: ICellRendererParams<FunctionListRow>) =>
          p.data ? (
            <button
              type="button"
              className="truncate text-left font-medium text-blue-600 hover:underline focus:outline-none"
              onClick={() => openFunction(p.data!.function_id, false)}
            >
              {p.value}
            </button>
          ) : null,
      },
      {
        headerName: "Name",
        field: "function_name",
        flex: 2,
        minWidth: 220,
        tooltipValueGetter: (p) =>
          p.data?.description
            ? `${p.data.function_name}\n${p.data.description}`
            : p.data?.function_name,
        cellRenderer: (p: ICellRendererParams<FunctionListRow>) =>
          p.data ? (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-gray-900">{p.data.function_name}</div>
              {p.data.description && (
                <div className="mt-0.5 truncate text-[11px] text-slate-500">
                  {p.data.description}
                </div>
              )}
            </div>
          ) : null,
      },
      {
        headerName: "System",
        field: "system_type",
        width: 110,
        cellRenderer: (p: ICellRendererParams<FunctionListRow>) =>
          p.value ? (
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              {p.value}
            </span>
          ) : null,
      },
      {
        headerName: "Privileges",
        field: "privilege_count",
        width: 125,
        cellClass: "tabular-nums",
      },
      {
        headerName: "Required perms",
        field: "required_permission_count",
        width: 165,
        headerTooltip: "SAP value-level rule expressions",
        cellRenderer: (p: ICellRendererParams<FunctionListRow>) =>
          (p.value ?? 0) > 0 ? (
            <span title="SAP value-level rule expression" className="inline-flex items-center gap-1 tabular-nums">
              <Wrench className="h-3 w-3 text-amber-700" />
              {p.value}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          ),
      },
      {
        headerName: "Rules",
        field: "rule_count",
        width: 95,
        headerTooltip: "Rules that use this function",
        cellClass: "tabular-nums",
      },
      {
        headerName: "Status",
        field: "status",
        width: 110,
        cellRenderer: (p: ICellRendererParams<FunctionListRow>) =>
          p.value ? (
            <Badge label={p.value} color={p.value === "ACTIVE" ? "#16a34a" : "#64748b"} />
          ) : null,
      },
      {
        headerName: "Actions",
        colId: "actions",
        width: 120,
        sortable: false,
        suppressHeaderMenuButton: true,
        resizable: false,
        cellRenderer: (p: ICellRendererParams<FunctionListRow>) =>
          p.data ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={iconButton}
                title="View"
                onClick={() => openFunction(p.data!.function_id, false)}
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className={iconButton}
                title="Edit"
                onClick={() => openFunction(p.data!.function_id, true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null,
      },
    ],
    []
  );

  const pagination = (
    <CustomPagination
      totalItems={rows.length}
      currentPage={page}
      totalPages={totalPages}
      pageSize={pageSize}
      onPageChange={setCurrentPage}
      onPageSizeChange={(n) => {
        setPageSize(n);
        setCurrentPage(1);
      }}
      pageSizeOptions={[10, 20, 50, 100, "all"]}
    />
  );

  const fieldClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
  const hasFilters = search !== "" || systemType !== "" || status !== "ACTIVE";

  return (
    <div className="w-full min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-gray-300 pb-2">
        <h1 className="text-2xl font-bold text-blue-950">Functions</h1>
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditMode(true);
            setOpenFnId(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          New function
        </button>
      </div>

      {/* Search and filters */}
      <div className="mb-6 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex w-full flex-wrap items-end gap-4">
          <div className="relative w-72 shrink-0">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <Search className="absolute left-3 top-9 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              className={`${fieldClass} pl-9`}
              placeholder="Function code or name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="min-w-[160px] max-w-xs flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">System</label>
            <select
              className={fieldClass}
              value={systemType}
              onChange={(e) => {
                setSystemType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All systems</option>
              {FUNCTION_SYSTEMS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px] max-w-xs flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              className={fieldClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="">All</option>
            </select>
          </div>
          <span className="inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700">
            <Boxes className="h-4 w-4" />
            Functions: <span className="text-blue-900">{rows.length}</span>
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSystemType("");
                setStatus("ACTIVE");
                setCurrentPage(1);
              }}
              className="h-[38px] shrink-0 whitespace-nowrap text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {q.isError && (
        <div className="mb-4 rounded-md border-l-4 border-red-500 bg-red-50 p-4 text-red-700">
          <p className="font-medium">Error loading functions</p>
          <p className="text-sm">{q.error instanceof Error ? q.error.message : String(q.error)}</p>
        </div>
      )}

      {/* Functions table (AG Grid) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="mb-1 border-b border-gray-100">{pagination}</div>
        <div className="ag-theme-quartz risk-analysis-grid w-full" style={{ width: "100%", minWidth: 0 }}>
          <AgGridReact
            rowData={paginatedRows}
            columnDefs={columnDefs}
            getRowId={(p: GetRowIdParams<FunctionListRow>) => String(p.data.function_id)}
            rowClassRules={{
              "risk-analysis-row-striped": (p: RowClassParams<FunctionListRow>) =>
                (p.node.rowIndex ?? 0) % 2 === 1,
            }}
            domLayout="autoHeight"
            pagination={false}
            headerHeight={44}
            rowHeight={56}
            tooltipShowDelay={300}
            defaultColDef={{
              sortable: true,
              filter: false,
              resizable: true,
              suppressSizeToFit: true,
              // Never clip a column title: wrap it and grow the header row instead.
              wrapHeaderText: true,
              autoHeaderHeight: true,
            }}
            loading={q.isLoading}
            overlayNoRowsTemplate={`<span class="ag-overlay-loading-center">No functions match these filters.</span>`}
          />
        </div>
        <div className="mt-1">{pagination}</div>
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
