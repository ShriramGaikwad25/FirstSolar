"use client";
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
const AgGridReact = dynamic(() => import("ag-grid-react").then((mod) => mod.AgGridReact), { ssr: false });
import "@/lib/ag-grid-setup";
import { ColDef, ICellRendererParams } from "ag-grid-enterprise";
import { getReviewerId } from "@/lib/auth";
import { getAccessRequestStatusBadgeClasses } from "@/lib/access-request-status-badge";
import {
  type MyApprovalsStatusFilter,
  MY_APPROVALS_STATUS_SELECT_OPTIONS,
  mapAccessRequestStatusToMyApprovalsFilter,
} from "@/lib/my-approvals-status-filters";
import CustomPagination from "@/components/agTable/CustomPagination";
import { DateRangeFilter } from "@/components/DateRangeFilter";

interface RequestHistory {
  action: string;
  date: string;
  status: string;
  assignedTo: string;
}

interface RequestDetails {
  dateCreated: string;
  type: string;
  name: string;
  justification: string;
  startDate: string;
  endDate: string;
  globalComments?: string;
}

interface Request {
  id: string | number;
  routeId: string | number;
  /** 1-based position of this access item within its parent request. */
  subId: number;
  beneficiaryName: string;
  requesterName: string;
  /** Application the requested item belongs to. */
  systemName: string;
  /** Name of the requested entitlement / role. */
  entitlementName: string;
  displayName: string;
  entityType: string;
  daysOpen: number;
  status: string;
  /** Raw ISO creation date, used for date-range filtering (display uses details.dateCreated). */
  raisedOnRaw?: string;
  canWithdraw?: boolean;
  canProvideAdditionalDetails?: boolean;
  /** True when API / SOD evaluation reports a segregation-of-duties conflict for this request. */
  hasConflict?: boolean;
  /** ISO date string: creation date + 14 days (aligned with My Approvals). */
  expiryDate: string;
  details?: RequestDetails;
  history?: RequestHistory[];
}

const TRACK_REQUEST_EXPIRY_DAYS = 14;

function formatTrackDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
}

function parseInputDate(value: string): Date | null {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [yyyy, mm, dd] = parts.map((p) => Number(p));
  if (!mm || !dd || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd);
}

function addDaysToCreatedOn(createdOn: string, days: number): string {
  if (!createdOn) return "";
  const d = new Date(createdOn);
  if (Number.isNaN(d.getTime())) return "";
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out.toISOString();
}

/** Any column that may wrap uses this so the row grows to fit (with domLayout autoHeight + resetRowHeights). */
const wrappedTextCol: Partial<ColDef> = {
  wrapText: true,
  autoHeight: true,
  cellStyle: {
    whiteSpace: "normal",
    wordBreak: "break-word",
    lineHeight: "1.35",
  },
};

const TrackRequest: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<MyApprovalsStatusFilter>("All");
  const [raisedFrom, setRaisedFrom] = useState("");
  const [raisedTo, setRaisedTo] = useState("");
  const [systemFilter, setSystemFilter] = useState("");
  const [entitlementFilter, setEntitlementFilter] = useState("");
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reviewerId = getReviewerId();
    if (!reviewerId) {
      setError("Reviewer ID not found.");
      setRequests([]);
      setLoading(false);
      return;
    }

    const url = "https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery";
    setLoading(true);
    setError(null);

    const body = {
      query: "select * from vw_access_request_full_json where requested_by_user_id = ?::uuid",
      parameters: [String(reviewerId).trim()],
    };

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        let rawRows: any[] = [];
        if (Array.isArray(data)) rawRows = data;
        else if (Array.isArray((data as any).resultSet)) rawRows = (data as any).resultSet;
        else if (Array.isArray((data as any).rows)) rawRows = (data as any).rows;

        if (!rawRows || rawRows.length === 0) {
          setRequests([]);
          return;
        }
        const mapped: Request[] = rawRows
          .filter((row) => {
            const requestJson = row?.request_json ?? {};
            const workflowInstanceId = requestJson?.workflow_instance?.id;
            return workflowInstanceId !== null && workflowInstanceId !== undefined && String(workflowInstanceId).trim() !== "";
          })
          .flatMap((row) => {
          const requestJson =
            row?.request_json ??
            row?.requestJson ??
            row?.request ??
            row?.data ??
            {};

          const contextJsonFromRow = row?.context_json ?? row?.contextJson ?? null;
          const contextJsonFromWorkflow =
            requestJson?.workflow_instance?.context_json ??
            requestJson?.workflowInstance?.context_json ??
            requestJson?.workflow_instance?.contextJson ??
            requestJson?.workflowInstance?.contextJson ??
            null;

          const sodResults =
            contextJsonFromRow?.sodResults ??
            contextJsonFromRow?.sod_results ??
            contextJsonFromRow?.sodresults ??
            contextJsonFromWorkflow?.sodResults ??
            contextJsonFromWorkflow?.sod_results ??
            contextJsonFromWorkflow?.sodresults ??
            requestJson?.workflow_instance?.context_json?.sodResults ??
            requestJson?.workflow_instance?.context_json?.sod_results ??
            requestJson?.workflow_instance?.context_json?.sodresults ??
            requestJson?.workflowInstance?.context_json?.sodResults ??
            requestJson?.workflowInstance?.context_json?.sod_results ??
            requestJson?.workflowInstance?.context_json?.sodresults ??
            requestJson?.workflow_instance?.contextJson?.sodResults ??
            requestJson?.workflow_instance?.contextJson?.sod_results ??
            requestJson?.workflow_instance?.contextJson?.sodresults ??
            requestJson?.workflowInstance?.contextJson?.sodResults;

          const hasGlobalSodConflict = Boolean(sodResults?.hasConflict);
          /** Names/ids the SOD engine flagged — used to pin the conflict to the right access item. */
          const conflictingRoleNames: string[] = Array.isArray(sodResults?.conflictingRoles)
            ? sodResults.conflictingRoles.map((r: any) => String(r).trim()).filter(Boolean)
            : [];

          const accessRequest = requestJson.access_request ?? {};
          const requestedBy = accessRequest.requested_by ?? {};
          const requestedFor = accessRequest.requested_for ?? {};
          const accessItems: any[] = Array.isArray(requestJson.access_items) ? requestJson.access_items : [];

          const requesterNameFromObject =
            requestedBy.display_name ||
            [requestedBy.first_name, requestedBy.last_name].filter(Boolean).join(" ") ||
            requestedBy.username ||
            "";

          const beneficiaryNameFromObject =
            requestedFor.display_name ||
            [requestedFor.first_name, requestedFor.last_name].filter(Boolean).join(" ") ||
            requestedFor.username ||
            "";

          const requestedOn: string | undefined = accessRequest.created_at;
          const raisedOn = formatTrackDate(requestedOn);

          let daysOpen = 0;
          if (requestedOn) {
            const d = new Date(requestedOn);
            if (!Number.isNaN(d.getTime())) {
              const now = new Date();
              const diffMs = now.getTime() - d.getTime();
              daysOpen = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
            }
          }

          const rawStatus =
            (typeof accessRequest.status === "string" && accessRequest.status.trim()) ||
            (typeof row.status === "string" && row.status.trim()) ||
            "";
          const status = rawStatus ? rawStatus.replace(/_/g, " ") : "Request Submitted";

          const workflowInstanceId = requestJson?.workflow_instance?.id;
          const requestId =
            workflowInstanceId ??
            row.request_id ??
            accessRequest.id ??
            row.requestid ??
            row.id ??
            "";

          const rowLevelConflict = Boolean(row.hasConflict ?? row.has_conflict);

          // One grid row per requested access item; a request with no items still gets a single row
          // so it never disappears from the tracker.
          const itemsToRender: any[] = accessItems.length > 0 ? accessItems : [{}];

          return itemsToRender.map((item, index) => {
            const catalog = item?.catalog ?? {};
            const entitlementMeta = item?.entitlement_metadata ?? {};

            const entitlementName =
              catalog.name || catalog.entitlementname || catalog.entitlementName || "";
            const systemName =
              catalog.applicationname ||
              catalog.applicationName ||
              catalog.application_name ||
              "";

            const entityTypeFromCatalog =
              catalog.type ||
              catalog.entitlementtype ||
              (catalog.metadata?.entitlementType as string) ||
              "Entitlement";

            const justification: string =
              (accessRequest.justification as string) ||
              (entitlementMeta.comments as string) ||
              (item?.item_comments as string) ||
              "";

            const startDate = entitlementMeta.startDate ? String(entitlementMeta.startDate) : raisedOn;
            const endDate = entitlementMeta.endDate ? String(entitlementMeta.endDate) : "";

            // Item-level SOD: prefer the item's own flag, otherwise pin the request-level conflict to
            // the named conflicting role(s); with no names available, fall back to flagging the request.
            const itemNameKey = String(entitlementName).trim();
            const itemIdKey = String(catalog.catalogId ?? catalog.catalogid ?? "").trim();
            const hasConflict =
              Boolean(item?.hasConflict ?? item?.has_conflict) ||
              ((hasGlobalSodConflict || rowLevelConflict) &&
                (conflictingRoleNames.length === 0 ||
                  conflictingRoleNames.some(
                    (name) => name === itemNameKey || name === itemIdKey
                  )));

            return {
              id: requestId,
              routeId: requestId,
              subId: index + 1,
              beneficiaryName: String(beneficiaryNameFromObject),
              requesterName: String(requesterNameFromObject),
              systemName: String(systemName),
              entitlementName: String(entitlementName),
              displayName: String(entitlementName),
              entityType: String(entityTypeFromCatalog),
              daysOpen,
              status,
              raisedOnRaw: requestedOn ?? "",
              hasConflict,
              expiryDate: addDaysToCreatedOn(requestedOn ?? "", TRACK_REQUEST_EXPIRY_DAYS),
              canWithdraw: status.toLowerCase().includes("awaiting") || status.toLowerCase().includes("pending"),
              canProvideAdditionalDetails: status.toLowerCase().includes("provide information"),
              details: {
                dateCreated: raisedOn,
                type: String(entityTypeFromCatalog),
                name: String(entitlementName || ""),
                justification,
                startDate,
                endDate,
                globalComments: justification || undefined,
              },
              history: [],
            };
          });
        });

        setRequests(mapped);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load track requests.";
        setError(message);
        setRequests([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredRequests = requests.filter((request) => {
    if (statusFilter !== "All") {
      const bucket = mapAccessRequestStatusToMyApprovalsFilter(request.status);
      if (bucket !== statusFilter) return false;
    }

    const query = searchQuery.trim().toLowerCase();

    if (query) {
      const matchesSearch =
        request.id.toString().includes(query) ||
        request.requesterName.toLowerCase().includes(query) ||
        request.beneficiaryName.toLowerCase().includes(query);

      if (!matchesSearch) {
        return false;
      }
    }

    const from = parseInputDate(raisedFrom);
    const to = parseInputDate(raisedTo);
    if (from || to) {
      const raised = request.raisedOnRaw ? new Date(request.raisedOnRaw) : null;
      if (!raised || Number.isNaN(raised.getTime())) return false;
      if (from && raised < from) return false;
      if (to && raised > to) return false;
    }

    const systemQuery = systemFilter.trim().toLowerCase();
    if (systemQuery && !request.systemName.toLowerCase().includes(systemQuery)) {
      return false;
    }

    const entitlementQuery = entitlementFilter.trim().toLowerCase();
    if (
      entitlementQuery &&
      !request.entitlementName.toLowerCase().includes(entitlementQuery)
    ) {
      return false;
    }

    return true;
  });

  /**
   * Newest / highest request IDs first — matches default ID column sort and keeps pages aligned with
   * slicing. Rows of the same request stay grouped in sub-ID order.
   */
  const sortedFilteredRequests = useMemo(() => {
    return [...filteredRequests].sort((a, b) => {
      const byId = String(b.id).localeCompare(String(a.id), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (byId !== 0) return byId;
      return a.subId - b.subId;
    });
  }, [filteredRequests]);

  const totalPages = useMemo(() => {
    if (pageSize === "all") return 1;
    const ps = Math.max(1, Number(pageSize)) || 20;
    return Math.max(1, Math.ceil(sortedFilteredRequests.length / ps));
  }, [sortedFilteredRequests.length, pageSize]);

  const paginatedRowData = useMemo(() => {
    if (pageSize === "all") return sortedFilteredRequests;
    const ps = Math.max(1, Number(pageSize)) || 20;
    const start = (currentPage - 1) * ps;
    return sortedFilteredRequests.slice(start, start + ps);
  }, [sortedFilteredRequests, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, raisedFrom, raisedTo, systemFilter, entitlementFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Req Id",
        field: "id",
        flex: 0.85,
        minWidth: 130,
        sortable: true,
        sort: "desc",
        cellClass: "track-request-id-cell",
        cellRenderer: (params: ICellRendererParams) => {
          const data = params.data as Request | undefined;
          if (!data) return null;
          const routeId = data.routeId;
          return (
            <div className="flex h-full w-full min-w-0 items-center gap-1.5">
              {routeId ? (
                <button
                  type="button"
                  className="tabular-nums text-blue-600 hover:underline focus:outline-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(
                      `/track-request/${encodeURIComponent(String(routeId))}`
                    );
                  }}
                >
                  {data.id}
                </button>
              ) : (
                <span className="tabular-nums">{data.id}</span>
              )}
              {data.hasConflict ? (
                <span
                  className="inline-flex shrink-0 items-center rounded border border-red-400 bg-red-50 px-1 py-0.5 text-[11px] font-normal uppercase leading-none text-red-600"
                  title="Segregation of duties (SOD) conflict"
                >
                  SOD
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        headerName: "Sub Id",
        field: "subId",
        flex: 0.35,
        minWidth: 100,
        maxWidth: 120,
        sortable: true,
        cellClass: "tabular-nums",
      },
      {
        headerName: "Requester",
        field: "requesterName",
        flex: 0.85,
        minWidth: 130,
        sortable: true,
        ...wrappedTextCol,
      },
      {
        headerName: "Beneficiary",
        field: "beneficiaryName",
        flex: 0.9,
        minWidth: 140,
        sortable: true,
        ...wrappedTextCol,
      },
      {
        headerName: "Raised On",
        field: "raisedOn",
        flex: 0.7,
        minWidth: 130,
        cellClass: "text-left",
        headerClass: "text-left",
        ...wrappedTextCol,
        valueGetter: (params) => params.data?.details?.dateCreated ?? "-",
      },
      {
        headerName: "Expiry Date",
        field: "expiryDate",
        flex: 0.7,
        minWidth: 140,
        cellClass: "text-left",
        headerClass: "text-left",
        ...wrappedTextCol,
        valueGetter: (params) => {
          const iso = params.data?.expiryDate as string | undefined;
          if (!iso) return "-";
          const formatted = formatTrackDate(iso);
          return formatted || "-";
        },
      },
      {
        headerName: "Req Type",
        field: "entityType",
        flex: 0.7,
        minWidth: 130,
        ...wrappedTextCol,
        valueGetter: (params) =>
          params.data?.details?.type || params.data?.entityType || "-",
      },
      {
        headerName: "System",
        field: "systemName",
        flex: 1,
        minWidth: 140,
        ...wrappedTextCol,
        valueGetter: (params) => params.data?.systemName || "-",
      },
      {
        headerName: "Entitlement",
        // Widest of the text columns — entitlement names are the longest values here.
        field: "entitlementName",
        flex: 1.5,
        minWidth: 180,
        ...wrappedTextCol,
        valueGetter: (params) => params.data?.entitlementName || "-",
      },
      {
        headerName: "Status",
        field: "status",
        flex: 1.1,
        minWidth: 190,
        ...wrappedTextCol,
        cellRenderer: (params: ICellRendererParams) => {
          const status = params.data?.status as string;
          return (
            <div className="flex w-full min-w-0 items-center py-0.5">
              <span
                className={`min-w-0 flex-1 whitespace-normal break-words px-2 py-1 text-xs font-normal leading-snug rounded-md ${getAccessRequestStatusBadgeClasses(
                  status
                )}`}
              >
                {status}
              </span>
            </div>
          );
        },
      },
    ],
    [router]
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-3 border-b border-gray-300 pb-2 text-blue-950">
        Track requests
      </h1>

      {/* Search and Filter Section — full-width white box; every control sits in a single row */}
      <div className="mb-6 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex w-full flex-wrap items-end gap-4">
          <div className="relative w-72 shrink-0">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Search
            </label>
            <Search className="absolute left-3 top-9 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Request ID, Requester, Beneficiary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as MyApprovalsStatusFilter)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              {MY_APPROVALS_STATUS_SELECT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[220px] flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Raised On
            </label>
            <DateRangeFilter
              label="Raised On"
              dateFrom={raisedFrom}
              dateTo={raisedTo}
              onChange={(from, to) => {
                setRaisedFrom(from);
                setRaisedTo(to);
              }}
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              System
            </label>
            <input
              type="text"
              placeholder="e.g. Workday"
              value={systemFilter}
              onChange={(e) => setSystemFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Entitlement
            </label>
            <input
              type="text"
              placeholder="e.g. Finance Admin"
              value={entitlementFilter}
              onChange={(e) => setEntitlementFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setRaisedFrom("");
              setRaisedTo("");
              setSystemFilter("");
              setEntitlementFilter("");
            }}
            className="h-[38px] shrink-0 whitespace-nowrap text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* Requests Table (AG Grid) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="mb-1 border-b border-gray-100">
          <CustomPagination
            totalItems={sortedFilteredRequests.length}
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
          className="ag-theme-quartz track-request-grid w-full"
          style={{ width: "100%", minWidth: 0 }}
        >
          <AgGridReact
            rowData={paginatedRowData}
            columnDefs={columnDefs}
            rowClassRules={{
              "track-request-row-striped": (params) =>
                (params.node.rowIndex ?? 0) % 2 === 1,
            }}
            rowSelection="single"
            rowModelType="clientSide"
            animateRows={true}
            domLayout="autoHeight"
            suppressRowTransform={true}
            pagination={false}
            headerHeight={44}
            defaultColDef={{
              sortable: true,
              filter: false,
              resizable: true,
              wrapHeaderText: false,
              autoHeaderHeight: false,
            }}
            onGridReady={(params) => {
              try {
                params.api.sizeColumnsToFit();
              } catch {
                // ignore
              }
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
            suppressSizeToFit={false}
          />
        </div>
        <div className="mt-1">
          <CustomPagination
            totalItems={sortedFilteredRequests.length}
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

      {/* Empty State */}
      {/* {filteredRequests.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">No requests found</p>
          <p className="text-gray-400 text-sm mt-2">
            Try adjusting your search criteria
          </p>
        </div>
      )} */}
    </div>
  );
};

export default TrackRequest;
