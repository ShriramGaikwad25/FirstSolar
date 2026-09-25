"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { ColDef, ICellRendererParams } from "ag-grid-enterprise";
import { CircleCheck, CircleX, Hand } from "lucide-react";
import { getReviewerId, apiRequestWithAuth } from "@/lib/auth";
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
  /** Task-level requestUuid — the detail endpoint's path identifier for this request. */
  requestUuid: string;
  /** 1-based position of this access item within its parent request. */
  subId: number;
  /** Workflow task id — the approver-action API's path/payload identifier for this request. */
  taskId: string;
  /** Reviewer (assignee) id the approver-action API call is scoped to. */
  reviewerId: string;
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
  /** "QUEUE" tasks aren't assigned to a specific user yet — a reviewer must claim one before acting on it. */
  assigneeType?: string;
  claimable?: boolean;
};

// Fallback mock data used only when API returns no records
const mockDataFallback: PendingApproval[] = [];

/** QUEUE tasks that haven't been claimed yet can only be claimed, not approved/rejected in bulk. */
const isQueueClaimable = (data: PendingApproval | undefined | null): boolean =>
  data?.assigneeType === "QUEUE" && data?.claimable === true;

const toStringSafe = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

const normalizeId = (value: unknown): string => toStringSafe(value).trim().toLowerCase();

const toArraySafe = (value: unknown): any[] => (Array.isArray(value) ? value : []);

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

/** Normalizes an itemNames[].status value ("PENDING" / "APPROVE" / "REJECT" / ...) into the shared filter bucket. */
function normalizeItemStatus(value: unknown): PendingApprovalStatus {
  const s = String(value ?? "").trim().toUpperCase();
  if (s.includes("REJECT") || s.includes("DENIED")) return "Rejected";
  if (s.includes("INFO")) return "Info Requested";
  if (s.includes("APPROVE") || s.includes("COMPLETE")) return "Approved";
  return "Pending";
}

async function fetchPendingApprovals(): Promise<PendingApproval[]> {
  const reviewerId = getReviewerId();

  if (!reviewerId) {
    console.warn("No reviewerId found in cookies; returning empty pending approvals list.");
    return [];
  }

  const trimmedReviewerId = String(reviewerId).trim();
  const baseUrl = `https://preview.keyforge.ai/workflow/api/v1/ACMECOM/task/approvals/${encodeURIComponent(
    trimmedReviewerId
  )}`;

  /** Response is a page of tasks: { dbResponse: { data: [...], page: { totalPages, ... } } }. */
  const fetchPage = (page: number) =>
    apiRequestWithAuth<any>(`${baseUrl}?page=${page}&size=100&status=OPEN`, { method: "GET" });

  const extractPageItems = (pageData: any): any[] =>
    Array.isArray(pageData?.dbResponse?.data) ? pageData.dbResponse.data : [];

  const firstPageData = await fetchPage(0);
  console.log("My Approvals (table) API raw response (page 0):", firstPageData);
  const totalPages: number = Number(firstPageData?.dbResponse?.page?.totalPages ?? 1) || 1;

  let allTasks = extractPageItems(firstPageData);
  if (totalPages > 1) {
    const remainingPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(i + 1))
    );
    for (const pageData of remainingPages) {
      allTasks = allTasks.concat(extractPageItems(pageData));
    }
  }

  // Tracks workflowInstanceIds already emitted so a duplicate task/item pairing only
  // shows up as a single row.
  const seenWorkflowInstanceIds = new Set<number>();

  return allTasks.flatMap((task) => {
    const taskId = toStringSafe(task?.taskId);
    const requestId = toStringSafe(task?.requestId);
    const taskRequestUuid = toStringSafe(task?.requestUuid);
    const requester = toStringSafe(task?.requestedByDisplayName) || "-";
    const beneficiary = toStringSafe(task?.requestedForDisplayName) || "-";
    const createdOn = toStringSafe(task?.createdAt ?? task?.openedAt);

    const itemNames: any[] = Array.isArray(task?.itemNames) ? task.itemNames : [];
    const itemsToRender: any[] = itemNames.length > 0 ? itemNames : [{}];

    return itemsToRender
      .map((item, index) => {
        const rawWorkflowInstanceId = item?.workflowInstanceIds;
        const workflowInstanceId =
          rawWorkflowInstanceId != null ? Number(rawWorkflowInstanceId) : null;

        if (workflowInstanceId != null) {
          if (seenWorkflowInstanceIds.has(workflowInstanceId)) return null;
          seenWorkflowInstanceIds.add(workflowInstanceId);
        }

        return {
          id: requestId || taskId,
          requestUuid: toStringSafe(item?.requestUuids) || taskRequestUuid,
          subId: workflowInstanceId ?? index + 1,
          taskId,
          reviewerId: trimmedReviewerId,
          requester,
          beneficiary,
          createdOn,
          lastActedOn: "",
          expiryDate: addDaysToCreatedOn(createdOn, APPROVAL_EXPIRY_DAYS),
          reqType: "Entitlement",
          systemName: "",
          entitlementName: toStringSafe(item?.lineitem),
          status: normalizeItemStatus(item?.status),
          hasConflict: false,
          assigneeType: toStringSafe(task?.assigneeType),
          claimable: Boolean(task?.claimable),
        } as PendingApproval;
      })
      .filter((row): row is PendingApproval => row !== null);
  });
}

/**
 * The list endpoint doesn't return catalog/lineItemId identifiers, so the approver-action
 * payload needs them resolved from the detail endpoint before submitting. itemdetails[].lineitemid
 * there is a "business" id, not what /approveraction expects — the internal id lives in
 * context_json.lineItems[], keyed by catalogId (same mapping the detail page uses).
 */
async function resolveApproverActionIds(
  row: PendingApproval
): Promise<{ catalogId: string | null; lineItemId: number | string }> {
  if (!row.requestUuid) {
    throw new Error("Missing request identifier for this item.");
  }

  const detailUrl = `https://preview.keyforge.ai/workflow/api/v1/ACMECOM/task/approvals/detail/${encodeURIComponent(
    row.requestUuid
  )}`;
  const data = await apiRequestWithAuth<any>(detailUrl, { method: "GET" });
  const tasks: any[] = toArraySafe(data?.dbResponse?.tasks);

  const matchingTask =
    tasks.find((t) => normalizeId(t?.taskid ?? t?.taskId) === normalizeId(row.taskId)) ??
    tasks[tasks.length - 1];

  const itemDetails: any[] = toArraySafe(matchingTask?.itemdetails);
  const targetName = row.entitlementName.trim().toLowerCase();
  const matchedItem =
    itemDetails.find(
      (item) => toStringSafe(item?.catalog?.name).trim().toLowerCase() === targetName
    ) ?? itemDetails[0];

  if (!matchedItem) {
    throw new Error("Could not resolve this item's identifiers.");
  }

  const catalog = matchedItem?.catalog ?? {};
  const requestedItemId = toStringSafe(matchedItem?.requested_itemid);
  const catalogId = toStringSafe(catalog?.catalogid ?? requestedItemId) || null;

  const contextLineItems: any[] = toArraySafe(matchingTask?.context_json?.lineItems);
  const lineItemIdByCatalogId = new Map<string, number>();
  contextLineItems.forEach((cli) => {
    const catId = normalizeId(cli?.catalogId);
    const lid = Number(cli?.lineItemId);
    if (catId && Number.isFinite(lid)) lineItemIdByCatalogId.set(catId, lid);
  });

  const resolvedLineItemId =
    (catalogId && lineItemIdByCatalogId.get(normalizeId(catalogId))) ?? matchedItem?.lineitemid;

  return { catalogId, lineItemId: resolvedLineItemId };
}

/**
 * ag-grid's built-in checkboxSelection cell injection doesn't align well alongside a custom
 * cellRenderer (checkbox ends up floating between rows), so the checkbox is rendered manually
 * here and kept in sync with the row node's selection state instead.
 */
const ReqIdCellRenderer: React.FC<ICellRendererParams> = (params) => {
  const data = params.data as PendingApproval | undefined;
  const [selected, setSelected] = useState<boolean>(() => params.node.isSelected() ?? false);

  useEffect(() => {
    const listener = () => setSelected(params.node.isSelected() ?? false);
    params.node.addEventListener("rowSelected", listener);
    return () => {
      params.node.removeEventListener("rowSelected", listener);
    };
  }, [params.node]);

  if (!data) return null;
  const detailRouteId = data.requestUuid || data.id;
  const selectable = !isQueueClaimable(data);

  return (
    <div className="flex h-full w-full min-w-0 items-center gap-2">
      {selectable ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => params.node.setSelected(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ) : (
        <span className="inline-block w-3.5 shrink-0" aria-hidden />
      )}
      {detailRouteId ? (
        <button
          type="button"
          className="tabular-nums text-blue-600 hover:underline focus:outline-none"
          onClick={(e) => {
            e.stopPropagation();
            params.context?.router?.push(
              `/access-request/pending-approvals/${encodeURIComponent(String(detailRouteId))}`
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
};

const ReqIdHeaderRenderer: React.FC<any> = (params) => {
  const [checkedState, setCheckedState] = useState<"all" | "some" | "none">("none");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const computeState = (): "all" | "some" | "none" => {
      let total = 0;
      let selected = 0;
      params.api.forEachNodeAfterFilterAndSort((node: any) => {
        if (!isQueueClaimable(node.data)) {
          total += 1;
          if (node.isSelected()) selected += 1;
        }
      });
      if (total === 0 || selected === 0) return "none";
      return selected === total ? "all" : "some";
    };

    const update = () => setCheckedState(computeState());
    update();
    params.api.addEventListener("selectionChanged", update);
    params.api.addEventListener("modelUpdated", update);
    return () => {
      params.api.removeEventListener("selectionChanged", update);
      params.api.removeEventListener("modelUpdated", update);
    };
  }, [params.api]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = checkedState === "some";
  }, [checkedState]);

  return (
    <div className="flex h-full items-center gap-2">
      <input
        ref={inputRef}
        type="checkbox"
        checked={checkedState === "all"}
        onChange={(e) => {
          const shouldSelect = e.target.checked;
          params.api.forEachNodeAfterFilterAndSort((node: any) => {
            if (!isQueueClaimable(node.data)) node.setSelected(shouldSelect);
          });
        }}
        className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span>{params.displayName}</span>
    </div>
  );
};

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
  const [claimConfirmRow, setClaimConfirmRow] = useState<PendingApproval | null>(null);
  const [selectedRows, setSelectedRows] = useState<PendingApproval[]>([]);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<"approve" | "reject" | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const rowKey = (row: PendingApproval) => `${row.id}_${row.subId}`;

  const handleQuickAction = useCallback(
    async (row: PendingApproval, action: "approve" | "reject") => {
      const key = rowKey(row);
      if (actionLoadingKey[key]) return;

      setActionLoadingKey((prev) => ({ ...prev, [key]: true }));
      setActionError((prev) => ({ ...prev, [key]: null }));

      try {
        const { catalogId, lineItemId } = await resolveApproverActionIds(row);
        const parsedLineItemId = Number(lineItemId);
        const payload = {
          taskid: row.taskId,
          overallAction: action === "approve" ? "APPROVE" : "REJECT",
          comments: "",
          lineItems: [
            {
              catalogId,
              lineItemId: Number.isFinite(parsedLineItemId) ? parsedLineItemId : lineItemId,
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

  const handleClaim = useCallback(
    async (row: PendingApproval) => {
      const key = rowKey(row);
      if (actionLoadingKey[key]) return;

      setActionLoadingKey((prev) => ({ ...prev, [key]: true }));
      setActionError((prev) => ({ ...prev, [key]: null }));

      try {
        const parsedTaskId = Number(row.taskId);
        const response = await fetch(
          `https://preview.keyforge.ai/workflow/api/v1/ACMECOM/task/claim/${row.reviewerId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: Number.isFinite(parsedTaskId) ? parsedTaskId : row.taskId,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Claim failed (${response.status})`);
        }

        await queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      } catch (err: unknown) {
        setActionError((prev) => ({
          ...prev,
          [key]: err instanceof Error ? err.message : "Failed to claim",
        }));
      } finally {
        setActionLoadingKey((prev) => ({ ...prev, [key]: false }));
      }
    },
    [actionLoadingKey, queryClient]
  );

  const handleBulkAction = useCallback(
    async (rows: PendingApproval[], action: "approve" | "reject") => {
      if (rows.length === 0 || bulkSubmitting) return;

      setBulkSubmitting(true);
      setBulkError(null);

      const failures: string[] = [];
      for (const row of rows) {
        try {
          const { catalogId, lineItemId } = await resolveApproverActionIds(row);
          const parsedLineItemId = Number(lineItemId);
          const payload = {
            taskid: row.taskId,
            overallAction: action === "approve" ? "APPROVE" : "REJECT",
            comments: "",
            lineItems: [
              {
                catalogId,
                lineItemId: Number.isFinite(parsedLineItemId) ? parsedLineItemId : lineItemId,
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
            throw new Error(`Request failed (${response.status})`);
          }
        } catch (err: unknown) {
          failures.push(
            `Req ${row.id} / Sub ${row.subId}: ${err instanceof Error ? err.message : "failed"}`
          );
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      setBulkSubmitting(false);

      if (failures.length > 0) {
        setBulkError(
          `${failures.length} of ${rows.length} item(s) could not be ${action}d — ${failures.join("; ")}`
        );
      } else {
        setSelectedRows([]);
      }
    },
    [bulkSubmitting, queryClient]
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
        minWidth: 150,
        sortable: true,
        sort: "desc",
        cellClass: "pending-approvals-req-id-cell",
        headerComponent: ReqIdHeaderRenderer,
        cellRenderer: ReqIdCellRenderer,
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
          const isClaimable = data.assigneeType === "QUEUE" && data.claimable === true;
          return (
            <div className="flex w-full min-w-0 flex-col justify-center gap-0.5 py-1">
              <div className="flex items-center gap-1.5">
                {isClaimable ? (
                  <button
                    type="button"
                    title="Claim"
                    aria-label="Claim"
                    disabled={isLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      setClaimConfirmRow(data);
                    }}
                    className={`inline-flex items-center justify-center rounded ${
                      isLoading ? "cursor-not-allowed opacity-60" : ""
                    }`}
                  >
                    <Hand color="#2684FF" strokeWidth={1} size={24} fill="none" />
                  </button>
                ) : (
                  <>
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
                  </>
                )}
              </div>
              {rowError && <div className="text-[10px] text-red-600">{rowError}</div>}
            </div>
          );
        },
      },
    ],
    [router, actionLoadingKey, actionError, handleQuickAction, handleClaim]
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
                context={{ router }}
              rowClassRules={{
                "my-approvals-row-striped": (params) =>
                  (params.node.rowIndex ?? 0) % 2 === 1,
              }}
              rowSelection="multiple"
              suppressRowClickSelection
              isRowSelectable={(rowNode: any) => !isQueueClaimable(rowNode?.data)}
              onSelectionChanged={(params) => {
                try {
                  setSelectedRows(params.api.getSelectedRows() as PendingApproval[]);
                } catch {
                  // ignore
                }
              }}
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

        {claimConfirmRow && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3"
            onClick={() => setClaimConfirmRow(null)}
          >
            <div
              className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-gray-900">Claim this task?</h3>
              <p className="mt-1.5 text-sm text-gray-600">
                You&apos;ll be assigned this request and it will no longer be available
                for other reviewers to claim.
              </p>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setClaimConfirmRow(null)}
                  className="rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const row = claimConfirmRow;
                    setClaimConfirmRow(null);
                    if (row) handleClaim(row);
                  }}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Claim
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedRows.length > 0 && (
          <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
            <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-lg">
              <span className="text-sm font-medium text-gray-700">
                {selectedRows.length} selected
              </span>
              <button
                type="button"
                disabled={bulkSubmitting}
                onClick={() => setBulkConfirmAction("approve")}
                className="rounded-full bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={bulkSubmitting}
                onClick={() => setBulkConfirmAction("reject")}
                className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={bulkSubmitting}
                onClick={() => setSelectedRows([])}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear
              </button>
            </div>
            {bulkError && (
              <div className="mt-2 max-w-md rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                {bulkError}
              </div>
            )}
          </div>
        )}

        {bulkConfirmAction && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3"
            onClick={() => setBulkConfirmAction(null)}
          >
            <div
              className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-gray-900">
                {bulkConfirmAction === "approve" ? "Approve" : "Reject"} {selectedRows.length} selected
                item{selectedRows.length === 1 ? "" : "s"}?
              </h3>
              <p className="mt-1.5 text-sm text-gray-600">This action can&apos;t be undone.</p>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBulkConfirmAction(null)}
                  className="rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const action = bulkConfirmAction;
                    setBulkConfirmAction(null);
                    if (action) handleBulkAction(selectedRows, action);
                  }}
                  className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                    bulkConfirmAction === "approve"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {bulkConfirmAction === "approve" ? "Approve" : "Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default PendingApprovalsPage;
