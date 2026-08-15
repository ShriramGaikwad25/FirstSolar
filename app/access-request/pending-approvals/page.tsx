"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { ColDef, ICellRendererParams } from "ag-grid-enterprise";
import {
  ChevronRight,
  Clock3,
  Info,
  Paperclip,
} from "lucide-react";
import { getReviewerId } from "@/lib/auth";
import "@/lib/ag-grid-setup";
import InsightsIcon from "@/components/InsightsIcon";
import { getAccessRequestStatusBadgeClasses } from "@/lib/access-request-status-badge";
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

type NestedItem = {
  id: string;
  entityName: string;
  type: string;
  description: string;
  duration: string;
  hasInsight?: boolean;
  hasRisk?: boolean;
  hasViolation?: boolean;
};

type PendingApproval = {
  id: string;
  requester: string;
  beneficiary: string;
  createdOn: string;
  lastActedOn: string;
  /** ISO date string: creation date + 14 days (for Expiry Date column). */
  expiryDate: string;
  entityCount: number;
  comments: string;
  status: PendingApprovalStatus;
  hasInsight?: boolean;
  hasRisk?: boolean;
  hasViolation?: boolean;
  /** True when API / SOD evaluation reports a segregation-of-duties conflict for this request. */
  hasConflict?: boolean;
  items: NestedItem[];
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

  return rows.map((row, index) => {
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
    const sodPolicyDetails =
      sodResults?.sodPolicyDetails ?? sodResults?.SODPolicyDetails ?? sodResults?.policyDetails ?? null;
    const conflictingRoles: string[] = Array.isArray(sodResults?.conflictingRoles)
      ? sodResults.conflictingRoles.map((r: any) => String(r).trim()).filter(Boolean)
      : [];
    const primaryConflictingRole = conflictingRoles[0] ?? "";

    const rawItems =
      (Array.isArray(row.items) && row.items) ||
      (Array.isArray(row.line_items) && row.line_items) ||
      [];
    const items: NestedItem[] = rawItems.map((item: any) => {
      // Different APIs may expose the violation signal with different field names/casing.
      const sodConflicts = item?.SoDConflicts ?? item?.sodConflicts ?? item?.SODConflicts;
      const sodConflict = item?.SoDConflict ?? item?.sodConflict ?? item?.SODConflict;
      const nameKey = String(item?.entityName ?? item?.name ?? item?.description ?? "").trim();
      const idKey = String(
        item?.id ??
          item?.entitlementId ??
          item?.entitlement_id ??
          item?.entityId ??
          item?.entity_id ??
          ""
      ).trim();
      const hasConflictFromSodResults =
        hasGlobalSodConflict &&
        Boolean(sodPolicyDetails) &&
        primaryConflictingRole &&
        (nameKey === primaryConflictingRole || idKey === primaryConflictingRole);
      const derivedHasViolation =
        Boolean(
          item?.hasViolation ??
            item?.has_violation ??
            item?.hasConflict ??
            item?.has_conflict ??
            item?.violation ??
            item?.sodViolation
        ) ||
        hasConflictFromSodResults ||
        (Array.isArray(sodConflicts) && sodConflicts.length > 0) ||
        Boolean(item?.SoDConflicts) ||
        (Array.isArray(sodConflict) && sodConflict.length > 0) ||
        Boolean(sodConflict);

      return {
        ...item,
        // Ensure the nested "Insights" cell can show the red SOD badge consistently.
        hasViolation: Boolean(item?.hasViolation ?? item?.has_violation) || derivedHasViolation,
      };
    });
    const hasViolationFromItems = items.some((item: any) => Boolean(item?.hasViolation));
    const hasConflictFromItems = items.some((item: any) =>
      Boolean(item?.hasConflict ?? item?.has_conflict)
    );
    const itemDetails = row.itemdetails ?? row.itemDetails;
    const itemDetailsCount = Array.isArray(itemDetails)
      ? itemDetails.length
      : itemDetails && typeof itemDetails === "object"
      ? Object.keys(itemDetails).length
      : 0;

    return {
      id: toStringSafe(
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
      ),
      requester,
      beneficiary,
      createdOn,
      lastActedOn,
      expiryDate: addDaysToCreatedOn(createdOn, APPROVAL_EXPIRY_DAYS),
      entityCount:
        itemDetailsCount ||
        Number(
          pick(row, [
            "entity_count",
            "entityCount",
            "number_of_entities",
            "items_count",
            "itemsCount",
          ]) ?? items.length
        ) ||
        0,
      comments: toStringSafe(
        pick(row, [
          "requester_justification",
          "comments",
          "comment",
          "remarks",
          "justification",
          "reason",
        ])
      ),
      status: normalizedStatus,
      hasInsight: Boolean(row.hasInsight ?? row.has_insight),
      hasRisk: Boolean(row.hasRisk ?? row.has_risk),
      hasViolation:
        Boolean(row.hasViolation ?? row.has_violation) ||
        hasViolationFromItems ||
        hasGlobalSodConflict,
      hasConflict:
        Boolean(row.hasConflict ?? row.has_conflict) ||
        hasGlobalSodConflict ||
        hasConflictFromItems,
      items,
    };
  });
}

const InsightsCell: React.FC<{
  hasRisk?: boolean;
  hasInsight?: boolean;
  hasViolation?: boolean;
}> = ({ hasViolation }) => {
  const wrap = "flex h-full min-h-[100%] w-full items-center justify-start pl-2";
  if (hasViolation) {
    return (
      <div className={wrap} title="SOD Policy Violation Detected">
        <span className="inline-flex items-center px-4 py-1.5 rounded-md text-[11px] font-semibold border border-red-400 bg-red-50 text-red-600 text-left">
          SOD Policy Violation Detected
        </span>
      </div>
    );
  }
  return (
    <div className={wrap} title="AI Insights">
      <InsightsIcon size={24} className="shrink-0 text-amber-500" />
    </div>
  );
};

type ActionsCellProps = {
  node?: ICellRendererParams["node"];
  onDetailedReview?: () => void;
};

const ActionsCell: React.FC<ActionsCellProps> = ({ node, onDetailedReview }) => {
  const baseBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={baseBtn}
        title="Detailed Review"
        aria-label="Detailed Review"
        onClick={(e) => {
          e.stopPropagation();
          onDetailedReview?.();
        }}
      >
        <ChevronRight className="h-5 w-5 text-gray-500" />
      </button>
    </div>
  );
};

const DetailsCell: React.FC = () => {
  const baseBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={baseBtn}
        title="Comments"
        aria-label="Comments"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 32 32"
          className="cursor-pointer hover:opacity-80"
        >
          <path
            d="M0.700195 0V19.5546H3.5802V25.7765C3.57994 25.9525 3.62203 26.1247 3.70113 26.2711C3.78022 26.4176 3.89277 26.5318 4.02449 26.5992C4.15621 26.6666 4.30118 26.6842 4.44101 26.6498C4.58085 26.6153 4.70926 26.5304 4.80996 26.4058C6.65316 24.1232 10.3583 19.5546 10.3583 19.5546H25.1802V0H0.700195ZM2.1402 1.77769H23.7402V17.7769H9.76212L5.0202 23.6308V17.7769H2.1402V1.77769ZM5.0202 5.33307V7.11076H16.5402V5.33307H5.0202ZM26.6202 5.33307V7.11076H28.0602V23.11H25.1802V28.9639L20.4383 23.11H9.34019L7.9002 24.8877H19.8421C19.8421 24.8877 23.5472 29.4563 25.3904 31.7389C25.4911 31.8635 25.6195 31.9484 25.7594 31.9828C25.8992 32.0173 26.0442 31.9997 26.1759 31.9323C26.3076 31.8648 26.4202 31.7507 26.4993 31.6042C26.5784 31.4578 26.6204 31.2856 26.6202 31.1096V24.8877H29.5002V5.33307H26.6202ZM5.0202 8.88845V10.6661H10.7802V8.88845H5.0202ZM5.0202 12.4438V14.2215H19.4202V12.4438H5.0202Z"
            fill="#2684FF"
          />
        </svg>
      </button>
      <button
        type="button"
        className={baseBtn}
        title="Duration"
        aria-label="Duration"
      >
        <Clock3 className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={baseBtn}
        title="More details"
        aria-label="More details"
      >
        <Info className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={baseBtn}
        title="Attachment details"
        aria-label="Attachment details"
      >
        <Paperclip className="h-4 w-4" />
      </button>
    </div>
  );
};

const PendingApprovalsPage: React.FC = () => {
  const [gridApi, setGridApi] = useState<any | null>(null);
  const router = useRouter();
  const pathname = usePathname();

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
  const sortedFilteredData = useMemo(() => {
    return [...filteredData].sort((a, b) =>
      String(b.id).localeCompare(String(a.id), undefined, { numeric: true, sensitivity: "base" })
    );
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
        headerName: "Req ID",
        field: "id",
        minWidth: 96,
        width: 108,
        cellClass: "pending-approvals-req-id-cell",
        cellRenderer: (params: ICellRendererParams) => {
          const data = params.data as PendingApproval | undefined;
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
        headerName: "Requester",
        field: "requester",
        minWidth: 120,
        width: 140,
      },
      {
        headerName: "Beneficiary",
        field: "beneficiary",
        minWidth: 128,
        width: 145,
      },
      {
        headerName: "Created On",
        field: "createdOn",
        minWidth: 140,
        width: 150,
        sort: "desc",
        cellClass: "text-left",
        headerClass: "text-left",
        valueFormatter: (params) => formatDateToMMDDYY(params.value ?? ""),
      },
      {
        headerName: "Expiry Date",
        field: "expiryDate",
        minWidth: 118,
        width: 128,
        cellClass: "text-left",
        headerClass: "text-left",
        valueFormatter: (params) => formatDateToMMDDYY(params.value ?? ""),
      },
      {
        headerName: "Comments",
        field: "comments",
        minWidth: 380,
        width: 440,
        wrapText: true,
        autoHeight: true,
        cellClass: "pending-approvals-comments-cell",
        cellStyle: {
          whiteSpace: "normal",
          wordBreak: "break-word",
          lineHeight: "1.25",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
        },
      },
      {
        headerName: "Status",
        field: "status",
        minWidth: 180,
        width: 190,
        cellClass: "pending-approvals-status-cell",
        cellRenderer: (params: ICellRendererParams) => {
          const data = params.data as PendingApproval | undefined;
          if (!data) return null;
          const requestId = data.id;
          return (
            <div className="flex w-full min-w-0 items-center justify-between gap-2 py-0.5">
              <span
                className={`min-w-0 flex-1 whitespace-normal break-words px-2 py-1 text-xs font-semibold leading-snug rounded-md ${getAccessRequestStatusBadgeClasses(
                  data.status
                )}`}
              >
                {data.status}
              </span>
              {requestId ? (
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  title="Detailed Review"
                  aria-label="Detailed Review"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(
                      `/access-request/pending-approvals/${encodeURIComponent(
                        String(requestId)
                      )}`
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

  const detailColumnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Entity Name",
        field: "entityName",
        flex: 1.2,
      },
      {
        headerName: "Type",
        field: "type",
        flex: 0.9,
      },
      {
        headerName: "Description",
        field: "description",
        flex: 1.8,
      },
      {
        headerName: "Details",
        field: "details",
        flex: 1.4,
        cellRenderer: () => <DetailsCell />,
      },
      {
        headerName: "Insights",
        field: "insights",
        flex: 1.2,
        cellRenderer: (params: ICellRendererParams) => {
          const data = params.data as NestedItem | undefined;
          if (!data) return null;
          return (
            <InsightsCell
              hasRisk={data.hasRisk}
              hasInsight={data.hasInsight}
              hasViolation={data.hasViolation}
            />
          );
        },
      },
      {
        headerName: "Action",
        field: "action",
        flex: 1.3,
        cellRenderer: () => <ActionsCell />,
      },
    ],
    []
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
    <div className="min-h-screen bg-gray-50">
      <div className="w-full">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            My Approvals
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Review and act on pending access requests. Use Quick View to see
            and act on individual line items.
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
                wrapHeaderText: true,
                autoHeaderHeight: true,
              }}
              masterDetail
              isRowMaster={(dataItem) => {
                const row = dataItem as PendingApproval;
                return !!row && Array.isArray(row.items) && row.items.length > 0;
              }}
              detailCellRendererParams={{
                detailGridOptions: {
                  columnDefs: detailColumnDefs,
                  defaultColDef: {
                    sortable: false,
                    filter: false,
                    resizable: true,
                  },
                },
                getDetailRowData: (params: any) => {
                  const items = (params.data as PendingApproval)?.items ?? [];
                  params.successCallback(items);
                },
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
