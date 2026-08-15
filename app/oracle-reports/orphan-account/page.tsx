"use client";

import React, { useEffect, useState } from "react";
import { executeQuery } from "@/lib/api";
import dynamic from "next/dynamic";
import { ColDef, GridApi, themeQuartz } from "ag-grid-community";
import { Download } from "lucide-react";
import "@/lib/ag-grid-setup";
type OrphanRow = Record<string, any>;

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

export default function OrphanAccountReportPage() {
  const [rows, setRows] = useState<OrphanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationDate, setVerificationDate] = useState<string | null>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  useEffect(() => {
    const runQuery = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await executeQuery<any>(
          "SELECT * FROM ag_orphan_account_report",
          []
        );

        let data: OrphanRow[] = [];

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
            data = [response as OrphanRow];
          }
        }

        setRows(data);

        // Derive verification date (same for all) from first row if present.
        // Fallback to "N/A" so the box is always visible.
        let derivedDate: string | null = null;
        if (data.length > 0) {
          const first = data[0];
          const candidateKeys = [
            "verification_date",
            "verificationDate",
            "verified_date",
            "verifiedDate",
            "verificationdate",
            "VERIFICATION_DATE",
          ];

          for (const key of candidateKeys) {
            const value = (first as any)[key];
            if (value) {
              derivedDate = String(value);
              break;
            }
          }

          // If none of the known keys matched, try any key containing "verify" (case-insensitive)
          if (!derivedDate) {
            const dynamicKey = Object.keys(first).find((k) =>
              k.toLowerCase().includes("verif")
            );
            if (dynamicKey) {
              const value = (first as any)[dynamicKey];
              if (value) {
                derivedDate = String(value);
              }
            }
          }
        }

        setVerificationDate(derivedDate ?? "N/A");
      } catch (err: any) {
        console.error("Failed to load orphan account report:", err);
        setError(err?.message || "Failed to load orphan account report");
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
    // Exclude any verification-related columns from the grid;
    // we show verification date separately in the header box.
    const filtered = Array.from(keys).filter(
      (k) => !k.toLowerCase().includes("verif")
    );

    const normalized = (key: string) =>
      key.toLowerCase().replace(/[\s_]/g, "");

    const accountKeyCol =
      filtered.find((k) => normalized(k) === "accountkey") || null;

    const accountNameCol =
      filtered.find((k) => {
        const n = normalized(k);
        return n === "accountname" || n.endsWith("accountname");
      }) || null;

    const applicationCol =
      filtered.find((k) => normalized(k).includes("application")) || null;

    const orphanDiscoveryDateCol =
      filtered.find((k) => {
        const lower = k.toLowerCase();
        return lower.includes("orphan") && lower.includes("date");
      }) || null;

    const ordered: string[] = [];

    // First: Account Key, Account Name, Application
    if (accountKeyCol) ordered.push(accountKeyCol);
    if (accountNameCol && !ordered.includes(accountNameCol))
      ordered.push(accountNameCol);
    if (applicationCol && !ordered.includes(applicationCol))
      ordered.push(applicationCol);

    // Next: all remaining columns except Orphan Discovery Date
    for (const k of filtered) {
      if (k === orphanDiscoveryDateCol) continue;
      if (!ordered.includes(k)) ordered.push(k);
    }

    // Last: Orphan Discovery Date (if present)
    if (orphanDiscoveryDateCol && !ordered.includes(orphanDiscoveryDateCol)) {
      ordered.push(orphanDiscoveryDateCol);
    }

    return ordered;
  }, [rows]);

  const columnDefs = React.useMemo<ColDef[]>(() => {
    return columns.map((col) => {
      const lower = col.toLowerCase();
      const isOrphanDiscoveryDate =
        lower.includes("orphan") && lower.includes("date");
      const isApplicationCol = lower.includes("application");

      return {
        headerName: col,
        field: col,
        valueGetter: (params: any) =>
          params.data ? formatCell(params.data[col]) : "",
        // Make Orphan Discovery Date and especially Application narrower
        flex: isOrphanDiscoveryDate || isApplicationCol ? 0 : 1,
        width: isApplicationCol ? 120 : isOrphanDiscoveryDate ? 160 : undefined,
        minWidth: isApplicationCol ? 110 : isOrphanDiscoveryDate ? 140 : 120,
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
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Orphan Account Report
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Review accounts that are no longer linked to active identities.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {verificationDate && (
              <div className="min-w-[220px] bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-left">
                <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">
                  Verification Date
                </p>
                <p className="text-sm font-semibold text-emerald-900 mt-1">
                  {verificationDate}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (!gridApi) return;
                gridApi.exportDataAsCsv({
                  fileName: "orphan-account-report.csv",
                });
              }}
              className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900"
              aria-label="Download report"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading && (
          <p className="text-sm text-gray-500">Loading orphan accounts…</p>
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

