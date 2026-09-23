"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { ColDef, ICellRendererParams } from "ag-grid-enterprise";
import { CircleCheck, CircleX } from "lucide-react";
import { getReviewerId } from "@/lib/auth";
import "@/lib/ag-grid-setup";
import {
  type MyApprovalsStatusFilter,
  type PendingApprovalStatus,
  MY_APPROVALS_STATUS_SELECT_OPTIONS,
} from "@/lib/my-approvals-status-filters";
import CustomPagination from "@/components/agTable/CustomPagination";

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

type PendingApproval = {
  id: string;
  /** 1-based position of this access item within its parent request. */
  subId: number;
  /** Workflow task id — the approver-action API's path/payload identifier for this request. */
  taskId: string;
  /** Reviewer (assignee) id the approver-action API call is scoped to. */
  reviewerId: string;
  /** This item's identifiers for the approver-action payload. */
  lineItemId: string;
  catalogId: string;
  requester: string;
  beneficiary: string;
  createdOn: string;
  lastActedOn: string;
  /** ISO date string: creation date + 14 days (for Expiry Date column). */
  expiryDate: string;
  reqType: string;
  systemName: string;
  entitlementName: string;
  status: PendingApprovalStatus;
  /** True when API / SOD evaluation reports a segregation-of-duties conflict for this request. */
  hasConflict?: boolean;
};

// Fallback mock data used only when API returns no records
const mockDataFallback: PendingApproval[] = [];

const formatDateToMMDDYY = (value: string): string => {
  if (!value) return "";

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    const yy = String(parsed.getFullYear()).slice(-2);
    return `${mm}-${dd}-${yy}`;
  }

  const normalized = value.trim().replace(/\//g, "-");
  const parts = normalized.split("-");

  // Support YYYY-MM-DD
  if (parts.length >= 3 && parts[0].length === 4) {
    const yy = parts[0].slice(-2);
    const mm = parts[1].padStart(2, "0");
    const dd = parts[2].padStart(2, "0");
    return `${mm}-${dd}-${yy}`;
  }

  // Support DD-MM-YYYY
  if (parts.length >= 3 && parts[2].length === 4) {
    const yy = parts[2].slice(-2);
    const mm = parts[1].padStart(2, "0");
    const dd = parts[0].padStart(2, "0");
    return `${mm}-${dd}-${yy}`;
  }

  return value;
};

/** Calendar days after creation (used for approval expiry display). */
const APPROVAL_EXPIRY_DAYS = 14;

function addDaysToCreatedOn(createdOn: string, days: number): string {
  if (!createdOn) return "";
  const d = new Date(createdOn);
  if (Number.isNaN(d.getTime())) return "";
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out.toISOString();
}

async function fetchPendingApprovals(): Promise<PendingApproval[]> {
  const reviewerId = getReviewerId();

  if (!reviewerId) {
    console.warn("No reviewerId found in cookies; returning empty pending approvals list.");
    return [];
  }

  const response = await fetch(
    "https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Add authorization here if required, e.g. Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query:
          "select * from kf_wf_get_approval_task where assignee_id = ?::uuid AND task_status = 'OPEN'",
        parameters: [reviewerId],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to load pending approvals (${response.status})`);
  }

  const json = await response.json();

  const toStringSafe = (value: unknown) =>
    value === null || value === undefined ? "" : String(value);
  const pick = (row: Record<string, any>, keys: string[]) => {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
  };

  const rows: any[] = Array.isArray(json)
    ? json
    : Array.isArray((json as any)?.resultSet)
    ? (json as any).resultSet
    : Array.isArray((json as any)?.data)
    ? (json as any).data
    : Array.isArray((json as any)?.rows)
    ? (json as any).rows
    : [];

  return rows.flatMap((row, index) => {
    const statusRaw = toStringSafe(
      pick(row, ["status", "task_status", "taskStatus", "STATE", "state"]) ||
        "Pending"
    );

    const normalizedStatus =
      (["Pending", "Approved", "Rejected", "Info Requested"] as const).find(
        (s) => s.toLowerCase() === String(statusRaw).toLowerCase()
      ) ?? "Pending";

    const createdOn = toStringSafe(
      pick(row, [
        "created_on",
        "createdOn",
        "created_at",
        "assigned_on",
        "assignedOn",
        "start_date",
        "requested_on",
      ])
    );

    const lastActedOn = toStringSafe(
      pick(row, [
        "last_acted_on",
        "lastActedOn",
        "updated_at",
        "modified_at",
        "expires_on",
        "expiresOn",
        "due_date",
        "expiry_date",
      ])
    );

    const requester = toStringSafe(
      row?.requester?.displayname ??
        pick(row, [
          "requester_name",
          "requestor_name",
          "requester",
          "requested_by_name",
          "requested_by",
        ])
    );

    const beneficiary = toStringSafe(
      row?.beneficiary?.username ??
        pick(row, [
          "beneficiary_name",
          "beneficiary",
          "user_name",
          "account_name",
          "requested_for",
        ])
    );

    const requestJson =
      row?.request_json ??
      row?.requestJson ??
      row?.request ??
      row?.data ??
      {};

    // Task rows often expose sodResults on context_json (approval API). Also support workflow payload shape.
    const contextJsonFromRow = row?.context_json ?? row?.contextJson ?? null;
    const contextJsonFromWorkflow =
      requestJson?.workflow_instance?.context_json ??
      requestJson?.workflowInstance?.context_json ??
      requestJson?.workflow_instance?.contextJson ??
      requestJson?.workflowInstance?.contextJson ??
      null;

    // Mirror Track Request: sodResults may live on task context_json or workflow_instance.context_json.
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
    const conflictingRoles: string[] = Array.isArray(sodResults?.conflictingRoles)
      ? sodResults.conflictingRoles.map((r: any) => String(r).trim()).filter(Boolean)
      : [];

    // Catalog-based per-item detail — same shape used by the request detail page and by
    // Track Request (row.itemdetails: [{ catalog: { name, applicationname, type, ... } }]).
    const itemDetailsRaw = row.itemdetails ?? row.itemDetails;
    const itemDetails: any[] = Array.isArray(itemDetailsRaw)
      ? itemDetailsRaw
      : itemDetailsRaw && typeof itemDetailsRaw === "object"
      ? Object.values(itemDetailsRaw)
      : [];

    const requestId = toStringSafe(
      pick(row, [
        "request_id",
        "requestid",
        "req_id",
        "task_id",
        "taskid",
        "taskId",
        "id",
        "requestId",
      ]) || index + 1
    );
    const taskId = toStringSafe(
      pick(row, ["task_id", "taskId", "taskid", "id"]) || requestId
    );
    const rowReviewerId = toStringSafe(
      row.assignee_id ?? row.assigneeId ?? row.reviewer_id ?? row.reviewerId ?? reviewerId
    );

    // One row per requested access item; a request with no catalog items still gets a single
    // row (using whatever entity-level fields the row itself carries) so it never disappears.
    const itemsToRender: any[] = itemDetails.length > 0 ? itemDetails : [{}];

    return itemsToRender.map((item, itemIdx) => {
      const catalog = item?.catalog ?? {};
      const entitlementName = toStringSafe(
        catalog.name ?? catalog.entitlementname ?? item?.entityName ?? item?.name
      );
      const systemName = toStringSafe(
        catalog.applicationname ?? catalog.applicationName ?? item?.applicationName
      );
      const reqType = toStringSafe(
        catalog.type ?? catalog.entitlementtype ?? item?.type ?? item?.entityType ?? "Entitlement"
      );

      const nameKey = entitlementName.trim();
      const idKey = String(
        catalog?.catalogid ??
          catalog?.catalogId ??
          catalog?.entitlementid ??
          catalog?.entitlementId ??
          item?.id ??
          item?.entitlementId ??
          item?.entitlement_id ??
          ""
      ).trim();
      const itemHasConflict =
        Boolean(item?.hasConflict ?? item?.has_conflict) ||
        (hasGlobalSodConflict &&
          (conflictingRoles.length === 0 ||
            conflictingRoles.some((name) => name === nameKey || name === idKey)));

      // Identifiers the approver-action API expects for this line item — same field
      // resolution the request detail page uses to build its submit payload.
      const requestedItemId = toStringSafe(
        item?.requested_itemid ?? item?.requestedItemId ?? item?.requesteditemid ?? ""
      );
      const catalogId = toStringSafe(
        catalog?.catalogid ?? catalog?.catalogId ?? catalog?.catalog_id ?? catalog?.id ?? ""
      );
      const entitlementId = toStringSafe(
        catalog?.entitlementid ??
          catalog?.entitlementId ??
          item?.entitlement_id ??
          item?.entitlementId ??
          item?.lineItemId ??
          item?.line_item_id ??
          item?.id ??
          ""
      );
      const lineItemId = requestedItemId || catalogId || entitlementId;

      return {
        id: requestId,
        subId: itemIdx + 1,
        taskId,
        reviewerId: rowReviewerId,
        lineItemId,
        catalogId: catalogId || entitlementId,
        requester,
        beneficiary,
        createdOn,
        lastActedOn,
        expiryDate: addDaysToCreatedOn(createdOn, APPROVAL_EXPIRY_DAYS),
        reqType,
        systemName,
        entitlementName,
        status: normalizedStatus,
        hasConflict:
          itemHasConflict ||
          (itemDetails.length === 0 &&
            (Boolean(row.hasConflict ?? row.has_conflict) || hasGlobalSodConflict)),
      };
    });
  });
}

const PendingApprovalsPage: React.FC = () => {
  const [gridApi, setGridApi] = useState<any | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const {
    data: pendingApprovals = mockDataFallback,
    isLoading,
    isError,
    error,
  } = useQuery<PendingApproval[], Error>({
    queryKey: ["pending-approvals"],
    queryFn: fetchPendingApprovals,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<MyApprovalsStatusFilter>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const [actionLoadingKey, setActionLoadingKey] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<Record<string, string | null>>({});

  const rowKey = (row: PendingApproval) => `${row.id}_${row.subId}`;

  const handleQuickAction = useCallback(
    async (row: PendingApproval, action: "approve" | "reject") => {
      const key = rowKey(row);
      if (actionLoadingKey[key]) return;

      setActionLoadingKey((prev) => ({ ...prev, [key]: true }));
      setActionError((prev) => ({ ...prev, [key]: null }));

      try {
        const parsedLineItemId = Number(row.lineItemId);
        const payload = {
          taskid: row.taskId,
          overallAction: "",
          comments: "",
          lineItems: [
            {
              catalogId: row.catalogId || null,
              lineItemId: Number.isFinite(parsedLineItemId) ? parsedLineItemId : row.lineItemId,
              ACTION: action === "approve" ? "APPROVE" : "REJECT",
              comments: action === "approve" ? "Approved via UI" : "Revoked via UI",
              entitlementName: null,
            },
          ],
        };

        const response = await fetch(
          `https://preview.keyforge.ai/workflow/api/v1/ACMECOM/approveraction/${row.reviewerId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          throw new Error(`Approver action failed (${response.status})`);
        }

        await queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      } catch (err: unknown) {
        setActionError((prev) => ({
          ...prev,
          [key]: err instanceof Error ? err.message : `Failed to ${action}`,
        }));
      } finally {
        setActionLoadingKey((prev) => ({ ...prev, [key]: false }));
      }
    },
    [actionLoadingKey, queryClient]
  );

  const parseInputDate = (value: string): Date | null => {
    if (!value) return null;
    const parts = value.split("-");
    if (parts.length !== 3) return null;
    const [yyyy, mm, dd] = parts.map((p) => Number(p));
    if (!mm || !dd || !yyyy) return null;
    return new Date(yyyy, mm - 1, dd);
  };

  const filteredData: PendingApproval[] = useMemo(() => {
    const source = pendingApprovals.length ? pendingApprovals : mockDataFallback;

    const query = searchQuery.trim().toLowerCase();
    const from = parseInputDate(fromDate);
    const to = parseInputDate(toDate);

    return source.filter((row) => {
      if (query) {
        const matchesSearch =
          row.requester.toLowerCase().includes(query) ||
          row.beneficiary.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      const assigned = parseInputDate(row.createdOn);
      if (from && assigned && assigned < from) return false;
      if (to && assigned && assigned > to) return false;

      if (statusFilter !== "All") {
        if (row.status !== statusFilter) return false;
      }

      return true;
    });
  }, [pendingApprovals, searchQuery, fromDate, toDate, statusFilter]);

  /** Newest Req ID first — aligns with grid default sort and pagination slicing. */
  /**
   * Newest / highest request IDs first — matches default ID column sort and keeps pages aligned
   * with slicing. Rows of the same request stay grouped in sub-ID order.
   */
  const sortedFilteredData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const byId = String(b.id).localeCompare(String(a.id), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (byId !== 0) return byId;
      return a.subId - b.subId;
    });
  }, [filteredData]);

  const totalPages = useMemo(() => {
    if (pageSize === "all") return 1;
    const ps = Math.max(1, Number(pageSize)) || 20;
    return Math.max(1, Math.ceil(sortedFilteredData.length / ps));
  }, [sortedFilteredData.length, pageSize]);

  const paginatedRowData = useMemo(() => {
    if (pageSize === "all") return sortedFilteredData;
    const ps = Math.max(1, Number(pageSize)) || 20;
    const start = (currentPage - 1) * ps;
    return sortedFilteredData.slice(start, start + ps);
  }, [sortedFilteredData, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, fromDate, toDate, statusFilter]);

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
        cellClass: "pending-approvals-req-id-cell",
        cellRenderer: (params: ICellRendererParams) => {
          const data = params.data as PendingApproval | undefined;
          if (!data) return null;
          const requestId = data.id;
          return (
            <div className="flex h-full w-full min-w-0 items-center gap-1.5">
              {requestId ? (
                <button
                  type="button"
                  className="tabular-nums text-blue-600 hover:underline focus:outline-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(
                      `/access-request/pending-approvals/${encodeURIComponent(
                        String(requestId)
                      )}`
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
        field: "requester",
        flex: 0.85,
        minWidth: 130,
        sortable: true,
      },
      {
        headerName: "Beneficiary",
        field: "beneficiary",
        flex: 0.9,
        minWidth: 140,
        sortable: true,
      },
      {
        headerName: "Raised On",
        field: "createdOn",
        flex: 0.7,
        minWidth: 130,
        cellClass: "text-left",
        headerClass: "text-left",
        valueFormatter: (params) => formatDateToMMDDYY(params.value ?? ""),
      },
      {
        headerName: "Expiry Date",
        field: "expiryDate",
        flex: 0.7,
        minWidth: 140,
        cellClass: "text-left",
        headerClass: "text-left",
        valueFormatter: (params) => formatDateToMMDDYY(params.value ?? ""),
      },
      {
        headerName: "Req Type",
        field: "reqType",
        flex: 0.7,
        minWidth: 130,
      },
      {
        headerName: "System",
        field: "systemName",
        flex: 1,
        minWidth: 140,
        valueGetter: (params) => (params.data as PendingApproval | undefined)?.systemName || "-",
      },
      {
        headerName: "Entitlement",
        field: "entitlementName",
        flex: 1.5,
        minWidth: 180,
        valueGetter: (params) =>
          (params.data as PendingApproval | undefined)?.entitlementName || "-",
      },
      {
        headerName: "Action",
        field: "action",
        flex: 0.6,
        minWidth: 130,
        maxWidth: 150,
        sortable: false,
        cellClass: "pending-approvals-action-cell",
        cellRenderer: (params: ICellRendererParams) => {
          const data = params.data as PendingApproval | undefined;
          if (!data) return null;
          const key = rowKey(data);
          const isLoading = actionLoadingKey[key] ?? false;
          const rowError = actionError[key] ?? null;
          return (
            <div className="flex w-full min-w-0 flex-col justify-center gap-0.5 py-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Approve"
                  aria-label="Approve"
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickAction(data, "approve");
                  }}
                  className={`inline-flex items-center justify-center rounded ${
                    isLoading ? "cursor-not-allowed opacity-60" : ""
                  }`}
                >
                  <CircleCheck color="#1c821cff" strokeWidth={1} size={26} fill="none" />
                </button>
                <button
                  type="button"
                  title="Revoke"
                  aria-label="Revoke"
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickAction(data, "reject");
                  }}
                  className={`inline-flex items-center justify-center rounded ${
                    isLoading ? "cursor-not-allowed opacity-60" : ""
                  }`}
                >
                  <CircleX color="#FF2D55" strokeWidth={1} size={26} fill="none" />
                </button>
              </div>
              {rowError && <div className="text-[10px] text-red-600">{rowError}</div>}
            </div>
          );
        },
      },
    ],
    [router, actionLoadingKey, actionError, handleQuickAction]
  );

  const fitGrid = useCallback(() => {
    if (!gridApi) return;
    try {
      gridApi.sizeColumnsToFit();
      gridApi.resetRowHeights();
    } catch {
      // ignore
    }
  }, [gridApi]);

  useEffect(() => {
    fitGrid();
  }, [fitGrid, pathname, currentPage, pageSize, paginatedRowData.length]);

  useEffect(() => {
    const refitSoon = () => {
      requestAnimationFrame(() => {
        fitGrid();
        setTimeout(fitGrid, 50);
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refitSoon();
    };

    window.addEventListener("pageshow", refitSoon);
    window.addEventListener("focus", refitSoon);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", refitSoon);
      window.removeEventListener("focus", refitSoon);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fitGrid]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="w-full">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            My Approvals
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Review pending access requests. Click a row to open its full
            detail and take action.
          </p>
          {isLoading && (
            <p className="text-xs text-gray-500 mt-1">
              Loading pending approvals from server...
            </p>
          )}
          {isError && (
            <p className="text-xs text-red-500 mt-1">
              Failed to load pending approvals
              {error?.message ? `: ${error.message}` : ""}
            </p>
          )}
        </div>

        {/* White box: Search, Status, Date From, Date To — one row on lg */}
        <div className="mb-4 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid w-full max-w-7xl grid-cols-1 gap-3 md:grid-cols-2 md:items-end lg:grid-cols-5">
            <div className="min-w-0 lg:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Search (Requester, Beneficiary)
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type a requester or beneficiary name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:max-w-none"
              />
            </div>
            <div className="min-w-0 w-full">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as MyApprovalsStatusFilter)
                }
                className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {MY_APPROVALS_STATUS_SELECT_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 w-full">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Date Assigned (From)
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div className="min-w-0 w-full">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Date Assigned (To)
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>

        <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="mb-1 border-b border-gray-100">
              <CustomPagination
                totalItems={sortedFilteredData.length}
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
              className="ag-theme-quartz my-approvals-grid w-full"
              style={{ width: "100%", minWidth: 0 }}
            >
              <AgGridReact
                rowData={paginatedRowData}
                columnDefs={columnDefs}
              rowClassRules={{
                "my-approvals-row-striped": (params) =>
                  (params.node.rowIndex ?? 0) % 2 === 1,
              }}
              rowSelection="single"
              rowModelType="clientSide"
              animateRows
              domLayout="autoHeight"
              pagination={false}
              suppressRowTransform
              defaultColDef={{
                sortable: true,
                filter: false,
                resizable: true,
                wrapHeaderText: false,
                autoHeaderHeight: false,
              }}
              onGridReady={(params) => {
                setGridApi(params.api);
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
              />
            </div>
            <div className="mt-1">
              <CustomPagination
                totalItems={sortedFilteredData.length}
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
        </div>
    </div>
  );
};

export default PendingApprovalsPage;
