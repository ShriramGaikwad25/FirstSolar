"use client";

import React, { useEffect, useState } from "react";
import { executeQuery } from "@/lib/api";
import dynamic from "next/dynamic";
import { ColDef, GridApi, themeQuartz } from "ag-grid-community";
import { ChevronRight, Download } from "lucide-react";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import "@/lib/ag-grid-setup";
type UserAccessRow = Record<string, any>;

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

function UserAccessSidebar({
  row,
  userLoginKey,
  agStatusKey,
  emailKey,
  userCreateKey,
  riskKey,
  systemTypeKey,
  grantUntilKey,
}: {
  row: UserAccessRow;
  userLoginKey: string | null;
  agStatusKey: string | null;
  emailKey: string | null;
  userCreateKey: string | null;
  riskKey: string | null;
  systemTypeKey: string | null;
  grantUntilKey: string | null;
}) {
  const getValue = (key: string | null): string => {
    if (!key) return "—";
    const v = row[key];
    if (v === null || v === undefined || v === "") return "—";
    try {
      return typeof v === "string" || typeof v === "number"
        ? String(v)
        : JSON.stringify(v);
    } catch {
      return String(v);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2.5 text-sm">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          User Details
        </h3>
        <dl className="mt-2 grid grid-cols-[minmax(0,1.05fr)_minmax(0,1.75fr)] gap-x-4 gap-y-2 text-sm">
          <div className="contents">
            <dt className="font-medium text-gray-500">User Login</dt>
            <dd className="text-gray-900 break-words">{getValue(userLoginKey)}</dd>
          </div>
          <div className="contents">
            <dt className="font-medium text-gray-500">AG Status</dt>
            <dd className="text-gray-900 break-words">{getValue(agStatusKey)}</dd>
          </div>
          <div className="contents">
            <dt className="font-medium text-gray-500">Email</dt>
            <dd className="text-gray-900 break-words">{getValue(emailKey)}</dd>
          </div>
          <div className="contents">
            <dt className="font-medium text-gray-500">User Create</dt>
            <dd className="text-gray-900 break-words">{getValue(userCreateKey)}</dd>
          </div>
          <div className="contents">
            <dt className="font-medium text-gray-500">Risk</dt>
            <dd className="text-gray-900 break-words">{getValue(riskKey)}</dd>
          </div>
          <div className="contents">
            <dt className="font-medium text-gray-500">System Type</dt>
            <dd className="text-gray-900 break-words">
              {getValue(systemTypeKey)}
            </dd>
          </div>
          <div className="contents">
            <dt className="font-medium text-gray-500">Grant Until</dt>
            <dd className="text-gray-900 break-words">
              {getValue(grantUntilKey)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export default function UserAccessReportPage() {
  const [rows, setRows] = useState<UserAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const { openSidebar } = useRightSidebar();

  useEffect(() => {
    const runQuery = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await executeQuery<any>(
          "SELECT * FROM ag_user_access_report LIMIT 1000;",
          []
        );

        let data: UserAccessRow[] = [];

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
            data = [response as UserAccessRow];
          }
        }

        setRows(data);
      } catch (err: any) {
        console.error("Failed to load user access report:", err);
        setError(err?.message || "Failed to load user access report");
      } finally {
        setLoading(false);
      }
    };

    runQuery();
  }, []);

  const {
    columns,
    userLoginKey,
    agStatusKey,
    emailKey,
    userCreateKey,
    userGlobalIdKey,
    riskKey,
    systemTypeKey,
    grantUntilKey,
  } = React.useMemo(() => {
    const result: {
      columns: string[];
      userLoginKey: string | null;
      agStatusKey: string | null;
      emailKey: string | null;
      userCreateKey: string | null;
      userGlobalIdKey: string | null;
      riskKey: string | null;
      systemTypeKey: string | null;
      grantUntilKey: string | null;
    } = {
      columns: [],
      userLoginKey: null,
      agStatusKey: null,
      emailKey: null,
      userCreateKey: null,
      userGlobalIdKey: null,
      riskKey: null,
      systemTypeKey: null,
      grantUntilKey: null,
    };

    if (!rows.length) return result;

    const keys = new Set<string>();
    rows.forEach((r) => Object.keys(r || {}).forEach((k) => keys.add(k)));
    const allKeys = Array.from(keys);

    const normalize = (k: string) => k.toLowerCase().replace(/[\s_]/g, "");

    result.userLoginKey =
      allKeys.find((k) => {
        const n = normalize(k);
        return n === "userlogin" || n.endsWith("userlogin") || n.includes("login");
      }) || null;

    result.agStatusKey =
      allKeys.find((k) => {
        const n = normalize(k);
        return n === "agstatus" || n.endsWith("agstatus") || n === "status";
      }) || null;

    result.emailKey =
      allKeys.find((k) => {
        const n = normalize(k);
        return n === "email" || n.endsWith("email");
      }) || null;

    result.userCreateKey =
      allKeys.find((k) => {
        const n = normalize(k);
        return (
          n === "usercreate" ||
          n.endsWith("usercreate") ||
          (n.includes("user") && n.includes("created")) ||
          n.includes("createddate")
        );
      }) || null;

    result.userGlobalIdKey =
      allKeys.find((k) => {
        const n = normalize(k);
        return (
          n === "userglobalid" ||
          n.endsWith("userglobalid") ||
          (n.includes("global") && n.includes("id"))
        );
      }) || null;

    result.riskKey =
      allKeys.find((k) => {
        const n = normalize(k);
        return n === "risk" || n.endsWith("risk");
      }) || null;

    result.systemTypeKey =
      allKeys.find((k) => {
        const n = normalize(k);
        return n === "systemtype" || (n.includes("system") && n.includes("type"));
      }) || null;

    result.grantUntilKey =
      allKeys.find((k) => {
        const n = normalize(k);
        return n === "grantuntil" || (n.includes("grant") && n.includes("until"));
      }) || null;

    // Columns shown in grid (hide the sidebar fields + global id)
    const hiddenSet = new Set(
      [
        result.userLoginKey,
        result.agStatusKey,
        result.emailKey,
        result.userCreateKey,
        result.userGlobalIdKey,
        result.riskKey,
        result.systemTypeKey,
        result.grantUntilKey,
      ].filter(Boolean) as string[]
    );

    result.columns = allKeys.filter((k) => !hiddenSet.has(k));

    return result;
  }, [rows]);

  const toTitleCase = (value: string): string =>
    value
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));

  const getHeaderName = (col: string): string => {
    const normalized = col.toLowerCase().replace(/_/g, "");
    if (normalized === "displayname") return "Display Name";
    if (normalized === "usertype") return "User Type";
    if (normalized === "permstatus") return "Perm Status";
    if (normalized === "systemtype") return "System Type";
    if (normalized === "provisionmechanism") return "Provision Mechanism";
    if (normalized === "permissiontype") return "Permission Type";
    if (normalized === "orchestratedsystem") return "Orchestrated System";
    if (normalized === "permissionname") return "Permission Name";
    if (normalized === "grantdate") return "Grant Date";
    return toTitleCase(col);
  };

  const columnDefs = React.useMemo<ColDef[]>(() => {
    // Ensure "Grant Date" appears last in the grid
    const grantDateCols = columns.filter((col) => {
      const n = col.toLowerCase().replace(/[\s_]/g, "");
      return n === "grantdate" || (n.includes("grant") && n.includes("date"));
    });
    const otherCols = columns.filter((col) => !grantDateCols.includes(col));
    const orderedCols = [...otherCols, ...grantDateCols];

    const defs: ColDef[] = orderedCols.map((col) => {
      const norm = col.toLowerCase().replace(/[\s_]/g, "");
      const isDisplayName = norm === "displayname";
      const isGrantDate = norm === "grantdate" || (norm.includes("grant") && norm.includes("date"));
      const isPermStatus = norm === "permstatus";

      return {
        headerName: getHeaderName(col),
        field: col,
        valueGetter: (params: any) =>
          params.data && params.data[col] !== undefined && params.data[col] !== null
            ? String(params.data[col])
            : "",
        flex: 1,
        minWidth: isDisplayName ? 160 : isGrantDate ? 60 : isPermStatus ? 60 : 70,
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
      } as ColDef;
    });

    // Trailing arrow column to open sidebar
    defs.push({
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
        const row = params.data as UserAccessRow;
        return (
          <button
            type="button"
            className="flex items-center justify-center w-full h-full min-h-[32px] text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            onClick={() => {
              openSidebar(
                <UserAccessSidebar
                  row={row}
                  userLoginKey={userLoginKey}
                  agStatusKey={agStatusKey}
                  emailKey={emailKey}
                  userCreateKey={userCreateKey}
                  riskKey={riskKey}
                  systemTypeKey={systemTypeKey}
                  grantUntilKey={grantUntilKey}
                />,
                { title: "User Access Details", widthPx: 480 }
              );
            }}
            title="View details"
          >
            <ChevronRight className="w-5 h-5 shrink-0" />
          </button>
        );
      },
    } as ColDef);

    return defs;
  }, [columns, openSidebar, userLoginKey, agStatusKey, emailKey, userCreateKey, riskKey, systemTypeKey, grantUntilKey]);

  const defaultColDef = React.useMemo<ColDef>(
    () => ({
      flex: 1,
      minWidth: 60,
      sortable: true,
      filter: true,
      resizable: true,
      wrapText: true,
      autoHeight: true,
      wrapHeaderText: true,
      autoHeaderHeight: true,
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
              User Current Access Report
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              View current user access across applications.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!gridApi) return;
              gridApi.exportDataAsCsv({
                fileName: "user-current-access-report.csv",
              });
            }}
            className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900"
            aria-label="Download report"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {loading && (
          <p className="text-sm text-gray-500">Loading user access data…</p>
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
                suppressHorizontalScroll={true}
                onGridSizeChanged={(params: any) => {
                  params.api.sizeColumnsToFit();
                }}
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

