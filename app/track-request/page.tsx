"use client";
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
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
  beneficiaryName: string;
  requesterName: string;
  displayName: string;
  entityType: string;
  daysOpen: number;
  status: string;
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
          .map((row) => {
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

          const accessRequest = requestJson.access_request ?? {};
          const requestedBy = accessRequest.requested_by ?? {};
          const requestedFor = accessRequest.requested_for ?? {};
          const accessItems: any[] = Array.isArray(requestJson.access_items) ? requestJson.access_items : [];
          const hasConflictFromItems = accessItems.some((item: any) =>
            Boolean(item?.hasConflict ?? item?.has_conflict)
          );
          const firstItem = accessItems[0] ?? {};
          const catalog = firstItem.catalog ?? {};
          const entitlementMeta = firstItem.entitlement_metadata ?? {};

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

          const primaryDisplayName =
            catalog.name || catalog.entitlementname || catalog.applicationName || catalog.applicationname || "";
          const displayNameFromCatalog =
            accessItems.length > 1 && primaryDisplayName
              ? `${primaryDisplayName} +${accessItems.length - 1} more`
              : primaryDisplayName;

          const entityTypeFromCatalog =
            catalog.type || catalog.entitlementtype || (catalog.metadata?.entitlementType as string) || "Entitlement";

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

          const justification: string =
            (accessRequest.justification as string) || (entitlementMeta.comments as string) || "";

          const startDate = entitlementMeta.startDate ? String(entitlementMeta.startDate) : raisedOn;
          const endDate = entitlementMeta.endDate ? String(entitlementMeta.endDate) : "";
          const workflowInstanceId = requestJson?.workflow_instance?.id;

          return {
            id:
              workflowInstanceId ??
              row.request_id ??
              accessRequest.id ??
              row.requestid ??
              row.id ??
              "",
            routeId:
              workflowInstanceId ??
              row.request_id ??
              accessRequest.id ??
              row.requestid ??
              row.id ??
              "",
            beneficiaryName: String(beneficiaryNameFromObject),
            requesterName: String(requesterNameFromObject),
            displayName: String(displayNameFromCatalog),
            entityType: String(entityTypeFromCatalog),
            daysOpen,
            status,
            hasConflict:
              Boolean(row.hasConflict ?? row.has_conflict) ||
              hasGlobalSodConflict ||
              hasConflictFromItems,
            expiryDate: addDaysToCreatedOn(requestedOn ?? "", TRACK_REQUEST_EXPIRY_DAYS),
            canWithdraw: status.toLowerCase().includes("awaiting") || status.toLowerCase().includes("pending"),
            canProvideAdditionalDetails: status.toLowerCase().includes("provide information"),
            details: {
              dateCreated: raisedOn,
              type: String(entityTypeFromCatalog),
              name: String(displayNameFromCatalog || ""),
              justification,
              startDate,
              endDate,
              globalComments: justification || undefined,
            },
            history: [],
          };
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

    return true;
  });

  /** Newest / highest IDs first — matches default ID column sort and keeps pages aligned with slicing. */
  const sortedFilteredRequests = useMemo(() => {
    return [...filteredRequests].sort((a, b) =>
      String(b.id).localeCompare(String(a.id), undefined, { numeric: true, sensitivity: "base" })
    );
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
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "ID",
        field: "id",
        flex: 0.55,
        minWidth: 120,
        maxWidth: 160,
        sortable: true,
        sort: "desc",
        sortIndex: 0,
        cellClass: "track-request-id-cell",
        cellRenderer: (params: ICellRendererParams) => {
          const data = params.data as Request | undefined;
          if (!data) return null;
          return (
            <div className="flex h-full w-full min-w-0 items-center gap-1.5">
              <span className="tabular-nums">{data.id}</span>
              {data.hasConflict ? (
                <span
                  className="inline-flex shrink-0 items-center rounded border border-red-400 bg-red-50 px-1 py-0.5 text-[10px] font-normal uppercase leading-none text-red-600"
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
        headerName: "Type",
        field: "requestType",
        flex: 0.65,
        minWidth: 120,
        ...wrappedTextCol,
        valueGetter: (params) =>
          params.data?.details?.type ?? params.data?.entityType ?? "-",
      },
      {
        headerName: "Requester",
        field: "requesterName",
        flex: 0.75,
        minWidth: 130,
        sortable: true,
        ...wrappedTextCol,
      },
      {
        headerName: "Beneficiary",
        field: "beneficiaryName",
        flex: 0.88,
        minWidth: 150,
        sortable: true,
        ...wrappedTextCol,
      },
      {
        headerName: "Raised On",
        field: "raisedOn",
        flex: 0.8,
        minWidth: 140,
        cellClass: "text-left",
        headerClass: "text-left",
        ...wrappedTextCol,
        valueGetter: (params) => params.data?.details?.dateCreated ?? "-",
      },
      {
        headerName: "Expiry Date",
        field: "expiryDate",
        flex: 0.8,
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
        headerName: "Comments",
        field: "comments",
        // Keep comments as the dominant column when grid auto-adjusts.
        flex: 5.75,
        minWidth: 400,
        ...wrappedTextCol,
        valueGetter: (params) => params.data?.details?.globalComments ?? "-",
      },
      {
        headerName: "Status",
        field: "status",
        flex: 0.85,
        minWidth: 180,
        ...wrappedTextCol,
        cellRenderer: (params: ICellRendererParams) => {
          const status = params.data?.status as string;
          const routeId = params.data?.routeId as string | number | undefined;
          return (
            <div className="flex w-full min-w-0 items-center justify-between gap-2 py-0.5">
              <span
                className={`min-w-0 flex-1 whitespace-normal break-words px-2 py-1 text-xs font-normal leading-snug rounded-md ${getAccessRequestStatusBadgeClasses(
                  status
                )}`}
              >
                {status}
              </span>
              {routeId ? (
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  aria-label="Open request"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(
                      `/track-request/${encodeURIComponent(String(routeId))}`
                    );
                  }}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              ) : null}
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

      {/* Search and Filter Section — full-width white box; controls keep original max width */}
      <div className="mb-6 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="max-w-xl md:max-w-2xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
            <div className="relative min-w-0 md:flex-1">
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
            <div className="w-full shrink-0 md:w-52">
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
          </div>
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
              wrapHeaderText: true,
              autoHeaderHeight: true,
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
