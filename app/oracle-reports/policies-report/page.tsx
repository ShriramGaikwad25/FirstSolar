"use client";

import React, { useEffect, useState } from "react";
import { executeQuery } from "@/lib/api";
import dynamic from "next/dynamic";
import { ColDef, GridApi, themeQuartz } from "ag-grid-community";
import { Download } from "lucide-react";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import "@/lib/ag-grid-setup";
type PolicyRow = Record<string, any>;

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

async function openAgResourceInNewWindow(
  type: "roles" | "accessBundles" | "identityCollections",
  id?: string | null
) {
  if (!id) return;
  const url = `/api/ag-resource?type=${encodeURIComponent(
    type
  )}&id=${encodeURIComponent(id)}`;

  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;

  win.document.write("<pre>Loading...</pre>");

  try {
    const res = await fetch(url);
    const text = await res.text();
    win.document.body.innerHTML = "";
    const pre = win.document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.style.wordBreak = "break-word";
    pre.textContent = text;
    win.document.body.appendChild(pre);
  } catch (e: any) {
    win.document.body.innerHTML = `<pre>Error calling API:\n${e?.message || String(
      e
    )}</pre>`;
  }
}

function formatDateTime(value: any): string {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return typeof value === "string" ? value : String(value ?? "");
  }
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yy = pad(date.getFullYear() % 100);
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${yy}/${MM}/${dd} ${hh}:${mm}`;
}

function getStringField(
  row: PolicyRow,
  candidates: string[],
  fallback?: string
): string {
  if (!row) return fallback ?? "";
  for (const key of candidates) {
    if (key.includes(".")) {
      const parts = key.split(".");
      let current: any = row;
      for (const part of parts) {
        if (current == null) break;
        current = current[part];
      }
      if (current !== undefined && current !== null && current !== "") {
        return String(current);
      }
    } else if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return String(row[key]);
    }
  }
  return fallback ?? "";
}

type ResourceType = "roles" | "accessBundles" | "identityCollections";

function PolicyAssignmentsPopup({
  row,
  onOpenResource,
}: {
  row: PolicyRow;
  onOpenResource: (type: ResourceType, id?: string | null) => void;
}) {
  const assignments = Array.isArray(row?.assignments) ? row.assignments : [];

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2.5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Assignments
        </h3>
        {assignments.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No assignment information available for this policy.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm border-separate border-spacing-y-1">
              <thead>
                <tr className="text-xs font-semibold text-gray-500 text-left">
                  <th className="px-2 py-1">Identity Collection</th>
                  <th className="px-2 py-1">Access Bundle</th>
                  <th className="px-2 py-1">Roles</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment: any, idx: number) => {
                  const identityCollection =
                    assignment?.identityCollections?.[0] || null;
                  const accessBundle = assignment?.accessBundles?.[0] || null;
                  const role = assignment?.roles?.[0] || null;

                  const identityCollectionName =
                    identityCollection?.displayName || identityCollection?.name || "";
                  const accessBundleName =
                    accessBundle?.displayName || accessBundle?.name || "";
                  const roleName = role?.displayName || role?.name || "";

                  const renderCellButton = (
                    label: string,
                    onClick?: () => void
                  ) =>
                    label ? (
                      <button
                        type="button"
                        className="text-blue-600 underline hover:text-blue-800"
                        onClick={onClick}
                      >
                        {label}
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    );

                  return (
                    <tr
                      key={assignment?.assignmentId || idx}
                      className="bg-white"
                    >
                      <td className="px-2 py-1 align-top">
                        {renderCellButton(identityCollectionName, () =>
                          onOpenResource("identityCollections", identityCollection?.id)
                        )}
                      </td>
                      <td className="px-2 py-1 align-top">
                        {renderCellButton(accessBundleName, () =>
                          onOpenResource("accessBundles", accessBundle?.id)
                        )}
                      </td>
                      <td className="px-2 py-1 align-top">
                        {renderCellButton(roleName, () =>
                          onOpenResource("roles", role?.id)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PoliciesReportPage() {
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [resourceView, setResourceView] = useState<{
    type: ResourceType;
    id: string;
  } | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [resourceBody, setResourceBody] = useState<string | null>(null);
  const [resourceJson, setResourceJson] = useState<any | null>(null);
  const { openSidebar, closeSidebar } = useRightSidebar();

  useEffect(() => {
    const runQuery = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await executeQuery<any>(
          "Select * from ag_policies_report",
          []
        );

        let rawData: PolicyRow[] = [];

        if (Array.isArray(response)) {
          rawData = response;
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
              rawData = v;
              break;
            }
          }
          if (!rawData.length) {
            rawData = [response as PolicyRow];
          }
        }

        const data: PolicyRow[] = rawData.map((row) => {
          const payload = (row as any).payload;
          // If payload is a JSON string (as in your sample), parse and use it
          if (typeof payload === "string") {
            try {
              const parsed = JSON.parse(payload);
              return {
                ...parsed,
                // Keep original id around if useful
                _rowId: (row as any).id ?? parsed.id,
              } as PolicyRow;
            } catch {
              // If parsing fails, fall back to original row
              return row;
            }
          }
          // If payload is already an object, prefer its fields
          if (payload && typeof payload === "object") {
            return {
              ...(payload as any),
              _rowId: (row as any).id ?? (payload as any).id,
            } as PolicyRow;
          }
          return row;
        });

        setRows(data);
      } catch (err: any) {
        console.error("Failed to load policies report:", err);
        setError(err?.message || "Failed to load policies report");
      } finally {
        setLoading(false);
      }
    };

    runQuery();
  }, []);

  const handleOpenResource = React.useCallback(
    async (type: ResourceType, id?: string | null) => {
      if (!id) return;
      // Close the right sidebar when a resource link is clicked
      try {
        closeSidebar();
      } catch {
        // ignore if sidebar is already closed
      }
      setResourceView({ type, id });
      setResourceLoading(true);
      setResourceError(null);
      setResourceBody(null);
      setResourceJson(null);

      const url = `/api/ag-resource?type=${encodeURIComponent(
        type
      )}&id=${encodeURIComponent(id)}`;
      try {
        const res = await fetch(url);
        const text = await res.text();
        setResourceBody(text);
        try {
          setResourceJson(JSON.parse(text));
        } catch {
          setResourceJson(null);
        }
        if (!res.ok) {
          setResourceError(`HTTP ${res.status} ${res.statusText}`);
        }
      } catch (e: any) {
        setResourceError(e?.message || "Failed to call REST API");
      } finally {
        setResourceLoading(false);
      }
    },
    []
  );

  const columnDefs = React.useMemo<ColDef[]>(() => {
    const defs: ColDef[] = [
      {
        headerName: "Name",
        field: "name",
        minWidth: 220,
        cellRenderer: (params: any) => {
          const row = params.data as PolicyRow;
          const name =
            getStringField(row, ["name", "displayName", "policyName"]) || "—";
          return (
            <button
              type="button"
              className="text-blue-600 underline hover:text-blue-800"
              onClick={() =>
                openSidebar(
                  <PolicyAssignmentsPopup
                    row={row}
                    onOpenResource={handleOpenResource}
                  />,
                  {
                  title: "Assignments",
                  widthPx: 520,
                  }
                )
              }
            >
              {name}
            </button>
          );
        },
      },
      {
        headerName: "Status",
        field: "status",
        minWidth: 120,
        valueGetter: (params: any) =>
          getStringField(params.data, ["status", "lifecycleState"], "—"),
      },
      {
        headerName: "Time Created",
        field: "timeCreated",
        minWidth: 170,
        valueGetter: (params: any) =>
          formatDateTime(
            getStringField(
              params.data,
              ["timeCreated", "createdTime", "created_at", "createdAt"],
              ""
            )
          ),
      },
      {
        headerName: "Time Updated",
        field: "timeUpdated",
        minWidth: 170,
        valueGetter: (params: any) =>
          formatDateTime(
            getStringField(
              params.data,
              ["timeUpdated", "updatedTime", "updated_at", "updatedAt"],
              ""
            )
          ),
      },
      {
        headerName: "Owner Name",
        field: "ownerName",
        minWidth: 180,
        valueGetter: (params: any) =>
          getStringField(
            params.data,
            [
              "owners.0.name",
              "owners.0.displayName",
              "owner.name",
              "owner.displayName",
              "ownerName",
            ],
            "—"
          ),
      },
      {
        headerName: "Created By",
        field: "createdBy",
        minWidth: 180,
        valueGetter: (params: any) =>
          getStringField(
            params.data,
            [
              "createdBy.name",
              "createdBy.displayName",
              "created_by.name",
              "created_by.display_name",
            ],
            "—"
          ),
      },
      {
        headerName: "Updated By",
        field: "updatedBy",
        minWidth: 180,
        valueGetter: (params: any) =>
          getStringField(
            params.data,
            [
              "updatedBy.name",
              "updatedBy.displayName",
              "updated_by.name",
              "updated_by.display_name",
            ],
            "—"
          ),
      },
    ];

    return defs.map((def) => ({
      ...def,
      flex: def.flex ?? 1,
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
    }));
  }, [openSidebar, handleOpenResource]);

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

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full py-4 px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Policies Report
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              View configured access and security policies.
            </p>
          </div>
          {!resourceView && (
            <button
              type="button"
              onClick={() => {
                if (!gridApi) return;
                gridApi.exportDataAsCsv({
                  fileName: "policies-report.csv",
                });
              }}
              className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900"
              aria-label="Download report"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>

        {resourceView && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div className="flex items-center justify-end mb-2">
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setResourceView(null);
                  setResourceBody(null);
                  setResourceError(null);
                  setResourceJson(null);
                }}
              >
                Back to Policies
              </button>
            </div>
            <div className="border-t border-gray-200 pt-2">
              {resourceLoading && (
                <p className="text-sm text-gray-500">Loading API response…</p>
              )}
              {resourceError && (
                <p className="text-sm text-red-600 mb-2">{resourceError}</p>
              )}
              {resourceJson && (
                <div className="mt-2 max-h-[480px] overflow-auto border border-gray-200 rounded">
                  {(() => {
                    const rowsArray = Array.isArray(resourceJson)
                      ? resourceJson
                      : [resourceJson];

                    if (!rowsArray.length) {
                      return (
                        <p className="text-xs text-gray-500 px-2 py-1">
                          Empty response.
                        </p>
                      );
                    }

                    const columnSpecs = [
                      {
                        header: "Name",
                        paths: ["name", "displayName"],
                        isDate: false,
                      },
                      {
                        header: "Description",
                        paths: ["description"],
                        isDate: false,
                      },
                      {
                        header: "Status",
                        paths: ["status", "lifecycleState"],
                        isDate: false,
                      },
                      {
                        header: "Owner",
                        paths: [
                          "owners.0.name",
                          "owners.0.displayName",
                          "owner.name",
                          "owner.displayName",
                        ],
                        isDate: false,
                      },
                      {
                        header: "Created By",
                        paths: [
                          "createdBy.name",
                          "createdBy.displayName",
                          "created_by.name",
                          "created_by.display_name",
                        ],
                        isDate: false,
                      },
                      {
                        header: "Updated By",
                        paths: [
                          "updatedBy.name",
                          "updatedBy.displayName",
                          "updated_by.name",
                          "updated_by.display_name",
                        ],
                        isDate: false,
                      },
                      {
                        header: "Time Created",
                        paths: [
                          "timeCreated",
                          "createdTime",
                          "created_at",
                          "createdAt",
                        ],
                        isDate: true,
                      },
                      {
                        header: "Time Updated",
                        paths: [
                          "timeUpdated",
                          "updatedTime",
                          "updated_at",
                          "updatedAt",
                        ],
                        isDate: true,
                      },
                      {
                        header: "Identity Group Type",
                        paths: ["identityGroupType"],
                        isDate: false,
                      },
                      {
                        header: "Revision Workflow",
                        paths: ["revisionApprovalWorkflow.name"],
                        isDate: false,
                      },
                      {
                        header: "Revision Status",
                        paths: ["revisionStatus"],
                        isDate: false,
                      },
                    ];

                    return (
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-1 text-left font-semibold text-gray-700">
                              #
                            </th>
                            {columnSpecs.map((col) => (
                              <th
                                key={col.header}
                                className="px-2 py-1 text-left font-semibold text-gray-700"
                              >
                                {col.header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rowsArray.map((row: any, rowIndex: number) => (
                            <tr
                              key={rowIndex}
                              className={
                                rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                              }
                            >
                              <td className="px-2 py-1 align-top text-gray-500">
                                {rowIndex + 1}
                              </td>
                              {columnSpecs.map((col) => {
                                let value = getStringField(
                                  row,
                                  col.paths,
                                  "",
                                );
                                if (col.isDate) {
                                  value = formatDateTime(value);
                                }
                                return (
                                  <td
                                    key={col.header}
                                    className="px-2 py-1 align-top text-gray-700"
                                  >
                                    <pre className="whitespace-pre-wrap break-words text-[11px]">
                                      {value}
                                    </pre>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              )}
              {resourceBody && !resourceJson && (
                <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-[480px] whitespace-pre-wrap break-words">
                  {resourceBody}
                </pre>
              )}
              {!resourceLoading && !resourceError && !resourceBody && !resourceJson && (
                <p className="text-sm text-gray-500">
                  No response body received.
                </p>
              )}
            </div>
          </div>
        )}

        {loading && (
          <p className="text-sm text-gray-500">Loading policies data…</p>
        )}
        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        {!loading && !error && !resourceView && rows.length === 0 && (
          <p className="text-sm text-gray-500">No data returned.</p>
        )}

        {!loading && !error && !resourceView && rows.length > 0 && (
          <div className="mt-2">
            <div className="ag-theme-alpine w-full">
              <AgGridReact
                rowData={rows}
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

