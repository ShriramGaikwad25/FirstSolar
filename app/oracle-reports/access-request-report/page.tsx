"use client";

import React, { useEffect, useState, useCallback } from "react";
import { executeQuery } from "@/lib/api";
import dynamic from "next/dynamic";
import { ColDef, GridApi, themeQuartz } from "ag-grid-community";
import { ChevronRight, Download, Search } from "lucide-react";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import "@/lib/ag-grid-setup";
type AccessRow = Record<string, any>;

function deepGet(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    const num = Number(part);
    if (!Number.isNaN(num) && Array.isArray(current)) {
      current = current[num];
    } else if (current[part] !== undefined) {
      current = current[part];
    } else {
      const lower = part.toLowerCase();
      const key = Object.keys(current).find((k) => k.toLowerCase() === lower);
      current = key != null ? current[key] : undefined;
    }
  }
  return current;
}

function AccessRequestSidebarContent({
  lastThreeValues,
  assignmentType,
  bundleId,
}: {
  lastThreeValues: { requestType: string; timeUpdated: string; failedDueToAccessGuardrailViolations: string };
  assignmentType: string;
  bundleId: string | null;
}) {
  const [bundleData, setBundleData] = useState<Record<string, any> | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);

  useEffect(() => {
    if (assignmentType !== "ACCESS_BUNDLE" || !bundleId) return;
    let cancelled = false;
    setBundleLoading(true);
    setBundleError(null);
    executeQuery<any>(
      `Select * from ag_accessbundles_permissions where id='${bundleId}'`,
      []
    )
      .then((response) => {
        if (cancelled) return;

        // Normalise response: prefer resultSet, otherwise single object
        let data: any[] = [];
        let raw: any = response;
        if (raw && typeof raw === "object" && Array.isArray(raw.resultSet)) {
          data = raw.resultSet;
        } else if (Array.isArray(raw)) {
          data = raw;
        } else if (raw && typeof raw === "object") {
          data = [raw];
        }

        const first = data[0];
        if (!first || typeof first !== "object") {
          setBundleData(null);
          return;
        }

        // For your payload shape, the useful data is in first.payload
        const payload = (first as any).payload;
        const toUse = payload && typeof payload === "object" ? payload : first;
        setBundleData(toUse as Record<string, any>);
      })
      .catch((err: any) => {
        if (!cancelled) setBundleError(err?.message || "Failed to load access bundle details");
      })
      .finally(() => {
        if (!cancelled) setBundleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assignmentType, bundleId]);

  const getBundleField = (row: Record<string, any> | null, paths: string[]): string => {
    if (!row) return "—";
    for (const path of paths) {
      const v = deepGet(row, path);
      if (v !== undefined && v !== null) return String(v);
    }
    const flatKeys = paths.map((p) => p.split(".").pop() || p);
    for (const key of flatKeys) {
      const v = row[key];
      if (v !== undefined && v !== null) return String(v);
    }
    const rowKeys = Object.keys(row);
    for (const path of paths) {
      const parts = path.split(".");
      let current: any = row;
      for (let i = 0; i < parts.length && current != null; i++) {
        const part = parts[i];
        const lower = part.toLowerCase();
        const num = Number(part);
        if (!Number.isNaN(num) && Array.isArray(current)) {
          current = current[num];
          continue;
        }
        const found = Object.keys(current).find((k) => k.toLowerCase() === lower);
        current = found != null ? current[found] : undefined;
      }
      if (current !== undefined && current !== null) return String(current);
    }
    return "—";
  };

  return (
    <div className="space-y-4 text-sm">
      {/* Row details card */}
      <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2.5 text-sm">
        <dl className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)] gap-x-4 gap-y-2">
          <div className="contents">
            <dt className="text-sm font-medium text-gray-500">Request Type (Workflow)</dt>
            <dd className="text-sm text-gray-900 break-words">{lastThreeValues.requestType}</dd>
          </div>
          <div className="contents">
            <dt className="text-sm font-medium text-gray-500">Time Updated</dt>
            <dd className="text-sm text-gray-900">{lastThreeValues.timeUpdated}</dd>
          </div>
          <div className="contents">
            <dt className="text-sm font-medium text-gray-500">
              Failed Due To Access Guardrail Violations
            </dt>
            <dd className="text-sm text-gray-900 break-words whitespace-normal">
              {lastThreeValues.failedDueToAccessGuardrailViolations}
            </dd>
          </div>
        </dl>
      </div>

      {/* Access bundle card */}
      {assignmentType === "ACCESS_BUNDLE" && bundleId && (
        <div className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Access Bundle
          </h3>
          {bundleLoading && (
            <p className="mt-1 text-sm text-gray-500">Loading access bundle details…</p>
          )}
          {bundleError && <p className="mt-1 text-sm text-red-600">{bundleError}</p>}
          {!bundleLoading && !bundleError && bundleData && (() => {
            const payload = bundleData.payload ?? bundleData.Payload;
            const source = payload && typeof payload === "object" ? { ...bundleData, ...payload } : bundleData;
            const accessTimeLimitType = getBundleField(source, ["accessTimeLimitType", "access_time_limit_type"]);
            return (
              <dl className="mt-2 grid grid-cols-[minmax(0,1.15fr)_minmax(0,1.7fr)] gap-x-6 gap-y-2.5">
                <div className="contents">
                  <dt className="text-sm font-medium text-gray-500 pr-1">Name</dt>
                  <dd className="text-sm text-gray-900 break-words">
                    {getBundleField(source, ["name", "displayName", "Name"])}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-sm font-medium text-gray-500 pr-1">Description</dt>
                  <dd className="text-sm text-gray-900 break-words">
                    {getBundleField(source, ["description", "Description"])}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-sm font-medium text-gray-500 pr-1">Created By</dt>
                  <dd className="text-sm text-gray-900 break-words">
                    {getBundleField(source, [
                      "createdBy.displayName",
                      "CreatedBy.DisplayName",
                      "created_by.display_name",
                    ])}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-sm font-medium text-gray-500 pr-1">Requestable By</dt>
                  <dd className="text-sm text-gray-900 break-words">
                    {getBundleField(source, [
                      "requestableBy.displayName",
                      "requestableBy.displayname",
                      "requestable_by.display_name",
                    ])}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-sm font-medium text-gray-500 pr-1">Status</dt>
                  <dd className="text-sm text-gray-900">
                    {getBundleField(source, ["status", "Status"])}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-sm font-medium text-gray-500 pr-1">
                    Approval Workflow
                  </dt>
                  <dd className="text-sm text-gray-900 break-words">
                    {getBundleField(source, [
                      "approvalWorkflowId.displayName",
                      "approvalWorkflowId.displayname",
                      "approval_workflow_id.display_name",
                    ])}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-sm font-medium text-gray-500 pr-1">
                    Orchestrated System
                  </dt>
                  <dd className="text-sm text-gray-900 break-words">
                    {getBundleField(source, [
                      "orchestratedSystem.displayName",
                      "orchestratedSystem.displayname",
                      "orchestrated_system.display_name",
                    ])}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-sm font-medium text-gray-500 pr-1">Owners</dt>
                  <dd className="text-sm text-gray-900 break-words">
                    {getBundleField(source, ["owners.0.name", "owners.name"])}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-sm font-medium text-gray-500 pr-1">
                    Resource Type
                  </dt>
                  <dd className="text-sm text-gray-900 break-words">
                    {getBundleField(source, [
                      "customAttributes.resourceType",
                      "resourceType",
                      "custom_attributes.resource_type",
                    ])}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-sm font-medium text-gray-500 pr-1">
                    Auto-approve if no violation
                  </dt>
                  <dd className="text-sm text-gray-900">
                    {getBundleField(source, [
                      "autoApproveIfNoViolation",
                      "auto_approve_if_no_violation",
                    ])}
                  </dd>
                </div>
                {accessTimeLimitType !== "INDEFINITELY" && (
                  <div className="contents">
                    <dt className="text-sm font-medium text-gray-500 pr-1">Access Time Limit</dt>
                    <dd className="text-sm text-gray-900">
                      {getBundleField(source, ["accessTimeLimit", "access_time_limit"])}
                    </dd>
                  </div>
                )}
                <div className="contents">
                  <dt className="text-sm font-medium text-gray-500 pr-1">
                    Permission Resource
                  </dt>
                  <dd className="text-sm text-gray-900 break-words">
                    {getBundleField(source, [
                      "permissions.0.resource.name",
                      "permissions.0.resource.displayName",
                      "permission.resource.name",
                    ])}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-sm font-medium text-gray-500 pr-1">Permission Type</dt>
                  <dd className="text-sm text-gray-900">
                    {getBundleField(source, [
                      "permissions.0.type",
                      "permissions.0.permissionType",
                      "permission.type",
                    ])}
                  </dd>
                </div>
              </dl>
            );
          })()}
        </div>
      )}
    </div>
  );
}

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

export default function AccessRequestReportPage() {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { openSidebar } = useRightSidebar();

  useEffect(() => {
    const runQuery = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await executeQuery<any>(
          "SELECT * FROM ag_access_request",
          []
        );

        let data: AccessRow[] = [];

        if (Array.isArray(response)) {
          data = response;
        } else if (response && typeof response === "object") {
          const possibleKeys = [
            "resultSet",
            "data",
            "items",
            "rows",
            "results",
            "records",
            "value",
            "values",
          ];
          for (const key of possibleKeys) {
            const v = (response as any)[key];
            if (Array.isArray(v)) {
              data = v;
              break;
            }
          }
          if (!data.length) {
            data = [response as AccessRow];
          }
        }

        // Flatten approvalRequests so each approval appears as its own row
        const flattened: AccessRow[] = [];
        for (const row of data) {
          const payload = (row as any)?.payload;
          const approvals = payload && Array.isArray(payload.approvalRequests)
            ? payload.approvalRequests
            : null;

          if (approvals && approvals.length > 0) {
            approvals.forEach((approval: any) => {
              const newPayload = { ...(payload || {}), approvalRequests: [approval] };
              flattened.push({ ...row, payload: newPayload });
            });
          } else {
            flattened.push(row);
          }
        }

        setRows(flattened);
        if (flattened && flattened.length > 0) {
          // Helpful for verifying field mappings during development
          // eslint-disable-next-line no-console
          console.log(
            "Access Request sample row keys:",
            Object.keys(flattened[0] || {})
          );
        }
      } catch (err: any) {
        console.error("Failed to load access request report:", err);
        setError(err?.message || "Failed to load access request report");
      } finally {
        setLoading(false);
      }
    };

    runQuery();
  }, []);

  const getField = (row: any, keys: string[]): any => {
    if (!row) return "";
    const rowKeys = Object.keys(row);

    // 1) Exact key match (case-sensitive)
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) {
        return row[key];
      }
    }

    // 2) Exact match ignoring case
    for (const key of keys) {
      const lowerTarget = key.toLowerCase();
      const actualKey = rowKeys.find(
        (rk) => rk.toLowerCase() === lowerTarget
      );
      if (
        actualKey &&
        row[actualKey] !== undefined &&
        row[actualKey] !== null
      ) {
        return row[actualKey];
      }
    }

    // 3) Fallback: partial match (target token contained in actual key, case-insensitive)
    for (const key of keys) {
      const token = key.toLowerCase();
      if (!token) continue;
      const actualKey = rowKeys.find((rk) =>
        rk.toLowerCase().includes(token)
      );
      if (
        actualKey &&
        row[actualKey] !== undefined &&
        row[actualKey] !== null
      ) {
        return row[actualKey];
      }
    }

    return "";
  };

  const getNestedField = (row: any, keys: string[]): any => {
    if (!row) return "";

    const payload = (row as any).payload;
    const identities0 = payload && Array.isArray(payload.identities) ? payload.identities[0] : null;
    const approvalReq0 =
      payload && Array.isArray(payload.approvalRequests) ? payload.approvalRequests[0] : null;

    const candidates = [row, payload, identities0, approvalReq0];

    for (const obj of candidates) {
      if (!obj) continue;
      const value = getField(obj, keys);
      if (value !== "" && value !== undefined && value !== null) {
        return value;
      }
    }

    return "";
  };

  const formatDateTime = (value: any): string => {
    if (!value) return "";
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return typeof value === "string" ? value : "";
    }
    const pad = (n: number) => n.toString().padStart(2, "0");
    const yy = pad(date.getFullYear() % 100);
    const MM = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${yy}/${MM}/${dd} ${hh}:${mm}`;
  };

  const getLastThreeColumnValues = useCallback((row: AccessRow | null) => {
    if (!row) return null;
    const requestType = getNestedField(row, [
      "requestType",
      "request_type",
      "requesttype",
      "request type",
      "workflowType",
      "workflow",
    ]);
    const timeUpdatedRaw = getNestedField(row, [
      "time_updated",
      "timeupdated",
      "timeUpdated",
      "updated_time",
      "updatedAt",
      "updated_at",
      "time updated",
    ]);
    const timeUpdated = formatDateTime(timeUpdatedRaw);
    const guardrailFailed = getNestedField(row, [
      "failed_due_to_access_guardrail_violations",
      "failedDueToAccessGuardrailViolations",
      "failedduetoaccessguardrailviolations",
      "guardrailFailureReason",
      "guardrail_failure_reason",
      "guardrail_violation",
      "guardrail_violations",
      "guardrail",
    ]);
    return {
      requestType: requestType !== "" ? String(requestType) : "—",
      timeUpdated: timeUpdated || "—",
      failedDueToAccessGuardrailViolations:
        guardrailFailed !== "" && guardrailFailed !== undefined && guardrailFailed !== null
          ? String(guardrailFailed)
          : "—",
    };
  }, []);

  const getAssignmentType = useCallback((row: AccessRow | null) => {
    if (!row) return "";
    const v = getNestedField(row, [
      "assignmentType",
      "assignment_type",
      "assignmenttype",
      "assignment type",
    ]);
    return typeof v === "string" ? v.trim() : String(v || "");
  }, []);

  const getAccessBundleIdFromRow = useCallback((row: AccessRow | null): string | null => {
    if (!row) return null;
    const payload = (row as any)?.payload;

    // Prefer ID from accessBundles array on the payload, e.g.
    // "accessBundles": [{ id: "e5017be1-8175-4eb7-a500-030d45f0134b", ... }]
    const accessBundles = payload && Array.isArray(payload.accessBundles)
      ? payload.accessBundles
      : null;
    if (accessBundles && accessBundles.length) {
      const bundleId = accessBundles[0]?.id;
      if (bundleId) return String(bundleId);
    }

    const approval0 =
      payload && Array.isArray(payload.approvalRequests) ? payload.approvalRequests[0] : null;
    const sources = [approval0, payload, row];
    for (const obj of sources) {
      if (!obj) continue;
      const id =
        getField(obj, [
          "accessBundleId",
          "accessBundle_id",
          "assignmentId",
          "assignment_id",
          "id",
        ]);
      if (id !== "" && id !== undefined && id !== null) {
        return String(id);
      }
    }
    return null;
  }, []);

  const columnDefs = React.useMemo<ColDef[]>(() => {
    return [
      // 1. Requester
      {
        headerName: "Requester",
        field: "requester",
        valueGetter: (params: any) =>
          getNestedField(params.data, [
            "requester",
            "requestor",
            "requesterName",
            "requester_name",
            "requestorName",
            "requestor_name",
            "requestedBy",
            "requested_by",
            "requesterdisplayname",
            "requester_display_name",
            "displayname",
            "display_name",
          ]),
        minWidth: 160,
      },
      // 2. Beneficiary
      {
        headerName: "Beneficiary",
        field: "beneficiary",
        valueGetter: (params: any) =>
          getNestedField(params.data, [
            "beneficiary",
            "beneficiaryName",
            "beneficiary_name",
            "targetUser",
            "target_user",
            "user",
            "beneficiarydisplayname",
            "beneficiary_display_name",
          ]),
        minWidth: 160,
      },
      // 3. Time Created
      {
        headerName: "Time Created",
        field: "time_created",
        valueGetter: (params: any) => {
          const raw = getNestedField(params.data, [
            "time_created",
            "timeCreated",
            "created_time",
            "createdAt",
            "created_at",
          ]);
          return formatDateTime(raw);
        },
        minWidth: 170,
      },
      // 4. Request Status
      {
        headerName: "Request Status",
        field: "request_status",
        valueGetter: (params: any) =>
          getNestedField(params.data, [
            "request_status",
            "requeststatus",
            "status",
            "requestStatus",
          ]),
        minWidth: 140,
      },
      // 5. Assignment Type
      {
        headerName: "Assignment Type",
        field: "assignment_type",
        valueGetter: (params: any) =>
          getNestedField(params.data, [
            "assignmentType",
            "assignment_type",
            "assignmenttype",
            "assignment type",
            "assign_type",
            "assignment",
          ]),
        minWidth: 150,
      },
      // 6. Assignment Name
      {
        headerName: "Assignment Name",
        field: "assignment_name",
        valueGetter: (params: any) =>
          getNestedField(params.data, [
            "assignmentName",
            "assignment_name",
            "assignmentname",
            "assignment name",
          ]),
        minWidth: 160,
      },
      // 7. Justification (Approval Status hidden)
      {
        headerName: "Justification",
        field: "justification",
        valueGetter: (params: any) =>
          getNestedField(params.data, ["justification", "reason", "comment"]),
        minWidth: 220,
        wrapText: true,
        autoHeight: true,
        cellStyle: {
          whiteSpace: "normal",
          wordBreak: "break-word",
          lineHeight: 1.4,
        },
      },
      {
        headerName: "",
        field: "expand",
        flex: 0,
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: (params: any) => {
          const row = params.data;
          return (
            <button
              type="button"
              className="flex items-center justify-center w-full h-full min-h-[36px] text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              onClick={() => {
                const values = getLastThreeColumnValues(row);
                if (!values) return;
                const assignmentType = getAssignmentType(row);
                const bundleId = getAccessBundleIdFromRow(row);
                openSidebar(
                  <AccessRequestSidebarContent
                    lastThreeValues={values}
                    assignmentType={assignmentType}
                    bundleId={bundleId}
                  />,
                  { title: "Request Details", widthPx: 480 }
                );
              }}
              title="View details"
            >
              <ChevronRight className="w-5 h-5 shrink-0" />
            </button>
          );
        },
      },
    ] as ColDef[];
  }, [openSidebar, getLastThreeColumnValues, getAssignmentType, getAccessBundleIdFromRow]);

  const defaultColDef = React.useMemo<ColDef>(
    () => ({
      flex: 1,
      minWidth: 100,
      sortable: true,
      filter: true,
      resizable: true,
      wrapText: true,
      autoHeight: true,
      cellStyle: {
        whiteSpace: "normal",
        wordBreak: "break-word",
        lineHeight: 1.4,
      },
    }),
    []
  );

  const filteredRows = rows.filter((row) => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return true;

    const requester = String(
      getNestedField(row, [
        "requester",
        "requestor",
        "requesterName",
        "requester_name",
        "requestorName",
        "requestor_name",
        "requestedBy",
        "requested_by",
        "requesterdisplayname",
        "requester_display_name",
        "displayname",
        "display_name",
      ]) || ""
    );
    const beneficiary = String(
      getNestedField(row, [
        "beneficiary",
        "beneficiaryName",
        "beneficiary_name",
        "targetUser",
        "target_user",
        "user",
        "beneficiarydisplayname",
        "beneficiary_display_name",
      ]) || ""
    );
    const timeRaw = getNestedField(row, [
      "time_created",
      "timeCreated",
      "created_time",
      "createdAt",
      "created_at",
    ]);
    const timeFormatted = formatDateTime(timeRaw);
    const timeSearchable = [timeFormatted, String(timeRaw || "")].join(" ");
    const assignmentName = String(
      getNestedField(row, [
        "assignmentName",
        "assignment_name",
        "assignmentname",
        "assignment name",
      ]) || ""
    );
    const haystack = [requester, beneficiary, timeSearchable, assignmentName]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full py-4 px-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900">
              Access Request Summary Report
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              View and analyze access requests and their approval status.
            </p>
          </div>
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
            {!loading && !error && rows.length > 0 && (
              <div className="relative min-w-0 flex-1 sm:max-w-4xl sm:flex-initial sm:min-w-[440px]">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by requester, beneficiary, time created, or assignment name"
                  title="Search by requester, beneficiary, time created, or assignment name"
                  className="w-full rounded-full border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  aria-label="Search by requester, beneficiary, time created, or assignment name"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (!gridApi) return;
                gridApi.exportDataAsCsv({
                  fileName: "access-request-summary-report.csv",
                });
              }}
              className="inline-flex shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900"
              aria-label="Download report"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading && (
          <p className="text-sm text-gray-500">
            Loading access request data…
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        {!loading && !error && rows.length === 0 && (
          <p className="text-sm text-gray-500">No data returned.</p>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="mt-2">
            {filteredRows.length === 0 ? (
              <p className="text-sm text-gray-500">
                No rows match your search.
              </p>
            ) : (
            <div className="ag-theme-alpine w-full">
              <AgGridReact
                rowData={filteredRows}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                theme={themeQuartz}
                pagination={true}
                paginationPageSize={20}
                paginationPageSizeSelector={[10, 20, 50, 100]}
                animateRows={true}
                domLayout="autoHeight"
                onGridReady={(params: any) => {
                  setGridApi(params.api);
                  params.api.sizeColumnsToFit();
                }}
                onFirstDataRendered={(params: any) => {
                  params.api.sizeColumnsToFit();
                }}
              />
            </div>
            )}
          </div>
        )}
      </div>
      <style jsx global>{`
        .ag-theme-alpine .ag-header-cell-label .ag-header-cell-text {
          white-space: normal !important;
          line-height: 1.3;
        }
      `}</style>
    </div>
  );
}

