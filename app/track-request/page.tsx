"use client";
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
const AgGridReact = dynamic(() => import("ag-grid-react").then((mod) => mod.AgGridReact), { ssr: false });
import "@/lib/ag-grid-setup";
import { ColDef, ICellRendererParams } from "ag-grid-enterprise";
import { getReviewerId, apiRequestWithAuth, getCurrentUser, getCookie, COOKIE_NAMES } from "@/lib/auth";
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

    const baseUrl = `https://preview.keyforge.ai/workflow/api/v1/ACMECOM/request/raisedby/${encodeURIComponent(
      String(reviewerId).trim()
    )}`;
    setLoading(true);
    setError(null);

    /** Response is a page of submissions: { dbResponse: { data: [...], page: { totalPages, ... } } }. */
    const fetchPage = (page: number) =>
      apiRequestWithAuth<any>(`${baseUrl}?page=${page}&size=100`, { method: "GET" });

    const extractPageItems = (pageData: any): any[] =>
      Array.isArray(pageData?.dbResponse?.data) ? pageData.dbResponse.data : [];

    fetchPage(0)
      .then(async (firstPageData) => {
        console.log("Track Request (table) API raw response (page 0):", firstPageData);
        const totalPages: number = Number(firstPageData?.dbResponse?.page?.totalPages ?? 1) || 1;

        let allSubmissions = extractPageItems(firstPageData);
        if (totalPages > 1) {
          const remainingPages = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(i + 1))
          );
          for (const pageData of remainingPages) {
            allSubmissions = allSubmissions.concat(extractPageItems(pageData));
          }
        }
        return allSubmissions;
      })
      .then((submissions: any[]) => {
        if (!submissions || submissions.length === 0) {
          setRequests([]);
          return;
        }

        // uidTenant cookie stores {userid, tenantId} (no email) — same fallback HeaderContent uses.
        const currentUserLabel = (() => {
          try {
            const raw = getCookie(COOKIE_NAMES.UID_TENANT);
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed?.userid) return String(parsed.userid);
          } catch {
            // ignore
          }
          return getCurrentUser()?.email || "";
        })();

        // Tracks workflowInstanceIds already emitted so a duplicate (e.g. an unsplit submission
        // whose items all share one workflowInstanceId) only shows up as a single row.
        const seenWorkflowInstanceIds = new Set<number>();

        const mapped: Request[] = submissions.flatMap((submission) => {
          const createdAt: string | undefined = submission?.createdAt;
          const raisedOn = formatTrackDate(createdAt);
          const daysOpen = Number(submission?.daysOpen ?? 0);
          const justification = String(submission?.justification ?? "");
          const submissionRequestId = String(
            submission?.requestId ?? submission?.submissionId ?? ""
          );

          const beneficiaryNames: string[] = Array.isArray(submission?.requestedForDisplayNames)
            ? submission.requestedForDisplayNames.filter(Boolean)
            : [];
          const beneficiaryName = beneficiaryNames.join(", ") || "-";

          // One grid row per requested access item; a submission with no items still gets a
          // single row so it never disappears from the tracker.
          const itemNames: any[] = Array.isArray(submission?.itemNames) ? submission.itemNames : [];
          const itemsToRender: any[] = itemNames.length > 0 ? itemNames : [{}];

          return itemsToRender
            .map((item, index) => {
              const entitlementName = String(item?.lineitem ?? "");
              const rawStatus = String(item?.status ?? submission?.status ?? "").trim();
              const status = rawStatus ? rawStatus.replace(/_/g, " ") : "Request Submitted";
              const itemRequestUuid = String(item?.requestUuids ?? "").trim();
              const routeId = itemRequestUuid || submissionRequestId;

              const rawWorkflowInstanceId = item?.workflowInstanceIds;
              const workflowInstanceId =
                rawWorkflowInstanceId != null ? Number(rawWorkflowInstanceId) : null;

              if (workflowInstanceId != null) {
                if (seenWorkflowInstanceIds.has(workflowInstanceId)) {
                  return null;
                }
                seenWorkflowInstanceIds.add(workflowInstanceId);
              }

              return {
                id: submissionRequestId,
                routeId,
                subId: workflowInstanceId ?? index + 1,
                beneficiaryName,
                requesterName: currentUserLabel || "-",
                systemName: "",
                entitlementName,
                displayName: entitlementName,
                entityType: "Entitlement",
                daysOpen,
                status,
                raisedOnRaw: createdAt ?? "",
                hasConflict: false,
                expiryDate: addDaysToCreatedOn(createdAt ?? "", TRACK_REQUEST_EXPIRY_DAYS),
                canWithdraw: status.toLowerCase().includes("awaiting") || status.toLowerCase().includes("pending"),
                canProvideAdditionalDetails: status.toLowerCase().includes("provide information"),
                details: {
                  dateCreated: raisedOn,
                  type: "Entitlement",
                  name: entitlementName,
                  justification,
                  startDate: raisedOn,
                  endDate: "",
                  globalComments: justification || undefined,
                },
                history: [],
              };
            })
            .filter((row) => row !== null) as Request[];
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
        flex: 1.15,
        minWidth: 155,
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
        flex: 0.85,
        minWidth: 125,
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
        flex: 0.85,
        minWidth: 165,
        cellRenderer: (params: ICellRendererParams) => {
          const status = params.data?.status as string;
          return (
            <div className="flex w-full min-w-0 items-center py-0.5">
              <span
                className={`min-w-0 whitespace-nowrap px-2 py-1 text-xs font-normal leading-snug rounded-md ${getAccessRequestStatusBadgeClasses(
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
