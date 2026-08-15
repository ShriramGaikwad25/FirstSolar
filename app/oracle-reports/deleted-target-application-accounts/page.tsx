"use client";

import React, { useEffect, useState } from "react";
import { executeQuery } from "@/lib/api";
import dynamic from "next/dynamic";
import { ColDef, GridApi, themeQuartz } from "ag-grid-community";
import { Download } from "lucide-react";
import "@/lib/ag-grid-setup";
type DeletedRow = Record<string, any>;

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

export default function DeletedTargetApplicationAccountsReportPage() {
  const [rows, setRows] = useState<DeletedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  useEffect(() => {
    const runQuery = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await executeQuery<any>(
          "SELECT * FROM ag_deleted_target_account_report",
          []
        );

        let data: DeletedRow[] = [];

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
            data = [response as DeletedRow];
          }
        }

        setRows(data);
      } catch (err: any) {
        console.error(
          "Failed to load deleted target application accounts report:",
          err
        );
        setError(
          err?.message || "Failed to load deleted target application accounts"
        );
      } finally {
        setLoading(false);
      }
    };

    runQuery();
  }, []);

  const columns = React.useMemo(() => {
    if (!rows.length) return [] as string[];
    const keys = new Set<string>();
    rows.forEach((r) => Object.keys(r || {}).forEach((k) => keys.add(k)));
    const filtered = Array.from(keys).filter(
      (k) => !k.toLowerCase().includes("verif")
    );

    const normalized = (key: string) =>
      key.toLowerCase().replace(/[\s_]/g, "");

    // Identify specific columns for ordering
    const accountKeyCol =
      filtered.find((k) => normalized(k) === "accountkey") || null;

    const applicationCol =
      filtered.find((k) => normalized(k).includes("application")) || null;

    const eventDateCol =
      filtered.find((k) => {
        const lower = k.toLowerCase();
        return (
          (lower.includes("delete") && lower.includes("date")) ||
          (lower.includes("orphan") && lower.includes("date"))
        );
      }) || null;

    const ordered: string[] = [];
    if (accountKeyCol) ordered.push(accountKeyCol);
    if (applicationCol && !ordered.includes(applicationCol))
      ordered.push(applicationCol);
    if (eventDateCol && !ordered.includes(eventDateCol))
      ordered.push(eventDateCol);

    // Append any remaining columns in original order
    for (const k of filtered) {
      if (!ordered.includes(k)) ordered.push(k);
    }

    return ordered;
  }, [rows]);

  const columnDefs = React.useMemo<ColDef[]>(() => {
    return columns.map((col) => {
      const lower = col.toLowerCase();
      const isDeletedDate =
        lower.includes("delete") && lower.includes("date");
      const isOrphanDiscoveryDate =
        lower.includes("orphan") && lower.includes("date");
      const isEventDateCol = isDeletedDate || isOrphanDiscoveryDate;
      const isApplicationCol = lower.includes("application");

      return {
        headerName: isEventDateCol ? "Event Date" : col,
        field: col,
        valueGetter: (params: any) =>
          params.data ? formatCell(params.data[col]) : "",
        flex: isEventDateCol || isApplicationCol ? 0 : 1,
        width: isApplicationCol ? 120 : isEventDateCol ? 160 : undefined,
        minWidth: isApplicationCol ? 110 : isEventDateCol ? 140 : 120,
        sortable: true,
        filter: true,
        resizable: true,
      } as ColDef;
    });
  }, [columns]);

  const defaultColDef = React.useMemo<ColDef>(
    () => ({
      flex: 1,
      minWidth: 100,
      sortable: true,
      filter: true,
      resizable: true,
    }),
    []
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full py-4 px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Deleted Application Accounts Report
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Review accounts that have been deleted in target applications.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!gridApi) return;
              gridApi.exportDataAsCsv({
                fileName: "deleted-application-accounts-report.csv",
              });
            }}
            className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900"
            aria-label="Download report"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {loading && (
          <p className="text-sm text-gray-500">
            Loading deleted target application accounts…
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
    </div>
  );
}

function formatCell(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

