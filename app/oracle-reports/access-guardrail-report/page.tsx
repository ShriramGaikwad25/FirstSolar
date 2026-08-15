"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ColDef, GridApi, themeQuartz } from "ag-grid-community";
import { Download } from "lucide-react";
import "@/lib/ag-grid-setup";

type GuardrailRow = Record<string, any>;

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

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

function formatCell(value: any, key?: string): string {
  if (key) {
    const lowerKey = key.toLowerCase();
    const isDateLike =
      lowerKey.includes("date") ||
      lowerKey.includes("time") ||
      lowerKey.includes("timestamp");
    if (isDateLike) {
      return formatDateTime(value);
    }
  }

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

export default function AccessGuardrailReportPage() {
  const [rows, setRows] = useState<GuardrailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  useEffect(() => {
    const loadRows = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/SodVoilation.json", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load data: ${res.status}`);
        }
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error("Failed to load SOD violation data:", err);
        setError(err?.message || "Failed to load SOD violation data");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadRows();
  }, []);
  const columnDefs = useMemo<ColDef[]>(() => {
    if (!rows.length) return [];

    const preferredOrder = [
      "Control ID",
      "Control name",
      "Policy ID",
      "Violating user display name",
      "User ID",
      "Master Entitlement",
      "Conflicting Entitlement",
      "Control owner",
      "Mitigation justification",
      "Violation Detection Date",
      "Mitigation Start date",
      "Mitigation Expiry date",
      "Last review date",
    ];

    const flexByColumn: Record<string, number> = {
      "Control ID": 0.9,
      "Control name": 1.3,
      "Policy ID": 0.9,
      "Violating user display name": 1.3,
      "User ID": 1,
      "Master Entitlement": 1.4,
      "Conflicting Entitlement": 1.4,
      "Control owner": 1.1,
      "Mitigation justification": 2.2,
      "Violation Detection Date": 1.1,
      "Mitigation Start date": 1.1,
      "Mitigation Expiry date": 1.1,
      "Last review date": 1.1,
    };

    return preferredOrder
      .filter((key) => key in rows[0])
      .map((key) => ({
        headerName: key,
        field: key,
        minWidth: key === "Mitigation justification" ? 220 : 100,
        flex: flexByColumn[key] ?? 1,
        valueGetter: (params: any) => formatCell(params.data?.[key], key),
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
  }, [rows]);

  const defaultColDef = React.useMemo<ColDef>(
    () => ({
      flex: 1,
      minWidth: 80,
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
              SOD Violation Report
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              View segregation-of-duties policy violations and evaluations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!gridApi) return;
              gridApi.exportDataAsCsv({
                fileName: "sod-violation-report.csv",
              });
            }}
            className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900"
            aria-label="Download report"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {loading && (
          <p className="text-sm text-gray-500">Loading SOD violation data...</p>
        )}

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {!loading && !error && rows.length === 0 && (
          <p className="text-sm text-gray-500">No data returned.</p>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="mt-2">
            <div className="sod-grid w-full">
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
                }}
              />
            </div>
          </div>
        )}
      </div>
      <style jsx global>{`
        .sod-grid .ag-header-cell-label .ag-header-cell-text {
          white-space: normal !important;
          line-height: 1.3;
        }
      `}</style>
    </div>
  );
}

