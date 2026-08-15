"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Search } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then(mod => mod.AgGridReact), { ssr: false });
// Type import only - component is dynamically loaded
type AgGridReactType = any;
import "@/lib/ag-grid-setup";
import { executeQuery } from "@/lib/api";
import { ColDef, ICellRendererParams, IDetailCellRendererParams, RowClickedEvent } from "ag-grid-enterprise";
import { MasterDetailModule } from "ag-grid-enterprise";
import { ModuleRegistry } from "ag-grid-community";
import "./AccessPolicy.css";
import { ACCESS_POLICY_VIEW_STORAGE_KEY } from "@/lib/access-policy-view-storage";
import CustomPagination from "@/components/agTable/CustomPagination";

// Register AG Grid Enterprise modules
ModuleRegistry.registerModules([MasterDetailModule]);

type AccessPolicyRow = {
  id: string;
  policy_name: string;
  policy_description: string | null;
  priority: number | null;
  created_by: string | null;
  status: string | null;
  /** Full row from `kf_ap_access_policies_vw` for review hydration (no second API). */
  rawApiRow: Record<string, unknown>;
};

type PendingStatusChange = {
  id: string;
  policyName: string;
  nextStatus: "Active" | "Inactive";
};

// Detail Cell Renderer for Description
const DetailCellRenderer = (props: IDetailCellRendererParams) => {
  const description = props.data?.policy_description || "No description available";
  return (
    <div className="flex p-2 bg-gray-50 border-t border-gray-200">
      <div className="flex flex-row items-center gap-2">
        <span className="text-gray-800 pl-2">{description}</span>
      </div>
    </div>
  );
};

type StatusFilter = "all" | "active" | "inactive";

export default function ManageAccessPolicyPage() {
  const gridRef = useRef<AgGridReactType>(null);
  const router = useRouter();
  const [rows, setRows] = useState<AccessPolicyRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const [pendingStatusChange, setPendingStatusChange] =
    useState<PendingStatusChange | null>(null);

  const isRowActive = useCallback((status: string | null | undefined) => {
    return (status || "").trim().toLowerCase() === "active";
  }, []);

  const handleStatusToggleRequest = useCallback(
    (row: AccessPolicyRow) => {
      const currentlyActive = isRowActive(row.status);
      const nextStatus: "Active" | "Inactive" = currentlyActive
        ? "Inactive"
        : "Active";

      setPendingStatusChange({
        id: row.id,
        policyName: row.policy_name,
        nextStatus,
      });
    },
    [isRowActive],
  );

  const confirmStatusToggle = useCallback(() => {
    if (!pendingStatusChange) return;

    setRows((prev) =>
      prev.map((r) =>
        r.id === pendingStatusChange.id
          ? { ...r, status: pendingStatusChange.nextStatus }
          : r,
      ),
    );
    setPendingStatusChange(null);
  }, [pendingStatusChange]);

  const cancelStatusToggle = useCallback(() => {
    setPendingStatusChange(null);
  }, []);

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const query = "select * from kf_ap_access_policies_vw order by ?";
        const parameters = [" "];

        const response = await executeQuery<any>(query, parameters);
        const rowsFromApi: any[] =
          Array.isArray(response)
            ? response
            : Array.isArray((response as any).resultSet)
            ? (response as any).resultSet
            : Array.isArray((response as any).rows)
            ? (response as any).rows
            : [];

        const normalized: AccessPolicyRow[] = rowsFromApi.map((row, idx) => ({
          id:
            String(
              row.id ??
                row.policy_id ??
                row.policyid ??
                row.policy_name ??
                idx
            ) || String(idx),
          policy_name:
            row.policy_name ??
            row.POLICY_NAME ??
            row.name ??
            "Unnamed Policy",
          policy_description:
            row.policy_description ??
            row.POLICY_DESCRIPTION ??
            row.description ??
            null,
          priority:
            row.priority !== undefined && row.priority !== null
              ? Number(row.priority)
              : null,
          created_by:
            row.created_by ??
            row.CREATED_BY ??
            row.owner ??
            row.createdby ??
            null,
          status:
            row.status ??
            row.STATUS ??
            row.policy_status ??
            row.state ??
            null,
          rawApiRow: row as Record<string, unknown>,
        }));

        setRows(normalized);
      } catch (e: any) {
        console.error("Failed to load access policies:", e);
        setError(
          e?.message || "Failed to load access policies from executeQuery API."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchPolicies();
  }, []);

  const filteredRows = useMemo(() => {
    let list = rows;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const name = (r.policy_name || "").toLowerCase();
        const desc = (r.policy_description || "").toLowerCase();
        const by = (r.created_by || "").toLowerCase();
        const st = (r.status || "").toLowerCase();
        return (
          name.includes(q) ||
          desc.includes(q) ||
          by.includes(q) ||
          st.includes(q)
        );
      });
    }
    if (statusFilter === "active") {
      list = list.filter((r) => isRowActive(r.status));
    } else if (statusFilter === "inactive") {
      list = list.filter((r) => !isRowActive(r.status));
    }
    return list;
  }, [rows, searchQuery, statusFilter, isRowActive]);

  const totalPages = useMemo(() => {
    if (pageSize === "all") return 1;
    const ps = Math.max(1, Number(pageSize)) || 20;
    return Math.max(1, Math.ceil(filteredRows.length / ps));
  }, [filteredRows.length, pageSize]);

  const paginatedRowData = useMemo(() => {
    if (pageSize === "all") return filteredRows;
    const ps = Math.max(1, Number(pageSize)) || 20;
    const start = (currentPage - 1) * ps;
    return filteredRows.slice(start, start + ps);
  }, [filteredRows, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Policy Name",
        field: "policy_name",
        flex: 4.0,
        minWidth: 320,
      },
      {
        headerName: "Description",
        field: "policy_description",
        flex: 8.0,
        minWidth: 520,
        hide: false,
        wrapText: true,
        autoHeight: true,
        cellClass: "access-policy-desc-wrap",
        cellStyle: {
          whiteSpace: "normal",
          wordBreak: "break-word",
          lineHeight: "1.35",
        },
      },
      {
        headerName: "Created By",
        field: "created_by",
        flex: 1,
        minWidth: 120,
      },
      {
        headerName: "Status",
        field: "status",
        flex: 0.4,
        minWidth: 120,
        cellRenderer: (params: ICellRendererParams) => {
          const row = params.data as AccessPolicyRow;
          const isActive = isRowActive(row?.status);
          const statusLabel = isActive ? "Active" : "Inactive";

          return (
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!row) return;
                  handleStatusToggleRequest(row);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isActive ? "bg-green-500" : "bg-gray-300"
                }`}
                title={`Set policy to ${isActive ? "Inactive" : "Active"}`}
                aria-label={`Toggle status. Current status ${statusLabel}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    isActive ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
              <span
                className={`text-xs font-medium ${
                  isActive ? "text-green-700" : "text-gray-700"
                }`}
                style={{ display: "inline-block", minWidth: 70, textAlign: "left" }}
              >
                {statusLabel}
              </span>
            </div>
          );
        },
      },
      {
        field: "actions",
        headerName: "Action",
        flex: 0.08,
        minWidth: 45,
        cellRenderer: (params: ICellRendererParams) => {
          return (
            <div className="flex h-full w-full items-center justify-center">
              <button
                type="button"
                title="View Policy"
                aria-label="View policy"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white transition-colors duration-200 hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  const id = params.data?.id;
                  if (!id) return;
                  try {
                    sessionStorage.setItem(
                      ACCESS_POLICY_VIEW_STORAGE_KEY,
                      JSON.stringify({
                        policyId: id,
                        row: params.data?.rawApiRow ?? {},
                      })
                    );
                  } catch (err) {
                    console.error("Unable to store policy for review:", err);
                  }
                  router.push(
                    `/settings/gateway/manage-access-policy/new?policyId=${encodeURIComponent(id)}&view=1`
                  );
                }}
              >
                <Eye className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          );
        },
      },
    ],
    [handleStatusToggleRequest, isRowActive, router]
  );

  const handleRowClick = (e: RowClickedEvent) => {
    const policyId = e.data.id;
    router.push(`/settings/gateway/manage-access-policy/${policyId}`);
  };

  return (
    <div className="p-6 bg-white min-h-screen access-policy-page">
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              All Access Policies
            </h1>
            <p className="text-gray-600 text-sm">
              Access policies are used to manage and configure access permissions for your users. To start a new access policy.
            </p>
          </div>
          <Link
            href="/settings/gateway/manage-access-policy/new"
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors duration-200"
          >
            Create New
          </Link>
        </div>

        {!isLoading && !error && rows.length > 0 && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-0 flex-1 max-w-md">
              <label htmlFor="access-policy-search" className="text-sm font-medium text-gray-700">
                Search
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-gray-400" aria-hidden />
                </div>
                <input
                  id="access-policy-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, description, created by, status…"
                  autoComplete="off"
                  className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0 w-full sm:w-44">
              <label htmlFor="access-policy-status" className="text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="access-policy-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        )}

        
        {isLoading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="mb-1 border-b border-gray-100">
              <CustomPagination
                totalItems={filteredRows.length}
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newPageSize) => {
                  setPageSize(newPageSize);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[10, 20, 50, 100, "all"]}
              />
            </div>
            <div
              className="ag-theme-quartz w-full"
              style={{ width: "100%", minWidth: 0 }}
            >
              <AgGridReact
                ref={gridRef}
                rowData={paginatedRowData}
                columnDefs={columnDefs}
                rowSelection="multiple"
                context={{ gridRef }}
                rowModelType="clientSide"
                animateRows={true}
                pagination={false}
                suppressRowTransform={true}
                defaultColDef={{
                  sortable: true,
                  filter: false,
                  resizable: true,
                  cellStyle: {
                    display: "flex",
                    alignItems: "center",      // vertical center
                    justifyContent: "flex-start", // left-align content
                  },
                }}
                masterDetail={true}
                detailCellRenderer={DetailCellRenderer}
                detailRowAutoHeight={true}
                detailRowHeight={80}
                domLayout="autoHeight"
                onGridReady={(params) => {
                  params.api.sizeColumnsToFit();
                  const handleResize = () => {
                    try {
                      params.api.sizeColumnsToFit();
                      params.api.resetRowHeights();
                    } catch {
                      // ignore
                    }
                  };
                  window.addEventListener("resize", handleResize);
                  params.api.addEventListener("gridPreDestroyed", () => {
                    window.removeEventListener("resize", handleResize);
                  });
                }}
                onGridSizeChanged={(params) => {
                  try {
                    params.api.sizeColumnsToFit();
                    params.api.resetRowHeights();
                  } catch {
                    // ignore
                  }
                }}
                onFirstDataRendered={(params) => {
                  try {
                    params.api.sizeColumnsToFit();
                    params.api.resetRowHeights();
                  } catch {
                    // ignore
                  }
                }}
                onRowDataUpdated={(params) => {
                  try {
                    params.api.resetRowHeights();
                  } catch {
                    // ignore
                  }
                }}
              />
            </div>
            <div className="mt-1">
              <CustomPagination
                totalItems={filteredRows.length}
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newPageSize) => {
                  setPageSize(newPageSize);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[10, 20, 50, 100, "all"]}
              />
            </div>
          </div>
        )}
      </div>

      {pendingStatusChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Confirm Status Change
            </h2>
            <p className="text-sm text-gray-700 mb-5">
              Change policy <span className="font-medium">"{pendingStatusChange.policyName}"</span> to{" "}
              <span className="font-medium">{pendingStatusChange.nextStatus}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelStatusToggle}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStatusToggle}
                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
