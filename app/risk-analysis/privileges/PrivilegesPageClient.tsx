"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Search, Upload, UserCog } from "lucide-react";
import AgGridReact from "@/components/ClientOnlyAgGrid";
import "@/lib/ag-grid-setup";
import type { ColDef, GetRowIdParams, ICellRendererParams, RowClassParams } from "ag-grid-enterprise";
import Badge from "@/components/Badge";
import CustomPagination from "@/components/agTable/CustomPagination";
import { useLookup } from "@/hooks/useLookup";
import { listPrivileges, type PrivilegeListRow } from "@/lib/api/rm";
import { PAGE_SIZE, PRIVILEGE_KIND } from "./constants";
import { RecentImports } from "./RecentImports";
import { ImportDataModal } from "./ImportDataModal";
import { ImportAppRolesModal } from "./ImportAppRolesModal";

export default function PrivilegesPageClient() {
  const systemLookup = useLookup("SYSTEM_TYPE");
  const systemName = (code: string) => systemLookup.data?.find((v) => v.value_code === code)?.value_name ?? code;

  const [systemType, setSystemType] = useState("");
  const [search, setSearch] = useState("");
  // Search, filter and paging run on the server (rm_list_privileges); search waits for typing to pause.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const [currentPage, setCurrentPage] = useState(1);

  const q = useQuery({
    queryKey: ["privileges", systemType, debouncedSearch, currentPage],
    queryFn: () =>
      listPrivileges({
        system_type: systemType || null,
        search: debouncedSearch || null,
        page: currentPage,
        page_size: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = q.data?.data ?? [];
  const total = q.data?.total ?? 0;
  const systems = q.data?.systems ?? [];
  const allCount = systems.reduce((n, s) => n + s.privileges, 0);

  const [importOpen, setImportOpen] = useState(false);
  const [appRolesOpen, setAppRolesOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const columnDefs = useMemo<ColDef<PrivilegeListRow>[]>(
    () => [
      {
        headerName: "Privilege",
        field: "privilege_code",
        flex: 2,
        minWidth: 260,
        tooltipValueGetter: (p) => p.data?.privilege_name ?? p.data?.privilege_code,
        cellRenderer: (p: ICellRendererParams<PrivilegeListRow>) =>
          p.data ? (
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-mono text-xs font-semibold text-gray-900">{p.data.privilege_code}</span>
                {p.data.status !== "ACTIVE" && <Badge label={p.data.status.toLowerCase()} color="#94a3b8" />}
              </div>
              {p.data.privilege_name && p.data.privilege_name !== p.data.privilege_code && (
                <div className="mt-0.5 truncate text-xs text-slate-500">{p.data.privilege_name}</div>
              )}
            </div>
          ) : null,
      },
      {
        headerName: "System",
        field: "system_type",
        flex: 1,
        minWidth: 140,
        valueFormatter: (p) => (p.value ? systemName(p.value) : ""),
      },
      {
        headerName: "Kind",
        field: "privilege_kind",
        width: 140,
        cellRenderer: (p: ICellRendererParams<PrivilegeListRow>) => {
          if (!p.value) return null;
          const k = PRIVILEGE_KIND[p.value];
          return <Badge label={k?.label ?? p.value} color={k?.color ?? "#64748b"} />;
        },
      },
      {
        headerName: "Roles",
        field: "roles",
        width: 110,
        headerTooltip: "Roles granting it, directly or by inheritance",
        cellRenderer: (p: ICellRendererParams<PrivilegeListRow>) =>
          p.value ? <span className="tabular-nums">{Number(p.value).toLocaleString()}</span> : <span className="text-gray-400">—</span>,
      },
      {
        headerName: "Functions",
        field: "functions",
        width: 120,
        headerTooltip: "Functions built on it",
        cellRenderer: (p: ICellRendererParams<PrivilegeListRow>) =>
          p.value ? <span className="tabular-nums">{Number(p.value).toLocaleString()}</span> : <span className="text-gray-400">—</span>,
      },
    ],
    // systemName reads the lookup; rebuild the columns once it loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [systemLookup.data]
  );

  const fieldClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";

  const pagination = (
    <CustomPagination
      totalItems={total}
      currentPage={currentPage}
      totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
      pageSize={PAGE_SIZE}
      onPageChange={setCurrentPage}
    />
  );

  return (
    <div className="w-full min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-gray-300 pb-2">
        <h1 className="text-2xl font-bold text-blue-950">Privileges</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAppRolesOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <UserCog className="h-4 w-4" />
            Import app roles
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Upload className="h-4 w-4" />
            Import data
          </button>
        </div>
      </div>

      {notice && (
        <div role="status" className="mb-4 rounded-md border-l-4 border-emerald-500 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <RecentImports />

      {/* Search and filters */}
      <div className="mb-6 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex w-full flex-wrap items-end gap-4">
          <div className="min-w-[200px] max-w-xs flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-600">System</label>
            <select
              aria-label="System"
              className={fieldClass}
              value={systemType}
              onChange={(e) => {
                setSystemType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All systems ({allCount.toLocaleString()})</option>
              {systems.map((s) => (
                <option key={s.system_type} value={s.system_type}>
                  {systemName(s.system_type)} ({s.privileges.toLocaleString()})
                </option>
              ))}
            </select>
          </div>
          <div className="relative w-72 shrink-0">
            <label className="mb-1 block text-xs font-medium text-gray-600">Search</label>
            <Search className="pointer-events-none absolute left-3 top-9 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              aria-label="Search privileges"
              className={`${fieldClass} pl-9`}
              placeholder="Search code or name…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <span className="inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700">
            <KeyRound className="h-4 w-4" />
            Privileges: <span className="text-blue-900">{total.toLocaleString()}</span>
          </span>
        </div>
      </div>

      {q.isError && (
        <div className="mb-4 rounded-md border-l-4 border-red-500 bg-red-50 p-4 text-red-700">
          <p className="font-medium">Error loading privileges</p>
          <p className="text-sm">{q.error instanceof Error ? q.error.message : String(q.error)}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="mb-1 border-b border-gray-100">{pagination}</div>
        <div className="ag-theme-quartz risk-analysis-grid w-full" style={{ width: "100%", minWidth: 0 }}>
          <AgGridReact
            rowData={rows}
            columnDefs={columnDefs}
            getRowId={(p: GetRowIdParams<PrivilegeListRow>) => String(p.data.privilege_id)}
            rowClassRules={{
              "risk-analysis-row-striped": (p: RowClassParams<PrivilegeListRow>) => (p.node.rowIndex ?? 0) % 2 === 1,
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
              wrapHeaderText: true,
              autoHeaderHeight: true,
            }}
            loading={q.isLoading}
            overlayNoRowsTemplate={`<span class="ag-overlay-loading-center">${
              debouncedSearch ? "No privileges match." : "No privileges yet. Import them from a file, or from an application’s roles."
            }</span>`}
          />
        </div>
        <div className="mt-1">{pagination}</div>
      </div>

      {importOpen && (
        <ImportDataModal
          defaultSystem={systemType || undefined}
          onClose={() => setImportOpen(false)}
          onStarted={setNotice}
        />
      )}
      {appRolesOpen && <ImportAppRolesModal onClose={() => setAppRolesOpen(false)} onDone={setNotice} />}
    </div>
  );
}
